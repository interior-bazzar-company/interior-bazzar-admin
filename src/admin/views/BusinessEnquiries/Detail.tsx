/* =============================================================================
   Business Enquiries — THE CORE SCREEN. Requirement on the left, ranked
   businesses on the right.
   -----------------------------------------------------------------------------
   Everything an operator needs to make one routing decision, on one screen,
   without leaving to look anything up. That is the whole design brief for this
   view, and every choice below serves it:

     · the qualification snapshot sits under the requirement, because "is this
       real and how urgent is it" is the question you ask before "who gets it"
     · the suggestions panel is a sibling of the requirement, not a step after
       it — the reason a business is recommended has to be readable beside the
       thing it was recommended for
     · there is no Edit button on the snapshot at any role, and the frozen bar
       says why rather than leaving the absence to be read as an oversight
     · the tabs are the record's other faces, not other pages: match snapshot,
       assignment, timeline. The URL carries which one, so a link to a timeline
       is a link to a timeline.
   ============================================================================= */
import { useState } from "react";
import type { MouseEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ActivityFeed, Button, Card, Checkbox, EmptyState, IconButton, InfoDot, KvList,
  SectionHead, Tabs, Tag, Textarea, Timeline,
} from "../../ui";
import { can, useNav } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import {
  BlockHead, FrozenBar, InfoNote, LifecycleRail, PanelNote, SourceChip, StatusPill, TagChips,
  TierBadge, UrgencyChip,
} from "./bits";
import { RecordMenu } from "./menus";
import { ContactLog, QualifyPanel, RequirementForm } from "./Qualify";
import { ExclusionList, MatchSnapshot, SuggestionsPanel } from "./Suggestions";
import {
  AssignModal, InvalidateModal, OutcomeModal, ReassignModal,
} from "./Modals";
import {
  CHECKLIST, activeAssignment, addRemark, businessById, dateTimeLabel, durationLabel, isWorking,
  markNoMatch, matchCooldown, tierOf,
  isTerminal, lastResponse, pastAssignments, place, runMatching, statusOf,
  transitionOf, useEnquiry, useMatchRun,
} from "./store";
import type { Candidate, Enquiry, MatchRun } from "./store";

const TABS = [
  { k: "enquiry", label: "Enquiry" },
  { k: "match", label: "Match snapshot" },
  { k: "assignment", label: "Assignment" },
  { k: "history", label: "History" },
];

