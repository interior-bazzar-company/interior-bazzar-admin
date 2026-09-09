/* =============================================================================
   Finance · Subscriptions — the five writes, as dialogs.
   -----------------------------------------------------------------------------
     RecordSubModal          a business is entitled to a plan. The WHOLE schedule is created with
                             it, and the dialog draws that schedule before you
                             commit it — a schedule you cannot see is not one.
     RecordInstallmentModal  the money for one installment arrived. One write:
                             settled, receipted, counted.
     FailToPayModal          an installment did not clear, and here is the
                             evidence. Never a guess, which is why the reason is
                             a closed list and the evidence is mandatory.
     ReversePaymentModal     a recorded payment was wrong. Super Admin. The
                             payment and its receipt stay; the installment goes
                             back to unpaid.
     CancelSubModal          the subscription ends early. Unpaid installments
                             are cancelled; collected money is untouched.

   EVERY WRITE GOES THROUGH THE STORE and every refusal is rendered where the
   sentence it contradicts is still on screen. No dialog here closes on a failed
   write, and none of them ask "are you sure" — the consequences are stated
   before the button, which is the same question asked once and answered.
   ============================================================================= */
import { useMemo, useState } from "react";
import { Alert, Button, DateInput, Input, Pill, SelectInput, Textarea } from "../../ui";
import { Check, Derived, DocCard, Fine, Ledger, LedgerRow, PickList, PickRow, Picked } from "./bits";
import { go } from "../../ui/nav";
import { Cancel, Dlg, Field, Fs, Pick } from "./dialog";
import type { Done } from "./dialog";
import {
  ACCOUNTS, FAILURE_REASONS, MODES,
  cancelSubscription, fmtDate, inr, markFailToPay,
  useUsers, previewSchedule, recordSubscription, chainsFor, attachableInvoices, attachableForInstallment, readInvoice, recordInstallmentPayment, reversePayment, superAdminOnly, todayIso,
} from "./store";
import type { Installment, InstallmentPayment, Subscription } from "./store";

const accountOptions = ACCOUNTS.filter((a) => a.active)
  .map((a) => ({ v: a.accountId, l: a.masked + " · " + a.name }));

/* ===================================================== record a sale === */

