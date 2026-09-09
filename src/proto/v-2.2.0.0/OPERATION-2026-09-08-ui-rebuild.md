# Operation · Complete UI/UX system rebuild on Untitled UI React

```
task:        Rebuild the admin panel's entire UI/UX foundation on Untitled UI
             React (Tailwind CSS 4 + React Aria Components) — one design
             system, one component language, one visual language — while
             preserving every route, permission, store, API call and workflow.

description: The panel today runs "Ink & Signal": 4,600 lines of hand-written
             component CSS (tokens.css + admin-theme.css), nine module
             stylesheets (5,300 lines), 90 hand-drawn icons, hand-rolled
             charts, and ~60 React primitives in src/admin/ui that emit those
             class names. It works, and it is one author's system; the brief
             asks for an enterprise foundation with a library under it, a
             black/white/neutral palette with forest green spent only on
             action, selection, focus and signal, a subtle instrument-panel
             character, and every screen re-thought against its purpose.

operation:   Twelve phases in four waves. Wave 0 (sequential, this session):
             tokens/theme → Untitled UI component foundation → the panel's
             composition layer (src/admin/ui, same export names) → shell,
             auth, charts, shared bits. Wave 1 (ten parallel agents, one
             directory each): every module re-composed on the new layer,
             module CSS retired. Wave 2 (QA agents): gates, smokes, both
             themes at three widths, a11y. Wave 3: polish + docs. Detail below.

summary:     Done, with one part deferred. The styling foundation is gone — all nine
             module stylesheets and the three legacy token/theme sheets are
             deleted, and the panel is three stylesheets: tailwind, Untitled
             UI's theme.css verbatim, and brand.css. Every one of the twenty
             routes is composed from `src/admin/ui` on Untitled UI + React
             Aria, in forest-brand light and dark. The composition layer kept
             the OLD export names, which is what let ten agents rebuild ten
             modules in parallel without the 150 view files moving underneath
             them. Routing, URLs, query params, permissions and every workflow
             are unchanged.

             DEFERRED: the `*-smoke.tsx` render checks (um/fn/tm/rs/ag, ~3,900
             lines) still assert retired class names, so `npm run check` fails
             on them. They are stale, not regressions — rewriting them to
             assert semantics (roles, accessible names, `data-*` hooks) rather
             than presentation is the first task of wave 2.

outcome:     tsc 0 errors · vite build green (entry 1.85 MB → 893 kB + 20 lazy
             route chunks) · eslint 0 errors · check:dupes "one system" ·
             check:tokens 70/70 · check:contrast 84/84 across both themes ·
             check:menu passes · all 20 routes photographed in both themes and
             looked at, plus a phone pass at 390 and a measured horizontal-
             overflow pass at 390/768/1024 (which caught a real 580px sideways
             drag on any route with a wide table, since fixed).

             Not verified: Quotations and Invoices were photographed against a
             mocked EMPTY API, so their rows, paper and dialogs are typed,
             linted and built but never seen with data; nothing here has run
             against a live backend; and below-1024 was measured for overflow
             but not reviewed screen by screen.
```

---

## 1 · Existing architecture (verified, not assumed)

