/* =============================================================================
   CHAT WORKSPACE — the "Chat" view mode. Replaces the drawer for this one mode
   only; Table and Pipeline keep opening the drawer exactly as before. It reads
   the SAME fetch as those two, so the deal picked here is always a deal the
   current filters would also show there.

   The quotation card, the invoice cards, the collected/outstanding read-outs
   and the co-assignment stack are still gone — each rendered a browser-side
   store with no model behind it.

   The WhatsApp/Email composer channels are BACK, but not as they were. In the
   prototype a message "sent via WhatsApp" was a coloured bubble and nothing
   else — no model, no actual send. Now: `channel` is DealRemark.typeKey, a
   real column (manual/whatsapp/email, see DealsController.CLIENT_REMARK_TYPES),
   and a whatsapp/email-tagged remark grows a genuinely new "Open ↗" link that
   was never in the prototype either — wa.me / mailto prefilled with the exact
   text just logged, so the agent writes the message once and sends it for
   real, instead of retyping it in a second app.
   ============================================================================= */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { EmptyState, Icon, KvList, PaneLoading, Pill, SearchField, avatarTone, cap, initials, qs } from "../../ui";
import { go } from "../../ui/nav";
import { can } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import {
  D, STAGE, chanOf, daysFrom, head, inr, place, prioTone, refusalOf, relativeDate, render,
  setChan, urgency, useDealApi, useDealDocs, usePop
} from "./useDeals";
import type { DealDocsState } from "./useDeals";
import AdminOpsService from "../../../api/modules/adminOps";
import type { InvoiceRow, QuotationRow } from "../../../api/modules/adminOps";
import { STATUS_LABEL as Q_LABEL } from "../Quotations/api";
import { STATUS_LABEL as I_LABEL } from "../Invoices/api";
import type { DealsApiState, Params } from "./useDeals";
import { ChainDots, MoneyCellCtx, Rich, TagChips, orDash, toneClass } from "./bits";
import { useActs } from "./Modals";
import { ChipMenu, CHIP_LABEL, MoreMenu, Odot, PrioMenu, StageMenu, chipOptions } from "./menus";

export function ChatWorkspace({ id, p, api }: {
  id: string | null; p: Params; api: DealsApiState;
}) {
  const list = api.list;
  const acts = useActs(p);
  const canCreate = can("deals", "create");

  /* ponytail: falls back to the first row of the already-loaded, filter-
     matching API list when no id is in the URL — the same "open something"
     behaviour the module has always had, sourced from the one shared fetch. */
  const ref = id || (list.length ? list[0].deal_id : null);

  /* Nothing matched, but only because of a FILTER: the workspace stays exactly
     where it is — list pane with its chips (the only way back out) and its own
     "no deals match" line, detail panes blank. Taking the whole page over with
     an empty state would hide the very controls you need to widen the search,
     and claim the pipeline is empty when it is not. The full-page state is for
     the one case it is true: no filters, no deals. */
  const filtered = !!(p.q || p.stage || p.tag || p.owner || p.priority || p.next || p.stalled);

  if (!ref && !filtered) return (
    <div className="dws"><div className="dws-panes" style={{ gridTemplateColumns: "1fr" }}>
      <EmptyState icon="deal" title="No deals yet"
        body={"Nothing in the pipeline yet." +
          (canCreate ? " Create one for an inbound call, a walk-in or a referral." : " Once one exists, its chat opens here.")}
        action={canCreate
          ? <button className="btn pri" data-act="dl-create" onClick={() => acts.create()}>Create deal</button>
          : null} />
    </div></div>
  );

  /* THE SPLIT THAT KEEPS THE LIST STILL.

     The detail fetch used to live here, in the parent of all three panes, so
     every response — a deal switch, and every write, since each one re-fetches
     — re-rendered the list too, and the "nothing loaded yet" branch returned a
     full-page loader that took the whole workspace down with it.

     `<DetailPanes>` owns that fetch now. The list renders from `api`, which
     changes only when the FILTERS change, so picking another deal moves
     nothing on the left. The two halves of this screen have genuinely separate
     reasons to re-render, and now they are separate components to match.

     `ref` (the URL param), not the loaded deal's id — the list highlight has
     to jump to the clicked row the instant it is clicked, not wait for that
     deal's own fetch to resolve. */
  return (
    <div className="dws">
      <div className="dws-panes">
        <ListPane list={list} activeRef={ref || ""} p={p} api={api} />
        {ref
          ? <DetailPanes dealRef={ref} p={p} />
          : <><section className="dws-chat" /><aside className="dws-ctx" /></>}
      </div>
    </div>
  );
}

