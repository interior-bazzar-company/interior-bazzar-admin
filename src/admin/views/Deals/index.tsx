/* =============================================================================
   Deals — Module 1 · the route component
   -----------------------------------------------------------------------------
   Every screen in DEALS_IA.md, wired to the engine. Three principles carried
   through every control:

     1. Locked actions are ABSENT, not greyed. A disabled button invites a click
        and a support ticket; a missing one states that this is not a step yet.
     2. Every modal states the rule BEFORE you commit, and prints the exact
        server code if it still rejects.
     3. The UI is a convenience, never the enforcement. The engine re-checks
        everything; rendering a different button changes nothing.

   This file is the prototype's `V.deals` plus its `V.__topbar` and `V.__parent`
   contributions: which view mode is on, what the topbar carries, and where
   "up" points from here.
   ============================================================================= */
import { useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Icon } from "../../ui";
import { usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import {
  listHash, omit, paramsOf, useDealsApi, useEngineTick, usePop, viewOf, VIEWS
} from "./useDeals";
import { DealsList, TbStats } from "./List";
import { ChatWorkspace } from "./Chat";
import { TagsView } from "./Tags";
import { DealDrawer } from "./Drawer";
import { ViewMenu } from "./menus";

export default function Deals() {
  useEngineTick();
  const routeParams = useParams();
  const [sp] = useSearchParams();
  const shell = useShell();
  const pop = usePop();

  const id = routeParams.id ? decodeURIComponent(routeParams.id) : null;
  const search = sp.toString();
  const p = useMemo(() => paramsOf(sp), [sp]);
  const view = viewOf(p);

  /* THE ONE FETCH — shared by all four views (chat/table/board/tags). Keyed
     on the filter params only: useDealsApi's own `key` already omits `view`
     and the selected `id` (see useDeals.ts), so switching between them reuses
     this same load instead of refiring the request or flashing empty. */
  const api = useDealsApi(p);

  /* ------------------------------------------------------------- topbar */
  /* Deals claims the breadcrumb slot for its view switcher. The crumb there
     would have read "Sales › Deals" directly above a heading already reading
     "Deals" — so the row is better spent on the one control that changes what
     the page is.

     One control instead of four tabs. It still names the current view — a bare
     icon would make "which view am I in" a question you can only answer by
     opening the menu. */
  const right = useMemo(() => (
    <button className="btn tb-view-btn" data-act="dl-view" aria-haspopup="menu"
      onClick={(e) => pop(e, <ViewMenu p={p} />, { width: 248, cls: "pop-views" })}>
      <Icon name="eye" />{VIEWS[view].label}<Icon name="chev" size="sm" />
    </button>
  ), [view, p, pop]);

  /* No scope line beside the title any more. "15 team deals · 11 open · 3 won"
     was a third rendering of counts the strip already gives per stage, sitting
     where you cannot click it.

     Chat is the one view whose body has no room for the strip — three panes
     already own the width — so it moves up into the bar instead, in one run:
     the counts beside the title and the money directly after Won, exactly as
     the table strip now reads. One scope computed once, so the counts and the
     figures cannot disagree. */
  const crumbs = useMemo(() => (
    view !== "chat"
      ? <span className="tb-title">Deals</span>
      : <>
          <span className="tb-title">Deals</span>
          <TbStats p={p} />
        </>
    // TbStats subscribes to the counts itself, so this only has to be rebuilt
    // when the view or the filters change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [view, search]);

  /* ---------------------------------------------------- where "up" is ---
     The shell asks this only when there is no in-session history to walk back
     through — a pasted URL, or a refresh.

     `false` is a real answer here, and the only module that gives it. In Chat
     the deal list IS the left pane, already on screen: there is nothing above a
     selected deal to go back TO, and a Back button offering to deselect it
     would be a control whose only effect is to remove information. Table and
     Pipeline are the opposite case — the drawer covers the list, so Back
     closing it onto the same filters is exactly right. */
  const parent = view === "tags" ? listHash(omit(p, ["view"]))
    : id ? (view === "chat" ? false : listHash(p))
    : null;

  usePageChrome({ crumbs, right, parent });

  /* -------------------------------------------------------------- drawer */
  /* Table and Pipeline open the record over the list they were reading it
     from; Chat has its own workspace and never opens this. */
  const wantsDrawer = !!id && view !== "chat" && view !== "tags";
  useEffect(() => {
    if (!wantsDrawer) return;
    shell.drawer(<DealDrawer dealRef={id as string} p={p} />);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsDrawer, id, search]);

  if (view === "chat") return <ChatWorkspace id={id} p={p} api={api} />;
  if (view === "tags") return <TagsView p={p} />;

  return <DealsList id={id} p={p} api={api} />;
}
