/* =============================================================================
   Deals — Module 1 · shared logic
   -----------------------------------------------------------------------------
   The non-JSX half of views-deals.js: scope, filtering, sorting, the view
   switcher's vocabulary, and the two things React needs that the prototype got
   for free — a way to re-render after an engine mutation (its `S.render()`) and
   a way to read the params the prototype kept in `S.state.params`.

   Three principles carried through every control (from the prototype header):

     1. Locked actions are ABSENT, not greyed. A disabled button invites a click
        and a support ticket; a missing one states that this is not a step yet.
     2. Every modal states the rule BEFORE you commit, and prints the exact
        server code if it still rejects.
     3. The UI is a convenience, never the enforcement. The engine re-checks
        everything; rendering a different button changes nothing.
   ============================================================================= */
import { useCallback, useEffect, useReducer, useRef } from "react";
import type { MouseEvent, ReactNode } from "react";
import { IBData, IBDeals } from "../../engines";
import { qs } from "../../ui";
import { go } from "../../ui/nav";
import { useShell } from "../../shell/ShellContext";

export const D = IBData;
export const E = IBDeals;
export const STAGE = E.STAGE;

export type Params = Record<string, string>;
export type Refusal = { ok?: false; http: number; code: string; detail?: string };

export function paramsOf(sp: URLSearchParams): Params {
  const o: Params = {};
  sp.forEach((v, k) => { o[k] = v; });
  return o;
}

export function actor() {
  const u = D.TeamStore.current() || { name: "System", role: "super_admin" };
  return { name: u.name, role: u.role, id: u.id };
}
export function head() { return E.isHead(actor()); }
export function inr(p: number, o?: { compact?: boolean }) { return D.inr(p, o); }
export function rupees(v: unknown) {
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  return isNaN(n) ? 0 : Math.round(n * 100);
}
/* Paise back to something a person edits. `rupees()` is the other direction
   and the two are used as a pair — value in, value out, no float in between. */
export function rupeeStr(paise: number) { return String(Math.round(paise / 100)); }

/* City and state read as one place, and state is optional — so it collapses
   to just the city rather than leaving a dangling comma. */
export function place(d: any) {
  const st = d.state && d.state !== "—" ? d.state : "";
  return d.city + (st ? ", " + st : "");
}
/* Priority's colour in one place, so the header chip and its menu cannot
   disagree about whether Urgent is red or amber. */
export function prioTone(v: number) { return v === 3 ? "bad" : v === 2 ? "warn" : ""; }
export const PRIO_HINT: Record<number, string> = {
  1: "The normal queue", 2: "Chase ahead of the queue", 3: "Chase today"
};

/* Every stage there is. One list, so a stage added to IBData.STAGES shows up
   in the filter, the strip, the menu and the board without six edits. */
export const ALL_STAGES: number[] = Object.keys(D.STAGES).map(Number);
/* The strip counts the stages a deal is still WORKING through. Lost is not a
   step of the funnel, it is where deals leave it, so it keeps its place in
   the Stage dropdown and stays out of the count row. */
export const STRIP_STAGES = ALL_STAGES.filter((s) => s !== 6);

export function merge(p: Params, extra: Record<string, string | number>): Params {
  const o: Params = {};
  for (const k in p) o[k] = p[k];
  for (const k2 in extra) o[k2] = String(extra[k2] === undefined || extra[k2] === null ? "" : extra[k2]);
  return o;
}
export function omit(p: Params, keys: string[]): Params {
  const o: Params = {};
  for (const k in p) if (keys.indexOf(k) < 0) o[k] = p[k];
  return o;
}

function sorter(key: string | undefined, order: Map<any, number>) {
  return function (a: any, b: any) {
    if (key === "value") return (b.deal_value || 0) - (a.deal_value || 0);
    if (key === "out") return b.outstanding - a.outstanding;
    if (key === "close") return (a.expected_close_date || "9999") < (b.expected_close_date || "9999") ? -1 : 1;
    if (key === "act") return a.last_remark_at > b.last_remark_at ? -1 : 1;
    if (key === "age") return a.stage_since < b.stage_since ? -1 : 1;    // stage age, oldest first
    return (order.get(b) as number) - (order.get(a) as number);          // default: newest created first
  };
}

