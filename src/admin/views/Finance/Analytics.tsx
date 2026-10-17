/* =============================================================================
   Finance — Analytics. The four record types read back.
   -----------------------------------------------------------------------------
   ANALYTICS IS NOT A FIFTH RECORD TYPE. There is no analytics table, no nightly
   roll-up and no history file: every figure here is a derivation in store.ts
   over the same subscriptions, salaries, transactions and refunds the other
   four tabs list, so nothing here can disagree with a tab. That used to be
   announced in a standing notice at the top of the page. It is a fact about the
   ARCHITECTURE, not about the month, and a reader checking August did not need
   it above every visit — it lives here now, where the next person to edit this
   file will meet it.

   THE PAGE ANSWERS FOUR QUESTIONS, IN THIS ORDER: where did the month go
   (waterfall), is it getting better (net by month), what did the money go on
   (tag bars), and what is not where it should be (a table). Two tabs, because
   a founder reading Overview is checking the month and a founder reading KPI is
   choosing between options.

   THE PROSE IS GONE, AND THAT WAS THE POINT OF THIS PASS. Every block carried a
   `foot` paragraph explaining its own form — why grouped and not stacked, why
   one hue, why two figures are never added. Most of those explained a decision
   nobody was disputing, in front of somebody who came to read a number. What
   survives is the handful of lines where a figure is technically correct and
   practically misleading: a burn that fell because a run is unpaid, a margin
   with no salary in it, a completeness figure that says nothing about
   correctness. Those are not decoration, they are the caveat that stops a wrong
   decision, and they sit ON the figure rather than in a paragraph under it.

   NO MONEY ARITHMETIC IN THIS FILE. Not one addition, not one ratio. Every
   amount arrives as integer paise from a store hook and is printed by `inr()`;
   every percentage arrives already computed. The only exceptions are the
   scale-for-display divisions feeding the chart kit, which takes plain numbers
   — they are named, they are commented, and the exact figure always travels
   beside them as `display` so nothing rounded is ever printed as an amount.

   ONE CLOCK. `PERIOD` and `ago()` read the store's clock: the server's once
   read, the browser's until then.
   ============================================================================= */
import { useMemo, useState } from "react";
import { useShell } from "../../shell/ShellContext";
import {
  ActivityFeed, Card, ChartFrame, Icon, ListTable, Meter, Rail, SelectInput, Table, Tiles,
} from "../../ui";
import type { TileProps } from "../../ui";
import { go } from "../../ui/nav";
import { Blocks, Frame, SubTabs } from "./Frame";
import type { FaceProps } from "./Frame";
import { Assumed, Dir, Ledger, LedgerRow, Money, TagChip, Unavailable } from "./bits";
import { KpiTip, MetricTip } from "./InfoTip";
import { BarRows, SignedColumns, Spark, Waterfall } from "../charts";
import type { BarRow, SignedPoint, WaterStep } from "../charts";
import {
  PERIOD, accountOf, ago, delta, eventMeta, fmtDate, fmtMonth, fmtMonthLong, inr, kpiSeries, pct, periodOf, todayIso,
  useActivity, useAtRisk, useKpis, useMonthPoints, useOverview,
  useReconciliation, useSalariesReadable, useStatements, useTagTotals, useTaxSummary, useWaterfall,
} from "./store";
import type { Kpi } from "./store";

/* ------------------------------------------------------------ scaling --- */
/* The chart kit takes plain numbers and prints them with `toLocaleString`, so
   an axis fed integer paise would read 5,78,20,000. These convert FOR THE AXIS
   ONLY — every mark carries the untouched figure as `display`, and every rupee
   printed anywhere else on this page comes from `inr()` over paise. */

/** Lakh, to two places — twenty months of net need a label that fits between
 *  twenty columns, and −8.54 does where −8,54,000 does not. */
const lakh = (paise: number) => Math.round(paise / 100000) / 100;

/* What each group decides, in three or four words. It ran to a full sentence
   each and the sentences were the longest text on the tab — but the label alone
   ("Cost") does not say what the group is FOR, and a KPI nobody can attach to a
   decision is a number that gets quoted in a meeting for its own sake. So: the
   decision, and not one word past it. */
