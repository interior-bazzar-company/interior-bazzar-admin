# Operation · Team Module — wireframe, architecture and implementation plan

```
task:        Design the complete Team Module — members, roles, attendance,
             tasks, milestones, targets, calendar, today's-task and EOD
             reporting, offer letters with signed acceptance, salary slips,
             and a senior performance view — as ONE connected operational
             system. Wireframe and architecture only. No production code
             until this document is approved.

description: The brief reads as greenfield. It is not. `team` and `roles` are
             already live modules in this panel, backed by real endpoints and
             a real permission matrix, with ~1,300 lines of written spec
             behind them in the prototype. What is genuinely new is the
             OPERATIONAL half — attendance, work, reporting, documents — and
             none of it exists anywhere in any of the four repositories. So
             this is one extension and one new build, and the document is
             explicit about which is which on every screen.

operation:   Phase 1 analysed six dimensions of the existing system in
             parallel (backend, admin shell, RBAC, quotation signature flow,
             component inventory, prototype precedent). Phases 2-7 below are
             the design that follows from what was found, decision by
             decision, each with the reason it was chosen. Phase 8 is the
             approval gate.

summary:     Team becomes a top-level sidebar GROUP of five destinations, not
             a Settings item. Identity stays where it is; four new module keys
             carry the operational surfaces. One unified `WorkItem` replaces
             the task/milestone/target split. Attendance is a deliberate work
             clock, NOT the auth session. Offer letters reuse the quotation
             freeze-and-version machinery and add the codebase's first real
             capability token, first signature capture and first VIEWED event.
             Salary slips are uploaded, not generated, in v1.

outcome:     An implementation-ready plan in ten phases with a parallel
             execution map, a regression checklist, 19 open decisions and 9
             risks. NOT code. Approval required before Phase A starts.
```

**Module:** Team · **Date:** 2026-08-30 · **Status:** awaiting approval
**Author's constraint:** Finance (`src/admin/views/Finance/**`, `src/content/finance/**`,
`scripts/*finance*`, `scripts/*fn-smoke*`) is under active edit by another session.
Nothing in this plan touches those paths, and §9.4 records how the shared files are
kept out of each other's way.

---

## 0. The finding that reshapes the brief

**A Team module and a Roles module already exist in this panel, are live against
the API, and are not prototypes.**

| What exists | Where | State |
| --- | --- | --- |
| Members list, filters, stat strip, member drawer | `src/admin/views/Team/index.tsx`, `MemberDrawer.tsx` | live — `AdminOpsService.users()` |
| Add / edit / roles / send-credentials / delete member | `src/admin/views/Team/memberModals.tsx` | live, 5 modals |
| Roles list, role drawer, create / edit / delete role | `src/admin/views/Roles/**` | live — `AdminOpsService.listRoles()` |
| **The permission matrix UI** (module × verb grid, row/column "all", view-gate enforcement) | `src/admin/views/teamShared.tsx:96` `ActionMatrix` | live, canonical |
| `Avatar`, `RoleChips`, `RolePicks`, `readRolePicks`, `readActionMatrix`, `val`, `ErrSlot`, `errOf`, `Ops` | `src/admin/views/teamShared.tsx` | live, shared by both |
| Access-requests tab with a deliberately empty producer | `src/admin/views/Team/AccessRequests.tsx` | scaffolded slot |
| `team` and `roles` registered, iconed, badge-wired | `registry.tsx`, `shell/modules.ts` | live |
| ~1,300 lines of Team spec (`ARM-*` IDs, IA, DFD, defect record) | `ibprototype/admin-panel/team/*.md`, `admin-panel/admin-access/TEAM_OPERATION.md` | the precedent |

`team` is **not** in `PROTO_MODULES` and **not** in `PROTO_ROWS` — it has a real
`Module` row on the deployed server and real permissions today. That is the single
most important operational fact in this document, and it produces the first hard rule:

> **TM-BR-01 · Never add `team` to `PROTO_MODULES`.** Doing so makes `can("team", …)`
> return **true for every signed-in account**, including member CRUD and role
> assignment. The module has server data to leak and server writes to authorise, which
> is precisely the condition under which the escape hatch is documented as unsafe
> (`session.ts:53-56`).

**What does not exist, anywhere:** attendance, shift, break, punch, timesheet, leave,
task, milestone, target, EOD report, calendar, offer letter, salary slip, payroll,
employee document, e-signature, or any public token-authenticated page. Verified by
exhaustive grep across the backend, the admin, the frontend and the prototype. Every
operational surface in the brief is a first-of-its-kind build in this codebase.

**So the brief splits cleanly in two, and the plan follows the split:**

| Half | Surfaces | Nature |
| --- | --- | --- |
| **Identity** — exists | Members, Roles, permission matrix, access requests | **extend**, do not rebuild |
| **Operations** — new | Attendance, Work (tasks/milestones/targets), Calendar, Daily plan + EOD, Performance, Offer letters, Documents & slips | **build**, no precedent |

---

## 1. Phase 1 — the existing project, as measured

### 1.1 Frontend architecture (`interior-bazzar-admin`)

| Concern | Finding |
| --- | --- |
| Stack | React 18 · TS 5.8 · Vite 7 · Tailwind v4 · react-router-dom v7 |
| Routing | **Real router paths**, not hash. `/:route` and `/:route/:id` → `ViewHost` (`registry.tsx:55`). Prototype-style `#/…` strings are converted by `hashToPath()`. |
| Registration | A module is one entry in `VIEWS` (`registry.tsx`) keyed by module key; the shell builds nav from the **server's** module list. |
| Guarding | `ViewHost` denies at `registry.tsx:61` (`can(item.key)`); nav filters at `AdminShell.tsx:318`; buttons are **absent, not disabled**. |
| State | Four approaches. URL params for anything a link must reproduce · `useShell()` for overlays · per-module `store.ts` + `useSyncExternalStore` for frontend-first modules · API + `tick` for server-backed ones. **Redux exists and no admin view reads it.** |
| Styling | ONE global stylesheet `src/styles/admin-theme.css` (~191 KB) plus per-module CSS files. Short class prefixes per module (`dls-`, `dw-`, `md-`, `tm-`, `um-`, `fn-`) — a convention adopted after four documented class collisions. |
| Theme | `data-theme` + `data-density` on `<html>`; every colour is a CSS custom property. Dark is a token swap, not a second palette. |
| Charts | **recharts is a declared dependency that the live panel never imports.** Charts are hand-rolled: `ColumnChart`, `FunnelChart`, `BarRows`, `CohortHeat` in `src/admin/views/charts.tsx` + `charts.css`. |
| Forms | **Uncontrolled by design.** `Field` renders, `val(id)` reads back out of the DOM at submit. No form library, no controlled-input convention. |
| Dead code | `src/components/ui/**`, `src/components/shared/**` (except `ErrorBoundary`/`AdminLoader`/`ServiceDown`), `src/context/**`, `src/hooks/**`, `src/utils/helper/**`, `src/redux/**`, `quill`, `react-quill`, `react-cropper` — **all present, none imported by the admin panel.** Do not build on them. |

### 1.2 Backend architecture (`interior-bazzar-backend`)

| Concern | Finding |
| --- | --- |
| Stack | Django 5.0.2 · DRF 3.14 + **adrf** (async views throughout) · **pydantic v1** validators · SimpleJWT · Postgres (prod) / SQLite (local) · ASGI via uvicorn |
| Layering | `Views/<F>Views.py` (thin, calls `hasAccess()`) → `Controllers/<F>/<F>Controller.py` (logic, returns `LocalResponse`) → `Tasks/<F>Tasks.py` (DB). No DRF serializers for payloads; JSON is hand-built, camelCase. |
| Auth | JWT only, `SessionAwareJWTAuthentication`. **`UserSession` already records login time, device, UA and IP** on every sign-in (`app_ib/models/core.py:100`). |
| Authorization | **Two unmerged systems.** (a) `rbac_module` string permissions via `hasAccess()` — gates ~152 endpoints, auto-registers new ones. (b) `AdminModuleAccess` role × moduleKey × level 0-3 — drives the panel's nav, **not enforced per-endpoint** except for two super-admin checks. |
| Staff model | **There is no staff/employee model.** An admin is a `CustomUser` with `type='admin'`, `is_staff=True`. |
| Audit | `AdminAuditLog` — append-only, `actor/role/action/moduleKey/detail/createdAt`, best-effort writer that swallows its own errors. `detail` is free text, **not a structured diff**. |
| Background work | **No Celery, no queue.** Cron via supercronic every 15 min, plus raw threads. APScheduler and twilio are installed and unused. |
| Files | S3 via **presigned PUT from the browser** (`POST /api/v1/common/get-upload-url/`) with a whitelisted folder list. **No signed read URLs — every uploaded object is publicly readable by URL.** |
| PDF | **No PDF library of any kind.** Quotation PDFs are the browser printing a server-rendered HTML sheet. |
| Public links | **None.** No `<uuid:…>` route, no token field on any model. The one "link grants access" flow is forgot-password, which is an **unsigned base64 blob of `{username, timestamp}`** — forgeable by anyone. **Not a pattern to copy.** |
| Time | `TIME_ZONE='Asia/Kolkata'`, `USE_TZ=True`. A server-clock endpoint already exists: `GET /api/v1/engine/server-time/`, whose docstring says the client must compute skew and never trust `Date`. |
| Repo state | ⚠️ **The checkout on disk is stale.** It stops at migration 0018 and does not contain `interior_deals_billing`, the action-based RBAC (`Module`/`ModuleAction`/`RoleActionAccess`), `gateOk`, or the Deals/Quotations/Invoices endpoints the panel calls every day. Confirm against the deployed backend before any server estimate. |

### 1.3 The quotation module, as actually implemented — not as assumed

Standard 10 required this be inspected rather than assumed. It was, across all four
repositories. The result contradicts the brief's premise:

> **There is no acceptance-by-recipient flow anywhere in this codebase.**

- **No signature capture of any kind** — no canvas, no typed-name-as-signature, no
  library in any `package.json`.
- **No consent checkbox, no "type your name" field, no public accept endpoint.**
- **No VIEWED event.** The quotation's `viewed` status is set by a *seller* claiming it.
- "Accept" means **an operator ticking "Mark accepted"** on behalf of a customer who
  said yes by phone. The function's parameter is literally `actor` — an operator.
- The share link is a **read-only document server**: `POST …/document/share/` returns
  `{storageKey, link, expires}`, the link is `https://<django-origin>/q/<token>`
  mounted outside `/api`, default expiry 7 days, re-mintable, **not revocable**.
- The prototype's token is `checksum_sha256.slice(0,24)` — **derived from the document,
  therefore stable across mints and unrevocable**. It is a stub, and the project's own
  spec flags it as open item `QT-OD-13`: *"customer access must use a signed expiring
  link or an authorised session… it is not reversible once links are in customers' hands."*

**What is genuinely excellent and must be reused:** the **freeze-on-issue**
architecture. Issue → lock the number → snapshot the counterparty → generate the
artefact with a SHA-256 → append an event → enqueue the outbox, in one transaction.
There is no PUT and no DELETE on an issued document — *"the absence of the endpoint is
the enforcement, not a flag."* Plus revise-then-supersede ordering (the parent is
superseded only **after** the replacement issues), `rowVersion` optimistic concurrency,
and the invoice's **versioned artefact** model (`InvoiceDocumentVersion`), which is the
better parent for a re-issuable offer letter than the quotation's single document.

### 1.4 What can be reused, and what must be built

**REUSE — as-is, no changes.**

`usePageChrome` · `useNav` · `can`/`grantsOf`/`currentActor` · `getModules` ·
`ViewHost` · `useShell()` (`drawer`, `modal`, `openPop`, `toast`, `banner`,
`closeLayer`, `LS`) · `Ops` · `Table` · `StatStrip`/`StatCell` · `Tile`/`Tiles` ·
`EmptyState` · `ListSkeleton` · `PaneLoading` · `Notice` · `SectionHead` · `KvList` ·
`Tabs` · `Toolbar` · `SearchField` · `Select` · `FilterSelect` · `FilterChips` ·
`FacetPicker`+`Chips` · `InfoTip` · `Pill` · `Icon`/`ICONS` (`team`, `shield`, `history`,
`check`, `lock` all present) · `Completeness` · `Field` · `val` · `Avatar` ·
`RoleChips` · `ActionMatrix`/`readActionMatrix` · `RolePicks`/`readRolePicks` ·
`ErrSlot`/`errOf` · `Frame`/`ViewBand`/`Block`/`Blocks` · `ColumnChart`/`FunnelChart`/
`BarRows`/`CohortHeat` · `inr`/`inrWords`/`fmtDate` · `initials`/`avatarTone`/`qs` ·
`copyToClipboard`/`shareOrCopy`/`publicDocUrl`/`printHtml`/`ShareLine` ·
`buildCsv`/`downloadCsv`/`fileNameFor`/`scopeSentence` + `ExportModal` as the template ·
`DocPage` (server-rendered sheet in a sandboxed iframe) · the `.dls`/`.card`/`.dw-`/
`.md-`/`.pop-` class contracts.

**BUILD — genuinely absent.**

