/* =============================================================================
   check:finance — the ledger keeps its guarantees, and the seed proves it.
   -----------------------------------------------------------------------------
   Finance records four things and nothing else: a subscription sale paid in
   installments, a salary, a company expense or income under a tag, a refund.
   A ROW IS A FACT. Nothing here is awaiting a decision, and `fail_to_pay` is
   not the exception it looks like — it records a decline that occurred or a due
   date that demonstrably passed, and it carries the evidence.

   Every label below is a sentence about the business. When one fails, what
   broke should be readable without opening this file.

   Run: npm run check:finance
   (which bundles src/admin/views/Finance/store.ts to
    node_modules/.tmp/finance-store.cjs first, then runs this)
   ============================================================================= */
const S = require("../node_modules/.tmp/finance-store.cjs");
const bank = require("../src/content/finance/bank.json");
const vocab = require("../src/content/finance/vocabularies.json");

let failed = 0;
let total = 0;
function ok(label, actual, expected) {
  total++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) console.log("  ok   " + label);
  else { failed++; console.log("  FAIL " + label + "\n         expected " + e + "\n         got      " + a); }
}

const sumBy = (l, f) => l.reduce((n, x) => n + f(x), 0);
const money = (l) => sumBy(l, (x) => x.amountPaise);
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const has = (s, bit) => (s || "").indexOf(bit) >= 0;
const inAug = (d) => d.slice(0, 10) >= "2026-08-01" && d.slice(0, 10) <= "2026-08-31";
const allLines = () => {
  const m = {};
  bank.statements.forEach((st) => st.lines.forEach((l) => { m[l.lineId] = l; }));
  return m;
};
const allInstallments = () =>
  S.readSubscriptions().flatMap((s) => s.installments.map((i) => ({ s, i })));
const allSlips = () => S.readRuns().flatMap((r) => r.slips.map((p) => ({ r, p })));

/* ========================================================================== */
console.log("\nseed coherence — every reference points somewhere real");
S.resetStore();
{
  const lines = allLines();

  ok("every bank line a payment claims is on a statement",
    S.readPayments().filter((r) => r.pay.bankLineId && !lines[r.pay.bankLineId]).map((r) => r.pay.paymentId), []);
  ok("every bank line a transaction claims is on a statement",
    S.readTransactions().filter((t) => t.bankLineId && !lines[t.bankLineId]).map((t) => t.txnId), []);
  ok("a matched bank line is for the same money as the payment it settles",
    S.readPayments().filter((r) => r.pay.bankLineId && lines[r.pay.bankLineId].amountPaise !== r.pay.amountPaise)
      .map((r) => r.pay.paymentId), []);
  ok("a matched bank line is for the same money as the transaction it explains",
    S.readTransactions().filter((t) => t.bankLineId && lines[t.bankLineId].amountPaise !== Math.abs(t.amountPaise))
      .map((t) => t.txnId), []);
  ok("a payment is only ever matched to a credit — money coming in",
    S.readPayments().filter((r) => r.pay.bankLineId && lines[r.pay.bankLineId].dir !== "credit").map((r) => r.pay.paymentId), []);
  ok("money out is matched to a debit, money in to a credit",
    S.readTransactions().filter((t) => t.bankLineId
      && lines[t.bankLineId].dir !== (t.direction === "out" ? "debit" : "credit")).map((t) => t.txnId), []);
  ok("no bank line is claimed by two different rows", (() => {
    const claim = {};
    S.readPayments().forEach((r) => { if (r.pay.bankLineId) (claim[r.pay.bankLineId] = claim[r.pay.bankLineId] || []).push(r.pay.paymentId); });
    S.readTransactions().forEach((t) => { if (t.bankLineId) (claim[t.bankLineId] = claim[t.bankLineId] || []).push(t.txnId); });
    return Object.keys(claim).filter((k) => claim[k].length > 1);
  })(), []);

  ok("every tag a transaction uses exists",
    S.readTransactions().filter((t) => !S.tagOf(t.tagKey)).map((t) => t.txnId), []);
  ok("every tag rolls up to a kind the vocabulary knows",
    S.readTags().filter((t) => !S.tagKindMeta(t.kind)).map((t) => t.tagKey), []);
  /* A SUBSCRIPTION BELONGS TO AN ACCOUNT. recordSubscription refuses a
     customer who is not in the user base, so the seed has to hold to the same
     rule — and until the modal started resolving the id, it did not: some rows
     carried no userId and two pointed at a different company, invisible because
     nothing ever looked the id up. */
  ok("every subscription resolves to a registered user",
    S.readSubscriptions().filter((x) => !x.customer.userId || !S.readUser(x.customer.userId))
      .map((x) => x.subscriptionId + " → " + String(x.customer.userId)), []);
  ok("...and to the user of that NAME, not merely to some user",
    S.readSubscriptions().filter((x) => {
      const u = S.readUser(x.customer.userId);
      return !u || u.name !== x.customer.name;
    }).map((x) => x.subscriptionId + " says " + x.customer.name + ", " + String(x.customer.userId) + " is "
      + String((S.readUser(x.customer.userId) || {}).name)), []);

  ok("every subscription names the invoice it was activated against",
    S.readSubscriptions().filter((x) => x.invoiceNumber && !S.readInvoice(x.invoiceNumber))
      .map((x) => x.subscriptionId + " → " + x.invoiceNumber), []);
  ok("...and that invoice belongs to the same customer",
    S.readSubscriptions().filter((x) => {
      const i = x.invoiceNumber ? S.readInvoice(x.invoiceNumber) : null;
      return i && i.customer.userId !== x.customer.userId;
    }).map((x) => x.subscriptionId), []);
  ok("...and no two subscriptions were activated on the same invoice",
    (() => {
      const used = S.readSubscriptions().map((x) => x.invoiceNumber).filter(Boolean);
      return used.filter((v, i) => used.indexOf(v) !== i);
    })(), []);

  ok("every invoice an installment names exists",
    allInstallments().filter((x) => x.i.invoiceNumber && !S.readInvoice(x.i.invoiceNumber))
      .map((x) => x.s.subscriptionId + " → " + x.i.invoiceNumber), []);
  ok("every account a payment was credited to exists",
    S.readPayments().filter((r) => !S.accountOf(r.pay.accountId)).map((r) => r.pay.paymentId), []);
  ok("every account a transaction moved through exists",
    S.readTransactions().filter((t) => !S.accountOf(t.accountId)).map((t) => t.txnId), []);
  ok("every refund against a subscription points at a payment in the ledger",
    S.readRefunds().filter((r) => r.origin === "subscription" && !S.readPayment(r.paymentId)).map((r) => r.refundId), []);
  ok("every slip belongs to a salary account that exists",
    allSlips().filter((x) => !S.readSalaryAccount(x.p.salaryAccountId)).map((x) => x.p.slipId), []);

  const events = []
    .concat(S.readSubscriptions().flatMap((s) => s.events))
    .concat(S.readSalaryAccounts().flatMap((a) => a.events))
    .concat(S.readRuns().flatMap((r) => r.events))
    .concat(S.readTransactions().flatMap((t) => t.events))
    .concat(S.readRefunds().flatMap((r) => r.events));
  ok("every event type written anywhere is in the vocabulary",
    Array.from(new Set(events.map((e) => e.type).filter((t) => !S.eventMeta(t)))), []);
  ok("every event names an actor and a role",
    events.filter((e) => !e.actor || !e.actorRole).length, 0);

  ok("every installment status is one of the four the vocabulary allows",
    Array.from(new Set(allInstallments().map((x) => x.i.status).filter((s) => !S.instStatusMeta(s)))), []);
  ok("every subscription status is in the vocabulary",
    S.readSubscriptions().filter((s) => !S.subStatusMeta(s.status)).map((s) => s.subscriptionId), []);
  ok("every transaction state is in the vocabulary",
    S.readTransactions().filter((t) => !S.txnStateMeta(t.state)).map((t) => t.txnId), []);
  ok("every refund state and ground is in the vocabulary",
    S.readRefunds().filter((r) => !S.refundStateMeta(r.state) || !S.groundMeta(r.ground)).map((r) => r.refundId), []);

  const refs = []
    .concat(S.readPayments().map((r) => ({ ref: r.pay.reference, id: r.pay.paymentId })))
    .concat(S.readTransactions().map((t) => ({ ref: t.reference, id: t.txnId })))
    .concat(allSlips().filter((x) => x.p.reference).map((x) => ({ ref: x.p.reference, id: x.p.slipId })))
    .concat(S.readRefunds().filter((r) => r.settlement).map((r) => ({ ref: r.settlement.reference, id: r.refundId })));
  ok("every payment carries a reference — without it nothing ties to a statement",
    S.readPayments().filter((r) => !r.pay.reference.trim()).map((r) => r.pay.paymentId), []);
  ok("no reference is used twice across payments, transactions, slips and refund transfers", (() => {
    const seen = {}, dup = [];
    refs.forEach((r) => { const k = norm(r.ref); if (seen[k]) dup.push(r.ref); seen[k] = r.id; });
    return dup;
  })(), []);
}