export default function Detail({ id, listHash, prev, next, pos }: {
  id: string; listHash: string;
  /** Neighbours in the filtered, sorted queue — see index.tsx. Someone
   *  qualifying twenty enquiries should not return to the list twenty times. */
  prev: string | null; next: string | null; pos: { i: number; of: number } | null;
}) {
  const e = useEnquiry(id);
  const run = useMatchRun(id);
  const [sp, setSp] = useSearchParams();
  const { go } = useNav();
  const { modal, closeLayer, toast, openPop, closePop, popAnchor } = useShell();

  if (!e) {
    return (
      <EmptyState icon="search" title="No enquiry at this reference"
        body={<>There is no enquiry with the reference <span className="font-mono">{id}</span>. On the real
          API a business asking for someone else's reference gets <b>403 out_of_scope</b>, never a
          404 — a 404 would confirm the id exists.</>}
        action={<Button color="primary" ico="chevl" onClick={() => go(listHash)}>Back to the list</Button>} />
    );
  }

  const tab = TABS.filter((t) => t.k === sp.get("tab"))[0]?.k || "enquiry";
  const setTab = (k: string) => {
    const nextSp = new URLSearchParams(sp);
    if (k === "enquiry") nextSp.delete("tab"); else nextSp.set("tab", k);
    setSp(nextSp, { replace: true });
  };

  const a = activeAssignment(e);
  const writes = can("business-enquiries", "edit");
  const done = (msg: string) => { closeLayer(); toast(msg); };

  const onAssign = (c: Candidate) =>
    modal(<AssignModal e={e} run={run} c={c} onClose={closeLayer} onDone={done} />, "lg");

  return (
    <div className="flex flex-col gap-4">
      {/* ============================================================ HEADER ===
          The record-header pattern the whole panel takes: the reference leads
          in mono, the identity under it, and the right side closes with More
          and the way back to the queue. */}
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
            <div className="min-w-0 flex-1">
              <div className="label-mono">{e.enquiryId}</div>
              <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-primary">
                {e.customer.name}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-tertiary">
                <span className="font-mono">{e.customer.phone}</span>
                {e.customer.email ? <><span aria-hidden="true">·</span><span className="font-mono">{e.customer.email}</span></> : null}
                <span aria-hidden="true">·</span>
                <SourceChip source={e.source} full />
                <span aria-hidden="true">·</span>
                <span className="font-mono">{e.source.page}</span>
                <span aria-hidden="true">·</span>
                <span>{dateTimeLabel(e.createdAt)}</span>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {/* Step through the queue without going back to it. The count
                  says where you are, so "am I nearly done" is answerable
                  without leaving. */}
              {pos ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-secondary p-0.5">
                  <IconButton ico="chevl" size="xs" label="Previous enquiry"
                    isDisabled={!prev} onClick={() => prev && go(prev)} />
                  <span className="px-1 text-xs text-tertiary tnum">{pos.i} / {pos.of}</span>
                  <IconButton ico="chevr" size="xs" label="Next enquiry"
                    isDisabled={!next} onClick={() => next && go(next)} />
                </span>
              ) : null}

              {/* Everything you do WITH the enquiry lives behind More: copy it,
                  image it, print it. Everything that MOVES it through its
                  lifecycle stays on the action bar in the open — a state change
                  behind an overflow menu is one nobody audits and nobody
                  expects. Nothing in this menu changes the record.

                  `data-act` IS LOAD-BEARING, not a test hook. The shell mounts
                  the popover with a document-level listener that closes it
                  unless the press landed inside the popover or on a `[data-act]`
                  element. React flushes this discrete click — render, commit
                  and effects — before the native event finishes bubbling, so the
                  very press that opened the menu reaches that listener and shuts
                  it again. Without the attribute the popover opens and closes
                  within one click and nothing appears. */}
              <Button
                color="secondary" ico="dots" data-act="be-more" aria-haspopup="menu"
                title="Copy · download image · print"
                onClick={(ev: MouseEvent<HTMLElement>) => {
                  const el = ev.currentTarget as HTMLElement;
                  if (popAnchor === el) { closePop(); return; }
                  openPop(el, <RecordMenu e={e} />, { width: 320, align: "right" });
                }}
              >
                More
              </Button>
              <Button color="secondary" ico="chevl" onClick={() => go(listHash)}>Back</Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={e.status} lg />
            <TierBadge tier={e.tier} />
            <UrgencyChip urgency={e.qualification.urgency} />
            <TagChips tags={e.tags} />
          </div>

          {/* THE LIFECYCLE, drawn by the module's own dot ramp rather than the
              shared `Pipeline`: that component fills everything behind the
              current step, which would mark "No match yet" complete on every
              assigned record and claim an enquiry passed through a stage it
              never entered. See bits.tsx. */}
          <div className="border-t border-secondary pt-4">
            <LifecycleRail status={e.status} />
          </div>
        </div>
      </Card>

      {/* The counts are QUIET: they are sizes, not work owed. A loud badge on
          History would say somebody has to read it. */}
      <Tabs
        cur={tab}
        onPick={setTab}
        items={TABS.map((t) => ({
          ...t,
          quiet: true,
          n: t.k === "match" ? (run ? run.eligible.length : null)
            : t.k === "assignment" ? (e.assignments.length || null)
              : t.k === "history" ? (e.events.length || null)
                : null,
        }))}
      />

      {tab === "enquiry" ? <EnquiryTab e={e} run={run} onAssign={onAssign} onQualified={done} /> : null}
      {tab === "match" ? <MatchTab e={e} run={run} /> : null}
      {tab === "assignment" ? <AssignmentTab e={e} /> : null}
      {tab === "history" ? <HistoryTab e={e} /> : null}

      {writes ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-primary p-3 shadow-xs ring-1 ring-secondary">
          {/* New and Processing have no action in this bar on purpose:
              everything that moves an enquiry through qualification lives in
              the Qualification panel beside the record it acts on, not in a bar
              underneath it. */}
          {/* Reachable from No match yet too — re-running is that state's only
              way out, and the label says which of the two you are in because by
              then you have already pressed it once. */}
          {/* ONE RUN PER WINDOW. Disabled rather than hidden, and the title says
              when it comes back — an operator who cannot see why the only
              control on this state is missing will look for a bug that is not
              there. The rule itself lives in the store; this is the courtesy. */}
          {e.status === "qualified" || e.status === "no_match"
            ? (() => {
                const cool = matchCooldown(e);
                return (
                  <Button color="primary" ico="sparkle" isDisabled={cool.blocked}
                    title={cool.blocked
                      ? "Last run " + dateTimeLabel(cool.lastAt) + ". Neither the frozen snapshot "
                        + "nor the business directory moves fast enough for another run to answer "
                        + "differently — next one from " + dateTimeLabel(cool.readyAt) + "."
                      : "Reads the qualification snapshot and the active rule version"}
                    onClick={() => { runMatching(e.enquiryId); toast("Matching run complete."); }}>
                    {cool.blocked
                      ? "Matched " + durationLabel(cool.lastAt!, new Date().toISOString()) + " ago"
                      : e.status === "no_match" ? "Try matching again" : "Run matching"}
                  </Button>
                );
              })()
            : null}
          {/* The manual route to the same state, for the operator who already
              knows the answer — the one business covering that pincode just
              suspended. Not destructive: this is not a rejection and it is not
              terminal, it says the supply is missing and the enquiry is fine. */}
          {e.status === "qualified"
            ? <Button color="secondary"
                title="No subscribed business can take this one — reversible, re-run matching to clear it"
                onClick={() => { markNoMatch(e.enquiryId); toast("Marked No match yet."); }}>
                No match yet
              </Button>
            : null}
          {/* Assigned is now the only live state, so the outcome is recorded
              straight from it. There is no acknowledgement step to wait on and
              no Delivered state to pass through — assigning publishes. */}
          {e.status === "assigned" && a
            ? <Button color="primary" ico="flag"
                onClick={() => modal(<OutcomeModal e={e} onClose={closeLayer} onDone={done} />)}>
                Record outcome
              </Button>
            : null}
          {a && !isTerminal(e.status)
            ? <Button color="secondary"
                onClick={() => modal(<ReassignModal e={e} run={run} onClose={closeLayer} onDone={done} />, "lg")}>
                {/* An inline span, not a `Pill`: a Badge is a flex box and
                    would break the button's label onto a second line. */}
                Reassign <span className="ml-0.5 text-xs font-medium text-warning-primary">Admin</span>
              </Button>
            : null}
          <span className="flex-1" />
          {!isTerminal(e.status)
            ? <Button color="secondary-destructive"
                onClick={() => modal(<InvalidateModal e={e} onClose={closeLayer} onDone={done} />)}>
                Reject
              </Button>
            : <span className="text-sm text-tertiary">
                {/* The guard's own first sentence is the word "Terminal", so
                    printing the label and the whole guard said it twice. */}
                Terminal — {statusOf(e.status).label}.{" "}
                {transitionOf(e.status).guard.replace(/^Terminal\.\s*/, "")}
              </span>}
        </div>
      ) : null}
    </div>
  );
}

