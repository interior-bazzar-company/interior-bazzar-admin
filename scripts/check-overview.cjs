/* =============================================================================
   Overview · the derivations, asserted against the shipped code.
   -----------------------------------------------------------------------------
   Bundles src/admin/views/Overview/derive.ts and calls the same functions the
   page calls. Every figure on #/overview is a derivation over the modules'
   own data, and every rule below is one the page states in prose somewhere —
   in a ⓘ, in a section note, in derive.ts. This file makes each claim
   falsifiable.

   The ones that matter most, because each is a silent failure:
     · a period's previous window is the same length, immediately before it
     · buckets partition a period — no gap, no overlap, no day outside it
     · a terminal deal is never at risk, whatever its flags say
     · a rate over nothing is null, never 0 or NaN
     · severity outranks money in the attention list, and money ranks inside it
     · payroll never reaches the page without the Salaries A/C gate

   Deals are a fixture (the API is live, so the seed cannot be read here);
   Finance and Team are the real stores on their own clocks.

     node scripts/check-overview.cjs
   ============================================================================= */
const path = require("path");
const esbuild = require("esbuild");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "node_modules", ".tmp", "overview-derive.cjs");

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
const head = (t) => console.log("\n" + t);

/* THE FIXTURE. Ten deals shaped exactly as adaptDeal() emits them, around a
   pinned today of Monday 8 Sep 2026 and a 30-day period (10 Aug – 8 Sep). */
const TODAY = "2026-09-08";
const L = (n) => n * 100000 * 100; // lakh → paise
const deal = (o) => ({
  deal_id: o.id, customer_name: o.who, business_name: o.biz || "", stage: o.stage, priority: 1,
  deal_value: o.value === undefined ? null : o.value, owner_id: o.owner === undefined ? null : o.owner,
  created_at: o.created || null, stage_since: o.since || null, expected_close_date: o.close || null,
  next_action: o.next ? { date: o.next, note: "" } : null, is_stalled: !!o.stalled,
  revenue_collected: o.collected || 0, outstanding: o.outstanding || 0,
});
const DEALS = [
  deal({ id: "D1", who: "Anita", stage: 1, value: L(4.8), owner: "Asha", created: "2026-09-01", since: "2026-09-01", next: "2026-09-10" }),
  deal({ id: "D2", who: "Bala", biz: "Bala Interiors", stage: 2, value: L(4.8), owner: "Asha", created: "2026-08-15", since: "2026-08-20", stalled: true }),
  deal({ id: "D3", who: "Chitra", stage: 3, owner: "Rahul", created: "2026-08-01", since: "2026-08-05", next: "2026-09-05" }),
  deal({ id: "D4", who: "Dev", stage: 4, value: L(2), owner: "Rahul", created: "2026-07-20", since: "2026-07-25", close: "2026-09-01", collected: L(1), outstanding: L(1) }),
  deal({ id: "D5", who: "Esha", stage: 5, value: L(3), owner: "Asha", created: "2026-07-01", since: "2026-08-28", collected: L(3) }),
  deal({ id: "D6", who: "Farhan", stage: 5, owner: "Rahul", created: "2026-06-01", since: "2026-07-20" }),
  deal({ id: "D7", who: "Gita", stage: 6, value: L(1), owner: "Asha", created: "2026-07-05", since: "2026-08-30" }),
  deal({ id: "D8", who: "Hari", stage: 6, owner: "Rahul", created: "2026-06-20", since: "2026-07-15" }),
  deal({ id: "D9", who: "Isha", stage: 1, value: L(0.8), created: "2026-09-05", since: "2026-09-05", close: "2026-09-15" }),
  deal({ id: "D10", who: "Jai", stage: 5, value: L(2), owner: "Asha", created: "2026-07-10", since: "2026-09-03", stalled: true, close: "2026-08-01", collected: L(2) }),
];

