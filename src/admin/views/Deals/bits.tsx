/* =============================================================================
   Deals — the small render pieces every view mode shares.
   -----------------------------------------------------------------------------
   Chain squares, tag chips, the money cell, the owner cell, the next-action
   cell, the kanban card and its column are rendered identically in Table,
   Pipeline and Chat — the same three squares have to mean the same thing in
   every view, or the reader has to relearn them each time they switch.

   Everything here is a COMPONENT built from the shared parts and Tailwind
   utilities on the semantic tokens. There is no module stylesheet: a drawing
   this module needs and the system does not ship lives in this file.
   ============================================================================= */
import type { ReactNode } from "react";
import { cx } from "@/utils/cx";
import { Avatar, DealStatus, Icon, MenuRow, Notice, Person, Pill, Pipeline, Priority, Tags, tagClasses } from "../../ui";
import { go } from "../../ui/nav";
import { D, STAGE, STRIP_STAGES, daysFrom, dealHash, inr, relativeDate, urgency } from "./useDeals";
import type { Params, Refusal } from "./useDeals";

/* ============================================================== the chain ===
   ChainDots — the Q / I / ₹ squares.

   Q  a quotation exists, and where it stands
   I  an invoice exists, and whether it is settled
   ₹  money actually received

   Every square is ALWAYS drawn — the blank one is the point. Three squares in
   a fixed order read as a progress track you can scan down a column; showing
   only the lit ones would make each row a different shape and hide the fact
   that a deal has no quotation at all. Colour is never the only carrier: each
   square says what it means in its own label, and the letter itself is the
   second channel.
   ------------------------------------------------------------------------- */
const SQUARE: Record<string, string> = {
  none: "bg-secondary text-quaternary ring-secondary",
  ok: "bg-utility-green-50 text-utility-green-700 ring-utility-green-200",
  warn: "bg-utility-yellow-50 text-utility-yellow-700 ring-utility-yellow-200",
  bad: "bg-utility-red-50 text-utility-red-700 ring-utility-red-200",
};

function Square({ tone, letter, what }: { tone: keyof typeof SQUARE; letter: string; what: string }) {
  return (
    <span
      title={what}
      aria-label={what}
      className={cx("flex size-4.5 items-center justify-center rounded-md font-mono text-2xs font-semibold ring-1 ring-inset", SQUARE[tone])}
    >
      {letter}
    </span>
  );
}

export function ChainDots({ d }: { d: any }) {
  const q: string = d.quotation_status || "none";
  const i: string = d.invoice_status || "none";
  const paid = !!d.paid;
  /* No 'cancelled' branch on either: the server reports the LIVE document and
     resolves a withdrawn one to 'none' (see _invoice_ui_status), so a tone for
     it here would be a branch nothing can reach. */
  return (
    <span className="inline-flex items-center gap-1" role="group" aria-label="Quotation, invoice and payment">
      <Square letter="Q" tone={q === "none" ? "none" : q === "accepted" ? "ok" : q === "rejected" ? "bad" : "warn"} what={q === "none" ? "No quotation yet" : "Quotation " + q} />
      <Square
        letter="I"
        tone={i === "none" ? "none" : i === "paid" ? "ok" : "warn"}
        what={i === "none" ? (q === "accepted" ? "Ready to invoice" : "Locked — needs an accepted quotation") : "Invoice " + i}
      />
      <Square letter="₹" tone={paid ? "ok" : "none"} what={paid ? "Payment received" : "No payment yet"} />
    </span>
  );
}

/* ================================================================== tags ===
   Twelve hues, in hue order. Named for the colour and nothing else — these are
   labels, not verdicts, so "Red" is a red and says nothing about the deal. The
   first is no colour at all, which is where every tag starts and where most of
   them stay. Kept in the same order as IBDeals.TAG_TONES; the engine validates
   against that list, this one only names them. */
