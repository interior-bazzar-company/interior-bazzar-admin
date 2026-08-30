/* =============================================================================
   Finance · Salaries A/C — the list face.
   -----------------------------------------------------------------------------
   Three things live on this screen and the order is the order somebody works
   in: the RUN that is open right now and needs finishing, the PEOPLE it pays,
   and the RUNS behind it.

   A salary account belongs to Finance. The person belongs to Team, and the two
   are joined on `memberId` — the name here is a copy for the slip, and the
   link into `#/team/<memberId>` is the live record. This module never invents
   a member.

   The money on this face is NET PAID TO PEOPLE. Employer PF, gratuity accrual
   and insurance are not modelled at all, so nothing here is cost to company —
   FN-OD-06, said in the UI rather than in a comment, because a payroll figure
   that quietly means two things is how a hiring plan goes wrong.
   ============================================================================= */
import { useShell } from "../../shell/ShellContext";
import { can } from "../../shell/AdminShell";
import { EmptyState, FilterChips, Icon, SearchField, Select, avatarTone, initials } from "../../ui";
import { go } from "../../ui/nav";
import { Frame, Block } from "./Frame";
import type { FaceProps } from "./Frame";
import { Assumed, Money, RunPill } from "./bits";
import { MetricTip } from "./InfoTip";
import { OpenRunModal, LopModal, PayRunModal, SalaryAccountModal } from "./SalaryModals";
import {
  FILTER_LABELS, PERIOD, ago, applySalaryFilters, filterValueLabel, fmtDate, fmtMonth, inr,
  isSuperAdmin, superAdminOnly, useOverview, useRuns, useSalaryRows,
} from "./store";
import type { Params, Payslip, SalaryRow, SalaryRun } from "./store";

/* THE WHOLE LIST STATE TRAVELS WITH THE LINK, so the record's Back button is a
   return and not a reset. `run` is a panel on this face and does not belong on
   a record address. */
function recHash(id: string, p: Params): string {
  const q = Object.keys(p)
    .filter((k) => p[k] && ["run", "tab"].indexOf(k) < 0)
    .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(p[k] as string))
    .join("&");
  return "#/finance-salaries/" + encodeURIComponent(id) + (q ? "?" + q : "");
}

/** Initials on a tint, the same face the Team module draws. Not `Avatar` from
 *  teamShared: that takes an `AdminUserRow`, and there is no live member here
 *  to hand it — a fabricated one would be a Team record this module invented. */
function Face({ name }: { name: string }) {
  return <span className={"av sm " + avatarTone(name)}>{initials(name)}</span>;
}

