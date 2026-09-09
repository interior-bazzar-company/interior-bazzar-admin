/* =============================================================================
   CHAT WORKSPACE — the "Chat" view mode. Replaces the drawer for this one mode
   only; Table and Pipeline keep opening the drawer exactly as before. It reads
   the SAME fetch as those two, so the deal picked here is always a deal the
   current filters would also show there.

   THE SHAPE IS THE PANEL'S CONVERSATION SHAPE: a list pane on the left, the
   thread in the middle on the one warm plane in the product, and a context
   pane on the right. Under `lg` the three become one, switched by a tab row —
   three 320px columns on a laptop-sized window is three unreadable columns.

   The WhatsApp/Email composer channels are real: `channel` is DealRemark's
   typeKey (manual/whatsapp/email, see DealsController.CLIENT_REMARK_TYPES), a
   stored column, and a whatsapp/email-tagged remark grows an "Open" link —
   wa.me / mailto prefilled with the exact text just logged, so the agent
   writes the message once and sends it for real.
   ============================================================================= */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyEvent, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { TextAreaBase } from "@/components/base/textarea/textarea";
import { cx } from "@/utils/cx";
import {
  Avatar, Button, EmptyState, Eyebrow, FilterChips, Icon, IconButton, KvList, Meter, PageHeader,
  PaneLoading, Pill, SearchField, Segmented, Select, Tabs, Tag, cap, qs
} from "../../ui";
import { go } from "../../ui/nav";
import { can } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { ChainStrip } from "../chainStrip";
import {
  D, STAGE, chanOf, daysFrom, fullAccess, hasFilters, head, inr, omit, place, refusalOf,
  relativeDate, render, setChan, urgency, useDealApi, useDealDocs, useFilters, usePop
} from "./useDeals";
import type { DealDocsState } from "./useDeals";
import AdminOpsService from "../../../api/modules/adminOps";
import type { InvoiceRow, QuotationRow } from "../../../api/modules/adminOps";
import { STATUS_LABEL as Q_LABEL } from "../Quotations/api";
import { STATUS_LABEL as I_LABEL } from "../Invoices/api";
import type { DealsApiState, Params } from "./useDeals";
import { ChainCard, ChainDots, MoneyCellCtx, Rich, StagePipeline, TagChips, orDash } from "./bits";
import { useActs } from "./Modals";
import { CHIP_LABEL, GateBody, MoreMenu, PrioMenu, StageMenu, selectOptions } from "./menus";

/* The workspace is BOUNDED BY THE VIEWPORT, not by its content: a conversation
   scrolls inside its own pane, and the page around it never does.

   No arithmetic any more, and no gutters: the route asks the shell for a `full`
   page (see usePageChrome in index.tsx), which drops the reading column and its
   padding and hands this the whole area under the topbar. `h-full` is then
   exactly that area — three panes that end where the window does, on every
   breakpoint, without a magic number that goes stale the moment the topbar
   changes height. */
const FRAME = "flex h-full min-h-0 flex-col";

/** Which single pane a narrow window is showing. Above `lg` all three are on
 *  screen at once and this is ignored. */
type Pane = "list" | "thread" | "info";

export function ChatWorkspace({ id, p, api }: {
  id: string | null; p: Params; api: DealsApiState;
}) {
  const list = api.list;
  const acts = useActs(p);
  const canCreate = can("deals", "create");
  const [pane, setPane] = useState<Pane>("thread");

  /* ponytail: falls back to the first row of the already-loaded, filter-
     matching API list when no id is in the URL — the same "open something"
     behaviour the module has always had, sourced from the one shared fetch. */
  const ref = id || (list.length ? list[0].deal_id : null);

  /* Nothing matched, but only because of a FILTER: the workspace stays exactly
     where it is — list pane with its filters (the only way back out) and its own
     "no deals match" line, detail panes blank. Taking the whole page over with
     an empty state would hide the very controls you need to widen the search,
     and claim the pipeline is empty when it is not. The full-page state is for
     the one case it is true: no filters, no deals. */
  const filtered = hasFilters(p);
  /* Scope-aware, for the same reason the table's is: a non-full-access session
     receives only the deals it owns or co-owns, so an empty scope is "none are
     yours", not "the pipeline is empty". */
  const mine = !fullAccess();

  /* The empty state is a DOCUMENT, not a workspace — there are no panes to fill
     the window with — so it brings back the gutters and the reading column the
     full page dropped. */
  if (!ref && !filtered) return (
    <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col gap-4 overflow-y-auto px-4 py-5 md:px-6 md:py-6 lg:px-8">
      {/* The page still names itself and still offers its one action: an empty
          workspace is a state of the page, not the absence of one. */}
      <PageHeader title="Deals" meta={<>The conversation view · one deal, its whole history</>}
        actions={canCreate
          ? <Button color="primary" ico="plus" data-act="dl-create" onClick={() => acts.create()}>New deal</Button>
          : null} />
      <EmptyState icon="chat" title={mine ? "No deals assigned to you" : "No deals yet"}
        body={(mine ? "Deals you own or co-own appear here, each with its whole conversation beside it." : "Nothing in the pipeline yet.") +
          (canCreate ? " Create one for an inbound call, a walk-in or a referral." : " Once one exists, its chat opens here.")}
        action={canCreate
          ? <Button color="primary" ico="plus" data-act="dl-create" onClick={() => acts.create()}>New deal</Button>
          : null} />
    </div>
  );

  /* No selection means there is nothing for the other two panes to be about, so
     a narrow window is put on the list whatever tab it was last on. */
  const shown: Pane = ref ? pane : "list";
  const only = (k: Pane) => (shown === k ? "flex" : "hidden");

  /* THE SPLIT THAT KEEPS THE LIST STILL.

     The detail fetch lives in `<DetailPanes>`, not here: the list renders from
     `api`, which changes only when the FILTERS change, so picking another deal
     — and every write, since each one re-fetches — moves nothing on the left.

     `ref` (the URL param), not the loaded deal's id: the list highlight has to
     jump to the clicked row the instant it is clicked, not wait for that deal's
     own fetch to resolve. */
  return (
    <div className={FRAME}>
      <Tabs className="shrink-0 border-b border-secondary px-3 lg:hidden" cur={shown} onPick={(k) => setPane(k as Pane)}
        items={[
          { k: "list", label: "Deals", icon: "list", n: list.length || null, quiet: true },
          { k: "thread", label: "Conversation", icon: "chat" },
          { k: "info", label: "Details", icon: "info" },
        ]} />
      {/* No card any more. A full page has no ground behind it to float on, so
          the rounding and the ring were an outline drawn a pixel inside the
          window edge; the panes' own dividers are what separates them. */}
      <div className="flex min-h-0 flex-1 overflow-hidden bg-primary">
        <ListPane list={list} activeRef={ref || ""} p={p} api={api} cls={only("list")} onPick={() => setPane("thread")} />
        {ref
          ? <DetailPanes dealRef={ref} p={p} thread={only("thread")} info={only("info")} />
          : <>
              <section className={cx("min-w-0 flex-1 bg-chat lg:flex", only("thread"))}>
                <EmptyState flat icon="chat" title="No deals match these filters"
                  body="Widen the search on the left and the conversation opens here." />
              </section>
              <aside className={cx("w-full min-w-0 shrink-0 border-secondary lg:flex lg:w-80 lg:border-l", only("info"))} />
            </>}
      </div>
    </div>
  );
}

