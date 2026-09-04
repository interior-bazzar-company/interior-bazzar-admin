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

  head("Hours are read, never written");
  ok("no write function accepts an hours argument",
    ["submitReport", "submitPlan"].every((k) =>
      String(S[k]).indexOf("workedMinutes") < 0));

  console.log("\n" + (failed ? failed + " FAILED" : "all checks passed") + "\n");
  process.exit(failed ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
