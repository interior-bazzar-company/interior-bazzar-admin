/* =============================================================================
   Finance · Salaries A/C — the list face.
   -----------------------------------------------------------------------------
   ONE TABLE. It carried three — the open run's slips, the people, and the runs
   behind them — which is three answers to one question and three places to look
   for a person's name. What somebody actually does here is pay people, so the
   face is the people, and what each of them is owed right now.

   THE RUN IS NOT GONE, IT IS NO LONGER SOMETHING YOU PRESS. Slips still belong
   to a monthly run and still freeze when they are paid; the run simply closes
   itself once its last slip is paid, rather than being marked paid by hand.
   The vocabulary left the screen because the unit of work is a person.

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
import { EmptyState, FilterChips, Icon, SearchField, Select, StatStrip, avatarTone, initials } from "../../ui";
import type { StatCell } from "../../ui";
import { go } from "../../ui/nav";
import { Frame, SubTabs } from "./Frame";
import type { FaceProps } from "./Frame";
import SalaryTransactions from "./SalaryTransactions";
import { Money } from "./bits";
import { MetricTip } from "./InfoTip";
import { PaySalaryModal, SalaryAccountModal } from "./SalaryModals";
import {
  ENGAGEMENTS, FILTER_LABELS, applySalaryFilters, dueOf, engagementMeta,
  filterValueLabel, fmtDate, fmtMonth, inr, isSuperAdmin, superAdminOnly,
  useRuns, useSalaryRows,
} from "./store";
import type { Params, SalaryRow } from "./store";

/* THE WHOLE LIST STATE TRAVELS WITH THE LINK, so the record's Back button is a
   return and not a reset. */
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

  const active = rows.filter((r) => r.a.active);
  /* Monthly payroll is what the ACTIVE accounts come to today — a forward
     figure, and deliberately not the same as what was last paid, which is
     history and includes anyone who has since left. */
  const payrollPaise = active.reduce((n, r) => n + r.monthlyNetPaise, 0);

  /* OWED RIGHT NOW, across everybody. Derived from the same `dueOf` every row
     in the table calls, so the tile and the rows cannot disagree about who is
     outstanding — the rule this module already applies to every other figure. */
  const dues = rows.map((r) => ({ r, d: dueOf(r) }));
  const owing = dues.filter((x) => x.d.pendingPaise > 0);
  const owedPaise = owing.reduce((n, x) => n + x.d.pendingPaise, 0);
  const inArrears = owing.filter((x) => x.d.arrears.length);

  const filtered = applySalaryFilters(rows, p);
  const narrowed = ["q", "active", "engagement", "due"].some((k) => p[k]);
  const writable = can("finance-salaries", "edit");
  /* Two readings of one payroll: the PEOPLE and what they are owed, or every
     SLIP and where it stands. The tab is a sub-switch, not a section — the
     money strip above belongs to both. */
  const tab = p.tab === "transactions" ? "transactions" : "accounts";
  const runs = useRuns();
  const slips = runs.flatMap((run) => run.slips);
  const heldN = slips.filter((x) => x.held && !x.paidAt).length;

  /* THE SAME STRIP LOGIC AS EVERY LIST IN THE PANEL: a stated Total, then its
     parts, each cell a filter. It clears or sets `status` and nothing else —
     the search is the scope somebody chose. */
  const txHash = (patch: Record<string, string | undefined>) => {
    const o: Record<string, string> = { tab: "transactions" };
    ["q", "status", "month"].forEach((k) => { if (p[k]) o[k] = p[k] as string; });
    Object.keys(patch).forEach((k) => {
      if (patch[k]) o[k] = patch[k] as string; else delete o[k];
    });
    return "#/finance-salaries?" + Object.keys(o)
      .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(o[k])).join("&");
  };
  const offStatus = (v: string) => (p.status === v ? undefined : v);
  /* THE ACCOUNTS STRIP — the same anatomy as every list in the panel: a
     stated Total, then its parts, each cell a filter. It replaces four tiles
     that said the same things at four times the height; the one figure the
     tiles carried that no cell can — the forward monthly payroll — rides at
     the end as a read-out, money in the strip the way Deals carries its own. */
  const accHash = (patch: Record<string, string | undefined>) => {
    const o: Record<string, string> = {};
    ["q", "engagement", "due", "active"].forEach((k) => { if (p[k]) o[k] = p[k] as string; });
    Object.keys(patch).forEach((k) => {
      if (patch[k]) o[k] = patch[k] as string; else delete o[k];
    });
    const q = Object.keys(o)
      .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(o[k])).join("&");
    return "#/finance-salaries" + (q ? "?" + q : "");
  };
  const offK = (k: string, v: string) => (p[k] === v ? undefined : v);
  const accCells: (StatCell | "sep")[] = [
    { k: "Total", v: rows.length, on: !p.active && !p.due,
      to: accHash({ active: undefined, due: undefined }),
      tip: <>Every salary account, open and closed. The cells beside it are its parts.</> },
    "sep",
    { k: "Active", v: active.length, dot: "ok", on: p.active === "yes",
      to: accHash({ active: offK("active", "yes"), due: undefined }),
      tip: <>On the payroll: the next run issues them a slip.</> },
    { k: "Closed", v: rows.length - active.length, on: p.active === "no",
      to: accHash({ active: offK("active", "no"), due: undefined }),
      tip: <>Kept for their slips. No run picks a closed account up again.</> },
    "sep",
    { k: "Unpaid", v: owing.length, dot: "warn", on: p.due === "unpaid",
      to: accHash({ due: offK("due", "unpaid"), active: undefined }),
      tip: <>Owed right now — {owedPaise ? inr(owedPaise) : "nothing"} across everybody, arrears included.</> },
    { k: "In arrears", v: inArrears.length, dot: "bad", on: p.due === "arrears",
      to: accHash({ due: offK("due", "arrears"), active: undefined }),
      tip: <>Owed for more than the current month. The debt that is ageing.</> },
    "sep",
    /* The caution is LOAD-BEARING (FN-OD-06): this is net paid to people,
       not cost to company, and the metric tip is where that stays said. */
    { k: <>Monthly payroll<MetricTip k="salary_cost" /></>, v: inr(payrollPaise), tone: "ro" },
  ];

  const txCells: (StatCell | "sep")[] = [
    { k: "Total", v: slips.length, on: !p.status, to: txHash({ status: undefined }),
      tip: <>Every slip ever issued, paid and unpaid alike. The cells beside it are its parts.</> },
    "sep",
    { k: "Paid", v: slips.filter((x) => x.paidAt).length, dot: "ok", on: p.status === "paid",
      to: txHash({ status: offStatus("paid") }),
      tip: <>Stamped, numbered and frozen. Nothing on a paid slip can change.</> },
    { k: "Unpaid", v: slips.filter((x) => !x.paidAt && !x.held).length, dot: "warn",
      on: p.status === "unpaid", to: txHash({ status: offStatus("unpaid") }),
      tip: <>Issued and owed. Paying a person clears every unpaid month they have, oldest first.</> },
    { k: "On hold", v: heldN, dot: "bad", on: p.status === "held",
      to: txHash({ status: offStatus("held") }),
      tip: <>Out of what is owed until somebody releases it. A hold is about a month, not a person.</> },
  ];

  const done = (msg: string, tone?: string) => { closeLayer(); toast(msg, tone); };
  /* Opening only. REVISING happens on the account's own record, where the
     figures being changed are on screen behind the dialog — a raise typed from
     a list is a raise typed without looking at what it replaces. */
  const openAccount = () => modal(<SalaryAccountModal onClose={closeLayer} onDone={done} />, "wide");
  const pay = (r: SalaryRow) => modal(<PaySalaryModal row={r} onClose={closeLayer} onDone={done} />, "wide");

  return (
    <Frame toast={toast}
      cmd={tab === "accounts" ? <>
        {/* KEYED ON THEIR VALUE. SearchField and Select are uncontrolled, so
            clearing a chip otherwise leaves the old text in the box. */}
        <SearchField key={"q" + (p.q || "")} ph="Name, employee code, designation…"
          val={p.q} onFilter={onSearch} />
        <Select key={"engagement" + (p.engagement || "")} name="engagement" label="Engagement"
          value={p.engagement} onFilter={onFilter}
          options={ENGAGEMENTS.map((e) => ({ v: e.key, l: e.label }))} />
        <Select key={"due" + (p.due || "")} name="due" label="This month" value={p.due}
          onFilter={onFilter} options={[{ v: "unpaid", l: "Unpaid" }, { v: "paid", l: "Paid" }]} />
        <Select key={"active" + (p.active || "")} name="active" label="Account" value={p.active}
          onFilter={onFilter} options={[{ v: "yes", l: "Active" }, { v: "no", l: "Closed" }]} />
        <span className="spacer" />
        <button className="btn sm pri" disabled={!writable} onClick={() => openAccount()}
          title={writable ? undefined : "Opening a salary account needs Finance edit rights."}>
          <Icon name="plus" size="sm" />Add a salary account
        </button>
      </> : <>
        <SearchField key={"q" + (p.q || "")} ph="Name, slip id, month, designation…"
          val={p.q} onFilter={onSearch} />
        <Select key={"status" + (p.status || "")} name="status" label="Status" value={p.status}
          onFilter={onFilter}
          options={[{ v: "paid", l: "Paid" }, { v: "unpaid", l: "Unpaid" }, { v: "held", l: "On hold" }]} />
        <Select key={"month" + (p.month || "")} name="month" label="Month" value={p.month}
          onFilter={onFilter}
          options={runs.map((r) => ({ v: r.month, l: fmtMonth(r.month) }))} />
        <span className="spacer" />
      </>}
      bands={<>
        <SubTabs cur={tab}
          items={[
            { k: "accounts", label: "Accounts" },
            { k: "transactions", label: "Transactions", n: heldN },
          ]}
          onPick={(k) => onParams({
            tab: k === "accounts" ? undefined : k,
            /* Each tab keeps its own vocabulary of filters; carrying one
               across would narrow a list with a control it does not show. */
            q: undefined, status: undefined, month: undefined, due: undefined,
            engagement: undefined, active: undefined,
          })} />
        {/* ONE STRIP STYLE FOR BOTH TABS. The four tiles that stood here said
            what the topbar and the strip now say between them, at four times
            the height, and matched nothing else in the panel. */}
        <StatStrip cells={tab === "transactions" ? txCells : accCells} />
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

      {tab === "transactions" ? (
        <SalaryTransactions p={p} onUnfilter={onUnfilter} />
      ) : (<>
      {filtered.length ? (
        <table className="tbl dls-tbl fin-tbl">
          <thead>
            <tr>
              <th className="rail" />
              <th>Person</th>
              <th>Engagement</th>
              <th className="num">Monthly net</th>
              <th>This month</th>
              <th className="num">Due now</th>
              <th>Last paid</th>
              <th className="tight" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <PersonRow key={r.a.salaryAccountId} r={r} p={p}
                onPay={writable ? pay : null} />
            ))}
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
      </>)}
    </Frame>
  );
}

