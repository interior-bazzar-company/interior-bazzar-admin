/* =============================================================================
   Business Enquiries — the data layer.
   -----------------------------------------------------------------------------
   THE ENQUIRIES ARE REAL, AND SO IS EVERY WRITE. `GET
   v1/admin/business-enquiries/` serves the queue — a projection of LeadQuery,
   the table the site's own forms have been writing to all along — alongside the
   vocabulary, the rule set and the business directory. `suggestions.json` was
   the last stand-in and is gone: matching is computed and frozen server-side
   now, so there was nothing left for a bundled copy of a run to stand in for.

   WHAT THE PROJECTION CANNOT ANSWER ARRIVES EMPTY, never guessed: contact log,
   remarks beyond the one stored on the lead, the qualification freeze, the event
   timeline, the owner, and the rank/score on an assignment (a pre-module one
   carries rule version `legacy`, which is what says the zeros are a missing
   record and not a bad score). A blank contact log means nobody logged a call.

   NOTHING HERE SIMULATES ANY MORE. Every write posts, and every one answers
   with the server's own record — so an event on screen has the database's id,
   timestamp and actor, and a status is the one the server decided rather than
   this file's idea of what it should now be. The two things that used to make
   that impossible are gone with it: `append()`, which minted event ids in the
   tab, and the `runs` map, which held a matching run nothing had performed.

   That matters most where the module is least forgiving. These are enforced on
   the server, not modelled here, and this file could not enforce them if it
   wanted to:
     · one active assignment per enquiry
     · reassignment CLOSES the current assignment (`supersededAt`) — never
       deletes it
     · capacity is COUNTED from the leads a business holds, so it moves on its
       own and no client adjusts it
     · rank, score, factor breakdown and rule version are COPIED onto the
       assignment, not referenced — and are ABSENT rather than zero when nothing
       ranked it
     · every write appends an event; nothing edits or removes one
     · a lead may be matched once per `matchCooldownHours`, refused off the
       stored run rather than off a disabled button
   What is left in this file is the shape of the payloads, the filters the URL
   carries, and the derives the screens read. Not the rules.
   ============================================================================= */
import { useEffect, useState } from "react";
import BusinessEnquiriesService from "../../../api/modules/businessEnquiries";
import type {
  BusinessesResponse, ContactInput, CreateEnquiryResponse, EnquiriesResponse, EnquiryQuery,
  EnquiryPatchInput, EnquiryPatchResult, MatchingRulesResponse, RemarkResult, StatusMoveInput,
  VocabulariesResponse,
} from "../../../api/modules/businessEnquiries";
import { call } from "../../../api/modules/adminOps";
import type { ApiResponseType } from "../../../types/reqResType";

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
  /** THE NEWEST MATCHING RUN, frozen when it ran — or null when this enquiry
   *  has never been matched, which is a state the screen shows rather than a
   *  gap to fill with an empty run. It rides on the record because a run is not
   *  reproducible from its inputs a day later: the directory it was computed
   *  against moves. */
  matchRun: MatchRun | null;
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
  enquiryId: string; runId: string;
  ruleVersion: string; calculatedAt: string; subscribedCount: number;
  /** WHETHER A SCORE MEANS ANYTHING. False today: the server answers stage 1
   *  only — who CAN take this enquiry and why each of the others cannot — and
   *  deliberately does not rank, because the seven factor weights in the rule
   *  set have never been validated against an outcome and a number between 0
   *  and 100 beside a business's name would read as though they had. Stored on
   *  the run rather than computed, so a run performed today still reads as
   *  unranked after ranking lands. */
  ranked: boolean;
  /** Gates that were NOT applied — the enquiry had nothing to test them
   *  against, or the rule set declares one nothing implements. Carried so a run
   *  can never read as "all gates passed" off gates nobody ran. */
  notApplied: { key: string; label: string; reason: string }[];
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
/** The Sort control, from the vocabulary. First row is the default order. */
export let SORT_OPTIONS: { key: string; label: string }[] = [];

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

/* NO `runs` MAP ANY MORE. A matching run is a server record now, frozen into
   LeadMatchRun and carried on the enquiry it belongs to — so the one place it
   can be read from is the record, and there is no second copy in this tab to
   go stale or to survive a reload that the server would contradict. */