/* The two panes that are about ONE deal. Everything here re-renders when the
   selected deal's data changes; nothing outside it does. */
function DetailPanes({ dealRef, p, thread, info }: { dealRef: string; p: Params; thread: string; info: string }) {
  const shell = useShell();
  const detail = useDealApi(dealRef);

  useEffect(() => {
    if (!detail.forbidden) return;
    shell.toast("403 out_of_scope — that deal is not yours.", "bad");
    go("#/deals");
  }, [detail.forbidden, shell]);

  if (detail.forbidden) return null;   // redirecting via the effect above

  /* `stale` is "what I am holding belongs to a DIFFERENT deal" — you have just
     clicked another row. That is the only case with something to hide, and
     these two panes are the only things that hide it.

     A refresh of the SAME deal (after a remark, a stage move, a tag — every
     write re-fetches) is not stale: what is on screen is still true, so it is
     left alone and swapped when the response lands. A write never makes the
     conversation blink, and a switch never shows the previous deal's messages
     under the new deal's name. */
  if (detail.stale || (!detail.deal && detail.loading)) {
    return (
      <>
        <section className={cx("min-w-0 flex-1 flex-col bg-chat lg:flex", thread)}>
          <PaneLoading label={"Opening " + dealRef + "…"} />
        </section>
        <aside className={cx("w-full min-w-0 shrink-0 border-secondary lg:flex lg:w-80 lg:border-l", info)} />
      </>
    );
  }

  /* The ref is not in THIS session's deal set — the panel's own not-found
     state, never a silent fall-back onto an unrelated deal. Out-of-scope reads
     come back as not-found rather than forbidden, so "gone" and "never yours"
     are genuinely indistinguishable from here; the copy names both rather than
     picking one, and says neither in API vocabulary. */
  if (!detail.deal) return (
    <>
      <section className={cx("min-w-0 flex-1 flex-col bg-chat lg:flex", thread)}>
        <EmptyState flat icon="deal" title="Deal not found"
          body={"“" + dealRef + "” could not be opened — it may have been deleted, or it may belong to someone else now."} />
      </section>
      <aside className={cx("w-full min-w-0 shrink-0 border-secondary lg:flex lg:w-80 lg:border-l", info)} />
    </>
  );

  return (
    <>
      <ChatPane dl={detail.deal} ev={detail.timeline} p={p} cls={thread} />
      <CtxPane dl={detail.deal} p={p} cls={info} />
    </>
  );
}

/* ============================================================ LIST PANE ===
   Search, the same filters the table offers, and one row per deal. The filters
   come from `selectOptions()` in menus.tsx, which the table's filter bar reads
   too — so the two can never offer different options for the same filter. */
const LIST_FILTERS = ["stage", "tag", "priority", "owner", "sort"];

