/* =============================================================================
   Finance — the vocabulary this module owns, as components. Tiles, cards,
   tables, notices, pills and the stat strip all come from ui/ and
   admin-theme.css; what is here is only what Finance means by them.
   ============================================================================= */
import type { ReactNode } from "react";
import { Icon } from "../../ui";
import { go } from "../../ui/nav";
import {
  ago, decision, eventMeta, failureMeta, inr, instStatusMeta, originMeta, refundStateMeta,
  runStateMeta, sourceMeta, subStatusMeta, tagKindMeta, tagOf, txnStateMeta,
} from "./store";
import type { FinEvent } from "./store";

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
export function Dir({ d }: { d: "in" | "out" }) {
  return <span className={"fin-dir " + d}>{d === "out" ? "Out" : "In"}</span>;
}

/** Signed money: a negative row is a counter-entry and reads as one. */
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