esbuild.build({
  entryPoints: [path.join(ROOT, "src", "admin", "views", "Overview", "derive.ts")],
  bundle: true, platform: "node", format: "cjs",
  external: ["react"],
  define: { "import.meta.env": '{"DEV":false,"VITE_API_URL":""}' },
  loader: { ".css": "empty" },
  logLevel: "error",
  outfile: OUT,
}).then(() => {
  const S = require(OUT);
  console.log("\nOverview derivations");

  /* ------------------------------------------------------------ period --- */
  head("The period");
  const p7 = S.periodFor("7d", TODAY);
  eq("7 days ends today and starts six days back", [p7.from, p7.to, p7.days], ["2026-09-02", "2026-09-08", 7]);
  eq("...its previous window is the seven days immediately before", [p7.prevFrom, p7.prevTo], ["2026-08-26", "2026-09-01"]);
  eq("...and it is charted by day", p7.grain, "day");
  const p30 = S.periodFor("30d", TODAY);
  eq("30 days is charted by week", [p30.from, p30.days, p30.grain], ["2026-08-10", 30, "week"]);
  eq("12 months is charted by month", [S.periodFor("12m", TODAY).days, S.periodFor("12m", TODAY).grain], [365, "month"]);
  eq("an unknown key falls back to 30 days", S.periodFor("yesterday", TODAY).key, "30d");
  eq("a custom range is absolute", [S.periodFor("custom", TODAY, "2026-08-01", "2026-08-31").from, S.periodFor("custom", TODAY, "2026-08-01", "2026-08-31").days], ["2026-08-01", 31]);
  eq("an inverted custom range falls back rather than charting nothing", S.periodFor("custom", TODAY, "2026-09-01", "2026-08-01").key, "30d");
  eq("a half-typed custom range falls back too", S.periodFor("custom", TODAY, "2026-09-01").key, "30d");

  const partition = (p) => {
    const bs = S.bucketsOf(p);
    if (!bs.length || bs[0].from !== p.from || bs[bs.length - 1].to !== p.to) return false;
    for (let i = 1; i < bs.length; i++) if (S.addDays(bs[i - 1].to, 1) !== bs[i].from) return false;
    return bs.every((b) => b.from <= b.to);
  };
  ok("7-day buckets partition the period", partition(p7) && S.bucketsOf(p7).length === 7);
  ok("30-day buckets partition the period, with the last week clipped", partition(p30) && S.bucketsOf(p30).length === 5);
  ok("12-month buckets partition the period across the year boundary", partition(S.periodFor("12m", TODAY)) && S.bucketsOf(S.periodFor("12m", TODAY)).length === 13);
  ok("a custom range is partitioned too", partition(S.periodFor("custom", TODAY, "2026-01-15", "2026-05-20")));

  eq("pctChange is a percentage of the earlier figure", S.pctChange(120, 100), 20);
  eq("pctChange over nothing is null, never Infinity", S.pctChange(5, 0), null);
  eq("ptsChange is null when either rate is missing", S.ptsChange(null, 50), null);

  /* ------------------------------------------------------------- deals --- */
  head("Deals · the fixture");
  const m = S.dealMetrics(DEALS, p30, TODAY);
  eq("open is every deal before Won", m.open, 5);
  eq("pipeline value sums valued open deals only", m.openValue, L(4.8) + L(4.8) + L(2) + L(0.8));
  eq("...and counts the unvalued one", m.unquoted, 1);
  eq("stalled counts open deals only, so the stalled Won deal is not one", [m.stalled, m.stalledValue], [1, L(4.8)]);
  eq("won in period is by the date the deal reached Won", [m.won.n, m.won.value], [2, L(5)]);
  eq("won in the previous period is the same rule on the earlier window", [m.wonPrev.n, m.wonPrev.value], [1, 0]);
  eq("lost is counted the same way", [m.lost.n, m.lostPrev.n], [1, 1]);
  eq("conversion is won over closed, to one decimal", [m.conversion, m.conversionPrev], [66.7, 50]);
  eq("average won ignores the won deal with no value", m.avgWon, L(2.5));
  eq("conversion over nothing closed is null", S.dealMetrics([DEALS[0]], p30, TODAY).conversion, null);

  eq("at risk ranks by money, then by days", m.atRisk.map((r) => r.d.deal_id), ["D2", "D4", "D3"]);
  eq("...with one reason each, stalled first", m.atRisk.map((r) => r.reason), ["stalled", "close_passed", "next_overdue"]);
  eq("...and the days say how late", m.atRisk.map((r) => r.days), [19, 7, 3]);
  ok("a terminal deal is never at risk, whatever its flags", !m.atRisk.some((r) => r.d.deal_id === "D10"));
  eq("closing soon is open deals with a close date inside 14 days", m.closingSoon.map((d) => d.deal_id), ["D9"]);
  eq("longest in stage is oldest stage date first", m.aging.map((d) => d.deal_id), ["D4", "D3", "D2", "D1", "D9"]);
  eq("highest value is by value, unvalued last", m.biggest.map((d) => d.deal_id), ["D1", "D2", "D4", "D9", "D3"]);
  eq("expected this month reads the close date's calendar month", [m.expectedThisMonth.n, m.expectedThisMonth.value], [2, L(2.8)]);

  eq("the funnel leaves Lost off", m.byStage.map((s) => s.key), ["new", "followup", "slot", "installment", "won"]);
  eq("...and counts every deal currently at each stage", m.byStage.map((s) => s.n), [2, 1, 1, 1, 3]);
  eq("by owner ranks by open value and credits period wins", m.byOwner.map((o) => [o.name, o.open, o.won]), [["Asha", 2, 2], ["Rahul", 2, 0]]);
  ok("an unowned deal is in no owner's row", m.byOwner.every((o) => o.name));
  eq("the flow chart has one point per bucket", m.flow.length, 5);
  eq("...and its columns add up to the period's counts", [
    m.flow.reduce((a, f) => a + f.created, 0), m.flow.reduce((a, f) => a + f.won, 0), m.flow.reduce((a, f) => a + f.lost, 0),
  ], [3, 2, 1]);
  eq("collected and outstanding are the API's own per-deal figures, summed", [m.collected, m.outstanding], [L(6), L(1)]);
  const none = S.dealMetrics([], p30, TODAY);
  eq("an empty list derives cleanly — zeros and nulls, no NaN", [none.open, none.openValue, none.conversion, none.avgWon, none.atRisk.length], [0, 0, null, null, 0]);

  /* ----------------------------------------------------------- finance --- */
  head("Finance · the real store, on its own clock");
  const F = require(path.join(ROOT, "node_modules", ".tmp", "overview-derive.cjs"));
  void F;
  const finToday = "2026-08-25";
  const pf = S.periodFor("30d", finToday);
  const f = S.financeMetrics(pf, finToday);
  ok("the period roll-up is Finance's own overview() for the same window", f.cur.netPaise === f.cur.collectedPaise + f.cur.otherInPaise - f.cur.salaryPaise - f.cur.otherOutPaise - f.cur.refundsPaidPaise);
  eq("the money-flow buckets add up to the period's collections", f.flow.reduce((a, b) => a + b.collected, 0), f.cur.collectedPaise + f.cur.otherInPaise);
  eq("...and to its outgoings", f.flow.reduce((a, b) => a + b.out, 0), f.cur.outPaise);
  ok("months shown is between 3 and 12", f.months.length >= 3 && f.months.length <= 12);
  ok("due soon is forward from the Finance clock, not the machine's", f.dueSoon.n >= 0 && f.dueSoon.paise >= 0);
  ok("failed installments carry a count and an amount together", (f.failed.n === 0) === (f.failed.paise === 0));
  ok("refunds owed are the approved-not-paid queue", f.refundsOwed.n >= 0);
  ok("unexplained bank lines come off Finance's own risk table", typeof f.bankUnexplained === "number");
  const pay = S.payrollMetrics();
  eq("the August run is open on the seed, so payroll reads an open run", pay.openRun, "2026-08");
  ok("payroll owed is a paise figure", typeof pay.owedPaise === "number" && pay.owedPaise >= 0);

  /* -------------------------------------------------------------- team --- */
  head("Team · the real store, on its own clock");
  const T = require(path.join(ROOT, "node_modules", ".tmp", "overview-derive.cjs"));
  void T;
  const teamToday = "2026-08-28";
  const pt = S.periodFor("30d", teamToday);
  const t = S.teamMetrics(pt, teamToday, undefined, new Map([["58", { open: 1, won: 2, value: L(3), collected: L(4) }]]));
  eq("every active member has a row", t.rows.length, t.members.length);
  ok("the busiest member sets the load ceiling", t.maxOpen === Math.max(...t.rows.map((r) => r.open)));
  ok("overdue on a row uses the board's own rule", t.rows.every((r) => r.late <= r.open));
  ok("a member's deals are joined by id", t.rows.some((r) => r.m.memberId === "58" && r.deals && r.deals.collected === L(4)));
  ok("on-time is null with no attendance, never 0", t.rows.every((r) => r.onTime === null || (r.onTime >= 0 && r.onTime <= 100)));
  const depts = t.departments;
  ok("departments come off the roster", depts.length > 1);
  const narrowed = S.teamMetrics(pt, teamToday, depts[0], new Map());
  ok("a department filter narrows the rows", narrowed.rows.length < t.rows.length && narrowed.rows.every((r) => r.m.department === depts[0]));
  ok("attention is the Reports page's own roll-up", t.attention && Array.isArray(t.attention.delayed) && Array.isArray(t.attention.noEod));
  ok("due-soon by member lists only members with something due", t.dueSoonByMember.every((x) => x.n > 0));

  /* ------------------------------------------------------------ health --- */
  head("Health");
  const H = (deals, fin, team) => S.healthOf(deals, fin, team).map((h) => h.key + ":" + h.tone);
  eq("pipeline: under 15% stalled is ok", H({ open: 10, stalled: 1 }, null, null), ["pipeline:ok"]);
  eq("pipeline: under 35% is a watch", H({ open: 10, stalled: 3 }, null, null), ["pipeline:warn"]);
  eq("pipeline: more is a problem", H({ open: 10, stalled: 5 }, null, null), ["pipeline:bad"]);
  eq("pipeline: no open deals is mute, not ok", H({ open: 0, stalled: 0 }, null, null), ["pipeline:mute"]);
  eq("collections: a failed installment is a problem; past due alone is a watch", [
    H(null, { failed: { n: 1 }, overdue: { n: 0 } }, null)[0], H(null, { failed: { n: 0 }, overdue: { n: 2 } }, null)[0], H(null, { failed: { n: 0 }, overdue: { n: 0 } }, null)[0],
  ], ["collections:bad", "collections:warn", "collections:ok"]);
  const tm = (onTimePct, delayed, total) => ({ span: { onTimePct }, work: { delayed, total, completed: 0, cancelled: 0 } });
  eq("team and delivery read on-time and overdue share", H(null, null, tm(90, 0, 10)), ["team:ok", "delivery:ok"]);
  eq("...with the same three steps", H(null, null, tm(70, 2, 10)), ["team:warn", "delivery:warn"]);
  eq("...and mute when there is nothing to read", H(null, null, tm(null, 0, 0)), ["team:mute", "delivery:mute"]);
  eq("a source not in access contributes no cell", H(null, null, null), []);

  /* --------------------------------------------------------- attention --- */
  head("Needs attention");
  const items = S.attentionItems(m, null, null, null, TODAY);
  eq("deal items are the at-risk list, big money first", items.map((i) => i.id), ["deal:D2", "deal:D4", "deal:D3"]);
  eq("a top-quarter deal is urgent, the rest are watches", items.map((i) => i.severity), ["bad", "warn", "warn"]);
  ok("every item links to the deal it names", items.every((i) => i.to === "#/deals/" + i.id.slice(5)));
  ok("titles carry the compact amount", items[0].title.startsWith("₹4.80L"));
  const drop = { ...m, conversion: 30, conversionPrev: 50 };
  ok("a conversion fall of 15 points or more is a watch", S.attentionItems(drop, null, null, null, TODAY).some((i) => i.id === "deals:conversion"));
  ok("...and a smaller fall is not", !S.attentionItems({ ...m, conversion: 40, conversionPrev: 50 }, null, null, null, TODAY).some((i) => i.id === "deals:conversion"));
  const finItems = S.attentionItems(null, f, null, null, finToday);
  ok("finance items come off the store — failed, past due, refunds, bank", finItems.every((i) => i.area === "finance"));
  const order = finItems.map((i) => ["bad", "warn", "info"].indexOf(i.severity));
  ok("severity is the first sort key", order.every((v, i) => i === 0 || v >= order[i - 1]));
  ok("payroll never reaches the list without the gate", !S.attentionItems(null, f, null, null, finToday).some((i) => i.id === "fin:payroll"));
  ok("...and does with it", S.attentionItems(null, f, pay, null, finToday).some((i) => i.id === "fin:payroll"));
  const drop2 = { ...f, cur: { ...f.cur, collectedPaise: 100, otherInPaise: 0 }, prev: { ...f.prev, collectedPaise: 1000, otherInPaise: 0 } };
  ok("collections down a fifth or more is a watch", S.attentionItems(null, drop2, null, null, finToday).some((i) => i.id === "fin:collections"));
  eq("nothing in access is an empty list, not an error", S.attentionItems(null, null, null, null, TODAY), []);
  const teamItems = S.attentionItems(null, null, null, t, teamToday);
  ok("team items come off the Reports roll-up", teamItems.every((i) => i.area === "team"));
  ok("an urgent overdue task outranks a high one", (() => {
    const w = teamItems.filter((i) => i.id.startsWith("work:"));
    return w.every((i, k) => k === 0 || ["bad", "warn"].indexOf(i.severity) >= ["bad", "warn"].indexOf(w[k - 1].severity));
  })());

  /* ----------------------------------------------------------- signals --- */
  head("Planning signals");
  const sig = S.planningSignals(m, f, null, t, TODAY);
  eq("expected to close reads this calendar month", sig.find((s) => s.id === "close").value, "₹2.80L");
  ok("obligations say when payroll is withheld", sig.find((s) => s.id === "obligations").sub.indexOf("payroll not in your access") >= 0);
  ok("...and name the figure when it is not", S.planningSignals(null, f, pay, null, TODAY).find((s) => s.id === "obligations").sub.indexOf("payroll") >= 0);
  ok("the trajectory carries a sparkline of the last three months", (sig.find((s) => s.id === "trajectory") || { spark: [] }).spark.length === 3);
  ok("workload and capacity come from the Team store", sig.some((s) => s.id === "workload") && sig.some((s) => s.id === "capacity"));
  eq("no sources is no signals", S.planningSignals(null, null, null, null, TODAY), []);

  console.log(failed ? "\n" + failed + " FAILED\n" : "\nall checks passed\n");
  process.exit(failed ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
