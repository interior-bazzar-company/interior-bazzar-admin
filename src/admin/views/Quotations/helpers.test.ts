/* Self-check for the list's filter + strip maths. The money cells (awaiting /
   agreed) are sums of real per-quotation grand totals — nothing on this strip
   is estimated — so a drift here is a wrong figure on a sales screen.

   No test runner in this project — run it directly (the define stubs Vite's
   import.meta.env, which the bundled UI barrel reads at module scope):
     npx esbuild src/admin/views/Quotations/helpers.test.ts --bundle --format=esm        "--define:import.meta.env={}" --outfile=t.mjs && node t.mjs
*/
import type { QuotationRow } from "../../../api/modules/adminOps";
import {
  blockersOf, discountFromServer, discountToServer, expiringSoon, filterQuotations, lineNet,
  lineNetOf, liveTotals, planLabel, summarize,
} from "./helpers";

const assert = {
  equal(actual: unknown, expected: unknown, what?: string) {
    if (actual !== expected) {
      throw new Error((what ? what + ": " : "") + `expected ${String(expected)}, got ${String(actual)}`);
    }
  },
};

/** A date `days` from today, as the date-only ISO string the API sends. */
function iso(days: number): string {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + days);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}

function q(o: Partial<QuotationRow>): QuotationRow {
  return {
    id: 1, quotationNumber: null, version: 1, status: "draft", dealRef: "IB-1",
    party: { name: "Asha", business: "" }, grandTotalPaise: 0, validUntil: "",
    owner: null, ...o,
  } as unknown as QuotationRow;
}

const rows: QuotationRow[] = [
  q({ id: 1, status: "draft", dealRef: "IB-1", grandTotalPaise: 100000, owner: { id: 7, name: "Riya" } as never }),
  q({ id: 2, status: "issued", quotationNumber: "QT-0002", dealRef: "IB-2", grandTotalPaise: 250000,
      validUntil: iso(2), owner: { id: 7, name: "Riya" } as never }),
  q({ id: 3, status: "issued", quotationNumber: "QT-0003", dealRef: "IB-3", grandTotalPaise: 500000,
      validUntil: iso(30), owner: { id: 8, name: "Vikram" } as never }),
  q({ id: 4, status: "accepted", quotationNumber: "QT-0004", dealRef: "IB-4", grandTotalPaise: 900000,
      party: { name: "Neel", business: "Ubuntu Interiors" } as never }),
  q({ id: 5, status: "cancelled", quotationNumber: "QT-0005", dealRef: "IB-5", grandTotalPaise: 700000 }),
  // Lapsed yesterday: still ISSUED, but past its date — not "expiring", gone.
  q({ id: 6, status: "issued", quotationNumber: "QT-0006", dealRef: "IB-6", grandTotalPaise: 400000,
      validUntil: iso(-1) }),
];

/* ------------------------------------------------------------- expiring */
assert.equal(expiringSoon(rows[1]), true, "issued, 2 days left");
assert.equal(expiringSoon(rows[2]), false, "issued, 30 days left");
assert.equal(expiringSoon(rows[5]), false, "issued but already lapsed");
assert.equal(expiringSoon(rows[3]), false, "accepted never expires");

/* ---------------------------------------------------------------- strip */
const s = summarize(rows);
assert.equal(s.total, 6, "total counts everything, dead states included");
assert.equal(s.byStatus.issued, 3, "issued count");
assert.equal(s.byStatus.accepted, 1, "accepted count");
assert.equal(s.expiring, 1, "only the one inside 3 days");
// Money is per-status, summed from grand totals — a lapsed issued row still
// counts as awaiting until the sweep flips it to `expired`.
assert.equal(s.awaitingPaise, 250000 + 500000 + 400000, "awaiting = sum of ISSUED grand totals");
assert.equal(s.agreedPaise, 900000, "agreed = sum of ACCEPTED grand totals");

/* --------------------------------------------------------------- filter */
assert.equal(filterQuotations(rows, {}).length, 6, "no filter, no narrowing");
assert.equal(filterQuotations(rows, { status: "issued" }).length, 3, "by status");
assert.equal(filterQuotations(rows, { status: "expiring" })[0].id, 2, "the expiring pseudo-status");
assert.equal(filterQuotations(rows, { owner: "7" }).length, 2, "by owner id, as the URL carries it");
assert.equal(filterQuotations(rows, { owner: "" }).length, 6, "blank owner is not a filter");
assert.equal(filterQuotations(rows, { q: "qt-0004" })[0].id, 4, "quotation number, case-insensitive");
assert.equal(filterQuotations(rows, { q: "IB-3" })[0].id, 3, "deal ref");
assert.equal(filterQuotations(rows, { q: "ubuntu" })[0].id, 4, "the business half of the party line");
assert.equal(filterQuotations(rows, { q: "draft" })[0].id, 1, "an unissued row searches as 'draft'");
assert.equal(filterQuotations(rows, { status: "issued", owner: "7" }).length, 1, "filters compose");

