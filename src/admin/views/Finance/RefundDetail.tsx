/* =============================================================================
   RefundDetail — one refund, start to finish: what is being returned, the
   policy check that framed it (subscription-origin only), the decision, and
   — once money has actually moved — the settlement.

   APPROVAL MOVES NO MONEY. A refund sitting at `approved` with no settlement
   is real money the company has agreed to send and has not sent, and this
   screen says so where the decision is.
   ============================================================================= */
import { useShell } from "../../shell/ShellContext";
import { can } from "../../shell/AdminShell";
import { EmptyState, KvList, Notice, Tabs, qs } from "../../ui";
import { go } from "../../ui/nav";
import { Block, Blocks, Rec } from "./Frame";
import { ActionMenu, Check, EventList, Money, OriginTag, ProtoBar, RefundPill } from "./bits";
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
  const deciding = r.state === "requested";

  const done = (msg: string, tone?: string) => { closeLayer(); toast(msg, tone); };
  const openDecide = (verdict: "approve" | "decline") =>
    modal(<DecideRefundModal r={r} verdict={verdict} onClose={closeLayer} onDone={done} />);
  const openRecord = () => modal(<RecordTransferModal r={r} onClose={closeLayer} onDone={done} />);

  /* ONE MENU, NOT A ROW OF BUTTONS. The header carried Send back, Decline and
     Approve side by side — three verdicts competing for the same glance, with
     the destructive one and the ordinary one the same size, and a fourth button
     appearing in their place once the refund was approved. Everything a request
     can have done to it is behind the one control now, and which items are on
     it is decided by the state rather than by which buttons happen to render.

     DISABLED RATHER THAN HIDDEN without Super Admin: somebody who cannot see
     the action cannot ask for it either. */
  const saTitle = sa ? undefined : "Deciding a refund is Super Admin only.";
  const actions = writable ? (
    <ActionMenu forWhat={r.refundId} items={[
      deciding && { icon: "check", label: "Approve", act: () => openDecide("approve"),
        tone: "pri", disabled: !sa, title: saTitle },
      deciding && { icon: "x", label: "Decline", act: () => openDecide("decline"),
        tone: "dgr", disabled: !sa, title: saTitle },
      r.state === "approved" && { icon: "cash", label: "Record the transfer", act: openRecord, tone: "pri" },
      !deciding && r.state !== "approved" && { icon: "check", label: "Decided", act: () => {},
        disabled: true,
        title: r.state === "paid" ? "It is paid." : "It was declined — no transfer will be made." },
    ]} />
  ) : null;

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
                <b>No original payment behind this refund.</b> The detail above is the evidence,
                and the absence is why there is no policy check.
              </>} />
            )}
          </Block>

          {r.origin === "subscription" && r.policy ? (
            <Block title="The policy check"
              desc={"Frozen at request time. It frames the approval; it never blocks it"}>
              <div className="fin-chks">
                <Check ok={r.policy.groundPermitted} warn={!r.policy.groundPermitted}>
                  {r.policy.groundPermitted
                    ? <>The ground — {groundMeta(r.ground)?.label || r.ground} — is on the permitted list.</>
                    : <>The ground — {groundMeta(r.ground)?.label || r.ground} — is <b>not</b> a
                        permitted ground. It reaches the approver as an exception.</>}
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
                <b>{inr(r.amountPaise)} has NOT moved.</b> Approval authorised the transfer. Send it
                from the bank, then record it here — only that makes this refund <b>paid</b>.
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
