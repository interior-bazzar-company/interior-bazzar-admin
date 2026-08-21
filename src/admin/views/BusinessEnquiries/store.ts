/* =============================================================================
   Business Enquiries — the data layer.
   -----------------------------------------------------------------------------
   THE ENQUIRIES ARE REAL. `GET v1/admin/business-enquiries/` serves the queue —
   a projection of LeadQuery, the table the site's own forms have been writing to
   all along — alongside the vocabulary, the rule set and the business directory.
   The one remaining stand-in is `suggestions.json`, which holds the candidate
   runs the matching endpoint will produce; it is local-only and ships nowhere.
   The rest of the map from file → endpoint is in
   `src/proto/v-2.2.0.0/BACKEND-INTEGRATION.md`, and it is the backend work-list.

   WHAT THE PROJECTION CANNOT ANSWER ARRIVES EMPTY, never guessed: contact log,
   remarks beyond the one stored on the lead, the qualification freeze, the event
   timeline, the owner, and the rank/score on an assignment (those carry rule
   version `legacy`, which is what says the zeros are a missing record and not a
   bad score). A blank contact log means nobody logged a call.

   ONE WRITE IS REAL: createEnquiry() posts, and the server answers with its own
   projection of the row it wrote. Every other write is still SIMULATED IN
   MEMORY, for this browser tab, for this session — and they simulate on top of
   live records, so a reload discards them and re-fetches rather than restoring
   a fixture. That
   is a deliberate choice and not a hidden one — every screen that can write
   says so on the screen, and a reload puts the seed back. The alternative was
   a read-only prototype, which cannot show the thing this module is actually
   for: the qualify → match → assign → outcome chain, and what each step
   freezes on the way past.

   What the simulation DOES honour, because these are the rules the API has to
   enforce and they are cheap to model here:
     · one active assignment per enquiry, via `activeAssignmentId`
     · reassignment CLOSES the current assignment (`supersededAt`) — never
       deletes it
     · capacity moves with the assignment, and is released on outcome
     · the score, rank, factor breakdown and rule version are COPIED onto the
       assignment, not referenced
     · every write appends an event; nothing edits or removes one
   What it does NOT honour, and cannot: row locks, concurrency, the 409/422
   refusals. Those are server facts. The screens name them where they would
   fire so the API contract stays visible.
   ============================================================================= */
import { useEffect, useState } from "react";
import suggestionsJson from "../../../content/business-enquiries/suggestions.json";
import BusinessEnquiriesService from "../../../api/modules/businessEnquiries";
import type {
  BusinessesResponse, CreateEnquiryResponse, EnquiriesResponse, EnquiryQuery,
  MatchingRulesResponse, VocabulariesResponse,
} from "../../../api/modules/businessEnquiries";
import { call } from "../../../api/modules/adminOps";
import { currentActor } from "../../auth/session";

/* ============================================================ THE SHAPES === */

export type StatusKey =
  | "generated" | "processing" | "qualified" | "no_match" | "assigned"
  | "converted" | "not_converted" | "invalid";

export type Assignment = {
  assignmentId: string;
  businessId: string;
  businessName: string;
  candidateRank: number;
  candidateScore: number;
  eligibleCount: number;
  factorSnapshot: Record<string, number>;
  ruleVersion: string;
  assignedBy: string;
  assignedByRole: string;
  assignedAt: string;
  deliveryStatus: "pending" | "delivered" | "failed";
  deliveredAt: string | null;
  overrideReason: string | null;
  supersededAt: string | null;
  closedReason?: string;
};

export type EnquiryEvent = {
  eventId: string;
  type: string;
  actor: string;
  actorRole: string;
  at: string;
  note: string;
};

/* One attempt to reach the customer, and what came back. This is the
   qualification workstream: an enquiry is not qualified because a form was
   submitted, it is qualified because a person got hold of the customer and
   confirmed what they want.

   `response` is the customer's own words and is the field that earns its keep —
   "wants to see designs first" and "possession is done, moving in October" are
   the same category and location on the form, and completely different work.
   `note` is the operator's read of it. Keeping them apart matters: one is
   evidence, the other is interpretation, and only the first should ever be
   quoted to a business. */
export type ContactEntry = {
  logId: string;
  channel: string;
  direction: "outbound" | "inbound";
  at: string;
  actor: string;
  actorRole: string;
  outcome: string;
  response: string | null;
  note: string | null;
};

/* AN INTERNAL NOTE, and deliberately not a contact-log entry.

   The log records an ATTEMPT to reach the customer and what they said back; a
   remark is what we think, with no attempt attached — "her architect is the one
   who decides", "third enquiry from this building in six weeks". Folding these
   into the log would mean inventing a fake attempt to hold each one, and every
   count that reads the log would inherit the lie: `contactLog.length`,
   `everReached()` and the qualification gate all treat a row as evidence that
   somebody picked up a phone.

   Append-only, like the log and the timeline. And like the log, a remark NEVER
   leaves the panel — not in an export, a copy, a print or an image. It is the
   most candid thing written about a customer anywhere in this module, which is
   exactly why it is the least shareable. */
export type Remark = {
  remarkId: string;
  text: string;
  actor: string;
  actorRole: string;
  at: string;
};

export type Checklist = {
  reachable: boolean;
  requirement: boolean;
  genuine: boolean;
  urgency: boolean;
};

export type Enquiry = {
  enquiryId: string;
  submissionId: string;
  /** Where it came from, and — when a person typed it — who and how. Never
   *  blank: provenance is the first thing anyone asks about a record that turns
   *  out to be wrong. */
  source: {
    kind: string; page: string; label: string;
    createdBy: string | null; via: string | null;
  };
  customer: { name: string; phone: string; email: string | null };
  requirement: {
    category: string | null; service: string | null;
    city: string | null; state: string | null; locality: string | null; pincode: string | null;
    projectType: string | null; intent: string | null; text: string;
  };
  /* `version` and `frozenAt` are NULL until a person marks the enquiry
     Qualified. That is the whole change of shape from the first cut of this
     module: the snapshot is not frozen by the form arriving, it is frozen by
     someone taking responsibility for it. Immutability is unchanged — it just
     starts later, at the point there is something worth making immutable. */
  qualification: {
    contactVerified: boolean; verifiedVia: string | null;
    genuineness: string; genuinenessNote: string;
    urgency: string | null; requirementSummary: string | null;
    version: string | null; frozenAt: string | null;
    checklist: Checklist;
    qualifiedBy: string | null; qualifiedByRole: string | null;
  };
  tags: string[];
  contactLog: ContactEntry[];
  /** Internal notes. Never exported, copied, printed or drawn. See `Remark`. */
  remarks: Remark[];
  status: StatusKey;
  tier: string;
  createdAt: string;
  activeAssignmentId: string | null;
  assignments: Assignment[];
  outcome: {
    assignmentId: string; firstContactAt: string | null;
    status: string; outcome: string | null; reason: string | null;
    notes: string | null; updatedBy: string; updatedAt: string;
  } | null;
  exception?: { code: string; note: string };
  invalidation?: { reason: string; detectedBy: string; detectedAt: string; note: string };
  events: EnquiryEvent[];
};

export type Candidate = {
  businessId: string; name: string; rank: number; score: number; band: string;
  capacity: { active: number; configured: number };
  factors: Record<string, number>;
  why: string;
  from: Record<string, string>;
};

export type Exclusion = { businessId: string; name: string; stage: string; reason: string };

