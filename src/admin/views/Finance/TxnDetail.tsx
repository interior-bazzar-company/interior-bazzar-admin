/* =============================================================================
   Other Transaction — one record.
   -----------------------------------------------------------------------------
   A row is a fact: it exists because money moved, once, on `valueDate`. There
   is nothing here to edit — POSTED IS PERMANENT — so this screen has no form,
   only what happened and, when it applies, the reason somebody wrote it off.
   A row that should not stand is CANCELLED and the correct one is recorded
   fresh; nothing is ever rewritten and nothing is ever deleted.
   `Rec` from Frame.tsx supplies the id bar, the ProtoBar and Back; this file
   supplies only what a company transaction means.
   ============================================================================= */
import { useShell } from "../../shell/ShellContext";
import { can } from "../../shell/AdminShell";
import { EmptyState, Icon, KvList, Notice, Tabs, qs } from "../../ui";
import { go } from "../../ui/nav";
import { Block, Blocks, Rec } from "./Frame";
import { Dir, EventList, Money, ProtoBar, TagChip, TxnMenu, TxnPill } from "./bits";
import { CancelTxnModal } from "./TxnModals";
import {
  BILL_THRESHOLD_PAISE, CREDIT_KINDS,
  accountOf, ago, fmtDate, fmtDateTime, inr, isSuperAdmin, tagKindMeta, useTxn,
} from "./store";
import type { Params } from "./store";

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
  const openCancel = () => modal(<CancelTxnModal txn={t} onClose={closeLayer} onDone={done} />);

  return (
    <Rec id={t.txnId} back={back}
      pills={<TxnPill k={t.state} lg />}
      actions={writable ? (
        /* ONE MENU, NOT A ROW OF BUTTONS. The header carried Attach a bill
           and Reverse side by side, which gave a destructive Super-Admin
           action the same weight as attaching paperwork, and had nowhere to
           put a third. Everything the row can have done to it is behind the
           one control now, in the order somebody reaches for them. */
        <TxnMenu txn={t} sa={sa} onCancel={openCancel} onCopied={(m) => toast(m, "ok")} />
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
          {/* THE FIGURES BELOW STILL STAND AND NO LONGER COUNT, which is a
              distinction somebody about to act on them has to be given before
              they read a single one. */}
          {t.cancellation ? (
            <Notice tone="bad" ico="recon" text={<>
              <b>This row has been cancelled.</b> {t.cancellation.by} · {fmtDateTime(t.cancellation.at)}
              {" — "}{t.cancellation.reason} <b>Everything below is exactly as posted</b> — nothing on
              the row was edited and nothing was deleted — but it counts towards nothing: it is out
              of the period&rsquo;s figures, out of its tag&rsquo;s total, and out of everything
              derived from them. The correct payment, if there was one, is its own row.
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
                ...(t.cancellation
                  ? [["Cancelled by", <>{t.cancellation.by} · {fmtDateTime(t.cancellation.at)}</>] as [string, React.ReactNode]]
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
            <b>A recorded row is never edited or deleted.</b> Nothing here can be changed after
            the fact. A row that should not stand is cancelled — in the actions menu, Super Admin,
            with a reason — which leaves every figure on it exactly as posted and stops it counting.
            The correct figures are a new row, recorded the ordinary way.
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
