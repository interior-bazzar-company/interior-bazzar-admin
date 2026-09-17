/* =============================================================================
   Users Management — the data module.
   -----------------------------------------------------------------------------
   THE ONLY FILE IN THIS MODULE THAT KNOWS WHERE ITS OWN RECORDS COME FROM.
   Every view imports from here; no view imports JSON. THE RECORDS, THE VALUE
   LISTS, THE ANALYTICS, THE AUDIT AND EVERY WRITE ARE THE SERVER'S now
   (`/admin/platform-users/`, `/admin/users/vocabularies/`,
   `/admin/users/analytics/`, `/admin/audit/`) — the views, the CSS and the URL
   scheme did not move for any of it. One bundled file is left, and what is in
   it is what no table stands behind: the deactivate reasons, the metric
   definitions, the city suggestions, the category group headings and the
   username rules.

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

   `NOW` is the SERVER's date (v2/total-users `asOf`, and the analytics read's),
   planted when that read lands; until then it is the browser clock, which is
   the same day in practice.
   Every age and every registration window is computed against it, and this
   stays the only place that decides what "now" means.
   ============================================================================= */
import { useEffect, useState, useSyncExternalStore } from "react";
import vocabDoc from "../../../content/users/vocabularies.json";
import AdminOpsService, { call } from "../../../api/modules/adminOps";
import type {
  AuditEntry, OpenDecision, PlatformUserItem, PlatformUserRecord, PlatformUsersPage, UserCommercial, VocabItem,
  UsersAnalytics, UsersVocabularies, ValueLabel,
} from "../../../api/modules/adminOps";
import { AdminService } from "../../../api/modules/admin";
import type { UserTotals } from "../../../api/modules/admin";
import { errMessage } from "../../../api/apiService";
import { getSession } from "../../auth/session";
import config from "../../../config";

/* ============================================================== types ===
   THE WRITES ARE ENDPOINTS NOW (2026-09-16), not a simulation. Each one returns
   a PROMISE of the module's Result — "" when it landed, the server's own
   sentence when it refused — and folds the record the server answers with back
   into the snapshot, so what the screen shows after a save is what is stored
   rather than what the browser hoped it stored. */

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
  /** products · services -- what the business sells. */
  dealsIn: string[];
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
  commercial: UserCommercial;
  /** Present only on a row the SERVER sent: the go-live score it already
   *  persists, or null when there is no business, shop or architect to grade.
   *  Absent, the row is graded here against the profile schema (the offline
   *  checks plant rows like that). */
  completeness?: number | null;
  /** Server rows only: the go-live checklist items that score is still short of. */
  missingFields?: string[];
  /** The account's login username. Only once the record read has landed. */
  accountUsername?: string;
}

export interface AuditEvent {
  eventId: string; userId: string; type: string;
  actor: string; actorRole: string; at: string; note: string | null;
}


/** The row the directory renders: the stored user plus everything derived. */
export interface UserRow {
  user: PlatformUser;
  classification: Classification;
  /** null = nothing to grade (no business, shop or architect profile). */
  completeness: number | null;
  missingFields: string[];
}

export type Params = Record<string, string | undefined>;

/* ========================================================= vocabulary === */
/* What is left in the bundled file has no backend list behind it: the
   deactivate reasons, the metric definitions, the city suggestions per state,
   the two category group headings and the username rules. Everything else below
   is planted from the server — including the event types, which are now
   DERIVED from the audit rows themselves (see `rememberType`). */

/** One action as the timeline draws it: the sentence the server derived for it,
 *  and a tone.
 *
 *  AN AUDIT ROW CARRIES NO COLOUR and there is no column to put one in. What it
 *  does carry is a `verb` — the server's own small set — and `destructive`, the
 *  same rule the trail's severity filter and its facet count use. So the tone is
 *  read off those two rather than stored: an action added to any module renders
 *  with the right colour the day it is written, with no list to come back and
 *  edit and no row to seed. */
export interface EventType { key: string; label: string; tone: string }
const EVENT_TYPES: EventType[] = [];
/** The reasons offered when an account is switched off. ROWS NOW
 *  (`GET /admin/vocab/user-deactivate-reasons/`, PanelVocab scope
 *  `user_deactivate_reason`) — the bundled four are gone. Mutated in place
 *  rather than reassigned, because `VOCAB` below holds the array itself and the
 *  dialog reads it through that. What gets STORED is still the sentence
 *  somebody picked, on the account and on the audit line; the list only offers
 *  it. Empty until the read lands, and the dialog's free-text box is the
 *  fallback — a reason was always typeable. */
const DEACTIVATE_REASONS: string[] = [];
const TONE_BY_VERB: Record<string, string> = { removed: "stop", refused: "warn", approved: "ok" };

export function auditTone(e: AuditEntry): string {
  /* The registration line is not an admin action — nobody in this console did
     it — so it is drawn as a system fact, the way the bundled list drew it. */
  if (e.synthetic) return "sys";
  if (e.destructive) return "stop";
  return TONE_BY_VERB[e.verb] || "";
}

/** Remembers how to draw an action the first time an entry carrying it lands.
 *  The screens look a type up by key, which is what the bundled list of labels
 *  and tones used to answer. */
function rememberType(key: string, e: AuditEntry): void {
  if (EVENT_TYPES.some((t) => t.key === key)) return;
  EVENT_TYPES.push({ key, label: e.label || e.action || key, tone: auditTone(e) });
}

export const VOCAB = { ...vocabDoc, eventTypes: EVENT_TYPES, deactivateReasons: DEACTIVATE_REASONS };

/** Plants the deactivate reasons. Its own function so a check can state "the
 *  list arrived" without standing up a server. */
export function applyDeactivateReasons(items: { label: string }[]): void {
  DEACTIVATE_REASONS.length = 0;
  (items || []).forEach((r) => DEACTIVATE_REASONS.push(r.label));
}

