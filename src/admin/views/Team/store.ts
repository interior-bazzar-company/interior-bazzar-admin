/* =============================================================================
   Team — the data module for the operational half.
   -----------------------------------------------------------------------------
   THE ONLY FILE IN THIS MODULE THAT KNOWS WHERE ITS OWN RECORDS COME FROM.
   Every view imports from here; no view imports JSON and no view fetches. When
   the API lands, the five imports below become AdminOpsService calls and the
   write simulation underneath comes out — the views, the CSS and the URL scheme
   do not move. See src/proto/v-2.2.0.0/BACKEND-INTEGRATION.md § Module 7.

   THIS FILE DOES NOT OWN THE IDENTITY HALF. `#/team` and `#/roles` are LIVE and
   read `AdminOpsService.users()` / `.listRoles()` directly, as they always have.
   `members.json` here stands in for the ONE thing that endpoint cannot answer:
   every member rather than only those the signed-in admin created, plus the
   employment block that has no column on the server yet. The day the team-wide
   endpoint exists, `MEMBERS` below becomes that call and nothing else changes.

   THE THREE RULES THIS FILE EXISTS TO ENFORCE
   -------------------------------------------
   1. `absent`, `unclosed` and `delayed` are NEVER STORED. Each is derived at
      read against `NOW`. Storing them needs a sweep, and this backend has no
      queue — only a 15-minute cron. The enquiries module withdrew its SLA sweep
      for exactly this reason, and a screen confidently showing a stale flag is
      worse than one showing none.
   2. `isLate` IS stored, and only ever written at open, against that member's
      own `dayStartsAt`. Changing the policy tomorrow must not make last month
      late, and there is no company-wide constant to read instead.
   3. Milestone and target progress is DERIVED, never typed. A milestone counts
      its completed children; a target accumulates the deltas its EOD reports
      recorded. A stored percentage that disagrees with the children is the bug
      this prevents, and it is the one nobody notices for a month.

   `NOW` is the seed's own `asOf`, not the browser clock — Friday 28 August
   2026, 14:20 IST. Every elapsed time, late flag and "today" is computed
   against it, so the fixture reads the same next month and a screenshot taken
   in December still makes sense. The API will send its own `asOf`, and there is
   a server-time endpoint already (`GET /engine/server-time/`) whose whole
   purpose is that the client computes a skew and never trusts `Date`.
   ============================================================================= */
import { useSyncExternalStore } from "react";
import membersDoc from "../../../content/team/members.json";
import attendanceDoc from "../../../content/team/attendance.json";
import workDoc from "../../../content/team/work.json";
import plansDoc from "../../../content/team/plans.json";
import reportsDoc from "../../../content/team/reports.json";
import vocabDoc from "../../../content/team/vocabularies.json";
import { can, getSession } from "../../auth/session";

/* ============================================================== types === */

export type MemberStatus = "active" | "inactive" | "suspended";
export type AttendanceState = "not_started" | "working" | "on_break" | "ended" | "unclosed" | "absent";
export type WorkKind = "task" | "milestone" | "target";
export type WorkStatus = "planned" | "in_progress" | "blocked" | "completed" | "cancelled";
export type Priority = "high" | "medium" | "low";
export type Scope = "self" | "team" | "all";

export interface Member {
  memberId: string;
  name: string;
  email: string;
  phone: string;
  username: string;
  designation: string;
  employmentType: string;
  joiningDate: string;
  /** The scope axis, in one column. One level deep, never transitive. */
  reportsTo: string | null;
  workLocation: string;
  expectedHoursPerDay: number;
  dayStartsAt: string;
  graceMinutes: number;
  autoCloseAt: string;
  timezone: string;
  status: MemberStatus;
  isFullAccess: boolean;
  roles: string[];
  addedAt: string;
  lastLogin: string | null;
}

export interface Break { startedAt: string; endedAt: string | null; minutes: number | null }

export interface AttendanceDay {
  attendanceId: string;
  memberId: string;
  businessDate: string;
  startedAt: string;
  endedAt: string | null;
  breaks: Break[];
  workedMinutes: number | null;
  breakMinutes: number;
  isLate: boolean;
  lateByMinutes: number;
  source: "self" | "corrected";
  correctedBy?: string;
  correctedAt?: string;
  correctionReason?: string;
}

export interface WorkItem {
  itemId: string;
  kind: WorkKind;
  title: string;
  description: string | null;
  assigneeId: string;
  createdById: string;
  parentId: string | null;
  status: WorkStatus;
  priority: Priority;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  expectedOutcome: string | null;
  blockedReason?: string;
  blockedByItemId?: string | null;
  blockedAt?: string;
  cancelledReason?: string;
  cancelledAt?: string;
  targetValue?: number;
  targetUnit?: string;
  currentValue?: number;
  sourcePlanLineId?: string | null;
  rowVersion: number;
  createdAt: string;
}