/* Shared by every view mode (Table/Pipeline/Chat) so filtering never drifts
   between them — one definition of "which deals match these params." */
export function filteredScope(me: any, p: Params) {
  const scope = E.Analytics.scopeOf(me);
  let list = scope.slice();

  if (p.stage) list = list.filter((d: any) => String(d.stage) === String(p.stage));
  if (p.owner) list = list.filter((d: any) => d.owner_id === p.owner);
  if (p.priority) list = list.filter((d: any) => String(d.priority) === String(p.priority));
  if (p.stalled === "1") list = list.filter((d: any) => d.is_stalled);
  if (p.tag) {
    const tagged = E.Tags.dealsWith(p.tag);
    list = list.filter((d: any) => tagged.indexOf(d.deal_id) >= 0);
  }
  if (p.next === "overdue") list = list.filter((d: any) =>
    d.stage < STAGE.WON && d.next_action && D.days(D.d(d.next_action.date)) < 0);
  if (p.q) {
    const q = p.q.toLowerCase();
    list = list.filter((d: any) =>
      (d.deal_id + " " + d.customer_name + " " + (d.business_name || "") + " " +
       (d.email || "") + " " + d.city + " " + (d.state || "") + " " + d.phone + " " +
       d.interested_in).toLowerCase().indexOf(q) >= 0);
  }
  // Latest-created-first is the default — true insertion order (the array is
  // append-only; nothing ever reorders it), not updated_at, so an old deal
  // edited today does not jump to the top.
  const order = new Map<any, number>();
  scope.forEach((d: any, i: number) => order.set(d, i));
  list.sort(sorter(p.sort, order));
  return { scope, list };
}

/* Outstanding over the open deals in scope — one sum, so the topbar read-out,
   the list's attention strip and the chat pane's Money block can never
   disagree about what "outstanding" means for the same scope. */
export function openOutstanding(scope: any[]) {
  return scope.reduce((a: number, d: any) => a + (d.stage < STAGE.WON ? d.outstanding : 0), 0);
}

/* One 3px rail replaces the old priority column. Colour must never be the
   only carrier of meaning, so the cell also gets a title attribute.
   Overdue and Urgent used to share one amber rail — indistinguishable at a
   glance, and they are two different problems: one is a promise already
   missed, the other is a customer's own stated priority. */
export function urgency(d: any): { cls: string; why: string } | null {
  if (d.stage >= STAGE.WON) return null;
  if (d.is_stalled) return { cls: "u-bad", why: "Stalled — no remark past the threshold" };
  if (d.next_action && D.days(D.d(d.next_action.date)) < 0)
    return { cls: "u-bad", why: "Next action overdue" };
  if (d.priority === 3) return { cls: "u-warn", why: "Urgent priority" };
  if (d.priority === 2) return { cls: "u-info", why: "High priority" };
  return null;
}

/* The view switcher's one list — order is the order it is offered in.
   Tags is deliberately NOT offered here. It is not a way of looking at
   deals, it is a way of filtering them, so its entry point sits beside the
   Tag filter in the command row.

   CHAT OWNS THE BARE URL. Which view owns `param:""` is the whole mechanism:
   every link in this module is built from `merge(p, {view:VIEWS[k].param})`,
   so moving the empty string moves the default without touching one link. */
export const VIEWS: Record<string, { label: string; icon: string; param: string; hint: string }> = {
  chat:  { label: "Chat",     icon: "quote", param: "",      hint: "One deal, its whole conversation" },
  table: { label: "Table",    icon: "menu",  param: "table", hint: "Every deal, densest read" },
  board: { label: "Pipeline", icon: "chart", param: "board", hint: "Deals by stage" },
  tags:  { label: "Lists",    icon: "tag",   param: "tags",  hint: "Create and manage lists" }
};
export const VIEW_ORDER = ["chat", "table", "board"];
export function viewOf(p: Params) {
  return p.view === "board" ? "board" : p.view === "table" ? "table"
       : p.view === "tags" ? "tags" : "chat";
}
/* The list this record was opened over, filters and view intact. A drawer
   closing must land back on the table you opened it from, not on whatever
   `#/deals` happens to mean today. */