/* ------------------------------------------------------- the value lists ---
   SIX LISTS COME FROM THE SERVER, not from the file above: the account states
   and the registration channels are rows, the tag catalogue is whatever people
   have actually made, the cities are the ones on record, and the range and
   sort keys are a contract the server implements too.

   `let`, not `const`, so the assignment when the read lands is visible through
   the ES live bindings every consumer already imports — the same move
   BusinessEnquiries made. THERE IS NO FALLBACK TO THE JSON: empty means the
   read has not landed or has failed, and the filter bar says which. A panel
   that quietly shows bundled options cannot tell you whether it is wired up.
   The profile facets' option lists follow the same rule (`applyFacetOptions`). */
export interface VocabOption { key: string; label: string; tone?: string; meaning?: string }
export interface TagOption { slug: string; label: string; tone: string; help: string }

export let CLASSIFICATIONS: VocabOption[] = [];
export let REGISTRATION_SOURCES: VocabOption[] = [];
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
/* FROM THE SERVER (users/vocabularies/ `profileFields`), planted by
   applyUsersVocab like the six lists below -- empty until that read lands. */
export let PROFILE_FIELDS: ProfileField[] = [];

export interface FacetOption { key: string; label: string; hint?: string; group?: string }
export interface FacetGroup { key: string; label: string; note?: string }

/* The vocabularies a field may point at, by the name it uses in the schema.
   Looked up rather than imported directly so `"vocab": "segments"` in the
   schema is the whole wiring. FROM THE SERVER, planted by `applyFacetOptions`:
   empty until the reads land, with no fallback to a bundled list. */
const VOCABS: Record<string, FacetOption[]> = {};

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

/** Labels the SERVER gave the values on the records it has sent, by value --
 *  they win over the bundled lists (the record's chips say what the backend says).
 *  ponytail: one flat map across facets -- a value two lists label differently
 *  would show the last one read; key it by facet if that ever happens. */
const SERVER_LABELS: Record<string, string> = {};

/** A stored key rendered for a human. Falls back to the key rather than to an
 *  empty cell: a value the vocabulary has since dropped is still a fact about
 *  this profile, and blanking it would hide a migration that needs doing. */
export function facetLabel(vocab: string, key: string): string {
  if (SERVER_LABELS[key]) return SERVER_LABELS[key];
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
  /* The storefront's business page is /b/:slug (frontend app.ts BUSINESS_DETAIL). */
  return (base || "https://interiorbazzar.com") + "/b/" + username;
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
export let TAGS: TagOption[] = [];
export let CITIES: VocabOption[] = [];
/* City suggestions per state, derived server-side from the (state, city) pairs
   actually saved (users/vocabularies/ `stateCities`). Keyed by the state's NAME,
   which is what a coverage row stores. Filled IN PLACE by applyUsersVocab and
   empty until then: an unknown state has no suggestions, typing still works. */
export const STATE_CITIES: Record<string, string[]> = {};
/** The states a coverage row may name, from seller-options (planted with the
 *  facet lists below). */
export let STATES: FacetOption[] = [];
/** `min`/`max` from `users/vocabularies/` (the profile PATCH enforces the same
 *  numbers); `help` is the panel's own sentence. Unbounded until the read lands,
 *  so the form refuses nothing the server has not said — the server refuses anyway. */
export const USERNAME_RULES = { ...vocabDoc.usernameRules, min: 0, max: Infinity };
/** From `users/vocabularies/` `reservedUsernames`; empty until it answers. */
export const RESERVED_USERNAMES: string[] = [];
export let REGISTERED_RANGES: VocabOption[] = [];
export let SORT_OPTIONS: VocabOption[] = [];
export const METRICS = vocabDoc.metricDefinitions;
export let OPEN_DECISIONS: OpenDecision[] = [];

/* A SYNTHETIC ROW RATHER THAN `CLASSIFICATIONS[0]`: the list is empty until the
   read lands, and a pill whose label is `undefined` is worse than one that
   shows the key it was given. */
export const classificationMeta = (k: Classification): VocabOption =>
  CLASSIFICATIONS.filter((c) => c.key === k)[0]
  || { key: k, label: k, tone: k === "deactivated" ? "dead" : "", meaning: "" };
export const tagMeta = (slug: string) =>
  TAGS.filter((t) => t.slug === slug)[0] || null;
export const decision = (id: string) =>
  OPEN_DECISIONS.filter((d) => d.id === id)[0] || null;

/* ============================================================== clock === */

export let NOW = Date.now();

/** Plants the server's "today". A bare date is anchored at NOON so a moment
 *  from earlier or later that same day still reads "today" through
 *  `daysBetween`'s rounding; a full instant is taken as it is. */
export function applyServerDate(asOf: string): void {
  const t = new Date(/^\d{4}-\d{2}-\d{2}$/.test(asOf) ? asOf + "T12:00:00" : asOf).getTime();
  if (!isNaN(t)) NOW = t;
}
export const DAY = 86400000;

/* ONE CLOCK, and it is the SERVER's: `NOW` is planted from the `asOf` both the
   totals read and the analytics read carry. Nothing in this module stamps a
   moment of its own any more — every write is an endpoint, so every stored
   stamp on a record or an audit line is the server's own. */

export const daysBetween = (a: number, b: number) => Math.round((b - a) / DAY);
export const ts = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : NaN);

/* ============================================================== state === */
/* One mutable snapshot for this browser tab. Every write below replaces the
   arrays it touches and bumps `version`, which is what useSyncExternalStore
   subscribes to. Nothing is persisted: a reload restores the seed, and the
   proto banner on every screen says so. */

type Snapshot = { users: PlatformUser[]; version: number };

/* THE ROWS START EMPTY. They are planted by `applyUsersPage` when the server
   answers -- there is no bundled fallback, so an empty directory means the read
   has not landed, failed, or found nobody, and the screen says which. THE AUDIT
   IS NOT IN HERE EITHER: it is read live from `GET /admin/audit/`, per record
   and across the module, so nothing on a timeline is a fixture. */
const seed = (): Snapshot => ({ users: [], version: 0 });

let snap: Snapshot = seed();
const listeners = new Set<() => void>();
const emit = () => { snap = { ...snap, version: snap.version + 1 }; listeners.forEach((l) => l()); };

