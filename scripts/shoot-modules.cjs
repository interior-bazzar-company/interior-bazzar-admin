/* =============================================================================
   EVERY MODULE, BOTH THEMES — the redesign's own proof
   -----------------------------------------------------------------------------
   The appearance gallery photographs the PARTS. This photographs the PRODUCT:
   it boots the real shell against a mocked `me/permissions/`, walks every route
   in the registry, and writes one image per route per theme.

   WHY IT EXISTS. "Every screen must feel like it belongs to the same product"
   is not a claim a stylesheet can support and not one a render-to-string test
   can check. It is a claim about what a person sees, so it is checked by
   looking — and the only way to look at nineteen routes in two themes without
   missing one is to photograph all thirty-eight.

   The frontend-first modules (users, finance, team, resources, agreements,
   business-enquiries) read src/content/*.json and come up with real rows. The
   API-backed ones get an empty 200, so they come up in their EMPTY state —
   which is the state most likely to be wrong and least likely to be looked at,
   so that is a feature of this script rather than a limitation.

   `node scripts/shoot-modules.cjs`. Output goes to .tmp/modules/, git-ignored.
   ============================================================================= */
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

let chromium;
try { ({ chromium } = require("playwright")); } catch {
  console.log("\nModule shots SKIPPED — playwright is not installed.\n");
  process.exit(0);
}

/* SHOT_PORT / SHOT_ROUTES / SHOT_OUT let several runs share one machine:
   `SHOT_PORT=5231 SHOT_ROUTES=deals,quotations node scripts/shoot-modules.cjs`

   SHOT_W / SHOT_H photograph a DIFFERENT WIDTH — the responsive pass. A layout
   claim ("it works on a tablet") is checked the same way as a visual one: by
   looking at it. SHOT_FULL=1 captures the whole scroll height, which is what
   you want on a phone, where the interesting failures are below the fold.
   `SHOT_W=390 SHOT_FULL=1 SHOT_OUT=phone node scripts/shoot-modules.cjs`
   SHOT_THEMES=light halves a run when only the layout is in question. */
const PORT = Number(process.env.SHOT_PORT || 5222);
const VW = Number(process.env.SHOT_W || 1440);
const VH = Number(process.env.SHOT_H || 900);
const FULL = process.env.SHOT_FULL === "1";
const APP = "http://localhost:" + PORT;
const OUT = path.join(process.cwd(), ".tmp", process.env.SHOT_OUT || "modules");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* Every route the registry knows, in sidebar order. `groupLabel` is what the
   sidebar prints; `actions` is what `can()` reads. */
const ROUTES = [
  ["overview", "Overview", ""],
  ["deals", "Deals", "Sales"],
  ["quotations", "Quotations", "Sales"],
  ["invoices", "Invoices", "Sales"],
  ["business-enquiries", "Business Enquiries", "Sales"],
  ["plans", "Plans", "Catalogue"],
  ["users", "Users Management", "Business Ops"],
  ["finance", "Subscriptions", "Finance"],
  ["finance-salaries", "Salaries A/C", "Finance"],
  ["finance-transactions", "Other Transaction", "Finance"],
  ["finance-refunds", "Refunds", "Finance"],
  ["finance-analytics", "Analytics", "Finance"],
  ["team", "Members", "Team"],
  ["attendance", "Attendance", "Team"],
  ["work", "Tasks", "Team"],
  ["reports", "Reports", "Team"],
  ["resources", "Data Forms", "Resources"],
  ["agreements", "Agreements", "Resources"],
  ["roles", "Roles", "Settings"],
  ["audit", "Audit", "Settings"],
];

