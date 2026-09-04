# Operation · Team Workspace v2 — wireframe and architecture

```
task:        Extend the Team module into a full workspace: a calendar — the
             face the module lands on — and a milestone timeline over the
             work items, member-owned tags, links
             between items, leave requests, virtually-signed agreements
             (offer letter and NDA), a member resource locker, and pay —
             salary and incentives — surfaced on the member's own dashboard.
             Wireframe and architecture only. No production code.

description: The brief reads as a new module. It is not. Team shipped on
             2026-08-30 with members, roles, attendance, work items, daily
             plans, EOD reports and a performance view, all live in the panel
             today. Six of the eight things in this brief attach to records
             that already exist; two are genuinely new entities. This document
             is a DELTA, and it says on every screen whether it is extending
             something shipped or building something new.

operation:   The shipped module was measured first — store types, content
             seeds, the vocabulary file that carries the module's rules, and
             the three faces already rendering. Every decision below is taken
             against what is there, not against a blank page. Where the brief
             contradicts a rule the module already enforces, the contradiction
             is named and resolved rather than absorbed.

summary:     Calendar and Timeline become the fourth and fifth FACE of
             `/work`, not new modules. The sidebar row is RENAMED Calendar
             and `/work` with no `face` resolves to the calendar; the route,
             the entity and the grant do not move (TM-AD-23). The timeline's
             lanes are MILESTONES, never members (TM-AD-24). The module
             gains a LEFT RAIL — Create, a mini month, this month's numbers,
             progress by milestone and target, today's tasks — and the rail is
             SHELL, carried by all four faces (TM-AD-25…28).
             "Captain" is not a new role — it is
             `reportsTo`, which has been on the member record since day one.
             Tags are RECORDS owned by a member, never vocabulary. Links are
             an edge list forbidden from touching progress rollup. Offer
             letter and NDA are one `Agreement` entity with a `kind`.
             Resources (member to company) and Agreements (company to member)
             are two buckets, not one, because they differ in direction,
             permission and retention. Team READS pay and never writes it.
             Leave suppresses a derived absence and never writes an
             attendance row.

outcome:     Thirteen wireframes and a clickable panel (§P), twenty
             architecture decisions (TM-AD-12…31),
             a data-model delta of two new entities and four extended ones, a
             permission delta, a regression list, nine implementation phases,
             thirteen open decisions (TM-OD-20…32) and six risks (TM-R-10…15).
             NOT code. One open decision — TM-OD-20 — blocks the roster work
             and needs an answer before Phase A.

             AMENDED 2026-09-03 by TM-AD-22, after the member dashboard was
             drawn: TM-AD-21's six tabs had dropped Reports, and the route it
             names does not exist — a member opens as a DRAWER today. §3.13
             is the container for §3.6, §3.10 and §3.11, so it precedes all
             three.

             AMENDED 2026-09-04 by TM-AD-23 and TM-AD-24, on the founder's
             direction. (1) The Team sidebar row reads CALENDAR and `/work`
             opens on the calendar face — label and default only; the route,
             entity and grant are untouched, so §3.2's board keeps its URL.
             (2) The timeline's lanes become TARGET ▸ MILESTONE with their
             tasks inside, not one lane per member: the face measures whether
             a dated commitment will land, and member load stays on the
             board's Assignee axis and §3.13. Progress fill and leave bands
             leave with the member lanes. Phase C moves to first — the row
             cannot promise a calendar before C ships.

             AMENDED 2026-09-04 again by TM-AD-25…28, after the founder asked
             for Google Calendar's LAYOUT and not only its grid. The module
             gains a left rail: Create (one control, three kinds), a mini
             month, this month's counts, progress in two sections — mine, then
             my team — and today's tasks, linked into §3.13 rather than
             duplicating it. It is shell, not a calendar widget: all four faces
             carry it, it holds no filters, and every number in it is derived.
             Drawing it against the seed found two live faults, both fixed here
             rather than recorded as open — three typed milestone percentages
             their own children contradict (TM-AD-27), and a month grid made
             unreadable by quarter-long items printing on all ninety-two of
             their days (TM-AD-28). The rail ships with Phase C.

             AMENDED again 2026-09-04, on the founder's direction. (1) The rail
             is WITHDRAWN from the board and the timeline and belongs to the
             calendar face alone; Create travels to those two toolbars so it is
             never further than one control away (TM-AD-25, TM-AD-26 amended,
             TM-R-15 closed). (2) The stages are FIVE and identical for every
             member — Planning · In progress · Delay · Complete · Cancel.
             BLOCKED is removed from them: it was a relationship wearing a
             stage's clothes, and it becomes `blockedByItemId` plus a reason.
             DELAY is the fifth and is computed, never stored (TM-AD-29).
             Tags stay free and member-owned; stages stay company vocabulary.

             AMENDED a third time 2026-09-04 by TM-AD-30. The rail's blocks are
             ordered TASKS ▸ MILESTONES ▸ TARGETS — the order somebody works
             in, smallest thing first — and a target is no longer drawn like a
             milestone: a milestone gets a work bar with a ▾ marker at the
             elapsed share of its window, a target gets its number first over a
             value bar. The same four components now render §3.12's roll-up and
             §3.13's Work section as well as the rail, so the module computes
             progress in one place and reads the same in three.

             AMENDED a fourth time 2026-09-04 by TM-AD-31: the document now
             carries §P, a WORKING panel — the real sidebar, the faces as tabs,
             a routed URL and the item drawer opening over whichever face is
             open. It is not a fourteenth wireframe: it calls the same builders
             every screen above calls, so it cannot drift from the spec it
             demonstrates.
```

**Module:** Team · **Date:** 2026-09-03 · **Status:** awaiting approval

**The twelve screens in §3 are also a clickable file** —
[wireframe-team-workspace-v2.html](wireframe-team-workspace-v2.html), opened straight from
disk, no build step. The board's Group-by axis is really wired over the seeded 22 work items,
so `TM-AD-15` can be argued against the thing itself rather than against a sketch of it. Every
`TM-AD` / `TM-OD` / `TM-R` id below is rendered beside the screen it constrains, and `TM-OD-20`
is drawn as an unanswered decision rather than quietly resolved.

**Supersedes nothing.** This continues
[OPERATION-2026-08-30-team-module.md](OPERATION-2026-08-30-team-module.md) and uses its
registers — architecture decisions resume at `TM-AD-12`, open decisions at `TM-OD-20`,
risks at `TM-R-10`, transactions at `TM-T30`. One module, one set of IDs, so a decision
and its reversal are never two documents apart.

---

## 0. The shipped module, as measured

Everything in this table is in the panel **today**, on this branch. It was read before
anything below was designed.

| Surface | Route | Where | State |
| --- | --- | --- | --- |
| Members, roles, permission matrix | `/team`, `/roles` | `views/Team/index.tsx`, `views/Roles/**`, `teamShared.tsx` | **live** — `AdminOpsService` |
| Attendance: open · break · resume · close, week strip, correction | `/attendance` | `views/Team/Attendance.tsx` (336 ln) | **shipped**, seeded |
| Work items — task · milestone · target, one entity | `/work` | `views/Team/Work.tsx` (375 ln) | **shipped**, seeded |
| Board face and List face | `/work?face=board\|list` | same | **shipped** |
| Daily plan and EOD report, with senior acknowledgement | `/reports?face=plan\|eod` | `views/Team/Reports.tsx` (449 ln) | **shipped**, seeded |
| The data module and every derivation | — | `views/Team/store.ts` (910 ln) | **shipped** |
| Labels, tones, transition table, the `stored:false` rule | — | `src/content/team/vocabularies.json` | **static copy** |

The three rules `store.ts` exists to enforce are load-bearing for everything below, and
are quoted here so that no screen in this document can quietly break one:

1. **`absent`, `unclosed` and `delayed` are never stored.** Each is derived at read
   against the payload's `asOf`. There is no queue in this backend — only a 15-minute
   cron — so a stored flag would be a stale flag.
2. **`isLate` IS stored,** written once at open against that member's own `dayStartsAt`.
   Changing policy tomorrow must not make last month late.
3. **Milestone and target progress is derived, never typed.** A milestone counts
   completed children; a target accumulates EOD deltas.

And the convention underneath all three, from the proto README: **an absence is the lack
of a row.** No record anywhere says "absent". Screens derive it from the roster minus
what exists, so a day view and a roll-up cannot disagree.

---

## 1. The brief, line by line

Each note from the brief, against what is already there.

