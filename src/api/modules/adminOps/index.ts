// ── AdminOpsService ──
// API client for the v3 admin ops console (promptsadmin). One method per shipped
// /api/v1/admin/ endpoint (backend interior_admin). The per-module React ports
// (promptsadmin tasks 13-40) call these; the RBAC store hydrates from
// mePermissions(). Keep in sync with interior_admin/urls.py.
import appUrl from "../../endpoints";
import apiService, { AppExceptions } from "../../apiService";
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
 * both the sidebar nav and the permission matrix. `level`: 0 none, 1 read,
 * 2 write, 3 sensitive. */
export interface AdminModuleInfo {
  key: string;
  label: string;
  groupLabel: string;
  displayOrder: number;
  level: number;
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
  /** "moduleKey.action" -> minimum level required. Missing = treat as 3. */
  actions: Record<string, number>;
  /** True when the user passes the admin gate, false when a soft-deleted,
   * demoted or role-stripped account does not — distinct from `role: null`
   * (a genuine new hire awaiting a role). Optional: older/racing backends
   * that predate this field omit it, and that must read as "not blocked",
   * never as a lockout. */
  gateOk?: boolean;
}

/** roles/ editor grid — a role's grant is moduleKey -> level (0..3). */
export type RoleModules = Record<string, number>;
export interface RolesModuleDef {
  key: string;
  label: string;
  groupLabel: string;
  displayOrder: number;
}
export interface AdminRole {
  id: number;
  name: string;
  isFullAccess: boolean;
  isSystem: boolean;
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
  id: number; actor: string | null; role: string | null;
  action: string; module: string; detail: string | null; ts: string | null;
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
  /** Stored as [{text}]; writes accept plain strings too. */
  features: (PlanFeature | string)[]; billingCycles: PlanCycle[]; isActive: boolean;
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
  nextActionDate: string | null;
  nextActionNote: string;
  expectedClose: string | null;
  enquiryRef: string;
  stalled: boolean;
  lostReason: string;
  tags: DealTagVocab[];
  createdAt: string;
  updatedAt: string;
}
export interface DealsListResponse {
  deals: DealRow[];
  total: number;
  pageNo: number;
  pageSize: number;
  counts: { total: number; byStage: Record<string, number> };
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
}
export interface DealPaymentsListResponse { payments: DealPaymentRow[]; total: number; pageNo: number; pageSize: number; }
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
  static createRole(name: string, modules: RoleModules) {
    return apiService.getPostApiResponse<AdminRole>(`${base}/roles/`, { name, modules });
  }
  static updateRole(id: number, data: { name?: string; modules: RoleModules }) {
    return apiService.getPutApiResponse<AdminRole>(`${base}/roles/`, { id, ...data });
  }
  // Contract-specified (§3); not yet wired server-side as of this write — see report.
  static deleteRole(id: number) {
    return apiService.getDeleteApiResponse<{ id: number; deleted: boolean }>(`${base}/roles/`, { id });
  }

  // ── Team members (interior_admin/urls.py → AdminUserViews) ──
  static users() {
    return apiService.getGetApiResponse<AdminUserRow[]>(`${base}/users/`);
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
  static deleteUser(id: number) {
    return apiService.getDeleteApiResponse<{ id: number; deleted: boolean }>(`${base}/users/${id}`);
  }
  /** Issues + emails a fresh password; the current one stops working the
   * moment it succeeds. There is no path that returns the password value —
   * unlike the old local engine, this cannot be "shown once" in a dialog. */
  static sendUserCredentials(id: number) {
    return apiService.getPostApiResponse<unknown>(`${base}/users/${id}/send-credentials/`, {});
  }

  // ── Audit ──
  /** `search` matches the actor, the action key, the module and the detail —
   *  the detail is where every reference lives (`deal=DL-2501`), so it is how
   *  "what happened to this record" is answered. `destructive`: "1" for the
   *  delete/reject/cancel family only, "0" for everything else. */
  static audit(params: {
    module?: string; role?: string; search?: string; destructive?: string;
    dateFrom?: string; dateTo?: string; pageNo?: number; pageSize?: number;
  } = {}) {
    return apiService.getGetApiResponse<AuditResponse>(`${base}/audit/${qs(params)}`);
  }

  // ── Revenue ──
  static revenue(params: { start?: string; end?: string } = {}) {
    return apiService.getGetApiResponse<RevenueOverview>(`${base}/revenue/${qs(params)}`);
  }
  static addExpense(data: { label: string; amount: number; category?: string; kind?: string; incurredAt?: string }) {
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
  // Soft delete: hidden from admin + public; existing subscribers keep the plan.
  static deletePlan(id: number) {
    return apiService.getDeleteApiResponse<{ id: number; deleted: boolean }>(`${base}/plans/${id}/`);
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
  static payments(params: { status?: string; refunded?: boolean; paymentMethod?: string; pageNo?: number; pageSize?: number } = {}) {
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
  static subs(params: { family?: string; status?: string; pageNo?: number; pageSize?: number } = {}) { return apiService.getGetApiResponse<any>(`${base}/subs/${qs(params)}`); }

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
  /** multipart/form-data — the one place this feature handles a real
   *  uploaded file (a bank-transfer screenshot); every other document row in
   *  Quotations/Invoices is metadata-only. Draft-only. */
  static attachInvoiceProof(id: number, file: File) {
    const body = new FormData();
    body.append("file", file);
    return apiService.getPostApiResponse<InvoiceProofRow>(
      `${base}/invoices/${id}/proofs/`, body, { responseType: "formdata" });
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
  static dealPayments(params: { deal?: string; invoice?: number; pageNo?: number; pageSize?: number } = {}) {
    return apiService.getGetApiResponse<DealPaymentsListResponse>(`${base}/payments/deal-ledger/${qs(params)}`);
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

  // ── Content (blog) ──
  static content(params: { pageNo?: number } = {}) { return apiService.getGetApiResponse<any>(`${base}/content/${qs(params)}`); }
  static toggleBlogFeatured(id: number) { return apiService.getPostApiResponse<any>(`${base}/content/${id}/feature/`, {}); }
  static createBlog(data: any) { return apiService.getPostApiResponse<any>(`${base}/content/`, data); }
  static updateBlog(id: number, data: any) { return apiService.getPutApiResponse<any>(`${base}/content/${id}/`, data); }
  static deleteBlog(id: number) { return apiService.getDeleteApiResponse<any>(`${base}/content/${id}/`); }
}

export default AdminOpsService;