export interface PlanLine { lineId: string; ordinal: number; title: string; priority: Priority; workItemId: string | null }
export interface DailyPlan {
  planId: string; memberId: string; businessDate: string;
  expectedOutcome: string | null; blockers: string | null; notes: string | null;
  submittedAt: string | null; lines: PlanLine[];
}

export interface ReportLine { lineId: string; workItemId: string | null; title: string; done: boolean; targetDelta: number | null }
export interface DailyReport {
  reportId: string; memberId: string; businessDate: string;
  pendingWork: string | null; pendingReason: string | null; achievement: string | null;
  blockers: string | null; supportNeeded: string | null; tomorrowPriority: string | null;
  notes: string | null; submittedAt: string | null;
  acknowledgedById: string | null; acknowledgedAt: string | null;
  lines: ReportLine[];
}

/* ========================================================== the clock === */

export const NOW = new Date(membersDoc.asOf).getTime();
export const DAY = 86400000;

/* Writes stamp NOW plus the time elapsed since the module loaded: the same
   clock as every derivation, and still strictly ordered, so a break opened in
   this tab cannot land before the day that contains it. */
const LOADED_AT = Date.now();
export const stamp = () => new Date(NOW + (Date.now() - LOADED_AT)).toISOString();
export const now = () => NOW + (Date.now() - LOADED_AT);

/** The business date, IST, as a plain YYYY-MM-DD. Derived from the payload's
 *  own `asOf` rather than the browser, and never from a UTC instant on the
 *  client — that is the off-by-one that puts a Friday evening's work on
 *  Saturday for anybody west of the office. */
export const TODAY = membersDoc.asOf.slice(0, 10);

export const ts = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : NaN);

/** "09:30" on a given business date, as an instant. The member's own start and
 *  auto-close times are wall-clock strings, which is what makes them editable
 *  by a person; this is the one place they become comparable. */
const atClock = (businessDate: string, hhmm: string) =>
  new Date(businessDate + "T" + hhmm + ":00+05:30").getTime();

/* ========================================================= formatting === */

export const fmtHM = (mins: number | null | undefined) => {
  if (mins == null || isNaN(mins)) return "—";
  const h = Math.floor(mins / 60);
  const m = Math.abs(mins % 60);
  return h > 0 ? h + "h " + String(m).padStart(2, "0") + "m" : m + "m";
};

export const fmtTime = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ap = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return h + ":" + m + ap;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Parsed field by field, not through Date(string), so a date-only value is
 *  never nudged a day by the UTC-midnight rule. Same reason `ui/format.ts`
 *  does it this way. */
export const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  const p = d.slice(0, 10).split("-");
  return Number(p[2]) + " " + MONTHS[Number(p[1]) - 1] + " " + p[0];
};
export const fmtDayName = (d: string) => {
  const p = d.slice(0, 10).split("-");
  return DOW[new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])).getDay()];
};
export const addDays = (d: string, n: number) => {
  const p = d.slice(0, 10).split("-");
  const dt = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + n);
  return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
};
export const isWeekend = (d: string) => {
  const n = fmtDayName(d);
  return n === "Sat" || n === "Sun";
};

/* ======================================================== vocabulary === */

export const VOCAB = vocabDoc;

type ToneRow = { key: string; label: string; tone: string };
const toneMap = (rows: ToneRow[]) => {
  const o: Record<string, ToneRow> = {};
  rows.forEach((r) => { o[r.key] = r; });
  return o;
};
export const ATT_STATE = toneMap(vocabDoc.attendanceStates as ToneRow[]);
export const WORK_STATUS = toneMap(vocabDoc.workStatuses as ToneRow[]);
export const PRIORITY = toneMap(vocabDoc.priorities as ToneRow[]);
export const KIND = toneMap(vocabDoc.workKinds as unknown as ToneRow[]);

export const labelOf = (map: Record<string, ToneRow>, k: string) => (map[k] ? map[k].label : k);
export const toneOf = (map: Record<string, ToneRow>, k: string) => (map[k] ? map[k].tone : "");

/* ============================================================== state === */
/* One mutable snapshot for this browser tab. Every write replaces the arrays it
   touches and bumps `version`, which is what useSyncExternalStore subscribes
   to. Nothing is persisted: a reload restores the seed, and the proto banner on
   every face says so in the same words. */

