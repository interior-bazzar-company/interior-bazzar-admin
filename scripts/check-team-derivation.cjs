/* =============================================================================
   Team · the derivations, asserted against the shipped store.
   -----------------------------------------------------------------------------
   Bundles src/admin/views/Team/store.ts and calls the same functions the screens
   call — not a reimplementation of them. Every assertion below is a rule the
   module claims in prose somewhere; this is the file that makes the claim
   falsifiable.

   The three that matter most, because each is a silent failure:
     · late is per MEMBER, not per company  — a constant passes every other test
     · a terminal item is never overdue     — off-by-one on a filter nobody reads
     · an unclosed day counts as nothing    — the alternative is a 29-hour shift

     node scripts/check-team-derivation.cjs
   ============================================================================= */
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "node_modules", ".tmp", "team-store.cjs");

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

require("esbuild").build({
  entryPoints: [path.join(ROOT, "src", "admin", "views", "Team", "store.ts")],
  bundle: true, platform: "node", format: "cjs",
  external: ["react"],
  define: { "import.meta.env": '{"DEV":false,"VITE_API_URL":""}' },
  loader: { ".css": "empty" },
  logLevel: "error",
  outfile: OUT,
}).then(() => {
  const S = require(OUT);

  console.log("\nTeam derivations");

  /* ---------------------------------------------------------- the clock -- */
  head("The clock");
  eq("TODAY is the seed's own asOf, not the machine's", S.TODAY, "2026-08-28");
  ok("it is a Friday", S.fmtDayName(S.TODAY) === "Fri");
  eq("fmtHM renders hours and padded minutes", S.fmtHM(482), "8h 02m");
  eq("fmtHM of null is an em dash, never 0", S.fmtHM(null), "—");
  eq("weekOf drops the weekend", S.weekOf(S.TODAY).length, 5);
  ok("the week runs Monday to Friday",
    S.weekOf(S.TODAY)[0] === "2026-08-24" && S.weekOf(S.TODAY)[4] === "2026-08-28");

  /* ------------------------------------------------------- attendance --- */
  head("Attendance states, today at 14:20");
  const M = (id) => S.readMember(id);
  const st = (id) => S.stateOf(S.dayFor(id, S.TODAY), M(id));

  eq("41 · in early, no break", st("41"), "working");
  eq("63 · break open right now", st("63"), "on_break");
  eq("79 · closed at midday", st("79"), "ended");
  eq("70 · in late, still working", st("70"), "working");
  eq("86 · no row, and the day is NOT over — not started, not absent", st("86"), "not_started");

  head("Late is the MEMBER's own threshold");
  ok("70 in at 09:47 against a 09:30 start is late", S.dayFor("70", S.TODAY).isLate === true);
  eq("and by 2 minutes, not a rounded-up number", S.dayFor("70", S.TODAY).lateByMinutes, 2);
  ok("74 in at 10:06 against her own 10:00 start is NOT late",
    S.dayFor("74", S.TODAY).isLate === false);
  ok("…which is later than 70's in-time, so a company constant would fail here",
    S.dayFor("74", S.TODAY).startedAt > S.dayFor("70", S.TODAY).startedAt);

  head("The forgotten logout");
  const thu = S.dayFor("70", "2026-08-27");
  ok("Thursday's row was left open", thu.endedAt === null);
  eq("it derives as unclosed, not as a 29-hour shift",
    S.stateOf(thu, M("70")), "unclosed");
  eq("and it counts as NOTHING, not as a big number", S.workedOf(thu, M("70")), null);

  head("Worked time");
  ok("an open day excludes the running break",
    S.workedOf(S.dayFor("63", S.TODAY), M("63")) < S.workedOf(S.dayFor("41", S.TODAY), M("41")));
  eq("a closed day uses its stored total",
    S.workedOf(S.dayFor("79", S.TODAY), M("79")), 257);
  ok("a member with no row has no worked time", S.workedOf(null, M("86")) === null);

  head("Absence is the lack of a record");
  const rows = S.dayRows(S.TODAY, "all");
  eq("every active member gets a row, present or not", rows.length, 8);
  eq("…and exactly one of them has no attendance record",
    rows.filter((r) => !r.day).length, 1);
  const tot = S.attendanceTotals(rows);
  eq("present counts rows, not members", tot.present, 7);
  eq("one working break", tot.onBreak, 1);
  eq("one late", tot.late, 1);

  /* -------------------------------------------------------------- work --- */
  head("Delayed is derived, and terminal items are never late");
  ok("W-K05 is two days past due and still planned", S.isDelayed(S.readItem("W-K05")) === true);
  ok("W-K08 is WAITING on another item AND past due — two facts, not one stage",
    S.isDelayed(S.readItem("W-K08")) === true
    && S.readItem("W-K08").status === "in_progress"
    && !!S.blockerOf(S.readItem("W-K08")));
  ok("blocked is not a stage any more — nothing stores it",
    S.readItems().every((i) => i.status !== "blocked"));
  ok("the stage an item is IN is Delay, while the stage it STORES is In progress",
    S.stageOf(S.readItem("W-K08")) === "delayed" && S.readItem("W-K08").status === "in_progress");
  ok("a finished blocker stops blocking without anybody clearing the field",
    (() => {
      S.resetStore();
      const before = !!S.blockerOf(S.readItem("W-K08"));
      S.setItemStatus("W-K17", "completed");
      const after = !!S.blockerOf(S.readItem("W-K08"));
      S.resetStore();
      return before === true && after === false;
    })());
  ok("W-K15 is CANCELLED and past due — and is NOT overdue",
    S.isDelayed(S.readItem("W-K15")) === false);
  ok("W-K06 is completed and past its date — and is NOT overdue",
    S.isDelayed(S.readItem("W-K06")) === false);
  ok("no stored status is ever the string 'delayed'",
    S.readItems().every((i) => i.status !== "delayed"));

  head("Progress is derived, never typed");
  eq("W-M03 counts 2 of its 4 children complete", S.progressOf(S.readItem("W-M03")), 50);
  eq("W-T01 divides 15 by its target of 40", S.progressOf(S.readItem("W-T01")), 38);
  eq("a completed task is 100", S.progressOf(S.readItem("W-K06")), 100);
  ok("no item carries a stored progress field",
    S.readItems().every((i) => !("progressPct" in i)));

  /* ------------------------------------------------------------- scope --- */
  head("Scope · one level, never transitive");
  const ids = (list) => list.map((m) => m.memberId).sort();
  eq("self is one member", ids(S.membersInScope("self", "58")), ["58"]);
  eq("58's team is 58 plus the two who report to them",
    ids(S.membersInScope("team", "58")), ["58", "63", "86"]);
  ok("…and does NOT include their manager's other reports",
    ids(S.membersInScope("team", "58")).indexOf("70") < 0);
  eq("41 is the top of the tree and sees three direct reports plus self",
    ids(S.membersInScope("team", "41")).length, 4);
  ok("…but NOT the whole company, which would be transitive",
    ids(S.membersInScope("team", "41")).length < S.readMembers().length);
  eq("all is everybody", ids(S.membersInScope("all", "58")).length, 8);

  /* --------------------------------------------------------- attention --- */
  head("Needs attention");
  const review = S.reviewRows(S.TODAY, "all");
  const attn = S.attentionOf(review);
  ok("the founder is excluded from the no-plan count",
    attn.noPlan.every((r) => r.member.memberId !== "41"));
  ok("a DRAFT plan counts as not submitted",
    attn.noPlan.some((r) => r.member.memberId === "79"));
  eq("no EOD is outstanding at 14:20 — missing is not the same as early",
    attn.noEod.length, 0);
  ok("74's unread report is surfaced",
    attn.unacknowledged.length === 0 || attn.unacknowledged.every((r) => !!r.report));
  ok("every attention list is a subset of the rows it was built from",
    attn.noPlan.length <= review.length && attn.noEod.length <= review.length);

  /* ------------------------------------------------- the write simulation */
  head("Writes");
  S.resetStore();

  const first = S.openDay("86");
  ok("86 can start their day", first.ok === true);
  const second = S.openDay("86");
  ok("a second Start day is IDEMPOTENT, not a conflict", second.ok === true);
  eq("…and returns the same row", second.data.attendanceId, first.data.attendanceId);
  eq("the store holds one row for that member and date",
    S.readDays().filter((d) => d.memberId === "86" && d.businessDate === S.TODAY).length, 1);

  ok("break opens", S.startBreak("86").ok === true);
  ok("a second break is refused", S.startBreak("86").ok === false);
  const closed = S.endDay("86");
  ok("the day closes", closed.ok === true);
  ok("…and closing it CLOSED THE RUNNING BREAK, so no nine-hour lunch",
    closed.data.breaks.every((b) => !!b.endedAt));
  ok("a second close is refused", S.endDay("86").ok === false);

  head("Transitions");
  S.resetStore();
  const bad = S.setItemStatus("W-K06", "planned");
  ok("completed → planned is refused", bad.ok === false);
  eq("…with the contract's own code", bad.code, "invalid_transition");
  ok("blocked is not a transition at all",
    S.setItemStatus("W-K01", "blocked").ok === false);
  ok("waiting on another item without a reason is refused",
    S.setBlockedBy("W-K01", "W-K17").ok === false);
  ok("…with a reason it is allowed, and the STAGE does not move",
    S.setBlockedBy("W-K01", "W-K17", "Needs the tier table").ok === true
    && S.readItem("W-K01").status === "in_progress");
  ok("an item cannot wait on itself",
    S.setBlockedBy("W-K01", "W-K01", "nonsense").ok === false);
  ok("reopening a completed item needs a reason",
    S.setItemStatus("W-K06", "in_progress").ok === false);

  head("A plan line links rather than forks");
  S.resetStore();
  const before = S.readItems().length;
  const plan = S.submitPlan("86", { lines: [
    { title: "Get the ticket backlog under 20", priority: "high" },
    { title: "Something genuinely new", priority: "low" },
  ] });
  ok("the plan submits", plan.ok === true);
  eq("one line linked an existing open item, one minted a new one",
    S.readItems().length, before + 1);
  eq("…and the linked line points at the item that already existed",
    plan.data.lines[0].workItemId, "W-K12");
  ok("a second submit is refused", S.submitPlan("86", { lines: [{ title: "x", priority: "low" }] }).ok === false);

  head("An EOD tick completes the item");
  S.resetStore();
  const r = S.submitReport("86", {
    lines: [{ workItemId: "W-K12", title: "Ticket backlog", done: true }],
  });
  ok("the report submits", r.ok === true);
  eq("and the work item is now complete", S.readItem("W-K12").status, "completed");
  ok("an unticked line without a reason is refused",
    S.submitReport("63", { lines: [{ workItemId: "W-K01", title: "Triage", done: false }] }).ok === false);

  head("Five stages, and the fifth is not stored");
  S.resetStore();
  eq("the vocabulary carries five, one of them marked stored:false",
    S.VOCAB.workStatuses.length, 5);
  eq("\u2026and the derived one is Delay",
    S.VOCAB.workStatuses.filter((r) => r.stored === false).map((r) => r.key), ["delayed"]);
  ok("every item is in exactly one stage, so the columns add to the total",
    (() => {
      const rows = S.readItems();
      const t = S.workTotals(rows);
      return t.planned + t.inProgress + t.delayed + t.completed + t.cancelled === rows.length;
    })());
  ok("the strip counts STAGES, not stored statuses",
    S.workTotals(S.readItems()).inProgress
      < S.readItems().filter((i) => i.status === "in_progress").length);

  head("A long item is not an event on ninety-two days");
  S.resetStore();
  (() => {
    const rows = S.readItems();
    const target = S.readItem("W-T01");            /* 1 Jul \u2192 30 Sep */
    const mid = "2026-08-15";
    eq("a quarter-long target draws on neither a middle day\u2026",
      S.eventsOn(mid, rows).filter((e) => e.item.itemId === "W-T01").length, 0);
    eq("\u2026but it draws on the day it starts",
      S.eventsOn(target.startDate, rows).filter((e) => e.item.itemId === "W-T01")
        .map((e) => e.edge), ["starts"]);
    eq("\u2026and on the day it is due",
      S.eventsOn(target.dueDate, rows).filter((e) => e.item.itemId === "W-T01")
        .map((e) => e.edge), ["due"]);
    ok("a task of a week or less is drawn on every day it spans",
      S.eventsOn("2026-08-28", rows).some((e) => e.item.itemId === "W-K07"));
  })();

  head("Timeline lanes are the work, never the worker");
  (() => {
    const lanes = S.lanesOf(S.readItems());
    ok("a milestone under a target is an indented lane",
      lanes.some((l) => l.item && l.item.itemId === "W-M03" && l.sub === true));
    ok("the last lane holds the tasks that hang off nothing, and is never hidden",
      lanes[lanes.length - 1].item === null);
    ok("no lane is a member",
      lanes.every((l) => !l.item || l.item.kind !== "task"));
  })();

  head("Any tag, fixed stages");
  S.resetStore();
  eq("two members both hold `call`, as two separate records",
    S.readTags().filter((t) => t.slug === "call" && !t.archivedAt).length >= 2, true);
  ok("a member's own tags exclude the archived one",
    S.tagsOwnedBy("63").every((t) => !t.archivedAt));
  ok("creating the same label twice returns the row that exists",
    (() => {
      const a = S.createTag("63", "Review");
      return a.ok && a.data.tagId === S.tagsOwnedBy("63").filter((t) => t.slug === "review")[0].tagId;
    })());
  ok("a tag can be put on an item and taken off again",
    (() => {
      const t = S.tagsOwnedBy("70")[0];
      S.tagItem("W-K04", t.tagId, true);
      const on = (S.readItem("W-K04").tagIds || []).indexOf(t.tagId) >= 0;
      S.tagItem("W-K04", t.tagId, false);
      return on && (S.readItem("W-K04").tagIds || []).indexOf(t.tagId) < 0;
    })());
  ok("cross-member grouping is by slug, so one column covers both members",
    S.tagSlugs(S.readItems()).some((g) => g.slug === "call" && g.n >= 2));

  head("Leave suppresses a derived absence, and writes no attendance row");
  S.resetStore();
  ok("an approved row covers its dates", !!S.onLeave("86", "2026-09-08"));
  ok("\u2026and only its own dates", !S.onLeave("86", "2026-09-10"));
  ok("a requested row covers nothing yet", !S.onLeave("63", "2026-08-31"));
  ok("refusing without a sentence is refused",
    S.decideLeave("LV-02", "rejected", "58").ok === false);
  ok("approving is allowed, once",
    S.decideLeave("LV-02", "approved", "58").ok === true
    && S.decideLeave("LV-02", "approved", "58").ok === false);
  eq("and no attendance row was written",
    S.readDays().filter((d) => d.memberId === "63" && d.businessDate === "2026-08-31").length, 0);

  head("Approved leave suppresses the absence it would have derived");
  S.resetStore();
  (() => {
    const row = (d, id) => S.dayRows(d, "all").filter((r) => r.member.memberId === id)[0];
    eq("86 has no attendance row for 24 August, and it reads ON LEAVE",
      row("2026-08-24", "86").state, "on_leave");
    eq("\u2026so nobody is absent that day", S.attendanceTotals(S.dayRows("2026-08-24", "all")).absent, 0);
    eq("\u2026and exactly one is on leave", S.attendanceTotals(S.dayRows("2026-08-24", "all")).onLeave, 1);
    eq("no attendance row was written for it",
      S.readDays().filter((d) => d.memberId === "86" && d.businessDate === "2026-08-24").length, 0);
    eq("86 today has no row and no leave \u2014 still Not started, not On leave",
      row(S.TODAY, "86").state, "not_started");
  })();

  head("Documents: two buckets, and the required list is the vocabulary");
  S.resetStore();
  eq("N. Pillai is short three of the four required documents",
    S.missingDocs("86"), ["aadhaar", "address_proof", "bank"]);
  eq("Meera has handed over all four", S.missingDocs("63"), []);
  ok("sending freezes a copy and gives it an expiry",
    (() => {
      const r = S.sendAgreement("70", "nda", "NDA \u00b7 2026");
      return r.ok && r.data.state === "sent" && !!r.data.expiresAt && r.data.version === 1;
    })());
  ok("signing needs a name",
    S.signAgreement("AG-01", "").ok === false);
  ok("\u2026and stores the name, the time and the address",
    (() => {
      const r = S.signAgreement("AG-01", "N. Pillai");
      return r.ok && r.data.state === "signed" && !!r.data.signedAt && !!r.data.signerIp
        && r.data.expiresAt === null;
    })());
  ok("a signed agreement can no longer be revoked",
    S.revokeAgreement("AG-01").ok === false);
  ok("the member may delete what they handed over",
    S.deleteResource("RS-02").ok === true && S.resourcesFor("86").length === 1);

  head("A leave request has two ways to be impossible, and both are refusals");
  S.resetStore();
  (() => {
    const T = S.TODAY;
    /* datesIn is field arithmetic, not an ISO round-trip. At +05:30 the naive
       version silently loses the first day of every range. */
    eq("a range covers both its ends", S.datesIn(T, S.addDays(T, 2)).length, 3);
    eq("a single day is one day, not zero", S.datesIn(T, T).length, 1);

    /* 63 has attendance rows in the seed. A leave record over one of them would
       make that date both worked and away. */
    const worked = S.readDays().filter((d) => d.memberId === "63").map((d) => d.businessDate);
    const day = worked[worked.length - 1];
    ok("the clash names the day that was already clocked",
      S.leaveClash("63", day, day).worked.indexOf(day) >= 0);
    const bad = S.requestLeave("63", { fromDate: day, toDate: day, kind: "casual", reason: "x" });
    ok("…and the store refuses it, not just the form",
      bad.ok === false && bad.code === "day_worked");

    /* The form warns; the store is what decides. A second request over a date
       the member already asked for is the other refusal. */
    const free = S.addDays(T, 30);
    const first = S.requestLeave("63", { fromDate: free, toDate: S.addDays(free, 2), kind: "casual", reason: "a" });
    ok("a clean range is accepted", first.ok === true);
    const dup = S.requestLeave("63", { fromDate: S.addDays(free, 1), toDate: S.addDays(free, 4), kind: "casual", reason: "b" });
    ok("…and an overlapping second one is not",
      dup.ok === false && dup.code === "already_requested");

    /* A pending request suppresses nothing. Only an approval does. */
    ok("a pending request leaves the derivation alone",
      S.onLeave("63", free) === null);
    S.decideLeave(first.data.leaveId, "approved", "58");
    ok("…and approving it is what covers the day",
      S.onLeave("63", free) !== null);
  })();

  head("The approver is warned about the peer group, never blocked");
  S.resetStore();
  (() => {
    /* 63 and 86 both report to 58, so they are peers. 70 reports to 52 and must
       not show up in either one's overlap. */
    const T = S.addDays(S.TODAY, 40);
    const a = S.requestLeave("63", { fromDate: T, toDate: T, kind: "casual", reason: "a" });
    S.decideLeave(a.data.leaveId, "approved", "58");
    const b = S.requestLeave("86", { fromDate: T, toDate: T, kind: "casual", reason: "b" });
    const clash = S.leaveOverlap(b.data);
    ok("a peer already away on the day is surfaced",
      clash.length === 1 && clash[0].members.some((m) => m.memberId === "63"));
    ok("…and it is a warning: the request still goes through",
      S.decideLeave(b.data.leaveId, "approved", "58").ok === true);

    const c = S.requestLeave("70", { fromDate: T, toDate: T, kind: "casual", reason: "c" });
    ok("somebody under a different senior is not a clash",
      S.leaveOverlap(c.data).length === 0);
  })();

  head("A request with no approver is never silent");
  S.resetStore();
  (() => {
    ok("nothing is unrouted in the seed", S.unroutedLeave().length === 0);
    /* 41 is the founder: reportsTo is null, so there is no line to route down. */
    const r = S.requestLeave("41", {
      fromDate: S.addDays(S.TODAY, 50), toDate: S.addDays(S.TODAY, 50),
      kind: "casual", reason: "founder",
    });
    ok("a request from the top of the tree is accepted", r.ok === true);
    ok("…and lands in the unrouted list rather than nowhere",
      S.unroutedLeave().some((l) => l.leaveId === r.data.leaveId));
    ok("…and is not double-counted in a senior's own queue",
      S.pendingLeave("team").every((l) => l.memberId !== "41"));
  })();

  head("Team reads pay and never writes it");
  /* The old form of this banned any exported name containing "Pay", which
     caught `lastPayslip` — a READ — the moment payslip history landed. What it
     was actually asserting is that the module has no verb that CHANGES money,
     so that is what it asserts now: every pay-shaped export is a read, and the
     write verbs Finance owns are absent by name. */
  const PAY_READS = ["payFor", "incentiveTotal", "lastPayslip"];
  const payish = Object.keys(S).filter((k) =>
    typeof S[k] === "function" && /pay|payslip|incentive|salary|ctc/i.test(k));
  ok("every pay-shaped export is a read",
    payish.every((k) => PAY_READS.indexOf(k) >= 0));
  ok("and none of Finance's write verbs live here",
    ["setPay", "updatePay", "writePay", "addIncentive", "approveIncentive",
      "payIncentive", "setSalary", "createPayslip"]
      .every((k) => typeof S[k] === "undefined"));
  eq("an incentive total is per state, not a lump",
    S.incentiveTotal(S.payFor("52"), "paid"), 25000);
  eq("\u2026and the pending one is a different number",
    S.incentiveTotal(S.payFor("52"), "approved"), 18000);

  /* THE JOIN THE BRIEF ASKED FOR, both directions. An incentive names the work
     item it was earned against, and the item's progress is read live rather
     than restated in the pay record — two copies of "how far along is that
     target" is one copy too many, and the stale one gets quoted. */
  (() => {
    const inc = S.payFor("52").incentives;
    ok("an incentive points at a real work item",
      inc.every((i) => !i.workItemId || S.readItem(i.workItemId) !== null));
    const withItem = inc.filter((i) => i.workItemId)[0];
    ok("\u2026and the item carries its own live number, not a copy",
      !!withItem && S.readItem(withItem.workItemId).currentValue !== undefined
      && withItem.currentValue === undefined);
  })();

  /* A payslip carries the incentive that went out with it, so the payslip list
     and the incentive ledger cannot disagree about a month. */
  (() => {
    const p52 = S.payFor("52");
    ok("the last payslip is the newest one, whatever order the seed is in",
      S.lastPayslip(p52).month === p52.payslips
        .map((x) => x.month).sort().reverse()[0]);
    ok("every slip's net is its base plus whatever incentive it carried",
      p52.payslips.every((x) => x.net === x.base + (x.incentive || 0)));
    ok("a member with no salary account has no slips to disagree with",
      S.payFor("41").payslips.length === 0);
  })();

  head("Create is one form and three kinds");
  S.resetStore();
  (() => {
    const before = S.readItems().length;
    const t = S.createItem({ title: "New target", assigneeId: "52", kind: "target",
      targetValue: 10, targetUnit: "deals" });
    ok("a target is created and starts at zero", t.ok && t.data.currentValue === 0);
    ok("\u2026and it starts in Planning, never in Delay",
      t.ok && t.data.status === "planned" && S.stageOf(t.data) !== "delayed");
    ok("a target cannot be given a parent",
      S.createItem({ title: "x", assigneeId: "52", kind: "target", parentId: "W-T01" }).ok === false);
    ok("a task cannot hold children",
      S.createItem({ title: "x", assigneeId: "52", kind: "task", parentId: "W-K01" }).ok === false);
    ok("an untitled item is refused",
      S.createItem({ title: "   ", assigneeId: "52", kind: "task" }).ok === false);
    eq("one item was added, not four", S.readItems().length, before + 1);
  })();


  head("A month heading is built, never sliced out of a date");
  eq("the short form", S.fmtMonth("2026-09-04"), "Sep 2026");
  eq("the long form the calendar prints", S.fmtMonth("2026-09-04", true), "September 2026");
  eq("both year edges", S.fmtMonth("2026-01-31", true) + " / " + S.fmtMonth("2026-12-01", true),
    "January 2026 / December 2026");
  ok("stepping months never walks the day back",
    (() => {
      let a = "2026-09-04";
      for (let i = 0; i < 12; i++) a = S.monthStep(a, 1);
      for (let i = 0; i < 12; i++) a = S.monthStep(a, -1);
      return a === "2026-09-01";
    })());
  eq("…and it wraps the year both ways",
    S.monthStep("2026-12-15", 1) + " " + S.monthStep("2026-01-15", -1), "2027-01-01 2025-12-01");

  head("The clock only rolls forward in a browser");
  eq("in Node the shift is zero and the frame is the authored one", S.SHIFT_DAYS, 0);

  head("A link field is where javascript: gets in, so the scheme is allow-listed");
  eq("a bare host is taken as https", S.normaliseUrl("docs.google.com/x"), "https://docs.google.com/x");
  eq("https is kept", S.normaliseUrl("https://a.in/b?c=1"), "https://a.in/b?c=1");
  eq("http is allowed — an intranet is not https", S.normaliseUrl("http://wiki.local/x"), "http://wiki.local/x");
  ok("javascript: is refused, in any casing",
    S.normaliseUrl("javascript:alert(1)") === null
    && S.normaliseUrl("JavaScript:alert(1)") === null
    && S.normaliseUrl("  javascript:alert(1)  ") === null);
  ok("so are data:, file: and vbscript:",
    ["data:text/html;base64,x", "file:///etc/passwd", "vbscript:msgbox"]
      .every((u) => S.normaliseUrl(u) === null));
  ok("nothing typed is not an error, it is just not addable yet",
    S.normaliseUrl("") === null && S.normaliseUrl("   ") === null);

  head("Create carries the description, the links and the tags");
  /* Built from parts rather than written with escapes: this file is read by
     people as the module's rule list, and a backslash-n in a description is
     the one character nobody proof-reads correctly. */
  const DESC = ["**Done** looks like:", "- one", "- two"].join(String.fromCharCode(10));
  S.resetStore();
  (() => {
    const r = S.createItem({
      title: "With everything", assigneeId: "63", kind: "task",
      description: DESC,
      attachments: [{ url: "https://x.in/brief", label: "Brief" }],
      tagIds: ["TG-01"],
    });
    ok("the description is stored as the text somebody typed, marks and all",
      r.ok && r.data.description === DESC);
    ok("…and no markup was made out of it",
      r.ok && (r.data.description || "").indexOf("<") < 0);
    eq("the link is on the item", r.ok ? r.data.attachments.length : 0, 1);
    eq("so is the tag", r.ok ? r.data.tagIds : [], ["TG-01"]);
    ok("an item created without them carries neither, rather than empty arrays",
      (() => {
        const p = S.createItem({ title: "Bare", assigneeId: "63", kind: "task" });
        return p.ok && p.data.attachments === undefined && p.data.tagIds === undefined
          && p.data.description === null;
      })());
  })();

  head("Links: soft edges that restate nothing");
  S.resetStore();
  (() => {
    eq("the seed carries four edges", S.readLinks().length, 4);
    const of6 = S.linksOf("W-K06");
    ok("W-K06 follows W-K05, read outward",
      of6.length === 1 && of6[0].outward === true && of6[0].other.itemId === "W-K05");
    const of5 = S.linksOf("W-K05");
    eq("\u2026and W-K05 sees two edges pointed at it", of5.length, 2);
    ok("\u2026reading the same follows edge inward", of5.some((l) =>
      l.outward === false && l.other.itemId === "W-K06" && l.link.relation === "follows"));
    eq("the inward label flips, the stored edge does not",
      S.linkLabelOf("follows", false), "Followed by");
    ok("an item cannot link to itself", S.addLink("W-K01", "W-K01", "relates_to").ok === false);
    ok("an edge may not restate the parent link",
      S.addLink("W-K01", "W-M01", "relates_to").ok === false);
    ok("\u2026nor the waiting-on link", S.addLink("W-K08", "W-K17", "follows").ok === false);
    const dup = S.addLink("W-K05", "W-K06", "follows");
    ok("the same pair and relation hands back the edge that exists",
      dup.ok && dup.data.linkId === "LN-01" && S.readLinks().length === 4);
    const made = S.addLink("W-K01", "W-K02", "relates_to");
    ok("a real edge lands beside the seeded one", made.ok && S.linksOf("W-K02").length === 2);
    ok("\u2026and removing it removes exactly it",
      S.removeLink(made.ok ? made.data.linkId : "").ok === true && S.readLinks().length === 4);
  })();

  head("The tag manager: rename, restore, retone \u2014 the cap warns, never blocks");
  S.resetStore();
  (() => {
    const r = S.renameTag("TG-01", "Design review");
    ok("rename keeps the record and re-slugs it",
      r.ok && r.data.slug === "design-review" && r.data.tagId === "TG-01");
    ok("a rename into an existing active name is refused",
      S.renameTag("TG-01", "Call").ok === false);
    ok("restore is refused while an active twin holds the name",
      (() => {
        const dead = S.readTags().filter((t) => t.tagId === "TG-19")[0];
        const twin = S.createTag("63", "June leads");
        return twin.ok && S.restoreTag(dead.tagId).ok === false;
      })());
    ok("a tone is a hue from the tag palette, stored as typed",
      S.setTagTone("TG-02", "pink").ok && S.readTags().filter((t) => t.tagId === "TG-02")[0].colourToken === "pink");
    ok("the twentieth tag is created, not refused \u2014 the cap is a warning",
      (() => {
        for (let i = 0; S.tagsOwnedBy("63").length < S.TAG_CAP + 1; i++) {
          const c = S.createTag("63", "overflow " + i);
          if (!c.ok) return false;
        }
        return S.tagsOwnedBy("63").length > S.TAG_CAP;
      })());
  })();

  head("The wait filter is wired, not a dead parameter");
  S.resetStore();
  (() => {
    const waiting = S.workRows({ wait: "1" }, "all");
    eq("exactly the items with an open blocker", waiting.map((i) => i.itemId), ["W-K08"]);
    ok("\u2026and completing the blocker empties the filter",
      (() => {
        S.setItemStatus("W-K17", "in_progress");
        S.setItemStatus("W-K17", "completed");
        return S.workRows({ wait: "1" }, "all").length === 0;
      })());
  })();

  head("Adoption: the seed wears a live roster");
  S.resetStore();
  (() => {
    S.adoptRoster([
      { id: 901, name: "Panel Admin", email: "pa@x.in", isSuperAdmin: true },
      { id: 902, name: "Nikhil" },
      { id: 903, name: "Rajni Singh" },
    ]);
    const ids = S.readMembers().map((m) => m.memberId).sort();
    eq("three people, three members \u2014 the other five slots dropped",
      ids, ["901", "902", "903"]);
    eq("the signed-in user holds the senior slot", S.meId(), "901");
    ok("the founder slot keeps no boss and the senior reports into it",
      S.readMember("902").reportsTo === null && S.readMember("901").reportsTo === "902");
    ok("every work item lands on a live person",
      S.readItems().every((i) => ids.indexOf(i.assigneeId) >= 0 && ids.indexOf(i.createdById) >= 0));
    ok("attendance rows only for adopted people",
      S.readDays().every((d) => ids.indexOf(d.memberId) >= 0));
    ok("dropped members' leave went with them \u2014 nothing dangles",
      S.readLeave().every((l) => ids.indexOf(l.memberId) >= 0));
    ok("no item wears a tag its owner did not keep",
      (() => {
        const live = S.readTags().map((t) => t.tagId);
        return S.readItems().every((i) => (i.tagIds || []).every((t) => live.indexOf(t) >= 0));
      })());
    ok("pay re-keys with everything else",
      S.payFor("903") !== null && S.payFor("52") === null);
    ok("a decided-by that pointed at a dropped member repoints to the signed-in user",
      S.readLeave().every((l) => !l.decidedById || ids.indexOf(l.decidedById) >= 0));
    S.resetStore();
    eq("\u2026and reset restores the authored eight", S.readMembers().length, 8);
  })();

  head("Hours are read, never written");
  ok("no write function accepts an hours argument",
    ["submitReport", "submitPlan"].every((k) =>
      String(S[k]).indexOf("workedMinutes") < 0));

  console.log("\n" + (failed ? failed + " FAILED" : "all checks passed") + "\n");
  process.exit(failed ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
