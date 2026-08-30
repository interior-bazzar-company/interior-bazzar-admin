/* =============================================================================
   Users Management — the data module.
   -----------------------------------------------------------------------------
   THE ONLY FILE IN THIS MODULE THAT KNOWS WHERE ITS OWN RECORDS COME FROM.
   Every view imports from here; no view imports JSON. When the API lands, the
   four imports below become AdminOpsService calls and the write simulation
   underneath comes out — the views, the CSS and the URL scheme do not move.
   See src/proto/v-2.2.0.0/BACKEND-INTEGRATION.md.

   THIS MODULE IS THE REGISTER OF WHO EXISTS
   -----------------------------------------
   Identity, profile, account status, notes, tags and audit. It does NOT hold
   what a customer bought: a subscription — its plan, its term, its
   installments and its lifecycle — is a Finance record and is recorded there.
   Two modules holding one fact is how they end up disagreeing, so this one
   holds none of it. "Are they paying" is a question for Finance, and it is
   deliberately not answerable from here.

   `classify()` below is still the single derivation of what a row IS, and it
   now has exactly two answers: active, or deactivated. There is no stored
   classification column in users.json and there must never be one.

   `NOW` is the seed's own `asOf` instant, not the browser clock. Every age and
   every registration window is computed against it, so the fixture reads the
   same tomorrow as it does today and a screenshot taken in November still
   makes sense. The API will send its own `asOf` and this stays the only place
   that decides what "now" means.
   ============================================================================= */
import { useSyncExternalStore } from "react";
import usersDoc from "../../../content/users/users.json";
import vocabDoc from "../../../content/users/vocabularies.json";
import analyticsDoc from "../../../content/users/analytics.json";
import auditDoc from "../../../content/users/audit.json";
import { getSession } from "../../auth/session";
import config from "../../../config";

/* ============================================================== types === */

/** What a row IS, derived — never stored. Two answers, and the second one is a
 *  fact about the ACCOUNT rather than about a commercial relationship. Whether
 *  somebody is paying is a Finance question and is deliberately not answerable
 *  from this module. */
export type Classification = "active" | "deactivated";

export interface UserProfile {
  profileId: string;
  schemaVersion: string;
  profileStatus: string;
  /** The public address of this profile. Lower-case, unique across the
   *  platform, and permanent in practice — changing it breaks every link
   *  anybody has already shared. */
  username: string | null;
  about: string | null;
  businessName: string | null;
  /* THE FOUR BUSINESS FACETS. Deliberately orthogonal rather than one
     hierarchy: businessType is what kind of entity this is, segments is what
     it does, categories is how much of the job it holds and for which sector,
     searchKeywords is the discovery long tail. `Manufacturer + Modular kitchen`
     and `Service provider + Modular kitchen` are different businesses, and it
     takes both facets to say so.

     The first three hold VOCABULARY KEYS, never labels — a label is a display
     concern and gets rewritten; a key is what a filter, a report and a saved
     search all key on. searchKeywords holds raw text because it is the one
     facet whose whole job is the tail nobody thought to enumerate. */
  businessType: string | null;
  segments: string[];
  categories: string[];
  searchKeywords: string[];
  /** WHERE THEY TAKE WORK, as structured rows rather than the flat strings
   *  and the separate registered-location trio they replace. The state is a
   *  CLOSED key so rows aggregate — every profile claiming Karnataka spells it
   *  one way — and the cities inside a row are OPEN, because "Uttam Nagar" is
   *  a real service area and no list holds every locality. This is also the
   *  module's only location fact now: the business's own city is its first
   *  row, which is the honest minimum for a business that never said more. */
  targetAreas: TargetArea[];
  /** How the business positions its own work — up to two of a closed five.
   *  Self-declared, and shown before a connection is made so expectations
   *  are aligned on both sides first. */
  positioning: string[];
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface TargetArea { state: string; cities: string[] }

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
  /** Read-only pointers into the modules that DO own the commercial
   *  relationship. References, never amounts and never state: this module
   *  records that a deal or an invoice exists and links to it. */
  commercial: { salesOwner: string | null; dealRefs: string[]; invoiceRefs: string[] };
}

export interface AuditEvent {
  eventId: string; userId: string; type: string;
  actor: string; actorRole: string; at: string; note: string | null;
}