function ListPane({ list, activeRef, p, api, cls, onPick }: {
  list: any[]; activeRef: string; p: Params; api: DealsApiState; cls: string; onPick: () => void;
}) {
  const acts = useActs(p);
  const { onFilter, onSearch, onUnfilter } = useFilters(omit(p, ["page"]), activeRef || null);

  return (
    <aside className={cx("w-full min-w-0 shrink-0 flex-col border-secondary lg:flex lg:w-80 lg:border-r", cls)}
      aria-label="Deals">
      <div className="flex shrink-0 flex-col gap-2 border-b border-secondary p-3">
        {/* Search first, with New deal beside it. The old "Deals · 14 shown"
            title was restating the page you are already on. */}
        <div className="flex items-center gap-2">
          <SearchField ph="Search deals…" val={p.q} onFilter={onSearch} />
          {can("deals", "create")
            ? <IconButton ico="plus" color="secondary" label="Create deal" data-act="dl-create" onClick={() => acts.create()} />
            : null}
        </div>
        {/* ONE SCROLLING ROW, so the number of filters never changes the pane's
            layout. The bar is VISIBLE (`scrollbar-thin`, not `scrollbar-hide`):
            in a 320px pane this row is always wider than its box, and a hidden
            bar made the last picker read as clipped chrome rather than as a
            control one drag away. `overscroll-x-contain` keeps that drag off
            the browser's back gesture.

            Owner is full-access only — see fullAccess() in useDeals.ts: a scoped
            session's own deals are all it can be shown, so the picker would
            filter nothing. */}
        <div className="flex items-center gap-1.5 overflow-x-auto overscroll-x-contain pb-1 scrollbar-thin">
          {LIST_FILTERS.map((name) => (name === "owner" && !fullAccess() ? null : (
            <span key={name} className="shrink-0">
              <Select name={name} label={CHIP_LABEL[name] || name} value={p[name]} onFilter={onFilter}
                options={selectOptions(name, api)}
                allLabel={name === "sort" ? "Sort: newest first" : undefined} />
            </span>
          )))}
        </div>
        {hasFilters(p)
          ? <FilterChips params={omit(p, ["view", "page"])} onUnfilter={onUnfilter}
              labels={{ q: "Search", stage: "Stage", owner: "Owner", priority: "Priority",
                next: "Next action", stalled: "Stalled", sort: "Sort", tag: "List" }} />
          : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {list.length
          ? list.map((d: any) => <Row key={d.deal_id} d={d} activeRef={activeRef} p={p} onPick={onPick} />)
          : <p className="p-4 text-sm text-tertiary">
              {/* The same three readings as the full-page state. This pane also
                  renders with NO filters set — a deal ref in the URL keeps the
                  workspace mounted over an empty scope — so it cannot blame the
                  filters unconditionally. */}
              {hasFilters(p) ? "No deals match these filters."
                : fullAccess() ? "No deals yet." : "No deals assigned to you."}</p>}
      </div>
    </aside>
  );
}

function Row({ d, activeRef, p, onPick }: { d: any; activeRef: string; p: Params; onPick: () => void }) {
  const u = urgency(d);
  const over = d.next_action && daysFrom(d.next_action.date) < 0 && d.stage < STAGE.WON;
  /* `last_remark_at` is only ever set on the ONE deal fetched in full by
     useDealApi() — the list endpoint doesn't return it per row, so every other
     row falls back to created_at, same as a deal with no remarks yet. */
  const when = relativeDate(d.last_remark_at || d.created_at);
  const flag = d.is_stalled ? "Stalled"
    : over ? Math.abs(daysFrom(d.next_action.date)) + "d overdue" : "";
  const on = activeRef === d.deal_id;
  const to = "#/deals/" + encodeURIComponent(d.deal_id) + qs(p);
  const stage = D.STAGES[d.stage] || { label: String(d.stage), tone: "" };

  return (
    <a
      href={to}
      data-go={to}
      aria-current={on ? "true" : undefined}
      className={cx(
        "flex w-full cursor-pointer gap-2.5 border-b border-secondary px-3 py-2.5 text-left outline-focus-ring transition duration-100 last:border-0 hover:bg-primary_hover focus-visible:outline-2 focus-visible:-outline-offset-2",
        on && "bg-selected hover:bg-selected",
        u && u.cls === "u-bad" && "rail-error",
        u && u.cls === "u-warn" && "rail-warning",
        u && u.cls === "u-info" && "rail-info",
      )}
      onClick={(e) => { e.preventDefault(); onPick(); go(to); }}
    >
      <Avatar name={d.customer_name} sm />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary">{d.customer_name}</span>
          {/* The deal's own value — the only money on the record. Null means
              nothing has been quoted yet, which is not ₹0. */}
          <span className="shrink-0 font-mono text-xs font-semibold text-primary tnum">
            {d.deal_value ? inr(d.deal_value, { compact: true }) : "—"}</span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <Pill xs tone={stage.tone || "neutral"} text={stage.label} />
          {flag
            ? <Pill xs dot tone="bad" text={flag} />
            : <span className="truncate text-xs text-quaternary">{when}</span>}
          <span className="flex-1" />
          <ChainDots d={d} />
        </span>
        {d.business_name ? <span className="truncate text-xs text-tertiary">{d.business_name}</span> : null}
        {d.tags && d.tags.length ? <TagChips max={2} tags={d.tags} /> : null}
      </span>
    </a>
  );
}

/* ============================================================ CHAT PANE === */
function dayLabel(iso: string) {
  const n = daysFrom(iso);
  if (n === 0) return "Today";
  if (n === -1) return "Yesterday";
  return D.fmtDate(iso);
}
/* One tone per channel, and the chip that carries it. The hue is a LABEL — a
   tag, not a status — because "this went out on WhatsApp" is a fact about the
   message, never a verdict about the deal. */
const CHAN_TONE: Record<string, string> = { whatsapp: "green", email: "blue", manual: "" };
const CHAN_LABEL: Record<string, string> = { manual: "Remark", whatsapp: "WhatsApp", email: "Email" };

function kindLabel(e: any) {
  if (e.kind !== "REMARK") return cap(String(e.kind).toLowerCase());
  return CHAN_LABEL[e.channel || "manual"] || "Remark";
}
/* Digits only, no leading zero/plus — the shape wa.me needs. Indian numbers
   here are stored "+91 90322 19614"; a bare 10-digit number (no country code
   captured) is assumed domestic and gets 91 prefixed, same assumption the
   rest of the panel makes about where these deals are. */
function waDigits(phone: string) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return "91" + digits;
  return digits;
}

/* `apiEv` is the API's transitions+remarks, already shaped by adaptTimeline()
   — real STAGE/REMARK/SYSTEM events, newest first. `channel` on a REMARK row
   is DealRemark.typeKey (manual/whatsapp/email), a real stored field. */
