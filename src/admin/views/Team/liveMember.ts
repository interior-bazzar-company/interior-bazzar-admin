/* =============================================================================
   The member page's reads (team/d2) — one request per module, never the seed.
   -----------------------------------------------------------------------------
   Every part carries its own state, because the server gates each module on
   its own: another member's attendance and leave are full access, their plans
   and reports are reports.acknowledge, their pay is finance-salaries.view. A
   refused read is a fact about the VIEWER ("not in your access"), not an empty
   record, so it is never folded into an empty list.

   "Today" and "now" are the server's clock (GET engine/server-time/), read in
   Asia/Kolkata — the same instant the server used for `delayed` and `state`.
   ============================================================================= */
import { useEffect, useState } from "react";
import AdminOpsService, { call } from "../../../api/modules/adminOps";
import type {
  AdminUserRow, AgreementRow, AttendanceDayRow, DailyPlanRow, DailyReportRow, IncentiveRow, LeaveRow,
  ResourceResponseRow, ResourceRow, SalaryAccountRow, WorkItemRow, WorkSettingsRow,
} from "../../../api/modules/adminOps";
import { AppExceptions, errMessage } from "../../../api/apiService";
import { addDays } from "./store";

export type Part<T> =
  | { state: "loading" }
  | { state: "ok"; data: T }
  | { state: "denied"; message: string }
  | { state: "error"; message: string };

export interface MemberReads {
  clock: Part<{ today: string; hhmm: string }>;
  settings: Part<WorkSettingsRow | null>;
  day: Part<AttendanceDayRow | null>;
  work: Part<WorkItemRow[]>;
  leave: Part<LeaveRow[]>;
  plan: Part<DailyPlanRow | null>;
  report: Part<DailyReportRow | null>;
  agreements: Part<AgreementRow[]>;
  resources: Part<{ resources: ResourceRow[]; responses: ResourceResponseRow[] }>;
  incentives: Part<IncentiveRow[]>;
  salary: Part<SalaryAccountRow | null>;
}

const LOADING = { state: "loading" } as const;
const ALL: MemberReads = {
  clock: LOADING, settings: LOADING, day: LOADING, work: LOADING, leave: LOADING, plan: LOADING, report: LOADING,
  agreements: LOADING, resources: LOADING, incentives: LOADING, salary: LOADING,
};

/** A read the server REFUSED (403, or a logical `response:false`) is denied; a
 *  5xx or a network failure is an error. */
function failed<T>(e: unknown): Part<T> {
  if (e instanceof AppExceptions && e.code > 0 && e.code < 500) return { state: "denied", message: e.message };
  return { state: "error", message: errMessage(e) };
}

/** The server's instant as an Asia/Kolkata business date and wall-clock time. */
export function istOf(iso: string): { today: string; hhmm: string } {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
  const hhmm = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return { today: date, hhmm };
}

export function useMemberReads(live: AdminUserRow | null): MemberReads {
  const [r, setR] = useState<MemberReads>(ALL);
  const id = live ? String(live.id) : "";

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setR(ALL);
    const put = <K extends keyof MemberReads>(k: K, v: MemberReads[K]) => {
      if (!cancelled) setR((cur) => ({ ...cur, [k]: v }));
    };
    const read = <K extends keyof MemberReads, T>(k: K, p: Promise<T>, pick: (t: T) => unknown) => {
      p.then((t) => put(k, { state: "ok", data: pick(t) } as MemberReads[K]))
        .catch((e) => put(k, failed(e) as MemberReads[K]));
    };

    call(AdminOpsService.serverTime()).then((t) => {
      const clock = istOf(t.serverNow);
      put("clock", { state: "ok", data: clock });
      const today = clock.today;
      read("day", call(AdminOpsService.attendanceDays({ member: id, start: today, end: today, includeMissing: "true" })),
        (x) => x.days[0] || null);
      read("plan", call(AdminOpsService.dailyPlans({ member: id, start: today, end: today })), (x) => x.plans[0] || null);
      read("report", call(AdminOpsService.dailyReports({ member: id, start: today, end: today })), (x) => x.reports[0] || null);
    }).catch((e) => {
      const f = failed(e);
      (["clock", "day", "plan", "report"] as const).forEach((k) => put(k, f as never));
    });

    read("settings", call(AdminOpsService.attendanceSettings()), (x) => x.settings.filter((s) => String(s.member.id) === id)[0] || null);
    read("work", call(AdminOpsService.work({ assignee: id, pageSize: 500 })), (x) => x.items);
    read("leave", call(AdminOpsService.leave({ member: id })), (x) => x.leave);
    read("agreements", call(AdminOpsService.agreements({ member: id })), (x) => x.agreements);
    read("resources", call(AdminOpsService.resources({ member: id })), (x) => ({ resources: x.resources, responses: x.responses || [] }));
    read("incentives", call(AdminOpsService.incentives({ member: id })), (x) => x.incentives);
    read("salary", call(AdminOpsService.salaryAccounts({ member: id })),
      (x) => x.accounts.filter((a) => a.isActive)[0] || x.accounts[0] || null);
    return () => { cancelled = true; };
  }, [id]);

  return r;
}

/* ------------------------------------------------ attendance page (d3) --- */

export const ATTENDANCE_WINDOW = 14;

/** A day row as the server sends it. Declared here, not in adminOps (held by
 *  another route): the row also carries its breaks, and `weekly_off` (an
 *  unopened Sunday) is a state the shared type does not list yet. */
export type LiveDay = Omit<AttendanceDayRow, "state"> & {
  state: { key: string; label: string; tone: string };
  breaks: { startedAt: string; endedAt: string | null; minutes: number | null }[];
};

/** The member's days, the days nobody opened included: the 14-day window and
 *  the month `today` sits in, in one request. */
export function useAttendanceDays(memberId: string, today: string): Part<LiveDay[]> {
  const [p, setP] = useState<Part<LiveDay[]>>(LOADING);

  useEffect(() => {
    if (!memberId || !today) return;
    let cancelled = false;
    setP(LOADING);
    const back = addDays(today, -(ATTENDANCE_WINDOW - 1));
    const first = today.slice(0, 8) + "01";
    call(AdminOpsService.attendanceDays({
      member: memberId, start: back < first ? back : first, end: today, includeMissing: "true", pageSize: 100,
    }))
      .then((x) => { if (!cancelled) setP({ state: "ok", data: x.days as unknown as LiveDay[] }); })
      .catch((e) => { if (!cancelled) setP(failed(e)); });
    return () => { cancelled = true; };
  }, [memberId, today]);

  return p;
}

/** Where today sits between two dates, 0–100 — elapsed, NOT progress. */
export function windowPct(startDate: string | null, dueDate: string | null, today: string): number | null {
  if (!startDate || !dueDate) return null;
  const a = new Date(startDate).getTime(), b = new Date(dueDate).getTime();
  if (b <= a) return 100;
  const t = new Date(today).getTime();
  return Math.max(0, Math.min(100, Math.round(((t - a) / (b - a)) * 100)));
}
