/* =============================================================================
   RefundModals — the four writes this face makes. Each is the client half of
   FN-T12…FN-T15 in store.ts: request, raise by hand, decide, and record the
   transfer that actually sends the money. Every submit renders the store's
   own refusal text inside the dialog rather than closing on a failed write.
   ============================================================================= */
import { useMemo, useState } from "react";
import { Button, Input, SelectInput, Textarea } from "../../ui";
import { Cancel, Dlg, Field, Fs, Pick, RupeeInput, toPaise } from "./dialog";
import type { Done } from "./dialog";
import { Check, Derived, Fine, Money, OriginTag, PickList, PickRow } from "./bits";
import {
  ACCOUNTS, MODES, REFUND_GROUNDS, REFUND_POLICY,
  createManualRefund, decideRefund, fmtDate, inr, readPayment, readPayments, recordRefundTransfer, refundStanding,
  refundPolicyCheck, requestRefund,
} from "./store";
import type { Refund } from "./store";

/* --------------------------------------------------------- request one --- */

/** FN-T12 · Against a recorded installment payment, full amount only. The
 *  picker IS the validation: whatever is chosen here is the whole of what
 *  gets refunded — there is no separate amount field to disagree with it. */
export function RequestRefundModal({ onClose, onDone }: { onClose: () => void; onDone: Done }) {
  /* A PAYMENT THAT ALREADY CARRIES A REFUND IS NOT OFFERED HERE. The store
     refuses the second request anyway — one payment, one refund — but a
     picker that lists a payment already sent back invites somebody to choose
     it and then reads its own refusal as a fault. Declined refunds release
     the payment, so those rows stay on the list. */
  /* Once: the dialog is a one-shot layer and the ledger cannot move under
     it, so flattening and sorting every installment on each keystroke in the
     reason box bought nothing. */
  const payments = useMemo(() => readPayments()
    .filter((hit) => !refundStanding(hit.pay.paymentId))
    .sort((a, b) => b.pay.valueDate.localeCompare(a.pay.valueDate)), []);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [ground, setGround] = useState<string>(REFUND_GROUNDS[0]?.key || "other");
  const [detail, setDetail] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const pc = paymentId ? refundPolicyCheck(paymentId, ground) : null;

  const submit = () => {
    if (!paymentId) { setErr("Pick which payment this refunds."); return; }
    const res = requestRefund(paymentId, ground, detail);
    if (res.error || !res.refundId) { setErr(res.error || "Could not raise the request."); return; }
    const amt = readPayment(paymentId)?.pay.amountPaise || 0;
    onDone(res.refundId + " requested — " + inr(amt) + " to review.", "ok");
  };

  return (
    <Dlg title="Request a refund" onClose={onClose} err={err}
      sub="Against a payment already in the ledger."
      footer={<><Cancel onClose={onClose} /><Button color="primary" onClick={submit}>Request refund</Button></>}>
      <Fs legend="Which payment" hint="Full amount only." req>
        {payments.length ? (
          <PickList>
            {payments.map((hit) => (
              <PickRow key={hit.pay.paymentId} on={hit.pay.paymentId === paymentId}
                onPick={() => setPaymentId(hit.pay.paymentId)}
                id={<>{hit.sub.customer.name} · <span className="font-mono tnum">{hit.sub.subscriptionId}</span></>}
                sub={hit.pay.reference + " · " + fmtDate(hit.pay.valueDate)}
                right={inr(hit.pay.amountPaise)} />
            ))}
          </PickList>
        ) : (
          <Fine>Nothing here to refund against — every installment payment in the ledger already carries a refund, or none is recorded yet.</Fine>
        )}
      </Fs>

      <Fs legend="Ground" req>
        <Pick value={ground} onChange={setGround}
          options={REFUND_GROUNDS.map((g) => ({ key: g.key, label: g.label, help: g.help }))} />
      </Fs>

      {pc ? (
        <div className="flex flex-col">
          <Check ok={pc.groundPermitted} warn={!pc.groundPermitted}>
            {pc.groundPermitted
              ? "Permitted ground."
              : "Not a permitted ground — still accepted. It reaches the approver marked as an exception, never blocked."}
          </Check>
          <Check ok={pc.withinWindow}>
            {pc.withinWindow
              ? "Within the " + REFUND_POLICY.windowDays + "-day window (" + pc.ageDays + " days since payment)."
              : "Outside the " + REFUND_POLICY.windowDays + "-day window (" + pc.ageDays + " days since payment)."}
          </Check>
          <Check ok={pc.originalRecorded}>{pc.originalRecorded ? "Original payment is in the ledger." : "No original payment found."}</Check>
          <Check ok={pc.subscriptionActive}>{pc.subscriptionActive ? "Subscription is active." : "Subscription is not active."}</Check>
        </div>
      ) : null}

      <Field label="Amount" help="The payment's own amount.">
        <Derived faint={!paymentId}>
          <span className="font-mono tnum">
            {paymentId ? inr(readPayment(paymentId)?.pay.amountPaise || 0) : "—"}
          </span>
        </Derived>
      </Field>

      <Field label="What happened" help="The approver reads this.">
        <Textarea rows={3} value={detail} ariaLabel="What happened" onChange={setDetail} />
      </Field>
    </Dlg>
  );
}

/* ------------------------------------------------------------ raise it --- */

/** FN-T13 · No ledger row behind it. Names its own payee and carries no
 *  policy check — an empty one would read as a check that passed. */
