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
import AdminOpsService from "../../../api/modules/adminOps";
import type { InvoiceSaveInput } from "../../../api/modules/adminOps";
import { CommonService } from "../../../api/modules/common";
import {
  Alert, Button, Card, DateInput, FieldRow, FormField, FormSection, Icon, IconButton, Input, PageHeader, Pill,
  SectionHead, SelectInput, Table, Textarea, Timeline,
} from "../../ui";
import { BillTo, BuilderLayout, BuilderSummary, FeatureFold, StepHead } from "../Quotations/bits";
import { inr, fmtDate } from "../../ui/format";
import { useNav } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { AppExceptions, SERVICE_MESSAGE, errMessage } from "../../../api/apiService";
import { usePlanCatalogue } from "../Quotations/api";
import { STATES, planLabel } from "../Quotations/helpers";
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
export function BuilderBody({ inv, onSaved, detail }: { inv: InvoiceRow; onSaved: () => void; detail: string }) {
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

  const dealTo = "#/deals/" + inv.dealRef;
  const quoteTo = inv.quotationId ? "#/quotations/" + inv.quotationId : null;

  /* The lines above the tax block. Display only — every figure is what the
     server last computed, and it recomputes them again on save. */
  const lines = [
    { k: "Plan" + (plan && plan.installmentCount
        ? " · installment " + plan.installmentSeq + " of " + plan.installmentCount : ""),
      v: inr(plan ? plan.amountPaise : 0) },
    ...(addons.length ? [{ k: "One-off charges", v: inr(addons.reduce((a, i) => a + i.amountPaise, 0)) }] : []),
    { k: "Subtotal", v: inr(inv.subtotalPaise), rule: true },
    { k: taxMode !== "not_applicable" ? "Taxable value" : "Amount", v: inr(inv.taxableTotalPaise), rule: true },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {/* The header is the quotation builder's, line for line: same eyebrow,
          same meta row carrying the record's own links, one primary. The
          "source strip" card that used to sit under it repeated the deal ref,
          the quotation number and the total — all three are already on this
          screen, in the meta, the plan line and the summary. */}
      <PageHeader
        eyebrow="Step 2 of 2"
        title="New invoice"
        back={{ label: "Back to the invoice", to: detail }}
        meta={<>
          <Pill dot text="Draft" />
          <a href={dealTo} data-go={dealTo} className="font-mono text-brand-secondary tnum"
            onClick={(e) => { e.preventDefault(); go(dealTo); }}>{inv.dealRef}</a>
          {quoteTo
            ? <a href={quoteTo} data-go={quoteTo} className="font-mono text-brand-secondary tnum"
                onClick={(e) => { e.preventDefault(); go(quoteTo); }}>{inv.quotationNumber || "quotation"}</a>
            : <Pill xs text="quotation_required" tone="bad" />}
          <span className="font-mono tnum">Number assigned on issue</span>
        </>}
        actions={<Button color="primary" ico="quote" onClick={() => go("#/invoices/" + inv.id + "?mode=preview")}>
          Preview &amp; issue</Button>} />

      {err ? <Alert tone="bad" title="Could not save this invoice.">{err}</Alert> : null}

      <BuilderLayout
        form={<>
          <section className="flex min-w-0 flex-col gap-3">
            <StepHead n={1} title="Details" hint="from the deal, frozen at issue" />
            <Card>
              <FormSection>
                <BillTo name={inv.billing.name || "—"} address={inv.billing.address || "—"} phone={inv.billing.phone || "—"}
                  edit={<Button color="link-color" size="xs" ico="ext" data-go={dealTo}
                    onClick={() => go(dealTo)}>Edit on the deal</Button>} />
                <FieldRow cols={3}>
                  <FormField id="nvDate" label="Invoice date">
                    <DateInput id="nvDate" defaultValue={inv.invoiceDate} className="w-full" />
                  </FormField>
                  <FormField id="nvDue" label="Due date" hint="Drives Overdue on the list.">
                    <DateInput id="nvDue" defaultValue={inv.dueDate} className="w-full" />
                  </FormField>
                  <FormField id="nvPos" label="Place of supply" hint="Drives the CGST/SGST ↔ IGST split.">
                    <SelectInput id="nvPos" defaultValue={inv.placeOfSupply}
                      options={STATES.map((s) => ({ v: s, l: s }))} />
                  </FormField>
                </FieldRow>
              </FormSection>
            </Card>
          </section>

          <section className="flex min-w-0 flex-col gap-3">
            <StepHead n={2} title="Plan and charges" />
            <Card flush>
              <PlanBlock inv={inv} plan={plan} />
              <AddonBlock addons={addons} busy={busy} onAdd={addAddon} onRemove={removeAddon} />
            </Card>
          </section>

          <section className="flex min-w-0 flex-col gap-3">
            <StepHead n={3} title="Payment received" hint="required before an invoice is raised" />
            <Card>
              <FormSection>
                <FieldRow cols={3}>
                  <FormField id="nvPayDate" label="Date received">
                    <DateInput id="nvPayDate" defaultValue={inv.paymentDate || ""} className="w-full" />
                  </FormField>
                  <FormField id="nvPayMode" label="Mode">
                    <SelectInput id="nvPayMode" defaultValue={inv.paymentMode}
                      options={PAY_MODES.concat(inv.paymentMode && PAY_MODES.indexOf(inv.paymentMode) < 0
                        ? [inv.paymentMode] : []).map((m) => ({ v: m, l: m }))} />
                  </FormField>
                  <FormField id="nvPayRef" label="Reference / UTR" req
                    hint="Mandatory — without it the payment cannot be reconciled against the bank.">
                    <Input id="nvPayRef" defaultValue={inv.paymentReference} mono ph="NEFT0026JUN4471" />
                  </FormField>
                </FieldRow>
                <ProofsBlock inv={inv} onChanged={onSaved} />
              </FormSection>
            </Card>
          </section>

          <section className="flex min-w-0 flex-col gap-3">
            <StepHead n={4} title="Notes and terms" />
            <Card>
              <FormSection>
                <FormField id="nvNotes" label="Notes (customer-facing)">
                  <Textarea id="nvNotes" rows={3} defaultValue={inv.notes}
                    ph="Anything the customer should read alongside the figures." />
                </FormField>
                <FormField id="nvTerms" label="Payment terms">
                  <Textarea id="nvTerms" rows={6} defaultValue={inv.terms} />
                </FormField>
              </FormSection>
            </Card>
          </section>
        </>}
        rail={
          <BuilderSummary lines={lines}
            gstId="nvGst" gstRate={inv.gstRate} taxMode={taxMode} onTaxMode={setTaxMode}
            placeOfSupply={inv.placeOfSupply}
            cgstPaise={inv.cgstPaise} sgstPaise={inv.sgstPaise} igstPaise={inv.igstPaise}
            grandTotalPaise={inv.grandTotalPaise} blockers={blockersOf(inv).map((b) => ({ text: b }))}
            busy={busy} onSave={save} saveLabel="Save changes" saveAct="in-save-all" />
        } />
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
  /* Which remark is chosen is STATE, because "Other" is the one answer that
     opens a second field — and a field for an answer nobody gave should not
     be on screen. `patch()` still reads both controls off the DOM: the select
     carries its value, and the free-text input exists exactly when it is the
     one being read. */
  const stored = plan ? plan.remark || "" : "";
  const storedIsPreset = REMARK_PRESETS.indexOf(stored) >= 0;
  const [remark, setRemark] = useState(storedIsPreset ? stored : "other");
  if (!plan) return <p className="p-5 text-sm text-tertiary">No plan block.</p>;
  const cat = plans.find((c) => planLabel(c) === plan.description);
  const feats = cat ? (cat.features || []).map((f) => (typeof f === "string" ? f : f.text)).filter(Boolean) : [];
  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold text-primary">{plan.description}</div>
          <div className="mt-0.5 text-sm text-tertiary">
            {inv.quotationNumber || "Accepted quotation"} ·{" "}
            {plan.installmentCount
              ? "installment " + plan.installmentSeq + " of " + plan.installmentCount
              : "full amount"}
          </div>
        </div>
        <div className="shrink-0 font-mono text-display-xs font-semibold text-primary tnum">
          {inr(plan.amountPaise)}</div>
      </div>

      {/* Read live from the catalogue by the name on the line, same as the
          quotation builder — and folded the same way, so the tier's ten chips
          do not stand between the amount and the field that changes it. */}
      <FeatureFold feats={feats} />

      <FieldRow cols={3}>
        <FormField id="nvAmt" label="Amount ₹">
          <Input id="nvAmt" type="number" defaultValue={paiseToRupees(plan.amountPaise)} mono />
        </FormField>
        <FormField id="nvRemark" label="Remark" req>
          <SelectInput id="nvRemark" value={remark} onChange={setRemark}
            options={REMARK_PRESETS.map((r) => ({ v: r, l: r })).concat([{ v: "other", l: "Other…" }])} />
        </FormField>
        {remark === "other" ? (
          <FormField id="nvRemarkOther" label="Custom remark" req>
            <Input id="nvRemarkOther" defaultValue={storedIsPreset ? "" : stored}
              ph="e.g. Registration amount, balance payment" />
          </FormField>
        ) : null}
      </FieldRow>
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
  /* The same head the quotation's charges wear — title left, the one entry
     point right — so the two builders' second cards read as one drawing. */
  const add = (
    <Button color="secondary" size="xs" ico="plus" data-act="in-addon-add" isDisabled={busy} onClick={onAdd}>
      Add a charge</Button>
  );
  return (
    <div className="flex min-w-0 flex-col gap-3 border-t border-secondary p-5">
      <SectionHead className="mb-0" title="One-off charges" right={add} />
      {addons.length ? <Table
        cols={[{ label: "#", w: "36px" }, { label: "Description" }, { label: "HSN / SAC", w: "120px" },
          { label: "Amount ₹", cls: "n", w: "150px" }, { label: "", cls: "acts", w: "44px" }]}
        rows={addons.map((it, ix) => (
          <tr key={it.id}>
            <td className="faint">{ix + 1}</td>
            <td><Input id={"a-nm-" + it.id} defaultValue={it.description} ariaLabel="Description" /></td>
            <td><Input id={"a-hs-" + it.id} defaultValue={it.hsn || ""} ariaLabel="HSN or SAC" mono /></td>
            <td className="n">
              <Input id={"a-am-" + it.id} type="number" ariaLabel="Amount in rupees" mono
                inputClassName="text-right" defaultValue={String(Math.round(it.amountPaise / 100))} />
            </td>
            <td className="acts">
              <IconButton ico="x" size="xs" label="Remove charge" data-act="in-addon-del"
                isDisabled={busy} onClick={() => onRemove(it.id)} />
            </td>
          </tr>
        ))}
      /> : null}
    </div>
  );
}

/* The rail is `BuilderSummary` in Quotations/bits now — one drawing for both
   builders, carrying the figures, the tax decision and the one Save. */

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
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 text-sm">
          {/* THE STATE FIRST, then the caveat: whether the issue guard is
              satisfied is the only thing being asked here. */}
          {proofs.length
            ? <b className="inline-flex items-center gap-1 font-medium text-success-primary">
                <Icon name="check" size="xs" />
                {proofs.length} proof{proofs.length === 1 ? "" : "s"}{" "}
                {isDraft ? "attached" : "on file"}</b>
            : isDraft
              ? <b className="inline-flex items-center gap-1 font-medium text-error-primary">
                  <Icon name="alert" size="xs" />
                  No payment proof attached yet — required to issue</b>
              : <b className="font-medium text-quaternary">No proof on file</b>}{" "}
          <span className="text-tertiary">· internal record, never shown to the customer</span>
        </span>
        {isDraft
          ? <>
              <Button color="secondary" size="xs" ico="plus" isDisabled={busy}
                onClick={() => fileRef.current?.click()}>
                {busy ? (pct && pct < 100 ? "Uploading " + pct + "%" : "Attaching…") : "Attach payment proof"}</Button>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={upload} />
            </>
          : <span className="text-sm text-tertiary">Frozen with the invoice at issue</span>}
      </div>
      {proofs.length
        ? <div className="flex flex-wrap gap-1.5">
            {proofs.map((p) => (p.url
              ? <a key={p.id} href={p.url} target="_blank" rel="noreferrer" title={p.filename}
                  className="rounded-md outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2">
                  <Pill xs ico="shield" tone="ok" text={p.filename} /></a>
              : <Pill key={p.id} xs ico="shield" tone="ok" text={p.filename} title={p.filename} />))}
          </div>
        : null}
    </div>
  );
}

export function EventLog({ events }: { events: NonNullable<InvoiceRow["events"]> }) {
  return (
    /* the shared timeline — see the note in Deals/Drawer.tsx */
    <Timeline items={events.map((e) => ({
      title: <span className="flex flex-wrap items-center gap-2">
        <Pill xs text={e.eventType} tone="neutral" />
        <span className="text-xs text-quaternary tnum">{fmtDate(e.createdAt)}</span>
      </span>,
      body: e.detail || null,
      meta: e.actor ? e.actor.name : e.actorRole || "System",
    }))} />
  );
}