const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const getVersion = () => snap.version;

/** Back to the page exactly as the server sent it. Nothing is thrown away by
 *  doing this any more — the writes are the server's — so it is a re-read of
 *  what already arrived rather than an undo. */
export function resetStore() { snap = { ...seed(), users: clone(heldUsers) }; emit(); }

/* Plain readers over the same snapshot the hooks subscribe to. They exist so
   the check suite can assert the derivation without pretending to be React —
   scripts/check-users-derivation.cjs calls exactly these, so what it asserts is
   what the screens see and not a parallel reimplementation of it. */
export const readUsers = (): PlatformUser[] => snap.users;
export const readUser = (id: string): PlatformUser | null =>
  snap.users.filter((u) => u.userId === id)[0] || null;

/** Who a write is attributed to ON SCREEN. The server attributes the stored row
 *  to the authenticated admin; this is the session's own name, for the sentence
 *  a dialog shows back. */
export function actor(): { name: string; role: string } {
  const s = getSession();
  return { name: s?.user?.name || "You", role: s?.role || "Operations" };
}

/** The account's pk, read back out of `IB-U-<pk>`. Every write addresses the
 *  server by it; 0 means the id is not one this module issued. */
const pkOf = (userId: string): number => Number((/^IB-U-(\d+)$/.exec(userId) || [])[1] || 0);

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
  /* A SERVER ROW IS NOT RE-GRADED. Its score is the go-live checklist the
     engine persists, and "what is missing" is that checklist's unmet items as
     the server sent them -- not a guess made from profile fields. */
  const { pct, missing } = user.completeness !== undefined
    ? { pct: user.completeness, missing: user.missingFields || [] }
    : completenessOf(user.profile);
  return {
    user,
    classification: classify(user),
    completeness: pct,
    missingFields: missing,
  };
}

/** Unfinished = graded AND short of 100. Nothing to grade is not unfinished. */
const unfinished = (r: UserRow) => r.completeness !== null && r.completeness < 100;

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
    ...u.commercial.dealRefs, ...u.commercial.invoices.map((i) => i.number || ""),
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
    if (p.flag === "incomplete" && !unfinished(r)) return false;
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
  if (unfinished(r)) return 0;
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
    incompleteProfiles: c(unfinished),
  };
}

/**
 * The figures on the view band: the server's platform-user total, unfiltered.
 *
 * Every face passes the same `useUserTotals().data`, never its own filtered
 * population. The band is navigation, and a tab whose number moves while you
 * type in the search box is reporting on the search rather than on the tab.
 * Null until the count arrives — the tab then shows no number rather than 0.
 */
export function bandCounts(totals: UserTotals | null): Record<string, number | null> {
  return { users: totals ? totals.totalUsers : null };
}

/* ======================================================= live totals ===
   `GET /admin/v2/total-users/` — platform users (admin and staff excluded),
   how many are active, and the server's date. AdminService keeps the answer in
   sessionStorage for 10 minutes, so moving between the faces of this module
   reuses it instead of asking again. */
export interface TotalsState { data: UserTotals | null; error: string | null }

export function useUserTotals(): TotalsState {
  const [s, setS] = useState<TotalsState>({ data: null, error: null });
  useEffect(() => {
    let live = true;
    AdminService.fetchTotalUsers()
      .then((r) => {
        if (!live) return;
        if (r.response) applyServerDate(r.data.asOf);
        setS(r.response ? { data: r.data, error: null } : { data: null, error: r.message || "Could not load the user count." });
      })
      .catch((e) => { if (live) setS({ data: null, error: errMessage(e) }); });
    return () => { live = false; };
  }, []);
  return s;
}

/* ================================================== the value lists, live ===
   `GET /admin/users/vocabularies/` — the account states, the registration
   channels, the tag catalogue, the cities on record, and the range and sort
   keys. Read ONCE per session rather than per face: these do not change while
   somebody works, and the directory, the record and the analytics tab all read
   the same six bindings.

   The lists are planted on the module (see `CLASSIFICATIONS` and friends
   above), so no consumer had to change; what a consumer CAN do is ask whether
   the read has landed, which is the whole of this state. */
export interface VocabState { ready: boolean; error: string | null }

let vocab: VocabState = { ready: false, error: null };
let vocabStarted = false;

/** Plants a fetched vocabulary across the module bindings. Its own function so
 *  a test can state "the vocabulary arrived" without standing up a server. */
export function applyUsersVocab(v: UsersVocabularies): void {
  /* The row's `hint` is the sentence the class pill shows on hover, which is
     what `meaning` was in the bundled file. */
  CLASSIFICATIONS = (v.classifications || []).map((c) => ({
    key: c.key, label: c.label, tone: c.tone, meaning: c.hint || "",
  }));
  REGISTRATION_SOURCES = (v.registrationSources || []).map((r) => ({ key: r.key, label: r.label }));
  TAGS = (v.tags || []).map((t) => ({ slug: t.slug, label: t.label, tone: t.tone, help: t.help }));
  /* Cities arrive as the strings people actually typed; the controls want a
     key and a label, and for a city those are the same thing. */
  CITIES = (v.cities || []).map((c) => ({ key: c, label: c }));
  Object.keys(STATE_CITIES).forEach((k) => { delete STATE_CITIES[k]; });
  Object.assign(STATE_CITIES, v.stateCities || {});
  REGISTERED_RANGES = v.registeredRanges || [];
  SORT_OPTIONS = v.sortOptions || [];
  PROFILE_FIELDS = (v.profileFields || []) as unknown as ProfileField[];
  OPEN_DECISIONS = v.openDecisions || [];
  if (v.usernameRules) Object.assign(USERNAME_RULES, { min: v.usernameRules.min, max: v.usernameRules.max });
  RESERVED_USERNAMES.splice(0, RESERVED_USERNAMES.length, ...(v.reservedUsernames || []));
}

/** One option as the server sends it: seller-options rows, and taxonomy rows
 *  (which also carry `isActive`). */
export interface ServerOption { value: string; label: string; meta?: unknown; isActive?: boolean }

