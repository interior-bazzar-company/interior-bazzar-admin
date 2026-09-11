/* =============================================================================
   A member's resources — /team/:id/resources
   -----------------------------------------------------------------------------
   THE OTHER END OF THE LINK. `#/resources` asks "who still owes me this form";
   this page asks "what has this person been asked for, and what did they say".
   Same records, read down the other axis, which is why it is a page on the
   member and not a second copy of the module.

   IT READS, AND IT LETS THE MEMBER ANSWER. Opening or closing a resource and
   editing its fields happen in the Resources module. Submitting did not happen
   anywhere: `submitResponse` was built and tested and no screen called it, so
   a member's link was dead. Until the member dashboard ships, this page is the
   member's end of the link — the same stand-in the sign dialog is for
   agreements, gated the same way (`viewer === "self"`). One submission per
   person per resource is still the store's rule, not this page's.

   PENDING IS DERIVED HERE TOO, by the same `rowsFor` the module's table uses,
   filtered to this one person. It is not a query of its own: a member page that
   computed "outstanding" its own way would eventually disagree with the tab
   that sent the reader here.

   ONE CARD PER RESOURCE, not a table: what came back is a set of question and
   answer pairs of wildly different lengths, and a row that has to hold a
   paragraph is a row that holds nothing else legibly.
   ============================================================================= */
import { Alert, Button, Card, EmptyState, Icon, Pill } from "../../../ui";
import { go } from "../../../ui/nav";
import { useShell } from "../../../shell/ShellContext";
import { AnswerRow, TagChips } from "../../Resources/bits";
import { ResponseSheet } from "../../Resources";
import {
  audienceLine, fmtDate, orderedResources, responsesOfMember, rowsFor,
  useResources, useResponses,
} from "../../Resources/store";
import type { Resource, ResourceResponse } from "../../Resources/store";
import { FillModal } from "../../Resources/Fill";
import type { Member } from "../store";
import type { Viewer } from "./ops";
import { OpHead } from "./frame";

/* `viewer` is optional only for the smoke, which renders this page bare; the
   member launcher always passes it. */
export default function ResourcesPage({ m, viewer = "admin" }: { m: Member; viewer?: Viewer }) {
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
      right={<Button color="secondary" ico="ext" onClick={() => go("#/resources")}>All resources</Button>} />
  );

  if (!mine.length) {
    return (
      <div className="flex flex-col gap-5">
        {head}
        <EmptyState
          icon="flag"
          title="Nothing has been asked of them"
          body={"No resource's condition matches " + m.name
            + " today, and they have not answered one. A form built for their department or "
            + "role picks them up automatically — nobody has to re-send it."}
          action={<Button color="primary" ico="ext" onClick={() => go("#/resources")}>Open Resources</Button>}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {head}

      {outstanding.length ? (
        <Alert tone="warn" ico="clock" title={outstanding.length + " still outstanding"}>
          {outstanding.map((r) => r.title).join(", ")} {outstanding.length === 1 ? "is" : "are"} open
          and unanswered. Nothing here chases it — this page states it.
        </Alert>
      ) : null}

      <div className="flex flex-col gap-4">
        {mine.map((r) => {
          const x = answeredIds[r.resourceId] || null;
          return (
            <Card
              key={r.resourceId}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  {r.title}
                  <TagChips tags={r.tags} max={2} />
                  {x
                    ? <Pill xs dot tone="ok" text={"Submitted " + fmtDate(x.submittedAt)} />
                    : <Pill xs dot tone={r.state === "open" ? "warn" : "neutral"}
                      text={r.state === "open" ? "Pending" : "Not open"} />}
                </span>
              }
              right={
                <>
                  {!x && r.state === "open" && viewer === "self" ? (
                    <Button color="primary" size="xs"
                      onClick={() => shell.modal(<FillModal r={r} memberId={m.memberId} />, "lg")}>
                      Fill it in
                    </Button>
                  ) : null}
                  <Button color="secondary" size="xs" ico="ext"
                    onClick={() => go("#/resources?form=" + r.resourceId)}>
                    The resource
                  </Button>
                </>
              }
              foot={x ? (
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="lock" size="xs" className="text-fg-quaternary" />
                    Answered on v{x.version}. It cannot be edited.
                  </span>
                  <Button color="secondary" size="xs" onClick={() => shell.modal(<ResponseSheet r={r} x={x} />, "lg")}>
                    Open it
                  </Button>
                </span>
              ) : undefined}
            >
              {x ? (
                <dl className="flex flex-col">
                  {x.answers.map((a) => <AnswerRow key={a.fieldId} a={a} />)}
                </dl>
              ) : (
                <p className="text-sm text-tertiary">
                  {r.state === "open"
                    ? "For " + audienceLine(r.departments).toLowerCase() + ". Nothing submitted yet."
                    : "For " + audienceLine(r.departments).toLowerCase()
                      + ". The resource is " + r.state + ", so there is nothing to submit."}
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
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