| Layer | What it is | Verdict |
| --- | --- | --- |
| Framework | React 19.2 · TS 5.8 · Vite 7 · react-router 7 (`BrowserRouter`) | Keep |
| Routing | `/login` outside the shell; `/:route`, `/:route/:id`, `/:route/:id/:sub` inside; `ViewHost` resolves route → module via `shell/modules.ts` (server `me/permissions` + `PROTO_ROWS`) and `views/registry.tsx` | Keep verbatim. Add route-level `lazy()` |
| Auth / permissions | `admin/auth/session.ts` — one resolved RBAC matrix, `can()/canWrite()`, `PROTO_MODULES`, `HIDDEN_MODULES`; `routes/RequireSession.tsx` gate | Untouched |
| API layer | `src/api/**` (`apiService`, `endpoints`, `modules/adminOps` …) | Untouched |
| State | Redux (`auth`, `user` slices — legacy, still mounted) + per-module `store.ts` (Finance 2.7k, Team 2.5k, BE 1.4k, Users 1.1k, Resources, Agreements, Overview) reading `src/content/**/*.json` seeds | Untouched |
| Shell | `AdminShell` (sidebar, topbar, crumbs, page-chrome slot, activity bell, account menu, keyboard chords), `ShellContext` (layers: drawer/modal/popover, toasts, banner, theme), `CommandPalette` | Rebuilt on the library, **same public API** (`usePageChrome`, `useNav`, `useShell`, `hashToPath`, `go`, `remember`, `can`) |
| Styling | `styles/tokens.css` (816) + `styles/admin-theme.css` (3,782) + 9 module sheets + `charts.css` + `admin-auth.css` + 2 CSS modules; ~380 shared classes; 262 `tm-*`, 189 `fin-*`, 154 `be-*`, 113 `rs-*`, 89 `um-*`, 64 `dws-*`, 62 `ag-*`, 41 `ov-*` module classes; 433 raw `className="btn…"`, 183 `inp`, 204 `faint`, 155 `mono`; 247 inline `style={{…}}` | **Removed** |
| Primitives | `admin/ui/index.tsx` (2,108 lines, ~60 components emitting the classes) + `select.tsx`, `menu.tsx`, `nav.ts`, `brand.tsx`, `format.ts` | **Rewritten** as the composition layer over Untitled UI; export names preserved so 150 view files keep compiling during migration |
| Icons | 90 hand-drawn paths in `ICONS` | Replaced by `@untitledui/icons` through a name map (`Icon name="…"` keeps working) |
| Charts | `views/charts.tsx` (7 hand-rolled CSS/SVG forms) + `charts.css` | Rewritten on **recharts** via Untitled UI's `charts-base` — same exports, same props |
| Legacy | `components/overlays/{Alert,Dialog,Modal}`, `context/*` (`ParentContextProvider`), `types/global` overlay types, `lottie-web` loader | Unused by any view → **deleted** (loader → Untitled UI `LoadingIndicator`) |
| Gates | `check:tokens`, `check:dupes`, `check:contrast` (`design/ramp.cjs`), 5 render smokes asserting class names, `shoot-modules` (Playwright, 20 routes × 2 themes), `check:popovers` | Rewritten for the new system (wave 2) |

Baseline at HEAD `e5ac713`: `tsc -b` clean, `vite build` 1.85 MB single chunk.

## 2 · Routes (all 20, from `shoot-modules.cjs` + registry)

| Group | Route | View | Primary purpose | Rebuilt as |
| --- | --- | --- | --- | --- |
| — | `overview` | Overview | command centre: what happened · happening · needs me · next | Dashboard: KPI row → trend + ranking → attention list → operations |
| Sales | `deals` | Deals (Table · Pipeline · Chat faces) | pipeline work | Data table + kanban + conversation workspace; detail drawer |
| Sales | `quotations` | Quotations | issue/revise/track quotes | List table → builder (form + live paper preview) → document page |
| Sales | `invoices` | Invoices | issue/track/pay invoices | Same pattern as Quotations, shared builder chrome |
| Sales | `business-enquiries` | BE list + Detail page | qualify · match · assign | Queue table with attention strip → decision page (tabs: match / assignment / history) |
| Catalogue | `plans` | Plans | plan catalogue | Table → drawer detail → modal form |
| Business Ops | `users` | Users list · Detail · Analytics | registered-user base | Table + facets → detail page; analytics dashboard |
| Finance | `finance` ×5 keys | Subscriptions · Salaries · Transactions · Refunds · Analytics | ledger of four record types | List tables with stat strips → detail pages → modals; analytics KPI dashboard |
| Team | `team` | Members + MemberPage (`/team/:id/:sub`) | roster, one person's operations | Table → member page (identity strip + operation launcher + op pages) |
| Team | `attendance` | Attendance | who is in | Derived-count rail as filter → date bar → day/month grid |
| Team | `work` | Tasks (List · Board · Calendar · Timeline · Analysis) | company tasks | Task list w/ status·priority·assignee·due; kanban; calendar; task drawer |
| Team | `reports` | Reports (Day · Actions · Analytics) | plans + EOD reports | Review list → action queue → analytics |
| Resources | `resources` | Data Forms (list · builder · fill) | forms the company sends | Table → builder page (sections, field editor) → responses |
| Resources | `agreements` | Agreements (list · editor) | documents to sign | Table → editor/preview |
| Settings | `roles` | Roles (matrix) | permissions | Matrix table + drawer |
| Settings | `audit` | Audit | append-only trail | Filterable table |
| door | `/login` | AdminAuth | sign in · pending · active | Split hero (ink + forest thread) + form |

