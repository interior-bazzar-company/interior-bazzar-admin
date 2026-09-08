/* Every var(--x) the panel reads must be defined somewhere the panel loads.
   An undefined custom property does not error — the declaration is simply
   dropped, so a missing token is an invisible hole, which is exactly the kind
   of thing a re-skin leaves behind. This walks the real CSS and reports them.

   A read WITH a fallback — `var(--x, Georgia, serif)` — carries its own
   answer and is not a hole; only a bare `var(--x)` needs the property.

   Untitled UI's own code (components/{base,application,foundations,
   shared-assets} and styles/untitled) is styled by Tailwind, whose default
   palette and scales (--color-slate-*, --spacing …) are emitted at build time
   from node_modules, not from anything under src. Those files DEFINE tokens
   the panel reads, so they stay on the defining side; they are just not
   walked as consumers. */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "src");
const LIBRARY = /\/(components\/(base|application|foundations|shared-assets)|styles\/untitled)\//;

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(css|tsx|ts)$/.test(e.name)) files.push(p);
  }
})(ROOT);

const defined = new Set();
const consumed = new Map(); // name -> Set(relative files)

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const rel = path.relative(ROOT, f).split(path.sep).join("/");
  for (const m of src.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)) defined.add(m[1]);
  if (LIBRARY.test("/" + rel)) continue;
  for (const m of src.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)\s*([,)])/g)) {
    if (m[2] === ",") continue;
    if (!consumed.has(m[1])) consumed.set(m[1], new Set());
    consumed.get(m[1]).add(rel);
  }
}

const missing = [...consumed.keys()].filter((k) => !defined.has(k)).sort();
if (!missing.length) {
  console.log(`ok — every one of ${consumed.size} custom properties read is defined.`);
} else {
  console.log(`${missing.length} custom propert${missing.length === 1 ? "y" : "ies"} read but never defined:\n`);
  for (const k of missing) console.log(`  ${k.padEnd(28)} ${[...consumed.get(k)].join(", ")}`);
}
process.exit(missing.length ? 1 : 0);
