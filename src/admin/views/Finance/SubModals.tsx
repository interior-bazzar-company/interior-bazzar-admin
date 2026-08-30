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
import { useEffect, useMemo, useState } from "react";
import AdminOpsService, { call } from "../../../api/modules/adminOps";
import type { PlanRow } from "../../../api/modules/adminOps";
import { errMessage } from "../../../api/apiService";
import { Notice, Tabs } from "../../ui";
import { Check } from "./bits";
import { go } from "../../ui/nav";
import { Cancel, Dlg, Field, Fs, Pick } from "./dialog";
/* SAMPLE TAB — proto only, deleted at integration. */
import { SAMPLES_ON, SubSamples } from "./SubSamples";
import type { Done } from "./dialog";
import {
  ACCOUNTS, FAILURE_REASONS, MODES,
  cancelSubscription, fmtDate, inr, markFailToPay,
  useUsers, previewSchedule, recordSubscription, attachableInvoices, chainsFor, attachableForInstallment, readInvoice, recordInstallmentPayment, reversePayment, superAdminOnly, todayIso,
} from "./store";
import type { Installment, InstallmentPayment, Subscription } from "./store";

/* THE PAYMENT PLAN. "Complete payment" IS one installment — the customer pays
   the whole thing once — so it is the label on 1 rather than a sixth option
   beside it. Offering both would put two choices in this dropdown that write
   the identical row, and the first person to ask which one they should have
   picked would be right to. */
const PAYMENT_PLANS = [
  { v: "1", l: "Complete payment · paid in one go" },
  { v: "2", l: "2 installments" },
  { v: "3", l: "3 installments" },
  { v: "4", l: "4 installments" },
  { v: "5", l: "5 installments" },
];

/** The schedule the store WILL create, from the store itself — never a second
 *  then the same day of each following month. Built here only so the person
 *  signing it off can read it first. */
const accountOptions = ACCOUNTS.filter((a) => a.active)
  .map((a) => ({ v: a.accountId, l: a.masked + " · " + a.name }));

/* ===================================================== record a sale === */

/** One row of the plan dropdown: a plan crossed with one of its billing
 *  cycles, because that pairing is what a customer actually buys and it is the
 *  only thing that carries BOTH a term and a price. */
interface PlanChoice {
  id: string;
  planId: string;
  planName: string;
  months: number;
  pricePaise: number;
  label: string;
}

/** Prices arrive from the catalogue as decimal strings ("9900.00"). Converted
 *  once, here, into the integer paise everything downstream speaks. */
