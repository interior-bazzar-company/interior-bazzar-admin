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
  Alert, Button, Card, DateInput, FieldRow, FormField, FormSection, Icon, IconButton, Input, Pill,
  SelectInput, Segmented, Table, Textarea, Timeline,
} from "../../ui";
import { BuilderLayout, MoneyLine, PartyStrip, ReadyLine, StepHead } from "../Quotations/bits";
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

  const dealTo = "#/deals/" + inv.dealRef;

  return (
    <>
      {err ? <Alert tone="bad" title="Could not save this invoice.">{err}</Alert> : null}

      <BuilderLayout
        form={<>
          <section className="flex min-w-0 flex-col gap-3">
            <StepHead n={1} title="Who and when" hint="the invoice's own dates, and who it is billed to" />
            <Card>
              <FormSection>
                <PartyStrip blocks={[
                  { title: "From",
                    lines: [SELLER.brand, SELLER.tagline, SELLER.addr,
                      <span key="gst" className="font-mono tnum">{SELLER.gstin ? "GSTIN " + SELLER.gstin : "CIN " + SELLER.cin}</span>] },
                  { title: "Bill to",
                    lines: [inv.billing.name || "—", inv.billing.address || "—",
                      <span key="ph" className="font-mono tnum">{inv.billing.phone || "—"}</span>],
                    foot: <Button color="link-color" size="xs" ico="ext" data-go={dealTo}
                      onClick={() => go(dealTo)}>Edit on the deal</Button> },
                ]} />
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
            <StepHead n={2} title="What you're billing"
              hint="the quotation's schedule, the plan, and anything one-off" />
            <Card flush>
              <PlanBlock inv={inv} plan={plan} />
              <AddonBlock addons={addons} busy={busy} onAdd={addAddon} onRemove={removeAddon} />
            </Card>
          </section>

          <section className="flex min-w-0 flex-col gap-3">
            <StepHead n={3} title="Payment received"
              hint="required — an invoice is raised only after the client has paid" />
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
            <StepHead n={4} title="What it says" hint="notes and terms, printed on the document" />
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
          <Summary inv={inv} plan={plan} addons={addons} taxMode={taxMode} onTaxMode={setTaxMode}
            busy={busy} onSave={save} />
        } />
    </>
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
  if (!plan) return <p className="p-5 text-sm text-tertiary">No plan block.</p>;
  const cat = plans.find((c) => planLabel(c) === plan.description);
  const feats = cat ? (cat.features || []).map((f) => (typeof f === "string" ? f : f.text)).filter(Boolean) : [];
  const preset = REMARK_PRESETS.indexOf(plan.remark || "") >= 0;
  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold text-primary">{plan.description}</div>
          <div className="mt-0.5 text-sm text-tertiary">
            From {inv.quotationNumber || "the accepted quotation"} · suggested:{" "}
            {plan.installmentCount
              ? "installment " + plan.installmentSeq + " of " + plan.installmentCount
              : "the plan's full amount"}
          </div>
          {plan.remark
            ? <div className="mt-1 flex items-center gap-1 text-xs text-tertiary">
                <Icon name="tag" size="xs" />{plan.remark}</div>
            : null}
        </div>
        <div className="shrink-0 font-mono text-display-xs font-semibold text-primary tnum">
          {inr(plan.amountPaise)}</div>
      </div>

      {feats.length
        ? <div>
            <div className="label-mono">What the plan includes</div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {feats.map((f, i) => <Pill key={i} xs text={f} tone="neutral" title={f} />)}
            </div>
            {/* Not snapshotted, unlike the prototype's copy: the line stores the
                plan NAME, and these are read live from the catalogue by it. The
                document carries the figures below, never this list. */}
            <p className="mt-1.5 text-xs text-tertiary">Read from the plan catalogue by the name on
              this line. The document carries the figures below, not these.</p>
          </div>
        : null}

      <FieldRow cols={3}>
        <FormField id="nvAmt" label="Amount ₹">
          <Input id="nvAmt" type="number" defaultValue={paiseToRupees(plan.amountPaise)} mono />
        </FormField>
        <FormField id="nvRemark" label="Remark" hint="One-click preset, or Other for anything else.">
          <SelectInput id="nvRemark" defaultValue={preset ? plan.remark || "" : "other"}
            options={REMARK_PRESETS.map((r) => ({ v: r, l: r }))
              .concat([{ v: "other", l: "Other (type below)" }])} />
        </FormField>
        <FormField id="nvRemarkOther" label="Custom remark"
          hint="Used only when Remark above is Other — mandatory in that case.">
          <Input id="nvRemarkOther" defaultValue={preset ? "" : plan.remark || ""}
            ph="e.g. Registration amount, balance payment…" />
        </FormField>
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
  const addBtn = (
    <Button color="secondary" ico="plus" data-act="in-addon-add" isDisabled={busy} onClick={onAdd}>
      Add charge</Button>
  );
  if (!addons.length) return (
    <div className="flex flex-wrap items-center gap-3 border-t border-secondary p-5">
      {addBtn}
      <span className="min-w-0 flex-1 text-sm text-tertiary">
        Onboarding, a shoot, a custom integration. <b className="font-medium text-secondary">No months
        and no quantity</b> — a one-off charge has an amount and nothing else.</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-3 border-t border-secondary p-5">
      <Table
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
      />
      <div>{addBtn}</div>
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
    <Card title="Summary" sub="display only — the server recomputes" ticks
      foot={
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Button color="primary" ico="check" block data-act="in-save-all" isLoading={busy} onClick={onSave}>
              Save changes</Button>
            <span className="text-xs text-tertiary">
              Writes the dates, the plan, the charges and the payment together.</span>
          </div>
          <ReadyLine blockers={blockers.map((b) => ({ text: b }))} verb="issue" />
        </div>
      }>
      <MoneyLine
        k={"Plan" + (plan && plan.installmentCount
          ? " · installment " + plan.installmentSeq + " of " + plan.installmentCount : "")}
        v={inr(plan ? plan.amountPaise : 0)} />
      {addons.length ? <MoneyLine k="One-off charges" v={inr(addonGross)} /> : null}
      <MoneyLine k="Subtotal" v={inr(inv.subtotalPaise)} rule />
      <MoneyLine k={applicable ? "Taxable value" : "Amount"} v={inr(inv.taxableTotalPaise)} rule />

      {/* TAX IS A DECISION ON THIS INVOICE, not a property of the customer —
          so it is a control in the figures, where its effect is visible. */}
      <div className="flex items-center justify-between gap-3 py-2">
        <span className="text-sm text-tertiary">Tax</span>
        <Segmented sm label="Tax" value={applicable ? "applicable" : "not_applicable"}
          onPick={(v2) => onTaxMode(v2 as "applicable" | "not_applicable")}
          options={[{ v: "applicable", l: "Applicable" }, { v: "not_applicable", l: "Not applicable" }]} />
      </div>

      {applicable
        ? <>
            <div className="flex items-center justify-between gap-3 py-1">
              <label htmlFor="nvGst" className="text-sm text-tertiary">GST rate</label>
              <SelectInput id="nvGst" defaultValue={String(inv.gstRate)} className="w-28"
                options={GST_RATES.map((r) => ({ v: String(r), l: r + "%" }))} />
            </div>
            {intra
              ? <>
                  <MoneyLine k={"CGST (" + inv.gstRate / 2 + "%)"} v={inr(inv.cgstPaise)} />
                  <MoneyLine k={"SGST (" + inv.gstRate / 2 + "%)"} v={inr(inv.sgstPaise)} />
                </>
              : <MoneyLine k={"IGST (" + inv.gstRate + "%)"} v={inr(inv.igstPaise)} />}
          </>
        : <p className="mt-2 text-xs text-tertiary">
            <b className="font-medium text-secondary">Tax not applicable.</b> The grand total excludes
            GST entirely — an explicit choice for this invoice.
          </p>}

      <MoneyLine k="Grand total" v={inr(inv.grandTotalPaise)} strong />
      <p className="mt-1 text-xs text-tertiary">{inrWords(inv.grandTotalPaise)}</p>

      {applicable
        ? <p className="mt-2 text-xs text-tertiary">
            {intra
              ? <><b className="font-medium text-secondary">Intra-state.</b> Place of supply is {inv.placeOfSupply},
                  the same state as Interior bazzar — so GST splits into CGST + SGST.</>
              : <><b className="font-medium text-secondary">Inter-state.</b> Place of supply is {inv.placeOfSupply || "not set"} and
                  Interior bazzar is in {SELLER.state} — so a single IGST applies.</>}
          </p>
        : null}
    </Card>
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
