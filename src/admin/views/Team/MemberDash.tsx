/* =============================================================================
   Member dashboard — #/me · #/me/:id
   -----------------------------------------------------------------------------
     #/me            the team, as a table — click a member to open their day
     #/me/:id        one member: overview · attendance · work · reports · leave

   ONE COMPONENT, THREE SCOPES. Who is looking decides the tabs and the actions,
   not three separate screens: a member sees everything of their own, a senior
   sees the operational half of somebody who reports to them, and an admin sees
   the record. The tab bar is a function of the viewer for exactly that reason.

   The Work tab renders the SAME three blocks as the calendar rail and the
   roll-up — tasks ▸ milestones ▸ targets, from workBits — so a member reads the
   same three blocks wherever they are standing.

   NO API YET — src/content/team/*.json through store.ts.
   ============================================================================= */
import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import {
  Icon, KvList, Notice, Pill, SectionHead, Table, Tabs, TbTitle, Tiles, qs,
} from "../../ui";
import {
  ATT_STATE, LEAVE_KIND, LEAVE_STATE, TODAY, addDays, attendanceTotals, dayRows, decideLeave, fmtDate,
  fmtHM, isDelayed, isTerminal, labelOf, leaveFor, meId, membersInScope, planFor, readItems,
  readMember, reportFor, requestLeave, toneOf, useLeave, useMembers, workedOf,
} from "./store";
import type { LeaveRequest, LeaveState, Member } from "./store";
import { DayBar, StatePill, Who } from "./bits";
import { MarksBlock, TasksBlock } from "./workBits";
import "./team.css";

const TABS = [
  { k: "overview", l: "Overview" }, { k: "attendance", l: "Attendance" },
  { k: "work", l: "Work" }, { k: "reports", l: "Reports" }, { k: "leave", l: "Leave" },
];

