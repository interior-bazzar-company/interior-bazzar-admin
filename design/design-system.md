# Operations Console — design system

**Status:** specification. Nothing in this document is implemented yet.
**Live specimen:** https://claude.ai/code/artifact/05722dd5-a73a-46bd-8adc-cc1ba8e38124
— every token, component and chart below is rendered there, in both themes and both
densities. Read that first; this file is the written contract behind it.

---

## 1. Audit — what exists today

Measured on 2026-09-05 against `interior-bazzar-admin` @ `proto-2.3.0.0`.

| | |
| --- | --- |
| Framework | React 18 · TypeScript 5.8 · Vite 7 |
| Routing | react-router 7, one `ViewHost` keyed on the first URL segment |
| Styling | Hand-written CSS, no utility framework in use |
| Theming | `:root` + `prefers-color-scheme` (guarded) + `[data-theme]`, plus `[data-density="compact"]` |
| Primitives | `src/admin/ui/index.tsx` — Icon (33 inline paths), Pill, Tile, Field, Table, Tabs, StatStrip, EmptyState, ListSkeleton, Notice, MoreMenu, SearchField, Select, FilterChips |
| Shell | `AdminShell` + `ShellContext` (chrome published by the page) + `CommandPalette` + `modules.ts` registry |
| Charts | `src/admin/views/charts.tsx` — hand-rolled CSS kit: column, waterfall, signed columns, spark, funnel, bar rows, cohort heat. No chart library, deliberately |
| Modules | Enquiries · Deals · Quotations · Invoices · Finance · Team · Users · Plans · Roles · Audit |

### Sound, and kept

Three token layers; a working density mode; a collapsible rail; chrome published by the
page rather than owned by the shell; a chart kit whose palette was validated before it was
drawn. **This is a re-skin and a consolidation, not a rebuild.**

### Findings

1. **Two component systems.** `src/components/ui` (CSS modules, inherited from the public
   site) and `src/admin/ui` (tokens) both define Button, Input, Select.
2. **426 KB of CSS across six files** — `admin-theme.css` 193 KB plus per-module sheets:
   Finance 70, Enquiries 52, Team 49, Users 38, charts 21. A card in Finance and a card in
   Team are different code.
3. **40+ cryptic module prefixes** (`dws`, `dls`, `qd`, `tb`, `tgr`, `fn`, `tm`, `qvchip`…)
   with nothing marking which are shared and which are local.
4. **Seven ad-hoc breakpoints** — 1400, 1280, 1180, 900, 820, 720, 640 — chosen per file.
5. **Brand green also means "ok"**, so a green pill is ambiguous.
6. **Two page widths** (1180 / 1440) chosen per view rather than by content type.
7. **Dead weight** — `tailwindcss` installed and never imported; `recharts` reached only by
   a legacy chart nothing renders; `react-quill@0.0.2` is a stub package.

### Disposition

- **Keep** — token architecture, density mode, rail mode, chrome publishing, the CSS chart
  approach, Field / Table / Pill / EmptyState / MoreMenu, the command palette.
- **Standardise** — card, panel, toolbar, filter band, list row, status pill, KPI tile and
  every chart move into the shared layer under one prefix. Module sheets keep only what is
  genuinely local.
- **Retire** — `src/components/ui` once auth moves over, tailwind, recharts, react-quill,
  and the second page width.

---

## 2. Design philosophy

The sentence the portal has to earn:

> "I know where I am, what is happening, what needs me, and what to do next."

1. **Structure explains; text does not.** Position, grouping and hierarchy carry meaning.
   Prose is the fallback, behind an `i`, never permanent furniture.
2. **State has a shape.** Every status carries a dot, icon or stripe. Colour is the second
   signal, never the only one.
3. **One accent, spent on the live thing.** Primary marks what is current, selected or
   actionable. Everything else is slate.
4. **Density is a setting, not a style.** Comfortable and compact are one system at two
   scales; no screen is designed for only one.
5. **Numbers are monospaced and right-aligned.** A column of figures must compare by eye.
6. **Say when a number is derived.** Computed, seeded and simulated values are labelled
   where they are shown.

### The character budget

The "slightly futuristic" quality is spent on exactly five devices. Anywhere else, it
becomes a game UI.

