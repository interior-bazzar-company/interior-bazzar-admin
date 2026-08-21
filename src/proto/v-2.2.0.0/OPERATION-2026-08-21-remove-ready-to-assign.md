# Operation · Remove Ready to Assign — matching happens inside Qualified

**Module:** Business Enquiries · **Date:** 2026-08-21 · **Status:** executed

---

## 1. The contradiction

> ready to assign means it is qualified, those states and statements are
> contradictory

Correct. **Qualified** meant "a person confirmed the requirement and froze the
snapshot" — at which point the enquiry *is* ready to be assigned. The only thing
`ready` actually encoded was **"a matching run has been done"**, which is a fact
about the work, not a stage of the enquiry's life.

```
before   New → Processing → Qualified → Ready to Assign → Assigned → outcome
after    New → Processing → Qualified → Assigned → outcome
```

## 2. The evidence that it was never load-bearing

Nothing gated on it:

- **`assign()` never checked the status.** It requires a match run with an
  eligible candidate — `store.runs[id]` — and nothing else.
- **The suggestions panel** switches on `isWorking(status)`, not on `ready`. A
  Qualified enquiry already showed the ranked businesses.
- **`runMatching()` already accepted both** `qualified` and `ready`, because
  re-running was allowed. Its only other job was setting `status = "ready"`.

So the state was a label the queue carried and the screens ignored. Removing it
changes no gate, no permission and no branch.

## 3. What changes

- `ready` leaves `statuses[]` and `transitions[]`; steps renumber 1–5.
- `runMatching()` no longer sets a status. It appends `MATCHED`, and it sets or
  clears the `no_eligible_business` exception exactly as before — the enquiry
  stays **Qualified** either way.
- `reassign()` returns the enquiry to **Qualified** rather than Ready to Assign.
- `transitions[]`: `qualified → assigned | invalid`, and
  `assigned → converted | not_converted | invalid | qualified`.
- Counts: `ready` was `qualified + ready`; it is now simply the Qualified count.
  The strip cell and the toolbar stat are relabelled **qualified**.

## 4. What replaces the distinction it drew

**Whether a matching run exists** — which is what `ready` really meant — is still
visible, and in a better place: the record shows the ranked businesses when a run
has been done, and the `no eligible business` exception when the run found
nobody. Both are properties of the record, not states in a lifecycle, and the
attention strip still surfaces the second as its own cell.

The one thing genuinely lost: the list can no longer distinguish *"qualified,
nobody has run matching yet"* from *"qualified and ranked"* at a glance. If that
turns out to matter, it belongs as a **flag** — the same shape as
`flag=no_eligible` — and not as a lifecycle state, because it is reversible and
re-runnable and states are not.

## 5. Seed

2 records at `ready` → `qualified`, giving 3 Qualified.

## 6. For the API

- Status `ready` **withdrawn**. `transitions[]` as above.
- `POST …/{id}/match` (BE-T02) **must not change the status.** It appends
  `MATCHED` and sets/clears the exception; the enquiry stays Qualified.
- Reassignment returns the enquiry to `qualified`.
