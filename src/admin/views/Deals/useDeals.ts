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
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { qs } from "../../ui";
import { fmtDate, inr as inrFmt } from "../../ui/format";
import { go } from "../../ui/nav";
import { can } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { currentActor } from "../../auth/session";
import AdminOpsService from "../../../api/modules/adminOps";
import type { DealPersonRef, DealPriorityVocab, DealStageVocab, DealTagVocab } from "../../../api/modules/adminOps";
import { AppExceptions } from "../../../api/apiService";
import { PRIORITY, STAGES, adaptByStage, adaptDeal, adaptTimeline, dateOnly, ownersFromRows } from "./adapter";

/* `D` was the whole IBData engine — a seeded localStorage store plus its
   helpers. What is left of it is four things that hold no records: the stage
   and priority vocabularies (adapter.ts, where the server's own rows are
   grafted in on every response) and the two formatters. Kept under the same
   name because six files and ~50 call sites read `D.STAGES[int]` / `D.inr()`,
   and the shape of those calls is the contract, not where the object is
   built. This module stores nothing: every read and write below is an HTTP
   call to interior_admin. */
export const D = { STAGES, PRIORITY, fmtDate, inr: inrFmt };

/* The two stage ints the UI branches on by name. Resolved from D.STAGES by
   KEY rather than hardcoded, because adapter.ts can graft new server stages
   into that map at runtime — and `stage >= WON` (the "settled" test used all
   over this module) only holds if these are the ints the server's own
   terminal stages mapped to. */
function stageIntByKey(key: string, fallback: number): number {
  for (const k in D.STAGES) if (D.STAGES[k].key === key) return Number(k);
  return fallback;
}
export const STAGE = {
  DEAL: stageIntByKey("new", 1), FOLLOWUP: stageIntByKey("followup", 2),
  SLOT: stageIntByKey("slot", 3), INSTALLMENT: stageIntByKey("installment", 4),
  WON: stageIntByKey("won", 5), LOST: stageIntByKey("lost", 6),
};

export type Params = Record<string, string>;
export type Refusal = { ok?: false; http: number; code: string; detail?: string };

/** A thrown API failure in the shape every dialog in this module already
 *  renders. The real API has one message string rather than the local engine's
 *  slug + detail, so `code` is left empty and ErrSlot prints the message
 *  alone — inventing a slug to fill the old layout would be a code nobody can
 *  look up. */
export function refusalOf(e: unknown): Refusal {
  if (e instanceof AppExceptions) return { http: e.code, code: "", detail: e.message };
  return { http: 0, code: "", detail: "Could not reach the server. Try again." };
}

export function paramsOf(sp: URLSearchParams): Params {
  const o: Params = {};
  sp.forEach((v, k) => { o[k] = v; });
  return o;
}

/* Who did this — the real signed-in identity now, not IBData.TeamStore's
   localStorage session. Deals' own data flow (the local engine below) is
   untouched; only where it reads "who is acting" changed. */
export const actor = currentActor;
/* "Head" used to be a string comparison against the local engine's own role
   names. It is a PERMISSION now: `deals.close` is the module's level-3 verb,
   which is exactly the tier the head-only controls (owner filter, reassign,
   export) were guarding. One source of truth, and the server re-checks it. */
export function head() { return can("deals", "close"); }
/* PORTED FAITHFULLY, INCLUDING THE SWALLOWED ARGUMENT.

   The prototype's wrapper is `function inr(p) { return D.inr(p); }` — one
   parameter. Sixteen call sites in views-deals.js pass `{ compact:true }` and
   every one of them is silently discarded, so this module renders full Indian
   grouping (₹29,20,000) and never the abbreviated form (₹29.20L).

   Forwarding the option "fixes" that and changes what every money figure in
   Deals looks like, which is not a port. Note that views-invoice.js and
   views-quotation.js DO forward it — the omission is specific to this file, so
   it reads as an accident rather than a house style. But `admin-data.js` also
   says of the grouping helper: "Never thousands grouping. Never decimals", and
   the compact form has decimals. Two readings, so this keeps what the prototype
   actually renders and leaves the decision visible.
   The `o` parameter stays in the signature so the sixteen call sites still say
   what they meant. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- see above: the unused parameter IS the ported behaviour.
export function inr(p: number, _o?: { compact?: boolean }) { return D.inr(p); }
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
/* THE REAL CLOCK. `IBData.days()`/`relative()` measure against a FIXED today
   (28 June 2026) — deliberately, so the prototype's seeded "3d overdue" never
   drifted as the file aged. Every date on this screen is a live row now, so a
   deal moved ten seconds ago was rendering "50d in stage". These two are the
   same functions against `new Date()`, and Deals uses them everywhere it used
   to call D.days/D.relative. `D.fmtDate` is untouched: formatting a date has
   no opinion about when now is, and the other modules still need the fixed
   clock for their own seeded data. */
