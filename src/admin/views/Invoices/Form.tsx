/* =====================================================================
   INVOICE — the shared form pieces.
   Was Drawer.tsx: this module used to open a right-hand panel, which the
   prototype never had (views-invoice.js is four PAGES). The drawer is
   gone; what stayed is the editor form, its addon rows and the proof block and the
   event log — all of which the detail and builder pages reuse.
   ===================================================================== */
import { useRef, useState } from "react";
import AdminOpsService from "../../../api/modules/adminOps";
import type { InvoiceAddonInput, InvoiceSaveInput } from "../../../api/modules/adminOps";
import { Field, Icon, Notice, SectionHead } from "../../ui";
import { inr, fmtDate } from "../../ui/format";
import { useShell } from "../../shell/ShellContext";
import { errMessage } from "../../../api/apiService";
import { call, paiseToRupees, rupeesToPaise } from "./api";
import type { InvoiceRow } from "./api";
import { addonsOf, planItemOf } from "./helpers";

const GST_RATES = [0, 5, 12, 18, 28];

/* ---------------------------------------------------------------- form --- */
export function EditForm({ inv, onSaved }: { inv: InvoiceRow; onSaved: () => void }) {
  const plan = planItemOf(inv);
  const addons = addonsOf(inv);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useShell();

  const v = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null)?.value ?? "";

  const save = () => {
    setErr(null);
    // Only sent when the figure actually CHANGED from what's on the row —
    // the field always shows a value, and the server requires a remark
    // whenever planAmountPaise is present, so sending it unconditionally
    // would demand a remark on every save, even ones that never touched it.
    const amtPaise = rupeesToPaise(v("nvAmt"));
    const amountChanged = amtPaise !== (plan?.amountPaise || 0);
    const remark = v("nvRemark").trim();
    if (amountChanged && !remark) { setErr("A remark is required — what this new amount is."); return; }
    setBusy(true);
    const body: InvoiceSaveInput = {
      rowVersion: inv.rowVersion,
      invoiceDate: v("nvDate") || undefined,
      dueDate: v("nvDue") || undefined,
      placeOfSupply: v("nvPos") || undefined,
      gstRate: v("nvGst") ? Number(v("nvGst")) : undefined,
      taxMode: (v("nvTax") as "applicable" | "not_applicable") || undefined,
      notes: v("nvNotes"),
      terms: v("nvTerms"),
      paymentDate: v("nvPayDate") || undefined,
      paymentMode: v("nvPayMode") || undefined,
      paymentReference: v("nvPayRef"),
      planAmountPaise: amountChanged ? amtPaise : undefined,
      planRemark: amountChanged ? remark : undefined,
    };
    call(AdminOpsService.saveInvoice(inv.id, body))
      .then(() => { toast("Saved."); onSaved(); })
      .catch((e: unknown) => setErr(errMessage(e)))
      .finally(() => setBusy(false));
  };

  return (
    <>
      {err ? <Notice tone="bad" text={<b>{err}</b>} /> : null}

      <SectionHead title="Plan line" desc="Changing the amount needs a remark — what this figure is." />
      <div className="f2">
        <Field id="nvAmt" label="Amount (₹)" type="number" value={paiseToRupees(plan?.amountPaise)} />
        <Field id="nvRemark" label="Remark" value={plan?.remark || ""} ph="e.g. Installment 1 of 3" />
      </div>

      <AddonsEditor inv={inv} addons={addons} onChanged={onSaved} />

      <SectionHead title="Details" />
      <div className="f2">
        <Field id="nvDate" label="Invoice date" type="date" value={inv.invoiceDate} />
        <Field id="nvDue" label="Due date" type="date" value={inv.dueDate} />
      </div>
      <div className="f2">
        <Field id="nvPos" label="Place of supply" value={inv.placeOfSupply} />
        <Field id="nvGst" label="GST rate" type="select"
          options={GST_RATES.map((r) => ({ v: String(r), l: r + "%", sel: r === inv.gstRate }))} />
      </div>
      <Field id="nvTax" label="Tax" type="select"
        options={[{ v: "applicable", l: "Tax applicable", sel: inv.taxMode !== "not_applicable" },
                  { v: "not_applicable", l: "Tax not applicable", sel: inv.taxMode === "not_applicable" }]} />

      <SectionHead title="Payment received" desc="What this invoice records — issuing it logs this to the deal ledger." />
      <div className="f2">
        <Field id="nvPayDate" label="Payment date" type="date" value={inv.paymentDate || ""} />
        <Field id="nvPayMode" label="Mode" value={inv.paymentMode} ph="NEFT / UPI / …" />
      </div>
      <Field id="nvPayRef" label="Payment reference / UTR" value={inv.paymentReference} req />

      <Field id="nvNotes" label="Notes" type="textarea" rows={2} value={inv.notes} />
      <Field id="nvTerms" label="Terms" type="textarea" rows={4} value={inv.terms} />

      <button className="btn pri" disabled={busy} onClick={save} style={{ marginTop: "8px" }}>
        {busy ? "Saving…" : "Save changes"}
      </button>
    </>
  );
}