/** The row the directory renders: the stored user plus everything derived. */
export interface UserRow {
  user: PlatformUser;
  classification: Classification;
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
export const REGISTRATION_SOURCES = vocabDoc.registrationSources;
/**
 * One entry of the profile schema. `type` is what decides which control the
 * form renders, which is why EditProfile no longer knows a single field by
 * name — add a field to the JSON with `"type": "multi"` and it appears, with
 * its picker, its cap and its validation, with no code edit. That property is
 * the reason the schema is data (UM-OD-09) and it is easy to lose by writing
 * one `if (f.key === …)`.
 */
export interface ProfileField {
  key: string;
  label: string;
  group: string;
  required: boolean;
  editable: boolean;
  public: boolean;
  /** text · textarea · single (one key) · multi (many keys) · tags (free text) */
  type: string;
  /** Name of the vocabulary in this file that supplies the options. */
  vocab?: string;
  /** Accepts values outside `vocab` — the list becomes a suggestion rather
   *  than a constraint. City and Target areas are open; the facets the
   *  marketplace filters and ranks on are not. */
  open?: boolean;
  /** Name of the vocabulary that supplies option GROUP headings, if grouped. */
  groups?: string;
  /** Most values allowed. A facet with no ceiling is a facet everybody maxes. */
  max?: number;
  /** Longest single free-text value, for `tags` only. */
  maxLength?: number;
  /** `areas` only: most state rows, and most cities inside one row. */
  maxRows?: number;
  maxCities?: number;
  /** The picker's empty-box text. One generic line ("Type a phrase, or pick
   *  a suggestion") was serving segments, categories, cities and keywords
   *  alike, and "phrase" fits exactly one of them. */
  placeholder?: string;
  /** Take the full row regardless of type. Layout is schema too: which
   *  field sits beside which is a decision about the form, not about React. */
  wide?: boolean;
  /** `single` only: render a plain dropdown instead of the picker. For a
   *  short closed list whose options explain themselves — or explain
   *  themselves behind `info` — the picker's search box is ceremony. */
  simple?: boolean;
  /** Put an i button beside the label that drops down the option meanings.
   *  A string is the panel's opening sentence — the field's own description,
   *  above the per-option lines. This is where hints GO when a control is
   *  made simple: the sentences leave the flow, they do not leave the
   *  product. */
  info?: boolean | string;
  /** The chip tone for this facet, one of the theme's `tag-*` classes.
   *  COLOUR-BY-FACET: every chip of one facet shares one colour, on the form
   *  and on the record, so the colour answers "which question is this the
   *  answer to" at a glance. It is never per-value — a palette rotating per
   *  chip would be decoration pretending to be information. */
  chip?: string;
  hint?: string;
}
export const PROFILE_FIELDS = vocabDoc.profileFields as unknown as ProfileField[];

export interface FacetOption { key: string; label: string; hint?: string; group?: string }
export interface FacetGroup { key: string; label: string; note?: string }

/* The vocabularies a field may point at, by the name it uses in the schema.
   Looked up rather than imported directly so `"vocab": "segments"` in the JSON
   is the whole wiring. */
const VOCABS: Record<string, FacetOption[]> = {
  businessTypes: vocabDoc.businessTypes as FacetOption[],
  segments: vocabDoc.segments as FacetOption[],
  categories: vocabDoc.categories as FacetOption[],
  /* Strings in the file, options here. Keywords are free text: the "key" IS
     the label, and the list is a suggestion rather than a constraint. */
  keywordSuggestions: (vocabDoc.keywordSuggestions as string[])
    .map((k) => ({ key: k, label: k })),
  states: vocabDoc.states as FacetOption[],
  cities: vocabDoc.cities as FacetOption[],
  dealsIn: vocabDoc.dealsIn as FacetOption[],
  positioning: vocabDoc.positioning as FacetOption[],
};

/** Whole-state coverage, as one entry in the row's city list. A SENTINEL
 *  VALUE rather than a flag on the row, so the picker, the chips, the record
 *  and the payload all handle it as just another city — only the rules around
 *  it are special: it stands alone (it already covers everything a second
 *  entry could add), and the city filter expands it against the state's own
 *  suggestion list. */
export const ALL_CITIES = "All cities";

/** The city SUGGESTIONS for one state's row. Open — the picker offers these
 *  and accepts anything typed. "All cities" leads the list, because the
 *  person it serves is the one who was about to type every city in. */
export const citySuggestionsOf = (state: string): FacetOption[] =>
  [{ key: ALL_CITIES, label: ALL_CITIES, hint: "Covers the whole state" } as FacetOption]
    .concat((STATE_CITIES[state] || []).map((k) => ({ key: k, label: k })));
const VOCAB_GROUPS: Record<string, FacetGroup[]> = {
  categoryGroups: vocabDoc.categoryGroups as FacetGroup[],
};

export const optionsFor = (f: ProfileField): FacetOption[] =>
  (f.vocab && VOCABS[f.vocab]) || [];
export const groupsFor = (f: ProfileField): FacetGroup[] =>
  (f.groups && VOCAB_GROUPS[f.groups]) || [];

/** A stored key rendered for a human. Falls back to the key rather than to an
 *  empty cell: a value the vocabulary has since dropped is still a fact about
 *  this profile, and blanking it would hide a migration that needs doing. */
export function facetLabel(vocab: string, key: string): string {
  const hit = (VOCABS[vocab] || []).filter((o) => o.key === key)[0];
  return hit ? hit.label : key;
}
export const labelsFor = (f: ProfileField, keys: string[]): string[] =>
  keys.map((k) => (f.vocab ? facetLabel(f.vocab, k) : k));

/* ------------------------------------------------------------- username --- */

/** Where a profile lives on the storefront. `FRONTEND_URL` is the public site,
 *  not the API — and it is genuinely absent in some builds (the render harness
 *  defines `import.meta.env` as `{}`), so the host degrades to a readable
 *  placeholder rather than to the string "undefined" in front of a customer. */
export function profileUrl(username: string): string {
  const base = String(config.FRONTEND_URL || "").replace(/\/+$/, "");
  return (base || "https://interiorbazzar.com") + USERNAME_RULES.path + username;
}

/** Lower-case, hyphens for runs of anything else. What a person typing their
 *  business name into the box should get without being told the rules first. */
export const slugify = (s: string) =>
  s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, USERNAME_RULES.max);

