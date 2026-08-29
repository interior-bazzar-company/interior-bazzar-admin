/* Render every Users Management surface to a string and fail on any throw. */

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
import AssignMembership from "../src/admin/views/Users/AssignMembership";
import { Chips } from "../src/admin/views/Users/FacetPicker";
import LifecycleModal from "../src/admin/views/Users/LifecycleModal";
import EditProfile from "../src/admin/views/Users/EditProfile";
import { NoteModal, TagsModal, DeactivateModal } from "../src/admin/views/Users/Modals";
import {
  fieldsFor, toRow, readUsers, readMemberships, usernameTaken, validateFacets,
} from "../src/admin/views/Users/store";
import { __setPlansMode } from "../src/admin/views/Plans/api";
import type { LifecycleAction } from "../src/admin/views/Users/store";

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

const modal = (node: React.ReactNode) => renderToStaticMarkup(
  <MemoryRouter><ShellProvider>{node}</ShellProvider></MemoryRouter>
);

const rowOf = (id: string) => {
  const u = readUsers().filter((x) => x.userId === id)[0];
  return toRow(u, readMemberships());
};

const URLS: [string, string][] = [
  ["users (default)", "/users"],
  ["users filtered", "/users?cls=normal&city=Mumbai&flag=incomplete"],
  ["users page 2", "/users?page=2"],
  ["users empty", "/users?q=zzzznothing"],
  ["users custom range", "/users?registered=custom&from=2026-01-01&to=2026-08-01"],
  ["members", "/users?view=members"],
  ["members filtered", "/users?view=members&cls=former_member"],
  ["renewals", "/users?view=renewals"],
  ["renewals ended", "/users?view=renewals&flag=ended"],
  ["analytics (default 6m)", "/users?view=analytics"],
  ["analytics · 3-month range", "/users?view=analytics&start=2026-06&end=2026-08"],
  ["analytics · 12-month range", "/users?view=analytics&start=2025-09&end=2026-08"],
  ["analytics · single month", "/users?view=analytics&start=2026-08&end=2026-08"],
  ["analytics · reversed range", "/users?view=analytics&start=2026-08&end=2026-03"],
  ["analytics · out-of-bounds range", "/users?view=analytics&start=2019-01&end=2099-12"],
  ["analytics · oldest span, no prior", "/users?view=analytics&start=2025-09&end=2025-11"],
  ["record · membership (active)", "/users/IB-U-0912"],
  ["record · membership (pending)", "/users/IB-U-0958"],
  ["record · membership (paused)", "/users/IB-U-0834"],
  ["record · membership (suspended)", "/users/IB-U-0790"],
  ["record · no membership", "/users/IB-U-1041"],
  ["record · deactivated", "/users/IB-U-0601"],
  ["record · profile", "/users/IB-U-0912?tab=profile"],
  ["record · commercial", "/users/IB-U-0912?tab=commercial"],
  ["record · history", "/users/IB-U-0912?tab=history"],
  ["record · term detail", "/users/IB-U-0912?tab=history&term=IB-MB-0912-2"],
  ["record · pending term detail", "/users/IB-U-0958?tab=history&term=IB-MB-0958-1"],
  ["record · notes", "/users/IB-U-0912?tab=notes"],
  ["record · notes (empty)", "/users/IB-U-0944?tab=notes"],
  ["record · audit", "/users/IB-U-0912?tab=audit"],
  ["record · missing", "/users/IB-U-NOPE"],
];

let failed = 0;
const noop = () => {};
const check = (label: string, fn: () => string) => {
  try {
    const html = fn();
    if (!html || html.length < 40) throw new Error("rendered almost nothing (" + html.length + " chars)");
    console.log("  ok   " + label + "  (" + html.length + " chars)");
  } catch (e) {
    failed++;
    console.log("  FAIL " + label + "\n         " + (e as Error).message);
  }
};

console.log("\nsurfaces");
URLS.forEach(([label, url]) => check(label, () => at(url)));

/* LABELS AND THE VIEW BAND.
   Worth asserting because both are the kind of thing that rots silently: a
   renamed cell still renders, a tab count computed off the wrong set still
   shows a number, and neither breaks a build. `normal` in particular was
   internal vocabulary that had leaked onto a screen.

   NOT COVERED HERE: the two topbar chips. They reach the shell through
   usePageChrome, which sets them in a useEffect, and renderToStaticMarkup does
   not run effects — so the topbar is empty in this harness by construction,
   not by oversight. Those two need a browser. */
