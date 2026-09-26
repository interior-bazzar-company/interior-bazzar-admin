/* =============================================================================
   Team — the data module for the operational half.
   -----------------------------------------------------------------------------
   THE ONLY FILE IN THIS MODULE THAT KNOWS WHERE ITS OWN RECORDS COME FROM.
   Every view imports from here; no view imports JSON and no view fetches.

   ON THE BACKEND (2026-09-15). `bootTeam()` reads, once per page load and again
   after every write: the roster (`users/` + `attendance/settings/`), attendance
   days, work items and tags, daily plans and reports, leave, agreements,
   incentives, the value lists, and the server clock. Each row is mapped into
   the shapes below, so every derivation in this file is unchanged. A list the
   viewer may not read in full (`member=all` refused) falls back to their own.

   NOTHING IS LOCAL ANY MORE (2026-09-16). Item↔item links, task checklists and
   the "waiting on" reason were kept per item in this tab because the backend had
   no column; they live on `WorkItem.extras` now and every one of the three is a
   server write like the rest. An EDGE IS STORED ON ONE END ONLY — the task it
   points from — and the far end is read by scanning the items this store
   already holds, printing the relation from that side with the inverse label
   the vocabulary row carries in `hint`.

   MEMBER DOCUMENTS: the row AND the file. The bytes go straight to our bucket
   with a presigned PUT and the server keeps the key as a PRIVATE attachment;
   what comes back is a signed, expiring read. No identity document is ever on a
   URL anybody holding it can open for ever.

   AGREEMENT TEMPLATES ARE ROWS TOO (`agreements/templates/`). A copy records the
   `templateKey` it was rendered from, so provenance survives a rename — which
   matching back on kind + title did not.

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

   `NOW` is the server's clock (`GET engine/server-time/`), read as a skew so
   the client never trusts `Date`; "today" is that instant in Asia/Kolkata.
   ============================================================================= */
import { useSyncExternalStore } from "react";
import AdminOpsService, { call } from "../../../api/modules/adminOps";
import type {
  AdminUserRow, AgreementRow, AttendanceDayRow, DailyPlanRow, DailyReportRow, IncentiveRow, LeaveRow,
  MemberDocumentRow, VocabItem, WorkItemRow, WorkSettingsRow, WorkTagRow,
} from "../../../api/modules/adminOps";
import { CommonService } from "../../../api/modules/common";
import { AppExceptions, errMessage } from "../../../api/apiService";
import type { ApiResponseType } from "../../../types/reqResType";
import vocabDoc from "../../../content/team/vocabularies.json";
import { can, getSession } from "../../auth/session";

/* ============================================================== types === */

export type MemberStatus = "active" | "inactive" | "suspended";
export type AttendanceState =
  "not_started" | "working" | "on_break" | "ended" | "unclosed" | "absent" | "on_leave";
export type WorkKind = "task" | "milestone" | "target";
/** FOUR stored values. `blocked` is not among them: waiting on someone is a
 *  relationship, not a stage, and it lives on `blockedByItemId`. */
export type WorkStatus = "planned" | "in_progress" | "blocked" | "completed" | "cancelled";
/** The five stages a person sees. `delayed` is derived and takes precedence,
 *  so an item is in exactly one of them. */
export type WorkStage = WorkStatus | "delayed";
export type LeaveState = "requested" | "approved" | "rejected" | "withdrawn" | "escalated";
/** FOUR, AND `urgent` IS NEW. It sits above `high` rather than replacing it:
 *  a scale whose top value is also its common value has no top value, and
 *  every existing item keeps the priority it was given. `medium` reads as
 *  "Normal" now — it was always the default and never the middle of anything
 *  anybody thought about. */
export type Priority = "urgent" | "high" | "medium" | "low";
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

/** One line of a task's checklist. `done` is stored — unlike almost everything
 *  else derived in this module — because a tick is an act somebody performed
 *  and there is nothing to derive it from. */
export interface CheckLine {
  lineId: string;
  text: string;
  done: boolean;
}

/** A named link out of the panel. */
export interface ResourceLink {
  linkId: string;
  label: string;
  url: string;
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
  attachments?: Attachment[];
  /** THE WORK INSIDE THE WORK. A task's description says what it is; the
   *  checklist says what is left of it. It is what makes a task's progress a
   *  number rather than a coin-flip between 0 and 100 — see `progressOf`. */
  checklist?: CheckLine[];
  /** The soft edges OUT of this item. Both directions are derived from these
   *  across every item the store holds — see `linksOf`. */
  itemLinks?: { itemId: string; relation: LinkRelation }[];
  /** Where the work actually lives: the brief, the folder, the board. A URL
   *  with a name on it, because a bare link in a list of six is a link nobody
   *  clicks. Distinct from `attachments`, which are files this panel holds,
   *  and from item↔item links, which are relationships between records. */
  links?: ResourceLink[];
  rowVersion: number;
  createdAt: string;
}

export type AgreementState = "draft" | "sent" | "viewed" | "signed" | "revoked" | "expired";

