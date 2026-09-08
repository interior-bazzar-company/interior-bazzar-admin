/* =============================================================================
   Overview — the hooks. Where the four sources meet, and nothing else.
   -----------------------------------------------------------------------------
   ONE FETCH PER SOURCE, AND THREE OF THE FOUR ARE NOT FETCHES AT ALL. Deals
   comes from `useDealsApi` — the same hook the Deals module mounts, one list
   read at pageSize 500, with the API's own loading / forbidden / error states.
   Enquiries is two integer reads the topbar already makes. Finance and Team
   are module-level snapshots read synchronously; subscribing here costs one
   listener on a counter the modules already keep, so an edit made on
   #/work or #/finance re-renders this page without a request.

   NOTHING IS CACHED HERE EITHER. The derivations in derive.ts are memoised on
   the inputs they read, and the inputs are the modules' own version counters,
   so a stale figure is not possible: if a store changed, its counter moved.

   `useOverview` is the one thing the page calls. It returns the data grouped
   by source, each with the clock it ran on, and never invents a value — a
   source that has not answered is `null`, and the section says so.
   ============================================================================= */
import { useEffect, useMemo } from "react";
import { useDealsApi, render as refetchDeals } from "../Deals/useDeals";
import type { DealsApiState } from "../Deals/useDeals";
import { fmtDate as finFmtDate, todayIso as finToday, useVersion as useFinVersion } from "../Finance/store";
import { TODAY as teamToday, fmtDate as teamFmtDate, useVersion as useTeamVersion } from "../Team/store";
import { ensureAdopted } from "../Team/adopt";
import { useIntakeCounts } from "../BusinessEnquiries/store";
import { can } from "../../auth/session";
import { getSession } from "../../auth/session";
import { fmtDate } from "../../ui/format";
import {
  attentionItems, dealMetrics, financeMetrics, healthOf, payrollMetrics, periodFor, planningSignals,
  teamMetrics, todayLocal,
} from "./derive";
import type {
  AttentionItem, DealMetrics, DealRec, FinanceMetrics, HealthCell, OwnerStat, Payroll, Period, Signal,
  TeamMetrics,
} from "./derive";

export type Params = Record<string, string | undefined>;

/** Which module each section reads, so a section is shown exactly when its
 *  source is in the session's access. `overview` itself is proto-gated (every
 *  signed-in member can open the page); what is ON it is gated per source. */
export const GATES = {
  deals: () => can("deals"),
  finance: () => can("finance"),
  payroll: () => can("finance-salaries"),
  team: () => can("work") && can("attendance"),
  enquiries: () => can("business-enquiries"),
};

/** A source's clock, printed beside its section: "live · 8 Sep 2026" or
 *  "seed · as of 25 Aug 2026". Every section stamps one, because the same
 *  period lands on different dates in each — see derive.ts. */
export interface Clock { kind: "live" | "seed"; today: string; label: string }
export function clocks(): { deals: Clock; finance: Clock; team: Clock } {
  const real = todayLocal();
  return {
    deals: { kind: "live", today: real, label: "live · " + fmtDate(real) },
    finance: { kind: "seed", today: finToday(), label: "seed · as of " + finFmtDate(finToday()) },
    team: { kind: "seed", today: teamToday, label: "seed · as of " + teamFmtDate(teamToday) },
  };
}

export interface OverviewData {
  gates: { deals: boolean; finance: boolean; payroll: boolean; team: boolean; enquiries: boolean };
  api: DealsApiState;
  clocks: ReturnType<typeof clocks>;
  periods: { deals: Period; finance: Period; team: Period };
  deals: DealMetrics | null;
  fin: FinanceMetrics | null;
  pay: Payroll | null;
  team: TeamMetrics | null;
  intake: { today: number; week: number } | null;
  health: HealthCell[];
  attention: AttentionItem[];
  signals: Signal[];
  retryDeals: () => void;
  ownerOptions: { v: string; l: string }[];
  departments: string[];
  isFullAccess: boolean;
}

export function useOverview(p: Params): OverviewData {
  const gates = { deals: GATES.deals(), finance: GATES.finance(), payroll: GATES.payroll(), team: GATES.team(), enquiries: GATES.enquiries() };
  /* The owner filter is a server parameter, so changing it is a refetch — the
     same one the Deals module makes for its own Owner chip. */
  const api = useDealsApi(p.owner ? { owner: p.owner } : {});
  const finVersion = useFinVersion();
  const teamVersion = useTeamVersion();
  const intake = useIntakeCounts();
  useEffect(() => { if (gates.team) ensureAdopted(); }, [gates.team]);

  const ck = useMemo(clocks, []);
  const periods = useMemo(() => ({
    deals: periodFor(p.period, ck.deals.today, p.from, p.to),
    finance: periodFor(p.period, ck.finance.today, p.from, p.to),
    team: periodFor(p.period, ck.team.today, p.from, p.to),
  }), [p.period, p.from, p.to, ck]);

  const dealsReady = gates.deals && !api.loading && !api.error && !api.forbidden;
  const deals = useMemo(
    () => (dealsReady ? dealMetrics(api.list as DealRec[], periods.deals, ck.deals.today) : null),
    [dealsReady, api.list, periods.deals, ck]);

  const fin = useMemo(
    () => (gates.finance ? financeMetrics(periods.finance, ck.finance.today) : null),
    [gates.finance, periods.finance, ck, finVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const pay = useMemo(
    () => (gates.payroll ? payrollMetrics() : null),
    [gates.payroll, finVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Deal owner → team member. The API names the owner and gives the id on the
     owners vocabulary; the Team store keys a member by the same id once the
     roster is adopted, and by name before it. Both keys go in the map. */
  const owners = useMemo(() => {
    const m = new Map<string, OwnerStat>();
    if (!deals) return m;
    deals.byOwner.forEach((o) => {
      const stat = { open: o.open, won: o.won, value: o.value, collected: o.collected };
      m.set(o.name, stat);
      const ref = api.owners.find((x) => x.name === o.name);
      if (ref) m.set(String(ref.id), stat);
    });
    return m;
  }, [deals, api.owners]);

  const team = useMemo(
    () => (gates.team ? teamMetrics(periods.team, ck.team.today, p.dept || undefined, owners) : null),
    [gates.team, periods.team, ck, p.dept, owners, teamVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const health = useMemo(() => healthOf(deals, fin, team), [deals, fin, team]);
  const attention = useMemo(() => attentionItems(deals, fin, pay, team, ck.team.today), [deals, fin, pay, team, ck]);
  const signals = useMemo(() => planningSignals(deals, fin, pay, team, ck.deals.today), [deals, fin, pay, team, ck]);

  const s = getSession();
  return {
    gates, api, clocks: ck, periods, deals, fin, pay, team,
    intake: gates.enquiries ? intake : null,
    health, attention, signals,
    retryDeals: refetchDeals,
    ownerOptions: api.owners.map((o) => ({ v: String(o.id), l: o.name })),
    departments: team ? team.departments : [],
    isFullAccess: !!(s && s.isFullAccess),
  };
}
