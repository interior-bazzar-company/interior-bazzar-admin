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

/* MemoryRouter calls useLayoutEffect and React says so on every single render.
   It is true, it is harmless here, and repeated 40 times it buries the results
   this script exists to print. */
const realError = console.error;
console.error = (...a: unknown[]) => {
  if (typeof a[0] === "string" && a[0].indexOf("useLayoutEffect does nothing") >= 0) return;
  realError.apply(console, a as []);
};

import { readdirSync, readFileSync } from "fs";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ShellProvider } from "../src/admin/shell/ShellContext";
import Work from "../src/admin/views/Team/Work";
import Attendance from "../src/admin/views/Team/Attendance";
import Reports from "../src/admin/views/Team/Reports";
import { FaceMenu, FaceSwitch, NewItemModal } from "../src/admin/views/Team/Work";
import { TasksBlock } from "../src/admin/views/Team/workBits";
import { ItemDrawer } from "../src/admin/views/Team/Detail";
import MemberPage from "../src/admin/views/Team/MemberPage";
import { MEMBER_OPS, opsFor } from "../src/admin/views/Team/member/ops";
import {
  AddDocumentModal, LeaveDecideModal, LeaveRequestModal, NewTagModal, SendAgreementModal,
  SignAgreementModal,
} from "../src/admin/views/Team/member/modals";
import { EodModal, PlanModal } from "../src/admin/views/Team/member/reportForms";
import {
  TODAY, agreementsFor, isDelayed, isTerminal, leaveFor, meId, readItems, readMember,
  readMembers, resetStore,
} from "../src/admin/views/Team/store";
import type { Ops, Role } from "../src/admin/views/teamShared";

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

const node = (n: React.ReactNode, url = "/work") => renderToStaticMarkup(
  <MemoryRouter initialEntries={[url]}><ShellProvider>{n}</ShellProvider></MemoryRouter>,
);

/* The member page is rendered BY Team/index.tsx, which fetches first — so a
   route render only ever shows its skeleton. It is called directly with the
   props the roster hands it, which is also how the viewer gets pinned. */
const OPS: Ops = {
  done: () => {}, toast: () => {}, modal: () => {}, closeLayer: () => {},
  go: () => {}, refresh: () => {},
};
const member = (id: string, sub: string) =>
  node(<MemberPage id={id} sub={sub} live={null} roles={[] as Role[]} ops={OPS} />,
    "/team/" + id + (sub ? "/" + sub : ""));

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
  const missing = mustHave.filter((mm) => out.indexOf(mm) < 0);
  if (missing.length) {
    failed++;
    console.log("  FAIL " + what + "\n         rendered " + out.length
      + " chars but without: " + missing.join(", "));
    return out;
  }
  console.log("  ok   " + what + " (" + out.length + " chars)");
  return out;
};

console.log("\nTeam renders\n");
resetStore();

/* ------------------------------------------------------------- the faces -- */
/* Each names a class only it draws, so a face that renders an empty shell
   instead of itself is a failure here rather than a surprise in the browser. */
/* THREE FACES NOW — Tasks, Timeline, Analysis — and the three ways of looking
   at the set (list, board, calendar) moved inside the first as a view
   switcher. They were never three questions; they were three answers to one. */
renders("the calendar view draws its rail and its month grid", () => at("/work?view=calendar"),
  ["tm-shell", "tm-rail", "tm-cal", "tm-day", "tm-calbar"]);
renders("the board draws five columns", () => at("/work?view=board"),
  ["tm-boardwrap", "tm-board", "tm-col"]);
/* CALENDAR IS THE DEFAULT NOW, so `#/work` bare opens the month and the list
   has a URL of its own. Both halves are asserted: a bare URL must resolve to
   the calendar, and `?view=list` must still reach the table — the pair that
   drifts if the default is written down in two places. */
renders("the calendar is the default view", () => at("/work"), ["tm-cal", "dls-body"]);
renders("…and the list has a URL of its own", () => at("/work?view=list"), ["tbl", "tm-list"]);
ok("…and the switcher marks Calendar as the one you are in",
  node(<FaceMenu face="tasks" view="calendar" goto={() => {}} />)
    .indexOf('class="mi on"') >= 0);

/* PROGRESS SITS BESIDE THE THING IT IS ABOUT. It was last in the row — the far
   end of a 920px scan from the title — in a 120px column, which leaves the bar
   about 50px to draw a fill AND the today marker in. Member went the other way:
   it is who to ask, not what to scan, and it was standing between the title and
   every fact about the work. */