console.log("\nstrip labels and the view band");
{
  const users = at("/users");
  const members = at("/users?view=members");
  const lbl = (h: string, k: string) => h.indexOf('class="k">' + k + "<") >= 0;

  check("the strip leads with a Total", () => {
    if (!lbl(users, "Total")) throw new Error("no Total cell on Users");
    if (!lbl(members, "Total")) throw new Error("no Total cell on Members");
    return users;
  });
  check("...and Total states the whole population, not the filtered one", () => {
    const narrowed = at("/users?cls=normal");
    /* 20 is every row; the filter leaves 6. The cell is a stated whole and
       must not follow the filter down, or it stops being one. */
    if (narrowed.indexOf(">20<") < 0) throw new Error("Total followed the filter");
    return narrowed;
  });
  check("classification cells read as labels, not as internal keys", () => {
    if (lbl(users, "normal")) throw new Error("`normal` is still on screen");
    if (!lbl(users, "Users")) throw new Error("no Users cell");
    if (!lbl(users, "Active members")) throw new Error("no Active members cell");
    return users;
  });
  check("every strip cell is sentence case", () => {
    const keys = (users.match(/class="k">([^<]+)</g) || [])
      .map((m) => m.replace('class="k">', "").replace("<", ""));
    const bad = keys.filter((k) => /^[a-z]/.test(k));
    if (bad.length) throw new Error("lower-case: " + bad.join(", "));
    return users;
  });
  /* THE VOCABULARY IS ON SCREEN, so renaming a classification is a rename in
     six places — the pill, the strip cell, the filter dropdown, the empty
     state, the analytics tile and the seeded audit notes. Any one of them left
     behind is two names for one thing, which is how two definitions of it
     start. These assert the absence, which is the half that gets missed. */
  check("the old classification names are gone everywhere", () => {
    const rec = at("/users/IB-U-1041?tab=audit");
    const analytics = at("/users?view=analytics");
    [["users list", users], ["members", members], ["record + audit", rec],
      ["analytics", analytics]].forEach(([where, html]) => {
      if ((html as string).indexOf("Normal User") >= 0)
        throw new Error("`Normal User` survives on the " + where);
      if ((html as string).indexOf("Former Member") >= 0)
        throw new Error("`Former Member` survives on the " + where);
    });
    return users;
  });
  check("...and the new ones are actually there", () => {
    if (!lbl(users, "Past Members")) throw new Error("no Past Members cell");
    /* The pill on a record, not just the strip cell above the list — they are
       two different renders of one vocabulary entry, and only one of them was
       ever going to be remembered. The id is derived rather than written down:
       a hard-coded one breaks when the seed changes, which is a test failing
       for a reason that is not a bug. */
    const past = readUsers().map((u) => toRow(u, readMemberships()))
      .filter((r) => r.classification === "former_member")[0];
    if (!past) throw new Error("the seed has no past member to render");
    const rec = at("/users/" + past.user.userId);
    if (rec.indexOf("Past Member") < 0)
      throw new Error("the classification pill did not follow the rename");
    const user = readUsers().map((u) => toRow(u, readMemberships()))
      .filter((r) => r.classification === "normal")[0];
    if (at("/users/" + user.user.userId).indexOf("Normal") >= 0)
      throw new Error("`Normal` survives on a plain user's record");
    return users;
  });
  check("Expiring soon left the topbar but kept both the ways in", () => {
    /* The topbar itself is not renderable here (usePageChrome sets it in an
       effect), so what is assertable is that removing it did not quietly
       remove the figure from the two places that DO open the list it counts. */
    if (!lbl(members, "Expiring soon")) throw new Error("gone from the Members strip too");
    if (at("/users?view=renewals").length < 40) throw new Error("the renewals queue broke");
    return members;
  });

  check("one name for one thing: expiring, never ending", () => {
    if (members.indexOf("nding soon") >= 0) throw new Error("`ending soon` survives on Members");
    if (!lbl(members, "Expiring soon")) throw new Error("no Expiring soon cell");
    return members;
  });

  /* The band figure is a promise about the page behind the tab. Asserting the
     NUMBER rather than just its presence is the point — a count wired to the
     wrong set still renders a tab that looks fine. */
  const band = (h: string) => (h.match(/<i class="tnum">(\d+)<\/i>/g) || [])
    .map((m) => m.replace(/\D/g, ""));
  check("Users, Members and Renewals all carry a figure", () => {
    const n = band(users);
    if (n.length < 3) throw new Error("only " + n.length + " tabs counted");
    return users;
  });
  check("...the same figures on every face", () => {
    const a = band(users).join(",");
    ["/users?view=members", "/users?view=renewals", "/users?view=analytics"].forEach((u) => {
      if (band(at(u)).join(",") !== a) throw new Error("the band disagrees on " + u);
    });
    return users;
  });
  check("...and a search does not move them", () => {
    if (band(at("/users?q=sharma")).join(",") !== band(users).join(","))
      throw new Error("the band followed the search box");
    return users;
  });
}

/* The charts are the reason Analytics exists. Asserting each form actually
   reached the DOM — and on the right kind of colour token — is the difference
   between "the page loaded" and "the page has its content". The token classes
   are the assertion because they encode the colour JOB: `s1..s3` categorical,
   `o1..o3` ordinal, `st-*` reserved status. A chart that silently switched to
   the wrong job would still render, and would still be wrong. */
