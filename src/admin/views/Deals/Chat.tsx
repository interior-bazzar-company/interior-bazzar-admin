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
  D, STAGE, chanOf, daysFrom, head, inr, place, prioTone, relativeDate, setChan, urgency,
  useDealApi, usePop
} from "./useDeals";
import type { DealsApiState, Params } from "./useDeals";
import { MoneyCellCtx, Rich, TagChips, orDash, toneClass } from "./bits";
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

/* ============================================================ LIST PANE === */
function ListPane({ list, activeRef, p, api }: { list: any[]; activeRef: string; p: Params; api: DealsApiState }) {
  const acts = useActs(p);
  const pop = usePop();
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
  return (
    <aside className="dws-ctx">
      {/* ONE money cell, because one figure is stored. Collected and
          outstanding were sums over a payment store that has no table behind
          it — three cells where only the first was ever real. */}
      <div>
        <div className="dws-ctx-h">Money</div>
        <div className="dls-attn dws-money">
          <MoneyCellCtx k="deal value" v={dl.deal_value ? inr(dl.deal_value, { compact: true }) : "not quoted"} />
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
          ["Interested in", orDash(dl.interested_in)],
          ["Created", D.fmtDate(dl.created_at)],
          /* Both rows are ALWAYS present, with a null value where there is no
             figure — KvList renders that as the faint em-dash. Hiding the row
             instead makes the panel change height per deal and quietly loses
             the fact that the field exists and is unset. */
          ["Expected close", dl.expected_close_date ? D.fmtDate(dl.expected_close_date) : null],
          ["Stage age", Math.abs(daysFrom(dl.stage_since)) + " days"]
        ].filter(Boolean)) as [ReactNode, ReactNode][]} />
      </div>

      <div>
        <div className="dws-ctx-h">Actions</div>
        <div className="dws-actions"><ChatActions dl={dl} p={p} /></div>
      </div>
    </aside>
  );
}

/* What the panel keeps is what the server has an endpoint for. Add remark is
   not here — the composer three inches to the left already does that.

   Create quote, Raise invoice, Log payment and View response have all gone
   with the stores behind them: there is no quotation, invoice, payment or
   enquiry model, so every one of those was a button that either did nothing or
   wrote a record only this browser could see. A gate button explaining why a
   feature is unavailable is still a feature you are advertising. */
function ChatActions({ dl, p }: { dl: any; p: Params }) {
  const acts = useActs(p);
  return (
    <>
      <div className="dws-pair">
        <button className="btn pri" data-act="dl-edit" data-ref={dl.deal_id} onClick={() => acts.edit(dl.deal_id)}>
          <Icon name="doc" />Edit deal</button>
        <button className="btn" data-act="dl-value" data-ref={dl.deal_id} onClick={() => acts.value(dl.deal_id)}>
          <Icon name="tag" />{dl.deal_value ? "Change value" : "Set value"}</button>
      </div>
      <div className="dws-pair">
        <button className="btn" data-act="dl-tag" data-ref={dl.deal_id} onClick={() => acts.tags(dl.deal_id)}>
          <Icon name="tag" />Lists</button>
        <button className="btn" data-act="dl-stage" data-ref={dl.deal_id}
          onClick={() => acts.stage(dl.deal_id, dl.stage)}><Icon name="recon" />Change stage</button>
      </div>
      {head()
        ? <button className="btn dgr" data-act="dl-close" data-ref={dl.deal_id}
            onClick={() => acts.closeDeal(dl.deal_id)}><Icon name="x" />Close deal</button>
        : null}
    </>
  );
}
