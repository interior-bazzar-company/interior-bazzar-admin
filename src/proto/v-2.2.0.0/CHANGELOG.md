# Changelog — proto v-2.2.0.0 (admin)

Newest first. One entry per feature. Format: [LOG-FORMAT.md](LOG-FORMAT.md).

---

## 2026-08-21

### Fix: the three-dot menu opened and closed inside one click

**Area:** `#/business-enquiries/:id` — record header
**Files:** `Detail.tsx`, `scripts/check-enquiry-wiring.cjs` (new), `package.json`

**The report:** "no dropdown showin". Pressing ⋮ did nothing visible.

**What was actually happening**

The menu opened every time. It also closed every time, during the same click,
before the browser had painted it.

`PopBox` in `src/admin/shell/ShellContext.tsx` mounts a popover together with a
document-level click listener:

```ts
const onDoc = (e: MouseEvent) => {
  const t = e.target as HTMLElement;
  if (!t.closest(".pop") && !t.closest("[data-act]")) onClose();
};
document.addEventListener("click", onDoc);
```

A click is a **discrete** event, so React flushes the whole update it triggers —
render, commit, layout effects and passive effects — before the native event
finishes bubbling up to `document`. By the time the press that *opened* the menu
reaches `document`, the listener that closes it is already registered. The target
is the ⋮ button: not inside `.pop`, and — in this module — not `[data-act]`
either. So it closed itself.

`data-act` is the escape hatch for exactly this, and every other popover trigger
in the panel already carried one — `in-more` on the invoice header, `qt-more` on
the quotation header, `doc-more` on the document page. This module's trigger was
written without one, so the menu has never opened since the day it was added.

**The fix:** `data-act="be-more"` on the trigger. One attribute.

**Why this needed more than the attribute**

Nothing could have caught it. It is not a type error, not a lint error, and it
throws nothing at runtime — the console is clean and the menu is simply absent.
The markup looks correct in review, because the attribute that is missing looks
like a test hook rather than a mechanism.

So it is now asserted. `npm run check:wiring` walks every JSX opening tag in the
module and fails any element that declares `aria-haspopup` without `data-act`,
plus checks the trigger and `RecordMenu` are still connected to each other. The
comment above the button explains the mechanism rather than restating the rule,
because the next person to copy this button into another module needs the reason,
not the instruction.

The check is scoped to Business Enquiries deliberately. The same rule holds
panel-wide, and several older Deals triggers (`Chat.tsx`, `Drawer.tsx`,
`Tags.tsx`) declare `aria-haspopup` with no `data-act` — they may be using a
different mechanism or may have the same latent bug, but that is not this
module's suite to fail on. **Worth a look separately.**

**For the API:** nothing. This is client wiring only.

**Not verified in a browser.** Same standing reason: `me/permissions/` has no
backend, so `RequireSession` holds before the router reaches any module. The
mechanism is confirmed from the shell source and from the three working triggers
that differ from this one by exactly this attribute.

## 2026-08-21

### Copy gets its own press; the dots move to the right end

**Area:** `#/business-enquiries/:id` — record header
**Files:** `Detail.tsx`, `menus.tsx`, `enquiries.css`

**What changed**

**The ⋮ is now the last thing in the row.** It sat before "All enquiries", so
the overflow menu was not at the end of anything.

**Copying an enquiry has its own button.** It is far and away the most frequent
thing anyone does *with* a record — more often than printing it, imaging it or
quoting its reference — and it was three presses down a menu. Now:

`… ‹ 1/1 › · All enquiries · [ Copy | ⋮ ]`

Drawn as a **split control** rather than two loose buttons, because that is what
it is: one primary action with a drawer of alternatives. The two share a border
and the pressed one comes forward, or the shared 1px edge swallows the focus ring
on the left button.

**The menu no longer repeats it.** A split control that lists its own default
action makes the first row of the menu the one thing nobody needs to open the
menu for. What is left behind the dots is the four alternatives: **Copy one
line · Copy reference · Download image · Print sheet**.

**One implementation of "copy", used twice.** `useCopy` / `useCopyDetail` in
`menus.tsx` back both the button and the menu rows. Two call sites each doing
their own clipboard handling is how one of them ends up reporting success over a
clipboard that was never written — `copyToClipboard` reports what actually
happened (it falls back to "press Ctrl+C" where the async clipboard is refused,
which `vite --host` on a LAN IP is), and both paths now surface that same answer.

**Temp data**

`none`.

**Backend needed**

`none`.

**Verified**

`npx tsc -b`, `npx eslint`, `npx vite build --mode dev`, `npm run check` (four
suites) all clean. Checked the rendered order of the id bar: the ⋮ is the final
element, and `useCopyDetail` is called above the component's early return so the
hook order is unconditional.

**Not verified in a browser.** The split button's joined border and the popover
anchoring to a control now flush against the right edge are the two things to
look at.

---

### The attention strip stops being a list of every status

**Area:** `#/business-enquiries` — attention strip
**Files:** `List.tsx`, `enquiries.css`

**What changed**

The strip had grown to **fifteen cells** — every lifecycle state, both ownership
questions and every flag. At that size it was no longer an attention surface; it
was a second copy of the Status dropdown printed permanently across the top of
the page. **A row where everything is highlighted highlights nothing.**

**Five cells survive**, and each passes the same test: *somebody has to do
something about this number today.*

| Cell | Whose failure | What it means |
| --- | --- | --- |
| **untouched** | ours | nobody has contacted this customer at all |
| **overdue** | ours | we promised to ring back and did not |
| **ready** | ours, pending | qualified and waiting on the routing decision |
| **SLA breached** | theirs | a business has had it a day and not answered |
| **no eligible** | nobody's | matching found nobody — a coverage gap |

Five different **kinds** of failure, which is why it is five and not three. Plus
**total**, which is how you clear.

**Nine cells moved behind a `+9 more` disclosure — hidden, not deleted**, and
none of them lost a filter, because each already had a control:

| Hidden | Still reachable via |
| --- | --- |
| in qualification · assigned · delivered · acknowledged · converted · invalid | the **Status** filter |
| mine · unclaimed | the **Owner** filter |
| callback due (scheduled, not yet late) | the **Callback soonest** sort |

Those are states you look things up *by*, not work waiting to be done. The strip
is for the second kind.

**One detail that matters more than it looks.** If a hidden count is the
*currently active* filter, the row expands on its own and the disclosure reads
**Filtered** rather than a disabled "Fewer". A filter you cannot see is a filter
you cannot clear — and a disabled button labelled with the thing it will not do
reads as broken rather than as deliberate.

**Temp data**

`none`.

**Backend needed**

`none` — no filter key changed, and every count was already derived client-side
from the same list payload.

**Verified**

`npx tsc -b`, `npx eslint`, `npx vite build --mode dev`, `npm run check` (four
suites) all clean. Checked directly that each of the nine hidden counts still has
a control on the screen: `status`, `owner` and `sort` are all present in the
filter grid.

