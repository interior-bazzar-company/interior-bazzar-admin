/* =============================================================================
   Other Transaction — one record.
   -----------------------------------------------------------------------------
   A row is a fact: it exists because money moved, once, on `valueDate`. There
   is nothing here to edit — POSTED IS PERMANENT — so this screen has no form,
   only what happened and, when it applies, the counter-entry that corrected
   it. `Rec` from Frame.tsx supplies the id bar, the ProtoBar and Back; this
   file supplies only what a company transaction means.
   ============================================================================= */
import { useShell } from "../../shell/ShellContext";
import { can } from "../../shell/AdminShell";
import { EmptyState, Icon, KvList, Notice, Tabs, qs } from "../../ui";
import { go } from "../../ui/nav";
import { Block, Blocks, Rec } from "./Frame";
import { Dir, EventList, Money, ProtoBar, TagChip, TxnPill } from "./bits";
import { BillModal, ReverseTxnModal } from "./TxnModals";
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
  const openReverse = () => modal(<ReverseTxnModal txn={t} onClose={closeLayer} onDone={done} />);
  /* A counter-entry cannot itself be reversed, and an already-reversed row has
     nothing left to reverse — the store refuses both, so the button is not
     offered for either. That is a fact about the row, not a permission; the
     Super Admin gate below is the permission, and THAT one disables rather
     than hides. */
  const reversible = t.state === "recorded" && !t.reversesTxnId;

  return (
    <Rec id={t.txnId} back={back}
      pills={<TxnPill k={t.state} lg />}
      actions={writable ? (
        <>
          <button className="btn sm" onClick={openBill}><Icon name="invoice" size="sm" />Attach a bill</button>
          {reversible ? (
            <button className="btn sm dgr" disabled={!sa}
              title={sa ? undefined : "Reversing a transaction is Super Admin only."}
              onClick={openReverse}>
              <Icon name="recon" size="sm" />Reverse
            </button>
          ) : null}
        </>
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
          {t.reversesTxnId ? (
            <Notice tone="info" ico="recon" text={<>
              <b>This is a counter-entry.</b> It carries a negative amount and reverses{" "}
              <a className="mono" onClick={() => go("#/finance-transactions/" + encodeURIComponent(t.reversesTxnId as string) + qs(carry(p)))}>
                {t.reversesTxnId}
              </a>. That negative amount is the whole effect — nothing else about the original
              row was touched.
            </>} />
          ) : null}
          {t.reversal ? (
            <Notice tone="bad" ico="recon" text={<>
              <b>This row has been reversed.</b> {t.reversal.by} · {fmtDateTime(t.reversal.at)}{" — "}
              {t.reversal.reason} The counter-entry is{" "}
              <a className="mono" onClick={() => go("#/finance-transactions/" + encodeURIComponent(t.reversal!.counterId) + qs(carry(p)))}>
                {t.reversal.counterId}
              </a>. This row itself was never edited or removed.
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
                ["Party", t.party || "—"],
                ["Mode", t.mode],
                ["Reference", <span className="mono">{t.reference}</span>],
                ["Value date", <>{fmtDate(t.valueDate)} <span className="faint">({ago(t.valueDate)})</span></>],
                ["Account", account ? <>{account.masked}<span className="faint"> · {account.name}</span></> : t.accountId],
                ["Recorded by", <>{t.recordedBy} · {fmtDateTime(t.recordedAt)}</>],
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

            <Block title="Bill">
              {t.bill ? (
                <KvList pairs={[
                  ["File", <span className="mono">{t.bill.filename}</span>],
                  ["Type", t.bill.type],
                  ["Attached", fmtDateTime(t.bill.uploadedAt)],
                ]} />
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
            <b>A recorded row is never edited.</b> Nothing here can be changed after the fact —
            a correction is a new counter-entry with a negative amount, appended to the ledger,
            never a rewrite of this one.
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