| # | The note | Already shipped | What is actually new |
| --- | --- | --- | --- |
| 1 | *"manage my JD team too"* | the roster, scoped by `reportsTo` | **Unclear — TM-OD-20.** Is "JD" a second company, a department, or a job-description field on the member? The answer changes the roster's shape. Blocking. |
| 2 | *Salaries · Incentives · who earns what* | Finance owns `SalaryAccount` / `Payslip` / `SalaryRun` (Module 6) | A **Pay tab** on the member dashboard that READS them, plus **Incentive** — which exists nowhere |
| 3 | *Agreement — virtually signed — offer letter, NDA* | nothing. Spec'd in the v1 doc §3.11, **never built** | The whole of it: `Agreement`, signature capture, public token page |
| 4 | *Task dashboard like Google Calendar, weeks* | Board and List faces | **Calendar face** — month and week, and the face `/work` opens on (TM-AD-23) |
| 5 | *Add Tasks, milestones, Targets = Column · Column Tag on Column* | one `WorkItem` with `kind`; board columns hard-wired to status | A **selectable column axis** — status, kind, assignee, priority, or tag |
| 6 | *title, start date, end date, description, link to others, priority, status, tags — Meeting, Call — every member creates their own tag, but the stages stay the same for all* | title, description, `startDate`, `dueDate`, `priority`, `status` (five, `blocked` among them), `parentId`, `blockedByItemId` | **Tags** (member-owned) and **links** (generic, typed) · **five shared stages**, `blocked` out and `delayed` in as a derived one (TM-AD-29) |
| 7 | *Captain Timeline Layout · Calendar view · so they measure progress* | `/reports` performance view | **Timeline face** — one lane per **target and milestone**, its tasks as dated bars (TM-AD-24) |
| 8 | *Resource → documents provided by member* | nothing | **Resource** — a member's own uploaded documents |
| 9 | *Attendance: login, logout, break, leave request, EOD review* | open · break · resume · close, and EOD review with acknowledgement | **Leave request** only. TM-OD-13 put leave out of v1; this brief puts it back in. |

**Two entities are genuinely new** — `Agreement` and `Resource`. **Two more** — `Tag`
and `LeaveRequest` — are small and attach to records that exist. Everything else is a
face, a column, or a read of another module.

---

## 2. Architecture decisions

### TM-AD-12 · Calendar and Timeline are faces of `/work`, not modules

The v1 doc already reserved `#/work?face=calendar` and shipped the `face` param with two
values. Adding `/calendar` and `/timeline` as module keys would put one dataset behind
three sidebar rows, triple the permission surface, and give the user three places to ask
"where is that task".

```
/work?face=board      shipped
/work?face=list       shipped
/work?face=calendar   new — §3.3, and where bare /work resolves (TM-AD-23)
/work?face=timeline   new — §3.4
/work?item=W-K04      shipped — a drawer over whichever face is open
```

The drawer already composes over any face. It keeps doing so, which is why neither the
calendar nor the timeline needs a detail view of its own.

### TM-AD-13 · "Captain" is `reportsTo`. No new role concept.

The brief says *Captain Timeline*. The module already has exactly one hierarchy axis:
`Member.reportsTo`, one level deep, never transitive — chosen in v1 precisely because a
recursive default is a permission that silently widens every time somebody is hired.

A "captain" is therefore **a member whom at least one other member reports to**. It is
derived, not stored, and needs no new field, no new role and no new grant. It is what
scopes the roster, the leave inbox and the roll-up on `/reports` — the `team` scope axis
the vocabulary file already defines.

*Amended by TM-AD-24:* the timeline face no longer draws a lane per member, so `reportsTo`
scopes **which items** that face shows and no longer shapes its rows.

> Building a second hierarchy for the word *captain* would give the module two answers
> to "who is this person's senior", and they would drift within a month.

### TM-AD-14 · Tags are records owned by a member, never vocabulary

The brief says **"every member creates their own tag"**. That one clause decides the
design, and it puts tags on the opposite side of the module's existing line:
`vocabularies.json` is static copy for things the *company* names — statuses, priorities,
employment types. A tag someone types at 3pm is a record.

```
Tag { tagId · ownerId · slug · label · colourToken · createdAt · archivedAt }
      identity is (ownerId, slug)
```

Three consequences, each the reason for the next:

- **Two members may both have "Client call".** They are different rows. Neither can
  rename or delete the other's.
- **Cross-member views group by `slug`, not `tagId`.** So a team board grouped by tag
  shows one *Client call* column covering both members' items — otherwise a team view fragments into
  one column per person per tag and is useless at five people.
- **A rename never rewrites anyone else's history.** The owner's label changes, the slug
  is stable, other members' rows are untouched.

`colourToken` is drawn from the panel's existing six tones — `ok · warn · bad · info ·
brand · neutral` — and not from a colour picker. A free picker on a per-member tag
produces a board where two people's palettes collide, and it would introduce the first
non-token colour in a panel where dark mode is a token swap rather than a second palette.

Seed suggestions — *Meeting, Call, Follow-up, Site visit, Review, Admin* — go in
`vocabularies.json` as `tagSuggestions[]`, because they are static copy. The tags a
member actually keeps are records in `tags.json`. **Suggesting is vocabulary; owning is a
record.**

### TM-AD-15 · The board's column axis becomes selectable

*"Add Tasks, milestones, Targets = Column … like Column Tag on Column."* Read as: the
column is a grouping choice, not a fixed property of the board.

```
Group by:  [ Status ▾ ]   Status · Kind · Assignee · Priority · Tag
```

`Status` stays the default because it is what ships today, and it is the only axis whose
columns carry a transition table — dragging between status columns means something.
**On every other axis the columns are read-only groupings.** You cannot drag a card from
Meera's column into Arjun's and have that mean "reassign", because reassignment needs a
reason and an audit row, and a drag has neither. That is TM-OD-08's answer applied to a
case v1 did not have.

### TM-AD-16 · Links are an edge list, and they never touch rollup

The model already has two relationships, and both are load-bearing:

- `parentId` — **the hierarchy.** Milestone progress is `completed children ÷ total`.
- `blockedByItemId` — set with a reason. After TM-AD-29 there is no `blocked` stage
  beside it: this field, and the reason on it, *are* "waiting on someone".

The brief's *"link to others"* is a third, weaker thing, and it must stay weaker:

```
WorkLink { fromItemId · toItemId · relation · createdById · createdAt }
           relation ∈ relates_to | duplicates | follows
```

> **TM-BR-02 · A `WorkLink` may never affect progress, status or scheduling.**
> The moment `relates_to` contributes to a milestone percentage, the module has two
> hierarchies and rule 3 in `store.ts` is dead. Rollup reads `parentId` and nothing else.

`follows` is ordering information **for the timeline face only** — it draws a connector.
It does not gate a start, because a gate needs a scheduler and this backend has a cron.

### TM-AD-17 · One `Agreement` entity; offer letter and NDA are kinds

Both are: a document generated from a template, frozen at send, delivered by a token
link, read by someone outside the panel, signed, and stored immutably. That is one
lifecycle. Two entities would mean two token systems, two signature captures and two
audit trails for one behaviour.

```
Agreement { agreementId · kind · memberId · title · bodyHtml · version
            status · sentAt · viewedAt · signedAt · declinedAt
            signatureImageKey · signatureTypedName · signerIp · signerUa
            tokenHash · tokenExpiresAt · supersededById }

kind   ∈ offer_letter | nda | policy_ack | custom
status ∈ draft | sent | viewed | signed | declined | expired | revoked
```

It reuses the quotation module's **freeze-and-version** machinery, which is the panel's
existing answer to "the document must not change after it was sent". The v1 doc
established the rest of the mechanism — TM-OD-06 signature, TM-OD-07 expiry, TM-R-04
private objects, TM-R-05 the unauthenticated write surface — and none of it is
re-litigated here.

**`policy_ack` is in the enum and out of v1.** It is the same shape with no
counter-signature, and naming it now costs nothing while adding it later costs a
migration.

### TM-AD-18 · Resources and Agreements are two buckets, not one

Both are "documents attached to a member", and merging them is the obvious move. It is
wrong on three axes at once:

| | **Agreement** | **Resource** |
| --- | --- | --- |
| Direction | company → member | member → company |
| Who uploads | admin | the member |
| Signature | required — it is the point | none |
| Immutable | yes, frozen at send | no, replaceable |
| Contains | terms the member agreed to | Aadhaar, PAN, degree, address proof |
| Retention | as long as employment is provable | **deletable on request** |

The last row settles it. Identity documents are the most sensitive records this panel
will hold, and a member asking for theirs to be removed is a request the system must be
able to honour without touching a signed agreement. One bucket makes that a per-row
conditional; two buckets make it a permission.

### TM-AD-19 · Team reads pay. It never writes it.

`BACKEND-INTEGRATION.md` § Module 7 already states this for slips: *"Team does not
generate slips — `SalaryAccount` / `Payslip` / `SalaryRun` in Module 6 already do, with
components frozen at issue. Two engines generating one slip is a second source of truth
for one number."* The brief's *"salaries · incentives · what they earn"* does not change
that; it asks for the read to be visible on the member.

**Incentive is new, and it is Finance's record with a Team basis:**

```
Incentive { incentiveId · memberId · basisType · basisId · label
            amount · currency · earnedOn · status · payslipId }

basisType ∈ work_item | target | manual
status    ∈ pending | approved | paid | rejected
```

The money and its approval are Finance's — the same module that owns every other rupee.
`basisType`/`basisId` points back at the Team record that earned it, which is the join
that makes the brief's *"who the fee, what they earn"* answerable in one query.

> **A target's `currentValue` must never be read as an amount owed.** Progress is a
> count of what happened; an incentive is a decision somebody made about it. Deriving
> pay from a progress bar means an EOD report edits a payslip.

### TM-AD-20 · Leave suppresses a derived absence. It never writes an attendance row.

TM-OD-13 put leave out of v1. It is back in, and the interesting part is not the form —
it is that leave collides head-on with the module's central claim.

If an approved leave day wrote an attendance row, `attendanceStates` would need a seventh
state, that state would carry `stored: true`, and **the rule that an absence is the lack
of a row would be dead** — because now some absences are rows and some are not, and every
roll-up would have to know which.

So:

```
LeaveRequest { requestId · memberId · fromDate · toDate · kind · reason
               status · decidedById · decidedAt · decisionNote · createdAt }