/**
 * Plants the profile facets' option lists. Each comes from the list the
 * record's stored values are drawn from, so an option `key` IS a stored value:
 *
 *   businessTypes      <- seller-options businessTypes     (Business.sellerType)
 *   dealsIn            <- seller-options businessModels    (Business.businessModel)
 *   positioning        <- seller-options serviceSegments   (Business.serviceSegments)
 *   keywordSuggestions <- seller-options serviceKeywords   (the seller wizard's suggestions)
 *   states             <- seller-options states            (State.name)
 *   segments           <- admin taxonomy segments          (Business.businessSegment)
 *   categories         <- admin taxonomy categories + seller-options productCategories
 *                         and serviceCategories            (all three are what the record merges)
 *
 * `taxonomy` is null when that read was refused -- it is its own permission.
 * Its own function so a check can state "the lists arrived" without a server.
 */
export function applyFacetOptions(so: Record<string, ServerOption[]>, taxonomy: Record<string, ServerOption[]> | null): void {
  const opts = (list: ServerOption[] | undefined, group?: string): FacetOption[] =>
    (list || []).filter((o) => o.isActive !== false).map((o) => {
      const hint = (o.meta as { desc?: string } | undefined)?.desc;
      return { key: o.value, label: o.label, ...(hint ? { hint } : {}), ...(group ? { group } : {}) };
    });
  VOCABS.businessTypes = opts(so.businessTypes);
  /* The record expands `both` into products + services, so `both` is never a stored value. */
  VOCABS.dealsIn = opts((so.businessModels || []).filter((o) => o.value !== "both"));
  VOCABS.positioning = opts(so.serviceSegments);
  VOCABS.keywordSuggestions = opts(so.serviceKeywords);
  VOCABS.states = STATES = opts(so.states);
  /* ponytail: taxonomy/ caps segments at 300, so a stored segment past the cap is
     not suggested (4 on the local db). Segments is an open field, so it still
     saves and labels; page the taxonomy read if suggestions must be complete. */
  VOCABS.segments = opts(taxonomy?.segments);
  /* The server has no category grouping, so the bundled two headings carry it:
     the engine taxonomy and the product families are what they work in, the
     service categories (Residential, Commercial, ...) what kind of space. */
  VOCABS.categories = opts(taxonomy?.categories, "industry")
    .concat(opts(so.productCategories, "industry"), opts(so.serviceCategories, "sector"));
}

export async function bootUsersVocab(force = false): Promise<void> {
  if (vocabStarted && !force) return;
  vocabStarted = true;
  vocab = { ready: false, error: null };
  try {
    const [v, so, taxonomy, reasons] = await Promise.all([
      call<UsersVocabularies>(AdminOpsService.usersVocabularies()),
      /* Neither option read takes the directory's filters down with it: a failed
         seller-options read leaves the form with nothing to pick from, and a
         role without taxonomy access gets no segment or engine-category suggestions. */
      call(AdminOpsService.sellerOptions()).catch(() => ({})),
      call<Record<string, ServerOption[]>>(AdminOpsService.taxonomy()).catch(() => null),
      /* Nor does this one: the deactivate dialog's chips are a shortcut past
         its text box, and the box is what actually carries the reason. */
      call<{ items: VocabItem[] }>(AdminOpsService.vocab("user-deactivate-reasons"))
        .catch(() => ({ items: [] })),
    ]);
    applyUsersVocab(v);
    applyFacetOptions(so, taxonomy);
    applyDeactivateReasons(reasons.items);
    vocab = { ready: true, error: null };
  } catch (e) {
    vocab = { ready: false, error: errMessage(e) };
  }
  emit();
}

/** Subscribes a face to the read, and starts it on first mount. */
export function useUsersVocab(): VocabState {
  useVersion();
  useEffect(() => { void bootUsersVocab(); }, []);
  return vocab;
}

/* ===================================================== the live page ===
   `GET /admin/platform-users/` — ONE PAGE of the directory, filtered, sorted
   and paged by the server. It is planted into the same snapshot every face
   reads, so the directory, the record and the analytics tab all see exactly the
   rows that were loaded and nothing else: a record that is not on the loaded
   page is not found (the decision behind this div, recorded in the route file).

   Started from the route host so a record-first load fetches too. The key is
   the query string, so a re-render or a second mount with the same filters
   does not ask again. */
export interface UsersPageState {
  loading: boolean; error: string | null;
  total: number; pageNo: number; pageSize: number; pages: number;
}

let pageState: UsersPageState = { loading: true, error: null, total: 0, pageNo: 1, pageSize: 20, pages: 1 };
let pageKey: string | null = null;
/** The page exactly as the server sent it -- what Reset returns to. */
let heldUsers: PlatformUser[] = [];

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** The panel's URL params, renamed to the API's. `view`, `tab` and friends are
 *  not the server's business and never reach it. */
function queryOf(p: Params): string {
  const map: Record<string, string> = {
    q: "q", status: "status", city: "city", src: "src", tag: "tag", flag: "flag",
    registered: "registered", from: "dateFrom", to: "dateTo", sort: "sort", page: "pageNo",
  };
  const parts = Object.keys(map)
    .filter((k) => p[k])
    .map((k) => encodeURIComponent(map[k]) + "=" + encodeURIComponent(p[k] as string));
  return parts.length ? "?" + parts.join("&") : "";
}

/** A list row, or a record, which carries the identity facts on top. */
type ServerUserItem = PlatformUserItem & Partial<Pick<PlatformUserRecord,
  "deactivatedReason" | "deactivatedAt" | "isVerified" | "authUserId" | "registrationSource"
  | "commercial" | "notes">>
  & { profile: { updatedAt?: string | null } };

/** PUBLISHED once the go-live checklist is met, INCOMPLETE while it is not,
 *  and "" when there is nothing to grade at all (a buyer holds no profile).
 *
 *  DERIVED, NEVER STORED, and from the one score the rest of this module
 *  already reads: the server's persisted completeness. A stored status column
 *  beside a computed score is two answers to one question, and the seed already
 *  carries one row where the two disagree. There is deliberately no third
 *  answer: "hidden" is a visibility decision and no fact on the record says one
 *  was ever taken. */
