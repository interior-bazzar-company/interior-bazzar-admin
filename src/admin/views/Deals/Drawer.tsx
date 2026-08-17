/* =============================================================================
   Deals — THE DRAWER. Table and Pipeline open a deal here; Chat replaces it
   with its own three-pane workspace.
   -----------------------------------------------------------------------------
   Everything on this screen is the deal detail endpoint's response: the facts,
   the stage history, the remarks. The Payments and Documents tabs, the chain
   strip, the collected/outstanding bar and the invoice chips are gone — every
   one of them rendered the browser-side engine's seed store, which held rows
   for fourteen demo deals and nothing for a real one. There are no payment,
   invoice or quotation models server-side; when there are, they come back
   reading from them.
   ============================================================================= */
import { useEffect } from "react";
import type { ReactNode } from "react";
import { Icon, KvList, Notice, PaneLoading, Pill, SectionHead } from "../../ui";
import { go } from "../../ui/nav";
import { useShell } from "../../shell/ShellContext";
import {
  D, STAGE, daysFrom, head, inr, listHash, place, prioTone, relativeDate, useDealApi,
  useEngineTick, usePop, val
} from "./useDeals";
import type { Params } from "./useDeals";
import { Fig, Rich, TagChips, orDash } from "./bits";
import { useActs } from "./Modals";
import { PrioMenu } from "./menus";

export function DealDrawer({ dealRef, p }: { dealRef: string; p: Params }) {
  useEngineTick();
  const shell = useShell();
  const acts = useActs(p);
  const pop = usePop();
  const api = useDealApi(dealRef);

  /* Scoping is server-enforced (a 403 IS "out of scope") rather than
     re-checked client-side against a store that knows only its own seed. */
  useEffect(() => {
    if (api.loading) return;
    if (api.notFound) {
      shell.toast("Deal " + dealRef + " not found.", "bad");
      shell.closeLayer(); go("#/deals"); return;
    }
    if (api.forbidden) {
      shell.toast("403 — that deal is not yours.", "bad");
      shell.closeLayer(); go("#/deals");
    }
  }, [api.loading, api.notFound, api.forbidden, dealRef, shell]);

  /* Only when there is nothing to show. A REFRESH — every write re-fetches
     this deal — keeps what is on screen and swaps it when the response lands,
     so adding a remark does not blank the drawer you are reading. `stale`
     covers the other half: if the ref changed, the deal in hand belongs to a
     different record and must not be rendered under the new one's name. */
  if (api.forbidden || api.notFound) return null;
  if (!api.deal || api.stale) return <PaneLoading label={"Opening " + dealRef + "…"} />;
  const dl = api.deal;

  const over = dl.next_action && daysFrom(dl.next_action.date) < 0 && dl.stage < STAGE.WON;
  const back = listHash(p);

  return (
    <>
      <div className="dw-h">
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <h2 style={{ fontSize: "var(--text-2xl)", fontWeight: 600 }}>{dl.customer_name}</h2>
              {dl.business_name ? <span className="faint">{dl.business_name}</span> : null}
              <Pill text={D.STAGES[dl.stage].label} tone={D.STAGES[dl.stage].tone} />
              {/* PRIORITY, EDITABLE, IN THE TOP SECTION — the same control Chat
                  has, not a second implementation of it: same menu, same call,
                  same three values, same tones. */}
              <button className={"dws-priobtn " + prioTone(dl.priority)} data-act="dl-priomenu"
                data-ref={dl.deal_id} aria-haspopup="menu"
                title="Priority · visual triage only, it never changes who the deal goes to"
                onClick={(e) => pop(e, <PrioMenu dl={dl} onPick={(v) => acts.priority(dl.deal_id, v)} />,
                  { width: 250, cls: "pop-views" })}>
                <span className={"dws-odot " + prioTone(dl.priority)}></span>
                {D.PRIORITY[dl.priority]}<Icon name="chev" size="sm" />
              </button>
              {dl.is_stalled ? <Pill text="Stalled" tone="warn" /> : null}
            </div>
            <div className="mono" style={{ fontSize: "var(--text-md)", color: "var(--text-2)", marginTop: "5px" }}>
              {dl.deal_id} · {dl.phone}{dl.email ? " · " + dl.email : ""} · {place(dl)}
              {dl.enquiry_id ? " · " + dl.enquiry_id : ""}
            </div>
          </div>
          <span className="spacer"></span>
          <button className="btn icon sm" data-go={back} aria-label="Close"
            onClick={() => { shell.closeLayer(); go(back); }}><Icon name="x" /></button>
        </div>
      </div>

      <div className="dw-b">
        {/* ONE figure, because one is what is stored. Collected, outstanding
            and the % bar came from the local payment store and would be a
            claim about money nobody recorded. */}
        <div style={{ display: "flex", gap: "28px", flexWrap: "wrap", marginBottom: "12px" }}>
          <Fig k="Deal value" v={dl.deal_value ? inr(dl.deal_value) : "not quoted yet"} />
          <Fig k="Stage age" v={Math.abs(daysFrom(dl.stage_since)) + " days"} />
        </div>

        {dl.next_action
          ? <div className={"notice " + (over ? "bad" : "")} style={{ marginTop: "16px" }}>
              <Icon name={over ? "alert" : "clock"} />
              <div><b>Next action {relativeDate(dl.next_action.date)}{over ? " — overdue" : ""}</b>
                <div style={{ marginTop: "2px" }}>{dl.next_action.note}</div></div>
              <span className="spacer"></span>
              <button className="btn sm" data-act="dl-clear-next" data-ref={dealRef}
                title="Clear it — a fresh remark with a date sets a new one"
                onClick={() => acts.clearNext(dealRef)}>Clear</button>
            </div>
          : null}

        <SectionHead title="Deal facts" />
        <KvList cls="wide" pairs={([
          ["Owner", <>{dl.owner_id || "—"}{dl.co_owner_id
            ? <> <span className="faint">+ {dl.co_owner_id}</span></> : null}</>],
          ["Business", orDash(dl.business_name)],
          ["Email", dl.email ? <a href={"mailto:" + dl.email}>{dl.email}</a> : <span className="faint">—</span>],
          ["Location", place(dl)],
          ["Interested in", orDash(dl.interested_in)],
          dl.enquiry_id ? ["Enquiry", <span className="mono">{dl.enquiry_id}</span>] : null,
          ["Created", D.fmtDate(dl.created_at)],
          /* Always present, null value where there is no figure — KvList draws
             the faint em-dash rather than dropping the line. */
          ["Expected close", dl.expected_close_date ? D.fmtDate(dl.expected_close_date) : null],
          ["Lists", dl.tags && dl.tags.length ? <TagChips tags={dl.tags} /> : null],
          ["Last remark", <>{dl.last_remark_at ? D.fmtDate(dl.last_remark_at) : <span className="faint">none</span>}
            {dl.is_stalled ? <> <Pill text="stalled" tone="warn" /></> : null}</>],
          dl.close_reason ? ["Close reason", dl.close_reason] : null
        ].filter(Boolean)) as [ReactNode, ReactNode][]} />

        <SectionHead title="Timeline" desc="Stage moves and remarks, newest first" />
        <TimelineTab dl={dl} ev={api.timeline} p={p} />
      </div>

      <div className="dw-f"><ActionBar dl={dl} p={p} /></div>
    </>
  );
}