**Not verified in a browser.** With six cells the strip should now fit one line
at 1280px without wrapping — that is the claim to check.

---

### The filters go back beside the search, on a grid

**Area:** `#/business-enquiries` — command area
**Files:** `List.tsx`, `menus.tsx`, `bits.tsx`, `enquiries.css`

**What changed**

**The header filtration row from the previous entry was wrong and is gone.** It
gave the page a **second search box**, and once every filter is back beside the
first one it duplicated the selects too. Removed entirely.

**All filters are inline with the search again**, and this is the third place
they have lived — a flex row that wrapped raggedly, then a popover that hid
them, then a table-header row that duplicated the search. Each move treated the
symptom. **The problem was never where they lived: it was that a ragged wrap has
no alignment to read.** Eleven controls of eleven widths break at eleven
different places, and the second line starts wherever the first ran out.

So they are a **grid** — `repeat(auto-fill, minmax(158px, 1fr))`, every cell the
same width and the same height. A wrapped grid falls into **columns**: the fifth
control sits under the first whatever the window is doing, and a second line
reads as a deliberate row rather than as overflow. That is what makes "all the
filters beside the search" survivable at twelve of them.

Two bands, split by kind rather than by what fits: **actions** (search · Export ·
Add enquiry) and **filters** (the grid). Search takes whatever room is going — it
is the fastest route to one record; everything else narrows a set.

**The "More filters" button is gone**, and `FiltersPanel` with it — dead code
that still compiles is the kind that gets copied into the next module.

**The SLA sweep button is gone from the toolbar — and moved into the prototype
banner**, next to "Reset data". Neither is a product feature: on the real thing
the seed does not exist and the sweep is a cron job nobody presses. A
prototype-only button sitting beside Export and Add enquiry teaches the wrong
toolbar; inside the banner that says *none of this is real*, it teaches the right
one. The capability is kept, not deleted.

**Alignment.** Every band now starts at the same x — actions, filter grid,
attention strip, filter chips and the table. They were four different insets,
which is what the note about alignment was pointing at.

**Two labels meant two things.** "State" was the lifecycle filter *and* the
region filter, side by side in the same grid. Lifecycle is **Status** now,
everywhere on this screen including the table column and the filter chip; the
region keeps **State**. The Sort control's empty option says **"Sort: Needs
attention"** rather than "Sort", so the current order is legible without opening
it.

**Temp data**

`none`.

**Backend needed**

`none` — no filter key changed, so the list contract is untouched.

**Verified**

`npx tsc -b`, `npx eslint`, `npx vite build --mode dev`, `npm run check` (four
suites) all clean. Checked directly: **exactly one** `SearchField` in the list,
no `FilterRow`, no "More filters", no SLA sweep in the command area, and **no
dead CSS** — `.be-frow`, `.be-fsel`, `.be-finp`, `.be-fpair`, `.be-filterbtn`,
`.pop-filters` and the panel's field rules are all removed rather than left
orphaned.

**Not verified in a browser.** The grid's wrap points at 1280px and 1440px are
the thing to look at first — the whole change is an alignment claim.

---

### Detail-view CSS, header filtration, Remarks, Download image & Copy detail

**Area:** `#/business-enquiries` (table header) · `#/business-enquiries/:id`
(id bar, Remarks, three-dot menu)
**Plan:** [OPERATION-2026-08-21-detail-css-filters-remarks-share.md](OPERATION-2026-08-21-detail-css-filters-remarks-share.md)
**Files:** `bits.tsx`, `Detail.tsx`, `List.tsx`, `menus.tsx`, `exportCsv.ts`,
`ExportModal.tsx`, `share.ts`, `store.ts`, `enquiries.css`,
**`imageSheet.ts` (new)**, `src/content/business-enquiries/enquiries.json`,
`scripts/{check-enquiry-seed,check-enquiry-export,check-enquiry-share}.cjs`,
`package.json`

**What changed**

**1 · The black bar in the record header.** `TierBadge` took a `withHelp` prop
that rendered the tier definition as a second child — and `.be-tier` is an
`inline-grid`, so two children became two **rows**. An id-bar override released
the width, so the badge stretched across the whole flex line as a black bar with
the letter floating in it and the definition spilling below its fixed 20px
height. One prop, both artefacts. A badge is a badge now: one letter, 20px
square, definition on the `title` and written out behind the (i) on the Enquiry
block. Also added the missing row-gap on the wrapped id bar and pinned every
child to `flex: 0 0 auto`, so nothing in that row can grow to fill it again.

> The **small red dot** below the chips in the screenshot is not accounted for by
> anything I can find in that row. The malformed badge subtree was the most
> likely source and is gone; if it survives, it needs a browser to find. Saying
> so rather than claiming it fixed.

**2 · The filtration row is back, in the table header.** A second `<thead>` row,
one control under the column it filters — Tier, From, Category + City, Urgency,
Owner, Callback, State, Business, Age. A control under "Urgency" needs no label;
its position is its documentation.

**It adds no filter logic.** Every control writes the same `Params` key the
Filters panel writes, through the same `onFilter`, so the chips, the strip, the
export scope and the URL all move together. The panel stays for what has no
column — tag, state, and the custom date window — and is relabelled **More
filters**. The search placeholder was shortened so it stops truncating mid-word.

**3 · Remarks.** An internal note thread, deliberately **not** a contact-log
entry:

| | Contact log | Remark |
| --- | --- | --- |
| Records | an attempt to reach the customer | an internal note |
| Contains | what the customer **said** | what **we** think |
| Leaves the panel | the summary only | **never** |

Folding remarks into the log would mean inventing a fake attempt to hold each
one, and every count that reads the log would inherit it — `contactLog.length`,
`everReached()` and the qualification gate all treat a row as evidence somebody
picked up a phone. Append-only, allowed at any status, `Ctrl`+`Enter` to add. The
list shows **that** a record has notes, never what they say. The timeline records
that one was added and by whom — never its text.

**4 · The three-dot menu** is now **Copy detail** · Copy one line · Copy
reference · **Download image** · Print sheet.

- **Download image** — a 1080×1350 PNG drawn on `<canvas>`, no library. A
  rasteriser would be ~200 KB for one button and would screenshot whatever theme
  the user happens to be in, so a dark-mode operator would send a dark card.
  Hand-drawn is deterministic and identical for everyone.
- **No company name on it, anywhere** — no wordmark, no entity, no domain. It is
  made to be forwarded and cannot be withdrawn once it has been; the reference
  identifies it and whoever receives it knows who sent it.
- **Print sheet stays and keeps the company name**, which is the distinction
  rather than an inconsistency: that one is an internal document.

