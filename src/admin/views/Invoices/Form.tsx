/* =====================================================================
   INVOICE — the builder body and the pieces the detail page borrows.

   The same two-column builder the quotation has (Quotations/Form.tsx
   BuilderBody): numbered steps down the left, one summary rail on the right
   carrying the only Save on the page. What an invoice adds is step 3 —
   the payment it records, and the proof of it — because an invoice here is
   raised only AFTER the client has paid, and both the reference and the
   evidence are what the issue transaction refuses without.
   ===================================================================== */
import { useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import AdminOpsService from "../../../api/modules/adminOps";
import type { InvoiceSaveInput } from "../../../api/modules/adminOps";
import { CommonService } from "../../../api/modules/common";
import { Field, Icon, Notice, Table } from "../../ui";
import { inr, inrWords, fmtDate } from "../../ui/format";
import { useNav } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { AppExceptions, SERVICE_MESSAGE, errMessage } from "../../../api/apiService";
import { usePlanCatalogue } from "../Quotations/api";
import { GST_RATES, SELLER, STATES, planLabel } from "../Quotations/helpers";
import { call, paiseToRupees, rupeesToPaise } from "./api";
import type { InvoiceRow } from "./api";
import { addonsOf, blockersOf, planItemOf } from "./helpers";

/* The five the prototype offers. Free text server-side, so the list is a
   convenience, not a constraint — an unknown stored mode still shows. */
const PAY_MODES = ["NEFT", "IMPS", "UPI", "RTGS", "Cheque"];

/* What the remark usually is, one click away. Free text underneath for
   everything else -- the server only insists that it is not empty. */
const REMARK_PRESETS = ["Slot booking", "Installment 1", "Installment 2",
  "Installment 3", "Installment 4", "Installment 5"];

/* ============================================================== the body === */
export function BuilderBody({ inv, onSaved }: { inv: InvoiceRow; onSaved: () => void }) {
  const plan = planItemOf(inv);
  const addons = addonsOf(inv);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /* The one control whose CHOICE changes what else is on screen; the rest are
     read from the DOM at save time, same as the quotation builder. */
  const [taxMode, setTaxMode] = useState(inv.taxMode);
  const { toast } = useShell();
  const { go } = useNav();

  const v = (id: string) =>
    (document.getElementById(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null)?.value ?? "";

  /* Everything on the page, in one patch. Read fresh on every write — adding a
     charge must not throw away what is already typed beside it. */
  const patch = (): InvoiceSaveInput => {
    /* planAmountPaise only when the figure or its remark actually CHANGED: the
       fields always carry a value, and the server demands a remark whenever the
       amount is present, so sending it every time would ask for a remark on
       saves that never touched it. The remark rides WITH the amount because
       that is the only way the server takes it (SaveAll) -- so a remark-only
       fix resends the amount unchanged. */
    const amtPaise = rupeesToPaise(v("nvAmt"));
    const sel = v("nvRemark");
    const remark = (sel === "other" ? v("nvRemarkOther") : sel).trim();
    const amountChanged = !!plan && (amtPaise !== plan.amountPaise || remark !== (plan.remark || ""));
    return {
      rowVersion: inv.rowVersion,
      invoiceDate: v("nvDate") || undefined,
      dueDate: v("nvDue") || undefined,
      placeOfSupply: v("nvPos") || undefined,
      gstRate: v("nvGst") ? Number(v("nvGst")) : undefined,
      taxMode,
      notes: v("nvNotes"),
      terms: v("nvTerms"),
      paymentDate: v("nvPayDate") || undefined,
      paymentMode: v("nvPayMode") || undefined,
      paymentReference: v("nvPayRef"),
      planAmountPaise: amountChanged ? amtPaise : undefined,
      planRemark: amountChanged ? remark : undefined,
      addons: addons.map((a) => ({
        itemId: a.id, description: v("a-nm-" + a.id), hsn: v("a-hs-" + a.id),
        amountPaise: rupeesToPaise(v("a-am-" + a.id)),
      })),
    };
  };

  /* Save is the end of the builder, so it lands on the invoice rather than
     leaving you on the form you just finished. The mid-edit writes below (add
     or remove a charge) stay put — those are steps, not the finish. */
  const save = () => {
    const body = patch();
    if (body.planAmountPaise !== undefined && !body.planRemark) {
      setErr("A remark is required \u2014 what this figure is. Pick a preset, or Other and type one.");
      return;
    }
    setErr(null); setBusy(true);
    call(AdminOpsService.saveInvoice(inv.id, body))
      .then(() => { toast("Saved."); go("#/invoices/" + inv.id); })
      .catch((e: unknown) => { setErr(errMessage(e)); setBusy(false); });
  };

  /* Adding or removing a charge saves the rest of the page first, then acts on
     the row version that write returned — same order the prototype uses.
     Otherwise the second request 409s on a stale rowVersion, or whatever is
     typed in the other blocks is lost. */
  const withQuietSave = (label: string, then: (rowVersion: number) => Promise<unknown>) => {
    setErr(null); setBusy(true);
    call(AdminOpsService.saveInvoice(inv.id, patch()))
      .then((row: InvoiceRow) => then(row.rowVersion))
      .then(() => { toast(label); onSaved(); })
      .catch((e: unknown) => setErr(errMessage(e)))
      .finally(() => setBusy(false));
  };
  const addAddon = () => withQuietSave("Charge added.", (rowVersion) =>
    call(AdminOpsService.addInvoiceAddon(inv.id, { rowVersion })));
  const removeAddon = (itemId: number) => withQuietSave("Charge removed.", (rowVersion) =>
    call(AdminOpsService.removeInvoiceAddon(inv.id, itemId, rowVersion)));

  return (
    <div className="qbld">
      <div>
        {err ? <Notice tone="bad" text={<b>{err}</b>} /> : null}

        <Step n={1} title="Who and when" hint="the invoice's own dates, and who it is billed to" />
        <div className="card"><div className="card-b">
          <Parties inv={inv} />
          <div className="f3" style={{ marginTop: "var(--space-4)" }}>
            <Field id="nvDate" label="Invoice date" type="date" value={inv.invoiceDate} />
            <Field id="nvDue" label="Due date" type="date" value={inv.dueDate}
              help="Drives Overdue on the list." />
            <Field id="nvPos" label="Place of supply" type="select"
              options={STATES.map((s) => ({ v: s, l: s, sel: s === inv.placeOfSupply }))}
              help="Drives the CGST/SGST ↔ IGST split." />
          </div>
          <div className="help">
            The billing block is a <b>column, not a join</b>. It is copied from the deal now and
            <b> frozen again at issue</b>, so a later profile edit cannot reach a document the
            customer already holds.
          </div>
        </div></div>

        <Step n={2} title="What you're billing"
          hint="the quotation's schedule, the plan, and anything one-off" />
        <div className="card">
          <PlanBlock inv={inv} plan={plan} />
          <AddonBlock addons={addons} busy={busy} onAdd={addAddon} onRemove={removeAddon} />
        </div>

        <Step n={3} title="Payment received"
          hint="required — an invoice is raised only after the client has paid" />
        <div className="card"><div className="card-b">
          <div className="f3">
            <Field id="nvPayDate" label="Date received" type="date" value={inv.paymentDate || ""} />
            <Field id="nvPayMode" label="Mode" type="select"
              options={PAY_MODES.concat(inv.paymentMode && PAY_MODES.indexOf(inv.paymentMode) < 0
                ? [inv.paymentMode] : [])
                .map((m) => ({ v: m, l: m, sel: m === inv.paymentMode }))} />
            <Field id="nvPayRef" label="Reference / UTR" req value={inv.paymentReference}
              ph="NEFT0026JUN4471"
              help="Mandatory — without it the payment cannot be reconciled against the bank." />
          </div>
          <ProofsBlock inv={inv} onChanged={onSaved} />
        </div></div>

        <Step n={4} title="What it says" hint="notes and terms, printed on the document" />
        <div className="card"><div className="card-b">
          <Field id="nvNotes" label="Notes (customer-facing)" type="textarea" rows={3} value={inv.notes}
            ph="Anything the customer should read alongside the figures." />
          <Field id="nvTerms" label="Payment terms" type="textarea" rows={6} value={inv.terms} />
        </div></div>
      </div>

      <div className="qbld-rail">
        <Summary inv={inv} plan={plan} addons={addons} taxMode={taxMode} onTaxMode={setTaxMode}
          busy={busy} onSave={save} />
      </div>
    </div>
  );
}

/* A numbered step rather than a section heading — the quotation builder's own
   step(), for the same reason: four equal headings read as four things, four
   numbers read as a sequence you are part way through. */
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
function Parties({ inv }: { inv: InvoiceRow }) {
  const { go } = useNav();
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
        <span className="qparties-k">Bill to <span className="faint">· from the deal</span></span>
        <b>{inv.billing.name || "—"}</b><br />
        {inv.billing.address || "—"}<br />
        <span className="mono">{inv.billing.phone || "—"}</span>{" "}
        <a className="lnk" data-go={"#/deals/" + inv.dealRef} onClick={() => go("#/deals/" + inv.dealRef)}>
          Edit on deal ↗</a>
      </div>
    </div>
  );
}

/* The plan line as the quotation left it, then the three fields that may
   change it. There is no reconciliation against the quotation's arithmetic:
   the team can bill any amount, with a mandatory remark saying what it IS.

   The feature chips are the tier itself, read back off the plan catalogue by
   the name stored on the line -- the same match the detail page and the
   quotation builder make. A hand-typed name, or a tier since retired, simply
   renders without them. */
function PlanBlock({ inv, plan }: { inv: InvoiceRow; plan: ReturnType<typeof planItemOf> }) {
  const { plans } = usePlanCatalogue();
  if (!plan) return <div className="card-b faint">No plan block.</div>;
  const cat = plans.find((c) => planLabel(c) === plan.description);
  const feats = cat ? (cat.features || []).map((f) => (typeof f === "string" ? f : f.text)).filter(Boolean) : [];
  const preset = REMARK_PRESETS.indexOf(plan.remark || "") >= 0;
  return (
    <div className="card-b">
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "var(--text-xl)", fontWeight: 600 }}>{plan.description}</div>
          <div className="faint" style={{ fontSize: "var(--text-md)" }}>
            From {inv.quotationNumber || "the accepted quotation"} · suggested:{" "}
            {plan.installmentCount
              ? "installment " + plan.installmentSeq + " of " + plan.installmentCount
              : "the plan's full amount"}
          </div>
          {plan.remark
            ? <div className="faint" style={{ fontSize: "var(--text-sm)", marginTop: "3px" }}>
                <Icon name="tag" size="sm" />{plan.remark}</div>
            : null}
        </div>
        <div className="tnum" style={{ fontSize: "var(--text-2xl)", fontWeight: 600 }}>
          {inr(plan.amountPaise)}</div>
      </div>

      {feats.length
        ? <div style={{ marginTop: "12px" }}>
            <div className="lbl">What the plan includes</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "6px" }}>
              {feats.map((f, i) => <span key={i} className="pill xs" title={f}>{f}</span>)}
            </div>
            {/* Not snapshotted, unlike the prototype's copy: the line stores the
                plan NAME, and these are read live from the catalogue by it. The
                document carries the figures below, never this list. */}
            <div className="help">Read from the plan catalogue by the name on this line. The document
              carries the figures below, not these.</div>
          </div>
        : null}

      <div className="f3" style={{ marginTop: "14px" }}>
        <Field id="nvAmt" label="Amount ₹" type="number" value={paiseToRupees(plan.amountPaise)} />
        <Field id="nvRemark" label="Remark" type="select"
          options={REMARK_PRESETS.map((r) => ({ v: r, l: r, sel: plan.remark === r }))
            .concat([{ v: "other", l: "Other (type below)", sel: !preset }])}
          help="One-click preset, or Other for anything else." />
        <Field id="nvRemarkOther" label="Custom remark" value={preset ? "" : plan.remark || ""}
          ph="e.g. Registration amount, balance payment…"
          help="Used only when Remark above is Other — mandatory in that case." />
      </div>
    </div>
  );
}

