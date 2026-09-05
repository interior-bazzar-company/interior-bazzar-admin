/* Render every Team surface to a string and fail on any throw.

   Users and Finance have had one of these for a while; Team did not, and the
   gap showed: a face can stop rendering entirely while `tsc`, eslint and the
   derivation suite all stay green, because none of them ever calls the
   component. This does.

   A DOM stub, not a DOM — the same one those two use, for the same reason: the
   shell reads theme and density off `document.documentElement` while it
   renders and there is no jsdom in this repo. The assertion is that the MODULE
   renders, not that the shell's appearance plumbing works headless. */
const el = () => ({
  getAttribute: () => null,
  setAttribute: () => {},
  removeAttribute: () => {},
  classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
  style: { setProperty: () => {} },
  appendChild: () => {}, removeChild: () => {}, contains: () => false,
  addEventListener: () => {}, removeEventListener: () => {},
  focus: () => {}, click: () => {}, querySelector: () => null, querySelectorAll: () => [],
});
const g = globalThis as unknown as Record<string, unknown>;
const doc = { ...el(), documentElement: el(), body: el(), createElement: el, activeElement: null };
g.document = doc;
g.window = {
  document: doc,
  addEventListener: () => {}, removeEventListener: () => {},
  matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  getComputedStyle: () => ({ getPropertyValue: () => "" }),
  print: () => {}, prompt: () => null,
  setTimeout, clearTimeout, requestAnimationFrame: (f: () => void) => setTimeout(f, 0),
};
g.localStorage = (g.window as Record<string, unknown>).localStorage;
g.matchMedia = (g.window as Record<string, unknown>).matchMedia;

import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ShellProvider } from "../src/admin/shell/ShellContext";
import Work from "../src/admin/views/Team/Work";
import Attendance from "../src/admin/views/Team/Attendance";
import Reports from "../src/admin/views/Team/Reports";
import { FaceMenu, NewItemModal } from "../src/admin/views/Team/Work";
import { readItems, readMembers, resetStore } from "../src/admin/views/Team/store";

const at = (url: string) => renderToStaticMarkup(
  <MemoryRouter initialEntries={[url]}>
    <ShellProvider>
      <Routes>
        <Route path="/work" element={<Work />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/reports" element={<Reports />} />
      </Routes>
    </ShellProvider>
  </MemoryRouter>,
);

const node = (n: React.ReactNode) => renderToStaticMarkup(
  <MemoryRouter initialEntries={["/work"]}><ShellProvider>{n}</ShellProvider></MemoryRouter>,
);

let failed = 0;
const ok = (what: string, cond: boolean) => {
  if (cond) { console.log("  ok   " + what); return; }
  failed++;
  console.log("  FAIL " + what);
};
const renders = (what: string, url: string, mustHave: string[]) => {
  let html = "";
  try { html = at(url); } catch (e) {
    failed++;
    console.log("  FAIL " + what + " THREW\n         " + (e as Error).message);
    return;
  }
  const missing = mustHave.filter((m) => html.indexOf(m) < 0);
  if (missing.length) {
    failed++;
    console.log("  FAIL " + what + "\n         rendered " + html.length
      + " chars but without: " + missing.join(", "));
    return;
  }
  console.log("  ok   " + what + " (" + html.length + " chars)");
};

console.log("\nTeam renders\n");
resetStore();

/* THE FOUR FACES. Each one names a class only it draws, so a face that renders
   an empty shell instead of itself is a failure here rather than a surprise in
   the browser. */
renders("the calendar face draws its rail and its month grid", "/work",
  ["tm-shell", "tm-rail", "tm-cal", "tm-day", "tm-calbar"]);
renders("the board draws five columns", "/work?face=board",
  ["tm-boardwrap", "tm-board", "tm-col"]);
renders("the list draws a table", "/work?face=list", ["tbl", "dls-body"]);
renders("the timeline draws lanes", "/work?face=timeline", ["tm-tl", "tm-tl-lane"]);

/* The three faces that are lists keep the filter row; the calendar does not. */
const cal = at("/work");
ok("the calendar has no filter band", cal.indexOf("dls-cmd") < 0);
["board", "list", "timeline"].forEach((f) => {
  ok("the " + f + " keeps its filter band", at("/work?face=" + f).indexOf("dls-cmd") >= 0);
});

renders("attendance", "/attendance", ["dls", "tm-clock"]);
renders("reports", "/reports", ["dls", "dls-cmd"]);

/* THE SWITCHER HAS TO OFFER ALL FOUR. It is the only way to reach three of
   them now that the face buttons left the filter row, so a menu that lists one
   is a module with one face. */
const menu = node(<FaceMenu face="calendar" goto={() => {}} />);
["Calendar", "Board", "List", "Timeline"].forEach((l) =>
  ok("the switcher offers " + l, menu.indexOf(">" + l + "<") >= 0));
ok("…and marks the one you are in", menu.indexOf("mi on") >= 0);

/* The dialog every one of those faces opens. */
try {
  const html = node(<NewItemModal kind="task" members={readMembers()} all={readItems()} />);
  ok("the create dialog renders its fields", html.indexOf('class="fg"') >= 0);
  ok("…with a bordered control, not a bare label", html.indexOf('class="inp"') >= 0);
} catch (e) {
  failed++;
  console.log("  FAIL the create dialog THREW\n         " + (e as Error).message);
}

console.log("\n" + (failed ? failed + " FAILED" : "all checks passed") + "\n");
process.exit(failed ? 1 : 0);