**A real defect this work uncovered.** The new share guard found that
`match_rank` and `match_score` were in the **Assignment** export group, which is
**on by default** — while the same dialog offers a business-scoped export as
"the file to send a business about its own enquiries". That combination handed a
business the exact number it was ranked on, which turns routing into a
negotiation and the weight table into something to game. They now live in their
own **Matching internals** group: off by default, flagged internal, and the
Download button is **disabled outright** while it is ticked together with a
business filter. Kept rather than removed — match-score distribution is a named
admin metric.

**Temp data**

`enquiries.json` → `remarks[]` on every record, with two worked examples so the
distinction from a contact-log entry is visible in the seed rather than only in a
comment.

**Backend needed**

- `POST /business-enquiries/{id}/remarks` (**BE-T12**) → append-only, any status.
  Appends a `REMARK` event carrying only the fact and the actor. **`GET
  .../timeline` must not return remark text either** — the timeline is the one
  surface a business-scoped read could plausibly reach one day.
- `GET /business-enquiries` → a remark **count** on the list row; the text must
  not be on the list payload at all.
- `GET /business-enquiries/{id}` → `remarks[]` newest-first, **operations scope
  only**.
- The export's `matching` group must be refused server-side for a
  business-scoped request, not merely unticked in the client.

**Verified**

`npx tsc -b`, `npx eslint`, `npx vite build --mode dev`, and `npm run check` —
now **four** suites.

`check:share` is new and guards the rule across all four export paths. It is a
**source-level** check for three of them, and says so in its own header rather
than implying more: a canvas needs a DOM and the print sheet is a string handed
to a browser, so neither can be executed in node. It catches the realistic
regression — somebody adding `remarks[0].text` to a layout because it would be
useful there.

Everything new was **negative-tested**: leaking remark text into the CSV, putting
`match_score` back in a default group, and putting the company name on the image
each fail with the exact message and exit 1, then pass again on revert. The first
draft of the guard also produced a **false positive** — it matched the `.note`
CSS class inside the print sheet's own stylesheet and reported a font-size as a
leak. Tightened to require a word character before the dot, and the reason is in
the code, because a check that cries wolf gets switched off.

**Not verified in a browser.** No backend. Three things to look at first: the
filtration row's alignment at 1280px, the record header now the badge is fixed
(and whether that red dot survives), and the generated PNG at actual size.

---

## 2026-08-20

### Explanation behind an (i), not on arrival

**Area:** whole module — every screen
**Files:** `src/admin/views/BusinessEnquiries/{bits.tsx,Detail.tsx,Suggestions.tsx,Qualify.tsx,Modals.tsx,ExportModal.tsx,NewEnquiry.tsx,List.tsx,menus.tsx,enquiries.css}`

**What changed**

An audit of the module found **about 1,500 words of rationale in the notices and
block headings alone, all of it permanently on screen** — why a snapshot is
frozen, why the panel ranks but never computes, why an enquiry is not a deal.
Every sentence was worth writing and almost none of it was worth reading twice.
A screen that explains itself continuously reads as unsure of itself, and the
prose was crowding out the numbers and states somebody opened the page for.

The rule now: **the screen carries what you need to act, the (i) carries why.**

Three components in `bits.tsx` make it one affordance rather than nine
improvisations:

- **`BlockHead`** — a card heading with its rationale folded behind an (i). Most
  of the prose sat at the top of a card, which is exactly where this goes.
- **`InfoNote`** — a notice showing only the line you have to read, with the
  reasoning one press away. Used without children it is just a notice, which is
  right for a warning that has no subtext.
- **`InfoDot`** — the button alone, for a label that is not a `BlockHead`.

**What stayed visible, and why.** Six notices survive as always-on, and they are
the six that block or warn before a press: `422 override_reason_required`, "no
other eligible business", "this enquiry is an exception, not an invalid one", the
duplicate-phone check, the customer-contact warning on export, and "nothing
matches these filters". Empty states stayed too — they are the one place where
prose *is* the content. So did the prototype banner.

**What moved.** Everything that answers *why* rather than *what now*: the frozen
snapshot explanation, "copied not referenced", "stored not recomputed",
"recommendation is not assignment", "an enquiry is not a deal", the append-only
grant-level rule, the business's-sale-not-ours rule. Long field hints were cut to
one line each — "Masked in this prototype" rather than a sentence about OTPs.

**Nothing was deleted.** An explanation worth writing down is worth keeping; it
just stops being the first thing on the screen every single time.

Measured after: **340 words always on screen, ~1,160 behind the (i)** — 24
always-on notices down to 6, and 13 free-floating prose blocks down to none.

**Temp data**

`none` — no content changed.

**Backend needed**

`none`.

**Verified**

`npx tsc -b`, `npx eslint`, `npx vite build --mode dev`, `npm run check` (three
suites) all clean.

The word counts above are measured, not estimated — a script strips code
comments and JSX tags and counts what is inside `short=`/`text=` (visible)
against `InfoNote` children and `BlockHead info=` (folded). The first draft of
the `bits.tsx` header claimed "roughly nineteen hundred words" from memory; the
measurement said 1,499, and the comment was corrected to the measured figure
rather than left as a number nobody had checked.

**Not verified in a browser.** No backend. The (i) expansion is in-flow rather
than a popover, deliberately — the panels have `overflow: hidden` and a
positioned tooltip would clip inside them — so the thing to check first is that
expanding one inside the qualification panel does not push the freeze footer
around unpleasantly.

---

### Three sources, typed fields, and a clock filter that works

**Area:** `#/business-enquiries` — filter panel, Add enquiry, the record's requirement form
**Files:**
`src/content/business-enquiries/{enquiries,vocabularies}.json`,
`src/admin/views/BusinessEnquiries/{store.ts,bits.tsx,NewEnquiry.tsx,Qualify.tsx,menus.tsx,List.tsx,index.tsx,exportCsv.ts,share.ts,Detail.tsx,enquiries.css}`,
`scripts/{check-enquiry-seed,check-enquiry-clock}.cjs`, `package.json`

**What changed**

**1 · Three channels, not four.** "Website" and "Funnel page" were the same thing
wearing two names — both a form on a page we publish, matched by the same rules
and qualified by the same questions — and a distinction nobody acts on is a
filter option that only makes the list harder to reason about. The exact page is
still recorded on every enquiry, so nothing was lost. The seed record that used
`website` went back to the funnel it actually came from.

The source picker is **three chips on one line with the descriptions behind an
(i)**. It was four cards carrying a sentence each: a paragraph of reading before
the first field, every time, for a choice that is usually obvious from the fact
that you are typing the enquiry yourself. The explanation still exists for the
once it is not.

**2 · Category, city and state are typed, not picked.** An operator on a call
hears whatever the customer says; a `<select>` that cannot hold it forces a wrong
pick or a blank, and both are worse than an unfamiliar value. They are text
inputs backed by a `<datalist>` of the values we already use — type anything, the
known ones are a keystroke away.

The trade is real and is **shown rather than hidden**: stage 1 eliminates on
category and location, so a value the matching rules have never seen will match
nobody. When that is about to be true the field says so underneath, as a note and
not an error — the value may be perfectly correct and the vocabulary simply
behind, and an enquiry from a city we do not cover is precisely the evidence that
says where coverage is missing.

