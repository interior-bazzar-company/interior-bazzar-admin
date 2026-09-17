/* =============================================================================
   Finance · the render smoke.   `npm run check:finance-render`
   -----------------------------------------------------------------------------
   Every face of the module, rendered to a string, failing on any throw.

   WHAT THIS USED TO BE, AND WHY IT IS SMALLER. The suite rendered each screen
   and then asserted its copy, its classes and its records — all of it fed by
   the bundled Finance seed (`SUB-0101`, `SLIP-2026-07-0011`, `SAL-AC-0011`) that
   the store read at import, and by src/content/finance/*.json files that no
   longer exist. The module reads the backend now: `renderToStaticMarkup` runs
   no effects, so nothing fetches, and every one of those assertions was reading
   an empty store or a deleted file. They are a browser test now, not a node one.

   What is left is the half that still means something without data, and it is
   the half that catches the regressions this migration actually causes: the
   module imports cleanly, and every route, tab and parameter — including a
   record id nothing answers to — renders its loading or empty state instead of
   throwing.

   A DOM stub, not a DOM — the shell reads theme and density off
   `document.documentElement` while it renders and there is no jsdom in this
   repo. The assertion is that the MODULE renders, not that the shell's
   appearance plumbing works headless. */
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
  /* react-aria's focus-visible setup sees a `window` and reads
     HTMLElement.prototype.focus; the class only has to exist. */
  HTMLElement: class { focus() {} }, Element: class {}, Node: class {},
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
import Finance from "../src/admin/views/Finance";

const at = (url: string) => renderToStaticMarkup(
  <MemoryRouter initialEntries={[url]}>
    <ShellProvider>
      <Routes>
        {/* Five sidebar rows, one component. Each section is its own route
            so a grant can be held on one without the others. */}
        <Route path="/finance" element={<Finance />} />
        <Route path="/finance/:id" element={<Finance />} />
        <Route path="/finance-salaries" element={<Finance />} />
        <Route path="/finance-salaries/:id" element={<Finance />} />
        <Route path="/finance-transactions" element={<Finance />} />
        <Route path="/finance-transactions/:id" element={<Finance />} />
        <Route path="/finance-refunds" element={<Finance />} />
        <Route path="/finance-refunds/:id" element={<Finance />} />
        <Route path="/finance-analytics" element={<Finance />} />
      </Routes>
    </ShellProvider>
  </MemoryRouter>
);

const URLS: [string, string][] = [
  ["subscriptions · the default face", "/finance"],
  ["subscriptions · the analytics tab", "/finance?tab=analytics"],
  ["subscriptions · a named year", "/finance?tab=analytics&year=2026"],
  ["subscriptions · a year nothing happened in", "/finance?tab=analytics&year=1999"],
  ["subscriptions · filtered to the defaulting ones", "/finance?status=defaulting"],
  ["subscriptions · filtered to the ones that settled something", "/finance?flag=settled"],
  ["subscriptions · started in a year", "/finance?started=2026"],
  ["subscriptions · started in a month", "/finance?started=2026-08"],
  ["subscriptions · started on one day", "/finance?started=2026-08-21"],
  ["subscriptions · a filter that matches nothing", "/finance?q=zzzznothing"],
  ["salaries · the bare route", "/finance-salaries"],
  ["salaries · the accounts tab", "/finance-salaries?tab=accounts"],
  ["salaries · accounts, a filter that matches nothing", "/finance-salaries?tab=accounts&q=zzzznothing"],
  ["salaries · the transactions tab", "/finance-salaries?tab=transactions"],
  ["salaries · transactions, paid only", "/finance-salaries?tab=transactions&status=paid"],
  ["salaries · the analytics tab", "/finance-salaries?tab=analytics"],
  ["salaries · analytics grouped by department", "/finance-salaries?tab=analytics&by=department"],
  ["salaries · analytics grouped by member", "/finance-salaries?tab=analytics&by=member"],
  ["salaries · analytics with a nonsense grouping", "/finance-salaries?tab=analytics&by=zzz"],
  ["salaries · analytics, the year before", "/finance-salaries?tab=analytics&fy=2025"],
  ["salaries · analytics with a nonsense year", "/finance-salaries?tab=analytics&fy=zzz"],
  ["transactions · the ledger", "/finance-transactions"],
  ["transactions · the tags that file them", "/finance-transactions?tab=tags"],
  ["refunds · the book", "/finance-refunds"],
  ["analytics · the overview", "/finance-analytics"],
  ["analytics · the KPI tab", "/finance-analytics?tab=kpi"],
  ["a subscription record", "/finance/SUB-0101"],
  ["...its receipt", "/finance/SUB-0101?tab=receipt"],
  ["...its history", "/finance/SUB-0101?tab=history"],
  ["a salary account record", "/finance-salaries/SAL-AC-0011"],
  ["a payslip record", "/finance-salaries/SLIP-2026-07-0011"],
  ["an address that does not exist", "/finance/XXX-0000"],
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
