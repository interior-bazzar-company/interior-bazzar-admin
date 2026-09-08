# Ink & Signal — the Interior bazzar Admin design system

**Status: implemented, 2026-09-08 — the consolidation pass.**

The panel runs on **one design system, one component system and two themes**. There is no
UI library under it, no utility framework, no colour-scheme switcher and no density
variant. React 19.2, TypeScript 5.8, Vite 7, react-router 7 — and past that, everything
you see is in this repository and readable.

| | |
| --- | --- |
| Colour | **Black, white, and Forest Green.** Ink builds the interface; forest marks where you are |
| Themes | `[data-theme="light"]` and `[data-theme="dark"]`. That is the whole list |
| Tokens | `src/styles/tokens.css` — the only file in the product allowed to hold a colour |
| Components | `src/styles/admin-theme.css` (the classes) + `src/admin/ui/index.tsx` (the React) |
| Type | Archivo (display) · IBM Plex Sans (interface) · IBM Plex Mono (figures, labels) |
| Icons | 90 hand-drawn paths in `src/admin/ui/index.tsx`. No icon package |
| Charts | `src/admin/views/charts.tsx` — hand-rolled SVG/CSS on the `--chart-*` tokens |

### What this replaced

The panel shipped on **Untitled UI React** — the component library, Tailwind CSS 4.3 and
React Aria — carrying **three colour schemes** (`console`, `portal`, `beacon`) and a
**compact density**. Six appearances, two component systems, and two sets of icons on the
same toolbar.

All of it is gone:

| Removed | Why |
| --- | --- |
| `src/components/{base,application,foundations,shared-assets}` — 187 files | Nothing outside the library imported them but eight components; they brought a second Button, Input, Badge, Select and EmptyState |
| `src/styles/untitled/` — 4 sheets, 118 KB | A second token source under the panel's own |
| Tailwind CSS + 3 plugins, React Aria, React Stately, `@untitledui/icons`, `@untitledui/file-icons`, `tailwind-merge`, `motion`, `input-otp`, `react-hotkeys-hook` | 20 dependencies that existed only to serve the library |
| The `portal` and `beacon` schemes | Six appearances is six design systems to keep honest; in practice four were never looked at again after the week they landed |
| `[data-density="compact"]` | Already dead in the shell; the attribute and its stored preference are now cleared on boot |
| `src/styles/components.css` | A **second** component stylesheet, imported after the first so its rules could refine them. Two files meant two answers to "where does a shared part go", and the answer drifted |
| `src/utils/cx.ts`, `src/hooks/use-resize-observer.ts`, `src/providers/router-provider.tsx`, the `@/` alias, the Tailwind Vite plugin | Scaffolding with no consumer left |

**One import in `main.tsx`.** `admin-theme.css` pulls `tokens.css` from its own first
line, so the whole system arrives in a single, known order and the cascade has one author.

### The guards that keep it true

These are not documentation. They run.

| `npm run …` | Asserts |
| --- | --- |
| `check:tokens` | every `var(--x)` the panel reads is defined somewhere the panel loads |
| `check:contrast` | 110 foreground/background pairs, **parsed out of the real `tokens.css`**, clear 4.5:1 for text and 3:1 for an operable edge, in **both** themes |
| `check:dupes` | no selector is declared twice in one sheet; no module sheet re-declares a shared class; **no colour literal outside `tokens.css`** |
| `check:menu` | drives the real shell in a real browser: the theme switch writes the attribute, repaints, persists, survives a reload, follows the OS under "System", and the retired scheme/density keys are cleared |
| `shoot-appearance` | photographs every shared part in both themes, plus the modal and the drawer |
| `shoot-modules` | boots the real shell and photographs **all 19 routes in both themes**, and fails if any of them rendered the error boundary instead of a page |

`check:contrast` reading the stylesheet rather than a copy of the palette is the point of
it: the previous version asserted ratios against hard-coded hexes, so it could pass while
the product failed.

---

## 1. Audit — what the consolidation found

Measured against `interior-bazzar-admin` @ `proto-2.3.0.0`.

### Findings