| Device | Where |
| --- | --- |
| Corner ticks | Two 9px marks on instrument surfaces — KPI tile, chart frame, panel. Never on rows, inputs or menus |
| The live accent | Cyan, reserved for "right now" — running session, open shift, streaming figure. Never a chart series, never a status |
| Tracked mono micro-labels | 10px uppercase, for metric names and column heads |
| Glow | Dark mode only, behind the active nav row and in the focus ring. Never on text, cards or buttons |
| 1px inner highlight | How dark mode says "raised", replacing a shadow a dark ground cannot show |

**Explicitly out:** neon, scanlines, glassmorphism, animated backgrounds, gradient
headings, pill-shaped everything, decorative icons, cards that exist to fill a grid cell.

---

## 3. Color

Three layers. **Only layer 2 is redefined per theme.** No component may name a layer-1 value.

### 3.1 Layer 1 — primitive ramps

```
Slate    1 #f7fafa   2 #eef2f3   3 #e4eaeb   4 #d7e0e1   5 #c4d0d2   6 #a9b9bc
         7 #8ea0a4   8 #788d93   9 #5d757c  10 #3a4c50  11 #27363a  12 #0c1618
Beacon   1 #f0faf8   2 #e0f5f0   3 #c2e9e1   4 #96d8cb   5 #5cc0ad   6 #1aa48a
         7 #00876c   8 #007863   9 #046052  10 #054a40  11 #2fd6b4  12 #062622
Live     2 #e2f6fb   3 #bee9f3   7 #0e8fb5   8 #0a6a86  11 #45dcf0
Pulse    2 #eceffb   3 #d8def6   5 #8b9bff   7 #4457c9   8 #33449f  11 #1e2a63
Green    2 #e8f5ec   3 #cde9d6   7 #1f7a44   9 #166035  11 #4fd07a
Amber    2 #fdf3e0   3 #f7e3bd   7 #a86a00   9 #8a5600  11 #e8a83c
Rust     2 #fdeee9   3 #f8d5c9   7 #c0492b   9 #9d3820  11 #ff8a63
```

Slate is biased green-cyan so it sits *under* the primary rather than fighting it. A pure
neutral grey reads as unconsidered.

### 3.2 Layer 2 — semantic tokens

| Token | Light | Dark | Use for | Never |
| --- | --- | --- | --- | --- |
| `--color-bg` | `#eef2f3` | `#080e11` | The plane behind panels | A card |
| `--color-surface` | `#ffffff` | `#111a1e` | Panels, rows, page content | Menus and modals |
| `--color-surface-raised` | `#ffffff` | `#17242a` | Menu, popover, modal, drawer, toast | Static content |
| `--color-surface-sunken` | `#e4eaeb` | `#0d161a` | Table head, input affix, code, modal footer | A disabled control |
| `--color-surface-nav` | `#e9eeef` | `#0b1316` | The sidebar | Anywhere else |
| `--color-text` | `#0c1618` | `#e8f1f2` | Values, titles, cells | Labels and captions |
| `--color-text-2` | `#3a4c50` | `#adc0c3` | Field labels, supporting copy | Anything below 12px |
| `--color-text-muted` | `#4e6469` | `#879ca0` | Column heads, meta, placeholders, axes | A value |
| `--color-text-disabled` | `#8ea0a4` | `#5f7378` | Text inside a disabled control | De-emphasis |
| `--color-text-inverse` | `#ffffff` | `#04191a` | Text on a solid primary fill | — |
| `--color-border` | `#d5dee0` | `#223136` | Hairlines, dividers | Input borders |
| `--color-border-strong` | `#c2cdd0` | `#2f4349` | Emphasised dividers, chart frames | — |
| `--color-border-control` | `#788d93` | `#5d757c` | The edge of anything operable | Decorative rules |
| `--color-primary` | `#007863` | `#2fd6b4` | Primary button, active nav, focus, selection | Success |
| `--color-primary-hover` | `#046052` | `#5ce3c8` | Primary button hover | — |
| `--color-primary-ink` | `#ffffff` | `#04191a` | Text on the primary fill | — |
| `--color-primary-text` | `#046052` | `#57ddc0` | Primary-coloured text and links | Large fills |
| `--color-primary-soft` | `#e0f5f0` | `#0d2f2a` | Selected row, active nav bg, filter chip | Large fills |
| `--color-primary-border` | `#96d8cb` | `#1c584e` | The edge of a selected thing | — |
| `--color-secondary` | `#4457c9` | `#8b9bff` | The system acted: automation, derivation, audit | A second brand colour |
| `--color-secondary-soft` | `#eceffb` | `#161c3a` | Background for the above | — |
| `--color-accent` | `#0e8fb5` | `#45dcf0` | **Live only** — running session, open shift | A chart series, a status, a button |
| `--color-accent-text` | `#0a6a86` | `#45dcf0` | Text on `--color-accent-soft` (the marker hue is 3:1, not 4.5:1) | — |
| `--color-accent-soft` | `#e2f6fb` | `#0a2b34` | Background for a live indicator | — |
| `--color-success` | `#166035` | `#4fd07a` | Paid, approved, present, target met | "Go" buttons |
| `--color-warning` | `#8a5600` | `#e8a83c` | Due, pending, unclosed, expiring | Anything unactionable |
| `--color-danger` | `#9d3820` | `#ff8a63` | Overdue, rejected, failed, destructive | Merely negative numbers |
| `--color-info` | `#1e2a63` | `#8b9bff` | Derived, automatic, informational | — |
| `--color-hover` | `#e4eaeb` | `#1a262b` | Hover background | A shadow instead |
| `--color-active` | `#d7e0e1` | `#213036` | Pressed background | — |
| `--color-selected` | `#e0f5f0` | `#0d2f2a` | The row you are on | Hover |
| `--color-focus` | `#007863` | `#2fd6b4` | The focus ring | Never removed |
| `--color-disabled-bg` | `#e4eaeb` | `#162126` | Disabled control background | — |
| `--color-tick` | `#8fa4a8` | `#4a636a` | Corner ticks (decorative) | Any control edge |

