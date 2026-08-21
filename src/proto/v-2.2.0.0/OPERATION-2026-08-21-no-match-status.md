# Operation · "No match found" becomes a state, not a footnote

**Module:** Business Enquiries · **Date:** 2026-08-21 · **Status:** executed

---

## 1. What was asked

> no match found — add to the status, after qualified. bottom find match button:
> add match not found if we do not find business to match the enquiry. build logic

A matching run that finds nobody is currently recorded as a **side-note**: an
`exception` object hung off a record whose status stays `Qualified`. The queue
therefore says *"qualified, ready to go to a business"* about an enquiry that has
nowhere to go. That is the same class of contradiction as Ready-to-Assign, and it
gets the same answer: make it a state.

## 2. The lifecycle

```
New → Processing → Qualified ─── assign ──→ Assigned → outcome
                        │  ▲
                 no eligible │ re-run finds one
                        ▼  │
                   No match found
```

`no_match` is **not a step everyone passes through** and must not be drawn as
one. Two things encode that:

- **It shares step 3 with Qualified.** It *is* qualified — the enquiry is good,
  the requirement is confirmed, the snapshot is frozen. What is missing is
  supply. Sorting by "lifecycle step" therefore treats the two as the same
  distance along.
- **`offRamp: true`**, a new flag the lifecycle rail uses to leave it out of the
  linear track. Without it the rail would show *New → Processing → Qualified →
  No match found → Assigned* and imply every enquiry visits it.

**Transitions**

```
qualified  → no_match, assigned, invalid
no_match   → qualified, invalid
```

There is deliberately **no `no_match → assigned`**. Assignment needs a ranked
candidate; the only way to get one is to run matching again, and a run that
succeeds puts the record back to Qualified first. The route exists, it just goes
through the state that earns it.

## 3. The logic

`runMatching()` gains three lines and one guard:

- it now runs from **`qualified` or `no_match`** — retrying was already the point
  of the button, and the old guard would have locked the record out of its only
  escape
- **no eligible business →** `status = "no_match"`, and the `exception` is stored
  as before
- **eligible found and the record was `no_match` →** back to `qualified`, and the
  exception is cleared

The `exception` object **stays**. The status now says *what* the record is; the
exception still says *why* — the same division as `invalidation` on a Rejected
record. It carries the count that was excluded and the 422 code the API returns.

## 4. Surfaces

- **The action bar** offers matching from both states, and reads **"Try matching
  again"** rather than "Run matching" when the record is in `no_match` — the same
  button, but a person on that screen has already run it once and needs to know
  this is a retry.
- **The strip cell** `no match found` filters `status=no_match` instead of
  `flag=no_eligible`. Every cell is a status filter again.
- **`flag=no_eligible` is removed** from `filterEnquiries`. A flag that duplicates
  a status is the `new-enquiry` redundancy over again.
- **Two duplicate "No match found" pills go** — one on the record header, one in
  the list's customer cell. Both were painting a badge next to a status pill that
  now says the same word.

## 5. Seed

`IB-BE-2026-0052` — qualified, carrying the exception — becomes `no_match`.

## 6. For the API

- **New status `no_match`**, label "No match found", step 3, non-terminal.
- `POST …/{id}/match` **sets it**: no eligible business → `no_match`; a later run
  that finds one → back to `qualified`. This reverses the note added earlier
  today that the endpoint must not change the status — it must, and only in these
  two directions.
- `flag=no_eligible` is withdrawn; use `status=no_match`.
- The `exception` object is unchanged and still carries `no_eligible_business`.
