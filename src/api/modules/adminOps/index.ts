// ── AdminOpsService ──
// API client for the v3 admin ops console (promptsadmin). One method per shipped
// /api/v1/admin/ endpoint (backend interior_admin). The per-module React ports
// (promptsadmin tasks 13-40) call these; the RBAC store hydrates from
// mePermissions(). Keep in sync with interior_admin/urls.py.
import appUrl from "../../endpoints";
import apiService, { AppExceptions } from "../../apiService";
import { fetchWithAuthRetry } from "../../apiService/authHelper/fetchWithAuthRetry";
import config from "../../../config";
import type { ApiResponseType } from "../../../types/reqResType";

const base = appUrl.admin; // "v1/admin"

/** Unwraps this endpoint family's envelope. These routes answer HTTP 200
 *  ALWAYS and put a logical refusal in `response:false` with the reason in
 *  `message` (or `data.message`) — so a plain `await` hands you a "success"
 *  that failed. Awaiting `call(...)` instead either returns the data or throws
 *  the same AppExceptions a transport failure produces, which is why callers
 *  can have one catch rather than two branches that drift apart.
 *
 *  Every caller that WRITES goes through this. Reads that want to distinguish
 *  a 403 from a 404 (the deals list, the deal detail) still branch on
 *  `res.response` themselves — see useDeals.ts. */
export async function call<T>(p: Promise<ApiResponseType<T>>): Promise<T> {
  const res = await p;
  if (res.response === false) {
    const detail = (res.data as { message?: string } | null)?.message;
    throw new AppExceptions(detail || res.message || "Refused.", res.code || 0, false);
  }
  return res.data;
}

/** One row of `me/permissions/`'s `modules[]` — the single list that drives
 * both the sidebar nav and the permission matrix. `actions` is what this
 * session MAY DO on the module, resolved server-side: the exact set the API
 * itself enforces with. An empty array is no access at all, and `view` is the
 * gate — a module without it is refused whatever else is listed. */
export interface AdminModuleInfo {
  key: string;
  label: string;
  groupLabel: string;
  displayOrder: number;
  actions: string[];
}
export interface MeUser {
  id: number;
  name: string;
  email: string;
  username: string;
  initials: string;
}
export interface MePermissions {
  role: string | null;
  roles: string[];
  isFullAccess: boolean;
  user: MeUser;
  modules: AdminModuleInfo[];
  /** "moduleKey.action" -> the tier that verb sits at (1 read, 2 write,
   * 3 sensitive). METADATA, not authorization — nothing is checked against it
   * any more; the roles editor reads it to mark its sensitive columns. */
  actionLevels: Record<string, number>;
  /** True when the user passes the admin gate, false when a soft-deleted,
   * demoted or role-stripped account does not — distinct from `role: null`
   * (a genuine new hire awaiting a role). Optional: older/racing backends
   * that predate this field omit it, and that must read as "not blocked",
   * never as a lockout. */
  gateOk?: boolean;
}

/** roles/ editor grid — a role's grant is moduleKey -> the action keys it
 *  holds there. A module absent from the map, or mapped to [], is not granted.
 *  Per ACTION, not per level: "may GET but may not POST" is a first-class
 *  answer now, which a 0..3 tier could not express. */
export type RoleModules = Record<string, string[]>;
/** A verb a module supports. `minLevel` is how sensitive it is (1 read,
 *  2 write, 3 sensitive) — display only, it authorizes nothing. */
export interface RoleActionDef {
  key: string;
  minLevel: number;
}
export interface RolesModuleDef {
  key: string;
  label: string;
  groupLabel: string;
  displayOrder: number;
  /** The columns this module offers. Empty = no tickable verb at all. */
  actions: RoleActionDef[];
}
export interface AdminRole {
  id: number;
  name: string;
  isFullAccess: boolean;
  isSystem: boolean;
  /** Deactivated roles stay assigned but grant nothing — the server drops
      them from every permission resolve. */
  isActive: boolean;
  portal: string;
  userCount: number;
  modules: RoleModules;
}
export interface RolesListResponse {
  modules: RolesModuleDef[];
  roles: AdminRole[];
}

/** Admin user CRUD — interior_admin/urls.py `users/` (AdminUserViews). */
export interface AdminUserRole {
  id: number;
  name: string;
}
export interface AdminUserRow {
  id: number;
  username: string;
  role: string;
  isSuperAdmin: boolean;
  isVerified: boolean;
  name: string;
  email: string;
  phone: string;
  roles: AdminUserRole[];
  /** Account facts (AdminUserTasks._accountFacts). Optional: a backend that
   * predates them omits them, and "no field" must read as unknown — never as
   * a deactivated account or a member who never signed in. `lastLogin` is ""
   * when the account genuinely has no sign-in on record. */
  isActive?: boolean;
  addedAt?: string;
  lastLogin?: string;
  /** Roster columns (AdminUserTasks._teamFacts, team/d1). `reportsTo` and
   * `designation` are ABSENT when the member has no work-settings row, and null
   * when that row says nobody / unset. Department is not a field: it is `roles`. */
  reportsTo?: { id: number; username: string; name: string } | null;
  designation?: { key: string; label: string; tone: string } | null;
  /** Required document kinds this member has not handed over. */
  missingDocuments?: { key: string; label: string }[];
  /** team/d2; absent with no work-settings row, like `reportsTo`. */
  employmentType?: { key: string; label: string; tone: string } | null;
}
/** GET users/orphans/ — team.status, same gate as suspend/delete. Records still
 *  owned by an account off the team roster (deleted/suspended/unknown), plus
 *  the records nobody owns at all. */
export interface OrphanDealRow { ref: string; contact: string; valuePaise: number | null; stage: string }
export interface OrphanOwnerRow {
  id: number; username: string; name: string; why: "deleted" | "suspended" | "not a team member" | "unknown";
  deals: OrphanDealRow[]; quotations: number; invoices: number; enquiries: number; tasks: number;
  valuePaise: number;
}
/** GET users/<id>/owned/ — same shape the delete/suspend refusal's `data.owns`
 *  carries, read ahead of time so the delete dialog knows whether to ask for a
 *  successor before the person even presses the destructive button. */
export interface OwnedCounts { deals: number; quotations: number; invoices: number; enquiries: number; tasks: number }
export interface OwnedByResponse { owns: OwnedCounts }
export interface OrphansResponse {
  /** Sorted by `valuePaise` descending. */
  owners: OrphanOwnerRow[];
  unassigned: { deals: OrphanDealRow[]; quotations: number; invoices: number; enquiries: number };
}

/** One row of GET access-requests/ (team/d1): a member asking for one module action. */
export interface AccessRequestRow {
  id: number;
  member: { id: number; username: string; name: string };
  module: { key: string; label: string };
  action: string;
  reason: string;
  state: { key: string; label: string; tone: string };
  decidedBy: { id: number; username: string; name: string } | null;
  decidedAt: string | null;
  grantedRole: { id: number; name: string } | null;
  createdAt: string;
}
export interface AccessRequestsResponse {
  requests: AccessRequestRow[];
  total: number;
  /** Requests still waiting on a decision, whatever `state` filtered. */
  pending: number;
}
export interface AdminUserInput {
  username: string;
  password: string;
  name: string;
  email: string;
  phone: string;
  roles: number[];
}
export interface AuditEntry {
  /** Null on the synthesised registration line — there is no row to link to. */
  id: number | null;
  /** The handle, for searching back to an account. */
  actor: string | null;
  /** The name to PRINT. Falls back to the handle, never blank. */
  actorName: string;
  role: string | null;
  action: string;
  /** Server-derived: "team_member_roles_updated" -> "Team member roles updated". */
  label: string;
  /** created | updated | approved | removed | refused | changed. */
  verb: string;
  destructive: boolean;
  module: string; detail: string | null; ts: string | null;
  /** Who the action was done TO. Null on rows that are not about a person, and
   *  null again once that account is deleted. */
  subjectUser: number | null;
  subjectUsername: string | null;
  subjectName: string;
  /** The record the row is about when that record is NOT a person — an
   *  agreement, a salary account, a run, a slip, a subscription, a refund.
   *  Null on the rows that are about no record at all. This pair is what a
   *  history tab is filtered by, and why none of them has an events table. */
  subjectType?: string | null;
  subjectId?: string | null;
  /** True only for the registration line, which is derived from the account's
   *  own creation stamp rather than stored — no admin ever performed it. */
  synthetic: boolean;
  /** Why the actor did it, when they were asked and answered. */
  reason?: string | null;
  /** `{field: [before, after]}`. Null on rows that changed nothing a diff can
   *  show — a create, a login, an action that only ever has one state. */
  changes?: Record<string, [unknown, unknown]> | null;
  ip?: string | null;
}
export interface AuditAction {
  action: string; label: string; verb: string; destructive: boolean;
}
/** Built from what the log actually holds, so a filter never offers a value
 *  with no rows behind it. */
export interface AuditVocabularies {
  actions: AuditAction[];
  modules: string[];
  roles: string[];
  verbs: string[];
  destructiveWords: string[];
}
/** Counts over the WHOLE filtered log, not the page — each facet ignores its
 *  own filter so picking one value never collapses the others to zero. */
export interface AuditFacets {
  modules: Record<string, number>;
  roles: Record<string, number>;
  /** Actions whose key contains delete/reject/cancel/archive/revoke/remove/reverse. */
  destructive: number;
  routine: number;
}
export interface AuditResponse {
  entries: AuditEntry[];
  total: number; pageNo: number; pageSize: number;
  facets: AuditFacets;
}
export interface PlanFeature {
  text: string;
  /** Detail line printed under the bullet on the public card. Optional. */
  subItem?: string;
}
export interface PlanCycle {
  id: number; durationMonths: number; price: string; oldPrice: string | null;
  badgeLabel: string; isActive: boolean;
}
export type PlanCycleInput = {
  durationMonths: number; price: string; oldPrice?: string; badgeLabel?: string; isActive?: boolean;
};
export interface PlanRow {
  id: number; planFamily: string; entityType: string; title: string;
  subtitle: string; tier: number; amount: string; payableAmount: string;
  discountPercentage: string; duration: string; tag: string;
  /** Card order inside the family, 1 = first. Siblings shift to make room. */
  displayIndex?: number;
  badge?: string; badgeIcon?: string;
  /** Stored as [{text, subItem?}]; writes accept plain strings too. */
  features: (PlanFeature | string)[]; billingCycles: PlanCycle[]; isActive: boolean;
  /** Archived = the soft delete. Out of the catalogue, still listed for admins. */
  isArchived?: boolean;
  createdAt?: string | null; updatedAt?: string | null;
  /** What points at this plan. Only the list endpoint fills it. */
  usage?: { members: number; membersActive: number; quotationLines: number } | null;
}
export interface BannerButton { label: string; link: string; isPrimary: boolean; }
export interface BannerMetric { metric: string; description: string; index: number; }
export interface BannerBusinessRef { id: number; name: string; }
export type BannerAudience = "all" | "buyers" | "sellers";
// Full HomeHeroBanner slide (interior_advertisement.HomeHeroBanner) — the model
// the public site actually renders. Replaces the old dead app_ib.Banners shape.
export interface BannerRow {
  id: number; page: string; tag: string; title: string; description: string;
  audience: BannerAudience; displayOrder: number; isActive: boolean;
  backgroundGradient: string; backgroundImageUrl: string;
  startsAt: string | null; endsAt: string | null;
  buttons: BannerButton[]; metrics: BannerMetric[]; businesses: BannerBusinessRef[];
}
// Editor payload sent to create/update (businesses referenced by id, max 2).
export interface BannerInput {
  page: string; tag: string; title: string; description: string;
  audience: BannerAudience; displayOrder?: number; isActive: boolean;
  backgroundGradient: string; backgroundImageUrl: string;
  startsAt: string | null; endsAt: string | null;
  buttons: BannerButton[]; metrics: BannerMetric[]; businessIds: number[];
}
export interface RevenueBar { label: string; amount: number; }
export interface MonthPoint { month: string; amount: number; }
export interface RevenueAssumptions {
  avgLifetimeMonths: number; grossMargin: number; revenueTarget: number; newCustomersThisMonth: number;
}
export interface ExpenseRow { id: number; label: string; amount: number; category: string; kind: string; incurredAt: string | null }
export interface RevenueOverview {
  grossRevenue: number; refunded: number; netRevenue: number; mrr: number;
  arpu: number; activeSubscribers: number; cac: number; payingCustomers: number;
  salesThisMonth: number; momDeltaPct: number;
  revenueByFamily: RevenueBar[]; monthlyRevenue: MonthPoint[];
  expensesTotal: number; expensesFixed: number; expensesReinvest: number; net: number;
  ltv: number; ltvCac: number; paybackMonths: number;
  assumptions: RevenueAssumptions;
  expenses: ExpenseRow[];
}

// ── Deals (interior_admin deals/) ──
// House style for this endpoint family: HTTP status is ALWAYS 200. A logical
// failure comes back as `{ response:false, code, message, data:{message} }`
// — code 403 for a permission refusal, code 202 for everything else
// (not-found included; that is the 52-site convention, not a bug). Callers
// must branch on `res.response`, never on HTTP status or `res.code === 404`.
export interface DealStageVocab { key: string; label: string; tone: string; hint: string; displayOrder: number; isTerminal: boolean; }
export interface DealPriorityVocab { key: string; label: string; displayOrder: number; }
export interface DealTagVocab { slug: string; label: string; tone: string; }
export interface DealPersonRef { id: number; name: string; username: string; }
export interface DealRow {
  id: number;
  ref: string;
  contactName: string;
  businessName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  interestedIn: string;
  query: string;
  stageKey: string;
  stageLabel: string;
  stageTone: string;
  stageSince: string;
  priorityKey: string;
  priorityLabel: string;
  valuePaise: number | null;
  owner: DealPersonRef | null;
  coOwner: DealPersonRef | null;
  /** The platform account this deal sells to; null until somebody links it. */
  customer?: DealPersonRef | null;
  nextActionDate: string | null;
  nextActionNote: string;
  expectedClose: string | null;
  enquiryRef: string;
  /** The intake form as it was submitted: a JSON OBJECT serialised to a
   *  string, keys and order the funnel's own. `string` and not a typed shape
   *  on purpose — the funnels ask different questions and gain new ones
   *  without telling this panel, so anything declared here would be a promise
   *  the wire does not keep. Empty on every deal keyed in by hand. */
  submission: string;
  stalled: boolean;
  lostReason: string;
  tags: DealTagVocab[];
  createdAt: string;
  updatedAt: string;
  /** The Q / I / ₹ chain. `quotationStatus` is the LIVE quotation's status
   *  ("none" when there is none, or a revision has superseded every one);
   *  `invoiceStatus` is "none" | "draft" | "paid" — an invoice cannot be
   *  issued without its payment, so there is no issued-but-unpaid state to
   *  report; `paid` is a payment on the ledger that has not been reversed. */
  quotationStatus: string;
  invoiceStatus: string;
  paid: boolean;
  /** Money, in paise, and both are SUMS OF REAL ROWS — `collectedPaise` is the
   *  DealPayment ledger (reversals are negative rows, so they subtract
   *  themselves), `outstandingPaise` is the agreed value minus it, floored at
   *  zero. Never an estimate or a projection. */
  collectedPaise: number;
  outstandingPaise: number;
}
export interface DealsListResponse {
  deals: DealRow[];
  total: number;
  pageNo: number;
  pageSize: number;
  /** `collectedPaise` / `outstandingPaise` cover the same scope byStage does —
   *  the filters WITHOUT the stage narrowing — and both are sums of real rows.
   *  Outstanding is floored per deal, so one overpaid deal cannot cancel out
   *  another's genuine shortfall. */
  counts: { total: number; byStage: Record<string, number>;
            collectedPaise: number; outstandingPaise: number };
  stages: DealStageVocab[];
  priorities: DealPriorityVocab[];
  tags: DealTagVocab[];
}
export interface DealTransition {
  id: number;
  fromStageKey: string | null;
  fromStageLabel: string | null;
  toStageKey: string;
  toStageLabel: string;
  actor: DealPersonRef | null;
  actorRole: string | null;
  reason: string;
  enteredAt: string;
}
export interface DealRemark {
  id: number;
  typeKey: string;
  typeLabel: string;
  author: DealPersonRef | null;
  text: string;
  nextActionDate: string | null;
  createdAt: string;
}
export interface DealDetailResponse {
  deal: DealRow;
  transitions: DealTransition[];
  remarks: DealRemark[];
}
/** A tag as the catalogue editor sees it — `count` is how many deals carry it,
 *  which is what decides whether deleting archives or removes. */
