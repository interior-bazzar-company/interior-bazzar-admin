/* =============================================================================
   Business Enquiries — the guard dialogs.
   -----------------------------------------------------------------------------
   Every one of these states the rule BEFORE you commit, and names the server
   code that would refuse it. That matters more here than anywhere else in the
   panel: the writes behind these buttons do not exist yet, so the dialog is
   currently the only place the contract is written down.

   The revalidation checklist in Assign is not decoration. Minutes pass between
   opening the suggestions panel and pressing Confirm, and a subscription can
   lapse or a last slot can go in that window — so eligibility is rechecked at
   confirmation, never trusted from ranking time. The real transaction does it
   under a row lock and answers 422 business_not_eligible; this dialog does it
   against the same five rules and shows the working.
   ============================================================================= */
import { useState } from "react";
import type { ReactNode } from "react";
import { Icon, Notice } from "../../ui";
import { InfoNote } from "./bits";
import {
  RULES, VOCAB, acknowledge, assign, businessById, invalidate, needsOverrideReason,
  reassign, recordOutcome, statusOf,
} from "./store";
import type { Candidate, Enquiry, MatchRun } from "./store";

/* ------------------------------------------------------------ the frame --- */
function Frame({ heading, sub, children, footer, onClose }: {
  heading: string; sub?: ReactNode; children: ReactNode; footer: ReactNode; onClose: () => void;
}) {
  return (
    <>
      <div className="md-h">
        <h3>{heading}</h3>
        {sub ? <p>{sub}</p> : null}
        <button className="md-x" data-close="1" aria-label="Close" onClick={onClose}><Icon name="x" /></button>
      </div>
      <div className="md-b">{children}</div>
      <div className="md-f"><span className="spacer"></span>{footer}</div>
    </>
  );
}

function Check({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <div className={"be-chk " + (ok ? "ok" : "bad")}>
      <span className="m"><Icon name={ok ? "check" : "alert"} size="sm" /></span>
      <div>{children}</div>
    </div>
  );
}

/* ============================================================== ASSIGN === */
/* BE-T03. Seven steps, all of it or none of it: lock the enquiry, revalidate
   hard eligibility, lock the capacity row, create the assignment, freeze rank
   / score / factors / rule_version, increment capacity, append ASSIGNED and
   enqueue delivery. */
