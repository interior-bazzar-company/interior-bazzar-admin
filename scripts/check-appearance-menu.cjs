/* =============================================================================
   THE APPEARANCE CONTROL, DRIVEN FOR REAL
   -----------------------------------------------------------------------------
   The theme switch lives inside the account popover, which is inside the real
   shell, behind the real session guard — so a gallery cannot test it and a
   string render cannot either. This drives the actual panel in a browser with
   `me/permissions/` mocked at the network boundary: no stub module, no aliased
   import, nothing about the app changed to make it testable.

   WHAT IT ASSERTS, and why each line is here:
     1. the account menu opens and the switch is in it
     2. choosing a theme writes `data-theme` AND repaints
     3. the menu itself follows the choice — it holds a CAPTURED node, so
        before `open(true)` existed the page repainted while the control went
        on showing the theme you had just left, which reads as "nothing
        happened" while you are looking straight at the thing that worked
     4. it survives a reload, with no flash of the other theme
     5. "System" resolves to one of the two rather than becoming a third state
     6. THE RETIRED APPEARANCE KEYS ARE GONE. A browser that stored `portal` or
        `compact` in an earlier build must not carry a dead preference around,
        and `data-scheme` / `data-density` must never appear on <html> again.

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
    try {
      localStorage.setItem("accessToken", "test-token");
      /* SEED THE RETIRED KEYS ON PURPOSE. This is the state a real browser is
         in after the consolidation shipped, and the panel has to clear them
         rather than honour them — which is asserted at the end. */
      localStorage.setItem("ib_admin_scheme", '"portal"');
      localStorage.setItem("ib_admin_density", '"compact"');
    } catch { /* private mode */ }
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
  await page.goto(APP, { waitUntil: "networkidle" });
  await wait(700);

  const paint = () => page.evaluate(() => {
    const r = document.documentElement;
    const ls = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
    return {
      theme: r.getAttribute("data-theme"),
      cls: r.classList.contains("dark-mode"),
      pref: r.getAttribute("data-theme-pref"),
      scheme: r.getAttribute("data-scheme"),
      density: r.getAttribute("data-density"),
      body: getComputedStyle(document.body).backgroundColor,
      stored: ls("ib_admin_theme"),
      deadScheme: ls("ib_admin_scheme"),
      deadDensity: ls("ib_admin_density"),
    };
  });

  if (await page.locator('aside[aria-label="Modules"]').count() === 0) {
    console.log("URL: " + page.url());
    console.log("ROOT: " + (await page.evaluate(() => document.getElementById("root").innerHTML)).slice(0, 900));
    console.log("ERRORS: " + errors.join(" | "));
  }
  check("the shell rendered (sidebar present)", await page.locator('aside[aria-label="Modules"]').count() > 0);

  /* THE MENU STAYS OPEN after a choice — a setting that saves on change has no
     reason to close the panel it lives in. So "open it" has to mean "open it if
     it is not already open", or the second call toggles it shut. */
  const themeBtn = (v) => page.locator('[data-act="seg"][data-v="' + v + '"]');
  const openMenu = async () => {
    if (await themeBtn("light").count() === 0) {
      await page.locator('[data-act="account"]').first().click();
      await wait(280);
    }
  };

  await openMenu();
  check("the account menu carries the theme switch", await themeBtn("light").count() > 0);
  check("…and no scheme picker, which no longer exists",
    await page.locator("#apScheme").count() === 0);

  const boot = await paint();
  check("boots dark, the panel's default", boot.theme === "dark", boot.theme + " " + boot.body);
  /* THE ONE ATTRIBUTE. Three schemes and a density variant used to ride on
     <html> beside the theme; the consolidation removed them, and a stale value
     in localStorage must not bring one back. */
  check("no data-scheme on <html>", boot.scheme === null, String(boot.scheme));
  check("no data-density on <html>", boot.density === null, String(boot.density));
  check("the retired scheme key is cleared", boot.deadScheme === null, String(boot.deadScheme));
  check("the retired density key is cleared", boot.deadDensity === null, String(boot.deadDensity));

  await themeBtn("light").click();
  await wait(350);
  const light = await paint();
  check("Light writes data-theme", light.theme === "light", light.theme);
  check("Light drops the dark-mode class (the library's contract)", light.cls === false, String(light.cls));
  check("Light repaints the page", light.body !== boot.body, boot.body + " → " + light.body);
  check("Light is stored", light.stored === '"light"', String(light.stored));
  /* THE MENU ITSELF HAS TO SAY SO — see the note at the top of this file. */
  check("the switch itself follows the choice",
    (await themeBtn("light").getAttribute("aria-pressed")) === "true" || (await themeBtn("light").getAttribute("data-selected")) !== null);
  const hint = (await page.locator("#themeHint").innerText()).trim();
  check("the menu's own line follows the choice", /ink on paper/i.test(hint), hint);

  await page.screenshot({ path: path.join(process.cwd(), ".tmp", "appearance", "account-menu.png") });

  /* NO FLASH ON RELOAD. index.html writes the attribute before first paint, so
     the reloaded page must come back in the same theme with the same ground —
     a mismatch here is the one appearance bug somebody sees every morning. */
  await page.reload({ waitUntil: "networkidle" });
  await wait(700);
  const reloaded = await paint();
  check("Light survives a reload", reloaded.theme === "light" && reloaded.body === light.body,
    reloaded.theme + " " + reloaded.body);

  await openMenu();
  await themeBtn("dark").click();
  await wait(350);
  const dark = await paint();
  check("Dark repaints the page back", dark.theme === "dark" && dark.body !== light.body,
    light.body + " → " + dark.body);
  check("Dark sets the dark-mode class", dark.cls === true, String(dark.cls));

  /* SYSTEM IS A PREFERENCE, NOT A THIRD THEME. It must record the preference
     and still resolve `data-theme` to one of the two, because the stylesheet
     has exactly two blocks and nothing to paint for a third value. */
  await openMenu();
  await themeBtn("system").click();
  await wait(350);
  const sys = await paint();
  check("System is stored as the preference", sys.stored === '"system"', String(sys.stored));
  check("System marks itself on <html>", sys.pref === "system", String(sys.pref));
  check("System still resolves to light or dark",
    sys.theme === "light" || sys.theme === "dark", String(sys.theme));

  /* AND IT FOLLOWS THE OS. Emulating the OS preference is the only way to prove
     the listener is live rather than resolved once at boot. */
  await page.emulateMedia({ colorScheme: "light" });
  await wait(250);
  const sysLight = await paint();
  await page.emulateMedia({ colorScheme: "dark" });
  await wait(250);
  const sysDark = await paint();
  check("System follows the OS both ways",
    sysLight.theme === "light" && sysDark.theme === "dark",
    sysLight.theme + " / " + sysDark.theme);

  check("no page errors", errors.length === 0, errors.join(" | "));

  await browser.close();
  vite.kill();
  console.log("\n" + (failed ? failed + " failing check(s)" : "all checks passed") + "\n");
  process.exit(failed ? 1 : 0);
})();
