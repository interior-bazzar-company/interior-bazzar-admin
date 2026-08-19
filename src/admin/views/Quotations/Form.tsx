/* =====================================================================
   QUOTATION — the builder body, laid out as the prototype's builder()
   (views-quotation.js).

   The rules that layout encodes, and why they are worth keeping:

     · ONE Save, in the rail, that writes the dates, the plan and the charges
       together. There used to be one button per block in this panel, and
       nothing said which of them still had unwritten work in it.
     · TAX HAS ONE CONTROL, in the summary, beside the number it changes.
     · ONE place to add a one-off charge — inside the section that already
       holds what the customer is buying.
     · THREE numbered steps in the order the document reads: who and when,
       what they are buying, what it says. Bill-to is reference, so it is a
       strip inside step 1 rather than a section competing with it.

   Inputs are uncontrolled and read from the DOM at save time, exactly as the
   prototype's `val(id)` does: the server recomputes every figure anyway, so
   re-rendering the page on each keystroke would buy nothing.
   ===================================================================== */
import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import AdminOpsService from "../../../api/modules/adminOps";
import type { QuotationSaveInput } from "../../../api/modules/adminOps";
import { Field, Icon, Notice, Table } from "../../ui";
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
  GST_RATES, SELLER, STATES, addonsOf, blockersOf, lineNet, planItemOf, planLabel,
} from "./helpers";

const DEFAULT_VALIDITY_DAYS = 15;
const COUNTS = [1, 2, 3, 4, 5];

/* ============================================================== the body === */
export function BuilderBody({ q, onSaved }: { q: QuotationRow; onSaved: () => void }) {
  const plan = planItemOf(q);
  const addons = addonsOf(q);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /* The two controls whose CHOICE changes what else is on screen — the rest
     are read from the DOM at save time. */
  const [taxMode, setTaxMode] = useState(q.taxMode);
  const [count, setCount] = useState(plan ? plan.installments || 1 : 1);
  const { plans, loading: plansLoading } = usePlanCatalogue();
  const { modal, closeLayer, toast } = useShell();
  const { go } = useNav();

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
    closeLayer();
    withQuietSave(p.name + " applied.", () => Promise.resolve());
  };
  const openPlanPicker = () => modal(
    <PlanModal plans={plans} loading={plansLoading} current={plan ? plan.name : ""}
      currentMonths={plan ? plan.termMonths || 0 : 0} onClose={closeLayer} onPick={pickPlan} />, "wide");
  const removeAddon = (itemId: number) => withQuietSave("Charge removed.", (rowVersion) =>
    call(AdminOpsService.removeQuotationAddon(q.id, itemId, rowVersion)));

  return (
    <div className="qbld">
      <div>
        {err ? <Notice tone="bad" text={<b>{err}</b>} /> : null}

        <Step n={1} title="Who and when" hint="snapshotted from the deal, frozen again at issue" />
        <div className="card"><div className="card-b">
          <Parties q={q} />
          <div className="f3" style={{ marginTop: "var(--space-4)" }}>
            <Field id="qDate" label="Quotation date" type="date" value={q.quotationDate} />
            <Field id="qValid" label="Valid until" type="date" value={q.validUntil}
              help={"Defaults to +" + DEFAULT_VALIDITY_DAYS + " days (QT-OD-02)."} />
            <Field id="qPos" label="Place of supply" type="select"
              options={STATES.map((s) => ({ v: s, l: s, sel: s === q.placeOfSupply }))}
              help="Drives the CGST/SGST ↔ IGST split." />
          </div>
          <div className="help">
            Nothing here is retyped. It is snapshotted from the deal at creation and <b>frozen again at
            issue</b> — a later change to the deal never rewrites a document the customer already holds.
          </div>
        </div></div>

        <Step n={2} title="What they are buying" hint="one plan, and anything one-off beside it" />
        <div className="card">
          <PlanBlock plan={plan} plans={plans} busy={busy} onChange={openPlanPicker}
            count={count} onCount={setCount} />
          <AddonBlock q={q} addons={addons} busy={busy} onAdd={addAddon} onRemove={removeAddon} />
        </div>

        <Step n={3} title="What it says" hint="printed on the document, under the figures" />
        <div className="card"><div className="card-b">
          <Field id="qNotes" label="Notes (customer-facing)" type="textarea" rows={3} value={q.notes}
            ph="Anything the customer should read alongside the price." />
          <Field id="qTerms" label="Commercial terms" type="textarea" rows={6} value={q.terms} />
        </div></div>
      </div>

      <div className="qbld-rail">
        <Summary q={q} plan={plan} addons={addons} taxMode={taxMode} onTaxMode={setTaxMode}
          busy={busy} onSave={save} />
      </div>
    </div>
  );
}

