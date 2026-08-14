/* =============================================================================
   Invoice — Module 3 · the small shared functions
   -----------------------------------------------------------------------------
   The top of views-invoice.js, ported verbatim. Nothing here renders; every one
   of these was a plain function in the prototype and stays one.
   ============================================================================= */
import { IBData, IBDeals, IBInvoice, IBQuote } from "../../engines";

const D = IBData, N = IBInvoice, E = IBDeals, Q = IBQuote;

// The common remark shapes, offered as one-click presets — "auto" fields, in
// the sense that picking one needs no typing. "Other" drops to a manual
// free-text field below it, so anything not on this short list still fits.
export const REMARK_PRESETS = ["Slot booking", "Installment 1", "Installment 2",
  "Installment 3", "Installment 4", "Installment 5"];

export function actor() {
  const u = D.TeamStore.current() || { name: "System", role: "super_admin" };
  return { name: u.name, role: u.role, id: u.id };
}
export function head() { return E.isHead(actor()); }
export function inr(p: number, o?: { compact?: boolean }) { return D.inr(p, o); }
export function rupees(v: string) { const n = Number(String(v).replace(/[^\d.]/g, "")); return isNaN(n) ? 0 : Math.round(n * 100); }
/* The prototype read its uncontrolled fields straight off the DOM, and the
   ported ui/Field renders the same uncontrolled inputs with the same ids — so
   this is still the way the form is gathered. */
export function val(id: string) { const e = document.getElementById(id) as HTMLInputElement | null; return e ? e.value : ""; }
export function merge<T extends object>(p: T, x: Record<string, string>): Record<string, string> {
  const o: Record<string, string> = {};
  for (const k in p) o[k] = (p as Record<string, string>)[k];
  for (const k2 in x) o[k2] = x[k2];
  return o;
}

export function overdueDays(inv: any) {
  const d = N.daysUntil(inv.due_date);
  return d < 0 ? Math.abs(d) : 0;
}

/* The plan line no longer carries months or a rate — it can be raised for
   any amount, with a remark saying what it is (an installment, a
   registration amount, a balance payment…). The quotation's installment
   schedule only supplies a starting suggestion when there's no remark yet. */
export function billingCell(plan: any): string {
  if (!plan) return "—";
  if (plan.remark) return plan.remark;
  if (plan.installment_count)
    return "Installment " + plan.installment_seq + " of " + plan.installment_count;
  return inr(plan.amount_paise);
}

export function isOverdue(i: any) {
  return i.invoice_status !== N.DOC.CANCELLED && !!N.balance(i) && overdueDays(i) > 0;
}

/* One 3px rail, the same three tones the Deals and Quotations tables use, and
   never colour alone — every rail carries a title. An invoice rots in two
   ways: it was issued and the money has not arrived by the due date, or it
   was never issued at all. */
export function urgency(i: any): { cls: string; why: string } | null {
  if (i.invoice_status === N.DOC.CANCELLED) return null;
  if (isOverdue(i)) {
    const d = overdueDays(i);
    return { cls: "u-bad", why: i.invoice_status === N.DOC.DRAFT
      ? "Past due by " + d + " day" + (d === 1 ? "" : "s") + " and still a draft — never issued"
      : "Overdue by " + d + " day" + (d === 1 ? "" : "s") + " — " +
        inr(N.balance(i)) + " still to log" };
  }
  if (i.invoice_status === N.DOC.DRAFT) {
    const age = Math.abs(N.daysUntil(i.invoice_date || i.created_at));
    if (age > 7) return { cls: "u-warn", why: "Draft older than 7 days — never issued" };
    return null;
  }
  if (N.balance(i) && N.daysUntil(i.due_date) <= 3)
    return { cls: "u-info", why: "Due in " + N.daysUntil(i.due_date) + " days, still unpaid" };
  return null;
}

export function uniq(a: string[]) {
  const o: Record<string, number> = {}, r: string[] = [];
  a.forEach(function (x) { if (x && !o[x]) { o[x] = 1; r.push(x); } });
  return r;
}

export function sorter(k: string | undefined, order: Map<any, number>) {
  return function (a: any, b: any) {
    if (k === "amount") return b.grand_total_paise - a.grand_total_paise;
    if (k === "date") return a.invoice_date < b.invoice_date ? 1 : -1;
    if (k === "due") {
      // Due date ascending, overdue first — the working set on a Monday morning.
      const ao = !!a.payment_id || a.invoice_status === N.DOC.CANCELLED ? 1 : 0;
      const bo = !!b.payment_id || b.invoice_status === N.DOC.CANCELLED ? 1 : 0;
      if (ao !== bo) return ao - bo;
      return (a.due_date || "9999") < (b.due_date || "9999") ? -1 : 1;
    }
    return (order.get(b) as number) - (order.get(a) as number);   // default: newest created first
  };
}

export function fileSize(b: number) {
  return b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(0) + " KB"
                                           : (b / 1048576).toFixed(1) + " MB";
}

/** The quotation number behind an invoice, or null. Read in six places. */
export function quoteNumberOf(inv: any): string | null {
  return inv && inv.quotation_id && Q ? (Q.quoteOf(inv.quotation_id) || {}).quotation_number || null : null;
}

export type Refusal = { ok: false; http: number; code: string; detail: string };
export const refused = (r: any): r is Refusal => r && r.ok === false;
