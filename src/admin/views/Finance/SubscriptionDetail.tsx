/* =============================================================================
   Finance · one subscription.
   -----------------------------------------------------------------------------
     ?tab=schedule   what was sold, and every installment with what happened
     ?tab=receipt    the frozen receipt for one settled installment
     ?tab=history    every event on the record, newest first

   THE INSTALLMENT TABLE IS THE PAGE. Everything else is context for it: the
   chain says where the row came from, the card says what was agreed, and the
   table says, line by line, what has actually happened to the money. Each row
   carries its own verbs, because "record a payment" only ever means one
   installment and a page-level button would have to ask which.

   `Due` means nothing has happened yet. `Fail to pay` means something did, and
   the row shows the reason, the evidence and the attempt count rather than a
   red pill and a shrug. Nothing on this page is awaiting anybody's approval.
   ============================================================================= */
import { useShell } from "../../shell/ShellContext";
import { can } from "../../shell/AdminShell";
import { EmptyState, Icon, KvList, Notice, Tabs } from "../../ui";
import { go } from "../../ui/nav";
import { Rec } from "./Frame";
import { Chain, EventList, FailNote, InstPill, Money, SourceTag, SubPill } from "./bits";
import { CancelSubModal, FailToPayModal, RecordInstallmentModal, ReversePaymentModal } from "./SubModals";
import {
  COMPANY, accountOf, ago, daysPast, fmtDate, fmtDateTime, inr, inrWordsOf, isSuperAdmin,
  sourceMeta, superAdminOnly, useSubscription,
} from "./store";
import type { Installment, Params, Subscription } from "./store";

const TABS = [
  /* Schedule first, and it is the default: the installments are the record. */
  { k: "schedule", label: "Schedule" },
  { k: "receipt", label: "Receipt" },
  { k: "history", label: "History" },
];