**State** is new, alongside city, and threads through the record, the export, the
share text and the printed sheet. An address that stops at the city is one a
business in the next state over can still look plausible against.

**3 · The clock filter is real.** There was a clock icon in the command row that
**ran the SLA sweep** — an unlabelled clock sitting in a row full of filters,
reading as "filter by time" and doing something else entirely. It is labelled
**SLA sweep** now, and time filtering exists properly:

- **When it arrived** leads the filter panel, because "what came in today" is the
  question this screen gets opened with more often than any other.
- Today · Last 24 hours · Last 7 days · Last 30 days · This month · Older than 30
  days · **Custom range**, with either end optional — "everything since the 1st"
  and "everything before the 9th" are real questions, and demanding the other end
  to ask them is the kind of form people give up on.
- Windows are **resolved when the filter runs**, never when it was set. A range
  stored as two absolute instants silently stops meaning "today" tomorrow, while
  the chip still says Today.
- The chip names the **window**, not the key: "Received: Last 7 days", and one
  chip for a custom range rather than three. Removing it removes the `from`/`to`
  it was made of, so the next range picked cannot inherit stale bounds.

**Temp data**

- `vocabularies.json` → `sources` down to three; new `states`, `receivedRanges`;
  a note that `categories`/`cities` are now **suggestions, not a closed set**.
- `enquiries.json` → `requirement.state` on every record, inserted in address
  order; the `website` record reverted to `funnel`.

**Backend needed**

- `GET /business-enquiries?received=&from=&to=` → the same seven windows,
  resolved **server-side at request time**. A client sending two absolute
  instants would be the same bug in a different place.
- `requirement.state` on both payloads and as a `state` filter.
- Category and city are now free text. The API must accept values outside its own
  vocabulary and **must not silently coerce them** — a value quietly rewritten to
  the nearest known one is worse than one that matches nobody, because the second
  is visible.

**Open decisions**

- `BE-OD-22` — should an off-vocabulary category or city raise something an admin
  sees, rather than only a note on the form? Assumed not yet: the note is where
  the person who can fix it is standing. A queue of "unknown values" is the right
  answer once there is somebody whose job it is to drain it.

**Verified**

`npx tsc -b`, `npx eslint`, `npx vite build --mode dev`, and **`npm run check`**,
now three suites.

`npm run check:clock` is new: the real store module bundled by esbuild, at a
**pinned mid-afternoon "now"** — the window function takes `now` as a parameter
precisely so it can be pinned rather than tested against whatever today is. It
asserts that midnight belongs to exactly one day, that `30d` and `older` are
complements with no gap and no overlap, that an open-ended custom range works
from either end, that the "to" date includes its whole day, and that the chip
names the window rather than the key. **Negative-tested** by removing the
end-of-day adjustment from the custom range — it fails with
`the "to" date is not inclusive of its own day` and exits 1.

The seed check gained: exactly three channels, and a state that never appears
without a city.

**Not verified in a browser.** No backend. `<datalist>` styling is the browser's
and not the panel's — worth a look in Firefox and Safari, which draw it
differently from Chrome.

---

### Filters into a panel, and an export that matches the screen

**Area:** `#/business-enquiries` — command row, filter panel, export dialog
**Files:**
`src/admin/views/BusinessEnquiries/{exportCsv.ts,ExportModal.tsx,menus.tsx,List.tsx,enquiries.css}`,
`src/content/business-enquiries/enquiries.json`,
`scripts/check-enquiry-export.cjs`, `package.json`

**What changed**

**The command row is three parts now: find it, narrow it, act on it.** Nine
selects used to sit beside the search box. The row wrapped on a laptop, and
Export moved depending on how wide the window was — the worst property a button
that writes a file full of customer data can have. Search, a **Filters** button
and Sort on the left; the sweep, Export and Add enquiry on the right, always in
the same place.

Collapsing the filters hides nothing: an active filter still renders as a chip
under the strip, which is where it was already read and cleared. The button
carries a count so "why am I seeing four rows" is answerable without opening it.
Inside, the filters are grouped by the **question** they answer rather than by
field type — *Who is on it* (owner, state, tag, needs-attention), *What it is*
(category, city, urgency, tier, from), *Where it went* (business). Somebody
picking up the morning's work uses the first group and nothing else, so it is
first.

**Export now does what it says, and says what it will do.** It was a toast
saying the API was missing. It is a real CSV of **the rows on screen, in the
order they are on screen** — filtered and sorted, not a fresh unfiltered query.
That is the whole contract, and it is worth stating because the alternative is
the bug: narrow to one business, press Export, get everything.

- **The button carries the row count.** "Export" is a button you press to find
  out what happens; **"Export 7"** has already answered the question, and it
  changes as the filters change. It is dashed when the count is a subset.
- **It is amber, not brand.** Prominent, because it is the only control here
  that produces a file of customer data and the only one whose scope depends on
  settings made elsewhere. Not primary — Add enquiry is.
- **The dialog leads with the scope**, as a sentence built from the same filters
  the rows came from, so it cannot describe a set other than the one being
  written. Filtered to a business, it says so and points out that this is the
  file to send that business.
- **Columns are groups, and customer contact is off by default**, with the
  warning beside the tick rather than in a footnote. Ticking it changes the
  confirm button to "Download with contact data" and turns it red.
- **The filename carries the scope** — `enquiries_studio-aangan_delivered_4_2026-08-20.csv`.
  A business-scoped export named `enquiries.csv` is the one somebody forwards
  believing it is everything.
- **"Ignore the filters and export all"** is a tick inside the dialog, not a
  second button on the toolbar: it is a decision, and it belongs where its
  consequence is printed beside it rather than one slip from the filtered one.
- A BOM, because Excel opens a bare UTF-8 CSV in the local codepage and turns
  every accented name into mojibake.

**The contact log is not exportable at any tick.** Same rule `share.ts` enforces
for copy and print — our notes about a customer, written by an operator for an
operator; the only line meant for anyone else is the requirement summary. Three
export paths now share one rule, which is exactly when a rule starts to rot, so
it is asserted in code rather than in a comment.

**Temp data**

`enquiries.json` → four records had `contactLog[0].response` seeded **identical**
to `qualification.requirementSummary`. Unrealistic — speech and a written summary
are never verbatim the same — and it made the export test unable to tell a leak
from a coincidence. Replaced with distinct customer-voice lines.

**Backend needed**

- `GET /business-enquiries/export?<the same filters>` → when it exists it must
  apply **the same filter set** the list does and return rows in the same order.
  A server export that quietly ignores a filter is the failure this dialog is
  built to prevent. Column groups should be a request parameter, and the contact
  group should be refused server-side unless the actor holds the grant — the
  client hiding it is a convenience, not the control.
