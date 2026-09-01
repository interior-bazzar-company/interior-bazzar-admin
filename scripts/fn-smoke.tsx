/* Render every Finance surface to a string and fail on any throw.

   A DOM stub, not a DOM — the same one the Users smoke uses, for the same
   reason: the shell reads theme and density off `document.documentElement`
   while it renders and there is no jsdom in this repo. The assertion is that
   the MODULE renders, not that the shell's appearance plumbing works
   headless. */
const el = () => ({
  getAttribute: () => null,
  setAttribute: () => {},
  removeAttribute: () => {},
  classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
  style: { setProperty: () => {} },
  appendChild: () => {}, removeChild: () => {}, contains: () => false,
  addEventListener: () => {}, removeEventListener: () => {},
  focus: () => {}, click: () => {}, querySelector: () => null, querySelectorAll: () => [],
});
const g = globalThis as unknown as Record<string, unknown>;
const doc = { ...el(), documentElement: el(), body: el(), createElement: el, activeElement: null };
g.document = doc;
g.window = {
  document: doc,
  addEventListener: () => {}, removeEventListener: () => {},
  matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  getComputedStyle: () => ({ getPropertyValue: () => "" }),
  print: () => {}, prompt: () => null,
  setTimeout, clearTimeout, requestAnimationFrame: (f: () => void) => setTimeout(f, 0),
};
g.localStorage = (g.window as Record<string, unknown>).localStorage;
g.matchMedia = (g.window as Record<string, unknown>).matchMedia;

import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ShellProvider } from "../src/admin/shell/ShellContext";
import Finance from "../src/admin/views/Finance";
import {
  CancelSubModal, FailToPayModal, RecordInstallmentModal, RecordSubModal, ReversePaymentModal,
} from "../src/admin/views/Finance/SubModals";
import {
  CloseAccountModal, LopModal, OpenRunModal, PaySalaryModal, SalaryAccountModal,
} from "../src/admin/views/Finance/SalaryModals";
import {
  BillModal, BudgetModal, DeactivateTagModal, ReverseTxnModal, TagModal, TxnModal,
} from "../src/admin/views/Finance/TxnModals";
import {
  DecideRefundModal, ManualRefundModal, RecordTransferModal, RequestRefundModal,
} from "../src/admin/views/Finance/RefundModals";
import {
  fmtMonth, readRefund, readRun, readSalaryAccount, readSlip, readSubscription, readTransaction,
  toSalaryRow, resetStore, tagOf,
} from "../src/admin/views/Finance/store";
import type {
  Installment, InstallmentPayment, Payslip, Refund, SalaryAccount, SalaryRun, Subscription, Tag,
  CompanyTxn,
} from "../src/admin/views/Finance/store";

const at = (url: string) => renderToStaticMarkup(
  <MemoryRouter initialEntries={[url]}>
    <ShellProvider>
      <Routes>
        {/* Five sidebar rows, one component. Each section is its own route
            so a grant can be held on one without the others. */}
        <Route path="/finance" element={<Finance />} />
        <Route path="/finance/:id" element={<Finance />} />
        <Route path="/finance-salaries" element={<Finance />} />
        <Route path="/finance-salaries/:id" element={<Finance />} />
        <Route path="/finance-transactions" element={<Finance />} />
        <Route path="/finance-transactions/:id" element={<Finance />} />
        <Route path="/finance-refunds" element={<Finance />} />
        <Route path="/finance-refunds/:id" element={<Finance />} />
        <Route path="/finance-analytics" element={<Finance />} />
      </Routes>
    </ShellProvider>
  </MemoryRouter>
);
const modal = (node: React.ReactNode) => renderToStaticMarkup(
  <MemoryRouter><ShellProvider>{node}</ShellProvider></MemoryRouter>
);
const noop = () => {};

/* Modal props come off the store, never off a hand-written object literal
   pretending to be a record: a fake Subscription proves the dialog renders
   something, not that it renders what the module actually holds. Each reader
   throws rather than returning a half-record, so a seed that loses an id fails
   the suite instead of quietly rendering an empty dialog. */
const need = <T,>(v: T | null | undefined, what: string): T => {
  if (!v) throw new Error("the seed has no " + what);
  return v;
};
const sub = (id: string): Subscription => need(readSubscription(id), id);
const inst = (id: string, seq: number): Installment =>
  need(sub(id).installments.filter((i) => i.seq === seq)[0], id + " installment " + seq);