/* ============================================================ ENQUIRY === */
function EnquiryTab({ e, run, onAssign, onQualified }: {
  e: Enquiry; run: MatchRun | null;
  onAssign: (c: Candidate) => void;
  onQualified: (msg: string) => void;
}) {
  /* THE ONE BRANCH IN THIS MODULE THAT CHANGES WHAT THE SCREEN IS FOR.
     While an enquiry is New or Processing it is a piece of work: the record is
     editable and the right-hand column is the qualification panel. Once a
     person has marked it Qualified it becomes a piece of evidence: the record
     is frozen and the right-hand column is the ranked businesses. Same layout,
     same two columns, opposite jobs — which is why the branch is here and not
     two separate routes. */
  const working = isWorking(e.status);

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5">
      <div className="flex flex-col gap-4 lg:col-span-3">
        {working ? <RequirementForm e={e} /> : <RequirementBlock e={e} />}
        {working ? null : <SnapshotBlock e={e} />}
        {/* The log stays readable for the life of the record. It is the answer
            to "how do we know this was real?", and that question is asked long
            after the enquiry stopped being editable. */}
        {!working && e.contactLog.length > 0 ? <ContactLogBlock e={e} /> : null}

        <RemarksBlock e={e} />

        {e.exception ? (
          <InfoNote tone="warn" ico="alert"
            short={<><b>No match yet.</b> {e.exception.note}</>}>
            <span className="font-mono">422 no_eligible_business</span> is an exception, not an error the
            customer caused. If a lapsed subscription renews tomorrow this becomes assignable with
            nobody re-entering anything — the snapshot is intact and stage 1 simply passes.
          </InfoNote>
        ) : null}

        {e.invalidation ? (
          <Card title="Invalidation" tight>
            <KvList pairs={[
              ["Reason", <b className="font-semibold">{e.invalidation.reason}</b>],
              ["Detected", <>{e.invalidation.detectedBy} · {dateTimeLabel(e.invalidation.detectedAt)}</>],
              ["Note", e.invalidation.note],
            ]} />
          </Card>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 lg:col-span-2">
        {working
          ? <QualifyPanel e={e} onQualified={onQualified} />
          : <SuggestionsPanel e={e} run={run} onAssign={onAssign} />}
      </div>
    </div>
  );
}

/* REMARKS — what we think, as opposed to what the customer said.

   Sits under the record on every status, not only while it is being qualified:
   the useful note about a business going quiet arrives after delivery, and the
   useful note about a customer arrives whenever somebody notices.

   Deliberately plainer than the contact log beside it. A remark has no channel
   and no outcome — it is a sentence and a name, and dressing it up to match the
   log would suggest the two are the same kind of record, which is why it is an
   ActivityFeed and the log is a Timeline. */
function RemarksBlock({ e }: { e: Enquiry }) {
  const writes = can("business-enquiries", "edit");
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim()) return;
    addRemark(e.enquiryId, text);
    setText("");
  };

  return (
    <Card
      title={<>Remarks{e.remarks.length ? <> · {e.remarks.length}</> : null}</>}
      right={
        <InfoDot label="What is a remark?">
          What <b>we</b> think — as opposed to the contact log, which is what the customer said. A
          remark has no attempt attached, so it does not count towards the qualification gate and does
          not touch "contacted" or "reached".
          <p>
            <b>A remark never leaves this panel.</b> Not in an export, a copy, a printed sheet or a
            shared image. It is the most candid thing written about a customer anywhere in the module,
            which is exactly why it is the least shareable. The timeline records that one was added and
            by whom — never its text.
          </p>
        </InfoDot>
      }
      tight
    >
      <div className="flex flex-col gap-4">
        {writes ? (
          <div
            className="flex flex-col gap-2"
            onKeyDown={(ev) => {
              if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") { ev.preventDefault(); submit(); }
            }}
          >
            <Textarea rows={2} value={text} ariaLabel="Add a remark"
              ph="Something worth knowing that the customer did not say…"
              onChange={setText} />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-tertiary">
                Append-only — <b className="font-mono font-semibold text-secondary">Ctrl</b>+
                <b className="font-mono font-semibold text-secondary">Enter</b>
              </span>
              <span className="flex-1" />
              <Button color="primary" size="xs" isDisabled={!text.trim()} onClick={submit}>Add remark</Button>
            </div>
          </div>
        ) : null}

        {e.remarks.length ? (
          <ActivityFeed items={e.remarks.map((r) => ({
            who: r.actor,
            what: r.text,
            when: <>{r.actor} · {r.actorRole} · {dateTimeLabel(r.at)}</>,
          }))} />
        ) : (
          <PanelNote>
            No remarks. {writes ? "Add one when you learn something the form and the call did not capture." : null}
          </PanelNote>
        )}
      </div>
    </Card>
  );
}

