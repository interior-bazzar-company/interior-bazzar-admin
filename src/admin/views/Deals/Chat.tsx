/* =============================================================================
   CHAT WORKSPACE — the "Chat" view mode. Replaces the drawer for this one mode
   only; Table and Pipeline keep opening the drawer exactly as before. Same
   filteredScope() as the other two, so the deal picked here is always a deal
   the current filters would also show in Table/Pipeline.
   ============================================================================= */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { EmptyState, Icon, KvList, Pill, SearchField, avatarTone, cap, initials, qs } from "../../ui";
import { go } from "../../ui/nav";
import { can } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { IBQuote } from "../../engines";
import {
  D, E, EMPTY_CHAIN, STAGE, chanOf, head, inr, place, prioTone, setChan, urgency, useDealApi, usePop
} from "./useDeals";
import type { Params } from "./useDeals";
import { ChainDots, MoneyCellCtx, Rich, TagChips, orDash, toneClass } from "./bits";
import { useActs } from "./Modals";
import { ChipMenu, CHIP_LABEL, GateBody, MoreMenu, Odot, PrioMenu, StageMenu, chipOptions } from "./menus";
import AdminLoader from "../../../components/shared/AdminLoader";

export function ChatWorkspace({ id, p, list }: {
  id: string | null; p: Params; list: any[];
}) {
  const shell = useShell();
  const acts = useActs(p);
  const canCreate = can("deals", "create");

  /* ponytail: falls back to the first row of the already-loaded, filter-
     matching API list when no id is in the URL — the same "open something"
     behaviour the old local-engine version had (`list[0] || scope[0]`), just
     sourced from the one shared fetch instead of filteredScope(). */
  const ref = id || (list.length ? list[0].deal_id : null);

  /* The selected deal always resolves through the API, never through
     E.dealOf() — that only knows the 14 locally-seeded demo deals, and a
     deal created later in the DB has no local counterpart. Table/Pipeline's
     Drawer (Drawer.tsx) already resolves this exact way; Chat now matches. */
  const detail = useDealApi(ref);

  useEffect(() => {
    if (!detail.forbidden) return;
    shell.toast("403 out_of_scope — that deal is not yours.", "bad");
    go("#/deals");
  }, [detail.forbidden, shell]);

  if (!ref) return (
    <div className="dws"><div className="dws-panes" style={{ gridTemplateColumns: "1fr" }}>
      <EmptyState icon="deal" title="No deals yet"
        body={"Deals arrive from the funnel and are assigned by round-robin." +
          (canCreate ? " You can also create one for off-funnel business." : " Once one exists, its chat opens here.")}
        action={canCreate
          ? <button className="btn pri" data-act="dl-create" onClick={() => acts.create()}>Create deal</button>
          : null} />
    </div></div>
  );

  if (detail.loading) return <AdminLoader />;
  if (detail.forbidden) return null;   // redirecting via the effect above

  /* The ref genuinely is not in the API's deal set (bad/stale URL, or the
     account never had it) — the panel's own not-found state, never a
     silent fall-back onto an unrelated deal. */
  if (detail.notFound || !detail.deal) return (
    <div className="dws"><div className="dws-panes" style={{ gridTemplateColumns: "1fr" }}>
      <EmptyState icon="deal" title="Deal not found"
        body={"“" + ref + "” is not in the API's deal set."} />
    </div></div>
  );

  const dl = detail.deal;
  /* ponytail: E.Chain.state() is local-engine seed data — no invoice/payment
     models exist server-side yet. Falls back to EMPTY_CHAIN for a ref the
     local engine never seeded (any real API-only deal) — same guard
     Drawer.tsx already uses — so every gated action below reads as
     unavailable rather than crashing on a null read. */
  const c = E.Chain.state(dl.deal_id) || EMPTY_CHAIN;

  /* No full-width header any more: the deal's identity belongs at the top of
     the column that is actually about that deal, and the money belongs with
     the rest of its context on the right. */
  return (
    <div className="dws">
      <div className="dws-panes">
        <ListPane list={list} dl={dl} p={p} />
        <ChatPane dl={dl} ev={detail.timeline} p={p} />
        <CtxPane dl={dl} c={c} p={p} />
      </div>
    </div>
  );
}

