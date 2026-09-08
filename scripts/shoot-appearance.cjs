/* =============================================================================
   SIX APPEARANCES, SIX PNGs — and two more with a layer open.
   -----------------------------------------------------------------------------
   Starts Vite on the gallery entry, sets the two attributes the design system
   is driven by, and photographs the result. It exists because three schemes ×
   two themes cannot be reviewed by reading a stylesheet, and because the one
   bug this arrangement is prone to — a component that names a colour instead of
   a token — is invisible until the scheme it was wrong in is switched on.

   `npm run shots`. Opt-in, like check:browser: it needs a browser binary, and
   it skips cleanly when Playwright is not installed rather than failing a suite
   nobody asked to run. Output goes to .tmp/appearance/, which is git-ignored.
   ============================================================================= */
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

let chromium;
try { ({ chromium } = require("playwright")); } catch {
  console.log("\nAppearance shots SKIPPED — playwright is not installed.\n");
  process.exit(0);
}

const PORT = 5211;
const URL = "http://localhost:" + PORT + "/appearance.html";
const OUT = path.join(process.cwd(), ".tmp", "appearance");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function reachable() {
  try { return (await fetch(URL)).ok; } catch { return false; }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  /* Vite's own entry through node — `npx.cmd` without a shell is EINVAL on
     Windows, and `shell:true` leaves a process this script cannot kill. */
  const viteBin = path.join(path.dirname(require.resolve("vite/package.json")), "bin", "vite.js");
  const vite = spawn(process.execPath, [viteBin, "--port", String(PORT), "--strictPort"], {
    stdio: "ignore",
  });

  let up = false;
  for (let i = 0; i < 60 && !up; i++) { await wait(500); up = await reachable(); }
  if (!up) { vite.kill(); console.error("FAIL — dev server did not start"); process.exit(1); }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
  page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
  await page.goto(URL, { waitUntil: "networkidle" });

  const paint = (scheme, theme) =>
    page.evaluate(([sc, th]) => {
      const r = document.documentElement;
      if (sc === "console") r.removeAttribute("data-scheme"); else r.setAttribute("data-scheme", sc);
      r.setAttribute("data-theme", th);
      r.classList.remove("dark-mode", "light-mode");
      r.classList.add(th === "dark" ? "dark-mode" : "light-mode");
      window.scrollTo(0, 0);
    }, [scheme, theme]);

  const shots = [];
  for (const scheme of ["console", "portal", "beacon"]) {
    for (const theme of ["light", "dark"]) {
      await paint(scheme, theme);
      await wait(220);
      const file = path.join(OUT, `${scheme}-${theme}.png`);
      await page.screenshot({ path: file, fullPage: true });
      shots.push(file);
    }
  }

  /* the two layers, in the default scheme — a modal decides, a drawer inspects */
  await paint("console", "light");
  await page.getByRole("button", { name: "Open modal" }).click();
  await wait(320);
  await page.screenshot({ path: path.join(OUT, "console-light-modal.png") });
  await page.keyboard.press("Escape");
  await wait(220);
  await page.getByRole("button", { name: "Open drawer" }).click();
  await wait(360);
  await page.screenshot({ path: path.join(OUT, "console-light-drawer.png") });
  await page.keyboard.press("Escape");

  await paint("console", "dark");
  await page.getByRole("button", { name: "Open drawer" }).click();
  await wait(360);
  await page.screenshot({ path: path.join(OUT, "console-dark-drawer.png") });

  await browser.close();
  vite.kill();
  console.log("\nWrote " + (shots.length + 3) + " images to " + OUT + "\n");
  process.exit(0);
})();