export type MatchRun = {
  enquiryId: string; ruleVersion: string; calculatedAt: string; subscribedCount: number;
  eligible: Candidate[]; excluded: Exclusion[];
};

export type Business = {
  businessId: string; name: string; categories: string[]; serviceArea: string[];
  plan: string; subscription: string; renewsAt: string | null; status: string;
  suspendedAt?: string;
  capacity: { configured: number; active: number; period: string };
  /* Both NULLABLE, because the server refuses to invent an operational record:
     a business nobody has measured reports no acknowledgement time rather than
     0 hours, and one with no decided lead reports no ratio rather than "0 of 0".
     Nothing renders these today — the suggestion card prints the engine's own
     `from.quality` sentence — so this is the type telling the truth about the
     payload, not a display change. */
  quality: { avgAckHours: number | null; convertedOfLast: string | null };
};

export type StatusRow = {
  key: StatusKey; label: string; tone: string; step: number;
  meaning: string; advance: string; terminal?: boolean;
  /* An exceptional state that is NOT a step on the way anywhere — the lifecycle
     rail leaves it out rather than implying every enquiry passes through it. */
  offRamp?: boolean;
};

/* ======================================================= THE STATIC READS ===
   Rules, businesses and vocabularies come from the API and do not change inside
   a session. They are fetched once by `bootBusinessEnquiries()` below and then
   read straight off the module, exactly as they were when they were bundled
   JSON — every consumer below and in the views is unchanged.

   `let`, not `const`, so the assignment at boot is visible through the ES live
   bindings the views import. Nothing reads these at module scope; every use is
   inside a render or a callback, which happens after the boot gate opens.

   THERE IS NO SEED VALUE AND NO FALLBACK. If the fetch fails these stay empty
   and the route renders its failure instead of a screen — a panel that silently
   falls back to bundled data cannot tell you whether the backend is wired up. */

export let RULES = {} as MatchingRulesResponse;
export let VOCAB = {} as VocabulariesResponse;
export let STATUSES: StatusRow[] = [];
export let SUBSCRIBED_COUNT = 0;

export const statusOf = (k: string): StatusRow =>
  STATUSES.filter((s) => s.key === k)[0] ||
  ({ key: k as StatusKey, label: k, tone: "", step: 0, meaning: "", advance: "" });

export const urgencyOf = (k: string | null) =>
  VOCAB.urgency.filter((u) => u.key === k)[0] || null;

export type TagRow = { slug: string; label: string; tone: string; auto: boolean; help: string };
export type ChecklistRow = { key: keyof Checklist; label: string; help: string };
export type OutcomeRow = {
  key: string; label: string; tone: string; reached: boolean; autoTag: string;
};
export type TierRow = { key: string; label: string; help: string };
export type SourceRow = {
  key: string; label: string; short: string; tone: string; manual: boolean; help: string;
};

export let TAGS: TagRow[] = [];
export let CHECKLIST: ChecklistRow[] = [];
export let CHANNELS: { key: string; label: string; verb: string }[] = [];
export let CONTACT_OUTCOMES: OutcomeRow[] = [];
export let TIERS: TierRow[] = [];
export let SOURCES: SourceRow[] = [];
export let STATES: string[] = [];
export let RECEIVED_RANGES: { key: string; label: string }[] = [];

/* CATEGORY AND CITY ARE TYPED, SO THE VOCABULARY IS A SUGGESTION LIST AND NOT A
   GATE. An operator on a call hears whatever the customer says; a dropdown that
   cannot hold it forces a wrong pick or a blank, and both are worse than an
   unfamiliar value.

   What the panel owes in exchange is honesty about the consequence: stage 1
   eliminates on category and location, so a value the matching rules have never
   seen will match nobody. These two say when that is about to be true, and the
   forms show it beside the field — not as an error, because the value may be
   perfectly correct and the vocabulary simply behind. */
export const knownCategory = (v: string | null): boolean =>
  !v || VOCAB.categories.indexOf(v) >= 0;
export const knownCity = (v: string | null): boolean =>
  !v || VOCAB.cities.indexOf(v) >= 0;
export let MANUAL_VIA: { key: string; label: string }[] = [];

export const sourceOf = (key: string): SourceRow =>
  SOURCES.filter((x) => x.key === key)[0] ||
  ({ key, label: key, short: key, tone: "", manual: false, help: "" });

export const viaLabel = (key: string | null): string =>
  (key && MANUAL_VIA.filter((m) => m.key === key)[0]?.label) || "";


export const tierOf = (key: string): TierRow =>
  TIERS.filter((t) => t.key === key)[0] || ({ key, label: "Tier " + key, help: "" });

export const tagOf = (slug: string): TagRow =>
  TAGS.filter((t) => t.slug === slug)[0] ||
  ({ slug, label: slug, tone: "", auto: false, help: "" });

export const channelOf = (key: string) =>
  CHANNELS.filter((c) => c.key === key)[0] || { key, label: key, verb: key };

export const contactOutcomeOf = (key: string): OutcomeRow =>
  CONTACT_OUTCOMES.filter((o) => o.key === key)[0] ||
  ({ key, label: key, tone: "", reached: false, autoTag: "" });

export const transitionOf = (from: string) =>
  VOCAB.transitions.filter((t) => t.from === from)[0] || { from, to: [] as string[], guard: "" };

/** Terminal states carry a reason and cannot move. Reopening needs an admin
 *  policy that does not exist in v1, so the screens do not offer it. */
export const isTerminal = (k: string) => !!statusOf(k).terminal;

/* ============================================================ THE STORE ===
   A module-level singleton, exactly like admin/auth/session.ts — the views
   call `useEnquiries()` / `useEnquiry(id)` and re-render off one bump counter.
   Not Redux and not context: every write here is a whole-record replacement,
   and there is one writer. */

type Store = { enquiries: Enquiry[]; runs: Record<string, MatchRun>; businesses: Business[] };

/* Both arrive from the API and are planted by the boot below, so they survive
   resetStore() — they are reads of the server, not something this panel writes.
   resetStore() therefore means "discard my simulated writes", which is exactly
   what it says on the banner. Runs are the one remaining stand-in. */
let fetchedBusinesses: Business[] = [];
let fetchedEnquiries: Enquiry[] = [];

/* THE SUGGESTION SEED IS LOCAL ONLY. `import.meta.env.DEV` is true for `vite dev`
   and false for every build, including `build:dev` — so suggestions.json is
   tree-shaken out of the bundle that ships to dev, stage and prod. It is keyed by
   the ids of the old fixture enquiries, which no longer exist, so it produces
   nothing against live records either: the matching screens stay empty until
   `POST /business-enquiries/{id}/match` lands, which is the honest state. */
const LOCAL_SEED = import.meta.env.DEV;

/* Candidate snapshots for enquiries that have NOT been matched yet, so running
   matching on one produces the ranked list the real endpoint would. Kept out of
   `store.runs` because that holds runs that already happened. */
const pendingRuns: Record<string, MatchRun> = LOCAL_SEED
  ? ((suggestionsJson as { pending?: Record<string, MatchRun> }).pending || {})
  : {};

const seed = (): Store => ({
  /* A COPY, so a simulated write cannot edit the fetched rows and survive a
     resetStore() that is supposed to throw it away. */
  enquiries: JSON.parse(JSON.stringify(fetchedEnquiries)) as Enquiry[],
  runs: LOCAL_SEED
    ? (JSON.parse(JSON.stringify(suggestionsJson.runs)) as Record<string, MatchRun>)
    : {},
  businesses: fetchedBusinesses,
});