Each status colour also carries `-solid` (fill), `-soft` (background) and `-border`:

```
--color-success-solid #1f7a44 / #2f9e5a   --color-success-soft #e8f5ec / #0e2a1a   --color-success-border #cde9d6 / #1d4a30
--color-warning-solid #a86a00 / #b8801a   --color-warning-soft #fdf3e0 / #2c2008   --color-warning-border #f7e3bd / #553f10
--color-danger-solid  #c0492b / #c3512f   --color-danger-soft  #fdeee9 / #2e150f   --color-danger-border  #f8d5c9 / #57281c
--color-info-solid    #4457c9 / #5468d8   --color-info-soft    #eceffb / #161c3a   --color-info-border    #d8def6 / #2b3564
```

### 3.3 The one breaking change

**Primary and success are different hues now.** Today one green means brand, "ok" and
selection at once. Beacon owns brand and selection; green owns success only. This is the
change with the widest blast radius and the reason it is step 1 of the rollout.

### 3.4 Dark is designed, not inverted

1. The ground is `#080e11`, not black — a true black with white text vibrates over an
   eight-hour shift.
2. Elevation is a border plus a 1px inset white highlight at 4.5%, not a shadow.
3. Status colours get *lighter*, and their soft backgrounds are re-mixed against the dark
   surface rather than faded.
4. Chart hues are re-stepped into their own validated set.
5. Glow appears only behind the active nav row and in the focus ring.

### 3.5 Data-vis tokens

```
--chart-1..8   light  #00876c #4457c9 #a86a00 #b8367a #0b7fa8 #5d7a17 #8038cc #c0492b
--chart-1..8   dark   #0fa484 #6f82f0 #b47f18 #e05a97 #2496bf #7d9c26 #a874e0 #e05a37
--chart-seq-1..5  light  #e0f5f0 #96d8cb #1aa48a #00876c #046052
--chart-seq-1..5  dark   #0d2f2a #0e6455 #0fa484 #2fd6b4 #7ce8d0
--chart-pos / --chart-neg   green-7 / rust-7  (light)   green-11 / rust-11 (dark)
--chart-grid --chart-axis --chart-fill-opacity (.16)
```

Both categorical sets pass the six checks — lightness band, chroma floor, colour-vision
separation, normal-vision floor and 3:1 against their own surface — validated against
`#ffffff` (light) and `#111a1e` (dark). Slots are assigned in **fixed order and never
cycled**; a filter that drops a series does not repaint the survivors; a ninth series folds
into "Other". Status colours are reserved and are never available as a series.

---

## 4. Typography