function priceToPaise(v: string): number {
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function RecordSubModal({ onClose, onDone }: { onClose: () => void; onDone: Done }) {
  const users = useUsers();
  const [userId, setUserId] = useState("");
  const [uq, setUq] = useState("");
  const [source, setSource] = useState<"sales" | "website">("sales");
  const [choiceId, setChoiceId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  /* The quotation this is being recorded from. Empty means there is no chain
     behind this sale — a website purchase — and the manual path applies. */
  const [quotationNumber, setQuotationNumber] = useState("");
  const [count, setCount] = useState("1");
  const [startDate, setStartDate] = useState(todayIso());
  const [err, setErr] = useState<string | null>(null);
  /* SAMPLE TAB — proto only, deleted at integration. See SubSamples.tsx. */
  const [tab, setTab] = useState<"record" | "sample">("record");

  /* THE CATALOGUE IS LIVE. Plans is a real module with real rows, so the plan
     on a subscription is chosen from what the company actually sells rather
     than from a list copied into this file that drifts the first time pricing
     changes. Three states, all of them rendered: loading, failed, and empty —
     a dialog that shows nothing when a fetch fails is a dialog that fails
     silently in front of a customer. */
  const [plans, setPlans] = useState<PlanChoice[] | null>(null);
  const [plansErr, setPlansErr] = useState<string | null>(null);
  /* Manual fallback, used only when the catalogue cannot be read. A sale that
     happened must still be recordable when an endpoint is down. */
  const [manualPlan, setManualPlan] = useState("");
  const [manualMonths, setManualMonths] = useState(12);

  useEffect(() => {
    let dead = false;
    call(AdminOpsService.plans())
      .then((data: { plans?: PlanRow[] }) => {
        const rows = data.plans || [];
        if (dead) return;
        const out: PlanChoice[] = [];
        (rows || []).filter((pl) => pl.isActive && !pl.isArchived).forEach((pl) => {
          (pl.billingCycles || []).filter((c) => c.isActive).forEach((c) => {
            out.push({
              id: String(pl.id) + ":" + String(c.id),
              planId: "PL-" + String(pl.id),
              planName: pl.title,
              months: c.durationMonths,
              pricePaise: priceToPaise(c.price),
              label: pl.title + " · " + c.durationMonths + " month" + (c.durationMonths === 1 ? "" : "s")
                + " · " + inr(priceToPaise(c.price)),
            });
          });
        });
        out.sort((a, b) => a.planName.localeCompare(b.planName) || a.months - b.months);
        setPlans(out);
      })
      .catch((e: unknown) => { if (!dead) setPlansErr(errMessage(e) || "The plan catalogue could not be read."); });
    return () => { dead = true; };
  }, []);

  const chosenPlan = plans ? plans.filter((c) => c.id === choiceId)[0] || null : null;

  /* The plan says WHAT was bought and for how long. It no longer says what it
     costs: the attached invoice does, because the invoice is the document the
     customer actually owes against and a catalogue price that disagrees with it
     would be a second opinion on the same money. The catalogue price is still
     shown beside the invoice so a mismatch is visible. */
  const pickPlan = (id: string) => setChoiceId(id);

  const shownUsers = useMemo(() => {
    const q = uq.trim().toLowerCase();
    const list = q
      ? users.filter((u) => u.name.toLowerCase().includes(q)
        || (u.business || "").toLowerCase().includes(q)
        || u.userId.toLowerCase().includes(q)
        || u.email.toLowerCase().includes(q))
      : users;
    return list.slice(0, 8);
  }, [users, uq]);
  const chosenUser = users.filter((u) => u.userId === userId)[0] || null;

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

  /* Only invoices that would actually be accepted: issued, this customer's,
     and not already carried by another subscription. Offering one the write
     would refuse is a dialog lying to the person using it. */
  const invoices = userId ? attachableInvoices(userId) : [];
  /* The chain's invoice wins where there is one. It is not a default the
     operator can drift away from — it IS the installment this subscription is
     being recorded on. */
  const invoice = chain && chain.attachable
    ? chain.attachable
    : invoices.filter((i) => i.invoiceNumber === invoiceNumber)[0] || null;

  /* THE COUNT COMES FROM THE QUOTATION, not from the dropdown, whenever one is
     attached. The chain raises one invoice per installment as each falls due,
     so counting the documents that exist would report a running schedule as
     shorter than it is. */
  const n = quote ? quote.installments : Number(count);

  /* One invoice per installment, each for the same amount — so the total is
     the invoice times the count, and nobody types a figure that could disagree
     with the document. */
  const paise = invoice ? invoice.grandTotalPaise * n : null;
  /* The exact rows recordSubscription will write. Asking the store rather than
     re-deriving them means the preview cannot drift from the commit, and it
     returns nothing at all when the total will not divide — the same condition
     the store refuses on. */
  const sched = paise !== null ? previewSchedule(startDate, n, paise) : [];

  const months = quote ? quote.termMonths : chosenPlan ? chosenPlan.months : manualMonths;
  const planName = quote ? quote.planName : chosenPlan ? chosenPlan.planName : manualPlan.trim();
  /* A quotation names a plan but carries no catalogue id — it is a document,
     not a catalogue row. Slugged from the name so the id reads like every other
     one in the module rather than announcing where it came from. */
  const planId = quote
    ? "PL-" + quote.planName.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "")
    : chosenPlan ? chosenPlan.planId : "PL-MANUAL";

  /* A quotation is what a salesperson closed. Recording one from the chain is
     a sales sale by definition, so the channel is not a second question. */
  const effectiveSource = quote ? "sales" : source;

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
    const r = recordSubscription({
      userId,
      source: effectiveSource,
      planId, planName, cycleMonths: months,
      invoiceNumber: invoice.invoiceNumber, installmentCount: n, startDate,
    });
    if (r.error) { setErr(r.error); return; }
    onDone(
      r.subscriptionId + " recorded · " + planName + " · " + inr(paise)
      + (quote ? " from " + quote.quotationNumber : "") + " on " + invoice.invoiceNumber
      + ". " + (chosenUser ? chosenUser.name : "The customer") + " is entitled from "
      + fmtDate(startDate) + ", and the first installment is due "
      + fmtDate(sched[0] ? sched[0].dueDate : startDate) + ".", "ok");
  };

  return (
    <Dlg title="Record a subscription" err={tab === "record" ? err : null} onClose={onClose}
      sub="Writes down a sale that has happened. The invoice says what it cost; the whole schedule is created with it."
      footer={tab === "sample"
        ? <Cancel onClose={() => setTab("record")} label="Back to the form" />
        : <>
          <Cancel onClose={onClose} />
          <button className="btn pri" onClick={submit}>Record subscription</button>
        </>}>

      {/* SAMPLE TAB — proto only, deleted at integration. See SubSamples.tsx
          for the four-step removal list. */}
      {SAMPLES_ON ? (
        <Tabs cur={tab} onPick={(k) => setTab(k as "record" | "sample")}
          items={[
            { k: "record", label: "Record" },
            { k: "sample", label: "Sample & use cases" },
          ]} />
      ) : null}

      {/* SAMPLE TAB — the whole form is the other branch of this one
          conditional, so removing the tab is removing this line and its
          closing brace at the end of the dialog. */}
      {SAMPLES_ON && tab === "sample" ? (
        <SubSamples onUse={(u, q) => {
          setUserId(u);
          setQuotationNumber(q);
          setInvoiceNumber("");
          setErr(null);
          setTab("record");
        }} />
      ) : (<></>)}
      {tab === "sample" ? null : (<>

      {/* WHO, FROM THE USER BASE. Not a typed name: a subscription belongs to a
          registered account, and the account id is what every other module
          joins on. A name typed here would be a customer the platform has
          never heard of. */}
      <Fs legend="Who bought it" req
        hint="Picked from the registered user base, so the subscription joins to a real account.">
        {chosenUser ? (
          <div className="fin-picked">
            <span className="n">{chosenUser.name}</span>
            <span className="s">
              <span className="mono">{chosenUser.userId}</span>
              {chosenUser.business ? <> · {chosenUser.business}</> : null}
              {chosenUser.status !== "active" ? <> · <b className="warn">{chosenUser.status}</b></> : null}
            </span>
            <button type="button" className="lnk" onClick={() => { setUserId(""); setUq(""); setQuotationNumber(""); setInvoiceNumber(""); }}>Change</button>
          </div>
        ) : (
          <>
            <input className="inp" value={uq} autoFocus placeholder="Search by name, business, email or user id"
              onChange={(e) => setUq(e.target.value)} />
            <div className="fin-pick">
              {shownUsers.length ? shownUsers.map((u) => (
                <button key={u.userId} type="button"
                  onClick={() => { setUserId(u.userId); setQuotationNumber(""); setInvoiceNumber(""); }}>
                  <span className="mono">{u.userId}</span>
                  <span className="s">{u.name}{u.business ? " · " + u.business : ""}</span>
                  <span className="a">{u.status === "active" ? "" : u.status}</span>
                </button>
              )) : <p className="fin-fine">Nobody in the user base matches that. A subscription cannot be recorded for somebody who is not registered.</p>}
            </div>
          </>
        )}
      </Fs>

      {/* THE CHAIN. Everything below this fieldset is read from the quotation
          and the invoice it was billed on — the plan, the term, the total and
          the number of installments. It is the difference between recording a
          sale and re-describing one. */}
      {userId ? (
        <Fs legend="The sale it came from"
          hint="Accepted quotations for this business. Picking one fills in everything below it.">
          {chain ? (
            <div className="fin-inv">
              <div className="h">
                <span className="mono n">{chain.quotation.quotationNumber}</span>
                <span className="pill ok">accepted</span>
                <span className="spacer" />
                <button type="button" className="lnk"
                  onClick={() => { setQuotationNumber(""); setInvoiceNumber(""); }}>Change</button>
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
              <p className="fin-fine">
                The plan, the term and the installment count below come from this quotation and
                cannot be edited here. Change the quotation if any of them is wrong — a figure
                retyped beside a document is a figure that can disagree with it.
              </p>
            </div>
          ) : open.length ? (
            <div className="fin-pick">
              {open.map((c) => (
                <button key={c.quotation.quotationNumber} type="button"
                  onClick={() => { setQuotationNumber(c.quotation.quotationNumber); setInvoiceNumber(""); }}>
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
              <b>No open quotation for {chosenUser ? chosenUser.name : "this business"}.</b>{" "}
              {chains.length
                ? "Every accepted quotation of theirs is already recorded as a subscription, or its invoice has not been raised yet."
                : "Nothing was quoted to them — a website purchase, or a sale that never went through the chain."}{" "}
              Record it by hand below instead; the invoice still carries the money.
            </>} />
          )}
        </Fs>
      ) : null}

      {/* A quotation IS a sales close, so the channel stops being a question
          the moment one is attached. Asking it anyway invites the answer that
          contradicts the document. */}
      {quote ? null : (
        <Fs legend="How the sale happened" req
          hint="Both are recorded identically. The difference is who typed it, and it is what channel analytics and CAC read.">
          <Pick value={source} onChange={setSource} options={[
            { key: "sales", label: "Sales", help: "A salesperson closed it on a deal and recorded the payment against the invoice." },
            { key: "website", label: "Website", help: "The customer bought it themselves and paid through the gateway." },
          ]} />
        </Fs>
      )}

      {/* WHAT, FROM THE CATALOGUE. One choice carries the plan, the term and
          the price, so there is no second field for the term that could
          disagree with the first. */}
      <Fs legend="What was sold" req
        hint={quote
          ? "Read from " + quote.quotationNumber + " — the quotation is where this was agreed."
          : "From the live plan catalogue. The billing cycle carries both the term and the price."}>
        {quote ? (
          <div className="fin-derived">
            <b>{quote.planName}</b> · {quote.termMonths} month{quote.termMonths === 1 ? "" : "s"}
          </div>
        ) : plans && plans.length ? (
          <Field label="Plan and billing cycle"
            help="Choosing one sets the term and fills the total in below.">
            <div className="selectbox">
              <select value={choiceId} onChange={(e) => pickPlan(e.target.value)}>
                <option value="">Pick a plan…</option>
                {plans.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          </Field>
        ) : plansErr || (plans && !plans.length) ? (
          <>
            <Notice tone="warn" ico="alert" text={plansErr
              ? <><b>The plan catalogue could not be read.</b> {plansErr} The sale still happened, so it is still recordable — name the plan and its term by hand, and correct it against the catalogue later.</>
              : <><b>The catalogue has no active plan with an active billing cycle.</b> Add one in Plans, or name the plan by hand here.</>} />
            <div className="fin-f2">
              <Field label="Plan">
                <input className="inp" value={manualPlan} placeholder="As it appears on the invoice"
                  onChange={(e) => setManualPlan(e.target.value)} />
              </Field>
              <Field label="Term" help="How long the customer is entitled for. Not the number of installments.">
                <div className="selectbox">
                  <select value={String(manualMonths)} onChange={(e) => setManualMonths(Number(e.target.value))}>
                    {[1, 3, 6, 12].map((m) => <option key={m} value={m}>{m} month{m === 1 ? "" : "s"}</option>)}
                  </select>
                </div>
              </Field>
            </div>
          </>
        ) : <p className="fin-fine">Reading the plan catalogue…</p>}

        <Field label="Starts on" help="A subscription starts when it is sold, so this cannot be a future date.">
          <input type="date" className="inp" value={startDate} max={todayIso()}
            onChange={(e) => setStartDate(e.target.value)} />
        </Field>
      </Fs>

      {/* THE INVOICE CARRIES THE MONEY. Nobody types a total: the invoice is
          the document the customer owes against, and a figure typed beside it
          could only ever be a second opinion on the same money. */}
      <Fs legend="Attach the invoice" req
        hint={quote
          ? "The installment invoice raised on " + quote.quotationNumber + ". Not a choice — it is the document this subscription is recorded on."
          : "The subscription is recorded against the invoice raised for it. That document is what says how much is owed."}>
        {!userId ? (
          <p className="fin-fine">Pick the business first — the invoice has to be one of theirs.</p>
        ) : invoice ? (
          <div className="fin-inv">
            <div className="h">
              <span className="mono n">{invoice.invoiceNumber}</span>
              <span className={"pill " + (invoice.paymentStatus === "paid" ? "ok" : "warn")}>{invoice.paymentStatus}</span>
              <span className="spacer" />
              <button type="button" className="lnk" onClick={() => setInvoiceNumber("")}>Change</button>
            </div>
            <dl className="kv">
              <dt>Raised for</dt><dd>{invoice.customer.name}{invoice.customer.business ? " · " + invoice.customer.business : ""}</dd>
              <dt>Description</dt><dd>{invoice.description}</dd>
              <dt>Invoice date</dt><dd>{fmtDate(invoice.invoiceDate)} · due {fmtDate(invoice.dueDate)}</dd>
              <dt>Taxable</dt><dd className="tnum">{inr(invoice.taxablePaise)}</dd>
              <dt>Tax</dt><dd className="tnum">{inr(invoice.grandTotalPaise - invoice.taxablePaise)} · {invoice.placeOfSupply}</dd>
              <dt>Invoice total</dt><dd className="tnum b">{inr(invoice.grandTotalPaise)}</dd>
            </dl>
            {chosenPlan && chosenPlan.pricePaise !== invoice.grandTotalPaise ? (
              <Notice tone="warn" ico="alert" text={<>
                <b>The invoice and the catalogue disagree.</b> {chosenPlan.planName} lists at{" "}
                {inr(chosenPlan.pricePaise)}; this invoice is for {inr(invoice.grandTotalPaise)}.
                The invoice wins — it is what the customer owes — but check it was meant to.
              </>} />
            ) : null}
          </div>
        ) : invoices.length ? (
          <div className="fin-pick">
            {invoices.map((i) => (
              <button key={i.invoiceNumber} type="button" onClick={() => setInvoiceNumber(i.invoiceNumber)}>
                <span className="mono">{i.invoiceNumber}</span>
                <span className="s">{i.description} · {fmtDate(i.invoiceDate)} · {i.paymentStatus}</span>
                <span className="a">{inr(i.grandTotalPaise)}</span>
              </button>
            ))}
          </div>
        ) : (
          <Notice tone="warn" ico="alert" text={<>
            <b>{chosenUser ? chosenUser.name : "This customer"} has no invoice to attach.</b> Every issued
            invoice of theirs is already carried by another subscription, or none has been raised. Raise one
            in Invoices first — recording a subscription cannot invent the document it runs against.
          </>} />
        )}
      </Fs>

      <Fs legend="How it is paid" req
        hint={n === 1
          ? "One payment for the whole term, against the invoice attached above."
          : "One invoice per installment, each for the same amount. The schedule divides back exactly because of it."}>
        <div className="fin-f2">
          <Field label="Payment plan"
            help={quote
              ? "Agreed on " + quote.quotationNumber + ". The chain raises one invoice per installment as each falls due, so this is the count the quotation agreed — not the number of invoices that exist yet."
              : "Complete payment, or two to five installments. Beyond five it is a payment plan the sales chain raises no invoices for."}>
            {quote ? (
              <div className="fin-derived">
                {quote.installments === 1
                  ? <b>Complete payment</b>
                  : <><b>{quote.installments} installments</b>, {quote.installmentGapMonths} month apart</>}
              </div>
            ) : (
              <div className="selectbox">
                <select value={count} onChange={(e) => setCount(e.target.value)}>
                  {PAYMENT_PLANS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </div>
            )}
          </Field>
          <Field label="Subscription total"
            help={n === 1
              ? "The attached invoice. Not typed, so it cannot disagree with the document."
              : "The attached invoice, once per installment. Not typed, so it cannot disagree with the document."}>
            <div className="fin-derived tnum">
              {invoice
                ? (n === 1
                  ? <b>{inr(invoice.grandTotalPaise)}</b>
                  : <>{inr(invoice.grandTotalPaise)} × {n} = <b>{inr(invoice.grandTotalPaise * n)}</b></>)
                : "attach an invoice"}
            </div>
          </Field>
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
                  <span className="l">{i.of === 1 ? "Paid in full" : "Installment " + i.seq + " of " + i.of} · due {fmtDate(i.dueDate)}</span>
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

      <Notice tone="info" ico="lock" text={<>
        <b>Recording this entitles the customer now.</b> The subscription is live from its start date and
        the schedule exists in full — but every installment is created <em>due</em>, the absence of an
        event. None counts as collected until a payment is recorded against it, one at a time —
        <em>complete payment</em> included: it is one installment, not a receipt.
      </>} />
    </>)}
    </Dlg>
  );
}

/* ============================================ record a payment on one === */

export function RecordInstallmentModal({ sub, inst, onClose, onDone }: {
  sub: Subscription; inst: Installment; onClose: () => void; onDone: Done;
}) {
  const [mode, setMode] = useState(MODES[0] || "NEFT");
  const [reference, setReference] = useState("");
  const [valueDate, setValueDate] = useState(todayIso());
  const [accountId, setAccountId] = useState("");
  const [attachNo, setAttachNo] = useState("");
  const [err, setErr] = useState<string | null>(null);

  /* ONE INVOICE BILLS ONE INSTALLMENT. The chain raises them as each falls
     due, so an installment after the first usually arrives here without one,
     and this is where the two are joined up. The list is narrowed to invoices
     that would actually be accepted — this customer's, issued, unattached, and
     for exactly this installment's amount. */
  const already = readInvoice(inst.invoiceNumber);
  const offers = already ? [] : attachableForInstallment(sub.subscriptionId, inst.seq);
  const attached = already || offers.filter((i) => i.invoiceNumber === attachNo)[0] || null;

  const submit = () => {
    const r = recordInstallmentPayment({
      subscriptionId: sub.subscriptionId, seq: inst.seq,
      mode, reference, valueDate, accountId,
      invoiceNumber: already ? null : attachNo || null,
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

      <Fs legend="What was paid">
        <Field label="Amount"
          help="The installment's amount, in full, and not editable. An installment is paid or it is not — there is no part-paid installment to record, so there is no figure here to change.">
          <span className="inp ro tnum">{inr(inst.amountPaise)}</span>
        </Field>
      </Fs>

      {/* THE TAX INVOICE THIS INSTALLMENT IS BILLED ON. A receipt acknowledges
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
              {already ? null
                : <button type="button" className="lnk" onClick={() => setAttachNo("")}>Change</button>}
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
              <button key={i.invoiceNumber} type="button" onClick={() => setAttachNo(i.invoiceNumber)}>
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

      <Fs legend="How the money arrived" req>
        <div className="fin-f2">
          <Field label="Mode">
            <div className="selectbox">
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </Field>
          <Field label="Value date" help="The day the bank credited it, not the day you are typing. It cannot be in the future.">
            <input type="date" className="inp" value={valueDate} max={todayIso()}
              onChange={(e) => setValueDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Reference / UTR"
          help="Mandatory, and unique across the whole ledger. Without it nothing ties this row to a line on a bank statement, and a repeated webhook would write the same money twice.">
          <input className="inp mono" value={reference} autoFocus placeholder="NEFT0019AUG2213"
            onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field label="Credited to" help="The account the money actually landed in. It is picked, never assumed.">
          <div className="selectbox">
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Pick the account…</option>
              {accountOptions.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}
            </select>
          </div>
        </Field>
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