type Store = { enquiries: Enquiry[]; businesses: Business[] };

/* Both arrive from the API and are planted by the boot below, so they survive
   resetStore() — they are reads of the server, not something this panel writes.
   THE WRITES ARE READS OF THE SERVER TOO NOW: every one of them replaces the
   record with what came back, so resetStore() re-reads rather than discards,
   and the only thing it throws away is a simulated matching run — the one
   stand-in left, because there is no matching endpoint yet. */
let fetchedBusinesses: Business[] = [];
let fetchedEnquiries: Enquiry[] = [];

/* `suggestions.json` IS GONE, and with it the last stand-in in this module.
   It seeded candidate lists for enquiry ids that stopped existing, so on live
   data it produced nothing and "Run matching" silently meant "mark no match".
   Matching is `POST /business-enquiries/{id}/match/` now — stage 1, computed
   and frozen server-side against the same business directory this panel
   reads. */

const seed = (): Store => ({
  /* A COPY, so nothing written here can edit the fetched rows and survive a
     resetStore() that is supposed to throw it away. */
  enquiries: JSON.parse(JSON.stringify(fetchedEnquiries)) as Enquiry[],
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
  SORT_OPTIONS = vocab.sortOptions || [];
  MANUAL_VIA = vocab.manualVia || [];
}

/** The rules half of the same idea. Its own function for the same reason
 *  `applyVocabulary` is: the offline checks need to state what "the rules
 *  arrived" means without standing up a server, and a check that plants the
 *  payload through the real setter breaks when the payload is renamed. */
export function applyRules(rules: MatchingRulesResponse): void {
  RULES = rules;
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
    applyRules(rules);

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
    business: p.business,
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

/** The enquiry's own run. Read off the record rather than a map beside it: the
 *  run is frozen server-side and arrives with the enquiry, so there is exactly
 *  one copy and it cannot disagree with itself. */
export function useMatchRun(id: string | null): MatchRun | null {
  useVersion();
  if (!id) return null;
  const e = store.enquiries.filter((x) => x.enquiryId === id)[0] || detailCache[id];
  return e?.matchRun || null;
}

/** The business DIRECTORY, whole. Read straight off the module rather than
 *  through a hook: it is planted once at boot and never changes inside a
 *  session. The list's Business filter is built from this and not from the rows
 *  on screen — with a page, those name only the businesses this page happens to
 *  mention, and the filter you wanted would not be in the dropdown. */
export const businessDirectory = (): Business[] => store.businesses;

export const businessById = (id: string) =>
  store.businesses.filter((b) => b.businessId === id)[0] || null;

/** THE MANUAL PICK, for when matching has produced nothing to choose from.
 *
 *  A matching run finding nobody is a supply gap, not a dead end: the operator
 *  often knows the one business that would take it — it just failed a hard gate
 *  the rules apply bluntly (a service area typed as "Gurgaon" when the enquiry
 *  says "Gurugram", a category the profile never listed). Making them wait for
 *  a rule change to route an enquiry they already know the answer for is how
 *  work leaves this module and continues in a notebook.
 *
 *  A REQUEST, AND ONLY ONCE SOMETHING IS TYPED. It used to filter the directory
 *  this tab already held, which meant the picker opened onto a list of every
 *  business — a list nobody asked for, presented as if it were a suggestion.
 *  Now nothing is shown until there is a query, and the query goes to the
 *  server: the filter runs before the capacity aggregates there, so a search
 *  costs the matches rather than the whole table.
 *
 *  An empty query makes NO request and returns nothing — the caller shows
 *  "type to search", which is the honest state and not an empty result. */
export async function findBusinesses(q: string, limit = 12): Promise<Business[]> {
  const needle = q.trim();
  if (!needle) return [];
  const got = await call<BusinessesResponse>(
    BusinessEnquiriesService.searchBusinesses(needle, limit));
  /* `subscribedCount` on this response counts the MATCHES. Deliberately not
     planted over SUBSCRIBED_COUNT, which is the directory figure the "of N
     subscribed" sentence reads — a search must not shrink it. */
  return got.businesses || [];
}

/** A business in the shape the assign dialog reads, for a pick nothing ranked.
 *
 *  Rank and score are ZERO here and the dialog does not print them — it prints
 *  "not ranked", because 0 would read as a business that scored nothing rather
 *  than one no run ever looked at. The server stores them as NULL for the same
 *  reason, and `capacity` is the real figure so the dialog's capacity check is
 *  a real check. */
export const manualCandidate = (b: Business): Candidate => ({
  businessId: b.businessId, name: b.name, rank: 0, score: 0, band: "",
  capacity: { active: b.capacity.active, configured: b.capacity.configured },
  factors: {}, why: "", from: {},
});

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
/** WHEN THIS ENQUIRY MAY BE MATCHED AGAIN, and why not yet.
 *
 *  Both inputs to a run are slow-moving — the qualification snapshot is FROZEN,
 *  and a business joining, renewing or widening its service area is a thing
 *  that happens over days. So a second run inside the window returns the same
 *  answer for the same cost. It is worth guarding precisely because re-running
 *  is the ONLY way out of No match yet: the operator has nothing else to press,
 *  and a button that does nothing invites being pressed again.
 *
 *  READ OFF THE TIMELINE, not off a new column. Every run already leaves an
 *  event, so the record of when one last happened exists and is append-only;
 *  a `lastMatchedAt` column would be a second copy of it that a replayed
 *  timeline could contradict. The window itself is `RULES.matchCooldownHours`,
 *  a versioned server value — retuning it is a row edit.
 *
 *  ponytail: enforced HERE only, because matching itself still runs in this tab
 *  — there is no endpoint to guard. When one lands it must re-check the same
 *  window server-side off the same events; the number is already in the rules
 *  payload it will be reading anyway. Until then a reload clears any run that
 *  was not also a server write. */
export function matchCooldown(e: Enquiry, now = new Date()): {
  blocked: boolean; lastAt: string | null; readyAt: string | null;
} {
  const hours = RULES.matchCooldownHours ?? 0;
  /* The run itself, not an event about one: LeadMatchRun is a row with its own
     timestamp, and it is the same row the SERVER enforces this against. Reading
     anything else here would let the button and the endpoint disagree about
     when the window closes. */
  const last = e.matchRun;
  if (!hours || !last) {
    return { blocked: false, lastAt: last?.calculatedAt || null, readyAt: null };
  }
  const readyAt = new Date(new Date(last.calculatedAt).getTime() + hours * 3600_000);
  return {
    blocked: readyAt.getTime() > now.getTime(),
    lastAt: last.calculatedAt,
    readyAt: readyAt.toISOString(),
  };
}

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
   architecture note uses (BE-T01…BE-T12).

   THEY ALL REACH THE SERVER NOW, and every one of them answers with the
   server's own projection of the row it wrote rather than an acknowledgement.
   That is the whole reason this file no longer simulates: half an enquiry is
   DERIVED — the qualification checklist, the automatic tags, the status of a
   lead that predates the enquiry chain, the assignment a legacy row implies —
   and a local copy patched in the tab drifts from the database the moment one
   of those derivations disagrees with it. So nothing here computes a status,
   recomputes a tag or invents an id: the record is replaced whole with what
   came back.

   `runMatching` is the one that still simulates, because there is no matching
   endpoint yet. It says so where it stands.

   ponytail: a rejected write refetches the record so the screen tells the
   truth, and logs. Saying so ON SCREEN needs a catch in the four .tsx callers
   that fire these without awaiting — deliberately not done here. */

/** The record, as the server now holds it, into every place the panel reads
 *  from. One function because there are four: the page the table renders, the
 *  copy `store.enquiries` hands out, the fetched rows a resetStore() falls back
 *  to, and the detail cache a deep link is served from. Missing one of them is
 *  how a saved edit reappears un-saved on the way back from the list. */
function replace(next: Enquiry) {
  const swap = (list: Enquiry[]) =>
    list.map((row) => (row.enquiryId === next.enquiryId ? next : row));
  store.enquiries = swap(store.enquiries);
  fetchedEnquiries = swap(fetchedEnquiries);
  page = { ...page, rows: swap(page.rows) };
  if (detailCache[next.enquiryId]) detailCache[next.enquiryId] = next;
  bump();
}

/** Send one write and fold the answer in. ONE REQUEST: what comes back IS the
 *  new state — no write here is followed by a read, because a follow-up GET
 *  would only be a slower way to learn what has already arrived.
 *
 *  `merge` is what makes the two response sizes one code path. A patch and a
 *  remark answer with a DELTA, because neither moves anything derived and
 *  re-reading the enquiry and its five child tables to report one is nine
 *  server queries for three objects. The other three answer with the whole
 *  record, because a logged contact moves the status, the tags, the checklist
 *  and the log at once, and there the projection IS the delta.
 *
 *  A FAILURE NEEDS NO RE-READ EITHER, and that is a property of not being
 *  optimistic: nothing here touches the record before the server confirms it,
 *  so a rejected write leaves the store already holding the last thing the
 *  server said. It rethrows and changes nothing. */
async function write<D>(id: string, send: Promise<ApiResponseType<D>>,
                        merge: (current: Enquiry, got: D) => Enquiry): Promise<void> {
  const got = await call<D>(send);
  const current = store.enquiries.filter((e) => e.enquiryId === id)[0] || detailCache[id];
  /* Nothing on screen to fold into — the write still landed, and the next read
     of this enquiry gets it from the server like any other. */
  if (current) replace(merge(current, got));
}

/** The merge for the three writes that answer with the whole record. */
const whole = (_current: Enquiry, got: { enquiry: Enquiry }) => got.enquiry;

/** Capacity is the SERVER'S number — `active` is counted from the leads a
 *  business currently holds — so an assignment or an outcome moves it and
 *  nothing in this tab may adjust it by hand. Re-read instead of guessing.
 *  Fire-and-forget: a stale figure beside the business name is worth far less
 *  than the write that just succeeded. */
function refreshBusinesses(): void {
  void (async () => {
    try {
      const got = await call<BusinessesResponse>(BusinessEnquiriesService.businesses());
      SUBSCRIBED_COUNT = got.subscribedCount;
      fetchedBusinesses = got.businesses || [];
      store.businesses = fetchedBusinesses;
      bump();
    } catch {
      /* Leave the figures as they were. */
    }
  })();
}

/* THE LAST OF THE SIMULATION IS GONE. `append()` minted event ids in the tab
   and `withEnquiry()` mutated a record in place; both existed so a write could
   look like it had happened before anything had. Every write reaches the server
   now and every one answers with what the server wrote, so an event on screen
   is an event in the database with the database's own id, timestamp and actor
   — there is nothing left here to invent one with. */

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
   refuse once the snapshot is frozen — and the refusal is the SERVER'S, not a
   guard restated here: `isWorking()` still hides the controls, but what decides
   whether an edit is allowed is three stored facts on the record (a frozen
   snapshot, an assignee, a terminal status) and only the server can read them
   without guessing. */

/** BE-T07 · Edit the enquiry while it is being qualified.
 *
 *  The form is a customer's first attempt at describing what they want, typed
 *  through a funnel they were skimming; the operator on the phone is the one
 *  who finds out it is a renovation and not a fit-out. Every change is listed
 *  field by field in the timeline, so a correction is visible rather than
 *  silent — and the server writes that list, from the values it actually had,
 *  which is the only place the "before" is reliable. */
export function updateEnquiry(
  id: string,
  patch: { requirement?: Partial<Enquiry["requirement"]>; customer?: Partial<Enquiry["customer"]>; urgency?: string | null },
): Promise<void> {
  const body: EnquiryPatchInput = {};
  if (patch.requirement) body.requirement = patch.requirement as Record<string, string | null>;
  if (patch.customer) body.customer = patch.customer;
  if (patch.urgency !== undefined) body.urgency = patch.urgency;
  return write<EnquiryPatchResult>(id, BusinessEnquiriesService.update(id, body), (e, got) => ({
    ...e,
    customer: got.customer as Enquiry["customer"],
    requirement: got.requirement as Enquiry["requirement"],
    /* The checklist comes with it: three of its four checks are a read of the
       columns this just patched, so recomputing them here would be a second
       implementation of enquiry_derive maintained by hand. */
    qualification: got.qualification as Enquiry["qualification"],
    events: got.event ? [got.event as Enquiry["events"][0], ...e.events] : e.events,
  }));
}

/** BE-T12 · Add an internal remark. Allowed at ANY status, unlike almost
 *  everything else here — the useful note about a business going quiet arrives
 *  after delivery, and the useful note about a customer arrives whenever
 *  somebody notices. Append-only: there is no edit and no delete, because a
 *  note somebody later softened is worth less than one nobody can change. The
 *  timeline records THAT one was added and by whom, never its text. */
export function addRemark(id: string, text: string): Promise<void> {
  const body = text.trim();
  if (!body) return Promise.resolve();
  return write<RemarkResult>(id, BusinessEnquiriesService.remark(id, body), (e, got) => ({
    ...e,
    /* Both lists are newest-first, on the model and on screen, so both go on
       the front. Nothing else on the record moved: a remark has no channel, no
       outcome and no attempt, so it touches no tag and no check. */
    remarks: [got.remark as Enquiry["remarks"][0], ...e.remarks],
    events: [got.event as Enquiry["events"][0], ...e.events],
  }));
}

/** BE-T08 · Log a contact attempt.
 *
 *  THE FIRST ATTEMPT IS WHAT STARTS QUALIFICATION. "The team has started
 *  working it" and "somebody tried to reach them" are the same event, so it
 *  needs no separate control — the server advances the status on this write and
 *  says so in this attempt's own note.
 *
 *  NOTHING IS RETAGGED HERE. The automatic tags are the server's read of this
 *  log, recomputed on every request; the client used to recompute them too and
 *  the two agreeing was a coincidence maintained by hand. */
export function logContact(id: string, entry: {
  channel: string; direction: "outbound" | "inbound"; outcome: string;
  response: string; note: string;
}): Promise<void> {
  const body: ContactInput = {
    channel: entry.channel, direction: entry.direction, outcome: entry.outcome,
    response: entry.response.trim(), note: entry.note.trim(),
  };
  return write(id, BusinessEnquiriesService.contact<Enquiry>(id, body), whole);
}

/** Tick or untick one qualification check.
 *
 *  THREE OF THE FOUR HAVE NOTHING TO SET, and that is not a gap. `reachable` is
 *  a read of the contact log, `requirement` of the stored requirement and
 *  `urgency` of the customer's own answer — each ticks itself the moment the
 *  work behind it is done, and ticking one by hand would be the exact claim the
 *  checklist exists to prevent (a reachable number nobody has reached). Only
 *  `genuine` is a DECLARATION — nothing in a record proves it is not a test
 *  submission — so only that one has a column, and it is a field on the record
 *  patch rather than a check endpoint of its own. */
export function setCheck(id: string, key: keyof Checklist, value: boolean): Promise<void> {
  if (key !== "genuine") return Promise.resolve();
  const state = value
    ? (VOCAB.genuinenessStates || []).filter((g) => g.passed)[0]?.key || "passed"
    : (VOCAB.genuinenessStates || [])[0]?.key || "unconfirmed";
  return write<EnquiryPatchResult>(id, BusinessEnquiriesService.update(id, { genuineness: state }),
    (e, got) => ({
      ...e,
      qualification: got.qualification as Enquiry["qualification"],
      events: got.event ? [got.event as Enquiry["events"][0], ...e.events] : e.events,
    }));
}

/** Add or remove a tag by hand. The automatic ones are refused server-side:
 *  they are recomputed from the contact log on every read, so a hand override
 *  would be undone by the response to the very request that set it. */
export function toggleTag(id: string, slug: string): Promise<void> {
  const on = store.enquiries.filter((e) => e.enquiryId === id)[0]?.tags.indexOf(slug) ?? -1;
  const has = on >= 0 || (detailCache[id]?.tags || []).indexOf(slug) >= 0;
  return write(id, BusinessEnquiriesService.tag<Enquiry>(id, slug, !has), whole);
}

/* ---------------------------------------------------------- THE LIFECYCLE ---
   Six moves, one endpoint. They all mean "put this enquiry in status X with the
   things X needs", and they share the guard that matters — the vocabulary's own
   transition matrix, enforced server-side. Six endpoints would be six copies of
   that matrix, and the sixth is the one that drifts. */

const move = (id: string, body: StatusMoveInput) =>
  write(id, BusinessEnquiriesService.move<Enquiry>(id, body), whole);

/** BE-T01c · Mark qualified. THE FREEZE.
 *
 *  The moment the snapshot becomes immutable and a named person becomes
 *  answerable for it. `canQualify()` still hides the button, but the rule is
 *  the server's: it refuses an incomplete checklist with
 *  `qualification_incomplete` and names which check is missing. */
export function markQualified(id: string, summary: string): Promise<void> {
  return move(id, { to: "qualified", summary: summary.trim() });
}

/** BE-T02 · Matching run. A SERVER CALL, like every other write here.
 *
 *  It used to simulate, off a bundled fixture keyed by enquiry ids that no
 *  longer existed — so on live data it found nothing and "Run matching" quietly
 *  meant "mark no match". It computes for real now: stage 1, against the same
 *  business directory this panel reads, frozen into a row so it survives a
 *  reload.
 *
 *  IT DOES NOT RANK, and the run says so. Whoever the run finds comes back
 *  unscored — see `MatchRun.ranked`.
 *
 *  ONCE PER WINDOW, AND THE SERVER IS WHAT ENFORCES IT: inside the window the
 *  endpoint refuses `rate_limited` whatever this tab believes, so a reload or a
 *  second tab cannot get around it. The check below and the disabled button are
 *  the courtesy — they save a request and explain the wait; they are not the
 *  rule.
 *
 *  It does NOT change the status when it finds somebody — being Qualified IS
 *  being ready to assign. Finding nobody holds the enquiry at No match yet, and
 *  a later run that finds somebody walks it back without re-freezing the
 *  snapshot. All of that happens in the one server transaction. */
export function runMatching(id: string): Promise<void> {
  const e = store.enquiries.filter((x) => x.enquiryId === id)[0] || detailCache[id];
  if (e && matchCooldown(e).blocked) return Promise.resolve();
  return write(id, BusinessEnquiriesService.match<Enquiry>(id), whole);
}

/** BE-T03 · Assignment. Revalidate the business → create the assignment →
 *  FREEZE the match context onto it → append ASSIGNED → publish. All of it or
 *  none of it, in one server transaction.
 *
 *  RANK AND SCORE COME BACK ABSENT, not zero, and that is honest: nothing
 *  ranked this enquiry, because there is no matching endpoint yet. The panel
 *  must never post them — a rank the client supplies is a rank the client could
 *  have made up, and that row is the evidence for "why did this go there?". */
export function assign(id: string, businessId: string, overrideReason: string | null): Promise<void> {
  return move(id, { to: "assigned", businessId, overrideReason: overrideReason || "" })
    .then(refreshBusinesses);
}

/** BE-T04 · Reassignment. The same endpoint and no verb of its own: it is a
 *  move to the status the enquiry is already in, with a new business and a
 *  reason. The server CLOSES the current assignment (supersededAt, never a
 *  delete) and opens the new one in one transaction. */
export function reassign(id: string, businessId: string, reason: string): Promise<void> {
  return move(id, { to: "assigned", businessId, reason }).then(refreshBusinesses);
}

/** BE-T05 · The outcome. The BUSINESS acting on its own assignment — recorded
 *  from the Operations screen only because there is no business-side surface
 *  yet, and the notice on that screen says so. */
export function recordOutcome(id: string, outcome: "converted" | "not_converted", reason: string, notes: string): Promise<void> {
  return move(id, { to: outcome, reason, note: notes }).then(refreshBusinesses);
}

/** Mark a Qualified enquiry as having no business to go to, BY HAND.
 *
 *  The automatic route is a matching run that returns nothing; this is the
 *  operator who already knows it will — the one business covering that pincode
 *  just suspended, the category is one nobody serves yet. NOT terminal and not
 *  a rejection: the enquiry is good and the supply is missing, and re-running
 *  matching is the way back. */
export function markNoMatch(id: string): Promise<void> {
  return move(id, { to: "no_match" });
}

/** Terminal with a stored reason, at any point before an outcome. This is what
 *  lets a separate quarantine queue not exist. */
export function invalidate(id: string, reason: string, note: string): Promise<void> {
  return move(id, { to: "invalid", reason, note }).then(refreshBusinesses);
}
