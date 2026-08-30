/* =============================================================================
   Finance · one salary account.
   -----------------------------------------------------------------------------
     ?tab=salary   (default) who they are, what the slip is built from, where
                   it is paid, and the identifiers that print on it
     ?tab=slips    every slip this account has ever carried, newest first
     ?tab=history  what has happened to the account itself

   The account is Finance's; the PERSON is Team's. `memberId` is the join and
   the Team link is the live record — the name and designation here are copies,
   kept because a slip issued in June has to still read the way it read in June
   even if somebody is retitled in July.

   Nothing on this screen is derived from a role. A salary is a contract with a
   person, not a function of their permissions, so every component was typed by
   somebody who agreed to it.
   ============================================================================= */
import { useShell } from "../../shell/ShellContext";
import { can, useNav } from "../../shell/AdminShell";
import { EmptyState, Icon, KvList, Notice, Tabs } from "../../ui";
import { go } from "../../ui/nav";
import { Rec, Block, Blocks } from "./Frame";
import { EventList, Money, ProtoBar } from "./bits";
import { CloseAccountModal, SalaryAccountModal } from "./SalaryModals";
import {
  SLIP_RULE, ago, fmtDate, fmtDateTime, fmtMonth, inr, slipsOf, useSalaryAccount,
} from "./store";
import type { Params, Payslip, SalaryComponent } from "./store";

const TABS = [
  { k: "salary", label: "Salary" },
  { k: "slips", label: "Slips" },
  { k: "history", label: "History" },
];

const sum = (l: SalaryComponent[]) => l.reduce((n, c) => n + c.amountPaise, 0);

