// ── BusinessEnquiriesService ──
// API client for the Business Enquiries module (backend: interior_admin,
// Controllers/BusinessEnquiries). Keep in sync with interior_admin/urls.py.
//
// The enquiry list is a projection of LeadQuery — the enquiry chain has no table
// of its own. What LeadQuery cannot answer (contact log, the qualification
// freeze, per-assignment scores, the timeline) arrives EMPTY rather than
// invented, so a blank contact log here means nobody logged one, not that the
// call failed.
//
// The vocabulary and the rule set are DATABASE-BACKED server-side
// (BusinessEnquiryVocabulary, MatchRuleSet), so a status relabelled or a factor
// weight retuned in Django admin lands here on the next page load — no build,
// no deploy.
//
// THERE IS NO CLIENT-SIDE FALLBACK, deliberately. This module used to read
// `src/content/business-enquiries/*.json`; those files are gone. If a call here
// fails, the panel says so and renders nothing, because a screen that quietly
// falls back to bundled copies of the data is a screen that cannot tell you
// whether the backend is connected at all.
import appUrl from "../../endpoints";
import apiService from "../../apiService";

/** Same shape the rest of the admin API uses: blanks dropped so an untouched
 *  filter never reaches the server as `status=`. */
const qs = (params: Record<string, string | number | undefined>) => {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => [k, String(v)])
  );
  const s = new URLSearchParams(clean).toString();
  return s ? `?${s}` : "";
};

const base = `${appUrl.admin}/business-enquiries`; // "v1/admin/business-enquiries"

/** The vocabulary document. Most keys are stored and editable; `categories`,
 *  `cities`, `states` and `team` are assembled live from the taxonomy and the
 *  admin user list, so they describe what the data actually holds. */
export interface VocabulariesResponse {
  qualificationVersion: string;
  statuses: { key: string; label: string; tone: string; step: number; meaning: string; advance: string; terminal?: boolean }[];
  transitions: { from: string; to: string[]; guard: string }[];
  urgency: { key: string; label: string; hot: boolean }[];
  tiers: { key: string; label: string; help: string }[];
  /** The genuineness states a person may declare. `passed` marks the one that
   *  counts as a pass; anything else renders as a failure showing its own word,
   *  so a state added server-side is legible with no frontend change. */
  genuinenessStates: { key: string; label: string; tone: string; passed: boolean }[];
  categories: string[];
  cities: string[];
  states: string[];
  exclusionStages: string[];
  outcomeReasons: Record<string, string[]>;
  invalidReasons: string[];
  reassignReasons: string[];
  errorContract: { http: number; code: string; meaning: string }[];
  contactChannels: { key: string; label: string; verb: string }[];
  contactOutcomes: { key: string; label: string; tone: string; reached: boolean; autoTag: string; requiresFollowUp?: boolean }[];
  qualificationChecklist: { key: string; label: string; help: string }[];
  tags: { slug: string; label: string; tone: string; auto: boolean; help: string }[];
  team: { id: string; name: string; role: string }[];
  sources: { key: string; label: string; short: string; tone: string; manual: boolean; help: string }[];
  manualVia: { key: string; label: string }[];
  receivedRanges: { key: string; label: string }[];
  /** One entry per attention-strip cell: what the number counts, and what
   *  pressing it filters to. `check:wiring` asserts the two agree. */
  attentionCells: { key: string; counts: string; does: string }[];
  /** How the queue may be ordered. THE FIRST ROW IS THE DEFAULT and carries
   *  the empty key — the Sort control takes its own label from it and offers
   *  the rest. Keys are a contract with the server's own sorter, so an order
   *  offered here is one it implements. */
  sortOptions: { key: string; label: string }[];
}

/** The ACTIVE rule version. Past runs stay reproducible because every
 *  assignment freezes its own factor snapshot and the version that scored it —
 *  retired rule rows are never deleted server-side. */
export interface MatchingRulesResponse {
  ruleVersion: string;
  effectiveFrom: string | null;
  createdBy: string;
  status: string;
  overrideThreshold: number;
  overrideThresholdNote: string;
  /** Hours a lead must wait between matching runs. Versioned with the weights
   *  beside it, because the cadence is a matching policy like any other. 0
   *  disables the wait. */
  matchCooldownHours: number;
  eligibility: { key: string; label: string; rule: string; stage: string; open?: string }[];
  factors: { key: string; label: string; weight: number; note: string }[];
  bands: { key: string; label: string; from: number }[];
}

/** A read of Business Profile / Subscription, projected. This module never
 *  writes here. `avgAckHours` and `convertedOfLast` are null on a business with
 *  nothing measured — never 0 and never "0 of 0", which would read as a real
 *  and very bad track record. */
export interface BusinessRow {
  businessId: string;
  name: string;
  categories: string[];
  serviceArea: string[];
  plan: string;
  subscription: string;
  renewsAt: string | null;
  status: string;
  capacity: { configured: number; active: number; period: string };
  quality: { avgAckHours: number | null; convertedOfLast: string | null };
}
export interface BusinessesResponse {
  subscribedCount: number;
  businesses: BusinessRow[];
}