function midnight(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
/** Whole days from today to `iso`. Positive is the future, negative the past —
 *  the same sign convention D.days() used, so no caller had to be re-read. */
export function daysFrom(iso?: string | null): number {
  if (!iso) return 0;
  const p = String(iso).slice(0, 10).split("-");
  const then = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  return Math.round((midnight(then) - midnight(new Date())) / 86400000);
}
export function relativeDate(iso?: string | null): string {
  if (!iso) return "—";
  const n = daysFrom(iso);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? "in " + n + "d" : Math.abs(n) + "d ago";
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

/* The two sorts the server cannot do — it has no remark-recency column and no
   stage-age column — applied over the page the API returned. `value` and the
   default are sent as `sort=` and arrive already ordered; these two are the
   honest client-side remainder, and they sort what is on screen, not the whole
   pipeline. `out` (outstanding) is GONE: it ranked deals by a figure that came
   from the local engine's seed money. */
export function localSort(list: any[], key?: string) {
  if (key !== "age" && key !== "close" && key !== "act") return list;
  const out = list.slice();
  out.sort((a, b) => {
    if (key === "close") return (a.expected_close_date || "9999") < (b.expected_close_date || "9999") ? -1 : 1;
    if (key === "act") return (a.last_remark_at || "") > (b.last_remark_at || "") ? -1 : 1;
    return (a.stage_since || "") < (b.stage_since || "") ? -1 : 1;   // oldest in stage first
  });
  return out;
}

/* One 3px rail replaces the old priority column. Colour must never be the
   only carrier of meaning, so the cell also gets a title attribute.
   Overdue and Urgent used to share one amber rail — indistinguishable at a
   glance, and they are two different problems: one is a promise already
   missed, the other is a customer's own stated priority. */
export function urgency(d: any): { cls: string; why: string } | null {
  if (d.stage >= STAGE.WON) return null;
  if (d.is_stalled) return { cls: "u-bad", why: "Stalled — no remark past the threshold" };
  if (d.next_action && daysFrom(d.next_action.date) < 0)
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
   THE REFETCH PUMP — one signal, `render()`, meaning "the server data this
   module is showing has changed".

   It used to mean "the local engine mutated, re-read it". Now every write is
   an HTTP call, so the same signal bumps DATA_VERSION, which is a dependency
   of both API hooks below: one call after a successful write re-fetches the
   list AND the open drawer, and every existing call site keeps working.

   Drawer and modal content live in a portal above the view, so they subscribe
   for themselves rather than re-rendering with the list.
   ====================================================================== */
const subs = new Set<() => void>();
let DATA_VERSION = 0;
export function useEngineTick() {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => { subs.add(force); return () => { subs.delete(force); }; }, []);
}
/** Subscribes AND returns the current version, so a hook can put it straight
 *  into an effect's dependencies. */
function useDataVersion() {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => { subs.add(force); return () => { subs.delete(force); }; }, []);
  return DATA_VERSION;
}
export function render() { DATA_VERSION += 1; subs.forEach((f) => f()); }

/* The composer's selected outbound channel — module state, reset to "manual"
   after every successful send, exactly as the prototype's `var CHAN`. Uses
   the DealRemarkType key directly ("manual", not the prototype's "remark")
   so nothing has to translate between the two. */
let CHAN = "manual";
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

/* `isoToday()` lived here and read the engine's frozen 28-June-2026 "today".
   It had no callers, so it went with the engine rather than being repointed
   at the real clock — `daysFrom()`/`relativeDate()` above are what this
   module actually measures with. */

/* ==========================================================================
   THE API READ PATH — List (Table/Pipeline) and Drawer only. Chat and Tags
   keep reading filteredScope()/E above, untouched, per this pass's scope.
   ====================================================================== */

/* `p.stage`/`p.priority` stay LEGACY INTS in the URL — the same params Chat/
   Tags and the local outstanding/collected aggregate below still read via
   filteredScope(). Converting the Select options to emit raw API keys would
   silently break both the moment a filter carries across a view switch, so
   the int stays the address and only the OUTGOING request gets translated. */
export function apiStageKey(legacyStage?: string): string | undefined {
  if (!legacyStage) return undefined;
  const row = D.STAGES[Number(legacyStage)];
  return row ? row.key : undefined; // a synthetic (unmapped) int has no server key to send back
}
/* IBData.PRIORITY only carries labels ("Normal"/"High"/"Urgent"), no key —
   lower-cased label is the best available guess at the server's priorityKey
   (the one example in the contract, "normal", matches this exactly). Confirm
   against a live filter response if this ever mis-hits. */
export function apiPriorityKey(legacyPriority?: string): string | undefined {
  const label = D.PRIORITY[Number(legacyPriority)];
  return label ? String(label).toLowerCase() : undefined;
}

/** `response === false` is this API's failure envelope over HTTP 200 — see
 * the comment above AdminOpsService's Deals methods. `code === 403` is a
 * permission refusal; everything else (code 202 included) is "no such
 * record" here, since a list fetch has no single ref to be missing. */
function apiOk<T>(res: { response: boolean; code: number; data: T }): { ok: true; data: T } | { ok: false; forbidden: boolean } {
  if (res.response === false) return { ok: false, forbidden: res.code === 403 };
  return { ok: true, data: res.data };
}

/* THE COUNTS, AS A LIVE SUBSCRIPTION.

   Chat puts the funnel counts in the TOPBAR, and the shell only accepts a new
   chrome when the ROUTE changes (usePageChrome keys on pathname+search). The
   counts arrive later than that — after the fetch, and again after every write
   — so a chrome captured at navigation time reads "0 total" over a populated
   list, which is exactly what it did.

   Kept in a module store with its OWN subscriber set rather than reusing
   `subs`: that one is a dependency of the fetch effect, so notifying through
   it here would re-fire the request that just produced these numbers. */
type Counts = { total: number; byStage: Record<number, number> };
let LAST_COUNTS: Counts = { total: 0, byStage: {} };
const countSubs = new Set<() => void>();
export function useDealCounts(): Counts {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => { countSubs.add(force); return () => { countSubs.delete(force); }; }, []);
  return LAST_COUNTS;
}

