/* =============================================================================
   THE OVERVIEW, PHOTOGRAPHED — with a pipeline in it.
   -----------------------------------------------------------------------------
   shoot-modules.cjs photographs every route against an EMPTY deals API, which
   is the right state to look at for a list page and the wrong one for a
   command centre: an overview of nothing is a page of dashes. This boots the
   same real shell against the same mocked session, but answers the deals
   list with fourteen deals shaped exactly as the API sends them — every stage,
   valued and unvalued, stalled, late, closing soon — and the enquiry counts
   with two integers. Finance and Team read their own seeds, as they do live.

   Four shots: desktop light, desktop dark, tablet (1024) and phone (390), the
   last two in light. Full page, so the whole reading order is in one image.

   `node scripts/shoot-overview.cjs`. Output goes to .tmp/overview/, git-ignored.
   ============================================================================= */
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

let chromium;
try { ({ chromium } = require("playwright")); } catch {
  console.log("\nOverview shots SKIPPED — playwright is not installed.\n");
  process.exit(0);
}

const PORT = 5223;
const APP = "http://localhost:" + PORT;
const OUT = path.join(process.cwd(), ".tmp", "overview");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const SERVER = [
  ["deals", "Deals", "Sales"], ["quotations", "Quotations", "Sales"], ["invoices", "Invoices", "Sales"],
  ["business-enquiries", "Business Enquiries", "Sales"], ["plans", "Plans", "Catalogue"],
  ["team", "Members", "Settings"], ["roles", "Roles", "Settings"], ["audit", "Audit", "Settings"],
];
const ME = {
  data: {
    role: "Admin", roles: ["Admin"], isFullAccess: true, gateOk: true,
    user: { id: 1, username: "asha", name: "Asha Rao", email: "asha@interiorbazzar.com", initials: "AR" },
    modules: SERVER.map(([key, label, groupLabel], i) => ({
      key, label, groupLabel, displayOrder: i + 1,
      actions: ["view", "edit", "create", "delete", "approve", "export", "close"],
    })),
    actionLevels: {},
  },
  message: "ok",
};