const paid = (id: string, seq: number): InstallmentPayment =>
  need(inst(id, seq).payment, "a payment on " + id + " installment " + seq);
const account = (id: string): SalaryAccount => need(readSalaryAccount(id), id);
const run = (id: string): SalaryRun => need(readRun(id), id);
const slip = (id: string): Payslip => need(readSlip(id), id);
const txn = (id: string): CompanyTxn => need(readTransaction(id), id);
const refund = (id: string): Refund => need(readRefund(id), id);
const tag = (key: string): Tag => need(tagOf(key), "tag " + key);

let failed = 0;
function check(label: string, fn: () => string) {
  try {
    const html = fn();
    if (!html || html.length < 40) throw new Error("rendered almost nothing (" + html.length + " chars)");
    console.log("  ok   " + label);
    return html;
  } catch (e) {
    failed++;
    console.log("  FAIL " + label + "\n         " + (e as Error).message.split("\n")[0]);
    return "";
  }
}
const has = (html: string, needle: string, what: string) => {
  if (html.indexOf(needle) < 0) { failed++; console.log("  FAIL " + what + "\n         expected to find: " + needle); }
  else console.log("  ok   " + what);
};
/** The other half of `has`: a sentence the module promises NOT to say. */
const hasnt = (html: string, needle: string, what: string) => {
  if (html.indexOf(needle) >= 0) { failed++; console.log("  FAIL " + what + "\n         expected NOT to find: " + needle); }
  else console.log("  ok   " + what);
};
const hasntRe = (html: string, re: RegExp, what: string) => {
  const m = re.exec(html);
  if (m) { failed++; console.log("  FAIL " + what + "\n         expected NOT to match, but found: " + m[0].slice(0, 90)); }
  else console.log("  ok   " + what);
};

/* Every page this suite renders, kept for the cross-cutting checks at the end.
   A promise the module makes on one screen is worth nothing if another screen
   breaks it, so those are asserted over the whole set rather than page by
   page. */
const pages: [string, string][] = [];
/** For assertions whose subject is an ORDER rather than a needle. */
const ok3 = (label: string, cond: boolean) => {
  if (cond) { console.log("  ok   " + label); return; }
  failed++; console.log("  FAIL " + label);
};

const page = (label: string, url: string) => {
  const html = check(label, () => at(url));
  if (html) pages.push([label, html]);
  return html;
};

console.log("\nthe five faces");
const subs = page("subscriptions · the default face", "/finance");
has(subs, "each with its evidence on the record", "...fail to pay carries evidence, not a doubt");
/* The tile names it an expectation; the full caution — "expected, NOT EARNED,
   and only what is genuinely in front of each customer" — lives behind the i
   button, which a static render cannot open. So what is asserted here is the
   word on the tile and that the caution is reachable from it. */
has(subs, "· expected", "...what is due is named as an expectation, not as revenue");
/* Every money tile that counts something now offers to show it — Collected
   included, which had no link at all until now. */
has(subs, "show only these", "...and a tile that counts something offers to show it");
has(subs, "About Due next 30 days", "...and its caution is one press away");
hasnt(subs, "expected, not earned", "...the long form is not on the tile any more");
has(subs, "Fail to pay", "...and it is a money tile of its own, not a footnote");

/* THE STRIP READS IN A DELIBERATE ORDER: what came in and who is still paying,
   then what is expected, then the one thing to act on — which ends the strip
   rather than interrupting it. Order is invisible to tsc and to every other
   check here, so it is pinned by position, not by presence. */
{
  const at3 = ["Collected", "Due in the next 30 days", "Fail to pay"]
    .map((t) => subs.indexOf(t));
  ok3("the strip runs Collected → Due → Fail to pay", at3.every((n, i) => n >= 0 && (i === 0 || n > at3[i - 1])));
}
/* The two numbers in the first tile stay visibly different KINDS: a period sum
   and a level read now. If the count ever renders as part of the headline
   figure the tile starts claiming those subscriptions produced that money. */
has(subs, "fin-mt-aside", "...Collected carries the active count as a second figure, not part of its own");
/* The caution itself lives behind the i button, which a static render cannot
   open — so what is asserted is that it is REACHABLE from the second figure,
   which is the honest claim this harness can make about it. */
