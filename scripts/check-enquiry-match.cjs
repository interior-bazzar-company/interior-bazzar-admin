/* =============================================================================
   Business Enquiries — the matching cooldown.   `npm run check:match`
   -----------------------------------------------------------------------------
   A lead may be matched once per window, and the window is a versioned server
   value (`matchCooldownHours` on the active rule set). The reason for the rule
   is that neither input to a run moves inside it: the qualification snapshot is
   FROZEN, and a business joining, renewing or widening its service area happens
   over days. A second run inside the window pays the same cost for the same
   answer — and re-running is the only way out of No match yet, so it is the one
   control an operator will press repeatedly for want of another.

   THE SERVER IS WHAT ENFORCES THIS. `POST <id>/match/` refuses `rate_limited`
   off the LeadMatchRun row whatever the browser believes, so a reload or a
   second tab cannot get around it. What is checked here is the panel's half:
   that the button agrees with the endpoint about when the window closes, so it
   does not offer a run that is about to be refused, or withhold one that would
   be allowed.

   That is why the source of truth is the RUN and not an event about one —
   `matchRun.calculatedAt` is the same row the server measures from. Reading
   anything else here is how the two drift apart.

   This runs against the REAL store module, bundled by esbuild, at a pinned
   "now": `matchCooldown` takes it as a parameter precisely so it can be fixed
   here rather than tested against whatever time the check happens to run at.
   ========================================================================== */
const path = require('path');
const S = require(path.join(__dirname, '..', 'node_modules', '.tmp', 'enquiry-store.cjs'));

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };

/* Same call the boot makes, so a rename in the rules payload breaks this check
   too rather than silently reading undefined and passing. */
const hours = (n) => S.applyRules({ ruleVersion: 'v3', matchCooldownHours: n });

const NOW = new Date('2026-08-20T14:00:00+05:30');
/* A run, as the server freezes it. `found` is how many passed stage 1 — the
   window does not care, and that is the point: a run that found nobody is
   still a run, and it is the one this rule exists for. */
const run = (calculatedAt, found = 0) => ({
  enquiryId: '1', runId: '1', ruleVersion: 'v3', calculatedAt,
  subscribedCount: 12, ranked: false, notApplied: [],
  eligible: new Array(found).fill({}), excluded: [],
});
const enquiry = (matchRun) => ({ enquiryId: '1', events: [], matchRun: matchRun || null });
const cool = (e) => S.matchCooldown(e, NOW);

/* ---- never matched ----------------------------------------------------- */
hours(24);
ok(!cool(enquiry(null)).blocked, 'an enquiry that has never been matched was blocked');
ok(cool(enquiry(null)).lastAt === null, 'a never-matched enquiry reported a last run');
ok(cool(enquiry(null)).readyAt === null, 'a never-matched enquiry reported a wait');

/* ---- inside the window -------------------------------------------------- */
ok(cool(enquiry(run('2026-08-20T09:00:00+05:30'))).blocked,
  'a run five hours ago did not block a second one');
ok(cool(enquiry(run('2026-08-19T15:00:00+05:30'))).blocked,
  'a run 23 hours ago did not block a second one');

/* ---- and out of it ------------------------------------------------------ */
ok(!cool(enquiry(run('2026-08-19T13:00:00+05:30'))).blocked,
  'a run 25 hours ago is still blocking');
ok(!cool(enquiry(run('2026-08-19T14:00:00+05:30'))).blocked,
  'the boundary itself blocked — 24h after a run IS allowed');

/* ---- what the run FOUND is irrelevant to the window --------------------- */
ok(cool(enquiry(run('2026-08-20T10:00:00+05:30', 0))).blocked,
  'a run that found nobody did not count — that is the exact case this rule is for');
ok(cool(enquiry(run('2026-08-20T10:00:00+05:30', 7))).blocked,
  'a run that found seven businesses did not count either');

/* ---- the window is the rules row, and 0 turns it off -------------------- */
hours(0);
ok(!cool(enquiry(run('2026-08-20T13:59:00+05:30'))).blocked,
  '0 hours should disable the wait, not block forever');
hours(72);
ok(cool(enquiry(run('2026-08-18T10:00:00+05:30'))).blocked,
  'a longer window from the rules row was not honoured');
hours(24);

/* ---- and it names when, because a disabled button must say why ---------- */
const c = cool(enquiry(run('2026-08-20T09:00:00+05:30')));
ok(c.lastAt === '2026-08-20T09:00:00+05:30', 'the last run is not reported back');
ok(new Date(c.readyAt).getTime() === new Date('2026-08-21T09:00:00+05:30').getTime(),
  'readyAt is not exactly one window after the last run: ' + c.readyAt);

/* ---- the panel reads the run off the record, not a map beside it -------- */
ok(typeof S.useMatchRun === 'function', 'useMatchRun disappeared');
ok(typeof S.findBusinesses === 'function', 'the manual business search disappeared');

/* ---- and the manual pick asks the server ONLY once something is typed ---- */
/* An empty query must not reach the network at all. Opening the picker used to
   filter a directory the tab had already fetched, which meant it opened onto a
   list of every business — a list nobody asked for, presented where a
   suggestion goes. It is a request now, and a request for nothing is still a
   request.

   Proved by making one impossible: nothing here defines `fetch` or a base URL,
   so any call that actually left would reject. An empty query resolving to []
   is the short-circuit working. */
(async () => {
  let result;
  try {
    result = await S.findBusinesses('   ');
  } catch (e) {
    fails.push('an empty query tried to reach the server: ' + e.message);
  }
  ok(Array.isArray(result) && result.length === 0,
    'an empty query did not short-circuit to an empty list');

  if (fails.length) {
    console.error('FAIL\n' + fails.map((f) => '  \u00b7 ' + f).join('\n'));
    process.exit(1);
  }
  console.log('match ok - one run per window, measured from the frozen run the server enforces');
  console.log('           against; what the run found is irrelevant, and 0 hours disables the wait');
  console.log('           and the by-hand search stays off the network until something is typed');
})();