export default function SalaryDetail({ id, p, onParams }: {
  id: string;
  p: Params;
  onParams: (patch: Params) => void;
}) {
  const { toast, modal, closeLayer } = useShell();
  const { go: navGo } = useNav();
  const row = useSalaryAccount(id);
  const tab = p.tab || "salary";

  /* The list state travels back with the button, so Back is a return and not a
     reset. `tab` and `run` belong to a screen, not to the list. */
  const back = "#/finance-salaries"
    + Object.keys(p)
      .filter((k) => p[k] && ["view", "tab", "run"].indexOf(k) < 0)
      .map((k) => "&" + encodeURIComponent(k) + "=" + encodeURIComponent(p[k] as string))
      .join("");

  if (!row) {
    return (
      <div className="fin-rec">
        <ProtoBar />
        <EmptyState icon="search" title="No salary account at that address"
          body={<>There is no record for <span className="mono">{id}</span>.</>}
          action={<button className="btn pri" onClick={() => navGo(back)}>Back to Salaries A/C</button>} />
      </div>
    );
  }

  const a = row.a;
  const slips = slipsOf(a.salaryAccountId);
  const gross = sum(a.earnings);
  const ded = sum(a.deductions);
  const writable = can("finance-salaries", "edit");
  const done = (msg: string, tone?: string) => { closeLayer(); toast(msg, tone); };

  /* Two slips on one account carrying different component amounts is not a
     bug to be explained away — it is the freeze working. Said once, where the
     slips are, and only when there is actually a difference to see. */
  const differs = slips.some((s) => s.grossPaise !== slips[0].grossPaise);

  return (
    <Rec
      id={a.salaryAccountId}
      back={back}
      pills={<>
        {a.active
          ? <span className="pill ok lg" title="On the payroll. The next run opened issues a slip.">Active</span>
          : <span className="pill lg" title="Closed. No run picks this account up again.">Closed</span>}
        {row.inOpenRun ? <span className="pill warn lg">On the open run</span> : null}
      </>}
      actions={<>
        <button className="btn sm" disabled={!writable || !a.active}
          title={!writable ? "Revising a salary needs Finance edit rights."
            : !a.active ? "This account is closed. Reopen it by opening a new one for the member." : undefined}
          onClick={() => modal(<SalaryAccountModal account={a} onClose={closeLayer} onDone={done} />, "wide")}>
          <Icon name="coin" size="sm" />Revise salary
        </button>
        <button className="btn sm dgr" disabled={!writable || !a.active}
          title={!writable ? "Closing a salary account needs Finance edit rights."
            : !a.active ? "It is already closed." : undefined}
          onClick={() => modal(<CloseAccountModal account={a} onClose={closeLayer} onDone={done} />)}>
          <Icon name="lock" size="sm" />Close account
        </button>
      </>}>

      <div className="fin-subline">
        <b>{a.memberName}</b> · {a.designation} · <span className="mono">{a.employeeCode}</span>
        {" · "}<Money paise={row.monthlyNetPaise} strong /> net a month
        {" · "}{row.slipsN} slip{row.slipsN === 1 ? "" : "s"} issued
      </div>

      <Tabs items={TABS.map((t) => ({
        k: t.k, label: t.label,
        n: t.k === "slips" ? slips.length : t.k === "history" ? a.events.length : undefined,
      }))} cur={tab}
        onPick={(k) => onParams({ tab: k === "salary" ? undefined : k })} />

      {/* ========================================================= salary === */}
      {tab === "salary" ? (
        <Blocks>
          <Block title="The person"
            desc={<>Held in Team, copied here for the slip.</>}>
            <KvList cls="wide" pairs={[
              ["Name", a.memberName],
              ["Employee code", <span className="mono">{a.employeeCode}</span>],
              ["Designation", a.designation],
              ["Joined", <>{fmtDate(a.joinedAt)} <span className="faint">· {ago(a.joinedAt)}</span></>],
              ["Team record",
                <a className="lnk mono" data-go={"#/team/" + a.memberId}
                  onClick={() => go("#/team/" + a.memberId)}>
                  member {a.memberId} <Icon name="ext" size="sm" />
                </a>],
              ["Account opened", <>{fmtDateTime(a.recordedAt)} <span className="faint">by {a.recordedBy}</span></>],
            ]} />
            <p className="fin-fine">
              The link is the join: this account exists against <span className="mono">member {a.memberId}</span> in
              Team, and Finance never creates a member of its own. The name and designation above are
              a copy taken for the slip — a retitle in Team does not rewrite a slip already issued.
            </p>
          </Block>

          <Block title="Where it is paid" desc="What prints on the slip.">
            <KvList cls="wide" pairs={[
              ["Bank", a.bank.name],
              ["Account", <span className="mono">{a.bank.masked}</span>],
              ["IFSC", <span className="mono">{a.bank.ifsc}</span>],
              ["PAN", <span className="mono">{a.pan}</span>],
              ["UAN", a.uan
                ? <span className="mono">{a.uan}</span>
                : <span className="faint">none — outside EPF membership here</span>],
            ]} />
            <p className="fin-fine">
              The account number is held masked. The full number is not this module's to keep, and a
              payslip has never needed it.
            </p>
          </Block>

          <Block wide title="What the slip is built from"
            desc={<>Typed, never derived. Gross is the sum of the earnings; net is gross minus the deductions.</>}
            foot={<div className="fin-actions">
              <span className="fin-sum">
                Cost to company <b>{inr(a.ctcPaise)}</b> a year — presentational, and never divided by twelve to make a slip.
              </span>
            </div>}>
            <div className="fin-two">
              <div>
                <div className="sh"><h2>Earnings</h2></div>
                {a.earnings.map((c) => (
                  <div className="fin-srow" key={c.key}>
                    <span className="l">{c.label}</span>
                    <span className="tnum">{inr(c.amountPaise)}</span>
                  </div>
                ))}
                <div className="fin-srow grand">
                  <span className="l">Gross</span><span className="tnum">{inr(gross)}</span>
                </div>
              </div>
              <div>
                <div className="sh"><h2>Deductions</h2></div>
                {a.deductions.length ? a.deductions.map((c) => (
                  <div className="fin-srow" key={c.key}>
                    <span className="l">{c.label}</span>
                    <span className="tnum">−{inr(c.amountPaise)}</span>
                  </div>
                )) : <p className="fin-fine">Nothing comes off this gross.</p>}
                <div className="fin-srow grand">
                  <span className="l">Total deductions</span><span className="tnum">{ded ? "−" + inr(ded) : inr(0)}</span>
                </div>
              </div>
            </div>

            <div className="fin-srow grand">
              <span className="l">Net every month</span>
              <span><Money paise={gross - ded} strong /></span>
            </div>

            <Notice tone="info" ico="coin" text={<>
              <b>Cost to company is presentational and it is not the salary.</b> {inr(a.ctcPaise)} a
              year is what was agreed at offer; the slip is built from the {a.earnings.length} earning
              {a.earnings.length === 1 ? "" : "s"} above and nothing else. CTC ÷ 12 would produce a
              figure no component adds up to, and a slip nobody could reconcile.
            </>} />
          </Block>
        </Blocks>
      ) : null}

      {/* ========================================================== slips === */}
      {tab === "slips" ? (
        slips.length ? (
          <div className="fin-cards">
            {differs ? (
              <Notice tone="info" ico="lock" text={<>
                <b>Two of these slips carry different amounts, and that is the rule working.</b>{" "}
                {SLIP_RULE}
              </>} />
            ) : null}
            <table className="tbl fin-stbl">
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="num">Paid days</th>
                  <th className="num">Gross</th>
                  <th className="num">Deductions</th>
                  <th className="num">Net</th>
                  <th>Paid</th>
                  <th>Reference</th>
                  <th className="tight" />
                </tr>
              </thead>
              <tbody>
                {slips.map((s) => <SlipRow key={s.slipId} s={s} p={p} />)}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="doc" title="No slip has been issued on this account"
            body="A slip appears when a run is opened for a month, and it is numbered and hashed when that run is paid." />
        )
      ) : null}

      {/* ======================================================== history === */}
      {tab === "history" ? (
        <div className="fin-cards">
          <Block title="What has happened to this account"
            desc="Opened, revised, closed. Every entry names who did it.">
            <EventList events={a.events} />
          </Block>
        </div>
      ) : null}
    </Rec>
  );
}

