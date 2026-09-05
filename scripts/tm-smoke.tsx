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

/* MemoryRouter calls useLayoutEffect and React says so on every single render.
   It is true, it is harmless here, and repeated 40 times it buries the results
   this script exists to print. */
const realError = console.error;
console.error = (...a: unknown[]) => {
  if (typeof a[0] === "string" && a[0].indexOf("useLayoutEffect does nothing") >= 0) return;
  realError.apply(console, a as []);
};

import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ShellProvider } from "../src/admin/shell/ShellContext";
import Work from "../src/admin/views/Team/Work";
import Attendance, { TopClock } from "../src/admin/views/Team/Attendance";
import Reports from "../src/admin/views/Team/Reports";
import { FaceMenu, NewItemModal } from "../src/admin/views/Team/Work";
import MemberPage from "../src/admin/views/Team/MemberPage";
import { MEMBER_OPS, opsFor } from "../src/admin/views/Team/member/ops";
import {
  AddResourceModal, LeaveDecideModal, LeaveRequestModal, NewTagModal, SendAgreementModal,
  SignAgreementModal,
} from "../src/admin/views/Team/member/modals";
import { EodModal, PlanModal } from "../src/admin/views/Team/member/reportForms";
import {
  TODAY, agreementsFor, leaveFor, meId, readItems, readMember, readMembers, resetStore,
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
renders("the calendar face draws its rail and its month grid", () => at("/work"),
  ["tm-shell", "tm-rail", "tm-cal", "tm-day", "tm-calbar"]);
renders("the board draws five columns", () => at("/work?face=board"),
  ["tm-boardwrap", "tm-board", "tm-col"]);
renders("the list draws a table", () => at("/work?face=list"), ["tbl", "dls-body"]);
renders("the timeline draws lanes", () => at("/work?face=timeline"), ["tm-tl", "tm-tl-lane"]);

const cal = at("/work");
ok("the calendar has no filter band", cal.indexOf("dls-cmd") < 0);
["board", "list", "timeline"].forEach((f) => {
  ok("the " + f + " keeps its filter band", at("/work?face=" + f).indexOf("dls-cmd") >= 0);
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
     inline text it hangs below the label. */
  ok("each tab carries its icon", (html.match(/<button[^>]*>\s*<svg class="ic sm"/g) || []).length >= 4);
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
renders("the clock, in the topbar slot", () => node(<TopClock />, "/attendance"),
  ["tm-tclock", "tm-tclock-a"]);

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
})();

const menu = node(<FaceMenu face="calendar" goto={() => {}} />);
["Calendar", "Board", "List", "Timeline"].forEach((l) =>
  ok("the switcher offers " + l, menu.indexOf(">" + l + "<") >= 0));
ok("…and marks the one you are in", menu.indexOf("mi on") >= 0);

try {
  const html = node(<NewItemModal kind="task" members={readMembers()} all={readItems()} />);
  ok("the create dialog renders its fields", html.indexOf('class="fg"') >= 0);
  ok("…with a bordered control, not a bare label", html.indexOf('class="inp"') >= 0);
} catch (e) {
  failed++;
  console.log("  FAIL the create dialog THREW\n         " + (e as Error).message);
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
  ["add a document", <AddResourceModal memberId={REPORT} />],
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

console.log("\n" + (failed ? failed + " FAILED" : "all checks passed") + "\n");
process.exit(failed ? 1 : 0);