/**
 * Why a username is not allowed, or "" if it is.
 *
 * Separate from `usernameTaken` because they are different questions with
 * different answers: this one is about the string and can be answered offline,
 * that one is about the platform and cannot. The dialog shows them
 * differently for the same reason — a malformed handle is your mistake, a
 * taken one is not.
 */
export function usernameError(raw: string): string {
  const u = raw.trim();
  if (!u) return "";
  const { min, max } = USERNAME_RULES;
  if (u !== u.toLowerCase()) return "Lower-case only.";
  if (u.length < min) return "At least " + min + " characters.";
  if (u.length > max) return "At most " + max + " characters.";
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(u)) {
    return "Letters, numbers and hyphens, starting and ending with a letter or number.";
  }
  if (u.indexOf("--") >= 0) return "No double hyphens.";
  /* A handle that collides with a storefront route would either 404 or, worse,
     let a profile sit at an address the platform speaks from. */
  if (RESERVED_USERNAMES.indexOf(u) >= 0) return "That one is reserved by the platform.";
  return "";
}

/** Held by somebody else. `exceptUserId` is what stops the dialog telling you
 *  your own handle is taken the moment you open it. */
export function usernameTaken(u: string, exceptUserId?: string): boolean {
  const want = u.trim().toLowerCase();
  if (!want) return false;
  return snap.users.some((x) =>
    x.userId !== exceptUserId
    && (x.profile.username || "").toLowerCase() === want);
}

/** Free, correctly formed, and not somebody else's. */
export const usernameFree = (u: string, exceptUserId?: string) =>
  !!u.trim() && !usernameError(u) && !usernameTaken(u, exceptUserId);

/* ------------------------------------------------------ facet validation --- */

/** Collapse the whitespace and trim. Not lower-cased: "2BHK interior" and
 *  "Pooja room design" are shown to people, and case is theirs to choose. */
export const cleanKeyword = (s: string) => s.replace(/\s+/g, " ").trim();

/** Case-insensitive de-duplication that KEEPS the first spelling. Somebody
 *  typing "modular kitchen" under an existing "Modular kitchen" means one
 *  keyword, not two, and the one already there is the one that stays. */
export function dedupeKeywords(list: string[]): string[] {
  const seen: Record<string, boolean> = {};
  const out: string[] = [];
  list.map(cleanKeyword).filter(Boolean).forEach((k) => {
    const f = k.toLowerCase();
    if (seen[f]) return;
    seen[f] = true;
    out.push(k);
  });
  return out;
}

/**
 * Everything the four facets refuse, in one place.
 *
 * It lives here rather than in the dialog, because a rule the form owns is a
 * rule the API does not have, and the moment a
 * second caller appears — an import, a bulk edit, the customer's own profile
 * page — it is enforced nowhere. Returns "" when the patch is acceptable.
 */