export const TONES: [string, string][] = [
  ["", "No colour"], ["slate", "Slate"], ["red", "Red"],
  ["orange", "Orange"], ["amber", "Amber"], ["lime", "Lime"],
  ["green", "Green"], ["teal", "Teal"], ["cyan", "Cyan"],
  ["blue", "Blue"], ["violet", "Violet"], ["pink", "Pink"]
];
export function toneOpts(sel?: string) {
  return TONES.map((o) => ({ v: o[0], l: o[1], sel: o[0] === (sel || "") }));
}
export function toneName(v?: string) {
  const hit = TONES.filter((o) => o[0] === (v || ""))[0];
  return hit ? hit[1] : "No colour";
}

/* THE SWATCH PICKER — one row of hues, drawn from `tagClasses` so a swatch and
   the tag it makes are literally the same colours. One drawing, used by the
   list editor and by the per-deal tile. */
export function Swatches({ value, onPick, name }: { value: string; onPick: (v: string) => void; name?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Tag colour">
      {toneOpts(value).map((o) => (
        <button
          key={o.v || "none"}
          type="button"
          role="radio"
          aria-checked={o.sel}
          data-pick={name || "tgTone"}
          data-v={o.v}
          title={o.l}
          aria-label={o.l}
          className={cx(
            "size-6 cursor-pointer rounded-md ring-1 outline-focus-ring transition duration-100 ring-inset hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2",
            tagClasses(o.v),
            o.sel && "ring-2 ring-brand",
          )}
          onClick={() => onPick(o.v)}
        >
          {o.sel ? <Icon name="check" size="xs" className="mx-auto" /> : null}
        </button>
      ))}
      {/* Picking a colour is a state change, never a re-fetch — the name field
          beside it is usually half-typed when you reach for a dot. */}
      <input type="hidden" id={name || "tgTone"} value={value} readOnly />
    </div>
  );
}

/* Tags come off the deal row itself — the list and detail responses both carry
   them — so there is no lookup to get wrong and nothing to be stale against
   the row beside it. */
export function TagChips({ max, tags }: { max?: number; tags?: any[] }) {
  const all = tags || [];
  if (!all.length) return null;
  return <Tags max={max} items={all.map((t: any) => ({ label: t.label, tone: t.tone || "" }))} />;
}

/* ================================================================ status ===
   ONE stage chip for the whole module. `DealStatus` owns the tone for the
   vocabulary the product already knows; a stage the server added at runtime
   (adapter.ts grafts it in) states its own tone, and that word wins — the
   alternative is a new stage silently rendering as "neutral" everywhere. */
export function StageChip({ stage, lg }: { stage: number; lg?: boolean }) {
  const s = D.STAGES[stage] || { key: String(stage), label: String(stage), tone: "" };
  if (s.tone && s.tone !== "dead") return <Pill dot lg={lg} tone={s.tone} text={s.label} />;
  return <DealStatus status={s.key} label={s.label} lg={lg} />;
}

/* Priority is an ANNOTATION, never a verdict about the deal — the shared
   Priority chip already knows the three words and their tones. */
export function PriorityChip({ priority }: { priority: number }) {
  return <Priority level={String(D.PRIORITY[priority] || "normal").toLowerCase()} label={D.PRIORITY[priority]} />;
}

/* WHERE THE DEAL IS IN THE FUNNEL, as the shared `Pipeline` — the four working
   stages plus Won, which is where the funnel ends.

   Lost is deliberately not a step: `Pipeline` marks everything before the
   current stage as DONE, so putting the exit last would draw a Lost deal as
   having completed Won. A deal that left the pipeline says so in one line
   instead, which is also the only place the close reason is worth reading. */
export function StagePipeline({ stage, closeReason, compact }: { stage: number; closeReason?: string; compact?: boolean }) {
  if (stage === STAGE.LOST) {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <StageChip stage={stage} />
        <span className="min-w-0 truncate text-xs text-tertiary">{closeReason || "Left the pipeline"}</span>
      </div>
    );
  }
  return (
    <Pipeline
      compact={compact}
      current={String(stage)}
      stages={STRIP_STAGES.map((s) => ({ k: String(s), label: D.STAGES[s].label }))}
    />
  );
}

