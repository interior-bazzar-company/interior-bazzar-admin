/* =============================================================================
   Interior bazzar — Admin · the shell
   -----------------------------------------------------------------------------
   The container every module renders into. Ported from admin-access.html +
   admin-shell.js. It owns four things and nothing else:

     1. Where you are   — navigation, routing, breadcrumbs, active state
     2. What needs you  — the aggregated queue across every module
     3. How you get there — global search, cross-module links, recents
     4. Who you are     — session, identity, effective access, sign out

   It owns no business data and no store of its own: the Activity bell reads
   the server's audit trail, the command palette searches deals through the
   API, and every action it offers is a link into a module.

   ROUTING — the prototype is a hash router (`#/deals/IB-D-1042?tab=x`); this
   app uses real paths (`/deals/IB-D-1042?tab=x`). Every ported view still
   emits the prototype's `#/…` strings, and `go()` is the single place that
   translates. One function, so no view had to be rewritten to move house.
   ============================================================================= */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import IB_ICON from "../../assets/images/IB_Icon.png";
import { Icon } from "../ui";
import { go as uiGo, setGo } from "../ui/nav";
import config from "../../config";
import { AuthService } from "../../api/modules/auth";
import AdminOpsService, { call } from "../../api/modules/adminOps";
import type { AuditEntry, MePermissions } from "../../api/modules/adminOps";
import { getModules, getGroupOf, getItems, moduleLabel, HOME_ROUTE } from "./modules";
import { can, canWrite, clearSession, getSession, grantsOf } from "../auth/session";
import { LS, currentDensity, currentTheme, setDensity, setTheme, useShell } from "./ShellContext";
import { CommandPalette } from "./CommandPalette";
import ErrorBoundary from "../../components/shared/ErrorBoundary";

/* ------------------------------------------------------------------- gate */
/* The single permission gate for the whole panel, resolved server-side and
   cached in admin/auth/session.ts. No view may ever branch on a role NAME.
   (TEAM_OPERATION §0.3) — `can()` reads a module KEY + action against the
   resolved matrix, never a role. Re-exported here (rather than only from
   session.ts) because every view in this panel already imports it from
   "../../shell/AdminShell" and that import path is the contract, not this
   file's internals. An unresolved matrix DENIES: RequireSession never lets a
   view render before the fetch settles, so "unresolved" here only ever means
   "signed out", not "still loading". */
export { can, canWrite };

/* ----------------------------------------------------------------- chrome */
type Chrome = {
  /** claims the breadcrumb slot — a module that would rather show its own title */
  crumbs?: ReactNode;
  /** the right-hand topbar slot; Deals puts its Table/Pipeline/Chat switcher here */
  right?: ReactNode;
  /** where "up" is from here. `false` means there is no up at all. */
  parent?: string | false | null;
};
const ChromeCtx = createContext<(c: Chrome) => void>(() => {});

/** A view declares its own topbar and its own parent. Call it once, at the top
    of the component. Passing fresh JSX every render is fine and expected.

    It republishes ONCE PER LOCATION, not once per render, and that is the whole
    design. `crumbs` and `right` are React elements, so they are a new object on
    every render; an effect that depended on them would setState → re-render the
    view → new element → fire again, forever. The dependency is therefore the
    URL, which is what a view's topbar is actually a function of — every claim
    in this panel is derived from the route, the id and the query. A view whose
    topbar must change without the URL changing would not update here; none does,
    because the prototype keeps view-mode in the query string for exactly this
    kind of reason. */
/** `key` is for chrome whose CONTENTS arrive after the page does — a module
 *  that prints server counts beside its title publishes zeros on mount and the
 *  real numbers a moment later, and republishing once per location would leave
 *  the zeros on screen. Callers with static chrome pass nothing and behave
 *  exactly as before. */
export function usePageChrome(c: Chrome, key?: string) {
  const set = useContext(ChromeCtx);
  const location = useLocation();
  const here = location.pathname + location.search;
  const latest = useRef(c);
  latest.current = c;
  useEffect(() => {
    set(latest.current);
    return () => set({});
  }, [set, here, key]);
}

