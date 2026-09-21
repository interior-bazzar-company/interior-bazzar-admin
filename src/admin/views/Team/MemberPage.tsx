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

   THE LAUNCHER CARRIES THE FIGURES. There used to be a tile row, a card grid
   and a nav row — three surfaces answering "how is this person doing" with
   three chances to disagree. There is one now: the operation tiles, each with
   the reading that says whether it is worth opening, on every page of this
   person.

   CHROME BELONGS TO Team/index.tsx. This component never calls usePageChrome,
   so the two cannot fight over the topbar.
   ============================================================================= */
import type { ReactNode } from "react";
import { Alert, Button, Card, EmptyState, Icon, KvList, ListTable, PaneLoading, Pill, Rail, SectionHead } from "../../ui";
import { cx } from "@/utils/cx";
import { go } from "../../ui/nav";
import { MoreMenu } from "../../ui/menu";
import type { MenuItem } from "../../ui/menu";
import { fmtDate as fmtLiveDate, inr } from "../../ui/format";
import { can } from "../../shell/AdminShell";
import { getSession, HIDDEN_MODULES } from "../../auth/session";
import { RoleChips } from "../teamShared";
import type { Member as LiveMember, Ops, Role } from "../teamShared";
import type { WorkItemRow } from "../../../api/modules/adminOps";
import {
  MemberDeleteModal, MemberEditModal, MemberRolesModal, MemberSendCredentialsModal,
} from "./memberModals";
/* THE SEED IS FOR THE OPERATION PAGES ONLY (layer 3, their own divs). This page's
   header, launcher figures, record and "waiting on somebody" read the API. */
import { fmtDate, fmtHM, readMember, retryTeam, useMembers, useTeamLoad } from "./store";
import type { LoadPart, Member, TeamList } from "./store";
import { LoadNotice, OpSkeleton } from "./loadState";
import { retryResources, useResourcesLoad } from "../Resources/store";
import { retryPayroll, usePayrollLoad } from "../Finance/store";
import { useMemberReads, windowPct } from "./liveMember";
import type { MemberReads, Part } from "./liveMember";
import { MemberStrip, OpHead, OpNav, OpRefused, memberHref, rupees, workHref } from "./member/frame";
import { opAllowed, opOf, opsFor } from "./member/ops";
import type { Viewer } from "./member/ops";
import AgreementsPage from "./member/AgreementsPage";
import AttendancePage from "./member/AttendancePage";
import DocumentsPage from "./member/DocumentsPage";
import MemberResourcesPage from "./member/ResourcesPage";
import LeavePage from "./member/LeavePage";
import PayPage from "./member/PayPage";
import ReportsPage from "./member/ReportsPage";
import WorkPage from "./member/WorkPage";

export default function MemberPage({ id, sub, live, roles, rolesDenied, ops }: {
  id: string; sub: string; live: LiveMember | null; roles: Role[]; rolesDenied?: boolean; ops: Ops;
}) {
  useMembers();
  /* The operation pages below take the store's record of this member. */
  const m = readMember(id);
  const q = useMemberReads(live);
  const session = getSession();
  const me = session?.user?.id != null ? String(session.user.id) : "";

  if (!live) {
    return (
      <EmptyState
        icon="user"
        title="No such member"
        body={"No member holds the id " + id + ". The link may be stale."}
        action={<Button color="secondary" ico="chevl" onClick={() => go("#/team")}>Back to the roster</Button>}
      />
    );
  }

  const viewer: Viewer = id === me ? "self" : live.reportsTo && String(live.reportsTo.id) === me ? "senior" : "admin";
  /* No work-settings row: the server leaves `reportsTo` out — no operational record. */
  const hasRecord = "reportsTo" in live;
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
    menu.push({ icon: "trash", label: "Delete member", tone: "dgr", act: () => ops.modal(<MemberDeleteModal u={live} ops={ops} />) });

  return (
    <div className="flex flex-col gap-5">
      <MemberStrip m={null} live={live} viewer={viewer} right={
        <>
          {live ? (
            <Button color="secondary" ico="calendar" onClick={() => go(workHref(String(live.id)))}>
              Their board
            </Button>
          ) : null}
          {live && can("team", "edit") ? (
            <Button onClick={() => ops.modal(<MemberEditModal u={live} ops={ops} />)}>Edit member</Button>
          ) : null}
          {menu.length ? <MoreMenu small items={menu} /> : null}
        </>
      } />

      <OpNav
        id={id}
        ops={allowed}
        cur={op && opAllowed(op.key, viewer) ? op.key : sub ? sub : ""}
        stats={opStats(q, live)}
      />

      {!hasRecord ? (
        <NotAdopted live={live as LiveMember} roles={roles} rolesDenied={rolesDenied} sub={sub} />
      ) : sub && !op ? (
        <Alert tone="warn" title="No such page">
          There is no “{sub}” page for a member. The link may be stale.
        </Alert>
      ) : op && !opAllowed(op.key, viewer) ? (
        <OpRefused label={op.label} />
      ) : op ? (
        /* Attendance reads its own window (team/d3); the other op pages read the Team store. */
        op.key === "attendance" ? (
          <div className="flex flex-col gap-4">
            <AttendancePage q={q} live={live} viewer={viewer} />
          </div>
        ) : (
          <OpGate op={op.key} label={op.label} id={id} m={m} live={live as LiveMember} roles={roles} rolesDenied={rolesDenied} sub={sub} viewer={viewer} />
        )
      ) : (
        <Overview q={q} live={live} roles={roles} rolesDenied={rolesDenied} viewer={viewer} />
      )}
    </div>
  );
}

