/* =============================================================================
   THE CONTRAST GUARD — reads the real token sheets, both themes.
   =============================================================================

   It parses the three files the product's colour actually comes from —
   Tailwind's default palette (node_modules/tailwindcss/theme.css, in oklch),
   Untitled UI's theme.css and the panel's brand.css — resolves every `var()`
   chain the way a browser would, once for light and once for dark, and
   measures the pairs below against what the panel will paint. A token that
   moves moves here too; a token that is deleted fails loudly.

   FLOORS
     4.5:1  text on the surface it sits on           (WCAG 1.4.3, AA)
     3.0:1  an operable edge, a large figure, a bar  (WCAG 1.4.11)

   `npm run check:contrast`.
   ========================================================================== */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/* ---------------------------------------------------------------- colour -- */
/* oklch → sRGB, the CSS Color 4 arithmetic. */
function oklchToRgb(L, C, h) {
  const hr = ((h || 0) * Math.PI) / 180;
  const a = C * Math.cos(hr), b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const gam = (c) => { const v = Math.max(0, Math.min(1, c)); return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; };
  return [gam(lr), gam(lg), gam(lb)].map((v) => Math.round(v * 255));
}
/** any CSS colour this repo writes → [r,g,b,a] */
function parseColor(s) {
  s = String(s).trim();
  let m;
  if ((m = /^#([0-9a-f]{3,8})$/i.exec(s))) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
    const n = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return [...n, a];
  }
  if ((m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[/,]\s*([\d.]+%?))?\s*\)$/i.exec(s))) {
    const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return [+m[1], +m[2], +m[3], a];
  }
  if ((m = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+|none)(?:\s*\/\s*([\d.]+%?))?\s*\)$/i.exec(s))) {
    const L = m[2] ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
    const rgb = oklchToRgb(L, parseFloat(m[3]), m[4] === "none" ? 0 : parseFloat(m[4]));
    const a = m[5] === undefined ? 1 : m[5].endsWith("%") ? parseFloat(m[5]) / 100 : parseFloat(m[5]);
    return [...rgb, a];
  }
  if (s === "white") return [255, 255, 255, 1];
  if (s === "black") return [0, 0, 0, 1];
  if (s === "transparent") return [0, 0, 0, 0];
  return null;
}
const over = (fg, bg) => fg[3] >= 1 ? fg : [0, 1, 2].map((i) => Math.round(fg[i] * fg[3] + bg[i] * (1 - fg[3]))).concat(1);
const lum = (c) => {
  const [r, g, b] = c.slice(0, 3).map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (fg, bg) => { const f = over(fg, bg); const [l1, l2] = [lum(f), lum(bg)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
const hexOf = (c) => "#" + c.slice(0, 3).map((v) => v.toString(16).padStart(2, "0")).join("");

/* ------------------------------------------------------------- the sheets -- */
/** Collects `--name: value;` declarations from a block of CSS text. */
function decls(src) {
  const out = {};
  for (const m of src.matchAll(/(--[a-zA-Z0-9_-]+)\s*:\s*([^;{}]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
/** Splits a sheet into its light declarations and its dark-block declarations. */
function split(src) {
  const light = {}, dark = {};
  /* every `.dark-mode {…}` (theme.css) or `.dark-mode, [data-theme="dark"] {…}` (brand.css) block is dark */
  const darkRe = /(\.dark-mode[^{]*)\{([\s\S]*?)\n\s*\}/g;
  let rest = src, m;
  while ((m = darkRe.exec(src))) Object.assign(dark, decls(m[2]));
  rest = src.replace(darkRe, "");
  Object.assign(light, decls(rest));
  return { light, dark };
}

const TW = decls(read(path.join(ROOT, "node_modules", "tailwindcss", "theme.css")));
const THEME = split(read(path.join(ROOT, "src", "styles", "theme.css")));
const BRAND = split(read(path.join(ROOT, "src", "styles", "brand.css")));

function table(theme) {
  /* later sheets win, and dark overrides light */
  const t = { ...TW, ...THEME.light, ...BRAND.light };
  if (theme === "dark") Object.assign(t, THEME.dark, BRAND.dark);
  return t;
}
function resolve(name, theme, seen = new Set()) {
  const t = table(theme);
  const v = t[name];
  if (v === undefined) return { missing: name };
  if (seen.has(name)) return { missing: name + " (cycle)" };
  seen.add(name);
  const m = /^var\((--[a-zA-Z0-9_-]+)(?:\s*,\s*([^)]+))?\)$/.exec(v);
  if (m) return resolve(m[1], theme, seen);
  const c = parseColor(v);
  return c ? { rgb: c, raw: v } : { missing: name + " = " + v };
}

/* --------------------------------------------------------------- the pairs -- */
/* [foreground, background, floor, why] — what the panel actually paints. */
const PAIRS = [
  ["--color-text-primary", "--color-bg-primary", 4.5, "body text on a card"],
  ["--color-text-primary", "--color-bg-secondary", 4.5, "body text on the page ground"],
  ["--color-text-secondary", "--color-bg-primary", 4.5, "labels, cells"],
  ["--color-text-tertiary", "--color-bg-primary", 4.5, "meta, hints"],
  ["--color-text-tertiary", "--color-bg-secondary", 4.5, "meta on the ground"],
  ["--color-text-quaternary", "--color-bg-primary", 4.5, "the micro-label, column heads"],
  ["--color-text-quaternary", "--color-bg-secondary", 4.5, "the micro-label on a table head"],
  ["--color-text-placeholder", "--color-bg-primary", 4.5, "a placeholder"],
  ["--color-text-brand-secondary", "--color-bg-primary", 4.5, "a link, the current thing"],
  ["--color-text-brand-secondary", "--color-bg-selected", 4.5, "the active nav row"],
  ["--color-white", "--color-bg-brand-solid", 4.5, "the primary button"],
  ["--color-white", "--color-bg-error-solid", 4.5, "the destructive button"],
  ["--color-text-success-primary", "--color-bg-success-primary", 4.5, "success alert"],
  ["--color-text-warning-primary", "--color-bg-warning-primary", 4.5, "warning alert"],
  ["--color-text-error-primary", "--color-bg-error-primary", 4.5, "error alert"],
  ["--color-text-info-primary", "--color-bg-info-primary", 4.5, "info alert"],
  ["--color-utility-green-700", "--color-utility-green-50", 4.5, "success badge"],
  ["--color-utility-yellow-700", "--color-utility-yellow-50", 4.5, "warning badge"],
  ["--color-utility-red-700", "--color-utility-red-50", 4.5, "error badge"],
  ["--color-utility-blue-700", "--color-utility-blue-50", 4.5, "info badge"],
  ["--color-utility-brand-700", "--color-utility-brand-50", 4.5, "brand badge"],
  ["--color-utility-neutral-700", "--color-utility-neutral-50", 4.5, "neutral badge"],
  ["--color-utility-indigo-700", "--color-utility-indigo-50", 4.5, "system badge"],
  ["--color-utility-sky-700", "--color-utility-sky-50", 4.5, "live badge"],
  ["--color-utility-purple-700", "--color-utility-purple-50", 4.5, "a tag hue"],
  ["--color-utility-pink-700", "--color-utility-pink-50", 4.5, "a tag hue"],
  ["--color-utility-orange-700", "--color-utility-orange-50", 4.5, "a tag hue"],
  ["--color-utility-slate-700", "--color-utility-slate-50", 4.5, "a tag hue"],
  ["--color-text-toast", "--color-bg-toast", 4.5, "a toast"],
  ["--color-text-hero", "--color-bg-hero", 4.5, "the sign-in hero"],
  ["--color-text-hero-muted", "--color-bg-hero", 4.5, "the hero's supporting line"],
  ["--color-fg-hero-accent", "--color-bg-hero", 3.0, "the forest thread on the hero"],
  ["--color-border-control", "--color-bg-primary", 3.0, "an input's edge (1.4.11)"],
  ["--color-border-control", "--color-bg-secondary", 3.0, "an input's edge on the ground"],
  ["--color-focus-ring", "--color-bg-primary", 3.0, "the focus ring"],
  ["--color-focus-ring", "--color-bg-secondary", 3.0, "the focus ring on the ground"],
  ["--color-border-brand", "--color-bg-primary", 3.0, "a selected control's edge"],
  ["--color-chart-1", "--color-bg-primary", 3.0, "chart series 1"],
  ["--color-chart-pos", "--color-bg-primary", 3.0, "a positive bar"],
  ["--color-chart-neg", "--color-bg-primary", 3.0, "a negative bar"],
  ["--color-fg-quaternary", "--color-bg-primary", 3.0, "a resting icon"],
  ["--color-fg-brand-primary", "--color-bg-primary", 3.0, "a brand icon"],
];

/* ------------------------------------------------------------------ run -- */
let bad = 0, missing = 0, checked = 0;
for (const theme of ["light", "dark"]) {
  console.log("\n" + theme.toUpperCase());
  for (const [fg, bg, floor, why] of PAIRS) {
    const F = resolve(fg, theme), B = resolve(bg, theme);
    if (F.missing || B.missing) {
      missing++;
      console.log("  MISSING " + (F.missing || B.missing) + "   (" + why + ")");
      continue;
    }
    const r = ratio(F.rgb, B.rgb);
    checked++;
    const ok = r >= floor;
    if (!ok) bad++;
    console.log("  " + (ok ? "ok  " : "FAIL") + " " + r.toFixed(2).padStart(5) + " ≥ " + floor + "  " + why.padEnd(36) + hexOf(over(F.rgb, B.rgb)) + " on " + hexOf(B.rgb));
  }
}
console.log("\n" + checked + " pairs across 2 themes · " + (bad ? bad + " FAIL" : "all clear") + (missing ? " · " + missing + " missing" : "") + "\n");
process.exit(bad + missing ? 1 : 0);
