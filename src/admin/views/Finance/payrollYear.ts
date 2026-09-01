/* =============================================================================
   Finance — the payroll YEAR. Everything the Payroll analytics face reads.

   NAMED payrollYear.ts AND NOT payroll.ts, which is what it was for about ten
   minutes: `Payroll.tsx` sits beside it, and two files whose names differ only
   in the case of one letter are the same file on Windows and macOS and two
   different ones on Linux. TypeScript refuses the import outright, which is
   the good outcome — the bad one is a build that works on the developer's
   machine and not in CI.

   WHY THIS IS NOT IN store.ts. store.ts is the module's data seam: the one
   file that knows where records come from, and the one file that changes when
   the API lands. Nothing below knows that. Every derivation here is built on
   store.ts's PUBLIC readers — `readRuns()`, `readSalaryAccounts()`,
   `overview()` — so when the seed imports are swapped for `AdminOpsService`
   calls, this file is not touched and does not need to be read. Keeping it
   separate is what makes that true; folding it into a 2,200-line store would
   have buried twelve months of arithmetic inside the file somebody has to
   rewrite under time pressure.

   NO RECORDS ARE READ FROM JSON HERE, and none are written. This file derives
   and nothing else.

   ONE CLOCK, still. Every "has this month started" question below goes through
   `todayIso()`, which reads `asOf` from module.json. The browser clock is
   never consulted, so a screenshot taken next March still says August 2026.

   INTEGER PAISE everywhere, as in the rest of the module. The only divisions
   are averages and shares, and each one is named and rounded where it is
   taken.
   ============================================================================= */
import {
  PERIOD, fixedOf, incentiveOf, monthOf, readRuns, readSalaryAccounts, todayIso, useVersion,
} from "./store";

/* =========================================================== the year === */
/*  THE YEAR IS JANUARY TO DECEMBER.

    It was April to March for one build, on the argument that TDS, PF and the
    books all close on 31 March and a payroll total should line up with the
    return it is filed against. That argument still holds and this page no
    longer makes it: the calendar year is what was asked for, and the honest
    consequence is stated on the page rather than left for somebody to
    discover — a total taken from here will NOT match a filed return, because
    it spans a different twelve months.

    THE YEAR IS ALWAYS TWELVE MONTHS, including ones that have not happened.
    A month with no run renders as an empty column rather than being dropped,
    because a gap in payroll is a fact worth seeing — a run nobody opened looks
    exactly like a month nobody was paid, and a chart that silently omits it
    makes the two indistinguishable. `started` says which side of the clock a
    month is on, so a view can tell "not yet" from "missed". */

const MON_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `"2026-04"` → `"Apr"`. The chart axis has room for three letters and not
 *  for "April 2026", which is what `fmtMonth` gives and what is right
 *  everywhere else in the module. */
export const shortMonth = (m: string) => MON_SHORT[Number(m.slice(5, 7)) - 1] || m;

/** The calendar year a month falls in. `"2026-08"` → `"2026"`. */
export const yearOf = (month: string): string => month.slice(0, 4);

/** The twelve months of a calendar year, January first, December last. */
export const yearMonths = (year: string): string[] => {
  const out: string[] = [];
  for (let i = 1; i <= 12; i++) out.push(year + "-" + String(i).padStart(2, "0"));
  return out;
};

/** The label a year wears on screen. It is the bare year now — it used to be
 *  `FY 2026-27`, and a span written that way promises which twelve months are
 *  in it — a promise this page no longer keeps. */
export const yearLabel = (year: string) => year;

/** The year the module's own clock is in. Never the browser's. */
export const CURRENT_YEAR = yearOf(PERIOD.key);

/** Every year the payroll records actually touch, newest first. The current
 *  year is always offered even when no run has been opened in it — an empty
 *  current year is a state worth being able to look at. */
export function payrollYears(): string[] {
  const seen: Record<string, true> = {};
  readRuns().forEach((r) => { seen[yearOf(r.month)] = true; });
  seen[CURRENT_YEAR] = true;
  return Object.keys(seen).sort().reverse();
}

/** Guards a `?year=` taken off the URL. An unknown year falls back to the
 *  current one rather than rendering twelve empty columns nobody asked for. */
export const resolveYear = (raw: string | undefined): string =>
  (raw && payrollYears().indexOf(raw) >= 0 ? raw : CURRENT_YEAR);