export function RecordSubModal({ onClose, onDone }: { onClose: () => void; onDone: Done }) {
  const users = useUsers();
  const [userId, setUserId] = useState("");
  const [uq, setUq] = useState("");
  /* The quotation this is being recorded from. THE CHAIN IS MANDATORY now:
     only a business with an accepted quotation and its invoice is offered at
     all, so everything below — plan, term, amount, installments — is read
     from documents rather than typed. */
  const [quotationNumber, setQuotationNumber] = useState("");
  /* HOW MANY INSTALLMENTS THE CUSTOMER HAS ALREADY PAID, picked by the team:
     none yet, the 1st, the first two, … or all of them — a complete payment.
     The schedule itself always stays what the documents agreed; this only
     writes the covered rows paid, backed by the transfer's facts below. */
  const [paidStr, setPaidStr] = useState("0");
  const [payMode, setPayMode] = useState(MODES[0] || "NEFT");
  const [payRef, setPayRef] = useState("");
  const [payDate, setPayDate] = useState(todayIso());
  const [payAccount, setPayAccount] = useState(accountOptions[0] ? accountOptions[0].v : "");
  const [startDate, setStartDate] = useState(todayIso());
  const [remark, setRemark] = useState("");
  const [err, setErr] = useState<string | null>(null);

  /* ONLY BUSINESSES WITH A RECORDABLE CHAIN APPEAR — an accepted quotation
     whose invoice is raised and not already carried. A business the write
     would refuse is not offered; the sale that never went through the chain
     is recorded once its documents exist, not before. */
  const shownUsers = useMemo(() => {
    const withChain = users.filter((u) =>
      chainsFor(u.userId).some((c) => !!c.attachable && !c.recordedAs));
    const q = uq.trim().toLowerCase();
    const list = q
      ? withChain.filter((u) => u.name.toLowerCase().includes(q)
        || (u.business || "").toLowerCase().includes(q)
        || u.userId.toLowerCase().includes(q)
        || u.email.toLowerCase().includes(q))
      : withChain;
    return list.slice(0, 8);
  }, [users, uq]);
  const chosenUser = users.filter((u) => u.userId === userId)[0] || null;

  /* PICKING THE BUSINESS FILLS THE FORM. The newest open quotation is
     attached at once — and with it the plan, the term, the installments and
     the chain's invoice — so the common case is one pick and one press.
     Nothing is locked by the pick that was not already locked by the chain:
     the block keeps its Change link, so a different quotation is one press
     away. Every listed business has at least one open chain, by the filter
     above. */
  const pickUser = (uid: string) => {
    setUserId(uid);
    setErr(null);
    setPaidStr("0");
    const opens = chainsFor(uid).filter((c) => !!c.attachable && !c.recordedAs);
    setQuotationNumber(opens.length ? opens[0].quotation.quotationNumber : "");
  };

  /* ------------------------------------------------------- the chain ---
     deal → quotation → invoice. Picking the business resolves it, and the
     quotation then answers every question below: what was sold, for how long,
     for how much, and in how many installments. Nothing on this dialog is
     typed once a quotation is chosen, which is the whole point — a figure
     retyped beside a document is a figure that can disagree with it.

     Only ACCEPTED quotations appear. A rejected one is not offered rather
     than offered and refused, because a subscription cannot be recorded on a
     sale that did not happen. */
  const chains = userId ? chainsFor(userId) : [];
  const open = chains.filter((c) => !!c.attachable && !c.recordedAs);
  const chain = chains.filter((c) => c.quotation.quotationNumber === quotationNumber)[0] || null;
  const quote = chain ? chain.quotation : null;

  /* The chain's invoice IS the invoice. Not a default the operator can drift
     away from — it is the installment this subscription is being recorded
     on, and the reason only chained businesses are offered at all. */
  const invoice = chain && chain.attachable ? chain.attachable : null;

  /* THE SCHEDULE IS WHAT THE DOCUMENTS AGREED — the count is never re-split.
     What the team picks is how much of it is ALREADY collected: the covered
     rows are written paid in the same write, and the rest are collected one
     by one on the subscription, each payment naming its row. */
  const fullN = quote ? quote.installments : 1;
  const n = fullN;
  const paidN = Math.min(Math.max(Number(paidStr) || 0, 0), fullN);

  /* One invoice per installment, each for the same amount — so the total is
     the invoice times the agreed count, and nobody types a figure that could
     disagree with the document. */
  const per = invoice ? invoice.grandTotalPaise : null;
  const paise = per !== null ? per * fullN : null;
  /* The exact rows recordSubscription will write. Asking the store rather than
     re-deriving them means the preview cannot drift from the commit, and it
     returns nothing at all when the total will not divide — the same condition
     the store refuses on. */
  const sched = paise !== null ? previewSchedule(startDate, n, paise) : [];

  const months = quote ? quote.termMonths : 0;
  const planName = quote ? quote.planName : "";
  /* A quotation names a plan but carries no catalogue id — it is a document,
     not a catalogue row. Slugged from the name so the id reads like every other
     one in the module rather than announcing where it came from. */
  const planId = quote
    ? "PL-" + quote.planName.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "")
    : "PL-MANUAL";

  /* THE ONE PLACE THE QUOTATION AND THE INVOICE CAN DISAGREE, and it is worth
     saying out loud rather than silently trusting one. The quotation agreed a
     total; the invoices raised against it are what the customer was actually
     billed. They differ legitimately — a quotation's installments need not be
     equal, and 00147 in the seed proves it — so this is a note, never a block. */
  const quotedVsBilled = quote && paise !== null && quote.grandTotalPaise !== paise
    ? { quoted: quote.grandTotalPaise, billed: paise }
    : null;

  const submit = () => {
    if (!invoice) {
      setErr("Attach the invoice this subscription was raised on. It is what says how much the customer owes, and nothing here types that figure.");
      return;
    }
    /* A quotation is what a salesperson closed, and only chained sales are
       recordable here — so the channel is a fact, not a question. */
    const r = recordSubscription({
      userId,
      source: "sales",
      planId, planName, cycleMonths: months,
      invoiceNumber: invoice.invoiceNumber, installmentCount: n, startDate,
      remark: remark.trim() || undefined,
      paid: paidN > 0
        ? { count: paidN, mode: payMode, reference: payRef, valueDate: payDate, accountId: payAccount }
        : undefined,
    });
    if (r.error) { setErr(r.error); return; }
    const nextDue = sched.filter((i) => i.seq > paidN)[0] || null;
    onDone(
      r.subscriptionId + " recorded · " + planName + " · " + inr(paise)
      + (quote ? " from " + quote.quotationNumber : "") + " on " + invoice.invoiceNumber
      + ". " + (chosenUser ? chosenUser.name : "The customer") + " is entitled from "
      + fmtDate(startDate) + ", "
      + (paidN > 0
        ? (paidN === n ? "and every installment is collected." : paidN + " of " + n + " collected — installment " + (paidN + 1) + " is due " + fmtDate(nextDue ? nextDue.dueDate : startDate) + ".")
        : "and the first installment is due " + fmtDate(sched[0] ? sched[0].dueDate : startDate) + "."), "ok");
  };

  return (
    <Dlg title="Record a subscription" err={err} onClose={onClose}
      sub="Writes down a sale that has happened."
      footer={<>
        <Cancel onClose={onClose} />
        <Button color="primary" onClick={submit}>Record subscription</Button>
      </>}>

      {/* WHO, FROM THE USER BASE. Not a typed name: a subscription belongs to a
          registered account, and the account id is what every other module
          joins on. A name typed here would be a customer the platform has
          never heard of. */}
      <Fs legend="Who bought it" req>
        {chosenUser ? (
          <Picked
            name={chosenUser.name}
            sub={<>
              <span className="font-mono tnum">{chosenUser.userId}</span>
              {chosenUser.business ? " · " + chosenUser.business : ""}
              {chosenUser.status !== "active" ? " · " + chosenUser.status : ""}
            </>}
            onChange={() => { setUserId(""); setUq(""); setQuotationNumber(""); }} />
        ) : (
          <>
            <Input value={uq} autoFocus ariaLabel="Search for the business"
              ph="Search by name, business, email or user id"
              onChange={setUq} />
            {shownUsers.length ? (
              <PickList>
                {shownUsers.map((u) => (
                  <PickRow key={u.userId} onPick={() => pickUser(u.userId)}
                    id={<span className="font-mono tnum">{u.userId}</span>}
                    sub={u.name + (u.business ? " · " + u.business : "")}
                    right={u.status === "active" ? undefined : u.status} />
                ))}
              </PickList>
            ) : (
              <Fine>No business with an accepted quotation and a raised invoice matches that. A subscription is recorded on its documents — raise them first.</Fine>
            )}
          </>
        )}
      </Fs>

      {/* THE CHAIN. Everything below this fieldset is read from the quotation
          and the invoice it was billed on — the plan, the term, the total and
          the number of installments. It is the difference between recording a
          sale and re-describing one. */}
      {userId ? (
        <Fs legend="The sale it came from">
          {chain ? (
            <DocCard
              number={chain.quotation.quotationNumber}
              pill={<Pill xs tone="ok" text="accepted" />}
              action={<Button color="link-color" size="sm"
                onClick={() => { setQuotationNumber(""); setPaidStr("0"); }}>Change</Button>}
              pairs={[
                ["Deal", <span className="font-mono tnum">{chain.quotation.dealRef}</span>],
                ["Plan", <>{chain.quotation.planName} · {chain.quotation.termMonths} month{chain.quotation.termMonths === 1 ? "" : "s"}</>],
                ["Agreed", <span className="font-mono tnum">{inr(chain.quotation.grandTotalPaise)}</span>],
                ["Paid as", chain.quotation.installments === 1
                  ? "Complete payment"
                  : chain.quotation.installments + " installments, " + chain.quotation.installmentGapMonths + " month apart"],
                ["Invoices raised", chain.invoices.length
                  ? chain.invoices.map((i) => i.invoiceNumber + " · " + inr(i.grandTotalPaise)
                    + (i.status === "cancelled" ? " (cancelled)" : "")).join("  ·  ")
                  : "none yet"],
              ]} />
          ) : open.length ? (
            <PickList>
              {open.map((c) => (
                <PickRow key={c.quotation.quotationNumber}
                  onPick={() => { setQuotationNumber(c.quotation.quotationNumber); setPaidStr("0"); }}
                  id={<span className="font-mono tnum">{c.quotation.quotationNumber}</span>}
                  sub={c.quotation.planName + " · " + c.quotation.termMonths + "m · "
                    + (c.quotation.installments === 1 ? "complete payment" : c.quotation.installments + " installments")
                    + " · " + c.quotation.dealRef}
                  right={inr(c.quotation.grandTotalPaise)} />
              ))}
            </PickList>
          ) : (
            <Alert tone="info" ico="doc"
              title={"No open quotation for " + (chosenUser ? chosenUser.name : "this business") + " any more."}>
              Every accepted quotation of theirs is already recorded as a subscription, or its
              invoice has not been raised yet. Raise the documents first — a subscription is
              recorded on them, not beside them.
            </Alert>
          )}
        </Fs>
      ) : null}

      {/* WHAT, FROM THE QUOTATION. The document carries the plan and the term,
          so there is no second field for either that could disagree with it. */}
      {userId ? (
        <Fs legend="What was sold" req
          hint={quote ? "From " + quote.quotationNumber + "." : undefined}>
          {quote ? (
            <Derived>
              <b className="font-semibold">{quote.planName}</b>
              <span className="ml-1">· {quote.termMonths} month{quote.termMonths === 1 ? "" : "s"}</span>
            </Derived>
          ) : (
            <Fine>Pick the quotation above.</Fine>
          )}
          <Field label="Starts on">
            <DateInput value={startDate} max={todayIso()} ariaLabel="Starts on"
              onChange={setStartDate} />
          </Field>
        </Fs>
      ) : null}

      {/* THE INVOICE CARRIES THE MONEY. Nobody types a total: the invoice is
          the document the customer owes against, and a figure typed beside it
          could only ever be a second opinion on the same money. */}
      <Fs legend="The invoice" req
        hint={quote ? "Raised on " + quote.quotationNumber + "." : undefined}>
        {!userId ? (
          <Fine>Pick the business first — the invoice has to be one of theirs.</Fine>
        ) : invoice ? (
          <DocCard
            number={invoice.invoiceNumber}
            pill={<Pill xs tone={invoice.paymentStatus === "paid" ? "ok" : "warn"} text={invoice.paymentStatus} />}
            pairs={[
              ["Raised for", invoice.customer.name + (invoice.customer.business ? " · " + invoice.customer.business : "")],
              ["Description", invoice.description],
              ["Invoice date", <>{fmtDate(invoice.invoiceDate)} · due {fmtDate(invoice.dueDate)}</>],
              ["Taxable", <span className="font-mono tnum">{inr(invoice.taxablePaise)}</span>],
              ["Tax", <span className="font-mono tnum">{inr(invoice.grandTotalPaise - invoice.taxablePaise)} · {invoice.placeOfSupply}</span>],
              ["Invoice total", <span className="font-mono font-semibold tnum">{inr(invoice.grandTotalPaise)}</span>],
            ]} />
        ) : (
          <Fine>The chain's invoice appears here once a quotation is attached.</Fine>
        )}
      </Fs>

      <Fs legend="How it is paid" req>
        <Field label="Payment plan">
          {quote && per !== null ? (
            <Derived>
              {fullN === 1
                ? <><b className="font-semibold">Complete payment</b> · {inr(per)}</>
                : <><b className="font-semibold">{fullN} installments</b> · {fullN} × {inr(per)}, {quote.installmentGapMonths} month apart — as agreed</>}
            </Derived>
          ) : (
            <Derived faint>attach a quotation first</Derived>
          )}
        </Field>
        <Field label="Subscription total">
          <Derived>
            <span className="font-mono tnum">
              {per !== null
                ? (fullN === 1
                  ? <b className="font-semibold">{inr(per)}</b>
                  : <>{inr(per)} × {fullN} = <b className="font-semibold">{inr(per * fullN)}</b></>)
                : "attach an invoice"}
            </span>
          </Derived>
        </Field>
        {/* WHICH INSTALLMENTS ARE ALREADY PAID, the team's call: none, the
            1st, the first two, … or all — a complete payment. The covered
            rows are written paid with this write; the rest are collected
            one by one on the subscription. */}
        {quote && per !== null ? (
          <Field label="Paid so far">
            <SelectInput ariaLabel="Paid so far" value={String(paidN)} onChange={setPaidStr}
              options={[{ v: "0", l: "Nothing yet — all " + fullN + " due" }].concat(
                Array.from({ length: fullN }, (_, i) => i + 1).map((k) => ({
                  v: String(k),
                  l: k === fullN
                    ? "Complete payment — all " + fullN + " paid · " + inr(per * fullN)
                    : k === 1
                      ? "1st installment paid · " + inr(per)
                      : "First " + k + " installments paid · " + k + " × " + inr(per),
                })))} />
          </Field>
        ) : null}
        {/* The transfer behind what was collected — the same facts the
            one-by-one payment write demands, asked once and applied to
            every covered row. */}
        {paidN > 0 && quote ? (
          <>
            <Field label="Paid via">
              <SelectInput ariaLabel="Paid via" value={payMode} onChange={setPayMode} options={MODES.slice()} />
            </Field>
            <Field label="Credited to">
              <SelectInput ariaLabel="Credited to" value={payAccount} onChange={setPayAccount} options={accountOptions} />
            </Field>
            <Field label="Reference / UTR">
              <Input mono value={payRef} ph="NEFT0019AUG2213" ariaLabel="Reference or UTR" onChange={setPayRef} />
            </Field>
            <Field label="Value date">
              <DateInput value={payDate} max={todayIso()} ariaLabel="Value date" onChange={setPayDate} />
            </Field>
          </>
        ) : null}

        {/* THE QUOTATION AND THE INVOICES CAN LEGITIMATELY DIFFER. A quotation
            agrees a total; the invoices raised against it need not be equal
            slices of it. So this is stated, never blocked — and the invoice
            wins, because it is what the customer was actually billed. */}
        {quotedVsBilled ? (
          <Alert tone="warn" title="The quotation and the invoices do not add up to the same figure.">
            {quote?.quotationNumber} agreed {inr(quotedVsBilled.quoted)}; this records{" "}
            {inr(quotedVsBilled.billed)} — {inr(invoice ? invoice.grandTotalPaise : 0)} × {n}.
            The invoice wins, because it is what was billed. Check it was meant to.
          </Alert>
        ) : null}

        {/* THE SCHEDULE, BEFORE IT EXISTS. Every installment carries a due date
            from day one, so this is the whole record — not a preview of the
            first row with the rest implied. */}
        <Ledger>
          {sched.length ? (
            <>
              {sched.map((i) => (
                <LedgerRow key={i.seq}
                  label={<>
                    {i.of === 1 ? "Complete payment" : "Installment " + i.seq + " of " + i.of}
                    {" · "}
                    {i.seq <= paidN
                      ? <b className="font-semibold text-success-primary">paid</b>
                      : <>due {fmtDate(i.dueDate)}</>}
                  </>}>
                  {inr(i.amountPaise)}
                </LedgerRow>
              ))}
              <LedgerRow label="Total" grand>{inr(sched.reduce((t, i) => t + i.amountPaise, 0))}</LedgerRow>
            </>
          ) : (
            <p className="py-1.5 text-sm text-tertiary">
              {paise === null || paise <= 0
                ? "Attach an invoice and the schedule appears here, dated, before anything is written."
                : "The schedule could not be built for " + inr(paise) + " over " + n + " installments."}
            </p>
          )}
        </Ledger>
      </Fs>

      {/* Written once everything above is settled, like a note on the bottom
          of a voucher — the pay dialog's remark, same place, same weight. */}
      <Field label="Remark">
        <Input value={remark} ph="Recorded late — signed on the 1st" ariaLabel="Remark" onChange={setRemark} />
      </Field>

      <Alert tone="info" ico="lock" title="Recording this entitles the customer now.">
        Every installment is created <em>due</em>; none counts as collected until a payment is
        recorded against it — one by one, on the subscription, naming which installment
        (1st, 2nd, …) each payment settles.
      </Alert>
    </Dlg>
  );
}

