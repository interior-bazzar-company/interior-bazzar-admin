/* =============================================================================
   Every custom property the panel reads is defined somewhere the panel loads.
   -----------------------------------------------------------------------------
   An undefined `var(--x)` does not error — the declaration is dropped, so a
   missing token is an invisible hole. This walks the panel's own code
   (src/admin, src/styles/{globals,brand}.css, src/components/shared) for bare
   `var(--x)` reads and checks each against the three files that define
   tokens: Tailwind's default theme, Untitled UI's theme.css and brand.css —
   plus the handful of runtime variables React Aria and Tailwind set on the
   element (`--trigger-width`, `--tw-*`).

   The library's own components (src/components/{base,application,…}) are
   written against the same three files and are not walked as consumers —
   they are Untitled UI's, verbatim, and read only what their theme defines.

   `npm run check:tokens`.
   ========================================================================== */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");

const defined = new Set();
for (const f of [
  path.join(ROOT, "node_modules", "tailwindcss", "theme.css"),
  path.join(SRC, "styles", "theme.css"),
  path.join(SRC, "styles", "brand.css"),
  path.join(SRC, "styles", "globals.css"),
]) {
  for (const m of strip(fs.readFileSync(f, "utf8")).matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)) defined.add(m[1]);
}
/* set at runtime by React Aria / Tailwind, not in any sheet */
const RUNTIME = /^--(tw-|trigger-|spacing$|radius-|shadow-|text-|font-|color-|breakpoint-|container-|ease-|animate-|blur-|tracking-|leading-|default-)/;

const consumers = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    const rel = path.relative(SRC, p).split(path.sep).join("/");
    if (e.isDirectory()) {
      if (/^components\/(base|application|foundations|shared-assets)/.test(rel)) continue;
      walk(p);
    } else if (/\.(css|tsx|ts)$/.test(e.name) && rel !== "styles/theme.css") consumers.push(p);
  }
})(SRC);

const consumed = new Map();
for (const f of consumers) {
  const rel = path.relative(SRC, f).split(path.sep).join("/");
  for (const m of strip(fs.readFileSync(f, "utf8")).matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)\s*([,)])/g)) {
    if (m[2] === ",") continue; // carries its own fallback
    if (!consumed.has(m[1])) consumed.set(m[1], new Set());
    consumed.get(m[1]).add(rel);
  }
}

const missing = [...consumed.keys()].filter((k) => !defined.has(k) && !RUNTIME.test(k)).sort();
if (!missing.length) {
  console.log(`ok — every one of ${consumed.size} custom properties read is defined.`);
} else {
  console.log(`${missing.length} custom propert${missing.length === 1 ? "y" : "ies"} read but never defined:\n`);
  for (const k of missing) console.log(`  ${k.padEnd(32)} ${[...consumed.get(k)].join(", ")}`);
}
process.exit(missing.length ? 1 : 0);
