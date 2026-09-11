/* =============================================================================
   THE ONE-SYSTEM GUARD
   -----------------------------------------------------------------------------
   ONE DESIGN SYSTEM MEANS ONE PLACE FOR EVERY DECISION. This asserts the
   structure that keeps it true:

     1. no stylesheet outside src/styles — a module has no CSS of its own;
        every drawing is a component on utilities
     2. no colour literal outside the two token sheets (theme.css, brand.css) —
        not in globals.css, not in a `className`, not in a `style={{}}`
     3. no inline style carrying a colour, font, size, spacing or radius —
        a computed geometry (`width: pct + "%"`) is allowed, a design value is not
     4. none of the retired class vocabulary (`btn`, `inp`, `pill`, `tm-*`, …)
        anywhere in src/admin — the old system cannot creep back one class at
        a time

   `npm run check:dupes`.
   ========================================================================== */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else files.push(p);
  }
})(SRC);

let bad = 0;
const say = (ok, msg) => { if (!ok) bad++; console.log((ok ? "ok   " : "FAIL ") + msg); };

/* ---------------------------------------------- 1 · stylesheets live in one place */
const sheets = files.filter((f) => f.endsWith(".css"));
const stray = sheets.filter((f) => !rel(f).startsWith("src/styles/"));
say(stray.length === 0, stray.length ? "stylesheets outside src/styles: " + stray.map(rel).join(", ") : "every stylesheet is in src/styles (" + sheets.length + ")");
const expected = ["src/styles/globals.css", "src/styles/theme.css", "src/styles/brand.css"];
say(expected.every((e) => sheets.some((f) => rel(f) === e)), "the three sheets exist: " + expected.join(", "));

/* ------------------------------ 2 · colour literals only in the token sheets */
const COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)|\bhsla?\([^)]*\)|\boklch\([^)]*\)/g;
const TOKEN_SHEETS = new Set(["src/styles/theme.css", "src/styles/brand.css"]);
const LIB = /^src\/components\/(base|application|foundations|shared-assets)\//;
for (const f of files) {
  const r = rel(f);
  if (TOKEN_SHEETS.has(r) || LIB.test(r) || !/\.(css|tsx|ts)$/.test(r)) continue;
  if (/\/(store|adapter|api|helpers|exportCsv|imageSheet|share|types|payrollYear|derive)\.ts$/.test(r)) continue; // data, not paint
  if (/^src\/(api|redux|types|utils|config|hooks|content|proto)\//.test(r)) continue;
  const src = strip(fs.readFileSync(f, "utf8"))
    .replace(/url\((["']?)data:[^)]*\1\)/g, "url(data)")
    .replace(/data:image\/svg\+xml[^"'`)]*/g, "data:svg");
  /* a `#` followed by hex is only a colour when it sits where a value sits —
     after a quote, a colon, a bracket or a space — never `#page` or `#/deals` */
  const real = [];
  for (const m of src.matchAll(/(^|["'`:[(\s])(#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![\w-]))|\brgba?\([^)]*\)|\bhsla?\([^)]*\)|\boklch\([^)]*\)/gm)) {
    const h = m[2] || m[0];
    if (/^rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/.test(h)) continue;
    real.push(h);
  }
  void COLOUR;
  say(real.length === 0, r.padEnd(60) + (real.length ? real.length + " colour literal(s): " + Array.from(new Set(real)).slice(0, 5).join(" ") : "no colour literals"));
}

/* ------------------------------------------- 3 · inline styles carry no design */
/* a design KEY with a LITERAL value — `color: "#…"`, `padding: 8`, `fontSize:
   "13px"`. A computed value (`background: s.color`, `width: pct + "%"`) is
   geometry the caller owns and passes the gate. */
const STYLE_KEYS = /\b(color|background|backgroundColor|fontSize|fontFamily|fontWeight|lineHeight|padding[A-Z]?[a-z]*|margin[A-Z]?[a-z]*|borderRadius|border(Color|Width)?|boxShadow|letterSpacing|gap|opacity)\s*:\s*(["'`]|\d)/;
for (const f of files) {
  const r = rel(f);
  if (!/^src\/admin\/.*\.tsx$/.test(r)) continue;
  const src = strip(fs.readFileSync(f, "utf8"));
  const offenders = [];
  for (const m of src.matchAll(/style=\{\{([^}]*)\}\}/g)) if (STYLE_KEYS.test(m[1])) offenders.push(m[1].trim().slice(0, 60));
  say(offenders.length === 0, r.padEnd(60) + (offenders.length ? offenders.length + " inline design style(s): " + offenders.slice(0, 3).join(" | ") : "no inline design values"));
}

/* --------------------------------------------- 4 · the retired vocabulary */
const RETIRED_EXACT = new Set(
  ("btn inp pill tile tiles tbl tw card card-h card-b card-f fg fg-lb fg-err help page ph ph-t sh kv chip chiprow av req lnk tlink " +
    "sel-t sel-list sel-o msel menu mi msep notice empty sk tabs crumbs toolbar field check sw sw-row daterange dropzone affix meter " +
    "delta eyebrow who tl tl-i feed fd pipe legend chartframe dim spacer scrim modal drawer banner toast toasts pop kbd spinner pane-load " +
    "selectbox btn-group seg pager pager-bar unassigned i-btn i-pop tt tt-wrap chips-input is-tag is-auto ct min-0 trunc faint mono " +
    "dayline dgr ghost pop-h pop-b pop-f tb-btn tb-title sb-item sb-group sb-label rail-hide").split(/\s+/),
);
const RETIRED_PREFIX = /^(tm|fin|be|um|rs|ag|ov|dws|ch|dls|md|dw|qd|ib|cmdk|sb|tb|tgr|tml|sel|st|tag)-/;
/* THE TABLE RHYTHM IS NOT THE RETIRED VOCABULARY. `ui/data`'s CELLS declares a
   handful of one-word classes a cell may carry — `n`, `mono`, `faint`, `rail`,
   `cell-1` — and applies them from the table wrapper. They are the system, so
   they are allowed, but ONLY on a cell: `<span className="mono">` is still the
   old standalone class and still wrong. */
const CELL_OK = new Set("n num r amt c t mono faint rail acts cell-1 cell-2 on sel clickable is-link".split(" "));
const tagOf = (src, i) => {
  const open = src.lastIndexOf("<", i);
  return open < 0 ? "" : (src.slice(open + 1, open + 5).match(/^[a-zA-Z]+/) || [""])[0].toLowerCase();
};
for (const f of files) {
  const r = rel(f);
  if (!/^src\/admin\/.*\.tsx$/.test(r)) continue;
  const src = strip(fs.readFileSync(f, "utf8"));
  const found = new Set();
  for (const m of src.matchAll(/className=\{?\s*["'`]([^"'`]*)["'`]/g)) {
    const cell = /^(td|th)$/.test(tagOf(src, m.index));
    for (const tok of m[1].split(/\s+/)) {
      if (!tok) continue;
      const t = tok.replace(/^[a-z-]+:/, ""); // drop a variant prefix
      if (cell && CELL_OK.has(t)) continue;
      if (RETIRED_EXACT.has(t) || RETIRED_PREFIX.test(t)) found.add(tok);
    }
  }
  say(found.size === 0, r.padEnd(60) + (found.size ? found.size + " retired class(es): " + [...found].slice(0, 6).join(" ") : "on the system"));
}

console.log("\n" + (bad ? bad + " problem(s)" : "one system: one place for stylesheets, one place for colour, no inline design values, no retired classes"));
process.exit(bad ? 1 : 0);
