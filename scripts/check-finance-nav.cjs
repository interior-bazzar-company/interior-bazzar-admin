/* =============================================================================
   check:finance-nav · the Finance group renders as five sidebar rows.
   -----------------------------------------------------------------------------
   Finance stopped being one row labelled "Finance" inside a group labelled
   "Finance" and became five rows naming what is actually inside it —
   Subscriptions · Salaries A/C · Other Transaction · Refunds · Analytics —
   each its own module key so a grant can be held on one without the others.

   EVERY PART OF THAT IS A SILENT FAILURE. A key in PROTO_ROWS but not in
   PROTO_MODULES never renders and nothing errors. A key in neither VIEWS nor
   the proto set renders as "coming soon" instead of the module. A groupLabel
   that does not match GROUP_ORDER exactly puts a row in a section of one. A
   key the server also sends renders twice. None of it throws, so tsc catches
   none of it — which is the whole reason this file exists, and it is modelled
   on scripts/check-team-nav.cjs, which exists for the same reason.

     node scripts/check-finance-nav.cjs
   ============================================================================= */
const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const TMP = path.join(ROOT, "node_modules", ".tmp");

/* What the server sends a session holding view on everything. Four Finance
   sections are real Module rows (interior_admin/module_seed.py); Analytics is
   still a client-side proto row. */
const OTHER_MODULES = [
  { key: "deals", label: "Deals", groupLabel: "Sales", displayOrder: 10, actions: ["view"] },
  { key: "invoices", label: "Invoices", groupLabel: "Sales", displayOrder: 30, actions: ["view"] },
  { key: "plans", label: "Plans", groupLabel: "Catalogue", displayOrder: 50, actions: ["view"] },
  { key: "team", label: "Members", groupLabel: "Settings", displayOrder: 60, actions: ["view"] },
  { key: "audit", label: "Audit log", groupLabel: "Settings", displayOrder: 80, actions: ["view"] },
];
const FINANCE_ROWS = [
  { key: "finance", label: "Subscriptions", groupLabel: "Finance", displayOrder: 38, actions: ["view"] },
  { key: "finance-transactions", label: "Other Transaction", groupLabel: "Finance", displayOrder: 39, actions: ["view"] },
  { key: "finance-salaries", label: "Salaries A/C", groupLabel: "Finance", displayOrder: 40, actions: ["view"] },
  { key: "finance-refunds", label: "Refunds", groupLabel: "Finance", displayOrder: 41, actions: ["view"] },
];
const SERVER_MODULES = OTHER_MODULES.concat(FINANCE_ROWS);
const SERVED = FINANCE_ROWS.map((m) => m.key);

/* The five, in the order money moves through the company. */
const SECTIONS = [
  { key: "finance", label: "Subscriptions", icon: "cash" },
  { key: "finance-salaries", label: "Salaries A/C", icon: "team" },
  { key: "finance-transactions", label: "Other Transaction", icon: "out" },
  { key: "finance-refunds", label: "Refunds", icon: "refund" },
  { key: "finance-analytics", label: "Analytics", icon: "chart" },
];

let failed = 0;
const eq = (what, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { console.log("  ok   " + what); return; }
  failed++;
  console.log("  FAIL " + what + "\n         got  " + a + "\n         want " + b);
};
const ok = (what, cond) => {
  if (cond) { console.log("  ok   " + what); return; }
  failed++;
  console.log("  FAIL " + what);
};

const entry = path.join(TMP, "finance-nav-entry.ts");
const outfile = path.join(TMP, "finance-nav.cjs");
const stub = path.join(__dirname, "team-nav-session-stub.ts").replace(/\\/g, "/");

fs.mkdirSync(TMP, { recursive: true });
fs.writeFileSync(entry,
  'import { __setSession, can } from "' + stub + '";\n'
  + 'import { getModules, getItems, getGroupOf } from "' + path.join(ROOT, "src/admin/shell/modules.ts").replace(/\\/g, "/") + '";\n'
  + 'import { PROTO_MODULES } from "' + path.join(ROOT, "src/admin/auth/session.ts").replace(/\\/g, "/") + '";\n'
  + "export { __setSession, getModules, getItems, getGroupOf, PROTO_MODULES, can };\n");