ok("the list is scoped so `.tbl` is left alone", at("/work?view=list").indexOf("tm-list") >= 0);
/* SHARES, NOT PIXELS. Item was the only column without a width, so it collected
   the whole surplus and stranded the rest against the right edge; capping the
   table moved that surplus into a blank slab beside it. Percentages spread it
   across all six. */
ok("…and every column but the rail is a share of the width", (() => {
  const w = (at("/work?view=list").match(/<th[^>]*style="width:[^"]*"/g) || [])
    .map((t) => t.slice(t.lastIndexOf(":") + 1).replace(/[";]/g, "").trim());
  return w.length === 7 && w[0] === "3px" && w.slice(1).every((x) => x.slice(-1) === "%");
})());

/* Today's plan writes through `submitPlan`, which the derivation suite already
   proves links a matching open task instead of minting a second copy — the
   thing that makes the EOD able to tick it and the board agree. What is checked
   here is that the way in exists on this screen at all. */
/* The calendar hides the filter toolbar the note's button lives on, and the
   calendar is the landing screen now — so the rail has to carry it or the one
   control you reach before the day starts is stranded behind a view switch. */
ok("the day can be planned from the calendar too", (() => {
  const cal = at("/work");
  const rail = cal.slice(cal.indexOf("tm-rail-t"), cal.indexOf("tm-rail-b"));
  return rail.indexOf('aria-haspopup="dialog"') >= 0;
})());

ok("the day can be planned from the board", (() => {
  /* The toolbar the note lives on is hidden on the calendar, which is now the
     default — so this asks the view that has one. */
  const html = at("/work?view=list");
  /* The note, not merely the word "Today" — which the Due column says on
     every task due now. */
  return html.indexOf('aria-haspopup="dialog"') >= 0
    /* 8217 is the curly apostrophe the button is labelled with; React emits the
       character, not the entity. */
    && html.indexOf("Today" + String.fromCharCode(8217) + "s plan") >= 0;
})());
ok("…and progress reads as a number over its bar", at("/work?view=list").indexOf("tml-prog") >= 0);
/* Most rows are Normal; a filled chip on each of them is a column of identical
   badges that the two priorities which SHOULD stop a reader cannot out-shout. */
ok("…and Normal priority is a word, not a badge", at("/work?view=list").indexOf("tml-pri-q") >= 0);
/* The status is changed where it is read. It was a read-only pill, so moving a
   task meant opening the panel to reach its footer. */
ok("…and the stage cell is the status control", at("/work?view=list").indexOf("tm-st-b") >= 0);

ok("the list reads title-first, then how far along it is", (() => {
  const heads = at("/work?view=list").split("<th").slice(1).map((h) => h.slice(h.indexOf(">") + 1))
    .map((h) => h.slice(0, h.indexOf("<")).trim()).filter((h) => h);
  return heads.join("|") === "Item|Progress|Stage|Priority|Due|Member";
})());

/* OLD LINKS STILL RESOLVE. `?face=board` and `?face=calendar` are addresses
   people have; they land on Tasks with that view rather than 404-ing or
   silently showing something else. */
(() => {
  ok("an old ?face=board link lands on the board",
    at("/work?face=board").indexOf("tm-board") >= 0);
  ok("…and an old ?face=calendar link on the month",
    at("/work?face=calendar").indexOf("tm-cal") >= 0);
})();

/* ONE CONTROL FOR EVERY DESTINATION. List, Board and Calendar were a segmented
   row in the body while Timeline and Analysis were in the header dropdown — so
   getting from the board to the timeline meant two different controls in two
   different places to answer one question. The body row is gone. */
(() => {
  const tasks = at("/work");
  ok("the body no longer carries a second switcher",
    tasks.indexOf("tm-views") < 0 && tasks.indexOf('role="tablist"') < 0);
  ok("…and every view still reaches its own face", (() => {
    const board = at("/work?view=board");
    const cal = at("/work?view=calendar");
    return board.indexOf("tm-board") >= 0 && cal.indexOf("tm-cal") >= 0;
  })());
})();
renders("the timeline draws lanes", () => at("/work?face=timeline"), ["tm-tl", "tm-tl-lane"]);

/* THE THIRD FACE, and the one that did not exist. It reads the rows on screen
   rather than the whole table, so every filter above it applies — a chart that
   ignored the filter band would be a chart nobody could trust against the list
   beside it. */
renders("analysis draws the three questions", () => at("/work?face=analysis"),
  ["tm-an", "dls-stat", "Where the work is", "Who is carrying what", "Steps ticked off"]);

(() => {
  const html = at("/work?face=analysis");
  ok("…as bar rows, from the panel's own chart kit",
    html.indexOf("ch-rows") >= 0 && html.indexOf("ch-row") >= 0);
  ok("…counting the checklist steps it can see",
    html.indexOf("steps") >= 0);
  /* THE FILTER APPLIES. This is the assertion that fails if the face ever
     reaches past `rows` to the whole table. */
  const all = at("/work?face=analysis");
  const one = at("/work?face=analysis&q=zzzznothingmatches");
  ok("…and every filter above it applies",
    one.indexOf("Nothing to analyse") >= 0 && all.indexOf("Nothing to analyse") < 0);
})();

const cal = at("/work?view=calendar");
ok("the calendar has no filter band", cal.indexOf("dls-cmd") < 0);
["board", "list"].forEach((v) => {
  ok("the " + v + " keeps its filter band", at("/work?view=" + v).indexOf("dls-cmd") >= 0);
});

/* ATTENDANCE HAS FOUR FACES NOW and each answers a different question, so each
   names something only it draws. The clock is asserted separately because it
   lives in the topbar slot, which a module-only render never reaches. */
renders("attendance today", () => at("/attendance"), ["dls", "tabs", "tbl", "tm-datef"]);
renders("attendance history", () => at("/attendance?face=history"), ["dls", "tm-daterow"]);
renders("attendance analytics", () => at("/attendance?face=analytics"),
  ["tm-an-days", "tm-an-stack", "tm-sort"]);
renders("attendance requests", () => at("/attendance?face=requests"), ["dls-body"]);
/* ORDER, NOT JUST PRESENCE. The four were asserted as a set, which passes just
   as happily when Requests — the only tab that can be waiting on the reader —
   sits last behind two views nobody opens twice a day. */
(() => {
  const html = at("/attendance");
  const want = ["Today", "Requests", "History", "Analytics"];
  const at_ = want.map((l) => html.indexOf(">" + l));
  ok("every attendance tab is drawn", at_.every((i) => i >= 0));
  ok("...in the order Today, Requests, History, Analytics",
    at_.every((i, n) => n === 0 || at_[n - 1] < i));
  /* The icon is inside the button, and `.ic` only lays out in a flex box — as
     inline text it hangs below the label.

     `class` IS NOT ASSERTED AS THE FIRST ATTRIBUTE any more, and the reason is
     worth writing down. Icon renders an @untitledui/icons component now, and
     those spread the caller's props AFTER their own, so the class lands last:
     `<svg viewBox=… stroke-width="2" … class="ic sm">`. Both things this line
     exists to prove are unchanged — the svg is still the button's first child,
     and it still carries `ic sm` — so only the attribute ORDER, which was
     incidental to the hand-rolled markup, has moved. Matching on order would
     make this a test of which library draws the icon. */
  ok("each tab carries its icon", (html.match(/<button[^>]*>\s*<svg[^>]*\sclass="ic sm"/g) || []).length >= 4);
})();
ok("the leave queue left the middle of the day table",
  at("/attendance").indexOf("tm-inbox") < 0);
/* The date is a FIELD, so any date is one move away rather than twelve presses
   of a chevron — and `max` is what stops a future day, not a disabled button
   somebody routes around by typing the URL. */
ok("the day is pickable, not just steppable",
  at("/attendance").indexOf('type="date"') >= 0);
ok("…and a future day cannot be asked for",
  at("/attendance").indexOf('max="' + TODAY + '"') >= 0);
/* Two labels the toolbar already says. The day heading repeated the date field
   directly above it, and the scope note repeated a count the strip carries. */
ok("the day heading is gone from the table", at("/attendance").indexOf("tm-daterow") < 0);
ok("the scope note is gone from the tab row", at("/attendance").indexOf("tm-scope\"") < 0);
/* The clock that used to be asserted here is gone — it is the member
   dashboard's, not the admin panel's. Nothing replaces the assertion: this
   harness renders modules, and chrome is published to a shell it never
   mounts, so the block was only ever reachable by rendering the component
   directly. tsc is what now catches a reference to it. */

/* REPORTS IS THREE TABS NOW. The record, the queue, and the shape of a window —
   each named by something only it draws, so a tab that renders an empty shell
   instead of itself fails here rather than in a browser. */
renders("reports · the record", () => at("/reports"), ["dls", "tabs", "tbl", "tm-datef"]);
/* The heading, not the cards: with no session the scope narrows to one member
   who happens to need nothing, and "nothing needs you" is a correct render of
   this tab rather than a failure of it. */
renders("reports · actions", () => at("/reports?face=actions"),
  ["dls-body", "Needs attention"]);
renders("reports · analytics", () => at("/reports?face=analytics"),
  ["tm-an-pair", "tm-sort", "tm-cols3"]);
(() => {
  const html = at("/reports");
  const want = ["Reports", "Actions", "Analytics"];
  const pos = want.map((l) => html.indexOf(">" + l));
  ok("every reports tab is drawn", pos.every((i) => i >= 0));
  ok("...in the order Reports, Actions, Analytics",
    pos.every((i, n) => n === 0 || pos[n - 1] < i));
  /* The attention cards and the progress roll-up left the record. One was a
     queue stacked on top of a table, the other belonged to neither. */
  ok("the attention cards left the record tab", html.indexOf("tm-attn") < 0);
  ok("the progress roll-up left the record tab", html.indexOf("tm-cols3") < 0);
  /* Writing your own day left this page entirely: it is a senior's review
     surface, and two write controls made it answer to two people at once. */
  ok("the plan and EOD forms left the review page", html.indexOf("My plan") < 0);
  /* The date scopes all three tabs, so it sits with them rather than under one. */
  ok("the date sits in the tab row", html.indexOf("tm-tabrow") >= 0);
  /* `.dls-body` carries no top padding by design — the band above a list screen
     supplies it. Removing the heading took that away and welded the table's
     header to the strip's bottom rule. */
  ok("the table is not welded to the strip above it", html.indexOf("dls-body tm-pane") >= 0);
})();
ok("the attendance day table is not welded either",
  at("/attendance").indexOf("dls-body tm-pane") >= 0);

const menu = node(<FaceMenu face="tasks" view="list" goto={() => {}} />);
/* ALL FIVE DESTINATIONS IN THE ONE MENU — the three shapes of "what work is
   there", then the two that are different questions. */
["List", "Board", "Calendar", "Timeline", "Analysis"].forEach((l) =>
  ok("the switcher offers " + l, menu.indexOf(">" + l + "<") >= 0));
/* Grouped, not flattened: three of them are one question in three shapes and
   two of them are not, and a flat list of five says otherwise. */
ok("…in two named groups", (menu.match(/pop-grp/g) || []).length === 2);
ok("…and marks the one you are in", menu.indexOf("mi on") >= 0);
/* The button names the destination, not the family: it said "Tasks" on all
   three of List, Board and Calendar. */
/* Rendered directly: the switcher goes into the topbar through
   `usePageChrome`, which needs AdminShell, so a route render never reaches
   it — and the assertion that tried would have passed vacuously. */
ok("…and the button names the view you are in, not the family", (() => {
  const btn = (f: string, v: string) => node(<FaceSwitch face={f} view={v} goto={() => {}} />);
  return btn("tasks", "board").indexOf("Board") >= 0
    && btn("tasks", "list").indexOf("List") >= 0
    && btn("tasks", "calendar").indexOf("Calendar") >= 0
    && btn("analysis", "list").indexOf("Analysis") >= 0;
})());

try {
  const html = node(<NewItemModal kind="task" members={readMembers()} />);
  ok("the create dialog renders its fields", html.indexOf('class="fg"') >= 0);
  ok("…with a bordered control, not a bare label", html.indexOf('class="inp"') >= 0);
  /* STEPS ARE NOT SET BEFORE THE THING EXISTS. Naming a task and handing it to
     somebody is the whole of creating one; the checklist is written on the
     record, in the drawer, which is now its single entry point. */
  ok("…and no longer asks for steps up front",
    html.indexOf("Add a step") < 0 && html.indexOf("tm-ck-draft") < 0);
  ok("…but still carries the description and its marks",
    html.indexOf('id="niDesc"') >= 0 && html.indexOf("tm-rt-bar") >= 0);
  /* Which milestone a task belongs under is a decision about the SHAPE of the
     work, and one you usually make after it exists. It lives on Edit. */
  ok("…and no longer asks what it rolls up to", html.indexOf("Rolls up to") < 0);
  /* Six elements for one idea — two labels, two inputs, a refusal and a button
     of its own — became the row the drawer already uses. */
  ok("attaching a link is one row, not a form",
    html.indexOf('placeholder="Paste a link"') >= 0
    && html.indexOf("Add link") < 0 && html.indexOf(">Address<") < 0);
  /* `createTag` has taken a tone since it shipped and no screen in Tasks ever
     passed one, so every tag born here came out grey. */
  ok("a new tag can be given a type", html.indexOf("tm-swatch") >= 0);
  ok("…and there is one swatch per hue in the palette",
    html.split("tm-swatch").length - 1 === 11);
} catch (e) {
  failed++;
  console.log("  FAIL the create dialog THREW\n         " + (e as Error).message);
}

console.log("\nThe rail block is what is assigned, not a three-day window\n");

/* IT WAS CALLED "Tasks" AND SHOWED THREE DAYS. Anything due later, and anything
   undated, was dropped without a word — so a member carrying twelve tasks read
   a panel headed "Tasks · 3", and the count counted the window rather than the
   work. */
{
  const openOf = (id: string) => readItems().filter(
    (i) => i.kind === "task" && i.assigneeId === id && !isTerminal(i.status));
  /* The busiest member, so the cap and the grouping are actually exercised
     rather than passing on somebody who happens to have three. */
  const busiest = readMembers()
    .map((m) => ({ id: m.memberId, n: openOf(m.memberId).length }))
    .sort((a, b) => b.n - a.n)[0];
  const total = busiest.n;
  ok("a seeded member carries enough work to test this", total >= 4);

  const full = node(<TasksBlock who={busiest.id} onOpen={() => {}} />);
  ok("the block is titled Assigned", full.indexOf("<b>Assigned</b>") >= 0);
  ok("…and its chip counts everything assigned, not everything drawn",
    full.indexOf('class="tm-blk-c">' + total + "<") >= 0);
  ok("…and uncapped it draws them all",
    (full.match(/class="tm-tk[ "]/g) || []).length === total);
  ok("…with nothing hidden", full.indexOf("more on the board") < 0);

  const capped = node(<TasksBlock who={busiest.id} onOpen={() => {}} limit={1} />);
  ok("capped, it draws the cap", (capped.match(/class="tm-tk[ "]/g) || []).length === 1);
  ok("…names what it cut", capped.indexOf((total - 1) + " more on the board") >= 0);
  ok("…and still counts the whole workload in the chip",
    capped.indexOf('class="tm-blk-c">' + total + "<") >= 0);
  /* The cap is spent from the top, so it can never hide something overdue in
     order to show something merely later. */
  const list = openOf(busiest.id);
  const firstGroup = list.some((i) => isDelayed(i)) ? "Overdue"
    : list.some((i) => i.dueDate === TODAY) ? "Due today" : "Later";
  ok("…spending the cap on the most urgent group first",
    capped.indexOf(">" + firstGroup + " · ") >= 0);
}

console.log("\nSix marks, and every one of them is parsed\n");

/* A BUTTON WITH NO BRANCH IN RichText writes characters that render as
   themselves, which is worse than having no button — so the bar is checked
   against the list of marks the parser knows, not on its own. */
try {
  const bar = node(<NewItemModal kind="task" members={readMembers()} />);
  ["Bold", "Italic", "Bulleted list", "Numbered list", "Checklist", "Link"].forEach((t) => {
    ok("the bar offers " + t, bar.indexOf('aria-label="' + t + '"') >= 0);
  });
} catch (e) {
  failed++;
  console.log("  FAIL the mark bar THREW " + (e as Error).message);
}

console.log("\nThe drawer is a row, not a stack\n");

try {
  const task = readItems().filter((i) => i.kind === "task")[0];
  const dw = node(<ItemDrawer itemId={task.itemId} onClose={() => {}} onOpen={() => {}} />);
  /* `.dw-h` is padding and a rule and NOT a flex container, so `.spacer` did
     nothing: the stage pill, Edit and the close button all sat in the text flow
     and wrapped onto a second line under the title. The class is the fix and
     team.css carries the rule. */
  ok("the header is laid out as a row", dw.indexOf("dw-h tm-dw-h") >= 0);
  ok("…with the facts as one grid under it", dw.indexOf("tm-facts") >= 0);
  /* Stage was in that grid AND on a pill in the header, one scroll-line apart.
     The header keeps it, because that is where a reader looks for it. */
  ok("…and the stage is not printed twice",
    dw.split("<dt>").filter((c) => c.indexOf("Stage") === 0).length === 0);
  ok("…and the steps, which are written here and nowhere else",
    dw.indexOf("Add a step") >= 0);
  /* Add was disabled until BOTH fields were filled and the store then refused
     anything without a scheme, so a pasted `docs.google.com/…` could not be
     saved. The address is the field, and it leads. */
  ok("…and a link needs only an address",
    dw.indexOf('aria-label="Link address"') >= 0
    && dw.indexOf('aria-label="Link name"') >= 0);
  ok("…and a tag made here can be given a type too", dw.indexOf("tm-swatch") >= 0);
  /* Four headings each trailed a sentence explaining the data model, at the
     same width as the content and above it. A heading owes the reader how much
     is under it, not what the record is. */
  /* ONE FIELD, ONE CONTROL. The status was a read-only pill here and five
     buttons in the footer — Start / Complete / Reopen / Restore / Cancel — so
     the thing people most often open this panel to do was the furthest from the
     top and spelled five ways. */
  ok("…and the status is a control, not five buttons", (() => {
    const foot = dw.slice(dw.indexOf('class="dw-f"'));
    return dw.indexOf("tm-st-b") >= 0
      && [">Start<", ">Complete<", "Reopen", "Restore", "Cancel…"]
        .every((b) => foot.indexOf(b) < 0);
  })());
  ok("…and the footer is the two relationships", (() => {
    const foot = dw.slice(dw.indexOf('class="dw-f"'));
    return foot.indexOf("on…") >= 0 && foot.indexOf("Link…") >= 0;
  })());
  ok("…and no heading explains the schema", [
    "A tag is a record its owner holds",
    "The brief, the folder, the board",
    "Soft edges",
    "Delay is derived from the date",
  ].every((prose) => dw.indexOf(prose) < 0));
} catch (e) {
  failed++;
  console.log("  FAIL the drawer THREW " + (e as Error).message);
}

console.log("\nEvery class this module draws has a rule to draw it\n");

/* THE CHECK THIS SUITE DID NOT HAVE, and the bug that proved it was missing:
   `.tm-dw-h` — the rule that makes the drawer header a row instead of a
   wrapped stack — was written inside the summary-strip block, and when that
   block was replaced wholesale by the facts grid the header rule went out with
   it. Nothing failed. The assertion above it checked that the CLASS was in the
   markup, which it still was; the styling it names had simply stopped existing.

   So: render the module's real surfaces, take every `tm-`/`tml-` class that
   actually comes out, and require a rule for it. Scoped to this module's own
   namespace on purpose — shared classes (`btn`, `pill`, `sh`) belong to
   admin-theme.css and are that file's business. */
{
  const css = ["src/admin/views/Team/team.css", "src/styles/admin-theme.css"]
    .map((f) => readFileSync(f, "utf8")).join("\n");

  const surfaces = [
    at("/work"), at("/work?view=board"), at("/work?view=calendar"),
    at("/work?face=timeline"), at("/work?face=analysis"),
    node(<NewItemModal kind="task" members={readMembers()} />),
    node(<ItemDrawer itemId={readItems().filter((i) => i.kind === "task")[0].itemId}
      onClose={() => {}} onOpen={() => {}} />),
  ].join(" ");

  const used = new Set<string>();
  (surfaces.match(/class="[^"]*"/g) || []).forEach((chunk) => {
    chunk.slice(7, -1).split(/\s+/).forEach((c) => {
      if (/^tml?-/.test(c)) used.add(c);
    });
  });

  /* AND THE ONES THAT ONLY EXIST IN A BRANCH A STATIC RENDER NEVER REACHES.
     Today's plan draws fourteen classes of its own and every one of them is
     inside `open ? ... : null`, so the rendered-output pass above saw exactly
     one — the count on the closed button. Reading the module's source for
     literal class names covers the rest, and covers every other conditional
     branch in the module at the same time. */
  const srcDir = "src/admin/views/Team";
  (readdirSync(srcDir, { recursive: true }) as string[])
    .filter((f) => f.endsWith(".tsx"))
    .forEach((f) => {
      /* Split first, match per line: a quoted run may not span lines, and
         `String.fromCharCode(10)` keeps a newline out of this file as an
         escape — which is the third time an escaped backslash has been
         eaten on its way in here. */
      readFileSync(srcDir + "/" + f, "utf8")
        /* `data-act="tm-new-go"` and friends are automation hooks, not
           classes — they share the module prefix and would otherwise be
           reported as six classes with no rule. */
        .replace(/data-[a-z-]+="[^"]*"/g, "")
        .split(String.fromCharCode(10)).forEach((line) => {
        (line.match(/"[^"]*"/g) || []).forEach((lit) => {
          lit.slice(1, -1).split(/\s+/).forEach((c) => {
            /* A trailing hyphen is a concatenation prefix — `"tm-kind-" +
               kind` names no class on its own. */
            if (/^tml?-[a-z0-9-]*[a-z0-9]$/.test(c)) used.add(c);
          });
        });
      });
    });

  /* CLASSES THAT CORRECTLY HAVE NO RULE. Listed one by one with the reason,
     never matched by pattern, so a fourth has to be argued for rather than
     absorbed:

       tm-kind-task    a modifier that deliberately does not override —
                       `.tm-kind` colours the icon, milestone and target change
                       it, and a TASK is the default colour.
       tm-col-planned  the same shape: the Planning column heading keeps the
                       default ink while the other four stages tint theirs.
       tm-tl           a bare grouping wrapper. Every child of the timeline
                       (`.tm-tl-head`, `-row`, `-lane`, `-grid`) is styled; the
                       container itself has nothing to say. */
  const DEFAULTS = ["tm-kind-task", "tm-col-planned", "tm-tl"];

  /* A PLAIN SEARCH, NOT A REGEX BUILT FROM A STRING. Assembling one here means
     escaping backslashes into a string literal, and getting that wrong fails
     OPEN rather than loud: a literal-dot escape written as a bare dot matches
     ANY character, and a word-boundary lookahead written without its escape
     lets `.tm-facts` satisfy a lookup for `tm-fact` — so the check passes while
     testing almost nothing. indexOf cannot be escaped wrong. */
  const NAME_CHAR = /[A-Za-z0-9_-]/;
  const hasRule = (c: string) => {
    const needle = "." + c;
    for (let i = css.indexOf(needle); i >= 0; i = css.indexOf(needle, i + 1)) {
      /* A rule for THIS class, not one that merely starts with its name:
         `.tm-fact` must not be satisfied by `.tm-facts`. */
      if (!NAME_CHAR.test(css.charAt(i + needle.length))) return true;
    }
    return false;
  };

  const orphans = Array.from(used)
    .filter((c) => DEFAULTS.indexOf(c) < 0 && !hasRule(c)).sort();

  ok(used.size + " module classes render, and every one has a rule",
    orphans.length === 0);
  if (orphans.length) console.log("         no rule for: " + orphans.join(", "));
}