/* ========================================================================== */
console.log("\nsubscriptions — the schedule is the contract");
S.resetStore();
{
  ok("a subscription's installments add up to the total it was sold for, to the paise",
    S.readSubscriptions().filter((s) => money(s.installments) !== s.totalPaise)
      .map((s) => s.subscriptionId + ": " + money(s.installments) + " ≠ " + s.totalPaise), []);
  ok("...even where the installments are deliberately uneven (SUB-0102)",
    money(S.readSubscription("SUB-0102").installments), 94400000);
  ok("installments run contiguously from 1",
    S.readSubscriptions().filter((s) => s.installments.some((i, k) => i.seq !== k + 1)).map((s) => s.subscriptionId), []);
  ok("every installment knows how many there are in the schedule",
    S.readSubscriptions().filter((s) => s.installments.some((i) => i.of !== s.installments.length)).map((s) => s.subscriptionId), []);
  ok("due dates run forward through the schedule",
    S.readSubscriptions().filter((s) => s.installments.some((i, k) => k > 0 && i.dueDate < s.installments[k - 1].dueDate))
      .map((s) => s.subscriptionId), []);

  ok("a paid installment has the payment that settled it",
    allInstallments().filter((x) => x.i.status === "paid" && !x.i.payment).map((x) => x.s.subscriptionId + "/" + x.i.seq), []);
  ok("...and no failure hanging off it",
    allInstallments().filter((x) => x.i.status === "paid" && x.i.failure).map((x) => x.s.subscriptionId + "/" + x.i.seq), []);
  ok("a fail-to-pay installment carries its evidence",
    allInstallments().filter((x) => x.i.status === "fail_to_pay" && !x.i.failure).map((x) => x.s.subscriptionId + "/" + x.i.seq), []);
  ok("...and no payment, because nothing arrived",
    allInstallments().filter((x) => x.i.status === "fail_to_pay" && x.i.payment).map((x) => x.s.subscriptionId + "/" + x.i.seq), []);
  ok("a due installment has neither — it is the absence of an event, not a claim about one",
    allInstallments().filter((x) => x.i.status === "due" && (x.i.payment || x.i.failure)).map((x) => x.s.subscriptionId + "/" + x.i.seq), []);

  ok("a payment settles its installment in full — one installment, one payment",
    S.readPayments().filter((r) => r.pay.amountPaise !== r.inst.amountPaise).map((r) => r.pay.paymentId), []);
  ok("every paid installment was receipted",
    allInstallments().filter((x) => x.i.status === "paid" && !(x.i.payment && x.i.payment.receipt))
      .map((x) => x.s.subscriptionId + "/" + x.i.seq), []);
  ok("every receipt is numbered, dated and hashed at issue",
    S.readPayments().filter((r) => r.pay.receipt
      && !(r.pay.receipt.number && r.pay.receipt.issuedAt && (r.pay.receipt.sha256 || "").length === 64))
      .map((r) => r.pay.paymentId), []);

  const failures = allInstallments().filter((x) => x.i.failure);
  ok("every failure names a reason the vocabulary knows",
    failures.filter((x) => !S.failureMeta(x.i.failure.reason)).map((x) => x.s.subscriptionId + "/" + x.i.seq), []);
  ok("every failure carries a note — evidence is mandatory, a guess is not a fact",
    failures.filter((x) => !(x.i.failure.note || "").trim()).map((x) => x.s.subscriptionId + "/" + x.i.seq), []);
  ok("every failure counts the attempts that were actually made",
    failures.filter((x) => !Number.isInteger(x.i.failure.attempt) || x.i.failure.attempt < 0)
      .map((x) => x.s.subscriptionId + "/" + x.i.seq), []);
  ok("...a decline counts its tries; a passed due date counts none, because nothing was attempted",
    failures.map((x) => x.s.subscriptionId + ":" + x.i.failure.reason + ":" + x.i.failure.attempt),
    ["SUB-0104:declined:2", "SUB-0105:overdue:0"]);
  ok("FAIL TO PAY IS A FACT: every 'due date passed' failure has a due date that actually passed",
    failures.filter((x) => x.i.failure.reason === "overdue" && S.daysPast(x.i.dueDate) <= 0)
      .map((x) => x.s.subscriptionId + "/" + x.i.seq + " due " + x.i.dueDate + " vs asOf " + S.todayIso()), []);
  ok("...SUB-0105's overdue installment fell due on 4 Aug, 21 days before the clock",
    [S.readSubscription("SUB-0105").installments[0].dueDate, S.daysPast("2026-08-04")], ["2026-08-04", 21]);
  ok("SUB-0104's failure is a real gateway decline, not a date",
    S.readSubscription("SUB-0104").installments[0].failure.reason, "declined");

  const live = (s) => s.installments.filter((i) => i.status !== "cancelled");
  ok("a subscription carrying a failed installment reads defaulting",
    S.readSubscriptions().filter((s) => s.status !== "cancelled" && s.status !== "refunded"
      && live(s).some((i) => i.status === "fail_to_pay") && s.status !== "defaulting")
      .map((s) => s.subscriptionId + " reads " + s.status), []);
  /* COMPLETED NEEDS BOTH. Paying every installment does not finish a
     subscription: a twelve-month plan settled up front on day one is paid in
     full with eleven months left to serve, and calling that "completed" would
     drop a live customer out of MRR the moment they paid. */
  ok("a subscription paid in full AND served to its end date reads completed",
    S.readSubscriptions().filter((s) => s.status !== "cancelled" && s.status !== "refunded"
      && live(s).length && live(s).every((i) => i.status === "paid")
      && s.endDate < S.todayIso() && s.status !== "completed")
      .map((s) => s.subscriptionId + " reads " + s.status), []);
  ok("...and one paid in full whose term is still running stays ACTIVE, so it stays in MRR",
    S.readSubscriptions().filter((s) => s.status !== "cancelled" && s.status !== "refunded"
      && live(s).length && live(s).every((i) => i.status === "paid")
      && s.endDate >= S.todayIso() && s.status !== "active")
      .map((s) => s.subscriptionId + " reads " + s.status), []);
  ok("...both cases actually occur in the seed, so neither rule is vacuous",
    [S.readSubscriptions().filter((s) => s.status === "completed").length > 0,
      S.readSubscriptions().filter((s) => s.status === "active"
        && live(s).length && live(s).every((i) => i.status === "paid")).length > 0], [true, true]);
  ok("a cancelled subscription has no live installment left to collect",
    S.readSubscriptions().filter((s) => s.status === "cancelled" && live(s).length).map((s) => s.subscriptionId), []);

  const row = S.toSubRow(S.readSubscription("SUB-0102"));
  ok("SUB-0102 reads one paid, one due, one cancelled", [row.paidN, row.dueN, row.failedN], [1, 1, 0]);
  ok("...₹2,47,800 collected and ₹6,37,200 still to come", [row.paidPaise, row.duePaise], [24780000, 63720000]);
  ok("the queue puts the subscriptions that need a person first",
    S.subRows().slice(0, 2).map((r) => r.s.subscriptionId).sort(), ["SUB-0104", "SUB-0105"]);
  ok("every installment in the module appears once in the flat queue",
    S.installmentRows().length, allInstallments().length);
}

