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
import { useEffect, useMemo, useState } from "react";
import AdminOpsService, { call } from "../../../api/modules/adminOps";
import type { AdminUserRow } from "../../../api/modules/adminOps";
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
  attentionItems, dealMetrics, financeMetrics, payrollMetrics, periodFor, planningSignals,
  teamMetrics, todayLocal,
} from "./derive";
import { liveHealth, liveMoney, liveTeam, liveTeamRows, useLive } from "./live";
import type { LiveMoney, LiveState, LiveTeamTable } from "./live";
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
  /* The Team table also reads the roster (`GET /admin/users/`, team.view), so
     a session without it would render the section and fail the fetch (d4). */
  team: () => can("work") && can("attendance") && can("team"),
  enquiries: () => can("business-enquiries"),
};

/** A source's clock, printed beside its section: "live · 8 Sep 2026" or
 *  "seed · as of 25 Aug 2026". Every section stamps one, because the same
 *  period lands on different dates in each — see derive.ts. */
export interface Clock { kind: "live" | "seed"; today: string; label: string }
export function clocks(): { deals: Clock; finance: Clock; team: Clock; teamLive: Clock; money: Clock } {
  const real = todayLocal();
  return {
    deals: { kind: "live", today: real, label: "live · " + fmtDate(real) },
    /* The Team TABLE reads the backend (d4) and runs on the real clock. The
       seed `team` clock below stays for the sections still on the seeds —
       Operations, the attention list, the planning signals. */
    teamLive: { kind: "live", today: real, label: "live · " + fmtDate(real) },
    /* The executive snapshot's money and health (live.ts) run on the real
       clock; `finance` stays the seed clock for the sections still on seeds. */
    money: { kind: "live", today: real, label: "live · " + fmtDate(real) },
    finance: { kind: "seed", today: finToday(), label: "seed · as of " + finFmtDate(finToday()) },
    team: { kind: "seed", today: teamToday, label: "seed · as of " + teamFmtDate(teamToday) },
  };
}

/* ================================================== department = role ===
   THE BACKEND HAS NO DEPARTMENT, and it is not getting one. The Department
   filter lists the admin ROLES instead: every role from `GET /admin/roles/`,
   unfiltered, sorted by name. A member is "in" a role when their account holds
   it (`GET /admin/users/` roles[]), so the filter below matches on that and a
   member with two roles appears under both.

   `content/team/members.json` still seeds the Team store, but nothing on this
   control reads its `department` field any more.

   `state` drives the control's own loading / error / empty drawing:
   `off` when the Team section is not in this session's access (the control
   never showed there), then `loading` -> `ready` or `error`. */
export type DeptState = "off" | "loading" | "ready" | "error";
interface Departments {
  names: string[]; rolesOf: Map<string, string[]>;
  /** The roster itself, kept rather than thrown away: the Team table is one
   *  row per active account (d4), and this is the same read. */
  people: AdminUserRow[];
  state: DeptState;
}
const NO_ROLES = new Map<string, string[]>();
const NO_PEOPLE: AdminUserRow[] = [];

function useDepartments(enabled: boolean): Departments {
  const [d, setD] = useState<Departments>({
    names: [], rolesOf: NO_ROLES, people: NO_PEOPLE, state: enabled ? "loading" : "off" });
  useEffect(() => {
    if (!enabled) { setD({ names: [], rolesOf: NO_ROLES, people: NO_PEOPLE, state: "off" }); return; }
    let live = true;
    setD((x) => ({ ...x, state: "loading" }));
    Promise.all([call(AdminOpsService.listRoles()), call(AdminOpsService.users())])
      .then(([roles, users]) => {
        if (!live) return;
        const rolesOf = new Map<string, string[]>();
        users.forEach((u) => rolesOf.set(String(u.id), (u.roles || []).map((r) => r.name)));
        const names = roles.roles.map((r) => r.name).sort((a, b) => a.localeCompare(b));
        setD({ names, rolesOf, people: users, state: "ready" });
      })
      /* A refusal (no roles.view) and a failed request land here alike: no
         options, and the control says it could not load rather than showing
         seed departments in their place. */
      .catch(() => { if (live) setD({ names: [], rolesOf: NO_ROLES, people: NO_PEOPLE, state: "error" }); });
    return () => { live = false; };
  }, [enabled]);
  return d;
}

