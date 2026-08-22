import type { PlanRow, QuotationRow } from "../../../api/modules/adminOps";
import { cap } from "../../ui";

export function partyLine(q: QuotationRow): string {
  const p = q.party;
  if (!p) return "—";
  return p.business ? p.name + " · " + p.business : p.name;
}

/** Every quotation carries exactly one plan-shaped line and any number of
 *  one-off addon lines — see QuotationsController._recalc. */
export function planItemOf(q: QuotationRow) {
  return q.items.find((i) => i.kind === "plan") || null;
}
export function addonsOf(q: QuotationRow) {
  return q.items.filter((i) => i.kind === "addon");
}

/* The letterhead, matching interior_deals_billing/pricing.py SELLER — the
   backend prints the real document from that dict, this is only the FROM strip
   the builder shows beside it. Kept to the fields the strip renders; anything
   the customer actually receives still comes from the server. */
export const SELLER = {
  brand: "Interior bazzar",
  tagline: "Unit of FEELSAFE TECHNOLOGY INDIA PRIVATE LIMITED",
  addr: "Plot no. 42, First Floor, Kh no. 27/14, Shiv Park, Kakrola, "
    + "New Delhi, South West Delhi 110078, Delhi",
  cin: "U62090DL2024PTC434514",
  gstin: "",            // registration in progress — the row prints CIN instead
  state: "Delhi",
};

/** The 36 states/UTs, same list `pricing.STATES` validates against. Place of
 *  supply drives the CGST/SGST ↔ IGST split, so it is a pick, not a text box. */
export const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Jammu and Kashmir", "Ladakh", "Chandigarh", "Puducherry", "Andaman and Nicobar Islands",
  "Dadra and Nagar Haveli and Daman and Diu", "Lakshadweep",
];

export const GST_RATES = [0, 5, 12, 18, 28];

/** How a catalogue plan is named ON the quotation: "Business · Signature".
 *  One function, so the picker, the header and the stored line all agree —
 *  the stored name is matched back against the catalogue by this exact
 *  string. */
export function planLabel(p: Pick<PlanRow, "planFamily" | "title">): string {
  return cap(p.planFamily || "business") + " · " + p.title;
}

/** base / discount / net for one line. `taxableAmountPaise` is what the server
 *  already computed the net to be (pricing.line_net), so the discount is read
 *  back off it rather than recomputed here — two implementations of the same
 *  subtraction is how the panel and the document start disagreeing. */
export function lineNet(it: { amountPaise: number; taxableAmountPaise: number }) {
  const base = it.amountPaise || 0;
  const net = it.taxableAmountPaise || 0;
  return { base, net, disc: Math.max(0, base - net) };
}

export type Blocker = { code: string; text: string };

/** Why Issue would refuse, stated before you press it. These mirror the four
 *  guards in QuotationsController.Issue — the server re-checks every one, this
 *  only stops the page from inviting a click it knows will 422. */
export function blockersOf(q: QuotationRow): Blocker[] {
  const out: Blocker[] = [];
  const plan = planItemOf(q);
  if (!plan || !plan.amountPaise) out.push({ code: "quotation_empty", text: "The plan line needs an amount." });
  if (!q.placeOfSupply) out.push({ code: "validation_failed", text: "A place of supply is required." });
  if (!q.validUntil) out.push({ code: "invalid_validity", text: "A validity date is required." });
  if (q.grandTotalPaise <= 0) out.push({ code: "invalid_pricing", text: "The grand total must be greater than zero." });
  return out;
}

/** Whole days from today to a date-only ISO string. Local-time field parse,
 *  same reason fmtDate does it that way. */
export function daysUntil(iso: string | null | undefined): number {
  if (!iso) return 0;
  const p = String(iso).slice(0, 10).split("-");
  const then = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((then.getTime() - now.getTime()) / 86400000);
}

/** Issued and within 3 days of lapsing — the one attention state that earns a
 *  cell on the strip, same rule as the prototype expiringSoon(). */
export function expiringSoon(q: QuotationRow): boolean {
  if (q.status !== "issued") return false;
  const d = daysUntil(q.validUntil);
  return d >= 0 && d <= 3;
}

/** The strip's seven numbers, counted over the WHOLE page — never over the
 *  narrowed rows, or every cell but the one you picked reads 0. `awaiting` and
 *  `agreed` are sums of real per-quotation grand totals, nothing estimated.
 *  "Whole page" is now as much as the CALLER WAS GIVEN, though: the API hands a
 *  scoped session only the quotations on its own deals, so these are that
 *  viewer's totals rather than the company's. The strip labels the difference
 *  (index.tsx) — anything else rendering these has to do the same. */
export function summarize(all: QuotationRow[]) {
  const byStatus: Record<string, number> = {};
  let awaitingPaise = 0, agreedPaise = 0, expiring = 0;
  all.forEach((q) => {
    byStatus[q.status] = (byStatus[q.status] || 0) + 1;
    if (q.status === "issued") awaitingPaise += q.grandTotalPaise;
    if (q.status === "accepted") agreedPaise += q.grandTotalPaise;
    if (expiringSoon(q)) expiring += 1;
  });
  return { total: all.length, byStatus, expiring, awaitingPaise, agreedPaise };
}

/** Status / owner / free-text, applied in that order. Client-side because the
 *  strip above has to keep counting what you filtered out. */
export function filterQuotations(
  all: QuotationRow[], f: { status?: string; owner?: string; q?: string }
): QuotationRow[] {
  let r = all;
  if (f.status === "expiring") r = r.filter(expiringSoon);
  else if (f.status) r = r.filter((x) => x.status === f.status);
  if (f.owner) r = r.filter((x) => String(x.owner ? x.owner.id : "") === f.owner);
  if (f.q) {
    const s = f.q.toLowerCase();
    r = r.filter((x) => ((x.quotationNumber || "draft") + " " + x.dealRef + " " + partyLine(x))
      .toLowerCase().includes(s));
  }
  return r;
}