has(subs, "About Active subscriptions", "...and the count carries its own i button, so the caution is one press away");
const subsFiltered = check("subscriptions · filtered to the defaulting ones", () => at("/finance?status=defaulting"));
const subsSettled = check("subscriptions · filtered to the ones that have settled something",
  () => at("/finance?flag=settled"));
has(subsSettled, "Settled", "...and the chip names the filter that was applied");
has(subsSettled, "clear this filter", "...offering the way back out of it");
has(subsFiltered, "Defaulting", "...the filtered list still names the state it was filtered to");
const subsEmpty = check("subscriptions · a filter that matches nothing", () => at("/finance?q=zzzznothing"));
has(subsEmpty, "Nothing matches those filters", "...an empty list says the filter is why");
has(subsEmpty, "counts every subscription in the module, before any filter",
  "...and says the figures above it are not what was filtered away");

const sal = page("salaries · the face", "/finance-salaries");
/* WHAT IS OWED, ON THE FACE. This used to assert the open run's card said
   nothing had gone out; the card is gone with the run vocabulary, and the same
   guarantee is now the table's own: a person who has not been paid says so,
   and the strip totals it. The word is "Unpaid" and not "pending" — see
   HELD_AS_A_STATE below, which is why. */
has(sal, "Outstanding now", "...the face totals what is owed right now");
has(sal, ">Unpaid<", "...and a person who has not been paid says so on their row");
has(sal, "In arrears", "...with a month older than the current one called out separately");
/* THE CAUTION MOVED, IT DID NOT GO. "Payroll here is net paid to people" was a
   standing paragraph on the face and it was removed with the rest of the
   description. What it protected — that nobody reads this figure as cost to
   company — is FN-OD-06 and still matters, so it now lives on the metric's own
   i button, one press from the number it qualifies. A static render cannot open
   that panel, so what is asserted is that the button is THERE: the caution is
   reachable, and the day the tip is dropped from the tile this fails. */
has(sal, "About Salary cost", "...the payroll figure still carries its caution, one press away");
const salEmpty = check("salaries · a filter that matches nothing", () => at("/finance-salaries?q=zzzznothing"));
/* THE TRANSACTIONS TAB — every slip, one row each, with its own actions. */
const salTx = check("salaries · the transactions tab", () => at("/finance-salaries?tab=transactions"));
has(salTx, ">Accounts<", "...the sub-tabs offer Accounts");
has(salTx, ">Transactions<", "...and Transactions");
has(salTx, 'class="k">Total', "...the strip leads with the stated Total");
has(salTx, 'class="k">On hold', "...and On hold is one of its parts");
has(salTx, "SLIP-", "...and slip ids are the rows");
has(salTx, ">Paid<", "...a paid slip says so");
has(salTx, ">Unpaid<", "...an unpaid one too");
has(salTx, 'aria-label="Actions for SLIP-', "...every row carries its actions menu");
has(salTx, ">Status<", "...under a Status column");
check("salaries · transactions filtered to paid only", () => at("/finance-salaries?tab=transactions&status=paid"));
/* The pill, not the word: the status dropdown's own Unpaid OPTION is still
   on the page, and rightly. */
hasnt(at("/finance-salaries?tab=transactions&status=paid"), 'pill warn">Unpaid',
  "...and the paid filter leaves no unpaid row");
has(salEmpty, "Nobody matches those filters", "...an empty payroll says the filter is why");
has(salEmpty, "for the whole payroll, before any filter", "...and that the strip above it was not filtered");

const txns = page("transactions · the ledger", "/finance-transactions");
has(txns, "Missing a bill", "...a missing bill is a state, not an error");
has(txns, "interest, own transfers, vendor refunds only",
  "...money in is named as three non-revenue kinds");
const txnsFiltered = check("transactions · filtered to the ones missing a bill", () => at("/finance-transactions?flag=nobill"));
has(txnsFiltered, "Missing — required", "...and the queue shows the rows that are actually missing one");
const txnsEmpty = check("transactions · a filter that matches nothing", () => at("/finance-transactions?q=zzzznothing"));
has(txnsEmpty, "Nothing matches those filters", "...an empty ledger says the filter is why");
has(txnsEmpty, "for the whole ledger before any filter", "...and that the tiles above it were not filtered");
const tags = page("transactions · the tags that file them", "/finance-transactions?tab=tags");
has(tags, "warns at 90% of itself and never blocks", "...a budget is a flag, not a wall");
has(tags, "lands in", "...and every tag says where its money lands");