/* ------------------------------------------------ the op pages' own reads --- */

/** What each operation page reads from the Team store (team/d5). */
const OP_LISTS: Record<string, TeamList[]> = {
  work: ["members", "items", "tags"],
  leave: ["members", "leave"],
  reports: ["members", "plans", "reports"],
  agreements: ["members", "agreements"],
  documents: ["members", "documents", "vocab"],
  resources: ["members"],
  pay: ["members", "incentives"],
};

/** THE PAGE ONLY RENDERS ON DATA IT HAS. Until the reads land it shimmers; a
 *  refused read says "not in your access", a failed one offers Try again — an
 *  empty list is only ever drawn for a read that came back empty. */
function OpGate({ op, label, id, m, live, roles, rolesDenied, sub, viewer }: {
  op: string; label: string; id: string; m: Member | null; live: LiveMember; roles: Role[];
  rolesDenied?: boolean; sub: string; viewer: Viewer;
}) {
  const part = useTeamLoad(OP_LISTS[op] || ["members"], id);
  if (part.state !== "ok") return <OpState label={label} part={part} onRetry={retryTeam} />;
  if (!m) return <NotAdopted live={live} roles={roles} rolesDenied={rolesDenied} sub={sub} />;
  if (op === "resources") return <ResourcesGate label={label} m={m} viewer={viewer} />;
  if (op === "pay") return <PayGate label={label} m={m} viewer={viewer} />;
  return (
    <div className="flex flex-col gap-4">
      <OpBody op={op} m={m} viewer={viewer} />
    </div>
  );
}

/** Resources keep their own store: the same three states over its read. */
function ResourcesGate({ label, m, viewer }: { label: string; m: Member; viewer: Viewer }) {
  const part = useResourcesLoad(m.memberId);
  if (part.state !== "ok") return <OpState label={label} part={part} onRetry={retryResources} />;
  return (
    <div className="flex flex-col gap-4">
      <OpBody op="resources" m={m} viewer={viewer} />
    </div>
  );
}

/** Pay reads Finance's payroll, and asking for its state is what starts that
 *  read — a pay page opened first used to find Finance empty and say so. */
function PayGate({ label, m, viewer }: { label: string; m: Member; viewer: Viewer }) {
  const part = usePayrollLoad();
  if (part.state !== "ok") return <OpState label={label} part={part} onRetry={retryPayroll} />;
  return (
    <div className="flex flex-col gap-4">
      <OpBody op="pay" m={m} viewer={viewer} />
    </div>
  );
}

function OpState({ label, part, onRetry }: { label: string; part: LoadPart; onRetry: () => void }) {
  if (part.state === "loading") return <OpSkeleton />;
  return (
    <div className="flex flex-col gap-4">
      <OpHead title={label} />
      <LoadNotice what={label} part={part} onRetry={onRetry} />
    </div>
  );
}

