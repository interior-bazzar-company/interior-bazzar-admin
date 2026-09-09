/* =====================================================================
   ONE FORM, EVERY FIELD, for both create and edit.

   Sectioned rather than tabbed. Tabs would hide the pricing grid behind a
   click on the screen whose whole purpose is pricing, and they hide exactly
   the field somebody forgot to fill in. Everything is on one scroll, in the
   order the decisions are actually made: what it is → what it costs → what
   it includes.

   Each duration is its own small card rather than a row in a dense grid:
   the four numbers on it are money, they are typed rarely, and a labelled
   field somebody can read is worth more here than a compact table.

   NOT one transaction, and it cannot be: the server keeps a plan and its
   billing cycles behind separate endpoints. So the order is deliberate —
   the plan is written first, then each cycle, and the first refusal stops
   the rest and is rendered with what had already been saved named in it. A
   half-applied save that lies about itself is the one outcome worth writing
   extra code to avoid.

   PRICE FIELDS ARE LEVEL 3 (`plans.pricing`), and the server refuses the
   WHOLE call if a price field is present without it — so for a level-2
   editor those inputs are absent and never sent, and the rest of the form
   still saves.

   THE FORM IS UNCONTROLLED where the value is a plain string: `val(id)`
   reads it back off the DOM at save time, exactly as the prototype did, so
   every `id` below is load-bearing.
   ===================================================================== */
import { useState } from "react";
import { InputBase } from "@/components/base/input/input";
import AdminOpsService from "../../../api/modules/adminOps";
import { Alert, Button, Checkbox, FormField, FormSection, IconButton, Input, ModalShell, Textarea } from "../../ui";
import { can } from "../../shell/AdminShell";
import { val } from "../teamShared";
import { call, rupees } from "./api";
import type { Cycle, Feature, Plan } from "./api";
import { familyLabel, money, monthsLabel } from "./helpers";

/* An existing cycle carries its server id; a row added here has id 0 and is
   created on save. Strings throughout — these are text inputs, and a blank
   one has to stay distinguishable from a zero. */
type RowState = {
  id: number; months: string; price: string; oldPrice: string; badge: string; active: boolean;
};

const rowOf = (c: Cycle): RowState => ({
  id: c.id, months: String(c.months), price: String(c.price),
  oldPrice: c.oldPrice ? String(c.oldPrice) : "", badge: c.badge, active: c.active,
});
const blankRow = (): RowState => ({ id: 0, months: "", price: "", oldPrice: "", badge: "", active: true });

/** A row nobody filled in. Dropped rather than sent as a ₹0 cycle — the
 *  server would take it and the plans page would advertise it. */
const filled = (r: RowState) => !!r.months.trim() && !!r.price.trim();