let store: Store = seed();
let version = 0;
const listeners = new Set<() => void>();
const bump = () => { version += 1; listeners.forEach((fn) => fn()); };

/** Back to the seed. The prototype banner offers this so a demo can be run
 *  twice without a page reload. */
export function resetStore() { store = seed(); bump(); }

/* ============================================================== THE BOOT ===
   Three reads, once per mount of the module, before anything renders.

   The views read VOCAB / RULES / TAGS / TEAM synchronously — they always did,
   when these were bundled JSON — so the swap to an API keeps that contract by
   fetching first and rendering second, rather than by threading a loading state
   through twelve files. The route component holds the gate; nothing else in the
   module knows this changed.

   ON FAILURE IT STAYS FAILED. No retry loop, no cached copy, no defaults: the
   error is stored and the route prints it, naming the call that broke. The
   whole point of deleting the JSON files was that a wrong or missing backend
   has to be visible, and a panel that renders fine on bundled data cannot tell
   you which one you are looking at. */

export type BootState = { ready: boolean; error: string | null };

let boot: BootState = { ready: false, error: null };
let bootStarted = false;

export function bootState(): BootState { return boot; }

/** Plants a fetched vocabulary across the module bindings the views read.
 *  Split out of the boot because it is the whole of what "the vocabulary
 *  arrived" means, and because the offline checks (check:clock) need to state
 *  the same thing without standing up a server. */
export function applyVocabulary(vocab: VocabulariesResponse): void {
  VOCAB = vocab;
  STATUSES = (vocab.statuses || []) as StatusRow[];
  TAGS = (vocab.tags || []) as TagRow[];
  CHECKLIST = (vocab.qualificationChecklist || []) as ChecklistRow[];
  CHANNELS = vocab.contactChannels || [];
  CONTACT_OUTCOMES = (vocab.contactOutcomes || []) as OutcomeRow[];
  TIERS = (vocab.tiers || []) as TierRow[];
  SOURCES = (vocab.sources || []) as SourceRow[];
  STATES = vocab.states || [];
  RECEIVED_RANGES = vocab.receivedRanges || [];
  MANUAL_VIA = vocab.manualVia || [];
}

/** Re-runs the three reads. The route calls this on mount; the failure screen
 *  offers it as Retry. */
export async function bootBusinessEnquiries(force = false): Promise<void> {
  if (bootStarted && !force) return;
  bootStarted = true;
  boot = { ready: false, error: null };
  bump();

  try {
    /* THREE READS, and the enquiries are no longer one of them. The queue is
       paged now and its query changes with every filter, so the rows are
       fetched by useEnquiryPage below rather than once at boot — what stays
       here is the reference data that does not change inside a session. */
    const [vocab, rules, businesses] = await Promise.all([
      call<VocabulariesResponse>(BusinessEnquiriesService.vocabularies()),
      call<MatchingRulesResponse>(BusinessEnquiriesService.matchingRules()),
      call<BusinessesResponse>(BusinessEnquiriesService.businesses()),
    ]);

    applyVocabulary(vocab);
    RULES = rules;

    SUBSCRIBED_COUNT = businesses.subscribedCount;
    fetchedBusinesses = businesses.businesses || [];
    store.businesses = fetchedBusinesses;

    /* A re-boot is a re-read: anything simulated in this tab goes with it, and
       the page reloads itself from the server on the next render. */
    pageKey = "";
    boot = { ready: true, error: null };
  } catch (e) {
    boot = {
      ready: false,
      error: e instanceof Error ? e.message : "Business Enquiries data did not load.",
    };
  }
  bump();
}

/** Subscribes a component to the boot, and starts it on first mount. */
export function useBoot(): BootState {
  useVersion();
  useEffect(() => { void bootBusinessEnquiries(); }, []);
  return boot;
}