1. **Two component systems, and eight seams.** The Untitled UI library was imported in
   exactly three files (`AdminAuth`, `AdminShell`, `admin/ui/index.tsx`) for eight
   components — but those eight were `Button`, `Input`, `Badge`, `NativeSelect` and
   `EmptyState`, which is to say the five parts every screen is made of. A library
   `Badge` beside the panel's own `.pill` on the same toolbar.
2. **Two icon sets.** `Icon` looked a name up in `@untitledui/icons` first and fell back
   to the panel's 48 hand-drawn paths. Which set a glyph came from depended on the name,
   and the two sit at visibly different optical weights.
3. **Six appearances.** Three schemes × two themes, driven by `data-scheme` +
   `data-theme` + two classes the library selected on.
4. **Two skeleton implementations under one class.** `.sk` was declared twice, with two
   different shimmer mechanisms; both matched, so every skeleton bar ran two animations
   at two speeds.
5. **Three segmented controls** — `.btn-group`, `.fin-seg`, `.tm-seg` — and **three
   pagers**, only one of which could jump to a page.
6. **Five timelines.** One shared `.tl` implementation, plus four modules that each
   hand-built the same drawing out of `.ti` and a column of inline styles.
7. **Two components sharing a class.** `.tm-an-pair` was a two-bar chart in Reports AND a
   responsive grid in Tasks; the grid was later in the file, so the Reports chart did not
   draw. `.tm-lk` was a linked-items `<ul>` AND a stale rule for the relation prefix, so
   the list rendered as an 84px inline-block. `.fin-derived` was written twice, and what
   shipped was one rule's layout with the other's border.
8. **The same status, two colours.** `sys` — "the system did this" — was amber in Business
   Enquiries and blue in Finance. `mute`, `stop` and `sys` appear in the shipped
   vocabularies and had no `.pill` rule at all, so three distinct meanings rendered as
   one neutral chip.
9. **A green wall.** Forest and success-green sit ~16° apart in hue. With `new`,
   `assigned` and `open` mapped to the brand, a row of eight status chips came out with
   five greens and "Assigned" was indistinguishable from "Converted".
10. **Status colours on avatars.** The four initials tints were info-blue, neutral,
    warning-amber and success-green, picked by the character sum of a person's name — so
    a row of faces read as a row of states.
11. **Colour literals in the component layer.** Fifteen, all in the quotation document.

### Disposition

- **Kept** — the three token layers, the rail, chrome published by the page, the CSS chart
  approach, `Field`, `Table`, `Pill`, `EmptyState`, `MoreMenu`, the command palette, and
  every module's genuinely-local drawing (the enquiry lifecycle's solid-vs-hollow dot ramp
  is local *because the lifecycle is*).
- **Standardised** — one segmented control, one pager, one timeline, one skeleton, one
  alert, one chip input, one count badge, one status vocabulary.
- **Retired** — Untitled UI, Tailwind, the second stylesheet, two schemes, density, and
  twenty dependencies.

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

Three layers, and **only layer 2 is redefined per theme.** No component may name a
layer-1 value; a grep for `--ink-`, `--forest-`, `--live-`, `--pulse-`, `--green-`,
`--amber-` or `--rust-` outside `tokens.css` must return nothing. `check:dupes` runs the
stronger version of that rule — **no colour literal outside `tokens.css` at all** — and it
returns clean.

### 3.1 The two rules the whole palette turns on

1. **The primary action is ink.** Near-black in light, near-white in dark, inverting
   wholesale. The thing you press should be the highest-contrast object on the screen, and
   a green button competes with every green status beside it. This is what "our primary
   colour is black and white" means in practice.
2. **Brand is forest green, and it is a thread, not a button.** It marks WHERE YOU ARE and
   WHAT IS YOURS: active nav, the selected row, links, the focus ring, progress fills, the
   current pipeline stage, the active filter, checked boxes and toggles, chart series 1,
   and the sign-in door. It is the portal's colour, so moving between the public site and
   the CRM feels like one product.