/* The two panes that are about ONE deal. Everything here re-renders when the
   selected deal's data changes; nothing outside it does. */
function DetailPanes({ dealRef, p }: { dealRef: string; p: Params }) {
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
        <section className="dws-chat"><PaneLoading label={"Opening " + dealRef + "\u2026"} /></section>
        <aside className="dws-ctx"><PaneLoading label="" /></aside>
      </>
    );
  }

  /* The ref genuinely is not in the API's deal set (a stale link, or an
     account that never had it) — the panel's own not-found state, never a
     silent fall-back onto an unrelated deal. */
  if (!detail.deal) return (
    <section className="dws-chat">
      <EmptyState icon="deal" title="Deal not found"
        body={"\u201c" + dealRef + "\u201d is not in the API's deal set."} />
    </section>
  );

  return (
    <>
      <ChatPane dl={detail.deal} ev={detail.timeline} p={p} />
      <CtxPane dl={detail.deal} p={p} />
    </>
  );
}

/* AT MODULE SCOPE, NOT INSIDE ListPane. Declared in ListPane's body it was a
   NEW component type on every render, so React threw the chip's <button> away
   and mounted a fresh one each time — including the render that opening the
   menu itself triggers (usePop reads shell context, so ListPane re-renders).
   The popover measured the element it was handed, which by then was detached:
   getBoundingClientRect() read all zeros and the menu landed at the top-left
   of the page instead of under the chip. A stable type keeps the DOM node, and
   the rect stays real. */
/* A filter chip. It used to be a transparent native <select> laid over the
   chip, which meant the browser drew the option list using the SELECT's
   colours — and those are the chip's, so an active (mint-on-tint) chip
   produced a mint-on-nothing popup. The chip now opens the app's own menu
   instead: same look as the view switcher, fully themeable. */
function Chip({ name, p, api }: { name: string; p: Params; api: DealsApiState }) {
  const pop = usePop();
  const value = p[name];
  const label = CHIP_LABEL[name] || name;
  const on = value !== undefined && value !== null && value !== "";
  let sel: { v: string | number; l: string; dot?: string } | null = null;
  if (on) chipOptions(name, api).forEach((o) => { if (String(o.v) === String(value)) sel = o; });
  const chosen = sel as { l: string; dot?: string } | null;
  return (
    <button className={"dws-chip" + (on ? " on" : "")} data-act="dl-chipmenu" data-name={name}
      aria-haspopup="menu" aria-label={label + (on ? ": " + ((chosen && chosen.l) || value) : "")}
      onClick={(e) => pop(e, <ChipMenu name={name} p={p} api={api} />,
        { width: 210, cls: "pop-views pop-chip", align: "left" })}>
      {/* the chosen option's colour rides on the chip too, so it survives the
          menu closing — otherwise the dot would only ever be seen
          mid-decision */}
      {on ? <Odot o={chosen} /> : null}
      <span className="lb">{on ? ((chosen && chosen.l) || value) : label}</span>
      <Icon name="chev" size="sm" />
    </button>
  );
}

/* ============================================================ LIST PANE === */
function ListPane({ list, activeRef, p, api }: { list: any[]; activeRef: string; p: Params; api: DealsApiState }) {
  const acts = useActs(p);
  const timer = useRef<number | undefined>(undefined);
  const onSearch = (name: string, value: string) => {
    window.clearTimeout(timer.current);
    // No selection (a filter matched nothing) — keep the id segment off the URL
    // entirely rather than emitting "#/deals/?q=…".
    const to = "#/deals" + (activeRef ? "/" + encodeURIComponent(activeRef) : "")
      + qs({ ...p, [name]: value });
    timer.current = window.setTimeout(() => go(to), 220);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <aside className="dws-list">
      <div className="dws-list-top">
        {/* Search first, with New deal beside it. The old "Deals · 14 shown"
            title was restating the page you are already on. */}
        <div className="dws-find">
          <SearchField ph="Search deals…" val={p.q} onFilter={onSearch} />
          {can("deals", "create")
            ? <button className="btn icon" data-act="dl-create" aria-label="Create deal" title="Create deal"
                onClick={() => acts.create()}><Icon name="plus" /></button>
            : null}
        </div>
        {/* One scrolling row, so the number of filters never changes the pane's
            layout. Each chip shows its ACTIVE value when set and its own name
            when not — a filter whose value you cannot read is decoration. */}
        <div className="dws-filters">
          <Chip name="stage" p={p} api={api} />
          <Chip name="tag" p={p} api={api} />
          <Chip name="priority" p={p} api={api} />
          {head() ? <Chip name="owner" p={p} api={api} /> : null}
          <Chip name="sort" p={p} api={api} />
        </div>
      </div>
      <div className="dws-list-scroll">
        {list.length
          ? list.map((d: any) => <Row key={d.deal_id} d={d} activeRef={activeRef} p={p} />)
          : <div className="faint" style={{ fontSize: "var(--text-md)", padding: "16px 10px" }}>
              No deals match these filters.</div>}
      </div>
    </aside>
  );
}