function useVersion() {
  const [, setV] = useState(version);
  useEffect(() => {
    const fn = () => setV(version);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
}

/* ============================================================== THE PAGE ===
   The queue is one page of a server-side query now, and the three things that
   used to happen in the browser — filter, sort, cut — all happen before it
   arrives, in that order. Doing them here meant fetching every enquiry to show
   fifty, and it meant a page cut after a filter that ran in the tab, which is
   page 2 of the unfiltered queue with most of it missing.

   `store.enquiries` still holds exactly what is on screen, so every simulated
   write below keeps working unchanged — they all look the row up by id in that
   array and none of them ever cared how it got there. */

export const PAGE_SIZE = 50;

export type ServerCounts = EnquiriesResponse<Enquiry>["counts"];

export type PageState = {
  rows: Enquiry[];
  total: number;
  pageNo: number;
  pageSize: number;
  /** Over the WHOLE filtered set, never the page. Null until the first read
   *  lands — the strip renders nothing rather than zeros, because a zero is a
   *  number and "we do not know yet" is not. */
  counts: ServerCounts | null;
  loading: boolean;
  error: string | null;
};

let page: PageState = {
  rows: [], total: 0, pageNo: 1, pageSize: PAGE_SIZE,
  counts: null, loading: true, error: null,
};
/* The query the current `page` answers. Compared as a string so a re-render
   with the same filters does not re-fetch, and any change to any filter does. */
let pageKey = "";

/** The panel's URL params, as the server's query. ONE PLACE that knows the two
 *  names differ (`from`/`to` are the URL's, `dateFrom`/`dateTo` are the API's),
 *  because the day they disagree the received filter silently stops applying
 *  and the queue just looks wrong. */
export function queryFromParams(p: Params, pageNo = 1): EnquiryQuery {
  return {
    pageNo, pageSize: PAGE_SIZE,
    status: p.status, category: p.category, city: p.city, state: p.state,
    urgency: p.urgency, tier: p.tier, tag: p.tag, source: p.source,
    business: p.business, owner: p.owner, flag: p.flag,
    received: p.received, dateFrom: p.from, dateTo: p.to,
    q: p.q, sort: p.sort,
  };
}

export async function loadPage(query: EnquiryQuery, force = false): Promise<void> {
  const key = JSON.stringify(query);
  if (key === pageKey && !force) return;
  pageKey = key;
  page = { ...page, loading: true, error: null };
  bump();
  try {
    const got = await call<EnquiriesResponse<Enquiry>>(
      BusinessEnquiriesService.enquiries<Enquiry>(query));
    /* Ignore a response whose query is no longer the current one: filters are
       typed, so two reads can be in flight and the slower one must not land
       last and repaint the table with the wrong rows. */
    if (key !== pageKey) return;
    page = {
      rows: got.enquiries || [], total: got.total, pageNo: got.pageNo,
      pageSize: got.pageSize, counts: got.counts, loading: false, error: null,
    };
    fetchedEnquiries = page.rows;
    store.enquiries = page.rows.slice();
  } catch (e) {
    if (key !== pageKey) return;
    page = {
      ...page, rows: [], loading: false,
      error: e instanceof Error ? e.message : "The queue did not load.",
    };
    fetchedEnquiries = [];
    store.enquiries = [];
  }
  bump();
}

/** THE TWO INTAKE NUMBERS IN THE TOPBAR, counted by the server over the whole
 *  queue rather than over the fifty rows on screen. Two `pageSize: 1` reads:
 *  nothing but `total` is wanted, and `total` is counted before the page is cut.
 *  Deliberately NOT derived from `page.counts` — those are counted over the
 *  CURRENT FILTERS, and "how much came in today" has to mean the same thing
 *  whatever the operator has narrowed the list to.
 *  ponytail: two requests on mount. One endpoint returning both windows would
 *  be better; it is not worth a backend change for two integers. */
export function useIntakeCounts(): { today: number; week: number } {
  const [n, setN] = useState({ today: 0, week: 0 });
  useEffect(() => {
    let live = true;
    const count = async (received: string) => {
      const got = await call<EnquiriesResponse<Enquiry>>(
        BusinessEnquiriesService.enquiries<Enquiry>({ pageNo: 1, pageSize: 1, received }));
      return got.total;
    };
    void (async () => {
      try {
        const [today, week] = await Promise.all([count("today"), count("7d")]);
        if (live) setN({ today, week });
      } catch {
        /* A topbar figure is not worth a failure screen; the boot gate already
           says when the backend is unreachable. Zeros stand. */
      }
    })();
    return () => { live = false; };
  }, []);
  return n;
}

export function useEnquiryPage(query: EnquiryQuery): PageState {
  useVersion();
  const key = JSON.stringify(query);
  useEffect(() => { void loadPage(query); }, [key]);  // eslint-disable-line react-hooks/exhaustive-deps
  return page;
}

/** What is on screen. Unchanged for every caller — it is the page now. */
export function useEnquiries(): Enquiry[] {
  useVersion();
  return store.enquiries;
}

/* One record that is NOT on the current page — a deep link, a bookmark, or an
   enquiry whose status changed under a filter it no longer matches. Kept beside
   the page rather than merged into it: the page is what the table shows and the
   pager counts, and quietly adding a row to it would put an enquiry on screen
   that the filter excludes. */
const detailCache: Record<string, Enquiry> = {};
let detailPending = "";

export function useEnquiry(id: string | null): Enquiry | null {
  useVersion();
  useEffect(() => {
    if (!id || store.enquiries.some((e) => e.enquiryId === id) || detailCache[id]) return;
    if (detailPending === id) return;
    detailPending = id;
    void (async () => {
      try {
        const got = await call<{ enquiry: Enquiry }>(
          BusinessEnquiriesService.enquiry<Enquiry>(id));
        if (got?.enquiry) detailCache[id] = got.enquiry;
      } catch {
        /* Left absent. The record screen already renders "not found" for an id
           that is not there, and a half-record would be worse than none. */
      } finally {
        detailPending = "";
        bump();
      }
    })();
  }, [id]);
  if (!id) return null;
  return store.enquiries.filter((e) => e.enquiryId === id)[0] || detailCache[id] || null;
}

export function useMatchRun(id: string | null): MatchRun | null {
  useVersion();
  if (!id) return null;
  return store.runs[id] || null;
}

/** The business DIRECTORY, whole. Read straight off the module rather than
 *  through a hook: it is planted once at boot and never changes inside a
 *  session. The list's Business filter is built from this and not from the rows
 *  on screen — with a page, those name only the businesses this page happens to
 *  mention, and the filter you wanted would not be in the dropdown. */
export const businessDirectory = (): Business[] => store.businesses;

export const businessById = (id: string) =>
  store.businesses.filter((b) => b.businessId === id)[0] || null;

/* ========================================================== THE DERIVES === */

export const activeAssignment = (e: Enquiry): Assignment | null =>
  e.activeAssignmentId
    ? e.assignments.filter((a) => a.assignmentId === e.activeAssignmentId)[0] || null
    : null;

export const pastAssignments = (e: Enquiry): Assignment[] =>
  e.assignments.filter((a) => a.assignmentId !== e.activeAssignmentId);

export const assignedName = (e: Enquiry): string => {
  const a = activeAssignment(e);
  return a ? a.businessName : "";
};

/** Hours between two instants, rounded down. Every elapsed time this module
 *  prints is built on it. */
export function hoursBetween(a: string, b: string): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 3600000);
}

export function ageLabel(iso: string, now = new Date()): string {
  const h = hoursBetween(iso, now.toISOString());
  if (h < 1) return "just now";
  if (h < 24) return h + "h";
  return Math.floor(h / 24) + "d";
}

export function dateTimeLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

export function durationLabel(fromIso: string, toIso: string): string {
  const mins = Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000));
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h >= 24) return Math.floor(h / 24) + "d " + (h % 24) + "h";
  return h ? h + "h " + m + "m" : m + "m";
}

/* ------------------------------------------------- the qualification ----- */

/** The most recent entry that actually carries the customer's words. Not simply
 *  the newest log line: three "no answer" rows on top of one real conversation
 *  must not erase what the customer said. Reading it any other way would make
 *  the list's Last response column go blank every time someone tried again. */
export const lastResponse = (e: Enquiry): ContactEntry | null =>
  e.contactLog.filter((c) => !!c.response)[0] || null;

/** The newest attempt of any kind — what the list shows as "last touched", and
 *  what the "attempted N times, never reached" read-out counts from. */

export const everReached = (e: Enquiry): boolean =>
  e.contactLog.some((c) => contactOutcomeOf(c.outcome).reached);

export const checklistMissing = (e: Enquiry): ChecklistRow[] =>
  CHECKLIST.filter((row) => !e.qualification.checklist[row.key]);

/** The gate on Processing → Qualified. Two conditions, and the second is the
 *  one worth arguing about: every check ticked AND at least one logged attempt.
 *  Without the second, a member could tick four boxes on an enquiry nobody ever
 *  rang, and the checklist would be a formality rather than a record.
 *
 *  The attempt requirement is also why New has no direct route to Qualified —
 *  logging that first attempt is what makes the record Processing. */
export const canQualify = (e: Enquiry): boolean =>
  isWorking(e.status) && !checklistMissing(e).length && e.contactLog.length > 0;

/** THE TWO STATES WHERE THE RECORD IS STILL BEING WORKED. New is "nobody has
 *  tried yet", Processing is "somebody has". Both accept requirement edits,
 *  contact attempts, checklist ticks and tag changes; everything from Qualified
 *  onward refuses them, because that is the freeze.
 *
 *  A predicate rather than the disjunction written out at each call site: this
 *  is five guards, and the next state added before Qualified should be one edit
 *  here and not a hunt through the writes. */
export const isWorking = (k: string): boolean => k === "generated" || k === "processing";

export const place = (e: Enquiry): string =>
  [e.requirement.locality, e.requirement.city].filter(Boolean).join(", ") || "—";

/** Only rank-1 is free. Anything materially below it captures a reason —
 *  the threshold is the rule version's, not a constant in this file. */
export const needsOverrideReason = (run: MatchRun | null, businessId: string): boolean => {
  if (!run || !run.eligible.length) return false;
  const top = run.eligible[0];
  const pick = run.eligible.filter((c) => c.businessId === businessId)[0];
  if (!pick || pick.rank === 1) return false;
  return top.score - pick.score >= RULES.overrideThreshold;
};

export type Counts = {
  total: number;
  byStatus: Record<string, number>;
  qualifying: number;
  untouched: number;
  qualified: number;
  live: number;
  noEligible: number;
  converted: number;
  invalid: number;
};

/** The server's counts, in the shape the strip already reads.
 *
 *  The four sums it does not send — `ready`, `live`, `converted`, `invalid` —
 *  are added here, from `byStatus`, because they are arithmetic over status keys
 *  and those keys are what the chips are LABELLED from. Sending them too would
 *  put the same sum in two places. Everything else has to come from the server:
 *  it is counted over the whole filtered queue, and this page is fifty rows. */
