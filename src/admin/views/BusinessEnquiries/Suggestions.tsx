/* =============================================================================
   Business Enquiries — the Business Suggestions panel, and the two screens
   behind it: the factor breakdown and the exclusion diagnostics.
   -----------------------------------------------------------------------------
   THE PANEL RANKS; IT NEVER COMPUTES. Score, rank, band and the reason text all
   arrive from the server already decided. A client that could re-sort would be
   a second, unversioned matching engine that nobody could reproduce — so
   nothing in this file does arithmetic on a score beyond drawing a bar the
   width of one.

   The excluded half is a link, not a hidden detail. The businesses that are
   absent are the part of the decision easiest to hide and most often
   questioned, and "why is X not here?" is a question an operator gets asked by
   name.
   ============================================================================= */
import { useState } from "react";
import { EmptyState, Icon, SectionHead } from "../../ui";
import { InfoNote } from "./bits";
import { can } from "../../shell/AdminShell";
import { BusinessSearch, FactorTable, ScoreBar } from "./bits";
import { RULES, isTerminal, manualCandidate, needsOverrideReason } from "./store";
import type { Candidate, Enquiry, MatchRun } from "./store";

/* ---------------------------------------------------------- the panel --- */
/* Header, scrolling body, footer. The three-part shape is not decoration: the
   panel is pinned and height-capped so its footer cannot be pushed below the
   fold by a long candidate list or an expanded breakdown. See .be-sp in
   enquiries.css for what it is fixing. */