/* ======================================================== the year read === */

/** One month of payroll.
 *
 *  PAID · UNPAID · HELD PARTITION THE MONTH'S NET EXACTLY. Every slip falls in
 *  one of the three and none falls in two, so the three stack to `netPaise`
 *  and a chart of them cannot double-count. That is the reason the yearly
 *  chart draws these three and not, say, salary against incentive: those two
 *  are a split of GROSS, and stacking a gross split on a net one produces a
 *  column whose height means nothing at all.
 *
 *  HELD IS NOT A KIND OF UNPAID. A held slip is money the company has decided
 *  not to pay yet, for a reason it wrote down; an unpaid one is money it
 *  simply has not paid. Folding them together reports a dispute as arrears. */
export interface PayrollMonth {
  month: string;
  label: string;
  /** Whether this month has begun, as at the module clock — which separates a
   *  month still to come from one that was skipped. */
  started: boolean;
  hasRun: boolean;
  headcount: number;
  /** Committed pay: Σ earnings, already pro-rated for any loss of pay. */
  fixedPaise: number;
  /** Earned pay: Σ incentives. Never pro-rated. */
  incentivePaise: number;
  grossPaise: number;
  deductionsPaise: number;
  netPaise: number;
  paidPaise: number;
  unpaidPaise: number;
  heldPaise: number;
}

export interface PayrollYear {
  year: string;
  months: PayrollMonth[];
  totals: {
    fixedPaise: number;
    incentivePaise: number;
    grossPaise: number;
    deductionsPaise: number;
    netPaise: number;
    paidPaise: number;
    unpaidPaise: number;
    heldPaise: number;
    /** Months that have a run at all — the denominator for anything "per
     *  month", because dividing by twelve in August reports a year that has
     *  not happened yet. */
    monthsRun: number;
    /** Distinct people on any slip in the year. NOT the headcount: somebody
     *  who left in June is in this figure and is not on the payroll now. */
    peopleEver: number;
    /** People on the last month that ran — the payroll as it currently is. */
    headcountNow: number;
    /** …and on the first, so growth across the year is a subtraction rather
     *  than something read off the shape of a chart. */
    headcountStart: number;
    /** Mean cost of one person for one month, over the months that ran. Null
     *  when nothing ran — an average of no months is not zero. */
    perHeadPaise: number | null;
  };
}

export function payrollYear(year: string): PayrollYear {
  const thisMonth = monthOf(todayIso());
  const runs = readRuns();

  const months: PayrollMonth[] = yearMonths(year).map((month) => {
    const run = runs.filter((r) => r.month === month)[0] || null;
    const slips = run ? run.slips : [];
    let fixed = 0, inc = 0, ded = 0, paid = 0, unpaid = 0, held = 0;
    slips.forEach((s) => {
      fixed += fixedOf(s);
      inc += incentiveOf(s);
      ded += s.deductionsPaise;
      if (s.paidAt) paid += s.netPaise;
      else if (s.held) held += s.netPaise;
      else unpaid += s.netPaise;
    });
    return {
      month,
      label: shortMonth(month),
      started: month <= thisMonth,
      hasRun: !!run,
      headcount: slips.length,
      fixedPaise: fixed,
      incentivePaise: inc,
      grossPaise: fixed + inc,
      deductionsPaise: ded,
      netPaise: fixed + inc - ded,
      paidPaise: paid,
      unpaidPaise: unpaid,
      heldPaise: held,
    };
  });

  const sum = (f: (m: PayrollMonth) => number) => months.reduce((n, m) => n + f(m), 0);
  const ran = months.filter((m) => m.hasRun);

  const people: Record<string, true> = {};
  ran.forEach((m) => {
    const run = runs.filter((r) => r.month === m.month)[0];
    if (run) run.slips.forEach((s) => { people[s.salaryAccountId] = true; });
  });

  return {
    year,
    months,
    totals: {
      fixedPaise: sum((m) => m.fixedPaise),
      incentivePaise: sum((m) => m.incentivePaise),
      grossPaise: sum((m) => m.grossPaise),
      deductionsPaise: sum((m) => m.deductionsPaise),
      netPaise: sum((m) => m.netPaise),
      paidPaise: sum((m) => m.paidPaise),
      unpaidPaise: sum((m) => m.unpaidPaise),
      heldPaise: sum((m) => m.heldPaise),
      monthsRun: ran.length,
      peopleEver: Object.keys(people).length,
      headcountNow: ran.length ? ran[ran.length - 1].headcount : 0,
      headcountStart: ran.length ? ran[0].headcount : 0,
      /* Averaged over the months that RAN, and over the headcount within each
         one — not the year's net over today's headcount, which would charge
         somebody who joined in March with a full year of cost. */
      perHeadPaise: ran.length
        ? Math.round(ran.reduce((n, m) => n + (m.headcount ? m.netPaise / m.headcount : 0), 0) / ran.length)
        : null,
    },
  };
}