export interface DealTagRow extends DealTagVocab {
  isActive: boolean;
  count: number;
}
export interface DealCreateInput {
  contactName: string;
  phone: string;
  businessName?: string; email?: string; city?: string; state?: string;
  interestedIn?: string; query?: string;
  stageKey?: string; priorityKey?: string;
  valuePaise?: number | null;
  ownerId?: number;
  nextActionDate?: string | null; nextActionNote?: string; expectedClose?: string | null;
  tags?: string[];
  allowDuplicate?: boolean;
}
/** Every field optional BY DESIGN: this is a patch, and what you leave out is
 *  what stays as it was. */
export interface DealPatchInput {
  contactName?: string; businessName?: string; email?: string; phone?: string;
  city?: string; state?: string; interestedIn?: string; query?: string;
  priorityKey?: string;
  valuePaise?: number | null;
  nextActionDate?: string | null; nextActionNote?: string; expectedClose?: string | null;
  lostReason?: string;
}

// ── Quotations / Invoices / Payments (interior_deals_billing, via
// interior_admin QuotationsViews / InvoicesViews / DealPaymentsViews) ──
// Same envelope house style as Deals: HTTP is always 200, a logical refusal
// is `{ response:false, code, message, data:{message} }`. A quotation/invoice
// is born inside a Deal — `dealRef` below is always a Deal.ref ("DL-2501").
export type MoneyDocStatus = "draft" | "issued" | "accepted" | "rejected" | "expired" | "superseded" | "cancelled";
export type TaxMode = "applicable" | "not_applicable";
export type DiscountType = "pct" | "amt";

export interface QuotationParty {
  name: string; business: string | null; email: string | null;
  city: string; state: string; phone: string; gstin: string | null; address: string;
}
export interface QuotationItemRow {
  id: number; kind: "plan" | "addon"; name: string; description: string; hsn: string;
  termMonths: number | null; ratePerMonthPaise: number | null;
  installments: number; installmentGapMonths: number;
  discountType: DiscountType; discountValue: number; amountPaise: number;
  taxRate: number; taxableAmountPaise: number; taxAmountPaise: number;
  lineTotalPaise: number; sortOrder: number;
}
export interface QuotationEventRow {
  id: number; eventType: string; actor: DealPersonRef | null; actorRole: string;
  detail: string; createdAt: string;
}
export interface QuotationRow {
  id: number; quotationNumber: string | null; version: number; status: MoneyDocStatus;
  dealRef: string; parentQuotationId: number | null; supersededById: number | null;
  party: QuotationParty;
  quotationDate: string; validUntil: string; placeOfSupply: string; gstRate: number; taxMode: TaxMode;
  notes: string; terms: string;
  subtotalPaise: number; discountAmountPaise: number; taxablePaise: number;
  cgstPaise: number; sgstPaise: number; igstPaise: number; taxAmountPaise: number; grandTotalPaise: number;
  discountPct: number;
  owner: DealPersonRef | null; createdBy: DealPersonRef | null; createdAt: string;
  issuedBy: DealPersonRef | null; issuedAt: string | null; acceptedAt: string | null;
  rejectedAt: string | null; rejectReason: string; expiredAt: string | null; supersededAt: string | null;
  cancelledAt: string | null;
  /** Optimistic concurrency — every write must send back the value it read. */
  rowVersion: number;
  hasDocument: boolean;
  items: QuotationItemRow[];
  /** Present on the detail fetch only; the list omits it. */
  events?: QuotationEventRow[] | null;
}
export interface QuotationsListResponse { quotations: QuotationRow[]; total: number; pageNo: number; pageSize: number; }
export interface QuotationAddonPatch {
  itemId: number; name?: string; hsn?: string; amountPaise?: number;
  discountType?: DiscountType; discountValue?: number;
}
/** PUT quotations/<id>/ — one merged patch over the header, the (singular)
 *  plan line and any addon rows already on the quotation. No plan-catalogue
 *  lookup: the agent types the name/term/total/installments/discount by
 *  hand (locked scope decision — see QuotationsController). Every field
 *  optional except `rowVersion`; an absent key is left untouched. */
export interface QuotationSaveInput {
  rowVersion: number;
  quotationDate?: string; validUntil?: string; placeOfSupply?: string;
  gstRate?: number; taxMode?: TaxMode; notes?: string; terms?: string;
  planName?: string; planHsn?: string; termMonths?: number; totalAmountPaise?: number;
  installments?: number; installmentGapMonths?: number;
  discountType?: DiscountType; discountValue?: number;
  addons?: QuotationAddonPatch[];
}
export interface QuotationAddonInput {
  rowVersion: number; name?: string; hsn?: string; amountPaise?: number;
  discountType?: DiscountType; discountValue?: number;
}
export interface QuotationDocument {
  storageKey: string; checksumSha256: string; byteSize: number; generatedAt: string;
}

export interface InvoiceBilling { name: string; address: string; phone: string; gstin: string | null; }
export interface InvoiceItemRow {
  id: number; kind: "plan" | "addon"; description: string; hsn: string; amountPaise: number;
  /** Mandatory whenever `amountPaise` is set by hand (SaveInput.planRemark) —
   *  what the figure IS: an installment, a registration amount, a balance. */
  remark: string;
  installmentSeq: number | null; installmentCount: number | null;
  taxRate: number; taxableAmountPaise: number; taxAmountPaise: number;
  lineTotalPaise: number; sortOrder: number;
}
export interface InvoiceEventRow {
  id: number; eventType: string; actor: DealPersonRef | null; actorRole: string;
  detail: string; createdAt: string;
}
/** What the server needs about a file the browser uploaded to S3 itself.
 *  `fileUrl` must be the one the presign call handed back — the server derives
 *  the storage key from it and refuses any other host. */
export interface InvoiceProofUpload {
  fileUrl: string; filename: string; mime: string; bytes: number;
}
export interface InvoiceProofRow {
  id: number; filename: string; mime: string; bytes: number; url: string | null;
  uploadedBy: DealPersonRef | null; uploadedAt: string; removed: boolean;
}
export type InvoiceStatus = "draft" | "issued" | "cancelled";
export interface InvoiceRow {
  id: number; invoiceNumber: string | null; status: InvoiceStatus;
  dealRef: string; quotationId: number; quotationNumber: string | null;
  billing: InvoiceBilling;
  placeOfSupply: string; gstRate: number; taxMode: TaxMode;
  invoiceDate: string; dueDate: string;
  paymentDate: string | null; paymentMode: string; paymentReference: string;
  subtotalPaise: number; taxableTotalPaise: number;
  cgstPaise: number; sgstPaise: number; igstPaise: number; taxTotalPaise: number; grandTotalPaise: number;
  /** WHAT ACTUALLY ARRIVED, summed from the payment ledger — never inferred
   *  from `status`. Issuing used to write the payment itself, so every issued
   *  invoice read as received; it does not any more, and this is the only
   *  honest source for "paid", "outstanding" and "overdue". */
  receivedPaise: number;
  notes: string; terms: string;
  owner: DealPersonRef | null; createdBy: DealPersonRef | null; createdAt: string;
  issuedBy: DealPersonRef | null; issuedAt: string | null;
  cancelledBy: DealPersonRef | null; cancelledAt: string | null; cancellationReason: string;
  rowVersion: number;
  items: InvoiceItemRow[];
  events?: InvoiceEventRow[] | null;
  proofs?: InvoiceProofRow[] | null;
}
export interface InvoicesListResponse { invoices: InvoiceRow[]; total: number; pageNo: number; pageSize: number; }
export interface InvoiceAddonPatch { itemId: number; description?: string; hsn?: string; amountPaise?: number; }
/** PUT invoices/<id>/ — same "one merged patch" shape as quotations.
 *  `planAmountPaise` and `planRemark` travel together: sending an amount
 *  without a remark is refused server-side. */
export interface InvoiceSaveInput {
  rowVersion: number;
  invoiceDate?: string; dueDate?: string; placeOfSupply?: string;
  gstRate?: number; taxMode?: TaxMode; notes?: string; terms?: string;
  paymentDate?: string; paymentMode?: string; paymentReference?: string;
  planAmountPaise?: number; planRemark?: string;
  addons?: InvoiceAddonPatch[];
}
export interface InvoiceAddonInput { rowVersion: number; description?: string; hsn?: string; amountPaise?: number; }
export interface InvoiceDocumentVersion {
  version: number; storageKey: string; checksumSha256: string; generatedAt: string;
}

/** The deal-payment ledger (interior_deals_billing.DealPayment). Distinct
 *  from `payments()`/`verifyPayment()`/`refund()` below, which are the
 *  legacy subscription-plan gateway console (TransectionData) — a different
 *  model, a different module, deliberately not touched by this feature. */
export interface DealPaymentRow {
  id: number; dealRef: string; invoiceId: number; invoiceNumber: string | null;
  type: "payment" | "reversal"; amountPaise: number; paymentDate: string;
  mode: string; reference: string;
  reversesPaymentId: number | null; idempotencyKey: string;
  ownerAtPayment: DealPersonRef | null; recordedBy: DealPersonRef | null;
  reason: string; createdAt: string;
  /** A payment row that has a reversal row — the pair nets to zero whatever
   *  dates they fall on. Always false on reversal rows. */
  reversed: boolean;
}
export interface DealPaymentsListResponse { payments: DealPaymentRow[]; total: number; pageNo: number; pageSize: number; }

/** One row of any GET v1/admin/vocab/<list>/ value list. `scope` names the
 *  consumer a row was added for ('' = every consumer); `?scope=` filters on it. */
export interface VocabItem {
  key: string; label: string; tone: string; hint?: string; displayOrder?: number; isActive?: boolean; scope?: string;
  /** Only on vocab/expense-tag-kinds: where money under the kind lands. */
  landsIn?: string;
  /** Only on vocab/subscription-sources: the tag's short word. */
  short?: string;
}

/** GET v1/admin/users/vocabularies/ — every option list the Users directory's
 *  filter bar offers. `cities` are the ones on record, folded to one entry per
 *  spelling, so they are a suggestion list and not a closed set. */
export interface UserTagItem { slug: string; label: string; tone: string; help: string; isActive: boolean }
/** One row of GET v1/admin/platform-users/ — a platform account (admin and
 *  staff are not in it) as the Users directory renders it. `userId` is
 *  "IB-U-<pk>"; `completeness` is null when the account holds no business, shop
 *  or architect profile to grade. */
/** One tag ON an account: which tag, who put it there and when. `assignedBy` is
 *  the assigner's NAME (the record prints it under the chip) and is "" when the
 *  assignment carries no assigner — applied outside the panel, or by an account
 *  since removed. Blank means not recorded, never "the system". */
export interface UserTagOnRecord { slug: string; assignedBy: string; assignedAt: string | null }
export interface PlatformUserItem {
  userId: string;
  pk: number;
  userStatus: "active" | "deactivated";
  registeredAt: string | null;
  lastActivityAt: string | null;
  identity: { name: string; email: string | null; phone: string | null };
  profile: { username: string | null; targetAreas: { state: string; cities: string[] }[] };
  tags: UserTagOnRecord[];
  completeness: number | null;
  /** The go-live checklist items the graded entity has not met, by label. */
  missingFields?: string[];
}
export interface PlatformUsersPage { users: PlatformUserItem[]; total: number; pageNo: number; pageSize: number }

/** A stored value and the label the server gives it. */
export interface ValueLabel { value: string; label: string }
/** Pointers into Deals and Invoices. An invoice is opened by id; its number is null until issued. */
export interface UserCommercial {
  salesOwner: string | null;
  dealRefs: string[];
  invoices: { id: number; number: string | null }[];
  /** The enquiry allowance on a business account: how many enquiries its plan
   *  lets it be given this period and how many it has been. A count, never
   *  money. Absent on an account with no business. */
  leadQuota?: {
    plan: string; subscription: string; renewsAt: string | null; expiredAt: string | null;
    allowance: number; used: number; remaining: number; period: string;
    source: "plan" | "default";
  };
}
/** GET v1/admin/platform-users/<pk>/ — the row above plus the account's login
 *  username and the business profile it holds (a business first, else a shop). */
/** One internal note on an account (interior_admin Note, subjectType
 *  `platform_user`). `authorRole` is read off the author's role at READ time,
 *  not stored beside the note; `authorId` is who may change it — its author, or
 *  full access, and nobody else. */
export interface UserNoteRow {
  noteId: string; author: string; authorRole: string; at: string | null; text: string;
  authorId: number | null;
}
export interface PlatformUserRecord extends PlatformUserItem {
  accountUsername: string;
  deactivatedReason: string | null;
  deactivatedAt: string | null;
  /** The account's internal notes, newest first. The record read IS the list. */
  notes: UserNoteRow[];
  /** ONE flag for the account (an OTP entered on the login name), not per channel. */
  isVerified: boolean;
  /** CustomUser.unique_id. */
  authUserId: string;
  /** A UserRegistrationSource key; "" = not recorded. */
  registrationSource: string;
  /** Always empty today: a Deal has no link to an account. */
  commercial: UserCommercial;
  profile: PlatformUserItem["profile"] & {
    /** UserProfile.updatedAt; null when the account has no profile row. */
    updatedAt: string | null;
    businessName: string | null;
    businessType: ValueLabel[];
    dealsIn: ValueLabel[];
    segments: ValueLabel[];
    categories: ValueLabel[];
    searchKeywords: ValueLabel[];
    positioning: ValueLabel[];
    about: string | null;
  };
}

export interface UsersVocabularies {
  classifications: VocabItem[];
  registrationSources: VocabItem[];
  tags: UserTagItem[];
  cities: string[];
  /** {state name: [city]} — per-state city suggestions, derived from the saved (state, city) pairs. */
  stateCities?: Record<string, string[]>;
  registeredRanges: { key: string; label: string }[];
  sortOptions: { key: string; label: string }[];
  /** The profile schema rows (the ProfileField shape the Users store reads). */
  profileFields?: Record<string, unknown>[];
  /** Decisions not yet taken, named on the screens they affect. */
  openDecisions?: OpenDecision[];
  /** A public handle's length, as the profile PATCH enforces it. */
  usernameRules?: { min: number; max: number };
  /** Handles no profile may take (PanelVocab `reserved_username`), refused case-insensitively. */
  reservedUsernames?: string[];
}
export interface OpenDecision { id: string; title: string; position: string; blocks: string }

/** One month of GET v1/admin/users/analytics/. MONTH-KEYED so any span the panel
 *  asks for is real arithmetic rather than a pre-summed window; `bySource` sums
 *  exactly to `registrations`, with "" the accounts whose channel was never
 *  recorded. */
export interface UsersAnalyticsMonth {
  month: string; label: string; short: string;
  registrations: number;
  /** Registered that month AND holding every required profile field today. */
  profileCompleted: number;
  bySource: Record<string, number>;
}
export interface UsersAnalytics {
  /** The server's own "now", so every window is computed against its clock. */
  asOf: string;
  months: UsersAnalyticsMonth[];
  /** Every channel the split is keyed by, "" = Not recorded. */
  sources: { key: string; label: string }[];
  /** The whole population, counted NOW — not the page the directory loaded. */
  base: { total: number; active: number; deactivated: number; incompleteProfiles: number };
}

/** A plan purchase (TransectionData) as `payments/` returns it. Money is a
 *  RUPEE string here, not paise — the legacy model stores it that way. */
/** WHO PAID a plan purchase. TransectionData has no user column; the plan row
 *  carrying the same transactionId names the buyer, and the server joins it.
 *  Null when no plan row names the payment — never a guessed customer. */
