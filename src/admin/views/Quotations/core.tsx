/* =============================================================================
   Quotation — Module 2 · the engine handles, the helpers, the re-render seam
   -----------------------------------------------------------------------------
   The prototype kept all of this in one file with the screens
   (views-quotation.js). Split here only because a React module is files, not
   one closure: the screens are components, the `M["qt-*"]` map is
   useQuotations.tsx, and the modals it opens are modals.tsx. This file is what
   all three share, and it imports none of them — so there is no cycle.

   Four principles, carried from Module 1:

     1. Locked actions are ABSENT, not greyed.
     2. Every modal states the rule BEFORE you commit, and prints the server
        code if it still rejects.
     3. The UI is a convenience, never the enforcement.
     4. Every figure on the builder is DISPLAY ONLY. The engine recomputes on
        save and again inside the issue transaction.
   ============================================================================= */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { IBData, IBDeals, IBQuote } from "../../engines";
import { currentActor } from "../../auth/session";

export const D: any = IBData;
export const E: any = IBDeals;
export const Q: any = IBQuote;

export type Res = { ok?: boolean; http?: number; code?: string; detail?: string; data?: any };

/* The context a modal needs. Modals are rendered by ShellProvider, which sits
   ABOVE the router's NavCtx — so `go` is handed down rather than looked up. */
export type QtCtx = {
  go: (hash: string) => void;
  done: (msg: ReactNode, route?: string) => void;
  toast: (msg: ReactNode, tone?: string) => void;
  closeLayer: () => void;
};

// Who did this — the real signed-in identity now, not IBData.TeamStore.
export const actor = currentActor;
export function head() { return E.isHead(actor()); }
export function inr(p: number, o?: any) { return D.inr(p, o); }
export function rupees(v: any) { const n = Number(String(v).replace(/[^\d.]/g, "")); return isNaN(n) ? 0 : Math.round(n * 100); }
/* The builder's fields are uncontrolled — the prototype re-rendered whole views
   as innerHTML, so every value="…" was an attribute rather than state, and the
   ports keep that (ui/Field uses defaultValue for the same reason). Reading them
   back by id is therefore the same read the prototype made. */
export function val(id: string) { const e = document.getElementById(id) as HTMLInputElement | null; return e ? e.value : ""; }
export function merge(p: Record<string, string>, x: Record<string, string>) {
  const o: Record<string, string> = {}; for (const k in p) o[k] = p[k]; for (const k2 in x) o[k2] = x[k2]; return o;
}
export function omit(p: Record<string, string>, keys: string[]) {
  const o: Record<string, string> = {}; for (const k in p) if (keys.indexOf(k) < 0) o[k] = p[k]; return o;
}

/* -------------------------------------------------------------- re-render ---
   The prototype called S.render() after every write: the engines mutate a
   localStorage-backed store in place, so nothing re-reads them on its own. This
   is that one call, as a subscription — every screen in this module reads the
   same counter, so a write anywhere refreshes all of them at once. */
let ver = 0;
const subs = new Set<() => void>();
export function bump() { ver++; subs.forEach((f) => f()); }
const subscribe = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb); }; };
export const useRender = () => useSyncExternalStore(subscribe, () => ver);