const GROUP_DECIDES: Record<string, string> = {
  Revenue: "sell more, or collect better",
  Cost: "who to hire, what to spend on",
  Health: "how long this shape lasts",
  Growth: "which channel, at what cost",
};

/** Which sparkline hue a metric wears. Identity, never status — a cost falling
 *  is good news and still draws in the cost slot. */
const SPARK_TONE: Record<string, "s1" | "s2"> = {
  burn: "s2", new_customers: "s1",
};

/* ============================================================== pieces === */

/** A KPI value in its own unit. `months` spells the unit out because a bare
 *  number beside a rupee tile is read as rupees. */
function kpiValue(v: number, unit: Kpi["unit"]): string {
  if (unit === "inr") return inr(v);
  if (unit === "pct") return pct(v);
  if (unit === "months") return v + (v === 1 ? " month" : " months");
  return v.toLocaleString("en-IN");
}

/** One decision metric, on the panel's own stat tile.
 *
 *  FOUR STATES, and the two null ones are the reason a KPI is not simply a
 *  number. `runway` and `cost_per_head` return null on purpose; a zero or a
 *  dash in either is a decision made on a wrong number, so the reason takes the
 *  value's place and the tile says which kind of null it is — waiting on a
 *  write, or deliberately never computed here.
 *
 *  A SPARKLINE ONLY WHERE THERE IS A SERIES. Most metrics on this page have one
 *  month behind them; a flat line drawn from a single reading is a claim about
 *  stability the records do not make, so the tile says "first reading" instead.
 *  The store returns null for those and the chart renders nothing. */
function kpiTile(k: Kpi, priorLabel: string | null, note?: string): TileProps {
  if (k.value === null) {
    return {
      k: <>{k.label}<KpiTip k={k.key} /></>,
      v: "—",
      /* THE REASON GOES IN `foot`, NOT IN `s`. The tile truncates its sub-line
         to one line, and the whole point of a null KPI is the sentence saying
         which kind of null it is — a caveat cut off mid-word is worse than no
         caveat, because it looks like it was said. */
      foot: (
        <>
          <span className="w-full text-xs leading-relaxed text-tertiary">
            {k.why || "The inputs this metric needs are not in these records."}
          </span>
          <span className="label-mono">
            {k.why && k.why.indexOf("FN-OD") >= 0 ? "deliberately not computed" : "not computed — and not zero"}
          </span>
          {k.prior !== null
            ? <span className="text-quaternary tnum">{priorLabel} · {kpiValue(k.prior, k.unit)}</span>
            : null}
        </>
      ),
    };
  }
  const series = kpiSeries(k.key);
  /* The movement is toned by `goodDirection` and never described in words: a
     falling burn and a falling MRR are the same arrow and opposite news. */
  const d = k.prior === null ? null : delta(k.value, k.prior);
  return {
    k: <>{k.label}<KpiTip k={k.key} /></>,
    v: kpiValue(k.value, k.unit),
    delta: d && d.tone !== "mute"
      ? {
        dir: d.tone === "up" ? "up" : "down",
        text: d.text,
        good: (d.tone === "up") === (k.goodDirection === "up"),
        of: priorLabel ? "vs " + priorLabel : undefined,
      }
      : undefined,
    foot: (
      <>
        {!d ? <span className="text-quaternary">first reading</span>
          : d.tone === "mute" ? <span className="text-quaternary">{d.text}</span> : null}
        {series
          ? <Spark values={series} tone={SPARK_TONE[k.key] || "s1"}
              label={k.label + " over " + series.length + " months"} />
          : null}
        {/* THE CAVEAT WRAPS, on its own line. It is the sentence that stops a
            wrong decision, and the tile's one-line sub would clip it. */}
        {note ? <span className="w-full text-xs leading-relaxed text-warning-primary">{note}</span> : null}
      </>
    ),
  };
}

/* ============================================================ overview === */