/* ==================================================== by department ====== */

/** WHAT EACH PART OF THE COMPANY COST, over one calendar year.
 *
 *  This replaced an all-time `departmentSpend()`. All-time was the wrong
 *  window for the one thing the block exists to support — comparing
 *  departments — because it silently rewarded whoever had been on the payroll
 *  longest: a team hired in January looked cheap beside one hired two years
 *  ago, and the bars said so without saying why. A year is a window both
 *  departments are actually inside.
 *
 *  THE DEPARTMENT IS READ OFF THE ACCOUNT, not off the slip. It is identity
 *  like the PAN, not money, so somebody moved between departments carries
 *  their history with them rather than having it split across two bars.
 *  Blank groups as "Unassigned" — a visible gap somebody can go and fix,
 *  never a guess. */
export interface DepartmentYear {
  department: string;
  /** Net actually paid out: what left the bank for this department. */
  paidPaise: number;
  /** The variable half of it, so a department that earns its pay is visible
   *  as such rather than merely as expensive. */
  incentivePaise: number;
  fixedPaise: number;
  people: number;
  slips: number;
}

export function departmentYear(year: string): DepartmentYear[] {
  const want: Record<string, true> = {};
  yearMonths(year).forEach((m) => { want[m] = true; });
  const accounts = readSalaryAccounts();
  const by = new Map<string, {
    paidPaise: number; incentivePaise: number; fixedPaise: number;
    people: Record<string, true>; slips: number;
  }>();

  readRuns().forEach((run) => {
    if (!want[run.month]) return;
    run.slips.forEach((sl) => {
      /* PAID SLIPS ONLY. The question is what a department cost, and a slip
         nobody has paid is a commitment rather than a cost. The unpaid figure
         is on the year chart above, where it is labelled as what it is. */
      if (!sl.paidAt) return;
      const acc = accounts.filter((a) => a.salaryAccountId === sl.salaryAccountId)[0];
      const dep = (acc && (acc.department || "").trim()) || "Unassigned";
      const cur = by.get(dep) || {
        paidPaise: 0, incentivePaise: 0, fixedPaise: 0, people: {}, slips: 0,
      };
      cur.paidPaise += sl.netPaise;
      cur.incentivePaise += incentiveOf(sl);
      cur.fixedPaise += fixedOf(sl);
      cur.people[sl.salaryAccountId] = true;
      cur.slips += 1;
      by.set(dep, cur);
    });
  });

  return Array.from(by.entries())
    .map(([department, v]) => ({
      department,
      paidPaise: v.paidPaise,
      incentivePaise: v.incentivePaise,
      fixedPaise: v.fixedPaise,
      people: Object.keys(v.people).length,
      slips: v.slips,
    }))
    .sort((x, y) => y.paidPaise - x.paidPaise);
}

/* ====================================================== one person ======= */

/** ONE ROW PER PERSON FOR THE WHOLE YEAR — committed pay against what they
 *  earned on top, and nothing else.
 *
 *  This replaced a per-person month-by-month walk behind a picker, and a
 *  table of every slip under it. Both answered a question the record pages
 *  already answer better: a person's months are on their own salary account,
 *  one click away, beside the slip that produced each of them. What no other
 *  page can show is the whole team side by side — which is the only reason to
 *  put people on a chart at all.
 *
 *  PAID SLIPS ONLY, exactly like the department read, so the two agree by
 *  construction rather than by luck. */