function Row({ d, activeRef, p }: { d: any; activeRef: string; p: Params }) {
  const u = urgency(d);
  const over = d.next_action && daysFrom(d.next_action.date) < 0 && d.stage < STAGE.WON;
  // `last_remark_at` is only ever set on the ONE deal fetched in full by
  // useDealApi() (see useDeals.ts) — the API's list endpoint doesn't return
  // it per row, so every other row here falls back to created_at, same as
  // it would for a deal with no remarks yet.
  const when = d.is_stalled ? "Stalled"
    : over ? Math.abs(daysFrom(d.next_action.date)) + "d overdue"
    : relativeDate(d.last_remark_at || d.created_at);
  const to = "#/deals/" + d.deal_id + qs(p);
  return (
    <a className={"dws-row" + (activeRef === d.deal_id ? " on" : "")} data-go={to} onClick={() => go(to)}>
      <div className="l1">
        <span className={"name" + (u ? " " + u.cls : "")} title={u ? u.why : ""}>{d.customer_name}</span>
        {/* The deal's own value — the only money on the record. Null means
            nothing has been quoted yet, which is not ₹0. */}
        <span className="amt tnum">{d.deal_value ? inr(d.deal_value, { compact: true }) : "—"}</span>
      </div>
      <div className="l2">
        <span className={"pill xs" + (D.STAGES[d.stage].tone ? " " + D.STAGES[d.stage].tone : "")}>
          {D.STAGES[d.stage].label}</span>
        <span className={"time" + (u ? " " + u.cls : "")}>{when}</span>
      </div>
      <TagChips max={2} tags={d.tags} />
      {/* The chain, on its own line under the tags — the prototype's `l3`.
          It is where the row answers "how far has this deal actually got",
          which the stage pill alone cannot say: a deal can sit in Followup
          with an accepted quotation and a paid invoice behind it. */}
      <div className="l3"><ChainDots d={d} /></div>
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
/* One short name per channel, mirroring the prototype's CHAN_CLS — every
   surface that colours itself by channel (bubble, badge, composer button)
   takes it from here, and the CSS needs one class per channel and nothing
   else (see .dws-msg.wa / .dws-msg.em in admin-theme.css). */
const CHAN_CLS: Record<string, string> = { whatsapp: "wa", email: "em", manual: "rmk" };
function chanCls(channel?: string) { return CHAN_CLS[channel || "manual"] || "rmk"; }

function kindLabel(e: any) {
  if (e.kind !== "REMARK") return cap(String(e.kind).toLowerCase());
  return e.channel === "whatsapp" ? "WhatsApp" : e.channel === "email" ? "Email" : "Remark";
}
function rowCls(e: any) {
  if (e.kind !== "REMARK") return "log";
  if (e.channel === "whatsapp") return "out wa";
  if (e.channel === "email") return "out em";
  return "log";
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
   (useDeals.ts's useDealApi) — real STAGE/REMARK/SYSTEM events, sorted newest
   first same as the prototype's Activity.timeline() was. `channel` on a
   REMARK row is DealRemark.typeKey (manual/whatsapp/email) — a real, stored
   field. Quote/invoice/payment lines the local engine's own timeline also
   produced are still absent, for the same reason Drawer.tsx's TimelineTab
   omits them: those chains are still local-only. */
function ChatPane({ dl, ev: apiEv, p }: {
  dl: any; ev: { kind: string; tone: string; at: string; by: string; text: string; channel?: string }[]; p: Params;
}) {
  const ev = apiEv.slice().reverse();   // chronological, oldest first
  const scroll = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = scroll.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [ev.length, dl.deal_id]);

  let lastDay: string | null = null;
  const body: ReactNode[] = [];
  ev.forEach((e: any, i: number) => {
    const day = String(e.at || "").slice(0, 10);
    if (day && day !== lastDay) {
      body.push(<div className="dws-daydiv" key={"d" + i}><span>{dayLabel(day)}</span></div>);
      lastDay = day;
    }
    // The real send — new, not in the prototype. A whatsapp/email remark
    // carries the exact text just logged into the link, so the agent writes
    // it once here and the second app opens ready to actually send it.
    const openHref = e.kind !== "REMARK" ? null
      : e.channel === "whatsapp" && dl.phone
        ? "https://wa.me/" + waDigits(dl.phone) + "?text=" + encodeURIComponent(e.text)
      : e.channel === "email" && dl.email
        ? "mailto:" + dl.email + "?body=" + encodeURIComponent(e.text)
      : null;
    body.push(
      <div className={"dws-msg " + rowCls(e)} key={i}>
        {e.kind !== "REMARK"
          ? <div className="dws-badge sys"><Icon name="dots" size="sm" /></div>
          : <div className={"dws-badge " + chanCls(e.channel)}>{initials(e.by)}</div>}
        <div className="dws-col">
          <div className="dws-meta"><span className="who">{e.by || ""}</span>
            <span className="ch">· {kindLabel(e)}</span></div>
          <div className="dws-bubble">
            {e.kind === "REMARK" || e.kind === "SYSTEM" ? e.text : <Rich text={e.text} />}
          </div>
          {openHref
            ? <a className="dws-openchan" href={openHref} target="_blank" rel="noreferrer">
                <Icon name="link" size="sm" />Open in {e.channel === "whatsapp" ? "WhatsApp" : "Email"}
              </a>
            : null}
        </div>
      </div>
    );
  });

  return (
    <section className="dws-chat">
      <Head dl={dl} p={p} />
      <TagRow dl={dl} p={p} />
      <div className="dws-chat-scroll" id="dwsChatScroll" ref={scroll}>
        {ev.length ? body
          : <div className="faint" style={{ textAlign: "center", padding: "40px 0", fontSize: "var(--text-md)" }}>
              No activity yet. Add the first remark below.</div>}
      </div>
      <Composer dl={dl} p={p} />
    </section>
  );
}

/* Who the deal belongs to, as faces rather than a line of text. Owner leads,
   any co-owner sits behind — the stack IS the answer to "is this shared",
   readable before a word is.

   There is no pending-request face and no split percentage any more: the
   server stores an owner and a co-owner, and nothing else. A request queue and
   a commission split are both records, and neither has a table.

   The stack is the button that opens Reassign, so the way to change who is on
   a deal is to press the people already on it. Head-only, because that is who
   the server lets reassign. */
function People({ dl, p }: { dl: any; p: Params }) {
  const acts = useActs(p);
  const face = (name: string, tip: string) => (
    <span key={name} className={"av sm " + avatarTone(name)} title={tip}>{initials(name)}</span>
  );
  const faces = [face(dl.owner_id || "—", "Owner · " + (dl.owner_id || "unassigned"))];
  if (dl.co_owner_id) faces.push(face(dl.co_owner_id, "Co-owner · " + dl.co_owner_id));

  const tip = dl.co_owner_id
    ? dl.owner_id + " with " + dl.co_owner_id + (head() ? " — click to change" : "")
    : "Owned by " + (dl.owner_id || "nobody") + (head() ? " — click to reassign" : "");

  if (!head()) return <span className="dws-people" title={tip}>{faces}</span>;
  return (
    <button className="dws-people" data-act="dl-reassign" data-ref={dl.deal_id} title={tip} aria-label={tip}
      onClick={() => acts.reassign(dl.deal_id)}>
      {faces}
      {dl.co_owner_id ? null : <span className="av sm dws-people-add"><Icon name="plus" size="sm" /></span>}
    </button>
  );
}

function Head({ dl, p }: { dl: any; p: Params }) {
  const acts = useActs(p);
  const pop = usePop();
  /* The name leads the row on its own. No back arrow — the deals list is the
     left pane, already on screen, so there is nothing to go back to. */
  return (
    <div className="dws-head">
      <div className="dws-who">
        <h1>{dl.customer_name}</h1>
        {dl.is_stalled ? <Pill text="Stalled" tone="warn" /> : null}
        {/* The plan is what the deal is FOR — it decides the value, the
            quotation and every tier gate downstream — so it reads as its own
            accented chip rather than as the first half of a sentence about
            geography. */}
        {dl.interested_in ? <span className="pill brand">{dl.interested_in}</span> : null}
        <span className="pill">{place(dl)}</span>
      </div>
      <span className="spacer"></span>
      <People dl={dl} p={p} />
      {/* Priority sits beside stage because they are the two things an agent
          retunes as a call goes on. It used to be a read-only pill, which meant
          a deal that turned urgent on a Tuesday stayed Normal forever. */}
      <button className={"dws-priobtn " + prioTone(dl.priority)} data-act="dl-priomenu" data-ref={dl.deal_id}
        aria-haspopup="menu" title="Priority · visual triage only, it never changes who the deal goes to"
        onClick={(e) => pop(e, <PrioMenu dl={dl} onPick={(v) => acts.priority(dl.deal_id, v)} />,
          { width: 250, cls: "pop-views" })}>
        <span className={"dws-odot " + prioTone(dl.priority)}></span>
        {D.PRIORITY[dl.priority]}<Icon name="chev" size="sm" />
      </button>
      {/* Stage is the one field an agent changes constantly, so it gets a
          control rather than a read-only pill buried in the identity line. */}
      <button className={"dws-stagebtn " + (D.STAGES[dl.stage].tone || "")} data-act="dl-stagemenu"
        data-ref={dl.deal_id} aria-haspopup="menu"
        onClick={(e) => pop(e, <StageMenu dl={dl} onPick={(to) => {
          /* Lost needs a reason and Won is worth confirming — that is Close
             deal's job, not the generic modal's. A quick pick lands on the same
             guarded flow the dedicated Close-deal button does. */
          if (to === STAGE.LOST || to === STAGE.WON) acts.closeDeal(dl.deal_id);
          else acts.stageRemark(dl.deal_id, to, dl.stage);
        }} />, { width: 280, cls: "pop-views" })}>
        <span className={"dws-sdot " + (D.STAGES[dl.stage].tone || "")}></span>
        {D.STAGES[dl.stage].label}<Icon name="chev" size="sm" />
      </button>
      <button className="btn icon dws-more" data-act="dl-more" data-ref={dl.deal_id} aria-haspopup="menu"
        aria-label="More actions" title="More actions"
        onClick={(e) => pop(e, <MoreMenu dl={dl} onValue={() => acts.value(dl.deal_id)}
          onReassign={() => acts.reassign(dl.deal_id)} onClose={() => acts.closeDeal(dl.deal_id)} />,
          { width: 250, cls: "pop-views" })}>
        <Icon name="dots" />
      </button>
    </div>
  );
}

/* The deal's tags, on their own strip under the header — visible without
   opening a dialog, and editable from the same place. Every tag carries an ×,
   and it takes that tag off THIS deal only.

   Read straight off the deal the API returned, so what is on screen is what is
   stored; the × posts the removal and the refetch brings the row back without
   it. */
function TagRow({ dl, p }: { dl: any; p: Params }) {
  const acts = useActs(p);
  const tags = dl.tags || [];
  return (
    <div className="dws-tagrow">
      {tags.length
        ? tags.map((t: any) => (
            <span key={t.slug} className={"pill" + toneClass(t.tone)} title={t.label + " · × removes it from this deal"}>
              {t.label}
              <button className="tag-x" data-act="dl-untag" data-ref={dl.deal_id} data-slug={t.slug}
                title={"Remove " + t.label} aria-label={"Remove " + t.label}
                onClick={() => acts.untag(dl.deal_id, t.slug)}><Icon name="x" size="sm" /></button>
            </span>
          ))
        : <span className="faint" style={{ fontSize: "var(--text-sm)" }}>No tags yet</span>}
      <span className="spacer"></span>
      <button className="dws-tagadd" data-act="dl-tag" data-ref={dl.deal_id} onClick={() => acts.tags(dl.deal_id)}>
        <Icon name="plus" size="sm" />List
      </button>
    </div>
  );
}

/* Starts at one line and grows with what's typed — a pasted email or a long
   remark should be readable while it's written, not a one-line window onto a
   wall of text. Caps out and scrolls internally past COMPOSER_MAX so a very
   long draft cannot push the send button off the bottom of the pane. */
const COMPOSER_MAX = 160;

// One placeholder per channel — what the box hints depends on how the text
// is about to go out, same three strings the prototype used.
const CHAN_PLACEHOLDER: Record<string, string> = {
  manual: "Log a call, a site visit, or what you told the customer…",
  whatsapp: "Message sent to the customer via WhatsApp…",
  email: "Message sent to the customer via email…",
};
const CHAN_LABEL: Record<string, string> = { manual: "Remark", whatsapp: "WhatsApp", email: "Email" };

function Composer({ dl, p }: { dl: any; p: Params }) {
  const acts = useActs(p);
  const shell = useShell();
  const ta = useRef<HTMLTextAreaElement>(null);
  const [busy, setBusy] = useState(false);
  // Module state (chanOf/setChan), mirrored locally so picking a tab
  // re-renders this composer — the prototype's `var CHAN` had a whole page
  // re-render to lean on; React needs its own trigger.
  const [chan, setChanLocal] = useState(chanOf());

  const grow = () => {
    const el = ta.current; if (!el) return;
    el.style.height = "auto";
    const h = Math.min(el.scrollHeight, COMPOSER_MAX);
    el.style.height = h + "px";
    el.style.overflowY = el.scrollHeight > COMPOSER_MAX ? "auto" : "hidden";
  };
  useEffect(grow, []);

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
      if (ta.current) { ta.current.value = ""; grow(); }
      setChanLocal(chanOf());   // acts.send resets the module state to manual
    });
  };

  return (
    <div className="dws-composer">
      <div className="dws-chans">
        {["manual", "whatsapp", "email"].map((ch) => (
          <button key={ch} type="button"
            className={"dws-chanbtn " + chanCls(ch) + (chan === ch ? " on" : "")}
            data-act="dl-chan" data-chan={ch} onClick={() => pick(ch)}>
            {CHAN_LABEL[ch]}
          </button>
        ))}
      </div>
      <textarea id="dwsComposerText" rows={1} ref={ta}
        placeholder={CHAN_PLACEHOLDER[chan]} onInput={grow} />
      <div className="dws-composer-foot">
        <span className="hint">
          {chan === "manual" ? "Appended to the deal timeline · clears the stalled flag"
            : "Logged to the deal timeline · opens " + CHAN_LABEL[chan] + " to actually send it"}
        </span>
        <button className="dws-send" data-act="dl-send" data-ref={dl.deal_id} disabled={busy} onClick={send}>
          {busy ? "Sending" : "Send"}<Icon name="arrow" size="sm" />
        </button>
      </div>
    </div>
  );
}