function Overview({ month }: { month?: string }) {
  const curPeriod = periodOf(month || PERIOD.key);
  const o = useOverview(month);
  /* NO PAYROLL GRANT, NO SALARIES: salaries/ answers 403 and every OUT and
     net figure below is short by the whole wage bill. Said on the figure. */
  const salOk = useSalariesReadable();
  const steps = useWaterfall(month);
  const risk = useAtRisk(month);
  const months = useMonthPoints();
  const tags = useTagTotals(month);
  const stmts = useStatements();
  const [stmtId, setStmtId] = useState<string>("");
  const recon = useReconciliation(stmtId || undefined);
  const matched = recon.matchedPct;
  const tax = useTaxSummary();
  const activity = useActivity(8);
  const multiOpen = !stmtId && recon.openStmts.length > 1;

  const wf: WaterStep[] = steps.map((s) => ({
    key: s.key, label: s.label, sub: s.sub, kind: s.kind,
    value: lakh(s.paise), display: inr(s.paise),
  }));

  const net: SignedPoint[] = months.map((m) => ({
    key: m.month, label: fmtMonth(m.month).slice(0, 3),
    value: lakh(m.netPaise), display: inr(m.netPaise),
  }));
  const years: { label: string; n: number }[] = [];
  months.forEach((m) => {
    const y = m.month.slice(0, 4);
    const last = years[years.length - 1];
    if (last && last.label === y) last.n += 1; else years.push({ label: y, n: 1 });
  });

  const spendRows: BarRow[] = tags.rows
    .filter((r) => r.spentPaise > 0 && r.tag.kind !== "excluded")
    .map((r) => ({
      key: r.tag.tagKey,
      label: <TagChip k={r.tag.tagKey} />,
      value: Math.round(r.spentPaise / 100),
      display: inr(r.spentPaise),
      hint: r.pctOfBudget === null
        ? <>{r.n} payment{r.n === 1 ? "" : "s"}</>
        : <span className={r.overBudget ? "text-error-primary" : undefined}>{r.pctOfBudget}% of budget</span>,
      title: inr(r.spentPaise) + " · " + r.n + " payment" + (r.n === 1 ? "" : "s")
        + " · " + r.tag.kind + (r.overBudget ? " · over budget" : ""),
    }));

  const stmtOptions = useMemo(() => {
    const open = stmts.filter((s) => !s.closed);
    const opts: { v: string; l: string }[] = [];
    if (open.length > 1) {
      opts.push({ v: "", l: "All open statements (" + open.length + ")" });
    }
    stmts.forEach((s) => {
      const acc = accountOf(s.accountId)?.name || s.accountId;
      opts.push({
        v: s.stmtId,
        l: s.stmtId + " · " + acc + (s.closed ? " (closed)" : " (open)"),
      });
    });
    return opts;
  }, [stmts]);

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Tiles cols={4} list={[
        { k: <>Net · {curPeriod.label}<MetricTip k="net" /></>,
          v: inr(o.netPaise), tone: !salOk ? "warn" : o.netPaise >= 0 ? "ok" : "bad", s: "cash, not profit",
          foot: <>
            {salOk ? null : <span className="w-full text-xs leading-relaxed text-warning-primary">Not complete — salaries are left out.</span>}
            <span className="label-mono">as of {fmtDate(todayIso())}</span>
          </> },
        { k: "Collected · " + curPeriod.label, v: inr(o.collectedPaise),
          s: o.collectedN + " installment" + (o.collectedN === 1 ? "" : "s") + " settled in " + curPeriod.label },
        { k: "Other income · " + curPeriod.label, v: inr(o.otherInPaise),
          s: o.otherInN + " credit" + (o.otherInN === 1 ? "" : "s") + " · never revenue" },
        { k: "Out · " + curPeriod.label, v: inr(o.outPaise),
          s: (o.salaryN ? inr(o.salaryPaise) + " salary (" + o.salaryN + " slips) · " : "")
            + inr(o.otherOutPaise) + " spend"
            + (o.refundsPaidPaise ? " · " + inr(o.refundsPaidPaise) + " refunds" : ""),
          foot: salOk ? undefined
            : <span className="w-full text-xs leading-relaxed text-warning-primary">Salaries not included — no access.</span> },
      ]} />

      <ChartFrame title={"Where " + curPeriod.label + " went"}
        note={salOk && o.salaryN ? undefined : (
          <span className="inline-flex items-start gap-1.5 text-warning-primary">
            <Icon name="alert" size="xs" className="mt-0.5 shrink-0" />
            {salOk
              ? "No salary run has been paid into this period yet — the largest cost is not in the figures above."
              : "Salaries not included — no access to payroll. Out and net leave the wage bill out, so net reads higher than it is."}
          </span>
        )}>
        <Waterfall steps={wf} unit="₹ lakh" />
      </ChartFrame>

      {/* ==================================================== net by month === */}
      <ChartFrame title="Net by month"
        right={<span className="label-mono">{months.length} month{months.length === 1 ? "" : "s"} in these records{salOk ? "" : " · excludes salaries"}</span>}>
        {months.length > 1 ? (
          <SignedColumns points={net} groups={years} unit="₹ lakh" />
        ) : (
          <Unavailable title="One month is not a trend."
            why="Built from the records, not a calendar — it appears as months accumulate." />
        )}
      </ChartFrame>

      <Blocks>
        {/* ============================================ where it went | risk === */}
        <ChartFrame title={"Where it went · by tag · " + curPeriod.label}
          right={<span className="label-mono">{inr(tags.totalPaise)} out</span>}>
          {spendRows.length
            ? <BarRows rows={spendRows} unit="₹" />
            : <Unavailable title="Nothing was spent under any tag in this period."
                why="An empty list is a month with no outgoing transaction, not a missing figure." />}
        </ChartFrame>

        <Card flush title="Not where it should be" sub="never added together">
          <Table list
            cols={[
              { label: "", cls: "rail" },
              { label: "What" },
              { label: "Amount", cls: "n" },
              { label: "Count", cls: "c" },
              { label: <span className="sr-only">Go</span>, cls: "acts" },
            ]}
            rows={risk.map((r) => (
              <tr key={r.key}>
                <Rail tone={r.tone} />
                <td className="cell-1">{r.label}</td>
                <td className="n">{r.paise !== null ? inr(r.paise) : r.figure}</td>
                <td className="c faint">{r.count}</td>
                <td className="acts">
                  {r.to
                    ? <a href={r.to} data-go={r.to}
                        className="rounded text-sm font-medium text-brand-secondary outline-focus-ring hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                        onClick={(e) => { e.preventDefault(); go(r.to as string); }}>{r.toLabel}</a>
                    : <span className="text-quaternary">{r.toLabel}</span>}
                </td>
              </tr>
            ))} />
        </Card>
      </Blocks>

      {/* ================================================ matched to bank === */}
      <Card
        title="Matched to bank"
        sub="completeness, never correctness"
        right={recon.stmt ? (
          <div className="flex flex-wrap items-center gap-2">
            {stmtOptions.length > 1 ? (
              <div className="w-64">
                <SelectInput
                  ariaLabel="Select Bank Statement"
                  value={stmtId}
                  onChange={setStmtId}
                  options={stmtOptions}
                />
              </div>
            ) : (
              <span className="label-mono">
                {recon.stmt.closed ? "window closed" : "window open"} · {recon.stmt.stmtId}
              </span>
            )}
          </div>
        ) : null}
        foot={<Assumed id="FN-OD-02" />}>
        {recon.stmt ? (
          <div className="flex min-w-0 flex-col gap-4">
            <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <div className="text-display-xs font-semibold tracking-tight text-primary tnum">
                  {matched === null ? "—" : pct(matched)}
                </div>
                <div className="label-mono mt-0.5">
                  {recon.matchedN} of {recon.lines.length} lines
                  {recon.resolvedN ? " · " + recon.resolvedN + " resolved" : ""}
                  {multiOpen ? " · " + recon.openStmts.length + " open statements" : ""}
                </div>
              </div>
              <div className="min-w-0">
                <Meter value={matched === null ? 0 : matched} tone={recon.bankOnly.length ? "warn" : "ok"}
                  label="Share of bank lines matched to a record" />
                <div className="mt-1.5 flex flex-wrap justify-between gap-x-4 text-xs">
                  <span className="text-tertiary">
                    {recon.matchedN} matched to a record{recon.resolvedN ? " · " + recon.resolvedN + " resolved" : ""}
                  </span>
                  <span className={recon.bankOnly.length ? "text-error-primary" : "text-quaternary"}>
                    {recon.bankOnly.length
                      ? recon.bankOnly.length + " unexplained (net " + inr(recon.variancePaise) + ")"
                      : "every line ties to a record"}
                  </span>
                </div>
              </div>
              <div className="min-w-0">
                <div className="label-mono">{multiOpen ? "Open statements" : "Account"}</div>
                {multiOpen ? (
                  <>
                    <div className="text-sm font-medium text-primary">
                      {recon.openStmts.map((s) => accountOf(s.accountId)?.name || s.accountId).join(" + ")}
                    </div>
                    <div className="font-mono text-xs text-tertiary tnum">
                      {recon.openStmts.map((s) => s.stmtId).join(" · ")}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-medium text-primary">
                      {accountOf(recon.stmt.accountId)?.name || recon.stmt.accountId}
                    </div>
                    <div className="font-mono text-xs text-tertiary tnum">
                      {accountOf(recon.stmt.accountId)?.masked || "—"}
                    </div>
                  </>
                )}
              </div>
            </div>

            {recon.bankOnly.length ? (
              <ListTable min="52rem" head={<tr>
                <th className="rail" />
                <th scope="col">Date</th>
                {multiOpen ? <th scope="col">Statement</th> : null}
                <th scope="col">Direction</th>
                <th scope="col" className="n">Amount</th>
                <th scope="col">Reference</th>
                <th scope="col">Counterparty</th>
              </tr>}>
                {recon.bankOnly.map((b) => (
                  <tr key={b.line.lineId}>
                    <Rail tone="bad" />
                    <td className="whitespace-nowrap">{fmtDate(b.line.date)}</td>
                    {multiOpen ? (
                      <td className="whitespace-nowrap">
                        <div className="cell-1">{accountOf(b.line.accountId || "")?.name || b.line.accountId}</div>
                        <div className="cell-2 font-mono">{b.line.stmtId}</div>
                      </td>
                    ) : null}
                    <td><Dir d={b.line.dir === "credit" ? "in" : "out"} /></td>
                    <td className="n"><Money paise={b.line.amountPaise} /></td>
                    <td className="mono">{b.line.reference}</td>
                    <td>
                      <div className="cell-1">{b.line.counterparty}</div>
                      <div className="cell-2">{b.line.narration}</div>
                    </td>
                  </tr>
                ))}
              </ListTable>
            ) : null}
          </div>
        ) : (
          <Unavailable title="No statement has been imported."
            why="Computed from no bank lines, completeness would read 100% for the wrong reason." />
        )}
      </Card>

      <Blocks>
        {/* ========================================================== tax === */}
        <Card title="Tax invoiced" sub="not a return"
          right={<span className="label-mono">{tax.n} invoice{tax.n === 1 ? "" : "s"}</span>}
          foot={<Assumed id="FN-OD-08" />}>
          <Ledger>
            <LedgerRow label="Taxable value">{inr(tax.taxablePaise)}</LedgerRow>
            <LedgerRow label="CGST">{inr(tax.cgstPaise)}</LedgerRow>
            <LedgerRow label="SGST">{inr(tax.sgstPaise)}</LedgerRow>
            <LedgerRow label="IGST">{inr(tax.igstPaise)}</LedgerRow>
            <LedgerRow label="Total tax invoiced" grand>{inr(tax.totalTaxPaise)}</LedgerRow>
          </Ledger>
        </Card>

        {/* ===================================================== activity === */}
        <Card title="Just happened" sub="last eight writes">
          {activity.length ? (
            <ActivityFeed items={activity.map((e) => {
              const m = eventMeta(e.type);
              return {
                ico: "history",
                what: (
                  <>
                    <b className="font-mono font-medium text-primary">{e.ref}</b>
                    {" — "}{e.note || "—"}
                  </>
                ),
                when: <>{m?.label || e.type} · {e.actor} · {ago(e.at)}</>,
              };
            })} />
          ) : (
            <Unavailable title="Nothing has been written in this session."
              why="The seed is what happened before this tab opened; this is what happens inside it." />
          )}
        </Card>
      </Blocks>
    </div>
  );
}