/* ============================================================ LIST PANE === */
function ListPane({ list, dl, p }: { list: any[]; dl: any; p: Params }) {
  const acts = useActs(p);
  const pop = usePop();
  const timer = useRef<number | undefined>(undefined);
  const onSearch = (name: string, value: string) => {
    window.clearTimeout(timer.current);
    const to = "#/deals/" + encodeURIComponent(dl.deal_id) + qs({ ...p, [name]: value });
    timer.current = window.setTimeout(() => go(to), 220);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  /* A filter chip. It used to be a transparent native <select> laid over the
     chip, which meant the browser drew the option list using the SELECT's
     colours — and those are the chip's, so an active (mint-on-tint) chip
     produced a mint-on-nothing popup. The chip now opens the app's own menu
     instead: same look as the view switcher, fully themeable. */
  const Chip = ({ name }: { name: string }) => {
    const value = p[name];
    const label = CHIP_LABEL[name] || name;
    const on = value !== undefined && value !== null && value !== "";
    let sel: { v: string | number; l: string; dot?: string } | null = null;
    if (on) chipOptions(name).forEach((o) => { if (String(o.v) === String(value)) sel = o; });
    const chosen = sel as { l: string; dot?: string } | null;
    return (
      <button className={"dws-chip" + (on ? " on" : "")} data-act="dl-chipmenu" data-name={name}
        aria-haspopup="menu" aria-label={label + (on ? ": " + ((chosen && chosen.l) || value) : "")}
        onClick={(e) => pop(e, <ChipMenu name={name} p={p} />,
          { width: 210, cls: "pop-views pop-chip", align: "left" })}>
        {/* the chosen option's colour rides on the chip too, so it survives the
            menu closing — otherwise the dot would only ever be seen
            mid-decision */}
        {on ? <Odot o={chosen} /> : null}
        <span className="lb">{on ? ((chosen && chosen.l) || value) : label}</span>
        <Icon name="chev" size="sm" />
      </button>
    );
  };

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
          <Chip name="stage" />
          <Chip name="tag" />
          <Chip name="priority" />
          {head() ? <Chip name="owner" /> : null}
          <Chip name="sort" />
        </div>
      </div>
      <div className="dws-list-scroll">
        {list.length
          ? list.map((d: any) => <Row key={d.deal_id} d={d} dl={dl} p={p} />)
          : <div className="faint" style={{ fontSize: "var(--text-md)", padding: "16px 10px" }}>
              No deals match these filters.</div>}
      </div>
    </aside>
  );
}

function Row({ d, dl, p }: { d: any; dl: any; p: Params }) {
  const u = urgency(d);
  const over = d.next_action && D.days(D.d(d.next_action.date)) < 0 && d.stage < STAGE.WON;
  // `last_remark_at` is only ever set on the ONE deal fetched in full by
  // useDealApi() (see useDeals.ts) — the API's list endpoint doesn't return
  // it per row, so every other row here falls back to created_at, same as
  // it would for a deal with no remarks yet.
  const when = d.is_stalled ? "Stalled"
    : over ? Math.abs(D.days(D.d(d.next_action.date))) + "d overdue"
    : D.relative(d.last_remark_at || d.created_at);
  const to = "#/deals/" + d.deal_id + qs(p);
  return (
    <a className={"dws-row" + (dl.deal_id === d.deal_id ? " on" : "")} data-go={to} onClick={() => go(to)}>
      <div className="l1">
        <span className={"name" + (u ? " " + u.cls : "")} title={u ? u.why : ""}>{d.customer_name}</span>
        {/* ponytail: outstanding is chain data — undefined (not a real 0) on
            an API-backed row. "₹0" would claim it's fully collected when
            collection was never checked; "—" says the figure isn't tracked
            at all. Same rule BoardCard already applies in List.tsx. */}
        <span className="amt tnum">{d.outstanding === undefined ? "—"
          : d.outstanding ? inr(d.outstanding, { compact: true }) : "₹0"}</span>
      </div>
      <div className="l2">
        <span className={"pill xs" + (D.STAGES[d.stage].tone ? " " + D.STAGES[d.stage].tone : "")}>
          {D.STAGES[d.stage].label}</span>
        <span className={"time" + (u ? " " + u.cls : "")}>{when}</span>
      </div>
      <TagChips dealId={d.deal_id} max={2} tags={d.tags} />
      <div className="l3"><ChainDots dl={d} /></div>
    </a>
  );
}