/** The exception stripe's tone for a row — `urgency()` names the condition,
 *  this names its colour, and `Rail` draws it. */
export function railTone(d: any): string | undefined {
  const u = urgency(d);
  if (!u) return undefined;
  return u.cls === "u-bad" ? "bad" : u.cls === "u-warn" ? "warn" : "info";
}
export function railWhy(d: any): string | undefined {
  const u = urgency(d);
  return u ? u.why : undefined;
}

/* ================================================================= cells ===
   Value alone. The collected bar and the "x% · ₹y outstanding" line are gone
   with the payment store that fed them — a progress bar drawn from seed money
   is a claim about collection nobody made. */
export function MoneyCell({ d }: { d: any }) {
  if (!d.deal_value) return <span className="text-quaternary">—</span>;
  if (d.stage === STAGE.LOST)
    return (
      <>
        <div className="text-quaternary">{inr(d.deal_value)}</div>
        <div className="text-xs font-sans text-quaternary">quoted, not won</div>
      </>
    );
  return <span className="font-medium text-primary">{inr(d.deal_value)}</span>;
}

export function OwnerCell({ d }: { d: any }) {
  if (!d.owner_id) return <span className="inline-flex items-center gap-1.5 text-sm text-quaternary"><Icon name="user" size="xs" />Unassigned</span>;
  return <Person name={d.owner_id} sm sub={d.co_owner_id ? "with " + d.co_owner_id : undefined} />;
}

export function NextCell({ d }: { d: any }) {
  if (d.stage >= STAGE.WON || !d.next_action)
    return d.close_reason ? <span className="text-tertiary">{d.close_reason}</span> : <span className="text-quaternary">—</span>;
  const days = daysFrom(d.next_action.date);
  return (
    <>
      <div className={cx("font-medium tnum", days < 0 ? "text-error-primary" : "text-secondary")}>
        {days < 0 ? Math.abs(days) + "d overdue" : relativeDate(d.next_action.date)}
      </div>
      {d.next_action.note ? <div className="mt-0.5 max-w-40 truncate text-xs text-quaternary">{d.next_action.note}</div> : null}
    </>
  );
}

/* A READ-OUT: the figure over its name. Reused by the chat pane's Money block
   and the drawer's own money row — the two carry different numbers (one deal's
   here, a scope's totals there) and only the shape is shared. */
export function MoneyCellCtx({ k, v, tone }: { k: ReactNode; v: ReactNode; tone?: string }) {
  const t = tone === "ok" ? "text-success-primary" : tone === "warn" ? "text-warning-primary" : tone === "bad" ? "text-error-primary" : "text-primary";
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className={cx("truncate font-mono text-sm font-semibold tnum", t)}>{v}</span>
      <span className="label-mono truncate">{k}</span>
    </div>
  );
}

/** A larger figure with its name above it — a record's headline numbers. */
export function Fig({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="label-mono truncate">{k}</span>
      <span className="truncate font-mono text-lg font-semibold text-primary tnum">{v}</span>
    </div>
  );
}

/* The modal error slot. The prototype wrote into `#dlErr` with innerHTML; here
   each modal owns the state and hands it down. Same id, same position — the
   refusal appears above the form that produced it, never as a toast that
   scrolls away. */
export function ErrSlot({ err }: { err: Refusal | null }) {
  if (!err) return <div id="dlErr" />;
  return (
    <div id="dlErr" className="mb-4">
      <Notice tone="bad">
        <b>
          {err.http} {err.code ? <span className="font-mono tnum">{err.code}</span> : null}
        </b>
        <div className="mt-0.5">{err.detail}</div>
      </Notice>
    </div>
  );
}

/* A menu row inside a popover — the prototype's mi(). Quotations and Invoices
   render their document menus with this, so the shape stays. `act` was the
   delegated-handler hook the prototype's shell read; the row calls its own
   handler now, and the attribute rides along for the popover dismissal rule. */
