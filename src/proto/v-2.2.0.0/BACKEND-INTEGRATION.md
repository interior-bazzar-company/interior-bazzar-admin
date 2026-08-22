# Backend integration — the work-list

Every content file on this branch, what reads it, and the endpoint that has to
replace it. Status is one of **stand-in** (a file is doing an endpoint's job) or
**live** (the endpoint exists and the file is gone).

Base path throughout: `/api/v1`.

---

## Module 4 · Business Enquiries

> **The five-stage lifecycle is LIVE on the API** (2026-08-21). `ready`, `delivered` and
> `acknowledged` are withdrawn; `processing` and `no_match` are served. `generated` is
> labelled "New". The `sla` object, `owner`, `followUpAt` and `outcome.acknowledgedAt`
> have left the payload; `owner=` and `flag=` have left the query (`flag=no_eligible`
> is `status=no_match` now). `new-enquiry` has left the tag vocabulary, and
> `attentionCells[]` was added for the strip's tooltips. A pre-chain lead with a
> contact attempt and no assignee derives as `processing`; both old delivery states
> derive as `assigned`. Migration `0015_lifecycle_five_stages` re-seeds the stored
> vocabulary document.

Route `#/business-enquiries`. Consumer for all five files is
`src/admin/views/BusinessEnquiries/store.ts` — no view imports JSON directly, so
this is a one-file swap.

### Reads

| Content file | Status | Endpoint it stands in for | Must return |
| --- | --- | --- | --- |
| `enquiries.json` → `enquiries[]` | **LANDED** — projects LeadQuery. **Filtered, ordered and paged server-side**: every control in the list is a query param, `pageNo`/`pageSize` cut the page AFTER the filter, and `counts` is returned over the whole filtered set rather than the page. Default order is **unassigned first, then newest** (`sort=attention` restores the old one). The predicates run in Python over a narrow whole-table read rather than as ORM `Q` objects — half of them are derived, and a second implementation in SQL would drift from `enquiry_derive`; see the ponytail note in `interior_leads/enquiry_filter.py` for where that stops holding. Contact log, events and the per-assignment rank/score come back EMPTY (rule version `legacy`) because nothing stores them. **STILL TO CHANGE SERVER-SIDE after the 2026-08-21 removals:** drop `owner`, `followUpAt` and `sla` from the payload and the query, drop `flag=breached|followup|overdue|no_eligible`, and add the `processing` and `no_match` statuses. | `GET /business-enquiries` | The list page. Filters that must be server-side: `status`, `category`, `city`, `state`, `urgency`, `tier`, `business`, `tag`, `source`, `received` + `from`/`to` (the seven windows, **resolved server-side at request time** — a client sending two absolute instants is the same bug in a different place), `status=no_match`, `q` (reference, customer name, phone, locality, business, **and the last logged customer response**). Row needs: id, submission id, source, customer, requirement, `qualification.urgency`, status, tier, priority, `createdAt`, active assignment's business name, `exception` when a matching run found nobody, **plus `source{kind,page,label,createdBy,via}`, `tags[]`, the checklist progress, and the last contact-log entry that carries a response**. Plus a **remark COUNT** — that internal notes exist is an operational fact worth seeing in a queue; what they say is not, and must not be on the list payload at all. The last three are not optional and must not cost a request per row — the queue is unreadable without them, because category and city are identical across half the list and what the customer said never is. |
| `enquiries.json` → one element | **LANDED** — required by the paging: an enquiry that is not on the current page has nothing for the record screen to render from, and every deep link is that case. | `GET /business-enquiries/{id}` | The record. Everything above plus the full `qualification` snapshot (with `checklist{}`, `qualifiedBy`, and **nullable** `frozenAt`/`version`), the whole `contactLog[]` newest-first, `remarks[]` newest-first (**operations scope only** — never on a business-scoped read), `assignments[]` **including superseded rows**, `outcome`, `invalidation`. |
| `enquiries.json` → `events[]` | stand-in | `GET /business-enquiries/{id}/timeline` | Append-only, newest first: `eventId, type, actor, actorRole, at, note`. Types in use: `INTAKE, UPDATED, CONTACT, CHECK, TAGGED, QUALIFIED, MATCHED, NO_MATCH, ASSIGNED, DELIVERED, REASSIGNED, OUTCOME, INVALIDATED`. The first five are the qualification workstream and are the busiest by far — a record can carry a dozen before it is qualified, so the timeline needs paging before this ships. Add `ACCESS_DENIED` when scoping lands — a 403 that leaves no trace is a security question nobody can answer later. |
| `suggestions.json` → `runs[id]` | stand-in | `GET /business-enquiries/{id}/business-suggestions` | `ruleVersion, calculatedAt, subscribedCount`, `eligible[]` (`businessId, name, rank, score, band, capacity{active,configured}, factors{}, why, from{}`) and `excluded[]` (`businessId, name, stage, reason`). **`excluded` is not optional** — the diagnostics screen is built on it, and it is only possible if exclusions survive the run. `from{}` is the per-factor sentence the breakdown prints; it must come from the engine, not be composed on the client. |
| `matching-rules.json` | stand-in | `GET /business-enquiries/matching-rules` | The **active** version: `ruleVersion, effectiveFrom, eligibility[], factors[] (key,label,weight,note), bands[], overrideThreshold`. A history endpoint is not needed yet; a past run is reproducible because every snapshot carries its own `ruleVersion`. |
| `vocabularies.json` | stand-in | `GET /business-enquiries/vocabularies` | `statuses[]` (key, label, tone, step, terminal), `transitions[]`, `urgency[]`, `tiers[]`, `categories[]`, `cities[]`, `exclusionStages[]`, `outcomeReasons{}`, `invalidReasons[]`, `reassignReasons[]`, **`contactChannels[]`, `contactOutcomes[]` (with `reached`, `autoTag` and `requiresFollowUp`), `qualificationChecklist[]`, `tags[]` (with `auto` and `help`), `tiers[]` (with `help` — the letter means nothing without it), `sources[]` (three channels, with `manual` and `help`), `manualVia[]`, `states[]`, `receivedRanges[]`, `qualificationVersion`**. `categories[]` and `cities[]` are now **suggestions, not a closed set** — the forms type them freely, so the API must accept values outside its own vocabulary and **must not silently coerce them**: a value quietly rewritten to the nearest known one is worse than one that matches nobody, because the second is visible. The panel renders from this rather than hard-coding, so a status, tag, channel or checklist item added server-side needs no code edit. `contactOutcomes[].autoTag` is what the server's own re-tagging must agree with — if the two disagree, the tag a user sees flips on every refresh. |
| `vocabularies.json` → `team[]` | stand-in | **Not ours.** A read of the Team module. | `{id, name, role}` for members holding `business-enquiries` write access — the Owner picker and the "Mine" filter read it. This module never owns the team list; it is in the vocabulary file only so the prototype has names to put in a column. |
| `businesses.json` | stand-in | **Not ours.** A read of Business Profile / Subscription. | `businessId, name, categories[], serviceArea[], plan, subscription, renewsAt, status, capacity{configured,active,period}, quality{}`. This module never writes here. If that module exposes no suitable read, the matching engine should serve a projection of it rather than this panel querying two services. |

### Writes

None of these exist. Each is named for the transaction it has to be, and the
UI that calls it already assumes the transaction is atomic.

| Transaction | Endpoint | Sequence, and what fails together |
| --- | --- | --- |
| **BE-T01 · Intake** | `POST /business-enquiries/intake` (system) | Validate → normalise → duplicate check → create the enquiry at status **`generated`** with the `new-enquiry` tag → append `INTAKE`. It does **not** freeze anything and does **not** append `QUALIFIED` — that is BE-T01c, and a person does it. On failure no enquiry exists; only the raw payload and a failure event survive. Idempotent on `submissionId` → `409 duplicate_submission`. |
| **BE-T07 · Edit while qualifying** | `PATCH /business-enquiries/{id}` | **New or Processing only** — `422 invalid_transition` once the snapshot is frozen. Body: any of `requirement{}`, `customer{}`, `urgency`. Appends `UPDATED` with a field-by-field diff in the note; a correction nobody can see is worse than no correction. |
| **BE-T11 · Create by hand** — **LANDED**. Writes a LeadQuery row; the submission id is `lead-<pk>`, not `man-`-prefixed, because the pk IS the id and a second series would be a second thing to keep unique. Tier comes from the platform's own scorer rather than a manual-only rule, so a hand-typed enquiry is graded on the same terms as an inbound one. A MATCHING PHONE NUMBER IS NOT A DUPLICATE: one person enquires more than once, for different work at different addresses months apart, so the server never refuses and never tags. It returns the number's earlier enquiries as `earlier[]` and states the count on the INTAKE event ("1 earlier enquiry from this number (276)") — a fact, not a verdict. BE-OD-01 stays open and `duplicate-suspected` stays hand-set. **It no longer owns the enquiry to the creator** — ownership was removed from the module on 2026-08-21. | `POST /business-enquiries` | Body: `{source, via, customer{}, requirement{}, urgency, text}`. Server generates the reference, stamps `createdBy` from the session, sets status `generated` with an empty checklist, and returns earlier enquiries from the same number as context rather than refusing. Needs `business-enquiries.create`. |
| **duplicate lookup** | `GET /business-enquiries?phone=` | What the add form calls while the number is being typed. **Must be the same rule the intake endpoint applies** — if the warning and the enforcement disagree, the warning is worse than nothing. Match on the last ten digits; formatting must not defeat it. |
| **BE-T12 · Remark** | `POST /business-enquiries/{id}/remarks` | Append an internal note. Allowed at **any** status. Append-only — no edit, no delete: a note somebody later softened is worth less than one nobody can change. Appends a `REMARK` event carrying **only** the fact and the actor, never the text. **`GET .../timeline` must not return remark text either** — the timeline is the one surface a business-scoped read could plausibly reach one day. |
| ~~**BE-T10 · Owner**~~ | **WITHDRAWN 2026-08-21 — do not build** | Ownership was removed from the module. There is no `owner` on the enquiry, no `OWNER` event, no `owner=` filter and no claim/hand-over/release write. Listed rather than deleted so nobody rebuilds it from memory. |
| **BE-T08 · Log a contact** | `POST /business-enquiries/{id}/contacts` | **New or Processing only, and the FIRST entry must transition `generated → processing` server-side** — "the team started qualifying" and "somebody tried to reach them" are one event, so the client does not ask for the transition separately. Body: `{channel, direction, outcome, response?, note?}`. Appends to `contactLog` (server timestamps it — a log that trusts a client clock cannot establish what happened first), sets `checklist.reachable` when the outcome is `reached`, **recomputes the automatic tags**, and appends `CONTACT` — whose note records the `generated → processing` transition on the first entry rather than emitting a second event for it. Never edits or deletes an entry. |
| **BE-T09 · Checks and tags** | `PUT /business-enquiries/{id}/checklist`, `PUT /business-enquiries/{id}/tags` | Checklist is New-or-Processing only; tags stay editable for the life of the record because "duplicate suspected" is worth noting late. Both append an event (`CHECK`, `TAGGED`) — "who decided this was genuine" is asked after a business complains, not before. |
| **BE-T01c · Qualify** | `POST /business-enquiries/{id}/qualify` | **THE FREEZE.** Body: `{requirementSummary}`. Guard: all four checks pass AND `contactLog` is non-empty. Then stamp `qualifiedBy`, `qualifiedByRole`, `frozenAt`, `version`; write the summary; set status `qualified`; append `QUALIFIED`. Refusal: **`422 qualification_incomplete`**, with which checks are outstanding in the body. After this the requirement is immutable at every role. |
| **BE-T02b · Mark no match by hand** | `POST /business-enquiries/{id}/no-match` | From `qualified` only. Sets `no_match` and stores the `no_eligible_business` exception with a note naming the operator. **No body** — it records a judgement, not a reason code, and the judgement is always the same one: no subscribed business can take this today. It exists because the operator sometimes knows the answer before the run does (the one business covering that pincode just suspended), and making them run a match to discover what they already know is theatre. Appends `NO_MATCH`. Reversible: BE-T02 clears it. |
| **BE-T02 · Matching run** | `POST /business-enquiries/{id}/match` | Runs from `qualified` **or** `no_match`, and **sets the status in both directions** — no eligible business → `no_match`; a later run that finds one → back to `qualified`. (This supersedes the earlier note that the endpoint must not touch the status: that held while "no eligible" was only an `exception` field, and it is a state now.) It still appends `MATCHED` and sets or clears the `no_eligible_business` exception, which carries the reason while the status carries the fact. Matching an unconfirmed enquiry — matching an unconfirmed enquiry ranks businesses against a form somebody filled in while skimming, then freezes that ranking onto an assignment as established fact. Load active rule version → apply hard eligibility → score the survivors → persist the candidate snapshot **including exclusions** → append `MATCHED`. A run that finds nobody does **not** fail the enquiry: it holds at Ready to Assign with `exception.code = no_eligible_business` and the diagnostics exposed. |
| **BE-T03 · Assignment** | `POST /business-enquiries/{id}/assign` | Lock the enquiry → **revalidate** hard eligibility and lock the capacity row → create the assignment → freeze rank, score, `factorSnapshot`, `ruleVersion` → set the active pointer → capacity++ → append `ASSIGNED` → enqueue delivery. Body: `{businessId, overrideReason?}`. Refusals: `409 assignment_conflict`, `422 business_not_eligible`, `422 override_reason_required`. |
| **BE-T03b · Delivery** | outbox worker, not a client call | Transactional outbox. **A failed send never erases an assignment** — it records `deliveryStatus=failed`, appends `DELIVERY_FAILED` and alerts Operations. |
| **BE-T04 · Reassignment** | `POST /business-enquiries/{id}/reassign` | Lock → close the current assignment (`supersededAt`, `closedReason`) → capacity-- → run BE-T03 in full for the new business → append `REASSIGNED`. Reason mandatory. The original row is never overwritten and never deleted. |
| **BE-T05a · Acknowledge** | `POST /business/enquiries/{id}/acknowledge` | Business scope only. Writes `acknowledgedAt`, appends `ACKNOWLEDGED`. Operations must **not** be able to call this on a business's behalf. |
| **BE-T05b · Outcome** | `POST /business/enquiries/{id}/outcome` | Lock the assignment → verify business scope → write outcome and reason → release capacity → append `OUTCOME`. Body: `{outcome, reason, notes?}`. No amount field, ever. |
| **BE-T05c · Invalidate** | `POST /business-enquiries/{id}/invalidate` | Terminal with a stored reason; releases capacity if one was held. Reason mandatory. |
| ~~**BE-T06 · SLA sweep**~~ | **WITHDRAWN 2026-08-21 — do not build** | The acknowledgement deadline was removed from the module. There is no `sla` object on the enquiry, no breach flag, no `SLA_BREACH` event and no sweep. The threshold it enforced was BE-OD-09, which was never decided, so the job would have policed a number nobody agreed to. Listed here rather than deleted because a job that quietly vanishes from a spec is one somebody rebuilds from memory. |

### Error contract

Already written down, in `vocabularies.json` → `errorContract`. The dialogs
quote these codes by name, so the server and the UI cannot drift:
`400 validation_failed`, `403 out_of_scope`, `403 admin_required`,
`404 enquiry_not_found`, `409 duplicate_submission`, `409 assignment_conflict`,
`422 no_eligible_business`, `422 business_not_eligible`,
`422 invalid_transition`, `422 override_reason_required`, `422 qualification_incomplete`, `422 followup_time_required`, `429 rate_limited`.

`403`, never `404`, for an enquiry that exists but is out of scope — a 404 would
confirm the id exists.

### Invariants the API must own

The panel models these so the screens are honest, but a client cannot enforce
them:

1. `score = Σ(factor_weight × factor_score)`, normalised 0–100.
2. A business failing any hard rule is absent from the pool at any score.
3. At most one active assignment per enquiry — a unique active pointer, not
   interface discipline.
4. `candidateScore`, `candidateRank`, `factorSnapshot`, `ruleVersion` freeze at
   assignment.
5. The qualification snapshot is immutable **after qualification**, not after intake.
   Before it, `frozenAt` is null and the requirement is editable; after it, no update
   path exists at any role. This is the one invariant that changed shape — see the
   qualification entry in [CHANGELOG.md](CHANGELOG.md) for why.
6. An enquiry cannot reach `qualified` without a named `qualifiedBy` and at least one
   contact-log entry. A snapshot nobody is answerable for is not a snapshot.
7. `contactLog` is append-only, on the same terms as the event log.
8. `enquiry_event` is append-only. **At the grant level** — the application role
   holds no UPDATE or DELETE on that table — not merely by omitting a route.
   `contact_log` and `remark` are append-only on the same terms.
9. A business reads only enquiries assigned to it, scoped by `business_id` at
   query level. **Neither the contact log nor the remarks ever cross that
   boundary** (BE-OD-16): a business receives the requirement summary, not our
   notes about the customer. This is enforced in four client paths — export,
   copy, print, image — and asserted by `npm run check:export`, but the client
   enforcing it is a convenience; the payload must not contain them in the
   first place.
10. Budget is not a field, filter, score, sort or parameter anywhere.

Every one of these is asserted by `npm run check:enquiries` against the content
files. If the real API can return a record that fails one, the panel will render
something incoherent for it — the script is the shortest statement of the contract.

### Not an endpoint — but on this list

| Item | Where | What has to happen |
| --- | --- | --- |
| `Module` row for `business-enquiries` | server | Create it, with actions `view/create/edit/close` as the other modules use. Then remove the key from `PROTO_MODULES` in `src/admin/auth/session.ts` and the row from `PROTO_ROWS` in `src/admin/shell/modules.ts`. Until then `can("business-enquiries")` returns **true for everyone**. |
| A business-user role | server + panel | The acknowledge/outcome half of this module has no actor. The permission matrix is all Interior bazzar employees. This view cannot ship its business-side surface without one. |
| Printable sheet | `GET /business-enquiries/{id}/sheet` | **Optional.** Built client-side today (`share.ts` → `printHtml`), the same route Quotations uses for its documents except that this one composes the HTML here. Moving it server-side would put the layout under one owner; it is not blocking, and a client-built sheet cannot leak a field the client does not already hold. |
| Export | `GET /business-enquiries/export?<list filters>` | Works client-side today over the rows already on screen. When it moves server-side it must apply **the same filter set and the same order** as `GET /business-enquiries` — an export that quietly ignores a filter is precisely the failure the dialog is built to prevent. Column groups as a request parameter; the customer-contact group **refused server-side** unless the actor holds the grant, because the client hiding a tick is a convenience and not a control. Wants its own `business-enquiries.export` permission rather than riding on `close`. |
| Analytics | `GET /business-enquiry-analytics/{platform,business/{id}}` | Nothing in the panel reads these yet. Listed so they are not forgotten: they must derive from enquiry / assignment / outcome events, and must never infer Interior bazzar revenue from a converted enquiry. |

---

## Everything else in the panel

No stand-ins. Deals, Plans, Team, Roles, Audit, Quotations and Invoices all read
`AdminOpsService` directly — status **live**, nothing on this list.
