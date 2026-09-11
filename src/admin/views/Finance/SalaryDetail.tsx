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
import { Alert, Button, Card, EmptyState, Icon, KvList, ListTable, Pill, Tabs } from "../../ui";
import { go } from "../../ui/nav";
import { Rec, Blocks } from "./Frame";
import { EventList, Fine, Ledger, LedgerRow, Money, ProtoBar } from "./bits";
import { CloseAccountModal, SalaryAccountModal } from "./SalaryModals";
import {
  SLIP_RULE, ago, fmtDate, fmtDateTime, fmtMonth, incentiveOf, inr, slipsOf, useSalaryAccount,
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
  /* Back returns to the ACCOUNTS tab explicitly: a person record is only
     ever opened from there, and the list's default is Transactions now. The
     record's own ?tab is its sub-tab and never travels. */
  const back = "#/finance-salaries?tab=accounts"
    + Object.keys(p)
      .filter((k) => p[k] && ["view", "tab", "run"].indexOf(k) < 0)
      .map((k) => "&" + encodeURIComponent(k) + "=" + encodeURIComponent(p[k] as string))
      .join("");

  if (!row) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <ProtoBar />
        <EmptyState icon="search" title="No salary account at that address"
          body={<>There is no record for <span className="font-mono tnum">{id}</span>.</>}
          action={<Button color="primary" onClick={() => navGo(back)}>Back to Salaries A/C</Button>} />
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
          ? <Pill dot lg tone="ok" text="Active" title="On the payroll. The next run opened issues a slip." />
          : <Pill dot lg tone="neutral" text="Closed" title="Closed. No run picks this account up again." />}
        {row.inOpenRun ? <Pill dot lg tone="warn" text="On the open run" /> : null}
      </>}
      sub={<>
        <b className="font-medium text-secondary">{a.memberName}</b> · {a.designation} ·{" "}
        <span className="font-mono tnum">{a.employeeCode}</span>
        {" · "}<Money paise={row.monthlyNetPaise} strong /> net a month
        {" · "}{row.slipsN} slip{row.slipsN === 1 ? "" : "s"} issued
      </>}
      menu={[
        {
          icon: "coin", label: "Revise salary",
          disabled: !writable || !a.active,
          title: !writable ? "Revising a salary needs Finance edit rights."
            : !a.active ? "This account is closed. Reopen it by opening a new one for the member." : undefined,
          act: () => modal(<SalaryAccountModal account={a} onClose={closeLayer} onDone={done} />, "lg"),
        },
        {
          icon: "team", label: "Open the team record",
          act: () => go("#/team/" + a.memberId),
        },
        {
          icon: "lock", label: "Close account", tone: "bad",
          disabled: !writable || !a.active,
          title: !writable ? "Closing a salary account needs Finance edit rights."
            : !a.active ? "It is already closed." : undefined,
          act: () => modal(<CloseAccountModal account={a} onClose={closeLayer} onDone={done} />),
        },
      ]}>

      <Tabs items={TABS.map((t) => ({
        k: t.k, label: t.label, quiet: true,
        n: t.k === "slips" ? slips.length : t.k === "history" ? a.events.length : undefined,
      }))} cur={tab}
        onPick={(k) => onParams({ tab: k === "salary" ? undefined : k })} />

      {/* ========================================================= salary === */}
      {tab === "salary" ? (
        <Blocks>
          <Card title="The person" sub="Held in Team, copied here for the slip.">
            <KvList pairs={[
              ["Name", a.memberName],
              ["Employee code", <span className="font-mono tnum">{a.employeeCode}</span>],
              ["Designation", a.designation],
              ["Joined", <>{fmtDate(a.joinedAt)} <span className="text-quaternary">· {ago(a.joinedAt)}</span></>],
              ["Team record",
                <a href={"#/team/" + a.memberId} data-go={"#/team/" + a.memberId}
                  className="inline-flex items-center gap-1 rounded font-mono text-sm text-brand-secondary outline-focus-ring tnum hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                  onClick={(e) => { e.preventDefault(); go("#/team/" + a.memberId); }}>
                  member {a.memberId} <Icon name="ext" size="xs" />
                </a>],
              ["Account opened", <>{fmtDateTime(a.recordedAt)} <span className="text-quaternary">by {a.recordedBy}</span></>],
            ]} />
            <Fine className="mt-3">
              The link is the join: this account exists against <span className="font-mono tnum">member {a.memberId}</span> in
              Team, and Finance never creates a member of its own. The name and designation above are
              a copy taken for the slip — a retitle in Team does not rewrite a slip already issued.
            </Fine>
          </Card>

          <Card title="Where it is paid" sub="What prints on the slip.">
            <KvList pairs={[
              ["Bank", a.bank.name],
              ["Account", <span className="font-mono tnum">{a.bank.masked}</span>],
              ["IFSC", <span className="font-mono tnum">{a.bank.ifsc}</span>],
              ["PAN", <span className="font-mono tnum">{a.pan}</span>],
              ["UAN", a.uan
                ? <span className="font-mono tnum">{a.uan}</span>
                : <span className="text-quaternary">none — outside EPF membership here</span>],
            ]} />
            <Fine className="mt-3">
              The account number is held masked. The full number is not this module's to keep, and a
              payslip has never needed it.
            </Fine>
          </Card>

          <Card
            className="lg:col-span-2"
            title="What the slip is built from"
            sub="Typed, never derived. Gross is the sum of the earnings; net is gross minus the deductions.">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="min-w-0">
                <h4 className="label-mono mb-1.5">Earnings</h4>
                <Ledger>
                  {a.earnings.map((c) => (
                    <LedgerRow key={c.key} label={c.label}>{inr(c.amountPaise)}</LedgerRow>
                  ))}
                  <LedgerRow label="Gross" grand>{inr(gross)}</LedgerRow>
                </Ledger>
              </div>
              <div className="min-w-0">
                <h4 className="label-mono mb-1.5">Deductions</h4>
                <Ledger>
                  {a.deductions.length ? a.deductions.map((c) => (
                    <LedgerRow key={c.key} label={c.label}>−{inr(c.amountPaise)}</LedgerRow>
                  )) : <Fine className="py-1.5">Nothing comes off this gross.</Fine>}
                  <LedgerRow label="Total deductions" grand>{ded ? "−" + inr(ded) : inr(0)}</LedgerRow>
                </Ledger>
              </div>
            </div>

            <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-secondary pt-3">
              <span className="text-sm font-semibold text-primary">Net every month</span>
              <Money paise={gross - ded} strong />
            </div>

            {/* THE CTC LINE THAT SAT HERE IS GONE WITH THE FIELD. It said,
                twice on one screen, that cost to company was presentational
                and must never be divided by twelve — two cautions about a
                number that computed nothing and that FN-OD-06 already said
                was not cost to company at all. A figure needing that much
                defending was not worth keeping. The slip is the earnings
                above and nothing else, which is now true without argument. */}
          </Card>
        </Blocks>
      ) : null}

      {/* ========================================================== slips === */}
      {tab === "slips" ? (
        slips.length ? (
          <div className="flex min-w-0 flex-col gap-4">
            {differs ? (
              <Alert tone="info" ico="lock"
                title="Two of these slips carry different amounts, and that is the rule working.">
                {SLIP_RULE}
              </Alert>
            ) : null}
            <ListTable min="64rem" head={<tr>
              <th scope="col">Month</th>
              <th scope="col" className="n">Paid days</th>
              <th scope="col" className="n">Gross</th>
              {/* WHAT VARIED, beside the gross that contains it. Without this
                  column a month reads as an unexplained jump: the gross is
                  right, the salary did not change, and nothing on the row
                  says which of the two is true. */}
              <th scope="col" className="n">of which earned</th>
              <th scope="col" className="n">Deductions</th>
              <th scope="col" className="n">Net</th>
              <th scope="col">Paid</th>
              <th scope="col">Evidenced by</th>
            </tr>}>
              {slips.map((s) => <SlipRow key={s.slipId} s={s} p={p} />)}
            </ListTable>
          </div>
        ) : (
          <EmptyState icon="doc" title="No slip has been issued on this account"
            body="A slip appears when a run is opened for a month, and it is numbered and hashed when that run is paid." />
        )
      ) : null}

      {/* ======================================================== history === */}
      {tab === "history" ? (
        <Card title="What has happened to this account"
          sub="Opened, revised, closed. Every entry names who did it.">
          <EventList events={a.events} />
        </Card>
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
      <td className="cell-1">
        {fmtMonth(s.month)}
        <div className="cell-2 font-mono tnum">{s.slipId}</div>
      </td>
      <td className="n">
        {s.paidDays}
        {s.lopDays ? <div className="cell-2">{s.lopDays} day{s.lopDays === 1 ? "" : "s"} loss of pay</div> : null}
      </td>
      <td className="n">{inr(s.grossPaise)}</td>
      <td className="n">{incentiveOf(s)
        ? inr(incentiveOf(s))
        : <span className="text-quaternary">—</span>}</td>
      <td className="n">{s.deductionsPaise ? "−" + inr(s.deductionsPaise) : <span className="text-quaternary">none</span>}</td>
      <td className="n"><Money paise={s.netPaise} strong /></td>
      <td>
        {s.paidAt
          ? <><div className="cell-1">{fmtDate(s.paidAt)}</div><div className="cell-2">{ago(s.paidAt)}</div></>
          : <Pill dot tone="warn" text="Draft" />}
      </td>
      {/* EVIDENCE, NOT A REFERENCE. This column printed `s.reference`, which
          `paySalary` deliberately leaves empty — the typed UTR was removed
          because nothing checked it against a statement — so every slip paid
          through the panel showed a blank cell that said nothing at all. It
          shows what the payment is actually evidenced BY: the receipt where
          there is one, the old reference on a historical slip, and the absence
          named where there is neither. */}
      <td>
        {draft ? <span className="text-quaternary">not issued</span>
          : s.proof ? <span className="font-mono text-xs" title={"Receipt: " + s.proof.filename}>{s.proof.filename}</span>
            : s.reference ? <span className="font-mono text-xs tnum">{s.reference}</span>
              : <span className="text-quaternary">no evidence attached</span>}
      </td>
    </tr>
  );
}