export default function Salaries({ p, onFilter, onSearch, onUnfilter, onParams }: FaceProps) {
  const { toast, modal, closeLayer } = useShell();
  const rows = useSalaryRows();
  const runs = useRuns();
  const o = useOverview();

  const active = rows.filter((r) => r.a.active);
  /* Monthly payroll is what the ACTIVE accounts come to today — a forward
     figure, and deliberately not the same number as the last run, which is
     history and includes anyone who has since left. */
  const payrollPaise = active.reduce((n, r) => n + r.monthlyNetPaise, 0);
  const open = runs.filter((r) => r.state === "open")[0] || null;
  const lastPaid = runs.filter((r) => r.state === "paid")[0] || null;

  const filtered = applySalaryFilters(rows, p);
  const narrowed = ["q", "active"].some((k) => p[k]);
  const writable = can("finance-salaries", "edit");
  const selected = p.run ? runs.filter((r) => r.runId === p.run)[0] || null : null;

  const done = (msg: string, tone?: string) => { closeLayer(); toast(msg, tone); };
  /* Opening only. REVISING happens on the account's own record, where the
     figures being changed are on screen behind the dialog — a raise typed from
     a list is a raise typed without looking at what it replaces. */
  const openAccount = () => modal(
    <SalaryAccountModal onClose={closeLayer} onDone={done} />, "wide");
  const openRunModal = () => modal(<OpenRunModal onClose={closeLayer} onDone={done} />, "wide");
  const payRun = (run: SalaryRun) => modal(
    <PayRunModal run={run} onClose={closeLayer} onDone={done} />, "wide");
  const setLopOn = (slip: Payslip) => modal(
    <LopModal slip={slip} onClose={closeLayer} onDone={done} />);

  return (
    <Frame toast={toast}
      cmd={<>
        {/* KEYED ON THEIR VALUE. SearchField and Select are uncontrolled, so
            clearing a chip otherwise leaves the old text in the box. */}
        <SearchField key={"q" + (p.q || "")} ph="Name, employee code, designation…"
          val={p.q} onFilter={onSearch} />
        <Select key={"active" + (p.active || "")} name="active" label="Account" value={p.active}
          onFilter={onFilter} options={[{ v: "yes", l: "Active" }, { v: "no", l: "Closed" }]} />
        <span className="spacer" />
        {open ? (
          <button className="btn sm" title={"A run for " + fmtMonth(open.month) + " is already open. Pay it before opening another."}
            disabled>
            <Icon name="plus" size="sm" />Open a run
          </button>
        ) : (
          <button className="btn sm" disabled={!writable} onClick={openRunModal}
            title={writable ? undefined : "Opening a salary run needs Finance edit rights."}>
            <Icon name="plus" size="sm" />Open a run
          </button>
        )}
        <button className="btn sm pri" disabled={!writable} onClick={() => openAccount()}
          title={writable ? undefined : "Opening a salary account needs Finance edit rights."}>
          <Icon name="plus" size="sm" />Add a salary account
        </button>
      </>}
      bands={<>
        <div className="fin-money-strip">
          <div className="fin-mt">
            <span className="k">Monthly payroll<MetricTip k="salary_cost" /></span>
            <span className="v">{inr(payrollPaise)}</span>
            <span className="s">net to {active.length} {active.length === 1 ? "person" : "people"}, every month</span>
          </div>
          <div className="fin-mt">
            <span className="k">On the payroll</span>
            <span className="v tnum">{active.length}</span>
            <span className="s">{rows.length - active.length
              ? rows.length - active.length + " closed account" + (rows.length - active.length === 1 ? "" : "s") + " kept for their slips"
              : "no closed accounts"}</span>
          </div>
          <div className={"fin-mt" + (lastPaid ? " ok" : " mute")}>
            <span className="k">Last run paid</span>
            <span className="v">{lastPaid ? inr(lastPaid.totalNetPaise) : "—"}</span>
            <span className="s">{lastPaid
              ? fmtMonth(lastPaid.month) + " · " + lastPaid.slips.length + " slips · paid " + ago(lastPaid.paidAt)
              : "no run has been paid yet"}</span>
          </div>
          <div className={"fin-mt" + (open ? " warn" : " mute")}>
            <span className="k">Open run</span>
            <span className="v">{open ? inr(open.totalNetPaise) : "—"}</span>
            <span className="s">{open
              ? fmtMonth(open.month) + " · " + open.slips.length + " slips · nobody paid yet"
              : "no run is open"}</span>
          </div>
        </div>
        <div className="dls-chips">
          <FilterChips
            params={Object.keys(p)
              .filter((k) => ["view", "run", "tab"].indexOf(k) < 0 && p[k])
              .reduce((acc, k) => { acc[k] = filterValueLabel(k, p[k] as string); return acc; },
                {} as Record<string, string>)}
            labels={FILTER_LABELS}
            onUnfilter={onUnfilter} />
        </div>
      </>}>

      {/* ============================================== what this money is === */}
      <p className="fin-fine">
        Payroll here is <b>net paid to people</b>. Analytics counts {inr(o.salaryPaise)} of salary
        in {PERIOD.label}{o.salaryN ? " across " + o.salaryN + " slips on runs paid inside it" : ""} —
        an open run is not in that figure until the transfers are made.
      </p>
      <Assumed id="FN-OD-06" />

      {/* ==================================================== the open run === */}
      {open ? (
        <div className="fin-cards">
          <Block
            title={<>{open.runId} · {fmtMonth(open.month)}</>}
            desc={<>Opened {ago(open.recordedAt)} by {open.recordedBy}. Nobody has been paid, nothing is numbered and nothing is hashed.</>}
            right={<RunPill k="open" lg />}
            foot={<div className="fin-actions">
              <button className="btn pri" disabled={!writable || !isSuperAdmin()}
                title={!writable ? "Paying a salary run needs Finance edit rights."
                  : superAdminOnly("Paying a salary run") || undefined}
                onClick={() => payRun(open)}>
                <Icon name="cash" size="sm" />Mark the run paid
              </button>
              <span className="spacer" />
              <span className="fin-sum">{open.slips.length} slip{open.slips.length === 1 ? "" : "s"} · <b>{inr(open.totalNetPaise)}</b> net</span>
            </div>}>

            <p className="fin-fine">
              Every slip below is a draft. Loss of pay is the one figure that can still be changed;
              the amounts freeze the moment the run is paid, and each slip takes its number and its
              hash in that same write.
            </p>

            <table className="tbl fin-stbl">
              <thead>
                <tr>
                  <th>Person</th>
                  <th className="num">Paid days</th>
                  <th className="num">Gross</th>
                  <th className="num">Deductions</th>
                  <th className="num">Net</th>
                  <th className="tight" />
                </tr>
              </thead>
              <tbody>
                {open.slips.map((s) => (
                  <SlipRow key={s.slipId} s={s} p={p} onLop={writable ? setLopOn : null} />
                ))}
              </tbody>
            </table>
          </Block>
        </div>
      ) : null}

      {/* ====================================================== the people === */}
      <div className="sh">
        <h2>The people</h2>
        <span className="d">One account per team member, joined to the live Team record. A closed account stays on this list because its slips do.</span>
        <span className="r fin-count">{filtered.length} of {rows.length}</span>
      </div>

      {filtered.length ? (
        <table className="tbl dls-tbl fin-tbl">
          <thead>
            <tr>
              <th className="rail" />
              <th>Person</th>
              <th>Designation</th>
              <th className="num">Monthly gross</th>
              <th className="num">Deductions</th>
              <th className="num">Net</th>
              <th>Last paid</th>
              <th>Account</th>
              <th className="tight" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => <PersonRow key={r.a.salaryAccountId} r={r} p={p} />)}
          </tbody>
        </table>
      ) : (
        <EmptyState icon={narrowed ? "search" : "team"}
          title={narrowed ? "Nobody matches those filters" : "No salary account has been opened"}
          body={narrowed
            ? "The figures in the strip above are for the whole payroll, before any filter."
            : "A salary account attaches a monthly figure to a team member and issues them a numbered slip every month. Nothing is derived from a role: a salary is a contract with a person."}
          action={narrowed
            ? <button className="btn" onClick={() => onUnfilter("*")}>Clear the filters</button>
            : writable ? <button className="btn pri" onClick={() => openAccount()}>Add a salary account</button> : null} />
      )}

      {/* ======================================================== the runs === */}
      <div className="sh">
        <h2>Runs</h2>
        <span className="d">One a month, newest first. A run is opened, adjusted, then paid once — there is no approval step, because paying salaries is not a claim anybody verifies afterwards.</span>
      </div>

      {runs.length ? (
        <table className="tbl dls-tbl fin-tbl">
          <thead>
            <tr>
              <th>Month</th>
              <th>State</th>
              <th className="num">Slips</th>
              <th className="num">Total net</th>
              <th>Paid</th>
              <th>Reference</th>
              <th className="tight" />
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => {
              const on = p.run === r.runId;
              return (
                <tr key={r.runId} className={"clickable" + (on ? " on" : "")} tabIndex={0} role="button"
                  aria-expanded={on} aria-label={(on ? "Close " : "Open ") + r.runId}
                  onClick={() => onParams({ run: on ? undefined : r.runId })}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onParams({ run: on ? undefined : r.runId }); } }}>
                  <td>
                    <div className="cell-1">{fmtMonth(r.month)}</div>
                    <div className="cell-2 mono">{r.runId}</div>
                  </td>
                  <td><RunPill k={r.state} /></td>
                  <td className="num tnum">{r.slips.length}</td>
                  <td className="num"><Money paise={r.totalNetPaise} strong /></td>
                  <td>
                    {r.paidAt
                      ? <><div className="cell-1">{fmtDate(r.paidAt)}</div><div className="cell-2">{ago(r.paidAt)}</div></>
                      : <span className="faint">not yet</span>}
                  </td>
                  <td className="mono cell-2">{r.slips[0]?.reference ? r.slips[0].reference.replace(/-\d\d$/, "") : "—"}</td>
                  <td className="tight"><Icon name={on ? "chev" : "chevr"} size="sm" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <EmptyState icon="clock" title="No run has been opened"
          body="A run issues one slip per active account and freezes the figures on each. Until one is opened there is nothing to hand anybody." />
      )}

      {/* The run somebody picked, opened in place. The open run already has its
          own card at the top of the page, so it is not drawn twice. */}
      {selected && selected.state === "paid" ? (
        <div className="fin-cards">
          <Block
            title={<>{selected.runId} · {fmtMonth(selected.month)}</>}
            desc={<>Paid {fmtDate(selected.paidAt)} by {selected.recordedBy}. Every slip below is numbered, hashed and unchangeable.</>}
            right={<RunPill k="paid" lg />}
            foot={<div className="fin-actions">
              <button className="btn sm" onClick={() => onParams({ run: undefined })}>Close this run</button>
              <span className="spacer" />
              <span className="fin-sum">{selected.slips.length} slips · <b>{inr(selected.totalNetPaise)}</b> net</span>
            </div>}>
            <table className="tbl fin-stbl">
              <thead>
                <tr>
                  <th>Person</th>
                  <th className="num">Paid days</th>
                  <th className="num">Gross</th>
                  <th className="num">Deductions</th>
                  <th className="num">Net</th>
                  <th className="tight" />
                </tr>
              </thead>
              <tbody>
                {selected.slips.map((s) => <SlipRow key={s.slipId} s={s} p={p} onLop={null} />)}
              </tbody>
            </table>
          </Block>
        </div>
      ) : null}
    </Frame>
  );
}