**No status is ever the brand.** Three of them used to be — `new`, `assigned` and `open`,
on the reasoning that they mean "ours, in hand". Drawn, a row of eight status chips came
out with five greens: forest and success-green are ~16° apart in hue, which at chip size
on a soft tint is no distance at all, and "Assigned" was indistinguishable from
"Converted". A list scanned by colour that cannot be scanned by colour is worse than one
with no colour in it. A status is a SIGNAL; the brand is an IDENTITY; a chip that is both
is neither.

Everything else is functional: four status hues, one live accent, one system tone, and
nothing more.

### 3.2 Layer 1 — the ramps

```
INK      1 #fafafa  2 #f4f4f5  3 #ededf2  4 #e3e3e8  5 #d7d7db  6 #c0c1c5
         7 #8b8b94  8 #6e6e77  9 #52525a 10 #3a3a41 11 #232327 12 #0b0b0d
FOREST   1 #ecf7f1  2 #d3ede0  3 #a9dcc3  4 #74c39f  5 #43a67d  6 #218a62
         7 #14704e  8 #0f5a3f  9 #0e4834 10 #0d3b2c 11 #06231a
         + three dark mixes: #0f2a20 · #123527 · #1d4a37
LIVE     cyan — "happening right now", and only that
PULSE    indigo — the SYSTEM acted: automation, derivation, an audit entry
GREEN / AMBER / RUST   success · warning · danger. Deliberately not the brand hue
TAG      eleven hues that mean NOTHING, by contract (see 3.4)
```

Ink is a **true grey with no hue bias**; the ground is as monochrome as the buttons.

`ink-7` is where it is because of one measurement: it is the control edge, and it holds
the 3:1 non-text floor at **3.38:1** on white. One step lighter measures 2.7 and fails
WCAG 1.4.11. `forest-7` is the light-theme brand at **5.31:1** on white, which is what
makes it legible as *link text* and not only as a fill; `forest-4` is the dark-theme
brand for the same reason in reverse.

### 3.3 Layer 2 — the semantic set

Redefined once per theme, and nowhere else.

| Group | Tokens |
| --- | --- |
| Ground & plane | `--color-bg` · `-canvas` · `-surface` · `-surface-raised` · `-surface-sunken` · `-surface-nav` |
| Text | `--color-text` · `-text-2` · `-text-muted` · `-text-off` · `-text-disabled` · `-text-inverse` |
| Border | `--color-border` · `-border-strong` · **`--color-control-edge`** |
| Primary (ink) | `--color-primary` (+`-hover`, `-ink`, `-text`, `-soft`, `-border`) |
| Brand (forest) | `--color-brand` (+`-hover`, `-ink`, `-text`, `-soft`, `-soft-2`, `-border`, `-accent`) |
| Interaction | `--color-hover` · `-active` · `-selected` · `-focus` · `-disabled-bg` · `-tick` |
| Status | `--color-success/warning/danger/info` (+`-solid`, `-soft`, `-border`) |
| Signal | `--color-accent` (live) · `--color-secondary` (system) |
| Elevation | `--shadow-xs` … `--shadow-xl` · `--surface-sheen` · `--nav-active-glow` · `--focus-ring` |
| Data-vis | `--chart-1..8` · `--chart-seq-1..5` · `--chart-pos/neg` · `--chart-grid/axis` |

**Dark is designed, not inverted.** Three things are decided rather than flipped:

1. **The plane is LIGHTER than the ground.** In light a card is white on grey; in dark it
   is `#141416` on `#09090a`. That is how a dark interface says "raised" — inverting would
   have put the card *below* its own page.
2. **The brand lightens.** `forest-7` on near-black measures 2.4:1 and is unreadable as
   link text, so dark uses `forest-4` and three re-mixed tints.
3. **Every soft status ground is re-mixed against near-black, not faded toward it.** A
   faded tint desaturates to grey, and a grey "danger" row is indistinguishable from a
   disabled one.

Module sheets never see any of this. They read `--bg`, `--text-2`, `--ok-bg`,
`--line-control`, and the inversion lives entirely in `tokens.css`.

The **`--color-control-edge`** token is the one value chosen against a measurement rather
than by eye — see 3.2. Decorative hairlines use `--color-border`, which is free to be
quiet because nothing operable depends on it.

### 3.4 The tag palette — the one place colour is not a signal

