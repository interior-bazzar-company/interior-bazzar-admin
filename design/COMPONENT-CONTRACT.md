# Component contract — how a module is written on the new system

**Read this before touching a view.** It is the whole agreement between the shared layer
(`src/admin/ui`, `src/components`, `src/styles`) and the modules (`src/admin/views/*`).
The design system itself is documented in `design-system.md`; this file is the working rules.

---

## 1. The stack, and what a view may import

| Layer | Path | A view may… |
| --- | --- | --- |
| Tokens | `src/styles/{globals,theme,brand}.css` | read them through utilities only. **Never edit.** |
| Library | `src/components/{base,application,foundations}` | import a component directly when the composition layer has no wrapper for it (`Table` from `application/table`, `Dropdown`, `DatePicker`, `FeaturedIcon`, `ProgressBar`, `Tooltip`…). **Never edit.** |
| Composition | `src/admin/ui` (`import { … } from "../../ui"`) | use everything it exports. **Never add to it** — if a shared part is missing, write it as a module-local component and note it in the changelog; the main session promotes it. |
| Utilities | `cx` from `@/utils/cx` | compose class strings. |
| Icons | `Icon name="…"` (the panel's names, `src/admin/ui/icon.tsx`) or a glyph from `@untitledui/icons` handed to `icon={…}` | one icon language; no inline SVG paths. |

A module owns only its own directory. Stores, adapters, `api/`, `session.ts`, routes and
`registry.tsx` are read-only for a module agent.

## 2. Hard rules (the gates assert them)

1. **No stylesheet in a module.** Delete the module's `.css` imports and files as you migrate;
   every drawing is Tailwind utilities on a React element. A genuinely module-local drawing
   (a kanban card, a calendar chip, the enquiry lifecycle dot ramp, the quotation paper) is a
   **component in the module's `bits.tsx`**, styled with utilities — never a class in a sheet.
2. **No colour, size, radius, shadow or font literal** — not in `className` arbitrary values
   (`bg-[#fff]`, `text-[13px]`), not in `style={{}}`. Colours are the semantic utilities
   (`bg-primary`, `text-tertiary`, `border-secondary`, `bg-brand-solid`, `text-error-primary`,
   `bg-utility-blue-50`…). Sizes are the spacing scale. `style={{ width: pct + "%" }}` for a
   computed geometry is fine; `style={{ color: "#…" }}` is not.
3. **One drawing per part.** Do not write a second Button, Input, Badge, Table, Modal head,
   Tabs row, Empty state, Pagination or Avatar. Compose the shared ones.
4. **Every raw `className="btn …"`, `"inp"`, `"pill …"`, `"card"`, `"tbl"`, `"faint"`, `"mono"`,
   `"fg"`, `"md-h/md-b/md-f"`, `"dw-*"`, `"dls-*"`, `"tm-*"`, `"fin-*"`… is removed** and
   replaced by the component or utilities. `check:dupes` fails on any of the old class names.
5. **Accessibility is kept, not added later:** every icon-only button has a label (use
   `IconButton label=…`); every field has a `<label>` (`FormField`); tables use `<th scope>`;
   status is never colour alone (the `Pill` dot + text does this); modals and drawers come
   from the shell (`useShell().modal/drawer`) which trap focus and answer Escape.
6. **Both themes, always.** Never name a theme; the tokens invert. If you must branch, use the
   `dark:` variant — and you almost never must.
7. **Responsive is intentional:** tables live in a scrolling frame (`ListTable`/`Table` do
   it); filter rows wrap (`FilterBar`); page header actions stack under `md`; a two-pane page
   collapses to one pane under `lg`; nothing scrolls the body horizontally.

## 3. The page skeleton

```tsx
<PageHeader title="Deals" meta={<>{n} open · live</>} actions={<Button ico="plus">New deal</Button>} tabs={<Tabs … />} />
<FilterBar search={<SearchField ph="Search…" val={p.q} onFilter={onFilter} />}
           filters={<><Select name="stage" label="Stage" value={p.stage} options={…} onFilter={onFilter} /> …</>}
           right={<Segmented value={view} options={…} onPick={…} />}
           chips={<FilterChips params={p} labels={LABELS} onUnfilter={…} />} />
<StatStrip cells={[{ k: "Open", v: 12, to: "#/deals?stage=open", on: … }, "sep", { k: "Pipeline", v: inr(…) }]} />
<ListTable head={<tr><th className="rail" /><th>Deal</th><th className="n">Value</th>…</tr>}>
  {rows.map(r => <tr key={r.id} className="clickable" onClick={…}><Rail tone={r.late ? "bad" : undefined} /><td className="cell-1">…</td><td className="n">{inr(r.value)}</td>…</tr>)}
</ListTable>
<Pagination page={p} pages={n} total={t} pageSize={50} onPage={…} />
```

Spacing between the bands is `flex flex-col gap-4` on the page root (`gap-5` between major
sections). A page is `<div className="flex flex-col gap-4">…</div>`; the shell already pads
and caps the width.

### Cell classes `ListTable` / `Table` understand

These are applied from the table wrapper, so they are written bare on the cell and only on
a cell — `<span className="mono">` is the retired standalone class and still wrong.

`n` `num` `amt` (figure: right-aligned, mono, tabular) · `c` (centred) · `mono` · `cell-1`
(the primary cell: medium, primary) with `.cell-2` under it (secondary line) · `t` (medium
primary) · `faint` (quaternary) · `rail` (the exception stripe cell — render `<Rail tone />`)
· `acts` (row-end actions) · row classes `clickable`, `on`/`sel` (selected).

## 4. Which part for which job

| Job | Use |
| --- | --- |
| A state the system assigned | `Pill tone dot` / `LeadStatus` / `DealStatus` / `Priority` (rounded) |
| A label a person typed | `Tag` / `Tags` (square, hue means nothing) |
| A filter the operator chose | `FilterChips` (brand on the edge) |
| One number, its name, its trend | `Tile` / `Tiles` (has the ticks) |
| Counts that filter the list | `StatStrip` |
| A record's facts | `KvList` |
| What happened to a record | `Timeline` |
| Who did what, across records | `ActivityFeed` |
| A person | `Person` / `Avatar` / `Assignee` |
| Stages of a deal | `Pipeline` |
| Progress toward a target | `Meter`; the comparison figure `Delta` |
| A titled block on the page | `Card` (title, sub, right, foot; `ticks` only when measured; `flush` for a table inside) |
| A section title inside a page | `SectionHead` |
| The tracked micro-label | `<div className="label-mono">` or `Eyebrow` |
| Explain a figure | `InfoDot` (press to open) — never a native `title=` |
| Label an icon-only control | `IconButton label=…` (tooltip built in) or `Tooltip` |
| Filter dropdown | `Select` (options can carry `dot`, `badge`, `chip`) |
| Form select | `SelectInput` |
| Several from a known list | `MultiSelect`; free text list → `ChipInput` |
| Dates | `DateInput` / `DateRange` (native pickers, ISO strings) |
| Yes/no that applies on save | `Checkbox`; that applies immediately → `Toggle`; one of a set → `Radio` |
| A form | `FormSection` › `FieldRow` › `FormField` › control; actions in the modal/drawer footer, primary last |
| Decide something | `useShell().modal(<ModalShell title … actions={…}>…</ModalShell>, "sm"|"md"|"lg"|"xl")`; confirm with `ConfirmModal` |
| Inspect a record beside its list | `useShell().drawer(<DrawerShell …>…</DrawerShell>, onDismiss, "sm"|"md"|"lg")` |
| Row/record actions | `MoreMenu items={[{icon, label, act, tone?, title?}]}`; in a TABLE ROW pass `ico` (icon-only — "More ⌄" costs ~90px in every row), on a page header keep the word. `title` draws a second line explaining the consequence, or why an item is unavailable today |
| A small panel of controls anchored to its trigger | `Popover trigger={…} title="…"` — not a menu of actions (`MoreMenu`) and not a decision (a modal). Children may be `(close) => …` |
| A column that sorts | `SortHead k label cur dir onPick` — a `<th>`'s whole content |
| Secondary page actions that must survive a phone | `PageHeader fold={[{icon,label,act}]}` — buttons from `lg`, one menu below it. The primary action stays in `actions` and never folds |
| A card that needs a human today | `Card tone="ok|warning|error|info|brand|sys"` (the exception rail) |
| How many this button will act on | `Button count={n}` — never a `Pill` dropped into the label |
| A caveat under a figure | `Tile wrapSub` (`s` is one line by default; a reason wraps) |
| A field with suggestions that still takes an answer not on the list | `Input list="…"` + a `<datalist>` (a `Select` is a CLOSED list) |
| Nothing here | `EmptyState icon title body action` (dashed; `flat` inside a frame) |
| Waiting | `ListSkeleton` for a list's first load; `PaneLoading` for a pane; `Skeleton` for a bar |
| A condition on this page | `Alert` (`Notice` is the same object) |
| A receipt for an action | `useShell().toast("Saved.", "ok")` |
| Charts | `views/charts.tsx`: `ColumnChart`, `Waterfall`, `SignedColumns`, `Spark`, `FunnelChart`, `BarRows`, `CohortHeat`; frame them in `ChartFrame` |
| A conversation | see §6 |
| A kanban / calendar / timeline of work | module-local components in `bits.tsx`, on the tokens: columns are `Card flush`, chips are `Tag`/`Pill`, days are a grid of `bg-primary ring-1 ring-secondary` cells |

## 5. The utility vocabulary (the only one)

- **Planes:** `bg-secondary` (the page ground — already painted by the shell), `bg-primary`
  (a card/plane), `bg-tertiary`/`bg-quaternary` (wells), `bg-primary_hover`, `bg-selected`,
  `bg-brand-primary` (soft brand), `bg-brand-solid` (the brand fill, white text on it).
- **Text:** `text-primary` › `text-secondary` › `text-tertiary` › `text-quaternary` ›
  `text-placeholder`; `text-brand-secondary` (a link or the current thing);
  `text-success-primary` / `text-warning-primary` / `text-error-primary` / `text-info-primary`.
- **Icons:** `text-fg-quaternary` (resting) / `text-fg-quaternary_hover`; `text-fg-brand-primary`;
  `text-fg-success-primary` etc.
- **Edges:** `border-secondary` / `ring-secondary` (the hairline that groups), `border-primary`
  / `ring-primary` (the edge that identifies), `ring-brand` (selected/focused), `ring-control`.
- **Type:** `text-xs` 12 · `text-sm` 14 (body, cells, controls) · `text-md` 16 · `text-lg` 18 ·
  `text-xl` 20 (record title) · `text-display-xs` 24 (page title, KPI) · `text-2xs` 11 (micro-label
  only, via `label-mono`). Weights: `font-medium` labels/cells, `font-semibold` headings/buttons.
  Figures: `tnum` (+ `font-mono` for ids/money columns).
- **Radius:** `rounded-md` 6 (small chips, menu rows), `rounded-lg` 8 (controls, buttons),
  `rounded-xl` 12 (cards, tables, popovers), `rounded-2xl` 16 (modals). `rounded-full` only for
  status pills, avatars, dots.
- **Shadow:** `shadow-xs` (a card at rest), `shadow-lg` (a popover), `shadow-xl` (a modal).
  Rows never carry a shadow.
- **Motion:** `transition duration-100` on hover/press; `duration-150`–`200` for anything that
  enters; transform/opacity only.
- **Devices (use sparingly, they are the character):** `label-mono`, `ticks` (measured surfaces),
  `sheen` (a raised surface in dark), `rail-error|warning|ok|info` (a row's exception stripe).

Spacing rhythm: gaps between controls `gap-2`; inside a card `p-4`/`p-5`; between page bands
`gap-4`; between sections `gap-6`/`mt-6`. Toolbar controls are size `sm` (36px) — `xs` (32px)
inside a table row or a dense toolbar.

## 6. Interaction patterns worth copying exactly

- **A deep link is a filter.** Filters live in the URL (`?status=…`); `FilterChips` reflects
  them; a stat cell links to its own filter. Do not add local filter state where the URL already
  carries it.
- **A drawer's X, its scrim and Escape all do one thing** — pass `onDismiss` when the record
  lives in the query (`?item=`), otherwise the shell drops the path segment.
- **The primary action is one per view**, in the page header, `color="primary"`. Row actions are
  `secondary`/`tertiary` size `xs`, or a `MoreMenu`.
- **Destructive goes last and apart**: in a menu below a separator (`tone: "bad"`), in a modal
  footer through `danger={…}`, always through `ConfirmModal`.
- **A chat**: list pane (`w-80 shrink-0 border-r border-secondary`), thread (`flex-1 bg-chat`,
  messages grouped by author with `Avatar xs`, day dividers as `label-mono` chips), context
  pane (`w-80 border-l`), composer at the bottom (`TextAreaBase` + `Button size="xs"`). Under `lg`
  the panes become tabs.
- **A kanban**: horizontal scroll of columns (`flex gap-3 overflow-x-auto`), each `w-72 shrink-0`
  with a `label-mono` head + count `Pill xs`, cards `rounded-lg bg-primary p-3 ring-1
  ring-secondary hover:ring-primary`.
- **A calendar**: 7-column grid, day cell `min-h-24 border-secondary bg-primary`, today
  `ring-1 ring-brand`, events as `Tag`-sized chips, more as `+n`.

## 7. Verify before you report

`npx tsc -b` and `npx eslint <your files>` clean; `npx vite build --mode dev` builds; the
module's own `check:*` scripts still pass (they test the stores, which you did not touch);
`node scripts/shoot-modules.cjs` renders your routes without the error boundary in both
themes. Say plainly what you could not check.

Log the change in `src/proto/v-2.2.0.0/CHANGELOG.md` (format: `LOG-FORMAT.md`) — one entry
per module, listing the files, the parts you composed, anything module-local you had to draw,
and any shared part you found missing.