esbuild.build({
  entryPoints: [entry],
  bundle: true, platform: "node", format: "cjs", define: { "import.meta.env": '{"DEV":false}' },
  loader: { ".css": "empty" },
  logLevel: "error",
  outfile,
  plugins: [{
    name: "stub-session",
    setup(build) {
      build.onResolve({ filter: /auth\/session$/ }, () => ({ path: path.join(__dirname, "team-nav-session-stub.ts") }));
    },
  }],
}).then(() => {
  const M = require(outfile);
  console.log("\nFinance nav · five rows, one group");

  /* ---- signed out ------------------------------------------------------- */
  M.__setSession(null);
  eq("signed out renders no Finance rows", M.getModules().filter((g) => g.group === "Finance"), []);

  /* ---- the group -------------------------------------------------------- */
  M.__setSession({ modules: SERVER_MODULES });
  const groups = M.getModules();
  const fin = groups.filter((g) => g.group === "Finance")[0];
  ok("a Finance group exists", !!fin);
  if (!fin) { console.log("\n" + (failed + 1) + " FAILED\n"); process.exit(1); }

  eq("it holds the five sections, in the order money moves",
    fin.items.map((i) => i.label),
    SECTIONS.map((s) => s.label));
  eq("...under their own module keys, so a grant can be held on one alone",
    fin.items.map((i) => i.key), SECTIONS.map((s) => s.key));
  ok("no row is just called \"Finance\" any more — the group is already called that",
    !fin.items.some((i) => i.label === "Finance"));

  /* ---- routes ----------------------------------------------------------- */
  eq("each row routes to its own key", fin.items.map((i) => i.route), SECTIONS.map((s) => s.key));

  /* ---- the proto gate --------------------------------------------------- */
  /* A key in PROTO_ROWS but not PROTO_MODULES is dropped silently by
     getModules(). That is the failure this whole file is here for. */
  eq("every section is proto-gated or served, so none is silently dropped",
    SECTIONS.filter((s) => !M.PROTO_MODULES.has(s.key) && SERVED.indexOf(s.key) < 0).map((s) => s.key), []);
  eq("...and a served section is NOT proto-gated, so the server's grant decides",
    SERVED.filter((k) => M.PROTO_MODULES.has(k)), []);

  /* ---- a session without the grant -------------------------------------- */
  /* The leak this gate closed: the sidebar offered subscriptions, payroll,
     spend and refunds to everyone while the server refused anyone without the
     grant. */
  M.__setSession({ modules: OTHER_MODULES });
  eq("no Finance grant shows only the proto section",
    M.getModules().filter((g) => g.group === "Finance")[0].items.map((i) => i.key), ["finance-analytics"]);

  /* ---- what `edit` means where the server names each write --------------- */
  const holding = (key, actions) => { M.__setSession({ modules: [{ key, label: key, groupLabel: "Finance", displayOrder: 1, actions }] }); };
  holding("finance-salaries", ["view"]);
  ok("payroll view alone cannot edit", !M.can("finance-salaries", "edit"));
  holding("finance-salaries", ["view", "pay"]);
  ok("payroll pay opens the edit gate", M.can("finance-salaries", "edit"));
  holding("finance-salaries", ["view", "propose"]);
  ok("...propose does not: no view accepts it", !M.can("finance-salaries", "edit"));
  holding("finance-transactions", ["view", "record"]);
  ok("recording is not cancelling", !M.can("finance-transactions", "edit") && M.can("finance-transactions", "record"));
  holding("finance-transactions", ["view", "cancel"]);
  ok("cancel opens a transaction's edit gate", M.can("finance-transactions", "edit"));
  holding("finance-refunds", ["request"]);
  ok("no verb counts without view", !M.can("finance-refunds", "request"));
  holding("finance", ["view"]);
  ok("subscriptions view alone cannot edit", !M.can("finance", "edit"));
  holding("finance", ["view", "edit"]);
  ok("...edit is a real verb there, and reversing is not part of it",
    M.can("finance", "edit") && !M.can("finance", "reverse"));
  M.__setSession({ modules: SERVER_MODULES });

  /* ---- icons ------------------------------------------------------------ */
  eq("each row has a real icon rather than the doc fallback",
    fin.items.filter((i) => i.icon === "doc").map((i) => i.key), []);
  eq("...and they are the ones chosen", fin.items.map((i) => i.icon), SECTIONS.map((s) => s.icon));

  /* ---- placement -------------------------------------------------------- */
  const order = groups.map((g) => g.group);
  ok("Finance sits above Catalogue and Settings",
    order.indexOf("Finance") < order.indexOf("Catalogue")
    && order.indexOf("Finance") < order.indexOf("Settings"));
  eq("nothing else leaked into the group", fin.items.length, 5);
  const keys = groups.flatMap((g) => g.items.map((i) => i.key));
  eq("no key appears twice anywhere in the sidebar",
    keys.filter((k, i) => keys.indexOf(k) !== i), []);

  /* ---- the day the server sends a row ----------------------------------- */
  /* A real Module row must win, or the sidebar doubles the entry up. */
  M.__setSession({
    modules: SERVER_MODULES.concat([
      { key: "finance-analytics", label: "Money analytics", groupLabel: "Finance", displayOrder: 95, actions: ["view"] },
    ]),
  });
  const fin2 = M.getModules().filter((g) => g.group === "Finance")[0];
  eq("a real server row replaces the proto one rather than doubling it",
    fin2.items.filter((i) => i.key === "finance-analytics").length, 1);
  eq("...and the server's label wins",
    fin2.items.filter((i) => i.key === "finance-analytics")[0].label, "Money analytics");

  /* ---- the maps agree --------------------------------------------------- */
  M.__setSession({ modules: SERVER_MODULES });
  const groupOf = M.getGroupOf();
  eq("getGroupOf files every section under Finance",
    SECTIONS.filter((s) => groupOf[s.key] !== "Finance").map((s) => s.key), []);
  const items = M.getItems();
  eq("getItems resolves every section", SECTIONS.filter((s) => !items[s.key]).map((s) => s.key), []);

  console.log(failed ? "\n" + failed + " FAILED\n" : "\nall checks passed\n");
  process.exit(failed ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
