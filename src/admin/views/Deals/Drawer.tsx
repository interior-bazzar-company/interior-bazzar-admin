/* =============================================================================
   Deals — THE DRAWER. Table and Pipeline open a deal here; Chat replaces it
   with its own three-pane workspace.
   -----------------------------------------------------------------------------
   Everything on this screen is the deal detail endpoint's response: the facts,
   the stage history, the remarks. It reads top to bottom the way a record
   should — who this is, where it is in the funnel, what it is worth, what is
   owed of it next, then the facts, then everything that has happened to it.

   The Payments and Documents tabs and the invoice chips are gone: every one of
   them rendered the browser-side engine's seed store, which held rows for
   fourteen demo deals and nothing for a real one. They come back reading from
   the models when the models exist.
   ============================================================================= */
import { useEffect } from "react";
import type { ReactNode } from "react";
import {
  Alert, Avatar, Button, DrawerShell, Eyebrow, Input, KvList, MoreMenu, Notice, PaneLoading,
  Pill, SectionHead, Timeline
} from "../../ui";
import { go } from "../../ui/nav";
import { useShell } from "../../shell/ShellContext";
import {
  D, STAGE, daysFrom, head, inr, listHash, place, relativeDate, useDealApi,
  useEngineTick, val
} from "./useDeals";
import type { Params } from "./useDeals";
import { Fig, Rich, StagePipeline, TagChips, orDash } from "./bits";
import { useActs } from "./Modals";
import { PrioMenu, StageMenu } from "./menus";