export function SuggestionsPanel({ e, run, onAssign }: {
  e: Enquiry; run: MatchRun | null; onAssign: (c: Candidate) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [showExcluded, setShowExcluded] = useState(false);
  const assignable = !isTerminal(e.status) && !e.activeAssignmentId && can("business-enquiries", "edit");

  if (!run) {
    return (
      <div className="be-sp">
        <div className="be-sp-h">
          <b>Business Suggestions</b>
          <div className="r">No matching run yet</div>
        </div>
        <div className="be-sp-scroll">
          <div className="be-sp-empty">
            <div className="g" />
            Matching has not run for this enquiry.<br />
            <b>Nothing to rank.</b>
          </div>
          <ManualPick e={e} onAssign={onAssign} />
        </div>
        <div className="be-sp-f">
          <InfoNote ico="sparkle" short={<>Run matching to build the candidate pool.</>}>
            It reads the qualification snapshot and the active rule version — never the live funnel
            form. That is what makes a past ranking reproducible.
          </InfoNote>
        </div>
      </div>
    );
  }

  if (!run.eligible.length) {
    return (
      <div className="be-sp">
        <div className="be-sp-h">
          <b>Business Suggestions</b>
          <div className="r">0 eligible of {run.subscribedCount} subscribed · rule <span className="mono">{run.ruleVersion}</span></div>
        </div>
        <div className="be-sp-scroll">
          <div className="be-sp-empty">
            <div className="g" />
            No business passed stage 1.<br />
            <b>Nothing to rank.</b>
          </div>
          <button className="be-sp-link" aria-expanded={showExcluded}
            onClick={() => setShowExcluded(!showExcluded)}>
            See why each of the {run.excluded.length} was excluded
            <Icon name={showExcluded ? "chev" : "chevr"} size="sm" />
          </button>
          {showExcluded ? <ExclusionList run={run} inline /> : null}
          <ManualPick e={e} onAssign={onAssign} />
        </div>
        <div className="be-sp-f">
          <InfoNote tone="warn" ico="alert" short={<>This enquiry <b>holds</b> here — it is not invalid.</>}>
            Nothing passed hard eligibility. The customer did nothing wrong and the enquiry is real,
            qualified and wanted; what is missing is <b>supply</b>. Rejecting it would hide a
            coverage gap inside a rejection-rate metric where nobody will look for it.
          </InfoNote>
        </div>
      </div>
    );
  }

  return (
    <div className="be-sp">
      <div className="be-sp-h">
        <b>Business Suggestions</b>
        <div className="r">
          {run.eligible.length} eligible of {run.subscribedCount} subscribed ·{" "}
          {run.ranked ? <>ranked under rule </> : <>stage 1 only, rule </>}
          <span className="mono">{run.ruleVersion}</span>
        </div>
      </div>

      <div className="be-sp-scroll">
        <NotApplied run={run} />

        {run.eligible.map((c) => {
          const isOpen = open === c.businessId;
          /* UNRANKED IS THE HONEST CASE TODAY, and it is the run that says so
             rather than this file guessing from a score of 0. Everything the
             ranked layout draws — the rank badge, the number out of 100, the
             bar, the factor breakdown — would be drawing a judgement nothing
             made. What is left is what the run actually established: this
             business passed every gate, and here is which facts did it. */
          const ranked = run.ranked;
          const needsReason = !ranked || needsOverrideReason(run, c.businessId);
          return (
            <div key={c.businessId} className={"be-sugg" + (ranked && c.rank === 1 ? " top" : "")}>
              <div className="be-sugg-r1">
                {ranked ? <span className="be-rank">{c.rank}</span> : null}
                <div className="be-sugg-nm">
                  <div className="nm">{c.name}</div>
                  <div className="band">{ranked ? c.band : "Eligible · not ranked"}</div>
                </div>
                {ranked
                  ? <span className="be-score tnum" aria-label={c.score + " of 100"}>{c.score}</span>
                  : null}
              </div>
              {ranked ? <ScoreBar score={c.score} top={c.rank === 1} /> : null}
              <div className="be-why">{c.why}</div>
              <div className="be-sugg-a">
                {ranked
                  ? <button className="btn sm" aria-expanded={isOpen}
                      onClick={() => setOpen(isOpen ? null : c.businessId)}>
                      {isOpen ? "Hide the breakdown" : "Why this score?"}
                    </button>
                  : null}
                {assignable
                  ? <button className={"btn sm " + (ranked && c.rank === 1 ? "pri" : "")}
                      onClick={() => onAssign(c)}>
                      Assign{needsReason ? " · reason" : ""}
                    </button>
                  : null}
              </div>
              {ranked && isOpen ? (
                <div className="be-sugg-x">
                  <FactorTable c={c} />
                </div>
              ) : null}
            </div>
          );
        })}

        <button className="be-sp-link" aria-expanded={showExcluded}
          onClick={() => setShowExcluded(!showExcluded)}>
          Why are {run.excluded.length} businesses missing?
          <Icon name={showExcluded ? "chev" : "chevr"} size="sm" />
        </button>
        {showExcluded ? <ExclusionList run={run} inline /> : null}
      </div>

      <div className="be-sp-f">
        {run.ranked ? (
          <InfoNote ico="shield" short={<><b>Recommendation is not assignment.</b></>}>
            Nothing is routed until an authorised person confirms it. The engine advises; a human
            decides — and the human can pick any eligible business, not only the top one.
          </InfoNote>
        ) : (
          <InfoNote ico="shield" short={<><b>Eligible, in alphabetical order. Nothing here is ranked.</b></>}>
            The run answered <b>who can take this enquiry</b> — an active subscription, the category
            declared, the location served, a free slot — and stopped there. It did not answer who is
            best, because that needs seven factor weights validated against real outcomes, and
            printing an unvalidated score beside a business's name would look exactly as
            authoritative as a real one. A to Z is deliberately not a judgement. Every assignment
            from this list stores <b>no rank and no score</b> and asks you for a reason instead.
          </InfoNote>
        )}
      </div>
    </div>
  );
}

/* WHAT THE RUN DID NOT CHECK.

   A gate is skipped for one of two reasons: the enquiry carries nothing to test
   it against (no category, no city), or the rule set declares one that nothing
   implements. Either way the businesses on the other side of it were NOT
   checked, and a panel that quietly dropped the gate would let "5 of 5 passed"
   be read off four. The cheapest lie a diagnostics screen can tell is the one
   about a test that never ran. */
function NotApplied({ run }: { run: MatchRun }) {
  if (!run.notApplied?.length) return null;
  return (
    <div className="be-qp-sec">
      <InfoNote tone="warn" ico="alert"
        short={<>{run.notApplied.length} of the eligibility{" "}
          {run.notApplied.length === 1 ? "gate was" : "gates were"} <b>not applied</b>.</>}>
        {run.notApplied.map((n) => (
          <div key={n.key}><b>{n.label}</b> — {n.reason}</div>
        ))}
        <br />
        Everything below passed the gates that <i>were</i> applied. It has not passed these, because
        these did not run.
      </InfoNote>
    </div>
  );
}

/* ------------------------------------------------------ the manual pick --- */
/* WHAT AN OPERATOR DOES WHEN THE ENGINE HAS NOTHING.

   It sits in both empty states — no run at all, and a run that found nobody —
   because they are the same situation from the operator's chair: an enquiry
   worth routing and no recommendation to route it with. The alternative is
   waiting for a rule change to hand out an enquiry they already know the answer
   for, and enquiries do not wait; they get worked in a notebook, and the
   business that gets one is then chosen with none of this module's machinery.

   IT IS A SEARCH, NOT A SECOND RANKING. There is no score here, no order that
   implies one is better, and no "recommended" of any kind — the list is
   alphabetical and the only thing it claims about a business is what the
   directory says: its plan, its area, its categories and how full it is.
   Anything more would be a matching engine written in a side panel, unversioned
   and unreproducible, which is the one thing this module refuses to have.

   Assigning still goes through the same dialog and the same five revalidation
   checks. What a manual pick skips is the RANKING; it skips no gate, and it
   requires a written reason precisely because nothing ranked it. */
function ManualPick({ e, onAssign }: { e: Enquiry; onAssign: (c: Candidate) => void }) {
  const [open, setOpen] = useState(false);

  const assignable = !isTerminal(e.status) && !e.activeAssignmentId && can("business-enquiries", "edit");
  if (!assignable) return null;

  return (
    <div className="be-qp-sec">
      <button className="be-sp-link" aria-expanded={open} onClick={() => setOpen(!open)}>
        Assign to a business by hand
        <Icon name={open ? "chev" : "chevr"} size="sm" />
      </button>

      {open ? (
        <>
          <BusinessSearch action="Assign · reason"
            onPick={(b) => onAssign(manualCandidate(b))} />

          <InfoNote tone="warn" ico="alert"
            short={<>A hand-picked assignment records <b>no rank and no score</b>.</>}>
            Nothing ranked this business, so the assignment stores those as absent rather than as
            zero — a zero would read as a business that scored nothing instead of one no run ever
            looked at. Your reason becomes the only record of why this one, which is why it is
            required. Every hard gate — subscription, account status, capacity — is still checked at
            the moment you confirm.
          </InfoNote>
        </>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------ the exclusions --- */
/* Excluded businesses are RETAINED with their reasons, never discarded — the
   diagnostics are only possible if the exclusions survive the run. Each reason
   names the thing an operator can act on: "subscription expired 14 Mar" is a
   renewal conversation, "at capacity 12 of 12" is a capacity conversation,
   "service area is Bengaluru" is a profile-data conversation. */
export function ExclusionList({ run, inline }: { run: MatchRun; inline?: boolean }) {
  return (
    <div className={"be-excl" + (inline ? " inline" : "")}>
      {!inline
        ? <SectionHead title="Excluded businesses"
            desc={run.excluded.length + " of " + run.subscribedCount + " subscribed · all failed stage 1"} />
        : null}
      {run.excluded.map((x) => (
        <div className="be-exc" key={x.businessId}>
          <span className="x"><Icon name="x" size="sm" /></span>
          <div>
            <div className="nm">{x.name}</div>
            <div className="rs">{x.reason}</div>
          </div>
          <span className="stg">{x.stage}</span>
        </div>
      ))}
      <div className="be-exc-f">
        <InfoNote ico="shield" short={<>None of these was scored.</>}>
          They all failed <b>stage 1</b>, and <b>a hard failure is not a low score</b> — no score,
          however high, can put an excluded business back in the pool. Each reason names something an
          operator can act on: a lapsed subscription is a renewal call, "at capacity" is a capacity
          conversation, a wrong service area is a profile-data conversation.
        </InfoNote>
      </div>
    </div>
  );
}

/* ------------------------------------------------- the match snapshot --- */
/* What was frozen onto the assignment, factor by factor. Reads the assignment's
   own copy where there is one, and the live candidate row otherwise — the two
   are deliberately different things, and the caption says which you are
   looking at. */
export function MatchSnapshot({ e, run }: { e: Enquiry; run: MatchRun | null }) {
  const a = e.assignments.filter((x) => x.assignmentId === e.activeAssignmentId)[0] || null;

  if (!a) {
    const top = run?.eligible[0];
    if (!top) return <EmptyState icon="search" title="No match snapshot yet"
      body="Nothing has been assigned, so nothing has been frozen. The candidate snapshot below is live and will be recalculated on the next matching run." />;
    return (
      <>
        <InfoNote ico="alert" short={<><b>Live candidate row, not a snapshot.</b></>}>
          It is recalculated on every matching run and reflects today's profiles. It becomes history
          only at the moment of assignment.
        </InfoNote>
        <SectionHead title={top.name} desc={"Rank 1 · score " + top.score + " · rule " + run!.ruleVersion} />
        <FactorTable c={top} />
      </>
    );
  }

  const asCandidate: Candidate = {
    businessId: a.businessId, name: a.businessName, rank: a.candidateRank, score: a.candidateScore,
    band: "", capacity: { active: 0, configured: 0 }, factors: a.factorSnapshot,
    why: a.overrideReason || "",
    from: (run?.eligible.filter((c) => c.businessId === a.businessId)[0]?.from) || {},
  };

  return (
    <>
      <SectionHead title={a.businessName}
        desc={"Rank " + a.candidateRank + " of " + a.eligibleCount + " eligible · score " +
          a.candidateScore + " · rule " + a.ruleVersion} />
      <FactorTable c={asCandidate} />
      <InfoNote ico="lock" short={<><b>Copied onto the assignment, not referenced.</b></>}>
        {a.businessName} may change its categories tomorrow and the weight table may move past{" "}
        <span className="mono">{RULES.ruleVersion}</span> next month. Either would silently rewrite the
        answer to <i>"why did this go there?"</i> if this block held references instead of values.
        Profile and weight changes affect <b>future</b> matching only.
      </InfoNote>
    </>
  );
}
