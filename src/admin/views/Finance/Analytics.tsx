/* =============================================================================
   Finance — Analytics. The four record types read back.
   -----------------------------------------------------------------------------
   ANALYTICS IS NOT A FIFTH RECORD TYPE. There is no analytics table, no nightly
   roll-up and no history file. Every figure on this page is a derivation in
   store.ts over the same subscriptions, salaries, transactions and refunds the
   other four tabs list, which is why no number here can disagree with a list:
   record a payment and the tile, the chart and the KPI all move in the same
   read. The page says that out loud at the top rather than expecting a reader
   to take it on trust.

   TWO TABS, TWO QUESTIONS. Overview answers *what happened* — money in, money
   out, what the bank confirms, what tax was invoiced. KPI answers *what to do
   next* — the decision metrics, grouped by the decision each group informs.
   They are separate because a founder reading the first is checking the month
   and a founder reading the second is choosing between options, and one page
   trying to do both ends up doing neither.

   NO MONEY ARITHMETIC IN THIS FILE. Not one addition, not one ratio. Every
   amount arrives as integer paise from a store hook and is printed by `inr()`;
   every percentage arrives already computed and is printed by `pct()`. The two
   exceptions are scale-for-display divisions feeding the chart kit, which takes
   plain numbers — they are named, commented and never used for a printed
   figure. If a number is not in the store it is not on this page.

   NO CHART LIBRARY AND NO HAND-ROLLED SVG. The forms come from ../charts.tsx —
   the reasons are in that file's header, and the palette custom properties are
   already defined on the `.fin` root, so the kit themes here for free.

   ONE CLOCK. `PERIOD`, `fmtMonth()`, `fmtDate()` and `ago()` all read `asOf`
   from module.json. The browser clock is never consulted, so a screenshot taken
   next March still says August 2026.
   ============================================================================= */
import { useShell } from "../../shell/ShellContext";
import { Icon, Notice } from "../../ui";
import { go } from "../../ui/nav";
import { SubTabs, Block, Blocks, Frame } from "./Frame";
import type { FaceProps } from "./Frame";
import { Assumed, Dir, Money, TagChip, Unavailable } from "./bits";
import { KpiTip, MetricTip } from "./InfoTip";
import { BarRows, ColumnChart } from "../charts";
import type { BarRow, Series } from "../charts";
import {
  PERIOD, accountOf, ago, delta, eventMeta, fmtDate, fmtMonth, inr, pct, todayIso,
  useActivity, useKpis, useMatchedPct, useMonthPoints, useOverview, useOverviewTiles,
  useReconciliation, useTagTotals, useTaxSummary,
} from "./store";
import type { Kpi, Tile } from "./store";

/* ------------------------------------------------------------ scaling --- */
/* The chart kit takes plain numbers and prints them with `toLocaleString`, so
   an axis fed integer paise would read 5,78,20,000. These two convert FOR THE
   MARKS ONLY. Neither result is ever printed as an amount — every rupee figure
   on this page comes from `inr()` over the untouched paise. */

/** Rupees, for a bar whose own value column has room for the full number. */
const rupees = (paise: number) => Math.round(paise / 100);
/** Thousands of rupees, for a column chart: the y-axis gutter is 38px and a
 *  tick reading 6,00,000 does not fit in it. The caption says so. */
const thousands = (paise: number) => Math.round(paise / 100000);

/* Fixed slot order, assigned once and never cycled: collected is the money
   that arrived, salary the largest committed cost, other spend everything
   else. A colour means the same series in every month. Three is the kit's
   categorical maximum and there is no fourth — refunds and other income are on
   the strip above, where they are read as amounts rather than compared. */
const FLOW: Series[] = [
  { key: "collected", label: "Collected", slot: 1 },
  { key: "salary", label: "Salary paid", slot: 2 },
  { key: "spend", label: "Other spend", slot: 3 },
];