/* ========================================================================== */
console.log("\nmoney — collected is what arrived");
S.resetStore();
{
  const o = S.overview();

  const countedByHand = S.readSubscriptions().flatMap((s) => s.installments
    .filter((i) => i.payment && (i.status === "paid" || s.status === "refunded") && inAug(i.payment.valueDate))
    .map((i) => i.payment));
  ok("collected is Σ the payments that actually arrived in August", o.collectedPaise, money(countedByHand));
  ok("...and counts four of them", o.collectedN, countedByHand.length);

  ok("PAY-4402 is in the ledger — a reference lookup must never hide a payment",
    S.readPayments().some((r) => r.pay.paymentId === "PAY-4402"), true);
  ok("...but its installment was cancelled and the bank recalled the money, so it is NOT collected",
    S.countedPayments().some((r) => r.pay.paymentId === "PAY-4402"), false);
  ok("...the recall is on the statement as a debit for the same amount and reference",
    bank.statements.flatMap((st) => st.lines)
      .filter((l) => l.dir === "debit" && l.reference === "421990045512" && l.amountPaise === 5900000).length, 1);
  ok("...counting it would overstate August by ₹59,000", money(countedByHand) + 5900000 - o.collectedPaise, 5900000);

  ok("PAY-4381 sits on a refunded subscription and IS collected — the money did arrive",
    S.countedPayments().some((r) => r.pay.paymentId === "PAY-4381"), true);
  ok("...it lands in July, the month it was paid",
    S.monthPoints().filter((m) => m.month === "2026-07")[0].subscriptionsPaise, 30490000);
  ok("...and the refund subtracts it separately in August, the month it left",
    [o.refundsPaidPaise, o.refundsPaidN], [990000, 1]);

  const out = S.readTransactions().filter((t) => t.direction === "out" && inAug(t.valueDate));
  const operating = out.filter((t) => S.tagOf(t.tagKey).kind !== "excluded");
  const excluded = out.filter((t) => S.tagOf(t.tagKey).kind === "excluded");
  ok("other spend is the operating rows only", o.otherOutPaise, money(operating));
  ok("a tax payment is real money leaving and is NOT operating spend",
    operating.some((t) => t.txnId === "TXN-0911"), false);
  ok("...it is counted apart, in full", [o.excludedPaise, money(excluded)], [540000, 540000]);
  ok("other income is Σ the credits in the period", o.otherInPaise,
    money(S.readTransactions().filter((t) => t.direction === "in" && inAug(t.valueDate))));
  ok("every hand-keyed credit is flagged non-revenue — customer money has one door",
    S.readTransactions().filter((t) => t.direction === "in" && !t.nonRevenue).map((t) => t.txnId), []);

  const pair = S.readTransactions().filter((t) => t.txnId === "TXN-0917" || t.txnId === "TXN-RV-0917");
  ok("a reversed transaction and its counter-entry both fall in August", pair.filter((t) => inAug(t.valueDate)).length, 2);
  ok("...and net to zero, so the month is not charged twice", money(pair), 0);
  ok("...the original row is untouched and still on the record",
    [pair.filter((t) => t.txnId === "TXN-0917")[0].amountPaise, pair.filter((t) => t.txnId === "TXN-0917")[0].state],
    [220000, "reversed"]);

  ok("salary cost counts only runs that were actually paid", [o.salaryPaise, o.salaryN], [0, 0]);
  ok("...the open August run of ₹5,01,000 contributes nothing until someone is paid",
    S.readRun("RUN-2026-08").state + "/" + S.readRun("RUN-2026-08").totalNetPaise, "open/50100000");
  ok("...July's paid run is the whole salary cost of July",
    S.overview("2026-07-01", "2026-07-31").salaryPaise, 49166437);

  ok("net = collected + other in − salary − other spend − refunds paid",
    o.netPaise, o.collectedPaise + o.otherInPaise - o.salaryPaise - o.otherOutPaise - o.refundsPaidPaise);
  ok("approved-and-not-sent is money owed and shown apart from refunds paid",
    [o.refundsOwedPaise, o.refundsOwedN], [1500000, 1]);
  ok("fail to pay is Σ the installments that did not clear", o.failedPaise,
    money(allInstallments().filter((x) => x.i.status === "fail_to_pay").map((x) => x.i)));
  /* DUE IS WHAT IS ACTUALLY IN FRONT OF SOMEBODY — not every unpaid row
     inside 30 days. One per subscription, none from a defaulting one, and
     never a row sitting behind an unpaid one. */
  ok("due next 30 days is the next payable installment of each active subscription",
    S.readSubscriptions().map((x) => S.nextDue(x)).filter((i) => i && i.dueDate <= "2026-09-24").length,
    o.dueNextN);
  ok("...and its amount is those installments, nothing else",
    o.dueNextPaise,
    money(S.readSubscriptions().map((x) => S.nextDue(x)).filter((i) => i && i.dueDate <= "2026-09-24")));

  /* The old rule counted every `due` row in the window. Assert the new figure
     is genuinely SMALLER than that, so the change is doing something rather
     than agreeing by coincidence on this seed. */
  ok("...which is fewer rows than every unpaid installment in the window",
    o.dueNextN < S.installmentRows()
      .filter((x) => x.i.status === "due" && x.i.dueDate <= "2026-09-24").length, true);

  ok("a defaulting subscription contributes nothing — its last attempt did not clear",
    S.readSubscriptions().filter((x) => x.status === "defaulting" && S.nextDue(x))
      .map((x) => x.subscriptionId), []);
  ok("...SUB-0104 is exactly that case: it HAS a due installment in the window and still counts for nothing",
    [S.nextDue(S.readSubscription("SUB-0104")),
      S.readSubscription("SUB-0104").installments
        .some((i) => i.status === "due" && i.dueDate <= "2026-09-24")],
    [null, true]);
  /* THE TWO RULES ARE SEPARATE, and on this seed they overlap: a defaulting
     subscription always carries a failure, and the walk stops at the first row
     that is not paid — so the failure alone would produce the same answer and
     the assertions above pass with the status guard removed. Probed and found
     exactly that. Each rule is therefore pinned on its own below, against a
     shape the seed cannot supply. */
  ok("the walk stops at a failure, so nothing behind one is ever next",
    S.nextDue({ status: "active", installments: [
      { seq: 1, status: "fail_to_pay", dueDate: "2026-08-01", amountPaise: 100 },
      { seq: 2, status: "due", dueDate: "2026-09-01", amountPaise: 100 },
    ] }), null);
  ok("...and a subscription that is not running has no next at all, whatever its schedule says",
    ["completed", "cancelled", "refunded"].filter((st) => S.nextDue({ status: st, installments: [
      { seq: 1, status: "due", dueDate: "2026-09-01", amountPaise: 100 },
    ] }) !== null), []);
  ok("...while the same schedule on an ACTIVE one does have a next, so that is not vacuous",
    (S.nextDue({ status: "active", installments: [
      { seq: 1, status: "due", dueDate: "2026-09-01", amountPaise: 100 },
    ] }) || {}).seq, 1);

  /* ONE PER SUBSCRIPTION, and it is the earliest live row — proved on a
     subscription that really does carry more than one `due` installment. */
  ok("only the earliest live installment counts, however many are due behind it",
    S.readSubscriptions().filter((x) => {
      /* Only where a next is expected at all — a defaulting subscription
         correctly has none, which the assertion above is what covers. */
      if (x.status !== "active") return false;
      const dues = x.installments.filter((i) => i.status === "due");
      if (dues.length < 2) return false;
      const n = S.nextDue(x);
      return !n || n.seq !== Math.min.apply(null, dues.map((i) => i.seq));
    }).map((x) => x.subscriptionId), []);
  ok("...and the seed does carry a subscription with two due rows, so that is not vacuous",
    S.readSubscriptions().some((x) => x.installments.filter((i) => i.status === "due").length >= 2), true);

  ok("an installment behind an unpaid one is not next — SUB-0107 reaches seq 2 only because seq 1 is paid",
    (() => {
      const x = S.readSubscription("SUB-0107");
      const n = S.nextDue(x);
      return [n.seq, x.installments.filter((i) => i.seq < n.seq).every((i) => i.status === "paid")];
    })(), [2, true]);

  ok("the list's own `what is next` reads the same rule, so the two cannot disagree",
    S.readSubscriptions().filter((x) => {
      const row = S.toSubRow(x);
      if (row.failedN) return false; /* a failure wins on the list, by design */
      const n = S.nextDue(x);
      return (row.next ? row.next.seq : null) !== (n ? n.seq : null);
    }).map((x) => x.subscriptionId), []);

  /* THE TILE AND ITS OWN FILTER MUST AGREE. They did not: the figure counted
     one installment per active subscription, while `flag=due` filtered on
     every `due` row a subscription had — so a defaulting one contributed
     nothing to the number and still appeared when you clicked it. */
  /* Each money tile that offers a link opens the rows it is counting. All
     three read a rule from the store rather than from the view, so a tile and
     the list it opens cannot drift apart. */
  ok("the Collected tile opens the subscriptions that have settled something",
    S.applySubFilters(S.subRows(), { flag: "settled" }).map((r) => r.s.subscriptionId).sort(),
    S.readSubscriptions().filter((x) => x.installments.some((i) => i.status === "paid"))
      .map((x) => x.subscriptionId).sort());
  ok("...and it is narrower than the whole list, so the link does something",
    S.applySubFilters(S.subRows(), { flag: "settled" }).length < S.subRows().length, true);
  ok("...and its chip names itself rather than showing the raw key",
    S.filterValueLabel("flag", "settled"), "Settled");

  ok("the Due FILTER lists exactly the subscriptions the Due figure counted",
    S.applySubFilters(S.subRows(), { flag: "due" }).map((r) => r.s.subscriptionId).sort(),
    S.readSubscriptions().filter((x) => S.nextDue(x)).map((x) => x.subscriptionId).sort());
  ok("...so nothing defaulting is in it",
    S.applySubFilters(S.subRows(), { flag: "due" })
      .filter((r) => r.s.status === "defaulting").map((r) => r.s.subscriptionId), []);
  /* Not vacuous: a subscription really would have been listed under the old
     rule, which is the whole reason this changed. */
  ok("...and one WOULD have been listed by the old `any due row` rule",
    S.subRows().filter((r) => r.dueN > 0 && !r.dueNext).map((r) => r.s.subscriptionId), ["SUB-0104"]);

  ok("the Active count is the subscriptions actually running", S.activeCount(),
    S.readSubscriptions().filter((x) => x.status === "active").length);
  ok("the month line agrees with the Overview it is drawn from",
    S.monthPoints().filter((m) => m.month === "2026-08")[0].netPaise, o.netPaise);

  const tiles = S.overviewTiles();
  ok("every Overview tile is a metric the vocabulary defines",
    tiles.filter((t) => !S.metric(t.key)).map((t) => t.key), []);
  ok("...and every tile carries the label the vocabulary gives it",
    tiles.filter((t) => t.label !== S.metric(t.key).label).map((t) => t.key), []);
  ok("no tile renders a number where the metric is unavailable",
    tiles.filter((t) => t.unavailable !== null && t.paise !== null).map((t) => t.key), []);
  ok("the collected tile shows the collected figure and its count",
    [tiles[0].key, tiles[0].paise, tiles[0].n], ["collected", o.collectedPaise, o.collectedN]);
  ok("the salary tile says plainly that no run was paid",
    tiles.filter((t) => t.key === "salary_cost")[0].sub, "no run paid in this period");
}