function profileStatusOf(completeness: number | null | undefined): string {
  if (completeness === null || completeness === undefined) return "";
  return completeness >= 100 ? "published" : "incomplete";
}

/** A server row in the directory's own shape. Everything the list does not send
 *  is EMPTY -- no invented values -- and fills in as the record's divs move. */
function fromServer(r: ServerUserItem): PlatformUser {
  return {
    userId: r.userId,
    authUserId: r.authUserId ?? "",
    registrationSource: r.registrationSource ?? "",
    userStatus: r.userStatus,
    registeredAt: r.registeredAt || "",
    deactivatedAt: r.deactivatedAt ?? null,
    deactivatedReason: r.deactivatedReason ?? null,
    lastActivityAt: r.lastActivityAt,
    /* The server verifies the ACCOUNT, not each channel, so both read the one flag. */
    identity: { name: r.identity.name, email: r.identity.email, emailVerified: !!r.isVerified,
                phone: r.identity.phone, phoneVerified: !!r.isVerified },
    profile: {
      /* THE ACCOUNT'S OWN UNIQUE ID (CustomUser.unique_id), not a second id
         minted for the profile: one account holds one business profile, so a
         separate key would be a new thing to keep in step for no new fact. Only
         the record read carries it — a directory row has no identity section to
         print it in, so it is empty there rather than guessed. */
      profileId: r.authUserId ?? "",
      /* NOT DERIVABLE. There is no version on the schema — UserProfileField has
         no such column and UM-OD-09 ("profile v1 is the field set on these
         screens") is the decision that would put one there. A fingerprint of
         the rows would be a number nobody agreed to, so this stays empty and
         says so. */
      schemaVersion: "",
      profileStatus: profileStatusOf(r.completeness),
      username: r.profile.username, about: null, businessName: null, businessType: null,
      dealsIn: [], segments: [], categories: [], searchKeywords: [],
      targetAreas: r.profile.targetAreas, positioning: [], updatedBy: null, updatedAt: r.profile.updatedAt ?? null,
    },
    /* WHO TAGGED SOMEBODY IS PART OF THE RECORD -- the assignment row carries
       it and the record's Tags card prints it, so it travels with the chip. */
    tags: r.tags.map((t) => ({ slug: t.slug, assignedBy: t.assignedBy, assignedAt: t.assignedAt || "" })),
    /* THE RECORD READ IS THE LIST. A directory row carries no notes, so it
       reads as none until the record lands — which is where the tab that shows
       them lives anyway. */
    notes: (r.notes || []).map((n) => ({
      noteId: n.noteId, author: n.author, authorRole: n.authorRole,
      at: n.at || "", text: n.text,
    })),
    commercial: r.commercial ?? { salesOwner: null, dealRefs: [], invoices: [] },
    completeness: r.completeness,
    missingFields: r.missingFields || [],
  };
}

/** Plants a page into the snapshot. Its own function so the offline checks can
 *  state "these rows arrived" without standing up a server. */
export function applyUsersPage(users: PlatformUser[]): void {
  heldUsers = clone(users);
  snap = { ...snap, users: clone(users) };
}

/** Reads one page and plants it. Its own function because a WRITE re-reads the
 *  same query afterwards: the row on the directory carries the account status,
 *  the tags and the go-live score, so a save on the record moves the list too. */
function loadPage(key: string, quiet = false): Promise<void> {
  pageKey = key;
  if (!quiet) {
    pageState = { ...pageState, loading: true, error: null };
    emit();
  }
  return call<PlatformUsersPage>(AdminOpsService.platformUsers(key))
    .then((r) => {
      if (pageKey !== key) return;   // a newer query has taken over
      applyUsersPage(r.users.map(fromServer));
      pageState = {
        loading: false, error: null, total: r.total, pageNo: r.pageNo, pageSize: r.pageSize,
        pages: Math.max(1, Math.ceil(r.total / Math.max(1, r.pageSize))),
      };
      emit();
    })
    .catch((e) => {
      if (pageKey !== key) return;
      pageState = { ...pageState, loading: false, error: errMessage(e) };
      emit();
    });
}

/** The background re-read after a write. QUIET: the record is already showing
 *  what was stored, and flipping the directory into its loading state behind an
 *  open dialog would blank the row somebody just saved. */
function reloadPage(): Promise<void> {
  return pageKey === null ? Promise.resolve() : loadPage(pageKey, true);
}

/** Fetches the page the URL describes, once per distinct query. */
export function useUsersPage(p: Params): UsersPageState {
  useVersion();
  const key = queryOf(p);
  useEffect(() => {
    if (key === pageKey) return;
    void loadPage(key);
  }, [key]);
  return pageState;
}

/** The same state, for a face that did not start the read. */
export function useUsersPageState(): UsersPageState {
  useVersion();
  return pageState;
}

/* =================================================== the record, live ===
   `GET /admin/platform-users/<pk>/` — the row plus the business profile the
   seller filled in and the account's login username. Read each time a record
   opens and merged INTO the loaded row, so the header, the tabs and the edit
   form all read one user. Chips keep their stored values; the server's labels
   go to SERVER_LABELS, which `facetLabel` prefers. */
export interface RecordState { userId: string | null; loading: boolean; error: string | null }

let recordState: RecordState = { userId: null, loading: false, error: null };

const valuesOf = (list: ValueLabel[] | undefined) => {
  (list || []).forEach((c) => { SERVER_LABELS[c.value] = c.label; });
  return (list || []).map((c) => c.value);
};

/** Merges one record into the snapshot (and the held page Reset returns to). */
export function applyUserRecord(r: PlatformUserRecord): void {
  const p = r.profile;
  const merge = (u: PlatformUser): PlatformUser => u.userId !== r.userId ? u : {
    ...fromServer(r),
    accountUsername: r.accountUsername,
    profile: {
      ...fromServer(r).profile,
      businessName: p.businessName, about: p.about,
      businessType: valuesOf(p.businessType)[0] || null,
      dealsIn: valuesOf(p.dealsIn), segments: valuesOf(p.segments), categories: valuesOf(p.categories),
      searchKeywords: valuesOf(p.searchKeywords), positioning: valuesOf(p.positioning),
    },
  };
  heldUsers = heldUsers.map(merge);
  snap = { ...snap, users: snap.users.map(merge) };
}