export function validateFacets(patch: Partial<UserProfile>): string {
  const bad: string[] = [];
  PROFILE_FIELDS.forEach((f) => {
    const v = (patch as unknown as Record<string, unknown>)[f.key];
    if (v === undefined) return;

    if (f.type === "single") {
      if (v === null || v === "") return;
      /* An OPEN single takes anything inside its length limit — City has a
         suggestion list of the eight the platform sees most, and there are
         several thousand more. Closing it would make the form unable to record
         where somebody actually is. */
      if (f.open) {
        const t = cleanKeyword(String(v));
        if (!t) bad.push(f.label + ": that is only whitespace");
        else if (f.maxLength && t.length > f.maxLength) {
          bad.push(f.label + ": keep it under " + f.maxLength + " characters");
        }
        return;
      }
      if (!optionsFor(f).some((o) => o.key === v)) {
        bad.push(f.label + ': "' + String(v) + '" is not one of the allowed values');
      }
      return;
    }

    if (f.type === "areas") {
      /* NORMALISED FIRST. This function exists for the caller that is not the
         form — an import, a bulk edit — and that caller is exactly the one
         that can hand over a row with no `cities` array. Refuse it; never throw.

         THE WHOLE VALUE IS CHECKED BEFORE ITS ROWS. Treating a non-array as an
         empty list let the value through: no rows means no strays and no
         duplicates, so validation passed and `updateProfile` stored the raw
         value — after which the directory threw `targetAreas.some is not a
         function` on the next read. A malformed value is exactly what this
         function exists to refuse, so it says so instead of quietly emptying
         it. */
      if (!Array.isArray(v)) {
        bad.push(f.label + ": expected a list of states, not " + typeof v);
        return;
      }
      const rows = (v as TargetArea[]).map((r) => ({
        state: String((r && r.state) || ""),
        cities: r && Array.isArray(r.cities) ? r.cities : [],
      }));
      if (f.maxRows && rows.length > f.maxRows) {
        bad.push(f.label + ": at most " + f.maxRows + " states");
      }
      /* THE STATE IS THE CLOSED HALF. One unrecognised state key is a profile
         no state filter will ever surface — same failure as a stray segment. */
      const strays = rows.filter((r) => !optionsFor({ ...f, vocab: "states" } as ProfileField)
        .some((o) => o.key === r.state));
      if (strays.length) {
        bad.push(f.label + ": unknown state " + strays.map((r) => '"' + r.state + '"').join(", "));
      }
      const states = rows.map((r) => r.state);
      if (new Set(states).size !== states.length) {
        bad.push(f.label + ": the same state is in there twice — add its cities to the one row");
      }
      rows.forEach((r) => {
        /* A row with a state and no city says nothing a filter can use — it
           is a half-given answer, and half answers do not save. */
        if (!r.cities.length) {
          bad.push(f.label + ": " + r.state + " needs at least one city");
        }
        /* "All cities" stands alone. A specific city beside it adds nothing
           and reads as though it does — which of the two is the claim? */
        if (r.cities.indexOf(ALL_CITIES) >= 0 && r.cities.length > 1) {
          bad.push(f.label + ': "' + ALL_CITIES + '" already covers ' + r.state
            + " — drop the extra cities");
        }
        if (f.maxCities && r.cities.length > f.maxCities) {
          bad.push(f.label + ": at most " + f.maxCities + " cities in " + r.state);
        }
        if (dedupeKeywords(r.cities).length !== r.cities.length) {
          bad.push(f.label + ": " + r.state + " lists the same city twice");
        }
        const long = r.cities.map(cleanKeyword)
          .filter((c) => f.maxLength && c.length > f.maxLength);
        if (long.length) {
          bad.push(f.label + ": keep each city under " + f.maxLength + " characters");
        }
      });
      return;
    }

    if (f.type === "handle") {
      if (v === null || v === "") return;
      const e = usernameError(String(v));
      if (e) bad.push(f.label + ": " + e);
      return;
    }

    if (f.type === "multi" || f.type === "tags" || f.type === "checks") {
      const list = Array.isArray(v) ? (v as string[]) : [];
      if (f.max && list.length > f.max) {
        bad.push(f.label + ": at most " + f.max + " (got " + list.length + ")");
      }
      if ((f.type === "multi" || f.type === "checks") && !f.open) {
        /* A CLOSED LIST HAS TO ACTUALLY CLOSE. These facets are what the
           marketplace filters and ranks on; one unrecognised key is a profile
           that quietly stops appearing under anything. */
        const known = optionsFor(f);
        const strays = list.filter((k) => !known.some((o) => o.key === k));
        if (strays.length) {
          bad.push(f.label + ": unknown " + strays.map((s) => '"' + s + '"').join(", "));
        }
        if (dedupeKeywords(list).length !== list.length) {
          bad.push(f.label + ": the same value is in there twice");
        }
      } else {
        const long = list.map(cleanKeyword)
          .filter((k) => f.maxLength && k.length > f.maxLength);
        if (long.length) {
          bad.push(f.label + ": keep each under " + f.maxLength + " characters");
        }
        if (dedupeKeywords(list).length !== list.length) {
          bad.push(f.label + ": the same value is in there twice");
        }
      }
    }
  });
  return bad.length ? bad.join(". ") + "." : "";
}
export const TAGS = vocabDoc.tags;
export const CITIES = vocabDoc.cities;
export const BUSINESS_TYPES = vocabDoc.businessTypes;
export const SEGMENTS = vocabDoc.segments;
export const CATEGORIES = vocabDoc.categories;
export const CATEGORY_GROUPS = vocabDoc.categoryGroups;
export const KEYWORD_SUGGESTIONS = vocabDoc.keywordSuggestions;
export const STATE_CITIES = vocabDoc.stateCities as Record<string, string[]>;
export const STATES = vocabDoc.states as { key: string; label: string }[];
export const USERNAME_RULES = vocabDoc.usernameRules;
export const RESERVED_USERNAMES = vocabDoc.reservedUsernames as string[];
export const REGISTERED_RANGES = vocabDoc.registeredRanges;
export const SORT_OPTIONS = vocabDoc.sortOptions;
export const METRICS = vocabDoc.metricDefinitions;
export const OPEN_DECISIONS = vocabDoc.openDecisions;
export const PROFILE_SCHEMA_VERSION = vocabDoc.profileSchemaVersion;
export const ANALYTICS = analyticsDoc;

