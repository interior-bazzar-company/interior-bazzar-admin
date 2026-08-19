/* =============================================================================
   Money and dates, as the panel renders them.
   -----------------------------------------------------------------------------
   Lifted out of admin-data.js (IBData.inr / IBData.fmtDate) when the engine
   layer was deleted. These two are pure formatters — they hold no records and
   read no store, which is why they survived while everything around them went:
   turning paise into "₹29,20,000" is not data, it is presentation, and it has
   to happen somewhere on the client no matter where the number came from.

   `fmtDate` deliberately does NOT know what "today" is. The engine's date
   helpers measured against a frozen 28 June 2026 so the prototype's seeded
   "3d overdue" never drifted; anything relative now lives in Deals'
   `daysFrom()` / `relativeDate()`, which measure against the real clock.
   ============================================================================= */

/** Indian lakh/crore grouping. Never thousands grouping, never decimals. */
function groupIN(n: number): string {
  const s = String(n);
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  return s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
}

/** Paise → "₹29,20,000". `null`/`undefined` is "—", never "₹0": no figure and
 *  a zero figure are different claims. `compact` gives the ₹29.20L / ₹1.5Cr
 *  form for figures over a lakh. */
export function inr(paise: number | null | undefined, opts?: { compact?: boolean }): string {
  if (paise === null || paise === undefined) return "—";
  const neg = paise < 0;
  const r = Math.round(Math.abs(paise) / 100);
  let out = "₹" + groupIN(r);
  if (opts && opts.compact && r >= 100000) {
    out = r >= 10000000
      ? "₹" + (r / 10000000).toFixed(r % 10000000 === 0 ? 0 : 2) + "Cr"
      : "₹" + (r / 100000).toFixed(r % 100000 === 0 ? 0 : 2) + "L";
  }
  return (neg ? "−" : "") + out; // U+2212 minus, not a hyphen
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const two = (n: number) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : ""));
const three = (n: number) =>
  (n > 99 ? ONES[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " : "") : "") + (n % 100 ? two(n % 100) : "");

/** Paise → "Rupees Four Lakh Seventy Two Thousand Only". Lakh/crore scale, the
 *  way an Indian commercial document states its total under the figure. */
export function inrWords(paise: number | null | undefined): string {
  let n = Math.round(Math.abs(paise || 0) / 100);
  if (!n) return "Rupees Zero Only";
  const parts: string[] = [];
  ([[10000000, "Crore"], [100000, "Lakh"], [1000, "Thousand"]] as [number, string][]).forEach(([u, label]) => {
    if (n >= u) { parts.push(two(Math.floor(n / u)) + " " + label); n %= u; }
  });
  if (n) parts.push(three(n));
  return "Rupees " + parts.join(" ") + " Only";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-06-27" → "27 Jun 2026". Takes a date-only ISO string or a Date.
 *  Parsed field-by-field rather than through `new Date(iso)` so the value is
 *  read in local time — `new Date("2026-06-27")` is UTC midnight, which is
 *  the previous day for anyone west of Greenwich. */
export function fmtDate(dt: string | Date | null | undefined): string {
  if (!dt) return "—";
  let date: Date;
  if (typeof dt === "string") {
    const p = dt.slice(0, 10).split("-");
    date = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  } else {
    date = dt;
  }
  if (isNaN(date.getTime())) return "—";
  return String(date.getDate()).padStart(2, "0") + " " + MONTHS[date.getMonth()] + " " + date.getFullYear();
}
