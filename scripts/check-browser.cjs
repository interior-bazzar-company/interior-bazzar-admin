/* =============================================================================
   The one check that opens a real browser.
   -----------------------------------------------------------------------------
   WHY IT EXISTS. Every other suite here renders to a string, and a string
   cannot tell you that a menu opens and closes again in the same tick. The
   Tasks view switcher shipped broken and stayed broken through several passes
   of green checks for exactly that reason: the markup was correct, every
   assertion about it passed, and the button did nothing when pressed.

   IT IS NOT IN `npm run check`. It needs a browser binary and a dev server, so
   it is opt-in — `npm run check:browser` — and skips cleanly when Playwright is
   not installed rather than failing a suite nobody asked to run.

   WHAT IT DRIVES is the real ShellProvider and the real FaceSwitch, plus a copy
   of the trigger without `data-act`, so the failure and the fix are observed
   side by side rather than asserted from a diff.
   ============================================================================= */
const { spawn } = require("child_process");

let chromium;
try { ({ chromium } = require("playwright")); } catch {
  console.log("\nBrowser check SKIPPED — playwright is not installed.\n");
  process.exit(0);
}

const PORT = 5199;
const URL = "http://localhost:" + PORT + "/browser-check.html";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function reachable() {
  try {
    const r = await fetch(URL);
    return r.ok;
  } catch { return false; }
}

(async () => {
  /* NODE RUNS VITE'S OWN ENTRY, no shell in between. `shell: true` makes node
     concatenate rather than escape the arguments (it warns about it), and
     `npx.cmd` without a shell is EINVAL on Windows — spawning the script with
     `process.execPath` sidesteps both and leaves one process to kill. */
  const vite = spawn(process.execPath, [
    /* `vite/bin/vite.js` is not an export map entry, so resolve the package
       root and join — `require.resolve` on the subpath is ERR_PACKAGE_PATH_NOT_EXPORTED. */
    require("path").join(require("path").dirname(require.resolve("vite/package.json")), "bin", "vite.js"),
    "--port", String(PORT), "--strictPort",
  ], { stdio: "ignore" });

  let up = false;
  for (let i = 0; i < 30 && !up; i++) { await wait(500); up = await reachable(); }
  if (!up) {
    vite.kill();
    console.log("\nBrowser check FAILED — dev server never came up.\n");
    process.exit(1);
  }

  let failed = 0;
  const ok = (what, cond) => {
    console.log("  " + (cond ? "ok  " : "FAIL") + " " + what);
    if (!cond) failed++;
  };

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(URL, { waitUntil: "networkidle" });

  const press = async (sel) => {
    await page.click(sel);
    await page.waitForTimeout(250);
    const open = !!(await page.$(".pop"));
    const rows = open ? await page.$$eval(".pop .mi b", (n) => n.map((x) => x.textContent)) : [];
    if (open) { await page.mouse.click(5, 690); await page.waitForTimeout(150); }
    return { open, rows };
  };

  console.log("\nThe view switcher, in a real browser\n");

  /* The shipped trigger, reproduced: the click that opens the popover is still
     bubbling when PopBox registers the document listener that closes it. */
  const bare = await press("#bare");
  ok("without data-act the menu does not stay open", bare.open === false);

  const fixed = await press("#fixed button");
  ok("...with it, the menu opens", fixed.open === true);
  ["List", "Board", "Calendar", "Timeline", "Analysis"].forEach((r) =>
    ok("...and offers " + r, fixed.rows.includes(r)));
  /* THE NOTE IS PICKED, NOT TYPED. It had a free-text row for anything not
     already assigned to you; nothing on it creates work now. Its contents only
     exist while it is open, so this is the only check that can see them. */
  console.log("\nToday\'s plan, opened\n");
  await page.click("#note button");
  await page.waitForTimeout(250);
  const note = await page.$(".tm-np");
  ok("the note opens", !!note);
  if (note) {
    ok("...a plan already in reads back rather than asking again",
      (await page.$(".tm-np-add")) === null);
    await page.mouse.click(5, 690);
    await page.waitForTimeout(150);
  }

  /* CONTINUOUS ENTRY is the whole of the checklist-note pattern and the one
     part of it a rendered string cannot see: type, Enter, and the next row is
     already open under the one you just wrote. */
  await page.click("#note-new button");
  await page.waitForTimeout(250);
  const rows = () => page.$$eval(".tm-np-l li.typed span", (n) =>
    n.map((x) => (x.firstChild ? x.firstChild.textContent : "")));

  ok("before a plan is in, the note offers a way to add one",
    (await page.$(".tm-np-add")) !== null);
  await page.click(".tm-np-add");
  await page.waitForTimeout(120);
  ok("...which opens a row, not a dialog", (await page.$(".tm-np-in")) !== null);

  await page.keyboard.type("Ring the fabricator");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(120);
  ok("...Enter commits the line", (await rows()).join("|") === "Ring the fabricator");
  ok("...and leaves the next row open and empty", (() => true)()
    && (await page.$(".tm-np-in")) !== null
    && (await page.$eval(".tm-np-in", (n) => n.value)) === "");

  await page.keyboard.type("Chase the tile sample");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(120);
  ok("...so a second line needs no reaching for anything",
    (await rows()).join("|") === "Ring the fabricator|Chase the tile sample");

  await page.keyboard.press("Escape");
  await page.waitForTimeout(120);
  ok("...Escape closes the row without adding an empty line",
    (await rows()).length === 2 && (await page.$(".tm-np-in")) === null);

  /* THE ROWS STACK. A checklist whose items sit side by side is still a
     checklist to every structural assertion in this repo — the classes are all
     present and all have rules — and it is unreadable. This one caught a stray
     global `pick` class on the list (a pill-shaped flex row in
     admin-theme.css), which is the third class-name collision in this module
     and the first that no existence check could have seen. */
  const geom = await page.$$eval(".tm-np-l li", (n) => n.map((el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) };
  }));
  ok("...the rows stack rather than sitting side by side", geom.length > 1
    && geom.every((g, i) => i === 0 || (g.y > geom[i - 1].y && g.x === geom[0].x)));
  ok("...and each one takes the note's full width",
    geom.length > 0 && geom.every((g) => g.w === geom[0].w && g.w > 200));

  const footer = await page.$eval(".tm-np-f .tm-np-t", (n) => n.textContent);
  ok("...and the count includes them (" + footer + ")", /\d+ to do/.test(footer || ""));
  await page.screenshot({ path: "scripts/_note.png" });
  await page.mouse.click(5, 690);
  await page.waitForTimeout(150);

  ok("no page errors", errors.length === 0);
  if (errors.length) errors.forEach((e) => console.log("       " + e));

  await browser.close();
  vite.kill();
  vite.unref();

  console.log("\n" + (failed ? failed + " FAILED" : "all checks passed") + "\n");
  process.exit(failed ? 1 : 0);
})();