export const classificationMeta = (k: Classification) =>
  CLASSIFICATIONS.filter((c) => c.key === k)[0] || CLASSIFICATIONS[0];
export const tagMeta = (slug: string) =>
  TAGS.filter((t) => t.slug === slug)[0] || null;
export const decision = (id: string) =>
  OPEN_DECISIONS.filter((d) => d.id === id)[0] || null;

/* ============================================================== clock === */

export const NOW = new Date(usersDoc.asOf).getTime();
export const DAY = 86400000;

/* ONE CLOCK. Derivation runs on `NOW` — the payload's `asOf` — and writes
   used to stamp the browser clock, so a note added today printed "in 4 days"
   on a timeline that lives in August. Writes now stamp NOW plus the time
   elapsed since load: same clock, still strictly ordered. When the API lands,
   both come from the server. */
const LOADED_AT = Date.now();
export const stamp = () => new Date(NOW + (Date.now() - LOADED_AT)).toISOString();

export const daysBetween = (a: number, b: number) => Math.round((b - a) / DAY);
export const ts = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : NaN);

/* ============================================================== state === */
/* One mutable snapshot for this browser tab. Every write below replaces the
   arrays it touches and bumps `version`, which is what useSyncExternalStore
   subscribes to. Nothing is persisted: a reload restores the seed, and the
   proto banner on every screen says so. */

type Snapshot = { users: PlatformUser[]; audit: AuditEvent[]; version: number };