/* ---------------------------------------------------- the member surface -- */
/* THIS IS THE BLOCK THAT DID NOT EXIST when a whole module went blank behind an
   intact topbar. Every operation, at every scope, actually rendered. */

console.log("\nThe member surface\n");

const ME = meId();                     /* "58" — D. Kapoor, with no session   */
const MINE = ME;                       /* self                                */
const REPORT = "86";                   /* N. Pillai, reportsTo 58 → senior    */
const OTHER = "52";                    /* A. Sharma, reportsTo 41 → admin     */

renders("the launcher draws its cards and its nudges", () => member(MINE, ""),
  ["tm-opgrid", "tm-opcard", "tm-opnav", "tm-mh"]);

MEMBER_OPS.forEach((o) => {
  renders("self · " + o.key, () => member(MINE, o.key), ["tm-oph"]);
});
/* The two write controls belong to the person, and to nobody looking at them. */
ok("your own reports page offers the plan and the EOD",
  member(MINE, "reports").indexOf("EOD report") >= 0
  || member(MINE, "reports").indexOf("Today's report") >= 0);
ok("...and a senior's view of somebody else's does not",
  member(REPORT, "reports").indexOf("EOD report") < 0
  && member(REPORT, "reports").indexOf("Write today's plan") < 0);

/* A SENIOR MUST NOT SEE THE THREE PRIVATE ONES, and the URL must refuse them
   with the same words the missing card would have carried. Hiding the door and
   opening it to anyone who types the address is worse than not hiding it. */
