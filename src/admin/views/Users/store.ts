/* =============================================================================
   Users Management — the data module.
   -----------------------------------------------------------------------------
   THE ONLY FILE IN THIS MODULE THAT KNOWS WHERE ITS OWN RECORDS COME FROM.
   Every view imports from here; no view imports JSON. When the API lands, the
   five imports below become AdminOpsService calls and the write simulation
   underneath comes out — the views, the CSS and the URL scheme do not move.
   See src/proto/v-2.2.0.0/BACKEND-INTEGRATION.md.

   ONE VIEW FETCHES, AND IT IS DELIBERATE. The assignment dialog reads the plan
   catalogue live through the Plans module (`views/Plans/api`), because the
   catalogue is not this module's data — it is another module's, already served,
   and copying it here would be two sources of truth for one price. It does not
   route through this file for the same reason: this file owns the seed that
   becomes an endpoint, not somebody else's endpoint that already exists.
   Nothing else in the module reads it; a term freezes what it bought, so every
   list, record and chart renders with the catalogue unreachable.

   THE ONE RULE THIS FILE EXISTS TO ENFORCE
   ----------------------------------------
   Normal User, Active Member, Paused, Suspended and Former Member are NOT
   stored anywhere. There is no is_member column in users.json and there must
   never be one. `classify()` below is the single derivation, and the directory
   filter, the members view, the renewal queue and the analytics KPIs all call
   it. Two implementations of one definition disagree within a week; one
   implementation cannot.

   `NOW` is the seed's own `asOf` instant, not the browser clock. Every age,
   every expiring-soon window and every classification is computed against it,
   so the fixture reads the same tomorrow as it does today and a screenshot
   taken in November still makes sense. The API will send its own `asOf` and
   this stays the only place that decides what "now" means.
   ============================================================================= */
import { useSyncExternalStore } from "react";
import usersDoc from "../../../content/users/users.json";
import membershipsDoc from "../../../content/users/memberships.json";
import vocabDoc from "../../../content/users/vocabularies.json";
import analyticsDoc from "../../../content/users/analytics.json";
import auditDoc from "../../../content/users/audit.json";
import { getSession } from "../../auth/session";

/* ============================================================== types === */

export type Classification =
  | "normal" | "active_member" | "paused_member" | "suspended_member"
  | "former_member" | "deactivated";

export type MembershipStatus =
  "pending" | "active" | "paused" | "suspended" | "expired" | "cancelled";

export type LifecycleAction =
  "activate" | "pause" | "resume" | "suspend" | "reactivate" | "cancel" | "renew";