- The export action wants its own permission (`business-enquiries.export`) rather
  than riding on `close`, which is what the panel checks today.

**Verified**

`npx tsc -b`, `npx eslint`, `npx vite build --mode dev`, and **`npm run check`**
— which now runs two suites.

`npm run check:export` is new and runs the **real** module, bundled by esbuild,
against the real seed: contact absent unless ticked, contact log never present at
any tick, BOM, CRLF, one cell count per row, and a value containing a quote, a
comma and a newline that does not tear the row in two. It was
**negative-tested** by adding a `last_response` column to the exporter — it fails
with six leak messages and exits 1, then passes again once reverted.

**Not verified in a browser.** No backend. The filter popover's height against a
short viewport, and the print sheet from the previous entry, are the two things
to look at first with a live session.

---

### Manual intake, provenance, and taking an enquiry out of the panel

**Area:** `#/business-enquiries` (Add enquiry, From column and filter) ·
`#/business-enquiries/:id` (overflow menu)
**Files:**
`src/content/business-enquiries/{enquiries,vocabularies}.json`,
`src/admin/views/BusinessEnquiries/{NewEnquiry.tsx,menus.tsx,share.ts,store.ts,List.tsx,Detail.tsx,bits.tsx,index.tsx,enquiries.css}`,
`scripts/check-enquiry-seed.cjs`

**What changed**

**1 · The Create button is back. This supersedes "there is no Create button"**
in the first entry of this log.

The original objection was that a hand-typed enquiry has no submission id, no
duplicate check and no qualification snapshot — a record with no provenance in a
queue that runs on provenance. That was right about the danger and wrong about
the cause. The danger is the missing guarantees, not the human typing. People
ring the office, walk in, and get referred; refusing to record it does not stop
it happening, it just means the enquiry gets worked in somebody's notebook and
the business it eventually reaches is chosen with none of this module's
machinery.

So the form exists and the three guarantees are kept by the form instead:

- a submission id, prefixed `man-` so the origin is legible in the id itself
- **the same duplicate check**, run against every existing enquiry as the phone
  number is typed and shown *before* the record exists rather than reported
  after. Matching on the last ten digits, so formatting cannot defeat it.
  Creating anyway needs an explicit tick and tags the record
  `duplicate-suspected`
- it lands in **Generated** with an empty checklist and must be qualified by a
  person like any other. Typing it yourself buys no shortcut past the gate,
  because the gate is what a business is trusting when it accepts the enquiry

And it records the one thing an inbound enquiry cannot: who typed it. Tier is
computed from what was actually filled in rather than chosen — a manual enquiry
is not automatically a good one, and `A` is unreachable by this route because it
requires verified contact. Whoever creates it owns it; they have just spoken to
the customer, and leaving it unclaimed would put it back in the pile they took it
out of. Everything except name, phone and how it reached us is optional: the
person filling this in is usually still on the call, and a required field they
cannot answer yet is one they will guess at.

**2 · Every enquiry says where it came from.** A `sources` vocabulary — **funnel ·
website · portal · added by us** — with a From column, a From filter, and a chip
on the record. A manual one additionally carries `via` (phone, WhatsApp, walk-in,
referral, email, event) and `createdBy`, both shown on the chip: "added by us"
without a name is the absence of provenance wearing the word. The seed gains a
website record and a worked manual one, so all four channels appear in the list
rather than only the two the first seed happened to use.

**3 · Copy and download, from an overflow menu on the record.**

- **Copy for WhatsApp** — plain text, no markdown, because `*bold*` renders in
  one app and shows as punctuation everywhere else.
- **Copy one line** — reference, name, phone, category, location.
- **Copy reference.**
- **Download / print** — an A4 sheet through the existing `printHtml`, the same
  route Quotations and Invoices already use for documents. It is print-to-PDF
  rather than a generated file: one press further away, but a real PDF with
  selectable text and correct page breaks, and one way documents leave the admin
  instead of two.

Both shapes are built from one description in `share.ts`, so neither can quietly
start including a field the other does not. **What never leaves, in either:** the
contact log (those are our notes about a customer — "sounds genuine, just busy"
is fair to write and indefensible to forward; only the requirement summary, which
a person wrote deliberately for a business to read, crosses over — BE-OD-16), the
score and rank and who else was eligible, and any money. The customer's **phone
number does leave**, and the menu says so on the panel before the press rather
than pretending otherwise: a copied enquiry is personal data that has left the
audited surface for a chat app nobody can revoke it from.

Lifecycle actions stay on the action bar in the open. Only things that change
nothing went into the overflow — a state change behind a three-dot menu is one
nobody expects and nobody audits.

**Temp data**

- `vocabularies.json` → new **static copy**: `sources[]` (with `manual` and
  `help`), `manualVia[]`.
- `enquiries.json` → `source` gains `createdBy` and `via` on every record; one
  record moved to `website`; one new `own` record added by hand.

**Backend needed**

- `POST /business-enquiries` (**BE-T11**) → create by hand. Body: source, via,
  customer, requirement, urgency, text. Server generates the reference and the
  `man-` submission id, stamps `createdBy` from the session, runs the **same**
  duplicate rule as intake and returns matches rather than refusing, sets status
  `generated` with an empty checklist, and owns it to the creator. `403` unless
  the actor holds `business-enquiries.create`.
- `GET /business-enquiries?phone=` → the duplicate lookup the form calls while
  typing. Must be the same rule the intake endpoint applies, or the warning and
  the enforcement disagree.
- `GET /business-enquiries?source=` filter; `source{kind,page,label,createdBy,via}`
  on both list and detail payloads.
- `GET /business-enquiries/{id}/sheet` → **optional**. The printable sheet is
  built client-side today. Quotations gets its document HTML from the server, and
  moving this one there later would put the layout under one owner — but it is
  not blocking, and a client-built sheet cannot leak a field the client does not
  already hold.

**Open decisions**

- `BE-OD-20` — may a manual enquiry ever skip qualification when the creator has
  just had the conversation? Assumed **no**, and the form says so. Reconsider only
  with a named role and an audit event, never as a checkbox.
- `BE-OD-21` — should the duplicate check block, or warn and record? Assumed warn,
  tick and tag. Blocking would push the second enquiry into a notebook, which is
  the outcome the whole feature exists to prevent.
- `BE-OD-16` is now **enforced in code**, not merely asserted:
  `share.ts` is the only export path and it does not read `contactLog`.

**Verified**

`npx tsc -b` clean, `npx eslint` clean, `npx vite build --mode dev` succeeds,
`npm run check:enquiries` passes at 13 enquiries.

The seed check gained provenance assertions and was **negative-tested**: with a
manual record stripped of its author, an unknown source key and an inbound record
claiming a `via`, it fails with exactly those three messages and exits 1.

**Not verified in a browser** — no backend, so `me/permissions/` never resolves.
The print sheet in particular has been written but never rendered: check it at A4
in the browser's print preview before trusting the page breaks.

**One thing corrected on the way past**