function OpBody({ op, m, viewer }: { op: string; m: Member; viewer: Viewer }) {
  if (op === "work") return <WorkPage m={m} viewer={viewer} />;
  if (op === "leave") return <LeavePage m={m} viewer={viewer} />;
  if (op === "reports") return <ReportsPage m={m} viewer={viewer} />;
  if (op === "agreements") return <AgreementsPage m={m} viewer={viewer} />;
  if (op === "documents") return <DocumentsPage m={m} viewer={viewer} />;
  if (op === "resources") return <MemberResourcesPage m={m} viewer={viewer} />;
  if (op === "pay") return <PayPage m={m} />;
  return null;
}

/* ============================================================ overview === */

const TERMINAL = ["completed", "cancelled"];
const roleNames = (u: LiveMember) => (u.roles || []).map((r) => r.name).join(", ");
/** What a part says in place of a value it could not read. */
const partNote = (p: Part<unknown>): string =>
  p.state === "loading" ? "Loading…" : p.state === "denied" ? "Not in your access" : p.state === "error" ? "Could not load" : "";
const todayOf = (q: MemberReads) => (q.clock.state === "ok" ? q.clock.data.today : "");

function Overview({ q, live, roles, rolesDenied, viewer }: {
  q: MemberReads; live: LiveMember; roles: Role[]; rolesDenied?: boolean; viewer: Viewer;
}) {
  const today = todayOf(q);
  const settings = q.settings.state === "ok" ? q.settings.data : null;
  const ms = q.work.state === "ok"
    ? q.work.data.filter((i) => i.kind?.key === "milestone" && TERMINAL.indexOf(i.status?.key) < 0)[0] || null
    : null;

  return (
    <div className="flex flex-col gap-5">
      <NeedsYou q={q} live={live} viewer={viewer} />

      {/* TWO COLUMNS OF PAIRS, not one pair stretched across the page. `KvList`
          keeps its label beside its value; the grid is what makes seven facts
          read as a block rather than as seven lines with a canyon down the
          middle of each. */}
      <Card title="Record" sub="The employment facts every derivation on the other pages reads.">
        <div className="grid gap-x-8 gap-y-2.5 lg:grid-cols-2">
          <KvList
            pairs={[
              ["Designation", live.designation?.label || ""],
              ["Department", roleNames(live)],
              ["Reports to", live.reportsTo ? live.reportsTo.name : "Nobody"],
              ["Employment", live.employmentType?.label || ""],
            ]}
          />
          <KvList
            pairs={[
              ["Joined", settings ? fmtDate(settings.joiningDate) : partNote(q.settings)],
              ["Day starts", settings
                ? settings.dayStartsAt + " · " + settings.graceMinutes + " minutes of grace"
                : partNote(q.settings)],
              [
                "Milestone",
                ms ? (
                  <span className="flex flex-col">
                    <span>{ms.title}</span>
                    <span className={behind(ms, today) ? "text-xs text-warning-primary tnum" : "text-xs text-tertiary tnum"}>
                      {(ms.progress || 0) + "% done · " + shortWindow(ms, today)}
                    </span>
                  </span>
                ) : partNote(q.work),
              ],
            ]}
          />
        </div>
      </Card>

      {/* ACCESS IS NOT ON THE MEMBER'S OWN VIEW. Somebody reading their own
          permission matrix learns exactly which verb to go and ask for, and the
          panel gains nothing by telling them. */}
      {live ? <IdentityBlock live={live} roles={roles} rolesDenied={rolesDenied} showAccess={viewer !== "self"} /> : null}
    </div>
  );
}

const behind = (item: WorkItemRow, today: string) => {
  const t = today ? windowPct(item.startDate, item.dueDate, today) : null, p = item.progress ?? null;
  return t !== null && p !== null && t > p + 5;
};

function shortWindow(item: WorkItemRow, today: string): string {
  const t = today ? windowPct(item.startDate, item.dueDate, today) : null;
  return t === null ? "no window set" : t + "% of its window gone";
}

/** Forms still owed: open, answered by nobody here, and (the server's filter) addressed to them. */
function owedOf(q: MemberReads) {
  if (q.resources.state !== "ok") return [];
  const { resources, responses } = q.resources.data;
  return resources.filter((r) => r.state.key === "open" && !responses.some((x) => x.resource === r.id));
}