export function countsFromServer(c: ServerCounts): Counts {
  const by = c.byStatus || {};
  return {
    total: c.total,
    byStatus: by,
    qualifying: c.qualifying,
    untouched: c.untouched,
    qualified: by.qualified || 0,
    live: by.assigned || 0,
    noEligible: c.noEligible,
    converted: by.converted || 0,
    invalid: by.invalid || 0,
  };
}

/** EVERY row the current filters match, not just the page. One caller: Export,
 *  which is the one place a whole-set read is the point rather than a cost — an
 *  export that quietly held only the page somebody was looking at is precisely
 *  the failure the dialog exists to prevent.
 *  ponytail: pages through at 200 a time; it wants a streaming CSV endpoint
 *  before anybody exports a queue of 50,000. */
export async function fetchAllMatching(p: Params): Promise<Enquiry[]> {
  const size = 200;
  const out: Enquiry[] = [];
  for (let pageNo = 1; ; pageNo += 1) {
    const got = await call<EnquiriesResponse<Enquiry>>(BusinessEnquiriesService.enquiries<Enquiry>(
      { ...queryFromParams(p, pageNo), pageSize: size }));
    out.push(...(got.enquiries || []));
    if (out.length >= got.total || !got.enquiries?.length) return out;
  }
}

export function countsOf(list: Enquiry[]): Counts {
  const byStatus: Record<string, number> = {};
  list.forEach((e) => { byStatus[e.status] = (byStatus[e.status] || 0) + 1; });
  return {
    total: list.length,
    byStatus,
    /* The qualification pile gets two numbers: how many are in it at all,
       and how many nobody has touched. The second is the one that should
       be zero by lunchtime. */
    qualifying: (byStatus.generated || 0) + (byStatus.processing || 0),
    untouched: byStatus.generated || 0,
    qualified: byStatus.qualified || 0,
    live: byStatus.assigned || 0,
    noEligible: byStatus.no_match || 0,
    converted: byStatus.converted || 0,
    invalid: byStatus.invalid || 0,
  };
}

export type Params = Record<string, string | undefined>;

/** THE CLOCK FILTER. Resolved when the filter RUNS, never when it was set — a
 *  range stored as two absolute instants silently stops meaning "today"
 *  tomorrow, and the filter chip would still say Today while showing
 *  yesterday's work.
 *
 *  Returns a half-open window [from, to). Half-open because a closed one either
 *  drops an enquiry that arrived at 23:59:59.500 or double-counts midnight into
 *  two adjacent days, and "today plus yesterday do not add up to two days" is a
 *  bug reported as a data problem. */
export function receivedWindow(p: Params, now = new Date()): { from: number; to: number } | null {
  const key = p.received;
  if (!key) return null;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const day = 86400000;
  const t = now.getTime();

  if (key === "custom") {
    /* Both ends optional: "everything since the 1st" and "everything before the
       9th" are real questions, and demanding the other end to ask them is the
       kind of form that makes people give up and scroll. The 'to' end is pushed to the
       END of its day — a person picking 9 August means the 9th included, not
       midnight at the start of it. */
    const from = p.from ? new Date(p.from + "T00:00:00").getTime() : -Infinity;
    const to = p.to ? new Date(p.to + "T00:00:00").getTime() + day : Infinity;
    if (!isFinite(from) && !isFinite(to)) return null;
    return { from, to };
  }
  if (key === "today") return { from: startOfDay(now), to: startOfDay(now) + day };
  if (key === "24h") return { from: t - day, to: Infinity };
  if (key === "7d") return { from: t - 7 * day, to: Infinity };
  if (key === "30d") return { from: t - 30 * day, to: Infinity };
  if (key === "month") {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), to: Infinity };
  }
  if (key === "older") return { from: -Infinity, to: t - 30 * day };
  return null;
}

/** What the chip should read. The chip has to name the window, not the key —
 *  "received: 7d" tells a reader nothing they did not already type. */
export function receivedLabel(p: Params): string {
  if (!p.received) return "";
  if (p.received !== "custom") {
    return (RECEIVED_RANGES.filter((r) => r.key === p.received)[0]?.label) || p.received;
  }
  if (p.from && p.to) return p.from + " to " + p.to;
  if (p.from) return "since " + p.from;
  if (p.to) return "up to " + p.to;
  return "custom";
}

/** The list filter. Deliberately NOT a search over the whole record: phone and
 *  reference are what an operator actually pastes in, plus the two words they
 *  might remember — a name and a locality. */
export function filterEnquiries(list: Enquiry[], p: Params): Enquiry[] {
  const q = (p.q || "").trim().toLowerCase();
  /* Resolved ONCE per filter run, not once per row: "today" must mean the same
     instant for every enquiry in the list, or a set filtered across midnight
     disagrees with itself. */
  const win = receivedWindow(p);
  return list.filter((e) => {
    if (win) {
      const at = new Date(e.createdAt).getTime();
      if (at < win.from || at >= win.to) return false;
    }
    if (p.status && e.status !== p.status) return false;
    if (p.category && e.requirement.category !== p.category) return false;
    if (p.city && e.requirement.city !== p.city) return false;
    if (p.urgency && e.qualification.urgency !== p.urgency) return false;
    if (p.tag && e.tags.indexOf(p.tag) < 0) return false;
    if (p.source && e.source.kind !== p.source) return false;
    if (p.state && e.requirement.state !== p.state) return false;
    if (p.tier && e.tier !== p.tier) return false;
    if (p.business && assignedName(e) !== p.business) return false;
    if (!q) return true;
    return [
      e.enquiryId, e.customer.name, e.customer.phone, e.requirement.category,
      e.requirement.locality, e.requirement.city, e.requirement.state,
      assignedName(e), e.source.page,
      /* The customer's own words are searchable. "asked for a studio in the
         same society" is the kind of thing an operator remembers about an
         enquiry when they have forgotten the reference and the name. */
      lastResponse(e)?.response,
    ].filter(Boolean).join(" ").toLowerCase().indexOf(q) >= 0;
  });
}

export function sortEnquiries(list: Enquiry[], key?: string): Enquiry[] {
  const out = list.slice();
  const hot = (e: Enquiry) => (urgencyOf(e.qualification.urgency)?.hot ? 0 : 1);
  const created = (e: Enquiry) => new Date(e.createdAt).getTime();
  if (key === "age") return out.sort((a, b) => created(a) - created(b));
  if (key === "step") return out.sort((a, b) => statusOf(a.status).step - statusOf(b.status).step);
  if (key === "tier") return out.sort((a, b) => a.tier.localeCompare(b.tier) || created(b) - created(a));
  /* Least worked first: nobody has called it, then attempted-but-never-reached,
     then everything else. The sort an operator picks when they are about to
     spend an hour on the phone. */
  if (key === "touch") {
    const touch = (e: Enquiry) =>
      !isWorking(e.status) ? 3 : !e.contactLog.length ? 0 : !everReached(e) ? 1 : 2;
    return out.sort((a, b) => touch(a) - touch(b) || created(a) - created(b));
  }
  /* Default: what needs a human first. An untouched enquiry leads — nobody
     has heard from us at all, which is worse the longer it stays true. Then
     urgency, then newest. */
  const untouched = (e: Enquiry) => (e.status === "generated" ? 0 : 1);
  return out.sort((a, b) =>
    untouched(a) - untouched(b) ||
    hot(a) - hot(b) || created(b) - created(a));
}

