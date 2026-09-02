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
import { Notice } from "../../ui";
import { Check } from "./bits";
import { go } from "../../ui/nav";
import { Cancel, Dlg, Field, Fs } from "./dialog";
import type { Done } from "./dialog";
import {
  ACCOUNTS, FAILURE_REASONS, MODES,
  cancelSubscription, fmtDate, inr, markFailToPay,
  useUsers, previewSchedule, recordSubscription, chainsFor, attachableForInstallment, readInvoice, recordInstallmentPayment, reversePayment, superAdminOnly, todayIso,
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
        <button className="btn pri" onClick={submit}>Record subscription</button>
      </>}>

      {/* WHO, FROM THE USER BASE. Not a typed name: a subscription belongs to a
          registered account, and the account id is what every other module
          joins on. A name typed here would be a customer the platform has
          never heard of. */}
      <Fs legend="Who bought it" req>
        {chosenUser ? (
          <div className="fin-picked">
            <span className="n">{chosenUser.name}</span>
            <span className="s">
              <span className="mono">{chosenUser.userId}</span>
              {chosenUser.business ? <> · {chosenUser.business}</> : null}
              {chosenUser.status !== "active" ? <> · <b className="warn">{chosenUser.status}</b></> : null}
            </span>
            <button type="button" className="lnk" onClick={() => { setUserId(""); setUq(""); setQuotationNumber(""); }}>Change</button>
          </div>
        ) : (
          <>
            <input className="inp" value={uq} autoFocus placeholder="Search by name, business, email or user id"
              onChange={(e) => setUq(e.target.value)} />
            <div className="fin-pick">
              {shownUsers.length ? shownUsers.map((u) => (
                <button key={u.userId} type="button" onClick={() => pickUser(u.userId)}>
                  <span className="mono">{u.userId}</span>
                  <span className="s">{u.name}{u.business ? " · " + u.business : ""}</span>
                  <span className="a">{u.status === "active" ? "" : u.status}</span>
                </button>
              )) : <p className="fin-fine">No business with an accepted quotation and a raised invoice matches that. A subscription is recorded on its documents — raise them first.</p>}
            </div>
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
            <div className="fin-inv">
              <div className="h">
                <span className="mono n">{chain.quotation.quotationNumber}</span>
                <span className="pill ok">accepted</span>
                <span className="spacer" />
                <button type="button" className="lnk"
                  onClick={() => { setQuotationNumber(""); setPaidStr("0"); }}>Change</button>
              </div>
              <dl className="kv">
                <dt>Deal</dt><dd className="mono">{chain.quotation.dealRef}</dd>
                <dt>Plan</dt><dd>{chain.quotation.planName} · {chain.quotation.termMonths} month{chain.quotation.termMonths === 1 ? "" : "s"}</dd>
                <dt>Agreed</dt><dd className="tnum">{inr(chain.quotation.grandTotalPaise)}</dd>
                <dt>Paid as</dt>
                <dd>{chain.quotation.installments === 1
                  ? "Complete payment"
                  : chain.quotation.installments + " installments, " + chain.quotation.installmentGapMonths + " month apart"}</dd>
                <dt>Invoices raised</dt>
                <dd>{chain.invoices.length
                  ? chain.invoices.map((i) => i.invoiceNumber + " · " + inr(i.grandTotalPaise)
                    + (i.status === "cancelled" ? " (cancelled)" : "")).join("  ·  ")
                  : "none yet"}</dd>
              </dl>
            </div>
          ) : open.length ? (
            <div className="fin-pick">
              {open.map((c) => (
                <button key={c.quotation.quotationNumber} type="button"
                  onClick={() => { setQuotationNumber(c.quotation.quotationNumber); setPaidStr("0"); }}>
                  <span className="mono">{c.quotation.quotationNumber}</span>
                  <span className="s">
                    {c.quotation.planName} · {c.quotation.termMonths}m ·{" "}
                    {c.quotation.installments === 1 ? "complete payment" : c.quotation.installments + " installments"}
                    {" · "}{c.quotation.dealRef}
                  </span>
                  <span className="a">{inr(c.quotation.grandTotalPaise)}</span>
                </button>
              ))}
            </div>
          ) : (
            <Notice ico="doc" text={<>
              <b>No open quotation for {chosenUser ? chosenUser.name : "this business"} any more.</b>{" "}
              Every accepted quotation of theirs is already recorded as a subscription, or its
              invoice has not been raised yet. Raise the documents first — a subscription is
              recorded on them, not beside them.
            </>} />
          )}
        </Fs>
      ) : null}

      {/* WHAT, FROM THE QUOTATION. The document carries the plan and the term,
          so there is no second field for either that could disagree with it. */}
      {userId ? (
        <Fs legend="What was sold" req
          hint={quote ? "From " + quote.quotationNumber + "." : undefined}>
          {quote ? (
            <div className="fin-derived">
              <b>{quote.planName}</b> · {quote.termMonths} month{quote.termMonths === 1 ? "" : "s"}
            </div>
          ) : (
            <p className="fin-fine">Pick the quotation above.</p>
          )}
          <Field label="Starts on">
            <input type="date" className="inp" value={startDate} max={todayIso()}
              onChange={(e) => setStartDate(e.target.value)} />
          </Field>
        </Fs>
      ) : null}

      {/* THE INVOICE CARRIES THE MONEY. Nobody types a total: the invoice is
          the document the customer owes against, and a figure typed beside it
          could only ever be a second opinion on the same money. */}
      <Fs legend="The invoice" req
        hint={quote ? "Raised on " + quote.quotationNumber + "." : undefined}>
        {!userId ? (
          <p className="fin-fine">Pick the business first — the invoice has to be one of theirs.</p>
        ) : invoice ? (
          <div className="fin-inv">
            <div className="h">
              <span className="mono n">{invoice.invoiceNumber}</span>
              <span className={"pill " + (invoice.paymentStatus === "paid" ? "ok" : "warn")}>{invoice.paymentStatus}</span>
            </div>
            <dl className="kv">
              <dt>Raised for</dt><dd>{invoice.customer.name}{invoice.customer.business ? " · " + invoice.customer.business : ""}</dd>
              <dt>Description</dt><dd>{invoice.description}</dd>
              <dt>Invoice date</dt><dd>{fmtDate(invoice.invoiceDate)} · due {fmtDate(invoice.dueDate)}</dd>
              <dt>Taxable</dt><dd className="tnum">{inr(invoice.taxablePaise)}</dd>
              <dt>Tax</dt><dd className="tnum">{inr(invoice.grandTotalPaise - invoice.taxablePaise)} · {invoice.placeOfSupply}</dd>
              <dt>Invoice total</dt><dd className="tnum b">{inr(invoice.grandTotalPaise)}</dd>
            </dl>
          </div>
        ) : (
          <p className="fin-fine">The chain's invoice appears here once a quotation is attached.</p>
        )}
      </Fs>

      <Fs legend="How it is paid" req>
        <div className="fin-stack">
          <Field label="Payment plan">
            {quote && per !== null ? (
              <div className="fin-derived">
                {fullN === 1
                  ? <><b>Complete payment</b> · {inr(per)}</>
                  : <><b>{fullN} installments</b> · {fullN} × {inr(per)}, {quote.installmentGapMonths} month apart — as agreed</>}
              </div>
            ) : (
              <div className="fin-derived faint">attach a quotation first</div>
            )}
          </Field>
          <Field label="Subscription total">
            <div className="fin-derived tnum">
              {per !== null
                ? (fullN === 1
                  ? <b>{inr(per)}</b>
                  : <>{inr(per)} × {fullN} = <b>{inr(per * fullN)}</b></>)
                : "attach an invoice"}
            </div>
          </Field>
          {/* WHICH INSTALLMENTS ARE ALREADY PAID, the team's call: none, the
              1st, the first two, … or all — a complete payment. The covered
              rows are written paid with this write; the rest are collected
              one by one on the subscription. */}
          {quote && per !== null ? (
            <Field label="Paid so far">
              <div className="selectbox">
                <select value={String(paidN)} onChange={(e) => setPaidStr(e.target.value)}>
                  <option value="0">{"Nothing yet — all " + fullN + " due"}</option>
                  {Array.from({ length: fullN }, (_, i) => i + 1).map((k) => (
                    <option key={k} value={String(k)}>
                      {k === fullN
                        ? "Complete payment — all " + fullN + " paid · " + inr(per * fullN)
                        : k === 1
                          ? "1st installment paid · " + inr(per)
                          : "First " + k + " installments paid · " + k + " × " + inr(per)}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
          ) : null}
          {/* The transfer behind what was collected — the same facts the
              one-by-one payment write demands, asked once and applied to
              every covered row. */}
          {paidN > 0 && quote ? (
            <>
              <Field label="Paid via">
                <div className="selectbox">
                  <select value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                    {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </Field>
              <Field label="Credited to">
                <div className="selectbox">
                  <select value={payAccount} onChange={(e) => setPayAccount(e.target.value)}>
                    {accountOptions.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}
                  </select>
                </div>
              </Field>
              <Field label="Reference / UTR">
                <input className="inp mono" value={payRef} placeholder="NEFT0019AUG2213"
                  onChange={(e) => setPayRef(e.target.value)} />
              </Field>
              <Field label="Value date">
                <input type="date" className="inp" value={payDate} max={todayIso()}
                  onChange={(e) => setPayDate(e.target.value)} />
              </Field>
            </>
          ) : null}
        </div>

        {/* THE QUOTATION AND THE INVOICES CAN LEGITIMATELY DIFFER. A quotation
            agrees a total; the invoices raised against it need not be equal
            slices of it. So this is stated, never blocked — and the invoice
            wins, because it is what the customer was actually billed. */}
        {quotedVsBilled ? (
          <Notice tone="warn" ico="alert" text={<>
            <b>The quotation and the invoices do not add up to the same figure.</b>{" "}
            {quote?.quotationNumber} agreed {inr(quotedVsBilled.quoted)}; this records{" "}
            {inr(quotedVsBilled.billed)} — {inr(invoice ? invoice.grandTotalPaise : 0)} × {n}.
            The invoice wins, because it is what was billed. Check it was meant to.
          </>} />
        ) : null}

        {/* THE SCHEDULE, BEFORE IT EXISTS. Every installment carries a due date
            from day one, so this is the whole record — not a preview of the
            first row with the rest implied. */}
        <div className="fin-summary">
          {sched.length ? (
            <>
              {sched.map((i) => (
                <div className="row" key={i.seq}>
                  <span className="l">
                    {i.of === 1 ? "Complete payment" : "Installment " + i.seq + " of " + i.of}
                    {" · "}
                    {i.seq <= paidN
                      ? <b className="ok">paid</b>
                      : <>due {fmtDate(i.dueDate)}</>}
                  </span>
                  <span className="tnum">{inr(i.amountPaise)}</span>
                </div>
              ))}
              <div className="row grand">
                <span className="l">Total</span>
                <span className="tnum">{inr(sched.reduce((t, i) => t + i.amountPaise, 0))}</span>
              </div>
            </>
          ) : (
            <div className="row">
              <span className="l">
                {paise === null || paise <= 0
                  ? "Attach an invoice and the schedule appears here, dated, before anything is written."
                  : "The schedule could not be built for " + inr(paise) + " over " + n + " installments."}
              </span>
            </div>
          )}
        </div>
      </Fs>

      {/* Written once everything above is settled, like a note on the bottom
          of a voucher — the pay dialog's remark, same place, same weight. */}
      <div className="fin-remark">
        <Field label="Remark">
          <input className="inp" value={remark} placeholder="Recorded late — signed on the 1st"
            onChange={(e) => setRemark(e.target.value)} />
        </Field>
      </div>

      <Notice tone="info" ico="lock" text={<>
        <b>Recording this entitles the customer now.</b> Every installment is created <em>due</em>;
        none counts as collected until a payment is recorded against it — one by one, on the
        subscription, naming which installment (1st, 2nd, …) each payment settles.
      </>} />
    </Dlg>
  );
}

/* ============================================ record a payment on one === */

export function RecordInstallmentModal({ sub, inst, onClose, onDone }: {
  sub: Subscription; inst: Installment; onClose: () => void; onDone: Done;
}) {
  const [valueDate, setValueDate] = useState(todayIso());
  const [attachNo, setAttachNo] = useState("");
  const [picking, setPicking] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /* ONE INVOICE BILLS ONE INSTALLMENT. The chain raises them as each falls
     due, so an installment after the first usually arrives here without one,
     and this is where the two are joined up. The list is narrowed to invoices
     that would actually be accepted — this customer's, issued, unattached, and
     for exactly this installment's amount — newest first, because the one
     raised for this installment is the one just raised. */
  const already = readInvoice(inst.invoiceNumber);
  const offers = already ? [] : attachableForInstallment(sub.subscriptionId, inst.seq)
    .slice().sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
  /* THE LATEST IS ATTACHED ON OPENING. It is what the operator would have
     picked in every ordinary case, and Change is one press away for the one
     that is not ordinary. */
  const attached = already
    || offers.filter((i) => i.invoiceNumber === attachNo)[0]
    || (picking ? null : offers[0])
    || null;

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
      sub={<>{sub.customer.name} · <span className="mono">{sub.subscriptionId}</span> · installment {inst.seq} of {inst.of}</>}
      footer={<>
        <Cancel onClose={onClose} />
        <button className="btn pri" onClick={submit}>Record payment</button>
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
      <Fs legend="Billed on"
        hint={already
          ? "Raised when this installment fell due, and carried on the record since."
          : "Raise the invoice for this installment in Invoices, then attach it here. The receipt cites it."}>
        {attached ? (
          <div className="fin-inv">
            <div className="h">
              <span className="mono n">{attached.invoiceNumber}</span>
              <span className={"pill " + (attached.paymentStatus === "paid" ? "ok" : "warn")}>{attached.paymentStatus}</span>
              <span className="spacer" />
              <button type="button" className="lnk"
                onClick={() => go("#/invoices?q=" + encodeURIComponent(attached.invoiceNumber))}>Open the document</button>
              {already || offers.length < 2 ? null
                : <button type="button" className="lnk"
                    onClick={() => { setAttachNo(""); setPicking(true); }}>Change</button>}
            </div>
            <dl className="kv">
              <dt>Raised for</dt><dd>{attached.customer.name}</dd>
              <dt>Description</dt><dd>{attached.description}</dd>
              <dt>Invoice date</dt><dd>{fmtDate(attached.invoiceDate)} · due {fmtDate(attached.dueDate)}</dd>
              <dt>Taxable</dt><dd className="tnum">{inr(attached.taxablePaise)}</dd>
              <dt>Tax</dt><dd className="tnum">{inr(attached.grandTotalPaise - attached.taxablePaise)} · {attached.placeOfSupply}</dd>
              <dt>Invoice total</dt><dd className="tnum b">{inr(attached.grandTotalPaise)}</dd>
            </dl>
          </div>
        ) : offers.length ? (
          <div className="fin-pick">
            {offers.map((i) => (
              <button key={i.invoiceNumber} type="button"
                onClick={() => { setAttachNo(i.invoiceNumber); setPicking(false); }}>
                <span className="mono">{i.invoiceNumber}</span>
                <span className="s">{i.description} · {fmtDate(i.invoiceDate)} · {i.paymentStatus}</span>
                <span className="a">{inr(i.grandTotalPaise)}</span>
              </button>
            ))}
          </div>
        ) : (
          <Notice tone="warn" ico="alert" text={<>
            <b>No invoice has been raised for this installment yet.</b> Raise one in Invoices for{" "}
            {inr(inst.amountPaise)} against {sub.customer.name}, then attach it here. The payment can
            still be recorded without one — the money arrived either way — but the receipt will cite
            no tax invoice, and it is the receipt a customer keeps.
          </>} />
        )}
      </Fs>

      {/* MODE, REFERENCE AND CREDITED TO ARE NOT ASKED ANY MORE. The invoice
          above answers all three — it is the document this money came in
          against, its number is what ties the row to a statement line, and
          the money lands in the company's own account either way. What is
          left is the one fact the document cannot know: WHEN the bank
          credited it. */}
      <Fs legend="When the money arrived" req>
        <div className="fin-stack">
          <Field label="Value date">
            <input type="date" className="inp" value={valueDate} max={todayIso()} autoFocus
              onChange={(e) => setValueDate(e.target.value)} />
          </Field>
        </div>
      </Fs>

      <Notice tone="ok" ico="check" text={<>
        <b>One write, and it is finished.</b> The installment becomes paid, receipt
        {" "}number is issued against it, and it counts as collected in {fmtDate(valueDate)}'s
        month. There is nothing to confirm afterwards and nobody to approve it — a row here is a
        fact, and the only correction is a reversal written into the history.
      </>} />
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
      sub={<>{sub.customer.name} · <span className="mono">{sub.subscriptionId}</span> · installment {inst.seq} of {inst.of} · due {fmtDate(inst.dueDate)}</>}
      footer={<>
        <Cancel onClose={onClose} />
        <button className="btn dgr" onClick={submit}>Record the failure</button>
      </>}>

      <div className="fin-chks">
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
          decided to withdraw them — <b className="mono">FN-OD-15</b>.
        </Check>
        <Check warn>
          It moves {sub.subscriptionId} to <b>Defaulting</b> the moment it is saved, and takes it
          out of MRR. The money is not coming on its own.
        </Check>
      </div>

      <Fs legend="What actually happened" req
        hint="A closed list, because a free-text reason is where a guess gets written down as a fact.">
        <div className="fin-radios">
          {FAILURE_REASONS.map((r) => (
            <label key={r.key} className={reason === r.key ? "on" : ""}>
              <input type="radio" name="fail-reason" checked={reason === r.key}
                onChange={() => setReason(r.key)} />
              <b>{r.label}</b>
              <span>{r.help}</span>
            </label>
          ))}
        </div>
        {reason === "overdue" ? (
          <p className="fin-fine">
            The date is the evidence. This is refused while {fmtDate(inst.dueDate)} is still in the
            future — a date that has not passed is not evidence of anything.
          </p>
        ) : null}
      </Fs>

      <Fs legend="Evidence" req
        hint="What the gateway or the bank said, in their words.">
        <textarea className="inp" rows={3} value={evidence}
          placeholder="Response code and message, mandate reference, the date of the attempt — whatever a person reading this in six months needs to check it."
          onChange={(e) => setEvidence(e.target.value)} />
        <p className="fin-fine">
          Mandatory. A failure with no evidence is indistinguishable from a guess, and this record
          is the reason somebody can chase the money without asking you what you meant.
        </p>
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
      sub={<>{sub.customer.name} · <span className="mono">{sub.subscriptionId}</span> · installment {inst.seq} of {inst.of} · <span className="mono">{pay.paymentId}</span> · {inr(pay.amountPaise)} · {pay.mode} · <span className="mono">{pay.reference}</span></>}
      footer={<>
        <Cancel onClose={onClose} />
        <button className="btn dgr" disabled={!!blocked} title={blocked || undefined} onClick={submit}>
          Reverse the payment
        </button>
      </>}>

      <div className="fin-chks">
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
            ? <>Tax invoice <b className="mono">{inst.invoiceNumber}</b> is cancelled, with
                &ldquo;payment reversed&rdquo; as its cancellation reason.</>
            : <>No tax invoice was raised against this installment, so there is none to cancel.</>}
        </Check>
        <Check>
          <b>No money moves.</b> This corrects the ledger. Sending money back to a customer is a
          refund, raised on the Refunds face and settled by a real transfer.
        </Check>
      </div>

      {blocked
        ? <Notice tone="warn" ico="shield" text={<><b>{blocked}</b> Ask a Super Admin to do it, or ask for the grant. The button stays visible so you know the action exists.</>} />
        : null}

      <Fs legend="Why" req hint="It goes into the history verbatim, next to your name.">
        <textarea className="inp" rows={3} value={reason} autoFocus
          placeholder="Duplicate entry against the same UTR · the bank recalled the credit · wrong subscription."
          onChange={(e) => setReason(e.target.value)} />
        <p className="fin-fine">
          A reversal with no reason is indistinguishable from a mistake at audit.
        </p>
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
      sub={<>{sub.customer.name} · <span className="mono">{sub.subscriptionId}</span> · {sub.planName}</>}
      footer={<>
        <Cancel onClose={onClose} label="Keep it running" />
        <button className="btn dgr" onClick={submit}>Cancel the subscription</button>
      </>}>

      <div className="fin-chks">
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
        <textarea className="inp" rows={3} value={reason} autoFocus
          placeholder="Customer closed the business · moved to a different plan · agreed exit on the deal."
          onChange={(e) => setReason(e.target.value)} />
      </Fs>
    </Dlg>
  );
}