/* A numbered step rather than a section heading: five equal headings read as a
   list of five things, three numbers read as a sequence you are part way
   through — which is what a two-step builder should feel like. */
function Step({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="qstep">
      <span className="qstep-n">{n}</span>
      <div><b>{title}</b>{hint ? <span className="qstep-h">{hint}</span> : null}</div>
    </div>
  );
}

/* Reference, not input: it reads as a strip, not as a form somebody is meant
   to fill in and then wonders why they cannot. */
function Parties({ q }: { q: QuotationRow }) {
  const { go } = useNav();
  const p = q.party;
  return (
    <div className="qparties">
      <div>
        <span className="qparties-k">From</span>
        <b>{SELLER.brand}</b><br />
        <span className="faint">{SELLER.tagline}</span><br />
        {SELLER.addr}<br />
        <span className="mono">{SELLER.gstin ? "GSTIN " + SELLER.gstin : "CIN " + SELLER.cin}</span>
      </div>
      <div>
        <span className="qparties-k">Bill to</span>
        <b>{p.name || "—"}</b>{p.business ? " · " + p.business : ""}<br />
        {p.address || [p.city, p.state].filter(Boolean).join(", ") || "—"}<br />
        <span className="mono">{p.phone || "—"}</span>{" "}
        <a className="lnk" data-go={"#/deals/" + q.dealRef} onClick={() => go("#/deals/" + q.dealRef)}>
          Edit on deal ↗</a>
      </div>
    </div>
  );
}

/* The plan, as the top half of "what they are buying". A card BODY, not a card
   — its other half is the one-off charges, and the two share one surface
   because they are one answer. */
function PlanBlock({ plan, plans, busy, onChange, count, onCount }: {
  plan: ReturnType<typeof planItemOf>; plans: PlanRow[]; busy: boolean;
  onChange: () => void; count: number; onCount: (n: number) => void;
}) {
  if (!plan) return <div className="card-b faint">No plan block.</div>;
  const n = lineNet(plan);
  /* The catalogue row this line was picked from, matched back by the stored
     name. Absent for a hand-typed name or a tier since retired — the line
     still renders, just without the feature list. */
  const cat = plans.find((c) => planLabel(c) === plan.name);
  const feats = cat ? (cat.features || []).map((f) => (typeof f === "string" ? f : f.text)).filter(Boolean) : [];

  return (
    <div className="card-b">
      <div className="qplan-h">
        <div>
          <div className="qplan-nm">{plan.name || <span className="faint">No plan chosen yet</span>}</div>
          <div className="faint" style={{ fontSize: "var(--text-md)" }}>
            {cat && cat.subtitle ? cat.subtitle : plan.description || "SaaS subscription — billed for the full term"}
          </div>
        </div>
        <div className="qplan-amt">
          <b className="tnum">{inr(n.net)}</b>
          {n.disc
            ? <span className="faint tnum"><s>{inr(n.base)}</s> −{inr(n.disc)}</span>
            : null}
        </div>
        <button className="btn sm" data-act="qt-plan" disabled={busy} onClick={onChange}>
          {plan.name ? "Change plan" : "Choose a plan"}</button>
      </div>

      {/* The features are what the tier IS, so they stay — but folded, because
          ten pills between the plan name and the price you are negotiating put
          the two things you are comparing on different screens. */}
      {feats.length
        ? <details className="qfeat">
            <summary>{feats.length} features included</summary>
            <div>
              {feats.map((f, i) => <span key={i} className="pill xs" title={f}>{f}</span>)}
              <div className="help">Snapshotted from the plan catalogue when it was picked. A later edit
                to the plan sheet cannot rewrite a proposal already sent.</div>
            </div>
          </details>
        : null}

      {/* The name is set by the picker, not typed — but it still has to go out
          with the save, and `patch()` reads every field the same way. */}
      <input type="hidden" id="pName" defaultValue={plan.name} />

      <div className="f2" style={{ marginTop: "var(--space-3)" }}>
        <Field id="pHsn" label="HSN / SAC" value={plan.hsn} />
      </div>

      <div className="f3">
        <Field id="pTerm" label="Term (months)" type="number" value={plan.termMonths || ""}
          help="Replaces quantity." />
        <Field id="pTotal" label="Total amount ₹" type="number" value={Math.round(n.base / 100)}
          help="One negotiated total for the full term." />
        <Field label="Discount"
          help="Above 30%, Module 1 turns off Target 2 eligibility on this deal."
          custom={<div className="qdisc">
            <input className="inp" id="pDisc" type="number" defaultValue={plan.discountValue || 0} />
            <select className="inp" id="pDiscT" defaultValue={plan.discountType === "amt" ? "amt" : "pct"}>
              <option value="pct">%</option>
              <option value="amt">₹</option>
            </select>
          </div>} />
      </div>

      <div className="f2" style={{ marginTop: "var(--space-2)", marginBottom: 0 }}>
        <div className="fg">
          <label htmlFor="pInstallments">Payments</label>
          <select className="inp" id="pInstallments" defaultValue={String(count)}
            onChange={(e) => onCount(Number(e.target.value))}>
            {COUNTS.map((k) => <option key={k} value={k}>{k === 1 ? "1 (full amount)" : k + " payments"}</option>)}
          </select>
          <div className="help">How many payments the total splits into.</div>
        </div>
        {count > 1
          ? <Field id="pGap" label="Gap between payments" type="select"
              options={COUNTS.map((k) => ({ v: String(k), l: k === 1 ? "Every month" : "Every " + k + " months",
                sel: k === (plan.installmentGapMonths || 1) }))}
              help="A yearly package can be paid quarterly; a short one, monthly." />
          : <div className="fg">
              <span className="fg-lb">Gap between payments</span>
              <div className="help">Paid in full, so there is no gap to set.</div>
            </div>}
      </div>
      {/* ponytail: no schedule strip. The prototype draws the due dates under
          these two controls; the API returns no schedule, and inventing the
          dates on the client is a set of figures with no source. Draw it when
          the quotation response carries one. */}
    </div>
  );
}

