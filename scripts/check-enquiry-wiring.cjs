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

if (fails.length) {
  console.error('check:wiring — ' + fails.length + ' problem(s)\n');
  for (const m of fails) console.error('  · ' + m);
  process.exit(1);
}
console.log('check:wiring — popover triggers wired correctly');