const ME = {
  data: {
    role: "Admin", roles: ["Admin"], isFullAccess: true, gateOk: true,
    user: { id: 1, username: "admin", name: "Asha Rao", email: "asha@interiorbazzar.com", initials: "AR" },
    modules: ROUTES.map(([key, label, groupLabel], i) => ({
      key, label, groupLabel, displayOrder: i + 1,
      actions: ["view", "edit", "create", "delete", "approve", "export"],
    })),
    actionLevels: {},
  },
  message: "ok",
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (f.endsWith(".png")) fs.unlinkSync(path.join(OUT, f));

  const viteBin = path.join(path.dirname(require.resolve("vite/package.json")), "bin", "vite.js");
  const vite = spawn(process.execPath, [viteBin, "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await wait(500);
    try { up = (await fetch(APP + "/")).ok; } catch { /* not yet */ }
  }
  if (!up) { vite.kill(); console.error("FAIL — dev server did not start"); process.exit(1); }

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem("accessToken", "test-token"); } catch { /* private mode */ }
  });
  const API = (() => {
    const env = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
    const m = /^VITE_BASE_URL=(.+)$/m.exec(env);
    return m ? new URL(m[1].trim()).origin : "https://dev.interiorbazzar.com";
  })();
  /* ORDER IS LOAD-BEARING: Playwright matches the LAST registered route first,
     so the catch-all goes in before the ones that matter. */
  const json = (r, body) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

  await ctx.route(API + "/**", (r) => json(r, { data: [], message: "ok" }));

  /* BUSINESS ENQUIRIES BOOTS BEHIND A VOCABULARY GATE, on purpose: the module
     reads its statuses, categories and urgency ramp from the server rather
     than hardcoding them, and renders nothing until they arrive. An empty
     `{data:[]}` is not "no vocabulary", it is a MALFORMED one — so the module
     threw and the shot came out as the error boundary, which says nothing
     about whether the page is designed correctly.

     The seed under src/content/business-enquiries/ is the same shape the API
     answers with, so serving it here photographs the real screen. */
  const seed = (name) =>
    JSON.parse(fs.readFileSync(
      path.join(process.cwd(), "src", "content", "business-enquiries", name), "utf8"));
  let vocab = null, rows = null;
  try { vocab = seed("vocabularies.json"); rows = seed("enquiries.json"); } catch { /* no seed */ }
  if (vocab) {
    await ctx.route(API + "/**/business-enquiries/vocabularies**", (r) =>
      json(r, vocab.data ? vocab : { data: vocab, message: "ok" }));
  }
  if (rows) {
    await ctx.route(API + "/**/business-enquiries/**", (r) => {
      const u = r.request().url();
      if (u.indexOf("vocabularies") >= 0) return r.fallback();
      return json(r, rows.data ? rows : { data: rows, message: "ok" });
    });
  }

  /* TWO ENDPOINTS THAT WANT A SHAPE, NOT A LIST. Members reads
     `r.data.roles` and Audit reads `d.facets.modules`, so a bare `{data:[]}`
     is not "nothing to show" — it is a response missing the field the screen
     is built on, and both threw into the ErrorBoundary. A fixture with the
     right shape and no rows photographs the EMPTY state, which is the one most
     worth looking at and least likely to have been. */
  await ctx.route(API + "/**/roles**", (r) => json(r, { data: { roles: [] }, message: "ok" }));
  await ctx.route(API + "/**/audit**", (r) =>
    json(r, {
      data: { entries: [], total: 0, pageNo: 1, facets: { modules: {}, actors: {}, actions: {} } },
      message: "ok",
    }));

  await ctx.route(API + "/**/me/permissions**", (r) => json(r, ME));

  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  let n = 0;
  const outcomes = [];
  const only = (process.env.SHOT_ROUTES || "").split(",").map((s) => s.trim()).filter(Boolean);
  const WANT = only.length ? ROUTES.filter(([r]) => only.indexOf(r) >= 0) : ROUTES;
  const THEMES = (process.env.SHOT_THEMES || "light,dark").split(",").map((t) => t.trim()).filter(Boolean);
  for (const theme of THEMES) {
    await ctx.addInitScript(`try{localStorage.setItem("ib_admin_theme",${JSON.stringify(JSON.stringify(theme))})}catch(e){}`);
    for (const [route] of WANT) {
      await page.goto(APP + "/" + route, { waitUntil: "networkidle" });
      /* the theme is written before paint from localStorage, but the context
         script above only applies to pages opened after it was added — so set
         it here as well and let the attribute win either way */
      await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
      await wait(650);
      /* DID THE PAGE ACTUALLY RENDER? The ErrorBoundary catches a throw, so a
         module that failed to boot still produces a screenshot — a perfectly
         composed picture of nothing. Recorded per route so the summary says
         which screens were really looked at. */
      const state = await page.evaluate(() => {
        const root = document.getElementById("root");
        const html = root ? root.innerHTML : "";
        if (html.indexOf("Something went wrong") >= 0) return "ERROR";
        if (document.querySelector(".spinner,.pane-load")) return "loading";
        return "ok";
      });
      if (state !== "ok") outcomes.push(theme + "/" + route + " → " + state);
      await page.screenshot({ path: path.join(OUT, theme + "-" + route + ".png"), fullPage: FULL });
      n++;
    }
  }

  await browser.close();
  vite.kill();
  if (errors.length) {
    console.log("\nPAGE ERRORS (" + errors.length + "):");
    for (const e of Array.from(new Set(errors)).slice(0, 20)) console.log("  " + e);
  }
  if (outcomes.length) {
    console.log("\nDID NOT RENDER (" + outcomes.length + " of " + n + "):");
    for (const o of outcomes) console.log("  " + o);
  } else {
    console.log("\nEvery route rendered.");
  }
  console.log("\nWrote " + n + " images to " + OUT + "\n");
  process.exit(errors.length ? 1 : 0);
})();
