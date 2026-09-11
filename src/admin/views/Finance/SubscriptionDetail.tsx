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
import type { ReactNode } from "react";
import { useShell } from "../../shell/ShellContext";
import { can } from "../../shell/AdminShell";
import { Alert, Button, Card, EmptyState, Icon, KvList, Table, Tabs } from "../../ui";
import { go } from "../../ui/nav";
import { Blocks, Rec } from "./Frame";
import { Chain, EventList, FailNote, InstPill, Money, SourceTag, SubPill } from "./bits";
import { CancelSubModal, FailToPayModal, RecordInstallmentModal, ReversePaymentModal } from "./SubModals";
import {
  COMPANY, accountOf, ago, daysPast, fmtDate, fmtDateTime, inr, inrWordsOf, isSuperAdmin,
  readInvoice, sourceMeta, superAdminOnly, useSubscription,
} from "./store";
import type { Installment, Params, Subscription } from "./store";

const TABS = [
  /* Schedule first, and it is the default: the installments are the record. */
  { k: "schedule", label: "Schedule" },
  { k: "receipt", label: "Receipt" },
  { k: "history", label: "History" },
];

/** One line of the "where the money stands" ledger: a label on the left and a
 *  figure on the right, the grand total set apart by a rule above it. */
function SumRow({ label, children, grand }: { label: string; children: ReactNode; grand?: boolean }) {
  return (
    <div className={grand
      ? "mt-1 flex items-baseline justify-between gap-4 border-t border-secondary pt-2.5 text-sm font-semibold text-primary"
      : "flex items-baseline justify-between gap-4 py-1.5 text-sm text-secondary"}>
      <span className="min-w-0">{label}</span>
      <span className="shrink-0 font-mono tnum">{children}</span>
    </div>
  );
}

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
          body={<>There is no record for <span className="font-mono tnum">{id}</span>. It was never recorded,
            or the address is from a different environment — nothing in this module is ever
            deleted, so a missing record is a wrong address.</>}
          action={<Button color="primary" onClick={() => go(back)}>Back to subscriptions</Button>} />
      </Rec>
    );
  }

  const s = row.s;
  const receipted = s.installments.filter((i) => i.payment && i.payment.receipt);
  const chosenSeq = Number(p.inst);
  const chosen = receipted.filter((i) => i.seq === chosenSeq)[0] || receipted[0] || null;

  const onPay = (i: Installment) => modal(
    <RecordInstallmentModal sub={s} inst={i} onClose={closeLayer}
      onDone={(msg, tone) => { closeLayer(); toast(msg, tone); }} />, "lg");
  const onFail = (i: Installment) => modal(
    <FailToPayModal sub={s} inst={i} onClose={closeLayer}
      onDone={(msg, tone) => { closeLayer(); toast(msg, tone); }} />, "lg");
  const onReverse = (i: Installment) => {
    const pay = i.payment;
    if (!pay) return;
    modal(<ReversePaymentModal sub={s} inst={i} pay={pay} onClose={closeLayer}
      onDone={(msg, tone) => { closeLayer(); toast(msg, tone); }} />, "lg");
  };
  const onCancel = () => modal(
    <CancelSubModal sub={s} onClose={closeLayer}
      onDone={(msg, tone) => { closeLayer(); toast(msg, tone); }} />, "lg");

  const src = sourceMeta(s.source);
  const cancellable = writable && s.status !== "cancelled" && s.status !== "refunded";

  return (
    <Rec id={s.subscriptionId} back={back}
      pills={<><SubPill k={s.status} lg /><SourceTag k={s.source} /></>}
      sub={<>
        <b className="font-medium text-secondary">{s.customer.name}</b>
        {s.customer.userId ? <> · <span className="font-mono tnum">{s.customer.userId}</span></> : null}
        {" · "}{s.planName} · {s.cycleMonths} months
        {" · sold by "}{s.soldBy}
        {" · recorded "}{fmtDateTime(s.recordedAt)}
      </>}
      menu={[
        { icon: "deal", label: "Open the deal",
          act: () => go("#/deals?q=" + encodeURIComponent(s.subscriptionId)) },
        { icon: "copy", label: "Copy subscription id", act: () => {
          void navigator?.clipboard?.writeText?.(s.subscriptionId);
          toast(s.subscriptionId + " copied.", "ok");
        } },
        { icon: "x", label: "Cancel subscription", tone: "bad",
          disabled: !cancellable,
          title: cancellable ? "End the schedule early. Collected money is untouched."
            : !writable ? "Cancelling a subscription needs Finance edit rights."
              : "It is already " + s.status + ".",
          act: onCancel },
      ]}>

      <Tabs items={TABS.map((t) => ({
        k: t.k, label: t.label,
        n: t.k === "receipt" ? receipted.length : t.k === "history" ? s.events.length : undefined,
        quiet: true,
      }))} cur={tab}
        /* Leaving Receipt drops the chosen installment, so coming back does not
           re-open a document nobody asked for. */
        onPick={(k) => onParams({ tab: k === "schedule" ? undefined : k, inst: undefined })} />

      {/* ======================================================= schedule === */}
      {tab === "schedule" ? (
        <div className="flex min-w-0 flex-col gap-4">
          <Chain dealRef={readInvoice(s.invoiceNumber)?.dealRef || null}
            invoice={(row.next || s.installments[0])?.invoiceNumber || null}
            installment={row.next
              ? "Installment " + row.next.seq + " of " + row.next.of
              : "All " + s.installments.length + " settled"}
            cap={<>
              <span className="label-mono">Collected</span>
              <span className="font-mono text-sm font-semibold text-primary tnum">{inr(row.paidPaise)}</span>
            </>} />

          {s.status === "cancelled" ? (
            <Alert tone="warn" title="This subscription was cancelled.">
              Its unpaid installments were cancelled with it — not written off — and the{" "}
              {inr(row.paidPaise)} already collected stayed exactly where it was. The history below
              carries the reason.
            </Alert>
          ) : null}

          <Blocks>
            <Card title="What was sold" sub="agreed, and frozen on the record">
              <KvList pairs={[
                ["Plan", <>{s.planName} <span className="text-quaternary">· <span className="font-mono tnum">{s.planId}</span></span></>],
                ["Term", <>{s.cycleMonths} months · {fmtDate(s.startDate)} — {fmtDate(s.endDate)}</>],
                ["Total agreed", <Money paise={s.totalPaise} strong />],
                ["Schedule", <>{s.installments.length} installment{s.installments.length === 1 ? "" : "s"}
                  {" · "}{row.paidN} paid, {row.dueN} due, {row.failedN} failed</>],
                ["Source", <>
                  <SourceTag k={s.source} />
                  {src?.help ? <div className="mt-1 text-xs text-tertiary">{src.help}</div> : null}
                </>],
                ["Sold by", s.soldBy],
                ["Recorded", <>{fmtDateTime(s.recordedAt)} · {ago(s.recordedAt)}</>],
                ["Paid", s.paidInFull ? "In full, on one invoice" : s.installments.length + " installments"],
              ]} />
            </Card>

            <Card title="Where the money stands" sub="the schedule, added up">
              <SumRow label={"Collected · " + row.paidN + " installment" + (row.paidN === 1 ? "" : "s")}>
                <Money paise={row.paidPaise} />
              </SumRow>
              <SumRow label={"Still due · " + row.dueN + " installment" + (row.dueN === 1 ? "" : "s")}>
                <Money paise={row.duePaise} />
              </SumRow>
              <SumRow label={"Fail to pay · " + row.failedN + " installment" + (row.failedN === 1 ? "" : "s")}>
                <Money paise={row.failedPaise} />
              </SumRow>
              <SumRow label="Total agreed" grand><Money paise={s.totalPaise} strong /></SumRow>
              <p className="mt-3 text-xs text-tertiary">
                Collected is money that arrived. Still due is the absence of an event, not a
                promise anybody made this month. Fail to pay is money that was attempted and did
                not clear, and every one of those rows carries its evidence below.
              </p>
            </Card>
          </Blocks>

          <Card flush
            title="Installments"
            sub="the unit that gets paid, invoiced and receipted"
            right={<span className="label-mono">{row.paidN} of {s.installments.length} paid</span>}>
            <Table list min="56rem"
              cols={[
                { label: "#" },
                { label: "Due" },
                { label: "Amount", cls: "n" },
                { label: "Status" },
                { label: "What is on record" },
                ...(writable ? [{ label: <span className="sr-only">Actions</span>, cls: "acts" }] : []),
              ]}
              rows={s.installments.map((i) => (
                <InstRow key={i.seq} s={s} i={i} writable={writable}
                  onPay={onPay} onFail={onFail} onReverse={onReverse} />
              ))} />
          </Card>
        </div>
      ) : null}

      {/* ======================================================== receipt === */}
      {tab === "receipt" ? (
        chosen && chosen.payment && chosen.payment.receipt ? (
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {receipted.length > 1 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {receipted.map((i) => (
                    <button key={i.seq} type="button"
                      aria-pressed={i.seq === chosen.seq}
                      className={i.seq === chosen.seq
                        ? "cursor-pointer rounded-full bg-brand-primary px-2.5 py-1 text-xs font-medium text-brand-secondary ring-1 ring-brand outline-focus-ring ring-inset focus-visible:outline-2"
                        : "cursor-pointer rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-secondary ring-1 ring-secondary outline-focus-ring transition duration-100 ring-inset hover:bg-primary_hover focus-visible:outline-2"}
                      onClick={() => onParams({ inst: String(i.seq) })}>
                      Installment {i.seq} · {inr(i.amountPaise)}
                    </button>
                  ))}
                </div>
              ) : null}
              <span className="flex-1" />
              <Button color="secondary" ico="print" onClick={() => window.print()}>Print</Button>
            </div>
            <ReceiptDoc s={s} i={chosen} />
          </div>
        ) : (
          <EmptyState icon="doc" title="No receipt has been issued on this subscription"
            body={<>A receipt is issued the moment a payment is recorded — the same write that
              settles the installment. There is no separate step and nobody has to generate one, so
              an installment with no receipt is an installment with no payment. Record a payment on
              the Schedule tab and the document appears here, numbered and frozen.</>}
            action={<Button color="secondary" onClick={() => onParams({ tab: undefined, inst: undefined })}>
              Back to the schedule
            </Button>} />
        )
      ) : null}

      {/* ======================================================== history === */}
      {tab === "history" ? (
        <Card title="History" sub="append-only · every event on this subscription">
          <EventList events={s.events} />
        </Card>
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
    <tr className={i.status === "cancelled" ? "opacity-60" : undefined}>
      <td className="mono whitespace-nowrap">{i.seq} <span className="text-quaternary">of {i.of}</span></td>
      <td className="whitespace-nowrap">
        <div className="cell-1">{fmtDate(i.dueDate)}</div>
        {i.status === "due"
          ? <div className={late > 0 ? "cell-2 text-warning-primary!" : "cell-2"}>
              {late > 0 ? late + (late === 1 ? " day" : " days") + " ago"
                : late === 0 ? "today" : "in " + Math.abs(late) + " days"}
            </div>
          : null}
      </td>
      <td className="n"><Money paise={i.amountPaise} /></td>
      <td><InstPill k={i.status} /></td>
      <td>
        {i.status === "paid" && pay ? (
          <>
            <div className="cell-1">
              {pay.mode} · <span className="font-mono tnum">{pay.reference}</span>
            </div>
            <div className="cell-2">
              {pay.receipt
                ? <>Receipt <span className="font-mono tnum">{pay.receipt.number}</span> · </>
                : null}
              credited {fmtDate(pay.valueDate)} to {accountOf(pay.accountId)?.masked || pay.accountId}
              {" · recorded by "}{pay.recordedBy}
            </div>
            {i.invoiceNumber
              ? <div className="cell-2">Billed on <span className="font-mono tnum">{i.invoiceNumber}</span></div>
              : null}
          </>
        ) : i.status === "fail_to_pay" && i.failure ? (
          <FailNote reason={i.failure.reason} note={i.failure.note}
            at={i.failure.at} attempt={i.failure.attempt} />
        ) : i.status === "cancelled" ? (
          <span className="text-quaternary">Cancelled with the subscription. It will not be collected.</span>
        ) : (
          <span className="text-quaternary">
            Nothing has happened to it yet.
            {late > 0
              ? " Its due date passed " + late + (late === 1 ? " day" : " days")
                + " ago; until somebody records what happened, that is all this row claims."
              : ""}
          </span>
        )}
      </td>

      {writable ? (
        <td className="acts">
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {i.status === "due" || i.status === "fail_to_pay"
              ? <Button size="xs" color="primary" onClick={() => onPay(i)}>Record payment</Button>
              : null}
            {i.status === "due"
              ? <Button size="xs" color="secondary" onClick={() => onFail(i)}
                  aria-label={"Mark installment " + i.seq + " of " + s.subscriptionId + " fail to pay"}>
                  Mark fail to pay
                </Button>
              : null}
            {i.status === "paid" && pay
              ? <Button size="xs" color="secondary-destructive" isDisabled={!isSuperAdmin()}
                  aria-label={saTitle || "Reverse the payment on installment " + i.seq}
                  onClick={() => onReverse(i)}>
                  Reverse payment
                </Button>
              : null}
          </div>
        </td>
      ) : null}
    </tr>
  );
}

