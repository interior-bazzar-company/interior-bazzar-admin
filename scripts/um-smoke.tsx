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
import { Chips } from "../src/admin/views/Users/FacetPicker";
import EditProfile from "../src/admin/views/Users/EditProfile";
import { NoteModal, TagsModal, DeactivateModal } from "../src/admin/views/Users/Modals";
import {
  PROFILE_FIELDS, countsOf, readUsers, toRow, usernameTaken, validateFacets,
} from "../src/admin/views/Users/store";

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

/* One argument now: the row is the user plus what is derived from the user,
   and there is no second source to hand it. */
const rowOf = (id: string) => toRow(readUsers().filter((x) => x.userId === id)[0]);

/* TWO FACES AND ONE RECORD. Members and Renewals went with the membership
   feature; `?tab=` names a face of the record and Profile is the default, so
   `/users/:id` and `/users/:id?tab=profile` are the same screen. The stale
   addresses are here on purpose — an old bookmark has to land somewhere
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
  ["analytics (default 6m)", "/users?view=analytics"],
  ["analytics · 3-month range", "/users?view=analytics&start=2026-06&end=2026-08"],
  ["analytics · 12-month range", "/users?view=analytics&start=2025-09&end=2026-08"],
  ["analytics · single month", "/users?view=analytics&start=2026-08&end=2026-08"],
  ["analytics · reversed range", "/users?view=analytics&start=2026-08&end=2026-03"],
  ["analytics · out-of-bounds range", "/users?view=analytics&start=2019-01&end=2099-12"],
  ["analytics · oldest span, no prior", "/users?view=analytics&start=2025-09&end=2025-11"],
  ["record · defaults to the profile", "/users/IB-U-0912"],
  ["record · profile, named", "/users/IB-U-0912?tab=profile"],
  ["record · an incomplete profile", "/users/IB-U-1029"],
  ["record · a deactivated account", "/users/IB-U-0601"],
  ["record · a whole-state coverage row", "/users/IB-U-0944"],
  ["record · a locality under its state", "/users/IB-U-0921"],
  ["record · a Finance customer with no history", "/users/IB-U-1200"],
  ["record · commercial", "/users/IB-U-0912?tab=commercial"],
  ["record · commercial with nothing linked", "/users/IB-U-1029?tab=commercial"],
  ["record · notes", "/users/IB-U-0912?tab=notes"],
  ["record · notes (empty)", "/users/IB-U-0944?tab=notes"],
  ["record · audit", "/users/IB-U-0912?tab=audit"],
  ["record · audit (empty)", "/users/IB-U-1200?tab=audit"],
  ["record · a stale membership tab", "/users/IB-U-0912?tab=history&term=IB-MB-0912-2"],
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

/* THE STRIP, THE BAND AND THE VOCABULARY.
   Worth asserting because all three are the kind of thing that rots silently: a
   renamed cell still renders, a count wired to the wrong set still shows a
   number, and neither breaks a build. The classification vocabulary in
   particular is on screen in four places at once.

   NOT COVERED HERE: the two topbar chips. They reach the shell through
   usePageChrome, which sets them in a useEffect, and renderToStaticMarkup does
   not run effects — so the topbar is empty in this harness by construction,
   not by oversight. Those two need a browser. */
console.log("\nthe strip, and the whole it is a breakdown of");
{
  const users = at("/users");
  const cells = (h: string) => (h.match(/class="k">([^<]+)</g) || [])
    .map((m) => m.replace('class="k">', "").replace("<", ""));
  const c = countsOf(readUsers().map(toRow));

  check("the strip is Total, then the parts it divides into", () => {
    if (cells(users).join(" · ") !== "Total · Active · Deactivated · Incomplete") {
      throw new Error("the strip reads " + cells(users).join(" · "));
    }
    return users;
  });
  check("...and each cell states its own count", () => {
    /* Read from the derivation rather than written down, so seven more
       registrations is not a test failure. */
    [c.total, c.active, c.deactivated, c.incompleteProfiles].forEach((n, i) => {
      if (users.indexOf('<span class="v tnum">' + n + "</span>") < 0) {
        throw new Error("cell " + i + " does not print " + n);
      }
    });
    return users;
  });
  check("...Total is the stated whole and does not follow the filter down", () => {
    const narrowed = at("/users?flag=incomplete");
    if (narrowed.indexOf('<span class="v tnum">' + c.total + "</span>") < 0) {
      throw new Error("Total followed the filter");
    }
    /* And the narrowing really happened — otherwise the line above proves
       nothing. The pager states the filtered total. */
    if (narrowed.indexOf("Nothing matches") >= 0) throw new Error("the filter matched nobody at all");
    if (narrowed.split("<tr").length - 1 >= users.split("<tr").length - 1) {
      throw new Error("flag=incomplete did not narrow the table");
    }
    return narrowed;
  });
  check("every cell opens the list it counts", () => {
    ["#/users?status=active", "#/users?status=deactivated", "#/users?flag=incomplete"]
      .forEach((h) => {
        if (users.indexOf('data-go="' + h + '"') < 0) throw new Error("no cell links to " + h);
      });
    return users;
  });
  check("...and each one says what it counts, in the tooltip rather than in the label", () => {
    const tips = (users.match(/class="dls-tip"[^>]*>([^<]+)</g) || []);
    if (tips.length < 4) throw new Error("only " + tips.length + " cells explain themselves");
    return users;
  });
  check("the Active cell refuses to imply anything commercial", () => {
    if (users.indexOf("that is a Finance question") < 0) {
      throw new Error("Active no longer says what it does NOT mean");
    }
    return users;
  });
  check("every strip cell is sentence case", () => {
    const bad = cells(users).filter((k) => /^[a-z]/.test(k));
    if (bad.length) throw new Error("lower-case: " + bad.join(", "));
    return users;
  });
  check("the search box says what it searches", () => {
    ["Name", "email", "phone", "user ID", "business", "reference"].forEach((t) => {
      if (users.indexOf(t) < 0) throw new Error("the placeholder does not mention " + t);
    });
    return users;
  });
  check("the row rail is raised for the one thing somebody can go and fix", () => {
    /* A live account with an unfinished profile. A colour per state would turn
       the table into a paint chart nobody scans, so there is exactly one. */
    const n = (users.match(/<td class="rail"><i class="warn">/g) || []).length;
    if (!n) throw new Error("no row is flagged at all");
    const onPage = at("/users?flag=incomplete&status=active");
    const want = (onPage.match(/<td class="rail"><i class="warn">/g) || []).length;
    if (n !== want) throw new Error(n + " flagged rows, but the filter finds " + want);
    return users;
  });
  check("a deactivated row is dimmed rather than hidden", () => {
    const dead = at("/users?status=deactivated");
    if (dead.indexOf('class="clickable dim"') < 0) throw new Error("no dimmed row");
    if (dead.indexOf('<i class="warn">') >= 0) {
      throw new Error("a disabled account is being raised as work to do");
    }
    return dead;
  });
}

