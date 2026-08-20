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
import { getSession, HIDDEN_MODULES, PROTO_MODULES } from "../auth/session";

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
  plans: "tag",
  team: "team",
  roles: "shield",
  audit: "history",
  "business-enquiries": "route",
};

/* ---------------------------------------------------------- proto rows ---
   Modules being built frontend-first, which the server therefore has no
   `Module` row for yet. They are appended to whatever the session returned, so
   a real row for the same key always wins — the day the API ships its row, the
   entry here stops being used before anyone deletes it, and the nav does not
   double up.

   `group` matches an existing server group label so the module lands in the
   sidebar where it belongs rather than in a section of one. */
const PROTO_ROWS: { key: string; label: string; group: string }[] = [
  { key: "business-enquiries", label: "Business Enquiries", group: "Client Ops" },
];
/** Sidebar queue-count keys, from IBData.derive.badges(). A module with no
 * entry here shows no badge, which is correct for anything the prototype
 * never counted (Plans, Roles, Audit). */
const Q_OF: Record<string, string> = {
  deals: "deals",
  team: "team",
};

export function getModules(): ModuleGroup[] {
  const s = getSession();
  const mods = s
    ? s.modules
        .filter((m) => !HIDDEN_MODULES.has(m.key))
        .sort((a, b) => a.displayOrder - b.displayOrder)
    : [];
  const groups: ModuleGroup[] = [];
  const byGroup: Record<string, ModuleGroup> = {};
  const put = (key: string, label: string, group: string) => {
    if (!byGroup[group]) {
      byGroup[group] = { group, items: [] };
      groups.push(byGroup[group]);
    }
    byGroup[group].items.push({
      key,
      label,
      icon: ICON_OF[key] || "doc",
      route: key,
      q: Q_OF[key],
    });
  };
  mods.forEach((m) => put(m.key, m.label, m.groupLabel || ""));
  /* Appended last and only if the server did not send the key, so a real
     Module row always takes precedence over the proto stand-in. Also gated on
     a session existing at all: a signed-out browser must see no nav. */
  if (s) {
    const seen = new Set(mods.map((m) => m.key));
    PROTO_ROWS.forEach((r) => {
      if (!seen.has(r.key) && PROTO_MODULES.has(r.key)) put(r.key, r.label, r.group);
    });
  }
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