export function AssignModal({ e, run, c, onClose, onDone }: {
  e: Enquiry; run: MatchRun; c: Candidate; onClose: () => void; onDone: (msg: string) => void;
}) {
  const b = businessById(c.businessId);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  const needsReason = needsOverrideReason(run, c.businessId);
  const top = run.eligible[0];
  const gap = top ? top.score - c.score : 0;
  const blocked = needsReason && !reason.trim();

  const subOk = !!b && b.subscription === "active";
  const statusOk = !!b && b.status === "active";
  const capOk = !!b && b.capacity.active < b.capacity.configured;
  const noActive = !e.activeAssignmentId;

  return (
    <Frame
      heading={"Assign to " + c.name}
      sub={<>Rank {c.rank} · score {c.score} · rule {run.ruleVersion}</>}
      onClose={onClose}
      footer={<>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" data-act="be-assign-go" disabled={blocked}
          onClick={() => {
            if (blocked) { setTouched(true); return; }
            assign(e.enquiryId, c.businessId, needsReason ? reason.trim() : null);
            onDone("Assigned to " + c.name + " — delivered, awaiting acknowledgement.");
          }}>
          {needsReason ? "Confirm with reason" : "Confirm assignment"}
        </button>
      </>}
    >
      <Check ok={subOk}>Subscription {subOk ? <>still <b>active</b></> : <>is <b>{b?.subscription}</b></>} — rechecked now, not at ranking time</Check>
      <Check ok={statusOk}>Account status {statusOk ? <><b>active</b></> : <><b>{b?.status}</b></>}, category and service area still match</Check>
      <Check ok={capOk}>
        Capacity {capOk ? "available" : "full"} — <b>{b?.capacity.active} of {b?.capacity.configured}</b> this {b?.capacity.period}, row locked for this transaction
      </Check>
      <Check ok={noActive}>No active assignment exists on this enquiry</Check>
      <Check ok={!needsReason}>
        {needsReason
          ? <>Rank {c.rank}, <b>{gap} points below</b> the top recommendation — a reason is required</>
          : <>Top-ranked selection — <b>no override reason needed</b></>}
      </Check>

      {needsReason ? (
        <>
          <div className="fg" style={{ marginTop: "12px" }}>
            <label htmlFor="be-ovr">Why this business instead? <span className="req">*</span></label>
            <textarea id="be-ovr" className={"inp" + (touched && !reason.trim() ? " bad" : "")} rows={3}
              placeholder="What do you know that the weight table does not?"
              value={reason} onChange={(ev) => setReason(ev.target.value)} />
            <div className="help warn">
              Stored on the assignment. This is how a weight table learns it is wrong — twenty overrides
              all saying "customer wanted local" means the location weight is too low.
            </div>
          </div>
          <div className="fg">
            <label>Rank 1 was</label>
            <input className="inp" readOnly value={top ? top.name + " · " + top.score + " · " + top.band : "—"} />
            <div className="help">Recorded alongside the choice, so the gap is auditable.</div>
          </div>
          {touched && !reason.trim()
            ? <Notice tone="bad" ico="alert" text={<><b>422 override_reason_required.</b> The threshold for "materially lower" is {RULES.overrideThreshold} points and is configurable — it is BE-OD-08, still open.</>} />
            : null}
        </>
      ) : null}

      <InfoNote ico="shield" short={<>
        Score <b>{c.score}</b>, rank <b>{c.rank}</b> and rule <span className="mono">{run.ruleVersion}</span>{" "}
        are frozen onto the assignment.
      </>}>
        This routes to exactly <b>one</b> business — never a broadcast, never a shortlist, never a
        race. The score, the rank and the full factor breakdown are <b>copied</b> rather than
        referenced, so a later profile edit or weight change cannot rewrite why this went where it
        went. Such changes affect future matching only.
      </InfoNote>
    </Frame>
  );
}

/* ============================================================ REASSIGN === */
/* BE-T04. Closes one assignment and opens another; it deletes nothing. The
   enquiry returns to Ready to Assign and walks forward again — the state
   machine has one path and reassignment uses it. */