/* Locked actions are ABSENT, not greyed. What survives here is what the server
   has an endpoint for; Close is separated from Change stage because it is the
   one move that needs the level-3 permission and a reason people re-read a
   year later. */
function ActionBar({ dl, p }: { dl: any; p: Params }) {
  const acts = useActs(p);
  const ref = dl.deal_id;
  const out: ReactNode[] = [];
  const btn = (key: string, act: string, label: string, onClick: () => void, cls?: string, ico?: string) => (
    <button key={key} className={"btn " + (cls || "")} data-act={act} data-ref={ref} onClick={onClick}>
      {ico ? <Icon name={ico} /> : null}{label}
    </button>
  );

  out.push(btn("remark", "dl-remark", "Add remark", () => acts.remark(ref)));
  out.push(btn("stage", "dl-stage", "Change stage", () => acts.stage(ref, dl.stage)));
  out.push(btn("value", "dl-value", dl.deal_value ? "Change value" : "Set deal value", () => acts.value(ref)));
  out.push(btn("edit", "dl-edit", "Edit deal", () => acts.edit(ref)));
  out.push(btn("tags", "dl-tag", "Lists", () => acts.tags(ref)));
  if (head()) out.push(btn("re", "dl-reassign", "Reassign", () => acts.reassign(ref)));
  out.push(<span key="sp" className="spacer"></span>);
  if (head()) out.push(btn("close", "dl-close", "Close deal", () => acts.closeDeal(ref), "dgr"));
  return <>{out}</>;
}

/* `ev` is the API's own transitions + remarks, adapted in adapter.ts. It is
   the whole history there is: the engine's quote/invoice/payment lines are
   gone with the stores that invented them. */
function TimelineTab({ dl, ev, p }: { dl: any; ev: { kind: string; tone: string; at: string; by: string; text: string }[]; p: Params }) {
  const acts = useActs(p);
  const add = () => {
    const text = val("dlQuickRemark");
    if (!text) return;
    acts.quick(dl.deal_id);
    const el = document.getElementById("dlQuickRemark") as HTMLInputElement | null;
    if (el) el.value = "";
  };
  return (
    <>
      <div className="card" style={{ marginBottom: "14px" }}>
        <div className="card-b tight" style={{ padding: "10px 12px" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input className="inp" id="dlQuickRemark" placeholder="Log a call, a message, a site visit…"
              style={{ flex: 1 }} />
            <button className="btn pri" data-act="dl-quick" data-ref={dl.deal_id} onClick={add}>Add</button>
          </div>
          <div className="help">Three clicks and one text field — the most repeated action in the module.
            Adding a remark also clears the stalled flag.</div>
        </div>
      </div>
      <div className="tl">
        {ev.map((e: any, i: number) => (
          <div className={"ti " + (e.tone || "")} key={i}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span className="pill xs">{e.kind}</span>
              <span className="faint" style={{ fontSize: "var(--text-sm)", marginLeft: "auto" }}>{D.fmtDate(e.at)}</span>
            </div>
            <div style={{ fontSize: "var(--text-base)", lineHeight: 1.45, marginTop: "5px" }}>
              {e.kind === "REMARK" || e.kind === "SYSTEM" ? e.text : <Rich text={e.text} />}
            </div>
            <div className="faint" style={{ fontSize: "var(--text-sm)", marginTop: "2px" }}>{e.by}</div>
          </div>
        ))}
      </div>
      <Notice ico="lock" text={<>
        Nothing in this timeline is editable or deletable. <b>There is no PUT and no DELETE endpoint</b>{" "}
        for a remark or a transition — immutability is enforced by the absence of the API, not by a
        permission check.
      </>} />
    </>
  );
}
