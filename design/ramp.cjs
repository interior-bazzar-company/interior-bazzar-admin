/* =============================================================================
   INK & SIGNAL — the contrast guard
   =============================================================================

   IT READS THE REAL STYLESHEET. This used to be a hand-kept copy of the
   palette with the ratios asserted against it, which meant the guard could
   pass while the product failed: somebody retunes a token in tokens.css, the
   copy in here still holds the old hex, and the check goes on saying "ok" about
   a colour that is no longer in the build.

   So it parses `src/styles/tokens.css`, resolves the `var()` chains the way a
   browser would, per theme, and measures the pairs below against what the
   panel will actually paint. A token that moves moves here too, and a token
   that is deleted fails loudly instead of silently.

   TWO THEMES, ONE FLOOR SET
   -------------------------
     4.5:1   text on the surface it sits on            (WCAG 1.4.3, AA)
     3.0:1   an operable boundary or a large figure    (WCAG 1.4.11)

   There is no third theme and no scheme, so this walks light and dark and
   nothing else. That is the whole reason the file is now a third of its former
   length: it used to check three colour systems, two of which nobody had
   looked at since the week they landed.

   WHAT IS DELIBERATELY NOT CHECKED
   --------------------------------
   The eleven tag hues. They are a palette a PERSON chooses from for their own
   labels, and every one is used as chip text on its own matched tint — which
   is a pair the loop below does check, once, through `--tag-*` on
   `--tag-*-bg`. What is not asserted is any tag colour against any other
   ground, because a tag is never drawn on one.
   ========================================================================== */
const fs = require("fs");
const path = require("path");