/* Days-to-expiry, rendered once so the list, the detail and the badge agree. */
export function validityChip(q: any): ReactNode {
  if (q.status !== Q.ST.ISSUED) {
    return q.valid_until ? <span className="faint">{D.fmtDate(q.valid_until)}</span> : "—";
  }
  const d = Q.daysUntil(q.valid_until);
  if (d < 0) return <span style={{ textDecoration: "line-through", color: "var(--bad)" }}>{D.fmtDate(q.valid_until)}</span>;
  const tone = d <= 3 ? { color: "var(--bad)", fontWeight: 500 } : d <= 7 ? { color: "var(--warn)" } : {};
  return (
    <>
      <span style={tone}>{D.fmtDate(q.valid_until)}</span>
      <div className="cell-2">{d === 0 ? "today" : "in " + d + "d"}</div>
    </>
  );
}
export function expiringSoon(q: any) {
  if (q.status !== Q.ST.ISSUED) return false;
  const d = Q.daysUntil(q.valid_until); return d >= 0 && d <= 3;
}
export function staleDraft(q: any) {
  return q.status === Q.ST.DRAFT && Math.abs(Q.daysUntil(q.created_at)) > 7;
}
/* One 3px rail, the same three tones the Deals table uses, and never colour
   alone — every rail carries a title. A quotation has exactly two ways of
   rotting: it was issued and is about to lapse, or it was never issued at
   all. Both are silent failures, which is why they get the rail rather than
   a column somebody has to think to read. */
export function urgency(q: any): { cls: string; why: string } | null {
  if (q.status === Q.ST.ISSUED) {
    const d = Q.daysUntil(q.valid_until);
    if (d < 0) return { cls: "u-bad", why: "Expired — issued and never answered" };
    if (d <= 3) return { cls: "u-bad", why: "Expiring in " + (d === 0 ? "under a day" : d + " days") };
    if (d <= 7) return { cls: "u-info", why: "Expiring in " + d + " days" };
    return null;
  }
  if (staleDraft(q)) return { cls: "u-warn", why: "Draft older than 7 days — the customer never got it" };
  return null;
}

export function uniq(a: string[]) { const o: Record<string, number> = {}, r: string[] = []; a.forEach((x) => { if (x && !o[x]) { o[x] = 1; r.push(x); } }); return r; }
export function sorter(k: string | undefined, order: Map<any, number>) {
  return function (a: any, b: any) {
    if (k === "value") return b.grand_total_paise - a.grand_total_paise;
    if (k === "issued") return (b.issued_at || "") < (a.issued_at || "") ? -1 : 1;
    if (k === "valid") return (a.valid_until || "9999") < (b.valid_until || "9999") ? -1 : 1;
    return (order.get(b) as number) - (order.get(a) as number);   // default: newest created first
  };
}

/* One combined patch, one engine call, one commit — see Draft.saveAll in
   quotation-engine.js. This used to chain qt-save-header, qt-save-plan and
   qt-save-addons as three separately-committed writes; a failure on the
   third left the first two written, and the pieces were validated against
   each other's half-applied state rather than the shape they end up in
   together. */
export function saveAllQuiet(ref: string): Res {
  const q = Q.quoteOf(ref);
  if (!q) return { ok: false, http: 404, code: "quotation_not_found", detail: String(ref) };
  const patch: any = {
    quotation_date: val("qDate"), valid_until: val("qValid"), place_of_supply: val("qPos"),
    gst_rate: document.getElementById("qGst") ? val("qGst") : undefined,
    notes: val("qNotes"), terms: val("qTerms"),
    term_months: val("pTerm"), total_amount_paise: rupees(val("pTotal")),
    installments: val("pInstallments"),
    discount_type: val("pDiscT"), discount_value: val("pDisc"),
    row_version: q.row_version
  };
  // The gap control only renders once there is more than one payment, so it
  // is sent only when it exists — an absent key leaves the stored cadence
  // alone rather than resetting it to monthly.
  if (document.getElementById("pGap")) patch.installment_gap_months = val("pGap");
  // Addon inputs only exist once there is an addon row on screen to hold
  // them — an absent section is skipped rather than sent as blank.
  if (document.querySelector('[id^="a-nm-"]')) {
    patch.addons = Q.addonsOf(ref).map((it: any) => ({
      item_id: it.item_id, name: val("a-nm-" + it.item_id), hsn: val("a-hs-" + it.item_id),
      amount_paise: rupees(val("a-am-" + it.item_id)),
      discount_type: val("a-dt-" + it.item_id), discount_value: val("a-dv-" + it.item_id)
    }));
  }
  return Q.Draft.saveAll(ref, patch, actor());
}