const seniorNav = member(REPORT, "");
opsFor("senior").forEach((o) => {
  renders("senior · " + o.key, () => member(REPORT, o.key), ["tm-oph"]);
  ok("a senior's switcher offers " + o.label, seniorNav.indexOf(">" + o.label + "<") >= 0);
});
["agreements", "documents", "pay"].forEach((k) => {
  const label = (MEMBER_OPS.filter((o) => o.key === k)[0] || { label: k }).label;
  ok("a senior's switcher hides " + label, seniorNav.indexOf(">" + label + "<") < 0);
  const html = member(REPORT, k);
  ok("…and typing /" + k + " is refused", html.indexOf("is not on this view") >= 0);
  ok("…without drawing the page", html.indexOf("tm-oph") < 0);
});

/* THE LEAK TEST. A nudge derived from a page this viewer cannot open must be
   ABSENT, not greyed — a row reading "1 agreement unsigned" would announce a
   document the same screen just refused to show. N. Pillai has an unsigned
   agreement and missing documents in the seed, so the two blocks differ. */
ok("a senior's summary names no agreement",
  seniorNav.indexOf("unsigned") < 0);
ok("a senior's summary names no document",
  seniorNav.indexOf("required document") < 0);
ok("…and says why the rows are absent rather than greying them",
  seniorNav.indexOf("absent rather than greyed") >= 0);