type Snapshot = {
  members: Member[];
  days: AttendanceDay[];
  items: WorkItem[];
  plans: DailyPlan[];
  reports: DailyReport[];
  version: number;
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const seed = (): Snapshot => ({
  members: clone(membersDoc.members) as Member[],
  days: clone(attendanceDoc.days) as AttendanceDay[],
  items: clone(workDoc.items) as WorkItem[],
  plans: clone(plansDoc.plans) as DailyPlan[],
  reports: clone(reportsDoc.reports) as DailyReport[],
  version: 0,
});

let snap: Snapshot = seed();
const listeners = new Set<() => void>();
const emit = () => { snap = { ...snap, version: snap.version + 1 }; listeners.forEach((l) => l()); };
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const getVersion = () => snap.version;

/** Re-seed. Local scaffolding only — it exists so a demo can be walked twice. */
export function resetStore() { snap = seed(); emit(); }

/* Plain readers over the same snapshot the hooks subscribe to. The check suite
   calls exactly these, so what it asserts is what the screens see and not a
   parallel reimplementation of it. */
export const readMembers = (): Member[] => snap.members;
export const readDays = (): AttendanceDay[] => snap.days;
export const readItems = (): WorkItem[] => snap.items;
export const readPlans = (): DailyPlan[] => snap.plans;
export const readReports = (): DailyReport[] => snap.reports;
export const readMember = (id: string): Member | null =>
  snap.members.filter((m) => m.memberId === id)[0] || null;
export const readItem = (id: string): WorkItem | null =>
  snap.items.filter((i) => i.itemId === id)[0] || null;

/* ============================================================== scope === */

/** Who is looking. The session's own id where the seed knows it, and otherwise
 *  a designated member so the prototype is walkable signed in as anybody — the
 *  fallback is scaffolding and goes with the seed. */
export function meId(): string {
  const s = getSession();
  const byId = s?.user?.id != null ? String(s.user.id) : null;
  if (byId && snap.members.some((m) => m.memberId === byId)) return byId;
  const byName = snap.members.filter((m) => m.name === s?.user?.name)[0];
  return byName ? byName.memberId : "58";
}

/** TM-OD-01, answered 2026-08-30: a senior sees their own reports, one level,
 *  and everybody only with the module's `all` verb.
 *
 *  WHILE THE MODULE IS PROTO-GATED THIS RESOLVES TO `all` FOR EVERY SESSION,
 *  because `can()` answers true unconditionally for a key in PROTO_MODULES —
 *  including `all`. That is the proto hole, not a bug here, and it closes on
 *  the commit that gives these keys real Module rows. The derivation is already
 *  the real one and starts discriminating the moment it does. Every face states
 *  the scope it is showing, so the widening is visible rather than silent. */
export function scopeOf(moduleKey: string): Scope {
  const s = getSession();
  if (s?.isFullAccess) return "all";
  if (can(moduleKey, "all")) return "all";
  if (can(moduleKey, "view")) return "team";
  return "self";
}

/** The members a scope resolves to. ONE LEVEL for `team`: a head whose reports
 *  have their own reports sees the first ring, not the transitive closure — a
 *  recursive default is a permission that widens every time somebody is hired
 *  under somebody else, and nobody notices until it has. */
export function membersInScope(scope: Scope, me = meId()): Member[] {
  if (scope === "all") return snap.members;
  if (scope === "self") return snap.members.filter((m) => m.memberId === me);
  return snap.members.filter((m) => m.memberId === me || m.reportsTo === me);
}

export const scopeLabel = (scope: Scope, n: number) =>
  scope === "all" ? "Everyone · " + n
    : scope === "team" ? "You and your reports · " + n
      : "Only you";

/* ======================================================== attendance === */

const breaksClosedMinutes = (d: AttendanceDay) =>
  d.breaks.reduce((a, b) => a + (b.minutes || 0), 0);

export const openBreakOf = (d: AttendanceDay): Break | null =>
  d.breaks.filter((b) => !b.endedAt)[0] || null;

/** Past its own auto-close on a day that is over. Derived, and the reason
 *  nothing sweeps: an auto-closed day is a number the system invented; an
 *  unclosed one is a question, and a question is honest. */
export function isUnclosed(d: AttendanceDay, m: Member | null, at = now()): boolean {
  if (d.endedAt) return false;
  const cutoff = atClock(d.businessDate, (m && m.autoCloseAt) || "20:00");
  return at > cutoff;
}

export function stateOf(d: AttendanceDay | null, m: Member | null, at = now()): AttendanceState {
  if (!d) {
    if (!m) return "not_started";
    /* Absent is only answerable once the day is over. At 10am a member who is
       not in yet is Not started — calling them absent is a verdict the clock
       has not earned. */
    const over = at > atClock(TODAY, m.autoCloseAt || "20:00");
    return over ? "absent" : "not_started";
  }
  if (isUnclosed(d, m, at)) return "unclosed";
  if (d.endedAt) return "ended";
  return openBreakOf(d) ? "on_break" : "working";
}

/** Minutes actually worked. A closed day uses its stored total; an open one
 *  counts to `at` and subtracts every closed break AND the running one. An
 *  unclosed day returns null and contributes to nothing — it is not a
 *  fourteen-hour shift and it is not zero either. */
export function workedOf(d: AttendanceDay | null, m: Member | null, at = now()): number | null {
  if (!d) return null;
  if (d.endedAt) return d.workedMinutes;
  if (isUnclosed(d, m, at)) return null;
  const open = openBreakOf(d);
  const runningBreak = open ? Math.max(0, Math.round((at - ts(open.startedAt)) / 60000)) : 0;
  const elapsed = Math.max(0, Math.round((at - ts(d.startedAt)) / 60000));
  return Math.max(0, elapsed - breaksClosedMinutes(d) - runningBreak);
}

export function breakOf(d: AttendanceDay | null, at = now()): number {
  if (!d) return 0;
  const open = openBreakOf(d);
  const running = open ? Math.max(0, Math.round((at - ts(open.startedAt)) / 60000)) : 0;
  return breaksClosedMinutes(d) + running;
}

export const dayFor = (memberId: string, date: string): AttendanceDay | null =>
  snap.days.filter((d) => d.memberId === memberId && d.businessDate === date)[0] || null;

export interface DayRow {
  member: Member;
  day: AttendanceDay | null;
  state: AttendanceState;
  worked: number | null;
  breakMins: number;
}

/** One row per member in scope for one business date — including the members
 *  with no row at all, because absence is the LACK of a record and a screen
 *  that only renders rows can never show who did not come in. */
export function dayRows(date: string, scope: Scope, at = now()): DayRow[] {
  return membersInScope(scope)
    .filter((m) => m.status === "active")
    .map((m) => {
      const day = dayFor(m.memberId, date);
      return {
        member: m,
        day,
        state: date === TODAY ? stateOf(day, m, at) : stateOf(day, m, at + DAY),
        worked: workedOf(day, m, at),
        breakMins: breakOf(day, at),
      };
    });
}

export interface AttendanceTotals {
  present: number; working: number; onBreak: number; ended: number;
  late: number; absent: number; unclosed: number; total: number;
}

export function attendanceTotals(rows: DayRow[]): AttendanceTotals {
  const t: AttendanceTotals = { present: 0, working: 0, onBreak: 0, ended: 0, late: 0, absent: 0, unclosed: 0, total: rows.length };
  rows.forEach((r) => {
    if (r.day) t.present++;
    if (r.state === "working") t.working++;
    if (r.state === "on_break") t.onBreak++;
    if (r.state === "ended") t.ended++;
    if (r.state === "unclosed") t.unclosed++;
    if (r.state === "absent") t.absent++;
    if (r.day && r.day.isLate) t.late++;
  });
  return t;
}

/** The working days of the week containing `date`, Monday first, weekends
 *  dropped. Leave and holidays are out of v1 (TM-OD-13), so "working day"
 *  means "not a weekend" and nothing more — stated here rather than assumed
 *  in four places. */
export function weekOf(date: string): string[] {
  const p = date.slice(0, 10).split("-");
  const dt = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  const back = (dt.getDay() + 6) % 7;
  const monday = addDays(date, -back);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    if (!isWeekend(d)) out.push(d);
  }
  return out;
}