Eleven hues that mean **nothing**, by contract. A person picks a tag's colour themselves,
from the swatch picker in Team and Users, and the whole point of the set is that none of
them carries a meaning the system assigned. If tags drew from the status palette,
somebody's "Red — chase this" label would be indistinguishable from the panel saying a
record had failed.

They were eleven fully saturated hues at eleven different lightnesses, so a row of four
looked like four unrelated systems. Every one now sits at the **same chroma and the same
lightness** — muted enough to live on a black-and-white interface, distinct enough to tell
apart at chip size. All eleven names survive, so every stored tag keeps the colour its
owner chose.

**The numbers, because "same chroma" only means something if it is a number.** Every step
of both chip families is solved in OKLCh at a fixed lightness and chroma, with hue the only
thing that varies:

| | fill | edge | ink |
|---|---|---|---|
| **Status** — a state the system assigned | L 0.948 / C 0.042 | L 0.826 / C 0.088 | L 0.470 / C 0.118 |
| **Tag** — a label a person typed | L 0.962 / C 0.026 | L 0.864 / C 0.050 | L 0.502 / C 0.100 |

Chroma backs off only where a hue runs out of sRGB, and `slate` keeps a fifth of it on
purpose — it is the "no particular colour" tag and has to stay legibly grey.

**The rung between the two rows is the load-bearing part.** A status has to win when it
shares a row with a tag, because one is a fact the product decided and the other is a word
somebody typed into a text box. That ordering inverted once already: a pass that rescued the
tags from invisibility stepped them clean past the statuses, and every contrast pair still
passed, because a contrast floor says a chip is READABLE and cannot say which chip is READ
FIRST. `check:contrast` asserts the ordering directly now — the quietest status against the
loudest tag, in both themes, measured as distance from the page so that it reads correctly in
each direction: a status is **darker** than a tag in light and **lighter** than one in dark.

Four hues sit a few degrees off where they started, only where a tag landed on top of the
status of the same name — `tag-green` was 5° from success-green, `tag-red` 9° from
danger-rust, which is inside the range where two chips look like a bug rather than a choice.

Avatars draw from this set too, for exactly the same reason: an avatar **identifies**, it
never judges. Their four tints used to be info-blue, neutral, warning-amber and
success-green, chosen by the character sum of a person's name — so whether somebody's
initials came out amber or green was an accident, and a row of faces read as a row of
states.

### 3.5 Data-vis tokens

```
--chart-1          forest — because series 1 is almost always "ours": money in, us, now
--chart-2..8       the tag ramp: blue · orange · violet · teal · pink · lime · slate
--chart-seq-1..5   the forest ramp, and it inverts with the theme
--chart-pos/neg    the success and danger SOLID steps, in both themes
```

**A chart series and a tag are the same kind of thing** — an identity that carries no
intrinsic meaning, distinguished from its neighbours and from nothing else — so they share
one family. Giving them two produced two palettes' worth of hues on one screen: a
saturated blue, brown, magenta and violet beside the tag row's muted versions of the same
hues, which is what made a dashboard read as "random colours" no matter how disciplined
everything around it was.

Slots are assigned in fixed order and never cycled. Status colours are reserved and are
never available as a series: a negative month reads `--chart-neg`, not `--bad-solid`.

`--chart-pos/neg` use the **solid** steps in dark, not the bright text steps. Filled
across twenty bars of a monthly net chart, a text-weight colour is not legible — it is
loud, and eighteen coral bars owned the screen while the one figure that mattered could
not be found among them.

---

## 4. Typography

| Role | Face |
| --- | --- |
| Display | **Archivo** — page titles, record titles, card headings, KPI figures |
| Interface | **IBM Plex Sans** — chrome, body, table cells, form controls |
| Data | **IBM Plex Mono** — figures, ids, timestamps, axes, and every tracked micro-label |

Fallbacks are real, not decorative: `-apple-system, BlinkMacSystemFont, "Segoe UI",
system-ui, sans-serif` for the first two and `ui-monospace, SFMono-Regular, Menlo,
Consolas, monospace` for the third. The faces load non-blocking, so a cold cache or a
blocked CDN costs weight, never paint.

