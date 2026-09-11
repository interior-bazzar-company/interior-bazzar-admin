/* =============================================================================
   Finance — the vocabulary this module owns, as components.
   -----------------------------------------------------------------------------
   Pills, tags, tables, cards, alerts and the stat strip are the shared layer's.
   What lives here is only what FINANCE means by them: which tone an installment
   status wears, what a bank statement calls a direction, how a schedule of five
   installments is drawn in one cell, and how a chain of three documents reads
   on one line.

   Every drawing is Tailwind utilities on the semantic tokens — no stylesheet,
   no colour literal, no second Button/Badge/Menu. Where the shared layer has a
   part, it is used; where it does not, the drawing is a component in this file
   and nowhere else.
   ============================================================================= */
import { Fragment } from "react";
import type { ReactNode } from "react";
import { cx } from "@/utils/cx";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { Alert, Button, EmptyState, FileUpload, Icon, KvList, Meter, MoreMenu, Pill, Tag, Timeline } from "../../ui";
import { iconOf } from "../../ui/icon";
import { go } from "../../ui/nav";
import {
  ago, decision, eventMeta, failureMeta, inr, instStatusMeta, originMeta, refundStateMeta,
  runStateMeta, sourceMeta, subStatusMeta, tagKindMeta, tagOf, txnStateMeta,
} from "./store";
import type { CompanyTxn, FinEvent } from "./store";

/* ---------------------------------------------------------- ActionMenu --- */
/** ONE MENU FOR THE WHOLE MODULE, and it is the panel's own `MoreMenu` — a
 *  React Aria Dropdown, portalled, keyboard-complete, dismissed by the library
 *  on outside press, Escape and scroll. Three hand-rolled copies of that lived
 *  in this module, each with its own outside-click listener and its own
 *  absolutely-positioned popup that any scrolling table clipped.
 *
 *  ITEMS ARE DATA, not children, so a caller cannot put something in a menu
 *  that is not a menu item, and the destructive one is separated in one place
 *  rather than per caller.
 *
 *  IT STOPS ITS OWN CLICKS. On a table row the whole row is a link, so a press
 *  on the trigger would navigate out from under the menu it just opened. */
export interface MenuItem {
  icon: string;
  label: string;
  act: () => void;
  disabled?: boolean;
  title?: string;
  /** `dgr` for the destructive one, `pri` for the expected one. */
  tone?: string;
}
export function ActionMenu({ label, forWhat, items }: {
  /** The trigger's text. It said nothing at all for a while and was three dots
   *  instead — a convention somebody either holds or does not, sitting in a
   *  column with no header to read it against. */
  label?: string;
  /** The record this menu acts on, for the accessible name: a screen reader
   *  meeting the twentieth `Actions` on a page needs to know whose it is. */
  forWhat: string;
  items: (MenuItem | null | false | undefined)[];
}) {
  const shown = items.filter(Boolean) as MenuItem[];
  return (
    <span
      className="inline-flex"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <MoreMenu
        small
        align="right"
        items={shown}
        label={<>{label || "Actions"}<span className="sr-only"> for {forWhat}</span></>}
      />
    </span>
  );
}

/* ------------------------------------------------------------- TxnMenu --- */
/** EVERYTHING A POSTED ROW CAN HAVE DONE TO IT, and the same menu wherever the
 *  row appears — the ledger and the record.
 *
 *  THERE IS NO EDIT ON IT. Nothing rewrites what a row says: a row that asserts
 *  the wrong thing is CANCELLED with a reason and recorded again correctly. */
