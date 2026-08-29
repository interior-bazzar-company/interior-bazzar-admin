# Changelog — proto v-2.2.0.0 (admin)

Newest first. One entry per feature. Format: [LOG-FORMAT.md](LOG-FORMAT.md).

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