/* A one-off charge has an amount and nothing else -- no term, no quantity, no
   discount column. The button leads, because on an invoice with no charges the
   only question is whether you want one. */
function AddonBlock({ addons, busy, onAdd, onRemove }: {
  addons: ReturnType<typeof addonsOf>; busy: boolean;
  onAdd: () => void; onRemove: (itemId: number) => void;
}) {
  const addBtn = (
    <button className="btn" data-act="in-addon-add" disabled={busy} onClick={onAdd}>
      <Icon name="plus" size="sm" />Add charge</button>
  );
  if (!addons.length) return (
    <div className="card-b" style={{ display: "flex", alignItems: "center", gap: "10px",
                                     borderTop: "1px solid var(--line)" }}>
      {addBtn}
      <span className="faint" style={{ fontSize: "var(--text-md)" }}>
        Onboarding, a shoot, a custom integration. <b>No months and no quantity</b> — a one-off
        charge has an amount and nothing else.</span>
    </div>
  );

  return (
    <div className="card-b" style={{ borderTop: "1px solid var(--line)" }}>
      <Table
        cols={[{ label: "#", w: "36px" }, { label: "Description" }, { label: "HSN / SAC", w: "120px" },
          { label: "Amount ₹", cls: "n", w: "150px" }, { label: "", w: "44px" }]}
        rows={addons.map((it, ix) => (
          <tr key={it.id}>
            <td className="faint">{ix + 1}</td>
            <td><input className="inp sm" id={"a-nm-" + it.id} defaultValue={it.description} /></td>
            <td><input className="inp sm" id={"a-hs-" + it.id} defaultValue={it.hsn || ""} /></td>
            <td className="n">
              <input className="inp sm n" id={"a-am-" + it.id} type="number"
                defaultValue={Math.round(it.amountPaise / 100)} />
            </td>
            <td className="c">
              <button className="btn sm icon dgr" data-act="in-addon-del" aria-label="Remove charge"
                disabled={busy} onClick={() => onRemove(it.id)}><Icon name="x" size="sm" /></button>
            </td>
          </tr>
        ))}
      />
      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>{addBtn}</div>
    </div>
  );
}

