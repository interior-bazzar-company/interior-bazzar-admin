/* =============================================================================
   TWO THEMES, TWO PNGs — and three more with a layer open.
   -----------------------------------------------------------------------------
   Starts Vite on the gallery entry, sets the ONE attribute the design system is
   driven by, and photographs the result. It exists because a stylesheet cannot
   be reviewed by reading it, and because the one bug this arrangement is prone
   to — a component that names a colour instead of a token — is invisible until
   the other theme is switched on.

   It used to write six images, for three schemes × two themes. There is one
   design system now and two themes of it, so there are two.

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

  /* ONE ATTRIBUTE. There is no scheme to set and no class to sweep — the
     theme class the library used to select on went with the library. */
  const paint = (theme) =>
    page.evaluate((th) => {
      document.documentElement.setAttribute("data-theme", th);
      document.documentElement.classList.toggle("dark-mode", th === "dark");
      window.scrollTo(0, 0);
    }, theme);

  /* The directory is emptied first, so a renamed shot from an earlier system
     cannot sit beside the current ones pretending to be part of the set —
     which is how three schemes' worth of stale PNGs survived their removal. */
  for (const f of fs.readdirSync(OUT)) {
    if (f.endsWith(".png")) fs.unlinkSync(path.join(OUT, f));
  }

  const shots = [];
  const shoot = async (name, full) => {
    await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage: !!full });
    shots.push(name);
  };

  for (const theme of ["light", "dark"]) {
    await paint(theme);
    await wait(280);
    await shoot(theme, true);
  }

  /* THE LAYERS, which a full-page shot cannot reach. Each is photographed in
     BOTH themes rather than only the default, because elevation is the one
     thing the two themes solve differently: light carries it on a shadow,
     dark on the 1px inner sheen — and a sheen that is missing looks like
     nothing at all rather than like a bug. */
  for (const theme of ["light", "dark"]) {
    await paint(theme);
    await wait(200);
    await page.getByRole("button", { name: "Open modal" }).click();
    await wait(340);
    await shoot(theme + "-modal");
    await page.keyboard.press("Escape");
    await wait(240);
    await page.getByRole("button", { name: "Open drawer" }).click();
    await wait(380);
    await shoot(theme + "-drawer");
    await page.keyboard.press("Escape");
    await wait(240);
  }

  await browser.close();
  vite.kill();
  console.log("\nWrote " + shots.length + " images to " + OUT + ":\n  " + shots.join("\n  ") + "\n");
  process.exit(0);
})();