function ChatPane({ dl, ev: apiEv, p, cls }: {
  dl: any; ev: { kind: string; tone: string; at: string; by: string; text: string; channel?: string }[];
  p: Params; cls: string;
}) {
  const ev = apiEv.slice().reverse();   // chronological, oldest first
  const scroll = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = scroll.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [ev.length, dl.deal_id]);

  /* GROUPED BY AUTHOR. Six remarks from one person in one afternoon is one
     person talking, not six events — the face and the name are drawn once and
     the run reads as a paragraph. A day divider or a system line breaks the
     run, because both mean the conversation moved on. */
  let lastDay: string | null = null;
  let lastWho: string | null = null;
  const body: ReactNode[] = [];

  ev.forEach((e: any, i: number) => {
    const day = String(e.at || "").slice(0, 10);
    if (day && day !== lastDay) {
      lastDay = day; lastWho = null;
      body.push(
        <div key={"d" + i} className="flex items-center gap-3 px-4 py-3">
          <span aria-hidden="true" className="h-px flex-1 bg-border-secondary" />
          <span className="label-mono rounded-full bg-primary px-2 py-0.5 ring-1 ring-secondary">{dayLabel(day)}</span>
          <span aria-hidden="true" className="h-px flex-1 bg-border-secondary" />
        </div>
      );
    }

    /* A STAGE MOVE OR A SYSTEM NOTE IS NOT A MESSAGE. It is what the record
       did between two messages, so it reads as a quiet centred line rather
       than as somebody speaking. */
    if (e.kind !== "REMARK") {
      lastWho = null;
      body.push(
        <div key={i} className="flex justify-center px-4 py-1.5">
          <span className={cx(
            "max-w-full rounded-full bg-primary px-2.5 py-1 text-center text-xs ring-1 ring-inset",
            e.tone === "bad" ? "text-error-primary ring-secondary" : "text-tertiary ring-secondary",
          )}>
            {e.kind === "SYSTEM" ? e.text : <Rich text={e.text} />}
            {e.by ? <span className="text-quaternary"> · {e.by}</span> : null}
          </span>
        </div>
      );
      return;
    }

    const who = (e.by || "") + "|" + (e.channel || "manual");
    const grouped = who === lastWho;
    lastWho = who;

    /* The real send. A whatsapp/email remark carries the exact text just
       logged into the link, so the agent writes it once here and the second
       app opens ready to actually send it. */
    const openHref = e.channel === "whatsapp" && dl.phone
      ? "https://wa.me/" + waDigits(dl.phone) + "?text=" + encodeURIComponent(e.text)
      : e.channel === "email" && dl.email
        ? "mailto:" + dl.email + "?body=" + encodeURIComponent(e.text)
        : null;

    body.push(
      <div key={i} className={cx("flex gap-2.5 px-4", grouped ? "mt-0.5" : "mt-4")}>
        <span className="w-6 shrink-0">{grouped ? null : <Avatar name={e.by} xs />}</span>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
          {grouped ? null : (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-secondary">{e.by || "—"}</span>
              {e.channel && e.channel !== "manual"
                ? <Tag label={kindLabel(e)} tone={CHAN_TONE[e.channel]} />
                : null}
            </div>
          )}
          {/* A bubble hugs its text and stops at a READABLE measure. Now that
              the workspace takes the whole window the pane can be a thousand
              pixels wide, and `max-w-full` alone would set a paragraph as one
              unbroken line the eye cannot get back to the start of. */}
          <div className="max-w-[min(100%,42rem)] rounded-lg bg-primary px-3 py-2 text-sm whitespace-pre-wrap text-secondary shadow-xs ring-1 ring-secondary">
            {e.text}
          </div>
          {openHref
            ? <a className="inline-flex items-center gap-1 rounded text-xs font-medium text-brand-secondary outline-focus-ring hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                href={openHref} target="_blank" rel="noreferrer">
                <Icon name="ext" size="xs" />Open in {CHAN_LABEL[e.channel]}
              </a>
            : null}
        </div>
      </div>
    );
  });

  return (
    <section className={cx("min-w-0 flex-1 flex-col bg-chat lg:flex", cls)} aria-label="Conversation">
      <Head dl={dl} p={p} />
      <div className="min-h-0 flex-1 overflow-y-auto pb-4" id="dwsChatScroll" ref={scroll}>
        {ev.length
          ? body
          : <p className="px-6 py-12 text-center text-sm text-tertiary">No activity yet. Add the first remark below.</p>}
      </div>
      <Composer dl={dl} p={p} />
    </section>
  );
}

/* Who the deal belongs to, as faces rather than a line of text. Owner leads,
   any co-owner sits behind — the stack IS the answer to "is this shared",
   readable before a word is. The stack is also the button that opens Reassign,
   so the way to change who is on a deal is to press the people already on it.
   Head-only, because that is who the server lets reassign. */
function People({ dl, p }: { dl: any; p: Params }) {
  const acts = useActs(p);
  const tip = dl.co_owner_id
    ? dl.owner_id + " with " + dl.co_owner_id + (head() ? " — press to change" : "")
    : "Owned by " + (dl.owner_id || "nobody") + (head() ? " — press to reassign" : "");
  const faces = (
    <>
      <Avatar name={dl.owner_id || "—"} xs />
      {dl.co_owner_id ? <span className="-ml-1.5"><Avatar name={dl.co_owner_id} xs /></span> : null}
    </>
  );
  if (!head()) return <span className="flex shrink-0 items-center" title={tip} aria-label={tip}>{faces}</span>;
  return (
    <button type="button" data-act="dl-reassign" data-ref={dl.deal_id} title={tip} aria-label={tip}
      className="flex shrink-0 cursor-pointer items-center rounded-full p-0.5 outline-focus-ring transition duration-100 hover:bg-primary_hover focus-visible:outline-2"
      onClick={() => acts.reassign(dl.deal_id)}>
      {faces}
    </button>
  );
}

/* The identity row, then the control row. Stage and priority are the two
   fields an agent retunes as a call goes on, so both are controls rather than
   read-only pills; the deal's lists sit on the same line, each with the × that
   takes it off THIS deal only. No back arrow — the deals list is the left
   pane, already on screen, so there is nothing to go back to. */
