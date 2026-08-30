/* =============================================================================
   RefundDetail — one refund, start to finish: what is being returned, the
   policy check that framed it (subscription-origin only), the decision, and
   — once money has actually moved — the settlement.

   APPROVAL MOVES NO MONEY. A refund sitting at `approved` with no settlement
   is real money the company has agreed to send and has not sent, and this
   screen says so before it says anything else about the decision.
   ============================================================================= */
import { useShell } from "../../shell/ShellContext";
import { can } from "../../shell/AdminShell";
import { EmptyState, KvList, Notice, Tabs, qs } from "../../ui";
import { go } from "../../ui/nav";
import { Block, Blocks, Rec } from "./Frame";
import { Check, EventList, Money, OriginTag, ProtoBar, RefundPill } from "./bits";
import {
  DecideRefundModal, RecordTransferModal,
} from "./RefundModals";
import {
  REFUND_POLICY, accountOf, ago, fmtDate, fmtDateTime, groundMeta, inr, isSuperAdmin, useRefund,
} from "./store";
import type { Params } from "./store";

export default function RefundDetail({ id, p, onParams }: {
  id: string; p: Params; onParams: (patch: Params) => void;
}) {
  const { toast, modal, closeLayer } = useShell();
  const row = useRefund(id);
  const tab = p.tab || "refund";
  const back = backHash(p);

  if (!row) {
    return (
      <div className="fin-rec">
        <ProtoBar />
        <EmptyState icon="search" title="No refund at that address"
          body={<>There is no request for <span className="mono">{id}</span>.</>}
          action={<button className="btn pri" onClick={() => go(back)}>Back to Refunds</button>} />
      </div>
    );
  }

  const r = row.r;
  const writable = can("finance-refunds", "edit");
  const sa = isSuperAdmin();
  const deciding = r.state === "requested" || r.state === "sent_back";

  const done = (msg: string, tone?: string) => { closeLayer(); toast(msg, tone); };
  const openDecide = (verdict: "approve" | "send_back" | "decline") =>
    modal(<DecideRefundModal r={r} initial={verdict} onClose={closeLayer} onDone={done} />);
  const openRecord = () => modal(<RecordTransferModal r={r} onClose={closeLayer} onDone={done} />);

  const saTitle = sa ? undefined : "Deciding a refund is Super Admin only.";
  const actions = (
    <>
      {deciding && writable ? (
        <>
          <button className="btn sm" disabled={!sa} title={saTitle} onClick={() => openDecide("send_back")}>Send back</button>
          <button className="btn sm dgr" disabled={!sa} title={saTitle} onClick={() => openDecide("decline")}>Decline</button>
          <button className="btn sm pri" disabled={!sa} title={saTitle} onClick={() => openDecide("approve")}>Approve</button>
        </>
      ) : null}
      {r.state === "approved" && writable ? (
        <button className="btn sm pri" onClick={openRecord}>Record the transfer</button>
      ) : null}
    </>
  );

  return (
    <Rec id={r.refundId} pills={<RefundPill k={r.state} lg />} back={back} actions={actions}>
      <div className="fin-subline">
        <OriginTag k={r.origin} />
        {" "}{r.payee.name} · {groundMeta(r.ground)?.label || r.ground} · requested {ago(r.requestedAt)}
      </div>

      <Tabs items={[
        { k: "refund", label: "Refund" },
        { k: "history", label: "History", n: r.events.length },
      ]} cur={tab} onPick={(k) => onParams({ tab: k === "refund" ? undefined : k })} />

      {tab === "history" ? <EventList events={r.events} /> : (
        <Blocks>
          <Block title="What is being returned">
            <KvList pairs={[
              ["Amount", <Money key="amt" paise={r.amountPaise} strong />],
              ["Ground", <>{groundMeta(r.ground)?.label || r.ground}
                <div className="fin-fine">{groundMeta(r.ground)?.help}</div></>],
              ["Detail", r.detail],
              ["Payee", r.payee.name + (r.payee.userId ? " · " + r.payee.userId : "")],
              ["Origin", <OriginTag key="or" k={r.origin} />],
            ]} />

            {r.origin === "subscription" ? (
              row.payment ? (
                <div className="fin-chain" style={{ marginTop: "var(--space-4)" }}>
                  <div className="seg"><span className="k">Original payment</span>
                    <span className="v mono">{row.payment.paymentId}</span></div>
                  <span className="arw">→</span>
                  <div className="seg"><span className="k">Reference</span>
                    <span className="v mono">{row.payment.reference}</span></div>
                  <span className="arw">→</span>
                  <div className="seg"><span className="k">Value date</span>
                    <span className="v">{fmtDate(row.payment.valueDate)}</span></div>
                  {r.subscriptionId ? (
                    <div className="seg cap">
                      <a className="v mono" data-go={"#/finance/" + r.subscriptionId}
                        onClick={() => go("#/finance/" + r.subscriptionId)}>{r.subscriptionId}</a>
                    </div>
                  ) : null}
                </div>
              ) : (
                <Notice tone="bad" text={<>The original payment {r.paymentId} is no longer in the ledger.</>} />
              )
            ) : (
              <Notice tone="info" text={<>
                <b>There is no original payment behind this refund.</b> It never became a subscription
                installment, so there is nothing in the ledger to point at either way — the detail
                above <b>is</b> the evidence: what arrived, when, and how it is known. That absence is
                exactly why this request carries no policy check.
              </>} />
            )}
          </Block>

          {r.origin === "subscription" && r.policy ? (
            <Block title="The policy check"
              desc={"Computed once, at request time, and frozen"}>
              <div className="fin-chks">
                <Check ok={r.policy.groundPermitted} warn={!r.policy.groundPermitted}>
                  {r.policy.groundPermitted
                    ? <>The ground — {groundMeta(r.ground)?.label || r.ground} — is on the permitted list.</>
                    : <>The ground — {groundMeta(r.ground)?.label || r.ground} — is <b>not</b> a permitted ground.
                        It still reaches the approver, marked as an exception: hard-blocking every
                        unlisted ground would mean a genuine case could never be processed.</>}
                </Check>
                <Check ok={r.policy.withinWindow}>
                  {r.policy.withinWindow
                    ? <>The original payment falls inside the {REFUND_POLICY.windowDays}-day window.</>
                    : <>The original payment is outside the {REFUND_POLICY.windowDays}-day window.</>}
                </Check>
                <Check ok={r.policy.originalRecorded}>
                  {r.policy.originalRecorded
                    ? <>The original payment is in the ledger.</>
                    : <>No original payment could be found in the ledger.</>}
                </Check>
                <Check ok={r.policy.subscriptionActive}>
                  {r.policy.subscriptionActive
                    ? <>The subscription is active.</>
                    : <>The subscription is not active.</>}
                </Check>
              </div>
              <p className="fin-fine">
                Frozen at the moment the request was made, so the approver sees exactly what the
                requester saw. These checks frame the approval — none of them blocks it.
              </p>
            </Block>
          ) : null}

          <Block title="The decision" wide>
            {r.decidedBy ? (
              <KvList pairs={[
                ["Decided by", r.decidedBy + " · " + (r.decidedAt ? fmtDateTime(r.decidedAt) : "—")],
                ["Note", r.decisionNote || <span className="faint">No note.</span>],
              ]} />
            ) : (
              <p className="fin-fine">Not yet decided. {deciding ? "Waiting on Super Admin." : ""}</p>
            )}

            {r.state === "approved" && !r.settlement ? (
              <Notice tone="warn" text={<>
                <b>{inr(r.amountPaise)} has NOT moved.</b> Approval authorised the transfer; it did not
                make one. Send it from the bank, then record the transfer here with its reference —
                only that write makes this refund <b>paid</b>.
              </>} />
            ) : null}

            {r.state === "paid" && r.settlement ? (
              <KvList pairs={[
                ["Paid", fmtDateTime(r.settlement.paidAt)],
                ["Mode", r.settlement.mode],
                ["Reference", <span className="mono">{r.settlement.reference}</span>],
                ["From account", accountOf(r.settlement.accountId)?.masked || r.settlement.accountId],
                ["Recorded by", r.settlement.by],
              ]} />
            ) : null}
          </Block>
        </Blocks>
      )}
    </Rec>
  );
}

/* -------------------------------------------------------------------------- */

function backHash(p: Params): string {
  const q: Record<string, string> = {};
  Object.keys(p).forEach((k) => { if (p[k] && k !== "tab") q[k] = p[k] as string; });
  return "#/finance-refunds" + qs(q);
}