/** Reads the open record once per mount (a dev double-mount shares the flight). */
export function useUserRecord(userId: string | null): RecordState {
  useVersion();
  useEffect(() => {
    const pk = Number((/^IB-U-(\d+)$/.exec(userId || "") || [])[1]);
    if (!pk || (recordState.userId === userId && recordState.loading)) return;
    recordState = { userId, loading: true, error: null };
    emit();
    call<PlatformUserRecord>(AdminOpsService.platformUser(pk))
      .then((r) => {
        if (recordState.userId !== userId) return;
        applyUserRecord(r);
        recordState = { userId, loading: false, error: null };
        emit();
      })
      .catch((e) => {
        if (recordState.userId !== userId) return;
        recordState = { userId, loading: false, error: errMessage(e) };
        emit();
      });
  }, [userId]);
  return recordState.userId === userId ? recordState : { userId, loading: !!userId, error: null };
}

/* ============================================================== hooks === */

function useVersion() { return useSyncExternalStore(subscribe, getVersion, getVersion); }

export function useAllRows(): UserRow[] {
  useVersion();
  return snap.users.map(toRow);
}

/* ==================================================== the timeline ===
   THE ONE READ IN THIS MODULE THAT IS LIVE. `GET /admin/audit/user/<ref>/`,
   the same trail the Audit module shows, scoped to this account -- so a row
   here and a row there can never disagree, and nothing on this tab is
   invented. `content/users/audit.json` is NOT consulted: a timeline is a
   claim about what happened to a real person, and a fixture cannot make one.

   AN EMPTY TAB IS THE HONEST ANSWER while the directory is still seeded. The
   27 records in `users.json` have no row in the database, so the server
   refuses their reference and this returns []. That reads as "nothing has
   happened on this account yet", which is exactly right for somebody who does
   not exist -- and it starts filling in by itself the day the directory moves
   onto real accounts, with no edit here.

   THE REFERENCE IS THE PK, read back out of `IB-U-<pk>`. The endpoint takes the
   pk, the `unique_id` UUID or the username; the profile email only matched the
   username on 2 of 167 accounts, and `IB-U-<pk>` itself is refused by design. */

/** The panel's own `type` for one server entry. The registration line maps
 *  onto the vocabulary's REGISTERED so it keeps its label and its tone; every
 *  other action carries the label the SERVER derived, which the timeline
 *  prints as-is when the vocabulary has no entry for it. That way an action
 *  added to any module renders as a sentence here the day it is written,
 *  without a vocabulary edit. */
const auditType = (e: AuditEntry): string =>
  e.synthetic ? "REGISTERED" : (e.action || e.label);

/** Server entry -> the shape this module's screens already read. Keys and
 *  types are unchanged; only where they come from has moved. */
function toEvent(e: AuditEntry, userId: string): AuditEvent {
  const type = auditType(e);
  /* HOW TO DRAW IT, remembered as it arrives: the server's own sentence for the
     action and a tone derived from its verb. No stored map, and nothing to seed
     -- see `rememberType`. */
  rememberType(type, e);
  return {
    /* Stable and unique per row. The registration line has no id of its own
       because there is no stored row behind it. */
    eventId: e.id === null ? "AU-REG-" + userId : "AU-" + e.id,
    userId,
    type,
    actor: e.actorName || e.actor || "System",
    actorRole: e.role || "System",
    at: e.ts || "",
    note: e.detail,
  };
}

/** The record's timeline, newest first. Append-only and never filtered by
 *  event type: rows written before this module gave up the commercial
 *  lifecycle are still rows about things that happened to this account, and
 *  hiding them would be editing history to match today's feature set. */
export function useTimeline(userId: string | null): AuditEvent[] {
  const [rows, setRows] = useState<AuditEvent[]>([]);
  useEffect(() => {
    if (!userId) { setRows([]); return; }
    const ref = (/^IB-U-(\d+)$/.exec(userId) || [])[1] || userId;
    let live = true;
    void (async () => {
      try {
        const got = await call(AdminOpsService.userAudit(ref, { pageSize: 100 }));
        if (live) setRows(got.entries.map((e) => toEvent(e, userId)));
      } catch {
        /* A reference the server does not know is a REFUSAL, not a failure,
           and it is the normal case for a seeded record. Either way the tab
           shows its own empty state rather than a fixture -- showing invented
           history because a read did not land is the one outcome worth
           avoiding here. */
        if (live) setRows([]);
      }
    })();
    return () => { live = false; };
  }, [userId]);
  return rows;
}

/** The module-wide feed Analytics shows: the same trail, narrowed on the server
 *  to rows ABOUT A PLATFORM ACCOUNT (`subject=platform`).
 *
 *  Narrowed there rather than here for the reason every filter in this module is
 *  on the server: a page of twenty rows filtered in the browser answers "the
 *  last twenty things that happened anywhere, of which these were about users",
 *  which is a different question and a shorter list. A row about a staff member
 *  belongs on the Team screens, and a row about a plan price is about no person
 *  at all.
 *
 *  The names come from the audit row itself (`subjectName`), so somebody who is
 *  not on the loaded page still reads as a person rather than as an id. */
export function useRecentActivity(limit: number): (AuditEvent & { userName: string })[] {
  const [rows, setRows] = useState<(AuditEvent & { userName: string })[]>([]);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const got = await call(AdminOpsService.audit({ subject: "platform", pageSize: limit }));
        if (!live) return;
        setRows(got.entries.map((e) => {
          const userId = "IB-U-" + e.subjectUser;
          return { ...toEvent(e, userId), userName: e.subjectName || e.subjectUsername || userId };
        }));
      } catch {
        /* A refused or failed read shows the feed's own empty state. Inventing
           activity because a read did not land is the one outcome worth
           avoiding on a screen that says what just happened. */
        if (live) setRows([]);
      }
    })();
    return () => { live = false; };
  }, [limit]);
  return rows;
}