/* ========================================================== CONTEXT PANE === */
function CtxPane({ dl, p }: { dl: any; p: Params }) {
  /* One fetch for the whole chain half of this pane — the Quotation block, the
     Invoices block AND the two chain actions all read it, so they cannot
     disagree about what this deal has. */
  const docs = useDealDocs(dl.deal_id);
  const quote: QuotationRow | null = docs.quotations.length ? docs.quotations[0] : null;

  /* Clamped: an overpaid deal is a data question, not a bar that runs past its
     track. Same units on both sides (paise), so the ratio needs no conversion. */
  const collectedPct = dl.deal_value
    ? Math.min(100, Math.round(((dl.revenue_collected || 0) / dl.deal_value) * 100))
    : 0;

  return (
    <aside className="dws-ctx">
      {/* Three cells, and all three are REAL: deal value is the agreed total on
          the record, collected is the sum of the payment ledger, outstanding is
          the first minus the second. The server computes both sums from rows
          (DealsController._with_chain) — nothing here is estimated, and no
          figure is derived twice on two screens. */}
      <div>
        <div className="dws-ctx-h">Money</div>
        <div className="dls-attn dws-money">
          <MoneyCellCtx k="deal value" v={dl.deal_value ? inr(dl.deal_value, { compact: true }) : "—"} />
          <span className="dls-sep"></span>
          <MoneyCellCtx k="collected" v={inr(dl.revenue_collected || 0, { compact: true })} tone="ok" />
          <span className="dls-sep"></span>
          <MoneyCellCtx k="outstanding" v={inr(dl.outstanding || 0, { compact: true })} tone="warn" />
        </div>
        {/* Added under the three figures, not in place of them: full width is
            the deal value, the green run is collected, the amber remainder is
            outstanding — the same numbers as a ratio, which the row above
            makes you work out. No deal value, no denominator, no bar. */}
        {dl.deal_value ? (
          <div className="bar dws-mbar" title={collectedPct + "% collected"}>
            <i className="ok" style={{ width: collectedPct + "%" }}></i>
            <i className="warn" style={{ width: 100 - collectedPct + "%" }}></i>
          </div>
        ) : null}
      </div>

      {/* Who you are talking to, before the deal mechanics — the composer sits
          right below, so the contact details have to be reachable without
          reopening the drawer. */}
      <div>
        <div className="dws-ctx-h">Contact</div>
        <KvList pairs={[
          ["Business", orDash(dl.business_name)],
          ["Email", dl.email ? <a href={"mailto:" + dl.email}>{dl.email}</a> : <span className="faint">—</span>],
          ["Phone", <span className="mono">{dl.phone}</span>],
          ["Location", place(dl)]
        ]} />
      </div>

      <div>
        <div className="dws-ctx-h">Deal facts</div>
        <KvList pairs={([
          ["Owner", <>{dl.owner_id || "—"}{dl.co_owner_id ? <> <span className="faint">+ {dl.co_owner_id}</span></> : null}</>],
          ["Interested in", orDash(dl.interested_in)],
          /* The intake reference. A plain string that points at whatever
             collected the submission — see Deal.enquiryRef — so it is shown and
             never linked: there is nothing on this side to open. */
          ["Enquiry", dl.enquiry_id ? <span className="mono">{dl.enquiry_id}</span> : null],
          ["Created", D.fmtDate(dl.created_at)],
          /* Both rows are ALWAYS present, with a null value where there is no
             figure — KvList renders that as the faint em-dash. Hiding the row
             instead makes the panel change height per deal and quietly loses
             the fact that the field exists and is unset. */
          ["Expected close", dl.expected_close_date ? D.fmtDate(dl.expected_close_date) : null],
          ["Stage age", Math.abs(daysFrom(dl.stage_since)) + " days"],
          /* Off the live quotation, not the deal — a discount is a term of an
             offer, and the deal has no column for one. Absent until there is a
             quotation to read it from. */
          ["Discount", quote ? quote.discountPct + "%" : null]
        ].filter(Boolean)) as [ReactNode, ReactNode][]} />
      </div>

      <div>
        <div className="dws-ctx-h">Quotation</div>
        {quote
          ? <ChainCard to={"#/quotations/" + quote.id} tone="q" icon="quote"
              t1={<>{quote.quotationNumber || "Draft"}{" "}
                <span className="faint" style={{ fontWeight: "var(--weight-normal)" }}>v{quote.version}</span></>}
              t2={(Q_LABEL[quote.status] || cap(quote.status)) + " · " + inr(quote.grandTotalPaise)} />
          : <ChainAdd dl={dl} kind="quotation" docs={docs} />}
      </div>

      <div>
        <div className="dws-ctx-h">Invoices
          <span style={{ fontWeight: "var(--weight-normal)", textTransform: "none", letterSpacing: 0 }}>
            {docs.invoices.length ? docs.invoices.length + " raised" : ""}</span>
        </div>
        {docs.invoices.length
          ? docs.invoices.map((i: InvoiceRow) => (
              <ChainCard key={i.id} to={"#/invoices/" + i.id} icon="invoice"
                tone={i.status === "issued" ? "ok" : i.status === "cancelled" ? "dead" : "warn"}
                t1={i.invoiceNumber || "Draft"}
                t2={(I_LABEL[i.status] || cap(i.status)) + " · " + inr(i.grandTotalPaise) +
                    (i.cancellationReason ? " · " + i.cancellationReason : "")} />
            ))
          : <ChainAdd dl={dl} kind="invoice" docs={docs} />}
      </div>

      <div>
        <div className="dws-ctx-h">Actions</div>
        <div className="dws-actions"><ChatActions dl={dl} p={p} docs={docs} /></div>
      </div>
    </aside>
  );
}