export interface PayerRef { userId: number | null; name: string; business: string; planStatus: string }
export interface PlanPaymentRow {
  id: number; orderId: string; transactionId: string; amount: string; paymentFor: string;
  orderStatus: string; paymentMethod: string; refundStatus: string; refundAmount: string;
  verifiedAt: string | null; createdAt: string;
  payer?: PayerRef | null;
}
export interface PlanPaymentsListResponse { payments: PlanPaymentRow[]; total: number; pageNo: number; pageSize: number; }

/** interior_deals_billing.Installment — stored, or computed for a quotation
 *  accepted before the table existed (`source: "computed"`, `id: null`). */
export interface InstallmentRow {
  id: number | null; source: "stored" | "computed"; quotationId: number; quotationNumber: string | null;
  dealRef: string; seq: number; count: number; amountPaise: number; dueDate: string;
  status: VocabItem; graceEnds: string; invoiceId: number | null; invoiceNumber: string | null;
  paidAt: string | null; failedAt: string | null; failureReason: VocabItem | null; failureNote: string;
  cancelledAt: string | null; cancelledReason: string;
}
export interface InstallmentsListResponse { installments: InstallmentRow[]; total: number; pageNo: number; pageSize: number; }

/** interior_admin.OtherIncome — money in that is not a customer payment. */
export interface IncomeRow {
  id: number; kind: VocabItem; amountPaise: number; description: string; party: string; mode: VocabItem;
  reference: string; valueDate: string; account: VocabItem; state: VocabItem; recordedAt: string;
  receipt?: { url: string | null; name: string; mime: string; bytes: number };
  cancelReason?: string; cancelledBy?: { id: number; username: string } | null; cancelledAt?: string | null;
  recordedBy?: { id: number; username: string } | null;
}
/** POST income/. The receipt is already in S3 (presigned PUT). */
export interface IncomeRecordInput {
  kind: string; amountPaise: number; description: string; party?: string; mode: string; reference: string;
  valueDate: string; account: string; receiptUrl: string; receiptName?: string; receiptMime: string; receiptBytes?: number;
}
export interface IncomeListResponse { income: IncomeRow[]; total: number; pageNo: number; pageSize: number; }

/** interior_admin.WorkItem. `delayed` is derived server-side (open, past due). */
export interface WorkItemRow {
  id: number; title: string; assignee: DealPersonRef; status: VocabItem; priority: VocabItem;
  delayed: boolean; startDate: string | null; dueDate: string | null; completedAt: string | null; rowVersion: number;
  /* overview/d6 */
  kind: VocabItem; targetValue: number | null; targetUnit: string; tags: WorkTagRef[]; links: WorkLink[];
  /** team/d2: the item it rolls up into, and progress derived by the server
   *  (milestone = completed children ÷ all; target = EOD deltas ÷ value; task 0|100). */
  parent?: number | null; progress?: number | null;
  description?: string; createdBy?: DealPersonRef | null; blockedBy?: number | null;
  cancelledReason?: string; cancelledAt?: string | null; createdAt?: string; updatedAt?: string;
  /** WHAT it waits for, beside WHICH task it waits on. Empty when nothing blocks it. */
  blockedReason?: string;
  /** The task's own steps. `progress` above counts them (a completed task is
   *  100 whatever they say); ids are stable across every checklist write. */
  checklist?: WorkCheckLine[];
  /** Soft edges OUT of this task. Stored on this end only — the far end reads
   *  them by scanning and prints the inverse label from the relation's vocab
   *  row (`hint` on GET vocab/work-link-relations/). */
  itemLinks?: WorkItemLink[];
}
export interface WorkCheckLine { id: string; text: string; done: boolean }
export interface WorkItemLink { itemId: number; relation: string }
/** PATCH work/<id>/. `rowVersion` is required; a key sent as null clears it
 *  (blockedBy, parent); `tags` and `links` are the FULL list. */
export interface WorkUpdateInput {
  rowVersion: number; title?: string; description?: string; assignee?: number; priority?: string;
  startDate?: string | null; dueDate?: string | null; kind?: string; targetValue?: number | null;
  targetUnit?: string; tags?: number[]; links?: WorkLink[]; blockedBy?: number | null; parent?: number | null;
  /** Written with `blockedBy` and dropped with it. */
  blockedReason?: string;
}
export interface WorkTagRef { id: number; slug: string; label: string; tone: VocabItem }
export interface WorkTagRow extends WorkTagRef { owner: DealPersonRef; createdAt: string; archivedAt: string | null }
export interface WorkLink { url: string; label: string }
/** POST work/. `assignee` omitted = the caller; someone else needs work.all.
 *  Target value + unit only on kind `target`; tags only the assignee's own. */
export interface WorkCreateInput {
  title: string; description?: string; assignee?: number; priority?: string; startDate?: string | null;
  dueDate?: string | null; kind?: string; targetValue?: number | null; targetUnit?: string;
  tags?: number[]; links?: WorkLink[]; blockedBy?: number | null; parent?: number | null;
}
/* ── who owes a plan / report, leave, agreements (overview/d6) ── */
export interface WorkSettingsRow {
  member: DealPersonRef; dayStartsAt: string; graceMinutes: number; expectedHoursPerDay: number;
  joiningDate: string | null; autoCloseAt: string; timezone: string;
  /** Who this member answers to; null = nobody. */
  reportsTo: DealPersonRef | null; updatedAt: string;
  designation?: VocabItem | null; employmentType?: VocabItem | null;
}
/** One line of what a salary is MADE of. `kind` decides which side it falls
 *  on: net is gross minus the deductions, and the run does that arithmetic. */
export interface SalaryComponentRow {
  key: string; label: string; kind: "earning" | "deduction"; amountPaise: number;
}
/** Where the salary is sent. SENSITIVE: every field but the bank's name comes
 *  back as its last four characters and the whole value never leaves the
 *  server — so this is what a screen may print, not what it may edit back. */
export interface PayToRef {
  bankName: string; accountMasked: string; ifsc: string; upi: string; pan: string; uan: string;
}
/** GET salaries/accounts/?member= (team/d2) — finance-salaries.view. */
export interface SalaryAccountRow {
  id: number; member: DealPersonRef; employeeCode: string; monthlyGrossPaise: number;
  isActive: boolean; createdAt?: string | null;
  /** Who opened it, off the audit trail; null when the trail has no opening. */
  openedBy?: DealPersonRef | null;
  components?: SalaryComponentRow[];
  /** Σ the deduction components, and gross minus them. */
  deductionsPaise?: number; monthlyNetPaise?: number;
  payTo?: PayToRef;
}
/** GET subs/ — one purchased plan (BusinessPlan / ShopPlan / ArchitectPlan /
 *  AutomationPlan), with the gateway payment that bought it where there is
 *  one. `amount` is a RUPEE string, as the plan row stores it. */
export interface SubPaymentRef {
  orderId: string; transactionId: string; amount: string; orderStatus: string;
  paymentMethod: string; refundStatus: string; refundAmount: string;
  createdAt: string | null; verifiedAt: string | null; refundedAt: string | null;
  /** The admin who verified a MANUAL payment; null for a gateway one. */
  verifiedBy?: { id: number; username: string } | null;
  /** Set when an admin reversed it (orderStatus REVERSED): it no longer counts. */
  reversedAt?: string | null; reversalReason?: string;
}
export interface SubRow {
  id: number; family: string; amount: string; status: string; isActive: boolean;
  user: string | null; userId: number | null; customer: string | null;
  entityName: string | null; planId: number | null; planTitle: string | null;
  durationMonths: number | null; buyIntent: string | null; transactionId: string | null;
  /** How the sale happened, computed by the server off `buyIntent`. */
  source: SubSourceKey;
  startedAt: string | null; recordedAt: string | null; expireDate: string | null;
  payment: SubPaymentRef | null;
  /** The commitment recorded over this purchase, when one has been — where it
   *  stands, whether it renews, and why it stopped. Null until somebody
   *  records one. */
  subscription: SubscriptionRow | null;
}
/** An accepted quotation as a subscription reads it (subs Chain.py). */
export interface SubQuotationRef {
  id: number; quotationNumber: string | null; dealRef: string; planName: string; termMonths: number;
  installments: number; installmentGapMonths: number; grandTotalPaise: number; quotationDate: string;
}
/** One row of a quotation's schedule, with the deal-ledger payment behind it. */
export interface SubInstallmentRow {
  id: number; seq: number; count: number; amountPaise: number; dueDate: string;
  /** InstallmentStatus key: due · paid · failed · cancelled. */
  status: string; invoiceNumber: string | null; paidAt: string | null; failedAt: string | null;
  failureReason: string | null; failureNote: string;
  payment: { id: number; amountPaise: number; mode: string; reference: string; paymentDate: string;
    recordedBy: string | null; recordedAt: string | null } | null;
}
/** An invoice raised on a chain's quotation. `carriesSeq` = the installment it
 *  already settles; null when nothing does. */
export interface SubChainInvoice {
  id: number; invoiceNumber: string | null; status: string; quotationNumber: string | null; dealRef: string;
  billingName: string; description: string; placeOfSupply: string; invoiceDate: string; dueDate: string;
  paymentDate: string | null; taxablePaise: number; grandTotalPaise: number; carriesSeq: number | null;
}
/** GET subscriptions/chains/ — an accepted quotation on a deal linked to its customer. */
export interface SubChainRow {
  userId: number; quotation: SubQuotationRef; invoices: SubChainInvoice[]; subscriptionId: number | null;
}
/** interior_admin.Subscription — the recurring commitment ON TOP of a plan
 *  purchase, or over an accepted QUOTATION (migration 0063). A purchase is one
 *  payment, so its installment line is derived from that payment; a quotation's
 *  schedule is its own Installment rows, read back as `installments`. */
export interface SubscriptionRow {
  id: number; family: string | null; purchaseId: number | null; userId: number | null;
  /** The account holder's name, or their username. */
  customer?: string;
  quotation?: SubQuotationRef | null;
  /** The quotation's schedule; null on a purchase. */
  installments?: SubInstallmentRow[] | null;
  state: VocabItem | null; cycleMonths: number;
  startedOn: string | null; renewsOn: string | null;
  cancelledAt: string | null; cancelReason: string;
  soldBy: { id: number; username: string } | null;
  recordedBy: { id: number; username: string } | null;
  recordedAt: string | null; updatedAt: string | null;
  /** While `defaulting`: what the fail to pay recorded — an
   *  installment-failure-reasons key and the evidence — read back off the audit
   *  trail. Null in any other state. */
  failure?: { reason: string; note: string; at: string | null; by: { id: number; username: string } | null } | null;
  /** Only on GET subscriptions/ — the purchase this stands over, with the
   *  payment that bought it. */
  purchase?: SubRow | null;
  /** Only on GET subscriptions/ — the purchase's `source`; null with no purchase. */
  source?: SubSourceKey | null;
}
/** vocab/subscription-sources keys. */
export type SubSourceKey = "sales" | "website";
/** vocab/refund-origins keys. */
export type RefundOriginKey = "subscription" | "deal_payment" | "manual";
export interface SubscriptionsListResponse {
  subscriptions: SubscriptionRow[]; total: number; pageNo: number; pageSize: number;
}
export interface SubsListResponse {
  subs: SubRow[]; total: number; pageNo: number; pageSize: number; family: string;
  analytics: { activeCount: number; expiredCount: number; pendingCount: number; totalCount: number; revenue: number };
}
/** The slip's OWN copy of how its figures were reached, frozen when the run
 *  was built. `basePaise` is the full month's gross and never moves — it is
 *  what loss of pay pro-rates against, which is why applying it twice is safe
 *  and why a later raise cannot reach back into the month. */
export interface PayslipBreakdown {
  earnings?: SalaryComponentRow[]; deductions?: SalaryComponentRow[]; basePaise?: number;
  incentivePaise?: number; adjustmentPaise?: number; adjustmentReason?: string;
  remark?: string; issuedAt?: string | null;
}
/** GET salaries/slips/?month=&member= — finance-salaries.view. One payslip.
 *  `mode`/`reference`/`paidFrom`/`receipt` are filled when it is paid. */
export interface PayslipRow {
  id: number; runId: number; month: string; accountId: number; member: DealPersonRef;
  employeeCode: string; grossPaise: number; deductionsPaise: number; netPaise: number;
  paidDays: number; lopDays: number; paidAt: string | null; held: boolean;
  mode: VocabItem | null; reference: string;
  breakdown?: PayslipBreakdown;
  /** The slip has no column for it — it rides the audit trail with the hold,
   *  and the server reads that trail back by subject. */
  heldReason?: string;
  paidFrom?: VocabItem | null;
  /** The transfer receipt, a private Attachment read back as a signed URL. */
  receipt?: { id: number; fileName: string; mimeType: string; sizeKb: number; url: string } | null;
  /** The document number the server allots. Absent on a draft, which has none
   *  yet, and absent from a server that does not persist one. */
  slipNumber?: string | null;
  /** Where THIS slip's money was sent, frozen with the slip. Masked, like the
   *  account's own — the whole values never leave the server. */
  payTo?: PayToRef | null;
}
export interface PayslipsResponse { slips: PayslipRow[]; total: number }
/** POST salaries/runs/ — the run just built and every slip on it. */
export interface SalaryRunBuildResponse { run: SalaryRunRow; slips: PayslipRow[] }
/** POST salaries/slips/<id>/pay/ — the slip, and the run it may have closed. */
export interface PayslipPayResponse { slip: PayslipRow; run: SalaryRunRow }
/** GET resources/?member= (team/d2): the member's forms (audience or answered) and their responses. */
export interface ResourceRow {
  id: number; title: string; description: string; tags: string[]; roles: { id: number; name: string }[];
  state: VocabItem; version: number; fields: unknown[]; createdAt: string | null; openedAt: string | null;
  closedAt: string | null; responses: number | null; createdBy?: DealPersonRef | null;
}
export interface ResourceAnswerRow {
  fieldId: string; label: string; value: string;
  file?: { fileName: string; mimeType: string; sizeKb: number; url: string } | null;
}
export interface ResourceResponseRow {
  id: number; resource: number; version: number; member: DealPersonRef; submittedAt: string | null;
  answers?: ResourceAnswerRow[];
}
/** POST/PUT resources/. `roles` are rbac Role ids; empty = every active member. */
export interface ResourceDraftInput {
  title: string; description: string; tags: string[]; roles: number[]; fields: unknown[];
}
/** GET incentives/?member= (team/d2) — finance-salaries.view. Money in paise. */
export interface IncentiveRow {
  id: number; member: DealPersonRef; month: string; workItem: { id: number; title: string } | null; basis: string;
  amountPaise: number; state: VocabItem; decidedAt: string | null; paidAt: string | null;
  createdBy?: DealPersonRef | null; createdAt?: string; decidedBy?: DealPersonRef | null;
}
export interface LeaveRow {
  id: number; member: DealPersonRef; kind: VocabItem; fromDate: string; toDate: string; reason: string;
  state: VocabItem; decidedBy: DealPersonRef | null; decidedAt: string | null; decisionNote: string; createdAt: string;
}
export interface LeaveListResponse { leave: LeaveRow[]; total: number; pageNo: number; pageSize: number }
export interface DailyPlanRow {
  id: number; member: DealPersonRef; businessDate: string; expectedOutcome: string; blockers: string; notes: string;
  submittedAt: string | null; createdAt: string;
  lines: { id: number; ordinal: number; title: string; priority: VocabItem; workItemId: number | null }[];
}
export interface DailyReportRow {
  id: number; member: DealPersonRef; businessDate: string; pendingWork: string; pendingReason: string;
  achievement: string; blockers: string; supportNeeded: string; tomorrowPriority: string; notes: string;
  submittedAt: string | null; acknowledgedBy: DealPersonRef | null; acknowledgedAt: string | null; createdAt: string;
  lines: { id: number; title: string; done: boolean; targetDelta: number | null; workItemId: number | null }[];
}
export interface AgreementRow {
  id: number; member: DealPersonRef; kind: VocabItem; title: string; version: number; state: VocabItem;
  sentAt: string | null; sentBy: DealPersonRef | null; viewedAt: string | null; signedAt: string | null;
  signedName: string; expiresAt: string | null; createdAt: string;
  /** The document frozen at send, the signing token and the signer's address —
   *  every list row is the caller's own or read with full access. */
  body: string; token: string; signerIp: string | null;
  /** The template row it was rendered from; "" for a body typed by hand.
   *  Provenance that survives a rename, which kind + title did not. */
  templateKey: string;
}
/** POST agreements/ — full access. `body` is the panel's rendered template;
 *  `expiresAt` a date (end of that day), omitted = seven days. */
