/* =============================================================================
   RefundModals — the four writes this face makes. Each is the client half of
   FN-T12…FN-T15 in store.ts: request, raise by hand, decide, and record the
   transfer that actually sends the money. Every submit renders the store's
   own refusal text inside the dialog rather than closing on a failed write.
   ============================================================================= */
import { useState } from "react";
import { Notice } from "../../ui";
import { Cancel, Dlg, Field, Fs, Pick, RupeeInput, toPaise } from "./dialog";
import type { Done } from "./dialog";
import { Check, Money, OriginTag } from "./bits";
import {
  ACCOUNTS, MODES, REFUND_GROUNDS, REFUND_POLICY,
  createManualRefund, decideRefund, fmtDate, inr, readPayment, readPayments, recordRefundTransfer,
  refundPolicyCheck, requestRefund,
} from "./store";
import type { Refund } from "./store";

/* --------------------------------------------------------- request one --- */

/** FN-T12 · Against a recorded installment payment, full amount only. The
 *  picker IS the validation: whatever is chosen here is the whole of what
 *  gets refunded — there is no separate amount field to disagree with it. */
export function RequestRefundModal({ onClose, onDone }: { onClose: () => void; onDone: Done }) {
  const payments = readPayments().slice().sort((a, b) => b.pay.valueDate.localeCompare(a.pay.valueDate));
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
      sub="Against a payment already in the ledger. Finance requests it; only Super Admin can decide it."
      footer={<><Cancel onClose={onClose} /><button className="btn pri" onClick={submit}>Request refund</button></>}>
      <Fs legend="Which payment" hint="Full amount only. A partial refund would mean a partly-paid installment, and the 1:1 rule says that cannot exist." req>
        <div className="fin-pick">
          {payments.length ? payments.map((hit) => (
            <button key={hit.pay.paymentId} type="button" className={hit.pay.paymentId === paymentId ? "on" : ""}
              onClick={() => setPaymentId(hit.pay.paymentId)}>
              <span>{hit.sub.customer.name} · {hit.sub.subscriptionId}</span>
              <span className="s mono">{hit.pay.reference} · {fmtDate(hit.pay.valueDate)}</span>
              <span className="a"><Money paise={hit.pay.amountPaise} /></span>
            </button>
          )) : <p className="fin-fine">No installment payment is recorded yet — there is nothing to refund against.</p>}
        </div>
      </Fs>

      <Fs legend="Ground" req>
        <Pick value={ground} onChange={setGround}
          options={REFUND_GROUNDS.map((g) => ({ key: g.key, label: g.label, help: g.help }))} />
      </Fs>

      {pc ? (
        <div className="fin-chks">
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

      <Field label="Amount" help="Not editable — it is the payment's own amount, whichever payment is picked above.">
        <div className="inp ro tnum">{paymentId ? inr(readPayment(paymentId)?.pay.amountPaise || 0) : "—"}</div>
      </Field>

      <Field label="What happened" help="The approver reads this, and so does the audit.">
        <textarea className="inp" rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} />
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
      sub="No ledger row behind this one — a duplicate transfer, an overpayment, an order taken off-platform."
      footer={<><Cancel onClose={onClose} /><button className="btn pri" onClick={submit}>Raise refund</button></>}>
      <Notice tone="info" text={<>
        <b>There is no policy check on a manual refund.</b> It never became a subscription
        installment, so there is nothing recorded to check the ground or the window against — an
        empty check here would read as one that passed, which is worse than no check at all.
      </>} />

      <Fs legend="Payee" hint="Names who is being paid directly — there is no subscription record to link this to." req>
        <Field label="Name">
          <input className="inp" value={payeeName} onChange={(e) => setPayeeName(e.target.value)} placeholder="Full name" />
        </Field>
      </Fs>

      <Fs legend="Amount" req>
        <Field label="Amount"><RupeeInput value={amount} onChange={setAmount} /></Field>
      </Fs>

      <Fs legend="Ground" req>
        <Pick value={ground} onChange={setGround}
          options={REFUND_GROUNDS.map((g) => ({ key: g.key, label: g.label, help: g.help }))} />
      </Fs>

      <Field label="What happened"
        help="There is no ledger row behind this one, so this IS the evidence — what arrived, when, and how it is known.">
        <textarea className="inp" rows={4} value={detail} onChange={(e) => setDetail(e.target.value)} />
      </Field>
    </Dlg>
  );
}