function Head({ dl, p }: { dl: any; p: Params }) {
  const acts = useActs(p);
  const tags = dl.tags || [];
  return (
    <header className="flex shrink-0 flex-col gap-2 border-b border-secondary bg-primary px-4 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar name={dl.customer_name} sm />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-md font-semibold text-primary">{dl.customer_name}</h2>
          <div className="truncate text-xs text-tertiary">
            {dl.business_name ? dl.business_name + " · " : ""}{place(dl)}
            {dl.interested_in ? " · " + dl.interested_in : ""}
          </div>
        </div>
        <People dl={dl} p={p} />
        <MoreMenu dl={dl} onValue={() => acts.value(dl.deal_id)}
          onReassign={() => acts.reassign(dl.deal_id)} onClose={() => acts.closeDeal(dl.deal_id)} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <StageMenu dl={dl} size="xs" onPick={(to) => {
          /* Lost needs a reason and Won is worth confirming — that is Close
             deal's job, not the generic modal's. A quick pick lands on the same
             guarded flow the dedicated Close-deal button does. */
          if (to === STAGE.LOST || to === STAGE.WON) acts.closeDeal(dl.deal_id);
          else acts.stageRemark(dl.deal_id, to, dl.stage);
        }} />
        <PrioMenu dl={dl} size="xs" onPick={(v) => acts.priority(dl.deal_id, v)} />
        {dl.is_stalled ? <Pill dot tone="warn" text="Stalled" /> : null}
        <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-border-secondary" />
        {tags.length
          ? tags.map((t: any) => (
              <Tag key={t.slug} label={t.label} tone={t.tone || ""}
                onRemove={() => acts.untag(dl.deal_id, t.slug)} />
            ))
          : <span className="text-xs text-quaternary">No lists yet</span>}
        <Button color="link-gray" size="xs" ico="plus" data-act="dl-tag" data-ref={dl.deal_id}
          onClick={() => acts.tags(dl.deal_id)}>List</Button>
      </div>
    </header>
  );
}

/* ------------------------------------------------------- composer marks ---
   Bold and a bullet list, applied to whatever is selected in the box. They are
   TEXT MARKS, not rich text: a remark is a string on the wire, and the marker
   written is the one the destination reads back — WhatsApp bolds *one
   asterisk*, markdown and every other reader want **two**, and "- " opens a
   list in both. So the button writes what the picked channel understands. */
const boldMark = (chan: string) => (chan === "whatsapp" ? "*" : "**");

/* Written through execCommand where the browser still has it, because that is
   what keeps the edit on the native undo stack — assigning `el.value` throws
   away every ctrl+Z the person had, which on a half-written call summary is
   the one place you cannot afford it. setRangeText is the fallback. */
function writeInto(el: HTMLTextAreaElement, start: number, end: number, text: string, selFrom: number, selTo: number) {
  el.focus();
  el.setSelectionRange(start, end);
  let ok = false;
  try { ok = document.execCommand("insertText", false, text); } catch { ok = false; }
  if (!ok) el.setRangeText(text, start, end, "end");
  el.setSelectionRange(selFrom, selTo);
}

/* The word the caret sits in, so a click with nothing selected bolds something
   rather than dropping two asterisks in the middle of a sentence. */
function wordAt(v: string, at: number): [number, number] {
  let a = at, b = at;
  while (a > 0 && !/\s/.test(v[a - 1])) a--;
  while (b < v.length && !/\s/.test(v[b])) b++;
  return [a, b];
}

// One placeholder per channel — what the box hints depends on how the text
// is about to go out.
const CHAN_PLACEHOLDER: Record<string, string> = {
  manual: "Log a call, a site visit, or what you told the customer…",
  whatsapp: "Message sent to the customer via WhatsApp…",
  email: "Message sent to the customer via email…",
};

/* The composer is WRITING SPACE and nothing else: the channel picker and the
   two marks sit above it, Send sits INSIDE it, and the box grows with what
   is typed (`field-sizing-content`) up to a third of the pane before it starts
   scrolling itself. No bar underneath explaining where a remark lands — that
   sentence was the same on every deal forever, and it was height taken from
   the one thing in this box anybody uses. */
