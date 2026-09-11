# Wave-1 brief — rebuilding one module on the new UI system

You are one of ten agents rebuilding the Interior bazzar admin panel's views on the new
design system. The foundation is done and green; your job is ONE module, complete, to a
senior product-designer standard. Read this whole file, then the two documents it names,
before you open a view.

## What has already happened (do not redo)

- Repo: `D:/Programming/interior-bazzar/interior-bazzar-admin` (branch `proto-2.3.0.0`).
  React 19 · TS 5.8 · Vite 7 · react-router 7. Windows Git Bash: use absolute paths, never
  `cd`, and write files with the Write/Edit tools (long heredocs fail here).
- The old styling foundation (`tokens.css`, `admin-theme.css`, the hand-drawn icon set) is
  **deleted**. The panel now runs **Untitled UI React** (Tailwind CSS 4 + React Aria) with a
  forest-green brand on a black/white/neutral base, light and dark.
- `src/admin/ui/*` is the composition layer: the same export names the views already import
  (`Pill`, `Tile`, `Table`, `ListTable`, `StatStrip`, `Tabs`, `Select`, `Input`, `ModalShell`…)
  now render the library. **Your module compiles today** — it is just still written in the
  old class vocabulary (`className="btn pri"`, `"inp"`, `"dls-cmd"`, `"tm-*"`, inline styles,
  a module `.css` file whose tokens no longer exist), so it looks broken.
- The shell (sidebar, topbar, modals, drawers, toasts, command menu) is rebuilt. `useShell()`,
  `usePageChrome()`, `useNav()`, `can()` keep their APIs.

## Read, in this order

1. `design/COMPONENT-CONTRACT.md` — the rules, the parts, the utility vocabulary, the page
   skeleton, and the interaction patterns. Everything you write must obey it.
2. `src/proto/v-2.2.0.0/OPERATION-2026-09-08-ui-rebuild.md` §7 — the UX approach for your
   module (keep what is listed under Keep, change what is under Change).
3. `src/admin/ui/index.tsx` and the files it re-exports (`buttons`, `fields`, `select`,
   `menu`, `status`, `data`, `page`, `overlays`, `people`, `feed`, `icon`) — the parts you
   compose. `src/admin/views/charts.tsx` for charts. `src/admin/views/teamShared.tsx` and
   `chainStrip.tsx` are already rebuilt; use them as reference implementations of the style.
4. Your module's files. Read every one fully before editing any.

## If a previous attempt was interrupted

The working tree may already hold partial work in your scope from an earlier run of this
same brief (an API limit cut it off mid-file). `git status --short <your dir>` and
`git diff --stat -- <your dir>` show what was touched. Read those files first: keep what
is on the system and complete, fix what is half-done, and finish the rest. Never
`git checkout` a file to undo it — the pre-rebuild version is on the old class vocabulary
and is not a better starting point.

## Your job

Rewrite the JSX of every file in your scope so the module is composed of the shared parts
and Tailwind utilities — a page that looks and behaves like it was designed with every other
page by one team: `PageHeader` → `FilterBar` → `StatStrip` → the right pattern for the data
(table / board / calendar / conversation / form / document), with empty, loading and error
states, responsive states (`sm`/`md`/`lg`), and keyboard/screen-reader access.

**Rethink the experience, preserve the capability.** Every handler, API call, store call,
URL/query-param semantic (`?tab=`, `?view=`, `?item=`, `?period=`…), `can()` gate,
`usePageChrome` claim, `useShell()` modal/drawer/toast, DOM hook that logic reads
(`data-filter`, `id`s read by `val(id)` / `querySelector`, `#rlMatrix`, `#tmRoles`), and
every **exported name and prop signature** (other modules import from your files) must
survive unchanged. Layout, hierarchy, density and drawings are yours to redesign.

Concretely:

- Remove **every** old class name (`btn`, `inp`, `pill`, `card`, `tbl`, `tw`, `faint`, `mono`,
  `fg`, `help`, `page`, `ph`, `sh`, `kv`, `md-*`, `dw-*`, `dls-*`, `chip`, `av`, `tile`, `spacer`,
  `tnum`-as-class-only-is-fine, and your module prefix `tm-`/`fin-`/`be-`/`um-`/`rs-`/`ag-`/
  `ov-`/`dws-`/`ch-`…). Replace with the shared components or utilities.
