// ── Admin Ops Console — RBAC (level resolver) ──
// Port of the prototype PERMS/DEF/levelFor (dashboard-admin.html 1636-1668) and
// workflows/admin-rbac-plan.md. Levels: 0 none · 1 read · 2 write · 3 sensitive.
// R3: the ACTING ROLE must be backend-resolved (promptsadmin task 55:
// GET /api/v1/admin/me/permissions/). This module only resolves level FROM a role;
// it never trusts a client-set role for authorization — the backend authorizes too.

export type OpsRole =
  | "super_admin" | "ops_manager" | "finance" | "sales_agent"
  | "content" | "catalog_mod" | "analyst";

export const OPS_ROLE_LABEL: Record<OpsRole, string> = {
  super_admin: "Super Admin", ops_manager: "Ops Manager", finance: "Finance",
  sales_agent: "Sales Agent", content: "Content", catalog_mod: "Catalog Mod",
  analyst: "Analyst",
};

const A = 3, W = 2, R = 1, _ = 0;

type LevelMap = Record<string, number>;
const PERMS: Record<Exclude<OpsRole, "super_admin">, LevelMap> = {
  ops_manager: { overview: R, plans: R, "banners-house": R, "banners-ad": W, buyers: R, businesses: W, subs: R, slots: W, payments: W, refunds: _, routing: W, quarantine: W, weights: R, web: R, revenue: R, "cat-biz": W, reviews: W, "cat-region": W, content: _, support: W, templates: R, roles: _, audit: R },
  finance: { overview: R, plans: R, "banners-house": _, "banners-ad": R, buyers: R, businesses: R, subs: R, slots: R, payments: R, refunds: A, routing: _, quarantine: _, weights: _, web: R, revenue: A, "cat-biz": _, reviews: _, "cat-region": _, content: _, support: _, templates: _, roles: _, audit: R },
  sales_agent: { overview: R, plans: _, "banners-house": _, "banners-ad": _, buyers: R, businesses: R, subs: _, slots: R, payments: _, refunds: _, routing: W, quarantine: R, weights: _, web: R, revenue: _, "cat-biz": _, reviews: _, "cat-region": _, content: _, support: W, templates: _, roles: _, audit: _ },
  content: { overview: R, plans: _, "banners-house": W, "banners-ad": W, buyers: _, businesses: _, subs: _, slots: _, payments: _, refunds: _, routing: _, quarantine: _, weights: _, web: R, revenue: _, "cat-biz": _, reviews: _, "cat-region": _, content: W, support: _, templates: W, roles: _, audit: _ },
  catalog_mod: { overview: R, plans: _, "banners-house": _, "banners-ad": _, buyers: _, businesses: W, subs: _, slots: _, payments: _, refunds: _, routing: _, quarantine: _, weights: _, web: _, revenue: _, "cat-biz": W, reviews: W, "cat-region": W, content: _, support: _, templates: _, roles: _, audit: _ },
  analyst: { overview: R, plans: R, "banners-house": R, "banners-ad": R, buyers: R, businesses: R, subs: R, slots: R, payments: R, refunds: _, routing: R, quarantine: R, weights: R, web: R, revenue: R, "cat-biz": R, reviews: R, "cat-region": R, content: R, support: R, templates: R, roles: _, audit: R },
};

// Defaults for modules not in a role's PERMS map (reports/feedback/plan-requests).
// testimonials & brand-logo intentionally absent → super_admin only.
const DEF: Record<string, Partial<Record<OpsRole, number>>> = {
  reports: { ops_manager: W, catalog_mod: W, sales_agent: R, analyst: R },
  feedback: { ops_manager: W, content: R, analyst: R },
  "plan-requests": { ops_manager: W, finance: W, analyst: R },
};

export function levelFor(role: OpsRole, key: string): number {
  if (role === "super_admin") return 3;
  const m = PERMS[role] ?? {};
  if (key in m) return m[key];
  return DEF[key]?.[role] ?? 0;
}
export const canSee = (role: OpsRole, key: string) => levelFor(role, key) >= 1;
export const canWrite = (role: OpsRole, key: string) => levelFor(role, key) >= 2;
export const isSensitive = (role: OpsRole, key: string) => levelFor(role, key) >= 3;