function AddonsEditor({ inv, addons, onChanged }: {
  inv: InvoiceRow; addons: ReturnType<typeof addonsOf>; onChanged: () => void;
}) {
  const { toast } = useShell();
  const [adding, setAdding] = useState(false);

  const addAddon = () => {
    const description = (document.getElementById("nvAddonDesc") as HTMLInputElement)?.value.trim();
    const amount = (document.getElementById("nvAddonAmt") as HTMLInputElement)?.value;
    if (!description) return toast("Give the line a description.", "bad");
    const body: InvoiceAddonInput = { rowVersion: inv.rowVersion, description, amountPaise: rupeesToPaise(amount) };
    call(AdminOpsService.addInvoiceAddon(inv.id, body))
      .then(() => { setAdding(false); onChanged(); })
      .catch((e: unknown) => toast(errMessage(e), "bad"));
  };
  const removeAddon = (itemId: number) => {
    call(AdminOpsService.removeInvoiceAddon(inv.id, itemId, inv.rowVersion))
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
                <td>{a.description}</td>
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
            <Field id="nvAddonDesc" label="Description" ph="e.g. Onboarding & profile setup" />
            <Field id="nvAddonAmt" label="Amount (₹)" type="number" />
            <button className="btn pri sm" onClick={addAddon} style={{ alignSelf: "flex-end" }}>Add line</button>
          </div>
        : null}
    </>
  );
}

/* ---------------------------------------------------------------- proof --- */
export function ProofsBlock({ inv, onChanged }: { inv: InvoiceRow; onChanged: () => void }) {
  const { toast } = useShell();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const liveProofs = (inv.proofs || []).filter((p) => !p.removed);

  const upload = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    call(AdminOpsService.attachInvoiceProof(inv.id, file))
      .then(() => { onChanged(); toast("Proof attached."); })
      .catch((e: unknown) => toast(errMessage(e), "bad"))
      .finally(() => { setBusy(false); if (fileRef.current) fileRef.current.value = ""; });
  };

  return (
    <>
      <SectionHead title="Payment proof" desc="Required before this invoice can be issued." />
      {liveProofs.length
        ? <ul style={{ marginBottom: "8px" }}>
            {liveProofs.map((p) => (
              <li key={p.id} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {p.url ? <a href={p.url} target="_blank" rel="noreferrer">{p.filename}</a> : <span>{p.filename}</span>}
                <span className="faint" style={{ fontSize: "var(--text-sm)" }}>({Math.round(p.bytes / 1024)} KB)</span>
              </li>
            ))}
          </ul>
        : <div className="faint" style={{ marginBottom: "8px" }}>No proof attached yet.</div>}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={upload} disabled={busy} />
        {busy ? <span className="faint">Uploading…</span> : null}
      </div>
    </>
  );
}

export function EventLog({ events }: { events: NonNullable<InvoiceRow["events"]> }) {
  return (
    <div className="tl">
      {events.map((e) => (
        <div key={e.id} className="ti">
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span className="pill xs">{e.eventType}</span>
            <span className="faint" style={{ fontSize: "var(--text-sm)", marginLeft: "auto" }}>{fmtDate(e.createdAt)}</span>
          </div>
          {e.detail ? <div style={{ fontSize: "var(--text-base)", marginTop: "4px" }}>{e.detail}</div> : null}
          <div className="faint" style={{ fontSize: "var(--text-sm)", marginTop: "2px" }}>
            {e.actor ? e.actor.name : e.actorRole || "System"}
          </div>
        </div>
      ))}
    </div>
  );
}