The first draft of the CSS put `container-type` on `.md-b`, which is every modal
in the panel — and containment makes an element a containing block for absolutely
positioned descendants, so it could have moved things in Quotations and Invoices.
Scoped to a `.be-fields` wrapper instead. Worth recording because it is the kind
of cross-module regression a module-scoped stylesheet is supposed to make
impossible, and it got in anyway.

---

### Module review — layout defects, ownership, and callback times

**Area:** `#/business-enquiries` and `#/business-enquiries/:id` — whole module
**Files:**
`src/content/business-enquiries/{enquiries,vocabularies}.json`,
`src/admin/views/BusinessEnquiries/{store.ts,List.tsx,Detail.tsx,Qualify.tsx,Suggestions.tsx,bits.tsx,index.tsx,enquiries.css}`,
`scripts/check-enquiry-seed.cjs`

**What changed**

A read-through of the finished module found more than expected, and the two worst
items made the core screens unusable as drawn.

**The panel cut off its own primary action.** `.be-sp` was a plain sticky box with
no height limit. Both panels are taller than a laptop viewport — the qualification
one especially — and a sticky element taller than the viewport stops moving once
its top edge reaches the offset, leaving its bottom permanently below the fold.
That bottom is where **Mark qualified** and the assign actions live. Both panels
are now a flex column with a capped height, a scrolling body (`.be-sp-scroll`) and
a footer that cannot be pushed out of reach.

**Every breakpoint was about 310px wrong.** They were media queries, but this
module renders inside a 248px sidebar plus 64px of page padding, so a 1280px
viewport leaves roughly 968px of content. The record collapsed and the form
squeezed at the wrong widths — and the whole "one screen, one decision" premise
failed on exactly the laptop an operator uses. Both are `@container` queries now,
measured against the element's own width: the pane against the record (980px), the
form against the block it sits in (520px).

**There was no owner.** The flow assumes a team, and nothing recorded who was
working which enquiry — so two qualifiers ring the same customer inside an hour and
the untouched pile is a number nobody is answerable for. Records now carry
`owner`, with **Claim / Take over / Release** and a hand-over select on the record,
an Owner column and filter on the list, and **Mine** and **Unclaimed** cells in the
strip. Unclaimed renders as a state to fix, not as a dash.

**A callback had no time on it.** `callback-due` was a tag and "call back after
4pm" was free text — nothing sorted on it and nothing knew when it lapsed. The
follow-up time is now a required field on any outcome the vocabulary marks
`requiresFollowUp`, lifted onto the record as `followUpAt`, replaced (never
accumulated) by the newest attempt, and cleared at qualification. The list gets a
Callback column, a "callback soonest" sort, and **due** split from **overdue** in
the strip. An overdue callback now outranks a breached SLA in the default sort:
the SLA is a business failing to answer us, an overdue callback is us failing a
customer we personally promised to ring.

Also fixed:

- **A11y** — checklist rows and tag chips are toggle buttons with no state
  exposed. Both carry `aria-pressed` now; tags carry a full `aria-label` rather
  than help text hidden in a `title`. Disclosure buttons carry `aria-expanded`.
- **Tier was decoration with a filter on it** — displayed on every row, filterable,
  sortable, and defined nowhere in the module. The vocabulary defines it now (an
  *intake signal*: what the submission itself told us, not what the customer is
  worth) and the badge carries the definition.
- **`priority`** was on every record and rendered on no screen. Cut.
- **`#fff`** hardcoded in a file whose own header says "no literal colours".
- **The table had eight columns and no `min-width`** — the response column was
  squeezed to one word a line before a scrollbar ever appeared.
- **The strip scrolled horizontally**, hiding Converted and Invalid off the right
  edge. It wraps now.
- **Four bands of chrome** on the record before any content. The lifecycle rail
  shares the tab row — one band back.
- **Acknowledge sat in the Operations action bar** looking like an Operations
  action, with the warning only inside the modal, which arrives after the click.
  Fenced in a labelled dashed group instead.
- **Filters pushed history entries**, so Back walked backwards through filter
  states instead of leaving the list. They replace now.
- **Prev / next through the queue** on the record, with a position count. It steps
  through the *filtered, sorted* list the operator was actually reading, and shows
  no position for a record outside the current filter rather than lying with
  "0 of 9".
- Search placeholder names what it really searches; `AgeCell`'s tooltip prints a
  date instead of a raw ISO string; `line-clamp` beside the prefixed property;
  Ctrl/Cmd+Enter logs a contact without leaving the keyboard.

**Temp data**

- `enquiries.json` → every record gains `owner` (nullable) and `followUpAt`
  (nullable); every contact-log entry gains `followUpAt`; `priority` removed. One
  Generated record carries an **overdue** callback, one is **unclaimed**.
- `vocabularies.json` → `tiers` becomes objects with real definitions;
  `contactOutcomes.callback_requested` gains `requiresFollowUp`; new **`team`**,
  a stand-in for a read of the existing Team module.

**Backend needed**

Additions to the shapes already listed in
[BACKEND-INTEGRATION.md](BACKEND-INTEGRATION.md):

- `PUT /business-enquiries/{id}/owner` (**BE-T10**) → claim, hand over, release.
  Body `{ownerId | null}`, appends `OWNER`. Allowed at any status.
- `POST /business-enquiries/{id}/contacts` gains `followUpAt`, **required** when
  the outcome is marked `requiresFollowUp` → `422 followup_time_required`. It
  replaces the record's `followUpAt` rather than adding to it.
- `GET /business-enquiries` gains `owner` and `flag=followup|overdue` filters,
  `sort=followup`, and must return `owner` and `followUpAt` on the list row.
- The `team` vocabulary is **not ours** — it is a read of the Team module,
  filtered to members holding `business-enquiries` write access.

**Open decisions**

- `BE-OD-18` — should claiming be automatic on first logged contact? Assumed no:
  claiming is deliberate, because an accidental claim is worse than an unclaimed
  enquiry that is visibly unclaimed.
- `BE-OD-19` — may anyone take over an owned enquiry, or only a lead? Assumed
  anyone, with the hand-over recorded as an event.
- `BE-OD-15` (from the previous entry) is now measurable — the overdue count makes
  "how many attempts before Invalid" answerable from data rather than opinion.

**Verified**

`npx tsc -b` clean, `npx eslint` clean across the module and `scripts/`,
`npx vite build --mode dev` succeeds, `npm run check:enquiries` passes.

The seed check was extended to the new invariants and **negative-tested**: with a
stale `followUpAt`, an unknown tier and a non-existent owner injected, it fails
with exactly those three messages and exits 1. That matters more than the pass —
an assertion that has never failed has not been shown to work.

**Still not verified in a browser.** No backend, so `me/permissions/` never
resolves. The container queries and the panel scroll fix are the two things most
worth looking at first with a live session, at 1280×800 and at 1440×900.

**One project rule changed**

