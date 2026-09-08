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