/* One document, as a row you can open. The same card for a quotation and an
   invoice — they are the same kind of thing to the reader (a document this
   deal produced, its state, its amount), and reading them the same way is the
   point of the block. */
function ChainCard({ to, tone, icon, t1, t2 }: {
  to: string; tone: string; icon: string; t1: ReactNode; t2: ReactNode;
}) {
  return (
    <a className="dws-chain-card" data-go={to} onClick={() => go(to)}>
      <div className={"dws-chain-ic " + tone}><Icon name={icon} size="sm" /></div>
      <div className="dws-chain-body">
        <div className="t1">{t1}</div>
        <div className="t2">{t2}</div>
      </div>
    </a>
  );
}

/* THE EMPTY SLOT, AS THE WAY TO FILL IT.

   "None yet." was a sentence that answered a question nobody asked and left you
   to go and find the module that raises one. The dotted card says the same
   thing by being empty AND is the control — one target, no second trip.

   It stays dotted and clickable when the chain is not ready for it, rather than
   vanishing or greying out: a control that disappears takes the sequence with
   it (a quotation becomes an invoice becomes money), and a grey one invites a
   click and answers with nothing. When it cannot act it says what has to happen
   first — chainGate() below, read off the same documents the enabled path
   reads, so the button and the rule cannot disagree. */
