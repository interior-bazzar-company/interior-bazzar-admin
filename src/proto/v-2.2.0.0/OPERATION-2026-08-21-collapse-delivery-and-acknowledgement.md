# Operation · Collapse Delivered and Acknowledged into Assigned

**Module:** Business Enquiries · **Date:** 2026-08-21 · **Status:** executed

Three requested changes. One is a label; two shorten the lifecycle.

---

## 1. The three

| # | Asked | Scope |
|---|---|---|
| 1 | rename "untouched" → **New** | strip cell label |
| 2 | remove Delivered, combine with Assigned | lifecycle state removed; delivery becomes part of assigning |
| 3 | remove acknowledged logic "for now" | lifecycle state and its write removed |

## 2. The lifecycle, before and after

```
before   New → Qualified → Ready → Assigned → Delivered → Acknowledged → Converted
                                                                       ↘ Not Converted
                                                                       ↘ Invalid
after    New → Qualified → Ready → Assigned → Converted
                                            ↘ Not Converted
                                            ↘ Invalid
```

Nine states become seven; steps renumber 1–5 (terminals share 5).

## 3. Delivered — why this one is nearly free

**`assign()` already called `deliver()` on the last line.** Delivery was never a
separate decision anyone made; it was the tail of assigning. The only thing
`deliver()` did that mattered to the queue was set `status = "delivered"`.

So the *mechanics* stay and only the *state* goes:

- **Kept:** the assignment's `deliveryStatus` and `deliveredAt`, and the
  `DELIVERED` timeline event. When it was published and whether the send failed
  are facts about the assignment, and `deliveryStatus: "failed"` still needs
  somewhere to live — the record renders it as *"Failed — the assignment stands;
  Operations is alerted"*.
- **Gone:** the `delivered` status, its strip cell, and `deliver()` as a separate
  export (its body folds into `assign()`).

An assigned enquiry is now assigned-and-published, which is what it always was.

## 4. Acknowledged — what goes with it

- `acknowledge()` (BE-T05, first half) and the `ACKNOWLEDGED` event type
- `outcome.acknowledgedAt` — from the type, from `recordOutcome()`, from 3 seed
  records
- the **AcknowledgeModal** and the "Business side · no surface yet" fence in the
  record action bar, which existed only to let a prototype walk the chain
- the `acknowledged` status and its strip cell

**Consequence:** `recordOutcome()` is now reachable directly from **Assigned**,
so the action bar's "Record outcome" moves onto that state. The outcome record is
created once, when it is closed, rather than opened at acknowledgement and closed
later — `status: "in_progress"` no longer occurs.

**Kept:** `outcome.firstContactAt`. Nothing sets it yet, but "when the business
first rang the customer" is a different fact from "the business confirmed
receipt", and it is not what was asked to be removed.

## 5. Rename, and a collision worth naming

The strip cell `untouched` becomes **New**.

**This now collides with the status label.** `generated` was renamed to "New"
earlier today, and the strip already carries an **in qualification** cell that
filters `status=generated`. So the row reads `… New … in qualification …` where
*New* is the subset of *in qualification* that nobody has rung yet. The tooltips
say exactly that, and `check:wiring` proves each number matches its own filter —
but two cells whose labels do not distinguish them is a real readability cost,
and it is being taken deliberately rather than by accident.

## 6. Seed migration

- 1 record `delivered` → `assigned`; 1 record `acknowledged` → `assigned`
- `ACKNOWLEDGED` events removed from timelines
- `acknowledgedAt` removed from 3 outcome blocks

## 7. Method and verification

Statuses are data, so the compiler cannot enumerate this one the way it did for
`owner`/`followUpAt`. Instead: `check:seed` validates every record's status
against the vocabulary and every transition against `transitions[]`, so a missed
seed row fails the suite rather than the screen. Then `tsc`, `eslint`,
`vite build`, all five suites, and a headless render of the real list.

## 8. For the API

- Statuses `delivered` and `acknowledged` are withdrawn. `transitions[]` becomes
  `assigned → converted | not_converted | invalid | ready`.
- `ACKNOWLEDGED` leaves the event union; `DELIVERED` stays.
- `POST …/{id}/acknowledge` is withdrawn. Delivery is not a separate endpoint —
  assignment publishes.
- `outcome.acknowledgedAt` leaves the payload.
- `assignments[].deliveryStatus` / `deliveredAt` remain.