export interface EmployeeTotal {
  salaryAccountId: string;
  name: string;
  /** First name plus an initial. A column chart's x-band has room for about
   *  twelve characters and "Anjali Deshpande" is sixteen — a label that will
   *  not fit must not be placed. The full name rides the tooltip. */
  shortName: string;
  department: string;
  fixedPaise: number;
  incentivePaise: number;
  grossPaise: number;
  slips: number;
  /** Null when nothing was paid: a share of nothing is not zero. */
  incentiveSharePct: number | null;
}

const shorten = (name: string): string => {
  const bits = name.trim().split(/\s+/);
  return bits.length < 2 ? name : bits[0] + " " + bits[bits.length - 1][0] + ".";
};

export function employeeTotals(year: string): EmployeeTotal[] {
  const want: Record<string, true> = {};
  yearMonths(year).forEach((m) => { want[m] = true; });
  const accounts = readSalaryAccounts();
  const by = new Map<string, EmployeeTotal>();

  readRuns().forEach((run) => {
    if (!want[run.month]) return;
    run.slips.forEach((sl) => {
      if (!sl.paidAt) return;
      const acc = accounts.filter((a) => a.salaryAccountId === sl.salaryAccountId)[0];
      const cur: EmployeeTotal = by.get(sl.salaryAccountId) || {
        salaryAccountId: sl.salaryAccountId,
        name: sl.memberName,
        shortName: shorten(sl.memberName),
        department: (acc && (acc.department || "").trim()) || "Unassigned",
        fixedPaise: 0, incentivePaise: 0, grossPaise: 0, slips: 0,
        incentiveSharePct: null,
      };
      cur.fixedPaise += fixedOf(sl);
      cur.incentivePaise += incentiveOf(sl);
      cur.grossPaise += sl.grossPaise;
      cur.slips += 1;
      by.set(sl.salaryAccountId, cur);
    });
  });

  return Array.from(by.values())
    .map((r) => ({
      ...r,
      incentiveSharePct: r.grossPaise > 0
        ? Math.round((r.incentivePaise / r.grossPaise) * 1000) / 10 : null,
    }))
    .sort((a, b) => b.grossPaise - a.grossPaise);
}

/* =============================================================== hooks === */
/*  On store.ts's OWN subscription, via the exported `useVersion`. A second
    subscription to the same snapshot is how a chart and the figure beside it
    end up one render apart — record a payment and only one of them moves.  */

export function usePayrollYears(): string[] { useVersion(); return payrollYears(); }
export function usePayrollYear(year: string): PayrollYear { useVersion(); return payrollYear(year); }
export function useDepartmentYear(year: string): DepartmentYear[] { useVersion(); return departmentYear(year); }
export function useEmployeeTotals(year: string): EmployeeTotal[] { useVersion(); return employeeTotals(year); }

/* ==================================================== who is on it ====== */

/** THE PAYROLL AS IT STANDS RIGHT NOW, not as the runs describe it.
 *
 *  Every other figure on this page is derived from SLIPS, which means none of
 *  them moves when somebody opens a salary account: an account with no run
 *  behind it yet has issued no slip, so the year's cost, its incentives and
 *  its arrears are all still correct and all still unchanged. That is right
 *  for money and wrong for feedback — somebody who has just added a person to
 *  the payroll looks at this page and sees nothing at all happen.
 *
 *  So this one counts ACCOUNTS. It moves in the same read as the write, and it
 *  is the only figure here that does. `monthlyPaise` is what the next run will
 *  cost if it were opened today — a commitment, not a cost, and the tile says
 *  so rather than letting it be added to anything. */
export interface PayrollHeadcount {
  /** Open salary accounts. A closed one keeps its slips and is not a person
   *  being paid. */
  active: number;
  /** Accounts whose joining date falls inside the year on screen. */
  openedInYear: number;
  /** Σ monthly gross over the active accounts: what a run opened today costs
   *  before deductions. NOT part of the year's spend — nothing has happened. */
  monthlyPaise: number;
}

export function headcount(year: string): PayrollHeadcount {
  const accounts = readSalaryAccounts();
  const open = accounts.filter((a) => a.active);
  return {
    active: open.length,
    openedInYear: accounts.filter((a) => (a.joinedAt || "").slice(0, 4) === year).length,
    monthlyPaise: open.reduce((n, a) => n + a.monthlyGrossPaise, 0),
  };
}

export function useHeadcount(year: string): PayrollHeadcount { useVersion(); return headcount(year); }