| # | Missing | Needed for |
| --- | --- | --- |
| 1 | Day-grid month calendar, week view, day timeline | Calendar |
| 2 | Time input (`type="time"` appears zero times panel-wide) | Attendance, task times |
| 3 | Duration display/entry (`7h 12m`) | Attendance |
| 4 | Live-ticking clock component | Attendance |
| 5 | Signature capture (typed + drawn) | Offer letter |
| 6 | Public, un-authenticated page shell | Offer letter |
| 7 | Capability token: random, hashed at rest, expiring, revocable, single-use-on-accept | Offer letter, slip download |
| 8 | Toggle/switch control | settings rows |
| 9 | Sortable column headers; row selection + bulk actions | Members, Work |
| 10 | Generic `ConfirmModal` (eight near-duplicates exist today) | everywhere |
| 11 | Progress ring / radial meter | Targets |
| 12 | Stepper/wizard | Add member |
| 13 | Shared relative-time helpers (`ago`, `fmtDateTime`, `delta` live in `Users/store.ts`) | everywhere |
| 14 | Reusable pagination component (`paginate()` exists; markup is inline in one file) | all lists |
| 15 | Server-side PDF, if a slip must be generated rather than uploaded | Salary slip (deferred — see TM-AD-11) |

---

## 2. Architecture decisions

Every decision carries its reason (Standard 15). IDs are referenced from the screens
and the implementation phases.

**TM-AD-01 · Team becomes a top-level sidebar GROUP, not a Settings item.**
The panel's own IA rule (`ADMIN_PANEL_IA.md` G-04) is that Settings holds *"staff and
configuration, touched rarely"* and that daily operational work belongs top-level in its
own group — the rule under which `Users` was moved out of Settings. Attendance, today's
tasks and EOD reports are the most-visited screens in the panel once they exist. The
same rule set says a group of one is a heading tax (G-01/G-03); a group of five is not.
`GROUP_ORDER` in `shell/modules.ts:89` gains `"Team"` after `"Business Ops"`.

**TM-AD-02 · Identity and operations are separate module keys.**
Five keys, not one: `team` (identity, exists) · `roles` (exists) · `attendance` (new) ·
`work` (new) · `people-docs` (new). *Reason:* a team lead who may see who is working
today must not thereby see salary slips and offer letters; a permission matrix in which
one tick grants both is not a permission system. It also keeps `team`'s existing verb
set stable, so no live grant changes meaning underneath anybody.

**TM-AD-03 · Attendance is a deliberate work clock, NOT the auth session.**
`UserSession.createdAt` already records every login with device, UA and IP — and it is
the wrong thing. A person checking one number at 23:40 has logged in; they have not
started a shift. A person working all day on two devices has three sessions. A token
refresh advances `lastActiveAt` whether or not anyone is at the keyboard. So attendance
is its own record, opened by an explicit **Start day** and closed by **End day**.
*But the session data is used as evidence:* the first login of the business day
pre-fills the suggested start time and is shown beside a manual entry, so a forgotten
clock-in is corrected against a fact rather than a memory. (Corollary: `LogoutUser` in
`AuthTasks.py` is currently a no-op that never writes `revokedAt` — a two-line backend
fix that this module wants, but does not depend on.)

**TM-AD-04 · The server owns the clock, always.**
Every attendance timestamp is stamped server-side. The client renders elapsed time from
`GET /engine/server-time/` skew, exactly as that endpoint's docstring already
prescribes. *Reason:* a work clock a user can change by changing their laptop's date is
not a record of anything. The one existing precedent for client-stamped time in this
codebase — the naive `datetime.now()` inside `LeadQuery.save()`'s log appender — is a
known inconsistency, not a pattern.

**TM-AD-05 · The business day is an IST calendar date, stored as a `DateField`.**
Every daily record (attendance, daily plan, EOD report) carries `businessDate`, derived
server-side from the Asia/Kolkata calendar date at the moment of the write, alongside
the UTC instant. *Reason:* "today's tasks" and "did they submit an EOD" are questions
about a **day**, not about a 24-hour window; deriving the day on the client produces two
answers either side of midnight and one of them is wrong. Precedent:
`BusinessAnalytics(date, …)` already does this.

**TM-AD-06 · Tasks, milestones and targets are ONE entity: `WorkItem`, discriminated by `kind`.**
The brief's own words — *"avoid making tasks and milestones feel like separate
disconnected systems."* Three tables produce three lists, three status vocabularies,
three calendar feeds and three places to look for "what is this person doing". One table
with `kind: task | milestone | target` produces one calendar, one status vocabulary, one
permission surface, and a parent link (`parentId`) that lets a task roll up into a
milestone and a milestone into a target **without a join table**. *Reason:* the
relationship between these three is containment, and containment is a self-reference.