kind   ∈ casual | sick | unpaid | comp_off
status ∈ requested | approved | rejected | cancelled
```

and the derivation changes in exactly one place:

```
absent  =  no attendance row
           AND the business day is over
           AND no APPROVED LeaveRequest covers that date      ← the only new clause
```

`on_leave` is a **derived** display state with `stored: false`, joining `absent` and
`unclosed` in the vocabulary. It renders where `absent` would have. Nothing sweeps,
nothing is written, and the roster-minus-what-exists derivation still produces one
answer.

### TM-AD-21 · The member dashboard is one route with tabs

`/team/:id` (admin) and `/team/me` (member) already resolve to one component — TM-OD-15.
The three new member-scoped surfaces are **tabs on it**, not routes:

```
/team/me?tab=overview | work | attendance | pay | agreements | resources
```

Six tabs is at the edge of comfortable. It is still better than six routes, because every
one of them would need the same header, the same scope check and the same member
resolution — and a second screen is a second place for those to drift.

### TM-AD-22 · The member dashboard is six tabs, and Reports is one of them

**This amends TM-AD-21, which had a hole in it.** TM-AD-21 lists
`overview | work | attendance | pay | agreements | resources` and **Reports is not in that
list** — although the v1 document shipped it as a tab, and the daily plan and the EOD report
are per-member records with nowhere else to live. Adding it back makes seven, which is past
the edge TM-AD-21 itself called uncomfortable.

**Resolution: Agreements and Resources are two sections of one `Documents` tab.** That is the
escape hatch TM-R-14 already wrote down, taken now rather than after a real member finds the
screen crowded.

```
/team/me?tab=overview | attendance | work | reports | documents | pay
                                                      ^^^^^^^^^   ^^^
                                            two sections          the only tab added
```

v1's five tabs are kept intact and **one** is added, instead of one being dropped and two
invented. **TM-AD-18 is untouched** — it is about direction, permission and retention, and
none of the three changes because two sections share a tab.

Three rules the screen carries, each of which is the reason for the next:

- **A nudge inherits the scope of what it points at.** The *Needs you* block loses two rows
  for a senior — the unsigned NDA and the missing documents — and they are **absent, not
  greyed**. A row reading *"1 agreement unsigned"* announces the existence of a document the
  same screen just refused to show.
- **The clock is read-only here.** Actions stay in the topbar strip and on `/attendance`.
  Three *End the day* buttons over one open day is two chances for the UI to disagree with
  itself mid-request.
- **Access is a block, not a tab**, and it does not render on the member's own view. Someone
  reading their own permission matrix learns exactly which verb to ask for.

> **The route does not exist yet.** Team shipped on 2026-08-30 with the member as a *drawer*
> — `views/Team/MemberDrawer.tsx` — and neither `/team/:id` nor `/team/me` resolves today.
> TM-OD-15 answered *where* this lives; nothing built it. It is the container for §3.6, §3.10
> and §3.11, so it precedes all three.

---

### TM-AD-23 · The row is renamed *Calendar*, and `/work` lands on the calendar face

The brief's headline ask is a task dashboard *like Google Calendar*. The label should say
what the person opens it for, and what they open it for is a dated view of the week.

**The label and the default are the whole change.**

```
sidebar   Work  →  Calendar          label only
route     /work                      unchanged
entity    WorkItem                   unchanged
grant     team.work.*                unchanged
/work     → ?face=calendar           was ?face=board
?face=board                          still exactly the board that ships today
```

Every existing link, bookmark and `?item=` drawer URL keeps working, because none of them
were ever bare `/work`. Renaming the route to `/calendar` was considered and rejected: it
buys a tidier address bar in exchange for a redirect to maintain forever, and it would
make the module's key disagree with its table, its grant and its content file.

Two consequences that have to be paid rather than discovered:

- **The empty month.** The board opens with 22 cards whatever the week; a month with
  nothing dated in it opens blank, and a blank landing screen reads as a broken panel. The
  empty state therefore states what exists and offers the board — *22 items · 6 with no
  date ▸ open the board*. It is also the cheapest nudge towards dating work the module
  will get.
- **The face is remembered per member.** `?face=` stays the source of truth, the last face
  is remembered locally, and the default decides the first visit only. Someone who works
  the board all day is not sent back to a month grid every morning.

**Phase C therefore moves to first (§7).** Renaming the row before the calendar exists
would put a board behind a label that promises a month grid.

### TM-AD-24 · The timeline's lanes are milestones, not members

The brief asks for a timeline *"so they measure progress"*, and the first draft of §3.4
read that as one lane per member. That is a productivity chart whatever it is called, and
the module cannot honestly draw one: there is no estimate field, so a bar's length is a
date range and not an amount of work, and **TM-OD-11** forbids reducing a person to a
score in the first place. Four bars on one row and two on another says nothing except that
one person's work happens to carry dates.

The lanes are therefore the containment tree `work.json` already stores:

```
target      ▸ its own committed window, its direct tasks
  milestone ▸ its own committed window, its tasks          indented under the target