/* ============================================ record a payment on one === */

export function RecordInstallmentModal({ sub, inst, onClose, onDone }: {
  sub: Subscription; inst: Installment; onClose: () => void; onDone: Done;
}) {
  const [valueDate, setValueDate] = useState(todayIso());
  const [err, setErr] = useState<string | null>(null);

  /* ONE INVOICE BILLS ONE INSTALLMENT. The chain raises them as each falls
     due, so an installment after the first usually arrives here without one,
     and this is where the two are joined up.

     THE WHOLE BUSINESS'S UNCARRIED INVOICES ARE OFFERED, newest first, so
     the operator picks the document rather than hunting for its number —
     and the ones the write would refuse (raised for a different figure than
     this installment) are shown DISABLED beside their reason rather than
     hidden, because an invoice missing from a list is a question, and an
     invoice greyed out with its amount beside it is an answer. */
  const already = readInvoice(inst.invoiceNumber);
  const byNewest = (a: { invoiceDate: string }, b: { invoiceDate: string }) =>
    b.invoiceDate.localeCompare(a.invoiceDate);
  const offers = already || !sub.customer.userId
    ? []
    : attachableInvoices(sub.customer.userId).slice().sort(byNewest);
  /* `attachableForInstallment` stays the single definition of what this
     installment would actually accept — the same filter, plus the amount. */
  const fitting = already ? [] : attachableForInstallment(sub.subscriptionId, inst.seq).slice().sort(byNewest);
  const fits = (no: string) => fitting.some((i) => i.invoiceNumber === no);

  /* The newest one that fits is selected on opening: it is the invoice just
     raised for this installment in every ordinary case. "" is a real choice
     too — a payment recorded citing no document at all. */
  const [attachNo, setAttachNo] = useState(() => {
    if (readInvoice(inst.invoiceNumber)) return "";
    const first = attachableForInstallment(sub.subscriptionId, inst.seq).slice().sort(byNewest)[0];
    return first ? first.invoiceNumber : "";
  });
  const attached = already || offers.filter((i) => i.invoiceNumber === attachNo)[0] || null;

  const submit = () => {
    const r = recordInstallmentPayment({
      subscriptionId: sub.subscriptionId, seq: inst.seq,
      valueDate,
      invoiceNumber: already || !attached ? null : attached.invoiceNumber,
    });
    if (r.error) { setErr(r.error); return; }
    onDone(
      "Installment " + inst.seq + " of " + inst.of + " settled · " + inr(inst.amountPaise)
      + (attached ? " · billed on " + attached.invoiceNumber : "")
      + ". The receipt is issued and it counts as collected from " + fmtDate(valueDate) + ".", "ok");
  };

  return (
    <Dlg title="Record the payment" err={err} onClose={onClose}
      sub={<>{sub.customer.name} · <span className="font-mono tnum">{sub.subscriptionId}</span> · installment {inst.seq} of {inst.of}</>}
      footer={<>
        <Cancel onClose={onClose} />
        <Button color="primary" onClick={submit}>Record payment</Button>
      </>}>

      {/* THE AMOUNT FIELD IS GONE: an installment is paid or it is not, there
          is no part-paid one to record, and the invoice below already prints
          the figure. A read-only box repeating it was a field that could
          never be filled in.

          THE TAX INVOICE THIS INSTALLMENT IS BILLED ON. A receipt acknowledges
          funds against an invoice; issued with none, it prints a dash where the
          document should be. The chain raises one invoice per installment as
          each falls due, so this is where a later installment is joined to the
          one raised for it. */}
      {/* Inline, not behind the i: when the invoice already exists this line is
          the section's ONLY body, and a legend with nothing under it but an i
          reads as a section that failed to load. */}
      <Fs legend="Billed on" hintInline
        hint={already ? "Raised when this installment fell due." : undefined}>
        {already ? null : (
          <Field label={"Invoice · " + sub.customer.name}>
            <SelectInput ariaLabel="Invoice" value={attachNo} onChange={setAttachNo}
              options={[{ v: "", l: "No invoice — the receipt will cite none" }].concat(
                offers.map((i) => ({
                  v: i.invoiceNumber,
                  l: i.invoiceNumber + " · " + inr(i.grandTotalPaise) + " · " + fmtDate(i.invoiceDate)
                    + (fits(i.invoiceNumber) ? "" : " — not this installment's " + inr(inst.amountPaise)),
                })))} />
          </Field>
        )}
        {attached ? (
          <DocCard
            number={attached.invoiceNumber}
            pill={<Pill xs tone={attached.paymentStatus === "paid" ? "ok" : "warn"} text={attached.paymentStatus} />}
            action={<Button color="link-color" size="sm"
              onClick={() => go("#/invoices?q=" + encodeURIComponent(attached.invoiceNumber))}>Open the document</Button>}
            pairs={[
              ["Raised for", attached.customer.name],
              ["Description", attached.description],
              ["Invoice date", <>{fmtDate(attached.invoiceDate)} · due {fmtDate(attached.dueDate)}</>],
              ["Taxable", <span className="font-mono tnum">{inr(attached.taxablePaise)}</span>],
              ["Tax", <span className="font-mono tnum">{inr(attached.grandTotalPaise - attached.taxablePaise)} · {attached.placeOfSupply}</span>],
              ["Invoice total", <span className="font-mono font-semibold tnum">{inr(attached.grandTotalPaise)}</span>],
            ]} />
        ) : (
          <Alert tone="warn"
            title={offers.length
              ? "Nothing is attached, so the receipt will cite no tax invoice"
              : sub.customer.name + " has no invoice left to attach."}>
            {offers.length ? <>
              — and it is the receipt a customer keeps. Pick one of {sub.customer.name}'s invoices
              above, or raise one in Invoices for {inr(inst.amountPaise)} if the right document does
              not exist yet.
            </> : <>
              Every issued invoice of theirs is already carried by another installment, or none has
              been raised. Raise one in Invoices for {inr(inst.amountPaise)} — the payment can still
              be recorded without one, but the receipt will cite no tax invoice.
            </>}
          </Alert>
        )}
      </Fs>

      {/* MODE, REFERENCE AND CREDITED TO ARE NOT ASKED ANY MORE. The invoice
          above answers all three — it is the document this money came in
          against, its number is what ties the row to a statement line, and
          the money lands in the company's own account either way. What is
          left is the one fact the document cannot know: WHEN the bank
          credited it. */}
      <Fs legend="When the money arrived" req>
        <Field label="Value date">
          <DateInput value={valueDate} max={todayIso()} ariaLabel="Value date" onChange={setValueDate} />
        </Field>
      </Fs>

      <Alert tone="ok" ico="check" title="One write, and it is finished.">
        The installment becomes paid, a receipt number is issued against it, and it counts as
        collected in {fmtDate(valueDate)}'s month. There is nothing to confirm afterwards and
        nobody to approve it — a row here is a fact, and the only correction is a reversal written
        into the history.
      </Alert>
    </Dlg>
  );
}