const refunds = page("refunds · three bands", "/finance-refunds");
has(refunds, "Nothing here has moved money", "...requests are named as requests");
has(refunds, "Money the company has agreed to return and has not sent",
  "...approved-not-sent is real cash the company owes");
const refundsFiltered = check("refunds · filtered to the manual ones", () => at("/finance-refunds?origin=manual"));
has(refundsFiltered, "No ledger row behind this one", "...a manual refund says it has nothing behind it");
const refundsEmpty = check("refunds · a filter that matches nothing", () => at("/finance-refunds?q=zzzznothing"));
has(refundsEmpty, "Nothing matches those filters", "...an empty queue says the filter is why");
has(refundsEmpty, "counts the whole queue before any filter", "...and that the tiles above it were not filtered");

const an = page("analytics · the overview", "/finance-analytics");
has(an, "Analytics is not a fifth record type", "...analytics is the four lists read back, not a store");
has(an, "collected, spent, returned", "...the strip says what it is adding up");
const kpi = page("analytics · the KPI tab", "/finance-analytics?tab=kpi");
has(kpi, "not computed — and not zero", "...a KPI with no inputs prints a reason, never a placeholder");

console.log("\nthe record screens");
const failing = page("a subscription with a fail to pay", "/finance/SUB-0104");
has(failing, "Declined by the bank", "...the failure names its reason from the closed list");
has(failing, "Razorpay returned BAD_REQUEST_ERROR on both attempts",
  "...and the evidence itself is on the page, in the gateway's own words");
has(failing, "attempt 2 · ", "...with the attempt count, because two declines is not one");
has(failing, "Fail to pay is money that was attempted and did not clear",
  "...fail to pay is stated as a fact, not a state of doubt");
const running = page("a subscription paid in full whose term is still running", "/finance/SUB-0101");
has(running, 'class="dot s-active"></span>Active', "...it reads Active — the money is in, the term is not over");
hasnt(running, "s-completed", "...and nowhere on it does it read Completed");
const receipt = page("its receipt", "/finance/SUB-0101?tab=receipt");
has(receipt, "IB-RCP-2026-00310", "...the receipt carries the number it was issued with");
has(receipt, "Received from", "...and reads as the document the customer holds");
const history = page("its history", "/finance/SUB-0101?tab=history");
has(history, "append-only", "...history is append-only, so nothing on it was rewritten");

const salAcc = page("a salary account", "/finance-salaries/SAL-AC-0011");
/* THE CTC CAUTION IS GONE BECAUSE THE FIGURE IS. It used to be asserted here
   that the record said cost to company must never be divided by twelve — a
   sentence that existed only to defend a number nothing computed and that
   FN-OD-06 already said was not cost to company. The field went; the caution
   went with it. What is asserted instead is the claim that survived, and the
   one that actually governs a slip: it is built from the typed components. */
has(salAcc, "Typed, never derived", "...the slip is built from the components and nothing else");
hasnt(salAcc, "Cost to company", "...and there is no CTC figure left to misread");
const paidSlip = page("a paid payslip", "/finance-salaries/SLIP-2026-07-0011");
has(paidSlip, "SLIP-2026-07-0011", "...a paid slip carries its number");
has(paidSlip, "Document hash (SHA-256): ", "...and its hash, because somebody has to be able to rely on it");
has(paidSlip, "computer-generated and needs no signature", "...it is a document, not a screen");
const draftSlip = page("an open-run (draft) payslip", "/finance-salaries/SLIP-2026-08-0011");
has(draftSlip, "Nobody has been paid yet", "...a draft slip says nobody has been paid");
has(draftSlip, "Draft — no slip number until the run is paid", "...and that the number waits on the payment");
hasnt(draftSlip, "SLIP-2026-08-0011", "...it carries no slip number stamp at all, not a greyed-out one");