function ChainAdd({ dl, kind, docs, as }: {
  dl: any; kind: "quotation" | "invoice"; docs: DealDocsState;
  /** "card" is the dotted empty slot in the Quotation / Invoices block;
   *  "btn" is the same action as a button in Actions. One component for both,
   *  because it is one action with one gate — two copies is how the panel's
   *  two halves end up disagreeing about whether a deal can be invoiced. */
  as?: "card" | "btn";
}) {
  const shell = useShell();
  const pop = usePop();
  const [busy, setBusy] = useState(false);

  if (docs.loading) return <div className="faint" style={{ fontSize: "var(--text-sm)" }}>Loading…</div>;

  const gate = chainGate(dl, kind, docs);
  const label = kind === "quotation" ? "Create quote" : "Raise invoice";
  const card = as !== "btn";
  const icon = card ? "plus" : kind === "quotation" ? "quote" : "invoice";

  if (gate) return (
    <button className={(card ? "dws-chain-add" : "btn") + " gated"} data-act="dl-gate" title={gate.title}
      onClick={(e) => pop(e, <GateBody gate={gate} />, { width: 264, cls: "pop-views" })}>
      <Icon name={icon} /><span>{label}</span>
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
    <button className={card ? "dws-chain-add" : "btn pri"} onClick={create} disabled={busy}>
      <Icon name={icon} /><span>{busy ? "Working…" : label}</span>
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
  /* The same test the server makes, stated before the click rather than as a
     422 after it: nothing left uninvoiced means nothing left to raise. */
  if (dl.deal_value && (dl.revenue_collected || 0) >= dl.deal_value)
    return { title: "Everything is invoiced",
             body: "The accepted value of this deal is fully covered by the invoices already raised. " +
                   "There is nothing left to bill." };
  return null;
}

function GateBody({ gate }: { gate: NonNullable<Gate> }) {
  return (
    <div className="pop-b"><div className="pop-gate">
      <div className="pop-gate-h"><Icon name="alert" /><b>{gate.title}</b></div>
      <p>{gate.body}</p>
    </div></div>
  );
}

/* THE FOUR, IN THAT ORDER, ALWAYS.

   Open quote and Raise invoice sit side by side because that IS the chain: a
   quotation becomes an invoice becomes money. Showing only whichever one is
   legal right now made the panel change shape under you and hid the sequence
   the whole module is built on. Neither is ever disabled — when the chain is
   not ready, the button says what has to happen first (chainGate above).

   Change value, Lists, Change stage and Close deal are NOT here any more, and
   nothing was lost with them: value and Close live in the header's ⋮ menu,
   Lists in the tag strip directly above, and stage on the header's own stage
   chip. A second way to reach one control is a second place it can go stale.

   Add remark is not here either — the composer three inches to the left
   already does that. */
function ChatActions({ dl, p, docs }: { dl: any; p: Params; docs: DealDocsState }) {
  const acts = useActs(p);
  const pop = usePop();
  const quote = docs.quotations.length ? docs.quotations[0] : null;

  return (
    <>
      <div className="dws-pair">
        {/* Open the quotation that exists, or make the first one. Raising an
            invoice is always the same control — ChainAdd owns both the create
            and the refusal, so this pair and the blocks above cannot end up
            telling you different things about the same deal. */}
        {quote
          ? <a className="btn pri" data-go={"#/quotations/" + quote.id}
              onClick={() => go("#/quotations/" + quote.id)}><Icon name="quote" />Open quote</a>
          : <ChainAdd dl={dl} kind="quotation" docs={docs} as="btn" />}
        <ChainAdd dl={dl} kind="invoice" docs={docs} as="btn" />
      </div>
      {/* The record pair: what we hold, and what they sent. Neither is primary
          — both are things you can always do and rarely the thing to do next;
          the chain above is what moves the deal. */}
      <div className="dws-pair">
        <button className="btn" data-act="dl-edit" data-ref={dl.deal_id} onClick={() => acts.edit(dl.deal_id)}>
          <Icon name="doc" />Edit deal</button>
        <button className="btn gated" data-act="dl-gate" title={RESPONSE_GATE.title}
          onClick={(e) => pop(e, <GateBody gate={RESPONSE_GATE} />, { width: 264, cls: "pop-views" })}>
          <Icon name="quote" />View response</button>
      </div>
    </>
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