URLs, query params (`?tab=`, `?view=`, `?period=`, `?item=`, `?form=`, `?new=`, `?mode=`), deep links and the `#/…` → path translation are all preserved.

## 3 · Styling foundation removed

`src/styles/tokens.css`, `src/styles/admin-theme.css`, `views/charts.css`, `views/*/*.css` (Agreements, BusinessEnquiries, Finance, Overview, Resources, Team, Users ×2), `admin/auth/admin-auth.css`, `components/overlays/Alert/Alert.module.css`, `components/shared/AdminLoader/AdminLoader.module.css`, `design/ramp.cjs` (rewritten), the `ICONS` map, every inline `style={{ color/padding/fontSize }}` in views, every raw `className="btn|inp|pill|card|tbl|faint|mono…"`. Functional files (stores, adapters, api, helpers, session, routes) are not touched.

## 4 · New design system structure

```
src/styles/globals.css     @import "tailwindcss"; theme.css; brand.css; plugins; dark variant on
                           BOTH `.dark-mode` and `[data-theme="dark"]`; base rules; the panel's
                           five @utility devices (label-mono, tnum, ticks, hairline, sheen)
src/styles/theme.css       Untitled UI theme.css VERBATIM (CLI 0.1.64) — never edited
src/styles/brand.css       the panel's decisions, all of them, in one file:
                             @theme  brand = forest ramp · gray = true neutral · fonts (Inter,
                                     JetBrains Mono) · --text-2xs 11px micro-label step ·
                                     chart slots (--color-chart-1..8, seq, pos/neg)
                             :root / dark overrides of the semantic tokens the panel needs
                                     (bg-nav, border-control 3:1, selected, skeleton, hero…)
src/components/base|application|foundations   Untitled UI components (copied, pinned, unedited
                                              except documented patches)
src/utils/cx.ts · src/providers/route-provider.tsx · src/hooks/*
src/admin/ui/*             the composition layer (below)
```

Tokens the whole product reads: colour via semantic utilities only (`bg-primary`, `bg-secondary`, `text-primary/secondary/tertiary/quaternary`, `border-primary/secondary`, `bg-brand-solid`, `text-brand-secondary`, `fg-success-primary`…), spacing = Tailwind 4px scale, radius = `rounded-md/lg/xl` (6/8/12), shadow = `shadow-xs/sm/md/lg/xl`, type = `text-xs/sm/md/lg/xl/display-xs…` + `text-2xs`, motion = `duration-100/150/200` + `ease-out`, breakpoints = Tailwind `sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536`. **No hex, rgb, px-colour or ad-hoc size in any view** — `check:dupes` asserts it for CSS and TSX.

## 5 · Theme strategy