export interface AgreementSendInput {
  member: number; kind: string; title: string; body: string; version?: number; expiresAt?: string;
  /** The NotificationTemplate key. The one-live-copy guard keys off it. */
  templateKey?: string;
}
/** GET agreements/templates/ — the WORDING, reused. A NotificationTemplate row
 *  on channel `agreement`; `key` is what an Agreement's `templateKey` holds. */
export interface AgreementTemplateRow {
  key: string; title: string; kind: string; purpose: string;
  state: "draft" | "active" | "retired"; version: number;
  clauses: { clauseId: string; heading: string; text: string }[];
  createdAt: string; updatedAt: string | null;
}
export interface AgreementTemplateInput {
  title: string; kind: string; purpose?: string;
  clauses: { clauseId?: string; heading?: string; text: string }[];
}
/** GET member-documents/ (team/d1). `file` is a SIGNED, expiring read of a
 *  private object — never a bare URL — and null when no file was handed over. */
export interface MemberDocumentRow {
  id: number; member: DealPersonRef; kind: VocabItem & { required: boolean }; label: string; fileName: string;
  sizeKb: number; uploadedAt: string; uploadedBy: DealPersonRef | null; verifiedBy: DealPersonRef | null;
  verifiedAt: string | null;
  file: { fileName: string; mimeType: string; sizeKb: number; url: string } | null;
}
/** GET overview/operations/ (overview/d7): the Operations card's counts, on the
 *  server's clock. Counts only; `leave` ignores the role filter. */
export interface OverviewOperations {
  asOf: string; period: { start: string; end: string }; members: number;
  tasks: {
    overdue: number; waiting: number; dueWeek: number; inProgress: number; completed: number;
    /** dueWeek per assignee with any, most first (overview/d8). */
    dueWeekByMember: { id: number; name: string; n: number }[];
  };
  today: { present: number; late: number; absent: number; onLeave: number; unclosed: number };
  owed: { noPlan: number; noEod: number; unread: number; leave: number; agreementsUnopened: number; docsMissing: number };
}
/** GET overview/signals/ (overview/d8): the planning signals the page does not
 *  already read. Each piece is gated on the server on its own -- trajectory on
 *  finance.view, away on full access -- and is `{ denied: true }` when refused. */
export interface OverviewSignals {
  asOf: string;
  trajectory: { months: { month: string; netPaise: number }[] } | { denied: true };
  away: { members: { id: number; name: string; fromDate: string; toDate: string }[] } | { denied: true };
}
type Paged<K extends string, T> = { [k in K]: T[] } & { total: number; pageNo: number; pageSize: number };
export interface WorkListResponse { items: WorkItemRow[]; total: number; pageNo: number; pageSize: number; }

/** interior_admin.AttendanceDay. `state` is derived: working / on_break / ended / unclosed. */
/** A day the member OPENED has an id and a start; a day that does not exist
 *  (asked for with `includeMissing`) has neither, and its state says which
 *  kind of nothing it is. Same keys either way, so one list holds both. */
/* ── the finance section's own reads (overview/d5) ───────────────────────── */
/** A spend row's tag carries its KIND, because `excluded` spend (taxes,
 *  statutory) leaves the bank without changing any operating figure. */
export interface SpendTagRef extends VocabItem { kind: string; budgetPaise: number; custom?: boolean }
/** One row of the `expense-tags` value list. `custom` is the tags made in the
 *  panel rather than shipped with the seed. */
export interface ExpenseTagRow extends SpendTagRef { proofRequired: boolean; custom: boolean }
export interface SpendRow {
  id: number; label: string; amountPaise: number; tag: SpendTagRef | null; category: string;
  kind: string; state: "recorded" | "cancelled"; mode: VocabItem | null; reference: string;
  account: VocabItem | null; valueDate: string | null;
  bill: { url: string | null; name: string; mime: string; bytes: number };
  cancelReason: string; cancelledAt: string | null; recordedAt: string | null;
  /** Who the money went TO — the debit's half of the party a credit has always
   *  carried. "" when nobody was named. */
  party?: string;
  /** Rupees, the same figure as amountPaise. */
  amount?: number;
  cancelledBy?: { id: number; username: string } | null; recordedBy?: { id: number; username: string } | null;
}
/** POST revenue/expense/ as the spend record. `amount` is RUPEES; the bill is an S3 key. */
export interface ExpenseInput {
  label: string; amount: number; category?: string; kind?: string; incurredAt?: string;
  tag?: string; mode?: string; reference?: string; account?: string; party?: string;
  billUrl?: string; billName?: string; billMime?: string; billBytes?: number;
}
export interface SpendTagTotal {
  key: string; label: string; kind: string; budgetPaise: number; spentPaise: number; n: number;
  /** null when no budget is set — never 0%, which reads as "on budget". */
  pctOfBudget: number | null; overBudget: boolean;
}
export interface SpendListResponse {
  spend: SpendRow[]; total: number; pageNo: number; pageSize: number;
  totals: { operatingPaise: number; excludedPaise: number }; byTag: SpendTagTotal[];
}
export interface SalaryRunRow {
  id: number; month: string; state: VocabItem; totalNetPaise: number; slips: number;
  unpaidPeople: number; owedPaise: number; paidAt: string | null; recordedAt: string | null;
}
export interface SalariesResponse {
  runs: SalaryRunRow[]; total: number;
  paidInPeriod: { runs: number; slips: number; paise: number };
  openRun: SalaryRunRow | null;
  /** Every unpaid slip in every run, held slips left out (overview/d8). */
  owed: { paise: number; people: number };
}
/** EXACTLY ONE of `payment` / `dealPayment` / `payeeName` says who is owed —
 *  a plan payment, a deal payment, or a name and nothing else behind it. */
export interface RefundRow {
  id: number; amountPaise: number; ground: VocabItem; detail: string; state: VocabItem;
  /** Which of the three below is filled, computed by the server. */
  origin: RefundOriginKey;
  payment: { id: number; orderId: string; transactionId: string; amountPaise: number; orderStatus: string; paymentFor: string } | null;
  dealPayment?: {
    id: number; dealId: number; invoiceId: number; amountPaise: number;
    reference: string; mode: string; paymentDate: string | null;
    /** The deal's ref and its contact — the only name a deal payment holds,
     *  and therefore who the money is going back to. */
    deal: string; party: string;
  } | null;
  /** Who the money goes to when no payment row names them. */
  payeeName?: string;
  requestedAt: string; decidedAt: string | null; decisionNote: string;
  settledAt: string | null; mode: VocabItem | null; reference: string;
  /** Which of our own accounts the money left, recorded on settlement. */
  account?: VocabItem | null;
  requestedBy?: { id: number; username: string } | null; decidedBy?: { id: number; username: string } | null;
  settledBy?: { id: number; username: string } | null;
  /** The payer of the plan payment this reverses — the refund's payee. */
  payer?: PayerRef | null;
}
/** One line of GET bank/statements/<id>/ `rows`. */
export interface BankLineRow {
  id: number; date: string; direction: "credit" | "debit"; amountPaise: number; reference: string;
  narration: string; counterparty: string;
  match: { kind: "payment" | "deal-payment" | "income" | "spend" | "none"; id: number | null; label: string };
  matchedHow: string;
  resolution: { kind: VocabItem; reason: string; at: string } | null;
}
export interface BankStatementDetail extends BankStatementRow { rows: BankLineRow[] }
export interface RefundsListResponse {
  refunds: RefundRow[]; total: number; pageNo: number; pageSize: number;
  /** Approved and not yet sent — all of it, whenever it was asked for. */
  owed: { n: number; paise: number }; toDecide: number;
  /** The window a refund is read against, and whether a partial refund is accepted. */
  policy: { windowDays: number; partial: boolean };
}
export interface BankTotals {
  lines: number; matched: number; matchedPct: number | null; unexplained: number; variancePaise: number;
}
export interface BankStatementRow {
  id: number; account: { key: string; label: string }; fromDate: string; toDate: string;
  closed: boolean; closedAt: string | null; importedAt: string; lines: number; matched: number;
  matchedPct: number | null; unexplained: number; variancePaise: number; canClose: boolean;
}
export interface BankStatementsResponse {
  statements: BankStatementRow[]; total: number; totals: BankTotals;
}
export interface AttendanceDayRow {
  id: number | null; member: DealPersonRef; businessDate: string; startedAt: string | null; endedAt: string | null;
  breakMinutes: number; workedMinutes: number | null; isLate: boolean; lateByMinutes: number;
  /** The label is the backend's (team/d2); the key is what code compares. */
  state: { key: "working" | "on_break" | "ended" | "unclosed" | "absent" | "not_started" | "on_leave" | "weekly_off"; label: string; tone: string };
  source: VocabItem | null;
  breaks?: { startedAt: string; endedAt: string | null; minutes: number }[];
  correctedBy?: DealPersonRef | null; correctedAt?: string | null; correctionNote?: string;
}
export interface AttendanceDaysResponse { days: AttendanceDayRow[]; total: number; pageNo: number; pageSize: number; }
/** The rare repair path only — an issued invoice that somehow has no ledger
 *  row. The normal path is InvoicesService.issueInvoice() itself writing
 *  this row, server-side, in the same transaction as freezing the invoice. */
export interface DealPaymentRecordInput {
  invoiceId: number; amountPaise: number; mode?: string; reference: string;
  idempotencyKey: string; date?: string;
}

const qs = (params: Record<string, any>) => {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
  ) as Record<string, string>;
  const s = new URLSearchParams(clean).toString();
  return s ? `?${s}` : "";
};

export class AdminOpsService {
  // ── RBAC ──
  static mePermissions(portal = "admin") {
    return apiService.getGetApiResponse<MePermissions>(`${base}/me/permissions/${qs({ portal })}`);
  }
  static listRoles() {
    return apiService.getGetApiResponse<RolesListResponse>(`${base}/roles/`);
  }
  static createRole(name: string, modules: RoleModules, isActive = true) {
    return apiService.getPostApiResponse<AdminRole>(`${base}/roles/`, { name, modules, isActive });
  }
  static updateRole(id: number, data: { name?: string; modules: RoleModules; isActive?: boolean }) {
    return apiService.getPutApiResponse<AdminRole>(`${base}/roles/`, { id, ...data });
  }
  static deleteRole(id: number, reason: string) {
    return apiService.getDeleteApiResponse<{ id: number; deleted: boolean }>(`${base}/roles/`, { id, reason });
  }

  // ── Team members (interior_admin/urls.py → AdminUserViews) ──
  static users() {
    return apiService.getGetApiResponse<AdminUserRow[]>(`${base}/users/`);
  }
  /** GET v1/engine/server-time/ — the server's clock; the member page's "today". */
  static serverTime() {
    return apiService.getGetApiResponse<{ serverNow: string; epochMs: number }>("v1/engine/server-time/");
  }
  /** GET resources/?member=<id> — own freely, anybody else's with resources.view. */
  static resources(params: { member?: string; state?: string } = {}) {
    return apiService.getGetApiResponse<{ resources: ResourceRow[]; responses: ResourceResponseRow[] | null }>(
      `${base}/resources/${qs(params)}`);
  }
  /** GET incentives/?member= — finance-salaries.view. */
  static incentives(params: { member?: string; state?: string; month?: string } = {}) {
    return apiService.getGetApiResponse<{ incentives: IncentiveRow[]; total: number }>(`${base}/incentives/${qs(params)}`);
  }
  /** GET salaries/accounts/?member= — finance-salaries.view. */
  static salaryAccounts(params: { member?: string } = {}) {
    return apiService.getGetApiResponse<{ accounts: SalaryAccountRow[] }>(`${base}/salaries/accounts/${qs(params)}`);
  }
  /** POST salaries/accounts/ — finance-salaries.approve. One account per member.
   *  `components` earnings must add up to `monthlyGrossPaise`; `payTo` goes in
   *  whole and only ever comes back masked. */
  static createSalaryAccount(data: {
    member: number; employeeCode: string; monthlyGrossPaise: number;
    components?: SalaryComponentRow[]; payTo?: Partial<PayToRef>;
  }) {
    return apiService.getPostApiResponse<SalaryAccountRow>(`${base}/salaries/accounts/`, data);
  }
  /** PATCH salaries/accounts/<id>/ — revise or close one. `reason` is mandatory
   *  when `isActive` goes false; it rides the audit trail. */
  static updateSalaryAccount(id: number, data: {
    employeeCode?: string; monthlyGrossPaise?: number; isActive?: boolean; reason?: string;
    components?: SalaryComponentRow[]; payTo?: Partial<PayToRef>;
  }) {
    return apiService.getPatchApiResponse<SalaryAccountRow>(`${base}/salaries/accounts/${id}/`, data);
  }
  /** GET salaries/slips/?month=&member= — every payslip, newest month first. */
  static payslips(params: { month?: string; member?: string } = {}) {
    return apiService.getGetApiResponse<PayslipsResponse>(`${base}/salaries/slips/${qs(params)}`);
  }
  /** POST salaries/runs/ — build one month: a slip per active account. */
  static buildSalaryRun(month: string) {
    return apiService.getPostApiResponse<SalaryRunBuildResponse>(`${base}/salaries/runs/`, { month });
  }
  /** POST salaries/slips/<id>/pay/ — finance-salaries.pay. The run closes
   *  itself when its last slip is paid.
   *  `incentivePaise` adds and `adjustmentPaise` corrects either way (negative
   *  recovers an advance, and then `adjustmentReason` is mandatory); both land
   *  on the slip's frozen breakdown rather than inside the gross. `receipt*`
   *  is one presigned upload, kept as a private Attachment. */
  static payPayslip(id: number, data: {
    mode: string; reference?: string; paidFrom?: string;
    incentivePaise?: number; adjustmentPaise?: number; adjustmentReason?: string; remark?: string;
    receiptUrl?: string; receiptName?: string; receiptMime?: string; receiptSizeKb?: number;
  }) {
    return apiService.getPostApiResponse<PayslipPayResponse>(`${base}/salaries/slips/${id}/pay/`, data);
  }
  /** POST salaries/slips/<id>/lop/ — finance-salaries.approve. Days not worked
   *  and not paid, pro-rated against the slip's own frozen `basePaise`. */
  static setPayslipLop(id: number, days: number) {
    return apiService.getPostApiResponse<PayslipPayResponse>(`${base}/salaries/slips/${id}/lop/`, { days });
  }
  /** GET access-requests/ — team.requests; anyone else gets a 403. */
  static accessRequests(params: { state?: string } = {}) {
    return apiService.getGetApiResponse<AccessRequestsResponse>(`${base}/access-requests/${qs(params)}`);
  }
  /** POST access-requests/ — any panel member, for themselves. Refused when the
   *  action is unknown, already held, or already waiting. */
  static createAccessRequest(data: { module: string; action: string; reason?: string }) {
    return apiService.getPostApiResponse<AccessRequestRow>(`${base}/access-requests/`, data);
  }
  /** POST access-requests/<id>/decide/ — team.requests, never your own. Approve
   *  adds the member to `role`, an active role holding module.action. */
  static decideAccessRequest(id: number, data: { state: "approved" | "rejected"; role?: number }) {
    return apiService.getPostApiResponse<AccessRequestRow>(`${base}/access-requests/${id}/decide/`, data);
  }
  static user(id: number) {
    return apiService.getGetApiResponse<AdminUserRow>(`${base}/users/${id}`);
  }
  static createUser(data: AdminUserInput) {
    return apiService.getPostApiResponse<AdminUserRow>(`${base}/users/`, data);
  }
  static updateUser(id: number, data: Partial<AdminUserInput>) {
    return apiService.getPutApiResponse<AdminUserRow>(`${base}/users/${id}`, data);
  }
  /** `reason` is mandatory (the server refuses without one). If the account
   *  still owns deals/quotations/invoices/enquiries/open tasks, the server
   *  refuses again unless `reassignTo` names another active team member —
   *  the refusal's `data.owns` gives the counts, or read `ownedBy(id)` ahead
   *  of the attempt to decide whether to ask for a successor at all. */
  static deleteUser(id: number, data: { reason: string; reassignTo?: number }) {
    return apiService.getDeleteApiResponse<{ id: number; deleted: boolean }>(`${base}/users/${id}`, data);
  }
  /** GET users/<id>/owned/ — team.view. Counts of what this person owns. */
  static ownedBy(id: number) {
    return apiService.getGetApiResponse<OwnedByResponse>(`${base}/users/${id}/owned/`);
  }
  /** POST users/<id>/suspend/ — team.status. Switches the login off and ends
   *  every session; `reason` is mandatory and the same ownership refusal as
   *  `deleteUser` applies (`data.owns` on a 4xx with no `reassignTo`). */
  static suspendUser(id: number, data: { reason: string; reassignTo?: number }) {
    return apiService.getPostApiResponse<{ moved: OwnedCounts }>(`${base}/users/${id}/suspend/`, data);
  }
  /** POST users/<id>/reinstate/ — team.status. Turns the login back on. */
  static reinstateUser(id: number, data: { reason: string }) {
    return apiService.getPostApiResponse<unknown>(`${base}/users/${id}/reinstate/`, data);
  }
  /** POST users/<id>/view-as/ — team.roles, full access only; refused on a
   *  superuser/full-access target. This call is only the audit of STARTING a
   *  view-as session — it does not itself change what later requests see.
   *  The caller still has to turn on `X-View-As` for GETs (admin/viewAs.ts). */
  static viewAsUser(id: number, data: { reason: string }) {
    return apiService.getPostApiResponse<{ id: number; username: string; readOnly: boolean }>(
      `${base}/users/${id}/view-as/`, data);
  }
  /** Issues + emails a fresh password; the current one stops working the
   * moment it succeeds. There is no path that returns the password value —
   * unlike the old local engine, this cannot be "shown once" in a dialog. */
  static sendUserCredentials(id: number) {
    return apiService.getPostApiResponse<unknown>(`${base}/users/${id}/send-credentials/`, {});
  }
  /** GET users/orphans/ — team.status. Who owns records off the roster, and
   *  what has no owner at all. */
  static orphans() {
    return apiService.getGetApiResponse<OrphansResponse>(`${base}/users/orphans/`);
  }