export function TxnMenu({ txn, sa, onCancel, onOpen, onCopied }: {
  txn: CompanyTxn; sa: boolean;
  onCancel: () => void;
  /** Given on the list, where the record is somewhere to go. Omitted on the
   *  record itself, where it would offer to open the page it is already on. */
  onOpen?: () => void;
  onCopied: (msg: string) => void;
}) {
  const cancelled = txn.state === "cancelled";
  return (
    <ActionMenu forWhat={txn.txnId} items={[
      onOpen && { icon: "invoice", label: "Open the record", act: onOpen },
      /* DISABLED, ALWAYS, AND IT SAYS WHY. The panel holds a filename and not
         the bytes, so a download would produce nothing — and an item that
         silently does nothing is worse than one that explains. */
      { icon: "download", label: "Download receipt", act: () => {}, disabled: true,
        title: txn.bill
          ? "The panel holds the file's name, not the file. Download arrives with the document store."
          : "There is no receipt on this row." },
      /* THE ONE THING THAT CHANGES A POSTED ROW, and it changes only its
         standing: every figure stays as posted and the row stays in the ledger. */
      { icon: "recon", label: "Cancel", act: onCancel, tone: "dgr",
        disabled: !sa || cancelled,
        title: cancelled
          ? "It is already cancelled."
          : sa
            ? "Write this row off with a reason. It keeps every figure it was posted with and stops counting."
            : "Cancelling a transaction is Super Admin only." },
      { icon: "copy", label: "Copy row id", act: () => {
        void navigator?.clipboard?.writeText?.(txn.txnId);
        onCopied(txn.txnId + " copied.");
      } },
    ]} />
  );
}

/* -------------------------------------------------------------- notices --- */

/** Deliberately loud, never dismissible — and now the panel's own Alert, so
 *  the sentence that says "none of this is live" is drawn the same way as
 *  every other condition a page states about itself. */
export function ProtoBar({ onReset }: { onReset?: () => void }) {
  return (
    <Alert
      tone="info"
      className="text-xs"
      action={onReset && import.meta.env.DEV
        ? <Button color="secondary" size="xs" onClick={onReset}>Reset</Button>
        : undefined}
    >
      <b className="font-semibold text-primary">Nothing here is live.</b> Records come from{" "}
      <span className="font-mono">src/content/finance/</span> and every action writes to this tab
      only. Team members and invoices are read from the live modules; the chain links open them.
    </Alert>
  );
}

/* ---------------------------------------------------------------- pills --- */
/* Every state in this module is the panel's ONE Pill, wearing the tone the
   store's own vocabulary assigns it. The five names below survive because a
   caller should not have to know which vocabulary list a key belongs to. */

/** An installment's status. `fail_to_pay` is the one that matters: it says
 *  something happened, and the record carries what. */
export function InstPill({ k, lg }: { k: string; lg?: boolean }) {
  const m = instStatusMeta(k);
  return <Pill dot lg={lg} tone={m?.tone} text={m?.label || k} title={m?.meaning} />;
}
export function SubPill({ k, lg }: { k: string; lg?: boolean }) {
  const m = subStatusMeta(k);
  return <Pill dot lg={lg} tone={m?.tone} text={m?.label || k} title={m?.meaning} />;
}
export function RunPill({ k, lg }: { k: string; lg?: boolean }) {
  const m = runStateMeta(k);
  return <Pill dot lg={lg} tone={m?.tone} text={m?.label || k} title={m?.meaning} />;
}
export function TxnPill({ k, lg }: { k: string; lg?: boolean }) {
  const m = txnStateMeta(k);
  return <Pill dot lg={lg} tone={m?.tone} text={m?.label || k} title={m?.meaning} />;
}
export function RefundPill({ k, lg }: { k: string; lg?: boolean }) {
  const m = refundStateMeta(k);
  return <Pill dot lg={lg} tone={m?.tone} text={m?.label || k} />;
}

/* ----------------------------------------------------------------- tags --- */
/* A LABEL IS SQUARE AND A STATE IS ROUND. Where the sale came through, where a
   refund came from and what a transaction is filed under are all labels: the
   hue identifies, it never judges. */

/** Which door the sale came through — sales, or the website. */
export function SourceTag({ k }: { k: string }) {
  const m = sourceMeta(k);
  return <Tag label={m?.short || k} tone={k === "website" ? "cyan" : "indigo"} />;
}
export function OriginTag({ k }: { k: string }) {
  const m = originMeta(k);
  return (
    <span className="inline-flex items-center">
      <Tag label={k === "manual" ? "BY HAND" : "SUBSCRIPTION"} tone={k === "manual" ? "orange" : "slate"} />
      {m ? <span className="sr-only">{m.label}</span> : null}
    </span>
  );
}

