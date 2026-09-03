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

   ONE CLOCK. `PERIOD`, `fmtMonth()`, `fmtDate()` and `ago()` all read `asOf`
   from module.json, so a screenshot taken next March still says August 2026.
   ============================================================================= */
import { useShell } from "../../shell/ShellContext";
import { Icon } from "../../ui";
import { go } from "../../ui/nav";
import { SubTabs, Block, Blocks, Frame } from "./Frame";
import type { FaceProps } from "./Frame";
import { Assumed, Dir, Money, TagChip, Unavailable } from "./bits";
import { KpiTip, MetricTip } from "./InfoTip";
import { BarRows, SignedColumns, Spark, Waterfall } from "../charts";
import type { BarRow, SignedPoint, WaterStep } from "../charts";
import {
  PERIOD, accountOf, ago, delta, eventMeta, fmtDate, fmtMonth, inr, kpiSeries, pct, todayIso,
  useActivity, useAtRisk, useKpis, useMatchedPct, useMonthPoints, useOverview,
  useReconciliation, useTagTotals, useTaxSummary, useWaterfall,
} from "./store";
import type { Kpi } from "./store";

/* ------------------------------------------------------------ scaling --- */
/* The chart kit takes plain numbers and prints them with `toLocaleString`, so
   an axis fed integer paise would read 5,78,20,000. These convert FOR THE AXIS
   ONLY — every mark carries the untouched figure as `display`, and every rupee
   printed anywhere else on this page comes from `inr()` over paise. */

/** Thousands of rupees: the y-axis gutter is 38px and a tick reading 6,00,000
 *  does not fit in it. */
const thousands = (paise: number) => Math.round(paise / 100000);
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

/** One decision metric.
 *
 *  FOUR STATES, and the two null ones are the reason this is not a tile that
 *  prints a number. `runway` and `cost_per_head` return null on purpose; a zero
 *  or a dash in either is a decision made on a wrong number, so the reason
 *  takes the value's place and the card says which kind of null it is —
 *  waiting on a write, or deliberately never computed here.
 *
 *  A SPARKLINE ONLY WHERE THERE IS A SERIES. Most metrics on this page have one
 *  month behind them; a flat line drawn from a single reading is a claim about
 *  stability the records do not make, so the card says "first reading" instead.
 *  The store returns null for those and the chart renders nothing. */
function KpiTile({ k, priorLabel, note }: { k: Kpi; priorLabel: string | null; note?: string }) {
  if (k.value === null) {
    return (
      <div className="fin-kpi na">
        <div className="k">{k.label}<KpiTip k={k.key} /></div>
        <p className="why">{k.why || "The inputs this metric needs are not in these records."}</p>
        <div className="foot">
          <span className="stamp">{k.why && k.why.indexOf("FN-OD") >= 0
            ? "deliberately not computed" : "not computed — and not zero"}</span>
          {k.prior !== null
            ? <span className="was">{priorLabel} {kpiValue(k.prior, k.unit)}</span>
            : null}
        </div>
      </div>
    );
  }
  const series = kpiSeries(k.key);
  /* The movement is toned by `goodDirection` and never described in words: a
     falling burn and a falling MRR are the same arrow and opposite news. */
  const d = k.prior === null ? null : delta(k.value, k.prior);
  const tone = !d ? "" : d.tone === "mute" ? "flat"
    : (d.tone === "up") === (k.goodDirection === "up") ? "good" : "poor";
  return (
    <div className="fin-kpi">
      <div className="k">{k.label}<KpiTip k={k.key} /></div>
      <div className="v tnum">{kpiValue(k.value, k.unit)}</div>
      <div className="foot">
        {d
          ? <span className={"d " + tone}>{d.text}</span>
          : <span className="first">first reading</span>}
        {series
          ? <Spark values={series} tone={SPARK_TONE[k.key] || "s1"}
              label={k.label + " over " + series.length + " months"} />
          : null}
      </div>
      {note ? <p className="caveat">{note}</p> : null}
    </div>
  );
}