/* The requirement, once it is settled. Same fields as the form above it, read
   only, because after qualification these are the values a business was matched
   on and changing one would change the meaning of a frozen score. */
function RequirementBlock({ e }: { e: Enquiry }) {
  return (
    <Card
      title="Requirement · as confirmed"
      right={
        <InfoDot label="What is on this block?">
          <b>Tier {e.tier}</b> — {tierOf(e.tier).help} It is an intake signal: what the submission itself
          told us before anyone spoke to the customer, never a judgement of the customer, and it carries
          no weight in matching.
          <p>
            The line in quotes is what the customer typed into the form. What they went on to <i>say</i> is
            in the contact log below, and the two are kept apart on purpose — the first is what we received,
            the second is what we established.
          </p>
        </InfoDot>
      }
      tight
    >
      <KvList pairs={[
        ["Category", e.requirement.category ? <b className="font-semibold">{e.requirement.category}</b> : null],
        ["Service", e.requirement.service],
        ["Location", e.requirement.city
          ? <><b className="font-semibold">{place(e)}</b>
              {e.requirement.state ? ", " + e.requirement.state : ""}
              {e.requirement.pincode ? " · " + e.requirement.pincode : ""}</>
          : null],
        ["Project type", e.requirement.projectType],
        ["Intent", e.requirement.intent],
        ["Urgency", <UrgencyChip urgency={e.qualification.urgency} />],
        ["Source", <SourceChip source={e.source} full />],
      ]} />
      <blockquote className="mt-4 border-l-2 border-brand-solid bg-secondary py-2.5 pl-3 text-sm text-secondary italic">
        “{e.requirement.text}”
      </blockquote>
    </Card>
  );
}

