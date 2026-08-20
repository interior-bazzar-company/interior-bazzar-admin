# proto v-2.2.0.0 — admin panel

Working log for frontend-first work in `interior-bazzar-admin`. **Nothing in
this folder is imported by the app.** It is documentation, and it is the
backend work-list.

## Why this folder exists

Most of this panel reads live records from `AdminOpsService`. Some modules are
built the other way round: the screens are designed and built first, against
static content, and the API is specified *from the finished UI* rather than
guessed at before it.

That is what this folder records. When a module needs data the backend does not
serve yet, the screens render from JSON under `src/content/<module>/`, and every
one of those files is shaped like the endpoint that will replace it. The map
from file → consumer → endpoint is
[BACKEND-INTEGRATION.md](BACKEND-INTEGRATION.md); it is the list a backend
engineer works down.

## Files

| File | What it is |
| --- | --- |
| [CHANGELOG.md](CHANGELOG.md) | What changed, newest first. One entry per feature. |
| [BACKEND-INTEGRATION.md](BACKEND-INTEGRATION.md) | Content file → consumer → endpoint map. The backend work-list. |
| [LOG-FORMAT.md](LOG-FORMAT.md) | The shape every changelog entry uses, and why the fields are fixed. |

## The temp-data convention

**Temp data lives in `src/content/<module>/<payload>.json`** — one file per
endpoint-shaped payload, not one file per module.

```
src/content/business-enquiries/
  enquiries.json        → GET /business-enquiries and /business-enquiries/{id}
  suggestions.json      → GET /business-enquiries/{id}/business-suggestions
  matching-rules.json   → GET /business-enquiries/matching-rules
  businesses.json       → a READ of the Business Profile module
  vocabularies.json     → GET /business-enquiries/vocabularies
```

Rules:

1. **One file per endpoint, not per screen.** The point of the convention is
   that the split survives into the API. A single blob file would have to be
   taken apart again later, by someone who was not here.
2. **Shape it like the endpoint should return, not like the DB row.** The view
   layer reconciles the two. That keeps the backend free to model the data
   properly rather than inheriting whatever was convenient for a React
   component.
3. **JSON, not TS.** The frontend repo's proto branch uses typed TS content
   modules; this one uses JSON deliberately, because these files are read by a
   backend engineer as much as by a bundler, and because a JSON file can be
   posted at a stub server or loaded into a fixture with no build step. Types
   for the shapes live beside the consumer, in the module's `store.ts`.
4. **A `$comment` key at the top of every file** naming the endpoint it stands
   in for. It is the first thing anyone opening the file needs, and JSON has no
   other place to put it.
5. **They must be committed.** The repo carries a project-wide `*.json` ignore
   rule (matching the backend's). `.gitignore` now carves out
   `!src/content/**/*.json` — without it the whole convention is invisible to
   git and the module builds to an empty screen for anyone who clones. If you
   add content under a new path, check `git status` actually sees it.
6. **Static copy stays static.** Labels, empty-state text and vocabulary
   *labels* belong in the content permanently. Only *records* are placeholders
   awaiting an endpoint.

## Going live

A screen is never rewritten when its endpoint lands. Each module keeps one data
module (`store.ts`) that is the only thing that knows where records come from:

```
src/content/<module>/*.json        the seed, always renders
        │
        └── store.ts               types · derives · the write functions
                    │
                    └── the views  never import JSON, never fetch
```

So the integration step for a module is: replace the imports at the top of
`store.ts` with `AdminOpsService` calls, and delete the in-memory write
simulation underneath. The views, the CSS and the URL scheme do not move.

## Also part of "going live"

A frontend-first module has **no `Module` row on the server**, so it has no
place in the permission matrix either. Two client-side stand-ins carry it until
it does, and both are listed in
[BACKEND-INTEGRATION.md](BACKEND-INTEGRATION.md) as work, not as design:

- `PROTO_MODULES` in `src/admin/auth/session.ts` — makes `can()` return true for
  the key. A real hole, safe only while the module has no server data to leak.
- `PROTO_ROWS` in `src/admin/shell/modules.ts` — puts the nav item there. It
  yields to a server row of the same key automatically, so the day the API
  sends one, nothing doubles up.