function Composer({ dl, p }: { dl: any; p: Params }) {
  const acts = useActs(p);
  const shell = useShell();
  const ta = useRef<HTMLTextAreaElement>(null);
  const [busy, setBusy] = useState(false);
  /* IS THERE ANYTHING TO SEND — the only thing this composer needs from the
     text, and the reason it is a boolean rather than the value: holding the
     draft in state would re-render the whole pane on every keystroke to
     redraw one button. The textarea stays uncontrolled; `ta.current.value` is
     still the single source of what gets sent. */
  const [typed, setTyped] = useState(false);
  const sync = () => setTyped(!!(ta.current && ta.current.value.trim()));
  /* Module state (chanOf/setChan), mirrored locally so picking a channel
     re-renders this composer — the prototype's `var CHAN` had a whole page
     re-render to lean on; React needs its own trigger. */
  const [chan, setChanLocal] = useState(chanOf());

  /* EVERY PROGRAMMATIC WRITE goes through here, so `typed` cannot fall out of
     step with the box: writeInto's execCommand path fires an input event and
     React sees it, but the setRangeText fallback fires nothing at all. */
  const put = (el: HTMLTextAreaElement, start: number, end: number, text: string, selFrom: number, selTo: number) => {
    writeInto(el, start, end, text, selFrom, selTo);
    sync();
  };

  /* Both marks run on the SELECTION, and both toggle: a second press on
     something already bold takes the markers off rather than doubling them. */
  const bold = () => {
    const el = ta.current; if (!el) return;
    const m = boldMark(chan), v = el.value;
    let a = el.selectionStart, b = el.selectionEnd;
    if (a === b) [a, b] = wordAt(v, a);
    const sel = v.slice(a, b);
    // Already wrapped — either the markers sit just outside the selection (the
    // usual case, re-pressing after bolding) or inside it (dragged over the
    // asterisks too). Both come off.
    if (v.slice(Math.max(0, a - m.length), a) === m && v.slice(b, b + m.length) === m)
      return put(el, a - m.length, b + m.length, sel, a - m.length, b - m.length);
    if (sel.length > 2 * m.length && sel.startsWith(m) && sel.endsWith(m))
      return put(el, a, b, sel.slice(m.length, -m.length), a, b - 2 * m.length);
    // Nothing to bold and no word under the caret: leave the markers with the
    // caret between them, which is what every editor does with an empty press.
    put(el, a, b, m + sel + m, a + m.length, a + m.length + sel.length);
  };

  /* Whole lines, never part of one — the selection is widened to the lines it
     touches first, so half-selecting two lines still bullets both of them. */
  const bullet = () => {
    const el = ta.current; if (!el) return;
    const v = el.value;
    const a = v.lastIndexOf("\n", Math.max(0, el.selectionStart - 1)) + 1;
    const nl = v.indexOf("\n", el.selectionEnd);
    const b = nl === -1 ? v.length : nl;
    const lines = v.slice(a, b).split("\n");
    const on = lines.every((l) => !l.trim() || /^\s*- /.test(l));
    const next = lines.map((l) => (!l.trim() ? l : on ? l.replace(/^(\s*)- /, "$1") : "- " + l)).join("\n");
    put(el, a, b, next, a, a + next.length);
  };

  /* Ctrl/⌘+B, because a toolbar button that has no shortcut is a button people
     stop reaching for. */
  const keys = (e: ReactKeyEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "b" || e.key === "B")) { e.preventDefault(); bold(); }
  };
  /* Keeps the textarea's selection alive while a mark button is pressed —
     without this the mousedown blurs the box and the mark lands on nothing. */
  const holdSel = (e: ReactMouseEvent) => e.preventDefault();

  const pick = (ch: string) => { setChan(ch); setChanLocal(ch); };

  /* The box is cleared only on a write the SERVER accepted — clearing
     optimistically loses what somebody typed the one time it matters. */
  const send = () => {
    const text = ta.current ? ta.current.value.trim() : "";
    if (!text) return shell.toast("Write something before sending.", "bad");
    setBusy(true);
    acts.send(dl.deal_id, text, chan).then((ok: boolean) => {
      setBusy(false);
      if (!ok) return;
      if (ta.current) ta.current.value = "";
      setTyped(false);          // the box is empty again, so Send goes away again
      setChanLocal(chanOf());   // acts.send resets the module state to manual
    });
  };

  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-secondary bg-primary p-3">
      {/* HOW IT GOES OUT, then WHAT GOES OUT, then the send. The channel row is
          allowed to wrap in a narrow pane; Send never is, because it sits on
          the writing row where the thing it sends is. */}
      <div className="flex flex-wrap items-center gap-2">
        <Segmented sm label="Channel" value={chan} onPick={pick}
          options={[
            { v: "manual", l: "Remark", ico: "note" },
            { v: "whatsapp", l: "WhatsApp", ico: "message" },
            { v: "email", l: "Email", ico: "mail" },
          ]} />
        <span aria-hidden="true" className="h-5 w-px bg-border-secondary" />
        {/* The mousedown is caught on the WRAPPER: preventing it there keeps
            the textarea's selection alive while either mark is pressed —
            without it the press blurs the box and the mark lands on nothing. */}
        <span className="flex items-center gap-1" onMouseDown={holdSel}>
          <IconButton ico="bolt" size="xs" label={"Bold  " + boldMark(chan) + "text" + boldMark(chan)} onClick={bold} />
          <IconButton ico="list" size="xs" label="Bullet list" onClick={bullet} />
        </span>
      </div>
      {/* SEND LIVES IN THE BOX, at the corner the text is growing towards, and
          only once there is something to send. An always-present Send on an
          empty composer is a button whose only outcome is a scolding toast;
          `pr-14` is the seat it will sit in, held open so the arrow never
          lands on top of a word the moment it appears.

          It stays icon-only while it sends, too: a button that grows into
          "Sending…" under the caret would reflow the line somebody is still
          reading. That state is in the label. */}
      <div className="relative">
        <TextAreaBase
          id="dwsComposerText"
          ref={ta}
          rows={2}
          size="sm"
          aria-label="Write a remark"
          placeholder={CHAN_PLACEHOLDER[chan]}
          className="field-sizing-content max-h-64 min-h-16 w-full resize-none pr-14"
          onKeyDown={keys}
          onChange={sync}
        />
        {typed ? (
          <Button color="primary" size="xs" ico="arrow"
            className="absolute right-2 bottom-2"
            aria-label={busy ? "Sending…" : "Send"}
            data-act="dl-send" data-ref={dl.deal_id}
            isDisabled={busy} onClick={send} />
        ) : null}
      </div>
    </div>
  );
}