/* Phone, reduced to the digits that identify it. Formatting, spaces, the
   country code written three different ways — none of that distinguishes two
   customers, and all of it defeats a naive string match. Last ten digits is
   the Indian-number rule and is what the intake dedupe has to use too. */
export const phoneKey = (phone: string): string => {
  const digits = String(phone || "").replace(/[^0-9]/g, "");
  return digits.slice(-10);
};

/** EVERY ENQUIRY THIS NUMBER HAS RAISED BEFORE — history, not a duplicate check.
 *  One customer enquires more than once, for different work, at different
 *  addresses, months apart, and each of those is a real enquiry. So this is
 *  context for the person on the call ("we did her kitchen in March"), never a
 *  reason to refuse or to tag. Deciding two records are the same job is
 *  BE-OD-01, and it stays a person's call — `duplicate-suspected` is hand-set. */
export function findEarlierFrom(phone: string, excludeId?: string): Enquiry[] {
  const key = phoneKey(phone);
  if (key.length < 10) return [];
  return store.enquiries.filter((e) =>
    e.enquiryId !== excludeId && phoneKey(e.customer.phone) === key);
}

/* ============================================================ THE WRITES ===
   Each one is the transaction it stands in for, named with the same ID the
   architecture note uses (BE-T01…BE-T06), so the endpoint that replaces it has
   somewhere obvious to land. Every one appends an event; none edits or deletes
   one, and none touches a frozen snapshot. */

const nowIso = () => new Date().toISOString();
let evSeq = 0;
const actorName = () => currentActor().name || "Operations";

function append(e: Enquiry, type: string, note: string, role = "Operations") {
  evSeq += 1;
  e.events = [{
    eventId: "ev-live-" + evSeq, type,
    actor: type === "DELIVERED" ? "System" : actorName(),
    actorRole: type === "DELIVERED" ? "system" : role,
    at: nowIso(), note,
  }, ...e.events];
}

function withEnquiry(id: string, fn: (e: Enquiry) => void) {
  const e = store.enquiries.filter((x) => x.enquiryId === id)[0];
  if (!e) return;
  fn(e);
  bump();
}

function moveCapacity(businessId: string, delta: number) {
  const b = store.businesses.filter((x) => x.businessId === businessId)[0];
  if (!b) return;
  b.capacity.active = Math.max(0, b.capacity.active + delta);
  const run = store.runs;
  Object.keys(run).forEach((k) => {
    run[k].eligible.forEach((c) => {
      if (c.businessId === businessId) c.capacity.active = b.capacity.active;
    });
  });
}

/** BE-T11 · Create by hand.
 *
 *  THIS SUPERSEDES "there is no Create button". The first cut of this module
 *  refused manual creation, and the reasoning was that a hand-typed enquiry has
 *  no submission id, no duplicate check and no qualification snapshot. That
 *  reasoning was right about the danger and wrong about the cause: the danger is
 *  a record with no provenance and no gate, not a record a person typed. People
 *  ring the office. They walk in. They are referred. Refusing to record that
 *  does not stop it happening — it just means the enquiry gets worked in a
 *  notebook, and the business it eventually goes to is chosen with none of this
 *  module's machinery.
 *
 *  So the button exists and the three guarantees are kept instead:
 *    · it gets a submission id, prefixed `man-` so its origin is legible in
 *      the id itself
 *    · it goes through the SAME duplicate check, surfaced in the form before
 *      the record exists rather than reported after
 *    · it lands in `generated` and must be qualified by a person like every
 *      other enquiry — a manual record buys no shortcut past the gate
 *  And it records one thing an inbound enquiry cannot: who typed it. */
export async function createEnquiry(input: {
  source: string; via: string | null;
  name: string; phone: string; email: string;
  category: string; service: string; city: string; state: string; locality: string; pincode: string;
  projectType: string; intent: string; urgency: string;
  text: string;
}): Promise<string> {
  /* THE ONLY WRITE IN THIS MODULE THAT REACHES THE SERVER. Everything below it
     still simulates in the tab; this one posts, and what comes back is the
     server's own projection of the row it wrote — not this function's idea of
     what it should look like. That distinction is the point: the reference, the
     submission id, the tier, the tags and the intake event are all decided
     server-side, so the record on screen is the record in the database rather
     than a hopeful copy that drifts on the next reload.

     A MATCHING PHONE NUMBER IS NOT A DUPLICATE and does not gate this. The
     server records how many earlier enquiries that number has raised, as a
     count on the intake event, and sends them back as context — it never
     refuses and never tags. See findEarlierFrom above. */
  const body = input;
  const created = await call<CreateEnquiryResponse<Enquiry>>(
    BusinessEnquiriesService.create<Enquiry>(body));

  /* Straight onto the top of the page. It belongs there under the default
     order — unassigned first, then newest — and re-fetching to prove it would
     make the operator watch the table blink for a row they just typed. */
  store.enquiries = [created.enquiry].concat(store.enquiries);
  fetchedEnquiries = [created.enquiry].concat(fetchedEnquiries);
  page = { ...page, rows: fetchedEnquiries, total: page.total + 1 };
  bump();
  return created.enquiry.enquiryId;
}

/* ------------------------------------------ THE QUALIFICATION WORKSTREAM ---
   Everything between "a form arrived" and "somebody stands behind this". These
   four are the only writes in the module that touch an enquiry BEFORE it is
   frozen, and all four refuse once it is — the guard is `isWorking(status)`
   on each, not a rule stated once and trusted afterwards. */

/** Keeps the automatic tags honest after every logged contact. A person can add
 *  and remove any tag by hand; these four are the system's own read of the log
 *  and are recomputed rather than accumulated, so an enquiry that was
 *  unreachable and then answered does not keep wearing both. */
function retagFromLog(e: Enquiry) {
  const auto = new Set(TAGS.filter((t) => t.auto).map((t) => t.slug));
  const kept = e.tags.filter((t) => !auto.has(t));
  const next = new Set<string>();
  /* Nothing to add when the log is empty: "nobody has contacted them" is the
     New STATUS now, and a tag that repeats a status is a second copy of one
     fact that can drift from the first. */
  if (e.contactLog.length) {
    const newest = e.contactLog[0];
    if (everReached(e)) next.add("contact-made");
    else next.add("unreachable");
    const o = contactOutcomeOf(newest.outcome);
    /* The NEWEST outcome decides this one, not the history: a number that
       was bad and has since been corrected must stop being flagged. */
    if (o.autoTag === "bad-contact") next.add(o.autoTag);
  }
  e.tags = kept.concat(Array.from(next));
}

/** BE-T07 · Edit the enquiry while it is being qualified. New or Processing only.
 *  The form is a customer's first attempt at describing what they want, taken
 *  through a funnel they were skimming; the operator on the phone is the one
 *  who finds out it is a renovation and not a fit-out. Every change is listed
 *  in the event so the correction is visible, not silent. */
