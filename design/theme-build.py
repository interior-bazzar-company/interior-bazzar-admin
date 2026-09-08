"""Assemble src/styles/untitled/theme.css from Untitled UI's upstream theme.css.

Run from the repo root:  python design/theme-build.py
Edit the override blocks in THIS file; theme.css is generated and says so.

The upstream file is kept whole — every semantic token, every property alias
their components depend on — and the panel's decisions are appended as
overrides at the END of each block, where a later declaration wins. Three
mechanical transforms on top:

  1. `@theme` → `@theme static`, so every variable is emitted to :root and the
     panel's hand-written CSS (which reads --color-* directly) always finds it.
  2. The font-size and radius scales move to a separate `@theme inline` block.
     Inline theme values are baked into the utilities (`text-sm` → 14px) rather
     than referenced (`font-size: var(--text-sm)`), which matters because the
     panel has written --text-sm to mean 12px about two thousand times and
     tokens.css keeps that meaning. One name, two readers, no fight.
  3. Dark is selected by `.dark-mode` (theirs) AND `:root[data-theme="dark"]`
     (the panel's, set before first paint), in one block.
"""
import io, re
R = "D:/Programming/interior-bazzar/interior-bazzar-admin/"
up = io.open(R + "src/styles/untitled/theme.upstream.css", encoding="utf-8").read()

assert up.startswith("@theme {")
head, rest = up.split("@layer base {", 1)

# --- 1. static, and pull the inline scales out ------------------------------
inline_lines = []
kept = []
for line in head.split("\n"):
    if re.match(r"\s*--(text-[a-z0-9-]+|radius-[a-zA-Z0-9-]+):", line):
        inline_lines.append(line)
    else:
        kept.append(line)
head = "\n".join(kept).replace("@theme {", "@theme static {", 1)

# --- forest replaces purple -------------------------------------------------
forest = {
    50: "236 247 241", 100: "211 237 224", 200: "169 220 195", 300: "116 195 159",
    400: "67 166 125", 500: "33 138 98", 600: "20 112 78", 700: "15 90 63",
    800: "14 72 52", 900: "13 59 44", 950: "6 35 26",
}
for k, v in forest.items():
    head, n = re.subn(r"(--color-brand-%d:\s*)rgb\([^)]*\)" % k, r"\1rgb(%s)" % v, head)
    assert n == 1, k