/* The snapshot, after the freeze. */
function SnapshotBlock({ e }: { e: Enquiry }) {
  const q = e.qualification;
  return (
    <Card
      title="Qualification snapshot"
      right={
        <InfoDot label="What is qualification?">
          Qualification is three things — contact, genuineness and urgency. <b>Budget is not one of
          them</b>: not a field here, not a filter on the list, not a scoring factor and not a sort.
          There is no column for a future feature to reach for.
        </InfoDot>
      }
      tight
    >
      <KvList pairs={[
        ["Qualified by", q.qualifiedBy
          ? <><b className="font-semibold">{q.qualifiedBy}</b> <span className="text-tertiary">· {q.qualifiedByRole}</span></>
          : <span className="text-error-primary">Nobody — this record never passed qualification</span>],
        ["Contact verified", q.contactVerified
          ? <>Yes — {q.verifiedVia}</>
          : <span className="text-error-primary">No</span>],
        ["Genuineness", q.genuineness === "passed"
          ? <>Passed <span className="text-tertiary">— {q.genuinenessNote}</span></>
          : <span className="text-error-primary">{q.genuineness} — {q.genuinenessNote}</span>],
        ["Urgency band", <UrgencyChip urgency={q.urgency} />],
        ["Summary", q.requirementSummary],
        ["Checks", <ChecklistRead e={e} />],
        ["Version", q.version ? <span className="font-mono">{q.version}</span> : null],
        ["Submission", <span className="font-mono">{e.submissionId}</span>],
      ]} />
      {q.frozenAt ? (
        <FrozenBar at={"at qualification, " + dateTimeLabel(q.frozenAt)}>
          Not editable by anyone, at any role. Corrections append an annotation event; the snapshot
          itself never changes.
        </FrozenBar>
      ) : (
        <div className="mt-4">
          <InfoNote tone="bad" ico="alert" short={<><b>Never frozen</b> — this record was never qualified.</>}>
            There is no snapshot to stand behind. That is correct for a rejected record and would be a
            defect for any other.
          </InfoNote>
        </div>
      )}
    </Card>
  );
}