/* ========================================================================== */
console.log("\nsalaries — the slip is frozen");
S.resetStore();
{
  ok("a slip's gross is the sum of the earnings printed on it",
    allSlips().filter((x) => money(x.p.earnings) !== x.p.grossPaise).map((x) => x.p.slipId), []);
  ok("a slip's deductions are the sum of the deductions printed on it",
    allSlips().filter((x) => money(x.p.deductions) !== x.p.deductionsPaise).map((x) => x.p.slipId), []);
  ok("net is gross minus deductions, never CTC divided by twelve",
    allSlips().filter((x) => x.p.netPaise !== x.p.grossPaise - x.p.deductionsPaise).map((x) => x.p.slipId), []);
  ok("a run's total is the sum of its slips' net",
    S.readRuns().filter((r) => r.totalNetPaise !== sumBy(r.slips, (s) => s.netPaise)).map((r) => r.runId), []);
  ok("...July's ₹4,91,664.37 is six people, one of them on loss of pay",
    [S.readRun("RUN-2026-07").totalNetPaise, S.readRun("RUN-2026-07").slips.length], [49166437, 6]);
  ok("an account's monthly gross is the sum of its own earnings",
    S.readSalaryAccounts().filter((a) => money(a.earnings) !== a.monthlyGrossPaise).map((a) => a.salaryAccountId), []);
  ok("every slip names the month it is for",
    allSlips().filter((x) => x.p.month !== x.r.month).map((x) => x.p.slipId), []);
  const daysInMonth = (m) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate();
  ok("paid days and loss of pay account for every day of the month the slip is for",
    allSlips().filter((x) => x.p.paidDays + x.p.lopDays !== daysInMonth(x.p.month)).map((x) => x.p.slipId), []);

  const paidSlips = allSlips().filter((x) => x.r.state === "paid");
  const openSlips = allSlips().filter((x) => x.r.state === "open");
  ok("a slip on a paid run is stamped, referenced, issued and hashed",
    paidSlips.filter((x) => !(x.p.paidAt && x.p.reference && x.p.issuedAt && (x.p.sha256 || "").length === 64))
      .map((x) => x.p.slipId), []);
  ok("a slip on the open run has none of the four — nobody has been paid",
    openSlips.filter((x) => x.p.paidAt || x.p.reference || x.p.issuedAt || x.p.sha256).map((x) => x.p.slipId), []);
  ok("...and there are six of them waiting", openSlips.length, 6);
  ok("only one run is open at a time", S.readRuns().filter((r) => r.state === "open").length, 1);

  /* Karan Sethi was raised from ₹45,000 to ₹52,000 a month. */
  const acc = S.readSalaryAccount("SAL-AC-0022");
  const basic = (list) => list.filter((c) => c.key === "basic")[0].amountPaise;
  const june = S.readSlip("SLIP-2026-06-0022");
  const aug = S.readSlip("SLIP-2026-08-0022");
  ok("Karan Sethi's salary was revised — the account carries the event",
    acc.events.some((e) => e.type === "SALARY_REVISED"), true);
  ok("A RAISE CANNOT REWRITE AN OLD SLIP: June's basic differs from August's",
    [basic(june.earnings), basic(aug.earnings)], [2025000, 2340000]);
  ok("...June's slip still shows the old gross and net", [june.grossPaise, june.netPaise], [4500000, 4300000]);
  ok("...August's slip is built from what he is paid now", aug.grossPaise, acc.monthlyGrossPaise);
  ok("...and the old slip does not match the account it belongs to", basic(june.earnings) === basic(acc.earnings), false);

  const closed = S.readSalaryAccount("SAL-AC-0018");
  const monthsWithHim = S.readRuns().filter((r) => r.slips.some((s) => s.salaryAccountId === "SAL-AC-0018"))
    .map((r) => r.month).sort();
  ok("Vikram Chauhan's account is closed", closed.active, false);
  ok("...he was paid in June, before it closed", monthsWithHim, ["2026-06"]);
  ok("...and appears on no run after it", monthsWithHim.filter((m) => m > "2026-06"), []);
  ok("...his June slip stays on the record", !!S.readSlip("SLIP-2026-06-0018"), true);
  ok("the open run has a slip for every active account and nobody else",
    S.readRun("RUN-2026-08").slips.length, S.readSalaryAccounts().filter((a) => a.active).length);
}

/* ========================================================================== */
console.log("\nthe chain — deal → quotation → invoice → subscription");
S.resetStore();
{
  /* THE QUOTATION IS WHERE A SALE'S SHAPE IS AGREED and the invoice is one
     installment of it. Everything the record dialog fills in comes from here,
     so if these derivations are wrong the dialog is confidently wrong. */

  ok("every invoice that names a quotation names one that exists",
    S.readInvoices().filter((i) => i.quotationNumber
      && !S.readQuotation(i.quotationNumber)).length, 0);
  ok("...and one raised for the same customer",
    S.readInvoices().filter((i) => {
      const q = S.readQuotation(i.quotationNumber);
      return q && q.party.userId !== i.customer.userId;
    }).length, 0);
  ok("every quotation resolves to a registered user",
    S.readQuotations().filter((q) => !S.readUser(q.party.userId)).length, 0);
  ok("a quotation's tax adds up to its grand total",
    S.readQuotations().filter((q) =>
      q.taxablePaise + q.taxPaise !== q.grandTotalPaise).length, 0);
  ok("installment counts are all inside the 1–5 the write accepts",
    S.readQuotations().filter((q) => q.installments < 1 || q.installments > 5).length, 0);

  /* ONE INSTALLMENT IS A COMPLETE PAYMENT. There is no separate flag and there
     must not be one — two ways to say the same thing eventually disagree. */
  ok("no quotation carries a paidInFull / oneTime flag beside its count",
    S.readQuotations().filter((q) => "paidInFull" in q || "oneTime" in q).length, 0);

  /* A REJECTED QUOTATION IS NOT A SALE, so it is never offered. */
  const rejected = S.readQuotations().filter((q) => q.status !== "accepted")[0];
  ok("the seed carries a quotation that was not accepted", !!rejected, true);
  ok("...and it is not offered for its own customer",
    S.chainsFor(rejected.party.userId)
      .some((c) => c.quotation.quotationNumber === rejected.quotationNumber), false);

  /* THE WALKABLE PATHS — the whole point of seeding the chain. */
  const iyer = S.chainsFor("IB-U-1201");
  ok("Iyer Woodworks has two accepted quotations", iyer.length, 2);
  ok("...newest first", iyer[0].quotation.quotationNumber, "IB-QT-2026-00153");
  ok("...the older one is already recorded, and says which subscription",
    iyer[1].recordedAs, "SUB-0106");
  ok("...and has nothing left to attach", iyer[1].attachable, null);
  ok("...the newer one is open, with its invoice waiting",
    iyer[0].attachable && iyer[0].attachable.invoiceNumber, "IB-INV-2026-00092");
  ok("...and it is a complete payment, read from the quotation",
    iyer[0].quotation.installments, 1);

  const desai = S.chainsFor("IB-U-1012");
  ok("Desai Interiors has an open three-installment quotation",
    [desai.length, desai[0].quotation.installments], [1, 3]);
  ok("...with ONE invoice raised of the three", desai[0].invoices.length, 1);
  ok("...so counting documents would report the wrong plan — the count comes from the quotation",
    desai[0].invoices.length === desai[0].quotation.installments, false);

  ok("a business with no quotation at all has no chain",
    S.chainsFor("IB-U-0944").length, 0);

  /* THE TWO DEMOS — what the dialog produces, already in the seed so the
     finished shape can be read without recording one. */
  const a = S.readSubscription("SUB-0110");
  ok("SUB-0110 is a complete payment, recorded from a quotation",
    [a.paidInFull, a.installments.length, a.installments[0].status], [true, 1, "paid"]);
  ok("...and its invoice is the one its quotation was billed on",
    S.readInvoice(a.invoiceNumber).quotationNumber, "IB-QT-2026-00160");
  ok("...paidInFull agrees with the quotation, not merely with the row count",
    S.readQuotation("IB-QT-2026-00160").installments, 1);
  ok("...and the money matches the invoice exactly",
    a.totalPaise, S.readInvoice(a.invoiceNumber).grandTotalPaise);

  const b = S.readSubscription("SUB-0111");
  ok("SUB-0111 is a running three-installment plan",
    [b.paidInFull, b.installments.length], [false, 3]);
  ok("...one paid, two due", b.installments.map((i) => i.status), ["paid", "due", "due"]);
  ok("...with TWO invoices for THREE installments — the third is not raised yet",
    b.installments.filter((i) => i.invoiceNumber).length, 2);
  ok("...so counting its invoices would report the wrong plan",
    b.installments.filter((i) => i.invoiceNumber).length === b.installments.length, false);
  ok("...and the quotation is the one that says three",
    S.readQuotation("IB-QT-2026-00161").installments, 3);
  ok("...every installment is one invoice's worth",
    b.installments.every((i) => i.amountPaise === S.readInvoice(b.invoiceNumber).grandTotalPaise), true);
  ok("...and they sum to the quotation's agreed total",
    b.totalPaise, S.readQuotation("IB-QT-2026-00161").grandTotalPaise);

  /* THE COUNT IS THE QUOTATION'S, AND THE STORE ENFORCES IT. The dialog reads
     it and can never send a mismatch; this is for every other caller. */
  const base = {
    userId: "IB-U-1012", source: "sales", planId: "PL-QUOTED", planName: "Growth",
    cycleMonths: 6, invoiceNumber: "IB-INV-2026-00094", startDate: "2026-08-25",
  };
  ok("recording that quotation's own plan is accepted",
    S.recordSubscription({ ...base, installmentCount: 3 }).error, "");
  S.resetStore();
  ok("...but a different count is refused against the quotation that agreed it",
    has(S.recordSubscription({ ...base, installmentCount: 1 }).error, "plan_mismatch"), true);
  ok("...and the refusal names both numbers, so it can be acted on",
    has(S.recordSubscription({ ...base, installmentCount: 1 }).error, "3 installments"), true);

  /* An invoice with NO quotation behind it is the website purchase, and the
     count is then a real choice rather than a contradiction. */
  S.resetStore();
  ok("an invoice with no quotation accepts any count — nothing agreed otherwise",
    S.recordSubscription({
      userId: "IB-U-0944", source: "website", planId: "PL-MANUAL", planName: "Starter",
      cycleMonths: 3, invoiceNumber: "IB-INV-2026-00097", installmentCount: 2,
      startDate: "2026-08-25",
    }).error, "");
  S.resetStore();
}