milestone   ▸ parentless milestones follow, at the top level
No milestone ▸ tasks that hang off nothing — never hidden
```

Every bar in a lane is then evidence for or against **one dated commitment somebody made**,
which is what "measure progress" has to mean in a module whose only progress rule is
`completed children ÷ total children`.

- **The axis needs no new field and no new query** — it is `kind` and `parentId`, both on
  the model since v1.
- **Member load keeps two honest homes**: *Group by → Assignee* on the board (TM-AD-15),
  and the member dashboard (§3.13). The assignee still rides on every bar as initials,
  because *"who is this waiting on"* is a fair question to ask of a task.
- **Progress fill and leave bands leave with the member lanes.** A fill needs a per-task
  percentage nobody types. An approved leave band means something real on a person's row
  and nothing at all on a milestone's — leave stays on the calendar and on §3.7. A lane
  states instead what is countable and already stored: *n of m tasks done*, and its dates.

### TM-AD-25 · The rail is the module's shell, not the calendar's sidebar

The founder's note is *"this left sidebar I like — an analytics indicator for our
progress, with daily task management, interlinked with a dedicated page"*. Read literally
that is a calendar sidebar. Built literally it would be a progress indicator that
**disappears the moment somebody clicks Board**, which is the fastest way to make people
stop trusting a number.

The rail is therefore what `/work` opens on, and it carries:

```
+ Create ▾        one control, three kinds            TM-AD-26
mini month        click a day → that month, that face
This month        done · open · delay · waiting, for the month in view
Tasks             overdue, then due today, then the next three days
Milestones        work bar + ▾ where today sits in the window   TM-AD-30
Targets           the number first, over a value bar            TM-AD-30
```

Five blocks, five queries, one component. Below **1240px** — the breakpoint the panel
already uses — it collapses.

> **Amended the same day, on the founder's direction: the rail is the calendar face's and
> no other's.** It was first drawn on all four; the board and the timeline now have their
> full width back and no rail at all.
>
> The reason it survives contact: the board is a horizontally scrolling grid of five
> columns and the timeline is a date grid behind a 210px lane column, so the rail was
> taking 238px from the two faces that could least afford it — and on both, the same
> information is already on screen in a better shape. The board's **Delay** and
> **Complete** columns count themselves; every timeline lane states *n of m tasks done*.
>
> What it costs is small and worth saying out loud: **switch to the board and the progress
> bars are not in front of you.** The calendar is the face `/work` lands on (TM-AD-23), and
> the two surfaces that exist to be read rather than worked in — §3.12's roll-up and §3.13
> — carry the same numbers from the same derivation. **TM-R-15 is closed by this**: the
> risk was what the rail cost the board, and the rail is no longer on the board.

**What it deliberately does not hold is the filters.** Google's rail lists calendars to
tick; ours would have to list members, kinds and tags, three filter sets that mean
different things on each face. A filter that survives a face switch is how somebody loses
half their board without noticing. Filters stay in each face's toolbar; the rail holds
only what is true whichever face is open.

**`Today` is a summary and it links to the page that owns the day.** Ticking completes in
place; reordering, rescheduling and the full list are `/team/me?tab=work` (§3.13), which
this document already had to design as the member's own work surface. The rail summarises
it. It never becomes a second one.

**`Progress` is two sections — Mine, then My team** — and team is `reportsTo`, one level,
never transitive (TM-AD-13). A member with no reports never sees the second heading. Note
what is *not* in it: a bar per person. A bar against a milestone counts its children; a
bar against a person is the score **TM-OD-11** refuses to compute.

### TM-AD-26 · One Create control, three kinds — never three buttons

`+ Create ▾` opens *Task · Milestone · Target*, and all three open **the same form** with
`kind` prefilled. They are one `WorkItem` with a `kind` — the premise TM-AD-15 already
rests on — and a target only adds `targetValue` and `targetUnit` to the same six fields.

Three buttons become three forms, then three validators, then three lists, and the module
is back to the three tables `work.json` exists to avoid.

**The control travels; the form does not change.** On the calendar it sits at the top of
the rail. On the board and the timeline — which no longer have a rail — the same control
and the same menu sit in the toolbar, where `+ New item` used to be. One control, one
form, three kinds, on every face.

### TM-AD-27 · Every number in the rail is derived — and drawing it caught three that were not

A milestone's bar is `completed children ÷ total children`. A target's bar is
`currentValue ÷ targetValue`. Neither is stored and neither is typed.

Drawing the rail against the seed found the failure that rule exists to prevent. The
wireframe's copy of the seed carried a typed `progressPct` on every milestone:

| Milestone | Typed | Derived from its children |
| --- | --- | --- |
| Enquiry response under 4 hours | 60% | **0%** — 0 of 4 tasks complete |
| Onboard 12 businesses in Pune | 50% | **0%** — 0 of 2 |
| Support handover document | 33% | **0%** — 0 of 2 |
| Close Sharma Interiors | 50% | 50% — 2 of 4 |

Three of four were fiction, and `§3.12`'s roll-up was printing two of them. The typed
field is gone from the wireframe seed; `work.json` never had it, and its own `$comment`
on `W-M03` already said *"if a `progressPct` ever appears on this row in a payload, it is
the field to delete, not the one to trust"*.

> **That gap is the feature.** A rail that reads *0 of 4* is the only thing that will make
> anybody close a task. A rail that reads 60% because someone typed 60% is decoration.

One further number was reconciled: *Onboard 60 businesses* was drawn at 38 / 60 in the
wireframe and stands at **47 / 60** in `work.json`, which is the file of record.

### TM-AD-28 · A long item draws twice, not on every day it spans

Rendered the naïve way — *an item appears on every day between `startDate` and
`dueDate`* — September is **unreadable**. Both targets and *Enquiry response under 4
hours* run from July to 30 September, so every single day of the month printed the same
three chips and pushed that day's actual tasks into `+4 more`.

```
before                                    after
┌────────┐  every day, all month          ┌────────┐
│ 3      │  ◆ Close 40 deals              │ 3      │  ● Q3 pipeline review
│ TODAY  │  ◆ Onboard 60 businesses       │ TODAY  │
│        │  ◆ Enquiry response…           │        │
│        │  +4 more   ← the real work     │        │
└────────┘                                └────────┘
```

**The rule:** a *task* of a week or less draws on every day it spans; anything longer, and
every milestone and target, draws exactly twice — `▸ starts` and `▪ due`. The long ones
are not lost: they are in the rail with a bar, which is the right shape for a commitment
that has no single day.

### TM-AD-29 · Five stages, the same five for everyone — and the fifth is not stored

The founder's rule is *"a user can add any tag to the event, but the stages remain the
same for all"*, and the five are named: **Planning · In progress · Complete · Delay ·
Cancel**.

The first half of that was already the design (TM-AD-14: a tag is a record somebody owns,
a stage is company vocabulary). The second half changes two things.

**`Blocked` leaves the stages.** It was never the same kind of thing as the other four:
*late* is a date and *waiting on someone* is a relationship, and only one of those belongs
on an axis that answers "where is this work". It becomes `blockedByItemId` **with a
reason** — the strong link TM-AD-16 already refuses to let the weak link list create — and
the card draws a ⛔ marker wherever it appears. The one blocked row in the seed shows what
the stage was hiding: `Pune tier pricing sign-off` said *blocked* and recorded **nothing
about what was blocking it**. It is now In progress, waiting on `Q3 pipeline review with
the founders`, and it shows in Delay because it is seven days over.

**`Delay` joins them, and it is computed.** `dueDate < today AND stage not terminal`,
derived at read against `asOf`, exactly as it always was — the change is that it is now a
*column and a stage name* rather than a rail colour.

```
stored     planned · in_progress · completed · cancelled      4 values, on the item
derived    delayed                                            0 values, on nobody
labels     Planning  In progress  Delay  Complete  Cancel     vocabularies.json
```

- **A stored Delay needs a sweep job to stay true**, and this backend has no queue. Worse,
  it lets a card read *In progress* three weeks past its date because nobody moved it —
  which is the exact failure the founder's rule is trying to prevent.
- **Derived, it is identical for every member without anyone maintaining it.** That is what
  *"the same for all"* has to mean if it is to survive a year.
- **It takes precedence in the grouping**, so every item is in exactly one column and the
  strip still adds to 22.
- **Four columns accept a drop; Delay accepts none** — there is nothing to write. Dragging
  *out* of it is the move that matters: it sets a real stage, and the card leaves by itself
  when the date is met.
- **Column order is lifecycle, not the order the five were listed in.** Delay is work that
  is not finished, so it sits before the two terminal columns rather than after Complete.

> Tags are free because a tag is one person's way of finding their own work. Stages are
> fixed because a stage is how the company reads everybody's work at once. If stages were
> records too, the board would have as many columns as it has people and no two of them
> would mean the same thing.

### TM-AD-30 · Tasks ▸ milestones ▸ targets, and a target is not drawn like a milestone

Two instructions, and the second is the interesting one.

**The order is the order somebody works in.** Task, then milestone, then target: the thing
you do today, the thing your tasks add up to, the number the quarter is judged on. Reading
down the rail you zoom out, and the block you can act on is the one you reach first. The
same order is used on §3.12 and §3.13 — a member who learns it once has learned it
everywhere.

**The two mark blocks are drawn differently because the two things are different.**

```
MILESTONE            a window with children under it
  bar   = completed children ÷ total
  ▾     = elapsed share of startDate → dueDate
  read  = marker ahead of fill means behind schedule

TARGET               a count of units
  number = currentValue, first and largest
  bar    = the same ratio in the brand tone, with a left rule
  window = one line of text underneath, not a marker
```

`Close Sharma Interiors` is the case that earns the marker: **50% done, 91% of its window
gone, due in two days.** Neither number alone says that, and no score is computed to say
it either — **TM-OD-11** holds, because two honest numbers side by side are not a rating.

A target gets the opposite treatment for the opposite reason: nobody asks *"is the deal
count on schedule"*, they ask **how many are left**. So `15` leads, `of 40 deals` follows
it small, and the window is a line of text. Two glances, two different answers.

**One set of components, three surfaces.** `pbTasks`, `pbMarks('milestone')`,
`pbMarks('target')` and the derivations under them render the rail (§3.3), the captain
roll-up (§3.12) and the member dashboard's Work section (§3.13). Scope is the only
argument that differs — self for the rail and §3.13, `reportsTo` one level for §3.12.

> Three surfaces each computing progress their own way is exactly how §3.12 came to be
> printing two typed percentages that its own children disagreed with (TM-AD-27). One
> component cannot drift from itself.

### TM-AD-31 · The prototype is the spec's own components, wired to a route

A clickable prototype normally rots the moment the specification moves, because it is a
second implementation of the same screens. §P is not allowed to be one.

Every renderer in this document was split into a **builder** that returns HTML and a
**writer** that puts it somewhere:

```
calHtml()      → renderCal()      writes §3.3   ·  appCal()   places it in §P
boardHtml(ax)  → renderBoard()    writes §3.2   ·  appBoard() places it in §P
tlHtml()       → renderTl()       writes §3.4   ·  appTimeline()
railHtml()     → renderWorkRail() writes §3.3   ·  appCal()
pbTasks / pbMarks                 write §3.12, §3.13, the rail and §P
```

The rule that follows: **no face may be re-implemented for the demo.** If §P shows
something §3.2 does not, one of them is lying, and the only way to keep that impossible is
to make it the same function. It is also what makes §P cheap — it is a router, a sidebar,
a drawer and nothing else.

Two consequences worth stating:

- **Clicks inside §P never leave §P.** The shared builders emit `data-goto="5"` because on
  the spec screens a card jumps to §3.5; inside the panel that has to mean *open the
  drawer*. A capture-phase handler on the panel translates it, and the few deliberate
  "open §3.7 ▸" buttons are allowed through.
- **§P is a prototype and says so.** Filters and search are drawn, not wired, and it says
  which is which on the screen. A demo that hides its own edges is how a stakeholder ends
  up approving something nobody costed.

## 3. The wireframes

Notation: `[ ]` a control · `▾` a menu · `◍` a member · `◆` a milestone or target ·
`⚠` derived warning · **NEW** on a block that does not exist today.

### 3.1 Navigation — unchanged

No new sidebar rows. Everything below lands inside the four destinations the Team group
already has.

```
Team
  ├─ Members        /team          live
  ├─ Roles          /roles         live
  ├─ Attendance     /attendance    + leave request, + leave inbox      NEW blocks
  ├─ Calendar       /work          renamed · + calendar face (default),
  │                                 + timeline face                    NEW faces
  └─ Reports        /reports       unchanged
        /team/me    the member dashboard — + pay, agreements, resources tabs
