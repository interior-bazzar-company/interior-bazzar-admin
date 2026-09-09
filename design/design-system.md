# The Interior bazzar Admin design system

**Status: rebuilt 2026-09-09 on Untitled UI React.** One design system, one component
language, one visual language, two themes.

| | |
| --- | --- |
| Foundation | **Untitled UI React** — Tailwind CSS 4 + React Aria Components, the components copied into `src/components` by their CLI (0.1.64) and never edited |
| Palette | **Black, white and neutral grey** build the interface; **forest green** (`#14704e`) is the brand and is spent, not poured |
| Themes | `light` and `dark` — one preference (`ib_admin_theme`: light · dark · system), painted as `data-theme` and the `dark-mode` class on `<html>` |
| Tokens | `src/styles/theme.css` (Untitled UI's, verbatim) + `src/styles/brand.css` (every decision the panel makes). Nothing else may hold a colour |
| Type | **Inter** for everything read · **JetBrains Mono** for everything counted |
| Icons | `@untitledui/icons`, through `Icon name="…"` (`src/admin/ui/icon.tsx`) |
| Composition | `src/admin/ui/*` — the parts every screen is made of; the contract is `COMPONENT-CONTRACT.md` |
| Charts | recharts, on `--color-chart-*` |

### What this replaced

The panel ran on a hand-written system ("Ink & Signal"): 4,600 lines of component CSS,
nine module stylesheets (5,300 lines), ninety hand-drawn icons, hand-rolled charts, and
~60 React primitives emitting those classes — one author's system, with no library under it.
It is gone: `tokens.css`, `admin-theme.css`, every module `.css`, `charts.css`, the icon map,
the legacy overlay/context layer and the Lottie loader. In their place is a library with a
community and a release cadence, a brand layer of ~300 lines, and a composition layer whose
export names the views already used — which is how 150 view files kept compiling through the
migration.

### The guards that keep it true

| `npm run …` | Asserts |
| --- | --- |
| `check:tokens` | every `var(--x)` the panel reads is defined in Tailwind's theme, `theme.css`, `brand.css` or `globals.css` |
| `check:contrast` | **84 colour pairs** — read out of the real token sheets, Tailwind's oklch palette included — clear 4.5:1 for text and 3:1 for an operable edge, in **both** themes |
| `check:dupes` | one place for stylesheets (`src/styles`), one for colour (the two token sheets), no inline design values in a view, none of the retired class vocabulary |
| `check:menu` | drives the real shell in a real browser: the theme switch writes the attribute and the class, repaints, persists, survives a reload, follows the OS under "System" |
| `shots` | photographs every shared part in both themes, plus the modal and the drawer |
| `shoot-modules` | boots the real shell and photographs **all 20 routes in both themes**, failing if any rendered the error boundary |

---

## 1. Principles

The sentence the panel has to earn:

> "I know where I am, what is happening, what needs me, and what to do next."

1. **Structure explains; text does not.** Position, grouping and hierarchy carry meaning. Prose
   is the fallback, behind an ⓘ, never permanent furniture.
2. **State has a shape.** A status is a rounded badge with a dot; a label a person typed is
   square; the filter chip alone wears the brand. Colour is the second signal, never the only one.
3. **One accent, spent on the live thing.** Forest marks the primary action, the current row, the
   selected tab, the focus ring, the checked box, series one. Everything else is neutral.
4. **Numbers are monospaced, tabular and right-aligned.** A column of figures compares by eye.
5. **Say when a number is derived.** Computed, seeded and simulated values are labelled where
   they are shown, with the clock they ran on.
6. **High information value, low visual noise.** A CRM is read at arm's length across a forty-row
   table: 14px body, 36px controls, 40px rows, hairline edges, one shadow level for a resting card.

### The character budget — "subtly futuristic"

Five devices, and only these. Anywhere else it becomes a game UI.

| Device | Utility | Where |
| --- | --- | --- |
| The tracked mono micro-label | `label-mono` | metric names, column heads, section keys, clock stamps. 11px JetBrains Mono, uppercase by the type system, tracked 0.08em |
| Corner ticks | `ticks` | instrument surfaces only — a KPI tile, a chart frame. Never rows, inputs or menus |
| Tabular figures | `tnum` / `font-mono` | every figure, id and timestamp |
| The inner sheen | `sheen` | how dark mode says "raised" — a 1px inner highlight a dark ground can show where a shadow cannot |
| The nav glow | `--nav-active-glow` | the active sidebar row, dark only, the one place the dark theme glows |

**Explicitly out:** neon, scanlines, glassmorphism, animated backgrounds, gradient headings,
pill-shaped buttons, decorative icons, cards that exist to fill a grid cell.

---

## 2. Colour

Three layers, and only the top one is the panel's to decide.

```
Tailwind's palette      --color-neutral-* · green · yellow · red · blue · indigo · sky … (oklch)
Untitled UI's theme     --color-bg-* · text-* · fg-* · border-* · utility-*  (light block + .dark-mode block)
brand.css               the forest ramp · the type faces · the chart slots · the tokens the
                        library does not name · the dark planes · the contrast fixes
```

### 2.1 The two rules the palette turns on

1. **The interface is neutral.** `bg-secondary` (neutral-50) is the ground, `bg-primary` (white)
   the plane, text runs `text-primary` › `secondary` › `tertiary` › `quaternary` down a true
   grey with no hue bias.
2. **Brand is forest, and it is a thread.** `bg-brand-solid` is the primary button and nothing
   else that fills; `bg-selected` (brand-50) is the active nav row and the selected row;
   `text-brand-secondary` is a link and the current thing; `ring-brand` is focus and selection;
   `--color-chart-1` is series one. **No status is ever the brand** — success is Tailwind's green,
   warning its yellow, error its red, info its blue.

### 2.2 The forest ramp

```
25 #f4faf7  50 #ecf7f1  100 #d3ede0  200 #a9dcc3  300 #74c39f  400 #43a67d
500 #218a62  600 #14704e  700 #0f5a3f  800 #0e4834  900 #0d3b2c  950 #06231a
```

600 is the solid (white on it 6.07:1); 700 is legible as link text on white (5.3:1); 300/400
are the dark-theme brand for the same reason in reverse.

### 2.3 Dark is designed, not inverted

| | Light | Dark |
| --- | --- | --- |
| Ground `bg-secondary` | neutral-50 | neutral-950 |
| Plane `bg-primary` | white | **neutral-900 — lighter than the ground.** That is how a dark surface says "raised" |
| Brand text | brand-700 | brand-300 / 400 |
| Primary button | brand-600 | brand-600 (white on brand-500 measured 4.3) |
| Soft status grounds | the 50 steps | re-mixed near-black (`#0c2418` `#2a1c07` `#2b1210`), not the 950 slabs |
| Placeholder | neutral-500 | neutral-400 (neutral-500 on the plane measured 3.8) |
| Elevation | shadows | shadows deepened + `sheen` |

### 2.4 Contrast decisions made by measurement

`check:contrast` parses the sheets rather than a copy of the palette, so these are what ships:

- **Status text on its soft ground** uses the 700 steps (`text-success-primary` = green-700…):
  the library's 600s measured 3.1 / 2.8 / 4.4 on the 50 grounds.
- **A resting icon** (`text-fg-quaternary`) is neutral-500, not the library's neutral-400 (2.6:1
  on white): an icon-only control is a UI component and wants the 3:1 floor.