console.log("\nthe vocabulary on screen is the two-answer one");
{
  const users = at("/users");
  const analytics = at("/users?view=analytics");
  const rec = at("/users/IB-U-0912");
  const dead = at("/users/IB-U-0601");
  const surfaces: [string, string][] = [
    ["the users list", users], ["analytics", analytics],
    ["a live record", rec], ["a deactivated record", dead],
  ];

  check("the two classifications are the ones rendered", () => {
    if (rec.indexOf(">Active<") < 0) throw new Error("no Active pill on a live record");
    if (dead.indexOf(">Deactivated<") < 0) throw new Error("no Deactivated pill on a disabled one");
    if (rec.indexOf('class="dot c-active"') < 0) throw new Error("the pill lost its state dot");
    return rec;
  });
  /* THE ABSENCE IS THE HALF THAT GETS MISSED. Six labels used to be on these
     screens; every one of them left with the feature, and any that survives is
     two names for one thing. */
  check("no membership classification survives on any surface", () => {
    ["Normal User", "Active Member", "Past Member", "Former Member",
      "Paused member", "Suspended member"].forEach((t) => {
      surfaces.forEach(([where, html]) => {
        if (html.indexOf(t) >= 0) throw new Error("`" + t + "` survives on " + where);
      });
    });
    return users;
  });
  check("...nor the words the membership screens were built out of", () => {
    ["Expiring soon", "Renewals", "Entitlements", "Assign membership",
      "Terms", "Plan", "Renew"].forEach((t) => {
      surfaces.forEach(([where, html]) => {
        if (html.indexOf(">" + t + "<") >= 0) throw new Error("`" + t + "` survives on " + where);
      });
    });
    return users;
  });
  check("...and the screens that are gone are gone, not blank", () => {
    /* `?view=members` is not a face any more, so the param falls through to
       the directory — which is what a stale bookmark has to find. */
    const members = at("/users?view=members");
    if (members.indexOf("um-tbl") < 0) throw new Error("a stale view param renders no list");
    if (members.indexOf('class="k">Total<') < 0) throw new Error("...and no strip either");
    return members;
  });
  check("the record says where the commercial relationship actually lives", () => {
    const comm = at("/users/IB-U-0912?tab=commercial");
    if (comm.indexOf("owns no money and no subscription") < 0) {
      throw new Error("the record no longer disclaims what it does not hold");
    }
    if (comm.indexOf("recorded in Finance") < 0) throw new Error("...or say where it is");
    return comm;
  });
}

console.log("\nthe view band is two faces, one figure and no argument");
{
  const users = at("/users");
  const analytics = at("/users?view=analytics");
  const c = countsOf(readUsers().map(toRow));
  const band = (h: string) => (h.match(/<i class="tnum">(\d+)<\/i>/g) || [])
    .map((m) => m.replace(/\D/g, ""));

  check("the band offers exactly Users and Analytics", () => {
    const nav = users.slice(users.indexOf('class="um-views"'), users.indexOf('class="dls-cmd"'));
    ["Users", "Analytics"].forEach((t) => {
      if (nav.indexOf("<span>" + t + "</span>") < 0) throw new Error("no " + t + " tab");
    });
    ["Members", "Renewals", "Overview"].forEach((t) => {
      if (nav.indexOf("<span>" + t + "</span>") >= 0) throw new Error(t + " is still a face");
    });
    if ((nav.match(/<button/g) || []).length !== 2) {
      throw new Error((nav.match(/<button/g) || []).length + " tabs, expected 2");
    }
    return nav;
  });
  check("Users carries the whole population as its figure", () => {
    if (band(users).join(",") !== String(c.total)) {
      throw new Error("the band reads [" + band(users).join(",") + "], expected " + c.total);
    }
    return users;
  });
  check("...the same figure on the other face", () => {
    if (band(analytics).join(",") !== band(users).join(",")) {
      throw new Error("the band disagrees on Analytics");
    }
    return analytics;
  });
  check("...and a search does not move it", () => {
    const searched = at("/users?q=sharma");
    if (band(searched).join(",") !== band(users).join(",")) {
      throw new Error("the band followed the search box");
    }
    /* And the search really narrowed, or the line above is worth nothing. */
    if (searched.split('class="clickable').length >= users.split('class="clickable').length) {
      throw new Error("the search did not narrow the table");
    }
    return searched;
  });
  check("the current face is marked for a screen reader, not only in colour", () => {
    if (users.indexOf('aria-current="page"') < 0) throw new Error("no aria-current on the band");
    return users;
  });
  check("Analytics offers the way back to the list it is a reading of", () => {
    if (analytics.indexOf("um-views") < 0) throw new Error("no band on Analytics");
    return analytics;
  });
}

/* The charts are the reason Analytics exists. Asserting each form actually
   reached the DOM — and on the right kind of colour token — is the difference
   between "the page loaded" and "the page has its content". The token classes
   are the assertion because they encode the colour JOB: `s1..s3` categorical,
   `o1..o3` ordinal, `st-*` reserved status. A chart that silently switched to
   the wrong job would still render, and would still be wrong. */
