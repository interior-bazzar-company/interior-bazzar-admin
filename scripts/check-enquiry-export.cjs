/* =============================================================================
   Business Enquiries — export invariants.   `npm run check:export`
   -----------------------------------------------------------------------------
   Runs against the REAL exportCsv module, bundled by esbuild, and the real seed.
   Not a unit test of formatting for its own sake: two of these assertions are
   the privacy rule of this module expressed as code.

     · customer contact is absent unless the contact group is ticked
     · THE CONTACT LOG AND THE REMARKS ARE NEVER PRESENT, at any tick — those
       are our notes about a customer, and the only line meant for anyone else is
       the requirement summary. share.ts and imageSheet.ts enforce the same rule
       for copy, print and the shared image; this is the fourth path, and a rule
       with four paths and one test is a rule that survives.

   The rest is the boring half that still ruins a file: BOM (or Excel mangles
   every accented name), CRLF, one cell count for every row, and an embedded
   quote, comma or newline that does not tear the row in two.
   ========================================================================== */
const path = require('path');
const X = require(path.join(__dirname, '..', 'node_modules', '.tmp', 'enquiry-export.cjs'));
const seed = require(path.join(__dirname, '..', 'src/content/business-enquiries/enquiries.json'));

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };

const rows = seed.enquiries;
const all = ['core', 'requirement', 'handling', 'assignment'];

/* ---- 1. contact is genuinely absent unless asked for -------------------- */
const noContact = X.buildCsv(rows, all);
for (const e of rows) {
  ok(noContact.indexOf(e.customer.phone) < 0, 'phone leaked without the contact group: ' + e.enquiryId);
  if (e.customer.email) {
    ok(noContact.indexOf(e.customer.email) < 0, 'email leaked without the contact group: ' + e.enquiryId);
  }
}
const withContact = X.buildCsv(rows, all.concat(['contact']));
ok(withContact.indexOf(rows[0].customer.phone) >= 0, 'contact group ticked but phone absent');

/* ---- 2. the contact log and the remarks NEVER appear, at any tick ------- */
const everything = X.buildCsv(rows, X.GROUPS.map((g) => g.key));
for (const e of rows) {
  for (const c of e.contactLog) {
    if (c.response) ok(everything.indexOf(c.response) < 0, 'contact-log RESPONSE exported: ' + e.enquiryId);
    if (c.note) ok(everything.indexOf(c.note) < 0, 'contact-log NOTE exported: ' + e.enquiryId);
  }
  for (const r of (e.remarks || [])) {
    ok(everything.indexOf(r.text) < 0, 'REMARK TEXT exported: ' + e.enquiryId);
  }
}
/* The count is allowed and is a different thing from the text. */
ok(everything.indexOf('remark_count') > 0, 'the remark count column went missing');

/* ---- 2b. the DEFAULT export carries no matching internals --------------- */
/* This is the behavioural half of the rule check:share states as source rules.
   The dialog offers a business-scoped export as "the file to send a business
   about its own enquiries" — and rank and score sat in a group that was ON by
   default, so that file handed a business the number it was ranked on. They are
   their own group now, off unless deliberately ticked. */
const DEFAULTS = ['core', 'requirement', 'handling', 'assignment'];
const byDefault = X.buildCsv(rows, DEFAULTS);
ok(byDefault.indexOf('match_score') < 0, 'match_score is in the DEFAULT export');
ok(byDefault.indexOf('match_rank') < 0, 'match_rank is in the DEFAULT export');
ok(byDefault.indexOf('rule_version') < 0, 'rule_version is in the DEFAULT export');
ok(DEFAULTS.indexOf('matching') < 0, 'the matching group is on by default');
/* Kept, not deleted — match-score distribution is a real admin metric. */
const withMatching = X.buildCsv(rows, DEFAULTS.concat(['matching']));
ok(withMatching.indexOf('match_score') > 0, 'the matching group no longer produces a score');
const g = X.GROUPS.filter((x) => x.key === 'matching')[0];
ok(!!g && g.internal === true, 'the matching group is not flagged internal');

/* ---- 3. it is well-formed CSV ------------------------------------------- */
ok(everything.charCodeAt(0) === 0xFEFF, 'no BOM — Excel will mangle it');
const body = everything.slice(1);
ok(body.indexOf('\r\n') > 0, 'not CRLF terminated');
const lines = body.split('\r\n');
ok(lines.length === rows.length + 1, 'expected ' + (rows.length + 1) + ' lines, got ' + lines.length);
const headCount = lines[0].split('","').length;
lines.forEach((l, i) => {
  ok(l.split('","').length === headCount,
    'row ' + i + ' has ' + l.split('","').length + ' cells, header has ' + headCount);
  ok(l.startsWith('"') && l.endsWith('"'), 'row ' + i + ' is not fully quoted');
});
ok(X.columnCount(X.GROUPS.map((g) => g.key)) === headCount, 'columnCount disagrees with the header');

/* ---- 4. a value containing a quote, a comma and a newline survives ------ */
const nasty = JSON.parse(JSON.stringify(rows[0]));
nasty.requirement.service = 'He said "3BHK, full" \n then hung up';
const one = X.buildCsv([nasty], ['core', 'requirement']);
ok(one.indexOf('""3BHK, full""') > 0, 'embedded quotes not doubled');
ok(one.split('\r\n').length === 2, 'an embedded newline broke the row into two');

/* ---- 5. the filename says what the file is ------------------------------ */
const fn = X.fileNameFor({ business: 'Studio Aangan', status: 'assigned' }, 4);
ok(fn.indexOf('studio-aangan') > 0, 'business missing from filename: ' + fn);
ok(fn.indexOf('assigned') > 0, 'status missing from filename: ' + fn);
ok(/_4_\d{4}-\d{2}-\d{2}\.csv$/.test(fn), 'count/date suffix wrong: ' + fn);
ok(X.fileNameFor({}, 13) === 'enquiries_13_' + new Date().toISOString().slice(0, 10) + '.csv',
  'unfiltered filename wrong: ' + X.fileNameFor({}, 13));

/* ---- 6. the scope sentence cannot describe a different set -------------- */
ok(X.scopeSentence({}, 13, 13).indexOf('No filters') > 0, 'unfiltered sentence wrong');
// The fixture used `flag: 'overdue'` and passed only because the sentence
// echoed `p.flag` verbatim — the flag param itself is gone now, and so is the
// callback state it named. Two filters that exist, and one that does not, so a
// filter silently dropped from the sentence still fails this.
const sc = X.scopeSentence({ business: 'Terra Interiors', status: 'no_match', city: 'New Delhi' }, 2, 13);
ok(sc.indexOf('2 of 13') === 0, 'count missing from scope sentence: ' + sc);
ok(sc.indexOf('Terra Interiors') > 0, 'scope sentence lost the business: ' + sc);
ok(sc.indexOf('No match yet') > 0, 'scope sentence lost the status: ' + sc);
ok(sc.indexOf('New Delhi') > 0, 'scope sentence lost the city: ' + sc);
ok(X.scopeSentence({ flag: 'overdue' }, 2, 13).indexOf('overdue') < 0,
  'scope sentence still echoes the removed flag param');

if (fails.length) { console.error('FAIL\n' + fails.map((f) => '  · ' + f).join('\n')); process.exit(1); }
console.log('export ok — ' + rows.length + ' rows, ' + headCount + ' columns at full tick,');
console.log('           contact withheld by default, contact log never exported.');
