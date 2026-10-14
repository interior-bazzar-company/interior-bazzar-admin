import type { InvoiceRow } from "../../../api/modules/adminOps";

export function planItemOf(inv: InvoiceRow) {
  return inv.items.find((i) => i.kind === "plan") || null;
}
export function addonsOf(inv: InvoiceRow) {
  return inv.items.filter((i) => i.kind === "addon");
}

/** Why Issue would refuse, stated before you press it. These mirror the guards
 *  in InvoicesController.Issue -- the server re-checks every one, this only
 *  stops the page from inviting a click it knows will be refused. The deal-cap
 *  guard is NOT here: the invoice row carries no deal value to measure against,
 *  so that one is the server's alone. */
export function blockersOf(inv: InvoiceRow): string[] {
  const out: string[] = [];
  const plan = planItemOf(inv);
  if (!inv.items.length) out.push("An invoice needs at least one line.");
  else if (!plan || !plan.amountPaise) out.push("The plan line needs an amount.");
  if (!inv.billing.name || !inv.billing.address) out.push("The billing block is incomplete.");
  if (!inv.dueDate) out.push("A due date is required.");
  if (inv.grandTotalPaise <= 0) out.push("The grand total must be greater than zero.");
  /* No proof or UTR check: Issue no longer records a payment (InvoicesController.Issue),
     so the server does not ask for them. They belong to Record payment. */
  return out;
}