**Archivo is variable-width**, which is why there is a display face at all: a heading can
be tightened toward its own measure (`font-variation-settings: "wdth" 116`) without a
second family being loaded to do it.

### 4.1 The scale

| Token | px / line | Job |
| --- | --- | --- |
| `--text-2xs` | 10 / 14 | tracked uppercase micro-labels **only**, never a sentence |
| `--text-xs` | 11 / 16 | badges, meta |
| `--text-sm` | 12 / 18 | captions, secondary cell lines, hints |
| `--text-md` | 13 / 19 | dense UI: nav, chips, toolbar, menu rows |
| `--text-base` | 14 / 21 | body, table cells, form controls |
| `--text-lg` | 16 / 24 | card titles, drawer and modal headings |
| `--text-xl` | 19 / 26 | section titles |
| `--text-2xl` | 23 / 30 | record titles |
| `--text-3xl` | 29 / 34 | page titles, KPI numerals |
| `--text-4xl` | 38 / 44 | the greeting, and nothing else |

Weights: 400 body · 500 figures and mono · 600 labels, buttons, headings · 700 page titles
and KPI figures. Tracking `-0.02em` on display sizes, `0.12em` on the 10px uppercase
labels, normal elsewhere. **Body copy never goes below 12px.**

### 4.2 The mono micro-label is where this system's voice lives

A **column head is not prose** — it is the NAME of a measurement, exactly like the label
on a metric tile — so the two are set the same way: 10px IBM Plex Mono, uppercase, tracked
`0.1em`, in `--text-muted`. That single decision is most of what makes a table and a KPI
row read as parts of one instrument rather than as a heading above a list.

It applies to column heads, metric-tile labels, section keys (`.eyebrow`), menu section
headings, and the `--qd-*` document's own field labels. Nowhere else.

**Uppercase by the type system, never typed in capitals.** The string stays searchable,
exportable, and correct when read aloud.

### 4.3 A figure column is mono

Right-aligned so the units line up, `font-variant-numeric: tabular-nums` so the digits do,
and **mono** so `₹4,20,000` and `₹11,80,000` are the same width per character. In a
proportional face the longer number is not reliably the wider one, which is the whole
reason a column of money is hard to scan.

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

| Radius | px | Used by |
| --- | --- | --- |
| `--radius-xs` | 4 | checkbox, severity stripe, chart bar end |
| `--radius-sm` | 6 | menu item, nav row, small chip, skeleton |
| `--radius-md` | 8 | **every control** — button, input, select, segmented control |
| `--radius-lg` | 10 | secondary surfaces |
| `--radius-xl` | 12 | card, panel, table frame, popover |
| `--radius-2xl` | 16 | modal |
| `--radius-full` | — | badges, filter chips, avatars, toggles — things read, not operated |

Two radii on one element is a bug. A pill-shaped button is a status pretending to be an
action.

**Five control heights: 22 · 26 · 32 · 38 · 44.** This is a CRM, and a toolbar above a
forty-row table cannot spend 40px on every control, so the scale is denser than a
marketing scale at the bottom and opens up only where a target has to be hit on a phone
(`xl`, 44). A form is `lg` throughout — a form is read as a column and a column of mixed
heights reads as broken. `sm` exists for a control inside a toolbar or a table cell, where
the row height is set by something else. **Nothing invents a height between steps.**

| | xs | sm | md | lg | xl | row |
| --- | --- | --- | --- | --- | --- | --- |
| Comfortable | 24 | 32 | 36 | 40 | 44 | 44 |
| Compact | 22 | 28 | 32 | 36 | 40 | 36 |

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

### Where each part lives

The contract above is only true if a screen renders the part rather than drawing its own.
This is the map, and `check:dupes` is what keeps a module from adding a second row to it.

