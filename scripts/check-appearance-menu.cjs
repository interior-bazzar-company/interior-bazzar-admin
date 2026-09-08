/* =============================================================================
   THE APPEARANCE CONTROL, DRIVEN FOR REAL
   -----------------------------------------------------------------------------
   The scheme picker lives inside the account popover, which is inside the real
   shell, behind the real session guard — so a gallery cannot test it and a
   string render cannot either. This drives the actual panel in a browser with
   `me/permissions/` mocked at the network boundary: no stub module, no aliased
   import, nothing about the app changed to make it testable.

   It asserts the thing a person would check by hand:
     1. the account menu opens and the picker is in it
     2. choosing a scheme writes the attribute AND repaints
     3. it is still there after a reload
     4. Portal really is the previous appearance — a different painted value

   `npm run check:menu`. Opt-in, like the other browser check: it skips cleanly
   when Playwright is not installed.
   ============================================================================= */
const { spawn } = require("child_process");
const path = require("path");

let chromium;
try { ({ chromium } = require("playwright")); } catch {
  console.log("\nAppearance-menu check SKIPPED — playwright is not installed.\n");
  process.exit(0);
}

const PORT = 5216;
const APP = "http://localhost:" + PORT + "/";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* One admin with every module the sidebar can show. `actions` is what `can()`
   reads; the shape is `me/permissions/`'s, not an invention. */
const MODULES = [
  ["deals", "Deals", "Sales"], ["plans", "Plans", "Catalogue"],
  ["team", "Members", "Settings"], ["roles", "Roles", "Settings"],
  ["audit", "Audit", "Settings"],
].map(([key, label, groupLabel], i) => ({
  key, label, groupLabel, displayOrder: i + 1,
  actions: ["view", "edit", "create", "delete"],
}));

const ME = {
  data: {
    role: "Admin", roles: ["Admin"], isFullAccess: true, gateOk: true,
    user: { id: 1, username: "admin", name: "Admin", email: "admin@example.com", initials: "A" },
    modules: MODULES,
    actionLevels: {},
  },
  message: "ok",
};

let failed = 0;
const check = (label, ok, detail) => {
  console.log((ok ? "ok   " : "FAIL ") + label.padEnd(52) + (detail === undefined ? "" : detail));
  if (!ok) failed++;
};