export function updateEnquiry(
  id: string,
  patch: { requirement?: Partial<Enquiry["requirement"]>; customer?: Partial<Enquiry["customer"]>; urgency?: string | null },
) {
  withEnquiry(id, (e) => {
    if (!isWorking(e.status)) return;
    const changed: string[] = [];
    const note = (field: string, from: unknown, to: unknown) => {
      if (String(from ?? "") !== String(to ?? "")) changed.push(field + ": " + (from || "—") + " → " + (to || "—"));
    };
    if (patch.requirement) {
      Object.keys(patch.requirement).forEach((k) => {
        const key = k as keyof Enquiry["requirement"];
        note(key, e.requirement[key], patch.requirement![key]);
      });
      e.requirement = { ...e.requirement, ...patch.requirement };
    }
    if (patch.customer) {
      Object.keys(patch.customer).forEach((k) => {
        const key = k as keyof Enquiry["customer"];
        note(key, e.customer[key], patch.customer![key]);
      });
      e.customer = { ...e.customer, ...patch.customer };
    }
    if (patch.urgency !== undefined) {
      note("urgency", e.qualification.urgency, patch.urgency);
      e.qualification.urgency = patch.urgency;
    }
    if (!changed.length) return;
    append(e, "UPDATED", changed.join(" · "));
  });
}

/** BE-T12 · Add an internal remark. Allowed at ANY status, unlike almost
 *  everything else here — the useful note about a business going quiet arrives
 *  after delivery, and the useful note about a customer arrives whenever
 *  somebody notices. Append-only: there is no edit and no delete, because a
 *  note somebody later softened is worth less than one nobody can change. */
export function addRemark(id: string, text: string) {
  const body = text.trim();
  if (!body) return;
  withEnquiry(id, (e) => {
    e.remarks = [{
      remarkId: "rm-live-" + (e.remarks.length + 1) + "-" + e.enquiryId.slice(-4),
      text: body,
      actor: actorName(),
      actorRole: "Operations",
      at: nowIso(),
    }].concat(e.remarks);
    /* The timeline records THAT a remark was added and by whom, never its text.
       The timeline is the one surface a business-scoped read could one day
       reach, and a remark must not ride into it. */
    append(e, "REMARK", "Internal remark added");
  });
}

/** BE-T08 · Log a contact attempt. New or Processing only — after qualification the
 *  conversation belongs to the assigned business, not to us.
 *
 *  Logging is what moves the tags, and it can also satisfy a check: an outcome
 *  the vocabulary marks as `reached` ticks "Contact reachable", because that
 *  box is a fact the log already proves and asking a person to confirm it twice
 *  is how checklists become theatre. */
export function logContact(id: string, entry: {
  channel: string; direction: "outbound" | "inbound"; outcome: string;
  response: string; note: string;
}) {
  withEnquiry(id, (e) => {
    if (!isWorking(e.status)) return;
    const o = contactOutcomeOf(entry.outcome);
    /* THE FIRST ATTEMPT IS WHAT STARTS QUALIFICATION. "The team has started
       working it" and "somebody tried to reach them" are the same event, so it
       needs no separate control — and it is recorded in this attempt's own
       CONTACT note rather than as a second timeline row, because one act that
       prints twice is how a timeline stops being readable. */
    const started = e.status === "generated";
    if (started) e.status = "processing";
    e.contactLog = [{
      logId: "cl-live-" + (e.contactLog.length + 1) + "-" + e.enquiryId.slice(-4),
      channel: entry.channel,
      direction: entry.direction,
      at: nowIso(),
      actor: actorName(),
      actorRole: "Operations",
      outcome: entry.outcome,
      response: entry.response.trim() || null,
      note: entry.note.trim() || null,
    }, ...e.contactLog];
    if (o.reached) e.qualification.checklist.reachable = true;
    retagFromLog(e);
    append(e, "CONTACT",
      channelOf(entry.channel).label + " · " + o.label +
      (started ? " · first attempt, now Processing" : "") +
      (entry.response.trim() ? " · response recorded" : "") +
      " · tags now " + (e.tags.length ? e.tags.join(", ") : "none"));
  });
}

/** Tick or untick one qualification check. New or Processing only. Recorded as an event
 *  because "who decided this enquiry was genuine" is a question that gets asked
 *  after a business complains, not before. */
export function setCheck(id: string, key: keyof Checklist, value: boolean) {
  withEnquiry(id, (e) => {
    if (!isWorking(e.status)) return;
    if (e.qualification.checklist[key] === value) return;
    e.qualification.checklist[key] = value;
    const row = CHECKLIST.filter((c) => c.key === key)[0];
    append(e, "CHECK", (value ? "Confirmed" : "Un-confirmed") + ": " + (row ? row.label : key));
  });
}

/** Add or remove a tag by hand. Automatic tags can be removed too — a person
 *  who has just spoken to the customer knows more than the log does — but the
 *  next logged contact recomputes them, and that is the right precedence. */
export function toggleTag(id: string, slug: string) {
  withEnquiry(id, (e) => {
    const on = e.tags.indexOf(slug) >= 0;
    e.tags = on ? e.tags.filter((t) => t !== slug) : e.tags.concat([slug]);
    append(e, "TAGGED", (on ? "Removed " : "Added ") + tagOf(slug).label);
  });
}

/** BE-T01c · Mark qualified. THE FREEZE.
 *
 *  This is the moment the snapshot becomes immutable and the moment a named
 *  person becomes answerable for it. It stamps `qualifiedBy`, `frozenAt` and
 *  the qualification version, writes the requirement summary from the last
 *  thing the customer actually said, and hands the enquiry to matching.
 *
 *  It refuses unless `canQualify()` — the UI hides the button in that state
 *  too, but the check lives here because the button is a convenience and this
 *  is the rule. On the server it is `422 qualification_incomplete`. */
export function markQualified(id: string, summary: string) {
  withEnquiry(id, (e) => {
    if (!canQualify(e)) return;
    const at = nowIso();
    const last = lastResponse(e);
    e.qualification.requirementSummary = summary.trim() || last?.response || e.requirement.text;
    e.qualification.genuineness = "passed";
    e.qualification.genuinenessNote = "Confirmed by " + actorName() + " over " + e.contactLog.length +
      " contact attempt" + (e.contactLog.length === 1 ? "" : "s");
    e.qualification.version = VOCAB.qualificationVersion || "qualification v4";
    e.qualification.frozenAt = at;
    e.qualification.qualifiedBy = actorName();
    e.qualification.qualifiedByRole = "Operations";
    e.status = "qualified";
    append(e, "QUALIFIED",
      "Snapshot frozen · " + e.qualification.version + " · all four checks confirmed over " +
      e.contactLog.length + " contact attempt" + (e.contactLog.length === 1 ? "" : "s"));
  });
}

/** BE-T02 · Matching run. It does NOT change the status, and that is the whole
 *  point of there no longer being a Ready to Assign: being Qualified IS being
 *  ready to assign, and whether anyone has ranked businesses yet is a fact about
 *  the work rather than a stage of the enquiry's life. Loads the active rule
 *  version, filters, scores, persists the candidate snapshot, appends MATCHED.
 *  In the prototype the "run" is whatever suggestions.json holds for this
 *  enquiry; the real one computes it. What is honest either way is the shape:
 *  a run that finds nobody does NOT fail the enquiry, it holds it. */