/* ================================================================= KPI === */

/** The one caveat per group that stops a wrong reading, keyed to the condition
 *  that makes it true. A caveat that is always on screen is decoration; these
 *  appear only while the figure beside them is misleading. */
function caveatFor(k: Kpi, salaryPaid: boolean, salOk: boolean): string | undefined {
  if (!salOk && (k.key === "burn" || k.key === "net_margin")) return "Salaries not included — no access to payroll.";
  if (salaryPaid) return undefined;
  if (k.key === "burn") return "Salary is not in this yet — the run for this period is still open.";
  if (k.key === "net_margin") return "No salary cost in this period, so this is not a steady-state margin.";
  return undefined;
}

function Kpis({ month }: { month?: string }) {
  const selectedKey = month || PERIOD.key;
  const curPeriod = periodOf(selectedKey);
  const list = useKpis(month);
  const months = useMonthPoints();
  const o = useOverview(month);
  const salOk = useSalariesReadable();

  /* Which month a `prior` is measured against, so a movement is never an
     unlabelled arrow. Derived from the same month series the charts draw. */
  const here = months.findIndex((m) => m.month === selectedKey);
  const priorLabel = here > 0 ? fmtMonth(months[here - 1].month) : null;

  /* Grouped in the order the store returns them — Revenue, Cost, Health,
     Growth is the order money moves, and hard-coding the list here would let a
     new KPI go missing from the page without anything failing. */
  const order: string[] = [];
  const byGroup: Record<string, Kpi[]> = {};
  list.forEach((k) => {
    if (!byGroup[k.group]) { byGroup[k.group] = []; order.push(k.group); }
    byGroup[k.group].push(k);
  });

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {order.map((g) => (
        <section key={g} className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-md font-semibold text-primary">{g}</h2>
              <p className="mt-0.5 text-sm text-tertiary">{GROUP_DECIDES[g] || "read together"}</p>
            </div>
            <span className="label-mono">
              {priorLabel ? "movement against " + priorLabel : curPeriod.label}
            </span>
          </div>
          <Tiles cols={3} list={byGroup[g].map((k) => kpiTile(k, priorLabel, caveatFor(k, !!o.salaryN, salOk)))} />
        </section>
      ))}

      <Card title="What these deliberately do not tell you"
        sub="three open decisions, stated rather than quietly assumed">
        <div className="flex flex-col gap-2">
          <Assumed id="FN-OD-01" />
          <Assumed id="FN-OD-06" />
          <Assumed id="FN-OD-07" />
        </div>
      </Card>
    </div>
  );
}