console.log("\ncharts on the analytics page");
{
  const html = at("/users?view=analytics");
  const must: [string, string][] = [
    ["grouped columns", "um-col s1"],
    ["...all three series", "um-col s3"],
    ["...its legend", "um-legend2"],
    ["...axis ticks", "um-yaxis"],
    ["...hover and focus tooltip", "um-tip"],
    ["funnel on the ordinal ramp", "fill o1"],
    ["status bars on reserved status tokens", "fill st-ok"],
    ["source bars on one hue, not a value ramp", "fill s1"],
    ["plan bars on the tier ramp", "fill o3"],
    ["cohort heatmap", "um-cell h"],
    ["...with its scale stated", "um-heatkey"],
    ["...and not-yet cells that are not zeros", "um-cell none"],
  ];
  must.forEach(([label, needle]) =>
    check(label, () => {
      if (html.indexOf(needle) < 0) throw new Error("missing " + needle);
      return html;
    }));
  check("no chart library in the tree", () => {
    if (html.indexOf("recharts") >= 0) throw new Error("recharts leaked into the render");
    return html;
  });

  /* GEOMETRY. The palette validator checks colour and says nothing about
     layout, and there is no browser here to look at — so the one geometric
     property that can be checked from the markup is: every mark is sized as a
     percentage of its own track, and no percentage may leave 0..100. A bar
     wider than its track is the failure that looks like a rendering bug, and it
     is exactly what an off-by-one in the scale produces. */
  const pcts = (html.match(/(?:width|height|top):\s*([\d.]+)%/g) || [])
    .map((m) => parseFloat(m.replace(/[^\d.]/g, "")));
  check("every mark fits its track (0-100%)", () => {
    const bad = pcts.filter((v) => v < 0 || v > 100);
    if (bad.length) throw new Error(bad.length + " out of range, e.g. " + bad[0] + "%");
    return html;
  });
  check("something actually reached full width", () => {
    if (!pcts.some((v) => v > 95)) throw new Error("no mark near 100% — the scale is not tight");
    return html;
  });
  check("exactly one direct label on the column chart", () => {
    const n = (html.match(/class="um-col s\d" style="[^"]*"><em/g) || []).length;
    if (n !== 1) throw new Error("expected 1 direct label, found " + n);
    return html;
  });
  check("axis ticks and gridlines are the same count", () => {
    const ticks = (html.match(/class="tnum" style="top:/g) || []).length;
    const rules = (html.match(/class="um-rule"/g) || []).length;
    if (!ticks || ticks !== rules) throw new Error(ticks + " ticks vs " + rules + " rules");
    return html;
  });
  check("every figure is in a card", () => {
    const n = (html.match(/class="card um-block/g) || []).length;
    if (n < 10) throw new Error("only " + n + " blocks — the page is still a loose stack");
    return html;
  });
  check("the grid pairs them up", () => {
    if (html.indexOf("um-blocks") < 0) throw new Error("no two-up grid");
    const wide = (html.match(/um-block wide/g) || []).length;
    if (!wide) throw new Error("nothing opted out of the two-up grid");
    return html;
  });
  check("the range picker is on the command row", () => {
    if (html.indexOf("um-daterange") < 0) throw new Error("no range control");
    return html;
  });

  /* THE RANGE HAS TO ACTUALLY MOVE THE NUMBERS. A control that renders and
     changes nothing is worse than no control — it invites a decision on a
     figure that never re-cut. */
  check("a different range produces different figures", () => {
    const three = at("/users?view=analytics&start=2026-06&end=2026-08");
    const twelve = at("/users?view=analytics&start=2025-09&end=2026-08");
    if (three === twelve) throw new Error("3-month and 12-month ranges render identically");
    return three;
  });
  check("a reversed range is corrected, not refused", () => {
    const fwd = at("/users?view=analytics&start=2026-03&end=2026-08");
    const rev = at("/users?view=analytics&start=2026-08&end=2026-03");
    if (fwd !== rev) throw new Error("reversed range did not normalise to the same span");
    return rev;
  });
  check("an out-of-bounds range clamps to the series", () => {
    const wild = at("/users?view=analytics&start=2019-01&end=2099-12");
    const full = at("/users?view=analytics&start=2025-09&end=2026-08");
    if (wild !== full) throw new Error("out-of-bounds range did not clamp to the full series");
    return wild;
  });
  check("the oldest span says it has nothing to compare against", () => {
    const oldest = at("/users?view=analytics&start=2025-09&end=2025-11");
    if (oldest.indexOf("no prior span") < 0) throw new Error("missing the no-comparison notice");
    return oldest;
  });

  check("x labels match the column groups", () => {
    const groups = (html.match(/class="um-group"/g) || []).length;
    const labels = (html.match(/class="um-xband"[\s\S]*?<\/div>/) || [""])[0]
      .split("<span").length - 1;
    if (groups !== labels) throw new Error(groups + " groups vs " + labels + " labels");
    return html;
  });
}

console.log("\ndialogs");
check("assign membership", () => modal(
  <AssignMembership row={rowOf("IB-U-1041")} onClose={noop} onDone={noop} />));

/* THE CATALOGUE IS LIVE NOW, so the form has four states rather than one and
   three of them are somebody else's service failing. A form that renders only
   the happy path is a form that will show a blank list the first time the
   plans endpoint is slow. */
check("assign · lists only sellable plans", () => {
  __setPlansMode("ok");
  const html = modal(<AssignMembership row={rowOf("IB-U-1041")} onClose={noop} onDone={noop} />);
  ["Starter", "Growth", "Pro"].forEach((t) => {
    if (html.indexOf(t) < 0) throw new Error("missing " + t);
  });
  /* Off sale, archived, and on-sale-with-no-active-cycle must all be filtered
     out — a plan with no cycle has no duration and no price. */
  ["Legacy Bronze", "Archived Silver", "No Cycle"].forEach((t) => {
    if (html.indexOf(t) >= 0) throw new Error("offered an unsellable plan: " + t);
  });
  return html;
});
check("assign · the catalogue being unreachable is stated, not hidden", () => {
  __setPlansMode("error");
  const html = modal(<AssignMembership row={rowOf("IB-U-1041")} onClose={noop} onDone={noop} />);
  if (html.indexOf("could not be read") < 0) throw new Error("no failure message");
  if (html.indexOf("Starter") >= 0) throw new Error("invented a catalogue from nowhere");
  return html;
});
check("assign · an empty catalogue says what is missing", () => {
  __setPlansMode("empty");
  const html = modal(<AssignMembership row={rowOf("IB-U-1041")} onClose={noop} onDone={noop} />);
  if (html.indexOf("No plan is on sale") < 0) throw new Error("no empty state");
  return html;
});
check("assign · loading says so", () => {
  __setPlansMode("loading");
  const html = modal(<AssignMembership row={rowOf("IB-U-1041")} onClose={noop} onDone={noop} />);
  if (html.indexOf("Reading the plan catalogue") < 0) throw new Error("no loading state");
  __setPlansMode("ok");
  return html;
});
check("assign · exactly three sources, and they are the right three", () => {
  __setPlansMode("ok");
  const html = modal(<AssignMembership row={rowOf("IB-U-1041")} onClose={noop} onDone={noop} />);
  ["New sale", "Renewal", "Complimentary"].forEach((t) => {
    if (html.indexOf(t) < 0) throw new Error("missing source " + t);
  });
  ["Verified payment", "Invoice paid", "Deal payment", "Manual", "Legacy"].forEach((t) => {
    if (html.indexOf(t) >= 0) throw new Error("a removed source is still offered: " + t);
  });
  return html;
});
/* PROGRESSIVE DISCLOSURE, and it is deliberate: no plan is preselected, so
   there is no duration to fill in and no clash to check yet. Nothing here can
   be clicked from a server render, so what is asserted is the SHAPE — the
   duration step is absent until a plan is chosen and the submit cannot fire.
   The rules behind it (the default cycle, the clash, the plan code) are
   unit-tested directly in check:users, where they need no browser. */
check("assign · no plan preselected, so no duration step yet", () => {
  const html = modal(<AssignMembership row={rowOf("IB-U-1041")} onClose={noop} onDone={noop} />);
  if (html.indexOf("1 · Plan") < 0) throw new Error("no plan step");
  if (html.indexOf("2 · Duration") >= 0) throw new Error("duration shown before a plan is chosen");
  if (html.indexOf("disabled") < 0) throw new Error("submit is not disabled on an empty form");
  return html;
});
check("assign · nothing is labelled Term any more", () => {
  const html = modal(<AssignMembership row={rowOf("IB-U-1041")} onClose={noop} onDone={noop} />);
  if (html.indexOf("· Term") >= 0) throw new Error("a step is still labelled Term");
  return html;
});
/* No plan is chosen yet, so no clash can be claimed — but what the account
   already holds is context and is stated regardless. That is the difference
   between "no warning" and "no information". */
check("assign · live terms are stated before anything is chosen", () => {
  const html = modal(<AssignMembership row={rowOf("IB-U-0912")} onClose={noop} onDone={noop} />);
  if (html.indexOf("Already live on this account") < 0) throw new Error("live terms not listed");
  if (html.indexOf("already holds a live") >= 0) throw new Error("clash claimed before a plan was picked");
  return html;
});
check("assign · a user with nothing live gets no such notice", () => {
  const html = modal(<AssignMembership row={rowOf("IB-U-1041")} onClose={noop} onDone={noop} />);
  if (html.indexOf("Already live on this account") >= 0) throw new Error("claimed a live term that does not exist");
  return html;
});
check("edit profile", () => modal(
  <EditProfile row={rowOf("IB-U-0912")} onClose={noop} onDone={noop} />));
check("edit profile · incomplete", () => modal(
  <EditProfile row={rowOf("IB-U-1029")} onClose={noop} onDone={noop} />));

/* THE FOUR BUSINESS FACETS.
   The form is meant to be built FROM the schema — that is the module's own
   rule (UM-OD-09) and the reason a field is data rather than JSX. It is also
   the property that quietly dies the first time somebody writes
   `if (f.key === "segments")`. These assert the outcome of that rule rather
   than the rule itself: every schema field reached the form, each got the
   control its `type` asks for, and the closed ones are closed. */
{
  const memberRow = rowOf("IB-U-0912");
  const normalRow = rowOf("IB-U-1029");
  const full = modal(<EditProfile row={memberRow} onClose={noop} onDone={noop} />);
  const empty = modal(<EditProfile row={normalRow} onClose={noop} onDone={noop} />);

  check("facets · every applicable field reached the form", () => {
    /* `fieldsFor` rather than the whole schema: Target areas only applies to
       somebody who holds a term or held one, and asserting against the full
       list would demand a field the form is right to be hiding. */
    const missing = fieldsFor(memberRow).filter((f) => full.indexOf(">" + f.label) < 0);
    if (missing.length) throw new Error("absent: " + missing.map((f) => f.label).join(", "));
    return full;
  });
  check("facets · each one rendered a picker, not a bare input", () => {
    /* Counting comboboxes is the wrong assertion — a CLOSED single that is
       already answered collapses to its chip plus Change and has no combobox
       at all. What must hold is that every picker-typed field rendered the
       picker shell — plus TWO per target-area row, because each row is a
       state picker and a city picker of its own. */
    const shells = (full.match(/class="um-facet"/g) || []).length;
    const expect = fieldsFor(memberRow)
      .filter((f) => ["single", "multi", "tags"].indexOf(f.type) >= 0 && !f.simple).length
      + memberRow.user.profile.targetAreas.length * 2;
    if (shells !== expect) throw new Error(shells + " pickers, expected " + expect);
    return full;
  });
  check("facets · an answered closed single collapses to chip + Change", () => {
    /* Business type on the profile, and every row's state, are answered
       closed singles — a chip and a way back, no combobox held open. */
    if (full.indexOf(">Change<") < 0) throw new Error("no closed single collapsed");
    return full;
  });
  check("facets · the answer sits above the control, as chips", () => {
    if (full.indexOf("um-chips") < 0) throw new Error("no chip row");
    /* Keys are stored; labels are shown. A chip reading `interior_designer` is
       the bug this catches. */
    if (full.indexOf("interior_designer") >= 0) throw new Error("a raw key is on screen");
    if (full.indexOf("Interior designer") < 0) throw new Error("no resolved label");
    return full;
  });
  check("facets · chips are removable", () => {
    if (full.indexOf("Remove Interior designer") < 0) throw new Error("no labelled remove control");
    return full;
  });
  check("facets · the cap is stated, not just enforced", () => {
    /* Read from the profile rather than written down here: a hard-coded 3/6
       would break the day somebody edits the seed, which is a test failing for
       a reason that is not a bug. A cap somebody only ever meets by being
       refused is a cap they experience as a bug. */
    const segs = rowOf("IB-U-0912").user.profile.segments.length;
    const want = ">" + segs + "/6<";
    if (full.indexOf(want) < 0) throw new Error("no counter reading " + want);
    return full;
  });
  check("facets · a stored single arrives selected, or as a chip with Change", () => {
    /* Business type is a plain select now — its stored answer arrives as the
       selected option. The picker-rendered singles (each area row's state)
       still collapse to a chip plus Change. */
    if (full.indexOf('selected=""') < 0) throw new Error("the stored type is not selected");
    if (full.indexOf(">Change<") < 0) throw new Error("no collapsed single offers Change");
    return full;
  });
  /* The listbox exists only while it is open, and there is no browser here to
     open it — so what the OPTIONS look like (their hints, their group
     headings) is asserted in check:users against the vocabulary they are built
     from. What is assertable here is that a closed picker is genuinely closed:
     a listbox left in the tree would sit over the field below it. */
  check("facets · a closed picker leaves no listbox in the tree", () => {
    if (empty.indexOf('role="listbox"') >= 0)
      throw new Error("a closed picker still rendered its options");
    return empty;
  });
  check("facets · guidance is placeholders and counters, not paragraphs", () => {
    /* The declutter pass: placeholders and the n/max counters carry the
       guidance now, and no field-level hint sentence renders at all. */
    if (empty.indexOf("Type a phrase, or pick a suggestion") < 0)
      throw new Error("the keyword field lost its placeholder");
    const withHints = fieldsFor(memberRow).filter((f) => f.hint).map((f) => f.key);
    if (withHints.length)
      throw new Error("hint sentences crept back onto: " + withHints.join(", "));
    return empty;
  });
  check("facets · the open/closed split is exactly where it was decided", () => {
    /* The three the marketplace FILTERS AND RANKS on must stay closed, or the
       facet fragments. The three that are sets nobody can enumerate must stay
       open, or the form cannot record the truth. This is the one assertion
       that would catch somebody "fixing" a facet by loosening it. */
    const all = fieldsFor(memberRow);
    const isOpen = (k: string) => {
      const f = all.filter((x) => x.key === k)[0];
      if (!f) throw new Error("no field " + k);
      return f.type === "tags" || f.open === true;
    };
    ["businessType"].forEach((k) => {
      if (isOpen(k)) throw new Error(k + " has been opened up");
    });
    /* Segments and Categories moved to the open side by request — trades
       and industries are sets nobody can finish enumerating either. Business
       type stays closed: it is one answer from a chain of six. */
    ["searchKeywords", "categories", "segments"].forEach((k) => {
      if (!isOpen(k)) throw new Error(k + " has been closed off");
    });
    /* Target areas holds the split WITHIN itself now: a closed state half and
       an open city half per row. Asserted against validateFacets because the
       schema field's own `open` flag no longer tells that story. */
    if (validateFacets({ targetAreas: [{ state: "Atlantis", cities: ["X"] }] } as never) === "")
      throw new Error("the state half of a row has been opened up");
    if (validateFacets({ targetAreas: [{ state: "Karnataka", cities: ["Chikkaballapur"] }] } as never) !== "")
      throw new Error("the city half of a row has been closed off");
    return empty;
  });
  check("business type · a plain dropdown, its meanings behind the i", () => {
    /* The hint sentence left the field and the option rows — that is the
       simplification — and the i button is where it went. Absence asserted
       on the flow, presence on the vocabulary (check:users) and the button. */
    if (full.indexOf("What kind of business this is") >= 0)
      throw new Error("the field hint is still under the control");
    if (full.indexOf("Authorised to sell named brands") >= 0)
      throw new Error("option hints are still inline in the flow");
    if (full.indexOf(">Manufacturer<") < 0)
      throw new Error("the dropdown lost its options");
    if (full.indexOf(">Service provider<") >= 0)
      throw new Error("Service provider is still on offer");
    /* The dropdown keeps the vocabulary's chain order, practitioner first:
       who works alone, designs, builds, then sells, moves, makes. Asserted on
       the markup, since a sort() anywhere between the schema and the
       <option>s would silently alphabetise it. */
    const at_ = (t) => full.indexOf(">" + t + "<");
    const order = ["Independent professional", "Firm / Studio", "Contractor",
      "Retailer / Showroom", "Wholesaler / Trader", "Dealer / Distributor", "Manufacturer"].map(at_);
    if (order.some((i) => i < 0)) throw new Error("a type is missing from the dropdown");
    if (order.some((i, k) => k > 0 && i < order[k - 1]))
      throw new Error("the dropdown is not in chain order");
    /* The i sits in the label row, right of the label, inside the same span. */
    const lb = full.indexOf(">Business type");
    const iAt = full.indexOf('class="um-info-b"', lb);
    const ctrl = full.indexOf('class="selectbox', lb);
    if (lb < 0 || iAt < 0 || iAt > ctrl) throw new Error("the i is not right of the Business type label");
    /* No visibility chip on any input — the record's profile tab still marks
       public/internal, the form does not. */
    if (full.indexOf("um-vis") >= 0) throw new Error("a public/internal chip is still on the form");
    /* And the panel's opening sentence is in the schema, not the flow. */
    if (full.indexOf("What kind of business this is") >= 0)
      throw new Error("the description is back in the flow");
    const infos = (full.match(/class="um-info-b"/g) || []).length;
    if (infos < 1) throw new Error("no i button on Business type");
    return full;
  });
  check("one business group: name, address, about lead it; no Display name", () => {
    const order = [">Business name", ">Username", ">Business type", ">Location", ">Positioning", ">About"]
      .map((t) => full.indexOf(t));
    if (order.some((i) => i < 0)) throw new Error("a field is missing");
    if (order.some((i, k) => k > 0 && i < order[k - 1])) throw new Error("the form is out of order");
    /* About closes the form: nothing but the identity summary follows it. */
    if (full.indexOf(">About") > full.indexOf(">Identity")) throw new Error("About is not last");
    if (full.indexOf(">Display name") >= 0) throw new Error("Display name survives");
    if (full.indexOf(">Basic profile<") >= 0) throw new Error("an empty Basic profile group renders");
    return full;
  });
  check("business name takes the row, so Business type sits beneath it", () => {
    const i = full.indexOf(">Business name");
    const fg = full.lastIndexOf('<div class="fg', i);
    if (full.slice(fg, i).indexOf("um-fg-wide") < 0) throw new Error("Business name is half-width");
    if (full.indexOf(">Business type") < i) throw new Error("Business type is not after Business name");
    /* And Deals in sits beneath Business type, which takes its own row. */
    const bt = full.indexOf(">Business type");
    const btFg = full.lastIndexOf('<div class="fg', bt);
    if (full.slice(btFg, bt).indexOf("um-fg-wide") < 0) throw new Error("Business type is half-width");
    if (full.indexOf(">Deals in") < bt) throw new Error("Deals in is not after Business type");
    return full;
  });
  check("deals in · two checkboxes, one or both", () => {
    const boxes = (full.match(/type="checkbox"/g) || []).length;
    if (boxes !== 5) throw new Error(boxes + " checkboxes, expected 2 deals + 3 positioning");
    if (full.indexOf(">Products<") < 0 || full.indexOf(">Services<") < 0)
      throw new Error("the two options are not Products and Services");
    /* IB-U-0912 deals in services — the seeded answer must arrive checked. */
    if (full.indexOf('checked=""') < 0) throw new Error("the stored answer is not checked");
    return full;
  });

  check("positioning: three tiles on one row, the cap stated, two ticked at most", () => {
    ["Luxury", "Budget-friendly", "Custom"].forEach((t) => {
      if (full.indexOf(">" + t + "<") < 0) throw new Error("missing " + t);
    });
    if (full.indexOf("Select up to 2.") < 0) throw new Error("the cap is not stated");
    /* IB-U-0912 holds two, so the third renders disabled: the cap is
       enforced by what can still be pressed. */
    const off = (full.match(/um-check off/g) || []).length;
    if (off !== 1) throw new Error(off + " tiles went quiet at the cap, expected 1");
    if (full.indexOf(">Eco-friendly<") >= 0) throw new Error("a removed tile is still on offer");
    /* One row: the field takes the full width, so four tiles never wrap. */
    const pos = full.indexOf(">Positioning");
    const fg = full.lastIndexOf('<div class="fg', pos);
    if (full.slice(fg, pos).indexOf("um-fg-wide") < 0) throw new Error("positioning is half-width");
    if (full.indexOf(">Premium<") >= 0 || full.indexOf(">Value<") >= 0)
      throw new Error("a removed tile is still on offer");
    return full;
  });

  /* ------------------------------------------- the username and the URL --- */
  check("username · the field is an address, not a text box", () => {
    /* The host is in the control, the URL is spelled out under it, and the
       rules are stated before anybody trips over them. */
    if (full.indexOf("um-handle") < 0) throw new Error("no handle control");
    if (full.indexOf("um-handle-pre") < 0) throw new Error("the host is not in the box");
    if (full.indexOf("/pro/") < 0) throw new Error("no profile path");
    if (full.indexOf("meera-studio-interiors") < 0) throw new Error("the seeded handle is missing");
    return full;
  });
  check("username · availability is answered before you press Save", () => {
    if (full.indexOf("Available") < 0) throw new Error("a free handle says nothing");
    /* Live only when it is the STORED value — typing a valid handle does not
       put a page on the internet, and the copy button must not imply it has. */
    if (full.indexOf("this link is live") < 0) throw new Error("a saved handle is not marked live");
    if (full.indexOf("Copy link") < 0) throw new Error("no way to copy the link");
    return full;
  });
  check("username · an empty one is offered the business name", () => {
    /* IB-U-1029 has neither, so the rules show instead of a suggestion. */
    if (empty.indexOf("Copy link") >= 0)
      throw new Error("offered a link to a profile that does not exist");
    return empty;
  });
  check("username · a taken handle is refused, and by the store too", () => {
    if (!usernameTaken("meera-studio-interiors")) throw new Error("uniqueness is not checked");
    if (usernameTaken("meera-studio-interiors", "IB-U-0912"))
      throw new Error("a profile is told its own handle is taken");
    return full;
  });
  check("username · the record links to it rather than printing it", () => {
    const rec = at("/users/IB-U-0912?tab=profile");
    if (rec.indexOf("um-profile-link") < 0) throw new Error("the record printed a string");
    if (rec.indexOf("/pro/meera-studio-interiors") < 0) throw new Error("no href to the profile");
    return rec;
  });

  /* -------------------------------------------- conditional and removed --- */
  check("target areas · everyone is asked, because it is the location now", () => {
    /* It was member-only while it sat beside a registered address. The
       address is gone; a plain user with no coverage row is invisible to
       every location filter, and the form is where that gets fixed. */
    if (full.indexOf(">Location") < 0) throw new Error("a member was not asked");
    if (empty.indexOf(">Location") < 0) throw new Error("a plain user was not asked");
    if (full.indexOf(">Target<") < 0) throw new Error("the group is not called Target");
    if (empty.indexOf("No areas yet") < 0)
      throw new Error("an empty coverage list says nothing");
    return full;
  });
  check("target areas · a row is a tile: closed state, open cities, removable", () => {
    if (full.indexOf("um-area") < 0) throw new Error("no row tiles");
    /* The remove control names what it takes with it — a bare × on a
       two-picker tile does not say the cities go too. */
    if (full.indexOf("and its cities") < 0) throw new Error("the remove control does not say its scope");
    if (full.indexOf("Add state") < 0) throw new Error("no way to add a row");
    return full;
  });
  check("target areas · All cities renders as the row's one chip", () => {
    const rec = at("/users/IB-U-0944?tab=profile");
    if (rec.indexOf(">All cities<") < 0) throw new Error("the whole-state claim is not on the record");
    return rec;
  });
  check("target areas · a locality survives as a city under its state", () => {
    /* "Uttam Nagar, Delhi" the string became Delhi → Uttam Nagar the row —
       same claim, now in a shape a filter can read. */
    const rec = at("/users/IB-U-0921?tab=profile");
    if (rec.indexOf("Uttam Nagar") < 0) throw new Error("the locality did not survive");
    if (rec.indexOf("Delhi") < 0) throw new Error("its state is not beside it");
    return rec;
  });
  check("the removed fields are gone from every surface", () => {
    const rec = at("/users/IB-U-0912?tab=profile");
    ["Portfolio link", "Locality", "Contact address"].forEach((label) => {
      if (full.indexOf(">" + label) >= 0) throw new Error(label + " survives on the form");
      if (rec.indexOf(">" + label) >= 0) throw new Error(label + " survives on the record");
    });
    return full;
  });
  check("...and the contact group is exactly the coverage field", () => {
    const contact = fieldsFor(memberRow).filter((f) => f.group === "contact").map((f) => f.key);
    if (contact.join(",") !== "targetAreas")
      throw new Error("the contact group reads " + contact.join(", "));
    if (full.indexOf(">Pincode") >= 0) throw new Error("Pincode survives on the form");
    return full;
  });

  check("chips · each facet wears its declared tone wherever chips render", () => {
    /* The colour is information — "which question is this the answer to" —
       and it has to actually reach the markup: a tone the component forgets
       to append falls back to brand tint with no error anywhere. The record
       always renders chips; the form only where the control IS a chip
       control — a simple select and a checkbox pair show their value as
       themselves. */
    const rec = at("/users/IB-U-0912?tab=profile");
    fieldsFor(memberRow).filter((f) => f.chip).forEach((f) => {
      const want = "um-chip " + f.chip;
      if (rec.indexOf(want) < 0) throw new Error(f.key + " chips lost " + f.chip + " on the record");
      const formChips = ["multi", "tags", "areas"].indexOf(f.type) >= 0;
      if (formChips && full.indexOf(want) < 0)
        throw new Error(f.key + " chips lost " + f.chip + " on the form");
    });
    return full;
  });
  check("chips · a stale value wears warn, never a facet's tone", () => {
    /* The Chips component swaps the tone out entirely when a value is stale —
       asserted at the source since no seed row carries a dropped key. */
    const src = String(Chips);
    if (src.indexOf('stale ? "warn"') < 0)
      throw new Error("the stale branch no longer displaces the tone");
    return full;
  });

  check("facets · the record shows them as chips too, not as a comma list", () => {
    const rec = at("/users/IB-U-0912?tab=profile");
    if (rec.indexOf("um-chips ro") < 0) throw new Error("record fell back to text");
    if (rec.indexOf("interior_designer") >= 0) throw new Error("a raw key is on the record");
    if (rec.indexOf("Home decor") < 0) throw new Error("categories missing from the record");
    return rec;
  });
}
check("note", () => modal(<NoteModal row={rowOf("IB-U-0912")} onClose={noop} onDone={noop} />));
check("tags", () => modal(<TagsModal row={rowOf("IB-U-0912")} onClose={noop} onDone={noop} />));
check("deactivate", () => modal(
  <DeactivateModal row={rowOf("IB-U-0912")} onClose={noop} onDone={noop} />));
check("reactivate", () => modal(
  <DeactivateModal row={rowOf("IB-U-0601")} onClose={noop} onDone={noop} />));

(["activate", "pause", "resume", "suspend", "reactivate", "cancel", "renew"] as LifecycleAction[])
  .forEach((a) => {
    const r = rowOf(a === "activate" ? "IB-U-0958" : a === "resume" ? "IB-U-0834"
      : a === "reactivate" ? "IB-U-0790" : "IB-U-0912");
    check("lifecycle · " + a, () => modal(
      <LifecycleModal m={r.current!} row={r} action={a} onClose={noop} onDone={noop} />));
  });

console.log(failed ? "\n" + failed + " FAILED\n" : "\nevery surface rendered\n");
process.exit(failed ? 1 : 0);