/** The eleven hues are meaningless by contract, so a tag's KIND picks one only
 *  to keep the same kind the same colour across the module — never to say the
 *  money is good or bad. */
const KIND_TONE: Record<string, string> = {
  fixed: "slate", reinvestment: "indigo", variable: "teal", excluded: "orange",
};
/** The custom tag on a company transaction, wearing what it rolls up to. */
export function TagChip({ k, big }: { k: string; big?: boolean }) {
  const t = tagOf(k);
  const kind = t ? tagKindMeta(t.kind) : null;
  return (
    <span className="inline-flex items-center gap-1">
      <Tag
        label={t?.label || k}
        tone={KIND_TONE[t?.kind || ""] || "gray"}
        className={cx(big && "px-2 py-1 text-sm", t && !t.active && "opacity-60 line-through")}
      />
      {kind ? <span className="sr-only">{kind.label} — lands in {kind.landsIn}</span> : null}
      {t && !t.active ? <span className="text-xs text-quaternary">inactive</span> : null}
    </span>
  );
}

export function Role({ sa, children }: { sa?: boolean; children?: ReactNode }) {
  return <Pill xs tone={sa ? "sys" : "neutral"} text={children || (sa ? "Super Admin" : "Finance")} />;
}

/** THE BANK STATEMENT'S WORDS, not this module's own. A credit is money
 *  arriving and a debit is money leaving, which is what the two of them mean on
 *  every statement these rows are reconciled against. The STORED value is
 *  untouched: the ledger still holds `out` and `in`. */
export function Dir({ d }: { d: "in" | "out" }) {
  return <Pill xs tone={d === "out" ? "bad" : "ok"} text={d === "out" ? "Debit" : "Credit"} />;
}

/** Signed money. A figure is mono and tabular everywhere it appears. */
export function Money({ paise, sign, strong }: { paise: number; sign?: boolean; strong?: boolean }) {
  const neg = paise < 0;
  return (
    <span className={cx(
      "font-mono whitespace-nowrap tnum",
      neg ? "text-error-primary" : sign ? "text-success-primary" : "text-primary",
      strong && "font-semibold",
    )}>
      {neg ? "−" : sign ? "+" : ""}{inr(Math.abs(paise))}
    </span>
  );
}

/** Why an installment did not clear. Evidence, never a guess — which is why
 *  it always renders the reason AND what was said. */
export function FailNote({ reason, note, at, attempt }: { reason: string; note: string; at: string; attempt: number }) {
  const m = failureMeta(reason);
  return (
    <Alert tone="bad" title={m?.label || reason} className="text-xs">
      <span className="block">{note}</span>
      <span className="mt-1 block text-xs text-quaternary tnum">
        {attempt > 0 ? "attempt " + attempt + " · " : ""}{ago(at)}
      </span>
    </Alert>
  );
}

/** An open decision from the module's own vocabulary, stated where the figure
 *  it qualifies is. */
export function Assumed({ id, children }: { id: string; children?: ReactNode }) {
  const d = decision(id);
  return (
    <Alert tone="info" className="text-xs">
      <b className="font-mono font-semibold text-primary">{id}</b> {children || (d ? d.position : null)}
    </Alert>
  );
}

/** A figure that cannot be computed, and the reason — never a zero, never a
 *  blank chart. */
export function Unavailable({ title, why }: { title: ReactNode; why: ReactNode }) {
  return <EmptyState flat icon="alert" title={title} body={why} />;
}

/* ---------------------------------------------------------------- chain --- */

/** Deal → Invoice → this installment. Every link read-only from here; the deal
 *  and invoice cells open the live modules. Same bones as the panel's own
 *  `ChainStrip`, restated for the three links Finance knows about. */