| Role | Face | Notes |
| --- | --- | --- |
| Display | **Archivo** (variable width) | Page titles and KPI figures only. `wdth` 116–120 — an expanded grotesque reads as instrumentation |
| UI | **IBM Plex Sans** | Every control, label and cell. Legible at 12px |
| Data | **IBM Plex Mono** | Figures, IDs, axes, micro-labels. Same family, so numbers sit beside text without a seam |

Fallbacks: `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif` and
`ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`.

| Token | px | line | Job |
| --- | --- | --- | --- |
| `--font-4xl` | 38 | 44 | the one hero figure on a dashboard |
| `--font-3xl` | 29 | 34 | KPI value |
| `--font-2xl` | 23 | 30 | page title |
| `--font-xl` | 19 | 26 | section title |
| `--font-lg` | 16 | 24 | panel / modal heading |
| `--font-base` | 14 | 21 | body, inputs |
| `--font-md` | 13 | 18 | table cells, buttons, nav |
| `--font-sm` | 12 | 16 | captions, hints, legends |
| `--font-xs` | 11 | 16 | pills, meta |
| `--font-2xs` | 10 | 14 | tracked uppercase labels **only** |

Weights: 400 body · 500 numbers and mono · 600 labels, buttons, headings · 700 page titles
and KPI values. Tracking: `-0.02em` on display sizes, `0.12em` on 10px uppercase labels,
normal elsewhere. Body copy never goes below 12px.

---

## 5. Spacing

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64` (`--space-1…16`).

| Context | Value |
| --- | --- |
| Page padding | 32 (24 compact, 16 under 900px) |
| Between sections | 32 — the only vertical use of 32 |
| Panel padding | 20 (16 for a chart-only panel) |
| Grid gutter | 16 (12 between KPI tiles) |
| Form field gap | 16 · label to control 5 |
| Table cell padding | 12 horizontal — height is a token |
| Inline gap | 8 · icon to text 6 |
| Modal | body 20 · header 16 · footer 12 |

---

## 6. Shape

| Radius | Used by |
| --- | --- |
| `--radius-xs` 3 | checkbox, severity stripe, chart bar end, tag |
| `--radius-sm` 4 | menu item, small chip, skeleton |
| `--radius-md` 6 | **every control** — button, input, select, toolbar |
| `--radius-lg` 8 | panel, card, modal, drawer |
| `--radius-xl` 12 | the full-page empty-state frame only |
| `--radius-pill` | status pills, filter chips, avatars, toggles — things read, not operated |

Two radii on one element is a bug. A pill-shaped button is a status pretending to be an action.

---

## 7. Elevation, borders and focus

| Level | Light | Dark | Used by |
| --- | --- | --- | --- |
| 0 flat | border only | border only | panels, rows, the page — most of the product |
| 1 resting | `--shadow-sm` | `+ --surface-sheen` | sticky headers, toolbar over scrolled content |
| 2 floating | `--shadow-md` | `+ sheen`, surface steps to `#17242a` | tooltips, small popovers |
| 3 overlay | `--shadow-lg` | `+ sheen` | menus, modals, drawers, toasts |

```
--shadow-sm  light 0 1px 2px rgba(12,22,24,.06)              dark 0 1px 2px rgba(0,0,0,.44)
--shadow-md  light 0 2px 4px …,0 8px 20px rgba(12,22,24,.07) dark 0 2px 4px …,0 8px 20px rgba(0,0,0,.46)
--shadow-lg  light 0 4px 10px …,0 20px 48px rgba(12,22,24,.13) dark 0 4px 10px …,0 20px 48px rgba(0,0,0,.6)
--surface-sheen   light none                                 dark inset 0 1px 0 rgba(255,255,255,.045)
--nav-active-glow light none                                 dark -8px 0 18px -10px #2fd6b4
--focus-ring        0 0 0 3px rgba(0,120,99,.20)  /  rgba(47,214,180,.26)
--focus-ring-danger 0 0 0 3px rgba(192,73,43,.20) /  rgba(255,138,99,.24)
```

- **Focus** — a 3px ring plus a solid border on the control. Identical everywhere,
  including inside modals. Never removed.
- **Hover** — background changes, size never does.
- **Active** — 0.5px nudge down and one step darker, so a click feels received.
- Never use a shadow for table-row hover.

---

## 8. Layout

```
--layout-nav 248 · --layout-rail 56 · --layout-top 52 · --layout-context 320
--layout-row 40 · --layout-max 1440 · --layout-pad 32
--bp-sm 640 · --bp-md 900 · --bp-lg 1180 · --bp-xl 1440
```

