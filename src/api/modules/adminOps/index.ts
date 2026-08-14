// ── AdminOpsService ──
// API client for the v3 admin ops console (promptsadmin). One method per shipped
// /api/v1/admin/ endpoint (backend interior_admin). The per-module React ports
// (promptsadmin tasks 13-40) call these; the RBAC store hydrates from
// mePermissions(). Keep in sync with interior_admin/urls.py.
import appUrl from "../../endpoints";
import apiService from "../../apiService";

const base = appUrl.admin; // "v1/admin"

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
  badge?: string; badgeIcon?: string;
  features: PlanFeature[]; billingCycles: PlanCycle[]; isActive: boolean;
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
  static audit(params: { module?: string; role?: string; pageNo?: number; pageSize?: number } = {}) {
    return apiService.getGetApiResponse<{ entries: AuditEntry[]; total: number; pageNo: number; pageSize: number }>(
      `${base}/audit/${qs(params)}`
    );
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

  // ── Deals (read path only — writes still go through the local engine) ──
  static deals(params: {
    stage?: string; priority?: string; owner?: string | number; tag?: string;
    search?: string; stalled?: string; pageNo?: number; pageSize?: number; sort?: string;
  } = {}) {
    return apiService.getGetApiResponse<DealsListResponse>(`${base}/deals/${qs(params)}`);
  }
  static deal(ref: string) {
    return apiService.getGetApiResponse<DealDetailResponse>(`${base}/deals/${encodeURIComponent(ref)}/`);
  }

  // ── Content (blog) ──
  static content(params: { pageNo?: number } = {}) { return apiService.getGetApiResponse<any>(`${base}/content/${qs(params)}`); }
  static toggleBlogFeatured(id: number) { return apiService.getPostApiResponse<any>(`${base}/content/${id}/feature/`, {}); }
  static createBlog(data: any) { return apiService.getPostApiResponse<any>(`${base}/content/`, data); }
  static updateBlog(id: number, data: any) { return apiService.getPutApiResponse<any>(`${base}/content/${id}/`, data); }
  static deleteBlog(id: number) { return apiService.getDeleteApiResponse<any>(`${base}/content/${id}/`); }
}

export default AdminOpsService;
