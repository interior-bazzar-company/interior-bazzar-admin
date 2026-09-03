/* =============================================================================
   Other Transaction — one record.
   -----------------------------------------------------------------------------
   A row is a fact: it exists because money moved, once, on `valueDate`. What
   it SAYS about that can be corrected — Update, behind the actions menu, is
   Super Admin and names every field it moves in the history — but nothing is
   ever deleted, and the timeline below holds every version this row has had.
   `Rec` from Frame.tsx supplies the id bar, the ProtoBar and Back; this file
   supplies only what a company transaction means.
   ============================================================================= */
import { useEffect, useRef, useState } from "react";
import { useShell } from "../../shell/ShellContext";
import { can } from "../../shell/AdminShell";
import { EmptyState, Icon, KvList, Notice, Tabs, qs } from "../../ui";
import { go } from "../../ui/nav";
import { Block, Blocks, Rec } from "./Frame";
import { Dir, EventList, Money, ProtoBar, TagChip } from "./bits";
import { BillModal, UpdateTxnModal } from "./TxnModals";
import {
  BILL_THRESHOLD_PAISE, CREDIT_KINDS,
  accountOf, ago, fmtDate, fmtDateTime, inr, isSuperAdmin, tagKindMeta, useTxn,
} from "./store";
import type { CompanyTxn, Params } from "./store";

/** The list's own filters, carried across the jump so Back is a return and
 *  not a reset. `tab` belongs to whichever screen is showing it — the list's
 *  Transactions/Tags tab here, this record's Transaction/History tab there —
 *  and means nothing on the other side, so it never travels. */
function carry(p: Params): Params {
  const o: Params = {};
  Object.keys(p).forEach((k) => { if (p[k] && k !== "tab") o[k] = p[k]; });
  return o;
}

/* ------------------------------------------------------- the actions --- */
/** EVERYTHING THE ROW CAN HAVE DONE TO IT, behind one control.
 *
 *  The header used to carry `Attach a bill` and `Reverse` side by side, which
 *  gave a destructive Super-Admin action the same weight as attaching
 *  paperwork and had nowhere to put a third.
 *
 *  EDIT IS THE RECEIPT, and the item says so rather than promising the
 *  figures. That is not a limitation of this menu — it is the module's central
 *  rule, printed at the foot of this very page: the amount, direction, tag,
 *  reference, date and account are what the row ASSERTS, and a correction to
 *  any of them goes through Update, which is Super Admin and writes what it
 *  changed into the history. A receipt is evidence ABOUT the row rather than
 *  part of what it says, which is why it has its own item.
 *
 *  Same `.fin-menu` and the same `.mi` rows the slips table uses — one menu in
 *  the module, not two that drift. */
function TxnMenu({ txn, sa, onEdit, onUpdate }: {
  txn: CompanyTxn; sa: boolean;
  onEdit: () => void; onUpdate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement | null>(null);
  const { toast } = useShell();

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
      onClick={() => { setOpen(false); act(); }}>
      <Icon name={icon} size="sm" />{label}
    </button>
  );

  return (
    <span className="fin-menu" ref={box}>
      <button type="button" className="btn sm" aria-haspopup="menu" aria-expanded={open}
        aria-label={"Actions for " + txn.txnId} onClick={() => setOpen(!open)}>
        <Icon name="dots" size="sm" />
      </button>
      {open ? (
        <span className="fin-menu-pop" role="menu" aria-label={"Actions for " + txn.txnId}>
          {item("invoice", txn.bill ? "Edit receipt" : "Attach receipt", onEdit)}
          {/* DISABLED, ALWAYS, AND IT SAYS WHY. The panel holds a filename and
              not the bytes, so a download would produce nothing — and an item
              that silently does nothing is worse than one that explains. It is
              shown rather than hidden because somebody who cannot see the
              action cannot ask for it either. */}
          {item("download", "Download receipt", () => {}, {
            disabled: true,
            title: txn.bill
              ? "The panel holds the file's name, not the file. Download arrives with the document store."
              : "There is no receipt on this row yet.",
          })}
          {/* THE WAY A WRONG ROW IS PUT RIGHT, and the only way. It opens the
              same form the row was recorded on, and every field that moves is
              written into the history — so the row says what is true now and
              the timeline says what it ever said. Disabled rather than hidden
              without Super Admin: somebody who cannot see the action cannot
              ask for it either. */}
          {item("recon", "Update", onUpdate, {
            disabled: !sa,
            title: sa
              ? "Correct what this row says. Every field that moves is named in the history."
              : "Updating a transaction is Super Admin only.",
          })}
          {/* `link` rather than a copy glyph, because the icon set has no copy
             and inventing one for a menu item is a new SVG to maintain for a
             convenience. */}
          {item("link", "Copy row id", () => {
            void navigator?.clipboard?.writeText?.(txn.txnId);
            toast(txn.txnId + " copied.", "ok");
          })}
        </span>
      ) : null}
    </span>
  );
}

