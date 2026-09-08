/* Forest brand ramp + contrast verification against the Untitled UI semantic map,
   using the panel's real surface model:

     ground (--bg-shell)   light neutral-50   dark neutral-950   the plane behind
     plane  (--bg)         light white        dark neutral-900   panels, rows
     raised (menus/modals) light white        dark neutral-800
     inset  (--bg-inset)   light neutral-100  dark neutral-950

   In dark the plane is LIGHTER than the ground, which is how a dark UI says
   "raised" — so every dark pair below is checked against neutral-900, not 950. */

const hex = (h) => {
  h = h.replace("#", "");
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

const N = {
  25: "#fcfcfc", 50: "#fafafa", 100: "#f5f5f5", 200: "#e5e5e5", 300: "#d4d4d4",
  400: "#a3a3a3", 500: "#737373", 600: "#525252", 700: "#404040", 800: "#262626",
  900: "#171717", 950: "#0a0a0a",
};
const B = {
  25: "#f6fbf8", 50: "#ecf7f1", 100: "#d3ede0", 200: "#a9dcc3", 300: "#74c39f",
  400: "#43a67d", 500: "#218a62", 600: "#14704e", 700: "#0f5a3f", 800: "#0e4834",
  900: "#0d3b2c", 950: "#06231a",
};
const R = { 50: "#fef3f2", 100: "#fee4e2", 300: "#fda29b", 400: "#f97066", 500: "#f04438", 600: "#d92d20", 700: "#b42318", 950: "#55160c" };
const Y = { 50: "#fffaeb", 100: "#fef0c7", 300: "#fec84b", 400: "#fdb022", 500: "#f79009", 600: "#dc6803", 700: "#b54708", 950: "#4e1d09" };
const G = { 50: "#ecfdf3", 100: "#dcfae6", 300: "#75e0a7", 400: "#47cd89", 500: "#17b26a", 600: "#079455", 700: "#067647", 950: "#053321" };
const U = { blue600: "#175cd3", blue50: "#eff8ff", blue400: "#53b1fd", blue950: "#102a56" };

/* the two deviations from Untitled UI, both for WCAG 1.4.11 (3:1 on an
   operable boundary). Untitled UI ships border-primary at neutral-300, which
   measures 1.55:1 on white — fine as a decorative hairline, not as the edge
   that identifies an input. */
const CTRL_LIGHT = "#8c8c8c";
const CTRL_DARK = "#757575";

/* dark brand tint for a selected row — Untitled UI dark maps bg-brand-primary
   to brand-500, a full fill, which is wrong for a row. */
const SEL_DARK = "#102a20";

const LP = "#ffffff", LG = N[50], LI = N[100];      // light plane / ground / inset
const DP = N[900], DG = N[950], DR = N[800];        // dark plane / ground / raised

const pairs = [
  ["LIGHT text-primary on plane", N[900], LP, 4.5],
  ["LIGHT text-secondary on plane", N[700], LP, 4.5],
  ["LIGHT text-tertiary on plane", N[600], LP, 4.5],
  ["LIGHT text-quaternary on plane", N[500], LP, 4.5],
  ["LIGHT text-tertiary on inset", N[600], LI, 4.5],
  ["LIGHT text-tertiary on ground", N[600], LG, 4.5],
  ["LIGHT placeholder on plane", N[500], LP, 4.5],
  ["LIGHT white on ink-solid (primary btn)", LP, N[900], 4.5],
  ["LIGHT white on brand-solid (forest)", LP, B[600], 4.5],
  ["LIGHT text-brand-primary on plane", B[900], LP, 4.5],
  ["LIGHT text-brand-secondary on brand tint", B[700], B[50], 4.5],
  ["LIGHT fg-brand on plane", B[600], LP, 3.0],
  ["LIGHT text-success on success tint", G[700], G[50], 4.5],
  ["LIGHT text-warning on warning tint", Y[700], Y[50], 4.5],
  ["LIGHT text-error on error tint", R[700], R[50], 4.5],
  ["LIGHT text-info on info tint", U.blue600, U.blue50, 4.5],
  ["LIGHT white on error-solid", LP, R[600], 4.5],
  ["LIGHT border-control on plane", CTRL_LIGHT, LP, 3.0],
  ["LIGHT border-control on ground", CTRL_LIGHT, LG, 3.0],
  ["LIGHT border-control on inset", CTRL_LIGHT, LI, 3.0],
  ["LIGHT border-brand on plane", B[500], LP, 3.0],
  ["LIGHT text on brand tint (selected row)", N[900], B[50], 4.5],

  ["DARK  text-primary on plane", N[50], DP, 4.5],
  ["DARK  text-secondary on plane", N[300], DP, 4.5],
  ["DARK  text-tertiary on plane", N[400], DP, 4.5],
  ["DARK  text-tertiary on ground", N[400], DG, 4.5],
  ["DARK  text-tertiary on raised", N[400], DR, 4.5],
  ["DARK  placeholder on plane", N[400], DP, 4.5],
  ["DARK  ink on white-solid (primary btn)", N[900], N[50], 4.5],
  ["DARK  white on brand-solid (forest)", LP, B[600], 4.5],
  ["DARK  text-brand on plane", B[300], DP, 4.5],
  ["DARK  fg-brand on plane", B[400], DP, 3.0],
  ["DARK  text-success on success tint", G[400], G[950], 4.5],
  ["DARK  text-warning on warning tint", Y[400], Y[950], 4.5],
  ["DARK  text-error on error tint", R[400], R[950], 4.5],
  ["DARK  text-info on info tint", U.blue400, U.blue950, 4.5],
  ["DARK  text-success on plane", G[400], DP, 4.5],
  ["DARK  text-warning on plane", Y[400], DP, 4.5],
  ["DARK  text-error on plane", R[400], DP, 4.5],
  ["DARK  border-control on plane", CTRL_DARK, DP, 3.0],
  ["DARK  border-control on ground", CTRL_DARK, DG, 3.0],
  ["DARK  border-control on raised", CTRL_DARK, DR, 3.0],
  ["DARK  border-brand on plane", B[400], DP, 3.0],
  ["DARK  text on brand tint (selected row)", N[50], SEL_DARK, 4.5],
  ["DARK  text-brand on brand tint (selected)", B[300], SEL_DARK, 4.5],
];

/* ============================================================================
   THE OTHER TWO SCHEMES — measured, not asserted.

   The pairs above are the PORTAL scheme, whose values are Untitled UI's. Every
   scheme in styles/schemes.css has to clear the same floors or it is not a
   scheme, it is a skin with a contrast bug — and the two below are the ones a
   person can now switch to from the account menu. Same floors, same method:
   4.5:1 for text, 3:1 for an operable edge (WCAG 1.4.11).

   CONSOLE is the default: ink builds the interface, forest is the thread.
   Its control edge is ink-7, which is where it is because ink-6 measures 2.7
   on white and fails — that step is load-bearing, not chosen for looks.
   ========================================================================== */
const C = {
  /* light */
  bg: "#f4f4f5", surface: "#ffffff", sunken: "#f2f2f4", nav: "#f0f1f3",
  text: "#0b0b0d", text2: "#3a3a41", muted: "#5c5c65", edge: "#8b8b94",
  primary: "#111113", primaryInk: "#ffffff",
  brand: "#14704e", brandText: "#0f5a3f", selected: "#ecf7f1", brandBorder: "#a9dcc3",
  okT: "#166035", okBg: "#e8f5ec", warnT: "#8a5600", warnBg: "#fdf3e0",
  badT: "#9d3820", badBg: "#fdeee9", infoT: "#33449f", infoBg: "#eceffb",
  accentT: "#0a6a86", accentBg: "#e2f6fb",
  /* dark */
  dBg: "#0a0a0b", dSurface: "#141416", dRaised: "#1c1c1f", dSunken: "#111113",
  dText: "#f4f4f5", dText2: "#c2c2c8", dMuted: "#93939b", dEdge: "#70707a",
  dPrimary: "#f4f4f5", dPrimaryInk: "#0b0b0d",
  dBrand: "#218a62", dBrandText: "#74c39f", dSelected: "#0f2a20",
  dOkT: "#4fd07a", dOkBg: "#0e2a1a", dWarnT: "#e8a83c", dWarnBg: "#2c2008",
  dBadT: "#ff8a63", dBadBg: "#2e150f", dInfoT: "#8b9bff", dInfoBg: "#161c3a",
  dAccentT: "#45dcf0", dAccentBg: "#0a2b34",
};
const BC = {
  bg: "#eef2f3", surface: "#ffffff", sunken: "#edf1f2",
  text: "#0c1618", text2: "#3a4c50", muted: "#4e6469", edge: "#788d93",
  primary: "#007863", primaryInk: "#ffffff", primaryText: "#054a40", selected: "#e0f5f0",
  dSurface: "#111a1e", dRaised: "#17242a", dBg: "#080e11",
  dText: "#e8f1f2", dText2: "#adc0c3", dMuted: "#879ca0", dEdge: "#5d757c",
  dPrimary: "#2fd6b4", dPrimaryInk: "#04191a", dPrimaryText: "#57ddc0", dSelected: "#0d2f2a",
};

pairs.push(
  ["CONSOLE L text on surface", C.text, C.surface, 4.5],
  ["CONSOLE L text-2 on surface", C.text2, C.surface, 4.5],
  ["CONSOLE L muted on surface", C.muted, C.surface, 4.5],
  ["CONSOLE L muted on sunken", C.muted, C.sunken, 4.5],
  ["CONSOLE L muted on nav", C.muted, C.nav, 4.5],
  ["CONSOLE L primary-ink on primary", C.primaryInk, C.primary, 4.5],
  ["CONSOLE L brand-ink on brand (button)", "#ffffff", C.brand, 4.5],
  ["CONSOLE L brand-text on selected", C.brandText, C.selected, 4.5],
  ["CONSOLE L text on selected (row)", C.text, C.selected, 4.5],
  ["CONSOLE L control edge on surface", C.edge, C.surface, 3.0],
  ["CONSOLE L control edge on ground", C.edge, C.bg, 3.0],
  ["CONSOLE L control edge on sunken", C.edge, C.sunken, 3.0],
  ["CONSOLE L brand border on surface", C.brand, C.surface, 3.0],
  ["CONSOLE L success on success tint", C.okT, C.okBg, 4.5],
  ["CONSOLE L warning on warning tint", C.warnT, C.warnBg, 4.5],
  ["CONSOLE L danger on danger tint", C.badT, C.badBg, 4.5],
  ["CONSOLE L info on info tint", C.infoT, C.infoBg, 4.5],
  ["CONSOLE L live on live tint", C.accentT, C.accentBg, 4.5],

  ["CONSOLE D text on surface", C.dText, C.dSurface, 4.5],
  ["CONSOLE D text-2 on surface", C.dText2, C.dSurface, 4.5],
  ["CONSOLE D muted on surface", C.dMuted, C.dSurface, 4.5],
  ["CONSOLE D muted on raised", C.dMuted, C.dRaised, 4.5],
  ["CONSOLE D muted on ground", C.dMuted, C.dBg, 4.5],
  ["CONSOLE D primary-ink on primary", C.dPrimaryInk, C.dPrimary, 4.5],
  ["CONSOLE D brand-ink on brand (button)", "#04150f", "#43a67d", 4.5],
  ["CONSOLE D brand-text on surface", C.dBrandText, C.dSurface, 4.5],
  ["CONSOLE D brand-text on selected", C.dBrandText, C.dSelected, 4.5],
  ["CONSOLE D text on selected (row)", C.dText, C.dSelected, 4.5],
  ["CONSOLE D control edge on surface", C.dEdge, C.dSurface, 3.0],
  ["CONSOLE D control edge on raised", C.dEdge, C.dRaised, 3.0],
  ["CONSOLE D control edge on ground", C.dEdge, C.dBg, 3.0],
  ["CONSOLE D brand on surface", C.dBrandText, C.dSurface, 3.0],
  ["CONSOLE D success on success tint", C.dOkT, C.dOkBg, 4.5],
  ["CONSOLE D warning on warning tint", C.dWarnT, C.dWarnBg, 4.5],
  ["CONSOLE D danger on danger tint", C.dBadT, C.dBadBg, 4.5],
  ["CONSOLE D info on info tint", C.dInfoT, C.dInfoBg, 4.5],
  ["CONSOLE D live on live tint", C.dAccentT, C.dAccentBg, 4.5],

  ["BEACON  L text on surface", BC.text, BC.surface, 4.5],
  ["BEACON  L muted on surface", BC.muted, BC.surface, 4.5],
  ["BEACON  L muted on sunken", BC.muted, BC.sunken, 4.5],
  ["BEACON  L primary-ink on primary", BC.primaryInk, BC.primary, 4.5],
  ["BEACON  L primary text on selected", BC.primaryText, BC.selected, 4.5],
  ["BEACON  L control edge on surface", BC.edge, BC.surface, 3.0],
  ["BEACON  L control edge on ground", BC.edge, BC.bg, 3.0],
  ["BEACON  D text on surface", BC.dText, BC.dSurface, 4.5],
  ["BEACON  D muted on surface", BC.dMuted, BC.dSurface, 4.5],
  ["BEACON  D muted on raised", BC.dMuted, BC.dRaised, 4.5],
  ["BEACON  D primary-ink on primary", BC.dPrimaryInk, BC.dPrimary, 4.5],
  ["BEACON  D primary text on selected", BC.dPrimaryText, BC.dSelected, 4.5],
  ["BEACON  D control edge on surface", BC.dEdge, BC.dSurface, 3.0],
  ["BEACON  D control edge on raised", BC.dEdge, BC.dRaised, 3.0]
);

/* THE ONE COMBINATION THE SYSTEM REJECTS. It is listed rather than quietly
   omitted: text-quaternary on the inset ground measures 4.35:1, so nothing is
   written in it — table heads and wells use text-tertiary, which is what
   Untitled UI's own table does. If a future palette change makes this pass,
   the rule can be relaxed; until then this line is why it exists. */
const excluded = [["LIGHT text-quaternary on inset", N[500], LI, 4.5]];

let bad = 0;
for (const [label, fg, bg, floor] of pairs) {
  const r = ratio(fg, bg);
  const ok = r >= floor;
  if (!ok) bad++;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${label.padEnd(42)} ${r.toFixed(2).padStart(6)}:1  (floor ${floor})  ${fg} on ${bg}`
  );
}
for (const [label, fg, bg, floor] of excluded) {
  console.log(
    `EXCL ${label.padEnd(42)} ${ratio(fg, bg).toFixed(2).padStart(6)}:1  (floor ${floor})  ${fg} on ${bg}  — not used anywhere; see the note above`
  );
}
console.log(`\n${bad} failing pair(s) of ${pairs.length}, ${excluded.length} documented exclusion(s)`);
process.exit(bad ? 1 : 0);
