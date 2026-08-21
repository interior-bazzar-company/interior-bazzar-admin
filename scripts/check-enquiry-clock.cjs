/* =============================================================================
   Business Enquiries — clock-filter invariants.   `npm run check:clock`
   -----------------------------------------------------------------------------
   Date arithmetic is the thing that looks obviously right and is off by a day.
   These run against the REAL store module, bundled by esbuild, at a fixed
   "now" — the filter takes `now` as a parameter precisely so it can be pinned
   here instead of being tested against whatever today happens to be.

   The two assertions worth reading are the boundary ones:

     · midnight belongs to exactly ONE day. A closed window either drops an
       enquiry that arrived at 23:59:59.5 or counts midnight into two adjacent
       days, and "today plus yesterday do not add up to two days" gets reported
       as a data problem, not a filter bug.
     · `30d` and `older` are complements. Every enquiry is in exactly one of
       them — no gap, no overlap — or the two counts silently disagree with the
       total and nobody can tell which one is lying.
   ========================================================================== */
const path = require('path');
const S = require(path.join(__dirname, '..', 'node_modules', '.tmp', 'enquiry-store.cjs'));
const seed = require(path.join(__dirname, '..', 'src/content/business-enquiries/enquiries.json'));

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };

/* The window MATHS is pure and needs nothing. The chip LABEL reads the
   vocabulary, which now arrives from the API instead of a bundled file — so
   plant one here rather than stand up a server for a date-arithmetic check.
   Same call the boot makes, so a rename in the payload breaks this too. */
S.applyVocabulary({
  receivedRanges: [
    { key: 'today', label: 'Today' },
    { key: '24h', label: 'Last 24 hours' },
    { key: '7d', label: 'Last 7 days' },
    { key: '30d', label: 'Last 30 days' },
    { key: 'month', label: 'This month' },
    { key: 'older', label: 'Older than 30 days' },
    { key: 'custom', label: 'Custom range…' },
  ],
});

/* Pinned, and deliberately mid-afternoon: a "now" at midnight would make the
   day-boundary assertions pass for the wrong reason. */
const NOW = new Date('2026-08-20T14:00:00+05:30');
const w = (p) => S.receivedWindow(p, NOW);
const inw = (iso, p) => {
  const x = w(p);
  if (!x) return true;
  const t = new Date(iso).getTime();
  return t >= x.from && t < x.to;
};

/* ---- today, and its two edges ------------------------------------------ */
ok(inw('2026-08-20T09:00:00+05:30', { received: 'today' }), 'this morning is not "today"');
ok(!inw('2026-08-19T23:59:00+05:30', { received: 'today' }), 'last night counted as today');
ok(!inw('2026-08-21T00:00:00+05:30', { received: 'today' }), 'tomorrow counted as today');
ok(inw('2026-08-20T00:00:00+05:30', { received: 'today' }), 'midnight excluded from its own day');

/* ---- rolling windows ---------------------------------------------------- */
ok(inw('2026-08-19T20:00:00+05:30', { received: '24h' }), '18h ago missing from 24h');
ok(!inw('2026-08-19T10:00:00+05:30', { received: '24h' }), '28h ago present in 24h');
ok(inw('2026-08-14T10:00:00+05:30', { received: '7d' }), '6d ago missing from 7d');
ok(!inw('2026-08-11T10:00:00+05:30', { received: '7d' }), '9d ago present in 7d');
ok(inw('2026-08-01T10:00:00+05:30', { received: 'month' }), '1 Aug missing from this month');
ok(!inw('2026-07-31T10:00:00+05:30', { received: 'month' }), 'July present in this month');

/* ---- 30d and older partition the timeline ------------------------------- */
['2026-08-20T09:00:00+05:30', '2026-08-01T09:00:00+05:30', '2026-06-01T09:00:00+05:30']
  .forEach((t) => {
    const a = inw(t, { received: '30d' });
    const b = inw(t, { received: 'older' });
    ok(a !== b, '30d and older overlap or leave a gap at ' + t);
  });

/* ---- custom, with either end open --------------------------------------- */
ok(inw('2026-08-09T23:30:00+05:30', { received: 'custom', to: '2026-08-09' }),
  'the "to" date is not inclusive of its own day');
ok(!inw('2026-08-10T00:30:00+05:30', { received: 'custom', to: '2026-08-09' }),
  'the "to" date leaked into the next day');
ok(inw('2026-08-15T10:00:00+05:30', { received: 'custom', from: '2026-08-01' }),
  'an open-ended "from" dropped a later enquiry');
ok(!inw('2026-07-30T10:00:00+05:30', { received: 'custom', from: '2026-08-01' }),
  'the "from" date was not applied');
ok(w({ received: 'custom' }) === null, 'custom with neither end set should be no filter at all');
ok(w({}) === null, 'no range should be no filter');

/* ---- the chip names the window, never the key --------------------------- */
ok(S.receivedLabel({ received: '7d' }) === 'Last 7 days',
  'chip shows the raw key: ' + S.receivedLabel({ received: '7d' }));
ok(S.receivedLabel({ received: 'custom', from: '2026-08-01', to: '2026-08-09' })
  === '2026-08-01 to 2026-08-09', 'custom chip wrong');
ok(S.receivedLabel({ received: 'custom', from: '2026-08-01' }) === 'since 2026-08-01',
  'open-from chip wrong');
ok(S.receivedLabel({}) === '', 'a chip appeared with no range set');

/* ---- and it reaches the real filter ------------------------------------- */
const rows = seed.enquiries;
const older = S.filterEnquiries(rows, { received: 'older' });
const recent = S.filterEnquiries(rows, { received: '30d' });
ok(older.length + recent.length === rows.length,
  'the split does not add up: ' + recent.length + ' + ' + older.length + ' vs ' + rows.length);

if (fails.length) { console.error('FAIL\n' + fails.map((f) => '  · ' + f).join('\n')); process.exit(1); }
console.log('clock ok — day boundaries, rolling windows, open-ended custom ranges, chip labels;');
console.log('           30d + older = ' + recent.length + ' + ' + older.length +
  ' = ' + rows.length + ' (no gap, no overlap)');
