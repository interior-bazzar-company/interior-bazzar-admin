# Users Management — audit register (2026-08-29)

Four read-only audits over `src/admin/views/Users/**`, its content JSON, checks
and docs: logic & API seams · screens & journeys · theme · contracts & coverage.
**Fixed** = changed in the same day's commit (see CHANGELOG). **Open** = left
for the API work or a product decision. Line numbers are pre-fix.

## 1 · Logic (store.ts) — 14 confirmed, all fixed; 3 suspected

| # | Finding | Root cause | Status |
|---|---|---|---|
| B1 | Renewing an Active Member demoted them to Past Member and dropped them from the queue | `currentTerm` = newest-start row; `classify` read only it; a renewal starts in the future | **Fixed** — any entitling term classifies; the held term leads |
| B2 | Assigning a second product dated ahead did the same | same | **Fixed** |
| B3 | One-live-term-per-product enforced only at assignment; two pending terms could both activate; renew could raise a duplicate | no `clashFor` in activate/renew | **Fixed** — `409 active_membership_conflict` at both doors |
| B4 | Seeded Pending term could never be activated from the UI | no `pendingFeatures` on the seed | **Fixed** — seed carries them; activation falls back to an existing snapshot |
| B5 | `activateNow` created a Pending term then errored | activation guard ran after the insert | **Fixed** — refused before any write |
| B6 | `activeMembershipId` wrong with two products | hand-set to the acted-on term | **Fixed** — derived pointer |
| B7 | Two clocks: writes on wall clock, derivation on `asOf` → "in 4 days" on the timeline | `new Date()` in writes | **Fixed** — `stamp()` = NOW + elapsed |
| B8 | Renewal started at the old `endAt` second and drifted on month arithmetic | `setMonth` on 23:59:59 | **Fixed** — day-after 00:00 → day-before 23:59:59 |
| B9 | Renewal copied the previous term's payment reference | `...m` spread | **Fixed** — renew takes its own reference (required) |
| B10 | `updateProfile` accepted `profileId`/`profileStatus`; whitespace counted as 100% complete; hidden profiles republished | no key allow-list, no trim | **Fixed** |
| B11 | `validateFacets` threw on a row without `cities` | no normalisation | **Fixed** |
| B12 | `setTags` accepted unknown slugs | no vocab check | **Fixed** |
| B13 | "This year" = last 366 days | window table | **Fixed** — calendar year |
| B14 | Lapsed paused/suspended terms classified forever; lapsed active still offered pause | status-only checks | **Fixed** — `effectiveStatus` |
| B16 | `rangeTotals` would throw on a month missing a plan/source key | direct index | **Fixed** — guarded |
| B17 | Reactivate offered *pause* reasons | wrong vocab | **Fixed** — free text |
| B15 | Under pause policy `continue`, a paused term inside the window is not in the queue | design | **Open** — UM-OD-04 |

## 2 · Journeys — 52 findings, 20 fixed

Fixed: Escape in picker/ⓘ closing the dialog · "[Cancel] [Cancel]" · Commercial → term link · filter reset on chip clear (Users, Members, Renewals) · queue rows carry queue state · chip row on Renewals · keyboard-openable rows (list, queue, history) · focus on ✕ and unnamed ✕ · live required-field marking + footer note · unsaved-changes guard (Edit, Assign) · "Copied" over an empty clipboard · "Reactivate/Deactivate account" · Back label follows the face you came from · `term` cleared on tab switch · renewal notice on Membership tab · audit empty state · Assign steps 1-2-3 · start from `NOW` · Plans link · reason cleared on source change · activate-now refused by the button on a feature-less plan · "New term" → "Renew" · renew strip "Active → Active" removed · toast copy.

Open (ordered by value): irreversible-action confirm on cancel/suspend (#34) · `lifecycle` permission gate vs "restricted authority" copy (#35) · custom registered-range chip shows no dates (#4) · pager count in the strip (#5) · Tabs lack `role=tablist` (shell, #13) · duplicate DOM ids in AreaRows pickers (`useId`, #22) · legend "Target" → "Target areas" (#23) · Identity block last (#24) · complimentary "Approved by" field (#29) · queue "all clear" state (#42) · Analytics: redundant nav buttons (#44), empty-data state (#45), DateRange focus return (#46), BarRows aria (#47), delta window label (#48), Definitions table scroll (#49) · audit "—" fallback (#51).

## 3 · Theme — 10 edits applied

Applied: chart s3/s2 off the status solids · heat-cell ink per step · plan tiers on tag tones · notes rule neutral · one inactive grey · chip base neutral, un-tint overrides removed · check/opt highlight one version · i-button neutral + token size · assign summary neutral, `!important` removed · dead/restated rules deleted.

Open: `.um-views` ≈ `.tabs` duplicate · capsule heights 18/22/26 · square-button sizes 16/20/22/26 · chart slots as ramp tokens · `--text-2xs` on running data (12 uses) · `.um-date` vs `.inp`.

## 4 · Contract — what the API must know

- **Prefix:** `v1/admin/users/` is taken (RBAC sub-admins). Use `/admin/platform-users/`.
- **Reads:** list (with `asOf`, server-side derived `cls`, `counts` over the filtered set), record, memberships (with `pausePolicy`, `pendingFeatures[]` on pending), timeline, vocabularies, analytics (month-keyed, `planLabels`), `username-available`.
- **Writes:** assign `{planId, cycleId, source, reference, reason, startAt, activateNow}` (atomic with activation); activate; pause/resume/suspend/reactivate/cancel `{reason}`; renew `{reference, reason?}`; profile PATCH (editable keys only); notes; tags `{tags[]}`; deactivate `{reason}`/reactivate.
- **New error codes:** `422 snapshot_unavailable`, `422 field_not_editable`.
- **Permission:** module row `users` with `view/create/edit/lifecycle`; `lifecycle` sensitive.
- **Client seam:** `store.ts` keeps `snap` as a cache and the pure functions; a `source.ts` interface (`LocalSource` today, `ApiSource` later) makes every hook/write async. Six dialogs already hold `busy` state.

## 5 · Checks — now covered / still not

Now: post-write classification (renew, future assign), activate/renew conflicts, atomic activate-now, renew source + dates, lapsed terms, non-editable keys, blank text, malformed area row, unknown tags, calendar year.

Still not: `applySort`/`paginate`, most filter parities, `useTimeline` merge order, `rangeTotals` arithmetic, audit-row emission per action, permission gating (session never set in the harness), real async `usePlans` (stubbed), seed coherence (ASSIGNED vs ACTIVATED counts).