/* ============================================================ overview === */

function Overview() {
  const o = useOverview();
  const steps = useWaterfall();
  const risk = useAtRisk();
  const months = useMonthPoints();
  const tags = useTagTotals();
  const recon = useReconciliation();
  const matched = useMatchedPct();
  const tax = useTaxSummary();
  const activity = useActivity(8);

  const wf: WaterStep[] = steps.map((s) => ({
    key: s.key, label: s.label, sub: s.sub, kind: s.kind,
    value: thousands(s.paise), display: inr(s.paise),
  }));

  const net: SignedPoint[] = months.map((m) => ({
    key: m.month, label: fmtMonth(m.month).slice(0, 1),
    value: lakh(m.netPaise), display: inr(m.netPaise),
  }));
  /* The year bands under the axis, sized by how many months each holds, so a
     twenty-column strip of single letters still says which year it is in. */
  const years: { label: string; n: number }[] = [];
  months.forEach((m) => {
    const y = m.month.slice(0, 4);
    const last = years[years.length - 1];
    if (last && last.label === y) last.n += 1; else years.push({ label: y, n: 1 });
  });

  /* Zero-spend tags are dropped rather than drawn as empty tracks. A tag with
     nothing against it this month is not a small bar, it is not a bar. */
  const spendRows: BarRow[] = tags.rows.filter((r) => r.spentPaise > 0).map((r) => ({
    key: r.tag.tagKey,
    label: <TagChip k={r.tag.tagKey} />,
    value: Math.round(r.spentPaise / 100),
    hint: r.pctOfBudget === null
      ? <>{r.n} payment{r.n === 1 ? "" : "s"}</>
      : <span className={r.overBudget ? "bad" : undefined}>{r.pctOfBudget}% of budget</span>,
    /* The hover line is a description too, and it was a sentence. Four facts,
       separated, is what a tooltip is for. */
    title: inr(r.spentPaise) + " · " + r.n + " payment" + (r.n === 1 ? "" : "s")
      + " · " + r.tag.kind + (r.overBudget ? " · over budget" : ""),
  }));

  return (
    <Blocks>
      {/* ================================================== the arithmetic === */}
      <Block wide title={PERIOD.label}
        right={<span className="fin-sum">as of <b>{fmtDate(todayIso())}</b></span>}>
        <div className="fin-wfsplit">
          <div className="fin-hero">
            <div className="k">Net<MetricTip k="net" /></div>
            <div className={"v tnum " + (o.netPaise >= 0 ? "ok" : "bad")}>{inr(o.netPaise)}</div>
            <div className="s">cash, not profit</div>
            <dl className="fin-heroin">
              <div><dt>Collected</dt><dd className="tnum">{inr(o.collectedPaise)}</dd></div>
              <div><dt>Other income</dt><dd className="tnum">{inr(o.otherInPaise)}</dd></div>
              <div><dt>Out</dt><dd className="tnum">{inr(o.outPaise)}</dd></div>
            </dl>
            {o.salaryN ? null : (
              <p className="fin-caveat">
                <Icon name="alert" size="sm" />
                No salary run has been paid into this period yet — the largest cost is not in the
                figure above.
              </p>
            )}
          </div>
          <div className="fin-wfplot">
            <Waterfall steps={wf} unit="₹ thousand" />
          </div>
        </div>
      </Block>

      {/* ==================================================== net by month === */}
      <Block wide title="Net by month"
        right={<span className="fin-sum">{months.length} month{months.length === 1 ? "" : "s"} in these records</span>}>
        {months.length > 1 ? (
          <SignedColumns points={net} groups={years} unit="₹ lakh" />
        ) : (
          <Unavailable title="One month is not a trend."
            why="Built from the records, not a calendar — it appears as months accumulate." />
        )}
      </Block>

      {/* ============================================ where it went | risk === */}
      <Block title="Where it went" desc={"by tag · " + PERIOD.label}
        right={<span className="fin-sum">{inr(tags.totalPaise)} out</span>}>
        {spendRows.length
          ? <BarRows rows={spendRows} unit="₹" />
          : <Unavailable title="Nothing was spent under any tag in this period."
              why="An empty list is a month with no outgoing transaction, not a missing figure." />}
      </Block>

      {/* NO FOOTER SAYING THESE ARE NEVER ADDED. The table has no total row, the
          rails are four different colours and the neutral one is on the row that
          is not a problem — the form already refuses the sum a sentence was
          asking the reader not to make. */}
      <Block title="Not where it should be" desc="never added together">
        <table className="tbl fin-risk">
          <thead>
            <tr><th>What</th><th className="n">Amount</th><th>Count</th><th /></tr>
          </thead>
          <tbody>
            {risk.map((r) => (
              <tr key={r.key}>
                <td><span className="lab"><i className={"rail " + r.tone} />{r.label}</span></td>
                <td className={"n tnum " + r.tone}>
                  {r.paise !== null ? inr(r.paise) : r.figure}
                </td>
                <td className="faint">{r.count}</td>
                <td className="n">
                  {r.to ? <a onClick={() => go(r.to as string)}>{r.toLabel}</a>
                    : <span className="faint">{r.toLabel}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Block>

      {/* ================================================ matched to bank === */}
      <Block wide title="Matched to bank" desc="completeness, never correctness"
        right={recon.stmt
          ? <span className="fin-sum">
              {recon.stmt.closed ? "window closed" : "window open"} · <b className="mono">{recon.stmt.stmtId}</b>
            </span>
          : null}
        foot={<Assumed id="FN-OD-02" />}>
        {recon.stmt ? (
          <>
            <div className="fin-match">
              <div className="fig">
                <div className="v tnum">{matched === null ? "—" : pct(matched)}</div>
                <div className="k">{recon.matchedN} of {recon.lines.length} lines</div>
              </div>
              <div className="bar">
                <div className="track">
                  <i className="ok" style={{ flexGrow: recon.matchedN }} />
                  {recon.bankOnly.length
                    ? <i className="bad" style={{ flexGrow: recon.bankOnly.length }} />
                    : null}
                </div>
                <div className="legend">
                  <span>matched to a record</span>
                  <span className={recon.bankOnly.length ? "bad" : "faint"}>
                    {recon.bankOnly.length
                      ? recon.bankOnly.length + " unexplained · the window cannot close"
                      : "every line ties to a record"}
                  </span>
                </div>
              </div>
              <div className="acct">
                <div className="k">Account</div>
                <div className="v">{accountOf(recon.stmt.accountId)?.name || recon.stmt.accountId}</div>
                <div className="s mono">{accountOf(recon.stmt.accountId)?.masked || "—"}</div>
              </div>
            </div>

            {recon.bankOnly.length ? (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Date</th><th>Direction</th><th className="n">Amount</th>
                    <th>Reference</th><th>Counterparty</th>
                  </tr>
                </thead>
                <tbody>
                  {recon.bankOnly.map((b) => (
                    <tr key={b.line.lineId}>
                      <td>{fmtDate(b.line.date)}</td>
                      <td><Dir d={b.line.dir === "credit" ? "in" : "out"} /></td>
                      <td className="n"><Money paise={b.line.amountPaise} /></td>
                      <td className="mono">{b.line.reference}</td>
                      <td>{b.line.counterparty}<div className="fin-fine">{b.line.narration}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </>
        ) : (
          <Unavailable title="No statement has been imported."
            why="Computed from no bank lines, completeness would read 100% for the wrong reason." />
        )}
      </Block>

      {/* ========================================================== tax === */}
      <Block title="Tax invoiced" desc="not a return"
        right={<span className="fin-sum">{tax.n} invoice{tax.n === 1 ? "" : "s"}</span>}
        foot={<Assumed id="FN-OD-08" />}>
        <div className="fin-summary">
          <div className="row"><span className="l">Taxable value</span><span className="tnum">{inr(tax.taxablePaise)}</span></div>
          <div className="row"><span className="l">CGST</span><span className="tnum">{inr(tax.cgstPaise)}</span></div>
          <div className="row"><span className="l">SGST</span><span className="tnum">{inr(tax.sgstPaise)}</span></div>
          <div className="row"><span className="l">IGST</span><span className="tnum">{inr(tax.igstPaise)}</span></div>
          <div className="row grand"><span className="l">Total tax invoiced</span><span className="tnum">{inr(tax.totalTaxPaise)}</span></div>
        </div>
      </Block>

      {/* ===================================================== activity === */}
      <Block wide title="Just happened" desc="last eight writes">
        {activity.length ? (
          <div className="fin-evlist">
            {activity.map((e, i) => {
              const m = eventMeta(e.type);
              return (
                <div className="fin-ev" key={e.at + ":" + i}>
                  <span className={"ty" + (m?.tone ? " " + m.tone : "")} title={e.type}>{m?.label || e.type}</span>
                  <span className="tx"><b className="mono">{e.ref}</b> — {e.note || "—"}</span>
                  <span className="wh">{e.actor}</span>
                  <span className="wn" title={e.at}>{ago(e.at)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <Unavailable title="Nothing has been written in this session."
            why="The seed is what happened before this tab opened; this is what happens inside it." />
        )}
      </Block>
    </Blocks>
  );
}

/* ================================================================= KPI === */

/** The one caveat per group that stops a wrong reading, keyed to the condition
 *  that makes it true. A caveat that is always on screen is decoration; these
 *  appear only while the figure beside them is misleading. */
function caveatFor(k: Kpi, salaryPaid: boolean): string | undefined {
  if (salaryPaid) return undefined;
  if (k.key === "burn") return "Salary is not in this yet — the run for this period is still open.";
  if (k.key === "net_margin") return "No salary cost in this period, so this is not a steady-state margin.";
  return undefined;
}

function Kpis() {
  const list = useKpis();
  const months = useMonthPoints();
  const o = useOverview();

  /* Which month a `prior` is measured against, so a movement is never an
     unlabelled arrow. Derived from the same month series the charts draw. */
  const here = months.findIndex((m) => m.month === PERIOD.key);
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
    <Blocks>
      {order.map((g) => (
        <Block key={g} wide title={g} desc={GROUP_DECIDES[g] || "read together"}
          right={<span className="fin-sum">
            {priorLabel ? "movement against " + priorLabel : PERIOD.label}
          </span>}>
          <div className="fin-kpis">
            {byGroup[g].map((k) => (
              <KpiTile key={k.key} k={k} priorLabel={priorLabel}
                note={caveatFor(k, !!o.salaryN)} />
            ))}
          </div>
        </Block>
      ))}

      <Block wide title="What these deliberately do not tell you"
>
        <Assumed id="FN-OD-01" />
        <Assumed id="FN-OD-06" />
        <Assumed id="FN-OD-07" />
      </Block>
    </Blocks>
  );
}

/* =============================================================== face === */

export default function Analytics({ p, onParams }: FaceProps) {
  const { toast } = useShell();
  const tab = p.tab === "kpi" ? "kpi" : "overview";

  return (
    <Frame toast={toast}
      cmd={<>
        <SubTabs cur={tab}
          items={[{ k: "overview", label: "Overview" }, { k: "kpi", label: "KPI" }]}
          onPick={(k) => onParams({ tab: k === "overview" ? undefined : k })} />
        <span className="fin-sum">
          Period <b>{PERIOD.label}</b> · one clock, from the module seed
        </span>
      </>}>
      {tab === "kpi" ? <Kpis /> : <Overview />}
    </Frame>
  );
}
