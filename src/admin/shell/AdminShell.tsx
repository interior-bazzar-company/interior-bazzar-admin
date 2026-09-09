/* =============================================================================
   Interior bazzar — Admin · the shell
   -----------------------------------------------------------------------------
   The container every module renders into. It owns four things and nothing
   else:

     1. Where you are   — navigation, routing, breadcrumbs, active state
     2. What needs you  — the aggregated queue across every module
     3. How you get there — global search, cross-module links, recents
     4. Who you are     — session, identity, effective access, sign out

   It owns no business data and no store of its own: the Activity bell reads
   the server's audit trail, the command menu searches deals through the API,
   and every action it offers is a link into a module.

   ROUTING — the prototype was a hash router (`#/deals/IB-D-1042?tab=x`); this
   app uses real paths (`/deals/IB-D-1042?tab=x`). Every ported view still
   emits `#/…` strings, and `go()` is the single place that translates.

   LAYOUT — a 264px sidebar that collapses to a 64px rail (kept per browser),
   a 56px topbar, and a scrolling workspace capped at 1440px. Under `lg` the
   sidebar leaves the page and returns as a slide-over behind the menu button.
   ========================================================================== */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { Dialog as AriaDialog, Modal as AriaModal, ModalOverlay as AriaModalOverlay } from "react-aria-components";