/* The other half of the same card. One entry point, in the place the thing it
   adds will appear — there used to be three, and none of them was here. */
function AddonBlock({ q, addons, busy, onAdd, onRemove }: {
  q: QuotationRow; addons: ReturnType<typeof addonsOf>; busy: boolean;
  onAdd: () => void; onRemove: (itemId: number) => void;
}) {
  const head = (
    <div className="qaddon-h">
      <span><b>One-off charges</b>
        <span className="faint"> · {addons.length
          ? addons.length + " on this quotation"
          : "onboarding, a shoot, a custom build — no months, no quantity"}</span></span>
      <button className="btn sm" data-act="qt-addon-add" data-ref={q.id} disabled={busy} onClick={onAdd}>
        <Icon name="plus" size="sm" />Add a charge</button>
    </div>
  );
  if (!addons.length) return <div className="card-b qaddon">{head}</div>;

  return (
    <div className="card-b qaddon">
      {head}
      <Table
        cols={[{ label: "#", w: "32px" }, { label: "Description" }, { label: "HSN / SAC", w: "104px" },
          { label: "Discount", w: "142px" }, { label: "Amount ₹", cls: "n", w: "128px" }, { label: "", w: "40px" }]}
        rows={addons.map((it, ix) => {
          const n = lineNet(it);
          return (
            <tr key={it.id}>
              <td className="faint">{ix + 1}</td>
              <td><input className="inp sm" id={"a-nm-" + it.id} defaultValue={it.name} /></td>
              <td><input className="inp sm" id={"a-hs-" + it.id} defaultValue={it.hsn || ""} /></td>
              <td><div style={{ display: "flex", gap: "4px" }}>
                <input className="inp sm" id={"a-dv-" + it.id} type="number" style={{ width: "58px" }}
                  defaultValue={it.discountValue || 0} />
                <select className="inp sm" id={"a-dt-" + it.id} style={{ width: "54px" }}
                  defaultValue={it.discountType === "amt" ? "amt" : "pct"}>
                  <option value="pct">%</option><option value="amt">₹</option>
                </select>
              </div></td>
              <td className="n">
                <input className="inp sm n" id={"a-am-" + it.id} type="number"
                  defaultValue={Math.round(n.base / 100)} />
                {n.disc ? <div className="cell-2">net {inr(n.net)}</div> : null}
              </td>
              <td className="c">
                <button className="btn sm icon dgr" data-act="qt-addon-del" aria-label="Remove charge"
                  disabled={busy} onClick={() => onRemove(it.id)}><Icon name="x" size="sm" /></button>
              </td>
            </tr>
          );
        })}
      />
    </div>
  );
}

/* ============================================================= the rail === */
/* Display only — every figure below is what the SERVER last computed, and it
   recomputes them again on save. Nothing here is arithmetic this page invented
   (see helpers.lineNet). The one commit for the whole page lives here too,
   because this is the card that already shows what every field on it adds up
   to. */
