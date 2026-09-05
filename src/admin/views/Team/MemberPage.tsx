/* =============================================================================
   #/team/:id — one person, and the way into everything about them.
   -----------------------------------------------------------------------------
   THIS PAGE IS A LAUNCHER, NOT A CONTAINER. It answers three questions and then
   gets out of the way: who is this, what is true about them right now, and what
   needs somebody to act. Everything else is an OPERATION with a page of its own
   at `/team/:id/<op>` — its own crumb, its own toolbar, its own link that can
   be pasted into a message. A tab is a piece of a screen; "N. Pillai's leave"
   is a place, and it now has an address.

   THE VIEWER IS DERIVED, NEVER PASSED. `self` is the signed-in member's own id,
   `senior` is somebody whose `reportsTo` points at them — one level, never
   transitive — and everyone else with the grant is `admin`. No new hierarchy,
   no second answer to "who is this person's senior".

   AND THE RULE THAT MADE THIS FILE FIDDLY: a nudge must never leak what a page
   hides. Switch to a senior and the summary block below loses rows, it does not
   grey them. A line reading "1 agreement unsigned" would announce the existence
   of a document the same screen just refused to open, so every row is tagged
   with the op it came from and dropped whole when that op is not on this
   viewer's list.

   CHROME BELONGS TO Team/index.tsx. This component never calls usePageChrome,
   so the two cannot fight over the topbar.
   ============================================================================= */
import { Icon, KvList, Notice, Pill, SectionHead, Tiles } from "../../ui";
import { go } from "../../ui/nav";
import { MoreMenu } from "../../ui/menu";
import type { MenuItem } from "../../ui/menu";
import { fmtDate as fmtLiveDate } from "../../ui/format";
import { can } from "../../shell/AdminShell";
import { getSession, HIDDEN_MODULES } from "../../auth/session";
import { RoleChips } from "../teamShared";
import type { Member as LiveMember, Ops, Role } from "../teamShared";
import {
  MemberDeleteModal, MemberEditModal, MemberRolesModal, MemberSendCredentialsModal,
} from "./memberModals";
import {
  ATT_STATE, TODAY, agreementsFor, dayRows, eodDue, fmtDate, fmtHM, isDelayed, isTerminal, labelOf,
  leaveFor, meId, missingDocs, payFor, planFor, progressOf, readItems, readMember, reportFor,
  timePct, useAgreements, useLeave, useMembers, useResources, workedOf,
} from "./store";
import type { Member } from "./store";
import { MemberStrip, OpHead, OpNav, OpRefused, memberHref, rupees, workHref } from "./member/frame";
import { MEMBER_OPS, opAllowed, opOf, opsFor } from "./member/ops";
import type { Viewer } from "./member/ops";
import AgreementsPage from "./member/AgreementsPage";
import AttendancePage from "./member/AttendancePage";
import DocumentsPage from "./member/DocumentsPage";
import LeavePage from "./member/LeavePage";
import PayPage from "./member/PayPage";
import ReportsPage from "./member/ReportsPage";
import WorkPage from "./member/WorkPage";
import "./team.css";