/** Every control the queue renders. Sent as query params; anything blank is
 *  dropped. THE SERVER FILTERS AND THEN CUTS THE PAGE — the panel used to do
 *  both in the browser over the whole table, and a page cut after a filter that
 *  ran in the tab is page 2 of the unfiltered queue with most of it missing.
 *
 *  `received` is a window KEY, never two instants: 'today' is resolved at
 *  request time in the server's timezone, so it cannot silently stop meaning
 *  today tomorrow, and two operators in two timezones see one queue. */
export interface EnquiryQuery {
  pageNo?: number;
  pageSize?: number;
  status?: string; category?: string; city?: string; state?: string;
  urgency?: string; tier?: string; tag?: string; source?: string;
  business?: string;
  received?: string; dateFrom?: string; dateTo?: string;
  q?: string; sort?: string;
}

/** One page of the queue.
 *
 *  `counts` is over the WHOLE filtered set and not the page — the strip above
 *  the table would otherwise report "3 untouched" on a queue with ninety, which
 *  is worse than no strip. `total` is the same set, and is what the pager reads.
 *  Generic in the row type so the store keeps owning the `Enquiry` shape and
 *  this file holds no second copy of it to drift. */
export interface EnquiriesResponse<T> {
  enquiries: T[];
  total: number;
  pageNo: number;
  pageSize: number;
  counts: {
    total: number;
    byStatus: Record<string, number>;
    qualifying: number; untouched: number; unowned: number; mine: number;
    callbackDue: number; callbackOverdue: number;
    breached: number; noEligible: number;
  };
}

/** What the panel posts to add one by hand — its own form state, flat, exactly
 *  as the fields are typed. The server maps these onto LeadQuery's columns
 *  (`service` → `interested`, `text` → `query`, `urgency` → `timeline`); both
 *  spellings are load-bearing and neither side can rename to match the other. */
export interface CreateEnquiryInput {
  source: string;
  via: string | null;
  name: string; phone: string; email: string;
  category: string; service: string; city: string; state: string;
  locality: string; pincode: string;
  projectType: string; intent: string; urgency: string;
  text: string;
}

/** `earlier` is what this number enquired about BEFORE — history, not a
 *  duplicate check. One person enquires more than once and should: a kitchen in
 *  March and a bathroom in September, one flat of their own and one for a
 *  parent. Each is a real enquiry a business should get, so a matching number
 *  never refuses the create and never tags the record. Whether two records are
 *  genuinely the same job is a person's call — `duplicate-suspected` is a
 *  hand-set tag. */
export interface CreateEnquiryResponse<T> {
  enquiry: T;
  earlier: { enquiryId: string; name: string; createdAt: string | null }[];
}

/** What the panel PATCHes back onto a record it is still working.
 *
 *  A key ABSENT is untouched and a key present and empty CLEARS the column, so
 *  the two blocks are partials rather than whole objects. `genuineness` is the
 *  one qualification check a person DECLARES — the other three are read from
 *  stored evidence server-side (a logged call, a filled column) and there is
 *  nothing to set, which is why there is no endpoint that ticks them. */
export interface EnquiryPatchInput {
  customer?: Partial<{ name: string; phone: string; email: string | null }>;
  requirement?: Partial<Record<string, string | null>>;
  urgency?: string | null;
  genuineness?: string;
}

/** One attempt to reach the customer. `response` is the customer's own words
 *  and `note` is our read of them; only the first may be quoted to a business,
 *  which is why they are two fields and not one. */
export interface ContactInput {
  channel: string;
  direction: "outbound" | "inbound";
  outcome: string;
  response?: string;
  note?: string;
  /** ISO instant. Only meaningful on an outcome the vocabulary marks
   *  `requiresFollowUp`. */
  followUpAt?: string | null;
}

/** EVERY LIFECYCLE MOVE, through one endpoint: qualify, assign, reassign, mark
 *  no-match, record the outcome, invalidate. They share the guard that matters
 *  — the vocabulary's own transition matrix — and six endpoints would be six
 *  copies of it, of which the sixth is the one that drifts.
 *
 *  A REASSIGNMENT has no verb of its own: it is `to` the status the enquiry is
 *  already in, with a new `businessId` and a `reason`. The server recognises it
 *  by the active assignment, closes that one rather than deleting it, and opens
 *  the new one in the same transaction. */
export interface StatusMoveInput {
  to: string;
  reason?: string;
  note?: string;
  summary?: string;
  businessId?: string;
  overrideReason?: string;
}

/** What a PATCH answers with: the two blocks it can change, the qualification
 *  read of them, and the one timeline line. Deliberately NOT the enquiry — see
 *  the note above `update` below.
 *
 *  The block types are left open because the store owns the `Enquiry` shape and
 *  a second copy of `requirement` here is a second copy to drift. */