/* ========================================================================== */
console.log("\nwrites · recording a subscription — each refusal is the contract");
S.resetStore();
{
  /* A REAL ACCOUNT and a REAL INVOICE. Activation entitles a business to a
     plan, so it needs the customer it is entitling and the document that
     says what they bought. Both are taken from the seed rather than
     hard-coded, so this keeps working when the seed changes. */
  const buyer = S.readUsers().filter((u) => S.attachableInvoices(u.userId).length)[0];
  ok("some registered customer has an invoice free to attach", !!buyer, true);
  const inv = S.attachableInvoices(buyer.userId)[0];
  ok("...and it is issued, theirs, and carried by nothing else",
    [inv.status, inv.customer.userId === buyer.userId], ["issued", true]);

  const base = {
    userId: buyer.userId, source: "sales", planId: "PL-STARTER", planName: "Starter",
    cycleMonths: 12, invoiceNumber: inv.invoiceNumber, installmentCount: 2, startDate: "2026-08-01",
  };
  ok("a customer who is not in the user base is refused",
    has(S.recordSubscription({ ...base, userId: "IB-U-NOBODY" }).error, "registered account"), true);
  ok("recording with no invoice is refused — it is what says the customer owes",
    has(S.recordSubscription({ ...base, invoiceNumber: "" }).error, "Attach the invoice"), true);
  ok("an invoice that was cancelled cannot entitle anybody",
    has(S.recordSubscription({ ...base, invoiceNumber: "IB-INV-2026-00087" }).error, "invoice_not_open"), true);
  ok("...nor one raised for a different customer",
    (() => {
      const other = S.readInvoices().filter((i) => i.status === "issued" && i.customer.userId !== buyer.userId)[0];
      return has(S.recordSubscription({ ...base, invoiceNumber: other.invoiceNumber }).error, "customer_mismatch");
    })(), true);
  ok("...nor one another subscription already carries",
    (() => {
      const taken = S.readSubscriptions().filter((x) => x.invoiceNumber)[0];
      return has(S.recordSubscription({ ...base, userId: S.readSubscription(taken.subscriptionId).customer.userId,
        invoiceNumber: taken.invoiceNumber }).error, "duplicate_invoice");
    })(), true);
  ok("more than five installments is refused",
    has(S.recordSubscription({ ...base, installmentCount: 6 }).error, "Between 1 and 5 installments"), true);
  ok("a subscription cannot start in the future — entitlement begins when it begins",
    has(S.recordSubscription({ ...base, startDate: "2026-12-01" }).error, "cannot be in the future"), true);

  const r = S.recordSubscription(base);
  ok("a clean activation is accepted", r.error, "");
  const sub = S.readSubscription(r.subscriptionId);
  ok("...the whole schedule exists from day one", sub.installments.length, 2);
  ok("...activated against the account, with the name resolved from it, not typed",
    [sub.customer.userId, sub.customer.name], [buyer.userId, buyer.name]);
  /* NOBODY TYPED A TOTAL. One invoice per installment, each for the same
     amount, so the total is the invoice times the count — and the schedule
     divides back into it exactly by construction rather than by luck. */
  ok("...the total is the attached invoice, once per installment",
    sub.totalPaise, inv.grandTotalPaise * 2);
  ok("...and the schedule adds back to it exactly",
    sub.installments.reduce((t, i) => t + i.amountPaise, 0), sub.totalPaise);
  ok("...every installment is the invoice amount",
    sub.installments.filter((i) => i.amountPaise !== inv.grandTotalPaise).length, 0);
  ok("...the invoice is carried by the subscription and by the first installment",
    [sub.invoiceNumber, sub.installments[0].invoiceNumber], [inv.invoiceNumber, inv.invoiceNumber]);
  ok("...and the later ones carry none, because they are raised as they fall due",
    sub.installments.slice(1).filter((i) => i.invoiceNumber).length, 0);
  ok("...it is live, and the timeline says it was RECORDED, not activated",
    [sub.status, sub.events[sub.events.length - 1].type], ["active", "SUBSCRIPTION_RECORDED"]);
  ok("...it records who wrote it down, and when",
    [sub.recordedBy === sub.soldBy, !!sub.recordedAt], [true, true]);
  ok("...every installment starts due — recording entitles, it does not collect",
    sub.installments.filter((i) => i.status !== "due").length, 0);
  ok("the invoice cannot then be attached to a second subscription",
    has(S.recordSubscription({ ...base, installmentCount: 1 }).error, "duplicate_invoice"), true);
}

console.log("\nwrites · billing an installment — one invoice, one installment");
S.resetStore();
{
  /* THE CHAIN RAISES ONE INVOICE PER INSTALLMENT as each falls due, so an
     installment after the first arrives at payment time without one. It is
     attached here, and the receipt cites it — issued with none, the receipt
     prints a dash where the tax invoice should be. */
  const sub = S.readSubscription("SUB-0107");
  const unbilled = sub.installments.filter((i) => i.status === "due" && !i.invoiceNumber)[0];
  ok("a later installment is due and carries no invoice yet", !!unbilled, true);

  const P = {
    subscriptionId: sub.subscriptionId, seq: unbilled.seq, mode: "NEFT",
    valueDate: "2026-08-24", accountId: "ACC-HDFC-4021",
  };
  ok("an invoice that does not exist cannot be attached",
    has(S.recordInstallmentPayment({ ...P, reference: "AT-1", invoiceNumber: "IB-INV-NOPE" }).error,
      "does not exist"), true);
  ok("...nor a cancelled one, because a receipt cannot cite it",
    has(S.recordInstallmentPayment({ ...P, reference: "AT-2", invoiceNumber: "IB-INV-2026-00087" }).error,
      "invoice_not_open"), true);
  ok("...nor one raised for a different customer",
    (() => {
      const other = S.readInvoices().filter((i) => i.status === "issued"
        && i.customer.userId !== sub.customer.userId)[0];
      return has(S.recordInstallmentPayment({ ...P, reference: "AT-3", invoiceNumber: other.invoiceNumber }).error,
        "customer_mismatch");
    })(), true);
  /* ONE INVOICE BILLS ONE INSTALLMENT, for what that installment is — an
     invoice for another figure is an invoice for another thing.

     THIS USED TO BE UNREACHABLE. No customer in the seed held both an unbilled
     installment and a second issued invoice of a different amount, so the rule
     could only be asserted through the picker. The invoices added on 2026-08-31
     so the subscription flow could be walked made it reachable, and the note
     that stood here said this is the comment to delete when they did. The
     write-level guard is asserted directly, below. */
  ok("an invoice for a different amount is refused at the WRITE, not only hidden by the picker",
    (() => {
      const wrong = S.readInvoices().filter((v) => v.status === "issued"
        && v.customer.userId === sub.customer.userId
        && !S.readSubscriptions().some((x) => x.invoiceNumber === v.invoiceNumber
          || x.installments.some((i) => i.invoiceNumber === v.invoiceNumber))
        && v.grandTotalPaise !== unbilled.amountPaise)[0];
      /* Guarded: if a later seed change takes the fixture away again, say so
         rather than passing on an assertion that never actually ran. */
      if (!wrong) return "NO FIXTURE — the seed no longer holds a wrong-amount invoice for this customer";
      return S.recordInstallmentPayment({ ...P, reference: "AT-4", invoiceNumber: wrong.invoiceNumber }).error !== "";
    })(), true);
  ok("...nor one another installment already carries",
    (() => {
      const taken = S.readSubscriptions().flatMap((x) => x.installments)
        .filter((i) => i.invoiceNumber)[0];
      /* Refused either as another customer's or as already carried — both
         are refusals, and which one fires depends on whose invoice the seed
         hands back first. What matters is that it does not go through. */
      return S.recordInstallmentPayment({ ...P, reference: "AT-5", invoiceNumber: taken.invoiceNumber }).error !== "";
    })(), true);

  /* The money arrived either way: a payment is still recordable with no
     invoice attached. The receipt then cites none, and says so. */
  ok("the payment records without an invoice, because the money arrived either way",
    S.recordInstallmentPayment({ ...P, reference: "AT-OK-1" }).error, "");
  ok("...and the installment is still carrying no tax invoice",
    !!S.readSubscription(sub.subscriptionId).installments
      .filter((i) => i.seq === unbilled.seq)[0].invoiceNumber, false);

  /* Now the same thing WITH an invoice, on a clean store. */
  S.resetStore();
  const sub2 = S.readSubscription("SUB-0107");
  const inst2 = sub2.installments.filter((i) => i.status === "due" && !i.invoiceNumber)[0];
  const offers = S.attachableForInstallment(sub2.subscriptionId, inst2.seq);
  ok("the attachable list offers only invoices for this installment's amount",
    offers.filter((i) => i.grandTotalPaise !== inst2.amountPaise).length, 0);
  ok("...and only this customer's, issued, and carried by nothing else",
    offers.filter((i) => i.customer.userId !== sub2.customer.userId || i.status !== "issued").length, 0);
}

console.log("\nwrites · fail to pay — a date that has not passed is not evidence");
S.resetStore();
{
  ok("an overdue failure on an installment not yet due is refused, in those words",
    S.markFailToPay("SUB-0102", 3, "overdue", "nothing arrived"),
    "Installment 3 is not due until 2026-09-01. A date that has not passed is not evidence of anything. (validation_failed)");
  ok("a failure with no evidence is refused",
    has(S.markFailToPay("SUB-0102", 3, "declined", "   "), "reason_required"), true);
  ok("a reason outside the closed list is refused",
    S.markFailToPay("SUB-0102", 3, "felt_wrong", "x"), "Pick what actually happened.");
  ok("a paid installment cannot be marked failed without reversing the money first",
    has(S.markFailToPay("SUB-0101", 1, "declined", "x"), "Reverse the payment first"), true);
  ok("a real decline, with the gateway's words, is recorded",
    S.markFailToPay("SUB-0102", 3, "mandate_cancelled", "Razorpay: mandate revoked by payer on 25 Aug."), "");
  const s = S.readSubscription("SUB-0102");
  ok("...the installment reads fail to pay and keeps the evidence",
    [s.installments[2].status, s.installments[2].failure.reason, s.installments[2].failure.note.length > 0],
    ["fail_to_pay", "mandate_cancelled", true]);
  ok("...and the subscription moves to defaulting", s.status, "defaulting");
  ok("...fail to pay on the Overview grows by that installment",
    S.overview().failedPaise, 33630000 + 63720000);
}

console.log("\nwrites · reversal — the receipt is retained, the installment returns to due");
S.resetStore();
{
  ok("the session running these checks holds Super Admin, so the guard lets it through", S.isSuperAdmin(), true);
  ok("an installment that was never paid cannot be reversed",
    has(S.reversePayment("PAY-4402", "recalled"), "invalid_state_transition"), true);
  ok("a reversal with no reason is refused",
    has(S.reversePayment("PAY-4405", "  "), "reason_required"), true);
  const collected0 = S.overview().collectedPaise;
  ok("reversing a real payment is accepted", S.reversePayment("PAY-4405", "bank recalled the credit"), "");
  const sub = S.readSubscription("SUB-0102");
  ok("...the installment returns to due with no payment on it",
    [sub.installments[1].status, sub.installments[1].payment], ["due", null]);
  ok("...the receipt is still named in the history — a receipt for money recalled is more interesting, not less",
    has(sub.events[0].note, "IB-RCP-2026-00311"), true);
  ok("...and collected drops by exactly that amount", collected0 - S.overview().collectedPaise, 24780000);
  ok("the same payment cannot be reversed twice",
    has(S.reversePayment("PAY-4405", "again"), "no longer exists"), true);
}