```

### 3.2 Board — the selectable column axis (extends the shipped board)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ [ ▦ Calendar ]NEW·DEFAULT [ ▤ Board ] [ ☰ List ] [ ⊞ Timeline ]NEW                │
├──────────────────────────────────────────────────────────────────────────────────┤
│ ⌕ Search  [Member ▾][Kind ▾][Stage ▾][Priority ▾][Tag ▾]NEW    [+ Create ▾]      │
│ Group by: [ Tag ▾ ]NEW    Stage · Kind · Assignee · Priority · Tag               │
├──────────────────────────────────────────────────────────────────────────────────┤
│ 34 items │ ● 12 in progress · 8 planning │ ⚠ 5 in delay │ ⛔ 2 waiting │ 7 done   │
├──────────────────────────────────────────────────────────────────────────────────┤
│  ┌─◆ MEETING 6─┐ ┌─◆ CALL 11──┐ ┌─◆ SITE VISIT 4┐ ┌─UNTAGGED 13─┐                │
│  │ ▸ Vendor    │ │ ▸ 3 leads  │ │ ▸ Sharma flat │ │ ▸ Q3 draft  │                │
│  │   ◍ Meera   │ │   ◍ Arjun  │ │   ◍ Meera     │ │   ◍ Sanjay  │                │
│  │   HIGH ⚠2d  │ │   MED      │ │   LOW  10 Sep │ │   ✓ 29 Aug  │                │
│  │   ◆ Q3      │ │   ◆ Q3     │ │               │ │             │                │
│  └─────────────┘ └────────────┘ └───────────────┘ └─────────────┘                │
│                                                                                   │
│  ⓘ Cards may be dragged only when Group by = Stage. On every other axis the      │
│    columns are a grouping, and a reassignment needs a reason (TM-AD-15).          │
└──────────────────────────────────────────────────────────────────────────────────┘
```

On the **Stage** axis the columns are the five every member shares, and the derived one
takes precedence so each item sits in exactly one of them — over the 22 seeded items:

```
Planning 3 │ In progress 5 │ Delay 10 │ Complete 3 │ Cancel 1   ─ and they add to 22
   ↑ four stored stages, each accepting a drop ↑        ↑ Delay accepts none
```

**`UNTAGGED` is always the last column and is never hidden.** A grouping that silently
drops the ungrouped rows is a board that lies about its own count — the strip at the top
says 34 and the columns must still add to 34.

### 3.3 Calendar — `/work?face=calendar` NEW · the default face (TM-AD-23)

Builds on the v1 §3.7 sketch, and now takes Google Calendar's **layout** as well as its
grid: a left rail beside a month. Taken — the rail, Create at the top of it, the mini
month, the day's tasks, the coloured chip, click-a-day-to-create, keyboard paging. Not
taken — overlapping event layout, all-day vs timed lanes, recurrence, invitations,
drag-to-resize, and the rail's list of tickable calendars (TM-AD-25).

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ [▦ Calendar][▤ Board][☰ List][⊞ Timeline]  [Today] ‹ September 2026 › [M][W]     │
├──────────────────────┬───────────────────────────────────────────────────────────┤
│  + Create         ▾  │  MON    TUE    WED    THU    FRI    SAT    SUN            │
│  ──────────────────  │ ─────────────────────────────────────────────────         │
│  mini month          │  31      1      2      3      4      5      6             │
│  ──────────────────  │  ●⚠Pune ●Draft        TODAY  ●Run-  ◆▪due                 │
│  September 2026      │  +1                  ●Q3    book   Sharma                 │
│   11 dated           │ ─────────────────────────────────────────────────         │
│   0 done · 8 open    │   7      8      9     10     11     12     13             │
│   3 delay · 0 waitng │          ▒▒ N. Pillai on leave                            │
│  ──────────────────  │                      ◆▪due                                │
│  Tasks               │                      handover                             │
│   ☐ Q3 pipeline      │ ─────────────────────────────────────────────────         │
│  Milestones          │  14     15     16     17     18     19     20             │
│  ──────────────────  │         ◆▪due                                             │
│   ◆ ███░░▾░  50%     │         Pune                                              │
│  Targets             │ ─────────────────────────────────────────────────         │
│   ▌◈ 15 of 40 deals  │  … 21 – 27, nothing is dated …                            │
│                      │ ─────────────────────────────────────────────────         │
│                      │  28     29     30      1      2      3      4             │
│                      │                ◈▪due ◈▪due ◆▪due  (30 Sep carries 3)      │
└──────────────────────┴───────────────────────────────────────────────────────────┘
```

**The rail belongs to this face and to no other** — TM-AD-25, amended. §3.2 and §3.4 keep
their full width and take Create into their toolbars instead.

```
┌────────────────────────────────┐
│  ┌──────────────────────────┐  │
│  │      + Create       ▾    │  │
│  └──────────────────────────┘  │
│     ● Task                     │
│     ◆ Milestone                │
│     ◈ Target                   │
│     one form, kind prefilled   │
├────────────────────────────────┤
│  M  T  W  T  F  S  S           │
│ 31  1  2 (3) 4  5  6           │
│  7  8  9 10 11 12 13           │
│ 14 15 16 17 18 19 20           │
│ 21 22 23 24 25 26 27           │
│ 28 29 30  1  2  3  4           │
│ (3) = today · a dot = a day    │
│ that carries something         │
├────────────────────────────────┤
│ SEPTEMBER 2026     11 dated    │
│ ░░░░░░░░░░░░░░░░▒▒▒▒▒▒         │
│ 0 done · 8 open                │
│ 3 in delay · 0 waiting         │
├────────────────────────────────┤
│ TASKS                  3 Sep   │
│ Due today · 1                  │
│ ☐ Q3 pipeline review with      │
│   the founders                 │
│   due today · medium · Meetng  │
│ ┌ + add a task for today ───┐  │
│ [     Open my work ▸       ]   │
├────────────────────────────────┤
│ MILESTONES          derived    │
│ My team · 2                    │
│ ◆ Close Sharma Interiors       │
│ ███████░░░░░░▾░  50%           │
│ Rahul · 2 / 4 tasks   5 Sep    │
│ ▾ 91% of the window gone,      │
│   50% of the work done         │
│ ◆ Onboard 12 in Pune           │
│ ░░░░░░░░░▾░░░░   0%            │
│ Priya · 0 / 2 tasks  15 Sep    │
├────────────────────────────────┤
│ TARGETS             derived    │
│ Mine · 1                       │
│ ▌◈ Close 40 deals this qtr     │
│ ▌ 15  of 40 deals       38%    │
│ ▌ ██████░░░░░░░░░░             │
│ ▌ 70% of the window gone       │
│ ▌              due 30 Sep      │
└────────────────────────────────┘
```

**A multi-day task appears on every day it spans, not only its due date.** `startDate`
has been on the model since v1 and the board never used it; the calendar is the first
face where it means anything, and an item that shows only on its last day is a deadline
list rather than a schedule.

**A quarter-long item, however, is not an event on ninety-two days** — TM-AD-28, and it
was found by rendering the month rather than by reasoning about it.

**Week view is the same grid with seven columns and rows by item — no hour gutter.**
Nothing in this module has a start and end *time* except attendance, which has its own
strip. An hour grid would be mostly empty and is the largest piece of net-new UI in the
plan for the least return.

**Drag and drop stays out** (TM-OD-08, reaffirmed). Reschedule is a date field in the
drawer.

### 3.4 Milestone timeline — `/work?face=timeline` NEW

The brief's *"so they measure progress"*, read as **whose commitment is this** rather than
**who is busy** — see TM-AD-24. One lane per target and per milestone, its own committed
window drawn dashed and its tasks drawn solid from `startDate` to `dueDate`. Nested
milestones sit indented under their target. The last lane is *No milestone* and is never
hidden.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ‹ Aug 24 – Sep 6 ›  [2w][4w][Quarter]  [Group: Milestone ▾]NEW    targets · tasks│
├──────────────┬───────────────────────────────────────────────────────────────────┤
│              │ 24  25  26  27  28  29  30  31 │ 1   2   3   4   5   6            │
│              │                          ┊TODAY                                   │
├──────────────┼───────────────────────────────────────────────────────────────────┤
│ ◆ Close 40   │ ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌  ◆ 1 Jul – 30 Sep          │
│   deals      │                                                                   │
│   Target ·   │                                                                   │
│   1 milestone│                                                                   │
├──────────────┼───────────────────────────────────────────────────────────────────┤
│   ◆ Close    │ ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌  ◆ due 5 Sep                   │
│     Sharma   │ ▓▓▓▓  RM · Revised quotation → Sharma    ⚠ 6d over                │
│     Milestone│   ▓▓  RM · Site visit — Kalyani Nagar    ✓                        │
│     2 of 4   │ ▓▓    RM · Sharma measurement sheet      ✓                        │
│     due 5 Sep│                                                                   │
├──────────────┼───────────────────────────────────────────────────────────────────┤
│ ◆ Enquiry    │ ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌  ◆ due 30 Sep                │
│   response   │     ▓▓  MN · Triage the August backlog   ⚠ 6d over                │
│   Milestone  │                                                                   │
│   0 of 4     │                                                                   │
├──────────────┼───────────────────────────────────────────────────────────────────┤
│ · No         │    ▓▓  DK · Weekly ops review deck      ✓                         │
│   milestone  │        ▓▓▓▓▓  SR · August payout recon.  ⚠ 3d over                │
│   3 tasks    │                                                                   │
├──────────────┴───────────────────────────────────────────────────────────────────┤
│ ◆╌╌ = the lane's committed window · ▓ = a task · ⚠ delayed · click → drawer      │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Three things this view must **not** become, each of which is the usual way a timeline
rots:

- **Not a Gantt with dependencies that gate.** `follows` draws the connector and nothing
  more (TM-AD-16).
- **Not a resource planner.** No capacity bar, no allocation percentage. The module has
  no estimate field and inventing one to fill a chart is how estimates get born.
- **Not a ranking.** TM-OD-11 stands: show the numbers, sort by any column, compute no
  score. The milestone axis keeps this one true by construction — there is no member row
  left to rank.

**An item with no `startDate` cannot be drawn** and is listed under the grid as *"6 open
items with no start date — schedule them"*, which is the honest state rather than a bar
starting at an invented date. That count is the number this face exists to shrink.

**A lane's sub-line is countable, never a percentage:** kind, child milestones where there
are any, *n of m tasks done*, and its own due date. Progress fill and approved-leave bands
were removed with the member lanes (TM-AD-24).

### 3.5 Item drawer v2 — tags, links, dates (extends the shipped drawer)

```
┌─ WORK ITEM ─────────────────────────────────────────────┐
│ ▸ Vendor meeting — Sharma Interiors  ●in progress  HIGH │
├─────────────────────────────────────────────────────────┤
│ Kind          task                                      │
│ Assigned to   ◍ Meera Nair                              │
│ Tags          [Meeting ×] [Client ×] [+ add]        NEW │
│ Rolls up to   ◆ Q3 enquiry response time         → open │
│ Starts        28 Aug 2026                          NEW* │
│ Due           31 Aug 2026   (2 days)                    │
│ Description   …                                         │
│ Progress      ▓▓▓▓▓▓░░░░ 60%       ← milestone / target │
├─────────────────────────────────────────────────────────┤
│ LINKED ITEMS                                        NEW │
│  ↔ relates to   ▸ Pricing sheet for Sharma       → open │
│  ⊘ duplicates   ▸ Call Sharma about vendor       → open │
│  ⇢ follows      ▸ Site visit — Sharma flat       → open │
│  [+ link an item]                                       │
├─────────────────────────────────────────────────────────┤
│ ACTIVITY  created · assigned · tagged · status × 3      │
├─────────────────────────────────────────────────────────┤
│ [Start] [Complete] [Block…]           [Edit] [Cancel…]  │
└─────────────────────────────────────────────────────────┘
```

`NEW*` — `startDate` is already on the model and already in the seed. It has simply never
been shown, because neither shipped face used it. The calendar and timeline both do.

**The tag picker offers the member's own tags first, then the suggestions, then "create".**
Creating from the picker is one keystroke and is the only place tags are born — a
separate "create tag" screen would be a second entry point to a six-field record.

### 3.6 Tag manager — `/team/me?tab=work` sub-panel NEW

Small, and deliberately not a module.

```
┌─ MY TAGS ───────────────────────────────────────────────┐
│  ● Meeting        info    12 items    [rename] [archive]│
│  ● Call           brand   11 items    [rename] [archive]│
│  ● Site visit     ok       4 items    [rename] [archive]│
│  ● Follow-up      warn     7 items    [rename] [archive]│
│  [+ new tag]                                            │
│                                                         │
│  ⓘ Your tags are yours. Renaming one changes it on your │
│    items only — other members' tags with the same name  │
│    are their own records (TM-AD-14).                    │
└─────────────────────────────────────────────────────────┘
```

**Archive, not delete.** A deleted tag would have to either strip itself from historical
items — rewriting what a completed task was filed under — or leave dangling ids. Archive
removes it from the picker and leaves history intact, which is the same answer the module
already gives for `cancelled` work items.

### 3.7 Attendance — the leave request block NEW

Added to the shipped `/attendance` screen. The clock strip above it does not move.

```
┌─ MY DAY ──────────────────── Thu 3 Sep 2026 · 14:20 ────┐
│  ● Working   started 9:04 (late 4m)  ·  worked 4h 32m   │
│  [Take a break]                        [End the day]    │  ← shipped
├─────────────────────────────────────────────────────────┤
│  LEAVE                                              NEW │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Requested   12–13 Sep    casual    ⏳ with Meera  │  │
│  │ Approved    28 Aug       sick      ✓ by Meera     │  │
│  └───────────────────────────────────────────────────┘  │
│  [Request leave]                                        │
└─────────────────────────────────────────────────────────┘

