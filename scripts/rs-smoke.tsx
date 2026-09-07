/* Render every Resources surface to a string and fail on any throw.

   The gap this closes is the one Team's smoke test closed: a face can stop
   rendering entirely while tsc, eslint and check-resources all stay green,
   because none of them ever calls the component. This does.

   The DOM stub is the same one Team, Users and Finance use, for the same
   reason — the shell reads theme and density off document.documentElement
   while it renders, and there is no jsdom in this repo. */
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

const realError = console.error;
console.error = (...a: unknown[]) => {
  if (typeof a[0] === "string" && a[0].indexOf("useLayoutEffect does nothing") >= 0) return;
  realError.apply(console, a as []);
};

import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ShellProvider } from "../src/admin/shell/ShellContext";
import Resources, { ResponseSheet, FormPreview } from "../src/admin/views/Resources";
import MemberResourcesPage from "../src/admin/views/Team/member/ResourcesPage";
import {
  createResource, resetStore, resourceOf, responseOf,
} from "../src/admin/views/Resources/store";
import { readMember } from "../src/admin/views/Team/store";

const at = (url: string) => renderToStaticMarkup(
  <MemoryRouter initialEntries={[url]}>
    <ShellProvider>
      <Routes>
        <Route path="/resources" element={<Resources />} />
        <Route path="/resources/:id" element={<Resources />} />
        <Route path="/resources/:id/:sub" element={<Resources />} />
      </Routes>
    </ShellProvider>
  </MemoryRouter>,
);

/** The table body alone. Assertions about what a table CONTAINS or in what
 *  ORDER have to read the rows; the toolbar above it names every resource and
 *  every state as filter options, and will answer yes to almost anything. */
const body = (html: string) => {
  const i = html.indexOf("<tbody>");
  return i < 0 ? "" : html.slice(i);
};

const node = (n: React.ReactNode, url = "/resources") => renderToStaticMarkup(
  <MemoryRouter initialEntries={[url]}><ShellProvider>{n}</ShellProvider></MemoryRouter>,
);

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

console.log("\nResources renders\n");
resetStore();

/* ---------------------------------------------------------- the faces -- */
/* Each names something only it draws, so a face that renders an empty shell
   instead of itself fails here rather than in a browser. */
/* ------------------------------------------------------------ the tabs -- */
/* THREE FIXED TABS. The strip carried one per form once; the regression to
   catch is any version of that coming back, because chrome that grows with the
   data reads as a feature rather than as a fault. */
(() => {
  const html = at("/resources");
  ok("two tabs, and Member data is not one of them",
    html.indexOf("Data Forms") >= 0 && html.indexOf("Responses") >= 0
    && html.indexOf("Member data") < 0);
  ok("…none of them a form's title",
    ["IT asset handover", "Leave policy 2026", "Exit checklist"]
      .every((t) => html.split("</button>")[0].indexOf(t) < 0));
  ok("…and Create resource on the page",
    html.indexOf("rs-new") >= 0 && html.indexOf("Create resource") >= 0);
  /* ONCE. It was in the tab strip AND in each face's actions band, so every
     tab drew it twice — the kind of duplicate that only shows up on screen,
     because both halves were individually correct. */
  ok("…exactly once", html.split("Create resource").length === 2);
})();

(() => {
  ok("…and once on the responses tab too",
    at("/resources?face=responses").split("Create resource").length === 2);
})();

/* THE SHARED COMMAND ROW, not a layout of this module's own. It was a bespoke
   grid for one revision, which aligned to itself and to nothing else in the
   panel — the regression to catch is this module inventing its own header
   again, because that looks tidy in the markup and like a different product on
   screen. */
