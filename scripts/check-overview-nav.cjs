/* =============================================================================
   check:overview-nav · the Overview is the landing page and the first row.
   -----------------------------------------------------------------------------
   Since interior_admin migration 0026 the Overview is a SERVER Module row
   (key overview, groupLabel "", displayOrder 0, one action: view) and no
   longer a proto row: PROTO_MODULES dropped the key, so can("overview") reads
   the session's own grant. GROUP_ORDER still ranks the empty group first,
   HOME_ROUTE still points at it, and homeRoute() forwards a session without
   the grant to its first allowed page. Every part of that is a silent
   failure — a group label absent from GROUP_ORDER files the row at the
   bottom, and a homeRoute() that ignores the grant loops a redirect. Modelled
   on scripts/check-finance-nav.cjs, which exists for the same reason.

     node scripts/check-overview-nav.cjs
   ============================================================================= */
const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const TMP = path.join(ROOT, "node_modules", ".tmp");

/* What the deployed server sends a session that holds the Overview. */
const OVERVIEW_ROW = { key: "overview", label: "Overview", groupLabel: "", displayOrder: 0, actions: ["view"] };
const OTHERS = [
  { key: "deals", label: "Deals", groupLabel: "Sales", displayOrder: 10, actions: ["view"] },
  { key: "invoices", label: "Invoices", groupLabel: "Sales", displayOrder: 30, actions: ["view"] },
  { key: "plans", label: "Plans", groupLabel: "Catalogue", displayOrder: 50, actions: ["view"] },
  { key: "team", label: "Members", groupLabel: "Settings", displayOrder: 60, actions: ["view"] },
  { key: "audit", label: "Audit log", groupLabel: "Settings", displayOrder: 80, actions: ["view"] },
];
const SERVER_MODULES = [OVERVIEW_ROW].concat(OTHERS);

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

const entry = path.join(TMP, "overview-nav-entry.ts");
const outfile = path.join(TMP, "overview-nav.cjs");
const stub = path.join(__dirname, "team-nav-session-stub.ts").replace(/\\/g, "/");

fs.mkdirSync(TMP, { recursive: true });
fs.writeFileSync(entry,
  'import { __setSession } from "' + stub + '";\n'
  + 'import { getModules, getItems, getGroupOf, HOME_ROUTE, homeRoute } from "' + path.join(ROOT, "src/admin/shell/modules.ts").replace(/\\/g, "/") + '";\n'
  + 'import { PROTO_MODULES } from "' + path.join(ROOT, "src/admin/auth/session.ts").replace(/\\/g, "/") + '";\n'
  + "export { __setSession, getModules, getItems, getGroupOf, HOME_ROUTE, homeRoute, PROTO_MODULES };\n");

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
  console.log("\nOverview nav · the landing page, first and unlabelled");

  /* ---- signed out ------------------------------------------------------- */
  M.__setSession(null);
  eq("signed out renders no rows at all", M.getModules(), []);

  /* ---- the row ---------------------------------------------------------- */
  M.__setSession({ modules: SERVER_MODULES });
  const groups = M.getModules();
  const first = groups[0];
  ok("the first group in the sidebar has no label", !!first && first.group === "");
  eq("...and it holds exactly the Overview row", first ? first.items.map((i) => i.key) : [], ["overview"]);
  const row = first ? first.items[0] : null;
  eq("the row is labelled Overview", row && row.label, "Overview");
  eq("it routes to its own key", row && row.route, "overview");
  eq("it wears the home icon, not the doc fallback", row && row.icon, "home");

  /* ---- the gate --------------------------------------------------------- */
  ok("overview is NOT proto-gated any more — the server row carries the grant", !M.PROTO_MODULES.has("overview"));

  /* ---- the landing route ------------------------------------------------ */
  eq("HOME_ROUTE boots the panel to the Overview", M.HOME_ROUTE, "overview");
  eq("...and a session holding it lands there", M.homeRoute(), "overview");
  ok("getItems resolves the route the redirect points at", !!M.getItems()[M.HOME_ROUTE]);
  eq("getGroupOf files it under no group", M.getGroupOf()["overview"], null);

  /* ---- nothing else moved ----------------------------------------------- */
  const names = groups.map((g) => g.group);
  eq("Sales is still the first labelled group", names[1], "Sales");
  const keys = groups.flatMap((g) => g.items.map((i) => i.key));
  eq("no key appears twice anywhere in the sidebar", keys.filter((k, i) => keys.indexOf(k) !== i), []);

  /* ---- a session without the grant -------------------------------------- */
  M.__setSession({ modules: OTHERS });
  const without = M.getModules();
  eq("no server row, no Overview row — the proto stand-in is not reached", without.flatMap((g) => g.items).filter((i) => i.key === "overview").length, 0);
  eq("...and homeRoute forwards to the first page the sidebar allows", M.homeRoute(), "deals");

  /* ---- the server's label ----------------------------------------------- */
  M.__setSession({ modules: [Object.assign({}, OVERVIEW_ROW, { label: "Home" })].concat(OTHERS) });
  const again = M.getModules();
  const rows = again.flatMap((g) => g.items).filter((i) => i.key === "overview");
  eq("the row appears once", rows.length, 1);
  eq("...and the server's label wins", rows[0] && rows[0].label, "Home");
  eq("...and it still sits first", again[0].items[0].key, "overview");

  console.log(failed ? "\n" + failed + " FAILED\n" : "\nall checks passed\n");
  process.exit(failed ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