`.gitignore` carries a deliberate, commented project-wide `*.json` rule matching
the backend's. It was silently swallowing **every content file this module reads
from** — `git status` did not list them, so the module would have built to an
empty screen for anyone who cloned. Added `!src/content/**/*.json` with a comment
saying why, rather than relying on `git add -f`, which is a rule somebody forgets
exactly once. Flagging it because changing a rule someone set on purpose is not
mine to do quietly — revert the carve-out if the blanket rule matters more, but
then the content convention needs somewhere else to live.

**Deliberately not done**

- **Bulk actions** (multi-select, batch claim, batch tag). Real, and the natural
  partner of ownership once the untouched pile is in the hundreds — but it is
  selection state, a header checkbox, a bulk bar and three more writes, and it is
  better as its own pass than bolted onto this one.
- **Links out to the business and to the funnel page.** There is no business
  module and no funnel module in this panel, so there is nothing to link *to*.
  Inventing a dead link would be worse than the current dead end. It becomes
  trivial the day either route exists.

---

### Qualification workstream — a person qualifies the enquiry, and that is when it freezes

**Area:** `#/business-enquiries` (list) · `#/business-enquiries/:id` while **Generated**
**Files:**
`src/content/business-enquiries/{enquiries,vocabularies}.json`,
`src/admin/views/BusinessEnquiries/{Qualify.tsx,store.ts,Detail.tsx,List.tsx,bits.tsx,enquiries.css}`,
`scripts/check-enquiry-seed.cjs`, `package.json`

**What changed**

**This supersedes the freeze-at-intake decision in the entry below it.** The first cut
of this module had the qualification snapshot frozen automatically at intake and the
enquiry arriving at Ready to Assign with nobody having touched it. That left no room for
the thing the module is actually for. A funnel submission is a **claim**, not a fact:
someone skimming a landing page types "full home interiors" for one room, picks the
nearest city from a dropdown and leaves urgency at the default. Matching on that and then
freezing the result as history is how a business gets handed an enquiry that was never
real, with a snapshot proving we believed it was.

So **Generated is now a worked state**, and the record has a qualification workstream:

- **The record is editable while Generated.** Category, service, city, locality, PIN,
  project type, intent, urgency, and the customer's contact details. The operator on the
  phone is the one who finds out it is a renovation and not a fit-out. Every save appends
  an `UPDATED` event listing the changes field by field — a correction should be visible,
  not silent. After qualification the same block renders read-only.
- **A contact log.** One row per attempt: channel (call · WhatsApp · chat · email · SMS ·
  site visit), direction, outcome (connected · replied · callback requested · no answer ·
  busy · no reply · wrong number · not interested), **what the customer said**, and the
  operator's note. The customer's words and the operator's read are separate fields
  throughout, and only the first is ever given the quote treatment — one is evidence and
  can be repeated to a business, the other is interpretation and cannot.
- **Tags.** `new-enquiry` is applied at intake and removed by the first logged attempt, so
  the untouched pile is a real number. `contact-made`, `callback-due`, `unreachable` and
  `bad-contact` are recomputed from the log on every write, and carry a dotted marker in
  the UI so an operator can see which of their tags the next call will overwrite. Six more
  are set by hand. There is no tag for spend, size or value.
- **A four-item checklist**: contact reachable, requirement confirmed, genuine enquiry,
  urgency confirmed. Each carries the sentence that makes it mean something —
  "confirmed *with* the customer, not just as the form received them".
- **Mark qualified**, which is now **the freeze**. It stamps `qualifiedBy`, `frozenAt` and
  the qualification version, writes the requirement summary, and hands the enquiry to
  matching. It refuses unless all four checks pass **and** at least one contact is logged:
  four ticked boxes on an enquiry nobody rang is a formality, not a record.

Immutability is unchanged — it just starts later, at the point there is something worth
making immutable. `qualification.frozenAt` and `.version` are now nullable, and null means
"nobody has stood behind this yet".

On the list: three new strip cells (**in qualification · untouched · callback due**), a
tag filter, tag chips under each row, and a **Last response** column carrying the
customer's own words. That column is the one that makes the queue readable — category and
city are the same on half the rows, and what the customer said never is.

Also added `npm run check:enquiries`: an executable statement of the invariants the
screens assume, run against the content files. It is the shortest description of what the
API has to guarantee, and it is the only automated verification this module has.

**Temp data**

Placeholder records, extended:

- `enquiries.json` → every record gains `tags[]`, `contactLog[]`,
  `qualification.checklist{}`, `qualification.qualifiedBy/qualifiedByRole`;
  `qualification.version` and `.frozenAt` become nullable. **Three new records in the
  Generated state**: one part-way through qualification with a callback due, one attempted
  twice and never reached, one nobody has touched at all.
- `vocabularies.json` → new **static copy**: `contactChannels`, `contactOutcomes`,
  `qualificationChecklist`, `tags`, `qualificationVersion`. The `generated` status and the
  `generated → qualified` transition guard were rewritten.

**Backend needed**

Four writes, all Generated-only, all refusing once the snapshot is frozen. Full shapes in
[BACKEND-INTEGRATION.md](BACKEND-INTEGRATION.md):

- `PATCH /business-enquiries/{id}` → edit the requirement and contact while Generated
- `POST /business-enquiries/{id}/contacts` → append one contact-log entry, recompute tags
- `PUT /business-enquiries/{id}/checklist` and `PUT /business-enquiries/{id}/tags`
- `POST /business-enquiries/{id}/qualify` → **the freeze**. New refusal:
  `422 qualification_incomplete`

`GET /business-enquiries` grows a `tag` filter and must return `tags[]`, the checklist
progress and the last response on the list row — the queue is unreadable without them, and
they must not need a second request per row.

**Open decisions**

New, and none of them assumed silently:

| ID | Question | Assumed here |
| --- | --- | --- |
| `BE-OD-14` | Who may qualify? Any Operations member, or a named qualifier? | Anyone with write access |
| `BE-OD-15` | How many failed attempts before an enquiry should be closed Invalid? | Not enforced — the panel says three is usually the answer and leaves it to a person |
| `BE-OD-16` | Is the contact log ever visible to the assigned business? | No. Only the requirement summary crosses over |
| `BE-OD-17` | Do calls come from a dialler, or is the log typed by hand? | Typed. A CTI integration would replace the composer, not the log |

`BE-OD-01` (duplicate identity) gets sharper here rather than being answered: a person on
the phone is the one who notices this is the same customer who enquired last week, which is
why `duplicate-suspected` is a hand-set tag and not a computed one.

**Verified**

`npx tsc -b` clean, `npx eslint` clean on every new and changed file, `npx vite build`
succeeds, and `npm run check:enquiries` passes — 12 enquiries, 3 in qualification, with
the freeze rules, the newest-first ordering of both logs, the single-active-assignment
pointer, and the factors-sum-to-score identity all asserted.

