/* =============================================================================
   Interior bazzar — Admin Access · shared UI
   -----------------------------------------------------------------------------
   A 1:1 port of the render helpers in the prototype's admin-shell.js (lines
   1–520). Every component emits the SAME class names, in the same order, with
   the same inline styles as the string builder it replaces — admin-theme.css is
   the only stylesheet and it is not touched by this layer. Nothing here invents
   a colour, a spacing, a radius or a word.

   Three conventions apply to the whole file:

   1. NAVIGATION. The prototype's `data-go="#/deals/IB-1"` was a delegated click.
      Here any component that rendered such an element takes a `to?: string`
      prop holding the identical hash string, still renders `data-go={to}` (so
      any attribute selector keeps matching), and calls `go(to)` from ./nav on
      click. ui/ therefore depends on no router.

   2. ALREADY-BUILT HTML. Where the prototype documented a parameter as markup
      the caller assembles — tile()'s `v`, field()'s `custom`, emptyState()'s
      `action`, notice()'s text, kvList()'s values, table()'s rows — the prop is
      a React.ReactNode and is rendered as children. That is the point of the
      port: no dangerouslySetInnerHTML, no string concatenation, no esc().
      esc() itself is gone; JSX escapes text for us.

   3. UNCONTROLLED INPUTS. The prototype re-rendered whole views as innerHTML,
      so every `value="…"` was an attribute, not state. The ports use
      defaultValue for the same reason: they read like the DOM the prototype
      produced. Pass a `key` if a view needs a field to reset.
   ============================================================================= */
import { Fragment, useRef, useState } from "react";
import type { ReactNode } from "react";
import { go } from "./nav";
import { fmtDate } from "./format";
import config from "../../config";

export { BRAND_MARK, BrandLogo } from "./brand";

/* ================================================================ ICONS === */
/* THE ICON SET IS THESE PATH STRINGS, and there is no icon package behind it.
   There used to be: the panel drew from `@untitledui/icons` and kept this map
   as a fallback for names the library had no drawing for. That arrangement had
   one visible cost and one invisible one. The visible one is that two sets
   were on screen at once — a library glyph beside a hand-drawn one, on the
   same toolbar, at slightly different optical weights. The invisible one is
   that "which set is this icon from?" was a question anybody adding a screen
   had to answer, and the answer changed per name.

   ONE SET NOW. Every glyph is drawn on the same 24 grid, with round caps and
   one stroke weight, and `.ic` in admin-theme.css owns the box and the stroke
   so all five sizes stay optically even. Adding an icon is one line here.

   They are raw markup rather than JSX elements because the shell reads a path
   out of the map directly, and because one copy of the data is the only way to
   guarantee it stays identical wherever it is drawn. `Icon` is the sole
   consumer that injects it: a module-private constant with no interpolation
   and no caller input anywhere near it. */
export const ICONS: Record<string, string> = {
  home:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  deal:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7M3 12.5h18"/>',
  quote:'<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
  invoice:'<path d="M5 3h14v18l-2.8-1.8L14 21l-2-1.8L10 21l-2.2-1.8L5 21z"/><path d="M9 8h6M9 12h6"/>',
  chart:'<path d="M4 20V11M10 20V4M16 20v-6M22 20H2"/>',
  route:'<circle cx="6" cy="6" r="2.6"/><circle cx="18" cy="18" r="2.6"/><path d="M8.6 6H15a3 3 0 0 1 3 3v6.4"/>',
  users:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0M16.5 5.2a3 3 0 0 1 0 5.6M18 19.6a5.4 5.4 0 0 0-2-4.2"/>',
  store:'<path d="M4 9.5h16V20H4z"/><path d="M3 9.5 4.6 4h14.8L21 9.5M9.5 20v-5.5h5V20"/>',
  tag:'<path d="M3 12.5V4h8.5L21 13.5 12.5 22z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
  cash:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.01M18 12h.01"/>',
  out:'<path d="M12 4v13M6.5 11.5 12 17l5.5-5.5M5 20h14"/>',
  recon:'<path d="M4 8.5h12l-3.2-3.2M20 15.5H8l3.2 3.2"/>',
  refund:'<path d="M4.2 12a7.8 7.8 0 1 1 2.6 5.8"/><path d="M3.6 7.6v4.6h4.6"/>',
  coin:'<ellipse cx="12" cy="6.4" rx="7.6" ry="3.1"/><path d="M4.4 6.4v11.2c0 1.7 3.4 3.1 7.6 3.1s7.6-1.4 7.6-3.1V6.4M4.4 12c0 1.7 3.4 3.1 7.6 3.1s7.6-1.4 7.6-3.1"/>',
  mega:'<path d="M4 9.5v5h3.6L15 19V5L7.6 9.5zM18.5 10a3 3 0 0 1 0 4"/>',
  doc:'<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9.5 13H16M9.5 17H14"/>',
  flag:'<path d="M5 21V4h13l-2.4 4L18 12H5"/>',
  life:'<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="3.4"/><path d="M5.9 5.9 9.6 9.6M14.4 14.4l3.7 3.7M18.1 5.9l-3.7 3.7M9.6 14.4l-3.7 3.7"/>',
  team:'<circle cx="11" cy="7.5" r="3.2"/><path d="M4.5 20a6.5 6.5 0 0 1 13 0"/><path d="M17.5 5.2a2.8 2.8 0 0 1 0 5.2M19 19.4a5 5 0 0 0-1.6-3.6"/>',
  shield:'<path d="M12 3.2 19.6 6v6c0 4.7-3.2 7.6-7.6 8.6C7.6 19.6 4.4 16.7 4.4 12V6z"/><path d="m9.2 12 2.1 2.1L15 10.4"/>',
  history:'<path d="M3.6 12a8.4 8.4 0 1 0 2.5-6"/><path d="M3.2 4.2v4.2h4.2M12 8v4.4l3.2 1.9"/>',
  search:'<circle cx="11" cy="11" r="6.4"/><path d="m15.9 15.9 4.4 4.4"/>',
  bell:'<path d="M6.2 9.2a5.8 5.8 0 0 1 11.6 0c0 4.6 1.9 5.8 1.9 5.8H4.3s1.9-1.2 1.9-5.8z"/><path d="M10 18.6a2 2 0 0 0 4 0"/>',
  chev:'<path d="m6 9.5 6 6 6-6"/>',
  chevr:'<path d="m9.5 6 6 6-6 6"/>',
  chevl:'<path d="m14.5 6-6 6 6 6"/>',
  alert:'<path d="M12 3.4 21.2 20H2.8z"/><path d="M12 9.4v4.8M12 17.2h.01"/>',
  clock:'<circle cx="12" cy="12" r="8.6"/><path d="M12 7.2v5.1l3.3 1.9"/>',
  calendar:'<rect x="3.4" y="5.2" width="17.2" height="15.4" rx="2"/><path d="M3.4 10h17.2M8.2 3.4v3.6M15.8 3.4v3.6"/>',
  lock:'<rect x="4.6" y="10" width="14.8" height="10" rx="2"/><path d="M8 10V7.2a4 4 0 0 1 8 0V10"/>',
  unlock:'<rect x="4.6" y="10" width="14.8" height="10" rx="2"/><path d="M8 10V7.2A4 4 0 0 1 15.4 5"/>',
  arrow:'<path d="M4.5 12h14M13 6.5l5.5 5.5L13 17.5"/>',
  ext:'<path d="M14 4h6v6M20 4l-8.5 8.5M18 14.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4.5"/>',
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  filter:'<path d="M4 5h16l-6.2 7.3V19l-3.6-2v-4.7z"/>',
  download:'<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
  check:'<path d="m5 12.5 4.6 4.6L19 7.5"/>',
  dots:'<circle cx="12" cy="5.5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="18.5" r="1.4"/>',
  inbox:'<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M4.6 5.5h14.8L21 13v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5z"/>',
  sparkle:'<path d="M12 3.5 13.9 9l5.6 2-5.6 2-1.9 5.5L10.1 13 4.5 11l5.6-2z"/>',
  logout:'<path d="M9.5 20H5.5a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 5.5 4h4M15.5 15.5 20 12l-4.5-3.5M20 12H9.5"/>',
  user:'<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0"/>',
  building:'<path d="M4 20V5.5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 14 5.5V20M14 10h4.5A1.5 1.5 0 0 1 20 11.5V20M2.5 20h19M7 8h4M7 12h4M7 16h4M17 14h.01M17 17h.01"/>',
  link:'<path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7l-1.5 1.5"/><path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 1 0 5.7 5.7l1.5-1.5"/>',
  star:'<path d="m12 3.8 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 10l5.9-.9z"/>',
  eye:'<path d="M2.4 12S6.2 5.6 12 5.6 21.6 12 21.6 12 17.8 18.4 12 18.4 2.4 12 2.4 12z"/><circle cx="12" cy="12" r="3.1"/>',

  /* ---- the second half of the set, drawn when the library went ----------
     Every one of these was a name a screen already asked for and the library
     was answering. Same grid, same caps, same weight as the block above. */
  eyeoff:'<path d="M3 3l18 18M10.6 10.7a3.1 3.1 0 0 0 4.3 4.3M6.9 6.9C4.2 8.6 2.4 12 2.4 12s3.8 6.4 9.6 6.4c1.6 0 3-.5 4.3-1.2M19.4 15.3c1.4-1.5 2.2-3.3 2.2-3.3S17.8 5.6 12 5.6c-.7 0-1.4.1-2 .3"/>',
  minus:'<path d="M5 12h14"/>',
  trash:'<path d="M4 7h16M9.5 7V4.8h5V7M6.5 7l.9 12.3a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7M10 11v6M14 11v6"/>',
  edit:'<path d="M4 20h4L19 9a2.4 2.4 0 0 0-3.4-3.4L4.6 16.6z"/><path d="M14.6 6.9 17.1 9.4"/>',
  copy:'<rect x="8.6" y="8.6" width="11.8" height="11.8" rx="2"/><path d="M15.4 5.6H5.6a2 2 0 0 0-2 2v9.8"/>',
  info:'<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.2M12 7.9h.01"/>',
  help:'<circle cx="12" cy="12" r="8.6"/><path d="M9.7 9.6a2.4 2.4 0 1 1 3.2 2.3c-.6.2-.9.8-.9 1.4v.5M12 17h.01"/>',
  settings:'<circle cx="12" cy="12" r="2.9"/><path d="M19.2 14.4a1.6 1.6 0 0 0 .3 1.7l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-1.7-.3 1.6 1.6 0 0 0-1 1.5v.2a1.9 1.9 0 1 1-3.8 0V20a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0 .3-1.7 1.6 1.6 0 0 0-1.5-1H3.4a1.9 1.9 0 1 1 0-3.8h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 1.7.3H9.2a1.6 1.6 0 0 0 1-1.5V3.4a1.9 1.9 0 1 1 3.8 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.7-.3l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0-.3 1.7v.1a1.6 1.6 0 0 0 1.5 1h.2a1.9 1.9 0 1 1 0 3.8H20a1.6 1.6 0 0 0-1.5 1z"/>',
  sliders:'<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  upload:'<path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M5 19.5h14"/>',
  refresh:'<path d="M20.4 12a8.4 8.4 0 1 1-2.5-6"/><path d="M20.8 4.2v4.2h-4.2"/>',
  mail:'<rect x="2.8" y="5.4" width="18.4" height="13.2" rx="2"/><path d="m3.4 6.6 8.6 6 8.6-6"/>',
  phone:'<path d="M7.5 3.6h-2A2 2 0 0 0 3.5 6c.5 8 6 13.5 14 14a2 2 0 0 0 2.4-2v-2a1.4 1.4 0 0 0-1.2-1.4l-2.6-.4a1.4 1.4 0 0 0-1.4.7l-.7 1.3a12.6 12.6 0 0 1-5.7-5.7l1.3-.7a1.4 1.4 0 0 0 .7-1.4l-.4-2.6a1.4 1.4 0 0 0-1.4-1.2z"/>',
  chat:'<path d="M20.6 11.6a7.7 7.7 0 0 1-8.3 7.7 8.6 8.6 0 0 1-3.1-.7L3.4 20.6l2-5.8a8.6 8.6 0 0 1-.7-3.1 7.7 7.7 0 0 1 7.7-8.3 7.7 7.7 0 0 1 8.2 8.2z"/>',
  pin:'<path d="M12 21.4s6.8-5.9 6.8-11.1a6.8 6.8 0 1 0-13.6 0C5.2 15.5 12 21.4 12 21.4z"/><circle cx="12" cy="10.1" r="2.6"/>',
  target:'<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.3"/>',
  layers:'<path d="m12 3.2 8.6 4.5L12 12.2 3.4 7.7z"/><path d="m3.4 12.4 8.6 4.5 8.6-4.5M3.4 16.8l8.6 4.5 8.6-4.5"/>',
  folder:'<path d="M3.4 6.6a1.6 1.6 0 0 1 1.6-1.6h4l2 2.6h7.6a1.6 1.6 0 0 1 1.6 1.6v8.2a1.6 1.6 0 0 1-1.6 1.6H5a1.6 1.6 0 0 1-1.6-1.6z"/>',
  image:'<rect x="3.4" y="4.6" width="17.2" height="14.8" rx="2"/><circle cx="8.9" cy="9.6" r="1.6"/><path d="m3.8 17 4.9-4.6a1.8 1.8 0 0 1 2.5 0l5.2 5M14.8 14l1.6-1.5a1.8 1.8 0 0 1 2.5 0l1.7 1.6"/>',
  play:'<path d="M7.5 4.8 19 12 7.5 19.2z"/>',
  pause:'<path d="M9 5v14M15 5v14"/>',
  stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',
  dotsh:'<circle cx="5.5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.5" cy="12" r="1.4"/>',
  print:'<path d="M7 8.5V3.6h10v4.9"/><rect x="3.6" y="8.5" width="16.8" height="7.4" rx="2"/><path d="M7 14.4h10v6H7z"/>',
  share:'<circle cx="18" cy="5.6" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="18.4" r="2.6"/><path d="m8.3 10.7 7.4-3.8M8.3 13.3l7.4 3.8"/>',
  archive:'<rect x="3.4" y="4.4" width="17.2" height="4.2" rx="1.4"/><path d="M5.2 8.6v9.4a1.6 1.6 0 0 0 1.6 1.6h10.4a1.6 1.6 0 0 0 1.6-1.6V8.6M10 12.4h4"/>',
  undo:'<path d="M3.6 12a8.4 8.4 0 1 1 2.5 6"/><path d="M3.2 7.8V12h4.2"/>',
  up:'<path d="M12 19.5v-14M6.5 11 12 5.5 17.5 11"/>',
  down:'<path d="M12 4.5v14M17.5 13 12 18.5 6.5 13"/>',
  left:'<path d="M19.5 12h-14M11 6.5 5.5 12 11 17.5"/>',
  chevu:'<path d="m6 14.5 6-6 6 6"/>',
  expand:'<path d="M8.6 3.6H4.4a.8.8 0 0 0-.8.8v4.2M15.4 3.6h4.2a.8.8 0 0 1 .8.8v4.2M20.4 15.4v4.2a.8.8 0 0 1-.8.8h-4.2M3.6 15.4v4.2a.8.8 0 0 0 .8.8h4.2"/>',
  grid:'<rect x="3.6" y="3.6" width="7" height="7" rx="1.4"/><rect x="13.4" y="3.6" width="7" height="7" rx="1.4"/><rect x="3.6" y="13.4" width="7" height="7" rx="1.4"/><rect x="13.4" y="13.4" width="7" height="7" rx="1.4"/>',
  list:'<path d="M8.4 6.4h12M8.4 12h12M8.4 17.6h12M4 6.4h.01M4 12h.01M4 17.6h.01"/>',
  sort:'<path d="M7 4.6v14.8M3.6 16l3.4 3.4L10.4 16M17 19.4V4.6M13.6 8 17 4.6 20.4 8"/>',
  save:'<path d="M19.4 20.4H4.6a1 1 0 0 1-1-1V4.6a1 1 0 0 1 1-1h11.2l4.6 4.6v11.2a1 1 0 0 1-1 1z"/><path d="M7.6 3.6v5.6h7.4V3.6M7.6 20.4v-6.2h8.8v6.2"/>',
  wallet:'<path d="M3.6 8.4a2 2 0 0 1 2-2h11.6a2 2 0 0 1 2 2"/><rect x="3.6" y="8.4" width="16.8" height="11" rx="2"/><path d="M16.4 14h.01"/>',
  file:'<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>',
  filecheck:'<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5m-9.4 7.2 1.9 1.9 3.9-3.9"/>',
  percent:'<path d="M19 5 5 19"/><circle cx="7.6" cy="7.6" r="2.4"/><circle cx="16.4" cy="16.4" r="2.4"/>',
  trend:'<path d="m3.6 16.4 5.2-5.2 3.4 3.4 7-7"/><path d="M15.4 7.6h4.8v4.8"/>',
  pie:'<path d="M12 3.4v8.6h8.6A8.6 8.6 0 0 0 12 3.4z"/><path d="M20.3 14.4A8.6 8.6 0 1 1 9.6 3.7"/>',
  activity:'<path d="M21.4 12h-4.2l-3 8.4-6-16.8-3 8.4H2.6"/>',
  note:'<path d="M4.6 4.6h14.8v9.6l-5.2 5.2H4.6z"/><path d="M19.4 14.2h-5.2v5.2M8 8.8h8M8 12h5"/>',
};