/* ============================================================= writes ===
   EVERY FUNCTION BELOW IS AN ENDPOINT (2026-09-16). Each one refuses locally
   first — the same rules the form applies, so a mistake is answered without a
   round trip — then sends ONLY WHAT MOVED, folds the record the server answers
   with into the snapshot, and re-reads the page behind it.

   THE SERVER IS THE LAST LINE, never this file. It re-checks every rule against
   the profile schema rows and refuses the whole patch on one bad field, so what
   is here is the same check said EARLIER, not instead. Nothing here writes
   money, nothing here touches a staff role, and nothing here records what
   anybody bought. */

const findUser = (id: string) => snap.users.filter((u) => u.userId === id)[0] || null;

/** Folds one server record in and tells the screens. The page behind it is
 *  re-read in the background because the directory row carries the account
 *  status, the tags and the go-live score, and a write can move all three. */
function landed(record: PlatformUserRecord): void {
  applyUserRecord(record);
  emit();
  /* AND AGAIN WHEN THE PAGE LANDS. A directory row carries none of the business
     profile — no About, no facets — so the reload would otherwise overwrite the
     open record with the thinner row and blank the fields somebody just saved,
     until they navigated away and back. */
  void reloadPage().then(() => { applyUserRecord(record); emit(); });
}

/**
 * UM-T07 · Profile update. `PATCH platform-users/<pk>/`.
 *
 * Validate → send the changed fields → fold the stored record back in. A
 * correction nobody can see is worse than none, so the server writes an audit
 * line carrying the before and the after of every field that moved.
 */
export async function updateProfile(userId: string, patch: Partial<UserProfile>): Promise<string> {
  const u = findUser(userId);
  if (!u) return "That user no longer exists.";
  /* ONLY EDITABLE SCHEMA FIELDS. `profileId`, `schemaVersion`,
     `profileStatus` and the audit stamps are not fields of the record at all —
     a patch naming one is refused whole, which is what the endpoint does with
     it too (UM-T07). */
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
  /* BEFORE anything is sent. The form checks the same rules as you type, but
     the form is not the last line — this function is what an import or a bulk
     edit would call, and a facet only the dialog validates is a facet the
     browser never validates. */
  const invalid = validateFacets(patch);
  if (invalid) return invalid;
  /* UNIQUENESS IS NOT A FIELD RULE, so it is not in validateFacets: that
     answers "is this value well formed", which needs nothing but the value.
     This needs the whole table — and the loaded page is only part of it, which
     is why the server checks it again and its answer is the one that counts. */
  if (patch.username && usernameTaken(String(patch.username), userId)) {
    return "That username belongs to another profile. Nothing has been saved.";
  }
  const changed: Record<string, unknown> = {};
  (Object.keys(patch) as (keyof UserProfile)[]).forEach((k) => {
    const before = JSON.stringify(u.profile[k] ?? null);
    const after = JSON.stringify(patch[k] ?? null);
    if (before !== after) changed[String(k)] = patch[k] ?? null;
  });
  /* THE CHANGED FIELDS ONLY. The form hands over every field it renders, and
     sending the untouched ones would ask the server to write fields nobody
     edited — including Location, which is derived from the business address
     and its shops and has nowhere to be written back to. That would refuse a
     save somebody made to a different field entirely. */
  if (!Object.keys(changed).length) return "";
  try {
    landed(await call(AdminOpsService.updatePlatformUserProfile(pkOf(userId), changed)));
    return "";
  } catch (e) {
    return errMessage(e);
  }
}

/** UM-T12 · Internal note. `POST platform-users/<pk>/notes/`.
 *
 *  A note is a body of text, an author and a moment, and there is a model that
 *  holds the three now (interior_admin Note, subjectType `platform_user`). The
 *  author is the SERVER's — the signed-in admin — and is what decides later who
 *  may change it; the audit line records that a note was written and by whom,
 *  never what it says.
 *
 *  The record comes back carrying its notes, so the tab shows what was stored
 *  rather than what this tab hoped it stored. */
export async function addNote(userId: string, text: string): Promise<string> {
  if (!findUser(userId)) return "That user no longer exists.";
  if (!text.trim()) return "A note needs some text.";
  try {
    landed(await call(AdminOpsService.addPlatformUserNote(pkOf(userId), text.trim())));
    return "";
  } catch (e) {
    return errMessage(e);
  }
}

/** The operational tags this account carries, as a SET: whatever the dialog
 *  hands back is the answer, and add/remove is derived from what is already
 *  there — on this side to skip a no-op call, and again on the server, which is
 *  where the assignment rows are actually written. */
export async function setTags(userId: string, slugs: string[]): Promise<string> {
  const u = findUser(userId);
  if (!u) return "That user no longer exists.";
  const before = u.tags.map((t) => t.slug);
  const added = slugs.filter((s) => before.indexOf(s) < 0);
  const removed = before.filter((s) => slugs.indexOf(s) < 0);
  /* Checked on what is BEING ADDED. A tag retired after it was applied is still
     on this account, and refusing the whole save because of one would leave the
     dialog unable to remove anything else. */
  const known = TAGS.map((t) => t.slug);
  const stray = added.filter((x) => known.indexOf(x) < 0);
  if (stray.length) return "Unknown tag: " + stray.join(", ") + ". Tags are a closed list.";
  if (!added.length && !removed.length) return "";
  try {
    landed(await call(AdminOpsService.setPlatformUserTags(pkOf(userId), slugs)));
    return "";
  } catch (e) {
    return errMessage(e);
  }
}

/** Account status. Soft by construction: the profile, the commercial
 *  references and the audit trail all stay, and the server revokes the
 *  account's sessions so a live token cannot outlast the decision. Hard
 *  deletion is a governed privacy process and has no button. */
