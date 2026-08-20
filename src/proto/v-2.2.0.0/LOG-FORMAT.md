# Log format

Every entry in [CHANGELOG.md](CHANGELOG.md) uses this shape. The fields are
fixed so that **Temp data** and **Backend needed** can be read straight off as
the API work-list once the UI is done — no archaeology, no re-reading
components.

Newest entries at the top, grouped under a `## YYYY-MM-DD` date heading.

## Template

```md
### <Feature name in plain words>

**Area:** <route(s) or surface — e.g. `#/business-enquiries`, sidebar → Client Ops>
**Files:** <paths added / changed, comma-separated>

**What changed**
<2–5 lines. What a user can now do that they could not before, and the one
structural decision worth remembering. Not a diff summary.>

**Temp data**
<`src/content/<module>/<file>.json` → which keys this feature reads, and whether
they are placeholder records or permanent static copy. Write `none` if the
feature is fully live.>

**Backend needed**
- `GET /api/v1/<path>` → <payload it must return, and which content file it
  replaces>
- <or> `none — already live via AdminOpsService.<method>()`

**Open decisions**
<Product questions this feature had to assume an answer to, with the ID from the
module spec. Write `none` if it assumed nothing. An assumption shown on screen
is fine; an assumption nobody wrote down is not.>

**Verified**
<How it was actually checked. Say plainly what could NOT be checked and why.>
```

## Field rules

| Field | Rule |
| --- | --- |
| **Area** | Route or sidebar surface, so an entry is findable by where it shows up — not by component name alone. |
| **Files** | Real paths. A reader must be able to open them without searching. |
| **What changed** | User-visible behaviour first. Reusing an existing primitive instead of duplicating one is worth a line; renamed CSS classes are not. |
| **Temp data** | Distinguish **placeholder records** (awaiting an endpoint) from **static copy** (labels, empty states, vocabulary labels — permanent). Only the first becomes backend work. |
| **Backend needed** | One line per endpoint, in `METHOD path → payload` form. Write `none` explicitly rather than omitting the field — a missing field reads as "not yet decided". |
| **Open decisions** | Carry the spec's own ID (`BE-OD-04`, …) so the register and the code point at each other. A screen that assumes an answer must also say so on the screen. |
| **Verified** | Untested is normal on this branch; **unstated is not**. If a step needs a live API or a running backend, say which step and why. |

## Conventions

- **One entry per feature, not per commit.** A feature touched over three
  commits gets one entry, updated in place until it ships.
- **Corrections are new entries, not edits.** If an earlier entry turns out to
  be wrong, add a dated entry saying what was superseded and why. History stays
  readable.
- **Cross-reference, don't duplicate.** Per-file endpoint status lives in
  [BACKEND-INTEGRATION.md](BACKEND-INTEGRATION.md); a changelog entry links to
  it rather than restating the map.
- **A simulated write is named as one.** Any module whose actions do not reach a
  server says so in **What changed**, in the same words the screen says it.