export interface UserProfile {
  profileId: string;
  schemaVersion: string;
  profileStatus: string;
  displayName: string | null;
  city: string | null;
  state: string | null;
  locality: string | null;
  pincode: string | null;
  about: string | null;
  businessName: string | null;
  category: string | null;
  services: string[];
  portfolioUrl: string | null;
  addressLine: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface UserTag { slug: string; assignedBy: string; assignedAt: string }
export interface UserNote {
  noteId: string; author: string; authorRole: string; at: string; text: string;
}

export interface PlatformUser {
  userId: string;
  authUserId: string;
  registrationSource: string;
  userStatus: "active" | "deactivated";
  registeredAt: string;
  deactivatedAt: string | null;
  deactivatedReason: string | null;
  lastActivityAt: string | null;
  identity: {
    name: string; email: string | null; emailVerified: boolean;
    phone: string | null; phoneVerified: boolean;
  };
  profile: UserProfile;
  tags: UserTag[];
  notes: UserNote[];
  commercial: { salesOwner: string | null; dealRefs: string[]; invoiceRefs: string[] };
  activeMembershipId: string | null;
}

export interface Entitlement { key: string; label: string; display: string }

export interface MembershipEvent {
  eventId: string;
  type: string;
  fromStatus: string | null;
  toStatus: string | null;
  actor: string;
  actorRole: string;
  reason: string | null;
  effectiveAt: string;
  note: string | null;
}

export interface Membership {
  membershipId: string;
  userId: string;
  termNo: number;
  /* WHAT WAS BOUGHT, FROZEN. `planId`/`planCode` are references back into the
     Plans catalogue for traceability; `planName` and `cycle` are the snapshot,
     so a term renders correctly after the plan is repriced, renamed or
     archived — and renders at all when the catalogue cannot be reached. */
  planId: string;
  planCode: string;
  planName: string;
  cycle: { months: number; price: number; currency: string };
  previousMembershipId: string | null;
  source: { kind: string; reference: string | null; label: string; note: string | null };
  startAt: string;
  endAt: string;
  status: MembershipStatus;
  activatedAt: string | null;
  pausedAt: string | null;
  resumedAt: string | null;
  suspendedAt: string | null;
  cancelledAt: string | null;
  expiredAt: string | null;
  createdBy: string;
  createdAt: string;
  entitlements: Entitlement[];
  /** Present only while a term is Pending: the plan features read from the live
   *  catalogue when the term was raised, waiting to be frozen at activation.
   *  Parked on the term so activation never has to reach for a catalogue that
   *  may have moved — or be unreachable — by the time somebody presses it. */
  pendingFeatures?: Entitlement[];
  events: MembershipEvent[];
}

export interface AuditEvent {
  eventId: string; userId: string; type: string;
  actor: string; actorRole: string; at: string; note: string | null;
}


/** The row the directory renders: the stored user plus everything derived. */
export interface UserRow {
  user: PlatformUser;
  classification: Classification;
  current: Membership | null;
  history: Membership[];
  /** True only while an Active term is inside the configured renewal window. */
  expiringSoon: boolean;
  daysToEnd: number | null;
  everMember: boolean;
  completeness: number;
  missingFields: string[];
}

export type Params = Record<string, string | undefined>;

/* ========================================================= vocabulary === */
/* Read once and re-exported as plain constants: these are STATIC COPY, not
   placeholder records, so nothing here becomes backend work. Only the labels
   and cautions live in the file — the behaviour lives in this module. */

export const VOCAB = vocabDoc;
export const CLASSIFICATIONS = vocabDoc.classifications;
export const MEMBERSHIP_STATUSES = vocabDoc.membershipStatuses;
export const TRANSITIONS = vocabDoc.transitions;
export const LIFECYCLE_ACTIONS = vocabDoc.lifecycleActions;
export const ACTIVATION_SOURCES = vocabDoc.activationSources;
export const REGISTRATION_SOURCES = vocabDoc.registrationSources;
export const PROFILE_FIELDS = vocabDoc.profileFields;
export const TAGS = vocabDoc.tags;
export const CITIES = vocabDoc.cities;
export const REGISTERED_RANGES = vocabDoc.registeredRanges;
export const SORT_OPTIONS = vocabDoc.sortOptions;
export const METRICS = vocabDoc.metricDefinitions;
export const OPEN_DECISIONS = vocabDoc.openDecisions;
export const RENEWAL_WINDOW_DAYS = vocabDoc.renewalWindowDays;
export const PROFILE_SCHEMA_VERSION = vocabDoc.profileSchemaVersion;
export const ANALYTICS = analyticsDoc;
export const PAUSE_POLICY = membershipsDoc.pausePolicy;
/* Plan display names for the ANALYTICS series only, and they travel with that
   payload rather than being looked up in the catalogue. Analytics is a
   historical series: a plan renamed or archived last quarter still has months
   attributed to it, and a lookup would leave those months labelled with a raw
   key or nothing at all. */
export const PLAN_LABELS = ANALYTICS.planLabels as Record<string, string>;

export const classificationMeta = (k: Classification) =>
  CLASSIFICATIONS.filter((c) => c.key === k)[0] || CLASSIFICATIONS[0];
export const membershipMeta = (k: string) =>
  MEMBERSHIP_STATUSES.filter((s) => s.key === k)[0] || null;
export const sourceMeta = (k: string) =>
  ACTIVATION_SOURCES.filter((s) => s.key === k)[0] || null;
export const tagMeta = (slug: string) =>
  TAGS.filter((t) => t.slug === slug)[0] || null;
export const metricMeta = (key: string) =>
  METRICS.filter((m) => m.key === key)[0] || null;
export const decision = (id: string) =>
  OPEN_DECISIONS.filter((d) => d.id === id)[0] || null;
/* THE CATALOGUE IS NOT OURS. Plans and their billing cycles live in the Plans
   module and are read from `v1/admin/plans/` — the same Subscription rows the
   buyer is charged from. This module used to carry its own copy, which is two
   sources of truth for one price and the exact thing UM-OD-01 asked about; the
   answer is consume, never define.
   The only plan facts here are the ones FROZEN ON A TERM, so nothing on a
   record or in the analytics needs the catalogue to render. Assignment and
   renewal are the two places that do, and they read it live.
   Filter options come from the terms that exist rather than from a hardcoded
   list, so the dropdown can never offer a plan nobody holds. */
export function plansInUse(all: Membership[]): { code: string; name: string }[] {
  const out: { code: string; name: string }[] = [];
  all.forEach((m) => {
    if (!out.some((x) => x.code === m.planCode)) out.push({ code: m.planCode, name: m.planName });
  });
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
export function usePlansInUse(): { code: string; name: string }[] {
  useVersion();
  return plansInUse(snap.memberships);
}

/* ============================================================== clock === */

export const NOW = new Date(usersDoc.asOf).getTime();
export const DAY = 86400000;

export const daysBetween = (a: number, b: number) => Math.round((b - a) / DAY);
export const ts = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : NaN);

/* ============================================================== state === */
/* One mutable snapshot for this browser tab. Every write below replaces the
   arrays it touches and bumps `version`, which is what useSyncExternalStore
   subscribes to. Nothing is persisted: a reload restores the seed, and the
   proto banner on every screen says so. */

type Snapshot = { users: PlatformUser[]; memberships: Membership[]; audit: AuditEvent[]; version: number };

const seed = (): Snapshot => ({
  users: JSON.parse(JSON.stringify(usersDoc.users)) as PlatformUser[],
  memberships: JSON.parse(JSON.stringify(membershipsDoc.memberships)) as Membership[],
  audit: JSON.parse(JSON.stringify(auditDoc.events)) as AuditEvent[],
  version: 0,
});

let snap: Snapshot = seed();
const listeners = new Set<() => void>();
const emit = () => { snap = { ...snap, version: snap.version + 1 }; listeners.forEach((l) => l()); };

const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const getVersion = () => snap.version;

/** Re-seed. Local scaffolding only — it exists so a demo can be walked twice. */
export function resetStore() { snap = seed(); emit(); }

/* Plain readers over the same snapshot the hooks subscribe to. They exist so
   the check suite can assert the write simulation without pretending to be
   React — scripts/check-users-derivation.cjs calls exactly these, so what it
   asserts is what the screens see and not a parallel reimplementation of it. */
export const readUsers = (): PlatformUser[] => snap.users;
export const readMemberships = (): Membership[] => snap.memberships;
export const readAudit = (): AuditEvent[] => snap.audit;
export const readMembership = (id: string): Membership | null =>
  snap.memberships.filter((m) => m.membershipId === id)[0] || null;
export const readUser = (id: string): PlatformUser | null =>
  snap.users.filter((u) => u.userId === id)[0] || null;

/** Who the simulated write is attributed to. The session name, never a guess. */
export function actor(): { name: string; role: string } {
  const s = getSession();
  return { name: s?.user?.name || "You", role: s?.role || "Operations" };
}

let seq = 0;
const nextId = (prefix: string) => prefix + "-" + (Date.now().toString(36) + (seq++).toString(36)).toUpperCase();

/* ========================================================= derivation === */

/** Every term this user has ever held, newest term first. */
export function historyOf(userId: string, all: Membership[]): Membership[] {
  return all.filter((m) => m.userId === userId).sort((a, b) => ts(b.startAt) - ts(a.startAt));
}

/** Is this term entitling right now? Active AND inside its own dates. A term
 *  marked Active whose end date has passed is NOT entitling — the expiry sweep
 *  simply has not run yet, and pretending otherwise is how an Active Member
 *  count outlives the memberships behind it. */
export function isEntitling(m: Membership | null): boolean {
  if (!m || m.status !== "active") return false;
  return ts(m.startAt) <= NOW && NOW <= ts(m.endAt);
}

const LIVE: MembershipStatus[] = ["active", "paused", "suspended", "pending"];

/** THE term the record screen leads with: the newest non-terminal one, and
 *  failing that the newest terminal one so a former member's card still says
 *  what they last held. */
export function currentTerm(history: Membership[]): Membership | null {
  const live = history.filter((m) => LIVE.indexOf(m.status) >= 0);
  return live[0] || history[0] || null;
}

/** THE ONE DERIVATION. Read the doc block at the top of this file before
 *  adding a second one anywhere.
 *
 *  Order matters. Account status is checked first because Deactivated is not a
 *  membership classification at all — it is a fact about the account, and a
 *  deactivated user who still holds a paid term is Deactivated on the screen
 *  and keeps the term in their history.
 *
 *  A user whose only membership is Pending is a NORMAL USER, not a former
 *  member: nothing has ever entitled them. That is why the test below is
 *  `activatedAt`, not `history.length`. */
export function classify(user: PlatformUser, history: Membership[]): Classification {
  if (user.userStatus === "deactivated") return "deactivated";
  const cur = currentTerm(history);
  if (isEntitling(cur)) return "active_member";
  if (cur && cur.status === "paused") return "paused_member";
  if (cur && cur.status === "suspended") return "suspended_member";
  if (history.some((m) => !!m.activatedAt)) return "former_member";
  return "normal";
}

/** Completeness against the profile schema in force, plus WHICH fields are
 *  missing — a percentage nobody can act on is a worse number than a list. */
export function completenessOf(p: UserProfile): { pct: number; missing: string[] } {
  const required = PROFILE_FIELDS.filter((f) => f.required);
  const missing: string[] = [];
  required.forEach((f) => {
    const v = (p as unknown as Record<string, unknown>)[f.key];
    const empty = v === null || v === undefined || v === ""
      || (Array.isArray(v) && v.length === 0);
    if (empty) missing.push(f.label);
  });
  const pct = required.length
    ? Math.round(((required.length - missing.length) / required.length) * 100)
    : 100;
  return { pct, missing };
}

export function toRow(user: PlatformUser, all: Membership[]): UserRow {
  const history = historyOf(user.userId, all);
  const current = currentTerm(history);
  const classification = classify(user, history);
  const entitling = isEntitling(current);
  const daysToEnd = current && current.status !== "expired" && current.status !== "cancelled"
    ? daysBetween(NOW, ts(current.endAt))
    : null;
  const { pct, missing } = completenessOf(user.profile);
  return {
    user,
    classification,
    current,
    history,
    expiringSoon: entitling && daysToEnd !== null && daysToEnd >= 0 && daysToEnd <= RENEWAL_WINDOW_DAYS,
    daysToEnd,
    everMember: history.some((m) => !!m.activatedAt),
    completeness: pct,
    missingFields: missing,
  };
}

/** Recently expired or cancelled inside the same window the queue works to. */
export function recentlyEnded(r: UserRow): boolean {
  const m = r.current;
  if (!m) return false;
  const at = m.status === "expired" ? ts(m.expiredAt || m.endAt)
    : m.status === "cancelled" ? ts(m.cancelledAt || m.endAt) : NaN;
  if (isNaN(at)) return false;
  const d = daysBetween(at, NOW);
  return d >= 0 && d <= RENEWAL_WINDOW_DAYS;
}

/* ============================================================ filters === */

const norm = (s: unknown) => String(s ?? "").toLowerCase();
const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");

function matchesSearch(r: UserRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const d = digits(needle);
  const u = r.user;
  const hay = [
    u.userId, u.identity.name, u.identity.email, u.profile.displayName,
    u.profile.businessName, u.profile.city, u.profile.locality,
    r.current ? r.current.membershipId : "", r.current ? r.current.planName : "",
    ...u.commercial.dealRefs, ...u.commercial.invoiceRefs,
  ].map(norm).join(" ");
  if (hay.indexOf(needle) >= 0) return true;
  /* Phone matched on the LAST TEN DIGITS, so "+91 98450 11902", "9845011902"
     and "98450 11902" are one number. Formatting must never defeat a lookup
     somebody is doing while the customer is on the line. */
  return d.length >= 4 && digits(u.identity.phone).slice(-10).indexOf(d.slice(-10)) >= 0;
}

function inRegisteredRange(r: UserRow, p: Params): boolean {
  const key = p.registered;
  if (!key) return true;
  const at = ts(r.user.registeredAt);
  if (key === "custom") {
    const from = p.from ? new Date(p.from + "T00:00:00").getTime() : -Infinity;
    const to = p.to ? new Date(p.to + "T23:59:59").getTime() : Infinity;
    return at >= from && at <= to;
  }
  const days = key === "today" ? 1 : key === "7d" ? 7 : key === "30d" ? 30 : key === "90d" ? 90 : 366;
  return daysBetween(at, NOW) <= days;
}

export function applyFilters(rows: UserRow[], p: Params): UserRow[] {
  return rows.filter((r) => {
    if (p.q && !matchesSearch(r, p.q)) return false;
    if (p.cls && r.classification !== p.cls) return false;
    if (p.ms && (!r.current || r.current.status !== p.ms)) return false;
    if (p.plan && (!r.current || r.current.planCode !== p.plan)) return false;
    if (p.city && r.user.profile.city !== p.city) return false;
    if (p.src && r.user.registrationSource !== p.src) return false;
    if (p.tag && !r.user.tags.some((t) => t.slug === p.tag)) return false;
    if (p.status && r.user.userStatus !== p.status) return false;
    if (p.flag === "expiring" && !r.expiringSoon) return false;
    if (p.flag === "ended" && !recentlyEnded(r)) return false;
    if (p.flag === "pending" && (!r.current || r.current.status !== "pending")) return false;
    if (p.flag === "incomplete" && r.completeness >= 100) return false;
    if (!inRegisteredRange(r, p)) return false;
    return true;
  });
}

/** Default order answers "what needs doing": pending activations, then terms
 *  about to end, then everything by newest registration. A list that opens on
 *  alphabetical order makes somebody sort it before they can start. */
function attentionScore(r: UserRow): number {
  if (r.current && r.current.status === "pending") return 0;
  if (r.expiringSoon) return 1;
  if (r.current && r.current.status === "suspended") return 2;
  if (r.current && r.current.status === "paused") return 3;
  if (recentlyEnded(r)) return 4;
  if (r.completeness < 100 && r.classification === "normal") return 5;
  return 6;
}

export function applySort(rows: UserRow[], sort: string | undefined): UserRow[] {
  const out = rows.slice();
  if (sort === "recent") return out.sort((a, b) => ts(b.user.registeredAt) - ts(a.user.registeredAt));
  if (sort === "activity") return out.sort((a, b) => ts(b.user.lastActivityAt) - ts(a.user.lastActivityAt));
  if (sort === "name") return out.sort((a, b) => a.user.identity.name.localeCompare(b.user.identity.name));
  if (sort === "ending") {
    return out.sort((a, b) => {
      const av = a.daysToEnd === null ? Infinity : a.daysToEnd;
      const bv = b.daysToEnd === null ? Infinity : b.daysToEnd;
      return av - bv;
    });
  }
  return out.sort((a, b) =>
    attentionScore(a) - attentionScore(b) || ts(b.user.registeredAt) - ts(a.user.registeredAt));
}

export const PAGE_SIZE = 12;

export interface Page { rows: UserRow[]; total: number; pageNo: number; pageSize: number; pages: number }

export function paginate(rows: UserRow[], pageNo: number): Page {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const n = Math.min(Math.max(1, pageNo), pages);
  return {
    rows: rows.slice((n - 1) * PAGE_SIZE, n * PAGE_SIZE),
    total: rows.length, pageNo: n, pageSize: PAGE_SIZE, pages,
  };
}

/* ============================================================= counts === */

export interface Counts {
  total: number;
  normal: number;
  activeMembers: number;
  paused: number;
  suspended: number;
  formerMembers: number;
  deactivated: number;
  pending: number;
  expiringSoon: number;
  recentlyEnded: number;
  incompleteProfiles: number;
  everMembers: number;
  /** Registered-to-member conversion over THIS population, stated as a share of
   *  users who have ever activated a membership. It is a lifetime figure and is
   *  labelled as one — the windowed cohort version lives in analytics.json. */
  conversion: number | null;
  byPlan: { code: string; label: string; n: number }[];
  byStatus: { key: string; label: string; n: number }[];
}

export function countsOf(rows: UserRow[]): Counts {
  const c = (fn: (r: UserRow) => boolean) => rows.filter(fn).length;
  const eligible = rows.filter((r) => r.user.userStatus !== "deactivated");
  const ever = eligible.filter((r) => r.everMember).length;
  /* From the plans people actually hold, not from a catalogue this module does
     not own. A plan nobody holds simply has no bar, which is the truth. */
  const byPlan = plansInUse(rows.map((r) => r.current).filter(Boolean) as Membership[]).map((p) => ({
    code: p.code,
    label: p.name,
    n: rows.filter((r) => isEntitling(r.current) && r.current?.planCode === p.code).length,
  }));
  const byStatus = MEMBERSHIP_STATUSES.map((s) => ({
    key: s.key,
    label: s.label,
    n: rows.filter((r) => r.current && r.current.status === s.key).length,
  }));
  return {
    total: rows.length,
    normal: c((r) => r.classification === "normal"),
    activeMembers: c((r) => r.classification === "active_member"),
    paused: c((r) => r.classification === "paused_member"),
    suspended: c((r) => r.classification === "suspended_member"),
    formerMembers: c((r) => r.classification === "former_member"),
    deactivated: c((r) => r.classification === "deactivated"),
    pending: c((r) => !!r.current && r.current.status === "pending"),
    expiringSoon: c((r) => r.expiringSoon),
    recentlyEnded: c(recentlyEnded),
    incompleteProfiles: c((r) => r.completeness < 100),
    everMembers: ever,
    /* NULL, NOT ZERO, on an empty denominator. A dashboard that prints 0%
       because nobody has registered yet has told somebody something false. */
    conversion: eligible.length ? ever / eligible.length : null,
    byPlan,
    byStatus,
  };
}

/* ============================================================== hooks === */

function useVersion() { return useSyncExternalStore(subscribe, getVersion, getVersion); }

export function useAllRows(): UserRow[] {
  useVersion();
  return snap.users.map((u) => toRow(u, snap.memberships));
}

export function useUserRow(id: string | null): UserRow | null {
  useVersion();
  if (!id) return null;
  const u = snap.users.filter((x) => x.userId === id)[0];
  return u ? toRow(u, snap.memberships) : null;
}

export function useMembership(id: string | null): Membership | null {
  useVersion();
  if (!id) return null;
  return snap.memberships.filter((m) => m.membershipId === id)[0] || null;
}

/** The record's timeline: the account's own audit rows merged with the
 *  lifecycle events of every term it has held, newest first. Two streams, one
 *  reading — merged here rather than duplicated into a third table. */
export function useTimeline(userId: string | null): (AuditEvent & { membershipId?: string })[] {
  useVersion();
  if (!userId) return [];
  const own: (AuditEvent & { membershipId?: string })[] =
    snap.audit.filter((e) => e.userId === userId);
  const fromTerms = snap.memberships
    .filter((m) => m.userId === userId)
    .flatMap((m) => m.events.map((e) => ({
      eventId: e.eventId, userId, type: e.type, actor: e.actor, actorRole: e.actorRole,
      at: e.effectiveAt,
      note: [e.reason ? "Reason: " + e.reason : null, e.note].filter(Boolean).join(" — ") || null,
      membershipId: m.membershipId,
    })));
  return own.concat(fromTerms).sort((a, b) => ts(b.at) - ts(a.at));
}

/** The module-wide audit slice Analytics shows: the same two streams across
 *  every user, most recent first. */
export function useRecentActivity(limit: number): (AuditEvent & { userName: string })[] {
  useVersion();
  const nameOf = (id: string) => {
    const u = snap.users.filter((x) => x.userId === id)[0];
    return u ? u.identity.name : id;
  };
  const own = snap.audit.map((e) => ({ ...e, userName: nameOf(e.userId) }));
  const fromTerms = snap.memberships.flatMap((m) => m.events.map((e) => ({
    eventId: e.eventId, userId: m.userId, type: e.type, actor: e.actor,
    actorRole: e.actorRole, at: e.effectiveAt,
    note: [e.reason ? "Reason: " + e.reason : null, e.note].filter(Boolean).join(" — ") || null,
    userName: nameOf(m.userId),
  })));
  return own.concat(fromTerms).sort((a, b) => ts(b.at) - ts(a.at)).slice(0, limit);
}

/* ============================================================= writes ===
   EVERY FUNCTION BELOW IS A SIMULATION and the screens say so. Each one is
   named for the transaction it stands in for (UM-T01..UM-T07) and does the
   same sequence in the same order, so the endpoint that replaces it has a
   worked example rather than a guess. Nothing here writes money, nothing here
   touches a staff role, and nothing here rewrites a terminal term. */

const findUser = (id: string) => snap.users.filter((u) => u.userId === id)[0] || null;
const findMembership = (id: string) => snap.memberships.filter((m) => m.membershipId === id)[0] || null;

function pushAudit(userId: string, type: string, note: string) {
  const a = actor();
  /* Typed explicitly rather than inferred from the literal: without the
     annotation TS narrows `note` to `string` and then refuses to concat the
     seeded rows, whose note is nullable. The annotation is the fix; widening
     the seed's type to match the literal would have been the bug. */
  const row: AuditEvent = {
    eventId: nextId("AU"), userId, type,
    actor: a.name, actorRole: a.role, at: new Date().toISOString(), note,
  };
  snap.audit = [row].concat(snap.audit);
}

function pushMembershipEvent(m: Membership, type: string, from: MembershipStatus | null,
  to: MembershipStatus | null, reason: string | null, note: string) {
  const a = actor();
  const row: MembershipEvent = {
    eventId: nextId("EV"), type, fromStatus: from, toStatus: to,
    actor: a.name, actorRole: a.role, reason, effectiveAt: new Date().toISOString(), note,
  };
  m.events = [row].concat(m.events);
}

/** UM-T07 · Profile update. Validate → apply → recompute completeness → audit
 *  the CHANGED FIELD SET. A correction nobody can see is worse than none, so
 *  the diff goes into the audit note and the note text never does. */
export function updateProfile(userId: string, patch: Partial<UserProfile>): string {
  const u = findUser(userId);
  if (!u) return "That user no longer exists.";
  const changed: string[] = [];
  (Object.keys(patch) as (keyof UserProfile)[]).forEach((k) => {
    const before = JSON.stringify(u.profile[k] ?? null);
    const after = JSON.stringify(patch[k] ?? null);
    if (before !== after) changed.push(String(k));
  });
  if (!changed.length) return "";
  const a = actor();
  u.profile = { ...u.profile, ...patch, updatedBy: a.name, updatedAt: new Date().toISOString() };
  const { pct } = completenessOf(u.profile);
  u.profile.profileStatus = pct >= 100 ? "published" : "incomplete";
  const labels = changed.map((k) => {
    const f = PROFILE_FIELDS.filter((x) => x.key === k)[0];
    return f ? f.label : k;
  });
  pushAudit(userId, "PROFILE_UPDATED", "Admin edit: " + labels.join(", ") + ".");
  snap.users = snap.users.slice();
  emit();
  return "";
}

/** UM-T12 · Internal note. Append-only; there is no edit and no delete, here
 *  or in the API this stands in for. A note somebody later softened is worth
 *  less than one nobody can change. */
export function addNote(userId: string, text: string): string {
  const u = findUser(userId);
  if (!u) return "That user no longer exists.";
  if (!text.trim()) return "A note needs some text.";
  const a = actor();
  u.notes = [{
    noteId: nextId("NT"), author: a.name, authorRole: a.role,
    at: new Date().toISOString(), text: text.trim(),
  }].concat(u.notes);
  /* The FACT, never the text. This timeline is the one surface a
     business-scoped read could plausibly reach one day (UM-BR-17). */
  pushAudit(userId, "NOTE", "Internal note added. Text is deliberately not logged.");
  snap.users = snap.users.slice();
  emit();
  return "";
}

export function setTags(userId: string, slugs: string[]): string {
  const u = findUser(userId);
  if (!u) return "That user no longer exists.";
  const a = actor();
  const before = u.tags.map((t) => t.slug);
  const added = slugs.filter((s) => before.indexOf(s) < 0);
  const removed = before.filter((s) => slugs.indexOf(s) < 0);
  if (!added.length && !removed.length) return "";
  u.tags = slugs.map((s) => {
    const kept = u.tags.filter((t) => t.slug === s)[0];
    return kept || { slug: s, assignedBy: a.name, assignedAt: new Date().toISOString() };
  });
  pushAudit(userId, "TAGGED", [
    added.length ? "Added " + added.join(", ") : null,
    removed.length ? "Removed " + removed.join(", ") : null,
  ].filter(Boolean).join(". ") + ".");
  snap.users = snap.users.slice();
  emit();
  return "";
}

/** What the form hands over. The plan and the cycle arrive WHOLE rather than as
 *  ids to look up, because the catalogue belongs to the Plans module and this
 *  function must not reach for it — everything needed to freeze the term comes
 *  in with the request. That is also the shape the endpoint takes: the server
 *  resolves the ids and freezes the same fields. */
export interface AssignInput {
  planId: string;
  planCode: string;
  planName: string;
  /** The billing cycle: the DURATION actually bought, and its price. */
  cycle: { months: number; price: number; currency: string };
  /** The plan features as they read today, captured now and frozen at
   *  activation. */
  features: Entitlement[];
  source: string;
  reference: string;
  reason: string;
  startAt: string;
  endAt: string;
  activateNow: boolean;
}

/** UM-T02 · Assignment (+ UM-T03 when `activateNow`). Verify authority →
 *  validate plan version, dates, source and reason → refuse an overlapping
 *  active term → create at Pending Activation → append ASSIGNED.
 *
 *  The overlap refusal is the interesting one: it is the client half of
 *  409 active_membership_conflict, and it exists here so the operator is told
 *  BEFORE they fill the form in, not after they submit it. */
export function assignMembership(userId: string, input: AssignInput): { error: string; membershipId: string | null } {
  const u = findUser(userId);
  if (!u) return { error: "That user no longer exists.", membershipId: null };
  if (!input.planId || !input.planName) return { error: "Pick a plan.", membershipId: null };
  if (!input.cycle || !input.cycle.months) return { error: "Pick a duration.", membershipId: null };
  const src = sourceMeta(input.source);
  if (!src) return { error: "Pick a source.", membershipId: null };
  if (src.requiresReference && !input.reference.trim())
    return { error: src.referenceLabel + " is required for a " + src.label.toLowerCase() + ".",
      membershipId: null };
  if (src.requiresReason && !input.reason.trim())
    return { error: "A complimentary grant needs a stated reason.", membershipId: null };
  if (ts(input.endAt) <= ts(input.startAt))
    return { error: "The end date has to be after the start date.", membershipId: null };

  const history = historyOf(userId, snap.memberships);
  /* MATCHED ON planCode, NOT planId, and the two are not interchangeable.
     `planId` is the catalogue's own key and moves with it — a term raised
     before a migration, or against a plan that has since been replaced, holds
     an id nothing will match again. `planCode` is derived from the plan's
     family or title and is what this module groups, filters and reports by,
     so it is what "one entitlement per product" has to mean.

     It is also what the FORM checks. They disagreed for one commit: the dialog
     warned on planCode while this refused on planId, so the warning could show
     with the save going through, or the save could be refused with nothing on
     screen explaining why. One key, both places. */
  const clash = clashFor(history, input.planCode) ? [clashFor(history, input.planCode)] : [];
  if (clash.length)
    return {
      error: "There is already a live " + input.planName + " term (" + clash[0]!.membershipId
        + "). One active entitlement per product — end that one first.",
      membershipId: null,
    };

  const a = actor();
  const id = nextId("IB-MB");
  const m: Membership = {
    membershipId: id, userId, termNo: history.length + 1,
    planId: input.planId, planCode: input.planCode, planName: input.planName,
    cycle: input.cycle,
    previousMembershipId: history[0] ? history[0].membershipId : null,
    source: {
      kind: input.source,
      reference: input.reference.trim() || null,
      label: src.label + (input.reference.trim() ? " " + input.reference.trim() : ""),
      note: input.reason.trim() || null,
    },
    startAt: input.startAt, endAt: input.endAt,
    status: "pending",
    activatedAt: null, pausedAt: null, resumedAt: null,
    suspendedAt: null, cancelledAt: null, expiredAt: null,
    createdBy: a.name, createdAt: new Date().toISOString(),
    /* EMPTY UNTIL ACTIVATION. The snapshot is taken when the entitlement goes
       live, not when the record is raised — see UM-T03 below. What WILL be
       frozen is parked on the term now, read from the live catalogue at the
       moment the operator chose the plan, so activation never has to reach for
       a catalogue that may have moved or be unreachable by then. */
    entitlements: [],
    pendingFeatures: input.features.map((f) => ({ ...f })),
    events: [],
  };
  pushMembershipEvent(m, "MEMBERSHIP_ASSIGNED", null, "pending", input.reason.trim() || null,
    "Created against " + input.planName + ", " + input.cycle.months + " months. Source: "
    + src.label + ". No revenue was created by this record.");
  snap.memberships = [m].concat(snap.memberships);
  pushAudit(userId, "MEMBERSHIP_ASSIGNED",
    input.planName + " assigned at Pending Activation. Source: " + src.label + ".");
  emit();
  if (input.activateNow) {
    const err = lifecycle(id, "activate", "");
    if (err) return { error: err, membershipId: id };
  }
  return { error: "", membershipId: id };
}

/** action key → the event type it appends. Every value here must exist in
 *  `eventTypes[]` in vocabularies.json, because that is where the row gets its
 *  label and its tone. */
const EVENT_OF: Record<LifecycleAction, string> = {
  activate: "MEMBERSHIP_ACTIVATED",
  pause: "MEMBERSHIP_PAUSED",
  resume: "MEMBERSHIP_RESUMED",
  suspend: "MEMBERSHIP_SUSPENDED",
  reactivate: "MEMBERSHIP_REACTIVATED",
  cancel: "MEMBERSHIP_CANCELLED",
  renew: "MEMBERSHIP_RENEWED",
};

/** Whether an action is on the matrix for this term. The buttons read from
 *  this, so a control that is on screen is a control the transition allows —
 *  and the ones that are not simply are not rendered. */
export function allowedActions(m: Membership | null): typeof LIFECYCLE_ACTIONS {
  if (!m) return [];
  return LIFECYCLE_ACTIONS.filter((a) => a.from.indexOf(m.status) >= 0);
}

/** UM-T03 / UM-T04 / UM-T06 · Every guarded lifecycle move, in one place, so
 *  the matrix is applied once. Lock → validate the transition → apply → append
 *  the event with actor and reason → recompute what the classification derives
 *  from. An off-matrix move changes nothing and returns the refusal text the
 *  API would 422 with. */
export function lifecycle(membershipId: string, action: LifecycleAction, reason: string): string {
  const m = findMembership(membershipId);
  if (!m) return "That membership no longer exists.";
  const spec = LIFECYCLE_ACTIONS.filter((a) => a.key === action)[0];
  if (!spec) return "Unknown action.";
  if (spec.from.indexOf(m.status) < 0)
    return "A " + (membershipMeta(m.status)?.label || m.status).toLowerCase()
      + " term cannot be " + spec.label.toLowerCase() + "d. (invalid_membership_transition)";
  if (spec.requiresReason && !reason.trim())
    return "This action needs a reason. (reason_required)";

  const u = findUser(m.userId);
  const from = m.status;
  const stamp = new Date().toISOString();

  if (action === "renew") {
    /* A RENEWAL IS A NEW ROW. The previous term is not touched — not its
       status, not its dates, not its snapshot — which is the whole reason
       renewal rate and lifetime value can be reconstructed at all. */
    /* SAME PLAN, SAME DURATION, carried forward from the term being renewed.
       It used to re-read the catalogue and quietly move the member onto the
       current price — a commercial decision this button must not take on
       somebody behalf, and not one this module can take at all now the
       catalogue belongs to Plans. Moving a member to a different plan or a
       different duration is an assignment, not a renewal. */
    const months = m.cycle.months || 12;
    const start = new Date(Math.max(ts(m.endAt), NOW));
    const end = new Date(start.getTime());
    end.setMonth(end.getMonth() + months);
    const a = actor();
    const id = nextId("IB-MB");
    const next: Membership = {
      ...m,
      membershipId: id,
      termNo: m.termNo + 1,
      previousMembershipId: m.membershipId,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      status: "active",
      activatedAt: stamp,
      pausedAt: null, resumedAt: null, suspendedAt: null, cancelledAt: null, expiredAt: null,
      createdBy: a.name, createdAt: stamp,
      entitlements: m.entitlements.map((e) => ({ ...e })),
      events: [],
    };
    pushMembershipEvent(next, "MEMBERSHIP_RENEWED", null, "active", reason.trim() || null,
      "Renewal of " + m.membershipId + " on the same plan and the same " + months
      + "-month duration. The previous term is unchanged and stays in the history.");
    snap.memberships = [next].concat(snap.memberships);
    if (u) u.activeMembershipId = id;
    pushAudit(m.userId, "MEMBERSHIP_RENEWED",
      "New term " + id + " created from " + m.membershipId + ". Not counted as a new member.");
    snap.users = snap.users.slice();
    emit();
    return "";
  }

  const to = spec.to as MembershipStatus;
  if (action === "activate") {
    /* THE SNAPSHOT IS THE GUARD. What to freeze was captured from the live
       catalogue when the term was raised and parked on it; activation moves it
       into `entitlements`, where it stops changing. Nothing is looked up here,
       so a repriced, renamed, archived or unreachable plan cannot change what
       a member was sold. */
    const pending = m.pendingFeatures || [];
    if (!pending.length)
      return "There is nothing to freeze against this term — the plan features were not captured "
        + "when it was raised. It stays Pending Activation rather than going live with access "
        + "nobody can enumerate.";
    m.entitlements = pending.map((e) => ({ ...e }));
    delete m.pendingFeatures;
    m.activatedAt = stamp;
  }
  if (action === "pause") m.pausedAt = stamp;
  if (action === "resume") m.resumedAt = stamp;
  if (action === "suspend") m.suspendedAt = stamp;
  if (action === "cancel") m.cancelledAt = stamp;
  m.status = to;

  const noteFor: Record<string, string> = {
    activate: "Entitlements frozen from " + m.planName + ", " + m.cycle.months + " months.",
    pause: "Temporary and resumable. The end date is unchanged because the pause policy in force is "
      + PAUSE_POLICY + " — UM-OD-04 is still open.",
    resume: "Entitlements restored. Dates were not moved, per the " + PAUSE_POLICY + " pause policy.",
    suspend: "Entitlements withheld. The account itself is untouched — what stays reachable while "
      + "suspended is UM-OD-05 and undecided.",
    reactivate: "Restriction lifted; entitlements restored.",
    cancel: "Term terminated. Refund handling belongs to Finance — no money moved here.",
  };
  /* SPELT OUT, not derived from the action name. Deriving it produced
     MEMBERSHIP_CANCELED with one L — a key that matches nothing in the
     vocabulary, so the row would have rendered with no label and no tone. An
     event type is a contract with the API; it is not a string transform. */
  pushMembershipEvent(m, EVENT_OF[action], from, to, reason.trim() || null, noteFor[action] || "");
  if (u) u.activeMembershipId = LIVE.indexOf(to) >= 0 && to !== "pending" ? m.membershipId : null;
  pushAudit(m.userId, EVENT_OF[action],
    m.planName + " term " + m.membershipId + ": " + (membershipMeta(from)?.label || from)
    + " to " + (membershipMeta(to)?.label || to) + ".");
  snap.memberships = snap.memberships.slice();
  snap.users = snap.users.slice();
  emit();
  return "";
}

/** Account status, which is NOT a membership action. Soft by construction:
 *  the profile, the terms, the commercial references and the audit trail all
 *  stay. Hard deletion is a governed privacy process and has no button. */
export function setUserStatus(userId: string, status: "active" | "deactivated", reason: string): string {
  const u = findUser(userId);
  if (!u) return "That user no longer exists.";
  if (u.userStatus === status) return "";
  if (status === "deactivated" && !reason.trim()) return "Deactivating an account needs a reason.";
  const stamp = new Date().toISOString();
  u.userStatus = status;
  u.deactivatedAt = status === "deactivated" ? stamp : null;
  u.deactivatedReason = status === "deactivated" ? reason.trim() : null;
  pushAudit(userId, status === "deactivated" ? "USER_DEACTIVATED" : "USER_REACTIVATED",
    status === "deactivated"
      ? "Reason: " + reason.trim() + ". Soft — profile, membership history and audit are retained."
      : "Account re-enabled. Membership state was not changed by this action.");
  snap.users = snap.users.slice();
  emit();
  return "";
}

/* ======================================================= the date range ===
   The analytics payload is MONTH-KEYED, so a span of months resolves to real
   arithmetic rather than to whichever two windows somebody pre-summed. Rates
   are recomputed from their own numerator and denominator over the span —
   never averaged from stored percentages, which cannot be re-aggregated
   without lying.

   The range snaps to whole months and the control says so. A day-precision
   picker over a monthly series promises a resolution the data does not have,
   and would produce a figure that changes when you move the cursor a day and
   does not change when you move it a week. */

export interface MonthRow {
  month: string; label: string; short: string;
  registrations: number; firstTimeMembers: number; renewals: number;
  expiries: number; cancellations: number; profileCompleted: number;
  cohortEligible: number; renewalEligible: number; churnEligible: number; churnLost: number;
  bySource: Record<string, number[]>;
  byPlan: Record<string, number[]>;
  activeAtEnd: Record<string, number>;
}

export const MONTHS = ANALYTICS.months as unknown as MonthRow[];
export const FIRST_MONTH = MONTHS[0].month;
export const LAST_MONTH = MONTHS[MONTHS.length - 1].month;

export interface Rate { value: number | null; num: number; den: number }
export interface RangeTotals {
  months: MonthRow[];
  from: string; to: string; label: string; monthCount: number;
  registrations: number; firstTimeMembers: number; renewals: number;
  expiries: number; cancellations: number; profileCompleted: number;
  conversion: Rate; renewalRate: Rate; churn: Rate;
  bySource: { key: string; label: string; registrations: number; firstTimeMembers: number }[];
  byPlan: { code: string; label: string; newTerms: number; renewals: number; expired: number; activeAtEnd: number }[];
  /** The equally-long span immediately before this one, for deltas. Null when
   *  there is not enough history — a delta against a short window would read as
   *  a collapse that never happened. */
  prev: { registrations: number; firstTimeMembers: number; renewals: number } | null;
}

const idx = (m: string) => MONTHS.findIndex((x) => x.month === m);
/* A rate with no denominator is UNDEFINED, not zero. Printing 0% because
   nothing was eligible tells somebody something false. */
const rate = (num: number, den: number): Rate => ({ value: den > 0 ? num / den : null, num, den });
const sum = (rows: MonthRow[], f: (m: MonthRow) => number) => rows.reduce((a, m) => a + f(m), 0);

export function clampRange(from: string, to: string): { from: string; to: string } {
  let a = idx(from) < 0 ? 0 : idx(from);
  let b = idx(to) < 0 ? MONTHS.length - 1 : idx(to);
  if (a > b) { const t = a; a = b; b = t; }
  return { from: MONTHS[a].month, to: MONTHS[b].month };
}

export function rangeTotals(fromMonth: string, toMonth: string): RangeTotals {
  const { from, to } = clampRange(fromMonth, toMonth);
  const a = idx(from), b = idx(to);
  const rows = MONTHS.slice(a, b + 1);
  const n = rows.length;
  const prevRows = a - n >= 0 ? MONTHS.slice(a - n, a) : null;
  const last = rows[rows.length - 1];

  const srcKeys = Object.keys(rows[0].bySource);
  const planKeys = Object.keys(rows[0].byPlan);

  return {
    months: rows,
    from, to, monthCount: n,
    label: n === 1 ? rows[0].label : rows[0].label + " – " + last.label,
    registrations: sum(rows, (m) => m.registrations),
    firstTimeMembers: sum(rows, (m) => m.firstTimeMembers),
    renewals: sum(rows, (m) => m.renewals),
    expiries: sum(rows, (m) => m.expiries),
    cancellations: sum(rows, (m) => m.cancellations),
    profileCompleted: sum(rows, (m) => m.profileCompleted),
    conversion: rate(sum(rows, (m) => m.firstTimeMembers), sum(rows, (m) => m.cohortEligible)),
    renewalRate: rate(sum(rows, (m) => m.renewals), sum(rows, (m) => m.renewalEligible)),
    churn: rate(sum(rows, (m) => m.churnLost), sum(rows, (m) => m.churnEligible)),
    bySource: srcKeys.map((k) => ({
      key: k,
      label: REGISTRATION_SOURCES.filter((s) => s.key === k)[0]?.label || k,
      registrations: sum(rows, (m) => m.bySource[k][0]),
      firstTimeMembers: sum(rows, (m) => m.bySource[k][1]),
    })),
    byPlan: planKeys.map((k) => ({
      code: k,
      label: PLAN_LABELS[k] || k,
      newTerms: sum(rows, (m) => m.byPlan[k][0]),
      renewals: sum(rows, (m) => m.byPlan[k][1]),
      expired: sum(rows, (m) => m.byPlan[k][2]),
      /* A LEVEL, not a flow — the count standing at the end of the span. Summing
         it across months would add the same members up once per month. */
      activeAtEnd: last.activeAtEnd[k],
    })),
    prev: prevRows ? {
      registrations: sum(prevRows, (m) => m.registrations),
      firstTimeMembers: sum(prevRows, (m) => m.firstTimeMembers),
      renewals: sum(prevRows, (m) => m.renewals),
    } : null,
  };
}

/* ==================================================== the plan rules ===
   The catalogue is the Plans module's, but the RULES about what may be sold
   and what a term freezes are this module's — so they live here, beside the
   derivation, rather than inside a dialog. That is also what makes them
   testable: `check:users` calls these directly, with no browser and no
   catalogue.

   Typed structurally rather than against the Plans module, so this file has no
   import from it. What matters is the shape: a plan with billing cycles. */

export interface CycleLike { id: number; months: number; price: number; active: boolean }
export interface PlanLike {
  id: number; title: string; family: string; active: boolean; archived: boolean;
  cycles: CycleLike[];
}

/** Offerable: on sale, not archived, and with at least one active cycle.
 *  Without a cycle there is no duration and no price, and a plan you cannot put
 *  a number against is not a plan you can sell. */
export const isSellable = (p: PlanLike) =>
  p.active && !p.archived && p.cycles.some((c) => c.active);

/** The plan default the duration field fills itself in with: the cheapest
 *  ACTIVE cycle. Cheapest rather than longest, because that is where a buyer
 *  lands and this form should not talk somebody into a longer commitment by
 *  defaulting them into one. */
export function defaultCycleOf(p: PlanLike): CycleLike | null {
  const on = p.cycles.filter((c) => c.active);
  return on.slice().sort((a, b) => a.price - b.price)[0] || null;
}

/** The stable grouping key for a plan. The live catalogue has no `planCode` and
 *  its numeric id moves with migrations, so terms carry a key derived from the
 *  family (or the title where the family is the generic one). Everything this
 *  module groups, filters, reports and refuses duplicates by uses this. */
export function planCodeOf(p: PlanLike): string {
  const base = (p.family && p.family !== "business" ? p.family : p.title) || p.title;
  return base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** The term that would collide with `planCode`, or null. One live entitlement
 *  per product — the client half of 409 active_membership_conflict, so the
 *  operator is told before they fill the form in rather than after they submit
 *  it. The dialog and `assignMembership()` both call this, so they cannot
 *  disagree about what a clash is. */
export function clashFor(history: Membership[], planCode: string): Membership | null {
  return history.filter((m) =>
    m.planCode === planCode && LIVE.indexOf(m.status) >= 0 && m.status !== "pending")[0] || null;
}

/** Every term currently entitling, pausing or suspending — context for the
 *  assignment dialog. A different plan is fine; the same one is not. */
export const liveTermsOf = (history: Membership[]) =>
  history.filter((m) => LIVE.indexOf(m.status) >= 0 && m.status !== "pending");

/** Presets, expressed as a month count back from the newest month. `custom` is
 *  whatever the calendar last set. */
export const RANGE_PRESETS = [
  { key: "3m", label: "3 months", months: 3 },
  { key: "6m", label: "6 months", months: 6 },
  { key: "12m", label: "12 months", months: 12 },
];

export function presetRange(months: number): { from: string; to: string } {
  const b = MONTHS.length - 1;
  const a = Math.max(0, b - months + 1);
  return { from: MONTHS[a].month, to: MONTHS[b].month };
}

/** Which preset a range corresponds to, or "" when it is a hand-picked span.
 *  Derived rather than stored, so a range arrived at by the calendar that
 *  happens to equal a preset lights that preset up. */
export function presetOf(from: string, to: string): string {
  const hit = RANGE_PRESETS.filter((p) => {
    const r = presetRange(p.months);
    return r.from === from && r.to === to;
  })[0];
  return hit ? hit.key : "";
}

/* =========================================================== formatting === */

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    + ", " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

/** Relative to the seed's own clock, so "3 days ago" stays true beside the
 *  absolute date it is derived from. */
export function ago(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = ts(iso);
  if (isNaN(t)) return "—";
  const d = daysBetween(t, NOW);
  if (d < 0) return "in " + Math.abs(d) + (Math.abs(d) === 1 ? " day" : " days");
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 31) return d + " days ago";
  const mo = Math.round(d / 30);
  if (mo < 12) return mo + (mo === 1 ? " month ago" : " months ago");
  const y = Math.round(d / 365);
  return y + (y === 1 ? " year ago" : " years ago");
}

export function money(amount: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency, maximumFractionDigits: 0,
  }).format(amount);
}

