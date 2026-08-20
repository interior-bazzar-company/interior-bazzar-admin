# Operation · Detail CSS, header filtration, Remarks, Download & Copy Detail

**Module:** Business Enquiries (Module 4) · **Date:** 2026-08-21
**Status:** plan agreed → executing
**Rule this follows:** no development before the plan exists.

---

## 1 · What was inspected

`List.tsx` (table + command row), `Detail.tsx` (record + id bar), `bits.tsx`,
`Qualify.tsx`, `menus.tsx`, `share.ts`, `exportCsv.ts`, `store.ts`,
`enquiries.css`, and `src/content/business-enquiries/*.json`. Plus the two
screenshots supplied.

### Findings

| # | Finding | Severity |
| --- | --- | --- |
| F1 | `TierBadge withHelp` renders its help text **inside** the badge | **Broken** |
| F2 | Id bar has no `row-gap`, so wrapped chips collide | Cosmetic |
| F3 | Search placeholder is longer than the field, so it truncates mid-word | Cosmetic |
| F4 | Column filters were moved into a panel and are no longer visible per column | Regression vs. what was wanted |
| F5 | There is nowhere to record an internal note that is **not** a contact attempt | Missing feature |
| F6 | Three-dot menu offers print, not a shareable image; copy is labelled "Copy for WhatsApp" | Missing feature |

### F1 — root cause, stated exactly

`.be-tier` is `display: inline-grid; place-items: center; width: 20px;
height: 20px`. `withHelp` adds a second child (`<em class="be-tier-h">`), and a
grid with two children and no explicit template puts them in **two rows**. In
the id bar an override releases the width (`.be-idbar .be-tier { width: auto }`)
so the badge stretches to fill the flex line — **the wide black bar** — while the
second row overflows the fixed 20px height and paints **below** it as centred
grey text. Both artefacts in the screenshot come from this one rule.

The fix is structural, not a width tweak: a badge is a badge. The tier
explanation belongs in the (i) convention adopted last change, and the badge
keeps only its `title`/`aria-label`.

> The stray red dot below the chips is **not yet explained**. It sits outside
> every element I can account for in that row. The badge rewrite removes the
> malformed subtree that is the most likely source; if it survives, it needs a
> browser to find, and this document says so rather than claiming a fix.

---

## 2 · Decisions

### D1 · Filtration row goes in `<thead>`, and the panel stays

A second header row, one control per filterable column, aligned to the column it
filters. It reads as part of the table rather than as a toolbar, which is what
"in the table header" asks for.

**It adds no filter logic.** Every control writes the same `Params` key the panel
already writes, through the same `onFilter`. One filter model, two surfaces —
change a value in either and the chips, the strip, the export scope and the URL
all move together, because they always read the same place.

The panel keeps the filters that have **no column**: tag, state (province),
and the received/date window. Deleting it would lose those.

### D2 · A Remark is not a contact-log entry, and the difference is the point

| | Contact log | Remark |
| --- | --- | --- |
| Records | an attempt to reach the customer | an internal note |
| Contains | what the customer **said** | what **we** think |
| Written when | you tried to call | any time |
| Leaves the panel | the summary only | **never** |

Two fields already separate evidence from interpretation *within* one contact
attempt. A remark is interpretation with no attempt attached — "spoke to their
architect, she decides", "second enquiry from this building". Folding it into the
contact log would mean inventing a fake attempt to hold it, and would corrupt
`contactAttempts`, `everReached` and the qualification gate, all of which count
log rows.

Remarks are **append-only** and **never exported, copied, printed or imaged** —
the same rule as the contact log, asserted in the export test.

### D3 · Download produces a PNG from `<canvas>`, with no library

The requirement is a professional **image** of the enquiry, **without the company
name**.

- **Canvas, not html2canvas.** Adding a rasteriser is ~200 KB and a new
  dependency for one button; it also screenshots whatever the theme happens to
  be, so a dark-mode user would send a dark card. A hand-drawn canvas is
  deterministic, dependency-free, identical for everyone, and about 250 lines.
- **1080 × 1350**, the portrait ratio chat apps preview without cropping.
- **No company name, anywhere** — no wordmark, no legal entity, no domain. The
  reference and the requirement identify it; whoever receives it already knows
  who sent it.
- **Print stays** as a separate menu item. The A4 sheet *does* carry the company
  name and should: it is an internal document, not a thing forwarded to a chat.

### D4 · Menu shape

`Copy detail` · `Copy one line` · `Copy reference` — then `Download image` ·
`Print sheet`. "Copy detail" is the rename of the existing WhatsApp copy; the
format is already correct for it and does not change.

### D5 · What must never appear in an export, a copy, an image or a print

One list, three code paths, one test: **contact log, remarks, match score, rank,
who else was eligible, any money.** Adding the image is the moment this rule
either holds or quietly stops being true, so the image renderer is written
against the same helper and the assertion is extended to cover it.

---

## 3 · Work breakdown

Three lanes. Lane B touches only a new file and is run in parallel; A and C share
`Detail.tsx` and `store.ts` and are therefore run in sequence by one worker.

| Lane | Work | Files | Depends on |
| --- | --- | --- | --- |
| **A** | F1–F4: badge rewrite, id-bar gaps, placeholder, header filtration row | `bits.tsx`, `Detail.tsx`, `List.tsx`, `enquiries.css` | — |
| **B** | D3: canvas image renderer | `imageSheet.ts` *(new)* | contract only |
| **C** | D2: Remarks — data, store write, record UI, list indicator | `*.json`, `store.ts`, `Detail.tsx`, `enquiries.css` | A (same files) |
| **M** | Merge: menu wiring, export/share/image exclusion of remarks, checks, logs | `menus.tsx`, `exportCsv.ts`, `share.ts`, `scripts/*` | A, B, C |

## 4 · Regression surface, and how each is covered

| Risk | Cover |
| --- | --- |
| Header filter row disagrees with the panel | Both write the same `Params` key via the same `onFilter`; no second filter path exists |
| A 13-column table with a filter row overflows | `min-width` already set; the row inherits the same column widths |
| Remarks leak into an export | `npm run check:export` extended to assert remark text is absent at every tick |
| Remarks break the qualification gate | Gate counts `contactLog`, which remarks do not touch; asserted in `check:enquiries` |
| The image carries something it should not | Renderer takes a pre-built payload from the same source as copy/print |
| Tier fix loses the explanation | Moves to the (i) on the Enquiry block, plus the badge's `title` |

## 5 · Out of scope

Bulk actions, links out to a business record (no such route exists yet), and a
server-rendered image endpoint. All three are recorded in
[BACKEND-INTEGRATION.md](BACKEND-INTEGRATION.md) rather than started here.
