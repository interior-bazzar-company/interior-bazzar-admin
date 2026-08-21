# Operation · Full-module audit, and the fixes it produced

**Module:** Business Enquiries · **Date:** 2026-08-21 · **Status:** executed

A systematic pass over the module after a day of large removals — SLA,
ownership, callbacks, Delivered, Acknowledged, Ready to Assign. Removals leave
debris; this is the sweep.

**Method.** Measured rather than opined. A static audit script counted dead CSS
classes, unreferenced exports, unconsumed vocabulary, state-machine
completeness, event-type coverage and filter/sort parity; a headless render
measured the table. **Three of its findings were false positives and were
verified away rather than "fixed"** — see §3.

---

## 1. What was found

| # | Kind | Finding |
|---|---|---|
| 1 | **layout** | `.be-tbl { min-width: 1160px }` was sized for 12 columns. The table has 10 and its intrinsic minimum is **959px**, against **942px** of available width on a 1280px laptop. The floor was therefore **~200px wider than the content needs**, forcing far more horizontal scroll than the table itself asks for. |
| 2 | **dead CSS** | `.be-abar-biz` (2 rules) — orphaned when the Acknowledge fence was removed. |
| 3 | **dead code** | `TEAM` and `lastAttempt` exported from `store.ts` with no consumer in the module or the check suites. |
| 4 | **copy** | The terminal footer rendered *"Terminal — Converted. **Terminal.** Reopening needs an admin policy…"* — the word twice, because the label and the guard both begin with it. |
| 5 | **a11y** | In `ReassignModal`, `<label>Rank 1 was</label>` had no `htmlFor` and its `<input>` no `id` — the label was decorative, not associated. |
| 6 | **UX** | The attention strip was over-ruled: **3 separators for 4 secondary cells** after the removals, so every cell sat in a group of its own. |
| 7 | **redundancy** | The `new-enquiry` auto tag duplicated `status=generated` exactly — status, tag and empty contact log all encoding one fact. |
| 8 | **seed fidelity** | 2 records carry remarks with **no `REMARK` event**, and 3 carry manual tags with **no `TAGGED` event** — the timeline contradicted the record. |

## 2. State of the lifecycle — clean

The audit checked the state machine end to end and found nothing:

- every status has a transition row; no row points at an unknown status
- no status is unreachable
- the seed uses no status outside the vocabulary
- every sort key offered is handled; every filter offered is honoured

## 3. Three findings that were false positives

Recorded because "the audit said so" is not evidence:

- **`.be-r-warn` / `.be-r-rd` looked dead** — they are built dynamically as
  `"be-r-" + rail`, which no grep for the literal will find.
- **`.be-tier-h` looked dead** — the only match was a comment explaining that
  the rule had already been removed.
- **The last-response cell looked unclamped**, ballooning rows to ~250px in the
  first render. That was the *probe's* markup missing `.be-resp-c`; the real
  table applies it and the two-line clamp works.

A fourth near-miss: the audit reported `received`, `from`, `to` and `sort` as
"offered but not honoured". They are honoured — through `receivedWindow(p)` and
`sortEnquiries()`, neither of which reads `p.x` inside `filterEnquiries`.

## 4. The fixes

1. `min-width: 1160px → 960px`, the measured intrinsic minimum.

   **This narrows the overflow; it does not remove it, and the difference is
   worth stating.** The ten columns' own minimum widths add to 959px:

   ```
   rail 32 · Enquiry 131 · Tier 55 · From 79 · Category·location 152
   Urgency 114 · Status 123 · Last response 116 · Assigned to 104 · Age 53
   ```

   With 942px available, **17px of scroll is intrinsic** — the table cannot
   compress below its own content. What the old floor added was the other
   ~200px, and that is gone. Capping the response column was measured as a fix
   and rejected: at minimum width that column is already 116px, so caps of
   260/240/220/200/180 all left the total at 959. Removing the last 17px needs a
   column dropped or cell padding tightened — a design decision, not a defect,
   and it is not being made here on the quiet.
2. `.be-abar-biz` deleted.
3. `TEAM` and `lastAttempt` deleted.
4. The terminal footer prints the label and the guard's *second* sentence, so
   "Terminal" appears once.
5. `htmlFor`/`id` on the reassign rank field.
6. Strip separators cut to one: **live** (processing, assigned) | **terminal**
   (converted, invalid).
7. `new-enquiry` removed from the vocabulary, from `retagFromLog()`, from
   `createEnquiry()` and from the one seed record carrying it. Nothing depended
   on it once the New cell moved to a status filter.
8. `REMARK` and `TAGGED` events added to the five records that had the
   underlying data without the timeline entry, in newest-first order.

## 5. Left undone, deliberately

- **`CHECK` and `UPDATED` events are still absent from the seed.** A qualified
  record has four ticked boxes and should carry four `CHECK` events; adding them
  honestly means ~28 fabricated rows. The gap is recorded here instead of
  papered over, because the seed is a stand-in and inventing detail it cannot
  justify makes it *less* useful as an API reference, not more.
- **`exclusionStages` and `errorContract`** are in the vocabulary with no runtime
  consumer. They are contract documentation for the API and belong in content;
  left as they are.
- **Bulk actions** (multi-select, batch tag/invalidate) remain the largest
  missing feature. Out of scope for an audit — it is new work, not a defect.

## 6. For the API

- `new-enquiry` leaves the tag vocabulary. "Nobody has contacted them" is
  `status=generated`; the server must not re-add the tag.
- Nothing else changes: the rest are presentation, dead code and seed fixes.
