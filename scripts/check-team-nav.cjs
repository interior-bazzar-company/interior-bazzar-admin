/* =============================================================================
   Phase A check · the Team group renders as designed.
   -----------------------------------------------------------------------------
   Bundles shell/modules.ts against a session stub and asserts what the sidebar
   actually composes to — group order, group membership, and the proto gate.

   It exists because every part of this is a silent failure. A groupLabel that
   does not match GROUP_ORDER exactly puts a module in a section of one and
   nothing errors. A key in PROTO_ROWS but not PROTO_MODULES never renders and
   nothing errors. A key in PROTO_MODULES that the server also sends renders
   twice. None of it throws, so none of it is caught by tsc.

     node scripts/check-team-nav.cjs
   ============================================================================= */
const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "node_modules", ".tmp", "team-nav.cjs");

/* What the deployed server sends today: `team`, `roles` and `audit` all arrive
   with groupLabel "Settings". That is the input the override has to correct. */
const SERVER_MODULES = [
  { key: "deals", label: "Deals", groupLabel: "Sales", displayOrder: 10, actions: ["view"] },
  { key: "quotations", label: "Quotations", groupLabel: "Sales", displayOrder: 20, actions: ["view"] },
  { key: "invoices", label: "Invoices", groupLabel: "Sales", displayOrder: 30, actions: ["view"] },
  { key: "business-enquiries", label: "Business enquiries", groupLabel: "Client Ops", displayOrder: 40, actions: ["view"] },
  { key: "plans", label: "Plans", groupLabel: "Catalogue", displayOrder: 50, actions: ["view"] },
  { key: "team", label: "Members", groupLabel: "Settings", displayOrder: 60, actions: ["view"] },
  { key: "roles", label: "Roles", groupLabel: "Settings", displayOrder: 70, actions: ["view"] },
  { key: "audit", label: "Audit log", groupLabel: "Settings", displayOrder: 80, actions: ["view"] },
  { key: "design", label: "Design system", groupLabel: "Settings", displayOrder: 90, actions: ["view"] },
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

esbuild.build({
  entryPoints: [path.join(ROOT, "src", "admin", "shell", "modules.ts")],
  bundle: true, platform: "node", format: "cjs",
  define: { "import.meta.env": '{"DEV":false}' },
  loader: { ".css": "empty" },
  logLevel: "error",
  outfile: OUT,
  plugins: [{
    name: "stub-session",
    setup(build) {
      build.onResolve({ filter: /auth\/session$/ }, () =>
        ({ path: path.join(__dirname, "team-nav-session-stub.ts") }));
    },
  }],
}).then(() => {
  const M = require(OUT);
  /* The stub is bundled in, so its setter is reachable through the graph only
     if modules.ts re-exports it — it does not. Require the stub's compiled
     twin instead by rebuilding it as its own entry. */
  return esbuild.build({
    entryPoints: [path.join(__dirname, "team-nav-session-stub.ts")],
    bundle: true, platform: "node", format: "cjs", logLevel: "error",
    outfile: path.join(ROOT, "node_modules", ".tmp", "team-nav-stub.cjs"),
  }).then(() => M);
}).then((M) => {
  /* Both bundles carry their own copy of the stub's module state, so setting it
     on the second one would not reach the first. Patch the shared file instead:
     rebuild modules.ts with the session inlined. */
  const inlined = path.join(ROOT, "node_modules", ".tmp", "team-nav-entry.cjs");
  const entry = path.join(ROOT, "node_modules", ".tmp", "team-nav-entry.ts");
  fs.mkdirSync(path.dirname(entry), { recursive: true });
  fs.writeFileSync(entry,
    'import { __setSession } from "' + path.join(__dirname, "team-nav-session-stub.ts").replace(/\\/g, "/") + '";\n' +
    'import { getModules, getItems, getGroupOf } from "' + path.join(ROOT, "src/admin/shell/modules.ts").replace(/\\/g, "/") + '";\n' +
    'import { PROTO_MODULES } from "' + path.join(ROOT, "src/admin/auth/session.ts").replace(/\\/g, "/") + '";\n' +
    "export { __setSession, getModules, getItems, getGroupOf, PROTO_MODULES };\n");
  return esbuild.build({
    entryPoints: [entry],
    bundle: true, platform: "node", format: "cjs", logLevel: "error",
    define: { "import.meta.env": '{"DEV":false}' },
    loader: { ".css": "empty" },
    outfile: inlined,
    plugins: [{
      name: "stub-session",
      setup(build) {
        build.onResolve({ filter: /auth\/session$/ }, () =>
          ({ path: path.join(__dirname, "team-nav-session-stub.ts") }));
      },
    }],
  }).then(() => require(inlined));
}).then((A) => {
  console.log("\nTeam nav · Phase A\n");

  /* ---- signed out: no nav at all ------------------------------------- */
  A.__setSession(null);
  eq("signed out renders no groups", A.getModules().length, 0);

  /* ---- signed in ------------------------------------------------------ */
  A.__setSession({ modules: SERVER_MODULES });
  const groups = A.getModules();
  const names = groups.map((g) => g.group);
  const of = (n) => (groups.find((g) => g.group === n) || { items: [] }).items.map((i) => i.key);

  /* Business Ops and Finance are here because `users` and `finance` are proto
     rows too — this is the whole sidebar, not just Team's slice of it. */
  eq("group order", names,
    ["Sales", "Client Ops", "Business Ops", "Team", "Finance", "Catalogue", "Settings"]);
  ok("Team sits above Catalogue and Settings", names.indexOf("Team") < names.indexOf("Settings"));

  eq("Team group members, in the order of a working day",
    of("Team"), ["team", "roles", "attendance", "work", "reports", "me"]);
  eq("the Work row reads Calendar — label only, the key does not move",
    (groups.filter((g) => g.group === "Team")[0].items
      .filter((i) => i.key === "work")[0] || {}).label, "Calendar");
  eq("Settings keeps only what stayed", of("Settings"), ["audit"]);
  ok("design is hidden, not filed", of("Settings").indexOf("design") < 0);
  eq("Sales is untouched", of("Sales"), ["deals", "quotations", "invoices"]);
  eq("Client Ops is untouched", of("Client Ops"), ["business-enquiries"]);

  /* ---- no duplicates anywhere ----------------------------------------- */
  const all = groups.reduce((a, g) => a.concat(g.items.map((i) => i.key)), []);
  eq("no key appears twice", all.length, new Set(all).size);

  /* ---- icons resolve, not fall back to doc ---------------------------- */
  const items = A.getItems();
  ["attendance", "work", "reports", "me"].forEach((k) =>
    ok("`" + k + "` has a real icon (" + items[k].icon + ")", items[k].icon !== "doc"));

  /* ---- the proto gate ------------------------------------------------- */
  ok("attendance/work/reports are proto-gated",
    ["attendance", "work", "reports", "me"].every((k) => A.PROTO_MODULES.has(k)));
  ok("team is NOT proto-gated (TM-BR-01)", !A.PROTO_MODULES.has("team"));
  ok("roles is NOT proto-gated (TM-BR-01)", !A.PROTO_MODULES.has("roles"));

  /* ---- the override yields to the server ------------------------------ */
  A.__setSession({
    modules: SERVER_MODULES.concat([
      { key: "attendance", label: "Attendance", groupLabel: "Team", displayOrder: 65, actions: ["view"] },
    ]),
  });
  const after = A.getModules().reduce((a, g) => a.concat(g.items.map((i) => i.key)), []);
  eq("a real server row does not double up the proto one",
    after.filter((k) => k === "attendance").length, 1);

  /* ---- group lookup stays consistent ---------------------------------- */
  A.__setSession({ modules: SERVER_MODULES });
  const gof = A.getGroupOf();
  eq("getGroupOf agrees with getModules", gof.roles, "Team");

  console.log("\n" + (failed ? failed + " FAILED" : "all checks passed") + "\n");
  process.exit(failed ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
