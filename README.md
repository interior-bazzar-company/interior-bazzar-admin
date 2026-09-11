# Interior bazzar — Admin

The internal operations panel: deals, quotations, invoices, business enquiries, the
registered-user base, finance, the team (members, attendance, tasks, reports), data forms,
agreements, roles and the audit trail — one shell, one design system, two themes.

## Stack

| | |
| --- | --- |
| App | React 19 · TypeScript 5.8 · Vite 7 · react-router 7 · Redux Toolkit (auth) |
| UI | **Untitled UI React** — Tailwind CSS 4 + React Aria Components — with the panel's forest-green brand on a black / white / neutral base |
| Charts | recharts, on the `--color-chart-*` tokens |
| Icons | `@untitledui/icons` |
| Checks | Node scripts under `scripts/` and `design/`; Playwright for the browser checks and screenshots |

## Run

```
npm install
cp .env.sample .env        # VITE_BASE_URL = the Django API root, ending in /api
npm run dev                # http://localhost:3000
npm run build              # tsc -b && vite build --mode prod
```

## Where things are

```
src/styles/          globals.css (the entry) · theme.css (Untitled UI, verbatim) · brand.css (every decision the panel makes)
src/components/      Untitled UI's components, copied by the CLI — never edited, except documented patches
src/admin/ui/        the composition layer: the parts every screen is made of (see design/COMPONENT-CONTRACT.md)
src/admin/shell/     the shell — sidebar, topbar, layers (modal · drawer · popover · toast), command menu, theme
src/admin/auth/      the door, and the one resolved permission matrix (`can()`)
src/admin/views/     one directory per module; `registry.tsx` maps route → view (lazy)
src/api/             the HTTP layer and per-module services
src/content/         seed JSON standing in for endpoints that do not exist yet (src/proto/v-2.2.0.0/BACKEND-INTEGRATION.md)
src/proto/v-2.2.0.0/ the working log (CHANGELOG.md), operation documents, the backend work-list
design/              design-system.md · COMPONENT-CONTRACT.md · ramp.cjs (the contrast guard)
scripts/             the check suite and the screenshot harnesses
```

## Checks

```
npm run check              # every store check, the render smokes and the three system gates
npm run check:tokens       # every var(--x) the panel reads is defined
npm run check:contrast     # 84 colour pairs clear WCAG in both themes, read from the real token sheets
npm run check:dupes        # one place for stylesheets, one for colour, no inline design values, no retired classes
npm run check:menu         # drives the theme switch in a real browser
npm run shots              # photographs every shared part in both themes → .tmp/appearance/
node scripts/shoot-modules.cjs   # photographs all 20 routes in both themes → .tmp/modules/
```

## Conventions

- Every change is logged in `src/proto/v-2.2.0.0/CHANGELOG.md` (format: `LOG-FORMAT.md`).
- No view branches on a role name — it asks `can(moduleKey, action)`.
- Filters live in the URL; a deep link is a filter.
- A module has no stylesheet: every drawing is a component on the tokens. `check:dupes` asserts it.