  // ── Audit ──
  /** `search` matches the actor, the action key, the module and the detail —
   *  the detail is where every reference lives (`deal=DL-2501`), so it is how
   *  "what happened to this record" is answered. `destructive`: "1" for the
   *  delete/reject/cancel family only, "0" for everything else. */
  static audit(params: {
    module?: string; role?: string; search?: string; destructive?: string;
    dateFrom?: string; dateTo?: string; pageNo?: number; pageSize?: number;
    /** "platform" narrows the whole read to rows about a platform ACCOUNT —
     *  not the panel's own staff, and not the rows that are about no person at
     *  all (a plan price, a taxonomy row). A scope, not a facet: the facet
     *  counts are taken inside it. */
    subject?: string;
    /** ONE RECORD'S HISTORY, when that record is not a person — an agreement
     *  (`agreement`), its template (`agreement_template`), a work tag
     *  (`work_tag`), a salary account (`salary_account`), a run
     *  (`salary_run`), a slip (`payslip`), a subscription (`subscription`), a
     *  refund (`refund`). BOTH are needed: a type alone reads every
     *  agreement's trail at once. This pair is why a history tab needs no
     *  events table. */
    subjectType?: string; subjectId?: string;
  } = {}) {
    return apiService.getGetApiResponse<AuditResponse>(`${base}/audit/${qs(params)}`);
  }
  /** Same filters as `audit()`, but the server hands back the finished CSV —
   *  IST timestamps, module labels resolved, every matching row rather than
   *  one page — plus `X-Row-Count` for how many rows it holds. Goes around
   *  `apiService`: the response body IS the file, not the {response,data}
   *  envelope every other admin-ops read answers with, so there is no JSON to
   *  unwrap and `call()` does not apply. */
  static async auditExport(params: Parameters<typeof AdminOpsService.audit>[0] = {}) {
    const res = await fetchWithAuthRetry(
      `${config.BASE_URL}/${base}/audit/export/${qs(params)}`,
      { method: "GET" },
    );
    if (!res.ok) throw new AppExceptions("Could not export the log.", res.status, false);
    const csv = await res.text();
    const headerCount = res.headers.get("X-Row-Count");
    return { csv, rowCount: headerCount ? parseInt(headerCount, 10) : null };
  }
  /** ONE ACCOUNT'S slice of the same trail — every entry whose SUBJECT is that
   *  user, same envelope, same filters, same paging.
   *
   *  `ref` is the pk, the public `unique_id` UUID, or the username. Three,
   *  because the panel does not hold one id: a reference that matches no
   *  account is REFUSED (`user_not_found`) rather than answered with an empty
   *  page, so "nobody touched them" and "no such person" stay different facts.
   *
   *  The oldest entry is always the registration line, carrying
   *  `synthetic: true` — derived from the account's creation stamp because no
   *  admin performed it and no stored row exists. It is withheld from a
   *  filtered read. */
  static userAudit(ref: string | number, params: {
    module?: string; role?: string; search?: string; destructive?: string;
    dateFrom?: string; dateTo?: string; pageNo?: number; pageSize?: number;
  } = {}) {
    return apiService.getGetApiResponse<AuditResponse>(
      `${base}/audit/user/${encodeURIComponent(String(ref))}/${qs(params)}`);
  }
  /** The labels, verbs, modules and roles the trail is drawn and filtered
   *  from, so the panel hard-codes none of them. */
  static auditVocabularies() {
    return apiService.getGetApiResponse<AuditVocabularies>(`${base}/audit/vocabularies/`);
  }

  // ── Revenue ──
  static revenue(params: { start?: string; end?: string } = {}) {
    return apiService.getGetApiResponse<RevenueOverview>(`${base}/revenue/${qs(params)}`);
  }
  static addExpense(data: ExpenseInput) {
    return apiService.getPostApiResponse<any>(`${base}/revenue/expense/`, data);
  }
  static setAssumptions(data: Partial<RevenueAssumptions>) {
    return apiService.getPutApiResponse<RevenueAssumptions>(`${base}/revenue/assumptions/`, data);
  }

  // ── Plans & pricing ──
  static plans() {
    return apiService.getGetApiResponse<{ families: Record<string, PlanRow[]>; plans: PlanRow[] }>(`${base}/plans/`);
  }
  static updatePlan(id: number, data: Partial<PlanRow>) {
    return apiService.getPutApiResponse<PlanRow>(`${base}/plans/${id}/`, data);
  }
  static addPlan(data: Partial<PlanRow> & { planFamily: string; cycles?: PlanCycleInput[] }) {
    return apiService.getPostApiResponse<PlanRow>(`${base}/plans/`, data);
  }
  // Billing cycles (child rows of a plan).
  static addCycle(planId: number, data: PlanCycleInput) {
    return apiService.getPostApiResponse<PlanCycle>(`${base}/plans/${planId}/cycles/`, data);
  }
  static updateCycle(planId: number, cycleId: number, data: Partial<PlanCycleInput>) {
    return apiService.getPutApiResponse<PlanCycle>(`${base}/plans/${planId}/cycles/${cycleId}/`, data);
  }
  static deleteCycle(planId: number, cycleId: number) {
    return apiService.getDeleteApiResponse<{ id: number; deleted: boolean }>(`${base}/plans/${planId}/cycles/${cycleId}/`);
  }
  // isActive=false archives (hidden from buyers); true re-activates.
  static setPlanActive(id: number, isActive: boolean) {
    return apiService.getPostApiResponse<PlanRow>(`${base}/plans/${id}/archive/`, { isActive });
  }
  // Archive: out of the catalogue and never buyable again, still listed for admins;
  // existing subscribers keep the plan, and the records naming it stay explainable.
  // `reason` is required by the archive direction only.
  static archivePlan(id: number, reason: string) {
    return apiService.getDeleteApiResponse<PlanRow>(`${base}/plans/${id}/`, { reason });
  }
  // Restore an archived plan (archived:false) needs no reason; archiving (true) does.
  static setPlanArchived(id: number, archived: boolean, reason?: string) {
    return apiService.getPostApiResponse<PlanRow>(`${base}/plans/${id}/archive/`, { archived, reason });
  }

  // ── House banners (real HomeHeroBanner hero slides) ──
  static bannersHouse(page?: string) {
    return apiService.getGetApiResponse<{ banners: BannerRow[] }>(`${base}/banners-house/${qs({ page })}`);
  }
  static createBanner(data: BannerInput) {
    return apiService.getPostApiResponse<BannerRow>(`${base}/banners-house/`, data);
  }
  static updateBanner(id: number, data: BannerInput) {
    return apiService.getPutApiResponse<BannerRow>(`${base}/banners-house/${id}/`, data);
  }
  static toggleBanner(id: number) {
    return apiService.getPostApiResponse<BannerRow>(`${base}/banners-house/${id}/toggle/`, {});
  }
  static deleteBanner(id: number) {
    return apiService.getDeleteApiResponse<any>(`${base}/banners-house/${id}/`);
  }
  static moveBanner(id: number, direction: "up" | "down") {
    return apiService.getPostApiResponse<{ banners: BannerRow[] }>(`${base}/banners-house/${id}/move/`, { direction });
  }

  // ── Banner ads moderation ──
  static bannersAd(params: { status?: string; pageNo?: number; pageSize?: number } = {}) {
    return apiService.getGetApiResponse<any>(`${base}/banners-ad/${qs(params)}`);
  }
  static approveAd(id: number) {
    return apiService.getPostApiResponse<any>(`${base}/banners-ad/${id}/approve/`, {});
  }
  static rejectAd(id: number, reason: string) {
    return apiService.getPostApiResponse<any>(`${base}/banners-ad/${id}/reject/`, { reason });
  }
  // House/fallback ad (AdCampaign with no advertiser, auto-approved to live).
  static createFallbackAd(data: {
    placement: string; page?: string; image?: string; eyebrow?: string;
    heading?: string; sub?: string; features?: string[]; ctaLabel?: string;
    ctaLink?: string; theme?: string;
  }) {
    return apiService.getPostApiResponse<any>(`${base}/banners-ad/fallback/`, data);
  }

  // ── Buyers ──
  static buyers(params: { search?: string; pageNo?: number; pageSize?: number } = {}) {
    return apiService.getGetApiResponse<any>(`${base}/buyers/${qs(params)}`);
  }
  static toggleBuyer(id: number) {
    return apiService.getPostApiResponse<any>(`${base}/buyers/${id}/toggle/`, {});
  }

  // ── Users (the platform's own accounts, not the admin team) ──
  static usersVocabularies() {
    return apiService.getGetApiResponse<UsersVocabularies>(`${base}/users/vocabularies/`);
  }
  /** One page of the directory. `query` is a ready query string ("?status=active&pageNo=2")
   *  so the store owns the one mapping from the panel's URL params to the API's. */
  static platformUsers(query: string) {
    return apiService.getGetApiResponse<PlatformUsersPage>(`${base}/platform-users/${query}`);
  }
  static platformUser(pk: number) {
    return apiService.getGetApiResponse<PlatformUserRecord>(`${base}/platform-users/${pk}/`);
  }
  /** Correct one account's business profile. The body is {schema key: value} and
   *  WHICH keys are accepted is the profile schema itself (users/vocabularies/
   *  `profileFields`): a key that is not a row, a row that is not editable, or a
   *  row with no column behind it refuses the whole patch — there is no partial
   *  write. Answers with the record as it now stands. */
  static updatePlatformUserProfile(pk: number, patch: Record<string, unknown>) {
    return apiService.getPatchApiResponse<PlatformUserRecord>(`${base}/platform-users/${pk}/`, patch);
  }
  /** The WHOLE set of operational tags this account carries. Add and remove are
   *  derived from what it already holds, so one call is both. */
  static setPlatformUserTags(pk: number, slugs: string[]) {
    return apiService.getPutApiResponse<PlatformUserRecord>(`${base}/platform-users/${pk}/tags/`, { slugs });
  }
  /** The ACCOUNT switch. A reason is required to deactivate and is stored on the
   *  account and on the audit line; reactivating needs none. Soft: the profile,
   *  the tags and the trail all stay. */
  static setPlatformUserStatus(pk: number, status: "active" | "deactivated", reason: string) {
    return apiService.getPostApiResponse<PlatformUserRecord>(
      `${base}/platform-users/${pk}/status/`, { status, reason });
  }
  /** One internal note on an account. The author and the moment are the
   *  server's; the list comes back on the record, so this answers with it. */
  static addPlatformUserNote(pk: number, text: string) {
    return apiService.getPostApiResponse<PlatformUserRecord>(
      `${base}/platform-users/${pk}/notes/`, { text });
  }
  /** Add one tag to the catalogue. The slug is derived from the label and is what
   *  every assignment keys on, so it is never edited afterwards. */
  static createUserTag(tag: { label: string; tone?: string; help?: string }) {
    return apiService.getPostApiResponse<UserTagItem>(`${base}/users/tags/`, tag);
  }
  /** Retire a tag, bring it back, or correct what it says. Retiring keeps every
   *  assignment it already has — it only stops being offered. */
  static updateUserTag(slug: string, patch: { isActive?: boolean; label?: string; tone?: string; help?: string }) {
    return apiService.getPatchApiResponse<UserTagItem>(
      `${base}/users/tags/${encodeURIComponent(slug)}/`, patch);
  }
  /** The Users analytics payload, counted from the accounts themselves. */
  static usersAnalytics() {
    return apiService.getGetApiResponse<UsersAnalytics>(`${base}/users/analytics/`);
  }

  // ── Businesses ──
  static businesses(params: { search?: string; pageNo?: number; pageSize?: number } = {}) {
    return apiService.getGetApiResponse<any>(`${base}/businesses/${qs(params)}`);
  }
  static toggleBusinessVerified(id: number) {
    return apiService.getPostApiResponse<any>(`${base}/businesses/${id}/toggle-verified/`, {});
  }
  // Catalog & Trust > Businesses Moderation (distinct shape from the Users list).
  static businessModeration(params: { search?: string; pageNo?: number; pageSize?: number } = {}) {
    return apiService.getGetApiResponse<any>(`${base}/businesses/moderation/${qs(params)}`);
  }

  // ── Payments ──
  /** `status` takes a comma list (PAID,REFUNDED); `start`/`end` filter on verifiedAt's date. */
  static payments(params: { status?: string; refunded?: boolean; paymentMethod?: string; start?: string; end?: string; pageNo?: number; pageSize?: number } = {}) {
    return apiService.getGetApiResponse<any>(`${base}/payments/${qs(params)}`);
  }

  // ── Manual-payment verify/reject (task 11) ──
  static verifyPayment(txnId: number) {
    return apiService.getPostApiResponse<any>(`${base}/payments/${txnId}/verify/`, {});
  }
  static rejectPayment(txnId: number, reason: string) {
    return apiService.getPostApiResponse<any>(`${base}/payments/${txnId}/reject/`, { reason });
  }

  // ── Refunds ──
  static refund(txnId: number, data: { amount?: string; reason: string; reject?: boolean }) {
    return apiService.getPostApiResponse<any>(`${base}/payments/${txnId}/refund/`, data);
  }