const oneTxn = page("a company transaction", "/finance-transactions/TXN-0901");
has(oneTxn, "A recorded row is never edited", "...posted is permanent");
has(oneTxn, "a correction is a new counter-entry", "...and a correction is an append");
const counter = page("its counter-entry", "/finance-transactions/TXN-RV-0917");
has(counter, "This is a counter-entry", "...a counter-entry says which row it offsets");
has(counter, "nothing else about the original", "...and that the original was left alone");
const noBill = page("a transaction missing a bill", "/finance-transactions/TXN-0910");
has(noBill, "No bill attached", "...a missing bill is named");
has(noBill, "cannot close while it is missing", "...and it says what the absence costs");
const moneyIn = page("a money-in transaction", "/finance-transactions/TXN-0902");
has(moneyIn, "Credit kind", "...a credit names which of the three kinds it is");
has(moneyIn, "Customer money has exactly one way in", "...and that customer money does not come in here");

const subRefund = page("a subscription refund", "/finance-refunds/RF-0117");
has(subRefund, "The policy check", "...a refund with a payment behind it carries a policy check");
has(subRefund, "none of them blocks it", "...which frames the approval rather than gating it");
const manualRefund = page("a manual refund", "/finance-refunds/RF-0119");
has(manualRefund, "There is no original payment behind this refund", "...a manual refund states there is nothing behind it");
has(manualRefund, "exactly why this request carries no policy check",
  "...and why there is no policy check, rather than an empty one that would read as a pass");
const nowhere = page("an address that does not exist", "/finance/XXX-0000");
has(nowhere, "No subscription at that address", "...a wrong address is a wrong address, not an error page");
has(nowhere, "nothing in this module is ever", "...and it says why a missing record means a wrong address");

console.log("\nevery dialog");
const recSub = check("record a subscription", () => modal(<RecordSubModal onClose={noop} onDone={noop} />));

/* SAMPLE TAB — proto only. Delete this block with the tab; see SubSamples.tsx. */
has(recSub, "use cases", "...the sample tab is reachable from the dialog");
/* The chain fieldset appears only once a business is picked, so what is
   asserted here is that the RECORD tab is the one open by default. */
has(recSub, "Who bought it", "...and the record tab is the one that opens");
has(recSub, "Writes down a sale that has happened", "...it is named as what it does: it records a sale");
has(recSub, "Record subscription", "...and the button records rather than activates");
has(recSub, "the whole schedule is created with it", "...the schedule is created with it");
has(recSub, "Attach an invoice and the schedule appears here, dated, before anything is written",
  "...and the preview waits on the invoice, because the invoice is what sizes it");
/* THE CUSTOMER IS AN ACCOUNT, NOT A STRING. A typed name would be a customer
   the platform has never heard of, and nothing else in the panel could join
   to it. The picker searches the real user base. */
has(recSub, "Picked from the registered user base", "...the customer is picked, never typed");
has(recSub, "IB-U-", "...and the real user base is what it offers");
/* THE PLAN CARRIES THE TERM AND THE PRICE. There is no separate term field
   to disagree with it. Under SSR the catalogue fetch has not resolved, so
   what renders is the loading state — which is itself the thing worth
   pinning: the dialog says what it is doing rather than showing an empty
   select. */
has(recSub, "From the live plan catalogue", "...the plan comes from the catalogue, not a list copied into the file");
has(recSub, "Reading the plan catalogue", "...and while it loads the dialog says so rather than rendering an empty picker");
hasnt(recSub, ">Starter<", "...no hardcoded plan is offered any more");
/* The label the user asked for. */
/* NOBODY TYPES A TOTAL any more. The invoice is the document the customer
   owes against, so a figure typed beside it could only ever be a second
   opinion on the same money. */
has(recSub, "Attach the invoice", "...the money comes from an attached invoice, not a typed figure");
has(recSub, "Pick the business first", "...and until a customer is chosen there is nothing to attach");
hasnt(recSub, "Total paid", "...no typed total is left to disagree with the invoice");
hasnt(recSub, "fin-rupee", "...and no rupee box at all");
has(recSub, "every installment is created", "...every installment starts due — the absence of an event");
has(recSub, "Recording this entitles the customer now", "...it is live on recording, and the notice says so");

/* The strip's own words after the two figures came off it. */
hasnt(subs, "1 completed · 2 defaulting", "the Collected tile counts what it collected, nothing else");
const recInst = check("record an installment payment", () => modal(
  <RecordInstallmentModal sub={sub("SUB-0104")} inst={inst("SUB-0104", 2)} onClose={noop} onDone={noop} />));