const adminNav = member(REPORT, "");
ok("the seed still has something for that test to hide",
  agreementsFor(REPORT).some((a) => a.state !== "signed" && a.state !== "revoked"));

MEMBER_OPS.forEach((o) => {
  renders("admin · " + o.key, () => member(OTHER, o.key), ["tm-oph"]);
});
ok("an admin's switcher offers every operation",
  MEMBER_OPS.every((o) => member(OTHER, "").indexOf(">" + o.label + "<") >= 0));
ok("adminNav rendered", adminNav.length > 0);

/* A stale third segment is a message, not a crash. */
ok("an unknown operation says so",
  member(MINE, "nonsense").indexOf("nonsense&quot; page") >= 0);

/* ------------------------------------------------------------ the dialogs -- */
console.log("\nThe member dialogs\n");

const lv = leaveFor(REPORT)[0];
const ag = agreementsFor(REPORT)[0];
const dialogs: [string, React.ReactNode][] = [
  ["request leave", <LeaveRequestModal memberId={MINE} />],
  ["approve leave", <LeaveDecideModal l={lv} state="approved" />],
  ["refuse leave", <LeaveDecideModal l={lv} state="rejected" />],
  ["send an agreement", <SendAgreementModal memberId={REPORT} />],
  ["sign an agreement", <SignAgreementModal a={ag} />],
  ["add a document", <AddDocumentModal memberId={REPORT} />],
  ["new tag", <NewTagModal ownerId={MINE} />],
  /* They moved off `#/reports` and onto the member's own page as dialogs. */
  ["today's plan", <PlanModal m={readMember(MINE)!} />],
  ["end of day", <EodModal m={readMember(MINE)!} />],
];
dialogs.forEach(([what, n]) => {
  const html = renders("the " + what + " dialog", () => node(n), ["md-h", "md-f"]);
  if (html) {
    ok("…" + what + " labels every control",
      html.indexOf("<label") >= 0 || html.indexOf('class="fg-lb"') >= 0);
  }
});