export function Icon({ name, size, className }: { name: string; size?: "xs" | "sm" | "lg" | "xl"; className?: string }) {
  const cls = "ic" + (size ? " " + size : "") + (className ? " " + className : "");
  /* `.ic` owns the box and the stroke, so every glyph is optically even at all
     five sizes and no drawing carries its own width, height or stroke-width.
     An unknown name renders `doc` rather than nothing: a missing icon should
     be a wrong drawing somebody notices, never an invisible gap in a toolbar
     that silently changes the spacing of everything beside it. */
  return (
    <svg
      className={cls}
      viewBox="0 0 24 24"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICONS[name] || ICONS.doc }}
    />
  );
}

/* The topbar title, panel-wide: it names the module (or its section) and is
   the way up — pressing it returns to the default view at `to`. The same
   role the shell's generic Crumbs plays for modules that claim no crumbs. */
export function TbTitle({ label, to }: { label: ReactNode; to: string }) {
  return (
    <button type="button" className="tb-title" title="Back to the default view"
      onClick={() => go(to)}>{label}</button>
  );
}

/* =============================================================== HELPERS === */
/* esc() is deliberately absent: JSX escapes text. */
export function initials(name?: string | null) {
  const p = String(name || "").trim().split(/\s+/);
  return ((p[0] || "")[0] || "").toUpperCase() + ((p[1] || "")[0] || "").toUpperCase();
}
export function avatarTone(name?: string | null) {
  let n = 0;
  const s = String(name || "");
  for (let i = 0; i < s.length; i++) n += s.charCodeAt(i);
  return ["", "n1", "n2", "n3", "n4"][n % 5];
}
export function qs(obj: Record<string, string | number | null | undefined>) {
  const p: string[] = [];
  for (const k in obj) if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") p.push(k + "=" + encodeURIComponent(String(obj[k])));
  return p.length ? "?" + p.join("&") : "";
}
export function cap(s?: string | null) { return String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1); }

/* Hand a link to the user in whatever way the browser actually supports: the
   OS share sheet where there is one (the user picks WhatsApp / mail / whatever
   themselves), the clipboard otherwise. Returns the line to toast, or null when
   there is nothing to say — the share sheet already spoke, and a cancelled
   sheet is a decision, not a failure.

   Both document blocks (quotations, invoices) go through this, so neither can
   drift back to printing a link into a toast that fades before it can be
   selected. The caller still renders the link on screen: a clipboard write can
   be refused by permissions policy and then the visible text is the only copy
   route left. */
export async function shareOrCopy(url: string, title: string): Promise<string | null> {
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return null;
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return null;
      // anything else (no handler registered, not allowed here) falls through
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "Link copied to the clipboard.";
  } catch {
    return "Could not copy automatically — select the link below.";
  }
}

/* Copy, and only copy — no share sheet. A button labelled Copy that opens the
   OS share dialog leaves the clipboard untouched the moment the user closes
   that dialog, and "Shared." over an untouched clipboard is indistinguishable
   from a copy that silently failed. That was the bug.

   `input` is the on-screen field holding the same text: where the async
   clipboard is unavailable — any origin that is not localhost or https, e.g.
   the panel opened on a LAN IP from `vite --host` — the field is selected and
   the legacy copy command run on it. Deprecated, and still the only route
   there. Returns the line to show. */
export async function copyToClipboard(text: string, input?: HTMLInputElement | null): Promise<string> {
  try {
    await navigator.clipboard.writeText(text);
    return "Copied.";
  } catch { /* insecure origin, or a permissions policy that refuses — fall through */ }
  if (input) {
    input.focus();
    input.select();
    try {
      if (document.execCommand("copy")) return "Copied.";
    } catch { /* fall through to the manual instruction */ }
    return "Press Ctrl+C — the link is selected.";
  }
  return "Could not copy — select the link and copy it.";
}

/* A customer-facing document link, absolute. The API hands back a ROOT-relative
   path ("/q/<token>") and that root is DJANGO's, not this panel's — the public
   document views are mounted at the site root, deliberately outside /api (see
   interior_deals_billing/urls.py). Resolving it against `location.origin` is
   what made "Get share link" hand out a 404 on the admin host. */
export function publicDocUrl(path: string): string {
  try {
    return new URL(path, new URL(config.BASE_URL).origin).href;
  } catch {
    /* A relative BASE_URL (same-origin deploy behind one nginx) — then this
       panel and Django really do share an origin. */
    return new URL(path, location.origin).href;
  }
}

/* Print a server-rendered document sheet without leaving the page it was
   pressed on. The sheet carries its own @page rules, so going through a frame
   is what keeps the panel's sidebar and topbar out of the output — the same
   trick DocPage uses, minus the page. Same sandbox as DocPage: same-origin so
   the frame can be driven, modals so print() is allowed, no scripts. */
export function printHtml(html: string, title: string) {
  const f = document.createElement("iframe");
  f.setAttribute("aria-hidden", "true");
  f.setAttribute("sandbox", "allow-same-origin allow-modals");
  f.title = title;
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  f.srcdoc = html;
  f.onload = () => {
    const w = f.contentWindow;
    if (!w) { f.remove(); return; }
    w.focus();
    w.print();
    /* The dialog is modal on the tab, so by the time print() returns the user
       has answered it. A beat, then the frame goes. */
    window.setTimeout(() => f.remove(), 1000);
  };
  document.body.appendChild(f);
}

/* The link itself, selectable for as long as it is wanted, with its own copy
   button — and it is the reason a share link no longer has to be read off a
   fading toast. This row is also the last resort: when the clipboard is refused
   the text is still on screen, selected, ready for Ctrl+C.

   Feedback is local state rather than a toast so this stays usable from
   anywhere in the app — the shell's toast context imports THIS module. */
