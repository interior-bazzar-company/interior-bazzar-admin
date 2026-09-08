/* Ad-hoc: photograph the Deals chat list. Delete after review. */
const { spawn } = require("child_process");
const path = require("path"), fs = require("fs");
const { chromium } = require("playwright");
const PORT = 5231, APP = "http://localhost:" + PORT;
const OUT = path.join(process.cwd(), ".tmp", "comp");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const NAMES = ["Deploy Smoke Test", "Ashish vishwakarma", "Ahmed Raza Khan", "Sonu saifi",
  "VINOD KUMAR", "Jaswant_Kaul", "Ramzan Ali", "Priya Nair", "Aarav Pillai", "Rohit Desai",
  "Tanvi Bhandari", "Farah Qureshi"];
const STAGES = [1, 1, 2, 1, 3, 1, 2, 4, 5, 1, 2, 6];
const KEYS = ["new", "followup", "slot", "installment", "won", "lost"];
const deals = NAMES.map((n, i) => {
  const k = KEYS[STAGES[i] - 1];
  const tone = { new: "", followup: "warn", slot: "info", installment: "info", won: "ok", lost: "dead" }[k];
  const ago = (d) => new Date(Date.now() - d * 86400000).toISOString();
  return {
    id: 1040 + i, ref: "IB-D-" + (1040 + i), contactName: n, businessName: "",
    email: "", phone: "+91 90000 0000" + (i % 10), city: "Pune", state: "MH",
    interestedIn: "", query: "",
    stageKey: k, stageLabel: { new: "New", followup: "Followup", slot: "Slot Booked",
      installment: "Installment", won: "Won", lost: "Lost" }[k], stageTone: tone,
    stageSince: ago(i), priorityKey: "normal", priorityLabel: "Normal",
    valuePaise: i % 3 === 0 ? null : (1200000 + i * 470000),
    owner: { id: 1, name: "A. Rao" }, coOwner: null,
    nextActionDate: null, nextActionNote: "", expectedClose: null,
    tags: i % 2 ? ["generic-funnel"] : [], isStalled: false,
    createdAt: ago(i), updatedAt: ago(i), lastRemarkAt: ago(i),
  };
});

const ME = { data: {
  role: "Admin", roles: ["Admin"], isFullAccess: true, gateOk: true,
  user: { id: 1, username: "admin", name: "Asha Rao", email: "a@b.in", initials: "AR" },
  modules: [{ key: "deals", label: "Deals", groupLabel: "Sales", displayOrder: 1,
    actions: ["view", "edit", "create", "delete"] }],
  actionLevels: {} }, message: "ok" };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const viteBin = path.join(path.dirname(require.resolve("vite/package.json")), "bin", "vite.js");
  const vite = spawn(process.execPath, [viteBin, "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) { await wait(500); try { up = (await fetch(APP + "/")).ok; } catch {} }
  if (!up) { vite.kill(); process.exit(1); }
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 940 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { try { localStorage.setItem("accessToken", "t"); } catch {} });
  const env = fs.readFileSync(".env", "utf8");
  const API = new URL(/^VITE_BASE_URL=(.+)$/m.exec(env)[1].trim()).origin;
  const json = (r, b) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
  await ctx.route(API + "/**", (r) => json(r, { data: [], message: "ok" }));
  await ctx.route(API + "/**/deals/**", (r) => json(r, {
    data: {
      deals, total: deals.length, pageNo: 1, pageSize: 50,
      counts: { total: deals.length, byStage: {}, collectedPaise: 0, outstandingPaise: 0 },
      stages: [
        { key: "new", label: "New", tone: "" },
        { key: "followup", label: "Followup", tone: "warn" },
        { key: "slot", label: "Slot Booked", tone: "info" },
        { key: "installment", label: "Installment", tone: "info" },
        { key: "won", label: "Won", tone: "ok" },
        { key: "lost", label: "Lost", tone: "dead" },
      ],
      priorities: [{ key: "normal", label: "Normal", value: 1 }],
      tags: [{ slug: "generic-funnel", label: "Generic funnel", tone: "" }],
    },
    message: "ok" }));
  await ctx.route(API + "/**/deals/IB-D-*/**", (r) => json(r, { data: { deal: deals[0], transitions: [], remarks: [] }, message: "ok" }));
  await ctx.route(API + "/**/me/permissions**", (r) => json(r, ME));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("ERR", e.message));
  for (const theme of ["light", "dark"]) {
    await page.goto(APP + "/deals?view=chat", { waitUntil: "networkidle" });
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
    await wait(900);
    const row = page.locator(".dws-row").first();
    if (await row.count()) { await row.click(); await wait(1200); }
    const comp = page.locator(".dws-composer").first();
    if (await comp.count()) {
      await comp.screenshot({ path: path.join(OUT, theme + "-composer.png") });
      await page.locator("#dwsComposerText").click();
      await wait(400);
      await comp.screenshot({ path: path.join(OUT, theme + "-composer-focus.png") });
      const wa = page.locator(".dws-chanbtn.wa").first();
      if (await wa.count()) { await wa.click(); await wait(400); await comp.screenshot({ path: path.join(OUT, theme + "-composer-wa.png") }); }
    } else { await page.screenshot({ path: path.join(OUT, theme + "-full.png") }); }
  }
  await browser.close(); vite.kill(); console.log("done"); process.exit(0);
})();