console.log("\nwrites · salaries — the run is opened, adjusted and paid in one write each");
S.resetStore();
{
  ok("a month that already has a run is refused",
    has(S.openSalaryRun("2026-08").error, "duplicate_run"), true);
  ok("a month that has not started cannot be run",
    S.openSalaryRun("2026-09").error, "A month that has not started cannot be run.");
  ok("a second open run is refused — two cannot be reconciled against one balance",
    has(S.openSalaryRun("2026-05").error, "period_open"), true);

  ok("paying the run without a reference is refused",
    has(S.recordRunPaid("RUN-2026-08", "   ", "ACC-HDFC-4021"), "validation_failed"), true);
  ok("paying it is accepted", S.recordRunPaid("RUN-2026-08", "SAL0825AUG", "ACC-HDFC-4021"), "");
  const aug = S.readRun("RUN-2026-08");
  ok("...every slip is stamped, referenced, issued and hashed in that one write",
    aug.slips.filter((s) => !(s.paidAt && s.reference && s.issuedAt && (s.sha256 || "").length === 64)).length, 0);
  ok("...the run reads paid and carries the date", [aug.state, !!aug.paidAt], ["paid", true]);
  ok("...and August's salary cost is now the run's total", S.overview().salaryPaise, aug.totalNetPaise);
  ok("a paid run cannot be paid again",
    has(S.recordRunPaid("RUN-2026-08", "SAL0825AUGX", "ACC-HDFC-4021"), "invalid_state_transition"), true);

  const opened = S.openSalaryRun("2026-05");
  ok("with nothing open, a past month can be run", opened.error, "");
  const may = S.readRun(opened.runId);
  ok("...one slip per active account, and nobody else",
    may.slips.length, S.readSalaryAccounts().filter((a) => a.active).length);
  ok("...each slip freezes the components off its account",
    may.slips.filter((s) => money(s.earnings) !== S.readSalaryAccount(s.salaryAccountId).monthlyGrossPaise).length, 0);
  ok("...and none of them is paid yet", may.slips.filter((s) => s.paidAt).length, 0);

  const slip = may.slips.filter((s) => s.salaryAccountId === "SAL-AC-0011")[0];
  const dedBefore = slip.deductionsPaise;
  const totalBefore = may.totalNetPaise;
  /* The month's REAL length, not a notional thirty: losing two days of a
     31-day month is 29 of 31, and every seeded slip already reads that way. */
  const basis = S.daysInMonth(may.month);
  ok("the run's month is a real calendar month, not a notional thirty", basis, 31);
  ok("losing the whole month is refused — that is an unpaid month, not loss of pay",
    S.setLop(slip.slipId, basis).indexOf("A whole month lost") >= 0, true);
  ok("three days of loss of pay is recorded", S.setLop(slip.slipId, 3), "");
  const after = S.readSlip(slip.slipId);
  ok("...paid days and loss of pay account for the whole month", [after.paidDays, after.lopDays], [basis - 3, 3]);
  ok("...every earning is pro-rated by the days worked, over the real month",
    after.earnings.map((e) => e.amountPaise),
    after.baseEarnings.map((e) => Math.round((e.amountPaise * (basis - 3)) / basis)));
  /* THE FREEZE. Pro-rating reads the slip's own frozen base, never the salary
     account — so a raise granted after the run opened cannot reach backwards,
     and setting loss of pay twice lands on the same figures. */
  const raise = S.readSalaryAccount("SAL-AC-0011");
  S.upsertSalaryAccount({
    memberId: raise.memberId, memberName: raise.memberName, employeeCode: raise.employeeCode,
    designation: raise.designation, joinedAt: raise.joinedAt, ctcPaise: raise.ctcPaise,
    earnings: raise.earnings.map((e) => ({ ...e, amountPaise: e.amountPaise * 2 })),
    deductions: raise.deductions, bank: raise.bank, pan: raise.pan, uan: raise.uan,
  }, "SAL-AC-0011");
  ok("a raise after the run opened does not change the slip already issued",
    S.readSlip(slip.slipId).baseEarnings.map((e) => e.amountPaise),
    after.baseEarnings.map((e) => e.amountPaise));
  ok("...and re-applying the same loss of pay lands on the same figures, not a compounded cut",
    [S.setLop(slip.slipId, 3), S.readSlip(slip.slipId).netPaise], ["", after.netPaise]);
  ok("...deductions are left alone — PF and TDS are not pro-rated here", after.deductionsPaise, dedBefore);
  ok("...net follows gross minus deductions", after.netPaise, after.grossPaise - after.deductionsPaise);
  ok("...and the run total follows the slip, in the same write",
    [S.readRun(opened.runId).totalNetPaise, totalBefore - S.readRun(opened.runId).totalNetPaise > 0],
    [sumBy(S.readRun(opened.runId).slips, (s) => s.netPaise), true]);
  ok("a paid run's slip is frozen against loss of pay",
    has(S.setLop("SLIP-2026-07-0011", 2), "invalid_state_transition"), true);
}

/* ========================================================================== */
console.log("\nthe salary account points at a real team member");
S.resetStore();
{
  /* PICKED, NOT TYPED. Four fields — id, name, designation, code — came off
     one choice, so they cannot disagree with the Team record they came from. */
  const opts = S.salaryMemberOptions();
  ok("the picker offers the team, not a blank box", opts.length > 0, true);
  ok("...active members only", opts.length, 8);
  ok("every option carries the three fields the form no longer asks for",
    opts.every((o) => o.memberId && o.name && o.designation && o.employeeCode), true);
  ok("the employee code is DERIVED from the member id, not typed",
    S.employeeCodeOf("41"), "IB-EMP-041");
  ok("...so the same person always gets the same code",
    S.employeeCodeOf(41), S.employeeCodeOf("41"));

  /* Somebody who already has an account is offered GREYED, not hidden — a
     person looking for them finds them and learns why, instead of concluding
     the list is broken. */
  ok("an option knows whether that member already has an account",
    opts.every((o) => typeof o.taken === "boolean"), true);

  /* ⚠ THE SEED DEFECT, asserted so it cannot be forgotten. Finance's salary
     accounts carry memberIds 1-9 and Team's members are 41-86: two casts
     written independently, so `memberId` on every existing account resolves to
     nobody. New accounts join correctly; the historical ones do not. This
     assertion FAILS the day somebody reconciles them, which is the point —
     it is a reminder, not a rule. */
  const joined = S.readSalaryAccounts()
    .filter((acc) => opts.some((o) => o.memberId === acc.memberId));
  ok("KNOWN: no seeded salary account joins a seeded team member (see the note)",
    joined.length, 0);
}

console.log("\nwrites · salaries are paid PERSON by person, not run by run");
S.resetStore();
{
  /* THE UNIT CHANGED. A run used to be what somebody paid; a person is now,
     and a run closes itself once its last slip is paid. What did NOT change is
     that a slip freezes when it is paid — that moved from the run to the slip,
     which is where it always belonged. */
  const acc = S.readSalaryAccount("SAL-AC-0011");
  const before = S.dueOf(S.toSalaryRow(acc));
  ok("somebody on the open run is owed the current month", before.state, "unpaid");
  ok("...and it is one month, not two", before.arrears.length, 0);
  ok("...so what is due is exactly that month's net", before.pendingPaise, before.currentPaise);

  const PDF = { filename: "receipt.pdf", mime: "application/pdf" };
  ok("paying with no proof is refused — it is the only evidence there is",
    has(S.paySalary("SAL-AC-0011", { via: "bank", accountId: "ACC-HDFC-4021", proof: { filename: "", mime: "" } }), "proof_required"), true);
  ok("...and an account that does not exist is refused",
    has(S.paySalary("SAL-AC-0011", { via: "bank", accountId: "ACC-NOPE", proof: PDF }), "Pick the account"), true);

  ok("paying works", S.paySalary("SAL-AC-0011", { via: "bank", accountId: "ACC-HDFC-4021", proof: { filename: "receipt.pdf", mime: "application/pdf" } }), "");
  const after = S.dueOf(S.toSalaryRow(S.readSalaryAccount("SAL-AC-0011")));
  ok("...nothing is outstanding afterwards", [after.state, after.pendingPaise], ["paid", 0]);
  ok("...paying again is refused, because there is nothing to pay",
    has(S.paySalary("SAL-AC-0011", { via: "bank", accountId: "ACC-HDFC-4021", proof: { filename: "receipt.pdf", mime: "application/pdf" } }), "nothing_due"), true);

  /* THE FREEZE, which is the guarantee that had to survive the change. */
  const slip = S.readRun("RUN-2026-08").slips.filter((s) => s.salaryAccountId === "SAL-AC-0011")[0];
  ok("the slip took its paid date, its hash and its receipt in that one write",
    [!!slip.paidAt, !!slip.sha256, !!slip.issuedAt, slip.proof && slip.proof.filename],
    [true, true, true, "receipt.pdf"]);
  ok("...and NO reference, because the field is gone and nothing invents one",
    slip.reference, "");

  /* AND THE RUN IS A CONSEQUENCE. One person paid does not close it. */
  ok("the run is still open, because other people on it are not paid",
    S.readRun("RUN-2026-08").state, "open");
  ok("...which is a state the old model called impossible — a run half paid",
    S.readRun("RUN-2026-08").slips.some((s) => s.paidAt)
    && S.readRun("RUN-2026-08").slips.some((s) => !s.paidAt), true);

  /* Pay everybody else and the run closes itself. */
  const rest = S.readRun("RUN-2026-08").slips.filter((s) => !s.paidAt);
  rest.forEach((s, i) => S.paySalary(s.salaryAccountId, { via: "bank", accountId: "ACC-HDFC-4021", proof: { filename: "receipt.pdf", mime: "application/pdf" } }));
  ok("the run closed itself once its last slip was paid, with nobody marking it",
    S.readRun("RUN-2026-08").state, "paid");
  ok("...and it carries the date it closed", !!S.readRun("RUN-2026-08").paidAt, true);
}