import { Tooltip as UITooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { cx } from "@/utils/cx";
import IB_ICON from "../../assets/images/IB_Icon.png";
import { Alert, Avatar, Button, Icon, IconButton, MenuDivider, MenuRow, MenuSection, Pill, Segmented } from "../ui";
import { go as uiGo, setGo } from "../ui/nav";
import config from "../../config";
import { AuthService } from "../../api/modules/auth";
import AdminOpsService, { call } from "../../api/modules/adminOps";
import type { AuditEntry, MePermissions } from "../../api/modules/adminOps";
import { getModules, getGroupOf, getItems, moduleLabel, HOME_ROUTE } from "./modules";
import { can, canWrite, clearSession, getSession, grantsOf } from "../auth/session";
import { LS, THEMES, PopBody, PopFoot, PopHead, currentTheme, setTheme, useShell } from "./ShellContext";
import { CommandPalette } from "./CommandPalette";
import ErrorBoundary from "../../components/shared/ErrorBoundary";

/* ------------------------------------------------------------------- gate */
/* The single permission gate for the whole panel, resolved server-side and
   cached in admin/auth/session.ts. No view may ever branch on a role NAME.
   Re-exported here because every view already imports it from this path. */
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

/** A view declares its own topbar and its own parent. It republishes ONCE PER
    LOCATION, not once per render; `key` is for chrome whose CONTENTS arrive
    after the page does. */
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

  const MODULES = getModules();
  const ITEMS = getItems();

  const route = (location.pathname.split("/").filter(Boolean)[0] || HOME_ROUTE).toLowerCase();
  const id = params.id ? decodeURIComponent(params.id) : null;
  const known = !!ITEMS[route];

  const go = useCallback((hash: string) => navigate(hashToPath(hash)), [navigate]);
  useEffect(() => setGo(go), [go]);

  const here = location.pathname + location.search;
  const search = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const isDeep = !!(id || search.get("new") || search.get("mode") || search.get("view") === "tags");

  /* One return mechanism for the whole panel, and it goes UP, not backwards. */
  const backTo = useCallback((): { path: string } | null => {
    if (!known || !isDeep) return null;
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
    navigate(t.path, { replace: true });
  }, [backTo, navigate]);

  const toggleRail = useCallback(() => {
    setRailed((v) => {
      LS.set("ib_admin_nav_collapsed", !v);
      return !v;
    });
  }, []);

  /* ------------------------------------------------------------ keyboard */
  useEffect(() => {
    let chord: string | null = null;
    let chordT: number | undefined;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typingNow = /INPUT|TEXTAREA|SELECT/.test(target.tagName || "") || target.isContentEditable;

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
        toggleRail();
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (chord === "g") {
        const map: Record<string, string> = { o: "overview", d: "deals", s: "plans", t: "team" };
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
  }, [go, shell, paletteOpen, toggleRail]);

  /* ------------------------------------------- title, scroll, mobile nav */
  useEffect(() => {
    const item = getItems()[route];
    document.title = (item ? item.label + " · " : "") + "Interior bazzar Admin";
    if (scroller.current) scroller.current.scrollTop = 0;
    setStuck(false);
    setNavOpen(false);
    if (id && known) remember(route, id);
  }, [route, id, known, here]);

  const session = getSession();
  /* No nav badges until they can be counted from the server. */
  const badges: Record<string, { n: number; alert: boolean }> = {};

  const sidebar = (
    <Sidebar
      modules={MODULES}
      route={route}
      railed={railed}
      badges={badges}
      session={session}
      onSearch={() => {
        setNavOpen(false);
        setPaletteOpen(true);
      }}
      onToggleRail={toggleRail}
      go={(h) => {
        setNavOpen(false);
        go(h);
      }}
    />
  );

  return (
    <NavCtx.Provider value={{ go, back }}>
      <ChromeCtx.Provider value={setChrome}>
        <div className={cx("flex h-dvh w-full overflow-hidden bg-secondary", railed && "is-rail")} id="app">
          {/* FIRST IN THE TAB ORDER, on every screen in the panel. */}
          <a
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[70] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary focus:shadow-lg focus:ring-1 focus:ring-secondary"
            href="#page"
            onClick={(e) => {
              e.preventDefault();
              const el = document.getElementById("page");
              if (el) {
                el.setAttribute("tabindex", "-1");
                el.focus();
              }
            }}
          >
            Skip to content
          </a>

          {/* ================================================== SIDEBAR === */}
          <aside
            className={cx("hidden h-full shrink-0 flex-col border-r border-secondary bg-nav transition-[width] duration-200 ease-out lg:flex", railed ? "w-16" : "w-[264px]")}
            aria-label="Modules"
          >
            {sidebar}
          </aside>

          {/* the same sidebar, as a slide-over under lg */}
          <AriaModalOverlay
            isOpen={navOpen}
            onOpenChange={setNavOpen}
            isDismissable
            className={({ isEntering, isExiting }) =>
              cx(
                "fixed inset-0 z-50 flex bg-overlay/50 backdrop-blur-[2px] lg:hidden",
                isEntering && "duration-200 ease-out animate-in fade-in",
                isExiting && "duration-150 ease-in animate-out fade-out",
              )
            }
          >
            <AriaModal
              className={({ isEntering, isExiting }) =>
                cx("h-full w-[280px] max-w-[85vw] outline-hidden", isEntering && "duration-200 ease-out animate-in slide-in-from-left", isExiting && "duration-150 ease-in animate-out slide-out-to-left")
              }
            >
              <AriaDialog aria-label="Modules" className="flex h-full flex-col bg-nav shadow-xl outline-hidden">
                {sidebar}
              </AriaDialog>
            </AriaModal>
          </AriaModalOverlay>

          {/* ================================================== CONTENT === */}
          <main className="flex h-full min-w-0 flex-1 flex-col">
            <header
              className={cx("z-20 flex h-14 shrink-0 items-center gap-2 border-b border-secondary bg-primary/90 px-3 backdrop-blur-sm md:px-4", stuck && "shadow-xs")}
              id="topbar"
            >
              <IconButton ico="menu" label="Open navigation" className="lg:hidden" onClick={() => setNavOpen(true)} />

              {/* THE BACK BUTTON IS GONE. The module title in the crumb slot is
                  the way up: pressing it returns to the module's default view. */}
              <nav className="flex min-w-0 flex-1 items-center gap-1.5 text-sm" id="crumbs" aria-label="Breadcrumb">
                <Crumbs claimed={chrome.crumbs} route={route} id={id} isDeep={isDeep} />
              </nav>

              <div className="flex shrink-0 items-center gap-2" id="tbslot">
                {chrome.right}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <IconButton ico="search" label="Search  ⌘K" data-act="search" onClick={() => setPaletteOpen(true)} />
                <ActivityButton />
              </div>
            </header>

            <BannerDock />

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" id="scroller" ref={scroller} onScroll={(e) => setStuck(e.currentTarget.scrollTop > 4)}>
              <div id="page" className="mx-auto w-full max-w-[1440px] px-4 py-5 md:px-6 md:py-6 lg:px-8">
                <ErrorBoundary resetKey={here}>
                  <Outlet />
                </ErrorBoundary>
              </div>
            </div>
          </main>
        </div>

        {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} go={go} />}
      </ChromeCtx.Provider>
    </NavCtx.Provider>
  );
}