- **The operable edge** `border-control` / `ring-control` is neutral-500 (4.7:1). `border-primary`
  (neutral-300, 1.5:1) stays the hairline that groups; it never identifies a control on its own.

### 2.5 Data-vis tokens

```
--color-chart-1        forest — series one is almost always "ours"
--color-chart-2..8     muted identities: blue · orange · violet · teal · pink · lime · slate
--color-chart-seq-1..5 the forest ramp — magnitude is the panel's own measurement
--color-chart-pos/neg  green-600 / red-600 — the one place colour encodes sign
--color-chart-grid/axis
```

Slots are assigned in fixed order and never cycled. A chart reads them as `fill-chart-1` /
`stroke-chart-1` / `bg-chart-seq-3`, so a chart is correct in both themes without knowing a
theme exists.

---

## 3. Typography

| Role | Face | Scale |
| --- | --- | --- |
| Interface | Inter (variable, `cv11 ss01 cv02` — open digits, a flat-topped 3) | `text-xs` 12 · `text-sm` 14 (body, cells, controls) · `text-md` 16 · `text-lg` 18 · `text-xl` 20 (record title) · `text-display-xs` 24 (page title, KPI figure) |
| Figures | JetBrains Mono | `font-mono tnum` — ids, money, timestamps, axes |
| Micro-label | JetBrains Mono | `label-mono` — 11px uppercase tracked; a metric NAME, never a sentence |