/* ---------------------------------------------------------------- colour -- */
const hex = (h) => {
  h = String(h).trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const lum = (h) => {
  const [r, g, b] = hex(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

/* ------------------------------------------------------------- the sheet -- */
const SRC = fs.readFileSync(
  path.resolve(__dirname, "..", "src", "styles", "tokens.css"),
  "utf8"
);

/* Every `--name:value` declaration, bucketed by which selector block it is in.
   Only three buckets matter: the unscoped `:root` rules, the light block and
   the dark block. A declaration in `:root,:root[data-theme="light"]` lands in
   both base and light, which is exactly how the browser reads it. */
function collect() {
  const base = new Map(), light = new Map(), dark = new Map();
  /* selector { … } — non-greedy, and the sheet has no nested blocks outside
     @media, which this file no longer contains for colour. */
  const blocks = SRC.matchAll(/([^{}]+)\{([^{}]*)\}/g);
  for (const b of blocks) {
    const sel = b[1].replace(/\/\*[\s\S]*?\*\//g, "").trim();
    const body = b[2];
    if (!sel.includes(":root")) continue;
    const targets = [];
    if (/:root\s*(,|$)/.test(sel) || /:root\{/.test(sel + "{")) targets.push(base);
    if (sel.includes('[data-theme="light"]')) targets.push(light);
    if (sel.includes('[data-theme="dark"]')) targets.push(dark);
    if (!targets.length) targets.push(base);
    for (const d of body.matchAll(/(--[a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g)) {
      const name = d[1], value = d[2].trim();
      for (const t of targets) t.set(name, value);
    }
  }
  return { base, light, dark };
}
const { base, light, dark } = collect();

/* Resolve a token the way the cascade would: the theme's own value wins over
   the unscoped one, and a `var(--x)` chain is followed to a literal. */
function resolve(name, theme, seen) {
  seen = seen || new Set();
  if (seen.has(name)) return null;          // a cycle is a bug, not a colour
  seen.add(name);
  const map = theme === "dark" ? dark : light;
  let v = map.has(name) ? map.get(name) : base.get(name);
  if (v === undefined) return null;
  v = v.trim();
  const m = v.match(/^var\(\s*(--[a-zA-Z0-9_-]+)\s*\)$/);
  if (m) return resolve(m[1], theme, seen);
  return /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : null;
}

/* ------------------------------------------------------------- the pairs -- */
/* [ token, ground, floor, what it is ] — named by TOKEN, so the table reads as
   a statement about the design system rather than about a list of hexes. */
const TEXT = 4.5, EDGE = 3.0;
const PAIRS = [
  /* the interface, on each of the three planes it is drawn on */
  ["--color-text", "--color-surface", TEXT, "body text on a card"],
  ["--color-text", "--color-bg", TEXT, "body text on the ground"],
  ["--color-text-2", "--color-surface", TEXT, "secondary text on a card"],
  ["--color-text-2", "--color-surface-sunken", TEXT, "secondary text in a well"],
  ["--color-text-muted", "--color-surface", TEXT, "muted text on a card"],
  ["--color-text-muted", "--color-surface-sunken", TEXT, "column heads in a table head"],
  ["--color-text-muted", "--color-bg", TEXT, "muted text on the ground"],
  ["--color-text-muted", "--color-surface-nav", TEXT, "muted text in the sidebar"],
  ["--color-text-muted", "--color-surface-raised", TEXT, "muted text in a menu"],

  /* the primary action — ink, and it inverts wholesale between the themes */
  ["--color-primary-ink", "--color-primary", TEXT, "the label on a primary button"],

  /* the brand — FOREST. These are the pairs that decide whether the portal's
     colour can carry text at all, which is what makes it usable as a link. */
  ["--color-brand-ink", "--color-brand", TEXT, "the label on a brand fill"],
  ["--color-brand-text", "--color-surface", TEXT, "a link on a card"],
  ["--color-brand-text", "--color-selected", TEXT, "brand text on a selected row"],
  ["--color-text", "--color-selected", TEXT, "body text on a selected row"],
  ["--color-brand", "--color-surface", EDGE, "the brand edge on a card"],
  ["--color-brand", "--color-bg", EDGE, "the brand edge on the ground"],

  /* the operable boundaries. `--color-control-edge` is where it is in the ramp
     BECAUSE of this line: one step lighter measures 2.7 and fails. */
  ["--color-control-edge", "--color-surface", EDGE, "an input's edge on a card"],
  ["--color-control-edge", "--color-bg", EDGE, "an input's edge on the ground"],
  ["--color-control-edge", "--color-surface-sunken", EDGE, "an input's edge in a well"],
  ["--color-control-edge", "--color-surface-raised", EDGE, "an input's edge in a menu"],

  /* the four statuses, each on its own soft ground — the chip pairs */
  ["--color-success", "--color-success-soft", TEXT, "success chip"],
  ["--color-warning", "--color-warning-soft", TEXT, "warning chip"],
  ["--color-danger", "--color-danger-soft", TEXT, "danger chip"],
  ["--color-info", "--color-info-soft", TEXT, "info chip"],
  ["--color-accent-text", "--color-accent-soft", TEXT, "the live chip"],
  ["--color-secondary", "--color-secondary-soft", TEXT, "a system-acted chip"],
  /* …and on a plain card, because a status is also written as bare text in a
     cell, not only inside a chip */
  ["--color-success", "--color-surface", TEXT, "success text on a card"],
  ["--color-warning", "--color-surface", TEXT, "warning text on a card"],
  ["--color-danger", "--color-surface", TEXT, "danger text on a card"],
  ["--color-info", "--color-surface", TEXT, "info text on a card"],
  /* the solid status fills carry white in light and near-black in dark; both
     are `--color-text-inverse`, which is the point of that token */
  ["--color-text-inverse", "--color-success-solid", EDGE, "a solid success fill"],
  ["--color-text-inverse", "--color-danger-solid", EDGE, "a solid danger fill"],

  /* the toast is the same dark slab in BOTH themes, so it is checked once per
     theme against the same pair and must pass in both */
  ["--toast-fg", "--toast-bg", TEXT, "toast text"],
  ["--toast-action", "--toast-bg", TEXT, "the toast's action"],

  /* the sign-in hero */
  ["--color-hero-ink", "--color-hero", TEXT, "hero text"],
  ["--color-hero-accent", "--color-hero", EDGE, "the hero's forest thread"],

  /* charts. The axis labels are read as text; the grid is not, and is exempt
     by design — a gridline that met 3:1 would be louder than the data. */
  ["--chart-axis", "--color-surface", EDGE, "a chart's axis labels"],
  ["--chart-1", "--color-surface", EDGE, "the first series (brand) on a card"],
  ["--chart-pos", "--color-surface", EDGE, "a positive series"],
  ["--chart-neg", "--color-surface", EDGE, "a negative series"],
];

/* THE TAG PALETTE, generated rather than typed: eleven names × two, so a hue
   added to the ramp is checked without this file being edited. */
const TAGS = ["slate", "red", "orange", "amber", "lime", "green",
  "teal", "cyan", "blue", "violet", "pink"];
for (const t of TAGS) {
  PAIRS.push([`--tag-${t}`, `--tag-${t}-bg`, TEXT, `the ${t} tag on its own tint`]);
}

/* THE CHANNEL PAIRS — WhatsApp and email keep their own hue, so they get their
   own line rather than riding on the status set. */
PAIRS.push(
  ["--ch-wa-text", "--ch-wa-bg", TEXT, "a WhatsApp chip"],
  ["--ch-em-text", "--ch-em-bg", TEXT, "an email chip"],
  ["--ch-wa-ink", "--ch-wa", EDGE, "the label on a WhatsApp fill"],
  ["--ch-em-ink", "--ch-em", EDGE, "the label on an email fill"]
);

/* ------------------------------------------------------------------ run -- */
let bad = 0, missing = 0, n = 0;
for (const theme of ["light", "dark"]) {
  console.log(`\n── ${theme.toUpperCase()} ${"─".repeat(64)}`);
  for (const [fgName, bgName, floor, what] of PAIRS) {
    const fg = resolve(fgName, theme);
    const bg = resolve(bgName, theme);
    n++;
    if (!fg || !bg) {
      missing++;
      console.log(
        `MISS ${what.padEnd(34)} ${!fg ? fgName : bgName} does not resolve to a colour in ${theme}`
      );
      continue;
    }
    const r = ratio(fg, bg);
    const ok = r >= floor;
    if (!ok) bad++;
    console.log(
      `${ok ? "ok  " : "FAIL"} ${what.padEnd(34)} ${r.toFixed(2).padStart(6)}:1` +
      `  (floor ${floor.toFixed(1)})  ${fg} on ${bg}`
    );
  }
}

console.log(
  `\n${bad} failing pair(s) and ${missing} unresolved token(s) of ${n} checked, ` +
  `across 2 themes.`
);
process.exit(bad + missing ? 1 : 0);