console.log("\nthe seven blocks, and the charts inside them");
{
  const html = at("/users?view=analytics");

  check("the page is seven cards, and no loose stack", () => {
    const n = (html.match(/class="card um-block/g) || []).length;
    if (n !== 7) throw new Error(n + " blocks, expected 7");
    if (html.indexOf("um-blocks") < 0) throw new Error("no two-up grid");
    return html;
  });
  check("...titled as the questions they answer", () => {
    const titles = (html.match(/<h3>([^<]+)<\/h3>/g) || []).map((m) => m.slice(4, -5));
    const want = ["The base", "How the base grew", "Registered to a usable profile",
      "Where they come from", "How they use it", "Just happened", "Definitions"];
    if (titles.join(" | ") !== want.join(" | ")) {
      throw new Error("the page reads: " + titles.join(" | "));
    }
    return html;
  });
  check("...with the three that need the width opted out of the two-up grid", () => {
    const wide = (html.match(/class="card um-block wide"/g) || []).length;
    if (wide !== 3) throw new Error(wide + " wide blocks, expected 3");
    /* The base, the growth chart and the definitions table — a two-up column
       cannot hold a four-tile row, a twelve-month chart or a four-column
       table without wrapping something that should not wrap. */
    ["The base", "How the base grew", "Definitions"].forEach((t) => {
      const i = html.indexOf("<h3>" + t + "</h3>");
      if (html.lastIndexOf('class="card um-block wide"', i) < html.lastIndexOf('class="card um-block"', i)) {
        throw new Error(t + " is not the wide kind");
      }
    });
    return html;
  });
  check("every block says what it counts, under its own title", () => {
    const descs = (html.match(/<span class="d">/g) || []).length;
    if (descs < 6) throw new Error("only " + descs + " blocks state their unit");
    return html;
  });

  const must: [string, string][] = [
    ["growth columns, on categorical slot 1", "ch-col s1"],
    ["...and the second series beside it", "ch-col s2"],
    ["...its legend", "ch-legend2"],
    ["...axis ticks", "ch-yaxis"],
    ["...hover and focus tooltip", "ch-tip"],
    ["the funnel on the ordinal ramp", "fill o1"],
    ["...both of its stages", "fill o2"],
    ["source bars on one hue, not a value ramp", "fill s1"],
  ];
  must.forEach(([label, needle]) =>
    check(label, () => {
      if (html.indexOf(needle) < 0) throw new Error("missing " + needle);
      return html;
    }));
  check("two series, so there is no third colour on the chart", () => {
    /* GROWTH is registrations and completed profiles. A third slot appearing
       means a series was added without deciding what colour job it has. */
    if (html.indexOf("ch-col s3") >= 0) throw new Error("a third series appeared");
    return html;
  });
  check("the charts that asked a commercial question are gone, not emptied", () => {
    /* Plan mix took the tier ramp, status bars the reserved status tokens and
       cohort retention the heatmap. All three asked about a membership. */
    [["plan mix (tier ramp)", "fill o3"], ["status bars", "fill st-"],
      ["cohort heatmap", "ch-cell"], ["...and its scale key", "ch-heatkey"]]
      .forEach(([what, needle]) => {
        if (html.indexOf(needle) >= 0) throw new Error(what + " is still on the page");
      });
    return html;
  });
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
    if (pcts.length < 10) throw new Error("only " + pcts.length + " marks — nothing to check");
    const bad = pcts.filter((v) => v < 0 || v > 100);
    if (bad.length) throw new Error(bad.length + " out of range, e.g. " + bad[0] + "%");
    return html;
  });
  check("something actually reached full width", () => {
    if (!pcts.some((v) => v > 95)) throw new Error("no mark near 100% — the scale is not tight");
    return html;
  });
  check("exactly one direct label on the column chart", () => {
    const n = (html.match(/class="ch-col s\d" style="[^"]*"><em/g) || []).length;
    if (n !== 1) throw new Error("expected 1 direct label, found " + n);
    return html;
  });
  check("axis ticks and gridlines are the same count", () => {
    const ticks = (html.match(/class="tnum" style="top:/g) || []).length;
    const rules = (html.match(/class="ch-rule"/g) || []).length;
    if (!ticks || ticks !== rules) throw new Error(ticks + " ticks vs " + rules + " rules");
    return html;
  });
  check("x labels match the column groups", () => {
    const groups = (html.match(/class="ch-group"/g) || []).length;
    const labels = (html.match(/class="ch-xband"[\s\S]*?<\/div>/) || [""])[0]
      .split("<span").length - 1;
    if (groups !== labels) throw new Error(groups + " groups vs " + labels + " labels");
    return html;
  });
  check("...and there is one column group per month in the range", () => {
    const groups = (html.match(/class="ch-group"/g) || []).length;
    if (groups !== 6) throw new Error(groups + " groups on the default six-month range");
    const twelve = at("/users?view=analytics&start=2025-09&end=2026-08");
    if ((twelve.match(/class="ch-group"/g) || []).length !== 12) {
      throw new Error("a twelve-month range did not draw twelve groups");
    }
    return html;
  });
}

console.log("\nthe base block reads the same derivation the list does");
{
  const html = at("/users?view=analytics");
  const c = countsOf(readUsers().map(toRow));
  check("its four tiles are the strip's four cells", () => {
    ["Total registered", "Active accounts", "Deactivated", "Incomplete profiles"].forEach((t) => {
      if (html.indexOf('class="k">' + t + "<") < 0) throw new Error("no " + t + " tile");
    });
    return html;
  });
  check("...carrying the same numbers, because it is the same countsOf", () => {
    [c.total, c.active, c.deactivated, c.incompleteProfiles].forEach((n) => {
      if (html.indexOf(">" + n + "<") < 0) throw new Error("the tile row does not print " + n);
    });
    return html;
  });
  check("...and each one opens the list behind it", () => {
    ["#/users?status=active", "#/users?status=deactivated", "#/users?flag=incomplete"]
      .forEach((h) => {
        if (html.indexOf(h) < 0) throw new Error("no tile links to " + h);
      });
    return html;
  });
  check("the footnote says these are derived, and says what they do not mean", () => {
    if (html.indexOf("derived from the account") < 0) throw new Error("no derivation note");
    if (html.indexOf("whether\n            somebody is paying") < 0
      && html.indexOf("somebody is paying") < 0) throw new Error("no commercial disclaimer");
    return html;
  });
  check("the definitions table is still the page's contract with its reader", () => {
    if (html.indexOf("um-defs") < 0) throw new Error("no definitions table");
    ["Metric", "Unit", "Definition", "Easy to get wrong"].forEach((t) => {
      if (html.indexOf("<th>" + t + "</th>") < 0) throw new Error("no " + t + " column");
    });
    return html;
  });
  check("...and it names where the commercial metrics went", () => {
    ["Conversion to a paid plan", "renewal rate", "churn", "cohort retention"].forEach((t) => {
      if (html.indexOf(t) < 0) throw new Error("the moved-metrics notice does not mention " + t);
    });
    if (html.indexOf("in Finance") < 0) throw new Error("...or say where they went");
    return html;
  });
  check("engagement is stated as unavailable, never as zero", () => {
    if (html.indexOf("Unavailable, not zero") < 0) throw new Error("no unavailable state");
    if (html.indexOf("UM-OD-10") < 0) throw new Error("the blocking decision is not named");
    return html;
  });
  check("the recent-activity block renders real events with real names", () => {
    if (html.indexOf("um-evlist") < 0) throw new Error("no event list");
    const rows = (html.match(/class="um-ev"/g) || []).length;
    if (rows < 3) throw new Error("only " + rows + " events");
    if (html.indexOf('class="ty"') < 0 && html.indexOf('class="ty sys"') < 0) {
      throw new Error("events render without a type label");
    }
    /* A raw event key on screen means the vocabulary lost an entry. */
    if (html.indexOf(">PROFILE_UPDATED<") >= 0 || html.indexOf(">REGISTERED<") >= 0) {
      throw new Error("a raw event key is rendering as its own label");
    }
    return html;
  });
}

console.log("\nthe range control moves the numbers it sits above");
{
  const html = at("/users?view=analytics");
  check("the range picker is on the command row", () => {
    if (html.indexOf("um-daterange") < 0) throw new Error("no range control");
    return html;
  });
  check("...and says how long the span is and what it is against", () => {
    if (html.indexOf("um-against") < 0) throw new Error("no span statement");
    if (html.indexOf("months") < 0) throw new Error("the span does not state its length");
    return html;
  });
  /* A control that renders and changes nothing is worse than no control — it
     invites a decision on a figure that never re-cut. */
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
    /* And a span that DOES have one says so instead — otherwise the line
       above would pass on a page that never mentions comparison at all. */
    if (html.indexOf("no prior span") >= 0) throw new Error("the default span claims no prior");
    if (html.indexOf("against the") < 0) throw new Error("...and does not state its comparison");
    return oldest;
  });
  check("the range lives in the URL, so a narrowed dashboard is a link", () => {
    const a = at("/users?view=analytics&start=2026-06&end=2026-08");
    const b = at("/users?view=analytics&start=2026-06&end=2026-08");
    if (a !== b) throw new Error("the same address rendered two different pages");
    return a;
  });
  check("...under start/end, because the list already owns from/to", () => {
    /* One click from a narrowed list carries `from`/`to` across; if this
       control read those it would take two ISO dates and mean something
       entirely different by them. */
    const carried = at("/users?view=analytics&from=2026-01-01&to=2026-08-01");
    if (carried !== html) throw new Error("the range control is reading from/to");
    return carried;
  });
}

console.log("\nthe record: one workspace, four tabs, and no membership among them");
{
  const rec = at("/users/IB-U-0912");
  check("the tabs are Profile, Commercial, Notes & tags and Audit", () => {
    const strip = rec.slice(rec.indexOf('class="tabs"'), rec.indexOf('class="um-cards"'));
    ["Profile", "Commercial", "Notes &amp; tags", "Audit"].forEach((t) => {
      if (strip.indexOf(">" + t) < 0) throw new Error("no " + t + " tab");
    });
    if ((strip.match(/<button/g) || []).length !== 4) {
      throw new Error((strip.match(/<button/g) || []).length + " tabs, expected 4");
    }
    ["Membership", "History", "Terms"].forEach((t) => {
      if (strip.indexOf(">" + t) >= 0) throw new Error(t + " is still a tab");
    });
    return strip;
  });
  check("Profile is the default, so /users/:id and ?tab=profile are one screen", () => {
    if (rec !== at("/users/IB-U-0912?tab=profile")) {
      throw new Error("the bare record and ?tab=profile render differently");
    }
    if (rec.indexOf('class="on">Profile') < 0) throw new Error("Profile is not the selected tab");
    return rec;
  });
  check("a stale ?tab=history lands on the record rather than on nothing", () => {
    const stale = at("/users/IB-U-0912?tab=history&term=IB-MB-0912-2");
    if (stale.indexOf("um-idbar") < 0) throw new Error("the id bar did not render");
    if (stale.indexOf("IB-MB-0912-2") >= 0) throw new Error("a term id is on screen");
    return stale;
  });
  check("the id bar carries the identity, the classification and the tags", () => {
    if (rec.indexOf("<h2>Meera Studio Interiors</h2>") < 0) throw new Error("no name");
    if (rec.indexOf("um-cls") < 0) throw new Error("no classification pill");
    if (rec.indexOf("um-tags") < 0) throw new Error("no tag chips");
    return rec;
  });
  check("the subline is what you read out on a call", () => {
    ["IB-U-0912", "meera@meerastudio-example.in", "+91 98450 11902", "Bengaluru", "registered"]
      .forEach((t) => {
        if (rec.indexOf(t) < 0) throw new Error("the subline is missing " + t);
      });
    return rec;
  });
  check("a deactivated account says so twice, and says why", () => {
    const dead = at("/users/IB-U-0601");
    if (dead.indexOf(">Deactivated<") < 0) throw new Error("no classification pill");
    if (dead.indexOf(">Account off<") < 0) throw new Error("no account badge");
    if (dead.indexOf('title="Internal / demo account"') < 0) throw new Error("the reason is not carried");
    return dead;
  });
  /* THE BUTTON IS JUST `Back` NOW, panel-wide: every record page in the panel
     ends its header row with one primary Back, and a label that changed with
     the face it would return to — `All users`, `Analytics` — was the odd one
     out. Where it goes is unchanged: the list you came from, filters and all.

     WHAT THIS CAN HONESTLY ASSERT is that the control is there and is the
     row's one primary. The destination rides on an onClick, not an href, so
     a static render cannot see it — pretending otherwise is what the old
     assertion did by reading the label. */
  check("the record ends its header row with one primary Back", () => {
    const fromFiltered = at("/users/IB-U-0912?status=active&city=Bengaluru");
    if (fromFiltered.indexOf("Back</button>") < 0) throw new Error("no way back");
    if (fromFiltered.indexOf('class="btn sm pri"') < 0) throw new Error("Back is not the row's primary");
    return fromFiltered;
  });
  check("...and from Analytics just the same", () => {
    const fromAnalytics = at("/users/IB-U-0912?view=analytics");
    if (fromAnalytics.indexOf("Back</button>") < 0) throw new Error("no way back from analytics");
    return fromAnalytics;
  });
  check("a missing record is an empty state, not a crash or a blank", () => {
    const gone = at("/users/IB-U-NOPE");
    if (gone.indexOf("No user at that address") < 0) throw new Error("no empty state");
    if (gone.indexOf("IB-U-NOPE") < 0) throw new Error("...that does not name the address");
    if (gone.indexOf("Back to the directory") < 0) throw new Error("...and offers no way out");
    return gone;
  });
  check("every profile field in the schema reaches the record", () => {
    PROFILE_FIELDS.forEach((f) => {
      if (rec.indexOf("<dt>" + f.label + "</dt>") < 0) throw new Error("no row for " + f.label);
    });
    return rec;
  });
  check("...and the record is built from the schema, not from a written list", () => {
    const rows = (rec.match(/<dt>/g) || []).length;
    /* Business profile plus the six read-only identity rows. A row count that
       drifts from the schema means somebody hand-wrote one. */
    if (rows !== PROFILE_FIELDS.length + 6) {
      throw new Error(rows + " rows, expected " + (PROFILE_FIELDS.length + 6));
    }
    return rec;
  });
  check("the commercial tab links out rather than restating", () => {
    const comm = at("/users/IB-U-0912?tab=commercial");
    if (comm.indexOf('data-go="#/deals/DL-1042"') < 0) throw new Error("no deal link");
    if (comm.indexOf('data-go="#/invoices/INV-2024-0210"') < 0) throw new Error("no invoice link");
    /* References, never amounts. A rupee figure here would be this module
       quoting a number another one owns. */
    if (comm.indexOf("₹") >= 0) throw new Error("an amount is on the commercial tab");
    return comm;
  });
  check("...and an account with nothing linked says nothing rather than zero", () => {
    const empty = at("/users/IB-U-1029?tab=commercial");
    if (empty.indexOf("Sales owner") < 0) throw new Error("the card did not render");
    if (empty.indexOf("data-go=\"#/deals/") >= 0) throw new Error("invented a link");
    return empty;
  });
  check("the notes tab is tags and notes, and says neither reaches a customer", () => {
    const notes = at("/users/IB-U-0912?tab=notes");
    if (notes.indexOf("Internal notes") < 0) throw new Error("no notes card");
    if (notes.indexOf("append-only") < 0) throw new Error("the guarantee is not stated");
    if (notes.indexOf("Never customer-visible") < 0) throw new Error("the exclusion is not stated");
    return notes;
  });
  check("...and an account with no notes says so rather than rendering an empty box", () => {
    const none = at("/users/IB-U-0944?tab=notes");
    if (none.indexOf("Nothing recorded yet") < 0) throw new Error("no empty state for notes");
    return none;
  });
  check("the audit tab renders the history it kept", () => {
    const audit = at("/users/IB-U-0912?tab=audit");
    if (audit.indexOf("um-evlist") < 0) throw new Error("no timeline");
    if (audit.indexOf(">Registered<") < 0) throw new Error("the registration event is missing");
    if (audit.indexOf("nothing is ever removed") < 0) throw new Error("the guarantee is not stated");
    return audit;
  });
  /* THE EMPTY TIMELINE IS NO LONGER REACHABLE FROM THE SEED, and that is the
     point: every account now opens with its own registration, so there is no
     fixture that renders it. The branch still exists in the component; it is
     deliberately NOT asserted here rather than asserted against an account
     that would have to be broken to produce it. What is asserted instead is
     the rule that made it unreachable. */
  check("...and every account has a timeline to show, because every one registered", () => {
    const ids = readUsers().map((u) => u.userId);
    ids.forEach((id) => {
      const h = at("/users/" + id + "?tab=audit");
      if (h.indexOf("Nothing has happened on this account yet") >= 0) {
        throw new Error(id + " renders an empty timeline for an account that registered");
      }
      if (h.indexOf("um-evlist") < 0) throw new Error(id + " renders no timeline at all");
    });
    return at("/users/" + ids[0] + "?tab=audit");
  });
  check("every surface carries the banner that says none of this is live", () => {
    [at("/users"), at("/users?view=analytics"), rec, at("/users/IB-U-NOPE")].forEach((h, i) => {
      if (h.indexOf("Nothing here is live") < 0) throw new Error("surface " + i + " has no proto banner");
    });
    return rec;
  });
  /* NO SESSION, NO WRITE AFFORDANCE. `can()` denies when the permission matrix
     is unresolved, and this harness resolves none — so the record must offer
     no Edit and no Deactivate. Meaningful because the same strings DO render
     when the dialogs are mounted directly, three blocks below. */
  check("with no resolved session the record offers no write affordance", () => {
    if (rec.indexOf(">Deactivate account<") >= 0) throw new Error("Deactivate rendered unauthorised");
    if (rec.indexOf(">Edit</button>") >= 0) throw new Error("Edit rendered unauthorised");
    if (modal(<DeactivateModal row={rowOf("IB-U-0912")} onClose={noop} onDone={noop} />)
      .indexOf("Deactivate account") < 0) {
      throw new Error("the string is not detectable at all — the check above proves nothing");
    }
    return rec;
  });
}

console.log("\nthe empty states say what is true, not just that there is nothing");
{
  check("a search that matches nobody blames the filters, not the base", () => {
    const none = at("/users?q=zzzznothing");
    if (none.indexOf("Nothing matches those filters") < 0) throw new Error("wrong empty state");
    if (none.indexOf("Clear all filters") < 0) throw new Error("no way out of it");
    if (none.indexOf("for the whole view before any filter") < 0) {
      throw new Error("the strip is not explained against the empty table");
    }
    return none;
  });
  check("...and the strip above it still states the whole", () => {
    const none = at("/users?q=zzzznothing");
    const c = countsOf(readUsers().map(toRow));
    if (none.indexOf('<span class="v tnum">' + c.total + "</span>") < 0) {
      throw new Error("Total collapsed with the table");
    }
    return none;
  });
  check("the pager appears only when there is more than one page", () => {
    const p1 = at("/users");
    if (p1.indexOf("um-pager") < 0) throw new Error("no pager on a multi-page list");
    const one = at("/users?q=zzzznothing");
    if (one.indexOf("um-pager") >= 0) throw new Error("a pager on an empty list");
    return p1;
  });
  check("...and a page past the end lands on the last one rather than on nothing", () => {
    const far = at("/users?page=99");
    if (far.indexOf("Nothing matches") >= 0) throw new Error("page 99 rendered an empty table");
    if (far.indexOf("um-tbl") < 0) throw new Error("no table at all");
    return far;
  });
}

console.log("\nthe filter chips name what is applied and can clear it");
{
  const html = at("/users?status=active&city=Mumbai&flag=incomplete&src=web&tag=vip&registered=30d");
  check("every applied filter shows as a chip", () => {
    ["Account", "City", "Profile", "Registered via", "Tag", "Registered"].forEach((t) => {
      if (html.indexOf(t) < 0) throw new Error("no chip for " + t);
    });
    return html;
  });
  check("...reading its label rather than its key", () => {
    if (html.indexOf("Incomplete profile") < 0) throw new Error("the flag chip shows a raw key");
    if (html.indexOf("Website signup") < 0) throw new Error("the source chip shows a raw key");
    return html;
  });
  check("view, sort and page sit in the URL and are NOT chips", () => {
    /* Asserted on the list face, which is the face that HAS a chip row — the
       three sit in `p` there exactly as a filter does, and a chip reading
       "view: members" or "sort: name" invites somebody to clear the screen
       they are standing on. */
    const carrying = at("/users?view=members&sort=name&page=2&city=Mumbai");
    const chips = carrying.slice(carrying.indexOf('class="dls-chips"'),
      carrying.indexOf('class="dls-body"'));
    if (chips.indexOf("Mumbai") < 0) throw new Error("a real filter is not chipped");
    ["members", "name", "page"].forEach((t) => {
      if (chips.indexOf(t) >= 0) throw new Error("`" + t + "` is offered as a clearable chip");
    });
    return chips;
  });
  check("a custom range keeps its two dates out of the chip row", () => {
    const custom = at("/users?registered=custom&from=2026-01-01&to=2026-08-01");
    const chips = custom.slice(custom.indexOf('class="dls-chips"'), custom.indexOf('class="dls-body"'));
    if (chips.indexOf("2026-01-01") >= 0) throw new Error("a bare ISO date is chipped");
    if (custom.indexOf('aria-label="Registered from"') < 0) throw new Error("no from field");
    if (custom.indexOf('aria-label="Registered up to"') < 0) throw new Error("no to field");
    return custom;
  });
  check("...and the date fields only appear for a custom range", () => {
    if (at("/users?registered=30d").indexOf('aria-label="Registered from"') >= 0) {
      throw new Error("the date fields render for a preset range");
    }
    return html;
  });
  check("the controls are keyed on their value, so clearing a chip clears the box", () => {
    /* The option is always in the list; what must follow the URL is which one
       is SELECTED. SearchField and Select are uncontrolled, so without the key
       the old choice stayed in the dropdown after its chip was cleared. */
    if (html.indexOf('value="Mumbai" selected=""') < 0) {
      throw new Error("the applied city is not the selected option");
    }
    const cleared = at("/users");
    if (cleared.indexOf('value="Mumbai" selected=""') >= 0) {
      throw new Error("a stale selection survived the clear");
    }
    const city = cleared.slice(cleared.indexOf('data-filter="city"'), cleared.indexOf('data-filter="src"'));
    if (city.indexOf('<option value="" selected="">City</option>') < 0) {
      throw new Error("the City box did not fall back to its own placeholder");
    }
    /* And the search box empties with it. */
    if (at("/users?q=sharma").indexOf('value="sharma"') < 0) throw new Error("the search box is not filled");
    if (cleared.indexOf('value="sharma"') >= 0) throw new Error("the search text survived the clear");
    return cleared;
  });
  check("the Account dropdown offers exactly the two classifications", () => {
    const sel = html.slice(html.indexOf('data-filter="status"'), html.indexOf('data-filter="city"'));
    ["Active", "Deactivated"].forEach((t) => {
      if (sel.indexOf(">" + t + "<") < 0) throw new Error("no " + t + " option");
    });
    if ((sel.match(/<option/g) || []).length !== 3) {
      throw new Error((sel.match(/<option/g) || []).length + " options, expected 3 with the placeholder");
    }
    return sel;
  });
  check("the Sort dropdown offers what applySort implements, and nothing withdrawn", () => {
    const sel = html.slice(html.indexOf('data-filter="sort"'));
    ["Recently registered", "Last activity", "Name A to Z"].forEach((t) => {
      if (sel.indexOf(">" + t + "<") < 0) throw new Error("no " + t + " option");
    });
    if (sel.indexOf("Ending soonest") >= 0) throw new Error("a membership sort is still offered");
    if (sel.indexOf("Needs action first") < 0) throw new Error("the default is not named");
    return sel;
  });
}

/* THE BUSINESS FACETS.
   The form is meant to be built FROM the profile schema — that is the module's
   own rule (UM-OD-09) and the reason a field is data rather than JSX. It is also
   the property that quietly dies the first time somebody writes
   `if (f.key === "segments")`. These assert the outcome of that rule rather
   than the rule itself: every schema field reached the form, each got the
   control its `type` asks for, and the closed ones are closed. */
console.log("\nedit profile: the form is the schema, and the schema is data");
{
  const memberRow = rowOf("IB-U-0912");
  const normalRow = rowOf("IB-U-1029");
  const full = modal(<EditProfile row={memberRow} onClose={noop} onDone={noop} />);
  const empty = modal(<EditProfile row={normalRow} onClose={noop} onDone={noop} />);

  check("edit profile renders", () => full);
  check("edit profile · an untouched profile renders", () => empty);

  check("facets · every schema field reached the form", () => {
    /* The whole schema now: nothing is conditional, so a field the form is
       hiding is a field the form has lost. A field alone in its group is
       named by the group's legend rather than by a label of its own, so for
       those the control is what must carry the name. */
    const solo = (f: typeof PROFILE_FIELDS[number]) =>
      PROFILE_FIELDS.filter((x) => x.group === f.group).length === 1;
    const missing = PROFILE_FIELDS.filter((f) => (solo(f)
      ? full.indexOf('aria-label="' + f.label + '"') < 0
      : full.indexOf(">" + f.label) < 0));
    if (missing.length) throw new Error("absent: " + missing.map((f) => f.label).join(", "));
    return full;
  });
  check("...and the same fields for somebody who has answered none of them", () => {
    const solo = (f: typeof PROFILE_FIELDS[number]) =>
      PROFILE_FIELDS.filter((x) => x.group === f.group).length === 1;
    const missing = PROFILE_FIELDS.filter((f) => (solo(f)
      ? empty.indexOf('aria-label="' + f.label + '"') < 0
      : empty.indexOf(">" + f.label) < 0));
    if (missing.length) throw new Error("absent: " + missing.map((f) => f.label).join(", "));
    return empty;
  });
  check("facets · each one rendered a picker, not a bare input", () => {
    /* Counting comboboxes is the wrong assertion — a CLOSED single that is
       already answered collapses to a readonly box and has no open combobox.
       What must hold is that every picker-typed field rendered the picker
       shell — plus TWO per target-area row, because each row is a state
       picker and a city picker of its own. */
    const shells = (full.match(/class="um-facet[" ]/g) || []).length;
    const expect = PROFILE_FIELDS
      .filter((f) => ["single", "multi", "tags"].indexOf(f.type) >= 0 && !f.simple).length
      + memberRow.user.profile.targetAreas.length * 2;
    if (shells !== expect) throw new Error(shells + " pickers, expected " + expect);
    return full;
  });
  check("facets · an answered closed single reads as a select, not chip + Change", () => {
    if (full.indexOf(">Change<") >= 0) throw new Error("a closed single still offers Change");
    if (full.indexOf("um-facet sellike") < 0) throw new Error("no select-like closed single rendered");
    const state = memberRow.user.profile.targetAreas[0].state;
    if (full.indexOf('value="' + state + '"') < 0) {
      throw new Error("the stored state is not shown in the box");
    }
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
  check("facets · chips are removable, and the control says what it removes", () => {
    if (full.indexOf("Remove Interior designer") < 0) throw new Error("no labelled remove control");
    return full;
  });
  check("facets · the cap is stated, not just enforced", () => {
    /* Read from the profile rather than written down here: a hard-coded 3/6
       would break the day somebody edits the seed, which is a test failing for
       a reason that is not a bug. A cap somebody only ever meets by being
       refused is a cap they experience as a bug. */
    const segs = memberRow.user.profile.segments.length;
    const want = ">" + segs + "/6<";
    if (full.indexOf(want) < 0) throw new Error("no counter reading " + want);
    return full;
  });
  check("facets · a stored single arrives selected", () => {
    if (full.indexOf('selected=""') < 0) throw new Error("the stored type is not selected");
    return full;
  });
  /* The listbox exists only while it is open, and there is no browser here to
     open it — so what the OPTIONS look like is asserted in check:users against
     the vocabulary they are built from. What is assertable here is that a
     closed picker is genuinely closed: a listbox left in the tree would sit
     over the field below it. */
  check("facets · a closed picker leaves no listbox in the tree", () => {
    if (empty.indexOf('role="listbox"') >= 0) {
      throw new Error("a closed picker still rendered its options");
    }
    if (empty.indexOf('aria-expanded="false"') < 0) {
      throw new Error("...and no combobox declared itself closed, so the check proves nothing");
    }
    return empty;
  });
  check("facets · guidance is placeholders and counters, not paragraphs", () => {
    if (empty.indexOf("Type a keyword, press Enter") < 0) {
      throw new Error("the keyword field lost its placeholder");
    }
    /* One placeholder per field, not one for all: "phrase" fit keywords only. */
    if (empty.indexOf("Type a phrase") >= 0) throw new Error("the generic placeholder is back");
    if (empty.indexOf("Search or type a segment") < 0) throw new Error("segments placeholder missing");
    const withHints = PROFILE_FIELDS.filter((f) => f.hint).map((f) => f.key);
    if (withHints.length) throw new Error("hint sentences crept back onto: " + withHints.join(", "));
    return empty;
  });
  check("facets · the open/closed split is exactly where it was decided", () => {
    /* The facet the marketplace ranks on stays closed, or it fragments. The
       ones that are sets nobody can enumerate stay open, or the form cannot
       record the truth. This is the assertion that catches somebody "fixing" a
       facet by loosening it. */
    const isOpen = (k: string) => {
      const f = PROFILE_FIELDS.filter((x) => x.key === k)[0];
      if (!f) throw new Error("no field " + k);
      return f.type === "tags" || f.open === true;
    };
    ["businessType"].forEach((k) => {
      if (isOpen(k)) throw new Error(k + " has been opened up");
    });
    ["searchKeywords", "categories", "segments"].forEach((k) => {
      if (!isOpen(k)) throw new Error(k + " has been closed off");
    });
    /* Target areas holds the split WITHIN itself now: a closed state half and
       an open city half per row. Asserted against validateFacets because the
       schema field's own `open` flag no longer tells that story. */
    if (validateFacets({ targetAreas: [{ state: "Atlantis", cities: ["X"] }] } as never) === "") {
      throw new Error("the state half of a row has been opened up");
    }
    if (validateFacets({ targetAreas: [{ state: "Karnataka", cities: ["Chikkaballapur"] }] } as never) !== "") {
      throw new Error("the city half of a row has been closed off");
    }
    return empty;
  });
  check("business type · a plain dropdown, its meanings behind the i", () => {
    if (full.indexOf("What kind of business this is") >= 0) {
      throw new Error("the field hint is still under the control");
    }
    if (full.indexOf("Authorised to sell named brands") >= 0) {
      throw new Error("option hints are still inline in the flow");
    }
    if (full.indexOf(">Manufacturer<") < 0) throw new Error("the dropdown lost its options");
    if (full.indexOf(">Service provider<") >= 0) throw new Error("Service provider is still on offer");
    /* The dropdown keeps the vocabulary's chain order, practitioner first.
       Asserted on the markup, since a sort() anywhere between the schema and
       the <option>s would silently alphabetise it. */
    const at_ = (t: string) => full.indexOf(">" + t + "<");
    const order = ["Independent professional", "Firm / Studio", "Contractor",
      "Retailer / Showroom", "Wholesaler / Trader", "Dealer / Distributor", "Manufacturer"].map(at_);
    if (order.some((i) => i < 0)) throw new Error("a type is missing from the dropdown");
    if (order.some((i, k) => k > 0 && i < order[k - 1])) {
      throw new Error("the dropdown is not in chain order");
    }
    /* The i sits in the label row, right of the label, inside the same span. */
    const lb = full.indexOf(">Business type");
    const iAt = full.indexOf('class="um-info-b"', lb);
    const ctrl = full.indexOf('class="selectbox', lb);
    if (lb < 0 || iAt < 0 || iAt > ctrl) {
      throw new Error("the i is not right of the Business type label");
    }
    /* No visibility chip on any input — the record's profile tab still marks
       public/internal, the form does not. */
    if (full.indexOf("um-vis") >= 0) throw new Error("a public/internal chip is still on the form");
    if ((full.match(/class="um-info-b"/g) || []).length < 1) {
      throw new Error("no i button on Business type");
    }
    return full;
  });
  check("the form runs name, username, type, deals in, facets, target, positioning, about", () => {
    const order = [">Business name", ">Username", ">Business type", ">Deals in",
      ">Segments", ">Target<", ">Positioning segment", ">About<"].map((t) => full.indexOf(t));
    if (order.some((i) => i < 0)) throw new Error("a field or group is missing");
    if (order.some((i, k) => k > 0 && i < order[k - 1])) throw new Error("the form is out of order");
    /* About closes the form: nothing but the read-only identity follows it. */
    if (full.indexOf(">About<") > full.indexOf(">Identity")) throw new Error("About is not last");
    /* A group of one is its field: no second label under the legend. */
    ["Location", "Positioning<", "About<"].forEach((l) => {
      const n = (full.match(new RegExp(">" + l.replace("<", "") + "<", "g")) || []).length;
      if (l === "Location" ? n > 0 : n > 1) throw new Error(l + " is labelled twice");
    });
    if (full.indexOf(">Display name") >= 0) throw new Error("Display name survives");
    if (full.indexOf(">Basic profile<") >= 0) throw new Error("an empty Basic profile group renders");
    return full;
  });
  check("business name takes the row, so Business type sits beneath it", () => {
    const i = full.indexOf(">Business name");
    const fg = full.lastIndexOf('<div class="fg', i);
    if (full.slice(fg, i).indexOf("um-fg-wide") < 0) throw new Error("Business name is half-width");
    if (full.indexOf(">Business type") < i) throw new Error("Business type is not after Business name");
    const bt = full.indexOf(">Business type");
    const btFg = full.lastIndexOf('<div class="fg', bt);
    if (full.slice(btFg, bt).indexOf("um-fg-wide") < 0) throw new Error("Business type is half-width");
    if (full.indexOf(">Deals in") < bt) throw new Error("Deals in is not after Business type");
    return full;
  });
  check("deals in · two checkboxes, one or both", () => {
    const boxes = (full.match(/type="checkbox"/g) || []).length;
    if (boxes !== 6) throw new Error(boxes + " checkboxes, expected 2 deals + 4 positioning");
    if (full.indexOf(">Products<") < 0 || full.indexOf(">Services<") < 0) {
      throw new Error("the two options are not Products and Services");
    }
    /* IB-U-0912 deals in services — the seeded answer must arrive checked. */
    if (full.indexOf('checked=""') < 0) throw new Error("the stored answer is not checked");
    return full;
  });
  check("positioning: four tiles on one row, the cap behind the i, two ticked at most", () => {
    ["Luxury", "Budget-friendly", "Custom", "Premium"].forEach((t) => {
      if (full.indexOf(">" + t + "<") < 0) throw new Error("missing " + t);
    });
    if (full.indexOf('aria-label="What the Positioning options mean"') < 0) {
      throw new Error("no i button on Positioning");
    }
    if (full.indexOf("Select up to 2.") >= 0) {
      throw new Error("the cap sentence is still printed on the form");
    }
    if (full.indexOf('<p class="um-facet-fine"></p>') >= 0) throw new Error("an empty fine line renders");
    /* IB-U-0912 holds two, so the other two render disabled: the cap is
       enforced by what can still be pressed. */
    const off = (full.match(/um-check off/g) || []).length;
    if (off !== 2) throw new Error(off + " tiles went quiet at the cap, expected 2");
    /* ...and a profile holding none has all four live, which is what proves
       the two above are the CAP and not just a rendering constant. */
    if ((empty.match(/um-check off/g) || []).length !== 0) {
      throw new Error("tiles are disabled on a profile that has chosen nothing");
    }
    ["Eco-friendly", "Value"].forEach((t) => {
      if (full.indexOf(">" + t + "<") >= 0) throw new Error("a removed tile is still on offer: " + t);
    });
    const pos = full.indexOf(">Positioning segment");
    const fg = full.lastIndexOf('<div class="fg', pos);
    if (full.slice(fg, pos).indexOf("um-fg-wide") < 0) throw new Error("positioning is half-width");
    return full;
  });

  /* ------------------------------------------- the username and the URL --- */
  check("username · the field is an address, not a text box", () => {
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
  check("username · an empty one is not offered a link to a page that does not exist", () => {
    if (empty.indexOf("Copy link") >= 0) {
      throw new Error("offered a link to a profile that does not exist");
    }
    return empty;
  });
  check("username · a taken handle is refused, and by the store too", () => {
    if (!usernameTaken("meera-studio-interiors")) throw new Error("uniqueness is not checked");
    if (usernameTaken("meera-studio-interiors", "IB-U-0912")) {
      throw new Error("a profile is told its own handle is taken");
    }
    return full;
  });
  check("username · the record links to it rather than printing it", () => {
    const rec = at("/users/IB-U-0912?tab=profile");
    if (rec.indexOf("um-profile-link") < 0) throw new Error("the record printed a string");
    if (rec.indexOf("/pro/meera-studio-interiors") < 0) throw new Error("no href to the profile");
    return rec;
  });

  /* --------------------------------------------- location, and what went --- */
  check("target areas · everyone is asked, because it is the location now", () => {
    /* It was member-only while it sat beside a registered address. The
       address is gone; a plain user with no coverage row is invisible to
       every location filter, and the form is where that gets fixed. */
    if (full.indexOf("um-areas") < 0) throw new Error("a full profile was not asked");
    if (empty.indexOf("um-areas") < 0) throw new Error("a bare registration was not asked");
    if (full.indexOf(">Target<") < 0) throw new Error("the group is not called Target");
    if (empty.indexOf("No areas yet") < 0) throw new Error("an empty coverage list says nothing");
    return full;
  });
  check("target areas · a row is a tile: closed state, open cities, removable", () => {
    if (full.indexOf("um-area") < 0) throw new Error("no row tiles");
    /* The remove control names what it takes with it — a bare × on a
       two-picker tile does not say the cities go too. */
    if (full.indexOf("and its cities") < 0) throw new Error("the remove control does not say its scope");
    if (full.indexOf("Add state") < 0) throw new Error("no way to add a row");
    if (full.indexOf("um-areas-count") < 0) throw new Error("the row cap is not stated");
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
    ["Portfolio link", "Locality", "Contact address", "Pincode", "Display name"].forEach((label) => {
      if (full.indexOf(">" + label) >= 0) throw new Error(label + " survives on the form");
      if (rec.indexOf(">" + label) >= 0) throw new Error(label + " survives on the record");
    });
    return full;
  });
  check("...and the contact group is exactly the coverage field", () => {
    const contact = PROFILE_FIELDS.filter((f) => f.group === "contact").map((f) => f.key);
    if (contact.join(",") !== "targetAreas") {
      throw new Error("the contact group reads " + contact.join(", "));
    }
    return full;
  });

  /* ----------------------------------------------------------- the guard --- */
  check("completeness is on the form, computed the way the row computes it", () => {
    if (full.indexOf("um-livecomp") < 0) throw new Error("no live completeness readout");
    if (full.indexOf(">" + memberRow.completeness + "%<") < 0) {
      throw new Error("the form disagrees with the row it was opened from");
    }
    if (empty.indexOf(">" + normalRow.completeness + "%<") < 0) {
      throw new Error("...and disagrees on an empty one too");
    }
    return full;
  });
  check("a form with required fields empty says what it is waiting for", () => {
    if (empty.indexOf("um-fg-missing") < 0) throw new Error("nothing is marked as missing");
    if (empty.indexOf("Required: ") < 0) throw new Error("the footer does not name them");
    if (empty.indexOf("disabled") < 0) throw new Error("Save is not held back");
    /* ...and a complete one is not held back, which is what makes the line
       above a check on the guard rather than on a constant. */
    if (full.indexOf("um-fg-missing") >= 0) throw new Error("a complete profile is marked incomplete");
    return empty;
  });
  check("the identity block is shown and cannot be edited here", () => {
    if (full.indexOf(">Identity") < 0) throw new Error("no identity block");
    if (full.indexOf("read-only") < 0) throw new Error("...that does not say it is read-only");
    if (full.indexOf(">Verified email<") < 0 || full.indexOf(">Verified mobile<") < 0) {
      throw new Error("the credentials are not shown");
    }
    if (full.indexOf('class="inp ro"') < 0) throw new Error("they are rendered as editable inputs");
    return full;
  });
  check("the modal stopped being documentation with fields in it", () => {
    ["graded against profile v1", "what the marketplace matches and ranks on",
      "transactional"].forEach((t) => {
      if (full.indexOf(t) >= 0) throw new Error("`" + t + "` is back on the form");
    });
    return full;
  });

  check("chips · each facet wears its declared tone wherever chips render", () => {
    /* The colour is information — "which question is this the answer to" —
       and it has to actually reach the markup: a tone the component forgets
       to append falls back to brand tint with no error anywhere. */
    const rec = at("/users/IB-U-0912?tab=profile");
    PROFILE_FIELDS.filter((f) => f.chip).forEach((f) => {
      const want = "um-chip " + f.chip;
      if (rec.indexOf(want) < 0) throw new Error(f.key + " chips lost " + f.chip + " on the record");
      const formChips = ["multi", "tags", "areas"].indexOf(f.type) >= 0;
      if (formChips && full.indexOf(want) < 0) {
        throw new Error(f.key + " chips lost " + f.chip + " on the form");
      }
    });
    return full;
  });
  check("chips · a stale value wears warn, never a facet's tone", () => {
    /* The Chips component swaps the tone out entirely when a value is stale —
       asserted at the source because the form's own seed rows are all current. */
    const src = String(Chips);
    if (src.indexOf('stale ? "warn"') < 0) {
      throw new Error("the stale branch no longer displaces the tone");
    }
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

console.log("\nthe three dialogs, each one field and one guarantee");
{
  check("note", () => {
    const html = modal(<NoteModal row={rowOf("IB-U-0912")} onClose={noop} onDone={noop} />);
    if (html.indexOf("Add an internal note") < 0) throw new Error("no title");
    if (html.indexOf("Append-only, and never customer-visible") < 0) {
      throw new Error("the guarantee is not stated");
    }
    if (html.indexOf("never the text") < 0) throw new Error("...nor what the audit records");
    /* Nothing typed yet, so there is nothing to add. */
    if (html.indexOf("disabled") < 0) throw new Error("an empty note can be submitted");
    return html;
  });
  check("tags", () => {
    const html = modal(<TagsModal row={rowOf("IB-U-0912")} onClose={noop} onDone={noop} />);
    if (html.indexOf("Operational tags") < 0) throw new Error("no title");
    if (html.indexOf("um-tagpicker") < 0) throw new Error("no picker");
    if (html.indexOf("Tags are ours, not theirs") < 0) throw new Error("the exclusion is not stated");
    /* Every tag is offered, with the sentence that says when to use it —
       a closed list nobody can read is a closed list nobody uses correctly. */
    ["High intent", "Onboarding", "Win-back", "Payment risk", "VIP", "Profile chase"]
      .forEach((t) => {
        if (html.indexOf(t) < 0) throw new Error("no " + t + " tag on offer");
      });
    if (html.indexOf("Handled by the founder personally") < 0) {
      throw new Error("the tags do not explain themselves");
    }
    /* IB-U-0912 holds VIP, so it must arrive selected. */
    if (html.indexOf("um-tag pick tag-green on") < 0) throw new Error("the held tag is not on");
    return html;
  });
  check("deactivate", () => {
    const html = modal(<DeactivateModal row={rowOf("IB-U-0912")} onClose={noop} onDone={noop} />);
    if (html.indexOf("Deactivate this account") < 0) throw new Error("no title");
    if (html.indexOf("um-consequences") < 0) throw new Error("the consequences are not listed");
    /* All four: soft, still counted, stops at this module, and sign-in is
       somebody else's job. Each one is a thing somebody would otherwise
       assume wrongly. */
    ["The profile, the commercial references and the whole audit trail",
      "stays in every historical count", "Anything the customer has bought is a Finance record",
      "Sign-in is blocked by Authentication independently"].forEach((t) => {
      if (html.indexOf(t) < 0) throw new Error("the consequence list is missing: " + t);
    });
    if (html.indexOf("Hard deletion is not a button") < 0) {
      throw new Error("the deletion boundary is not stated");
    }
    /* A reason is required, so the button starts held back. */
    if (html.indexOf("disabled") < 0) throw new Error("it can be deactivated with no reason");
    /* And the reasons are offered rather than left to a blank box. */
    if (html.indexOf("Duplicate account") < 0) throw new Error("no reason chips");
    return html;
  });
  check("reactivate is the same dialog, saying the opposite and no more", () => {
    const html = modal(<DeactivateModal row={rowOf("IB-U-0601")} onClose={noop} onDone={noop} />);
    if (html.indexOf("Reactivate this account") < 0) throw new Error("no title");
    if (html.indexOf("Re-enables the account and nothing else") < 0) {
      throw new Error("the scope is not stated");
    }
    if (html.indexOf("recorded in Finance and is not touched from here") < 0) {
      throw new Error("...and it does not say what it leaves alone");
    }
    /* No reason is needed to turn an account back on, so nothing is held back
       and no reason chips render. */
    if (html.indexOf("um-consequences") >= 0) throw new Error("the deactivation warnings rendered");
    if (html.indexOf("disabled") >= 0) throw new Error("reactivation is held back for no reason");
    return html;
  });
  check("every dialog can be closed without saving", () => {
    [<NoteModal row={rowOf("IB-U-0912")} onClose={noop} onDone={noop} />,
      <TagsModal row={rowOf("IB-U-0912")} onClose={noop} onDone={noop} />,
      <DeactivateModal row={rowOf("IB-U-0912")} onClose={noop} onDone={noop} />]
      .forEach((node, i) => {
        const html = modal(node);
        if (html.indexOf(">Cancel<") < 0) throw new Error("dialog " + i + " has no Cancel");
        if (html.indexOf('aria-label="Close"') < 0) throw new Error("dialog " + i + " has no close button");
      });
    return "ok".repeat(30);
  });
  check("no dialog assigns, renews or cancels anything", () => {
    /* The assignment form and the lifecycle modal left with the feature. What
       is left is three dialogs and none of them touches money. */
    [<NoteModal row={rowOf("IB-U-0912")} onClose={noop} onDone={noop} />,
      <TagsModal row={rowOf("IB-U-0912")} onClose={noop} onDone={noop} />,
      <DeactivateModal row={rowOf("IB-U-0912")} onClose={noop} onDone={noop} />]
      .forEach((node) => {
        const html = modal(node);
        ["Assign", "Renew", "Plan", "Term", "Entitlement", "₹"].forEach((t) => {
          if (html.indexOf(t) >= 0) throw new Error("`" + t + "` is still in a dialog");
        });
      });
    return "ok".repeat(30);
  });
}

console.log(failed ? "\n" + failed + " FAILED\n" : "\nevery surface rendered\n");
process.exit(failed ? 1 : 0);
