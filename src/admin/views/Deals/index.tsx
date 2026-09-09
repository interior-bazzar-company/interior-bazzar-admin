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
import { Segmented, TbTitle, qs } from "../../ui";
import { go } from "../../ui/nav";
import { usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import {
  VIEWS, VIEW_ORDER, listHash, merge, omit, paramsOf, useDealsApi, useEngineTick, viewOf
} from "./useDeals";
import { DealsList, TbStats } from "./List";
import { ChatWorkspace } from "./Chat";
import { TagsView } from "./Tags";
import { DealDrawer } from "./Drawer";

/* THE THREE FACES, in the order they are offered. Each is one press, not a
   menu: "which view am I in" must be answerable without opening anything, and
   with three options a segmented control answers it and switches it in the
   same object. The glyphs are the panel's own — a list, columns, a
   conversation — so the control reads before the words are.

   The VALUES are `VIEWS[k].param`, never the key: chat owns the empty string
   (it is the module's default face), and moving which face owns "" moves the
   default without touching a single link. Lists is deliberately not here — it
   is not a way of looking at deals, it is a way of filtering them, so its
   entry point sits beside the List filter on the table's own command row.

   The ORDER is densest read → arrangement → one conversation, which is also
   the order somebody narrows down in: every deal, then the ones that are
   stuck, then the one they are about to ring. `VIEW_ORDER` from useDeals is
   the set; anything it grows that is not named here is appended rather than
   silently dropped. */
const FACE_ICON: Record<string, string> = { table: "list", board: "columns", chat: "chat" };
const FACES = ["table", "board", "chat"].filter((k) => VIEW_ORDER.indexOf(k) >= 0)
  .concat(VIEW_ORDER.filter((k) => ["table", "board", "chat"].indexOf(k) < 0));

export default function Deals() {
  useEngineTick();
  const routeParams = useParams();
  const [sp] = useSearchParams();
  const shell = useShell();

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
  /* Deals claims the topbar's right-hand slot for its view switcher. The
     switch belongs to the module, not to the page body: it changes what the
     page IS, and putting it in the page would make it move every time the
     page it switches did. */
  const right = useMemo(() => (
    <Segmented
      sm
      label="View"
      value={VIEWS[view] ? VIEWS[view].param : ""}
      onPick={(param) => {
        /* Switching face keeps the record you were reading and every filter
           you had set — the view is part of the address, not a reset. */
        const key = FACES.filter((k) => VIEWS[k].param === param)[0] || "chat";
        go("#/deals" + (id ? "/" + encodeURIComponent(id) : "") + qs(merge(p, { view: VIEWS[key].param })));
      }}
      options={FACES.map((k) => ({
        v: VIEWS[k].param,
        ico: FACE_ICON[k],
        /* The label goes at `md`. Below it the glyph is the whole control —
           three words plus three icons is more topbar than a phone has. */
        l: <span className="hidden md:inline">{VIEWS[k].label}</span>,
      }))}
    />
    // `p` is derived from `search`, so the two dependencies below cover it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [view, search, id]);

  /* THE CRUMB SLOT is the module's title and, in Chat, its live counts.

     Chat is the one view whose body has no room for the funnel strip — three
     panes already own the width — so the counts move up beside the title as
     compact mono figures, in the same order the table's strip reads them. The
     other two faces carry the same numbers in the page's own StatStrip, where
     they are also the filters, so repeating them here would be a second copy
     of a control that already exists ten pixels lower. */
  const crumbs = useMemo(() => (
    <>
      {/* `shrink-0`: the title is the one thing in this row that must never be
          the thing that truncates — the counts beside it scroll and hide by
          breakpoint, and a module called "De…" is a module you cannot read. */}
      <span className="shrink-0"><TbTitle label="Deals" to="#/deals" /></span>
      {view === "chat" ? <TbStats p={p} /> : null}
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
     from; Chat has its own workspace and never opens this. `lg` because a deal
     is a record with money, facts and a whole timeline on it — at `md` the
     figures wrap two to a line and the timeline reads as a column of stubs. */
  const wantsDrawer = !!id && view !== "chat" && view !== "tags";
  useEffect(() => {
    if (!wantsDrawer) return;
    shell.drawer(<DealDrawer dealRef={id as string} p={p} />, undefined, "lg");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsDrawer, id, search]);

  if (view === "chat") return <ChatWorkspace id={id} p={p} api={api} />;
  if (view === "tags") return <TagsView p={p} />;

  return <DealsList id={id} p={p} api={api} />;
}