/* -------------------------------------------------------------------------- */

function SlipRow({ s, p }: { s: Payslip; p: Params }) {
  const carried = Object.keys(p)
    .filter((k) => p[k] && ["tab", "run"].indexOf(k) < 0)
    .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(p[k] as string))
    .join("&");
  const to = "#/finance-salaries/" + encodeURIComponent(s.slipId) + (carried ? "?" + carried : "");
  const draft = s.issuedAt === null;
  return (
    <tr className="clickable" tabIndex={0} role="link" aria-label={"Open the slip for " + fmtMonth(s.month)}
      onClick={() => go(to)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(to); } }}>
      <td>
        <div className="cell-1">{fmtMonth(s.month)}</div>
        <div className="cell-2 mono">{s.slipId}</div>
      </td>
      <td className="num">
        <span className="tnum">{s.paidDays}</span>
        {s.lopDays ? <div className="cell-2">{s.lopDays} day{s.lopDays === 1 ? "" : "s"} loss of pay</div> : null}
      </td>
      <td className="num tnum">{inr(s.grossPaise)}</td>
      <td className="num tnum">{s.deductionsPaise ? "−" + inr(s.deductionsPaise) : <span className="faint">none</span>}</td>
      <td className="num"><Money paise={s.netPaise} strong /></td>
      <td>
        {s.paidAt
          ? <><div className="cell-1">{fmtDate(s.paidAt)}</div><div className="cell-2">{ago(s.paidAt)}</div></>
          : <span className="pill warn">Draft</span>}
      </td>
      <td className="mono cell-2">{draft ? <span className="faint">not issued</span> : s.reference}</td>
      <td className="tight"><Icon name="chevr" size="sm" /></td>
    </tr>
  );
}
