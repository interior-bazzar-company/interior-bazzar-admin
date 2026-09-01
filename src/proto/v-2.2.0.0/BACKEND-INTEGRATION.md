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

## Module 5 · Business Ops → Users Management

> **Nothing here is live.** Every record on these screens is a fixture and every
> write lands in the browser tab. The module is `users`, route `#/users`,
> sidebar group **Business Ops** (a new group — see the bottom of this section).
> Consumer for all five files is `src/admin/views/Users/store.ts`; no view imports
> JSON and no view fetches. Every read and write in the store is synchronous over
> one in-memory snapshot, so the swap is one file but not one line: each hook and
> each write function goes async, and the six dialogs that read their return
> value synchronously gain a loading state (the profile editor already has the
> pattern — it awaits the live plan catalogue).

> **Path prefix — decide before the first endpoint.** `v1/admin/users/` is
> ALREADY the staff sub-admin / RBAC resource (`AdminOpsService.users()`,
> `src/api/modules/admin/adminUserManagement.ts`, type `AdminUserType` with
> roles). The platform-user endpoints below are written as `/admin/users/…` for
> readability; they must ship under a distinct prefix — `/admin/platform-users/`
> is proposed — and a new service group, not a reuse of the RBAC client.

> **The clock.** `asOf` on the list payload is what every derivation runs on —
> relative times, last-seen, "registered N months ago". The panel must not use
> the browser clock for these.

> **MEMBERSHIP LEFT THIS MODULE.** Users Management used to hold the commercial
> lifecycle as well: a term, a plan, an assignment, a renewal queue, five
> lifecycle transitions. Finance/Subscriptions now records what a customer
> bought and what they pay for it, and two modules holding one fact is how they
> end up disagreeing. So `memberships.json`, UM-T02…T06, UM-T11 and UM-T12 are
> **gone, not deferred**, and the endpoints they described must not be built for
> this module. **See § Module 6 · Finance** for the contract that replaced them.
>
> The transaction numbers are NOT reindexed: UM-T01, T07, T08, T09 and T10 keep
> the numbers they were issued. A number that moves is worse than a gap in a
> sequence — every note, commit and conversation naming one would start pointing
> at a different transaction.
>
> **Not replaced anywhere:** cohort retention and the conversion funnel were
> keyed on first membership. Finance carries MRR, ARPU and the fail-to-pay rate;
> nothing carries "do they stay". That is a real gap, recorded rather than
> quietly closed.

### Reads