  // ── Support ──
  static supportTickets(params: { status?: string; pageNo?: number; pageSize?: number } = {}) {
    return apiService.getGetApiResponse<any>(`${base}/support/${qs(params)}`);
  }
  static supportTicket(id: number) {
    return apiService.getGetApiResponse<any>(`${base}/support/${id}/`);
  }
  static replyTicket(id: number, body: string) {
    return apiService.getPostApiResponse<any>(`${base}/support/${id}/reply/`, { body });
  }
  static closeTicket(id: number) {
    return apiService.getPostApiResponse<any>(`${base}/support/${id}/close/`, {});
  }

  // ── Templates ──
  static templates() {
    return apiService.getGetApiResponse<any>(`${base}/templates/`);
  }
  static createTemplate(data: any) {
    return apiService.getPostApiResponse<any>(`${base}/templates/`, data);
  }
  static updateTemplate(id: number, data: any) {
    return apiService.getPutApiResponse<any>(`${base}/templates/${id}/`, data);
  }
  static deleteTemplate(id: number) {
    return apiService.getDeleteApiResponse<any>(`${base}/templates/${id}/`);
  }

  // ── Brand assets ──
  static brandLogo() {
    return apiService.getGetApiResponse<any>(`${base}/brand-logo/`);
  }
  static setBrandLogo(data: { logoUrl?: string; faviconUrl?: string; tagline?: string }) {
    return apiService.getPutApiResponse<any>(`${base}/brand-logo/`, data);
  }
  // Scheduled seasonal logos (task 27)
  static listLogos() { return apiService.getGetApiResponse<any>(`${base}/brand-logo/logos/`); }
  static createLogo(data: any) { return apiService.getPostApiResponse<any>(`${base}/brand-logo/logos/`, data); }
  static updateLogo(id: number, data: any) { return apiService.getPutApiResponse<any>(`${base}/brand-logo/logos/${id}/`, data); }
  static deleteLogo(id: number) { return apiService.getDeleteApiResponse<any>(`${base}/brand-logo/logos/${id}/`); }

  // ── Slots ──
  static slots() {
    return apiService.getGetApiResponse<any>(`${base}/slots/`);
  }
  static overrideSlot(id: number, data: { capacity?: number; holderId?: number; priority?: number }) {
    return apiService.getPutApiResponse<any>(`${base}/slots/${id}/`, data);
  }

  // ── Weights ──
  static weights() {
    return apiService.getGetApiResponse<any>(`${base}/weights/`);
  }
  static setWeights(weights: Record<string, number>, merge = true) {
    return apiService.getPutApiResponse<any>(`${base}/weights/`, { weights, merge });
  }

  // ── Testimonials ──
  static testimonials() {
    return apiService.getGetApiResponse<any>(`${base}/testimonials/`);
  }
  static createTestimonial(data: any) {
    return apiService.getPostApiResponse<any>(`${base}/testimonials/`, data);
  }
  static updateTestimonial(id: number, data: any) {
    return apiService.getPutApiResponse<any>(`${base}/testimonials/${id}/`, data);
  }
  static deleteTestimonial(id: number) {
    return apiService.getDeleteApiResponse<any>(`${base}/testimonials/${id}/`);
  }
  static reorderTestimonial(id: number, index: number) {
    return apiService.getPostApiResponse<any>(`${base}/testimonials/${id}/reorder/`, { index });
  }

  // ── Reports ──
  static reports(params: { status?: string; pageNo?: number; pageSize?: number } = {}) {
    return apiService.getGetApiResponse<any>(`${base}/reports/${qs(params)}`);
  }
  static resolveReport(id: number, status: string) {
    return apiService.getPutApiResponse<any>(`${base}/reports/${id}/`, { status });
  }

  // ── Subscriptions ──
  /** The PURCHASES, each carrying whatever commitment stands over it. */
  static subs(params: { family?: string; status?: string; pageNo?: number; pageSize?: number } = {}) { return apiService.getGetApiResponse<SubsListResponse>(`${base}/subs/${qs(params)}`); }
  /** The COMMITMENTS, each joined to its purchase and that purchase's payment. */
  static subscriptions(params: { state?: string; pageNo?: number; pageSize?: number } = {}) {
    return apiService.getGetApiResponse<SubscriptionsListResponse>(`${base}/subscriptions/${qs(params)}`);
  }
  /** POST subscriptions/ — record one by hand against a purchase that already
   *  exists, or over an accepted `quotation` (with `paidCount`, checked against
   *  the ledger). The customer is NOT sent: it is the purchase's or the deal's. */
  static recordSubscription(data: {
    family?: string; purchase?: number; quotation?: number; paidCount?: number; state?: string;
    cycleMonths?: number; startedOn?: string; renewsOn?: string; soldBy?: number; note?: string;
  }) {
    return apiService.getPostApiResponse<SubscriptionRow>(`${base}/subscriptions/`, data);
  }
  /** POST subscriptions/<id>/state/ — `defaulting` is what a fail to pay
   *  records. Cancelling is its own verb because it needs a reason. */
  static setSubscriptionState(id: number, data: { state: string; reason?: string; note?: string }) {
    return apiService.getPostApiResponse<SubscriptionRow>(`${base}/subscriptions/${id}/state/`, data);
  }
  static cancelSubscription(id: number, reason: string) {
    return apiService.getPostApiResponse<SubscriptionRow>(`${base}/subscriptions/${id}/cancel/`, { reason });
  }
  /** GET subscriptions/chains/ — what a sale is recorded from (finance.view). */
  static subscriptionChains() {
    return apiService.getGetApiResponse<{ chains: SubChainRow[] }>(`${base}/subscriptions/chains/`);
  }
  /** POST subscriptions/<id>/installments/<seq>/pay/ — settle one with the issued invoice that billed it. */
  static paySubscriptionInstallment(id: number, seq: number, invoice: string) {
    return apiService.getPostApiResponse<SubscriptionRow>(`${base}/subscriptions/${id}/installments/${seq}/pay/`, { invoice });
  }
  /** POST subscriptions/<id>/installments/<seq>/fail/ — the deal's own fail rule. */
  static failSubscriptionInstallment(id: number, seq: number, data: { reason: string; note: string }) {
    return apiService.getPostApiResponse<SubscriptionRow>(`${base}/subscriptions/${id}/installments/${seq}/fail/`, data);
  }
  /** POST subscriptions/<id>/reverse/ — a recorded payment was wrong (finance.reverse). No money moves. */
  static reverseSubscriptionPayment(id: number, data: { seq?: number; reason: string }) {
    return apiService.getPostApiResponse<SubscriptionRow>(`${base}/subscriptions/${id}/reverse/`, data);
  }

  // ── Routing / Quarantine (LeadQuery) ──
  static routing(params: { status?: string; tier?: string; pageNo?: number } = {}) { return apiService.getGetApiResponse<any>(`${base}/routing/${qs(params)}`); }
  static routingAction(id: number, status: string) { return apiService.getPostApiResponse<any>(`${base}/routing/${id}/action/`, { status }); }
  // Admin add/edit lead (LeadQuery via the v2 admin lead endpoints — NOT the GMB system).
  static createLead(data: Record<string, any>) { return apiService.getPostApiResponse<any>(`${base}/v2/query/`, data); }
  static updateLead(id: number, data: Record<string, any>) { return apiService.getPutApiResponse<any>(`${base}/v2/query/${id}/`, data); }
  static quarantine(params: { status?: string; pageNo?: number } = {}) { return apiService.getGetApiResponse<any>(`${base}/quarantine/${qs(params)}`); }
  static quarantineAction(id: number, status: string) { return apiService.getPostApiResponse<any>(`${base}/quarantine/${id}/action/`, { status }); }

  // ── Web analytics ──
  static webAnalytics(params: { start?: string; end?: string } = {}) { return apiService.getGetApiResponse<any>(`${base}/web-analytics/${qs(params)}`); }

  // ── Reviews ──
  static reviews(params: { pageNo?: number } = {}) { return apiService.getGetApiResponse<any>(`${base}/reviews/${qs(params)}`); }
  static hideReview(id: number) { return apiService.getPostApiResponse<any>(`${base}/reviews/${id}/hide/`, {}); }
  static reviewsQA(params: { pageNo?: number } = {}) { return apiService.getGetApiResponse<any>(`${base}/reviews/qa/${qs(params)}`); }
  static hideQuestion(id: number) { return apiService.getPostApiResponse<any>(`${base}/reviews/qa/${id}/hide/`, {}); }

  // ── Taxonomy (cat-region) ──
  static taxonomy() { return apiService.getGetApiResponse<any>(`${base}/taxonomy/`); }
  static addCategory(value: string, label: string, trending = false) { return apiService.getPostApiResponse<any>(`${base}/taxonomy/`, { value, label, trending }); }
  static updateCategory(id: number, data: { label?: string; value?: string; trending?: boolean; index?: number; isActive?: boolean }) { return apiService.getPutApiResponse<any>(`${base}/taxonomy/category/${id}/`, data); }
  static deleteCategory(id: number) { return apiService.getDeleteApiResponse<any>(`${base}/taxonomy/category/${id}/`); }
  static addSegment(data: { value: string; label: string; trending?: boolean; categoryIds?: number[] }) { return apiService.getPostApiResponse<any>(`${base}/taxonomy/segment/`, data); }
  static updateSegment(id: number, data: { value?: string; label?: string; trending?: boolean; isActive?: boolean; categoryIds?: number[] }) { return apiService.getPutApiResponse<any>(`${base}/taxonomy/segment/${id}/`, data); }
  static deleteSegment(id: number) { return apiService.getDeleteApiResponse<any>(`${base}/taxonomy/segment/${id}/`); }
  static addState(data: { name: string; value?: string; countryId?: number }) { return apiService.getPostApiResponse<any>(`${base}/taxonomy/state/`, data); }
  static updateState(id: number, data: { name?: string; value?: string; countryId?: number }) { return apiService.getPutApiResponse<any>(`${base}/taxonomy/state/${id}/`, data); }
  static deleteState(id: number) { return apiService.getDeleteApiResponse<any>(`${base}/taxonomy/state/${id}/`); }

  // ── Feedback ──
  static feedback(params: { status?: string; pageNo?: number } = {}) { return apiService.getGetApiResponse<any>(`${base}/feedback/${qs(params)}`); }
  static setFeedbackStatus(id: number, status: string) { return apiService.getPostApiResponse<any>(`${base}/feedback/${id}/status/`, { status }); }

  // ── Plan requests ──
  static planRequests(params: { stage?: string; pageNo?: number } = {}) { return apiService.getGetApiResponse<any>(`${base}/plan-requests/${qs(params)}`); }
  static setPlanRequestStage(id: number, stage: string) { return apiService.getPostApiResponse<any>(`${base}/plan-requests/${id}/stage/`, { stage }); }
  static verifyPlanRequest(id: number, data: { subscriptionId: number; entityType: string }) { return apiService.getPostApiResponse<any>(`${base}/plan-requests/${id}/verify/`, data); }

  // ── Deals (interior_admin DealsViews — read AND write) ──
  static deals(params: {
    stage?: string; priority?: string; owner?: string | number; tag?: string;
    search?: string; stalled?: string; pageNo?: number; pageSize?: number; sort?: string;
  } = {}) {
    return apiService.getGetApiResponse<DealsListResponse>(`${base}/deals/${qs(params)}`);
  }
  static deal(ref: string) {
    return apiService.getGetApiResponse<DealDetailResponse>(`${base}/deals/${encodeURIComponent(ref)}/`);
  }
  /** Refused with `duplicateRef` when the number already has an open deal;
   *  resend with `allowDuplicate` once a human has seen that. */
  static createDeal(data: DealCreateInput) {
    return apiService.getPostApiResponse<DealRow>(`${base}/deals/`, data);
  }
  /** PATCH SEMANTICS: a key you omit is untouched, a key sent as null is
   *  CLEARED. Send only what changed. */
  static updateDeal(ref: string, data: DealPatchInput) {
    return apiService.getPutApiResponse<DealRow>(`${base}/deals/${encodeURIComponent(ref)}/`, data);
  }
  /** `reason` is required server-side, not just in the dialog. Moving to a
   *  terminal stage additionally needs deals.close (level 3). */
  static dealStage(ref: string, stageKey: string, reason: string) {
    return apiService.getPostApiResponse<{ deal: DealRow; moved: boolean }>(
      `${base}/deals/${encodeURIComponent(ref)}/stage/`, { stageKey, reason });
  }
  /** `typeKey` tags the channel the agent actually used (manual / whatsapp /
   *  email) — anything outside that set falls back to manual server-side.
   *  See DealsController.CLIENT_REMARK_TYPES. */
  static dealRemark(ref: string, text: string, nextActionDate?: string | null, typeKey?: string) {
    return apiService.getPostApiResponse<{ deal: DealRow; remark: DealRemark }>(
      `${base}/deals/${encodeURIComponent(ref)}/remark/`,
      { text, nextActionDate: nextActionDate || null, typeKey: typeKey || undefined });
  }
  static dealOwner(ref: string, data: { ownerId?: number; coOwnerId?: number | null; reason: string }) {
    return apiService.getPostApiResponse<DealRow>(`${base}/deals/${encodeURIComponent(ref)}/owner/`, data);
  }
  /** The people inside THIS session's deal scope, plus that scope as a word.
   *  Gated on `deals.view`, unlike the Team roster — which is why the Reassign
   *  dialog's two dropdowns used to come up empty for a sales role. Also feeds
   *  the Owner filter, so it lists people whose deals are all on another page. */
  static dealAssignees() {
    return apiService.getGetApiResponse<{ people: DealPersonRef[]; scope: "own" | "team" | "all" }>(
      `${base}/deals/assignees/`);
  }
  /** Hand a batch of deals to one owner — the handover when somebody leaves.
   *  Partial success is normal: `skipped` names every ref that did not move
   *  and why. Needs deals.close, same as the single-deal Reassign. */
  static dealBulkOwner(data: { refs: string[]; ownerId: number; reason: string }) {
    return apiService.getPostApiResponse<{
      moved: string[]; skipped: { ref: string; why: string }[]; owner: DealPersonRef;
    }>(`${base}/deals/reassign/`, data);
  }
  static dealTag(ref: string, slug: string, apply: boolean) {
    return apiService.getPostApiResponse<DealRow>(
      `${base}/deals/${encodeURIComponent(ref)}/tags/`, { slug, apply });
  }
  // The tag catalogue. Declared before `deals/<ref>/` server-side, so "tags" is
  // never read as a deal reference.
  static dealTags() {
    return apiService.getGetApiResponse<{ tags: DealTagRow[] }>(`${base}/deals/tags/`);
  }
  static createDealTag(data: { label: string; tone?: string }) {
    return apiService.getPostApiResponse<DealTagRow>(`${base}/deals/tags/`, data);
  }
  static updateDealTag(slug: string, data: { label?: string; tone?: string; isActive?: boolean }) {
    return apiService.getPutApiResponse<DealTagRow>(`${base}/deals/tags/${slug}/`, data);
  }
  /** Deletes an unused tag; ARCHIVES one deals still carry — `archived` says which. */
  static deleteDealTag(slug: string) {
    return apiService.getDeleteApiResponse<{ slug: string; deleted: boolean; archived: boolean; count: number }>(
      `${base}/deals/tags/${slug}/`);
  }
  static dealStallSweep() {
    return apiService.getPostApiResponse<{ flagged: number; cleared: number; scanned: number }>(
      `${base}/deals/stall-sweep/`, {});
  }