Four breakpoints replace the seven in use today.

**Desktop (≥1180)** — sidebar 248 (collapsible to a 56px rail that expands on hover;
the rail keeps icons and the waiting-count dot), topbar 52, content capped at 1440, optional
320px context panel that holds detail about the selected row and never navigation or filters.

**Tablet (640–1180)** — sidebar defaults to the rail; the context panel becomes a drawer;
filters collapse to one "Filters (n)" button opening a drawer; the KPI row scrolls
horizontally rather than wrapping; tables drop secondary columns; charts keep their height.

**Mobile (<640)** — member surfaces only. Bottom bar with four destinations, never five.
Every table becomes a stacked card list — no horizontal scrolling of data. Controls promote
to 44px with 8px separation. An admin dashboard on a phone shows KPIs and a link, not a
shrunken chart wall.

**Page skeleton** (adapt, do not force):

```
Page
├── Page header — title · context/status · one primary action
├── Exceptions band   (analysis pages only)
├── Summary / KPI row
├── Filter band
├── Main content
└── Secondary information
```

---

## 9. Navigation

- **Group by the work**: Client ops · Money · Internal · Settings. Four groups; a group of
  one is a filing mistake.
- **A number means something is waiting on you. A dot means something changed.** A row with
  neither is just a place.
- **Active state is three signals at once** — 2px left bar, tinted background, primary text
  (plus the glow in dark) — so it survives both themes and a screenshot.
- **Never nest more than one level.** A third level is a page's own tabs.
- **A module a role cannot open is absent, not disabled.** A greyed nav row teaches people
  the product is broken.
- **Topbar** carries breadcrumb → the one control that changes what the page *is* → live
  counts → search (⌘K) → you. Page actions belong to the page header, not the topbar.
- **Breadcrumbs from depth two.** A directory page does not need one; a record's operation
  page does.

---

## 10. Component library

Full live specimens in the artifact. Contract summary:

**Buttons** — primary / secondary / tertiary / ghost / destructive / icon. Sizes sm 26 ·
md 32 (default, toolbars and rows) · lg 38 (form submit, page-header primary). One primary
per view. Loading keeps the label and adds a spinner. Icon-only requires `aria-label` **and**
a tooltip.

**Inputs** — text, number, search, password, date, time, date range, textarea, with prefix
or suffix affix, with trailing action. States: default, hover, focus, disabled, read-only
(dashed border, sunken), error, success. Label above and always visible; required marked
with a red asterisk on the label.

**Selection** — dropdown (sectioned, keyboard-hinted), multi-select with a filter field,
combobox, radio, checkbox (incl. indeterminate), toggle, segmented control, filter chips
with individual and bulk clear.

**Feedback** — alert (ok / warning / danger / info; icon + 3px left stripe + tone), toast
(bottom-right, 4s, one undo or retry action), inline field error and success, empty state,
skeleton, progress bar.

**Overlay** — modal (max 520px), confirmation modal (name the record in the title, the
consequence in one line, the verb repeated on the button; type-to-confirm only when the data
cannot be rebuilt), drawer (320–420px, from the edge it lives on), popover, tooltip, context
menu. Never stack two modals.

**Data** — table, KPI tile, pagination, filter band, sort and column controls, status pills,
progress bars, sparklines.

**Navigation** — tabs, breadcrumb, sidebar, topbar, stepper, pagination.

**Content** — card, section head, accordion, timeline / activity feed (person actions in
primary, system actions in secondary, failures in danger), avatar, badge, tag, user menu.

### The `i` affordance

A 16px hairline circle immediately after the label it explains. It opens a popover with a
short bold title and at most two sentences; it closes on `Esc`, on outside click, and when
another opens.

- **Use it** for anything a new joiner would have to ask about: a derived number, a scoring
  rule, a state that is computed rather than stored.
- **Never** use a native `title=` tooltip — it never appears on touch and cannot be reached
  by keyboard.
- **Never** print the same sentence permanently under the field. That is the paragraph this
  control exists to remove.

### State matrix