export function ReassignModal({ e, run, onClose, onDone }: {
  e: Enquiry; run: MatchRun | null; onClose: () => void; onDone: (msg: string) => void;
}) {
  const current = e.assignments.filter((a) => a.assignmentId === e.activeAssignmentId)[0] || null;
  const options = (run?.eligible || []).filter((c) => c.businessId !== current?.businessId);
  const [pick, setPick] = useState(options[0]?.businessId || "");
  const [reason, setReason] = useState(VOCAB.reassignReasons[0]);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  const chosen = options.filter((c) => c.businessId === pick)[0] || null;
  const full = (reason + (note.trim() ? " — " + note.trim() : "")).trim();
  const blocked = !chosen || !note.trim();

  return (
    <Frame
      heading="Reassign"
      sub={current ? <>From <b>{current.businessName}</b> · assigned {current.assignedAt.slice(0, 10)}</> : undefined}
      onClose={onClose}
      footer={<>
        <button className="btn" data-close="1" onClick={onClose}>Keep current</button>
        <button className="btn pri" data-act="be-reassign-go" disabled={blocked}
          onClick={() => {
            if (blocked) { setTouched(true); return; }
            reassign(e.enquiryId, pick, full);
            onDone("Reassigned to " + chosen!.name + " — the previous assignment is closed, not deleted.");
          }}>Reassign</button>
      </>}
    >
      <Check ok>The current assignment is <b>closed, not deleted</b>.</Check>
      <Check ok><b>{current?.businessName}'s capacity is released</b> and the new business's is taken.</Check>
      <Check ok><b>Matching runs again, now.</b></Check>
      <Check ok={false}>The customer is not notified, and the first delivery is not undone.</Check>
      <InfoNote ico="lock" short={<>Nothing is overwritten.</>}>
        The closed assignment keeps its rank, score, factors and rule version, and gains{" "}
        <span className="mono">supersededAt</span> — the routing chain stays walkable in both
        directions. Capacity moves in one transaction, and the new suggestions reflect today's
        profiles and today's rule version rather than the ones from the first assignment.
      </InfoNote>

      {options.length ? (
        <div className="fg" style={{ marginTop: "12px" }}>
          <label htmlFor="be-rb">New business <span className="req">*</span></label>
          <select id="be-rb" className="inp" value={pick} onChange={(ev) => setPick(ev.target.value)}>
            {options.map((c) => (
              <option key={c.businessId} value={c.businessId}>
                {c.name} — rank {c.rank} · score {c.score} · {c.band}
              </option>
            ))}
          </select>
          <div className="help">Eligible candidates only. A business that fails a hard rule is absent from this list at any score.</div>
        </div>
      ) : (
        <Notice tone="bad" ico="alert" text={<><b>No other eligible business.</b> Reassignment has nowhere to go — this is a supply gap, and the exclusion diagnostics are the worklist for it.</>} />
      )}

      <div className="fg">
        <label htmlFor="be-rr">Reason <span className="req">*</span></label>
        <select id="be-rr" className="inp" value={reason} onChange={(ev) => setReason(ev.target.value)}>
          {VOCAB.reassignReasons.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div className="fg">
        <label htmlFor="be-rn">What happened <span className="req">*</span></label>
        <textarea id="be-rn" className={"inp" + (touched && !note.trim() ? " bad" : "")} rows={3}
          placeholder="No acknowledgement after 26 hours and two reminders…"
          value={note} onChange={(ev) => setNote(ev.target.value)} />
        <div className="help warn">
          Mandatory. A reassignment with no recorded reason is indistinguishable from a mistake six
          months later — <span className="mono">422 override_reason_required</span> without it.
        </div>
      </div>
    </Frame>
  );
}

/* ============================================================= OUTCOME === */
/* The business reports this, and it is theirs. A converted enquiry is the
   business's sale — not Interior bazzar revenue, not a Deal in Module 1, and
   never inferred as one. No amount is captured here at all, which is the
   simplest way to make that mistake impossible. */
export function OutcomeModal({ e, onClose, onDone }: {
  e: Enquiry; onClose: () => void; onDone: (msg: string) => void;
}) {
  const [outcome, setOutcome] = useState<"converted" | "not_converted">("converted");
  const reasons = VOCAB.outcomeReasons[outcome];
  const [reason, setReason] = useState(VOCAB.outcomeReasons.converted[0]);
  const [notes, setNotes] = useState("");

  const pickOutcome = (v: "converted" | "not_converted") => {
    setOutcome(v);
    setReason(VOCAB.outcomeReasons[v][0]);
  };

  return (
    <Frame
      heading="Record outcome"
      sub={<>{e.enquiryId} · reported by the assigned business</>}
      onClose={onClose}
      footer={<>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" data-act="be-outcome-go"
          onClick={() => {
            recordOutcome(e.enquiryId, outcome, reason, notes.trim());
            onDone(statusOf(outcome).label + " — capacity released.");
          }}>Record outcome</button>
      </>}
    >
      <div className="be-pick">
        {(["converted", "not_converted"] as const).map((k) => (
          <button key={k} className={"be-pick-b" + (outcome === k ? " on" : "")} onClick={() => pickOutcome(k)}>
            <b>{statusOf(k).label}</b>
            <span>{k === "converted" ? "The business won the work." : "Contacted, did not win."}</span>
          </button>
        ))}
      </div>

      <div className="fg" style={{ marginTop: "12px" }}>
        <label htmlFor="be-or">Reason <span className="req">*</span></label>
        <select id="be-or" className="inp" value={reason} onChange={(ev) => setReason(ev.target.value)}>
          {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <div className="help">
          {outcome === "not_converted"
            ? "Not Converted with a reason is worth more than Converted — it is how eligibility rules and weights get corrected."
            : "The reason list is BE-OD-10, still open, along with who may correct a business-reported outcome."}
        </div>
      </div>
      <div className="fg">
        <label htmlFor="be-on">Notes</label>
        <textarea id="be-on" className="inp" rows={3} placeholder="Optional."
          value={notes} onChange={(ev) => setNotes(ev.target.value)} />
      </div>

      <InfoNote tone="warn" ico="alert" short={<><b>The business's sale, not ours.</b></>}>
        No amount is captured on this screen, no dashboard may place it on one axis with Interior
        bazzar revenue, and no analytics rollup may infer our revenue from this column. Ours is their
        subscription, which lives in Plans.
      </InfoNote>
    </Frame>
  );
}

/* ============================================================ INVALID === */
/* Terminal with a stored reason. This state is what lets a separate quarantine
   queue not exist — a rejected submission has somewhere to live and a reason
   beside it, instead of a bare Discard that made the invalid rate impossible
   to read. */
export function InvalidateModal({ e, onClose, onDone }: {
  e: Enquiry; onClose: () => void; onDone: (msg: string) => void;
}) {
  const [reason, setReason] = useState(VOCAB.invalidReasons[0]);
  const [note, setNote] = useState("");
  const hasException = !!e.exception;

  return (
    <Frame
      heading="Mark invalid"
      sub={<>{e.enquiryId} · {e.customer.name}</>}
      onClose={onClose}
      footer={<>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn dgr" data-act="be-invalid-go"
          onClick={() => { invalidate(e.enquiryId, reason, note.trim()); onDone("Marked invalid, with a stored reason."); }}>
          Mark invalid
        </button>
      </>}
    >
      {hasException ? (
        <Notice tone="bad" ico="alert" text={<>
          <b>This enquiry is an exception, not an invalid one.</b> Nothing passed hard eligibility —
          the customer did nothing wrong and the enquiry is real, qualified and wanted. What is missing
          is <b>supply</b>. Marking it invalid hides a coverage gap inside an invalid-rate metric where
          nobody will look for it.
        </>} />
      ) : null}

      <div className="fg">
        <label htmlFor="be-ir">Reason <span className="req">*</span></label>
        <select id="be-ir" className="inp" value={reason} onChange={(ev) => setReason(ev.target.value)}>
          {VOCAB.invalidReasons.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <div className="help warn">
          Mandatory. "Discarded by ops" is not a reason — it is the absence of one, and it makes the
          invalid rate uninterpretable.
        </div>
      </div>
      <div className="fg">
        <label htmlFor="be-in">Note</label>
        <textarea id="be-in" className="inp" rows={2} placeholder="Optional detail."
          value={note} onChange={(ev) => setNote(ev.target.value)} />
      </div>

      <InfoNote ico="lock" short={<><b>Terminal.</b> There is no way back from this in v1.</>}>
        Reopening needs a controlled admin policy that does not exist yet. The record, its snapshot
        and its whole event timeline stay exactly as they are — nothing is deleted.
      </InfoNote>
    </Frame>
  );
}

/* ======================================================= ACKNOWLEDGE === */
/* Only the assigned business can acknowledge — scoped by business_id at query
   level, 403 out_of_scope for anyone else. It is exposed from this screen only
   because there is no business-side surface in this panel yet, and the dialog
   says so rather than pretending otherwise. */
export function AcknowledgeModal({ e, onClose, onDone }: {
  e: Enquiry; onClose: () => void; onDone: (msg: string) => void;
}) {
  const a = e.assignments.filter((x) => x.assignmentId === e.activeAssignmentId)[0] || null;
  return (
    <Frame
      heading="Acknowledge on the business's behalf"
      sub={a ? <>{a.businessName} · {e.enquiryId}</> : undefined}
      onClose={onClose}
      footer={<>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" data-act="be-ack-go"
          onClick={() => { acknowledge(e.enquiryId); onDone("Acknowledged."); }}>Acknowledge</button>
      </>}
    >
      <InfoNote tone="warn" ico="alert"
        short={<><b>The real system must not offer this button.</b> It exists only because this panel has no business-side surface yet.</>}>
        If Operations can acknowledge for a business, the acknowledgement metric measures Operations'
        diligence instead of the business's responsiveness, and the SLA stops meaning anything. The
        missing surface is itself a gap: there is no business-user role in the permission matrix at
        all.
        <br /><br />
        What acknowledgement is FOR: it converts <b>silence into a measurable state</b>. Without it an
        unworked enquiry and a worked one look identical from Operations, and the customer finds out
        first.
      </InfoNote>
    </Frame>
  );
}