export function runMatching(id: string) {
  withEnquiry(id, (e) => {
    /* Qualified is the entry condition, not a suggestion. Matching an enquiry
       nobody has confirmed would rank businesses against a form the customer
       filled in while skimming — and then freeze that ranking onto an
       assignment as if it were established fact. */
    /* Both ways in: a first run from Qualified, and a RETRY from No match
       found — which is the only escape that state has, so locking the guard to
       `qualified` would have trapped the record in it. */
    if (e.status !== "qualified" && e.status !== "no_match") return;
    /* An enquiry that has never been matched has no run yet — which is the
       point: `runs` holds runs that HAPPENED, and one cannot exist before
       qualification. The seed keeps the not-yet-matched candidates in
       `pending`, and running matching is what moves one across, the same way
       the real POST /match computes a run and persists it. Without this the
       prototype answered "no eligible business" for every enquiry the operator
       actually qualified — a supply gap that was really just a missing seed. */
    const run = store.runs[e.enquiryId] || pendingRuns[e.enquiryId];
    if (run) store.runs[e.enquiryId] = run;
    const eligible = run ? run.eligible.length : 0;
    const excluded = run ? run.excluded.length : SUBSCRIBED_COUNT;
    /* THE RUN IS WHAT MOVES THE RECORD, in both directions. Finding nobody is a
       state the queue has to be able to show and filter, not a footnote hung off
       a record still claiming to be ready to assign. */
    if (!eligible) {
      e.status = "no_match";
      e.exception = {
        code: "no_eligible_business",
        note: "All " + SUBSCRIBED_COUNT + " subscribed businesses were excluded before scoring. Held at Qualified — a supply gap, not an invalid enquiry.",
      };
    } else {
      if (e.status === "no_match") e.status = "qualified";
      delete e.exception;
    }
    append(e, "MATCHED",
      SUBSCRIBED_COUNT + " subscribed → " + eligible + " eligible, " + excluded +
      " excluded with reasons · rule " + RULES.ruleVersion, "System");
  });
}

/** BE-T03 · Assignment. Lock → revalidate hard eligibility and capacity →
 *  create the assignment → FREEZE rank, score, factors and rule version →
 *  capacity++ → append ASSIGNED → enqueue delivery. All of it or none of it.
 *
 *  `factorSnapshot` is a COPY, not a reference to the candidate row. A
 *  reference would let a later recalculation rewrite the answer to "why did
 *  this go there?" — which is the one question this module exists to answer. */
export function assign(id: string, businessId: string, overrideReason: string | null) {
  withEnquiry(id, (e) => {
    const run = store.runs[e.enquiryId];
    const c = run ? run.eligible.filter((x) => x.businessId === businessId)[0] : null;
    const b = businessById(businessId);
    if (!c || !b) return;
    const a: Assignment = {
      assignmentId: "as-live-" + (e.assignments.length + 1) + "-" + e.enquiryId.slice(-4),
      businessId: c.businessId,
      businessName: c.name,
      candidateRank: c.rank,
      candidateScore: c.score,
      eligibleCount: run ? run.eligible.length : 0,
      factorSnapshot: { ...c.factors },
      ruleVersion: run ? run.ruleVersion : RULES.ruleVersion,
      assignedBy: actorName(),
      assignedByRole: "Operations",
      assignedAt: nowIso(),
      deliveryStatus: "pending",
      deliveredAt: null,
      overrideReason: overrideReason || null,
      supersededAt: null,
    };
    e.assignments = e.assignments.concat([a]);
    e.activeAssignmentId = a.assignmentId;
    e.status = "assigned";
    delete e.exception;
    const before = b.capacity.active;
    moveCapacity(businessId, +1);
    append(e, "ASSIGNED",
      c.name + " · rank " + c.rank + " of " + a.eligibleCount + " eligible · score " + c.score +
      " · rule " + a.ruleVersion + " · factors frozen · capacity " + before + "→" + (before + 1) +
      (overrideReason ? " · override reason stored" : ""));
    /* PUBLISHING IS PART OF ASSIGNING, not a state after it. It always was
       — `assign()` called `deliver()` on this line — and the only thing the
       separate step contributed was a `delivered` status the queue had to
       carry. The assignment still records when it went out, and a failed send
       still never erases an assignment: `deliveryStatus` holds that. */
    a.deliveryStatus = "delivered";
    a.deliveredAt = nowIso();
    append(e, "DELIVERED",
      "Published to " + a.businessName + " · notification sent · contact released", "system");
  });
}

/** The outbox side of BE-T03. Separate because it is a separate commit: the
 *  assignment stands whatever this does. */
/** BE-T04 · Reassignment. Lock → CLOSE the current assignment (supersededAt,
 *  never a delete) → capacity-- → run BE-T03 in full for the new business.
 *  The enquiry walks back to Qualified; it does not jump. */
export function reassign(id: string, businessId: string, reason: string) {
  withEnquiry(id, (e) => {
    const cur = activeAssignment(e);
    if (cur) {
      cur.supersededAt = nowIso();
      cur.closedReason = reason;
      moveCapacity(cur.businessId, -1);
    }
    e.activeAssignmentId = null;
    e.status = "qualified";
    append(e, "REASSIGNED",
      (cur ? "From " + cur.businessName + " · " : "") + "reason: " + reason +
      " · previous assignment closed, not deleted");
  });
  assign(id, businessId, null);
}

/** BE-T05 · The outcome. The BUSINESS acting on its own assignment — recorded
 *  from the Operations screen only because there is no business-side surface
 *  yet, and the notice on that screen says so. Reachable straight from
 *  Assigned: assigning publishes, and there is no acknowledgement step. */
export function recordOutcome(id: string, outcome: "converted" | "not_converted", reason: string, notes: string) {
  withEnquiry(id, (e) => {
    const a = activeAssignment(e);
    if (!a) return;
    const at = nowIso();
    e.status = outcome;
    e.outcome = {
      assignmentId: a.assignmentId,
      firstContactAt: e.outcome?.firstContactAt || null,
      status: "closed", outcome, reason, notes: notes || null,
      updatedBy: a.businessName, updatedAt: at,
    };
    const before = businessById(a.businessId)?.capacity.active ?? 0;
    moveCapacity(a.businessId, -1);
    append(e, "OUTCOME",
      statusOf(outcome).label + " · " + reason + " · capacity released, " + a.businessName +
      " " + before + "→" + Math.max(0, before - 1), "Business");
  });
}

/** Terminal with a reason, at any point before an outcome. This is what lets a
 *  separate Quarantine queue not exist: a rejected submission has a state to
 *  sit in and a reason stored beside it. */
/** Mark a Qualified enquiry as having no business to go to, BY HAND.
 *
 *  The automatic route is a matching run that returns nothing; this is the
 *  operator who already knows the run will return nothing — the one business
 *  covering that pincode just suspended, the category is one nobody serves yet.
 *  Making them run a match they know the answer to, purely so the system can
 *  discover it, is theatre.
 *
 *  It is NOT terminal and it is not a rejection: the enquiry is good and the
 *  supply is missing. Re-running matching is the way back, and the note says a
 *  person put it here so a later run does not look like it contradicted itself. */
export function markNoMatch(id: string) {
  withEnquiry(id, (e) => {
    if (e.status !== "qualified") return;
    e.status = "no_match";
    e.exception = {
      code: "no_eligible_business",
      note: "Marked by hand by " + actorName() + " — no subscribed business can take this "
        + "one today. Run matching again to re-check.",
    };
    append(e, "NO_MATCH",
      "Marked No match yet by hand · " + place(e) + " · " + e.requirement.category);
  });
}

export function invalidate(id: string, reason: string, note: string) {
  withEnquiry(id, (e) => {
    const a = activeAssignment(e);
    if (a) { moveCapacity(a.businessId, -1); a.supersededAt = nowIso(); a.closedReason = "Enquiry invalidated"; }
    e.activeAssignmentId = null;
    e.status = "invalid";
    e.invalidation = { reason, detectedBy: actorName(), detectedAt: nowIso(), note };
    append(e, "INVALIDATED", reason + (note ? " · " + note : ""));
  });
}

