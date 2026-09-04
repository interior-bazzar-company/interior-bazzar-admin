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
import tagsDoc from "../../../content/team/tags.json";
import leaveDoc from "../../../content/team/leave.json";
import agreementsDoc from "../../../content/team/agreements.json";
import resourcesDoc from "../../../content/team/resources.json";
import payDoc from "../../../content/team/pay.json";
import vocabDoc from "../../../content/team/vocabularies.json";
import { can, getSession } from "../../auth/session";

/* ============================================================== types === */

export type MemberStatus = "active" | "inactive" | "suspended";
export type AttendanceState =
  "not_started" | "working" | "on_break" | "ended" | "unclosed" | "absent" | "on_leave";
export type WorkKind = "task" | "milestone" | "target";
/** FOUR stored values. `blocked` is not among them: waiting on someone is a
 *  relationship, not a stage, and it lives on `blockedByItemId`. */
export type WorkStatus = "planned" | "in_progress" | "completed" | "cancelled";
/** The five stages a person sees. `delayed` is derived and takes precedence,
 *  so an item is in exactly one of them. */
export type WorkStage = WorkStatus | "delayed";
export type LeaveState = "requested" | "approved" | "rejected" | "withdrawn";
export type Priority = "high" | "medium" | "low";
export type Scope = "self" | "team" | "all";

export interface Member {
  memberId: string;
  name: string;
  email: string;
  phone: string;
  username: string;
  designation: string;
  department: string;
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
  /** Member-owned tag records. Free, unlike the stage, which is company-wide. */
  tagIds?: string[];
  rowVersion: number;
  createdAt: string;
}

export type AgreementState = "draft" | "sent" | "viewed" | "signed" | "revoked" | "expired";

export interface Agreement {
  agreementId: string;
  memberId: string;
  kind: string;
  title: string;
  version: number;
  state: AgreementState;
  sentAt: string | null;
  sentById: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  signedName: string | null;
  signerIp: string | null;
  expiresAt: string | null;
  token: string;
  fileName: string;
}

export interface Resource {
  resourceId: string;
  memberId: string;
  kind: string;
  label: string;
  fileName: string;
  sizeKb: number;
  uploadedAt: string;
  uploadedById: string;
  verifiedById: string | null;
  verifiedAt: string | null;
}

export interface Incentive {
  incentiveId: string; month: string; basis: string; amount: number; state: string;
}
export interface Pay {
  memberId: string;
  annualCtc: number;
  currency: string;
  effectiveFrom: string;
  lastPayslip: { month: string; net: number; paidAt: string } | null;
  incentives: Incentive[];
}

export interface Tag {
  tagId: string;
  ownerId: string;
  /** Identity is (ownerId, slug). Two members may both hold `call`. */
  slug: string;
  label: string;
  colourToken: string;
  createdAt: string;
  archivedAt: string | null;
}

export interface LeaveRequest {
  leaveId: string;
  memberId: string;
  fromDate: string;
  toDate: string;
  kind: string;
  reason: string;
  state: LeaveState;
  decidedById: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  requestedAt: string;
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
/** All five stages, the derived one included — labels and tones come from the
 *  vocabulary so a relabel server-side needs no code edit here. */
export const WORK_STATUS = toneMap(vocabDoc.workStatuses as ToneRow[]);
export const LEAVE_STATE = toneMap(vocabDoc.leaveStates as ToneRow[]);
export const LEAVE_KIND = toneMap(vocabDoc.leaveKinds as unknown as ToneRow[]);
export const AGREEMENT_KIND = toneMap(vocabDoc.agreementKinds as unknown as ToneRow[]);
export const AGREEMENT_STATE = toneMap(vocabDoc.agreementStates as ToneRow[]);
export const RESOURCE_KIND = toneMap(vocabDoc.resourceKinds as unknown as ToneRow[]);
/** The documents a member is expected to have handed over. Vocabulary, not a
 *  constant here: adding one server-side must not need a code edit. */
export const REQUIRED_DOCS: string[] = (vocabDoc.resourceKinds as { key: string; required?: boolean }[])
  .filter((r) => r.required).map((r) => r.key);
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
  tags: Tag[];
  leave: LeaveRequest[];
  agreements: Agreement[];
  resources: Resource[];
  version: number;
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const seed = (): Snapshot => ({
  members: clone(membersDoc.members) as Member[],
  days: clone(attendanceDoc.days) as AttendanceDay[],
  items: clone(workDoc.items) as WorkItem[],
  plans: clone(plansDoc.plans) as DailyPlan[],
  reports: clone(reportsDoc.reports) as DailyReport[],
  tags: clone(tagsDoc.tags) as Tag[],
  leave: clone(leaveDoc.leave) as LeaveRequest[],
  agreements: clone(agreementsDoc.agreements) as Agreement[],
  resources: clone(resourcesDoc.resources) as Resource[],
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
export const readTags = (): Tag[] => snap.tags;
export const readLeave = (): LeaveRequest[] => snap.leave;
export const readAgreements = (): Agreement[] => snap.agreements;
export const readResources = (): Resource[] => snap.resources;
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

/** APPROVED LEAVE SUPPRESSES A DERIVED ABSENCE. It writes no attendance row —
 *  two records answering "was this person in" disagree inside a month — so the
 *  suppression happens here, at read, and only when no day was opened. A member
 *  who came in anyway has a row, and the row wins. */
export function stateOf(d: AttendanceDay | null, m: Member | null, at = now(), date?: string): AttendanceState {
  const on = d ? null : onLeave(m ? m.memberId : "", date || "");
  if (on) return "on_leave";
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
        state: date === TODAY ? stateOf(day, m, at, date) : stateOf(day, m, at + DAY, date),
        worked: workedOf(day, m, at),
        breakMins: breakOf(day, at),
      };
    });
}