/* -------------------------------------------------------------------------- */

function PersonRow({ r, p, onPay }: {
  r: SalaryRow; p: Params; onPay: ((r: SalaryRow) => void) | null;
}) {
  const a = r.a;
  const d = dueOf(r);
  const to = recHash(a.salaryAccountId, p);
  const eng = engagementMeta(a.engagement);

  /* The rail speaks once, and about the only thing on this row that needs
     somebody: money owed. Amber for the current month, red once a month older
     than it is still outstanding. */
  const rail = d.arrears.length ? "bad" : d.pendingPaise ? "warn" : "";

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
            <span className="cell-2">{a.designation} · <span className="mono">{a.employeeCode}</span></span>
          </span>
        </div>
      </td>
      <td>
        <span className="pill">{eng ? eng.label : a.engagement}</span>
        {a.active ? null : <div className="cell-2">account closed</div>}
      </td>
      <td className="num"><Money paise={r.monthlyNetPaise} strong /></td>

      {/* THE STATE, AND THE MONTH IT IS ABOUT. A tag on its own would not say
          which month it means, and on a row that can be two months behind that
          is the first thing somebody needs. */}
      <td>
        {d.state === "unpaid" ? (
          <>
            <span className="pill warn">Unpaid</span>
            <div className="cell-2">
              {fmtMonth(d.current?.month || "")}
              {d.arrears.length
                ? " + " + d.arrears.length + " earlier month" + (d.arrears.length === 1 ? "" : "s")
                : null}
            </div>
          </>
        ) : d.state === "paid" ? (
          <>
            <span className="pill ok">Paid</span>
            <div className="cell-2">nothing outstanding</div>
          </>
        ) : (
          <>
            <span className="pill">No slip yet</span>
            <div className="cell-2">no month has been issued</div>
          </>
        )}
      </td>

      {/* ARREARS PLUS THE CURRENT MONTH, as one figure, because that is what
          the transfer will be. The breakdown is underneath so the number is
          never a total nobody can take apart. */}
      <td className="num">
        {d.pendingPaise ? (
          <>
            <Money paise={d.pendingPaise} strong />
            {d.arrears.length ? (
              <div className="cell-2 tnum">
                {inr(d.arrearsPaise)} owed + {inr(d.currentPaise)} this month
              </div>
            ) : null}
          </>
        ) : <span className="faint">—</span>}
      </td>

      <td>
        {r.lastPaidAt
          ? <><div className="cell-1">{fmtDate(r.lastPaidAt)}</div><div className="cell-2">{r.slipsN} slip{r.slipsN === 1 ? "" : "s"} on record</div></>
          : <span className="faint">never</span>}
      </td>

      <td className="tight" onClick={(e) => e.stopPropagation()}>
        {d.pendingPaise && onPay ? (
          <button className="btn sm pri" disabled={!isSuperAdmin()}
            title={superAdminOnly("Paying a salary") || ("Pay " + inr(d.pendingPaise) + " to " + a.memberName)}
            onClick={() => onPay(r)}>
            <Icon name="cash" size="sm" />Pay
          </button>
        ) : <Icon name="chevr" size="sm" />}
      </td>
    </tr>
  );
}
