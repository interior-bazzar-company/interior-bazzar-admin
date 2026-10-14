/* =============================================================================
   Finance — the route component, shared by five sidebar rows.
   -----------------------------------------------------------------------------
     #/finance                        Subscriptions      · #/finance/SUB-0101
     #/finance-salaries               Salaries A/C       · /SAL-AC-0011 · /RUN-…
                                                          · /SLIP-2026-08-0011
     #/finance-transactions           Other Transaction  · /TXN-0901
     #/finance-refunds                Refunds            · /RF-0117
     #/finance-analytics              Analytics          · ?tab=kpi

   FIVE ROWS, ONE MODULE. Finance records four things and reads them back in a
   fifth place, and each is its own sidebar row and its own module key — so a
   grant can be held on one without the others. Payroll is the reason: it is
   the most sensitive record in the panel and has to be withholdable without
   also withholding the subscription ledger.

   The five keys resolve to THIS component, which reads its own route to know
   which section it is showing. There is no `?view=` any more and no in-page
   tab strip: the sidebar is the navigation, so a page opens straight onto its
   own controls.

   A record lives under its own section's route, so Back always lands on the
   list it came from and the sidebar keeps the right row lit.

   NO API YET — everything comes from src/content/finance/*.json through
   store.ts.
   ============================================================================= */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { hashToPath, usePageChrome } from "../../shell/AdminShell";
import { qs, TbTitle } from "../../ui";
import type { Params } from "./store";
import { PERIOD, RECORD_TYPES, fmtMonth, inr, useActiveCount, useOverview, useSalaryRows, useSalaryTotals, useSubTotals } from "./store";
import { ROUTE_OF, VIEW_OF } from "./Frame";
import Subscriptions from "./Subscriptions";
import Installments from "./Installments";
import SubscriptionDetail from "./SubscriptionDetail";
import Salaries from "./Salaries";
import SalaryDetail from "./SalaryDetail";
import Slip from "./Slip";
import Transactions from "./Transactions";
import TxnDetail from "./TxnDetail";
import Refunds from "./Refunds";
import RefundDetail from "./RefundDetail";
import Analytics from "./Analytics";

export const merge = (p: Params, extra: Params): Params => {
  const o: Params = { ...p };
  Object.keys(extra).forEach((k) => { o[k] = extra[k]; });
  return o;
};
export const omit = (p: Params, keys: string[]): Params => {
  const o: Params = {};
  Object.keys(p).forEach((k) => { if (keys.indexOf(k) < 0) o[k] = p[k]; });
  return o;
};
/** Hashes are built against a SECTION, not against "finance", because each
 *  section is its own route now. */
export const listHash = (view: string, p: Params = {}) =>
  "#/" + (ROUTE_OF[view] || "finance") + qs(p as Record<string, string>);
export const recHash = (view: string, id: string, p: Params = {}) =>
  "#/" + (ROUTE_OF[view] || "finance") + "/" + encodeURIComponent(id) + qs(p as Record<string, string>);

/* THE TOPBAR FIGURE. A tracked micro-label over a tabular figure, tinted only
   where the tone is the news — the panel's own vocabulary, so the Finance
   topbar and the Users topbar read as one product. */
function TbStat({ k, v, tone, title }: { k: string; v: string | number; tone?: "ok" | "warn"; title: string }) {
  return (
    <span className="flex min-w-0 flex-col leading-tight" title={title}>
      <span className="label-mono truncate">{k}</span>
      <span className={
        tone === "ok" ? "text-sm font-semibold text-success-primary tnum"
          : tone === "warn" ? "text-sm font-semibold text-warning-primary tnum"
            : "text-sm font-semibold text-primary tnum"
      }>{v}</span>
    </span>
  );
}