/* ---- the deals fixture, dated relative to the real clock ------------------ */
const iso = (d) => d.toISOString().slice(0, 10) + "T00:00:00Z";
const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const ahead = (n) => ago(-n);
const STAGES = [
  ["new", "New", "", "Fresh lead"], ["followup", "Followup", "warn", "Interested conversation"],
  ["slot", "Slot Booked", "info", "Paid slot registration amount"], ["installment", "Installment", "info", "Paying the plan down"],
  ["won", "Won", "ok", "Paid in full"], ["lost", "Lost", "dead", "Denied"],
];
const stage = (k) => { const s = STAGES.find((x) => x[0] === k); return { stageKey: s[0], stageLabel: s[1], stageTone: s[2] }; };
const ASHA = { id: 1, name: "Asha Rao", username: "asha" };
const RAHUL = { id: 70, name: "Rahul Menon", username: "rahul" };
const PRIYA = { id: 74, name: "Priya Iyer", username: "priya" };
const L = (n) => Math.round(n * 100000 * 100);
let n = 2600;
const deal = (o) => {
  n += 1;
  const value = o.value === undefined ? null : L(o.value);
  const collected = o.collected ? L(o.collected) : 0;
  return {
    id: n, ref: "DL-" + n, contactName: o.who, businessName: o.biz || "", email: "", phone: "98765 43210",
    city: o.city || "Bengaluru", state: "Karnataka", interestedIn: o.in || "Modular kitchen", query: "",
    ...stage(o.stage), stageSince: ago(o.since), priorityKey: o.pri || "normal", priorityLabel: o.pri === "urgent" ? "Urgent" : o.pri === "high" ? "High" : "Normal",
    valuePaise: value, owner: o.owner === null ? null : (o.owner || ASHA), coOwner: null,
    nextActionDate: o.next === undefined ? null : (o.next < 0 ? ago(-o.next) : ahead(o.next)), nextActionNote: "",
    expectedClose: o.close === undefined ? null : (o.close < 0 ? ago(-o.close) : ahead(o.close)),
    enquiryRef: "", stalled: !!o.stalled, lostReason: o.lost || "", tags: [],
    createdAt: ago(o.created), updatedAt: ago(Math.min(o.since, 1)),
    quotationStatus: "none", invoiceStatus: o.paid ? "paid" : "none", paid: !!o.paid,
    collectedPaise: collected, outstandingPaise: value === null ? 0 : Math.max(0, value - collected),
  };
};
const DEALS = [
  deal({ who: "Meera Joshi", biz: "Joshi Homes", stage: "followup", value: 4.8, since: 12, created: 30, stalled: true, next: -3, close: 20, pri: "high" }),
  deal({ who: "Karan Mehta", stage: "new", value: 1.2, owner: RAHUL, since: 2, created: 2 }),
  deal({ who: "Priya Nair", biz: "Nair Interiors", stage: "slot", value: 6.5, since: 10, created: 25, close: 8, next: 2, in: "Full home" }),
  deal({ who: "Suresh Iyer", stage: "installment", value: 3.2, owner: RAHUL, since: 40, created: 60, collected: 1.6, close: -5 }),
  deal({ who: "Anita Desai", stage: "won", value: 2.4, since: 6, created: 45, collected: 2.4, paid: true }),
  deal({ who: "Vikram Shah", biz: "Shah Builders", stage: "won", value: 5.6, owner: RAHUL, since: 18, created: 50, collected: 5.6, paid: true, in: "Office fit-out" }),
  deal({ who: "Neha Kapoor", stage: "won", value: 1.8, since: 40, created: 70, collected: 1.8, paid: true }),
  deal({ who: "Rohan Verma", stage: "lost", value: 2.0, owner: RAHUL, since: 9, created: 35, lost: "Budget" }),
  deal({ who: "Deepa Rao", stage: "lost", since: 35, created: 55, lost: "Went elsewhere" }),
  deal({ who: "Farhan Ali", biz: "FA Studio", stage: "new", owner: null, since: 1, created: 1 }),
  deal({ who: "Lakshmi Pillai", stage: "followup", value: 9.2, owner: PRIYA, since: 15, created: 20, next: -6, close: 12, pri: "urgent", in: "Villa interiors", city: "Chennai" }),
  deal({ who: "Arjun Reddy", biz: "Reddy Ventures", stage: "slot", value: 2.75, owner: PRIYA, since: 3, created: 8, close: 25 }),
  deal({ who: "Sneha Gupta", stage: "installment", value: 4.0, owner: RAHUL, since: 55, created: 90, collected: 2.0, close: 5 }),
  deal({ who: "Manish Jain", stage: "new", value: 0.95, since: 5, created: 5, next: 1 }),
];
const byStage = {};
DEALS.forEach((d) => { byStage[d.stageKey] = (byStage[d.stageKey] || 0) + 1; });
const DEALS_RESPONSE = {
  data: {
    deals: DEALS, total: DEALS.length, pageNo: 1, pageSize: 500,
    counts: {
      total: DEALS.length, byStage,
      collectedPaise: DEALS.reduce((a, d) => a + d.collectedPaise, 0),
      outstandingPaise: DEALS.reduce((a, d) => a + d.outstandingPaise, 0),
    },
    stages: STAGES.map(([key, label, tone, hint], i) => ({ key, label, tone, hint, displayOrder: i + 1, isTerminal: i >= 4 })),
    priorities: [{ key: "normal", label: "Normal", displayOrder: 1 }, { key: "high", label: "High", displayOrder: 2 }, { key: "urgent", label: "Urgent", displayOrder: 3 }],
    tags: [],
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

  const API = (() => {
    const env = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
    const m = /^VITE_BASE_URL=(.+)$/m.exec(env);
    return m ? new URL(m[1].trim()).origin : "https://dev.interiorbazzar.com";
  })();
  const json = (r, body) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

  const browser = await chromium.launch();
  const errors = [];
  /* THE PAGE SCROLLS INSIDE `.scroller`, NOT THE DOCUMENT, so `fullPage` sees
     one screen. A viewport as tall as the page is the honest workaround: the
     shot is the whole reading order, top to bottom. */
  const shots = [
    { name: "desktop-light", theme: "light", width: 1440, height: 3800 },
    { name: "desktop-dark", theme: "dark", width: 1440, height: 3800 },
    { name: "tablet-light", theme: "light", width: 1024, height: 4600 },
    { name: "phone-light", theme: "light", width: 390, height: 7200 },
    /* The top of the phone page at a legible scale: the header, the filter
       row and the first section head are where a phone layout goes wrong. */
    { name: "phone-top", theme: "light", width: 390, height: 1300 },
  ];
  /* The Team seed wears the live roster's faces — adopt.ts re-keys its eight
     slots onto whoever GET /admin/users/ returns, and an EMPTY list leaves the
     signed-in user alone on the roster. Eight people, so the team reads as one. */
  const USERS = {
    data: [
      { id: 41, name: "Vishal Shakya", email: "vishal@interiorbazzar.com", username: "vishal", isSuperAdmin: true },
      { id: 52, name: "Aditi Sharma", email: "aditi@interiorbazzar.com", username: "aditi" },
      { id: 86, name: "Nikhil Pillai", email: "nikhil@interiorbazzar.com", username: "nikhil" },
      { id: 63, name: "Meera Nair", email: "meera@interiorbazzar.com", username: "meera" },
      { id: 70, name: "Rahul Menon", email: "rahul@interiorbazzar.com", username: "rahul" },
      { id: 74, name: "Priya Iyer", email: "priya@interiorbazzar.com", username: "priya" },
      { id: 79, name: "S. Raghavan", email: "raghavan@interiorbazzar.com", username: "raghavan" },
    ],
    message: "ok",
  };
  for (const s of shots) {
    const ctx = await browser.newContext({ viewport: { width: s.width, height: s.height } });
    await ctx.addInitScript((t) => {
      try { localStorage.setItem("accessToken", "test-token"); localStorage.setItem("ib_admin_theme", JSON.stringify(t)); } catch { /* private mode */ }
    }, s.theme);
    await ctx.route(API + "/**", (r) => json(r, { data: [], message: "ok" }));
    await ctx.route((u) => /\/business-enquiries\/?\?/.test(u.href), (r) => {
      const u = new URL(r.request().url());
      const received = u.searchParams.get("received");
      const total = received === "today" ? 3 : received === "7d" ? 11 : 0;
      return json(r, { data: { enquiries: [], total, pageNo: 1, pageSize: 1, counts: null }, message: "ok" });
    });
    await ctx.route((u) => /\/deals\/?(\?|$)/.test(u.href), (r) => json(r, DEALS_RESPONSE));
    await ctx.route((u) => /\/users\/?(\?|$)/.test(u.href), (r) => json(r, USERS));
    await ctx.route(API + "/**/me/permissions**", (r) => json(r, ME));

    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(s.name + ": " + e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(s.name + " console: " + m.text().slice(0, 200)); });
    await page.goto(APP + "/overview", { waitUntil: "networkidle" });
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), s.theme);
    await wait(900);
    const state = await page.evaluate(() => {
      const root = document.getElementById("root");
      const html = root ? root.innerHTML : "";
      if (html.indexOf("Something went wrong") >= 0) return "ERROR";
      if (document.querySelector(".spinner,.pane-load")) return "loading";
      const bad = ["NaN", "undefined", "Infinity", "null%"].filter((w) => html.indexOf(w) >= 0);
      return bad.length ? "LEAK " + bad.join(",") : "ok";
    });
    console.log("  " + s.name.padEnd(14) + state);
    await page.screenshot({ path: path.join(OUT, s.name + ".png"), fullPage: true });
    await ctx.close();
  }
  await browser.close();
  vite.kill();
  if (errors.length) {
    console.log("\nPAGE ERRORS (" + errors.length + "):");
    for (const e of Array.from(new Set(errors)).slice(0, 20)) console.log("  " + e);
  }
  console.log("\nWrote " + shots.length + " images to " + OUT + "\n");
  process.exit(errors.length ? 1 : 0);
})();