| Content file | Status | Endpoint it stands in for | Must return |
| --- | --- | --- | --- |
| `users.json` → `users[]` | stand-in | `GET /admin/users` | The directory page. Filters that must be server-side: `q` (user id, name, email, **phone matched on the last ten digits so formatting cannot defeat it**, business name, city, locality, and deal/invoice reference), `city`, `src` (registration source), `tag`, `status` (account status), `registered` + `from`/`to` (the six windows, **resolved server-side at request time**), and the one operational flag `incomplete` (a profile the customer has not finished). Row needs: identity, profile city + completeness, registration source and date, `lastActivityAt`, internal tags, **and the current term with its plan, version, status and end date** — the last is not optional, because the queue is unreadable without knowing when a term ends. Plus `counts` over the **whole filtered set**, not the page. |
| `users.json` → one element | stand-in | `GET /admin/users/{id}` | The workspace. Everything above plus the full `profile{}`, `identity{}` (from Auth, read-only), `tags[]`, `notes[]` (**operations scope only — never on a customer-scoped read**), `commercial{}` references and `authUserId`. **`profile{}` now carries the business facets** — `businessType` (one key or null — `service_provider` no longer exists; the seed remapped it to `contractor` where the profile holds an execution scope and `independent` otherwise), **`dealsIn[]` (required with the business profile: `products`, `services`, or both — never empty, never anything else, no duplicates)**, `segments[]`, `categories[]` (all holding VOCABULARY KEYS, never labels), `searchKeywords[]`, `targetAreas[]` and **`positioning[]`** (optional; up to two of exactly `luxury`, `budget_friendly`, `custom`, `premium` — refuse a third, refuse an unknown key) (both raw text). They replace `category` and `services`, which are gone. **`username` is new and is a public ADDRESS**: unique across the platform, lower-case, `^[a-z0-9][a-z0-9-]*[a-z0-9]$`, 3–30 characters, no double hyphens, not in `reservedUsernames[]`. It needs its own availability endpoint — see below — because a form that can only discover a collision by failing a save is a form people fail a save on. **`targetAreas` is the profile's ONLY location now** — `state`, `city`, `pincode`, `portfolioUrl`, `locality` and `addressLine` are all removed. It is structured: `[{state, cities[]}]`, at most 5 rows, at most 8 cities per row, each city ≤ 40 chars. The `state` half of a row is CLOSED against `states[]` — that is what lets rows aggregate, every profile claiming Karnataka spells it one way — and the `cities` half is OPEN, because "Uttam Nagar" is a real service area and no list holds every locality. No duplicate states across rows, no duplicate cities within one (case-insensitive), and **a row with a state and no cities must be refused** — it is a half-given answer no filter can use. The list's `city` filter now means COVERAGE: match any row whose cities contain the value, or whose state IS the value (the Delhi case). The compact surfaces print the first row's first city as the profile's city. Send keys: a label is a display concern that gets rewritten, and a filter, a saved search and a report all key on the stable value. The panel resolves keys to labels itself and falls back to printing the key when the vocabulary no longer has it, so a retired key stays visible as the migration it is rather than rendering as an empty cell. |
| — *(file deleted)* | **RESOLVED** | `GET /admin/plans/` — **already live** | **UM-OD-01 is closed: the catalogue is NOT ours.** This module shipped its own `membership-plans.json`, which is two sources of truth for one price — reprice Growth in Plans and the assignment form would have carried on selling the old number until a member queried an invoice. The assignment form now reads the Plans module's own `usePlans()`, the same Subscription / PlanBillingCycle rows the public page charges from. **The billing cycle IS the duration**: there are no "plan versions", there is a plan with cycles, each a number of months and a price. Nothing else in this module reads the catalogue — a term freezes what it bought, so records, lists and analytics all render with the catalogue unreachable. |
| `vocabularies.json` | stand-in | `GET /admin/users/vocabularies` | `classifications[]` (**two: `active` and `deactivated`** — an account status and nothing more). The five it replaced — payment / invoice / deal / manual / legacy — mixed WHY a term exists with WHERE the money is recorded; the second is a reference, which is one field, and five near-synonyms get picked inconsistently, `userStatuses[]`, `registrationSources[]`, **`profileFields[]` (with `required`, `editable`, `public`, `type`, `vocab`, `groups`, `max`, `maxLength`, `hint`)** — `type` is load-bearing: it is what decides which control the admin form renders (`text` / `textarea` / `handle` / `single` / `multi` / `tags` / `checks` / `areas`), and `vocab` names the vocabulary in this same payload that supplies the options. Adding a facet is a row here, not a code change, **`businessTypes[]` (seven — `service_provider` is REMOVED, see `dealsIn`), `dealsIn[]` (exactly two: `products`, `services`), `segments[]`, `categories[]` + `categoryGroups[]` (two groups now — `industry` and `sector`; the delivery-model group is REMOVED — and **`segments` and `categories` are both OPEN**: a value outside the list is a typed segment or industry, accepted and stored as typed, never coerced; `businessType`, `dealsIn`, `positioning` and the state half of `targetAreas` are the closed ones), `keywordSuggestions[]`, `stateCities{}`** — the business facets; `stateCities` maps each state key to its city SUGGESTIONS (the row's city picker offers them and accepts anything typed), `states[]` and `cities[]` are `{key,label}` option lists rather than bare strings, **`reservedUsernames[]` and `usernameRules{min,max,pattern,help,path}`** — the handle rules, which the panel enforces client-side and the API must enforce again. A field may also carry `open: true` (the vocabulary is a SUGGESTION, not a constraint), **`simple: true`** (render a plain dropdown instead of the searchable picker), **`info`** (a string: the sentence shown first inside the i button beside the label, followed by the option hints from the vocabulary), `placeholder`, `chip` (the tag tone its chips wear on the record), `wide`, and for `areas` `maxRows`/`maxCities`, `profileStatuses[]`, `tags[]`, the four reason lists, `cities[]`, `states[]`, `registeredRanges[]`, `sortOptions[]`, `renewalWindowDays`, `graceDays`, **`metricDefinitions[]`**, `eventTypes[]`, `openDecisions[]`, `team[]`. The panel renders from this rather than hard-coding, so a status, source, profile field or metric caution added server-side needs no code edit. **`metricDefinitions[]` is load-bearing**: every figure prints its `unit` on the tile and its `formula`/`caution` in the tooltip, which is the only defence against the same metric meaning two things six months apart. |
| `analytics.json` | stand-in | `GET /admin/users/analytics` | **MONTH-KEYED, not period-keyed.** A payload that ships pre-summed 30/90-day blocks can only answer the two windows somebody thought of, so a date-range control over it is decoration — the panel resolves any span of months client-side via `rangeTotals()`. Return `months[]`, newest last, each row carrying its own **numerators AND denominators**: `registrations, firstTimeMembers` (FIRST-EVER activation, never a renewal), `renewals, expiries, cancellations, profileCompleted`, plus `cohortEligible` (conversion denominator), `renewalEligible`, `churnEligible` + `churnLost`. **Never return a stored rate** — a percentage cannot be re-aggregated over a different span without lying. Also per row: `bySource{channel:[registrations, firstTimeMembers]}` and `byPlan{plan:[new, renewed, expired]}`, both summing exactly to that month's totals, and `activeAtEnd{plan:n}` — a LEVEL, never summed across months. Plus `engagement: null` while UM-OD-10 is open. **Cohorts and `revenueContext` are gone** — both were keyed on membership, and a figure about what a customer bought belongs to Finance. **It still does not carry the headline counts**: total, Normal Users, Active Members, expiring soon and the status mix are counted client-side from the two files above by the same derivation the users list filters on, so a tile and the list it drills into cannot disagree. |
| `audit.json` → `events[]` | stand-in | `GET /admin/users/{id}/timeline` | Append-only, newest first. Registration, profile administration, tagging, notes and account status. **Historical `MEMBERSHIP_*` rows may still arrive** and must render: the vocabulary keeps their labels precisely so old history reads as history rather than as a raw key. Lifecycle events live on the term and the client merges the two streams; a third table holding copies is a third thing that can disagree. `note` records **that** a note was added and never its text. |

### Writes

None of these exist. Each is named for the transaction it has to be, and the UI
that calls it already assumes the transaction is atomic — `store.ts` performs the
same sequence in the same order, so the endpoint has a worked example rather than
a guess.

| Transaction | Endpoint | Sequence, and what fails together |
| --- | --- | --- |
| **UM-T01 · Identity link** | `POST /admin/users/events/registration` (system) | Verify → check the idempotency key → create or link exactly one `platform_user` → append `REGISTERED`. Idempotent on the auth identity → `409 duplicate_user_link`. On failure no user exists and the event is retriable under the same key. **Never creates a second user because the commercial relationship changed.** |
| `—` | **NEW** | `GET /admin/users/username-available?u=…` | Whether a handle is free, answered as somebody types. The panel checks its own loaded rows today, which is a prototype's answer and not a correct one: it cannot see a profile outside the page, and it cannot see one created a second ago. Must apply the SAME rules as `usernameRules` — a handle the client calls well formed and the server calls reserved is worse than no check, because the failure lands on Save. Rate-limit it: it is an unauthenticated-shaped enumeration surface even behind an admin session. |
| **UM-T07 · Profile update** | `PATCH /admin/users/{id}/profile` | Validate the permitted fields → **validate the four business facets** → apply → recompute completeness → append `PROFILE_UPDATED` **with the changed field set and not the values**. A validation failure leaves the stored profile **completely** unchanged; a partial profile write must not be a reachable state. Must refuse edits to fields the schema marks non-editable, and must never touch an authentication field. **The facet rules are not the form's**: `businessType`, `segments` and `categories` must be REFUSED when they carry a key outside the vocabulary, over the field's `max`, or the same key twice — the admin form checks all of this and the form is not the last line, because an import, a bulk edit or the customer's own profile page will all reach this endpoint. `searchKeywords` and each row's `cities` are the OPEN values: accept anything inside the caps, trim, collapse whitespace, de-duplicate **case-insensitively keeping the first spelling**. `targetAreas` rows get the structural rules above — unknown state, duplicate state, empty cities and over-cap must all refuse the WHOLE write. `username` gets the handle rules AND a uniqueness check — that second one is not a field rule and must be a real constraint in the database, not a read-then-write in application code, or two people registering at once both get told they were first. Do not coerce an unknown facet key to the nearest known one — a value quietly rewritten is worse than one that matches nobody, because the second is visible. |
| **UM-T08 · Internal note** | `POST /admin/users/{id}/notes` | Append-only. **No edit, no delete** — a note somebody later softened is worth less than one nobody can change. Appends `NOTE` carrying only the fact and the actor. `GET .../timeline` must not return note text either. |
| **UM-T09 · Tags** | `PUT /admin/users/{id}/tags` | Replace the set, append `TAGGED` with what was added and removed. Tags are internal and must be absent from every customer-facing profile response **at the contract level**, not by the client omitting them. |
| **UM-T10 · Account status** | `POST /admin/users/{id}/{deactivate,reactivate}` | Soft only. Sets `user_status`, stamps the reason, appends the event. **Retains the profile, the commercial references and the whole audit trail.** Deactivating says the person may not sign in. It says nothing about what they bought — that is Finance's record and this module must not reach into it. Hard deletion is a governed privacy process and must not be reachable from this module. |

### Error contract

`400 validation_failed` · `403 out_of_scope` ·
`404 user_not_found` ·
`409 duplicate_user_link` · `409 duplicate_source_event` ·
`422 activation_source_required` · `422 reason_required` · `422 invalid_dates` ·
`422 immutable_history` · `422 field_not_editable` ·
`429 rate_limited`.

The client renders each of these in the dialog that tried the action, with the
dialog left open — so the sentence the refusal contradicts is still on screen.

### Invariants the API has to keep

1. **One registered identity maps to exactly one `platform_user`.** Registering,
   updating a profile and deactivating all happen against that row.
2. **No stored classification.** No `is_member`, no `classification` flag. An
   account is `active` or `deactivated`, and the label is derived at read time
   in one place.
3. **`user_admin_audit` is append-only at the grant level** — the application
   role holds no UPDATE or DELETE on it, not merely no route. **Historical
   `MEMBERSHIP_*` rows stay in it**: they record things that actually happened,
   and the vocabulary still carries their labels so old history renders as
   history rather than as raw keys. Nothing writes them any more.
4. **This module writes no money and owns no subscription.** No revenue, refund,
   payment, ledger row or term, ever. What a customer bought is Finance's
   record; Users holds who they are.
5. **A staff role never touches a customer account**, and a customer account
   never grants internal RBAC.
6. **Internal notes, tags and administrative reasons never reach a
   customer-facing response**, enforced by the payload and not by the client.
7. **Analytics state their unit** and never mix users and events in one figure.
   A rate with an empty denominator returns `null` with a reason, never `0`.
8. **Engagement is absent until it is real.** `engagement: null` while UM-OD-10
   is open — never zeros, which are indistinguishable from a platform nobody
   opens.

`npm run check:users` asserts these against the content files, case by case
(3, 4 and 5 are server-side grants and cannot be asserted from here). The one
easiest to get wrong is that **`deactivated` is an account status and nothing
else** — it says the person may not sign in, and says nothing about what they
bought, which is now a question only Finance can answer. If the real API can
return a record that fails one of these, the panel will render something
incoherent for it — the script is the shortest statement of the contract.

### Open decisions this UI had to assume an answer to

Each is rendered on the screen it affects, as a dashed `UM-OD-nn` block naming
the assumption. `vocabularies.json → openDecisions[]` is the register; the code
and the spec point at each other by id rather than describing each other.

| ID | Assumed here | What moves when it is decided |
| --- | --- | --- |
| ~~**UM-OD-01**~~ | **CLOSED.** The catalogue is the Plans module's and is read live from `GET /admin/plans/`; this module's copy is deleted. A term freezes plan name, cycle and features so nothing else needs the lookup. | Nothing. Listed rather than removed so the decision stays findable. |
| **UM-OD-02** | **Nothing activates automatically.** A commercial event creates a term at Pending and a person activates it. | The activation trigger. This is the single largest gap in the module. |
| **UM-OD-03** | Complimentary is one of the **three** sources, behind a mandatory reason. | Whether they are permitted at all, and which role holds the authority. |
| **UM-OD-04** | Pause policy `continue` — the end date runs on while paused. | The renewal queue, the expiring-soon count and the churn denominator, all three. |
| **UM-OD-05** | The suspend dialog **promises nothing specific** about what stays reachable. | What a suspended member can still do. Blocks the entitlement contract. |
| **UM-OD-09** | `profile v1` is the field set; every field is `public` today, so the flag is carried in the schema but no longer printed anywhere; the field's `type` chooses its control and its `vocab` supplies the options. | The profile schema, its visibility rules and its field-level edit permissions — **and who owns the four facet vocabularies**. Segments and Categories are marketplace taxonomy, not user data: somebody has to be able to add a segment without a deploy, and whoever that is needs a screen this module does not have. |
| **UM-OD-10** | Engagement renders as **unavailable**, with the blocker named. | DAU/WAU/MAU. Nothing is built until the qualifying-event taxonomy exists. |
| **UM-OD-11** | A **60-day** renewal window and **no grace period**, labelled as assumed everywhere they are used. | Expiring soon, renewal rate and churn — computed from one constant so they cannot drift apart. |
| **UM-OD-13** | The entitlement keys on screen are **illustrative** — and two schemes coexist: seeded terms carry `listings.max`-style keys, terms raised from the live catalogue carry positional `feature.N` keys derived from feature text. | The real feature keys and limits. Blocks the entitlement API and UM-T12. |
| **UM-OD-15** | Overlapping live terms on the same product are **refused**. | Whether different concurrent products will exist. |

### Not an endpoint — but on this list

| Item | Where | What has to happen |
| --- | --- | --- |
| `Module` row for `users` | server | Create it, group label **Business Ops**, with actions `view/create/edit/lifecycle` — `lifecycle` is the separate sensitive action (`actionLevels` marks it sensitive in the Roles editor): activate, pause, resume, suspend, reactivate, cancel and renew ride on it, never on `edit`. The client reads `lifecycleActions[].permission` from the vocabulary for the same split today but gates on `edit` until the key exists. Then remove the key from `PROTO_MODULES` in `src/admin/auth/session.ts` and the row from `PROTO_ROWS` in `src/admin/shell/modules.ts`. **Until then `can("users")` returns true for everyone**, which is safe only because there is no server data behind it and no server write to authorise. |
| The `Business Ops` group | server | A new sidebar group. `GROUP_ORDER` in `src/admin/shell/modules.ts` already places it between Client Ops and Catalogue; the server's `groupLabel` has to match the string exactly or the module lands in a section of one. |
| Deal / invoice deep links | panel | The commercial tab links to `#/deals/{ref}` and `#/invoices/{ref}` by reference string. Those routes key on the server's own ids; the links are correct in shape and unverified in target until the membership payload carries real ids rather than display references. |
| Export | `GET /admin/users/export?<list filters>` | Not built. When it is, it must apply **the same filter set and the same order** as `GET /admin/users`, refuse the contact-detail column group server-side unless the actor holds the grant, and **never** include notes, tags or administrative reasons. |
| Member-facing entitlement read | `GET /users/{id}/entitlements` (customer scope) | The downstream contract. Must return the snapshot and nothing else — no notes, no tags, no reasons, no commercial references, no classification label. |

---

## Module 6 · Finance

> **Nothing here is live.** Five module keys — `finance`, `finance-salaries`,
> `finance-transactions`, `finance-refunds`, `finance-analytics` — all in sidebar
> group **Finance**, all resolving to one component that reads its own route.
> There is no in-page tab strip: the sidebar is the navigation. Consumer for all eight content files is
> `src/admin/views/Finance/store.ts`; no view imports JSON and no view fetches.
> Every read and write in the store is synchronous over one snapshot, so the
> swap is one file but not one line — each hook and each write goes async, and
> the dialogs that read a return value synchronously gain a loading state.

**Finance RECORDS TRANSACTIONS.** Four things get recorded and nothing else:

| Tab | Records | The thing that makes it different |
| --- | --- | --- |
| **Subscriptions** | Sales that happened, from **sales** or from the **website**, paid in **installments** | The installment is the unit that gets paid. `fail_to_pay` records a real decline or a genuinely passed due date. |
| **Salaries A/C** | One account per team member, monthly runs, numbered slips | Attached to the live Team record by `memberId`. A slip **freezes** its own components. |
| **Other Transaction** | Company money out and in, under a **custom tag** | Anyone with edit rights creates a tag; the tag's `kind` is what is not free. |
| **Refunds** | Money going back out — against a payment, or **raised by hand** | The only routine action that sends money out. Four eyes. |
| *Analytics* | *nothing* | Not a fifth record type: the other four read back, which is why no figure on it can disagree with a list. |

**A ROW IS A FACT.** Every record exists because something happened. There is
no verification step, no approval state on a payment, no draft transaction, and
no endpoint below may introduce one. `fail_to_pay` is the apparent exception and
is not: it stores a gateway response or a date that has demonstrably passed, and
the store **refuses** an `overdue` failure on an installment whose due date is
still in the future.

**ONE INSTALLMENT, ONE PAYMENT, IN FULL.** The 1:1 rule inherited from Module 1,
at the correct unit. There is no part-payment field because there is no
part-paid installment to record it against. Amounts are integer paise. `asOf` in
`module.json` is the clock every "this month", "due in 30 days" and "overdue by
N" runs on; the panel must not use the browser clock for these.

### Reads

| Content file | Status | Endpoint it stands in for | Must return |
| --- | --- | --- | --- |
| `module.json` | static config | `GET /admin/finance/context` | `asOf` (**the clock**), the reporting `period`, `accounts[]` (`unrestricted: false` on the gateway account — money collected but not settled is not spendable cash) and the bill threshold. |
| `subscriptions.json` | stand-in | `GET /admin/finance/subscriptions` · `…/{id}` | `subscriptionId`, `source` (**sales · website**), `customer{name,userId,dealRef}`, plan, `cycleMonths`, `totalPaise`, `status`, `events[]`, and `installments[]` — each `{seq, of, dueDate, amountPaise, status, invoiceNumber, payment, failure}`. **Σ installment amounts must equal `totalPaise` exactly**, and the server must enforce it. `payment` carries the UTR, and **search must resolve a UTR including partial matches** — a customer on the phone has a reference, not a subscription id. `failure` carries `{at, reason, attempt, note}` and the note is mandatory. |
| `salaries.json` | stand-in | `GET /admin/finance/salary-accounts` · `…/salary-runs` | `accounts[]` — `memberId` **joins `AdminUserRow.id` from the live Team endpoint**; `earnings[]` and `deductions[]` as component arrays; `monthlyGrossPaise` === Σ earnings. `runs[]` — `month`, `state` (open · paid), `totalNetPaise`, and `slips[]` each carrying **its own frozen copy** of earnings and deductions plus `grossPaise`, `deductionsPaise`, `netPaise`, `paidAt`, `reference`, `issuedAt`, `sha256`. **`incentives[]` and `incentivePaise` join the slip** — variable pay EARNED in that month, held apart from `earnings` for two reasons that are both load-bearing: loss of pay pro-rates `earnings` and must NEVER reach an incentive (it is paid for something achieved, and absence does not un-achieve it), and nothing downstream can separate committed pay from earned pay once the two are in one array. **`grossPaise` INCLUDES the incentive** — it is money the person was paid, and a gross excluding it would not match the transfer. The server must not fold an incentive into `earnings`, which is where this panel's own pay dialog used to put it. `department` on an account is **set from the team member at open and is no longer typed input** — see the Team row below. |
| `transactions.json` | stand-in | `GET /admin/finance/transactions` · `…/tags` | `tags[]` — `tagKey`, `label`, `kind` (fixed · reinvestment · variable · excluded), **`custom`**, `budgetPaise`, `proofRequired`, `active`. `transactions[]` — `direction`, `tagKey`, `amountPaise` (**negative on a counter-entry**), `reference`, `valueDate`, `state` (recorded · reversed), `bill`, `bankLineId`, `nonRevenue` + `creditKind`, `reversesTxnId`, `reversal`. |
| `refunds.json` | stand-in | `GET /admin/finance/refunds` | `origin` (**subscription · manual**), a nullable `paymentId`, `payee`, `state` (requested · sent_back · approved · **paid** · declined), a **nullable** `policy` frozen at request time, and `settlement` — filled only when the transfer is actually made. |
| `invoices.json` | stand-in | `GET /admin/invoices/` — **already live** | The Invoice module's issued documents. Finance reads them and **writes none of it**; the view should read the live endpoint. |
| `../team/members.json` → `department` | stand-in | `GET /admin/team/members` — **not ours** | **NEW, and it is Team's field, not Finance's.** A person's department is a fact about the person; a salary is a contract, and the two change for different reasons and at different times. It came off the Add-a-salary-account dialog, where it was a free text box with a datalist of whatever had been typed before — a memory of past spellings rather than a taxonomy, and the reason one company could hold `Sales`, `sales` and `SALES`. Finance reads it through `memberId` when an account is opened and copies it onto the account. A typed string, blank legal and grouped as *Unassigned* in analytics. **The server must NOT derive it from a designation:** an Operations Manager and an Operations Executive share a department, a Sales Head and a Finance Admin do not, and no rule over job titles gets that right. |
| `bank.json` | stand-in | `GET /admin/finance/statements` | Imported statements and their lines. Reconciliation is no longer a tab — it is a block on Analytics → Overview — but the mechanism is unchanged. |
| `vocabularies.json` | static copy | `GET /admin/finance/vocabularies` | Record types, states, sources, failure reasons, tag kinds, refund grounds and policy, event types, **`metricDefinitions[]`** and **`kpiDefinitions[]`** (every tile and every KPI prints its formula, its caution and which direction is good, behind an i button), and `openDecisions[]`. **`payrollMetricDefinitions[]` and `payrollKpiDefinitions[]`** are separate lists on purpose: the KPI tab renders every entry in `kpiDefinitions` grouped by `group`, so a payroll metric added there would appear unasked on a page about subscriptions — and two of the payroll ones are an existing KPI's arithmetic over a financial year rather than a month, which side by side with no window stated is exactly the confusion these definitions exist to prevent. `goodDirection` accepts **`none`**, which is an answer and not a gap: incentive share and cost per head move for reasons a founder can want in either direction. |

### Writes

None of these exist. Each is named for the transaction it has to be, and
`store.ts` performs the same sequence in the same order.

| Transaction | Endpoint | Sequence, and what fails together |
| --- | --- | --- |
| **FN-T01 · Record subscription** | `POST /admin/finance/subscriptions` | Total > 0 → 1–5 installments → **the total must divide evenly** (`422 uneven_schedule`; a rounded schedule loses money on the last row) → start date not in the future → create the WHOLE schedule at once, every installment `due` with a date. A schedule invented one row at a time is not a schedule. |
| **FN-T02 · Record installment payment** | `POST …/subscriptions/{id}/installments/{seq}/payment` | Installment must be `due` or `fail_to_pay` → **the amount is the installment's, never typed** → reference mandatory and unique across payments, transactions, slips and refund settlements (`409 duplicate_reference`) → value date not in the future → **one write**: installment `paid`, receipt issued, invoice settled, counted as collected. There is no later step that could change the answer. If an imported statement already carries the reference and amount, link the line and append MATCHED. |
| **FN-T03 · Record fail to pay** | `POST …/installments/{seq}/failure` — `{reason, note}` | Reason from the closed list → **`overdue` is refused while the due date is still in the future** (`422 validation_failed`) → note mandatory (`422 reason_required`; a failure with no evidence is indistinguishable from a guess) → installment `fail_to_pay`, subscription `defaulting`. Recording it does **not** retry the charge and does **not** suspend the membership — FN-OD-15. |
| **FN-T04 · Reverse payment** | `POST …/payments/{id}/reverse` — `{reason}` | **Super Admin.** From a `paid` installment only. The payment and its receipt stay in the history; the installment returns to `due`; the invoice is cancelled, reason "payment reversed". |
| **FN-T05 · Cancel subscription** | `POST …/subscriptions/{id}/cancel` — `{reason}` | Unpaid installments become `cancelled`, not written off. Money already collected is untouched. |
| **FN-T06 · Salary account** | `POST /admin/finance/salary-accounts` · `PUT …/{id}` · `POST …/{id}/close` | `memberId` must resolve to a real Team member — that link is what stops a salary existing for nobody. Components typed, never derived from a role. Deductions may not exceed earnings. One open account per member (`409 duplicate_account`). Close is refused while the member has a slip on the open run. |
| **FN-T07 · Open a run** | `POST /admin/finance/salary-runs` — `{month}` | One run per month (`409 duplicate_run`) → month must have started → **no other run open** (`422 period_open`) → issue one slip per ACTIVE account, each **freezing a copy** of that account's components. A raise next month must not rewrite this slip. |
| **FN-T06b (addendum)** | the salary-account payload | `department: string` joins the account - typed at open, revisable, and what the analytics expenditure chart groups by. Blank is legal and groups as "Unassigned"; the server must not derive it from a designation. `GET .../finance/analytics` (or the client derivation it stands in for) sums NET PAID slips by the department on each slip's account, all time. |
| **FN-T08d · Hold a slip** | `POST …/payslips/{id}/hold` and `…/release` | A hold is about a MONTH, not a person: it must not stop other months paying. Only an UNPAID slip may hold (`already_paid` otherwise); the reason is mandatory on the way in (`reason_required`) because the hold prints on no document; releasing needs none. A held slip leaves the due computation — the pending figure, the arrears count, and the pay write all skip it — and comes back the moment it is released. The account timeline records both, with the figure. |
| **FN-T08c · Pay-time adjustments** | rides the pay-one-person write | Optional `incentive{label, amountPaise}` and `deduction{label, amountPaise}` on the payment. Each lands as a NAMED LINE on the newest month's slip — earning and deduction respectively — with the slip's totals and its run's total recomputed in the same transaction, BEFORE the freeze stamps it. Refuse a nameless amount (`adjustment_label`), a non-integer or negative one (`adjustment_amount`), and a deduction that would push the slip below zero (`deduction_exceeds`) — a negative payslip is a debt wearing a document's clothes. The event log states the adjusted figure that actually left the account. |
| **FN-T08 · Pay the run** | `POST …/salary-runs/{id}/pay` — `{reference, accountId}` | **Super Admin.** Reference mandatory and unique → **every slip stamped, numbered, hashed and frozen in the same transaction**. A run half paid is not a state. |
| **FN-T09 · Tags** | `POST /admin/finance/tags` · `PUT …/{key}/budget` · `POST …/{key}/deactivate` | Anyone with edit may create. The `kind` is chosen at creation and decides where the money lands. **Deactivate, never delete** — deleting a tag silently re-buckets every transaction that used it. Budget warns at 90% and never blocks. |
| **FN-T10 · Record transaction** | `POST /admin/finance/transactions` | Active tag present → amount > 0 → reference mandatory and unique → value date not in the future → **money IN only as `interest`, `own_transfer` or `vendor_refund`, all flagged non-revenue**. If anyone could hand-key a credit, anyone could fabricate revenue. |
| **FN-T11 · Reverse transaction** | `POST …/transactions/{id}/reverse` — `{reason}` | **Super Admin.** Append a counter-entry with a negative amount and `reversesTxnId`; the original is untouched. A counter-entry cannot itself be reversed. |
| **FN-T12 · Request refund** | `POST /admin/finance/refunds` — `{paymentId, ground, detail}` | Against a recorded installment payment; **full amount only**; one open request per payment (`409 duplicate_request`); the policy check is computed and **frozen** onto the request so the approver sees what the requester saw. A non-permitted ground is **accepted and framed**, never blocked. |
| **FN-T13 · Manual refund** | `POST /admin/finance/refunds/manual` — `{payeeName, amountPaise, ground, detail}` | No ledger row behind it, so `paymentId` and `policy` are **null** — an empty policy object would read as a passed check. The detail IS the evidence and is mandatory. |
| **FN-T14 · Decide** | `POST …/refunds/{id}/{approve,send-back,decline}` — `{note}` | **Super Admin, and never the requester** (`403 super_admin_required`) — that separation is the whole control. Note mandatory except on approve. **Approval moves no money**: it authorises a transfer a human makes in the bank. |
| **FN-T15 · Record the transfer** | `POST …/refunds/{id}/settle` — `{mode, reference, accountId}` | From `approved` only. Reference mandatory and unique — it is the proof the money left. Only now is the refund `paid`, and only now does it leave the "approved, not sent" figure. |
| **FN-T16 · Import statement** | `POST /admin/finance/statements` | Refused while a window is open (`422 period_open`). A credit matching a recorded payment on **amount + reference** links the line and appends MATCHED — **nothing about the row changes, because nothing about it was in doubt**. A debit matching a recorded transaction links likewise. Anything else is an exception a person explains. Name similarity and date proximity are shown to a person and never decide. |
| **FN-T17 · Close the period** | `POST …/statements/{id}/close` | **Refused while any line is unexplained** — `422 unresolved_exceptions`. Not a warning and not a confirm dialog: "close anyway" is how a hole becomes permanent. |
| Export | `GET …/export?<filters>` | Same filter set and order as the list. **Audit-logged as a disclosure event**, and scoped server-side. |

### Error contract

`400 validation_failed` · `403 out_of_scope` · `403 super_admin_required` ·
`404 not_found` · `409 duplicate_reference` · `409 duplicate_request` ·
`409 duplicate_account` · `409 duplicate_run` · `409 duplicate_tag` ·
`422 invalid_state_transition` · `422 uneven_schedule` · `422 reason_required` ·
`422 period_open` · `422 unresolved_exceptions`.

The client renders each of these in the dialog that tried the action, with the
dialog left open — so the sentence the refusal contradicts is still on screen.

### Invariants the API has to keep

1. **A row is a fact.** No endpoint may introduce a state meaning "recorded but not yet believed". A statement import proves the records are complete; it never re-decides a row already in them.
2. **Fail to pay carries evidence.** A gateway response, or a due date that has actually passed. The server rejects `overdue` on a future date and rejects an empty note.
3. **Σ installments === subscription total**, enforced server-side, at creation and after any change.
4. **One installment, one payment, in full.** No part-payment field, at any layer.
5. **A slip freezes its own components.** Gross is Σ the slip's earnings and net is gross − Σ the slip's deductions — never CTC ÷ 12, and never read through to the account.
6. **A recorded payment, a paid slip and a recorded transaction are never updated or deleted** — the application role holds no UPDATE or DELETE on these tables, not merely no route.
7. **One reference, one row**, across payments, transactions, slips and refund settlements. A repeated webhook is `409`, never a second row.
8. **Customer money has exactly one door**: a subscription installment. The three hand-keyable credits are all flagged non-revenue.
9. **A tag is deactivated, never deleted**, and its `kind` is fixed at creation.
10. **Approval moves no money**, and a refund is `paid` only when a transfer is recorded against it.
11. **A period cannot close with an unexplained line.**
12. **Undefined is not zero.** CAC without a new payer, ARPU without an active subscription and runway without a burn history all return `null` with a stated reason. Every KPI with a null value carries a `why`; every KPI with a value carries none.

`npm run check:finance` asserts these against the seed, case by case — including
the ones easiest to get wrong: the schedule that must sum to its total, the
`overdue` failure refused on a future date, the raise that must not rewrite an
old slip, the recalled credit that must not count as collected, the four-eyes
refusal, and the manual refund whose policy must be null rather than empty. It
also asserts that `verifyPayment`, `holdUnallocated`, `logPayment`,
`postTransaction` and `addCategory` are **not exported at all** — the premise is
enforced, not merely documented. `npm run check:finance-render` renders every
face, record screen and dialog.

### Open decisions this UI had to assume an answer to

The register is `vocabularies.json → openDecisions[]`; each is rendered as a
dashed `FN-OD-nn` block on the screen it affects.

| ID | Assumed here | What moves when it is decided |
| --- | --- | --- |
| **FN-AD-01…05** | **CLOSED.** Recorded is what happened · posted is immutable · one installment one payment · customer money has one door · tags are custom but kinds are not. | Nothing. Listed so the decisions stay findable. |
| **FN-OD-01** | Cash in and cash out on the value date. No accrual P&L, no deferred revenue — a twelve-month subscription paid up front reads as collected in the month it was paid. | Every KPI definition. The largest open question. |
| **FN-OD-02** | A statement import exists and is simulated; there is no live bank feed. | Reconciliation scope and the provider. |
| **FN-OD-04** | Super Admin approves refunds and pays a salary run; a bill is required above ₹25,000 before a period closes. | The approval flow and who may approve. |
| **FN-OD-05** | Salaries records accounts, runs and slips. **No statutory filing, no PF challans, no gratuity, no leave balances, no reimbursements**, and TDS is entered rather than derived. | Whether Finance owns payroll properly, and what a Sales Head may see. |
| **FN-OD-06** | Salary cost is **net paid to people**. Employer PF, gratuity and insurance are not modelled, so cost per head understates true cost to company. | Whether the panel can claim a real people cost. |
| **FN-OD-07** | **Runway is not shown.** It needs a reconciled cash balance and several closed months of burn; a placeholder there is a decision made on a wrong number. | The founder alert that matters most. |
| **FN-OD-08** | The tax block is a summary of what was invoiced — not a return, no input credit, not a filing. | CA sign-off. |
| **FN-OD-12** | Screens say *net*, never *profit*. | Naming, once full cost allocation exists. |
| **FN-OD-14** | One supply appears as several tax invoices, because the chain raises one invoice per installment. | CA sign-off on the invoice-per-installment shape. |
| **FN-OD-15** | Fail to pay is **recorded and surfaced, not chased**. Retrying a charge, dunning and suspending a membership belong to other modules. | Where recovery lives, and whether Finance triggers it. |

### Not an endpoint — but on this list

| Item | Where | What has to happen |
| --- | --- | --- |
| **FIVE** `Module` rows | server | Finance is five sidebar rows under one group, and each is its own key: `finance` (Subscriptions), `finance-salaries`, `finance-transactions`, `finance-refunds`, `finance-analytics`. Group label **Finance** on all five; actions `view/edit` plus a **separate sensitive action** (`super`) for reverse · pay a salary run · approve a refund · deactivate a tag · write off · close a period. They are separate keys because the grant genuinely differs: **payroll is the most sensitive record in the panel and must be withholdable without also withholding the subscription ledger.** Each key leaves `PROTO_MODULES` in the commit that lands its row. **Until then `can(<key>)` is true for everyone**, which is safe only because there is no server data behind it; the Super-Admin half is gated on `session.isFullAccess` today. `scripts/check-finance-nav.cjs` asserts the whole composition, including that a real server row replaces the proto one rather than doubling it. |
| The Team join | panel | `SalaryAccount.memberId` is `AdminUserRow.id`. `memberName` is a denormalised copy kept so a slip issued last month still names the person correctly if they are later renamed — the server must keep it that way and must not resolve it live at read time. |
| The legacy `payments` key | panel | Still in `HIDDEN_MODULES`. This module is `finance`; when the server row exists, decide whether the old grant folds into it or is retired. |
| Live chain | panel | The record's chain strip links `#/deals/{ref}` and `#/invoices?q=…`. When the live endpoints replace `invoices.json`, reuse `views/chainStrip.tsx` rather than keeping two chain renderers. |
| The document story | panel | Receipts and payslips are **print documents**, not generated PDFs — the bundle carries no PDF library and the browser's Save as PDF is the export. If a server-generated, hash-stamped PDF is required for payslips, that is a new endpoint and a new decision. |

---

## Module 7 · Team

> **Phases A and D–I of the frontend.** The navigation shipped 2026-08-30, and the
> three operational faces render the same day from seeds. The design is
> [OPERATION-2026-08-30-team-module.md](OPERATION-2026-08-30-team-module.md); this
> section is the part of it the backend owns.

Routes `#/team` and `#/roles` are **live** and unchanged — they read
`AdminOpsService.users()` and `.listRoles()`. Routes `#/attendance`, `#/work` and
`#/reports` render from `src/content/team/*.json` through
`src/admin/views/Team/store.ts` — **no view imports JSON and no view fetches**, so
each is a one-file swap.

### Reads

| Content file | Status | Endpoint it stands in for | Must return |
| --- | --- | --- | --- |
| `members.json` → `members[]` | stand-in | `GET /admin/team/members` | **The blocker.** `GET /admin/users/` today returns only members the **signed-in admin created** (`getSelfCreatedUsersController`) — there is no "everyone" endpoint, and every team-wide screen in this module needs one. It also has to carry the employment block: `designation`, `employmentType`, `joiningDate`, **`reportsTo`**, `workLocation`, `expectedHoursPerDay`, `dayStartsAt`, `graceMinutes`, `autoCloseAt`. **`memberId` is `AdminUserRow.id`** — the same id Finance's `SalaryAccount.memberId` joins on, so it must be the server's own id and must not be re-minted. `roles[]` in the seed is display-only; roles are the Roles module's and are read live. |
| `attendance.json` → `days[]` | stand-in | `GET /admin/team/attendance?date=` · `…/{memberId}?from&to` | One row per member per **business day** (IST `DateField`, stored beside the UTC instant): `startedAt`, `endedAt`, `breaks[]`, `workedMinutes`, `breakMinutes`, `isLate` **computed at open against that member's own `dayStartsAt` and stored**, plus `source`, the corrector and the reason where one exists. `absent` and `unclosed` are **derived at read**, never stored — there is no queue to sweep them with, and nothing auto-closes a forgotten day. |
| `work.json` → `items[]` | stand-in | `GET /admin/team/work` · `GET …/work/{id}` | One `WorkItem` table for tasks, milestones and targets, discriminated by `kind`, with a self-referencing `parentId` capped at depth 3. `delayed` is **never a stored status** — it is `dueDate < today && status not terminal`, computed at read, and a **terminal item is never overdue**. `progressPct` must **not** be in the payload: a milestone's is its completed children ÷ total, a target's is `currentValue ÷ targetValue`, and a stored percentage that disagrees with the children is the bug this prevents. |
| `plans.json` → `plans[]` | stand-in | `GET /admin/team/plans?date=` · `…/plans/{date}` | The daily plan, one per member per business day, unique on `(memberId, businessDate)`. `submittedAt: null` is a **draft** and counts as not submitted everywhere. Each line carries the `workItemId` it created or linked. |
| `reports.json` → `reports[]` | stand-in | `GET /admin/team/reports?date=` · `…/reports/{date}` | The EOD report, same key and same constraint. **The hours must not be in this payload** — they are read from the attendance row, and a report that lets a person type their own hours is not a record of anything. `acknowledgedById` is the senior's read receipt. |
| `vocabularies.json` | **static copy** | `GET /admin/team/vocabularies` | Labels, tones, the transition table, the metric definitions and the scope help. Permanent content, not placeholder records — the panel renders from it rather than hard-coding, so a status relabelled server-side needs no code edit. `attendanceStates[].stored` is the load-bearing key: `false` marks the two states nothing may ever write. |
| *(none — deliberately)* | — | **Not ours.** A read of Finance. | The member's payslips, by `memberId`. Team **does not generate slips** — `SalaryAccount` / `Payslip` / `SalaryRun` in Module 6 already do, with components frozen at issue. Team's Documents tab lists and links them. Two engines generating one slip is a second source of truth for one number. |

**Scoping is the API's job, not the client's.** Every list above is scoped server-side
to the caller: their own records, plus the members whose `reportsTo` points at them if
they hold the module's `view`/`review` verb, plus everybody if they are full-access or
hold the module's **`all`** verb. One level deep, not transitive — a recursive default
is a permission that silently widens every time somebody is hired under someone else.
A client-side filter over an unscoped payload is the same bug in a different place.

### Writes

None exist. Named for the transactions they have to be; full sequences in §5 and §10
of the operation document.

| Transaction | Endpoint | Note |
| --- | --- | --- |
| **TM-T01 · Create member** | `POST /admin/team/members` | Create the user, hash the password, create the employment profile, attach roles as **new** rows, append audit — one transaction. The offer letter is a **separate** one: if it fails, the member still exists. |
| **TM-T20…T23 · The work clock** | `POST /admin/team/attendance/{open,break,resume,close}` | **Idempotent on `(member, businessDate)`** — a second tab returns the same open day, never a second one. The server stamps every time; the client renders elapsed from `GET /engine/server-time/` skew. Closing the day closes any open break in the same instant. |
| **TM-T30…T33 · Work items** | `POST /admin/team/work` · `POST …/{id}/status` · `…/assign` | The assignee may change status on an item assigned to them; reassignment and deletion need `work.edit`. `completed → in_progress` is refused — reopening is explicit and carries a reason. |
| **TM-T40 / T41 · Plan and EOD** | `POST /admin/team/plans` · `…/reports` | Submit-once (`409 already_submitted`); the day is changed by changing the work items. A plan line **creates or links** a work item; an EOD tick **completes** one. The worked/break line is read from attendance and must be refused if sent. |
| **TM-T10…T12 · Offer letter** | `POST /admin/team/offers` · `…/{id}/issue` · `…/{id}/share` | Fork the **invoice's versioned** artefact, not the quotation's single one — a revised offer must keep the superseded version. Freeze at issue: spend the number, snapshot the party, store the artefact with its SHA-256. There is no PUT on an issued offer. |
| **Public · acceptance** | `GET /o/{token}` · `POST /o/{token}/accept` | **The first unauthenticated write on a legal record in this codebase**, and the project has no throttle class at all. Token: random `token_urlsafe(32)`, **stored hashed**, expiring, revocable, single-use on accept, with per-token and per-IP limits and an attempt count. Do **not** copy either existing precedent — the forgot-password link is an unsigned base64 blob of `{username, timestamp}` and the quotation share token is derived from the document, so it can never be rotated. Store the evidence bundle, not a flag: typed name, signature kind and object, `acceptedAt` as a **DateTime**, IP, user agent, the consent text snapshot and version, and the **document checksum at the moment of acceptance**. |

### Not an endpoint — but on this list

| Item | Where | What has to happen |
| --- | --- | --- |
| `Module` rows for `attendance`, `work`, `reports` | server | Group label **Team**, and it must match `GROUP_ORDER` in `shell/modules.ts` exactly or the module lands in a section of one. Verbs: `attendance` → `view/edit/correct/export/all`; `work` → `view/create/edit/assign/review/export/all`; `reports` → `view/review/export/all`. **`correct` is separate and sensitive** — amending a time record is the one attendance action that rewrites history. Then remove each key from `PROTO_MODULES` in `auth/session.ts` **in the same commit as its rows** — until then `can()` on all three is **true for everyone**, which is safe only while there is no server data behind them and no server write to authorise. |
| `groupLabel` on the existing `team` and `roles` rows | server | Change `"Settings"` to `"Team"`. That retires `GROUP_OVERRIDE` in `shell/modules.ts`, which re-files them client-side today. The map is a stand-in; `groupLabel` is the server's field. |
| New verbs on the existing `team` and `roles` rows | server | `team` needs **`delete`** split from `status` (which gates *Delete member* today while reading as "Activate" in `ACTION_LABEL`), and `roles` needs `delete` split from `edit`. `ActionMatrix` picks up new columns automatically from `m.actions[]`; the only client change is a label. |
| `DELETE /admin/roles/{id}` | server | Called by `AdminOpsService.deleteRole` and **not wired server-side** — already noted at `adminOps/index.ts:517`. Pre-existing; Team inherits it. |
| Private S3 objects | server | Every upload today returns a **public URL** — there is no signed read anywhere in the backend. Signatures, member documents and Finance's payslip links must not inherit this. The `DocumentToken` above is the read path for all three. |
| `AuthTasks.LogoutUser` | server | A no-op that returns `True` and never sets `UserSession.revokedAt`. Two lines. Not a blocker — attendance is a **deliberate work clock, not the auth session** — but it is what makes the login evidence shown beside a correction complete. |

---

## Everything else in the panel

No stand-ins. Deals, Plans, Audit, Quotations and Invoices all read `AdminOpsService`
directly — status **live**, nothing on this list. **Team and Roles are live too**, and
were on this line until 2026-08-30; they moved to Module 7 above because the Team group
they now sit in has server work behind it, not because either screen stopped being live.
