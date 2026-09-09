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
import { Alert, Button, Card, EmptyState, KvList, Tabs, qs } from "../../ui";
import { go } from "../../ui/nav";
import { Blocks, Rec } from "./Frame";
import { ActionMenu, Check, EventList, Fine, Money, OriginTag, ProtoBar, RefundPill } from "./bits";
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
      <div className="flex min-w-0 flex-col gap-4">
        <ProtoBar />
        <EmptyState icon="search" title="No refund at that address"
          body={<>There is no request for <span className="font-mono tnum">{id}</span>.</>}
          action={<Button color="primary" onClick={() => go(back)}>Back to Refunds</Button>} />
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
    <Rec id={r.refundId} pills={<><RefundPill k={r.state} lg /><OriginTag k={r.origin} /></>}
      sub={<>{r.payee.name} · {groundMeta(r.ground)?.label || r.ground} · requested {ago(r.requestedAt)}</>}
      back={back} actions={actions}>

      <Tabs items={[
        { k: "refund", label: "Refund" },
        { k: "history", label: "History", n: r.events.length, quiet: true },
      ]} cur={tab} onPick={(k) => onParams({ tab: k === "refund" ? undefined : k })} />

      {tab === "history" ? (
        <Card title="History" sub="append-only · every event on this request">
          <EventList events={r.events} />
        </Card>
      ) : (
        <Blocks>
          <Card title="What is being returned">
            <KvList pairs={[
              ["Amount", <Money key="amt" paise={r.amountPaise} strong />],
              ["Ground", <>{groundMeta(r.ground)?.label || r.ground}
                <Fine className="mt-1">{groundMeta(r.ground)?.help}</Fine></>],
              ["Detail", r.detail],
              ["Payee", r.payee.name + (r.payee.userId ? " · " + r.payee.userId : "")],
              ["Origin", <OriginTag key="or" k={r.origin} />],
            ]} />

            {r.origin === "subscription" ? (
              row.payment ? (
                <div className="mt-4 border-t border-secondary pt-4">
                  <h4 className="label-mono mb-2">The payment it reverses</h4>
                  <KvList pairs={[
                    ["Original payment", <span className="font-mono tnum">{row.payment.paymentId}</span>],
                    ["Reference", <span className="font-mono tnum">{row.payment.reference}</span>],
                    ["Value date", fmtDate(row.payment.valueDate)],
                    ["Subscription", r.subscriptionId
                      ? <a href={"#/finance/" + r.subscriptionId} data-go={"#/finance/" + r.subscriptionId}
                          className="rounded font-mono text-sm text-brand-secondary outline-focus-ring tnum hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                          onClick={(e) => { e.preventDefault(); go("#/finance/" + r.subscriptionId); }}>
                          {r.subscriptionId}
                        </a>
                      : "—"],
                  ]} />
                </div>
              ) : (
                <Alert tone="bad" className="mt-4">
                  The original payment {r.paymentId} is no longer in the ledger.
                </Alert>
              )
            ) : (
              <Alert tone="info" className="mt-4" title="No original payment behind this refund.">
                The detail above is the evidence, and the absence is why there is no policy check.
              </Alert>
            )}
          </Card>

          {r.origin === "subscription" && r.policy ? (
            <Card title="The policy check"
              sub="Frozen at request time. It frames the approval; it never blocks it.">
              <div className="flex flex-col">
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
            </Card>
          ) : null}

          <Card title="The decision" className="lg:col-span-2">
            {r.decidedBy ? (
              <KvList pairs={[
                ["Decided by", r.decidedBy + " · " + (r.decidedAt ? fmtDateTime(r.decidedAt) : "—")],
                ["Note", r.decisionNote || <span className="text-quaternary">No note.</span>],
              ]} />
            ) : (
              <Fine>Not yet decided. {deciding ? "Waiting on Super Admin." : ""}</Fine>
            )}

            {r.state === "approved" && !r.settlement ? (
              <Alert tone="warn" className="mt-4"
                title={inr(r.amountPaise) + " has NOT moved."}>
                Approval authorised the transfer. Send it from the bank, then record it here — only
                that makes this refund <b>paid</b>.
              </Alert>
            ) : null}

            {r.state === "paid" && r.settlement ? (
              <KvList cls="mt-4" pairs={[
                ["Paid", fmtDateTime(r.settlement.paidAt)],
                ["Mode", r.settlement.mode],
                ["Reference", <span className="font-mono tnum">{r.settlement.reference}</span>],
                ["From account", accountOf(r.settlement.accountId)?.masked || r.settlement.accountId],
                ["Recorded by", r.settlement.by],
              ]} />
            ) : null}
          </Card>
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