export function DealDrawer({ dealRef, p }: { dealRef: string; p: Params }) {
  useEngineTick();
  const shell = useShell();
  const acts = useActs(p);
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

  const back = listHash(p);
  const close = () => { shell.closeLayer(); go(back); };

  /* Only when there is nothing to show. A REFRESH — every write re-fetches
     this deal — keeps what is on screen and swaps it when the response lands,
     so adding a remark does not blank the drawer you are reading. `stale`
     covers the other half: if the ref changed, the deal in hand belongs to a
     different record and must not be rendered under the new one's name. */
  if (api.forbidden || api.notFound) return null;
  if (!api.deal || api.stale) {
    return (
      <DrawerShell title="Deal" sub={dealRef} onClose={close}>
        <PaneLoading label={"Opening " + dealRef + "…"} />
      </DrawerShell>
    );
  }
  const dl = api.deal;
  const over = dl.next_action && daysFrom(dl.next_action.date) < 0 && dl.stage < STAGE.WON;

  return (
    <DrawerShell
      mark={<Avatar name={dl.customer_name} lg />}
      title={dl.customer_name}
      sub={<span className="font-mono tnum">{dl.deal_id}{dl.business_name ? <span className="font-sans"> · {dl.business_name}</span> : null}</span>}
      onClose={close}
      actions={<ActionBar dl={dl} p={p} />}
    >
      <div className="flex flex-col gap-6">
        {/* WHERE IT IS, AND WHO IS CHASING IT. The same two controls the chat
            header carries — the same components, so the drawer and the
            workspace can never offer different stages or different tones. */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <StageMenu dl={dl} size="xs" onPick={(to) => {
              if (to === STAGE.LOST || to === STAGE.WON) acts.closeDeal(dl.deal_id);
              else acts.stageRemark(dl.deal_id, to, dl.stage);
            }} />
            <PrioMenu dl={dl} size="xs" onPick={(v) => acts.priority(dl.deal_id, v)} />
            {dl.is_stalled ? <Pill dot tone="warn" text="Stalled" /> : null}
            {dl.interested_in ? <Pill tone="brand" text={dl.interested_in} /> : null}
          </div>
          <StagePipeline stage={dl.stage} closeReason={dl.close_reason} />
        </section>

        {/* The same three money figures the chat pane's context column shows,
            from the same server-computed fields — a deal must not read as
            settled here and owing there. All three are sums of real rows. */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Fig k="Deal value" v={dl.deal_value ? inr(dl.deal_value) : "not quoted"} />
          <Fig k="Collected" v={inr(dl.revenue_collected || 0)} />
          <Fig k="Outstanding" v={inr(dl.outstanding || 0)} />
          <Fig k="Stage age" v={Math.abs(daysFrom(dl.stage_since)) + "d"} />
        </section>

        {dl.next_action
          ? <Alert tone={over ? "bad" : "info"} ico={over ? "alert" : "clock"}
              title={"Next action " + relativeDate(dl.next_action.date) + (over ? " — overdue" : "")}
              action={
                <Button color="secondary" size="xs" data-act="dl-clear-next" data-ref={dealRef}
                  onClick={() => acts.clearNext(dealRef)}>Clear</Button>
              }>
              {dl.next_action.note}
            </Alert>
          : null}

        <section>
          <SectionHead title="Deal facts" />
          <KvList pairs={([
            ["Owner", <>{dl.owner_id || "—"}{dl.co_owner_id
              ? <span className="text-tertiary"> + {dl.co_owner_id}</span> : null}</>],
            ["Business", orDash(dl.business_name)],
            ["Phone", <span className="font-mono tnum">{dl.phone}</span>],
            ["Email", dl.email
              ? <a className="rounded text-brand-secondary outline-focus-ring hover:underline focus-visible:outline-2" href={"mailto:" + dl.email}>{dl.email}</a>
              : null],
            ["Location", place(dl)],
            ["Interested in", orDash(dl.interested_in)],
            dl.enquiry_id ? ["Enquiry", <span className="font-mono tnum">{dl.enquiry_id}</span>] : null,
            ["Created", D.fmtDate(dl.created_at)],
            /* Always present, null value where there is no figure — KvList
               draws the faint em-dash rather than dropping the line. */
            ["Expected close", dl.expected_close_date ? D.fmtDate(dl.expected_close_date) : null],
            ["Lists", dl.tags && dl.tags.length ? <TagChips tags={dl.tags} /> : null],
            ["Last remark", <>{dl.last_remark_at ? D.fmtDate(dl.last_remark_at) : <span className="text-quaternary">none</span>}
              {dl.is_stalled ? <> <Pill xs tone="warn" text="stalled" /></> : null}</>],
            dl.close_reason ? ["Close reason", dl.close_reason] : null,
          ].filter(Boolean)) as [ReactNode, ReactNode][]} />
        </section>

        <section>
          <SectionHead title="Timeline" desc="Stage moves and remarks, newest first" />
          <TimelineTab dl={dl} ev={api.timeline} p={p} />
        </section>
      </div>
    </DrawerShell>
  );
}

/* Locked actions are ABSENT, not greyed. One primary — a remark is by a long
   way the most repeated thing anybody does to a deal — one secondary, and the
   rest behind the menu with the destructive one last and apart. Stage and
   priority are not here: they are controls at the top of the record, where you
   can read the value you are about to change. */
function ActionBar({ dl, p }: { dl: any; p: Params }) {
  const acts = useActs(p);
  const ref = dl.deal_id;
  const items = [
    { icon: "rupee", label: dl.deal_value ? "Change deal value" : "Set deal value", act: () => acts.value(ref) },
    { icon: "route", label: "Change stage", act: () => acts.stage(ref, dl.stage) },
    { icon: "tag", label: "Lists", act: () => acts.tags(ref) },
    ...(head() ? [{ icon: "recon", label: "Reassign", act: () => acts.reassign(ref) }] : []),
    ...(head() ? [{ icon: "x", label: "Close deal", act: () => acts.closeDeal(ref), tone: "bad" }] : []),
  ];
  return (
    <>
      <MoreMenu label="Actions" items={items} />
      <Button color="secondary" ico="edit" data-act="dl-edit" data-ref={ref} onClick={() => acts.edit(ref)}>Edit deal</Button>
      <Button color="primary" ico="note" data-act="dl-remark" data-ref={ref} onClick={() => acts.remark(ref)}>Add remark</Button>
    </>
  );
}

/* `ev` is the API's own transitions + remarks, adapted in adapter.ts. It is
   the whole history there is: the engine's quote/invoice/payment lines are
   gone with the stores that invented them. */
function TimelineTab({ dl, ev, p }: {
  dl: any; ev: { kind: string; tone: string; at: string; by: string; text: string }[]; p: Params;
}) {
  const acts = useActs(p);
  const add = () => {
    const text = val("dlQuickRemark");
    if (!text) return;
    acts.quick(dl.deal_id);
    const el = document.getElementById("dlQuickRemark") as HTMLInputElement | null;
    if (el) el.value = "";
  };
  return (
    <div className="flex flex-col gap-4">
      {/* THREE CLICKS AND ONE TEXT FIELD — the most repeated action in the
          module, at the top of the thing it appends to. Adding a remark also
          clears the stalled flag, server-side. */}
      <div className="flex items-center gap-2">
        <Input id="dlQuickRemark" ph="Log a call, a message, a site visit…" ariaLabel="Quick remark" onEnter={add} />
        <Button color="secondary" ico="plus" data-act="dl-quick" data-ref={dl.deal_id} onClick={add}>Add</Button>
      </div>

      {ev.length
        ? <Timeline items={ev.map((e: any) => ({
            tone: e.tone === "bad" ? "bad" : e.kind === "SYSTEM" ? "sys" : undefined,
            title: <span className="flex flex-wrap items-center gap-2">
              <Pill xs tone={e.tone === "bad" ? "bad" : e.kind === "SYSTEM" ? "sys" : "neutral"} text={e.kind} />
              <span className="text-xs font-normal text-tertiary tnum">{D.fmtDate(e.at)}</span>
            </span>,
            body: e.kind === "REMARK" || e.kind === "SYSTEM" ? e.text : <Rich text={e.text} />,
            meta: e.by,
          }))} />
        : <div className="flex flex-col gap-1">
            <Eyebrow bare>Nothing yet</Eyebrow>
            <p className="text-sm text-tertiary">
              No stage move and no remark has been recorded against this deal. The first one you add
              appears here, under your name.
            </p>
          </div>}

      <Notice ico="lock" text={<>
        Nothing in this timeline is editable or deletable. <b>There is no PUT and no DELETE endpoint</b>{" "}
        for a remark or a transition — immutability is enforced by the absence of the API, not by a
        permission check.
      </>} />
    </div>
  );
}