/* -------------------------------------------------------------- navigation */
/* The default is the module-level `go`, not a no-op, and that matters: layers
   (drawer, modal, popover) are portalled out of ShellProvider, which sits ABOVE
   AdminShell, so anything rendered into one is outside this context. A no-op
   default made every link inside a drawer silently dead. `go` is the same
   function the ui/ components route through, so both trees navigate. */
const NavCtx = createContext<{ go: (hash: string) => void; back: () => void }>({
  go: uiGo,
  back: () => window.history.back(),
});
export const useNav = () => useContext(NavCtx);

/** `#/deals/IB-1?tab=x` → `/deals/IB-1?tab=x`. Also tolerates a bare path. */
export function hashToPath(hash: string): string {
  let h = String(hash || "");
  if (h.charAt(0) === "#") h = h.slice(1);
  if (h.charAt(0) !== "/") h = "/" + h;
  return h;
}

export default function AdminShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const shell = useShell();

  const [chrome, setChrome] = useState<Chrome>({});
  const [railed, setRailed] = useState(() => LS.get("ib_admin_nav_collapsed", false));
  const [navOpen, setNavOpen] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  /* THE single module list, resolved once by RequireSession before this
     component ever mounts — nav, routing and the permission matrix all read
     the same array, so they cannot disagree. */
  const MODULES = getModules();
  const ITEMS = getItems();

  const route = (location.pathname.split("/").filter(Boolean)[0] || HOME_ROUTE).toLowerCase();
  const id = params.id ? decodeURIComponent(params.id) : null;
  const known = !!ITEMS[route];

  /* ------------------------------------------------------------------ go */
  const go = useCallback(
    (hash: string) => {
      navigate(hashToPath(hash));
    },
    [navigate]
  );

  /* ui/ components navigate through this one function, so nothing under
     src/admin/ui/ has to know a router exists. */
  useEffect(() => setGo(go), [go]);

  /* ---------------------------------------------------------------- back */
  /* One return mechanism for the whole panel, and it goes UP, not backwards:
     the module's own default view (or the parent a module declares), never the
     previous screen. Session history used to be tried first, which made Back
     retrace however somebody wandered in — three slips deep meant three
     presses to reach the list the sidebar names in one. The browser's Back
     still owns the history; this button owns the way up:
       1. a declared parent    → how a record names its own "up"
       2. the module list      → the default view, and it replaces rather
                                 than pushes */
  const here = location.pathname + location.search;

  /* Back belongs on the screens you ARRIVE at — a record, a create flow, a
     sub-mode. On a module list the sidebar is already the wayfinding, and a
     Back button there would only offer a loop between two lists. */
  const search = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const isDeep = !!(id || search.get("new") || search.get("mode") || search.get("view") === "tags");

  const backTo = useCallback((): { path: string } | null => {
    if (!known || !isDeep) return null;
    /* `false`, not null: a module saying there is no "up" from here at all —
       Deals says it for a deal open in Chat, where the list is already the left
       pane. null only means "I have no opinion", and falls through to the list. */
    if (chrome.parent === false) return null;
    if (chrome.parent) {
      const p = hashToPath(chrome.parent);
      if (p !== here) return { path: p };
    }
    const list = "/" + route;
    return list === here ? null : { path: list };
  }, [known, isDeep, chrome.parent, here, route]);

  const back = useCallback(() => {
    const t = backTo();
    if (!t) return;
    navigate(t.path, { replace: true }); // up replaces; it is not a step forward
  }, [backTo, navigate]);

  /* A path, said the way a person would say it: the record's own reference when
     there is one, the module's name when there is not. */
  const labelOf = (path: string) => {
    const seg = path.split("?")[0].split("/").filter(Boolean);
    if (seg[1]) return decodeURIComponent(seg[1]);
    return ITEMS[seg[0]] ? ITEMS[seg[0]].label : "back";
  };

  /* ------------------------------------------------------------ keyboard */
  useEffect(() => {
    let chord: string | null = null;
    let chordT: number | undefined;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typingNow =
        /INPUT|TEXTAREA|SELECT/.test(target.tagName || "") || target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        if (paletteOpen) {
          setPaletteOpen(false);
          return;
        }
        setNavOpen(false);
        return;
      }
      if (typingNow || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "?") {
        e.preventDefault();
        shell.shortcuts();
        return;
      }
      if (e.key === "[") {
        e.preventDefault();
        setRailed((v) => {
          LS.set("ib_admin_nav_collapsed", !v);
          return !v;
        });
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }

      if (chord === "g") {
        const map: Record<string, string> = {
          d: "deals",
          s: "plans",
          t: "team",
        };
        const dest = map[e.key.toLowerCase()];
        chord = null;
        clearTimeout(chordT);
        if (dest) {
          e.preventDefault();
          go("#/" + dest);
        }
        return;
      }
      if (e.key.toLowerCase() === "g") {
        chord = "g";
        clearTimeout(chordT);
        chordT = window.setTimeout(() => {
          chord = null;
        }, 1400);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, shell, paletteOpen]);

  /* ------------------------------------------- title, scroll, mobile nav */
  useEffect(() => {
    const item = getItems()[route];
    document.title = (item ? item.label + " · " : "") + "Interior bazzar Admin";
    if (scroller.current) scroller.current.scrollTop = 0;
    setStuck(false);
    if (window.matchMedia && window.matchMedia("(max-width:1180px)").matches) setNavOpen(false);
    if (id && known) remember(route, id);
  }, [route, id, known, here]);

  const session = getSession();
  /* No nav badges. They came from IBData.derive.badges() — queue counts over
     the browser-side seed store ("deals with no quotation", "members pending a
     role"), so every module wore a number that described demo data. A count in
     the navigation is a promise that something needs doing; it comes back when
     it can be counted from the server. */
  const badges: Record<string, { n: number; alert: boolean }> = {};
  const t = backTo();

  return (
    <NavCtx.Provider value={{ go, back }}>
      <ChromeCtx.Provider value={setChrome}>
        <div className={"app" + (railed ? " rail" : "") + (navOpen ? " nav-open" : "")} id="app">
          {/* ================================================== SIDEBAR === */}
          <aside className="sidebar" aria-label="Modules">
            <div className="sb-top">
              <button className="sb-brand" data-go={"#/" + HOME_ROUTE} title="Interior bazzar Admin" onClick={() => go("#/" + HOME_ROUTE)}>
                <img className="sb-mark" src={IB_ICON} alt="" />
                <span className="sb-name rail-hide">
                  Interior bazzar<small>Admin</small>
                </span>
              </button>
            </div>

            <div className="sb-tools">
              <button className="sb-search" data-act="search" onClick={() => setPaletteOpen(true)}>
                <Icon name="search" />
                <span className="rail-hide">Search</span>
              </button>
            </div>

            <nav className="sb-scroll" id="navScroll">
              {MODULES.map((g) => {
                const vis = g.items.filter((it) => can(it.key));
                if (!vis.length) return null;
                const agg = vis.reduce(
                  (a, it) => a + (it.q && badges[it.q] ? badges[it.q].n : 0),
                  0
                );
                return (
                  <div className="sb-group" key={g.group}>
                    {g.group && (
                      <div className="sb-label rail-hide">
                        {g.group}
                        {agg ? <span className="n">{agg}</span> : null}
                      </div>
                    )}
                    {vis.map((it) => {
                      const b = it.q ? badges[it.q] : null;
                      return (
                        <button
                          key={it.route}
                          className={
                            "sb-item" +
                            (route === it.route ? " on" : "") +
                            (b ? " sb-q" + (b.alert ? " sb-alert" : "") : "")
                          }
                          data-go={"#/" + it.route}
                          title={it.label}
                          onClick={() => go("#/" + it.route)}
                        >
                          <Icon name={it.icon} />
                          <span className="lb rail-hide">{it.label}</span>
                          {b && (
                            <span className={"sb-badge rail-hide" + (b.alert ? " alert" : "")}>
                              {b.n}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </nav>

            <div className="sb-foot">
              <AccountButton session={session} />
              <button
                className="sb-toggle"
                id="sbToggle"
                data-act="rail"
                aria-expanded={!railed}
                aria-controls="app"
                aria-label={railed ? "Expand sidebar" : "Collapse sidebar"}
                title={(railed ? "Expand sidebar" : "Collapse sidebar") + "  ·  ["}
                onClick={() =>
                  setRailed((v) => {
                    LS.set("ib_admin_nav_collapsed", !v);
                    return !v;
                  })
                }
              >
                <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M13 8l-4 4 4 4M18 8l-4 4 4 4"
                    stroke="currentColor"
                    fill="none"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="lb rail-hide">{railed ? "Expand" : "Collapse"}</span>
              </button>
            </div>
          </aside>

          {/* ================================================== CONTENT === */}
          <main className="content">
            <header className={"topbar" + (stuck ? " stuck" : "")} id="topbar">
              <button
                className="tb-btn tb-rail"
                data-act="rail"
                aria-label="Expand sidebar"
                title="Expand sidebar  ·  ["
                onClick={() =>
                  setRailed((v) => {
                    LS.set("ib_admin_nav_collapsed", !v);
                    return !v;
                  })
                }
              >
                <Icon name="menu" />
              </button>
              <button
                className="tb-btn tb-menu"
                data-act="menu"
                aria-label="Open navigation"
                onClick={() => setNavOpen(true)}
              >
                <Icon name="menu" />
              </button>

              {/* The way out. Its own slot, before the crumb and OUTSIDE it, so a
                  module that claims the crumb slot cannot claim away the way back. */}
              <div className="tb-backslot" id="tbback">
                {t && (
                  <button
                    className="tb-btn tb-back"
                    data-act="back"
                    title={"Back to " + labelOf(t.path)}
                    aria-label={"Back to " + labelOf(t.path)}
                    onClick={back}
                  >
                    <Icon name="chevl" />
                    <span className="lb">Back</span>
                    <span className="to">{labelOf(t.path)}</span>
                  </button>
                )}
              </div>

              <nav className="crumbs" id="crumbs" aria-label="Breadcrumb">
                <Crumbs claimed={chrome.crumbs} route={route} id={id} isDeep={isDeep} />
              </nav>

              {/* Right-hand slot a module can fill with its own control. */}
              <div className="tb-slot" id="tbslot">
                {chrome.right}
              </div>

              <div className="tb-actions">
                <button
                  className="tb-btn"
                  data-act="search"
                  aria-label="Search"
                  title="Search  ⌘K"
                  onClick={() => setPaletteOpen(true)}
                >
                  <Icon name="search" />
                </button>
                <ActivityButton />
              </div>
            </header>

            <BannerDock />

            <div
              className="scroller"
              id="scroller"
              ref={scroller}
              onScroll={(e) => setStuck(e.currentTarget.scrollTop > 4)}
            >
              <div id="page">
                {/* A view that throws mid-render takes itself down, not the
                    panel: the sidebar, the topbar and the way out stay on
                    screen. `resetKey`, NOT `key`: keying this on the location
                    rebuilt the whole view on every navigation, so picking
                    another record threw away the module's loaded list and
                    refetched it. resetKey clears a SHOWING error on the same
                    signal and leaves a healthy view alone. */}
                <ErrorBoundary resetKey={here}>
                  <Outlet />
                </ErrorBoundary>
              </div>
            </div>
          </main>

          {navOpen && <div className="nav-scrim" id="navScrim" onClick={() => setNavOpen(false)} />}
        </div>

        {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} go={go} />}
      </ChromeCtx.Provider>
    </NavCtx.Provider>
  );
}

/* --------------------------------------------------------------- crumbs */
function Crumbs({
  claimed,
  route,
  id,
  isDeep,
}: {
  claimed?: ReactNode;
  route: string;
  id: string | null;
  isDeep: boolean;
}) {
  /* A module may claim the topbar slot instead of a breadcrumb. Deals puts its
     Table/Pipeline/Chat switcher there: on that page the view mode IS the
     wayfinding, and a crumb reading "Sales › Deals" above a heading that
     already says "Deals" is pure duplication. */
  if (claimed) return <>{claimed}</>;

  const item = getItems()[route];
  const grp = getGroupOf()[route];

  /* On a record, a create flow or a sub-mode the chain is GONE. `Sales ›
     Quotations › IB-QT-2026-00208` asked the user to read a hierarchy to work
     out how to leave, and then took them to the wrong place when they did.
     Back owns the return now, so what is left here is a label. */
  if (isDeep)
    return (
      <>
        <span className="tb-title">{item ? item.label : route}</span>
        {id && <span className="crumb-ref mono">{id}</span>}
      </>
    );

  return (
    <>
      {grp && (
        <>
          <span>{grp}</span>
          <span className="sep">
            <Icon name="chevr" size="sm" />
          </span>
        </>
      )}
      {item && <span className="here">{item.label}</span>}
    </>
  );
}

/* ---------------------------------------------------------------- banner */
function BannerDock() {
  const { bannerState, closeBanner } = useShell();
  if (!bannerState) return <div className="banner" id="banner" hidden />;
  const tone = bannerState.tone;
  return (
    <div className={"banner" + (tone ? " " + tone : "")} id="banner">
      <Icon name={tone === "bad" || tone === "warn" ? "alert" : tone === "ok" ? "check" : "shield"} />
      <div className="banner-msg">{bannerState.msg}</div>
      <button className="banner-x" data-act="banner-close" aria-label="Dismiss" onClick={closeBanner}>
        <Icon name="x" />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------- activity */
/* THE BELL. Reads the same trail the Audit log does — `v1/admin/audit/`, one
   fetch per open, newest 25 — instead of the browser-side array of invented
   events it used to render. It is a peek at that page, never a second source:
   same rows, same order, and "Full log" is the same query without the limit.

   Fetched on OPEN, not on mount. The shell renders on every route change and
   nobody watches a bell they have not pressed; polling it would be a request
   per minute for a list that is usually unchanged. */
function ActivityButton() {
  const shell = useShell();
  const ref = useRef<HTMLButtonElement>(null);
  const { go } = useNav();
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  /* Nobody with no audit access should be offered a bell that can only ever
     say 403 — locked actions are ABSENT, not greyed, here as everywhere. */
  if (!can("audit")) return null;

  const dayOf = (ts: string | null) => (ts ? ts.slice(0, 10) : "");
  const dayLabel = (day: string) => {
    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const y = new Date(today); y.setDate(today.getDate() - 1);
    if (day === iso(today)) return "Today";
    if (day === iso(y)) return "Yesterday";
    /* Its own Intl call rather than ui/format's fmtDate: this one wants the
       locale's own rendering of a day heading, and "15 Aug 2026" is one line. */
    const d = new Date(day + "T00:00:00");
    return isNaN(d.getTime()) ? day
      : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };
  const timeOf = (ts: string | null) => {
    if (!ts) return "";
    const d = new Date(ts);
    return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  const body = (list: AuditEntry[] | null, error: boolean) => {
    if (error) return <div className="pop-b"><div className="faint" style={{ padding: "14px 12px" }}>
      Could not reach the audit log.</div></div>;
    if (list === null) return <div className="pop-b"><div className="faint" style={{ padding: "14px 12px" }}>
      Loading…</div></div>;
    if (!list.length) return <div className="pop-b"><div className="faint" style={{ padding: "14px 12px" }}>
      Nothing recorded yet.</div></div>;

    const byDay: Record<string, AuditEntry[]> = {};
    list.forEach((a) => { (byDay[dayOf(a.ts)] = byDay[dayOf(a.ts)] || []).push(a); });
    return (
      <div className="pop-b">
        {Object.keys(byDay).sort().reverse().map((day) => (
          <div key={day}>
            <div className="dayline">{dayLabel(day)}</div>
            {byDay[day].map((a) => {
              /* Straight to the module's own slice of the log. There is no
                 per-entry route to offer: the trail records what happened, and
                 the record it happened to may since have been deleted — which
                 is often exactly the entry somebody is reading. */
              const to = "#/audit?module=" + encodeURIComponent(a.module);
              return (
                <button key={a.id} className="fd" data-go={to}
                  style={{ width: "100%", textAlign: "left" }}
                  onClick={() => { shell.closePop(); go(to); }}>
                  <span className={"tag " + (DESTRUCTIVE_ACTION.test(a.action) ? "bad" : "")}>
                    {a.action.replace(/_/g, " ")}
                  </span>
                  <span className="bd">
                    {a.detail || moduleLabel(a.module)}
                    <span className="by">{a.actor || "system"}{a.role ? " · " + a.role : ""}</span>
                  </span>
                  <span className="at">{timeOf(a.ts)}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const chrome = (list: AuditEntry[] | null, error: boolean) => (
    <>
      <div className="pop-h">
        <Icon name="bell" />
        <b>Activity</b>
        <span className="spacer" />
        <span className="faint" style={{ fontSize: 12 }}>All modules</span>
      </div>
      {body(list, error)}
      <div className="pop-f">
        Append-only · the same trail the Audit log shows
        <span className="spacer" />
        <button className="btn sm" data-go="#/audit"
          onClick={() => { shell.closePop(); go("#/audit"); }}>Full log</button>
      </div>
    </>
  );

  const open = () => {
    const el = ref.current;
    if (!el) return;
    if (shell.popAnchor === el) { shell.closePop(); return; }

    /* Opened with whatever was last fetched — a re-open should not blank the
       list it just showed — and refreshed underneath. */
    setFailed(false);
    shell.openPop(el, chrome(rows, false), { width: 460 });
    call(AdminOpsService.audit({ pageSize: 25 }))
      .then((d) => {
        setRows(d.entries);
        if (ref.current) shell.openPop(ref.current, chrome(d.entries, false), { width: 460 });
      })
      .catch(() => {
        setFailed(true);
        if (ref.current) shell.openPop(ref.current, chrome(rows, true), { width: 460 });
      });
  };

  return (
    <button ref={ref} className="tb-btn" data-act="activity" aria-label="Activity" title="Activity"
      onClick={open}>
      <Icon name="bell" />
      {/* The pip used to be permanent — a notification dot that never cleared
          says nothing. It marks a failed read now, which is the one thing about
          this button worth flagging without opening it. */}
      {failed ? <span className="pip" /> : null}
    </button>
  );
}

/* The same words the server counts as destructive (DESTRUCTIVE_WORDS in
   AuditValidators.py), for toning a row only — the filtering and the counts
   are the server's. */
const DESTRUCTIVE_ACTION = /delete|reject|cancel|archive|revoke|remove|reverse/i;

/* --------------------------------------------------------------- account */
function AccountButton({ session }: { session: MePermissions | null }) {
  const shell = useShell();
  const { go } = useNav();
  const ref = useRef<HTMLButtonElement>(null);
  const [, force] = useState(0);
  const user = session ? session.user : null;
  const roleLabel = session ? session.role || "Pending role" : "—";

  const open = () => {
    const el = ref.current;
    if (!el) return;
    if (shell.popAnchor === el) {
      shell.closePop();
      return;
    }
    const grants: string[] = session ? grantsOf(session) : [];
    const swatch = (act: "theme" | "density", opts: [string, string][], cur: string) => (
      <div className="btn-group" style={{ width: "100%" }}>
        {opts.map((o) => (
          <button
            key={o[0]}
            style={{ flex: 1, justifyContent: "center" }}
            className={cur === o[0] ? "on" : ""}
            data-act={act}
            data-v={o[0]}
            onClick={() => {
              if (act === "theme") setTheme(o[0]);
              else setDensity(o[0]);
              force((n) => n + 1);
              shell.closePop();
            }}
          >
            {o[1]}
          </button>
        ))}
      </div>
    );
    const item = (to: string, ico: string, label: string, right?: string) => (
      <button
        className="mi"
        data-go={to}
        onClick={() => {
          shell.closePop();
          go(to);
        }}
      >
        <Icon name={ico} />
        {label}
        {right && <span className="r">{right}</span>}
      </button>
    );

    shell.openPop(
      el,
      <>
        <div className="pop-h">
          <span className={"av lg " + avatarTone(user ? user.name : "")}>
            {user ? user.initials : "??"}
          </span>
          <span>
            <b style={{ fontSize: 13.5 }}>{user ? user.name : "Not signed in"}</b>
            <div className="faint" style={{ fontSize: 12 }}>
              {roleLabel}
            </div>
          </span>
        </div>
        <div className="pop-b">
          <div style={{ padding: "8px 10px 4px" }}>
            <div className="faint" style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 7 }}>
              EFFECTIVE ACCESS · THIS SESSION
            </div>
            <div className="chiprow">
              {grants.length ? (
                grants.map((g) => (
                  <span className="chip" key={g}>
                    {g}
                  </span>
                ))
              ) : (
                <span className="chip">No modules</span>
              )}
            </div>
            <div className="faint" style={{ fontSize: 11.5, marginTop: 8, lineHeight: 1.45 }}>
              Resolved fresh from the user record on every load. No client-held copy is ever the
              source of truth.
            </div>
          </div>
          <div className="msep" />
          {item("#/team", "user", "My account")}
          {can("roles") && item("#/roles", "shield", "Effective access")}
          <button
            className="mi"
            data-act="preview"
            onClick={() => {
              shell.closePop();
              window.open(config.FRONTEND_URL, "_blank");
              shell.toast("Portal opened in a new tab — a one-way preview, not a role change.");
            }}
          >
            <Icon name="ext" />
            Preview portal<span className="r">↗</span>
          </button>
          <button
            className="mi"
            data-act="shortcuts"
            onClick={() => {
              shell.closePop();
              shell.shortcuts();
            }}
          >
            <Icon name="search" />
            Keyboard shortcuts<span className="r">?</span>
          </button>
          <div className="msep" />
          <div style={{ padding: "6px 10px 10px" }}>
            <div className="faint" style={{ fontSize: "var(--text-xs)", fontWeight: 600, marginBottom: 6 }}>
              THEME
            </div>
            {swatch("theme", [["light", "Light"], ["dark", "Dark"]], currentTheme())}
            <div className="faint" style={{ fontSize: "var(--text-xs)", fontWeight: 600, margin: "10px 0 6px" }}>
              DENSITY
            </div>
            {swatch("density", [["comfortable", "Comfortable"], ["compact", "Compact"]], currentDensity())}
          </div>
          <div className="msep" />
          <SignOut onDone={() => shell.closePop()} />
        </div>
        <div className="pop-f">
          <span className="faint" style={{ fontSize: 11.5 }}>
            No role switcher — roles are not a client-side toggle.
          </span>
        </div>
      </>,
      { width: 288, above: true }
    );
  };

  return (
    <button ref={ref} className="sb-user" data-act="account" onClick={open}>
      <span className={"av " + avatarTone(user ? user.name : "")} id="meAvatar">
        {user ? user.initials : ""}
      </span>
      <span className="who rail-hide">
        <b id="meName">{user ? user.name : "…"}</b>
        <span id="meRole">{user ? roleLabel : "…"}</span>
      </span>
      {/* inline rather than <Icon>, to keep the prototype's own colour override */}
      <svg className="ic sm rail-hide" viewBox="0 0 24 24" style={{ color: "var(--text-3)" }}>
        <path d="m6 9.5 6 6 6-6" />
      </svg>
    </button>
  );
}

/* Sign-out ends the server-side UserSession (best-effort — local tokens are
   cleared regardless of whether that call succeeds) and then clears the
   cached matrix, same as the guard elsewhere: local state is cleared even on
   a failed request. */
function SignOut({ onDone }: { onDone: () => void }) {
  return (
    <Link
      className="mi dgr"
      to="/login?bye=1"
      onClick={() => {
        void AuthService.signout().catch(() => {});
        clearSession();
        onDone();
      }}
    >
      <Icon name="logout" />
      Sign out
    </Link>
  );
}

/* --------------------------------------------------------------- recents */
export function remember(route: string, id: string) {
  let list = LS.get<{ route: string; id: string; at: number }[]>("ib_admin_recents", []);
  list = list.filter((r) => !(r.route === route && r.id === id));
  list.unshift({ route, id, at: Date.now() });
  LS.set("ib_admin_recents", list.slice(0, 12));
}

function avatarTone(name: string) {
  let n = 0;
  const s = String(name || "");
  for (let i = 0; i < s.length; i++) n += s.charCodeAt(i);
  return ["", "n1", "n2", "n3", "n4"][n % 5];
}