/* ------------------------------------------------------- what needs doing --- */

interface Nudge { tone: string; op: string; title: string; note: string }

/** EVERY ROW CARRIES THE OP IT CAME FROM, and rows whose op this viewer cannot
 *  open are dropped before the block is drawn — not greyed, not labelled "no
 *  access". A row that named an unsigned NDA would announce a document the
 *  Agreements page just refused to show this reader.
 *
 *  RANKED, AND THE RANK IS THE RAIL. Red before amber, because a report that
 *  was never written and an incentive waiting on Finance are not the same size
 *  of problem, and a flat list makes somebody read all eight to find that out. */
function NeedsYou({ q, live, viewer }: { q: MemberReads; live: LiveMember; viewer: Viewer }) {
  const rows: Nudge[] = [];
  /* A READ THE SERVER REFUSED IS A ROW, not a silence: "nothing is waiting"
     would be a claim about a page this viewer was not allowed to read. */
  const blocked = (p: Part<unknown>, op: string, what: string) => {
    if (p.state === "denied") rows.push({ tone: "warn", op, title: what + " is not in your access", note: p.message });
    if (p.state === "error") rows.push({ tone: "bad", op, title: what + " could not be loaded", note: p.message });
  };
  const loading = Object.values(q).some((p) => (p as Part<unknown>).state === "loading");

  if (q.report.state === "ok" && q.plan.state === "ok" && q.clock.state === "ok") {
    const report = q.report.data;
    const settings = q.settings.state === "ok" ? q.settings.data : null;
    /* Due once the member's own close time has passed, on the server's clock. */
    const eodDue = q.clock.data.hhmm > ((settings && settings.autoCloseAt) || "20:00");
    if (eodDue && !(report && report.submittedAt)) {
      rows.push({
        tone: "bad", op: "reports", title: "No end-of-day report for today",
        note: "The day is over. It shows as missing and it never blocks anything.",
      });
    } else if (report && report.submittedAt && !report.acknowledgedAt && viewer !== "self") {
      rows.push({
        tone: "warn", op: "reports", title: "Today's report is unread",
        note: "A report nobody opened teaches the person writing it that it is paperwork.",
      });
    }

    const plan = q.plan.data;
    if (!(plan && plan.submittedAt)) {
      rows.push({
        tone: "warn", op: "reports", title: "No plan for today",
        note: "The morning list of what they meant to do.",
      });
    }
  } else {
    blocked(q.report.state === "ok" ? q.plan : q.report, "reports", "Plans and reports");
  }

  if (q.work.state === "ok") {
    const late = q.work.data.filter((i) => i.delayed);
    if (late.length) {
      rows.push({
        tone: "warn", op: "work",
        title: late.length + " work item" + (late.length > 1 ? "s are" : " is") + " past its date",
        note: late.slice(0, 3).map((i) => i.title).join(" · ") + (late.length > 3 ? " · …" : ""),
      });
    }
  } else blocked(q.work, "work", "Work");

  if (q.leave.state === "ok") {
    const waiting = q.leave.data.filter((l) => l.state?.key === "requested");
    if (waiting.length) {
      rows.push({
        tone: "warn", op: "leave",
        title: waiting.length + " leave request" + (waiting.length > 1 ? "s" : "") + " undecided",
        note: viewer === "self"
          ? "Until it is decided those days still count as absent."
          : "Waiting on a decision. Until then the days read as absent.",
      });
    }
  } else blocked(q.leave, "leave", "Leave");

  if (q.agreements.state === "ok") {
    const unsigned = q.agreements.data.filter((a) => a.state?.key !== "signed" && a.state?.key !== "revoked");
    if (unsigned.length) {
      rows.push({
        tone: "bad", op: "agreements",
        title: unsigned.length + " agreement" + (unsigned.length > 1 ? "s are" : " is") + " unsigned",
        note: unsigned.map((a) => a.title).join(" · "),
      });
    }
  } else blocked(q.agreements, "agreements", "Agreements");

  const missing = live.missingDocuments || [];
  if (missing.length) {
    rows.push({
      tone: "warn", op: "documents",
      title: missing.length + " required document" + (missing.length > 1 ? "s" : "") + " missing",
      note: "Nothing in the panel blocks on it — it is a nudge and stays one.",
    });
  }

  if (q.resources.state === "ok") {
    const owed = owedOf(q);
    if (owed.length) {
      rows.push({
        tone: "warn", op: "resources",
        title: owed.length === 1
          ? "“" + owed[0].title + "” has not been filled in"
          : owed.length + " resources have not been filled in",
        note: owed.length === 1
          ? "It is open and their name is in its audience."
          : owed.map((r) => r.title).join(", ") + ".",
      });
    }
  } else blocked(q.resources, "resources", "Resources");

  if (q.incentives.state === "ok") {
    const pendingPay = q.incentives.data.filter((i) => i.state?.key === "pending");
    if (pendingPay.length) {
      rows.push({
        tone: "warn", op: "pay",
        title: rupees(pendingPay.reduce((a, i) => a + i.amountPaise, 0) / 100) + " of incentive awaiting Finance",
        note: "Team proposed it against their work. Finance decides whether it is paid.",
      });
    }
  } else blocked(q.incentives, "pay", "Incentives");

  const RANK: Record<string, number> = { bad: 0, warn: 1 };
  const visible = rows
    .filter((r) => opAllowed(r.op, viewer))
    .sort((a, b) => (RANK[a.tone] ?? 2) - (RANK[b.tone] ?? 2));
  const hidden = rows.length - visible.length;

  return (
    <section className="flex flex-col">
      <SectionHead
        title={viewer === "self" ? "Needs you" : "Waiting on somebody"}
        desc="One query a row, ranked by severity. Things that have stopped because a person has not acted."
      />
      {loading ? <PaneLoading /> : visible.length ? (
        <ListTable min="40rem" head={
          <tr>
            <th className="rail" />
            <th scope="col">What has stopped</th>
            <th scope="col">Operation</th>
            <th scope="col" className="acts"><span className="sr-only">Open it</span></th>
          </tr>
        }>
          {visible.map((r, i) => (
            <tr key={i}>
              <Rail tone={r.tone} title={r.tone === "bad" ? "Blocking" : "Needs a person today"} />
              <td className="cell-1">
                {r.title}
                <div className="block cell-2">{r.note}</div>
              </td>
              <td>
                <Pill xs tone="neutral" text={(opOf(r.op) || { label: r.op }).label} />
              </td>
              <td className="acts">
                <Button color="secondary" size="xs" onClick={() => go(memberHref(String(live.id), r.op))}>
                  Open
                </Button>
              </td>
            </tr>
          ))}
        </ListTable>
      ) : (
        <EmptyState
          icon="checkcircle"
          title="Nothing is waiting on anybody"
          body="Every plan, report, signature, document and decision this page can see is in."
        />
      )}
      {hidden && viewer === "senior" ? (
        <p className="mt-2 text-xs text-quaternary">
          {hidden} row{hidden > 1 ? "s are" : " is"} absent rather than greyed. They come from pages a
          reporting line does not open, and naming them here would announce what those pages refuse
          to show.
        </p>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------ the launcher figures --- */

/** ONE FIGURE PER OPERATION, derived where the operation's own page derives it.
 *  The launcher is the only surface that carries these now, so a card that
 *  counted differently from the page it opens is a failure that cannot happen
 *  in two places at once. */
type Stat = { v: ReactNode; s?: ReactNode; tone?: string };

function opStats(q: MemberReads, live: LiveMember): Record<string, Stat> {
  /* A figure that could not be read says why, in the tile's own two lines. */
  const miss = (p: Part<unknown>): Stat => ({ v: p.state === "loading" ? "…" : "—", s: partNote(p) });
  const out: Record<string, Stat> = {};

  if (q.day.state === "ok") {
    const day = q.day.data;
    out.attendance = {
      v: day ? day.state.label : "No row",
      s: day && day.startedAt ? fmtHM(day.workedMinutes) + " worked today" : "today",
      tone: day && (day.state.key === "absent" || day.state.key === "unclosed") ? "warn" : "",
    };
  } else out.attendance = miss(q.day);

  if (q.work.state === "ok") {
    const late = q.work.data.filter((i) => i.delayed).length;
    const open = q.work.data.filter((i) => TERMINAL.indexOf(i.status?.key) < 0).length;
    out.work = { v: String(open), s: "open · " + late + " delayed", tone: late ? "warn" : "" };
  } else out.work = miss(q.work);

  if (q.leave.state === "ok") {
    const pendingLv = q.leave.data.filter((l) => l.state?.key === "requested").length;
    out.leave = {
      v: pendingLv ? pendingLv + " waiting" : String(q.leave.data.length),
      s: pendingLv ? "undecided" : "on record",
      tone: pendingLv ? "warn" : "",
    };
  } else out.leave = miss(q.leave);

  if (q.report.state === "ok") {
    const report = q.report.data;
    out.reports = {
      v: report && report.submittedAt ? (report.acknowledgedAt ? "Read" : "Unread") : "Not in",
      s: "today's report",
      tone: report && report.submittedAt && !report.acknowledgedAt ? "warn" : "",
    };
  } else out.reports = miss(q.report);

  if (q.agreements.state === "ok") {
    const unsigned = q.agreements.data.filter((a) => a.state?.key !== "signed" && a.state?.key !== "revoked").length;
    out.agreements = {
      v: unsigned ? unsigned + " unsigned" : String(q.agreements.data.length),
      s: unsigned ? "waiting on a signature" : "all signed",
      tone: unsigned ? "bad" : "",
    };
  } else out.agreements = miss(q.agreements);

  const missing = live.missingDocuments;
  out.documents = missing
    ? { v: missing.length ? missing.length + " missing" : "Complete", s: "required documents", tone: missing.length ? "warn" : "" }
    : { v: "—", s: "required documents" };

  if (q.resources.state === "ok") {
    const owed = owedOf(q);
    out.resources = {
      v: owed.length ? owed.length + " outstanding" : "Nothing owed",
      s: owed.length ? owed[0].title : "forms the company asked for",
      tone: owed.length ? "warn" : "",
    };
  } else out.resources = miss(q.resources);

  if (q.salary.state === "ok") {
    const account = q.salary.data;
    out.pay = {
      v: account ? inr(account.monthlyGrossPaise) : "—",
      s: account ? "a month, from Finance" : "no salary account",
    };
  } else out.pay = miss(q.salary);

  return out;
}

/* --------------------------------------------------------- the identity --- */

/** The live row exists but the operational store has no record — a fetch still
 *  in flight, or an id the adoption never saw. Identity still renders. */
function NotAdopted({ live, roles, rolesDenied, sub }: { live: LiveMember; roles: Role[]; rolesDenied?: boolean; sub: string }) {
  return (
    <div className="flex flex-col gap-5">
      {sub ? <OpHead title="Nothing here yet" /> : null}
      <Alert tone="info" title="No operational record yet">
        Attendance, work, leave and pay arrive with the API.
      </Alert>
      <IdentityBlock live={live} roles={roles} rolesDenied={rolesDenied} showAccess />
    </div>
  );
}

function IdentityBlock({ live: u, roles, rolesDenied, showAccess }: {
  live: LiveMember; roles: Role[]; rolesDenied?: boolean; showAccess: boolean;
}) {
  /* The account card is half the page when Effective access stands beside it
     and the whole page when it does not — so its facts run in one column or
     two rather than leaving a void where the second card would have been. */
  return (
    <div className={cx("grid grid-cols-1 gap-4", showAccess && "lg:grid-cols-2")}>
      <Card title="Account" sub="The identity the server holds, not the operational record.">
        <div className={cx("grid gap-x-8 gap-y-2.5", !showAccess && "lg:grid-cols-2")}>
          <KvList
            pairs={[
              ["Email", <a key="e" href={"mailto:" + u.email} className="rounded text-brand-secondary outline-focus-ring hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">{u.email}</a>],
              ["Phone", u.phone ? <span className="tnum">{u.phone}</span> : ""],
              ["Username", <span key="u" className="font-mono text-sm">{u.username || "—"}</span>],
              ["Account status", u.isActive === undefined ? ""
                : u.isActive ? <Pill text="Active" tone="ok" dot /> : <Pill text="Inactive" tone="bad" dot />],
            ]}
          />
          <KvList
            pairs={[
              ["Roles", u.roles.length ? <RoleChips u={u} />
                : <span className="text-quaternary">none — this account can sign in and do nothing</span>],
              ["Last sign-in", u.lastLogin ? <span className="font-mono text-sm tnum">{fmtLiveDate(u.lastLogin)}</span>
                : <span className="text-quaternary">never signed in</span>],
              ["Added", u.addedAt ? <span className="font-mono text-sm tnum">{fmtLiveDate(u.addedAt)}</span> : ""],
            ]}
          />
        </div>
      </Card>

      {showAccess ? (
        <Card title="Effective access" sub="What happens when they click, not what their roles are called.">
          <EffectiveAccess u={u} roles={roles} rolesDenied={rolesDenied} />
        </Card>
      ) : null}
    </div>
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

/* WHERE A VERB MEANS MORE ON ONE MODULE THAN ITS NAME SAYS. On Team, `status`
   is what the server gates suspend and reactivate on — and, on `#/team/:id`,
   permanent deletion as well: "Delete member" sits behind `can("team", "status")`
   above. A role holder reading "Activate" was never told that. A table rather
   than a special case, so the next module that overloads a verb adds a row
   here instead of a branch. The real fix is a `delete` verb on the server. */
const MODULE_ACTION_LABEL: Record<string, Record<string, string>> = {
  team: { status: "Activate · Delete" },
};
const labelFor = (moduleKey: string, act: string) =>
  (MODULE_ACTION_LABEL[moduleKey] || {})[act] || ACTION_LABEL[act] || act;

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

function EffectiveAccess({ u, roles, rolesDenied }: { u: LiveMember; roles: Role[]; rolesDenied?: boolean }) {
  const s = getSession();
  /* AN UNREADABLE REGISTRY IS NOT AN EMPTY ONE. Resolving a member's grants
     needs the role rows, and `roles.view` is a grant of its own — so a reader
     without it would have been shown "No access to anything" about somebody
     who has plenty. That is the exact wrong answer on the screen an admin
     opens to find out what a person can do. */
  if (rolesDenied)
    return (
      <Alert tone="warn" ico="lock" title="This cannot be resolved with your access">
        Working out what a member holds means reading the role registry, and your role does not
        include Roles. Ask an admin — nothing here says this member has no access.
      </Alert>
    );
  if (u.isActive === false)
    return (
      <Alert tone="warn" ico="lock" title="This account is inactive">
        Whatever its roles say, it cannot sign in and every call it makes would be refused.
      </Alert>
    );
  if (u.isSuperAdmin || roles.some((r) => r.isFullAccess && (u.roles || []).some((x) => x.id === r.id)))
    return (
      <Alert tone="info" ico="shield" title="Everything">
        Full access is a grant, not a list — it resolves to a wildcard, so a module added tomorrow is
        included without anybody editing a matrix.
      </Alert>
    );

  const grants = grantsOfMember(u, roles);
  const mods = (s ? s.modules : []).filter(
    (mod) => !HIDDEN_MODULES.has(mod.key) && (grants[mod.key] || []).indexOf("view") >= 0);
  if (!mods.length)
    return (
      <Alert tone="warn" ico="lock" title="No access to anything">
        This member can sign in and will see an empty panel — assign a role.
      </Alert>
    );

  return (
    <ul className="flex flex-col divide-y divide-border-secondary">
      {mods.map((mod) => {
        /* `view` PRINTS LIKE ANY OTHER VERB. It used to be filtered out here,
           on the reasoning that it is implied by the module being listed —
           but it is not implied, it is THE GATE, and this is the screen an
           admin opens during an outage to find out what somebody can actually
           do. First, and by name. */
        const held = grants[mod.key] || [];
        const acts = (held.indexOf("view") >= 0 ? ["view"] : [])
          .concat(held.filter((a) => a !== "view"));
        return (
          <li key={mod.key} className="flex items-start gap-2.5 py-2 first:pt-0 last:pb-0">
            <Icon name="check" size="sm" className="mt-0.5 shrink-0 text-fg-success-primary" />
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium text-primary">{mod.label}</span>
              <span className="text-xs text-tertiary">
                {acts.length ? acts.map((a) => labelFor(mod.key, a)).join(" · ") : "View only"}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