export interface OverviewData {
  gates: { deals: boolean; finance: boolean; payroll: boolean; team: boolean; enquiries: boolean };
  api: DealsApiState;
  clocks: ReturnType<typeof clocks>;
  periods: { deals: Period; finance: Period; team: Period; teamLive: Period; money: Period };
  deals: DealMetrics | null;
  fin: FinanceMetrics | null;
  /** Collected + Receivable for the executive snapshot, from the backend
   *  (live.ts). null until `moneyState` is ready. */
  money: LiveMoney | null;
  moneyState: LiveState;
  retryLive: () => void;
  pay: Payroll | null;
  /** The seed metrics, still read by Operations, the attention list and the
   *  signals. The Team TABLE reads `teamTable` below (d4). */
  team: TeamMetrics | null;
  teamTable: LiveTeamTable | null;
  teamState: LiveState;
  intake: { today: number; week: number } | null;
  health: HealthCell[];
  attention: AttentionItem[];
  signals: Signal[];
  retryDeals: () => void;
  ownerOptions: { v: string; l: string }[];
  departments: string[];
  /** Loading / error / empty for the Department control. */
  departmentsState: DeptState;
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
  const dept = useDepartments(gates.team);
  useEffect(() => { if (gates.team) ensureAdopted(); }, [gates.team]);

  const ck = useMemo(clocks, []);
  const periods = useMemo(() => ({
    deals: periodFor(p.period, ck.deals.today, p.from, p.to),
    finance: periodFor(p.period, ck.finance.today, p.from, p.to),
    team: periodFor(p.period, ck.team.today, p.from, p.to),
    teamLive: periodFor(p.period, ck.teamLive.today, p.from, p.to),
    money: periodFor(p.period, ck.money.today, p.from, p.to),
  }), [p.period, p.from, p.to, ck]);
  const live = useLive(periods.money, { money: gates.finance, team: gates.team });

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
    () => (gates.team ? teamMetrics(periods.team, ck.team.today, p.dept || undefined, owners, dept.rolesOf) : null),
    [gates.team, periods.team, ck, p.dept, owners, dept.rolesOf, teamVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const money = useMemo(
    () => (live.money === "ready" ? liveMoney(live.raw, periods.money) : null),
    [live.money, live.raw, periods.money]);
  const teamLive = useMemo(
    () => (live.team === "ready" ? liveTeam(live.raw, p.dept || undefined, dept.rolesOf) : null),
    [live.team, live.raw, p.dept, dept.rolesOf]);
  const teamTable = useMemo(
    () => (live.team === "ready" && dept.state === "ready"
      ? liveTeamRows(live.raw, dept.people, p.dept || undefined, dept.rolesOf, owners, ck.teamLive.today)
      : null),
    [live.team, live.raw, dept.state, dept.people, p.dept, dept.rolesOf, owners, ck]);
  const health = useMemo(
    () => liveHealth(deals, money, live.money, teamLive, live.team),
    [deals, money, live.money, teamLive, live.team]);
  const attention = useMemo(() => attentionItems(deals, fin, pay, team, ck.team.today), [deals, fin, pay, team, ck]);
  const signals = useMemo(() => planningSignals(deals, fin, pay, team, ck.deals.today), [deals, fin, pay, team, ck]);

  const s = getSession();
  return {
    gates, api, clocks: ck, periods, deals, fin, pay, team,
    teamTable,
    /* The table needs BOTH reads: the roster (roles + users) and the period's
       attendance and tasks. Whichever is still answering decides the state. */
    teamState: dept.state === "error" ? "error" : dept.state === "loading" ? "loading" : live.team,
    money, moneyState: live.money, retryLive: live.retry,
    intake: gates.enquiries ? intake : null,
    health, attention, signals,
    retryDeals: refetchDeals,
    ownerOptions: api.owners.map((o) => ({ v: String(o.id), l: o.name })),
    departments: dept.names,
    departmentsState: dept.state,
    isFullAccess: !!(s && s.isFullAccess),
  };
}