| Component | Hover | Focus | Active | Selected | Disabled | Loading | Error |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Button | bg one step | 3px ring | +0.5px, darker | — | 45% opacity | spinner, label stays | — |
| Input | border → muted | ring + primary border | — | text selection | sunken bg | skeleton in place | danger border + message |
| Select | border → muted | ring | menu open | check + tint | 45% | "Loading…" item | danger border |
| Nav row | hover bg | inset ring | press tint | bar + tint + glow | removed, not disabled | — | — |
| Table row | hover bg | inset ring | — | selected bg + checkbox | muted text | skeleton row | danger stripe |
| Tab | text → primary | ring | — | underline + primary | 45% | count → dot | danger dot |
| Checkbox | border → control | ring | — | fill + tick | sunken | — | danger border |
| KPI tile | border → strong | ring if it links | — | primary border | — | skeleton value | "—" + reason on `i` |
| Chart | mark brightens + tooltip | same as hover | — | others drop to 30% | — | axes + skeleton plot | message in plot area |

---

## 11. Dashboards

**Reading order — every analysis page answers in this sequence:**

1. Is anything wrong? — exceptions band
2. How are we doing? — KPI row
3. Which way is it going? — one trend chart
4. Where is it coming from? — breakdown
5. Who or what exactly? — the table

If a block cannot be assigned to one of the five, it does not belong on the page.

### KPI tiles

Fields: title (+ optional `i`), primary value, trend with its comparison period, status, an
optional mini visualisation, an optional single action.

- A trend without a period is unreadable — always "vs last week".
- **Withhold rather than mislead**: a stale metric shows `—` and says why behind the `i`.
- A tile that filters the table below it earns its space; one that leads nowhere is a poster.
- Do not colour the value by trend — rising unclosed days is bad. Colour the *delta*, judged
  per metric.
- Six tiles maximum in a row group.

---

## 12. Charts

| Data's job | Form |
| --- | --- |
| Trend over time | line; area fill only for a single series |
| Magnitude across classes | bar rows |
| Composition over time | stacked bars |
| Against a target | bullet |
| Ordered stages | funnel, one-hue ramp |
| A grid of magnitudes | heat |
| One number | **no chart** — a stat tile |

Rules:

- **No dual axis, ever.** Index the measures to a common base, or use two charts.
- **No donut** beyond three slices, and never for parts that do not sum to a meaningful
  whole. "Deals by owner" is a bar chart.
- **Grid** — horizontal only, 1px, `--chart-grid`. No vertical grid, no plot border, 3–4
  ticks, axis line omitted.
- **Marks** — 2px lines · bars capped ~40px, rounded 3px at the data end only · points ≥8px
  hit area · 2px surface gap between adjacent fills.
- **Labels** — direct-label the last point and the extremes; never a number on every mark.
  Legend from two series up; a single series is named by the title.
- **Colour** — fixed slot order, never cycled; colour follows the entity, not its rank.
- **States** — loading: axes drawn, plot skeletoned. Empty: axes drawn, one line of why.
  Partial: plot what exists and mark the gap; never interpolate across missing days.
- **Every chart has a table view** behind a control, and every series is distinguishable
  without colour.

---

## 13. Tables

- Row height 40 (34 compact). Sticky head. Column one is a 3px exception stripe in a status
  colour, so rows that need attention are findable without reading.
- Right-align and monospace every figure; the unit goes in the header, not each cell.
- **Missing is `—`, not 0.** Zero hours and no record are different facts.
- Seven columns by default; the rest behind a **Columns** control, remembered per person.
- Bulk actions appear in a bar above the header, never floating over rows.
- Do not paginate below 100 rows — scroll. Above 500, virtualise; the fixed row height
  exists for this.
- Never colour a whole row. Never put a destructive action in the row — it goes in the row
  menu, behind a confirm.

---

## 14. Forms

- Label above, always visible. A placeholder that carries the label disappears on typing.
- Required is a red asterisk on the label. If most fields are required, mark the optional ones.
- Validate on blur; re-validate on change once a field has failed.
- The error says what to do: "Needs 6 digits. Yours has 5." — not "Invalid input".
- Actions bottom-right, primary last, in a footer that is fixed if the form scrolls.
  Destructive actions sit apart, on the left.
- Prompt on leaving with unsaved changes — only when something actually changed.
- **Do not disable submit** until valid; let it be pressed and move focus to the first error.
- No help text under every field; it goes behind the `i` on the label.
- No multi-step form under six fields; no modal for a form over eight.
- Settings toggles save on change and confirm with a toast — no Save button.

---

## 15. Motion