has(recInst, "One write, and it is finished", "...recording settles it in one write");
has(recInst, "number is issued against it", "...and the receipt is issued in that same write");
has(recInst, "There is nothing to confirm afterwards", "...with nothing left to confirm and nobody to approve it");
const fail = check("record a fail to pay", () => modal(
  <FailToPayModal sub={sub("SUB-0104")} inst={inst("SUB-0104", 2)} onClose={noop} onDone={noop} />));
has(fail, "not</b> retry the charge", "...it does not retry the charge");
has(fail, "not</b> suspend the membership", "...and it does not suspend the membership");
has(fail, "A failure with no evidence is indistinguishable from a guess", "...evidence is mandatory, and it says why");
const reverse = check("reverse a payment", () => modal(
  <ReversePaymentModal sub={sub("SUB-0101")} inst={inst("SUB-0101", 1)} pay={paid("SUB-0101", 1)}
    onClose={noop} onDone={noop} />));
has(reverse, "IB-RCP-2026-00310</b> stay on the record", "...the receipt is retained, by number");
has(reverse, "more interesting to an auditor, not less", "...and the reason it is kept is stated");
has(reverse, "No money moves.", "...reversal corrects the ledger and moves nothing");
const cancel = check("cancel a subscription", () => modal(
  <CancelSubModal sub={sub("SUB-0102")} onClose={noop} onDone={noop} />));
has(cancel, "already collected is untouched", "...cancelling forward does not rewrite the past");
has(cancel, "This is not a refund.", "...and it is not a refund");

const newAcc = check("open a salary account", () => modal(
  <SalaryAccountModal onClose={noop} onDone={noop} />));
has(newAcc, "Net every month", "...the net a person actually gets is on screen as it is typed");
const reviseAcc = check("revise a salary account", () => modal(
  <SalaryAccountModal account={account("SAL-AC-0011")} onClose={noop} onDone={noop} />));
has(reviseAcc, "Rohit Malhotra", "...revising opens on the account it is revising");
const closeAcc = check("close a salary account", () => modal(
  <CloseAccountModal account={account("SAL-AC-0011")} onClose={noop} onDone={noop} />));
has(closeAcc, "The slips already issued stay on the record", "...closing keeps the slips");
has(closeAcc, "Final settlement is not computed here", "...and says what it deliberately does not do");
const openRunM = check("open a salary run", () => modal(<OpenRunModal onClose={noop} onDone={noop} />));
has(openRunM, "Each gets one slip, frozen at", "...every active account gets one slip, frozen");
has(openRunM, "One run a month", "...and there is one run a month");
const lop = check("loss of pay", () => modal(
  <LopModal slip={slip("SLIP-2026-08-0011")} onClose={noop} onDone={noop} />));
has(lop, "Earnings are pro-rated. Deductions are not", "...deductions are not pro-rated");
has(lop, "does not shrink because somebody was away", "...and it says why a flat levy stays flat");
/* PER PERSON NOW, not per run. The freeze guarantee is unchanged and still
   asserted; what changed is the unit it applies to — one person's outstanding
   months rather than everybody's at once — and that a run closes itself instead
   of being marked. SAL-AC-0011 is unpaid on the open August run, so this dialog
   has something to pay. */
const paySal = check("pay a salary", () => modal(
  <PaySalaryModal row={toSalaryRow(account("SAL-AC-0011"))} onClose={noop} onDone={noop} />));
/* THE STANDING DESCRIPTION IS GONE from this dialog — three notes that said
   the slips freeze, that it pays one person, and that a reference ties the
   payment to the bank. The first belongs in documentation, the second is the
   dialog's own title, and the third described a field that no longer exists.
   What is asserted now is the FORM: the method, the receipt that replaced the
   reference, and the absence of the reference itself. */
has(paySal, "Payment via", "...the method is a choice on the form");
has(paySal, "Bank transfer", "...with bank transfer among the options");
has(paySal, "Cash", "...and cash");
has(paySal, "Receipt", "...the receipt is asked for");
has(paySal, "Image or PDF", "...and it says what kind of file it takes");
hasnt(paySal, "Bank reference", "...the bank reference field is gone");
/* THE ADJUSTMENTS. Two named one-off lines that land on the newest slip, and
   a summary that must show the month being settled — the open run's month —
   before anybody presses anything. */