export function listHash(p: Params) { return "#/deals" + qs(omit(p || {}, [])); }
/* A row, a card and a settled line all point at the same place: this deal,
   IN THE VIEW YOU ARE READING IT FROM. The view is part of the address, so it
   belongs in the link. */
export function dealHash(id: string, p: Params) {
  return "#/deals/" + encodeURIComponent(id) + qs(p || {});
}

/* ==========================================================================
   THE RE-RENDER PUMP — React's stand-in for the prototype's `S.render()`.
   The engines mutate localStorage and return; nothing observes them. Any
   surface that reads engine state subscribes with useEngineTick(), and every
   mutating handler calls render() exactly where the prototype called
   S.render(). Drawer and modal content live in a portal above this view, so
   they subscribe for themselves rather than re-rendering with the list.
   ====================================================================== */
const subs = new Set<() => void>();
export function useEngineTick() {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => { subs.add(force); return () => { subs.delete(force); }; }, []);
}
export function render() { subs.forEach((f) => f()); }

/* The composer's selected outbound channel — module state, reset to "remark"
   after every successful send, exactly as the prototype's `var CHAN`. */
let CHAN = "remark";
export function chanOf() { return CHAN; }
export function setChan(v: string) { CHAN = v; }

/* Reads a value straight out of the DOM, the way the prototype's modals did.
   The ported modals render ui/Field, which is uncontrolled for exactly this
   reason — a re-render must never throw away a half-typed form. */
export function val(id: string) {
  const e = document.getElementById(id) as HTMLInputElement | null;
  return e ? e.value : "";
}

/* Land back where the work was happening, not where `#/deals` happens to
   point. The params carry the view and the filters through. */
export function useDone(p: Params) {
  const shell = useShell();
  return useCallback((msg: string, ref?: string | null) => {
    shell.closeLayer();
    shell.toast(msg);
    go(ref ? "#/deals/" + encodeURIComponent(ref) + qs(p) : listHash(p));
    render();
  }, [shell, p]);
}

/* A toast for a refusal the engine returned. Same string the prototype built:
   `http code — detail`. */
export function useRefuse() {
  const shell = useShell();
  return useCallback((r: Refusal) => {
    shell.toast(r.http + " " + r.code + " — " + r.detail, "bad");
  }, [shell]);
}

/* The shell closes a popover on an outside click, but a second press on the
   anchor itself has to close it too — that is what `popAnchor` is for. */
export function usePop() {
  const shell = useShell();
  return useCallback((e: MouseEvent<HTMLElement>, node: ReactNode,
                      opts?: { width?: number; align?: "left" | "right"; above?: boolean; cls?: string }) => {
    const el = e.currentTarget as HTMLElement;
    if (shell.popAnchor === el) { shell.closePop(); return; }
    shell.openPop(el, node, opts);
  }, [shell]);
}

/* The prototype's delegated `data-filter` / `data-unfilter` handlers, as
   callbacks. A select commits immediately; a search box waits 220ms, the same
   debounce the shell used, so a keystroke is not a navigation. */
export function useFilters(p: Params, id: string | null) {
  const timer = useRef<number | undefined>(undefined);
  const hash = useCallback((next: Params) =>
    "#/deals" + (id ? "/" + encodeURIComponent(id) : "") + qs(next), [id]);

  const onFilter = useCallback((name: string, value: string) => {
    go(hash(merge(p, { [name]: value })));
  }, [p, hash]);

  const onSearch = useCallback((name: string, value: string) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => go(hash(merge(p, { [name]: value }))), 220);
  }, [p, hash]);

  const onUnfilter = useCallback((k: string) => {
    go("#/deals" + (k === "*" ? "" : qs(omit(p, [k]))));
  }, [p]);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { onFilter, onSearch, onUnfilter };
}

export function isoToday() {
  const t = D.TODAY;
  return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" +
         String(t.getDate()).padStart(2, "0");
}
