/* =============================================================================
   Deals — the small render pieces every view mode shares.
   -----------------------------------------------------------------------------
   Chain dots, tag chips, the money cell, the owner cell and the next-action
   cell are rendered identically in Table, Pipeline and Chat — the same three
   squares have to mean the same thing in every view, or the reader has to
   relearn them each time they switch.
   ============================================================================= */
import type { ReactNode } from "react";
import { Icon, Notice, avatarTone, initials } from "../../ui";
import { STAGE, daysFrom, inr, relativeDate } from "./useDeals";
import type { Refusal } from "./useDeals";

/* ChainDots — the Q / I / ₹ squares. It was removed when the chain lived only
   in the browser's seed store; interior_deals_billing has the models now, so
   the three states come off the deal row itself (quotationStatus /
   invoiceStatus / paid, see DealsController._with_chain).

   Q  a quotation exists, and where it stands
   I  an invoice exists, and whether it is settled
   ₹  money actually received

   Every square is ALWAYS drawn — the blank one is the point. Three squares in
   a fixed order read as a progress track you can scan down a column; showing
   only the lit ones would make each row a different shape and hide the fact
   that a deal has no quotation at all. Colour is never the only carrier: each
   square says what it means in its own title.
   ------------------------------------------------------------------------- */
export function ChainDots({ d }: { d: any }) {
  const q: string = d.quotation_status || "none";
  const i: string = d.invoice_status || "none";
  const paid = !!d.paid;
  /* No 'cancelled' branch on either: the server reports the LIVE document and
     resolves a withdrawn one to 'none' (see _invoice_ui_status), so a tone for
     it here would be a branch nothing can reach. */
  return (
    <span className="dls-cd">
      <span className={q === "none" ? "" : q === "accepted" ? "ok" : q === "rejected" ? "bad" : "warn"}
        title={q === "none" ? "No quotation yet" : "Quotation " + q}>Q</span>
      <span className={i === "none" ? "" : i === "paid" ? "ok" : "warn"}
        title={i === "none"
          ? (q === "accepted" ? "Ready to invoice" : "Locked — needs an accepted quotation")
          : "Invoice " + i}>I</span>
      <span className={paid ? "ok" : ""}
        title={paid ? "Payment received" : "No payment yet"}>₹</span>
    </span>
  );
}

/* A tag pill takes `tag-<hue>`, never the bare tone name: `.pill.red` does not
   exist, and `.pill.bad` — which it would otherwise have collided with — means
   a verdict this tag is not making. No hue is the plain pill. */
export function toneClass(v?: string) { return v ? " tag-" + v : ""; }

/* Twelve, in hue order, drawn 6 x 2. Named for the colour and nothing else —
   these are labels, not verdicts, so "Red" is a red and says nothing about the
   deal. The first is no colour at all, which is where every tag starts and
   where most of them stay. Kept in the same order as IBDeals.TAG_TONES; the
   engine validates against that list, this one only names them. */
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

/* Tags come off the deal row itself — the list and detail responses both
   carry them — so there is no lookup to get wrong and nothing to be stale
   against the row beside it. */
export function TagChips({ max, tags }: { max?: number; tags?: any[] }) {
  const all = tags || [];
  if (!all.length) return null;
  const cap = max || all.length;
  const shown = all.slice(0, cap);
  return (
    <span className="dls-tags">
      {shown.map((t: any) => (
        <span key={t.slug} className={"pill" + toneClass(t.tone) + " xs"} title={"List · " + t.label}>
          {t.label}
        </span>
      ))}
      {all.length > cap ? <span className="pill xs faint">+{all.length - cap}</span> : null}
    </span>
  );
}

/* Value and Outstanding as two numbers made the reader do the subtraction.
   One bar plus one sentence says the same thing at a glance. */