has(paySal, "Adjustments", "...the adjustments section is on the form");
has(paySal, "Add incentive or deduction", "...as rows somebody ADDS — no blank rows sitting there");
hasnt(paySal, 'aria-label="Adjustment kind"', "...so an untouched payment carries no adjustment row");
has(paySal, fmtMonth(run("RUN-2026-08").month), "...the summary names the month being settled");
has(paySal, "Leaving the account", "...and states what leaves the account");
has(paySal, "Remark", "...the remark rides at the bottom of the form");
/* The remark is the LAST input before the summary — about the whole payment,
   not part of it. Asserted by position, in the suite's own vocabulary. */
if (paySal.lastIndexOf("Remark") < paySal.indexOf("Add incentive or deduction")) {
  failed++;
  console.log("  FAIL the remark rides below the adjustments — it renders above them");
} else console.log("  ok   ...and it sits below the adjustments");
hasnt(paySal, "ties this to the bank", "...and so is the sentence that explained it");

/* TxnModal takes no seed. It used to, and the money-in branch — the Notice
   naming the three permitted non-revenue credit kinds — now lives behind local
   `direction` state that only a click sets, so a static render cannot reach it
   and this suite does not pretend to. The same guarantee IS asserted on two
   surfaces that render it without a click: the Transactions face names the
   three kinds on its money-in tile, and TXN-0902's record screen says customer
   money has exactly one way in. Both are above. */
const txnM = check("record a transaction", () => modal(<TxnModal onClose={noop} onDone={noop} />));
has(txnM, "nobody edits it; a correction is a counter-entry, never a rewrite",
  "...a recorded row is a fact and a correction is an append");
has(txnM, "Money in", "...money in is offered as a direction");
/* THE NaN GUARD. A partial seed once rendered NaN into the amount box; the
   amount, the budget and every rupee field in this dialog go through
   `toPaise`, which returns null rather than a number on anything half-typed.
   So: no NaN anywhere in the output, not just in the field it bit in. */
hasnt(txnM, "NaN", "...and no NaN reaches the output from an unfilled amount field");
const tagM = check("create a tag", () => modal(<TagModal onClose={noop} onDone={noop} />));
has(tagM, "it decides where the money lands in Analytics", "...the kind decides where the money lands");
has(tagM, "deactivated later, never deleted", "...and a tag is deactivated, never deleted");
has(tagM, "would silently re-bucket every transaction that already used it", "...with the reason deletion is not offered");
const budget = check("set a budget", () => modal(
  <BudgetModal tag={tag("rent")} onClose={noop} onDone={noop} />));
has(budget, "It never blocks", "...a budget never blocks");
hasnt(budget, "NaN", "...and a tag with a budget already set renders no NaN in the box");
const deact = check("deactivate a tag", () => modal(
  <DeactivateTagModal tag={tag("soft")} onClose={noop} onDone={noop} />));
has(deact, "nothing is re-bucketed", "...deactivating re-buckets nothing");
has(deact, "There is no reactivate here", "...and it does not pretend to be undoable");
const bill = check("attach a bill", () => modal(
  <BillModal txn={txn("TXN-0910")} onClose={noop} onDone={noop} />));
has(bill, "the filename is the whole record that a bill exists", "...the prototype says what it is recording");
const revTxn = check("reverse a transaction", () => modal(
  <ReverseTxnModal txn={txn("TXN-0901")} onClose={noop} onDone={noop} />));
has(revTxn, "A counter-entry is appended", "...a correction is an appended counter-entry");
has(revTxn, "itself is untouched", "...and the original row is untouched");

const reqRefund = check("request a refund", () => modal(<RequestRefundModal onClose={noop} onDone={noop} />));
has(reqRefund, "Full amount only", "...refunds are full-amount-only");
has(reqRefund, "1:1 rule says that cannot exist", "...for the 1:1 reason");
const manRefund = check("raise a manual refund", () => modal(<ManualRefundModal onClose={noop} onDone={noop} />));
has(manRefund, "There is no policy check on a manual refund", "...a manual refund states there is no policy check");
has(manRefund, "an empty check here would read as one that passed", "...and why an empty one would be worse");
has(manRefund, "this IS the evidence", "...the detail is the evidence, because nothing else is");
const decide = check("decide a refund", () => modal(
  <DecideRefundModal r={refund("RF-0117")} onClose={noop} onDone={noop} />));
