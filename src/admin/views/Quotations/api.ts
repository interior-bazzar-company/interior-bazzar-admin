/* =====================================================================
   QUOTATIONS — the real thing, from `v1/admin/quotations/`
   (interior_deals_billing.Quotation, via interior_admin QuotationsViews).

   A quotation is born inside a Deal, priced by hand (no plan-catalogue
   lookup — the agent types the name/term/total/installments/discount), and
   frozen the moment it is issued: there is no PUT on an issued quotation,
   only Revise (clone into a new draft) or a status change (Accept/Reject/
   Cancel). See interior_admin/Controllers/Quotations/QuotationsController.py
   for the full state machine this module is a thin client over.

   Failure envelope: same house style as Deals/Plans — HTTP 200 always,
   `response:false` carries the refusal. `call()` unwraps it into a throw.
   ===================================================================== */
import { useEffect, useState } from "react";
import AdminOpsService, { call } from "../../../api/modules/adminOps";
import type { QuotationRow, QuotationsListResponse } from "../../../api/modules/adminOps";
import { AppExceptions } from "../../../api/apiService";

export { call };
export type { QuotationRow };

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", issued: "Issued", accepted: "Accepted", rejected: "Rejected",
  expired: "Expired", superseded: "Superseded", cancelled: "Cancelled",
};
export const STATUS_TONE: Record<string, string> = {
  draft: "", issued: "warn", accepted: "ok", rejected: "bad",
  expired: "dead", superseded: "dead", cancelled: "dead",
};

/** ₹1,23,456.50 (typed by a human) → 12345650 paise. Blank/garbage → 0. */
export function rupeesToPaise(v: string): number {
  const n = parseFloat(String(v || "").replace(/[^\d.]/g, ""));
  return isNaN(n) ? 0 : Math.round(n * 100);
}
/** Paise → "123456.50" (or "" for 0/absent), the shape an <input> edits. */
export function paiseToRupees(p: number | null | undefined): string {
  if (!p) return "";
  const r = p / 100;
  return r % 1 === 0 ? String(r) : r.toFixed(2);
}

export type QuotationsListState = { loading: boolean; rows: QuotationRow[]; total: number; error: string | null };

/** Re-fetched whenever `tick` or a filter changes — this module's stand-in
 *  for the deleted engine's render() pump. */
export function useQuotationsList(
  tick: number, params: { deal?: string; status?: string; owner?: number; sort?: string }
): QuotationsListState {
  const [state, setState] = useState<QuotationsListState>({ loading: true, rows: [], total: 0, error: null });
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    call(AdminOpsService.quotations({ ...params, pageSize: 200 }))
      .then((data: QuotationsListResponse) => {
        if (cancelled) return;
        setState({ loading: false, rows: data.quotations || [], total: data.total || 0, error: null });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setState({ loading: false, rows: [], total: 0,
          error: e instanceof AppExceptions ? e.message : "Could not reach the server." });
      });
    return () => { cancelled = true; };
  }, [tick, params.deal, params.status, params.owner, params.sort]);
  return state;
}

/** Every quotation on the same deal, newest first — the version set. The rail
 *  and the Versions tab both read it, and the API already answers this exact
 *  question with `?deal=`, so there is no separate versions endpoint to add. */
export function useQuotationVersions(dealRef: string | null): { versions: QuotationRow[] } {
  const [versions, setVersions] = useState<QuotationRow[]>([]);
  useEffect(() => {
    if (!dealRef) { setVersions([]); return; }
    let cancelled = false;
    call(AdminOpsService.quotations({ deal: dealRef, pageSize: 50 }))
      .then((data: QuotationsListResponse) => {
        if (cancelled) return;
        const rows = (data.quotations || []).slice();
        rows.sort((a, b) => a.version - b.version || a.id - b.id);
        setVersions(rows);
      })
      .catch(() => { if (!cancelled) setVersions([]); });
    return () => { cancelled = true; };
  }, [dealRef]);
  return { versions };
}

export type QuotationState = { loading: boolean; quotation: QuotationRow | null; notFound: boolean };

/** One quotation, with its events — re-fetched on `tick` so the drawer
 *  refreshes after every write, same as the list does. */
export function useQuotation(id: number | null, tick: number): QuotationState {
  const [state, setState] = useState<QuotationState>({ loading: true, quotation: null, notFound: false });
  useEffect(() => {
    if (!id) { setState({ loading: false, quotation: null, notFound: false }); return; }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    call(AdminOpsService.quotation(id))
      .then((data: QuotationRow) => { if (!cancelled) setState({ loading: false, quotation: data, notFound: false }); })
      .catch(() => { if (!cancelled) setState({ loading: false, quotation: null, notFound: true }); });
    return () => { cancelled = true; };
  }, [id, tick]);
  return state;
}
