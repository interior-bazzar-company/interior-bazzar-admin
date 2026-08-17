import type { QuotationRow } from "../../../api/modules/adminOps";

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
