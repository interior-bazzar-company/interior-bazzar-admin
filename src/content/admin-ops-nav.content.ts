// ── Admin Ops Console — sidebar nav data ──
// React port of `const MODULES` in prototype/dashboard-admin.html (line 1590),
// EXCLUDING the Frontend / pages-catalog group (fe-*) which is the read-only
// prototype self-catalog — out of scope (promptsadmin task 1 / task 41).
// Tabler icon names (no "ti-" prefix). Overview is a solo (ungrouped) item.

export interface AdminNavItem {
  key: string;
  label: string;
  icon: string;
}
export interface AdminNavGroup {
  grp: string;
  solo?: boolean;
  items: AdminNavItem[];
}

export const ADMIN_OPS_NAV: AdminNavGroup[] = [
  { grp: "Overview", solo: true, items: [
    { key: "overview", label: "Overview", icon: "layout-dashboard" } ] },
  { grp: "Growth", items: [
    { key: "plans", label: "Plans & Pricing", icon: "tag" },
    { key: "banners-house", label: "House Banners", icon: "speakerphone" },
    { key: "banners-ad", label: "Banner Ads", icon: "ad" },
    { key: "templates", label: "Notification Templates", icon: "mail-cog" } ] },
  { grp: "Users", items: [
    { key: "buyers", label: "Buyers", icon: "users" },
    { key: "businesses", label: "Businesses", icon: "building-store" } ] },
  { grp: "Commerce", items: [
    { key: "subs", label: "Subscriptions", icon: "rosette" },
    { key: "slots", label: "Slot Inventory", icon: "grid-dots" },
    { key: "payments", label: "Payments", icon: "cash" },
    { key: "refunds", label: "Refunds", icon: "receipt-refund" } ] },
  { grp: "Enquiry Ops", items: [
    { key: "routing", label: "Routing Queue", icon: "route" },
    { key: "quarantine", label: "Quarantine", icon: "shield-x" },
    { key: "weights", label: "Qualification Weights", icon: "adjustments" } ] },
  { grp: "Analytics", items: [
    { key: "web", label: "Website", icon: "chart-dots" },
    { key: "revenue", label: "Revenue & Unit Economics", icon: "coin" } ] },
  { grp: "Catalog & Trust", items: [
    { key: "cat-biz", label: "Businesses Moderation", icon: "discount-check" },
    { key: "reviews", label: "Reviews & Q&A", icon: "message-star" },
    { key: "testimonials", label: "Testimonials", icon: "quote" },
    { key: "reports", label: "Reported Listings", icon: "flag" },
    { key: "cat-region", label: "Categories & Regions", icon: "map-pin" } ] },
  { grp: "Voice & Plans", items: [
    { key: "feedback", label: "User Feedback", icon: "message-2-heart" },
    { key: "plan-requests", label: "Plan Requests", icon: "arrows-exchange" } ] },
  { grp: "Content", items: [
    { key: "content", label: "Blog / SEO", icon: "article" } ] },
  { grp: "Support", items: [
    { key: "support", label: "Support Desk", icon: "lifebuoy" } ] },
  { grp: "Settings", items: [
    { key: "brand-logo", label: "Brand Logo", icon: "photo" },
    { key: "roles", label: "Roles & Permissions", icon: "users-group" },
    { key: "audit", label: "Audit Log", icon: "history" } ] },
];

// Flat key → label lookup (active-section title, route validation).
export const ADMIN_OPS_MODULES: Record<string, string> = Object.fromEntries(
  ADMIN_OPS_NAV.flatMap((g) => g.items.map((i) => [i.key, i.label])),
);
