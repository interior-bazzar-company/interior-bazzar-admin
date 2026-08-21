# Operation · A Processing state, and the qualification flow it completes

**Module:** Business Enquiries · **Date:** 2026-08-21 · **Status:** executed

---

## 1. What was asked, and how it was read

> change qualified to processing and ready to assign to qualified — when team
> start qualifying, after user marked it qualified, after that show ready to
> assigned

Two readings, and **both land on the same lifecycle**:

```
New  →  Processing  →  Qualified  →  Ready to Assign  →  Assigned  →  outcome
```

- *Reading A* — rename `qualified`→Processing, `ready`→Qualified, and add a new
  state for "ready to assign".
- *Reading B* — **add** `processing` between New and Qualified; `qualified` and
  `ready` keep their labels.

**B is implemented.** A gives every existing record a different meaning: the four
seed records stored as `qualified` would start displaying "Processing", and
`ready` would start displaying "Qualified". That is a data migration wearing a
rename's clothes — the same trap flagged when `generated` kept its key while its
label became "New". B adds one state and changes no stored meaning.

## 2. Why this state was missing, and what it fixes

`generated` was doing two jobs: *"just arrived, nobody has touched it"* and
*"somebody is working it right now"*. The module had already papered over the
gap — an `untouched` count derived from an empty contact log, a `new-enquiry`
auto tag, and a strip cell filtering on that tag rather than on a state.

Making Processing real **retires the workaround**:

| | before | after |
|---|---|---|
| New | `status=generated` **and** no contact log, surfaced via a tag | `status=generated` |
| Being worked | same status, distinguished by a tag | `status=processing` |

It also dissolves the label collision recorded in the previous entry — "New" and
"in qualification" no longer name overlapping sets, because they are now two
different states.

## 3. The transition into Processing

**The first logged contact attempt.** "The team started qualifying" is precisely
"somebody tried to reach them", and it needs no new control — `logContact()`
flips `generated → processing` on the first entry.

It is recorded in the CONTACT event's own note rather than as a separate event
type: the attempt and the state change are one act, and two timeline rows for one
act is how a timeline stops being readable.

## 4. The flow, end to end

| Step | State | Means | Leaves when |
|---|---|---|---|
| 1 | **New** | Submission accepted. Nobody has contacted the customer. | first contact attempt is logged |
| 2 | **Processing** | Being qualified: contact attempts, checklist, requirement edits. | a person marks it Qualified |
| 3 | **Qualified** | Requirement confirmed, snapshot frozen, record read-only. | a matching run completes |
| 4 | **Ready to Assign** | Eligible businesses ranked. | a business is assigned |
| 5 | **Assigned** | Routed to one business and published to them. | the outcome is recorded |
| 6 | terminal | Converted · Not Converted · Invalid | — |

`transitions[]`:

```
generated  → processing, invalid
processing → qualified, invalid
qualified  → ready, invalid
ready      → assigned, invalid
assigned   → converted, not_converted, invalid, ready
```

**`generated → qualified` is deliberately not a transition.** `canQualify()`
already requires at least one logged attempt, so qualifying without contacting
was impossible; the transition table now says so instead of leaving it to a guard.

## 5. Every write that gated on `generated`

Requirement edits, contact logging, checklist ticks and tag changes were all
`status !== "generated"` — which would have frozen a record the moment it started
being worked. They now go through one helper:

```ts
export const isWorking = (k: string) => k === "generated" || k === "processing";
```

One predicate rather than five copies of a disjunction, so the next state added
before Qualified is one edit and not a hunt.

## 6. Surfaces

- **Attention strip:** `New` filters `status=generated`; `in qualification`
  becomes **`processing`**, filtering `status=processing`. Every cell is one
  status filter again — `check:wiring` enforces count-equals-filter.
- **Lifecycle rail** picks up the new step automatically (it reads `!terminal`).
- **Qualification panel** and the editable requirement now show for both working
  states.

## 7. Seed migration

3 of the 4 `generated` records have contact logged → `processing`. One
(`IB-BE-2026-0063`, no attempts) stays `New`. Steps renumber 1–6.

## 8. Left alone, and worth a later look

The **`new-enquiry` auto tag** now duplicates `status=generated` exactly. Three
things encode one fact (status, tag, empty log). It is left in place because
removing vocabulary that was not asked about is not this operation's business —
but it is redundancy of the kind that produced the count-vs-filter bug earlier
today, and it should go when someone touches tags next.

## 9. For the API

- **New status `processing`**, step 2. `statuses[]` and `transitions[]` updated.
- `POST …/{id}/contacts` must transition `generated → processing` on the first
  entry, server-side. The client no longer treats `generated` as writable-only.
- Edits, checklist and tag writes must accept **both** `generated` and
  `processing`, and refuse from `qualified` onward — unchanged in spirit, wider
  by one state.
