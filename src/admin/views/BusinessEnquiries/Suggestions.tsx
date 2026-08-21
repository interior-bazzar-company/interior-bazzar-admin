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
import { FactorTable, ScoreBar } from "./bits";
import { RULES, isTerminal, needsOverrideReason } from "./store";
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
          {run.eligible.length} eligible of {run.subscribedCount} subscribed · ranked under rule{" "}
          <span className="mono">{run.ruleVersion}</span>
        </div>
      </div>

      <div className="be-sp-scroll">
        {run.eligible.map((c) => {
          const isOpen = open === c.businessId;
          const needsReason = needsOverrideReason(run, c.businessId);
          return (
            <div key={c.businessId} className={"be-sugg" + (c.rank === 1 ? " top" : "")}>
              <div className="be-sugg-r1">
                <span className="be-rank">{c.rank}</span>
                <div className="be-sugg-nm">
                  <div className="nm">{c.name}</div>
                  <div className="band">{c.band}</div>
                </div>
                <span className="be-score tnum" aria-label={c.score + " of 100"}>{c.score}</span>
              </div>
              <ScoreBar score={c.score} top={c.rank === 1} />
              <div className="be-why">{c.why}</div>
              <div className="be-sugg-a">
                <button className="btn sm" aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : c.businessId)}>
                  {isOpen ? "Hide the breakdown" : "Why this score?"}
                </button>
                {assignable
                  ? <button className={"btn sm " + (c.rank === 1 ? "pri" : "")} onClick={() => onAssign(c)}>
                      Assign{needsReason ? " · reason" : ""}
                    </button>
                  : null}
              </div>
              {isOpen ? (
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
        <InfoNote ico="shield" short={<><b>Recommendation is not assignment.</b></>}>
          Nothing is routed until an authorised person confirms it. The engine advises; a human
          decides — and the human can pick any eligible business, not only the top one.
        </InfoNote>
      </div>
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
