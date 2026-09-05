# Changelog — proto v-2.2.0.0 (admin)

Newest first. One entry per feature. Format: [LOG-FORMAT.md](LOG-FORMAT.md).

---

## 2026-09-04

### A task you can read: two lines in the week, and done work that looks done

**Area:** sidebar → Team → **Calendar** (`#/work`) — the month and week grids
**Files:** `src/admin/views/Team/team.css`

**What changed**

- **The week stops truncating.** Every title in it was being cut mid-word to hold one line in
  a cell four times taller than it needed — and the whole reason to open a week is to read
  what is on the day. Two lines now, and measured against the seed rather than guessed: **19
  of 35 task titles are longer than one line and none are longer than two**, so every one of
  them arrives whole. The floor goes 380 → 560; twelve chips measure 528 of it.
- **Done work recedes.** Every chip carried full-contrast text whatever state it was in, so a
  finished task and one nobody has started read identically and the eye had no order to work
  in. Completed drops to the third text tone with its tick in the ok colour; open work keeps
  the foreground; only delay and waiting take a tint, because only those two need somebody.
- **The kind mark was too faint to be doing a job** — third tone on an 11px chip. Second now,
  so task, milestone and target are told apart at a glance.

The month view is unchanged: one line is all that fits in 132px, and the ellipsis there is the
honest answer.

**Verified**
`npx tsc -b` clean · eslint 0 errors · `npx vite build` succeeds · both check suites pass.

---

### The gap between chips is a different number in a week than in a month

**Area:** sidebar → Team → **Calendar** (`#/work`) — the month and week grids
**Files:** `src/admin/views/Team/team.css`

**What changed**

At 2px a stack of chips reads as one block rather than a list of things — worst in the week
view, where a cell is four times the height and holds the same handful of rows.

- **Month: 3px**, and the row floor goes 128 → 132 to pay for it. Three chips plus the
  overflow link now measure 126 of 132.
- **Week: 6px**, with the floor 320 → 380. Twelve chips measure 372 of 380.

Both numbers were computed rather than nudged, because the cells clip: a gap that does not
fit its floor slices the last chip in half, which is the defect this grid already had once.
Six rows still need 826px of the 924 a 1080-tall window leaves, so the month keeps stretching
to fill rather than scrolling.

**Verified**
`npx tsc -b` clean · eslint 0 errors · `npx vite build` succeeds · both check suites pass.

---

### Create opens on a title, not on a form

**Area:** sidebar → Team → **Calendar** (`#/work`) — the Create dialog, every kind
**Files:** `src/admin/views/Team/Work.tsx`, `team.css`

**What changed**

It was six labelled fields in a two-column grid, which asks somebody to read the dialog
before they can write the one thing they opened it for. Google's create dialog opens on a
single empty title and lets every other fact be a quiet row under the icon that names it;
that shape is borrowed here.

- **The title is the heading.** A large borderless field in the header slot, focused on open,
  with a rule under it that turns brand on focus — so there is no second heading above it
  saying the same word the tabs already say.
- **Kind is a tab row** directly under the title, on the panel's own `.tabs` — the underline
  idiom the member page already uses, not a fourth switcher invented for one dialog.
- **Five facts, five icon-led rows.** Dates (`start → due`), assignee, priority, and then
  either what it rolls up to or, for a target, its value and unit. No labels: the icon names
  the row and the control carries the value.
- **Quiet until reached for.** The controls have no border at rest and take one on hover and
  focus; a border on each of five optional facts is a wall of boxes. Only the background
  *colour* is cleared — `select.inp` draws its chevron with a background-image, and the
  shorthand would have taken the arrow with it.
- **Enter creates.** For most of these the title is the whole entry.

Nothing about the record changed: the same refusals, the same depth-3 parent rule, the same
"opens in Planning, and only the due date makes it Delay".

**Verified**
`npx tsc -b` clean · eslint 0 errors · `npx vite build` succeeds · both check suites pass.

---

### The pane opens with air, instead of welding its first control to the topbar

**Area:** sidebar → Team → **Calendar** (`#/work`, every face)
**Files:** `src/admin/views/Team/Work.tsx`, `team.css`

**What changed**

`.dls-body` carries **no top padding by design** — on a list screen the command row above it
supplies that gap. This module took that row off the calendar and moved the counts into the
topbar, so nothing was left to hold the first control off the chrome: Create and the date row
sat flush against the bar above them.

- **The pane provides its own gap** (`.tm-pane`, 16px) on every face, so the layout no longer
  depends on a band being present to breathe. Board, List and Timeline get it too — they lost
  the same strip.
- **16px between the date row and the grid** it drives, up from 12.
- **Chips stop touching the cell walls** — 8px of side padding instead of 4.
- The note under the grid takes the same rhythm.

Budget rechecked rather than eyeballed: a row is 122px of its 128px floor (6px spare), and six
rows plus the heads need 802px — inside the 924px a 1080-tall window leaves, so the rows
stretch to fill it rather than scrolling.

**Verified**
`npx tsc -b` clean · eslint 0 errors · `npx vite build` succeeds · both check suites pass.

---

### The calendar's layout pass: seven defects, measured rather than nudged

**Area:** sidebar → Team → **Calendar** (`#/work`, the calendar face)
**Files:** `src/admin/views/Team/Work.tsx`, `workBits.tsx`, `team.css`

**What was wrong, and what it is now**

1. **Chips were being sliced in half.** Not a spacing preference — arithmetic. A month row is
   128px; the date takes 26, a chip 22, the overflow link 18. Four chips plus "+n more" needs
   137px, so the cell's own clip cut the last one through the middle. The cap is three, and
   the **leave banner counts against it** — a day with somebody off was silently one row over.
2. **Two hairlines under the weekday heads.** The head carried a `border-bottom` and every day
   cell carries a `border-top`, so the first row drew both. The head's is gone: the row under
   it already draws the line, and it keeps doing so as the grid scrolls beneath the sticky
   head instead of doubling against whatever lands there.
3. **Every event was an outlined box** — forty rectangles on one screen, a grid inside a grid.
   The border is gone; the 3px tone rail carries the stage and a quiet ground carries the
   rest, so the eye sorts by colour instead of counting edges. Hover draws an outline rather
   than a new ground, so hovering a delayed chip no longer washes out the tint saying it is
   delayed.
4. **Chip text was 10px**, under this panel's readable floor, on the only words on the screen
   anybody actually reads. Now 11px — which is affordable precisely because the cap is three.
5. **Saturday was drawn exactly like Tuesday.** Weekends take the shell ground: quiet, not a
   different kind of cell, so a week is one glance instead of a column count.
6. **Empty progress tracks read as broken** — three milestones at 0% were three hairlines with
   a stray tick floating over them. The track has an inset edge, so it is still a track when
   nothing has filled it.
7. **Two rail blocks were chipped "derived" and the third with today's date.** The first is
   this module's vocabulary rather than the reader's; the second named a day the block does
   not show. All three carry a count.

Also: the legend moved out of the date bar — stranded at the far left of a row of
right-aligned controls — down beside the footnote, next to the chips it explains.

**Verified**
`npx tsc -b` clean · eslint 0 errors · `npx vite build` succeeds · both check suites pass.
Row budget recomputed: 3 chips + the overflow link = 115px of 128.

---

### The counts move into the header, beside the title — Deals' arrangement

**Area:** sidebar → Team → **Calendar** (`#/work`, every face)
**Files:** `src/admin/views/Team/Work.tsx`

**What changed**

- **47 items · 18 in progress · 13 planning · 7 in delay · 1 waiting · 7 complete** now sit in
  the topbar next to the title, on the panel's own `.tb-stats` — the same control Deals puts
  there, with its hairline divider, its `on` state and its scroll-when-narrow behaviour.
  They were a band of their own under the command row, which on a face bounded to the
  viewport is a full row's height spent on one line of text.
- **They read the store themselves** rather than taking the totals as a prop: the chrome node
  is captured once per location, so a prop would freeze at whatever the numbers were before
  the last write. Create something and the header moves.
- **Every count is still the filter for itself,** and pressing the one you are already on
  clears it — so the header is never a trap you have to leave by the chip row. Stage and
  waiting are one axis: two answers to "what state is this in", and a strip that could hold
  both at once would light two cells for one list. This also gives the calendar face its
  filtering back in one line, having lost the filter band.
- **The calendar face now carries no body band at all** — title, counts and the view switcher
  are all chrome, and the body is the rail and the grid.

**Verified**
`npx tsc -b` clean · eslint 0 errors · `npx vite build` succeeds · both check suites pass.

---

### The calendar drops its filter row, moves the date controls right, and the rail becomes an indicator

**Area:** sidebar → Team → **Calendar** (`#/work`, the calendar face)
**Files:** `src/admin/views/Team/Work.tsx`, `workBits.tsx`, `team.css`

**What changed**

- **No filter band on the calendar.** A month is read, not queried: the rail already answers
  "what is mine" and the grid answers "what is when", and the row was costing 56px of the one
  face bounded to the viewport. The three faces that ARE lists keep every filter, and a
  filter set on one of them survives the switch — the chips band stays and can still clear it.
- **Everything that moves the calendar sits at the right edge,** over the grid it moves:
  Today, ‹ ›, the month, and the Month/Week pair. The legend holds the left rather than
  leaving the row half empty.
- **The rail reads as an indicator, not a list.** A milestone row is now a heading — its name
  and its one number — over a bar, and nothing else. No "Mine / My team" split, no assignee,
  no due date: the grid beside it is already carrying all three, and at 248px those headings
  cost more rows than the rows they introduce.
- **One target, not four.** It is the number the quarter is judged on; a column of four is a
  list, not an indicator. What is cut says so — "2 more on the board" — rather than
  disappearing. The member dashboard and the roll-up keep the detailed rows: one component,
  a density flag, not a fork.

**Verified**
`npx tsc -b` clean · eslint 0 errors · `npx vite build` succeeds · both check suites pass.
Rail content checked against both rosters: 5 milestone bars, 1 target, "2 more on the board".

---

### Calendar takes the Deals header: a title, and one dropdown that names the face

**Area:** sidebar → Team → **Calendar** (`#/work`)
**Files:** `src/admin/views/Team/Work.tsx`

**What changed**

The header is the topbar now, the way Deals settled it — the page opens straight onto its
controls and spends no row on a heading it already has.

- **The four faces became one dropdown, top right.** Calendar · Board · List · Timeline, each
  row saying what it is for, the current one ticked. It *names* the face you are in, which a
  row of tabs can only do by spending the width of the filter row; Deals reached the same
  answer at four views and this is the same control (`.tb-view-btn` + `.pop-views`), not a
  second one that looks like it.
- **The scope note beside the title is gone.** "47 items" was a second rendering of the
  strip's own first cell, sitting where you cannot click it.
- **The filtration row is otherwise untouched** — search, Member, Kind, Tag, Priority, and
  Create at the right on the three faces that have no rail. It just lost the face buttons
  that were crowding its left edge.

Attendance and Reports keep their button groups: two and three faces fit, and a dropdown for
two options is a click to read one word.

**Verified**
`npx tsc -b` clean · eslint 0 errors · `npx vite build` succeeds · both check suites pass.

---

### The proto banner comes off, and the rail stops drawing a second calendar

**Area:** sidebar → Team → **Calendar** (`#/work`) · **Attendance** · **Reports**
**Files:** `src/admin/views/Team/Work.tsx`, `Attendance.tsx`, `Reports.tsx`, `bits.tsx`, `team.css`

**What changed**

- **The amber banner is gone from all three faces.** It said the same sentence on every
  screen on every load, and a warning nobody can act on is one people stop reading — which
  costs the warnings that do matter (a day left unclosed, a leave request waiting, an
  agreement nobody opened). `ProtoBar` is deleted from this module rather than hidden. The
  fact it carried is not lost: `store.ts` states it at the top of the only file that knows
  where these records come from, and BACKEND-INTEGRATION.md lists the endpoints owed.
  *(Finance, Users and Business Enquiries keep their own banners — not this module's call.)*
- **The mini month leaves the rail.** It sat a second month grid immediately beside the
  first, answering the same question at two sizes. The big grid is already the date picker —
  a click on a day starts something there — and `‹ ›` on the bar is already the month step.
  The rail is now Create, pinned, over this month's counts, tasks, milestones and targets.

**Verified**
`npx tsc -b` clean · eslint 0 errors · `npx vite build` succeeds · both check suites pass.

---

### The calendar is a one-pager, and the filter row stops nesting itself

**Area:** sidebar → Team → **Calendar** (`#/work`) · **Attendance** · **Reports**
**Files:** `src/admin/views/Team/Work.tsx`, `Attendance.tsx`, `Reports.tsx`, `team.css`

**What changed**

- **The filter row was a toolbar inside a toolbar.** `.dls-cmd` is already the flex row every
  list screen in this panel uses; the three Team faces wrapped their controls in a second
  `.toolbar` inside it — a nested flex context with its own bottom margin, which is what
  pushed Create onto a line of its own and stopped the search field growing. The wrapper is
  gone from all three; the controls are children of the band, the way the Members list has
  always done it, and a spacer pushes Create to the right edge.
- **The chip band no longer costs 12px when it is empty.** It renders only when a filter is
  actually set — on a face bounded to the viewport, dead padding is the whole budget.
- **The calendar is one page and does not scroll.** `.dls` was already bounded to the
  viewport; on this face the body stops scrolling and hands its height down. The month grid
  gets six rows that stretch on a tall screen and hold a 128px floor on a short one — where
  the GRID scrolls, not the page — and the weekday heads stay put while it does.
- **The sidebar adjusts with it.** Create and the mini month pin at the top; the month
  counts, tasks, milestones and targets scroll under them. They are the two controls
  somebody reaches for at any scroll position.
- The footnote is one line instead of two.

**Verified**
`npx tsc -b` clean · eslint 0 errors · `npx vite build` succeeds · both check suites pass.

---

### The calendar takes Google Calendar's layout, and the month says its own name

**Area:** sidebar → Team → **Calendar** (`#/work`, the calendar face)
**Files:** `src/admin/views/Team/Work.tsx`, `store.ts`, `team.css`, `scripts/check-team-derivation.cjs`

**What changed**

- **The month heading said `ep 2026`.** It was being cut out of a full date with
  `fmtDate(...).slice(3)` — three characters into "1 Sep 2026". There is a `fmtMonth()` now,
  built from the month name, and the suite asserts both forms and both year edges.
- **Stepping a month walked the date back a day, every press.** `toISOString()` on a local
  midnight is +05:30 behind, so September went to 3 October, then 2 November. `monthStep()`
  does field arithmetic and lands on the first. Twelve steps forward and twelve back now
  return to where they started — asserted.
- **Create opens the sidebar,** full width, as a pill with its three kinds under it. It
  leaves the toolbar on the calendar face and stays in the toolbar on board, list and
  timeline, which have no rail (TM-AD-25).
- **The mini month names itself** — "September 2026" with its own ‹ › — and marks three
  states apart: today filled, the day being viewed tinted, a day with work dotted.
- **Today is the number, not the square.** The whole cell was washed in warning amber, which
  in this panel means something is wrong. It is a filled brand circle on the date now.
- **The grid is Google's:** equal cells, hairlines, weekday heads centred over them, the day
  number centred at the top, out-of-month days on the shell ground.
- **Clicking the empty part of a day starts something on it,** with the date already filled
  in; the chips inside still open their own item, because the test is the cell being the
  click target. `+N more` opens that day in week view instead of being dead text.
- The date bar reads Today ‹ › then the month at 22px, with Month/Week moved to the right on
  the theme's own `.btn-group`.

**Verified**
`npm run check:team` all green, five assertions added for the heading and the month step.
`npx tsc -b` clean · eslint 0 errors · `npx vite build` succeeds.

---

### The module attaches to the Team table, and it navigates

**Area:** sidebar → Team → **Members** (`#/team`, now the one front door) · **Calendar** (`#/work`) ·
**Attendance** (`#/attendance`) · **Reports** (`#/reports`)
**Files:** `src/admin/views/Team/MemberPage.tsx` *(new)*, `memberTabs.tsx` *(new, from MemberDash.tsx)*,
`adopt.ts` *(new)*, `index.tsx`, `Work.tsx`, `Attendance.tsx`, `Reports.tsx`, `store.ts`, `workBits.tsx`,
`bits.tsx`, `team.css`, `shell/modules.ts`, `auth/session.ts`, `views/registry.tsx`,
`src/content/team/links.json` *(new)*, `tags.json`, `vocabularies.json`, both check scripts.
**Deleted:** `MemberDrawer.tsx`, `MemberDash.tsx`, the `me` sidebar row, `#/me`.

**Why**

Two structural faults, both fatal to "click around and see it work". First, the panel is a
**BrowserRouter on real paths** — every `window.location.hash =` write and raw `<a href="#/…">`
in the Team faces changed only the URL fragment and navigated **nowhere**: Open dashboard,
face switches, item links — dead. Second, the member dashboard was its own sidebar row with a
second roster, keyed to eight seeded ids no live roster has, so the Team table — the place a
founder actually clicks — opened a drawer that led to an empty page.

**What changed**

- **The Team table is the one front door.** A row on `#/team` opens `#/team/:id` — a full
  page: Overview (tiles, employment record, profile, roles, **effective access**) ·
  Attendance (with leave) · Work (blocks + **tag manager**) · Reports · Documents · Pay. The
  drawer's identity sections and its four admin actions (Edit / Roles / Send password /
  Delete) moved into the page header; the "My dashboard" row, its duplicate roster and the
  `me` module key are gone — `modules.ts`, `PROTO_MODULES` and the registry all dropped it.
- **The seed wears your live roster.** `adoptRoster()` re-keys the eight seeded members onto
  the real users from `GET /admin/users/`: the signed-in admin takes the senior slot (the
  leave inbox, the sent agreements, the EODs to read), the rest fill in priority order,
  unfilled slots drop with their identity-bound rows, and their work reassigns so the board
  stays rich. Every face triggers it once per load; a failed fetch leaves the seed walkable.
- **The demo clock rolls forward, whole weeks at a time,** in the browser only — "today" is
  the most recent seed-weekday, every weekday stays what it was, and Node keeps the authored
  frame so the check suite still pins real dates.
- **Every link navigates.** All Team-face navigation goes through the router (`go()`); not
  one `window.location.hash =` or bare `#/…` anchor is left in the module.
- **The last wireframe gaps are built:** the item drawer's **Linked items** (relates to /
  duplicates / follows — soft edges that may not restate the parent or the waiting-on link),
  the **tag manager** (rename, archive, restore, tone from the tag palette, soft cap of 20),
  Reports' **Waiting on you** (leave to decide, EODs to read, agreements never opened) and
  **Progress** blocks with the timeline button and an on-leave count, and the `wait` filter
  the roll-up was already linking to.
- **CSS aligned to the theme:** faces ride `.btn-group`, the Create menu is the shell's
  `.ib-menu`, tags are `.pill.tag-<hue>` from the tag palette (never a status tone), the
  proto note takes the panel's dashed-card geometry, board breakpoints are container
  queries, the timeline bar no longer overrides the attendance day bar, the literal shadow
  and z-index are tokens, and `.fg2`/`.fg-check`/`.help-i` stopped leaking unprefixed.

**Temp data**
`links.json` (4 edges, all three relations). `tags.json` tones remapped to tag-palette hues.
`vocabularies.json` gains `linkRelations` (with inverse labels) and `tagTones`.

**Backend needed**
`GET/POST/DELETE /admin/team/work-links` · everything previously listed. Adoption retires the
day `GET /admin/team/members` exists: the store then reads real members and `adopt.ts` comes out.

**Verified**
`npm run check:team` all green, extended with four sections: the Node clock never shifts;
links restate nothing (both directions) and dedupe to the existing edge; rename/restore/tone
and the cap that warns; the wait filter returns exactly the blocked item; adoption with three
people re-keys every collection, repoints dropped deciders to the signed-in user, drops
nothing dangling, and reset restores the eight. `check-team-nav.cjs` asserts five Team rows
and no `me` anywhere. `npx tsc -b` clean · eslint 0 errors (1 pre-existing warning) ·
`npx vite build` succeeds.

---

### The rest of the module, wired to content: leave, documents, pay, and Create that creates

**Area:** sidebar → Team → **Calendar** (`#/work`) · **Attendance** (`#/attendance`) · **My dashboard** (`#/me/:id`)
**Files:** `src/content/team/agreements.json` *(new)*, `resources.json` *(new)*, `pay.json` *(new)*,
`leave.json`, `vocabularies.json`, `src/admin/views/Team/store.ts`, `Work.tsx`, `MemberDash.tsx`,
`Attendance.tsx`, `team.css`, `scripts/check-team-derivation.cjs`

**What changed**

`src/content/team/*.json` is the API until there is one. Everything that was still a
placeholder now runs against it, so the module can be walked end to end before a single
endpoint exists.

- **Create creates.** The `+ Create` menu opens one form with the kind switchable at the
  top — title, assignee, priority, start, due, parent, and `targetValue`/`targetUnit` when
  the kind is target. It refuses what the model refuses: a target with a parent, a task as
  a parent, an empty title. New items land in **Planning**, and nothing can set Delay.
- **Leave is decided, and it suppresses the absence it would have derived.** A senior sees
  a **leave inbox** at the top of `#/attendance` — only when something is in it — with
  Approve and Refuse, and refusing needs a sentence. Approving writes **no attendance
  row**: `stateOf` reads the approved row at the point it would have said Absent and says
  **On leave** instead. N. Pillai has no attendance record for 24 August and that day now
  reads On leave, while today — no row, no leave — still reads Not started.
- **Documents, two buckets in one tab.** Agreements travel company → member, are frozen at
  send with a 7-day link, and can be revoked until they are signed; signing stores the
  typed name, the time and the address, and a signed agreement can no longer be revoked.
  Resources travel member → company: the member may delete their own, an admin may verify,
  and the **missing list is derived from the vocabulary** rather than a constant.
- **Pay is a read of Finance.** Annual CTC, the last payslip, and incentives by state, with
  every action linking into Finance. Nothing on this tab writes.
- **Six tabs, and two of them are private.** Overview · Attendance · Work · Reports ·
  Documents · Pay. Leave folded into Attendance rather than becoming a seventh. **A senior
  does not see Documents or Pay** — a reporting line does not imply access to somebody's
  PAN card or their salary.
- The Work tab also lists that member's own tags with a count each.

**Temp data**
`agreements.json` (6), `resources.json` (9), `pay.json` (8) — all new placeholder records.
`leave.json` gains LV-07, the row that makes the suppression visible. `vocabularies.json`
gains `on_leave` with `stored:false`, `agreementKinds`, `agreementStates` and
`resourceKinds` carrying `required:true` — static copy, all of it.

**Backend needed**
- `GET /admin/team/agreements`, `POST /admin/team/agreements` (send, freezes a version),
  `POST /admin/team/agreements/{id}/revoke`, and a **public** `POST /agreements/{token}/sign`
  — hashed token, single-use, expiring, rate-limited per token and per IP.
- `GET /admin/team/resources`, `POST` (multipart), `DELETE`, `POST /{id}/verify`. **Every
  object private with signed reads.** The public `fileUrl` the rest of the panel uses would
  put a PAN card on a guessable URL.
- `GET /admin/finance/salary-accounts?member=` and `/incentives?member=` — Finance's, read
  only. Team never writes pay.
- `none` new for leave: `POST /admin/team/leave` and `/decide` were already on the list.

**Open decisions**
`TM-R-11` (private-object storage) is now the **only** thing standing between this and the
real endpoints for Documents — the screens are drawn and the writes are simulated, and
nothing here assumes a public URL. `TM-R-10` is answered in code: the `absent` derivation
gained exactly one clause, in `stateOf`, and the check suite asserts both sides of it.

**Verified**

`npm run check:team` — **116 assertions, all passed**, extended with four new sections:
approved leave suppressing an absence while writing no attendance row and *not* changing a
member with no leave; the required-document list coming from the vocabulary; send → sign →
cannot-revoke, and delete; pay totals per incentive state; and Create refusing a target
with a parent, a task as a parent and an empty title while adding exactly one item.
`node scripts/check-team-nav.cjs` passed. `npx tsc -b` clean · `npx eslint src/admin/views/Team`
→ 0 errors, 1 pre-existing warning · `npx vite build --mode dev` succeeds.

**Not opened in a browser** — still no backend against this checkout. The walk, once
`me/permissions/` resolves: `#/work` → Create → the item opens in its drawer → tag it →
`#/attendance` as a senior → approve a leave request → `#/me/86` → Documents → sign the
NDA → Pay.

---

### Team workspace, built: Calendar with four faces, the member dashboard, and demo data for every case

**Area:** sidebar → Team → **Calendar** (`#/work`, was Work) · **My dashboard** (`#/me`, `#/me/:id`) · the Reports roll-up
**Files:** `src/content/team/work.json`, `tags.json` *(new)*, `leave.json` *(new)*, `vocabularies.json`,
`src/admin/views/Team/store.ts`, `Work.tsx`, `workBits.tsx` *(new)*, `MemberDash.tsx` *(new)*,
`MemberDrawer.tsx`, `Reports.tsx`, `team.css`, `src/admin/shell/modules.ts`,
`src/admin/views/registry.tsx`, `src/admin/auth/session.ts`,
`scripts/check-team-derivation.cjs`, `scripts/check-team-nav.cjs`, `package.json`

**What changed**

The wireframe is code. Everything §3.2–§3.4 and §3.13 argued now runs in the panel against
the seed, and the two check suites assert the rules rather than the prose.

**The Team row reads Calendar and `/work` opens on the calendar face.** Label and default
only — the route, the `WorkItem` entity and the `team.work.*` grant do not move, so every
existing link and `?item=` drawer URL keeps working. Four faces on one route:

- **Calendar** — month and week, Monday-first, with a **left rail** that is this face's
  alone: Create (one control, three kinds), a mini month that moves the grid, the month's
  own counts, then **Tasks ▸ Milestones ▸ Targets**. Approved leave draws as a band.
- **Board** — five stage columns with a **Group by** axis: stage · kind · assignee ·
  priority · tag. The last column is never hidden.
- **List** — the same rows as a table, now carrying stage, tags and the waiting flag.
- **Timeline** — `target ▸ milestone` lanes with each lane's own window dashed and its
  tasks solid, plus a *No milestone* lane. Lanes are the work, never the worker.

**Five stages, the same five for everybody** — Planning · In progress · Delay · Complete ·
Cancel. Four are stored; **Delay is derived** (`dueDate < today` on a non-terminal item)
and takes precedence in the grouping, so an item is in exactly one column and the strip
counts stages rather than stored statuses — **twenty-three items store `in_progress` and
the column shows eighteen**, because five of them are late (the other two cards in Delay
store `planned`). **Blocked is no longer a stage**:
it moved to `blockedByItemId` with a reason, the card draws a waiting flag, and a finished
blocker stops blocking without anybody clearing the field.

**Tags are member-owned records.** Two members both hold `call` as two rows and neither
can rename the other's; cross-member views group by **slug**. A tag is born in the
drawer's picker and nowhere else, and archived rather than deleted.

**`#/me` is the member dashboard.** No id opens **the team as a table — a row opens that
member's day**. With an id: Overview, Attendance, Work, Reports and Leave, and the Work
tab renders the *same three blocks* as the calendar rail and the roll-up, from
`workBits.tsx`. Leave can be requested, approved and refused; approving suppresses a
derived absence and writes no attendance row. The `#/team` drawer stays the identity
record and gains **Open dashboard** — shown only when the operational seed knows that id,
so it degrades to nothing rather than offering a 404.

**Demo data for every case** — 47 work items across all eight members, 19 tags, 6 leave
rows. It covers: a target nearly done and one behind pace; a milestone at 100% from its
children, one at 0% with two thirds of its window gone, one past its date, one with no
`startDate` at all; tasks overdue, due today, next-three-days, completed, cancelled,
undated and multi-day; one item waiting on another; and a quarter-long target that proves
the calendar's span rule by drawing twice instead of on ninety-two days.

**Temp data**
`src/content/team/work.json` (47 placeholder records, `tagIds[]` added, the one `blocked`
row now In progress with `blockedByItemId`), `tags.json` and `leave.json` (both new
placeholder records), `vocabularies.json` (STATIC COPY — `workStatuses` is now four stored
values plus `delayed` with `stored:false`, `workTransitions` lost the blocked rows, and
`tagSuggestions` / `leaveKinds` / `leaveStates` are new).

**Backend needed**
- `GET /api/v1/admin/team/work` → **`status` returns four values** — `planned ·
  in_progress · completed · cancelled`. A payload carrying `blocked` is against an older
  vocabulary, and **`progressPct` or any `delayed` flag must not appear at all**: both are
  derived at read.
- `GET /api/v1/admin/team/tags` → replaces `tags.json`. Identity is `(ownerId, slug)`.
- `POST /admin/team/tags`, `POST /admin/team/work/{id}/tags` → create and attach.
- `PATCH /admin/team/work/{id}` → `blockedByItemId` + `blockedReason`, together.
- `GET /api/v1/admin/team/leave?from&to`, `POST /admin/team/leave`,
  `POST /admin/team/leave/{id}/decide` → replaces `leave.json`.
- `none` for the faces themselves: calendar, board, list and timeline are four readings of
  the same list, and a face-specific endpoint would be four places to fix one bug.

**Open decisions**
`TM-AD-23` … `TM-AD-31` are all built as drawn. Two are worth restating because they are
now enforced by code rather than by prose: **`TM-OD-11`** — no score is computed anywhere,
a milestone bar counts children and the window marker counts days; and **`TM-AD-25`** —
the rail is the calendar's alone, so the board and the timeline keep their width.
`TM-OD-20` (what "my JD team" means) remains the only blocker on Phase A, and nothing here
assumes an answer: scope stays `reportsTo`, one level.

**Not built here, and deliberately:** Agreements, Resources and Pay (§3.9–§3.11) wait on
the private-object storage decision, `TM-R-11`; leave does **not** yet change the `absent`
derivation in `store.ts` (`TM-R-10`, the module's highest-risk edit) — an approved row is
read by the calendar and the dashboard, and `onLeave()` is in place for the day that
clause lands.

**Verified**

`npm run check:team` — **all checks passed**, including six new sections asserting the new
rules: five stages with one `stored:false` and the columns adding to the total; the strip
counting stages, not stored statuses; a quarter-long target drawing on its start and due
days and on no day between, while a week-long task spans; timeline lanes that are never a
member and a last lane that is never hidden; two members holding `call` as separate rows,
create-dedupes, tag on/off, slug grouping; approved leave covering only its own dates,
refusal needing a sentence, a decision being final, and **no attendance row written**.
`node scripts/check-team-nav.cjs` — all checks passed, extended to assert the Team group's
six rows and that the `work` row reads **Calendar** while its key stays `work`.
`npx tsc -b` clean · `npx eslint src/admin/views/Team src/admin/shell/modules.ts
src/admin/views/registry.tsx` → 0 errors, 1 pre-existing warning in `index.tsx` ·
`npx vite build --mode dev` succeeds. The seed was read back through the shipped
selectors: 47 items across 8 members, 7 in delay, 1 waiting, 13 timeline lanes, 25 of 42
grid days carrying something.

**Not opened in a browser.** No screen here has been seen: the rail beside the month grid,
the five columns at 1280px, the timeline bars, the drawer's tag picker, and the dark-theme
pass are all reasoned about and typed, not viewed. `me/permissions/` has to resolve before
the panel renders any module and there is no backend against this checkout. The first
thing to walk against a live session: `#/work` → switch all four faces → open an item →
tag it → `#/me` → a member → their Work tab.

---

### §P — the panel, clickable: real sidebar, routed faces, drawer over the face — TM-AD-31

**Area:** `src/proto/v-2.2.0.0/wireframe-team-workspace-v2.html` → §P · simulates `#/work`, `#/reports`, `#/team`, `#/team/me`
**Files:** `src/proto/v-2.2.0.0/wireframe-team-workspace-v2.html`,
`src/proto/v-2.2.0.0/OPERATION-2026-09-03-team-workspace-v2.md`

**What changed**

The document gains a **working panel**. Thirteen wireframes argue the decisions; §P lets
them be walked, so the module can be seen as it would be used rather than read.

- **The sidebar is the real one.** Group order and row order come from
  `admin/shell/modules.ts` — Sales · Client Ops · Business Ops · **Team** · Finance ·
  Settings — with `Work` reading **Calendar** per `TM-AD-23`, and `My dashboard` added as
  the sixth Team row. The six modules outside Team are dimmed and open a note instead of a
  fabricated screen; Attendance says what §3.7 and §3.8 add to it and links there.
- **The faces are tabs in the content area**, and the sidebar proves `TM-AD-12` by showing
  the open face as a **sub-label** under Calendar rather than as four rows. A status line
  is not a second place to click.
- **Routes are real and printed**: `#/work?face=board`, `#/work?face=board&group=tag`,
  `#/team/me?tab=work`, `#/work?face=calendar&item=W-K08`. Clicking a row, a tab, a mini
  month day, *Group by*, the month and week pages and the timeline's window all move the
  URL and the view together.
- **An item opens as a right-side drawer over the face**, which keeps its place behind a
  dimmed backdrop — `?item=` appended to whatever route is open, as §3.5 spec'd and as the
  shipped panel already does elsewhere. Escape, ✕ and the backdrop close it and drop the
  parameter. The drawer carries kind, assignee, **both stages** — *Delay · derived · 7d
  past 27 Aug · stored stage is In progress* — priority, tags, parent, dates, the
  ⛔ blocker **with its reason**, derived progress with the ▾ window marker, the children,
  the links, and the five actions. Every related record in it is itself a click.
- **Signed in as** switches the viewer, so the rail, the day's tasks, *Mine · My team* and
  `/team/me` all re-scope to whoever is looking.

**`TM-AD-31` is what keeps it honest.** Every renderer was split into a **builder** that
returns HTML and a **writer** that puts it somewhere — `calHtml` / `renderCal`,
`boardHtml` / `renderBoard`, `tlHtml` / `renderTl`, `railHtml` / `renderWorkRail` — so §P
places the *same output* the spec screens place. **No face is re-implemented for the
demo**: if §P showed something §3.2 does not, one of them would be lying, and the only way
to make that impossible is for it to be the same function. §P is a router, a sidebar and a
drawer; nothing else.

Clicks inside §P never leave it: the shared builders emit `data-goto="5"` because on a
spec screen a card jumps to §3.5, and inside the panel that has to mean *open the drawer*.
A capture-phase handler translates it, and the deliberate "open §3.7 ▸" buttons are let
through. **What is drawn rather than wired says so on the screen** — the filters, search,
the Create form, and the six other modules.

**Temp data**
`none` — no runtime code and no seed change. §P reads the same inline `ITEMS`, `MEMBERS`,
`LEAVE`, `TAGS`, `LINKS` and `BLOCKED` as every screen above it. The nav list is a
hand-copy of `admin/shell/modules.ts` group and row order, which is the one thing here
that can go stale — it is a wireframe of the nav, not a read of it.

**Backend needed**
`none` new. §P consumes exactly what §3.2–§3.4 already require of
`GET /api/v1/admin/team/work`. It does make one client requirement concrete: the face and
the open item must both live in the **URL** (`?face=`, `?item=`), because that is what
makes a drawer shareable and the back button correct.

**Open decisions**
`TM-AD-31` is new and is shown on §P. Nothing is open. `TM-AD-12` is reaffirmed rather
than amended — the faces stayed tabs. `TM-OD-20` remains the only blocker on Phase A.

**Verified**

Evaluated headlessly against a DOM stub, driving `APP` through every route and face and
reading the output back. Sidebar renders all six groups in `modules.ts` order with Calendar
in Team and the face sub-label under it. Board face draws the five stage columns and the
Group-by select; List draws all 22 rows with stage, priority, due and tags; Timeline draws
its seven lanes and the undated list; Reports draws Today, *Waiting on you* and the three
blocks at `reportsTo` scope; Members draws the eight-row roster; Attendance draws its note
and its link to §3.7. Drawer checked on two records — `W-K08` (task: Delay derived over a
stored In progress, ⛔ waiting on the Q3 review with its reason, parent *Onboard 12
businesses in Pune*) and `W-M03` (milestone: 50%, *2 / 4 tasks · 91% of the window gone*,
four children each opening their own drawer). `appUrl()` returns
`#/work?face=calendar&item=W-K08`. `node --check` passes, tag balance checked with a
parser, `npx tsc -b` clean, `npx vite build --mode dev` succeeds — no `.ts` was touched.

**Not opened in a browser.** The drawer's slide-in and sticky action bar, the dark sidebar
against the light content, the backdrop over a scrolled board, Escape-to-close, and the
whole panel below 1240px are reasoned about and not seen. Open §P and click the board
first: five columns beside a 206px sidebar is the tightest case in the document.

---

### Tasks ▸ milestones ▸ targets — one set of components, three surfaces — TM-AD-30

**Area:** `#/work?face=calendar` rail · `#/reports` captain roll-up (§3.12) · `#/team/me` Work section (§3.13)
**Files:** `src/proto/v-2.2.0.0/wireframe-team-workspace-v2.html`,
`src/proto/v-2.2.0.0/OPERATION-2026-09-03-team-workspace-v2.md`

**What changed**

**The rail is reordered to Tasks ▸ Milestones ▸ Targets** — the order somebody works
in, smallest thing first: the thing you do today, the thing your tasks add up to, the
number the quarter is judged on. Reading down you zoom out, and the block you can act on
is the one you reach first. *Progress* is gone as a heading; the milestones and the
targets it used to mix are now two blocks that do not look alike.

**A target is no longer drawn like a milestone**, because they are not the same thing.

- **A milestone is a window with children under it.** Its bar is `completed ÷ total`, and
  it now carries a **▾ marker at the elapsed share of `startDate → dueDate`**. Marker
  ahead of the fill means behind schedule, said in two honest numbers and no score —
  `TM-OD-11` holds. *Close Sharma Interiors* is the case that earns it: **50% done, 91%
  of its window gone, due in two days.** Neither number alone says that.
- **A target is a count of units**, so the number leads — **15** *of 40 deals* — over a
  value bar in the brand tone behind a left rule, with the window as one line of text
  rather than a marker. Nobody asks whether a deal count is on schedule; they ask how
  many are left.

**The same components now render all three surfaces** — `pbTasks`,
`pbMarks('milestone')`, `pbMarks('target')` and the derivations under them:

- **§3.3 rail** — self scope.
- **§3.12 captain roll-up** — the static Progress block is **replaced by the same three
  blocks**, passed `reportsTo` one level instead of self. It reads five overdue tasks
  across two reports, one milestone of his and one of N. Pillai's, and one target.
- **§3.13 member dashboard** — *Milestones and targets* becomes a **Work** section with
  the same three blocks in the same order. The *Handover* tile stops printing a typed
  33% and now derives *0% · 0 / 2 tasks done · 67% of the window gone*.

Scope is the only argument that differs. Three surfaces each computing progress their own
way is exactly how §3.12 came to be printing two typed percentages its own children
disagreed with (`TM-AD-27`); one component cannot drift from itself.

**Temp data**
`none` — no runtime code. No seed change: `timePct` reads `startDate` and `dueDate`,
which `work.json` already carries on every milestone and target. One dead local
(`marks` in `renderMe`) was removed with the block it fed.

**Backend needed**
`none` new. The ▾ marker is `(today − startDate) ÷ (dueDate − startDate)`, computed at
read like everything else on these blocks. **A milestone with no `startDate` draws no
marker** rather than assuming one — the same rule §3.4 applies to bars it cannot place.

**Open decisions**
`TM-AD-30` is new and is shown on §3.3, §3.12 and §3.13. Nothing is open. `TM-OD-11` is
unchanged: a milestone bar counts its children and the ▾ marker counts days, and neither
reduces a person to a figure. `TM-OD-20` remains the only blocker on Phase A.

**Verified**

Rendered headlessly against a DOM stub and read back on all three surfaces.
**Rail** (viewer A. Sharma): Tasks — *Due today · 1*, Q3 pipeline review; Milestones —
*My team · 2*, Close Sharma Interiors 50% with *91% of the window gone*, Onboard 12 in
Pune 0% with 67%; Targets — *Mine · 1*, 15 of 40 deals, 38%, 70% of the window gone.
**§3.12** (D. Kapoor, one level of reports): Tasks — *Overdue · 5* across Meera and
N. Pillai plus *Next 3 days · 1*; Milestones — his *Enquiry response* 0% at 55% elapsed
and N. Pillai's handover 0% at 67%; Targets — Onboard 60 businesses, 47 of 60, 78%.
**§3.13** (N. Pillai): Tasks *Overdue · 2*, Milestones *Mine · 1* at 0% / 67% elapsed,
Targets *None assigned*, and the Handover tile derived. Every one of those was checked
against `work.json` by hand. `node --check` passes, tag balance checked with a parser,
`npx tsc -b` clean, `npx vite build --mode dev` succeeds — no `.ts` was touched.

**Not opened in a browser.** The ▾ marker's triangle sitting over a 5px bar, the target
block's left rule and brand tone in dark theme, and §3.12's and §3.13's three columns
wrapping below 700px are reasoned about and not seen.

---

### Five stages for everybody, and the rail is the calendar's alone — TM-AD-29, and TM-AD-25 amended

**Area:** sidebar → Team → Calendar · `#/work` — the Stage axis on `?face=board`, the rail on `?face=calendar`
**Files:** `src/proto/v-2.2.0.0/wireframe-team-workspace-v2.html`,
`src/proto/v-2.2.0.0/OPERATION-2026-09-03-team-workspace-v2.md`

**What changed**

Two directions from the founder, and the first **supersedes the entry below it**:
the rail was drawn on all four faces this morning and is now the calendar's only.

**The rail leaves the board and the timeline** (`TM-AD-25`, amended). Both get their
full width back. The board is a horizontally scrolling grid of five columns and the
timeline is a date grid behind a 210px lane column — the rail was taking 238px from the
two faces that could least afford it, and on both the same information is already on
screen in a better shape: the board's *Delay* and *Complete* columns count themselves,
and every timeline lane states *n of m tasks done*. **Create travels with them**
(`TM-AD-26`, amended): the same control and the same menu now sit in the board's and the
timeline's toolbars, and at the top of the rail on the calendar. One control, one form,
three kinds, on every face. What this costs is stated on the screen rather than
discovered: switch to the board and the progress bars are not in front of you — the
calendar is what `/work` opens on, and §3.12 and §3.13 carry the same derivations.
**`TM-R-15` is closed by this**, the day it was raised.

**Five stages, the same five for everyone** (`TM-AD-29`) — *Planning · In progress ·
Delay · Complete · Cancel*. Two consequences, both drawn:

- **`Blocked` leaves the stages.** It was never the same kind of thing as the other
  four: *late* is a date, *waiting on someone* is a relationship, and only one of those
  answers "where is this work". It becomes `blockedByItemId` **with a reason** — the
  strong link `TM-AD-16` already refuses to let the weak link list create — and the card
  draws ⛔ wherever it appears. The seed's one blocked row shows what the stage was
  hiding: `Pune tier pricing sign-off` said *blocked* and recorded **nothing about what
  was blocking it**. It is now In progress, waiting on `Q3 pipeline review with the
  founders`, and it shows in Delay because it is seven days over. The drawer's
  *Block…* button is now *Waiting on…*, and it writes a field rather than a stage.
- **`Delay` is the fifth and it is computed** — `dueDate < today AND stage not terminal`,
  at read, against `asOf`. Stored, it would need a nightly sweep this backend has no
  queue for, and it would let a card read *In progress* three weeks past its date because
  nobody moved it. Derived, it is identical for every member with nobody maintaining it,
  which is what *"the same for all"* has to mean to survive a year. It **takes precedence
  in the grouping**, so every item is in exactly one column; four columns accept a drop
  and **Delay accepts none**, because there is nothing to write. Column order is
  lifecycle — Delay sits before the two terminal columns, not after Complete where the
  founder's list had it.

**Tags are unchanged and that asymmetry is now written down.** A member invents tags
freely (`TM-AD-14`) because a tag is one person's way of finding their own work. A stage
is how the company reads everybody's work at once, so it stays vocabulary: five values in
`vocabularies.json`, one carrying `stored: false` — the same shape `on_leave` already
uses.

**The strip now counts stages, not stored statuses.** Eleven items store `in_progress`;
the strip says five and so does the column, because the other six are late and Delay is
where they are. A summary that counted the stored field would disagree with the columns
underneath it by six.

**Temp data**
`none` — no runtime code. The wireframe seed lost its one `'blocked'` row (now
`'in_progress'`) and gained a `BLOCKED` map standing in for `blockedByItemId` plus its
reason. Fifteen task rows also had a stale trailing progress number left behind by the
earlier `TM-AD-27` edit; removed. `src/content/team/work.json` is untouched.

**Backend needed**
`none` new, but two shapes are now fixed for `GET /api/v1/admin/team/work`:
**`status` returns four values**, `planned · in_progress · completed · cancelled` — a
payload containing `blocked` is a payload against an older vocabulary — and
**`progressPct` and any `delayed` flag must not appear at all**. Both are derived at
read. `vocabularies.json` gains `workStages[]` with `delayed` marked `stored: false`.

**Open decisions**
`TM-AD-29` is new, is the founder's rule taken, and is shown on §3.2. `TM-AD-25` and
`TM-AD-26` are **amended in place and say so on the screen**, so the earlier drawing —
a rail on four faces — is not read back as current. `TM-R-15` moves to closed.
`TM-OD-11` is unchanged. `TM-OD-20` remains the only blocker on Phase A.
One thing was decided rather than asked: **column order is lifecycle, not the order the
five stages were listed in.** Delay is unfinished work, so it sits between In progress
and Complete. Say the word and it moves to fourth.

**Verified**

Rendered headlessly against a DOM stub and read back: the Stage axis draws
**Planning 3 · In progress 5 · Delay 10 · Complete 3 · Cancel 1 · Ungrouped 0**, which
adds to 22, and the strip agrees with it column for column — *22 items · 5 in progress ·
3 planning · 10 in delay · 1 waiting on another item · 3 done*. The ⛔ marker renders on
the one waiting card. The rail renders on `wfWr3` alone (6,365 bytes) with `wfWr2` and
`wfWr4` gone, and the Create control renders into the board's and the timeline's
toolbars (282 bytes each). `node --check` passes, tag balance checked with a parser,
`npx tsc -b` clean, `npx vite build --mode dev` succeeds — no `.ts` was touched.

**Not opened in a browser.** The five columns at 1280px without the rail, the ⛔ marker's
second line on a card, the Create menu's absolute positioning inside a toolbar, and the
dark-theme pass are reasoned about and not seen.

---

### The work rail — Create, progress by milestone, and today — TM-AD-25 … 28

**Area:** sidebar → Team → Calendar · `#/work`, every face — `?face=calendar` · `board` · `list` · `timeline`
**Files:** `src/proto/v-2.2.0.0/wireframe-team-workspace-v2.html`,
`src/proto/v-2.2.0.0/OPERATION-2026-09-03-team-workspace-v2.md`

**What changed**

`/work` gains the left rail from the founder's Google Calendar reference, and it is
**shell rather than a calendar sidebar** (`TM-AD-25`): all four faces carry it, so
progress does not vanish when somebody switches to the board. Five blocks, five
queries, one function — it is rendered into §3.2, §3.3 and §3.4 from the same call so
the wireframe argues the decision instead of asserting it.

- **`+ Create ▾` — Task · Milestone · Target** (`TM-AD-26`). All three open the *same*
  form with `kind` prefilled, because they are one `WorkItem` with a `kind`; a target
  adds two fields to it. `+ New item` is removed from every face toolbar in exchange:
  one entry point, always in the same place.
- **Mini month** — click any day and the month grid follows it; a dot marks a day that
  carries something. A **Today** button joins the calendar toolbar.
- **This month** — done · open · delayed · blocked for the month in view, as a stacked
  bar. The analytics indicator the founder asked for, at the size it deserves.
- **Progress** — one bar per milestone and target, in two sections: *Mine*, then
  *My team* (`reportsTo`, one level). A member with no reports never sees the second
  heading. There is no bar per person — that is the score `TM-OD-11` refuses to compute.
- **Today** — overdue first, then due today, then the next three days, with a quick-add
  row and **Open my work ▸** into `/team/me?tab=work` (§3.13). The rail summarises the
  day; §3.13 owns it. No new route, no third place that answers "what am I doing today".

The rail deliberately holds **no filters**: Google's lists calendars to tick, ours would
have to list members, kinds and tags, and a filter that survives a face switch is how
somebody loses half their board without noticing.

**Drawing it against the seed found two live faults, and both are fixed here.**
`TM-AD-27` — the wireframe's seed carried a typed `progressPct` on every milestone and
three of the four disagreed with their own children (60% against 0 of 4, 50% against
0 of 2, 33% against 0 of 2). §3.12's roll-up was printing two of them. The field is
gone; a milestone is `completed children ÷ total`, a target is
`currentValue ÷ targetValue`, and *Onboard 60 businesses* was reconciled from a stale
38 / 60 to `work.json`'s **47 / 60**. `TM-AD-28` — rendered the naïve way, every day of
September printed the two targets and *Enquiry response under 4 hours*, because all
three run July → 30 September, pushing the day's real tasks into *+4 more*. A task of a
week or less now draws on every day it spans; anything longer, and every milestone and
target, draws exactly twice — `▸ starts` and `▪ due`. The long ones live in the rail
with a bar, which is the right shape for a commitment with no single day.

**Temp data**
`none` — no runtime code. The rail reads the same inline `ITEMS`, `MEMBERS` and `LEAVE`
arrays as the faces. The wireframe seed lost its `progressPct` column and the two
targets gained `currentValue` / `targetValue` / `unit`, which `work.json` already
carries; `src/content/team/work.json` itself is unchanged and never stored progress.

**Backend needed**
`none` new. The rail is five reads over `GET /api/v1/admin/team/work`, already required
to return `kind`, `parentId`, `status`, `startDate`, `dueDate`, `currentValue` and
`targetValue`. **A payload that also returns `progressPct` should have the field
dropped, not trusted** — `work.json`'s own `$comment` on `W-M03` says so.

**Open decisions**
`TM-AD-25`, `TM-AD-26`, `TM-AD-27` and `TM-AD-28` are new and all four are shown on
their screens. None is open: three are the founder's direction taken, and TM-AD-27/28
are faults found by rendering. `TM-R-15` is new and is a **risk, not a decision** — the
rail costs 238px on every face and the board is the face that can least afford it; it
collapses below 1240px and the board must be checked at 1280px. `TM-OD-11` is unchanged
and is now enforced by the rail's shape. `TM-OD-20` remains the only blocker on Phase A.

**Verified**

The wireframe's script was evaluated headlessly against a DOM stub and the rendered rail
read back: mini month for September, *11 dated · 0 done · 8 open · 3 delayed · 0
blocked*, *Mine · 1* (◈ Close 40 deals, 38%, 15 / 40 deals), *My team · 2* (Rahul's
2 / 4 = 50%, Priya's 0 / 2 = 0%), and *Due today · 1* — Q3 pipeline review, which is the
one item in the seed dated 3 September. Identical HTML on all three mounts (6,475 bytes
each). The September grid was read cell by cell before and after `TM-AD-28`: eleven
populated days after, against every day of the month before. `node --check` passes and
the document's tag balance was checked with a parser. `npx tsc -b` clean and
`npx vite build --mode dev` succeeds — no `.ts` was touched.

**Not opened in a browser.** The rail's 238px against the board's columns, the collapse
at 1240px, the mini-month dot alignment and the dark-theme pass are reasoned about and
not seen. The board at 1280px is the first thing to look at (`TM-R-15`).

---

### Calendar is the module's face, and the timeline measures milestones — TM-AD-23, TM-AD-24

**Area:** sidebar → Team → **Calendar** (was Work) · `#/work` · `?face=calendar` · `?face=timeline`
**Files:** `src/proto/v-2.2.0.0/wireframe-team-workspace-v2.html`,
`src/proto/v-2.2.0.0/OPERATION-2026-09-03-team-workspace-v2.md`

**What changed**

Two directions from the founder, both taken in the wireframe and both written up
as decisions rather than left as drawings.

**The Team row now reads *Calendar*, and bare `/work` opens the calendar face**
(`TM-AD-23`). The label and the default are the *whole* change: the route stays
`/work`, the entity stays `WorkItem`, the grant stays `team.work.*`, and
`?face=board` still opens exactly the board that ships today — so no existing
link, bookmark or `?item=` drawer URL moves. Renaming the route to `/calendar`
was considered and rejected: a redirect to maintain forever, and a module key
that would then disagree with its table, grant and content file. Being the
default costs one thing that is now designed rather than discovered — **the empty
month**, which states what exists and offers the board (*22 items · 6 with no
date ▸ open the board*) instead of landing on a blank grid. **Phase C moves to
first** in §7: the row cannot promise a calendar before the calendar ships.

**§3.4 is no longer a captain timeline — its lanes are targets and milestones**
(`TM-AD-24`). One lane per `target`, its milestones indented beneath it, each
lane drawing its own committed window dashed and its child tasks solid, with a
*No milestone* lane that is never hidden. A lane per member was a productivity
chart the module cannot honestly draw: no estimate field, so a bar's length is a
date range and not an amount of work, and `TM-OD-11` forbids scoring a person
anyway. The milestone axis keeps that rule true by construction — there is no
member row left to rank. **Progress fill and approved-leave bands left with the
member lanes**; a lane's sub-line is countable instead — *n of m tasks done* and
its own due date. The assignee still rides on every bar as initials, and member
load keeps its two homes: *Group by → Assignee* on the board, and §3.13.

The axis needed no new field and no new query: it is `kind` and `parentId`, both
on the model since v1. Over the seeded 22 items it renders seven lanes and lists
six open items that have no `startDate` and therefore cannot be drawn — which is
the number this face exists to shrink.

**Temp data**
`none` — no runtime code. The timeline is rebuilt over the same inline `ITEMS`
array the board and calendar already use. `LEAVE` and the `CAPTAIN` constant are
no longer read by it — `CAPTAIN` is gone, and `reportsTo` still scopes *which*
items the face shows, it just no longer shapes the rows. `MEMBERS` is still read,
for the initials on each task bar.

**Backend needed**
`none` yet, and nothing new was implied. `GET /api/v1/admin/team/work` already has
to return `kind`, `parentId`, `startDate` and `dueDate`; the lane tree is grouped
client-side from them. The face default is a client route concern.

**Open decisions**
`TM-AD-23` and `TM-AD-24` are new and both are shown on their screens. Neither is
open — they are decisions taken on the founder's direction, recorded so the
earlier drawing (one lane per member, board as the default face) is not read back
as still current. `TM-OD-11` is unchanged and is now enforced structurally rather
than by convention. `TM-OD-20` remains the only blocker on Phase A.

**Verified**

The wireframe was re-rendered headlessly (its `<script>` evaluated against a DOM
stub) and the six lanes, their bars, sub-lines and the undated list were read back
and checked against `work.json` by hand: `Close 40 deals` → 1 milestone, its own
window only;
`Close Sharma Interiors` → 2 of 4 tasks done, one 6d over, two complete;
`Onboard 12 businesses in Pune` → 0 of 2, one blocked and 7d over;
`No milestone` → 3 tasks. `node --check` passes on the extracted script.

**Not opened in a browser.** Column widths, the dashed window bar against the
solid task bars, the indent on nested milestone lanes and the dark-theme pass have
been reasoned about and not seen. The ASCII wireframe in the operation doc was
width-checked programmatically instead (every box line 84 columns).

---

## 2026-09-03

### Member dashboard — §3.13, and the two contradictions drawing it exposed

**Area:** `#/team/me` · `#/team/:id` — the container for the Pay, Documents and Work tabs
**Files:** `src/proto/v-2.2.0.0/wireframe-team-workspace-v2.html`,
`src/proto/v-2.2.0.0/OPERATION-2026-09-03-team-workspace-v2.md`

**What changed**

The member dashboard is now a screen. **Viewing as** switches between the member,
their senior and an admin, and the tab bar, the header actions, the Access block
and the nudge rows all re-render — because "who is looking" is the entire design
question and a fixed screenshot cannot hold three answers.

**Drawing it caught two contradictions, both now named in the doc.**
`TM-AD-21` listed six tabs and **Reports was not among them**, though v1 shipped
it and the daily plan and EOD have nowhere else to live; adding it back gives
seven, past the edge that decision itself called uncomfortable. `TM-AD-22`
resolves it by taking `TM-R-14`'s own escape hatch up front — Agreements and
Resources become **two sections of one Documents tab** — so v1's five tabs
survive and exactly **one** is added. `TM-AD-18` is untouched: two entities, one
tab, and direction/permission/retention were never what a tab decides.

**A nudge inherits the scope of what it points at.** Switch to the senior and the
*Needs you* block drops from 4 rows to 2 — the unsigned NDA and the missing
documents are **absent, not greyed**, because a row reading *"1 agreement
unsigned"* announces a document the same screen just refused to show.

**The clock on this screen is read-only.** Actions stay in the topbar strip and on
`/attendance`; three *End the day* buttons over one open day is two chances for
the UI to disagree with itself mid-request.

**And the route does not exist.** Team shipped on 2026-08-30 with the member as a
drawer (`views/Team/MemberDrawer.tsx`); neither `/team/:id` nor `/team/me`
resolves. `TM-OD-15` answered *where* it lives and nothing built it — which makes
§3.13 a prerequisite for §3.6, §3.10 and §3.11 rather than a sibling.

**Temp data**
`none` — no runtime code. The tiles, the nudge rows and the leave list are all
derived from the same inline `ITEMS` / `LEAVE` arrays the other faces use.

**Backend needed**
`none` yet. Implied by the design: `GET /admin/team/members/{id}/dashboard`
resolving `me` to the session's own record, and the scope table in §3.13 is the
field-level contract it has to honour.

**Open decisions**
`TM-AD-22` **amends `TM-AD-21`** — flagged as an amendment, not a silent edit ·
`TM-OD-31` one grant spelled two ways (`people-docs.view` vs `team.resource.view`),
recommend one shared read verb and separate write verbs, reconcile before Phase G ·
`TM-OD-32` what becomes of the shipped drawer, recommend it degrades to a launcher.

**Verified**
Tag balance (15/15 `section`, 385/385 `div`, 83/83 `button`, 40/40 `tr`); the 15
`data-scr` values are contiguous 0–14; `node --check` on the extracted script.
The DOM-stub harness grew from 36 assertions to **63, all passing** — 27 of them
new and all on this screen: each scope's tab count (6 / 4 / 6), Pay and Documents
present-or-absent per scope, the senior losing exactly two nudge rows with the
absence explained on screen, the Access block hidden from the member and
read-only for the senior, *Edit profile* on the admin alone, *Submit EOD* on the
member alone, approve-versus-withdraw on leave, no *End the day* on any scope,
and the work tiles matching the seed (3 open, 2 delayed). `npx tsc -b` clean.
**Not checked:** rendered appearance in a browser — no headless one is installed.

### Team Workspace v2 — the wireframe, clickable

**Area:** design artifact for `#/work`, `#/attendance`, `#/reports`, `#/team/me` — nothing shipped
**Files:** `src/proto/v-2.2.0.0/wireframe-team-workspace-v2.html` (new)

**What changed**

[OPERATION-2026-09-03-team-workspace-v2.md](OPERATION-2026-09-03-team-workspace-v2.md) had
twelve ASCII sketches and ten architecture decisions and nothing anyone could
click. This is §3.1–3.12 as fourteen screens in one standalone file, opened
straight from disk — no build step, no server, no dependency.

**The board's Group-by axis is really wired**, over the actual 22 rows of
`content/team/work.json`. `TM-AD-15` is the decision most likely to be argued
about and a screenshot cannot settle it: switch to *Tag* and an item with two
tags visibly appears in two columns while the strip says *22 items, columns add
to 23* rather than quietly printing the bigger number. The drag note flips to a
refusal on every axis but Status. The calendar and the timeline are computed the
same way — real dates, real `reportsTo` lanes, real derived `delayed`.

**Each screen carries its own rules rather than a legend at the back.** Every
`TM-AD`, `TM-OD` and `TM-R` id sits beside the pixels it constrains, so the
approval conversation happens on the screen being approved.

**`TM-OD-20` is drawn, not resolved.** The Department filter on the roster is
dashed and labelled, because it is what the decision becomes *if* JD is a
department — and if JD is a second company it is the wrong control entirely.
Worth knowing before anyone answers: `members.json` already carries a
`department` string on all eight members, so that reading is close to free.

**Temp data**
`none` — the wireframe reads nothing at runtime. Its member and work rows are
copied inline from `src/content/team/members.json` and `work.json` so the file
stays standalone; leave, tags, links and agreements are inline placeholders for
entities that do not exist yet.

**Backend needed**
`none` — no runtime code. The endpoints this design implies are listed in the
operation doc §4.3 and stay unbuilt until the approval gate clears.

**Open decisions**
`TM-OD-20` blocking and shown on §3.1 · `TM-OD-08` `TM-OD-11` `TM-OD-21`–`TM-OD-30`
each rendered on the screen they govern · `TM-R-10`–`TM-R-14` likewise. Nothing
was assumed silently.

**Verified**
Tag balance across the file (14/14 `section`, 325/325 `div`, 70/70 `button`,
31/31 `tr`); `node --check` on the extracted script. The three computed faces
were then run against a DOM stub — **36 assertions, all passing**: every axis's
column counts equal the cards drawn, Status/Kind/Assignee/Priority each place all
22 items exactly once, Tag places 23 with 9 in Untagged, the catch-all is always
last, the month grid is 42 cells with one TODAY, a multi-day item appears on a
middle day and not only its due date, the timeline draws 3 lanes from the
`reportsTo` edge with no bar outside 0–100%, and the 5 undated items in scope are
listed instead of drawn. Two annotation numbers were wrong and the harness caught
both — *"Untagged holds 15"* (it is 9) and *"five items carry a warn rail"* (ten
are delayed, nine warn and one bad because it is also blocked). **Not checked:**
rendered appearance in a browser, and no `tsc`/`eslint` run applies — the file is
not part of the TypeScript build and nothing imports it.

### Analytics: every remaining description cut to the shortest thing that is still true

**Area:** `#/finance-analytics` · Overview and KPI
**Files:** `src/admin/views/Finance/Analytics.tsx`

**What changed**

A second pass over the text the rebuild left behind. Visible words on Overview
**759 → 634**, and most of what remains is figures and labels rather than prose.

**Chart captions are the unit and nothing else.** *₹ thousand · August 2026 ·*
*exact figures on every mark* → **₹ thousand**. *₹ lakh · hover a month for the*
*exact figure* → **₹ lakh**. *₹ · one hue, because a tag is a name and not an*
*order* → **₹**. The first two described an interaction a reader finds by
hovering; the third argued for a design decision nobody was disputing.

**KPI group lines are three or four words** — *sell more, or collect better* in
place of a full sentence. They stayed rather than going entirely because a bare
*Cost* does not say what the group is FOR, and a KPI nobody can attach to a
decision gets quoted in a meeting for its own sake.

**The at-risk footer is gone and the form carries it instead.** It said the four
amounts are never added together; the table has no total row, the rails are four
colours, and the neutral one is on the row that is not a problem — the form
already refuses the sum the sentence was asking the reader not to make. The
`desc` is now **never added together**, three words on the heading.

**Two block footers are now just their `Assumed` chip.** The bank and tax blocks
each carried a paragraph in front of the open-decision link that already says
the same thing when opened.

**Empty states are one clause**, and they are only ever on screen when there is
nothing to show. **Hover titles too**: a tag bar's title was a sentence and is
now four facts separated by middots.

**What deliberately stayed.** Everything that is on screen only while a figure
is misleading: the unpaid-run caveat beside the hero, the two KPI caveats, and
*completeness, never correctness* on the bank block — which is now the only
place that caveat lives, so it moved from the footer into the heading rather
than being cut.

**Temp data**
`none` — copy only.

**Backend needed**
`none`.

**Open decisions**
`none`.

**Verified**
`npx tsc -b` and `npx eslint` clean. `npm run check:finance` → 441 pass;
`npm run check:finance-render` renders every surface;
`npm run check:finance-nav` passes. Word count measured off the rendered page
rather than estimated.

### Review backfill: ten months of history, so the Analytics charts have something in them

**Area:** the seed — `#/finance-analytics` is where it shows
**Files:** `src/content/finance/subscriptions.json`, `src/content/finance/transactions.json`, `scripts/check-finance-ledger.cjs`, `scripts/fn-smoke.tsx`

**What changed**

**THE CHARTS HAD NOTHING TO DRAW.** The seed carried eighteen months of salary,
no revenue at all before July 2026, and no spend before August — so net-by-month
was a flat trough and a spike, and most KPI cards read *first reading*. Added
**20 completed subscriptions (SUB-02xx)** and **41 recorded transactions
(TXN-11xx)** across Sep 2025 – Jun 2026, with collection ramping ₹1.18L → ₹7.12L
against a salary line running ₹6.7L – ₹8.5L. The trend now reads as a business
closing a gap month by month, which is what the chart is for.

**AUGUST IS BYTE-IDENTICAL, and that was the constraint.** Every added record is
in a **closed past month** and **terminal** — completed subscriptions, recorded
transactions — so nothing touches the reporting period. Verified by diffing the
whole of `overview()`, `tagTotals()`, `taxSummary()`, `activeCount()` and all 13
KPIs before and after: **no field moved.** Active subscriptions stay 6, MRR,
collection rate and the tax summary are untouched.

**IT IS REAL DATA, NOT PLACEHOLDER SHAPES.** The seed enforces its own integrity
and the first pass failed eight of those rules, correctly: every subscription
must resolve to a **registered user of that name**, every paid installment must
carry a **numbered, dated and hashed receipt**, and every event type must be in
the vocabulary. The records were regenerated against the 17 real users not yet
tied to a subscription rather than weakening any of it. Customers repeat across
months, which is both realistic and honest — `newCustomers` counts first payment,
so a repeat buyer is not a new one.

**Two assertions moved, neither weakened.** Both named a month that was empty
and is not any more: the *nothing fell due* check now reads Mar 2025, and the
*offers no month nothing was sold in* check now reads Jan 2025. Each still
proves the same behaviour against a month the records genuinely do not reach.

**Temp data**
`src/content/finance/subscriptions.json` and `transactions.json` → the two id
ranges above, each file carrying a `$comment_reviewBackfill` saying what they
are and how to remove them. **Placeholder records, and deliberately separable:**
delete the two ranges, or revert this commit, and the module is exactly as it
was — the checks prove it, since they pin August rather than the backfill.

**Backend needed**
`none` — these are seed rows. They disappear the moment the lists come from the
API; nothing in the code knows they exist.

**Open decisions**
`none`. One judgement worth stating: the figures ramp rather than being random.
Random monthly revenue would have drawn a jagged line that says nothing, and the
chart is there to answer *is the gap closing* — a question flat noise cannot
answer either way.

**Verified**
`npx tsc -b` and `npx eslint` clean. `npm run check:finance` → 441 pass — the
same 441 as before the backfill, including every assertion that pins an exact
August figure. `npm run check:finance-render` renders every surface;
`npm run check:finance-nav` passes. Diffed the full August derivation set before
and after and confirmed nothing moved.

### Analytics, rebuilt: a waterfall, a zero rule, and the prose off the page

**Area:** `#/finance-analytics` · Overview and KPI
**Files:** `src/admin/views/charts.tsx`, `src/admin/views/charts.css`, `src/admin/views/Finance/Analytics.tsx`, `src/admin/views/Finance/store.ts`, `src/admin/views/Finance/finance.css`, `scripts/check-finance-ledger.cjs`, `scripts/fn-smoke.tsx`

**What changed**

**THE STORY THE OLD PAGE HID.** Twenty months of records: eighteen of salary
with no revenue at all, first collection in July 2026, August the first month
net turns positive. The grouped column chart was scaled in ₹ thousands with no
zero baseline, so nineteen negative months were simply not drawn. **Net by
month** is now the second thing on the page — one series, a zero rule, negatives
below it, extremes and the last point direct-labelled.

**THE SEVEN-TILE STRIP BECOMES A WATERFALL.** Collected → other income → salary
→ other spend → refunds → net. The net tile already printed the formula in
words; the waterfall *is* that formula, so the words came off. A zero step is
drawn rather than skipped — an unpaid salary run is the most consequential thing
about August, and a tile reading ₹0 buried it.

**A COLOURBLINDNESS FAILURE, FOUND AND FIXED.** The shipping chart palette put
green in slot 2 beside amber in slot 3 — adjacent, and **ΔE 5.2 under**
**protanopia** against a floor of 8. On these charts those slots carry salary
and other spend, so roughly one man in twelve could not tell the two costs
apart. Finance now has its own slot order with brand teal in slot 1: worst
adjacent pair **ΔE 13.4 deutan / 15.8 normal**, lightness band, chroma floor and
3:1 surface contrast all passing in **both** modes. It also fixes the reading
problem — money in was the palest mark on a page about money arriving.
**Users’ slots are untouched**: the same reorder is owed to them, but their
slots carry different series and recolouring that module silently is not this
change.

**THE PROSE IS OFF THE PAGE.** The standing architecture notice at the top and
the `foot` paragraph under every block are gone — most explained a chart form
nobody was disputing, in front of somebody who came to read a number. What
survives is the handful of lines where a figure is **correct and misleading**:
burn fell 90% because the run is unpaid, the 90% margin has no salary in it,
completeness says nothing about correctness. Those now sit **on** the figure as
a one-clause caveat, not in a paragraph under the block.

**KPI CARDS GET FOUR HONEST STATES**: a value with a delta toned by
`goodDirection` and a sparkline; a value with **first reading** where there is
no prior; **not computed — and not zero** with the reason in the value’s place;
and **deliberately not computed** carrying its decision id. A sparkline is drawn
only where a real month-by-month series exists — a flat line from one reading is
a claim about stability these records do not make.

**Three new forms in the kit**, all CSS, no library: `Waterfall`,
`SignedColumns` and `Spark`. Geometry is scaled for the 38px axis gutter while
every mark carries the exact figure as `display`, so nothing rounded is ever
printed as an amount.

**Temp data**
`none` — no seed or vocabulary change. Every figure on the page was already
derivable; what is new is `waterfall()`, `atRisk()`, `kpiSeries()` and
`overview().outPaise` in the store, so the view still does no arithmetic.

**Backend needed**
`none` — no new endpoint. The four derivations read the same records the
existing reads do; when the lists come from the API these compute from whatever
the API returns.

**Open decisions**
`FN-OD-07` (runway) is unchanged and now has a card state of its own rather than
a footnote. Two calls made here: **Overview and KPI stay two tabs** — one is
checking the month, the other is choosing between options — and the **at-risk**
**table is a table, never a chart**, because its four amounts must never be
added and any shared axis invites the sum.

**Verified**
`npx tsc -b` and `npx eslint` clean on every touched file.
`npm run check:finance` → 441 pass, seventeen of them new: the waterfall’s steps
are the overview’s own figures and reconcile to `netPaise`, a zero salary step
is returned rather than dropped, `outPaise` is derived once, at-risk carries one
row per over-budget tag and none for a tag inside its budget, no at-risk row
labels its link with a section name (the panel’s nav rule, now enforced at the
source), and a level or a ratio gets no fabricated sparkline series.
`npm run check:finance-render` renders every surface and asserts the waterfall,
the zero rule and the absence of the standing notice and block footers.
`npm run check:finance-nav` passes. Palette re-validated with the checker in
both modes. **CSS pass:** 60 tokens used by the new rules, every one resolves,
none hardcoded, all theme-aware through the ramps; dead `.fin-kd` removed;
`forced-colors` rules extended to the three new marks; breakpoints at 900px
(waterfall split collapses, hero first) and 760px (bank strip stacks).
Read the rendered HTML directly to confirm geometry and labels rather than
trusting the assertions alone.

### Refunds: send-back is gone, the verdicts move into one Actions menu, and the standing prose comes off

**Area:** `#/finance-refunds` · a refund → the header actions · the decide, request, manual and transfer dialogs
**Files:** `src/admin/views/Finance/store.ts`, `src/admin/views/Finance/types.ts`, `src/admin/views/Finance/bits.tsx`, `src/admin/views/Finance/RefundDetail.tsx`, `src/admin/views/Finance/RefundModals.tsx`, `src/admin/views/Finance/Refunds.tsx`, `src/content/finance/refunds.json`, `src/content/finance/vocabularies.json`, `scripts/check-finance-ledger.cjs`, `scripts/fn-smoke.tsx`

**What changed**

**SEND-BACK IS REMOVED ENTIRELY** — the verdict, the `sent_back` state, the
`REFUND_SENT_BACK` event, the state’s place in the union and in the sort, and
both store filters that reached for it. It was a message wearing a state:
nothing about the refund changed, no money moved either way, and a request could
sit in that loop indefinitely with the ledger recording only that somebody had
asked a question. **A decision is yes or no.**

**THE VERDICTS MOVE INTO AN ACTIONS MENU.** The header carried Send back,
Decline and Approve side by side — three verdicts competing for one glance, the
destructive one and the ordinary one the same size, and a fourth button taking
their place once approved. One control now, and which items are on it is decided
by the refund’s state rather than by which buttons happen to render. Disabled
rather than hidden without Super Admin.

**THE VERDICT IS CHOSEN BEFORE THE DIALOG OPENS.** It used to be picked again
inside, from a list of three, on a dialog reached by pressing one of three
buttons that each preselected one — the answer given twice, and the second able
to disagree with the first. `DecideRefundModal` now takes a `verdict` rather
than an `initial`, titles itself *Approve RF-0117* / *Decline RF-0117*, and asks
for the note and nothing else.

**ONE MENU SHELL FOR THE MODULE.** There were two builds of the same popover —
one on the transaction row, one on the refund row — with the same outside-click
and Escape handlers, the same `.mi` items and two different triggers.
`ActionMenu` in `bits.tsx` is the shell; items are data, so `role="menuitem"`
and close-on-choose are decided once. `TxnMenu` and `RefundMenu` are both built
on it, which also settles the inconsistency flagged in the previous entry: the
refund menus say **Actions** too. Salaries A/C still has its own; out of scope.

**THE STANDING PROSE COMES OFF the dialogs and the record.** Removed: the decide
dialog’s two checklist lines, the transfer dialog’s two, the manual-refund
dialog’s notice about carrying no policy check, and the paragraph under the
policy check restating that it never blocks. Field hints that explained a rule
rather than the field are cut to the field. **What was kept is anything that
states a fact about THIS record** — the policy check results, the decision note,
the *₹x has NOT moved* warning on an approved-but-unsent refund, and the line
saying a manual refund has no original payment behind it. The rule that a block
frames rather than gates now rides the block’s own `desc`, where it is read
before the checks instead of after.

**Temp data**
`src/content/finance/refunds.json` → RF-0123 was the seeded `sent_back` example;
it is back to `requested` with its decision cleared and the send-back event
dropped. The file’s own note loses the `send-back` endpoint. Placeholder records.
`src/content/finance/vocabularies.json` → the `sent_back` refund state and the
`REFUND_SENT_BACK` event type are removed. Static copy.

**Backend needed**
- `POST /api/v1/finance/refunds/:id/decide` → verdict is now `approve` or
  `decline` only. A note stays mandatory on a decline. Reject `send_back`.
- `POST /api/v1/finance/refunds/:id/send-back` → **no longer needed.**
- Any list or count of rows awaiting a decision is `state === "requested"` alone.

**Open decisions**
One assumption, and it is the reason send-back could go: **a request that needs
more information is declined with the note saying what was missing, and raised
again.** That keeps every refund on the books terminal, and the note is still
the only thing the requester sees either way.

**Verified**
`npx tsc -b` and `npx eslint` clean on every touched file.
`npm run check:finance` → 424 pass, with new assertions that no refund can reach
a sent-back state and that the vocabulary does not offer one, alongside the
existing four-eyes, mandatory-note and already-decided checks.
`npm run check:finance-render` renders every surface, asserting the trimmed
dialogs (no `fin-chks` checklist, no second verdict picker, the note mandatory
on a decline), that the record page offers no Send back and no header verdict
buttons, and that the policy-check rule is stated once rather than twice.
`npm run check:finance-nav` passes. Not checked against a live backend — the
module is still proto-seeded.

### The row actions trigger says Actions instead of showing three dots

**Area:** `#/finance-transactions` — the last column of every row, and the record header
**Files:** `src/admin/views/Finance/bits.tsx`, `scripts/fn-smoke.tsx`

**What changed**

**THE GLYPH BECAME A WORD.** The menu trigger was a three-dot button — a
convention somebody either already holds or does not. On a table row it sat in
a column with no header to explain it, beside nothing else that could be
pressed, so there was nothing to read it against. It says **Actions** now.
`.tbl td.tight` is `width: 1%; white-space: nowrap`, so the column takes the few
extra pixels from the ones with room to spare.

**The aria-label still carries the row id** — *Actions for TXN-0901* — because a
screen reader meeting the twentieth `Actions` on a page needs to know which row
it belongs to. No caret was added: the ask was to remove the icon, not to swap
one glyph for another.

**Known inconsistency, deliberately left:** Refunds and Salaries A/C still use
the three-dot trigger. They were not in scope and changing them is one line
each; worth doing together if this reads better.

**Temp data**
`none`.

**Backend needed**
`none`.

**Open decisions**
`none`.

**Verified**
`npx tsc -b` and `npx eslint` clean. `npm run check:finance` → 423 pass.
`npm run check:finance-render` renders every surface, now asserting the trigger
renders the word rather than the glyph, alongside the existing check that every
row carries its own menu. `npm run check:finance-nav` passes.

### The cancel dialog is the reason box and nothing else

**Area:** `#/finance-transactions` → a row → actions → Cancel
**Files:** `src/admin/views/Finance/TxnModals.tsx`, `scripts/fn-smoke.tsx`

**What changed**

**TWO STANDING LINES CAME OFF.** The dialog opened with a checklist — the row
keeps its figures and stays in the ledger, and it stops counting from now on.
Both true, both already said on the record page in front of the row they are
true of, and both a wall of text between a person and the one box they came to
fill. That is friction, not caution.

**WHAT IT STILL DOES is refuse without a reason.** The title names the row, the
sub-line says Super Admin, the button stays disabled until something is typed,
and the field says why the reason is mandatory — read at audit. That is the
whole dialog. The same trim the reverse dialog got before it was removed.

**Temp data**
`none` — copy only.

**Backend needed**
`none` — no contract change. `POST /api/v1/finance/transactions/:id/cancel` is
unaffected; the reason stays mandatory and is still validated in the store.

**Open decisions**
`none`.

**Verified**
`npx tsc -b` and `npx eslint` clean. `npm run check:finance` → 423 pass.
`npm run check:finance-render` renders every surface; the dialog assertions now
pin what it must keep (the row id, Super Admin, the reason box and why it is
mandatory) and that it carries no `fin-chk` checklist and no form.
`npm run check:finance-nav` passes. Not checked against a live backend — the
module is still proto-seeded.

### Cancel replaces Update; the ledger loses Paper trail and gains a row menu

**Area:** `#/finance-transactions` — the table’s columns and per-row actions · a row → actions → Cancel
**Files:** `src/admin/views/Finance/store.ts`, `src/admin/views/Finance/types.ts`, `src/admin/views/Finance/bits.tsx`, `src/admin/views/Finance/TxnModals.tsx`, `src/admin/views/Finance/TxnDetail.tsx`, `src/admin/views/Finance/Transactions.tsx`, `src/content/finance/transactions.json`, `src/content/finance/vocabularies.json`, `scripts/check-finance-ledger.cjs`, `scripts/fn-smoke.tsx`

**What changed**

**UPDATING IS REMOVED ENTIRELY** — `updateTransaction`, `TxnEdit`,
`UpdateTxnModal`, `updatedBy`/`updatedAt` and the `TXN_UPDATED` event. Nothing
rewrites what a row says any more.

**CANCEL TAKES ITS PLACE.** Super Admin, one mandatory reason, and the row turns
`cancelled`: it keeps its amount, direction, tag, date, party, reference,
account and receipt exactly as posted, stays in the ledger struck through, and
stops counting — out of the period’s figures, its tag’s total, reinvestment, the
bank-match candidates and the missing-bill queue. **It is not a delete.** The
correct figures are a NEW row, recorded the ordinary way, so the books carry
every version they have ever carried.

**PAPER TRAIL IS OFF THE TABLE.** It spent a wide column on a filename most
people never read. The two things it was actually watched for both survive it:
the rail still goes amber on a row missing a required bill, and *Missing a bill*
in the strip is still one press away. The record page holds the filename and the
bank match in full.

**EVERY ROW CARRIES AN ACTIONS MENU**, where the chevron was — Open the record,
Download receipt (still disabled), Cancel, Copy row id. `TxnMenu` moved from
`TxnDetail` into `bits.tsx` so the ledger and the record share one menu rather
than growing two; it stops its own clicks, since every row in the list is a link
and a press would otherwise navigate out from under the menu it just opened.
The caller supplies the actions, so the component never has to know which shell
it is inside.

**THE UPDATED COLUMN BECOMES STATE AGAIN**, with the `recorded` / `cancelled`
vocabulary restored and the State filter back. `Cancelled` takes the theme’s
`dead` tone — struck through on an inset ground, which is what that tone already
means everywhere else — and a cancelled row wears the module’s existing `dim`
treatment: greyed line, struck figure.

**A CONSEQUENCE WORTH STATING: the missing-bill queue is now a CLOSED backlog.**
A receipt is settable only when recording, since nothing edits a posted row and
the separate receipt dialog went in the previous entry. Those rows shrink out of
the queue by being cancelled — or by being cancelled and recorded again with the
receipt they always needed, which is the same correction story as any other
wrong figure. `TxnFields` keeps its own signature but is back to one caller.

**Temp data**
`src/content/finance/transactions.json` → `state` returns on every row,
`updatedBy`/`updatedAt` leave, `cancellation` joins. TXN-0917 is the worked
example again, back to Sharma Carpentry Works with `state: cancelled`, a
`cancellation` block and a `TXN_CANCELLED` event. Placeholder records.
`src/content/finance/vocabularies.json` → `transactionStates` restored
(`recorded`/ok, `cancelled`/dead), `TXN_UPDATED` → `TXN_CANCELLED`, `FN-AD-02`
restated. Static copy.

**Backend needed**
- `POST /api/v1/finance/transactions/:id/cancel` → body `{ reason }`, Super
  Admin, reason mandatory. Sets `state: "cancelled"` and a `cancellation` of
  `{ reason, by, at }`, appends one `TXN_CANCELLED` event, and changes **no**
  other field on the row. Refuses a row already cancelled.
- `PATCH /api/v1/finance/transactions/:id` → **no longer needed.** Nothing calls
  it; there is no edit.
- Every aggregate must exclude rows whose `state` is `cancelled` — period spend
  and credits, tag totals, reinvestment, bank-match candidates, missing-bill.

**Open decisions**
`FN-AD-02` is now **Posted is permanent; a wrong row is cancelled, not**
**rewritten**. Two calls assumed and stated on screen: **Cancel is Super Admin**
(the authority the action it replaces carried), and **a cancelled row is never
reopened** — there is no un-cancel, because a row that was written off and then
un-written-off is a state the books cannot explain; the way back is a new row.

**Verified**
`npx tsc -b` and `npx eslint` clean on every touched file.
`npm run check:finance` → 423 pass, including a new writes block asserting that
no figure moves, that the ledger neither grows nor shrinks, that the tag total
and the period spend each drop by exactly the row’s amount, that a reason is
mandatory and a second cancellation refused, that a cancelled row leaves the
missing-bill queue without anyone finding paper for it, and that recording the
corrected row afterwards leaves both on the books with only one counting.
`npm run check:finance-render` renders every surface, asserting the actions menu
on every ledger row, the State column, the dimmed cancelled row, the record’s
cancellation banner and *Cancelled by* line, the cancel dialog’s shape, and that
Paper trail’s cells are gone while the amber rail and the queue cell remain.
`npm run check:finance-nav` passes. Exercised directly against the seed:
cancelling TXN-0904 kept its ₹6,200, party and receipt, held the ledger at 17
rows, and dropped August debit from ₹63,250 to ₹57,050 and the Software & tools
tag from ₹8,600 to ₹2,400. `npm run check` as a whole still stops at
`check:enquiries`, which needs a running backend; unrelated.

### The receipt loses its separate upload dialog and becomes a field on Update

**Area:** `#/finance-transactions` → a row → actions (the *Attach / Edit receipt* item) · the Update dialog
**Files:** `src/admin/views/Finance/store.ts`, `src/admin/views/Finance/TxnModals.tsx`, `src/admin/views/Finance/TxnDetail.tsx`, `scripts/check-finance-ledger.cjs`, `scripts/fn-smoke.tsx`

**What changed**

**`BillModal` AND `attachBill` ARE GONE**, along with the *Attach receipt* /
*Edit receipt* menu item. The receipt is now a field in the shared `TxnFields`
set, so it appears on Record (mandatory, as before) and on Update (optional).

**THE SEPARATION HAD ONE REASON AND IT EXPIRED.** A row’s figures could not be
amended and its paper could, so the two could not share a screen — two rules,
two dialogs, and a standing notice on the receipt dialog explaining why it could
not touch anything else. One rule now, so one screen, and the notice goes with
it. The paper behind a row is one of the things the row says.

**LEAVING IT ALONE LEAVES IT ALONE.** On an update, both an omitted `bill` and an
explicit `null` mean *unchanged* — so reopening the dialog to fix a remark never
disturbs the receipt. A row that already has one shows its filename and offers
*Replace*; a row with none offers *Attach*. There is no way to REMOVE a receipt:
replacing one is a change the history records, removing one would be a gap
nobody could account for.

**IT IS HELD TO THE SAME THREE RULES** as a receipt attached at the time — image
or PDF, under 5 MB, a real filename — because evidence supplied later is not
evidence of a lower standard. And it lands in the diff like any other field:
*Receipt: — → late-invoice.pdf*, in the same `TXN_UPDATED` entry as the rest of
the edit.

**THE MISSING-BILL BACKLOG IS STILL EMPTIABLE**, which is why the capability was
folded in rather than deleted: `missingBill` exists precisely for the rows that
predate the receipt rule, and an update carrying a receipt is what clears them.
**Download receipt** stays its own (still disabled) item — reading a file and
replacing one are not the same act.

**One narrowing worth stating:** attaching a receipt to an old row used to be
available to anyone with edit rights; it now rides on Update, which is Super
Admin. That follows from putting it on that dialog, and is a one-line change if
it should not.

**Temp data**
`none` — no seed or vocabulary change. The receipt is still a filename and a
type, never bytes; the panel has no document store yet.

**Backend needed**
- `PATCH /api/v1/finance/transactions/:id` → now also accepts an optional
  `bill`. Absent or null must mean *leave the existing receipt alone*; a file
  must be validated exactly as create validates one, must replace the current
  receipt, and must appear in the same `TXN_UPDATED` diff as `Receipt: was →
  now`. There is no remove.
- `POST /api/v1/finance/transactions/:id/bill` → **no longer needed.** Nothing
  calls it.

**Open decisions**
One assumption, stated above and on the dialog: **a receipt can be replaced but
never removed.** The alternative — letting somebody clear a receipt — would put a
row back into the missing-bill queue with no record of what used to satisfy it.

**Verified**
`npx tsc -b` and `npx eslint` clean on every touched file.
`npm run check:finance` → 436 pass, ten of them new: a receipt through Update is
refused for the wrong type and for size, is accepted with the right one, clears
the row from the missing-bill backlog, and is named in the diff; an omitted or
null `bill` keeps the existing receipt; a supplied one replaces it and the diff
names both files; and swapping only the receipt counts as a real change rather
than a no-op. `npm run check:finance-render` renders every surface, asserting
the receipt control on the update dialog in both states (a row with paper shows
its filename and offers Replace; one without offers Attach).
`npm run check:finance-nav` passes. Exercised directly against the seed:
TXN-0910 went from `missingBill: true` to `false` on one update, with
*Receipt: — → late-invoice.pdf* on the same history line as the party change.
`npm run check` as a whole still stops at `check:enquiries`, which needs a
running backend; unrelated.

### Reverse is gone; a row is corrected in place, and the history keeps every version

**Area:** `#/finance-transactions` · a row → actions → Update · the ledger’s last column
**Files:** `src/admin/views/Finance/store.ts`, `src/admin/views/Finance/types.ts`, `src/admin/views/Finance/TxnModals.tsx`, `src/admin/views/Finance/TxnDetail.tsx`, `src/admin/views/Finance/Transactions.tsx`, `src/admin/views/Finance/bits.tsx`, `src/admin/views/Finance/finance.css`, `src/content/finance/transactions.json`, `src/content/finance/vocabularies.json`, `scripts/check-finance-ledger.cjs`, `scripts/fn-smoke.tsx`

**What changed**

**REVERSING IS REMOVED ENTIRELY.** `reverseTransaction`, `ReverseTxnModal`, the
`reversal` block, the `reversed` state, the whole `TxnState` type, the
`transactionStates` vocabulary, `TxnPill` and the `TXN_REVERSED` event are all
gone. Retiring a row never actually fixed anything — a vendor typed wrong
stayed typed wrong forever and the correct figure lived on a second row or
nowhere at all.

**UPDATE REPLACES IT**, in the same menu slot. It opens the record dialog’s own
field set on what the row currently says — direction, credit kind, **tag**,
amount, value date, party, mode, reference, account and remark — and writes
over the row. It refuses everything recording refuses: an inactive tag, a
non-positive amount, a blank remark or reference, a reference another record
carries, a future date, an unknown account, a credit that is not one of the
three permitted kinds. It also refuses a write in which nothing moved.

**THE AUDIT MOVED TO THE HISTORY, WHICH IS STILL APPEND-ONLY.** Each edit
appends one `TXN_UPDATED` event naming every field that moved and what it moved
from — *Tag: Software & tools → Vendor & contractor · Amount: ₹6,200 → ₹7,000*.
The row shows the current truth, the timeline shows all of it, and **nothing is
ever deleted**. `updatedBy`/`updatedAt` are on the row so a reader knows the
figures are not the ones first posted.

**ONE FORM, NOT TWO.** Record and Update were about to be two copies of the same
150 lines, so the field set is now a single `TxnFields` component both use. The
receipt stays outside it: it is mandatory when recording, has its own dialog
afterwards, and swapping paper is not the same act as restating what a row says.

**THE STATE COLUMN BECAME UPDATED.** With reversing gone it would have read
*Recorded* on every row forever, so it and the State filter are removed; the
column now names who last restated a row and when, or a dash. The `dim`/struck
row treatment and the blue rail from the reversal build are reverted.

**A CHANGED FIGURE BREAKS A BANK MATCH.** If the amount, reference or direction
moves, `bankLineId` is cleared — the row is no longer that statement line — and
the same history entry says so.

**SUPER ADMIN, exactly where Reverse was.** Restating a posted row is the same
authority as retiring one; the gate did not get cheaper because the mechanism
got simpler.

**Temp data**
`src/content/finance/transactions.json` → `state`, `reversal` and
`reversesTxnId` leave the shape; `updatedBy`/`updatedAt` join it on every row.
TXN-0917 is the worked example: it was keyed against Sharma Carpentry Works when
the invoice was Rakesh Contractors’, so the party now reads Rakesh Contractors
and its history carries the diff. Placeholder records.
`src/content/finance/vocabularies.json` → `transactionStates` removed,
`TXN_REVERSED` → `TXN_UPDATED`, and `FN-AD-02` restated. Static copy.

**Backend needed**
- `PATCH /api/v1/finance/transactions/:id` → accepts the ten editable fields,
  returns the updated row. Must apply the same validation as create, must treat
  the row’s own reference as non-duplicate, must append one `TXN_UPDATED` event
  carrying the field-level diff, must set `updatedBy`/`updatedAt`, and must
  clear `bankLineId` when amount, reference or direction changes. Super Admin.
- `POST /api/v1/finance/transactions/:id/reverse` → **no longer needed.** Nothing
  calls it and the reversed state no longer exists on the record.
- Aggregates go back to summing every row — there is no state to exclude.

**Open decisions**
`FN-AD-02` was *Posted is immutable*; it is now **Posted is correctable, and
every correction is on the record**. The rule it protected survives in a
stronger form: nothing is deleted, and no field moves without an audited entry
saying what it moved from. Two calls this build assumed an answer to, both
stated on screen: **Update is Super Admin** (matching the action it replaces),
and **a row may keep a tag that has since been deactivated** but may not be
moved onto one — deactivating a tag deliberately re-buckets nothing, and an edit
to a remark should not force a re-filing nobody asked for.

**Verified**
`npx tsc -b` and `npx eslint` clean on every touched file.
`npm run check:finance` → 426 pass, including a new writes block covering every
refusal above, the no-change refusal, the field-level diff landing in the
history, the money following a re-tagged row, the ledger staying the same
length, and the bank match coming off only when a figure moves.
`npm run check:finance-render` renders every surface, asserting the Updated
column, the record’s update banner and *Updated by* row, and that the update
dialog is the record dialog opened on the row (its tag optgroups present, the
receipt field absent). `npm run check:finance-nav` passes. Exercised the write
directly against the seed: re-tagging TXN-0904 moved ₹6,200 from Software &
tools to Vendor & contractor, kept the ledger at 17 rows, dropped its bank match
and wrote one history line naming all three changes. `npm run check` as a whole
still stops at `check:enquiries`, which needs a running backend; unrelated.

### The reverse dialog is the reason box and nothing else

**Area:** `#/finance-transactions` → a row → Reverse
**Files:** `src/admin/views/Finance/TxnModals.tsx`, `scripts/fn-smoke.tsx`

**What changed**

**THREE STANDING LINES CAME OFF.** The dialog opened with a checklist — the row
keeps its amount and everything else it was posted with, it stops counting in
the period and its tag, and reversing moves no money by itself. All three are
true and all three are already said on the record page, which is where somebody
reads what a reversed row means. Restating them at the moment of the click was
a wall of text in front of the one thing the dialog is for.

**WHAT IT STILL DOES is refuse without a reason.** The title names the row, the
sub-line says Super Admin, and the reason field says why it is mandatory — read
at audit. That is the whole dialog now.

**Temp data**
`none` — copy only.

**Backend needed**
`none` — no contract change. `POST /api/v1/finance/transactions/:id/reverse` is
unaffected; the reason stays mandatory and is still validated in the store.

**Open decisions**
`none`.

**Verified**
`npx tsc -b` and `npx eslint` clean. `npm run check:finance` → 413 pass.
`npm run check:finance-render` renders every surface; the dialog assertions now
pin what it must keep (the row id, Super Admin, the reason box and why it is
mandatory) and that it carries no `fin-chk` checklist. Not checked against a
live backend — the module is still proto-seeded.

### Reversing corrects the row itself — the counter-entry is gone

**Area:** `#/finance-transactions` · the row menu → Reverse · the `Reversed` chip
**Files:** `src/admin/views/Finance/store.ts`, `src/admin/views/Finance/types.ts`, `src/admin/views/Finance/Transactions.tsx`, `src/admin/views/Finance/TxnDetail.tsx`, `src/admin/views/Finance/TxnModals.tsx`, `src/admin/views/Finance/bits.tsx`, `src/admin/views/Finance/finance.css`, `src/content/finance/transactions.json`, `src/content/finance/vocabularies.json`, `scripts/check-finance-ledger.cjs`, `scripts/fn-smoke.tsx`

**What changed**

**ONE ROW, NOT TWO.** Reversing used to append a `TXN-RV-` counter-entry
carrying the negative amount, and the month came out right because the pair
summed to zero. That was two lines to read, two ids to hold, and a row in the
ledger that was never a payment anybody made. The correction now rides on the
row it corrects: `state` turns `reversed`, and `reversal` carries the reason,
who gave it and when.

**NOTHING THE ROW SAYS IS EDITED**, which is the rule the counter-entry existed
to protect and it still holds. The amount, direction, tag, reference, date,
account and bill are exactly as posted and stay on the record. What changes is
that the row stops counting — out of the period's debit and credit totals, out
of its tag's total, out of reinvestment, and out of the bank auto-match
candidates. It is also no longer chased for a missing bill: a receipt proving
what it charged would prove nothing once it charges nothing.

**THE CHIP IS BLUE, NOT RED.** Red filed the finished thing beside the
unfinished ones — a missing bill, a blown budget. A reversed row is the settled
one on the page, so it takes the `info` tone, and the rail with it. The row
wears the same `dim` a cancelled subscription already wore: greyed line, struck
figure. The word stays **Reverse** — it is what the action does.

**The direction chip is deliberately NOT flipped.** Showing a reversed Debit as
a Credit would make an out-payment read as money arriving, in the tag totals,
in Analytics and against the bank line. The row keeps saying a debit was paid,
because one was; the strike and the chip say it counts for nothing.

**Temp data**
`src/content/finance/transactions.json` → the seeded counter-entry `TXN-RV-0917`
is deleted (18 rows → 17) and `reversesTxnId` is off the record shape entirely;
`TXN-0917`'s `reversal` no longer names a counter-entry. Placeholder records.
`src/content/finance/vocabularies.json` → the `reversed` state's tone and
meaning, and the `FN-AD-02` doctrine line. Static copy.

**Backend needed**
- `POST /api/v1/finance/transactions/:id/reverse` → must now return the SAME row
  with `state: "reversed"` and a `reversal` of `{ reason, by, at }`. It must not
  create a second transaction, and it must not alter any figure on the row. The
  period and tag aggregates it feeds must exclude rows whose `state` is
  `reversed` rather than relying on a negative row to net them out.

**Open decisions**
`FN-AD-02` (*Posted is immutable*) is restated rather than abandoned: nothing a
row **says** is edited or deleted, and the correction is a reversal on the row
with an actor and a reason. Its position line in `vocabularies.json` is updated
to match, so the register and the code still point at each other.

**Verified**
`npx tsc -b` clean; `npx eslint` clean on every touched file.
`npm run check:finance` → 413 checks pass, including new ones asserting no
negative row and no `-RV-` id exists in the ledger, that a reversal drops the
tag total by exactly the row's amount, and that the row keeps its amount and
direction. `npm run check:finance-render` renders every surface, with new
assertions on the dimmed row, the blue rail and the record banner.
`npm run check:finance-nav` passes. Confirmed against the seed that August's
debit total is unchanged at ₹63,250 — the pair used to net to zero, and the
single row is now simply excluded. `npm run check` as a whole still stops at
`check:enquiries`, which needs a running backend; not related to this change.

### Mark as wrong is gone — a reversal is the only way to say a row is bad

**Area:** `#/finance-transactions` · the row menu · the `Marked wrong` strip cell and `?flag=wrong` queue
**Files:** `src/admin/views/Finance/store.ts`, `src/admin/views/Finance/types.ts`, `src/admin/views/Finance/Transactions.tsx`, `src/admin/views/Finance/TxnDetail.tsx`, `src/admin/views/Finance/TxnModals.tsx`, `src/admin/views/Finance/finance.css`, `src/content/finance/vocabularies.json`, `scripts/check-finance-ledger.cjs`, `scripts/fn-smoke.tsx`

**What changed**

**THE FLAG THAT CHANGED NOTHING IS REMOVED.** A row could be marked wrong,
which moved no money, changed no state and altered no total — it only put the
row in a queue for somebody to look at again. `markTxnWrong`, `clearTxnWrong`,
the `wrong` field on `CompanyTxn`, the `MarkWrongModal`, the `Marked wrong`
strip cell and its `?flag=wrong` queue, the red sub-line on the row and the
banner on the record are all gone.

**REVERSAL IS THE WHOLE VOCABULARY NOW.** A correction was always the
counter-entry; the mark was the gap between noticing and correcting, and two
menu items both announcing that a row is bad read as two ways to do the same
thing when only one of them corrected anything. One item, one meaning.

**The row menu loses one item, the strip loses one cell.** `Queue` now offers
only `Missing a bill`. The rail no longer has a disputed tone — reversed still
outranks a missing bill. `TXN_MARKED_WRONG` and `TXN_MARK_CLEARED` are out of
the event vocabulary; no seed row carried either, so no history is orphaned.

**Temp data**
`src/content/finance/vocabularies.json` → two event keys removed from
`eventTypes` (static copy). `src/content/finance/transactions.json` unchanged —
no seeded row ever carried a `wrong` mark.

**Backend needed**
- `none` — the endpoints this would have implied (`POST /transactions/:id/mark`,
  `POST /transactions/:id/mark/clear`) are no longer needed, and were never
  built. `POST /api/v1/finance/transactions/:id/reverse` is unaffected.

**Open decisions**
`none` — removing the flag settles the question it raised (who may dispute a
row without Super Admin) by deciding nobody does: disputing and correcting are
the same act, and it is Super Admin.

**Verified**
`npx tsc -b` clean. `npm run check:finance` → all 409 checks pass with the
mark-wrong block removed. `npm run check:finance-render` renders every surface
with no failures. `npm run check:finance-nav` passes. `npm run lint` reports no
new problems in `src/admin/views/Finance/` (the repo's pre-existing `no-explicit-any`
errors are elsewhere and untouched). Not checked against a live backend — the
module is still proto-seeded.

---

## 2026-09-02

### Refunds becomes one table, like every other list in the module

**Area:** `#/finance-refunds` · `?flag=awaiting` · `?flag=owed`
**Files:** `src/admin/views/Finance/Refunds.tsx`, `scripts/fn-smoke.tsx`

**What changed**

**THREE BANDS BECAME ONE TABLE.** The face stacked three sections — awaiting a
decision, approved but not sent, settled — each with its own heading, its own
empty state, and a bespoke `.fin-q` row shape that existed nowhere else in the
panel. On a screen that often holds four refunds that is three headings and
three empty states, no way to see the whole book at once, and a refund that
does not read like a slip or a transaction even though it is the same kind of
thing.

**The reasoning behind the bands was right and the answer was wrong.** Those
*are* three different jobs. The strip answers it instead: each cell is a
filter, so *approved, not sent* is one press rather than a section that is on
screen whether or not anything is in it — and the table is sorted by that same
job order, so the rows needing action are on top **with no filter applied**,
which is what the bands were really buying.

**Four read-out tiles became five strip cells that navigate.** They stated the
four numbers and then made somebody scroll to the band that held them. The
definitions ride the cell's `tip`, because a cell is a button and an `i` inside
one would swallow half its own click target — the same answer Salaries A/C and
Other Transaction reached.

**APPROVAL STILL MOVES NO MONEY**, and the gap between `approved` and `paid`
keeps its own cell, its own warn tone and its own place in the sort. Only its
band is gone.

The row carries the module's own menu — the same `.fin-menu` and `.mi` rows the
slips table and the transaction record use — with *Record the transfer* offered
on exactly the rows that can take one, and **disabled with the reason** on the
rest rather than hidden.

**Temp data**
`none`.

**Backend needed**
`none`. `?flag=` is resolved client-side like every other filter on this face.

**Open decisions**
`none`. `flag` is this face's own param and sits beside `state` rather than
replacing it, because two of the cells stand for a JOB rather than a state —
*awaiting* is `requested` OR `sent_back`, and the state filter takes exactly
one. One param that meant either would be a filter nobody could reason about.

**Verified**
`npx tsc -b` clean · `eslint` clean · `vite build` clean · `check:finance`
426/426 · `check:finance-render` renders every surface. The rendered page is
**1 table, 1 strip, 0 tiles, 0 queue rows**, and three of the new assertions
check an ABSENCE — `ok1(refunds, 'class="tbl')` proves exactly one table rather
than merely that a table exists, and `hasnt` proves the bespoke row shape and
the read-out tiles are gone rather than joined by a fourth thing.
**Not checked:** not opened in a browser. The row menu is unreachable without a
session, and an eight-column table at narrow widths is unseen — though the
identifier and date columns reuse the `.fin-c-slip` / `.fin-c-when` bounds that
were added for the slips table, so the fault that one had is already answered
here.

---
## 2026-09-02

### A transaction can be marked wrong — a flag, not a third state

**Area:** `#/finance-transactions` · `?flag=wrong` · `#/finance-transactions/TXN-…`
**Files:** `src/admin/views/Finance/{TxnDetail,TxnModals,Transactions,store,types,finance.css}.ts(x)`,
`src/content/finance/vocabularies.json`, `scripts/{check-finance-ledger.cjs,fn-smoke.tsx}`

**What changed**

**Somebody can now say a row is wrong without moving any money.** It was asked
for once, declined as a third state, and asked for again — so it is built the
one way that does not break the rule it collided with.

**IT IS A FLAG, NOT A STATE.** `state` stays `recorded`, the amount is
untouched, and **every total still counts the row** — because the money did
move, and somebody believing it should not have is a different fact from it
not having happened. Nothing in analytics reads the field. What it records is
itself a fact: who raised it, when, and why.

That is the same shape `Payslip.held` already has — a decision about a record,
with a mandatory reason, that changes no money — and the reason a third *state*
would have been wrong where a flag is not: a state is the ledger's word for
what happened, and a doubt is not something that happened to the money.

**WHAT IT BUYS is the gap between noticing and correcting.** Reversing is Super
Admin and needs a decision; noticing is anybody's job and needs recording the
moment it happens, or it lives in somebody's memory until they are on leave.
**Anyone with edit may mark; only a Super Admin may reverse** — making those
one permission would mean the people closest to the row cannot say anything
about it.

**Both halves need words.** A mark with no reason is indistinguishable from a
misclick at audit, and a concern raised and silently dropped is worse than one
never raised — it leaves a record that somebody looked and no record of what
they concluded. So clearing takes a note too.

**A reversal answers the mark**, so the mark comes off: leaving it would ask
somebody to look again at the one row that no longer needs looking at. The
events stay, which is the part worth keeping.

It surfaces as a queue cell beside *Missing a bill*, a filter, a red rail and a
line under the state pill — **beside** the pill and never instead of it,
because a chip that replaced the state would be the third state again.

**The Reverse item lost its suffix in the same breath.** It read *Reverse — this
row was wrong*, written the turn before this one to say that reversing WAS the
mark-it-bad action, back when there was nothing else. Beside a real *Mark as
wrong* it said the word twice: two menu items both announcing that a row is bad,
when only one of them corrects anything. The suffix is gone and the distinction
moved to each item's `title`, where it costs no space on the menu — *raise a
doubt, moves no money, anyone with edit* against *append a counter-entry, this
is what actually corrects the money*.

**Temp data**
`none` new. `vocabularies.json` gains `TXN_MARKED_WRONG` and `TXN_MARK_CLEARED`:
`EventRow` prints the raw key for a type the vocabulary does not know, which is
how `SALARY_PAID` spent this whole branch showing as a constant in a timeline.

**Backend needed**
- `POST /admin/finance/transactions/{id}/mark-wrong` — `{reason}`, mandatory —
  and `…/clear-mark` — `{note}`, mandatory. **Edit rights, not Super Admin.**
- `CompanyTxn.wrong` on the payload: `{by, at, reason}` or null. **It must not
  reach any aggregate.** A row marked wrong is a row that still counts, and an
  endpoint that quietly excluded it would make the panel and the books
  disagree about a figure neither of them changed.
- Reversing clears it server-side too, and appends the event rather than
  deleting the history of it.

**Open decisions**
⚠ **The mark is unrestricted by design and that is worth revisiting with
  volume.** Anyone with edit can mark any row, including one they recorded
  themselves, and nothing expires. If the queue grows into a place concerns go
  to be forgotten, the answer is an age on the cell rather than a permission —
  but that is a decision to make when there is a queue to look at, not now.

**Verified**
`npx tsc -b` clean · `eslint` clean · `vite build` clean · **`check:finance`
426/426**, up from 409: seventeen new assertions, and the ones that matter are
about what the mark **does not** do — the row is still `recorded`, the amount
is unchanged, and `overview().otherOutPaise` is identical before and after.
Also asserted: both refusals for a missing reason, the double-mark and
clear-unmarked refusals, that a reversal clears the mark while the history
keeps it, that an already-reversed row cannot be marked, and that **both event
types it writes resolve in the vocabulary rather than rendering as raw keys**.
`check:finance-render` renders every surface with the dialog asserted to say
outright that it moves no money.
**Not checked:** not opened in a browser. The menu items are unreachable
without a session, so the mark and clear paths are verified through the store
and the dialog's markup only.

---
## 2026-09-02

### The transaction record gets one actions menu, its remark and a receipt section

**Area:** `#/finance-transactions/TXN-…` · Record a transaction
**Files:** `src/admin/views/Finance/{TxnDetail,TxnModals,store,finance.css}.ts(x)`,
`scripts/fn-smoke.tsx`

**What changed**

**ONE MENU INSTEAD OF A ROW OF BUTTONS.** `Attach a bill` and `Reverse` sat
side by side in the header, which gave a destructive Super-Admin action the
same weight as attaching paperwork and had nowhere to put a third. Everything
the row can have done to it is behind one control now — Edit receipt, Download
receipt, Reverse, Copy row id — on the same `.fin-menu` and the same `.mi`
rows the slips table uses, so there is one menu in the module rather than two
that drift.

**EDIT IS THE RECEIPT, AND THE DIALOG SAYS SO.** The brief asked for an Edit
button in place of Attach a bill, and the word promises the figures — on a page
whose own footer says a recorded row is never edited. Both are honoured rather
than one of them quietly winning: the menu item is Edit, and the dialog it
opens states in one line that only the receipt can change and that a wrong
figure is corrected by a counter-entry. **The amount, direction, tag,
reference, date and account remain unreachable from every screen**, which is
the invariant the whole module is built on.

**`attachBill` now holds a late receipt to the same standard as one attached at
the time** — image or PDF, 5 MB, refusing by name — because evidence added
afterwards is not worth less. It takes a file rather than a typed filename, and
records a REPLACEMENT differently from a first attachment in the event note.
It is still the only write that touches a recorded row, and it touches only the
paperwork.

**The remark is on the record.** `description` was collected on the dialog and
then only ever readable in the list's own truncated column — the record page
did not show it at all. It sits in *What moved* now, wrapping as a sentence
rather than being cut like the single-token values around it. On the dialog it
is **labelled Remark**; the stored field is still `description`, because the
wire name is what the ledger and the API already agree on and renaming it would
be a migration to make a word nicer.

**The bill block became a receipt section.** It was three rows of a key-value
list, which is the right shape for facts about money and the wrong one for a
document: what somebody wants here is to see it is there and to open it. It
reads as a file now — and says plainly that **the panel holds the name, not the
bytes**, which is why Download is present and disabled with the reason on it
rather than absent or silently doing nothing.

**Temp data**
`none`.

**Backend needed**
- A document store, and `GET /admin/finance/transactions/{id}/bill` to serve
  it. Until it exists the filename is the whole record that a receipt exists,
  and the page says so rather than offering a download that would do nothing.
- `POST …/{id}/bill` takes the file and enforces the same three rules the
  recording endpoint does. **A receipt attached later is not held to a lower
  standard than one attached at the time.**

**Open decisions**
⚠ **A separate `bad transaction` action was asked for and is NOT built.** The
ledger has exactly two states, `recorded` and `reversed`, and a third meaning
*this one is wrong* would be the first state on this page that is a judgement
rather than a fact — which is the one thing the module's own rule forbids.
Reverse already IS that action: it appends a counter-entry and leaves the row
as posted, and the menu item now says so in as many words — *Reverse — this row
was wrong*. If a distinct flag is genuinely wanted it needs a state, an event
type and a decision about what analytics does with it, and none of those should
be invented quietly.

**Verified**
`npx tsc -b` clean · `eslint` clean · `vite build` clean · `check:finance`
409/409 · `check:finance-render` renders every surface, with the receipt dialog
asserted to pick a file rather than take a typed name, to carry the same 5 MB
limit, and to say outright that only the receipt can change.
**An assertion was REMOVED rather than left passing.** `can()` returns false
without a session, so this harness renders every Finance page with no write
affordance at all — `hasnt(oneTxn, ">Attach a bill<")` would have passed
whether the button became a menu or was deleted outright. An assertion that
passes for the wrong reason is worse than none, because it looks like cover;
the gap is now written down where the assertion was.
**Not checked:** not opened in a browser. The menu, its disabled items and
their titles are unreachable without a session, and the receipt card is markup
only.

---
## 2026-09-02

### Other Transaction speaks Credit and Debit, and a receipt is part of recording a row

**Area:** `#/finance-transactions` · Record a transaction · the direction filter and strip
**Files:** `src/admin/views/Finance/{TxnModals,Transactions,bits,store,finance.css}.ts(x)`,
`scripts/{check-finance-ledger.cjs,fn-smoke.tsx}`

**What changed**

**THE RECEIPT IS MANDATORY, AND FIVE MEGABYTES IS ONE RULE RATHER THAN ONE
SCREEN'S RULE.** `PROOF_MAX_BYTES`, `proofTooBig` and `fileSize` sit beside
`proofAccepted` in the store, because salary payments and company transactions
both attach evidence — a cap that applied to one of them is a cap somebody
works around by using the other screen. The store refuses three ways and names
which: `bill_required`, `bill_type`, `bill_too_big`, the last one naming the
file and its size, because a refusal that does not say how far over is one
somebody just retries. The dialog uses the pay dialog's own `fin-filebox` and
disables Record until there is a file.

**WHAT THAT DOES TO THE MISSING-BILL QUEUE, stated rather than discovered.**
`missingBill` derives from `!t.bill`, so with a receipt mandatory on every
write **nothing new can ever join that queue again**. It is a backlog of the
rows that predate the rule, and `attachBill` is what empties it. An assertion
pins exactly that: a large row under a bill-required tag is accepted and does
not join the queue.

**`out` and `in` became Credit and Debit everywhere a person reads them** — the
record dialog, the direction filter, the strip, and the `Dir` chip on every
row. They are the bank statement's words, which is what these rows are
reconciled against; `Out` and `In` were a second vocabulary for the same fact,
and somebody matching a row to a statement had to translate. **The stored value
is untouched:** the ledger still holds `out` and `in`, the option values still
carry them, and so does the CSS class.

**Credit is offered first** — in the dialog, the filter and the strip, one
ordering across the section so nobody re-reads the list each time. The dialog's
**default is still Debit**, because most company rows are money out: a default
is about the common case and the list order is about reading, and they are
allowed to disagree.

**A live Dr/Cr read-out shipped one build ago and is deleted.** It drew the row
as double entry — Dr the expense, Cr the bank — which is correct bookkeeping
and contradicted the words above it the moment Direction started saying Credit
and Debit. Those two labels are the STATEMENT's convention, where a credit is
money arriving; double entry uses the same two words the other way round. Both
are right and they cannot share a dialog: one screen with two meanings of
*Credit* is how somebody files a refund as a cost.

**The description moves to the bottom and becomes a textarea.** It sat in the
middle of the form as a one-line input, which made the field that has to make
sense to a stranger at audit look like the same size of answer as Mode or
Reference — and a single line quietly asks for three words. It is the only OPEN
question on the dialog; everything above it is a choice from a list, an amount,
a date or a file, and an open question belongs after the closed ones with room
to answer. **No new field was added for it:** a separate `remark` was started and
backed out, because a second free-text box beside a description is two places to
write the same sentence and no rule for which.

**Temp data**
`none`. The seeded rows keep the bills they have and the ones they lack — the
rule is about new writes, and rewriting history to satisfy it would have
emptied the queue the rule is designed to stop refilling.

**Backend needed**
- `POST /admin/finance/transactions` takes the bill with the row and rejects
  without one (`422 bill_required`), on a non-image/PDF (`bill_type`) and over
  5 MB (`bill_too_big`). **Enforce the size server-side too:** the dialog's
  check is a courtesy, and `bytes` can be absent — a browser may omit it, and
  the client accepts that rather than refusing a real file.
- No change to `TxnDirection`. `out` and `in` are still the wire values.

**Open decisions**
`none`.

**Verified**
`npx tsc -b` clean · `eslint` clean · `vite build` clean · **`check:finance`
409/409**, up from 402: the receipt rule asserted all three ways it refuses,
plus the two edges that matter — **exactly** 5 MB is accepted, because a cap is
a limit and not a margin, and a file with no `bytes` is accepted, because a
browser can omit it. `check:finance-render` renders every surface; the modal is
asserted to say Credit and Debit and **not** to say money out or money in, to
list Credit first, and to keep Debit selected.
**Not checked:** not opened in a browser. The file picker cannot be exercised
by a static render — the refusals are asserted through the store, and the
`fin-filebox` states are markup only.

---
## 2026-09-02

### The charts answer a hover, and their tooltips get out of the card

**Area:** every chart in the panel · `#/finance?tab=analytics` hardest hit
**Files:** `src/admin/views/{charts.css,Finance/finance.css}`,
`scripts/{fn-smoke,um-smoke}.tsx`

**What changed**

**A card clipped the tooltips.** `.card` sets `overflow: hidden` so its
rounded corners hold, and a chart's tooltip is a child that has to leave: it
sits above the mark it describes, which for the topmost bar and the tallest
column is above the card's own edge. Clipped, hovering a chart showed half a
tooltip or none — the chart read as though hover did nothing. Only the blocks
that actually hold a chart stop clipping (`.fin-block:has(.ch-chart)`); a
block holding a table still needs the corner, because a row's hover tint runs
to the very edge and would square it off.

**Hover now reads as hover.** The tooltip was the only feedback a mark gave,
so until it resolved the chart was inert under the pointer — and nothing said
WHICH band the tooltip belonged to. The hovered column band and the hovered
bar row light instead, on the panel's own hover token. A bar row lights only
when it actually carries a tooltip (`[tabindex]`), so a row with nothing to
say does not promise something and then withhold it.

**Both are pinned by reading the stylesheet**, the way the chart-mark and
table-cell guards already are: no static render can see a clipped tooltip or
a missing hover, because the markup was right the whole time.

**And one stale assertion of my own, fixed.** The Users suite had been failing
since the record-header rollout: it asserted Back was labelled `All users` /
`Analytics`, which the panel-wide pattern deliberately changed to one plain
`Back`. It now asserts what a static render can honestly see — the control is
there and is the row's one primary — because the destination rides on an
onClick, and reading the label was the old assertion pretending otherwise.

**Temp data**
`none`.

**Backend needed**
`none`.

**Open decisions**
`none`.

---

### Subscriptions ▸ Analytics gets a year, and loses its captions

**Area:** `#/finance?tab=analytics` · `?year=`
**Files:** `src/admin/views/Finance/{SubAnalytics,Subscriptions,store}.tsx(ts)`,
`scripts/fn-smoke.tsx`

**What changed**

**The year is the scope, and it is the only control on the tab.** A `Year`
dropdown replaces the sentence that stood there — *Every subscription ever
recorded · all time, not August 2026* — because a control that always carries
a value says the same thing and can change it, which a sentence cannot.
`All time` leads it as a real answer rather than a blank meaning "not
filtering", and the years come off the records, so one nothing was sold in is
never offered.

**It scopes by the year a subscription STARTED in** — the same date the list's
own filter narrows on, so `2026` means one thing on both tabs. Every figure,
every chart and the block titles follow it, **including when the money
arrived**: a 2026 sale keeps its collections in 2026's reading even if an
installment lands in January. Scoping the money by its own value date instead
would have put two meanings of `2026` on one page.

**The month chart is now computed from these subscriptions' own payments**
rather than the module-wide month series — with the page scoped to a year of
sales, a chart reading a different set of payments would print a total none
of the figures above it agree with.

**Every caption came off.** Each block carried a paragraph under it explaining
the chart above; they were the widest text on the page, read once and never
again. What is left is a title, the marks and the axis unit — every rule they
carried is either in the title, behind the `i` on the figure it governs, or
was never load-bearing. The two that were load-bearing (due is the absence of
an event; the axis is in thousands) moved into a code comment and the unit
caption respectively.

**Temp data**
`none`.

**Backend needed**
`none`.

**Open decisions**
`none`.

---

### The subscriptions money becomes a strip, and the header carries the totals

**Area:** `#/finance` · the topbar
**Files:** `src/admin/views/Finance/{Subscriptions,index,store}.tsx(ts)`,
`scripts/fn-smoke.tsx`

**What changed**

**Three money tiles became one strip row** — a count, its label, the money it
stands for: `6 Collected · August 2026 ₹6,77,320 | 3 Expected installments
₹8,26,000 | 2 Fail to pay ₹3,36,300`. It is the same `StatStrip` every other
list in the panel carries, and it replaces three tiles that said the same
three things at four times the height and matched nothing else in the module.

**The cell is the filter now**, which is what cost the `i` buttons: a tile
could carry one beside its label because it was a div, and a cell is a button
— an `i` inside it would swallow half its own click target. The definitions
moved to `tip`, the strip's own description channel, which is how Salaries
A/C already carries the same cautions on the same control. Each cell toggles:
the one already applied points at the list without it.

**The header carries the totals, the way Salaries A/C does.** `Active
subscriptions` · `Total collection` · `Total outstanding` — all time, where
the strip below is one period, and the labels say which. All three come from
one new `subTotals()` selector that the topbar, the strip's neighbours and
the Analytics tab all read, because summing the same figures in three files
is how one word ends up over three different numbers.

**The harness caught the switch honestly:** seven assertions pinning the old
tile anatomy failed and were rewritten against the new one — the cell is a
link, the caution is a description, no tile is left on the list.

**Temp data**
`none`.

**Backend needed**
`none`.

**Open decisions**
The Analytics tab keeps full `i` buttons on its four tiles: they are divs
there, nothing on that tab filters, and the formulas are longer than a
tooltip should hold.

---

### Subscriptions can be filtered by when they started

**Area:** `#/finance` · `?started=`
**Files:** `src/admin/views/Finance/{Subscriptions,store,finance.css}.tsx(ts,css)`,
`scripts/fn-smoke.tsx`

**What changed**

**One filter, three grains, and the value says which:** `2026` is a year,
`2026-08` a month, `2026-08-21` a day. Each is a prefix of the ISO start
date, so one comparison answers all three — there is no second field that
could disagree with the first about what is being narrowed, and the chip
prints the value at its own grain (`2026`, `Aug 2026`, `21 Aug 2026`).

**Two controls, because they are two ways of saying one thing.** A `Started`
dropdown carries the years and, indented under each, its months — built from
the records themselves, so it can never offer a month nothing was sold in —
and a day picker beside it names one exact day. Both write the same param;
whichever grain is in play, the other control shows empty rather than a
half-truth.

**The day picker is a calendar icon at rest.** A bare `<input type="date">`
prints `dd-mm-yyyy` when it is empty — a placeholder pretending to be a
value, and the widest thing in a row of controls that each say one word. So
it is one icon until a day is picked, the day itself once one is (`21 Aug
2026`), and an ✕ to let go of it; it wears the same brand tint every applied
filter in the row wears. **The native input is still the control**, laid
transparent over the icon rather than replaced by a calendar of our own — the
platform's picker, keyboard, locale and accessibility come free, and a
hand-rolled month grid would be a second date picker in a panel that would
then have two. (`calendar` joins the icon set; the panel had none.)

**It filters on the START DATE**, which is the date this list is about: when
the customer became entitled. A payment's value date belongs to the
installment it settled, and filtering the sale by it would answer a
different question.

**Verified as narrowing, not just as rendering.** The harness counts rows and
asserts year ⊇ month ⊇ day ⊆ the whole list, so a filter that silently
matched everything would fail rather than pass.

**Temp data**
`none`.

**Backend needed**
`none`.

**Open decisions**
`none`.

---

### Subscriptions grows a tab band and an Analytics tab

**Area:** `#/finance` · `?tab=analytics`
**Files:** `src/admin/views/Finance/{Subscriptions,SubAnalytics}.tsx`,
`scripts/fn-smoke.tsx`

**What changed**

**The page takes the shape Salaries A/C already has:** a tab band above the
command row — **Subscriptions** (badged with the record count) and
**Analytics** — then the filters, then the money strip, then the table. The
list tab is unchanged; it lands by default and carries no `?tab=`. Switching
tabs drops the list's filters rather than carrying them onto a page that
shows no control to clear them.

**Analytics reads the subscriptions and nothing else, beside the records it
derives from** — the move payroll analytics made when it left the Analytics
section for Salaries A/C. It is **all time** where the list is one period,
and says so in the command row instead of offering filters: a chart narrowed
by a search box is a chart whose total no longer matches its own caption.

Four figures, then four charts, one cut each — a month, a plan, a channel and
an installment state are four ways of cutting the same rupees, so they never
share an axis:

| | |
|---|---|
| **Expected collection / Collected / Expected installments / Fail installments** | the strip, in the list tab's own anatomy — label and `i`, the figure, a second figure of a different kind beside it, then what it counts and an offer to show it. Each carries its own definition behind the `i`, written out rather than borrowed from the list's period tiles, so "collected" cannot mean two things. `show only these` crosses to the Subscriptions tab with that queue applied: the charts are never narrowed, so narrowing happens where it means something |
| **Collected, month by month** | one series, dated by the value date; months with nothing collected are absent, not drawn as zeros |
| **Which plans are selling** | horizontal bars, ordered by money and grouped on the plan's **id**, so renaming a plan does not split it in two |
| **Where the sales came from** | the channel split, count leading and money as the label beside it |
| **Every installment, by state** | the module's real workload — paid `ok`, failed `bad`, **due and cancelled neutral**, because due is the absence of an event and a warning colour would claim something happened |

Drawn with the panel's own chart kit (`ColumnChart`, `BarRows`), whose
palette was validated when it was written and whose slots are assigned in
fixed order — no second chart library, no new colours. Every amount is
integer paise printed by `inr()`; the only division is the named `thousands`
scaler feeding the axis, and nothing it returns is ever printed as money.

**The harness caught one real thing:** the first draft of the installment
caption said "nothing here is awaiting verification", and the module-wide
rule bans that vocabulary *even in a denial*. It now says nothing waits on
anybody's approval.

**Temp data**
`none`.

**Backend needed**
`none`.

**Open decisions**
`none`.

---

### Record the payment: the invoice answers everything but the date

**Area:** Finance · Subscriptions · the Record the payment dialog
**Files:** `src/admin/views/Finance/{SubModals,store}.tsx(ts)`, `scripts/fn-smoke.tsx`

**What changed**

**The business's invoices are a dropdown, and the right one is already
chosen.** Every uncarried invoice of this customer's is listed by number,
amount and date, newest first, with the newest that fits this installment
selected on opening — the document is picked, never hunted for. The ones the
write would refuse (raised for a different figure than this installment) are
listed **disabled**, with what they are for beside them: an invoice missing
from a list is a question, an invoice greyed out with its amount is an
answer. `No invoice — the receipt will cite none` stays as a deliberate
choice, and picking it says in the warning what the customer's receipt will
then be missing.

**Four fields came off, and the document answers all four.** The read-only
Amount box repeated the invoice total and could never be filled in. Mode,
Reference / UTR and Credited to were retyped facts about money that arrived
against a document already on screen. What is left is the one thing the
invoice cannot know: **when the bank credited it**.

**They are derived in the store, not dropped.** `RecordPaymentInput` makes
mode, reference and accountId optional; the write reads the reference off
the invoice the receipt will cite — unique by construction, since one
invoice bills one installment, and the string somebody hunting this money
would search — falling back to `SUB-0102/3` when there is no invoice at all,
so nothing ever dangles. The account is the ledger's default bank account,
the mode the module's first. Every guard that mattered still runs: duplicate
reference, future value date, unknown account, and the whole attach block.

**Temp data**
`none`.

**Backend needed**
`none`.

**Open decisions**
The Record a subscription dialog's *Paid so far* block still asks for the
transfer's mode, account and reference — it covers up to five installments
in one write, where a single derived reference could not name each part.
Left as it is deliberately, not overlooked.

---

### Record a subscription: one pick fills the form

**Area:** Finance · Subscriptions · the Record a subscription dialog
**Files:** `src/admin/views/Finance/SubModals.tsx`, `scripts/fn-smoke.tsx`;
`SubSamples.tsx` deleted

**What changed**

**Picking the business fills the form.** The newest open quotation attaches
at once — and with it the plan, the term, the installment count and the
chain's invoice — so the common case is one pick and one press. Nothing is
newly locked: every block keeps its Change link, so a different quotation or
invoice stays one press away. With no chain, a lone attachable invoice
attaches itself for the same reason.

**The Sample & use cases tab is gone,** four edits and a file, exactly as
`SubSamples.tsx` prescribed for its own removal; the dialog opens straight
onto the form and the smoke assertions moved with it.

**The chain is mandatory now.** Only a business with an accepted quotation
and its raised invoice appears in the picker at all — a sale the write would
refuse is not offered. The catalogue plan picker, the manual plan/term
fallback and the Sales/Website channel question went with the manual path:
plan, term, amount and installments are read from the documents, the invoice
block is a read-out (the chain's invoice is not a choice), and a chained
sale is a sales sale by definition. What stays editable: the payment plan
(1st installment / complete payment), the start date, and a new **Remark**
field whose words land on the SUBSCRIPTION_RECORDED event.

**The team says which installments are already paid.** The schedule itself
is never re-split — it is what the documents agreed, shown as a read-out —
and the new **Paid so far** field carries the choice: *Nothing yet*, *1st
installment paid*, *First 2 installments paid*, … or *Complete payment — all
N paid*. The covered rows are written paid in the same write, each with its
own payment row and receipt, exactly the shape the one-by-one write leaves;
the rest stay due and are collected one at a time on the subscription. One
transfer's facts back them — mode, account, reference/UTR, value date, asked
once and validated before anything is written — and a multi-row transfer
carries its reference as `REF/1`, `REF/2` so every payment still names its
part. The schedule preview marks the covered rows **paid** instead of dated,
and the toast says how many of how many were collected and when the next
falls due.

**And the dialog took the pay dialog's economy:** the standing fieldset
hints and field captions came off (a hint survives only when it names THIS
record — "From IB-QT-…"), the source picker's two explainers went, the
chain block's fine print went, and the closing notice is one sentence. The
conditional warnings — catalogue/invoice disagreement, quotation/billed
mismatch, nothing to attach — all stay: they appear because something is
true of this sale.

**Temp data**
`none` — the sample tab's removal deletes proto-only scaffolding.

**Backend needed**
`none`.

**Open decisions**
`scripts/check-finance-ledger.cjs` crashes on this branch before and after
this change (a `sumBy` over an undefined list at line 433) — pre-existing,
noted here so it is not read as this entry's doing.

---

### The record-header and topbar pattern goes panel-wide

**Area:** every module's record pages and topbar
**Files:** `src/admin/ui/{index,menu}.tsx`, `src/styles/admin-theme.css`,
`src/admin/views/{Users,BusinessEnquiries,Quotations,Invoices,Plans,Team,Deals}/…`

**What changed**

**Finance's record-header pattern became the panel's.** Two primitives were
promoted out of the Finance module: `MoreMenu` (`ui/menu.tsx`, `.ib-menu-pop`
— the popover with the theme's own `.mi` rows) and the thin `.vsep` rule. A
record header now reads: the id or name leads, the rule sets the status pills
off it, and the right side closes with More and a primary-green Back —
anything past two controls collapses behind More.

Applied to: **Users** Detail (rule after the name; Back turns primary),
**BusinessEnquiries** Detail (rule after the id; the kebab becomes a text
More button; "All enquiries" becomes the primary Back), **Quotations** Detail
(Edit / Preview & issue / View document / Revise fold into the More menu the
verdicts already lived in; a primary Back to the list appears where there was
none), **Invoices** Detail (same fold), and the shared **DocPage** (kebab →
More, Back primary and last). Builders and pick-deal steps keep their own
flow controls; drawers (Deals, Plans, Roles, Team) keep their close ✕ — a
drawer is an overlay, not a page.

**Every module's topbar title is the way up now** via the shared `TbTitle`:
Quotations, Invoices, Plans, Attendance, Work, Reports, Deals, Business
Enquiries, and Users — where it also names the face (Users Management /
Analytics), the move Finance's section title made first. Pressing the title
returns to that module's default view; the generic Crumbs fallback already
did this for Roles, Team and Audit.

**Temp data**
`none`.

**Backend needed**
`none`.

**Open decisions**
`none`.

---

## 2026-09-02

### The payslip page sheds its chrome

**Area:** `#/finance-salaries/SLIP-…` (the payslip document)
**Files:** `src/admin/views/Finance/Slip.tsx`

**What changed**

**The action row above the slip is down to what acts on the slip.** The proto
banner, the back-to-account button and the run-state pill are gone; the row now
carries only a `Draft` pill when the slip is one, then Download and one primary
action, right-aligned by the existing spacer. The document below is untouched.

**The primary action depends on where the slip stands.** A paid slip offers
**Share** (the renamed Send to member, same toast — no mail transport is wired).
A draft offers **Pay** instead, which opens the same `PaySalaryModal` the
Salaries list uses, resolved through `useSalaryAccount` off the slip's own
`salaryAccountId` — one pay dialog in the module, not two.

**The draft stamp on the document says `Draft`,** not the full sentence about
slip numbers; the terms block at the foot already explains what a draft is.
The `Draft` pill in the action row went too — the stamp on the document is the
one place the state is written now.

**GSTIN left the letterhead.** A payslip is not a tax invoice; the company
block carries name, address and CIN.

**A plain `Back` button closes the row,** going to Salaries A/C with the
carried filters — the same target the empty state uses.

**Download and Pay/Share moved behind a `More` menu.** A plain button in the
Back button's own theme, opening the module's `fin-menu` popover — the same
shell and `.mi` rows the transactions table's dots menu uses. Download still
prints (the print stylesheet is the one definition of the slip on paper); a
draft's menu offers Pay, a paid slip's offers Share. `More` is text-only —
the icons stay on the menu's rows, where they carry meaning; `Back` keeps its
chevron, the panel's usual sign for *this button navigates*.

**The pay dialog's commit button reads `Record payment`,** without the
`Super Admin` role pill it wore — the dialog's own notice already says who can
press it, and a badge inside the primary button crowded the words that matter.

**The pay dialog's form went line by line.** Payment via, Paid from and
Receipt stack in one column (`.fin-stack`) instead of the two-up grid, each
field answered before the eye moves down. **The receipt picker is drawn as the
field it sits among** — the input's own height, border and radius, the whole
box the button, the filename its value with a quiet `Replace` affordance once
attached. The "nothing attached yet" and "Image or PDF." captions are gone
(the error still names the accepted types when a wrong file is picked), as are
the `Optional.` hints on Adjustments and Remark — an unstarred field in this
panel is optional by convention. The remark now stands off the Adjustments
fieldset by the form's own beat.

**The slip's state reads as plain text on the document and a pill in the
row.** The dashed `DRAFT` stamp on the letterhead became the word `Draft`,
set like the paid slip's "Issued …" line; the action row gained a status pill
— `Draft` (warn) or `Paid` (ok) — before the More button, separated from the
actions by a thin rule. The pill takes a control's height, radius and type
size so the row reads as one line of equals, and the separator is a drawn
1px rule, centred, rather than a `|` glyph sitting on the text baseline.
`Back` wears the panel's primary green — the row's one filled control. The
row then settled into left and right halves: the slip's own number leads on
the left with the status pill beside it (the rule between them), and the
right keeps only the actions — More, then Back.

**The salary-account dialog took the pay dialog's layout.** Both fieldsets
went from the two-up grid to the one-per-line `.fin-stack`; the Department and
UAN captions and the revision read-out's fine print came off (the notices that
appear when something is true of THIS account stay); the opening sub is one
sentence.

**The Department read-out then left the salary-account dialog entirely.**
Picking the member fetches it with the name, designation and code, and it
still goes on the record from there — the field showed a value nobody could
act on here.

**The slip's row pattern became the record pages' pattern.** `MoreMenu` moved
into Frame as the module's one popover menu, `Rec` draws the id, a thin rule
and the status pills on the left with the actions and a primary-green Back on
the right, and a record whose right side would hold more than two controls
passes `menu` items instead — the salary account's Revise and Close now sit
behind More, exactly like the slip's Download and Pay.

**The topbar's Back button is gone; the module title is the way up.** Back
first stopped retracing session history and went straight to the module's
default view — and then the button itself came off, because the title beside
it already names that destination. Pressing the title (`Finance`, or any
module's, on a deep screen) returns to the module's default view; the
browser's own Back still owns the history. **And the Finance title names the
section, not the umbrella:** `Salaries A/C`, `Subscriptions`, `Other
Transaction`, `Refunds` or `Analytics` from the module's own vocabulary —
"Finance" over all five named none of them.

**And then every Finance dialog followed.** The `.fin-f2` two-up grid is
retired: the expense, tag, record-subscription and record-installment dialogs
lay their fields one per line in `.fin-stack`, and a module-wide rule gives
bare fields the same beat, so the dialogs that never used a grid (hold, budget,
refunds) pick the rhythm up for free. Captions that carry a real constraint
stay; the tag budget's `Optional.` prefix and the expense Party caption went.

**The document breathes more.** The slip's base line-height went from the
dense-UI 18px to 24px, the company block from 18px to 20px — a payslip is
read line by line, not scanned like a table.

**Temp data**
`none`.

**Backend needed**
`none`.

**Open decisions**
`none`.

---

## 2026-09-01

### Both payroll controls become dropdowns

**Area:** `#/finance-salaries?tab=analytics` · `?year=` · `?by=`
**Files:** `src/admin/views/Finance/{Payroll,finance.css}.tsx(x)`, `scripts/fn-smoke.tsx`

**What changed**

**The year switcher and the grouping switch were segmented button strips and
are dropdowns now.** The year strip grows an entry every January, and the
grouping strip carried three labels long enough that it wrapped inside the
block header at ordinary widths — a control that reflows as the page narrows is
a control somebody has to hunt for.

**NEITHER USES THE PANEL'S `Select`, and the reason is worth writing down.**
`Select` renders a blank first option carrying the label, because it is built
for FILTERS, where empty means *not filtering*. Neither of these is a filter: a
year is always some year and a grouping is always some grouping. A blank entry
would be one that either does nothing or silently means the default, and both
readings are worse than not offering it. So the label sits outside the control
and the list holds only real choices — same `.selectbox` chrome, so it still
looks like every other dropdown in the panel.

It is **controlled** rather than `defaultValue`, unlike `Select`, because the
URL decides what is drawn: an uncontrolled dropdown can sit showing a value the
chart underneath it is not using.

**And plain, not brand-tinted.** They first shipped wearing `.selectbox.on`,
which is the panel's *this filter is active* state — green, so somebody can see
at a glance which controls are narrowing a list. Neither of these narrows
anything, so both were permanently green: **a signal that never varies is not a
signal**, and it made two ordinary dropdowns read as applied filters somebody
ought to clear. They are ordinary `.selectbox` controls now, on the panel's own
white, with the value in medium weight because the value is the thing being
read and the label beside it already says which is which.

**A single-year dropdown is not offered at all.** With one year in the records
there is no choice to make, and a dropdown with one option is a control that
looks like it does something and does not — it stays a plain read-out.

**`person` became `member`**, in the label, the option and the `?by=` value.
The account this cut counts belongs to a team member, and that is the word the
rest of the panel uses for them.

**Temp data**
`none`.

**Backend needed**
`none`.

**Open decisions**
`none`.

**Verified**
`npx tsc -b` clean · `eslint` clean · `vite build` clean · `check:finance`
401/401 · `check:finance-render` renders every surface. Five new assertions on
the controls, and two of them assert an ABSENCE, which is the half that rots
otherwise: **`hasnt(pay, "fin-seg")`** proves no segmented strip is left rather
than only that a dropdown was added, and **`hasnt(pay, "selectbox on")`** proves
the active-filter tint has not crept back onto a control that filters nothing. All three groupings were
rendered and their bars counted: 9, 11 and 19 columns with height.
**Not checked:** not opened in a browser. Two dropdowns now sit where two
button strips did — one in the command row, one in a block header — and neither
has been seen at a narrow width.

---

## 2026-09-01

### One unbounded cell was taking the slips table

**Area:** `#/finance-salaries` → Transactions · `#/finance-transactions`
**Files:** `src/admin/views/Finance/{SalaryTransactions,Transactions,finance.css}.tsx(x)`,
`scripts/fn-smoke.tsx`

**What changed**

**A HELD SLIP'S REASON WAS PRINTED IN FULL INSIDE A TABLE CELL.** `.fin-tbl`
sets a min-width and no column widths, so the browser shares the space out by
content — which is fine until one cell holds a paragraph. A hold reason is
mandatory on the way in, has no length limit, and is **231 characters** in this
seed. The status column swelled to fit it, the identifier column was starved
until `SLIP-2026-08-0014` wrapped across two lines and read as two ids, the
run line under it wrapped too, and the paid-on column went with them.

Three bounded cells rather than any fight with the layout algorithm: the slip
and paid-on columns shrink to fit and never wrap (`width: 1%`, the auto-table
idiom for *as narrow as your content allows*), and the reason is clamped to two
lines with the whole of it on the cell's `title` — and printed in full on the
slip, so nothing is lost by not showing all of it in a row.

**The same fault one table over, bounded before it bit.** `Transactions` prints
`t.description` exactly as unboundedly. It is not broken today only because the
longest description in the seed is 57 characters against the hold reason's 231
— a fact about the fixture, not about the column.

**Temp data**
`none`. The seed's hold reason was left long on purpose: the row has to survive
any length a person types, and keeping the fixture short enough to fit would
have hidden the bug rather than fixed it.

**Backend needed**
`none`.

**Open decisions**
`none`.

**Verified**
`npx tsc -b` clean · `eslint` clean · `vite build` clean · `check:finance`
401/401 · `check:finance-render` renders every surface, with **ten new
assertions that read the stylesheet** rather than the markup.

That is the point worth keeping: **nothing already in the suite could have
caught this.** The markup was correct throughout — only the layout was wrong,
and `renderToStaticMarkup` has no layout. It is the second fault of that exact
shape in two days, after `.ch-col` having no fill, so the guard follows the same
pattern: assert the rule exists in the stylesheet, next to an assertion that the
class is on the element. **Proved by reverting:** removing the `line-clamp`
declaration turns the suite red, and restoring it turns it green.
**Not checked:** not opened in a browser. The clamp is `-webkit-line-clamp`,
which is what every current browser implements, but the two-line result has not
been seen at any width.

---

## 2026-09-01

### The prose comes off the payroll tab, and a headcount indicator goes on

**Area:** `#/finance-salaries?tab=analytics`
**Files:** `src/admin/views/Finance/{Payroll,payrollYear}.ts(x)`,
`src/content/finance/vocabularies.json`, `scripts/{check-finance-ledger.cjs,fn-smoke.tsx}`

**What changed**

**THE BANNER AND BOTH CARD FOOTERS ARE GONE.** The page carried a six-line
standing notice above every reading of it, and two paragraphs of caution laid
out as card footers. A footer is the worst available place for a rule: it is the
widest text on the page, it wraps against nothing, and it is read once and then
never again while the figures above it are read every day. A standing notice is
worse — a caution that appears whether or not anybody is asking is one people
learn to look past, which is worse than not writing it, because it feels like it
was communicated.

**Nothing was deleted; it moved to where it is asked for.** Every rule now sits
behind the `i` on the tile or the chart it governs — five rows on the chart tip,
switching with the grouping, covering why there are two bars, why they are
grouped rather than stacked, what an empty column means, and why three cuts
cannot share an axis. The one sentence that had to survive on its own — **this
is the calendar year and a total here will not match a filed return** — went
into the vocabulary, onto the caution of `payroll_cost`, the very total it
qualifies. The page is now a strip, a chart and a switch.

**A FIFTH TILE: On the payroll.** Every other figure on this tab is derived from
SLIPS, so opening a salary account moves none of them until a run is opened and
paid — correct for money, and no feedback at all for somebody who has just put a
person on the payroll and is looking for a sign it worked. This one counts
ACCOUNTS and is the only figure here that moves in the same read as the write.
It leads the strip for that reason, and carries the forward monthly commitment
beside it: what a run opened today would cost, stated as a commitment and part
of no total on the page.

**Temp data**
`none` new. `vocabularies.json` gains `payroll_headcount`, and the `payroll_cost`
caution is rewritten to carry the window caveat the banner used to.

**Backend needed**
`none` — the count is over salary accounts the module already reads.

**Open decisions**
`none`.

**Verified**
`npx tsc -b` clean · `eslint` clean · `vite build` clean · **`check:finance`
401/401**, up from 391: ten new assertions over the indicator, and they are as
much about what does NOT move as what does. Opening an account raises the count,
the year-joined count and the monthly commitment by exactly the right amounts,
**while the gross, paid and incentive totals for the year stay put** — which is
the whole reason a slip-derived figure could not have been the indicator.
`check:finance-render` renders every surface: the page has **zero card footers**
and **zero notices**, six `i` controls and five tiles. The window caveat is now
asserted out of the vocabulary rather than the markup — an `InfoTip` renders its
panel only when opened, so a caution behind one is invisible to a static render,
and asserting it where it lives is the only way it stays true.
**Not checked:** not opened in a browser. Five tiles wrap where four did not,
and the chart tip is a five-row panel that has never been opened at any width.

---

## 2026-09-01

### The three payroll charts become one, with a grouping switch

**Area:** `#/finance-salaries?tab=analytics` · `?by=month|department|person`
**Files:** `src/admin/views/Finance/{Payroll,Salaries,finance.css}.tsx(x)`, `scripts/fn-smoke.tsx`

**What changed**

**Three stacked chart blocks became one block with a switch.** The page was a
strip of four totals and then the year, then departments, then people — three
cards of the same height doing the same job, which reads as a lot more page than
it is.

**THEY COULD NOT SHARE AN AXIS, and that is worth writing down because it is the
reason this is a switch rather than a wider chart.** A month, a department and a
person are three ways of cutting the SAME rupees: side by side on one axis every
rupee would be counted three times and the total would mean nothing. What they
can share is one block, one frame and one legend.

**The series follow the grouping**, deliberately. Paid against not-yet-paid is a
question only a MONTH can answer — a department has no due date — and it is a
NET figure, where committed-against-earned is a division of GROSS. Forcing one
pair across all three would have meant dropping the paid/unpaid reading or
drawing a net bar beside a gross one, and the second is the kind of chart whose
column heights quietly mean nothing. The legend sits directly above the marks
and changes with them, so two meanings are never on screen at once, and the
caption names the measure outright: *net paid against net owed* or *gross,
before deductions*.

`?by=` carries the grouping, guarded the way `?year=` is — an unknown value
falls back to the month cut rather than drawing an empty chart with an
empty-state that would claim nobody had been paid.

**Temp data**
`none`.

**Backend needed**
`none` — all three cuts are derived client-side from the same runs.

**Open decisions**
`none`.

**Verified**
`npx tsc -b` clean · `eslint` clean · `vite build` clean · `check:finance`
391/391 · `check:finance-render` renders every surface. The smoke gained a
counting helper it did not have: `has` proves a thing is present and `hasnt`
proves it is absent, and neither can say **one and not three** — which is the
entire claim being made here. `ok1` asserts exactly one `class="ch-chart"` on
the page, and each grouping is rendered and checked through its own URL,
including the assertion that the month-only series is NOT drawn on a department
axis.
**Not checked:** not opened in a browser. The switch sits in the block header
with a wrap rule under 720px that has not been seen at that width.

---

## 2026-09-01

### Column charts had no bars — `.ch-col` was never given a fill

**Area:** every `ColumnChart` in the panel · `#/finance-salaries?tab=analytics` ·
`#/finance-analytics` · `#/users?tab=analytics`
**Files:** `src/admin/views/charts.css`, `scripts/fn-smoke.tsx`

**What changed**

**THE BARS WERE TRANSPARENT.** `charts.css` gives a slot colour to `.sw` — the
legend swatch — and to `.fill`, which is what `BarRows` and `FunnelChart` draw
their marks with. `ColumnChart` draws its bars as `.ch-col s1`, which matched
neither, so it had **no `background` rule at all**: correct heights, correct
tooltips, correct axis, correct legend swatches, and nothing visible above the
baseline. Six charts across Finance and Users, since the kit was written.

The fix is one selector added to each of the three slot rules. The intent was
never in doubt — the `forced-colors` block at the foot of the same file already
lists `.ch-col` beside `.fill` as a mark that needs a visible border.

**WHY NOTHING CAUGHT IT, which is the more useful half.** `check:finance-render`
asserts against `renderToStaticMarkup` with the CSS bundled as `empty`, so every
assertion in it would pass just as happily against a chart drawn entirely in
invisible spans. It was found by rendering the page and reading the actual bar
heights out of the markup — 56 columns, 39 with height, tallest 87.5% — and then
asking why a chart with 39 sized bars looked empty.

`fn-smoke` now **reads the stylesheet**: for every class the kit puts on a mark
(`.ch-col`, `.fill`, `.sw`) in every slot there must be a rule giving it a
background, and the slot palette must exist. Removing the fix turns the suite red
on three assertions, which is how it was verified.

**Temp data**
`none`.

**Backend needed**
`none`.

**Open decisions**
`none`. The nine mark assertions are a floor, not a design: they catch a mark
with no fill and cannot catch one whose fill is the wrong colour, which still
needs somebody to look at it.

**Verified**
`npx tsc -b` clean · `eslint` clean · `vite build` clean · `check:finance`
391/391 · `check:finance-render` renders every surface and now paints them ·
both Users suites and both Team suites pass. **Proved by reverting:** with the
selector removed the suite fails on `.ch-col.s1`, `.s2` and `.s3`, and passes
again when it is restored.
**Not checked:** still not opened in a browser. The bars now have a background
and a colour; that it is the RIGHT colour against this theme is not something
either the render check or the stylesheet check can tell.

---

## 2026-09-01

### The payslip stops disagreeing with the bank, and three other salary-flow faults

**Area:** `#/finance-salaries/SLIP-…` · the account record · Add a salary account
**Files:** `src/admin/views/Finance/{Slip,SalaryDetail,SalaryModals,finance.css}.tsx(x)`,
`src/content/finance/{salaries,vocabularies}.json`, `src/content/team/members.json`,
`scripts/{check-finance-ledger.cjs,fn-smoke.tsx}`

**What changed**

**A PAYSLIP PRINTED LESS THAN THE MONEY THAT MOVED.** `Slip.tsx` computed
`gross` as `Σ earnings`, which stopped being the whole story the moment
incentives became their own array — so a slip carrying one showed a gross short
by the incentive and therefore **a net lower than the transfer**. Anjali's July
slip read ₹1,20,000 against ₹1,61,000 actually paid. Gross is
`Σ earnings + Σ incentives` now, the incentive prints as its own line marked
**earned**, and the terms say what an incentive is: paid for this month, not
payable again unless earned again, and not reduced by loss of pay.

**The terms claimed a thirty-day month this module has never computed.** Loss of
pay divides by `daysInMonth`, the type says so, and a check asserts it — while
the one document somebody recalculates by hand told them to use thirty. It now
states the month's real length: *29 paid days of 31*.

**One arithmetic for loss of pay, where there were two.** The seeded July slip
pro-rated Provident fund; `setLop` leaves every deduction alone. A loss-of-pay
slip therefore meant different things depending on whether a person or the
fixture had produced it. **The code's rule won** — deductions are typed on the
account and this module does not decide which of them are proportional, which is
the same refusal it makes about deriving a department from a designation. The
seed obeys it now, and what that costs in law is written down rather than
quietly computed: FN-OD-16.

**The receipt existed and was never once shown.** `paySalary` refuses a payment
without one — it is the only evidence a salary payment has, since the typed bank
reference was deleted for being a UTR nobody checked — and then wrote the
filename to a slip that rendered it nowhere. It is on the slip now beside how the
money moved, `via` prints as the words somebody chose rather than the ledger's
`NEFT`, and the account's **Reference** column, which was blank on every
UI-paid slip, is **Evidenced by**: the receipt, or the old reference, or the
absence named. The remark is shown too, in its own element rather than run into
the standing terms.

**Department came off the Add-a-salary-account dialog** and onto the team member,
where a person's department belongs. It was a typed box with a datalist of
whatever had been typed before — a memory of past spellings, not a taxonomy: the
first person to type "sales" made it an option for everybody after them. It now
comes off the picked member with the name, the designation and the code, and is
shown read-only so nobody is surprised by it in a chart three months later. On a
revision the account keeps the one it has, because revising a salary is not how
somebody changes department.

**Temp data**
`src/content/team/members.json` → **new `department` on every member**, typed
against the real roster by designation. Design has nobody, because Team has no
designer and inventing one to fill a bar Finance already draws would be a
fixture lying to make a chart look complete.
`salaries.json` → the July loss-of-pay slip's deductions are flat, and the
`LOP_APPLIED` note rewritten to say why.
`vocabularies.json` → `FN-OD-16`.

**Backend needed**
- `AdminUserRow.department` on `GET /admin/team/members` — a typed string, blank
  legal. **The server must not derive it from a designation:** an Operations
  Manager and an Operations Executive share a department, a Sales Head and a
  Finance Admin do not, and no rule over job titles gets that right.
- `SalaryAccount.department` stays on the payload and is set from the member at
  open. Finance no longer accepts it as typed input.
- No change to the slip payload: `incentives[]` and `incentivePaise` were added
  in the entry above this one.

**Open decisions**
⚠ **FN-OD-16 · Deductions are flat, and statutory PF is not.** Loss of pay
pro-rates earnings and leaves every deduction alone. In law employee PF is 12%
of basic and falls with a pro-rated basic, so a loss-of-pay slip overstates PF
and understates net. Fixing it means marking a component proportional or flat
when it is typed — a schema decision and a payroll-policy one, not a rendering
fix. Stated rather than guessed at.

**Verified**
`npx tsc -b` clean · `eslint` clean on every changed file (the repo's 255
pre-existing problems are unchanged, and none is in Finance) · `vite build`
clean · **`check:finance` 389/389**: the seeded loss-of-pay slip is
asserted to leave its deductions alone exactly as `setLop` does, and the member
picker is asserted to carry a department that is the member's own value and
**not** derivable from their designation — two people sharing one title share a
department, a Finance Admin and a Sales Head do not.
`check:finance-render` renders every surface, with **11 new assertions over the
printed document** — the incentive prints, it is marked earned, gross and net
both include it (₹1,61,000 and ₹1,46,500, the two needles that were the whole
bug), the thirty-day claim is gone, the real month length is stated, and the
account's slips table names what a payment is evidenced by. `check:finance-nav`,
both Users suites and both Team suites pass.
**Not checked:** not opened in a browser. Playwright is not installed in this
repo, so the new `.fin-earned` marker, the `.fin-slip-remark` block, the receipt
line and the read-only department field are verified through static render and
not by looking at them — and **the payslip's print layout is unverified**, which
matters more here than usual because two of these changes add lines to a document
whose whole purpose is to be printed.

---

### Salaries A/C gains an Analytics tab: the wage bill over a calendar year

**Area:** `#/finance-salaries?tab=analytics` · `?year=`
**Files:** `src/admin/views/Finance/{Payroll.tsx,payrollYear.ts,Salaries,Analytics,InfoTip,store,types,finance.css}`,
`src/content/finance/{salaries,vocabularies}.json`, `scripts/{finance-check-entry.ts,check-finance-ledger.cjs,fn-smoke.tsx}`, `package.json`

**What changed**

**A third tab on Salaries A/C**, beside Transactions and Accounts, **scoped to a
YEAR rather than the reporting period**: four totals and three charts.

     1  the year, month by month     what went out, and what has not
     2  by department                base salary against incentive earned
     3  by person                    the same split, everybody side by side

**IT SHIPPED WITH SIX BLOCKS AND WAS CUT TO FOUR BEFORE IT SHIPPED AGAIN.** The
first build carried an eight-column month table, a twelve-row per-person slip
table behind a picker, and six decision metrics with year-on-year arrows. In use
it was confusing, and the tables were why: they printed the same figures the
charts above them drew, so **every number appeared twice in two shapes** and a
reader had to work out which one they were meant to read. Both tables are gone
and so is the KPI block — a table is the right form for records somebody acts on
one at a time, which is precisely what the two tabs beside this one already are,
and they do it better because a row there opens the slip that produced it.
**A table on an analytics tab is a chart whose shape nobody can see.** The
per-person picker went with them: a person's own months are on their salary
account, one click away, beside each slip — this page could only restate that,
worse. What no other page can show is the whole team side by side, so that is
what it shows.

**It sits with the runs it reads, not in the Analytics section.** It was built
there first and that was the wrong address: it is the only face in the module
scoped to a whole year rather than to the reporting period, so on a page
whose other two tabs are scoped to August it would have put two windows on one
row — which is how somebody reads a yearly figure as a monthly one. Here the
year switcher owns the command row and says the scope outright, and somebody
asking what payroll cost this year no longer has to leave the payroll page to
find out. Analytics keeps Overview and KPI, and a check asserts Payroll is no
longer offered there.

The tab carries **no count badge** — the other two say how many records are
behind them, and a year is not a number of things — and **no filter strip**: every
cell in that strip filters this month's slips, and a row of live-looking controls
that narrow nothing on screen is worse than no strip at all.

**January to December**, filtered by year in the command row. It was April to
March for one build, on the argument that TDS, PF and the books all close on 31
March — that argument still holds and the page no longer makes it, because the
calendar year is what was asked for. **The consequence is stated on the page
rather than left to be discovered:** a total taken from here will *not* match a
filed return, and the two figures are close enough to be mistaken for each other
and far enough apart to matter. The helpers were renamed with the change —
`fyOf`/`fyMonths`/`fyLabel` are `yearOf`/`yearMonths`/`yearLabel`, and the query
key is `?year=` — because `fy` meaning "calendar year" is the kind of lie that
survives for years.

The year is always twelve columns: a month with no run is drawn empty and
labelled, because a run nobody opened and a month nobody was paid look identical
once a chart omits them.

**INCENTIVES BECAME A FIRST-CLASS THING.** `paySalary` already accepted one and
concatenated it onto `earnings`, which paid the right amount and destroyed the
only thing that made it an incentive: beside basic and HRA nothing downstream
could tell committed pay from earned pay. `Payslip` carries `incentives[]` and
`incentivePaise` now, held apart from `baseEarnings` **so loss of pay cannot
pro-rate it** — an incentive is paid for something achieved, and three days of
absence does not un-achieve it.

**Paid and not-yet-paid partition each month exactly**, so the pair reads against
one baseline without double-counting — and the year chart draws those two rather
than salary against incentive, which is a split of GROSS and would give a column
whose height means nothing beside a net one. A held slip counts as not-yet-paid
*here*, where the only question is whether money has left; **why** it has not is
on the slip, which is the one place somebody can act on it.

**Base salary against incentive is the shape both other charts draw**, so a
department that is almost all fixed pay and one that is a fifth incentive are
visibly different rather than two similar totals. The seed was widened for it:
Sales now runs at ~21% variable, Design ~10%, Operations ~5%, and **Leadership at
zero** — a director's remuneration is fixed by board resolution, and that
contrast is the thing the chart exists to show.

**Expenditure by department moved here from Overview** and is year-scoped. All
time was the wrong window for the only thing it is used for: it silently
rewarded whoever had been on the payroll longest, so a team hired in January read
as cheap beside one hired two years earlier. It is not duplicated — the Overview
block is gone, and a check asserts its absence.

**Temp data**
`salaries.json` → **17 new paid runs, 2025-01 to 2026-05**, so **calendar 2025 is
a complete twelve months** and 2026 runs January to August. It starts in January
rather than April for exactly that reason: a year chart whose first quarter is
empty teaches nothing about the company and everything about the fixture.

**Three more salary accounts** — Marketing, Technology and a second designer —
because the department chart had four bars of which two sat at zero incentive, so
the one thing it exists to show had two data points. Six departments now carry a
real gradient: **Leadership 0% · Technology 3% · Operations 5% · Design 6% ·
Marketing 12% · Sales 20%**, which is a chart somebody can read a decision off.
The person chart went from seven columns to ten, staggered by joining date so the
year has a shape, and a third raise (Nikhil Verma, January 2026) joins the two
already there. **One slip is held** — a campaign advance still unreconciled —
because without one the third state on the transactions strip was permanently
zero and the year chart's second series appeared in exactly one column.

**August is PART PAID** — four people settled, four owed, one held. The fixture
had the open run entirely unpaid, so the year chart drew a zero-height *Paid* bar
for the current month and the part-paid state the write path goes out of its way
to support existed in no fixture at all. Which four is not arbitrary: the three
accounts the ledger suite pays, revises and sets loss of pay on are left
outstanding, because settling one turns half a dozen behaviour tests into
"nothing outstanding" and they then fail for a reason unrelated to what they test.

158 slips, all generated deterministically from an FNV-1a hash of accountId +
month, so re-running produces identical output and no figure was hand-picked to
make a chart look good. The whole seed rebuilds from HEAD in one pass.

**Two faults the charts exposed by being looked at properly.** Farhan Qureshi was
in the Design department and out of the delivery-bonus list, so the person chart
drew him as the one designer who never earned anything — a difference between two
people doing the same job that the fixture had invented by omission. And
`vocabularies.json` was missing **`SALARY_PAID`, `SALARY_HELD` and
`SALARY_RELEASED`**, three event types `paySalary` and `setSlipHold` have always
written: `EventRow` falls back to printing the raw key, so every salary payment
has been showing `SALARY_PAID` in the account timeline instead of a label, and
with no tone, so a payment read as neutral and a hold did not read as a caution.
Both surfaced from rendering the page and reading the actual bar heights out of
the markup rather than trusting that the words were present. Two
raises (Aditya Rao from October 2025, Anjali Deshpande from April 2026) join the
one already there, and they are visible **only because slips freeze**. Incentives
land on **paid slips only** — an incentive is granted when somebody is paid, not
when the run is cut — Sales monthly with about one month in six paying nothing,
Design occasionally, Leadership and Operations never.
**2024-12 and earlier deliberately have no run:** `check-finance-ledger` opens one
for a past month to test `openSalaryRun` and needs a month with no run and 31
days in it.
`vocabularies.json` → `payrollMetricDefinitions` (**4**, one per total), kept
apart from the existing lists so a payroll figure cannot appear unasked on a page
about subscriptions. `payrollKpiDefinitions` was here and is **deleted** with the
metrics block it annotated. Incentive bands were widened for legibility: a
variable share of 5–7% is a sliver beside a base-salary bar, and a chart whose
second series cannot be seen is not a chart with two series.

**Backend needed**
- `Payslip.incentives[]` and `incentivePaise` on `GET /admin/finance/salary-runs`.
  `grossPaise` INCLUDES the incentive. The server must not fold it into
  `earnings`: loss of pay pro-rates `earnings` and must never reach it.
- `GET /admin/finance/vocabularies` serves `payrollMetricDefinitions[]`.
- Everything else is derived client-side in `payrollYear.ts` from the runs
  themselves — deliberately, so no roll-up can fall out of step with the lists.

**Open decisions**
`none` new for the tab itself. The ⚠ two-fixtures-do-not-join defect is
unchanged and still pinned by its `KNOWN:` assertion.

**Verified**
`npx tsc -b` clean · `eslint` clean · `vite build` clean · **`check:finance`
389/389**, up from 369. Three of the newest came out of the held slip: it
is not DUE, so paying everybody else on the run leaves it open, and the run only
closes once the hold is released and that slip paid — which is precisely what a
hold is for, and was untested until the seed carried one.
`check:finance-render` renders every surface with the tab's four
totals and three charts, the year switcher, and an unknown `?year=` falling back to
the current year. **Four of its assertions are about what is NOT there** — not
one `.tbl`, no month table, no decision-metric block, no employee picker —
because a page cut back for legibility grows its tables again unless something
fails when it does. `check:finance-nav` and both Users and Team
suites pass. `check:finance` now bundles `scripts/finance-check-entry.ts` rather
than `store.ts` directly, so the store and the payroll derivations share ONE
snapshot — bundled separately, `resetStore()` in one would have left the other
reading stale records, and that failure would not have thrown.
**Not checked:** not opened in a browser, and this change is substantially
visual — two new column charts, two wide tables and a segmented year switcher
are verified through static render only. `check:enquiries` needs a running
backend and was not run; it is unrelated to Finance.

---

## 2026-08-31

### Cost to company is deleted, not hidden — and two layout bugs go with it

**Area:** `#/finance-salaries` → Add a salary account, and the account record
**Files:** `src/admin/views/Finance/{SalaryModals,SalaryDetail,store,types,finance.css}`,
`src/content/finance/salaries.json`, `scripts/fn-smoke.tsx`

**What changed**

**`ctcPaise` is gone from the form, the type, the store, the record and the
seed.** Removing it from the dialog alone would have left a stored figure
nobody could set, so it went the whole way.

It was worth deleting rather than hiding. It computed **nothing** — the type
said "presentational", the record page said so twice, and FN-OD-06 already
said it was not cost to company at all because employer PF and gratuity are
not modelled. The record carried two separate cautions defending it: a footer
line ("presentational, and never divided by twelve") and a whole `Notice`
explaining that CTC ÷ 12 "would produce a figure no component adds up to". **A
number that has to be defended twice on one screen is a number worth removing**,
and both cautions went with it. What governs a slip is unchanged and now needs
no argument: it is built from the typed components and nothing else.

**Two layout faults fixed while in there.**
`.fin-file` — the receipt picker in the pay dialog — **had no CSS at all**, so
the button and the filename pill were unstyled inline content. It has a rule
now, and the filename ellipsises rather than pushing the dialog sideways.
`.fin-derived` had two rules and is now a proper read-out: a field's height and
inset, no border, because it is not editable and should not invite a click.
And **"Joined" was alone in a two-column grid** once CTC left it, leaving an
empty half that reads as a field somebody forgot to render — it sits beside the
member picker now.

**Temp data**
`salaries.json` → `ctcPaise` removed from all 7 accounts, and the `$comment`
that explained how it was calculated rewritten to say why it is gone.

**Backend needed**
`SalaryAccount` drops `ctcPaise`. If an offer figure is ever wanted it belongs
to whatever owns offers, not to a payroll record that cannot compute with it.

**Open decisions**
`none` new. FN-OD-06 is unchanged and is now only stated where it can be acted
on — the `i` button on the payroll metric.

**Verified**
`npx tsc -b` clean · `eslint` clean · `vite build` clean · `check:finance`
341/341 · `check:finance-render` renders every surface. Its CTC assertion was
**rewritten rather than deleted**: it now asserts the claim that survived — the
slip is built from typed components — plus a `hasnt` proving no CTC figure is
left on the record to misread. All other suites and both Team checks pass.
**Not checked:** not opened in a browser, and this change is half CSS — the
`.fin-file` and `.fin-derived` rules are new and unseen.

---

### The salary account picks a team member instead of asking you to describe one

**Area:** `#/finance-salaries` → Add a salary account
**Files:** `src/admin/views/Finance/{SalaryModals,store,types}.ts(x)`,
`scripts/check-finance-ledger.cjs`

**What changed**

**Four fields became one choice.** Team member id, Name, Employee code and
Designation were four things somebody re-typed out of a record that already
holds them — and the id had to match **by hand**, with the help text admitting
it: *"type it wrong and this salary points at the wrong person."* The form picks
a team member now, and the four fields come off that pick. The **employee code
is derived** (`IB-EMP-041`) rather than typed, because it prints on the payslip
and two people typing their own conventions produce two formats in one payroll.

A member who already has an account is offered **greyed rather than hidden** —
somebody looking for them finds them and learns why they cannot be picked,
instead of concluding the list is broken.

**UPI id** joins the bank block, optional, because not everybody has one and a
blank field is not a missing record.

**The description came off.** Two standing hints and five field helps are gone;
the two that carried a real rule — cost-to-company is presentational, and an
account below the TDS threshold has **no** TDS line rather than a zero one —
moved behind `i` buttons, which is what `InfoTip` is for. On a revision the
member is shown read-only, because the person does not change: a wrong one is a
closed account and a new one, not an edit.

**Temp data**
`none` new. The picker reads **Team's own seed** (`src/content/team/members.json`)
— a cross-module read of the same kind as `invoices.json` and `quotations.json`,
except imported rather than copied, so there is one fixture and not two that
drift. It becomes `AdminOpsService.users()` in the commit that retires the
others.

**Backend needed**
- The picker's list is `GET /admin/team/members` — the team-wide read that does
  not exist yet, and the same blocker the Team module's Phase B carries.
- `SalaryAccount.bank.upi` on the account payload.

**Open decisions**
⚠️ **THE TWO FIXTURES DO NOT JOIN.** Finance's seven salary accounts carry
memberIds 1-9; Team's members are 41-86. They were written independently, so
`memberId` on every existing salary account resolves to **nobody** — the join
the type describes ("`memberId` joins `AdminUserRow.id`") is currently
decorative. New accounts join correctly; the historical ones do not. Fixing it
means deciding whose cast is real, which is a product question and not mine to
answer, so it is asserted instead: a check named `KNOWN:` fails the day somebody
reconciles them, which is exactly when it should be revisited.

**Verified**
`npx tsc -b` clean · `eslint` clean · `vite build` clean · **`check:finance`
341/341**, up from 334: 7 new assertions over the picker — it offers the team
and only active members, every option carries the three fields the form stopped
asking for, the code is derived and deterministic, an option knows whether that
member is taken, and the zero-join defect above is pinned. `check:finance-render`
renders every surface. All other suites and both Team checks pass.
**Not checked:** not opened in a browser. The picker's greyed-out state and the
`i` panels are verified through the store and a static render, not by clicking.

---

### The receipt replaces the reference, and the pay dialog stops explaining itself

**Area:** `#/finance-salaries` → Pay
**Files:** `src/admin/views/Finance/{SalaryModals,store,types}.ts(x)`,
`scripts/{check-finance-ledger.cjs,fn-smoke.tsx}`

**What changed**

**The bank reference field is gone.** It was a UTR typed from memory on a
screen where nothing checked it against a statement, and a reference nobody
verifies is a reference nobody should trust. **The attachment replaced it, for
every method** — the rule stopped varying by how the money moved and became one
rule: a salary payment carries a receipt, or it is not recorded. A payment with
no evidence at all is a claim, which is the one thing this module refuses to
store.

**The receipt is a real file now**, not a filename somebody types.
`<input type="file" accept="image/*,application/pdf">`, the same pattern the
Invoices proof upload already uses, with the chosen file shown as a pill and
the wrong file type refused by name. Images and PDFs, because a receipt is
either a photograph of one or a document, and a `.txt` is neither.

**Three standing notes came off the dialog.** They said the slips freeze, that
this pays one person, and that the reference ties the payment to the bank — the
first is true of every write in the module and belongs in its documentation
rather than above every button, the second is the dialog's own title, and the
third described a field that no longer exists. What is left is **conditional
only**: the Super Admin notice, which explains a disabled button, and the
arrears warning, which appears because something is true of this payment. Field
help is down to four words where it survived at all.

**Temp data**
`none`. `PaySalaryInput` loses `reference` and gains a required `proof`.

**Backend needed**
- `POST /admin/finance/salaries/{accountId}/pay` takes `{ via, accountId,
  proof, remark }` — **no reference**. The server must refuse a payment with no
  proof, and must refuse a proof that is not an image or a PDF.
- The proof is a real upload against the S3 presigned-PUT path the panel
  already has (`POST /common/get-upload-url/`), **not** a filename. ⚠️ It must
  be a PRIVATE object — every upload in that path today returns a public URL,
  and a salary receipt is the last thing that should carry one (TM-R-04 in the
  Team plan applies here word for word).

**Open decisions**
Two, both consequences of dropping the reference and both worth stating before
somebody reads them as defects:
1. **Salary payments can no longer be matched to an imported statement.** They
   never could be for cash; now they cannot be for transfers either. The
   receipt is what a person checks against the bank by eye.
2. **"Oldest first" is no longer visible on the slips.** Arrears used to carry
   `-01` and `-02` suffixes on the reference, which is what made the order
   readable on the record. With nothing to suffix, both slips take the same
   instant and the only trace is the event note — the order became a claim in a
   sentence rather than a fact on a document.

**Verified**
`npx tsc -b` clean · `eslint` clean · `vite build` clean · **`check:finance`
334/334**: the evidence section was rewritten for the new single rule — all
three methods refused without a receipt, a `.txt` refused by name, a
spreadsheet rejected and a PDF and both image types accepted, plus a paid slip
carrying **no reference at all**, its receipt, both vocabularies, its remark and
its freeze. The arrears ordering assertion was **rewritten rather than deleted**
to assert the event note, with a comment recording that the suffixes it used to
check are gone with the field. `check:finance-render` renders every surface; its
four assertions over the removed notes now assert the form instead — including
two `hasnt` checks that the reference field and its sentence are really gone.
All other suites and both Team checks pass.
**Not checked:** not opened in a browser. **The file picker is unexercised** —
the harness renders statically, so the accept filter, the pill and the
wrong-type refusal are verified in the store and not by choosing a file.

---

### How a salary was paid decides what evidence it has to carry

**Area:** `#/finance-salaries` → Pay — the transfer fieldset
**Files:** `src/admin/views/Finance/{SalaryModals,store,types}.ts(x)`,
`scripts/check-finance-ledger.cjs`

**What changed**

The dialog asked for a bank reference and nothing else, which is the wrong
question when the money went out as cash. **Payment via** is now a dropdown —
**Bank transfer · UPI · Cash** — and it decides what the form asks for next:

- **Bank transfer and UPI** keep the bank reference, mandatory as before, and
  keep the account picker.
- **Cash hides the reference entirely** and says why: there is no UTR to tie it
  to a statement. The account picker goes with it, because cash leaves the cash
  account and there is nothing to choose.

**One of the two is always required.** A transfer is tied to a statement by its
reference; cash cannot be, so the **receipt** stands in its place and is
mandatory there. A payment carrying neither is a sentence with nothing behind
it — the same rule this module applies to every other row. **A cash slip stores
an empty reference rather than an invented one**: putting `CASH-0011-08` in the
column a bank statement will never contain is worse than a blank that says so.

**Payment proof** and **Remark** are both new. The proof is a filename, the
convention `BillModal` already uses and says out loud — no upload in this
prototype, the filename is the whole record that a proof exists. The remark is
optional and deliberately load-bearing on nothing: no total reads one.

**Temp data**
`none`. `Payslip` gains three optional fields — `via`, `proof`, `remark` —
optional so the 19 seeded slips, which were paid before proofs were asked for,
stay valid rather than being back-filled with a claim nobody made.

**Backend needed**
- `POST /admin/finance/salaries/{accountId}/pay` takes `{ via, reference,
  accountId, proofFilename, remark }`. **The server must enforce the
  either/or**, not just the client: a reference for bank and UPI, a proof for
  cash, and never both absent.
- `mode` keeps the ledger's own vocabulary (NEFT/UPI/Cash); `via` is the choice
  somebody made. Two fields because they answer different questions, and the
  reconciliation matcher reads `mode`.

**Open decisions**
New: **cash payments cannot be reconciled**, by construction — there is no bank
line to match. They are recorded and they are evidenced, and the statement
import will never see them. That is correct and it is worth saying before
somebody reads a reconciliation gap as a defect.

**Verified**
`npx tsc -b` clean · `eslint` clean · `vite build` clean · **`check:finance`
330/330**, up from 318: 12 new assertions over the evidence rule — bank and UPI
both refused without a reference, the refusal naming the method, cash refused
without a receipt, **cash NOT asked for a reference it cannot have**, an unknown
method refused, and a paid cash slip carrying an empty reference, its receipt,
both vocabularies, the remark, and still its freeze. The suite's seven existing
`paySalary` call sites were migrated to the new input shape. All other suites
and both Team checks pass.
**Not checked:** not opened in a browser — the dropdown's three states are
verified through the store, not by clicking between them.

---

### Salaries A/C is one table, and salaries are paid person by person

**Area:** `#/finance-salaries` — the whole face, and the topbar above it
**Files:** `src/admin/views/Finance/{Salaries,SalaryModals,store,types,index}.ts(x)`,
`src/content/finance/salaries.json`, `scripts/{check-finance-ledger.cjs,fn-smoke.tsx}`

**What changed**

**Three tables became one.** The face carried the open run's slips, the people,
and the runs behind them — three answers to one question and three places to
look for a name. What somebody does here is pay people, so the face is now the
people and what each is owed. The Runs section and the open-run card are gone.

**The unit of payment is a person.** `Mark the run paid` is gone with them;
each row has a **Pay** button that settles that one person. This reverses an
invariant the module stated outright — *"a run half paid is not a state"* —
and it is reversed deliberately, because a run part-paid is the ordinary
mid-month reality and refusing to model it meant the screen could not show what
was happening. **What did not change is the freeze:** a slip still takes its
number, its reference and its hash in the write that pays it. The freeze moved
from the run to the slip, which is where it always belonged — a document is
frozen when it is issued, not when its neighbours are. A run now **closes
itself** once its last slip is paid; nobody marks it.

**Arrears are real and they are paid oldest first.** `dueOf()` is the one
derivation the table reads: every unpaid slip a person has, newest as "this
month" and the rest as arrears. A row owed two months shows **arrears + current
as one figure**, because that is what the transfer will be, with the breakdown
underneath so the number can be taken apart. Paying settles them oldest first —
anything else invents a preference nobody expressed and leaves the older debt
ageing while the newer one clears. Nothing is stored: an arrears field would
need a job to keep it true, and there is no queue here.

**A filter for how somebody is engaged**, permanent or payroll — a new
`engagement` field, seeded on all seven accounts, held as a vocabulary so a
third value is data. ⚠️ **The two are not a clean partition** — permanent staff
are on payroll too — and this is the business's vocabulary, not one the module
would have invented. Said in the type, so nobody later mistakes it for a
taxonomy.

**The topbar figure follows the section:** `Members` on payroll, `Active
subscriptions` elsewhere. One number either way.

**One word was overruled, and it was a guard doing its job.** The tag was going
to read *Pending*; the render suite refused it. `HELD_AS_A_STATE` bans
`pending` as the text of a status pill, because it used to mean "recorded but
not yet believed" — the exact premise this module was rebuilt to remove. Money
owed and not yet sent is a fact, so the tag says **Unpaid**, which states the
fact without implying a judgement is outstanding. The rule was not weakened.

**Temp data**
`salaries.json` → `engagement` added to all 7 accounts (4 permanent, 3 payroll).
No new records.

**Backend needed**
- `POST /admin/finance/salaries/{accountId}/pay` → **FN-T08b**, replacing the
  run-level pay. Settles every outstanding month for one person, oldest first,
  freezing each slip in the same write; closes the run when its last slip goes.
- `SalaryAccount.engagement` on the account payload.
- `recordRunPaid` (FN-T08) is **not** deleted — nothing calls it and its
  refusals are still asserted. Delete it with its assertions, or wire it to a
  "pay everybody" control if one is ever wanted.

**Open decisions**
FN-OD-06 unchanged — this is still net paid to people, not cost to company. New
and unresolved: **loss of pay lost its editor** when the open-run card went. It
belongs on the person's own record, where the figures being changed are on
screen; it is not there yet, and until it is, LOP can only be set through the
store.

**Verified**
`npx tsc -b` clean · `eslint` clean · `vite build` clean · **`check:finance`
318/318**, up from 296: 22 new assertions over the new write — every refusal
(no reference, duplicate reference, unknown account, nothing due), the slip
freezing in one write, **a run half paid being a state now**, the run closing
itself when its last slip is paid, and arrears settling oldest first with July
carrying suffix 01 and August 02. `check:finance-render` renders every surface;
its stale open-run assertion was **re-pointed rather than deleted** — the
guarantee it protected is now the table's own — and the pay dialog's assertions
moved from the run to the person. All other suites and both Team checks pass.
**Not checked:** not opened in a browser. Verified through the store, the render
harness and a production build.

---

### The Active subscriptions figure stops being a chip and becomes a figure

**Area:** `#/finance` — the topbar, every section
**Files:** `src/admin/views/Finance/{index.tsx,finance.css}`

**What changed**

`Active subscriptions 6` was a bordered pill, tinted green, carrying a status
dot, with the count inside a **second** bordered well. Four devices for one
number — and three of them (the tint, the dot, the green label) all said the
same thing, which was "fine", about a figure that is not a verdict at all.

It also broke the theme's own rule for that row, written into
`admin-theme.css` beside `.tb-stat`: *the tone is on the FIGURE, never the
label*. `.fin-scope` coloured the label, the border and the background.

It is now `.tb-stat.ro` — **the shared topbar figure Users already renders**.
Label, then count, no border, no fill, no dot, no tone. Finance and Users read
as one panel instead of two, and this module owns no styling for a row it does
not own. **39 lines of CSS deleted, 0 added.**

**Temp data**
`none`.

**Backend needed**
`none`.

**Open decisions**
`none`. If a second figure is ever wanted there it gets `.tb-sep` between them
and still no new class — stated in the comment left where the rules used to be,
because the next person's instinct will be to add one.

**Verified**
`npx tsc -b` clean · `eslint` clean · `vite build` clean · `check:finance-render`
renders every surface with no failures · all nine offline suites and both Team
checks pass. `.fin-scope` has no live rule and no live class left — the two
remaining mentions are the comments explaining why it went.
**Not checked:** not viewed in a browser. This is a markup-and-CSS change, so
the checks prove it compiles and still renders, not that it looks right — worth
a glance before you move on.

---

### A Sample tab inside the record dialog — the demo you can actually find

**Area:** `#/finance?face=subscriptions` → Record a subscription → **Sample & use cases**
**Files:** `src/admin/views/Finance/SubSamples.tsx` (new),
`src/admin/views/Finance/SubModals.tsx`, `scripts/fn-smoke.tsx`

**What changed**

The demo data existed and nothing surfaced it — you had to know which business
to pick. The dialog now has **two tabs**, and the second one is a worked example
of every case the flow supports.

It is **built from the live seed, not written beside it.** Every business name,
quotation number and amount on the tab is read from the store at render, so it
cannot drift into describing a flow the module no longer has; if a case's data
is recorded or removed, that case says so instead of lying. The two walkable
cases carry a **Use this** button that fills the Record tab in and switches to
it — which is the point of the tab, because the chain is easier to understand by
watching a quotation populate four fields than by reading that it will.

Six cases: complete payment from the chain · installments from the chain · no
quotation at all (the website path) · what a finished one looks like, linking to
both seeded demos · what gets refused and the code each refusal returns · and
the one thing that is **not** refused, a quotation whose invoices are
deliberately unequal slices of its total.

**It comes out in four edits.** The header of `SubSamples.tsx` carries the list,
and every site is tagged `SAMPLE TAB`, so `grep -rn "SAMPLE TAB" src scripts`
finds all of them. It is also **already off in a production build** —
`SAMPLES_ON` is `import.meta.env.MODE !== "prod"` — so shipping it by accident
is not the risk; leaving it in place after the flow it demonstrates has changed
is, which is why the removal list is a list and not a suggestion.

No new CSS: the tab strip is the panel's existing `Tabs` primitive and every
other class already existed.

**Temp data**
`none` — the tab adds no records. It reads the seeds added earlier today.

**Backend needed**
`none`. Delete the file at integration.

**Open decisions**
`none`.

**Verified**
`npx tsc -b` clean · `eslint` clean · **both builds run and the difference was
checked, not assumed**: `--mode dev` contains the tab; `--mode prod` does not —
`SubSamples`, "Sample &", "Complete payment, from the chain" and the rest are
all absent from the prod bundle, tree-shaken behind the constant-folded flag.
`check:finance-render` gained 2 assertions (the tab is reachable; the record tab
is the one that opens) and renders every surface. `check:finance` 296/296 and
every other suite unchanged and passing.
**Not checked:** the harness renders statically, so it proves the tab strip is
there and the Record tab is default — **it does not click through to the Sample
tab or press Use this.** Those two are unverified until somebody opens it in a
browser. The proto seeds still ship in a prod bundle, as they do for Users and
Team; that is the frontend-first arrangement and it ends when the seeds do, not
with this tab.

---

### Two chain-recorded subscriptions in the seed, so the finished shape can be read

**Area:** `#/finance?face=subscriptions` — the list, and both record screens
**Files:** `src/content/finance/{subscriptions,quotations,invoices}.json`,
`src/admin/views/Finance/SubModals.tsx`, `scripts/check-finance-ledger.cjs`

**What changed**

The chain could be walked but its output could not be looked at — every
subscription in the seed predated it. **SUB-0110 and SUB-0111 are what the
dialog produces**, already recorded, so the finished shape reads without anybody
having to record one first. Both are demos: nothing in them was typed, and every
field traces to a document.

- **SUB-0110 · complete payment.** Bhatia Ply & Hardware, Growth 3 months,
  ₹28,320, from `IB-QT-2026-00160` on `DL-2481`. One installment, paid,
  receipted. `paidInFull` is true because the **quotation agreed one
  installment** — not because one row happens to be in the array.
- **SUB-0111 · a running plan.** Meera Studio Interiors, Signature 12 months,
  ₹2,12,400 as three of ₹70,800, from `IB-QT-2026-00161` on `DL-2488`. First
  paid and receipted, second invoiced and waiting, **third with no invoice at
  all** — the chain has not raised it. So the subscription has three
  installments and two invoices, which is the ordinary mid-life state and the
  one most screens get wrong: anything inferring the plan by counting documents
  reports it as a two-installment sale.

Three chains are deliberately left **unrecorded** so the dialog still has
something to walk: Iyer Woodworks and Verve (complete payment), Desai Interiors
(3 installments).

One code change came with them: a chain-recorded subscription's `planId` was
`PL-QUOTED`, which announced where it came from rather than naming the plan. It
is slugged from the quotation's plan name now — `PL-GROWTH`, `PL-SIGNATURE` —
so it reads like every other id in the module.

**Temp data**
`subscriptions.json` → 2 new placeholder records (9 → 11), plus its header
corrected, which still said a subscription is "ACTIVATED, not merely recorded"
after yesterday's rename. `quotations.json` → 2 new (10 → 12), both marked in
their `$comment` as already recorded rather than walkable. `invoices.json` → 1
new (`00102`, installment 2 of 3, carried and therefore not attachable) and two
existing ones joined to their quotations.

**Backend needed**
Nothing new. These are records the existing
`POST /admin/finance/subscriptions` would have written.

**Open decisions**
None new. Worth restating because the demo depends on it: a subscription's
installment count comes from its quotation and never from counting invoices.

**Verified**
`npx tsc -b` clean · `eslint` clean · `vite build` clean · **`check:finance`
296/296**, up from 285: 11 new assertions over the two demos — `paidInFull`
agreeing with the quotation rather than the row count, the money matching the
invoice exactly, three installments against two invoices, and the sum matching
the quotation's agreed total. **One existing assertion changed and it was not a
copy edit:** CAC is spend ÷ customers won that month, so two more August
subscriptions moved it from ₹7,375 over four customers to ₹4,916.67 over six.
The number was updated and the comment now says it tracks the seed, because the
next person to add an August row will hit it too. All other suites and both Team
checks pass.
**Not checked:** not opened in a browser — verified through the store, the
render harness and a production build.

---

### Recording a subscription reads the chain: pick the business, the quotation answers the rest

**Area:** `#/finance?face=subscriptions` → Record a subscription
**Files:** `src/content/finance/quotations.json` (new), `src/content/finance/invoices.json`,
`src/admin/views/Finance/{store.ts,SubModals.tsx}`,
`scripts/{check-finance-ledger.cjs,fn-smoke.tsx}`

**What changed**

The dialog used to ask an operator for four things that already existed on two
documents: the plan, the term, the total and the number of installments.
**Picking the business now resolves the chain** — deal → quotation → invoice —
and the quotation answers all four.

The quotation is where a sale's shape is agreed; the invoice is one installment
of it. So the plan and the term are read from the quotation, the money from the
invoice, and **the installment count from the quotation** — never from counting
the invoices that exist, because the chain raises one per installment *as each
falls due*, and a running three-installment sale usually has one document. The
seed carries that exact case so the mistake fails the suite rather than looking
plausible.

**Only accepted quotations are offered.** A rejected one is not shown and then
refused; it is not shown, because a subscription cannot be recorded on a sale
that did not happen. Where a business has no quotation at all — a website
purchase — the manual path is unchanged and the dropdown is a real choice again.

**The store enforces what the dialog derives.** If an invoice came from an
accepted quotation, a different installment count is refused with
`plan_mismatch`, naming both numbers. The dialog can never send a mismatch; the
guard exists for every other caller, and for the day somebody adds one.

Two smaller consequences. **The channel question disappears when a quotation is
attached** — a quotation is a sales close by definition, and asking anyway
invites the answer that contradicts the document. And where the quotation's
agreed total and the invoices actually raised do not match, that is **stated,
not blocked**: a quotation agrees a total, its installments need not be equal
slices of it, and the invoice wins because it is what was billed.

**Temp data**
`quotations.json` → **new, 10 placeholder records.** It shadows an endpoint that
is already live (`GET /admin/quotations/`), which this convention normally
forbids — `membership-plans.json` was deleted for exactly that. It is here for
the same reason `invoices.json` beside it is, and its `$comment` says so
plainly: Finance is frontend-first, its cross-module reads are seeded together
so the chain resolves with no backend, and **both files come out in the same
commit**. Seeding half a chain leaves it broken in the middle, which is worse.
`invoices.json` → one new record (`00101`) and two existing ones linked to
quotations. The shape is a projection of the live `QuotationRow`, field names
identical, so the swap is a mapping and not a redesign.
Three businesses are now walkable end to end: Iyer Woodworks and Verve
(complete payment), Desai Interiors (3 installments, 1 invoice raised).

**Backend needed**
- `GET /admin/quotations/?party=<userId>&status=accepted` → replaces
  `quotations.json`. Needs the plan line's `planName`, `termMonths`,
  `installments`, `installmentGapMonths` and the totals — the live
  `QuotationItemRow` already carries every one.
- `POST /admin/finance/subscriptions` must apply the **plan_mismatch** guard
  server-side. The client cannot be the only thing holding it.
- No new field on the subscription: the quotation is reached **through the
  invoice**, the same way the deal is. One path to the answer.

**Open decisions**
FN-OD-14 (one supply, several tax invoices) is unchanged. New and worth stating:
a quotation's installments are **not** required to be equal — `IB-QT-2026-00147`
in the seed is three unequal ones — so nothing may divide a total by a count to
find an installment amount. The invoices say what each one is.

**Verified**
`npx tsc -b` clean · `eslint src/admin/views/Finance --max-warnings=0` clean ·
`vite build` clean · **`check:finance` 285/285**, up from 263: 22 new assertions
covering the chain — every invoice's quotation exists and belongs to the same
customer, quotation tax adds up, a rejected quotation is not offered, the
already-recorded quotation names its subscription, the three-installment
quotation has one invoice and the count still reads 3, and the `plan_mismatch`
guard fires with both numbers in the message. `check:finance-render` renders
every surface, its "pick the customer" assertion updated to the new wording.
All seven other offline suites and both Team checks pass.
**Not checked:** the dialog has not been opened in a browser — verified through
the store, the render harness and a production build.

---

### Recording a subscription, not activating one — and eight invoices so the flow can be walked

**Area:** `#/finance?face=subscriptions` — the top-right button, the record dialog,
the subscription record
**Files:** `src/admin/views/Finance/{SubModals,Subscriptions,SubscriptionDetail,store,types}.ts(x)`,
`src/content/finance/{invoices,subscriptions,vocabularies}.json`,
`scripts/{check-finance-ledger.cjs,fn-smoke.tsx}`

**What changed**

**"Activate a subscription" is "Record a subscription"** — the top-right button, the
dialog, the submit, the event type and the stored `activatedAt` / `activatedBy`, which
are `recordedAt` / `recordedBy`. The word was overclaiming: this screen never entitled
anybody, the **invoice** does, and every other face of this module already says it
records what happened (FN-AD-01). Entitlement is unchanged — recording a subscription
still makes it live from its start date.

**Deal reference is gone from the subscription.** It was a hand-typed second copy of
something the attached invoice already carries, so the deal → invoice → installment
chain could be read two ways and would eventually answer differently — and the copy
that disagreed would always have been the typed one. `Chain` now reads the deal from
the invoice, so the strip still resolves and there is one path to the answer.

**Installments are a dropdown, and "Complete payment" is the top option.** It is the
label on **one** installment rather than a sixth choice beside it, because one
installment *is* complete payment — offering both would put two options in the list
that write the identical row. Picking it drops the "× 1" from the total and prints
**Paid in full** in the schedule instead of "Installment 1 of 1". `paidInFull` is
stored rather than derived from `installments.length === 1`, because a schedule can be
cancelled down to one surviving row and that is a different story about the same
subscription. The notice is explicit that complete payment is still only an
installment: it has to be paid before anything counts as collected.

**Eight invoices were added so the module can actually be tested.** Every invoice in
the seed was already carried by a subscription or belonged to one of seven customers,
so picking any of the other twenty businesses dead-ended on "this customer has no
invoice to attach" — a true message in front of an untestable screen. Fourteen
customers now have one. One of them is intra-state (Delhi → Delhi), so the CGST+SGST
split renders somewhere rather than only IGST.

**A ninth invoice unlocked a check that could not be written before.** The ledger
suite carried a note saying no customer held both an unbilled installment and a spare
issued invoice of a *different* amount, so "one invoice bills one installment, for what
that installment is" could only be asserted through the picker — and it ended with
*"when a seed row eventually makes it reachable, this is the comment to delete."*
`IB-INV-2026-00101` is that row, and the write-level guard is asserted directly now,
with a fixture check so it fails loudly rather than silently passing if a later seed
change takes it away again.

**Temp data**
`invoices.json` → **9 new placeholder records**, all `issued` / `unpaid` and attached to
nothing, so each is selectable exactly once and recording against one removes it from
the next list. No `dealRef` on any of them: a website purchase has none, and null says
so rather than inventing one. `subscriptions.json` → `activatedAt`/`activatedBy`
renamed, `customer.dealRef` removed from all 9 rows, `paidInFull` backfilled from the
schedule length. `vocabularies.json` → static copy: `SUBSCRIPTION_ACTIVATED` is
`SUBSCRIPTION_RECORDED`, labelled "Subscription recorded".

**Backend needed**
- `POST /admin/finance/subscriptions` → **FN-T01, renamed.** No `dealRef` in the body;
  the deal is reached through the invoice. `installmentCount: 1` means paid in full and
  the response should carry `paidInFull` rather than leaving it to be inferred.
- The stored subscription drops `customer.dealRef` and renames `activatedAt` →
  `recordedAt`, `activatedBy` → `recordedBy`. Event key `SUBSCRIPTION_RECORDED`.
- Everything else in Module 6's table is unchanged.

**Open decisions**
FN-OD-14 (one supply appearing as several tax invoices) is untouched and still open —
"complete payment" narrows it in practice, since a subscription bought outright raises
one invoice rather than several, but it does not resolve the question.

**Verified**
`npx tsc -b` clean · `eslint src/admin/views/Finance --max-warnings=0` clean ·
`vite build` clean · **`check:finance` 263/263** (up from 260 assertions: two renamed,
one newly reachable and now asserted at the write) · `check:finance-render` renders
every surface, with its four copy assertions rewritten to the new wording rather than
deleted · the other seven offline suites and both Team checks still pass.
**Not checked:** the dialog has not been opened in a browser — this is verified through
the store, the render harness and a production build. **Concurrency note:** this module
was being edited in a second session earlier the same day; its last write was 18:58 and
these changes were made after it, but they have not been merged with anything that
session may still be holding.

---

## 2026-08-30

### The header pill names what it counts, and Collected opens what it counted

**Area:** `#/finance` — the topbar on every section, and the Collected tile
**Files:** `src/admin/views/Finance/{index.tsx,store.ts,Subscriptions.tsx,finance.css}`,
`scripts/{check-finance-ledger.cjs,fn-smoke.tsx}`

**What changed**

*The pill.* **Active** became **Active subscriptions** — "Active" alone left a
reader to guess what was being counted, and next to a Finance title the guess
could as easily have been invoices or payments. The figure now sits in a well
of its own inside the pill rather than trailing the label as its last word, so
the eye lands on the number; the label is the quiet half. Below 760px the words
drop and the dot and figure remain, because the count is the part that cannot
be inferred from anything else on screen.

*Collected opens what it counted.* It was the only money tile with a figure and
no way into the rows behind it — the other two have offered **show only these**
since they were built. A new `flag=settled` lists the subscriptions that have
settled at least one installment, and its chip reads **Settled** rather than the
raw key.

**A note on the label.** The request called the link "checkout". It is
**show only these**, matching the two tiles beside it, because "checkout" in a
finance ledger reads as a payment flow rather than as "look at these" — and
three tiles offering the same affordance under two different words is how a
reader stops trusting either. Say the word and it changes.

**Temp data**
none

**Backend needed**
- `?flag=settled` joins `failed`, `due` and `nobill` as a server-side filter on
  the subscriptions list.

**Open decisions**
none

**Verified**
`tsc -b`, eslint and `npm run build` clean; all ten suites pass by exit code.
`check:finance` is at **263** — three assertions holding the Collected tile to
the rows it opens, and the render suite walks the new filtered page.

**Probe-tested:** widening `flag=settled` to match everything fails two of the
three, including the one that exists purely so the link cannot quietly become a
no-op — it asserts the filtered list is genuinely narrower than the whole.

**Not checked:** nothing was clicked in a browser, and the pill itself is not
in the render suite — it is topbar chrome, which the smoke harness stubs. Its
CSS is unverified beyond a build.

---

### Renew comes off; an installment is billed where it is paid

**Area:** `#/finance` — the subscription record, and the Record payment dialog
**Files:** `src/admin/views/Finance/{store.ts,types.ts,SubModals.tsx,SubscriptionDetail.tsx}`,
`src/content/finance/subscriptions.json`,
`scripts/{check-finance-ledger.cjs,fn-smoke.tsx}`

**What changed**

**Supersedes the Renew half of the entry below.** The button is gone, and so is
everything that only it could reach: the dialog's renewal mode, the store's
`renewalOf` input and its guard, the field on the type and on every seeded row.
A field nothing writes is worse than no field — it invites a reader to trust
something that is always null. **Renewing is still possible and always was**:
activate a subscription from the list and pick the same business.

*Record payment attaches the installment's invoice.* The sales chain raises one
invoice per installment as each falls due, so an installment after the first
reaches payment time carrying none — and a receipt issued against nothing
prints a dash where the tax invoice should be. The dialog now shows **Billed
on**: the invoice already attached, or a picker of the ones that could be, with
the full invoice instance once chosen and a link that opens the document in
Invoices.

Four refusals, matching activation's: the invoice must exist, be **issued**
(`invoice_not_open` — a receipt cannot cite a cancelled document), belong to
**the same customer** (`customer_mismatch`), and be **for exactly this
installment's amount** (`amount_mismatch` — one invoice bills one installment,
for what that installment is). An installment already billed refuses a second
invoice.

**Attaching is not mandatory.** The money arrived either way and a payment that
happened must stay recordable, so the dialog records without one — and says, in
words, that the receipt will then cite no tax invoice, which is the receipt a
customer keeps.

**Temp data**
`subscriptions.json` — `renewalOf` dropped from every row.

**Backend needed**
- `POST …/subscriptions/{id}/installments/{seq}/payment` accepts an optional
  `invoiceNumber`, with the four refusals above.
- `renewalOf` is **not** part of the contract. Do not build it.

**Open decisions**
none

**Verified**
`tsc -b`, eslint and `npm run build` clean; all ten suites pass by exit code.
`check:finance` is at **260**, with a section for billing an installment.

**One guard has no fixture, and the suite says so rather than pretending.** No
customer in this seed holds both an unbilled installment and a second issued
invoice of a different amount, so the write-level `amount_mismatch` cannot be
reached from real data. Inventing a record purely so an assertion could fire
would put data in the seed the business never produced. The rule is asserted
where a person actually meets it — the picker, which never offers a
wrong-amount invoice — and an assertion pins the gap itself, so it turns red
the day a seed row makes the write path reachable.

**Two bad assertions caught before they landed:** one compared against
`has(x, "")`, which is always true, so the check could never fail; the other
was the fixture above, which reported `"no fixture"` as a pass. Both were
rewritten rather than deleted.

**Not checked:** nothing was clicked in a browser. The attach flow is asserted
through the store's refusals and as rendered markup, not as a click path.

---

### The Due tile and the Due filter now read one rule

**Area:** `#/finance` — the Due tile on Subscriptions and the queue it opens
**Files:** `src/admin/views/Finance/{store.ts,Subscriptions.tsx}`,
`scripts/{check-finance-ledger.cjs,fn-smoke.tsx}`

**What changed**

The sub-line drops two words: *2 installments · expected, not earned* is now
**2 installments · expected**. The full caution — "expected, not earned, and
only what is genuinely in front of each customer" — is still on the metric,
one press of the i button away.

**The filter had not followed the figure.** The entry below narrowed what Due
COUNTS: one installment per subscription, and nothing from a defaulting one.
`flag=due` was still filtering on `dueN > 0` — every `due` row a subscription
held, including the ones sitting behind a failure. So SUB-0104 contributed
**nothing** to ₹7,55,200 and still appeared when you clicked through to see
what made it up. A tile whose own filter disagrees with it is worse than either
answer alone, because it makes the reader doubt the one that was right.

Both now read `SubRow.dueNext` — the same `nextDue` the figure is built from.
The Due queue lists SUB-0102 and SUB-0107, exactly the two the tile counts.

`dueN` survives on the subscription record, where "3 paid, 1 due, 1 failed" and
"Still due · N installments" genuinely mean every remaining row. It was only
ever wrong as a queue.

**Temp data**
none

**Backend needed**
none beyond the previous entry — but the same rule governs both: a list
endpoint filtering `?flag=due` must return what the due figure counted, not
every unpaid installment.

**Open decisions**
none

**Verified**
`tsc -b`, eslint and `npm run build` clean; all ten suites pass by exit code.
`check:finance` is at **261** — three assertions added holding the tile and the
filter to one rule, including one that fails if the filter ever lists something
the figure ignored.

**Probe-tested:** putting the old `dueN > 0` filter back fails two of the three
immediately, naming SUB-0104. The third exists to keep the pair honest in the
other direction — it asserts a subscription really would have been listed by
the old rule, so the check cannot quietly become vacuous if the seed changes.

**Not checked:** nothing was clicked in a browser; the filter is asserted
through `applySubFilters`, not through the link that sets it.

---

### Renew; a scope chip instead of three totals; and Due is what is actually in front of somebody

**Area:** `#/finance` — the topbar on every section, the Subscriptions money
strip, and the subscription record screen
**Files:** `src/admin/views/Finance/{index,Subscriptions,SubscriptionDetail,SubModals}.tsx`,
`{store.ts,types.ts,finance.css}`, `src/content/finance/{subscriptions,vocabularies}.json`,
`scripts/{check-finance-ledger.cjs,fn-smoke.tsx}`

**What changed**

*The topbar carries one figure, and it is a count.* Collected, Net and Fail to
pay came off it. They were three rupee totals repeated above every section —
including the ones that had nothing to do with them — with no formula and no
caution beside them. Money belongs to the tiles of the section that computes
it, where its i button is; a figure nobody can check does not get to sit above
every page. In their place, a green **Active** chip: how many businesses are
subscribed right now. That is scope rather than analysis, and it is the same
question on every section.

*The Collected tile counts what it collected.* "1 completed · 2 defaulting" is
off its sub-line — two figures about subscription lifecycle hanging off a tile
about money that arrived.

*Renew.* On the subscription record, beside Cancel. It is **activation again**:
the same dialog, the same guards, the same write — the business simply arrives
already chosen and cannot be changed, so the only thing left is to attach the
invoice for the new term. A renewal is a **new term with its own id, its own
invoice and its own schedule**, and it names the term it follows
(`renewalOf`) — without that, a renewal and an unrelated second sale to the
same customer are indistinguishable. **The term being renewed is not edited**:
it keeps its status, its schedule, its payments and its history, which is the
whole point of it being a record.

*Due means what is actually in front of somebody.* Two rules, and both stop a
figure claiming money that is not coming:

- **A defaulting subscription contributes nothing.** Something on it already
  failed; calling the row behind that failure "due in 30 days" says the money
  is on its way when the last attempt at it did not clear.
- **Only the installment in front.** Installments are paid in order, so the
  second is not due while the first is unpaid.

Due next 30 days went from **₹7,67,000 across 3** to **₹7,55,200 across 2**.
The list's own "what is next" reads the same rule, so the tile and the row
cannot say different things about one subscription — asserted, not assumed.

**Temp data**
`subscriptions.json` — `renewalOf` defaulted to null on every existing term.
`vocabularies.json` — the `due_next` formula and caution rewritten to say what
the figure now counts.

**Backend needed**
- `POST /admin/finance/subscriptions` accepts an optional `renewalOf`, and must
  refuse one that follows another customer's term (`customer_mismatch`) or a
  term that does not exist.
- The due figure is a server-side derivation with the same two rules. A list
  endpoint that returns every unpaid installment inside 30 days will not agree
  with this panel.

**Open decisions**
none

**Verified**
`tsc -b`, eslint and `npm run build` clean; all ten suites pass by exit code.
`check:finance` is at **258**.

**A vacuous assertion caught by probing, and what it taught.** The first
version of the due checks passed with the status guard *deleted*. The reason is
real and worth writing down: a defaulting subscription always carries a
failure, and the walk already stops at the first row that is not paid — so on
this seed the two rules produce the same answer and neither assertion isolated
either one. They are now pinned separately against shapes the seed cannot
supply, and re-probed: removing the status guard fails exactly one assertion,
and letting a failure stop blocking the row behind it fails exactly the other.

An earlier draft of the same block also shipped a condition ending in `&& false`
— an assertion that could never fail. It was caught before it landed.

**A near-name collision, avoided this time.** The topbar chip was going to be
`.fin-chip`, one letter from the existing `.fin-chips` filter row — the same
shape of mistake that once put a hover state on every row in the module. It is
`.fin-scope`, and the CSS says why.

**Not checked:** nothing was clicked in a browser. Renew is asserted through
the store's own guards and as rendered markup, not as a click path.

---

### A subscription is ACTIVATED against its invoice, not recorded with a typed total

**Area:** `#/finance` — Activate a subscription; the subscription record screen
**Files:** `src/admin/views/Finance/{types.ts,store.ts,SubModals.tsx,Subscriptions.tsx,SubscriptionDetail.tsx}`,
`finance.css`, `src/content/finance/{subscriptions,vocabularies}.json`,
`scripts/{check-finance-ledger.cjs,fn-smoke.tsx}`

**What changed**

**This module manages a live business subscription; it does not file a memory
of one.** The dialog now reads *Activate a subscription* and its button says
*Activate subscription*, because that write is what entitles a business to the
plan. `recordSubscription` is `activateSubscription`; the event is
`SUBSCRIPTION_ACTIVATED`; the row carries `activatedBy` and `activatedAt` where
it carried `recordedAt`. It is still a fact rather than a claim — activation
happens when it is done — so the premise the module was built on is intact.

**The invoice carries the money now.** *Total paid* is gone as a field. You
attach the invoice the subscription was raised on, and the dialog then shows
**the invoice instance in full** — who it was raised for, its description,
dates, taxable value, tax and grand total — because a person attaching the
wrong invoice should be able to see that it is wrong, not just its number.

The total is derived, never typed: the sales chain raises **one invoice per
installment, each for the same amount** (FN-OD-14), so the subscription total
is the attached invoice times the installment count. That is also why the
schedule divides back exactly — by construction rather than by luck. Verified
against the seed: SUB-0107 is ₹1,18,000 × 2 = ₹2,36,000.

Four refusals the write did not have: the invoice must exist, must be **issued**
(`invoice_not_open` — a cancelled invoice entitles nobody), must belong to **the
same customer** (`customer_mismatch` — activating one customer's plan on
another's invoice is how the wrong account gets entitled), and must not already
be carried by another subscription (`duplicate_invoice`). The picker offers
exactly the invoices that would be accepted, because offering one the write
would refuse is a dialog lying to the person using it.

Where the catalogue price and the attached invoice disagree, the dialog says so
and **the invoice wins** — it is what the customer owes — but the mismatch is on
screen rather than silently resolved.

**Temp data**
`subscriptions.json` — every row gains the invoice it was activated against
(taken from its first billed installment), `activatedBy`, and `activatedAt` in
place of `recordedAt`; `SUBSCRIPTION_RECORDED` events are now
`SUBSCRIPTION_ACTIVATED`. `vocabularies.json` — the event type renamed with it.

**Backend needed**
- `POST /admin/finance/subscriptions` is now an **activation**, and takes an
  `invoiceNumber` rather than a `totalPaise`. The four refusals above are the
  contract. FN-T01 in BACKEND-INTEGRATION.md § Module 6.

**Open decisions**
FN-OD-14 (one supply, several invoices) is now load-bearing rather than
cosmetic: it is the reason the total is the invoice times the count. If the
chain ever raises one invoice for a whole multi-installment subscription, that
arithmetic changes and this is the line to come back to.

**Verified**
`tsc -b`, eslint and `npm run build` clean; all ten suites pass by exit code.
`check:finance` is at **235** — the write block was rebuilt around activation
(every refusal plus its consequence), and three seed invariants added: every
subscription names an invoice that exists, that invoice belongs to the same
customer, and no two subscriptions were activated on the same one.

**Probe-tested:** breaking one subscription's invoice link fails the first;
pointing two subscriptions at one invoice fails the other two. Neither passes
vacuously.

**Not checked:** nothing was clicked in a browser. The invoice picker is
asserted as rendered markup and through the store's own refusals, not as a
click path.

---

### Subscriptions own the lifecycle; Users Management stops holding memberships

**Area:** `#/finance` — Record a subscription; and Users Management throughout —
the Membership tab, Assign membership, the renewal queue and three analytics
blocks are gone
**Files:** `src/admin/views/Finance/{store.ts,SubModals.tsx}`, `finance.css`,
`src/admin/views/Users/*` (15 changed, 4 deleted), `src/admin/shell/modules.ts`,
`src/content/users/{users,vocabularies,analytics,audit}.json`,
`src/content/finance/{subscriptions,invoices}.json`,
`scripts/{check-finance-ledger.cjs,fn-smoke.tsx,check-users-derivation.cjs,um-smoke.tsx}`,
`BACKEND-INTEGRATION.md`, `README.md`,
`OPERATION-2026-08-30-subscriptions-own-the-lifecycle.md`

**What changed**

Four changes that are one change wearing four hats. Finance/Subscriptions
records what a customer bought and what they pay for it. Users Management had
been recording the same fact as a "membership" — a term, a plan, a lifecycle, a
renewal queue. **Two modules holding one fact is how they end up disagreeing**,
so the subscription grew the two things it was missing and Users gave up the
thing it should no longer own.

*The customer is an account.* Recording a subscription picks from the registered
user base — searchable by name, business, email or user id — instead of taking a
typed name. `userId` is the link; the name is a denormalised copy kept so a
record still reads correctly if the account is later renamed. A typed name was a
customer the platform had never heard of and nothing else could join to.

*The plan comes from the catalogue.* `AdminOpsService.plans()` is live, so the
plan on a subscription is chosen from what the company actually sells rather
than from a list copied into the dialog that drifts the first time pricing
changes. **The billing cycle carries both the term and the price**, so the
separate Term field is gone — it was two fields that had to agree with nothing
making them — and the total prefills from the cycle. It stays editable, because
a negotiated price is a real thing. Loading, failure and empty are all rendered:
if the catalogue cannot be read the sale is still recordable by hand, because a
sale that happened must not become unrecordable when an endpoint is down.

*"Total agreed" is now "Total paid",* as asked. See the caveat below.

*Membership left Users.* Deleted: `AssignMembership.tsx`, `RenewalQueue.tsx`,
`LifecycleModal.tsx`, `assign.css`, `memberships.json`. `classify()` is now
`active | deactivated` and takes one argument. Users keeps identity, profile,
username rules, business facets, target areas, status, notes, tags and audit —
which is a real job, and it survives intact.

**What that costs, stated rather than tidied away**

| Lost | Where the question goes now |
| --- | --- |
| **Active Member** classification | Whether someone is paying is a Finance question. |
| **Renewal queue** | Finance's *Due in the next 30 days*, asked of the record that holds the money. |
| **Assign / pause / suspend / cancel a term** | A subscription is recorded and cancelled in Finance. |
| **Conversion and retention** | Finance carries MRR, ARPU and the fail-to-pay rate. |
| **Cohort retention** | **Nowhere.** It was the only place the panel asked "do they stay", and nothing replaces it. |

The **History tab is also gone** — a deviation from the literal instruction to
keep it. It was 100% per-term content, so with membership removed there was
nothing left to render and keeping it would have meant an empty tab. The
account's history is the **Audit** tab, which survives whole.

Users Analytics was restructured rather than left full of holes: seven blocks,
with *Registered to a usable profile* replacing the membership funnel — the
user-owned version of the same question — and a notice naming exactly which
metrics moved to Finance, so a reader who came looking for churn is told where
it went instead of finding a gap.

**A defect this surfaced**

Making the customer a real account revealed that **eight of nine subscriptions
and six of seven invoice customers did not have one.** Some carried no `userId`;
two pointed at a different company entirely — `IB-U-0975` is Verve Modular
Kitchens, not Sandeep Kulkarni. It was invisible because Finance only ever
displayed the name it stored and nothing ever resolved the id. Seven customers
are now registered users, both Finance seeds point at them, and
`check:finance` asserts every subscription resolves **to the user of that
name** — not merely to some user.

**Temp data**
`src/content/users/memberships.json` **deleted**. `users.json` gained seven
customers Finance had been billing without registering, and lost
`activeMembershipId` from all 20 existing records. `vocabularies.json` lost the
membership states, transitions, lifecycle actions and eight metrics; it **keeps
the `MEMBERSHIP_*` event labels** so historical audit rows render as history
rather than as raw keys. `analytics.json` lost the membership-keyed series.
`audit.json` was **not** edited — it never held membership events; they lived on
the term.

**Backend needed**
- `GET /admin/plans/` — **already live**, now read by Finance too.
- The membership endpoints (UM-T02…T06, UM-T11, UM-T12) are **gone, not
  deferred** — they must not be built. § Module 5 says so at the top and points
  at § Module 6.
- UM-T01, T07, T08, T09 and T10 keep their numbers. A number that moves is worse
  than a gap in a sequence.

**Open decisions**
UM-OD-06 and UM-OD-12 retired — both described a membership. UM-OD-09 and
UM-OD-10 stand.

**Verified**
`tsc -b`, eslint and `npm run build` clean. **All ten suites pass**, plus the
other module's `check-team-nav`. `check:users` went from 248 assertion sites
that could not run at all to **442 executed**; `check:users-render` to **164**;
`check:finance` is at **232**.

**A correction to my own verification.** The loop I had been checking suites
with grepped for "N FAILED" — which a suite that *throws* never prints. It
reported `check:finance` as passing while it was crashing on the changed
`recordSubscription` signature. Replaced with a gate that reads **exit codes**,
and everything re-run under it.

**Three defects the rewritten Users suite caught, two of them mine.** The seven
customers I registered carried `positioning: ["value"]` — a key the vocabulary
had dropped, refused on save, rendered on the record as its own raw key — and
had no audit row at all, so an account that demonstrably registered opened its
timeline saying nothing had ever happened. I also numbered their audit ids into
a range already in use, which the uniqueness check caught. The third was
pre-existing and is fixed in `store.ts`: `validateFacets` read a `targetAreas`
that was not an array as "no areas", passed it, and `updateProfile` stored it
raw — after which the directory threw `targetAreas.some is not a function` on
the next read. It now refuses the shape, which is what that function exists to
do.

Each of those had been **quarantined by name** in the suite rather than papered
over, so fixing them turned the quarantine red and forced its deletion. All
three are now asserted as positive rules. One assertion could not survive
honestly: the empty-timeline branch is no longer reachable from the seed, so it
is explicitly **not** asserted rather than asserted against a fixture that would
have to be broken to produce it.

**Two things worth arguing with**

1. **"Total paid" is not what that field holds.** It is the agreed total, split
   into installments that may still be `due` or `fail_to_pay`. A subscription
   with ₹3,24,500 outstanding now shows it under a label saying "paid". The help
   text underneath keeps the precise wording, but the label overstates. "Total
   sold" would be accurate.
2. The removal is **irreversible in this tree** — nothing is committed.

---

### Subscriptions money strip: three tiles, and Fail to pay ends it

**Area:** `#/finance` — the money strip on Subscriptions
**Files:** `src/admin/views/Finance/Subscriptions.tsx`, `finance.css`,
`scripts/fn-smoke.tsx`

**What changed**

Four tiles became three, in a different order:

```
was   Collected · Fail to pay · Due in 30 days · Active subscriptions
now   Collected + active · Due in 30 days · Fail to pay
```

**Active subscriptions moved into the Collected tile** as a second figure, and
**Fail to pay moved to the end** — it is the one tile a person acts on, so it
closes the strip rather than interrupting it two cells in.

The combined tile keeps its two numbers **visibly different kinds**, on their
own baseline and weight, because they are not the same sort of figure and the
tile must not imply otherwise. Collected is a period sum — everything that came
in during August, including money from subscriptions that have since completed,
defaulted or been refunded. Active is a level read at this moment. Run them
together as one headline and the tile quietly claims those four subscriptions
produced that figure, which is not true of any month. The count carries its own
i button saying exactly that, alongside what it counts and what it excludes.

**Temp data**
none

**Backend needed**
none

**Open decisions**
none

**Verified**
`tsc -b`, eslint and `npm run build` clean; all ten suites pass.
`check:finance-render` gained three assertions: the strip's ORDER (pinned by
position — order is invisible to tsc and to every other check here), that the
active count renders as a second figure rather than part of the headline, and
that its caution is reachable from it.

**Probe-tested:** reversing the expected order in the assertion makes it fail,
so it is not passing vacuously. One assertion had to be **weakened honestly** —
the i button's text lives behind a click a static render cannot make, so what is
asserted is that the caution is reachable, not that it is on screen.

**Not checked:** nothing was clicked in a browser, so the two-figure tile's
layout at narrow widths is unverified.

---

### Finance becomes five sidebar rows; the in-page tabs go

**Area:** the sidebar — the **Finance** group; five routes `#/finance`,
`#/finance-salaries`, `#/finance-transactions`, `#/finance-refunds`,
`#/finance-analytics`
**Files:** `src/admin/shell/modules.ts`, `src/admin/auth/session.ts`,
`src/admin/views/registry.tsx`, `src/admin/views/Finance/*` (index, Frame, the
five faces, four record screens, `finance.css`),
`scripts/{check-finance-nav.cjs,fn-smoke.tsx}`, `package.json`,
`BACKEND-INTEGRATION.md`

**What changed**

**Supersedes the entry below it.** That change made the five sections the
panel's inline tabs. They are now **five sidebar rows** instead, and the page
carries no navigation of its own at all:

```
Finance
  Subscriptions        #/finance                · records under /SUB-…
  Salaries A/C         #/finance-salaries       · /SAL-AC-… /RUN-… /SLIP-…
  Other Transaction    #/finance-transactions   · /TXN-…
  Refunds              #/finance-refunds        · /RF-…
  Analytics            #/finance-analytics
```

A single row labelled **Finance** inside a group labelled **Finance** said
nothing about what was in it and buried the five sections one click deep behind
a tab strip you could not see from the sidebar. The group now names its own
contents.

They are separate **module keys**, not one key with five faces, because the
grant genuinely differs: **payroll is the most sensitive record in the panel and
has to be withholdable without also withholding the subscription ledger.** Every
write affordance now asks about its own section — `can("finance-salaries",
"edit")` — rather than about Finance as a whole. Same argument that made
`reports` its own key rather than a face of `work`.

All five resolve to the **same component**, which reads its own route to know
which section it is showing. Finance is still one module over one store; the
keys exist so the sidebar can name it and the server can grant it in parts. A
record lives under its own section's route, so Back lands on the list it came
from and the sidebar keeps the right row lit.

`?view=` is gone, `ViewTabs` is gone, `.fin-tabbar` is gone. The switch *within*
a section stays and stays segmented — Transactions ǀ Tags and Overview ǀ KPI are
two views of one record type, not two sections.

**Temp data**
none

**Backend needed**
- **Five** `Module` rows, not one: `finance`, `finance-salaries`,
  `finance-transactions`, `finance-refunds`, `finance-analytics`, all group
  label **Finance**. Each leaves `PROTO_MODULES` in the commit that lands its
  row. Detail in BACKEND-INTEGRATION.md § Module 6.

**Open decisions**
The sidebar shows no queue badge on any Finance row. `Q_OF` reads the
prototype's own `derive.badges()`, which knows nothing about this module, so the
count of subscriptions with a failed installment — previously a tab badge — is
not surfaced in the nav. It is still the first tile on Subscriptions.

**Verified**
`tsc -b`, eslint and `npm run build` clean; all ten suites pass, including the
other module's `check-team-nav`. New **`npm run check:finance-nav`** (17
assertions, wired into `npm run check`) asserts the sidebar composition, which
is otherwise entirely silent failure: a key in `PROTO_ROWS` but not
`PROTO_MODULES` never renders and nothing errors, a mismatched group label files
a row in a section of one, and a key the server also sends renders twice. It
also asserts a real server row **replaces** the proto one rather than doubling
it. `check:finance-render` walks all five new routes.

**Probe-tested, not assumed:** removing `finance-refunds` from `PROTO_MODULES`
makes the nav check fail on three assertions, and pointing `/finance-salaries`
back at `/finance` fails five render assertions — so neither suite passes
vacuously and the routes genuinely resolve to their own faces.

**Not checked:** nothing was clicked in a browser. The sidebar is asserted as
composed data, not as a rendered, clickable nav.

---

### Finance: the sub-sections become the panel's inline tabs

**Area:** `#/finance` — the five sub-sections (Subscriptions · Salaries A/C ·
Other Transaction · Refunds · Analytics)
**Files:** `src/admin/views/Finance/{Frame,Transactions,Analytics}.tsx`,
`finance.css`, `scripts/fn-smoke.tsx`

**What changed**

The five sub-sections rendered as `.fin-views` — a bespoke full-bleed band with
its own icons, sitting above the page rather than in it. It read as a separate
strip bolted on top. They are now the panel's ordinary inline tabs: the same
`Tabs` component from `ui/`, the same metrics, the same underline every other
tab strip in the panel already uses. Finance has no more claim to a navigation
idiom of its own than any other module, and ~20 lines of duplicated tab CSS go
with it.

Two faces already carried a tab strip of their own — Transactions ǀ Tags and
Overview ǀ KPI. Two identical underlined strips stacked on one page say the two
levels are peers, and they are not, so those became a **segmented sub-switch**
(`SubTabs`) that reads as subordinate at a glance. Record screens keep plain
`Tabs`: they carry no sub-section nav, so nothing collides there.

Also fixed while in the file: the print rule still hid `.fin-views` (gone) and
`.fin-tabs` (never existed), so a printed payslip or receipt would have carried
the navigation. There were two print blocks that could drift apart; there is
now one, naming classes that exist.

**Temp data**
none

**Backend needed**
none

**Open decisions**
none — the icons went with the band. The shared `Tabs` takes no icon, and
adding one to a primitive six modules render was not worth a decoration.

**Verified**
`tsc -b`, eslint, `npm run build` and all nine suites pass. `check:finance-render`
grew to **285 checks**: every face now asserts that the strip renders as the
shared `.tabs` and that all five sub-sections are named in it, and the two
sub-switches assert they are segmented rather than a second tab strip. Both new
assertions were **probe-tested by breaking the needle** — each fails on all
seven faces when the expected string is altered, so neither passes vacuously.
**Not checked:** nothing was clicked in a browser; the tabs are asserted as
rendered markup, not as a working click path.

---

### Attendance, Work and Reports render — a work clock that is not the login

**Area:** `#/attendance`, `#/work`, `#/reports` — nine faces across three routes
**Files:** `src/content/team/{members,attendance,work,plans,reports,vocabularies}.json`,
`src/admin/views/Team/{store.ts,bits.tsx,Attendance.tsx,Work.tsx,Reports.tsx,team.css}`,
`src/admin/views/registry.tsx`, `scripts/check-team-derivation.cjs`,
`BACKEND-INTEGRATION.md`, `README.md`

**What changed**

The operational half of the Team module renders. **Attendance** is a work clock
opened by *Start day* and closed by *End day* — deliberately **not** the auth
session, because somebody checking one number at 23:40 has logged in and has not
started a shift, and a token refresh advances "last active" whether or not
anybody is at the keyboard. **Work** is one table for tasks, milestones and
targets, discriminated by `kind` with `parentId` as the containment, because the
relationship between the three is containment and that is a self-reference, not
a third system. **Reports** carries the senior's day and the member's own two
forms, where a plan line creates or links a work item and ticking that line in
the EOD completes it — so "what they said they would do" and "what they did" is
a diff rather than two paragraphs somebody compares by eye.

**Three things are derived and never stored,** each because storing it needs a
sweep and this backend has no queue: `absent` (no row *and* the day is over —
at 10am a member who is not in yet is Not started, which is a different claim),
`unclosed` (open past the member's own auto-close — it counts towards **no**
total, and nothing auto-closes it, because an auto-closed day is a number the
system invented and an unclosed one is a question), and `delayed` (`dueDate <
today` on a non-terminal item — a cancelled item that is past due is **not**
overdue, which is the single easiest part of this to get wrong).

**`isLate` is the one thing computed at open and stored,** against that
member's own `dayStartsAt`. The seed has a member whose agreed start is 10:00
and who clocks in at 10:06 *later than the member who is marked late* — so any
implementation reading a company-wide constant fails the suite rather than
looking fine.

**Scope is the API's job.** `TM-OD-01` answered: self always, `team` from
`reportsTo` one level deep, `all` behind a new verb. Every face states the scope
it is showing, because a screen that silently widens from "your reports" to
"everyone" when a grant changes is one nobody can reason about. **While the
three keys sit in `PROTO_MODULES` every session resolves to `all`** — that is
the proto hole, not this derivation, and it closes with the keys.

All CSS is in a new `Team/team.css` with the `tm-` prefix; **`admin-theme.css`
was not touched**, deliberately, because Finance is being edited concurrently
and that file is the likeliest conflict in the repo. No hex appears in it — the
six existing tones carry every state.

**Temp data**
Six new files under `src/content/team/`, all endpoint-shaped, all `$comment`'d.
`members.json` → placeholder records, and the one that matters: it stands in for
the **team-wide** member read that does not exist, plus the employment block
(`reportsTo`, `dayStartsAt`, `expectedHoursPerDay`) that has no column on the
server. `attendance.json`, `work.json`, `plans.json`, `reports.json` →
placeholder records. `vocabularies.json` → **static copy**: labels, tones, the
transition table and the metric definitions, permanently.
Two absences in the seed are the record, not an omission: a member with no
attendance row (absence is the lack of a row, never a row saying "absent") and
two members with no plan.

**Backend needed**
- `GET /admin/team/members` → **the blocker.** Every member, not only those the
  signed-in admin created, with the employment block. Replaces `members.json`.
- `GET /admin/team/attendance?date=` · `…/{memberId}?from&to` → replaces
  `attendance.json`. `POST …/attendance/{open,break,resume,close}` — **idempotent
  on (member, businessDate)**; closing must close a running break in the same
  instant.
- `GET/POST /admin/team/work`, `POST …/{id}/status` → replaces `work.json`.
  Must refuse `completed → planned`, and demand a reason on block, cancel and
  reopen.
- `GET/POST /admin/team/plans/{date}` · `…/reports/{date}` ·
  `POST …/reports/{id}/acknowledge` → replaces `plans.json` / `reports.json`.
  **Must reject an hours field if one is ever sent.**
- Scoping happens server-side on every one of those. A client filter over an
  unscoped payload is the same bug in a different place.
- `Module` + `ModuleAction` rows for `attendance`, `work`, `reports`, each with
  an `all` verb; every key leaves `PROTO_MODULES` in the commit that lands its
  rows.

**Open decisions**
TM-OD-01 and TM-OD-14 are answered and recorded in §13 of the operation
document. **TM-OD-14 landed somewhere better than either option:** slips are
generated, and Finance already generates them — `SalaryAccount` / `Payslip` /
`SalaryRun` exist in that module with components frozen at issue and `memberId`
joining the live Team endpoint. Team reads them; it does not build a second
generator. TM-AD-11 is superseded. Still open and assumed: TM-OD-03 (hours per
member — the seed already varies them), TM-OD-10 (EOD never blocks), TM-OD-11
(no computed score — the table sorts, it does not rank), TM-OD-13 (no leave or
holidays; "working day" means "not a weekend" and the week grid says so).

**Verified**
`npx tsc -b` clean · `eslint` clean on all six new files · `vite build` clean
(237 modules) · new `node scripts/check-team-derivation.cjs` — **63 assertions,
all passing**, calling the shipped store rather than a reimplementation of it:
the per-member late rule (including the row that would pass with a constant and
fails without one), the unclosed day counting as nothing, terminal items never
being overdue, derived milestone and target progress, one-level scope that is
not transitive, the founder excluded from the no-plan count, an EOD not being
outstanding at 14:20, idempotent day-open, close-closes-the-break, every refused
transition, a plan line linking instead of forking, and an EOD tick completing
the item. `check-team-nav.cjs` still green at 17, and all nine offline
`check:*` suites pass, Finance's two included.
**Not checked:** the screens have not been opened in a browser — this is
verified through the store and a production build, not visually. Neither new
check is wired into `npm run check`, because `package.json` is being edited
concurrently by the Finance work; run them directly, or add
`"check:team": "node scripts/check-team-derivation.cjs"` and
`"check:team-nav": "node scripts/check-team-nav.cjs"` once that settles.

---

## 2026-08-30

### Team becomes a sidebar group of five, and Roles moves out of Settings

**Area:** the sidebar — a new **Team** group; `#/team`, `#/roles`, and three new
routes `#/attendance`, `#/work`, `#/reports`
**Files:** `src/admin/shell/modules.ts`, `src/admin/auth/session.ts`,
`scripts/check-team-nav.cjs`, `scripts/team-nav-session-stub.ts`,
`OPERATION-2026-08-30-team-module.md`, `BACKEND-INTEGRATION.md`

**What changed**

Phase A of the Team Module: the navigation only. **Team is now a top-level group
holding Members · Roles · Attendance · Work · Reports**, sitting above Finance and
well above Settings. `Members` and `Roles` were in Settings, which was right while
Team meant "add a staff account and grant it a role" — configuration, done rarely.
It stops being right the moment a clock, a day's work and a day's reports sit beside
them, because those are opened every day and Settings is the group nobody opens
daily. This is the same argument that moved Users Management out of Settings.

`team` and `roles` are **server** rows carrying `groupLabel: "Settings"`, so they are
re-filed by a new `GROUP_OVERRIDE` map in `modules.ts`. That map is a **stand-in, not
the design** — `groupLabel` is the server's field and the fix is a Module-row update,
at which point the map empties and nothing about the sidebar changes.

The three new keys are proto rows in the established sense: no server row, no views,
no seed data. Their routes resolve to ViewHost's existing "coming soon" state, which
is the honest rendering of a nav item whose surface is not built. **`team` and `roles`
are deliberately NOT in `PROTO_MODULES`** — both hold real Module rows and real issued
grants, so adding either would hand member CRUD and role assignment to every
signed-in account.

`reports` is its own module key rather than a face of `work`, because reading
everybody's daily plans and EOD reports is a manager's grant and must be holdable
without the right to create or reassign anybody's work.

No view was added, no endpoint was called, no existing screen was touched.

**Temp data**
`none` — Phase A adds no records. The three new modules will read
`src/content/team/*.json` when their surfaces are built; nothing is seeded yet.

**Backend needed**
- `Module` + `ModuleAction` rows for `attendance`, `work` and `reports` → each key
  leaves `PROTO_MODULES` in the commit that lands its rows, as `business-enquiries`
  did with migration 0024.
- A `groupLabel` change to `"Team"` on the existing `team` and `roles` Module rows →
  retires `GROUP_OVERRIDE` in `shell/modules.ts`.
- `GET /admin/users/` returning **every** member, not only those the signed-in admin
  created → blocks Phase B and every team-wide screen after it.

**Open decisions**
TM-OD-01 answered: a senior sees **their own reports only**, scoped from
`TeamProfile.reportsTo`, one level deep, with a new `all` verb for company-wide
visibility — not a scope axis on the grant. TM-OD-14 answered: slips are
**generated**, and Finance already generates them (`SalaryAccount` / `Payslip` /
`SalaryRun`), so Team reads them by `memberId` rather than building a second
generator. Both are recorded in full in §13 of the operation document, which
supersedes TM-AD-11 and revises TM-BR-02. Five approval items remain open and
**Phase B does not start without them**.

**Verified**
`npx tsc -b` clean · `eslint` clean on both changed files · new
`node scripts/check-team-nav.cjs` — 17 assertions, all passing: group order, Team's
membership, Settings keeping only Audit, no key rendered twice, all three icons
resolving to real glyphs rather than the `doc` fallback, the proto gate holding for
the three new keys and **not** holding for `team`/`roles`, a real server row not
doubling up the proto one, and `getGroupOf()` agreeing with `getModules()`. The nine
offline `npm run check:*` suites all pass, Finance's two included.
**Not checked:** the sidebar has not been rendered in a browser — this is a
composition change verified against `getModules()`, not a visual one. `check:enquiries`
could not run: it needs a live backend at `localhost:8000` and one was not running.
The new check is not yet wired into `npm run check` because `package.json` is being
edited concurrently by the Finance work; run it directly, or add
`"check:team-nav": "node scripts/check-team-nav.cjs"` once that settles.

---

## 2026-08-30

### Finance rebuilt around four record types: Subscriptions, Salaries A/C, Other Transaction, Refunds — plus Analytics

**Area:** `#/finance` — five tabs replacing five faces; five record screens
(subscription · salary account · payslip · transaction · refund) and 20 dialogs
**Files:** `src/admin/views/Finance/{types,store}.ts`,
`{index,Frame,bits,dialog,InfoTip}.tsx`,
`{Subscriptions,SubscriptionDetail,SubModals}.tsx`,
`{Salaries,SalaryDetail,Slip,SalaryModals}.tsx`,
`{Transactions,TxnDetail,TxnModals}.tsx`,
`{Refunds,RefundDetail,RefundModals}.tsx`, `Analytics.tsx`, `finance.css`,
`src/admin/views/{charts.tsx,charts.css}` (moved out of Users, now shared),
`src/content/finance/{module,subscriptions,salaries,transactions,refunds,vocabularies}.json`,
`scripts/{check-finance-ledger.cjs,fn-smoke.tsx}`,
`src/proto/v-2.2.0.0/{BACKEND-INTEGRATION.md,OPERATION-2026-08-30-finance-redesign.md}`

**What changed**

The module was organised by accounting concept — Payments · Spend ·
Reconciliation · Refunds · Revenue. It is now organised by **what is being
recorded**, because that is how the business actually thinks about its money.
Four tabs, four record types, and a fifth that is only the other four read
back.

*Subscriptions.* A sale that happened, from **sales** or from the **website**,
paid in **installments** — and the installment, not the subscription, is the
unit that gets paid. The whole schedule is created at once with a due date on
every row, because a schedule invented one row at a time is not a schedule; the
dialog draws it from the store's own generator before anything is committed.
The new status is **Fail to pay**, and it is a *fact*: a gateway decline, a
cancelled mandate, or a due date that has demonstrably passed. Evidence is
mandatory, the reason is a closed list, and the store **refuses** an `overdue`
failure on an installment that is not yet due.

*Salaries A/C.* One account per team member, joined to the live Team record on
`memberId`, with typed earnings and deductions — never derived from a role,
because a salary is a contract with a person. Monthly runs issue one slip per
active account, and **a slip freezes its own components**, so a raise next
month cannot rewrite last month's slip. The payslip is a real document —
company block, employee block, paid days, earnings against deductions, net pay
in words — printed rather than generated, because the browser's Save as PDF is
the export and a PDF library would be a hundred kilobytes for two documents.

*Other Transaction.* Company money out and in under a tag **you create**. That
reverses the old closed-list rule, as asked. What is *not* free is the tag's
`kind` — it decides where the money lands in Analytics — and a tag is
deactivated, never deleted, because deleting one silently re-buckets every row
that used it. Money in is still restricted to three non-revenue kinds: if
anyone could hand-key a credit, anyone could fabricate revenue.

*Refunds.* Now supports raising one **by hand**, with no ledger row behind it —
a duplicate transfer, an overpayment, an order taken off-platform. A manual
refund carries **no policy check at all** rather than an empty one, because an
empty check reads as a passed check. Approval still moves no money: the refund
is `paid` only when someone records the actual transfer, and the gap between
approved and sent is now its own figure on the Overview.

*Analytics.* An **Overview** of all four record types and a separate **KPI**
tab, thirteen decision metrics in four groups. Every figure carries its formula
and its caution behind an i button, and a metric that cannot be computed prints
its reason instead of a number — runway returns null and says why. Charts come
from the panel's own kit, now shared rather than living inside Users.

**Removed:** the verification vocabulary is gone for good; drafts and recurring
rules are gone (the last objects describing money that had not moved — the open
question in the entry below, now answered); Reconciliation is no longer a tab
but a block on the Overview, with nothing deleted from the store.

**Temp data**
`src/content/finance/module.json` → static config: `asOf` (**the clock the whole
module runs on**), the period, the accounts. `subscriptions.json` → 9
subscriptions covering every installment and subscription status.
`salaries.json` → 7 accounts and 3 runs, one of them open because the clock is
the 25th. `transactions.json` → 10 tags (3 custom, 1 deactivated) and 18 rows
including a reversed pair. `refunds.json` → 6 refunds across every state, four
of them manual. `vocabularies.json` → static copy: 5 record types, 10 metrics,
13 KPIs, 32 event types, 15 open decisions. `ledger.json`, `spend.json` and
`revenue.json` are **deleted** — superseded, and Analytics now derives months
from the records themselves so no second history file can disagree with a list.

**Backend needed**
- `GET /admin/finance/context` → the clock, period and accounts (`module.json`)
- `GET /admin/finance/subscriptions` · `…/{id}` → the schedule; Σ installments
  must equal the total, enforced server-side
- `GET /admin/finance/salary-accounts` · `…/salary-runs` → accounts joined to
  `AdminUserRow.id`; slips carry their own frozen components
- `GET /admin/finance/transactions` · `…/tags`, `GET /admin/finance/refunds`,
  `GET /admin/finance/vocabularies`
- 17 writes, FN-T01…T17, each with its sequence and its exact refusal — the
  full table is in BACKEND-INTEGRATION.md § Module 6
- `GET /admin/invoices/` — **already live**; Finance reads and never writes it

**Open decisions**
FN-AD-01…05 closed. FN-OD-01 (cash view, no accrual), 02 (bank matching is
simulated), 04 (who approves what), 05 (payroll scope — no statutory filing, no
PF challans, no gratuity, TDS entered not derived), **06 (new — salary cost is
net paid, employer PF and gratuity are not modelled, so cost per head
understates true cost)**, 07 (runway not shown), 08 (tax is a summary, not a
return), 12 (net, never profit), 14 (one supply, several invoices), **15 (new —
fail to pay is recorded and surfaced, not chased; retry, dunning and suspension
belong to other modules)**. Every one renders on the screen it affects.

**Verified**
`npx tsc -b` clean · `eslint src/admin/views/Finance src/admin/views/charts.tsx
--max-warnings=0` clean · `npm run build` clean · `npm run check:finance`
**227 assertions pass** · `npm run check:finance-render` renders every face,
record screen and dialog. Audited mechanically: no literal hex, rgb or colour
name anywhere in the module, and every `.fin-*` class used in TSX has CSS
behind it.

**Three real defects the check suite caught, fixed at the source rather than
asserted around:**
1. `setLop` pro-rated from the salary **account**, not the slip — so a raise
   granted after a run opened would silently rewrite a frozen slip, breaking the
   one rule the payslip exists to keep. Slips now carry `baseEarnings`, frozen
   at open, and loss of pay is computed from those. Setting it twice is now
   idempotent, and the suite asserts both.
2. `setLop` assumed a 30-day month while every seeded slip used the real one.
   Loss of pay is now a fraction of the actual calendar month.
3. `syncSubStatus` marked a subscription **completed** as soon as every
   installment was paid. A twelve-month plan settled up front on day one is paid
   in full with eleven months left to serve — calling that completed drops a
   live customer out of MRR the moment they pay. `completed` now requires the
   term served, which is what the vocabulary always said.

Also fixed: a dangling invoice reference (`IB-INV-2026-00071`, named by both a
subscription and a refund but never present), three salary event types missing
from the vocabulary that rendered with no label, and `actor()` reading session
fields that do not exist on `MePermissions`.

**Not checked:** nothing was clicked in a browser this pass. The SSR smoke
renders every surface but exercises no real click path, and the Team join is
against a live endpoint this checkout cannot reach — `memberId` is asserted for
shape, not for existence.

---

### Finance records facts: the whole verification lifecycle is gone

**Area:** `#/finance` — every face, both payment record screens, the dialog set
**Files:** `src/content/finance/{ledger,vocabularies,refunds,invoices}.json`,
`src/admin/views/Finance/{store.ts,Modals.tsx,index.tsx,Payments.tsx,
PaymentDetail.tsx,Spend.tsx,Reconciliation.tsx,Refunds.tsx,Revenue.tsx}`,
`finance.css`, `scripts/check-finance-ledger.cjs`, `scripts/fn-smoke.tsx`,
`BACKEND-INTEGRATION.md`

**What changed**

**Supersedes the verification half of the entry below.** That build treated a
payment as a *claim* until Finance approved it against a statement: states
`submitted` / `held` / `rejected`, an approve-hold-reject dialog, an "Awaiting
verification" money tile, a `verifiedBy` / `verifiedAt` pair on every row, and
a receipt withheld until approval. **A ledger row is now a fact.** Money is
written down because it moved; nothing is written down on the strength of
somebody's assertion that it will.

Recording a payment is one write that settles the invoice, drops the deal
balance, **issues the receipt** and counts as collected — there is no later
step that could change the answer, so there is no window in which two screens
disagree. Six states remain (`recorded` · `unmatched` · `reversed` ·
`returned` · `refund_requested` · `refunded`) and **none of them means
"pending a decision"**. `verifyPayment` and `holdUnallocated` no longer exist,
and the check suite asserts they are not exported — the premise is enforced,
not merely documented.

What survives is the one judgement that was never verification: an imported
credit matching no invoice is **unallocated** — real money whose *owner* is
unknown, not money whose *arrival* is in doubt — and a person decides whose it
is. "Match" is now **Allocate** throughout, for that reason. Statement import
stops being a second opinion: a line matching a recorded row just links the
two and appends MATCHED, changing nothing else, because the statement proves
the ledger is **complete**, not that a row is **true**.

Refund approval stays a four-eyes control. It is not a verification step —
it authorises money *leaving*, which no ledger row can assert on its own.

Contract renumbered contiguously to **FN-T01…T09** (verify and hold are gone);
`422 not_on_statement` is retired; a new invariant #10 forbids any future
endpoint from reintroducing a "recorded but not yet believed" state.

**Temp data**
`src/content/finance/ledger.json` → rewritten: `state` is one of the six above,
`recordedBy` / `recordedAt` replace the logged/verified pairs, and the rejected
row PAY-4397 is deleted (it recorded something that never happened). PAY-4401
is `recorded` with its receipt and `bankLineId: null`, so the import demo still
has a line to link. `invoices.json` → `IB-INV-2026-00091` is now `paid`, which
its recorded payment requires. `vocabularies.json` → static copy: six states,
`rejectReasons` deleted, `RECORDED` replaces `LOGGED`, SUBMITTED / VERIFIED /
HELD / REJECTED deleted, the `awaiting` metric deleted, FN-AD-01 retitled
"Recorded is what happened". All placeholder records except the vocabulary.

**Backend needed**
- `POST /admin/finance/payments` → **FN-T01 · Record payment.** Settles the
  invoice and issues the receipt in the same transaction. Replaces the former
  FN-T01 (log) + FN-T02 (verify) pair.
- `POST /admin/finance/payments/{id}/allocate` → **FN-T02**, from `unmatched`
  only, amount-exact. Replaces the former `…/match` + `…/hold`.
- `POST /admin/finance/payments/{id}/{approve,hold,reject}` → **do not build.**
- Everything else in Module 6's table is unchanged apart from renumbering.

**Open decisions**
FN-OD-02 (import is simulated, no live feed) is unchanged and still on screen.
Spend **drafts** — a recurring rule's output, and TXN-0912 — are the remaining
"has not happened yet" objects. They are deliberately kept: a draft is a stated
intent to pay, excluded from every total and labelled as intent, not a claim
that money moved. Say the word and they go too.

**Verified**
`npx tsc -b` clean · `eslint src/admin/views/Finance --max-warnings=0` clean ·
`npm run check:finance` all pass (the suite gained assertions that no row sits
in a decision-pending state, that a recorded payment settles its invoice on the
spot, and that verify/hold are unexported) · `npm run check:finance-render` all
surfaces render · `npm run build` clean. **Not checked:** nothing was clicked in
a browser this pass; the SSR smoke renders every face, record and dialog but
does not exercise a real click path.

---

### Finance CSS: `.fn` collided with the theme's funnel segment

**Area:** `#/finance` — every face
**Files:** `src/admin/views/Finance/*.tsx`, `finance.css`

**What changed**

The module namespaced itself `.fn`, which `admin-theme.css` already owns for
funnel segments — including `.fn:hover { background: var(--bg-hover) }`. Every
Finance screen is inside the module root, so hovering **any** table row tinted
the entire page instead of the row. Renamed the namespace to `.fin` / `.fin-*`
(474 references, 13 files), matched on `\bfn-` so `store.ts`'s `(fn: () =>
void)` callback parameters were left alone. The header comment in `finance.css`
records why the short name is unavailable, so nobody reclaims it.

**Temp data**
none

**Backend needed**
none

**Open decisions**
none

**Verified**
`tsc -b`, eslint, `npm run build` and both Finance check suites pass. The
collision itself was found from a screenshot, not from a check — no test
asserts that a module's namespace is unclaimed, and none does now either.

---

### Finance — the payment ledger Modules 1–3 kept deferring, plus spend, reconciliation, refunds and revenue

**Area:** `#/finance` — a new sidebar group **Finance**; five faces
(Payments · Spend · Reconciliation · Refunds · Revenue), three record screens
and fifteen dialogs
**Files:** `src/content/finance/{ledger,invoices,spend,bank,refunds,revenue,vocabularies}.json`,
`src/admin/views/Finance/{index,store,Frame,bits,InfoTip,Modals,Payments,PaymentDetail,Spend,
TransactionDetail,Reconciliation,Refunds,Revenue}.tsx`, `finance.css`,
`admin/shell/modules.ts`, `admin/auth/session.ts`, `admin/views/registry.tsx`,
`scripts/check-finance-ledger.cjs`, `scripts/fn-smoke.tsx`,
`scripts/build-fn-smoke.cjs`, `package.json`, `BACKEND-INTEGRATION.md`

**What changed**

Every rupee received now has a screen, whatever door it came through. **Three
paths, one append-only ledger**: a salesperson logs a payment on the deal, a
business self-reports a UTR, or a bank statement is imported — and the module
exists so those three cannot become three different answers to "did it land?".

*Payments.* The ledger with a money strip that separates what arrived
(verified) from what was merely claimed (awaiting), what nobody has allocated,
what Invoice says is still owed, and what was reversed. Verify a submission
against the bank — **approve, hold or reject**, where hold is the honest third
button because most submissions arrive before the bank feed does. Match
unallocated money to an invoice (amount-exact, 1:1), hold it as a liability,
or return it. **Reverse** (Super Admin) appends a counter-entry, leaves the
original untouched and cancels the invoice it settled — the one action that
reaches back into Module 3. The record carries the Deal → Quotation → Invoice
→ Payment chain, the frozen receipt document, and an append-only history. There
is **no Edit button at any role**: wrong amount, wrong invoice and wrong
customer are all corrected by reversing and re-entering.

*Spend.* Money out is a different object: a category and a bill, not a customer
and a receipt. Every row carries a tag from a closed list — **there is no
"uncategorised" and no "Other" with a text box**, because the fixed /
reinvestment split behind the profit line and CAC is computed from these tags.
Drafts (a recurring rule creates one, never a posting) sit apart from postings.
Categories and budgets warn at 90% and **never block** — rent still has to be
paid in a month the budget was set too low. Manual money IN is restricted to
interest, own-transfer and vendor refund, all flagged non-revenue.

*Reconciliation.* Bank statement against ledger, the only screen that can prove
the ledger is complete. Auto-match on **amount + reference only**; name
similarity is shown to help a person and never decides. Exceptions are matched,
written off, or carried forward explicitly with a reason — and **the Close
period button does not proceed while one is open**.

*Refunds.* A real object rather than a policy page: request → Super-Admin
decision, one of very few genuine four-eyes checks in the panel. The policy
check **frames** the approval rather than blocking it, so a genuine duplicate
can be processed instead of being issued outside the system. Approval appends a
REFUND counter-entry and **moves no money**.

*Revenue.* Collected from verified payments only, MRR and ARPU as levels, CAC
derived from tagged reinvestment spend (and `n/a`, never ₹0, with no new
payers), net after operating spend, the four plausible larger numbers this
screen must never use, and a Tax summary assembled from issued invoices for a
CA. Runway renders as **unavailable with the reason**, not as a placeholder.

Every KPI tile carries an i button with its formula and caution; every assumed
answer is a dashed `FN-OD` block on the screen it affects. All writes are
simulated in this browser tab and every screen says so.

**Temp data**
`src/content/finance/` → `ledger.json`, `invoices.json`, `spend.json`,
`bank.json`, `refunds.json`, `revenue.json` are **placeholder records**;
`vocabularies.json` is **static copy** (labels, cautions, metric definitions,
the decision register) and becomes no backend work. `invoices.json` is a
snapshot of the Invoice module only because this checkout has no backend — the
live `GET invoices/` and `payments/deal-ledger/` replace it. Customers, deals
and users line up with the existing seeds (DL-3310 Priya Nair / IB-U-1041,
DL-2291 Meera Iyer / IB-U-0944, DL-2396 Sandeep Kulkarni / IB-U-0975), so the
figures reconcile across modules rather than only inside this one.

**Backend needed**
- `GET/POST /admin/finance/payments` · `…/{id}/{approve,hold,reject,match,return,reverse}`
- `GET/POST /admin/finance/transactions` · `…/{id}/post` · `…/{id}/bill` · `GET/POST …/categories` · `GET …/recurring`
- `GET/POST /admin/finance/statements` · `…/{id}/close` · `GET …/reconciliation` · `POST …/reconciliation/{match,resolve}`
- `GET/POST /admin/finance/refunds` · `…/{id}/{approve,send-back,decline}`
- `GET /admin/finance/revenue?months=` · `GET …/vocabularies` · `GET …/export`
- `Module` row `finance` (group **Finance**) with a `super` sensitive action
- Full table, payload shapes, error contract and invariants: BACKEND-INTEGRATION.md § Module 6

**Open decisions**
FN-AD-01…05 resolved on screen. Open and assumed: FN-OD-01 cash basis · 02
statement import simulated, no live feed · 04 bill required above ₹25,000 and
Super Admin decides refunds · 05 **no Salary centre** — payroll is a category ·
07 **runway not shown** · 12 contribution, never profit · 14 invoice-per-receipt
(ID-03-R) surfaced on the tax summary. Register in `vocabularies.json`.

**Verified**
`npx tsc -b` and eslint clean. New `check:finance` (78 assertions over the real
store bundle) covers seed coherence, collected-is-verified-only, verify refusing
without a bank line, the simulated import, a close refused then accepted after
every row is resolved, amount-exact matching, the reversal that leaves the
original untouched, the refund lifecycle, and the spend rules. New
`check:finance-render` renders all five faces, every record screen and all
fifteen dialogs. Both are wired into `npm run check`. Three seed defects the
checks caught were fixed rather than asserted around: a July payment pointing at
an invoice and a bank line that did not exist, and an accrual dated inside a
closed window. **Not seen in a browser** — no backend on this checkout — so the
layout, the dark theme and the dialog behaviour are reasoned from the shared
tokens and primitives, not watched.

---

## 2026-09-01

### The payslip wears the brand; the draft alert comes off

**Area:** Finance - the payslip document
**Files:** `Slip.tsx`, `finance.css`, `scripts/fn-smoke.tsx`

**What changed**

The standing draft alert above the sheet is removed - the draft state was
already said twice on the page (the pill in the actions row, the stamp and
terms on the sheet itself), and a third telling was a lecture.

The sheet carries the company mark now: the IB logo beside the company
block, and the brand name as a watermark behind the whole document - text
at a whisper, rotated, aria-hidden and unselectable, so it prints from the
same markup, never reaches a screen reader, and never rides along in a
copy-paste. Light enough that every figure stays legible over it, on
screen and on paper.

**Verified**

`check:finance` 369; `fn-smoke` asserts the draft stamp on the sheet, the
watermark element and the logo - and no longer expects the removed alert.
How the watermark actually sits on paper is a print-preview look.

---

## 2026-09-01

### Transactions becomes the landing tab

**Area:** Finance · Salaries
**Files:** `Salaries.tsx`, `SalaryDetail.tsx`, `scripts/fn-smoke.tsx`

**What changed**

A bare `#/finance-salaries` opens on Transactions; Accounts carries
`?tab=accounts`. The accounts strip cells keep the tab in their links so a
cell press no longer falls out of the tab, and the account record's Back
targets the Accounts tab explicitly - a person record is only ever opened
from there, and its own `?tab` is its sub-tab and never travels. That Back
was also malformed before (`&` with no `?`); the explicit base fixed it.

**Verified**

`check:finance` 369; `fn-smoke` asserts the bare route lands on slip rows
and re-points the accounts assertions at `?tab=accounts`.

---

## 2026-09-01

### Analytics gains department-wise expenditure, modelled rather than guessed

**Area:** Finance analytics, the salary account, the seed
**Files:** `Analytics.tsx`, `SalaryModals.tsx`, `store.ts`, `types.ts`,
`salaries.json`, `scripts/check-finance-ledger.cjs`, `scripts/fn-smoke.tsx`,
`BACKEND-INTEGRATION.md`

**What changed**

**`department` joins the salary account** — typed when the account opens,
with the departments already in use offered as suggestions, because a
designation does not partition into departments by itself and a mapping
invented inside analytics code is a taxonomy nobody agreed to. The seven
seeded accounts are assigned: Leadership, Sales, Design, Operations.

**Analytics gets "Expenditure by department"** — one identity-hued bar per
department, summed off the PAID slips joined back to their accounts, all
time. All time rather than the period, because early in a month the period
figure is a column of zeros and a chart of zeros answers nothing; the
period's own number stays on the strip above. Salary only, said in the
foot — the non-salary side is the tag chart beside it, and the two are
never added. A blank department groups as **Unassigned**: a visible gap
somebody can fix, never a guess. The department is read off the account
like the PAN on a slip — identity, not money — so a person moved between
departments carries their history.

The page's other asks were already standing: the KPI tab, and the
month-by-month money chart, which spans every month the records touch and
becomes the yearly read as the records do.

**Verified**

`check:finance` 365 → 369 — the departments appear, their sum equals the
all-time paid figure exactly (one derivation read twice), sorted largest
first, and a blanked department groups as Unassigned. `fn-smoke` renders
the block with the seeded departments as bars and asserts no Unassigned
bar exists — against the tooltip format, since the footnote legitimately
explains the word.

---

## 2026-09-01

### The row menu wears the panel's clothes; Paid on never shows a bare dash

**Area:** Finance · Salaries · Transactions
**Files:** `SalaryTransactions.tsx`, `finance.css`

**What changed**

The actions menu had been styled from scratch — oversized rows, full-tone
text, its own everything — and looked like it. The items are now the
theme's own `.mi` rows, the same ones the shell's menus use: compact, an
icon in the slot, muted text that darkens on hover. Labels lost their
trailing ellipses and their padding words: **Pay · Hold slip · Release
hold · View slip · View account · Close account** (red, iconed, last).
The popover shell matches the panel's other menus — same surface, radius,
shadow and rise animation.

**Paid on never shows a bare dash.** An empty cell in a dated column reads
as data that failed to load. Unpaid: *not yet · pays with <name>'s next
payment*. Held: *not while held · release it to pay*. Paid keeps its date
and its ago.

**Verified**

`check:finance` 365, `fn-smoke` green. The menu is a click state — one
look in the browser.

---

## 2026-09-01

### The tab switch moves above the filters, styled as the panel's view band

**Area:** Finance · Salaries
**Files:** `Frame.tsx`, `Salaries.tsx`, `finance.css`

**What changed**

Accounts / Transactions was a segmented control BELOW the command row —
both the wrong clothes and the wrong floor. The tab changes WHAT the
filters narrow, so it belongs above them; and the panel already has a
shape for exactly this, the Users directory's view band. The switch is now
that band: banner → tabs → filters → strip → table, underline on the
active tab, an icon that lights with it, and the row count in the badge
(Accounts 7 · Transactions 21).

`Frame` grew a `tabs` slot above `cmd`, and the band's styles are restated
in `finance.css` because the Users stylesheet belongs to that module and
may not be loaded here. `SubTabs` remains for the switches that ARE
subordinate to a page (Transactions/Tags on the company ledger).

**Verified**

`check:finance` 365, `fn-smoke` green — both tab labels still asserted on
the rendered page.

---

## 2026-09-01

### The Accounts tab joins the panel's list anatomy too

**Area:** Finance · Salaries · Accounts
**Files:** `Salaries.tsx`, `store.ts`, `scripts/fn-smoke.tsx`

**What changed**

The previous entry brought the Transactions tab in line and left the
Accounts tab as it was — four tiles over the table, which is exactly what
the layout complaint was about. The tiles are gone. In their place, the
same compact strip every list carries:

    Total · ● Active · Closed | ● Unpaid · ● In arrears | Monthly payroll ₹…

Every cell is a filter — Active/Closed set `active`, Unpaid sets `due`,
and **In arrears is clickable now**, which the tile never was: `due=arrears`
is a new filter value, so the red count finally opens the list it counts.
The owed total lives in the Unpaid cell's tip. The payroll figure rides at
the end as a read-out **with its metric tip kept** — the render suite
caught it going missing, and the caution it carries is FN-OD-06: this is
net paid to people, not cost to company. "The people" section head went
the way of the Transactions one; the strip states the whole.

**Verified**

`check:finance` 365, `fn-smoke` green — the strip's Total and payroll
cells asserted, the salary-cost caution asserted reachable, chips reading
`due: In arrears` through the value-labeller.

---

## 2026-09-01

### The Transactions tab falls in line with the panel's list anatomy

**Area:** Finance · Salaries · Transactions
**Files:** `Salaries.tsx`, `SalaryTransactions.tsx`, `store.ts`,
`scripts/fn-smoke.tsx`

**What changed**

The tab was a table with its own section head and two filters — close, but
not the shape every other list in this panel has. It now follows the same
logic as the Users directory it was measured against:

- **A stat strip in the band**, not a heading over the table: **Total ·
  Paid · Unpaid · On hold**, each cell a filter that sets or clears
  `status` and nothing else — the search stays, because it is the scope
  somebody chose. Same `StatStrip`, same tips, same stated-whole rule.
- **A Month filter** joins Search and Status on the command row, built
  from the runs that exist.
- **Filter chips** now read properly: `status: On hold`, `month: Aug
  2026` — the shared value-labeller learned the slip states and the month
  key.
- **Paid on** is the panel's stacked date cell — the date, and how long
  ago beneath it.

**Verified**

`check:finance` 365, `fn-smoke` green — the strip's Total and On hold
cells asserted in the band, the actions menu and both pills as before.

---

## 2026-09-01

### Salaries splits into Accounts and Transactions, and a slip can be held

**Area:** Finance · Salaries — a second tab, and one new write
**Files:** `SalaryTransactions.tsx` (new), `Salaries.tsx`, `store.ts`,
`types.ts`, `finance.css`, `scripts/check-finance-ledger.cjs`,
`scripts/fn-smoke.tsx`, `BACKEND-INTEGRATION.md`

**What changed**

**Two readings of one payroll.** The Accounts tab is the existing face —
who is on the payroll, what they are owed. The new **Transactions** tab is
every slip ever issued, one row per document, newest month first: id and
run, person, net, status (Paid / Unpaid / On hold, with the hold's reason
under the pill), paid date — and an actions menu on every row. The money
strip sits above both; each tab keeps its own filters (name/slip search
and a status filter on Transactions), and switching tabs clears the other
tab's, because carrying one across would narrow a list with a control it
does not show.

**The row menu names its consequences**: *Pay…* (unpaid only, Super Admin
gated the same as everywhere), *Hold this slip… / Release the hold*,
*View slip*, *View account*, *Close the account…* — the same store writes
the rest of the module uses, never new ones.

**Hold is a slip state, not an account one.** A dispute is about a month:
holding March must not stop April going out. A held slip leaves `dueOf` —
the pending figure, the arrears count and the pay write all skip it — and
comes back the moment it is released. Only an unpaid slip can hold (a paid
document is frozen), the reason is mandatory on the way in because the
hold prints on no document, and the account timeline records both
directions with the figure.

**Backend needed**

FN-T08d in the doc: hold/release endpoints, the two refusal codes, and
the due-computation exclusion.

**Verified**

`check:finance` 352 → 365 — reason required, double-hold refused, the held
month leaves what is owed, paying refuses as nothing due, release restores
the figure and clears the reason, a paid slip refuses the hold. `fn-smoke`
renders the tab, both sub-tabs, slip rows with both pills, the per-row
actions menu, and the paid filter leaving no unpaid pill. The menu's
open/close and the hold dialog are click states — browser.

---

## 2026-09-01

### The Pay dialog, tightened: added rows, a receipt that reads as one, remark last

**Area:** Finance · the Pay dialog
**Files:** `SalaryModals.tsx`, `finance.css`, `scripts/fn-smoke.tsx`

**What changed**

**Adjustments are rows somebody ADDS.** Most payments have none, and two
blank fields on every payment is furniture. One button — *Add incentive or
deduction* — appends a row of kind-dropdown + amount + remove; at most one
row per kind, because the write takes one of each and a second row of
either would be two numbers pretending to be one. A kind the other row
holds is disabled in the dropdown rather than refused after.

**The success screen is a receipt, not a checklist.** The figure is the
headline, centred; under it the facts of the transfer — via and account,
months covered, the slip id — each on its own line; one quiet sentence
about the freeze. Done and Download slip unchanged.

**The remark moved to the bottom**, below the adjustments: it is the one
thing on the form that is ABOUT the whole payment rather than part of it,
written once everything above is settled — a note on the bottom of a
voucher.

**Payment via and Paid from share a row** — they are halves of one
decision — with cash showing a quiet "nothing to choose" in the second
cell instead of collapsing the grid.

**The Super Admin badge on the primary button was unreadable** — the
pill's own warn/bad colours on the button's green, worse when disabled.
Inside a primary button it borrows the button's own text colour.

**Verified**

`check:finance` 352, `fn-smoke` green — an untouched payment renders no
adjustment row, the Add button is present, the remark is asserted BELOW
the adjustments by position, and the month and "Leaving the account"
stay covered. The receipt screen and the add/remove behaviour are click
states — browser, as ever.

---

## 2026-09-01

### Pay-time incentives and deductions, and the payment gets a receipt screen

**Area:** Finance · the Pay dialog (FN-T08b), and the write behind it
**Files:** `SalaryModals.tsx`, `store.ts`, `finance.css`,
`scripts/check-finance-ledger.cjs`, `scripts/fn-smoke.tsx`,
`BACKEND-INTEGRATION.md`

**What changed**

**Adjustments on the payment.** The Pay dialog gains an optional Incentive
and an optional Deduction — each a name and an amount, because the figure
prints on the slip and a figure nobody can name is a figure nobody can
explain at audit. "Leaving the account" moves live as they are typed, by
the same arithmetic the write does.

**They land on the newest month's slip as named lines** — the incentive an
earning, the deduction a deduction — with the slip's totals and its run's
total recomputed in the same write, BEFORE the freeze stamps it. Money
that left the account but is on no document is exactly what this module
exists to prevent, so the slip stays the whole story of what was paid.
Three refusals guard it: a nameless amount, an unclean amount, and a
deduction that would push the slip below zero — a negative payslip is a
debt wearing a document's clothes. The refusing dialog shows the sentence;
the form disables Save the moment the deduction overdraws, with the limit
stated.

**The dialog becomes the receipt.** On success it stops being a form —
the money has left, so Cancel would be a lie — and shows *Paid
successfully*: what left, how many slips froze, and a **Download slip**
button that opens the newest month's slip document, where Download prints
it and Save as PDF produces the file. One renderer, one definition of
what the slip looks like.

**Backend needed**

FN-T08c in the doc: the two optional adjustment objects on the pay write,
the three refusal codes, the recompute-before-freeze ordering, and the
event log stating the adjusted figure that actually left.

**Verified**

`check:finance` 341 → 352 — the two refusals write nothing, the lines land
named on the right slip, net moves by exactly the difference, stored
totals still equal the slip's own arrays, the run total follows, and the
event names both lines and the adjusted figure. `fn-smoke` renders the
adjustments section, both named inputs, and the open run's month in the
summary. The success screen is reached by a click, which SSR does not
have — the receipt state and the navigation to the slip need the browser.

---

## 2026-08-29

### Users Management audited end to end: 14 logic bugs fixed, journeys unblocked, tint retired, contract corrected

**Area:** `#/users` — every face and the record; Edit profile, Assign, Lifecycle
dialogs; the modal shell
**Files:** `store.ts`, `LifecycleModal.tsx`, `AssignMembership.tsx`,
`EditProfile.tsx`, `Detail.tsx`, `List.tsx`, `RenewalQueue.tsx`, `index.tsx`,
`FacetPicker.tsx`, `InfoTip.tsx`, `HandleField.tsx`, `Modals.tsx`,
`shell/ShellContext.tsx`, `users.css`, `charts.css`, `assign.css`,
`memberships.json`, `vocabularies.json`, `scripts/check-users-derivation.cjs`,
`scripts/um-smoke.tsx`, `BACKEND-INTEGRATION.md`, `USERS-AUDIT-2026-08-29.md`

**What changed**

Four read-only audits (logic, journeys, theme, contracts) were run over the
module and everything CONFIRMED was fixed. The full register is in
`USERS-AUDIT-2026-08-29.md` beside this file; the headline items:

*Logic — the derivation was wrong under any second term.* `currentTerm` took
the newest-start row and `classify` looked only at it, so renewing an Active
Member — or assigning them a second product dated next month — demoted them to
Past Member and dropped them from the queue. Now any entitling term classifies,
the term the member HOLDS leads, and a paused/suspended/active term past its
end date reads as expired everywhere (`effectiveStatus`). One live term per
product is enforced at activate and renew, not only at assign. `activateNow`
is atomic. Renewal takes its OWN reference and starts the day after the old
term at 00:00 on the assignment date rule. One clock: writes stamp the module's
`NOW`, so timelines stop saying "in 4 days". `updateProfile` refuses
non-editable keys and blank text; tags are a closed list; "This year" is the
calendar year; the seeded Pending term can be activated (it carries
`pendingFeatures`); the active-term pointer is derived.

*Journeys.* Escape inside a picker or the i panel closes that, not the whole
dialog. The Cancel dialog's buttons no longer both read "Cancel". The
Commercial → term link opens the term (one navigation, `onParams`). Filters
visually reset when a chip is cleared. Queue rows carry the queue with them;
rows are keyboard-openable; modals focus the first real control and every ✕
has a name. Required fields are marked live and named beside Save; both big
dialogs ask before discarding a draft. Assign steps read 1-2-3, start from
`NOW`, link to Plans, and refuse activate-now on a feature-less plan with the
button. Account buttons say "account"; the renewal notice sits on the
Membership tab where Renew is; reactivate stops offering pause reasons.

*Theme.* Brand tint is no longer a surface anywhere in the module — chips,
ticked boxes, the list highlight, the assign summary and the i button are
neutral; the four form-only un-tint overrides that fought them are gone. Plan
tiers wear tag tones, not status/brand. Chart series 3 (light) and 2 (dark) no
longer equal the warn and ok solids; the lightest heat cell takes dark ink
(was 2.3:1). One inactive grey.

*Contract.* `v1/admin/users/` is already the RBAC sub-admin resource — the
platform-user API needs its own prefix. `BACKEND-INTEGRATION.md` now carries
that, plus `asOf`/`pausePolicy`/`pendingFeatures`, the T02 and T06 bodies,
two new error codes, the corrected vocabularies (four positioning values,
seven business types, open segments) and the `lifecycle` permission key.

**Temp data**
`memberships.json` → `IB-MB-0958-1.pendingFeatures[]` added (placeholder
record, the shape UM-T02 parks); `vocabularies.json` → `openDecisions[UM-OD-01]`
text closed, `$comment_businessFacets` corrected. Static copy otherwise.

**Backend needed**
- Prefix decision: `/admin/platform-users/…` (or equivalent) — see the doc
- `POST …/memberships/{id}/renew` → `{reference, reason?}`; `422 activation_source_required` without one
- `POST …/{id}/memberships` with `activateNow` as one transaction; `422 snapshot_unavailable`
- `PATCH …/{id}/profile` → `422 field_not_editable` for non-schema keys
- `GET …/username-available?u=` (unchanged ask, still missing)
- `Module` row `users` with a `lifecycle` sensitive action

**Open decisions**
None new. UM-OD-13 sharpened: two entitlement key schemes coexist (seeded
`listings.max` vs catalogue `feature.N`); UM-OD-04 noted — a paused term
inside the window is not in the queue under `continue`.

**Verified**
`npx tsc -b` and eslint clean over the module and the shell change.
`check:users` grew five blocks — classification after renew and after a
future-dated assignment, activate/renew conflicts, atomic activate-now, lapsed
terms, profile/tag/year guards — all passing; the renew block now asserts the
new source and the day-after start. `check:users-render` renders every
surface; its "no duration step until a plan is picked" assertion was rewritten
to the new contract (step 2 always renders, as a placeholder until then). Not
seen in a browser — no backend on this checkout — so the neutral chip/summary
skin, the focus change and the dirty-guard prompts are reasoned, not watched.

## 2026-08-29

### Target row: city chips under the box; sections get a firmer boundary

**Area:** Edit profile — Target (location rows), section layout
**Files:** `FacetPicker.tsx`, `AreaRows.tsx`, `users.css`

**What changed**

1. **City chips sit under the city box.** The picker's rule is chips ABOVE
   the control, so the box you type into never moves — right everywhere
   the picker stands alone. In a Target row it stands beside the state
   select, and chips above pushed the city box down so the row's two
   controls never lined up. `FacetPicker` grew a `chipsBelow` prop; the
   row's city half uses it, the rest of the form does not. Same chips,
   same remove control, same Backspace shortcut.
2. **Business profile → Target reads as a boundary at a scroll.** Between
   sections there is now more air above the rule than below it, so the
   section label attaches to what follows, and the rule is one shade
   firmer than the hairlines inside a section.

**Temp data**
none

**Backend needed**
- `none`

**Open decisions**
`none`

**Verified**
`npx tsc -b`, eslint clean; `check:users-render` renders every surface —
the chip assertions hold since the same Chips component renders, only
later in the row. Not seen in a browser (no backend on this checkout).

## 2026-08-29

### Edit profile: sections, not panels

**Area:** Edit profile — layout
**Files:** `users.css`

**What changed**

The group panels came off. Each fieldset was a tinted, bordered, rounded
well with a bordered legend — a surface inside a surface, and on a modal
that already has a header band and a footer band it read as boxes in a
box. Now the form is one plain column: a small-caps section label
(Business profile · Target · Positioning segment · About · Identity) in
the same voice as COMPLETENESS, a hairline between sections, quiet field
labels, and the controls carrying the ink. Completeness became one row —
label left, meter right — closing on the first divider, so header,
completeness, sections and footer stack as four bands of one page.
Supersedes the "contrast: the form is groups" panel note; the float/clear
mechanics that make a legend lay out are unchanged.

**Temp data**
none

**Backend needed**
- `none`

**Open decisions**
`none`

**Verified**
CSS only — the markup and its contract are untouched, and
`check:users-render` still renders every surface. Not seen in a browser
(no backend on this checkout): the spacing rhythm is reasoned from the
theme's space tokens, not screenshotted.

## 2026-08-29

### Record loses the PUBLIC marker; Positioning gains Premium and an i button

**Area:** User record → Profile tab; Edit profile → Positioning segment
**Files:** `Detail.tsx`, `EditProfile.tsx`, `users.css`, `vocabularies.json`,
`scripts/check-users-derivation.cjs`, `scripts/um-smoke.tsx`

**What changed**

1. **No PUBLIC tag on the record.** Every profile field wore a "public"
   pill next to its label — the same word twelve times, since nothing on
   the profile is internal any more. The marker and its CSS are gone; the
   schema's `public` flag stays, it just no longer prints.
2. **Positioning's note moves behind the i.** "Select up to 2. This is how
   the business positions its own work…" sat under the legend on every
   open of the form. It is now the field's `info` in the schema, so the
   legend shows the i button and the sentence costs one press exactly when
   somebody is unsure — the same pattern Business type uses.
3. **Premium is a positioning option again.** Luxury · Budget-friendly ·
   Custom · Premium, still up to two. Supersedes the entry that struck
   `premium` alongside `value` and `eco_friendly`; the latter two stay
   refused.

**Temp data**
`src/content/users/vocabularies.json` → `positioning` (+1 option),
`profileFields[positioning].info`; static copy, permanent.

**Backend needed**
- `none` — the vocabularies payload carries the option and the field's
  `info` sentence; the panel renders both from it.

**Open decisions**
`none`

**Verified**
`check:users`: positioning is "up to two of a closed four" — premium
accepted, value/eco-friendly refused, seed values inside the four.
`check:users-render`: six checkboxes (2 deals + 4 positioning), the i
button present on Positioning and the cap sentence absent from the form
markup, two tiles quiet at the cap for IB-U-0912. `npx tsc -b` and
eslint clean. Not seen in a browser — no backend on this checkout.

## 2026-08-29

### Edit profile: the tint comes off, State becomes a select, lists lead with interior

**Area:** Edit profile — Business type, Deals in, Segments, Categories, Location
**Files:** `FacetPicker.tsx`, `users.css`, `vocabularies.json`,
`scripts/um-smoke.tsx`

**What changed**

1. **No brand tint on the form.** Chips, a ticked Deals-in box, the
   Business type select and the list highlight all wore brand tint — four
   green surfaces arguing with the one primary button. On the form they
   are now neutral: raised surface, real border, text colour; a ticked box
   shows a brand border only. Scoped to `.um-form` — the record's
   read-only chips keep their facet tones, where colour still answers
   "which question is this". Supersedes the colour-by-facet note *for the
   form only*.
2. **Business type is a full-width select** in the same neutral skin as
   every other control, with a focus ring — it was a narrow tinted box
   between full-width rows.
3. **State reads as a select.** An answered closed single used to collapse
   to a chip plus a "Change" button — a two-part control for a one-value
   answer, and the only place on the form where the answer was not in the
   box. Now the box shows the answer under a chevron, read-only; a press
   turns it into the search field and opens the same list with the current
   value marked ✓. One control, matching Business type. Open singles
   (City) are unchanged — a typed value still needs a remove control.
4. **Segments and Categories lead with interior.** The picker shows the
   vocabulary in stored order, so the sequence is a product decision:
   interior design and execution first, then sanitary/plumbing supply,
   then adjacent trades (solar, lifts, pest control); sectors keep their
   group. `$comment_segmentOrder` / `$comment_categoryOrder` say why.

**Temp data**
`src/content/users/vocabularies.json` → `segments`, `categories` reordered;
static copy, permanent. No keys added or removed.

**Backend needed**
- `none` — vocabulary order is what `GET /api/v1/admin/users/vocabularies`
  should return; the panel renders lists in payload order.

**Open decisions**
`none`

**Verified**
`check:users-render`: the two "chip + Change" checks became "reads as a
select" — no `>Change<` in the tree, the `sellike` shell present, the
stored state shown as the box's value; chip-tone and picker-shell counts
unchanged. `check:users` (vocabulary derivation) passes on the reordered
lists. `npx tsc -b` and eslint clean. Not opened in a browser — no backend
on this checkout — so the chevron/focus styling is reasoned, not seen.

## 2026-08-29

### The modal, read as a whole: five fixes

**Area:** Edit profile — content and style
**Files:** `EditProfile.tsx`, `FacetPicker.tsx`, `AreaRows.tsx`, `store.ts`,
`vocabularies.json`, `users.css`, `scripts/um-smoke.tsx`

**What changed**

The modal was rendered to markup and read top to bottom as a reviewer
would. Five things came out of it:

1. **A group of one is its field.** "Positioning segment" sat over
   "Positioning", "About" over "About", "Target" over "Location" — the
   legend already named the thing. For a single-field group the field's
   own label row goes; the legend carries the asterisk and the i instead.
   Every control keeps its accessible name through `aria-label` — which
   turned up that the Location composite never had one at all.
2. **No empty fine-print line.** The state picker rendered an empty
   `<p>` under itself — a margin with nothing in it — on every row.
   The line renders only with content.
3. **One placeholder per field**, not one for all. "Type a phrase, or
   pick a suggestion" was serving segments, categories, cities and
   keywords, and "phrase" fit exactly one. Now: *Search or type a
   segment / a category / a city*, *Choose a state*, *Type a keyword,
   press Enter*. A schema `placeholder`, so the next field names its own.
4. **Deals in takes the full row** — it was a lone half-width row
   between two full-width neighbours.
5. Bare inputs and textareas carry `aria-label`, so nothing on the form
   is nameless.

**Verified**

`check:users-render` 119: the duplicate-label rule, the empty-line rule
and the per-field placeholders each asserted; the field-presence check
learned that a solo field's name is its legend and its control's
`aria-label`.

---

## 2026-08-29

### Positioning drops Eco-friendly

**Area:** the Positioning segment
**Files:** `vocabularies.json`, `users.json`,
`scripts/check-users-derivation.cjs`, `scripts/um-smoke.tsx`

**What changed**

Three tiles — Luxury · Budget-friendly · Custom — still up to two. The key
is stripped from the seed and asserted refused alongside the two removed
earlier.

---

## 2026-08-29

### Positioning: four tiles on one row, Budget-friendly added

**Area:** the Positioning segment
**Files:** `vocabularies.json`, `users.json`,
`scripts/check-users-derivation.cjs`, `scripts/um-smoke.tsx`

**What changed**

Budget-friendly joins — Luxury · Budget-friendly · Eco-friendly · Custom,
still up to two — and the field takes the full row (`wide` in the schema)
so the four tiles sit on one line instead of wrapping in a half-width
column. Four seeded profiles carry Budget-friendly where Value used to be.

**Verified**

`check:users` 281, `check:users-render` 119 — four tiles, full width, two
quiet at the cap.

---

## 2026-08-29

### Positioning drops Premium and Value

**Area:** the Positioning segment
**Files:** `vocabularies.json`, `users.json`,
`scripts/check-users-derivation.cjs`, `scripts/um-smoke.tsx`

**What changed**

Three tiles now — Luxury, Eco-friendly, Custom — still up to two. The two
removed keys are stripped from every seeded profile and asserted refused.

**Verified**

`check:users` 280 → 281, `check:users-render` 119.

---

## 2026-08-29

### Segments grow to the well-known ones

**Area:** the Segments dropdown
**Files:** `vocabularies.json`

**What changed**

Nineteen segments added, taken from the categories the big directories
already agree on — Google Business Profile, Houzz's professional
directory, and the Indian home-services platforms — and not already here:

Renovation & remodelling · Bathroom remodelling · Countertops & kitchen
tops · Wallpaper & wall panels · Upholstery & sofa repair · Carpets & rugs
· Doors & windows · Metal fabrication & railings · Home theatre & AV ·
Acoustic & soundproofing · Kitchen appliances · Solar & energy · Home
lifts & elevators · Structural engineer · Home staging · Art & decor
accessories · Roofing & sheds · Pest control · Deep cleaning.

Forty-one segments. Each carries its three-keyword explainer inside the
32-character rule; the list stays open, so anything still missing is
typed, not refused.

**Verified**

`check:users` 280, `check:users-render` 119 — the unique-key and explainer
length rules cover every new row.

---

## 2026-08-29

### Target, Location, and a Positioning segment

**Area:** the lower half of Edit profile
**Files:** `vocabularies.json`, `users.json`, `store.ts`, `EditProfile.tsx`,
`users.css`, `scripts/check-users-derivation.cjs`, `scripts/um-smoke.tsx`,
`BACKEND-INTEGRATION.md`

**What changed**

The coverage group is **Target**, and its field is **Location** — the
group names the question, the field names the answer.

**Positioning segment** is a new group between Target and About: five
checkbox tiles — Luxury, Premium, Value, Eco-friendly, Custom — of which
up to two may be ticked. The group keeps its note, because the note is
the instruction: *"Select up to 2. This is how the business positions its
own work — it keeps expectations aligned before a connection is made."* At
the cap the unticked tiles go quiet rather than refusing on click; the
limit is enforced by what can still be pressed. Optional, so the
incomplete set does not move; orange chips on the record.

**Temp data**

`positioning[]` vocabulary; the field on the schema; twelve seeded
profiles carry one or two values.

**Backend needed**

`positioning[]` on the profile — optional, closed to the five keys, at most
two. The doc is updated.

**Verified**

`check:users` 271 → 280, `check:users-render` 118 → 119. The cap and the
closed list asserted in the store; the five tiles, the stated cap and
exactly three quiet tiles on a two-value profile asserted in the render.

---

## 2026-08-29

### Segment explainers sharpened, two trades added

**Area:** the Segments dropdown
**Files:** `vocabularies.json`

**What changed**

Every explainer re-cut in buyer language — the words somebody searches,
three per row, each row separating itself from its neighbour: designer
*Concept, drawings, execution* against decorator *Decor, soft furnishing,
styling*; carpentry *Site carpentry, joinery, doors* against modular
*Modular kitchen, wardrobes*; flooring *Tiles, wooden, vinyl, epoxy*
against *Tiles, marble, sanitaryware*. All inside the 32-character cap the
suite enforces.

Two trades that are searched for and were missing: **Lighting** (fixtures,
LED profiles, decor) and **Waterproofing** (terrace, bathroom, basement).
Twenty-two segments.

**Verified**

`check:users` 271, `check:users-render` 118 — the length rule and the
unique-key rule cover the new rows.

---

## 2026-08-29

### The business types read from the practitioner up

**Area:** the Business type dropdown
**Files:** `vocabularies.json`, `scripts/check-users-derivation.cjs`,
`scripts/um-smoke.tsx`

**What changed**

The chain is reversed: Independent professional → Firm / Studio →
Contractor → Retailer → Wholesaler → Dealer → Manufacturer. Still a chain,
not a list — the direction now puts the portal's most common answer at the
top, and reads from who works alone up to who makes the goods.

**Verified**

Order asserted in schema and in the rendered options.

---

## 2026-08-29

### About closes the form

**Area:** Edit profile
**Files:** `vocabularies.json`, `EditProfile.tsx`, `scripts/um-smoke.tsx`

**What changed**

About moves from the Business group to its own group at the bottom, after
Target areas. It is the one free paragraph on the form, and a paragraph at
the top is what people write before they have answered the questions
underneath it — last, it is written knowing what the profile already says.

**Verified**

`check:users-render` 118: the form's order asserted end to end, About
asserted after Target areas and before the identity summary.

---

## 2026-08-29

### Display name goes; username and about join the Business group

**Area:** the Edit profile form and the profile schema
**Files:** `vocabularies.json`, `users.json`, `store.ts`, `EditProfile.tsx`,
`scripts/check-users-derivation.cjs`, `scripts/um-smoke.tsx`

**What changed**

**Display name is removed** — from the form, the schema, the type, the
search haystack and the seed. The identity's name is what every surface
prints; a second, editable name beside it was a field waiting to disagree
with the first.

**Username and About move into Business profile**, which leaves Basic
profile empty and gone. One business group now, reading top to bottom:
Business name → Username → About → Business type → Deals in → Segments →
Categories → Search keywords; then Target areas. The username sits under
the business name it is suggested from.

The incomplete set does not move: both profiles that lacked a business
still lack one.

**Verified**

`check:users` 271, `check:users-render` 117 → 118. Order of the leading
four asserted, Display name and an empty Basic group asserted absent, the
value asserted gone from the seed.

---

## 2026-08-29

### Firm / Studio joins the business types

**Area:** the Business type dropdown
**Files:** `vocabularies.json`, `users.json`,
`scripts/check-users-derivation.cjs`, `scripts/um-smoke.tsx`

**What changed**

**Firm / Studio** — a design practice with a team: studio, consultancy,
agency — sits between Contractor and Independent professional in the chain.
It is the grain two earlier entries flagged as missing: a design firm is
neither a site contractor nor a solo practitioner, and the seed had been
forcing it into one or the other.

Seven types now, still in chain order: makers, movers, sellers, then who
builds, who designs as a team, who works alone.

**Temp data**

`users.json` — the seven design firms (Meera Studio, Tara Design
Collective, Lokesh, Sharma, K. Iyer, Fernandes, Saloni) move to
`firm_studio`; the six trades that build stay Contractor; the two solo
practices stay Independent.

**Verified**

`check:users` 270 → 271, `check:users-render` 117. Chain order asserted in
schema and markup with the new entry in place; the three-way split of the
seed's service businesses asserted by count and, for Independent, by id.

---

## 2026-08-29

### The public/internal chips leave the form; Deals in moves under Business type

**Area:** Edit profile
**Files:** `EditProfile.tsx`, `vocabularies.json`, `scripts/um-smoke.tsx`

**What changed**

The public / internal marker is off every input. Every field on the form
is public now that the pincode is gone, and a chip that says the same word
twelve times is noise. The record's profile tab still marks each field —
that is where "what does the customer see" is a question worth answering.

Business type takes its own row (`wide` in the schema), so Deals in sits
beneath it rather than beside it: name, then type, then what they deal
in — top to bottom, one thing per row.

**Verified**

`check:users-render` 117: no `um-vis` on the form, Business type
full-width, Deals in after it.

---

## 2026-08-29

### Business type moves under Business name

**Area:** the Business profile group
**Files:** `vocabularies.json`, `store.ts`, `EditProfile.tsx`,
`scripts/um-smoke.tsx`

**What changed**

Business name takes the full row, so Business type sits beneath it (beside
Deals in) instead of beside it. Done as a schema flag — `wide: true` on the
field — because which field sits next to which is a decision about the
form, not about React, and the form still knows no field by name.

**Verified**

`check:users-render` 116 → 117: Business name asserted full-width and
Business type asserted after it.

---

## 2026-08-29

### Segments open up, and their explainers shrink to keywords

**Area:** the Segments field
**Files:** `vocabularies.json`, `scripts/check-users-derivation.cjs`,
`scripts/um-smoke.tsx`

**What changed**

**Segments are open now**, the same way Categories became open: type a
trade nobody listed, press Enter, it is a segment — stored as typed, never
coerced. Trades are a set nobody finishes enumerating either. Business type
is now the only closed facet on the form, and that is right: it is one
answer from a chain of six.

**The long option descriptions are gone**, replaced by a short keyword
explainer on every one of the twenty — two to four words that separate a
row from its neighbour ("Styling & finishes only", "Renders & walkthroughs",
"Runs site & vendors", "Electrical, plumbing, AC") rather than a sentence
that describes it. A dropdown row is read in the time it takes to scroll
past it. The suite asserts them by length, which is the only thing that
stops a row growing back into a paragraph.

**Temp data**

`vocabularies.json` — `open: true` and `maxLength` on the field; twenty
short hints.

**Backend needed**

`segments[]` accepts values outside the list — same contract as categories.

**Verified**

`check:users` 268 → 270, `check:users-render` 116. The write-path probe that
proved "the store refuses what the dialog refuses" had used an unknown
segment; segments no longer refuse, so it now uses an unknown business
type — the purpose survives, on a rule that still closes.

---

## 2026-08-29

### Categories become industries, and open

**Area:** the Categories field
**Files:** `vocabularies.json`, `users.json`,
`scripts/check-users-derivation.cjs`, `scripts/um-smoke.tsx`,
`BACKEND-INTEGRATION.md`

**What changed**

**Delivery model is gone** — Turnkey / Design & build / Design only /
Execution only / Consultation / Supply only. It was a third axis the form
was carrying under a heading that did not say so, and with Deals in
carrying "sells work", it had stopped earning its space.

**Categories are industries now**, twenty-six of them: sanitaryware & bath
fittings, home security & CCTV, lighting, flooring & tiles, marble & stone,
kitchen & appliances, wardrobes, furniture, mattresses, paints, wallpaper,
curtains, decor, false ceiling, doors & windows, glass & aluminium, plywood
& laminates, hardware, electricals, plumbing, HVAC, smart home, solar, water
treatment, fire safety, landscaping — under an **Industry** heading, with
the seven **Sector** entries (Residential, Commercial …) kept beneath.

**And the list is open.** Type an industry nobody listed, press Enter, it
is a category — stored as typed, shown as typed, never coerced. Industries
are a set nobody finishes enumerating; the list is a suggestion. Cap raised
to ten. The i button came off, since industries name themselves.

**Temp data**

`users.json` — delivery keys removed from every profile; industries derived
from the segments each profile already claims (modular kitchen → kitchen,
wardrobes; MEP → electricals, plumbing, HVAC …) so the seed keeps saying the
same thing in the new vocabulary rather than going blank.

**Backend needed**

`categories[]` accepts values outside `categories[]` — accept, trim,
de-duplicate case-insensitively, do not coerce. The doc is updated.

**Verified**

`check:users` 265 → 268, `check:users-render` 116. No delivery key
survives, sanitaryware and home security are present, a typed category is
accepted and a duplicate refused, and the open/closed split assertion now
lists categories on the open side.

**Still not verified:** typing-then-Enter is the browser's to confirm.

---

## 2026-08-29

### The username field stops printing its URL twice

**Area:** the Username field
**Files:** `HandleField.tsx`, `users.css`

**What changed**

The full profile URL printed under the username box is gone. The host
already sits inside the box as prefix text, so the line underneath was the
same string a second time, one row lower — clutter the prefix had made
unnecessary the day it arrived. Copy link still copies the full URL; the
availability verdict still reads under the box.

**Verified**

`tsc`, `eslint`, both suites, `vite build` green; nothing asserted on that
line, nothing to change.

---

## 2026-08-29

### Contractor returns, and the business types read as a chain

**Area:** the Business type dropdown
**Files:** `vocabularies.json`, `users.json`,
`scripts/check-users-derivation.cjs`, `scripts/um-smoke.tsx`

**What changed**

**Contractor is back** — the previous entry's judgement note was right: a
carpentry works or a ceilings firm as *Independent professional* was the
wrong grain. Independent narrows back to what its name says (one
practitioner, working alone) and Contractor takes the firms that execute
on site with a crew. The eleven profiles that hold an execution scope
return to it; the four solo practices stay Independent.

**The six types are ordered along the chain**, not alphabetically:

    Manufacturer → Dealer / Distributor → Wholesaler / Trader → Retailer / Showroom
    → Contractor → Independent professional

Who makes it, who moves it, who sells it, then the firm that builds and the
practitioner who works alone. A dropdown in this order reads as a supply
chain — which is what the type axis IS — where alphabetical read as a list.
The order is asserted on the rendered `<option>`s, because a `sort()`
anywhere between the schema and the markup would silently alphabetise it.

**Temp data**

`vocabularies.json` — `contractor` restored, list reordered, two hints
re-cut. `users.json` — eleven profiles back to `contractor` by the same
rule as before. The incomplete set does not move.

**Verified**

`check:users` 266 → 265 (five assertions became four), `check:users-render` 116. Chain order asserted in
the schema and in the markup; the Contractor/Independent split asserted on
the seed both ways.

---

## 2026-08-29

### The i sits right of the label, and opens with the field's own sentence

**Area:** the Business type field
**Files:** `EditProfile.tsx`, `InfoTip.tsx`, `store.ts`, `users.css`,
`vocabularies.json`, `scripts/um-smoke.tsx`,
`scripts/check-users-derivation.cjs`

**What changed**

The i button returns to the label row — immediately right of the label,
before the public/internal marker — for every field that has one. One place
to look, whatever the control below it is; the previous turn's "on the
dropdown" placement made Business type the only field whose i lived
somewhere else.

**The panel now opens with the field's own description**, above the option
meanings: *"What kind of business this is. It decides how the marketplace
treats them, so it is one answer, not several."* The sentence that was
removed from under the field in the declutter pass is back — one press
away, not in the flow. `info` in the schema grew from a flag into that
sentence: a string is the panel's opening line, `true` means options only.

Not `hint`: that key renders under the field, and the render suite asserts
no field has one. This text is FOR the panel.

**Temp data**

`vocabularies.json` — `businessType.info` is the sentence.

**Verified**

`check:users` 265 → 266, `check:users-render` 116. The i is asserted to sit
between the Business type label and its marker, the sentence asserted in
the schema and asserted absent from the form's flow.

---

## 2026-08-29

### Contractor leaves the business types; the i moves onto the dropdown

**Area:** the Business type field
**Files:** `EditProfile.tsx`, `users.css`, `vocabularies.json`, `users.json`,
`scripts/check-users-derivation.cjs`, `scripts/um-smoke.tsx`

**What changed**

**Contractor is removed**, one turn after Service provider and for the same
reason: with `dealsIn` carrying "sells work", the type axis is *where in
the chain you sit* — and every seller of work sits in one place on it. Five
types remain: Independent professional, Manufacturer, Dealer, Retailer,
Wholesaler. Independent's meaning widened to match ("as a practice or a
firm"), since it is now the one type for everybody who sells work rather
than stock.

**The i button sits on the dropdown itself**, beside the select, instead of
up on the label row. The meanings are the dropdown's, and the button should
be where the question is. Categories keeps its i on the label — it is a
picker, not a dropdown.

**Temp data**

`vocabularies.json` — `contractor` deleted, Independent's hint widened.
`users.json` — the eleven contractor profiles remapped to `independent`.
The incomplete set does not move.

**Backend needed**

`contractor` joins `service_provider` as a key to refuse, not coerce.

**Verified**

`check:users` 262 → 265, `check:users-render` 116. The type is gone from
vocabulary and seed, the five that remain are named, every services-only
profile is Independent, and the form offers neither removed option and
renders the i inside the dropdown's wrapper.

**A judgement to look at:** eleven firms — carpentry works, a ceilings
contractor, design-build studios — now read as *Independent professional*.
That is what the five-type list yields. If the seed reads wrong at that
grain, the answer is a sixth type (Firm / Studio), not the return of
Contractor.

---

## 2026-08-29

### "All cities" joins the city dropdown

**Area:** the target-area rows
**Files:** `store.ts`, `AreaRows.tsx`, `users.json`,
`scripts/check-users-derivation.cjs`, `scripts/um-smoke.tsx`

**What changed**

Every state's city dropdown now leads with **All cities** — whole-state
coverage as one pick, for the person who was about to type every city in.

It is a SENTINEL VALUE, not a flag on the row, so the picker, the chips, the
record and the payload all handle it as just another city; only the rules
around it are special:

- **It stands alone.** Picking it replaces the row's cities; picking a
  specific city afterwards narrows the claim, so the sentinel comes off. The
  validator refuses the mixed state, and the UI makes it unreachable rather
  than merely refused.
- **The city filter expands it** against the state's own suggestion list — a
  whole-state Rajasthan row answers for Jaipur. Without that, "All cities"
  would be weaker than listing three, which is backwards.
- The compact surfaces print the state for a whole-state row ("All cities"
  is a claim, not a place), and search ignores the sentinel so the word
  "all" surfaces nobody.

Seeded once: the Jaipur architecture practice now covers all of Rajasthan.

**Backend needed**

`targetAreas[].cities` may contain the literal `"All cities"`, alone in its
row; UM-T07 refuses it beside a specific city. The coverage filter expands
it server-side the same way.

**Verified**

`check:users` 255 → 262, `check:users-render` 115 → 116. The exclusivity
rule, the leading suggestion, both filter expansions, the compact-city
fallback and the search exclusion are each asserted.

**Still not verified:** the replace/narrow toggle is click behaviour — the
browser question, as ever.

---

## 2026-08-29

### The modal stops explaining itself

**Area:** Edit profile — every piece of prose on it
**Files:** `EditProfile.tsx`, `AreaRows.tsx`, `vocabularies.json`,
`scripts/um-smoke.tsx`

**What changed**

The form had grown a note under every group title, a sentence under half its
fields, a shield notice about transactional writes, and "graded against
profile v1" in its own header. Each one earned its place in some earlier
entry; together they made the modal read as documentation with fields in it,
and the actual controls were the quietest thing on it. All of it is gone:

- **Group legends are just names** — Basic profile, Business profile, Target
  areas. "What the marketplace matches and ranks on" said things the fields
  already say.
- **No field-level hint sentences render at all**, and the render suite now
  asserts that as a rule rather than field by field — placeholders and the
  n/max counters carry the guidance. The i buttons keep the option meanings
  one press away; the vocabulary keeps every hint for them.
- **The header drops the schema version**, the completeness label is one
  word, the identity legend is "Identity · read-only" without its paragraph,
  and the shield notice is deleted — the all-or-nothing write is a guarantee
  for the check suite and the file header, not furniture for every save.
- The empty-areas text and the pick-state prompt each lost their subordinate
  clause. Username's idle help is one line.

Nothing behavioural moved. The guarantees the prose described did not stop
being true — they stopped being on screen.

**Temp data**

`vocabularies.json` — `hint` deleted from every `profileFields` row (option
hints stay; they feed the i panels); `usernameRules.help` shortened.

**Backend needed**

Nothing.

**Open decisions**

None new.

**Verified**

`tsc -b`, `eslint`, `vite build` green; `check:users` 255,
`check:users-render` 115, with the hint test inverted: it used to assert a
particular hint was present, it now asserts NO field-level hint renders —
which is the assertion that stops the clutter growing back one helpful
sentence at a time.

**Still not verified:** whether the stripped form now reads as spare or as
bare is exactly the judgement a browser view exists for.

---

## 2026-08-29

### Business type simplifies to a dropdown; Deals in takes over "what do you sell"

**Area:** the Business profile group in Edit profile
**Files:** `InfoTip.tsx` (new), `EditProfile.tsx`, `FacetPicker.tsx`,
`store.ts`, `vocabularies.json`, `users.json`, `users.css`,
`scripts/um-smoke.tsx`, `scripts/check-users-derivation.cjs`,
`BACKEND-INTEGRATION.md`

**What changed**

**Service provider is removed, and `dealsIn` is the axis that replaced it.**
"What kind of entity is this" and "what do you sell" were tangled in one list:
a design-build firm typed as *Service provider* says nothing that
*Contractor + services* does not say better, and a type that repeats another
facet's answer gets picked instead of the real one. Six types remain —
Contractor, Independent professional, Manufacturer, Dealer, Retailer,
Wholesaler — and the selling question is its own field:

**Deals in: Products / Services — checkboxes, one or both, never neither.**
Two options that can combine are two checkboxes; a dropdown would hide what
was never worth hiding. Required with the rest of the business profile,
closed to exactly those two keys, refusing duplicates.

**Business type is a plain dropdown now, and the meanings moved behind an
i button.** The field hint under the control and the sentence on every
option row were the right information at the wrong volume — always on
screen, mostly already known. `InfoTip` puts them one press away, exactly
when somebody is unsure: a BUTTON with a dropdown panel rather than a hover
tooltip, because this is reference text and hover tips vanish mid-read, skip
touch, and skip keyboard focus half the time. Categories got the same
treatment — hint line removed, i button added, its option rows cleaned of
inline sentences (the grouped panel shows them, group headings intact).

All of it is schema-driven, three new field flags: `simple` (plain dropdown),
`info` (i button), and the `checks` type — so the next field that wants any
of this is a JSON row, not a component.

**Temp data**

`vocabularies.json` — `service_provider` deleted, `dealsIn[]` added, three
flags on two fields. `users.json` — the eight `service_provider` profiles
remapped: `contractor` where the profile holds an execution scope (turnkey /
design & build / execution only), `independent` otherwise; `dealsIn` seeded
from the type, with both values where a maker also executes (Verve Modular).
**The incomplete set did not move** — dealsIn was seeded wherever the other
required business fields already were, and the suite asserts it.

**Backend needed**

`dealsIn[]` on the profile payload and in the vocabularies; UM-T07 refuses an
unknown kind, an empty list on a business profile, and duplicates. The
`service_provider` key must not be accepted from old clients — refuse, do not
coerce.

**Open decisions**

None new.

**Verified**

`tsc -b`, `eslint`, `vite build` green. `check:users` 243 → 255,
`check:users-render` 113 → 115. Asserted: the type is gone from the
vocabulary AND the seed, the six that remain are named, all five dealsIn
rules, the seeded checkbox arriving checked, the hint sentences absent from
the form flow, no Service provider option on offer, and two i buttons.

**Still not verified:** the i panel opens on press, closes on Escape and
outside click — stateful behaviour SSR cannot exercise. The checkbox tiles
and the panel's position over the form below it are browser judgements.

---

## 2026-08-29

### Target areas become the location: state rows with open city lists

**Area:** the profile's location model, the Edit profile contact group
**Files:** `AreaRows.tsx` (new), `EditProfile.tsx`, `FacetPicker.tsx`,
`Detail.tsx`, `bits.tsx`, `store.ts`, `vocabularies.json`, `users.json`,
`users.css`, `scripts/um-smoke.tsx`, `scripts/check-users-derivation.cjs`,
`BACKEND-INTEGRATION.md`

**What changed**

**One location concept instead of two half ones.** The profile carried a
registered address (State · City · Pincode) and, separately, a member-only
chip list of free-text "target areas". Neither answered the marketplace's
actual question: nobody hires by registered address, and the free strings —
"Delhi", "delhi ncr", "Dwarka, Delhi" — were three spellings of one claim
that no filter could read. Both are gone. The contact group is now **Target
areas**, structured:

    [{ state, cities[] }]   ·   at most 5 states, 8 cities per row

**One row per state, added and removed as a tile.** Add state appends a row;
picking its state reveals its city picker; the remove control says it takes
the cities with it. States another row already holds leave the state list —
a duplicate row is impossible to express rather than refused after the fact.
Changing a row's state clears its cities, because city lists are per-state
and kept cities under a changed state are wrong quietly. Add is disabled
while the last row is half-filled: the button must not offer what the save
will refuse.

**Half closed, half open, per row — the module's standing split applied
inside one field.** The state is a closed key, which is what makes rows
aggregate. The cities are open with per-state suggestions (`stateCities` in
the vocabulary), because "Uttam Nagar" is a real service area and no list
holds every locality. Delhi's suggestions are its localities, because
locality IS the useful grain in a city-state.

**The old chip field and Pincode are removed**, with the pieces they leaned
on: `areaSuggestions` gave way to `stateCities`, the member-only `showWhen`
came off (coverage is everyone's location now — the gate machinery stays,
asserted with a synthetic field), and the seed's flat strings were folded
into rows: "Uttam Nagar, Delhi" the string became Delhi → Uttam Nagar the
row. Same claim, now in a shape a filter can read.

**What follows from "this is the location now":** the list's City filter
means coverage (any row naming the city, or a Delhi-style state match); the
search haystack indexes every state and city in the rows; and the compact
surfaces — the directory cell, the record subline — print the first row's
first city via one `primaryCityOf()`.

**Temp data**

`vocabularies.json` — `stateCities{}` per-state suggestions, states grown to
eleven, `areaSuggestions` deleted, the schema down to nine fields.
`users.json` — every profile's strings folded into rows; state/city/pincode
keys deleted.

**THE RE-GRADE IS DELIBERATE THIS TIME.** Removing Pincode promoted
IB-U-1038, whose only gap it was: the incomplete count is 3 → 2, and the two
that remain are the two with no business profile at all. The check suite
names all of this explicitly, so an accidental second re-grade cannot hide
behind the deliberate one.

**Backend needed**

`PATCH /admin/users/{id}/profile` enforces the row rules — unknown state,
duplicate state, empty cities, over-cap all refuse the whole write. The
list's `city` filter is a coverage query server-side too. The doc carries
the shape and the caps.

**Open decisions**

None new; UM-OD-09 already covers who owns the vocabularies, and
`stateCities` joins that question.

**Verified**

`tsc -b`, `eslint`, `vite build` green. `check:users` 234 → 243,
`check:users-render` 113 stays 113 (six rewritten, three added, five retired with the old shape). The seed's rows are proven sound (every
state a real key, no duplicates, no half rows, every seeded state has
suggestions to offer), the validator's nine row rules are asserted case by
case, and the render suite covers the tiles, the named remove control, the
everyone-is-asked change and the locality's survival under its state.

**Still not verified:** the row interaction — add, pick, remove, the state
change clearing cities — is exactly the kind of stateful behaviour SSR
cannot exercise. The tiles render; whether they behave is a browser
question, and the module's standing caveat applies with extra force here.

---

## 2026-08-29

### Colour-by-facet chips, and the alignment pass the modal was owed

**Area:** the Edit profile modal, the profile tab's chips
**Files:** `users.css`, `EditProfile.tsx`, `FacetPicker.tsx`, `Detail.tsx`,
`store.ts`, `vocabularies.json`, `scripts/um-smoke.tsx`,
`scripts/check-users-derivation.cjs`

**What changed**

**The chips are multi-colour now, and the colour is information.** One tone per
FACET, never per value: Business type wears violet, Segments green, Categories
blue, Search keywords amber, Target areas teal, and the two location singles
share slate on purpose — they are halves of one answer. The tone is declared on
the field in `vocabularies.json` and worn identically on the form and the
record, so the colour answers "which question is this the answer to" before the
label is read. A palette rotating per chip would have been decoration
pretending to be information, which is the same rule the charts follow. All six
tones come from the theme's existing tag palette — nothing new to validate in
either mode. A stale chip still displaces its tone for warn: a value the
vocabulary dropped must not wear the colours of one it still has.

The tones are restated in `users.css` at higher specificity because the brand
default would silently beat the theme's two-class `tag-*` rules — and that
"silently" is covered: the check suite asserts every declared tone is one the
stylesheet restates, every chip-rendering facet declares one, and no two
marketplace facets share a colour.

**Alignment.** Three fixes, one cause each:

- **State · City · Pincode are one row again.** Every single-pick facet had
  been given the full width on the theory its listbox needed the room — but
  the listbox is absolutely positioned and overlays the neighbour anyway, so
  the width bought nothing and cost the layout: three short answers to one
  question ("where") stacked as three separate thoughts. Singles are
  half-width now, and the contact group is a three-column row. Textareas
  gained the full width instead, which they genuinely use.
- **Business name and Business type pair up** on one row for the same reason,
  and About stretches.
- **The public/internal markers align in a column.** They sat wherever each
  label happened to end, so "which of these is public" meant reading every
  row. The marker sits at the row edge now — one scannable column per group.

**And a dead-rule find:** the module's `@container` fallbacks — the ones meant
to collapse the two-column grid on a narrow pane — had never fired, because
nothing anywhere declared a container to fire against. They were dead the day
they were written. `.um-form` now declares `container-type: inline-size`, the
grids genuinely collapse (3 → 2 → 1 for the new row), and the row-gap grew to
give labels their breathing room.

**Temp data**

`vocabularies.json` — a `chip` tone on seven `profileFields` entries. No
records touched.

**Backend needed**

Nothing new — `chip` rides the same `profileFields[]` payload the form is
already built from, so the tone is server-adjustable like everything else
about a field.

**Open decisions**

None new.

**Verified**

`tsc -b`, `eslint`, `vite build` green. `check:users` 231 → 234,
`check:users-render` 111 → 113. The tone contract is asserted end to end:
declared tones are known tones, every facet has one, no two marketplace facets
share one, the markup actually carries them on both surfaces, and the stale
branch still displaces them.

**Still not verified:** the colours themselves, in a browser, in both themes —
the tag palette is the theme's own, but whether six tones on one form read as
organisation or as carnival is a judgement a string cannot make. The three-way
grid collapse needs a narrow window; the container fix makes the queries fire,
and no browser has confirmed they fire at the right widths.

---

## 2026-08-29

### First browser contact: the floated legend broke the form, and the fix is one clear

**Area:** the Edit profile panels
**Files:** `users.css`

**What changed**

The first time this module was ever opened in a browser, the profile form was
broken: every panel rendered empty, all the fields hung in a sliver off the
modal's right edge, and the dialog grew a horizontal scrollbar.

**The cause was the panel legend's float, missing its clear.** `float: left;
width: 100%` is the only way to make a `<legend>` lay out as normal content —
but the `.um-f2` grid that follows it establishes its own formatting context,
and a box like that is not allowed to flow under a float: it is placed BESIDE
it, in whatever width remains. Beside a 100%-wide float that is zero, so the
grid collapsed to its min-content width and hung off the panel's right edge.
Bootstrap's reset ships `legend + * { clear: both }` next to the float for
exactly this reason; this module now does too.

Two more UA quirks got their guards while the file was open, both of the same
species — default minimums that refuse to shrink:

- **fieldsets carry a UA `min-width: min-content`** no other element has, which
  is what would hand the whole dialog a horizontal scrollbar on a narrow pane;
  `min-width: 0` on the panel turns it off.
- **grid items default to `min-width: auto`**, so a picker placeholder or the
  handle's host prefix could re-create the overflow one level down;
  `.um-f2 > * { min-width: 0 }` floors them.

The handle field's flex was also over-constrained — the base `.inp` says
`width: 100%`, which fights the flexbox it now sits in. The input takes
`flex: 1` with `width: auto`, the host prefix takes `flex: 0 1 auto` with a
clip, so when the pane is too narrow it is the HOST that gives way and never
the handle being typed.

**Temp data**

None touched.

**Backend needed**

Nothing — CSS only.

**Open decisions**

None new.

**Verified**

`tsc -b`, `eslint`, both suites and `vite build` all green — but note what that
list is worth here: every one of them was green while the form was broken,
which is the point. This bug was invisible to the entire harness, because the
harness renders strings and this was geometry. It is the module's standing
"never opened in a browser" caveat collecting its first debt, and the reason
that caveat keeps appearing at the bottom of these entries.

**Still not verified:** the fix itself, in a browser, by the person who saw the
break — the reasoning is solid and the pattern is Bootstrap's, but the proof is
the same screenshot taken again.

---

## 2026-08-29

### A username with an address, target areas for members, and a form you can see the groups in

**Area:** the profile schema, Edit profile, the profile tab, the form's contrast
**Files:** `HandleField.tsx` (new), `FacetPicker.tsx`, `EditProfile.tsx`,
`Detail.tsx`, `store.ts`, `List.tsx`, `RenewalQueue.tsx`, `vocabularies.json`,
`users.json`, `users.css`, `scripts/um-smoke.tsx`,
`scripts/check-users-derivation.cjs`, `BACKEND-INTEGRATION.md`

**What changed**

**Portfolio link is gone**, along with `locality` and `addressLine`. The
contact group is now **State · City · Pincode**, in that order, and it is
called *Where they are* rather than *Address and contact*, which is what it now
holds.

State is a closed list; **City is open**. That asymmetry is the point: there
are 28 states and a few thousand cities, and the eight in the suggestion list
are the ones the platform sees most, not a limit. A closed city field would
make the form unable to record where somebody actually is.

**Username, and it is an address rather than a text field.** A handle is what
the profile is reachable at, what gets shared, and the one value on this form
that another profile can already be holding — so the control shows all three
at once instead of making somebody press Save to find out:

- the host sits **inside** the box as prefix text, so the field reads as one
  address rather than a text box near a label
- the URL spells itself out underneath, greyed while the handle is invalid,
  because watching the address form up as you type is what teaches that this
  field *is* the address
- three verdicts, said differently: **malformed** (your mistake, fixable from
  the message), **taken** (not your mistake, and re-reading will not fix it,
  so it offers `-studio` and `-interiors`), **available** — said out loud,
  because the absence of an error is not confirmation and people re-check
  silence
- **Copy link only appears once the handle is saved AND free.** Typing a valid
  handle does not put a page on the internet, and a button handing somebody a
  link to a profile that does not exist yet is worse than no button — they will
  paste it somewhere

Typing is slugified live rather than rejected afterwards: somebody typing
"Meera Studio" means `meera-studio`, and a form that knows that should not make
them discover it by failing.

**Target areas, for members only.** Where they will travel to work, which is a
different question from where they are registered — a Noida studio taking
Gurugram jobs is the normal case. Free text with suggestions, because
"Uttam Nagar, Delhi" is a real service area and no closed list holds every
locality in the country; the suggestions carry the **format** (locality then
city, or city then state) because a column half "Delhi" and half "delhi ncr
region" cannot be matched against an enquiry.

"Member" here means **holds a term or ever held one**, not "currently
entitled". Narrower and a lapsed member's stored areas would go invisible and
uneditable the day their term expired — that is data going out of reach, not a
field being tidied away.

**`open` became a flag, and that was overdue.** It was `type === "tags"`, which
made *accepts free text* and *holds a list* the same decision. They are not:
City is one value that accepts anything, Target areas is a list that does,
Segments is a list that does not. The split now sits where it was actually
decided — **closed**: business type, segments, categories, state (what the
marketplace filters and ranks on); **open**: city, search keywords, target
areas (sets nobody can enumerate). There is an assertion whose only job is to
catch somebody later "fixing" a facet by loosening it.

**The schema is conditional now**, so every read of it goes through
`fieldsFor(row)` — the patch builder and the required-field check included.
Two lists would mean the form validating a field it never showed.

**Contrast.** Three groups separated by a bold legend and some air is not a
boundary on a white modal over a white page; it reads as one long column while
you are trying to answer one part of it. Each group is now a panel with its own
ground and a hairline rule. Inputs invert on it — the panel is the well, so the
control is the raised thing, or they vanish into what they sit on.

**Chips got louder.** A chip *is* the answer to its field; the picker below it
is only how you got there. On the neutral `.pill` ground they were a grey on a
grey and lost every time. They now take the brand tint, a real border and a
control's height rather than a label's. Stale chips keep their warning colours
— a value the vocabulary has dropped must not read like one it has.

**Temp data**

`vocabularies.json` — `areaSuggestions[]`, `reservedUsernames[]` and
`usernameRules{}` are new; `states[]` and `cities[]` became `{key,label}` lists
because the form picks from them now as well as filtering on them;
`profileFields` rewritten.

`users.json` — usernames seeded from business names (slugified, collisions
suffixed the way the API will have to), target areas for the eighteen profiles
that have a business, and `portfolioUrl` / `locality` / `addressLine` deleted.

**Completeness still does not move**, and it is asserted twice. `state` and
`city` became required and every profile already had both. `username` became
required and **nobody** had one — so it is seeded for exactly the profiles that
already satisfy the other business fields, and left null for the two with no
business at all. Same three incomplete profiles, by id: IB-U-1038, IB-U-1029,
IB-U-0601.

**Backend needed**

**A new endpoint: `GET /admin/users/username-available?u=…`.** The panel checks
its own loaded rows, which is a prototype's answer and not a correct one — it
cannot see a profile outside the page or one created a second ago. It must
apply the same `usernameRules`, because a handle the client calls well formed
and the server calls reserved is worse than no check: the failure lands on
Save. Rate-limit it; it is an enumeration surface even behind an admin session.

`PATCH /admin/users/{id}/profile` gains the handle rules **and a uniqueness
check that is a real database constraint**, not a read-then-write in
application code — two people registering at once would otherwise both be told
they were first.

`GET /admin/users/{id}` sends `username`, `targetAreas[]` and `state`, and no
longer sends `portfolioUrl`, `locality` or `addressLine`. `city` must accept
values outside `cities[]` and **must not coerce them** to the nearest known
one.

**Open decisions**

**UM-OD-09 widens again**: a username is permanent in practice, so who may
change one, and what happens to the old address when somebody does, is a
decision this module cannot make on its own. There is no redirect story here.

**Verified**

`tsc -b` clean; `eslint` clean on the module and `scripts/`; `vite build`
succeeds. `check:users` 183 → 231, `check:users-render` 100 → 111.

The handle rules are asserted case by case — upper case, too short, too long,
leading and trailing hyphens, double hyphens, spaces, underscores, reserved
words — plus that `slugify` never emits a handle its own rules would refuse,
that every seeded handle is well formed, and that no two share one. The seam
between the two kinds of check is pinned down explicitly: `validateFacets`
refuses a *malformed* handle and deliberately does **not** refuse a taken one,
because uniqueness needs the whole table and lives in `updateProfile`.

`fieldApplies` is asserted against every row in the seed rather than against an
example: target areas applies to exactly active, paused, suspended and past
members, and to nobody else.

**Still not verified: everything that made this look better.** The panels, the
chip contrast, the handle field's inline host and its copy button have never
been rendered by a browser — SSR gives back a string, and a string cannot
answer whether the contrast is actually stronger, whether the brand tint holds
up in dark mode, or whether `navigator.clipboard` is reachable on the origin
this is served from. The clipboard call is wrapped, so it fails quietly rather
than throwing, which is also untested. Nothing in this module has been opened
in a browser yet, and this entry is the one where that matters most.

---

## 2026-08-29

### Two topbar figures, plainer classification names, and a strip that scrolls

**Area:** the topbar, the classification vocabulary, the stat strip
**Files:** `index.tsx`, `List.tsx`, `Analytics.tsx`, `Detail.tsx`, `store.ts`,
`vocabularies.json`, `audit.json`, `admin-theme.css`, `scripts/um-smoke.tsx`

**What changed**

**Expiring soon left the topbar.** Two figures there now: Total users and
Active Membership. It was the wrong kind of number for that bar — an
operational queue that moves on its own every night, sitting next to two
figures that describe how big the base is. A number that changes when nobody
touched anything reads as noise in a strip meant to hold still. It keeps both
of the places that can actually act on it: the Renewals tab and the strip cell,
each of which opens the list it counts, which the topbar never could.

The chrome key dropped it too. `usePageChrome` re-renders the topbar when its
key changes, and a key still naming a figure the topbar no longer shows means
the bar re-renders for a number nobody can see.

**Plainer names.** `Normal User` → **User**, `Former Member` → **Past Member**.
"Normal" was answering a question nobody asked — normal as opposed to what? —
and it read as a judgement about the person rather than a statement about their
membership. "Former" is accurate and cold; "Past Member" is the same fact
without the finality, which matters on a list whose entire purpose is winning
them back.

A classification label is on screen in six places — the pill, the strip cell,
the filter dropdown, the empty state, an analytics tile and the seeded audit
notes — so the rename is six renames, and the metric definition and the
`Still to convert` subtitle went with it. The strip cell reads **Past Members**
in the plural because it counts people; the pill stays singular because it
labels one.

**The strip scrolls now, and it did not before.** `.dls-attn` has said
`overflow-x:auto` since it was written, but `.dls-stat` never said
`flex:0 0 auto` — and a flex item shrinks below its content by default. So the
cells compressed to fit instead of overflowing, the overflow the scroll was
waiting for never happened, and with `white-space:nowrap` on top the row
clipped its own labels rather than letting you reach them. Nine cells is where
the Users strip sits; the fix is not fewer cells, it is a row that admits it is
wider than the pane. `.tb-stat` in the topbar has always carried that rule,
which is why that strip has always scrolled.

The first cell keeps `padding-left:0` on the page gutter, so Total lines up
under the command row above and the first table column below — the strip reads
as a header for the list rather than a floating band — and it gained a
`scroll-margin-left` so that alignment survives a keyboard focus scrolling the
row sideways.

This is a fix in `admin-theme.css`, so **every stat strip in the panel gets
it** — Deals and Business Enquiries included. Both squash today.

**Temp data**

`vocabularies.json` — two classification labels, one metric label and one
metric caution. `audit.json` — three seeded timeline notes that spelled
"Classified Normal User" and are read on screen.

**Backend needed**

None. `classifications[]` already ships its labels from
`GET /admin/users/vocabularies` and the panel has always rendered from it, so
this is a content change, not a contract change. The **keys** are untouched:
`normal` and `former_member` are what filters, reports and saved searches key
on, and renaming those to match the labels would break every stored link for a
cosmetic gain.

**Open decisions**

None new.

**Verified**

`tsc -b` clean; `eslint` clean on the module and `scripts/`; `vite build`
succeeds. `check:users` 183, `check:users-render` 97 → 100.

The three new render assertions check the half of a rename that gets missed —
the **absence**. `Normal User` and `Former Member` appear on no surface: not
the list, the members view, a record, its audit tab or the analytics page. Then
the presence, on both renders of the vocabulary entry that are easy to think of
as one: the strip cell and the pill on a record. The past member's id is
derived from the seed rather than written down, after the first attempt
hard-coded a user who turned out to be an active member.

**Still not verified: the topbar, again, and now the scroll.** The topbar is
set in an effect the SSR harness does not run, so "Expiring soon is gone from
it" is asserted nowhere — only that removing it did not take the figure out of
the two places that remain. And `flex:0 0 auto` is a claim about layout, which
is precisely what a string of HTML cannot answer: whether the strip actually
scrolls, whether the scrollbar is reachable, and whether the other two modules
look better or worse for it all need a browser.

---

## 2026-08-29

### The business profile gets four facets, and one picker to fill them

**Area:** Edit profile, the profile tab on the record, the profile schema
**Files:** `FacetPicker.tsx` (new), `EditProfile.tsx`, `Detail.tsx`, `store.ts`,
`vocabularies.json`, `users.json`, `users.css`, `scripts/um-smoke.tsx`,
`scripts/check-users-derivation.cjs`, `BACKEND-INTEGRATION.md`

**What changed**

**Four facets replace two fields that were pretending to be four.** The profile
had `category` — one string, from a seven-item list that mixed design studios
with plywood shops — and `services`, a comma-separated text box. Neither was
read by anything: no filter, no export, no analytic. They were a taxonomy in
name only. They are gone, and in their place:

| Facet | Shape | Answers |
| --- | --- | --- |
| **Business type** | one key, closed | What kind of entity is this |
| **Segments** | up to 6 keys, closed | What do they actually do or deal in |
| **Categories** | up to 8 keys, closed, grouped | How much of the job do they hold, and for which sector |
| **Search keywords** | up to 12, **open** | What would a customer type |

**They are orthogonal on purpose, not a hierarchy.** *Manufacturer + Modular
kitchen* and *Service provider + Modular kitchen* are different businesses and
it takes both facets to say so — one sells you a kitchen, the other designs the
room it goes in. A single "category" list cannot express that, which is why the
old one had to choose between describing trades and describing disciplines, and
ended up doing neither.

**Three closed, one open, and that split is the whole design.** Business type,
Segments and Categories refuse anything outside the vocabulary. They are what
the marketplace filters and ranks on, and free text fragments a facet inside a
month: "3D Designer", "3d designer" and "3D visualiser" become three buckets
holding one thing, and every one of them ranks worse than the single bucket
would have. Search keywords accept anything, because matching is the one job
where the tail nobody enumerated is the point — "complete home decor" is not a
taxonomy entry and should not have to be. The split is one flag per field in
the JSON, so it is a decision rather than a wall.

**Categories is grouped because it is two questions.** Turnkey is a *delivery
model* and Residential is a *sector*; a flat list containing both makes somebody
picking "Turnkey" feel they have answered the sector question when they have
not. The picker renders them under **Delivery model** and **Sector** headings,
so the shape of the question is visible in the shape of the menu. Both groups
are asserted non-empty — a category with a typo'd group would render under no
heading, which in a grouped listbox means it does not render at all.

**The caps are stated, not just enforced.** Six segments, eight categories,
twelve keywords, each with a live `3/6` counter beside the field. A profile
claiming every segment is claiming none, and a limit somebody only discovers by
being refused is a limit they experience as a bug.

**Taxonomy.** Seven business types along the axis that actually matters for a
portal — where you sit in the chain and what you bill for: Service provider,
Contractor, Independent professional, Manufacturer, Dealer/Distributor,
Retailer/Showroom, Wholesaler/Trader. Each carries a sentence, because Dealer
vs Retailer vs Wholesaler is not self-evident and a native `<select>` has
nowhere to put the distinction. Twenty segments spanning both service
disciplines (interior designer, architect, 3D visualiser, MEP, PMC, Vastu) and
product trades (plywood & laminates, tiles & sanitaryware, furniture) — the
business type is what says which side of that line somebody is on. Thirteen
categories in the two groups. Thirty keyword suggestions phrased the way people
search rather than the way a form gets filled in.

**One control, four behaviours: `FacetPicker`.** Chosen by the field's `type`,
not built four times — four components drift, and the keyword field grows a
clear-all the segment field never gets. It follows the WAI-ARIA combobox
pattern: `role="combobox"` on the input, the popup a `listbox`, the active
option tracked with `aria-activedescendant` rather than by moving focus,
Escape closes, Backspace on an empty box takes the last chip back.

**The chips sit ABOVE the control, not inside it.** Chips-in-the-input is the
more common pattern and it is worse here: the box grows as you pick, the form
reflows under the cursor, and by the fifth keyword the field you are typing into
has moved somewhere else on the page. Above it, the answer accumulates in one
place and the input never moves. Picked options leave the list rather than
sitting in it greyed out — the list is what you can still do, and a menu mostly
made of things you have already done is a menu people stop reading.

**Keys are stored; labels are shown.** All three closed facets hold vocabulary
keys. A key the vocabulary has since dropped renders as itself, flagged, rather
than vanishing — a chip that silently disappears is a data migration nobody
finds out about.

**The form no longer knows any field by name.** It used to:
`if (f.key === "services")`, twice, for the one comma-separated field — which is
exactly how a data-driven form stops being one. The schema now carries a `type`
and `EditProfile` dispatches on it, which is why four facets arrived without a
line in that file mentioning any of them. That property is UM-OD-09's whole
point and it is one `if` away from being lost again.

**Validation moved to the store.** `validateFacets()` sits beside the
derivation, not in the dialog, for the reason the plan rules did: a rule the
form owns is a rule the API does not have, and the moment a second caller
appears — an import, a bulk edit, the customer's own profile page — it is
enforced nowhere. `updateProfile()` calls it before touching anything, so a
refused write still leaves the stored profile byte-identical.

**Temp data**

`vocabularies.json` — `businessTypes`, `segments`, `categories` (rewritten from
a flat seven-item list into thirteen grouped entries), `categoryGroups` and
`keywordSuggestions` are new; `profileFields` gained `type`, `vocab`, `groups`,
`max`, `maxLength` and `hint` on every row.

`users.json` — all twenty profiles migrated. **Completeness does not move.**
`businessType` and `segments` replace `category` and `services` one for one and
both stay required, so the required set is still six fields and the incomplete
count is still 3. Anything else would have silently re-graded nineteen people
as a side effect of a vocabulary change, and that is asserted rather than
hoped for.

**Backend needed**

`PATCH /admin/users/{id}/profile` (UM-T07) must enforce the facet rules itself —
unknown key, over cap, or the same key twice must all be refused, and an unknown
key must **not** be coerced to the nearest known one, because a value quietly
rewritten is worse than one that matches nobody. `searchKeywords` is the open
one: trim, collapse whitespace, de-duplicate case-insensitively keeping the
first spelling.

`GET /admin/users/{id}` sends the four facets on `profile{}` as **keys, not
labels**, and `GET /admin/users/vocabularies` gains the four vocabularies plus
`categoryGroups`. `profileFields[].type` is load-bearing — it is what picks the
control — so a new facet is a row in that payload, not a code change.

**Open decisions**

**UM-OD-09 widened.** It covered the field set and the visibility rules; it now
also covers **who owns the facet vocabularies**. Segments and Categories are
marketplace taxonomy rather than user data — somebody has to be able to add a
segment without a deploy, and whoever that is needs a screen this module does
not have.

**Verified**

`tsc -b` clean; `eslint` clean on the module and `scripts/`; `vite build`
succeeds. `check:users` 144 → 183, `check:users-render` 87 → 97.

The derivation assertions cover the vocabularies (unique keys, no orphan
groups, nothing missing a label or a hint), the seed being inside them, the
migration's one invariant (business type and segments travel together, and the
incomplete count did not move), and every rule the closed lists enforce:
unknown key, duplicate, over-cap, over-long keyword, and that a refused write
leaves the stored profile untouched.

The render assertions cover the outcome of the schema-driven rule rather than
the rule — every schema field reached the form, each got the control its `type`
asks for, the chips carry resolved labels rather than raw keys, the cap is on
screen, and exactly one facet is free text.

**Still not verified: the picker has never been opened.** SSR runs no effects
and the listbox only exists while it is open, so the assertions cover the closed
state and the option text is checked against the vocabulary instead. Nothing
here proves keyboard navigation works, that the popup is positioned correctly,
that it does not run off the bottom of a short modal, or that the sticky group
headings behave while scrolling. Those need a browser, and no part of this
module has been in one yet.

---

## 2026-08-29

### Counts get names: a highlighted total, a stated whole, and one figure per tab

**Area:** the topbar strip, the view band, the stat strip on Users and Members
**Files:** `index.tsx`, `List.tsx`, `store.ts`, `Analytics.tsx`,
`RenewalQueue.tsx`, `admin-theme.css`, `vocabularies.json`,
`scripts/um-smoke.tsx`, `scripts/check-users-derivation.cjs`

**What changed**

**The topbar names its figures and highlights one.** `users · members · ending
soon` became **Total users · Active Membership · Expiring soon**, and Total
users carries a brand tint. Three equal grey figures make you read all three to
find out which one the page is about; one highlighted figure with two beside it
says the module is a population and the other two are qualifications of it.

The tint is a new `.tb-stat.hi` rather than the existing `.on`. `.on` means
*this filter is applied* everywhere else in the panel, and these three chips are
read-outs that filter nothing — a chip claiming a state it cannot have is the
kind of borrowed class that later gets "fixed" by making it clickable. The rule
carries a companion `.tb-stat.ro.hi:hover`, which is not redundant:
`.tb-stat.ro:hover` is the more specific selector, so without it the tint drops
out from under the cursor on a cell that does not react to the cursor at all.

**The stat strip states its whole.** Both scopes now lead with **Total**,
followed by a separator, the way Deals and Business Enquiries already do.
Without it the strip is a row of parts with no stated sum and nobody can tell
whether they are meant to add up — on Users they do (20 = 6 + 7 + 1 + 2 + 3 + 1),
on Members they do not, because Pending, Incomplete and Deactivated cut across
the classification rather than partitioning it. Total clears the breakdown
filters only. A search or a city is the scope somebody chose, and a cell called
Total should not quietly throw that away.

**`normal` is off the screen.** It was internal vocabulary — the key behind
`classify()` — printed as a label. The cell is now **Users**, and every other
cell is sentence case: Total, Users, Active members, Paused, Suspended, Former,
Pending, Incomplete, Deactivated. This diverges from Deals and Business
Enquiries, which are lower-case throughout; the divergence is deliberate here
and the two older modules are the ones now out of step.

**One name for one thing.** "Ending soon" and "Expiring soon" were the same
figure under two names across the topbar, the strip and two analytics blocks,
plus an "Ending soonest" sort option. All now read *expiring*. Two names for
one number is how two definitions of it start.

**The view band counts every tab, and counts them once.** Users and Members
carry a figure beside their label as Renewals already did. The number came from
somewhere different on each face — the queue counted renewals off the *filtered*
set, analytics off the whole set, and the lists did not count at all — so one
chip could show two different numbers depending on which face you were standing
on. `bandCounts(rows)` in `store.ts` is now the only way any face computes them,
and every face passes the same argument: the whole row set, never its own scoped
or filtered population. The band is navigation. A tab whose figure moves while
you type in the search box is reporting on the search rather than on the tab.

`MEMBER_CLASSES` moved from `List.tsx` into `store.ts` for the same reason —
the band prints the size of the Members face on a tab, and a tab that disagreed
with the page it opens would be worse than no tab figure at all. One array, read
by both.

**Temp data**

`vocabularies.json` — one sort label, "Ending soonest" → "Expiring soonest". No
records touched.

**Backend needed**

None. Every figure here is derived client-side from `users.json` +
`memberships.json` by the same `classify()` the filters use, which is what stops
a tab and the list behind it disagreeing. Nothing new to serve.

**Open decisions**

None new.

**Verified**

`tsc -b` clean; `eslint` clean on the module and `scripts/`; `vite build`
succeeds. `check:users` 137 → 144, `check:users-render` 79 → 87.

The seven derivation assertions pin the band to the faces it points at: Users
equals every row, Members equals the Members face's own population computed from
`MEMBER_CLASSES`, Renewals equals pending plus expiring, and a search that
demonstrably narrows the list moves none of them.

The eight render assertions cover the labels: Total is present on both scopes
and does **not** follow a filter down, `normal` is absent, "Users" and "Active
members" are present, no strip cell begins lower-case, "ending soon" is gone
from Members, and the three band figures are identical across all four faces and
unchanged by a search.

**Still not verified: the three topbar chips, including the highlight.** They
reach the shell through `usePageChrome`, which sets them in a `useEffect`, and
`renderToStaticMarkup` does not run effects — the topbar is empty in the harness
by construction, not by oversight. The tint, its contrast in both themes and
whether it survives the topbar's overflow scroll all need a browser. Nothing in
this module has been opened in one yet.

---

## 2026-08-25

### Assignment reads the real plan catalogue; three sources; Term becomes Duration

**Area:** the Assign membership dialog, and everything that touched the old catalogue
**Files:** `AssignMembership.tsx`, `store.ts`, `memberships.json`,
`vocabularies.json`, `analytics.json`, `membership-plans.json` (deleted),
`assign.css` (new), `bits.tsx`, `Detail.tsx`, `LifecycleModal.tsx`, `List.tsx`,
`RenewalQueue.tsx`, `index.tsx`, `scripts/um-smoke-plans-stub.tsx` (new),
`scripts/um-smoke.tsx`, `scripts/build-um-smoke.cjs`,
`scripts/check-users-derivation.cjs`, `BACKEND-INTEGRATION.md`

**What changed**

**The plans are the real ones, and `membership-plans.json` is deleted.** This
module shipped its own catalogue, which is two sources of truth for one price:
reprice Growth in the Plans module and this form would have carried on selling
the old number until a member queried an invoice. The dialog now reads
`v1/admin/plans/` through the Plans module's own `usePlans()` — the same
Subscription and PlanBillingCycle rows the public plans page charges from.
**UM-OD-01 is closed**, and the answer is consume, never define.

**The billing cycle IS the duration.** The real catalogue has no "plan
versions"; it has a plan with cycles, each a number of months and a price.
That is what a member buys, so it is what the form picks and what the term
freezes. Choosing a plan fills the duration in with that plan's **cheapest
active cycle** — cheapest rather than longest, because that is where a buyer
lands and this form should not default somebody into a longer commitment — and
only the chosen one is carried onto the term. The step is called **Duration**;
nothing is called Term any more.

**Three sources, not five.** `new_sale`, `renewal`, `complimentary`. The old
list mixed two different questions — WHY the term exists and WHERE the money is
recorded — and the second is not a source, it is a reference, which is one
field below. Five near-synonyms get picked inconsistently and every analytic
built on the choice inherits the inconsistency. The seed's eighteen terms were
migrated: anything with a `previousMembershipId` is a renewal, the rest are new
sales.

**A term is now self-sufficient.** `versionId`/`planVersion` are gone, replaced
by `cycle{months,price,currency}` alongside the frozen `planName` and
`entitlements[]`. Nothing on a record, a list or the analytics reads the
catalogue — which is what lets a term render correctly after its plan is
repriced, renamed or archived, and render **at all** when the catalogue is
unreachable. Only assignment and renewal need it live.

**Renewal stopped repricing people.** It used to re-read the catalogue and move
the member onto the current version silently. It now carries the same plan and
the same duration forward: moving somebody to a different plan or length is an
assignment, and repricing a member on their behalf is a commercial decision a
Renew button must not take — and not one this module can take at all now the
catalogue belongs to Plans.

**Clearer form.** Six numbered steps whose shape matches the question: plans and
durations are cards you press, the source is a radio list with its consequence
written beside each option, and the last block is a summary restating the sale
in the member's terms — plan, months, price, dates, source — because a form
whose effect you must reconstruct from six scattered controls is one people
submit without reading. No plan is preselected, so the duration step does not
appear until there is a plan to have a duration of.

**Temp data**

`membership-plans.json` — **deleted**, not replaced. `memberships.json` —
migrated: `versionId`/`planVersion` out, `cycle{months,price,currency}` in,
source kinds remapped, and the event notes that named plan versions rewritten.
`vocabularies.json` — `activationSources` reduced to three.
`analytics.json` — gained `planLabels`, because the analytics series is
historical and a plan renamed last quarter still has months attributed to it;
a catalogue lookup would leave those months labelled with a raw key.

**Backend needed**

`GET /admin/plans/` — **already live**, now a dependency of this module.
`GET /admin/users/{id}/memberships` — the row shape changed and
[BACKEND-INTEGRATION.md](BACKEND-INTEGRATION.md) is updated: `cycle` replaces
the version fields, **the row must be self-sufficient** (no field may need a
catalogue lookup to render), and `planCode` is the stable grouping key rather
than `planId`. UM-T02 resolves the plan and cycle against the live catalogue
and refuses one that is off sale, archived or has no active cycle; UM-T06
carries the previous term's plan and cycle forward.

**Open decisions**

**UM-OD-01 closed.** UM-OD-03 (complimentary) narrowed to one of three sources
with a mandatory reason. No new ones.

**Verified**

`tsc -b` clean from cold; `eslint` clean on the module and `scripts/`;
`vite build` succeeds at 848.60 kB. `check:users` grew 112 → 137;
`check:users-render` 72 → 79.

The render harness gained a **switchable Plans stub**, because the catalogue is
somebody else's service now and the form has four states rather than one — three
of them that service failing. All four are asserted: the populated catalogue
(and that off-sale, archived and no-active-cycle plans are filtered out of it),
the unreachable case (stated, and no invented fallback), the empty case, and
loading.

The plan rules moved out of the dialog into `store.ts` — `isSellable`,
`defaultCycleOf`, `planCodeOf`, `clashFor`, `liveTermsOf` — which is where the
derivation lives and, more usefully, where they can be unit-tested with no
browser and no catalogue. Twelve new assertions cover them directly.

**That move caught a real bug.** The dialog computed its duplicate warning on
`planCode` while `assignMembership()` refused on `planId` — so the warning could
appear while the save went through, or the save could be refused with nothing on
screen explaining why. Both call `clashFor()` now. `planId` was the wrong key
regardless: it is the catalogue's own, and it moves with migrations.

**Still not verified:** no browser. Nothing here proves the form is usable —
only that it renders every state, applies the right rules, and refuses what it
should. The plan cards, the duration cards and the summary block have not been
looked at, in either theme.

## 2026-08-25

### Analytics gets cards, a two-up grid, and a range picker that actually re-cuts the numbers

**Area:** `#/users?view=analytics`
**Files:** `analytics.json`, `store.ts`, `Analytics.tsx`, `Frame.tsx`,
`DateRange.tsx` (new), `blocks.css` (new), `index.tsx`, `scripts/um-smoke.tsx`,
`BACKEND-INTEGRATION.md`

**What changed**

**Thirteen loose sections became thirteen cards in a two-up grid.** The page was
one column of heading-plus-chart pairs, which at that length reads as an
undifferentiated scroll: nothing marks where an idea starts, and every figure
looks equally important because none has an edge. Each figure is now a `card`
with a title, a subtitle saying what it counts, and a footer carrying the
caveat — what it does not say, what it must not be added to, which decision it
assumes. The grid is `auto-fit` with a 430px minimum, so it is one column on a
laptop half-screen and two on a monitor without a breakpoint to maintain; the
column chart, cohort grid, KPI row and definitions table opt out with `wide`.

**`analytics.json` is now month-keyed, and that is the whole reason the date
picker means anything.** It shipped pre-summed `periods: {30d, 90d}`, which can
only ever answer the two windows somebody thought of — a range control over that
shape is decoration. It now carries twelve `months[]` rows, each with its own
**numerators and denominators**: `cohortEligible` for conversion,
`renewalEligible` for renewal rate, `churnEligible` + `churnLost` for churn,
plus `bySource` and `byPlan` breakdowns that sum exactly to the month's totals.
`rangeTotals()` sums the span and **recomputes every rate from its own pair** —
no stored percentage, because a percentage cannot be re-aggregated over a
different span without lying. `activeAtEnd` is a level and is read from the last
month rather than summed.

**The picker is a month grid, not a day calendar.** The series is monthly, so a
day-precision control would promise a resolution the data does not have — the
figure would not move when you dragged the end a week and would jump when you
moved it a day. Two clicks, hover-preview of the span, presets that set the same
two months the grid does, and **which preset is lit is derived from the range**,
so a hand-picked span that happens to equal six months lights that chip and
there is never a preset disagreeing with the dates beside it.

**Two cards say the range does not apply to them**, rather than quietly
pretending it does: cohort retention is cohort-keyed by nature, and revenue is
settled by Finance on its own calendar and is labelled with the window it
actually covers.

**Everything from "Registered to member" down was rebuilt.** Conversion,
retention, cohorts, status, sources, plans, revenue, engagement, queues, recent
activity and definitions are all cards now, all range-driven where the range
applies, each with its denominator stated on the tile and its caveat in the
footer.

**Temp data**

`src/content/users/analytics.json` — **replaced.** `periods`, `growth`, `funnel`,
`acquisition` and `planPerformance` are gone, folded into twelve `months[]` rows
carrying numerators, denominators and both breakdowns. `cohorts`,
`revenueContext` and `engagement: null` are unchanged. Every per-month sum was
generated and verified exact (`bySource` to registrations and first-time
members; `byPlan` to first-time members, renewals and expiries).

**Backend needed**

`GET /admin/users/analytics` — the contract changed shape and
[BACKEND-INTEGRATION.md](BACKEND-INTEGRATION.md) is updated: month rows with
numerator/denominator pairs, **never a stored rate**, breakdowns that sum to the
row, `activeAtEnd` marked as a level. Everything else is unchanged.

**Open decisions**

None new. `UM-OD-11` sits on the cohort card and `UM-OD-12` on revenue, where
they bite.

**Verified**

`tsc -b` clean from cold; `eslint` clean on the module and `scripts/`;
`vite build` succeeds at 851.24 kB (up 7.7 kB from the last pass for the picker
and the extra nine months of seed; still below the 859.34 kB this module's UI
work started at). `npm run check:users` — 112 assertions, unchanged.

`check:users-render` grew 60 → 72. Six render the analytics page at different
spans; six assert the layout and the control. Four of those are the ones worth
having, because a range control that renders and changes nothing is worse than
none — it invites a decision on a figure that never re-cut:

- a 3-month and a 12-month range must not render identically;
- a **reversed** range (`start` after `end`) must normalise to the same markup as
  the forward one rather than being refused;
- an **out-of-bounds** range must clamp to the series rather than render empty;
- the **oldest** span must say it has no prior span to compare against, instead
  of showing a delta against nothing.

One collision was caught while wiring it: the range params were `from`/`to`,
which the users list already owns for its custom registration window — and
switching faces carries filters across, so one click from a narrowed list would
have handed the picker two ISO dates and meant something entirely different by
them. They are `start`/`end` now.

**Still not verified:** no browser. The assertions prove the range re-cuts the
figures, the marks are sized correctly and the cards are there; they prove
nothing about how the two-up grid actually wraps, whether the calendar popover
is positioned sensibly near the right edge, dark mode, or keyboard and
screen-reader behaviour.

## 2026-08-25

### Analytics absorbs Overview, and gets real charts

**Area:** `#/users` · the view band, and `?view=analytics`
**Files:** `charts.tsx` (new), `charts.css` (new), `Analytics.tsx`, `Frame.tsx`,
`index.tsx`, `List.tsx`, `bits.tsx`, `users.css`, `Overview.tsx` (deleted),
`scripts/um-smoke.tsx`

**What changed**

**Four faces, not five.** Overview and Analytics were two dashboards over one
population — the same headline counts with different windows, agreeing only
because both called the same derivation. Overview is deleted and its content is
in Analytics: the base tiles, the operational queues, the recent-activity feed
and the engagement-unavailable block all moved. **Directory is now Users**, and
it is the default face: `#/users` carries no `view` param and opens on the list,
which is what the address reads like and what somebody arriving at a user
directory usually wants.

**Six charts, each picked by the data's job rather than by what looked good.**

| Chart | Form | Colour job |
| --- | --- | --- |
| Registrations vs first-time members vs renewals | grouped columns | categorical, 3 slots |
| Registered → member | horizontal stages | ordinal ramp |
| Membership status mix | horizontal bars | **reserved status tokens** |
| Cohort retention | heatmap, 3 buckets | sequential |
| By acquisition source | horizontal bars | one hue |
| By plan | horizontal bars | ordinal ramp |

Grouped and not stacked, because stacking would imply the three quantities sum
to something — and the one thing this module has to keep straight is that
renewals are not part of first-time members. Plans take an **ordinal** ramp
because Starter→Growth→Pro is a sequence and the colour should carry it; sources
take **one hue** because they are names, and shading them by size would say the
bar length twice. Membership states wear the **reserved status tokens** and
never a categorical slot, because they mean something.

**The palette was computed, not chosen.** Every set was run through the data-viz
validator against this panel's own ramps and its own surfaces, in both modes,
before any chart code existed — the results and the failures are recorded at the
top of `charts.css`. Light categorical clears worst-adjacent CVD ΔE 9.5 and
normal-vision 16.9 at ≥3:1 contrast; dark clears 12.9 / 16.4. Four obvious picks
failed and are written down so nobody re-picks them: `green-9 #0c6b57` is below
the chroma floor and reads gray; `#61d195` and `#d99b20` sit above the dark
lightness band; `#264070` misses the light-end contrast floor as a dark ramp
anchor. **The dark steps are a selection, not a flip.**

**No chart library.** `recharts` is a declared dependency that nothing imported
and that was not in the bundle; pulling it in for six simple forms would have
added roughly a hundred kilobytes gzipped to a bundle already past the size
warning, and it themes badly against CSS custom properties that swap with the
viewer's theme. The kit is CSS, so it is responsive without viewBox arithmetic
and dark mode is a token swap. The bundle went **down** — 859.34 kB before this
module's UI work, 843.52 kB now, charts included.

**Temp data**

Unchanged. `analytics.json` already carried `growth.months[]`,
`funnel.stages[]`, `acquisition.sources[]`, `cohorts` and `planPerformance`;
nothing was added for the charts, which is the point of having shaped that file
like the endpoint rather than like a component.

**Backend needed**

Unchanged. One doc correction: `#/users?view=directory` is `#/users`, and
"the directory filter" now reads "the users list filter" in
[BACKEND-INTEGRATION.md](BACKEND-INTEGRATION.md).

**Open decisions**

None new. `UM-OD-10` (engagement) and `UM-OD-11` (churn window) still render as
markers on the sections they gate; `UM-OD-12` sits under revenue context.

**Verified**

`tsc -b` clean from cold; `eslint` clean on the module and `scripts/`;
`vite build` succeeds. `npm run check:users` — 112 assertions, unchanged.

`npm run check:users-render` grew from 43 to 60 assertions. Thirteen assert each
chart form reached the DOM **on the right kind of colour token** — the class is
the assertion because it encodes the colour's job (`s1..s3` categorical,
`o1..o3` ordinal, `st-*` reserved status), and a chart that quietly switched
jobs would still render and still be wrong. Four are geometric, standing in for
the eyeball pass there is no browser here to do: every mark's percentage stays
inside 0–100, something reaches full width (so the scale is tight), the tick
count equals the gridline count, and the x-labels equal the column groups.

Two layout faults were found and fixed by writing those:

- The y-axis ticks could not sit on their gridlines. Both were distributed with
  `space-between` in separate flex columns, but the label boxes have height and
  the rules do not — only the middle label ever landed on its rule. Ticks and
  rules are now positioned from one list at the same percentages.
- Direct-labelling all three columns of the final group would have collided:
  three ~20px numbers in a group that is ~70px wide at container widths this
  panel actually hits. A label that will not fit must not be placed, so one
  series is labelled — the tallest, which anchors the scale — and the three
  tiles under the chart carry the current period at a size that cannot collide.

**Still not verified:** no browser. Server-rendered markup and the geometry
assertions prove the marks are sized and counted correctly; they prove nothing
about rendered type metrics, the tooltips actually appearing on hover, the
heatmap at narrow widths, dark mode, or keyboard and screen-reader behaviour.
The palette is validated arithmetic, not an observation.

## 2026-08-25

### Users Management moves onto the panel's own furniture

**Area:** `#/users` · all five faces and the record
**Files:** `Frame.tsx`, `Overview.tsx`, `List.tsx`, `RenewalQueue.tsx`, `Analytics.tsx`,
`Detail.tsx`, `bits.tsx`, `AssignMembership.tsx`, `EditProfile.tsx`,
`LifecycleModal.tsx`, `Modals.tsx`, `users.css`, `index.tsx`,
`scripts/um-smoke.tsx`, `scripts/build-um-smoke.cjs`,
`scripts/um-smoke-shell-stub.tsx`, `eslint.config.js`, `package.json`

**What changed**

The module had quietly reimplemented about half the design system under `um-`
names — its own tiles, cards, tables, section heads, notices and page header —
and the result looked *almost* like the rest of the admin, which is worse than
looking different. All of it now comes from `admin-theme.css` and `ui/`:
`.dls`/`.dls-cmd`/`.dls-attn`/`.dls-chips`/`.dls-body`, `Tiles`/`Tile`, `.card`,
`.tbl`, `SectionHead`, `Notice`, `KvList`, `Tabs`. Fourteen local blocks went
with them — `um-head`, `um-metric`, `um-tip`, `um-note`, `um-sec`, `um-h`,
`um-h3`, `um-card`, `um-card-h`, `um-card-r`, `um-rec-h`, `um-comp-row`,
`um-reflist`, `um-frozen` — and the module now inherits every future change to
the primitives that replaced them.

**The page title is gone, on all five faces.** The panel's rule is written into
the theme — *".dls-head is gone: title and scope live in the topbar, and the page
opens on its controls"* — and this module was shipping an `<h1>Users
Management</h1>` plus a three-line paragraph above the fold on every screen,
repeating the topbar and pushing the actual work down. The scope moved into the
topbar's stat slots (users · members · ending soon), where Deals and Business
Enquiries keep theirs, and it is counted unfiltered so it cannot change meaning
when somebody narrows the list beneath it.

**Descriptions came off the headings.** Section heads used to carry an `<i>`
explainer sentence; they now carry the `SectionHead` `desc` slot with two to
five words, and it is the counting unit wherever there is one — "memberships,
not users", "unique users per month". The per-tile formula tooltip is gone with
the tiles that carried it: the unit sits on the tile, and the definitions table
at the foot of Analytics is the single home for formula and caution. Long
`Notice` blocks were cut to one per screen at most, and roughly 40 explanatory
paragraphs went entirely.

**Two real UI faults came out of it.** A read-only "Money written by this form —
None, ever" box sat in the assignment dialog beside the reference input: a
control that takes no input and reads as a disabled field. The point it was
making is real and now lives in the dialog's closing notice, which is where a
statement about consequences belongs. And the row-level **Assign** button had
been given `.rowact`, the house class that fades a row action in on hover —
right for a secondary verb on a busy table, wrong for the one conversion action
the module exists to make easy, and unreachable on touch. It is always visible.

**Temp data**

Unchanged. No content file was touched.

**Backend needed**

Unchanged — see
[BACKEND-INTEGRATION.md](BACKEND-INTEGRATION.md#module-5--business-ops--users-management).

**Open decisions**

None new. The twelve `UM-OD-nn` markers survive as compact one-line blocks
rather than paragraphs; the register is still `vocabularies.json →
openDecisions[]`.

**Verified**

`npx tsc -b` clean from cold; `npx eslint` clean on the module and `scripts/`
(the 195 errors elsewhere in the repo are pre-existing and untouched);
`npx vite build --mode dev` succeeds; `npm run check:users` still passes all 112
assertions.

New: **`npm run check:users-render`**, wired into `npm run check`. It renders all
27 URLs and all 17 dialog states through `renderToStaticMarkup` and fails on any
throw — which is the class of bug `tsc` cannot see and the previous pass had no
answer for. Getting it to run took a DOM stub and an esbuild plugin that swaps
`ShellContext` for a no-op (the real provider portals into `document.body`, and
there is no jsdom in this repo); both are in `scripts/` and neither is reachable
from the app.

It earned its keep immediately: an assertion about the assignment dialog failed,
and the failure was correct behaviour — a member holding a live **Pro** term
sees no clash while the form sits on Starter, because the rule is one
entitlement *per product*. But the operator had no way to know they were about
to give a paying member a second plan until they happened to pick the colliding
one. The dialog now always lists what is already live on the account, and keeps
the blocking refusal for the selected plan. Those are two different questions
and it was only answering the second.

**Still not verified:** nothing has been exercised in a browser. Server-rendered
markup proves the components run and produce the right classes; it proves
nothing about layout, the sticky table header inside `.dls-body`, the stat-strip
tooltips (`.um .dls-attn` now sets `overflow-x: visible` so they are not clipped
— reasoned, not observed), dark mode, or keyboard and screen-reader behaviour.

## 2026-08-25

### Business Ops · Users Management — the whole module, frontend-first

**Area:** sidebar → **Business Ops** (new group) → Users Management ·
`#/users`, `#/users/:id`
**Files:** `src/content/users/{users,memberships,membership-plans,vocabularies,analytics,audit}.json`,
`src/admin/views/Users/{index,Frame,Overview,List,RenewalQueue,Analytics,Detail,AssignMembership,LifecycleModal,EditProfile,Modals,bits}.tsx`,
`src/admin/views/Users/{store.ts,users.css}`,
`src/admin/views/registry.tsx`, `src/admin/shell/modules.ts`,
`src/admin/auth/session.ts`, `scripts/check-users-derivation.cjs`, `package.json`

**What changed**

Eleven surfaces that did not exist: a founder overview, the registered-user
directory, a members view, the renewal queue, analytics, and a six-tab record
workspace carrying the current term, the profile, the commercial links, the full
membership history with a per-term detail, internal notes and tags, and an
append-only timeline. Plus three decision dialogs — membership assignment,
one guarded lifecycle modal covering all seven transitions, and profile editing.

**The one structural decision worth remembering: there is no stored
classification.** Normal User, Active Member, Paused, Suspended, Former Member
and Deactivated are derived at read time from membership state by `classify()`
in `store.ts`, and the directory filter, the members view, the overview tiles,
the queue and every analytics denominator call that one function. `users.json`
has no `is_member` column and must never grow one. A manually editable member
flag would drift from reality inside a week, and every screen reading it would
drift with it.

**Five faces on one route, not five routes.** The wireframe put Overview,
Directory, Members, Renewal Queue and Analytics in the sidebar as five nav rows.
They are five readings of one population, and five routes would have meant five
module rows in the permission matrix for a single access decision, and a Back
button that leaves the module when you meant to widen the question. As one route
with a view band above the title they share the filters, the derivation and the
URL — narrowing the directory and switching to Members keeps what you narrowed.

**Every write is simulated and every screen says so**, in the same words the
banner says it: users, memberships, plans and analytics are read from
`src/content/users/`, and assign, activate, pause, resume, suspend, reactivate,
cancel, renew, edit-profile, note, tag and deactivate all write to the browser
tab only. A reload restores the seed.

**Three smaller decisions that are load-bearing rather than cosmetic.** Every
figure prints its counting unit on the tile and its formula and caution in a
tooltip, read from `vocabularies.json → metricDefinitions[]` — the discipline is
that the same metric means the same thing in March and in September, and writing
the definition beside the figure is the only defence that survives contact with
a dashboard. Every unresolved product question renders as a dashed `UM-OD-nn`
block on the screen it affects, naming the assumption. And engagement renders as
an explicit unavailable state with the blocker named, never as zero — a zero
there is indistinguishable from a platform nobody opens.

**Temp data**

`src/content/users/users.json` → `users[]` — **placeholder records.** 20 users
covering every classification, both account statuses, all five registration
sources and complete/incomplete profiles.
`src/content/users/memberships.json` → `memberships[]` — **placeholder records.**
18 terms including three renewal chains, a cancel-then-return, two suspensions,
one pause, one Pending Activation with no snapshot, and terms on superseded plan
versions so the freeze is demonstrable rather than asserted.
`src/content/users/membership-plans.json` — **placeholder records**, and not ours
to own (UM-OD-01): a read of the commercial catalogue, version-first.
`src/content/users/analytics.json` — **placeholder records** for trend, cohorts,
acquisition and the Finance-read revenue context. Deliberately does *not* carry
the headline counts; those are counted client-side from the two files above by
the same derivation the directory filters on, so a tile and the list it drills
into cannot disagree.
`src/content/users/audit.json` → `events[]` — **placeholder records.**
`src/content/users/vocabularies.json` — **static copy, permanent.** Labels, the
transition matrix, the lifecycle action table, the profile schema, the metric
definitions and the open-decision register. Nothing in it becomes backend work
beyond serving it.

**Backend needed**

- `GET /api/v1/admin/users` → the filtered, ordered, paged directory with counts
  over the whole filtered set → replaces `users.json`
- `GET /api/v1/admin/users/{id}` → the workspace payload → replaces one element
- `GET /api/v1/admin/users/{id}/memberships` → every term including terminal ones
  → replaces `memberships.json`
- `GET /api/v1/admin/memberships/{id}` and `/events` → one term and its
  append-only lifecycle log
- `GET /api/v1/admin/membership-plans` → a read of the commercial catalogue →
  replaces `membership-plans.json`
- `GET /api/v1/admin/users/vocabularies` → replaces `vocabularies.json`
- `GET /api/v1/admin/users/analytics/{overview,membership,cohorts}` → replaces
  `analytics.json`
- `GET /api/v1/admin/users/{id}/timeline` → replaces `audit.json`
- `POST/PATCH` for UM-T01 … UM-T12 — the twelve transactions, with sequences and
  failure modes, in
  [BACKEND-INTEGRATION.md](BACKEND-INTEGRATION.md#module-5--business-ops--users-management)
- A `Module` row for `users` in group **Business Ops**, with membership lifecycle
  as a **separate sensitive action** rather than riding on `edit`. Until it
  exists, `users` sits in `PROTO_MODULES` and `can("users")` returns true for
  everyone — safe only because there is no server data behind it and no server
  write to authorise.

**Open decisions**

Twelve, all assumed on screen rather than silently: `UM-OD-01` plan ownership
(catalogue consumed, never defined), `UM-OD-02` activation trigger (nothing
activates automatically — a person does), `UM-OD-03` complimentary grants
(offered, behind an explicit source and a mandatory reason), `UM-OD-04` pause
policy (`continue` — the end date runs on), `UM-OD-05` suspension effect (the
dialog promises nothing specific), `UM-OD-06` refund consequence (a refund moves
nothing by itself), `UM-OD-09` profile schema (`profile v1`, public/internal
marked per field), `UM-OD-10` engagement taxonomy (rendered unavailable),
`UM-OD-11` churn window (60 days, no grace, labelled everywhere it is used),
`UM-OD-12` revenue scope (one figure, read from Finance), `UM-OD-13` entitlement
keys (illustrative), `UM-OD-15` concurrent products (overlapping live terms on
the same product refused). The register is
`vocabularies.json → openDecisions[]`, and the `Assumed` component reads it by
id so the code and the spec point at each other rather than describing each
other.

**Verified**

`npx tsc -b` clean from a cold build; `npx eslint` clean on the new module and
the four wiring files; `npx vite build --mode dev` succeeds.

`npm run check:users` — a new suite, wired into `npm run check` — asserts the
derivation and the write simulation against the seed through the same exported
functions the screens call, not a reimplementation: the classification of all 20
users individually, the six classifications summing to the population, every
filter returning exactly the count the strip advertises for it, phone search
matching across four formattings of one number, the transition matrix refusing
what it should, renewal creating a new row while the previous term's status,
dates and snapshot stay byte-identical, activation freezing the snapshot from
the version the term names and the classification following it, and every event
type the client writes existing in the vocabulary. That last one caught a real
bug before it shipped: deriving the event name from the action produced
`MEMBERSHIP_CANCELED` with one L, which matches nothing in `eventTypes[]`, so
the row would have rendered with no label and no tone. It is a spelt-out map
now, with a comment saying why.

**Not verified:** nothing was exercised in a browser — no click-through, no
responsive check at real breakpoints, no dark-mode pass, and no screen-reader
pass. Every colour, space and radius is a theme token and there is no literal
hex in `users.css`, which is the reason dark mode is *expected* to work rather
than the evidence that it does.

## 2026-08-21

### "No match found" → "No match yet"

**Area:** whole module · **Files:** `vocabularies.json`, `List.tsx`, `Detail.tsx`,
`bits.tsx`, `store.ts`, `enquiries.css`, `check-enquiry-wiring.cjs`,
`check-enquiry-export.cjs`

Label only, in all ten places that carried it: the status label, the strip cell
and its help text, the transition guard, the record's info note, the manual
button, the `NO_MATCH` event note, and two check-suite assertions.

**`no_match` stays the key**, as does `no_eligible_business` — the same line held
for every label that moved today. A key renamed to match a label is a migration
wearing a rename's clothes.

**The button reads "No match yet", not "Match not yet".** The literal transform
is not English, and an action that sets a state should name that state — the
button and the stage it produces now say the same words.

**"Yet" is a better word than "found", incidentally.** The state is reversible
and re-runnable: a business renews, a category gets its first provider, and the
enquiry walks back to Qualified. "Found" reported a search result; "yet" says
the door is still open, which is what the state actually means.

**The dated records are left alone** — `OPERATION-2026-08-21-no-match-status.md`
and the earlier changelog entries say "No match found" because that is what it
was called when they were written. Editing them would be rewriting history to
match the present, which is the one thing a log must not do.

**Verified:** rendered the rail in three states, the full pill set and the
button — all read "No match yet", and the off-ramp still draws dashed on
`qualified` and `assigned` and solid on `no_match`.

**For the API:** `statuses[].label` for `no_match` is now "No match yet"; nothing
else moves.

## 2026-08-21

### The rail shows No match found always — and never claims you went through it

**Area:** `#/business-enquiries/:id` — lifecycle rail
**Files:** `bits.tsx`, `enquiries.css`

Supersedes this morning's decision to draw the off-ramp only while a record was
on it. The stage is now always in the line, between Qualified and Assigned,
which is where it was asked for.

**The bug that made it more than a one-line change**

`no_match` is step 4 and `assigned` is step 5. The rail's ordinary rule is
*anything behind you is filled* — so every assigned record would have shown **No
match found as completed**, and the rail would have said an enquiry passed
through a stage it never entered. Same for every terminal record.

So an off-ramp gets its own state and is **never "done"**:

```
on    it is the current status
off   an off-ramp that is not current — dashed, hollow, muted
done  ordinary stages behind you
```

Dashed leaders on both sides so it reads as a branch off the line rather than a
stop on it, and the tooltip says *"(not taken by this enquiry)"* for the case the
dashes are too quiet to carry alone.

**Why always-on is the better answer anyway:** the pipeline has a shape, and
hiding a stage until it happens makes the shape a secret. Somebody looking at a
Qualified record should be able to see that No match found is where it can go
next — that is the point of a rail.

**A specificity note, because this bit twice today.** The two connector rules
carry an extra class each so they beat `.be-step + .be-step::before`, which is
the same `(0,2,1)`. Tying on specificity and winning on file order is how a rule
becomes somebody else's bug the day the bundler reorders two stylesheets.

**Verified:** rendered all six states. On `assigned` and `converted` the off-ramp
stays dashed while everything genuinely behind is filled; on `no_match` it is lit
and Qualified reads done.

**For the API:** nothing. Presentation only.

## 2026-08-21

### "Match not found" by hand, and it becomes a stage on the rail

**Area:** `#/business-enquiries/:id` — action bar and lifecycle rail
**Files:** `store.ts`, `bits.tsx`, `Detail.tsx`, `vocabularies.json`, `BACKEND-INTEGRATION.md`

**1 · The manual route into No match found**

`no_match` could only be reached by a matching run that returned nothing. But the
operator sometimes knows the answer before the run does — the one business
covering that pincode suspended this morning, or the category is one nobody
serves yet. Making them run a match to discover what they already know is
theatre.

`markNoMatch()` sets it directly from **Qualified**, stores the same
`no_eligible_business` exception with a note naming who did it, and appends a new
**`NO_MATCH`** event so a later automatic run does not look like it contradicted
itself.

The button is a plain `btn`, deliberately — **not `dgr`**. This is not a
rejection and it is not terminal: it says the supply is missing and the enquiry
is fine. "Try matching again" is the way back out.

**2 · It is now a stage after Qualified**

`no_match` had shared step 3 with Qualified while it was invisible to the rail.
The moment it is drawn, sharing a number lights **two stages at once** — so it
takes step 4 and everything after shifts: assigned 5, terminals 6.

**The rail draws it only while the record is on it.** A rail that always showed
it would promise a detour most enquiries never take; this way it appears exactly
where it belongs, between Qualified and Assigned, exactly when it is true. That
is one predicate away from being permanent if the other reading was intended:

```
qualified   New — Processing — [Qualified] — Assigned — Outcome
no_match    New — Processing — Qualified — [No match found] — Assigned — Outcome
```

**Verified end to end**, not inferred: rendered both rails, then clicked the real
button against the real store — `IB-BE-2026-0047` flipped to No match found, the
timeline gained `NO_MATCH — Marked No match found by hand · Vasant Kunj, New
Delhi · Interior Design`, the exception was set, and the rail for that record
redrew with the off-ramp.

**For the API**

- **`NO_MATCH` joins the event union.**
- **BE-T02b · `POST …/{id}/no-match`** — from `qualified` only, **no body**. It
  records a judgement, not a reason code, and the judgement is always the same
  one. Reversible: BE-T02 clears it.
- `statuses[].step` renumbered: `no_match` 4, `assigned` 5, terminals 6.

## 2026-08-21

### Full-page loader: the Lottie replaces the GIF, loaded out of band

**Area:** shell — `RequireSession`'s loading screen
**Files:** `AdminLoader/index.tsx`, `AdminLoader.module.css`, `utils/constants/image.ts`,
`package.json` · **removed:** `assets/images/gif.gif`

**The weights, because they decided the shape of this**

| | raw | gzip |
|---|---|---|
| `gif.gif` (removed) | 4.2 KB | — |
| `loading-spinner.json` | 188 KB | **31.8 KB** |
| `lottie_light` renderer | 164 KB | **48.3 KB** |

**A loading screen that has to be loaded is a joke at the user's expense**, so
neither goes in the entry bundle:

- **`lottie_light` via dynamic `import()`** — its own chunk, confirmed in the
  build output. `light` is the SVG-only build, 164 KB against the full player's
  299 KB, and this file is all shape layers, which is exactly what it renders.
- **the JSON via `?url`** — Vite emits it as a file to fetch rather than inlining
  188 KB of vectors into JavaScript.

Until both arrive, the CSS `.spinner` holds the screen — three lines that were
already there, so the loader is never itself blank. The box is reserved at full
size and the spinner sits **inside** it; as a sibling it would have shifted the
layout the moment the animation swapped in.

**Reduced motion gets the spinner and nothing else.** The animation is a looping
character at a desk — precisely the continuous movement that setting exists to
switch off.

**Two failure modes handled, because this component's whole job is a wait:**
the session can resolve while the chunk is still in flight, so the effect guards
against rendering into a detached node (an animation nothing would ever stop);
and a chunk that fails to load is caught silently, because the spinner is already
on screen and still says the true thing.

**Accessibility:** the animation is decorative (`aria-hidden`), with the status
text in a visually-hidden span under `role="status"` — so it announces "Loading…"
rather than nothing, or a pug.

**Also:** the file arrived as `loading spinner.json`. Renamed to
`loading-spinner.json` — a space in an import path works right up until it does
not.

**Verified:** built assets served over HTTP and rendered headless — SVG present,
163 paths, 90 frames, 512×512, playing.

**For the API:** nothing.

## 2026-08-21

### Sidebar: real logo, flush-left brand, no key hints, Client Ops moved up

**Area:** shell (sidebar, topbar) + Business Enquiries topbar
**Files:** `AdminShell.tsx`, `admin-theme.css`, `modules.ts`, `BusinessEnquiries/index.tsx`

**1 · The mark is the real one.** The green tile with "ib" set in it was
generated in CSS. `src/assets/images/IB_Icon.png` is a self-contained tile —
dark ground, its own yellow accent — so the rule now carries no background of
ours and does not tint it. (`Logo.png` was the wrong asset here: it is
white-on-transparent, built for a dark ground, and would have vanished on this
sidebar.)

**2 · "ADMIN" was indented by 24px, and the old comment explained the wrong
cause.** `.sb-brand` is a `<button>`, and a button centres its text — so the
subtitle sat centred under the title. The rule that used to sit there said:

> *measured with a canvas/DOM comparison, both boxes already start at the same x*

True, and irrelevant. **The box was full width in both cases; only the text
inside it moved.** Measuring the element shows no difference at all — you have to
measure a Range over the text node to see it. I made the same mistake first time
and got "no change" until I looked at the render.

`text-align:left` on `.sb-brand` fixes the cause, and the `-2px` "optical
correction" is gone with it — it had been compensating for the centring, not for
letter tracking, so once the cause was fixed it overcorrected 2px the other way.
Measured on the text: **before 50/74, after 50/50.**

**3 · The key hints are gone** — `⌘K` beside Search and `[` beside Collapse. Both
shortcuts still work; only the badges went. `.kbd` stays in the theme, still used
in five other places.

**4 · Client Ops sits under Sales.** Groups had been appearing in whatever order
the server's modules arrived, with proto rows appended last — which put Client
Ops below Settings purely because it is the newest thing here. `GROUP_ORDER`
states it instead. A group not named there keeps its arrival order *after* the
named ones, so a new server group appears rather than silently vanishing.

**5 · Topbar figures read label-first** — `today 0`, `last 7 days 10`. "0 today"
reads as a sentence fragment you have to finish; "today 0" reads as a labelled
value, which is what it is.

**For the API:** nothing.

## 2026-08-21

### Business load ball on Assigned to · complete phone numbers

**Area:** `#/business-enquiries` — list rows, seed data
**Files:** `List.tsx`, `enquiries.css`, `enquiries.json`, `check-enquiry-seed.cjs`

**1 · How buried is this business?**

The Assigned-to cell now carries a notification-style ball: **how many live
enquiries that business is holding right now.**

- **Counted from the whole set, never the filtered rows.** The ball means "this
  business currently has N" — a number that shrank because somebody filtered by
  city would be answering a different question with the same mark.
- **Live only** (`status = assigned`). A business that converted forty last
  quarter should not read as buried.
- **Zero is hollow, not solid.** It stays on the row — *"this business is free"*
  is worth knowing when deciding where the next one goes — but a ball reading
  zero as loudly as one reading three is decoration, not a notification.

It repeats on every row for the same business, and that is deliberate: the
question is not "this row" but "how loaded are they", and it should be readable
from whichever row you are looking at.

**2 · The phone numbers were masked in the seed, and that broke more than looks**

They were stored as `+91 98•••••••27` — so `phoneKey()`, which takes the **last
ten digits** to dedupe on, was working with six, and those six included the
country code. **The duplicate check had never run on a realistic number.**

All 13 records now carry complete, fictional Indian mobiles (and real-shaped
email addresses built from the customer's own name). Each keeps its original
first and last two digits so anything that quoted a number before still matches.
Verified: every key is 10 digits, all 13 unique.

`check:seed` now asserts it — a phone must yield ≥12 digits, start 6–9, and no
two records may share a key — so re-masking cannot silently break dedupe again.
Confirmed the guard fires: re-masking one number reports
*"phone … has 6 digits — masked?"*.

**A regression the render caught.** A complete number is longer than a masked
one, so the reference line started breaking mid-phone: `+91` on one line,
`98100 00027` on the next. The number is now one unwrappable unit, so the line
breaks between the reference and the phone or not at all.

**For the API:** nothing structural. The seed's `$comment` records that contact
details are fictional but complete, and why masked ones were useless as test
data.

## 2026-08-21

### Filter marks: an identity dot per status, a heat ramp for urgency, real chips for tags

**Area:** `#/business-enquiries` — filter listboxes and row status pills
**Files:** `FilterSelect.tsx`, `bits.tsx`, `List.tsx`, `enquiries.css`

**The status dots were not distinct, and the reason was structural.** They were
painted from the semantic `tone` — four values shared across eight statuses — so
the list showed **three amber dots and two grey ones**. A legend with duplicates
is not a legend.

They now use an **identity** class, `.be-dot.s-<key>`, on two axes rather than
eight memorised hues (the palette has five):

| | |
|---|---|
| **hue** | which part of the pipeline — sand → amber → indigo → green / rust |
| **fill** | whose move it is — **solid = ours**, **ring = theirs, or ended** |

```
New          sand solid      ours, untouched
Processing   amber solid     ours, in hand
Qualified    indigo solid    ours, ready to route
Assigned     indigo RING     same work, now sitting with somebody else
No match     rust RING       blocked, not killed
Converted    green solid     won
Not Converted sand RING      ended, no result
Rejected     rust solid      that one we did on purpose
```

Assigned being a hollow Qualified is the point: same hue, same work, different
hands. No match found is a hollow Rejected for the same reason.

**The row pill carries the same dot.** Without that the filter taught a colour
code the rows never repeated — a code nobody learns. `StatusPill` now renders the
identity dot alongside the semantic tone: the tone says how to feel about it, the
dot says which state it is.

**Urgency is ordinal, so it looks ordinal** — a heat ramp from soonest to latest
(rust → amber → indigo) with "Browsing" hollow, because it is not a date but the
absence of one. The previous rule marked only "hot" and left three identical
grey dots.

**Tags render as the chip the rows use**, tone and dotted auto-marker included.
A tag is a chip everywhere else in the module; the filter list was the one place
it was a plain word.

Everything else stays plain. A city has no tone, and inventing one is noise.

**For the API:** nothing. Presentation only — the marks derive from `statuses[].key`
and `tags[].tone`, both already in the vocabulary.

## 2026-08-21

### A real listbox for the filters · the whole strip · intake in the header

**Area:** `#/business-enquiries` — command area, strip, topbar
**Files:** `FilterSelect.tsx` (new), `List.tsx`, `index.tsx`, `enquiries.css`,
`admin-theme.css`, `check-enquiry-wiring.cjs`

**1 · The dropdown had to stop being a `<select>`**

The open menu in the report was **the operating system's**, not ours — a
rectangle of system blue at the end of a filter row. There is no CSS fix for
that: a native `<select>` takes styling on the closed control and draws the list
itself. Making it look like the panel means not using one.

`FilterSelect` is a button and a listbox, both ours. What that buys beyond paint
is the thing a native control could never do — **an option can carry a mark**:

| filter | mark | why |
|---|---|---|
| Status | tone dot | eight statuses are quicker to find by colour than to read, and it is the same dot the rows carry |
| Urgency | one red dot on "hot" | four colours would be a legend to learn; one is a fact |
| Tier | lettered square | the badge the rows already use |
| everything else | none | a city has no tone and inventing one is noise |

Keyboard is rebuilt because replacing a native control means replacing what it
did: Enter/Space/↓ open, arrows and Home/End move, Enter picks, Escape closes and
returns focus to the button, Tab closes. **Focus opens on the current value**,
not the top — which is what makes "change it by one" a single keypress.

Deliberately absent: search-inside-the-list, multi-select, tags. Ten filters over
a queue this size do not need them, and each is another thing to learn.

**2 · The strip shows everything**

The `+N more` disclosure hid four of eight cells, so half the queue's shape was
behind a press — the one thing a strip exists to avoid. All eight are shown, in
**lifecycle order** (New → Processing → Qualified → No match → Assigned →
Converted · Rejected) rather than the old primary/secondary split, so the row
reads as the pipeline it describes. The disclosure, its held-open state and its
CSS are gone.

**3 · The header counts intake, not lifecycle**

`qualified` and `live` repeated two numbers the strip below already showed, and
showed better. Replaced with **today** and **last 7 days** — what the topbar can
say that the strip cannot is how much is *coming in*. Both resolve through the
same `receivedWindow` code the Received filter uses, so "today" means one thing
on this page rather than two.

*On the seed, `today` reads 0 — the newest records are dated the day before the
seed's `generatedAt`. Correct behaviour, not an empty state.*

**Two bugs found by doing this**

- **The open list painted under the attention strip.** `container-type` on the
  filter band already made it a stacking context, so its listboxes were trapped
  below the strip at `--z-band` and the strip drew straight through an open menu.
  The ladder gains a spaced rung — `--z-bandpop: 12` — for a band that opens a
  panel and has to clear the other bands, not just the rows.
- **`check:wiring` failed on the new component, correctly by its letter and
  wrongly by its intent.** Its rule is about the *shell's* popover, whose
  document listener closes on any click without `data-act`. `FilterSelect` runs
  its own outside-click listener, so the attribute would have been cargo — added
  to satisfy a test, read by nothing. The check is now scoped to files that call
  `openPop`, and was re-verified to still catch the real bug it was written for.

**For the API:** nothing. Presentation only.

## 2026-08-21

### "No match found" becomes a status, not a footnote

**Area:** whole module · **Operation doc:** `OPERATION-2026-08-21-no-match-status.md`

A matching run that found nobody was recorded as a **side-note** — an `exception`
object hung off a record whose status stayed `Qualified`. So the queue said
*"qualified, ready to go to a business"* about an enquiry with nowhere to go.
Same contradiction as Ready-to-Assign, same answer: make it a state.

```
New → Processing → Qualified ─── assign ──→ Assigned → outcome
                        │  ▲
                 no eligible │ re-run finds one
                        ▼  │
                   No match found
```

**It is an off-ramp, not a step, and two things say so**

- **It shares step 3 with Qualified.** It *is* qualified — requirement confirmed,
  snapshot frozen. What is missing is supply. Sorting by lifecycle step treats
  them as the same distance along, and the rail highlights **Qualified** while
  the record sits in `no_match`, which is the truth.
- **`offRamp: true`**, a new status flag the rail uses to leave it out of the
  linear track. Without it the rail would read *New → Processing → Qualified →
  No match found → Assigned* and imply every enquiry visits it.

**There is deliberately no `no_match → assigned`.** Assignment needs a ranked
candidate, and the only thing that produces one is another run — which returns
the record to Qualified first. The route exists; it just goes through the state
that earns it.

**The logic.** `runMatching()` now runs from `qualified` **or** `no_match` —
retrying is that state's only escape, so the old guard would have trapped the
record in it — and sets the status both ways. The `exception` object stays: the
status says *what* the record is, the exception says *why*, the same division as
`invalidation` on a Rejected record.

**The button** offers matching from both states and reads **"Try matching
again"** in `no_match`, because by then you have already pressed it once.

**Two duplicate badges removed.** The record header and the list's customer cell
each painted a "No match found" pill beside a status pill that now says the same
word.

**`flag` is gone from the module entirely.** With this cell moved to a status
filter, no strip cell used a flag any more — `flagRoute` was dead, and nothing in
`filterEnquiries` read `p.flag`. A stale `?flag=x` URL would still have rendered
a chip that filtered nothing: a silent lie of exactly the kind that produced the
count-vs-filter bug earlier today. Removed from the routes, the chip labels and
the export filename and scope sentence.

**The export check caught a stale fixture.** It asserted the scope sentence
mentioned `flag: 'overdue'` — and passed only because the sentence echoed
`p.flag` verbatim. The fixture now uses three filters that exist, and adds the
negative: a removed param must **not** appear in the sentence.

**Seed:** `IB-BE-2026-0052` → `no_match`. Qualified drops 3 → 2.

**For the API**

- **New status `no_match`**, label "No match found", step 3, non-terminal.
- `POST …/{id}/match` **sets the status in both directions.** This **supersedes**
  the note added earlier today that it must not touch the status — that held
  while "no eligible" was only a field.
- `flag=no_eligible` is withdrawn; use `status=no_match`. The `exception` object
  is unchanged.

## 2026-08-21

### Filter band: sort leaves the grid, resting controls stop shouting

**Area:** `#/business-enquiries` — the command area
**Files:** `List.tsx`, `enquiries.css`

**A shipped visual defect.** "Sort: Needs attention" is wider than a 158px grid
cell, so the control was rendering as **"Sort: Needs attentio"**. It had been
sharing the filter grid with ten narrowing controls — which also said, wrongly,
that sorting is a kind of filtering. It now has its own slot at the end of the
band, ruled off, sized to its own longest label.

**Eleven identical bordered boxes read as a form to fill in**, not as a set of
optional narrowings — and at rest they all compete for the same attention the
one *active* filter needs. Resting controls now sit in a well with a hairline;
active ones keep the theme's brand fill and carry all the contrast in the band.

**Grid cells 158px → 140px.** At 158 a wide window fitted nine columns and left
the tenth stranded on a line of its own; 140 fits more per row. It was **not**
pushed lower: at ~130px an active value like "Modular Kitchen" starts to
truncate, which is the defect this entry opens with.

**Two things that would have been quietly dead**

- `:not(.on)` on the resting rule is load-bearing. `.selectbox.on select` in the
  theme is `(0,2,1)` and so is `.be-filters-grid > .selectbox select` — without
  the `:not`, which one won would have depended on the order the bundler emitted
  the two stylesheets in. Third time today this has come up; it is written down
  at each site now.
- The separator rule was first written as `@container rec (min-width: 900px)`.
  **`rec` is the record view's container and does not exist on the list**, so the
  query could never match. `.be-filterbar` is now its own container (`fbar`), and
  the rule asks the only width that matters — the band's own.

**For the API:** nothing. Presentation only.

## 2026-08-21

### Filter chips redesigned · "Invalid" becomes "Rejected"

**Area:** `admin/ui` (shared) + Business Enquiries
**Files:** `ui/index.tsx`, `admin-theme.css`, `enquiries.css`, `vocabularies.json`,
`Detail.tsx`, `Modals.tsx`, `Qualify.tsx`, `Suggestions.tsx`, `List.tsx`,
`bits.tsx`, `index.tsx`, `check-enquiry-wiring.cjs`

**The chips — three measured problems**

| | Was | Now |
|---|---|---|
| key vs value | one text node, one weight: `Status: Processing` | two elements — key at 400/72% opacity, value at 500 |
| close button | **15×15px**, measured | 16px glyph, **28px target** via a `::after` inset, plus a focus ring |
| "Clear all" | a `.chip` — same pill as the filters, just untinted | a text action, ruled off from the set it clears |

The key and the value answer different questions. Once you have read
"Processing" you already know it is a status, so making them one string at one
weight charged two reads for one piece of news. A row of eight chips is now
scannable by value alone.

"Clear all" wearing the chip shape was the worse of the three: sitting inline at
the end of the row it read as **a ninth filter that happened to be switched
off**. It is a verb, so it looks like one.

**A latent specificity bug found on the way.** `FilterChips` carried an inline
`style={{margin}}`, which silently beat every stylesheet — including
`.be-list > .chiprow` in this module, which had been trying to align the chip row
with the other bands and never could. With the inline gone, that rule and the
theme's new `.chiprow.filters` were both `(0,2,0)` and the winner would have
depended on **which stylesheet the bundler emitted last**. The module rule is now
`.be-list > .chiprow.filters` — the module's intent wins on purpose rather than
by luck.

**Blast radius:** `FilterChips` is used by 8 modules and every one gets the same
improvement. `.chip` is also used bare in `AdminShell` and `AdminAuth` for
permission chips — those have a single text child, so `.k`/`.v` never match and
nothing about them changes.

**Invalid → Rejected**

Label only. **`invalid` stays the status key**, and so do `invalidReasons`, the
`INVALIDATED` event, the `invalidation` block, `invalidate()` and the
`invalid_transition` 422 code — the same line held every time a label has moved
today, because renaming a key to match a label turns a rename into a migration.

Renamed where a person reads it: the status label, the strip cell, the action
(**"Mark invalid" → "Reject"**), the modal heading, and eleven pieces of prose —
including the transition guards ("or a rejection reason is supplied"), the tier
and contact-outcome help text, and the exclusion note in Suggestions, which now
says *"Rejecting it would hide a coverage gap inside a rejection-rate metric"*.

**For the API:** `statuses[].label` for `invalid` is now **"Rejected"**; the key
is unchanged, so no payload, filter or error code moves.

**Verified headless:** chips render key-quiet / value-bold with a separated
"Clear all", and the status pills read New · Processing · Qualified · Assigned ·
Converted · Not Converted · **Rejected**.

## 2026-08-21

### Module audit — eight fixes, three false alarms, one honest limit

**Area:** whole module · **Operation doc:** `OPERATION-2026-08-21-module-audit.md`

A systematic sweep after a day of large removals (SLA, ownership, callbacks,
Delivered, Acknowledged, Ready to Assign). Removals leave debris; this is the
clean-up. Findings were **measured**, not eyeballed: a static audit script over
dead CSS / unused exports / unconsumed vocabulary / state-machine completeness /
event coverage / filter–sort parity, plus a headless render to measure the table.

**Fixed**

| # | Kind | What |
|---|---|---|
| 1 | layout | `.be-tbl` floor `1160px → 960px` — sized for 12 columns, the table has 10 |
| 2 | dead CSS | `.be-abar-biz`, orphaned with the Acknowledge fence |
| 3 | dead code | `TEAM` and `lastAttempt` exports, no consumers anywhere |
| 4 | copy | terminal footer said *"Terminal — Converted. **Terminal.** Reopening…"* |
| 5 | a11y | `<label>Rank 1 was</label>` in ReassignModal had no `htmlFor` |
| 6 | UX | attention strip had **3 separators for 4 cells** — every cell its own group |
| 7 | redundancy | `new-enquiry` auto tag duplicated `status=generated` exactly |
| 8 | seed | 2 records had remarks with no `REMARK` event; 3 had manual tags with no `TAGGED` event |

**The lifecycle audited clean** — every status has a transition row, none points
at an unknown status, none is unreachable, the seed uses no status outside the
vocabulary, every sort key offered is handled and every filter offered is
honoured.

**Three false positives, verified away rather than "fixed"**

Worth recording, because *the audit said so* is not evidence:

- `.be-r-warn` / `.be-r-rd` looked dead — they are built as `"be-r-" + rail`,
  which no literal grep finds.
- `.be-tier-h` looked dead — the only match was a comment saying it had already
  been removed.
- The last-response cell looked unclamped, ballooning rows to ~250px. That was
  **my probe's** markup missing `.be-resp-c`; the real table clamps to two lines.

**One honest limit on fix #1.** Narrowing the floor removes ~200px of artificial
overflow but **not the scrollbar**. The ten columns' own minimum widths total
959px against 942px available, so 17px is intrinsic — the table cannot compress
below its content. Capping the response column was measured as a candidate fix
and **rejected**: at minimum width that column is already 116px, so caps of
260 / 240 / 220 / 200 / 180 all left the total at 959. The last 17px needs a
column dropped or cell padding tightened, which is a design decision and is not
being taken quietly inside a bug sweep.

**The team vocabulary was re-anchored rather than deleted.** Removing the `TEAM`
export left `voc.team` with no consumer. Instead of dropping it, `check:seed` now
asserts that **every Operations-authored event and every `qualifiedBy` names a
real team member** — an event by somebody nobody can look up is either a typo or
a fiction. It caught a defect on its first run: the `TAGGED` events added under
fix #8 were attributed to "System", when a manual tag is a person's judgement.
Reattributed to whoever qualified the record.

**Deliberately not done:** `CHECK` and `UPDATED` events are still missing from the
seed — a qualified record should carry four `CHECK` events, and adding them means
~28 fabricated rows. Recorded as a known simplification rather than invented,
because a stand-in that fabricates detail it cannot justify is *worse* as an API
reference. Bulk actions remain the largest missing feature; that is new work, not
a defect.

**For the API:** `new-enquiry` leaves the tag vocabulary — "nobody has contacted
them" is `status=generated`, and the server must not re-add the tag. Everything
else here is presentation, dead code or seed data.

## 2026-08-21

### Removed: Ready to Assign — matching happens inside Qualified

**Area:** whole module · **Operation doc:** `OPERATION-2026-08-21-remove-ready-to-assign.md`

```
before   New → Processing → Qualified → Ready to Assign → Assigned → outcome
after    New → Processing → Qualified → Assigned → outcome
```

**The contradiction was real**

Qualified meant "a person confirmed the requirement and froze the snapshot" — at
which point the enquiry *is* ready to be assigned. The only thing `ready`
actually encoded was **"a matching run has been done"**, which is a fact about the
work, not a stage of the enquiry's life.

**It was never load-bearing.** Nothing gated on it:

- **`assign()` never checked the status.** It requires a match run with an
  eligible candidate and nothing else.
- **The suggestions panel** switches on `isWorking(status)`. A Qualified enquiry
  already showed the ranked businesses.
- **`runMatching()` already accepted both** `qualified` and `ready`, because
  re-running was allowed. Its only other job was setting `status = "ready"`.

So it was a label the queue carried and the screens ignored. Removing it changed
no gate, no permission and no branch — only names and counts.

**What changed**

- `ready` leaves `statuses[]` and `transitions[]`; steps renumber 1–5.
- **`runMatching()` no longer sets a status.** It appends `MATCHED` and sets or
  clears the `no_eligible_business` exception exactly as before — the enquiry
  stays Qualified either way.
- `reassign()` returns the enquiry to **Qualified**.
- `qualified → assigned | invalid`; `assigned → converted | not_converted |
  invalid | qualified`.
- The strip cell and toolbar stat are relabelled **qualified**.

**A field whose name had started lying.** `Counts.ready` was
`qualified + ready`; with `ready` gone it holds the Qualified count, so it was
renamed `Counts.qualified` rather than left as a name that describes a state
which no longer exists.

**What replaces the distinction it drew**

Whether a matching run exists — what `ready` really meant — is still visible and
in a better place: the record shows ranked businesses once a run has been done,
and the `no eligible business` exception when the run found nobody. Both are
properties of the record, and the strip still surfaces the second as its own cell.

**The one thing genuinely lost:** the list can no longer tell *"qualified, nobody
has run matching yet"* from *"qualified and ranked"* at a glance. If that matters,
it belongs as a **flag** — the same shape as `flag=no_eligible` — not as a
lifecycle state, because it is re-runnable and reversible and states are not.

**Seed:** 2 records at `ready` → `qualified`, giving 3 Qualified.

**For the API**

- Status `ready` **withdrawn**.
- `POST …/{id}/match` (BE-T02) **must not change the status** — it appends
  `MATCHED` and sets/clears the exception. Noted on the BE-T02 row.
- Reassignment returns the enquiry to `qualified`.

**Verified headless:** strip reads `13 total · 1 New · 3 qualified · 1 no match
found · 3 processing · 3 assigned · 1 converted · 1 invalid`, and the transition
table renders `qualified → assigned | invalid`.

## 2026-08-21

### A Processing state, and the qualification flow it completes

**Area:** whole module · **Operation doc:** `OPERATION-2026-08-21-processing-state.md`

```
New  →  Processing  →  Qualified  →  Ready to Assign  →  Assigned  →  outcome
```

**The reading, and why it is an addition rather than a rename**

The request read two ways — rename `qualified`→Processing and `ready`→Qualified,
or **add** `processing` between New and Qualified. Both land on the same
lifecycle. The second is implemented, because the first silently changes what
every stored record means: four seed records saved as `qualified` would begin
displaying "Processing", and `ready` would display "Qualified". That is a data
migration wearing a rename's clothes — the same trap flagged this morning when
`generated` kept its key while its label became "New". This adds one state and
changes no stored meaning.

**What it fixes**

`generated` was doing two jobs — *just arrived* and *somebody is working it* —
and the module had already papered over the gap with an `untouched` count derived
from an empty contact log, a `new-enquiry` auto tag, and a strip cell filtering on
that tag rather than on a state.

| | before | after |
|---|---|---|
| New | `status=generated` **and** empty log, surfaced via a tag | `status=generated` |
| Being worked | the same status, told apart by a tag | `status=processing` |

It also **dissolves the label collision** recorded in the previous entry: "New"
and "in qualification" no longer name overlapping sets, because they are now two
different states. The strip cell `in qualification` becomes **`processing`**, and
`New` filters a status instead of a tag. Every cell is one status filter again.

**The transition in: the first logged contact attempt**

"The team started qualifying" and "somebody tried to reach them" are the same
event, so it needs no new control — `logContact()` flips `generated → processing`
on the first entry. It is recorded in that attempt's own CONTACT note rather than
as a separate event type: one act that prints twice is how a timeline stops being
readable.

**`generated → qualified` is deliberately not a transition.** `canQualify()`
already required at least one logged attempt, so qualifying without contacting
was impossible — the transition table now says so instead of leaving it to a
guard.

**One predicate instead of five copies**

Requirement edits, contact logging, checklist ticks and the qualify gate were all
`status !== "generated"` — which would have frozen a record the moment it started
being worked. They now go through `isWorking(k)`, so the next state added before
Qualified is one edit and not a hunt.

**Also caught and fixed**

- **The seed check was right to fail.** It treated anything past `generated` as
  "must be frozen", but the freeze is at **Qualified**. It now checks
  `New | Processing` together for the absence of a snapshot, *and* asserts the
  one thing that separates them in both directions — New must have no logged
  attempt, Processing must have one — so a migration cannot leave a record in the
  wrong state silently.
- **`LifecycleRail`** picked up the new step on its own, because the magic
  `step <= 6` was replaced with `!terminal` in the previous change.
- **Stale `followUpAt` prose in `BACKEND-INTEGRATION.md`** — a leftover from the
  callback removal earlier today that would have told the API team to build a
  removed feature. Gone.

**Numbers:** 8 statuses, steps 1–6. Seed: 3 of the 4 `generated` records have
contact logged → `processing`; `IB-BE-2026-0063` (no attempts) stays New.

**Left alone, worth a later look:** the **`new-enquiry` auto tag** now duplicates
`status=generated` exactly — status, tag and empty log all encode one fact. It is
redundancy of the kind that produced the count-vs-filter bug earlier today, but
removing vocabulary that was not asked about is not this operation's business.

**For the API**

- **New status `processing`**, step 2. `statuses[]` and `transitions[]` updated:
  `generated → processing | invalid`, `processing → qualified | invalid`.
- `POST …/{id}/contacts` **must** transition `generated → processing` on the
  first entry, server-side.
- Edits, checklist and tag writes accept **both** `generated` and `processing`,
  and refuse from Qualified onward — unchanged in spirit, wider by one state.

**Verified headless:** strip reads `13 total · 1 New · 2 ready · 1 no match found
· 3 processing · 3 assigned · 1 converted · 1 invalid`, and the table shows the
rule working — the three records with 1, 2 and 2 logged attempts render
**Processing**, the one with 0 renders **New**.

## 2026-08-21

### Lifecycle: Delivered and Acknowledged collapse into Assigned

**Area:** whole module · **Operation doc:** `OPERATION-2026-08-21-collapse-delivery-and-acknowledgement.md`

```
before   New → Qualified → Ready → Assigned → Delivered → Acknowledged → Converted / Not Converted / Invalid
after    New → Qualified → Ready → Assigned → Converted / Not Converted / Invalid
```

Nine states become seven. Steps renumber 1–5, terminals sharing 5.

**Delivered was nearly free, because it was never a decision**

`assign()` already called `deliver()` on its last line. Delivery was the tail of
assigning, not a step anyone took; the only thing it contributed to the queue was
a `delivered` status to carry. So the mechanics stay and the state goes:

- **Kept:** `assignments[].deliveryStatus` and `deliveredAt`, and the `DELIVERED`
  timeline event. *When* it was published, and whether the send **failed**, are
  facts about the assignment — the record still renders *"Failed — the assignment
  stands; Operations is alerted"*, and that case needs somewhere to live.
- **Gone:** the `delivered` status, its strip cell, and `deliver()` as a separate
  export.

An assigned enquiry is now assigned-and-published, which is what it always was.

**Acknowledged, and what came with it**

`acknowledge()`, the `ACKNOWLEDGED` event, `outcome.acknowledgedAt` (type,
`recordOutcome()`, 3 seed records), the **AcknowledgeModal**, and the "Business
side · no surface yet" fence in the action bar that existed only so a prototype
could walk the chain.

**Record outcome now hangs off Assigned.** The outcome record is created once,
when it closes, rather than opened at acknowledgement and closed later —
`status: "in_progress"` no longer occurs.

**Kept:** `outcome.firstContactAt`. Nothing sets it yet, but "when the business
first rang the customer" is a different fact from "the business confirmed
receipt", and it was not what was asked to go.

**Renamed, and a collision taken on purpose**

The strip cell `untouched` is now **New**. It already collides: `generated` was
renamed to "New" this morning, and the strip carries an **in qualification** cell
filtering `status=generated`. So the row reads *… New … in qualification …*,
where **New is the subset of in qualification that nobody has rung yet**. The
tooltips say exactly that and `check:wiring` proves each number matches its own
filter — but two labels that do not distinguish themselves is a real readability
cost, taken deliberately rather than by accident. **Worth revisiting.**

**Prose that named removed steps** — the reassign reason ("Business never
acknowledged it" → "Business never responded"), the assign toast, a reassign
placeholder, and 15 `suggestions.json` quality labels ("Acknowledges in 4h" →
"Responds in 4h" — the `avgAckHours` signal survives as *responsiveness*, so only
its label was wrong).

**Also fixed on the way past:** `LifecycleRail` selected non-terminal steps with
`step <= 6`, a magic number that only held for the nine-state lifecycle. It now
asks the data — `STATUSES.filter(s => !s.terminal)` — so the rail follows the
vocabulary instead of a count somebody has to remember to update.

**Numbers:** strip **10 → 8** cells. CSV **38 → 37** columns. Seed: 2 records
migrated to `assigned`, 3 `ACKNOWLEDGED` events and 3 `acknowledgedAt` removed.

**For the API**

- Statuses `delivered` and `acknowledged` **withdrawn**. `transitions[]` becomes
  `assigned → converted | not_converted | invalid | ready`.
- `POST …/{id}/acknowledge` withdrawn. Delivery is **not** a separate endpoint —
  assignment publishes.
- `ACKNOWLEDGED` leaves the event union; **`DELIVERED` stays**.
- `outcome.acknowledgedAt` leaves the payload;
  `assignments[].deliveryStatus`/`deliveredAt` remain.

**Verified headless** against the real component and seed: the strip reads
`13 total · 1 New · 2 ready · 1 no match found · 4 in qualification · 3 assigned ·
1 converted · 1 invalid` — the **3 assigned** confirms the two migrated records
folded in — with status pills rendering **New** and **Ready to Assign**.

## 2026-08-21

### Stacking: the z-index ladder gets tokens and gaps

**Area:** design system · **Files:** `admin-theme.css`

**What was wrong, and it was not what was reported**

The report was "still a tooltip z-index bug". I could not reproduce it. The strip
tooltip was rendered headless three times against the real component, the real
seed and the real vocabulary, in a faithful copy of the list page — the actions
band, the twelve-cell filter grid, the attention strip, the chip row and the real
`.be-tbl` (min-width 1160px) inside the scrolling `.dls-body`, all wrapped in
`main.content`. Sampled at five points across its own area, at 1180px and 1400px,
collapsed and expanded: **on top at every point, every time.**

So rather than keep guessing at the symptom, the underlying fragility is fixed.

**The fragility**

`.dls-attn` was `z-index: 3` and `.tbl th` was `z-index: 2` — two bare numbers,
one apart, each written in the middle of a component, in a theme where every
other layer is a named token (`--z-nav`, `--z-topbar`, `--z-pop`, `--z-layer`,
`--z-toast`). One apart is not a decision, it is a coincidence. It had already
broken once: a cell tooltip picked 2 as well, tied with the sticky header, and
lost on document order alone.

Both rungs are now named, with a gap between them:

```
--z-stick: 2    the sticky table header
--z-band: 10    a command band, and anything hanging out of it
```

and the whole ladder — content, stick, band, topbar/nav, pop/layer, toast — is
documented in one place at the top of the file.

**`--z-stick` is pinned to its original 2 deliberately.** Raising it to sit
mid-gap looked tidier and would have been a regression: `.tgr-pop`, the colour
dropdown in Tags, is `z-index: 3` and hangs over rows. Lifting the header above
it would have pushed that dropdown behind the header it currently covers. The
comment in the token block says so, so nobody "tidies" it later.

Net effect: nothing moves except the band, 3 → 10, which is what needed headroom.
Verified in the built CSS and re-rendered: `.dls-attn z=10`, `.be-tbl th z=2`,
tip on top at all five sample points.

**For the API:** nothing. Presentation only.

## 2026-08-21

### Removed: ownership and callbacks · renamed two labels

**Area:** whole module · **Operation doc:** `OPERATION-2026-08-21-remove-ownership-and-callbacks.md`

Six requested changes: two label renames, and four removals that turned out to be
two whole features. The removal depth was confirmed before any code moved —
"remove mine logic" can mean "hide the cell" or "delete the concept", and those
are very different amounts of work.

**Renamed**

| Was | Now | Scope |
|---|---|---|
| status label `Generated` | **New** | label only — `generated` is still the key |
| `no eligible` / `No eligible business` | **No match found** | strip cell, row pill, record pill and note |

**Deliberately not renamed:** `generated` stays the status **key** (it is in every
seed record, every event, `transitions[]`, and `?status=generated`);
`flag=no_eligible` stays the URL value; `no_eligible_business` stays the **422
error code**, which is a published contract rather than vocabulary.

**Removed: callbacks**

`followUpAt` off the enquiry and off every contact-log entry. With it went
`followUpDue`/`followUpOverdue`, the `callbackDue`/`callbackOverdue` counts, the
**overdue** and **callback due** strip cells, `flag=followup` and `flag=overdue`,
the **Follow-up column**, the **"Callback soonest" sort** and the overdue
tiebreaker in the default sort, the red row rail, the **datetime field** in the
contact composer and the `requiresFollowUp` gate that made it mandatory, the
`callback-due` auto tag, and the `callback_due_at` CSV column.

**Kept:** the `callback_requested` **outcome**. "They asked us to ring back" is
still a true thing to record about a call — it simply no longer schedules
anything.

**Removed: ownership**

`owner` off the enquiry and all 13 seed records. With it went the `Owner` type,
`isMine()`, the `mine`/`unowned` counts, the **mine** and **unclaimed** strip
cells, `owner=__mine`/`owner=__none`, the **Owner column** and **Owner filter**,
the **Claim / Release / Take over** controls and hand-over select on the record,
**`setOwner()` and `claim()` (BE-T10)**, the `OWNER` event, the `owner` CSV column
and the Owner row on the printed sheet.

**Kept:** `VOCAB.team` and `currentActor()`. The team is still who *acts* —
named on every event, on `qualifiedBy`, on every remark. Only *assigning an
enquiry to a person* went.

**Numbers:** attention strip **14 → 10** cells. CSV **40 → 38** columns. Table
loses two columns.

**Method:** types first. `owner` and `followUpAt` came off the `Enquiry` type
before anything else, so `tsc` enumerated all 31 call sites across 7 files
instead of grep. Three pieces of code died only as a consequence and were caught
the same way: `initialsOf()` (no callers), the `.be-r-bad` row rail (unreachable
— nothing in the module is late any more), and the `touched`/`setTouched` state
in the contact composer.

**The consequence, stated plainly**

Two guards come off and nothing replaces either. **Nobody is named against an
enquiry** — the collision this prevented was two qualifiers ringing one customer
within the hour, and `unclaimed` was the number that surfaced it. **Nothing
tracks a promised call-back** — "we'll ring you Tuesday" is now a note and
nothing more.

Together with the SLA removal earlier today, **every time-based obligation in
this module is gone**: nothing watches the business after delivery, nothing
watches us before qualification. It is now a queue and a router, and chasing is
something people do by reading it. Coherent, and worth re-reading the day
somebody asks why an enquiry sat for a week.

**For the API**

- **BE-T10 (owner) withdrawn** — struck through in `BACKEND-INTEGRATION.md`
  beside BE-T06, not deleted.
- `owner` and `followUpAt` leave the enquiry payload; `followUpAt` leaves each
  contact-log entry.
- `flag=` loses `followup` and `overdue`; `owner=` goes entirely; `sort=followup`
  goes; `OWNER` leaves the event union.
- CSV loses `owner` and `callback_due_at`.
- `statuses[].label` for `generated` is now **"New"**; the key is unchanged.
- `attentionCells[]` is down to 10 entries.

**Verified in a browser this time** — the strip was rendered headless from the
real `AttnStrip`, the real seed and the real vocabulary: four primary cells
(`13 total · 1 untouched · 2 ready · 1 no match found`) plus six behind "+6
more", tooltips intact, status rendering as **New**.

## 2026-08-21

### Fix: the cell tooltip painted behind the table header

**Area:** `#/business-enquiries` — the attention strip
**Files:** `admin-theme.css`

**What happened**

`.tbl th` is `position:sticky; top:0; z-index:2`. The tooltip was also `z-index:2`.
A tie in z-index breaks on document order, and the table comes after the strip —
so the sticky header painted straight over the tooltip hanging down into it.

**What was changed, and what was not**

Raising the tooltip to `3` would have fixed today and broken again the next time
somebody picked a number for a sticky header. The z-index went on **the band**
instead — `.dls-attn{ position:relative; z-index:3 }` — which gives it a stacking
context above the scrolling body and states the real rule once: *the command
bands sit above `.dls-body`, and anything inside them inherits that.* The
tooltip's own z-index dropped to `1`, now only local ordering among the band's
children.

`.dls-body` is `overflow:auto`, which does **not** create a stacking context on
its own, so the sticky header and the band compete directly at the root — 3 beats
2 and the tie is gone.

**Blast radius:** visually inert everywhere else. The band and the body never
overlap in normal flow, so raising it changes nothing that was visible before,
and `3` is far below `--z-topbar` (15) and `--z-nav` (20) — everything meant to
cover the band still does. Checked every remaining z-index in the theme and this
module: only `.tbl th` sits inside `.dls-body`, and `.tgr-pop` / `.pop-why` are
in unrelated stacking contexts.

**For the API:** nothing. Presentation only.

## 2026-08-21

### Attention strip: a real tooltip, replacing the native one

**Area:** `#/business-enquiries` — the attention strip
**Files:** `ui/index.tsx`, `admin-theme.css`, `List.tsx`, `enquiries.css`

**Why the native one had to go**

`title` was the wrong instrument for fourteen cells of two-part help. It cannot
be styled or themed, waits about a second, truncates, renders as one grey blob —
and **never appears on keyboard focus at all**, so the help added earlier today
was unreachable without a mouse. The replacement answers to `:focus-visible` as
well as `:hover`, which makes this an accessibility fix as much as a visual one.

**Three decisions worth recording**

**It is a sibling of the cell, not a child.** Inside the button its text would
join the accessible *name* — the cell would announce as *"1 untouched In
qualification, with not one contact attempt logged against it…"*. As a sibling
reached by `aria-describedby` it stays a *description*, which is what it is, and
CSS reaches it with an adjacent-sibling selector.

**It is anchored to the band, not to the cell.** Anchored to the cell, the last
of fourteen cells would push a 520px panel off the right edge — and `.dls` is
`overflow:hidden`, so it would be clipped rather than merely ugly. Fixing that
properly needs measurement, which is what `openPop` is for, and a popover you
must dismiss is the wrong weight for read-on-hover help. Band-anchored it cannot
overflow at any width and always appears in the same place, so the eye learns
where to look while scanning. **The cost is real and not hidden: the tip for the
rightmost cell is not under the cursor.**

**It fades with opacity, not `visibility` or `display`.** Both of those remove
the element from the accessibility tree, and `aria-describedby` cannot reach what
is not there. `pointer-events:none` stops the invisible panel eating clicks meant
for the table underneath. A 0.3s delay in, none out, so sweeping the row does not
strobe — shorter than the native ~1s because the row is meant to read at a glance.

**Shape**

The two halves are now two elements rather than one string with a blank line in
it: what the number counts, then a hairline rule, then what pressing it filters
to, quieter. They answer different questions and now look like it.

**Blast radius**

`tip` is **opt-in** on `StatCell`. Eight other modules use `StatStrip` — Deals,
Invoices, Quotations, Plans, Roles, Team, Audit — and none sets it, so none
renders a `.dls-tip` and none of the new CSS applies to them. The one global
change is `.dls-attn{position:relative}`; checked that no module has an
absolutely-positioned descendant inside a strip, so it is inert. A cell that sets
both `tip` and `title` now silently drops the native one **in the component**
rather than being warned against in a comment — two tooltips over one target is a
silent failure that looks like a browser bug from outside.

**One constraint inherited with it:** a band using tips must not keep the theme's
default `overflow-x:auto`, or it clips its own tooltips. This module already set
it visible for wrapping; the second reason is now recorded next to the first so
neither gets deleted as redundant.

**For the API:** nothing. Presentation only.

**Not verified in a browser** — standing reason, and it bites hardest here:
hover, focus, the delay and the band anchoring are all things only a browser can
confirm.

## 2026-08-21

### Attention strip: hover help on every cell — and a count that was lying

**Area:** `#/business-enquiries` — the attention strip
**Files:** `List.tsx`, `store.ts`, `vocabularies.json`, `check-enquiry-wiring.cjs`, `package.json`

**The bug found while writing the help text**

Every cell is a number *and* the control that filters to it, so the two must be
the same set. **`callback due` was not.** It counted
`callbackDue - callbackOverdue` — scheduled but not yet late, because overdue has
its own cell beside it — while `flag=followup` filtered on `followUpDue()`, which
is merely "has a callback set" and therefore *includes* the late ones.

The cell read **0**. Pressing it returned **1 row**.

That is worse than either half being wrong alone: the number is the control, so
once one cell lies the whole row is untrustworthy. Fixed in `filterEnquiries()` —
`flag=followup` now excludes overdue, matching the label and its neighbour.

**Hover help, from content**

All 14 cells carry a `title`. Each says two things: what the number counts, and
what pressing it filters to. The second half is the one that matters, because
that is the half that can drift.

The text lives in `vocabularies.json` as `attentionCells[]` (`key`, `counts`,
`does`) — product vocabulary alongside statuses and tiers, not strings buried in
a component, and the API will serve it eventually. A native `title` rather than a
popover: fourteen read-on-hover sentences on a row of small targets would
otherwise be fourteen things that can be left open.

**The guard**

`check:wiring` now bundles the store and asserts, for all 14 cells:

- the count **equals the row count of the filter it applies** — run against the
  real `countsOf()` and `filterEnquiries()`, not a re-implementation
- help text exists, with both halves present and non-trivial
- no orphaned help for a cell that no longer exists

Verified to fail on the original defect before the fix was restored.

**For the API:** `attentionCells[]` joins the vocabulary payload. `flag=followup`
must mean **due AND NOT overdue** server-side — the previous meaning is the bug.

**Not verified in a browser** — standing reason.

## 2026-08-21

### Removed: the SLA logic

**Area:** whole module · **Operation doc:** `OPERATION-2026-08-21-remove-sla.md`
**Files:** `store.ts`, `List.tsx`, `Detail.tsx`, `index.tsx`, `bits.tsx`,
`Modals.tsx`, `exportCsv.ts`, `enquiries.css`, `enquiries.json`,
`vocabularies.json`, `BACKEND-INTEGRATION.md`

**What went**

The acknowledgement deadline and everything built on it:

| | |
|---|---|
| The clock | `sla.ackHours` (24), `sla.dueAt` stamped at delivery |
| The verdict | `sla.breached`, `sla.breachedAt`, the `SLA_BREACH` event type |
| The sweep | `runSlaSweep()` — BE-T06 — and its prototype button |
| The surfacing | breach pill, attention cell, toolbar stat, `SLA +Xh` list line, `flag=breached`, the sort tiebreaker, the `sla_breached` CSV column |

`sla` is off the `Enquiry` type and off all 13 seed records. The type went
**first**, deliberately: every remaining read became a compile error, so the
sixteen call sites were found by `tsc` rather than by grep. The attention strip
is five cells. The CSV is 40 columns, was 41.

**What deliberately stayed**

- **`outcome.acknowledgedAt` and the `ACKNOWLEDGED` event.** *Whether* a business
  acknowledged is the lifecycle. Only *late* stopped existing.
- **`businesses.quality.avgAckHours`.** A historical responsiveness signal behind
  the `quality` match weight — it ranks who *should* receive an enquiry. An input
  to matching, not a deadline on a delivered row.
- **The reassign reason**, reworded from "No acknowledgement within SLA" to
  **"Business never acknowledged it"**. It is the commonest real reason to
  reassign; the reason survives, the vocabulary does not.

Two seed strings were reworded for the same reason — an operator remark that
said "if this one breaches too" and an event note ending "· within SLA". Both
described a mechanism that no longer exists.

**The consequence, stated plainly**

**Nothing now tracks a business sitting on a delivered enquiry.** That was the
only mechanism watching the hand-off; after this, noticing is a human reading the
list. The customer side is still covered — `followUpAt` and overdue callbacks are
untouched — and the record still says how long ago it was delivered. Neither
replaces it.

It is a defensible trade rather than a free one. The threshold was **BE-OD-09, an
open decision**, so the module was enforcing a number nobody had agreed to, with
no notification infrastructure behind it. Enforcing an invented deadline is
arguably worse than enforcing none. Worth re-opening once BE-OD-09 is decided.

**Migration note.** A bookmarked `#/business-enquiries?flag=breached` no longer
filters. It does not error — the branch is gone, so the value is ignored and the
full list is shown with a clearable "Flag: breached" chip.

**For the API**

**BE-T06 is withdrawn — do not build the nightly job.** It is struck through in
`BACKEND-INTEGRATION.md` rather than deleted, so nobody rebuilds it from memory.
`sla` leaves the enquiry payload; `flag=` loses `breached`; `SLA_BREACH` leaves
the event union; the CSV contract loses `sla_breached`. `quality.avgAckHours`
stays on the business payload.

**Not verified in a browser** — standing reason: no backend for `me/permissions/`,
so `RequireSession` holds before the router reaches any module. `tsc`, `eslint`,
`vite build` and all five check suites pass.

## 2026-08-21

### Fix: the three-dot menu opened and closed inside one click

**Area:** `#/business-enquiries/:id` — record header
**Files:** `Detail.tsx`, `scripts/check-enquiry-wiring.cjs` (new), `package.json`

**The report:** "no dropdown showin". Pressing ⋮ did nothing visible.

**What was actually happening**

The menu opened every time. It also closed every time, during the same click,
before the browser had painted it.

`PopBox` in `src/admin/shell/ShellContext.tsx` mounts a popover together with a
document-level click listener:

```ts
const onDoc = (e: MouseEvent) => {
  const t = e.target as HTMLElement;
  if (!t.closest(".pop") && !t.closest("[data-act]")) onClose();
};
document.addEventListener("click", onDoc);
```

A click is a **discrete** event, so React flushes the whole update it triggers —
render, commit, layout effects and passive effects — before the native event
finishes bubbling up to `document`. By the time the press that *opened* the menu
reaches `document`, the listener that closes it is already registered. The target
is the ⋮ button: not inside `.pop`, and — in this module — not `[data-act]`
either. So it closed itself.

`data-act` is the escape hatch for exactly this, and every other popover trigger
in the panel already carried one — `in-more` on the invoice header, `qt-more` on
the quotation header, `doc-more` on the document page. This module's trigger was
written without one, so the menu has never opened since the day it was added.

**The fix:** `data-act="be-more"` on the trigger. One attribute.

**Why this needed more than the attribute**

Nothing could have caught it. It is not a type error, not a lint error, and it
throws nothing at runtime — the console is clean and the menu is simply absent.
The markup looks correct in review, because the attribute that is missing looks
like a test hook rather than a mechanism.

So it is now asserted. `npm run check:wiring` walks every JSX opening tag in the
module and fails any element that declares `aria-haspopup` without `data-act`,
plus checks the trigger and `RecordMenu` are still connected to each other. The
comment above the button explains the mechanism rather than restating the rule,
because the next person to copy this button into another module needs the reason,
not the instruction.

The check is scoped to Business Enquiries deliberately. The same rule holds
panel-wide, and several older Deals triggers (`Chat.tsx`, `Drawer.tsx`,
`Tags.tsx`) declare `aria-haspopup` with no `data-act` — they may be using a
different mechanism or may have the same latent bug, but that is not this
module's suite to fail on. **Worth a look separately.**

**For the API:** nothing. This is client wiring only.

**Not verified in a browser.** Same standing reason: `me/permissions/` has no
backend, so `RequireSession` holds before the router reaches any module. The
mechanism is confirmed from the shell source and from the three working triggers
that differ from this one by exactly this attribute.

## 2026-08-21

### Copy gets its own press; the dots move to the right end

**Area:** `#/business-enquiries/:id` — record header
**Files:** `Detail.tsx`, `menus.tsx`, `enquiries.css`

**What changed**

**The ⋮ is now the last thing in the row.** It sat before "All enquiries", so
the overflow menu was not at the end of anything.

**Copying an enquiry has its own button.** It is far and away the most frequent
thing anyone does *with* a record — more often than printing it, imaging it or
quoting its reference — and it was three presses down a menu. Now:

`… ‹ 1/1 › · All enquiries · [ Copy | ⋮ ]`

Drawn as a **split control** rather than two loose buttons, because that is what
it is: one primary action with a drawer of alternatives. The two share a border
and the pressed one comes forward, or the shared 1px edge swallows the focus ring
on the left button.

**The menu no longer repeats it.** A split control that lists its own default
action makes the first row of the menu the one thing nobody needs to open the
menu for. What is left behind the dots is the four alternatives: **Copy one
line · Copy reference · Download image · Print sheet**.

**One implementation of "copy", used twice.** `useCopy` / `useCopyDetail` in
`menus.tsx` back both the button and the menu rows. Two call sites each doing
their own clipboard handling is how one of them ends up reporting success over a
clipboard that was never written — `copyToClipboard` reports what actually
happened (it falls back to "press Ctrl+C" where the async clipboard is refused,
which `vite --host` on a LAN IP is), and both paths now surface that same answer.

**Temp data**

`none`.

**Backend needed**

`none`.

**Verified**

`npx tsc -b`, `npx eslint`, `npx vite build --mode dev`, `npm run check` (four
suites) all clean. Checked the rendered order of the id bar: the ⋮ is the final
element, and `useCopyDetail` is called above the component's early return so the
hook order is unconditional.

**Not verified in a browser.** The split button's joined border and the popover
anchoring to a control now flush against the right edge are the two things to
look at.

---

### The attention strip stops being a list of every status

**Area:** `#/business-enquiries` — attention strip
**Files:** `List.tsx`, `enquiries.css`

**What changed**

The strip had grown to **fifteen cells** — every lifecycle state, both ownership
questions and every flag. At that size it was no longer an attention surface; it
was a second copy of the Status dropdown printed permanently across the top of
the page. **A row where everything is highlighted highlights nothing.**

**Five cells survive**, and each passes the same test: *somebody has to do
something about this number today.*

| Cell | Whose failure | What it means |
| --- | --- | --- |
| **untouched** | ours | nobody has contacted this customer at all |
| **overdue** | ours | we promised to ring back and did not |
| **ready** | ours, pending | qualified and waiting on the routing decision |
| **SLA breached** | theirs | a business has had it a day and not answered |
| **no eligible** | nobody's | matching found nobody — a coverage gap |

Five different **kinds** of failure, which is why it is five and not three. Plus
**total**, which is how you clear.

**Nine cells moved behind a `+9 more` disclosure — hidden, not deleted**, and
none of them lost a filter, because each already had a control:

| Hidden | Still reachable via |
| --- | --- |
| in qualification · assigned · delivered · acknowledged · converted · invalid | the **Status** filter |
| mine · unclaimed | the **Owner** filter |
| callback due (scheduled, not yet late) | the **Callback soonest** sort |

Those are states you look things up *by*, not work waiting to be done. The strip
is for the second kind.

**One detail that matters more than it looks.** If a hidden count is the
*currently active* filter, the row expands on its own and the disclosure reads
**Filtered** rather than a disabled "Fewer". A filter you cannot see is a filter
you cannot clear — and a disabled button labelled with the thing it will not do
reads as broken rather than as deliberate.

**Temp data**

`none`.

**Backend needed**

`none` — no filter key changed, and every count was already derived client-side
from the same list payload.

**Verified**

`npx tsc -b`, `npx eslint`, `npx vite build --mode dev`, `npm run check` (four
suites) all clean. Checked directly that each of the nine hidden counts still has
a control on the screen: `status`, `owner` and `sort` are all present in the
filter grid.

**Not verified in a browser.** With six cells the strip should now fit one line
at 1280px without wrapping — that is the claim to check.

---

### The filters go back beside the search, on a grid

**Area:** `#/business-enquiries` — command area
**Files:** `List.tsx`, `menus.tsx`, `bits.tsx`, `enquiries.css`

**What changed**

**The header filtration row from the previous entry was wrong and is gone.** It
gave the page a **second search box**, and once every filter is back beside the
first one it duplicated the selects too. Removed entirely.

**All filters are inline with the search again**, and this is the third place
they have lived — a flex row that wrapped raggedly, then a popover that hid
them, then a table-header row that duplicated the search. Each move treated the
symptom. **The problem was never where they lived: it was that a ragged wrap has
no alignment to read.** Eleven controls of eleven widths break at eleven
different places, and the second line starts wherever the first ran out.

So they are a **grid** — `repeat(auto-fill, minmax(158px, 1fr))`, every cell the
same width and the same height. A wrapped grid falls into **columns**: the fifth
control sits under the first whatever the window is doing, and a second line
reads as a deliberate row rather than as overflow. That is what makes "all the
filters beside the search" survivable at twelve of them.

Two bands, split by kind rather than by what fits: **actions** (search · Export ·
Add enquiry) and **filters** (the grid). Search takes whatever room is going — it
is the fastest route to one record; everything else narrows a set.

**The "More filters" button is gone**, and `FiltersPanel` with it — dead code
that still compiles is the kind that gets copied into the next module.

**The SLA sweep button is gone from the toolbar — and moved into the prototype
banner**, next to "Reset data". Neither is a product feature: on the real thing
the seed does not exist and the sweep is a cron job nobody presses. A
prototype-only button sitting beside Export and Add enquiry teaches the wrong
toolbar; inside the banner that says *none of this is real*, it teaches the right
one. The capability is kept, not deleted.

**Alignment.** Every band now starts at the same x — actions, filter grid,
attention strip, filter chips and the table. They were four different insets,
which is what the note about alignment was pointing at.

**Two labels meant two things.** "State" was the lifecycle filter *and* the
region filter, side by side in the same grid. Lifecycle is **Status** now,
everywhere on this screen including the table column and the filter chip; the
region keeps **State**. The Sort control's empty option says **"Sort: Needs
attention"** rather than "Sort", so the current order is legible without opening
it.

**Temp data**

`none`.

**Backend needed**

`none` — no filter key changed, so the list contract is untouched.

**Verified**

`npx tsc -b`, `npx eslint`, `npx vite build --mode dev`, `npm run check` (four
suites) all clean. Checked directly: **exactly one** `SearchField` in the list,
no `FilterRow`, no "More filters", no SLA sweep in the command area, and **no
dead CSS** — `.be-frow`, `.be-fsel`, `.be-finp`, `.be-fpair`, `.be-filterbtn`,
`.pop-filters` and the panel's field rules are all removed rather than left
orphaned.

**Not verified in a browser.** The grid's wrap points at 1280px and 1440px are
the thing to look at first — the whole change is an alignment claim.

---

### Detail-view CSS, header filtration, Remarks, Download image & Copy detail

**Area:** `#/business-enquiries` (table header) · `#/business-enquiries/:id`
(id bar, Remarks, three-dot menu)
**Plan:** [OPERATION-2026-08-21-detail-css-filters-remarks-share.md](OPERATION-2026-08-21-detail-css-filters-remarks-share.md)
**Files:** `bits.tsx`, `Detail.tsx`, `List.tsx`, `menus.tsx`, `exportCsv.ts`,
`ExportModal.tsx`, `share.ts`, `store.ts`, `enquiries.css`,
**`imageSheet.ts` (new)**, `src/content/business-enquiries/enquiries.json`,
`scripts/{check-enquiry-seed,check-enquiry-export,check-enquiry-share}.cjs`,
`package.json`

**What changed**

**1 · The black bar in the record header.** `TierBadge` took a `withHelp` prop
that rendered the tier definition as a second child — and `.be-tier` is an
`inline-grid`, so two children became two **rows**. An id-bar override released
the width, so the badge stretched across the whole flex line as a black bar with
the letter floating in it and the definition spilling below its fixed 20px
height. One prop, both artefacts. A badge is a badge now: one letter, 20px
square, definition on the `title` and written out behind the (i) on the Enquiry
block. Also added the missing row-gap on the wrapped id bar and pinned every
child to `flex: 0 0 auto`, so nothing in that row can grow to fill it again.

> The **small red dot** below the chips in the screenshot is not accounted for by
> anything I can find in that row. The malformed badge subtree was the most
> likely source and is gone; if it survives, it needs a browser to find. Saying
> so rather than claiming it fixed.

**2 · The filtration row is back, in the table header.** A second `<thead>` row,
one control under the column it filters — Tier, From, Category + City, Urgency,
Owner, Callback, State, Business, Age. A control under "Urgency" needs no label;
its position is its documentation.

**It adds no filter logic.** Every control writes the same `Params` key the
Filters panel writes, through the same `onFilter`, so the chips, the strip, the
export scope and the URL all move together. The panel stays for what has no
column — tag, state, and the custom date window — and is relabelled **More
filters**. The search placeholder was shortened so it stops truncating mid-word.

**3 · Remarks.** An internal note thread, deliberately **not** a contact-log
entry:

| | Contact log | Remark |
| --- | --- | --- |
| Records | an attempt to reach the customer | an internal note |
| Contains | what the customer **said** | what **we** think |
| Leaves the panel | the summary only | **never** |

Folding remarks into the log would mean inventing a fake attempt to hold each
one, and every count that reads the log would inherit it — `contactLog.length`,
`everReached()` and the qualification gate all treat a row as evidence somebody
picked up a phone. Append-only, allowed at any status, `Ctrl`+`Enter` to add. The
list shows **that** a record has notes, never what they say. The timeline records
that one was added and by whom — never its text.

**4 · The three-dot menu** is now **Copy detail** · Copy one line · Copy
reference · **Download image** · Print sheet.

- **Download image** — a 1080×1350 PNG drawn on `<canvas>`, no library. A
  rasteriser would be ~200 KB for one button and would screenshot whatever theme
  the user happens to be in, so a dark-mode operator would send a dark card.
  Hand-drawn is deterministic and identical for everyone.
- **No company name on it, anywhere** — no wordmark, no entity, no domain. It is
  made to be forwarded and cannot be withdrawn once it has been; the reference
  identifies it and whoever receives it knows who sent it.
- **Print sheet stays and keeps the company name**, which is the distinction
  rather than an inconsistency: that one is an internal document.

**A real defect this work uncovered.** The new share guard found that
`match_rank` and `match_score` were in the **Assignment** export group, which is
**on by default** — while the same dialog offers a business-scoped export as
"the file to send a business about its own enquiries". That combination handed a
business the exact number it was ranked on, which turns routing into a
negotiation and the weight table into something to game. They now live in their
own **Matching internals** group: off by default, flagged internal, and the
Download button is **disabled outright** while it is ticked together with a
business filter. Kept rather than removed — match-score distribution is a named
admin metric.

**Temp data**

`enquiries.json` → `remarks[]` on every record, with two worked examples so the
distinction from a contact-log entry is visible in the seed rather than only in a
comment.

**Backend needed**

- `POST /business-enquiries/{id}/remarks` (**BE-T12**) → append-only, any status.
  Appends a `REMARK` event carrying only the fact and the actor. **`GET
  .../timeline` must not return remark text either** — the timeline is the one
  surface a business-scoped read could plausibly reach one day.
- `GET /business-enquiries` → a remark **count** on the list row; the text must
  not be on the list payload at all.
- `GET /business-enquiries/{id}` → `remarks[]` newest-first, **operations scope
  only**.
- The export's `matching` group must be refused server-side for a
  business-scoped request, not merely unticked in the client.

**Verified**

`npx tsc -b`, `npx eslint`, `npx vite build --mode dev`, and `npm run check` —
now **four** suites.

`check:share` is new and guards the rule across all four export paths. It is a
**source-level** check for three of them, and says so in its own header rather
than implying more: a canvas needs a DOM and the print sheet is a string handed
to a browser, so neither can be executed in node. It catches the realistic
regression — somebody adding `remarks[0].text` to a layout because it would be
useful there.

Everything new was **negative-tested**: leaking remark text into the CSV, putting
`match_score` back in a default group, and putting the company name on the image
each fail with the exact message and exit 1, then pass again on revert. The first
draft of the guard also produced a **false positive** — it matched the `.note`
CSS class inside the print sheet's own stylesheet and reported a font-size as a
leak. Tightened to require a word character before the dot, and the reason is in
the code, because a check that cries wolf gets switched off.

**Not verified in a browser.** No backend. Three things to look at first: the
filtration row's alignment at 1280px, the record header now the badge is fixed
(and whether that red dot survives), and the generated PNG at actual size.

---

## 2026-08-20

### Explanation behind an (i), not on arrival

**Area:** whole module — every screen
**Files:** `src/admin/views/BusinessEnquiries/{bits.tsx,Detail.tsx,Suggestions.tsx,Qualify.tsx,Modals.tsx,ExportModal.tsx,NewEnquiry.tsx,List.tsx,menus.tsx,enquiries.css}`

**What changed**

An audit of the module found **about 1,500 words of rationale in the notices and
block headings alone, all of it permanently on screen** — why a snapshot is
frozen, why the panel ranks but never computes, why an enquiry is not a deal.
Every sentence was worth writing and almost none of it was worth reading twice.
A screen that explains itself continuously reads as unsure of itself, and the
prose was crowding out the numbers and states somebody opened the page for.

The rule now: **the screen carries what you need to act, the (i) carries why.**

Three components in `bits.tsx` make it one affordance rather than nine
improvisations:

- **`BlockHead`** — a card heading with its rationale folded behind an (i). Most
  of the prose sat at the top of a card, which is exactly where this goes.
- **`InfoNote`** — a notice showing only the line you have to read, with the
  reasoning one press away. Used without children it is just a notice, which is
  right for a warning that has no subtext.
- **`InfoDot`** — the button alone, for a label that is not a `BlockHead`.

**What stayed visible, and why.** Six notices survive as always-on, and they are
the six that block or warn before a press: `422 override_reason_required`, "no
other eligible business", "this enquiry is an exception, not an invalid one", the
duplicate-phone check, the customer-contact warning on export, and "nothing
matches these filters". Empty states stayed too — they are the one place where
prose *is* the content. So did the prototype banner.

**What moved.** Everything that answers *why* rather than *what now*: the frozen
snapshot explanation, "copied not referenced", "stored not recomputed",
"recommendation is not assignment", "an enquiry is not a deal", the append-only
grant-level rule, the business's-sale-not-ours rule. Long field hints were cut to
one line each — "Masked in this prototype" rather than a sentence about OTPs.

**Nothing was deleted.** An explanation worth writing down is worth keeping; it
just stops being the first thing on the screen every single time.

Measured after: **340 words always on screen, ~1,160 behind the (i)** — 24
always-on notices down to 6, and 13 free-floating prose blocks down to none.

**Temp data**

`none` — no content changed.

**Backend needed**

`none`.

**Verified**

`npx tsc -b`, `npx eslint`, `npx vite build --mode dev`, `npm run check` (three
suites) all clean.

The word counts above are measured, not estimated — a script strips code
comments and JSX tags and counts what is inside `short=`/`text=` (visible)
against `InfoNote` children and `BlockHead info=` (folded). The first draft of
the `bits.tsx` header claimed "roughly nineteen hundred words" from memory; the
measurement said 1,499, and the comment was corrected to the measured figure
rather than left as a number nobody had checked.

**Not verified in a browser.** No backend. The (i) expansion is in-flow rather
than a popover, deliberately — the panels have `overflow: hidden` and a
positioned tooltip would clip inside them — so the thing to check first is that
expanding one inside the qualification panel does not push the freeze footer
around unpleasantly.

---

### Three sources, typed fields, and a clock filter that works

**Area:** `#/business-enquiries` — filter panel, Add enquiry, the record's requirement form
**Files:**
`src/content/business-enquiries/{enquiries,vocabularies}.json`,
`src/admin/views/BusinessEnquiries/{store.ts,bits.tsx,NewEnquiry.tsx,Qualify.tsx,menus.tsx,List.tsx,index.tsx,exportCsv.ts,share.ts,Detail.tsx,enquiries.css}`,
`scripts/{check-enquiry-seed,check-enquiry-clock}.cjs`, `package.json`

**What changed**

**1 · Three channels, not four.** "Website" and "Funnel page" were the same thing
wearing two names — both a form on a page we publish, matched by the same rules
and qualified by the same questions — and a distinction nobody acts on is a
filter option that only makes the list harder to reason about. The exact page is
still recorded on every enquiry, so nothing was lost. The seed record that used
`website` went back to the funnel it actually came from.

The source picker is **three chips on one line with the descriptions behind an
(i)**. It was four cards carrying a sentence each: a paragraph of reading before
the first field, every time, for a choice that is usually obvious from the fact
that you are typing the enquiry yourself. The explanation still exists for the
once it is not.

**2 · Category, city and state are typed, not picked.** An operator on a call
hears whatever the customer says; a `<select>` that cannot hold it forces a wrong
pick or a blank, and both are worse than an unfamiliar value. They are text
inputs backed by a `<datalist>` of the values we already use — type anything, the
known ones are a keystroke away.

The trade is real and is **shown rather than hidden**: stage 1 eliminates on
category and location, so a value the matching rules have never seen will match
nobody. When that is about to be true the field says so underneath, as a note and
not an error — the value may be perfectly correct and the vocabulary simply
behind, and an enquiry from a city we do not cover is precisely the evidence that
says where coverage is missing.

**State** is new, alongside city, and threads through the record, the export, the
share text and the printed sheet. An address that stops at the city is one a
business in the next state over can still look plausible against.

**3 · The clock filter is real.** There was a clock icon in the command row that
**ran the SLA sweep** — an unlabelled clock sitting in a row full of filters,
reading as "filter by time" and doing something else entirely. It is labelled
**SLA sweep** now, and time filtering exists properly:

- **When it arrived** leads the filter panel, because "what came in today" is the
  question this screen gets opened with more often than any other.
- Today · Last 24 hours · Last 7 days · Last 30 days · This month · Older than 30
  days · **Custom range**, with either end optional — "everything since the 1st"
  and "everything before the 9th" are real questions, and demanding the other end
  to ask them is the kind of form people give up on.
- Windows are **resolved when the filter runs**, never when it was set. A range
  stored as two absolute instants silently stops meaning "today" tomorrow, while
  the chip still says Today.
- The chip names the **window**, not the key: "Received: Last 7 days", and one
  chip for a custom range rather than three. Removing it removes the `from`/`to`
  it was made of, so the next range picked cannot inherit stale bounds.

**Temp data**

- `vocabularies.json` → `sources` down to three; new `states`, `receivedRanges`;
  a note that `categories`/`cities` are now **suggestions, not a closed set**.
- `enquiries.json` → `requirement.state` on every record, inserted in address
  order; the `website` record reverted to `funnel`.

**Backend needed**

- `GET /business-enquiries?received=&from=&to=` → the same seven windows,
  resolved **server-side at request time**. A client sending two absolute
  instants would be the same bug in a different place.
- `requirement.state` on both payloads and as a `state` filter.
- Category and city are now free text. The API must accept values outside its own
  vocabulary and **must not silently coerce them** — a value quietly rewritten to
  the nearest known one is worse than one that matches nobody, because the second
  is visible.

**Open decisions**

- `BE-OD-22` — should an off-vocabulary category or city raise something an admin
  sees, rather than only a note on the form? Assumed not yet: the note is where
  the person who can fix it is standing. A queue of "unknown values" is the right
  answer once there is somebody whose job it is to drain it.

**Verified**

`npx tsc -b`, `npx eslint`, `npx vite build --mode dev`, and **`npm run check`**,
now three suites.

`npm run check:clock` is new: the real store module bundled by esbuild, at a
**pinned mid-afternoon "now"** — the window function takes `now` as a parameter
precisely so it can be pinned rather than tested against whatever today is. It
asserts that midnight belongs to exactly one day, that `30d` and `older` are
complements with no gap and no overlap, that an open-ended custom range works
from either end, that the "to" date includes its whole day, and that the chip
names the window rather than the key. **Negative-tested** by removing the
end-of-day adjustment from the custom range — it fails with
`the "to" date is not inclusive of its own day` and exits 1.

The seed check gained: exactly three channels, and a state that never appears
without a city.

**Not verified in a browser.** No backend. `<datalist>` styling is the browser's
and not the panel's — worth a look in Firefox and Safari, which draw it
differently from Chrome.

---

### Filters into a panel, and an export that matches the screen

**Area:** `#/business-enquiries` — command row, filter panel, export dialog
**Files:**
`src/admin/views/BusinessEnquiries/{exportCsv.ts,ExportModal.tsx,menus.tsx,List.tsx,enquiries.css}`,
`src/content/business-enquiries/enquiries.json`,
`scripts/check-enquiry-export.cjs`, `package.json`

**What changed**

**The command row is three parts now: find it, narrow it, act on it.** Nine
selects used to sit beside the search box. The row wrapped on a laptop, and
Export moved depending on how wide the window was — the worst property a button
that writes a file full of customer data can have. Search, a **Filters** button
and Sort on the left; the sweep, Export and Add enquiry on the right, always in
the same place.

Collapsing the filters hides nothing: an active filter still renders as a chip
under the strip, which is where it was already read and cleared. The button
carries a count so "why am I seeing four rows" is answerable without opening it.
Inside, the filters are grouped by the **question** they answer rather than by
field type — *Who is on it* (owner, state, tag, needs-attention), *What it is*
(category, city, urgency, tier, from), *Where it went* (business). Somebody
picking up the morning's work uses the first group and nothing else, so it is
first.

**Export now does what it says, and says what it will do.** It was a toast
saying the API was missing. It is a real CSV of **the rows on screen, in the
order they are on screen** — filtered and sorted, not a fresh unfiltered query.
That is the whole contract, and it is worth stating because the alternative is
the bug: narrow to one business, press Export, get everything.

- **The button carries the row count.** "Export" is a button you press to find
  out what happens; **"Export 7"** has already answered the question, and it
  changes as the filters change. It is dashed when the count is a subset.
- **It is amber, not brand.** Prominent, because it is the only control here
  that produces a file of customer data and the only one whose scope depends on
  settings made elsewhere. Not primary — Add enquiry is.
- **The dialog leads with the scope**, as a sentence built from the same filters
  the rows came from, so it cannot describe a set other than the one being
  written. Filtered to a business, it says so and points out that this is the
  file to send that business.
- **Columns are groups, and customer contact is off by default**, with the
  warning beside the tick rather than in a footnote. Ticking it changes the
  confirm button to "Download with contact data" and turns it red.
- **The filename carries the scope** — `enquiries_studio-aangan_delivered_4_2026-08-20.csv`.
  A business-scoped export named `enquiries.csv` is the one somebody forwards
  believing it is everything.
- **"Ignore the filters and export all"** is a tick inside the dialog, not a
  second button on the toolbar: it is a decision, and it belongs where its
  consequence is printed beside it rather than one slip from the filtered one.
- A BOM, because Excel opens a bare UTF-8 CSV in the local codepage and turns
  every accented name into mojibake.

**The contact log is not exportable at any tick.** Same rule `share.ts` enforces
for copy and print — our notes about a customer, written by an operator for an
operator; the only line meant for anyone else is the requirement summary. Three
export paths now share one rule, which is exactly when a rule starts to rot, so
it is asserted in code rather than in a comment.

**Temp data**

`enquiries.json` → four records had `contactLog[0].response` seeded **identical**
to `qualification.requirementSummary`. Unrealistic — speech and a written summary
are never verbatim the same — and it made the export test unable to tell a leak
from a coincidence. Replaced with distinct customer-voice lines.

**Backend needed**

- `GET /business-enquiries/export?<the same filters>` → when it exists it must
  apply **the same filter set** the list does and return rows in the same order.
  A server export that quietly ignores a filter is the failure this dialog is
  built to prevent. Column groups should be a request parameter, and the contact
  group should be refused server-side unless the actor holds the grant — the
  client hiding it is a convenience, not the control.
- The export action wants its own permission (`business-enquiries.export`) rather
  than riding on `close`, which is what the panel checks today.

**Verified**

`npx tsc -b`, `npx eslint`, `npx vite build --mode dev`, and **`npm run check`**
— which now runs two suites.

`npm run check:export` is new and runs the **real** module, bundled by esbuild,
against the real seed: contact absent unless ticked, contact log never present at
any tick, BOM, CRLF, one cell count per row, and a value containing a quote, a
comma and a newline that does not tear the row in two. It was
**negative-tested** by adding a `last_response` column to the exporter — it fails
with six leak messages and exits 1, then passes again once reverted.

**Not verified in a browser.** No backend. The filter popover's height against a
short viewport, and the print sheet from the previous entry, are the two things
to look at first with a live session.

---

### Manual intake, provenance, and taking an enquiry out of the panel

**Area:** `#/business-enquiries` (Add enquiry, From column and filter) ·
`#/business-enquiries/:id` (overflow menu)
**Files:**
`src/content/business-enquiries/{enquiries,vocabularies}.json`,
`src/admin/views/BusinessEnquiries/{NewEnquiry.tsx,menus.tsx,share.ts,store.ts,List.tsx,Detail.tsx,bits.tsx,index.tsx,enquiries.css}`,
`scripts/check-enquiry-seed.cjs`

**What changed**

**1 · The Create button is back. This supersedes "there is no Create button"**
in the first entry of this log.

The original objection was that a hand-typed enquiry has no submission id, no
duplicate check and no qualification snapshot — a record with no provenance in a
queue that runs on provenance. That was right about the danger and wrong about
the cause. The danger is the missing guarantees, not the human typing. People
ring the office, walk in, and get referred; refusing to record it does not stop
it happening, it just means the enquiry gets worked in somebody's notebook and
the business it eventually reaches is chosen with none of this module's
machinery.

So the form exists and the three guarantees are kept by the form instead:

- a submission id, prefixed `man-` so the origin is legible in the id itself
- **the same duplicate check**, run against every existing enquiry as the phone
  number is typed and shown *before* the record exists rather than reported
  after. Matching on the last ten digits, so formatting cannot defeat it.
  Creating anyway needs an explicit tick and tags the record
  `duplicate-suspected`
- it lands in **Generated** with an empty checklist and must be qualified by a
  person like any other. Typing it yourself buys no shortcut past the gate,
  because the gate is what a business is trusting when it accepts the enquiry

And it records the one thing an inbound enquiry cannot: who typed it. Tier is
computed from what was actually filled in rather than chosen — a manual enquiry
is not automatically a good one, and `A` is unreachable by this route because it
requires verified contact. Whoever creates it owns it; they have just spoken to
the customer, and leaving it unclaimed would put it back in the pile they took it
out of. Everything except name, phone and how it reached us is optional: the
person filling this in is usually still on the call, and a required field they
cannot answer yet is one they will guess at.

**2 · Every enquiry says where it came from.** A `sources` vocabulary — **funnel ·
website · portal · added by us** — with a From column, a From filter, and a chip
on the record. A manual one additionally carries `via` (phone, WhatsApp, walk-in,
referral, email, event) and `createdBy`, both shown on the chip: "added by us"
without a name is the absence of provenance wearing the word. The seed gains a
website record and a worked manual one, so all four channels appear in the list
rather than only the two the first seed happened to use.

**3 · Copy and download, from an overflow menu on the record.**

- **Copy for WhatsApp** — plain text, no markdown, because `*bold*` renders in
  one app and shows as punctuation everywhere else.
- **Copy one line** — reference, name, phone, category, location.
- **Copy reference.**
- **Download / print** — an A4 sheet through the existing `printHtml`, the same
  route Quotations and Invoices already use for documents. It is print-to-PDF
  rather than a generated file: one press further away, but a real PDF with
  selectable text and correct page breaks, and one way documents leave the admin
  instead of two.

Both shapes are built from one description in `share.ts`, so neither can quietly
start including a field the other does not. **What never leaves, in either:** the
contact log (those are our notes about a customer — "sounds genuine, just busy"
is fair to write and indefensible to forward; only the requirement summary, which
a person wrote deliberately for a business to read, crosses over — BE-OD-16), the
score and rank and who else was eligible, and any money. The customer's **phone
number does leave**, and the menu says so on the panel before the press rather
than pretending otherwise: a copied enquiry is personal data that has left the
audited surface for a chat app nobody can revoke it from.

Lifecycle actions stay on the action bar in the open. Only things that change
nothing went into the overflow — a state change behind a three-dot menu is one
nobody expects and nobody audits.

**Temp data**

- `vocabularies.json` → new **static copy**: `sources[]` (with `manual` and
  `help`), `manualVia[]`.
- `enquiries.json` → `source` gains `createdBy` and `via` on every record; one
  record moved to `website`; one new `own` record added by hand.

**Backend needed**

- `POST /business-enquiries` (**BE-T11**) → create by hand. Body: source, via,
  customer, requirement, urgency, text. Server generates the reference and the
  `man-` submission id, stamps `createdBy` from the session, runs the **same**
  duplicate rule as intake and returns matches rather than refusing, sets status
  `generated` with an empty checklist, and owns it to the creator. `403` unless
  the actor holds `business-enquiries.create`.
- `GET /business-enquiries?phone=` → the duplicate lookup the form calls while
  typing. Must be the same rule the intake endpoint applies, or the warning and
  the enforcement disagree.
- `GET /business-enquiries?source=` filter; `source{kind,page,label,createdBy,via}`
  on both list and detail payloads.
- `GET /business-enquiries/{id}/sheet` → **optional**. The printable sheet is
  built client-side today. Quotations gets its document HTML from the server, and
  moving this one there later would put the layout under one owner — but it is
  not blocking, and a client-built sheet cannot leak a field the client does not
  already hold.

**Open decisions**

- `BE-OD-20` — may a manual enquiry ever skip qualification when the creator has
  just had the conversation? Assumed **no**, and the form says so. Reconsider only
  with a named role and an audit event, never as a checkbox.
- `BE-OD-21` — should the duplicate check block, or warn and record? Assumed warn,
  tick and tag. Blocking would push the second enquiry into a notebook, which is
  the outcome the whole feature exists to prevent.
- `BE-OD-16` is now **enforced in code**, not merely asserted:
  `share.ts` is the only export path and it does not read `contactLog`.

**Verified**

`npx tsc -b` clean, `npx eslint` clean, `npx vite build --mode dev` succeeds,
`npm run check:enquiries` passes at 13 enquiries.

The seed check gained provenance assertions and was **negative-tested**: with a
manual record stripped of its author, an unknown source key and an inbound record
claiming a `via`, it fails with exactly those three messages and exits 1.

**Not verified in a browser** — no backend, so `me/permissions/` never resolves.
The print sheet in particular has been written but never rendered: check it at A4
in the browser's print preview before trusting the page breaks.

**One thing corrected on the way past**

The first draft of the CSS put `container-type` on `.md-b`, which is every modal
in the panel — and containment makes an element a containing block for absolutely
positioned descendants, so it could have moved things in Quotations and Invoices.
Scoped to a `.be-fields` wrapper instead. Worth recording because it is the kind
of cross-module regression a module-scoped stylesheet is supposed to make
impossible, and it got in anyway.

---

### Module review — layout defects, ownership, and callback times

**Area:** `#/business-enquiries` and `#/business-enquiries/:id` — whole module
**Files:**
`src/content/business-enquiries/{enquiries,vocabularies}.json`,
`src/admin/views/BusinessEnquiries/{store.ts,List.tsx,Detail.tsx,Qualify.tsx,Suggestions.tsx,bits.tsx,index.tsx,enquiries.css}`,
`scripts/check-enquiry-seed.cjs`

**What changed**

A read-through of the finished module found more than expected, and the two worst
items made the core screens unusable as drawn.

**The panel cut off its own primary action.** `.be-sp` was a plain sticky box with
no height limit. Both panels are taller than a laptop viewport — the qualification
one especially — and a sticky element taller than the viewport stops moving once
its top edge reaches the offset, leaving its bottom permanently below the fold.
That bottom is where **Mark qualified** and the assign actions live. Both panels
are now a flex column with a capped height, a scrolling body (`.be-sp-scroll`) and
a footer that cannot be pushed out of reach.

**Every breakpoint was about 310px wrong.** They were media queries, but this
module renders inside a 248px sidebar plus 64px of page padding, so a 1280px
viewport leaves roughly 968px of content. The record collapsed and the form
squeezed at the wrong widths — and the whole "one screen, one decision" premise
failed on exactly the laptop an operator uses. Both are `@container` queries now,
measured against the element's own width: the pane against the record (980px), the
form against the block it sits in (520px).

**There was no owner.** The flow assumes a team, and nothing recorded who was
working which enquiry — so two qualifiers ring the same customer inside an hour and
the untouched pile is a number nobody is answerable for. Records now carry
`owner`, with **Claim / Take over / Release** and a hand-over select on the record,
an Owner column and filter on the list, and **Mine** and **Unclaimed** cells in the
strip. Unclaimed renders as a state to fix, not as a dash.

**A callback had no time on it.** `callback-due` was a tag and "call back after
4pm" was free text — nothing sorted on it and nothing knew when it lapsed. The
follow-up time is now a required field on any outcome the vocabulary marks
`requiresFollowUp`, lifted onto the record as `followUpAt`, replaced (never
accumulated) by the newest attempt, and cleared at qualification. The list gets a
Callback column, a "callback soonest" sort, and **due** split from **overdue** in
the strip. An overdue callback now outranks a breached SLA in the default sort:
the SLA is a business failing to answer us, an overdue callback is us failing a
customer we personally promised to ring.

Also fixed:

- **A11y** — checklist rows and tag chips are toggle buttons with no state
  exposed. Both carry `aria-pressed` now; tags carry a full `aria-label` rather
  than help text hidden in a `title`. Disclosure buttons carry `aria-expanded`.
- **Tier was decoration with a filter on it** — displayed on every row, filterable,
  sortable, and defined nowhere in the module. The vocabulary defines it now (an
  *intake signal*: what the submission itself told us, not what the customer is
  worth) and the badge carries the definition.
- **`priority`** was on every record and rendered on no screen. Cut.
- **`#fff`** hardcoded in a file whose own header says "no literal colours".
- **The table had eight columns and no `min-width`** — the response column was
  squeezed to one word a line before a scrollbar ever appeared.
- **The strip scrolled horizontally**, hiding Converted and Invalid off the right
  edge. It wraps now.
- **Four bands of chrome** on the record before any content. The lifecycle rail
  shares the tab row — one band back.
- **Acknowledge sat in the Operations action bar** looking like an Operations
  action, with the warning only inside the modal, which arrives after the click.
  Fenced in a labelled dashed group instead.
- **Filters pushed history entries**, so Back walked backwards through filter
  states instead of leaving the list. They replace now.
- **Prev / next through the queue** on the record, with a position count. It steps
  through the *filtered, sorted* list the operator was actually reading, and shows
  no position for a record outside the current filter rather than lying with
  "0 of 9".
- Search placeholder names what it really searches; `AgeCell`'s tooltip prints a
  date instead of a raw ISO string; `line-clamp` beside the prefixed property;
  Ctrl/Cmd+Enter logs a contact without leaving the keyboard.

**Temp data**

- `enquiries.json` → every record gains `owner` (nullable) and `followUpAt`
  (nullable); every contact-log entry gains `followUpAt`; `priority` removed. One
  Generated record carries an **overdue** callback, one is **unclaimed**.
- `vocabularies.json` → `tiers` becomes objects with real definitions;
  `contactOutcomes.callback_requested` gains `requiresFollowUp`; new **`team`**,
  a stand-in for a read of the existing Team module.

**Backend needed**

Additions to the shapes already listed in
[BACKEND-INTEGRATION.md](BACKEND-INTEGRATION.md):

- `PUT /business-enquiries/{id}/owner` (**BE-T10**) → claim, hand over, release.
  Body `{ownerId | null}`, appends `OWNER`. Allowed at any status.
- `POST /business-enquiries/{id}/contacts` gains `followUpAt`, **required** when
  the outcome is marked `requiresFollowUp` → `422 followup_time_required`. It
  replaces the record's `followUpAt` rather than adding to it.
- `GET /business-enquiries` gains `owner` and `flag=followup|overdue` filters,
  `sort=followup`, and must return `owner` and `followUpAt` on the list row.
- The `team` vocabulary is **not ours** — it is a read of the Team module,
  filtered to members holding `business-enquiries` write access.

**Open decisions**

- `BE-OD-18` — should claiming be automatic on first logged contact? Assumed no:
  claiming is deliberate, because an accidental claim is worse than an unclaimed
  enquiry that is visibly unclaimed.
- `BE-OD-19` — may anyone take over an owned enquiry, or only a lead? Assumed
  anyone, with the hand-over recorded as an event.
- `BE-OD-15` (from the previous entry) is now measurable — the overdue count makes
  "how many attempts before Invalid" answerable from data rather than opinion.

**Verified**

`npx tsc -b` clean, `npx eslint` clean across the module and `scripts/`,
`npx vite build --mode dev` succeeds, `npm run check:enquiries` passes.

The seed check was extended to the new invariants and **negative-tested**: with a
stale `followUpAt`, an unknown tier and a non-existent owner injected, it fails
with exactly those three messages and exits 1. That matters more than the pass —
an assertion that has never failed has not been shown to work.

**Still not verified in a browser.** No backend, so `me/permissions/` never
resolves. The container queries and the panel scroll fix are the two things most
worth looking at first with a live session, at 1280×800 and at 1440×900.

**One project rule changed**

`.gitignore` carries a deliberate, commented project-wide `*.json` rule matching
the backend's. It was silently swallowing **every content file this module reads
from** — `git status` did not list them, so the module would have built to an
empty screen for anyone who cloned. Added `!src/content/**/*.json` with a comment
saying why, rather than relying on `git add -f`, which is a rule somebody forgets
exactly once. Flagging it because changing a rule someone set on purpose is not
mine to do quietly — revert the carve-out if the blanket rule matters more, but
then the content convention needs somewhere else to live.

**Deliberately not done**

- **Bulk actions** (multi-select, batch claim, batch tag). Real, and the natural
  partner of ownership once the untouched pile is in the hundreds — but it is
  selection state, a header checkbox, a bulk bar and three more writes, and it is
  better as its own pass than bolted onto this one.
- **Links out to the business and to the funnel page.** There is no business
  module and no funnel module in this panel, so there is nothing to link *to*.
  Inventing a dead link would be worse than the current dead end. It becomes
  trivial the day either route exists.

---

### Qualification workstream — a person qualifies the enquiry, and that is when it freezes

**Area:** `#/business-enquiries` (list) · `#/business-enquiries/:id` while **Generated**
**Files:**
`src/content/business-enquiries/{enquiries,vocabularies}.json`,
`src/admin/views/BusinessEnquiries/{Qualify.tsx,store.ts,Detail.tsx,List.tsx,bits.tsx,enquiries.css}`,
`scripts/check-enquiry-seed.cjs`, `package.json`

**What changed**

**This supersedes the freeze-at-intake decision in the entry below it.** The first cut
of this module had the qualification snapshot frozen automatically at intake and the
enquiry arriving at Ready to Assign with nobody having touched it. That left no room for
the thing the module is actually for. A funnel submission is a **claim**, not a fact:
someone skimming a landing page types "full home interiors" for one room, picks the
nearest city from a dropdown and leaves urgency at the default. Matching on that and then
freezing the result as history is how a business gets handed an enquiry that was never
real, with a snapshot proving we believed it was.

So **Generated is now a worked state**, and the record has a qualification workstream:

- **The record is editable while Generated.** Category, service, city, locality, PIN,
  project type, intent, urgency, and the customer's contact details. The operator on the
  phone is the one who finds out it is a renovation and not a fit-out. Every save appends
  an `UPDATED` event listing the changes field by field — a correction should be visible,
  not silent. After qualification the same block renders read-only.
- **A contact log.** One row per attempt: channel (call · WhatsApp · chat · email · SMS ·
  site visit), direction, outcome (connected · replied · callback requested · no answer ·
  busy · no reply · wrong number · not interested), **what the customer said**, and the
  operator's note. The customer's words and the operator's read are separate fields
  throughout, and only the first is ever given the quote treatment — one is evidence and
  can be repeated to a business, the other is interpretation and cannot.
- **Tags.** `new-enquiry` is applied at intake and removed by the first logged attempt, so
  the untouched pile is a real number. `contact-made`, `callback-due`, `unreachable` and
  `bad-contact` are recomputed from the log on every write, and carry a dotted marker in
  the UI so an operator can see which of their tags the next call will overwrite. Six more
  are set by hand. There is no tag for spend, size or value.
- **A four-item checklist**: contact reachable, requirement confirmed, genuine enquiry,
  urgency confirmed. Each carries the sentence that makes it mean something —
  "confirmed *with* the customer, not just as the form received them".
- **Mark qualified**, which is now **the freeze**. It stamps `qualifiedBy`, `frozenAt` and
  the qualification version, writes the requirement summary, and hands the enquiry to
  matching. It refuses unless all four checks pass **and** at least one contact is logged:
  four ticked boxes on an enquiry nobody rang is a formality, not a record.

Immutability is unchanged — it just starts later, at the point there is something worth
making immutable. `qualification.frozenAt` and `.version` are now nullable, and null means
"nobody has stood behind this yet".

On the list: three new strip cells (**in qualification · untouched · callback due**), a
tag filter, tag chips under each row, and a **Last response** column carrying the
customer's own words. That column is the one that makes the queue readable — category and
city are the same on half the rows, and what the customer said never is.

Also added `npm run check:enquiries`: an executable statement of the invariants the
screens assume, run against the content files. It is the shortest description of what the
API has to guarantee, and it is the only automated verification this module has.

**Temp data**

Placeholder records, extended:

- `enquiries.json` → every record gains `tags[]`, `contactLog[]`,
  `qualification.checklist{}`, `qualification.qualifiedBy/qualifiedByRole`;
  `qualification.version` and `.frozenAt` become nullable. **Three new records in the
  Generated state**: one part-way through qualification with a callback due, one attempted
  twice and never reached, one nobody has touched at all.
- `vocabularies.json` → new **static copy**: `contactChannels`, `contactOutcomes`,
  `qualificationChecklist`, `tags`, `qualificationVersion`. The `generated` status and the
  `generated → qualified` transition guard were rewritten.

**Backend needed**

Four writes, all Generated-only, all refusing once the snapshot is frozen. Full shapes in
[BACKEND-INTEGRATION.md](BACKEND-INTEGRATION.md):

- `PATCH /business-enquiries/{id}` → edit the requirement and contact while Generated
- `POST /business-enquiries/{id}/contacts` → append one contact-log entry, recompute tags
- `PUT /business-enquiries/{id}/checklist` and `PUT /business-enquiries/{id}/tags`
- `POST /business-enquiries/{id}/qualify` → **the freeze**. New refusal:
  `422 qualification_incomplete`

`GET /business-enquiries` grows a `tag` filter and must return `tags[]`, the checklist
progress and the last response on the list row — the queue is unreadable without them, and
they must not need a second request per row.

**Open decisions**

New, and none of them assumed silently:

| ID | Question | Assumed here |
| --- | --- | --- |
| `BE-OD-14` | Who may qualify? Any Operations member, or a named qualifier? | Anyone with write access |
| `BE-OD-15` | How many failed attempts before an enquiry should be closed Invalid? | Not enforced — the panel says three is usually the answer and leaves it to a person |
| `BE-OD-16` | Is the contact log ever visible to the assigned business? | No. Only the requirement summary crosses over |
| `BE-OD-17` | Do calls come from a dialler, or is the log typed by hand? | Typed. A CTI integration would replace the composer, not the log |

`BE-OD-01` (duplicate identity) gets sharper here rather than being answered: a person on
the phone is the one who notices this is the same customer who enquired last week, which is
why `duplicate-suspected` is a hand-set tag and not a computed one.

**Verified**

`npx tsc -b` clean, `npx eslint` clean on every new and changed file, `npx vite build`
succeeds, and `npm run check:enquiries` passes — 12 enquiries, 3 in qualification, with
the freeze rules, the newest-first ordering of both logs, the single-active-assignment
pointer, and the factors-sum-to-score identity all asserted.

**Still not verified in a browser**, for the same reason as the entry below: no backend, so
`me/permissions/` never resolves and the router never reaches a module. The qualification
flow specifically has been checked by reading, not by clicking — the first thing to walk
against a live session is `IB-BE-2026-0063` (untouched) from first call through to Mark
qualified, and `IB-BE-2026-0062` (two failed attempts) to confirm the blocked state reads
the way it should.

---

### Business Enquiries — the module, renamed and built

**Area:** `#/business-enquiries`, `#/business-enquiries/:id`
(`?tab=match|assignment|history`) · sidebar → Client Ops
**Files:**
`src/content/business-enquiries/{enquiries,suggestions,matching-rules,businesses,vocabularies}.json`,
`src/admin/views/BusinessEnquiries/{index.tsx,List.tsx,Detail.tsx,Suggestions.tsx,Modals.tsx,bits.tsx,store.ts,enquiries.css}`,
`src/admin/views/registry.tsx`, `src/admin/shell/modules.ts`,
`src/admin/auth/session.ts`, `tsconfig.app.json`

**What changed**

The panel now has a place to manage enquiries generated by Interior bazzar
funnel pages and the portal enquiry form, and to route each one to exactly one
subscribed business. The module is called **Business Enquiries** — renamed from
"Client Enquiry Management" in the spec, and from "Client Deals" in the
wireframe, on purpose: two records containing the word *deal* is the naming risk
that makes a business's revenue summable with ours, and the new name removes it.

Two screens carry the module. The **list** holds an enquiry for its whole life —
Ready → Assigned → Delivered → Acknowledged → outcome — rather than removing it
on assign the way a routing queue does; assignment is a transition, not a
deletion, which is why State and Assigned-to are columns that keep working
afterwards. The **record** is a page, not a drawer: requirement and qualification
snapshot on the left, the ranked **Business Suggestions** panel on the right,
because a routing decision needs both on screen at once and a drawer over a
table cannot carry that.

The structural decisions worth remembering, all of them enforced in `store.ts`
and stated on the screens that depend on them:

- **Two stages, in that order.** Hard eligibility filters first, weighted
  scoring second. A business that fails a hard rule is absent from the pool
  entirely — no score, however high, puts it back. The excluded half is not
  hidden: every exclusion is stored with the reason that caused it, and reached
  from the panel by a link, not a tooltip.
- **Every rank decomposes.** The score is `Σ(weight × factor_score)` normalised
  0–100, and the breakdown renders from the candidate's own stored factors
  against the rule version's weights. A rank the module cannot explain is a
  defect, not a feature.
- **Frozen at assignment.** Rank, score, the factor snapshot and the rule
  version are *copied* onto the assignment, not referenced. A later profile edit
  or weight change cannot rewrite why an enquiry was routed where it was.
- **One active assignment**, held by a single nullable `activeAssignmentId`
  pointer. Reassignment closes the current row (`supersededAt`) and opens a new
  one; it never deletes.
- **Budget exists nowhere** — not a field in any of the five content files, not
  a filter, not a sort, not a scoring factor, not a column. There is nothing for
  a future feature to reach for.
- **No Create button.** The funnel and the portal are the only intake channels;
  a hand-typed enquiry would have no qualification snapshot, no submission id and
  no duplicate check.

**Writes are simulated in memory, for this browser tab only** — there is no API
for this module yet. Every screen that can write says so in a banner, and a
reload restores the seed. What the simulation honours is listed at the top of
`store.ts`; what it cannot (row locks, concurrency, the 409/422 refusals) is
named in the dialog where each would fire, so the contract stays visible even
though nothing enforces it yet.

**Temp data**

All placeholder records except where noted:

- `enquiries.json` → 9 enquiries covering every lifecycle state, with
  `assignments[]` history, `outcome`, `sla` and an append-only `events[]`.
- `suggestions.json` → one candidate snapshot per matching run, keyed by
  enquiry: `eligible[]` with per-factor scores and per-factor *reasons*, and
  `excluded[]` with the stage and reason each failed on.
- `matching-rules.json` → the active rule version: eligibility rules, the
  30/25/15/10/10/5/5 factor weights, band thresholds, override threshold.
  **Mixed** — the weights are real configuration that will move server-side; the
  factor labels and notes are static copy.
- `businesses.json` → 10 subscribed businesses with categories, service area,
  plan, subscription state and capacity. **This one belongs to another module**
  (Business Profile / Subscription) and is read-only here.
- `vocabularies.json` → statuses, the transition matrix, urgency bands, tiers,
  categories, cities, outcome/invalid/reassign reason lists, and the API error
  contract. **Mixed** — the label text is permanent static copy; the lists
  themselves become server vocabulary.

**Backend needed**

See [BACKEND-INTEGRATION.md](BACKEND-INTEGRATION.md) for the full map with
request shapes. In short: 5 reads, 7 writes, 1 scheduled job, plus a `Module`
row for the key so the module leaves `PROTO_MODULES`.

**Open decisions**

Six are assumed on screen, and every screen that assumes one names it:

| ID | Assumed here | Where it shows |
| --- | --- | --- |
| `BE-OD-04` | Location is a coarse region string | Exclusion reasons, and one candidate's `from.location` says the match is coarse |
| `BE-OD-05` | Capacity is a per-month count | Assign dialog, capacity checks |
| `BE-OD-08` | "Materially lower" = 10 points below rank 1 | `matching-rules.json` → `overrideThreshold`; Assign dialog |
| `BE-OD-09` | Acknowledgement SLA = 24h | `enquiries.json` → `sla.ackHours`; Assignment tab |
| `BE-OD-10` | Outcome reason lists as drafted | `vocabularies.json` → `outcomeReasons` |
| `BE-OD-11` | Full customer contact released on delivery | Record header shows the phone from intake |

Two more are **not** assumed, because assuming them would be a lie: `BE-OD-01`
(duplicate identity rule beyond `submissionId`) and `BE-OD-02` (assignment
cardinality). The schema here is built for one active business per enquiry;
changing that later is a migration, not a setting.

One gap is neither assumed nor solved: **there is no business-user role.** The
whole acknowledge-and-report-outcome half of this module belongs to the client
business, and the permission matrix has no actor for it. The Acknowledge dialog
in this panel exists only so the chain is walkable, and it says in the dialog
that the real system must not offer that button to Operations.

**Verified**

`npx tsc -b` clean, `npx eslint` clean on every new and changed file,
`npx vite build --mode dev` succeeds.

**Not verified in a browser.** The panel will not render any view until
`me/permissions/` resolves, and there is no backend running against this
checkout — `RequireSession` holds on the retry screen before the router reaches
a module. So the layout, the responsive break at 1240px, the dark-theme pass and
the write chain (assign → deliver → acknowledge → outcome, and reassign) have
been reasoned about and typed, but not seen. The first thing to do against a
live `me/permissions/` is walk `IB-BE-2026-0047` end to end and `IB-BE-2026-0044`
through reassignment.