/* ============================================================= the rail === */
/* Display only — every figure is what the SERVER last computed, and it
   recomputes them again on save. The one commit for the whole page lives here,
   because this is the card that already shows what every field on it adds up
   to. */
function Summary({ inv, plan, addons, taxMode, onTaxMode, busy, onSave }: {
  inv: InvoiceRow; plan: ReturnType<typeof planItemOf>; addons: ReturnType<typeof addonsOf>;
  taxMode: string; onTaxMode: (m: "applicable" | "not_applicable") => void;
  busy: boolean; onSave: () => void;
}) {
  const applicable = taxMode !== "not_applicable";
  const intra = inv.placeOfSupply === SELLER.state;
  const addonGross = addons.reduce((a, i) => a + i.amountPaise, 0);
  const blockers = blockersOf(inv);

  return (
    <div className="card">
      <div className="card-h"><h3>Summary</h3>
        <span className="d">display only — the server recomputes</span></div>
      <div className="card-b">
        <Row k={"Plan" + (plan && plan.installmentCount
          ? " · installment " + plan.installmentSeq + " of " + plan.installmentCount : "")}
          v={inr(plan ? plan.amountPaise : 0)} />
        {addons.length ? <Row k="One-off charges" v={inr(addonGross)} /> : null}
        <Row k={<b>Subtotal</b>} v={<b>{inr(inv.subtotalPaise)}</b>}
          style={{ borderTop: "1px solid var(--line)", marginTop: "4px" }} />
        <Row k={applicable ? "Taxable value" : "Amount"} v={inr(inv.taxableTotalPaise)}
          style={{ borderTop: "1px solid var(--line)" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0" }}>
          <span>Tax</span>
          <div className="btn-group">
            <button className={applicable ? "on" : ""} data-act="in-tax-mode" data-v="applicable"
              onClick={() => onTaxMode("applicable")}>Applicable</button>
            <button className={!applicable ? "on" : ""} data-act="in-tax-mode" data-v="not_applicable"
              onClick={() => onTaxMode("not_applicable")}>Not applicable</button>
          </div>
        </div>

        {applicable
          ? <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0" }}>
                <span>GST rate</span>
                <select className="inp sm" id="nvGst" style={{ width: "96px" }} defaultValue={String(inv.gstRate)}>
                  {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                </select>
              </div>
              {intra
                ? <>
                    <Row k={"CGST (" + inv.gstRate / 2 + "%)"} v={inr(inv.cgstPaise)} />
                    <Row k={"SGST (" + inv.gstRate / 2 + "%)"} v={inr(inv.sgstPaise)} />
                  </>
                : <Row k={"IGST (" + inv.gstRate + "%)"} v={inr(inv.igstPaise)} />}
            </>
          : <div className="help" style={{ marginTop: "10px" }}>
              <b>Tax not applicable.</b> The grand total excludes GST entirely — an explicit choice
              for this invoice.
            </div>}

        <Row k={<b style={{ fontSize: "var(--text-lg)" }}>Grand total</b>}
          v={<b style={{ fontSize: "var(--text-lg)" }}>{inr(inv.grandTotalPaise)}</b>}
          style={{ borderTop: "2px solid var(--line-2)", marginTop: "6px", paddingTop: "9px" }} />
        <div className="faint" style={{ fontSize: "var(--text-sm)", marginTop: "4px" }}>
          {inrWords(inv.grandTotalPaise)}
        </div>

        {applicable
          ? <div className="help" style={{ marginTop: "10px" }}>
              {intra
                ? <><b>Intra-state.</b> Place of supply is {inv.placeOfSupply}, the same state as
                    Interior bazzar — so GST splits into CGST + SGST.</>
                : <><b>Inter-state.</b> Place of supply is {inv.placeOfSupply || "not set"} and Interior
                    bazzar is in {SELLER.state} — so a single IGST applies.</>}
            </div>
          : null}
      </div>

      <div className="card-f qsave">
        <button className="btn pri" data-act="in-save-all" disabled={busy} onClick={onSave}>
          <Icon name="check" />{busy ? "Saving…" : "Save changes"}</button>
        <span className="qsave-h">Writes the dates, the plan, the charges and the payment together.</span>
      </div>

      <div className="card-f">
        {blockers.length
          ? <Notice tone="bad" ico="alert" text={<>
              <b>Cannot be issued yet</b>
              <ul style={{ margin: "5px 0 0 16px" }}>
                {blockers.map((b) => <li key={b}>{b}</li>)}
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

/* ---------------------------------------------------------------- proof --- */
/* One line, not a section: what the issue transaction is still missing, and
   the button that fixes it. Internal evidence — it never reaches the document,
   and saying so beside it is cheaper than explaining it later.

   Attaching is a DRAFT-only affordance, because the server allows it nowhere
   else (InvoicesController.AttachProof): the proof is a precondition of
   issuing, so by the time an invoice is issued its evidence is already on
   file and frozen with it. On an issued invoice this block still LISTS what
   is on file -- that is the answer to "what was this issued on" -- it just
   offers no button that would be refused. */
export function ProofsBlock({ inv, onChanged }: { inv: InvoiceRow; onChanged: () => void }) {
  const { toast } = useShell();
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const proofs = (inv.proofs || []).filter((p) => !p.removed);
  const isDraft = inv.status === "draft";

  /* Straight to S3 with a presigned PUT, then the API is told where it landed
     — the same route every other image on the platform takes. The bytes do not
     go through Django: a phone photo of a bank slip is precisely the payload a
     proxied multipart POST drops, and a proof that fails to attach blocks the
     issue. No cropper: this is evidence, and cropping evidence is not a feature. */
  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setPct(0);
    try {
      const res = await CommonService.getUploadUrl({
        fileName: file.name, fileType: file.type || "application/octet-stream",
        for: "PaymentScreenshot",
      });
      if (!res.response) throw new Error(res.message || "Could not get an upload URL.");
      await CommonService.uploadToS3WithProgress(res.data.uploadUrl, file, setPct);
      await call(AdminOpsService.attachInvoiceProof(inv.id, {
        fileUrl: res.data.fileUrl, filename: file.name,
        mime: file.type || "", bytes: file.size,
      }));
      onChanged();
      toast("Proof attached.");
    } catch (e: unknown) {
      /* The S3 leg throws a plain Error whose text we wrote ("S3 upload failed
         with status 403"), which is worth showing; errMessage() only knows the
         API envelope and would flatten it to the generic line. */
      toast(e instanceof AppExceptions ? errMessage(e)
        : (e instanceof Error && e.message) || SERVICE_MESSAGE, "bad");
    } finally {
      setBusy(false);
      setPct(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                    flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
        <span style={{ fontSize: "var(--text-sm)" }}>
          {proofs.length
            ? <b style={{ color: "var(--ok)" }}><Icon name="check" size="sm" />
                {proofs.length} proof{proofs.length === 1 ? "" : "s"}{" "}
                {isDraft ? "attached" : "on file"}</b>
            : isDraft
              ? <b style={{ color: "var(--bad)" }}><Icon name="alert" size="sm" />
                  No payment proof attached yet — required to issue</b>
              : <b className="faint">No proof on file</b>}{" "}
          <span className="faint">· internal record, never shown to the customer</span>
        </span>
        {isDraft
          ? <>
              <button className="btn sm" disabled={busy} onClick={() => fileRef.current?.click()}>
                <Icon name="plus" size="sm" />
                {busy ? (pct && pct < 100 ? `Uploading ${pct}%` : "Attaching\u2026") : "Attach payment proof"}</button>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={upload} />
            </>
          : <span className="faint" style={{ fontSize: "var(--text-sm)" }}>
              Frozen with the invoice at issue</span>}
      </div>
      {proofs.length
        ? <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
            {proofs.map((p) => (p.url
              ? <a key={p.id} className="pill xs ok" href={p.url} target="_blank" rel="noreferrer"
                  title={p.filename}><Icon name="shield" size="sm" />{p.filename}</a>
              : <span key={p.id} className="pill xs ok" title={p.filename}>
                  <Icon name="shield" size="sm" />{p.filename}</span>))}
          </div>
        : null}
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