# --- panel overrides, light ------------------------------------------------
light_overrides = """
    /* ===================================================================
       INTERIOR BAZZAR OVERRIDES — appended so a later declaration wins.
       Everything above is Untitled UI's theme.css verbatim (CLI v0.1.64),
       forest brand substituted for purple. Below is what this panel changes,
       and why, in the same vocabulary. See design/design-system.md §3.
       =================================================================== */

    /* The palettes. Tailwind's defaults are oklch and slightly different from
       the values the contrast table was computed on; these are the ones that
       were checked. Neutral is a true gray — "primary is black and white". */
    --color-neutral-25: #fcfcfc; --color-neutral-50: #fafafa; --color-neutral-100: #f5f5f5;
    --color-neutral-200: #e5e5e5; --color-neutral-300: #d4d4d4; --color-neutral-400: #a3a3a3;
    --color-neutral-500: #737373; --color-neutral-600: #525252; --color-neutral-700: #404040;
    --color-neutral-800: #262626; --color-neutral-900: #171717; --color-neutral-950: #0a0a0a;
    --color-brand-25: #f6fbf8;
    --color-green-25: #f6fef9;  --color-green-50: #ecfdf3;  --color-green-100: #dcfae6;
    --color-green-200: #abefc6; --color-green-300: #75e0a7; --color-green-400: #47cd89;
    --color-green-500: #17b26a; --color-green-600: #079455; --color-green-700: #067647;
    --color-green-800: #085d3a; --color-green-900: #074d31; --color-green-950: #053321;
    --color-yellow-25: #fffcf5;  --color-yellow-50: #fffaeb;  --color-yellow-100: #fef0c7;
    --color-yellow-200: #fedf89; --color-yellow-300: #fec84b; --color-yellow-400: #fdb022;
    --color-yellow-500: #f79009; --color-yellow-600: #dc6803; --color-yellow-700: #b54708;
    --color-yellow-800: #93370d; --color-yellow-900: #7a2e0e; --color-yellow-950: #4e1d09;
    --color-red-25: #fffbfa;  --color-red-50: #fef3f2;  --color-red-100: #fee4e2;
    --color-red-200: #fecdca; --color-red-300: #fda29b; --color-red-400: #f97066;
    --color-red-500: #f04438; --color-red-600: #d92d20; --color-red-700: #b42318;
    --color-red-800: #912018; --color-red-900: #7a271a; --color-red-950: #55160c;
    --color-blue-25: #f5faff;  --color-blue-50: #eff8ff;  --color-blue-100: #d1e9ff;
    --color-blue-200: #b2ddff; --color-blue-300: #84caff; --color-blue-400: #53b1fd;
    --color-blue-500: #2e90fa; --color-blue-600: #175cd3; --color-blue-700: #175cd3;
    --color-blue-800: #1849a9; --color-blue-900: #194185; --color-blue-950: #102a56;

    /* THE PRIMARY ACTION IS INK, not the brand. Untitled UI's primary button is
       bg-brand-solid; this panel's is --color-ink-solid, which maps onto their
       own --color-bg-primary-solid. Brand green is the thread through the
       chrome — nav, links, focus, selection, charts — and never a status. */
    --color-ink-solid: var(--color-bg-primary-solid);
    --color-ink-solid_hover: var(--color-neutral-800);
    --color-on-ink: var(--color-white);

    /* The operable edge. Untitled UI puts input borders on border-primary
       (neutral-300), 1.55:1 on white — right for a hairline, not for the edge
       that identifies an input (WCAG 1.4.11 wants 3:1). Hairlines stay. */
    --color-border-control: #8c8c8c;

    /* Names this panel's component layer reads that Untitled UI does not name. */
    --color-bg-raised: var(--color-white);
    --color-bg-nav: var(--color-neutral-50);
    --color-bg-disabled: var(--color-neutral-100);
    --color-bg-selected: var(--color-brand-50);
    --color-border-selected: var(--color-brand-200);
    --color-border-brand-subtle: var(--color-brand-200);
    --color-border-success: var(--color-green-300);
    --color-border-warning: var(--color-yellow-300);
    --color-border-info: var(--color-blue-300);
    --color-border-error-subtle: var(--color-red-300);
    --color-border-disabled: var(--color-neutral-200);
    --color-text-disabled: var(--color-neutral-400);
    --color-text-info-primary: var(--color-blue-600);
    --color-fg-disabled: var(--color-neutral-400);
    --color-fg-info-primary: var(--color-blue-600);
    --color-bg-info-primary: var(--color-blue-50);
    --color-bg-info-secondary: var(--color-blue-100);
    --color-bg-info-solid: var(--color-blue-600);
    --color-tooltip-bg: var(--color-neutral-900);
    --color-tooltip-fg: var(--color-white);
    --color-skeleton: var(--color-neutral-200);
    --color-skeleton-sheen: var(--color-neutral-100);
    /* the login door — the one large brand fill in the product */
    --color-hero: var(--color-brand-900);
    --color-hero-ink: var(--color-white);
    --color-hero-accent: var(--color-brand-300);
    --color-hero-muted: rgba(255, 255, 255, 0.72);
    --color-hero-line: rgba(255, 255, 255, 0.14);
    --color-bg-overlay: rgba(10, 13, 18, 0.45);

    /* Data vis: fixed slot order, never cycled; slot 1 is the brand because
       slot 1 is almost always "ours". Status colours are never a series. */
    --chart-1: #14704e; --chart-2: #175cd3; --chart-3: #b54708; --chart-4: #c11574;
    --chart-5: #6941c6; --chart-6: #0e7090; --chart-7: #93370d; --chart-8: #4e5ba6;
    --chart-seq-1: #ecf7f1; --chart-seq-2: #a9dcc3; --chart-seq-3: #43a67d;
    --chart-seq-4: #14704e; --chart-seq-5: #0d3b2c;
    --chart-pos: var(--color-green-600); --chart-neg: var(--color-red-600);
    --chart-grid: var(--color-neutral-200); --chart-axis: var(--color-neutral-500);
    --chart-fill-opacity: 0.16;

    /* Elevation extras. Light no-ops are TRANSPARENT SHADOWS, not `none`: they
       sit inside shadow lists, and a `none` in a list voids the declaration. */
    --focus-ring: 0 0 0 4px rgba(33, 138, 98, 0.24);
    --focus-ring-error: 0 0 0 4px rgba(240, 68, 56, 0.24);
    --surface-sheen: 0 0 0 0 transparent;
    --nav-active-glow: 0 0 0 0 transparent;
"""
assert head.rstrip().endswith("}")
head = head.rstrip()[:-1].rstrip() + "\n" + light_overrides + "}\n"

