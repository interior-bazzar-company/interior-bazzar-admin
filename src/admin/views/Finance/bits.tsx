/* =============================================================================
   Finance — the vocabulary this module owns, as components. Tiles, cards,
   tables, notices, pills and the stat strip all come from ui/ and
   admin-theme.css; what is here is only what Finance means by them.
   ============================================================================= */
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "../../ui";
import { go } from "../../ui/nav";
import {
  ago, decision, eventMeta, failureMeta, inr, instStatusMeta, originMeta, refundStateMeta,
  runStateMeta, sourceMeta, subStatusMeta, tagKindMeta, tagOf, txnStateMeta,
} from "./store";
import type { CompanyTxn, FinEvent } from "./store";

/* ------------------------------------------------------------- TxnMenu --- */
/** EVERYTHING A POSTED ROW CAN HAVE DONE TO IT, and the same menu wherever the
 *  row appears — the ledger and the record. It lived on the record page alone
 *  while cancelling was the only action and the record was the only place to
 *  reach it; putting it on the list too means a wrong row can be written off
 *  from the screen somebody noticed it on.
 *
 *  THERE IS NO EDIT ON IT. Nothing rewrites what a row says: the amount, the
 *  direction, the tag, the reference, the date, the account and the receipt are
 *  the fact it asserts, and a row that asserts the wrong thing is CANCELLED
 *  with a reason and recorded again correctly. That is the module's whole
 *  correction story and this menu is where it starts.
 *
 *  IT STOPS ITS OWN CLICKS. In the list every row is a link, so a press on the
 *  trigger or on any item would navigate out from under the menu it just
 *  opened. On the record there is nothing to stop and the handler is harmless.
 *
 *  The caller supplies the actions rather than the menu reaching for a store:
 *  a component that opens modals is a component that has to know which shell it
 *  is inside, and this one renders in two. */
export function TxnMenu({ txn, sa, onCancel, onOpen, onCopied }: {
  txn: CompanyTxn; sa: boolean;
  onCancel: () => void;
  /** Given on the list, where the record is somewhere to go. Omitted on the
   *  record itself, where it would offer to open the page it is already on. */
  onOpen?: () => void;
  onCopied: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc, true);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc, true);
    };
  }, [open]);

  const item = (icon: string, label: string, act: () => void,
    opts?: { disabled?: boolean; title?: string; tone?: string }) => (
    <button type="button" role="menuitem" className={"mi" + (opts?.tone ? " " + opts.tone : "")}
      disabled={opts?.disabled} title={opts?.title}
      onClick={(e) => { e.stopPropagation(); setOpen(false); act(); }}>
      <Icon name={icon} size="sm" />{label}
    </button>
  );

  const cancelled = txn.state === "cancelled";
  return (
    <span className="fin-menu" ref={box} onClick={(e) => e.stopPropagation()}>
      {/* THE WORD, NOT THE GLYPH. It was a three-dot button, which is a
          convention somebody either already holds or does not — and on a table
          row it sat in a column with no header to explain it, next to nothing
          else that could be pressed. `Actions` costs a few pixels in the one
          column that has room to spare and asks nobody to recognise anything.
          The aria-label keeps the row id, because a screen reader meeting the
          twentieth `Actions` on a page needs to know which row it belongs to. */}
      <button type="button" className="btn sm" aria-haspopup="menu" aria-expanded={open}
        aria-label={"Actions for " + txn.txnId}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        Actions
      </button>
      {open ? (
        <span className="fin-menu-pop" role="menu" aria-label={"Actions for " + txn.txnId}>
          {onOpen ? item("invoice", "Open the record", onOpen) : null}
          {/* DISABLED, ALWAYS, AND IT SAYS WHY. The panel holds a filename and
              not the bytes, so a download would produce nothing — and an item
              that silently does nothing is worse than one that explains. It is
              shown rather than hidden because somebody who cannot see the
              action cannot ask for it either. */}
          {item("download", "Download receipt", () => {}, {
            disabled: true,
            title: txn.bill
              ? "The panel holds the file's name, not the file. Download arrives with the document store."
              : "There is no receipt on this row.",
          })}
          {/* THE ONE THING THAT CHANGES A POSTED ROW, and it changes only its
              standing: every figure stays as posted and the row stays in the
              ledger. Disabled rather than hidden without Super Admin, because
              somebody who cannot see the action cannot ask for it either. */}
          {item("recon", "Cancel", onCancel, {
            disabled: !sa || cancelled,
            tone: "dgr",
            title: cancelled
              ? "It is already cancelled."
              : sa
                ? "Write this row off with a reason. It keeps every figure it was posted with and stops counting."
                : "Cancelling a transaction is Super Admin only.",
          })}
          {/* `link` rather than a copy glyph, because the icon set has no copy
             and inventing one for a menu item is a new SVG to maintain for a
             convenience. */}
          {item("link", "Copy row id", () => {
            void navigator?.clipboard?.writeText?.(txn.txnId);
            onCopied(txn.txnId + " copied.");
          })}
        </span>
      ) : null}
    </span>
  );
}


