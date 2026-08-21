# Operation · Remove ownership and callbacks, rename two labels

**Module:** Business Enquiries · **Date:** 2026-08-21 · **Status:** executed

Six requested changes. Two are label renames; four are the removal of two whole
features, confirmed as full removals rather than hiding the strip cells.

---

## 1. The six

| # | Asked | Scope |
|---|---|---|
| 1 | remove overdue logic | the **callback** feature, entirely |
| 6 | remove callback due logic | ″ (same feature — one removal) |
| 3 | remove mine logic | the **ownership** feature, entirely |
| 4 | remove unclaimed logic | ″ (same feature — one removal) |
| 2 | "no eligible" → "no match found" | label only |
| 5 | status "Generated" → "New" | label only |

## 2. Labels — what changes and what deliberately does not

Renamed where a person reads it: the strip cell, the row pill, the record pill
and note, and the status label in the vocabulary.

**Not renamed, on purpose:**

- **`generated`** stays the status **key**. It is in every seed record, every
  event, `transitions[]`, and the URL as `?status=generated`. Renaming a key to
  match a label is how a rename turns into a migration.
- **`flag=no_eligible`** stays the URL value — bookmarks.
- **`no_eligible_business`** stays the **422 error code**. It is a published API
  contract, not vocabulary.

## 3. Callbacks — everything that goes

`followUpAt` off the enquiry AND off every contact-log entry. With it:

- `followUpDue()`, `followUpOverdue()`
- `callbackDue` / `callbackOverdue` counts
- the strip cells **overdue** and **callback due**, and `flag=followup` /
  `flag=overdue`
- the **Follow-up column** and `FollowUpCell`, `.be-due`
- the **"Callback soonest" sort**, and the overdue tiebreaker in the default sort
- the red **row rail** for an overdue callback
- the **datetime field** in the contact composer, and the `requiresFollowUp` gate
  that made it mandatory
- the **`callback-due` auto tag**, and its branch in `retagFromLog()`
- the `callback_due_at` CSV column

**Kept:** the `callback_requested` contact **outcome**. "They asked us to ring
back" is still a true thing to record about a call; it simply no longer schedules
anything. Its `requiresFollowUp` and `autoTag` come off.

## 4. Ownership — everything that goes

`owner` off the enquiry and off all 13 seed records. With it:

- the `Owner` type, `isMine()`, `mine` / `unowned` counts
- the strip cells **mine** and **unclaimed**, and `owner=__mine` / `owner=__none`
- the **Owner column** and `OwnerCell`; the **Owner dropdown** filter
- the **`OwnerRow`** on the record: Claim, Release, Take over, and the hand-over
  select
- **`setOwner()` and `claim()`** — BE-T10 — and the `OWNER` event type
- the `owner` CSV column and the Owner row on the printed sheet
- `.be-owner`, `.be-ownerbar`, `.be-ownersel`

**Kept:** `VOCAB.team` and `currentActor()`. The team is still who *acts* —
qualifiers are named on every event, on `qualifiedBy`, and on remarks. Only
*assignment of an enquiry to a person* goes.

## 5. The consequence, stated plainly

**Two guards come off, and nothing replaces either.**

- **Nobody is named against an enquiry.** The collision this prevented was two
  qualifiers ringing the same customer within an hour; `unclaimed` was the number
  that surfaced it. After this the queue cannot say who is on what.
- **Nothing tracks a promised call-back.** Telling a customer "we'll ring you
  Tuesday" is now a note in the contact log and nothing more — no due date, no
  overdue state, no sort that surfaces it.

Combined with the SLA removal earlier today, **every time-based obligation in the
module is now gone**: nothing watches the business after delivery, and nothing
watches us before qualification. The module is a queue and a router; chasing is a
thing people do by reading it. That is a coherent product, and it is a decision
worth re-reading when someone asks why an enquiry sat for a week.

The attention strip drops from 14 cells to 10.

## 6. Method

**Types first.** `owner` and `followUpAt` come off the `Enquiry` type before
anything else, so every remaining read is a compile error and `tsc` enumerates
the work instead of grep. Same technique as the SLA removal; it found all 16
sites there with no misses.

## 7. Verification

`tsc -b` · `eslint` · `vite build` · `npm run check` (5 suites, three of which
need edits: seed checks for `followUpAt`/`owner`, and the wiring cell table).
Then grep for `owner|followUp|callback|mine|unclaimed` across the module and
content, comments included.

## 8. For the API

- **BE-T10 (owner) is withdrawn.** No `PUT /business-enquiries/{id}/owner`.
- `owner` and `followUpAt` leave the enquiry payload; `followUpAt` leaves each
  contact-log entry.
- `flag=` loses `followup` and `overdue`; `owner=` goes entirely; `sort=followup`
  goes.
- `OWNER` leaves the event type union.
- CSV loses `owner` and `callback_due_at`.
- `statuses[].label` for `generated` is now **"New"** — the key is unchanged.