export interface DealsApiState {
  loading: boolean;
  forbidden: boolean;
  error: string | null;
  list: any[];
  counts: { total: number; byStage: Record<number, number> };
  stages: DealStageVocab[];
  priorities: DealPriorityVocab[];
  tags: DealTagVocab[];
  owners: DealPersonRef[];
}
const DEALS_API_IDLE: DealsApiState = {
  loading: true, forbidden: false, error: null, list: [],
  counts: { total: 0, byStage: {} }, stages: [], priorities: [], tags: [], owners: [],
};

/* Fetches the deals list for the current filters — Table and Pipeline only
   (index.tsx mounts DealsList, which calls this, only for those two views).
   ponytail: pageSize 500, no pager — the ported UI never had one (the
   prototype doesn't either); a scope past 500 deals silently won't all show.
   Add real pagination if that count is ever realistic. */
export function useDealsApi(p: Params): DealsApiState {
  const [state, setState] = useState<DealsApiState>(DEALS_API_IDLE);
  const version = useDataVersion();
  const key = JSON.stringify({
    stage: p.stage || "", priority: p.priority || "", owner: p.owner || "",
    tag: p.tag || "", q: p.q || "", stalled: p.stalled || "", sort: p.sort || "",
    version,
  });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    AdminOpsService.deals({
      stage: apiStageKey(p.stage), priority: apiPriorityKey(p.priority),
      owner: p.owner || undefined, tag: p.tag || undefined, search: p.q || undefined,
      stalled: p.stalled === "1" ? "1" : undefined,
      // Only the two dropdown values that map onto the contract's sort enum
      // are forwarded; age/close/out/act have no server-side equivalent
      // (they need chain/remark data this endpoint doesn't return) and are
      // dropped rather than sent as a value the server would have to guess at.
      sort: p.sort === "value" ? "value" : undefined,
      pageNo: 1, pageSize: 500,
    }).then((res) => {
      if (cancelled) return;
      const r = apiOk(res);
      if (!r.ok) {
        setState({ ...DEALS_API_IDLE, loading: false, forbidden: r.forbidden,
          error: r.forbidden ? null : "Could not load deals." });
        return;
      }
      const data = r.data;
      const counts = { total: data.counts.total, byStage: adaptByStage(data.counts.byStage, data.stages) };
      LAST_COUNTS = counts;
      countSubs.forEach((f) => f());
      setState({
        loading: false, forbidden: false, error: null,
        list: data.deals.map(adaptDeal),
        counts,
        stages: data.stages, priorities: data.priorities, tags: data.tags,
        owners: ownersFromRows(data.deals),
      });
    }).catch(() => {
      if (cancelled) return;
      setState({ ...DEALS_API_IDLE, loading: false, error: "Could not load deals." });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}

export interface DealApiState {
  loading: boolean;
  forbidden: boolean;
  notFound: boolean;
  deal: any | null;
  timeline: { kind: string; tone: string; at: string; by: string; text: string }[];
  /** TRUE when what is in hand belongs to a DIFFERENT deal than the one asked
   *  for — i.e. you switched records and the new one has not landed yet.
   *
   *  This is the distinction that decides whether anything is allowed to flash.
   *  A refresh of the SAME deal (every write calls render(), which re-fetches)
   *  is never stale: the content on screen is still true, so it is left alone
   *  and quietly replaced when the response arrives. A switch to another deal
   *  IS stale: the previous deal's messages must not sit under the new deal's
   *  name for even one frame, so the panes that show them — and only those —
   *  render a spinner. */
  stale: boolean;
}
const DEAL_API_IDLE: DealApiState = {
  loading: true, forbidden: false, notFound: false, deal: null, timeline: [], stale: false,
};

/** Fetches one deal's detail (fields, transitions, remarks) for the Drawer and
 *  the chat workspace. */
export function useDealApi(ref: string | null): DealApiState {
  const [state, setState] = useState<DealApiState>(DEAL_API_IDLE);
  /** Which deal the state actually describes. Compared against `ref` below to
   *  produce `stale`; kept in a ref rather than in state because it changes
   *  with the data, never on its own. */
  const dataRef = useRef<string | null>(null);
  const version = useDataVersion();

  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    /* The previous deal is KEPT here, deliberately — clearing it is what made
       a switch blank the screen. `forbidden`/`notFound` are cleared, because
       those describe the ref that has just been left behind. */
    setState((s) => ({ ...s, loading: true, forbidden: false, notFound: false }));
    AdminOpsService.deal(ref).then((res) => {
      if (cancelled) return;
      const r = apiOk(res);
      if (!r.ok) {
        dataRef.current = ref;
        setState({ ...DEAL_API_IDLE, loading: false, forbidden: r.forbidden, notFound: !r.forbidden });
        return;
      }
      const data = r.data;
      const deal = adaptDeal(data.deal);
      // The one Drawer field the list row doesn't carry: the latest remark's
      // timestamp, read off the (already createdAt-descending) remarks array.
      // Through dateOnly() like every other date the adapter emits — the wire
      // sends a full ISO datetime and D.fmtDate()/relativeDate() both parse
      // date-only strings, so passing it raw rendered "NaN undefined NaN".
      deal.last_remark_at = data.remarks.length ? dateOnly(data.remarks[0].createdAt) : null;
      dataRef.current = ref;
      setState({
        loading: false, forbidden: false, notFound: false, stale: false, deal,
        timeline: adaptTimeline(data.transitions, data.remarks),
      });
    }).catch(() => {
      if (cancelled) return;
      dataRef.current = ref;
      setState({ ...DEAL_API_IDLE, loading: false, notFound: true });
    });
    return () => { cancelled = true; };
  }, [ref, version]);

  /* Computed on every render rather than stored: `ref` can change in the same
     commit that renders, and a stored flag would be one render behind — which
     is exactly the frame the wrong deal's chat would be visible in. */
  return { ...state, stale: !!ref && dataRef.current !== ref };
}