/* ================================================= record a failure === */

export function FailToPayModal({ sub, inst, onClose, onDone }: {
  sub: Subscription; inst: Installment; onClose: () => void; onDone: Done;
}) {
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    const e = markFailToPay(sub.subscriptionId, inst.seq, reason, evidence);
    if (e) { setErr(e); return; }
    onDone(
      "Installment " + inst.seq + " of " + inst.of + " recorded as fail to pay · "
      + inr(inst.amountPaise) + ". " + sub.subscriptionId + " is now defaulting.", "warn");
  };

  return (
    <Dlg title="Record a fail to pay" err={err} onClose={onClose}
      sub={<>{sub.customer.name} · <span className="font-mono tnum">{sub.subscriptionId}</span> · installment {inst.seq} of {inst.of} · due {fmtDate(inst.dueDate)}</>}
      footer={<>
        <Cancel onClose={onClose} />
        <Button color="primary-destructive" onClick={submit}>Record the failure</Button>
      </>}>

      <div className="flex flex-col">
        <Check ok>
          It writes down something that <b>happened</b>: the reason below, with the evidence you
          type, stamped and attributed. It is not a suspicion and there is no state here for one.
        </Check>
        <Check>
          It does <b>not</b> retry the charge. Nothing is sent to a gateway from this panel, now or
          on a schedule.
        </Check>
        <Check>
          It does <b>not</b> suspend the membership. Entitlements belong to Users and nobody has
          decided to withdraw them — <b className="font-mono">FN-OD-15</b>.
        </Check>
        <Check warn>
          It moves {sub.subscriptionId} to <b>Defaulting</b> the moment it is saved, and takes it
          out of MRR. The money is not coming on its own.
        </Check>
      </div>

      <Fs legend="What actually happened" req
        hint="A closed list, because a free-text reason is where a guess gets written down as a fact.">
        <Pick value={reason} onChange={setReason}
          options={FAILURE_REASONS.map((r) => ({ key: r.key, label: r.label, help: r.help }))} />
        {reason === "overdue" ? (
          <Fine>
            The date is the evidence. This is refused while {fmtDate(inst.dueDate)} is still in the
            future — a date that has not passed is not evidence of anything.
          </Fine>
        ) : null}
      </Fs>

      <Fs legend="Evidence" req
        hint="What the gateway or the bank said, in their words.">
        <Textarea rows={3} value={evidence} ariaLabel="Evidence"
          ph="Response code and message, mandate reference, the date of the attempt — whatever a person reading this in six months needs to check it."
          onChange={setEvidence} />
        <Fine>
          Mandatory. A failure with no evidence is indistinguishable from a guess, and this record
          is the reason somebody can chase the money without asking you what you meant.
        </Fine>
      </Fs>
    </Dlg>
  );
}