/* -------------------------------------------------------------- lineNet */
// The net is what the SERVER computed (taxableAmountPaise); the discount is
// read back off it rather than recomputed, so the panel and the document
// cannot disagree.
assert.equal(lineNet({ amountPaise: 100000, taxableAmountPaise: 90000 }).disc, 10000, "disc = base - net");
assert.equal(lineNet({ amountPaise: 100000, taxableAmountPaise: 100000 }).disc, 0, "no discount");
assert.equal(lineNet({ amountPaise: 0, taxableAmountPaise: 0 }).net, 0, "empty line");
// A net above base would be a server bug, not a negative discount to render.
assert.equal(lineNet({ amountPaise: 1000, taxableAmountPaise: 5000 }).disc, 0, "never negative");

/* ------------------------------------------------------------- blockers */
// Mirrors the four guards in QuotationsController.Issue.
const priced = q({ status: "draft", placeOfSupply: "Delhi", validUntil: iso(15), grandTotalPaise: 118000,
  items: [{ id: 1, kind: "plan", amountPaise: 100000, taxableAmountPaise: 100000 }] as never });
assert.equal(blockersOf(priced).length, 0, "a priced draft is issuable");

const empty = q({ status: "draft", placeOfSupply: "", validUntil: "", grandTotalPaise: 0, items: [] as never });
const codes = blockersOf(empty).map((b) => b.code).join(",");
assert.equal(codes, "quotation_empty,validation_failed,invalid_validity,invalid_pricing", "all four, in order");

const noAmount = q({ status: "draft", placeOfSupply: "Delhi", validUntil: iso(15), grandTotalPaise: 0,
  items: [{ id: 1, kind: "plan", amountPaise: 0, taxableAmountPaise: 0 }] as never });
assert.equal(blockersOf(noAmount).length, 2, "a zero-priced plan blocks on both the line and the total");

/* ------------------------------------------------------------ planLabel */
// The picker writes this string, the plan header matches the catalogue back by
// it, and the document prints it. All three have to agree exactly.
assert.equal(planLabel({ planFamily: "business", title: "Signature" }), "Business · Signature");
assert.equal(planLabel({ planFamily: "architect", title: "Architect Pro" }), "Architect · Architect Pro");
assert.equal(planLabel({ planFamily: "", title: "Signature" }), "Business · Signature", "family defaults");

/* ------------------------------------------------------ liveTotals ------
   The builder rail prices the draft in the browser now, so this port has to
   agree with interior_deals_billing/pricing.py to the paisa or the rail and
   the document disagree. Every expectation below is the real output of
   `pricing.recalc_quotation_items` for the same input — regenerate with:

     python -c "import sys; sys.path.insert(0,'.'); \
       from interior_deals_billing.pricing import recalc_quotation_items as R; \
       print(R([{'amount_paise':2949900,'discount_type':'pct','discount_value':10}], \
               18,'applicable','Delhi'))"

   run from interior-bazzar-backend/interior-bazzar-backend. */
const plan10 = liveTotals({
  lines: [{ amountPaise: 2949900, discountType: "pct", discountValue: 10 }],
  gstRate: 18, taxMode: "applicable", placeOfSupply: "Delhi",
});
assert.equal(plan10.subtotalPaise, 2949900, "gross is pre-discount");
assert.equal(plan10.discountAmountPaise, 294990, "10% of 29,499");
assert.equal(plan10.taxablePaise, 2654910);
assert.equal(plan10.cgstPaise, 238942, "Delhi is the seller state, so CGST/SGST");
assert.equal(plan10.sgstPaise, 238942);
assert.equal(plan10.igstPaise, 0);
assert.equal(plan10.grandTotalPaise, 3132794);

