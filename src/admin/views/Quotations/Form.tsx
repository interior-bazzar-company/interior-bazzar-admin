/* =====================================================================
   QUOTATION — the builder body: the form on the left, the paper on the right.

   ONE BUILDER CHROME, written the same way in both modules (Invoices/Form.tsx
   is its twin): `BuilderLayout` puts the numbered steps in the main column and
   the LIVE SHEET in a rail that sticks from `lg`. Under `lg` the sheet drops
   below the form — a 210mm document in a 320px column is not a preview of
   anything.

   The rules the layout encodes, and why they are worth keeping:

     · ONE Save, in the page header, that writes the dates, the plan and the
       charges together. There used to be one button per block, and nothing
       said which of them still held unwritten work.
     · TAX HAS ONE CONTROL, in the totals block, beside the number it changes.
     · ONE place to add a one-off charge — inside the step that already holds
       what the customer is buying.
     · FOUR numbered steps in the order the document reads: who and when, what
       they are buying, what it comes to, what it says. Bill-to is reference,
       so it is a strip inside step 1 rather than a section competing with it.

   Inputs are uncontrolled and read from the DOM at save time, exactly as the
   prototype's `val(id)` does: the server recomputes every figure anyway, so
   re-rendering the page on each keystroke would buy nothing. What is typed is
   ALSO mirrored into `live` so the sheet beside it keeps up — text only; every
   figure on the sheet is the one the server last computed, and the rail says so.
   ===================================================================== */
import { useState } from "react";
import AdminOpsService from "../../../api/modules/adminOps";
import type { QuotationSaveInput } from "../../../api/modules/adminOps";
import {
  Alert, Button, Card, DateInput, Eyebrow, FieldRow, FormField, FormSection, Input, PageHeader, Pill,
  SectionHead, SelectInput, Segmented, Table, Tag, Textarea,
} from "../../ui";
import { inr, inrWords } from "../../ui/format";
import { useShell } from "../../shell/ShellContext";
import { useNav } from "../../shell/AdminShell";
import { errMessage } from "../../../api/apiService";
import { call, rupeesToPaise, usePlanCatalogue } from "./api";
import PlanModal from "./PlanModal";
import type { PlanPick } from "./PlanModal";
import type { QuotationRow } from "./api";
import type { PlanRow } from "../../../api/modules/adminOps";
import {
  BuilderLayout, FeatureFold, MoneyLine, PartyStrip, QuotationSheet, ReadyLine, StepHead,
} from "./bits";
import type { LiveDoc } from "./bits";
import {
  GST_RATES, SELLER, STATES, addonsOf, blockersOf, lineNet, planItemOf, planLabel,
} from "./helpers";

const DEFAULT_VALIDITY_DAYS = 15;
const COUNTS = [1, 2, 3, 4, 5];

type LiveKey = "date" | "until" | "placeOfSupply" | "notes" | "terms" | "planName" | "planHsn" | "termMonths";