export default function SubscriptionDetail({ id, p, onParams }: {
  id: string;
  p: Params;
  /** Several record params in one navigation (tab + the receipt's installment). */
  onParams: (patch: Params) => void;
}) {
  const { toast, modal, closeLayer } = useShell();
  const row = useSubscription(id);
  const tab = p.tab || "schedule";
  const writable = can("finance", "edit");

  /* The list state travelled here in the URL; Back hands it straight back, so
     returning is a return and not a reset. */
  const back = "#/finance" + (() => {
    const keep = Object.keys(p)
      .filter((k) => p[k] && ["tab", "inst"].indexOf(k) < 0)
      .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(p[k] as string))
      .join("&");
    return keep ? "?" + keep : "";
  })();

  if (!row) {
    return (
      <Rec id={id} back={back}>
        <EmptyState icon="search" title="No subscription at that address"
          body={<>There is no record for <span className="mono">{id}</span>. It was never recorded,
            or the address is from a different environment — nothing in this module is ever
            deleted, so a missing record is a wrong address.</>}
          action={<button className="btn pri" onClick={() => go(back)}>Back to subscriptions</button>} />
      </Rec>
    );
  }

  const s = row.s;
  const receipted = s.installments.filter((i) => i.payment && i.payment.receipt);
  const chosenSeq = Number(p.inst);
  const chosen = receipted.filter((i) => i.seq === chosenSeq)[0] || receipted[0] || null;

  const onPay = (i: Installment) => modal(
    <RecordInstallmentModal sub={s} inst={i} onClose={closeLayer}
      onDone={(msg, tone) => { closeLayer(); toast(msg, tone); }} />, "wide");
  const onFail = (i: Installment) => modal(
    <FailToPayModal sub={s} inst={i} onClose={closeLayer}
      onDone={(msg, tone) => { closeLayer(); toast(msg, tone); }} />, "wide");
  const onReverse = (i: Installment) => {
    const pay = i.payment;
    if (!pay) return;
    modal(<ReversePaymentModal sub={s} inst={i} pay={pay} onClose={closeLayer}
      onDone={(msg, tone) => { closeLayer(); toast(msg, tone); }} />, "wide");
  };
  const onCancel = () => modal(
    <CancelSubModal sub={s} onClose={closeLayer}
      onDone={(msg, tone) => { closeLayer(); toast(msg, tone); }} />, "wide");

  const src = sourceMeta(s.source);

  return (
    <Rec id={s.subscriptionId} back={back}
      pills={<><SubPill k={s.status} lg /><SourceTag k={s.source} /></>}
      actions={writable && s.status !== "cancelled" && s.status !== "refunded"
        ? <button className="btn sm dgr" onClick={onCancel}>Cancel subscription</button>
        : null}>

      <div className="fin-subline">
        <b>{s.customer.name}</b>
        {s.customer.userId ? <> · <span className="mono">{s.customer.userId}</span></> : null}
        {" · "}{s.planName} · {s.cycleMonths} months
        {" · sold by "}{s.soldBy}
        {" · activated "}{fmtDateTime(s.activatedAt)}
      </div>

      <Tabs items={TABS.map((t) => ({
        k: t.k, label: t.label,
        n: t.k === "receipt" ? receipted.length : t.k === "history" ? s.events.length : undefined,
      }))} cur={tab}
        /* Leaving Receipt drops the chosen installment, so coming back does not
           re-open a document nobody asked for. */
        onPick={(k) => onParams({ tab: k === "schedule" ? undefined : k, inst: undefined })} />

      {/* ======================================================= schedule === */}
      {tab === "schedule" ? (
        <>
          <Chain dealRef={s.customer.dealRef}
            invoice={(row.next || s.installments[0])?.invoiceNumber || null}
            installment={row.next
              ? "Installment " + row.next.seq + " of " + row.next.of
              : "All " + s.installments.length + " settled"}
            cap={<>
              <span className="k">Collected</span>
              <span className="v tnum">{inr(row.paidPaise)}</span>
            </>} />

          {s.status === "cancelled" ? (
            <Notice tone="warn" ico="alert" text={<>
              <b>This subscription was cancelled.</b> Its unpaid installments were cancelled with
              it — not written off — and the {inr(row.paidPaise)} already collected stayed exactly
              where it was. The history below carries the reason.
            </>} />
          ) : null}

          <div className="fin-two">
            <section className="card">
              <div className="card-h"><h3>What was sold</h3><span className="d">agreed, and frozen on the record</span></div>
              <div className="card-b">
                <KvList pairs={[
                  ["Plan", <>{s.planName} <span className="faint">· <span className="mono">{s.planId}</span></span></>],
                  ["Term", <>{s.cycleMonths} months · {fmtDate(s.startDate)} — {fmtDate(s.endDate)}</>],
                  ["Total agreed", <Money paise={s.totalPaise} strong />],
                  ["Schedule", <>{s.installments.length} installment{s.installments.length === 1 ? "" : "s"}
                    {" · "}{row.paidN} paid, {row.dueN} due, {row.failedN} failed</>],
                  ["Source", <>
                    <SourceTag k={s.source} />
                    {src?.help ? <div className="fin-fine">{src.help}</div> : null}
                  </>],
                  ["Sold by", <>{s.soldBy}{s.customer.dealRef
                    ? <> · on <span className="mono">{s.customer.dealRef}</span></> : null}</>],
                  ["Activated", <>{fmtDateTime(s.activatedAt)} · {ago(s.activatedAt)}</>],
                ]} />
              </div>
            </section>

            <section className="card">
              <div className="card-h"><h3>Where the money stands</h3><span className="d">the schedule, added up</span></div>
              <div className="card-b">
                <div className="fin-srow">
                  <span className="l">Collected · {row.paidN} installment{row.paidN === 1 ? "" : "s"}</span>
                  <span className="tnum"><Money paise={row.paidPaise} /></span>
                </div>
                <div className="fin-srow">
                  <span className="l">Still due · {row.dueN} installment{row.dueN === 1 ? "" : "s"}</span>
                  <span className="tnum"><Money paise={row.duePaise} /></span>
                </div>
                <div className="fin-srow">
                  <span className="l">Fail to pay · {row.failedN} installment{row.failedN === 1 ? "" : "s"}</span>
                  <span className="tnum"><Money paise={row.failedPaise} /></span>
                </div>
                <div className="fin-srow grand">
                  <span className="l">Total agreed</span>
                  <span className="tnum"><Money paise={s.totalPaise} strong /></span>
                </div>
                <p className="fin-fine">
                  Collected is money that arrived. Still due is the absence of an event, not a
                  promise anybody made this month. Fail to pay is money that was attempted and did
                  not clear, and every one of those rows carries its evidence below.
                </p>
              </div>
            </section>
          </div>

          <section className="card">
            <div className="card-h">
              <h3>Installments</h3>
              <span className="d">the unit that gets paid, invoiced and receipted</span>
              <span className="r fin-count">{row.paidN} of {s.installments.length} paid</span>
            </div>
            <div className="card-b">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Due</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>What is on record</th>
                    {writable ? <th className="tight" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {s.installments.map((i) => (
                    <InstRow key={i.seq} s={s} i={i} writable={writable}
                      onPay={onPay} onFail={onFail} onReverse={onReverse} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {/* ======================================================== receipt === */}
      {tab === "receipt" ? (
        chosen && chosen.payment && chosen.payment.receipt ? (
          <>
            <div className="fin-actions">
              {receipted.length > 1 ? (
                <div className="chiprow">
                  {receipted.map((i) => (
                    <button key={i.seq} className={"chip" + (i.seq === chosen.seq ? " on" : "")}
                      onClick={() => onParams({ inst: String(i.seq) })}>
                      Installment {i.seq} · {inr(i.amountPaise)}
                    </button>
                  ))}
                </div>
              ) : null}
              <span className="spacer" />
              <button className="btn" onClick={() => window.print()}>
                <Icon name="download" size="sm" />Download
              </button>
            </div>
            <ReceiptDoc s={s} i={chosen} />
          </>
        ) : (
          <EmptyState icon="doc" title="No receipt has been issued on this subscription"
            body={<>A receipt is issued the moment a payment is recorded — the same write that
              settles the installment. There is no separate step and nobody has to generate one, so
              an installment with no receipt is an installment with no payment. Record a payment on
              the Schedule tab and the document appears here, numbered and frozen.</>}
            action={<button className="btn" onClick={() => onParams({ tab: undefined, inst: undefined })}>
              Back to the schedule
            </button>} />
        )
      ) : null}

      {/* ======================================================== history === */}
      {tab === "history" ? (
        <section className="card">
          <div className="card-h">
            <h3>History</h3>
            <span className="d">append-only · every event on this subscription</span>
          </div>
          <div className="card-b"><EventList events={s.events} /></div>
        </section>
      ) : null}
    </Rec>
  );
}

/* -------------------------------------------------------------------------- */

function InstRow({ s, i, writable, onPay, onFail, onReverse }: {
  s: Subscription; i: Installment; writable: boolean;
  onPay: (i: Installment) => void;
  onFail: (i: Installment) => void;
  onReverse: (i: Installment) => void;
}) {
  const late = daysPast(i.dueDate);
  const pay = i.payment;
  /* Disabled with a title, never hidden: an action you cannot see is one you
     cannot ask for. */
  const saTitle = superAdminOnly("Reversing a payment");

  return (
    <tr className={i.status === "cancelled" ? "dim" : ""}>
      <td className="tnum">{i.seq} <span className="faint">of {i.of}</span></td>
      <td>
        <div className="cell-1">{fmtDate(i.dueDate)}</div>
        {i.status === "due"
          ? <div className={"cell-2 fin-late" + (late > 0 ? " warn" : "")}>
              {late > 0 ? late + (late === 1 ? " day" : " days") + " ago"
                : late === 0 ? "today" : "in " + Math.abs(late) + " days"}
            </div>
          : null}
      </td>
      <td className="tnum"><Money paise={i.amountPaise} /></td>
      <td><InstPill k={i.status} /></td>
      <td>
        {i.status === "paid" && pay ? (
          <>
            <div className="cell-1">
              {pay.mode} · <span className="mono">{pay.reference}</span>
            </div>
            <div className="cell-2">
              {pay.receipt
                ? <>Receipt <span className="mono">{pay.receipt.number}</span> · </>
                : null}
              credited {fmtDate(pay.valueDate)} to {accountOf(pay.accountId)?.masked || pay.accountId}
              {" · recorded by "}{pay.recordedBy}
            </div>
            {i.invoiceNumber
              ? <div className="cell-2">Billed on <span className="mono">{i.invoiceNumber}</span></div>
              : null}
          </>
        ) : i.status === "fail_to_pay" && i.failure ? (
          <FailNote reason={i.failure.reason} note={i.failure.note}
            at={i.failure.at} attempt={i.failure.attempt} />
        ) : i.status === "cancelled" ? (
          <span className="faint">Cancelled with the subscription. It will not be collected.</span>
        ) : (
          <span className="faint">
            Nothing has happened to it yet.
            {late > 0
              ? " Its due date passed " + late + (late === 1 ? " day" : " days")
                + " ago; until somebody records what happened, that is all this row claims."
              : ""}
          </span>
        )}
      </td>

      {writable ? (
        <td className="tight">
          <div className="fin-actions">
            {i.status === "due" || i.status === "fail_to_pay"
              ? <button className="btn sm pri" onClick={() => onPay(i)}>Record payment</button>
              : null}
            {i.status === "due"
              ? <button className="btn sm" onClick={() => onFail(i)}
                  title={"Record that installment " + i.seq + " of " + s.subscriptionId + " did not clear, with the evidence."}>
                  Mark fail to pay
                </button>
              : null}
            {i.status === "paid" && pay
              ? <button className="btn sm dgr" disabled={!isSuperAdmin()}
                  title={saTitle || "Return this installment to unpaid. The payment and its receipt stay on the record."}
                  onClick={() => onReverse(i)}>
                  Reverse payment
                </button>
              : null}
          </div>
        </td>
      ) : null}
    </tr>
  );
}

/* ------------------------------------------------------------- receipt --- */

/** The document as it was issued: numbered, hashed and never re-rendered from
 *  today's company details. What is drawn here is what the customer holds. */
function ReceiptDoc({ s, i }: { s: Subscription; i: Installment }) {
  const pay = i.payment;
  const rec = pay ? pay.receipt : null;
  if (!pay || !rec) return null;
  const acc = accountOf(pay.accountId);

  return (
    <div className="fin-doc">
      <div className="dh">
        <div>
          <h3>RECEIPT</h3>
          <div className="mono">{rec.number}</div>
          <div>Issued {fmtDateTime(rec.issuedAt)}</div>
        </div>
        <div className="r">
          <div><b>{COMPANY.brand}</b></div>
          <div>{COMPANY.name}</div>
          <div>{COMPANY.address}</div>
          <div>GSTIN <span className="mono">{COMPANY.gstin}</span></div>
          <div>CIN <span className="mono">{COMPANY.cin}</span></div>
        </div>
      </div>

      <div className="pty">
        <div>
          <div className="t">Received from</div>
          <div><b>{s.customer.name}</b></div>
          {s.customer.userId ? <div className="mono">{s.customer.userId}</div> : null}
          {s.customer.dealRef ? <div>Deal <span className="mono">{s.customer.dealRef}</span></div> : null}
        </div>
        <div>
          <div className="t">Against</div>
          <div>Subscription <span className="mono">{s.subscriptionId}</span></div>
          <div>{s.planName} · {s.cycleMonths}-month term</div>
          <div>Tax invoice <span className="mono">{i.invoiceNumber || "—"}</span></div>
        </div>
      </div>

      <table className="tbl">
        <thead>
          <tr>
            <th>Description</th>
            <th>Mode</th>
            <th>Reference</th>
            <th>Value date</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{s.planName} · installment {i.seq} of {i.of}</td>
            <td>{pay.mode}</td>
            <td className="mono">{pay.reference}</td>
            <td>{fmtDate(pay.valueDate)}</td>
            <td className="tnum">{inr(pay.amountPaise)}</td>
          </tr>
        </tbody>
      </table>

      <div className="tot">
        <div className="fin-srow">
          <span className="l">Installment {i.seq} of {i.of}</span>
          <span className="tnum">{inr(pay.amountPaise)}</span>
        </div>
        <div className="fin-srow grand">
          <span className="l">Received</span>
          <span className="tnum">{inr(pay.amountPaise)}</span>
        </div>
      </div>
      <div className="words">{inrWordsOf(pay.amountPaise)}</div>

      <p className="fin-frozen">
        <Icon name="lock" size="sm" className="ic" />
        <span>
          Frozen at issue and never re-rendered. SHA-256{" "}
          <span className="mono">{rec.sha256.slice(0, 24)}…</span> — a receipt rebuilt next year
          against today's company details would silently rewrite history, so this one is not
          rebuilt at all.
        </span>
      </p>

      <div className="terms">
        {"Credited to " + (acc?.name || pay.accountId) + " · " + (acc?.masked || "—")
          + ". Recorded by " + pay.recordedBy + " on " + fmtDateTime(pay.recordedAt) + ".\n"
          + "This acknowledges money received. It is not a tax invoice — tax is charged on the "
          + "invoice named above, and this receipt is issued against it.\n"
          + "Nothing on this document is edited. A correction is a reversal written into the "
          + "subscription's history with its reason, and the receipt stays where it is."}
      </div>
    </div>
  );
}