┌─ REQUEST LEAVE ─────────────────────────────────────────┐
│  From [ 12 Sep 2026 ]   To [ 13 Sep 2026 ]   2 days     │
│  Kind [ Casual ▾ ]      casual · sick · unpaid · comp-off│
│  Reason                                                  │
│  [ Family function, out of Delhi_____________________ ]  │
│                                                          │
│  ⓘ Goes to Meera Nair, who you report to. Until it is   │
│    approved these days still count as absent.           │
│                                                          │
│                              [Cancel]  [Send request ▸] │
└─────────────────────────────────────────────────────────┘
```

That last note is the screen stating the rule from TM-AD-20 in the words the rule
actually has. A pending request changes nothing; only an approved one suppresses the
derived absence.

**Requesting leave for a date that already has an attendance row is refused inline** —
"you clocked in on 12 Sep". The member worked; a leave record over it would make the
same day both.

### 3.8 Leave inbox — senior side, on `/attendance` NEW

```
┌─ LEAVE REQUESTS ─────────────── 3 waiting on you ───────┐
│  ◍ Sanjay Kumar   12–13 Sep  casual   2d   "Family…"    │
│      Team that week: Meera on leave 12 Sep too      ⚠   │
│                              [Reject…]  [Approve]       │
├─────────────────────────────────────────────────────────┤
│  ◍ Arjun Rao      15 Sep     sick     1d   "Fever"      │
│                              [Reject…]  [Approve]       │
└─────────────────────────────────────────────────────────┘
```

**The overlap warning is a warning, not a block.** The system does not know how many
people the day needs. Refusing on a rule nobody configured would be the module inventing
a staffing policy; showing the clash lets the person who does know decide.

**Reject demands a reason** — the panel's existing pattern for every explanatory
transition, the same one `Block` and `Cancel` already use.

### 3.9 Agreements — three surfaces NEW

**Admin side**, `/team/:id?tab=agreements`:

```
┌─ AGREEMENTS ── ◍ Sanjay Kumar ──────────────────────────┐
│  Offer letter   v2   ✓ signed 26 Aug 14:02   [view PDF] │
│                      viewed 26 Aug 13:41                │
│  NDA            v1   ● sent 2 Sep · expires 9 Sep       │
│                      not opened yet   [resend] [revoke] │
│  Offer letter   v1   ⊘ superseded by v2      [view]     │
│  [+ New agreement ▾]   Offer letter · NDA · Custom      │
└─────────────────────────────────────────────────────────┘
```

**The public page**, `/a/<token>` — outside `/api`, no session, mounted the way the
quotation share link already is:

```
┌─────────────────────────────────────────────────────────┐
│               Interior Bazzar — Offer Letter            │
│                                                          │
│  Dear Sanjay Kumar,                                      │
│  … frozen document body, exactly as sent …               │
│                                                          │
├─ SIGN ──────────────────────────────────────────────────┤
│  Type your full name                                     │
│  [ Sanjay Kumar_________________________ ]               │
│                                                          │
│  or draw it            ┌────────────────────────┐        │
│                        │      ~Sanjay~          │ [clear]│
│                        └────────────────────────┘        │
│                                                          │
│  ☐ I have read and agree to the terms above.            │
│                                                          │
│           [ Decline ]              [ Sign and accept ▸ ] │
│  ⓘ This link expires 9 Sep 2026. Your name, the time,   │
│    and your IP address are recorded with the signature.  │
└─────────────────────────────────────────────────────────┘
```

Typed is first in tab order (TM-AD-06). The disclosure line is not decoration — recording
an IP against a legal signature is something the signer is entitled to be told before
they sign, not after.

**Three states this page must handle and most link pages get wrong:** an expired token
(offer to request a new link, do not show the document), a token already signed (show the
signed copy read-only, never a second signature box), and a revoked token (say revoked,
not "not found" — a candidate who was told a letter was coming deserves better than a
404).

**Opening the page writes the first real `VIEWED` event in this codebase.** The
quotation module's `viewed` is a *seller* claiming it. This one is the recipient's own
request, and the distinction is worth keeping in the audit trail.

### 3.10 Resources — the member's own documents NEW

`/team/me?tab=resources`, and the same tab read-only on the admin side.

```
┌─ MY DOCUMENTS ──────────────────────────────────────────┐
│  Required                                                │
│   ✓ PAN card          uploaded 26 Aug        [replace]  │
│   ✓ Aadhaar           uploaded 26 Aug        [replace]  │
│   ⚠ Address proof     not uploaded           [upload]   │
│   ⚠ Bank passbook     not uploaded           [upload]   │
│                                                          │
│  Other                                                   │
│   ✓ B.Arch degree     uploaded 27 Aug   [replace] [×]   │
│   [+ add a document]                                     │
│                                                          │
│  ⓘ Only you and an admin can open these. Required        │
│    documents cannot be removed while you are active.     │
└─────────────────────────────────────────────────────────┘
```

**"Required" is a vocabulary list, not a gate.** Nothing in the panel blocks on a missing
document; it shows as missing on the member row and in the admin's roster filter. A hard
gate would stop somebody working on their first day over a scan.

> **TM-R-11 applies here in full.** Every S3 upload in this backend today is a public
> URL. Identity documents must be private objects behind a signed read. This is the
> single most sensitive surface in the module.

### 3.11 Pay — salary and incentives, read from Finance NEW

`/team/me?tab=pay`:

```
┌─ PAY ───────────────────────────────── ◍ Sanjay Kumar ──┐
│  Salary account            ₹ 62,000 / month             │
│  Effective from            1 Jun 2026                   │
│  Paid from                 HDFC current · ACC-HDFC-4021 │
│                            → read from Finance          │
├─ PAYSLIPS ──────────────────────────────────────────────┤
│  Aug 2026    ₹ 62,000   + ₹ 4,500 incentive   [download]│
│  Jul 2026    ₹ 62,000                          [download]│
│  Jun 2026    ₹ 41,333   pro-rata               [download]│
├─ INCENTIVES ────────────────────────────────────────NEW─┤
│  ₹ 4,500   Aug   ◆ Close 40 deals — 45 closed   ✓ paid  │
│  ₹ 2,000   Sep   ▸ Sharma Interiors onboarded   ⏳ pending│
│  ⓘ Earned against work; approved and paid by Finance.   │
└─────────────────────────────────────────────────────────┘
```

Every figure on this screen is a read (TM-AD-19). There is no edit control anywhere on
the member side, and on the admin side the buttons link **into Finance** rather than
writing from Team.

**The incentive rows are the join the brief asked for**, in both directions: from a
target, *what did this earn*; from a member, *what have they earned*.

### 3.12 Captain dashboard — the roll-up on `/reports`

The shipped performance view gains three blocks. It is not redesigned.

```
┌─ TODAY ───────────────────────── Thu 3 Sep 2026 ────────┐
│  In 6 · late 1 · on leave 1 · absent 0 · unclosed 2  ⚠  │  ← + on leave  NEW
│  Plans in 5/7 · EOD in 0/7 (day is not over)            │
├─ WAITING ON YOU ────────────────────────────────────NEW─┤
│  3 leave requests  ·  2 EOD reports unacknowledged      │
│  1 agreement sent 8 days ago, never opened          ⚠   │
├─ TASKS ─────────────────────── me and my reports ───NEW─┤
│  Overdue · 5   ☐ Triage the August backlog   ⚠ 6d over  │
│                ☐ Call back the 6 unreached   ⚠ 6d over  │
│                … and three more                         │
│  Next 3 days   ☐ Rewrite the no-match runbook    4 Sep  │
├─ MILESTONES ────────────────────────────────────────NEW─┤
│  ◆ Enquiry response u/4h  ░░░░░▾░░░░  0%   0/4   30 Sep │
│    ▾ 55% of the window gone, 0% of the work done        │
│  ◆ Support handover doc   ░░░░░░▾░░░  0%   N.·0/2 10 Sep│
├─ TARGETS ───────────────────────────────────────────NEW─┤
│ ▌◈ Onboard 60 businesses                                │
│ ▌  47  of 60 businesses                            78%  │
│ ▌  ███████████████░░░░░                                 │
│ ▌  70% of the window gone                    due 30 Sep │
│                              [open the timeline ▸]  NEW │
└─────────────────────────────────────────────────────────┘
```

**The three lower blocks are the rail's**, not a second implementation of it — TM-AD-30.
Same order, same components, same derivations; the only argument that changes is the
scope, which here is `reportsTo` one level instead of self. That is why *Tasks* reads five
overdue rows across two reports rather than the captain's own one.

**"Waiting on you" is the only genuinely new idea here**, and it is one query per row
rather than a feed: things that have stopped because a specific person has not acted.
An unopened agreement belongs in it for the same reason a pending leave request does —
both are blocked on a human, and neither shows up anywhere else until someone goes
looking.

### P. The panel, clickable — a prototype, not a fourteenth screen

Thirteen wireframes argue the decisions. This one lets them be walked: the real sidebar
down the left, the faces as tabs, an item opening as a drawer over whatever is behind it,
and the URL that produced it printed beside the title.

```
┌──────────┬───────────────────────────────────────────────────────────────────────┐
│ SALES    │ Calendar   [▦][▤][☰][⊞]      signed in as [A. Sharma ▾]               │
│  Deals · │                                        #/work?face=calendar&item=W-K08│
│  Plans · ├───────────────────────────────────────────────────────────────────────┤
│ CLIENT   │ [Today] ‹ September 2026 ›  [Month][Week]   [Member▾][Kind▾][Tag▾]  ⌕ │
│  Enq.  · ├──────────────┬────────────────────────────┬───────────────────────────┤
│ TEAM     │ + Create   ▾ │  MON  TUE  WED  THU  FRI   │ ● Pune tier pricing  Delay│
│  Members │ mini month   │   31   1    2   TODAY  4   │ ─────────────────── [✕]   │
│  Roles   │ This month   │        ●Draft      ●Q3     │ Kind        Task          │
│ ▸Calendar│ Tasks        │                            │ Stage       Delay derived │
│   ▦ a tab│ Milestones   │                            │ Waiting on  ⛔ Q3 review   │
│   not a  │ Targets      │                            │ Rolls up to ◆ Onboard 12  │
│   row    │              │                            │ [Start][Complete][Wait…]  │
│  Reports ├──────────────┴────────────────────────────┴───────────────────────────┤
│  My dash │                          ░ the face keeps its place behind the drawer │
│ FINANCE …│                                                                       │
└──────────┴───────────────────────────────────────────────────────────────────────┘
```

**The sidebar is the real one.** Group order and row order are read off
`admin/shell/modules.ts` — Sales, Client Ops, Business Ops, **Team**, Finance, Settings —
with `Work` reading **Calendar** per TM-AD-23. The six modules outside Team are dimmed and
open a note; a nav that quietly dropped them would not be a fair test of where this one
sits. Attendance says what §3.7 and §3.8 add to it and links there.

**The faces are tabs, not sidebar rows** — TM-AD-12, and the sidebar proves it by showing
the open face as a *sub-label* under Calendar rather than as four rows. A status line is
not a second place to click.

**An item opens as a right-side drawer over the face**, `?item=` appended to whatever
route is open, exactly as §3.5 spec'd and as the shipped panel already does for members
and enquiries. Escape, the ✕ and the backdrop all close it, and closing drops the
parameter rather than pushing a page. The drawer states the derived stage *and* the stored
one — *Delay · derived · 7d past 27 Aug · stored stage is In progress* — which is TM-AD-29
made visible at the only place someone could be misled by it.

**What is real and what is drawn**, said on the screen itself. Real: the routes, the face
switch, the drawer, the mini month, *Group by*, month and week paging, the timeline's date
window, and every number on every block. Drawn: the filters, search, the Create form
itself, and the six modules outside Team.

---

## 4. Data model delta

### 4.1 New entities

| Entity | Owner | Key | Note |
| --- | --- | --- | --- |
| `Tag` | Team | `(ownerId, slug)` | Member-owned. Archived, never deleted. |
| `WorkLink` | Team | `(fromItemId, toItemId, relation)` | Edge list. Forbidden from rollup (TM-BR-02). |
| `LeaveRequest` | Team | `requestId` | Approved rows suppress a derived absence. |
| `Agreement` | Team | `agreementId` | Frozen at send, versioned, token-delivered. |
| `Resource` | Team | `resourceId` | Private object. Deletable on request. |
| `Incentive` | **Finance** | `incentiveId` | Team supplies the basis; Finance owns the money. |

Five of the six are Team's. `Incentive` is deliberately not, and that is TM-AD-19.

### 4.2 Extended entities

| Entity | Added | Why |
| --- | --- | --- |
| `WorkItem` | `tagIds[]`, `links[]` (derived from `WorkLink`) | §3.5. `startDate` already exists and is finally used. |
| `WorkItem` | **`progressPct` removed, not added** | TM-AD-27. Derived at read from the children, or from `currentValue ÷ targetValue`. A payload that carries it is carrying a number that will be wrong by Thursday. |
| `Member` | `departmentId` *(reserved, TM-OD-20)* | Reserved so the answer to TM-OD-20 is additive either way. |
| `AttendanceDay` | nothing | Leave does not touch it. That is the point of TM-AD-20. |
| `vocabularies.json` | `tagSuggestions[]`, `leaveKinds[]`, `linkRelations[]`, `agreementKinds[]`, `resourceKinds[]`, `on_leave` in `attendanceStates` with `stored: false` | Static copy, all of it. |
| `vocabularies.json` | `workStages[]` — **five**, with `blocked` removed and `delayed` added carrying `stored: false` | TM-AD-29. Same shape as `on_leave`: the file is where the panel learns that one value in a list is computed and can never be written. |

### 4.3 Content files this adds

Following the proto convention — one file per endpoint, `$comment` at the top, JSON not
TS, committed under the `.gitignore` carve-out.

```
src/content/team/
  tags.json         → GET /admin/team/tags                 placeholder records
  leave.json        → GET /admin/team/leave?from&to        placeholder records
  agreements.json   → GET /admin/team/agreements           placeholder records
  resources.json    → GET /admin/team/resources            placeholder records
  vocabularies.json → extended, STATIC COPY (not placeholder)