/* One line per group saying which decision it informs. A KPI with no decision
   attached to it is a number somebody will eventually quote in a meeting
   without knowing what it was for. */
const GROUP_DECIDES: Record<string, string> = {
  Revenue: "whether to sell more of the same thing, or fix collection first",
  Cost: "who to hire, and where the next rupee of spend goes",
  Health: "how long the company can keep its current shape",
  Growth: "which channel to feed, and what a customer is allowed to cost",
};

/* ============================================================== pieces === */

/** One Overview figure. A tile whose `unavailable` is set prints the reason
 *  where the amount would go — a zero there is a claim that nothing happened,
 *  which is a different and much worse statement than "this is not computable". */
function MoneyTile({ t }: { t: Tile }) {
  const na = t.unavailable !== null ? t.unavailable
    : t.paise === null ? "Not computable from these records." : null;
  return (
    <div className={"fin-mt " + (na ? "na" : t.tone)}>
      <div className="k">{t.label}<MetricTip k={t.key} /></div>
      {na ? <p className="fin-na">{na}</p> : <div className="v">{inr(t.paise)}</div>}
      <div className="s">{t.sub}</div>
    </div>
  );
}

/** A KPI value in its own unit. `months` spells the unit out because a bare
 *  number beside a rupee tile is read as rupees. */
function kpiValue(v: number, unit: Kpi["unit"]): string {
  if (unit === "inr") return inr(v);
  if (unit === "pct") return pct(v);
  if (unit === "months") return v + (v === 1 ? " month" : " months");
  return v.toLocaleString("en-IN");
}

/** The movement, toned by `goodDirection` and never described in words. A
 *  falling burn and a falling MRR are the same arrow and opposite news; the
 *  colour carries that and the tip states which way is good. */
function Movement({ k, priorLabel }: { k: Kpi; priorLabel: string | null }) {
  if (k.value === null) return null;
  if (k.prior === null) return <div className="s faint">no prior figure is derived for this metric</div>;
  const d = delta(k.value, k.prior);
  const tone = d.tone === "mute" ? "flat"
    : (d.tone === "up") === (k.goodDirection === "up") ? "good" : "poor";
  return (
    <div className="s">
      <span className={"fin-kd " + tone}>{d.text}</span>
      {priorLabel ? <> against {priorLabel}</> : null}
    </div>
  );
}

/** One decision metric. A null value prints its own reason, never a zero and
 *  never a dash — `runway` and `cac` return null on purpose, and a placeholder
 *  in either is a decision made on a wrong number. */
function KpiTile({ k, priorLabel }: { k: Kpi; priorLabel: string | null }) {
  if (k.value === null) {
    return (
      <div className="fin-mt na">
        <div className="k">{k.label}<KpiTip k={k.key} /></div>
        <p className="fin-na">{k.why || "The inputs this metric needs are not in these records."}</p>
        <div className="s">not computed — and not zero</div>
      </div>
    );
  }
  return (
    <div className="fin-mt">
      <div className="k">{k.label}<KpiTip k={k.key} /></div>
      <div className="v">{kpiValue(k.value, k.unit)}</div>
      <Movement k={k} priorLabel={priorLabel} />
    </div>
  );
}

/* ============================================================ overview === */