/* ============================================================== the body === */
export function BuilderBody({ q, onSaved, detail }: {
  q: QuotationRow; onSaved: () => void; detail: string;
}) {
  const plan = planItemOf(q);
  const addons = addonsOf(q);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /* The two controls whose CHOICE changes what else is on screen — the rest
     are read from the DOM at save time. */
  const [taxMode, setTaxMode] = useState(q.taxMode);
  const [count, setCount] = useState(plan ? plan.installments || 1 : 1);
  /* What has been typed but not yet saved, mirrored onto the sheet beside it. */
  const [live, setLive] = useState<LiveDoc>({});
  const { plans, loading: plansLoading } = usePlanCatalogue();
  const { modal, closeLayer, toast } = useShell();
  const { go } = useNav();

  const mirror = (k: LiveKey) => (value: string) =>
    setLive((l) => { const n: LiveDoc = { ...l }; n[k] = value; return n; });
  const mirrorAddon = (id: number) => (value: string) =>
    setLive((l) => ({ ...l, addons: { ...(l.addons || {}), [id]: value } }));

  const v = (id: string) =>
    (document.getElementById(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null)?.value ?? "";

  /* Everything on the page, in one patch. Read fresh on every write — an
     add-a-charge must not throw away what is already typed beside it. */
  const patch = (): QuotationSaveInput => ({
    rowVersion: q.rowVersion,
    quotationDate: v("qDate") || undefined,
    validUntil: v("qValid") || undefined,
    placeOfSupply: v("qPos") || undefined,
    gstRate: v("qGst") ? Number(v("qGst")) : undefined,
    taxMode,
    notes: v("qNotes"),
    terms: v("qTerms"),
    planName: v("pName"),
    planHsn: v("pHsn"),
    termMonths: v("pTerm") ? Number(v("pTerm")) : undefined,
    totalAmountPaise: v("pTotal") ? rupeesToPaise(v("pTotal")) : undefined,
    installments: v("pInstallments") ? Number(v("pInstallments")) : undefined,
    /* Absent while the total is paid in full — there is no gap field on screen
       to read, and an absent key leaves the stored one untouched. */
    installmentGapMonths: v("pGap") ? Number(v("pGap")) : undefined,
    discountType: (v("pDiscT") as "pct" | "amt") || undefined,
    discountValue: v("pDisc") ? Number(v("pDisc")) : undefined,
    addons: addons.map((a) => ({
      itemId: a.id, name: v("a-nm-" + a.id), hsn: v("a-hs-" + a.id),
      amountPaise: rupeesToPaise(v("a-am-" + a.id)),
      discountType: (v("a-dt-" + a.id) as "pct" | "amt") || undefined,
      discountValue: Number(v("a-dv-" + a.id) || 0),
    })),
  });

  /* Save is the end of the builder, so it lands on the quotation rather than
     leaving you on the form you just finished. The mid-edit writes below
     (pick a plan, add a charge) stay put — those are steps, not the finish. */
  const save = () => {
    setErr(null); setBusy(true);
    call(AdminOpsService.saveQuotation(q.id, patch()))
      .then(() => { toast("Saved."); go("#/quotations/" + q.id); })
      .catch((e: unknown) => { setErr(errMessage(e)); setBusy(false); });
  };

  /* Adding or removing a charge saves the rest of the page first, then acts on
     the row version that write returned. Same order the prototype uses
     (saveAllQuiet, then the addon call) — otherwise the second request 409s on
     a stale rowVersion, or the typing in the other blocks is lost. */
  const withQuietSave = (label: string, then: (rowVersion: number) => Promise<unknown>) => {
    setErr(null); setBusy(true);
    call(AdminOpsService.saveQuotation(q.id, patch()))
      .then((row: QuotationRow) => then(row.rowVersion))
      .then(() => { toast(label); onSaved(); })
      .catch((e: unknown) => setErr(errMessage(e)))
      .finally(() => setBusy(false));
  };
  const addAddon = () => withQuietSave("Charge added.", (rowVersion) =>
    call(AdminOpsService.addQuotationAddon(q.id, { rowVersion })));
  /* Choosing a plan fills the name, the term and the list price beside it and
     commits — the prototype's "Change plan" writes too, and a picker that
     quietly needs a second button pressed is a picker people think did
     nothing. All three stay editable afterwards: the list price is where a
     negotiation starts, not what it has to end at. */
  const pickPlan = (p: PlanPick) => {
    const set = (id: string, value: string) => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el) el.value = value;
    };
    set("pName", p.name);
    set("pTerm", String(p.months));
    set("pTotal", String(p.rupees));
    setLive((l) => ({ ...l, planName: p.name, termMonths: String(p.months) }));
    closeLayer();
    withQuietSave(p.name + " applied.", () => Promise.resolve());
  };
  const openPlanPicker = () => modal(
    <PlanModal plans={plans} loading={plansLoading} current={plan ? plan.name : ""}
      currentMonths={plan ? plan.termMonths || 0 : 0} onClose={closeLayer} onPick={pickPlan} />, "lg");
  const removeAddon = (itemId: number) => withQuietSave("Charge removed.", (rowVersion) =>
    call(AdminOpsService.removeQuotationAddon(q.id, itemId, rowVersion)));

  const dealTo = "#/deals/" + q.dealRef;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <PageHeader
        eyebrow="Step 2 of 2"
        title={q.parentQuotationId ? "Revision" : "New quotation"}
        back={{ label: "Back to the quotation", to: detail }}
        meta={<>
          <Pill dot text="Draft" />
          <Tag label={"v" + q.version} />
          <a href={dealTo} data-go={dealTo} className="font-mono text-brand-secondary tnum"
            onClick={(e) => { e.preventDefault(); go(dealTo); }}>{q.dealRef}</a>
          <span className="font-mono tnum">Number assigned on issue</span>
        </>}
        actions={<Button color="primary" ico="check" isLoading={busy} data-act="qt-save-all"
          onClick={save}>Save draft</Button>}
        fold={[{ icon: "quote", label: "Preview & issue",
          act: () => go("#/quotations/" + q.id + "?mode=preview") }]} />

      {err ? <Alert tone="bad" title="Could not save this quotation.">{err}</Alert> : null}

      <BuilderLayout
        form={<>
          <section className="flex min-w-0 flex-col gap-3">
            <StepHead n={1} title="Who and when" hint="snapshotted from the deal, frozen again at issue" />
            <Card>
              <FormSection>
                <PartyStrip blocks={[
                  { title: "From",
                    lines: [SELLER.brand, SELLER.tagline, SELLER.addr,
                      <span key="gst" className="font-mono tnum">{SELLER.gstin ? "GSTIN " + SELLER.gstin : "CIN " + SELLER.cin}</span>] },
                  { title: "Bill to",
                    lines: [q.party.business ? q.party.name + " · " + q.party.business : q.party.name || "—",
                      q.party.address || [q.party.city, q.party.state].filter(Boolean).join(", ") || "—",
                      <span key="ph" className="font-mono tnum">{q.party.phone || "—"}</span>],
                    foot: <Button color="link-color" size="xs" ico="ext" data-go={dealTo}
                      onClick={() => go(dealTo)}>Edit on the deal</Button> },
                ]} />
                <FieldRow cols={3}>
                  <FormField id="qDate" label="Quotation date">
                    <DateInput id="qDate" defaultValue={q.quotationDate} onChange={mirror("date")} className="w-full" />
                  </FormField>
                  <FormField id="qValid" label="Valid until"
                    hint={"Defaults to +" + DEFAULT_VALIDITY_DAYS + " days (QT-OD-02)."}>
                    <DateInput id="qValid" defaultValue={q.validUntil} onChange={mirror("until")} className="w-full" />
                  </FormField>
                  <FormField id="qPos" label="Place of supply" hint="Drives the CGST/SGST ↔ IGST split.">
                    <SelectInput id="qPos" defaultValue={q.placeOfSupply}
                      options={STATES.map((s) => ({ v: s, l: s }))} onChange={mirror("placeOfSupply")} />
                  </FormField>
                </FieldRow>
              </FormSection>
            </Card>
          </section>

          <section className="flex min-w-0 flex-col gap-3">
            <StepHead n={2} title="What they are buying" hint="one plan, and anything one-off beside it" />
            <Card flush>
              <PlanBlock plan={plan} plans={plans} busy={busy} onChange={openPlanPicker}
                count={count} onCount={setCount} onHsn={mirror("planHsn")} onTerm={mirror("termMonths")} />
              <AddonBlock q={q} addons={addons} busy={busy} onAdd={addAddon} onRemove={removeAddon}
                onName={mirrorAddon} />
            </Card>
          </section>

          <section className="flex min-w-0 flex-col gap-3">
            <StepHead n={3} title="What it comes to" hint="display only — the server recomputes every figure on save" />
            <Card>
              <Totals q={q} plan={plan} addons={addons} taxMode={taxMode} onTaxMode={setTaxMode} />
            </Card>
          </section>

          <section className="flex min-w-0 flex-col gap-3">
            <StepHead n={4} title="What it says" hint="printed on the document, under the figures" />
            <Card>
              <FormSection>
                <FormField id="qNotes" label="Notes (customer-facing)">
                  <Textarea id="qNotes" rows={3} defaultValue={q.notes} onChange={mirror("notes")}
                    ph="Anything the customer should read alongside the price." />
                </FormField>
                <FormField id="qTerms" label="Commercial terms">
                  <Textarea id="qTerms" rows={6} defaultValue={q.terms} onChange={mirror("terms")} />
                </FormField>
              </FormSection>
            </Card>
          </section>
        </>}
        rail={<>
          <Eyebrow>The document</Eyebrow>
          <QuotationSheet q={q} compact live={live} />
          <p className="text-xs text-tertiary">
            What you type appears here as you type it. Every figure is the one the server last
            computed — save to recalculate.
          </p>
        </>} />
    </div>
  );
}

