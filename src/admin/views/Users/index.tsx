/* =============================================================================
   Users Management — Business Ops · the route component.
   -----------------------------------------------------------------------------
   ONE route, four faces, one record screen.

     #/users                        every registered identity — the default
     #/users?view=members           the member base, narrower question
     #/users?view=renewals          the operational queue
     #/users?view=analytics         growth, conversion, retention, revenue
     #/users/:id                    one user, whole
     #/users/:id?tab=…&term=…       which face of the record

   WHY ONE ROUTE AND NOT FOUR. The wireframe put these in the sidebar as
   separate nav rows. They are readings of ONE population, and separate routes
   would have meant several module rows in the permission matrix for a single
   access decision, and a Back button that walks out of the module when you
   meant to widen the question. As one route with a view band they share the
   filters, the derivation and the URL — narrowing the list and then switching
   to Members keeps what you narrowed.

   THERE IS NO OVERVIEW FACE. It and Analytics were two dashboards over one
   population: the same headline counts, different windows, agreeing only
   because both called the same derivation. The Overview content is in
   Analytics, and `#/users` opens on the list, which is what the address reads
   like and what somebody arriving here is usually after.

   NO API YET. Everything comes from src/content/users/*.json through store.ts,
   which is the only file that knows that. See src/proto/v-2.2.0.0/.
   ============================================================================= */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { hashToPath, usePageChrome } from "../../shell/AdminShell";
import { qs } from "../../ui";
import type { Params } from "./store";
import { FILTER_KEYS, countsOf, useAllRows } from "./store";
import List from "./List";
import RenewalQueue from "./RenewalQueue";
import Analytics from "./Analytics";
import Detail from "./Detail";
import "./users.css";
import "./charts.css";
import "./blocks.css";

const ROUTE = "#/users";

export const merge = (p: Params, extra: Params): Params => {
  const o: Params = { ...p };
  Object.keys(extra).forEach((k) => { o[k] = extra[k]; });
  return o;
};
export const omit = (p: Params, keys: string[]): Params => {
  const o: Params = {};
  Object.keys(p).forEach((k) => { if (keys.indexOf(k) < 0) o[k] = p[k]; });
  return o;
};
export const listHash = (p: Params) => ROUTE + qs(p as Record<string, string>);
export const userHash = (id: string, p: Params) =>
  ROUTE + "/" + encodeURIComponent(id) + qs(p as Record<string, string>);

export default function Users() {
  const raw = useParams().id;
  const id = raw ? decodeURIComponent(raw) : null;
  const [sp] = useSearchParams();
  const navigate = useNavigate();

  const p = useMemo(() => {
    const o: Params = {};
    sp.forEach((v, k) => { if (v) o[k] = v; });
    return o;
  }, [sp]);

  /* `users` is the default and carries no param, so `#/users` is the directory
     rather than a dashboard nobody asked for on the way to it. */
  const view = p.view || "users";
  const rows = useAllRows();

  /* ------------------------------------------------------------ topbar ---
     THE SCOPE LIVES HERE, not on the page. Two figures, unfiltered on purpose:
     how big the base is and how much of it is entitled. They must not change
     meaning because somebody narrowed the list below them, which is exactly
     what would happen if they were counted off the filtered set. */
  const c = useMemo(() => countsOf(rows), [rows]);
  const crumbs = useMemo(() => (
    <>
      <span className="tb-title">Users Management</span>
      <span className="tb-stats">
        <span className="tb-stat ro"><span className="k">users</span><span className="v tnum">{c.total}</span></span>
        <span className="tb-stat ro"><span className="k">members</span><span className="v tnum">{c.activeMembers}</span></span>
        <span className="tb-stat ro"><span className="k">ending soon</span><span className="v tnum">{c.expiringSoon}</span></span>
      </span>
    </>
  ), [c.total, c.activeMembers, c.expiringSoon]);

  /* Where "up" is: the list you opened the record from, filters and all, so
     Back is a return rather than a reset. */
  usePageChrome(
    { crumbs, right: null, parent: id ? listHash(omit(p, ["tab", "term"])) : null },
    (id ? "rec" : view) + ":" + c.total + "/" + c.activeMembers + "/" + c.expiringSoon,
  );

  /* ----------------------------------------------------------- filters ---
     A filter change is not a place you navigated TO — it is the same place,
     narrowed. `replace` keeps Back meaning "leave this list" rather than
     "undo one dropdown", which is the only thing anyone presses it for here.
     Search is debounced for the same reason at keystroke scale. */
  const timer = useRef<number | undefined>(undefined);
  const goFilter = useCallback((hash: string) => {
    navigate(hashToPath(hash), { replace: true });
  }, [navigate]);

  /* EVERY FILTER CHANGE RETURNS TO PAGE 1. Page 3 of the unfiltered directory
     is usually past the end of a filtered one, and the empty table that
     follows reads as "nothing matches" when the truth is "not on page 3". */
  const onFilter = useCallback((name: string, value: string) => {
    goFilter(listHash(merge(omit(p, ["page"]), { [name]: value || undefined })));
  }, [p, goFilter]);

  const onSearch = useCallback((name: string, value: string) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () => goFilter(listHash(merge(omit(p, ["page"]), { [name]: value || undefined }))), 220);
  }, [p, goFilter]);

  const onUnfilter = useCallback((k: string) => {
    if (k === "*") return goFilter(listHash({ view: p.view }));
    /* A key may carry dependants, joined by "+": clearing the registered range
       has to clear the from/to it was made of, or the next range silently
       inherits the old custom bounds. */
    goFilter(listHash(omit(p, k.split("+").concat(["page"]))));
  }, [p, goFilter]);

  const onView = useCallback((v: string) => {
    /* Switching face keeps the filters and drops the page and the flag: the
       flag belongs to the queue that set it, and carrying "expiring soon" into
       Analytics would silently narrow a dashboard nobody asked to narrow. */
    goFilter(listHash(merge(omit(p, ["page", "flag"]), { view: v === "users" ? undefined : v })));
  }, [p, goFilter]);

  const onPage = useCallback((n: number) => {
    goFilter(listHash(merge(p, { page: String(n) })));
  }, [p, goFilter]);

  /* SEVERAL PARAMS, ONE NAVIGATION. A date range is two values set by one
     gesture; pushing them through `onFilter` twice would navigate twice, and
     the second call would read a stale `p` and drop the first. */
  const onParams = useCallback((patch: Params) => {
    goFilter(listHash(merge(omit(p, ["page"]), patch)));
  }, [p, goFilter]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (id) {
    /* THE RECORD GETS ITS OWN FILTER HANDLER, and it has to. `onFilter` above
       builds `listHash(...)` — `#/users?…` with no record segment — so wiring
       the record's tab strip to it navigated back to the list on every tab
       click and on every term you opened. `tab` and `term` are parameters OF
       the record, not filters of a list, and they have to keep the id. */
    const onRecordFilter = (name: string, value: string) =>
      goFilter(userHash(id, merge(p, { [name]: value || undefined })));
    return <Detail id={id} p={p} rows={rows} onFilter={onRecordFilter} />;
  }

  const shared = { p, rows, onView, onFilter, onSearch, onUnfilter, onPage, onParams };
  if (view === "members") return <List {...shared} scope="members" />;
  if (view === "renewals") return <RenewalQueue {...shared} />;
  if (view === "analytics") return <Analytics {...shared} />;
  return <List {...shared} scope="users" />;
}

/* Re-exported so the command palette and any cross-module link build the same
   addresses this module does, rather than hand-writing hashes. */
export { FILTER_KEYS };
export const usersRoute = (p: Params = {}) => listHash(p);
