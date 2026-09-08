/* =============================================================================
   THE DUPLICATE SELECTOR GUARD
   -----------------------------------------------------------------------------
   ONE DESIGN SYSTEM MEANS ONE DEFINITION PER PART. A selector declared twice in
   the same file is not usually a variant — it is two people's idea of the same
   component, and the second one wins on properties they happen to share while
   the first goes on applying the ones it does not. That is how this panel ended
   up running two shimmer animations on every skeleton bar at once: `.sk` was
   declared twice, with two different mechanisms, and both matched.

   It is also how a module sheet quietly re-draws a shared part: `.fin-seg`,
   `.tm-seg` and `.btn-group` were three drawings of one control, and nothing
   flagged it because they had three different names.

   WHAT THIS CHECKS
     1. no selector is declared twice inside one stylesheet
     2. no MODULE sheet declares a selector the component layer already owns
     3. no colour literal outside tokens.css

   Rule 1 has genuine exceptions — a base rule plus a `@media` override, a rule
   split for readability — so they are listed in ALLOW below with the reason,
   rather than the check being loosened.

   `npm run check:dupes`.
   ============================================================================= */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "src");
const CORE = path.join(ROOT, "styles", "admin-theme.css");
const TOKENS = path.join(ROOT, "styles", "tokens.css");

/* Selectors that are legitimately declared more than once in one file. Each
   needs a reason, and the reason has to be about CASCADE, not about tidiness. */
const ALLOW = new Set([
  /* print and responsive blocks restate a selector on purpose */
  ".page", ".card", ".tw", ".sidebar", ".topbar", ".toolbar", ".tabs", ".app",
  ".content", ".scroller", ".drawer", ".modal", ".qdoc", ".empty",
  /* tokens.css is ORGANISED as repeated :root blocks, one per documented
     section — the L1 ramps, the non-colour primitives, the L2 semantic set for
     each theme, the paper set, the tag and channel sets, the legacy vocabulary,
     the shorthand. They declare disjoint properties and the file's structure is
     the reason anybody can find a token in it. Collapsing them into one block
     would be a 500-line wall with no headings. */
  ":root", ':root[data-theme="dark"]', ':root, :root[data-theme="light"]',
]);

function read(file) {
  return fs.readFileSync(file, "utf8")
    /* comments hold example selectors; they are not declarations */
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

/* Every top-level selector in a sheet, with the line it is on. Rules nested in
   an at-block (@media, @supports, @keyframes) are skipped — those exist to
   restate a selector and flagging them would be flagging the feature. */
function selectors(src) {
  const out = [];
  let depth = 0, atDepth = -1, buf = "", line = 1;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "\n") line++;
    if (c === "{") {
      if (depth === 0) {
        const sel = buf.trim();
        if (sel.startsWith("@")) atDepth = depth;
        else if (sel && atDepth < 0) {
          /* THE WHOLE RULE HEAD, not each selector in it. `button,input,select
             {font:inherit}` followed by `button{cursor:pointer}` is ordinary
             CSS — a group that sets what they share, then one that sets what
             only one of them needs — and comparing the members flagged every
             such pair as a duplicate. What is worth flagging is the same rule
             head written twice, which is what put two competing `.sk` rules and
             two `.ticks` rules in this file. */
          const norm = sel.split(",").map((x) => x.trim().replace(/\s+/g, " "))
            .filter(Boolean).sort().join(", ");
          if (norm) out.push({ sel: norm, line });
        }
      }
      depth++; buf = "";
      continue;
    }
    if (c === "}") {
      depth--;
      if (depth === 0 && atDepth === 0) atDepth = -1;
      buf = "";
      continue;
    }
    if (depth === 0) buf += c;
  }
  return out;
}

let bad = 0;
const say = (ok, msg) => { if (!ok) bad++; console.log((ok ? "ok   " : "FAIL ") + msg); };

/* ---------------------------------------------- 1 · duplicates within a file */
const sheets = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".css")) sheets.push(p);
  }
})(ROOT);

for (const f of sheets) {
  const rel = path.relative(ROOT, f).split(path.sep).join("/");
  const seen = new Map();
  const dupes = [];
  for (const { sel, line } of selectors(read(f))) {
    if (ALLOW.has(sel)) continue;
    if (seen.has(sel)) dupes.push(sel + "  (lines " + seen.get(sel) + " and " + line + ")");
    else seen.set(sel, line);
  }
  say(dupes.length === 0,
    rel.padEnd(44) + (dupes.length ? dupes.length + " duplicate selector(s)" : "no duplicate selectors"));
  for (const d of dupes) console.log("       " + d);
}

/* -------------------------------- 2 · a module re-declaring a shared part */
const coreOwned = new Set(
  selectors(read(CORE)).map((s) => s.sel).filter((s) => /^\.[a-zA-Z][\w-]*$/.test(s))
);
for (const f of sheets) {
  const rel = path.relative(ROOT, f).split(path.sep).join("/");
  if (rel.startsWith("styles/")) continue;
  const clash = selectors(read(f))
    .map((s) => s.sel)
    .filter((s) => /^\.[a-zA-Z][\w-]*$/.test(s) && coreOwned.has(s));
  say(clash.length === 0,
    rel.padEnd(44) + (clash.length
      ? "re-declares " + clash.length + " shared class: " + Array.from(new Set(clash)).join(", ")
      : "declares nothing the component layer owns"));
}

/* ------------------------------------- 3 · colour literals outside tokens.css */
for (const f of sheets) {
  if (f === TOKENS) continue;
  const rel = path.relative(ROOT, f).split(path.sep).join("/");
  const src = read(f)
    /* a data: URI carries its own encoded colours and cannot read a property */
    .replace(/url\((["']?)data:[^)]*\1\)/g, "url(data)");
  const hits = (src.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)|\bhsla?\([^)]*\)/g) || [])
    .filter((h) => !/^rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/.test(h));
  say(hits.length === 0,
    rel.padEnd(44) + (hits.length
      ? hits.length + " colour literal(s): " + Array.from(new Set(hits)).slice(0, 6).join(" ")
      : "no colour literals"));
}

console.log("\n" + (bad ? bad + " problem(s)" : "one definition per part, and no colour outside tokens.css"));
process.exit(bad ? 1 : 0);