export interface Agreement {
  agreementId: string;
  memberId: string;
  kind: string;
  title: string;
  /** The template it was made from, if it was made from one. Null for the
   *  agreements that predate templates — the link is provenance, never a read:
   *  `body` below is the document, and the template may have moved on. */
  templateId: string | null;
  /** THE DOCUMENT ITSELF, frozen at send. A signature over a body that can
   *  still change is not a signature — this is the whole reason a template edit
   *  makes a new version rather than rewriting what is out there. */
  body: string;
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

export interface MemberDocument {
  documentId: string;
  memberId: string;
  kind: string;
  label: string;
  fileName: string;
  sizeKb: number;
  /** A SIGNED, EXPIRING read of a private object, or null when the row carries
   *  no file. Never a bare URL: these are identity papers. */
  file: { fileName: string; mimeType: string; sizeKb: number; url: string } | null;
  uploadedAt: string;
  uploadedById: string;
  verifiedById: string | null;
  verifiedAt: string | null;
}

export interface Incentive {
  incentiveId: string; month: string;
  /** The work item it was earned against — the join in both directions. Null
   *  where the basis is not a tracked item, which the screen has to survive. */
  workItemId: string | null;
  /** A readable label for that basis, so a deleted item still prints. */
  basis: string;
  amount: number; state: string;
}
export interface Payslip {
  month: string; net: number; base: number;
  /** The incentive PAID with this slip, if any. It is repeated from the
   *  incentive ledger on purpose: a payslip that quietly omitted it would send
   *  somebody to Finance to ask why the two numbers differ. */
  incentive: number | null;
  note: string | null;
  paidAt: string;
}
export interface Pay {
  memberId: string;
  annualCtc: number;
  currency: string;
  effectiveFrom: string;
  /** The account the money leaves from. Finance's record; Team only names it so
   *  a member can check it is the right one without asking. */
  account: { bank: string; ref: string } | null;
  payslips: Payslip[];
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

/** A link hung on an item — a brief, a sheet, a thread. Stored as an address
 *  and a name, never as markup. */
export interface Attachment { url: string; label: string }

/** A `work_link_relation` key. A string, not a union: the list is the server's
 *  and a row added there must not need a type edit here. */
export type LinkRelation = string;

/** A soft edge between two items. It never touches rollup and gates nothing:
 *  `parentId` and `blockedByItemId` are the two strong links, and an edge here
 *  may not restate either of them.
 *
 *  STORED ON ONE END. `linkId` is not a record id — there is no edge row — it
 *  is the pair, `from:to`, which is what identifies an edge and what removing
 *  one needs. */
export interface WorkLink {
  linkId: string;
  fromItemId: string;
  toItemId: string;
  relation: LinkRelation;
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

export const DAY = 86400000;

/* THE SERVER'S CLOCK, as a skew over the browser's. Until the server answers
   the skew is zero; `bootTeam` sets it. `NOW` and `TODAY` are live bindings, so
   every importer reads the corrected value. */
const istDate = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(ms));
let SKEW = 0;
export const now = () => Date.now() + SKEW;
export const stamp = () => new Date(now()).toISOString();
export let NOW = now();

/** The business date, IST, as a plain YYYY-MM-DD — never a UTC slice of an
 *  instant, which puts a Friday evening's work on Saturday. */
export let TODAY = istDate(NOW);
function setClock(epochMs: number) {
  SKEW = epochMs - Date.now();
  NOW = now();
  TODAY = istDate(NOW);
}
/** A day from a URL, clamped to today. The picker's `max` stops the mouse, not
 *  a hand-edited address, and a future day must never be asked who was absent. */
export const clampDay = (d?: string): string => (d && d <= TODAY ? d : TODAY);

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
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Parsed field by field, not through Date(string), so a date-only value is
 *  never nudged a day by the UTC-midnight rule. Same reason `ui/format.ts`
 *  does it this way. */
export const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  const p = d.slice(0, 10).split("-");
  return Number(p[2]) + " " + MONTHS[Number(p[1]) - 1] + " " + p[0];
};
/** "September 2026", or "Sep 2026" short. A month heading was being cut out of
 *  a full date with a slice, which is how the calendar came to say "ep 2026". */
export const fmtMonth = (d: string, long?: boolean) =>
  (long ? MONTHS_LONG : MONTHS)[Number(d.slice(5, 7)) - 1] + " " + d.slice(0, 4);

/** The first of the month `n` months away. Field arithmetic, never
 *  `toISOString()` on a local midnight — that is +05:30 behind and walks the
 *  anchor back a day on every press. */
export const monthStep = (d: string, n: number) => {
  const dt = new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1 + n, 1);
  return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-01";
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
/** The weekly off. SUNDAY ONLY — the backend's rule (attendance/days marks an
 *  unopened Sunday `weekly_off`; Saturday is a working day). */
export const isWeekend = (d: string) => fmtDayName(d) === "Sun";

/* ======================================================== vocabulary === */

/* The value lists. `attendanceStates` and the derived `delayed` stage have no
   server list and stay in vocabularies.json; every other list, link relations
   included, is filled from `GET vocab/<name>/` by bootTeam. The exported maps
   and arrays are filled IN PLACE, so importers holding them see the rows. */
type VocabRow = { key: string; label: string; tone: string; hint?: string; required?: boolean };
export const VOCAB = {
  ...vocabDoc,
  leaveKinds: [] as VocabRow[],
  documentKinds: [] as VocabRow[],
  tagTones: [] as VocabRow[],
};

type ToneRow = { key: string; label: string; tone: string };
const toneMap = (rows: ToneRow[]) => {
  const o: Record<string, ToneRow> = {};
  rows.forEach((r) => { o[r.key] = r; });
  return o;
};
const refill = <T,>(target: Record<string, T>, rows: (T & { key: string })[]) => {
  Object.keys(target).forEach((k) => { delete target[k]; });
  rows.forEach((r) => { target[r.key] = r; });
};
export const ATT_STATE = toneMap(vocabDoc.attendanceStates as ToneRow[]);
/** All five stages, the derived one included — the four stored ones from the
 *  server, `delayed` from vocabularies.json. */
export const WORK_STATUS = toneMap(vocabDoc.workStatuses as ToneRow[]);
export const LEAVE_STATE: Record<string, ToneRow> = {};
export const LEAVE_KIND: Record<string, ToneRow> = {};
export const AGREEMENT_KIND: Record<string, ToneRow> = {};
export const AGREEMENT_STATE: Record<string, ToneRow> = {};
export const DOCUMENT_KIND: Record<string, ToneRow> = {};
/** The documents a member is expected to have handed over. Vocabulary, not a
 *  constant here: adding one server-side must not need a code edit. */
export const REQUIRED_DOCS: string[] = [];
/** `work_link_relation`, in order, from the server. The INVERSE label rides in
 *  each row's `hint` — which is what lets one stored edge be read from both
 *  ends. A row added there appears in the picker without a deploy. */
export const LINK_RELATIONS: VocabRow[] = [];
/** The label read from the side you are standing on: "Follows" out, "Followed
 *  by" back. Direction is presentation; the stored edge does not flip. */
export const linkLabelOf = (key: string, outward: boolean): string => {
  const row = LINK_RELATIONS.filter((r) => r.key === key)[0];
  if (!row) return key;
  return outward ? row.label : (row.hint || row.label);
};
/** Soft cap on a member's active tags — warned past, never blocked (TM-OD-22). */
export const TAG_CAP = 20;
/** How long a sent agreement stays signable. The dialog says seven days, so the
 *  send says seven days: one number, not two that drift apart. */
export const AGREEMENT_DAYS = 7;
export const PRIORITY: Record<string, ToneRow & { rank: number }> = {};
/** THE SCALE IN ORDER, loudest first — the server list's displayOrder, so the
 *  next value added there appears everywhere at once. */
export const PRIORITY_SCALE: Priority[] = [];
export const KIND: Record<string, ToneRow> = {};
/** `work-transitions`, flat server rows grouped by where they start. */
const TRANSITIONS: { from: string; to: string; requiresReason: boolean; label: string }[] = [];

function applyVocab(lists: Record<string, VocabItem[]>) {
  const rows = (name: string) => (lists[name] || []).filter((r) => r.isActive !== false)
    .slice().sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
    .map((r) => ({ ...r, tone: r.tone || "" })) as (VocabRow & VocabItem)[];
  if (lists["leave-kinds"]) { VOCAB.leaveKinds = rows("leave-kinds"); refill(LEAVE_KIND, VOCAB.leaveKinds); }
  if (lists["leave-states"]) refill(LEAVE_STATE, rows("leave-states"));
  if (lists["agreement-kinds"]) refill(AGREEMENT_KIND, rows("agreement-kinds"));
  if (lists["agreement-states"]) refill(AGREEMENT_STATE, rows("agreement-states"));
  if (lists["document-kinds"]) {
    VOCAB.documentKinds = rows("document-kinds");
    refill(DOCUMENT_KIND, VOCAB.documentKinds);
    REQUIRED_DOCS.splice(0, REQUIRED_DOCS.length, ...VOCAB.documentKinds.filter((r) => r.required).map((r) => r.key));
  }
  if (lists["work-tag-tones"]) VOCAB.tagTones = rows("work-tag-tones");
  if (lists["work-link-relations"]) LINK_RELATIONS.splice(0, LINK_RELATIONS.length, ...rows("work-link-relations"));
  if (lists["work-kinds"]) refill(KIND, rows("work-kinds"));
  if (lists["work-priorities"]) {
    const ps = rows("work-priorities");
    refill(PRIORITY, ps.map((r, n) => ({ ...r, rank: n + 1 })));
    PRIORITY_SCALE.splice(0, PRIORITY_SCALE.length, ...ps.map((r) => r.key as Priority));
  }
  if (lists["work-statuses"]) rows("work-statuses").forEach((r) => { WORK_STATUS[r.key] = r; });
  if (lists["work-transitions"]) {
    const ts = (lists["work-transitions"] as unknown as { from: string; to: string; requiresReason?: boolean; label?: string; isActive?: boolean }[])
      .filter((t) => t.isActive !== false);
    TRANSITIONS.splice(0, TRANSITIONS.length, ...ts.map((t) => ({
      from: t.from, to: t.to, requiresReason: !!t.requiresReason, label: t.label || "" })));
  }
}

export const labelOf = (map: Record<string, ToneRow>, k: string) => (map[k] ? map[k].label : k);
export const toneOf = (map: Record<string, ToneRow>, k: string) => (map[k] ? map[k].tone : "");

/* ============================================================== state === */
/* One mutable snapshot for this browser tab. Every write replaces the arrays it
   touches and bumps `version`, which is what useSyncExternalStore subscribes
   to. Every array is filled by bootTeam; nothing in this store is a local
   stand-in any more (see the header). */

type Snapshot = {
  members: Member[];
  days: AttendanceDay[];
  items: WorkItem[];
  plans: DailyPlan[];
  reports: DailyReport[];
  tags: Tag[];
  leave: LeaveRequest[];
  agreements: Agreement[];
  documents: MemberDocument[];
  /** Incentives from the server, one record per member. */
  pay: Pay[];
  version: number;
};

let snap: Snapshot = {
  members: [], days: [], items: [], plans: [], reports: [], tags: [], leave: [], agreements: [],
  documents: [],
  pay: [],
  version: 0,
};
const listeners = new Set<() => void>();
const emit = () => { snap = { ...snap, version: snap.version + 1 }; listeners.forEach((l) => l()); };
/* The first subscriber starts the load, so any face that reads this store —
   Team, Resources, Agreements, the Overview — gets live rows without asking. */
const subscribe = (fn: () => void) => { listeners.add(fn); void bootTeam(); return () => { listeners.delete(fn); }; };
const getVersion = () => snap.version;

/* ------------------------------------------------------------- the load --- */

const str = (id: number | string | null | undefined) => (id == null ? null : String(id));
const orNull = (v: string | null | undefined) => (v ? v : null);

function toMember(u: AdminUserRow, s: WorkSettingsRow | undefined): Member {
  const designation = (s && s.designation) || u.designation;
  const employment = (s && s.employmentType) || u.employmentType;
  const boss = s ? s.reportsTo : u.reportsTo;
  return {
    memberId: String(u.id),
    name: u.name || u.username,
    email: u.email || "",
    phone: u.phone || "",
    username: u.username,
    designation: designation ? designation.label : "",
    /* The panel's "department" is the member's rbac roles (team/d1). */
    department: (u.roles || []).map((r) => r.name).join(", "),
    employmentType: employment ? employment.key : "",
    joiningDate: (s && s.joiningDate) || "",
    reportsTo: boss ? String(boss.id) : null,
    workLocation: "",
    expectedHoursPerDay: s ? s.expectedHoursPerDay : 0,
    dayStartsAt: s ? s.dayStartsAt : "",
    graceMinutes: s ? s.graceMinutes : 0,
    autoCloseAt: s ? s.autoCloseAt : "",
    timezone: s ? s.timezone : "Asia/Kolkata",
    status: u.isActive === false ? "inactive" : "active",
    isFullAccess: !!u.isSuperAdmin,
    roles: (u.roles || []).map((r) => r.name),
    addedAt: u.addedAt || "",
    lastLogin: u.lastLogin || null,
  };
}

const toDay = (d: AttendanceDayRow): AttendanceDay => ({
  attendanceId: String(d.id),
  memberId: String(d.member.id),
  businessDate: d.businessDate,
  startedAt: d.startedAt as string,
  endedAt: d.endedAt,
  breaks: (d.breaks || []).map((b) => ({ startedAt: b.startedAt, endedAt: b.endedAt, minutes: b.minutes })),
  workedMinutes: d.workedMinutes,
  breakMinutes: d.breakMinutes,
  isLate: d.isLate,
  lateByMinutes: d.lateByMinutes,
  source: d.source && d.source.key === "corrected" ? "corrected" : "self",
  correctedBy: d.correctedBy ? String(d.correctedBy.id) : undefined,
  correctedAt: d.correctedAt || undefined,
  correctionReason: d.correctionNote || undefined,
});

function toItem(w: WorkItemRow): WorkItem {
  const id = String(w.id);
  return {
    itemId: id,
    kind: w.kind.key as WorkKind,
    title: w.title,
    description: w.description || null,
    assigneeId: String(w.assignee.id),
    createdById: w.createdBy ? String(w.createdBy.id) : "",
    parentId: str(w.parent),
    status: w.status.key as WorkStatus,
    priority: w.priority.key as Priority,
    startDate: w.startDate,
    dueDate: w.dueDate,
    completedAt: w.completedAt,
    expectedOutcome: null,
    blockedByItemId: str(w.blockedBy),
    blockedReason: w.blockedReason || undefined,
    cancelledReason: w.cancelledReason || undefined,
    cancelledAt: w.cancelledAt || undefined,
    targetValue: w.targetValue ?? undefined,
    targetUnit: w.targetUnit || undefined,
    /* The server keeps a target's progress as a share; the value is read back
       from it so `progressOf` and the "12 of 40" line agree with the server. */
    currentValue: w.kind.key === "target" && w.targetValue
      ? Math.round(((w.progress || 0) / 100) * w.targetValue) : undefined,
    tagIds: (w.tags || []).map((t) => String(t.id)),
    /* `lineId` here, `id` on the wire — the rename happens once, at this
       boundary, so no screen has to know both names. */
    checklist: (w.checklist || []).map((l) => ({ lineId: l.id, text: l.text, done: l.done })),
    itemLinks: (w.itemLinks || []).map((l) => ({ itemId: String(l.itemId), relation: l.relation })),
    links: (w.links || []).map((l, n) => ({ linkId: id + "-L" + n, label: l.label || l.url, url: l.url })),
    rowVersion: w.rowVersion,
    createdAt: w.createdAt || "",
  };
}

const toTag = (t: WorkTagRow): Tag => ({
  tagId: String(t.id), ownerId: String(t.owner.id), slug: t.slug, label: t.label,
  colourToken: t.tone ? t.tone.key : "slate", createdAt: t.createdAt, archivedAt: t.archivedAt,
});

const toPlan = (p: DailyPlanRow): DailyPlan => ({
  planId: String(p.id), memberId: String(p.member.id), businessDate: p.businessDate,
  expectedOutcome: orNull(p.expectedOutcome), blockers: orNull(p.blockers), notes: orNull(p.notes),
  submittedAt: p.submittedAt,
  lines: p.lines.map((l) => ({
    lineId: String(l.id), ordinal: l.ordinal + 1, title: l.title,
    priority: (l.priority ? l.priority.key : "medium") as Priority, workItemId: str(l.workItemId),
  })),
});

const toReport = (r: DailyReportRow): DailyReport => ({
  reportId: String(r.id), memberId: String(r.member.id), businessDate: r.businessDate,
  pendingWork: orNull(r.pendingWork), pendingReason: orNull(r.pendingReason), achievement: orNull(r.achievement),
  blockers: orNull(r.blockers), supportNeeded: orNull(r.supportNeeded), tomorrowPriority: orNull(r.tomorrowPriority),
  notes: orNull(r.notes), submittedAt: r.submittedAt,
  acknowledgedById: r.acknowledgedBy ? String(r.acknowledgedBy.id) : null, acknowledgedAt: r.acknowledgedAt,
  lines: r.lines.map((l) => ({
    lineId: String(l.id), workItemId: str(l.workItemId), title: l.title, done: l.done, targetDelta: l.targetDelta,
  })),
});

const toLeave = (l: LeaveRow): LeaveRequest => ({
  leaveId: String(l.id), memberId: String(l.member.id), fromDate: l.fromDate, toDate: l.toDate,
  kind: l.kind.key, reason: l.reason, state: l.state.key as LeaveState,
  decidedById: l.decidedBy ? String(l.decidedBy.id) : null, decidedAt: l.decidedAt,
  decisionNote: orNull(l.decisionNote), requestedAt: l.createdAt,
});

/* The body, the token and the signer's address come back too: every row the
   list returns is the reader's own or read with full access. */
const toAgreement = (a: AgreementRow): Agreement => ({
  agreementId: String(a.id), memberId: String(a.member.id), kind: a.kind.key, title: a.title,
  templateId: a.templateKey || null, body: a.body || "", version: a.version,
  state: a.state.key as AgreementState,
  sentAt: a.sentAt, sentById: a.sentBy ? String(a.sentBy.id) : null, viewedAt: a.viewedAt,
  signedAt: a.signedAt, signedName: orNull(a.signedName), signerIp: a.signerIp,
  expiresAt: a.expiresAt ? a.expiresAt.slice(0, 10) : null, token: a.token || "", fileName: "",
});

/** The row a member handed over, and its file: `file.url` is a signed read the
 *  server minted, valid for minutes, never the object's own address. */
const toDocument = (d: MemberDocumentRow): MemberDocument => ({
  documentId: String(d.id), memberId: String(d.member.id), kind: d.kind.key, label: d.label,
  fileName: d.fileName, sizeKb: d.sizeKb, file: d.file || null, uploadedAt: d.uploadedAt,
  uploadedById: d.uploadedBy ? String(d.uploadedBy.id) : "",
  verifiedById: d.verifiedBy ? String(d.verifiedBy.id) : null, verifiedAt: d.verifiedAt,
});

function toPay(rows: IncentiveRow[]): Pay[] {
  const by: Record<string, Pay> = {};
  rows.forEach((i) => {
    const id = String(i.member.id);
    if (!by[id]) by[id] = { memberId: id, annualCtc: 0, currency: "INR", effectiveFrom: "", account: null, payslips: [], incentives: [] };
    by[id].incentives.push({
      incentiveId: String(i.id), month: i.month, workItemId: i.workItem ? String(i.workItem.id) : null,
      basis: i.basis, amount: i.amountPaise / 100, state: i.state.key,
    });
  });
  return Object.keys(by).map((k) => by[k]);
}

/** Every page of a list endpoint. ponytail: sequential pages of the whole
 *  history; window by date if a list ever runs to many thousands. */
async function pages<R extends { total: number }, T>(page: (n: number) => Promise<R>, pick: (r: R) => T[]): Promise<T[]> {
  const out: T[] = [];
  for (let n = 1; ; n++) {
    const got = await page(n);
    const rows = pick(got) || [];
    out.push(...rows);
    if (!rows.length || out.length >= got.total) return out;
  }
}

/* ---------------------------------------------------------- load status --- */

/** How one read stands. A refusal (4xx, or a logical `response:false`) is a
 *  fact about the VIEWER; a 5xx or a dead network is a failure. Neither is an
 *  empty record, so neither may be drawn as one. `own` marks a wide read the
 *  server refused and answered with the viewer's own rows instead. */
export type LoadPart =
  | { state: "loading" }
  | { state: "ok"; own: boolean }
  | { state: "denied"; message: string }
  | { state: "error"; message: string };

const LOADED: LoadPart = { state: "ok", own: false };
const refused = (e: unknown) => e instanceof AppExceptions && e.code > 0 && e.code < 500;
export const loadFailure = (e: unknown): LoadPart =>
  (refused(e) ? { state: "denied", message: errMessage(e) } : { state: "error", message: errMessage(e) });

/** A read that holds only the viewer's own rows is "not in your access" on
 *  anybody else's page — never their empty record. */
export const scopedTo = (p: LoadPart, memberId?: string): LoadPart =>
  (p.state === "ok" && p.own && memberId && memberId !== meId() ? { state: "denied", message: "" } : p);

type Got<T> = [T, LoadPart];

/** Everyone's rows, or — when the server refuses the wide read — the viewer's
 *  own, or nothing. The rows are what they always were; the part says which. */
async function wide<T>(all: () => Promise<T[]>, own: () => Promise<T[]>): Promise<Got<T[]>> {
  try {
    return [await all(), LOADED];
  } catch (e) {
    try {
      const rows = await own();
      return [rows, refused(e) ? { state: "ok", own: true } : loadFailure(e)];
    } catch (e2) {
      return [[], loadFailure(refused(e) ? e2 : e)];
    }
  }
}

async function one<T>(p: Promise<T>, empty: T): Promise<Got<T>> {
  try { return [await p, LOADED]; } catch (e) { return [empty, loadFailure(e)]; }
}

/** The lists a page can ask about. Attendance days are not here: the one page
 *  that shows them reads its own window (liveMember.ts). */
export type TeamList = "members" | "items" | "tags" | "plans" | "reports" | "leave" | "agreements"
  | "documents" | "incentives" | "vocab";
const TEAM_LISTS: TeamList[] = ["members", "items", "tags", "plans", "reports", "leave", "agreements",
  "documents", "incentives", "vocab"];
const allParts = (p: LoadPart) => Object.fromEntries(TEAM_LISTS.map((k) => [k, p])) as Record<TeamList, LoadPart>;
let parts = allParts({ state: "loading" });

/** Loading before a failure before a refusal: while anything is still coming
 *  the page waits, and a failure is offered a retry before a refusal is stated. */
export function loadOf(lists: TeamList[], memberId?: string): LoadPart {
  const got = lists.map((k) => scopedTo(parts[k], memberId));
  return got.filter((p) => p.state === "loading")[0]
    || got.filter((p) => p.state === "error")[0]
    || got.filter((p) => p.state === "denied")[0]
    || LOADED;
}

/** Try again: every list reads as loading until the re-read lands. A background
 *  re-read after a write does NOT do this — the page keeps what it shows. */
export function retryTeam(): Promise<void> {
  parts = allParts({ state: "loading" });
  emit();
  return bootTeam(true);
}

const VOCAB_LISTS = ["leave-kinds", "leave-states", "agreement-kinds", "agreement-states", "document-kinds",
  "work-tag-tones", "work-kinds", "work-priorities", "work-statuses", "work-transitions",
  "work-link-relations"];

export type TeamBoot = "idle" | "loading" | "ready" | "error";
let bootState: TeamBoot = "idle";
let booting: Promise<void> | null = null;
export const teamBootState = () => bootState;

async function load(current: () => boolean): Promise<void> {
  const me = getSession()?.user;
  const t = await call(AdminOpsService.serverTime()).catch(() => null);
  if (t) setClock(t.epochMs);

  const [vocabGot, usersGot, settingsGot, [days, daysPart], itemsGot, tagsGot, plansGot, reportsGot, leaveGot,
    agreementsGot, documentsGot, incentivesGot] = await Promise.all([
    Promise.all(VOCAB_LISTS.map((n) => one(call(AdminOpsService.vocab(n)).then((r) => [n, r.items] as const), null))),
    one(call(AdminOpsService.users()), null),
    one(call(AdminOpsService.attendanceSettings()).then((r) => r.settings), [] as WorkSettingsRow[]),
    wide((() => pages((n) => call(AdminOpsService.attendanceDays({ member: "all", pageNo: n, pageSize: 1000 })), (r) => r.days)),
      () => pages((n) => call(AdminOpsService.attendanceDays({ pageNo: n, pageSize: 1000 })), (r) => r.days)),
    wide(() => pages((n) => call(AdminOpsService.work({ assignee: "all", pageNo: n, pageSize: 500 })), (r) => r.items),
      () => pages((n) => call(AdminOpsService.work({ pageNo: n, pageSize: 500 })), (r) => r.items)),
    wide(() => call(AdminOpsService.workTags({ owner: "all", includeArchived: true })).then((r) => r.tags),
      () => call(AdminOpsService.workTags({ includeArchived: true })).then((r) => r.tags)),
    wide(() => pages((n) => call(AdminOpsService.dailyPlans({ member: "all", pageNo: n, pageSize: 1000 })), (r) => r.plans),
      () => pages((n) => call(AdminOpsService.dailyPlans({ pageNo: n, pageSize: 1000 })), (r) => r.plans)),
    wide(() => pages((n) => call(AdminOpsService.dailyReports({ member: "all", pageNo: n, pageSize: 1000 })), (r) => r.reports),
      () => pages((n) => call(AdminOpsService.dailyReports({ pageNo: n, pageSize: 1000 })), (r) => r.reports)),
    wide(() => pages((n) => call(AdminOpsService.leave({ member: "all", pageNo: n, pageSize: 1000 })), (r) => r.leave),
      () => pages((n) => call(AdminOpsService.leave({ pageNo: n, pageSize: 1000 })), (r) => r.leave)),
    wide(() => pages((n) => call(AdminOpsService.agreements({ member: "all", pageNo: n, pageSize: 1000 })), (r) => r.agreements),
      () => pages((n) => call(AdminOpsService.agreements({ pageNo: n, pageSize: 1000 })), (r) => r.agreements)),
    wide(() => call(AdminOpsService.memberDocuments({ member: "all" })).then((r) => r.documents),
      () => call(AdminOpsService.memberDocuments()).then((r) => r.documents)),
    one(call(AdminOpsService.incentives()).then((r) => r.incentives), [] as IncentiveRow[]),
  ]);

  /* Today, with the people nobody has opened a day for (includeMissing). Only
     asked when the wide read above was not refused — a viewer with no reports
     gets an error for `member=all`. Its members top up a roster the viewer may
     not read (no team.view), so "Everyone" is not just them. */
  const todayMissing = daysPart.state === "ok" && !daysPart.own
    ? await call(AdminOpsService.attendanceDays({ member: "all", start: TODAY, end: TODAY, includeMissing: "true", pageSize: 1000 }))
      .then((r) => r.days).catch(() => [] as AttendanceDayRow[])
    : [];

  if (!current()) return;
  const vocab = vocabGot.map(([v]) => v);
  const users = usersGot[0], settings = settingsGot[0], items = itemsGot[0], tags = tagsGot[0];
  const plans = plansGot[0], reports = reportsGot[0], leave = leaveGot[0], agreements = agreementsGot[0];
  const documents = documentsGot[0], incentives = incentivesGot[0];
  applyVocab(Object.fromEntries(vocab.filter(Boolean) as (readonly [string, VocabItem[]])[]));

  const settingsOf = (id: number) => settings.filter((s) => s.member.id === id)[0];
  let roster = users || [];
  /* Without team.view the roster is refused; the viewer is still a member. */
  if (me && !roster.some((u) => String(u.id) === String(me.id))) {
    roster = roster.concat([{
      id: Number(me.id), username: me.username || "", role: "", isSuperAdmin: !!getSession()?.isFullAccess,
      isVerified: true, name: me.name || me.username || "", email: me.email || "", phone: "", roles: [],
    }]);
  }
  if (!users) {
    const known = new Set(roster.map((u) => u.id));
    todayMissing.forEach((d) => {
      if (known.has(d.member.id)) return;
      known.add(d.member.id);
      roster = roster.concat([{
        id: d.member.id, username: d.member.username || "", role: "", isSuperAdmin: false,
        isVerified: true, name: d.member.name || d.member.username || "", email: "", phone: "", roles: [],
      }]);
    });
  }

  snap = {
    ...snap,
    members: roster.map((u) => toMember(u, settingsOf(u.id))),
    days: days.filter((d) => d.id != null && !!d.startedAt).map(toDay),
    items: items.map(toItem),
    tags: tags.map(toTag),
    plans: plans.map(toPlan),
    reports: reports.map(toReport),
    leave: leave.map(toLeave),
    agreements: agreements.map(toAgreement),
    documents: documents.map(toDocument),
    pay: toPay(incentives),
  };
  /* A refused roster still holds the viewer (above), so it reads as their own
     rows; the work settings only ever fail, they are never refused wider. */
  parts = {
    members: usersGot[1].state === "denied" ? { state: "ok", own: true }
      : usersGot[1].state === "ok" && settingsGot[1].state !== "ok" ? settingsGot[1] : usersGot[1],
    items: itemsGot[1], tags: tagsGot[1], plans: plansGot[1], reports: reportsGot[1], leave: leaveGot[1],
    agreements: agreementsGot[1], documents: documentsGot[1], incentives: incentivesGot[1],
    vocab: vocabGot.map(([, p]) => p).filter((p) => p.state !== "ok")[0] || LOADED,
  };
  bootState = users || roster.length ? "ready" : "error";
  emit();
}

/** Load (once) or reload (`force`) everything this store serves. Never throws.
 *  Overlapping reloads are allowed; only the newest one lands. */
let loadSeq = 0;
export function bootTeam(force = false): Promise<void> {
  if (booting && !force) return booting;
  if (bootState === "idle") bootState = "loading";
  const mine = ++loadSeq;
  booting = load(() => mine === loadSeq).catch((e) => {
    bootState = "error";
    if (mine === loadSeq) parts = allParts(loadFailure(e));
    emit();
  });
  return booting;
}

/* ------------------------------------------------------------ writes, live --- */

export type Refusal = { ok: false; code: string; message: string };
export type Ok<T> = { ok: true; data: T };
export type Result<T> = Ok<T> | Refusal;
const err = (code: string, message: string): Refusal => ({ ok: false, code, message });
const ok = <T,>(data: T): Ok<T> => ({ ok: true, data });

/** Run a server write. `apply` folds the response into the snapshot at once and
 *  returns what the screen reads; a full re-read follows in the background so
 *  every derived view (rollups, counts) agrees with the server. */
async function live<R, T>(req: () => Promise<ApiResponseType<R>>, apply: (r: R) => T): Promise<Result<T>> {
  try {
    const r = await call(req());
    const out = apply(r);
    emit();
    void bootTeam(true);
    return ok(out);
  } catch (e) {
    return err("refused", errMessage(e));
  }
}

/* Writes to one work item go one at a time, each sending the rowVersion the
   previous one left — two quick tag clicks must not refuse each other. */
const itemQueue: Record<string, Promise<unknown>> = {};
function serial<T>(itemId: string, fn: () => Promise<T>): Promise<T> {
  const next = (itemQueue[itemId] || Promise.resolve()).then(fn, fn);
  itemQueue[itemId] = next.catch(() => undefined);
  return next;
}
const putItem = (w: WorkItemRow): WorkItem => {
  const i = toItem(w);
  snap.items = snap.items.filter((x) => x.itemId !== i.itemId).concat([i]);
  return i;
};

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
export const readDocuments = (): MemberDocument[] => snap.documents;
/** Every edge the store can see, derived from the items that carry them. */
export const readLinks = (): WorkLink[] =>
  snap.items.flatMap((i) => (i.itemLinks || []).map((e) => ({
    linkId: i.itemId + ":" + e.itemId, fromItemId: i.itemId, toItemId: e.itemId, relation: e.relation })));
export const readMember = (id: string): Member | null =>
  snap.members.filter((m) => m.memberId === id)[0] || null;
export const readItem = (id: string): WorkItem | null =>
  snap.items.filter((i) => i.itemId === id)[0] || null;

/* ============================================================== scope === */

/** Who is looking: the signed-in account's id. */
export function meId(): string {
  const s = getSession();
  return s?.user?.id != null ? String(s.user.id) : "";
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
export function stateOf(d: AttendanceDay | null, m: Member | null, at: number, date: string): AttendanceState {
  const on = d ? null : onLeave(m ? m.memberId : "", date || "");
  if (on) return "on_leave";
  if (!d) {
    if (!m) return "not_started";
    /* Absent is only answerable once the day is over. At 10am a member who is
       not in yet is Not started — calling them absent is a verdict the clock
       has not earned. */
    /* THE CUTOFF IS THE DAY BEING ASKED ABOUT, not today's. This compared `at`
       against TODAY's 20:00 whatever `date` was, so a day last week read as
       "not started" until this evening — and `dayRows` faked its way round it
       with a `+ DAY` on `at`, a workaround the other two call sites never
       applied. That is why History drew an approved leave day as absent and
       Reports called a past absence "Not started". A day that has not happened
       yet owes nothing, so it is never absent either. */
    const ref = date || TODAY;
    if (ref > TODAY) return "not_started";
    const over = at > atClock(ref, m.autoCloseAt || "20:00");
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
        state: stateOf(day, m, at, date),
        worked: workedOf(day, m, at),
        breakMins: breakOf(day, at),
      };
    });
}