function Overview() {
  const tiles = useOverviewTiles();
  const o = useOverview();
  const months = useMonthPoints();
  const tags = useTagTotals();
  const recon = useReconciliation();
  const matched = useMatchedPct();
  const tax = useTaxSummary();
  const activity = useActivity(12);

  /* Zero-spend tags are dropped rather than drawn as empty tracks. A tag with
     nothing against it this month is not a small bar, it is not a bar. */
  const spendRows: BarRow[] = tags.rows.filter((r) => r.spentPaise > 0).map((r) => ({
    key: r.tag.tagKey,
    label: <TagChip k={r.tag.tagKey} />,
    value: rupees(r.spentPaise),
    hint: <>{r.n} payment{r.n === 1 ? "" : "s"} · {r.pctOfBudget === null ? "no budget" : r.pctOfBudget + "% of budget"}</>,
    title: r.tag.label + ": " + inr(r.spentPaise) + " over " + r.n + " payment"
      + (r.n === 1 ? "" : "s") + " in " + PERIOD.label + ". Rolls up as "
      + r.tag.kind + (r.overBudget ? ". Over the budget set on this tag." : "."),
  }));

  return (
    <Blocks>
      {/* ==================================================== the strip === */}
      <Block wide title={"The money · " + PERIOD.label}
        desc="collected, spent, returned — and what has not arrived"
        right={<span className="fin-sum">as of <b>{fmtDate(todayIso())}</b></span>}
        foot={<>Every tile carries its formula and its caution behind the <b>i</b>. They are not
          interchangeable: <em>collected</em> is money that arrived, <em>due next 30 days</em> is
          money that has not, and <em>net</em> is a cash figure and never the word profit.</>}>
        <div className="fin-money-strip">
          {tiles.map((t) => <MoneyTile key={t.key} t={t} />)}
        </div>
      </Block>

      {/* ================================================ money over time === */}
      <Block wide title="Money over time"
        desc="read it as one question: is the gap between the first bar and the other two widening?"
        right={<span className="fin-sum">
          {months.length} month{months.length === 1 ? "" : "s"} in these records
        </span>}
        foot={<>Grouped off one baseline, never stacked — salary and other spend are two costs,
          not two parts of one, and stacking them would claim they sum to a total this module
          does not compute. The axis is in thousands so the ticks stay readable at 38 pixels of
          gutter; every exact amount is on the strip above and on the record that produced it.
          Months come from the records themselves, so a month with nothing in it is absent
          rather than drawn as a zero.</>}>
        {months.length ? (
          <ColumnChart series={FLOW} labelSeries="collected"
            points={months.map((m) => ({
              key: m.month,
              label: fmtMonth(m.month),
              values: {
                collected: thousands(m.subscriptionsPaise),
                salary: thousands(m.salaryPaise),
                spend: thousands(m.otherOutPaise),
              },
            }))}
            unit="₹ thousand · hover or tab a month for all three" />
        ) : (
          <Unavailable title="No month has anything in it yet."
            why="This series is built from the records, not from a calendar. It appears the moment
              a payment, a paid salary run or a transaction carries a value date." />
        )}
      </Block>

      {/* ================================================ where it went === */}
      <Block title="Where the money went" desc={"spend by tag · " + PERIOD.label}
        right={<span className="fin-sum">{inr(tags.totalPaise)} out</span>}
        foot={<>One hue for every bar: tags are names, not an order, and shading them by size
          would say the bar length twice. The bar is exact rupees, so a small tag is small rather
          than rounded away. Where a tag lands — fixed, reinvestment, variable or excluded — is
          chosen when the tag is created and is what CAC and the operating picture read.</>}>
        {spendRows.length
          ? <BarRows rows={spendRows} unit={"₹ · money out under each tag in " + PERIOD.label} />
          : <Unavailable title="Nothing was spent under any tag in this period."
              why="Only recorded transactions with direction out appear here. An empty list is a
                month with no outgoing transaction recorded against it, not a missing figure." />}
      </Block>

      {/* ============================================= not collected === */}
      <Block title="What is not collected"
        desc="the money that did not arrive, and the money that has not arrived yet"
        foot={<>These two are never added. The first has happened — a gateway declined or a due
          date passed, and every rupee of it carries the evidence on its installment. The second
          has not happened at all and is not revenue. Chasing a failure belongs to another module;
          Finance records the fact and links out to it.
          <Assumed id="FN-OD-15" /></>}>
        <div className="fin-two">
          <div className="fin-mt bad">
            <div className="k">Fail to pay<MetricTip k="failed" /></div>
            <div className="v">{inr(o.failedPaise)}</div>
            <div className="s">
              {o.failedN} installment{o.failedN === 1 ? "" : "s"} did not clear · uncollected, not written off
            </div>
          </div>
          <div className="fin-mt mute">
            <div className="k">Due next 30 days<MetricTip k="due_next" /></div>
            <div className="v">{inr(o.dueNextPaise)}</div>
            <div className="s">
              {o.dueNextN} installment{o.dueNextN === 1 ? "" : "s"} fall due · expected, not earned
            </div>
          </div>
        </div>
        <div className="fin-actions">
          <button className="btn" onClick={() => go("#/finance?flag=failed")}>
            <Icon name="alert" size="sm" />Open the {o.failedN} that failed
          </button>
          <button className="btn sm" onClick={() => go("#/finance?flag=due")}>
            <Icon name="clock" size="sm" />Open what is due
          </button>
        </div>
      </Block>

      {/* ================================================ matched to bank === */}
      <Block wide title="Matched to bank"
        desc="how much of what the bank shows, the records explain"
        right={recon.stmt
          ? <span className="fin-sum">
              {recon.stmt.closed ? "window closed" : "window open"} · <b className="mono">{recon.stmt.stmtId}</b>
            </span>
          : null}
        foot={<>Completeness, never correctness. A high figure says the records and the bank agree
          on <em>what exists</em>; it says nothing about whether a row was tagged right, and a
          perfectly matched statement full of mis-tagged spend would still read 100%. A window
          cannot be closed while a line is unexplained — not a warning and not a confirm, because
          &ldquo;close anyway&rdquo; is how a hole becomes permanent.
          <Assumed id="FN-OD-02" /></>}>
        {recon.stmt ? (
          <>
            <div className="fin-money-strip">
              <div className="fin-mt">
                <div className="k">Matched to bank<MetricTip k="matched" /></div>
                {matched === null
                  ? <p className="fin-na">No imported statement carries a line, so there is nothing to match against.</p>
                  : <div className="v">{pct(matched)}</div>}
                <div className="s">across every imported statement</div>
              </div>
              <div className="fin-mt">
                <div className="k">This window</div>
                <div className="v">{recon.matchedN} of {recon.lines.length}</div>
                <div className="s">
                  {fmtDate(recon.stmt.from)} – {fmtDate(recon.stmt.to)} · imported {ago(recon.stmt.importedAt)}
                </div>
              </div>
              <div className={"fin-mt " + (recon.bankOnly.length ? "bad" : "ok")}>
                <div className="k">No record explains it</div>
                <div className="v">{recon.bankOnly.length}</div>
                <div className="s">
                  {recon.bankOnly.length
                    ? <>net effect <Money paise={recon.variancePaise} /> · the window cannot close</>
                    : "every line on this statement ties to a record"}
                </div>
              </div>
              <div className="fin-mt mute">
                <div className="k">Account</div>
                <div className="v">{accountOf(recon.stmt.accountId)?.name || recon.stmt.accountId}</div>
                <div className="s mono">{accountOf(recon.stmt.accountId)?.masked || "—"}</div>
              </div>
            </div>

            {recon.bankOnly.length ? (
              <>
              <p className="fin-fine">
                On the statement, explained by nothing. Each one is either money that moved and
                nobody recorded, or a record whose reference does not match what the bank printed —
                and the two are fixed in opposite directions, so neither is guessed at here.
              </p>
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
              </>
            ) : (
              <p className="fin-fine">
                Every line in this window points at a payment or a transaction. Bank reconciliation
                lives here now rather than in a tab of its own — it is a reading of the four record
                types, not a fifth thing to maintain.
              </p>
            )}
          </>
        ) : (
          <Unavailable title="No statement has been imported."
            why="Matching is a reading of an imported statement against the records. Without a
              statement there is nothing to read, and a completeness figure computed from no bank
              lines would be 100% for the wrong reason." />
        )}
      </Block>

      {/* ========================================================== tax === */}
      <Block title="Tax summary" desc={"invoiced on installments paid in " + PERIOD.label}
        right={<span className="fin-sum">{tax.n} invoice{tax.n === 1 ? "" : "s"}</span>}
        foot={<>This is a summary of what was invoiced. It is not a GST return, it nets no input
          credit and filing it is not something this module does. The sales chain raises one tax
          invoice per installment, so a single subscription appears here as several invoices —
          shown plainly rather than merged into one line that would not tie to anything.
          <Assumed id="FN-OD-08" />
          <Assumed id="FN-OD-14" /></>}>
        <div className="fin-summary">
          <div className="row"><span className="l">Taxable value</span><span className="tnum">{inr(tax.taxablePaise)}</span></div>
          <div className="row"><span className="l">CGST</span><span className="tnum">{inr(tax.cgstPaise)}</span></div>
          <div className="row"><span className="l">SGST</span><span className="tnum">{inr(tax.sgstPaise)}</span></div>
          <div className="row"><span className="l">IGST</span><span className="tnum">{inr(tax.igstPaise)}</span></div>
          <div className="row grand"><span className="l">Total tax invoiced</span><span className="tnum">{inr(tax.totalTaxPaise)}</span></div>
        </div>
      </Block>

      {/* ===================================================== activity === */}
      <Block title="Just happened" desc="the last twelve writes, newest first"
        foot={<>The write log is the module's own record of what changed, in order, with who did
          it. It is not the event history on a record — that lives on the record and survives.</>}>
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
            why="The seed is what happened before this tab was opened; this list is what happens
              inside it. Record a payment, pay a salary run, resolve a bank line or settle a refund
              and it fills from the top — with the actor and the reason, because a change nobody
              can attribute is not much of a record." />
        )}
      </Block>
    </Blocks>
  );
}