has(decide, "It does NOT move money", "...approval moves no money");
has(decide, "never the same person", "...and the approver is never the requester");
const decline = check("decide a refund · opened on decline", () => modal(
  <DecideRefundModal r={refund("RF-0117")} initial="decline" onClose={noop} onDone={noop} />));
has(decline, "No transfer is authorised on this verdict", "...a decline authorises nothing");
const transfer = check("record a refund transfer", () => modal(
  <RecordTransferModal r={refund("RF-0125")} onClose={noop} onDone={noop} />));
has(transfer, "This is the write that makes the refund", "...this is the write that makes it paid");
has(transfer, "Nothing before this moved money", "...and nothing before it moved money");

console.log("\nthe premise, on screen");
/* RUNWAY. It returns null on purpose — FN-OD-07 — so the tile has to print the
   reason and no figure. `months` is runway's own unit and no other KPI uses
   it, so a value cell carrying one is a runway figure and nothing else. */
has(kpi, "Needs a reconciled cash balance and a burn history this seed does not carry",
  "the KPI tab prints runway's reason");
has(kpi, "FN-OD-07", "...attributed to the decision that made it null");
hasntRe(kpi, /class="v">[^<]*\bmonths?\b/i, "...and there is no runway figure anywhere on the page");

/* NO VERIFICATION VOCABULARY. Every row in this module exists because
   something occurred; there is no state meaning "recorded but not yet
   believed". Scoping, so this catches the thing and not a lookalike:
     · `verified` / `unverified` / `verification` are banned as whole words
       everywhere. `verifies` is NOT: the Salaries face says a salary run is
       "not a claim anybody verifies afterwards", which is the module denying
       the step, not offering it.
     · `submitted` is banned as a whole word, so a submit handler or a Submit
       button verb elsewhere in the panel could not trip it.
     · `held` is NOT banned outright. The module legitimately says a bank
       account number is "held masked" (custody of a detail, not of money) and
       one seeded bank narration reads "Held for five days, then recalled" — a
       quote from the bank inside a history event. Banned instead where it
       would be a payment STATE: the text of a status pill or tag. */
const VERIFY = /\b(?:verified|unverified|verification)\b/i;
const SUBMITTED = /\bsubmitted\b/i;
const HELD_AS_A_STATE = /class="(?:pill|fin-st|fin-cat|fin-path)[^"]*"[^>]*>(?:\s*<[^>]*>\s*)*(?:held|on hold|awaiting|pending)/i;
pages.forEach(([label, html]) => {
  hasntRe(html, VERIFY, "no verification vocabulary · " + label);
  hasntRe(html, SUBMITTED, "nothing is submitted · " + label);
  hasntRe(html, HELD_AS_A_STATE, "no money is held · " + label);
});

/* THE PROTO BANNER. Every face and every record screen renders it, so nobody
   reads a seeded figure as a live one. */
pages.forEach(([label, html]) => {
  has(html, "fin-proto", "the proto banner is on · " + label);
});
has(subs, "Nothing here is live.", "...and it says, in words, that nothing here is live");

/* NO IN-PAGE NAVIGATION. The five sections are sidebar rows now — separate
   module keys, resolved by ViewHost, which this harness deliberately does not
   render. What it CAN prove is the half that lives in the module: that no face
   grows a section-switching strip of its own back, which is what the sidebar
   would then be competing with. */
([["subscriptions", subs], ["salaries", sal], ["transactions", txns],
  ["tags", tags], ["refunds", refunds], ["analytics", an], ["kpi", kpi]] as [string, string][])
  .forEach(([label, html]) => {
    hasnt(html, "fin-tabbar", "no in-page section nav · " + label);
    ["Salaries A/C", "Other Transaction"].forEach((t) => {
      hasnt(html, ">" + t + "<", "...and no link naming another section · " + t + " · " + label);
    });
  });
/* The switch WITHIN a section stays, and stays segmented — Transactions/Tags
   and Overview/KPI are two views of one record type, not two sections. */
has(tags, "fin-subtabs", "Transactions / Tags is still a segmented sub-switch");
has(kpi, "fin-subtabs", "Overview / KPI is still a segmented sub-switch");

resetStore();
console.log(failed ? "\n" + failed + " FAILED\n" : "\nevery surface rendered\n");
process.exit(failed ? 1 : 0);