console.log("\nThe plan is written here; the report only reads\n");

/* NOTHING ON EITHER SCREEN CREATES WORK ANY MORE. The note had a free-text row
   under its list and the EOD had a checkbox list plus "Something not on the
   plan" — two ways to mint a task while planning or closing a day, with no
   owner but you, no kind, no dates and no parent. */
{
  const eod = (id: string) => node(<EodModal m={readMember(id)!} />);
  const mine = eod(MINE);
  /* THE NOTE CAN CREATE WORK AGAIN, and the shape it does it in matters: one
     row you type into, not a labelled field with an Add button beside it. Its
     controls exist only while the note is open, so `check:browser` drives the
     behaviour (Enter commits and opens the next row) and this covers the shape
     from source. */
  {
    const src = readFileSync("src/admin/views/Team/TodayPlan.tsx", "utf8");
    ok("the note offers a way to add a task", src.indexOf("Add a task") >= 0);
    ok("…as a row, not a field with a button beside it",
      src.indexOf("tm-np-add") >= 0 && src.indexOf("tm-np-in") >= 0);
    /* A typed line goes through `submitPlan`, which links it to an open task of
       the same name or mints one due today in your name — never a loose note,
       and never a second copy of work that already exists. */
    ok("…and a typed line is a plan line, not an item minted here",
      src.indexOf("submitPlan") >= 0 && src.indexOf("createItem") < 0);
  }

  ok("the report has no checkboxes to tick", mine.indexOf('type="checkbox"') < 0);
  ok("…and no way to add a line to it", mine.indexOf("Something not on the plan") < 0);
  ok("…it reads the board instead", mine.indexOf('class="tm-eod read"') >= 0);

  /* Submit used to require at least one line, which was only reachable by
     adding one by hand — so with the lines derived, a member who planned
     nothing and closed nothing could never file a report at all. */
  const openOf = (id: string) => readItems().filter(
    (i) => i.kind === "task" && i.assigneeId === id && !isTerminal(i.status));
  const idle = readMembers().map((m) => m.memberId)
    .filter((id) => eod(id).indexOf("Nothing planned, and nothing closed today") >= 0)[0];
  ok("a member with nothing on the board still reaches Submit", (() => {
    if (!idle) return false;
    const h = eod(idle);
    const btn = h.slice(h.lastIndexOf("<button"), h.length);
    return btn.indexOf("disabled") < 0;
  })());

  /* And the one rule the store does enforce still gates the button. */
  const withUndone = readMembers().map((m) => m.memberId)
    .filter((id) => eod(id).indexOf("not get done?") >= 0)[0];
  ok("…while an unticked line still demands a reason first", (() => {
    if (!withUndone) return false;
    const h = eod(withUndone);
    return h.slice(h.lastIndexOf("<button")).indexOf("disabled") >= 0;
  })());
  ok("...(and that member really does carry open work)",
    !withUndone || openOf(withUndone).length > 0);
}

console.log("\n" + (failed ? failed + " FAILED" : "all checks passed") + "\n");
process.exit(failed ? 1 : 0);