/* ================================================================= KPI === */

function Kpis() {
  const list = useKpis();
  const months = useMonthPoints();

  /* Which month a `prior` is measured against, so a movement is never an
     unlabelled arrow. Derived from the same month series the chart draws. */
  const here = months.findIndex((m) => m.month === PERIOD.key);
  const priorLabel = here > 0 ? fmtMonth(months[here - 1].month) : null;

  /* Grouped in the order the store returns them — Revenue, Cost, Health,
     Growth is the order money moves, and hard-coding the list here would let
     a new KPI go missing from the page without anything failing. */
  const order: string[] = [];
  const byGroup: Record<string, Kpi[]> = {};
  list.forEach((k) => {
    if (!byGroup[k.group]) { byGroup[k.group] = []; order.push(k.group); }
    byGroup[k.group].push(k);
  });

  return (
    <Blocks>
      {order.map((g) => (
        <Block key={g} title={g}
          desc={GROUP_DECIDES[g] ? "decides " + GROUP_DECIDES[g] : "read together"}
          right={<span className="fin-sum">{PERIOD.label}</span>}>
          <div className="fin-money-strip">
            {byGroup[g].map((k) => <KpiTile key={k.key} k={k} priorLabel={priorLabel} />)}
          </div>
        </Block>
      ))}

      {/* ================================================ what is missing === */}
      <Block wide title="What these deliberately do not tell you"
        desc="stated here rather than discovered later in a board meeting"
        foot={<>None of the three is an oversight. Each one needs an input this module does not
          hold, and every one of them would be easy to fake with a plausible number — which is
          exactly why they are not.</>}>
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

      <Notice tone="info" ico="chart">
        <b>Analytics is not a fifth record type.</b> Every figure below is the four lists read
        back — subscriptions, salaries, other transactions, refunds — through one derivation each.
        There is no separate analytics store to fall out of step, which is why nothing here can
        disagree with a tab: change a record and this page changes in the same read.
      </Notice>

      {tab === "kpi" ? <Kpis /> : <Overview />}
    </Frame>
  );
}