export default function TxnDetail({ id, p, onParams }: {
  id: string; p: Params; onParams: (patch: Params) => void;
}) {
  const row = useTxn(id);
  const writable = can("finance-transactions", "edit");
  const sa = isSuperAdmin();
  const { toast, modal, closeLayer } = useShell();
  const tab = p.tab === "history" ? "history" : "transaction";
  const back = "#/finance-transactions" + qs(carry(p));

  if (!row) {
    return (
      <div className="fin-rec">
        <ProtoBar />
        <EmptyState icon="search" title="No transaction at that address"
          body={<>There is no record for <span className="mono">{id}</span>.</>}
          action={<button className="btn pri" onClick={() => go(back)}>Back to transactions</button>} />
      </div>
    );
  }

  const t = row.t;
  const tag = row.tag;
  const kind = tag ? tagKindMeta(tag.kind) : null;
  const account = accountOf(t.accountId);
  const creditKind = t.creditKind ? CREDIT_KINDS.filter((c) => c.key === t.creditKind)[0] : null;

  const done = (msg: string, tone?: string) => { closeLayer(); toast(msg, tone); };
  const openBill = () => modal(<BillModal txn={t} onClose={closeLayer} onDone={done} />);
  const openUpdate = () => modal(<UpdateTxnModal txn={t} onClose={closeLayer} onDone={done} />);

  return (
    <Rec id={t.txnId} back={back}
      actions={writable ? (
        /* ONE MENU, NOT A ROW OF BUTTONS. The header carried Attach a bill
           and Reverse side by side, which gave a destructive Super-Admin
           action the same weight as attaching paperwork, and had nowhere to
           put a third. Everything the row can have done to it is behind the
           one control now, in the order somebody reaches for them. */
        <TxnMenu txn={t} sa={sa} onEdit={openBill} onUpdate={openUpdate} />
      ) : null}>

      <div className="fin-subline">
        <TagChip k={t.tagKey} />
        <span>·</span>
        <span>{fmtDate(t.valueDate)} · {ago(t.valueDate)}</span>
      </div>

      {/* `tab` here is TxnDetail's own — Transaction / History — a different
         axis from the list's Transactions / Tags tab, even though both
         travel in the same URL key. */}
      <Tabs items={[
        { k: "transaction", label: "Transaction" },
        { k: "history", label: "History", n: t.events.length },
      ]} cur={tab} onPick={(k) => onParams({ tab: k === "transaction" ? undefined : k })} />

      {tab === "transaction" ? (
        <div className="fin-cards">
          {/* THE FIGURES ABOVE ARE NOT THE ONES FIRST POSTED, and somebody
              reading them deserves to know that before they act on them. It
              points at History rather than restating the diff, because the
              diff is already there in full and copying it here would give two
              accounts of the same edit to keep in step. */}
          {t.updatedBy ? (
            <Notice tone="info" ico="recon" text={<>
              <b>This row has been updated.</b> {t.updatedBy} · {fmtDateTime(t.updatedAt)}. What it
              says below is what is true now; <b>History</b> names every field that has moved on it
              and what it moved from. Nothing was deleted to get here.
            </>} />
          ) : null}

          <Blocks>
            <Block title="What moved">
              <KvList pairs={[
                ["Amount", <Money paise={t.amountPaise} sign={t.direction === "in"} strong />],
                ["Direction", <Dir d={t.direction} />],
                ["Tag", <>
                  <TagChip k={t.tagKey} big />
                  {kind ? <div className="fin-fine">{kind.label} · lands in {kind.landsIn}</div> : null}
                </>],
                /* THE REMARK, which the record page did not show at all. It is
                   the sentence somebody wrote to make this row make sense to a
                   stranger, and it was collected on the dialog and then only
                   ever readable in the list's own truncated column. */
                ["Remark", t.description
                  ? <span className="fin-remark">{t.description}</span>
                  : <span className="faint">—</span>],
                ["Party", t.party || "—"],
                ["Mode", t.mode],
                ["Reference", <span className="mono">{t.reference}</span>],
                ["Value date", <>{fmtDate(t.valueDate)} <span className="faint">({ago(t.valueDate)})</span></>],
                ["Account", account ? <>{account.masked}<span className="faint"> · {account.name}</span></> : t.accountId],
                ["Recorded by", <>{t.recordedBy} · {fmtDateTime(t.recordedAt)}</>],
                ...(t.updatedBy
                  ? [["Updated by", <>{t.updatedBy} · {fmtDateTime(t.updatedAt)}</>] as [string, React.ReactNode]]
                  : []),
                ...(t.direction === "in"
                  ? [["Credit kind", <>
                      {creditKind?.label || t.creditKind}
                      <div className="fin-fine">Non-revenue. Customer money has exactly one way in — a subscription.</div>
                    </>] as [string, React.ReactNode]]
                  : []),
                ...(t.bankLineId
                  ? [["Matched to bank", <span className="mono">{t.bankLineId}</span>] as [string, React.ReactNode]]
                  : []),
              ]} />
            </Block>

            <Block title="Receipt">
              {t.bill ? (
                /* THE FILE, AS A FILE. It was three rows of a key-value list,
                   which is the right shape for facts about the money and the
                   wrong one for a document: what somebody wants here is to
                   see that it is there and to open it. */
                <>
                  <div className="fin-receipt">
                    <span className="ic"><Icon name="invoice" /></span>
                    <span className="meta">
                      <b className="mono">{t.bill.filename}</b>
                      <span className="s">{t.bill.type} · attached {fmtDateTime(t.bill.uploadedAt)}</span>
                    </span>
                  </div>
                  {/* NO FILE BEHIND THE NAME YET, and the page says so rather
                      than offering a download that would do nothing. The
                      filename is the whole record a receipt exists until
                      there is somewhere to put the bytes. */}
                  <p className="fin-fine">
                    The panel holds the name, not the file. Download arrives with the document
                    store — until then this is the record that a receipt exists.
                  </p>
                </>
              ) : row.missingBill ? (
                <Notice tone="warn" text={<>
                  <b>No bill attached.</b>{" "}
                  {tag?.proofRequired
                    ? <>{tag.label} always requires one.</>
                    : <>This crossed {inr(BILL_THRESHOLD_PAISE)}, above which a bill is required.</>}{" "}
                  The period this row falls in cannot close while it is missing.
                </>} />
              ) : (
                <p className="fin-fine">Not required — under {inr(BILL_THRESHOLD_PAISE)} and {tag?.label || "this tag"} does not demand one on every row.</p>
              )}
            </Block>
          </Blocks>

          <Notice tone="info" ico="lock" text={<>
            <b>Nothing here is ever deleted.</b> A row can be corrected — Update, in the actions
            menu, is Super Admin — and every field it moves is written into this record's history
            with what it moved from. The row shows the current truth; the timeline shows all of it.
          </>} />
        </div>
      ) : (
        <Block title="History" desc="append-only">
          <EventList events={t.events} />
        </Block>
      )}
    </Rec>
  );
}