src/content/finance/
  incentives.json   → GET /admin/finance/incentives        placeholder records
```

`work.json` gains `tagIds[]` and a `links[]` array on existing seed rows rather than a new
file — they are fields on an item, and the endpoint that returns the item returns them.

**No new file for the timeline or the calendar.** Both are faces over `work.json`, and a
file per face would be the exact mistake rule 1 of the convention exists to prevent.

---

## 5. Permission delta

No new module keys. The four that exist absorb everything:

| Key | New verbs | On |
| --- | --- | --- |
| `attendance` | `leave.request` *(self, no grant needed)* · `leave.decide` | §3.7, §3.8 |
| `work` | none — tags and links are self-scope on your own items | §3.2–3.6 |
| `team` | `agreement.send` · `agreement.revoke` · `resource.view` | §3.9, §3.10 |
| *(Finance)* | `incentive.approve` — **Finance's key, not Team's** | §3.11 |

**Self-scope needs no grant** — the rule from the v1 doc §6.3 is inherited unchanged. A
member requests their own leave, makes their own tags, uploads their own documents and
reads their own pay without holding a single permission. Everything that acts on somebody
else needs a verb.

> **TM-BR-01 still stands: never add `team` to `PROTO_MODULES`.** It has a real `Module`
> row and real server data. The four new verbs go on the server the normal way. The three
> operational keys that ARE in `PROTO_MODULES` stay there only until their endpoints
> land, and each comes out in the same commit as its endpoint.

---

## 6. Regression risk — what this touches that already works

| File | Change | Risk |
| --- | --- | --- |
| `views/Team/store.ts` | the `absent` derivation gains one clause | **High.** It is the module's central rule. Every attendance screen and every roll-up reads it. |
| `views/Team/Work.tsx` | two new faces, selectable column axis | **Medium.** Board and List must render identically to today when Group by = Status. |
| `views/Team/Attendance.tsx` | a leave block below the clock | **Low.** Additive; the clock strip does not move. |
| `views/Team/Reports.tsx` | three blocks on the roll-up | **Low.** Additive. |
| `content/team/vocabularies.json` | five new lists, one new state | **Medium.** `stored: false` on `on_leave` is load-bearing; getting it wrong makes leave writable. |
| `content/team/work.json` | two fields on existing rows | **Low.** |
| `views/Team/Work.tsx` (rail) | a left rail on all four faces, and `+ New item` leaves every toolbar | **Medium.** It narrows the board's columns at every width above the 1240px collapse. Check the board at 1280px before merging. |
| `admin-theme.css` / `team.css` | timeline and calendar grids | **Medium.** Use the `tm-` prefix. Four class collisions are already on record in this repo. |

**Must not change:** `teamShared.tsx` (`ActionMatrix` is canonical and shared with
Roles) · `views/Roles/**` · anything under `views/Finance/**` — the Pay tab **reads**
Finance and must not edit a file in it · `auth/session.ts` beyond leaving
`PROTO_MODULES` alone.

**Re-verify after every phase:** the board renders unchanged with Group by = Status · a
member with no leave rows still derives `absent` exactly as today · `npx tsc -b` and
`npx eslint` clean · `npm run check:finance` still passes untouched.

---

## 7. Implementation phases

Ordered by dependency. Each leaves the panel working.

| Phase | What | Depends on |
| --- | --- | --- |
| **A** | Vocabulary extension + `tags.json` + tag records, picker and manager (§3.5, §3.6) | TM-OD-20 answered |
| **B** | Selectable column axis on the board (§3.2) | A — Tag is one of the axes |
| **C** | Calendar face, month then week (§3.3), **and the rail** (§3.3, TM-AD-25/26/27/28) — **first**, it is the face `/work` lands on | — |
| **D** | Timeline face (§3.4) | C shares the date-grid mechanics |
| **E** | Leave: request, inbox, and the one-clause derivation change (§3.7, §3.8, TM-AD-20) | — |
| **F** | Links on the item drawer (§3.5) | D — `follows` draws on the timeline |
| **G** | Agreements: admin list, public page, signature (§3.9) | — largest server surface |
| **H** | Resources (§3.10) | private-object storage — TM-R-11 |
| **I** | Pay tab (§3.11) and the roll-up blocks (§3.12) | Finance's incentive endpoint |

**Parallel-safe:** {A→B}, {C→D}, {E}, {G}, {H} are four independent tracks.
**Not parallel-safe:** E touches `store.ts`'s central derivation — nothing else edits
that file while it is in flight. G and H both add storage and both must land after the
private-object decision, not before it.

---

## 8. Open decisions

| ID | Question | Recommendation |
| --- | --- | --- |
| **TM-OD-20** | **"My JD team" — is JD a second company, a department, or a job-description field?** The roster's shape depends on it. **Blocking Phase A.** | Ask. If it is a *department*, add `departmentId` to Member and one filter — cheap. If it is a *second company*, this is a tenancy question and it is bigger than this document. |
| **TM-OD-21** | Can an admin create a tag on somebody else's behalf? | **No.** Member-owned means member-owned; an admin tag would need an owner and there is no company owner. |
| **TM-OD-22** | Tag limit per member? | **Soft cap 20**, warn not block. Past that a tag list stops being a filter. |
| **TM-OD-23** | Does approved leave need a balance/quota? | **No quota in v1.** A quota needs an accrual policy, a carry-forward rule and a year-end job. Record the days; count them in a report. |
| **TM-OD-24** | Can a member cancel an approved future leave? | **Yes, before the from-date**, and it notifies the approver. After it starts, an admin corrects it. |
| **TM-OD-25** | Who approves leave when the member has no `reportsTo`? | Falls to any holder of `attendance.leave.decide`. Shown as *"waiting on an admin"*, never silently unrouted. |
| **TM-OD-26** | Does a signed offer letter auto-activate the account? | **No** — TM-OD-19 stands. Acceptance is the candidate's act; activation is the admin's. |
| **TM-OD-27** | Can an NDA be sent to a non-member? | **Not in v1.** `Agreement.memberId` is required. A prospect NDA means a party record this module does not have. |
| **TM-OD-28** | Which resource kinds are "required"? | Vocabulary, so it is configurable without a deploy. Seed: PAN, Aadhaar, address proof, bank passbook. |
| **TM-OD-29** | Who may approve an incentive? | **Finance**, not the captain. The captain proposes from a work item; Finance approves the money. |
| **TM-OD-31** | **One grant, spelled two ways.** v1 calls it `people-docs.view`; §5 here calls it `team.resource.view` and adds `team.agreement.send`/`revoke`. | **One shared read verb, separate write verbs.** An offer letter and an Aadhaar scan are the same sensitivity, so one read grant; sending an agreement and accepting an upload are different acts, so two write verbs. Reconcile before Phase G. |
| **TM-OD-32** | **What happens to the shipped member drawer** once `/team/me` exists? | **The drawer becomes a launcher** — identity, status, roles and its four actions stay; every informational block moves to the dashboard behind *Open dashboard ▸*. One place per fact. |
| **TM-OD-30** | Retention on `Resource` after a member leaves? | Flagged, not answered — a data-protection question, not an engineering one. Same status as TM-OD-17. |

## 9. Risks

| ID | Risk | Severity | Mitigation |
| --- | --- | --- | --- |
| **TM-R-10** | The `absent` derivation is the module's central rule and Phase E edits it. A wrong clause makes leave days read as absences, or absences vanish. | **High** | One clause, one file, one phase, nothing parallel. Seed a member with leave and a member without, and assert both before and after. |
| **TM-R-11** | Identity documents on a backend where **every S3 object is publicly readable by URL**. | **High** | Private objects + signed reads, decided before Phase H starts. Do not reuse the existing public `fileUrl` return. This is TM-R-04 with worse consequences. |
| **TM-R-12** | The public signing page is an unauthenticated write on a legal record, and the project still has no throttle class. | **High** | Inherits TM-R-05 in full: hashed token, expiry, single-use, revocable, per-token and per-IP limits, `attemptCount`. |
| **TM-R-13** | Timeline plus calendar is more net-new UI than the whole of v1's work face. | **Medium** | C before D, month before week, and both share one date-grid primitive. If D slips, C alone answers the brief's *"like Google Calendar"* — and after TM-AD-23 C cannot slip at all, because the sidebar row is named after it. |
| **TM-R-15** ~~open~~ **closed** | The rail costs 238px on every face, and the board is the face that can least afford it. | — | **Closed the day it was raised**, by TM-AD-25 being amended: the rail is the calendar's alone, so the board and the timeline never pay for it. What remains is ordinary — the calendar's own grid beside a 238px rail, which collapses below 1240px. |
| **TM-R-14** | Six tabs on the member dashboard, three of them added at once. | **Low–Medium** | **Mitigation taken up front — see TM-AD-22.** Agreements and Resources ship as two sections of one *Documents* tab, so only one tab is added, not three. Ship Pay last (Phase I). The next fold, if one is still needed, is Reports into Overview. |

---

## 10. Approval gate

**What this document is:** a wireframe and an architecture. No code was written and none
should be until it is approved.

**Reuse vs build, the short version.** Five of nine brief items attach to shipped records
and need no new entity: calendar, timeline, column axis, tags, links. Two are small new
entities on existing screens: leave, incentive-as-a-read. Two are genuinely new builds
with real server surface: agreements and resources — and both were already anticipated by
the v1 document's §3.11 and §3.12, so neither is a surprise.

**What needs an answer before Phase A:**

1. **TM-OD-20 — what "my JD team" means.** Department, second company, or a field on the
   member. This is the only blocking question in the document.
2. **Confirmation that Finance owns `Incentive`** (TM-AD-19), since it puts a table in
   another module's territory.
3. **A decision on private-object storage** before Phase G or H is scheduled (TM-R-11).

**Suggested order if all three clear:** C (calendar, the brief's headline and now the
module's landing face) → A → B (tags and the board, one week, visible immediately) →
E (leave, small and self-contained) → D (timeline) → G (agreements, the largest) → H → I → F.

Calendar moved from third to first with TM-AD-23: the sidebar row cannot read *Calendar*
before the calendar exists. It loses little by going early — it reads better once tags
exist to colour it, and tags land immediately after in A.
