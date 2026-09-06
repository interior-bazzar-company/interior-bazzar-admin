/* =============================================================================
   A member's resources — /team/:id/resources
   -----------------------------------------------------------------------------
   THE OTHER END OF THE LINK. `#/resources` asks "who still owes me this form";
   this page asks "what has this person been asked for, and what did they say".
   Same records, read down the other axis, which is why it is a page on the
   member and not a second copy of the module.

   IT READS, IT DOES NOT WRITE. Opening or closing a resource, editing its
   fields and submitting an answer all happen in the Resources module. A second
   place to submit would be a second place the same answer could be entered,
   and the module already refuses a second submission — so the two would race
   rather than disagree, which is worse.

   PENDING IS DERIVED HERE TOO, by the same `rowsFor` the module's table uses,
   filtered to this one person. It is not a query of its own: a member page that
   computed "outstanding" its own way would eventually disagree with the tab
   that sent the reader here.
   ============================================================================= */
import { EmptyState, Icon, Notice, Pill } from "../../../ui";
import { go } from "../../../ui/nav";
import { useShell } from "../../../shell/ShellContext";
import { AnswerRow, TagChips } from "../../Resources/bits";
import { ResponseSheet } from "../../Resources";
import {
  audienceLine, fmtDate, orderedResources, responsesOfMember, rowsFor,
  useResources, useResponses,
} from "../../Resources/store";
import type { Resource, ResourceResponse } from "../../Resources/store";
import type { Member } from "../store";
import { OpHead } from "./frame";
import "../../Resources/resources.css";

export default function ResourcesPage({ m }: { m: Member }) {
  const shell = useShell();
  useResources();
  useResponses();

  /* Every resource whose audience contains this person, plus every resource
     they have answered — the second half matters because a condition can change
     under an answer that was already given, and that answer is still theirs. */
  const answered = responsesOfMember(m.memberId);
  const answeredIds: Record<string, ResourceResponse> = {};
  answered.forEach((x) => { if (!answeredIds[x.resourceId]) answeredIds[x.resourceId] = x; });

  const mine = orderedResources().filter((r) =>
    !!answeredIds[r.resourceId]
    || rowsFor(r).some((row) => row.member.memberId === m.memberId));

  const outstanding = mine.filter((r) => r.state === "open" && !answeredIds[r.resourceId]);

  const head = (
    <OpHead
      title="Resources"
      desc="Company to member, as a form. What was asked, and what came back."
      right={
        <button className="btn" onClick={() => go("#/resources")}>
          <Icon name="ext" size="sm" />All resources
        </button>
      } />
  );

  if (!mine.length) {
    return (
      <>
        {head}
          <EmptyState
          icon="flag"
          title="Nothing has been asked of them"
          body={"No resource's condition matches " + m.name
            + " today, and they have not answered one. A form built for their department or "
            + "role picks them up automatically — nobody has to re-send it."}
          action={
            <button className="btn pri" onClick={() => go("#/resources")}>Open Resources</button>
          }
        />
      </>
    );
  }

  return (
    <>
      {head}
      <div className="rs-mine">
      {outstanding.length ? (
        <Notice tone="warn">
          <b>{outstanding.length} still outstanding.</b>{" "}
          {outstanding.map((r) => r.title).join(", ")} {outstanding.length === 1 ? "is" : "are"}{" "}
          open and unanswered. Nothing here chases it — this page states it.
        </Notice>
      ) : null}

      {mine.map((r) => {
        const x = answeredIds[r.resourceId] || null;
        return (
          <div key={r.resourceId} className="rs-mine-card">
            <div className="rs-mine-h">
              <b>{r.title}</b>
              <TagChips tags={r.tags} max={2} />
              {x
                ? <Pill text={"Submitted " + fmtDate(x.submittedAt)} tone="ok" dot />
                : <Pill text={r.state === "open" ? "Pending" : "Not open"}
                    tone={r.state === "open" ? "warn" : ""} dot />}
              <span className="spacer" />
              <button className="btn sm" onClick={() => go("#/resources?form=" + r.resourceId)}>
                <Icon name="ext" size="sm" />The resource
              </button>
            </div>

            {x ? (
              <>
                {x.answers.map((a) => <AnswerRow key={a.fieldId} a={a} />)}
                <div className="rs-mine-h" style={{ marginTop: "var(--space-3)", marginBottom: 0 }}>
                  <span className="cell-2">
                    <Icon name="lock" size="sm" /> Answered on v{x.version}. It cannot be edited.
                  </span>
                  <span className="spacer" />
                  <button className="btn sm" onClick={() => shell.modal(<ResponseSheet r={r} x={x} />)}>
                    Open it
                  </button>
                </div>
              </>
            ) : (
              <span className="cell-2">
                {r.state === "open"
                  ? "For " + audienceLine(r.departments).toLowerCase() + ". Nothing submitted yet."
                  : "For " + audienceLine(r.departments).toLowerCase()
                    + ". The resource is " + r.state + ", so there is nothing to submit."}
              </span>
            )}
          </div>
        );
      })}
      </div>
    </>
  );
}

/** Exported for the summary block on the member launcher, which needs the count
 *  without rendering the page. Same derivation, one call. */
export function outstandingFor(memberId: string): Resource[] {
  const answered: Record<string, boolean> = {};
  responsesOfMember(memberId).forEach((x) => { answered[x.resourceId] = true; });
  return orderedResources().filter((r) =>
    r.state === "open"
    && !answered[r.resourceId]
    && rowsFor(r).some((row) => row.member.memberId === memberId));
}