(() => {
  const html = at("/resources");
  ok("the header is the panel's shared command row",
    html.indexOf('class="dls-cmd"') >= 0
    && html.indexOf("rs-actions") < 0
    && html.indexOf("rs-filterbar") < 0
    && html.indexOf('class="rs-head"') < 0);
  ok("…carrying the search, every filter, then the action past a spacer",
    (() => {
      const head = html.slice(html.indexOf('class="dls-cmd"'));
      const upto = head.slice(0, head.indexOf("dls-stat"));
      return upto.indexOf("Search title") >= 0
        && upto.indexOf("State") >= 0 && upto.indexOf("Tag") >= 0
        && upto.indexOf("Goes to") >= 0
        && upto.indexOf("spacer") >= 0
        /* The action comes AFTER the spacer, which is what pushes it right. */
        && upto.indexOf("spacer") < upto.indexOf("Create resource");
    })());
})();

/* ------------------------------------------------------- 1 · resources -- */
renders("resources · every form and what it holds", () => at("/resources"),
  ["dls", "dls-cmd", "dls-stat", "rs-count", "rs-acts", "tbl"]);

(() => {
  const rows = body(at("/resources"));
  ok("a row carries the fields it was asked for",
    rows.indexOf("rs-count") >= 0        /* responses */
    && rows.indexOf("Sales onboarding pack") >= 0  /* title */
    && rows.indexOf("rs-tagm") >= 0      /* tags */
    && rows.indexOf("rs-desc") >= 0);    /* description */
  ok("…a Link button and a More menu",
    rows.indexOf(">Link<") >= 0 && rows.indexOf("ib-menu") >= 0);
  ok("…and not the old Copy link wording", rows.indexOf("Copy link") < 0);
  ok("…and it counts what came in against what was asked",
    rows.indexOf("of 3") >= 0);
  /* EVERY form, whatever its state — this tab is the inventory, so a draft and
     an outdated one both belong on it. */
  ok("every state is listed, not only the open ones",
    rows.indexOf("Exit checklist") >= 0);
})();

/* Copy link is dead on a form nobody owes, rather than handing over a link that
   resolves to a finished form. */
(() => {
  const rows = body(at("/resources"));
  ok("Copy link is disabled where nobody is waiting",
    rows.indexOf("disabled") >= 0);
})();

/* ------------------------------------------------------- 2 · responses -- */
renders("responses · every submission in one table", () => at("/resources?face=responses"),
  ["dls-cmd", "dls-stat", "rs-who", "tbl", "held in files"]);