export function Chain({ dealRef, invoice, installment, cap }: {
  dealRef?: string | null; invoice?: string | null; installment?: string; cap?: ReactNode;
}) {
  const cells: { k: string; v: ReactNode; to?: string | null }[] = [
    { k: "Deal", v: dealRef || "—", to: dealRef ? "#/deals/" + dealRef : null },
    { k: "Invoice", v: invoice || "—", to: invoice ? "#/invoices?q=" + invoice : null },
    { k: "This installment", v: installment || "—" },
  ];
  return (
    <div className="flex items-stretch gap-1 overflow-x-auto rounded-xl bg-primary p-1.5 ring-1 ring-secondary scrollbar-hide">
      {cells.map((c, i) => {
        const cls = cx(
          "flex min-w-40 flex-1 flex-col gap-1 rounded-lg px-3 py-2 text-left transition duration-100",
          c.to && "cursor-pointer outline-focus-ring hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-offset-2",
        );
        const body = (
          <>
            <span className="label-mono">{c.k}</span>
            <span className="flex items-center gap-1.5 truncate font-mono text-sm font-medium text-primary tnum">
              {c.v}
              {c.to ? <Icon name="ext" size="xs" className="text-fg-quaternary" /> : null}
            </span>
          </>
        );
        return (
          <Fragment key={c.k}>
            {i ? (
              <span className="flex shrink-0 items-center text-fg-quaternary" aria-hidden="true">
                <Icon name="chevr" size="sm" />
              </span>
            ) : null}
            {c.to ? (
              <a className={cls} href={c.to} data-go={c.to} onClick={(e) => { e.preventDefault(); go(c.to as string); }}>
                {body}
              </a>
            ) : (
              <div className={cls}>{body}</div>
            )}
          </Fragment>
        );
      })}
      {cap ? (
        <div className="flex shrink-0 flex-col gap-1 rounded-lg bg-secondary px-3 py-2 text-left">{cap}</div>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- events --- */

/** One entry of a record's history, as the panel's Timeline knows it. */
const timelineItem = (e: FinEvent) => {
  const m = eventMeta(e.type);
  const tone = m?.tone;
  return {
    title: m?.label || e.type,
    body: e.note || "—",
    meta: <>{e.actor} · {e.actorRole} · {ago(e.at)}</>,
    tone: (tone === "ok" || tone === "bad" || tone === "warn" || tone === "info" ? tone : "sys") as
      "sys" | "bad" | "ok" | "warn" | "info",
  };
};

export function EventRow({ e }: { e: FinEvent }) {
  return <Timeline items={[timelineItem(e)]} />;
}
export function EventList({ events }: { events: FinEvent[] }) {
  if (!events.length) {
    return <EmptyState flat icon="history" title="Nothing has happened here yet" body="Every write on this record lands in this list, newest first." />;
  }
  return <Timeline items={events.map(timelineItem)} />;
}

/* ------------------------------------------------------------- decisions --- */

/** A yes/no line in a dialog: the facts the decision rests on, stated before
 *  the button is pressed. Not a status pill — a pill is what the SYSTEM says
 *  about a record, and this is what is true about an action nobody has taken. */
export function Check({ ok, warn, children }: { ok?: boolean; warn?: boolean; children: ReactNode }) {
  const tone = warn ? "warn" : ok ? "ok" : "bad";
  return (
    <div className="flex items-start gap-2.5 py-1.5 text-sm text-secondary">
      <Icon
        name={warn ? "alert" : ok ? "checkcircle" : "xcircle"}
        size="sm"
        className={cx(
          "mt-0.5 shrink-0",
          tone === "warn" ? "text-fg-warning-primary" : tone === "ok" ? "text-fg-success-primary" : "text-fg-error-primary",
        )}
      />
      <div className="min-w-0 flex-1 [&_b]:font-semibold [&_b]:text-primary">{children}</div>
    </div>
  );
}

/** Spent against budget. Warns at 90% and NEVER blocks — rent still has to be
 *  paid in a month the budget was set too low. */
export function BudgetBar({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-quaternary">no budget</span>;
  const tone = pct >= 100 ? "bad" : pct >= 90 ? "warn" : "ok";
  return (
    <span className="flex min-w-24 items-center gap-2">
      <Meter value={Math.min(pct, 100)} tone={tone} label={pct + "% of budget"} className="w-16" />
      <span className={cx(
        "text-xs font-medium tnum",
        pct >= 100 ? "text-error-primary" : pct >= 90 ? "text-warning-primary" : "text-tertiary",
      )}>{pct}%</span>
    </span>
  );
}

/* -------------------------------------------------------------- schedule --- */

const CELL_TONE: Record<string, string> = {
  paid: "bg-utility-green-50 text-utility-green-700 ring-utility-green-200",
  due: "bg-secondary text-tertiary ring-secondary",
  fail_to_pay: "bg-utility-red-50 text-utility-red-700 ring-utility-red-200",
  cancelled: "bg-secondary text-quaternary ring-secondary line-through",
};

/** THE INSTALLMENT STRIP — the schedule at a glance, one cell per installment,
 *  in order. A bar reading "60%" would hide which two failed, and the whole
 *  reason this column exists rather than a progress bar is that somebody has
 *  to act on ONE of them. */
export function InstStrip({ items, onPick }: {
  items: { seq: number; status: string; label?: string }[];
  onPick?: (seq: number) => void;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1" role="list">
      {items.map((i) => {
        const cls = cx(
          "flex size-5 items-center justify-center rounded-[4px] text-2xs font-semibold ring-1 ring-inset tnum",
          CELL_TONE[i.status] || CELL_TONE.due,
          onPick && "cursor-pointer outline-focus-ring hover:ring-2 focus-visible:outline-2",
        );
        const label = (i.label ? i.label + " · " : "") + (instStatusMeta(i.status)?.label || i.status);
        return onPick ? (
          <button key={i.seq} type="button" role="listitem" className={cls} aria-label={label} onClick={() => onPick(i.seq)}>
            {i.seq}
          </button>
        ) : (
          <span key={i.seq} role="listitem" className={cls} aria-label={label}>
            {i.seq}
          </span>
        );
      })}
    </span>
  );
}

/* ---------------------------------------------------------------- prose --- */

/** THE MODULE'S SMALL PRINT. A sentence that qualifies the control above it —
 *  the one drawing, so a caution never arrives at three different sizes. */
export function Fine({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("text-xs leading-relaxed text-tertiary", className)}>{children}</p>;
}

/* --------------------------------------------------------------- ledger --- */

/** ONE LINE OF ARITHMETIC: what it is on the left, the figure on the right.
 *  `grand` sets the closing figure apart with a rule rather than a colour, so
 *  a total is never mistaken for a judgement. */
export function LedgerRow({ label, children, grand, note }: {
  label: ReactNode; children: ReactNode; grand?: boolean; note?: ReactNode;
}) {
  return (
    <div className={cx(
      "flex items-baseline justify-between gap-4",
      grand
        ? "mt-1 border-t border-secondary pt-2.5 text-sm font-semibold text-primary"
        : "py-1.5 text-sm text-secondary",
    )}>
      <span className="min-w-0">
        {label}
        {note ? <span className="text-quaternary"> {note}</span> : null}
      </span>
      <span className="shrink-0 font-mono whitespace-nowrap tnum">{children}</span>
    </div>
  );
}

/** THE BLOCK THOSE LINES STAND IN — a well, so a stated total reads as a
 *  read-out rather than as more of the form above it. */
export function Ledger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col rounded-lg bg-secondary px-3.5 py-2.5 ring-1 ring-secondary ring-inset", className)}>
      {children}
    </div>
  );
}

/* --------------------------------------------------------------- picker --- */

/** A LIST OF RECORDS SOMEBODY PICKS ONE OF — a business, a quotation, a
 *  payment. Not a `Select`: each row carries three facts and a figure, and a
 *  native option can hold one line of text. It scrolls at eight rows so a
 *  dialog cannot grow past the viewport. */
export function PickList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex max-h-64 flex-col gap-1 overflow-y-auto rounded-lg bg-secondary p-1 ring-1 ring-secondary ring-inset", className)} role="listbox">
      {children}
    </div>
  );
}

/** One row of that list: what it is, what it says, and what it is worth. */
export function PickRow({ id, sub, right, on, onPick }: {
  id: ReactNode; sub?: ReactNode; right?: ReactNode; on?: boolean; onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={!!on}
      onClick={onPick}
      className={cx(
        "flex w-full cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-left outline-focus-ring transition duration-100 focus-visible:outline-2 focus-visible:-outline-offset-2",
        on ? "bg-brand-primary ring-1 ring-brand ring-inset" : "hover:bg-primary_hover",
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className={cx("truncate text-sm font-medium", on ? "text-brand-secondary" : "text-primary")}>{id}</span>
        {sub ? <span className="truncate text-xs text-tertiary">{sub}</span> : null}
      </span>
      {right ? <span className="shrink-0 font-mono text-sm text-secondary tnum">{right}</span> : null}
    </button>
  );
}

/** THE RECORD THAT WAS PICKED, and the way to pick a different one. */
export function Picked({ name, sub, onChange }: { name: ReactNode; sub?: ReactNode; onChange?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-secondary px-3 py-2.5 ring-1 ring-secondary ring-inset">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-primary">{name}</span>
        {sub ? <span className="block truncate text-xs text-tertiary">{sub}</span> : null}
      </span>
      {onChange ? <Button color="link-color" size="sm" onClick={onChange}>Change</Button> : null}
    </div>
  );
}

/** A DOCUMENT, SUMMARISED — a quotation or an invoice, read rather than
 *  retyped: its number and standing on top, its facts underneath. */
export function DocCard({ number, pill, action, pairs }: {
  number: ReactNode; pill?: ReactNode; action?: ReactNode; pairs: [ReactNode, ReactNode][];
}) {
  return (
    <div className="flex flex-col rounded-lg bg-primary ring-1 ring-secondary">
      <div className="flex flex-wrap items-center gap-2 border-b border-secondary px-3 py-2">
        <span className="font-mono text-sm font-semibold text-primary tnum">{number}</span>
        {pill}
        <span className="flex-1" />
        {action}
      </div>
      <div className="px-3 py-2.5">
        <KvList cls="gap-y-1.5" pairs={pairs} />
      </div>
    </div>
  );
}

/** A VALUE THE FORM DERIVED rather than asked for — the same height as a field
 *  so a row of them does not stagger, and plainly not typeable. */
export function Derived({ children, faint }: { children: ReactNode; faint?: boolean }) {
  return (
    <div className={cx(
      "flex min-h-9 items-center rounded-lg bg-secondary px-3 py-1.5 text-sm ring-1 ring-secondary ring-inset",
      faint ? "text-quaternary" : "text-primary",
    )}>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------- receipt --- */

/** THE DIALOG AFTER THE WRITE WENT THROUGH. It stops being a form — the money
 *  has left, Cancel would be a lie — and becomes a receipt: the figure, who it
 *  went to, and the facts of the transfer. */
export function PaidReceipt({ amountPaise, to, facts, note }: {
  amountPaise: number; to: ReactNode; facts: [ReactNode, ReactNode][]; note?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <FeaturedIcon icon={iconOf("check")} color="success" theme="modern" size="lg" />
      <div className="font-mono text-display-xs font-semibold tracking-tight text-primary tnum">{inr(amountPaise)}</div>
      <div className="text-sm text-tertiary">{to}</div>
      <div className="mt-1 w-full">
        <Ledger>
          {facts.map((f, i) => (
            <LedgerRow key={i} label={f[0]}>{f[1]}</LedgerRow>
          ))}
        </Ledger>
      </div>
      {note ? <Fine className="text-center">{note}</Fine> : null}
    </div>
  );
}

/* ----------------------------------------------------------------- file --- */

/** THE ONE FILE CONTROL THIS MODULE HAS. A drop zone until something is
 *  chosen, then the file itself with a way to replace it — evidence is worth
 *  the same on a salary payment and on a company transaction, so it is drawn
 *  the same on both. */
export function ProofField({ file, accept, hint, onFile, onClear }: {
  file: { filename: string; bytes?: number } | null;
  accept?: string;
  hint?: ReactNode;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-primary px-3 py-2.5 ring-1 ring-secondary">
        <Icon name="filecheck" size="sm" className="shrink-0 text-fg-success-primary" />
        <span className="min-w-0 flex-1 truncate font-mono text-sm text-primary" title={file.filename}>{file.filename}</span>
        <Button color="link-color" size="sm" onClick={onClear}>Replace</Button>
      </div>
    );
  }
  return (
    <FileUpload
      accept={accept || "image/*,application/pdf"}
      hint={hint}
      onFiles={(files) => { if (files[0]) onFile(files[0]); }}
    />
  );
}