const seed = (): Snapshot => ({
  users: JSON.parse(JSON.stringify(usersDoc.users)) as PlatformUser[],
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
export const readAudit = (): AuditEvent[] => snap.audit;
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

/** THE ONE DERIVATION. Read the doc block at the top of this file before
 *  adding a second one anywhere.
 *
 *  Two answers, and it reads exactly one stored fact. Deactivated is a fact
 *  about the ACCOUNT: it says the platform has disabled this identity, and it
 *  says nothing about what they have or have not bought. Whether somebody is
 *  paying is a Finance question, asked of the subscription that holds the
 *  money, and this module deliberately cannot answer it. */
export function classify(user: PlatformUser): Classification {
  return user.userStatus === "deactivated" ? "deactivated" : "active";
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

export function toRow(user: PlatformUser): UserRow {
  const { pct, missing } = completenessOf(user.profile);
  return {
    user,
    classification: classify(user),
    completeness: pct,
    missingFields: missing,
  };
}

/* ============================================================ filters === */

const norm = (s: unknown) => String(s ?? "").toLowerCase();
const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");

/** The one city the compact surfaces print — the first city of the first
 *  row. The profile stores no registered location any more, so coverage IS
 *  the location fact, and the first row is the primary one by convention. */
export function primaryCityOf(p: UserProfile): string | null {
  const r = p.targetAreas[0];
  if (!r) return null;
  /* A whole-state row's city is the state — "All cities" is a claim, not a
     place, and a subline reading "· All cities" names nowhere. */
  return r.cities[0] === ALL_CITIES ? r.state : (r.cities[0] || r.state);
}

function matchesSearch(r: UserRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const d = digits(needle);
  const u = r.user;
  const hay = [
    u.userId, u.identity.name, u.identity.email,
    u.profile.businessName,
    /* The username is an address people are handed, so it is a thing somebody
       arrives holding — "somebody emailed about /pro/meera-studio" has to be
       findable by pasting that in. Every state and city in the coverage rows
       is searchable because "who covers Gurugram" is a real question. */
    u.profile.username,
    /* The sentinel is a claim, not a place — it would make every profile a
       hit for the word "all". The state is already in the haystack. */
    ...u.profile.targetAreas.flatMap((t) =>
      [t.state, ...t.cities.filter((c) => c !== ALL_CITIES)]),
    /* The commercial references are searchable because somebody arrives
       holding one — "who is DL-3310" is asked of this directory even though
       the deal and the invoice live elsewhere. */
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
  /* "This year" is the CALENDAR year, not the last 366 days — the label says
     so, and a January reader expects January onwards. */
  if (key === "year") return new Date(at).getFullYear() === new Date(NOW).getFullYear();
  const days = key === "today" ? 1 : key === "7d" ? 7 : key === "30d" ? 30 : 90;
  return daysBetween(at, NOW) <= days;
}

export function applyFilters(rows: UserRow[], p: Params): UserRow[] {
  return rows.filter((r) => {
    if (p.q && !matchesSearch(r, p.q)) return false;
    /* The City filter reads COVERAGE now — any row that names the city, or a
       Delhi-style row where the state is the city's name. That is the question
       the filter was always answering badly: "who works in Mumbai", not "whose
       registered address says Mumbai". */
    if (p.city && !r.user.profile.targetAreas.some((t) =>
      t.state === p.city
      || t.cities.indexOf(p.city as string) >= 0
      /* A whole-state row answers for every city the state is known to hold —
         that is what the sentinel MEANS, and a filter that could not read it
         would make "All cities" weaker than listing three. */
      || (t.cities.indexOf(ALL_CITIES) >= 0
          && (STATE_CITIES[t.state] || []).indexOf(p.city as string) >= 0))) return false;
    if (p.src && r.user.registrationSource !== p.src) return false;
    if (p.tag && !r.user.tags.some((t) => t.slug === p.tag)) return false;
    if (p.status && r.user.userStatus !== p.status) return false;
    if (p.flag === "incomplete" && r.completeness >= 100) return false;
    if (!inRegisteredRange(r, p)) return false;
    return true;
  });
}

/** Default order answers "what needs doing": an incomplete profile on a live
 *  account is the one thing in this module somebody can actually go and fix,
 *  so it leads; everything else follows by newest registration. A list that
 *  opens on alphabetical order makes somebody sort it before they can start. */
function attentionScore(r: UserRow): number {
  if (r.classification === "deactivated") return 2;
  if (r.completeness < 100) return 0;
  return 1;
}

export function applySort(rows: UserRow[], sort: string | undefined): UserRow[] {
  const out = rows.slice();
  if (sort === "recent") return out.sort((a, b) => ts(b.user.registeredAt) - ts(a.user.registeredAt));
  if (sort === "activity") return out.sort((a, b) => ts(b.user.lastActivityAt) - ts(a.user.lastActivityAt));
  if (sort === "name") return out.sort((a, b) => a.user.identity.name.localeCompare(b.user.identity.name));
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
  /** Live accounts. Not "paying" and not "members" — this module cannot see
   *  either, and a count that hinted it could would be the duplicate fact this
   *  module was relieved of. */
  active: number;
  deactivated: number;
  incompleteProfiles: number;
}

export function countsOf(rows: UserRow[]): Counts {
  const c = (fn: (r: UserRow) => boolean) => rows.filter(fn).length;
  return {
    total: rows.length,
    active: c((r) => r.classification === "active"),
    deactivated: c((r) => r.classification === "deactivated"),
    incompleteProfiles: c((r) => r.completeness < 100),
  };
}

/**
 * The figures on the view band, counted off the WHOLE row set.
 *
 * Every face passes `rows`, never its own filtered population. The band is
 * navigation, and a tab whose number moves while you type in the search box is
 * reporting on the search rather than on the tab — the same reasoning as the
 * topbar counts. One function, called with the same argument everywhere, is
 * what stops two faces printing two numbers for one question.
 */
export function bandCounts(rows: UserRow[]): Record<string, number> {
  return { users: countsOf(rows).total };
}

/* ============================================================== hooks === */

function useVersion() { return useSyncExternalStore(subscribe, getVersion, getVersion); }

export function useAllRows(): UserRow[] {
  useVersion();
  return snap.users.map(toRow);
}

/** The record's timeline, newest first. Append-only and never filtered by
 *  event type: rows written before this module gave up the commercial
 *  lifecycle are still rows about things that happened to this account, and
 *  hiding them would be editing history to match today's feature set. */
export function useTimeline(userId: string | null): AuditEvent[] {
  useVersion();
  if (!userId) return [];
  return snap.audit.filter((e) => e.userId === userId).slice()
    .sort((a, b) => ts(b.at) - ts(a.at));
}

/** The module-wide audit slice Analytics shows: the same stream across every
 *  user, most recent first. */
export function useRecentActivity(limit: number): (AuditEvent & { userName: string })[] {
  useVersion();
  const nameOf = (id: string) => {
    const u = snap.users.filter((x) => x.userId === id)[0];
    return u ? u.identity.name : id;
  };
  return snap.audit.map((e) => ({ ...e, userName: nameOf(e.userId) }))
    .sort((a, b) => ts(b.at) - ts(a.at)).slice(0, limit);
}

/* ============================================================= writes ===
   EVERY FUNCTION BELOW IS A SIMULATION and the screens say so. Each one is
   named for the transaction it stands in for (UM-T07, UM-T12) and does the
   same sequence in the same order, so the endpoint that replaces it has a
   worked example rather than a guess. Nothing here writes money, nothing here
   touches a staff role, and nothing here records what anybody bought. */

const findUser = (id: string) => snap.users.filter((u) => u.userId === id)[0] || null;

function pushAudit(userId: string, type: string, note: string) {
  const a = actor();
  /* Typed explicitly rather than inferred from the literal: without the
     annotation TS narrows `note` to `string` and then refuses to concat the
     seeded rows, whose note is nullable. The annotation is the fix; widening
     the seed's type to match the literal would have been the bug. */
  const row: AuditEvent = {
    eventId: nextId("AU"), userId, type,
    actor: a.name, actorRole: a.role, at: stamp(), note,
  };
  snap.audit = [row].concat(snap.audit);
}

/** UM-T07 · Profile update. Validate → apply → recompute completeness → audit
 *  the CHANGED FIELD SET. A correction nobody can see is worse than none, so
 *  the diff goes into the audit note and the note text never does. */
export function updateProfile(userId: string, patch: Partial<UserProfile>): string {
  const u = findUser(userId);
  if (!u) return "That user no longer exists.";
  /* ONLY EDITABLE SCHEMA FIELDS. `profileId`, `schemaVersion`,
     `profileStatus` and the audit stamps are the store's to write, not a
     caller's — a patch naming them is refused whole, the way the endpoint
     422s it (UM-T07). */
  const editable = PROFILE_FIELDS.filter((f) => f.editable).map((f) => f.key);
  const strayKeys = Object.keys(patch).filter((k) => editable.indexOf(k) < 0);
  if (strayKeys.length) {
    return "Not editable here: " + strayKeys.join(", ") + ". Nothing has been saved.";
  }
  /* Text is trimmed and blank text is null. "   " is not a business name, and
     completeness must not count it as one. */
  const clean: Record<string, unknown> = {};
  Object.keys(patch).forEach((k) => {
    const v = (patch as unknown as Record<string, unknown>)[k];
    clean[k] = typeof v === "string" ? (v.trim() || null) : v;
  });
  patch = clean as Partial<UserProfile>;
  /* BEFORE anything is touched. The form checks the same rules as you type,
     but the form is not the last line — this function is what an import or a
     bulk edit would call, and a facet that only the dialog validates is a
     facet nothing validates. */
  const invalid = validateFacets(patch);
  if (invalid) return invalid;
  /* UNIQUENESS IS NOT A FIELD RULE, so it is not in validateFacets: that
     function answers "is this value well formed", which needs nothing but the
     value, and this one needs the whole table. Checked here because the
     username is a public address — two profiles at one URL is not a
     validation nicety, it is one of them being unreachable. */
  if (patch.username && usernameTaken(String(patch.username), userId)) {
    return "That username belongs to another profile. Nothing has been saved.";
  }
  const changed: string[] = [];
  (Object.keys(patch) as (keyof UserProfile)[]).forEach((k) => {
    const before = JSON.stringify(u.profile[k] ?? null);
    const after = JSON.stringify(patch[k] ?? null);
    if (before !== after) changed.push(String(k));
  });
  if (!changed.length) return "";
  const a = actor();
  u.profile = { ...u.profile, ...patch, updatedBy: a.name, updatedAt: stamp() };
  const { pct } = completenessOf(u.profile);
  /* A hidden profile stays hidden: an admin correcting a field on a
     deactivated account must not republish it. */
  if (String(u.profile.profileStatus) !== "hidden") {
    u.profile.profileStatus = pct >= 100 ? "published" : "incomplete";
  }
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
    at: stamp(), text: text.trim(),
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
  const known = TAGS.map((t) => t.slug);
  const stray = slugs.filter((x) => known.indexOf(x) < 0);
  if (stray.length) return "Unknown tag: " + stray.join(", ") + ". Tags are a closed list.";
  const a = actor();
  const before = u.tags.map((t) => t.slug);
  const added = slugs.filter((s) => before.indexOf(s) < 0);
  const removed = before.filter((s) => slugs.indexOf(s) < 0);
  if (!added.length && !removed.length) return "";
  u.tags = slugs.map((s) => {
    const kept = u.tags.filter((t) => t.slug === s)[0];
    return kept || { slug: s, assignedBy: a.name, assignedAt: stamp() };
  });
  pushAudit(userId, "TAGGED", [
    added.length ? "Added " + added.join(", ") : null,
    removed.length ? "Removed " + removed.join(", ") : null,
  ].filter(Boolean).join(". ") + ".");
  snap.users = snap.users.slice();
  emit();
  return "";
}

/** Account status. Soft by construction: the profile, the commercial
 *  references and the audit trail all stay. Hard deletion is a governed
 *  privacy process and has no button. */
export function setUserStatus(userId: string, status: "active" | "deactivated", reason: string): string {
  const u = findUser(userId);
  if (!u) return "That user no longer exists.";
  if (u.userStatus === status) return "";
  if (status === "deactivated" && !reason.trim()) return "Deactivating an account needs a reason.";
  const at = stamp();
  u.userStatus = status;
  u.deactivatedAt = status === "deactivated" ? at : null;
  u.deactivatedReason = status === "deactivated" ? reason.trim() : null;
  pushAudit(userId, status === "deactivated" ? "USER_DEACTIVATED" : "USER_REACTIVATED",
    status === "deactivated"
      ? "Reason: " + reason.trim() + ". Soft — profile, commercial links and audit are retained."
      : "Account re-enabled. Nothing outside this module was changed by this action.");
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
  registrations: number; profileCompleted: number;
  /** Registrations per channel. Sums exactly to the month's own total. */
  bySource: Record<string, number>;
}

export const MONTHS = ANALYTICS.months as unknown as MonthRow[];

export interface Rate { value: number | null; num: number; den: number }
export interface RangeTotals {
  months: MonthRow[];
  from: string; to: string; label: string; monthCount: number;
  registrations: number; profileCompleted: number;
  /** Completed profiles over registrations in the same span. A rate, so it
   *  carries its own numerator and denominator and is recomputed from them
   *  rather than averaged from stored percentages. */
  completion: Rate;
  bySource: { key: string; label: string; registrations: number }[];
  /** The equally-long span immediately before this one, for deltas. Null when
   *  there is not enough history — a delta against a short window would read as
   *  a collapse that never happened. */
  prev: { registrations: number; profileCompleted: number } | null;
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

  return {
    months: rows,
    from, to, monthCount: n,
    label: n === 1 ? rows[0].label : rows[0].label + " – " + last.label,
    registrations: sum(rows, (m) => m.registrations),
    profileCompleted: sum(rows, (m) => m.profileCompleted),
    completion: rate(sum(rows, (m) => m.profileCompleted), sum(rows, (m) => m.registrations)),
    bySource: srcKeys.map((k) => ({
      key: k,
      label: REGISTRATION_SOURCES.filter((s) => s.key === k)[0]?.label || k,
      registrations: sum(rows, (m) => m.bySource[k] || 0),
    })),
    prev: prevRows ? {
      registrations: sum(prevRows, (m) => m.registrations),
      profileCompleted: sum(prevRows, (m) => m.profileCompleted),
    } : null,
  };
}

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

/** A rate that has no denominator prints as "n/a" with the reason, never as
 *  0%. Division by zero is a missing answer, not a low one. */
export function pct(v: number | null | undefined, digitsAfter = 1): string {
  if (v === null || v === undefined || isNaN(v)) return "n/a";
  return (v * 100).toFixed(digitsAfter) + "%";
}

/** A period-on-period change, in words. "no prior period" rather than 0% when
 *  there is nothing behind the span to compare it to. */
export function delta(now: number, before: number): { text: string; tone: string } {
  if (!before) return { text: "no prior period", tone: "" };
  const d = (now - before) / before;
  const s = (d >= 0 ? "+" : "") + (d * 100).toFixed(0) + "%";
  return { text: s + " vs prior period", tone: d >= 0 ? "ok" : "warn" };
}

/* ============================================================ helpers === */

export const FILTER_KEYS = [
  "q", "city", "src", "tag", "status", "flag", "registered", "from", "to",
];

export const FILTER_LABELS: Record<string, string> = {
  q: "Search", city: "City", src: "Registered via", tag: "Tag",
  status: "Account", flag: "Profile", registered: "Registered",
};

export function filterValueLabel(key: string, value: string): string {
  if (key === "status") return classificationMeta(value as Classification).label;
  if (key === "src") return REGISTRATION_SOURCES.filter((s) => s.key === value)[0]?.label || value;
  if (key === "tag") return tagMeta(value)?.label || value;
  if (key === "registered") return REGISTERED_RANGES.filter((r) => r.key === value)[0]?.label || value;
  if (key === "flag") return value === "incomplete" ? "Incomplete profile" : value;
  return value;
}