export default function PlanModal({ plan, families, onClose, onDone }: {
  plan: Plan | null;
  families: string[];
  onClose: () => void;
  onDone: (msg: string, ref: number | null) => void;
}) {
  const pl = plan;
  const isNew = !pl;
  const mayPrice = can("plans", "pricing");

  const [rows, setRows] = useState<RowState[]>(() =>
    pl && pl.cycles.length ? pl.cycles.map(rowOf) : [blankRow()]);
  const [feats, setFeats] = useState<Feature[]>(() =>
    pl && pl.features.length ? pl.features.slice() : [{ text: "", detail: "" }]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setRow = (i: number, patch: Partial<RowState>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  /* Only what CHANGED is sent. Two reasons, both real: the server treats a
     missing field as "leave it alone", and a price field that is merely
     present — unchanged or not — escalates the whole call to level 3. */
  function planPayload(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const put = (k: string, v: string | number, was: string | number | undefined) => {
      if (isNew ? String(v).trim() !== "" : String(v) !== String(was ?? "")) out[k] = v;
    };
    put("title", val("plTitle").trim(), pl?.title);
    put("subtitle", val("plSubtitle").trim(), pl?.subtitle);
    put("tag", val("plTag").trim(), pl?.tag);
    put("badge", val("plBadge").trim(), pl?.badge);
    put("badgeIcon", val("plBadgeIcon").trim(), pl?.badgeIcon);
    put("duration", val("plDuration").trim(), pl?.duration);
    const tier = parseInt(val("plTier"), 10);
    if (!isNaN(tier) && tier !== (pl?.tier ?? -1)) out.tier = tier;
    const idx = parseInt(val("plIndex"), 10);
    if (!isNaN(idx) && idx !== (pl?.displayIndex ?? -1)) out.displayIndex = idx;

    if (mayPrice) {
      const amt = val("plAmount").trim();
      if (isNew ? amt !== "" : rupees(amt) !== (pl?.amount ?? 0)) out.amount = amt;
      const pay = val("plPayable").trim();
      if (isNew ? pay !== "" : rupees(pay) !== (pl?.payable ?? 0)) out.payableAmount = pay;
    }

    /* Sent as {text, subItem} — the shape the server stores. A detail line that
       came back from the server has to go back with it, or saving an unrelated
       field would quietly wipe every detail on the card. */
    const cleanFeats = feats
      .map((f) => ({ text: f.text.trim(), subItem: f.detail.trim() }))
      .filter((f) => f.text);
    const featKey = (fs: { text: string; subItem?: string; detail?: string }[]) =>
      fs.map((f) => f.text + "|" + (f.subItem ?? f.detail ?? "")).join("~");
    if (isNew ? cleanFeats.length : featKey(cleanFeats) !== featKey(pl?.features || []))
      out.features = cleanFeats;
    return out;
  }

  /** Cycles, one call each, after the plan itself. Returns the label of the
   *  last one that succeeded so a mid-way refusal can say where it stopped. */
  async function syncCycles(planId: number): Promise<void> {
    const live = rows.filter(filled);
    for (const r of live) {
      const body = {
        durationMonths: parseInt(r.months, 10),
        price: String(rupees(r.price)),
        oldPrice: r.oldPrice.trim() ? String(rupees(r.oldPrice)) : "",
        badgeLabel: r.badge.trim(),
        isActive: r.active,
      };
      const was = pl ? pl.cycles.filter((c) => c.id === r.id)[0] : undefined;
      if (!was) { await call(AdminOpsService.addCycle(planId, body)); continue; }
      const same = was.months === body.durationMonths && String(was.price) === body.price
        && String(was.oldPrice || "") === body.oldPrice && was.badge === body.badgeLabel
        && was.active === body.isActive;
      if (!same) await call(AdminOpsService.updateCycle(planId, r.id, body));
    }
    /* Removed rows. The server hard-deletes an unpurchased cycle and merely
       switches off one somebody bought — either way history survives. */
    for (const c of pl ? pl.cycles : []) {
      if (!live.some((r) => r.id === c.id)) await call(AdminOpsService.deleteCycle(planId, c.id));
    }
  }

  const save = async () => {
    const title = val("plTitle").trim();
    if (!title) return setErr("A plan needs a title.");
    const family = val("plFamily").trim().toLowerCase();
    if (isNew && !family) return setErr("A plan needs a family — it decides what the purchase unlocks.");

    setErr(null); setBusy(true);
    try {
      if (isNew) {
        const cycles = mayPrice ? rows.filter(filled).map((r) => ({
          durationMonths: parseInt(r.months, 10),
          price: String(rupees(r.price)),
          oldPrice: r.oldPrice.trim() ? String(rupees(r.oldPrice)) : undefined,
          badgeLabel: r.badge.trim(),
          isActive: r.active,
        })) : [];
        const created = await call(AdminOpsService.addPlan({
          ...planPayload(), planFamily: family, cycles,
        } as Parameters<typeof AdminOpsService.addPlan>[0]));
        onDone("Plan created and on sale — it is on the public plans page now.", created.id);
        return;
      }
      const body = planPayload();
      if (Object.keys(body).length) await call(AdminOpsService.updatePlan(pl.id, body));
      if (mayPrice) await syncCycles(pl.id);
      onDone("Plan saved. The public plans page is already showing it.", pl.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not reach the server.");
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title={isNew ? "Create plan" : "Edit plan"}
      sub={isNew ? "Everything about the plan, on one form" : "#" + pl.id + " · " + familyLabel(pl.family)}
      mono={!isNew}
      onClose={onClose}
      actions={<>
        <Button color="secondary" data-close="1" onClick={onClose} isDisabled={busy}>Cancel</Button>
        <Button color="primary" data-act="pl-save" data-ref={pl ? pl.id : undefined}
          isLoading={busy} showTextWhileLoading onClick={save}>
          {isNew ? "Create plan" : "Save changes"}
        </Button>
      </>}
    >
      <div className="flex flex-col gap-6">
        {err ? <div id="plErr"><Alert tone="bad" title={err} /></div> : null}

        <FormSection title="Plan information">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="plTitle" label="Plan title" req>
              <Input id="plTitle" defaultValue={pl ? pl.title : ""} ph="Growth" autoFocus />
            </FormField>
            {isNew
              ? <FormField id="plFamily" label="Family" req hint={<>
                  Decides what buying it unlocks — a plan under <span className="font-mono">architect</span>{" "}
                  entitles an architect profile. Pick an existing family unless you are genuinely
                  starting a new one; <b className="font-semibold">it cannot be changed afterwards.</b>
                </>}>
                  <InputBase id="plFamily" size="sm" list="plFamilyList" placeholder="business"
                    defaultValue={families[0] || "business"} />
                  <datalist id="plFamilyList">
                    {families.map((f) => <option key={f} value={f} />)}
                  </datalist>
                </FormField>
              : <FormField id="plFamilyRO" label="Family"
                  hint="Fixed at creation — it decides what a purchase unlocks, and moving a sold plan between families would strand the entitlements already granted.">
                  <Input id="plFamilyRO" readOnly value={familyLabel(pl.family)} />
                </FormField>}
          </div>

          <FormField id="plSubtitle" label="Description" hint="Shown under the title on the catalogue list.">
            <Textarea id="plSubtitle" rows={2} defaultValue={pl ? pl.subtitle : ""}
              ph="One line an agent can read out on a call." />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField id="plTag" label="Tag" hint="The plan's key on the public page.">
              <Input id="plTag" defaultValue={pl ? pl.tag : ""} ph="business-starter" mono />
            </FormField>
            <FormField id="plBadge" label="Ribbon" hint="Printed across the corner of the card.">
              <Input id="plBadge" defaultValue={pl ? pl.badge : ""} ph="Most popular" />
            </FormField>
            <FormField id="plBadgeIcon" label="Ribbon icon" hint="A tabler icon name.">
              <Input id="plBadgeIcon" defaultValue={pl ? pl.badgeIcon : ""} ph="star" mono />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="plTier" label="Upgrade tier" hint="Rank inside the family, 1 = entry. Upgrades are judged on it.">
              <Input id="plTier" type="number" min={0} step={1} defaultValue={pl ? String(pl.tier) : "1"} />
            </FormField>
            <FormField id="plIndex" label="Card order" hint="Which slot the card takes on the public page, 1 = first. Blank appends it last.">
              <Input id="plIndex" type="number" min={0} step={1} defaultValue={pl && pl.displayIndex ? String(pl.displayIndex) : ""} />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Pricing" desc={mayPrice
          ? "What a buyer pays, per duration. The checkout charges these — Was is the struck-through figure on the public card and only shows when it is above the price."
          : "What a buyer pays, per duration."}>
          {mayPrice
            ? <>
                <ul id="plGrid" className="flex flex-col gap-3">
                  {rows.map((r, i) => (
                    <CycleCard key={i} r={r} i={i} n={rows.length}
                      onPatch={(patch) => setRow(i, patch)}
                      onRemove={() => setRows((rs) => {
                        const out = rs.filter((_, j) => j !== i);
                        return out.length ? out : [blankRow()];
                      })} />
                  ))}
                </ul>
                <div>
                  <Button color="secondary" ico="plus" data-act="pl-row-add"
                    onClick={() => setRows((rs) => rs.concat([blankRow()]))}>Add duration</Button>
                </div>
                <p className="text-sm text-tertiary">
                  A duration switched off keeps its history but disappears from the card. Removing one
                  deletes it outright if nobody ever bought it, and switches it off if somebody did.
                </p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <FormField id="plAmount" label="Ranking amount ₹"
                    hint="NOT charged to anybody. It ranks plans against each other, so it should track the annual price.">
                    <Input id="plAmount" type="number" min={0} step={100} mono defaultValue={pl && pl.amount ? String(pl.amount) : ""} />
                  </FormField>
                  <FormField id="plPayable" label="Payable amount ₹"
                    hint="Legacy figure on the plan row. Keep it equal to the ranking amount.">
                    <Input id="plPayable" type="number" min={0} step={100} mono defaultValue={pl && pl.payable ? String(pl.payable) : ""} />
                  </FormField>
                  <FormField id="plDuration" label="Default duration (months)"
                    hint="Fallback term when a plan is granted by hand.">
                    <Input id="plDuration" defaultValue={pl ? pl.duration : "12"} />
                  </FormField>
                </div>

                <Alert tone="warn" ico="alert" title="Activating a plan worth less than the one a buyer already holds silently expires it.">
                  The ranking amount is what decides that, and it is not the price — leaving it unset is a
                  real hazard, not a blank field.
                </Alert>
              </>
            : <Alert tone="info" ico="lock" title="Prices are yours to read, not to change.">
                Editing money on the catalogue needs the Plans · pricing permission. Everything else on
                this form still saves.
              </Alert>}
        </FormSection>

        <FormSection title="Features"
          desc="The bullet list on the public plan card. The detail box is the smaller line printed under the bullet — left empty, no detail line is shown.">
          <ul id="plFeats" className="flex flex-col gap-3">
            {feats.map((f, i) => (
              <li key={i} className="flex items-end gap-2">
                <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-5">
                  <FormField cls="sm:col-span-3" id={"plFeatText" + i} label={"Feature " + (i + 1)}>
                    <Input id={"plFeatText" + i} ph="Verified business listing" value={f.text}
                      onChange={(v) => setFeats((fs) => fs.map((x, j) => (j === i ? { ...x, text: v } : x)))} />
                  </FormField>
                  <FormField cls="sm:col-span-2" id={"plFeatDetail" + i} label="Detail">
                    <Input id={"plFeatDetail" + i} ph="Optional" value={f.detail}
                      onChange={(v) => setFeats((fs) => fs.map((x, j) => (j === i ? { ...x, detail: v } : x)))} />
                  </FormField>
                </div>
                <IconButton ico="trash" size="sm" label={"Remove feature " + (i + 1)} data-act="pl-feat-del"
                  onClick={() => setFeats((fs) => {
                    const out = fs.filter((_, j) => j !== i);
                    return out.length ? out : [{ text: "", detail: "" }];
                  })} />
              </li>
            ))}
          </ul>
          <div>
            <Button color="secondary" ico="plus" data-act="pl-feat-add"
              onClick={() => setFeats((fs) => fs.concat([{ text: "", detail: "" }]))}>Add feature</Button>
          </div>
        </FormSection>

        {isNew
          ? <Alert tone="warn" ico="alert" title="A new plan is on sale the moment it is created.">
              It appears on the public plans page straight away — take it off sale from the drawer if it
              is not ready.
            </Alert>
          : <Alert tone="info" ico="lock" title="Saving changes what the next buyer pays, immediately.">
              Subscriptions already sold keep the price they were bought at.
            </Alert>}
      </div>
    </ModalShell>
  );
}

/* ONE DURATION, as a card: the four numbers that decide what a buyer pays,
   each with a label somebody can read, and the per-month figure computed
   beside them so a price can be sanity-checked without arithmetic. */
function CycleCard({ r, i, n, onPatch, onRemove }: {
  r: RowState; i: number; n: number;
  onPatch: (patch: Partial<RowState>) => void;
  onRemove: () => void;
}) {
  const price = rupees(r.price);
  const months = parseInt(r.months, 10) || 0;
  return (
    <li className="flex flex-col gap-3 rounded-lg bg-secondary p-3 ring-1 ring-secondary">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="label-mono">{months ? monthsLabel(months) : "New duration"}</span>
        <span className="text-xs text-tertiary tnum">
          {price && months ? money(Math.round(price / months)) + " / month" : "—"}
        </span>
        <span className="ml-auto flex items-center gap-2">
          <Checkbox id={"plCycleOn" + i} checked={r.active} label="On sale"
            onChange={(v) => onPatch({ active: v })} />
          <IconButton ico="trash" size="sm" data-act="pl-row-del"
            label={n > 1 ? "Remove this duration" : "Clear this duration"} onClick={onRemove} />
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <FormField id={"plCycleM" + i} label="Months">
          <Input id={"plCycleM" + i} type="number" min={1} step={1} ph="12" value={r.months}
            onChange={(v) => onPatch({ months: v })} />
        </FormField>
        <FormField id={"plCycleP" + i} label="Price ₹">
          <Input id={"plCycleP" + i} type="number" min={0} step={100} ph="0" mono value={r.price}
            onChange={(v) => onPatch({ price: v })} />
        </FormField>
        <FormField id={"plCycleO" + i} label="Was ₹">
          <Input id={"plCycleO" + i} type="number" min={0} step={100} ph="—" mono value={r.oldPrice}
            onChange={(v) => onPatch({ oldPrice: v })} />
        </FormField>
        <FormField id={"plCycleL" + i} label="Label">
          <Input id={"plCycleL" + i} ph="Annual" value={r.badge}
            onChange={(v) => onPatch({ badge: v })} />
        </FormField>
      </div>
    </li>
  );
}