export default function Finance() {
  const raw = useParams().id;
  const id = raw ? decodeURIComponent(raw) : null;
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  /* The section is the route, and the route is the first path segment — the
     same thing ViewHost keyed the module on to get here. */
  const pathPart = location.pathname.split("/").filter(Boolean)[0];
  const hashPart = location.hash ? location.hash.replace(/^#[/]?/, "").split("/").filter(Boolean)[0] : "";
  const route = (pathPart || hashPart || "finance").toLowerCase();
  const view = VIEW_OF[route] || "subscriptions";

  const p = useMemo(() => {
    const o: Params = {};
    sp.forEach((v, k) => { if (v) o[k] = v; });
    return o;
  }, [sp]);

  /* THE TOPBAR CARRIES WHAT THE SECTION IS ABOUT, and nothing it is not.
     It once carried three money totals — collected, net, fail to pay — above
     EVERY section, including the ones that had nothing to do with them, and
     that is still the thing to avoid: a figure with no formula and no caution,
     printed over a page that does not compute it, is a number nobody can check.
     What replaced it is per-section. How many businesses are subscribed is
     scope on the subscription faces; on payroll the question is who is being
     paid and what is still owed, so that is what sits there instead — computed
     from the same derivation the rows use, on the page that owns it. */
  const activeN = useActiveCount();
  /* People on the payroll — active accounts only. A closed one keeps its slips
     and is still on the list below, but it is not somebody being paid. */
  const membersN = useSalaryRows().filter((r) => r.a.active).length;
  /* Paid out this period, and owed right now. Derived where the rows are, so
     the header and the table read the same arithmetic. */
  const totals = useSalaryTotals();
  /* All time, and the one definition the strip and the Analytics tab read too. */
  const subs = useSubTotals();
  /* Live overview figures across all modules (installments, transactions, refunds, analytics). */
  const ov = useOverview(view === "analytics" ? p.month : undefined);
  const analyticsLabel = p.month ? fmtMonth(p.month) : PERIOD.label;
  const crumbs = useMemo(() => (
    <>
      {/* The title says WHICH SECTION you are in — each is its own sidebar
          row and its own module key, so "Finance" over all five named none of
          them. It is also the way up: pressing it returns to this section's
          default view. */}
      <TbTitle
        to={listHash(view)}
        label={RECORD_TYPES.filter((r: { key: string; label: string }) => r.key === view)[0]?.label || "Finance"}
      />
      {/* THE FIGURES FOLLOW THE SECTION, and they are hidden on a narrow
          topbar rather than crushed into it: which number matters depends on
          what is on screen, and none of them is the page's own subject —
          every one is also on the page below, under a label that says what
          period it is for. */}
      <span className="hidden min-w-0 items-center gap-4 border-l border-secondary pl-3 xl:flex">
        {view === "salaries" ? (
          <>
            <TbStat k="Total members" v={totals.membersAll}
              title={"Every salary account of every kind, closed ones included. "
                + membersN + " of them are on the payroll right now."} />
            <TbStat k="Total paid" v={inr(totals.paidAllPaise)} tone="ok"
              title={"Every rupee ever paid out as salary, summed off the paid slips. "
                + inr(totals.paidPaise) + " of it in " + PERIOD.label + "."} />
            <TbStat k="Total unpaid" v={totals.unpaidPaise ? inr(totals.unpaidPaise) : "—"} tone="warn"
              title={totals.unpaidPeople
                ? totals.unpaidPeople + " " + (totals.unpaidPeople === 1 ? "person is" : "people are")
                  + " owed (" + inr(totals.pendingPaise) + " unpaid"
                  + (totals.heldPaise ? " + " + inr(totals.heldPaise) + " on hold" : "") + ")."
                : totals.membersAll
                  ? "Everybody is paid up."
                  : "No salary accounts yet — nothing is owed because nobody is set up."} />
          </>
        ) : view === "subscriptions" ? (
          <>
            <TbStat k="Active subscriptions" v={subs.activeN}
              title="Subscriptions running right now — a level, read at this moment, not a total for any period." />
            <TbStat k="All Subscriptions Collected" v={inr(subs.collectedPaise)} tone="ok"
              title={"Every rupee ever collected across all subscription plans ("
                + subs.subs + " subscription" + (subs.subs === 1 ? "" : "s") + ", "
                + subs.collectedN + " installment" + (subs.collectedN === 1 ? "" : "s") + " settled)."} />
            <TbStat k="Schedule Outstanding" v={subs.outstandingPaise ? inr(subs.outstandingPaise) : "—"} tone="warn"
              title={subs.outstandingPaise
                ? "Scheduled installment balance not yet in the bank: " + inr(subs.duePaise) + " upcoming/due and "
                  + inr(subs.failedPaise) + " overdue or failed."
                : "Every scheduled installment has been settled."} />
          </>
        ) : view === "installments" ? (
          <TbStat k="Installments Overdue / Failed" v={inr(ov.failedPaise)} tone={ov.failedN > 0 ? "warn" : "ok"}
            title={ov.failedN + " installment" + (ov.failedN === 1 ? " is" : "s are") + " overdue or failed to pay across all installment deals."} />
        ) : view === "transactions" ? (
          <TbStat k="Monthly spend" v={inr(ov.otherOutPaise)} tone="ok"
            title={"Total spent on transactions in " + PERIOD.label + " across " + ov.otherOutN + " entries."} />
        ) : view === "refunds" ? (
          <TbStat k="Refunds owed" v={ov.refundsOwedPaise ? inr(ov.refundsOwedPaise) : "—"} tone={ov.refundsOwedN ? "warn" : undefined}
            title={ov.refundsOwedN ? inr(ov.refundsOwedPaise) + " approved and waiting for transfer." : "No refunds awaiting payout."} />
        ) : view === "analytics" ? (
          <>
            <TbStat k={"Collected · " + analyticsLabel} v={inr(ov.collectedPaise)} tone="ok"
              title={"Total collected in " + analyticsLabel + " across " + ov.collectedN + " payments."} />
            <TbStat k={"Outgoings · " + analyticsLabel} v={inr(ov.outPaise)}
              title={"Salaries + operating spend + refunds settled in " + analyticsLabel + "."} />
            <TbStat k={"Net cash · " + analyticsLabel} v={inr(ov.netPaise)} tone={ov.netPaise >= 0 ? "ok" : "warn"}
              title={"Net cash flow in " + analyticsLabel + " (income minus all expenses)."} />
          </>
        ) : (
          <TbStat k="Active subscriptions" v={activeN}
            title="Subscriptions running right now — a level, read at this moment, not a total for any period." />
        )}
      </span>
    </>
  ), [view, activeN, membersN, subs, totals.membersAll, totals.paidPaise,
    totals.paidAllPaise, totals.unpaidPaise, totals.pendingPaise, totals.heldPaise, totals.unpaidPeople, ov, analyticsLabel]);

  usePageChrome(
    { crumbs, right: null, parent: id ? listHash(view) : null },
    /* Keyed on the figures themselves: they arrive from the store after the
       first render, and without them in the key the topbar keeps the zeros it
       mounted with. */
    (id ? "rec" : view) + ":" + (p.month || "") + ":" + activeN + "/" + membersN + "/" + totals.unpaidPaise
      + "/" + subs.collectedPaise + "/" + subs.outstandingPaise + "/" + ov.failedPaise + "/" + ov.otherOutPaise
      + "/" + ov.netPaise + "/" + ov.collectedPaise + "/" + ov.refundsOwedPaise,
  );

  const timer = useRef<number | undefined>(undefined);
  const goFilter = useCallback((hash: string) => { navigate(hashToPath(hash), { replace: true }); }, [navigate]);
  const onFilter = useCallback((name: string, value: string) => {
    goFilter(listHash(view, merge(omit(p, ["page"]), { [name]: value || undefined })));
  }, [p, view, goFilter]);
  const onSearch = useCallback((name: string, value: string) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () => goFilter(listHash(view, merge(omit(p, ["page"]), { [name]: value || undefined }))), 220);
  }, [p, view, goFilter]);
  const onUnfilter = useCallback((k: string) => {
    if (k === "*") return goFilter(listHash(view, { tab: p.tab }));
    goFilter(listHash(view, omit(p, k.split("+").concat(["page"]))));
  }, [p, view, goFilter]);
  const onParams = useCallback((patch: Params) => {
    goFilter(listHash(view, merge(omit(p, ["page"]), patch)));
  }, [p, view, goFilter]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (id) {
    const onRec = (patch: Params) => goFilter(recHash(view, id, merge(p, patch)));
    if (/^SLIP-/.test(id)) return <Slip id={id} p={p} onParams={onRec} />;
    if (/^SAL-|^RUN-/.test(id)) return <SalaryDetail id={id} p={p} onParams={onRec} />;
    if (/^TXN-/.test(id)) return <TxnDetail id={id} p={p} onParams={onRec} />;
    if (/^RF-/.test(id)) return <RefundDetail id={id} p={p} onParams={onRec} />;
    if (/^SUB-/.test(id) || view === "subscriptions") return <SubscriptionDetail id={id} p={p} onParams={onRec} />;
  }

  const shared = { p, onFilter, onSearch, onUnfilter, onParams };
  if (view === "installments") return <Installments {...shared} />;
  if (view === "salaries") return <Salaries {...shared} />;
  if (view === "transactions") return <Transactions {...shared} />;
  if (view === "refunds") return <Refunds {...shared} />;
  if (view === "analytics") return <Analytics {...shared} />;
  return <Subscriptions {...shared} />;
}