inline_block = "\n/* Baked into the utilities, not referenced — see the note at the top. */\n@theme inline {\n" + "\n".join(inline_lines) + "\n}\n"

# --- dark ------------------------------------------------------------------
rest = rest.replace("    .dark-mode {", "    .dark-mode,\n    :root[data-theme=\"dark\"] {", 1)
dark_overrides = """
    /* =============================== overrides, dark ====================
       The surface relationship INVERTS. In light the plane is white over a
       grey ground; in dark the ground is the darkest thing (neutral-950) and
       the plane is LIGHTER (neutral-900), because a dark interface says
       "raised" by getting lighter — it cannot cast a shadow it can show.
       Untitled UI de-brands its dark text (neutral-50 for brand-primary);
       here the forest thread stays visible, at the 300/400 steps. */
    .dark-mode,
    :root[data-theme="dark"] {
        --color-bg-primary: var(--color-neutral-900);
        --color-bg-primary_hover: var(--color-neutral-800);
        --color-bg-primary_alt: var(--color-neutral-900);
        --color-bg-secondary: var(--color-neutral-950);
        --color-bg-secondary_hover: var(--color-neutral-800);
        --color-bg-secondary_alt: var(--color-neutral-950);
        --color-bg-tertiary: var(--color-neutral-950);
        --color-bg-quaternary: var(--color-neutral-800);
        --color-bg-active: var(--color-neutral-800);
        --color-bg-raised: var(--color-neutral-800);
        --color-bg-nav: var(--color-neutral-950);
        --color-bg-disabled: var(--color-neutral-800);
        --color-bg-overlay: rgba(0, 0, 0, 0.7);
        --color-bg-primary-solid: var(--color-neutral-50);
        --color-ink-solid_hover: var(--color-white);
        --color-on-ink: var(--color-neutral-900);
        --color-text-quaternary: var(--color-neutral-400);
        --color-text-placeholder: var(--color-neutral-400);
        --color-text-disabled: var(--color-neutral-600);
        --color-text-brand-primary: var(--color-brand-300);
        --color-text-brand-secondary: var(--color-brand-300);
        --color-text-brand-secondary_hover: var(--color-brand-200);
        --color-text-brand-tertiary: var(--color-brand-400);
        --color-text-brand-tertiary_alt: var(--color-brand-300);
        --color-text-info-primary: var(--color-blue-400);
        --color-fg-brand-primary: var(--color-brand-400);
        --color-fg-brand-primary_alt: var(--color-brand-400);
        --color-fg-brand-secondary: var(--color-brand-300);
        --color-fg-brand-secondary_alt: var(--color-brand-400);
        --color-fg-brand-secondary_hover: var(--color-brand-300);
        --color-fg-disabled: var(--color-neutral-600);
        --color-fg-info-primary: var(--color-blue-400);
        --color-border-control: #757575;
        --color-border-brand: var(--color-brand-400);
        --color-border-brand_alt: var(--color-brand-400);
        --color-border-brand-subtle: var(--color-brand-800);
        --color-border-selected: var(--color-brand-800);
        --color-border-success: var(--color-green-800);
        --color-border-warning: var(--color-yellow-800);
        --color-border-info: var(--color-blue-800);
        --color-border-error-subtle: var(--color-red-800);
        --color-border-disabled: var(--color-neutral-800);
        --color-bg-brand-primary: #102a20;
        --color-bg-brand-primary_alt: #102a20;
        --color-bg-brand-secondary: var(--color-brand-800);
        --color-bg-brand-solid: var(--color-brand-600);
        --color-bg-brand-solid_hover: var(--color-brand-500);
        --color-bg-brand-section: var(--color-brand-950);
        --color-bg-brand-section_subtle: var(--color-brand-900);
        --color-bg-selected: #102a20;
        /* soft status grounds a step darker than the 950s: the panel paints
           them as a full-width band, and at that size #4e1d09 is a slab */
        --color-bg-success-primary: #0c2418;
        --color-bg-warning-primary: #2a1c07;
        --color-bg-error-primary: #2b1210;
        --color-bg-info-primary: #0f1c30;
        --color-bg-info-secondary: var(--color-blue-800);
        --color-bg-info-solid: var(--color-blue-600);
        --color-focus-ring: var(--color-brand-400);
        --color-tooltip-bg: var(--color-neutral-800);
        --color-tooltip-fg: var(--color-neutral-50);
        --color-skeleton: var(--color-neutral-800);
        --color-skeleton-sheen: var(--color-neutral-700);
        --color-hero: var(--color-brand-950);
        --color-hero-ink: var(--color-neutral-50);
        --color-hero-muted: rgba(250, 250, 250, 0.7);
        --color-hero-line: rgba(250, 250, 250, 0.12);
        --chart-1: #43a67d; --chart-2: #53b1fd; --chart-3: #fdb022; --chart-4: #ee6bb0;
        --chart-5: #a78bfa; --chart-6: #38bdf8; --chart-7: #d9975a; --chart-8: #8098f9;
        --chart-seq-1: #06231a; --chart-seq-2: #0e4834; --chart-seq-3: #14704e;
        --chart-seq-4: #43a67d; --chart-seq-5: #a9dcc3;
        --chart-pos: var(--color-green-400); --chart-neg: var(--color-red-400);
        --chart-grid: var(--color-neutral-800); --chart-axis: var(--color-neutral-500);
        --focus-ring: 0 0 0 4px rgba(67, 166, 125, 0.3);
        --focus-ring-error: 0 0 0 4px rgba(249, 112, 102, 0.28);
        --surface-sheen: inset 0 1px 0 rgba(255, 255, 255, 0.06);
        --nav-active-glow: -8px 0 18px -10px rgba(67, 166, 125, 0.55);
        --shadow-xs: 0px 1px 2px rgba(0, 0, 0, 0.5);
        --shadow-sm: 0px 1px 3px rgba(0, 0, 0, 0.5), 0px 1px 2px -1px rgba(0, 0, 0, 0.4);
        --shadow-md: 0px 4px 6px -1px rgba(0, 0, 0, 0.5), 0px 2px 4px -2px rgba(0, 0, 0, 0.4);
        --shadow-lg: 0px 12px 16px -4px rgba(0, 0, 0, 0.5), 0px 4px 6px -2px rgba(0, 0, 0, 0.4);
        --shadow-xl: 0px 20px 24px -4px rgba(0, 0, 0, 0.55), 0px 8px 8px -4px rgba(0, 0, 0, 0.4);
        --shadow-2xl: 0px 24px 48px -12px rgba(0, 0, 0, 0.65), 0px 4px 4px -2px rgba(0, 0, 0, 0.4);
        --shadow-skeuomorphic: 0px 0px 0px 1px rgba(255, 255, 255, 0.12) inset, 0px -2px 0px 0px rgba(0, 0, 0, 0.2) inset;
        color-scheme: dark;
    }
"""
# rest ends with "    }\n}\n" closing .dark-mode and @layer base
assert rest.rstrip().endswith("}")
rest = rest.rstrip()
assert rest.endswith("}\n}") or rest.endswith("}")
# insert before the final closing brace of @layer base
idx = rest.rfind("}")
rest = rest[:idx].rstrip() + "\n" + dark_overrides + "}\n"

banner = """/* =============================================================================
   Interior bazzar — Admin · UNTITLED UI theme
   =============================================================================
   This is Untitled UI React's theme.css (CLI v0.1.64), whole, with this panel's
   decisions appended as overrides at the end of the light block and the dark
   block. It is the ONE source of colour, shadow and font tokens: Tailwind
   emits every variable to :root (`@theme static`), the library's components
   read them as utilities, and the panel's hand-written CSS reads the same
   names directly. Regenerated by design/theme-build.py from
   theme.upstream.css — edit the overrides there, not here.

   Brand is FOREST GREEN (the portal's colour). The primary action is INK —
   --color-ink-solid — not the brand. Dark is `.dark-mode` (theirs) or
   `[data-theme="dark"]` (the panel's), one block. "System" is resolved in JS
   before first paint, as Untitled UI's own ThemeProvider does.
   ========================================================================== */
"""
out = banner + head + inline_block + "\n@layer base {" + rest
io.open(R + "src/styles/untitled/theme.css", "w", encoding="utf-8", newline="\n").write(out)
print("theme.css:", out.count("\n"), "lines;", len(inline_lines), "inline scale lines")
