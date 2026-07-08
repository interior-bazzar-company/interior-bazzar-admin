// ── AdminOpsService ──
// API client for the v3 admin ops console (promptsadmin). One method per shipped
// /api/v1/admin/ endpoint (backend interior_admin). The per-module React ports
// (promptsadmin tasks 13-40) call these; the RBAC store hydrates from
// mePermissions(). Keep in sync with interior_admin/urls.py.
import appUrl from "../../endpoints";
import apiService from "../../apiService";

const base = appUrl.admin; // "v1/admin"

export interface AdminModules {
  [key: string]: number; // moduleKey -> level 0..3
}
export interface MePermissions {
  role: string | null;
  modules: AdminModules;
}
export interface AuditEntry {
  id: number; actor: string | null; role: string | null;
  action: string; module: string; detail: string | null; ts: string | null;
}
export interface PlanFeature {
  text: string;
}
export interface PlanRow {
  id: number; planFamily: string; entityType: string; title: string;
  subtitle: string; tier: number; amount: string; payableAmount: string;
  discountPercentage: string; duration: string; tag: string;
  features: PlanFeature[]; isActive: boolean;
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
export interface RevenueOverview {
  grossRevenue: number; refunded: number; netRevenue: number; mrr: number;
  cac: number; payingCustomers: number; expensesTotal: number; net: number;
  expenses: Array<{ id: number; label: string; amount: number; category: string; incurredAt: string | null }>;
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
  static mePermissions() {
    return apiService.getGetApiResponse<MePermissions>(`${base}/me/permissions/`);
  }
  static listRoles() {
    return apiService.getGetApiResponse<any>(`${base}/roles/`);
  }
  static updateRole(roleName: string, modules: AdminModules) {
    return apiService.getPutApiResponse<any>(`${base}/roles/`, { roleName, modules });
  }

  // ── Audit ──
  static audit(params: { module?: string; role?: string; pageNo?: number; pageSize?: number } = {}) {
    return apiService.getGetApiResponse<{ entries: AuditEntry[]; total: number; pageNo: number; pageSize: number }>(
      `${base}/audit/${qs(params)}`
    );
  }

  // ── Revenue ──
  static revenue() {
    return apiService.getGetApiResponse<RevenueOverview>(`${base}/revenue/`);
  }
  static addExpense(data: { label: string; amount: number; category?: string; incurredAt?: string }) {
    return apiService.getPostApiResponse<any>(`${base}/revenue/expense/`, data);
  }

  // ── Plans & pricing ──
  static plans() {
    return apiService.getGetApiResponse<{ families: Record<string, PlanRow[]>; plans: PlanRow[] }>(`${base}/plans/`);
  }
  static updatePlan(id: number, data: Partial<PlanRow>) {
    return apiService.getPutApiResponse<PlanRow>(`${base}/plans/${id}/`, data);
  }
  static addPlan(data: Partial<PlanRow> & { planFamily: string }) {
    return apiService.getPostApiResponse<PlanRow>(`${base}/plans/`, data);
  }
  // isActive=false archives (hidden from buyers); true re-activates.
  static setPlanActive(id: number, isActive: boolean) {
    return apiService.getPostApiResponse<PlanRow>(`${base}/plans/${id}/archive/`, { isActive });
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

  // ── Payments ──
  static payments(params: { status?: string; refunded?: boolean; pageNo?: number; pageSize?: number } = {}) {
    return apiService.getGetApiResponse<any>(`${base}/payments/${qs(params)}`);
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
  static setBrandLogo(data: { logoUrl?: string; faviconUrl?: string }) {
    return apiService.getPutApiResponse<any>(`${base}/brand-logo/`, data);
  }

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

  // ── Reports ──
  static reports(params: { status?: string; pageNo?: number; pageSize?: number } = {}) {
    return apiService.getGetApiResponse<any>(`${base}/reports/${qs(params)}`);
  }
  static resolveReport(id: number, status: string) {
    return apiService.getPutApiResponse<any>(`${base}/reports/${id}/`, { status });
  }

  // ── Subscriptions ──
  static subs(params: { status?: string } = {}) { return apiService.getGetApiResponse<any>(`${base}/subs/${qs(params)}`); }

  // ── Routing / Quarantine (LeadQuery) ──
  static routing(params: { status?: string; pageNo?: number } = {}) { return apiService.getGetApiResponse<any>(`${base}/routing/${qs(params)}`); }
  static routingAction(id: number, status: string) { return apiService.getPostApiResponse<any>(`${base}/routing/${id}/action/`, { status }); }
  static quarantine(params: { status?: string; pageNo?: number } = {}) { return apiService.getGetApiResponse<any>(`${base}/quarantine/${qs(params)}`); }
  static quarantineAction(id: number, status: string) { return apiService.getPostApiResponse<any>(`${base}/quarantine/${id}/action/`, { status }); }

  // ── Web analytics ──
  static webAnalytics() { return apiService.getGetApiResponse<any>(`${base}/web-analytics/`); }

  // ── Reviews ──
  static reviews(params: { pageNo?: number } = {}) { return apiService.getGetApiResponse<any>(`${base}/reviews/${qs(params)}`); }
  static hideReview(id: number) { return apiService.getPostApiResponse<any>(`${base}/reviews/${id}/hide/`, {}); }

  // ── Taxonomy (cat-region) ──
  static taxonomy() { return apiService.getGetApiResponse<any>(`${base}/taxonomy/`); }
  static addCategory(value: string, label: string) { return apiService.getPostApiResponse<any>(`${base}/taxonomy/`, { value, label }); }

  // ── Feedback ──
  static feedback(params: { status?: string; pageNo?: number } = {}) { return apiService.getGetApiResponse<any>(`${base}/feedback/${qs(params)}`); }
  static setFeedbackStatus(id: number, status: string) { return apiService.getPostApiResponse<any>(`${base}/feedback/${id}/status/`, { status }); }

  // ── Plan requests ──
  static planRequests(params: { stage?: string; pageNo?: number } = {}) { return apiService.getGetApiResponse<any>(`${base}/plan-requests/${qs(params)}`); }
  static setPlanRequestStage(id: number, stage: string) { return apiService.getPostApiResponse<any>(`${base}/plan-requests/${id}/stage/`, { stage }); }

  // ── Content (blog) ──
  static content(params: { pageNo?: number } = {}) { return apiService.getGetApiResponse<any>(`${base}/content/${qs(params)}`); }
  static toggleBlogFeatured(id: number) { return apiService.getPostApiResponse<any>(`${base}/content/${id}/feature/`, {}); }
}

export default AdminOpsService;