**Still not verified in a browser**, for the same reason as the entry below: no backend, so
`me/permissions/` never resolves and the router never reaches a module. The qualification
flow specifically has been checked by reading, not by clicking — the first thing to walk
against a live session is `IB-BE-2026-0063` (untouched) from first call through to Mark
qualified, and `IB-BE-2026-0062` (two failed attempts) to confirm the blocked state reads
the way it should.

---

### Business Enquiries — the module, renamed and built

**Area:** `#/business-enquiries`, `#/business-enquiries/:id`
(`?tab=match|assignment|history`) · sidebar → Client Ops
**Files:**
`src/content/business-enquiries/{enquiries,suggestions,matching-rules,businesses,vocabularies}.json`,
`src/admin/views/BusinessEnquiries/{index.tsx,List.tsx,Detail.tsx,Suggestions.tsx,Modals.tsx,bits.tsx,store.ts,enquiries.css}`,
`src/admin/views/registry.tsx`, `src/admin/shell/modules.ts`,
`src/admin/auth/session.ts`, `tsconfig.app.json`

**What changed**

The panel now has a place to manage enquiries generated by Interior bazzar
funnel pages and the portal enquiry form, and to route each one to exactly one
subscribed business. The module is called **Business Enquiries** — renamed from
"Client Enquiry Management" in the spec, and from "Client Deals" in the
wireframe, on purpose: two records containing the word *deal* is the naming risk
that makes a business's revenue summable with ours, and the new name removes it.

Two screens carry the module. The **list** holds an enquiry for its whole life —
Ready → Assigned → Delivered → Acknowledged → outcome — rather than removing it
on assign the way a routing queue does; assignment is a transition, not a
deletion, which is why State and Assigned-to are columns that keep working
afterwards. The **record** is a page, not a drawer: requirement and qualification
snapshot on the left, the ranked **Business Suggestions** panel on the right,
because a routing decision needs both on screen at once and a drawer over a
table cannot carry that.

The structural decisions worth remembering, all of them enforced in `store.ts`
and stated on the screens that depend on them:

- **Two stages, in that order.** Hard eligibility filters first, weighted
  scoring second. A business that fails a hard rule is absent from the pool
  entirely — no score, however high, puts it back. The excluded half is not
  hidden: every exclusion is stored with the reason that caused it, and reached
  from the panel by a link, not a tooltip.
- **Every rank decomposes.** The score is `Σ(weight × factor_score)` normalised
  0–100, and the breakdown renders from the candidate's own stored factors
  against the rule version's weights. A rank the module cannot explain is a
  defect, not a feature.
- **Frozen at assignment.** Rank, score, the factor snapshot and the rule
  version are *copied* onto the assignment, not referenced. A later profile edit
  or weight change cannot rewrite why an enquiry was routed where it was.
- **One active assignment**, held by a single nullable `activeAssignmentId`
  pointer. Reassignment closes the current row (`supersededAt`) and opens a new
  one; it never deletes.
- **Budget exists nowhere** — not a field in any of the five content files, not
  a filter, not a sort, not a scoring factor, not a column. There is nothing for
  a future feature to reach for.
- **No Create button.** The funnel and the portal are the only intake channels;
  a hand-typed enquiry would have no qualification snapshot, no submission id and
  no duplicate check.

**Writes are simulated in memory, for this browser tab only** — there is no API
for this module yet. Every screen that can write says so in a banner, and a
reload restores the seed. What the simulation honours is listed at the top of
`store.ts`; what it cannot (row locks, concurrency, the 409/422 refusals) is
named in the dialog where each would fire, so the contract stays visible even
though nothing enforces it yet.

**Temp data**

All placeholder records except where noted:

- `enquiries.json` → 9 enquiries covering every lifecycle state, with
  `assignments[]` history, `outcome`, `sla` and an append-only `events[]`.
- `suggestions.json` → one candidate snapshot per matching run, keyed by
  enquiry: `eligible[]` with per-factor scores and per-factor *reasons*, and
  `excluded[]` with the stage and reason each failed on.
- `matching-rules.json` → the active rule version: eligibility rules, the
  30/25/15/10/10/5/5 factor weights, band thresholds, override threshold.
  **Mixed** — the weights are real configuration that will move server-side; the
  factor labels and notes are static copy.
- `businesses.json` → 10 subscribed businesses with categories, service area,
  plan, subscription state and capacity. **This one belongs to another module**
  (Business Profile / Subscription) and is read-only here.
- `vocabularies.json` → statuses, the transition matrix, urgency bands, tiers,
  categories, cities, outcome/invalid/reassign reason lists, and the API error
  contract. **Mixed** — the label text is permanent static copy; the lists
  themselves become server vocabulary.

**Backend needed**

See [BACKEND-INTEGRATION.md](BACKEND-INTEGRATION.md) for the full map with
request shapes. In short: 5 reads, 7 writes, 1 scheduled job, plus a `Module`
row for the key so the module leaves `PROTO_MODULES`.

**Open decisions**

Six are assumed on screen, and every screen that assumes one names it:

| ID | Assumed here | Where it shows |
| --- | --- | --- |
| `BE-OD-04` | Location is a coarse region string | Exclusion reasons, and one candidate's `from.location` says the match is coarse |
| `BE-OD-05` | Capacity is a per-month count | Assign dialog, capacity checks |
| `BE-OD-08` | "Materially lower" = 10 points below rank 1 | `matching-rules.json` → `overrideThreshold`; Assign dialog |
| `BE-OD-09` | Acknowledgement SLA = 24h | `enquiries.json` → `sla.ackHours`; Assignment tab |
| `BE-OD-10` | Outcome reason lists as drafted | `vocabularies.json` → `outcomeReasons` |
| `BE-OD-11` | Full customer contact released on delivery | Record header shows the phone from intake |

Two more are **not** assumed, because assuming them would be a lie: `BE-OD-01`
(duplicate identity rule beyond `submissionId`) and `BE-OD-02` (assignment
cardinality). The schema here is built for one active business per enquiry;
changing that later is a migration, not a setting.

One gap is neither assumed nor solved: **there is no business-user role.** The
whole acknowledge-and-report-outcome half of this module belongs to the client
business, and the permission matrix has no actor for it. The Acknowledge dialog
in this panel exists only so the chain is walkable, and it says in the dialog
that the real system must not offer that button to Operations.

**Verified**

`npx tsc -b` clean, `npx eslint` clean on every new and changed file,
`npx vite build --mode dev` succeeds.

**Not verified in a browser.** The panel will not render any view until
`me/permissions/` resolves, and there is no backend running against this
checkout — `RequireSession` holds on the retry screen before the router reaches
a module. So the layout, the responsive break at 1240px, the dark-theme pass and
the write chain (assign → deliver → acknowledge → outcome, and reassign) have
been reasoned about and typed, but not seen. The first thing to do against a
live `me/permissions/` is walk `IB-BE-2026-0047` end to end and `IB-BE-2026-0044`
through reassignment.