/* -------------------------------------------------------------------------- */

function PersonRow({ r, p }: { r: SalaryRow; p: Params }) {
  const a = r.a;
  const ded = a.deductions.reduce((n, d) => n + d.amountPaise, 0);
  const to = recHash(a.salaryAccountId, p);
  /* The rail speaks once, and only about the run in front of somebody: this
     person has a draft slip waiting to be paid. A colour per account state
     would turn the table into a paint chart. */
  const rail = r.inOpenRun ? "warn" : "";
  return (
    <tr className={"clickable" + (a.active ? "" : " dim")} tabIndex={0} role="link"
      aria-label={"Open " + a.memberName + "'s salary account"}
      onClick={() => go(to)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(to); } }}>
      <td className="rail"><i className={rail} /></td>
      <td>
        <div className="fin-who">
          <Face name={a.memberName} />
          <span>
            <span className="cell-1">{a.memberName}</span>
            <span className="cell-2 mono">{a.employeeCode}</span>
          </span>
        </div>
      </td>
      <td>
        <div className="cell-1">{a.designation}</div>
        <div className="cell-2">joined {fmtDate(a.joinedAt)}</div>
      </td>
      <td className="num tnum">{inr(a.monthlyGrossPaise)}</td>
      <td className="num tnum">{ded ? "−" + inr(ded) : <span className="faint">none</span>}</td>
      <td className="num"><Money paise={r.monthlyNetPaise} strong /></td>
      <td>
        {r.lastPaidAt
          ? <><div className="cell-1">{fmtDate(r.lastPaidAt)}</div><div className="cell-2">{r.slipsN} slip{r.slipsN === 1 ? "" : "s"} on record</div></>
          : <span className="faint">never</span>}
      </td>
      <td>
        {a.active
          ? <span className="pill ok" title="On the payroll. The next run opened issues them a slip.">Active</span>
          : <span className="pill" title="Closed. No run picks this account up again; the slips it already carries stay where they are.">Closed</span>}
      </td>
      <td className="tight"><Icon name="chevr" size="sm" /></td>
    </tr>
  );
}