  // ── Quotations (interior_admin QuotationsViews) ──
  static quotations(params: {
    deal?: string; status?: string; owner?: number; pageNo?: number; pageSize?: number; sort?: string;
  } = {}) {
    return apiService.getGetApiResponse<QuotationsListResponse>(`${base}/quotations/${qs(params)}`);
  }
  static quotation(id: number) {
    return apiService.getGetApiResponse<QuotationRow>(`${base}/quotations/${id}/`);
  }
  /** `fromId` clones an existing quotation on the same deal as a new draft
   *  revision; omitted, this opens a fresh draft. Refused if the deal is
   *  closed, or (with no `fromId`) if the deal already has a live
   *  issued/accepted quotation — revise that one instead. */
  static createQuotation(dealRef: string, fromId?: number) {
    return apiService.getPostApiResponse<QuotationRow>(
      `${base}/quotations/from-deal/${encodeURIComponent(dealRef)}/`, { fromId });
  }
  /** Draft-only + optimistic concurrency: refused if `rowVersion` does not
   *  match what the server has (someone else saved first). */
  static saveQuotation(id: number, data: QuotationSaveInput) {
    return apiService.getPutApiResponse<QuotationRow>(`${base}/quotations/${id}/`, data);
  }
  static addQuotationAddon(id: number, data: QuotationAddonInput) {
    return apiService.getPostApiResponse<QuotationRow>(`${base}/quotations/${id}/addons/`, data);
  }
  static updateQuotationAddon(id: number, itemId: number, data: QuotationAddonInput) {
    return apiService.getPutApiResponse<QuotationRow>(`${base}/quotations/${id}/addons/${itemId}/`, data);
  }
  static removeQuotationAddon(id: number, itemId: number, rowVersion: number) {
    return apiService.getDeleteApiResponse<QuotationRow>(
      `${base}/quotations/${id}/addons/${itemId}/`, { rowVersion });
  }
  /** Locks the number, freezes the customer/billing snapshot, generates the
   *  document row. No PUT reaches an issued quotation — revise() is the only
   *  way to change one after this. */
  static issueQuotation(id: number) {
    return apiService.getPostApiResponse<QuotationRow>(`${base}/quotations/${id}/issue/`, {});
  }
  /** Reachable from issued, rejected or expired — nothing here dead-ends; a
   *  customer who calls back after saying no can still accept. Writes
   *  `Deal.valuePaise` to this quotation's grand total. */
  static acceptQuotation(id: number) {
    return apiService.getPostApiResponse<QuotationRow>(`${base}/quotations/${id}/accept/`, {});
  }
  static rejectQuotation(id: number, reason?: string) {
    return apiService.getPostApiResponse<QuotationRow>(`${base}/quotations/${id}/reject/`, { reason });
  }
  /** Draft-only — consumes no number. An issued quotation cannot be
   *  cancelled this way; revise it or let it expire. */
  static cancelQuotation(id: number) {
    return apiService.getPostApiResponse<QuotationRow>(`${base}/quotations/${id}/cancel/`, {});
  }
  /** On a draft this is a no-op (returns it unchanged — it already IS the
   *  editable copy). On anything else it clones into a fresh draft, same as
   *  `createQuotation(dealRef, { fromId: id })`. */
  static reviseQuotation(id: number) {
    return apiService.getPostApiResponse<QuotationRow>(`${base}/quotations/${id}/revise/`, {});
  }
  /** The document sheet as HTML, for the panel's own preview screen. The server
   *  renders it from the SAME template the customer's share link serves, so the
   *  two copies cannot disagree; no share token is minted by looking. */
  static quotationDocHtml(id: number) {
    return apiService.getGetApiResponse<{ html: string }>(`${base}/quotations/${id}/document/html/`);
  }
  static quotationDocDownload(id: number) {
    return apiService.getGetApiResponse<QuotationDocument>(`${base}/quotations/${id}/document/download/`);
  }
  static quotationDocShare(id: number) {
    return apiService.getPostApiResponse<{ storageKey: string; link: string; expires: string }>(
      `${base}/quotations/${id}/document/share/`, {});
  }

  // ── Invoices (interior_admin InvoicesViews) ──
  // Raised only after payment has already been received — this is a
  // log-what-came-in flow, never an online checkout. Issuing an invoice
  // writes the deal-payment ledger row itself, in the same transaction.
  static invoices(params: {
    deal?: string; quotation?: number; status?: string; owner?: number;
    pageNo?: number; pageSize?: number; sort?: string;
  } = {}) {
    return apiService.getGetApiResponse<InvoicesListResponse>(`${base}/invoices/${qs(params)}`);
  }
  static invoice(id: number) {
    return apiService.getGetApiResponse<InvoiceRow>(`${base}/invoices/${id}/`);
  }
  /** `quotationId` is mandatory and never inferred — it must be an ACCEPTED
   *  quotation on this deal. Suggests the next unbilled installment amount
   *  when the quotation split payment; trims to the deal's remaining
   *  outstanding cap if the suggestion would overshoot it. */
  static createInvoice(dealRef: string, quotationId: number) {
    return apiService.getPostApiResponse<InvoiceRow>(
      `${base}/invoices/from-deal/${encodeURIComponent(dealRef)}/`, { quotationId });
  }
  static saveInvoice(id: number, data: InvoiceSaveInput) {
    return apiService.getPutApiResponse<InvoiceRow>(`${base}/invoices/${id}/`, data);
  }
  static addInvoiceAddon(id: number, data: InvoiceAddonInput) {
    return apiService.getPostApiResponse<InvoiceRow>(`${base}/invoices/${id}/addons/`, data);
  }
  static updateInvoiceAddon(id: number, itemId: number, data: InvoiceAddonInput) {
    return apiService.getPutApiResponse<InvoiceRow>(`${base}/invoices/${id}/addons/${itemId}/`, data);
  }
  static removeInvoiceAddon(id: number, itemId: number, rowVersion: number) {
    return apiService.getDeleteApiResponse<InvoiceRow>(`${base}/invoices/${id}/addons/${itemId}/`, { rowVersion });
  }
  /** Refused unless: a line exists with an amount, the billing block is
   *  complete, a due date is set, the total reconciles and fits the deal's
   *  outstanding cap, at least one (non-removed) payment proof is attached,
   *  and a payment reference is set. On success also writes the deal-payment
   *  ledger row. */
  static issueInvoice(id: number) {
    return apiService.getPostApiResponse<InvoiceRow>(`${base}/invoices/${id}/issue/`, {});
  }
  /** Draft: no reason needed, no number consumed. Issued: this action's own
   *  minLevel (3) already restricts it to a Sales-Head-equivalent role, and
   *  `reason` is mandatory; refused if a live (unreversed) payment still
   *  points at this invoice — reverse the payment first. */
  static cancelInvoice(id: number, reason?: string) {
    return apiService.getPostApiResponse<InvoiceRow>(`${base}/invoices/${id}/cancel/`, { reason });
  }
  /** Adds a NEW document version; never touches the invoice row, its number
   *  or its totals. Sales-Head-only (reuses the `issue` action's level). */
  static regenerateInvoiceDoc(id: number) {
    return apiService.getPostApiResponse<InvoiceDocumentVersion>(`${base}/invoices/${id}/document/regenerate/`, {});
  }
  static invoiceDocHtml(id: number) {
    return apiService.getGetApiResponse<{ html: string }>(`${base}/invoices/${id}/document/html/`);
  }
  static invoiceDocDownload(id: number) {
    return apiService.getGetApiResponse<InvoiceDocumentVersion>(`${base}/invoices/${id}/document/download/`);
  }
  static invoiceDocShare(id: number) {
    return apiService.getPostApiResponse<{ storageKey: string; link: string; expires: string }>(
      `${base}/invoices/${id}/document/share/`, {});
  }
  /** The receipt for a file the BROWSER already put in S3 with a presigned PUT
   *  (CommonService.getUploadUrl, intent PaymentScreenshot). The bytes never
   *  cross this API — a phone photo of a bank slip is exactly the payload that
   *  dies in a proxied multipart POST. Draft-only. */
  static attachInvoiceProof(id: number, upload: InvoiceProofUpload) {
    return apiService.getPostApiResponse<InvoiceProofRow>(
      `${base}/invoices/${id}/proofs/`, upload);
  }
  static invoiceProof(id: number, proofId: number) {
    return apiService.getGetApiResponse<InvoiceProofRow>(`${base}/invoices/${id}/proofs/${proofId}/`);
  }
  /** Sales-Head-only (reuses the `cancel` action's level), reason mandatory.
   *  Soft — flags `removed`, never deletes the file. */
  static removeInvoiceProof(id: number, proofId: number, reason: string) {
    return apiService.getDeleteApiResponse<{ id: number; removed: boolean }>(
      `${base}/invoices/${id}/proofs/${proofId}/`, { reason });
  }

  // ── Deal payment ledger (interior_admin DealPaymentsViews) ──
  // NOT the legacy subscription-payment console below (`payments()` /
  // `verifyPayment()` / `refund()`) — a different model (DealPayment vs
  // TransectionData), a different module (`payments` here maps to
  // `payments/deal-ledger/`, deliberately routed off the legacy `payments/`
  // prefix so the two can never collide).
  /** `start`/`end` filter on paymentDate. */
  static dealPayments(params: { deal?: string; invoice?: number; start?: string; end?: string; pageNo?: number; pageSize?: number } = {}) {
    return apiService.getGetApiResponse<DealPaymentsListResponse>(`${base}/payments/deal-ledger/${qs(params)}`);
  }

  // ── Installments / other income / tasks / attendance / value lists (overview d3) ──
  static installments(params: { start?: string; end?: string; status?: string; deal?: string; pageNo?: number; pageSize?: number } = {}) {
    return apiService.getGetApiResponse<InstallmentsListResponse>(`${base}/installments/${qs(params)}`);
  }
  static income(params: { start?: string; end?: string; kind?: string; state?: string; pageNo?: number; pageSize?: number } = {}) {
    return apiService.getGetApiResponse<IncomeListResponse>(`${base}/income/${qs(params)}`);
  }
  /** Money out, read for a window (overview/d5). Recording one is
   *  `addExpense` — the revenue module has always owned that. */
  static spend(params: { start?: string; end?: string; tag?: string; state?: string; pageNo?: number; pageSize?: number } = {}) {
    return apiService.getGetApiResponse<SpendListResponse>(`${base}/spend/${qs(params)}`);
  }
  static cancelSpend(id: number, reason: string) {
    return apiService.getPostApiResponse<SpendRow>(`${base}/spend/${id}/cancel/`, { reason });
  }
  /** The expense-tag table. The list is `vocab("expense-tags")`; these two
   *  write it — a tag is created, re-budgeted, and switched off or back on,
   *  never deleted and never re-kinded. */
  static createExpenseTag(data: { label: string; kind: string; budgetPaise?: number; proofRequired?: boolean }) {
    return apiService.getPostApiResponse<ExpenseTagRow>(`${base}/spend/tags/`, data);
  }
  static updateExpenseTag(key: string, data: { budgetPaise?: number; isActive?: boolean }) {
    return apiService.getPatchApiResponse<ExpenseTagRow>(`${base}/spend/tags/${key}/`, data);
  }
  /** Payroll runs. `start`/`end` are MONTHS (YYYY-MM) on the date a run was
   *  paid — a June run paid in August is August's money out. */
  static salaries(params: { start?: string; end?: string; state?: string } = {}) {
    return apiService.getGetApiResponse<SalariesResponse>(`${base}/salaries/${qs(params)}`);
  }
  /** Refund requests. `owed` is approved-and-unsent, `toDecide` is waiting. */
  static refunds(params: { start?: string; end?: string; state?: string; payment?: number; pageNo?: number; pageSize?: number } = {}) {
    return apiService.getGetApiResponse<RefundsListResponse>(`${base}/refunds/${qs(params)}`);
  }
  static decideRefund(id: number, data: { state: "approved" | "declined"; note?: string }) {
    return apiService.getPostApiResponse<RefundRow>(`${base}/refunds/${id}/decide/`, data);
  }
  /** `account` is which of our own accounts the money left. Optional on the
   *  server because CompanyAccount ships empty and is filled per environment —
   *  a key that names nothing is still refused. */
  static settleRefund(id: number, data: { mode: string; reference: string; account?: string }) {
    return apiService.getPostApiResponse<RefundRow>(`${base}/refunds/${id}/settle/`, data);
  }
  /** Statements and how much of the bank the records explain. */
  static bankStatements(params: { account?: string; closed?: boolean } = {}) {
    return apiService.getGetApiResponse<BankStatementsResponse>(`${base}/bank/statements/${qs(params)}`);
  }

