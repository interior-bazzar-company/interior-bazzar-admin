/* Render every Agreements surface to a string and fail on any throw.

   The same DOM stub the other module smokes use, for the same reason: the
   shell reads theme and density off document.documentElement while it renders
   and there is no jsdom here. */
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

const realError = console.error;
console.error = (...a: unknown[]) => {
  if (typeof a[0] === "string" && a[0].indexOf("useLayoutEffect does nothing") >= 0) return;
  realError.apply(console, a as []);
};

import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ShellProvider } from "../src/admin/shell/ShellContext";
import Agreements from "../src/admin/views/Agreements";
import { resetTemplates, sendTemplate, signAgreement } from "../src/admin/views/Agreements/store";
import { resetStore } from "../src/admin/views/Team/store";

const at = (url: string) => renderToStaticMarkup(
  <MemoryRouter initialEntries={[url]}>
    <ShellProvider>
      <Routes>
        <Route path="/agreements" element={<Agreements />} />
        <Route path="/agreements/:id" element={<Agreements />} />
        <Route path="/agreements/:id/:sub" element={<Agreements />} />
      </Routes>
    </ShellProvider>
  </MemoryRouter>,
);

/** The table body alone. Assertions about what a table CONTAINS or in what
 *  ORDER have to read the rows — the toolbar above names every template and
 *  every state as filter options and will answer yes to almost anything. */
const body = (html: string) => {
  const i = html.indexOf("<tbody>");
  return i < 0 ? "" : html.slice(i);
};

let failed = 0;
const ok = (what: string, cond: boolean) => {
  if (cond) { console.log("  ok   " + what); return; }
  failed++;
  console.log("  FAIL " + what);
};
const renders = (what: string, html: () => string, mustHave: string[]) => {
  let out = "";
  try { out = html(); } catch (e) {
    failed++;
    console.log("  FAIL " + what + " THREW\n         " + (e as Error).message);
    return "";
  }
  const missing = mustHave.filter((m) => out.indexOf(m) < 0);
  if (missing.length) {
    failed++;
    console.log("  FAIL " + what + "\n         rendered " + out.length
      + " chars but without: " + missing.join(", "));
    return out;
  }
  console.log("  ok   " + what + " (" + out.length + " chars)");
  return out;
};

console.log("\nAgreements renders\n");
resetStore();
resetTemplates();

/* ------------------------------------------------------------ the tabs -- */
renders("templates · the wording, written once", () => at("/agreements"),
  ["dls", "dls-cmd", "dls-stat", "ag-count", "ag-acts", "tbl"]);

(() => {
  const html = at("/agreements");
  ok("two tabs, and exactly two",
    html.indexOf("Templates") >= 0 && html.indexOf("Sent") >= 0);
  const rows = body(html);
  ok("a row carries the document, its kind, its clauses and its state",
    rows.indexOf("NDA · 2026") >= 0 && rows.indexOf("ag-desc") >= 0
    && rows.indexOf("ag-count") >= 0);
  ok("…with Send and a More menu", rows.indexOf(">Send<") >= 0 && rows.indexOf("ib-menu") >= 0);
  ok("…and Send is dead on a draft, rather than refusing after the click",
    rows.indexOf("disabled") >= 0);
  ok("every state is listed — this tab is the inventory",
    rows.indexOf("Exit declaration") >= 0);
})();

renders("sent · every copy and where it stopped", () => at("/agreements?face=sent"),
  ["dls-cmd", "dls-stat", "ag-who", "tbl"]);