export default function MemberPage({ id, sub, live, roles, ops }: {
  id: string; sub: string; live: LiveMember | null; roles: Role[]; ops: Ops;
}) {
  useMembers();
  const m = readMember(id);
  const me = meId();

  if (!m && !live) {
    return (
      <div className="dls"><div className="dls-body">
        <Notice tone="warn" text={"No member holds the id " + id + ". The link may be stale."} />
      </div></div>
    );
  }

  const viewer: Viewer = id === me ? "self" : m && m.reportsTo === me ? "senior" : "admin";
  const allowed = opsFor(viewer);
  const op = sub ? opOf(sub) : null;

  /* Admin actions ride in the header on every page of this person, because the
     act of editing somebody is about the person and not about the operation you
     happen to be looking at. */
  const menu: MenuItem[] = [];
  if (live && can("team", "roles"))
    menu.push({ icon: "shield", label: "Roles", act: () => ops.modal(<MemberRolesModal u={live} roles={roles} ops={ops} />) });
  if (live && can("team", "edit"))
    menu.push({ icon: "lock", label: "Send new password", act: () => ops.modal(<MemberSendCredentialsModal u={live} ops={ops} />) });
  if (live && can("team", "status"))
    menu.push({ icon: "x", label: "Delete member", tone: "dgr", act: () => ops.modal(<MemberDeleteModal u={live} ops={ops} />) });

  return (
    <div className="dls">
      <MemberStrip m={m} live={live} viewer={viewer} right={
        <>
          {m ? (
            <button className="btn sm" onClick={() => go(workHref(m.memberId))}>
              <Icon name="calendar" size="sm" />Their board
            </button>
          ) : null}
          {live && can("team", "edit") ? (
            <button className="btn pri sm" onClick={() => ops.modal(<MemberEditModal u={live} ops={ops} />)}>
              Edit member
            </button>
          ) : null}
          {menu.length ? <MoreMenu small items={menu} /> : null}
        </>
      } />

      <OpNav id={id} ops={allowed} cur={op && opAllowed(op.key, viewer) ? op.key : sub ? sub : ""} />

      <div className="dls-body">
        {!m ? (
          <NotAdopted live={live as LiveMember} roles={roles} sub={sub} />
        ) : sub && !op ? (
          <Notice tone="warn" text={"There is no \"" + sub + "\" page for a member. The link may be stale."} />
        ) : op && !opAllowed(op.key, viewer) ? (
          <OpRefused label={op.label} />
        ) : op ? (
          <OpBody op={op.key} m={m} viewer={viewer} />
        ) : (
          <Overview m={m} live={live} roles={roles} viewer={viewer} />
        )}
      </div>
    </div>
  );
}

function OpBody({ op, m, viewer }: { op: string; m: Member; viewer: Viewer }) {
  if (op === "attendance") return <AttendancePage m={m} viewer={viewer} />;
  if (op === "work") return <WorkPage m={m} viewer={viewer} />;
  if (op === "leave") return <LeavePage m={m} viewer={viewer} />;
  if (op === "reports") return <ReportsPage m={m} viewer={viewer} />;
  if (op === "agreements") return <AgreementsPage m={m} viewer={viewer} />;
  if (op === "documents") return <DocumentsPage m={m} viewer={viewer} />;
  if (op === "pay") return <PayPage m={m} />;
  return null;
}

/* ============================================================ overview === */

function Overview({ m, live, roles, viewer }: {
  m: Member; live: LiveMember | null; roles: Role[]; viewer: Viewer;
}) {
  const items = readItems().filter((i) => i.assigneeId === m.memberId);
  const open = items.filter((i) => !isTerminal(i.status));
  const late = open.filter((i) => isDelayed(i));
  const day = dayRows(TODAY, "all").filter((r) => r.member.memberId === m.memberId)[0];
  const ms = items.filter((i) => i.kind === "milestone" && !isTerminal(i.status))[0] || null;
  const senior = m.reportsTo ? readMember(m.reportsTo) : null;

  return (
    <>
      <Tiles list={[
        {
          k: "Today",
          v: day ? labelOf(ATT_STATE, day.state) : "—",
          s: day && day.day ? fmtHM(workedOf(day.day, m)) + " worked" : "no day opened",
          tone: day && (day.state === "absent" || day.state === "unclosed") ? "warn" : "",
        },
        { k: "Open work", v: String(open.length), s: late.length + " past its date", tone: late.length ? "warn" : "" },
        {
          k: "Milestone",
          v: ms ? (progressOf(ms) || 0) + "%" : "—",
          s: ms ? shortWindow(ms.itemId, m) : "none assigned",
          tone: ms && behind(ms) ? "warn" : "",
        },
        { k: "Reports to", v: senior ? senior.name.split(" ")[0] : "Nobody", s: senior ? senior.designation : "top of the tree" },
      ]} />

      <NeedsYou m={m} viewer={viewer} />

      <SectionHead title="Operations"
        desc="Each one is a page of its own. Open it and the address names the person and the operation both." />
      <OpGrid m={m} viewer={viewer} />

      <SectionHead title="Record" />
      <KvList cls="wide" pairs={[
        ["Designation", m.designation],
        ["Department", m.department || "—"],
        ["Reports to", senior ? senior.name : "Nobody"],
        ["Employment", m.employmentType.replace(/_/g, " ")],
        ["Joined", fmtDate(m.joiningDate)],
        ["Day starts", m.dayStartsAt + " · " + m.graceMinutes + " minutes of grace"],
      ]} />

      {/* ACCESS IS NOT ON THE MEMBER'S OWN VIEW. Somebody reading their own
          permission matrix learns exactly which verb to go and ask for, and the
          panel gains nothing by telling them. */}
      {live ? <IdentityBlock live={live} roles={roles} showAccess={viewer !== "self"} /> : null}
    </>
  );
}