/* ------------------------------------------------------------- receipt --- */

/** The document as it was issued: numbered, hashed and never re-rendered from
 *  today's company details. What is drawn here is what the customer holds.
 *
 *  IT IS PAPER, so it is white in both themes and prints as itself — the one
 *  surface in the module that does not follow the theme. */
function ReceiptDoc({ s, i }: { s: Subscription; i: Installment }) {
  const pay = i.payment;
  const rec = pay ? pay.receipt : null;
  if (!pay || !rec) return null;
  const acc = accountOf(pay.accountId);

  return (
    <article className="mx-auto w-full max-w-3xl rounded-xl bg-white p-6 text-neutral-900 shadow-xs ring-1 ring-neutral-200 sm:p-8 print:max-w-none print:rounded-none print:p-0 print:shadow-none print:ring-0">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-neutral-200 pb-5">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-tight">RECEIPT</h3>
          <div className="mt-0.5 font-mono text-sm tnum">{rec.number}</div>
          <div className="mt-0.5 text-xs text-neutral-600">Issued {fmtDateTime(rec.issuedAt)}</div>
        </div>
        <div className="min-w-0 text-right text-xs leading-relaxed text-neutral-600">
          <div className="text-sm font-semibold text-neutral-900">{COMPANY.brand}</div>
          <div>{COMPANY.name}</div>
          <div>{COMPANY.address}</div>
          <div>GSTIN <span className="font-mono tnum">{COMPANY.gstin}</span></div>
          <div>CIN <span className="font-mono tnum">{COMPANY.cin}</span></div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 border-b border-neutral-200 py-5 sm:grid-cols-2">
        <div className="min-w-0">
          <div className="text-2xs font-semibold tracking-[0.08em] text-neutral-500 uppercase">Received from</div>
          <div className="mt-1 text-sm font-semibold">{s.customer.name}</div>
          {s.customer.userId ? <div className="font-mono text-xs tnum text-neutral-600">{s.customer.userId}</div> : null}
        </div>
        <div className="min-w-0 text-sm text-neutral-700">
          <div className="text-2xs font-semibold tracking-[0.08em] text-neutral-500 uppercase">Against</div>
          <div className="mt-1">Subscription <span className="font-mono tnum">{s.subscriptionId}</span></div>
          <div>{s.planName} · {s.cycleMonths}-month term</div>
          <div>Tax invoice <span className="font-mono tnum">{i.invoiceNumber || "—"}</span></div>
        </div>
      </div>

      <div className="overflow-x-auto py-5">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-300 text-2xs font-semibold tracking-[0.08em] text-neutral-500 uppercase">
              <th scope="col" className="py-2 pr-3 text-left font-semibold">Description</th>
              <th scope="col" className="px-3 py-2 text-left font-semibold">Mode</th>
              <th scope="col" className="px-3 py-2 text-left font-semibold">Reference</th>
              <th scope="col" className="px-3 py-2 text-left font-semibold">Value date</th>
              <th scope="col" className="py-2 pl-3 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-neutral-200">
              <td className="py-2.5 pr-3">{s.planName} · installment {i.seq} of {i.of}</td>
              <td className="px-3 py-2.5">{pay.mode}</td>
              <td className="px-3 py-2.5 font-mono text-xs tnum">{pay.reference}</td>
              <td className="px-3 py-2.5">{fmtDate(pay.valueDate)}</td>
              <td className="py-2.5 pl-3 text-right font-mono tnum">{inr(pay.amountPaise)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="ml-auto w-full max-w-xs">
        <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm text-neutral-700">
          <span>Installment {i.seq} of {i.of}</span>
          <span className="font-mono tnum">{inr(pay.amountPaise)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t border-neutral-300 pt-2 text-sm font-semibold">
          <span>Received</span>
          <span className="font-mono tnum">{inr(pay.amountPaise)}</span>
        </div>
      </div>
      <p className="mt-2 text-right text-xs text-neutral-600 italic">{inrWordsOf(pay.amountPaise)}</p>

      <p className="mt-6 flex items-start gap-2 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600 ring-1 ring-neutral-200 ring-inset">
        <Icon name="lock" size="sm" className="mt-0.5 shrink-0 text-neutral-500" />
        <span>
          Frozen at issue and never re-rendered. SHA-256{" "}
          <span className="font-mono tnum">{rec.sha256.slice(0, 24)}…</span> — a receipt rebuilt next year
          against today's company details would silently rewrite history, so this one is not
          rebuilt at all.
        </span>
      </p>

      <div className="mt-4 border-t border-neutral-200 pt-4 text-xs leading-relaxed whitespace-pre-line text-neutral-500">
        {"Credited to " + (acc?.name || pay.accountId) + " · " + (acc?.masked || "—")
          + ". Recorded by " + pay.recordedBy + " on " + fmtDateTime(pay.recordedAt) + ".\n"
          + "This acknowledges money received. It is not a tax invoice — tax is charged on the "
          + "invoice named above, and this receipt is issued against it.\n"
          + "Nothing on this document is edited. A correction is a reversal written into the "
          + "subscription's history with its reason, and the receipt stays where it is."}
      </div>
    </article>
  );
}