/* ==================================================== reverse a payment === */

export function ReversePaymentModal({ sub, inst, pay, onClose, onDone }: {
  sub: Subscription; inst: Installment; pay: InstallmentPayment; onClose: () => void; onDone: Done;
}) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const blocked = superAdminOnly("Reversing a payment");

  const submit = () => {
    const e = reversePayment(pay.paymentId, reason);
    if (e) { setErr(e); return; }
    onDone(
      pay.paymentId + " reversed · " + inr(pay.amountPaise) + ". Installment " + inst.seq
      + " is unpaid again and the receipt stays on the record.", "warn");
  };

  return (
    <Dlg title="Reverse this payment" err={err} onClose={onClose}
      sub={<>{sub.customer.name} · <span className="font-mono tnum">{sub.subscriptionId}</span> · installment {inst.seq} of {inst.of} · <span className="font-mono tnum">{pay.paymentId}</span> · {inr(pay.amountPaise)} · {pay.mode} · <span className="font-mono tnum">{pay.reference}</span></>}
      footer={<>
        <Cancel onClose={onClose} />
        <Button color="primary-destructive" isDisabled={!!blocked} onClick={submit}>
          Reverse the payment
        </Button>
      </>}>

      <div className="flex flex-col">
        <Check ok>
          The payment and receipt <b>{pay.receipt?.number || "—"}</b> stay on the record. A receipt
          for money later recalled is more interesting to an auditor, not less.
        </Check>
        <Check warn>
          Installment {inst.seq} of {inst.of} returns to <b>unpaid</b> and falls due again on
          {" "}{fmtDate(inst.dueDate)}.
        </Check>
        <Check warn>
          {inst.invoiceNumber
            ? <>Tax invoice <b className="font-mono">{inst.invoiceNumber}</b> is cancelled, with
                &ldquo;payment reversed&rdquo; as its cancellation reason.</>
            : <>No tax invoice was raised against this installment, so there is none to cancel.</>}
        </Check>
        <Check>
          <b>No money moves.</b> This corrects the ledger. Sending money back to a customer is a
          refund, raised on the Refunds face and settled by a real transfer.
        </Check>
      </div>

      {blocked
        ? <Alert tone="warn" ico="shield" title={blocked}>
            Ask a Super Admin to do it, or ask for the grant. The button stays visible so you know
            the action exists.
          </Alert>
        : null}

      <Fs legend="Why" req hint="It goes into the history verbatim, next to your name.">
        <Textarea rows={3} value={reason} autoFocus ariaLabel="Why"
          ph="Duplicate entry against the same UTR · the bank recalled the credit · wrong subscription."
          onChange={setReason} />
        <Fine>
          A reversal with no reason is indistinguishable from a mistake at audit.
        </Fine>
      </Fs>
    </Dlg>
  );
}