export function Mi({ act, ico, label, hint, cls, onClick }: {
  act?: string; ico: string; label: ReactNode; hint?: ReactNode; cls?: string;
  onClick: (e?: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <span data-act={act} className="block">
      <MenuRow ico={ico} label={label} desc={hint} danger={!!cls && /dgr|bad|danger/.test(cls)} onClick={() => onClick()} />
    </span>
  );
}

export function orDash(v: ReactNode) { return v ? v : <span className="text-quaternary">—</span>; }

/* The engine builds its non-remark timeline lines as markup — exactly one tag,
   `<b>` around the reference, with everything interpolated already escaped.
   dangerouslySetInnerHTML is not available here, so the bold runs are parsed
   back out and rendered as elements, and the four entities the engine's esc()
   produces are decoded. A remark's own text never goes through this: JSX
   escapes it, which is what replaced esc() everywhere else. */
export function Rich({ text }: { text: string }) {
  const un = (s: string) => s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  const parts = String(text || "").split(/(<b>|<\/b>)/);
  let bold = false;
  return (
    <>
      {parts.map((s, i) => {
        if (s === "<b>") { bold = true; return null; }
        if (s === "</b>") { bold = false; return null; }
        if (!s) return null;
        return bold ? <b key={i} className="font-semibold text-primary">{un(s)}</b> : <span key={i}>{un(s)}</span>;
      })}
    </>
  );
}

/* ============================================================== the chain ===
   ONE DOCUMENT, AS A ROW YOU CAN OPEN. A quotation and an invoice are the same
   kind of thing to the reader — a document this deal produced, the state it is
   in, the amount on it — so they are read the same way. The tone lives on the
   glyph, never on the row: a coloured row in a stack of three reads as a
   warning about the stack. */
const CHAIN_IC: Record<string, string> = {
  ok: "bg-utility-green-50 text-utility-green-700 ring-utility-green-200",
  warn: "bg-utility-yellow-50 text-utility-yellow-700 ring-utility-yellow-200",
  bad: "bg-utility-red-50 text-utility-red-700 ring-utility-red-200",
  dead: "bg-secondary text-quaternary ring-secondary",
  q: "bg-utility-blue-50 text-utility-blue-700 ring-utility-blue-200",
};
export function ChainCard({ to, tone, icon, t1, t2 }: {
  to: string; tone?: string; icon: string; t1: ReactNode; t2: ReactNode;
}) {
  return (
    <a
      href={to}
      data-go={to}
      className="flex min-w-0 items-center gap-2.5 rounded-lg bg-primary p-2.5 shadow-xs ring-1 ring-secondary outline-focus-ring transition duration-100 hover:ring-primary focus-visible:outline-2 focus-visible:outline-offset-2"
      onClick={(e) => { e.preventDefault(); go(to); }}
    >
      <span className={cx("flex size-7 shrink-0 items-center justify-center rounded-md ring-1 ring-inset", CHAIN_IC[tone || "dead"] || CHAIN_IC.dead)}>
        <Icon name={icon} size="sm" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-primary">{t1}</span>
        <span className="truncate text-xs text-tertiary">{t2}</span>
      </span>
      <Icon name="chevr" size="sm" className="shrink-0 text-fg-quaternary" />
    </a>
  );
}

/* ============================================================== the board ===
   A KANBAN CARD. The board's job is spotting what is rotting, so the card
   leads with the reason it is flagged and falls back to the next action only
   when the deal is calm. The stage rides as a dot rather than a pill: the
   column head already names the stage, and a pill per card would say it
   fifteen more times.
   ------------------------------------------------------------------------- */
const DOT: Record<string, string> = {
  ok: "bg-utility-green-500",
  warn: "bg-utility-yellow-500",
  bad: "bg-utility-red-500",
  info: "bg-utility-blue-500",
  dead: "bg-utility-neutral-400",
  "": "bg-utility-neutral-400",
};

export function DealCard({ d, sel, p }: { d: any; sel?: string | null; p: Params }) {
  const tone = railTone(d);
  const why = railWhy(d);
  const days = d.next_action ? daysFrom(d.next_action.date) : null;
  const tail = d.is_stalled ? "Stalled"
    : days !== null && days < 0 ? Math.abs(days) + "d overdue"
    : d.next_action ? d.next_action.note : "";
  const to = dealHash(d.deal_id, p);
  const stageTone = (D.STAGES[d.stage] || { tone: "" }).tone || "";

  return (
    <button
      type="button"
      data-go={to}
      title={why}
      onClick={() => go(to)}
      className={cx(
        "group flex w-full cursor-pointer flex-col gap-2 rounded-lg bg-primary p-3 text-left shadow-xs ring-1 ring-secondary outline-focus-ring transition duration-100 hover:ring-primary focus-visible:outline-2 focus-visible:outline-offset-2",
        sel === d.deal_id && "ring-2 ring-brand",
        tone === "bad" && "rail-error",
        tone === "warn" && "rail-warning",
        tone === "info" && "rail-info",
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <span aria-hidden="true" className={cx("mt-1.5 size-2 shrink-0 rounded-full", DOT[stageTone] || DOT[""])} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary">{d.customer_name}</span>
        <span className="shrink-0 font-mono text-sm font-semibold text-primary tnum">{d.deal_value ? inr(d.deal_value, { compact: true }) : "—"}</span>
      </div>
      {d.business_name ? <div className="truncate pl-4 text-xs text-tertiary">{d.business_name}</div> : null}
      <div className="flex items-center gap-2 pl-4">
        <ChainDots d={d} />
        <span className="flex-1" />
        {d.owner_id ? <Avatar name={d.owner_id} xs /> : null}
      </div>
      <div className="flex min-w-0 items-center gap-2 pl-4">
        <span className={cx("min-w-0 flex-1 truncate text-xs", tone === "bad" ? "text-error-primary" : "text-quaternary")}>
          {Math.abs(daysFrom(d.stage_since))}d in stage{tail ? " · " + tail : ""}
        </span>
      </div>
      {d.tags && d.tags.length ? <div className="pl-4"><TagChips max={2} tags={d.tags} /></div> : null}
    </button>
  );
}

/* A KANBAN COLUMN. `label-mono` head, the count as a small pill, the money in
   the column as a mono figure — the three things you read across the board
   before you read any single card. */
export function StageColumn({ stage, items, sel, p }: { stage: number; items: any[]; sel?: string | null; p: Params }) {
  const s = D.STAGES[stage] || { key: String(stage), label: String(stage), tone: "", hint: "" };
  const value = items.reduce((a: number, d: any) => a + (d.deal_value || 0), 0);
  return (
    <section className="flex w-72 shrink-0 flex-col rounded-xl bg-secondary ring-1 ring-secondary" aria-label={s.label}>
      <header className="flex items-center gap-2 border-b border-secondary px-3 py-2.5">
        <span aria-hidden="true" className={cx("size-2 shrink-0 rounded-full", DOT[s.tone || ""] || DOT[""])} />
        <h3 className="label-mono min-w-0 flex-1 truncate">{s.label}</h3>
        <Pill xs tone="neutral" text={items.length} />
      </header>
      <div className="flex items-baseline justify-between gap-2 px-3 pt-2">
        <span className="font-mono text-sm font-semibold text-primary tnum">{value ? inr(value, { compact: true }) : "—"}</span>
        <span className="truncate text-xs text-quaternary">{s.hint}</span>
      </div>
      <div className="flex max-h-[60vh] min-h-24 flex-col gap-2 overflow-y-auto p-3">
        {items.length
          ? items.map((d: any) => <DealCard key={d.deal_id} d={d} sel={sel} p={p} />)
          : <p className="px-1 py-3 text-xs text-quaternary">Nothing in this stage.</p>}
      </div>
    </section>
  );
}