(async () => {
  const viteBin = path.join(path.dirname(require.resolve("vite/package.json")), "bin", "vite.js");
  const vite = spawn(process.execPath, [viteBin, "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await wait(500);
    try { up = (await fetch(APP)).ok; } catch { /* not yet */ }
  }
  if (!up) { vite.kill(); console.error("FAIL — dev server did not start"); process.exit(1); }

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem("accessToken", "test-token"); } catch { /* private mode */ }
  });
  /* SCOPED TO THE BACKEND ORIGIN, not to a path fragment. A glob written
     around the word "api" also matches `/src/api/apiService/index.ts`, which
     the dev server serves as a module — answering that with JSON kills the page
     before React starts, and the only symptom is an empty <div id="root">.

     ORDER IS ALSO LOAD-BEARING: Playwright matches the LAST registered route
     first, so the catch-all is registered before the one that matters. */
  const API = (() => {
    const env = require("fs").readFileSync(path.join(process.cwd(), ".env"), "utf8");
    const m = /^VITE_BASE_URL=(.+)$/m.exec(env);
    return m ? new URL(m[1].trim()).origin : "https://dev.interiorbazzar.com";
  })();
  await ctx.route(API + "/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [], message: "ok" }) }));
  await ctx.route(API + "/**/me/permissions**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ME) }));

  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("requestfailed", (r) => errors.push("reqfail: " + r.url()));
  page.on("response", (r) => { if (/permissions/.test(r.url())) console.log("PERMS " + r.status() + " " + r.url()); });
  await page.goto(APP, { waitUntil: "networkidle" });
  await wait(700);

  const paint = () => page.evaluate(() => ({
    scheme: document.documentElement.getAttribute("data-scheme"),
    body: getComputedStyle(document.body).backgroundColor,
    stored: (() => { try { return localStorage.getItem("ib_admin_scheme"); } catch { return null; } })(),
  }));

  if (await page.locator("aside.sidebar").count() === 0) {
    console.log("URL: " + page.url());
    console.log("BODY: " + (await page.locator("body").innerText()).slice(0, 400));
    console.log("ROOT: " + (await page.evaluate(() => document.getElementById("root").innerHTML)).slice(0, 900));
    console.log("ERRORS: " + errors.join(" | "));
  }
  check("the shell rendered (sidebar present)", await page.locator("aside.sidebar").count() > 0);

  /* THE MENU STAYS OPEN after a choice — a setting that saves on change has no
     reason to close the panel it lives in. So "open it" has to mean "open it if
     it is not already open", or the second call toggles it shut. */
  const openMenu = async () => {
    if (await page.locator("#apScheme").count() === 0) {
      await page.locator("button.sb-user").click();
      await wait(280);
    }
  };

  await openMenu();
  const picker = page.locator("#apScheme");
  check("the account menu carries the scheme picker", await picker.count() > 0);
  if (await picker.count() === 0) {
    console.log("\n" + (await page.locator(".pop").innerHTML().catch(() => "(no popover)")).slice(0, 800));
  }

  const before = await paint();
  check("boots on console (no attribute)", before.scheme === null, before.body);

  await picker.selectOption("portal");
  await wait(350);
  const after = await paint();
  check("choosing Portal sets data-scheme", after.scheme === "portal", after.scheme);
  check("choosing Portal repaints the page", after.body !== before.body, before.body + " → " + after.body);
  check("choosing Portal is stored", after.stored === '"portal"', String(after.stored));
  /* THE MENU ITSELF HAS TO SAY SO. It holds a captured node, so before it was
     rebuilt on change the page repainted while the line under the picker went
     on describing the scheme you just left — which reads as "nothing
     happened" while looking straight at the control that just did something. */
  const hint = (await page.locator(".ap-hint").innerText()).trim();
  check("the menu's own line follows the choice", /as it was/i.test(hint), hint);
  await page.screenshot({ path: path.join(process.cwd(), ".tmp", "appearance", "account-menu.png") });

  await page.reload({ waitUntil: "networkidle" });
  await wait(700);
  const reloaded = await paint();
  check("Portal survives a reload", reloaded.scheme === "portal" && reloaded.body === after.body,
    reloaded.scheme + " " + reloaded.body);

  await openMenu();
  check("the picker reopens showing Portal", (await page.locator("#apScheme").inputValue()) === "portal");
  await page.locator("#apScheme").selectOption("beacon");
  await wait(350);
  const beacon = await paint();
  check("choosing Beacon repaints again", beacon.scheme === "beacon" && beacon.body !== after.body, beacon.body);

  await openMenu();
  await page.locator("#apScheme").selectOption("console");
  await wait(350);
  const back = await paint();
  check("choosing Console clears the attribute", back.scheme === null && back.stored === null, back.body);

  /* THE THEME HALF OF THE SAME MENU. It was here before the scheme picker was,
     it sits directly under it, and "the appearance control does not work" is a
     sentence that covers both — so both are driven. */
  await openMenu();
  const themeBefore = await paint();
  await page.locator('[data-act="theme"][data-v="light"]').click();
  await wait(350);
  const light = await paint();
  check("Light repaints the page", light.body !== themeBefore.body, themeBefore.body + " → " + light.body);
  check("Light writes data-theme", await page.evaluate(() =>
    document.documentElement.getAttribute("data-theme")) === "light");
  await openMenu();
  await page.locator('[data-act="theme"][data-v="dark"]').click();
  await wait(350);
  const dark = await paint();
  check("Dark repaints the page back", dark.body !== light.body, light.body + " → " + dark.body);

  check("no page errors", errors.length === 0, errors.join(" | "));

  await browser.close();
  vite.kill();
  console.log("\n" + (failed ? failed + " failing check(s)" : "all checks passed") + "\n");
  process.exit(failed ? 1 : 0);
})();