export interface EnquiryPatchResult {
  customer: Record<string, unknown>;
  requirement: Record<string, unknown>;
  qualification: Record<string, unknown>;
  /** Null when the body changed nothing — there is no event for a no-op. */
  event: Record<string, unknown> | null;
}

/** What a remark answers with. The remark, and the line saying one was added —
 *  never its text. */
export interface RemarkResult {
  remark: Record<string, unknown>;
  event: Record<string, unknown>;
}

export class BusinessEnquiriesService {
  static enquiries<T>(query: EnquiryQuery = {}) {
    return apiService.getGetApiResponse<EnquiriesResponse<T>>(
      `${base}/${qs({ ...query })}`);
  }
  /** One record, whole. NEEDED BY THE PAGING rather than merely convenient: an
   *  enquiry that is not on the current page has nothing for the detail screen
   *  to render from, and every deep link into this module is that case. */
  static enquiry<T>(id: string) {
    return apiService.getGetApiResponse<{ enquiry: T }>(`${base}/${id}/`);
  }
  static create<T>(input: CreateEnquiryInput) {
    return apiService.getPostApiResponse<CreateEnquiryResponse<T>>(`${base}/`, input);
  }
  /* ── the writes ──────────────────────────────────────────────────────────
     EVERY ONE ANSWERS WITH DATA rather than an acknowledgement, because half
     this record is DERIVED — the qualification checklist, the automatic tags,
     the status of a lead that predates the enquiry chain — and a panel
     computing the new state itself would drift from the database the moment a
     derivation disagreed with it.

     HOW MUCH data is decided by how much the write actually moves. A patch
     changes two blocks and the qualification read of them; a remark adds a
     remark and a timeline line and touches nothing derived. Sending the whole
     enquiry back for either is nine server queries to deliver three objects the
     panel already holds the rest of, so those two answer with a DELTA and the
     store splices it in. The other three genuinely change most of the record —
     status, tags, checklist, assignments — and there the whole projection IS
     the delta. */

  /** BE-T07 · correct the record. Refused once the snapshot is frozen, the
   *  enquiry is out with a business, or it is terminal. `event` is null when
   *  the body changed nothing. */
  static update(id: string, patch: EnquiryPatchInput) {
    return apiService.getPatchApiResponse<EnquiryPatchResult>(`${base}/${id}/`, patch);
  }
  /** BE-T12 · an internal remark. Any status; append-only. */
  static remark(id: string, text: string) {
    return apiService.getPostApiResponse<RemarkResult>(`${base}/${id}/remarks/`, { text });
  }
  /** BE-T08 · log a contact attempt. The FIRST one is what starts
   *  qualification, and the server advances the status on the write itself. */
  static contact<T>(id: string, entry: ContactInput) {
    return apiService.getPostApiResponse<{ enquiry: T }>(`${base}/${id}/contacts/`, entry);
  }
  /** A hand-set tag on or off. The tags marked `auto` are recomputed from the
   *  contact log on every read and are refused here — storing one would be a
   *  tag that flips back on the next refresh. */
  static tag<T>(id: string, slug: string, apply: boolean) {
    return apiService.getPostApiResponse<{ enquiry: T }>(`${base}/${id}/tags/`, { slug, apply });
  }
  static move<T>(id: string, body: StatusMoveInput) {
    return apiService.getPostApiResponse<{ enquiry: T }>(`${base}/${id}/status/`, body);
  }
  /** BE-T02 · run matching. RATE-LIMITED SERVER-SIDE — inside the window it
   *  refuses `rate_limited` and names when the next run is available, so a
   *  reload or a second tab cannot get around the rule the way a disabled
   *  button can. Answers with the record; its `matchRun` is the frozen run. */
  static match<T>(id: string) {
    return apiService.getPostApiResponse<{ enquiry: T }>(`${base}/${id}/match/`, {});
  }

  static vocabularies() {
    return apiService.getGetApiResponse<VocabulariesResponse>(`${base}/vocabularies/`);
  }
  static matchingRules() {
    return apiService.getGetApiResponse<MatchingRulesResponse>(`${base}/matching-rules/`);
  }
  /** The whole directory. Read ONCE at boot: the business filter on the queue
   *  is built from it, and the assign dialog names a business from it. */
  static businesses() {
    return apiService.getGetApiResponse<BusinessesResponse>(`${base}/businesses/`);
  }
  /** The same endpoint as a SEARCH — name, category or city, capped. The filter
   *  runs before the capacity aggregates server-side, so a typed query costs
   *  the matches and their leads rather than the whole table; that is what
   *  makes it safe to call as somebody types.
   *
   *  `subscribedCount` on this response counts the MATCHES, not the directory.
   *  Callers must not let it overwrite the boot figure the "of N subscribed"
   *  sentence reads. */
  static searchBusinesses(q: string, limit = 12) {
    return apiService.getGetApiResponse<BusinessesResponse>(
      `${base}/businesses/${qs({ q, limit })}`);
  }
}

export default BusinessEnquiriesService;