| Part | Render this | Drawn by |
| --- | --- | --- |
| Filter dropdown | `Select` (`ui/select.tsx`) — a listbox, keyboard-complete, options carry a dot / badge / chip | `.sel`, `.sel-t`, `.sel-list`, `.sel-o` |
| Several from a list | `MultiSelect` | same closed control, `.menu` open |
| Form select | native `<select className="inp sel">` or `SelectInput`; `.selectbox` wraps one | `.inp.sel`, `.selectbox select` — one chevron |
| List table | `ListTable` + `Rail` for the exception stripe; rows are the module's | `.tbl.dls-tbl`, `.dls-tbl td.rail` |
| Card table | `Table` | `.tw .tbl` |
| Filter band | `.dls-cmd` with `SearchField`, `Select`, `FilterChips` | `.dls-cmd`, `.chiprow.filters` |
| Modal | `ModalShell`, or `ModalHead` + `.md-b` + `.md-f`; `ConfirmModal` to ask | `.modal`, `.md-*` |
| Drawer | `DrawerShell`, or `DrawerHead` + `.dw-b` + `.dw-f` | `.drawer`, `.dw-*` |
| More menu | `MoreMenu` (`ui/menu.tsx`) — fixed-positioned, never clipped | `.ib-menu-pop`, `.mi` |
| Tabs | `Tabs` — icon, link (`to`), count, quiet count | `.tabs` |
| Status chip (a state) | `Pill`; `LeadStatus` / `DealStatus` / `Priority` for the CRM's own | `.pill` — **rounded** |
| Tag chip (a label) | `Tag` / `Tags`, or `Pill` with `is-tag` | `.pill.is-tag`, `.pill[class*="tag-"]` — **square** |
| Filter chip (a choice the operator made) | rendered by the filter band | `.chip`, `.chip.on` — **rounded**, forest edge |
| Count badge | `<span className="ct">` | `.ct` |

Those three are the whole chip vocabulary, and they are ranked. A **status** is the loudest
because the product decided it; a **tag** is quieter because a person typed it; a **filter
chip** is the only one that may wear the brand, because it marks a choice the operator made
rather than anything about the data. A selected filter carries that on its **edge** rather
than its fill — a filled one would put a green block across the top of every list the moment
somebody switched on more than a couple, which is exactly what the brand is not allowed to do.

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

**One set, and it is in this repository.** Ninety paths in `ICONS` in
`src/admin/ui/index.tsx`, drawn on a 24 grid with round caps and one stroke weight. There
is no icon package.

There used to be. `Icon` looked a name up in `@untitledui/icons` first and fell back to
the panel's own 48 paths, which had one visible cost and one invisible one: a library
glyph sat beside a hand-drawn one on the same toolbar at slightly different optical
weights, and "which set is this icon from?" was a question anybody adding a screen had to
answer, with the answer changing per name.

`.ic` in `admin-theme.css` owns the box and the stroke — 1.8px rather than a flat 2,
because at the 16px this panel uses in nav and toolbars a full 2 reads as bold — so all
five sizes stay optically even and no drawing carries its own width, height or
stroke-width. Sizes: 12 inline with 10–12px text · 14 in buttons and rows · 16 in nav and
toolbars · 20 for a section marker · 28 for an empty state.

An unknown name renders `doc` rather than nothing: a missing icon should be a wrong
drawing somebody notices, never an invisible gap in a toolbar that silently changes the
spacing of everything beside it.

6px between icon and label; the icon takes the label's colour. One icon per concept,
product-wide. Adding one is a single line. No emoji. No decorative icons on headings.
**Never rely on an icon alone for status.**

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

Contrast, **computed** for both themes — 46 pairs, every one the theme actually renders.
The script is `ramp.cjs`; these are its numbers, not estimates.

| Pair | Light | Dark | Min |
| --- | --- | --- | --- |
| text-primary on plane | 17.93 | 17.18 | 4.5 |
| text-secondary on plane | 10.37 | 12.09 | 4.5 |
| text-tertiary on plane | 7.81 | 7.11 | 4.5 |
| text-tertiary on inset | 7.17 | 7.85 | 4.5 |
| text-quaternary on plane | 4.74 | 7.11 | 4.5 |
| ink on the primary solid (the primary button) | 17.93 | 17.18 | 4.5 |
| white on brand-solid (forest) | 6.07 | 6.07 | 4.5 |
| text-brand on plane | 12.51 | 8.58 | 4.5 |
| success / warning / error on their soft ground | 5.40 / 5.20 / 6.05 | 6.90 / 7.59 / 5.00 | 4.5 |
| info on its soft ground | 5.57 | 6.10 | 4.5 |
| **border-control on plane** | **3.36** | **3.89** | **3.0** |
| border-control on inset | 3.08 | 3.28 | 3.0 |
| border-brand on plane | 4.31 | 5.97 | 3.0 |