/* ============================================================ CHAT PANE === */
function dayLabel(iso: string) {
  const n = D.days(D.d(iso));
  if (n === 0) return "Today";
  if (n === -1) return "Yesterday";
  return D.fmtDate(iso);
}
function kindLabel(e: any) {
  if (e.kind === "REMARK") return e.channel === "whatsapp" ? "WhatsApp" : e.channel === "email" ? "Email" : "Remark";
  return cap(String(e.kind).toLowerCase());
}
/* One short name per channel, and every surface that colours itself by channel
   — bubble, avatar, composer button — takes it from here. */
const CHAN_CLS: Record<string, string> = { whatsapp: "wa", email: "em", remark: "rmk" };
function chanCls(channel: string) { return CHAN_CLS[channel] || "rmk"; }
/* Email used to be the bare `out` class and picked up the brand colour by
   default, which is why it and WhatsApp diverged: one was styled, the other
   was whatever `out` happened to be. Both are named now. */
function rowCls(e: any) {
  if (e.kind !== "REMARK") return "log";
  if (e.channel === "whatsapp") return "out wa";
  if (e.channel === "email") return "out em";
  return "log";
}

/* `apiEv` is the API's transitions+remarks, already shaped by adaptTimeline()
   (useDeals.ts's useDealApi) — real STAGE/REMARK/SYSTEM events, sorted newest
   first same as E.Activity.timeline() was. NOT equivalent on one axis: the
   API's remark model carries no channel (whatsapp/email/remark) — DealRemark
   has no such field (confirmed against a live GET .../deals/<ref>/) — so
   every remark here renders with the generic "Remark" label and "log" bubble
   style; the old local engine's whatsapp/email-coloured bubbles were entirely
   local-only pretend data, and there is nothing server-side to recover them
   from. Quote/invoice/payment lines the local engine's own timeline also
   produced are absent too, for the same reason Drawer.tsx's TimelineTab omits
   them: those chains are still local-only. */