/* The four checks, read only. `Checkbox` rather than a tick list, because it is
   the same control the qualification panel writes with — the ticked state
   should look identical whether or not you may change it. */
function ChecklistRead({ e }: { e: Enquiry }) {
  return (
    <span className="flex flex-wrap gap-x-5 gap-y-1.5">
      {CHECKLIST.map((row) => (
        <Checkbox
          key={row.key}
          checked={!!e.qualification.checklist[row.key]}
          disabled
          label={row.label}
          ariaLabel={row.label + " — " + row.help}
        />
      ))}
    </span>
  );
}

/* The contact log, read only. Every attempt, in the customer's words where
   there were any. */
function ContactLogBlock({ e }: { e: Enquiry }) {
  const last = lastResponse(e);
  return (
    <Card
      title={<>How it was qualified · {e.contactLog.length} contact{e.contactLog.length === 1 ? "" : "s"}</>}
      right={
        <InfoDot label="Why is a failed attempt kept?">
          Append-only, like the timeline. An attempt that went nowhere stays on the record: three of
          them is the difference between an enquiry worth chasing and one worth closing.
        </InfoDot>
      }
      tight
    >
      <ContactLog entries={e.contactLog} lastId={last?.logId} />
    </Card>
  );
}

/* =============================================================== MATCH === */
function MatchTab({ e, run }: { e: Enquiry; run: MatchRun | null }) {
  return (
    <div className="flex flex-col gap-4">
      <MatchSnapshot e={e} run={run} />
      {run ? (
        <>
          <div>
            <SectionHead title="Stage 1 — hard eligibility"
              desc="All of these must pass. One failure removes the business entirely — stage 2 never runs for it." />
            <Card tight>
              <KvList pairs={run.eligible.length
                ? [["Result", <><b className="font-semibold">{run.eligible.length} eligible</b> of {run.subscribedCount} subscribed, {run.excluded.length} excluded with reasons</>]]
                : [["Result", <span className="text-error-primary"><b className="font-semibold">0 eligible</b> of {run.subscribedCount} subscribed</span>]]} />
            </Card>
          </div>
          <ExclusionList run={run} />
        </>
      ) : null}
    </div>
  );
}