console.log("\nwrites · one-off incentives and deductions land on the newest slip");
S.resetStore();
{
  const PDF = { filename: "receipt.pdf", mime: "application/pdf" };
  const acct = { accountId: "ACC-HDFC-4021" };
  const before = S.dueOf(S.toSalaryRow(S.readSalaryAccount("SAL-AC-0011")));

  /* The refusals first, and that they write NOTHING. */
  ok("a deduction bigger than the month's net is refused",
    has(S.paySalary("SAL-AC-0011", { via: "bank", ...acct, proof: PDF,
      deduction: { label: "Advance recovery", amountPaise: before.pendingPaise + 100 } }), "deduction_exceeds"), true);
  ok("an amount with no name is refused — it prints on the slip",
    has(S.paySalary("SAL-AC-0011", { via: "bank", ...acct, proof: PDF,
      incentive: { label: "  ", amountPaise: 500000 } }), "adjustment_label"), true);
  ok("...and neither refusal wrote anything",
    S.dueOf(S.toSalaryRow(S.readSalaryAccount("SAL-AC-0011"))).pendingPaise, before.pendingPaise);

  /* The write, with both. */
  ok("paying with an incentive and a deduction goes through",
    S.paySalary("SAL-AC-0011", { via: "bank", ...acct, proof: PDF,
      incentive: { label: "Festival bonus", amountPaise: 100000 },
      deduction: { label: "Advance recovery", amountPaise: 40000 } }), "");
  const slip = S.readRun("RUN-2026-08").slips.filter((x) => x.salaryAccountId === "SAL-AC-0011")[0];
  ok("the incentive is a named earning line on the slip",
    slip.earnings.filter((e) => e.label === "Festival bonus").map((e) => e.amountPaise), [100000]);
  ok("the deduction is a named deduction line on it",
    slip.deductions.filter((e) => e.label === "Advance recovery").map((e) => e.amountPaise), [40000]);
  ok("the slip's net moved by exactly the difference",
    slip.netPaise, before.pendingPaise + 100000 - 40000);
  ok("...and its stored totals still equal its own arrays",
    [slip.grossPaise, slip.deductionsPaise],
    [slip.earnings.reduce((n, e) => n + e.amountPaise, 0),
     slip.deductions.reduce((n, e) => n + e.amountPaise, 0)]);
  ok("the run total followed the slip",
    S.readRun("RUN-2026-08").totalNetPaise,
    S.readRun("RUN-2026-08").slips.reduce((n, x) => n + x.netPaise, 0));
  ok("the account's event names both lines",
    (() => { const ev = S.readSalaryAccount("SAL-AC-0011").events[0].note;
      return ev.indexOf("Festival bonus") >= 0 && ev.indexOf("Advance recovery") >= 0; })(), true);
  ok("...and states the adjusted figure, not the old pending",
    S.readSalaryAccount("SAL-AC-0011").events[0].note.indexOf(S.inr(before.pendingPaise + 60000)) >= 0, true);
}

console.log("\nwrites · every salary payment carries a receipt, whatever the method");
S.resetStore();
{
  /* THE REFERENCE FIELD IS GONE. It was a UTR typed from memory on a screen
     where nothing checked it against a statement, and a reference nobody
     verifies is one nobody should trust. The attachment replaced it, for
     every method — a payment with no evidence at all is a claim, which is
     the one thing this module refuses to store. */
  const ID = "SAL-AC-0022";
  const acct = { accountId: "ACC-HDFC-4021" };
  const NOFILE = { filename: "", mime: "" };
  const JPG = { filename: "upi-screenshot.jpg", mime: "image/jpeg" };
  const TXT = { filename: "notes.txt", mime: "text/plain" };

  ok("bank transfer with no receipt is refused",
    has(S.paySalary(ID, { via: "bank", ...acct, proof: NOFILE }), "proof_required"), true);
  ok("UPI with no receipt is refused",
    has(S.paySalary(ID, { via: "upi", ...acct, proof: NOFILE }), "proof_required"), true);
  ok("cash with no receipt is refused — the rule does not vary by method",
    has(S.paySalary(ID, { via: "cash", ...acct, proof: NOFILE }), "proof_required"), true);

  ok("a file that is neither an image nor a PDF is refused",
    has(S.paySalary(ID, { via: "bank", ...acct, proof: TXT }), "proof_type"), true);
  ok("...and the refusal names the file, so it is obvious which one",
    has(S.paySalary(ID, { via: "bank", ...acct, proof: TXT }), "notes.txt"), true);
  ok("a spreadsheet is not a receipt", S.proofAccepted("application/vnd.ms-excel"), false);
  ok("a PDF is", S.proofAccepted("application/pdf"), true);
  ok("...and so is a photo, which is what a cash acknowledgement usually is",
    [S.proofAccepted("image/jpeg"), S.proofAccepted("image/png")], [true, true]);

  ok("an unknown method is refused",
    has(S.paySalary(ID, { via: "carrier-pigeon", ...acct, proof: JPG }), "Pick how it was paid"), true);

  ok("UPI with a screenshot is accepted",
    S.paySalary(ID, { via: "upi", ...acct, proof: JPG, remark: "Sent at 6pm" }), "");
  const slip = S.readRun("RUN-2026-08").slips.filter((s) => s.salaryAccountId === ID)[0];
  ok("...the slip carries NO reference at all", slip.reference, "");
  ok("...it carries the receipt instead", slip.proof.filename, "upi-screenshot.jpg");
  ok("...the method is stored in both vocabularies", [slip.via, slip.mode], ["upi", "UPI"]);
  ok("...the remark is kept, load-bearing on nothing", slip.remark, "Sent at 6pm");
  ok("...and it still froze: paid date, issued date and hash",
    [!!slip.paidAt, !!slip.issuedAt, !!slip.sha256], [true, true, true]);
}

S.resetStore();
{
  /* Somebody owed two months: the open August run plus a July slip unpaid by
     hand. Anything else invents a preference nobody expressed and leaves the
     older debt ageing while the newer one clears. */
  const july = S.readRun("RUN-2026-07").slips.filter((s) => s.salaryAccountId === "SAL-AC-0014")[0];
  july.paidAt = null; july.sha256 = null; july.reference = "";
  S.readRun("RUN-2026-07").state = "open";

  const d = S.dueOf(S.toSalaryRow(S.readSalaryAccount("SAL-AC-0014")));
  ok("two months are outstanding", d.unpaid.length, 2);
  ok("...the newest is the current one", d.current.month, "2026-08");
  ok("...and the older one is arrears, counted separately", d.arrears.map((s) => s.month), ["2026-07"]);
  ok("...what is due is arrears PLUS the current month, not just one of them",
    d.pendingPaise, d.arrearsPaise + d.currentPaise);

  ok("one payment settles both", S.paySalary("SAL-AC-0014", { via: "bank", accountId: "ACC-HDFC-4021", proof: { filename: "receipt.pdf", mime: "application/pdf" } }), "");
  const j = S.readRun("RUN-2026-07").slips.filter((s) => s.salaryAccountId === "SAL-AC-0014")[0];
  const a = S.readRun("RUN-2026-08").slips.filter((s) => s.salaryAccountId === "SAL-AC-0014")[0];
  ok("...both months are paid", [!!j.paidAt, !!a.paidAt], [true, true]);
  /* OLDEST FIRST IS NO LONGER VISIBLE ON THE SLIPS, and that is a real
     consequence of removing the reference field rather than a gap in this
     suite. The two months used to carry -01 and -02 suffixes, which is what
     made the order readable on the record; with no reference there is nothing
     to suffix, both slips take the same instant, and the only trace left is
     the event note. So that is what is asserted — and it is worth knowing that
     the order is now a claim in a sentence rather than a fact on a document. */
  ok("...neither month carries a reference any more", [j.reference, a.reference], ["", ""]);
  ok("...and the event says the order it paid them in",
    has(S.readSalaryAccount("SAL-AC-0014").events.map((e) => e.note).join(" "), "oldest first"), true);
  ok("...and nothing is outstanding afterwards",
    S.dueOf(S.toSalaryRow(S.readSalaryAccount("SAL-AC-0014"))).pendingPaise, 0);
}