/** A rate that has no denominator prints as "n/a" with the reason, never as
 *  0%. Division by zero is a missing answer, not a low one. */
export function pct(v: number | null | undefined, digitsAfter = 1): string {
  if (v === null || v === undefined || isNaN(v)) return "n/a";
  return (v * 100).toFixed(digitsAfter) + "%";
}

export function delta(now: number, before: number): { text: string; tone: string } {
  if (!before) return { text: "no prior period", tone: "" };
  const d = (now - before) / before;
  const s = (d >= 0 ? "+" : "") + (d * 100).toFixed(0) + "%";
  return { text: s + " vs prior period", tone: d >= 0 ? "ok" : "warn" };
}

/* ============================================================ helpers === */

export const FILTER_KEYS = [
  "q", "cls", "ms", "plan", "city", "src", "tag", "status", "flag", "registered", "from", "to",
];

export const FILTER_LABELS: Record<string, string> = {
  q: "Search", cls: "Classification", ms: "Membership", plan: "Plan", city: "City",
  src: "Registered via", tag: "Tag", status: "Account", flag: "Queue", registered: "Registered",
};

export function filterValueLabel(key: string, value: string): string {
  if (key === "cls") return classificationMeta(value as Classification).label;
  if (key === "ms") return membershipMeta(value)?.label || value;
  /* The label comes from a term that holds the plan, because the catalogue is
     not ours to read here. No term, no label — the raw code is honest. */
  if (key === "plan") return plansInUse(snap.memberships).filter((p) => p.code === value)[0]?.name || value;
  if (key === "src") return REGISTRATION_SOURCES.filter((s) => s.key === value)[0]?.label || value;
  if (key === "tag") return tagMeta(value)?.label || value;
  if (key === "registered") return REGISTERED_RANGES.filter((r) => r.key === value)[0]?.label || value;
  if (key === "flag") {
    const m: Record<string, string> = {
      expiring: "Expiring soon", ended: "Recently ended",
      pending: "Pending activation", incomplete: "Incomplete profile",
    };
    return m[value] || value;
  }
  return value;
}