export function ManualRefundModal({ onClose, onDone }: { onClose: () => void; onDone: Done }) {
  const [payeeName, setPayeeName] = useState("");
  const [amount, setAmount] = useState("");
  const [ground, setGround] = useState<string>(REFUND_GROUNDS[0]?.key || "other");
  const [detail, setDetail] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    const paise = toPaise(amount);
    if (paise === null) { setErr("Enter a whole amount in rupees, above zero."); return; }
    const res = createManualRefund(payeeName, paise, ground, detail);
    if (res.error || !res.refundId) { setErr(res.error || "Could not raise the refund."); return; }
    onDone(res.refundId + " raised — " + inr(paise) + " to " + payeeName.trim() + ".", "ok");
  };

  return (
    <Dlg title="Raise a manual refund" onClose={onClose} err={err}
      sub="No ledger row behind this one."
      footer={<><Cancel onClose={onClose} /><Button color="primary" onClick={submit}>Raise refund</Button></>}>
      <Fs legend="Payee" req>
        <Field label="Name">
          <Input value={payeeName} ariaLabel="Payee name" autoFocus ph="Full name"
            onChange={setPayeeName} />
        </Field>
      </Fs>

      <Fs legend="Amount" req>
        <Field label="Amount"><RupeeInput value={amount} onChange={setAmount} /></Field>
      </Fs>

      <Fs legend="Ground" req>
        <Pick value={ground} onChange={setGround}
          options={REFUND_GROUNDS.map((g) => ({ key: g.key, label: g.label, help: g.help }))} />
      </Fs>

      <Field label="What happened" help="No ledger row sits behind this one, so this is the evidence.">
        <Textarea rows={4} value={detail} ariaLabel="What happened" onChange={setDetail} />
      </Field>
    </Dlg>
  );
}

/* -------------------------------------------------------------- decide --- */

type Verdict = "approve" | "decline";

/** FN-T14 · Super Admin, and never the requester — the store enforces both.
 *  Approval AUTHORISES a transfer; it does not move a rupee by itself.
 *
 *  THE VERDICT IS CHOSEN BEFORE THIS OPENS. It used to be picked here, from a
 *  list of three, on a dialog reached by pressing one of three buttons that
 *  each preselected one of them — so the answer was given twice and the second
 *  time could disagree with the first. The menu item decides; this asks for the
 *  note and nothing else. */
export function DecideRefundModal({ r, verdict, onClose, onDone }: {
  r: Refund; verdict: Verdict; onClose: () => void; onDone: Done;
}) {
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const approving = verdict === "approve";

  const submit = () => {
    if (!approving && !note.trim()) {
      setErr("Say why this is refused — the requester only sees this note.");
      return;
    }
    const res = decideRefund(r.refundId, verdict, note);
    if (res) { setErr(res); return; }
    onDone(r.refundId + (approving ? " approved." : " declined."), approving ? "ok" : "warn");
  };

  return (
    <Dlg title={(approving ? "Approve " : "Decline ") + r.refundId} onClose={onClose} err={err}
      sub={<><OriginTag k={r.origin} /> {r.payee.name} · <Money paise={r.amountPaise} /></>}
      footer={<><Cancel onClose={onClose} />
        <Button color={approving ? "primary" : "primary-destructive"}
          isDisabled={!approving && !note.trim()} onClick={submit}>
          {approving ? "Approve" : "Decline"}
        </Button></>}>
      <Field label="Note"
        help={approving
          ? "Optional. The requester sees it."
          : "Mandatory. The requester only sees this note."}>
        <Textarea rows={3} autoFocus value={note} ariaLabel="Note"
          onChange={(v) => { setNote(v); setErr(null); }} />
      </Field>
    </Dlg>
  );
}

/* --------------------------------------------------------- record paid --- */

/** FN-T15 · Only this write makes a refund `paid`, and only this write moves
 *  it out of "approved, not sent". */
export function RecordTransferModal({ r, onClose, onDone }: { r: Refund; onClose: () => void; onDone: Done }) {
  const activeAccounts = ACCOUNTS.filter((a) => a.active);
  const [mode, setMode] = useState<string>(MODES[0] || "NEFT");
  const [reference, setReference] = useState("");
  const [accountId, setAccountId] = useState<string>(activeAccounts[0]?.accountId || "");
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    const res = recordRefundTransfer(r.refundId, mode, reference, accountId);
    if (res) { setErr(res); return; }
    onDone(inr(r.amountPaise) + " recorded as paid to " + r.payee.name + ".", "ok");
  };

  return (
    <Dlg title={"Record the transfer — " + r.refundId} onClose={onClose} err={err}
      sub={<>Sending <Money paise={r.amountPaise} strong /> to {r.payee.name}.</>}
      footer={<><Cancel onClose={onClose} /><Button color="primary" onClick={submit}>Record transfer</Button></>}>
      <Fs legend="Mode" req>
        <Pick value={mode} onChange={setMode} options={MODES.map((m) => ({ key: m, label: m }))} />
      </Fs>
      <Field label="Reference" help="The proof the money left.">
        <Input mono value={reference} ariaLabel="Reference" ph="UTR / transaction id"
          onChange={setReference} />
      </Field>
      <Fs legend="Account" req>
        <SelectInput ariaLabel="Account" value={accountId} onChange={setAccountId}
          options={activeAccounts.map((a) => ({ v: a.accountId, l: a.name + " · " + a.masked }))} />
      </Fs>
    </Dlg>
  );
}
