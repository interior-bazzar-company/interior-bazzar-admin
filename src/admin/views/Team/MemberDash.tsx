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
  AGREEMENT_KIND, AGREEMENT_STATE, ATT_STATE, LEAVE_KIND, LEAVE_STATE, RESOURCE_KIND, TODAY,
  addDays, addResource, agreementsFor, attendanceTotals, dayRows, decideLeave, deleteResource,
  fmtDate, fmtHM, incentiveTotal, isDelayed, isTerminal, labelOf, leaveFor, meId, membersInScope,
  missingDocs, payFor, planFor, readItems, readMember, reportFor, requestLeave, resourcesFor,
  revokeAgreement, sendAgreement, signAgreement, tagsOwnedBy, toneOf, useAgreements, useLeave,
  useMembers, useResources, useTags, verifyResource, workedOf,
} from "./store";
import type { Agreement, LeaveRequest, LeaveState, Member } from "./store";
import { DayBar, StatePill, Who } from "./bits";
import { MarksBlock, TasksBlock } from "./workBits";
import "./team.css";

/* SIX TABS. Leave is a block inside Attendance rather than a seventh: it is
   about days, and the tab bar is the one place a screen gets crowded quietly.
   Documents and Pay are not shown to a senior — a reporting line does not imply
   access to somebody's PAN card or their salary. */
const TABS = [
  { k: "overview", l: "Overview" }, { k: "attendance", l: "Attendance" },
  { k: "work", l: "Work" }, { k: "reports", l: "Reports" },
  { k: "documents", l: "Documents" }, { k: "pay", l: "Pay" },
];
const PRIVATE_TABS = ["documents", "pay"];

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
  /* The identity half (`#/team`) is LIVE and the operational half is not: a
     member the roster knows may have no attendance, work or leave behind them
     yet. Say which half is missing rather than 404 on a person who exists. */
  if (!m) return <NotSeeded id={id} members={members} me={me} />;

  const viewer = target === me ? "self" : m.reportsTo === me ? "senior" : "admin";

  return (
    <div className="dls">
      <div className="dls-cmd tm-mh">
        <Who m={m} sub={m.designation + " · " + (m.department || "—")} />
        <span className="spacer" />
        <span className="cell-2">{viewer === "self" ? "your own dashboard" : viewer === "senior" ? "reports to you" : "admin view"}</span>
        <a className="btn sm" href={"#/work" + qs({ member: m.memberId, face: "board" })}>Open their board</a>
      </div>

      <Tabs items={TABS.filter((t) => viewer !== "senior" || PRIVATE_TABS.indexOf(t.k) < 0)
        .map((t) => ({ k: t.k, label: t.l }))} cur={tab}
        onPick={(k) => { window.location.hash = "/me/" + m.memberId + qs({ tab: k === "overview" ? "" : k }); }} />

      <div className="dls-body">
        {tab === "attendance" ? <AttendanceTab m={m} viewer={viewer} />
          : tab === "work" ? <WorkTab m={m} />
          : tab === "reports" ? <ReportsTab m={m} />
          : tab === "documents" ? (viewer === "senior" ? <Refused /> : <DocumentsTab m={m} viewer={viewer} />)
          : tab === "pay" ? (viewer === "senior" ? <Refused /> : <PayTab m={m} />)
          : <OverviewTab m={m} viewer={viewer} />}
      </div>
    </div>
  );
}

