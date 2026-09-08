/* =====================================================================
   ONE FORM, EVERY FIELD, for both create and edit.

   Sectioned rather than tabbed. Tabs would hide the pricing grid behind a
   click on the screen whose whole purpose is pricing, and they hide exactly
   the field somebody forgot to fill in. Everything is on one scroll, in the
   order the decisions are actually made: what it is → what it costs → what
   it includes.

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
   ===================================================================== */
import { useState } from "react";
import AdminOpsService from "../../../api/modules/adminOps";
import { Field, Icon, ModalHead, Notice, SectionHead } from "../../ui";
import { can } from "../../shell/AdminShell";
import { val } from "../teamShared";
import { call, rupees } from "./api";
import type { Cycle, Feature, Plan } from "./api";
import { familyLabel, money } from "./helpers";

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
    <>
      <ModalHead title={isNew ? "Create plan" : "Edit plan"} sub={isNew ? "Everything about the plan, on one form" : "#" + pl.id + " · " + familyLabel(pl.family)} mono={!isNew} onClose={onClose} />

      <div className="md-b">
        <div id="plErr">
          {err ? <Notice tone="bad" text={<b>{err}</b>} /> : null}
        </div>

        <SectionHead title="Plan information" />
        <Field id="plTitle" label="Plan title" req value={pl ? pl.title : ""} ph="Growth" />
        {isNew
          ? <Field id="plFamily" label="Family" req custom={
              <>
                <input className="inp" id="plFamily" list="plFamilyList" placeholder="business"
                  defaultValue={families[0] || "business"} />
                <datalist id="plFamilyList">
                  {families.map((f) => <option key={f} value={f} />)}
                </datalist>
                <div className="help">
                  Decides what buying it unlocks — a plan under <span className="mono">architect</span>{" "}
                  entitles an architect profile. Pick an existing family unless you are genuinely
                  starting a new one; <b>it cannot be changed afterwards.</b>
                </div>
              </>
            } />
          : <Field id="plFamilyRO" label="Family" value={familyLabel(pl.family)} ro
              help="Fixed at creation — it decides what a purchase unlocks, and moving a sold plan between families would strand the entitlements already granted." />}
        <Field id="plSubtitle" label="Description" type="textarea" value={pl ? pl.subtitle : ""}
          ph="One line an agent can read out on a call."
          help="Shown under the title on the catalogue list." />
        <Field id="plTag" label="Tag" value={pl ? pl.tag : ""} ph="business-starter"
          help="The plan's key on the public page. Leave it alone on an existing plan unless you know what reads it." />
        <Field id="plBadge" label="Ribbon" value={pl ? pl.badge : ""} ph="Most popular"
          help="Printed across the corner of the plan card. Blank for no ribbon." />
        <Field id="plBadgeIcon" label="Ribbon icon" value={pl ? pl.badgeIcon : ""} ph="tabler icon name" />
        <Field id="plTier" label="Upgrade tier" type="number" value={pl ? pl.tier : 1}
          help="Rank inside the family, 1 = entry. Upgrades are judged on it." />
        <Field id="plIndex" label="Card order" type="number" value={pl ? pl.displayIndex : ""}
          help="Which slot the card takes on the public page, 1 = first. Siblings shift to make room; blank appends it last." />

        <SectionHead title="Pricing" desc="What a buyer pays, per duration. The checkout charges these." />
        {mayPrice
          ? <>
              <div className="pl-grid" id="plGrid">
                <div className="pl-grid-h">
                  <span>Months</span><span>Price ₹</span><span>Was ₹</span>
                  <span>Label</span><span>Per month</span><span>On sale</span>
                </div>
                {rows.map((r, i) => {
                  const price = rupees(r.price), months = parseInt(r.months, 10) || 0;
                  return (
                    <div className="pl-row" key={i}>
                      <input className="inp pl-base" type="number" min="1" step="1" placeholder="12"
                        value={r.months} onChange={(e) => setRow(i, { months: e.target.value })} />
                      <input className="inp pl-base" type="number" min="0" step="100" placeholder="0"
                        value={r.price} onChange={(e) => setRow(i, { price: e.target.value })} />
                      <input className="inp pl-base" type="number" min="0" step="100" placeholder="—"
                        value={r.oldPrice} onChange={(e) => setRow(i, { oldPrice: e.target.value })} />
                      <input className="inp" placeholder="Annual"
                        value={r.badge} onChange={(e) => setRow(i, { badge: e.target.value })} />
                      <span className="pl-final tnum">{price && months ? money(Math.round(price / months)) : "—"}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <label className="check pl-live">
                          <input type="checkbox" className="pl-active" checked={r.active}
                            onChange={(e) => setRow(i, { active: e.target.checked })} /><span></span>
                        </label>
                        <button className="btn icon sm" data-act="pl-row-del" aria-label="Remove duration"
                          onClick={() => setRows((rs) => {
                            const out = rs.filter((_, j) => j !== i);
                            return out.length ? out : [blankRow()];
                          })}><Icon name="x" size="sm" /></button>
                      </span>
                    </div>
                  );
                })}
              </div>
              <button className="btn sm" data-act="pl-row-add" style={{ marginTop: "8px" }}
                onClick={() => setRows((rs) => rs.concat([blankRow()]))}>
                <Icon name="plus" size="sm" />Add duration
              </button>
              <div className="help" style={{ marginTop: "8px" }}>
                <b>Was</b> is the struck-through price on the public card, and it only shows when it is
                higher than the price — the site prints "Save ₹x" from the difference. A duration
                switched off keeps its history but disappears from the card. Removing a row deletes it
                outright if nobody ever bought it, and switches it off if somebody did.
              </div>
              <div style={{ marginTop: "14px" }}>
                <Field id="plAmount" label="Ranking amount ₹" type="number" value={pl ? pl.amount : ""}
                  help="NOT charged to anybody. It ranks plans against each other — activating a plan worth less than the one a user already holds silently expires it — so it should track the annual price." />
                <Field id="plPayable" label="Payable amount ₹" type="number" value={pl ? pl.payable : ""}
                  help="Legacy figure on the plan row itself. Keep it equal to the ranking amount unless you know what still reads it." />
                <Field id="plDuration" label="Default duration (months)" value={pl ? pl.duration : "12"}
                  help="Fallback term when a plan is granted by hand and no duration is given." />
              </div>
            </>
          : <Notice ico="lock" text={<>
              <b>Prices are yours to read, not to change.</b> Editing money on the catalogue needs the
              Plans · pricing permission. Everything else on this form still saves.
            </>} />}

        <SectionHead title="Features"
          desc="The bullet list on the public plan card. The second box is the smaller detail
                line printed under the bullet — left empty, no detail line is shown." />
        <div id="plFeats">
          {feats.map((f, i) => (
            <div className="pl-frow" key={i}>
              <input className="inp pl-flabel" placeholder="Verified business listing" value={f.text}
                onChange={(e) => setFeats((fs) => fs.map((x, j) =>
                  (j === i ? { ...x, text: e.target.value } : x)))} />
              <input className="inp pl-fdetail" placeholder="Detail (optional)" value={f.detail}
                onChange={(e) => setFeats((fs) => fs.map((x, j) =>
                  (j === i ? { ...x, detail: e.target.value } : x)))} />
              <button className="btn icon sm" data-act="pl-feat-del" aria-label="Remove"
                onClick={() => setFeats((fs) => {
                  const out = fs.filter((_, j) => j !== i);
                  return out.length ? out : [{ text: "", detail: "" }];
                })}><Icon name="x" size="sm" /></button>
            </div>
          ))}
        </div>
        <button className="btn sm" data-act="pl-feat-add" style={{ marginTop: "8px" }}
          onClick={() => setFeats((fs) => fs.concat([{ text: "", detail: "" }]))}>
          <Icon name="plus" size="sm" />Add feature
        </button>

        {isNew
          ? <Notice ico="alert" text={<>
              <b>A new plan is on sale the moment it is created.</b> It appears on the public plans
              page straight away — take it off sale from the drawer if it is not ready.
            </>} />
          : <Notice ico="lock" text={<>
              <b>Saving changes what the next buyer pays, immediately.</b> Subscriptions already sold
              keep the price they were bought at.
            </>} />}
      </div>

      <div className="md-f">
        <span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" data-act="pl-save" data-ref={pl ? pl.id : undefined}
          disabled={busy} onClick={save}>
          {busy ? "Saving…" : isNew ? "Create plan" : "Save changes"}
        </button>
      </div>
    </>
  );
}
