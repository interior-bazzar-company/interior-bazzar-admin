/* =============================================================================
   Business Enquiries — the shell contracts this module depends on.
                                                   `npm run check:wiring`
   -----------------------------------------------------------------------------
   THE THREE-DOT MENU SHIPPED BROKEN ONCE, and the reason is worth a test rather
   than a comment on its own.

   `PopBox` in the shell mounts every popover together with a document-level
   click listener that closes it unless the click landed inside `.pop` or on an
   element carrying `data-act`. React flushes a discrete click — render, commit
   and effects — before the native event has finished bubbling up to `document`,
   so the listener is already live when the press that OPENED the menu reaches
   it. Without `data-act` the popover opens and closes inside one click: no
   error, no warning, nothing on screen, and nothing in the type system or the
   linter that could have caught it.

   So `data-act` is load-bearing markup, not a test hook, and this asserts it for
   every popover trigger this module owns. Triggers are identified by
   `aria-haspopup`, which they need regardless — a menu button that does not
   announce itself as one is a bug in its own right, so the two travel together.

   SCOPE IS THIS MODULE ONLY. The same rule holds panel-wide, but several older
   triggers in Deals predate it and this suite is not the place to fail on them.
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const D = path.join(__dirname, '..', 'src/admin/views/BusinessEnquiries');
const fails = [];

for (const f of fs.readdirSync(D).filter((n) => n.endsWith('.tsx'))) {
  const src = fs.readFileSync(path.join(D, f), 'utf8');
  /* The rule is about the SHELL's popover and nothing else. A component that
     opens its own panel and runs its own outside-click listener - FilterSelect
     does - is not subject to it, and demanding a `data-act` there would be
     cargo: an attribute with no reader, added to satisfy a test. Scope the
     check to files that actually call `openPop`. */
  if (src.indexOf('openPop') < 0) continue;
  /* Each JSX opening tag, whole. Attributes wrap across lines here, so the tag
     and not the line is the unit that has to be looked at. */
  const tags = src.match(/<[a-zA-Z][^<>]*?>/g) || [];
  for (const t of tags) {
    if (t.indexOf('aria-haspopup') < 0) continue;
    if (t.indexOf('data-act') < 0)
      fails.push(f + ': a popover trigger has no data-act — the shell\'s '
        + 'outside-click listener will close it on the click that opened it'
        + '\n    ' + t.replace(/\s+/g, ' ').slice(0, 110));
  }
}

/* And the trigger has to still exist: a menu nobody can reach is the same
   failure arrived at from the other side. */
const detail = fs.readFileSync(path.join(D, 'Detail.tsx'), 'utf8');
if (!/data-act="be-more"/.test(detail))
  fails.push('Detail.tsx: the share menu trigger is gone');
if (detail.indexOf('<RecordMenu e={e} />') < 0)
  fails.push('Detail.tsx: nothing opens RecordMenu any more');

/* =============================================================================
   THE ATTENTION STRIP — the count and the filter behind it must be the same set.
   -----------------------------------------------------------------------------
   Every cell in the strip is a number AND the control that filters to it. That
   makes a disagreement between the two worse than either being wrong on its own:
   the operator presses "0 callback due", gets a row back, and now cannot trust
   any number on the row.

   Which is exactly what happened, before callbacks were removed from the
   module altogether. `callback due` was counted as
   `callbackDue - callbackOverdue` — scheduled but not yet late, because overdue
   has its own cell next to it — while `flag=followup` filtered on
   `followUpDue()`, which is merely "has a callback set" and therefore includes
   the late ones. The cell read 0 and returned 1 row.

   So each cell is asserted twice: its count equals the length of the list its
   own filter produces, and it has help text to hover. Both run against the real
   `countsOf()` and `filterEnquiries()` from the bundled store, not against a
   re-implementation of them here — a test that reimplements the rule it is
   checking passes on the day the rule changes.
   ========================================================================== */
const S = require(path.join(__dirname, '..', 'node_modules/.tmp/enquiry-store.cjs'));
const seed = require(path.join(__dirname, '..', 'src/content/business-enquiries/enquiries.json'));
const voc = require(path.join(__dirname, '..', 'src/content/business-enquiries/vocabularies.json'));

const all = seed.enquiries;
const m = S.countsOf(all);

/* The cell table, restated independently of List.tsx on purpose: this is the
   contract the strip is supposed to honour, and a copy that reads the component
   would agree with it by construction and prove nothing. Keep in step by hand.  */
const CELLS = [
  { k: 'total',            n: m.total,                            f: {} },
  { k: 'New',              n: m.byStatus.generated || 0,          f: { status: 'generated' } },
  { k: 'qualified',        n: m.byStatus.qualified || 0,          f: { status: 'qualified' } },
  { k: 'no match yet',     n: m.noEligible,                       f: { status: 'no_match' } },
  { k: 'processing',       n: m.byStatus.processing || 0,         f: { status: 'processing' } },
  { k: 'assigned',         n: m.byStatus.assigned || 0,           f: { status: 'assigned' } },
  { k: 'converted',        n: m.converted,                        f: { status: 'converted' } },
  { k: 'rejected',         n: m.invalid,                          f: { status: 'invalid' } },
];

const help = {};
(voc.attentionCells || []).forEach((c) => { help[c.key] = c; });

for (const c of CELLS) {
  const got = S.filterEnquiries(all, c.f).length;
  if (got !== c.n)
    fails.push('strip cell "' + c.k + '" reads ' + c.n + ' but pressing it returns '
      + got + ' row(s) — the count and its own filter disagree');

  const h = help[c.k];
  if (!h) fails.push('strip cell "' + c.k + '" has no entry in vocabularies.attentionCells — nothing to hover');
  else {
    if (!h.counts || h.counts.length < 25)
      fails.push('attentionCells."' + c.k + '".counts is missing or too short to explain the number');
    if (!h.does || h.does.length < 15)
      fails.push('attentionCells."' + c.k + '".does is missing — the tooltip would not say what pressing it does');
  }
}

/* And nothing orphaned: help for a cell that no longer exists is help nobody
   will ever see, and it rots silently. */
for (const k of Object.keys(help))
  if (!CELLS.some((c) => c.k === k))
    fails.push('attentionCells has an entry for "' + k + '", which is not a cell in the strip');

if (fails.length) {
  console.error('check:wiring — ' + fails.length + ' problem(s)\n');
  for (const m of fails) console.error('  · ' + m);
  process.exit(1);
}
console.log('check:wiring — popover triggers wired; '
  + CELLS.length + ' strip cells agree with their own filters and all carry help text');
