# Operation · Remove the SLA logic

**Module:** Business Enquiries · **Date:** 2026-08-21 · **Status:** executed

---

## 1. What "SLA logic" actually is here

Four things, and they are worth separating because only three of them go.

| # | Thing | Where | Verdict |
|---|---|---|---|
| 1 | **The clock** — `sla.ackHours` (24), `sla.dueAt` stamped at delivery | `store.ts` `deliver()` | **remove** |
| 2 | **The verdict** — `sla.breached`, `sla.breachedAt`, the `SLA_BREACH` event | `store.ts`, seed | **remove** |
| 3 | **The sweep** — `runSlaSweep()`, the prototype button | `store.ts`, `List.tsx`, `bits.tsx` | **remove** |
| 4 | **The surfacing** — breach pill, strip cell, toolbar stat, list line, filter, sort tiebreak, CSV column | 6 files | **remove** |

## 2. What is NOT SLA logic, and stays

Three things use acknowledgement without policing it. Removing them would be
scope creep and would cost real function:

- **`outcome.acknowledgedAt` and the `ACKNOWLEDGED` event.** *Whether* a business
  acknowledged is the lifecycle. Only *late* stops existing.
- **`businesses.quality.avgAckHours`.** A historical responsiveness signal feeding
  the `quality` match weight (5) in `matching-rules.json` — it ranks who *should*
  get an enquiry. It is an input to matching, not a deadline on a delivered row.
- **The reassign reason "No acknowledgement within SLA".** The most common real
  reason to reassign. The *reason* survives; the *word* does not — it is reworded
  to "Business never acknowledged it", which is what the operator means anyway.

## 3. The consequence, stated plainly

**Nothing will track a business sitting on a delivered enquiry.** That was the
one mechanism watching the hand-off, and after this the only way to notice is for
a human to read the list. Two things soften it and neither replaces it: the
customer side is still covered by `followUpAt` / overdue callbacks, and the
detail view will still say how long ago the enquiry was delivered.

This is the trade the removal asks for. It is defensible — the threshold was
built on **BE-OD-09, an open decision**, so the module was enforcing a number
nobody had agreed to, and there is no notification infrastructure behind it.
Enforcing an invented deadline is arguably worse than enforcing none.

## 4. Edit list

**`store.ts`** — `sla` off the `Enquiry` type · `breached` off `Counts` and its
derive · `flag === "breached"` filter branch · sort tiebreaker · `SLA_BREACH`
from the `append()` system-actor test · `sla` from `createEnquiry` · `dueAt`
stamp in `deliver()` · resets in `reassign()` and `acknowledge()` · `runSlaSweep()`
deleted · two comments reworded.

**`List.tsx`** — `runSlaSweep` import · strip cell (6 cells → 5) · `onSweep` prop
· `|| e.sla.breached` in the row rail · the `SLA +Xh` second line.

**`Detail.tsx`** — the `SLA breached` pill · the awaiting-acknowledgement note
rewritten to an elapsed fact (`Delivered 2d ago`) with no threshold.

**`index.tsx`** — the `breached` toolbar stat.
**`bits.tsx`** — `onSweep` param and the sweep button; ProtoBar keeps Reset.
**`exportCsv.ts`** — the `sla_breached` column.
**`enquiries.css`** — `.be-late` if orphaned; two comments.
**`Modals.tsx`**, comments only.

**`enquiries.json`** — the `sla` block off all 13 records; the one `SLA_BREACH`
event (`ev-0044-5`) off its timeline.
**`vocabularies.json`** — the reassign reason reworded.

**Docs** — `BACKEND-INTEGRATION.md`: BE-T06 withdrawn. `CHANGELOG.md`: entry.

## 5. Verification

`tsc -b` · `eslint` · `vite build` · `npm run check` (5 suites). The type removal
is the safety net: every read of `e.sla` becomes a compile error, so nothing can
be missed silently. Grep for `sla|breach|sweep` must come back clean across the
module and content, comments included.

## 6. For the API

**BE-T06 is withdrawn** — do not build the nightly job. `sla` leaves the enquiry
payload entirely. `GET /enquiries` gains no `sla` object; the CSV contract loses
`sla_breached`. `quality.avgAckHours` stays on the business payload.
