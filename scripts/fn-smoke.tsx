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

import { readFileSync } from "node:fs";
import { cwd } from "node:process";
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
  BudgetModal, CancelTxnModal, DeactivateTagModal, TagModal, TxnModal,
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
/** Exactly one occurrence. `has` proves a thing is present and `hasnt` proves
 *  it is absent; neither can say "one and not three", which is the whole claim
 *  when three blocks are collapsed into one. */
const ok1 = (html: string, needle: string, what: string) => {
  const n = html.split(needle).length - 1;
  if (n === 1) console.log("  ok   " + what);
  else { failed++; console.log("  FAIL " + what + "\n         expected exactly 1, found " + n); }
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
/* THE STRIP EVERY LIST IN THIS PANEL CARRIES — a count, its label, the money
   it stands for, one row, each cell a filter. The three money tiles that stood
   here said the same three things at four times the height and matched no
   other list in the module. */
has(subs, "dls-attn", "...the money reads as the panel's own strip, not as tiles of its own");
has(subs, "Each carries its evidence on the record", "...fail to pay carries evidence, not a doubt");
has(subs, "Expected installments", "...what is due is named as installments, not as revenue");
has(subs, "Expected, not earned", "...and the caution says so in as many words");
has(subs, "Fail to pay", "...and it is a cell of its own, not a footnote");
/* THE CELL IS THE FILTER now: it is a link, so the address bar always says
   what is on screen. That is what cost the i buttons — an `i` inside a button
   would swallow half its own click target — and the cautions moved to `tip`,
   the strip's own description channel. */
has(subs, 'data-go="#/finance?flag=settled"', "...and a cell that counts something is the filter that shows it");
has(subs, "dls-tip", "...with the caution on the cell as a description, the way every other strip carries one");
hasnt(subs, "fin-mt", "...no tile is left on the list");
/* The running count is a LEVEL and the money is a period sum, so the caution
   keeps them apart wherever they are printed together. */
has(subs, "running", "...and the strip still refuses to let a period sum describe a level");

/* THE STRIP READS IN A DELIBERATE ORDER: what came in, then what is expected,
   then the one thing to act on — which ends the strip rather than interrupting
   it. Order is invisible to tsc and to every other check here, so it is pinned
   by position, not by presence. */
{
  const at3 = ["Collected", "Expected installments", "Fail to pay"]
    .map((t) => subs.indexOf(t));
  ok3("the strip runs Collected → Expected → Fail to pay", at3.every((n, i) => n >= 0 && (i === 0 || n > at3[i - 1])));
}
/* THE ANALYTICS TAB beside the records, the move Salaries A/C made with
   payroll. It is all time where the list is one period, it carries no filter
   control, and its four charts are four different cuts of the same rupees —
   never one axis, which would count every rupee four times. */
const subsAn = page("subscriptions · the analytics tab", "/finance?tab=analytics");
/* THE YEAR IS THE SCOPE AND THE ONLY CONTROL. The sentence that used to state
   the scope is gone: a dropdown that always carries a value says the same
   thing and changes it, which a sentence cannot. `All time` is a real answer
   rather than a blank meaning "not filtering". */
has(subsAn, 'aria-label="Year"', "...the analytics tab is scoped by a year control");
has(subsAn, ">All time<", "...whose first entry is a real answer, not an empty one");
has(subsAn, "The money · all time", "...and the block says which scope is on screen");
hasnt(subsAn, "Every subscription ever recorded", "...with no sentence left restating what the control says");
{
  /* One year is a subset of all of them, and the page says so in its own
     title rather than leaving the reader to guess what changed. */
  const y2026 = check("subscriptions · analytics for one year", () => at("/finance?tab=analytics&year=2026"));
  has(y2026, "The money · 2026", "...a year narrows the whole page, title included");
  const junk = check("subscriptions · analytics for a year nothing was sold in",
    () => at("/finance?tab=analytics&year=1999"));
  has(junk, "Nothing was sold in 1999", "...and a year with no sales says so rather than drawing empty charts");
}
/* THE CAPTIONS UNDER THE CHARTS ARE GONE — they were the widest text on the
   page, read once and never again, and every rule they carried is in a title
   or behind an `i`. */
hasnt(subsAn, "the ticks stay readable", "...no paragraph is left under a chart");
hasnt(subsAn, "card-f", "...and no block carries a footer at all");
/* THE SAME STRIP ANATOMY AS THE LIST TAB — label and i, the figure, a second
   figure of a different kind beside it, then what it counts and an offer to
   show it. Two strips in one module that read differently make a reader work
   out twice what they are looking at. */
has(subsAn, "Expected collection", "...the strip opens on the whole contracted value");
has(subsAn, "Expected installments", "...names what is still to come as installments, not as revenue");
has(subsAn, "Fail installments", "...and names what did not clear");
has(subsAn, "fin-mt-aside", "...Collected carries the active count as a second figure, not part of its own");
has(subsAn, "show only these", "...and a tile that counts something offers to show it, on the records where narrowing means something");
has(subsAn, "Collected, month by month", "...it reads the money over time");
has(subsAn, "Which plans are selling", "...which plans carry the revenue");
has(subsAn, "Where the sales came from", "...and where the business arrives from");
has(subsAn, "Every installment, by state", "...with the module's real workload counted one state each");
has(subsAn, "ch-chart", "...drawn with the panel's own chart kit, not a second one");
hasnt(subsAn, "Customer, subscription ID", "...and it carries no search box — a chart narrowed by a filter is a chart whose caption lies");
const subsFiltered = check("subscriptions · filtered to the defaulting ones", () => at("/finance?status=defaulting"));
const subsSettled = check("subscriptions · filtered to the ones that have settled something",
  () => at("/finance?flag=settled"));
has(subsSettled, "Settled", "...and the chip names the filter that was applied");
/* The cell TOGGLES: the one already applied points at the list without it, so
   pressing it again is the way back out. */
has(subsSettled, 'data-go="#/finance"', "...and the applied cell points back out of itself");
has(subsFiltered, "Defaulting", "...the filtered list still names the state it was filtered to");
/* WHEN IT STARTED — one param, three grains, the value saying which. Each is
   a prefix of the ISO start date, so one comparison answers all three and no
   second field can disagree with the first about what is being narrowed. */
{
  const all = at("/finance");
  const rowsIn = (html: string) => (html.match(/aria-label="Open SUB-/g) || []).length;
  const byYear = check("subscriptions · started in a year", () => at("/finance?started=2026"));
  const byMonth = check("subscriptions · started in a month", () => at("/finance?started=2026-08"));
  const byDay = check("subscriptions · started on one day", () => at("/finance?started=2026-08-21"));
  has(byYear, "Started", "...the chip names the filter");
  has(byMonth, "Aug 2026", "...a month value is printed as a month, not as an ISO string");
  ok3("a month narrows what the year matched", rowsIn(byMonth) > 0 && rowsIn(byMonth) <= rowsIn(byYear));
  ok3("a day narrows what the month matched", rowsIn(byDay) > 0 && rowsIn(byDay) <= rowsIn(byMonth));
  ok3("and every one of them is a subset of the whole list", rowsIn(byYear) <= rowsIn(all));
  /* The dropdown offers only months something was actually sold in — it is
     built from the records, never from a calendar. */
  has(all, 'data-filter="started"', "...the filter is offered on the list");
  hasnt(all, ">· Jan 2026<", "...and it offers no month nothing was sold in");
  /* THE DAY HALF IS A CALENDAR ICON AT REST. A bare date input prints
     `dd-mm-yyyy` when it is empty — a placeholder pretending to be a value,
     and the widest thing in a row of controls that each say one word. The
     native input is still the control, laid transparent over the icon. */
  has(all, "fin-datepick", "...and one exact day is picked from a calendar icon, not a dd-mm-yyyy box");
  has(all, 'type="date"', "...the platform's own picker is what opens, not a calendar of our own");
  hasnt(byDay, 'class="fin-datepick"', "...and once a day is picked the control says so rather than staying blank");
  has(byDay, "Clear the day", "...with a way to let go of it");
}
const subsEmpty = check("subscriptions · a filter that matches nothing", () => at("/finance?q=zzzznothing"));
has(subsEmpty, "Nothing matches those filters", "...an empty list says the filter is why");
has(subsEmpty, "counts every subscription in the module, before any filter",
  "...and says the figures above it are not what was filtered away");

const sal = page("salaries · the accounts tab", "/finance-salaries?tab=accounts");
/* The face OPENS on Transactions now: a bare URL lands on the slips. */
has(at("/finance-salaries"), 'aria-label="Actions for SLIP-',
  "salaries · the bare route lands on Transactions");
/* WHAT IS OWED, ON THE FACE. This used to assert the open run's card said
   nothing had gone out; the card is gone with the run vocabulary, and the same
   guarantee is now the table's own: a person who has not been paid says so,
   and the strip totals it. The word is "Unpaid" and not "pending" — see
   HELD_AS_A_STATE below, which is why. */
/* The four tiles became the panel's compact strip — the same anatomy as
   every list. What must survive the change: the owed figure is still stated
   (in the Unpaid cell), and the parts are still named. */
has(sal, 'class="k">Total', "...the strip leads with the stated Total");
has(sal, 'class="k">Monthly payroll', "...and the payroll figure rides at its end");
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
const salEmpty = check("salaries · a filter that matches nothing", () => at("/finance-salaries?tab=accounts&q=zzzznothing"));
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
/* THE FOUR TILES BECAME THE PANEL'S STRIP, the one every other list carries: a
   stated Total and then its parts, each cell a filter. The definitions the
   tiles carried on an `i` ride the cell's `tip` now — a cell is a BUTTON, and
   an `i` inside it would swallow half its own click target. */
has(txns, "dls-attn", "...the ledger carries the panel's own strip");
hasnt(txns, "fin-mt", "...and not the four tall tiles it used to, which matched no other list");
has(txns, "Missing a bill", "...a missing bill is a state, not an error");
has(txns, "Interest, own transfers and vendor refunds are the only",
  "...money in is named as three non-revenue kinds, on the cell it qualifies");
has(txns, "Excluded spend", "...and excluded spend is stated rather than left inside a total");
/* PAPER TRAIL IS OFF THE TABLE, and the two things it was actually watched for
   both survive it: the rail goes amber on a row missing a required bill, and
   the strip's `Missing a bill` cell is one press away. The filename and the
   bank match live on the record, in full. */
hasnt(txns, "no bill needed", "...the paper trail column is gone from the ledger");
hasnt(txns, "matched to bank", "...along with the bank-match line it carried");
has(txns, "Missing a bill", "...while the queue that actually needed watching is still a cell");
/* AND AN ACTIONS MENU IS ON EVERY ROW, where the chevron was. A wrong row is
   usually spotted while scanning the list, and making somebody open the record
   to act on it was a step that existed only because the menu lived there. */
has(txns, "Actions for TXN-0901", "...every row carries its own actions menu");
/* THE TRIGGER IS A WORD, NOT A THREE-DOT GLYPH. In a column with no header,
   beside nothing else pressable, the dots asked somebody to recognise a
   convention; the label asks nothing. */
has(txns, ">Actions</button>", "...and it says Actions rather than showing three dots");
has(txns, ">State<", "...and the last data column states whether a row still stands");
has(txns, "Cancelled", "...naming the one row in the seed that was written off");
has(txns, "clickable dim", "...which is dimmed the way every retired row in this module is");
const txnsFiltered = check("transactions · filtered to the ones missing a bill", () => at("/finance-transactions?flag=nobill"));
has(txnsFiltered, "TXN-0910", "...and the queue shows the rows that are actually missing one");
has(txnsFiltered, 'rail"><i class="warn"', "...each flagged on the rail, which is what the paper trail column left behind");
const txnsEmpty = check("transactions · a filter that matches nothing", () => at("/finance-transactions?q=zzzznothing"));
has(txnsEmpty, "Nothing matches those filters", "...an empty ledger says the filter is why");
has(txnsEmpty, "for the whole ledger before any filter", "...and that the tiles above it were not filtered");
const tags = page("transactions · the tags that file them", "/finance-transactions?tab=tags");
has(tags, "warns at 90% of itself and never blocks", "...a budget is a flag, not a wall");
has(tags, "lands in", "...and every tag says where its money lands");

/* ONE TABLE, WHERE THERE WERE THREE BANDS. The face stacked three sections —
   awaiting, approved-not-sent, settled — each with its own heading, its own
   empty state and a bespoke `.fin-q` row shape that existed nowhere else in
   the panel. Those are three different JOBS, which is true and was answered
   with three lists; the strip answers it with three filters, and the table is
   sorted by the same job order so the rows needing action are on top anyway. */
const refunds = page("refunds · the book", "/finance-refunds");
has(refunds, "dls-attn", "...refunds carry the panel's own strip");
ok1(refunds, 'class="tbl', "...and exactly ONE table, where there were three bands");
hasnt(refunds, "fin-queue", "...with the bespoke queue-row shape gone");
hasnt(refunds, "fin-mt", "...and the four read-out tiles gone with it");
has(refunds, "Nothing here has moved money", "...requests are named as requests");
has(refunds, "agreed to return and has not sent",
  "...approved-not-sent is real cash the company owes");
has(refunds, "Approval moves no money", "...and the gap between approved and paid is named");
/* THE JOB FILTERS. Two of the cells stand for a job rather than a state —
   awaiting is `requested` OR `sent_back` — which is why this face has its own
   `flag` beside the `state` filter. */
const refundsWaiting = check("refunds · awaiting a decision", () => at("/finance-refunds?flag=awaiting"));
has(refundsWaiting, "Awaiting a decision", "...the awaiting cell is a filter, not a section");
const refundsOwed = check("refunds · approved and not sent", () => at("/finance-refunds?flag=owed"));
has(refundsOwed, "Approved, not sent", "...and so is the one that owes money");
const refundsFiltered = check("refunds · filtered to the manual ones", () => at("/finance-refunds?origin=manual"));
has(refundsFiltered, "No ledger row behind this one", "...a manual refund says it has nothing behind it");
const refundsEmpty = check("refunds · a filter that matches nothing", () => at("/finance-refunds?q=zzzznothing"));
has(refundsEmpty, "Nothing matches those filters", "...an empty queue says the filter is why");
has(refundsEmpty, "counts the whole book before any filter", "...and that the strip above it was not filtered");

const an = page("analytics · the overview", "/finance-analytics");
has(an, "Analytics is not a fifth record type", "...analytics is the four lists read back, not a store");
has(an, "collected, spent, returned", "...the strip says what it is adding up");
/* THE DEPARTMENT BLOCK IS NO LONGER HERE. It moved to the Payroll tab and
   became year-scoped; asserting its ABSENCE is the half of the move that
   would otherwise rot — a second copy could reappear on Overview and every
   other check would still pass. */
hasnt(an, "Expenditure by department",
  "...and the department block is NOT on Overview any more — one figure, one page");
hasnt(an, ">Payroll<",
  "...and Payroll is NOT a tab here any more — it moved to Salaries A/C, beside its own runs");

/* ------------------------------------------------------------ the payslip -
   THE DOCUMENT, and the three things it used to get wrong. Each of these is
   a fix that would rot silently: nothing else in the suite reads the printed
   page, and the slip is the artefact somebody recalculates by hand. */
const slipInc = page("a payslip carrying an incentive",
  "/finance-salaries/SLIP-2026-07-0014");
has(slipInc, "Sales incentive", "...the incentive is a printed line, not an invisible addition");
has(slipInc, "earned", "...marked earned, so it is not read as salary that repeats");
/* ₹1,63,000 gross and ₹1,48,500 net, against ₹1,20,000 of base salary. The slip
   summed `earnings` alone and so printed the base as the gross — a document
   disagreeing with the transfer that produced it. These two needles are the
   whole bug, and they are the reason this check reads amounts rather than
   structure: the fault was arithmetic, not markup. */
has(slipInc, "1,63,000", "...gross INCLUDES the incentive, as the money that moved did");
has(slipInc, "1,48,500", "...and so does net, which is what the bank actually sent");
has(slipInc, "not payable again unless earned again",
  "...and the document says what an incentive is rather than leaving it to be assumed");

const slipLop = page("a payslip with loss of pay on it", "/finance-salaries/SLIP-2026-07-0033");
/* A NOTIONAL THIRTY-DAY MONTH IS NOT WHAT THIS MODULE COMPUTES, anywhere.
   The terms said it did, on the one page somebody checks the arithmetic of. */
hasnt(slipLop, "thirty-day month",
  "...the terms no longer claim a thirty-day month the module has never used");
has(slipLop, "29 paid days of 31", "...they state the month's real length instead");
has(slipLop, "Deductions are not pro-rated",
  "...and the deductions rule the seed and setLop now BOTH follow");

/* THE RECEIPT IS THE ONLY EVIDENCE A SALARY PAYMENT HAS — the typed bank
   reference was deleted precisely so it would be — and it was written to the
   slip and rendered on no screen in the module. */
has(page("the salary account record", "/finance-salaries/SAL-AC-0014?tab=slips"),
  "Evidenced by", "...the slips table names what a payment is evidenced BY");
has(at("/finance-salaries/SAL-AC-0014?tab=slips"), "of which earned",
  "...and shows the earned half inside a gross that would otherwise just jump");

const kpi = page("analytics · the KPI tab", "/finance-analytics?tab=kpi");
has(kpi, "not computed — and not zero", "...a KPI with no inputs prints a reason, never a placeholder");
/* --------------------------------------- the salaries analytics tab -----
   THE THIRD TAB ON SALARIES A/C, beside Transactions and Accounts — it reads
   the salary runs and belongs with them, not one section away among
   subscriptions and refunds.

   FOUR TOTALS AND THREE CHARTS. The page carried six blocks, six decision
   metrics and two wide tables, and the tables were the problem: they printed
   the same figures the charts above them drew, so every number appeared twice
   in two shapes. The assertions below pin what it shows AND what it must not
   grow back. */
const pay = page("salaries · the analytics tab", "/finance-salaries?tab=analytics");
has(pay, ">Transactions<", "...the tab band still offers Transactions");
has(pay, ">Accounts<", "...and Accounts");
/* BOTH CONTROLS ARE DROPDOWNS NOW, not segmented button strips: the year has
   two entries today and grows one a year, and the grouping has three whose
   labels are long enough that a strip wrapped in the block header. Neither is a
   FILTER, so neither carries the blank first option the panel Select uses for
   one — an entry meaning none would either do nothing or silently mean the
   default, and both readings are worse than not offering it. */
has(pay, "selectbox", "...the year control is a dropdown");
/* PLAIN, NOT BRAND-TINTED. `.selectbox.on` is the panel's "this filter is
   active" state — green so somebody can see at a glance which controls are
   narrowing a list. Neither of these narrows anything, so both would have been
   permanently green: a signal that never varies is not a signal, and it made
   two ordinary dropdowns read as applied filters somebody ought to clear. */
hasnt(pay, "selectbox on", "...and it is plain, not wearing the active-filter tint");
has(pay, ">Year<", "...labelled outside the control, not as a blank first option");
has(pay, ">Group by<", "...and the grouping is a dropdown too");
hasnt(pay, "fin-seg", "...with no segmented strip left on the page");
hasnt(pay, "dls-chips", "...and no filter chips, because nothing on this tab filters");
/* THE WINDOW CAVEAT MOVED BEHIND AN `i`, so it is no longer in the static
   markup — an InfoTip renders its panel only when opened. It is asserted where
   it now lives instead: in the vocabulary, on the caution of the very total it
   qualifies. A caution nobody can find is the same as one nobody wrote. */
has(pay, "fin-info-b", "...cautions are reachable from the page, behind an i");
{
  const vocab = readFileSync(cwd() + "/src/content/finance/vocabularies.json", "utf8");
  const cost = JSON.parse(vocab).payrollMetricDefinitions
    .filter((m: { key: string }) => m.key === "payroll_cost")[0];
  has(cost.caution, "JANUARY TO DECEMBER",
    "...and the window is stated on the total it qualifies, not as a banner");
  has(cost.caution, "will not match a filed return",
    "...saying outright that it is NOT the April-to-March year the books close on");
}
has(pay, ">2026<", "...and the year in force is named, not implied");

/* The four totals. */
has(pay, "The wage bill", "...the strip says what the year cost");
has(pay, "Paid out", "...what has gone out");
has(pay, "Still owed", "...what has not");
has(pay, "Incentives", "...and what was earned on top");

/* The three charts, and nothing between them. */
/* ONE CHART, THREE GROUPINGS. A month, a department and a person are three
   ways of cutting the same rupees, so they cannot share an axis — putting them
   side by side would count every rupee three times. They share a block
   instead, and the switch says which cut is on screen. */
has(pay, "Payroll · 2026", "...one chart block, named for the year it reads");
has(pay, "By month", "...the switch offers the month cut");
has(pay, "By department", "...the department cut");
has(pay, "By member", "...and the member cut");
/* THE POINT OF THE CHANGE, asserted directly: three charts became one, and
   nothing should quietly put the other two back. The needle is the full class
   attribute of the kit's figure wrapper — a bare `ch-chart` also matches
   `ch-chartbody` inside it, and would have counted two per chart. */
ok1(pay, "class=\"ch-chart\"", "...and there is exactly ONE chart on the page, not three");

/* The month cut answers what went out and what has not — a NET question only a
   month can answer, since a department has no due date. */
has(pay, "Paid out", "...the month cut splits what went out");
has(pay, "Not yet paid", "...from what has not");
has(pay, "net paid against net owed", "...and says which measure it is drawing");

const payDept = page("salaries · analytics grouped by department",
  "/finance-salaries?tab=analytics&by=department");
has(payDept, ">Sales<", "...the departments are on the axis");
has(payDept, ">Leadership<", "...leadership among them");
has(payDept, "Base salary", "...and the bars split committed pay");
has(payDept, ">Incentive<", "...from what had to be earned");
has(payDept, "gross, before deductions", "...stating the other measure, so the two are not confused");
hasnt(payDept, "Not yet paid",
  "...and the month-only series is NOT drawn here, because a department has no due date");

const payPerson = page("salaries · analytics grouped by member",
  "/finance-salaries?tab=analytics&by=member");
has(payPerson, "Base salary", "...members carry the same split as departments");
has(payPerson, "Anjali D.", "...named short enough to fit the axis");

const payBadBy = page("salaries · analytics with a nonsense grouping",
  "/finance-salaries?tab=analytics&by=zzzz");
has(payBadBy, "Paid out",
  "...an unknown ?by falls back to the month cut rather than an empty chart");

/* NO TABLES. This is the whole point of the rewrite, so it is asserted
   directly rather than inferred from the blocks that survived: `.tbl` is the
   panel's one table class, and an analytics face has no business carrying it
   when the two tabs beside it are tables that open records. */
hasnt(pay, 'class="tbl', "...and NOT ONE TABLE, which is what made the page confusing");
hasnt(pay, "of which earned", "...no month table restating the charts above it");
hasnt(pay, "not computed — and not zero",
  "...and no decision-metric block: six KPIs with year-on-year arrows went with the tables");
hasnt(pay, "fin-emp-pick", "...no employee picker — every person is on one chart now");

const payPrior = page("salaries · analytics, the year before",
  "/finance-salaries?tab=analytics&year=2025");
has(payPrior, ">2025<", "...the year switcher reaches a complete prior year");
has(payPrior, "By member", "...and the charts follow it");

const payBadFy = page("salaries · analytics with a nonsense year",
  "/finance-salaries?tab=analytics&year=1999");
has(payBadFy, ">2026<",
  "...an unknown ?year falls back to the current year rather than twelve empty columns");

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
/* The hash STAYS ON THE RECORD and off the paper: it is verification
   plumbing, and a 64-character string on a document handed to a person is
   noise they cannot check anyway. */
hasnt(paidSlip, "Document hash", "...the hash is not printed on the sheet");
has(paidSlip, "computer-generated and needs no signature", "...it is a document, not a screen");
const draftSlip = page("an open-run (draft) payslip", "/finance-salaries/SLIP-2026-08-0011");
/* The standing draft ALERT is gone; the draft state is still said twice on
   the page itself, and the sheet now carries the brand. */
has(draftSlip, "Draft", "...a draft slip is stamped as one, on the pill and on the sheet");
has(draftSlip, "no slip number has been allotted", "...and the terms say what a draft lacks");
has(draftSlip, 'class="fin-wm"', "...the watermark rides behind the sheet");
has(draftSlip, 'class="fin-slip-logo"', "...and the logo sits beside the company block");
/* The stamp is the one word Draft now — the terms at the foot carry the
   explanation, and the action row names the slip by id even as a draft. */
hasnt(draftSlip, "no slip number until the run is paid", "...the stamp is the one word Draft, not a sentence");
has(draftSlip, 'class="mono fin-slipid"', "...and the action row names the slip by id");

const oneTxn = page("a company transaction", "/finance-transactions/TXN-0901");
has(oneTxn, "never edited or deleted", "...posted is permanent, and so is the row itself");
has(oneTxn, "cancelled", "...with cancelling named as what to do about a row that should not stand");
has(oneTxn, "a new row, recorded the ordinary way", "...and a new row as where the right figures go");
/* THE ACTIONS MENU IS NOT ASSERTED HERE, and the reason is worth writing down
   rather than leaving as a gap. `can()` returns false without a session, so
   this harness renders every Finance page with NO write affordance at all —
   which means `hasnt(oneTxn, ">Attach a bill<")` would pass whether the button
   had been replaced by a menu or deleted outright. An assertion that passes for
   the wrong reason is worse than none, because it looks like cover.

   What IS asserted is the dialog the menu's Edit item opens, below, and the two
   things on this page that render regardless of permission. */
/* THE REMARK, which this page did not show at all: it was collected on the
   dialog and then only ever readable in the list's truncated column. */
has(oneTxn, "Remark", "...the remark is on the record now");
has(oneTxn, "fin-remark", "...as a sentence that wraps, not a truncated cell");
/* THE RECEIPT READS AS A FILE, where it was three rows of a key-value list. */
has(oneTxn, ">Receipt<", "...the bill block is a receipt section");
has(oneTxn, "fin-receipt", "...and the file reads as a file");
has(oneTxn, "holds the name, not the file",
  "...saying what it actually holds rather than offering a download that would do nothing");
/* A CORRECTED ROW SAYS SO, AND SAYS WHERE THE OLD VALUE WENT. The figures on
   screen are not the ones first posted, and somebody about to act on them
   deserves to know that before they do. */
const cancelled = page("a cancelled transaction", "/finance-transactions/TXN-0917");
has(cancelled, "This row has been cancelled", "...a cancelled row says so on its face");
has(cancelled, "Wrong contractor", "...and carries the reason somebody gave");
has(cancelled, "exactly as posted", "...saying its figures were not touched");
has(cancelled, "counts towards nothing", "...and naming the one thing that did change");
has(cancelled, "Cancelled by", "...the record names who wrote it off");
has(cancelled, "Sharma Carpentry Works", "...while the row still says what it said, unedited");
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

/* The sample tab is GONE — the dialog opens straight onto the form. */
hasnt(recSub, "use cases", "...the sample tab is gone, and the dialog opens on the form");
has(recSub, "Who bought it", "...opening on who bought it");
has(recSub, "Writes down a sale that has happened", "...it is named as what it does: it records a sale");
has(recSub, "Record subscription", "...and the button records rather than activates");
has(recSub, "Attach an invoice and the schedule appears here, dated, before anything is written",
  "...and the preview waits on the invoice, because the invoice is what sizes it");
/* THE CUSTOMER IS AN ACCOUNT, NOT A STRING. A typed name would be a customer
   the platform has never heard of, and nothing else in the panel could join
   to it. The picker searches the real user base. */
has(recSub, "IB-U-", "...the customer is picked from the real user base, never typed");
/* THE CHAIN IS MANDATORY. Only a business with an accepted quotation and its
   raised invoice is offered, and the plan, term, amount and installments are
   read from those documents — the catalogue picker and the manual path are
   gone with the sales that never went through the chain. */
hasnt(recSub, "Reading the plan catalogue", "...no catalogue picker — the quotation carries the plan and the term");
hasnt(recSub, "How the sale happened", "...and no channel question — a chained sale is a sales sale by definition");
hasnt(recSub, ">Starter<", "...no hardcoded plan is offered any more");
/* The label the user asked for. */
/* NOBODY TYPES A TOTAL any more. The invoice is the document the customer
   owes against, so a figure typed beside it could only ever be a second
   opinion on the same money. */
has(recSub, "The invoice", "...the money comes from the chain's invoice, not a typed figure");
has(recSub, "Pick the business first", "...and until a customer is chosen there is nothing to attach");
hasnt(recSub, "Total paid", "...no typed total is left to disagree with the invoice");
hasnt(recSub, "fin-rupee", "...and no rupee box at all");
has(recSub, "installment is created", "...every installment starts due — the absence of an event");
has(recSub, "Recording this entitles the customer now", "...it is live on recording, and the notice says so");

/* The strip's own words after the two figures came off it. */
hasnt(subs, "1 completed · 2 defaulting", "the Collected tile counts what it collected, nothing else");
const recInst = check("record an installment payment", () => modal(
  <RecordInstallmentModal sub={sub("SUB-0104")} inst={inst("SUB-0104", 2)} onClose={noop} onDone={noop} />));
has(recInst, "One write, and it is finished", "...recording settles it in one write");
has(recInst, "number is issued against it", "...and the receipt is issued in that same write");
has(recInst, "There is nothing to confirm afterwards", "...with nothing left to confirm and nobody to approve it");
/* THE INVOICE ANSWERS THE REST. Mode, reference and the receiving account
   are read off the document this money came in against rather than retyped,
   and the amount is the installment's own — so the only thing left to say is
   when the bank credited it. */
has(recInst, "Value date", "...the one fact the document cannot know is asked: when the bank credited it");
has(recInst, "Invoice · ", "...the business's own invoices are offered by name, so the document is picked not hunted");
has(recInst, "No invoice — the receipt will cite none", "...and citing none stays a deliberate choice");
hasnt(recInst, "Reference / UTR", "...the reference is read off the invoice, not retyped");
hasnt(recInst, "Credited to", "...and so is the account the money landed in");
hasnt(recInst, "Pick the account", "...with no account left to pick");
hasnt(recInst, "What was paid", "...no amount field: an installment is paid in full or not at all");
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
has(paySal, "Attach receipt", "...the receipt picker is drawn as a field, the box the whole control");
hasnt(paySal, "Image or PDF", "...with no standing caption — a wrong file is told what it takes when it happens");
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
/* EVERY CHOICE IS A DROPDOWN NOW, on the pay-salary dialog's shape: direction,
   credit kind and tag were three segmented pickers, the last of them a
   scrolling list of cards with a two-line description under every option — a
   screen and a half spent on three answers. */
has(txnM, "selectbox", "...the choices are dropdowns, like the pay dialog");
hasnt(txnM, "fin-pick", "...and the scrolling tag-card list is gone");
/* THE BANK STATEMENT'S TWO WORDS, and `out`/`in` are gone from what a person
   reads. CREDIT IS OFFERED FIRST, here and on the filter and in the strip —
   one ordering across the section. The stored value is untouched: the option's
   VALUE is still `out`/`in`, which is what the ledger holds. */
has(txnM, ">Credit<", "...direction is said in the words a bank statement uses");
has(txnM, ">Debit<", "...both ways");
hasnt(txnM, "Money out", "...and not as money out");
hasnt(txnM, "Money in", "...nor money in");
ok1(txnM, 'value="in"', "...credit is one option, not a second control");
/* Credit before Debit in the markup — the order they are read in. */
has(txnM, 'value="in">Credit</option><option value="out"',
  "...and credit is listed first, as it is everywhere else in the section");
/* The DEFAULT is still Debit, because most company rows are money out — a
   default is about the common case, and the list order is about reading. */
has(txnM, 'value="out" selected="">Debit',
  "...while Debit stays the default, which is the common case rather than the first row");
/* THE RECEIPT IS PART OF RECORDING THE ROW, to the same standard and with the
   same helpers as a salary payment's proof. */
has(txnM, "fin-filebox", "...a receipt is attached on the dialog, not chased afterwards");
/* THE ONE OPEN QUESTION GOES LAST, AND IN A BOX. Everything above Description
   is a choice from a list, an amount, a date or a file; a one-line input in
   the middle of those made the field that has to make sense to a stranger at
   audit look like the same size of answer as Mode. */
has(txnM, "<textarea", "...the description is a box, not a line");
has(txnM, "make sense to somebody else at audit",
  "...saying what it is for, in the placeholder rather than as a help line");
has(txnM, 'Account</span><div class="selectbox"',
  "...and Account is still a dropdown right before it");
has(txnM, "up to 5 MB", "...with the limit said before a file is picked, not after");
has(txnM, "disabled", "...and Record is disabled until there is one");
/* GROUPED BY WHERE THE MONEY LANDS — the one part of a tag that is not free,
   as structure rather than as a description line under each option. */
has(txnM, "optgroup", "...tags are grouped by where they land");
has(txnM, "Net line AND CAC", "...naming the destination on the group, not on every row");
has(txnM, "bill required", "...and an option says so, because that tag refuses the write without one");
/* THE STANDING PROSE IS GONE. The rule it carried — a row is a fact, and
   correcting one is its own audited act — is asserted where somebody MEETS it:
   on the update dialog, and on the record page. Both are below and above. */
hasnt(txnM, "nobody edits it; a correction is a counter-entry, never a rewrite",
  "...and the standing sub-line came off, with its rule moved to where it is acted on");
hasnt(txnM, "restricted to these three non-revenue kinds",
  "...as did the notice the store already enforces at the moment it refuses");
/* THE NaN GUARD. A partial seed once rendered NaN into the amount box; the
   amount, the budget and every rupee field in this dialog go through
   `toPaise`, which returns null rather than a number on anything half-typed.
   So: no NaN anywhere in the output, not just in the field it bit in. */
hasnt(txnM, "NaN", "...and no NaN reaches the output from an unfilled amount field");
/* THE CANCEL DIALOG IS A REASON AND TWO SENTENCES. There is nothing to choose:
   the row is named in the title and the consequence is the same every time, so
   the only thing it does not already know is why. */
const canM = check("cancel a transaction", () =>
  modal(<CancelTxnModal txn={txn("TXN-0901")} onClose={noop} onDone={noop} />));
has(canM, "Cancel TXN-0901", "...the dialog names the row it is about to write off");
has(canM, "Super Admin", "...and whose call it is");
has(canM, "<textarea", "...the reason is a box");
has(canM, "indistinguishable from a misclick", "...saying why the reason is mandatory");
hasnt(canM, "optgroup", "...with no form on it, because cancelling corrects nothing");
hasnt(canM, "fin-chk", "...and no standing checklist restating what cancelling does");

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
/* THE RECEIPT IS SET WHEN THE ROW IS WRITTEN AND NEVER AFTER. Nothing edits a
   posted row, so there is exactly one screen that takes a receipt, and it is
   the one that creates the row it belongs to. */
has(txnM, "fin-filebox", "...the receipt is picked, not typed");
has(txnM, "up to 5 MB", "...and held to a stated limit");

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
   reads a seeded figure as a live one — except the payslip pages, which shed
   their chrome: the slip is a DOCUMENT a person is handed, and the banner
   above a letterhead read as part of the letterhead. */
pages.forEach(([label, html]) => {
  if (/payslip/i.test(label)) hasnt(html, "fin-proto", "the proto banner stays off the document · " + label);
  else has(html, "fin-proto", "the proto banner is on · " + label);
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
/* THE SWITCH WITHIN A SECTION STAYS — Transactions/Tags and Overview/KPI are
   two views of one record type, not two sections. What changed is where
   Transactions/Tags SITS: it was a segmented strip below the filters, which
   said the two levels backwards, because the tab decides what the filters
   narrow. It is a view band above them now, like Subscriptions and Salaries
   A/C. Overview/KPI stays segmented: it sits inside a face that has no filter
   row of its own for it to be under. */
has(tags, "fin-views", "Transactions / Tags is a view band above the filters now");
hasnt(tags, "fin-subtabs", "...and no segmented strip is left under them");
has(tags, "dls-attn", "...the Tags tab gained a strip of its own, where it had none");
hasnt(tags, "notice", "...and lost the standing budget notice, which moved onto the cell it is about");
has(kpi, "fin-subtabs", "Overview / KPI is still a segmented sub-switch");


/* ==================================================== the chart marks === */
/* A MARK WITH NO FILL IS AN INVISIBLE MARK, and nothing else in this file can
   see one: `renderToStaticMarkup` gives markup, the CSS is bundled as `empty`,
   and every assertion above would pass just as happily against a chart drawn
   entirely in transparent spans.

   That is not hypothetical. `.ch-col` — the class `ColumnChart` puts on every
   bar — had no background rule at all, while `.fill` (BarRows, FunnelChart)
   and `.sw` (the legend swatch) both did. Six charts across Finance and Users
   drew correct heights, correct tooltips and correct legend swatches above a
   baseline with nothing over it, and no check could tell.

   So this one reads the stylesheet instead. */
console.log("\nthe chart marks are actually painted");
{
  const css = readFileSync(cwd() + "/src/admin/views/charts.css", "utf8");
  /* Emitted on a mark by ColumnChart (.ch-col), by BarRows and FunnelChart
     (.fill), and on the legend swatch (.sw) that has to match the mark it
     stands for. A slot missing from any of the three is a chart somebody
     cannot read. */
  const marks = ["ch-col", "fill", "sw"];
  ["s1", "s2", "s3"].forEach((slot) => {
    marks.forEach((mark) => {
      const painted = css.split("}").some((rule) => {
        const head = rule.split("{")[0] || "";
        const body = rule.split("{")[1] || "";
        return head.indexOf("." + mark + "." + slot) >= 0 && body.indexOf("background") >= 0;
      });
      has(painted ? "PAINTED" : "", "PAINTED",
        "." + mark + "." + slot + " is given a background, so the mark can be seen");
    });
  });
  /* The variables those rules read are scoped to .um, .um-rec and .fin, so a
     chart rendered outside all three would paint in nothing at all. */
  has(["--s1:", "--s2:", "--s3:"].every((v) => css.indexOf(v) >= 0) ? "PAINTED" : "", "PAINTED",
    "the slot palette is defined for the roots the charts sit in");
  has(at("/finance-salaries?tab=analytics"), "dls fin",
    "...and the Finance charts do sit inside one of them");
}


/* ================================================ the table cells ====== */
/* AN UNBOUNDED CELL TAKES THE TABLE. `.fin-tbl` sets a min-width and no column
   widths, so the browser shares space out by content — fine until one cell
   holds a paragraph. A held slip's reason is mandatory, has no length limit,
   and is 231 characters in this seed: printed in full it swelled the status
   column, starved the identifier column until `SLIP-2026-08-0014` wrapped
   across two lines, and took the paid-on column with it.

   Nothing above could see it. The markup was always correct; only the layout
   was wrong, and `renderToStaticMarkup` has no layout. So this reads the
   stylesheet, the way the chart-mark guard does. */
console.log("\nthe table cells are bounded");
{
  const css = readFileSync(cwd() + "/src/admin/views/Finance/finance.css", "utf8");
  const ruleFor = (sel: string) => css.split("}").filter((r) => (r.split("{")[0] || "").indexOf(sel) >= 0)
    .map((r) => r.split("{")[1] || "").join(" ");

  const slips = at("/finance-salaries");
  has(slips, "fin-c-slip", "the slip id has a column class of its own");
  has(ruleFor(".fin-c-slip"), "nowrap",
    "...and it is told not to wrap, because an id broken over two lines reads as two ids");

  has(slips, "fin-heldnote", "a held slip prints its reason on the row");
  has(ruleFor(".fin-heldnote"), "line-clamp",
    "...clamped rather than unbounded, so one long reason cannot take the table");
  has(ruleFor(".fin-heldnote"), "max-width", "...and bounded in width as well as lines");
  has(slips, "fin-heldnote\" title=",
    "...with the whole of it on the title, so clamping loses nothing");

  has(ruleFor(".fin-c-when"), "nowrap", "the paid-on column keeps its dates on one line");

  /* The same fault one table over, bounded before it bites: the longest
     description in the seed is 57 characters against the hold reason's 231,
     which is a fact about the fixture and not about the column. */
  has(at("/finance-transactions"), "fin-desc", "the transactions description is bounded too");
  has(ruleFor(".fin-desc"), "ellipsis", "...with an ellipsis rather than a wrap");

  /* A CARD CLIPS ITS CHILDREN and a chart's tooltip is a child that has to
     leave — it sits above the mark, which for the topmost bar is above the
     card's own edge. Clipped, hovering a chart looked like it did nothing.
     No static render can see this either: the markup was always right. */
  has(ruleFor(".fin-block:has(.ch-chart)"), "overflow: visible",
    "a block holding a chart lets its tooltips out of the card");
  has(ruleFor(".fin-block:has(.ch-chart)").length ? "SCOPED" : "", "SCOPED",
    "...and only that block, so a table's hover tint still keeps the corner");
}

/* ============================================ the charts answer a hover = */
console.log("\nhovering a chart mark says so");
{
  const css = readFileSync(cwd() + "/src/admin/views/charts.css", "utf8");
  const ruleFor = (sel: string) => css.split("}").filter((r) => (r.split("{")[0] || "").indexOf(sel) >= 0)
    .map((r) => r.split("{")[1] || "").join(" ");
  has(ruleFor(".ch-group:hover"), "background",
    "the hovered column band lights, so the tooltip is anchored to something");
  has(ruleFor(".ch-row[tabindex]:hover"), "background", "and so does the hovered bar row");
  /* A row with nothing to say must not promise anything: `tabIndex` is set
     exactly when the row carries a tooltip. */
  has(ruleFor(".ch-row[tabindex]:hover").length ? "GATED" : "", "GATED",
    "...but only a row that actually carries a tooltip");
}

resetStore();
console.log(failed ? "\n" + failed + " FAILED\n" : "\nevery surface rendered\n");
process.exit(failed ? 1 : 0);

