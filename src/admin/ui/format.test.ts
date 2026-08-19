/* Self-check for the two formatters lifted out of the deleted engine layer.
   Money is a path worth one runnable check, and every expectation below is an
   output the old IBData.inr / IBData.fmtDate produced, so a drift here is a
   drift from what the panel used to render.

   No test runner in this project — run it directly:
     npx esbuild src/admin/ui/format.test.ts --bundle --format=esm --outfile=t.mjs && node t.mjs
*/
import { fmtDate, inr, inrWords } from "./format";

/* Its own two-line assert rather than node:assert, so this file typechecks
   with the app's own tsconfig (no @types/node) and stays runnable. */
const assert = {
  equal(actual: unknown, expected: unknown) {
    if (actual !== expected) throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
  },
};

// Indian grouping, never thousands grouping, never decimals.
assert.equal(inr(292000000), "₹29,20,000");
assert.equal(inr(103170000), "₹10,31,700");
assert.equal(inr(24780000), "₹2,47,800");
assert.equal(inr(99900), "₹999");
assert.equal(inr(0), "₹0");
// No figure and a zero figure are different claims.
assert.equal(inr(null), "—");
assert.equal(inr(undefined), "—");
// U+2212 minus, not a hyphen.
assert.equal(inr(-5900000), "−₹59,000");
assert.equal(inr(-5900000).charCodeAt(0), 0x2212);
// compact only above a lakh, and only when asked.
assert.equal(inr(292000000, { compact: true }), "₹29.20L");
assert.equal(inr(150000000000, { compact: true }), "₹150Cr"); // 150,00,00,000 rupees
assert.equal(inr(15000000000, { compact: true }), "₹15Cr");
assert.equal(inr(9990000, { compact: true }), "₹99,900");
assert.equal(inr(292000000), "₹29,20,000");

// Dates: local-time parse, so no off-by-one day west of Greenwich.
assert.equal(fmtDate("2026-06-27"), "27 Jun 2026");
assert.equal(fmtDate("2026-06-27T00:00:00Z"), "27 Jun 2026");
assert.equal(fmtDate("2026-01-05"), "05 Jan 2026");
assert.equal(fmtDate(new Date(2026, 7, 17)), "17 Aug 2026");
assert.equal(fmtDate(null), "—");
assert.equal(fmtDate(""), "—");
assert.equal(fmtDate("not-a-date"), "—");

// The total in words, as an Indian commercial document states it under the
// figure. Lakh/crore scale, never the short scale.
assert.equal(inrWords(0), "Rupees Zero Only");
assert.equal(inrWords(null), "Rupees Zero Only");
assert.equal(inrWords(100), "Rupees One Only");
assert.equal(inrWords(1900), "Rupees Nineteen Only");
assert.equal(inrWords(4500), "Rupees Forty Five Only");
assert.equal(inrWords(10500), "Rupees One Hundred Five Only");
assert.equal(inrWords(4720000), "Rupees Forty Seven Thousand Two Hundred Only");
assert.equal(inrWords(292000000), "Rupees Twenty Nine Lakh Twenty Thousand Only");
assert.equal(inrWords(15000000000), "Rupees Fifteen Crore Only");
// Paise round to the nearest rupee, same as inr() shows it.
assert.equal(inrWords(150), "Rupees Two Only");

console.log("format.ts: all checks passed");