export interface AttendanceTotals {
  present: number; working: number; onBreak: number; ended: number;
  late: number; absent: number; notStarted: number; onLeave: number; unclosed: number; total: number;
}

export function attendanceTotals(rows: DayRow[]): AttendanceTotals {
  const t: AttendanceTotals = { present: 0, working: 0, onBreak: 0, ended: 0, late: 0, absent: 0, notStarted: 0, onLeave: 0, unclosed: 0, total: rows.length };
  rows.forEach((r) => {
    if (r.day) t.present++;
    if (r.state === "working") t.working++;
    if (r.state === "on_break") t.onBreak++;
    if (r.state === "ended") t.ended++;
    if (r.state === "unclosed") t.unclosed++;
    if (r.state === "absent") t.absent++;
    if (r.state === "not_started") t.notStarted++;
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

/* ====================================================== attendance span === */

/** ONE MEMBER OVER A RANGE OF DAYS, counted the same way one day is counted.
 *
 *  Everything here is derived from the same `dayRows` the table draws, so the
 *  analytics and the day view cannot disagree — the alternative is two
 *  counting rules, and the one nobody is looking at is always the wrong one.
 *
 *  Three things it refuses to get wrong:
 *
 *  · **Weekends are not days.** They are excluded from the denominator, so an
 *    "80% present" figure is 80% of the days somebody was expected.
 *  · **Nobody is absent before they joined.** A member who started last Tuesday
 *    is not counted against the fortnight before it. Without this a new joiner
 *    reads as the worst attender in the company on their first week.
 *  · **An unclosed day adds no hours and is not an absence.** It is its own
 *    state, counted separately, exactly as it is on the day view.
 */
export interface SpanRow {
  member: Member;
  /** Working days this member was actually expected, joining date honoured. */
  days: number;
  present: number;
  late: number;
  absent: number;
  onLeave: number;
  unclosed: number;
  /** Minutes. `worked` excludes unclosed days, which contribute nothing. */
  worked: number;
  expected: number;
  lateMinutes: number;
  breakMinutes: number;
  /** Start times as minutes past midnight, for the arrival spread. */
  arrivals: number[];
}

export function spanRows(from: string, to: string, scope: Scope): SpanRow[] {
  /* A day nobody has lived yet is not an absence. Same guard as the report
     span, for the same reason. */
  const dates = datesIn(from, to).filter((d) => !isWeekend(d) && d <= TODAY);
  const out = new Map<string, SpanRow>();
  membersInScope(scope).filter((m) => m.status === "active").forEach((m) => {
    out.set(m.memberId, {
      member: m, days: 0, present: 0, late: 0, absent: 0, onLeave: 0, unclosed: 0,
      worked: 0, expected: 0, lateMinutes: 0, breakMinutes: 0, arrivals: [],
    });
  });

  dates.forEach((d) => {
    dayRows(d, scope).forEach((r) => {
      const row = out.get(r.member.memberId);
      if (!row) return;
      /* Before somebody joined there is nothing to count and nothing to miss. */
      if (d < r.member.joiningDate) return;
      row.days++;
      row.expected += r.member.expectedHoursPerDay * 60;
      if (r.state === "unclosed") { row.unclosed++; return; }
      if (r.state === "on_leave") { row.onLeave++; return; }
      if (!r.day) { row.absent++; return; }
      row.present++;
      row.worked += r.worked || 0;
      row.breakMinutes += r.breakMins || 0;
      if (r.day.isLate) { row.late++; row.lateMinutes += r.day.lateByMinutes || 0; }
      const t = new Date(r.day.startedAt);
      row.arrivals.push(t.getHours() * 60 + t.getMinutes());
    });
  });
  return Array.from(out.values());
}

/** THE ONE ON-TIME RULE, for every surface that prints one: days somebody was
 *  present and NOT late, over the days they were present. Null with nothing
 *  present — a percentage of no attendance is 0% on screen and a lie in the
 *  reader's head, and any figure at all for somebody with no rows is invented.
 *  Attendance Analytics and the Overview's team reads both call this, so the
 *  two cannot drift into different arithmetic again. */
export function onTimePctOf(present: number, late: number): number | null {
  if (!present) return null;
  return Math.round(((present - late) / present) * 100);
}

export interface SpanTotals {
  members: number; days: number; present: number; late: number; absent: number;
  onLeave: number; unclosed: number; worked: number; expected: number;
  /** Present days that were NOT late, over present days. Null with no data —
   *  a percentage of nothing is 0% on screen and a lie in the reader's head. */
  onTimePct: number | null;
  /** Average length of a day somebody actually worked, in minutes. */
  avgDay: number | null;
}

export function spanTotals(rows: SpanRow[]): SpanTotals {
  const t: SpanTotals = {
    members: rows.length, days: 0, present: 0, late: 0, absent: 0, onLeave: 0,
    unclosed: 0, worked: 0, expected: 0, onTimePct: null, avgDay: null,
  };
  rows.forEach((r) => {
    t.days += r.days; t.present += r.present; t.late += r.late; t.absent += r.absent;
    t.onLeave += r.onLeave; t.unclosed += r.unclosed;
    t.worked += r.worked; t.expected += r.expected;
  });
  t.onTimePct = onTimePctOf(t.present, t.late);
  if (t.present) t.avgDay = Math.round(t.worked / t.present);
  return t;
}

/** WHEN PEOPLE ACTUALLY ARRIVE, in half-hours. This is the one figure on the
 *  analytics face that no single day can show, and it is the honest version of
 *  "are we starting on time" — a spread, not an average, because one person at
 *  11:00 moves a mean and changes nothing about the rest. */
export function arrivalSpread(rows: SpanRow[]): { at: number; label: string; n: number }[] {
  const buckets = new Map<number, number>();
  rows.forEach((r) => r.arrivals.forEach((mins) => {
    const slot = Math.floor(mins / 30) * 30;
    buckets.set(slot, (buckets.get(slot) || 0) + 1);
  }));
  return Array.from(buckets.keys()).sort((a, b) => a - b).map((at) => ({
    at,
    label: String(Math.floor(at / 60)).padStart(2, "0") + ":" + String(at % 60).padStart(2, "0"),
    n: buckets.get(at) || 0,
  }));
}

/** Each working day of the span, counted across everybody — the shape the
 *  fortnight had, rather than one number for it. */
/** THE FIRST DAY ANYBODY EVER CLOCKED, across the whole record.
 *
 *  A window that reaches back past this is not showing absence, it is showing
 *  the edge of the data — and the two are indistinguishable to a derivation
 *  whose whole rule is "an absence is the lack of a row". So the screen has to
 *  say which one it is looking at, and this is how it knows. It is a real
 *  question against a real API too: an attendance table has a first row. */
export const earliestAttendance = (): string | null =>
  snap.days.reduce<string | null>((a, d) =>
    (!a || d.businessDate < a ? d.businessDate : a), null);

export interface SpanDay { date: string; present: number; late: number; absent: number; onLeave: number; unclosed: number }

/** THE SAME PARTITION `spanRows` USES, one entry per day rather than per member.
 *
 *  It deliberately does NOT call `attendanceTotals`, and a derivation check
 *  caught why: that function counts `present` as "a row was opened", so an
 *  unclosed day is both present AND unclosed there — correct on the day view,
 *  where the two are separate columns answering separate questions. Here the
 *  numbers are drawn as one stacked bar, and a stack whose segments overlap is
 *  a bar that is taller than the team. Every day lands in exactly one of the
 *  four, and `late` is a subset of `present`. */
export function spanDays(from: string, to: string, scope: Scope): SpanDay[] {
  return datesIn(from, to).filter((d) => !isWeekend(d) && d <= TODAY).map((d) => {
    const t: SpanDay = { date: d, present: 0, late: 0, absent: 0, onLeave: 0, unclosed: 0 };
    dayRows(d, scope).forEach((r) => {
      if (d < r.member.joiningDate) return;
      if (r.state === "unclosed") { t.unclosed++; return; }
      if (r.state === "on_leave") { t.onLeave++; return; }
      if (!r.day) { t.absent++; return; }
      t.present++;
      if (r.day.isLate) t.late++;
    });
    return t;
  });
}

/* ============================================================== work === */

export const isTerminal = (s: WorkStatus) => s === "completed" || s === "cancelled";

/** Past due and not finished. Never stored — see rule 1 at the top. A cancelled
 *  item is excluded, which is the single easiest part of this to get wrong:
 *  a terminal item cannot be late. */
/** How much of a task's checklist is done, as a fraction rather than a
 *  percentage — the list wants "3 of 5", the bar wants a number, and they
 *  should not be two computations. */
export const checkCount = (i: WorkItem): { done: number; total: number } => {
  const lines = i.checklist || [];
  return { done: lines.filter((l) => l.done).length, total: lines.length };
};

export function isDelayed(i: WorkItem, today = TODAY): boolean {
  if (isTerminal(i.status)) return false;
  return !!i.dueDate && i.dueDate < today;
}

export const childrenOf = (id: string, all = snap.items) => all.filter((i) => i.parentId === id);

/** Progress, derived. A milestone counts its completed children; a target
 *  divides what its EOD reports accumulated by what it asked for; a task
 *  counts its ticked lines, and is binary only when it has none.
 *
 *  A COMPLETED TASK IS 100 WHATEVER ITS LINES SAY. Somebody closing a task
 *  with two lines unticked has decided those lines did not matter, and a bar
 *  reading 60% on a finished task argues with them. The unticked lines are
 *  still on the record; the percentage is not the place to make the point.
 *
 *  Nothing here reads a stored percentage, and none is written. */
export function progressOf(i: WorkItem, all = snap.items): number | null {
  if (i.kind === "task") {
    if (i.status === "completed") return 100;
    const lines = i.checklist || [];
    if (!lines.length) return 0;
    return Math.round((lines.filter((l) => l.done).length / lines.length) * 100);
  }
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
/** THE ONE QUEUE — requested + escalated. The server already scopes `snap.leave`
 *  to what this viewer may see (HR and managers see the team), so it is not
 *  narrowed again here; only their own rows are left out unless they see all. */
export const pendingLeave = (scope: Scope): LeaveRequest[] =>
  snap.leave.filter((l) => (l.state === "requested" || l.state === "escalated")
    && (scope === "all" || l.memberId !== meId()));

/** Every date a range covers, inclusive. Field arithmetic through addDays, not
 *  `new Date(...).toISOString()`: this panel runs at +05:30, where an ISO
 *  round-trip of a local midnight lands on the day before. */
export function datesIn(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

/** WHAT MAKES THIS REQUEST IMPOSSIBLE, said before it is sent.
 *
 *  Two clashes, and they are different in kind:
 *
 *  · **A day already opened.** §3.7: a leave record laid over an attendance row
 *    makes one date both worked and away, and the derivation has no way to
 *    choose between them. It is refused, not warned.
 *  · **A day already spoken for** by this member's own live request. A second
 *    request over the same date gives the approver two rows to decide and the
 *    member two answers.
 *
 *  It returns the dates rather than a sentence, so the form can name them and
 *  the store can refuse on exactly the same rule. */
export interface LeaveClash { worked: string[]; taken: string[] }
export function leaveClash(memberId: string, from: string, to: string): LeaveClash {
  const days = datesIn(from, to);
  const live = snap.leave.filter((l) => l.memberId === memberId
    && (l.state === "requested" || l.state === "approved" || l.state === "escalated"));
  return {
    worked: days.filter((d) => !!dayFor(memberId, d)),
    taken: days.filter((d) => live.some((l) => d >= l.fromDate && d <= l.toDate)),
  };
}

/** WHO ELSE IS AWAY over the same dates, among the people this request's
 *  approver is responsible for. §3.8: this is a WARNING and never a block —
 *  nothing in the module knows how many people a day needs, and refusing on a
 *  staffing rule nobody configured would be the panel inventing one. */
export interface LeaveOverlap { date: string; members: Member[] }
export function leaveOverlap(l: LeaveRequest): LeaveOverlap[] {
  const m = readMember(l.memberId);
  if (!m) return [];
  /* The peer group is everyone reporting to the same senior, minus the person
     asking. A clash only matters against people who cover the same work. */
  const peers = snap.members.filter((x) => x.memberId !== l.memberId
    && x.status === "active" && !!m.reportsTo && x.reportsTo === m.reportsTo);
  const ids = peers.map((x) => x.memberId);
  return datesIn(l.fromDate, l.toDate)
    .map((date) => ({ date, members: leaveOn(date, ids).map((x) => readMember(x.memberId)).filter(Boolean) as Member[] }))
    .filter((r) => r.members.length > 0);
}

/** A REQUEST WITH NO APPROVER MUST NEVER JUST SIT THERE. §3.8/TM-OD-25: a
 *  member at the top of the tree points at nobody, so their request routes to
 *  whoever holds the deciding verb instead of falling down a hole. Surfacing
 *  the list is what stops that being silent. */
export const unroutedLeave = (): LeaveRequest[] =>
  snap.leave.filter((l) => (l.state === "requested" || l.state === "escalated") && !(readMember(l.memberId) || { reportsTo: "x" }).reportsTo);

/** THE WHOLE QUEUE, SPLIT AND DE-DUPLICATED — one function, so the tab's count
 *  and the list under it cannot disagree.
 *
 *  They could, and briefly did: an admin whose scope reaches the founder sees
 *  that request in `pendingLeave` AND in `unroutedLeave`, and adding the two
 *  lengths counted it twice. A badge that says 3 over a list of 2 is a badge
 *  nobody trusts again. */
export interface LeaveQueue { mine: LeaveRequest[]; unrouted: LeaveRequest[]; total: number }
export function leaveQueue(scope: Scope): LeaveQueue {
  const mine = pendingLeave(scope);
  const unrouted = unroutedLeave().filter((l) => mine.every((x) => x.leaveId !== l.leaveId));
  return { mine, unrouted, total: mine.length + unrouted.length };
}

/* ====================================================== documents === */

export const agreementsFor = (memberId: string): Agreement[] =>
  snap.agreements.filter((a) => a.memberId === memberId)
    .slice().sort((a, b) => (b.sentAt || "").localeCompare(a.sentAt || ""));

/** By kind, and NEWEST FIRST within a kind — so the first row of a kind is the
 *  latest upload, which is what every reader of `[0]` was assuming. */
export const documentsFor = (memberId: string): MemberDocument[] =>
  snap.documents.filter((r) => r.memberId === memberId)
    .slice().sort((a, b) => a.kind.localeCompare(b.kind) || b.uploadedAt.localeCompare(a.uploadedAt));

/** Which of the required documents this member has not handed over. Derived
 *  from the vocabulary, so the answer changes with the list and not with a
 *  constant somebody has to remember to edit. */
export const missingDocs = (memberId: string): string[] => {
  const have = documentsFor(memberId).map((r) => r.kind);
  return REQUIRED_DOCS.filter((k) => have.indexOf(k) < 0);
};

/** An agreement that was sent, never opened, and is running out of time. It is
 *  the only thing on this list that is waiting on a human. */
export const staleAgreements = (memberId: string, today = TODAY): Agreement[] =>
  agreementsFor(memberId).filter((a) => a.state === "sent" && !!a.expiresAt && (a.expiresAt as string) >= today);

/** Sent and never opened, across a scope. The one list on the roll-up that is
 *  waiting on a human rather than on work. */
export const unopenedAgreements = (scope: Scope): Agreement[] => {
  const ids = membersInScope(scope).map((m) => m.memberId);
  return snap.agreements.filter((a) => a.state === "sent" && ids.indexOf(a.memberId) >= 0);
};

/* ============================================================== pay === */

/** TEAM READS PAY AND NEVER WRITES IT. Every number below belongs to Finance;
 *  this module shows it and links there for anything that changes it. */
export const payFor = (memberId: string): Pay | null =>
  snap.pay.filter((p) => p.memberId === memberId)[0] || null;

export const incentiveTotal = (p: Pay | null, state?: string): number =>
  (p ? p.incentives : []).filter((i) => !state || i.state === state)
    .reduce((a, i) => a + i.amount, 0);

/** THE ONLY WAY A TYPED ADDRESS BECOMES A STORED ONE.
 *
 *  It returns null rather than throwing, so a half-typed address is simply not
 *  addable yet. Two things it is doing that are not cosmetic:
 *
 *  · **http and https only.** `javascript:alert(1)` is a valid URL and a valid
 *    `href`, and one click on a stored one runs script with the panel's
 *    session. A link field is the classic way that gets in, so the scheme is
 *    allow-listed here rather than sanitised at the render.
 *  · A bare `docs.google.com/…` is treated as https, because a link somebody
 *    pastes without a scheme is still a link and `//` is not a thing anybody
 *    should have to remember. */
/** The host, for a link nobody bothered to name. Never throws: it is handed
 *  URLs that have already been through `normaliseUrl`, and a fallback beats a
 *  crash for the one that has not. */
export function hostOf(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; }
}

export function normaliseUrl(raw: string): string | null {
  const v = (raw || "").trim();
  if (!v) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : "https://" + v;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch { return null; }
}

/* ============================================================= links === */

export interface LinkedItem { link: WorkLink; other: WorkItem; outward: boolean }

/** Both directions of every edge touching an item, with the row the edge points
 *  at resolved live. A dangling edge renders nothing rather than a dead id.
 *
 *  THE INWARD HALF IS A SCAN, and it is free: the edge is stored on one end
 *  only, and the list being scanned is the one this store already holds. An
 *  edge written on a task the viewer may not read is not in that list and does
 *  not show — which is the same line every other read in this module draws. */
export function linksOf(itemId: string, all = snap.items): LinkedItem[] {
  const out: LinkedItem[] = [];
  all.forEach((i) => {
    (i.itemLinks || []).forEach((e) => {
      const outward = i.itemId === itemId;
      if (!outward && e.itemId !== itemId) return;
      const other = readItem(outward ? e.itemId : i.itemId);
      if (other) {
        out.push({ link: { linkId: i.itemId + ":" + e.itemId, fromItemId: i.itemId, toItemId: e.itemId,
          relation: e.relation }, other, outward });
      }
    });
  });
  return out;
}

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
  /** Truthy = only items waiting on another open item. */
  wait?: string;
}

export function workRows(f: WorkFilter, scope: Scope): WorkItem[] {
  const ids = membersInScope(scope).map((m) => m.memberId);
  let rows = snap.items.filter((i) => ids.indexOf(i.assigneeId) >= 0);
  if (f.member) rows = rows.filter((i) => i.assigneeId === f.member);
  if (f.kind) rows = rows.filter((i) => i.kind === f.kind);
  if (f.status) rows = rows.filter((i) => stageOf(i) === f.status);
  if (f.tag) rows = rows.filter((i) => hasSlug(i, f.tag as string));
  if (f.priority) rows = rows.filter((i) => i.priority === f.priority);
  if (f.wait) rows = rows.filter((i) => !!blockerOf(i));
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

/* ==================================================== reports over a span === */

/** PLANS AND EODS OVER A RANGE, counted the way the day view counts them.
 *
 *  The pair is the point: a plan is what somebody meant to do this morning, an
 *  EOD is what happened, and the gap between `planned` and `done` is the only
 *  thing in this module that compares an intention with an outcome. Summing
 *  them here rather than in the component keeps one counting rule; two would
 *  drift, and the one nobody is watching is the one that drifts.
 *
 *  Three rules it inherits from `attentionOf`, deliberately and not by accident:
 *
 *  · **Anybody with no reporting line is out of the submission counts.** The
 *    founder reports to nobody, so a plan from them is owed to nobody. A figure
 *    that always shows the same person delinquent is a figure people stop
 *    reading. They still appear in the table — with their expected days at zero,
 *    which says why rather than hiding them.
 *  · **An EOD is only owed once that member's own day is over.** `eodDue` takes
 *    the member and the clock, so missing at four in the afternoon is early.
 *  · **Weekends are not days, and nobody owes anything before they joined.**
 */
export interface ReportSpanRow {
  member: Member;
  /** Working days this member was expected to plan for. Zero for anybody with
   *  no reporting line, which is what keeps them out of the percentages. */
  days: number;
  plans: number;
  /** Days on which an EOD had actually fallen due. */
  eodsDue: number;
  eods: number;
  /** Submitted and still nobody has opened it. */
  unread: number;
  /** Plan lines written, and report lines ticked. The two numbers, never a
   *  score made out of them. */
  planned: number;
  done: number;
}

export function reportSpanRows(from: string, to: string, scope: Scope): ReportSpanRow[] {
  /* NOTHING IS OWED FOR A DAY THAT HAS NOT HAPPENED. Callers pass `to = TODAY`,
     so this never bites in the panel — and a derivation that is only correct
     because of how it happens to be called is one bad argument from lying. A
     check asking for a window in the future is what found it. */
  const dates = datesIn(from, to).filter((d) => !isWeekend(d) && d <= TODAY);
  return membersInScope(scope).filter((m) => m.status === "active").map((m) => {
    const row: ReportSpanRow = {
      member: m, days: 0, plans: 0, eodsDue: 0, eods: 0, unread: 0, planned: 0, done: 0,
    };
    dates.forEach((d) => {
      if (d < m.joiningDate) return;
      if (m.reportsTo) row.days++;
      const plan = planFor(m.memberId, d);
      if (plan && plan.submittedAt) { row.plans++; row.planned += plan.lines.length; }
      const due = eodDue(d, m);
      if (m.reportsTo && due) row.eodsDue++;
      const rep = reportFor(m.memberId, d);
      if (rep && rep.submittedAt) {
        row.eods++;
        row.done += rep.lines.filter((l) => l.done).length;
        if (!rep.acknowledgedById) row.unread++;
      }
    });
    return row;
  });
}

export interface ReportSpanTotals {
  members: number; days: number; plans: number; eodsDue: number; eods: number;
  unread: number; planned: number; done: number;
  /** Null rather than zero where there is nothing to divide — a percentage of
   *  nothing reads as 0% and lands in the reader's head as a failure. */
  planPct: number | null;
  eodPct: number | null;
  keptPct: number | null;
}

export function reportSpanTotals(rows: ReportSpanRow[]): ReportSpanTotals {
  const t: ReportSpanTotals = {
    members: rows.length, days: 0, plans: 0, eodsDue: 0, eods: 0, unread: 0,
    planned: 0, done: 0, planPct: null, eodPct: null, keptPct: null,
  };
  rows.forEach((r) => {
    t.days += r.days; t.plans += r.plans; t.eodsDue += r.eodsDue; t.eods += r.eods;
    t.unread += r.unread; t.planned += r.planned; t.done += r.done;
  });
  if (t.days) t.planPct = Math.round((t.plans / t.days) * 100);
  if (t.eodsDue) t.eodPct = Math.round((t.eods / t.eodsDue) * 100);
  if (t.planned) t.keptPct = Math.round((t.done / t.planned) * 100);
  return t;
}

/** The same numbers a day at a time, for the shape rather than the total. */
export interface ReportSpanDay {
  date: string; owed: number; plans: number; eodsDue: number; eods: number; unread: number;
}
export function reportSpanDays(from: string, to: string, scope: Scope): ReportSpanDay[] {
  const people = membersInScope(scope).filter((m) => m.status === "active");
  return datesIn(from, to).filter((d) => !isWeekend(d) && d <= TODAY).map((d) => {
    const t: ReportSpanDay = { date: d, owed: 0, plans: 0, eodsDue: 0, eods: 0, unread: 0 };
    people.forEach((m) => {
      if (d < m.joiningDate) return;
      if (m.reportsTo) t.owed++;
      const plan = planFor(m.memberId, d);
      if (plan && plan.submittedAt) t.plans++;
      if (m.reportsTo && eodDue(d, m)) t.eodsDue++;
      const rep = reportFor(m.memberId, d);
      if (rep && rep.submittedAt) {
        t.eods++;
        if (!rep.acknowledgedById) t.unread++;
      }
    });
    return t;
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

/* ========================================================== the writes ===
   Every write returns a Promise of the same { ok } / { ok:false, code, message }
   shape the screens already branch on. Nothing here mints an id: item↔item
   links, checklists and the "waiting on" reason are the server's now. */

/* The attendance clock is the caller's own day, on the server's clock and
   against their own work settings — the memberId is who the screen thinks it
   is acting for, and anybody else is refused rather than silently swapped. */
const ownDay = (memberId: string, action: "open" | "break" | "resume" | "end"): Promise<Result<AttendanceDay>> =>
  memberId !== meId()
    ? Promise.resolve(err("not_own_day", "Only your own day can be clocked."))
    : live(() => AdminOpsService.attendanceDayAction(action), (d) => {
      const day = toDay(d);
      snap.days = snap.days.filter((x) => x.attendanceId !== day.attendanceId).concat([day]);
      return day;
    });

export const openDay = (memberId: string) => ownDay(memberId, "open");
/** Check in at a stated time (HH:MM) with the reason it is not now. */
export const openDayAt = (memberId: string, startedAt: string, note: string): Promise<Result<AttendanceDay>> =>
  memberId !== meId()
    ? Promise.resolve(err("not_own_day", "Only your own day can be clocked."))
    : live(() => AdminOpsService.openAttendanceDayAt({ startedAt, note }), (d) => {
      const day = toDay(d);
      snap.days = snap.days.filter((x) => x.attendanceId !== day.attendanceId && !(x.memberId === day.memberId && x.businessDate === day.businessDate)).concat([day]);
      return day;
    });
export const startBreak = (memberId: string) => ownDay(memberId, "break");
export const resumeDay = (memberId: string) => ownDay(memberId, "resume");
export const endDay = (memberId: string) => ownDay(memberId, "end");

/** WHERE THIS ITEM MAY GO NEXT, read from the same server rows that
 *  `work/<id>/status/` enforces with. A control that offers a move the server
 *  will refuse is a control that lies.
 *
 *  DELAY IS NOT IN HERE AND CANNOT BE. It is derived from the due date, nothing
 *  writes it, and there is no row for it: an item in Delay is offered the moves
 *  its STORED status allows. */
export interface Transition { to: WorkStatus; requiresReason: boolean; label: string }

export function transitionsFrom(from: WorkStatus): Transition[] {
  return TRANSITIONS.filter((t) => t.from === from).map((t) => ({
    to: t.to as WorkStatus,
    requiresReason: t.requiresReason || t.to === "cancelled",
    label: t.label || labelOf(WORK_STATUS, t.to),
  }));
}

export function setItemStatus(itemId: string, to: WorkStatus, reason?: string): Promise<Result<WorkItem>> {
  const first = readItem(itemId);
  if (!first) return Promise.resolve(err("item_not_found", "No such work item."));
  const move = transitionsFrom(first.status).filter((t) => t.to === to)[0];
  if (!move)
    return Promise.resolve(err("invalid_transition", labelOf(WORK_STATUS, first.status) + " cannot become " + labelOf(WORK_STATUS, to) + "."));
  if (move.requiresReason && !(reason || "").trim())
    return Promise.resolve(err("reason_required", "This change needs a reason."));
  return serial(itemId, () => live(
    () => AdminOpsService.setWorkStatus(Number(itemId), { rowVersion: (readItem(itemId) as WorkItem).rowVersion, to, reason: reason || "" }),
    putItem));
}

/** Waiting on another item: WHICH task, and WHAT for. Both are the server's
 *  now, and the reason is dropped when the blocker is — a sentence about a
 *  block that is gone is a note about nothing. */
export function setBlockedBy(itemId: string, blockerId: string | null, reason?: string): Promise<Result<WorkItem>> {
  const i = readItem(itemId);
  if (!i) return Promise.resolve(err("item_not_found", "No such work item."));
  if (blockerId) {
    if (blockerId === itemId) return Promise.resolve(err("self_block", "An item cannot wait on itself."));
    if (!readItem(blockerId)) return Promise.resolve(err("blocker_not_found", "No such item to wait on."));
    if (!(reason || "").trim()) return Promise.resolve(err("reason_required", "Say what it is waiting for."));
  }
  return serial(itemId, () => live(
    () => AdminOpsService.updateWork(Number(itemId), {
      rowVersion: (readItem(itemId) as WorkItem).rowVersion,
      blockedBy: blockerId ? Number(blockerId) : null,
      blockedReason: blockerId ? (reason || "").trim() : "" }),
    putItem));
}

/** A tag is born here — one keystroke from the picker. A member may only tag
 *  with their own tags; the server returns an existing active tag of the same
 *  name rather than making a second. */
export function createTag(ownerId: string, label: string, tone?: string): Promise<Result<Tag>> {
  if (!label.trim()) return Promise.resolve(err("tag_empty", "A tag needs a name."));
  return live(
    () => AdminOpsService.createWorkTag({ label: label.trim(), tone: tone || "slate", owner: Number(ownerId) || undefined }),
    (t) => {
      const tag = toTag(t);
      snap.tags = snap.tags.filter((x) => x.tagId !== tag.tagId).concat([tag]);
      return tag;
    });
}

export function tagItem(itemId: string, tagId: string, on: boolean): Promise<Result<WorkItem>> {
  if (!readItem(itemId)) return Promise.resolve(err("item_not_found", "No such work item."));
  return serial(itemId, () => {
    const i = readItem(itemId) as WorkItem;
    const have = i.tagIds || [];
    const next = on ? (have.indexOf(tagId) < 0 ? have.concat([tagId]) : have) : have.filter((t) => t !== tagId);
    return live(() => AdminOpsService.updateWork(Number(itemId), { rowVersion: i.rowVersion, tags: next.map(Number) }), putItem);
  });
}

export function archiveTag(tagId: string): Promise<Result<Tag>> {
  if (!readTag(tagId)) return Promise.resolve(err("tag_not_found", "No such tag."));
  return live(() => AdminOpsService.archiveWorkTag(Number(tagId)), (t) => {
    const tag = toTag(t);
    snap.tags = snap.tags.map((x) => (x.tagId === tag.tagId ? tag : x));
    return tag;
  });
}

/** One row, so every item wearing the tag follows a rename. The slug follows
 *  the label on the server; a name another ACTIVE tag of theirs already holds
 *  is refused rather than made into a second `call`. */
const writeTag = (tagId: string, req: () => Promise<ApiResponseType<WorkTagRow>>): Promise<Result<Tag>> => {
  if (!readTag(tagId)) return Promise.resolve(err("tag_not_found", "No such tag."));
  return live(req, (t) => {
    const tag = toTag(t);
    snap.tags = snap.tags.map((x) => (x.tagId === tag.tagId ? tag : x));
    return tag;
  });
};

export const renameTag = (tagId: string, label: string): Promise<Result<Tag>> =>
  (label.trim()
    ? writeTag(tagId, () => AdminOpsService.updateWorkTag(Number(tagId), { label: label.trim() }))
    : Promise.resolve(err("tag_empty", "A tag needs a name.")));

/** Archiving freed the slug, so a restore can find it taken — the server says
 *  so rather than leaving two active tags of one name. */
export const restoreTag = (tagId: string): Promise<Result<Tag>> =>
  writeTag(tagId, () => AdminOpsService.restoreWorkTag(Number(tagId)));

export const setTagTone = (tagId: string, tone: string): Promise<Result<Tag>> =>
  writeTag(tagId, () => AdminOpsService.updateWorkTag(Number(tagId), { tone }));

/* --------------------------------------------------------- agreements --- */

/** Folds one agreement row back into the snapshot — every write answers with
 *  the whole record, so no screen patches a copy of it. */
const putAgreement = (row: AgreementRow): Agreement => {
  const a = toAgreement(row);
  snap.agreements = snap.agreements.filter((x) => x.agreementId !== a.agreementId).concat([a]);
  return a;
};

/** SEND ONE COPY TO ONE MEMBER. The body is the panel's own rendering of its
 *  local template, frozen by the server at send — there is no template model
 *  there, which is exactly why the document travels with the row. */
export function sendAgreement(
  memberId: string, kind: string, title: string, from?: { templateId: string; body: string; version: number },
): Promise<Result<Agreement>> {
  if (!title.trim()) return Promise.resolve(err("validation_failed", "An agreement needs a title."));
  if (!from || !from.body) return Promise.resolve(err("no_body", "There is nothing to sign. Send it from a template."));
  return live(() => AdminOpsService.sendAgreement({
    member: Number(memberId), kind, title: title.trim(), body: from.body, version: from.version,
    expiresAt: addDays(TODAY, AGREEMENT_DAYS), templateKey: from.templateId || undefined,
  }), putAgreement);
}

/** Opening the document is the reading, and the FIRST open is the one recorded.
 *  The member's own copy only — nobody opens somebody else's for them. */
export function markViewed(agreementId: string): Promise<Result<Agreement>> {
  const a = snap.agreements.filter((x) => x.agreementId === agreementId)[0];
  if (!a) return Promise.resolve(err("not_found", "No such agreement."));
  if (a.memberId !== meId() || a.viewedAt || a.state === "signed") return Promise.resolve(ok(a));
  return live(() => AdminOpsService.viewAgreement(Number(agreementId)), putAgreement);
}

/** Typing the name is the signature. The time and the address it came from are
 *  the server's — a signature the client dated would be worth nothing. */
export function signAgreement(agreementId: string, name: string): Promise<Result<Agreement>> {
  const a = snap.agreements.filter((x) => x.agreementId === agreementId)[0];
  if (!a) return Promise.resolve(err("not_found", "No such agreement."));
  if (a.memberId !== meId()) return Promise.resolve(err("not_own", "Only the member it was sent to can sign it."));
  if (name.trim().length < 2) return Promise.resolve(err("validation_failed", "Type your full name to sign."));
  return live(() => AdminOpsService.signAgreement(Number(agreementId), name.trim()), putAgreement);
}

export function revokeAgreement(agreementId: string): Promise<Result<Agreement>> {
  const a = snap.agreements.filter((x) => x.agreementId === agreementId)[0];
  if (!a) return Promise.resolve(err("not_found", "No such agreement."));
  if (a.state === "signed") return Promise.resolve(err("already_signed", "A signed agreement cannot be revoked."));
  return live(() => AdminOpsService.revokeAgreement(Number(agreementId)), putAgreement);
}

/* ------------------------------------------------------------ documents --- */
/* THE ROW AND THE FILE, AND THE FILE IS PRIVATE. The bytes go straight to our
   bucket with a presigned PUT (intent MemberDocument) and the server keeps the
   key as a private attachment; a read hands back a signed, expiring URL. No
   size is invented — what is recorded is the file's own, in whole kilobytes. */

/** A document is up to 5 MB, the same ceiling every other upload here takes. */
export const DOCUMENT_MAX_KB = 5 * 1024;

/** ONE ROW PER UPLOAD, AND THE READ SHOWS THE NEWEST — `documentsFor` is
 *  newest-first, so a replaced document keeps the old row as the trail. */
export async function addDocument(memberId: string, kind: string, label: string,
  file?: File): Promise<Result<MemberDocument>> {
  if (!label.trim()) return err("validation_failed", "A label is required.");
  let up: { fileUrl: string; fileName: string; mimeType: string; sizeKb: number } | undefined;
  if (file) {
    /* Refused BEFORE the upload, not after it: a 40 MB scan should not travel
       to be turned away. */
    if (file.size > DOCUMENT_MAX_KB * 1024) return err("too_big", "A document is up to 5 MB.");
    if (!file.size) return err("empty_file", "That file is empty.");
    try {
      /* The PUT has to carry the type the URL was signed for; a file the
         browser gives no type is sent as octet-stream. */
      const picked = file.type ? file : new File([file], file.name, { type: "application/octet-stream" });
      const got = await CommonService.getUploadUrl({
        fileName: picked.name, fileType: picked.type, for: "MemberDocument" });
      if (!got.response) throw new Error(got.message || "Could not get an upload URL.");
      await CommonService.uploadToS3(got.data.uploadUrl, picked);
      up = { fileUrl: got.data.fileUrl, fileName: picked.name, mimeType: picked.type,
        /* Whole kilobytes, rounded UP: a 300-byte file is 1 KB, never 0, and 0
           is what the server reads as "no file at all". */
        sizeKb: Math.ceil(picked.size / 1024) };
    } catch (e) {
      return err("upload_failed", errMessage(e));
    }
  }
  return live(() => AdminOpsService.recordMemberDocument({
    member: Number(memberId) || undefined, kind, label: label.trim(), ...up,
  }), (d) => {
    const row = toDocument(d);
    snap.documents = snap.documents.concat([row]);
    return row;
  });
}

export function deleteDocument(documentId: string, reason: string): Promise<Result<string>> {
  if (!snap.documents.some((r) => r.documentId === documentId))
    return Promise.resolve(err("document_not_found", "No such document."));
  if (!reason.trim()) return Promise.resolve(err("validation_failed", "Say why — the reason is kept on the record."));
  return live(() => AdminOpsService.removeMemberDocument(Number(documentId), reason), () => {
    snap.documents = snap.documents.filter((r) => r.documentId !== documentId);
    return documentId;
  });
}

/** Checked by somebody else, never by the person who handed it over. */
export function verifyDocument(documentId: string): Promise<Result<MemberDocument>> {
  if (!snap.documents.some((r) => r.documentId === documentId))
    return Promise.resolve(err("document_not_found", "No such document."));
  return live(() => AdminOpsService.verifyMemberDocument(Number(documentId)), (d) => {
    const row = toDocument(d);
    snap.documents = snap.documents.map((x) => (x.documentId === row.documentId ? row : x));
    return row;
  });
}

/* ------------------------------------------------------- item↔item links --- */

/** An edge may not restate a strong link: the parent and the blocker already
 *  carry meaning, and the same pair drawn twice would eventually disagree.
 *
 *  The server refuses an unknown relation, a task that is not there, a self
 *  link and a pair already linked; the two checks here are the ones it has no
 *  reason to know about, and they answer without a round trip. */
export function addLink(fromItemId: string, toItemId: string, relation: LinkRelation): Promise<Result<WorkLink>> {
  const refuse = (code: string, message: string) => Promise.resolve(err(code, message));
  if (fromItemId === toItemId) return refuse("self_link", "An item cannot link to itself.");
  const a = readItem(fromItemId), b = readItem(toItemId);
  if (!a || !b) return refuse("item_not_found", "No such work item.");
  if (a.parentId === toItemId || b.parentId === fromItemId)
    return refuse("is_parent", "That is already the parent link.");
  if (a.blockedByItemId === toItemId || b.blockedByItemId === fromItemId)
    return refuse("is_blocker", "That is already the waiting-on link.");
  return serial(fromItemId, () => live(
    () => AdminOpsService.addWorkLink(Number(fromItemId), { itemId: Number(toItemId), relation }),
    (w) => {
      putItem(w);
      return { linkId: fromItemId + ":" + toItemId, fromItemId, toItemId, relation };
    }));
}

/** `linkId` is the pair — there is no edge row to address. */
export function removeLink(linkId: string): Promise<Result<string>> {
  const [from, to] = linkId.split(":");
  if (!from || !to) return Promise.resolve(err("link_not_found", "No such link."));
  return serial(from, () => live(
    () => AdminOpsService.removeWorkLink(Number(from), Number(to)),
    (w) => { putItem(w); return linkId; }));
}

/* ------------------------------------------------------------- leave --- */

/** The server files leave for the caller only. */
export function requestLeave(memberId: string, input: {
  fromDate: string; toDate: string; kind: string; reason: string;
}): Promise<Result<LeaveRequest>> {
  const refuse = (code: string, message: string) => Promise.resolve(err(code, message));
  if (memberId !== meId()) return refuse("not_own", "Leave can only be requested for yourself.");
  if (!input.fromDate || !input.toDate) return refuse("dates_required", "Both dates are needed.");
  if (input.toDate < input.fromDate) return refuse("bad_range", "The last day is before the first.");
  if (!input.reason.trim()) return refuse("reason_required", "A leave request needs a reason.");
  /* THE SAME RULE THE FORM DREW, ENFORCED — a day already clocked cannot also
     be a day away. The server checks the overlap with other requests. */
  const clash = leaveClash(memberId, input.fromDate, input.toDate);
  if (clash.worked.length)
    return refuse("day_worked", "They clocked in on " + fmtDate(clash.worked[0])
      + ". A leave record over an attendance row makes that day both worked and away.");
  return live(() => AdminOpsService.requestLeave({
    kind: input.kind, fromDate: input.fromDate, toDate: input.toDate, reason: input.reason.trim() }), (l) => {
    const row = toLeave(l);
    snap.leave = snap.leave.concat([row]);
    return row;
  });
}

/** Approve, refuse, or — the requester's own move — withdraw. Refusing needs a
 *  sentence: a refusal nobody explained is one the member has to ask about. */
export function decideLeave(leaveId: string, state: LeaveState, _byId: string, note?: string): Promise<Result<LeaveRequest>> {
  const l = snap.leave.filter((x) => x.leaveId === leaveId)[0];
  if (!l) return Promise.resolve(err("leave_not_found", "No such request."));
  if (l.state !== "requested" && l.state !== "escalated") return Promise.resolve(err("already_decided", "That request is already " + l.state + "."));
  if (state === "rejected" && !(note || "").trim())
    return Promise.resolve(err("reason_required", "Say why it is refused."));
  const put = (row: LeaveRow) => {
    const next = toLeave(row);
    snap.leave = snap.leave.map((x) => (x.leaveId === next.leaveId ? next : x));
    return next;
  };
  if (state === "withdrawn") return live(() => AdminOpsService.withdrawLeave(Number(leaveId)), put);
  if (state !== "approved" && state !== "rejected")
    return Promise.resolve(err("invalid_state", "A request is approved, refused or withdrawn."));
  return live(() => AdminOpsService.decideLeave(Number(leaveId), { state, note: (note || "").trim() }), put);
}

/** The member's own history from the server, merged in — the team-wide read may have been refused. */
export async function loadLeaveFor(memberId: string): Promise<void> {
  try {
    const r = await call(AdminOpsService.leave({ member: memberId, pageSize: 500 }));
    snap.leave = snap.leave.filter((x) => x.memberId !== memberId).concat(r.leave.map(toLeave));
    emit();
  } catch { /* the page keeps what the store already has */ }
}

/** An escalated request is the Admin's alone to decide. */
export const canDecideLeave = (l: LeaveRequest): boolean =>
  l.state === "requested" || (l.state === "escalated" && !!getSession()?.isFullAccess);

/** An admin records leave for somebody; the server lands it approved. */
export function recordLeave(memberId: string, input: {
  fromDate: string; toDate: string; kind: string; reason: string;
}): Promise<Result<LeaveRequest>> {
  if (!input.fromDate || !input.toDate) return Promise.resolve(err("dates_required", "Both dates are needed."));
  if (input.toDate < input.fromDate) return Promise.resolve(err("bad_range", "The last day is before the first."));
  return live(() => AdminOpsService.requestLeave({ ...input, reason: input.reason.trim(), member: Number(memberId) }), (l) => {
    const row = toLeave(l);
    snap.leave = snap.leave.concat([row]);
    return row;
  });
}

/** Take a request, or a decision on it, to the Admin. A note is required. */
export function escalateLeave(leaveId: string, note: string): Promise<Result<LeaveRequest>> {
  if (!note.trim()) return Promise.resolve(err("reason_required", "Say what the Admin should weigh."));
  return live(() => AdminOpsService.escalateLeave(Number(leaveId), { note: note.trim() }), (row) => {
    const next = toLeave(row);
    snap.leave = snap.leave.map((x) => (x.leaveId === next.leaveId ? next : x));
    return next;
  });
}

/* ------------------------------------------------- checklist and links --- */

/** THE WHOLE LIST, IN ORDER, IN ONE WRITE. Adding, ticking, renaming, dropping
 *  and reordering are all this call; the server keeps the ids it is sent, so a
 *  line survives every one of them. A new line goes up with an empty id and is
 *  given one there. */
function withChecklist(itemId: string, fn: (lines: CheckLine[]) => CheckLine[] | string): Promise<Result<WorkItem>> {
  const i = readItem(itemId);
  if (!i) return Promise.resolve(err("item_not_found", "No such item."));
  const out = fn((i.checklist || []).slice());
  if (typeof out === "string") return Promise.resolve(err("validation_failed", out));
  return serial(itemId, () => live(() => AdminOpsService.setWorkChecklist(Number(itemId), {
    rowVersion: (readItem(itemId) as WorkItem).rowVersion,
    lines: out.map((l) => ({ id: l.lineId, text: l.text, done: l.done })),
  }), putItem));
}

/** The whole list at once — what a reorder or a rename sends. */
export const setChecklist = (itemId: string, lines: CheckLine[]): Promise<Result<WorkItem>> =>
  withChecklist(itemId, () => lines);

/** WHO MAY ROLL UP UNDER WHOM — depth 3, target ▸ milestone ▸ task — written
 *  once. `selfId` is the item being re-parented; a new item has no descendants,
 *  so without it the loop check is skipped. */
export function parentError(kind: WorkKind, parentId: string | null | undefined, selfId?: string): string | null {
  if (!parentId) return null;
  if (selfId && parentId === selfId) return "An item cannot roll up to itself.";
  const p = readItem(parentId);
  if (!p) return "No such parent.";
  if (p.kind === "task") return "A task cannot hold children.";
  if (kind === "target") return "A target is always top level.";
  if (kind === "milestone" && p.kind !== "target") return "A milestone rolls up to a target.";
  if (selfId) {
    const seen = new Set<string>();
    for (let cur: WorkItem | null = p; cur && !seen.has(cur.itemId); cur = cur.parentId ? readItem(cur.parentId) : null) {
      if (cur.itemId === selfId) return "That would make the item roll up to itself.";
      seen.add(cur.itemId);
    }
  }
  return null;
}
/** The parents a dialog may offer an item of `kind`: open, of a kind that may
 *  hold it, never itself and never anything under it. */
export function parentOptions(kind: WorkKind, all: WorkItem[], selfId?: string): WorkItem[] {
  return all.filter((i) => !isTerminal(i.status) && i.itemId !== selfId
    && (kind === "task" ? i.kind !== "task" : i.kind === "target")
    && !(selfId && parentError(kind, i.itemId, selfId)));
}

/** EDITING WHAT WAS CREATED. The kind is not editable: it decides what may sit
 *  under an item. Handing an item to somebody else drops the tags the last
 *  person owned — tags are the owner's own. */
export interface ItemPatch {
  title?: string; assigneeId?: string; priority?: Priority;
  startDate?: string | null; dueDate?: string | null; parentId?: string | null;
  description?: string | null;
}
export function updateItem(itemId: string, patch: ItemPatch): Promise<Result<WorkItem>> {
  const i = readItem(itemId);
  const refuse = (m: string) => Promise.resolve(err("validation_failed", m));
  if (!i) return Promise.resolve(err("item_not_found", "No such item."));
  if (isTerminal(i.status)) return refuse("It is " + labelOf(WORK_STATUS, i.status).toLowerCase() + ". Reopen or restore it first.");
  const title = patch.title !== undefined ? patch.title.trim() : i.title;
  if (!title) return refuse("A title is required.");
  const assigneeId = patch.assigneeId !== undefined ? patch.assigneeId : i.assigneeId;
  if (assigneeId !== i.assigneeId) {
    const m = readMember(assigneeId);
    if (!m) return refuse("No such member.");
    if (m.status !== "active") return refuse("That member is not active.");
  }
  const start = patch.startDate !== undefined ? patch.startDate : i.startDate;
  const due = patch.dueDate !== undefined ? patch.dueDate : i.dueDate;
  if (start && due && start > due) return refuse("It cannot be due before it starts.");
  const parentId = patch.parentId !== undefined ? patch.parentId : i.parentId;
  if (parentId !== i.parentId) {
    const bad = parentError(i.kind, parentId, i.itemId);
    if (bad) return refuse(bad);
  }
  return serial(itemId, () => {
    const cur = readItem(itemId) as WorkItem;
    const theirs = tagsOwnedBy(assigneeId).map((t) => t.tagId);
    return live(() => AdminOpsService.updateWork(Number(itemId), {
      rowVersion: cur.rowVersion,
      title,
      assignee: Number(assigneeId),
      priority: patch.priority !== undefined ? patch.priority : cur.priority,
      description: patch.description !== undefined ? patch.description || "" : cur.description || "",
      startDate: start,
      dueDate: due,
      parent: parentId ? Number(parentId) : null,
      tags: assigneeId !== cur.assigneeId ? (cur.tagIds || []).filter((t) => theirs.indexOf(t) >= 0).map(Number) : undefined,
    }), putItem);
  });
}

/** A new line has no id: the server mints it, which is what keeps every other
 *  line's id stable across the same write. */
export const addCheckLine = (itemId: string, text: string): Promise<Result<WorkItem>> =>
  withChecklist(itemId, (lines) => (text.trim()
    ? lines.concat([{ lineId: "", text: text.trim(), done: false }])
    : "Write the step first."));

export const toggleCheckLine = (itemId: string, lineId: string): Promise<Result<WorkItem>> =>
  withChecklist(itemId, (lines) => (lines.some((l) => l.lineId === lineId)
    ? lines.map((l) => (l.lineId === lineId ? { ...l, done: !l.done } : l))
    : "No such step."));

export const renameCheckLine = (itemId: string, lineId: string, text: string): Promise<Result<WorkItem>> =>
  withChecklist(itemId, (lines) => (!text.trim() ? "Write the step first."
    : lines.map((l) => (l.lineId === lineId ? { ...l, text: text.trim() } : l))));

export const removeCheckLine = (itemId: string, lineId: string): Promise<Result<WorkItem>> =>
  withChecklist(itemId, (lines) => lines.filter((l) => l.lineId !== lineId));

/** A URL ATTACHED TO ONE ITEM — `addLink` above relates two ITEMS instead.
 *  It normalises rather than refuses: a bare `docs.google.com/…` is https, and
 *  the name falls back to the host. The server holds the whole list. */
export function addResourceLink(itemId: string, label: string, url: string): Promise<Result<WorkItem>> {
  if (!readItem(itemId)) return Promise.resolve(err("item_not_found", "No such item."));
  if (!url.trim()) return Promise.resolve(err("validation_failed", "Paste the address."));
  const u = normaliseUrl(url);
  if (!u) return Promise.resolve(err("validation_failed", "That is not a web address — links have to be http or https."));
  return serial(itemId, () => {
    const i = readItem(itemId) as WorkItem;
    const links = (i.links || []).map((l) => ({ url: l.url, label: l.label }))
      .concat([{ url: u, label: label.trim() || hostOf(u) }]);
    return live(() => AdminOpsService.updateWork(Number(itemId), { rowVersion: i.rowVersion, links }), putItem);
  });
}

export function removeResourceLink(itemId: string, linkId: string): Promise<Result<WorkItem>> {
  if (!readItem(itemId)) return Promise.resolve(err("item_not_found", "No such item."));
  return serial(itemId, () => {
    const i = readItem(itemId) as WorkItem;
    const links = (i.links || []).filter((l) => l.linkId !== linkId).map((l) => ({ url: l.url, label: l.label }));
    return live(() => AdminOpsService.updateWork(Number(itemId), { rowVersion: i.rowVersion, links }), putItem);
  });
}

/** Creating an item. The create dialog posts through liveWork.ts; this is the
 *  same write for anything else that makes one. Steps become the task's
 *  checklist in a second write — the create route takes no extras. */
export async function createItem(input: Partial<WorkItem> & {
  title: string; assigneeId: string; kind: WorkKind; steps?: string[];
}): Promise<Result<WorkItem>> {
  if (!input.title.trim()) return err("validation_failed", "A title is required.");
  const badParent = parentError(input.kind, input.parentId);
  if (badParent) return err("invalid_parent", badParent);
  const made = await live(() => AdminOpsService.createWork({
    title: input.title.trim(), description: input.description || "", assignee: Number(input.assigneeId) || undefined,
    priority: input.priority || "medium", kind: input.kind, startDate: input.startDate || null, dueDate: input.dueDate || null,
    targetValue: input.kind === "target" ? input.targetValue ?? null : null,
    targetUnit: input.kind === "target" ? input.targetUnit || "" : "",
    tags: (input.tagIds || []).map(Number),
    links: (input.attachments || []).map((a) => ({ url: a.url, label: a.label })),
    parent: input.parentId ? Number(input.parentId) : undefined,
  }), putItem);
  const steps = (input.steps || []).map((t) => t.trim()).filter(Boolean);
  if (!made.ok || input.kind !== "task" || !steps.length) return made;
  /* The task exists either way: a checklist that would not save is not a
     reason to lose the task, so the refusal is swallowed and the item stands. */
  const withSteps = await setChecklist(made.data.itemId,
    steps.map((t) => ({ lineId: "", text: t, done: false })));
  return withSteps.ok ? withSteps : made;
}

/** ONE MORE LINE ON A PLAN ALREADY FILED — your own, and today's only: a past
 *  day's plan is what somebody meant that morning and stays as filed.
 *
 *  Same minting rule as `submitPlan`: a line matching an open task of theirs
 *  points at it, anything else becomes a task due today first, so the line the
 *  server stores points at work the board shows. */
export async function addPlanLine(memberId: string, title: string, priority: Priority = "medium"): Promise<Result<DailyPlan>> {
  if (memberId !== meId()) return err("not_own", "Only your own plan can be added to.");
  const plan = planFor(memberId, TODAY);
  if (!plan) return err("no_plan", "There is no plan for today to add to.");
  const t = title.trim();
  if (!t) return err("validation_failed", "Write the line first.");
  const workItem = await lineTask(memberId, t, priority);
  if (typeof workItem !== "number") return workItem;
  return live(() => AdminOpsService.addDailyPlanLine(Number(plan.planId), { title: t, priority, workItem }), (p) => {
    const next = toPlan(p);
    snap.plans = snap.plans.map((x) => (x.planId === next.planId ? next : x));
    return next;
  });
}

/** The task a plan line points at: one of the member's own open tasks with the
 *  same title, or a new task due today. A refusal comes back as the Refusal. */
async function lineTask(memberId: string, title: string, priority: Priority): Promise<number | Refusal> {
  const match = snap.items.filter((i) => i.assigneeId === memberId && !isTerminal(i.status)
    && i.title.trim().toLowerCase() === title.toLowerCase())[0];
  if (match) return Number(match.itemId);
  try {
    const made = await call(AdminOpsService.createWork({
      title, priority, kind: "task", startDate: TODAY, dueDate: TODAY }));
    putItem(made);
    return made.id;
  } catch (e) {
    void bootTeam(true);
    return err("refused", errMessage(e));
  }
}

/** A plan line is a real task. A line matching an open task of yours links to
 *  it; any other line becomes a task due today, made first, so the plan the
 *  server stores points at work the board shows. Your own plan only. */
export async function submitPlan(memberId: string, input: {
  lines: { title: string; priority: Priority }[];
  expectedOutcome?: string; blockers?: string;
}): Promise<Result<DailyPlan>> {
  if (memberId !== meId()) return err("not_own", "Only your own plan can be filed.");
  const existing = planFor(memberId, TODAY);
  if (existing && existing.submittedAt)
    return err("already_submitted", "Today's plan is in. Change the work items instead.");
  const lines = input.lines.filter((l) => l.title.trim());
  if (!lines.length) return err("validation_failed", "Add at least one line.");

  const built: { title: string; priority: Priority; workItem: number | null }[] = [];
  for (const l of lines) {
    const title = l.title.trim();
    const match = snap.items.filter((i) => i.assigneeId === memberId && !isTerminal(i.status)
      && i.title.trim().toLowerCase() === title.toLowerCase())[0];
    if (match) { built.push({ title, priority: l.priority, workItem: Number(match.itemId) }); continue; }
    try {
      const made = await call(AdminOpsService.createWork({
        title, priority: l.priority, kind: "task", startDate: TODAY, dueDate: TODAY }));
      putItem(made);
      built.push({ title, priority: l.priority, workItem: made.id });
    } catch (e) {
      void bootTeam(true);
      return err("refused", errMessage(e));
    }
  }
  return live(() => AdminOpsService.submitDailyPlan({
    businessDate: TODAY, expectedOutcome: input.expectedOutcome || "", blockers: input.blockers || "", lines: built,
  }), (p) => {
    const plan = toPlan(p);
    snap.plans = snap.plans.filter((x) => x.planId !== plan.planId).concat([plan]);
    return plan;
  });
}

/** Your own end-of-day report. The lines are what the board already says; the
 *  server stores them as written. */
export function submitReport(memberId: string, input: {
  lines: { workItemId: string | null; title: string; done: boolean; targetDelta?: number | null }[];
  pendingWork?: string; pendingReason?: string; achievement?: string;
  blockers?: string; supportNeeded?: string; tomorrowPriority?: string;
}): Promise<Result<DailyReport>> {
  if (memberId !== meId()) return Promise.resolve(err("not_own", "Only your own report can be filed."));
  const existing = reportFor(memberId, TODAY);
  if (existing && existing.submittedAt)
    return Promise.resolve(err("already_submitted", "Today's report is in."));
  if (input.lines.some((l) => !l.done) && !(input.pendingReason || "").trim())
    return Promise.resolve(err("validation_failed", "Say why the unticked lines did not get done."));
  return live(() => AdminOpsService.submitDailyReport({
    businessDate: TODAY,
    pendingWork: input.pendingWork || "", pendingReason: input.pendingReason || "", achievement: input.achievement || "",
    blockers: input.blockers || "", supportNeeded: input.supportNeeded || "", tomorrowPriority: input.tomorrowPriority || "",
    lines: input.lines.map((l) => ({
      title: l.title, done: l.done, targetDelta: l.targetDelta ?? null,
      workItem: l.workItemId ? Number(l.workItemId) : null })),
  }), (r) => {
    const report = toReport(r);
    snap.reports = snap.reports.filter((x) => x.reportId !== report.reportId).concat([report]);
    return report;
  });
}

/** Only the author's manager (per reportsTo) or a full-access user may mark a report read; never the author. */
export function canAcknowledge(memberId: string): boolean {
  if (memberId === meId()) return false;
  if (getSession()?.isFullAccess) return true;
  const m = readMember(memberId);
  return !!m && !!m.reportsTo && m.reportsTo === meId();
}

export function acknowledgeReport(reportId: string): Promise<Result<DailyReport>> {
  const r = snap.reports.filter((x) => x.reportId === reportId)[0];
  if (!r) return Promise.resolve(err("report_not_found", "No such report."));
  if (!r.submittedAt) return Promise.resolve(err("not_submitted", "A draft cannot be acknowledged."));
  if (r.acknowledgedById) return Promise.resolve(ok(r));
  return live(() => AdminOpsService.acknowledgeDailyReport(Number(reportId)), (x) => {
    const report = toReport(x);
    snap.reports = snap.reports.map((y) => (y.reportId === report.reportId ? report : y));
    return report;
  });
}

/* ============================================================== hooks === */

/** Exported for the Overview, which reads this store through the plain
 *  readers and needs only the subscription — the same arrangement Finance
 *  makes with its own `useVersion`. */
export const useVersion = () => useSyncExternalStore(subscribe, getVersion, getVersion);

export function useMembers(): Member[] { useVersion(); return snap.members; }
/** How the lists a page reads stand, for one member's page (see `loadOf`). */
export function useTeamLoad(lists: TeamList[], memberId?: string): LoadPart { useVersion(); return loadOf(lists, memberId); }
export function useMe(): Member | null { useVersion(); return readMember(meId()); }
export function useDayRows(date: string, scope: Scope): DayRow[] { useVersion(); return dayRows(date, scope); }
export function useWork(f: WorkFilter, scope: Scope): WorkItem[] { useVersion(); return workRows(f, scope); }
export function useItem(id: string | null): WorkItem | null { useVersion(); return id ? readItem(id) : null; }
export function useTags(): Tag[] { useVersion(); return snap.tags; }
export function useLeave(): LeaveRequest[] { useVersion(); return snap.leave; }
export function usePlans(): DailyPlan[] { useVersion(); return snap.plans; }
export function useReports(): DailyReport[] { useVersion(); return snap.reports; }
export function useAgreements(): Agreement[] { useVersion(); return snap.agreements; }
export function useDocuments(): MemberDocument[] { useVersion(); return snap.documents; }
export function useLinks(): WorkLink[] { useVersion(); return readLinks(); }
export function useItems(): WorkItem[] { useVersion(); return snap.items; }
export function useReview(date: string, scope: Scope): ReviewRow[] { useVersion(); return reviewRows(date, scope); }
export function useMyDay(date = TODAY): { day: AttendanceDay | null; state: AttendanceState; worked: number | null; breakMins: number } {
  useVersion();
  const m = readMember(meId());
  const day = dayFor(meId(), date);
  return { day, state: stateOf(day, m, now(), date), worked: workedOf(day, m), breakMins: breakOf(day) };
}
export function usePlan(memberId: string, date = TODAY): DailyPlan | null { useVersion(); return planFor(memberId, date); }
export function useReport(memberId: string, date = TODAY): DailyReport | null { useVersion(); return reportFor(memberId, date); }
