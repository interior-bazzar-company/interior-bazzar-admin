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
import {
  Alert, Button, FormField, FormSection, Input, ModalShell, Radio, SelectInput, Textarea,
} from "../../ui";
import { BusinessSearch, Disclose, GuardCheck, InfoNote } from "./bits";
import {
  RULES, VOCAB, assign, businessById, invalidate, needsOverrideReason,
  reassign, recordOutcome, statusOf,
} from "./store";

import type { Candidate, Enquiry, MatchRun } from "./store";

/* ============================================================== ASSIGN === */
/* BE-T03. Seven steps, all of it or none of it: lock the enquiry, revalidate
   hard eligibility, lock the capacity row, create the assignment, freeze rank
   / score / factors / rule_version, increment capacity, append ASSIGNED and
   enqueue delivery. */
export function AssignModal({ e, run, c, onClose, onDone }: {
  e: Enquiry; run: MatchRun | null; c: Candidate; onClose: () => void; onDone: (msg: string) => void;
}) {
  const b = businessById(c.businessId);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  /* NOTHING RANKED THIS ONE. Either matching has not run, or it ran and this
     business was not in the pool — an operator picked it by hand out of the
     directory. The five revalidation checks below are unchanged and matter
     more here, not less: a manual pick skips the ranking, never the gates. */
  const manual = !run || !run.eligible.some((x) => x.businessId === c.businessId);
  /* And a reason is MANDATORY on one. The reason field exists to record what
     the operator knows that the weight table does not, and a pick the weight
     table never saw at all is the case that most needs the answer written
     down. */
  const needsReason = manual || needsOverrideReason(run, c.businessId);
  const top = run ? run.eligible[0] : null;
  const gap = top ? top.score - c.score : 0;
  const blocked = needsReason && !reason.trim();

  const subOk = !!b && b.subscription === "active";
  const statusOk = !!b && b.status === "active";
  const capOk = !!b && b.capacity.active < b.capacity.configured;
  const noActive = !e.activeAssignmentId;

  return (
    <ModalShell
      title={"Assign to " + c.name}
      sub={manual
        ? <>Picked by hand · <b>not ranked</b> — no matching run put this business in the pool</>
        : <>Rank {c.rank} · score {c.score} · rule {run!.ruleVersion}</>}
      ico="route"
      tone="brand"
      onClose={onClose}
      actions={
        <>
          <Button color="secondary" data-close="1" onClick={onClose}>Cancel</Button>
          <Button color="primary" data-act="be-assign-go" isDisabled={blocked}
            onClick={() => {
              if (blocked) { setTouched(true); return; }
              assign(e.enquiryId, c.businessId, needsReason ? reason.trim() : null);
              onDone("Assigned to " + c.name + " — published to them.");
            }}>
            {needsReason ? "Confirm with reason" : "Confirm assignment"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col">
          <GuardCheck ok={subOk}>Subscription {subOk ? <>still <b>active</b></> : <>is <b>{b?.subscription}</b></>} — rechecked now, not at ranking time</GuardCheck>
          <GuardCheck ok={statusOk}>Account status {statusOk ? <><b>active</b></> : <><b>{b?.status}</b></>}, category and service area still match</GuardCheck>
          <GuardCheck ok={capOk}>
            Capacity {capOk ? "available" : "full"} — <b>{b?.capacity.active} of {b?.capacity.configured}</b> this {b?.capacity.period}, row locked for this transaction
          </GuardCheck>
          <GuardCheck ok={noActive}>No active assignment exists on this enquiry</GuardCheck>
          <GuardCheck ok={!needsReason}>
            {manual
              ? <>Nothing ranked this business — <b>a reason is required</b>, and it is the only record
                  of why this one</>
              : needsReason
                ? <>Rank {c.rank}, <b>{gap} points below</b> the top recommendation — a reason is required</>
                : <>Top-ranked selection — <b>no override reason needed</b></>}
          </GuardCheck>
        </div>

        {needsReason ? (
          <FormSection title="Why this business instead?">
            <FormField id="be-ovr" label="Your reason" req
              hint="Stored on the assignment. This is how a weight table learns it is wrong — twenty overrides all saying “customer wanted local” means the location weight is too low."
              err={touched && !reason.trim() ? "A reason is required before this can be confirmed." : undefined}>
              <Textarea id="be-ovr" rows={3} err={touched && !reason.trim()}
                ph="What do you know that the weight table does not?"
                value={reason} onChange={setReason} />
            </FormField>

            <FormField id="be-rs-top" label="Rank 1 was"
              hint="Recorded alongside the choice, so the gap is auditable.">
              <Input id="be-rs-top" readOnly
                value={top ? top.name + " · " + top.score + " · " + top.band : "—"} />
            </FormField>

            {touched && !reason.trim() ? (
              <Alert tone="bad" title="422 override_reason_required">
                The threshold for "materially lower" is {RULES.overrideThreshold} points and is
                configurable — it is BE-OD-08, still open.
              </Alert>
            ) : null}
          </FormSection>
        ) : null}

        <InfoNote ico="shield" short={manual
          ? <>No score and no rank are frozen onto this assignment.</>
          : <>
              Score <b>{c.score}</b>, rank <b>{c.rank}</b> and rule{" "}
              <span className="font-mono">{run!.ruleVersion}</span> are frozen onto the assignment.
            </>}>
          {manual ? <p>Nothing ranked it, so the assignment stores rank and score as <b>absent</b>{" "}
            rather than as zero — a zero would read as a business that scored nothing rather than one
            no run ever looked at. Your reason is what stands in their place.</p> : null}
          <p>
            This routes to exactly <b>one</b> business — never a broadcast, never a shortlist, never a
            race. The score, the rank and the full factor breakdown are <b>copied</b> rather than
            referenced, so a later profile edit or weight change cannot rewrite why this went where it
            went. Such changes affect future matching only.
          </p>
        </InfoNote>
      </div>
    </ModalShell>
  );
}

/* ============================================================ REASSIGN === */
/* BE-T04. Closes one assignment and opens another; it deletes nothing. The
   enquiry returns to Qualified and walks forward again — the state
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
  /* Open by itself when the run left nothing to choose from — which is the
     common case and used to be a dead end. With candidates present it is a way
     out for the operator who knows the business the run could not see. */
  const [searching, setSearching] = useState(!options.length);

  /* THE NAME COMES FROM THE DIRECTORY, not from the candidate list, because the
     pick may not be in the candidate list at all. `businessById` covers every
     business this panel loaded, which is the same set the search offers and a
     superset of anything a run produced. */
  const chosenName = options.filter((c) => c.businessId === pick)[0]?.name
    || businessById(pick)?.name || "";
  const full = (reason + (note.trim() ? " — " + note.trim() : "")).trim();
  const blocked = !pick || !note.trim();

  return (
    <ModalShell
      title="Reassign"
      sub={current ? <>From <b>{current.businessName}</b> · assigned {current.assignedAt.slice(0, 10)}</> : undefined}
      ico="repeat"
      tone="warning"
      onClose={onClose}
      actions={
        <>
          <Button color="secondary" data-close="1" onClick={onClose}>Keep current</Button>
          <Button color="primary" data-act="be-reassign-go" isDisabled={blocked}
            onClick={() => {
              if (blocked) { setTouched(true); return; }
              reassign(e.enquiryId, pick, full);
              onDone("Reassigned to " + chosenName + " — the previous assignment is closed, not deleted.");
            }}>Reassign</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col">
          <GuardCheck ok>The current assignment is <b>closed, not deleted</b>.</GuardCheck>
          <GuardCheck ok><b>{current?.businessName}'s capacity is released</b> and the new business's is taken.</GuardCheck>
          <GuardCheck ok={!!run}>
            {run
              ? <>The last run's candidate list is what this offers.</>
              : <>No matching run on this enquiry — there is no candidate list, only the search.</>}
          </GuardCheck>
          <GuardCheck ok={false}>The customer is not notified, and the first delivery is not undone.</GuardCheck>
        </div>

        <InfoNote ico="lock" short={<>Nothing is overwritten.</>}>
          The closed assignment keeps its rank, score, factors and rule version, and gains{" "}
          <span className="font-mono">supersededAt</span> — the routing chain stays walkable in both
          directions. Capacity moves in one transaction, and the new suggestions reflect today's
          profiles and today's rule version rather than the ones from the first assignment.
        </InfoNote>

        <FormSection title="Where it goes now">
          {options.length ? (
            <FormField id="be-rb" label="New business" req
              hint="Everything the last run found eligible. A business that fails a hard rule is absent from this list — search below if you need one anyway.">
              <SelectInput id="be-rb" value={pick} onChange={setPick}
                options={options.map((c) => ({
                  v: c.businessId,
                  l: c.name + (run?.ranked
                    ? " — rank " + c.rank + " · score " + c.score + " · " + c.band
                    : " — eligible, not ranked"),
                }))} />
            </FormField>
          ) : (
            /* NOT A DEAD END ANY MORE. This used to be a red notice and nothing
               else, which was accurate about the run and useless to the person
               holding an enquiry a business has gone quiet on: the enquiry still
               has to move, and refusing to let it just means it moves in a
               notebook. The supply gap is still stated — it is real, and the
               exclusion diagnostics are still the worklist for it — but the
               search below is the way through it today. */
            <Alert tone="warn" title="No other eligible business.">
              The last run found nobody else — a supply gap, and the exclusion diagnostics are the
              worklist for it. You can still move this enquiry by hand.
            </Alert>
          )}

          {/* THE MANUAL ROUTE, and it is the same search the suggestions panel
              offers, deliberately: reassigning to a business the run could not
              see is the same act as assigning to one, with an assignment closed
              first. Every hard gate is still rechecked server-side at the moment
              you confirm — what this skips is the ranking, not a rule. */}
          {options.length ? (
            <Disclose open={searching} onToggle={() => setSearching(!searching)}>
              …or pick any business by hand
            </Disclose>
          ) : null}
          {searching ? (
            <BusinessSearch action="Choose" picked={pick}
              excludeId={current?.businessId}
              onPick={(b) => setPick(b.businessId)} />
          ) : null}

          {pick && !options.some((c) => c.businessId === pick) ? (
            <Alert tone="warn" title={"Reassigning to " + chosenName + ", which the last run did not list."}>
              The assignment will store <b>no rank and no score</b> — your reason below is the only
              record of why this one.
            </Alert>
          ) : null}
        </FormSection>

        <FormSection title="Why">
          <FormField id="be-rr" label="Reason" req>
            <SelectInput id="be-rr" value={reason} onChange={setReason}
              options={VOCAB.reassignReasons.map((r) => ({ v: r, l: r }))} />
          </FormField>
          <FormField id="be-rn" label="What happened" req
            hint="Mandatory. A reassignment with no recorded reason is indistinguishable from a mistake six months later — 422 override_reason_required without it."
            err={touched && !note.trim() ? "422 override_reason_required — say what happened." : undefined}>
            <Textarea id="be-rn" rows={3} err={touched && !note.trim()}
              ph="Went quiet after two reminders and a call…"
              value={note} onChange={setNote} />
          </FormField>
        </FormSection>
      </div>
    </ModalShell>
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

  const pickOutcome = (v: string) => {
    const k = v as "converted" | "not_converted";
    setOutcome(k);
    setReason(VOCAB.outcomeReasons[k][0]);
  };

  return (
    <ModalShell
      title="Record outcome"
      sub={<>{e.enquiryId} · reported by the assigned business</>}
      ico="flag"
      tone="brand"
      onClose={onClose}
      actions={
        <>
          <Button color="secondary" data-close="1" onClick={onClose}>Cancel</Button>
          <Button color="primary" data-act="be-outcome-go"
            onClick={() => {
              recordOutcome(e.enquiryId, outcome, reason, notes.trim());
              onDone(statusOf(outcome).label + " — capacity released.");
            }}>Record outcome</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormSection title="What happened">
          <div className="flex flex-col gap-3">
            {(["converted", "not_converted"] as const).map((k) => (
              <Radio key={k} id={"be-oc-" + k} name="be-outcome" value={k}
                checked={outcome === k}
                label={statusOf(k).label}
                hint={k === "converted" ? "The business won the work." : "Contacted, did not win."}
                onChange={pickOutcome} />
            ))}
          </div>
        </FormSection>

        <FormField id="be-or" label="Reason" req
          hint={outcome === "not_converted"
            ? "Not Converted with a reason is worth more than Converted — it is how eligibility rules and weights get corrected."
            : "The reason list is BE-OD-10, still open, along with who may correct a business-reported outcome."}>
          <SelectInput id="be-or" value={reason} onChange={setReason}
            options={reasons.map((r) => ({ v: r, l: r }))} />
        </FormField>

        <FormField id="be-on" label="Notes">
          <Textarea id="be-on" rows={3} ph="Optional." value={notes} onChange={setNotes} />
        </FormField>

        <InfoNote tone="warn" ico="alert" short={<><b>The business's sale, not ours.</b></>}>
          No amount is captured on this screen, no dashboard may place it on one axis with Interior
          bazzar revenue, and no analytics rollup may infer our revenue from this column. Ours is their
          subscription, which lives in Plans.
        </InfoNote>
      </div>
    </ModalShell>
  );
}

/* ============================================================ INVALID === */
/* Terminal with a stored reason. This state is what lets a separate quarantine
   queue not exist — a rejected submission has somewhere to live and a reason
   beside it, instead of a bare Discard that made the rejection rate impossible
   to read. */
export function InvalidateModal({ e, onClose, onDone }: {
  e: Enquiry; onClose: () => void; onDone: (msg: string) => void;
}) {
  const [reason, setReason] = useState(VOCAB.invalidReasons[0]);
  const [note, setNote] = useState("");
  const hasException = !!e.exception;

  return (
    <ModalShell
      title="Reject this enquiry"
      sub={<>{e.enquiryId} · {e.customer.name}</>}
      ico="alert"
      tone="error"
      onClose={onClose}
      /* Rejecting IS this dialog's primary action, so it sits last in the
         footer wearing the destructive fill — the same order `ConfirmModal`
         uses. The far-left `danger` slot is for a destructive SECONDARY beside
         a different primary, and putting Reject there made Cancel read as the
         thing the dialog wanted you to press. */
      actions={
        <>
          <Button color="secondary" data-close="1" onClick={onClose}>Cancel</Button>
          <Button color="primary-destructive" data-act="be-invalid-go"
            onClick={() => { invalidate(e.enquiryId, reason, note.trim()); onDone("Marked invalid, with a stored reason."); }}>
            Reject
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {hasException ? (
          <Alert tone="bad" title="This enquiry is an exception, not a rejection.">
            Nothing passed hard eligibility — the customer did nothing wrong and the enquiry is real,
            qualified and wanted. What is missing is <b>supply</b>. Rejecting it hides a coverage gap
            inside an invalid-rate metric where nobody will look for it.
          </Alert>
        ) : null}

        <FormField id="be-ir" label="Reason" req
          hint="Mandatory. “Discarded by ops” is not a reason — it is the absence of one, and it makes the rejection rate uninterpretable.">
          <SelectInput id="be-ir" value={reason} onChange={setReason}
            options={VOCAB.invalidReasons.map((r) => ({ v: r, l: r }))} />
        </FormField>

        <FormField id="be-in" label="Note">
          <Textarea id="be-in" rows={2} ph="Optional detail." value={note} onChange={setNote} />
        </FormField>

        <InfoNote ico="lock" short={<><b>Terminal.</b> There is no way back from this in v1.</>}>
          Reopening needs a controlled admin policy that does not exist yet. The record, its snapshot
          and its whole event timeline stay exactly as they are — nothing is deleted.
        </InfoNote>
      </div>
    </ModalShell>
  );
}