export function MoneyCell({ d }: { d: any }) {
  if (!d.deal_value) return <span className="faint">—</span>;
  if (d.stage === STAGE.LOST)
    return (
      <>
        <div className="amt tnum faint">{inr(d.deal_value)}</div>
        <div className="sub">quoted, not won</div>
      </>
    );
  /* Value alone. The collected bar and the "x% · ₹y outstanding" line are
     gone with the payment store that fed them — a progress bar drawn from seed
     money is a claim about collection nobody made. */
  return <div className="amt tnum">{inr(d.deal_value)}</div>;
}

export function OwnerCell({ d }: { d: any }) {
  if (!d.owner_id) return <span className="faint">—</span>;
  return (
    <span className="dls-who">
      <span className={"av sm " + avatarTone(d.owner_id)}>{initials(d.owner_id)}</span>
      {d.owner_id}
      {d.co_owner_id ? <> <span className="faint">+1</span></> : null}
    </span>
  );
}

export function NextCell({ d }: { d: any }) {
  if (d.stage >= STAGE.WON || !d.next_action)
    return d.close_reason ? <div className="n">{d.close_reason}</div> : <span className="faint">—</span>;
  const days = daysFrom(d.next_action.date);
  return (
    <>
      <div className={"t" + (days < 0 ? " over" : "")}>
        {days < 0 ? Math.abs(days) + "d overdue" : relativeDate(d.next_action.date)}
      </div>
      <div className="n">{d.next_action.note}</div>
    </>
  );
}

/* The strip's read-out cell, reused by the chat pane's Money block. Kept as
   its own piece rather than exported from the strip because the two carry
   different numbers — scope totals there, one deal's here — and only the
   shape is shared. */
export function MoneyCellCtx({ k, v, tone }: { k: ReactNode; v: ReactNode; tone?: string }) {
  return (
    <div className={"dls-stat ro" + (tone ? " " + tone : "")}>
      <span className="v tnum">{v}</span><span className="k">{k}</span>
    </div>
  );
}

export function Fig({ k, v, style }: { k: ReactNode; v: ReactNode; style?: React.CSSProperties }) {
  return (
    <div>
      <div style={{ fontSize: "var(--text-sm)", color: "var(--text-2)" }}>{k}</div>
      <div className="tnum" style={{ fontSize: "var(--text-2xl)", fontWeight: 600, marginTop: "2px", ...style }}>{v}</div>
    </div>
  );
}

/* The modal error slot. The prototype wrote into `#dlErr` with innerHTML; here
   each modal owns the state and hands it down. Same id, same position — the
   refusal appears above the form that produced it, never as a toast that
   scrolls away. */
export function ErrSlot({ err }: { err: Refusal | null }) {
  return (
    <div id="dlErr">
      {err ? (
        <Notice tone="bad" text={
          <>
            <b>{err.http} <span className="mono">{err.code}</span></b>
            <div style={{ marginTop: "3px" }}>{err.detail}</div>
          </>
        } />
      ) : null}
    </div>
  );
}

/* The prototype's btn(act,label,ref,cls,ico) — the same element, with a real
   handler beside the data-act it keeps. */
export function ActBtn({ act, label, dealRef, cls, ico, onClick, title }: {
  act: string; label: ReactNode; dealRef?: string; cls?: string; ico?: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; title?: string;
}) {
  return (
    <button className={"btn " + (cls || "")} data-act={act} data-ref={dealRef} title={title} onClick={onClick}>
      {ico ? <Icon name={ico} /> : null}{label}
    </button>
  );
}

/* A menu row inside a popover — the prototype's mi(). */
export function Mi({ act, ico, label, hint, cls, onClick }: {
  act?: string; ico: string; label: ReactNode; hint?: ReactNode; cls?: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button className={"mi" + (cls ? " " + cls : "")} data-act={act} onClick={onClick}>
      <Icon name={ico} />
      <span><b>{label}</b><span className="d">{hint}</span></span>
    </button>
  );
}

export function orDash(v: ReactNode) { return v ? v : <span className="faint">—</span>; }

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
        return bold ? <b key={i}>{un(s)}</b> : <span key={i}>{un(s)}</span>;
      })}
    </>
  );
}