export function ShareLine({ link, expires }: { link: string; expires?: string }) {
  const [said, setSaid] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
      {/* .inp so it is a themed control, not an OS-white box on a dark panel;
          it already carries a readonly state. */}
      <input ref={inputRef} className="inp mono" readOnly value={link} style={{ flex: "1 1 260px", minWidth: 0 }}
        onFocus={(e) => e.currentTarget.select()} />
      {/* Copy copies. The share sheet stays on "share link", which is the button
          that asks for one — this one only ever touches the clipboard. */}
      <button className="btn sm" onClick={async () => setSaid(await copyToClipboard(link, inputRef.current))}>
        <Icon name="doc" size="sm" />Copy
      </button>
      <span className="faint" style={{ fontSize: "var(--text-sm)" }}>
        {said ? said + " " : ""}{expires ? "Expires " + fmtDate(expires) : ""}
      </span>
    </div>
  );
}

/* The seeded audit log stores references inside its `text` as `<b>PAY-4503</b>`.
   The prototype wrote that string straight into the cell; innerHTML is banned
   here, so the one tag becomes a real element. Both readers of that log — the
   Audit page and the shell's Activity popover — go through this, so neither can
   drift into showing the raw tags. */
export function richText(s: string): ReactNode[] {
  return String(s)
    .split(/(<b>[\s\S]*?<\/b>)/g)
    .map((part, i) => (part.slice(0, 3) === "<b>" ? <b key={i}>{part.slice(3, -4)}</b> : part));
}

/* --- small render helpers every view shares ------------------------------ */
/* `text` is the prototype's first argument; `children` is the same slot spelt
   the way JSX callers reach for. Both render in the one place the text went. */
/* ONE PILL. THAT IS THE WHOLE POINT OF IT.
   -----------------------------------------------------------------------------
   This used to be two drawings behind one name: six tones went to a library
   Badge and everything else fell through to the panel's own `.pill`. Two
   components meant two shapes, two heights and two dot sizes on the same
   toolbar, and "Active" in one module did not look like "Active" in the next —
   which is the exact failure a status chip exists to prevent.

   Now there is one element and one class, and the tone is a modifier on it.
   A status, a stage, a priority, a tier and a tag are all THIS, so the eye
   learns the shape once and reads the colour after. `Pill` is also the only
   place any of them are drawn: a module that wants a status renders a Pill and
   cannot accidentally invent a seventh way to say "pending".

   THE TONES, and what each one is allowed to mean:
     ok warn bad info      the four statuses. Nothing else may use them.
     brand                 ours / current / selected — the forest thread.
     neutral               a fact with no judgement attached.
     live                  happening right now, and only that.
     system                the system did it: automation, derivation, audit.
     solid line dead       shapes, not meanings — a filled chip, an outline
                           chip, and a struck-through one for a cancelled
                           record. They combine with a tone.
     n1…n4                 the tag palette: hues that mean NOTHING by
                           contract, so a customer's own labels can never be
                           mistaken for a status the system assigned. */
export function Pill({ text, tone, lg, xs, title, dot, ico, children }: {
  text?: ReactNode; tone?: string; lg?: boolean; xs?: boolean; title?: string;
  dot?: boolean; ico?: string; children?: ReactNode;
}) {
  return (
    <span className={"pill" + (tone ? " " + tone : "") + (lg ? " lg" : "") + (xs ? " xs" : "")}
      title={title}>
      {dot ? <span className="dot" /> : null}
      {ico ? <Icon name={ico} size="xs" /> : null}
      {text}{children}
    </span>
  );
}

export interface TileProps {
  k?: ReactNode;
  /* already-built markup in the prototype — a ReactNode here */
  v?: ReactNode;
  s?: ReactNode;
  icon?: string;
  tone?: string;
  on?: boolean;
  serif?: boolean;
  /* `data-go` hash; a tile without one is a <div>, not a <button> */
  to?: string;
  /** THE COMPARISON, and it is not optional in spirit: "▲ 11%" on its own is
   *  unreadable — up against what? `delta.dir` colours the small number and
   *  `delta.of` names the period beside it. The FIGURE is never coloured by
   *  trend, because up is not always good: rising unclosed days is bad, and a
   *  green 11 would say the opposite. The judgement is the caller's, per
   *  metric, and it is spent on the delta. */
  delta?: { dir: "up" | "down" | "flat"; text: ReactNode; of?: ReactNode };
  /** anything else that belongs on the comparison line — a pill, a meter */
  foot?: ReactNode;
}
export function Tile(o: TileProps) {
  const arrow = o.delta ? (o.delta.dir === "down" ? "▼" : o.delta.dir === "up" ? "▲" : "—") : null;
  const inner = (
    <>
      <div className="k">{o.icon ? <Icon name={o.icon} size="sm" /> : null}{o.k}</div>
      <div className={"v" + (o.serif ? " serif" : "")}>{o.v}</div>
      {o.s ? <div className="s">{o.s}</div> : null}
      {o.delta || o.foot ? (
        <div className="foot">
          {o.delta ? (
            <span className={"delta " + o.delta.dir}>
              <span aria-hidden="true">{arrow}</span>{o.delta.text}
            </span>
          ) : null}
          {o.delta && o.delta.of ? <span>{o.delta.of}</span> : null}
          {o.foot}
        </div>
      ) : null}
    </>
  );
  const cls = "tile" + (o.tone ? " " + o.tone : "") + (o.on ? " on" : "");
  return o.to
    ? <button className={cls} data-go={o.to} onClick={() => go(o.to as string)}>{inner}</button>
    : <div className={cls}>{inner}</div>;
}

export function Tiles({ list, cols }: { list: TileProps[]; cols?: number }) {
  return (
    <div className={"tiles" + (cols ? " c" + cols : "")}>
      {list.map((t, i) => <Tile key={i} {...t} />)}
    </div>
  );
}

/* One field renderer for the whole app. Deals, Quotation and Invoice each
   grew their own copy of this and had already drifted — Invoice's lacked
   placeholder text on both control types and a help tone, Quotation's had
   no readonly support, neither had `custom`. This is the union of all
   three, so nothing any module already relies on is lost by sharing it. */
export interface FieldProps {
  label?: ReactNode;
  id?: string;
  /* already-built markup in the prototype — a ReactNode here */
  custom?: ReactNode;
  help?: ReactNode;
  tone?: string;
  req?: boolean;
  type?: string;
  options?: { v: string; l: string; sel?: boolean }[];
  rows?: number;
  ph?: string;
  value?: string | number;
  ro?: boolean;
  readonly?: boolean;
}
export function Field(o: FieldProps) {
  const help = o.help ? <div className={"help" + (o.tone ? " " + o.tone : "")}>{o.help}</div> : null;
  if (o.custom)
    return <div className="fg"><span className="fg-lb">{o.label}</span>{o.custom}{help}</div>;
  const opts = o.options || [];
  return (
    <div className="fg">
      <label htmlFor={o.id}>{o.label}{o.req ? <> <span className="req">*</span></> : null}</label>
      {o.type === "select"
        ? <select className="inp" id={o.id} defaultValue={(opts.filter((x) => x.sel)[0] || { v: undefined }).v}>
            {opts.map((x, i) => <option key={i} value={x.v}>{x.l}</option>)}
          </select>
        : o.type === "textarea"
          ? <textarea className="inp" id={o.id} rows={o.rows} placeholder={o.ph || ""} defaultValue={o.value || ""} />
          : <input className="inp" id={o.id} type={o.type || "text"}
              defaultValue={o.value === 0 ? "0" : (o.value || "")}
              placeholder={o.ph || ""} readOnly={!!(o.ro || o.readonly)} />}
      {help}
    </div>
  );
}

export interface EmptyStateProps {
  icon?: string;
  title?: ReactNode;
  body?: ReactNode;
  /* already-built markup in the prototype — a ReactNode here */
  action?: ReactNode;
}
/* AN EMPTY STATE IS DASHED, NOT SOLID. The dashed edge is the whole message:
   it says "a thing goes here and there is not one yet", which a solid card
   with centred text does not — that reads as a finished panel that happens to
   be about nothing. The border is also why this never carries a shadow: it is
   an absence, and an absence should not appear to float above the page. */
export function EmptyState(o: EmptyStateProps) {
  return (
    <div className="empty">
      <span className="g"><Icon name={o.icon || "inbox"} size="lg" /></span>
      {o.title ? <h3>{o.title}</h3> : null}
      {o.body ? <p>{o.body}</p> : null}
      {o.action}
    </div>
  );
}

/* One pane waiting on its own record, while the page around it stays put.
   NOT the full-page AdminLoader: that one is for a screen with nothing on it
   yet, and using it for a record swap throws the whole layout away and brings
   it back — which reads as a reload of something the user did not reload. */
export function PaneLoading({ label }: { label?: ReactNode }) {
  return (
    <div className="pane-load" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label || "Loading…"}</span>
    </div>
  );
}

/* A LIST waiting on its first fetch. Every list screen in this panel is the
   same three bands — command row, attention strip, rows — so one skeleton
   covers all of them, and the layout the rows land in is already on screen
   before they arrive. Purely decorative: one `role="status"` for the screen
   reader, `aria-hidden` on the bars themselves. */
export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  const bars = (n: number, w?: number) =>
    Array.from({ length: n }, (_, i) => (
      <span className="sk" key={i} aria-hidden="true" style={w ? { width: w } : undefined} />
    ));
  return (
    <div className="dls" role="status" aria-label="Loading">
      <div className="dls-cmd">
        {bars(2, 148)}
        <span className="spacer" />
        {bars(1, 132)}
      </div>
      <div className="dls-attn sk-attn">{bars(5)}</div>
      <div className="dls-body sk-rows">{bars(rows)}</div>
    </div>
  );
}

/* `text` was documented as already-built HTML in the prototype; here it is a
   ReactNode, and `children` is the same slot for callers who prefer JSX. */
export function Notice({ text, tone, ico, children }: { text?: ReactNode; tone?: string; ico?: string; children?: ReactNode }) {
  return (
    <div className={"notice" + (tone ? " " + tone : "")}>
      <Icon name={ico || "alert"} />
      <div>{text}{children}</div>
    </div>
  );
}

/* The prototype's `.tabs` row — the theme already carries the styling, only the
   component was missing. `n` is a count badge; a zero prints nothing rather than
   a "0" nobody needs to read. */
/* THE TAB ROW. Five modules hand-rolled `<div className="tabs">` with their own
   buttons to get three things this component did not offer: an icon in the
   label, a link-style tab that carries `data-go`, and a count that is a plain
   figure rather than a demand. All three are props now.

   `n` shows only when it means somebody owes something -- "3 waiting". A count
   that is merely a size, like how many responses arrived, is `quiet`, so it
   does not read as a to-do. */
export function Tabs({ items, cur, onPick, cls }: {
  items: {
    k: string; label: ReactNode; icon?: string;
    n?: number | null; quiet?: boolean;
    /** a LINK tab: carries `data-go` and routes through `go()` */
    to?: string;
  }[];
  cur: string;
  onPick?: (k: string) => void;
  cls?: string;
}) {
  return (
    <div className={"tabs" + (cls ? " " + cls : "")} role="tablist">
      {items.map((t) => (
        <button key={t.k} type="button" role="tab"
          aria-selected={t.k === cur}
          data-go={t.to}
          onClick={() => { if (onPick) onPick(t.k); if (t.to) go(t.to); }}
          className={t.k === cur ? "on" : ""}>
          {t.icon ? <Icon name={t.icon} size="sm" /> : null}
          {t.label}
          {typeof t.n === "number" && t.n > 0
            ? <span className={"n" + (t.quiet ? " is-quiet" : "")}>{t.n}</span>
            : null}
        </button>
      ))}
    </div>
  );
}

export function SectionHead({ title, desc, right }: { title?: ReactNode; desc?: ReactNode; right?: ReactNode }) {
  return (
    <div className="sh">
      <h2>{title}</h2>
      {desc ? <span className="d">{desc}</span> : null}
      {right ? <span className="r">{right}</span> : null}
    </div>
  );
}