/* ========================================================== ASSIGNMENT === */
function AssignmentTab({ e }: { e: Enquiry }) {
  const a = activeAssignment(e);
  const past = pastAssignments(e);

  if (!a && !past.length) {
    return (
      <EmptyState icon="route" title="Not assigned yet"
        body="Nothing has been routed. The enquiry is still with Operations, and no capacity has moved." />
    );
  }

  const b = a ? businessById(a.businessId) : null;

  return (
    <div className="flex flex-col gap-4">
      {a ? (
        <>
          <Card title="The active assignment" tight>
            <KvList pairs={[
              ["Business", <b className="font-semibold">{a.businessName}</b>],
              ["Rank at assign", a.candidateRank + " of " + a.eligibleCount + " eligible"],
              ["Score at assign", <><b className="font-semibold tnum">{a.candidateScore}</b> / 100</>],
              ["Rule version", <span className="font-mono">{a.ruleVersion}</span>],
              ["Assigned by", a.assignedBy + " · " + a.assignedByRole],
              ["Assigned at", dateTimeLabel(a.assignedAt)],
              ["Delivery", a.deliveryStatus === "delivered"
                ? <>Delivered {dateTimeLabel(a.deliveredAt)} <span className="text-tertiary">· dashboard + notification</span></>
                : a.deliveryStatus === "failed"
                  ? <span className="text-error-primary">Failed — the assignment stands; Operations is alerted</span>
                  : "Enqueued — the outbox has not published it yet"],
              ["Override reason", a.overrideReason || <span className="text-quaternary">— none, top-ranked</span>],
              ["Capacity", b ? <>{b.name} is <b className="font-semibold">{b.capacity.active} of {b.capacity.configured}</b> this {b.capacity.period}</> : null],
            ]} />
            <FrozenBar at={"at " + dateTimeLabel(a.assignedAt)}>
              Rank, score, factor breakdown and rule version are copied, not referenced.
            </FrozenBar>
          </Card>

          {e.outcome ? (
            <Card tight>
              <BlockHead title="Response and outcome" />
              <KvList pairs={[
                ["Published", dateTimeLabel(a.deliveredAt)],
                ["First contact", dateTimeLabel(e.outcome.firstContactAt)],
                ["Outcome", e.outcome.outcome
                  ? <StatusPill status={e.outcome.outcome} />
                  : <span className="text-quaternary">not yet reported</span>],
                ["Reason", e.outcome.reason],
                ["Notes", e.outcome.notes],
                ["Reported by", e.outcome.updatedBy + " · " + dateTimeLabel(e.outcome.updatedAt)],
              ]} />
              {e.outcome.outcome === "converted" ? (
                <div className="mt-4">
                  <InfoNote tone="warn" ico="alert"
                    short={<><b>{a.businessName}'s sale, not ours.</b></>}>
                    No amount is captured anywhere in this module. Interior bazzar's revenue from this
                    business is their <b>subscription</b>, which lives in Plans and is unrelated to
                    whether this particular customer bought anything. No dashboard may put the two on
                    one axis.
                  </InfoNote>
                </div>
              ) : null}
            </Card>
          ) : (
            <InfoNote ico="clock" short={<>
              <b>With the business, no outcome yet.</b>{a.deliveredAt
                ? <> Published {durationLabel(a.deliveredAt, new Date().toISOString())} ago.</>
                : <> Not published yet.</>}
            </>}>
              How long it has been, and nothing more. Assigning publishes to the business, so there
              is no delivery step to clear and no receipt to wait on — the next thing that moves
              this record is the outcome. Nothing here is late, because nothing is owed by a time:
              chasing a quiet business is a judgement someone makes by reading this, not a flag
              raised for them.
            </InfoNote>
          )}
        </>
      ) : null}

      {past.length ? (
        <div className="flex flex-col gap-3">
          <SectionHead title="Superseded assignments"
            desc="Closed, never deleted. The routing chain stays walkable in both directions." />
          {past.map((p) => (
            <Card key={p.assignmentId} tight>
              <KvList pairs={[
                ["Business", <b className="font-semibold">{p.businessName}</b>],
                ["Assigned", dateTimeLabel(p.assignedAt) + " by " + p.assignedBy],
                ["Rank · score", p.candidateRank + " · " + p.candidateScore + " · rule " + p.ruleVersion],
                ["Closed", dateTimeLabel(p.supersededAt)],
                ["Reason", p.closedReason],
              ]} />
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ============================================================= HISTORY === */
/* Append-only, server-stamped, no edit path. A refused access is an event too:
   a 403 that leaves no trace is a security question nobody can answer later. */
function HistoryTab({ e }: { e: Enquiry }) {
  return (
    <div className="flex flex-col gap-4">
      <Card tight>
        {e.events.length ? (
          <Timeline items={e.events.map((ev) => ({
            tone: ev.actorRole === "system" ? "sys" as const : ev.actorRole === "Business" ? "info" as const : "brand" as const,
            title: (
              <span className="flex flex-wrap items-center gap-1.5">
                <Tag label={ev.type} tone={ev.actorRole === "system" ? "indigo" : "neutral"} />
              </span>
            ),
            body: ev.note,
            meta: <>{dateTimeLabel(ev.at)} · {ev.actor}</>,
          }))} />
        ) : (
          <EmptyState flat icon="history" title="No events yet"
            body="Every state change, edit and refused access lands here the moment it happens." />
        )}
      </Card>
      <InfoNote ico="lock" short={<><b>Append-only.</b> Nothing here can be edited or removed.</>}>
        At the grant level, not the route level: there is no endpoint that edits an event and none
        that removes one, and the application role holds no UPDATE or DELETE on the event table.
        Timestamps are server-generated — an audit trail that trusts a client clock cannot establish
        what happened first, which is the only question an audit trail is ever asked.
      </InfoNote>
    </div>
  );
}