  /** `assignee` omitted = the caller's own tasks; an id or `all` needs work.all.
   *  `start`/`end` are the DUE date; `completedFrom`/`completedTo` the date it
   *  was finished — "what did they close this month" is the second question.
   *  `role` is an rbac role name (the panel's "department"). */
  static work(params: {
    assignee?: string; status?: string; start?: string; end?: string;
    completedFrom?: string; completedTo?: string; role?: string; pageNo?: number; pageSize?: number } = {}) {
    return apiService.getGetApiResponse<WorkListResponse>(`${base}/work/${qs(params)}`);
  }
  static createWork(data: WorkCreateInput) {
    return apiService.getPostApiResponse<WorkItemRow>(`${base}/work/`, data);
  }
  /** ONE SOFT EDGE OUT of this task, stored on this end only. `relation` is a
   *  key from `vocab("work-link-relations")`. Refused: an unknown relation, a
   *  task that is not there, itself, and a pair already linked. No rowVersion —
   *  the call names the exact edge, so there is no update to lose. */
  static addWorkLink(id: number, data: { itemId: number; relation: string }) {
    return apiService.getPostApiResponse<WorkItemRow>(`${base}/work/${id}/links/`, data);
  }
  static removeWorkLink(id: number, toId: number) {
    return apiService.getDeleteApiResponse<WorkItemRow>(`${base}/work/${id}/links/${toId}/`);
  }
  /** THE WHOLE LIST, IN ORDER. Add, rename, tick, remove and reorder are all
   *  this one write; a line keeps the id it is sent with. */
  static setWorkChecklist(id: number, data: { rowVersion: number; lines: { id?: string; text: string; done?: boolean }[] }) {
    return apiService.getPutApiResponse<WorkItemRow>(`${base}/work/${id}/checklist/`, data);
  }
  /** `owner` omitted = the caller's own tags; an id or `all` needs work.all. */
  static workTags(params: { owner?: string; includeArchived?: boolean } = {}) {
    return apiService.getGetApiResponse<{ tags: WorkTagRow[] }>(`${base}/work/tags/${qs(params)}`);
  }
  /** An active tag with the same name for the same owner comes back as it is. */
  static createWorkTag(data: { label: string; tone: string; owner?: number }) {
    return apiService.getPostApiResponse<WorkTagRow>(`${base}/work/tags/`, data);
  }
  /** One value list, whole (interior_admin VocabViews LISTS). */
  static vocab(name: string) {
    return apiService.getGetApiResponse<{ items: VocabItem[] }>(`${base}/vocab/${name}/`);
  }
  /** The letterhead (VocabViews.CompanyView): these five fields and nothing else; gstin "" while unregistered. */
  static company() {
    return apiService.getGetApiResponse<{ brand: string; name: string; address: string; cin: string; gstin: string }>(
      `${base}/company/`);
  }
  /** The Finance panel's words (VocabViews.FinanceVocabulariesView): formulas, cautions, decisions, log labels. */
  static financeVocabularies() {
    type Def = { key: string; label: string; unit: string; formula: string; caution: string };
    return apiService.getGetApiResponse<{
      slipRule: string; eventTypes: { key: string; label: string; tone: string }[];
      metricDefinitions: Def[]; kpiDefinitions: (Def & { group: string; goodDirection: string })[];
      payrollMetricDefinitions: Def[]; openDecisions: { id: string; title: string; position: string; status: string }[];
    }>(`${base}/finance/vocabularies/`);
  }
  /** Own settings row, or everyone's for full access. */
  static attendanceSettings() {
    return apiService.getGetApiResponse<{ settings: WorkSettingsRow[] }>(`${base}/attendance/settings/`);
  }
  /** `member` omitted = own; an id or `all` is full access only. `state` = LeaveState keys, comma-separated. */
  static leave(params: { member?: string; state?: string; start?: string; end?: string; role?: string; pageNo?: number; pageSize?: number } = {}) {
    return apiService.getGetApiResponse<LeaveListResponse>(`${base}/leave/${qs(params)}`);
  }
  /** `member` omitted = own; an id or `all` needs reports.acknowledge. */
  static dailyPlans(params: { member?: string; start?: string; end?: string; pageNo?: number; pageSize?: number } = {}) {
    return apiService.getGetApiResponse<Paged<"plans", DailyPlanRow>>(`${base}/daily-plans/${qs(params)}`);
  }
  static dailyReports(params: { member?: string; start?: string; end?: string; acknowledged?: boolean; pageNo?: number; pageSize?: number } = {}) {
    return apiService.getGetApiResponse<Paged<"reports", DailyReportRow>>(`${base}/daily-reports/${qs(params)}`);
  }
  /** overview.view. `start`/`end` bound "Completed"; `role` = rbac role name. */
  static overviewOperations(params: { start: string; end: string; role?: string }) {
    return apiService.getGetApiResponse<OverviewOperations>(`${base}/overview/operations/${qs(params)}`);
  }
  /** overview.view; each piece gated on its own (see OverviewSignals). `role` narrows `away`. */
  static overviewSignals(params: { role?: string } = {}) {
    return apiService.getGetApiResponse<OverviewSignals>(`${base}/overview/signals/${qs(params)}`);
  }
  /** `member` omitted = own; an id or `all` is full access only. `expiresFrom`/`To` are dates. */
  static agreements(params: { member?: string; state?: string; expiresFrom?: string; expiresTo?: string; pageNo?: number; pageSize?: number } = {}) {
    return apiService.getGetApiResponse<Paged<"agreements", AgreementRow>>(`${base}/agreements/${qs(params)}`);
  }
  /** Full access. One live copy per member per TEMPLATE (per kind + title when
   *  the body was typed by hand and carries no template key). */
  static sendAgreement(data: AgreementSendInput) {
    return apiService.getPostApiResponse<AgreementRow>(`${base}/agreements/`, data);
  }
  /** The wording, reused. Reading is agreements.view; every write is full access. */
  static agreementTemplates() {
    return apiService.getGetApiResponse<{ templates: AgreementTemplateRow[] }>(`${base}/agreements/templates/`);
  }
  static createAgreementTemplate(data: AgreementTemplateInput) {
    return apiService.getPostApiResponse<AgreementTemplateRow>(`${base}/agreements/templates/`, data);
  }
  /** Only what is SENT is written — putting one in use is `{ state: "active" }`.
   *  Editing the clauses of a template something was sent from bumps its version;
   *  the copies already out keep the wording they went out with. */
  static updateAgreementTemplate(key: string, data: Partial<AgreementTemplateInput> & { state?: string }) {
    return apiService.getPatchApiResponse<AgreementTemplateRow>(
      `${base}/agreements/templates/${encodeURIComponent(key)}/`, data);
  }
  /** Only a template nothing was ever sent from; anything else retires. */
  static deleteAgreementTemplate(key: string) {
    return apiService.getDeleteApiResponse<{ key: string; deleted: boolean }>(
      `${base}/agreements/templates/${encodeURIComponent(key)}/`);
  }
  /** The member opening their own copy; the first open is recorded. */
  static viewAgreement(id: number) {
    return apiService.getPostApiResponse<AgreementRow>(`${base}/agreements/${id}/view/`, {});
  }
  /** The member themself; the server records the time and the address. */
  static signAgreement(id: number, signedName: string) {
    return apiService.getPostApiResponse<AgreementRow>(`${base}/agreements/${id}/sign/`, { signedName });
  }
  /** Full access; a signed copy cannot be revoked. */
  static revokeAgreement(id: number) {
    return apiService.getPostApiResponse<AgreementRow>(`${base}/agreements/${id}/revoke/`, {});
  }
  /** `member` omitted = own; an id or `all` is full access only. */
  static memberDocuments(params: { member?: string } = {}) {
    return apiService.getGetApiResponse<{ documents: MemberDocumentRow[] }>(`${base}/member-documents/${qs(params)}`);
  }
  /** Your own, or another member's with full access. The file is already in our
   *  bucket via a presigned PUT (CommonService.getUploadUrl, intent
   *  MemberDocument); the server keeps its key as a PRIVATE Attachment and hands
   *  back a signed read. Omit `fileUrl` and the row is recorded with no file. */
  static recordMemberDocument(data: {
    member?: number; kind: string; label: string;
    fileUrl?: string; fileName?: string; mimeType?: string; sizeKb?: number }) {
    return apiService.getPostApiResponse<MemberDocumentRow>(`${base}/member-documents/`, data);
  }
  /** Full access, never your own. */
  static verifyMemberDocument(id: number) {
    return apiService.getPostApiResponse<MemberDocumentRow>(`${base}/member-documents/${id}/verify/`, {});
  }
  static removeMemberDocument(id: number, reason: string) {
    return apiService.getDeleteApiResponse<{ id: number; deleted: boolean }>(`${base}/member-documents/${id}/`, { reason });
  }
  /** `member` omitted = the caller's own days; an id or `all` is full access only.
   *  `includeMissing` also returns the days nobody opened (absent / not started
   *  / on leave) and then needs `start` and `end`. `role` = rbac role name. */
  static attendanceDays(params: {
    member?: string; start?: string; end?: string; role?: string;
    includeMissing?: string; pageNo?: number; pageSize?: number } = {}) {
    return apiService.getGetApiResponse<AttendanceDaysResponse>(`${base}/attendance/days/${qs(params)}`);
  }
  static recordDealPayment(data: DealPaymentRecordInput) {
    return apiService.getPostApiResponse<DealPaymentRow>(`${base}/payments/deal-ledger/`, data);
  }
  /** Sales-Head-only. Appends a negative ledger row referencing the
   *  original (never edits it), cascades the linked invoice to cancelled,
   *  and — if the deal sits in a terminal stage and this reversal drops
   *  collected revenue below its quoted value — reopens it to the first
   *  active stage. */
  static reverseDealPayment(id: number, reason: string) {
    return apiService.getPostApiResponse<{ reversalId: number; payment: DealPaymentRow }>(
      `${base}/payments/deal-ledger/${id}/reverse/`, { reason });
  }

  // ── Team writes (work, tags, attendance, leave, daily plans/reports, incentives) ──
  static updateWork(id: number, data: WorkUpdateInput) {
    return apiService.getPatchApiResponse<WorkItemRow>(`${base}/work/${id}/`, data);
  }
  /** Checked against the WorkTransition rows; a stale `rowVersion` is refused. */
  static setWorkStatus(id: number, data: { rowVersion: number; to: string; reason?: string }) {
    return apiService.getPostApiResponse<WorkItemRow>(`${base}/work/${id}/status/`, data);
  }
  static archiveWorkTag(id: number) {
    return apiService.getPostApiResponse<WorkTagRow>(`${base}/work/tags/${id}/archive/`, {});
  }
  /** Rename and/or recolour an ACTIVE tag; the slug follows the label. */
  static updateWorkTag(id: number, data: { label?: string; tone?: string }) {
    return apiService.getPatchApiResponse<WorkTagRow>(`${base}/work/tags/${id}/`, data);
  }
  /** Refused while an active tag of the same owner holds the slug. */
  static restoreWorkTag(id: number) {
    return apiService.getPostApiResponse<WorkTagRow>(`${base}/work/tags/${id}/restore/`, {});
  }
  /** The caller's own day only. */
  /** `auto` marks an open the PANEL did (the shell, on first load of a business
   *  date) rather than one a person pressed. The server only believes an
   *  automatic open inside the member's working window; a deliberate one is
   *  never refused for the hour it arrives at. */
  /** Sign in for the day at the time you really started: `startedAt` is "HH:MM", not in the future, `note` required. */
  static openAttendanceDayAt(data: { startedAt: string; note: string }) {
    return apiService.getPostApiResponse<AttendanceDayRow>(`${base}/attendance/day/open/`, data);
  }
  static attendanceDayAction(action: "open" | "break" | "resume" | "end", auto?: boolean) {
    return apiService.getPostApiResponse<AttendanceDayRow>(`${base}/attendance/day/${action}/`, auto ? { auto: true } : {});
  }
  /** Full access only. Times are HH:MM in the member's local time. */
  static correctAttendanceDay(data: { member: number; date: string; startedAt: string; endedAt?: string; breakMinutes?: number; note: string }) {
    return apiService.getPostApiResponse<AttendanceDayRow>(`${base}/attendance/days/correct/`, data);
  }
  static putAttendanceSettings(userId: number, data: {
    dayStartsAt: string; graceMinutes: number; expectedHoursPerDay: number; joiningDate?: string | null;
    autoCloseAt: string; timezone?: string; reportsTo?: number | null; designation?: string | null; employmentType?: string | null;
  }) {
    return apiService.getPutApiResponse<WorkSettingsRow>(`${base}/attendance/settings/${userId}/`, data);
  }
  /** The caller's own request. */
  static requestLeave(data: { kind: string; fromDate: string; toDate: string; reason?: string; member?: number }) {
    return apiService.getPostApiResponse<LeaveRow>(`${base}/leave/`, data);
  }
  static withdrawLeave(id: number) {
    return apiService.getPostApiResponse<LeaveRow>(`${base}/leave/${id}/withdraw/`, {});
  }
  static escalateLeave(id: number, data: { note: string }) {
    return apiService.getPostApiResponse<LeaveRow>(`${base}/leave/${id}/escalate/`, data);
  }
  static decideLeave(id: number, data: { state: "approved" | "rejected"; note?: string }) {
    return apiService.getPostApiResponse<LeaveRow>(`${base}/leave/${id}/decide/`, data);
  }
  /** The caller's own plan, one per date; `workItem` must be one of their own tasks. */
  static submitDailyPlan(data: {
    businessDate?: string; expectedOutcome?: string; blockers?: string; notes?: string;
    lines: { title: string; priority?: string; workItem?: number | null }[];
  }) {
    return apiService.getPostApiResponse<DailyPlanRow>(`${base}/daily-plans/`, data);
  }
  /** One more line on the caller's own plan, for their own today. */
  static addDailyPlanLine(id: number, data: { title: string; priority?: string; workItem?: number | null }) {
    return apiService.getPostApiResponse<DailyPlanRow>(`${base}/daily-plans/${id}/lines/`, data);
  }
  static submitDailyReport(data: {
    businessDate?: string; pendingWork?: string; pendingReason?: string; achievement?: string; blockers?: string;
    supportNeeded?: string; tomorrowPriority?: string; notes?: string;
    lines: { title: string; done?: boolean; targetDelta?: number | null; workItem?: number | null }[];
  }) {
    return apiService.getPostApiResponse<DailyReportRow>(`${base}/daily-reports/`, data);
  }
  static acknowledgeDailyReport(id: number) {
    return apiService.getPostApiResponse<DailyReportRow>(`${base}/daily-reports/${id}/acknowledge/`, {});
  }
  static proposeIncentive(data: { member: number; month: string; amountPaise: number; workItem?: number | null; basis?: string }) {
    return apiService.getPostApiResponse<IncentiveRow>(`${base}/incentives/`, data);
  }
  static approveIncentive(id: number) {
    return apiService.getPostApiResponse<IncentiveRow>(`${base}/incentives/${id}/approve/`, {});
  }
  static payIncentive(id: number) {
    return apiService.getPostApiResponse<IncentiveRow>(`${base}/incentives/${id}/pay/`, {});
  }

  // ── Resources writes ──
  static createResource(data: ResourceDraftInput) {
    return apiService.getPostApiResponse<ResourceRow>(`${base}/resources/`, data);
  }
  static updateResource(id: number, data: ResourceDraftInput) {
    return apiService.getPutApiResponse<ResourceRow>(`${base}/resources/${id}/`, data);
  }
  /** Refused while the resource holds responses. */
  static deleteResource(id: number) {
    return apiService.getDeleteApiResponse<{ id: number; deleted: boolean }>(`${base}/resources/${id}/`);
  }
  static setResourceState(id: number, to: "open" | "closed" | "outdated") {
    return apiService.getPostApiResponse<ResourceRow>(`${base}/resources/${id}/state/`, { to });
  }
  static duplicateResource(id: number) {
    return apiService.getPostApiResponse<ResourceRow>(`${base}/resources/${id}/duplicate/`, {});
  }
  /** The caller's own answer. Files must already be in S3 (get-upload-url, intent PaymentScreenshot);
   *  `url` is the upload's fileUrl — stored as its key, read back as a signed URL. */
  static submitResourceResponse(id: number, data: {
    values: Record<string, string>; files?: Record<string, { fileName: string; mimeType: string; sizeKb: number; url: string }>;
  }) {
    return apiService.getPostApiResponse<ResourceResponseRow>(`${base}/resources/${id}/responses/`, data);
  }
  static deleteResourceResponse(id: number) {
    return apiService.getDeleteApiResponse<{ id: number; freedKb: number }>(`${base}/resources/responses/${id}/`);
  }

  // ── Finance writes (income, refunds, bank, installments, payslips) ──
  static recordIncome(data: IncomeRecordInput) {
    return apiService.getPostApiResponse<IncomeRow>(`${base}/income/`, data);
  }
  static incomeRow(id: number) {
    return apiService.getGetApiResponse<IncomeRow>(`${base}/income/${id}/`);
  }
  static cancelIncome(id: number, reason: string) {
    return apiService.getPostApiResponse<IncomeRow>(`${base}/income/${id}/cancel/`, { reason });
  }
  /** EXACTLY ONE of `payment` (a plan purchase), `dealPayment` (the deal
   *  ledger) or `payeeName` (nothing behind it) — naming none or two is
   *  refused. `amountPaise` omitted = the whole payment, and it is mandatory
   *  on a by-hand refund because there is nothing to derive it from. */
  static requestRefund(data: {
    payment?: number; dealPayment?: number; payeeName?: string;
    ground: string; amountPaise?: number; detail?: string;
  }) {
    return apiService.getPostApiResponse<RefundRow>(`${base}/refunds/`, data);
  }
  static bankStatement(id: number) {
    return apiService.getGetApiResponse<BankStatementDetail>(`${base}/bank/statements/${id}/`);
  }
  static importBankStatement(data: {
    account: string; fromDate: string; toDate: string;
    lines: { date: string; direction: "credit" | "debit"; amountPaise: number; reference?: string; narration?: string; counterparty?: string }[];
  }) {
    return apiService.getPostApiResponse<BankStatementDetail>(`${base}/bank/statements/`, data);
  }
  static closeBankStatement(id: number) {
    return apiService.getPostApiResponse<BankStatementRow>(`${base}/bank/statements/${id}/close/`, {});
  }
  static resolveBankLine(id: number, data: { kind: string; reason: string }) {
    return apiService.getPostApiResponse<BankLineRow>(`${base}/bank/lines/${id}/resolve/`, data);
  }
  /** Stored rows only — a computed installment (`id: null`) cannot be failed. */
  static failInstallment(id: number, data: { reason: string; note: string }) {
    return apiService.getPostApiResponse<InstallmentRow>(`${base}/installments/${id}/fail/`, data);
  }
  /** `reason` is the only record a hold has — the slip carries no column for
   *  it, so it goes on the audit trail with the action. */
  static holdPayslip(id: number, reason = "") {
    return apiService.getPostApiResponse<unknown>(`${base}/salaries/slips/${id}/hold/`, { reason });
  }
  static releasePayslip(id: number) {
    return apiService.getPostApiResponse<unknown>(`${base}/salaries/slips/${id}/release/`, {});
  }

  /** GET v1/engine/seller-options/ — the option lists a seller profile is filled
   *  from, each item `{value, label, meta}`. Public; auth is sent anyway. */
  static sellerOptions() {
    return apiService.getGetApiResponse<Record<string, { value: string; label: string; meta?: unknown }[]>>(
      "v1/engine/seller-options/");
  }

  // ── Content (blog) ──
  static content(params: { pageNo?: number } = {}) { return apiService.getGetApiResponse<any>(`${base}/content/${qs(params)}`); }
  static toggleBlogFeatured(id: number) { return apiService.getPostApiResponse<any>(`${base}/content/${id}/feature/`, {}); }
  static createBlog(data: any) { return apiService.getPostApiResponse<any>(`${base}/content/`, data); }
  static updateBlog(id: number, data: any) { return apiService.getPutApiResponse<any>(`${base}/content/${id}/`, data); }
  static deleteBlog(id: number) { return apiService.getDeleteApiResponse<any>(`${base}/content/${id}/`); }
}

export default AdminOpsService;