function SlipRow({ s, p, onLop }: { s: Payslip; p: Params; onLop: ((s: Payslip) => void) | null }) {
  const to = recHash(s.slipId, p);
  return (
    <tr className="clickable" tabIndex={0} role="link" aria-label={"Open " + s.memberName + "'s slip"}
      onClick={() => go(to)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(to); } }}>
      <td>
        <div className="fin-who">
          <Face name={s.memberName} />
          <span>
            <span className="cell-1">{s.memberName}</span>
            <span className="cell-2">{s.designation}</span>
          </span>
        </div>
      </td>
      <td className="num">
        <span className="tnum">{s.paidDays}</span>
        {s.lopDays ? <div className="cell-2">{s.lopDays} day{s.lopDays === 1 ? "" : "s"} loss of pay</div> : null}
      </td>
      <td className="num tnum">{inr(s.grossPaise)}</td>
      <td className="num tnum">{s.deductionsPaise ? "−" + inr(s.deductionsPaise) : <span className="faint">none</span>}</td>
      <td className="num"><Money paise={s.netPaise} strong /></td>
      <td className="tight" onClick={(e) => e.stopPropagation()}>
        {onLop
          ? <button className="btn sm" onClick={() => onLop(s)}>Loss of pay</button>
          : <Icon name="chevr" size="sm" />}
      </td>
    </tr>
  );
}