- **Light**: white planes on a neutral-50 ground, near-black text. **Dark**: neutral-950 ground, neutral-900 planes (lighter than the ground = raised), neutral-50 text. Both are Untitled UI's own light/dark token sets with the panel's overrides in `brand.css`.
- **Brand = forest green** `#14704e` scale (25…950), replacing Untitled UI purple. Spent on: primary button, active nav row, selected row/tab/segment, links, focus ring, checked controls, progress, chart series 1, the login hero thread. Never as a status; success is Untitled UI green, warning yellow, error red, info blue — role separation is absolute.
- **Theme switch**: one preference (`light | dark | system`) in `ib_admin_theme`; `ShellContext.applyTheme` sets `data-theme` AND toggles `.dark-mode` on `<html>`; `index.html` pre-paints both. Existing `check:menu` semantics preserved.
- **Character budget (subtle sci-fi)**: tracked 11px mono micro-labels for metric names and column heads; hairline borders; corner ticks on measured surfaces only; a 1px inner sheen in dark; tabular numerals everywhere a figure appears; motion 100–200 ms, transform/opacity only; `prefers-reduced-motion` honoured. Nothing glows, nothing is neon, no gradients.

## 6 · Required shared components (`src/admin/ui`, one drawing each)

| File | Exports (kept names ⇒ existing call sites compile) |
| --- | --- |
| `icon.tsx` | `Icon name size` (name map → `@untitledui/icons`), `ICON_NAMES` |
| `buttons.tsx` | `Button` (re-export, brand primary / secondary / tertiary / link / destructive), `IconButton`, `ButtonGroup`/`Segmented` |
| `fields.tsx` | `FormField`, `Input`, `Textarea`, `SelectInput` (native), `InputGroup`, `Checkbox`, `Radio`, `Toggle`, `DateInput`, `DateRange`, `MultiSelect`, `FileUpload`, `ChipInput`, `Field` (legacy) |
| `select.tsx` | `Select` (filter listbox, RAC Select), option shape unchanged |
| `menu.tsx` | `MoreMenu`, `MenuItem`, `MenuSection`, `MenuDivider` (RAC Menu/Popover) |
| `status.tsx` | `Pill` (→ Badge, rounded = state) , `Tag/Tags` (square = label, 11-hue palette via Untitled UI utility colours), `LeadStatus`, `DealStatus`, `Priority`, `Assignee`, `Pipeline`, `Meter`, `Delta` |
| `data.tsx` | `Table` (card table), `ListTable` + `Rail` (queue table, sticky head, exception stripe), `DataTable` (RAC Table w/ sort + selection), `Pagination`, `StatStrip`, `FilterChips`, `SearchField`, `Toolbar`, `FilterBar`, `KvList`, `ListSkeleton`, `PaneLoading`, `EmptyState`, `Tabs` |
| `page.tsx` | `PageHeader` (title · meta · actions), `SectionHead`, `Card`, `Eyebrow`, `TbTitle`, `Breadcrumbs` |
| `overlays.tsx` | `ModalHead`, `ModalShell`, `ConfirmModal`, `DrawerHead`, `DrawerShell`, `Tooltip`, `InfoDot`, `Alert`/`Notice`, `Toast` renderer |
| `people.tsx` | `Avatar`, `Person`, `initials`, `avatarTone` |
| `feed.tsx` | `Timeline`, `ActivityFeed` |
| `charts` (views/charts.tsx) | `ColumnChart`, `Waterfall`, `SignedColumns`, `Spark`, `FunnelChart`, `BarRows`, `CohortHeat`, `ChartFrame`, `Legend`, `niceScale` — recharts |
| `shell/CommandPalette.tsx` | `CommandMenu` on RAC Dialog + ListBox (same sources) |
| helpers | `qs`, `cap`, `shareOrCopy`, `copyToClipboard`, `publicDocUrl`, `printHtml`, `ShareLine`, `richText`, `BRAND_MARK`, `BrandLogo`, `format.ts` unchanged |