function NotSeeded({ id, members, me }: { id: string; members: Member[]; me: string }) {
  return (
    <div className="dls">
      <div className="dls-body">
        <Notice tone="warn" text={"Member " + id + " has no operational record yet — attendance, work and leave arrive with the API. The eight below are the seed."} />
        <Roster members={members} me={me} />
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

function AttendanceTab({ m, viewer }: { m: Member; viewer: string }) {
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
      <LeaveBlock m={m} viewer={viewer} />
    </>
  );
}

/* ---------------------------------------------------------------- work --- */

function WorkTab({ m }: { m: Member }) {
  useTags();
  const mine = tagsOwnedBy(m.memberId);
  return (
    <>
      <SectionHead title="Work" desc="Tasks, then milestones, then targets — the same three blocks as the calendar rail." />
      <div className="tm-cols3">
        <TasksBlock who={m.memberId} onOpen={openItem} />
        <MarksBlock kind="milestone" who={m.memberId} onOpen={openItem} />
        <MarksBlock kind="target" who={m.memberId} onOpen={openItem} />
      </div>

      <SectionHead title="Their tags" desc="A tag is a record its owner holds. Nobody else can rename or delete it." />
      <div className="tm-tagrow">
        {mine.length
          ? mine.map((t) => (
            <span key={t.tagId} className={"tm-tag" + (t.colourToken ? " k-" + t.colourToken : "")}>
              {t.label}
              <span className="dim"> {readItems().filter((i) => (i.tagIds || []).indexOf(t.tagId) >= 0).length}</span>
            </span>
          ))
          : <span className="dim">None yet.</span>}
      </div>
      <p className="tm-foot">Tags are born in the item drawer, one keystroke from the picker.</p>
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

function LeaveBlock({ m, viewer }: { m: Member; viewer: string }) {
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

function Refused() {
  return <Notice tone="warn" text="Not on this view. A reporting line does not imply access to somebody's documents or pay." />;
}

/* ----------------------------------------------------------- documents --- */

/** TWO BUCKETS, ONE TAB. An agreement travels company → member and is frozen at
 *  send; a resource travels member → company and the member may delete it. They
 *  differ in direction, permission and retention — which is not what a tab
 *  decides, so they share one and stay two lists. */
function DocumentsTab({ m, viewer }: { m: Member; viewer: string }) {
  const shell = useShell();
  useAgreements(); useResources();
  const ags = agreementsFor(m.memberId);
  const res = resourcesFor(m.memberId);
  const missing = missingDocs(m.memberId);

  return (
    <>
      <SectionHead title="Agreements" desc="Company to member. Frozen at send; a template edit makes a new version."
        right={viewer === "admin"
          ? <button className="btn pri sm" onClick={() => shell.modal(<SendModal memberId={m.memberId} />, "sm")}>Send</button>
          : undefined} />
      <Table
        cols={[{ label: "Document" }, { label: "State", w: "130px" }, { label: "Sent", w: "130px" },
          { label: "Signed", w: "190px" }, { label: "", w: "170px" }]}
        empty={{ icon: "doc", title: "Nothing sent", body: "No agreement has gone out yet." }}
        rows={ags.map((a) => (
          <tr key={a.agreementId}>
            <td><b>{a.title}</b><span className="cell-2">{labelOf(AGREEMENT_KIND, a.kind)} · v{a.version}</span></td>
            <td><Pill text={labelOf(AGREEMENT_STATE, a.state)} tone={toneOf(AGREEMENT_STATE, a.state)} /></td>
            <td>{a.sentAt ? fmtDate(a.sentAt.slice(0, 10)) : "—"}</td>
            <td>{a.signedAt
              ? <>{a.signedName}<span className="cell-2">{fmtDate(a.signedAt.slice(0, 10))} · {a.signerIp}</span></>
              : a.expiresAt ? <span className="dim">link expires {fmtDate(a.expiresAt)}</span> : <span className="dim">—</span>}</td>
            <td>
              {a.state !== "signed" && a.state !== "revoked" && viewer === "self"
                ? <button className="btn pri sm" onClick={() => shell.modal(<SignModal a={a} />, "sm")}>Open and sign</button> : null}
              {a.state !== "signed" && a.state !== "revoked" && viewer === "admin"
                ? <button className="btn sm" onClick={() => {
                  const r = revokeAgreement(a.agreementId);
                  shell.toast(r.ok ? "Link revoked." : r.message, r.ok ? "" : "bad");
                }}>Revoke</button> : null}
            </td>
          </tr>
        ))} />

      <SectionHead title="Their documents" desc="Member to company. The member may delete their own."
        right={viewer === "self"
          ? <button className="btn pri sm" onClick={() => shell.modal(<UploadModal memberId={m.memberId} />, "sm")}>Add</button>
          : undefined} />
      {missing.length ? (
        <Notice tone="warn" text={missing.length + " required: " + missing.map((k) => labelOf(RESOURCE_KIND, k)).join(", ")} />
      ) : null}
      <Table
        cols={[{ label: "Document" }, { label: "Kind", w: "150px" }, { label: "Added", w: "130px" },
          { label: "Verified", w: "170px" }, { label: "", w: "150px" }]}
        empty={{ icon: "doc", title: "Nothing yet", body: "No document has been handed over." }}
        rows={res.map((r) => (
          <tr key={r.resourceId}>
            <td><b>{r.label}</b><span className="cell-2">{r.fileName} · {r.sizeKb} KB</span></td>
            <td>{labelOf(RESOURCE_KIND, r.kind)}</td>
            <td>{fmtDate(r.uploadedAt.slice(0, 10))}</td>
            <td>{r.verifiedById
              ? (readMember(r.verifiedById)?.name || "verified")
              : <Pill text="not verified" tone="warn" />}</td>
            <td>
              {viewer === "self"
                ? <button className="btn sm dgr" onClick={() => {
                  const x = deleteResource(r.resourceId);
                  shell.toast(x.ok ? "Deleted." : x.message, x.ok ? "" : "bad");
                }}>Delete</button> : null}
              {viewer === "admin" && !r.verifiedById
                ? <button className="btn sm" onClick={() => {
                  const x = verifyResource(r.resourceId);
                  shell.toast(x.ok ? "Verified." : x.message, x.ok ? "" : "bad");
                }}>Verify</button> : null}
            </td>
          </tr>
        ))} />
      <p className="tm-foot">Every file here is a private object with a signed read. No public URL.</p>
    </>
  );
}

function SendModal({ memberId }: { memberId: string }) {
  const shell = useShell();
  const [kind, setKind] = useState("nda");
  const [title, setTitle] = useState("NDA · 2026");
  const save = () => {
    const r = sendAgreement(memberId, kind, title);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.closeLayer();
    shell.toast("Sent. The link expires in 7 days.");
  };
  return (
    <>
      <div className="md-h">
        <h3>Send an agreement</h3>
        <button className="btn icon sm md-x" aria-label="Close" onClick={() => shell.closeLayer()}>
          <Icon name="x" size="sm" />
        </button>
      </div>
      <div className="md-b">
        <div className="fg">
          <label htmlFor="agKind">Kind</label>
          <select id="agKind" className="inp" value={kind}
            onChange={(e) => { setKind(e.target.value); setTitle(labelOf(AGREEMENT_KIND, e.target.value) + " · 2026"); }}>
            {["offer_letter", "nda"].map((k) => <option key={k} value={k}>{labelOf(AGREEMENT_KIND, k)}</option>)}
          </select>
        </div>
        <div className="fg">
          <label htmlFor="agTitle">Title <b className="req">*</b></label>
          <input id="agTitle" className="inp" value={title} onChange={(e) => setTitle(e.target.value)} />
          <span className="help">Frozen at send.</span>
        </div>
      </div>
      <div className="md-f">
        <span className="spacer" />
        <button className="btn" onClick={() => shell.closeLayer()}>Cancel</button>
        <button className="btn pri" disabled={!title.trim()} onClick={save}>Send</button>
      </div>
    </>
  );
}

/** The signing page a member opens from their link, drawn here so the chain is
 *  walkable. The real one is public, token-gated and single-use. */
function SignModal({ a }: { a: Agreement }) {
  const shell = useShell();
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const save = () => {
    const r = signAgreement(a.agreementId, name);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.closeLayer();
    shell.toast("Signed.");
  };
  return (
    <>
      <div className="md-h">
        <h3>{a.title}</h3>
        <button className="btn icon sm md-x" aria-label="Close" onClick={() => shell.closeLayer()}>
          <Icon name="x" size="sm" />
        </button>
      </div>
      <div className="md-b">
        <div className="fg">
          <label htmlFor="sgName">Full name <b className="req">*</b></label>
          <input id="sgName" className="inp" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <label className="fg-check">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          I have read it and I agree.
        </label>
        <p className="tm-foot">The name, the time and the address are stored with the signature.</p>
      </div>
      <div className="md-f">
        <span className="spacer" />
        <button className="btn" onClick={() => shell.closeLayer()}>Cancel</button>
        <button className="btn pri" disabled={!agree || name.trim().length < 2} onClick={save}>Sign</button>
      </div>
    </>
  );
}

function UploadModal({ memberId }: { memberId: string }) {
  const shell = useShell();
  const [kind, setKind] = useState("pan");
  const [label, setLabel] = useState("");
  const save = () => {
    const r = addResource(memberId, kind, label);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.closeLayer();
    shell.toast("Added.");
  };
  return (
    <>
      <div className="md-h">
        <h3>Add a document</h3>
        <button className="btn icon sm md-x" aria-label="Close" onClick={() => shell.closeLayer()}>
          <Icon name="x" size="sm" />
        </button>
      </div>
      <div className="md-b">
        <div className="fg">
          <label htmlFor="rsKind">Kind</label>
          <select id="rsKind" className="inp" value={kind}
            onChange={(e) => { setKind(e.target.value); setLabel(labelOf(RESOURCE_KIND, e.target.value)); }}>
            {["pan", "aadhaar", "address_proof", "bank", "photo", "other"]
              .map((k) => <option key={k} value={k}>{labelOf(RESOURCE_KIND, k)}</option>)}
          </select>
        </div>
        <div className="fg">
          <label htmlFor="rsLabel">Label <b className="req">*</b></label>
          <input id="rsLabel" className="inp" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
      </div>
      <div className="md-f">
        <span className="spacer" />
        <button className="btn" onClick={() => shell.closeLayer()}>Cancel</button>
        <button className="btn pri" disabled={!label.trim()} onClick={save}>Add</button>
      </div>
    </>
  );
}

/* ----------------------------------------------------------------- pay --- */

/** TEAM READS PAY AND NEVER WRITES IT. Every action here links into Finance,
 *  which owns the money; this tab exists so a member can see their own number
 *  without asking somebody for it. */
function PayTab({ m }: { m: Member }) {
  const p = payFor(m.memberId);
  if (!p || !p.annualCtc) return <Notice text="No salary account on this member." />;
  const rupees = (n: number) => "₹" + n.toLocaleString("en-IN");
  return (
    <>
      <Tiles list={[
        { k: "Annual CTC", v: rupees(p.annualCtc), s: "from " + fmtDate(p.effectiveFrom) },
        { k: "Last payslip", v: p.lastPayslip ? rupees(p.lastPayslip.net) : "—", s: p.lastPayslip ? p.lastPayslip.month : "none yet" },
        { k: "Incentives approved", v: rupees(incentiveTotal(p, "approved")), s: "not yet paid" },
        { k: "Incentives pending", v: rupees(incentiveTotal(p, "pending")), s: "Team's basis, Finance's call", tone: "warn" },
      ]} />
      <SectionHead title="Incentives" desc="Team supplies the basis. Finance approves and pays."
        right={<a className="btn sm" href="#/finance-salaries">Open in Finance</a>} />
      <Table
        cols={[{ label: "Month", w: "130px" }, { label: "Basis" }, { label: "Amount", w: "140px" }, { label: "State", w: "140px" }]}
        empty={{ icon: "cash", title: "No incentives", body: "Nothing recorded for this member." }}
        rows={p.incentives.map((i) => (
          <tr key={i.incentiveId}>
            <td>{i.month}</td>
            <td>{i.basis}</td>
            <td className="tnum">{rupees(i.amount)}</td>
            <td><Pill text={i.state} tone={i.state === "paid" ? "ok" : i.state === "approved" ? "info" : "warn"} /></td>
          </tr>
        ))} />
      <p className="tm-foot">Read-only. Every button here goes to Finance.</p>
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
