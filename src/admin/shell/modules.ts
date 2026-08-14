/* =============================================================================
   Interior bazzar — Admin · the module inventory
   -----------------------------------------------------------------------------
   Ported verbatim from prototype/admin-panel/admin-access/assets/admin-shell.js.

   MODULES[] is the single list. Nav, routing, breadcrumbs, permission keys and
   the permission matrix all read it. One list, five consumers. Adding a surface
   means adding one row here — never a second registry somewhere else.
   ============================================================================= */

export type ModuleItem = {
  key: string;
  label: string;
  icon: string;
  route: string;
  /** badge key in IBData.derive.badges(); absent = no queue count on this item */
  q?: string;
  /** the module document this surface came from, for traceability */
  module?: string;
};

export type ModuleGroup = {
  group: string;
  note: string;
  items: ModuleItem[];
};

export const MODULES: ModuleGroup[] = [
  /* Sales is THE CHAIN, and only the chain: a deal becomes a quotation, a
     quotation becomes an invoice. Three modules, in the order the work runs
     through them. */
  {
    group: "Sales",
    note: "what Interior bazzar sells",
    items: [
      { key: "deals", label: "Deals", icon: "deal", route: "deals", q: "deals", module: "M1" },
      { key: "quotations", label: "Quotations", icon: "quote", route: "quotations", q: "quotations", module: "M2" },
      { key: "invoices", label: "Invoices", icon: "invoice", route: "invoices", q: "invoices", module: "M3" },
    ],
  },

  /* Plans stands on its own, and the separation is the point: it is not a
     step of the chain, it is the thing the chain is priced FROM. Deals,
     Quotations and Invoices are worked through, one after another; the
     catalogue is configured once and then read. Putting it in Sales made it
     look like a fourth step.

     It is no longer under "Marketplace" either — that heading meant "who we
     serve", which was true only while this module also showed subscriptions.
     It does not. */
  {
    group: "Catalogue",
    note: "what we sell, and what it costs",
    items: [{ key: "plans", label: "Plans", icon: "tag", route: "plans", module: "M8" }],
  },

  {
    group: "Settings",
    note: "configuration, done rarely",
    items: [
      { key: "team", label: "Team", icon: "team", route: "team", q: "team", module: "M7" },
      /* Roles and Audit had working view functions and no MODULES entry, so
         the router 404'd both — the two surfaces the Team module needs most.
         Registered here, which is also what gives them permission keys. */
      { key: "roles", label: "Roles", icon: "shield", route: "roles", module: "M7" },
      { key: "audit", label: "Audit log", icon: "history", route: "audit", module: "M7" },
      { key: "design", label: "Design system", icon: "sparkle", route: "design" },
    ],
  },
];

export const ITEMS: Record<string, ModuleItem> = {};
export const GROUP_OF: Record<string, string | null> = {};
MODULES.forEach((g) => {
  g.items.forEach((it) => {
    ITEMS[it.route] = it;
    GROUP_OF[it.route] = g.group || null;
  });
});

export const moduleKeys = () => Object.keys(ITEMS);
export const moduleLabel = (k: string) => (ITEMS[k] ? ITEMS[k].label : k);

/** The default landing route. The prototype boots to #/deals. */
export const HOME_ROUTE = "deals";
