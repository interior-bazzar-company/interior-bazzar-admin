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
  users: "users",
  finance: "cash",
  "finance-salaries": "team",
  "finance-transactions": "out",
  "finance-refunds": "refund",
  "finance-analytics": "chart",
  attendance: "clock",
  work: "calendar",
  reports: "inbox",
};

/* ------------------------------------------------------- group override ---
   The server sends each module's `groupLabel`, and that is normally the whole
   answer. `team` and `roles` are the exception: their rows say "Settings",
   which was right while Team meant "add a staff account and grant it a role" —
   configuration, done rarely. It stops being right the moment Attendance, Work
   and Reports sit beside them, because those are the most-visited screens in
   the panel and Settings is the one group nobody opens daily.

   So the two are re-filed client-side, next to the surfaces they belong with.
   This is a STAND-IN, not the design: `groupLabel` is the server's field and
   the fix is a Module-row update, at which point this map empties and the
   behaviour does not change. Listed as work in BACKEND-INTEGRATION.md.

   Note it re-files rather than renames: a key absent here keeps whatever the
   server said, so a new server group still appears rather than vanishing. */
const GROUP_OVERRIDE: Record<string, string> = {
  team: "Team",
  roles: "Team",
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
  /* business-enquiries removed: the server sends its own Module row now
     (backend migration 0024), so the stand-in would never have been reached —
     PROTO_MODULES no longer holds the key, which is the second half of the
     condition below. Kept as a comment because the mechanism is still the right
     one for the next frontend-first module, and `users` is that module. */

  /* Business Ops · Users Management. A NEW GROUP, not a row inside Sales: the
     registered-user base is neither a sales pipeline nor a setting, and filing
     it under either would have been a
     filing decision pretending to be a product one. The group is empty apart
     from this until the rest of Business Ops lands, and a group of one is the
     honest state of that rather than a reason to hide it somewhere else. */
  { key: "users", label: "Users Management", group: "Business Ops" },
  /* Finance · FIVE ROWS, ONE GROUP, because Finance records four different
     things and reads them back in a fifth place. A single row labelled
     "Finance" inside a group labelled "Finance" said nothing about what was
     inside it, and buried the five sections one click deep behind an in-page
     tab strip nobody could see from the sidebar.

     They are separate KEYS rather than one key with five faces because the
     grant is genuinely different: payroll is the most sensitive record in the
     panel, and `finance-salaries` has to be holdable — or withholdable —
     without touching the subscription ledger. Same argument that made
     `reports` its own key rather than a face of `work`.

     Order is the order money moves: what was sold, what the team costs,
     everything else, what went back out, then all four read together. */
  { key: "finance", label: "Subscriptions", group: "Finance" },
  { key: "finance-salaries", label: "Salaries A/C", group: "Finance" },
  { key: "finance-transactions", label: "Other Transaction", group: "Finance" },
  { key: "finance-refunds", label: "Refunds", group: "Finance" },
  { key: "finance-analytics", label: "Analytics", group: "Finance" },

  /* Team · the operational half. `Members` and `Roles` are already real server
     rows and are NOT listed here — they are re-filed into this group by
     GROUP_OVERRIDE above. These three are the surfaces that do not exist
     server-side at all yet, so they carry the proto gate like Users and Finance
     did. Order inside the group is arrival order, and it is the order of a
     working day: who is here, what they are doing, what they reported.

     `reports` is its own key rather than a face of `work` because the verb it
     needs is not the same one: reading everybody's daily plans and EOD reports
     is a manager's grant, and it must be possible to hold it without holding
     the right to create or reassign anybody's work. */
  { key: "attendance", label: "Attendance", group: "Team" },
  /* `Calendar`, not `Work`. The label follows what somebody opens the row for —
     a dated view of the week — and the module's headline ask was a calendar.
     THE LABEL AND THE DEFAULT FACE ARE THE WHOLE CHANGE: the route is still
     `work`, the entity is still WorkItem and the grant is still team.work.*,
     so every existing link, bookmark and `?item=` drawer URL keeps working.
     Renaming the route would buy a tidier address bar for a redirect to
     maintain forever, and a module key that disagrees with its own table. */
  { key: "work", label: "Calendar", group: "Team" },
  { key: "reports", label: "Reports", group: "Team" },
  /* There is no `me` row. The member dashboard lives at `#/team/:id` — a row
     on the Members table opens it — because "the team, as a table" already
     existed there and a second roster was a second front door to one room. */
];
/** Sidebar queue-count keys, from IBData.derive.badges(). A module with no
 * entry here shows no badge, which is correct for anything the prototype
 * never counted (Plans, Roles, Audit). */
const Q_OF: Record<string, string> = {
  deals: "deals",
  team: "team",
};

/* THE SIDEBAR'S GROUP ORDER.
   Groups used to appear in whatever order the server's modules arrived in, with
   the proto rows appended last — which is why Client Ops sat at the bottom,
   below Settings, purely because it is the newest thing here. Ordering is a
   product decision, so it is stated rather than inherited from a response.

   A group not named here keeps its arrival order, after the named ones: a new
   server group appears rather than silently vanishing. */
const GROUP_ORDER = [
  "Sales",
  "Client Ops",
  "Business Ops",
  /* Team sits above Finance and well above Settings because it is opened every
     day — the clock, the day's work and the day's reports — and Settings is the
     group nobody opens daily. Same argument that moved Users Management out of
     Settings into Business Ops. */
  "Team",
  "Finance",
  "Catalogue",
  "Settings",
];

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
  mods.forEach((m) => put(m.key, m.label, GROUP_OVERRIDE[m.key] || m.groupLabel || ""));
  /* Appended last and only if the server did not send the key, so a real
     Module row always takes precedence over the proto stand-in. Also gated on
     a session existing at all: a signed-out browser must see no nav. */
  if (s) {
    const seen = new Set(mods.map((m) => m.key));
    PROTO_ROWS.forEach((r) => {
      if (!seen.has(r.key) && PROTO_MODULES.has(r.key)) put(r.key, r.label, r.group);
    });
  }
  const rank = (g: string) => {
    const i = GROUP_ORDER.indexOf(g);
    return i < 0 ? GROUP_ORDER.length : i;
  };
  return groups
    .map((g, i) => ({ g, i }))
    .sort((a, b) => rank(a.g.group) - rank(b.g.group) || a.i - b.i)
    .map((x) => x.g);
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