/** Deliberately loud, never dismissible. */
export function ProtoBar({ onReset }: { onReset?: () => void }) {
  return (
    <div className="fin-proto">
      <Icon name="alert" size="sm" />
      <span>
        <b>Nothing here is live.</b> Records come from{" "}
        <span className="mono">src/content/finance/</span> and every action writes to this tab only.
        Team members and invoices are read from the live modules; the chain links open them.
      </span>
      {onReset && import.meta.env.DEV ? <button className="btn sm" onClick={onReset}>Reset</button> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- pills --- */

/** An installment's status. `fail_to_pay` is the one that matters: it says
 *  something happened, and the record carries what. */
export function InstPill({ k, lg }: { k: string; lg?: boolean }) {
  const m = instStatusMeta(k);
  return (
    <span className={"pill fin-st" + (m?.tone ? " " + m.tone : "") + (lg ? " lg" : "")} title={m?.meaning}>
      <span className={"dot s-" + k} />{m?.label || k}
    </span>
  );
}
export function SubPill({ k, lg }: { k: string; lg?: boolean }) {
  const m = subStatusMeta(k);
  return <span className={"pill fin-st" + (m?.tone ? " " + m.tone : "") + (lg ? " lg" : "")} title={m?.meaning}>
    <span className={"dot s-" + k} />{m?.label || k}
  </span>;
}
export function RunPill({ k, lg }: { k: string; lg?: boolean }) {
  const m = runStateMeta(k);
  return <span className={"pill" + (m?.tone ? " " + m.tone : "") + (lg ? " lg" : "")} title={m?.meaning}>{m?.label || k}</span>;
}
export function TxnPill({ k, lg }: { k: string; lg?: boolean }) {
  const m = txnStateMeta(k);
  return <span className={"pill" + (m?.tone ? " " + m.tone : "") + (lg ? " lg" : "")} title={m?.meaning}>{m?.label || k}</span>;
}
export function RefundPill({ k, lg }: { k: string; lg?: boolean }) {
  const m = refundStateMeta(k);
  return <span className={"pill" + (m?.tone ? " " + m.tone : "") + (lg ? " lg" : "")}>{m?.label || k}</span>;
}

/** Which door the sale came through — sales, or the website. */
export function SourceTag({ k }: { k: string }) {
  const m = sourceMeta(k);
  return <span className={"fin-path p-" + k} title={m?.help}>{m?.short || k}</span>;
}
export function OriginTag({ k }: { k: string }) {
  const m = originMeta(k);
  return <span className={"fin-path p-" + k} title={m?.help}>{k === "manual" ? "BY HAND" : "SUBSCRIPTION"}</span>;
}
/** The custom tag on a company transaction, wearing what it rolls up to. */
export function TagChip({ k, big }: { k: string; big?: boolean }) {
  const t = tagOf(k);
  const kind = t ? tagKindMeta(t.kind) : null;
  return (
    <span className={"fin-cat k-" + (t?.kind || "none") + (big ? " big" : "") + (t && !t.active ? " off" : "")}
      title={kind ? kind.label + " — lands in " + kind.landsIn : undefined}>
      <i />{t?.label || k}{t && !t.active ? <em> · inactive</em> : null}
    </span>
  );
}
export function Role({ sa, children }: { sa?: boolean; children?: ReactNode }) {
  return <span className={"fin-role" + (sa ? " sa" : "")}>{children || (sa ? "Super Admin" : "Finance")}</span>;
}
/** THE BANK STATEMENT'S WORDS, not this module's own. A credit is money
 *  arriving and a debit is money leaving, which is what the two of them mean on
 *  every statement these rows are reconciled against — `Out` and `In` were a
 *  second vocabulary for the same fact, and a person matching a row to a
 *  statement had to translate. The STORED value is untouched: the ledger still
 *  holds `out` and `in`, and so does the class on this span. */
export function Dir({ d }: { d: "in" | "out" }) {
  return <span className={"fin-dir " + d}>{d === "out" ? "Debit" : "Credit"}</span>;
}

/** Signed money. */
export function Money({ paise, sign, strong }: { paise: number; sign?: boolean; strong?: boolean }) {
  const neg = paise < 0;
  return (
    <span className={"tnum fin-money" + (neg ? " neg" : sign ? " pos" : "") + (strong ? " strong" : "")}>
      {neg ? "−" : sign ? "+" : ""}{inr(Math.abs(paise))}
    </span>
  );
}

/** Why an installment did not clear. Evidence, never a guess — which is why
 *  it always renders the reason AND what was said. */
export function FailNote({ reason, note, at, attempt }: { reason: string; note: string; at: string; attempt: number }) {
  const m = failureMeta(reason);
  return (
    <div className="fin-fail">
      <span className="ty"><Icon name="alert" size="sm" />{m?.label || reason}</span>
      <span className="tx">{note}</span>
      <span className="wn">{attempt > 0 ? "attempt " + attempt + " · " : ""}{ago(at)}</span>
    </div>
  );
}

/* -------------------------------------------------------------- notices --- */

export function Assumed({ id, children }: { id: string; children?: ReactNode }) {
  const d = decision(id);
  return (
    <p className="fin-assumed">
      <Icon name="alert" size="sm" />
      <span><b className="mono">{id}</b> {children || (d ? d.position : null)}</span>
    </p>
  );
}
export function Unavailable({ title, why }: { title: ReactNode; why: ReactNode }) {
  return (
    <div className="fin-unavailable">
      <Icon name="alert" />
      <div><b>{title}</b><p>{why}</p></div>
    </div>
  );
}

/* ---------------------------------------------------------------- chain --- */

/** Deal → Invoice → this installment. Every link read-only from here; the
 *  deal and invoice cells open the live modules. */
export function Chain({ dealRef, invoice, installment, cap }: {
  dealRef?: string | null; invoice?: string | null; installment?: string; cap?: ReactNode;
}) {
  const seg = (k: string, v: ReactNode, to?: string | null) => (
    <div className="seg">
      <span className="k">{k}</span>
      {to ? <a className="v mono" data-go={to} onClick={() => go(to)}>{v} <Icon name="ext" size="sm" /></a> : <span className="v mono">{v}</span>}
    </div>
  );
  return (
    <div className="fin-chain">
      {seg("Deal", dealRef || "—", dealRef ? "#/deals/" + dealRef : null)}
      <span className="arw">→</span>
      {seg("Invoice", invoice || "—", invoice ? "#/invoices?q=" + invoice : null)}
      <span className="arw">→</span>
      {seg("This installment", installment || "—")}
      {cap ? <div className="seg cap">{cap}</div> : null}
    </div>
  );
}

/* --------------------------------------------------------------- events --- */

export function EventRow({ e }: { e: FinEvent }) {
  const m = eventMeta(e.type);
  return (
    <div className="fin-ev">
      <span className={"ty" + (m?.tone ? " " + m.tone : "")} title={e.type}>{m?.label || e.type}</span>
      <span className="tx">{e.note || "—"}</span>
      <span className="wh">{e.actor} · {e.actorRole}</span>
      <span className="wn" title={e.at}>{ago(e.at)}</span>
    </div>
  );
}
export function EventList({ events }: { events: FinEvent[] }) {
  if (!events.length) return <p className="fin-fine">Nothing has happened here yet.</p>;
  return <div className="fin-evlist">{events.map((e) => <EventRow key={e.eventId} e={e} />)}</div>;
}

/** A yes/no line in a dialog: the facts the decision rests on, stated before
 *  the button is pressed. */
export function Check({ ok, warn, children }: { ok?: boolean; warn?: boolean; children: ReactNode }) {
  return (
    <div className={"fin-chk " + (warn ? "warn" : ok ? "ok" : "bad")}>
      <span className="m">{warn ? "!" : ok ? "✓" : "✕"}</span>
      <div>{children}</div>
    </div>
  );
}

/** Spent against budget. Warns at 90% and NEVER blocks — rent still has to be
 *  paid in a month the budget was set too low. */
export function BudgetBar({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="faint">no budget</span>;
  return (
    <span className="fin-bud-wrap">
      <span className={"fin-bud" + (pct >= 100 ? " over" : pct >= 90 ? " near" : "")}><i style={{ width: Math.min(pct, 100) + "%" }} /></span>
      <span className={"tnum" + (pct >= 100 ? " bad" : pct >= 90 ? " warn" : "")}>{pct}%</span>
    </span>
  );
}

/** The installment strip on a subscription row — the schedule at a glance,
 *  one cell per installment, in order. */
export function InstStrip({ items, onPick }: {
  items: { seq: number; status: string; label?: string }[];
  onPick?: (seq: number) => void;
}) {
  return (
    <span className="fin-strip" role="list">
      {items.map((i) => (
        <span key={i.seq} role="listitem" className={"c s-" + i.status}
          title={(i.label ? i.label + " · " : "") + (instStatusMeta(i.status)?.label || i.status)}
          onClick={onPick ? () => onPick(i.seq) : undefined}>{i.seq}</span>
      ))}
    </span>
  );
}