The bolded row is the one most design systems fail: an input border is *non-text
contrast* and WCAG 1.4.11 puts it at 3:1, while a decorative hairline at `ink-4` measures
about 1.5:1 — correct for something that only groups, wrong for the edge that identifies
an operable control. `--color-control-edge` exists for exactly this; see §3.2.

**One value in this system was chosen by that measurement rather than by eye**, and it is
the sunken plane. `--color-surface-sunken` was `#eff0f2`, and the control edge on it
measured **2.96:1** — a search field, a table head and a modal footer all sit in that
well. It is `#f2f2f4` now, the lightest step that clears the floor at 3.02 while staying a
visibly distinct plane inside a white card. `check:contrast` reads it out of the real
stylesheet, so a nudge there is caught rather than assumed.

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
src/styles/tokens.css        LAYER 1 — the ink, forest, live, pulse, status and tag ramps,
                             plus every non-colour primitive: space, type, radius, control
                             heights, icon sizes, motion, layout, the z ladder.
                             LAYER 2 — the semantic set, once for light and once for dark.
                             Then the legacy vocabulary (--bg, --text-2, --brand, --ok-bg,
                             --line-control …) as ALIASES of layer 2, so nine module sheets
                             re-theme without one of them being edited.
                             THE ONLY FILE IN THE PRODUCT ALLOWED TO HOLD A COLOUR.

src/styles/admin-theme.css   LAYER 3 — the classes: .btn .inp .tbl .card .pill .mi .md-* …
                             It `@import`s tokens.css from its own first line, so the whole
                             system arrives as ONE import in main.tsx, in a known order.
                             Zero colour literals. `check:dupes` asserts it.

<module>.css                 only what is genuinely local to one screen. Nine of them.
                             A module sheet may not re-declare a class the component layer
                             owns; `check:dupes` asserts that too.