/* ========================================================== CONTEXT PANE === */
function CtxPane({ dl, p, cls }: { dl: any; p: Params; cls: string }) {
  /* One fetch for the whole chain half of this pane — the Quotation block, the
     Invoices block AND the two chain actions all read it, so they cannot
     disagree about what this deal has. */
  const docs = useDealDocs(dl.deal_id);
  const quote: QuotationRow | null = docs.quotations.length ? docs.quotations[0] : null;

  return (
    <aside className={cx("w-full min-w-0 shrink-0 flex-col gap-5 overflow-y-auto border-secondary p-4 lg:flex lg:w-80 lg:border-l 2xl:w-[22rem]", cls)}
      aria-label="Deal details">
      {/* Three cells, and all three are REAL: deal value is the agreed total on
          the record, collected is the sum of the payment ledger, outstanding is
          the first minus the second. The server computes both sums from rows
          (DealsController._with_chain) — nothing here is estimated. */}
      <section className="flex flex-col gap-2">
        <Eyebrow>Money</Eyebrow>
        <div className="grid grid-cols-3 gap-2">
          <MoneyCellCtx k="deal value" v={dl.deal_value ? inr(dl.deal_value, { compact: true }) : "—"} />
          <MoneyCellCtx k="collected" v={inr(dl.revenue_collected || 0, { compact: true })} tone="ok" />
          <MoneyCellCtx k="outstanding" v={inr(dl.outstanding || 0, { compact: true })} tone="warn" />
        </div>
        {/* Under the three figures, not in place of them: the same numbers as a
            ratio, which the row above makes you work out. No deal value, no
            denominator, no bar. */}
        {dl.deal_value
          ? <Meter tone="ok" value={dl.revenue_collected || 0} max={dl.deal_value}
              label={"Collected against the deal value"} />
          : null}
      </section>

      <section className="flex flex-col gap-2">
        <Eyebrow>Stage</Eyebrow>
        <StagePipeline stage={dl.stage} closeReason={dl.close_reason} compact />
        <p className="text-xs text-quaternary tnum">{Math.abs(daysFrom(dl.stage_since))} days in stage</p>
      </section>

      {/* Who you are talking to, before the deal mechanics — the composer sits
          right below, so the contact details have to be reachable without
          opening a dialog. */}
      <section className="flex flex-col gap-2">
        <Eyebrow>Contact</Eyebrow>
        <KvList pairs={[
          ["Business", orDash(dl.business_name)],
          ["Email", dl.email
            ? <a className="rounded text-brand-secondary outline-focus-ring hover:underline focus-visible:outline-2" href={"mailto:" + dl.email}>{dl.email}</a>
            : null],
          ["Phone", <span className="font-mono tnum">{dl.phone}</span>],
          ["Location", place(dl)],
        ]} />
      </section>

      <section className="flex flex-col gap-2">
        <Eyebrow>Deal facts</Eyebrow>
        <KvList pairs={([
          ["Owner", <>{dl.owner_id || "—"}{dl.co_owner_id ? <span className="text-tertiary"> + {dl.co_owner_id}</span> : null}</>],
          ["Interested in", orDash(dl.interested_in)],
          /* The intake reference. A plain string that points at whatever
             collected the submission — see Deal.enquiryRef — so it is shown and
             never linked: there is nothing on this side to open. */
          ["Enquiry", dl.enquiry_id ? <span className="font-mono tnum">{dl.enquiry_id}</span> : null],
          ["Created", D.fmtDate(dl.created_at)],
          /* Both rows are ALWAYS present, with a null value where there is no
             figure — KvList renders that as the faint em-dash. Hiding the row
             instead makes the panel change height per deal and quietly loses
             the fact that the field exists and is unset. */
          ["Expected close", dl.expected_close_date ? D.fmtDate(dl.expected_close_date) : null],
          /* Off the live quotation, not the deal — a discount is a term of an
             offer, and the deal has no column for one. */
          ["Discount", quote ? quote.discountPct + "%" : null],
        ] as [ReactNode, ReactNode][])} />
      </section>

      {/* THE CHAIN, as the panel's one drawing of it — the same strip
          Quotations and Invoices put at the top of their own detail pages, so
          "where is this deal in the sequence" is answered identically wherever
          you are standing. */}
      <section className="flex flex-col gap-2">
        <Eyebrow>Chain</Eyebrow>
        <ChainStrip dealRef={dl.deal_id} here="deal" quotation={quote} />
      </section>

      {/* ONE DOCUMENTS BLOCK, not a Quotation block and an Invoices block. The
          strip above already says where the chain has got to; this is the list
          of the actual papers, newest kind first, each openable — and the slot
          that is still empty is the control that fills it. Two headings for one
          sequence made the pane read as two unrelated stacks. */}
      <section className="flex flex-col gap-2">
        <Eyebrow>Documents{docs.invoices.length ? " · " + (docs.invoices.length + (quote ? 1 : 0)) : ""}</Eyebrow>
        {quote
          ? <ChainCard to={"#/quotations/" + quote.id} icon="quote"
              tone={quote.status === "accepted" ? "ok" : quote.status === "draft" ? "warn" : "q"}
              t1={<>{quote.quotationNumber || "Draft"} <span className="font-normal text-tertiary">v{quote.version}</span></>}
              t2={(Q_LABEL[quote.status] || cap(quote.status)) + " · " + inr(quote.grandTotalPaise)} />
          : <ChainAdd dl={dl} kind="quotation" docs={docs} />}
        {docs.invoices.length
          ? docs.invoices.map((i: InvoiceRow) => (
              <ChainCard key={i.id} to={"#/invoices/" + i.id} icon="invoice"
                tone={i.status === "issued" ? "ok" : i.status === "cancelled" ? "dead" : "warn"}
                t1={i.invoiceNumber || "Draft"}
                t2={(I_LABEL[i.status] || cap(i.status)) + " · " + inr(i.grandTotalPaise) +
                    (i.cancellationReason ? " · " + i.cancellationReason : "")} />
            ))
          : <ChainAdd dl={dl} kind="invoice" docs={docs} />}
      </section>

      <section className="flex flex-col gap-2">
        <Eyebrow>Actions</Eyebrow>
        <ChatActions dl={dl} p={p} />
      </section>
    </aside>
  );
}

/* THE EMPTY SLOT, AS THE WAY TO FILL IT.

   "None yet." was a sentence that answered a question nobody asked and left you
   to go and find the module that raises one. The dashed card says the same
   thing by being empty AND is the control — one target, no second trip.

   It stays pressable when the chain is not ready for it, rather than vanishing
   or greying out: a control that disappears takes the sequence with it (a
   quotation becomes an invoice becomes money), and a grey one invites a press
   and answers with nothing. When it cannot act it says what has to happen
   first — chainGate() below, read off the same documents the enabled path
   reads, so the button and the rule cannot disagree. */
