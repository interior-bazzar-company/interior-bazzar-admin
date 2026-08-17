/* =====================================================================
   INVOICES — the real thing, from `v1/admin/invoices/`
   (interior_deals_billing.Invoice, via interior_admin InvoicesViews).

   Raised against an ACCEPTED quotation, only after payment has already
   been received — this is a log-what-came-in flow, never an online
   checkout. Issuing writes the deal-payment ledger row itself, in the same
   transaction as freezing the invoice. See
   interior_admin/Controllers/Invoices/InvoicesController.py.

   Failure envelope: same house style as everywhere else in this panel —
   HTTP 200 always, `response:false` carries the refusal.
   ===================================================================== */
import { useEffect, useState } from "react";
import AdminOpsService, { call } from "../../../api/modules/adminOps";
import type { InvoiceRow, InvoicesListResponse } from "../../../api/modules/adminOps";
import { AppExceptions } from "../../../api/apiService";

export { call };
export type { InvoiceRow };

export const STATUS_LABEL: Record<string, string> = { draft: "Draft", issued: "Paid", cancelled: "Cancelled" };
export const STATUS_TONE: Record<string, string> = { draft: "", issued: "ok", cancelled: "dead" };

export function rupeesToPaise(v: string): number {
  const n = parseFloat(String(v || "").replace(/[^\d.]/g, ""));
  return isNaN(n) ? 0 : Math.round(n * 100);
}
export function paiseToRupees(p: number | null | undefined): string {
  if (!p) return "";
  const r = p / 100;
  return r % 1 === 0 ? String(r) : r.toFixed(2);
}

export type InvoicesListState = { loading: boolean; rows: InvoiceRow[]; total: number; error: string | null };

export function useInvoicesList(
  tick: number, params: { deal?: string; quotation?: number; status?: string; sort?: string }
): InvoicesListState {
  const [state, setState] = useState<InvoicesListState>({ loading: true, rows: [], total: 0, error: null });
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    call(AdminOpsService.invoices({ ...params, pageSize: 200 }))
      .then((data: InvoicesListResponse) => {
        if (cancelled) return;
        setState({ loading: false, rows: data.invoices || [], total: data.total || 0, error: null });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setState({ loading: false, rows: [], total: 0,
          error: e instanceof AppExceptions ? e.message : "Could not reach the server." });
      });
    return () => { cancelled = true; };
  }, [tick, params.deal, params.quotation, params.status, params.sort]);
  return state;
}

export type InvoiceState = { loading: boolean; invoice: InvoiceRow | null; notFound: boolean };

export function useInvoice(id: number | null, tick: number): InvoiceState {
  const [state, setState] = useState<InvoiceState>({ loading: true, invoice: null, notFound: false });
  useEffect(() => {
    if (!id) { setState({ loading: false, invoice: null, notFound: false }); return; }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    call(AdminOpsService.invoice(id))
      .then((data: InvoiceRow) => { if (!cancelled) setState({ loading: false, invoice: data, notFound: false }); })
      .catch(() => { if (!cancelled) setState({ loading: false, invoice: null, notFound: true }); });
    return () => { cancelled = true; };
  }, [id, tick]);
  return state;
}