- Remove every `style={{…}}` that carries a colour, font, size, padding, margin or radius.
  A computed geometry (`width: pct + "%"`, a grid column count) may stay.
- Delete the `import "./x.css"` lines in your files. **Do not delete the `.css` files or
  `charts.css` themselves** — the main session removes them after the wave (another agent
  may still import a shared one). Remove `import "../charts.css"` too.
- Replace raw `<button className="btn …">` with `<Button color size ico>` /
  `<IconButton label>`; raw `<input className="inp">` with `<Input>`/`<FormField>`;
  hand-drawn tabs with `<Tabs>`; hand-drawn modal heads with `<ModalShell>`; hand-drawn
  status chips with `<Pill>`/`<LeadStatus>`/`<DealStatus>`; `<span className="av">` with
  `<Avatar>`; `Icon name` stays as is.
- Module-local drawings (a kanban card, a calendar cell, a document page, a lifecycle dot
  ramp, a queue row) become **components in your module's `bits.tsx`** (create one if
  needed), built from utilities on the semantic tokens. No new shared primitives.
- Icons: keep `<Icon name="…">`; if a glyph is missing from `src/admin/ui/icon.tsx`, import
  the glyph from `@untitledui/icons` directly and pass it where a component takes
  `icon={…}` / `iconLeading={…}`. Do not add inline SVG paths.

## Do not touch

`store.ts`, `adapter.ts`, `useDeals.ts`, `api.ts`, `helpers.ts`, `*.test.ts`, `payrollYear.ts`,
`types.ts`, `exportCsv.ts`, `imageSheet.ts`, `share.ts`, `ops.ts`, `derive.ts` in any module;
`src/api/**`, `src/admin/ui/**`, `src/admin/shell/**`, `src/admin/auth/**`, `src/components/**`,
`src/styles/**`, `src/admin/views/registry.tsx`, `charts.tsx`, `teamShared.tsx`,
`chainStrip.tsx`, `scripts/**`, `design/**`, `package.json`, any other module's directory.
If you need something from one of those, say so in your report instead of editing it.

## Verify (all four, every time, before you report)

```
npx tsc -p tsconfig.app.json --noEmit --incremental false     # 0 errors IN YOUR FILES (other modules may be mid-rewrite by other agents — ignore theirs, never edit them)
npx eslint <your files>                                        # clean
npx vite build --mode dev --outDir .tmp/dist-<your id>         # builds (own outDir: others build too)
SHOT_PORT=<your port> SHOT_ROUTES=<your routes> SHOT_OUT=<your id> node scripts/shoot-modules.cjs
```

The last one boots the real shell against a mocked session and writes
`.tmp/<your id>/{light,dark}-<route>.png`. **Look at every image with the Read tool**, in both
themes, and fix what looks wrong: alignment, spacing, contrast, truncation, a control that
did not take the system, an empty state that is a blank. Iterate until it reads as one product
with the shell around it. Routes with API data will photograph their EMPTY state — design it.
For screens behind a record id or a query (a detail page, a drawer, a modal), open them in a
short Playwright script of your own (copy the mock setup from `scripts/shoot-modules.cjs`,
use your port) and photograph those too.

Do **not** run `npm run check:*-render` or `check:users-render`/`finance-render`/`team-render`/
`resources-render`/`agreements-render` — those render-smokes assert the old class names and are
rewritten in wave 2. Do run your module's store checks if it has them (`check:enquiries`,
`check:export`, `check:clock`, `check:share`, `check:wiring`, `check:match`, `check:users`,
`check:finance`, `check:team`, `check:overview`, `check:resources`, `check:agreements`) — they
prove you did not touch logic.

## Report

When you finish: (1) append one entry for your module to `src/proto/v-2.2.0.0/CHANGELOG.md`
under today's date using `LOG-FORMAT.md`; (2) reply with a SHORT summary — files rewritten,
module-local components created in `bits.tsx`, anything you could not do and why, any shared
part you found missing (with the props you wanted), and the exact commands you ran with their
result. Report faithfully: if a screenshot still looks wrong, say so.