function Summary({ q, plan, addons, taxMode, onTaxMode, busy, onSave }: {
  q: QuotationRow; plan: ReturnType<typeof planItemOf>; addons: ReturnType<typeof addonsOf>;
  taxMode: string; onTaxMode: (m: "applicable" | "not_applicable") => void;
  busy: boolean; onSave: () => void;
}) {
  const applicable = taxMode !== "not_applicable";
  const intra = q.placeOfSupply === SELLER.state;
  const addonGross = addons.reduce((a, i) => a + lineNet(i).base, 0);
  const blockers = blockersOf(q);

  return (
    <div className="card">
      <div className="card-h"><h3>Summary</h3>
        <span className="d">display only — the server recomputes</span></div>
      <div className="card-b">
        <Row k={"Plan · " + (plan && plan.termMonths ? plan.termMonths + " months" : "—")}
          v={inr(plan ? lineNet(plan).base : 0)} />
        {addons.length ? <Row k="Add-ons" v={inr(addonGross)} /> : null}
        <Row k={<b>Gross amount</b>} v={<b>{inr(q.subtotalPaise)}</b>}
          style={{ borderTop: "1px solid var(--line)", marginTop: "4px" }} />
        {q.discountAmountPaise
          ? <Row k={<span style={{ color: "var(--warn)" }}>Discount</span>}
              v={<span style={{ color: "var(--warn)" }}>−{inr(q.discountAmountPaise)}</span>} />
          : null}
        <Row k="Taxable value" v={inr(q.taxablePaise)} style={{ borderTop: "1px solid var(--line)" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0" }}>
          <span>Tax</span>
          <div className="btn-group">
            <button className={applicable ? "on" : ""} data-act="qt-tax-mode" data-v="applicable"
              onClick={() => onTaxMode("applicable")}>Applicable</button>
            <button className={!applicable ? "on" : ""} data-act="qt-tax-mode" data-v="not_applicable"
              onClick={() => onTaxMode("not_applicable")}>Not applicable</button>
          </div>
        </div>

        {applicable
          ? <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0" }}>
                <span>GST rate</span>
                <select className="inp sm" id="qGst" style={{ width: "96px" }} defaultValue={String(q.gstRate)}>
                  {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                </select>
              </div>
              {intra
                ? <>
                    <Row k={"CGST (" + q.gstRate / 2 + "%)"} v={inr(q.cgstPaise)} />
                    <Row k={"SGST (" + q.gstRate / 2 + "%)"} v={inr(q.sgstPaise)} />
                  </>
                : <Row k={"IGST (" + q.gstRate + "%)"} v={inr(q.igstPaise)} />}
            </>
          : <div className="help" style={{ marginTop: "10px" }}>
              <b>Tax not applicable.</b> The grand total excludes GST entirely — the Sales Team's
              explicit choice for this quotation, for a client paying with no tax.
            </div>}

        <Row k={<b style={{ fontSize: "var(--text-lg)" }}>Grand total</b>}
          v={<b style={{ fontSize: "var(--text-lg)" }}>{inr(q.grandTotalPaise)}</b>}
          style={{ borderTop: "2px solid var(--line-2)", marginTop: "6px", paddingTop: "9px" }} />
        <div className="faint" style={{ fontSize: "var(--text-sm)", marginTop: "4px" }}>
          {inrWords(q.grandTotalPaise)}
        </div>

        {applicable
          ? <div className="help" style={{ marginTop: "10px" }}>
              {intra
                ? <><b>Intra-state.</b> Place of supply is {q.placeOfSupply}, the same state as
                    Interior bazzar — so GST splits into CGST + SGST.</>
                : <><b>Inter-state.</b> Place of supply is {q.placeOfSupply || "not set"} and Interior
                    bazzar is in {SELLER.state} — so a single IGST applies.</>}
            </div>
          : null}
      </div>

      <div className="card-f qsave">
        <button className="btn pri" data-act="qt-save-all" disabled={busy} onClick={onSave}>
          <Icon name="check" />{busy ? "Saving…" : "Save changes"}</button>
        <span className="qsave-h">Writes the dates, the plan and the charges together.</span>
      </div>

      <div className="card-f">
        {blockers.length
          ? <Notice tone="bad" ico="alert" text={<>
              <b>Cannot be issued yet</b>
              <ul style={{ margin: "5px 0 0 16px" }}>
                {blockers.map((b) => <li key={b.code + b.text}>{b.text}{" "}
                  <span className="mono">422 {b.code}</span></li>)}
              </ul>
            </>} />
          : <span style={{ color: "var(--ok)" }}><Icon name="check" size="sm" /> Ready to issue</span>}
      </div>
    </div>
  );
}

function Row({ k, v, style }: { k: ReactNode; v: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", ...style }}>
      <span>{k}</span><span className="tnum">{v}</span>
    </div>
  );
}