(() => {
  const rows = body(at("/resources?face=responses"));
  ok("nine submissions, and nothing that has not happened",
    (rows.match(/class="rs-row/g) || []).length === 9);
  ok("…each naming its member, its form and its version",
    rows.indexOf("rs-who") >= 0 && rows.indexOf("Sales onboarding pack") >= 0
    && rows.indexOf("v1") >= 0);
  ok("…with the size that justifies deleting it",
    rows.indexOf("MB") >= 0 || rows.indexOf("KB") >= 0);
  ok("…and its files, openable", rows.indexOf("rs-file-chip") >= 0);
})();

/* CLICKING A RESOURCE FILTERS RESPONSES TO IT — the question after "1 of 3" is
   *which one*, and that is this tab with the filter already set. */
(() => {
  const rows = body(at("/resources?face=responses&res=RES-01"));
  ok("responses filters to one resource",
    (rows.match(/class="rs-row/g) || []).length === 1);
  ok("…and says which one it is filtered to",
    at("/resources?face=responses&res=RES-01").indexOf("Sales onboarding pack") >= 0);
})();

renders("responses · filtered to the ones holding a file",
  () => at("/resources?face=responses&files=1"), ["tbl", "rs-file-chip"]);

renders("responses · a filter that matches nothing says so",
  () => at("/resources?face=responses&q=zzzz"), ["Nothing matches that"]);

/* ----------------------------------------------------------- the link -- */
/* A pending row's whole point is that you can do something about it, and the
   only thing this panel can do is hand you the link to send. */

(() => {
  const html = at("/resources?form=RES-01");
  ok("a form's face offers every outstanding link in one place",
    html.indexOf("rs-links") >= 0);
  ok("…each one a different link, because it names the member",
    html.indexOf("/r/rres01m") >= 0);
  ok("…and says plainly that the page it opens is not built yet",
    html.indexOf("not built yet") >= 0);
  ok("…and the header says what the form asks somebody to upload",
    html.indexOf("Asks for:") >= 0 && html.indexOf("pdf or image") >= 0);
})();

/* A draft has nothing to submit to, so it must not offer a link at all. */
(() => {
  const html = at("/resources?form=RES-04");
  ok("a draft offers no link to send",
    html.indexOf("rs-links") < 0 && html.indexOf("rs-share") < 0);
})();

/* ---------------------------------------------------------- the files -- */
(() => {
  const html = at("/resources?form=RES-01");
  ok("an uploaded file is drawn as a file, not as its name in text",
    html.indexOf("rs-file-chip") >= 0);
  ok("…naming it, sizing it, and opening it",
    html.indexOf("offer-letter-signed.pdf") >= 0
    && html.indexOf("412 KB") >= 0
    && html.indexOf("/media/resources/offer-letter-signed.pdf") >= 0);
  ok("…without handing this panel's URL to whatever serves it",
    html.indexOf('rel="noreferrer"') >= 0);
  ok("…and a megabyte reads as a megabyte", html.indexOf("1.6 MB") >= 0);
})();

/* ------------------------------------------------ a submission, as a page -- */
/* IT IS A PLACE, not a layer over a list: its own address, its own crumb, and
   room for the answers to be read rather than skimmed. */
(() => {
  const html = at("/resources/RSP-01");
  ok("a submission has a page of its own",
    html.indexOf("rs-resp") >= 0 && html.indexOf("rs-bh") >= 0);
  ok("…naming the member, the form and the version",
    html.indexOf("Rahul Menon") >= 0 && html.indexOf("Sales onboarding pack") >= 0
    && html.indexOf("v1") >= 0);
  ok("…with the files apart from the typed answers",
    html.indexOf("rs-filelist") >= 0 && html.indexOf("rs-filerow") >= 0
    && html.indexOf("rs-answer") >= 0);
  ok("…each file named by the question it answers",
    html.indexOf("Signed offer letter") >= 0 && html.indexOf("rs-file-chip") >= 0);
  /* THE ONE WRITE. Edit is absent rather than disabled. */
  ok("…offering Delete and nothing else that writes",
    html.indexOf(">Delete<") >= 0 && html.indexOf(">Edit<") < 0);
  ok("…and saying what deleting would mean",
    html.indexOf("cannot be edited") >= 0 && html.indexOf("back to") >= 0);
})();

renders("a stale submission link says so rather than blanking",
  () => at("/resources/RSP-NOPE"), ["No such submission"]);

/* ---------------------------------------------------------- the builder -- */
renders("the builder · creating", () => at("/resources/new"),
  ["rs-cols", "rs-bh", "rs-spine", "Create resource"]);

renders("the builder · editing an answered resource",
  () => at("/resources/RES-01/edit"), ["rs-cols", "Save changes", "rs-spine", "rs-paper"]);

renders("the builder · a stale id says so, rather than rendering an empty form",
  () => at("/resources/RES-GONE/edit"), ["No such resource"]);

(() => {
  /* THE VERSION WARNING. Editing an answered resource has to say what it will
     cost before it costs it — the notice is drawn only once a field actually
     differs, so this asserts the resting state does NOT cry wolf. */
  const html = at("/resources/RES-01/edit");
  ok("…and it does not warn about a version bump before anything changed",
    html.indexOf("This will become version") < 0);
  ok("…while still naming the version it is on",
    html.indexOf("Version 1") >= 0);
})();

/* ------------------------------------------------------ the new builder -- */
/* THE SPINE is the page's one signature device, and it is load-bearing: order
   is the information it encodes. If it ever stops being a numbered sequence the
   page has lost the thing that makes the field list readable. */
(() => {
  const html = at("/resources/RES-01/edit");
  ok("the fields are a numbered spine, not a stack of cards",
    html.indexOf("rs-spine") >= 0 && html.indexOf("rs-field-n") >= 0);
  ok("…as an ordered list, so the order survives without CSS",
    html.indexOf("<ol class=\"rs-spine\">") >= 0);
  ok("…and every field is numbered for a screen reader too",
    html.indexOf("Move field 1 up") >= 0 && html.indexOf("Remove field 1") >= 0);
})();

/* THE FOUR DETAILS, in the order they are decided. */
(() => {
  const html = at("/resources/RES-01/edit");
  ok("Details carries title, description, tags and department",
    ["rs-title-in", "rs-desc", "rs-tagbox", "rs-dept"].every((c) => html.indexOf(c) >= 0));
  ok("…and the section is called Form, not 'What it asks'",
    html.indexOf(">Form<") >= 0 && html.indexOf("What it asks") < 0);
  ok("…with no audience editor anywhere",
    html.indexOf("Who it is for") < 0 && html.indexOf("rs-axis") < 0);
  ok("…and Purpose is called Description",
    html.indexOf(">Description<") >= 0 && html.indexOf(">Purpose<") < 0);
})();

/* TAGS ARE CHIPS AND FREE TEXT — the seeded ones render, and the suggestions
   offered are the ones not already taken. */
(() => {
  const html = at("/resources/RES-01/edit");
  ok("the resource's tags render as chips inside the box",
    html.indexOf("rs-tag") >= 0 && html.indexOf("Onboarding") >= 0);
  ok("…and a tag already taken is not offered again",
    html.indexOf("Remove Onboarding") >= 0
    && html.split("Onboarding").length === 3);  /* chip + its aria-label, no suggestion */
  ok("…while a tag nobody has used is", html.indexOf("Compliance") >= 0);
})();

/* THE DEPARTMENT IS CHIPS NOW, the same control tags use — a form can go to
   more than one, and it is not bound to the roster. */
(() => {
  const html = at("/resources/RES-01/edit");
  ok("the department is a chip field, not a single-value box",
    html.split("rs-tagbox").length === 3);  /* tags + departments */
  ok("…carrying the resource's own department as a chip",
    html.indexOf("Remove Sales") >= 0);
  ok("…offering the roster's departments as suggestions",
    html.indexOf("On the roster") >= 0 && html.indexOf("Operations") >= 0);
  ok("…and saying who it reaches, in people",
    html.indexOf("Only Sales") >= 0 && html.indexOf("3 people") >= 0);
})();

/* THE CHOICE OPTIONS are a list you can see, not a comma-separated string. */
(() => {
  const html = at("/resources/RES-01/edit");
  ok("a choice field lists its options as rows",
    html.indexOf("rs-opts-list") >= 0 && html.indexOf("rs-opt-v") >= 0);
  ok("…each removable and orderable by itself",
    html.indexOf("Remove option North") >= 0
    && html.indexOf("Move option West up") >= 0);
  ok("…with an add box rather than a comma-separated text field",
    html.indexOf("rs-opt-add") >= 0 && html.indexOf("Add another option") >= 0);
  ok("…and it counts them", html.indexOf("4 options") >= 0);
})();

/* EACH TYPE READS AS ITSELF — the field carries its type so the mark can be
   tinted, and the preview draws a long-text field long. */
(() => {
  const html = at("/resources/RES-01/edit");
  ok("a field says what type it is, for the per-type mark",
    html.indexOf('data-type="file"') >= 0 && html.indexOf('data-type="select"') >= 0);
  ok("…and the preview draws a textarea, not another single-line box",
    html.indexOf("<textarea") >= 0);
})();

/* EMPTY IS EVERYONE, and the page says so rather than leaving it to be inferred. */
(() => {
  const html = at("/resources/new");
  ok("a new resource goes to everyone until a department is named",
    html.indexOf("Everyone — 8 active members") >= 0);
  ok("…and the preview says how many that is",
    html.indexOf("Goes to 8 people") >= 0);
})();

/* THE UPLOAD RULES — what it takes, and how big. */
(() => {
  const html = at("/resources/RES-01/edit");
  ok("a file field offers what it will take",
    html.indexOf("rs-upload") >= 0 && html.indexOf("Takes") >= 0);
  ok("…and a max size in megabytes",
    html.indexOf("Max size") >= 0 && html.indexOf("rs-mb") >= 0
    && html.indexOf("rs-mb-u") >= 0);
  ok("…defaulting to the seeded cap, not to a blank box",
    html.indexOf('value="10"') >= 0);
  ok("…and the preview states both where the member will read them",
    html.indexOf("rs-file-a") >= 0
    && html.indexOf("PDF or image") >= 0
    && html.indexOf("up to 10 MB") >= 0);
})();


/* ---------------------------------------------------- a submission ---- */
(() => {
  const r = resourceOf("RES-02");
  const x = responseOf("RSP-03");
  if (!r || !x) { failed++; console.log("  FAIL the seed lost RES-02 / RSP-03"); return; }
  const html = renders("one submission, as a sheet", () => node(<ResponseSheet r={r} x={x} />),
    ["rs-sheet", "rs-answer", "Cannot be edited"]);
  /* THE DETAIL VIEW'S ONE WRITE. Edit is absent rather than disabled; delete is
     the space one and it says what it would free. */
  ok("…offering delete, and nothing else that writes",
    html.indexOf("Delete") >= 0 && html.indexOf("Edit") < 0);
  /* FROZEN, VISIBLY. RSP-03 answered v1, when the third field was called
     "Condition"; the sheet must print that and not today's label. */
  ok("…printing the label it was answered under, not today's",
    html.indexOf("Condition") >= 0 && html.indexOf("Condition at handover") < 0);
  ok("…and saying which version that was", html.indexOf("version 1") >= 0);
})();

/* ----------------------------------------------------- the preview ---- */
renders("the preview of an empty form invites the first field",
  () => node(<FormPreview r={{ title: "", purpose: "", fields: [] }} />),
  ["No fields yet"]);

(() => {
  const r = resourceOf("RES-01");
  if (!r) { failed++; console.log("  FAIL the seed lost RES-01"); return; }
  const html = renders("the preview draws every field type",
    () => node(<FormPreview r={r} />), ["rs-preview", "rs-file", "rs-check", "select"]);
  /* A preview you can type into is a second place the same answer could be
     entered. Every control in it is disabled, and this is the assertion. */
  const inputs = (html.match(/<(input|select|textarea)/g) || []).length;
  const disabled = (html.match(/disabled=""/g) || []).length;
  ok("…and every control in it is disabled (" + disabled + " of " + inputs + ")",
    inputs > 0 && disabled === inputs);
})();

/* ------------------------------------------------- the member's page -- */
(() => {
  const answered = readMember("70");
  const untouched = readMember("79");
  if (!answered || !untouched) { failed++; console.log("  FAIL the roster lost 70 / 79"); return; }

  renders("a member who has answered sees their own answers",
    () => node(<MemberResourcesPage m={answered} />, "/team/70/resources"),
    ["tm-oph", "rs-mine", "rs-answer", "Rahul Menon"]);

  const html = renders("a member with something outstanding is told so",
    () => node(<MemberResourcesPage m={untouched} />, "/team/79/resources"),
    ["tm-oph", "rs-mine"]);
  ok("…and the outstanding notice names the form",
    html.indexOf("outstanding") >= 0);
})();

/* ------------------------------------------------- created is visible -- */
/* THE WHOLE REASON `createResource` LANDS OPEN. A new resource has to appear on
   the one table this module has, or creating one looks like it did nothing. */
(() => {
  const made = createResource({
    title: "Vendor declaration", description: "", tags: ["Compliance"], departments: [],
    fields: [{
      fieldId: "F1", type: "file", label: "Signed declaration", help: null,
      required: true, options: [], accept: ["pdf"], maxMb: 10,
    }],
  });
  ok("a newly created resource is open", made.ok && made.value.state === "open");
  ok("…and it is listed on the resources tab immediately",
    body(at("/resources")).indexOf("Vendor declaration") >= 0);
  ok("…with its audience waiting on its own face",
    made.ok && at("/resources?form=" + made.value.resourceId).indexOf("rs-share") >= 0);
  resetStore();
})();

console.log("\n" + (failed ? failed + " FAILED" : "every surface rendered") + "\n");
process.exit(failed ? 1 : 0);