const behind = (i: { itemId: string }) => {
  const item = readItems().filter((x) => x.itemId === i.itemId)[0];
  if (!item) return false;
  const t = timePct(item), p = progressOf(item);
  return t !== null && p !== null && t > p + 5;
};

function shortWindow(itemId: string, m: Member): string {
  const item = readItems().filter((x) => x.itemId === itemId && x.assigneeId === m.memberId)[0];
  if (!item) return "";
  const t = timePct(item);
  return t === null ? "no window set" : t + "% of its window gone";
}

/* ------------------------------------------------------- what needs doing --- */

interface Nudge { tone: string; op: string; title: string; note: string; act?: string }

/** EVERY ROW CARRIES THE OP IT CAME FROM, and rows whose op this viewer cannot
 *  open are dropped before the block is drawn — not greyed, not labelled "no
 *  access". A row that named an unsigned NDA would announce a document the
 *  Agreements page just refused to show this reader. */
function NeedsYou({ m, viewer }: { m: Member; viewer: Viewer }) {
  useLeave(); useAgreements(); useResources();
  const rows: Nudge[] = [];

  const report = reportFor(m.memberId, TODAY);
  if (eodDue(TODAY, m) && !(report && report.submittedAt)) {
    rows.push({
      tone: "bad", op: "reports", title: "No end-of-day report for today",
      note: "The day is over. It shows as missing and it never blocks anything.",
    });
  } else if (report && report.submittedAt && !report.acknowledgedById && viewer !== "self") {
    rows.push({
      tone: "warn", op: "reports", title: "Today's report is unread",
      note: "A report nobody opened teaches the person writing it that it is paperwork.",
    });
  }

  const plan = planFor(m.memberId, TODAY);
  if (!(plan && plan.submittedAt)) {
    rows.push({
      tone: "warn", op: "reports", title: "No plan for today",
      note: "The morning list of what they meant to do.",
    });
  }

  const late = readItems().filter((i) => i.assigneeId === m.memberId && isDelayed(i));
  if (late.length) {
    rows.push({
      tone: "warn", op: "work",
      title: late.length + " work item" + (late.length > 1 ? "s are" : " is") + " past its date",
      note: late.slice(0, 3).map((i) => i.title).join(" · ") + (late.length > 3 ? " · …" : ""),
    });
  }

  const waiting = leaveFor(m.memberId).filter((l) => l.state === "requested");
  if (waiting.length) {
    rows.push({
      tone: "warn", op: "leave",
      title: waiting.length + " leave request" + (waiting.length > 1 ? "s" : "") + " undecided",
      note: viewer === "self"
        ? "Until it is decided those days still count as absent."
        : "Waiting on a decision. Until then the days read as absent.",
    });
  }

  const unsigned = agreementsFor(m.memberId).filter((a) =>
    a.state !== "signed" && a.state !== "revoked");
  if (unsigned.length) {
    rows.push({
      tone: "bad", op: "agreements",
      title: unsigned.length + " agreement" + (unsigned.length > 1 ? "s are" : " is") + " unsigned",
      note: unsigned.map((a) => a.title).join(" · "),
    });
  }

  const missing = missingDocs(m.memberId);
  if (missing.length) {
    rows.push({
      tone: "warn", op: "documents",
      title: missing.length + " required document" + (missing.length > 1 ? "s" : "") + " missing",
      note: "Nothing in the panel blocks on it — it is a nudge and stays one.",
    });
  }

  const pay = payFor(m.memberId);
  const pendingPay = (pay ? pay.incentives : []).filter((i) => i.state === "pending");
  if (pendingPay.length) {
    rows.push({
      tone: "warn", op: "pay",
      title: rupees(pendingPay.reduce((a, i) => a + i.amount, 0)) + " of incentive awaiting Finance",
      note: "Team proposed it against their work. Finance decides whether it is paid.",
    });
  }

  const visible = rows.filter((r) => opAllowed(r.op, viewer));
  const hidden = rows.length - visible.length;

  return (
    <>
      <SectionHead
        title={viewer === "self" ? "Needs you" : "Waiting on somebody"}
        desc="One query a row, not a feed. Things that have stopped because a person has not acted." />
      {visible.length ? (
        <ul className="tm-nudges">
          {visible.map((r, i) => (
            <li key={i} className={"tm-nudge t-" + r.tone}>
              <span className="tm-nudge-d" aria-hidden="true" />
              <span className="tm-nudge-t">
                <b>{r.title}</b>
                <span>{r.note}</span>
              </span>
              <button className="btn sm" onClick={() => go(memberHref(m.memberId, r.op))}>
                Open {(opOf(r.op) || { label: "" }).label.toLowerCase()}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Notice tone="ok" ico="check" text="Nothing is waiting on anybody." />
      )}
      {hidden && viewer === "senior" ? (
        <p className="tm-foot">
          {hidden} row{hidden > 1 ? "s are" : " is"} absent rather than greyed. They come from pages a
          reporting line does not open, and naming them here would announce what those pages refuse
          to show.
        </p>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------ the cards --- */

/** A card per operation, each carrying ONE live figure. A card that only
 *  repeated its own title would be a link with extra padding; the figure is
 *  what makes the grid worth reading before you click anything. */
function OpGrid({ m, viewer }: { m: Member; viewer: Viewer }) {
  const items = readItems().filter((i) => i.assigneeId === m.memberId);
  const late = items.filter((i) => isDelayed(i)).length;
  const open = items.filter((i) => !isTerminal(i.status)).length;
  const leave = leaveFor(m.memberId);
  const pendingLv = leave.filter((l) => l.state === "requested").length;
  const ags = agreementsFor(m.memberId);
  const unsigned = ags.filter((a) => a.state !== "signed" && a.state !== "revoked").length;
  const missing = missingDocs(m.memberId).length;
  const pay = payFor(m.memberId);
  const day = dayRows(TODAY, "all").filter((r) => r.member.memberId === m.memberId)[0];
  const report = reportFor(m.memberId, TODAY);

  const stat: Record<string, { v: string; s: string; tone?: string }> = {
    attendance: {
      v: day ? labelOf(ATT_STATE, day.state) : "no row",
      s: "today",
      tone: day && (day.state === "absent" || day.state === "unclosed") ? "warn" : "",
    },
    work: { v: String(open), s: "open · " + late + " delayed", tone: late ? "warn" : "" },
    leave: {
      v: pendingLv ? pendingLv + " waiting" : String(leave.length),
      s: pendingLv ? "undecided" : "on record",
      tone: pendingLv ? "warn" : "",
    },
    reports: {
      v: report && report.submittedAt ? (report.acknowledgedById ? "read" : "unread") : "not in",
      s: "today's report",
      tone: report && report.submittedAt && !report.acknowledgedById ? "warn" : "",
    },
    agreements: {
      v: unsigned ? unsigned + " unsigned" : String(ags.length),
      s: unsigned ? "waiting on a signature" : "all signed",
      tone: unsigned ? "bad" : "",
    },
    documents: {
      v: missing ? missing + " missing" : "complete",
      s: "required documents",
      tone: missing ? "warn" : "",
    },
    pay: {
      v: pay && pay.annualCtc ? rupees(Math.round(pay.annualCtc / 12)) : "—",
      s: pay && pay.annualCtc ? "a month, from Finance" : "no salary account",
    },
  };

  return (
    <div className="tm-opgrid">
      {MEMBER_OPS.filter((o) => opAllowed(o.key, viewer)).map((o) => {
        const s = stat[o.key];
        return (
          <button key={o.key} className="tm-opcard" onClick={() => go(memberHref(m.memberId, o.key))}>
            <span className="tm-opcard-h">
              <Icon name={o.icon} size="sm" />
              <b>{o.label}</b>
              <Icon name="chevr" size="sm" className="tm-opcard-go" />
            </span>
            <span className={"tm-opcard-v" + (s.tone ? " u-" + s.tone : "")}>{s.v}</span>
            <span className="tm-opcard-s">{s.s}</span>
            <span className="tm-opcard-b">{o.blurb}</span>
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------- the identity --- */

/** The live row exists but the operational store has no record — a fetch still
 *  in flight, or an id the adoption never saw. Identity still renders. */
function NotAdopted({ live, roles, sub }: { live: LiveMember; roles: Role[]; sub: string }) {
  return (
    <>
      {sub ? <OpHead title="Nothing here yet" /> : null}
      <Notice text="No operational record yet — attendance, work, leave and pay arrive with the API." />
      <IdentityBlock live={live} roles={roles} showAccess />
    </>
  );
}

function IdentityBlock({ live: u, roles, showAccess }: {
  live: LiveMember; roles: Role[]; showAccess: boolean;
}) {
  return (
    <>
      <SectionHead title="Account" />
      <KvList cls="wide" pairs={[
        ["Email", <a key="e" href={"mailto:" + u.email}>{u.email}</a>],
        ["Phone", u.phone ? u.phone : <span className="faint">—</span>],
        ["Username", <span key="u" className="mono">{u.username || "—"}</span>],
        ["Account status", u.isActive === undefined ? <span className="faint">—</span>
          : u.isActive ? <Pill text="Active" tone="ok" /> : <Pill text="Inactive" tone="bad" />],
        ["Roles", u.roles.length ? <RoleChips u={u} />
          : <span className="faint">none — this account can sign in and do nothing</span>],
        ["Last sign-in", u.lastLogin ? fmtLiveDate(u.lastLogin)
          : <span className="faint">never signed in</span>],
        ["Added", u.addedAt ? fmtLiveDate(u.addedAt) : <span className="faint">—</span>],
      ]} />

      {showAccess ? (
        <>
          <SectionHead title="Effective access"
            desc="What happens when they click, not what their roles are called." />
          <EffectiveAccess u={u} roles={roles} />
        </>
      ) : null}
    </>
  );
}

/* The keys are the server's own (ModuleAction.key), so anything unlisted falls
   back to the key itself rather than disappearing. */
const ACTION_LABEL: Record<string, string> = {
  view: "View", create: "Create", edit: "Edit", stage: "Change stage",
  payment: "Log payment", close: "Close", export: "Export", record: "Record",
  issue: "Issue", accept: "Accept", cancel: "Cancel", reverse: "Reverse",
  pricing: "Set pricing", status: "Activate", archive: "Archive", roles: "Manage roles",
};

/** A member's grants: the UNION of the verbs their roles tick — the same
    resolution resolve_grants() does server-side. Inactive roles contribute
    nothing there, so they must contribute nothing here either. */
function grantsOfMember(u: LiveMember, roles: Role[]): Record<string, string[]> {
  const held = new Set((u.roles || []).map((r) => r.id));
  const out: Record<string, string[]> = {};
  roles.filter((r) => held.has(r.id) && r.isActive).forEach((r) => {
    Object.keys(r.modules || {}).forEach((k) => {
      (r.modules[k] || []).forEach((a) => {
        const list = (out[k] = out[k] || []);
        if (list.indexOf(a) < 0) list.push(a);
      });
    });
  });
  return out;
}

function EffectiveAccess({ u, roles }: { u: LiveMember; roles: Role[] }) {
  const s = getSession();
  if (u.isActive === false)
    return <Notice tone="warn" ico="lock" text={
      <><b>This account is inactive.</b> Whatever its roles say, it cannot sign in and every
        call it makes would be refused.</>
    } />;
  if (u.isSuperAdmin || roles.some((r) => r.isFullAccess && (u.roles || []).some((x) => x.id === r.id)))
    return <Notice ico="shield" text={
      <><b>Everything.</b> Full access is a grant, not a list — it resolves to a wildcard, so a
        module added tomorrow is included without anybody editing a matrix.</>
    } />;

  const grants = grantsOfMember(u, roles);
  const mods = (s ? s.modules : []).filter(
    (mod) => !HIDDEN_MODULES.has(mod.key) && (grants[mod.key] || []).indexOf("view") >= 0);
  if (!mods.length)
    return <Notice tone="warn" ico="lock"
      text="No access to anything. This member can sign in and will see an empty panel — assign a role." />;

  return (
    <ul className="pl-feats">
      {mods.map((mod) => {
        const acts = (grants[mod.key] || []).filter((a) => a !== "view");
        return (
          <li key={mod.key}>
            <Icon name="check" size="sm" />
            <span>
              <b>{mod.label}</b>
              <span className="d">{acts.length
                ? acts.map((a) => ACTION_LABEL[a] || a).join(" · ")
                : "View only"}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
