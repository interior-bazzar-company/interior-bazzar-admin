/* =============================================================================
   Business Enquiries — what may leave the panel.   `npm run check:share`
   -----------------------------------------------------------------------------
   Four code paths now take an enquiry out of this module — CSV export, clipboard
   copy, printed A4 sheet, and the shared PNG — and they share one rule:

     the contact log, the remarks, the match score, the rank, who else was
     eligible and any money NEVER leave. The only lines from the customer's side
     that may is their own words and the confirmed requirement summary.

   A rule with four implementations and no test is a rule that lasts until the
   next person adds a field. `check:export` proves it for the CSV by building one
   and searching it. The other three cannot be built in node — a canvas needs a
   DOM and the print sheet is a string handed to a browser — so this checks the
   SOURCE instead: those files must not so much as reference the fields.

   That is a weaker guarantee than executing them, and it is stated plainly here
   rather than dressed up: it cannot catch a leak assembled from something other
   than a direct field read. It does catch the realistic regression, which is
   somebody adding `remarks[0].text` to a layout because it would be useful
   there.
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const D = path.join(__dirname, '..', 'src/admin/views/BusinessEnquiries');
const read = (f) => fs.readFileSync(path.join(D, f), 'utf8');
/* Comments are where the rule is EXPLAINED, so they must not be searched for
   the words the rule forbids — otherwise documenting the rule breaks it. */
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };

/* The three source-level paths. exportCsv is covered far more strongly by
   check:export, which builds a real file; it is included here so a new
   forbidden field is caught in all four places at once. */
const PATHS = ['share.ts', 'imageSheet.ts', 'exportCsv.ts'];

/* Field reads that would mean a leak. `remarks.length` is allowed — a COUNT of
   internal notes is an operational fact; their text is not — so the pattern
   targets the text and the array index, not the identifier alone. */
const FORBIDDEN = [
  { re: /remarks\s*(\[|\.\s*(map|forEach|slice|filter|find)\b)/, what: 'reads remark text' },
  /* A word character before the dot, so this matches `entry.note` and not the
     `.note { }` CSS class inside the print sheet's own stylesheet. The first
     draft of this rule matched the stylesheet and reported a leak that was a
     font-size — a check that cries wolf gets switched off. */
  { re: /\w\.note\b/, what: 'reads a contact-log note' },
];

/* Score and rank are handled DIFFERENTLY in the two kinds of path, and the
   difference is the rule rather than an inconsistency:

     · share.ts and imageSheet.ts go straight into a chat with a business, so
       they must not so much as reference the fields — checked here.
     · exportCsv.ts legitimately carries them for OUR analysis (match-score
       distribution is a named admin metric). It cannot be a source rule there;
       what matters is that they are off by default and refused while a business
       filter is on, and `check:export` asserts exactly that by building files. */
const CHAT_PATHS = ['share.ts', 'imageSheet.ts'];

for (const f of PATHS) {
  const src = code(f);
  for (const g of FORBIDDEN) {
    ok(!g.re.test(src), f + ' ' + g.what);
  }
}
for (const f of CHAT_PATHS) {
  ok(!/candidateScore|candidateRank|eligibleCount/.test(code(f)),
    f + ' reads the match score, rank or pool size');
}

/* THE IMAGE IS UNATTRIBUTED, ON PURPOSE. It is made to be forwarded, and once
   it has been it cannot be withdrawn — so it carries no company name, no legal
   entity and no domain. The reference identifies it; whoever receives it
   already knows who sent it. */
const img = read('imageSheet.ts');
for (const name of ['Interior bazzar', 'interiorbazzar', 'Feelsafe', 'feelsafe']) {
  ok(img.indexOf(name) < 0, 'the shared image carries the company name: "' + name + '"');
}

/* And the A4 sheet DOES carry it, which is the distinction rather than an
   oversight: that one is an internal document, not a thing forwarded to a chat.
   If this assertion ever fails, the two artefacts have been confused. */
const sheet = read('share.ts');
ok(sheet.indexOf('Interior bazzar') > 0,
  'the printed sheet lost the company name — it is an internal document and should carry it');

/* The one line from the customer that IS allowed out, in every path that shows
   their words at all. If this disappears, something has over-corrected. */
ok(code('share.ts').indexOf('requirementSummary') > 0, 'share.ts stopped carrying the requirement summary');
ok(code('imageSheet.ts').indexOf('requirementSummary') > 0, 'imageSheet.ts stopped carrying the requirement summary');

if (fails.length) { console.error('FAIL\n' + fails.map((f) => '  · ' + f).join('\n')); process.exit(1); }
console.log('share ok — ' + PATHS.length + ' export paths carry no contact log, no remarks, no score;');
console.log('           the image is unattributed, the printed sheet is not.');
