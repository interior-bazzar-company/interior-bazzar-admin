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
  business?: string; owner?: string; flag?: string;
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
  static vocabularies() {
    return apiService.getGetApiResponse<VocabulariesResponse>(`${base}/vocabularies/`);
  }
  static matchingRules() {
    return apiService.getGetApiResponse<MatchingRulesResponse>(`${base}/matching-rules/`);
  }
  static businesses() {
    return apiService.getGetApiResponse<BusinessesResponse>(`${base}/businesses/`);
  }
}

export default BusinessEnquiriesService;