function ChainAdd({ dl, kind, docs }: {
  dl: any; kind: "quotation" | "invoice"; docs: DealDocsState;
}) {
  const shell = useShell();
  const pop = usePop();
  const [busy, setBusy] = useState(false);

  if (docs.loading) return <p className="text-sm text-quaternary">Loading…</p>;

  const gate = chainGate(dl, kind, docs);
  const label = kind === "quotation" ? "Create quote" : "Raise invoice";

  if (gate) return (
    <button type="button" data-act="dl-gate" title={gate.title}
      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-primary px-3 py-3 text-sm font-medium text-tertiary outline-focus-ring transition duration-100 hover:border-secondary hover:text-secondary focus-visible:outline-2 focus-visible:outline-offset-2"
      onClick={(e) => pop(e, <GateBody title={gate.title} body={gate.body} />, { width: 288 })}>
      <Icon name="lock" size="sm" />{label}
    </button>
  );

  const accepted = docs.quotations.filter((q) => q.status === "accepted");
  const create = () => {
    setBusy(true);
    (kind === "quotation"
      ? AdminOpsService.createQuotation(dl.deal_id).then((r) => ({ base: "#/quotations/", r }))
      : AdminOpsService.createInvoice(dl.deal_id, accepted[0].id).then((r) => ({ base: "#/invoices/", r }))
    ).then(({ base, r }) => {
      if (r.response === false) {
        setBusy(false);
        shell.toast(r.code + " — " + (r.data as any).message, "bad");
        return;
      }
      shell.toast(kind === "quotation" ? "Quotation drafted." : "Invoice drafted.");
      render();   // the Q/I/₹ squares on every row read this deal's chain too
      go(base + r.data.id + "?mode=edit");
    }).catch((e: unknown) => {
      setBusy(false);
      const f = refusalOf(e);
      shell.toast(f.http + " " + f.code + " — " + f.detail, "bad");
    });
  };

  return (
    <button type="button" disabled={busy} onClick={create}
      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-brand px-3 py-3 text-sm font-semibold text-brand-secondary outline-focus-ring transition duration-100 hover:bg-brand-primary focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
      <Icon name="plus" size="sm" />{busy ? "Working…" : label}
    </button>
  );
}

type Gate = { title: string; body: string } | null;
/* Why this link in the chain cannot be made yet, in the words of the rule that
   stops it. Both callers — the empty-slot card and the Actions button — read
   THIS, so the two can never give different answers about the same deal. */
function chainGate(dl: any, kind: "quotation" | "invoice", docs: DealDocsState): Gate {
  if (kind === "quotation") {
    if (!can("quotations", "create"))
      return { title: "Not in your access",
               body: "Creating quotations is not in your role for this session." };
    if (dl.stage >= STAGE.WON)
      return { title: "This deal is " + D.STAGES[dl.stage].label,
               body: "A quotation is an offer, and a closed deal is not open to one. Reopen the " +
                     "deal first and the draft can be raised against it." };
    return null;
  }
  if (!can("invoices", "create"))
    return { title: "Not in your access",
             body: "Raising invoices is not in your role for this session." };
  /* Superseded and cancelled quotations are not "a quotation this deal has" —
     one was replaced, the other killed. Reading them as present would tell you
     to go accept a document that no longer exists. */
  const live = docs.quotations.filter((q) => q.status !== "superseded" && q.status !== "cancelled");
  if (!live.length)
    return { title: "There is no quotation yet",
             body: "An invoice bills an accepted quotation — it never invents its own amount. Create " +
                   "the quote first, issue it, and raise the invoice once the customer accepts." };
  if (!live.some((q) => q.status === "accepted"))
    return { title: "The quotation is not accepted yet",
             body: "This deal's quotation is " + (Q_LABEL[live[0].status] || live[0].status).toLowerCase() +
                   ". Until the customer accepts it there is no agreed amount to bill." };
  /* The same test the server makes, stated before the press rather than as a
     422 after it: nothing left uninvoiced means nothing left to raise. */
  if (dl.deal_value && (dl.revenue_collected || 0) >= dl.deal_value)
    return { title: "Everything is invoiced",
             body: "The accepted value of this deal is fully covered by the invoices already raised. " +
                   "There is nothing left to bill." };
  return null;
}

/* WHAT THE BLOCKS ABOVE DO NOT ALREADY DO, AND NOTHING ELSE.

   Create quote and Raise invoice used to be repeated here as buttons beside the
   very slots that already offer them, and Open quote repeated the document card
   that already links it — three controls with two homes each, which is exactly
   how the panel ends up telling you two things about one deal.

   What is left is the record pair: what we hold, and what they sent. Neither is
   primary — both are things you can always do and rarely the thing to do next;
   the documents above are what move the deal.

   Change value, Lists, Change stage and Close deal are not here either: value
   and Close live in the header ⋮ menu, Lists on the header control row, and
   stage on its own stage button. Add remark is the composer to the left. */
function ChatActions({ dl, p }: { dl: any; p: Params }) {
  const acts = useActs(p);
  const pop = usePop();
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button color="secondary" ico="doc" data-act="dl-edit" data-ref={dl.deal_id}
        onClick={() => acts.edit(dl.deal_id)}>Edit deal</Button>
      <Button color="secondary" ico="lock" data-act="dl-gate"
        onClick={(e?: ReactMouseEvent<HTMLButtonElement>) => e && pop(e, <GateBody title={RESPONSE_GATE.title} body={RESPONSE_GATE.body} />, { width: 288 })}>
        View response</Button>
    </div>
  );
}

/* View response is ALWAYS gated, and that is a statement about the data rather
   than a placeholder. `Deal.enquiryRef` is a plain string identifying a
   submission in whatever collected it — not a foreign key, and no submitted
   form is stored on this side. There is nothing to open, on any deal, so the
   button says so instead of opening an empty dialog. It becomes real the day
   intake submissions are stored against the deal. */
const RESPONSE_GATE = {
  title: "No stored submission",
  body: "The enquiry reference on this deal points at whatever intake collected it — it is a " +
        "reference, not a record we hold. There is no submitted form on this side to show.",
};