| Token | ms | Curve | Used by |
| --- | --- | --- | --- |
| `--motion-instant` | 90 | standard | press, hover tint, checkbox |
| `--motion-fast` | 150 | standard | menu, tab, toggle, tooltip, chip |
| `--motion-slow` | 240 | exit | modal, drawer, toast, page transition |

`--ease-standard: cubic-bezier(.4,0,.2,1)` · `--ease-exit: cubic-bezier(.16,1,.3,1)`

Enter with the exit curve so a panel arrives quickly and settles; leave faster with the
standard curve. Animate transform and opacity only. Motion carries direction: a drawer slides
from its own edge, a modal rises 8px, a toast enters from the corner it stays in. Never
animate a data table, and never re-animate chart bars on a filter change. Under
`prefers-reduced-motion`, the final state renders immediately.

---

## 16. Icons

Outline, 1.6px stroke on a 16px grid, round caps and joins. Filled only for a selected state
or a status dot. Sizes: 12 inline with 11–12px text · 14 in buttons and rows · 16 in nav and
toolbars · 20 for a section marker · 28 for an empty state. 6px between icon and label; the
icon takes the label's colour. One icon per concept, product-wide, from a single registry.
No emoji. No decorative icons on headings. Never rely on an icon alone for status.

---

## 17. Role-based experience

Role changes what is **on** the screen and what comes **first** — never how a button, table
or chart looks.

**Team member — verb: *do***
Lands on Today: shift state, what is due, what is blocked. One primary action at a time, in
the same place every day. Their own numbers appear beside their own recent average, never a
team ranking. Phone is first-class for clock in, leave, and marking a task. A module they
cannot open is absent from the nav.

**Admin / management — verb: *decide***
Lands on exceptions, not totals. Every number drills to its rows — a KPI that cannot be
opened does not go on the page. Period, team and target live in one filter row applying to
everything below. Compact density on by default. Person-actions and system-actions are
different colours in every feed.

---

## 18. Empty, loading and error

| State | Shape |
| --- | --- |
| No data yet | Icon, one-line title, one line of context, one action |
| No search results | Name the query, offer the closest match, offer to clear the filter that is excluding rows |
| No activity | Same as no data; never an illustration with a joke |
| Loading | Skeleton matching the real row height and column widths |
| Partial | Plot or list what exists and label the gap where the total is shown |
| Error | What failed, that nothing was changed, and a Retry |
| Permission denied | What the role can see, what the action needs, a request-access action |
| Offline | Last-loaded timestamp, and that changes are queued |
| Success | Toast with the verb in past tense, plus Undo where the action is reversible |

Skeleton under 400ms of expected wait; a spinner only for an action the person just
triggered. Never cover a table with a centred spinner. Never apologise, blame the network,
or print a stack trace.

---

## 19. Accessibility

Contrast, computed for both themes:

| Pair | Light | Dark | Min |
| --- | --- | --- | --- |
| text on surface | 18.4 | 15.4 | 4.5 |
| text-2 on surface | 9.0 | 9.3 | 4.5 |
| text-muted on surface | 6.3 | 6.1 | 4.5 |
| text-muted on sunken | 5.2 | 6.4 | 4.5 |
| primary-ink on primary | 5.4 | 9.8 | 4.5 |
| success / warning / danger on their soft bg | 6.8 / 5.6 / 6.2 | 7.8 / 7.7 / 7.4 | 4.5 |
| accent-text on accent-soft | 5.5 | 9.1 | 4.5 |
| **border-control on surface** | **3.5** | **3.6** | **3.0** |

The last row is the one systems usually fail: an input border is *non-text contrast* and
needs 3:1. Today's theme measures 2.25:1 light and 2.65:1 dark — a fix, not a preference.

- Keyboard reaches everything; tab order follows visual order; arrows drive an open menu, a
  table's rows and a calendar's days; `Esc` closes the top layer only.
- Focus is never obscured — `scroll-padding-top` offsets the sticky topbar; modals trap focus
  and return it on close.
- A skip link to main content, first in the tab order.
- Touch targets 44px with 8px separation on any surface reaching a phone.
- `aria-invalid` + `aria-describedby` on failed fields; focus moves to the first error on submit.
- Live regions for live numbers (`aria-live="polite"` on the on-shift count).
- Never convey anything by hue alone — not a status, not a series, not a heat cell.

---

## 20. Token architecture

