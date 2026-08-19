/* Self-check for the list's filter + strip maths. The money cells (awaiting /
   agreed) are sums of real per-quotation grand totals — nothing on this strip
   is estimated — so a drift here is a wrong figure on a sales screen.

   No test runner in this project — run it directly:
     npx esbuild src/admin/views/Quotations/helpers.test.ts --bundle --format=esm --outfile=t.mjs && node t.mjs
*/
import type { QuotationRow } from "../../../api/modules/adminOps";
import { blockersOf, expiringSoon, filterQuotations, lineNet, planLabel, summarize } from "./helpers";

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

console.log("quotations helpers: ok");
