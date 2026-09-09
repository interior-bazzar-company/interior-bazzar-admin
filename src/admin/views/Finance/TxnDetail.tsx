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
import type { ReactNode } from "react";
import { useShell } from "../../shell/ShellContext";
import { can } from "../../shell/AdminShell";
import { Alert, Button, Card, EmptyState, Icon, KvList, Tabs, qs } from "../../ui";
import { go } from "../../ui/nav";
import { Blocks, Rec } from "./Frame";
import { Dir, EventList, Fine, Money, ProtoBar, TagChip, TxnMenu, TxnPill } from "./bits";
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
      <div className="flex min-w-0 flex-col gap-4">
        <ProtoBar />
        <EmptyState icon="search" title="No transaction at that address"
          body={<>There is no record for <span className="font-mono tnum">{id}</span>.</>}
          action={<Button color="primary" onClick={() => go(back)}>Back to transactions</Button>} />
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
      pills={<><TxnPill k={t.state} lg /><TagChip k={t.tagKey} /></>}
      sub={<>{fmtDate(t.valueDate)} · {ago(t.valueDate)} · {t.description}</>}
      actions={writable ? (
        /* ONE MENU, NOT A ROW OF BUTTONS. The header carried Attach a bill
           and Reverse side by side, which gave a destructive Super-Admin
           action the same weight as attaching paperwork, and had nowhere to
           put a third. Everything the row can have done to it is behind the
           one control now, in the order somebody reaches for them. */
        <TxnMenu txn={t} sa={sa} onCancel={openCancel} onCopied={(m) => toast(m, "ok")} />
      ) : null}>

      {/* `tab` here is TxnDetail's own — Transaction / History — a different
         axis from the list's Transactions / Tags tab, even though both
         travel in the same URL key. */}
      <Tabs items={[
        { k: "transaction", label: "Transaction" },
        { k: "history", label: "History", n: t.events.length, quiet: true },
      ]} cur={tab} onPick={(k) => onParams({ tab: k === "transaction" ? undefined : k })} />

      {tab === "transaction" ? (
        <div className="flex min-w-0 flex-col gap-4">
          {/* THE FIGURES BELOW STILL STAND AND NO LONGER COUNT, which is a
              distinction somebody about to act on them has to be given before
              they read a single one. */}
          {t.cancellation ? (
            <Alert tone="bad" ico="recon" title="This row has been cancelled.">
              {t.cancellation.by} · {fmtDateTime(t.cancellation.at)}
              {" — "}{t.cancellation.reason} <b>Everything below is exactly as posted</b> — nothing on
              the row was edited and nothing was deleted — but it counts towards nothing: it is out
              of the period&rsquo;s figures, out of its tag&rsquo;s total, and out of everything
              derived from them. The correct payment, if there was one, is its own row.
            </Alert>
          ) : null}

          <Blocks>
            <Card title="What moved">
              <KvList pairs={[
                ["Amount", <Money paise={t.amountPaise} sign={t.direction === "in"} strong />],
                ["Direction", <Dir d={t.direction} />],
                ["Tag", <>
                  <TagChip k={t.tagKey} big />
                  {kind ? <Fine className="mt-1">{kind.label} · lands in {kind.landsIn}</Fine> : null}
                </>],
                /* THE REMARK, which the record page did not show at all. It is
                   the sentence somebody wrote to make this row make sense to a
                   stranger, and it was collected on the dialog and then only
                   ever readable in the list's own truncated column. */
                ["Remark", t.description
                  ? <span className="[overflow-wrap:anywhere]">{t.description}</span>
                  : <span className="text-quaternary">—</span>],
                ["Party", t.party || "—"],
                ["Mode", t.mode],
                ["Reference", <span className="font-mono tnum">{t.reference}</span>],
                ["Value date", <>{fmtDate(t.valueDate)} <span className="text-quaternary">({ago(t.valueDate)})</span></>],
                ["Account", account ? <>{account.masked}<span className="text-quaternary"> · {account.name}</span></> : t.accountId],
                ["Recorded by", <>{t.recordedBy} · {fmtDateTime(t.recordedAt)}</>],
                ...(t.cancellation
                  ? [["Cancelled by", <>{t.cancellation.by} · {fmtDateTime(t.cancellation.at)}</>] as [ReactNode, ReactNode]]
                  : []),
                ...(t.direction === "in"
                  ? [["Credit kind", <>
                      {creditKind?.label || t.creditKind}
                      <Fine className="mt-1">Non-revenue. Customer money has exactly one way in — a subscription.</Fine>
                    </>] as [ReactNode, ReactNode]]
                  : []),
                ...(t.bankLineId
                  ? [["Matched to bank", <span className="font-mono tnum">{t.bankLineId}</span>] as [ReactNode, ReactNode]]
                  : []),
              ]} />
            </Card>

            <Card title="Receipt">
              {t.bill ? (
                /* THE FILE, AS A FILE. It was three rows of a key-value list,
                   which is the right shape for facts about the money and the
                   wrong one for a document: what somebody wants here is to
                   see that it is there and to open it. */
                <>
                  <div className="flex items-center gap-3 rounded-lg bg-secondary px-3 py-2.5 ring-1 ring-secondary ring-inset">
                    <Icon name="invoice" size="md" className="shrink-0 text-fg-quaternary" />
                    <span className="flex min-w-0 flex-col">
                      <b className="truncate font-mono text-sm font-medium text-primary">{t.bill.filename}</b>
                      <span className="truncate text-xs text-tertiary">{t.bill.type} · attached {fmtDateTime(t.bill.uploadedAt)}</span>
                    </span>
                  </div>
                  {/* NO FILE BEHIND THE NAME YET, and the page says so rather
                      than offering a download that would do nothing. The
                      filename is the whole record a receipt exists until
                      there is somewhere to put the bytes. */}
                  <Fine className="mt-3">
                    The panel holds the name, not the file. Download arrives with the document
                    store — until then this is the record that a receipt exists.
                  </Fine>
                </>
              ) : row.missingBill ? (
                <Alert tone="warn" title="No bill attached.">
                  {tag?.proofRequired
                    ? <>{tag.label} always requires one.</>
                    : <>This crossed {inr(BILL_THRESHOLD_PAISE)}, above which a bill is required.</>}{" "}
                  The period this row falls in cannot close while it is missing.
                </Alert>
              ) : (
                <Fine>Not required — under {inr(BILL_THRESHOLD_PAISE)} and {tag?.label || "this tag"} does not demand one on every row.</Fine>
              )}
            </Card>
          </Blocks>

          <Alert tone="info" ico="lock" title="A recorded row is never edited or deleted.">
            Nothing here can be changed after the fact. A row that should not stand is cancelled —
            in the actions menu, Super Admin, with a reason — which leaves every figure on it
            exactly as posted and stops it counting. The correct figures are a new row, recorded
            the ordinary way.
          </Alert>
        </div>
      ) : (
        <Card title="History" sub="append-only">
          <EventList events={t.events} />
        </Card>
      )}
    </Rec>
  );
}
