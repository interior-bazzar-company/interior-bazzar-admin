/* =====================================================================
   QUOTATION — the shared form pieces.
   Was Drawer.tsx: this module used to open a right-hand panel, which the
   prototype never had (views-quotation.js is four PAGES). The drawer is
   gone; what stayed is the editor form, its addon rows and the
   event log — all of which the detail and builder pages reuse.
   ===================================================================== */
import { useState } from "react";
import AdminOpsService from "../../../api/modules/adminOps";
import type { QuotationAddonInput, QuotationSaveInput } from "../../../api/modules/adminOps";
import { Field, Icon, Notice, SectionHead } from "../../ui";
import { inr } from "../../ui/format";
import { useShell } from "../../shell/ShellContext";
import { errMessage } from "../../../api/apiService";
import { call, paiseToRupees, rupeesToPaise } from "./api";
import type { QuotationRow } from "./api";
import { addonsOf, planItemOf } from "./helpers";

const GST_RATES = [0, 5, 12, 18, 28];

/* ---------------------------------------------------------------- form --- */
export function EditForm({ q, onSaved }: { q: QuotationRow; onSaved: () => void }) {
  const plan = planItemOf(q);
  const addons = addonsOf(q);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useShell();

  const v = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null)?.value ?? "";

  const save = () => {
    setErr(null); setBusy(true);
    const body: QuotationSaveInput = {
      rowVersion: q.rowVersion,
      quotationDate: v("qtDate") || undefined,
      validUntil: v("qtValid") || undefined,
      placeOfSupply: v("qtPos") || undefined,
      gstRate: v("qtGst") ? Number(v("qtGst")) : undefined,
      taxMode: (v("qtTax") as "applicable" | "not_applicable") || undefined,
      notes: v("qtNotes"),
      terms: v("qtTerms"),
      planName: v("qtPlanName"),
      planHsn: v("qtPlanHsn"),
      termMonths: v("qtTerm") ? Number(v("qtTerm")) : undefined,
      totalAmountPaise: v("qtTotal") ? rupeesToPaise(v("qtTotal")) : undefined,
      installments: v("qtInst") ? Number(v("qtInst")) : undefined,
      installmentGapMonths: v("qtGap") ? Number(v("qtGap")) : undefined,
      discountType: (v("qtDiscT") as "pct" | "amt") || undefined,
      discountValue: v("qtDiscV") ? Number(v("qtDiscV")) : undefined,
    };
    call(AdminOpsService.saveQuotation(q.id, body))
      .then(() => { toast("Saved."); onSaved(); })
      .catch((e: unknown) => { setErr(errMessage(e)); })
      .finally(() => setBusy(false));
  };

  return (
    <>
      {err ? <Notice tone="bad" text={<b>{err}</b>} /> : null}

      <SectionHead title="Plan" desc="Typed by hand — there is no catalogue lookup." />
      <div className="f2">
        <Field id="qtPlanName" label="Plan name" value={plan?.name || ""} ph="e.g. AutoGrowth Growth" />
        <Field id="qtPlanHsn" label="HSN" value={plan?.hsn || ""} />
      </div>
      <div className="f2">
        <Field id="qtTerm" label="Term (months)" type="number" value={plan?.termMonths || ""} />
        <Field id="qtTotal" label="Total amount (₹)" type="number" value={paiseToRupees(plan?.amountPaise)} />
      </div>
      <div className="f2">
        <Field id="qtInst" label="Installments" type="number" value={plan?.installments || 1} />
        <Field id="qtGap" label="Gap between installments (months)" type="number" value={plan?.installmentGapMonths || 1} />
      </div>
      <div className="f2">
        <Field id="qtDiscT" label="Discount type" type="select"
          options={[{ v: "pct", l: "Percent", sel: plan?.discountType !== "amt" },
                    { v: "amt", l: "Amount (₹)", sel: plan?.discountType === "amt" }]} />
        <Field id="qtDiscV" label="Discount value" type="number" value={plan?.discountValue || 0} />
      </div>

      <AddonsEditor q={q} addons={addons} onChanged={onSaved} />

      <SectionHead title="Details" />
      <div className="f2">
        <Field id="qtDate" label="Quotation date" type="date" value={q.quotationDate} />
        <Field id="qtValid" label="Valid until" type="date" value={q.validUntil} />
      </div>
      <div className="f2">
        <Field id="qtPos" label="Place of supply" value={q.placeOfSupply} ph="e.g. Delhi" />
        <Field id="qtGst" label="GST rate" type="select"
          options={GST_RATES.map((r) => ({ v: String(r), l: r + "%", sel: r === q.gstRate }))} />
      </div>
      <Field id="qtTax" label="Tax" type="select"
        options={[{ v: "applicable", l: "Tax applicable", sel: q.taxMode !== "not_applicable" },
                  { v: "not_applicable", l: "Tax not applicable", sel: q.taxMode === "not_applicable" }]} />
      <Field id="qtNotes" label="Notes" type="textarea" rows={2} value={q.notes} />
      <Field id="qtTerms" label="Terms" type="textarea" rows={4} value={q.terms} />

      <button className="btn pri" disabled={busy} onClick={save} style={{ marginTop: "8px" }}>
        {busy ? "Saving…" : "Save changes"}
      </button>
    </>
  );
}

function AddonsEditor({ q, addons, onChanged }: {
  q: QuotationRow; addons: ReturnType<typeof addonsOf>; onChanged: () => void;
}) {
  const { toast } = useShell();
  const [adding, setAdding] = useState(false);

  const addAddon = () => {
    const name = (document.getElementById("qtAddonName") as HTMLInputElement)?.value.trim();
    const amount = (document.getElementById("qtAddonAmt") as HTMLInputElement)?.value;
    if (!name) return toast("Give the line a name.", "bad");
    const body: QuotationAddonInput = { rowVersion: q.rowVersion, name, amountPaise: rupeesToPaise(amount) };
    call(AdminOpsService.addQuotationAddon(q.id, body))
      .then(() => { setAdding(false); onChanged(); })
      .catch((e: unknown) => toast(errMessage(e), "bad"));
  };
  const removeAddon = (itemId: number) => {
    call(AdminOpsService.removeQuotationAddon(q.id, itemId, q.rowVersion))
      .then(() => onChanged())
      .catch((e: unknown) => toast(errMessage(e), "bad"));
  };

  return (
    <>
      <SectionHead title="One-off charges" right={
        <button className="btn sm" onClick={() => setAdding((s) => !s)}><Icon name="plus" size="sm" />Add</button>
      } />
      {addons.length
        ? <table className="tbl"><tbody>
            {addons.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td className="n tnum">{inr(a.amountPaise)}</td>
                <td style={{ width: "1%" }}>
                  <button className="btn icon sm" aria-label="Remove" onClick={() => removeAddon(a.id)}><Icon name="x" size="sm" /></button>
                </td>
              </tr>
            ))}
          </tbody></table>
        : <div className="faint">None yet.</div>}
      {adding
        ? <div className="f2" style={{ marginTop: "6px" }}>
            <Field id="qtAddonName" label="Description" ph="e.g. Onboarding & profile setup" />
            <Field id="qtAddonAmt" label="Amount (₹)" type="number" />
            <button className="btn pri sm" onClick={addAddon} style={{ alignSelf: "flex-end" }}>Add line</button>
          </div>
        : null}
    </>
  );
}

