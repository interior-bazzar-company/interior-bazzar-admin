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
import { qs } from "../../ui";
import type { Params } from "./store";
import { PERIOD, inr, useActiveCount, useSalaryRows, useSalaryTotals } from "./store";
import { ROUTE_OF, VIEW_OF } from "./Frame";
import Subscriptions from "./Subscriptions";
import SubscriptionDetail from "./SubscriptionDetail";
import Salaries from "./Salaries";
import SalaryDetail from "./SalaryDetail";
import Slip from "./Slip";
import Transactions from "./Transactions";
import TxnDetail from "./TxnDetail";
import Refunds from "./Refunds";
import RefundDetail from "./RefundDetail";
import Analytics from "./Analytics";
import "../charts.css";
import "./finance.css";

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

export default function Finance() {
  const raw = useParams().id;
  const id = raw ? decodeURIComponent(raw) : null;
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  /* The section is the route, and the route is the first path segment — the
     same thing ViewHost keyed the module on to get here. */
  const route = (location.pathname.split("/").filter(Boolean)[0] || "finance").toLowerCase();
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
  const crumbs = useMemo(() => (
    <>
      <span className="tb-title">Finance</span>
      {/* ONE FIGURE, AND IT FOLLOWS THE SECTION. Which number depends on what
          is on screen: how many businesses are subscribed is scope on the
          subscriptions face and noise on the payroll one, where the question
          is how many people are being paid.

          It is `.tb-stat`, the panel's own topbar figure — the same markup
          Users renders, so the two sections read as one panel. It used to be
          `.fin-scope`: a bordered pill, tinted green, with a status dot and
          the count in a second bordered well, which said its one thing three
          times and coloured the label, against the theme's own rule that the
          tone goes on the figure and never on the word beside it. */}
      <span className="tb-stats">
        {view === "salaries" ? (
          <>
            <span className="tb-stat ro"
              title="Salary accounts on the payroll right now. Closed accounts are not counted; their slips stay on the record.">
              <span className="k">Members</span>
              <span className="v tnum">{membersN}</span>
            </span>
            <span className="tb-sep" />
            {/* MONEY IN THE TOPBAR, WHICH THIS MODULE ONCE REFUSED — and the
                refusal is worth restating, because it still holds where it was
                made. Three totals used to sit here on EVERY section, including
                the ones that had nothing to do with them: a figure with no
                formula and no caution, repeated above pages that do not compute
                it, is a number nobody can check. These two are the opposite
                case. They belong to the section they appear on, they are the
                question that section exists to answer, and they are derived
                from the same `dueOf` the rows below use — so the header and the
                table cannot disagree. */}
            <span className="tb-stat ro ok" title={"Salary paid out in " + PERIOD.label + ". A month nobody has been paid for yet is not in it."}>
              <span className="k">Paid</span>
              <span className="v tnum">{inr(totals.paidPaise)}</span>
            </span>
            <span className="tb-stat ro warn"
              title={totals.unpaidPeople
                ? totals.unpaidPeople + " " + (totals.unpaidPeople === 1 ? "person is" : "people are") + " owed, arrears included."
                : "Everybody is paid up."}>
              <span className="k">Unpaid</span>
              <span className="v tnum">{totals.unpaidPaise ? inr(totals.unpaidPaise) : "—"}</span>
            </span>
          </>
        ) : (
          <span className="tb-stat ro"
            title="Subscriptions running right now — a level, read at this moment, not a total for any period.">
            <span className="k">Active subscriptions</span>
            <span className="v tnum">{activeN}</span>
          </span>
        )}
      </span>
    </>
  ), [view, activeN, membersN, totals.paidPaise, totals.unpaidPaise, totals.unpaidPeople]);

  usePageChrome(
    { crumbs, right: null, parent: id ? listHash(view) : null },
    (id ? "rec" : view) + ":" + activeN + "/" + membersN + "/" + totals.unpaidPaise,
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
    return <SubscriptionDetail id={id} p={p} onParams={onRec} />;
  }

  const shared = { p, onFilter, onSearch, onUnfilter, onParams };
  if (view === "salaries") return <Salaries {...shared} />;
  if (view === "transactions") return <Transactions {...shared} />;
  if (view === "refunds") return <Refunds {...shared} />;
  if (view === "analytics") return <Analytics {...shared} />;
  return <Subscriptions {...shared} />;
}
