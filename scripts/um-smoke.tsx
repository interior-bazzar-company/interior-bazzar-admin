/* =============================================================================
   Users Management · the render smoke.   `npm run check:users-render`
   -----------------------------------------------------------------------------
   Every face of the module, rendered to a string, failing on any throw.

   WHAT THIS USED TO BE, AND WHY IT IS SMALLER. The suite asserted the strip's
   counts, the vocabulary on screen, the analytics cards, the record tabs and
   the dialogs — all of it against the bundled seed (`IB-U-0912` and friends)
   that the module read at import. The module reads `GET admin/users/` now:
   there is no seed to assert against, `renderToStaticMarkup` runs no effects so
   nothing fetches, and every one of those assertions was reading an empty
   store. They are a browser test now, not a node one.

   What is left is the half that still means something without data, and it is
   the half that catches the regressions this migration actually causes: the
   module imports cleanly, and every route, face and parameter renders its
   loading or empty state instead of throwing on a record that is not there.
   ========================================================================== */

/* A DOM stub, not a DOM. The shell reads the stored theme and density off
   `document.documentElement` while it renders, and there is no jsdom in this
   repo — the six calls it makes are all the shell needs to get through a render
   pass, and the assertion is that the MODULE renders, not that the shell's
   appearance plumbing works headless. */
const el = () => ({
  getAttribute: () => null,
  setAttribute: () => {},
  removeAttribute: () => {},
  classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
  style: { setProperty: () => {} },
  appendChild: () => {}, removeChild: () => {}, contains: () => false,
  addEventListener: () => {}, removeEventListener: () => {},
  focus: () => {}, querySelector: () => null, querySelectorAll: () => [],
});
const g = globalThis as unknown as Record<string, unknown>;
const doc = { ...el(), documentElement: el(), body: el(), createElement: el, activeElement: null };
g.document = doc;
g.window = {
  document: doc,
  /* react-aria's focus-visible setup sees a `window` and reads
     HTMLElement.prototype.focus; the class only has to exist. */
  HTMLElement: class { focus() {} }, Element: class {}, Node: class {},
  addEventListener: () => {}, removeEventListener: () => {},
  matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  getComputedStyle: () => ({ getPropertyValue: () => "" }),
  setTimeout, clearTimeout, requestAnimationFrame: (f: () => void) => setTimeout(f, 0),
};
g.localStorage = (g.window as Record<string, unknown>).localStorage;
g.matchMedia = (g.window as Record<string, unknown>).matchMedia;

import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ShellProvider } from "../src/admin/shell/ShellContext";
import Users from "../src/admin/views/Users";

/* ShellProvider calls useNavigate itself, so the Router has to be OUTSIDE it —
   the same order AdminShell mounts them in. */
const at = (url: string) => renderToStaticMarkup(
  <MemoryRouter initialEntries={[url]}>
    <ShellProvider>
      <Routes>
        <Route path="/users" element={<Users />} />
        <Route path="/users/:id" element={<Users />} />
      </Routes>
    </ShellProvider>
  </MemoryRouter>
);

/* Two faces and one record. `?tab=` names a face of the record and Profile is
   the default, so `/users/:id` and `/users/:id?tab=profile` are one screen. The
   stale addresses are here on purpose — an old bookmark has to land somewhere
   sensible rather than on a blank page. */
const URLS: [string, string][] = [
  ["users (default)", "/users"],
  ["users filtered", "/users?status=active&city=Mumbai&flag=incomplete"],
  ["users searched", "/users?q=sharma"],
  ["users page 2", "/users?page=2"],
  ["users page past the end", "/users?page=99"],
  ["users empty", "/users?q=zzzznothing"],
  ["users custom range", "/users?registered=custom&from=2026-01-01&to=2026-08-01"],
  ["users sorted by name", "/users?sort=name"],
  ["users on a withdrawn sort", "/users?sort=ending"],
  ["users on a withdrawn filter", "/users?cls=active_member"],
  ["users on a withdrawn face", "/users?view=members"],
  ["analytics (default)", "/users?view=analytics"],
  ["analytics · 3-month range", "/users?view=analytics&start=2026-06&end=2026-08"],
  ["analytics · 12-month range", "/users?view=analytics&start=2025-09&end=2026-08"],
  ["analytics · single month", "/users?view=analytics&start=2026-08&end=2026-08"],
  ["analytics · reversed range", "/users?view=analytics&start=2026-08&end=2026-03"],
  ["analytics · out-of-bounds range", "/users?view=analytics&start=2019-01&end=2099-12"],
  ["record · defaults to the profile", "/users/IB-U-0912"],
  ["record · profile, named", "/users/IB-U-0912?tab=profile"],
  ["record · commercial", "/users/IB-U-0912?tab=commercial"],
  ["record · notes", "/users/IB-U-0912?tab=notes"],
  ["record · audit", "/users/IB-U-0912?tab=audit"],
  ["record · a stale membership tab", "/users/IB-U-0912?tab=history&term=IB-MB-0912-2"],
  ["record · an id nothing answers to", "/users/IB-U-NOPE"],
];

let failed = 0;
const check = (label: string, fn: () => string) => {
  try {
    const html = fn();
    if (!html || html.length < 40) throw new Error("rendered almost nothing (" + html.length + " chars)");
    console.log("  ok   " + label + "  (" + html.length + " chars)");
  } catch (e) {
    failed++;
    console.log("  FAIL " + label + "\n         " + (e as Error).message.split("\n")[0]);
  }
};

console.log("\nsurfaces");
URLS.forEach(([label, url]) => check(label, () => at(url)));

console.log(failed ? "\n" + failed + " FAILED\n" : "\nevery surface rendered\n");
process.exit(failed ? 1 : 0);