function ChatPane({ dl, ev: apiEv, p }: {
  dl: any; ev: { kind: string; tone: string; at: string; by: string; text: string }[]; p: Params;
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

/* Who the deal belongs to, as faces rather than a line of text.

   The owner leads and any co-owner overlaps behind — the stack IS the answer
   to "is this shared", readable before a single word is. A pending request
   sits third with a dashed ring, because a co-assignment that has been asked
   for and not answered is a different fact from one that was granted.

   The whole stack is the button that opens Co-assign, so the way to change who
   is on a deal is to press the people already on it. */
function People({ dl, p }: { dl: any; p: Params }) {
  const acts = useActs(p);
  const pend = E.coAssignmentsFor(dl.deal_id).filter((x: any) => x.status === "pending")[0];
  const split = dl.split_ratio ? String(dl.split_ratio).replace(/\s/g, "") : null;

  const face = (name: string, cls: string, tip: string) => (
    <span key={name + cls} className={"av sm " + avatarTone(name) + (cls ? " " + cls : "")} title={tip}>
      {initials(name)}
    </span>
  );
  const faces = [face(dl.owner_id, "", "Owner · " + dl.owner_id + (split ? " · " + split.split(/[/:]/)[0] + "%" : ""))];
  if (dl.co_owner_id) faces.push(face(dl.co_owner_id, "",
    "Co-owner · " + dl.co_owner_id + (split ? " · " + split.split(/[/:]/)[1] + "%" : "")));
  if (pend) faces.push(face(pend.co_owner, "pending", "Requested · " + pend.co_owner + " · awaiting a decision"));

  const tip = dl.co_owner_id
    ? dl.owner_id + " with " + dl.co_owner_id + (split ? " · split " + split : "") + " — click to change"
    : "Owned by " + dl.owner_id + (pend ? " · " + pend.co_owner + " requested" : "") + " — click to co-assign";

  return (
    <button className="dws-people" data-act="dl-coassign" data-ref={dl.deal_id} title={tip} aria-label={tip}
      onClick={() => acts.coassign(dl.deal_id)}>
      {faces}
      {dl.co_owner_id || pend ? null
        : <span className="av sm dws-people-add"><Icon name="plus" size="sm" /></span>}
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
        <span className="pill brand">{dl.interested_in}</span>
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
          else acts.stageRemark(dl.deal_id, to);
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
   ponytail: reads E.Tags.forDeal() — local engine — deliberately, unlike the
   read-only TagChips elsewhere (Row above, List.tsx) which now prefer the
   API's own `dl.tags`. There is no tag-write endpoint (AdminOpsService has no
   apply/unapply/create/rename/delete for lists), so × here and the List
   editor both still mutate the local engine only; reading that same store
   back is what makes the removal show up immediately without a refetch. */
function TagRow({ dl, p }: { dl: any; p: Params }) {
  const acts = useActs(p);
  const tags = E.Tags.forDeal(dl.deal_id);
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
const CHAN_PH: Record<string, string> = {
  remark: "Log a call, a site visit, or what you told the customer…",
  whatsapp: "Message sent to the customer via WhatsApp…",
  email: "Message sent to the customer via email…"
};

function Composer({ dl, p }: { dl: any; p: Params }) {
  const acts = useActs(p);
  const shell = useShell();
  const ta = useRef<HTMLTextAreaElement>(null);
  const [chan, setLocalChan] = useState(chanOf());

  const grow = () => {
    const el = ta.current; if (!el) return;
    el.style.height = "auto";
    const h = Math.min(el.scrollHeight, COMPOSER_MAX);
    el.style.height = h + "px";
    el.style.overflowY = el.scrollHeight > COMPOSER_MAX ? "auto" : "hidden";
  };
  useEffect(grow, []);

  const send = () => {
    const text = ta.current ? ta.current.value.trim() : "";
    if (!text) return shell.toast("Write something before sending.", "bad");
    if (!acts.send(dl.deal_id, text, chan)) return;
    if (ta.current) { ta.current.value = ""; grow(); }
    setChan("remark");            // reset after every successful send
    setLocalChan("remark");
  };

  return (
    <div className="dws-composer">
      <div className="dws-chans">
        {["remark", "whatsapp", "email"].map((ch) => (
          /* The channel class rides along even when the button is off, so the
             one `on` rule can colour it without a second lookup. */
          <button key={ch} className={"dws-chanbtn " + chanCls(ch) + (chan === ch ? " on" : "")}
            data-act="dl-chan" data-chan={ch}
            onClick={() => {
              // No re-render of the deal here, or an in-progress draft in the
              // textarea would be wiped just for switching the channel.
              setChan(ch); setLocalChan(ch);
            }}>
            {ch === "remark" ? "Remark" : ch === "whatsapp" ? "WhatsApp" : "Email"}
          </button>
        ))}
      </div>
      <textarea id="dwsComposerText" rows={1} ref={ta} placeholder={CHAN_PH[chan]} onInput={grow} />
      <div className="dws-composer-foot">
        <span className="hint">Logged to the deal timeline</span>
        <button className="dws-send" data-act="dl-send" data-ref={dl.deal_id} onClick={send}>
          Send<Icon name="arrow" size="sm" />
        </button>
      </div>
    </div>
  );
}

/* ========================================================== CONTEXT PANE === */
function CtxPane({ dl, c, p }: { dl: any; c: any; p: Params }) {
  const Q = IBQuote || { LABEL: {}, TONE: {} };
  const quotes = E.quotesFor(dl.deal_id).sort((a: any, b: any) => b.version - a.version);
  const invs = E.invoicesFor(dl.deal_id);
  /* ponytail: collected/outstanding are chain data — no invoice/payment
     models exist server-side yet, so adaptDeal() never sets them on `dl` (the
     API deal). Read off the local engine's OWN copy of this ref instead —
     same fallback Drawer.tsx already uses for its Collected/Outstanding
     figures — and leave it undefined (renders "—", never a fabricated ₹0)
     for a ref the local engine never seeded. */
  const localDl = E.dealOf(dl.deal_id);
  const collected = localDl ? localDl.revenue_collected : undefined;
  const outstanding = localDl ? localDl.outstanding : undefined;
  return (
    <aside className="dws-ctx">
      {/* The money came out of the old full-width header. It reads as context,
          not identity, so it sits with the rest of the facts. Built from the
          same cells as the list page's strip, so one deal's money and the whole
          scope's money are read the same way in both views. */}
      <div>
        <div className="dws-ctx-h">Money</div>
        <div className="dls-attn dws-money">
          <MoneyCellCtx k="deal value" v={dl.deal_value ? inr(dl.deal_value, { compact: true }) : "—"} />
          <span className="dls-sep"></span>
          <MoneyCellCtx k="collected" v={inr(collected, { compact: true })} tone="ok" />
          <span className="dls-sep"></span>
          <MoneyCellCtx k="outstanding" v={inr(outstanding, { compact: true })} tone="warn" />
        </div>
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
          ["Interested in", dl.interested_in],
          ["Enquiry", <span className="mono">{dl.enquiry_id}</span>],
          ["Created", D.fmtDate(dl.created_at)],
          /* Both rows are ALWAYS present, with a null value where there is no
             figure — KvList renders that as the faint em-dash. The prototype's
             `.filter(Boolean)` runs over the rows, not the values, so an empty
             expected-close still occupies its line. Hiding the row instead
             makes the panel change height per deal and quietly loses the fact
             that the field exists and is unset. */
          ["Expected close", dl.expected_close_date ? D.fmtDate(dl.expected_close_date) : null],
          ["Discount", dl.discount_pct === null || dl.discount_pct === undefined ? null : dl.discount_pct + "%"]
        ].filter(Boolean)) as [ReactNode, ReactNode][]} />
      </div>

      {quotes.length
        ? <div>
            <div className="dws-ctx-h">Quotation</div>
            {(() => {
              const q = quotes[0];
              const to = "#/quotations/" + (q.quotation_number || q.quotation_id);
              return (
                <a className="dws-chain-card" data-go={to} onClick={() => go(to)}>
                  <div className="dws-chain-ic q"><Icon name="quote" /></div>
                  <div className="dws-chain-body">
                    <div className="t1">{q.quotation_number || "Draft"}{" "}
                      <span className="faint" style={{ fontWeight: "var(--weight-normal)" }}>v{q.version}</span></div>
                    <div className="t2">{Q.LABEL[q.status] || cap(q.status)} · {inr(q.grand_total_paise)}</div>
                  </div>
                </a>
              );
            })()}
          </div>
        : null}

      <div>
        <div className="dws-ctx-h">Invoices
          <span style={{ fontWeight: "var(--weight-normal)", textTransform: "none", letterSpacing: 0 }}>
            {invs.length ? invs.length + " raised" : ""}</span>
        </div>
        {invs.length
          ? invs.map((i: any) => {
              const icCls = i.status === "paid" ? "ok" : i.status === "cancelled" ? "dead" : "warn";
              const to = "#/invoices/" + (i.number || i.invoice_id);
              return (
                <a key={i.invoice_id} className="dws-chain-card" data-go={to} onClick={() => go(to)}>
                  <div className={"dws-chain-ic " + icCls}><Icon name="invoice" /></div>
                  <div className="dws-chain-body">
                    <div className="t1">{i.number || "Draft"}</div>
                    <div className="t2">{cap(i.status)} · {inr(i.amount_paise)}
                      {i.cancelled_reason ? " · " + i.cancelled_reason : ""}</div>
                  </div>
                </a>
              );
            })
          : <div className="faint" style={{ fontSize: "var(--text-sm)" }}>None yet.</div>}
      </div>

      <div>
        <div className="dws-ctx-h">Actions</div>
        <div className="dws-actions"><ChatActions dl={dl} c={c} p={p} /></div>
      </div>
    </aside>
  );
}

/* The context panel keeps only what money needs. Add remark is gone: the
   composer three inches to the left already does that.

   The two chain actions sit side by side, always, in that order — because that
   IS the chain: a quotation becomes an invoice becomes money. Showing only
   whichever one happens to be legal right now made the panel change shape under
   you and hid the sequence the whole module is built on.

   Neither is ever disabled. A greyed control invites a click and answers it
   with nothing; these stay live and, when the chain is not ready for them, say
   what has to happen first. That is the gate button below, and the reason it
   can exist at all is that the engine already computes the gate. */
function ChatActions({ dl, c, p }: { dl: any; c: any; p: Params }) {
  const acts = useActs(p);
  const pop = usePop();
  const q = c.quote, qref = q ? (q.quotation_number || q.quotation_id) : "";

  const GateBtn = ({ label, ico, title, body }: { label: string; ico: string; title: string; body: ReactNode }) => (
    <button className="btn gated" data-act="dl-gate" data-ref={dl.deal_id} data-title={title} title={title}
      onClick={(e) => pop(e, <GateBody title={title} body={body} />, { width: 264, cls: "pop-views" })}>
      <Icon name={ico} />{label}
    </button>
  );

  /* Quote: open the one that exists, or create the first. Creating is refused
     on a closed deal — QT-OD-11, and Module 2 owns that rule — so the button is
     gated here rather than firing a red toast a click later. */
  const quote = c.quoteStatus !== "none"
    ? <a className="btn pri" data-go={"#/quotations/" + qref} onClick={() => go("#/quotations/" + qref)}>
        <Icon name="quote" />Open quote</a>
    : dl.stage >= STAGE.WON
      ? <GateBtn label="Create quote" ico="quote"
          title={"This deal is " + D.STAGES[dl.stage].label}
          body="A quotation is an offer, and a closed deal is not open to one. Reopen the deal first and the draft can be raised against it (QT-OD-11)." />
      : <button className="btn pri" data-act="qt-from-deal" data-ref={dl.deal_id}
          onClick={() => acts.createQuote(dl.deal_id)}><Icon name="plus" />Create quote</button>;

  /* Invoice: legal only once a quotation is accepted and something is left to
     bill. INVOICE_CHAIN_CONTRACT §3 — Module 3 owns the builder, so this links
     into it rather than re-implementing a raise here. */
  const invHash = "#/invoices?new=1&deal=" + dl.deal_id;
  const gate = invoiceGate(c);
  const invoice = c.canRaiseInvoice
    ? <a className="btn pri" data-go={invHash} onClick={() => go(invHash)}><Icon name="invoice" />Raise invoice</a>
    : <GateBtn label="Raise invoice" ico="invoice" title={gate.title} body={gate.body} />;

  const enq = E.enquiryOf(dl.deal_id);

  return (
    <>
      <div className="dws-pair">{quote}{invoice}</div>
      {c.canLogPayment
        ? <button className="btn pri" data-act="dl-pay" data-ref={dl.deal_id} onClick={() => acts.pay(dl.deal_id)}>
            <Icon name="cash" />Log payment</button>
        : null}
      {/* The record pair: what we hold, and what they sent. Neither is primary —
          both are things you can always do and rarely the thing to do next.
          View response is gated the same way Raise invoice is: a deal keyed in
          by hand has no form, and a button that opens an empty dialog is worse
          than one that says so before you click. */}
      <div className="dws-pair">
        <button className="btn" data-act="dl-edit" data-ref={dl.deal_id} onClick={() => acts.edit(dl.deal_id)}>
          <Icon name="doc" />Edit deal</button>
        {enq && enq.response
          ? <button className="btn" data-act="dl-response" data-ref={dl.deal_id}
              onClick={() => acts.response(dl.deal_id)}><Icon name="quote" />View response</button>
          : <GateBtn label="View response" ico="quote" title="No funnel response"
              body={"This deal was keyed in by hand" + (enq && enq.source ? " (" + enq.source + ")" : "") +
                ", not through the funnel, so there is no submitted form to show."} />}
      </div>
    </>
  );
}

/* Why an invoice cannot be raised yet, in the words of the rule that stops it.
   Read straight off the same `Chain.state` the enabled path reads, so the
   button and the guard can never disagree about whether it is open. */
function invoiceGate(c: any): { title: string; body: ReactNode } {
  if (c.quoteStatus === "none")
    return { title: "There is no quotation yet",
      body: "An invoice bills an accepted quotation — it never invents its own amount. Create the quote first, issue it, and raise the invoice once the customer accepts." };
  if (c.quoteStatus !== "accepted")
    return { title: "The quotation is not accepted yet",
      body: "This deal's quotation is " + c.quoteStatus + ". Until the customer accepts it there is no agreed amount to bill, so Module 3 refuses the raise." };
  if (!c.uninvoiced)
    return { title: "Everything is invoiced",
      body: "The accepted value of this deal is fully covered by invoices already raised. There is nothing left to bill." };
  return { title: "Not available yet", body: "The chain is not ready for an invoice on this deal." };
}