/* ============================================================== work === */

export const isTerminal = (s: WorkStatus) => s === "completed" || s === "cancelled";

/** Past due and not finished. Never stored — see rule 1 at the top. A cancelled
 *  item is excluded, which is the single easiest part of this to get wrong:
 *  a terminal item cannot be late. */
export function isDelayed(i: WorkItem, today = TODAY): boolean {
  if (isTerminal(i.status)) return false;
  return !!i.dueDate && i.dueDate < today;
}

export const childrenOf = (id: string, all = snap.items) => all.filter((i) => i.parentId === id);

/** Progress, derived. A milestone counts its completed children; a target
 *  divides what its EOD reports accumulated by what it asked for; a task is
 *  binary. Nothing here reads a stored percentage, and none is written. */
export function progressOf(i: WorkItem, all = snap.items): number | null {
  if (i.kind === "task") return i.status === "completed" ? 100 : 0;
  if (i.kind === "target") {
    if (!i.targetValue) return null;
    return Math.min(100, Math.round(((i.currentValue || 0) / i.targetValue) * 100));
  }
  const kids = childrenOf(i.itemId, all);
  if (!kids.length) return i.status === "completed" ? 100 : 0;
  return Math.round((kids.filter((k) => k.status === "completed").length / kids.length) * 100);
}

export const parentOf = (i: WorkItem, all = snap.items) =>
  (i.parentId ? all.filter((p) => p.itemId === i.parentId)[0] : null) || null;

export interface WorkFilter {
  member?: string; kind?: string; status?: string; priority?: string;
  due?: string; q?: string; parent?: string;
}

