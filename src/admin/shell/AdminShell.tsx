/* =============================================================================
   Interior bazzar — Admin · the shell
   -----------------------------------------------------------------------------
   The container every module renders into. Ported from admin-access.html +
   admin-shell.js. It owns four things and nothing else:

     1. Where you are   — navigation, routing, breadcrumbs, active state
     2. What needs you  — the aggregated queue across every module
     3. How you get there — global search, cross-module links, recents
     4. Who you are     — session, identity, effective access, sign out

   It owns no business data. Every number it shows is read from IBData; every
   action it offers is a link into a module.

   ROUTING — the prototype is a hash router (`#/deals/IB-D-1042?tab=x`); this
   app uses real paths (`/deals/IB-D-1042?tab=x`). Every ported view still
   emits the prototype's `#/…` strings, and `go()` is the single place that
   translates. One function, so no view had to be rewritten to move house.
   ============================================================================= */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { Icon, richText } from "../ui";
import { setGo } from "../ui/nav";
import { IBData, IBTeam } from "../engines";
import config from "../../config";
import { GROUP_OF, HOME_ROUTE, ITEMS, MODULES } from "./modules";
import { LS, currentDensity, currentTheme, setDensity, setTheme, useShell } from "./ShellContext";
import { CommandPalette } from "./CommandPalette";

/* ------------------------------------------------------------------- gate */
/* v1 asks IBTeam, which resolves the signed-in user's roles into a flat
   permission set. No view may ever branch on a role NAME. (TEAM_OPERATION §0.3)
   If the Team engine is not loaded it falls back to permissive, because a
   missing permission system must not silently lock a developer out of a
   prototype. That fallback is safe here and would NOT be safe on a server:
   there, an unavailable authorization service must deny, not allow. */
export function can(moduleKey: string, action?: string): boolean {
  const T = IBTeam;
  if (!T) return true;
  return T.can(T.currentUser(), moduleKey, action || "view");
}
export const canWrite = (moduleKey: string, action?: string) => can(moduleKey, action || "edit");

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
export function usePageChrome(c: Chrome) {
  const set = useContext(ChromeCtx);
  const location = useLocation();
  const here = location.pathname + location.search;
  const latest = useRef(c);
  latest.current = c;
  useEffect(() => {
    set(latest.current);
    return () => set({});
  }, [set, here]);
}