/* ---------------------------------------------------------------- sidebar */
function Sidebar({
  modules,
  route,
  railed,
  badges,
  session,
  onSearch,
  onToggleRail,
  go,
}: {
  modules: ReturnType<typeof getModules>;
  route: string;
  railed: boolean;
  badges: Record<string, { n: number; alert: boolean }>;
  session: MePermissions | null;
  onSearch: () => void;
  onToggleRail: () => void;
  go: (hash: string) => void;
}) {
  return (
    <>
      {/* the brand row */}
      <div className={cx("flex h-14 shrink-0 items-center border-b border-secondary", railed ? "justify-center px-2" : "px-4")}>
        <button
          type="button"
          className="flex min-w-0 cursor-pointer items-center gap-2.5 rounded-lg outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2"
          data-go={"#/" + HOME_ROUTE}
          title="Interior bazzar Admin"
          onClick={() => go("#/" + HOME_ROUTE)}
        >
          <img className="size-8 shrink-0 rounded-lg" src={IB_ICON} alt="" />
          {!railed && (
            <span className="flex min-w-0 flex-col leading-none">
              <span className="truncate text-sm font-semibold text-primary">Interior bazzar</span>
              <span className="label-mono mt-0.5">Admin</span>
            </span>
          )}
        </button>
      </div>

      {/* search */}
      <div className={cx("shrink-0 py-3", railed ? "px-2" : "px-3")}>
        {railed ? (
          <RailTip label="Search  ⌘K">
            <button
              type="button"
              className="flex size-10 w-full cursor-pointer items-center justify-center rounded-lg text-fg-quaternary outline-focus-ring hover:bg-primary_hover hover:text-fg-quaternary_hover focus-visible:outline-2 focus-visible:outline-offset-2"
              data-act="search"
              aria-label="Search"
              onClick={onSearch}
            >
              <Icon name="search" size="md" />
            </button>
          </RailTip>
        ) : (
          <button
            type="button"
            className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 text-sm text-placeholder shadow-xs ring-1 ring-primary outline-focus-ring ring-inset hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-offset-2"
            data-act="search"
            onClick={onSearch}
          >
            <Icon name="search" size="sm" className="text-fg-quaternary" />
            <span className="flex-1 text-left">Search</span>
            <kbd className="rounded px-1 py-px font-mono text-2xs font-medium text-quaternary ring-1 ring-secondary ring-inset">⌘K</kbd>
          </button>
        )}
      </div>

      {/* the modules */}
      <nav className={cx("min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-hide", railed ? "px-2" : "px-3")} id="navScroll">
        {modules.map((g) => {
          const vis = g.items.filter((it) => can(it.key));
          if (!vis.length) return null;
          return (
            <div className="mb-3" key={g.group || "_"}>
              {g.group && !railed ? <div className="label-mono px-2 pt-2 pb-1.5">{g.group}</div> : null}
              {g.group && railed ? <div className="mx-auto my-2 h-px w-6 bg-border-secondary" aria-hidden="true" /> : null}
              <ul className="flex flex-col gap-px">
                {vis.map((it) => {
                  const on = route === it.route;
                  const b = it.q ? badges[it.q] : null;
                  const row = (
                    <a
                      href={"/" + it.route}
                      data-go={"#/" + it.route}
                      aria-current={on ? "page" : undefined}
                      className={cx(
                        "group/nav relative flex h-9 items-center gap-2.5 rounded-lg text-sm font-medium outline-focus-ring transition duration-100 focus-visible:outline-2 focus-visible:outline-offset-2",
                        railed ? "justify-center px-0" : "px-2.5",
                        on ? "bg-selected text-brand-secondary" : "text-secondary hover:bg-primary_hover hover:text-primary",
                      )}
                      style={on ? { boxShadow: "var(--nav-active-glow)" } : undefined}
                      onClick={(e) => {
                        e.preventDefault();
                        go("#/" + it.route);
                      }}
                    >
                      {on && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-brand-solid" />}
                      <Icon name={it.icon} size="md" className={cx("shrink-0", on ? "text-fg-brand-primary" : "text-fg-quaternary group-hover/nav:text-fg-quaternary_hover")} />
                      {!railed && <span className="min-w-0 flex-1 truncate">{it.label}</span>}
                      {!railed && b ? <Pill xs tone={b.alert ? "bad" : "neutral"} text={b.n} /> : null}
                    </a>
                  );
                  return (
                    <li key={it.route}>
                      {railed ? (
                        <RailTip label={it.label}>{row}</RailTip>
                      ) : (
                        row
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* the foot: you, and the rail toggle */}
      <div className={cx("flex shrink-0 flex-col gap-1 border-t border-secondary py-2", railed ? "items-center px-2" : "px-3")}>
        <AccountButton session={session} railed={railed} />
        <button
          type="button"
          className={cx(
            "hidden h-8 cursor-pointer items-center gap-2 rounded-lg text-xs font-medium text-quaternary outline-focus-ring hover:bg-primary_hover hover:text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 lg:flex",
            railed ? "w-10 justify-center" : "px-2.5",
          )}
          id="sbToggle"
          data-act="rail"
          aria-expanded={!railed}
          aria-controls="app"
          aria-label={railed ? "Expand sidebar" : "Collapse sidebar"}
          title={(railed ? "Expand sidebar" : "Collapse sidebar") + "  ·  ["}
          onClick={onToggleRail}
        >
          <Icon name={railed ? "chevr" : "chevl"} size="sm" />
          {!railed && <span>Collapse</span>}
        </button>
      </div>
    </>
  );
}

/* A tooltip for the rail — the label the collapsed row cannot show. */
function RailTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <UITooltip title={label} placement="right" delay={150}>
      <TooltipTrigger className="w-full">{children}</TooltipTrigger>
    </UITooltip>
  );
}

/* --------------------------------------------------------------- crumbs */
function Crumbs({ claimed, route, id, isDeep }: { claimed?: ReactNode; route: string; id: string | null; isDeep: boolean }) {
  if (claimed) return <>{claimed}</>;
  const item = getItems()[route];
  const grp = getGroupOf()[route];

  /* On a record, a create flow or a sub-mode the title IS the way up. */
  if (isDeep)
    return (
      <>
        <button
          type="button"
          className="flex min-w-0 cursor-pointer items-center gap-1 rounded-md text-sm font-semibold text-primary outline-focus-ring hover:text-brand-secondary focus-visible:outline-2 focus-visible:outline-offset-2"
          title={"Back to " + (item ? item.label : route)}
          onClick={() => uiGo("#/" + route)}
        >
          <Icon name="chevl" size="xs" className="text-fg-quaternary" />
          <span className="truncate">{item ? item.label : route}</span>
        </button>
        {id && <span className="truncate font-mono text-xs text-tertiary tnum">{id}</span>}
      </>
    );

  return (
    <>
      {grp && (
        <>
          <span className="hidden text-tertiary sm:inline">{grp}</span>
          <Icon name="chevr" size="xs" className="hidden text-fg-quaternary sm:inline" />
        </>
      )}
      {item && <span className="truncate font-semibold text-primary">{item.label}</span>}
    </>
  );
}

/* ---------------------------------------------------------------- banner */
function BannerDock() {
  const { bannerState, closeBanner } = useShell();
  if (!bannerState) return null;
  const tone = (bannerState.tone === "ok" || bannerState.tone === "warn" || bannerState.tone === "bad" ? bannerState.tone : "info") as "ok" | "warn" | "bad" | "info";
  return (
    <div className="shrink-0 border-b border-secondary bg-primary px-4 py-2" id="banner">
      <Alert tone={tone} onClose={closeBanner} className="py-2">
        {bannerState.msg}
      </Alert>
    </div>
  );
}

/* -------------------------------------------------------------- activity */
/* THE BELL. Reads the same trail the Audit log does — newest 25, fetched on
   OPEN, not on mount. */
function ActivityButton() {
  const shell = useShell();
  const ref = useRef<HTMLButtonElement>(null);
  const { go } = useNav();
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  if (!can("audit")) return null;

  const dayOf = (ts: string | null) => (ts ? ts.slice(0, 10) : "");
  const dayLabel = (day: string) => {
    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const y = new Date(today);
    y.setDate(today.getDate() - 1);
    if (day === iso(today)) return "Today";
    if (day === iso(y)) return "Yesterday";
    const d = new Date(day + "T00:00:00");
    return isNaN(d.getTime()) ? day : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };
  const timeOf = (ts: string | null) => {
    if (!ts) return "";
    const d = new Date(ts);
    return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  const body = (list: AuditEntry[] | null, error: boolean) => {
    if (error) return <div className="px-4 py-6 text-center text-sm text-tertiary">Could not reach the audit log.</div>;
    if (list === null) return <div className="px-4 py-6 text-center text-sm text-tertiary">Loading…</div>;
    if (!list.length) return <div className="px-4 py-6 text-center text-sm text-tertiary">Nothing recorded yet.</div>;
    const byDay: Record<string, AuditEntry[]> = {};
    list.forEach((a) => {
      (byDay[dayOf(a.ts)] = byDay[dayOf(a.ts)] || []).push(a);
    });
    return (
      <div className="py-1">
        {Object.keys(byDay)
          .sort()
          .reverse()
          .map((day) => (
            <div key={day}>
              <div className="label-mono px-4 pt-3 pb-1.5">{dayLabel(day)}</div>
              {byDay[day].map((a) => {
                const to = "#/audit?module=" + encodeURIComponent(a.module);
                const bad = DESTRUCTIVE_ACTION.test(a.action);
                return (
                  <button
                    key={a.id}
                    type="button"
                    className="flex w-full cursor-pointer items-start gap-3 px-4 py-2 text-left outline-focus-ring hover:bg-primary_hover focus-visible:outline-2 focus-visible:-outline-offset-2"
                    data-go={to}
                    onClick={() => {
                      shell.closePop();
                      go(to);
                    }}
                  >
                    <Pill xs tone={bad ? "bad" : "neutral"} text={a.action.replace(/_/g, " ")} className="mt-0.5 shrink-0" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm text-primary">{a.detail || moduleLabel(a.module)}</span>
                      <span className="truncate text-xs text-tertiary">
                        {a.actor || "system"}
                        {a.role ? " · " + a.role : ""}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-xs text-quaternary tnum">{timeOf(a.ts)}</span>
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
      <PopHead>
        <Icon name="bell" size="sm" className="text-fg-quaternary" />
        <b className="text-sm font-semibold text-primary">Activity</b>
        <span className="flex-1" />
        <span className="text-xs text-tertiary">All modules</span>
      </PopHead>
      <PopBody>{body(list, error)}</PopBody>
      <PopFoot>
        Append-only · the same trail the Audit log shows
        <span className="flex-1" />
        <Button size="xs" color="secondary" data-go="#/audit" onClick={() => { shell.closePop(); go("#/audit"); }}>
          Full log
        </Button>
      </PopFoot>
    </>
  );

  const open = () => {
    const el = ref.current;
    if (!el) return;
    if (shell.popAnchor === el) {
      shell.closePop();
      return;
    }
    setFailed(false);
    shell.openPop(el, chrome(rows, false), { width: 440 });
    call(AdminOpsService.audit({ pageSize: 25 }))
      .then((d) => {
        setRows(d.entries);
        if (ref.current) shell.openPop(ref.current, chrome(d.entries, false), { width: 440 });
      })
      .catch(() => {
        setFailed(true);
        if (ref.current) shell.openPop(ref.current, chrome(rows, true), { width: 440 });
      });
  };

  return (
    <button
      ref={ref}
      type="button"
      className="relative flex size-9 cursor-pointer items-center justify-center rounded-md text-fg-quaternary outline-focus-ring transition duration-100 hover:bg-primary_hover hover:text-fg-quaternary_hover focus-visible:outline-2 focus-visible:outline-offset-2"
      data-act="activity"
      aria-label="Activity"
      title="Activity"
      onClick={open}
    >
      <Icon name="bell" size="md" />
      {failed ? <span className="absolute top-2 right-2 size-1.5 rounded-full bg-utility-red-500" /> : null}
    </button>
  );
}

const DESTRUCTIVE_ACTION = /delete|reject|cancel|archive|revoke|remove|reverse/i;

/* --------------------------------------------------------------- account */
function AccountButton({ session, railed }: { session: MePermissions | null; railed: boolean }) {
  const shell = useShell();
  const { go } = useNav();
  const ref = useRef<HTMLButtonElement>(null);
  const [, force] = useState(0);
  const user = session ? session.user : null;
  const roleLabel = session ? session.role || "Pending role" : "—";

  /* THE MENU IS REBUILT ON EVERY CHANGE, NOT RE-RENDERED: `openPop` takes a
     NODE, so a theme switch re-opens the menu against the same anchor with
     the state inside it true. */
  const open = (rebuild?: boolean) => {
    const el = ref.current;
    if (!el) return;
    if (!rebuild && shell.popAnchor === el) {
      shell.closePop();
      return;
    }
    const grants: string[] = session ? grantsOf(session) : [];
    shell.openPop(
      el,
      <>
        <PopHead>
          <Avatar name={user ? user.name : ""} />
          <span className="flex min-w-0 flex-col">
            <b className="truncate text-sm font-semibold text-primary">{user ? user.name : "Not signed in"}</b>
            <span className="truncate text-xs text-tertiary">{roleLabel}</span>
          </span>
        </PopHead>
        <PopBody>
          <div className="px-4 pt-3 pb-2">
            <div className="label-mono mb-1.5">Effective access · this session</div>
            <div className="flex flex-wrap gap-1">
              {grants.length ? grants.map((g) => <Pill key={g} xs tone="neutral" text={g} />) : <Pill xs tone="neutral" text="No modules" />}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-quaternary">Resolved fresh from the user record on every load. No client-held copy is ever the source of truth.</p>
          </div>
          <MenuDivider />
          <MenuSection>
            <MenuRow ico="user" label="My account" to="#/team" onClick={() => { shell.closePop(); go("#/team"); }} />
            {can("roles") ? <MenuRow ico="shield" label="Effective access" to="#/roles" onClick={() => { shell.closePop(); go("#/roles"); }} /> : null}
            <MenuRow
              ico="ext"
              label="Preview portal"
              right="↗"
              onClick={() => {
                shell.closePop();
                window.open(config.FRONTEND_URL, "_blank");
                shell.toast("Portal opened in a new tab — a one-way preview, not a role change.");
              }}
            />
            <MenuRow ico="help" label="Keyboard shortcuts" right="?" onClick={() => { shell.closePop(); shell.shortcuts(); }} />
          </MenuSection>
          <MenuDivider />
          <div className="px-4 pt-3 pb-3">
            <div className="label-mono mb-2">Appearance</div>
            <Segmented
              sm
              label="Theme"
              value={currentTheme()}
              options={THEMES.map((t) => ({ v: t.id, l: t.label }))}
              onPick={(v) => {
                setTheme(v);
                force((n) => n + 1);
                open(true);
              }}
            />
            <div id="themeHint" className="mt-2 text-xs text-quaternary">{(THEMES.find((x) => x.id === currentTheme()) || THEMES[0]).hint} · saved for this browser.</div>
          </div>
          <MenuDivider />
          <MenuSection>
            <SignOut onDone={() => shell.closePop()} />
          </MenuSection>
        </PopBody>
        <PopFoot>No role switcher — roles are not a client-side toggle.</PopFoot>
      </>,
      { width: 300, above: true, align: "left", cls: "pop-account" },
    );
  };

  const btn = (
    <button
      ref={ref}
      type="button"
      className={cx(
        "flex cursor-pointer items-center gap-2.5 rounded-lg outline-focus-ring transition duration-100 hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-offset-2",
        railed ? "size-10 justify-center" : "w-full px-2 py-1.5",
      )}
      data-act="account"
      onClick={() => open()}
    >
      <Avatar name={user ? user.name : ""} sm />
      {!railed && (
        <>
          <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
            <b className="truncate text-sm font-semibold text-primary" id="meName">
              {user ? user.name : "…"}
            </b>
            <span className="truncate text-xs text-tertiary" id="meRole">
              {user ? roleLabel : "…"}
            </span>
          </span>
          <Icon name="sort" size="sm" className="shrink-0 text-fg-quaternary" />
        </>
      )}
    </button>
  );
  return railed ? <RailTip label={user ? user.name : "Account"}>{btn}</RailTip> : btn;
}

function SignOut({ onDone }: { onDone: () => void }) {
  return (
    <Link
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-semibold text-error-primary outline-focus-ring hover:bg-error-primary focus-visible:outline-2 focus-visible:-outline-offset-2"
      to="/login?bye=1"
      onClick={() => {
        void AuthService.signout().catch(() => {});
        clearSession();
        onDone();
      }}
    >
      <Icon name="logout" size="sm" className="text-fg-error-secondary" />
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