```
Layer 1  primitive   --slate-* --beacon-* --live-* --pulse-* --green-* --amber-* --rust-*
                     --space-* --radius-* --size-* --font-* --icon-* --motion-* --ease-*
                     --layout-* --bp-* --z-*
Layer 2  semantic    --color-*  --chart-*  --shadow-*  --focus-ring*  --surface-sheen
                     (redefined per theme and per density — the ONLY layer that is)
Layer 3  component   .btn .input .pill .kpi .tbl .dd-menu … one shared prefix
```

Naming: `--<category>-<role>-<variant>`. A token names what a thing *means*, never what it
looks like. There is no `--color-teal`.

Z-index: `sticky 2 · band 10 · top 15 · nav 20 · pop 100 · overlay 200 · toast 300`.

Density: `[data-density="compact"]` rewrites `--size-*`, `--layout-top`, `--layout-row`,
`--layout-pad`, `--font-base`, `--font-3xl`, `--font-4xl` — and nothing else.

**Migration map** from the current sheet:

```
--bg          → --color-bg              --ink    → --color-text
--surface     → --color-surface         --ink-2  → --color-text-2
--bg-inset    → --color-surface-sunken  --ink-3  → --color-text-muted
--bg-nav      → --color-surface-nav     --line   → --color-border
--bg-selected → --color-selected        --line-control → --color-border-control
--brand       → --color-primary         --ok/--warn/--bad/--info → --color-success/warning/danger/info
--space-*     → --space-*  (unchanged)  --control-* → --size-*
--radius-*    → --radius-* (unchanged)  --text-*  → --font-*
```

---

## 21. Page layouts

Structure and hierarchy only — wireframes in the artifact.

1. **Admin dashboard** — exceptions band → KPI row → one trend chart + ranking → exceptions
   table. No primary action; this page is read.
2. **Team dashboard** — live KPI row (on shift, avg hours, unclosed, leave) → attendance heat
   → member table. Primary: close day for selected.
3. **Member profile** — identity strip → operation launcher → the open operation. Each
   operation is a place with its own URL (`/team/:id/leave`), not a tab. Pay and documents
   are absent for a senior, and refused at the URL.
4. **Sales dashboard** — KPI row → funnel + stacked pipeline → owner ranking. Every figure
   carries a period.
5. **Sales pipeline** — filter band → stage columns with stage totals in the heads. Board and
   table are two faces of one route, sharing filters and URL.
6. **Attendance** — derived-count rail (the rail *is* the filter) → date bar → month grid.
   Absent is the lack of a row, so day and month views cannot disagree.
7. **My day** — shift band with the one primary action → due today → my week + blocked.
   This is the phone screen.
8. **Reports** — saved reports rail → period / group-by / compare → chart, then the table it
   explains. Export takes the filtered set.
9. **Settings** — appearance (theme, density, landing page), roles, modules, audit. Saves on
   change.
10. **Notifications** — two buckets only: *needs you* and *for information*. A notification
    that cannot be acted on or dismissed is not created.

---

## 22. Implementation order

Each step is shippable on its own.

1. **Token rename + repoint.** Layer 2 of `admin-theme.css` takes the new names and ramps;
   every module re-skins in one commit. Split success away from primary here — widest blast
   radius, easiest while nothing else moves.
2. **Contrast fix.** `--color-border-control` to a compliant step in both themes, plus
   `scroll-padding-top` and the skip link. Closes two WCAG failures.
3. **Breakpoints.** Seven ad-hoc widths collapse to four tokens.
4. **Shared component layer.** Panel, toolbar, filter band, list row, KPI tile, pill, table
   under one prefix. This is where most of the 426 KB goes.
5. **Pilot module — Team.** It contains every pattern in the system: attendance, calendar, a
   record page with operations, charts and forms.
6. **Chart kit consolidation.** Existing CSS charts onto the new ramps, plus the standard
   tooltip, legend and empty/loading/partial states.
7. **Retire the legacy layer.** Move auth off `src/components/ui`, then delete it along with
   tailwind, recharts and react-quill.
8. **Remaining modules,** one per commit, against the pilot as reference.

### Tradeoffs accepted

- A denser default costs comfort for occasional users — mitigated by Comfortable being the
  default and Compact being a choice.
- Splitting success from the brand colour means re-learning one signal.
- Four breakpoints will make two current layouts reflow at a different width than today.
- Consolidating module CSS is the largest single step; it is done behind the pilot module
  rather than all at once.