**TM-AD-07 · One status vocabulary for all work, mapped onto existing tones. No new colours.**
`planned` · `in_progress` · `completed` · `delayed` · `blocked` · `cancelled`, mapped to
the panel's existing six tones — neutral · `info` · `ok` · `warn` · `bad` · `dead`
(inset + line-through, the panel's existing "cancelled" treatment). *Reason:* Standard
11 and the brief both said not to finalise colours before checking the design system;
the design system has exactly six semantic tones plus an 11-colour `tag-*` palette
reserved for user-defined tags, and every module in the panel already reads in those
terms. `delayed` is derived, never stored (see TM-BR-04).

**TM-AD-08 · `delayed` is derived at read time, never written.**
A stored `delayed` needs a sweep job to set it, and this backend has no queue — only a
15-minute cron. A derived one is correct the instant it is read. *Reason:* the same
reasoning the Business Enquiries module applied when it withdrew its SLA sweep: a job
that quietly stops running leaves a screen confidently showing stale truth.

**TM-AD-09 · Today's Plan and the EOD Report are two records of the same day, not two systems.**
`DailyPlan(member, businessDate)` and `DailyReport(member, businessDate)`, one each per
member per day, unique-constrained. The plan's line items **create or link `WorkItem`s**;
the EOD report's completed list **references those same items**. *Reason:* the brief asks
for the two forms to be fast and for the answers to connect. If EOD re-typed the day's
work as free text, "what did they say they'd do vs what they did" would need a human to
compare two paragraphs. Referencing the same items makes it a diff.

**TM-AD-10 · Offer letters fork the invoice's versioned-artefact model, not the quotation's.**
`OfferLetter` + `OfferLetterVersion` (each version carrying `storageKey`,
`checksumSha256`, `generatedAt`), plus a separate `OfferAcceptance` evidence row.
*Reason:* an offer letter that is revised after a salary negotiation must keep the
superseded version — the quotation's single-document model would overwrite it, and the
invoice module already solved exactly this with `InvoiceDocumentVersion`. Issue/freeze,
revise-then-supersede ordering, `rowVersion` and the append-only event log are reused
verbatim from the quotation engine.

**TM-AD-11 · Salary slips are UPLOADED in v1, not generated.**
Finance owns money. There is no payroll engine, no PDF library on the server, and the
Finance module is being redesigned right now around salary accounts by another session.
v1 stores an uploaded slip per member per month and serves it over an expiring
capability link. *Reason:* generating a slip means owning gross/deductions/tax, which is
a payroll product, not a screen. Building the delivery half first is useful on day one
and does not foreclose generation later. **This is the largest deliberate scope
reduction in the plan and needs explicit approval (TM-OD-14).**

**TM-AD-12 · The acceptance link is a real capability token — the first in this codebase.**
Random `secrets.token_urlsafe(32)`, **stored hashed** (SHA-256) in its own indexed
column, with `expiresAt`, `viewedAt`, `acceptedAt`, `revokedAt`, and per-token +
per-IP rate limits. *Reason:* the two available precedents are both unsafe — the
forgot-password blob is unsigned and forgeable, and the quotation share token is derived
from the document so it can never be rotated or revoked. Getting this wrong on a
quotation discloses a price. Getting it wrong on an offer letter discloses a salary and
lets someone forge an acceptance.

**TM-AD-13 · The evidence bundle is the acceptance, not the status flag.**
On accept, store: typed name, signature kind (`typed`|`drawn`), signature object key,
`acceptedAt` (a **DateTime**, not the prototype's date-only `todayISO()`), IP, user
agent, the **consent text snapshot**, the consent version, and the **document checksum
at the moment of acceptance**. *Reason:* the existing "acceptance" in this codebase is
an operator ticking a box, with zero counterparty evidence. An offer letter that cannot
answer "what exactly did they agree to, and how do we know" is decoration.

**TM-AD-14 · New surfaces are frontend-first, using the established JSON seed convention.**
`src/content/team/*.json`, one file per endpoint-shaped payload, `$comment` naming the
endpoint, consumed only by a per-module `store.ts`. *Reason:* it is this repo's
documented convention and it is why the Users and Finance modules could be designed
against the real screens before their APIs existed. **With one caveat that is a risk,
not a design (TM-R-03):** the `PROTO_MODULES` stand-in that makes the nav item reachable
grants the key to **everyone**. It is safe only while the module has no server data and
no server writes — true for `attendance`/`work`/`people-docs` on day one, false the
moment their endpoints land, at which point the key comes out **in the same commit**.

**TM-AD-15 · All new CSS goes in `src/admin/views/Team/team.css` with the `tm-` prefix.**
Nothing is added to `admin-theme.css`. *Reason:* two — (a) that file is 191 KB and shared
by every module, and the project has already logged four class collisions and one
silent-styling bug caused by an unprefixed class; (b) another session is editing Finance
right now, and `admin-theme.css` is the single likeliest merge conflict in the repo.
`tm-` is already Team's prefix (`tm-matrix`, `tm-all`, `tm-cell`).

**TM-AD-16 · No view branches on a role name. Ever.**
Stated twice in the existing code (`AdminShell.tsx:39-40`, `teamShared.tsx:21-23`) and in
the prototype spec as `ARM-BR-04`. "Senior" is not a role name — it is whoever holds
`work.review`. *Reason:* `currentActor()` deliberately returns `role: null` for a named
non-full-access role precisely so that name-branching fails closed.

---

## 3. Phase 2 — the wireframes

Rendering conventions below: `[ ]` button · `( )` chip/pill · `▸` disclosure ·
`▓` filled bar · `·` separator. Every screen is 1280px unless noted.

### 3.1 Navigation

```
SIDEBAR                                       ┌─ existing groups unchanged ─┐
┌──────────────────────────┐                  │ Sales · Client Ops ·        │
│ ◈ Interior Bazzar        │                  │ Business Ops · Finance ·    │
│ ⌕ Search            ⌘K   │                  │ Catalogue · Settings        │
├──────────────────────────┤                  └─────────────────────────────┘
│ ▸ Overview               │
│                          │   TEAM — the new group. Sits after Business Ops,
│  SALES                   │   before Finance. Group header shows the SUM of its
│   Deals              (3) │   children's badges, as every group already does.
│   Quotations             │
│   Invoices               │   Badge meanings (a badge counts only what needs
│                          │   a human — the panel's existing rule):
│  CLIENT OPS              │     Members    → members with no role
│   Business enquiries (7) │     Attendance → today's unclosed / late
│   Users                  │     Work       → items assigned to me, overdue
│                          │     Reports    → members with no EOD after cutoff
│  BUSINESS OPS            │
│   Users management       │
│                          │
│  TEAM                (4) │  ← new group
│   ◐ Members              │     icon: team      key: team          EXISTS
│   ◑ Attendance       (2) │     icon: clock*    key: attendance    NEW
│   ◒ Work                 │     icon: check     key: work          NEW
│   ◓ Reports          (2) │     icon: doc       key: work          NEW (same key)
│   ◔ Roles                │     icon: shield    key: roles         EXISTS
│                          │
│  FINANCE …               │   * `clock` is not in ICONS today — one new inline
│  SETTINGS                │     SVG path is added to `src/admin/ui/index.tsx`.
│   Audit log              │     `Roles` and `Audit log` LEAVE / STAY per TM-AD-01:
│   Design system          │     Roles moves into Team, Audit log stays in Settings.
└──────────────────────────┘
```

Active state, icons, collapse behaviour and the `[` shortcut are the shell's and
need no work. Breadcrumbs come from `usePageChrome({crumbs, parent})`; every detail
route declares its `parent` so Back returns to the **filtered** list, which is the
existing contract.

**Admin vs member navigation.** The same sidebar, filtered by `can()` — there is no
second shell. A member holding only `attendance.view` and `work.view` sees:

```
│  TEAM                    │     … and lands on /team/me, because that is the
│   ◑ My day               │     only Team destination their grants reach.
│   ◒ My work              │     The label differs (§4.3): the route is the same,
└──────────────────────────┘     the scope is the viewer's own record.
```

### 3.2 Members — `/team`

Extends the existing screen. **Bold = new.**

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ Members                                          Team · 24 members · 3 no role │  ← topbar (exists)
├────────────────────────────────────────────────────────────────────────────────┤
│ [Members] [Attendance today] [Access requests (2)]                             │  ← Tabs (exists, +1 new)
├────────────────────────────────────────────────────────────────────────────────┤
│ ⌕ Search name, email, username   [Role ▾] [Status ▾] [Designation ▾]  [+ Add]  │  ← dls-cmd (exists)
├────────────────────────────────────────────────────────────────────────────────┤
│ 24 members │ ● 21 active · 1 inactive · ● 2 suspended │ ⚠ 3 no role │ 6 roles → │  ← StatStrip (exists)
├────────────────────────────────────────────────────────────────────────────────┤
│ ( role: Finance ×) ( status: active ×)                            Clear all     │
├─┬──────────────────┬─────────────┬──────────┬─────────┬──────────┬─────────────┤
│ │ MEMBER           │ DESIGNATION │ ROLE     │ STATUS  │ **TODAY**│ LAST SIGN-IN│
├─┼──────────────────┼─────────────┼──────────┼─────────┼──────────┼─────────────┤
│▌│ ◍ Meera Nair     │ Ops Lead    │ (Ops)    │ ●active │ **●9:04**│ 2 hours ago │
│ │   meera · m@ib   │             │ (Finance)│         │ **work'g**│            │
│▌│ ◍ Arjun Sharma   │ Sales Exec  │ (Sales)  │ ●active │ **●9:47**│ 3 hours ago │
│ │   arjun · a@ib   │             │          │         │ **⚠ late**│            │
│▌│ ◍ Divya Kapoor   │ Designer    │ ⚠ no role│ ●active │ **— not**│ never       │
│ │   divya · d@ib   │             │          │         │ **in**   │             │
└─┴──────────────────┴─────────────┴──────────┴─────────┴──────────┴─────────────┘
                          ‹ Prev   1–12 of 24   Next ›
```

`TODAY` renders only when the viewer holds `attendance.view`; without it the column is
absent, not blank. The rail (`▌`) already carries urgency: `u-warn` for active-with-no-role,
`u-bad` for locked — **new:** `u-warn` also for late-and-unclosed.

**Member drawer** — the existing five sections, plus two:

```
┌─ MEMBER ─────────────────────────────────────────────┐
│ ◍  Meera Nair            ●active  (Full access) (You)│
├──────────────────────────────────────────────────────┤
│ PROFILE      name · designation · email · phone      │  exists
│ **EMPLOYMENT** joined · type · reports to · location │  NEW
│ ACCESS       username · status · roles               │  exists
│ EFFECTIVE ACCESS   resolved union, one line/module   │  exists
│ **TODAY**    ●working since 9:04 · 1 break · 6h 12m  │  NEW
│ **THIS WEEK** ▓▓▓▓▓░ 4 of 5 days · 2 late            │  NEW
│ **WORK**     3 open · 1 overdue · milestone 60%      │  NEW
│ **DOCUMENTS** offer letter ●accepted · 6 slips       │  NEW
│ ACTIVITY     last sign-in · added · failed attempts  │  exists
│ SECURITY     notice: password is not readable        │  exists
├──────────────────────────────────────────────────────┤
│ [Edit member] [Roles] [Send new password]   [Deactivate] │
│ **[Open dashboard →]**  ← full record page, /team/:id     │
└──────────────────────────────────────────────────────┘
```

The drawer stays a **summary**; the dashboard (§3.4) is the record. *Reason:* the
existing drawer-is-the-record pattern works for identity, and would not survive six more
sections of operational data.

### 3.3 Add member — the flow

A **wizard in one modal**, four steps, because the existing single-modal add form cannot
carry employment, documents and an offer letter without becoming a wall.

```
┌─ ADD MEMBER ──────────────────────────────── 1 · 2 · 3 · 4 ─┐
│ STEP 1 — Identity                                            │
│  Full name*            Designation*                          │
│  Email*                Phone*                                │
│  Username*  (auto-suggested from name, deduped, live check)  │
│  ⓘ Designation is what they do. Role is what they may open.  │
├──────────────────────────────────────────────────────────────┤
│ STEP 2 — Employment                                          │
│  Joining date*         Employment type* (full/part/contract/ │
│  Reports to  [member▾]                    intern)            │
│  Work location (office/remote/hybrid)                        │
│  Expected hours/day [8]   Day starts at [09:30] ← late rule  │
├──────────────────────────────────────────────────────────────┤
│ STEP 3 — Access                                              │
│  ☐ Sales Agent   ☐ Finance   ☐ Ops Manager  …                │
│  ⓘ A member with no role can sign in and do nothing.         │
│  ▸ Effective access preview  (read-only ActionMatrix)        │
├──────────────────────────────────────────────────────────────┤
│ STEP 4 — Offer letter                     ○ skip for now     │
│  ● Create offer letter                                       │
│    Template [Standard ▾]  CTC [₹ ______]  Start date [___]   │
│    Valid until [___]   Reporting to [Meera Nair]             │
│    [Preview]  → opens the sheet, read-only                   │
├──────────────────────────────────────────────────────────────┤
│                     Cancel   ‹ Back   [Create member ▸]      │
└──────────────────────────────────────────────────────────────┘
        ↓ on success — the ONE place a password is ever shown
┌─ CREDENTIALS ────────────────────────────────────────────────┐
│ Username  meera        Email  m@ib.com    Password  ●●●●●●●● │
│ [Copy credentials]                                           │
│ ⚠ This is the only time this password is shown.              │
│ Offer letter: ●draft — [Send offer letter →]                 │
└──────────────────────────────────────────────────────────────┘
```

Steps 1 and 3 are the existing `MemberNewModal` re-laid-out; 2 and 4 are new. Step 4 is
**skippable** — creating a member and creating an offer letter are separate decisions,
and forcing them together means a contractor with no letter cannot be added.

### 3.4 Individual member dashboard — `/team/:id` (admin) and `/team/me` (member)

**One component, two scopes.** Not two screens. *Reason:* two screens drift; the second
one silently keeps showing a field the first one stopped showing.

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ ‹ Members  ·  Meera Nair                    ●working · 6h 12m · 1 break        │
├────────────────────────────────────────────────────────────────────────────────┤
│ [Overview] [Attendance] [Work] [Reports] [Documents]                           │
├────────────────────────────────────────────────────────────────────────────────┤
│ OVERVIEW                                                                       │
│ ┌──────────┬──────────┬──────────┬──────────┐                                 │
│ │ TODAY    │ THIS WEEK│ WORK     │ TARGET   │   ← Tiles (exists)              │
│ │ ● working│ 4/5 days │ 3 open   │ 62%      │                                 │
│ │ 6h 12m   │ 2 late   │ 1 overdue│ ▓▓▓▓▓▓░░ │                                 │
│ └──────────┴──────────┴──────────┴──────────┘                                 │
│                                                                                │
│ ┌─ TODAY'S PLAN ───────────────────┐ ┌─ EOD REPORT ────────────────────┐      │
│ │ submitted 9:12                   │ │ ⚠ not submitted                 │      │
│ │ ● Finish enquiry triage   HIGH   │ │                                 │      │
│ │ ● Call 3 leads            MED    │ │ [Submit EOD report] (own only)  │      │
│ │ ○ Draft Q3 plan           LOW    │ │                                 │      │
│ │ Blockers: waiting on pricing     │ └─────────────────────────────────┘      │
│ └──────────────────────────────────┘                                          │
│                                                                                │
│ ┌─ THIS WEEK ──────────────────────────────────────────────────────────┐      │
│ │ Mon ▓▓▓▓▓▓▓▓ 8h02  Tue ▓▓▓▓▓▓▓ 7h40 ⚠late  Wed ▓▓▓▓▓▓▓▓ 8h11        │      │
│ │ Thu ▓▓▓▓▓▓▓▓ 8h00  Fri ▓▓▓▓▓░ 6h12 (open)  Sat —  Sun —              │      │
│ └──────────────────────────────────────────────────────────────────────┘      │
│                                                                                │
│ ┌─ MILESTONES & TARGETS ───────────────────────────────────────────────┐      │
│ │ ◆ Q3 enquiry response time     ▓▓▓▓▓▓░░░░  60%   due 30 Sep  ●on track│     │
│ │ ◆ Onboard 12 businesses        ▓▓▓▓▓▓▓▓░░  80%   due 15 Sep  ●on track│     │
│ │ ◇ Close 40 deals (target)      ▓▓▓▓░░░░░░  38%   Q3          ⚠ behind │     │
│ └──────────────────────────────────────────────────────────────────────┘      │
└────────────────────────────────────────────────────────────────────────────────┘
```

**What differs by scope — the whole difference, in one table.**

| Section | Member (own) | Senior (`work.review`) | Admin (`team.edit` + `people-docs.view`) |
| --- | --- | --- | --- |
| Profile | read | read | read + **edit** |
| Employment | read | read | read + **edit** |
| Access / roles | **hidden** | read | read + **assign** |
| Today · attendance | read + **clock actions** | read | read + **correct entry** |
| Attendance history | read (own) | read | read + correct |
| Work items | read + **update status** | read + **assign**, **comment** | full |
| Milestones / targets | read + update progress | read + **create/assign** | full |
| Daily plan | **write (own, today)** | read | read |
| EOD report | **write (own, today)** | read + **acknowledge** | read |
| Salary slips | **own only, download** | **hidden** | read + upload |
| Offer letter | **own only, read** | **hidden** | full |
| Audit / activity | hidden | read | read |

**Salary slips and offer letters are hidden from a senior by default.** A reporting
line does not imply access to somebody's pay. It is a `people-docs` grant, held by
whoever the business decides — usually two people.

### 3.5 Attendance — `/attendance`

**The member's own clock** is a persistent strip in the shell topbar, not a page. It
must be reachable in one click from wherever they are.

```
TOPBAR (member holding attendance.view)
┌──────────────────────────────────────────────────────────────────────────┐
│ Deals ›                            ● Working 6h 12m  [Break] [End day] ◍ │
└──────────────────────────────────────────────────────────────────────────┘
   states:  ○ Not started   [Start day]
            ● Working  6h12m         [Break] [End day]
            ◐ On break 12m           [Resume]              ← elapsed keeps ticking
            ◌ Day ended 8h02m · 42m break                  ← no actions
```

**The admin day view** — one row per member, the day at a glance:

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ Attendance                                       Fri 30 Aug 2026 · 21 of 24 in │
├────────────────────────────────────────────────────────────────────────────────┤
│ [Today] [History]                     ‹ 30 Aug 2026 ›  [Export CSV]            │
├────────────────────────────────────────────────────────────────────────────────┤
│ 21 present │ ● 18 working · ◐ 3 on break │ ⚠ 4 late │ ● 3 absent │ 2 open past 8pm│
├────────────────────────────────────────────────────────────────────────────────┤
│ ( late ×)                                                          Clear all   │
├─┬────────────────┬────────┬────────┬───────┬────────┬──────────────────────────┤
│ │ MEMBER         │ IN     │ OUT    │ BREAK │ WORKED │ TIMELINE 8 ── 12 ── 4 ── 8│
├─┼────────────────┼────────┼────────┼───────┼────────┼──────────────────────────┤
│▌│ ◍ Meera Nair   │ 9:04   │ —      │ 12m   │ 6h12m  │  ░▓▓▓▓▓▒▓▓▓▓░░░░         │
│▌│ ◍ Arjun Sharma │ 9:47 ⚠ │ —      │ 45m   │ 5h29m  │  ░░▓▓▓▒▒▒▓▓▓░░░░         │
│ │ ◍ Divya Kapoor │ —      │ —      │ —     │ —      │  ░░░░░░░░░░░░░░  absent  │
│▌│ ◍ Sanjay Rao   │ 9:12   │ 18:14  │ 32m   │ 8h30m  │  ░▓▓▓▓▓▒▓▓▓▓▓▓░  ✓       │
└─┴────────────────┴────────┴────────┴───────┴────────┴──────────────────────────┘
     ▓ worked   ▒ break   ░ outside hours        row click → member dashboard
```

**States, and what each looks like** (the brief asked for this explicitly):

| State | Dot | Tone | Meaning | Written or derived |
| --- | --- | --- | --- | --- |
| Not started | `○` | idle | no session today, day not over | derived |
| Working | `●` | ok | open session, not on break | stored |
| On break | `◐` | info | open break inside an open session | stored |
| Day ended | `◌` | neutral | session closed | stored |
| Late | `⚠` badge | warn | first `in` later than the member's `dayStartsAt` + grace | **derived** |
| Absent | `●` | bad | no session and the business day has ended | **derived** |
| Unclosed | `⚠` badge | warn | open past `autoCloseAt` | **derived** |

Late and Absent are derived from the member's own configured start time and the server
clock (TM-AD-04, TM-AD-08). Nothing sweeps.

**History** is the same table with a `DateRange` (the existing `Users/DateRange.tsx`
month-grid component, reused as-is) and per-member roll-ups: days present, days late,
average in-time, total worked, total break.

### 3.6 Work — `/work`

Three faces over **one** entity (TM-AD-06), switched by the existing `ViewBand`:

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ [ ▤ Board ]  [ ☰ List ]  [ ▦ Calendar ]                                       │
├────────────────────────────────────────────────────────────────────────────────┤
│ ⌕ Search  [Member ▾] [Kind ▾] [Status ▾] [Priority ▾] [Due ▾]   [+ New item]   │
├────────────────────────────────────────────────────────────────────────────────┤
│ 34 items │ ● 12 in progress · 8 planned │ ⚠ 5 delayed │ ● 2 blocked │ 7 done   │
├────────────────────────────────────────────────────────────────────────────────┤
│  BOARD — columns are the status vocabulary, one card per item                  │
│  ┌─PLANNED──┐ ┌─IN PROGRESS─┐ ┌─BLOCKED──┐ ┌─COMPLETED─┐                       │
│  │ ▸ Triage │ │ ▸ Call leads│ │ ▸ Pricing│ │ ▸ Q3 draft│                       │
│  │   ◍ Meera│ │   ◍ Arjun   │ │   ◍ Meera│ │   ◍ Sanjay│                       │
│  │   HIGH   │ │   MED ⚠ 2d  │ │   waiting│ │   ✓ 29 Aug│                       │
│  │   ◆ Q3   │ │   ◆ Q3      │ │   on fin │ │           │                       │
│  └──────────┘ └─────────────┘ └──────────┘ └───────────┘                       │
│    ◆ = rolls up to a milestone. Click the ◆ to filter the board to it.         │
└────────────────────────────────────────────────────────────────────────────────┘
```

**The item drawer** — one shape for all three kinds; fields appear by `kind`:

```
┌─ WORK ITEM ──────────────────────────────────────────┐
│ ▸ Finish enquiry triage        ●in progress   HIGH   │
├──────────────────────────────────────────────────────┤
│ Kind          task                                   │
│ Assigned to   ◍ Meera Nair                           │
│ Rolls up to   ◆ Q3 enquiry response time      → open │
│ Due           31 Aug 2026   (2 days)                 │
│ Expected outcome  All Aug enquiries triaged          │
│ Description   …                                      │
│ Progress      ▓▓▓▓▓▓░░░░ 60%      ← milestone/target │
│ Notes         …                                      │
├──────────────────────────────────────────────────────┤
│ ACTIVITY  created · assigned · status × 3 · comment  │
├──────────────────────────────────────────────────────┤
│ [Start] [Complete] [Block…]      [Edit] [Cancel…]    │
└──────────────────────────────────────────────────────┘
```

`Block` and `Cancel` open a reason modal — the panel's existing pattern for every
destructive or explanatory transition. **A blocked item must name its blocker**: free
text, and optionally another work item.

### 3.7 Calendar — `/work?face=calendar`

Google Calendar is UX **inspiration only** (Standard 11). What is taken: the month grid,
the coloured chip per item, click-a-day-to-create, and keyboard month paging. What is
**not** taken: overlapping-event layout, all-day vs timed lanes, multi-calendar overlays,
recurrence rules, invitations, or drag-to-resize.

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ ‹ August 2026 ›   [Month] [Week]        [Member ▾] [Kind ▾]      [+ New item]  │
├────────┬────────┬────────┬────────┬────────┬────────┬──────────────────────────┤
│  MON   │  TUE   │  WED   │  THU   │  FRI   │  SAT   │  SUN                     │
├────────┼────────┼────────┼────────┼────────┼────────┼──────────────────────────┤
│  24    │  25    │  26    │  27    │  28    │  29    │  30                      │
│ ●Triage│ ●Calls │ ◆Q3 60%│ ●Draft │ ●Triage│        │                          │
│ ●Review│ ⚠Late  │        │ ●Calls │ ⚠Block │        │                          │
│ +2 more│        │        │        │        │        │                          │
├────────┼────────┼────────┼────────┼────────┼────────┼──────────────────────────┤
│  31    │   1    │   2    │   3    │   4    │   5    │   6                      │
│ ◆Q3 due│        │        │        │        │        │                          │
│ TODAY  │        │        │        │        │        │                          │
└────────┴────────┴────────┴────────┴────────┴────────┴──────────────────────────┘
   chip tone = status (TM-AD-07)   ◆ = milestone/target   ⚠ = delayed or blocked
   click a day → new item, that date prefilled   ·   click a chip → item drawer
```

**Week view** is the same grid with seven columns and rows by item, **not** an hour
gutter. *Reason:* nothing in this module has a start and end time except attendance,
which has its own timeline strip. An hour grid would be mostly empty, and building one
is the single largest piece of net-new UI in the plan for the least return.

**Drag and drop: recommended OUT of v1** (TM-OD-08). Reschedule is a date field in the
drawer. A drag that silently reassigns a due date without a reason is a change nobody
can explain later, and the accessible keyboard equivalent has to be built anyway.

### 3.8 Today's tasks — `/reports?face=plan`

Fast. The whole point.

```
┌─ WHAT AM I DOING TODAY? ───────────── Fri 30 Aug 2026 ──┐
│                                                          │
│  1  [ Finish enquiry triage_______________ ] [HIGH ▾] ×  │
│  2  [ Call 3 leads from Tuesday___________ ] [MED  ▾] ×  │
│  3  [ ________________________________ ]    [MED  ▾]     │
│     + add a line                                         │
│                                                          │
│  Expected outcome (optional)                             │
│  [ All August enquiries triaged and assigned__________ ] │
│                                                          │
│  Anything blocking you? (optional)                       │
│  [ Waiting on pricing sign-off from Finance___________ ] │
│                                                          │
│  ⓘ Each line becomes a work item due today. Editable     │
│    until you submit; after that, update the items.       │
│                                                          │
│                            [Save draft]  [Submit plan ▸] │
└──────────────────────────────────────────────────────────┘
```

Three fields plus lines. No project picker, no estimates, no tags, no dependencies —
Standard 12. Lines that match an existing open item **link** to it rather than creating
a duplicate (matched on exact title, offered as a suggestion, never silently).

### 3.9 EOD report — `/reports?face=eod`

```
┌─ END OF DAY ──────────────────────── Fri 30 Aug 2026 ──┐
│                                                         │
│  What got done today                                    │
│   ☑ Finish enquiry triage           ← from this morning │
│   ☐ Call 3 leads from Tuesday          plan, pre-filled │
│   + something not on the plan  [_________________]      │
│                                                         │
│  Still pending  (unticked items carry over — reason?)   │
│  [ Leads pushed to Monday, contact numbers were wrong ] │
│                                                         │
│  Progress against target        ◆ Close 40 deals        │
│  [ 3 ] closed today             ▓▓▓▓░░░░░░ 38% → 45%    │
│                                                         │
│  Biggest win today (optional)                           │
│  [ Onboarded Sharma Interiors____________________ ]      │
│                                                         │
│  Blocked on / need help (optional)                      │
│  [ Pricing sign-off_____________________________ ]      │
│                                                         │
│  Tomorrow's first priority                              │
│  [ Call the 3 leads_____________________________ ]      │
│                                                         │
│  Worked 8h 02m · 42m break · started 9:04  (read-only)  │
│                          [Save draft]  [Submit report ▸]│
└─────────────────────────────────────────────────────────┘
```

The attendance line is **read from the clock, never typed** — a report that lets someone
type their own hours is not a record. Ticking a plan line **completes the work item**;
the two cannot disagree (TM-AD-09).

### 3.10 Senior / admin performance view — `/reports`

The screen that answers "who needs me today", in the order a manager actually asks.

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ Reports                                     Fri 30 Aug · 21 in · 2 EOD missing │
├────────────────────────────────────────────────────────────────────────────────┤
│ [Today] [Plans] [EOD reports] [Trends]              ‹ 30 Aug ›  [Export CSV]   │
├────────────────────────────────────────────────────────────────────────────────┤
│ ⚠ NEEDS ATTENTION                                                              │
│  ┌──────────────────────┬──────────────────────┬──────────────────────┐        │
│  │ 2 no plan submitted  │ 2 EOD missing        │ 3 delayed items      │        │
│  │ ◍ Divya  ◍ Rahul     │ ◍ Meera  ◍ Arjun     │ ◍ Arjun ×2  ◍ Priya  │        │
│  └──────────────────────┴──────────────────────┴──────────────────────┘        │
│  ┌──────────────────────┬──────────────────────┐                               │
│  │ 2 blocked, 1 > 3 days│ 3 absent, 4 late     │                               │
│  │ ◍ Meera (pricing)    │ ◍ Divya ◍ Rahul …    │                               │
│  └──────────────────────┴──────────────────────┘                               │
├────────────────────────────────────────────────────────────────────────────────┤
│ TODAY, BY MEMBER                                                               │
│ ┌─┬──────────────┬──────┬──────┬───────────────┬──────┬──────┬───────────────┐ │
│ │ │ MEMBER       │ IN   │ PLAN │ DOING         │ DONE │ EOD  │ TARGET        │ │
│ ├─┼──────────────┼──────┼──────┼───────────────┼──────┼──────┼───────────────┤ │
│ │▌│ ◍ Meera Nair │ 9:04 │ ✓3   │ Enquiry triage│ 1/3  │ ⚠ —  │ ▓▓▓▓▓▓░ 62%   │ │
│ │▌│ ◍ Arjun Sh.  │ 9:47⚠│ ✓2   │ Calling leads │ 0/2  │ ⚠ —  │ ▓▓▓▓░░░ 38%⚠  │ │
│ │ │ ◍ Sanjay Rao │ 9:12 │ ✓4   │ —             │ 4/4  │ ✓18:1│ ▓▓▓▓▓▓▓ 91%   │ │
│ │▌│ ◍ Divya Kap. │ —    │ —    │ —             │ —    │ —    │ —             │ │
│ └─┴──────────────┴──────┴──────┴───────────────┴──────┴──────┴───────────────┘ │
│    click any cell → that member's dashboard, that tab                          │
└────────────────────────────────────────────────────────────────────────────────┘
```

**High performers are not a badge.** The table sorts by whatever column you click and
the target column carries the number; the panel does not compute a score and rank people
by it. *Reason:* a score invites the question "computed how", and any answer this module
could give would be wrong for half the roles in the business (TM-OD-11).

**Trends** reuses the existing chart kit as-is: `ColumnChart` for hours and completions
by week, `BarRows` for per-member completion counts, `CohortHeat` for the
member × day submission grid. No new chart types.

### 3.11 Offer letter — admin side and public side

```
ADMIN                                          PUBLIC  (no login, token in URL)
┌─ OFFER LETTER · OFF-2026-0043 ──────┐        ┌────────────────────────────────┐
│ Meera Nair · Ops Lead      ●sent    │        │        Interior Bazzar         │
│ v2 · issued 28 Aug · expires 4 Sep  │        │   ─────────────────────────    │
├─────────────────────────────────────┤        │   Offer of employment          │
│  ┌───────────────────────────────┐  │        │   Meera Nair · Ops Lead        │
│  │  the sheet, in an iframe —    │  │        │   Start 15 Sep 2026            │
│  │  the SAME html the candidate  │  │        │   CTC ₹ 9,60,000 / year        │
│  │  sees. One renderer.          │  │        │   … full letter …             │
│  └───────────────────────────────┘  │        │                                │
├─────────────────────────────────────┤        │ ─ ACCEPTANCE ────────────────  │
│ TIMELINE                            │        │ Your full name*                │
│  ● created   28 Aug 10:02  by Admin │        │ [ Meera Nair______________ ]   │
│  ● issued    28 Aug 10:14           │        │                                │
│  ● shared    28 Aug 10:15           │        │ Signature*   [Type] [Draw]     │
│  ● viewed    28 Aug 18:41 · IP …    │        │ ┌────────────────────────────┐ │
│  ○ accepted  —                      │        │ │  ✍  (canvas)         Clear │ │
├─────────────────────────────────────┤        │ └────────────────────────────┘ │
│ [New share link] [Revise] [Revoke]  │        │                                │
│ Link https://…/o/9fA2…  expires 4Sep│        │ ☐ I have read and accept the   │
│ [Copy]                              │        │   terms of this offer.         │
└─────────────────────────────────────┘        │                                │
                                               │        [ Accept offer ]        │
 states: draft → issued → sent → viewed        └────────────────────────────────┘
         → accepted | declined | expired
         | superseded | revoked                        ↓ after accept
                                               ┌────────────────────────────────┐
                                               │  ✓ Accepted 28 Aug, 18:52 IST  │
                                               │  A copy has been emailed to    │
                                               │  meera@example.com.            │
                                               │  [Download your copy]          │
                                               └────────────────────────────────┘
```

The public page is **the only surface in this panel that renders without a session.**
It gets its own minimal stylesheet and its own route tree — it must not import
`AdminShell`, and it must never render a nav.

### 3.12 Documents & salary slips — member dashboard tab

```
┌─ DOCUMENTS ────────────────────────────────────────────┐
│ OFFER LETTER                                           │
│  OFF-2026-0043  v2  ●accepted 28 Aug 18:52   [View]    │
│  ▸ earlier versions (1)                                │
├────────────────────────────────────────────────────────┤
│ SALARY SLIPS                       [Upload slip]       │
│  Aug 2026   uploaded 1 Sep   [Download]                │
│  Jul 2026   uploaded 1 Aug   [Download]                │
│  Jun 2026   uploaded 1 Jul   [Download]                │
├────────────────────────────────────────────────────────┤
│ OTHER DOCUMENTS                    [Upload]            │
│  ID proof · PAN · Address proof                        │
└────────────────────────────────────────────────────────┘
```

Every download is an **expiring capability link**, not a public S3 URL — see TM-R-04,
which is a live security defect in the existing upload path that this module must not
inherit.

---

## 4. Phase 4 — information architecture

### 4.1 The hierarchy

```
TEAM  (sidebar group)
│
├── Members                         /team                      key: team
│   ├── tab Members                 /team?tab=members
│   ├── tab Attendance today        /team?tab=today             + attendance.view
│   ├── tab Access requests         /team?tab=requests          + team.edit
│   ├── drawer Member summary       /team/:id?d=1
│   ├── page Member dashboard       /team/:id                   ← the record
│   │   ├── tab Overview            /team/:id
│   │   ├── tab Attendance          /team/:id?tab=attendance    + attendance.view
│   │   ├── tab Work                /team/:id?tab=work          + work.view
│   │   ├── tab Reports             /team/:id?tab=reports       + work.view
│   │   └── tab Documents           /team/:id?tab=docs          + people-docs.view
│   ├── modal Add member (4 steps)                              team.create
│   ├── modal Credentials (once)                                team.create
│   ├── modal Edit member                                       team.edit
│   ├── modal Roles                                             team.roles
│   ├── modal Send new password                                 team.edit
│   ├── modal Deactivate / Activate                             team.status
│   └── modal Correct attendance entry                          attendance.correct
│
├── Attendance                      /attendance                 key: attendance
│   ├── face Today                  /attendance
│   ├── face History                /attendance?face=history
│   ├── strip My clock              (topbar, everywhere)         attendance.view
│   └── modal Correct entry                                     attendance.correct
│
├── Work                            /work                       key: work
│   ├── face Board                  /work
│   ├── face List                   /work?face=list
│   ├── face Calendar               /work?face=calendar
│   ├── drawer Work item            /work/:id
│   ├── modal New item                                          work.create
│   ├── modal Block (reason)                                    work.edit
│   └── modal Cancel (reason)                                   work.edit
│
├── Reports                         /reports                    key: work
│   ├── face Today                  /reports                    work.review
│   ├── face Plans                  /reports?face=plans         work.review
│   ├── face EOD reports            /reports?face=eod           work.review
│   ├── face Trends                 /reports?face=trends        work.review
│   ├── form Today's plan           /reports?face=plan          own, always
│   └── form EOD report             /reports?face=eod&mine=1    own, always
│
└── Roles                           /roles                      key: roles   EXISTS
    ├── drawer Role                 /roles/:id
    └── modals Create / Edit / Delete

OUTSIDE the shell, no session:
    Offer letter acceptance         /o/:token                   public
    Document download               /d/:token                   public, single-use
```

### 4.2 Every screen, by who may open it

| Screen | Admin only | Senior + admin | Member (own) | Shared |
| --- | :-: | :-: | :-: | :-: |
| Members list | | ✓ | | |
| Add / edit member | ✓ | | | |
| Assign roles | ✓ | | | |
| Deactivate member | ✓ | | | |
| Member dashboard — Overview | | ✓ | ✓ own | |
| Member dashboard — Access tab | ✓ | | | |
| Attendance today (all) | | ✓ | | |
| Attendance history (all) | | ✓ | | |
| My clock strip | | | ✓ | ✓ |
| Correct an attendance entry | ✓ | | | |
| Work board / list / calendar | | ✓ all | ✓ own | |
| Create / assign work | | ✓ | | |
| Update own work status | | ✓ | ✓ | ✓ |
| Milestones & targets | | ✓ create | ✓ read+progress | |
| Today's plan (write) | | | ✓ | |
| EOD report (write) | | | ✓ | |
| Plans / EOD (read all) | | ✓ | | |
| Performance view | | ✓ | | |
| Offer letter — create/issue/share | ✓ | | | |
| Offer letter — read own | | | ✓ | |
| Salary slip — upload | ✓ | | | |
| Salary slip — download own | | | ✓ | |
| Roles | ✓ | | | |
| Public acceptance page | | | | ✓ anonymous + token |

### 4.3 Screen states — every one, for every surface

| State | Rule | Component |
| --- | --- | --- |
| **Loading** | Lists → `ListSkeleton`; a pane inside a loaded page → `PaneLoading`; boot → `AdminLoader`. Never a spinner over content that is already correct. | exists |
| **Empty — nothing exists yet** | `EmptyState` with the action that creates the first one. "No work items yet — assign the first one." | exists |
| **Empty — filtered to nothing** | A *different* `EmptyState`: names the filter and offers Clear all. The panel's existing rule; the two must never share copy. | exists |
| **Error — request failed** | `Notice tone="bad"` in place, with the HTTP code and the server's message via `errOf`. Never a toast alone for a failed read. | exists |
| **Error — write refused** | `ErrSlot` inside the open dialog. The dialog stays open with the values intact. | exists |
| **Permission denied — route** | `Denied` from `registry.tsx:61`. | exists |
| **Permission denied — action** | The control is **ABSENT**, not disabled (`ARM-BR-06`). | exists |
| **Service down** | `ServiceDown` with retry; tokens are kept. "Down" is not "denied". | exists |
| **Success** | `toast()` for a completed write; `banner()` only for something that outlives the screen (an offer letter now awaiting acceptance). | exists |
| **Proto banner** | Every frontend-first face carries the existing proto bar naming the absent endpoint. | exists |
| **Stale / conflict** | `409` on a stale `rowVersion` → dialog stays open, `ErrSlot` says the record changed, with a Reload control. | new copy |

---

## 5. Phase 3 — user flows

Notation: `→` a step · `⊘` a refusal with its code · `⟳` a transaction boundary.

### Flow A — Admin adds a member, assigns a role, sends an offer letter

```
Admin → /team → [+ Add member]
  → step 1 identity      ⊘409 duplicate_email | duplicate_username | duplicate_phone
  → step 2 employment    ⊘400 validation_failed (joining date, hours, day-start)
  → step 3 roles         ⊘403 self_elevation (granting beyond own authority)
  → step 4 offer letter (skippable)
  ⟳ TM-T01 create member: create CustomUser(type=admin) → hash password →
     create TeamProfile → attach roles (append user_role rows, never overwrite) →
     append AUDIT member_created → return the member
  → CREDENTIALS MODAL — the only time the password is shown, ever
  → if step 4 was filled:
      ⟳ TM-T10 create offer letter as DRAFT (no number spent, freely editable)
      → [Preview] → [Issue]
        ⟳ TM-T11 issue: spend the number → snapshot party + terms →
           render + store artefact v1 with sha256 → status=issued →
           append OFFER_ISSUED → (no send yet)
      → [Send] → ⟳ TM-T12 mint token (random, hashed at rest, expires) →
           status=sent → append OFFER_SHARED → email the link
  → member appears in the list, ⚠ rail if no role
```

**Failure that must not lose work:** if the offer letter fails at step 4, the **member
is already created**. The modal reports the letter's failure alone and offers Retry —
it does not roll the member back. *Reason:* two independent decisions, two transactions.

### Flow B — Member: login → work → break → resume → logout

```
Member → /login → session established (UserSession row written, as today)
  → shell renders; topbar clock strip shows ○ Not started
  → [Start day]
      ⟳ TM-T20 open attendance: server stamps startedAt, derives businessDate (IST),
         derives late = startedAt > dayStartsAt + graceMinutes, appends ATT_IN
      ⊘409 already_open (a second tab, or a second device — the SAME session is
        returned, not a second one; idempotent by (member, businessDate))
  → strip shows ● Working, elapsed ticking from server skew
  → [Break]     ⟳ TM-T21 open break   ⊘409 already_on_break  ⊘422 day_not_open
  → [Resume]    ⟳ TM-T22 close break  ⊘409 not_on_break
  → [End day]   ⟳ TM-T23 close: stamp endedAt, close any open break, compute
                   workedMinutes / breakMinutes, append ATT_OUT
  → EOD prompt appears if no report exists for today  (a nudge, never a block)
  → sign out — the auth session ends; the attendance record is ALREADY closed
                and is unaffected either way (TM-AD-03)
```

**The forgotten logout** is the interesting case and is handled without a job: a session
still open past `autoCloseAt` (default 20:00 IST) renders as **Unclosed**, not as a
14-hour day. It counts as `—` in totals until a person resolves it, and the member is
asked to confirm or correct their end time on their next page load. Nothing is
auto-written. *Reason:* an auto-closed day is a number the system invented; an unclosed
one is a question, and a question is honest.

### Flow C — Senior assigns a task; member updates it to completion

```
Senior → /work → [+ New item]
  → kind=task, title, assignee, due, priority, rolls-up-to (optional milestone)
  ⟳ TM-T30 create work item: status=planned → append WORK_CREATED, WORK_ASSIGNED
  → (member sees it on /work and on their dashboard; badge count increments)
Member → opens item → [Start]     ⟳ TM-T31 status → in_progress, append
       → [Block…] reason required ⟳ TM-T32 status → blocked, append with reason
       → [Complete]               ⟳ TM-T33 status → completed, stamp completedAt,
                                     roll progress up to the parent milestone
  ⊘403 forbidden — a member may change status on an item ASSIGNED TO THEM;
       reassignment and deletion need work.edit
  ⊘422 invalid_transition — completed → in_progress is refused; reopening is an
       explicit Reopen with a reason, so a completion is never quietly undone
```

### Flow D — Member submits today's plan

```
Member → /reports?face=plan (or the dashboard's "no plan today" prompt)
  → types 1..n lines, priority per line, optional outcome and blockers
  → [Save draft] — as often as they like, no side effects
  → [Submit plan]
    ⟳ TM-T40 submit plan: upsert DailyPlan(member, businessDate) →
       for each line: link an existing open item by exact title, ELSE create a
       WorkItem(kind=task, due=businessDate, status=planned) →
       stamp submittedAt → append PLAN_SUBMITTED
  ⊘409 already_submitted — after submit, the plan is read-only; the day is changed
       by changing the WORK ITEMS, which is what actually happened
```

### Flow E — Member submits the EOD report

```
Member → /reports?face=eod&mine=1  (prompted at [End day], never blocking)
  → completed list PRE-FILLED from today's plan items and any item completed today
  → ticks / unticks; unticked lines require the pending-reason field
  → target progress, win, blockers, tomorrow's priority (all optional but the first)
  → [Submit report]
    ⟳ TM-T41 submit EOD: upsert DailyReport(member, businessDate) →
       complete every ticked work item that is not already complete →
       apply target deltas → stamp submittedAt → append EOD_SUBMITTED
  → the worked/break line is READ from attendance, never typed
  ⊘422 day_not_ended — allowed, with a warning, because someone legitimately files
       an EOD before clocking out. Warned, not refused.
```

### Flow F — Senior reviews the day

```
Senior → /reports (face=today)
  → NEEDS ATTENTION resolves first: no plan · no EOD · delayed · blocked · absent/late
  → each name is a link straight to that member's dashboard on the relevant tab
  → [Acknowledge] on an EOD report → ⟳ TM-T42 stamp acknowledgedBy/At, append
  → Export CSV → the rows ON SCREEN, in the order on screen (the existing contract)
```

### Flow G — Member opens their dashboard

```
Member → /team/me  (or the shell lands them there when it is their only destination)
  → Overview: today's clock, this week's bars, own work, own milestones, own targets
  → tab Documents → offer letter (own, read) · salary slips (own)
  → [Download] → ⟳ TM-T50 mint a SINGLE-USE capability token, expires 15 min →
       redirect to /d/:token → stream → mark used
  ⊘403 — a member may only ever read their own documents; the check is on the
       RECORD's member id, not on a route param
```

### Flow H — Milestone / target lifecycle

```
Senior → /work → [+ New item] kind=milestone
  → title, owner, due, target value + unit (for kind=target), rolls-up-to (optional)
  ⟳ TM-T30 (same transaction, different kind)
  → child tasks are attached by setting their parentId
  → progress is DERIVED: completed children ÷ total children for a milestone;
    accumulated value ÷ target value for a target — NEVER typed directly, except
    on a target with no children, where the EOD's delta is the only writer
  → on the last child completing: the milestone auto-completes and appends
    WORK_COMPLETED with actor=system, note naming the child that closed it
  ⊘422 invalid_parent — a task may not be its own ancestor; depth is capped at 3
       (target ▸ milestone ▸ task) because a fourth level is a project tool
```

---

## 6. The permission model

### 6.1 Module keys and their verbs

Verbs are declared **per module, not uniformly** — the existing rule, and the reason the
matrix stays readable. New keys and verbs in **bold**.

| Module key | Verbs | Notes |
| --- | --- | --- |
| `team` | `view` `create` `edit` `roles` `status` **`delete`** | `status` currently gates *Delete member* — a documented wart. Splitting it (`status` = activate/deactivate, `delete` = remove) is TM-OD-02. |
| `roles` | `view` `create` `edit` **`delete`** | `edit` gates delete today; same split, same reason. `DELETE /roles/` is also not wired server-side. |
| **`attendance`** | **`view` `edit` `correct` `export`** | `view` = see others' attendance. `edit` = change the working-hours policy on a member. **`correct` is separate and sensitive** — amending a time record is the one attendance action that rewrites history. |
| **`work`** | **`view` `create` `edit` `assign` `review` `export`** | `review` is the senior verb: read everyone's plans and EOD reports and acknowledge them. `assign` is separate from `create` so a lead can create work without redirecting other people's days. |
| **`people-docs`** | **`view` `upload` `issue` `revoke`** | Offer letters and salary slips. `issue` mints an offer letter and its link; `revoke` kills a live link. Deliberately **not** granted with `team.edit`. |

### 6.2 The rules that already exist and are inherited unchanged

1. **`view` is the gate.** Without it the module leaves the sidebar and the route is
   refused, whatever else is ticked. Enforced in five places today; a sixth that
   disagreed would be a bug.
2. **Union, not intersection.** Multiple roles add up — someone who is both a lead and
   a finance reviewer does both jobs.
3. **An inactive role grants nothing.** An inactive account can do nothing.
4. **Deny by default.** An unresolved session denies; there is no permissive fallback.
5. **No self-elevation, no self-lockout, never the last super admin.**
6. **Locked actions are absent, not greyed.**
7. **Never branch on a role name** (TM-AD-16).

### 6.3 Self-scope — how a member reaches their own record without a permission

Every operational surface answers two different questions: *"may you see this module"*
and *"whose records"*. v1 answers the second with one rule and no new permission axis:

> **TM-BR-02 · The self rule.** A signed-in member may always read and write **their
> own** attendance clock, work-item statuses, daily plan, EOD report and documents,
> with no module grant at all. A grant on the module is what extends the same screen to
> **everyone**. There is no middle setting in v1.

*Reason:* it needs no schema change, it is one predicate at every read (`memberId ==
session.memberId OR can(module,'view')`), and it cannot be misconfigured into a member
being unable to file their own EOD. **What it does not express is "my reports, but not
the whole company"** — the missing `own | team | all` scope axis that the prototype's
own operation doc names as the next thing worth building. `reportsTo` is captured on the
member record from day one so that adding the axis later is a permission change and not
a data migration. This is **TM-OD-01**, the largest open decision in the document.

### 6.4 Making the new keys real, server-side

For `attendance`, `work` and `people-docs` to hold real permissions, the deployed
backend needs a `Module` row and its `ModuleAction` rows for each — the precedent being
migration `0024`, which seeded `business-enquiries` and let it leave `PROTO_MODULES` in
the same commit. Until then the client stand-in applies and is a real hole (TM-R-03).
`team` and `roles` need **no** such work; only their new verbs do.

---

## 7. Phase 5 — the conceptual data model

Not migrations. Relationships, fields, statuses, ownership, audit and permission
requirements — as required before any DDL is written.

### 7.1 Entities and relationships

```
CustomUser (EXISTS, app_ib)  ──1:1──  TeamProfile (NEW)
        │                                  │
        │                                  ├──1:N── AttendanceDay ──1:N── AttendanceBreak
        │                                  ├──1:N── WorkItem (assignee)   ↑ self-ref parentId
        │                                  ├──1:N── DailyPlan ──1:N── DailyPlanLine ──▶ WorkItem
        │                                  ├──1:N── DailyReport ──1:N── DailyReportLine ──▶ WorkItem
        │                                  ├──1:N── OfferLetter ──1:N── OfferLetterVersion
        │                                  │              └──0:1── OfferAcceptance
        │                                  ├──1:N── MemberDocument   (slips, ID proofs)
        │                                  └──N:1── TeamProfile  (reportsTo, self-ref)
        │
        ├──M:N── Role (EXISTS, rbac_module) ──M:N── permissions
        └──1:N── UserSession (EXISTS — evidence only, never the attendance record)

DocumentToken (NEW, generic) ──▶ any of: OfferLetter | MemberDocument
WorkEvent / AttendanceEvent → the EXISTING AdminAuditLog, not a second audit surface
```

### 7.2 Entity definitions

**`TeamProfile`** — the employment facts that `CustomUser` has nowhere to put.
`userId` (1:1, PK) · `designation`* · `employmentType` (full_time|part_time|contract|intern) ·
`joiningDate`* · `exitDate` · `reportsToId` (self FK, nullable) · `workLocation`
(office|remote|hybrid) · `expectedHoursPerDay` (default 8) · `dayStartsAt` (time, default
09:30) · `graceMinutes` (default 15) · `autoCloseAt` (time, default 20:00) · `timezone`
(default Asia/Kolkata) · `isActive` · audit quad.
*Owner:* `team`. *Reads:* everyone with `team.view`. *Writes:* `team.edit`.
**Why a separate table and not columns on `CustomUser`:** `CustomUser` is the platform's
identity for buyers, sellers and staff alike; a `joiningDate` on a marketplace buyer is
meaningless, and the existing model file is already documented as one nobody should add
to (`app_ib/models.py` is shadowed dead code).

**`AttendanceDay`** — one row per member per business day.
`memberId`* · `businessDate`* (DateField, IST) · `startedAt` (DateTime UTC) · `endedAt` ·
`workedMinutes` (computed on close) · `breakMinutes` · `isLate` (computed at open) ·
`lateByMinutes` · `state` (open|closed|unclosed — the last is **derived**, never stored) ·
`source` (self|corrected) · `correctedById` · `correctionReason` · `openedFromIp` ·
audit quad. **Unique on (memberId, businessDate).**
*Owner:* `attendance`. *Reads:* self always; others need `attendance.view`.
*Writes:* self for open/break/close; `attendance.correct` for anything else.

**`AttendanceBreak`** — `dayId`* · `startedAt`* · `endedAt` · `minutes` · `reason`
(optional). At most one open break per day, enforced server-side.

**`WorkItem`** — the unified entity (TM-AD-06).
`id` · `kind`* (task|milestone|target) · `title`* · `description` · `assigneeId`* ·
`createdById` · `parentId` (self FK, depth ≤ 3) · `status`* (planned|in_progress|
completed|blocked|cancelled — **never `delayed`**, TM-AD-08) · `priority` (low|medium|
high) · `dueDate` (DateField) · `startDate` · `completedAt` · `expectedOutcome` ·
`blockedReason` · `blockedByItemId` · `targetValue` + `targetUnit` + `currentValue`
(kind=target only) · `progressPct` (**derived** for milestones, accumulated for targets) ·
`sourcePlanLineId` · `rowVersion` · audit quad.
*Owner:* `work`. *Reads:* self always; all with `work.view`. *Writes:* status by the
assignee; everything else `work.edit` / `work.assign`.

**`DailyPlan`** — `memberId`* · `businessDate`* · `expectedOutcome` · `blockers` ·
`notes` · `submittedAt` (null = draft) · audit quad. **Unique on (memberId, businessDate).**
**`DailyPlanLine`** — `planId`* · `ordinal` · `title`* · `priority` · `workItemId` (the
item it created or linked).

**`DailyReport`** — `memberId`* · `businessDate`* · `pendingWork` · `pendingReason` ·
`achievement` · `blockers` · `supportNeeded` · `tomorrowPriority` · `notes` ·
`submittedAt` · `acknowledgedById` · `acknowledgedAt` · audit quad.
**Unique on (memberId, businessDate).**
**`DailyReportLine`** — `reportId`* · `workItemId` (nullable — an off-plan line) ·
`title` · `done` (bool) · `targetDelta` (numeric, nullable).

**`OfferLetter`** — `memberId`* · `number`* (unique, spent at issue) · `status`*
(draft|issued|sent|viewed|accepted|declined|expired|superseded|revoked) · `version` ·
`parentId` · `supersededById` · `partySnapshot` (JSON, frozen at issue) · `terms` (JSON:
role, ctc, startDate, reportingTo, probation, noticePeriod, workLocation) · `validUntil` ·
`issuedById` · `issuedAt` · `sentAt` · `viewedAt` · `acceptedAt` · `declinedAt` ·
`declineReason` · `rowVersion` · audit quad.
*Owner:* `people-docs`. **Writes are refused entirely once `status != draft`** — the
freeze is the absence of the endpoint, not a flag (TM-AD-10).

**`OfferLetterVersion`** — `offerId`* · `version`* · `storageKey`* · `checksumSha256`* ·
`byteSize` · `generatedAt`. Append-only. A revision adds a version; nothing overwrites.

**`OfferAcceptance`** — the evidence bundle (TM-AD-13). `offerId`* (1:1) ·
`acceptedName`* · `signatureKind`* (typed|drawn) · `signatureStorageKey` ·
`acceptedAt`* (DateTime) · `ip`* · `userAgent`* · `consentText`* (the exact snapshot
shown) · `consentVersion`* · `documentChecksum`* (the version they actually saw) ·
`tokenId`*. **Immutable. No update path exists.**

**`MemberDocument`** — `memberId`* · `kind`* (salary_slip|id_proof|pan|address|other) ·
`periodMonth` (YYYY-MM, slips only) · `title` · `storageKey`* · `mime` · `byteSize` ·
`uploadedById`* · `uploadedAt`* · `isActive`. **Unique on (memberId, kind, periodMonth)**
for slips — one slip per member per month.

**`DocumentToken`** — the capability token (TM-AD-12). `tokenHash`* (SHA-256 of a
`secrets.token_urlsafe(32)`, **indexed, unique**) · `targetType`* · `targetId`* ·
`purpose`* (offer_accept|document_download) · `expiresAt`* · `singleUse` · `usedAt` ·
`viewedAt` · `revokedAt` · `createdById`* · `createdAt`* · `attemptCount`.
**The plaintext token is returned once, at mint, and is never stored or logged.**

### 7.3 Cross-cutting field rules

- **Audit quad** on every table: `createdAt`, `createdById`, `updatedAt`, `updatedById`.
- **All timestamps are UTC `DateTimeField`s**; every *business day* is a separate IST
  `DateField` (TM-AD-05). The two are stored together, never derived from each other on
  the client.
- **Money in paise, integers**, as everywhere else in the panel (`inr()` renders it).
- **Nothing is hard-deleted.** Members deactivate; work items cancel; documents
  `isActive=false`; role assignments close with `removed_at`.
- **Every state change appends to the existing `AdminAuditLog`** with `moduleKey` set to
  the owning module. **No second audit surface** — the rule the prototype set and the
  panel's Audit screen already relies on.

### 7.4 Reuse of existing models

| Existing | Used for | Not used for |
| --- | --- | --- |
| `CustomUser` (`type='admin'`) | the member identity | employment facts → `TeamProfile` |
| `rbac_module.Role` + `Access` / `AdminModuleAccess` | roles and grants | nothing new needed beyond new module rows |
| `AdminAuditLog` | every Team event | — |
| `UserSession` | login **evidence** shown beside attendance | the attendance record itself (TM-AD-03) |
| `UserCreationAudit` | who added whom | the reporting line → `TeamProfile.reportsTo` |
| S3 presigned PUT (`get-upload-url/`) | signature images, slips, documents | **reads** — those need the new token (TM-R-04) |
| `interior_cms.TeamMember` | **nothing** — it is the public About page | ⚠ name collision: do not reuse the name |
| `interior_engine.BusinessTeamMember` | **nothing** — seller-side staff, unwired | ⚠ concept collision |

---

## 8. Edge cases, and what each screen does about them

Required explicitly by Standard 14; each row is a design decision, not a to-do.

| Case | Behaviour |
| --- | --- |
| **Two tabs, two Start day clicks** | Idempotent on `(member, businessDate)`. The second returns the *same* open day, not a conflict. |
| **Break left open at End day** | Closing the day closes the break at the same instant and says so in the response. Never a negative or a 9-hour break. |
| **Forgotten logout** | Day past `autoCloseAt` renders **Unclosed**, contributes `—` to totals, and asks the member to confirm or correct on next load. Nothing is auto-written (Flow B). |
| **Clock-in before midnight, out after** | `businessDate` is stamped at **open**; the day belongs to the date it started. A shift crossing midnight is one row. |
| **Timezone** | Everything IST. A member with a different `timezone` on their profile derives their own business date; the roll-up is still IST. v1 ships with one timezone in the data and the column in the schema. |
| **Backdated correction** | `attendance.correct` only, reason mandatory, both values kept, `AdminAuditLog` row. The original is never overwritten. |
| **Late rule when `dayStartsAt` changes** | `isLate` is computed **at open** and stored. Changing the policy does not retroactively make last month late. |
| **Plan submitted twice** | `409 already_submitted`. Change the work items instead. |
| **EOD before clocking out** | Allowed, with a warning line. Refusing it would punish an honest early filer. |
| **EOD never submitted** | The day is simply missing — no auto-generated report, ever. It surfaces in NEEDS ATTENTION and in the member × day heat grid. |
| **Member deactivated mid-day** | The open attendance day is closed at the deactivation instant with `source=corrected` and a reason. Their work items are **not** deleted; they surface as unassigned-owner in a filter. |
| **Work item assigned to a deactivated member** | Refused, `422 assignee_inactive`. |
| **Milestone due before its child task** | Warned at save, not refused. A milestone due date is a commitment, and a late child is exactly what the warning is for. |
| **Circular parent** | `422 invalid_parent`; depth capped at 3. |
| **Completed → in progress** | Refused. Reopen is an explicit action with a reason so a completion is never quietly undone. |
| **Offer link expired** | The public page renders an "expired" state naming the date, with no letter content and no form. Never a 404 — a candidate must not be left wondering if they mistyped it. |
| **Offer link opened after acceptance** | Renders the accepted state and offers their copy. It does **not** show the acceptance form again. |
| **Offer accepted twice / double submit** | Idempotent on the token. The second POST returns the existing acceptance with `200`, not a second evidence row. |
| **Offer revised after sending** | The live token is **revoked** in the same transaction that issues the new version. A candidate must never hold a link to a superseded offer. |
| **Offer declined** | Terminal with a stored reason; the member record keeps the letter and the decline, and the member stays inactive. |
| **Candidate has no signature capability** (no pointer/touch) | The **typed** signature is a first-class option, not a fallback, and the tab order reaches it first. |
| **Slip uploaded for the wrong month** | Unique on (member, kind, month) → `409`. Replacing is an explicit action that marks the old one inactive and keeps it. |
| **Document link shared onward** | Single-use, 15-minute expiry, and `attemptCount` is recorded. A shared link is dead by the time it is forwarded. |
| **Duplicate email / username / phone** | `409` with the specific code, at step 1, before anything is created. |
| **Permission removed while a member is on the screen** | The next request fails the guard chain; the panel shows `Denied`, not a stale screen. The existing fail-closed rule. |
| **Backend down** | `ServiceDown` with retry; tokens kept. "Down" is not "denied". |
| **Stale write (`rowVersion` mismatch)** | `409`, dialog stays open with values intact, Reload offered. |

---

## 9. Regression risk — what this touches that already works

Required by Standard 16. Every item below is an existing, working thing.

### 9.1 Files that must change, and the risk in each

| File | Change | Risk | Mitigation |
| --- | --- | --- | --- |
| `src/admin/shell/modules.ts` | `GROUP_ORDER` gains `"Team"`; `ICON_OF`/`Q_OF` gain 3 keys; `PROTO_ROWS` gains 3 rows | A `groupLabel` that does not match `GROUP_ORDER` **exactly** lands the module in a section of one — a documented failure | Assert the exact string in the check suite; verify against the server's `groupLabel` before shipping |
| `src/admin/auth/session.ts` | `PROTO_MODULES` gains `attendance`, `work`, `people-docs` | **Grants those keys to every signed-in account** | Ship only while the seeds are client-side; remove each key in the same commit as its endpoint (TM-R-03) |
| `src/admin/views/registry.tsx` | 3 new `VIEWS` entries | Low — additive | — |
| `src/admin/views/teamShared.tsx` | Possibly new shared bits | **Shared by Team AND Roles.** A change to `ActionMatrix` affects the live Roles editor | Add, never modify. Any change to `ActionMatrix` re-runs the Roles smoke check |
| `src/admin/views/Team/index.tsx`, `MemberDrawer.tsx`, `memberModals.tsx` | New tab, new drawer sections, wizard | **These are live screens against real staff data** | New sections render only when the grant is held; the existing five sections are untouched |
| `src/admin/ui/index.tsx` | `ICONS` gains `clock` (+ maybe 2) | Additive; unknown names already fall back to `doc` | — |
| `src/admin/shell/AdminShell.tsx` | Topbar clock strip slot | **Every screen in the panel renders this** | Renders `null` without `attendance.view`; no layout change when absent |
| `src/routes/index.tsx` | 2 public routes **outside** `RequireSession` | A mistake here exposes the panel | Public routes are siblings of `/login`, never inside the guarded tree; they import no shell code |
| `package.json` | 1 dependency (signature capture) — see TM-OD-06 | Another session is editing this file for Finance check scripts | Coordinate; add the dep in its own commit, touching one line |

### 9.2 Files that must NOT change

`src/styles/admin-theme.css` (TM-AD-15 — all new CSS in `Team/team.css`) ·
everything under `src/admin/views/Finance/**` · `src/content/finance/**` ·
`scripts/*finance*`, `scripts/*fn-smoke*` · the `check:finance*` entries in
`package.json` · `src/admin/views/Users/store.ts` (Team may **import** its helpers;
promoting `ago`/`fmtDateTime`/`delta` into `ui/format.ts` is a separate, later commit).

### 9.3 Behaviour that must be re-verified after every phase

1. Roles editor still saves — `ActionMatrix` is shared.
2. `can()` still denies for a session with no grant on a **pre-existing** module.
3. Sidebar group order unchanged for the six existing groups.
4. `#/team` deep links from the account popover still resolve.
5. The `g t` keyboard chord still reaches Team.
6. Command palette still finds every module.
7. Business Enquiries' owner picker (which reads a team list) is unaffected.
8. Finance's `SalaryAccount.memberId` join against the live Team endpoint still resolves —
   **the other session depends on this; do not change the member id shape.**
9. Print stylesheets unaffected (new print rules live in `team.css`).
10. `npm run check` passes in full, including the Finance checks this plan never touches.

### 9.4 Concurrent-session protocol

The Finance session and this one share three documents. This plan appends **only**:
a new dated `##` heading at the top of `CHANGELOG.md`; a new `## Module 7 · Team`
section in `BACKEND-INTEGRATION.md`; and one row in `README.md`'s file table. No
Finance section is edited, and no file is rewritten whole.

---

## 10. Phase 6 — the implementation plan

Ten phases. Each lists frontend, backend, database, API, components, dependencies and
testing. **Phase A is the smallest thing that proves the shape; J is not optional.**

### Phase A — Navigation and foundation
- **FE:** `GROUP_ORDER` += `"Team"`; move the `roles` row into it; add `PROTO_ROWS` for
  the three new keys; `ICONS.clock`; `registry.tsx` entries; three placeholder views
  behind the existing `ComingSoon`; create `src/admin/views/Team/team.css`.
- **BE:** none. **DB:** none. **API:** none.
- **Components:** none new.
- **Depends on:** nothing. **Blocks:** everything.
- **Test:** group order; nav visible only with the key; no existing group moved; every
  existing deep link resolves.

### Phase B — Members and Roles (extend)
- **FE:** Employment section in `MemberDrawer`; the 4-step Add-member wizard; the
  Designation filter; the member dashboard **shell** with five empty tabs.
- **BE:** `TeamProfile` model + CRUD; extend `GET /admin/users/` with the profile block;
  **and the blocker below**.
- **DB:** `TeamProfile` (1 migration).
- **API:** `GET/PUT /admin/team/members/{id}/profile`, `GET /admin/team/members?…`
- **⚠ Blocker:** `GET /admin/users/` returns **only members the signed-in admin created**
  (`getSelfCreatedUsersController`). There is no "everyone" endpoint. **Every team-wide
  screen in this plan is blocked on that being fixed** (TM-R-01).
- **Test:** wizard step validation; duplicate codes; effective-access preview matches
  `grantsOf()`; Roles editor still saves.

### Phase C — Member dashboard
- **FE:** Overview tab, tiles, week bars, the scope table from §3.4 enforced by `can()`
  + the self rule; `/team/me` resolving to the session's own record.
- **BE/DB/API:** none yet — reads the Phase D–F seeds.
- **Components:** `WeekBars` (new), `ProgressRing` (new), reuse `Tiles`/`Block`/`Tabs`.
- **Test:** a member sees exactly the Member column of §3.4 and nothing else; a senior
  sees no Documents tab.

### Phase D — Attendance
- **FE:** topbar clock strip; `/attendance` Today + History; the day timeline row;
  correction modal; `src/content/team/attendance.json` + `store.ts`.
- **BE:** `AttendanceDay` + `AttendanceBreak`; open/break/resume/close as four
  transactions; late and unclosed derived at read; server-time skew endpoint reused.
- **DB:** 2 tables, unique on `(memberId, businessDate)`.
- **API:** `GET /admin/team/attendance?date=`, `GET …/attendance/{memberId}?from&to`,
  `POST …/attendance/open|break|resume|close`, `POST …/attendance/{id}/correct`.
- **Components:** `Clock` (ticking, skew-corrected), `DayTimeline`, `DurationText`.
- **Depends on:** A, B. **Test:** double-open idempotency; break-open-at-close; midnight
  crossing; late computed at open and not retroactive; timezone.

### Phase E — Offer letter, signature and acceptance
- **FE:** admin offer screens (create/preview/issue/share/revise/revoke) reusing
  `DocPage`, `ShareLine`, `printHtml`; the **public** acceptance page and its own
  minimal stylesheet, outside `RequireSession`.
- **BE:** `OfferLetter` + `OfferLetterVersion` + `OfferAcceptance` + `DocumentToken`;
  the HTML sheet template; issue/freeze transaction; the **public** `AllowAny` views;
  per-token and per-IP rate limiting; the acceptance email.
- **DB:** 4 tables. **API:** 6 admin endpoints + 3 public (`GET /o/{token}`,
  `POST /o/{token}/accept`, `POST /o/{token}/decline`).
- **Components:** `SignaturePad` (typed + drawn), `ConsentBlock`, `PublicShell`.
- **Depends on:** B. **Independent of** D, F, G, H, I — **this is the parallel branch.**
- **Test:** token unguessable and hashed at rest; expired/invalid/revoked/already-accepted
  each render their own state; double-accept idempotent; revise revokes the old token;
  the evidence bundle is complete; rate limits hold; **the public route renders with no
  session and imports no shell code.**

### Phase F — Work: tasks, milestones, targets
- **FE:** `/work` Board + List, item drawer, create/block/cancel modals, roll-up chips;
  `src/content/team/work.json` + `store.ts`.
- **BE:** `WorkItem` with the self-referencing parent, status transitions, derived
  progress, depth guard.
- **DB:** 1 table. **API:** `GET/POST /admin/team/work`, `GET/PUT /admin/team/work/{id}`,
  `POST …/{id}/status`, `POST …/{id}/assign`.
- **Components:** `Board`, `WorkCard`, `PriorityChip`, reuse `Pill`/`Table`/`FilterChips`.
- **Depends on:** A, B. **Test:** transition matrix; circular parent; depth cap;
  assignee-may-status-but-not-reassign; progress derivation.

### Phase G — Calendar
- **FE:** month grid, week view, day chips, click-a-day-to-create, month paging;
  forks the popover/grid mechanics of `Users/DateRange.tsx`.
- **BE:** none — one query param on the Phase F list endpoint (`from`/`to`).
- **Components:** `MonthGrid`, `DayCell`, `ItemChip`.
- **Depends on:** F. **Test:** month boundaries; a 5-item day collapsing to "+2 more";
  keyboard paging; **status colours resolve from the existing tone tokens in both themes.**

### Phase H — Today's plan and EOD report
- **FE:** both forms, the dashboard prompts, `/reports` member faces.
- **BE:** `DailyPlan`/`DailyPlanLine`/`DailyReport`/`DailyReportLine`; the submit
  transactions that create and complete work items.
- **DB:** 4 tables, unique on `(memberId, businessDate)` for both parents.
- **API:** `GET/PUT/POST /admin/team/plans/{date}`, same for `reports`,
  `POST …/reports/{id}/acknowledge`.
- **Depends on:** D (attendance line), F (work items). **Test:** submit-once; line→item
  linking never silently duplicates; EOD tick completes the item; the worked line cannot
  be typed; drafts survive reload.

### Phase I — Performance view
- **FE:** `/reports` Today / Plans / EOD / Trends; NEEDS ATTENTION; CSV export via the
  existing `ExportModal` template.
- **BE:** one roll-up endpoint per face; **filtering and counting server-side**, the
  panel's existing rule.
- **API:** `GET /admin/team/overview?date=`, `GET …/trends?from&to`.
- **Components:** reuse `ColumnChart`/`BarRows`/`CohortHeat` unchanged.
- **Depends on:** D, F, H. **Test:** counts match the drill-down exactly (derive, never
  serve a separate total); export = what is on screen, in that order.

### Phase J — Permissions, documents and regression
- **FE:** the Documents tab; slip upload; single-use download links; a full `can()` pass
  over every new control; remove every `PROTO_MODULES` key whose endpoint has landed.
- **BE:** `MemberDocument`; download tokens; **`Module` + `ModuleAction` rows for the
  three new keys** so they leave the client stand-in.
- **DB:** 1 table + the module seed migration.
- **Test:** the §9.3 list in full; `npm run check` green including Finance; a
  zero-grant session sees exactly the self surfaces and nothing else; **no
  `PROTO_MODULES` key remains for a module that now has server data.**

---

## 11. Phase 7 — parallel execution

### 11.1 What was already parallelised

Phase 1 ran six independent analyses concurrently — backend, admin shell, RBAC,
quotation signature flow, component inventory, prototype precedent. They were genuinely
independent (six different questions over four repositories) and were merged here before
a single decision was made, which is what caught the fact that Team already exists.

### 11.2 The dependency graph

```
        A ── navigation & foundation
        │
        ├──────────────┬───────────────────────┐
        ▼              ▼                       ▼
        B ── members   E ── offer letter,      (docs template
        │    & roles        signature,          research)
        │                   acceptance
        ├──────┬──────┐    ▲
        ▼      ▼      ▼    │ needs only B
        C      D      F ───┘
     dashbd  attend  work
               │      │
               │      ▼
               │      G ── calendar
               │      │
               └──┬───┘
                  ▼
                  H ── daily plan + EOD
                  │
                  ▼
                  I ── performance
                  │
                  ▼
                  J ── permissions, documents, regression
```

### 11.3 Safe parallel tracks

| Track | Phases | Why it is safe |
| --- | --- | --- |
| **1 · Core** | A → B → C → D → F → G → H → I | The critical path. Sequential by real data dependencies. |
| **2 · Documents** | E (after B) | Touches no shared file except `registry.tsx` and `routes/index.tsx`; its own models, own endpoints, own stylesheet, own public route tree. **The single best parallel branch in the plan.** |
| **3 · Backend module rows** | The `Module`/`ModuleAction` seed migration | Independent of every screen; needed by J. Start it early — it is a deploy, not a code change, and it is what lets `PROTO_MODULES` empty out. |
| **4 · Research, no code** | Signature library evaluation · offer-letter template copy · the `own\|team\|all` scope proposal (TM-OD-01) | Pure analysis; merge before E and before J respectively. |

### 11.4 What must NOT be parallelised

- **Anything before A.** Every phase needs the nav keys and the CSS file to exist.
- **D and H.** The EOD report reads the attendance line; building both against
  assumptions produces two shapes for one fact.
- **F and G.** The calendar is a face over the work list; a calendar built against a
  guessed item shape is rework.
- **Any two changes to `teamShared.tsx`.** It is shared with the live Roles editor.
- **Anything touching `admin-theme.css`** while the Finance session is live (TM-AD-15
  removes the need entirely).
- **TM-OD-01 (the scope axis).** It changes the permission model. Nothing that reads a
  permission may proceed on an assumption about it.

### 11.5 Model/effort allocation (Standard 7)

| Work | Weight |
| --- | --- |
| Token design, evidence bundle, acceptance transaction, the scope-axis decision, the attendance state machine | **Heaviest reasoning.** Security- and correctness-critical, hard to reverse. |
| Data model, transaction boundaries, permission verbs, status vocabulary | **Heavy.** Wrong here means a migration later. |
| Screen composition from existing components, filter/URL wiring, CSV export, seed JSON | **Light.** Established patterns; copy the precedent named in §1.4. |
| Copy, labels, empty-state text, icon selection | **Lightest.** But it is written once and reviewed, not generated per screen. |

---

## 12. Phase 8 — approval gate

**No production code has been written. Nothing below starts without explicit approval.**

### 12.1 Summary

| Area | Designed | Key decision | Ready for dev |
| --- | :-: | --- | :-: |
| Navigation | ✅ | Team is a top-level **group**, not a Settings item (TM-AD-01) | ✅ |
| Members | ✅ | Extend the live screen; add Employment + a 4-step wizard | ⚠ blocked on the "everyone" endpoint (TM-R-01) |
| Roles | ✅ | **Reuse `ActionMatrix` as-is.** Split `status`/`delete` (TM-OD-02) | ✅ |
| Member Dashboard | ✅ | **One component, two scopes** — never two screens (§3.4) | ✅ |
| Attendance | ✅ | A deliberate work clock, **not** the auth session (TM-AD-03); server owns the clock (TM-AD-04) | ✅ |
| Offer Letter | ✅ | Fork the **invoice's versioned** artefact; first real capability token (TM-AD-10/12/13) | ⚠ needs the signature-library decision (TM-OD-06) |
| Tasks | ✅ | One `WorkItem`, `kind` discriminated (TM-AD-06) | ✅ |
| Milestones | ✅ | Same entity; `parentId` self-reference, depth ≤ 3 | ✅ |
| Targets | ✅ | Same entity; progress accumulated, EOD delta is the only writer | ✅ |
| Calendar | ✅ | Month + week only. **No drag/drop, no hour grid** in v1 (TM-OD-08) | ✅ |
| Today's Tasks | ✅ | Lines **become work items**; submit-once (TM-AD-09) | ✅ |
| EOD Report | ✅ | Pre-filled from the plan; hours **read**, never typed | ✅ |
| Performance Dashboard | ✅ | "Needs attention" first. **No performance score** (TM-OD-11) | ✅ |
| Permissions | ✅ | 5 module keys; new verbs per module; the **self rule** (TM-BR-02) | ⚠ needs the scope decision (TM-OD-01) |
| Data Architecture | ✅ | 13 new entities; `TeamProfile` beside `CustomUser`, never inside it | ⚠ verify against the **deployed** backend (TM-R-02) |

### 12.2 Open questions — need your answer

| ID | Question | My recommendation |
| --- | --- | --- |
| **TM-OD-01** | Does a senior see **their reports** or **everyone**? v1 has no `own\|team\|all` scope axis. | Ship v1 binary (self vs all-who-hold-the-verb), capture `reportsTo` from day one, add the axis in v2. Building it now delays every screen. |
| **TM-OD-02** | Split `team.status` (currently gates *Delete member*) into `status` + `delete`? | **Yes.** It is a live wart; fix it while we are in the file. |
| **TM-OD-03** | Standard working hours — per member, per role, or one company default? | **Per member**, defaulted from a company setting. Contractors and interns differ. |
| **TM-OD-04** | Late threshold and grace period? | `dayStartsAt` 09:30, `graceMinutes` 15, both editable per member. |
| **TM-OD-05** | Who may correct an attendance record — admin only, or a reporting senior? | **Admin only** in v1 (`attendance.correct`). Amending a time record is the one action that rewrites history. |
| **TM-OD-06** | Signature: typed only, drawn only, or both? Which library? | **Both**, typed first in tab order. `signature_pad` (~7 KB, no deps) or ~80 lines of pointer-event canvas. Prefer the 80 lines — one fewer dependency. |
| **TM-OD-07** | Offer-letter link expiry? | **7 days**, matching the quotation precedent, extendable by re-minting. |
| **TM-OD-08** | Drag-and-drop on the calendar? | **Not in v1.** Reschedule is a field. A silent drag leaves no reason, and the keyboard equivalent must be built regardless. |
| **TM-OD-09** | Do tasks link to deals / enquiries / businesses? | **Not in v1.** A `sourceType`/`sourceId` pair is reserved in the schema so it is additive later. |
| **TM-OD-10** | Is the EOD report mandatory — can it block anything? | **No.** It surfaces as missing; it never blocks. A forced report is a fabricated one. |
| **TM-OD-11** | A computed performance score / ranking? | **No.** Show the numbers, sort by any column. Any score would be wrong for half the roles. |
| **TM-OD-12** | Notifications — who is told what, on which channel? | v1 is **in-app only** (the existing `Notification` model + the badge counts). Email only for the offer letter. No WhatsApp/SMS — the templates need approval and there is no queue. |
| **TM-OD-13** | Leave / holidays / weekends? | **Out of v1.** Absent is derived only on configured working days; a company holiday list is the smallest v1.1. |
| **TM-OD-14** | Salary slips uploaded or generated? | **Uploaded** (TM-AD-11). Generation means owning payroll, and Finance is mid-redesign around salary accounts right now. |
| **TM-OD-15** | Does the member dashboard live at `/team/me` or a separate `/my-day` route? | `/team/me` — one component, one URL scheme, no second screen to drift. |
| **TM-OD-16** | Should `Roles` move into the Team group, or stay in Settings? | **Move it.** The brief asks for Members + Roles under Team, and a Settings group of Audit + Design still stands. |
| **TM-OD-17** | Retention — how long are attendance rows and daily reports kept? | Indefinite in v1; flagged because it is a data-protection question, not an engineering one. |
| **TM-OD-18** | Can a member edit a submitted plan or EOD before end of day? | **No edit; append.** Change the work items instead. Cheapest correct answer. |
| **TM-OD-19** | Does an accepted offer letter auto-activate the member's account? | **No.** Acceptance is the candidate's act; activation is the admin's. It surfaces as a prompt. |

### 12.3 Risks

| ID | Risk | Severity | Mitigation |
| --- | --- | --- | --- |
| **TM-R-01** | `GET /admin/users/` returns **only self-created members**. Every team-wide screen depends on an "everyone" endpoint that does not exist. | **High — blocking** | Backend work in Phase B, before C/D/F have anything to render. Confirm first. |
| **TM-R-02** | The backend checkout on disk is **stale** — no `interior_deals_billing`, no action-based RBAC, stops at migration 0018. Every server estimate here is against a contract inferred from the client. | **High** | Verify against the deployed backend before Phase B is scoped. |
| **TM-R-03** | `PROTO_MODULES` grants a key to **every signed-in account**. Three new keys go in temporarily. | **High** | Only while seeds are client-side; each key is removed **in the same commit** as its endpoint. Tracked in `BACKEND-INTEGRATION.md` as work, not design. |
| **TM-R-04** | Every existing S3 upload is a **public URL** — there is no signed-read anywhere in the backend. Slips and signatures must not inherit this. | **High** | Private objects + the new `DocumentToken` for reads. Do not reuse the public `fileUrl` return. |
| **TM-R-05** | The public acceptance endpoint is a **new unauthenticated write surface** on a legal record, and the project has no throttle class at all. | **High** | Hashed token, expiry, single-use-on-accept, revocation, per-token + per-IP limits, `attemptCount`. |
| **TM-R-06** | No queue and no PDF library. Emails are best-effort threads; documents are browser-printed HTML. | **Medium** | v1 sends one email on offer-send and one on accept, both best-effort with a visible retry. Slips are uploaded, not generated. |
| **TM-R-07** | The calendar is the largest net-new UI in the panel and has **zero precedent** in either repo. | **Medium** | Month view first, behind the existing `ViewBand`; week view only after month ships. Fork `DateRange.tsx`'s mechanics. |
| **TM-R-08** | Concurrent Finance work on shared files (`admin-theme.css`, `package.json`, the three proto docs). | **Medium** | §9.4. New CSS file; append-only doc edits; one-line dependency commit. |
| **TM-R-09** | `interior_cms.TeamMember` and `interior_engine.BusinessTeamMember` already exist and mean different things. | **Low** | `TeamProfile`, with its own `db_table`. Never the name `TeamMember`. |

### 12.4 Dependencies

**Blocking (external):** an "everyone" members endpoint (TM-R-01) · confirmation of the
deployed backend's RBAC contract (TM-R-02) · `Module`/`ModuleAction` rows for three new
keys · private S3 objects + signed reads.
**Non-blocking (nice to have):** `AuthTasks.LogoutUser` writing `revokedAt` (2 lines,
makes login evidence complete) · `DELETE /roles/` being wired · a real task queue.
**New third-party:** at most one — signature capture (TM-OD-06), and possibly none.

### 12.5 Reuse vs build — the short version

**Reused unchanged:** the entire shell, `can()`/session, `ActionMatrix` and all of
`teamShared.tsx`, ~30 UI primitives, all four charts, the CSV export kit, `DocPage` +
`printHtml` + `ShareLine`, the freeze-on-issue and versioned-artefact patterns, the JSON
seed convention, the audit log. **Full list at §1.4.**

**Built new:** 13 data entities · 5 module keys' worth of permission surface · the
calendar · the clock and duration components · signature capture · the public page and
its token · `WeekBars`, `ProgressRing`, `Board`, `DayTimeline`, `ConfirmModal`,
sortable headers, row selection, a shared pager. **Full list at §1.4.**

### 12.6 What needs your approval before Phase A

1. **TM-AD-01** — Team as a top-level sidebar group, and `Roles` moving into it.
2. **TM-AD-02** — five module keys rather than one `team` key.
3. **TM-AD-03** — attendance as a separate work clock, not the auth session.
4. **TM-AD-06** — one `WorkItem` for tasks, milestones and targets.
5. **TM-AD-11** — salary slips uploaded, not generated, in v1.
6. **TM-OD-01** — the scope question: binary in v1, or build `own|team|all` now.
7. The **v1 exclusions**: drag/drop, hour grid, leave/holidays, deal linkage, performance
   scoring, WhatsApp/SMS, generated slips.

### 12.7 Suggested next steps, in roadmap order

1. **Answer TM-OD-01 and TM-OD-14** — they are the only two that change the plan's shape.
2. **Confirm the deployed backend** (TM-R-02) — everything server-side is currently
   inferred from the client.
3. **Start the "everyone" endpoint and the module-row migration now** (TM-R-01, §11.3
   track 3) — they are deploys with lead time and they block Phase B and Phase J.
4. **Approve, then run Phase A** — one commit, no risk, and it unblocks four tracks.
5. **Fork track 2 (offer letter) immediately after Phase B** — it is genuinely
   independent and it is the longest single piece.
6. **Beyond this module:** the `own|team|all` scope axis is the project's own flagged
   next step and it is not Team's alone — Deals already answers "is this deal yours"
   with a private `inScope` check. Whoever builds it should build it once, in the
   permission layer, for both.

---

## 13. Decisions taken — 2026-08-30, after review

Two open decisions were answered and Phase A was authorised. Recorded here rather
than by editing the sections above, so the reasoning that produced the original
recommendation stays readable next to the answer that overruled it.

### 13.1 TM-OD-01 — answered: **senior sees their own reports only**

Supersedes the binary self-vs-everyone rule in §6.3. **TM-BR-02 is revised:**

| Scope | Who is in it | What grants it |
| --- | --- | --- |
| **self** | the signed-in member's own records | nothing — always available |
| **team** | the members whose `TeamProfile.reportsTo` points at the viewer | the module's `view` / `review` verb |
| **all** | everybody | `isFullAccess`, or the module's new **`all`** verb |

`attendance`, `work` and `reports` each gain an **`all`** verb. So a team lead holding
`work.review` sees their own reports and no further; an operations head holding
`work.review` + `work.all` sees the company.

**Why this shape rather than a scope column on the grant.** The prototype's own note
proposes `own | team | all` as a *dimension added to every permission* — a third axis
on the matrix, a wider grid, and a migration on the grant table. The same answer is
reachable with one extra verb per module and one column that was already in the data
model (`reportsTo`, captured from day one in §7.2). The grid stays two-dimensional and
readable, the matrix editor needs no change at all, and nothing about it forecloses the
full axis later — an `all` verb is exactly what `scope=all` would compile down to.

**Reporting depth is one level in v1.** A head whose reports have their own reports
sees the first ring, not the transitive closure. A recursive default is a permission
that silently widens every time somebody is hired under someone else, and nobody
notices until it has. Deeper visibility is `all`, granted on purpose.

**Consequences:** every list read in the module is scoped, not filtered on the client;
the Performance view's "needs attention" counts are counts *within scope*, and say so
on screen; a member with no reports and no `all` verb sees a Reports face containing
only themselves, which is correct and must not read as an error.

### 13.2 TM-OD-14 — answered: **generated. And Finance already generates it.**

Supersedes **TM-AD-11** ("uploaded, not generated") entirely.

Checking before building found that the answer already exists in the codebase being
written in the next terminal. `src/admin/views/Finance/types.ts` defines
`SalaryComponent`, **`SalaryAccount`** (`memberId` "joins `AdminUserRow.id` from the
live Team endpoint"), **`Payslip`** and **`SalaryRun`** — with the earnings and
deductions **frozen onto the slip at issue** rather than read live off the account, so
*"a raise granted after the run opened must not be able to reach back into this slip."*
The Finance operation doc states the goal in its own words: *"salary accounts attached
to real team members with a printable slip."*

**So Team does not generate slips. Team reads them.** The Documents tab lists a
member's `Payslip` rows by `memberId` and links each one; issuing, computing and
rendering stay in Finance, which owns money and already owns the freeze.

**Why this is the better reading of "generated", not a dodge.** Two engines generating
one slip is the precise failure the plans catalogue already taught this project — a
second source of truth for one number, which disagrees the first time either side
changes. It also removes three problems the upload answer had accepted and the
generate-it-ourselves answer would have created: no PDF library is needed (Finance
renders an HTML sheet the browser prints, as Quotations does), Team never holds
gross/deductions/tax, and there is exactly one place a slip can be wrong.

**Consequences:**
- `MemberDocument` (§7.2) **loses its `salary_slip` kind** and keeps `id_proof`, `pan`,
  `address`, `other`. Its unique constraint on `(member, kind, periodMonth)` goes with it.
- Phase J's document work shrinks; a **read of Finance's payslip list by member** takes
  its place, and becomes this module's second cross-module read after the Team list.
- The capability-token work (TM-AD-12) stays, unchanged and still needed — the offer
  letter needs it, and Finance's slip links should use it rather than a public S3 URL
  (TM-R-04 applies to both modules).
- **A dependency Finance does not know about yet:** its slip link is the thing a member
  clicks in Team. Worth one message to that session before either side ships.

### 13.3 Correction — the order inside the Team group

§3.1's wireframe showed `Members · Attendance · Work · Reports · Roles`. What the
sidebar actually composes to is **`Members · Roles · Attendance · Work · Reports`**,
because server rows are placed before client-side proto rows and `roles` is a server
row. Verified, not assumed — `scripts/check-team-nav.cjs` asserts it.

Left as-is rather than engineered around. It matches the brief's own words ("Inside
Team: Members, Roles"), it groups the two identity screens before the three
operational ones, and the alternative is a per-item ordering mechanism that would
exist purely for cosmetics.

### 13.4 Phase A — executed

Authorised and shipped in the same review. Four files, no backend, no database.
See the CHANGELOG entry of the same date for what changed and what it is verified by.

**Still awaiting approval:** the remaining five items of §12.6 — TM-AD-02 (five module
keys, now six with `reports`), TM-AD-03 (attendance as a work clock), TM-AD-06 (one
`WorkItem`), and the v1 exclusion list. Phase B does not start without them.