// `amt` is PAISE on the wire, so liveTotals takes paise. What the customer
// TYPED is rupees; discountToServer does that conversion once, before either
// the rail or the request sees it (see the round-trip block below).
const planAmt = liveTotals({
  lines: [{ amountPaise: 2949900, discountType: "amt", discountValue: 5000 }],
  gstRate: 18, taxMode: "applicable", placeOfSupply: "Delhi",
});
assert.equal(planAmt.discountAmountPaise, 5000, "amt discounts are paise, not rupees");
assert.equal(planAmt.grandTotalPaise, 3474982);

// Two lines, each with its own discount, outside the seller state.
const inter = liveTotals({
  lines: [{ amountPaise: 2949900, discountType: "pct", discountValue: 10 },
          { amountPaise: 500000, discountType: "amt", discountValue: 100000 }],
  gstRate: 18, taxMode: "applicable", placeOfSupply: "Karnataka",
});
assert.equal(inter.discountAmountPaise, 394990, "per-line discounts sum");
assert.equal(inter.cgstPaise, 0);
assert.equal(inter.igstPaise, 549884, "inter-state is a single IGST");
assert.equal(inter.grandTotalPaise, 3604794);

// The half-paisa split: GST 16667 halves to 8334 + 8333, never 8333 + 8333.
// Math.round matches pricing._round (half away from zero) on these figures.
const odd = liveTotals({
  lines: [{ amountPaise: 333333, discountType: "pct", discountValue: 0 }],
  gstRate: 5, taxMode: "applicable", placeOfSupply: "Delhi",
});
assert.equal(odd.cgstPaise + odd.sgstPaise, odd.taxAmountPaise, "the twins never miss the total");
assert.equal(odd.cgstPaise, 8334);
assert.equal(odd.sgstPaise, 8333);
assert.equal(odd.grandTotalPaise, 350000);

const untaxed = liveTotals({
  lines: [{ amountPaise: 2949900, discountType: "pct", discountValue: 10 }],
  gstRate: 18, taxMode: "not_applicable", placeOfSupply: "Delhi",
});
assert.equal(untaxed.taxAmountPaise, 0, "not_applicable zeroes the rate, not just the split");
assert.equal(untaxed.grandTotalPaise, 2654910);

// A discount can never exceed its own line.
assert.equal(lineNetOf({ amountPaise: 1000, discountType: "amt", discountValue: 5000 }).net, 0);
assert.equal(lineNetOf({ amountPaise: 1000, discountType: "pct", discountValue: 150 }).disc, 1000);

// And the two directions agree: what liveTotals computes forward is what
// lineNet reads back off the row the server then stores.
const fwd = lineNetOf({ amountPaise: 2949900, discountType: "pct", discountValue: 10 });
const back = lineNet({ amountPaise: fwd.base, taxableAmountPaise: fwd.net });
assert.equal(back.disc, fwd.disc, "forward and backward discounts match");

/* ------------------------------------------- discount units, both ways ---
   The box is labelled ₹ but the server reads `amt` as paise. Sent raw, a
   ₹5,000 discount arrived as ₹50 and the payable looked like the full plan
   cost — the bug this pair exists to close. */
assert.equal(discountToServer("amt", "5000"), 500000, "₹5,000 typed is 500000 paise");
assert.equal(discountToServer("amt", 5000), 500000, "number or string, same answer");
assert.equal(discountToServer("pct", "10"), 10, "a percent is not money and is not scaled");
assert.equal(discountToServer("amt", ""), 0, "an empty box is no discount, not NaN");
assert.equal(discountToServer("amt", "abc"), 0, "garbage is no discount, not NaN");

assert.equal(discountFromServer("amt", 500000), 5000, "and back, for seeding the box");
assert.equal(discountFromServer("pct", 10), 10);
assert.equal(discountFromServer("amt", null), 0);

// Round-trip: what the box shows, re-typed, must store the same paise. Without
// this the value is multiplied by a hundred on every save of an untouched row.
[0, 1, 250, 5000, 123456].forEach((paise) => {
  assert.equal(discountToServer("amt", discountFromServer("amt", paise)), paise,
    "amt round-trips at " + paise);
});

// End to end at the figure from the bug report: ₹29,499 plan, ₹5,000 typed.
const typed = liveTotals({
  lines: [{ amountPaise: 2949900, discountType: "amt",
            discountValue: discountToServer("amt", "5000") }],
  gstRate: 18, taxMode: "applicable", placeOfSupply: "Delhi",
});
assert.equal(typed.discountAmountPaise, 500000, "₹5,000 off, not ₹50");
assert.equal(typed.taxablePaise, 2449900);
assert.equal(typed.grandTotalPaise, 2890882);

console.log("quotations helpers: ok");