export function workRows(f: WorkFilter, scope: Scope): WorkItem[] {
  const ids = membersInScope(scope).map((m) => m.memberId);
  let rows = snap.items.filter((i) => ids.indexOf(i.assigneeId) >= 0);
  if (f.member) rows = rows.filter((i) => i.assigneeId === f.member);
  if (f.kind) rows = rows.filter((i) => i.kind === f.kind);
  if (f.status === "delayed") rows = rows.filter((i) => isDelayed(i));
  else if (f.status) rows = rows.filter((i) => i.status === f.status);
  if (f.priority) rows = rows.filter((i) => i.priority === f.priority);
  if (f.parent) rows = rows.filter((i) => i.parentId === f.parent || i.itemId === f.parent);
  if (f.due === "today") rows = rows.filter((i) => i.dueDate === TODAY);
  if (f.due === "week") {
    const wk = weekOf(TODAY);
    rows = rows.filter((i) => !!i.dueDate && wk.indexOf(i.dueDate) >= 0);
  }
  if (f.q) {
    const q = f.q.toLowerCase();
    rows = rows.filter((i) =>
      i.title.toLowerCase().indexOf(q) >= 0 ||
      (i.description || "").toLowerCase().indexOf(q) >= 0);
  }
  /* Overdue first, then by due date, then priority. The order answers "what is
     going wrong" before "what is next", which is the question this list is
     opened with. */
  const rank = (i: WorkItem) => (isDelayed(i) ? 0 : isTerminal(i.status) ? 2 : 1);
  const prank = (p: Priority) => (PRIORITY[p] ? (PRIORITY[p] as unknown as { rank: number }).rank : 9);
  return rows.slice().sort((a, b) =>
    rank(a) - rank(b) ||
    (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
    prank(a.priority) - prank(b.priority));
}

export interface WorkTotals {
  total: number; planned: number; inProgress: number; blocked: number;
  completed: number; cancelled: number; delayed: number;
}

export function workTotals(rows: WorkItem[]): WorkTotals {
  const t: WorkTotals = { total: rows.length, planned: 0, inProgress: 0, blocked: 0, completed: 0, cancelled: 0, delayed: 0 };
  rows.forEach((i) => {
    if (i.status === "planned") t.planned++;
    if (i.status === "in_progress") t.inProgress++;
    if (i.status === "blocked") t.blocked++;
    if (i.status === "completed") t.completed++;
    if (i.status === "cancelled") t.cancelled++;
    if (isDelayed(i)) t.delayed++;
  });
  return t;
}

/* ====================================================== plans & EOD === */

export const planFor = (memberId: string, date: string): DailyPlan | null =>
  snap.plans.filter((p) => p.memberId === memberId && p.businessDate === date)[0] || null;

export const reportFor = (memberId: string, date: string): DailyReport | null =>
  snap.reports.filter((r) => r.memberId === memberId && r.businessDate === date)[0] || null;

/** An EOD is only outstanding once the day is over. Missing at 14:20 is not
 *  missing, it is early — and a band that shouts at half the company every
 *  afternoon is a band people stop reading. */
export function eodDue(date: string, m: Member, at = now()): boolean {
  if (date < TODAY) return true;
  if (date > TODAY) return false;
  return at > atClock(date, m.autoCloseAt || "20:00");
}

export interface ReviewRow {
  member: Member;
  day: AttendanceDay | null;
  state: AttendanceState;
  worked: number | null;
  plan: DailyPlan | null;
  report: DailyReport | null;
  eodDue: boolean;
  items: WorkItem[];
  doing: WorkItem | null;
  done: number;
  planned: number;
  delayed: number;
  blocked: number;
}

/** The senior's day, one row per member in scope. Everything on it is derived
 *  from the same arrays the drill-down renders, so a count here and the list it
 *  opens cannot disagree — the rule the Users module's analytics face was
 *  built on and the reason its headline numbers are not served separately. */
export function reviewRows(date: string, scope: Scope, at = now()): ReviewRow[] {
  return membersInScope(scope)
    .filter((m) => m.status === "active")
    .map((m) => {
      const day = dayFor(m.memberId, date);
      const items = snap.items.filter((i) => i.assigneeId === m.memberId);
      const dueToday = items.filter((i) => i.dueDate === date);
      return {
        member: m,
        day,
        state: stateOf(day, m, at),
        worked: workedOf(day, m, at),
        plan: planFor(m.memberId, date),
        report: reportFor(m.memberId, date),
        eodDue: eodDue(date, m, at),
        items,
        doing: items.filter((i) => i.status === "in_progress")[0] || null,
        done: dueToday.filter((i) => i.status === "completed").length,
        planned: dueToday.length,
        delayed: items.filter((i) => isDelayed(i)).length,
        blocked: items.filter((i) => i.status === "blocked").length,
      };
    });
}

export interface Attention {
  noPlan: ReviewRow[];
  noEod: ReviewRow[];
  delayed: WorkItem[];
  blocked: WorkItem[];
  lateOrAbsent: ReviewRow[];
  unacknowledged: ReviewRow[];
}

/** What needs a human, in the order a manager actually asks. Everything here is
 *  a filter over `reviewRows` — there is no second query and no second
 *  definition of "missing". */
export function attentionOf(rows: ReviewRow[]): Attention {
  const items = rows.reduce<WorkItem[]>((a, r) => a.concat(r.items), []);
  const seen: Record<string, boolean> = {};
  const uniq = (list: WorkItem[]) => list.filter((i) => (seen[i.itemId] ? false : (seen[i.itemId] = true)));
  return {
    /* The founder — anybody with no reporting line — is excluded from the two
       submission counts. A number that always shows the same person delinquent
       is a number people learn to ignore. */
    noPlan: rows.filter((r) => r.member.reportsTo && (!r.plan || !r.plan.submittedAt)),
    noEod: rows.filter((r) => r.member.reportsTo && r.eodDue && (!r.report || !r.report.submittedAt)),
    delayed: uniq(items.filter((i) => isDelayed(i))),
    blocked: uniq(items.filter((i) => i.status === "blocked")),
    lateOrAbsent: rows.filter((r) => r.state === "absent" || (r.day && r.day.isLate)),
    unacknowledged: rows.filter((r) => r.report && r.report.submittedAt && !r.report.acknowledgedById),
  };
}

/* ================================================ the write simulation ===
   Everything below lands in this browser tab and is discarded on reload. It
   exists so the screens can be walked end to end and so the transitions are
   stated somewhere executable rather than only in a document. Each function
   returns { ok } or { ok:false, code, message } in the shape the API's error
   contract uses, so the views' refusal handling is the real one. */

export type Refusal = { ok: false; code: string; message: string };
export type Ok<T> = { ok: true; data: T };
export type Result<T> = Ok<T> | Refusal;
const err = (code: string, message: string): Refusal => ({ ok: false, code, message });
const ok = <T,>(data: T): Ok<T> => ({ ok: true, data });

let seq = 0;
const nextId = (prefix: string) => prefix + "-" + (Date.now().toString(36) + (seq++).toString(36)).toUpperCase();

/** THE RECORD INSIDE *THIS* ARRAY. Every mutator finds its row in the list it
 *  is about to write back, never in a second read — the prototype lost every
 *  member edit for exactly that reason (defect T-1), because two reads of one
 *  store hand back objects from two different parses and mutating one saves
 *  the other. */
const findDay = (list: AttendanceDay[], memberId: string, date: string) =>
  list.filter((d) => d.memberId === memberId && d.businessDate === date)[0] || null;

export function openDay(memberId: string): Result<AttendanceDay> {
  const days = snap.days.slice();
  const existing = findDay(days, memberId, TODAY);
  /* IDEMPOTENT, not a conflict. A second tab, or a second device, must get the
     SAME open day back — refusing it would make the honest fix (press it
     again) look like a bug. */
  if (existing) return ok(existing);
  const m = readMember(memberId);
  if (!m) return err("member_not_found", "No such member.");
  if (m.status !== "active") return err("account_inactive", "This account is not active.");
  const at = now();
  const threshold = atClock(TODAY, m.dayStartsAt) + m.graceMinutes * 60000;
  const day: AttendanceDay = {
    attendanceId: nextId("ATT"),
    memberId, businessDate: TODAY,
    startedAt: new Date(at).toISOString(),
    endedAt: null, breaks: [], workedMinutes: null, breakMinutes: 0,
    /* Computed at open, against this member's own start time, and stored. */
    isLate: at > threshold,
    lateByMinutes: at > threshold ? Math.round((at - threshold) / 60000) : 0,
    source: "self",
  };
  days.push(day);
  snap.days = days;
  emit();
  return ok(day);
}

export function startBreak(memberId: string): Result<AttendanceDay> {
  const days = snap.days.slice();
  const d = findDay(days, memberId, TODAY);
  if (!d) return err("day_not_open", "Start the day before taking a break.");
  if (d.endedAt) return err("day_ended", "The day is already closed.");
  if (openBreakOf(d)) return err("already_on_break", "A break is already running.");
  d.breaks = d.breaks.concat([{ startedAt: new Date(now()).toISOString(), endedAt: null, minutes: null }]);
  snap.days = days;
  emit();
  return ok(d);
}

export function resumeDay(memberId: string): Result<AttendanceDay> {
  const days = snap.days.slice();
  const d = findDay(days, memberId, TODAY);
  if (!d) return err("day_not_open", "No open day.");
  const open = openBreakOf(d);
  if (!open) return err("not_on_break", "No break is running.");
  const at = now();
  open.endedAt = new Date(at).toISOString();
  open.minutes = Math.max(0, Math.round((at - ts(open.startedAt)) / 60000));
  d.breakMinutes = breaksClosedMinutes(d);
  snap.days = days;
  emit();
  return ok(d);
}

export function endDay(memberId: string): Result<AttendanceDay> {
  const days = snap.days.slice();
  const d = findDay(days, memberId, TODAY);
  if (!d) return err("day_not_open", "No open day to close.");
  if (d.endedAt) return err("day_ended", "The day is already closed.");
  const at = now();
  /* Closing the day closes a running break at the same instant. Leaving it open
     reports a nine-hour lunch, which is the only way this arithmetic can
     produce a number nobody recognises. */
  const open = openBreakOf(d);
  if (open) {
    open.endedAt = new Date(at).toISOString();
    open.minutes = Math.max(0, Math.round((at - ts(open.startedAt)) / 60000));
  }
  d.endedAt = new Date(at).toISOString();
  d.breakMinutes = breaksClosedMinutes(d);
  d.workedMinutes = Math.max(0, Math.round((at - ts(d.startedAt)) / 60000) - d.breakMinutes);
  snap.days = days;
  emit();
  return ok(d);
}

export function setItemStatus(itemId: string, to: WorkStatus, reason?: string): Result<WorkItem> {
  const items = snap.items.slice();
  const i = items.filter((x) => x.itemId === itemId)[0];
  if (!i) return err("item_not_found", "No such work item.");
  const row = (vocabDoc.workTransitions as { from: string; to: string[]; requiresReason?: boolean }[])
    .filter((t) => t.from === i.status)[0];
  if (!row || row.to.indexOf(to) < 0)
    return err("invalid_transition", labelOf(WORK_STATUS, i.status) + " cannot become " + labelOf(WORK_STATUS, to) + ".");
  const needsReason = row.requiresReason || to === "blocked" || to === "cancelled";
  if (needsReason && !(reason || "").trim())
    return err("reason_required", "This change needs a reason.");
  i.status = to;
  i.rowVersion += 1;
  if (to === "completed") i.completedAt = new Date(now()).toISOString();
  if (to === "blocked") { i.blockedReason = reason; i.blockedAt = new Date(now()).toISOString(); }
  if (to === "cancelled") { i.cancelledReason = reason; i.cancelledAt = new Date(now()).toISOString(); }
  if (to === "in_progress") { i.completedAt = null; delete i.blockedReason; delete i.blockedAt; }
  snap.items = items;
  emit();
  return ok(i);
}

export function createItem(input: Partial<WorkItem> & { title: string; assigneeId: string; kind: WorkKind }): Result<WorkItem> {
  if (!input.title.trim()) return err("validation_failed", "A title is required.");
  const assignee = readMember(input.assigneeId);
  if (!assignee) return err("member_not_found", "No such member.");
  if (assignee.status !== "active") return err("assignee_inactive", "That member is not active.");
  if (input.parentId) {
    const p = readItem(input.parentId);
    if (!p) return err("invalid_parent", "No such parent.");
    /* Depth 3, target ▸ milestone ▸ task. A fourth level is a project tool,
       and this is not one. */
    if (p.kind === "task") return err("invalid_parent", "A task cannot hold children.");
    if (input.kind === "target") return err("invalid_parent", "A target is always top level.");
  }
  const item: WorkItem = {
    itemId: nextId("W"),
    kind: input.kind,
    title: input.title.trim(),
    description: input.description || null,
    assigneeId: input.assigneeId,
    createdById: meId(),
    parentId: input.parentId || null,
    status: "planned",
    priority: input.priority || "medium",
    startDate: input.startDate || null,
    dueDate: input.dueDate || null,
    completedAt: null,
    expectedOutcome: input.expectedOutcome || null,
    targetValue: input.targetValue,
    targetUnit: input.targetUnit,
    currentValue: input.kind === "target" ? 0 : undefined,
    rowVersion: 1,
    createdAt: new Date(now()).toISOString(),
  };
  snap.items = snap.items.concat([item]);
  emit();
  return ok(item);
}

export function submitPlan(memberId: string, input: {
  lines: { title: string; priority: Priority }[];
  expectedOutcome?: string; blockers?: string;
}): Result<DailyPlan> {
  const existing = planFor(memberId, TODAY);
  if (existing && existing.submittedAt)
    return err("already_submitted", "Today's plan is in. Change the work items instead.");
  const lines = input.lines.filter((l) => l.title.trim());
  if (!lines.length) return err("validation_failed", "Add at least one line.");

  const items = snap.items.slice();
  const planLines: PlanLine[] = lines.map((l, n) => {
    /* Link an existing open item with the same title rather than minting a
       second copy of it — a plan that quietly forks a task is how one piece of
       work becomes two that each look half-done. */
    const match = items.filter((i) =>
      i.assigneeId === memberId && !isTerminal(i.status) &&
      i.title.trim().toLowerCase() === l.title.trim().toLowerCase())[0];
    const lineId = nextId("PL");
    if (match) return { lineId, ordinal: n + 1, title: l.title.trim(), priority: l.priority, workItemId: match.itemId };
    const made: WorkItem = {
      itemId: nextId("W"), kind: "task", title: l.title.trim(), description: null,
      assigneeId: memberId, createdById: memberId, parentId: null, status: "planned",
      priority: l.priority, startDate: TODAY, dueDate: TODAY, completedAt: null,
      expectedOutcome: null, sourcePlanLineId: lineId, rowVersion: 1,
      createdAt: new Date(now()).toISOString(),
    };
    items.push(made);
    return { lineId, ordinal: n + 1, title: made.title, priority: l.priority, workItemId: made.itemId };
  });

  const plan: DailyPlan = {
    planId: existing ? existing.planId : nextId("PLAN"),
    memberId, businessDate: TODAY,
    expectedOutcome: input.expectedOutcome || null,
    blockers: input.blockers || null,
    notes: null,
    submittedAt: new Date(now()).toISOString(),
    lines: planLines,
  };
  snap.items = items;
  snap.plans = snap.plans.filter((p) => p.planId !== plan.planId).concat([plan]);
  emit();
  return ok(plan);
}

export function submitReport(memberId: string, input: {
  lines: { workItemId: string | null; title: string; done: boolean; targetDelta?: number | null }[];
  pendingWork?: string; pendingReason?: string; achievement?: string;
  blockers?: string; supportNeeded?: string; tomorrowPriority?: string;
}): Result<DailyReport> {
  const existing = reportFor(memberId, TODAY);
  if (existing && existing.submittedAt)
    return err("already_submitted", "Today's report is in.");
  const undone = input.lines.filter((l) => !l.done);
  if (undone.length && !(input.pendingReason || "").trim())
    return err("validation_failed", "Say why the unticked lines did not get done.");

  const items = snap.items.slice();
  input.lines.forEach((l) => {
    if (!l.done || !l.workItemId) return;
    const i = items.filter((x) => x.itemId === l.workItemId)[0];
    /* Ticking a line COMPLETES the item. The report and the board cannot
       disagree about what got done, because there is one write. */
    if (i && !isTerminal(i.status)) {
      i.status = "completed";
      i.completedAt = new Date(now()).toISOString();
      i.rowVersion += 1;
    }
    /* A target moves only here — the EOD delta is its one writer. */
    if (l.targetDelta && i && i.parentId) {
      const parent = items.filter((x) => x.itemId === i.parentId)[0];
      if (parent && parent.kind === "target") parent.currentValue = (parent.currentValue || 0) + l.targetDelta;
    } else if (l.targetDelta && i && i.kind === "target") {
      i.currentValue = (i.currentValue || 0) + l.targetDelta;
    }
  });

  const report: DailyReport = {
    reportId: existing ? existing.reportId : nextId("EOD"),
    memberId, businessDate: TODAY,
    pendingWork: input.pendingWork || null,
    pendingReason: input.pendingReason || null,
    achievement: input.achievement || null,
    blockers: input.blockers || null,
    supportNeeded: input.supportNeeded || null,
    tomorrowPriority: input.tomorrowPriority || null,
    notes: null,
    submittedAt: new Date(now()).toISOString(),
    acknowledgedById: null, acknowledgedAt: null,
    lines: input.lines.map((l) => ({
      lineId: nextId("ER"), workItemId: l.workItemId, title: l.title,
      done: l.done, targetDelta: l.targetDelta ?? null,
    })),
  };
  snap.items = items;
  snap.reports = snap.reports.filter((r) => r.reportId !== report.reportId).concat([report]);
  emit();
  return ok(report);
}

export function acknowledgeReport(reportId: string): Result<DailyReport> {
  const reports = snap.reports.slice();
  const r = reports.filter((x) => x.reportId === reportId)[0];
  if (!r) return err("report_not_found", "No such report.");
  if (!r.submittedAt) return err("not_submitted", "A draft cannot be acknowledged.");
  if (r.acknowledgedById) return ok(r);
  r.acknowledgedById = meId();
  r.acknowledgedAt = new Date(now()).toISOString();
  snap.reports = reports;
  emit();
  return ok(r);
}

/* ============================================================== hooks === */

const useVersion = () => useSyncExternalStore(subscribe, getVersion, getVersion);

export function useMembers(): Member[] { useVersion(); return snap.members; }
export function useMe(): Member | null { useVersion(); return readMember(meId()); }
export function useDayRows(date: string, scope: Scope): DayRow[] { useVersion(); return dayRows(date, scope); }
export function useWork(f: WorkFilter, scope: Scope): WorkItem[] { useVersion(); return workRows(f, scope); }
export function useItem(id: string | null): WorkItem | null { useVersion(); return id ? readItem(id) : null; }
export function useReview(date: string, scope: Scope): ReviewRow[] { useVersion(); return reviewRows(date, scope); }
export function useMyDay(date = TODAY): { day: AttendanceDay | null; state: AttendanceState; worked: number | null; breakMins: number } {
  useVersion();
  const m = readMember(meId());
  const day = dayFor(meId(), date);
  return { day, state: stateOf(day, m), worked: workedOf(day, m), breakMins: breakOf(day) };
}
export function usePlan(memberId: string, date = TODAY): DailyPlan | null { useVersion(); return planFor(memberId, date); }
export function useReport(memberId: string, date = TODAY): DailyReport | null { useVersion(); return reportFor(memberId, date); }