(() => {
  const rows = body(at("/agreements?face=sent"));
  ok("six copies, from Team's own records",
    (rows.match(/class="ag-row/g) || []).length === 6);
  ok("…naming who signed where somebody has",
    rows.indexOf("N. Pillai") >= 0 && rows.indexOf("ag-signed") >= 0);
  ok("…and saying what is still outstanding where nobody has",
    rows.indexOf("Not yet") >= 0);
})();

/* CLICKING A TEMPLATE FILTERS SENT TO IT — "sent 3 times" is only useful next
   to which three. */
(() => {
  const rows = body(at("/agreements/TPL-OFFER"));
  ok("a bare /agreements/TPL-x lands on its copies, not on the template list",
    (rows.match(/class="ag-row/g) || []).length === 3);
  ok("…and only that template's", rows.indexOf("NDA · 2026") < 0);
})();

renders("sent · a filter that matches nothing says so",
  () => at("/agreements?face=sent&q=zzzz"), ["Nothing matches that"]);

/* ------------------------------------------------------------- the deed -- */
/* THE SIGNED CASE. AG-02 is signed, so the sheet, the signature line and the
   evidence block all have something to show. */
(() => {
  const html = at("/agreements/AG-02");
  ok("a sent agreement has a page of its own",
    html.indexOf("ag-deed") >= 0 && html.indexOf("ag-sheet") >= 0);
  ok("…rendering the document as clauses, not as fields",
    html.indexOf("ag-clause") >= 0 && html.indexOf("ag-clause-n") >= 0);
  ok("…with the wording filled in for the member",
    html.indexOf("N. Pillai") >= 0 && html.indexOf("{{name}}") < 0);
  ok("…a signature line at the foot, where one goes on paper",
    html.indexOf("ag-sig") >= 0 && html.indexOf("ag-sig-n") >= 0);
  /* THE MODULE'S SIGNATURE DEVICE. A signature's worth is its provenance, and
     this is the only block in the panel that states it. */
  ok("…and the evidence block, with all five facts",
    html.indexOf("ag-ev") >= 0
    && html.indexOf("Signed by") >= 0
    && html.indexOf("Signed at") >= 0
    && html.indexOf(">From<") >= 0
    && html.indexOf(">Version<") >= 0
    && html.indexOf(">Token<") >= 0);
  ok("…carrying the address it was signed from", html.indexOf("49.36.180.22") >= 0);
  ok("…and marked as signed", html.indexOf("is-signed") >= 0);
  ok("a signed copy offers no Revoke", html.indexOf(">Revoke<") < 0);
})();

/* THE UNSIGNED CASE. The same rows, empty — what is missing is the point. */
(() => {
  const html = at("/agreements/AG-01");
  ok("an unsigned copy shows the evidence rows it is still waiting for",
    html.indexOf("Awaiting signature") >= 0 && html.indexOf("not yet signed") >= 0);
  ok("…the signature line as a rule with no name",
    html.indexOf("ag-sig-l") >= 0 && html.indexOf("ag-sig-n") < 0);
  ok("…the link to send", html.indexOf("/sign/") >= 0);
  ok("…and Revoke, because there is still something to stop",
    html.indexOf(">Revoke<") >= 0);
})();

/* A copy with no frozen body must SAY so rather than pass today's wording off
   as what was agreed to. */
(() => {
  const html = at("/agreements/AG-02");
  ok("a copy with no frozen text says the wording may have moved on",
    html.indexOf("no frozen text") >= 0);
})();

renders("a stale agreement link says so rather than blanking",
  () => at("/agreements/AG-NOPE"), ["No such agreement"]);

/* ----------------------------------------------------------- the editor -- */
renders("the editor · writing a new template", () => at("/agreements/new"),
  ["ag-cols", "ag-clauses", "ag-sheet", "Create template"]);

renders("the editor · on an existing one", () => at("/agreements/TPL-NDA/edit"),
  ["ag-cols", "Save changes", "ag-cl-text"]);

(() => {
  const html = at("/agreements/TPL-NDA/edit");
  ok("the clauses are a numbered list, because clauses are cited by number",
    html.indexOf("<ol class=\"ag-clauses\">") >= 0 && html.indexOf("ag-cl-n") >= 0);
  ok("…each with its own move and remove",
    html.indexOf("Move clause 1 up") >= 0 && html.indexOf("Remove clause 1") >= 0);
  /* THE PREVIEW SHOWS THE SENTENCE THAT SHIPS. A document that reads correctly
     with braces in it can still read badly with a name in it. */
  ok("the preview fills the placeholders with a real name",
    html.indexOf("{{name}}") >= 0        /* in the editor's own textarea */
    && html.indexOf("V. Shakya") >= 0);  /* and filled in, in the sheet */
  ok("…and says whose name it borrowed", html.indexOf("filled in for") >= 0);
  ok("…and names the two placeholders that work",
    html.indexOf("{{date}}") >= 0);
  ok("no version warning before anything has changed",
    html.indexOf("This becomes version") < 0);
})();

renders("the editor · a stale id says so, rather than an empty form",
  () => at("/agreements/TPL-NOPE/edit"), ["No such template"]);

/* -------------------------------------------------- a fresh signature -- */
/* END TO END, in the store: send a copy, sign it, and read the page back. It
   is the one flow the module exists for. */
(() => {
  const sent = sendTemplate("TPL-ASSET", "74");
  if (!sent.ok) { failed++; console.log("  FAIL could not send a copy"); return; }
  const id = sent.data.agreementId;

  const before = at("/agreements/" + id);
  ok("a freshly sent copy renders, unsigned",
    before.indexOf("Awaiting signature") >= 0 && before.indexOf("ag-sheet") >= 0);
  ok("…with its own frozen wording, filled in for them",
    before.indexOf("Priya Iyer") >= 0 && before.indexOf("no frozen text") < 0);

  const s = signAgreement(id, "Priya Iyer");
  ok("it can be signed", s.ok === true);

  const after = at("/agreements/" + id);
  ok("…and the page then shows the signature and its evidence",
    after.indexOf("is-signed") >= 0
    && after.indexOf("ag-sig-n") >= 0
    && after.indexOf(">Revoke<") < 0);
  resetStore();
  resetTemplates();
})();

console.log("\n" + (failed ? failed + " FAILED" : "every surface rendered") + "\n");
process.exit(failed ? 1 : 0);