/* -------------------------------------------------------------- decide --- */

type Verdict = "approve" | "send_back" | "decline";
const VERDICTS: { key: Verdict; label: string; help: string }[] = [
  { key: "approve", label: "Approve", help: "Authorises the transfer. Money has not moved yet." },
  { key: "send_back", label: "Send back", help: "Return it to the requester with what is missing." },
  { key: "decline", label: "Decline", help: "No transfer will ever be made against this request." },
];

/** FN-T14 · Super Admin, and never the requester — the store enforces both.
 *  Approval AUTHORISES a transfer; it does not move a rupee by itself. */
export function DecideRefundModal({ r, initial, onClose, onDone }: {
  r: Refund; initial?: Verdict; onClose: () => void; onDone: Done;
}) {
  const [verdict, setVerdict] = useState<Verdict>(initial || "approve");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const noteRequired = verdict !== "approve";

  const submit = () => {
    if (noteRequired && !note.trim()) {
      setErr(verdict === "decline"
        ? "Say why this is refused — the requester only sees this note."
        : "Say what is missing — the requester only sees this note.");
      return;
    }
    const res = decideRefund(r.refundId, verdict, note);
    if (res) { setErr(res); return; }
    onDone(r.refundId + " " + (verdict === "approve" ? "approved." : verdict === "send_back" ? "sent back." : "declined."),
      verdict === "approve" ? "ok" : verdict === "decline" ? "warn" : "info");
  };

  return (
    <Dlg title={"Decide — " + r.refundId} onClose={onClose} err={err}
      sub={<><OriginTag k={r.origin} /> {r.payee.name} · <Money paise={r.amountPaise} /></>}
      footer={<><Cancel onClose={onClose} />
        <button className="btn pri" onClick={submit}>
          {verdict === "approve" ? "Approve" : verdict === "send_back" ? "Send back" : "Decline"}
        </button></>}>
      <Fs legend="Verdict" req>
        <Pick value={verdict} onChange={setVerdict} options={VERDICTS} />
      </Fs>
      <div className="fin-chks">
        <Check ok>Finance requested this; only Super Admin decides it, and never the same person —
          the store refuses the write if the approver is the requester.</Check>
        <Check ok={verdict !== "approve"} warn={verdict === "approve"}>
          {verdict === "approve"
            ? "Approving authorises the transfer. It does NOT move money — record the actual transfer separately once it is made."
            : "No transfer is authorised on this verdict. Nothing moves."}
        </Check>
      </div>
      <Field label="Note"
        help={noteRequired
          ? "Mandatory — the requester only sees this note."
          : "Optional — anything the requester or a later reader should know."}>
        <textarea className="inp" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
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
      footer={<><Cancel onClose={onClose} /><button className="btn pri" onClick={submit}>Record transfer</button></>}>
      <div className="fin-chks">
        <Check ok>This is the write that makes the refund <b>paid</b>. Nothing before this moved money.</Check>
        <Check ok>It removes <Money paise={r.amountPaise} /> from "approved, not sent" the moment it is saved.</Check>
      </div>
      <Fs legend="Mode" req>
        <Pick value={mode} onChange={setMode} options={MODES.map((m) => ({ key: m, label: m }))} />
      </Fs>
      <Field label="Reference" help="The proof the money left — mandatory.">
        <input className="inp mono" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / transaction id" />
      </Field>
      <Fs legend="Account" hint="Which of ours it went out from." req>
        <select className="inp" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {activeAccounts.map((a) => <option key={a.accountId} value={a.accountId}>{a.name} · {a.masked}</option>)}
        </select>
      </Fs>
    </Dlg>
  );
}