```

**There is no second stylesheet.** There used to be — `components.css`, imported *after*
`admin-theme.css` so its rules could refine them. Two files meant two answers to "where
does a shared part go", and the answer drifted: `.tile` lived in one and its `.delta` in
the other, so a change to the metric card was two edits in two files. Worse, the same
selector ended up declared in both — `.sk`, `.ticks`, `.md-h`, `.dw-h`, `.notice.ok` — and
where the two disagreed, what shipped was neither author's design. They are one file now,
in the order the cascade already had them.

### 20.1 The rule that makes three layers worth having

> **L1 has no meaning. L2 says what a colour is FOR. L3 reads L2 only.**

A component may never name a layer-1 value. Change a ramp and the whole product moves, in
both themes, without a single component being touched.

### 20.2 Theme selection is one attribute

```
<html data-theme="light">   ·   <html data-theme="dark">
```

That is the entire list. There is no `data-scheme` and no `data-density`; both existed,
both are removed, and a value stored for either in an earlier build is **cleared on boot**
rather than honoured — in `index.html` before first paint and again in
`ShellContext.bootAppearance()`, so neither entry point depends on the other having run.

**"System" is a preference, not a third theme.** It is resolved to one of the two in JS —
before first paint in `index.html`, and live in `ShellContext.applyTheme()` with a
`matchMedia` listener — which is why this sheet needs exactly one dark block and never a
media query that can drift out of agreement with the attribute. The chosen preference is
kept on `data-theme-pref` so the switch can show "System" while the paint says light or
dark.

`check:menu` drives all of that in a real browser: the switch writes the attribute,
repaints, persists, survives a reload with no flash, follows the OS both ways under
"System", and the retired keys are gone.

### 20.3 The paper exception

The quotation document is the one surface in this product that is **not an interface**. It
obeys paper: a fixed 210mm measure, black on white in *both* themes, one accent. A
document that goes dark when the operator's panel does is a document that prints wrong and
photographs worse.

Its `--qd-*` set is therefore theme-independent and is not an alias of anything. It lives
in `tokens.css` anyway — it used to sit inline on `.qdoc` in the component layer, which
meant "tokens.css is the only file allowed to hold a colour literal" had a footnote, and a
rule with a footnote is a rule nobody can check.

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

## 22. What shipped

**Pass 1 (2026-09-08, morning).** A token vocabulary, the forest brand and the ink primary
adopted onto Untitled UI's scale, with two gates: `check:tokens` and `check:contrast`.

**Pass 2 (same day).** The Untitled UI component library itself, on Tailwind and React
Aria — three colour schemes, a compact density, six appearances.

**Pass 3 — the consolidation (this one).** All of pass 2 removed, and the system that was
left standing made single.

**Pass 4 — the screens onto the system.** The parts four screens were still drawing for
themselves — the filter dropdown, the list table, the modal head, the tab row — became the
shared ones, and 12 list pages, 25 modal files and 5 tab rows were migrated by scripted
transform. Business Enquiries' listbox became the panel's `Select`.

### What is true now

- **One design system.** `tokens.css` + `admin-theme.css`, one import in `main.tsx`.
- **One component system.** `src/admin/ui/index.tsx`, ~60 components, every one of them
  rendering the panel's own classes. No library under it.
- **Two themes.** `[data-theme="light"]` and `[data-theme="dark"]`. Nothing else, and the
  retired appearance keys are cleared on boot rather than ignored.
- **Black, white and Forest Green.** Ink builds the interface, forest marks where you are,
  everything else is a signal.
- **Zero colour literals outside `tokens.css`**, asserted by `check:dupes`.
- **Zero duplicate selectors** in any stylesheet, asserted by the same check.
- **Twenty dependencies removed.** `dependencies` is now six: React, React DOM, React
  Router, Redux Toolkit, React Redux, and `lottie-web` for the loader.

### What the consolidation actually fixed on screen

Not all of this was cosmetic. Removing the second copy of a thing repaired six real bugs
that had been shipping:

| Bug | Cause |
| --- | --- |
| The Reports analytics chart did not draw | `.tm-an-pair` was a two-bar chart *and* a responsive grid; the grid was later in the file |
| Linked-items lists rendered as an 84px inline-block | a stale rule for the relation prefix was written under `.tm-lk`, the list's own class |
| Every skeleton bar ran two shimmer animations at two speeds | `.sk` was declared twice, with two different mechanisms |
| Finance's derived-value field had a border its own rule said it must not have | `.fin-derived` written twice; the layout came from one and the border from the other |
| "The system did this" was amber in Enquiries and blue in Finance | `sys` had no shared definition, so each module invented one |
| `mute`, `stop` and `sys` all rendered as one neutral chip | three tones in the shipped vocabularies with no `.pill` rule at all |

### Next

1. **Bundle.** 1.80 MB minified in one chunk (450 KB gzipped) — down from 2.39 MB, but
   still one chunk. Route-level `lazy()` in `views/registry.tsx` is the obvious first cut,
   and the registry is already the single place that knows every route.
2. **The remaining call sites.** ~300 `className="btn …"` and ~170 `className="inp"` still
   write the class directly rather than rendering `Input` / a Button component. They are
   on the same tokens and the same specs — this is tidiness, not correctness — so it is
   worth doing module by module rather than in one sweep.
3. **Four breakpoints.** 1440 · 1180 · 900 · 640 are declared in `tokens.css`; a handful
   of module sheets still reach for 1280, 820 or 720.

### Tradeoffs accepted

- **The eleven-hue tag palette stays.** It is the one place in the product where colour is
  not a signal, and it is a feature people use — they pick their own label colours. It is
  retuned to a single chroma and lightness so a row of tags reads as a set.
- **`--color-surface-sunken` is a shade lighter than it looks like it should be**, because
  the control edge on it has to clear 3:1. See §19.
- **Brand green and success green coexist**, distinguished by ROLE rather than by hue: no
  status is ever the brand, and the brand is never a status. They are close enough in hue
  that role separation is the only thing that keeps them apart, which is why the rule is
  absolute rather than a guideline.