Rule for the agents: **a module may not add a shared primitive**. It composes these with Tailwind utilities; a genuinely module-local drawing (the enquiry lifecycle dots, the kanban card, the calendar chip, the quotation paper) lives in that module's `bits.tsx` as a component, never as a class in a stylesheet.

## 7 · Page-by-page UX approach

| Module | Keep | Change |
| --- | --- | --- |
| Overview | 8-section reading order, derivations, URL filters, ⓘ definitions | KPI tiles become `StatCard` with trend + period; one trend chart + one ranking above the fold; Needs-attention as a ranked task list with severity rail and one action each; quick actions in the page header |
| Deals | three faces in the topbar slot, URL-driven filters, drawer detail, chat workspace | Table face on `ListTable` with sortable heads and right-aligned money; Pipeline as kanban columns with stage totals; Chat as a true conversation layout (list pane · thread · context pane) with grouped messages and a composer that is only writing space |
| Quotations / Invoices | builder → preview → issue flow, document paper, share links | One `DocumentBuilder` chrome shared by both; the paper stays black-on-white in both themes via `print:`/scoped utilities; status and installment tables on `Table` |
| Business Enquiries | five-stage lifecycle, decision page, export/share/print | Queue with stat strip + filter bar; record page with identity header, `Tabs` (Match · Assignment · History), suggestions as ranked cards with factor breakdown, contact log as `Timeline` |
| Plans / Roles / Audit | data + drawers | Plain `ListTable` pages; Roles matrix with sticky first column; Audit facets as `Select`s |
| Users | list · detail · analytics, facet picker, date range | `DataTable` with facet chips; detail page with `KvList` sections; analytics on the new charts |
| Finance | five sidebar rows, one store, installments, slips | Every list on `ListTable` + `StatStrip`; detail pages with `KvList` + `Timeline`; modals on `ModalShell`; Analytics as KPI row + waterfall + signed columns |
| Team · Members / MemberPage | member as a place, op pages at `/team/:id/:sub` | Identity strip + operation launcher as an icon grid; each op page is `PageHeader` + table/list |
| Team · Attendance | rail is the filter | Rail as segmented stat cells; month grid on a tokenised heat scale |
| Team · Tasks | five faces, drawer keyed by `?item=` | List = task table (status · priority · assignee · due · rail); Board = kanban; Calendar = month grid with chips; Timeline; Analysis charts; task drawer on `DrawerShell` |
| Team · Reports | Day · Actions · Analytics | Day as review cards in a two-column read; Actions as a queue table; analytics on charts |
| Resources / Agreements | builder, fill, responses; editor, preview | Builder as a two-pane page (field list · editor) with `FormField`s; Agreements editor with sticky preview |
| Login | three steps, banners, theme switch | Ink hero with the forest thread, Untitled UI form, `Alert` banners |

## 8 · Responsive strategy

- `≥1280` full sidebar (264px) + content max 1440; `1024–1279` sidebar collapses to the slim rail; `<1024` sidebar becomes a slide-out drawer behind a mobile header; `<768` tables scroll inside their frame with sticky first column, stat strips scroll horizontally, filter bars collapse to a "Filters (n)" drawer, drawers go full-width, page header actions stack; `<640` KPI rows stack, charts keep height, forms one column.
- Every table sits in an `overflow-x-auto` frame; the body never scrolls horizontally.
- `useBreakpoint` (Untitled UI hook) is the only JS breakpoint reader.

## 9 · Component reuse strategy

- One `Button`. One `Input`. One `Select` for filters, one native `SelectInput` for forms. One `Badge`-based `Pill`. One `ListTable`/`Table`/`DataTable` family. One `ModalShell`/`DrawerShell`/`ConfirmModal`. One `PageHeader`. One `StatCard`/`StatStrip`. One `EmptyState`, one skeleton, one `Alert`, one `Timeline`, one `ActivityFeed`, one `Tabs`, one `Pagination`, one `MoreMenu`, one `Tooltip`, one `InfoDot`.
- Module-local drawings are React components in that module's `bits.tsx`, styled with utilities, never a class.
- `check:dupes` (rewritten) fails on: any `.css` outside `src/styles`, any colour literal outside `theme.css`/`brand.css`, any `style={{` carrying a colour/size in `src/admin`.