/* =============================================================== face === */

export default function Analytics({ p, onParams }: FaceProps) {
  const { toast } = useShell();
  const tab = p.tab === "kpi" ? "kpi" : "overview";
  const selectedMonth = p.month || PERIOD.key;
  const curPeriod = periodOf(selectedMonth);
  const months = useMonthPoints();

  const monthOptions = useMemo(() => {
    const list = months.slice().reverse().map((m) => ({
      v: m.month,
      l: fmtMonthLong(m.month) + (m.month === PERIOD.key ? " (Current)" : ""),
    }));
    if (!list.some((o) => o.v === PERIOD.key)) {
      list.unshift({ v: PERIOD.key, l: fmtMonthLong(PERIOD.key) + " (Current)" });
    }
    return list;
  }, [months]);

  return (
    <Frame toast={toast}
      title="Analytics"
      meta={
        <>
          <span className="label-mono">Period {curPeriod.label}</span>
          <span className="label-mono">as of {fmtDate(todayIso())}</span>
        </>
      }
      cmd={
        <SubTabs cur={tab}
          items={[{ k: "overview", label: "Overview" }, { k: "kpi", label: "KPI" }]}
          onPick={(k) => onParams({ ...p, tab: k === "overview" ? undefined : k })}
          right={
            <div className="flex items-center gap-2">
              <span className="label-mono">Month:</span>
              <div className="w-52">
                <SelectInput
                  ariaLabel="Select Reporting Month"
                  value={selectedMonth}
                  onChange={(m) => onParams({ ...p, month: m === PERIOD.key ? undefined : m })}
                  options={monthOptions}
                />
              </div>
            </div>
          } />
      }>
      {tab === "kpi" ? <Kpis month={p.month} /> : <Overview month={p.month} />}
    </Frame>
  );
}