export async function setUserStatus(userId: string, status: "active" | "deactivated", reason: string): Promise<string> {
  const u = findUser(userId);
  if (!u) return "That user no longer exists.";
  if (u.userStatus === status) return "";
  if (status === "deactivated" && !reason.trim()) return "Deactivating an account needs a reason.";
  try {
    landed(await call(AdminOpsService.setPlatformUserStatus(pkOf(userId), status, reason.trim())));
    return "";
  } catch (e) {
    return errMessage(e);
  }
}

/* --------------------------------------------------------- the catalogue ---
   The list everybody picks from, which is a different thing from the tags on
   one account. Both writes re-read the vocabulary afterwards, because every
   picker and every chip in this module is drawn from it. */

export async function createTag(tag: { label: string; tone?: string; help?: string }): Promise<string> {
  if (!tag.label.trim()) return "A tag needs a label.";
  try {
    await call(AdminOpsService.createUserTag({ ...tag, label: tag.label.trim() }));
    await bootUsersVocab(true);
    return "";
  } catch (e) {
    return errMessage(e);
  }
}

/** Retire a tag, or bring it back. RETIRING KEEPS EVERY ASSIGNMENT: the
 *  accounts carrying it still carry it, it just stops being offered — deleting
 *  the row would rewrite who was ever tagged. */
export async function setTagActive(slug: string, isActive: boolean): Promise<string> {
  try {
    await call(AdminOpsService.updateUserTag(slug, { isActive }));
    await bootUsersVocab(true);
    return "";
  } catch (e) {
    return errMessage(e);
  }
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

/* ===================================================== the series, live ===
   `GET /admin/users/analytics/` — the monthly series counted from the accounts
   themselves: registrations from each account's own creation stamp, the channel
   from `registrationSource` ("" is NOT RECORDED and is shown as that, never
   folded into a channel), and profile completion graded against the required
   rows of the profile schema. Nothing on that page is stored anywhere and
   nothing on it is estimated.

   `let`, not `const`, so the assignment when the read lands is visible through
   the ES live bindings every consumer already imports — the same move the value
   lists above make. Empty until it lands, and the arithmetic below answers for
   an empty series rather than throwing on it. */
export let MONTHS: MonthRow[] = [];
/** The channels the split is keyed by, as the server names them ("" = Not
 *  recorded). Its own list rather than REGISTRATION_SOURCES because it also
 *  carries the channels that only exist on old rows. */
let ANALYTICS_SOURCES: VocabOption[] = [];
/** The whole population, counted by the server NOW: not the page the directory
 *  happens to have loaded, and not the range. Null until the read lands. */
let ANALYTICS_BASE: Counts | null = null;

/** The base counts for the tiles, or the loaded page's own counts while the
 *  read is in flight. The server's answer is the honest one — the page is 20
 *  rows of a population that is not. */
export const baseCounts = (rows: UserRow[]): Counts => ANALYTICS_BASE || countsOf(rows);

/** Plants a fetched payload. Its own function so a check can state "the
 *  analytics arrived" without standing up a server. */
export function applyUsersAnalytics(a: UsersAnalytics): void {
  MONTHS = (a.months || []) as MonthRow[];
  ANALYTICS_SOURCES = (a.sources || []).map((r) => ({ key: r.key, label: r.label }));
  ANALYTICS_BASE = a.base || null;
  if (a.asOf) applyServerDate(a.asOf);
}

/** The series grouped by year, which is how the month picker lays it out. Here
 *  rather than memoised inside that control: the months are read from the
 *  server and arrive after it has already rendered once, and grouping a dozen
 *  rows is cheaper than the bug where the grid stays empty for good. */
export function monthsByYear(): { year: string; months: MonthRow[] }[] {
  const out: { year: string; months: MonthRow[] }[] = [];
  MONTHS.forEach((m) => {
    const y = m.month.slice(0, 4);
    const row = out.filter((r) => r.year === y)[0];
    if (row) row.months.push(m); else out.push({ year: y, months: [m] });
  });
  return out;
}

export interface AnalyticsState { ready: boolean; error: string | null }
let analytics: AnalyticsState = { ready: false, error: null };
let analyticsStarted = false;

export async function bootUsersAnalytics(force = false): Promise<void> {
  if (analyticsStarted && !force) return;
  analyticsStarted = true;
  analytics = { ready: false, error: null };
  try {
    applyUsersAnalytics(await call<UsersAnalytics>(AdminOpsService.usersAnalytics()));
    analytics = { ready: true, error: null };
  } catch (e) {
    analytics = { ready: false, error: errMessage(e) };
  }
  emit();
}

/** Subscribes the analytics face to the read, and starts it on first mount. */
export function useUsersAnalytics(): AnalyticsState {
  useVersion();
  useEffect(() => { void bootUsersAnalytics(); }, []);
  return analytics;
}

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
  /* NO SERIES, NO RANGE. Until the read lands there is no month to clamp to,
     and answering with a month nobody has any figures for would draw a chart of
     zeros that reads like a platform nobody signed up to. */
  if (!MONTHS.length) return { from: "", to: "" };
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
  if (!n) {
    /* An empty series answers with empty totals and a rate of NULL — which
       prints as "n/a", the one honest reading of a figure nobody has yet. */
    return {
      months: [], from, to, monthCount: 0, label: "", registrations: 0, profileCompleted: 0,
      completion: rate(0, 0), bySource: [], prev: null,
    };
  }
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
      /* The payload's own channel names first: they cover the ones the value
         list no longer offers, and "" (never recorded) is one of them. */
      label: ANALYTICS_SOURCES.filter((s) => s.key === k)[0]?.label
        || REGISTRATION_SOURCES.filter((s) => s.key === k)[0]?.label || k,
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
  if (!MONTHS.length) return { from: "", to: "" };
  const b = MONTHS.length - 1;
  const a = Math.max(0, b - months + 1);
  return { from: MONTHS[a].month, to: MONTHS[b].month };
}

/** Which preset a range corresponds to, or "" when it is a hand-picked span.
 *  Derived rather than stored, so a range arrived at by the calendar that
 *  happens to equal a preset lights that preset up. */
export function presetOf(from: string, to: string): string {
  /* With no series every preset resolves to the same empty range, so one of
     them would light up as though it were the span on screen. */
  if (!MONTHS.length) return "";
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
