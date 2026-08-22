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
     · the tabs are the record's other faces, not other pages: assignment,
       match snapshot, timeline. The URL carries which one, so a link to a
       timeline is a link to a timeline.
   ============================================================================= */
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EmptyState, Icon, KvList, SectionHead, Tabs } from "../../ui";
import { can, useNav } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import {
  BlockHead, FrozenBar, InfoNote, LifecycleRail, SourceChip, StatusPill, TagChips,
  TierBadge, UrgencyChip,
} from "./bits";
import { RecordMenu } from "./menus";
import { ContactEntryRow, QualifyPanel, RequirementForm } from "./Qualify";
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
      <div className="be-detail">
        <EmptyState icon="search" title="No enquiry at this reference"
          body={<>There is no enquiry with the reference <span className="mono">{id}</span>. On the real
            API a business asking for someone else's reference gets <b>403 out_of_scope</b>, never a
            404 — a 404 would confirm the id exists.</>}
          action={<button className="btn pri" onClick={() => go(listHash)}>Back to the list</button>} />
      </div>
    );
  }

  const tab = TABS.filter((t) => t.k === sp.get("tab"))[0]?.k || "enquiry";
  const setTab = (k: string) => {
    const next = new URLSearchParams(sp);
    if (k === "enquiry") next.delete("tab"); else next.set("tab", k);
    setSp(next, { replace: true });
  };

  const a = activeAssignment(e);
  const writes = can("business-enquiries", "edit");
  const done = (msg: string) => { closeLayer(); toast(msg); };

  const onAssign = (c: Candidate) =>
    modal(<AssignModal e={e} run={run} c={c} onClose={closeLayer} onDone={done} />, "wide");

  return (
    <div className="be-detail">
      <div className="be-idbar">
        <h2 className="mono">{e.enquiryId}</h2>
        <StatusPill status={e.status} lg />
        <TierBadge tier={e.tier} />
        <UrgencyChip urgency={e.qualification.urgency} />
        <TagChips tags={e.tags} />
        <span className="spacer" />
        {/* Step through the queue without going back to it. The count says
            where you are, so "am I nearly done" is answerable without
            leaving. */}
        {pos ? (
          <span className="be-stepnav">
            <button className="btn icon sm" disabled={!prev} aria-label="Previous enquiry"
              title="Previous enquiry" onClick={() => prev && go(prev)}>
              <Icon name="chevl" size="sm" />
            </button>
            <span className="ct tnum">{pos.i} / {pos.of}</span>
            <button className="btn icon sm" disabled={!next} aria-label="Next enquiry"
              title="Next enquiry" onClick={() => next && go(next)}>
              <Icon name="chevr" size="sm" />
            </button>
          </span>
        ) : null}
        <button className="btn sm" onClick={() => go(listHash)}>
          <Icon name="chevl" size="sm" />All enquiries
        </button>

        {/* Everything you do WITH the enquiry lives behind these, at the right
            end of the row: copy it, image it, print it. Everything that MOVES it
            through its lifecycle stays on the action bar in the open — a state
            change behind an overflow menu is one nobody audits and nobody
            expects. Nothing in this menu changes the record.

            `data-act` IS LOAD-BEARING, not a test hook. The shell mounts the
            popover with a document-level click listener that closes it unless
            the click landed inside `.pop` or on a `[data-act]` element. React
            flushes this discrete click — render, commit and effects — before the
            native event finishes bubbling to `document`, so the very press that
            opened the menu reaches that listener and shuts it again. Without the
            attribute the popover opens and closes within one click and nothing
            appears. Every other trigger in the panel carries one for the same
            reason. */}
        <button className="btn icon sm" data-act="be-more" aria-haspopup="menu" aria-label="Share and export"
          title="Copy · download image · print"
          onClick={(ev) => {
            const el = ev.currentTarget as HTMLElement;
            if (popAnchor === el) { closePop(); return; }
            openPop(el, <RecordMenu e={e} />, { width: 320, align: "right", cls: "pop-views" });
          }}>
          <Icon name="dots" />
        </button>
      </div>

      <div className="be-subline">
        {e.customer.name} · <span className="mono">{e.customer.phone}</span>
        {e.customer.email ? <> · <span className="mono">{e.customer.email}</span></> : null}
        {" · "}<SourceChip source={e.source} full />
        {" · "}<span className="mono">{e.source.page}</span>
        {" · "}{dateTimeLabel(e.createdAt)}
      </div>

      {/* One row, not two. See .be-chrome — the rail used to cost a full band
          of vertical space above the tabs, which pushed the actual work to the
          fold on a laptop. */}
      <div className="be-chrome">
        <Tabs items={TABS} cur={tab} onPick={setTab} />
        <LifecycleRail status={e.status} />
      </div>

      {tab === "enquiry" ? <EnquiryTab e={e} run={run} onAssign={onAssign} onQualified={done} /> : null}
      {tab === "match" ? <MatchTab e={e} run={run} /> : null}
      {tab === "assignment" ? <AssignmentTab e={e} /> : null}
      {tab === "history" ? <HistoryTab e={e} /> : null}

      {writes ? (
        <div className="be-abar">
          {/* New and Processing have no action in this bar on purpose:
              everything that moves an enquiry through qualification lives in
              the Qualification panel beside the record it acts on, not in a bar
              underneath it. */}
          {/* Reachable from No match yet too — re-running is that state's
              only way out, and the label says which of the two you are in
              because by then you have already pressed it once. */}
          {/* ONE RUN PER WINDOW. Disabled rather than hidden, and the title says
              when it comes back — an operator who cannot see why the only
              control on this state is missing will look for a bug that is not
              there. The rule itself lives in the store; this is the courtesy. */}
          {e.status === "qualified" || e.status === "no_match"
            ? (() => {
                const cool = matchCooldown(e);
                return (
                  <button className="btn pri" disabled={cool.blocked}
                    title={cool.blocked
                      ? "Last run " + dateTimeLabel(cool.lastAt) + ". Neither the frozen snapshot "
                        + "nor the business directory moves fast enough for another run to answer "
                        + "differently — next one from " + dateTimeLabel(cool.readyAt) + "."
                      : "Reads the qualification snapshot and the active rule version"}
                    onClick={() => { runMatching(e.enquiryId); toast("Matching run complete."); }}>
                    <Icon name="sparkle" />
                    {cool.blocked
                      ? "Matched " + durationLabel(cool.lastAt!, new Date().toISOString()) + " ago"
                      : e.status === "no_match" ? "Try matching again" : "Run matching"}
                  </button>
                );
              })()
            : null}
          {/* The manual route to the same state, for the operator who already
              knows the answer — the one business covering that pincode just
              suspended. Not `dgr`: this is not a rejection and it is not
              terminal, it says the supply is missing and the enquiry is fine. */}
          {e.status === "qualified"
            ? <button className="btn" title="No subscribed business can take this one — reversible, re-run matching to clear it"
                onClick={() => { markNoMatch(e.enquiryId); toast("Marked No match yet."); }}>
                No match yet
              </button>
            : null}
          {/* Assigned is now the only live state, so the outcome is recorded
              straight from it. There is no acknowledgement step to wait on and
              no Delivered state to pass through — assigning publishes. */}
          {e.status === "assigned" && a
            ? <button className="btn pri" onClick={() => modal(<OutcomeModal e={e} onClose={closeLayer} onDone={done} />)}>
                Record outcome
              </button>
            : null}
          {a && !isTerminal(e.status)
            ? <button className="btn" onClick={() => modal(<ReassignModal e={e} run={run} onClose={closeLayer} onDone={done} />, "wide")}>
                Reassign <span className="pill warn xs">Admin</span>
              </button>
            : null}
          <span className="spacer" />
          {!isTerminal(e.status)
            ? <button className="btn dgr" onClick={() => modal(<InvalidateModal e={e} onClose={closeLayer} onDone={done} />)}>
                Reject
              </button>
            : <span className="faint be-terminal">
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
     While an enquiry is New or Processing it is a piece of work: the record is editable
     and the right-hand column is the qualification panel. Once a person has
     marked it Qualified it becomes a piece of evidence: the record is frozen
     and the right-hand column is the ranked businesses. Same layout, same two
     columns, opposite jobs — which is why the branch is here and not two
     separate routes. */
  const working = isWorking(e.status);

  return (
    <div className="be-pane">
      <div>
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
            <span className="mono">422 no_eligible_business</span> is an exception, not an error the
            customer caused. If a lapsed subscription renews tomorrow this becomes assignable with
            nobody re-entering anything — the snapshot is intact and stage 1 simply passes.
          </InfoNote>
        ) : null}

        {e.invalidation ? (
          <div className="be-blk bad">
            <BlockHead title="Invalidation" />
            <KvList pairs={[
              ["Reason", <b>{e.invalidation.reason}</b>],
              ["Detected", <>{e.invalidation.detectedBy} · {dateTimeLabel(e.invalidation.detectedAt)}</>],
              ["Note", e.invalidation.note],
            ]} />
          </div>
        ) : null}
      </div>

      <div>
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

   Deliberately plainer than the contact log beside it. A remark has no channel,
   no outcome and no channel — it is a sentence and a name, and dressing it up
   to match the log would suggest the two are the same kind of record. */
function RemarksBlock({ e }: { e: Enquiry }) {
  const writes = can("business-enquiries", "edit");
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim()) return;
    addRemark(e.enquiryId, text);
    setText("");
  };

  return (
    <div className="be-blk">
      <BlockHead
        title={<>Remarks{e.remarks.length ? <> · {e.remarks.length}</> : null}</>}
        info={<>
          What <b>we</b> think — as opposed to the contact log, which is what the customer said. A
          remark has no attempt attached, so it does not count towards the qualification gate and does
          not touch "contacted" or "reached".
          <br /><br />
          <b>A remark never leaves this panel.</b> Not in an export, a copy, a printed sheet or a
          shared image. It is the most candid thing written about a customer anywhere in the module,
          which is exactly why it is the least shareable. The timeline records that one was added and
          by whom — never its text.
        </>} />

      {writes ? (
        <div className="be-rm-new"
          onKeyDown={(ev) => {
            if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") { ev.preventDefault(); submit(); }
          }}>
          <textarea className="inp" rows={2} value={text} aria-label="Add a remark"
            placeholder="Something worth knowing that the customer did not say…"
            onChange={(ev) => setText(ev.target.value)} />
          <div className="be-rm-f">
            <span className="faint">
              Append-only — <span className="kbd">Ctrl</span>+<span className="kbd">Enter</span>
            </span>
            <span className="spacer" />
            <button className="btn sm pri" disabled={!text.trim()} onClick={submit}>Add remark</button>
          </div>
        </div>
      ) : null}

      {e.remarks.length ? (
        <div className="be-rm-list">
          {e.remarks.map((r) => (
            <div className="be-rm" key={r.remarkId}>
              <p>{r.text}</p>
              <div className="by">{r.actor} · {r.actorRole} · {dateTimeLabel(r.at)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="be-rm-empty">
          No remarks. {writes ? "Add one when you learn something the form and the call did not capture." : null}
        </div>
      )}
    </div>
  );
}

/* The requirement, once it is settled. Same fields as the form above it, read
   only, because after qualification these are the values a business was matched
   on and changing one would change the meaning of a frozen score. */
function RequirementBlock({ e }: { e: Enquiry }) {
  return (
    <div className="be-blk">
      <BlockHead title="Requirement · as confirmed" info={<>
        <b>Tier {e.tier}</b> — {tierOf(e.tier).help} It is an intake signal: what the submission itself
        told us before anyone spoke to the customer, never a judgement of the customer, and it carries
        no weight in matching.
        <br /><br />
        The line in quotes is what the customer typed into the form. What they went on to <i>say</i> is
        in the contact log below, and the two are kept apart on purpose — the first is what we received,
        the second is what we established.
      </>} />
      <KvList pairs={[
        ["Category", e.requirement.category ? <b>{e.requirement.category}</b> : null],
        ["Service", e.requirement.service],
        ["Location", e.requirement.city
          ? <><b>{place(e)}</b>
              {e.requirement.state ? ", " + e.requirement.state : ""}
              {e.requirement.pincode ? " · " + e.requirement.pincode : ""}</>
          : null],
        ["Project type", e.requirement.projectType],
        ["Intent", e.requirement.intent],
        ["Urgency", <UrgencyChip urgency={e.qualification.urgency} />],
        ["Source", <SourceChip source={e.source} full />],
      ]} />
      <div className="be-quote">“{e.requirement.text}”</div>
    </div>
  );
}

/* The snapshot, after the freeze. */
function SnapshotBlock({ e }: { e: Enquiry }) {
  const q = e.qualification;
  return (
    <div className="be-blk">
      <BlockHead title="Qualification snapshot" info={<>
        Qualification is three things — contact, genuineness and urgency. <b>Budget is not one of
        them</b>: not a field here, not a filter on the list, not a scoring factor and not a sort.
        There is no column for a future feature to reach for.
      </>} />
      <KvList pairs={[
        ["Qualified by", q.qualifiedBy
          ? <><b>{q.qualifiedBy}</b> <span className="faint">· {q.qualifiedByRole}</span></>
          : <span className="be-fail">Nobody — this record never passed qualification</span>],
        ["Contact verified", q.contactVerified
          ? <>Yes — {q.verifiedVia}</>
          : <span className="be-fail">No</span>],
        ["Genuineness", q.genuineness === "passed"
          ? <>Passed <span className="faint">— {q.genuinenessNote}</span></>
          : <span className="be-fail">{q.genuineness} — {q.genuinenessNote}</span>],
        ["Urgency band", <UrgencyChip urgency={q.urgency} />],
        ["Summary", q.requirementSummary],
        ["Checks", <ChecklistRead e={e} />],
        ["Version", q.version ? <span className="mono">{q.version}</span> : null],
        ["Submission", <span className="mono">{e.submissionId}</span>],
      ]} />
      {q.frozenAt ? (
        <FrozenBar at={"at qualification, " + dateTimeLabel(q.frozenAt)}>
          Not editable by anyone, at any role. Corrections append an annotation event; the snapshot
          itself never changes.
        </FrozenBar>
      ) : (
        <InfoNote tone="bad" ico="alert" short={<><b>Never frozen</b> — this record was never qualified.</>}>
          There is no snapshot to stand behind. That is correct for a Rejectid record and would be a
          defect for any other.
        </InfoNote>
      )}
    </div>
  );
}

function ChecklistRead({ e }: { e: Enquiry }) {
  return (
    <span className="be-checkread">
      {CHECKLIST.map((row) => {
        const on = e.qualification.checklist[row.key];
        return (
          <span key={row.key} className={on ? "on" : ""} title={row.help}>
            <Icon name={on ? "check" : "x"} size="sm" />{row.label}
          </span>
        );
      })}
    </span>
  );
}

/* The contact log, read only. Every attempt, in the customer's words where
   there were any. */
function ContactLogBlock({ e }: { e: Enquiry }) {
  const last = lastResponse(e);
  return (
    <div className="be-blk">
      <BlockHead
        title={<>How it was qualified · {e.contactLog.length} contact{e.contactLog.length === 1 ? "" : "s"}</>}
        info={<>
          Append-only, like the timeline. An attempt that went nowhere stays on the record: three of
          them is the difference between an enquiry worth chasing and one worth closing.
        </>} />
      <div className="be-log">
        {e.contactLog.map((entry) => (
          <ContactEntryRow key={entry.logId} entry={entry} isLast={entry.logId === last?.logId} />
        ))}
      </div>
    </div>
  );
}

/* =============================================================== MATCH === */
function MatchTab({ e, run }: { e: Enquiry; run: MatchRun | null }) {
  return (
    <div className="be-single">
      <MatchSnapshot e={e} run={run} />
      {run ? (
        <>
          <SectionHead title="Stage 1 — hard eligibility"
            desc="All of these must pass. One failure removes the business entirely — stage 2 never runs for it." />
          <div className="be-blk">
            <KvList pairs={run.eligible.length
              ? [["Result", <><b>{run.eligible.length} eligible</b> of {run.subscribedCount} subscribed, {run.excluded.length} excluded with reasons</>]]
              : [["Result", <span className="be-fail"><b>0 eligible</b> of {run.subscribedCount} subscribed</span>]]} />
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
      <div className="be-single">
        <EmptyState icon="route" title="Not assigned yet"
          body="Nothing has been routed. The enquiry is still with Operations, and no capacity has moved." />
      </div>
    );
  }

  const b = a ? businessById(a.businessId) : null;

  return (
    <div className="be-single">
      {a ? (
        <>
          <div className="be-blk">
            <BlockHead title="The active assignment" />
            <KvList pairs={[
              ["Business", <b>{a.businessName}</b>],
              ["Rank at assign", a.candidateRank + " of " + a.eligibleCount + " eligible"],
              ["Score at assign", <><b className="tnum">{a.candidateScore}</b> / 100</>],
              ["Rule version", <span className="mono">{a.ruleVersion}</span>],
              ["Assigned by", a.assignedBy + " · " + a.assignedByRole],
              ["Assigned at", dateTimeLabel(a.assignedAt)],
              ["Delivery", a.deliveryStatus === "delivered"
                ? <>Delivered {dateTimeLabel(a.deliveredAt)} <span className="faint">· dashboard + notification</span></>
                : a.deliveryStatus === "failed"
                  ? <span className="be-fail">Failed — the assignment stands; Operations is alerted</span>
                  : "Enqueued — the outbox has not published it yet"],
              ["Override reason", a.overrideReason || <span className="faint">— none, top-ranked</span>],
              ["Capacity", b ? <>{b.name} is <b>{b.capacity.active} of {b.capacity.configured}</b> this {b.capacity.period}</> : null],
            ]} />
            <FrozenBar at={"at " + dateTimeLabel(a.assignedAt)}>
              Rank, score, factor breakdown and rule version are copied, not referenced.
            </FrozenBar>
          </div>

          {e.outcome ? (
            <div className="be-blk">
              <BlockHead title="Response and outcome" />
              <KvList pairs={[
                ["Published", dateTimeLabel(a.deliveredAt)],
                ["First contact", dateTimeLabel(e.outcome.firstContactAt)],
                ["Outcome", e.outcome.outcome
                  ? <StatusPill status={e.outcome.outcome} />
                  : <span className="faint">not yet reported</span>],
                ["Reason", e.outcome.reason],
                ["Notes", e.outcome.notes],
                ["Reported by", e.outcome.updatedBy + " · " + dateTimeLabel(e.outcome.updatedAt)],
              ]} />
              {e.outcome.outcome === "converted" ? (
                <InfoNote tone="warn" ico="alert"
                  short={<><b>{a.businessName}'s sale, not ours.</b></>}>
                  No amount is captured anywhere in this module. Interior bazzar's revenue from this
                  business is their <b>subscription</b>, which lives in Plans and is unrelated to
                  whether this particular customer bought anything. No dashboard may put the two on
                  one axis.
                </InfoNote>
              ) : null}
            </div>
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
        <>
          <SectionHead title="Superseded assignments"
            desc="Closed, never deleted. The routing chain stays walkable in both directions." />
          {past.map((p) => (
            <div className="be-blk quiet" key={p.assignmentId}>
              <KvList pairs={[
                ["Business", <b>{p.businessName}</b>],
                ["Assigned", dateTimeLabel(p.assignedAt) + " by " + p.assignedBy],
                ["Rank · score", p.candidateRank + " · " + p.candidateScore + " · rule " + p.ruleVersion],
                ["Closed", dateTimeLabel(p.supersededAt)],
                ["Reason", p.closedReason],
              ]} />
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}

/* ============================================================= HISTORY === */
/* Append-only, server-stamped, no edit path. A refused access is an event too:
   a 403 that leaves no trace is a security question nobody can answer later. */
function HistoryTab({ e }: { e: Enquiry }) {
  return (
    <div className="be-single">
      <div className="be-blk">
        {e.events.map((ev) => (
          <div className="be-ev" key={ev.eventId}>
            <span className={"ty" + (ev.actorRole === "system" ? " sys" : ev.actorRole === "Business" ? " biz" : "")}>
              {ev.type}
            </span>
            <div>{ev.note}</div>
            <span className="w">{dateTimeLabel(ev.at)} · {ev.actor}</span>
          </div>
        ))}
      </div>
      <InfoNote ico="lock" short={<><b>Append-only.</b> Nothing here can be edited or removed.</>}>
        At the grant level, not the route level: there is no endpoint that edits an event and none
        that removes one, and the application role holds no UPDATE or DELETE on the event table.
        Timestamps are server-generated — an audit trail that trusts a client clock cannot establish
        what happened first, which is the only question an audit trail is ever asked.
      </InfoNote>
    </div>
  );
}