/* -------------------------------------------------------------- navigation */
const NavCtx = createContext<{ go: (hash: string) => void; back: () => void }>({
  go: () => {},
  back: () => {},
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
  /* One return mechanism for the whole panel. Three sources, tried in order,
     and none of them can return the page it is already on:
       1. in-session history   → so the panel's Back and the browser's Back are
                                 the same movement, not two
       2. a declared parent    → how a directly-opened URL or a refresh still
                                 knows where "up" is
       3. the module list      → last resort, and it replaces rather than pushes */
  const stack = useRef<string[]>([]);
  const here = location.pathname + location.search;
  useEffect(() => {
    const s = stack.current;
    if (s[s.length - 1] === here) return; // a re-render, not a move
    if (s.length > 1 && s[s.length - 2] === here) {
      s.pop();
      return;
    } // browser Back
    s.push(here);
    if (s.length > 30) s.shift();
  }, [here]);

  /* Back belongs on the screens you ARRIVE at — a record, a create flow, a
     sub-mode. On a module list the sidebar is already the wayfinding, and a
     Back button there would only offer a loop between two lists. */
  const search = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const isDeep = !!(id || search.get("new") || search.get("mode") || search.get("view") === "tags");

  const backTo = useCallback((): { path: string; history: boolean } | null => {
    if (!known || !isDeep) return null;
    if (stack.current.length > 1)
      return { path: stack.current[stack.current.length - 2], history: true };
    /* `false`, not null: a module saying there is no "up" from here at all —
       Deals says it for a deal open in Chat, where the list is already the left
       pane. null only means "I have no opinion", and falls through to the list. */
    if (chrome.parent === false) return null;
    if (chrome.parent) {
      const p = hashToPath(chrome.parent);
      if (p !== here) return { path: p, history: false };
    }
    const list = "/" + route;
    return list === here ? null : { path: list, history: false };
  }, [known, isDeep, chrome.parent, here, route]);

  const back = useCallback(() => {
    const t = backTo();
    if (!t) return;
    if (t.history) {
      window.history.back();
      return;
    }
    navigate(t.path, { replace: true }); // a fallback replaces; it is not a step forward
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
          q: "quotations",
          i: "invoices",
          s: "plans",
          t: "team",
          y: "design",
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
    document.title = (ITEMS[route] ? ITEMS[route].label + " · " : "") + "Interior bazzar Admin";
    if (scroller.current) scroller.current.scrollTop = 0;
    setStuck(false);
    if (window.matchMedia && window.matchMedia("(max-width:1180px)").matches) setNavOpen(false);
    if (id && known) remember(route, id);
  }, [route, id, known, here]);

  const user = IBData.TeamStore.current();
  const badges = IBData.derive.badges();
  const t = backTo();

  return (
    <NavCtx.Provider value={{ go, back }}>
      <ChromeCtx.Provider value={setChrome}>
        <div className={"app" + (railed ? " rail" : "") + (navOpen ? " nav-open" : "")} id="app">
          {/* ================================================== SIDEBAR === */}
          <aside className="sidebar" aria-label="Modules">
            <div className="sb-top">
              <button className="sb-brand" data-go={"#/" + HOME_ROUTE} title="Interior bazzar Admin" onClick={() => go("#/" + HOME_ROUTE)}>
                <span className="sb-mark">ib</span>
                <span className="sb-name rail-hide">
                  Interior bazzar<small>Admin</small>
                </span>
              </button>
            </div>

            <div className="sb-tools">
              <button className="sb-search" data-act="search" onClick={() => setPaletteOpen(true)}>
                <Icon name="search" />
                <span className="rail-hide">Search</span>
                <span className="kbd rail-hide">⌘K</span>
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
              <AccountButton user={user} />
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
                <span className="kbd rail-hide">[</span>
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
                <Outlet />
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

  const item = ITEMS[route];
  const grp = GROUP_OF[route];

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
function ActivityButton() {
  const shell = useShell();
  const ref = useRef<HTMLButtonElement>(null);
  const { go } = useNav();

  const open = () => {
    const el = ref.current;
    if (!el) return;
    if (shell.popAnchor === el) {
      shell.closePop();
      return;
    }
    const byDay: Record<string, AuditRow[]> = {};
    (IBData.audit as AuditRow[]).forEach((a) => {
      const day = a.at.slice(0, 10);
      (byDay[day] = byDay[day] || []).push(a);
    });
    const todayKey = "2026-06-28";
    const yKey = "2026-06-27";
    shell.openPop(
      el,
      <>
        <div className="pop-h">
          <Icon name="bell" />
          <b>Activity</b>
          <span className="spacer" />
          <span className="faint" style={{ fontSize: 12 }}>
            All modules
          </span>
        </div>
        <div className="pop-b">
          {Object.keys(byDay)
            .sort()
            .reverse()
            .map((day) => (
              <div key={day}>
                <div className="dayline">
                  {day === todayKey ? "Today" : day === yKey ? "Yesterday" : IBData.fmtDate(day)}
                </div>
                {byDay[day].map((a, i) => (
                  <button
                    key={i}
                    className="fd"
                    data-go={a.route}
                    style={{ width: "100%", textAlign: "left" }}
                    onClick={() => {
                      shell.closePop();
                      go(a.route);
                    }}
                  >
                    <span className={"tag " + (a.tone || "")}>{a.type}</span>
                    <span className="bd">
                      {richText(a.text)}
                      <span className="by">
                        {a.actor} · {a.role}
                      </span>
                    </span>
                    <span className="at">{a.at.slice(11)}</span>
                  </button>
                ))}
              </div>
            ))}
        </div>
        <div className="pop-f">
          Append-only · <span className="mono">ib_admin_audit</span>
          <span className="spacer" />
          <button
            className="btn sm"
            data-go="#/audit"
            onClick={() => {
              shell.closePop();
              go("#/audit");
            }}
          >
            Full log
          </button>
        </div>
      </>,
      { width: 460 }
    );
  };

  return (
    <button ref={ref} className="tb-btn" data-act="activity" aria-label="Activity" title="Activity" onClick={open}>
      <Icon name="bell" />
      <span className="pip" />
    </button>
  );
}

type AuditRow = {
  at: string;
  route: string;
  type: string;
  tone?: string;
  text: string;
  actor: string;
  role: string;
};

/* --------------------------------------------------------------- account */
function AccountButton({ user }: { user: TeamUser | null }) {
  const shell = useShell();
  const { go } = useNav();
  const ref = useRef<HTMLButtonElement>(null);
  const [, force] = useState(0);

  const open = () => {
    const el = ref.current;
    if (!el) return;
    if (shell.popAnchor === el) {
      shell.closePop();
      return;
    }
    const grants: string[] = user && user.role ? IBData.TeamStore.ROLE_GRANTS[user.role] || [] : [];
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
            {initials(user ? user.name : "??")}
          </span>
          <span>
            <b style={{ fontSize: 13.5 }}>{user ? user.name : "Not signed in"}</b>
            <div className="faint" style={{ fontSize: 12 }}>
              {user ? IBData.TeamStore.ROLE_LABEL[user.role] || "Pending role" : "—"}
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
          {item("#/roles", "shield", "Effective access")}
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
          {item("#/design", "sparkle", "Design system", "↗")}
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
        {initials(user ? user.name : "")}
      </span>
      <span className="who rail-hide">
        <b id="meName">{user ? user.name : "…"}</b>
        <span id="meRole">
          {user ? IBData.TeamStore.ROLE_LABEL[user.role] || "Pending role" : "…"}
        </span>
      </span>
      {/* inline rather than <Icon>, to keep the prototype's own colour override */}
      <svg className="ic sm rail-hide" viewBox="0 0 24 24" style={{ color: "var(--text-3)" }}>
        <path d="m6 9.5 6 6 6-6" />
      </svg>
    </button>
  );
}

function SignOut({ onDone }: { onDone: () => void }) {
  return (
    <Link
      className="mi dgr"
      to="/login?bye=1"
      onClick={() => {
        IBData.TeamStore.clearSession();
        onDone();
      }}
    >
      <Icon name="logout" />
      Sign out
    </Link>
  );
}

type TeamUser = { name: string; role: string; status?: string } | null;

/* --------------------------------------------------------------- recents */
export function remember(route: string, id: string) {
  let list = LS.get<{ route: string; id: string; at: number }[]>("ib_admin_recents", []);
  list = list.filter((r) => !(r.route === route && r.id === id));
  list.unshift({ route, id, at: Date.now() });
  LS.set("ib_admin_recents", list.slice(0, 12));
}

function initials(name: string) {
  const p = String(name || "").trim().split(/\s+/);
  return ((p[0] || "")[0] || "").toUpperCase() + ((p[1] || "")[0] || "").toUpperCase();
}
function avatarTone(name: string) {
  let n = 0;
  const s = String(name || "");
  for (let i = 0; i < s.length; i++) n += s.charCodeAt(i);
  return ["", "n1", "n2", "n3", "n4"][n % 5];
}