/* ================================================ cancel a subscription === */

export function CancelSubModal({ sub, onClose, onDone }: {
  sub: Subscription; onClose: () => void; onDone: Done;
}) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const unpaid = sub.installments.filter((i) => i.status !== "paid" && i.status !== "cancelled");
  const unpaidPaise = unpaid.reduce((n, i) => n + i.amountPaise, 0);
  const paid = sub.installments.filter((i) => i.status === "paid");
  const paidPaise = paid.reduce((n, i) => n + i.amountPaise, 0);

  const submit = () => {
    const e = cancelSubscription(sub.subscriptionId, reason);
    if (e) { setErr(e); return; }
    onDone(
      sub.subscriptionId + " cancelled · " + unpaid.length + " unpaid installment"
      + (unpaid.length === 1 ? "" : "s") + " cancelled, " + inr(paidPaise) + " collected untouched.", "warn");
  };

  return (
    <Dlg title="Cancel this subscription" err={err} onClose={onClose}
      sub={<>{sub.customer.name} · <span className="font-mono tnum">{sub.subscriptionId}</span> · {sub.planName}</>}
      footer={<>
        <Cancel onClose={onClose} label="Keep it running" />
        <Button color="primary-destructive" onClick={submit}>Cancel the subscription</Button>
      </>}>

      <div className="flex flex-col">
        <Check warn>
          {unpaid.length
            ? <><b>{unpaid.length} unpaid installment{unpaid.length === 1 ? "" : "s"}</b>, worth
                {" "}{inr(unpaidPaise)}, are cancelled — not written off. They stop being expected,
                and they stop appearing in what is due.</>
            : <>Nothing is left unpaid, so no installment changes. Only the subscription's own
                status moves.</>}
        </Check>
        <Check ok>
          <b>{inr(paidPaise)} already collected is untouched.</b> {paid.length} receipt
          {paid.length === 1 ? "" : "s"} stand, and that money stays counted in the month it
          arrived. Cancelling forward does not rewrite the past.
        </Check>
        <Check>
          <b>This is not a refund.</b> Money goes back to a customer only through a refund request,
          approved and then actually transferred.
        </Check>
      </div>

      <Fs legend="Why it is ending" req hint="It goes into the history verbatim.">
        <Textarea rows={3} value={reason} autoFocus ariaLabel="Why it is ending"
          ph="Customer closed the business · moved to a different plan · agreed exit on the deal."
          onChange={setReason} />
      </Fs>
    </Dlg>
  );
}
