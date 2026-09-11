/* =============================================================================
   Business Enquiries — the Business Suggestions panel, and the two screens
   behind it: the factor breakdown and the exclusion diagnostics.
   -----------------------------------------------------------------------------
   THE PANEL RANKS; IT NEVER COMPUTES. Score, rank, band and the reason text all
   arrive from the server already decided. A client that could re-sort would be
   a second, unversioned matching engine that nobody could reproduce — so
   nothing in this file does arithmetic on a score beyond drawing a bar the
   width of one.

   The excluded half is a disclosure, not a hidden detail. The businesses that
   are absent are the part of the decision easiest to hide and most often
   questioned, and "why is X not here?" is a question an operator gets asked by
   name.
   ============================================================================= */
import { useState } from "react";
import { Button, Card, EmptyState, Icon, Pill, SectionHead, Tag } from "../../ui";
import { BusinessSearch, CandidateCard, Disclose, FactorTable, InfoNote, PanelNote } from "./bits";
import { can } from "../../shell/AdminShell";
import { RULES, isTerminal, manualCandidate, needsOverrideReason } from "./store";
import type { Candidate, Enquiry, MatchRun } from "./store";

/* ---------------------------------------------------------- the panel --- */
export function SuggestionsPanel({ e, run, onAssign }: {
  e: Enquiry; run: MatchRun | null; onAssign: (c: Candidate) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [showExcluded, setShowExcluded] = useState(false);
  const assignable = !isTerminal(e.status) && !e.activeAssignmentId && can("business-enquiries", "edit");

  /* ---------------------------------------------------- nothing has run --- */
  if (!run) {
    return (
      <Card title="Business suggestions" sub="No matching run yet" tight>
        <div className="flex flex-col gap-4">
          <EmptyState
            flat
            icon="sparkle"
            title="Nothing to rank"
            body="Matching has not run for this enquiry."
          />
          <ManualPick e={e} onAssign={onAssign} />
          <InfoNote ico="sparkle" short={<>Run matching to build the candidate pool.</>}>
            It reads the qualification snapshot and the active rule version — never the live funnel
            form. That is what makes a past ranking reproducible.
          </InfoNote>
        </div>
      </Card>
    );
  }

  /* ------------------------------------------------- ran, found nobody --- */
  if (!run.eligible.length) {
    return (
      <Card
        title="Business suggestions"
        sub={<>0 eligible of {run.subscribedCount} subscribed · rule <span className="font-mono">{run.ruleVersion}</span></>}
        tight
      >
        <div className="flex flex-col gap-4">
          <EmptyState
            flat
            icon="alert"
            title="No business passed stage 1"
            body="Nothing to rank. The enquiry holds here — it is not invalid."
          />
          <div className="flex flex-col gap-3">
            <Disclose open={showExcluded} onToggle={() => setShowExcluded(!showExcluded)}>
              See why each of the {run.excluded.length} was excluded
            </Disclose>
            {showExcluded ? <ExclusionList run={run} inline /> : null}
          </div>
          <ManualPick e={e} onAssign={onAssign} />
          <InfoNote tone="warn" ico="alert" short={<>This enquiry <b>holds</b> here — it is not invalid.</>}>
            Nothing passed hard eligibility. The customer did nothing wrong and the enquiry is real,
            qualified and wanted; what is missing is <b>supply</b>. Rejecting it would hide a
            coverage gap inside a rejection-rate metric where nobody will look for it.
          </InfoNote>
        </div>
      </Card>
    );
  }

  /* ------------------------------------------------------- the candidates --- */
  return (
    <Card
      title="Business suggestions"
      sub={
        <>
          {run.eligible.length} eligible of {run.subscribedCount} subscribed ·{" "}
          {run.ranked ? <>ranked under rule </> : <>stage 1 only, rule </>}
          <span className="font-mono">{run.ruleVersion}</span>
        </>
      }
      right={<Pill xs tone={run.ranked ? "info" : "neutral"} text={run.ranked ? "Ranked" : "Unranked"} />}
      tight
    >
      <div className="flex flex-col gap-3">
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
          const top = ranked && c.rank === 1;
          return (
            <CandidateCard
              key={c.businessId}
              rank={ranked ? c.rank : null}
              score={ranked ? c.score : null}
              top={top}
              name={c.name}
              sub={ranked ? c.band : "Eligible · not ranked"}
              why={c.why}
              actions={
                <>
                  {ranked ? (
                    <Button color="secondary" size="xs" aria-expanded={isOpen}
                      onClick={() => setOpen(isOpen ? null : c.businessId)}>
                      {isOpen ? "Hide the breakdown" : "Why this score?"}
                    </Button>
                  ) : null}
                  {assignable ? (
                    <Button color={top ? "primary" : "secondary"} size="xs" onClick={() => onAssign(c)}>
                      Assign{needsReason ? " · reason" : ""}
                    </Button>
                  ) : null}
                </>
              }
            >
              {ranked && isOpen ? (
                <div className="mt-1 border-t border-secondary pt-3">
                  <FactorTable c={c} />
                </div>
              ) : null}
            </CandidateCard>
          );
        })}

        <div className="flex flex-col gap-3">
          <Disclose open={showExcluded} onToggle={() => setShowExcluded(!showExcluded)}>
            Why are {run.excluded.length} businesses missing?
          </Disclose>
          {showExcluded ? <ExclusionList run={run} inline /> : null}
        </div>

        {/* HERE TOO, not only when the run found nothing. A run that ranked
            five businesses has not established that one of them should get the
            work — the commercial reason for holding an enquiry back from the
            top match, or for sending it somewhere the rules never considered,
            is not a fact the engine has. Offering the directory only on an
            empty run made a found match the one case a person could not
            overrule, which is backwards. Same component, same dialog, same
            revalidation, same required reason. */}
        <ManualPick e={e} onAssign={onAssign} />

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
    </Card>
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
    <InfoNote tone="warn" ico="alert"
      short={<>{run.notApplied.length} of the eligibility{" "}
        {run.notApplied.length === 1 ? "gate was" : "gates were"} <b>not applied</b>.</>}>
      {run.notApplied.map((n) => (
        <div key={n.key}><b>{n.label}</b> — {n.reason}</div>
      ))}
      <p>
        Everything below passed the gates that <i>were</i> applied. It has not passed these, because
        these did not run.
      </p>
    </InfoNote>
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
    <div className="flex flex-col gap-3 border-t border-secondary pt-3">
      <Disclose open={open} onToggle={() => setOpen(!open)}>
        Assign to a business by hand
      </Disclose>

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
    <div className="flex flex-col gap-3">
      {!inline
        ? <SectionHead title="Excluded businesses"
            desc={run.excluded.length + " of " + run.subscribedCount + " subscribed · all failed stage 1"} />
        : null}

      {run.excluded.length ? (
        <ul className="flex flex-col divide-y divide-border-secondary rounded-lg bg-secondary px-3">
          {run.excluded.map((x) => (
            <li key={x.businessId} className="flex items-start gap-2.5 py-2.5">
              <Icon name="xcircle" size="sm" className="mt-0.5 shrink-0 text-fg-error-primary" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-primary">{x.name}</div>
                <div className="text-xs text-tertiary">{x.reason}</div>
              </div>
              <Tag label={x.stage} tone="neutral" />
            </li>
          ))}
        </ul>
      ) : (
        <PanelNote>The run excluded nobody — every subscribed business was still in the pool.</PanelNote>
      )}

      <InfoNote ico="shield" short={<>None of these was scored.</>}>
        They all failed <b>stage 1</b>, and <b>a hard failure is not a low score</b> — no score,
        however high, can put an excluded business back in the pool. Each reason names something an
        operator can act on: a lapsed subscription is a renewal call, "at capacity" is a capacity
        conversation, a wrong service area is a profile-data conversation.
      </InfoNote>
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
      <div className="flex flex-col gap-4">
        <InfoNote ico="alert" short={<><b>Live candidate row, not a snapshot.</b></>}>
          It is recalculated on every matching run and reflects today's profiles. It becomes history
          only at the moment of assignment.
        </InfoNote>
        <Card title={top.name} sub={"Rank 1 · score " + top.score + " · rule " + run!.ruleVersion} tight>
          <FactorTable c={top} />
        </Card>
      </div>
    );
  }

  const asCandidate: Candidate = {
    businessId: a.businessId, name: a.businessName, rank: a.candidateRank, score: a.candidateScore,
    band: "", capacity: { active: 0, configured: 0 }, factors: a.factorSnapshot,
    why: a.overrideReason || "",
    from: (run?.eligible.filter((c) => c.businessId === a.businessId)[0]?.from) || {},
  };

  return (
    <div className="flex flex-col gap-4">
      <Card
        title={a.businessName}
        sub={"Rank " + a.candidateRank + " of " + a.eligibleCount + " eligible · score " +
          a.candidateScore + " · rule " + a.ruleVersion}
        tight
      >
        <FactorTable c={asCandidate} />
      </Card>
      <InfoNote ico="lock" short={<><b>Copied onto the assignment, not referenced.</b></>}>
        {a.businessName} may change its categories tomorrow and the weight table may move past{" "}
        <span className="font-mono">{RULES.ruleVersion}</span> next month. Either would silently rewrite the
        answer to <i>"why did this go there?"</i> if this block held references instead of values.
        Profile and weight changes affect <b>future</b> matching only.
      </InfoNote>
    </div>
  );
}
