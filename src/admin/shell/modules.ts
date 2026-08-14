/* =============================================================================
   Interior bazzar — Admin · the module inventory
   -----------------------------------------------------------------------------
   THE single module list now comes from the server — `me/permissions/`'s
   `modules[]`, ordered by `displayOrder` and grouped by `groupLabel`. Nav,
   routing, breadcrumbs and the permission matrix all read the SAME resolved
   session (admin/auth/session.ts), so a Module row added on the server changes
   the nav with no code edit here — and nav and permissions can never disagree,
   because they are the same array.

   `icon` and `route` stay client-side concerns — the server has no opinion on
   which SVG a module gets. `route` defaults to the module key itself, and
   `icon` falls back through the `Icon` component's own "unknown name → doc"
   behaviour, so a module key with no entry in ICON_OF still renders instead
   of guessing.
   ============================================================================= */
import { getSession } from "../auth/session";

export type ModuleItem = {
  key: string;
  label: string;
  icon: string;
  route: string;
  /** badge key in IBData.derive.badges(); absent = no queue count on this item */
  q?: string;
};

export type ModuleGroup = {
  group: string;
  items: ModuleItem[];
};

/** Icon names verified against ICONS in admin/ui/index.tsx. A key with no
 * entry here falls through to Icon's own "doc" default rather than guessing. */
const ICON_OF: Record<string, string> = {
  deals: "deal",
  quotations: "quote",
  invoices: "invoice",
  plans: "tag",
  team: "team",
  roles: "shield",
  audit: "history",
  design: "sparkle",
};
/** Sidebar queue-count keys, from IBData.derive.badges(). A module with no
 * entry here shows no badge, which is correct for anything the prototype
 * never counted (Plans, Roles, Audit, Design). */
const Q_OF: Record<string, string> = {
  deals: "deals",
  quotations: "quotations",
  invoices: "invoices",
  team: "team",
};

export function getModules(): ModuleGroup[] {
  const s = getSession();
  const mods = s ? s.modules.slice().sort((a, b) => a.displayOrder - b.displayOrder) : [];
  const groups: ModuleGroup[] = [];
  const byGroup: Record<string, ModuleGroup> = {};
  mods.forEach((m) => {
    const g = m.groupLabel || "";
    if (!byGroup[g]) {
      byGroup[g] = { group: g, items: [] };
      groups.push(byGroup[g]);
    }
    byGroup[g].items.push({
      key: m.key,
      label: m.label,
      icon: ICON_OF[m.key] || "doc",
      route: m.key,
      q: Q_OF[m.key],
    });
  });
  return groups;
}

export function getItems(): Record<string, ModuleItem> {
  const out: Record<string, ModuleItem> = {};
  getModules().forEach((g) => g.items.forEach((it) => { out[it.route] = it; }));
  return out;
}

export function getGroupOf(): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  getModules().forEach((g) => g.items.forEach((it) => { out[it.route] = g.group || null; }));
  return out;
}

export const moduleKeys = () => Object.keys(getItems());
export const moduleLabel = (k: string) => {
  const it = getItems()[k];
  return it ? it.label : k;
};

/** The default landing route. The prototype boots to #/deals. Kept static:
 * it is where "/" redirects to, not a permission — a member without `deals`
 * access still lands there and ViewHost shows the Denied state, same as any
 * other route it cannot see. */
export const HOME_ROUTE = "deals";
