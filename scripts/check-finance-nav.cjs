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

/* What the deployed server sends today. Finance is NOT in it — every one of
   the five keys is a client-side proto row, which is the condition being
   tested. */
const SERVER_MODULES = [
  { key: "deals", label: "Deals", groupLabel: "Sales", displayOrder: 10, actions: ["view"] },
  { key: "invoices", label: "Invoices", groupLabel: "Sales", displayOrder: 30, actions: ["view"] },
  { key: "plans", label: "Plans", groupLabel: "Catalogue", displayOrder: 50, actions: ["view"] },
  { key: "team", label: "Members", groupLabel: "Settings", displayOrder: 60, actions: ["view"] },
  { key: "audit", label: "Audit log", groupLabel: "Settings", displayOrder: 80, actions: ["view"] },
];

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
  'import { __setSession } from "' + stub + '";\n'
  + 'import { getModules, getItems, getGroupOf } from "' + path.join(ROOT, "src/admin/shell/modules.ts").replace(/\\/g, "/") + '";\n'
  + 'import { PROTO_MODULES } from "' + path.join(ROOT, "src/admin/auth/session.ts").replace(/\\/g, "/") + '";\n'
  + "export { __setSession, getModules, getItems, getGroupOf, PROTO_MODULES };\n");

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
  eq("every section carries the proto gate, so none is silently dropped",
    SECTIONS.filter((s) => !M.PROTO_MODULES.has(s.key)).map((s) => s.key), []);

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
      { key: "finance-salaries", label: "Payroll", groupLabel: "Finance", displayOrder: 95, actions: ["view"] },
    ]),
  });
  const fin2 = M.getModules().filter((g) => g.group === "Finance")[0];
  eq("a real server row replaces the proto one rather than doubling it",
    fin2.items.filter((i) => i.key === "finance-salaries").length, 1);
  eq("...and the server's label wins",
    fin2.items.filter((i) => i.key === "finance-salaries")[0].label, "Payroll");

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
