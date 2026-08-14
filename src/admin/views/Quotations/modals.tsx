/* =============================================================================
   Quotation — the modals
   -----------------------------------------------------------------------------
   Principle 2, verbatim: every modal states the rule BEFORE you commit, and
   prints the server code if it still rejects. The prototype's `#qtErr` slot —
   an empty div it wrote innerHTML into — is local state here; nothing else
   about any of these dialogs moved.
   ============================================================================= */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { Field, Icon, KvList, Notice } from "../../ui";
import { D, Q, actor, inr, val } from "./core";
import type { QtCtx, Res } from "./core";

/* The prototype's errSlot() + modalErr(): the box exists before there is
   anything to put in it, so the dialog does not jump when a call is refused. */
function ErrSlot({ r }: { r: Res | null }) {
  if (!r) return <div id="qtErr" />;
  return (
    <div id="qtErr">
      <Notice tone="bad" text={
        <>
          <b>{r.http} <span className="mono">{r.code}</span></b>
          <div style={{ marginTop: "3px" }}>{r.detail}</div>
        </>
      } />
    </div>
  );
}

function Close({ ctx }: { ctx: QtCtx }) {
  return <button className="md-x" data-close="1" onClick={ctx.closeLayer}><Icon name="x" /></button>;
}

/* ========================================================== CHANGE PLAN === */
export function PlanModal({ ref_, ctx }: { ref_: string; ctx: QtCtx }) {
  const [err, setErr] = useState<Res | null>(null);
  const plan = Q.planOf(ref_);

  const goPlan = () => {
    const picked = document.querySelector('input[name="planPick"]:checked') as HTMLInputElement | null;
    if (!picked) return setErr({ http: 400, code: "validation_failed", detail: "Choose a plan." });
    /* The duration chosen INSIDE the picked tier. Each tier carries its own
       radio group, so switching between tiers does not lose the length you
       had already chosen on the one you come back to. */
    const dur = document.querySelector('input[name="planDur-' +
      picked.value.replace(/"/g, '\\"') + '"]:checked') as HTMLInputElement | null;
    const q = Q.quoteOf(ref_);
    const r: Res = Q.Draft.setPlan(ref_, {
      name: picked.value,
      plan_months: dur ? parseInt(dur.value, 10) : undefined,
      row_version: q.row_version
    }, actor());
    if (r.ok === false) return setErr(r);
    ctx.done("Plan imported — price, discount, term and features snapshotted.",
      "#/quotations/" + ref_ + "?mode=edit");
  };

  return (
    <>
      <div className="md-h"><h3>Change plan</h3><p>Single select — choosing another tier swaps it</p>
        <Close ctx={ctx} /></div>
      <div className="md-b">
        <ErrSlot r={err} />
        {Q.planNames().map((n: string) => {
          const on = !!(plan && plan.name === n);
          /* Each tier shows the numbers that picking it will write — because
             "which plan" and "what does it cost" are one question, and
             answering only the first is why the amount had to be looked up
             somewhere else and typed in by hand. */
          const c = Q.catalogueOf(n) || {};
          const durs = c.durations || [{
            months: c.term_months, final_paise: c.total_paise,
            discount_type: c.discount_type, discount_value: c.discount_value,
            installments: c.installments, gap_months: c.gap_months
          }];
          /* Which duration is pre-selected: the one already on the quotation if
             this is the plan it already carries, otherwise the tier's longest —
             its headline term. */
          const pick = on && plan.term_months ? plan.term_months : durs[durs.length - 1].months;
          return (
            <label className={"check planpick" + (on ? " on" : "")} key={n}>
              <input type="radio" name="planPick" value={n} defaultChecked={on} />
              <span><b>{n}</b>
                {c.blurb ? <> <span className="faint">· {c.blurb}</span></> : null}
                {/* DURATION IS A CHOICE NOW, not a property of the tier. One plan
                    sells at three lengths at three prices, so the duration and the
                    amount have to be picked together — showing only the headline
                    term and letting the agent retype the rest is exactly the manual
                    re-entry the catalogue exists to remove. */}
                <div className="planpick-durs" role="radiogroup" aria-label="Duration">
                  {durs.map((d: any) => (
                    <label className={"planpick-dur" + (d.months === pick ? " on" : "")} key={d.months}>
                      <input type="radio" name={"planDur-" + n} value={d.months} defaultChecked={d.months === pick} />
                      <b>{d.months}m</b>
                      {/* A free tier says "Free". "₹0" reads as a price nobody
                          filled in, and the catalogue renders it the same way. */}
                      <span className="tnum">{d.final_paise ? inr(d.final_paise) : "Free"}</span>
                      {d.discount_value
                        ? <span className="planpick-off">−{d.discount_value}{d.discount_type === "amt" ? "₹" : "%"}</span>
                        : null}
                      {d.final_paise
                        ? <span className="planpick-pm tnum">{inr(d.months ? Math.round(d.final_paise / d.months) : 0)}/mo</span>
                        : null}
                    </label>
                  ))}
                </div>
                <div className="help" style={{ marginTop: "5px" }}>
                  {Q.featuresFor(n).slice(0, 5).map((f: any) => f.label).join(" · ")}
                  {" · +" + Math.max(0, Q.featuresFor(n).length - 5) + " more"}
                </div>
              </span>
            </label>
          );
        })}
        <Notice ico="check" text={
          <><b>Picking a tier and a length fills the amount, the discount and the installments</b> —
            all of them, from the catalogue, at the price that tier is set to today. Every one stays
            editable underneath: this is where a negotiation starts, not what it has to end at.{" "}
            <b>The numbers are copied, not linked</b> — a later change to the plan cannot move this
            quotation.</>} />
        <Notice ico="shield" text={
          <><b>Change plan, not add plan.</b> We sell one subscription per quotation, so the one-plan
            rule is enforced by the interaction rather than by a validation message. Two plans for one
            customer means two quotations — which keeps the value that flows back to the deal on
            acceptance unambiguous.</>} />
      </div>
      <div className="md-f"><span className="spacer"></span>
        <button className="btn" data-close="1" onClick={ctx.closeLayer}>Cancel</button>
        <button className="btn pri" data-act="qt-plan-go" data-ref={ref_} onClick={goPlan}>Change plan</button>
      </div>
    </>
  );
}

/* =============================================================== ISSUE === */
export function IssueModal({ ref_, ctx }: { ref_: string; ctx: QtCtx }) {
  const [err, setErr] = useState<Res | null>(null);
  const q = Q.quoteOf(ref_);
  const blockers = Q.Issuance.blockers(ref_);
  const parent = q.parent_quotation_id ? Q.quoteOf(q.parent_quotation_id) : null;

  const goIssue = () => {
    const r: Res = Q.Issuance.issue(ref_, actor());
    if (r.ok === false) return setErr(r);
    Q.drain();                                   // deliver the outbox to Module 1
    ctx.done("Issued as " + r.data.quotation.quotation_number +
      (r.data.superseded ? " · " + r.data.superseded + " superseded" : "") +
      ". The deal timeline has the event.", "#/quotations/" + r.data.quotation.quotation_id);
  };

  return (
    <>
      <div className="md-h"><h3>Issue quotation</h3><p>v{q.version} · {inr(q.grand_total_paise)}</p>
        <Close ctx={ctx} /></div>
      <div className="md-b">
        <ErrSlot r={err} />
        {blockers.length
          ? <Notice tone="bad" text={
              <><b>These must be fixed first</b>
                <ul style={{ margin: "6px 0 0 16px" }}>
                  {blockers.map((b: any) => <li key={b.code}>{b.text} <span className="mono">422 {b.code}</span></li>)}
                </ul></>} />
          : <Notice tone="ok" ico="check" text={
              <><b>Validation passed.</b> A plan with a term of {(Q.planOf(ref_) || {}).term_months} months,
                totals that reconcile, and a validity date in the future.</>} />}
        <div style={{ height: "12px" }}></div>
        <KvList cls="wide" pairs={[
          ["Number", <span className="faint">assigned by this transaction</span>],
          ["Version", "v" + q.version],
          ["Grand total", <b>{inr(q.grand_total_paise)}</b>],
          ["Valid until", D.fmtDate(q.valid_until)]
        ]} />
        <div style={{ height: "12px" }}></div>
        <Notice tone="warn" ico="lock" text={
          <><b>Once issued, this quotation cannot be edited.</b> Changes after this create a revision.
            Five steps commit as one — recalculate, assign the number and version, freeze the content
            and the customer snapshot, write the document, append the event — or none of them do, and
            the number is returned so the sequence has no unexplained gaps.</>} />
        {q.parent_quotation_id
          ? <Notice ico="history" text={
              <>This is a revision. <b>{(parent || {}).quotation_number || "The previous version"} becomes
                Superseded only after this issue succeeds</b> — never before.</>} />
          : null}
      </div>
      <div className="md-f"><span className="spacer"></span>
        <button className="btn" data-close="1" onClick={ctx.closeLayer}>Cancel</button>
        <button className="btn pri" data-act="qt-issue-go" data-ref={ref_} onClick={goIssue}>Issue quotation</button>
      </div>
    </>
  );
}

/* ============================================================== ACCEPT === */
export function MarkAcceptedModal({ ref_, ctx }: { ref_: string; ctx: QtCtx }) {
  const [err, setErr] = useState<Res | null>(null);
  const q = Q.quoteOf(ref_);
  const blockers = Q.Acceptance.guards(ref_);
  const over = (q.discount_pct || 0) > 30;

  const goAccept = () => {
    const r: Res = Q.Acceptance.accept(ref_, actor());
    if (r.ok === false) return setErr(r);
    const d = Q.drain();
    ctx.done("Accepted. " + inr(r.data.grand_total_paise) + " written to " + r.data.deal_id +
      (d.failed ? " — write-back pending, the outbox will retry." : " by the outbox."),
      "#/quotations/" + r.data.quotation_id);
  };

  return (
    <>
      <div className="md-h"><h3>Mark accepted</h3><p>{q.quotation_number} · v{q.version}</p>
        <Close ctx={ctx} /></div>
      <div className="md-b">
        <ErrSlot r={err} />
        {/* These stopped being blockers. Every one of them is a thing worth
            knowing before you press the button and none of them is a reason the
            button should not exist — see Acceptance.guards. Read them, then
            decide; the engine will not decide for you. */}
        {blockers.length ? (
          <>
            <Notice tone={blockers.some((b: any) => b.tone === "warn") ? "warn" : ""} text={
              <><b>Worth knowing first</b>
                <ul style={{ margin: "6px 0 0 16px" }}>
                  {blockers.map((b: any) => <li key={b.code}>{b.text}</li>)}
                </ul></>} />
            <div style={{ height: "12px" }}></div>
          </>
        ) : null}
        <Notice tone="ok" ico="check" text={
          <><b>This writes {inr(q.grand_total_paise)} to {q.deal_id} as the agreed deal value</b>, and{" "}
            {q.discount_pct || 0}% as the accepted discount.
            {over ? <> Because that is above 30%, <b>Module 1</b> will set{" "}
              <span className="mono">is_target2_eligible = false</span> — a Module 1 rule, applied by
              Module 1, on data this module supplies.</> : null}{" "}
            <b>Raise invoice appears in the deal at that moment.</b></>} />
        <Notice ico="alert" text={
          <><b>It does not close the deal.</b> Closed-Won still requires the balance collected —
            acceptance is a promise, the ledger is money. This module has no write path to the payment
            ledger at all.</>} />
        <Notice ico="link" text={
          <>The write-back travels by <b>transactional outbox</b>, not a direct call: acceptance and
            the enqueue commit together, and delivery is at-least-once keyed on{" "}
            <span className="mono">(aggregate_id, event_type)</span> so a replay is a no-op. A
            cross-module call inside a transaction would hold a row lock across a network timeout.</>} />
      </div>
      <div className="md-f"><span className="spacer"></span>
        <button className="btn" data-close="1" onClick={ctx.closeLayer}>Cancel</button>
        <button className="btn pri" data-act="qt-accept-go" data-ref={ref_} onClick={goAccept}>Mark accepted</button>
      </div>
    </>
  );
}

/* ============================================================== REJECT === */
export function MarkRejectedModal({ ref_, ctx }: { ref_: string; ctx: QtCtx }) {
  const [err, setErr] = useState<Res | null>(null);
  const q = Q.quoteOf(ref_);

  const goReject = () => {
    const r: Res = Q.Acceptance.reject(ref_, val("rjReason"), actor());
    if (r.ok === false) return setErr(r);
    ctx.done("Marked rejected.", "#/quotations/" + ref_);
  };

  return (
    <>
      <div className="md-h"><h3>Mark rejected</h3><p>{q.quotation_number}</p><Close ctx={ctx} /></div>
      <div className="md-b">
        <ErrSlot r={err} />
        <Field id="rjReason" label="Reason" type="textarea" ph="Optional — chose a competitor on price."
          help="Free text in v1. Structuring it into reason codes is future scope." />
        <Notice ico="alert" text={
          <><b>Rejected is terminal</b>, and it does <b>not</b> touch the parent deal. Whether a
            rejected proposal moves the deal stage is a Module 1 decision, not this one. A new
            quotation or a revision may follow; this row is never reopened.</>} />
      </div>
      <div className="md-f"><span className="spacer"></span>
        <button className="btn" data-close="1" onClick={ctx.closeLayer}>Cancel</button>
        <button className="btn dgr" data-act="qt-reject-go" data-ref={ref_} onClick={goReject}>Mark rejected</button>
      </div>
    </>
  );
}

/* ============================================================== REVISE === */
export function ReviseModal({ ref_, ctx }: { ref_: string; ctx: QtCtx }) {
  const [err, setErr] = useState<Res | null>(null);
  const q = Q.quoteOf(ref_);
  const accepted = q.status === Q.ST.ACCEPTED;

  const goRevise = () => {
    const r: Res = Q.Issuance.revise(ref_, actor());
    if (r.ok === false) return setErr(r);
    if (r.data.reused) { ctx.closeLayer(); return ctx.go("#/quotations/" + r.data.quotation_id + "?mode=edit"); }
    ctx.done("v" + r.data.version + " created as a Draft.", "#/quotations/" + r.data.quotation_id + "?mode=edit");
  };

  return (
    <>
      <div className="md-h"><h3>Revise {accepted ? "an accepted quotation" : "quotation"}</h3>
        <p>from {q.quotation_number || "draft"} v{q.version}</p><Close ctx={ctx} /></div>
      <div className="md-b">
        <ErrSlot r={err} />
        <Notice ico="history" text={
          <><b>{q.quotation_number} stays exactly as the customer received it.</b> This creates{" "}
            <b>v{q.version + 1} as a new Draft</b>, cloned from it — header and line items — and
            linked by <span className="mono">parent_quotation_id</span>.</>} />
        {q.status === Q.ST.ISSUED
          ? <Notice tone="warn" ico="clock" text={
              <>While the revision sits in Draft, <b>{q.quotation_number} is still the current proposal
                and is still acceptable</b>. It becomes Superseded only after the revision has
                successfully issued.</>} />
          : null}
        {/* The case that used to be impossible, said plainly. */}
        {accepted
          ? <Notice ico="shield" text={
              <><b>The acceptance on {q.quotation_number || "this version"} stands until the revision is
                issued and accepted in its turn.</b> Nothing is undone by starting this: the deal keeps
                the value it already agreed, and if the customer does not take the new terms you simply
                cancel the draft and everything is where it was.</>} />
          : null}
        <Notice ico="shield" text={
          <>An abandoned revision can be cancelled. It consumes no quotation number, so nothing
            dangles.</>} />
      </div>
      <div className="md-f"><span className="spacer"></span>
        <button className="btn" data-close="1" onClick={ctx.closeLayer}>Cancel</button>
        <button className="btn pri" data-act="qt-revise-go" data-ref={ref_} onClick={goRevise}>Create revision</button>
      </div>
    </>
  );
}

/* ======================================================== CANCEL DRAFT === */
export function CancelDraftModal({ ref_, ctx }: { ref_: string; ctx: QtCtx }) {
  const [err, setErr] = useState<Res | null>(null);
  const q = Q.quoteOf(ref_);

  const goCancel = () => {
    const r: Res = Q.Draft.cancel(ref_, actor());
    if (r.ok === false) return setErr(r);
    ctx.done("Draft cancelled. No number was consumed.", "#/quotations");
  };

  return (
    <>
      <div className="md-h"><h3>Cancel draft</h3><p>v{q.version}</p><Close ctx={ctx} /></div>
      <div className="md-b">
        <ErrSlot r={err} />
        <Notice ico="shield" text={
          <><b>This consumes no quotation number</b> — the sequence is unaffected. The row is{" "}
            <b>not deleted</b>: an abandoned Draft is still part of the negotiation record, so
            Cancelled is a status rather than a disappearance.</>} />
      </div>
      <div className="md-f"><span className="spacer"></span>
        <button className="btn" data-close="1" onClick={ctx.closeLayer}>Keep it</button>
        <button className="btn dgr" data-act="qt-cancel-go" data-ref={ref_} onClick={goCancel}>Cancel draft</button>
      </div>
    </>
  );
}