export default function MemberDash() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const members = useMembers();
  const me = meId();
  const target = id || me;
  const m = readMember(target);
  const tab = sp.get("tab") || "overview";

  usePageChrome({
    crumbs: <TbTitle label={m ? m.name : "My dashboard"} to="#/me" />,
    parent: id ? "#/me" : null,
  }, tab);

  if (!id) return <Roster members={members} me={me} />;
  if (!m) return <Notice tone="bad" text="No such member." />;

  const viewer = target === me ? "self" : m.reportsTo === me ? "senior" : "admin";

  return (
    <div className="dls">
      <div className="dls-cmd tm-mh">
        <Who m={m} sub={m.designation + " · " + (m.department || "—")} />
        <span className="spacer" />
        <span className="cell-2">{viewer === "self" ? "your own dashboard" : viewer === "senior" ? "reports to you" : "admin view"}</span>
        <a className="btn sm" href={"#/work" + qs({ member: m.memberId, face: "board" })}>Open their board</a>
      </div>

      <Tabs items={TABS.map((t) => ({ k: t.k, label: t.l }))} cur={tab}
        onPick={(k) => { window.location.hash = "/me/" + m.memberId + qs({ tab: k === "overview" ? "" : k }); }} />

      <div className="dls-body">
        {tab === "attendance" ? <AttendanceTab m={m} />
          : tab === "work" ? <WorkTab m={m} />
          : tab === "reports" ? <ReportsTab m={m} />
          : tab === "leave" ? <LeaveTab m={m} viewer={viewer} />
          : <OverviewTab m={m} viewer={viewer} />}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- roster --- */

/** The table the module opens on when no member is named. A row is a person and
 *  it opens their day — the drawer on `#/team` stays what it is, the identity
 *  record. */
function Roster({ members, me }: { members: Member[]; me: string }) {
  const rows = members.filter((m) => m.status === "active");
  return (
    <div className="dls">
      <div className="dls-body">
        <SectionHead title="The team" desc="A row opens that member's dashboard." />
        <Table
          cols={[{ label: "Member" }, { label: "Reports to", w: "180px" },
            { label: "Today", w: "150px" }, { label: "Open work", w: "110px" },
            { label: "In delay", w: "100px" }]}
          rows={rows.map((m) => {
            const items = readItems().filter((i) => i.assigneeId === m.memberId);
            const open = items.filter((i) => !isTerminal(i.status));
            const late = open.filter((i) => isDelayed(i));
            const day = dayRows(TODAY, "all").filter((r) => r.member.memberId === m.memberId)[0];
            return (
              <tr key={m.memberId} className="clickable" tabIndex={0} role="link"
                onClick={() => { window.location.hash = "/me/" + m.memberId; }}
                onKeyDown={(e) => { if (e.key === "Enter") window.location.hash = "/me/" + m.memberId; }}>
                <td><Who m={m} sub={m.memberId === me ? "you" : m.designation} /></td>
                <td>{m.reportsTo ? (readMember(m.reportsTo)?.name || "—") : <span className="dim">—</span>}</td>
                <td>{day ? <StatePill state={day.state} /> : <span className="dim">—</span>}</td>
                <td className="tnum">{open.length}</td>
                <td className="tnum">{late.length ? <span className="u-warn-t">{late.length}</span> : "0"}</td>
              </tr>
            );
          })} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ overview --- */

function OverviewTab({ m, viewer }: { m: Member; viewer: string }) {
  const items = readItems().filter((i) => i.assigneeId === m.memberId);
  const open = items.filter((i) => !isTerminal(i.status));
  const late = open.filter((i) => isDelayed(i));
  const day = dayRows(TODAY, "all").filter((r) => r.member.memberId === m.memberId)[0];
  const plan = planFor(m.memberId, TODAY);
  const report = reportFor(m.memberId, TODAY);
  const ms = items.filter((i) => i.kind === "milestone" && !isTerminal(i.status))[0];

  return (
    <>
      <Tiles list={[
        { k: "Today", v: day ? labelOf(ATT_STATE, day.state) : "—", s: day && day.day ? fmtHM(workedOf(day.day, m)) : "no row yet" },
        { k: "Open work", v: String(open.length), s: late.length + " in delay", tone: late.length ? "warn" : "" },
        { k: "Plan", v: plan && plan.submittedAt ? "in" : "missing", s: "for " + fmtDate(TODAY), tone: plan && plan.submittedAt ? "" : "warn" },
        { k: "EOD", v: report && report.submittedAt ? "in" : "not yet", s: "the day is not over", tone: "" },
      ]} />

      <SectionHead title="Record" />
      <KvList cls="wide" pairs={[
        ["Designation", m.designation],
        ["Department", m.department || "—"],
        ["Reports to", m.reportsTo ? (readMember(m.reportsTo)?.name || "—") : "Nobody"],
        ["Employment", m.employmentType.replace("_", " ")],
        ["Joined", fmtDate(m.joiningDate)],
        ["Day starts", m.dayStartsAt + " · " + m.graceMinutes + "m grace"],
      ]} />

      {ms ? (
        <>
          <SectionHead title="Milestone" desc="Progress is completed children ÷ total, computed here." />
          <MarksBlock kind="milestone" who={m.memberId} onOpen={openItem} />
        </>
      ) : null}

      {viewer !== "self" ? (
        <Notice text="Pay and documents are not on this view. A reporting line does not imply access to somebody's pay." />
      ) : null}
    </>
  );
}

const openItem = (id: string) => { window.location.hash = "/work" + qs({ item: id }); };

/* ---------------------------------------------------------- attendance --- */

function AttendanceTab({ m }: { m: Member }) {
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) days.push(addDays(TODAY, -i));
  const rows = days.map((d) => ({ d, row: dayRows(d, "all").filter((r) => r.member.memberId === m.memberId)[0] }))
    .filter((x) => !!x.row);
  const tot = attendanceTotals(rows.map((x) => x.row));

  return (
    <>
      <Tiles list={[
        { k: "Present", v: String(tot.present), s: "of " + rows.length + " days" },
        { k: "Late", v: String(tot.late), s: "against their own start", tone: tot.late ? "warn" : "" },
        { k: "Absent", v: String(tot.absent), s: "derived, never stored", tone: tot.absent ? "bad" : "" },
        { k: "Unclosed", v: String(tot.unclosed), s: "nothing auto-closes", tone: tot.unclosed ? "warn" : "" },
      ]} />
      <SectionHead title="The last two weeks" desc="An unclosed day counts as nothing until a person resolves it." />
      <Table
        cols={[{ label: "Day", w: "150px" }, { label: "State", w: "140px" },
          { label: "The day", w: "260px" }, { label: "Worked", w: "110px" }, { label: "Break", w: "100px" }]}
        rows={rows.map(({ d, row }) => (
          <tr key={d}>
            <td>{fmtDate(d)}</td>
            <td><StatePill state={row.state} /></td>
            <td><DayBar row={row} nowH={14.33} /></td>
            <td className="tnum">{fmtHM(row.day ? workedOf(row.day, m) : null)}</td>
            <td className="tnum">{row.day ? fmtHM(row.day.breakMinutes) : "—"}</td>
          </tr>
        ))} />
    </>
  );
}

/* ---------------------------------------------------------------- work --- */

function WorkTab({ m }: { m: Member }) {
  return (
    <>
      <SectionHead title="Work" desc="Tasks, then milestones, then targets — the same three blocks as the calendar rail." />
      <div className="tm-cols3">
        <TasksBlock who={m.memberId} onOpen={openItem} />
        <MarksBlock kind="milestone" who={m.memberId} onOpen={openItem} />
        <MarksBlock kind="target" who={m.memberId} onOpen={openItem} />
      </div>
    </>
  );
}

/* ------------------------------------------------------------- reports --- */

function ReportsTab({ m }: { m: Member }) {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) days.push(addDays(TODAY, -i));
  return (
    <>
      <SectionHead title="Plans and EOD" desc="Seven days. A report nobody read is worse than one nobody wrote." />
      <Table
        cols={[{ label: "Day", w: "150px" }, { label: "Plan", w: "120px" },
          { label: "EOD", w: "120px" }, { label: "Read", w: "140px" }, { label: "What they wrote" }]}
        rows={days.map((d) => {
          const plan = planFor(m.memberId, d);
          const rep = reportFor(m.memberId, d);
          return (
            <tr key={d}>
              <td>{fmtDate(d)}</td>
              <td>{plan && plan.submittedAt ? <Pill text="in" tone="ok" /> : <span className="dim">—</span>}</td>
              <td>{rep && rep.submittedAt ? <Pill text="in" tone="ok" /> : <span className="dim">—</span>}</td>
              <td>{rep && rep.acknowledgedById
                ? (readMember(rep.acknowledgedById)?.name || "read")
                : rep && rep.submittedAt ? <Pill text="unread" tone="info" /> : <span className="dim">—</span>}</td>
              <td>{rep ? (rep.achievement || rep.notes || <span className="dim">—</span>) : <span className="dim">—</span>}</td>
            </tr>
          );
        })} />
    </>
  );
}

/* --------------------------------------------------------------- leave --- */

function LeaveTab({ m, viewer }: { m: Member; viewer: string }) {
  const shell = useShell();
  useLeave();
  const rows = leaveFor(m.memberId);
  const me = meId();
  const canDecide = viewer !== "self" && membersInScope("team", me).some((x) => x.memberId === m.memberId);

  const decide = (l: LeaveRequest, state: LeaveState, note?: string) => {
    const r = decideLeave(l.leaveId, state, me, note);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.toast("Leave " + state + ".");
  };

  return (
    <>
      <SectionHead title="Leave"
        desc="Approved leave suppresses a derived absence. It never writes an attendance row."
        right={viewer === "self"
          ? <button className="btn pri sm" onClick={() => shell.modal(<LeaveModal memberId={m.memberId} />, "sm")}>Request leave</button>
          : undefined} />
      <Table
        cols={[{ label: "Dates", w: "200px" }, { label: "Kind", w: "110px" },
          { label: "State", w: "130px" }, { label: "Reason" }, { label: "", w: "180px" }]}
        empty={{ icon: "calendar", title: "No leave", body: "Nothing requested or taken." }}
        rows={rows.map((l) => (
          <tr key={l.leaveId}>
            <td>{fmtDate(l.fromDate)}{l.toDate !== l.fromDate ? " – " + fmtDate(l.toDate) : ""}</td>
            <td>{labelOf(LEAVE_KIND, l.kind)}</td>
            <td><Pill text={labelOf(LEAVE_STATE, l.state)} tone={toneOf(LEAVE_STATE, l.state)} /></td>
            <td>{l.reason}{l.decisionNote ? <span className="cell-2">{l.decisionNote}</span> : null}</td>
            <td>
              {l.state === "requested" && canDecide ? (
                <>
                  <button className="btn sm" onClick={() => shell.modal(
                    <RejectModal onSubmit={(n) => { shell.closeLayer(); decide(l, "rejected", n); }} />, "sm")}>Reject…</button>
                  <button className="btn pri sm" onClick={() => decide(l, "approved")}>Approve</button>
                </>
              ) : null}
              {l.state === "requested" && viewer === "self"
                ? <button className="btn sm" onClick={() => decide(l, "withdrawn")}>Withdraw</button> : null}
            </td>
          </tr>
        ))} />
    </>
  );
}

function LeaveModal({ memberId }: { memberId: string }) {
  const shell = useShell();
  const [from, setFrom] = useState(addDays(TODAY, 3));
  const [to, setTo] = useState(addDays(TODAY, 3));
  const [kind, setKind] = useState("casual");
  const [why, setWhy] = useState("");
  const save = () => {
    const r = requestLeave(memberId, { fromDate: from, toDate: to, kind, reason: why });
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.closeLayer();
    shell.toast("Leave requested.");
  };
  return (
    <>
      <div className="md-h">
        <h3>Request leave</h3>
        <button className="btn icon sm md-x" aria-label="Close" onClick={() => shell.closeLayer()}>
          <Icon name="x" size="sm" />
        </button>
      </div>
      <div className="md-b">
        <div className="fg2">
          <div className="fg">
            <label htmlFor="lvFrom">From</label>
            <input id="lvFrom" type="date" className="inp" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="fg">
            <label htmlFor="lvTo">To</label>
            <input id="lvTo" type="date" className="inp" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div className="fg">
          <label htmlFor="lvKind">Kind</label>
          <select id="lvKind" className="inp" value={kind} onChange={(e) => setKind(e.target.value)}>
            {["casual", "sick", "unpaid"].map((k) => <option key={k} value={k}>{labelOf(LEAVE_KIND, k)}</option>)}
          </select>
        </div>
        <div className="fg">
          <label htmlFor="lvWhy">Reason <b className="req">*</b></label>
          <input id="lvWhy" className="inp" value={why} onChange={(e) => setWhy(e.target.value)} />
        </div>
      </div>
      <div className="md-f">
        <span className="spacer" />
        <button className="btn" onClick={() => shell.closeLayer()}>Cancel</button>
        <button className="btn pri" disabled={!why.trim()} onClick={save}>Request</button>
      </div>
    </>
  );
}

function RejectModal({ onSubmit }: { onSubmit: (note: string) => void }) {
  const shell = useShell();
  const [v, setV] = useState("");
  return (
    <>
      <div className="md-h">
        <h3>Refuse this request</h3>
        <button className="btn icon sm md-x" aria-label="Close" onClick={() => shell.closeLayer()}>
          <Icon name="x" size="sm" />
        </button>
      </div>
      <div className="md-b">
        <div className="fg">
          <label htmlFor="lvNo">Reason <b className="req">*</b></label>
          <input id="lvNo" className="inp" autoFocus value={v} onChange={(e) => setV(e.target.value)} />
          <span className="help">The member sees it on the row.</span>
        </div>
      </div>
      <div className="md-f">
        <span className="spacer" />
        <button className="btn" onClick={() => shell.closeLayer()}>Cancel</button>
        <button className="btn dgr" disabled={!v.trim()} onClick={() => onSubmit(v)}>Refuse</button>
      </div>
    </>
  );
}