## 10 · Agent / task allocation

| Wave | Owner | Scope |
| --- | --- | --- |
| 0 | main session | deps · configs · `styles/*` · `components/*` (copied) · `admin/ui/*` · shell · auth · loader/error/service-down · `views/charts.tsx` · `views/chainStrip.tsx` · `views/teamShared.tsx` · registry lazy() · `design/COMPONENT-CONTRACT.md` |
| 1 | A1 Overview | `views/Overview/*` |
| 1 | A2 Catalogue+Settings | `views/Plans/*`, `views/Roles/*`, `views/Audit/*` |
| 1 | A3 Deals | `views/Deals/*` |
| 1 | A4 Team core | `views/Team/{index,bits,Detail,MemberPage,memberModals,status,marks,adopt}.tsx`, `views/Team/member/*` |
| 1 | A5 Team ops | `views/Team/{Attendance,Work,Reports,TodayPlan,workBits}.tsx` |
| 1 | A6 Finance | `views/Finance/*` |
| 1 | A7 Business Enquiries | `views/BusinessEnquiries/*` |
| 1 | A8 Users | `views/Users/*` |
| 1 | A9 Documents | `views/Quotations/*`, `views/Invoices/*` |
| 1 | A10 Forms | `views/Resources/*`, `views/Agreements/*` |
| 2 | Q1 Gates | `scripts/check-tokens.cjs`, `check-dupes.cjs`, `design/ramp.cjs`, `check-popover-triggers.cjs`, package scripts |
| 2 | Q2 Smokes | `scripts/*-smoke.tsx`, stubs, `shoot-*.cjs` |
| 2 | Q3 Visual + a11y | Playwright run of all 20 routes × 2 themes × 3 widths, axe pass, findings list |
| 3 | main session | polish from Q3 findings · `design/design-system.md` · CHANGELOG entry · memory |

Conflict rules: an agent edits only its scope; shared files are frozen after wave 0; module `.css` files are deleted by the main session after the wave, not by agents; stores/adapters/api are read-only for everyone.

## 11 · Implementation order

1. Phase 3 — tokens/theme (`globals.css`, `theme.css`, `brand.css`, fonts, `index.html`, vite/ts config, deps)
2. Phase 4 — component foundation (copy library, `cx`, providers, patches)
3. Phase 6 — page system + composition layer (`admin/ui/*`) — before the shell so the shell can use it
4. Phase 5 — global shell, auth, loader, error boundary, command menu
5. Phase 9 — charts (recharts) — before views so agents consume the final API
6. Phase 7/8 — views + interactions (wave 1, parallel)
7. Phase 10/11 — responsive, a11y, gates, smokes, screenshots (wave 2)
8. Phase 12 — polish, docs, changelog (wave 3)

## 12 · Risks and how each is held

| Risk | Hold |
| --- | --- |
| `react-aria-components` drift vs copied components | pin the scaffold's own lines (`1.16.x`), never float |
| Views that `querySelector('[data-filter="q"]')` (Plans, Roles, Team) | `SearchField` keeps `data-filter` on the real `<input>` |
| Smokes stub `window`; react-aria reads `HTMLElement.prototype.focus` | stubs define `HTMLElement/Element/Node` classes (known fix) |
| Popover dismissal (`data-act` rule) | RAC `Popover` owns dismissal; `data-act` kept harmless; check retired with a note |
| Bundle grows with react-aria + recharts | route-level `lazy()` in the registry; vendor chunking |
| Paper document must not go dark | document surface uses explicit white/black utilities, not semantic tokens |
| Ten agents, one repo | disjoint directories; main session integrates, builds, and deletes CSS |
