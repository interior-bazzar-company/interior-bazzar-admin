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
> Consumer for all six files is `src/admin/views/Users/store.ts`; no view imports
> JSON and no view fetches, so this is a one-file swap.

The module's own rule, before the table: **there is no stored classification.**
Normal User, Active Member, Paused, Suspended, Former Member and Deactivated are
all derived at read time from membership state by `classify()` in `store.ts`, and
the users list filter, the members view, the renewal queue and
every analytics denominator call that one function. **The API must not add an
`is_member` column, a `classification` field or a `member_since` flag.** If it
sends one, two definitions exist and they will disagree within a week — which is
the failure the whole module is shaped to avoid.

### Reads

| Content file | Status | Endpoint it stands in for | Must return |
| --- | --- | --- | --- |
| `users.json` → `users[]` | stand-in | `GET /admin/users` | The directory page. Filters that must be server-side: `q` (user id, name, email, **phone matched on the last ten digits so formatting cannot defeat it**, business name, city, locality, and deal/invoice reference), `cls` (the derived classification — **derived server-side by the same rule, not stored**), `ms` (raw membership status), `plan`, `city`, `src` (registration source), `tag`, `status` (account status), `registered` + `from`/`to` (the six windows, **resolved server-side at request time**), and the four operational flags `expiring`/`ended`/`pending`/`incomplete`. Row needs: identity, profile city + completeness, registration source and date, `lastActivityAt`, internal tags, **and the current term with its plan, version, status and end date** — the last is not optional, because the queue is unreadable without knowing when a term ends. Plus `counts` over the **whole filtered set**, not the page. |
| `users.json` → one element | stand-in | `GET /admin/users/{id}` | The workspace. Everything above plus the full `profile{}`, `identity{}` (from Auth, read-only), `tags[]`, `notes[]` (**operations scope only — never on a customer-scoped read**), `commercial{}` references and `authUserId`. **`profile{}` now carries the business facets** — `businessType` (one key or null), `segments[]`, `categories[]` (all three holding VOCABULARY KEYS, never labels), `searchKeywords[]` and `targetAreas[]` (both raw text). They replace `category` and `services`, which are gone. **`username` is new and is a public ADDRESS**: unique across the platform, lower-case, `^[a-z0-9][a-z0-9-]*[a-z0-9]$`, 3–30 characters, no double hyphens, not in `reservedUsernames[]`. It needs its own availability endpoint — see below — because a form that can only discover a collision by failing a save is a form people fail a save on. **`targetAreas` is the profile's ONLY location now** — `state`, `city`, `pincode`, `portfolioUrl`, `locality` and `addressLine` are all removed. It is structured: `[{state, cities[]}]`, at most 5 rows, at most 8 cities per row, each city ≤ 40 chars. The `state` half of a row is CLOSED against `states[]` — that is what lets rows aggregate, every profile claiming Karnataka spells it one way — and the `cities` half is OPEN, because "Uttam Nagar" is a real service area and no list holds every locality. No duplicate states across rows, no duplicate cities within one (case-insensitive), and **a row with a state and no cities must be refused** — it is a half-given answer no filter can use. The list's `city` filter now means COVERAGE: match any row whose cities contain the value, or whose state IS the value (the Delhi case). The compact surfaces print the first row's first city as the profile's city. Send keys: a label is a display concern that gets rewritten, and a filter, a saved search and a report all key on the stable value. The panel resolves keys to labels itself and falls back to printing the key when the vocabulary no longer has it, so a retired key stays visible as the migration it is rather than rendering as an empty cell. |
| `memberships.json` → `memberships[]` | stand-in | `GET /admin/users/{id}/memberships` | Every term ever held, newest first, **including terminal ones**. Each row: `planId`/`planCode`/`planName`, **`cycle{months,price,currency}`** — the duration and price actually bought — `previousMembershipId`, `source{kind,reference,label,note}`, dates, status, the five lifecycle timestamps, and the **frozen `entitlements[]` snapshot**. THE ROW MUST BE SELF-SUFFICIENT: no field may require a catalogue lookup to render, because the catalogue is another module's and a plan can be repriced, renamed or archived after the sale. `planCode` is the stable grouping key (derived from the plan family, or the title where the family is generic) — **not** `planId`, whose numeric value moves with migrations; every filter, report and duplicate refusal in this module keys on `planCode`. A pending term returns `entitlements: []` — it has none, and the screen says so rather than previewing the plan. |
| `memberships.json` → one element | stand-in | `GET /admin/memberships/{id}` | One term, as above, plus its `events[]`. |
| `memberships.json` → `events[]` | stand-in | `GET /admin/memberships/{id}/events` | Append-only, newest first: `eventId, type, fromStatus, toStatus, actor, actorRole, reason, effectiveAt, note`. **Every `type` must exist in `vocabularies.json → eventTypes[]`** — a type the vocabulary does not know renders with no label and no tone. `npm run check:users` asserts this for every type the client writes. |
| — *(file deleted)* | **RESOLVED** | `GET /admin/plans/` — **already live** | **UM-OD-01 is closed: the catalogue is NOT ours.** This module shipped its own `membership-plans.json`, which is two sources of truth for one price — reprice Growth in Plans and the assignment form would have carried on selling the old number until a member queried an invoice. The assignment form now reads the Plans module's own `usePlans()`, the same Subscription / PlanBillingCycle rows the public page charges from. **The billing cycle IS the duration**: there are no "plan versions", there is a plan with cycles, each a number of months and a price. Nothing else in this module reads the catalogue — a term freezes what it bought, so records, lists and analytics all render with the catalogue unreachable. |
| `vocabularies.json` | stand-in | `GET /admin/users/vocabularies` | `classifications[]`, `membershipStatuses[]`, `transitions[]`, `lifecycleActions[]` (with `from[]`, `to`, `permission`, `requiresReason`), **`activationSources[]` — exactly three: `new_sale`, `renewal`, `complimentary`** (with `requiresReference`, `requiresReason`). The five it replaced — payment / invoice / deal / manual / legacy — mixed WHY a term exists with WHERE the money is recorded; the second is a reference, which is one field, and five near-synonyms get picked inconsistently, `userStatuses[]`, `registrationSources[]`, **`profileFields[]` (with `required`, `editable`, `public`, `type`, `vocab`, `groups`, `max`, `maxLength`, `hint`)** — `type` is load-bearing: it is what decides which control the admin form renders (`text` / `textarea` / `single` / `multi` / `tags`), and `vocab` names the vocabulary in this same payload that supplies the options. Adding a facet is a row here, not a code change, **`businessTypes[]`, `segments[]`, `categories[]` + `categoryGroups[]`, `keywordSuggestions[]`, `stateCities{}`** — the business facets; `stateCities` maps each state key to its city SUGGESTIONS (the row's city picker offers them and accepts anything typed), `states[]` and `cities[]` are `{key,label}` option lists rather than bare strings, **`reservedUsernames[]` and `usernameRules{min,max,pattern,help,path}`** — the handle rules, which the panel enforces client-side and the API must enforce again. A field may also carry `open: true` (the vocabulary is a SUGGESTION, not a constraint — City, Target areas, Search keywords) and `showWhen: "member"` (render only for somebody who holds a term or held one), `profileStatuses[]`, `tags[]`, the four reason lists, `cities[]`, `states[]`, `registeredRanges[]`, `sortOptions[]`, `renewalWindowDays`, `graceDays`, **`metricDefinitions[]`**, `eventTypes[]`, `openDecisions[]`, `team[]`. The panel renders from this rather than hard-coding, so a status, source, profile field or metric caution added server-side needs no code edit. **`metricDefinitions[]` is load-bearing**: every figure prints its `unit` on the tile and its `formula`/`caution` in the tooltip, which is the only defence against the same metric meaning two things six months apart. |
| `analytics.json` | stand-in | `GET /admin/users/analytics` | **MONTH-KEYED, not period-keyed.** A payload that ships pre-summed 30/90-day blocks can only answer the two windows somebody thought of, so a date-range control over it is decoration — the panel resolves any span of months client-side via `rangeTotals()`. Return `months[]`, newest last, each row carrying its own **numerators AND denominators**: `registrations, firstTimeMembers` (FIRST-EVER activation, never a renewal), `renewals, expiries, cancellations, profileCompleted`, plus `cohortEligible` (conversion denominator), `renewalEligible`, `churnEligible` + `churnLost`. **Never return a stored rate** — a percentage cannot be re-aggregated over a different span without lying. Also per row: `bySource{channel:[registrations, firstTimeMembers]}` and `byPlan{plan:[new, renewed, expired]}`, both summing exactly to that month's totals, and `activeAtEnd{plan:n}` — a LEVEL, never summed across months. Plus `cohorts` (keyed by first-membership month, **not** re-cut by the range), `revenueContext` read from Finance with the window it actually covers named, and `engagement: null`. **It still does not carry the headline counts**: total, Normal Users, Active Members, expiring soon and the status mix are counted client-side from the two files above by the same derivation the users list filters on, so a tile and the list it drills into cannot disagree. |
| `audit.json` → `events[]` | stand-in | `GET /admin/users/{id}/timeline` | Append-only, newest first. **Non-membership events only** — registration, profile administration, tagging, notes, account status. Lifecycle events live on the term and the client merges the two streams; a third table holding copies is a third thing that can disagree. `note` records **that** a note was added and never its text. |

### Writes

None of these exist. Each is named for the transaction it has to be, and the UI
that calls it already assumes the transaction is atomic — `store.ts` performs the
same sequence in the same order, so the endpoint has a worked example rather than
a guess.

| Transaction | Endpoint | Sequence, and what fails together |
| --- | --- | --- |
| **UM-T01 · Identity link** | `POST /admin/users/events/registration` (system) | Verify → check the idempotency key → create or link exactly one `platform_user` → append `REGISTERED`. Idempotent on the auth identity → `409 duplicate_user_link`. On failure no user exists and the event is retriable under the same key. **Never creates a second user because the commercial relationship changed.** |
| **UM-T02 · Assignment** | `POST /admin/users/{id}/memberships` | Verify membership authority → resolve the plan and **billing cycle** against the live catalogue and refuse a plan that is off sale, archived or has no active cycle → freeze `planName`, `cycle{months,price}` and the plan features onto the term → validate dates, source and reason → **check for an overlapping live term on the same product** → create at `pending` → append `MEMBERSHIP_ASSIGNED`. Refusals: `403 membership_admin_required`, `422 reason_required` (manual/complimentary), `422 validation_failed` (missing source reference), `409 active_membership_conflict`. Creates **no** entitlement snapshot — that is T03. |
| **UM-T03 · Activation** | `POST /admin/memberships/{id}/activate` | Lock the term → verify the activation source → **snapshot the entitlements from the plan version the term names** → set `active` → recompute the classification → append `MEMBERSHIP_ACTIVATED`. **A snapshot failure aborts the whole transaction**: the term stays `pending` rather than becoming Active with access nobody can enumerate. Refusals: `422 invalid_membership_transition`, `422 activation_source_required`. |
| **UM-T04 · Lifecycle action** | `POST /admin/memberships/{id}/{pause,resume,suspend,reactivate,cancel}` | Lock → validate against the transition matrix → apply the configured policy → append the event **with actor and reason** → recompute effective entitlement and classification. Off-matrix → `422 invalid_membership_transition` with **no state mutation and no partial write**. Missing reason where the matrix demands one → `422 reason_required`. Suspend and cancel need restricted authority; profile-edit permission must not be enough. |
| **UM-T05 · Expiry sweep** | scheduled job, not a client call | Select terms past `end_at` still `active` or `paused` → set `expired` → append `MEMBERSHIP_EXPIRED` → recompute the classification → **commit per row**. Idempotent per membership: a rerun after a partial failure completes the remainder and never double-processes. **Expiry ends a membership, not an account** — the user stays registered and becomes a Former Member. |
| **UM-T06 · Renewal** | `POST /admin/memberships/{id}/renew` | Locate the previous term → **create a NEW row** carrying `previous_membership_id` → **carry the same plan and the same cycle forward**, never today's catalogue price (moving somebody to a different plan or duration is an assignment, and repricing a member silently is a commercial decision this endpoint must not take) → activate → recompute → append `MEMBERSHIP_RENEWED`. **The previous term is not modified** — not its status, not its dates, not its snapshot. On failure the previous term is untouched and no new term exists. A renewal must never be counted as a new member. |
| `—` | **NEW** | `GET /admin/users/username-available?u=…` | Whether a handle is free, answered as somebody types. The panel checks its own loaded rows today, which is a prototype's answer and not a correct one: it cannot see a profile outside the page, and it cannot see one created a second ago. Must apply the SAME rules as `usernameRules` — a handle the client calls well formed and the server calls reserved is worse than no check, because the failure lands on Save. Rate-limit it: it is an unauthenticated-shaped enumeration surface even behind an admin session. |
| **UM-T07 · Profile update** | `PATCH /admin/users/{id}/profile` | Validate the permitted fields → **validate the four business facets** → apply → recompute completeness → append `PROFILE_UPDATED` **with the changed field set and not the values**. A validation failure leaves the stored profile **completely** unchanged; a partial profile write must not be a reachable state. Must refuse edits to fields the schema marks non-editable, and must never touch an authentication field. **The facet rules are not the form's**: `businessType`, `segments` and `categories` must be REFUSED when they carry a key outside the vocabulary, over the field's `max`, or the same key twice — the admin form checks all of this and the form is not the last line, because an import, a bulk edit or the customer's own profile page will all reach this endpoint. `searchKeywords` and each row's `cities` are the OPEN values: accept anything inside the caps, trim, collapse whitespace, de-duplicate **case-insensitively keeping the first spelling**. `targetAreas` rows get the structural rules above — unknown state, duplicate state, empty cities and over-cap must all refuse the WHOLE write. `username` gets the handle rules AND a uniqueness check — that second one is not a field rule and must be a real constraint in the database, not a read-then-write in application code, or two people registering at once both get told they were first. Do not coerce an unknown facet key to the nearest known one — a value quietly rewritten is worse than one that matches nobody, because the second is visible. |
| **UM-T08 · Internal note** | `POST /admin/users/{id}/notes` | Append-only. **No edit, no delete** — a note somebody later softened is worth less than one nobody can change. Appends `NOTE` carrying only the fact and the actor. `GET .../timeline` must not return note text either. |
| **UM-T09 · Tags** | `PUT /admin/users/{id}/tags` | Replace the set, append `TAGGED` with what was added and removed. Tags are internal and must be absent from every customer-facing profile response **at the contract level**, not by the client omitting them. |
| **UM-T10 · Account status** | `POST /admin/users/{id}/{deactivate,reactivate}` | Soft only. Sets `user_status`, stamps the reason, appends the event. **Retains the profile, every membership term, the commercial references and the whole audit trail.** Deactivating must not cancel, expire or otherwise touch a membership — they are separate facts. Hard deletion is a governed privacy process and must not be reachable from this module. |
| **UM-T11 · Commercial event** | `POST /admin/users/events/membership-commercial` (system) | Consume an approved purchase/payment context idempotently → `409 duplicate_source_event` on a repeat. **Which event may activate a membership is UM-OD-02 and is undecided** — until it is, this endpoint should create at `pending` and let a person activate. |
| **UM-T12 · Entitlements** | `GET /admin/users/{id}/entitlements` | The effective snapshot for downstream feature gating. Read from the **membership snapshot**, never recomputed from the current catalogue, and never inferred from payment data. Returns nothing entitling for a paused, suspended, expired, cancelled or pending term. |

### Error contract

`400 validation_failed` · `403 out_of_scope` · `403 membership_admin_required` ·
`404 user_not_found` · `404 membership_not_found` · `404 plan_not_found` ·
`409 duplicate_user_link` · `409 duplicate_source_event` ·
`409 active_membership_conflict` · `422 invalid_membership_transition` ·
`422 activation_source_required` · `422 reason_required` · `422 invalid_dates` ·
`422 immutable_history` · `429 rate_limited`.

The client already renders `invalid_membership_transition`, `reason_required` and
`active_membership_conflict` in the dialog that tried the action, with the dialog
left open — so the sentence the refusal contradicts is still on screen.

### Invariants the API has to keep

1. **One registered identity maps to exactly one `platform_user`.** Buying,
   renewing, expiring, cancelling and deactivating all happen against that row.
2. **No stored classification.** No `is_member`, no `classification`, no
   `member_since` flag. It is derived, in one place, at read time.
3. **A term is never overwritten.** A renewal is a new row referencing the old
   one; `user_membership` rows are updated only along the transition matrix.
4. **`membership_event` and `user_admin_audit` are append-only at the grant
   level** — the application role holds no UPDATE or DELETE on either table, not
   merely no route.
5. **Entitlements are snapshotted at activation** from a plan **version**. A
   catalogue change creates a version; it must never alter a term already
   activated under an earlier one.
6. **A failed entitlement snapshot prevents activation entirely.**
7. **One live entitlement per product** unless plan policy explicitly permits
   more (UM-OD-15).
8. **This module writes no money.** No revenue, refund, payment or ledger row,
   ever. A membership holds a *reference* into Finance and nothing else.
9. **Customer membership never grants internal RBAC**, and a staff role never
   creates a membership.
10. **Internal notes, tags and administrative reasons never reach a
    customer-facing response**, enforced by the payload and not by the client.
11. **Analytics state their unit** and never mix users, memberships and events in
    one figure. A rate with an empty denominator returns `null` with a reason,
    never `0`.
12. **Engagement is absent until it is real.** `engagement: null` while UM-OD-10
    is open — never zeros, which are indistinguishable from a platform nobody
    opens.

`npm run check:users` asserts 1–8 and 11 against the content files, case by case,
including the three that are easiest to get wrong: a Pending-only term is a
**Normal User** and not a former member; an `active` term past its end date is
**not** entitling; and `deactivated` is an **account** status that wins over every
membership state without disturbing the terms underneath it. If the real API can
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
| **UM-OD-06** | A refund does **not** move a membership. Finance stays authoritative and the consequence is an explicit lifecycle event. | Whether a reversal auto-cancels, auto-suspends, or raises a review. |
| **UM-OD-09** | `profile v1` is the field set; `public`/`internal` is marked per field on the form; the field's `type` chooses its control and its `vocab` supplies the options. | The profile schema, its visibility rules and its field-level edit permissions — **and who owns the four facet vocabularies**. Segments and Categories are marketplace taxonomy, not user data: somebody has to be able to add a segment without a deploy, and whoever that is needs a screen this module does not have. |
| **UM-OD-10** | Engagement renders as **unavailable**, with the blocker named. | DAU/WAU/MAU. Nothing is built until the qualifying-event taxonomy exists. |
| **UM-OD-11** | A **60-day** renewal window and **no grace period**, labelled as assumed everywhere they are used. | Expiring soon, renewal rate and churn — computed from one constant so they cannot drift apart. |
| **UM-OD-12** | **One** contextual revenue figure, read from Finance and labelled. | Which products count as membership revenue, and how refunds and taxes are treated. |
| **UM-OD-13** | The entitlement keys on screen are **illustrative**. | The real feature keys and limits. Blocks the entitlement API. |
| **UM-OD-15** | Overlapping live terms on the same product are **refused**. | Whether different concurrent products will exist. |

### Not an endpoint — but on this list

| Item | Where | What has to happen |
| --- | --- | --- |
| `Module` row for `users` | server | Create it, group label **Business Ops**, with actions `view/create/edit` plus a **separate sensitive action for membership lifecycle** — suspend, cancel and reactivate must not ride on `edit`. Then remove the key from `PROTO_MODULES` in `src/admin/auth/session.ts` and the row from `PROTO_ROWS` in `src/admin/shell/modules.ts`. **Until then `can("users")` returns true for everyone**, which is safe only because there is no server data behind it and no server write to authorise. |
| The `Business Ops` group | server | A new sidebar group. `GROUP_ORDER` in `src/admin/shell/modules.ts` already places it between Client Ops and Catalogue; the server's `groupLabel` has to match the string exactly or the module lands in a section of one. |
| Deal / invoice deep links | panel | The commercial tab links to `#/deals/{ref}` and `#/invoices/{ref}` by reference string. Those routes key on the server's own ids; the links are correct in shape and unverified in target until the membership payload carries real ids rather than display references. |
| Export | `GET /admin/users/export?<list filters>` | Not built. When it is, it must apply **the same filter set and the same order** as `GET /admin/users`, refuse the contact-detail column group server-side unless the actor holds the grant, and **never** include notes, tags or administrative reasons. |
| Member-facing entitlement read | `GET /users/{id}/entitlements` (customer scope) | The downstream contract. Must return the snapshot and nothing else — no notes, no tags, no reasons, no commercial references, no classification label. |

---

## Everything else in the panel

No stand-ins. Deals, Plans, Team, Roles, Audit, Quotations and Invoices all read
`AdminOpsService` directly — status **live**, nothing on this list.