/* The plan, as the top half of "what they are buying". A card BODY, not a card
   — its other half is the one-off charges, and the two share one surface
   because they are one answer. */
function PlanBlock({ plan, plans, busy, onChange, count, onCount, onHsn, onTerm }: {
  plan: ReturnType<typeof planItemOf>; plans: PlanRow[]; busy: boolean;
  onChange: () => void; count: number; onCount: (n: number) => void;
  onHsn: (v: string) => void; onTerm: (v: string) => void;
}) {
  if (!plan) return <div className="p-5 text-sm text-quaternary">No plan block.</div>;
  const n = lineNet(plan);
  /* The catalogue row this line was picked from, matched back by the stored
     name. Absent for a hand-typed name or a tier since retired — the line
     still renders, just without the feature list. */
  const cat = plans.find((c) => planLabel(c) === plan.name);
  const feats = cat ? (cat.features || []).map((f) => (typeof f === "string" ? f : f.text)).filter(Boolean) : [];

  return (
    <div className="flex min-w-0 flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-semibold text-primary">
            {plan.name || <span className="font-normal text-quaternary">No plan chosen yet</span>}
          </div>
          <div className="mt-0.5 text-sm text-tertiary">
            {cat && cat.subtitle ? cat.subtitle : plan.description || "SaaS subscription — billed for the full term"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <div className="font-mono text-lg font-semibold text-primary tnum">{inr(n.net)}</div>
            {n.disc ? (
              <div className="font-mono text-xs text-tertiary tnum">
                <s>{inr(n.base)}</s> −{inr(n.disc)}
              </div>
            ) : null}
          </div>
          <Button color="secondary" data-act="qt-plan" isDisabled={busy} onClick={onChange}>
            {plan.name ? "Change plan" : "Choose a plan"}
          </Button>
        </div>
      </div>

      {/* The features are what the tier IS, so they stay — but folded, because
          ten chips between the plan name and the price being negotiated put the
          two things being compared on different screens. */}
      <FeatureFold feats={feats} note="Snapshotted from the plan catalogue when it was picked. A later edit to the plan sheet cannot rewrite a proposal already sent." />

      {/* The name is set by the picker, not typed — but it still has to go out
          with the save, and `patch()` reads every field the same way. */}
      <input type="hidden" id="pName" defaultValue={plan.name} />

      <FormSection>
        <FieldRow cols={3}>
          <FormField id="pHsn" label="HSN / SAC">
            <Input id="pHsn" mono defaultValue={plan.hsn} onChange={onHsn} />
          </FormField>
          <FormField id="pTerm" label="Term (months)" hint="Replaces quantity.">
            <Input id="pTerm" type="number" defaultValue={String(plan.termMonths || "")} onChange={onTerm} />
          </FormField>
          <FormField id="pTotal" label="Total amount ₹" hint="One negotiated total for the full term.">
            <Input id="pTotal" type="number" mono defaultValue={String(Math.round(n.base / 100))} />
          </FormField>
        </FieldRow>

        <FieldRow cols={3}>
          <FormField id="pDisc" label="Discount"
            hint="Above 30%, Module 1 turns off Target 2 eligibility on this deal.">
            <div className="flex items-center gap-2">
              <Input id="pDisc" type="number" defaultValue={String(plan.discountValue || 0)}
                className="min-w-0 flex-1" />
              <SelectInput id="pDiscT" ariaLabel="Discount unit" className="w-20 shrink-0"
                defaultValue={plan.discountType === "amt" ? "amt" : "pct"}
                options={[{ v: "pct", l: "%" }, { v: "amt", l: "₹" }]} />
            </div>
          </FormField>
          <FormField id="pInstallments" label="Payments" hint="How many payments the total splits into.">
            <SelectInput id="pInstallments" defaultValue={String(count)}
              onChange={(x) => onCount(Number(x))}
              options={COUNTS.map((k) => ({ v: String(k), l: k === 1 ? "1 (full amount)" : k + " payments" }))} />
          </FormField>
          {count > 1
            ? <FormField id="pGap" label="Gap between payments"
                hint="A yearly package can be paid quarterly; a short one, monthly.">
                <SelectInput id="pGap" defaultValue={String(plan.installmentGapMonths || 1)}
                  options={COUNTS.map((k) => ({ v: String(k), l: k === 1 ? "Every month" : "Every " + k + " months" }))} />
              </FormField>
            : <FormField label="Gap between payments" hint="Paid in full, so there is no gap to set.">
                <div className="flex h-9 items-center text-sm text-quaternary">—</div>
              </FormField>}
        </FieldRow>
      </FormSection>
      {/* ponytail: no schedule strip. The prototype draws the due dates under
          these two controls; the API returns no schedule, and inventing the
          dates on the client is a set of figures with no source. Draw it when
          the quotation response carries one. */}
    </div>
  );
}

/* The other half of the same card. One entry point, in the place the thing it
   adds will appear — there used to be three, and none of them was here. */
function AddonBlock({ q, addons, busy, onAdd, onRemove, onName }: {
  q: QuotationRow; addons: ReturnType<typeof addonsOf>; busy: boolean;
  onAdd: () => void; onRemove: (itemId: number) => void; onName: (id: number) => (v: string) => void;
}) {
  const add = (
    <Button color="secondary" size="xs" ico="plus" data-act="qt-addon-add" data-ref={q.id}
      isDisabled={busy} onClick={onAdd}>Add a charge</Button>
  );
  return (
    <div className="flex min-w-0 flex-col gap-3 border-t border-secondary p-5">
      <SectionHead className="mb-0" title="One-off charges"
        desc={addons.length
          ? addons.length + " on this quotation"
          : "Onboarding, a shoot, a custom build — no months, no quantity."}
        right={add} />
      {addons.length ? (
        <Table
          min="42rem"
          cols={[{ label: "#", w: "2.5rem" }, { label: "Description" }, { label: "HSN / SAC", w: "8rem" },
            { label: "Discount", w: "10rem" }, { label: "Amount ₹", cls: "n", w: "9rem" }, { label: "", cls: "c", w: "3rem" }]}
          rows={addons.map((it, ix) => {
            const n = lineNet(it);
            return (
              <tr key={it.id}>
                <td className="faint tnum">{ix + 1}</td>
                <td><Input id={"a-nm-" + it.id} ariaLabel="Charge description" defaultValue={it.name}
                  onChange={onName(it.id)} /></td>
                <td><Input id={"a-hs-" + it.id} mono ariaLabel="HSN or SAC code" defaultValue={it.hsn || ""} /></td>
                <td>
                  <div className="flex items-center gap-1.5">
                    <Input id={"a-dv-" + it.id} type="number" ariaLabel="Discount value"
                      defaultValue={String(it.discountValue || 0)} className="min-w-0 flex-1" />
                    <SelectInput id={"a-dt-" + it.id} ariaLabel="Discount unit" className="w-16 shrink-0"
                      defaultValue={it.discountType === "amt" ? "amt" : "pct"}
                      options={[{ v: "pct", l: "%" }, { v: "amt", l: "₹" }]} />
                  </div>
                </td>
                <td className="n">
                  <Input id={"a-am-" + it.id} type="number" mono ariaLabel="Charge amount"
                    defaultValue={String(Math.round(n.base / 100))} inputClassName="text-right" />
                  {n.disc ? <div className="cell-2">net {inr(n.net)}</div> : null}
                </td>
                <td className="c">
                  <Button color="tertiary-destructive" size="xs" ico="trash" data-act="qt-addon-del"
                    aria-label="Remove charge" isDisabled={busy} onClick={() => onRemove(it.id)} />
                </td>
              </tr>
            );
          })} />
      ) : null}
    </div>
  );
}

/* ============================================================ the totals === */
/* Display only — every figure below is what the SERVER last computed, and it
   recomputes them again on save. Nothing here is arithmetic this page invented
   (see helpers.lineNet). Tax lives here because this is the block where the
   choice changes a number you can see. */
function Totals({ q, plan, addons, taxMode, onTaxMode }: {
  q: QuotationRow; plan: ReturnType<typeof planItemOf>; addons: ReturnType<typeof addonsOf>;
  taxMode: string; onTaxMode: (m: "applicable" | "not_applicable") => void;
}) {
  const applicable = taxMode !== "not_applicable";
  const intra = q.placeOfSupply === SELLER.state;
  const addonGross = addons.reduce((a, i) => a + lineNet(i).base, 0);
  const blockers = blockersOf(q);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-col">
        <MoneyLine k={"Plan · " + (plan && plan.termMonths ? plan.termMonths + " months" : "—")}
          v={inr(plan ? lineNet(plan).base : 0)} />
        {addons.length ? <MoneyLine k="Add-ons" v={inr(addonGross)} /> : null}
        <MoneyLine k="Gross amount" v={inr(q.subtotalPaise)} rule />
        {q.discountAmountPaise
          ? <MoneyLine k="Discount" v={"−" + inr(q.discountAmountPaise)} tone="warn" />
          : null}
        <MoneyLine k={applicable ? "Taxable value" : "Subtotal"} v={inr(q.taxablePaise)} rule />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-secondary p-3 ring-1 ring-secondary ring-inset">
        <div className="min-w-0">
          <div className="text-sm font-medium text-secondary">Tax</div>
          <p className="mt-0.5 text-xs text-tertiary">
            {applicable
              ? intra
                ? "Intra-state — place of supply is " + q.placeOfSupply + ", the same state as Interior bazzar, so GST splits into CGST + SGST."
                : "Inter-state — place of supply is " + (q.placeOfSupply || "not set") + " and Interior bazzar is in " + SELLER.state + ", so a single IGST applies."
              : "The grand total excludes GST entirely — the Sales Team's explicit choice on this quotation, for a client paying with no tax."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {applicable
            ? <SelectInput id="qGst" ariaLabel="GST rate" className="w-24" defaultValue={String(q.gstRate)}
                options={GST_RATES.map((r) => ({ v: String(r), l: r + "%" }))} />
            : null}
          <Segmented label="Tax" value={applicable ? "applicable" : "not_applicable"}
            onPick={(m) => onTaxMode(m as "applicable" | "not_applicable")}
            options={[{ v: "applicable", l: "Applicable" }, { v: "not_applicable", l: "Not applicable" }]} />
        </div>
      </div>

      {applicable ? (
        <div className="flex min-w-0 flex-col">
          {intra
            ? <>
                <MoneyLine k={"CGST (" + q.gstRate / 2 + "%)"} v={inr(q.cgstPaise)} />
                <MoneyLine k={"SGST (" + q.gstRate / 2 + "%)"} v={inr(q.sgstPaise)} />
              </>
            : <MoneyLine k={"IGST (" + q.gstRate + "%)"} v={inr(q.igstPaise)} />}
        </div>
      ) : null}

      <div className="flex min-w-0 flex-col">
        <MoneyLine k="Grand total" v={inr(q.grandTotalPaise)} strong />
        <div className="mt-1 text-sm text-tertiary italic">{inrWords(q.grandTotalPaise)}</div>
      </div>

      <div className="border-t border-secondary pt-4">
        <ReadyLine blockers={blockers} verb="issue" />
      </div>
    </div>
  );
}