export function KvList({ pairs, cls }: { pairs: [ReactNode, ReactNode][]; cls?: string }) {
  return (
    <dl className={"kv " + (cls || "")}>
      {pairs.map((p, i) => (
        <Fragment key={i}>
          <dt>{p[0]}</dt>
          <dd>{p[1] === null || p[1] === undefined || p[1] === "" ? <span className="faint">—</span> : p[1]}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

export interface TableProps {
  cols: { label?: ReactNode; cls?: string; w?: string }[];
  /* each row is a <tr> the caller builds — already-built markup in the prototype */
  rows: ReactNode[];
  empty?: EmptyStateProps;
  scroll?: boolean;
  min?: string;
  /** a LIST PAGE's table: flat on the page, no card frame. Same head, same
   *  cells, same hover as the framed one -- the frame is the only difference. */
  list?: boolean;
}
export function Table(o: TableProps) {
  return (
    <div className={"tw" + (o.list ? " flat" : "") + (o.scroll ? " scroll" : "")}>
      <table className={"tbl" + (o.list ? " dls-tbl" : "")} style={o.min ? { minWidth: o.min } : undefined}>
        <thead>
          <tr>{o.cols.map((c, i) => <th key={i} className={c.cls || ""} style={c.w ? { width: c.w } : undefined}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {o.rows.length
            ? o.rows.map((r, i) => <Fragment key={i}>{r}</Fragment>)
            : <tr><td colSpan={o.cols.length} style={{ padding: 0 }}>
                <EmptyState {...(o.empty || { title: "Nothing here yet", body: "" })} />
              </td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* THE STAT STRIP — the list workspace's one band of numbers.
   Deals invented it, Quotations now renders from the same function, and the
   rule it encodes is worth stating once: every count is also the filter for
   itself. Clicking a cell IS the filter; clicking the one you are on clears
   it, so the strip is never a trap you have to leave via the chip row.

   A cell with no `to` is a READ-OUT — rendered quieter and not pressable,
   because a cell that highlights on hover and does nothing on click is worse
   than one that never invited the press. Money is always a read-out.

   Pass the string "sep" for a hairline. The trailing spacer packs the row
   left, so a strip of four cells and a strip of eight both start at the same
   x as the command row above them.                                          */
/* THE LIST TABLE. Twelve list pages wrote `<table className="tbl dls-tbl">`
   by hand -- Users added `um-tbl`, Finance added `fin-tbl` and called its
   figure column `num` where everybody else said `n`, and the exception rail in
   column one was drawn three ways at two heights. `Table` above is the CARD
   table, framed in `.tw` with its head in a well, which is right for a record's
   sub-list and wrong for a queue: a queue sits flat on the page with its head
   on the plane, and its rows are two lines tall.

   The rows are still the caller's -- a queue's row is the whole module -- but
   the frame, the head, the rail column and the figure columns are one drawing.
   `head` is the `<tr>` of `<th>`s, so a migration is the wrapper only. */
export function ListTable({ head, children, cls, min }: {
  head: ReactNode; children: ReactNode; cls?: string; min?: string;
}) {
  return (
    <div className="tw flat scroll">
      <table className={"tbl dls-tbl" + (cls ? " " + cls : "")}
        style={min ? { minWidth: min } : undefined}>
        <thead>{head}</thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/* The exception stripe in a list row's first column: 3px in a status colour,
   findable without reading. `tone` is the row's judgement -- the caller decides
   whether "overdue" is `bad` or `warn`; the stripe only paints it. */
export function Rail({ tone, title }: { tone?: string; title?: string }) {
  return <td className="rail"><i className={tone || undefined} title={title} /></td>;
}

export interface StatCell {
  k?: ReactNode;
  v?: ReactNode;
  dot?: string;
  tone?: string;
  on?: boolean;
  title?: string;
  /** Rich hover/focus help, rendered as a styled tooltip instead of the native
   *  `title` — which cannot be styled, waits about a second, truncates long
   *  text, and (the reason this exists) never appears on keyboard focus at all.
   *  Set `tip` OR `title`, never both, or two tooltips fight over the cursor. */
  tip?: ReactNode;
  to?: string;
}
export function StatStrip({ cells }: { cells: (StatCell | "sep")[] }) {
  return (
    <div className="dls-attn">
      {cells.map((c, i) => {
        if (c === "sep") return <span key={i} className="dls-sep"></span>;
        const body = (
          <>
            {c.dot !== undefined ? <span className={"dls-cdot " + (c.dot || "")}></span> : null}
            <span className="v tnum">{c.v}</span><span className="k">{c.k}</span>
          </>
        );
        const cls = "dls-stat" + (c.tone ? " " + c.tone : "") + (c.on ? " on" : "");
        /* THE TOOLTIP IS A SIBLING OF THE CELL, not a child, and that is the
           whole trick. Inside the button its text would join the accessible
           NAME: the cell would announce as "1 untouched In qualification, with
           not one contact attempt logged against it…" instead of "1 untouched".
           As a sibling reached by `aria-describedby` it stays a DESCRIPTION,
           which is what it is, and CSS reaches it with an adjacent-sibling
           selector. Absolutely positioned, so it is not a flex item either. */
        const tipId = c.tip ? "stat-tip-" + i : undefined;
        /* A cell that sets both loses the native one rather than showing two
           tooltips over one target. Enforced here instead of trusted to the
           doc comment on StatCell, because the failure is silent and looks
           like a browser bug from the outside. */
        const nativeTitle = c.tip ? undefined : c.title;
        const cell = c.to
          ? <button key={i} className={cls} data-go={c.to} title={nativeTitle}
              aria-describedby={tipId} onClick={() => go(c.to as string)}>{body}</button>
          : <div key={i} className={cls + " ro"} title={nativeTitle} aria-describedby={tipId}>{body}</div>;
        return c.tip
          ? <Fragment key={i}>
              {cell}
              <span className="dls-tip" role="tooltip" id={tipId}>{c.tip}</span>
            </Fragment>
          : cell;
      })}
      <span className="spacer"></span>
    </div>
  );
}

export function LinkChip({ refText, to, ico }: { refText?: ReactNode; to: string; ico?: string }) {
  return (
    <a className="pill line" data-go={to} onClick={() => go(to)}>
      <Icon name={ico || "link"} size="sm" />
      <span className="mono">{refText}</span>
    </a>
  );
}

export function Toolbar({ children }: { children?: ReactNode }) {
  return <div className="toolbar">{children}</div>;
}

/* THE SEARCH FIELD. A real <input type="search"> with a leading glyph inside
   the control's own box, so the icon is part of the field rather than a
   decoration sitting next to it. `data-filter` rides on the REAL input —
   Plans, Roles and Team read it back with
   querySelector('input[data-filter="q"]') — which is why the wrapper cannot
   own that attribute even though it owns the border. */
export function SearchField({ ph, val, name, onFilter }: {
  ph?: string; val?: string; name?: string; onFilter?: (name: string, value: string) => void;
}) {
  return (
    <span className="field grow">
      <Icon name="search" size="sm" />
      <input type="search" placeholder={ph} defaultValue={val || ""} autoComplete="off"
        aria-label={ph || "Search"}
        data-filter={name || "q"}
        onChange={(e) => onFilter && onFilter(name || "q", e.target.value)} />
    </span>
  );
}

/* THE FILTER SELECT IS THE LISTBOX IN ./select.tsx. A native <select> lived
   here -- "a real <select>, on purpose" -- and it was the wrong purpose: the
   closed control took the panel's paint, the OPEN list was the operating
   system's, and sixteen filter rows ended in a rectangle of system blue while
   Business Enquiries drew its own and looked like the product. One dropdown
   now, and it is that one. The prop shape is unchanged, so no caller moved. */
export { Select } from "./select";
export type { SelectOption, SelectOptionLike } from "./select";

/* =============================================================================
   CHIP INPUT — several values in one field
   -----------------------------------------------------------------------------
   THE CONTROL THIS SYSTEM WAS ASKED FOR BY NAME. A text box holding a
   comma-separated string looks like one value and behaves like several: you
   cannot see where one ends, you cannot remove the third without re-reading the
   whole line, and a stray comma silently creates an empty entry.

   THE BOX IS THE INPUT: the chips sit inside it and the caret follows them, so
   there is one target rather than a field beside a list of what it produced.
   Enter commits, and so does a comma — somebody pasting "onboarding, sales"
   means two, and pressing Enter twice is a rule they would have to be taught.
   Backspace on an empty box takes the last chip back, because its absence is
   the thing that makes a chip field feel broken.

   It was Resources' own `ChipField`, module-local in every respect except the
   idea. Promoted here whole: same behaviour, same markup, `.chips-input` in the
   shared layer instead of `.rs-tagbox` in one module's sheet — so the next
   field that holds a list gets it for free instead of growing a fourth version
   of it that handles Backspace differently.

   `clean` is the caller's, not this component's. Resources folds case, trims
   and de-duplicates against its own rules and its own cap; a control that
   guessed at those would be wrong for the next field that has different ones.
   The default is the honest minimum — trim, drop the empties, drop exact
   repeats — and nothing more. */
export function ChipInput({
  id, value, onChange, placeholder, clean, disabled, invalid, ariaLabel, max,
}: {
  id?: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  /** the caller's normaliser — folds case, caps the list, rejects a duplicate */
  clean?: (v: string[]) => string[];
  disabled?: boolean;
  invalid?: boolean;
  ariaLabel?: string;
  max?: number;
}) {
  const [draft, setDraft] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const norm =
    clean ||
    ((v: string[]) => {
      const out: string[] = [];
      v.forEach((raw) => {
        const t = String(raw || "").trim();
        if (t && out.indexOf(t) < 0) out.push(t);
      });
      return typeof max === "number" ? out.slice(0, max) : out;
    });

  const commit = (raw: string) => {
    const next = norm(value.concat(String(raw).split(",")));
    if (next.length !== value.length) onChange(next);
    setDraft("");
  };

  return (
    <div
      ref={box}
      className={"chips-input" + (invalid ? " bad" : "") + (disabled ? " is-disabled" : "")}
      /* CLICKING THE BOX FOCUSES THE BOX. The chips are most of its surface, so
         without this the two-thirds of the control that is chips is dead to a
         click — the one thing a person tries first when a field looks full. */
      onMouseDown={(e) => {
        if (disabled) { e.preventDefault(); return; }
        if ((e.target as HTMLElement).closest("button,input")) return;
        e.preventDefault();
        const el = box.current && box.current.querySelector("input");
        if (el) (el as HTMLInputElement).focus();
      }}
    >
      {value.map((t) => (
        <span key={t} className="chip on">
          {t}
          {!disabled && (
            <button type="button" className="x" aria-label={"Remove " + t}
              onClick={() => onChange(value.filter((y) => y !== t))}>
              <Icon name="x" size="sm" />
            </button>
          )}
        </span>
      ))}
      <input
        id={id}
        value={draft}
        disabled={disabled}
        aria-label={ariaLabel}
        placeholder={value.length && !placeholder ? "Add another" : placeholder}
        onChange={(e) => {
          if (e.target.value.indexOf(",") >= 0) commit(e.target.value);
          else setDraft(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && draft.trim()) { e.preventDefault(); commit(draft); }
          if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        /* COMMIT ON BLUR. A typed word left in the box when somebody presses
           Save is a value they believe they entered; dropping it silently is
           how a form loses an answer without ever saying so. */
        onBlur={() => { if (draft.trim()) commit(draft); }}
      />
    </div>
  );
}

export function FilterChips({ params, labels, onUnfilter }: {
  params: Record<string, string | undefined>;
  labels?: Record<string, string>;
  onUnfilter?: (key: string) => void;
}) {
  const keys = Object.keys(params).filter((k) => params[k] && k !== "tab");
  if (!keys.length) return null;
  return (
    /* The key and the value are two elements, not one string. They answer
       different questions — the key is context you already have once you have
       read the value, so it carries less weight. As one text node they were the
       same colour and the eye had to read both at full attention.

       "Clear all" leaves the pill shape entirely: it is an ACTION, and dressed
       as a chip it read as one more filter that happened to be switched off. */
    <div className="chiprow filters">
      {keys.map((k) => (
        <span key={k} className="chip on">
          <span className="k">{(labels && labels[k]) || k}</span>
          <span className="v">{params[k]}</span>
          <button className="x" data-unfilter={k}
            aria-label={"Remove the " + ((labels && labels[k]) || k) + " filter"}
            onClick={() => onUnfilter && onUnfilter(k)}><Icon name="x" size="sm" /></button>
        </span>
      ))}
      <button className="chip-clear" data-unfilter="*"
        onClick={() => onUnfilter && onUnfilter("*")}>Clear all</button>
    </div>
  );
}





/* #############################################################################
   ###                                                                       ###
   ###   THE COMPONENT LIBRARY                                               ###
   ###                                                                       ###
   #############################################################################

   WHY THESE EXIST AT ALL
   ----------------------
   The panel used to compose most of these inline, per screen, out of raw
   elements and class names. That is how five modules ended up with five
   drawings of "a status", four heights of "a toolbar button", and three
   different ideas of what a date-range control is. A component here is not a
   convenience — it is the only way a system with nineteen routes still looks
   like one product a year from now.

   THEY REUSE THE PANEL'S EXISTING CLASS VOCABULARY, DELIBERATELY.
   `.fg` is a form group, `.inp` is a field, `.check` is a checkbox, `.av` is an
   avatar, `.tile` is a metric card, `.mi` is a menu item, `.pill` is a status.
   Those names are already written across nine module sheets and a thousand
   lines of component CSS. A component that introduced `.form-field` beside
   `.fg` would not be a new component — it would be a SECOND design system with
   one member, and it would grow.

   So: where the panel already had a drawing, these wrap it. Where it did not,
   they add one. Nothing below draws a second version of something above it.

   THE RULES EVERY COMPONENT KEEPS
   -------------------------------
     · It reads TOKENS, never a value. Not one inline colour, radius, shadow or
       font size appears in this file.
     · It is correct in both themes because it never names a theme.
     · It is reachable and operable from the keyboard, and says what it is to a
       screen reader.
     · It takes already-built markup only where the caller genuinely composes
       something — a row, an action, a value — and a plain prop everywhere else.
     · It has ONE drawing. A variant is a modifier on that drawing, never a
       second component with a similar name.
   ========================================================================== */


/* =============================================================================
   NAVIGATION
   ========================================================================== */

/* BREADCRUMBS — where this record sits, and the way back up.
   THE LAST CRUMB IS NOT A LINK: it is where you already are, and making it
   pressable invites a navigation that does nothing. `.crumbs` is the shell's
   own breadcrumb rail, so a module that builds its crumbs here and one whose
   crumbs the shell builds are the same object. */
export function Breadcrumbs({ items }: { items: { label: ReactNode; to?: string }[] }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <Fragment key={i}>
            {i ? <span className="sep">/</span> : null}
            {last || !c.to
              ? <span className="here" aria-current={last ? "page" : undefined}>{c.label}</span>
              : <a href={c.to} data-go={c.to}
                  onClick={(e) => { e.preventDefault(); go(c.to as string); }}>{c.label}</a>}
          </Fragment>
        );
      })}
    </nav>
  );
}

/* SEGMENTED — two to four fixed options, switched in one press.
   A RADIOGROUP, not a row of buttons: the arrow keys move between the options
   and the chosen one is announced as selected. Use it when the options will
   not grow; use a Select the moment they might.

   It renders `.btn-group`, which the panel already used for exactly this and
   which had no keyboard behaviour of its own. Roving tabindex, because a
   radiogroup with three tab stops makes somebody press Tab three times to
   leave a control they did not want to change. */
export function Segmented({ options, value, onPick, label, sm }: {
  options: { v: string; l: ReactNode }[];
  value: string;
  onPick: (v: string) => void;
  label?: string;
  sm?: boolean;
}) {
  const move = (dir: number) => {
    const i = options.findIndex((o) => o.v === value);
    const next = options[(i + dir + options.length) % options.length];
    if (next) onPick(next.v);
  };
  return (
    <div className={"btn-group" + (sm ? " sm" : "")} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.v} type="button" role="radio"
          className={o.v === value ? "on" : undefined}
          aria-checked={o.v === value}
          tabIndex={o.v === value ? 0 : -1}
          data-act="seg" data-v={o.v}
          onClick={() => onPick(o.v)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(1); }
            if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(-1); }
          }}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

/* PAGINATION — which page, how many, and the two ways to move.
   THE COUNT IS THE IMPORTANT HALF. "Page 3 of 9" answers a different question
   from "241 results", and somebody working a queue needs both: one says where
   they are, the other says how much is left.

   A WINDOW, NOT EVERY PAGE. Nine hundred numbered buttons is not a control, it
   is a wall — so the two ends stay reachable and the middle is a window around
   where you are, with an ellipsis standing in for the gap. */
export function Pagination({ page, pages, total, unit, pageSize, shown, alwaysCount, onPage }: {
  page: number; pages: number; total?: number; unit?: string;
  /** with `pageSize` the count becomes a RANGE — "21–40 of 241". A person
   *  working a queue reads the range to know where they are in it, and the
   *  total to know how much is left; the two are different questions and the
   *  range answers the one a bare total cannot. `shown` is the actual row
   *  count, which is smaller than `pageSize` on the last page. */
  pageSize?: number; shown?: number;
  /** keep the count line on a single-page list. Off by default: most list
   *  screens in this panel already state their total in the attention strip
   *  above the table, and a second copy of it under the last row is a line
   *  that says nothing new. Pass it where there is no strip. */
  alwaysCount?: boolean;
  onPage: (p: number) => void;
}) {
  /* NOTHING TO PAGE, NOTHING TO SAY. A pager under a list that fits on one
     page is furniture: there is no "where am I" to answer. */
  if (pages <= 1 && !alwaysCount) return null;
  const first = pageSize ? (page - 1) * pageSize + 1 : 0;
  const last = pageSize ? first + (shown === undefined ? pageSize : shown) - 1 : 0;
  const win: (number | "gap")[] = [];
  const push = (n: number) => { if (win.indexOf(n) < 0) win.push(n); };
  push(1);
  if (page > 3) win.push("gap");
  for (let n = Math.max(2, page - 1); n <= Math.min(pages - 1, page + 1); n++) push(n);
  if (page < pages - 2) win.push("gap");
  if (pages > 1) push(pages);

  return (
    <div className="pager-bar">
      {total !== undefined ? (
        <span className="pager-n">
          {pageSize ? (
            <>
              <b className="tnum">{first.toLocaleString()}–{last.toLocaleString()}</b>
              {" of "}<b className="tnum">{total.toLocaleString()}</b>{" "}
            </>
          ) : (
            <><b className="tnum">{total.toLocaleString()}</b>{" "}</>
          )}
          {unit || (total === 1 ? "result" : "results")}
        </span>
      ) : null}
      <span className="spacer" />
      {pages > 1 ? (
        <nav className="pager" aria-label="Pagination">
          <button type="button" className="pg-step" disabled={page <= 1}
            aria-label="Previous page" onClick={() => onPage(page - 1)}>
            <Icon name="chevl" size="sm" />
          </button>
          {win.map((n, i) =>
            n === "gap"
              ? <span key={"g" + i} className="pg-gap">…</span>
              : <button key={n} type="button"
                  aria-current={n === page ? "page" : undefined}
                  aria-label={"Page " + n}
                  onClick={() => onPage(n)}>{n}</button>
          )}
          <button type="button" className="pg-step" disabled={page >= pages}
            aria-label="Next page" onClick={() => onPage(page + 1)}>
            <Icon name="chevr" size="sm" />
          </button>
        </nav>
      ) : null}
    </div>
  );
}


/* =============================================================================
   FORM CONTROLS
   -----------------------------------------------------------------------------
   ONE HEIGHT PER ROW. Every control below is `lg` (38px) by default, because a
   form is read as a column and a column of mixed heights reads as broken. `sm`
   (26px) exists for a control inside a toolbar or a table cell, where the row
   height is already set by something else.

   THE LABEL IS ALWAYS A REAL <label>. Placeholder-as-label is the most common
   accessibility defect in an admin panel, and it fails at the exact moment it
   matters: the question disappears the instant somebody starts typing an
   answer, so they cannot check they are answering the right one.

   THE CLASSES ARE THE PANEL'S OWN — `.fg` for the group, `.inp` for the field,
   `.check` for a box. These components are the one place that markup is
   written, not a new set of names beside it.
   ========================================================================== */

/* The wrapper every control shares: the label, the control, and then EITHER an
   error or a hint — never both. An error appearing under a hint pushes the hint
   down and reads as a second sentence of it, so the two share one slot and the
   error wins it. */
export function FormField({ id, label, req, hint, err, children, cls }: {
  id?: string; label?: ReactNode; req?: boolean; hint?: ReactNode; err?: ReactNode;
  children: ReactNode; cls?: string;
}) {
  return (
    <div className={"fg" + (cls ? " " + cls : "")}>
      {label ? (
        <label htmlFor={id}>
          {label}{req ? <span className="req" title="Required">*</span> : null}
        </label>
      ) : null}
      {children}
      {err
        ? <span className="fg-err" role="alert"><Icon name="alert" size="xs" />{err}</span>
        : hint ? <span className="help">{hint}</span> : null}
    </div>
  );
}

export interface InputProps {
  id?: string; name?: string; type?: string; value?: string; defaultValue?: string;
  ph?: string; err?: boolean; disabled?: boolean; readOnly?: boolean;
  sm?: boolean; required?: boolean; ariaLabel?: string; autoFocus?: boolean;
  min?: string | number; max?: string | number; step?: string | number;
  onChange?: (v: string) => void; onEnter?: () => void;
}

export function Input(p: InputProps) {
  return (
    <input
      id={p.id} name={p.name} type={p.type || "text"}
      className={"inp" + (p.err ? " bad" : "") + (p.sm ? " sm" : "")}
      value={p.value} defaultValue={p.defaultValue} placeholder={p.ph}
      disabled={p.disabled} readOnly={p.readOnly} required={p.required}
      aria-label={p.ariaLabel} aria-invalid={p.err || undefined}
      autoFocus={p.autoFocus} min={p.min} max={p.max} step={p.step}
      onChange={(e) => p.onChange && p.onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter" && p.onEnter) p.onEnter(); }}
    />
  );
}

export function Textarea(p: InputProps & { rows?: number }) {
  return (
    <textarea
      id={p.id} name={p.name} rows={p.rows || 4}
      className={"inp ta" + (p.err ? " bad" : "")}
      value={p.value} defaultValue={p.defaultValue} placeholder={p.ph}
      disabled={p.disabled} readOnly={p.readOnly} required={p.required}
      aria-label={p.ariaLabel} aria-invalid={p.err || undefined}
      onChange={(e) => p.onChange && p.onChange(e.target.value)}
    />
  );
}

/* A FORM select, and deliberately not the same component as the toolbar
   `Select` above. That one is a FILTER: it carries an "active" state, because
   a filter silently changes what every number under it means. This one is an
   ANSWER: it carries a required state and an error state instead. One drawing
   (`.inp.sel`), two states — collapsing them would put a state on a control
   that has no use for it. */
export function SelectInput({ id, name, options, value, defaultValue, ph, err, sm, disabled, ariaLabel, onChange }: {
  id?: string; name?: string;
  options: (string | { v: string; l: string })[];
  value?: string; defaultValue?: string; ph?: string; err?: boolean; sm?: boolean;
  disabled?: boolean; ariaLabel?: string; onChange?: (v: string) => void;
}) {
  return (
    <select id={id} name={name} disabled={disabled} aria-label={ariaLabel}
      className={"inp sel" + (err ? " bad" : "") + (sm ? " sm" : "")}
      value={value} defaultValue={defaultValue} aria-invalid={err || undefined}
      onChange={(e) => onChange && onChange(e.target.value)}>
      {ph !== undefined ? <option value="">{ph}</option> : null}
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.v;
        const l = typeof o === "string" ? o : o.l;
        return <option key={v} value={v}>{l}</option>;
      })}
    </select>
  );
}

/* INPUT GROUP — a field with a fixed prefix or suffix welded to it: ₹, %, /mo,
   a unit, a domain. ONE control with one border and one focus ring, not a
   field beside a label: the affix is part of what the value MEANS, and a gap
   between them says it is not. */
export function InputGroup({ pre, post, children, action }: {
  pre?: ReactNode; post?: ReactNode; children: ReactNode; action?: ReactNode;
}) {
  return (
    <span className="affix">
      {pre ? <span className="cap">{pre}</span> : null}
      {children}
      {post ? <span className="cap r">{post}</span> : null}
      {action}
    </span>
  );
}

/* CHECKBOX and RADIO — one drawing each, in the whole product. The checkbox in
   a table row is the same control as the checkbox in a form; they differ only
   in what is beside them. The indeterminate state is real and is set through
   the DOM property, because HTML has no attribute for it — which is why a
   "some rows selected" header box used to be drawn as fully checked. */
export function Checkbox({ id, checked, indeterminate, disabled, label, hint, onChange, ariaLabel }: {
  id?: string; checked?: boolean; indeterminate?: boolean; disabled?: boolean;
  label?: ReactNode; hint?: ReactNode; ariaLabel?: string;
  onChange?: (v: boolean) => void;
}) {
  const box = (
    <input type="checkbox" id={id} checked={checked} disabled={disabled}
      aria-label={ariaLabel}
      ref={(el) => { if (el) el.indeterminate = !!indeterminate; }}
      onChange={(e) => onChange && onChange(e.target.checked)} />
  );
  if (!label) return box;
  return (
    <label className={"check" + (disabled ? " is-disabled" : "")} htmlFor={id}>
      {box}
      <span className="ck-t">
        {label}
        {hint ? <span className="ck-h">{hint}</span> : null}
      </span>
    </label>
  );
}

export function Radio({ id, name, value, checked, disabled, label, hint, onChange }: {
  id?: string; name: string; value: string; checked?: boolean; disabled?: boolean;
  label?: ReactNode; hint?: ReactNode; onChange?: (v: string) => void;
}) {
  return (
    <label className={"check" + (disabled ? " is-disabled" : "")} htmlFor={id}>
      <input type="radio" id={id} name={name} value={value} checked={checked}
        disabled={disabled} onChange={() => onChange && onChange(value)} />
      <span className="ck-t">
        {label}
        {hint ? <span className="ck-h">{hint}</span> : null}
      </span>
    </label>
  );
}

/* TOGGLE — an IMMEDIATE switch, not a form answer.
   THE DISTINCTION IS THE WHOLE COMPONENT: a checkbox is submitted, a toggle
   takes effect the moment it moves. Using a toggle for something that only
   applies on Save is why people press Save twice and then go back to check
   whether it worked. */
export function Toggle({ id, on, disabled, label, hint, onChange, ariaLabel }: {
  id?: string; on: boolean; disabled?: boolean; label?: ReactNode; hint?: ReactNode;
  ariaLabel?: string; onChange: (v: boolean) => void;
}) {
  const sw = (
    <button type="button" id={id} className="sw" role="switch"
      aria-checked={on} aria-label={ariaLabel} disabled={disabled}
      onClick={() => onChange(!on)} />
  );
  if (!label) return sw;
  return (
    <div className={"sw-row" + (disabled ? " is-disabled" : "")}>
      {sw}
      <span className="ck-t">
        {label}
        {hint ? <span className="ck-h">{hint}</span> : null}
      </span>
    </div>
  );
}

/* DATE — a real <input type="date">, so it gets the platform's own picker, the
   platform's own locale and keyboard entry that already works everywhere. A
   hand-built calendar is three hundred lines that is worse on a phone and
   worse with a screen reader. */
export function DateInput({ id, value, min, max, sm, disabled, ariaLabel, onChange }: {
  id?: string; value?: string; min?: string; max?: string; sm?: boolean;
  disabled?: boolean; ariaLabel?: string; onChange?: (v: string) => void;
}) {
  return (
    <input type="date" id={id} className={"inp date" + (sm ? " sm" : "")}
      value={value} min={min} max={max} disabled={disabled} aria-label={ariaLabel}
      onChange={(e) => onChange && onChange(e.target.value)} />
  );
}

/* DATE RANGE — two dates that constrain each other. `from` caps what `to` will
   accept and the other way round, so a range running backwards cannot be
   ENTERED rather than being rejected after somebody has finished typing it. */
export function DateRange({ from, to, sm, onChange, labelFrom, labelTo }: {
  from?: string; to?: string; sm?: boolean;
  labelFrom?: string; labelTo?: string;
  onChange: (from: string, to: string) => void;
}) {
  return (
    <span className="daterange">
      <DateInput value={from || ""} max={to || undefined} sm={sm}
        ariaLabel={labelFrom || "From"} onChange={(v) => onChange(v, to || "")} />
      <span className="dash">–</span>
      <DateInput value={to || ""} min={from || undefined} sm={sm}
        ariaLabel={labelTo || "To"} onChange={(v) => onChange(from || "", v)} />
    </span>
  );
}

/* MULTI-SELECT — several values from a KNOWN list.
   A list of checkboxes in a menu, not a tag input: the options are known and
   finite, so the control's job is to show what is available and what is
   chosen, and a text box that autocompletes hides both. The closed control
   says HOW MANY are on, because that is the only thing you need from it while
   you are reading the table underneath.

   For free text that is NOT from a list — a customer's own labels — use
   ChipInput above. They look similar and are not interchangeable. */
export function MultiSelect({ options, value, onChange, label, sm, max }: {
  options: { v: string; l: ReactNode }[];
  value: string[];
  onChange: (v: string[]) => void;
  label?: string; sm?: boolean; max?: number;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const toggle = (v: string) =>
    onChange(value.indexOf(v) >= 0 ? value.filter((x) => x !== v) : value.concat(v));

  return (
    <div className="msel" ref={box}
      onBlur={(e) => {
        const el = box.current;
        if (el && !el.contains(e.relatedTarget as Node)) setOpen(false);
      }}>
      <button type="button" className={"sel-t" + (sm ? " sm" : "") + (value.length ? " on" : "")}
        aria-expanded={open} aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}>
        <span className="l">{label || "Select"}</span>
        {value.length ? <span className="ct tnum">{value.length}</span> : null}
        <Icon name="chev" size="sm" className="sel-caret" />
      </button>
      {open ? (
        <div className="menu" role="listbox" aria-multiselectable="true">
          {max && value.length >= max
            ? <div className="menu-note">{max} is the most you can pick.</div>
            : null}
          {options.map((o) => {
            const on = value.indexOf(o.v) >= 0;
            const blocked = !!max && !on && value.length >= max;
            return (
              <label key={o.v} className={"mi" + (blocked ? " is-disabled" : "")}
                role="option" aria-selected={on}>
                <input type="checkbox" checked={on} disabled={blocked}
                  onChange={() => toggle(o.v)} />
                <span className="trunc">{o.l}</span>
              </label>
            );
          })}
          {value.length ? (
            <>
              <div className="msep" role="separator" />
              <button type="button" className="mi" onClick={() => onChange([])}>
                Clear all
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* FILE UPLOAD — a drop zone that is ALSO a button, because half the people
   using this panel will drag a file in and half will click to browse, and a
   control that supports only one of those is broken for half of them.

   IT NAMES WHAT IT ACCEPTS AND HOW BIG BEFORE ANYTHING IS CHOSEN. A rejection
   after the upload starts is a rejection somebody could have been spared. */
export function FileUpload({ id, accept, multiple, hint, disabled, onFiles }: {
  id?: string; accept?: string; multiple?: boolean; hint?: ReactNode;
  disabled?: boolean; onFiles: (files: File[]) => void;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const take = (list: FileList | null) => {
    if (!list || !list.length) return;
    onFiles(Array.prototype.slice.call(list) as File[]);
  };
  return (
    <div className={"dropzone" + (over ? " is-over" : "") + (disabled ? " is-disabled" : "")}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setOver(false);
        if (!disabled) take(e.dataTransfer.files);
      }}>
      <input ref={input} id={id} type="file" accept={accept} multiple={multiple}
        disabled={disabled} className="sr"
        onChange={(e) => { take(e.target.files); e.target.value = ""; }} />
      <Icon name="upload" size="lg" />
      <div className="dz-t">
        <button type="button" className="tlink" disabled={disabled}
          onClick={() => { const el = input.current; if (el) el.click(); }}>
          Choose a file
        </button>
        <span> or drag it here</span>
      </div>
      {hint ? <div className="dz-h">{hint}</div> : null}
    </div>
  );
}


/* =============================================================================
   OVERLAYS
   -----------------------------------------------------------------------------
   A TOAST CONFIRMS · A MODAL DECIDES · A DRAWER INSPECTS · A POPOVER OFFERS.

   Those four sentences are the whole routing rule, and each mistake they
   prevent is one this panel has actually made: a modal that only confirms
   interrupts for nothing; a drawer that asks a question can be dismissed by
   clicking away from the question; a popover that decides something loses the
   decision the moment the window scrolls.

   The SHELL owns where they appear — ShellContext's drawer / modal / openPop /
   toast. The components below own what is INSIDE one, so every modal across
   nineteen routes puts its title in the same place and its actions in the same
   order.
   ========================================================================== */

/* A MODAL'S ACTIONS READ RIGHT TO LEFT: the primary is last, because that is
   where the eye finishes and where the pointer already is. The destructive one
   is pulled to the far LEFT so it is never the button beside the one somebody
   meant to press. */
/* THE MODAL HEAD. Twenty-six files drew this by hand -- `<div className="md-h">`,
   an `<h3>`, a `<p>` (sometimes `.mono`, sometimes not), and a close button
   drawn three different ways: a module-local `MdX`, a raw `.md-x` with an
   Icon, a raw `.md-x` with an inline SVG. Fifty-five heads, one shape, four
   drawings, and two competing `.md-x` rules in the stylesheet -- one absolute,
   one flex -- because each drawing needed a different one.

   One component now. `sub` is the line under the title; `mono` sets it in the
   data face for an id; `ico` is the hero variant, where an icon anchors the
   dialog so it reads as a thing that opened rather than a page that swapped. */
export function ModalHead({ title, sub, mono, ico, onClose }: {
  title: ReactNode; sub?: ReactNode; mono?: boolean; ico?: string; onClose?: () => void;
}) {
  return (
    <div className={"md-h" + (ico ? " md-hero" : "")}>
      {ico ? <span className="md-ic"><Icon name={ico} /></span> : null}
      <div className="min-0">
        <h3>{title}</h3>
        {sub ? <p className={mono ? "mono" : undefined}>{sub}</p> : null}
      </div>
      {onClose ? (
        <button type="button" className="md-x" data-close="1" aria-label="Close" onClick={onClose}>
          <Icon name="x" />
        </button>
      ) : null}
    </div>
  );
}

/* THE DRAWER HEAD, the same object one layer over: a drawer inspects a record
   while the list it came from stays on screen, so its head carries the
   record's identity -- an avatar or a mark -- where a modal's carries a
   question. */
export function DrawerHead({ title, sub, mark, onClose, right }: {
  title: ReactNode; sub?: ReactNode; mark?: ReactNode; onClose?: () => void; right?: ReactNode;
}) {
  return (
    <div className="dw-h">
      {mark}
      <div className="min-0">
        <h3>{title}</h3>
        {sub ? <div className="dw-sub">{sub}</div> : null}
      </div>
      {right}
      {onClose ? (
        <button type="button" className="dw-x" aria-label="Close" onClick={onClose}>
          <Icon name="x" size="sm" />
        </button>
      ) : null}
    </div>
  );
}

export function ModalShell({ title, sub, mono, ico, children, actions, danger, onClose }: {
  title?: ReactNode; sub?: ReactNode; mono?: boolean; ico?: string; children?: ReactNode;
  actions?: ReactNode; danger?: ReactNode; onClose?: () => void;
}) {
  return (
    <>
      {title ? <ModalHead title={title} sub={sub} mono={mono} ico={ico} onClose={onClose} /> : null}
      <div className="md-b">{children}</div>
      {actions || danger ? (
        <div className="md-f">
          {danger ? <span className="left">{danger}</span> : null}
          {actions}
        </div>
      ) : null}
    </>
  );
}

/* CONFIRM — the one modal the panel draws for itself, so that every
   irreversible action in the product asks the same way.

   IT NAMES THE THING. "Delete 3 enquiries?" and "Are you sure?" are the same
   dialog to whoever wrote it and completely different to somebody about to
   lose work — so `title` takes the object and `body` takes the consequence.
   The confirm button repeats the VERB rather than saying OK, because the last
   words read before a press should be what the press does. */
export function ConfirmModal({ title, body, verb, tone, onConfirm, onClose, busy }: {
  title: ReactNode; body?: ReactNode; verb?: string; tone?: "bad" | "pri";
  onConfirm: () => void; onClose: () => void; busy?: boolean;
}) {
  return (
    <ModalShell title={title} onClose={onClose}
      actions={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className={"btn " + (tone === "bad" ? "dgr" : "pri")}
            disabled={busy} onClick={onConfirm}>
            {busy ? <span className="spinner sm" /> : null}
            {verb || "Confirm"}
          </button>
        </>
      }>
      {typeof body === "string" ? <p className="md-p">{body}</p> : body}
    </ModalShell>
  );
}

/* DRAWER — inspects a record while the list it came from stays on screen
   behind it. That is the entire reason it is not a modal, and it is why a
   drawer must never hold the only copy of an unsaved answer. */
export function DrawerShell({ title, sub, children, actions, onClose }: {
  title?: ReactNode; sub?: ReactNode; children?: ReactNode;
  actions?: ReactNode; onClose?: () => void;
}) {
  return (
    <>
      {title ? <DrawerHead title={title} sub={sub} onClose={onClose} /> : null}
      <div className="dw-b">{children}</div>
      {actions ? <div className="dw-f">{actions}</div> : null}
    </>
  );
}

/* MENU — the CONTENTS of a dropdown or an account popover. The shell positions
   it through `openPop`; this decides what a menu looks like everywhere in the
   panel. `.mi` and `.msep` are the panel's own menu row and rule.
   A DESTRUCTIVE ITEM IS LAST AND SEPARATED, for the same reason it is pulled
   left in a modal footer. */
export function MenuItem({ ico, label, desc, right, danger, disabled, current, to, onClick }: {
  ico?: string; label: ReactNode; desc?: ReactNode; right?: ReactNode; danger?: boolean;
  disabled?: boolean; current?: boolean; to?: string; onClick?: () => void;
}) {
  return (
    <button type="button" role="menuitem" disabled={disabled}
      className={"mi" + (danger ? " dgr" : "") + (current ? " on" : "")}
      aria-current={current || undefined}
      data-go={to}
      onClick={() => { if (onClick) onClick(); else if (to) go(to); }}>
      {ico ? <Icon name={ico} size="sm" /> : null}
      <span className="min-0">
        <b className="trunc">{label}</b>
        {desc ? <span className="d">{desc}</span> : null}
      </span>
      {right ? <span className="r">{right}</span> : null}
    </button>
  );
}
export function MenuSection({ children }: { children: ReactNode }) {
  return <div className="mi-sec">{children}</div>;
}
export function MenuDivider() {
  return <div className="msep" role="separator" />;
}

/* TOOLTIP — a LABEL for something that has none, and nothing else.
   It is `title`-shaped on purpose but it is not `title`: the native tooltip
   cannot be themed, truncates, waits about a second, and never opens on
   keyboard focus — so help attached with it is unreachable without a mouse.
   This one opens on hover AND on focus.

   IT MUST NEVER HOLD THE ONLY COPY OF SOMETHING. A tooltip is invisible to
   search, to export and to anybody reading the screen aloud. If the content
   matters, it belongs on the page. */
export function Tooltip({ tip, children, side }: {
  tip: ReactNode; children: ReactNode; side?: "top" | "bottom";
}) {
  const [on, setOn] = useState(false);
  return (
    <span className="tt-wrap"
      onMouseEnter={() => setOn(true)} onMouseLeave={() => setOn(false)}
      onFocus={() => setOn(true)} onBlur={() => setOn(false)}>
      {children}
      <span className={"tt " + (side || "top")} role="tooltip"
        data-open={on ? "true" : undefined}>{tip}</span>
    </span>
  );
}

/* INFO — the small circled "i" beside a figure, and the popover it opens.
   Deliberately NOT a tooltip: a tooltip labels, this EXPLAINS. So it is a
   press rather than a hover, and it stays open while it is being read. */
export function InfoDot({ children, label }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  return (
    <span className="i-wrap" ref={wrap}
      onBlur={(e) => {
        const el = wrap.current;
        if (el && !el.contains(e.relatedTarget as Node)) setOpen(false);
      }}>
      <button type="button" className="i-btn" aria-expanded={open}
        aria-label={label || "What is this?"}
        onClick={() => setOpen((o) => !o)}>i</button>
      <span className="i-pop" data-open={open ? "true" : undefined}>{children}</span>
    </span>
  );
}


/* =============================================================================
   FEEDBACK
   ========================================================================== */

/* ALERT — a condition about THIS PAGE that somebody should read before acting.
   It renders `.notice`, which the panel already used for exactly this, so an
   alert raised by a view and one raised by the shell are the same object.

   NOT A TOAST. A toast is a receipt for something that already happened, and
   it goes away. An alert is a condition that is still true, and it stays until
   the condition does not. */
export function Alert({ tone, title, children, action, onClose }: {
  tone?: "ok" | "warn" | "bad" | "info"; title?: ReactNode; children?: ReactNode;
  action?: ReactNode; onClose?: () => void;
}) {
  const t = tone || "info";
  const ico = t === "ok" ? "check" : t === "info" ? "info" : "alert";
  return (
    <div className={"notice " + t} role={t === "bad" ? "alert" : "status"}>
      <Icon name={ico} size="sm" />
      <div className="min-0">
        {title ? <b>{title}</b> : null}
        {children ? <p>{children}</p> : null}
      </div>
      {action || onClose ? (
        <span className="nt-act">
          {action}
          {onClose ? (
            <button type="button" className="nt-x" aria-label="Dismiss" onClick={onClose}>
              <Icon name="x" size="xs" />
            </button>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

/* THE PROGRESS BAR, and the rule that keeps it honest: it is BRAND by default,
   because progress toward a target is one of the things the portal's colour is
   for, and it takes a status tone only when the bar ITSELF is the judgement —
   an overdrawn budget, a missed target. `max` exists so a caller never has to
   compute a percentage and get the clamp wrong. */
export function Meter({ value, max, tone, label }: {
  value: number; max?: number; tone?: "ok" | "warn" | "bad"; label?: string;
}) {
  const pct = Math.max(0, Math.min(100, ((value || 0) / (max || 100)) * 100));
  return (
    <div className={"meter" + (tone ? " " + tone : "")}
      role="progressbar" aria-valuenow={Math.round(pct)}
      aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <i style={{ width: pct + "%" }} />
    </div>
  );
}

/* THE DELTA IS COLOURED, THE VALUE IS NOT. Up is not always good — rising
   unclosed days is bad — so the judgement is made per metric by the caller and
   spent on the small number, never on the figure itself. `Tile` renders this
   same class, so a delta in a metric card and one in a table cell are one
   drawing. */
export function Delta({ value, suffix, dir, of }: {
  value: ReactNode; suffix?: string; dir: "up" | "down" | "flat"; of?: ReactNode;
}) {
  const arrow = dir === "down" ? "▼" : dir === "up" ? "▲" : "—";
  return (
    <>
      <span className={"delta " + dir}><span aria-hidden="true">{arrow}</span>{value}{suffix}</span>
      {of ? <span className="delta-of">{of}</span> : null}
    </>
  );
}


/* =============================================================================
   CONTENT
   ========================================================================== */

/* CARD — the plane a group of related things stands on.
   `ticks` opts into the two corner marks that mean INSTRUMENT: a KPI, a chart
   frame, a measured figure. Never on a card that is only a container — the
   marks are a claim that what is inside was MEASURED, and spending them on a
   box of links makes them mean nothing anywhere.

   THERE IS NO `KpiCard` HERE, ON PURPOSE. `Tile` above is the panel's metric
   card and it already carries the ticks, the tracked label, the display
   numeral and the delta line. A second one would have been the fifth drawing
   of a number in a box. */
export function Card({ title, sub, right, children, foot, ticks, cls, tight }: {
  title?: ReactNode; sub?: ReactNode; right?: ReactNode; children?: ReactNode;
  foot?: ReactNode; ticks?: boolean; cls?: string; tight?: boolean;
}) {
  return (
    <section className={"card" + (ticks ? " ticks" : "") + (cls ? " " + cls : "")}>
      {title || right ? (
        <header className="card-h">
          <h3>{title}</h3>
          {sub ? <span className="d">{sub}</span> : null}
          {right ? <span className="r">{right}</span> : null}
        </header>
      ) : null}
      <div className={"card-b" + (tight ? " tight" : "")}>{children}</div>
      {foot ? <footer className="card-f">{foot}</footer> : null}
    </section>
  );
}

/* THE TRACKED MICRO-LABEL — a metric name, a column head, a section key.
   Set uppercase BY THE TYPE SYSTEM rather than typed uppercase, so the string
   can still be searched, exported and read aloud correctly. The rule that
   trails off to the right is what makes a page of these read as a set of
   instrument panels rather than a page of small headings. */
export function Eyebrow({ children, bare }: { children: ReactNode; bare?: boolean }) {
  return <div className={"eyebrow" + (bare ? " bare" : "")}>{children}</div>;
}

/* AVATAR — initials on a tinted ground, with the tint derived FROM THE NAME so
   the same person is the same colour on every screen in the product. Never a
   colour picked per render, which is the version that makes a list look like
   it reshuffled itself every time you scroll back to it.
   The four tints mean nothing, by contract — they identify, they do not rank. */
export function Avatar({ name, src, lg, sm, xl }: {
  name?: string | null; src?: string | null; lg?: boolean; sm?: boolean; xl?: boolean;
}) {
  const size = xl ? " xl" : lg ? " lg" : sm ? " sm" : "";
  return src
    ? <span className={"av" + size}><img src={src} alt="" /></span>
    : <span className={"av " + avatarTone(name) + size}>{initials(name)}</span>;
}

/* A PERSON, as one object: the face, the name, and what they are. Used in a
   table cell, a menu, an assignment, a feed row — one drawing, so a person
   looks like the same kind of thing everywhere they appear. */
export function Person({ name, sub, src, lg, sm, to }: {
  name?: string | null; sub?: ReactNode; src?: string | null;
  lg?: boolean; sm?: boolean; to?: string;
}) {
  const inner = (
    <>
      <Avatar name={name} src={src} lg={lg} sm={sm} />
      <span className="who-t min-0">
        <span className="trunc">{name || "—"}</span>
        {sub ? <span className="who-s trunc">{sub}</span> : null}
      </span>
    </>
  );
  return to
    ? <a className="who is-link" href={to} data-go={to}
        onClick={(e) => { e.preventDefault(); go(to); }}>{inner}</a>
    : <span className="who">{inner}</span>;
}

/* TIMELINE — what happened to THIS RECORD, newest first, with the system's own
   entries marked as the system's. A derived event and a person's decision look
   identical in a flat list, and telling those apart is most of what an audit
   trail is for. */
export function Timeline({ items }: {
  items: { title: ReactNode; meta?: ReactNode; body?: ReactNode; tone?: "sys" | "bad" | "ok" }[];
}) {
  if (!items.length) return null;
  return (
    <div className="tl">
      {items.map((it, i) => (
        <div className="tl-i" key={i}>
          <span className={"tl-d" + (it.tone ? " " + it.tone : "")} />
          <div className="min-0">
            <div className="tl-t">{it.title}</div>
            {it.body ? <div className="tl-body">{it.body}</div> : null}
            {it.meta ? <div className="tl-m">{it.meta}</div> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ACTIVITY FEED — a stream of things PEOPLE did, with a face on each entry.
   The timeline above is for what happened to one record; this is for what is
   happening across the panel. Two different questions, which is why the feed
   leads with WHO and the timeline leads with WHAT. */
export function ActivityFeed({ items }: {
  items: { who?: string | null; what: ReactNode; when?: ReactNode; ico?: string }[];
}) {
  if (!items.length) return null;
  return (
    <ul className="feed">
      {items.map((it, i) => (
        <li key={i} className="fd">
          {it.ico
            ? <span className="fd-ic"><Icon name={it.ico} size="sm" /></span>
            : <Avatar name={it.who} sm />}
          <div className="min-0">
            <div className="bd">{it.what}</div>
            {it.when ? <div className="at">{it.when}</div> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}


/* =============================================================================
   CRM
   -----------------------------------------------------------------------------
   THE POINT OF THIS SECTION IS THAT THERE IS ONLY ONE OF EACH.

   "Qualified" was drawn four different ways across this panel — a coloured
   word in one module, an outline chip in another, a filled badge in a third,
   a dot plus text in a fourth. All four were correct locally and the set was
   incoherent, because nothing owned the question "what does a lead status look
   like in this product".

   These components own it. A module hands in the KEY and gets the drawing; it
   cannot pick a tone, because picking a tone per call site is exactly how the
   four versions happened. When a new state appears, it is added HERE and the
   whole panel gains it at once.
   ========================================================================== */

/* THE STATUS MAPS. One line per state, and the tone is a decision about
   MEANING, not about looks:
     neutral  nothing is wrong and nothing is owed
     info     somebody or something is working on it
     ok       finished well
     warn     needs a human today
     bad      finished badly, or blocked

   NO STATUS IS EVER `brand`, AND THAT IS THE POINT OF THIS BLOCK.
   ------------------------------------------------------------------------
   Three of these used to be forest — "new", "assigned", "open" — on the
   reasoning that they mean "ours, in hand". Drawn, the result was a row of
   eight chips of which five were green: forest for ours, success-green for
   finished, and the two greens are ~16° apart in hue, which at chip size on a
   soft tint is no distance at all. "Assigned" and "Converted" were the same
   colour to anybody scanning a column of them, and a list scanned by colour
   that cannot be scanned by colour is worse than one with no colour in it.

   So forest is spent where the brief actually wants it — active nav, the
   selected row, links, focus, progress, the current pipeline stage, the active
   filter, the first chart series — and never on a status. A status is a
   SIGNAL; the brand is an IDENTITY; a chip that is both is neither. `Pill
   tone="brand"` still exists for marking something as current, and no status
   map reaches for it. */
const LEAD_TONE: Record<string, string> = {
  /* nobody has contacted this customer at all — the whole reason the attention
     strip counts it, so it is work waiting, not a neutral fact */
  new: "warn",
  processing: "info",
  /* confirmed and frozen, waiting on the routing decision */
  qualified: "ok",
  assigned: "info",
  converted: "ok",
  rejected: "bad",
  /* matching found no business: a supply gap, not a bad enquiry */
  "no-match": "warn", nomatch: "warn",
  duplicate: "neutral", contacted: "info", pending: "warn", closed: "neutral",
};
/* ONE MAP FOR DEALS, SUBSCRIPTIONS, INVOICES AND TASKS, because "paid", "won"
   and "completed" are the same fact about three different objects and should
   not be three different greens. */
const DEAL_TONE: Record<string, string> = {
  open: "info", won: "ok", lost: "bad", stalled: "warn",
  negotiation: "info", proposal: "info", draft: "neutral",
  active: "ok", paused: "warn", cancelled: "bad", expired: "neutral",
  paid: "ok", unpaid: "warn", overdue: "bad", refunded: "neutral",
  approved: "ok", declined: "bad", "in-review": "info", sent: "info",
  completed: "ok", "in-progress": "info", "not-started": "neutral",
  settled: "ok", partial: "warn", failed: "bad", scheduled: "info",
};
/* PRIORITY IS A RAMP, NOT A PALETTE. The hotter the colour the sooner it wants
   a human, and the bottom of the ramp is hollow because "someday" is not a
   commitment at all. Ordinal data should look ordinal. */
const PRIORITY_TONE: Record<string, string> = {
  critical: "bad", urgent: "bad", high: "warn", medium: "info",
  normal: "neutral", low: "neutral", someday: "neutral",
  p1: "bad", p2: "warn", p3: "info", p4: "neutral",
};

/** `new-lead` → "New Lead". The words come from the key unless the module has
    its own vocabulary from the server, in which case it passes `label`. The
    TONE is never overridable — that is the whole contract. */
const titleise = (k: string) =>
  String(k || "").replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function LeadStatus({ status, label, lg }: { status: string; label?: ReactNode; lg?: boolean }) {
  const k = String(status || "").toLowerCase();
  return <Pill tone={LEAD_TONE[k] || "neutral"} dot lg={lg} text={label || titleise(k)} />;
}

export function DealStatus({ status, label, lg }: { status: string; label?: ReactNode; lg?: boolean }) {
  const k = String(status || "").toLowerCase();
  return <Pill tone={DEAL_TONE[k] || "neutral"} dot lg={lg} text={label || titleise(k)} />;
}

export function Priority({ level, label }: { level: string; label?: ReactNode }) {
  const k = String(level || "").toLowerCase();
  return <Pill tone={PRIORITY_TONE[k] || "neutral"} dot text={label || titleise(k)} />;
}

/* A TAG IS NOT A STATUS. The tag palette is eleven hues that mean NOTHING by
   contract, so a label somebody typed can never be mistaken for a state the
   system assigned. `auto` marks a tag the system applied rather than a person,
   because "who decided this" is the first question anybody asks about a tag
   they did not expect. */
export function Tag({ label, tone, auto, onRemove }: {
  label: ReactNode; tone?: string; auto?: boolean; onRemove?: () => void;
}) {
  return (
    <span className={"pill xs" + (tone ? " tag-" + tone : "") + (auto ? " is-auto" : "")}>
      {auto ? <Icon name="sparkle" size="xs" /> : null}
      {label}
      {onRemove ? (
        <button type="button" className="x" aria-label="Remove tag" onClick={onRemove}>
          <Icon name="x" size="xs" />
        </button>
      ) : null}
    </span>
  );
}

/* A ROW OF TAGS WITH A CEILING. Twelve tags in a table cell push every other
   column off the screen, so the row shows `max` and counts the rest — and the
   count is a real number rather than an ellipsis, because "+7" tells somebody
   whether it is worth opening the record. */
export function Tags({ items, max }: {
  items: { label: string; tone?: string; auto?: boolean }[];
  max?: number;
}) {
  if (!items.length) return null;
  const shown = max ? items.slice(0, max) : items;
  const rest = items.length - shown.length;
  return (
    <span className="chiprow">
      {shown.map((t, i) => <Tag key={i} label={t.label} tone={t.tone} auto={t.auto} />)}
      {rest > 0 ? <span className="pill xs" title={items.slice(shown.length).map((t) => t.label).join(", ")}>+{rest}</span> : null}
    </span>
  );
}

/* PIPELINE — the stages of a deal, and which one it is at.
   EVERY STAGE IS ON SCREEN, including the ones already passed and the ones
   still ahead, because "where is this and how far is left" is one question and
   a bar showing only the current step answers half of it. */
export function Pipeline({ stages, current, compact }: {
  stages: { k: string; label: string }[];
  current: string;
  compact?: boolean;
}) {
  const at = Math.max(0, stages.findIndex((s) => s.k === current));
  return (
    <ol className={"pipe" + (compact ? " compact" : "")}
      aria-label={"Stage " + (at + 1) + " of " + stages.length}>
      {stages.map((s, i) => (
        <li key={s.k}
          className={"pipe-s" + (i < at ? " done" : i === at ? " now" : "")}
          aria-current={i === at ? "step" : undefined}>
          <span className="pipe-n">{i < at ? <Icon name="check" size="xs" /> : i + 1}</span>
          <span className="pipe-l trunc">{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

/* ASSIGNMENT — who owns this, or the fact that nobody does.
   UNASSIGNED IS A STATE, NOT A BLANK. An empty cell reads as missing data; a
   marked "Unassigned" reads as work waiting for a decision, which is what it
   is and what somebody has to act on. */
export function Assignee({ name, role, to }: {
  name?: string | null; role?: ReactNode; to?: string;
}) {
  if (!name) return <span className="unassigned"><Icon name="user" size="xs" />Unassigned</span>;
  return <Person name={name} sub={role} sm to={to} />;
}


/* =============================================================================
   ANALYTICS
   -----------------------------------------------------------------------------
   The charts themselves live in views/charts.tsx and read the `--chart-*`
   tokens. What is here is the furniture around them, so that a chart in
   Finance and a chart in Team are framed, labelled and keyed the same way.
   ========================================================================== */

/* A CHART LEGEND, drawn once. The swatch is a square rather than a line
   because a 9px line disappears at a glance, and the legend is the only key to
   what the colours mean. */
export function Legend({ items }: { items: { label: ReactNode; color: string }[] }) {
  return (
    <div className="legend">
      {items.map((s, i) => (
        <span key={i}><i style={{ background: s.color }} />{s.label}</span>
      ))}
    </div>
  );
}

/* THE FRAME A CHART SITS IN — a title, an optional right-hand control, the
   plot, and the key under it. It carries the corner ticks for the same reason
   a metric tile does: what is inside was measured. */
export function ChartFrame({ title, right, children, legend, note, ticks = true }: {
  title?: ReactNode; right?: ReactNode; children: ReactNode;
  legend?: { label: ReactNode; color: string }[]; note?: ReactNode; ticks?: boolean;
}) {
  return (
    <figure className={"chartframe" + (ticks ? " ticks" : "")}>
      {title || right ? (
        <figcaption className="cf-h">
          <h4 className="min-0 trunc">{title}</h4>
          {right ? <span className="r">{right}</span> : null}
        </figcaption>
      ) : null}
      <div className="cf-plot">{children}</div>
      {legend ? <Legend items={legend} /> : null}
      {note ? <div className="cf-note">{note}</div> : null}
    </figure>
  );
}