export interface AttendanceTotals {
  present: number; working: number; onBreak: number; ended: number;
  late: number; absent: number; onLeave: number; unclosed: number; total: number;
}

export function attendanceTotals(rows: DayRow[]): AttendanceTotals {
  const t: AttendanceTotals = { present: 0, working: 0, onBreak: 0, ended: 0, late: 0, absent: 0, onLeave: 0, unclosed: 0, total: rows.length };
  rows.forEach((r) => {
    if (r.day) t.present++;
    if (r.state === "working") t.working++;
    if (r.state === "on_break") t.onBreak++;
    if (r.state === "ended") t.ended++;
    if (r.state === "unclosed") t.unclosed++;
    if (r.state === "absent") t.absent++;
    if (r.state === "on_leave") t.onLeave++;
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

/** The stage an item is IN, which is not always the stage it stores. Delay wins
 *  over the stored value, so every item sits in exactly one column and the
 *  strip and the board can never disagree. */
export const stageOf = (i: WorkItem, today = TODAY): WorkStage =>
  (isDelayed(i, today) ? "delayed" : i.status);

/** What an item is waiting on, if the blocker is still open. A finished blocker
 *  stops blocking without anybody clearing the field. */
export function blockerOf(i: WorkItem, all = snap.items): WorkItem | null {
  if (!i.blockedByItemId) return null;
  const b = all.filter((x) => x.itemId === i.blockedByItemId)[0];
  return b && !isTerminal(b.status) ? b : null;
}

/** Where today sits between startDate and dueDate, as a percentage. Elapsed —
 *  NOT progress. Drawn as a marker over the progress bar so "50% done, 91% of
 *  the window gone" is one glance instead of two numbers nobody compares. */
export function timePct(i: WorkItem, today = TODAY): number | null {
  if (!i.startDate || !i.dueDate) return null;
  const a = new Date(i.startDate).getTime(), b = new Date(i.dueDate).getTime();
  if (b <= a) return 100;
  const t = new Date(today).getTime();
  return Math.max(0, Math.min(100, Math.round(((t - a) / (b - a)) * 100)));
}

/* ============================================================== tags === */

export const readTag = (id: string): Tag | null =>
  snap.tags.filter((t) => t.tagId === id)[0] || null;

/** The tags on an item, live rows rather than the ids stored on it. */
export const tagsOf = (i: WorkItem, all = snap.tags): Tag[] =>
  (i.tagIds || []).map((id) => all.filter((t) => t.tagId === id)[0]).filter(Boolean) as Tag[];

/** A member's own tags, archived ones last and only if asked for. */
export const tagsOwnedBy = (memberId: string, withArchived = false): Tag[] =>
  snap.tags.filter((t) => t.ownerId === memberId && (withArchived || !t.archivedAt));

/** Cross-member views group by SLUG, never by tagId: otherwise a team board
 *  fragments into one column per person per tag and is useless at five people. */
export function tagSlugs(items: WorkItem[]): { slug: string; label: string; n: number }[] {
  const by: Record<string, { slug: string; label: string; n: number }> = {};
  items.forEach((i) => tagsOf(i).forEach((t) => {
    if (!by[t.slug]) by[t.slug] = { slug: t.slug, label: t.label, n: 0 };
    by[t.slug].n += 1;
  }));
  return Object.keys(by).sort().map((k) => by[k]);
}
export const hasSlug = (i: WorkItem, slug: string) => tagsOf(i).some((t) => t.slug === slug);

/* ============================================================= leave === */

export const leaveFor = (memberId: string): LeaveRequest[] =>
  snap.leave.filter((l) => l.memberId === memberId)
    .slice().sort((a, b) => a.fromDate.localeCompare(b.fromDate));

/** Approved leave covering a date. It suppresses a derived absence; it never
 *  writes an attendance row. */
export function onLeave(memberId: string, date: string): LeaveRequest | null {
  return snap.leave.filter((l) => l.memberId === memberId && l.state === "approved"
    && date >= l.fromDate && date <= l.toDate)[0] || null;
}
export const leaveOn = (date: string, ids: string[]): LeaveRequest[] =>
  snap.leave.filter((l) => l.state === "approved" && ids.indexOf(l.memberId) >= 0
    && date >= l.fromDate && date <= l.toDate);
export const pendingLeave = (scope: Scope): LeaveRequest[] => {
  const ids = membersInScope(scope).map((m) => m.memberId);
  return snap.leave.filter((l) => l.state === "requested" && ids.indexOf(l.memberId) >= 0);
};

/* ====================================================== documents === */

export const agreementsFor = (memberId: string): Agreement[] =>
  snap.agreements.filter((a) => a.memberId === memberId)
    .slice().sort((a, b) => (b.sentAt || "").localeCompare(a.sentAt || ""));

export const resourcesFor = (memberId: string): Resource[] =>
  snap.resources.filter((r) => r.memberId === memberId)
    .slice().sort((a, b) => a.kind.localeCompare(b.kind));

/** Which of the required documents this member has not handed over. Derived
 *  from the vocabulary, so the answer changes with the list and not with a
 *  constant somebody has to remember to edit. */
export const missingDocs = (memberId: string): string[] => {
  const have = resourcesFor(memberId).map((r) => r.kind);
  return REQUIRED_DOCS.filter((k) => have.indexOf(k) < 0);
};

/** An agreement that was sent, never opened, and is running out of time. It is
 *  the only thing on this list that is waiting on a human. */
export const staleAgreements = (memberId: string, today = TODAY): Agreement[] =>
  agreementsFor(memberId).filter((a) => a.state === "sent" && !!a.expiresAt && (a.expiresAt as string) >= today);

/* ============================================================== pay === */

/** TEAM READS PAY AND NEVER WRITES IT. Every number below belongs to Finance;
 *  this module shows it and links there for anything that changes it. */
export const payFor = (memberId: string): Pay | null =>
  (payDoc.pay as Pay[]).filter((p) => p.memberId === memberId)[0] || null;

export const incentiveTotal = (p: Pay | null, state?: string): number =>
  (p ? p.incentives : []).filter((i) => !state || i.state === state)
    .reduce((a, i) => a + i.amount, 0);

/* ========================================================== calendar === */

/** How long an item occupies the grid. A task of a week or less is drawn on
 *  every day it spans — that is a schedule. Anything longer, and every
 *  milestone and target, is drawn twice: the day it starts and the day it is
 *  due. A quarter-long target printed on ninety-two days is wallpaper, and it
 *  buries the day's actual work under "+4 more". */
export const CAL_SPAN_DAYS = 7;
export type CalEdge = "" | "starts" | "due";
export interface CalEvent { item: WorkItem; edge: CalEdge }

export function eventsOn(date: string, rows: WorkItem[]): CalEvent[] {
  const out: CalEvent[] = [];
  rows.forEach((i) => {
    const a = i.startDate || i.dueDate, b = i.dueDate || i.startDate;
    if (!a || !b) return;
    const days = Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY) + 1;
    if (i.kind === "task" && days <= CAL_SPAN_DAYS) {
      if (date >= a && date <= b) out.push({ item: i, edge: "" });
    } else if (date === a && date === b) out.push({ item: i, edge: "due" });
    else if (date === a) out.push({ item: i, edge: "starts" });
    else if (date === b) out.push({ item: i, edge: "due" });
  });
  return out;
}

/** Six Monday-first weeks covering a month, or one week around a date. */
export function gridDays(anchor: string, mode: "month" | "week"): string[] {
  const d = new Date(anchor);
  let start: string;
  if (mode === "week") start = addDays(anchor, -((d.getDay() + 6) % 7));
  else {
    const first = anchor.slice(0, 8) + "01";
    start = addDays(first, -((new Date(first).getDay() + 6) % 7));
  }
  const n = mode === "week" ? 7 : 42;
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(addDays(start, i));
  return out;
}

/* ========================================================== timeline === */

export interface Lane { item: WorkItem | null; sub: boolean; tasks: WorkItem[] }

/** Target ▸ milestone, with each lane's own tasks under it, and a last lane for
 *  the tasks that hang off nothing. Lanes are the WORK, never the worker: a
 *  lane per person is a productivity chart this module has no estimate field to
 *  justify, and member load already has the Assignee axis and §3.13. */
export function lanesOf(rows: WorkItem[]): Lane[] {
  const kidsOf = (id: string | null) =>
    rows.filter((i) => i.kind === "task" && (id ? i.parentId === id : !i.parentId));
  const lanes: Lane[] = [];
  rows.filter((i) => i.kind === "target").forEach((t) => {
    lanes.push({ item: t, sub: false, tasks: kidsOf(t.itemId) });
    rows.filter((m) => m.kind === "milestone" && m.parentId === t.itemId)
      .forEach((m) => lanes.push({ item: m, sub: true, tasks: kidsOf(m.itemId) }));
  });
  rows.filter((m) => m.kind === "milestone"
    && (!m.parentId || !rows.some((x) => x.itemId === m.parentId)))
    .forEach((m) => lanes.push({ item: m, sub: false, tasks: kidsOf(m.itemId) }));
  lanes.push({ item: null, sub: false, tasks: kidsOf(null) });
  return lanes;
}

export interface WorkFilter {
  member?: string; kind?: string; status?: string; priority?: string;
  due?: string; q?: string; parent?: string; tag?: string;
}

export function workRows(f: WorkFilter, scope: Scope): WorkItem[] {
  const ids = membersInScope(scope).map((m) => m.memberId);
  let rows = snap.items.filter((i) => ids.indexOf(i.assigneeId) >= 0);
  if (f.member) rows = rows.filter((i) => i.assigneeId === f.member);
  if (f.kind) rows = rows.filter((i) => i.kind === f.kind);
  if (f.status) rows = rows.filter((i) => stageOf(i) === f.status);
  if (f.tag) rows = rows.filter((i) => hasSlug(i, f.tag as string));
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
  total: number; planned: number; inProgress: number; waiting: number;
  completed: number; cancelled: number; delayed: number;
}

/** Counted by STAGE, not by stored status, so the strip and the columns agree:
 *  a late card is in Delay and is not also counted under In progress. */
export function workTotals(rows: WorkItem[]): WorkTotals {
  const t: WorkTotals = { total: rows.length, planned: 0, inProgress: 0, waiting: 0, completed: 0, cancelled: 0, delayed: 0 };
  rows.forEach((i) => {
    const st = stageOf(i);
    if (st === "planned") t.planned++;
    if (st === "in_progress") t.inProgress++;
    if (st === "delayed") t.delayed++;
    if (st === "completed") t.completed++;
    if (st === "cancelled") t.cancelled++;
    if (blockerOf(i)) t.waiting++;
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
  waiting: number;
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
        state: stateOf(day, m, at, date),
        worked: workedOf(day, m, at),
        plan: planFor(m.memberId, date),
        report: reportFor(m.memberId, date),
        eodDue: eodDue(date, m, at),
        items,
        doing: items.filter((i) => i.status === "in_progress")[0] || null,
        done: dueToday.filter((i) => i.status === "completed").length,
        planned: dueToday.length,
        delayed: items.filter((i) => isDelayed(i)).length,
        waiting: items.filter((i) => !!blockerOf(i)).length,
      };
    });
}

export interface Attention {
  noPlan: ReviewRow[];
  noEod: ReviewRow[];
  delayed: WorkItem[];
  waiting: WorkItem[];
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
    waiting: uniq(items.filter((i) => !!blockerOf(i))),
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
  const needsReason = row.requiresReason || to === "cancelled";
  if (needsReason && !(reason || "").trim())
    return err("reason_required", "This change needs a reason.");
  i.status = to;
  i.rowVersion += 1;
  if (to === "completed") i.completedAt = new Date(now()).toISOString();
  if (to === "cancelled") { i.cancelledReason = reason; i.cancelledAt = new Date(now()).toISOString(); }
  if (to === "in_progress") i.completedAt = null;
  snap.items = items;
  emit();
  return ok(i);
}

/** Waiting on another item. A field with a reason, not a stage — the stage
 *  keeps saying where the work is, and this says who it is stuck behind. */
export function setBlockedBy(itemId: string, blockerId: string | null, reason?: string): Result<WorkItem> {
  const items = snap.items.slice();
  const i = items.filter((x) => x.itemId === itemId)[0];
  if (!i) return err("item_not_found", "No such work item.");
  if (blockerId) {
    if (blockerId === itemId) return err("self_block", "An item cannot wait on itself.");
    const b = items.filter((x) => x.itemId === blockerId)[0];
    if (!b) return err("blocker_not_found", "No such item to wait on.");
    if (!(reason || "").trim()) return err("reason_required", "Say what it is waiting for.");
    i.blockedByItemId = blockerId;
    i.blockedReason = reason;
    i.blockedAt = new Date(now()).toISOString();
  } else {
    i.blockedByItemId = null;
    delete i.blockedReason;
    delete i.blockedAt;
  }
  i.rowVersion += 1;
  snap.items = items;
  emit();
  return ok(i);
}

/** A tag is born here and nowhere else — one keystroke from the picker. A
 *  member may only tag with their own tags, which is what (ownerId, slug)
 *  identity means in practice. */
export function createTag(ownerId: string, label: string): Result<Tag> {
  const clean = label.trim();
  if (!clean) return err("tag_empty", "A tag needs a name.");
  const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const dup = snap.tags.filter((t) => t.ownerId === ownerId && t.slug === slug && !t.archivedAt)[0];
  if (dup) return ok(dup);
  const t: Tag = {
    tagId: nextId("TG"), ownerId, slug, label: clean, colourToken: "",
    createdAt: new Date(now()).toISOString(), archivedAt: null,
  };
  snap.tags = snap.tags.concat([t]);
  emit();
  return ok(t);
}

export function tagItem(itemId: string, tagId: string, on: boolean): Result<WorkItem> {
  const items = snap.items.slice();
  const i = items.filter((x) => x.itemId === itemId)[0];
  if (!i) return err("item_not_found", "No such work item.");
  const have = i.tagIds || [];
  i.tagIds = on ? (have.indexOf(tagId) < 0 ? have.concat([tagId]) : have)
                : have.filter((t) => t !== tagId);
  i.rowVersion += 1;
  snap.items = items;
  emit();
  return ok(i);
}

export function archiveTag(tagId: string): Result<Tag> {
  const tags = snap.tags.slice();
  const t = tags.filter((x) => x.tagId === tagId)[0];
  if (!t) return err("tag_not_found", "No such tag.");
  t.archivedAt = new Date(now()).toISOString();
  snap.tags = tags;
  emit();
  return ok(t);
}

/* --------------------------------------------------------- documents --- */

/** Sending FREEZES the document. A template edit after this makes a new
 *  version; it never changes what somebody already signed. */
export function sendAgreement(memberId: string, kind: string, title: string): Result<Agreement> {
  if (!title.trim()) return err("validation_failed", "A title is required.");
  if (!readMember(memberId)) return err("member_not_found", "No such member.");
  const a: Agreement = {
    agreementId: nextId("AG"), memberId, kind, title: title.trim(), version: 1,
    state: "sent", sentAt: new Date(now()).toISOString(), sentById: meId(),
    viewedAt: null, signedAt: null, signedName: null, signerIp: null,
    expiresAt: addDays(TODAY, 7), token: "tok_" + nextId("t").toLowerCase(),
    fileName: title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".pdf",
  };
  snap.agreements = snap.agreements.concat([a]);
  emit();
  return ok(a);
}

/** The signature is the member's, so the name they type is stored beside the
 *  time and the address it came from. A signed agreement is never editable. */
export function signAgreement(agreementId: string, name: string): Result<Agreement> {
  const list = snap.agreements.slice();
  const a = list.filter((x) => x.agreementId === agreementId)[0];
  if (!a) return err("agreement_not_found", "No such agreement.");
  if (a.state === "signed") return err("already_signed", "It is already signed.");
  if (a.state === "revoked") return err("revoked", "That link was revoked.");
  if (!name.trim() || name.trim().length < 2) return err("name_required", "Type your full name to sign.");
  a.state = "signed";
  a.signedName = name.trim();
  a.signedAt = new Date(now()).toISOString();
  a.signerIp = "127.0.0.1";
  a.expiresAt = null;
  snap.agreements = list;
  emit();
  return ok(a);
}

export function revokeAgreement(agreementId: string): Result<Agreement> {
  const list = snap.agreements.slice();
  const a = list.filter((x) => x.agreementId === agreementId)[0];
  if (!a) return err("agreement_not_found", "No such agreement.");
  if (a.state === "signed") return err("already_signed", "A signed agreement cannot be revoked.");
  a.state = "revoked";
  a.expiresAt = null;
  snap.agreements = list;
  emit();
  return ok(a);
}

export function addResource(memberId: string, kind: string, label: string): Result<Resource> {
  if (!label.trim()) return err("validation_failed", "A label is required.");
  const r: Resource = {
    resourceId: nextId("RS"), memberId, kind, label: label.trim(),
    fileName: label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".pdf",
    sizeKb: 240, uploadedAt: new Date(now()).toISOString(), uploadedById: memberId,
    verifiedById: null, verifiedAt: null,
  };
  snap.resources = snap.resources.concat([r]);
  emit();
  return ok(r);
}

/** The member may delete what they handed over. That is the half that travels
 *  member → company, and it is theirs. */
export function deleteResource(resourceId: string): Result<string> {
  const before = snap.resources.length;
  snap.resources = snap.resources.filter((r) => r.resourceId !== resourceId);
  if (snap.resources.length === before) return err("resource_not_found", "No such document.");
  emit();
  return ok(resourceId);
}

export function verifyResource(resourceId: string): Result<Resource> {
  const list = snap.resources.slice();
  const r = list.filter((x) => x.resourceId === resourceId)[0];
  if (!r) return err("resource_not_found", "No such document.");
  r.verifiedById = meId();
  r.verifiedAt = new Date(now()).toISOString();
  snap.resources = list;
  emit();
  return ok(r);
}

/* ------------------------------------------------------------- leave --- */

export function requestLeave(memberId: string, input: {
  fromDate: string; toDate: string; kind: string; reason: string;
}): Result<LeaveRequest> {
  if (!input.fromDate || !input.toDate) return err("dates_required", "Both dates are needed.");
  if (input.toDate < input.fromDate) return err("bad_range", "The last day is before the first.");
  if (!input.reason.trim()) return err("reason_required", "A leave request needs a reason.");
  const l: LeaveRequest = {
    leaveId: nextId("LV"), memberId, fromDate: input.fromDate, toDate: input.toDate,
    kind: input.kind, reason: input.reason.trim(), state: "requested",
    decidedById: null, decidedAt: null, decisionNote: null,
    requestedAt: new Date(now()).toISOString(),
  };
  snap.leave = snap.leave.concat([l]);
  emit();
  return ok(l);
}

/** A decision needs a decider. Rejecting also needs a sentence — a refusal
 *  nobody explained is one the member has to come and ask about. */
export function decideLeave(leaveId: string, state: LeaveState, byId: string, note?: string): Result<LeaveRequest> {
  const list = snap.leave.slice();
  const l = list.filter((x) => x.leaveId === leaveId)[0];
  if (!l) return err("leave_not_found", "No such request.");
  if (l.state !== "requested") return err("already_decided", "That request is already " + l.state + ".");
  if (state === "rejected" && !(note || "").trim())
    return err("reason_required", "Say why it is refused.");
  l.state = state;
  l.decidedById = state === "withdrawn" ? null : byId;
  l.decidedAt = new Date(now()).toISOString();
  l.decisionNote = (note || "").trim() || null;
  snap.leave = list;
  emit();
  return ok(l);
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
export function useTags(): Tag[] { useVersion(); return snap.tags; }
export function useLeave(): LeaveRequest[] { useVersion(); return snap.leave; }
export function useAgreements(): Agreement[] { useVersion(); return snap.agreements; }
export function useResources(): Resource[] { useVersion(); return snap.resources; }
export function useItems(): WorkItem[] { useVersion(); return snap.items; }
export function useReview(date: string, scope: Scope): ReviewRow[] { useVersion(); return reviewRows(date, scope); }
export function useMyDay(date = TODAY): { day: AttendanceDay | null; state: AttendanceState; worked: number | null; breakMins: number } {
  useVersion();
  const m = readMember(meId());
  const day = dayFor(meId(), date);
  return { day, state: stateOf(day, m), worked: workedOf(day, m), breakMins: breakOf(day) };
}
export function usePlan(memberId: string, date = TODAY): DailyPlan | null { useVersion(); return planFor(memberId, date); }
export function useReport(memberId: string, date = TODAY): DailyReport | null { useVersion(); return reportFor(memberId, date); }