/* ========================================================================== */
console.log("\nwrites · tags and transactions — one tag, one reference, one row");
S.resetStore();
{
  ok("a tag that already exists is refused", has(S.addTag("Rent", "fixed", null, false).error, "duplicate_tag"), true);
  const t = S.addTag("Legal fees", "variable", 500000, true);
  ok("a new tag is created", [t.error, t.tagKey], ["", "legal_fees"]);
  ok("...marked custom, so Analytics can say where the bucket came from", S.tagOf("legal_fees").custom, true);

  const adsBefore = S.readTransactions().filter((x) => x.tagKey === "ads").length;
  ok("deactivating a tag is accepted", S.deactivateTag("ads"), "");
  ok("...the tag is inactive, not deleted", S.tagOf("ads").active, false);
  ok("...and every row that used it still points at it — nothing was re-bucketed",
    S.readTransactions().filter((x) => x.tagKey === "ads").length, adsBefore);
  ok("an inactive tag cannot be used on a new row",
    has(S.recordTransaction({ direction: "out", tagKey: "ads", amountPaise: 100000, description: "x", party: "y", mode: "UPI", reference: "NEW-ADS-1", valueDate: "2026-08-24", accountId: "ACC-HDFC-4021" }).error, "inactive"), true);

  const base = {
    direction: "out", tagKey: "util", amountPaise: 100000, description: "Broadband", party: "ACT",
    mode: "UPI", reference: "UTIL-TEST-1", valueDate: "2026-08-24", accountId: "ACC-HDFC-4021",
  };
  ok("a row with no tag is refused — the tag is what decides where it lands",
    has(S.recordTransaction({ ...base, tagKey: "nope" }).error, "Every row needs a tag"), true);
  ok("a reference another row already carries is refused",
    has(S.recordTransaction({ ...base, reference: "NEFT0001AUG991" }).error, "duplicate_reference"), true);
  ok("a zero amount is refused", has(S.recordTransaction({ ...base, amountPaise: 0 }).error, "above zero"), true);
  ok("money in without one of the three permitted credits is refused",
    has(S.recordTransaction({ ...base, direction: "in", reference: "IN-TEST-1" }).error, "Customer money has exactly one way in"), true);
  const inn = S.recordTransaction({ ...base, direction: "in", creditKind: "interest", reference: "IN-TEST-2" });
  ok("bank interest is accepted and flagged non-revenue",
    [inn.error, S.readTransaction(inn.txnId).nonRevenue], ["", true]);
  const collected0 = S.overview().collectedPaise;
  const spend = S.recordTransaction(base);
  ok("a company expense is recorded", spend.error, "");
  ok("...it lands under its tag in the month's spend",
    S.tagTotals().rows.filter((r) => r.tag.tagKey === "util")[0].spentPaise, 300000 + 100000);
  ok("...and no credit or expense ever reaches collected", S.overview().collectedPaise, collected0);

  const before = JSON.stringify(S.readTransaction("TXN-0912"));
  ok("a reversal with no reason is refused", has(S.reverseTransaction("TXN-0912", " "), "reason_required"), true);
  ok("reversing a transaction is accepted", S.reverseTransaction("TXN-0912", "paid the wrong vendor"), "");
  const orig = S.readTransaction("TXN-0912");
  ok("...the original keeps its amount, its date and its bill",
    [orig.amountPaise, orig.valueDate, !!orig.bill],
    [JSON.parse(before).amountPaise, JSON.parse(before).valueDate, !!JSON.parse(before).bill]);
  ok("...only its state moved, and it names the counter-entry",
    [orig.state, orig.reversal.counterId], ["reversed", "TXN-RV-0912"]);
  const counter = S.readTransaction("TXN-RV-0912");
  ok("...the counter-entry carries the negative amount and points back",
    [counter.amountPaise, counter.reversesTxnId], [-450000, "TXN-0912"]);
  ok("a counter-entry cannot itself be reversed",
    has(S.reverseTransaction("TXN-RV-0912", "again"), "invalid_state_transition"), true);
}

console.log("\nwrites · refunds — approval authorises a transfer, it does not make one");
S.resetStore();
{
  ok("a second open request on the same payment is refused",
    has(S.requestRefund("PAY-4399", "duplicate", "asked again").error, "duplicate_request"), true);
  ok("a request with no detail is refused",
    has(S.requestRefund("PAY-4404", "duplicate", "  ").error, "Say what happened"), true);
  const req = S.requestRefund("PAY-4404", "other", "goodwill after a delayed handover");
  ok("a request on a ground that is not permitted is still accepted and framed as an exception", req.error, "");
  ok("...its policy check is frozen onto it, and says the ground is not permitted",
    S.readRefund(req.refundId).policy.groundPermitted, false);
  ok("...the payment it names is untouched and still collected",
    S.readPayment("PAY-4404").inst.status, "paid");

  const man = S.createManualRefund("Ritu Sharma", 450000, "overpayment", "Duplicate NEFT on 22 Aug, UTR NEFT0022AUG9911.");
  ok("a manual refund is accepted", man.error, "");
  ok("...it carries NO policy object — an empty check would read as a passed one",
    S.readRefund(man.refundId).policy, null);
  ok("...and NO payment id, because there is no ledger row behind it",
    S.readRefund(man.refundId).paymentId, null);
  ok("a manual refund with no detail is refused — the detail IS the evidence",
    has(S.createManualRefund("Ritu Sharma", 450000, "overpayment", " ").error, "the detail IS the evidence"), true);

  ok("a send-back with no note is refused — the requester only sees that note",
    has(S.decideRefund("RF-0117", "send_back", ""), "reason_required"), true);
  ok("a decline with no note is refused", has(S.decideRefund("RF-0117", "decline", "  "), "reason_required"), true);
  ok("FOUR EYES: the person who requested it cannot approve it",
    S.decideRefund(req.refundId, "approve", ""),
    "A refund cannot be approved by the person who requested it. That separation is the whole control. (super_admin_required)");
  ok("a request already decided cannot be decided again",
    has(S.decideRefund("RF-0121", "approve", ""), "invalid_state_transition"), true);

  const owed0 = S.overview().refundsOwedPaise;
  ok("a refund nobody approved cannot be transferred",
    has(S.recordRefundTransfer("RF-0117", "NEFT", "RFX-1", "ACC-HDFC-4021"), "Only an approved refund can be paid"), true);
  ok("a transfer with no reference is refused — the reference is the proof the money left",
    has(S.recordRefundTransfer("RF-0125", "NEFT", " ", "ACC-HDFC-4021"), "validation_failed"), true);
  ok("recording the transfer is accepted",
    S.recordRefundTransfer("RF-0125", "NEFT", "NEFT0825AUG5501", "ACC-HDFC-4021"), "");
  ok("...only now is the refund paid, with its settlement on the record",
    [S.readRefund("RF-0125").state, !!S.readRefund("RF-0125").settlement], ["paid", true]);
  ok("...and it leaves 'approved, not sent' entirely", [owed0, S.overview().refundsOwedPaise], [1500000, 0]);
  ok("...while refunds paid in August grows by that amount",
    S.overview().refundsPaidPaise, 990000 + 1500000);
}

console.log("\nwrites · the premise is enforced, not documented");
S.resetStore();
{
  ok("there is no verifyPayment — a recorded payment is not a claim awaiting belief", typeof S.verifyPayment, "undefined");
  ok("there is no holdUnallocated — money is not parked in a state", typeof S.holdUnallocated, "undefined");
  ok("there is no logPayment — a payment is recorded, not logged", typeof S.logPayment, "undefined");
  ok("there is no postTransaction — there is no draft to post", typeof S.postTransaction, "undefined");
  ok("there is no addCategory — tags replaced categories outright", typeof S.addCategory, "undefined");
}

/* ========================================================================== */
console.log("\nKPIs — undefined is not zero");
S.resetStore();
{
  const k = S.kpis();
  const of = (key, list) => (list || k).filter((x) => x.key === key)[0];

  ok("every KPI returned is one the vocabulary defines",
    k.filter((x) => !S.kpiMeta(x.key)).map((x) => x.key), []);
  ok("...and the module returns the whole set", k.length, vocab.kpiDefinitions.length);
  ok("every KPI with no value says why it has none",
    k.filter((x) => x.value === null && !(x.why || "").trim()).map((x) => x.key), []);
  ok("every KPI with a value says nothing — the reason line is for absence only",
    k.filter((x) => x.value !== null && x.why !== null).map((x) => x.key), []);

  ok("runway is null, not a number nobody should act on", of("runway").value, null);
  ok("...and it says exactly what is missing", has(of("runway").why, "reconciled cash balance"), true);

  /* CAC MOVES WITH THE SEED, by design — it is spend ÷ customers won that
     month, so every subscription added to August changes it. It was 737500
     over four customers; the two chain-recorded demos (SUB-0110, SUB-0111)
     made it six. Asserted as a figure rather than a formula because
     recomputing it here would just be the store's arithmetic written twice. */
  ok("CAC is a number in a month that won six customers", of("cac").value, 491667);
  const june = S.kpis("2026-06-01", "2026-06-30");
  ok("...and null in a month that won none — dividing by nothing is not free acquisition",
    of("cac", june).value, null);
  ok("...with the reason on it", has(of("cac", june).why, "No new customer"), true);
  ok("new customers is 0, a real count, where CAC is null", of("new_customers", june).value, 0);

  ok("collection rate and fail rate account for every installment that settled",
    Math.round((of("collection_rate").value + of("fail_rate").value) * 10) / 10, 100);
  const july = S.kpis("2026-07-01", "2026-07-31");
  ok("...in July too", Math.round((of("collection_rate", july).value + of("fail_rate", july).value) * 10) / 10, 100);
  ok("both are null in a month where nothing fell due",
    [of("collection_rate", june).value, of("fail_rate", june).value], [null, null]);
  ok("salary ratio is null while August's run is still open, and says so",
    [of("salary_ratio").value, has(of("salary_ratio").why, "still open")], [null, true]);
  const activeSubs = S.readSubscriptions().filter((x) => x.status === "active");
  const mrrByHand = sumBy(activeSubs, (x) => Math.round(x.totalPaise / Math.max(1, x.cycleMonths)));
  ok("MRR is a level read off the active subscriptions, never a rate summed over a period",
    of("mrr").value, mrrByHand);
  ok("...a defaulting subscription is out of it the moment an installment fails",
    activeSubs.filter((x) => x.installments.some((i) => i.status === "fail_to_pay")).length, 0);
  ok("ARPU is MRR over those same subscriptions", of("arpu").value, Math.round(mrrByHand / activeSubs.length));

  S.readSubscriptions().filter((s) => s.status === "active")
    .forEach((s) => S.cancelSubscription(s.subscriptionId, "closing the book for this check"));
  const none = S.kpis();
  ok("with no active subscription there is no level to read MRR from", of("mrr", none).value, null);
  ok("...and ARPU is null, never zero — a denominator of nothing has no average", of("arpu", none).value, null);
  ok("...with the reason on it", has(of("arpu", none).why, "denominator of nothing"), true);
  ok("...and the rule still holds across the whole array",
    none.filter((x) => (x.value === null) !== (x.why !== null)).map((x) => x.key), []);
}

S.resetStore();
console.log(failed
  ? "\n" + failed + " of " + total + " FAILED\n"
  : "\nall " + total + " checks passed\n");
process.exit(failed ? 1 : 0);