Weights: 400 body · 500 labels, cells, figures · 600 headings, buttons · 700 nowhere but a KPI.
Body copy never goes below 12px; the micro-label is the only 11.

---

## 4. Space, shape, elevation, motion

- **Spacing** — Tailwind's 4px scale. Between controls `gap-2`; inside a card `p-4`/`p-5`;
  between page bands `gap-4`; between sections `gap-6`. The shell pads the page 16 → 24 → 32.
- **Radius** — `rounded-md` 6 (menu rows, small chips) · `rounded-lg` 8 (every control) ·
  `rounded-xl` 12 (cards, tables, popovers) · `rounded-2xl` 16 (modals) · `rounded-full` only
  for status pills, avatars and dots. A pill-shaped button is a status pretending to be an action.
- **Control heights** — `xs` 32 (table rows, dense toolbars) · `sm` 36 (the default) · `md` 40 ·
  `lg` 44 (a form's submit, the door). A form is one height throughout.
- **Elevation** — flat + hairline for most of the product; `shadow-xs` a resting card;
  `shadow-lg` a popover; `shadow-xl` a modal and a drawer; never a shadow on a table row.
- **Focus** — a 2px ring in the brand, identical everywhere, never removed.
- **Motion** — 100ms hover/press, 150–200ms for anything that enters, transform/opacity only.
  A drawer slides from its own edge, a modal rises 2px, a toast enters from its corner. Under
  `prefers-reduced-motion` the final state renders immediately.

---

## 5. Layout and navigation

```
sidebar 264px (rail 64px, kept per browser) · topbar 56px · workspace max 1440px
lg ≥1024 sidebar on page · <lg sidebar is a slide-over behind the menu button
```

- **Groups by the work**: Overview · Sales · Business Ops · Team · Resources · Finance ·
  Catalogue · Settings — the server's `groupLabel`, ordered by `shell/modules.ts`.
- **Active is three signals**: the brand tint, a 2px left bar, brand text (plus the glow in
  dark) — it survives both themes and a screenshot.
- **Topbar** carries the crumb (group › module, or the module title as the way up on a record),
  the page's own control slot (`usePageChrome({ right })`), search (⌘K) and the activity bell.
  Page actions belong to the page header, never the topbar.
- **A module a role cannot open is absent, not disabled.**

---

## 6. The parts

Full contract in `COMPONENT-CONTRACT.md`. In one line each:

**Actions** `Button` (primary · secondary · tertiary · link · destructive; xs/sm/md/lg) ·
`IconButton` (tooltip built in) · `Segmented` · `MoreMenu`.
**Fields** `FormSection` › `FieldRow` › `FormField` › `Input` · `Textarea` · `SelectInput` ·
`InputGroup` · `Checkbox` · `Radio` · `Toggle` · `DateInput` · `DateRange` · `MultiSelect` ·
`ChipInput` · `FileUpload` · `SearchField`; the filter `Select` (options carry a dot, a badge or a
chip).
**Status** `Pill` (+ `LeadStatus`, `DealStatus`, `Priority`) · `Tag`/`Tags` · `FilterChips` ·
`Pipeline` · `Meter` · `Delta` · `Assignee`.
**Data** `Table` · `ListTable` + `Rail` · `StatStrip` · `FilterBar` · `Pagination` · `Tabs` ·
`KvList` · `EmptyState` · `ListSkeleton` · `PaneLoading` · `LinkChip`.
**Page** `PageHeader` · `SectionHead` · `Card` · `Tile`/`Tiles` · `Eyebrow` · `Breadcrumbs`.
**Overlay** `ModalShell` · `ConfirmModal` · `DrawerShell` · `Tooltip` · `InfoDot` · `Alert`;
the shell's `useShell().modal / drawer / toast / banner / openPop`.
**People & time** `Avatar` · `Person` · `Timeline` · `ActivityFeed`.
**Charts** `ColumnChart` · `Waterfall` · `SignedColumns` · `Spark` · `FunnelChart` · `BarRows` ·
`CohortHeat`, in a `ChartFrame`.

### Where a part lives

| Layer | Path | Edit? |
| --- | --- | --- |
| Library | `src/components/{base,application,foundations,shared-assets}` | Never (four documented patches for the panel's stricter TypeScript: unused `React` imports in `button.tsx` and `pagination-base.tsx`; the RAC 1.21 `onChange` shape in `date-picker/calendar.tsx`) |
| Composition | `src/admin/ui/*` | The main session only; a module may not add a shared part |
| Module-local drawings | `src/admin/views/<module>/bits.tsx` | The module — a kanban card, a calendar cell, the paper document, the lifecycle dot ramp |

---

## 7. Page patterns

Every page is the same reading order, adapted, not forced:

```
PageHeader   title · meta (count, clock stamp) · ONE primary action · tabs
FilterBar    search · selects · view switch · the chips row when anything narrows
StatStrip    the counts, each the filter for itself; money as a read-out
Content      the right pattern for the data
Pagination
```

| Data's job | Pattern |
| --- | --- |
| Records to work through | `ListTable`: exception rail in column one, the primary cell with its secondary line, figures right-aligned, a `MoreMenu` at the row's end |
| Stages of work | Kanban: scrolling stage columns, cards with the entity, its owner, its value, its tags |
| Time | A month grid of day cells; a timeline of lanes and bars |
| A conversation | List pane · thread on the warm `bg-chat` ground · context pane; the composer at the bottom |
| A record | Header card (identity, status pills, `Pipeline`, `MoreMenu`) › `Tabs` › two columns on `lg`: facts (`KvList`) and history (`Timeline`) |
| A quick look | `DrawerShell` beside the list it came from |
| A decision | `ModalShell` (≤ 8 fields) with `FormSection`s; `ConfirmModal` names the record, states the consequence, repeats the verb |
| A document | Paper: a fixed A4 measure on explicit `bg-white text-neutral-900` — it must not go dark — with `print:` variants |
| A dashboard | KPI `Tiles` → one trend chart + one ranking → the attention list → operations |

### Dashboards answer, in order

1. Is anything wrong? — the attention list, ranked by severity then money, one action each
2. How are we doing? — the KPI row, every figure with its comparison period
3. Which way is it going? — one trend chart
4. Where is it coming from? — one breakdown
5. Who or what exactly? — the table

A tile that filters the table below it earns its space; one that leads nowhere is a poster.
Withhold rather than mislead: a stale metric shows `—` and says why behind the ⓘ.

---

## 8. Responsive

| Width | Behaviour |
| --- | --- |
| ≥1280 | full sidebar, two-column record pages, tiles 4-up |
| 1024–1279 | sidebar collapses to the rail; tiles 3-up |
| 768–1023 | sidebar is a slide-over; page header actions stack; two panes become one with a `Tabs` row; tiles 2-up |
| <768 | tables scroll inside their frame; stat strips scroll; filter rows wrap; drawers full-width; modals bottom-sheet; tiles 1-up |

Nothing scrolls the body horizontally. `useBreakpoint` is the only JS breakpoint reader.

---

## 9. Accessibility

- Every control is React Aria's: keyboard-complete, announced, focus-managed. Modals trap
  focus and restore it; drawers and popovers dismiss on Escape; menus and listboxes take the
  arrow keys.
- A skip link is first in the tab order on every screen.
- Every icon-only control carries a label (`IconButton label=…`); every field a `<label>`.
- Status is never colour alone — the dot and the word travel together.
- Contrast is measured, not assumed: 84 pairs in both themes, `check:contrast`.
- `prefers-reduced-motion` renders final states immediately.

---

## 10. Working on it

- **Read `COMPONENT-CONTRACT.md` before a view.** It is the working agreement.
- **A new shared part** is added to `src/admin/ui`, exported from `index.tsx`, shown in the
  appearance gallery (`scripts/appearance-entry.tsx`) and photographed (`npm run shots`) the
  same day.
- **A token** is added to `brand.css` twice: the `--color-*` value, and its
  property-namespaced utility name (`--background-color-*`, `--text-color-*`, `--border-color-*`,
  `--ring-color-*`) so `bg-x` / `text-x` / `border-x` / `ring-x` read like the library's.
- **Upgrading the library** is `npx untitledui@latest add <component> --overwrite` into
  `src/components`, then re-applying the four patches above and re-running the gates.
- **Log every change** in `src/proto/v-2.2.0.0/CHANGELOG.md`.
