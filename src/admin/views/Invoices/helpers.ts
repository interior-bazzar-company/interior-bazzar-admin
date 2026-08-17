import type { InvoiceRow } from "../../../api/modules/adminOps";

export function planItemOf(inv: InvoiceRow) {
  return inv.items.find((i) => i.kind === "plan") || null;
}
export function addonsOf(inv: InvoiceRow) {
  return inv.items.filter((i) => i.kind === "addon");
}
