// ── RevenueView ── admin Revenue & Unit Economics (task 28 + master task 17).
// Real MRR/ARPU/family/monthly + P&L waterfall + tunable (est.) LTV/CAC/payback.
// UI only; logic in useRevenueView.
import styles from "../shared.module.css";
import useRevenueView from "./useRevenueView";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

const RevenueView = () => {
  const v = useRevenueView();
  const d = v.data;

  const bars = (rows: Array<{ label: string; amount: number }>) => {
    const max = Math.max(1, ...rows.map((r) => r.amount));
    return (
      <div className={styles.hbars}>
        {rows.length === 0 ? <div className={styles.empty}>No data.</div> : rows.map((r) => (
          <div key={r.label} className={styles.hbarRow}>
            <span className={styles.hbarLabel}>{r.label}</span>
            <span className={styles.hbarTrack}><span className={styles.hbarFill} style={{ width: `${(r.amount / max) * 100}%` }} /></span>
            <span className={styles.hbarVal}>{inr(r.amount)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div className={styles.head}>
        <div>
          <h1>Revenue &amp; Unit Economics</h1>
          <p>Real revenue from payments &amp; active plans. Cards marked (est.) derive from the editable assumptions below. Date range scopes gross/family/expenses; MRR/ARPU and the 6-month trend stay all-time.</p>
        </div>
        <div className={styles.search}>
          <input type="date" value={v.start} onChange={(e) => v.setStart(e.target.value)} aria-label="Start date" />
          <input type="date" value={v.end} onChange={(e) => v.setEnd(e.target.value)} aria-label="End date" />
        </div>
      </div>

      {v.notice && <div className={`${styles.notice} ${v.notice.kind === "ok" ? styles.ok : styles.err}`}>{v.notice.msg}</div>}

      {v.loading ? <div className={styles.empty}>Loading revenue…</div>
        : v.error || !d ? <div className={styles.empty}>Couldn't load revenue — check your access or try again.</div>
        : (
        <>
          <div className={styles.kpis}>
            <div className={styles.kpi}><div className={styles.val}>{inr(d.mrr)}</div><div className={styles.lbl}>MRR (equivalent)</div></div>
            <div className={styles.kpi}><div className={styles.val}>{inr(d.arpu)}</div><div className={styles.lbl}>ARPU · {d.activeSubscribers} active</div></div>
            <div className={styles.kpi}><div className={styles.val}>{inr(d.salesThisMonth)}</div><div className={styles.lbl}>Sales this month {d.momDeltaPct >= 0 ? "▲" : "▼"} {Math.abs(d.momDeltaPct)}%</div></div>
            <div className={styles.kpi}><div className={styles.val}>{inr(d.ltv)}</div><div className={styles.lbl}>LTV (est.)</div></div>
            <div className={styles.kpi}><div className={styles.val}>{d.ltvCac.toFixed(1)}×</div><div className={styles.lbl}>LTV : CAC (est.)</div></div>
            <div className={styles.kpi}><div className={styles.val}>{d.paybackMonths.toFixed(1)}</div><div className={styles.lbl}>Payback months (est.)</div></div>
          </div>

          {/* P&L waterfall */}
          <div className={styles.panel}>
            <h3 className={styles.sliderGroupHead}>P&amp;L waterfall</h3>
            <div className={styles.funnel}>
              <div className={styles.funnelStep}><div className={styles.funnelVal}>{inr(d.netRevenue)}</div><div className={styles.funnelLabel}>Net sales</div></div>
              <div className={styles.funnelStep}><div className={styles.funnelVal}>−{inr(d.expensesFixed)}</div><div className={styles.funnelLabel}>Fixed</div></div>
              <div className={styles.funnelStep}><div className={styles.funnelVal}>−{inr(d.expensesReinvest)}</div><div className={styles.funnelLabel}>Reinvestment</div></div>
              <div className={styles.funnelStep}><div className={styles.funnelVal}>{inr(d.net)}</div><div className={styles.funnelLabel}>Profit</div></div>
            </div>
          </div>

          <div className={styles.analyticsGrid}>
            {/* 6-month trend */}
            <div className={styles.panel}>
              <h3 className={styles.sliderGroupHead}>6-month revenue trend</h3>
              {(() => {
                const max = Math.max(1, ...d.monthlyRevenue.map((m) => m.amount));
                return (
                  <div className={styles.miniBars}>
                    {d.monthlyRevenue.map((m) => (
                      <div key={m.month} className={styles.miniBarCol} title={`${m.month}: ${inr(m.amount)}`}>
                        <span className={styles.miniBar} style={{ height: `${(m.amount / max) * 100}%` }} />
                        <span className={styles.miniBarLabel}>{m.month.slice(2)}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            {/* Revenue by family */}
            <div className={styles.panel}>
              <h3 className={styles.sliderGroupHead}>Revenue by family</h3>
              <p style={{ color: "#9ca3af", fontSize: 12, margin: "0 0 8px" }}>Plan purchases split by family; payments made before this was tracked show as “PLAN”.</p>
              {bars(d.revenueByFamily)}
            </div>
          </div>

          {/* Revenue target progress */}
          <div className={styles.panel}>
            <h3 className={styles.sliderGroupHead}>Revenue target</h3>
            {d.assumptions.revenueTarget > 0 ? (
              <div className={styles.hbarRow}>
                <span className={styles.hbarLabel}>{inr(d.netRevenue)} / {inr(d.assumptions.revenueTarget)}</span>
                <span className={styles.hbarTrack}><span className={styles.hbarFill} style={{ width: `${Math.min(100, (d.netRevenue / d.assumptions.revenueTarget) * 100)}%` }} /></span>
                <span className={styles.hbarVal}>{Math.round((d.netRevenue / d.assumptions.revenueTarget) * 100)}%</span>
              </div>
            ) : <div className={styles.empty}>Set a revenue target in the assumptions below.</div>}
          </div>

          {/* Expense ledger */}
          <div className={styles.panel}>
            <h3 className={styles.sliderGroupHead}>Expenses</h3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Label</th><th>Category</th><th>Kind</th><th>Amount</th></tr></thead>
                <tbody>
                  {d.expenses.length === 0 ? <tr><td colSpan={4} style={{ color: "#9ca3af" }}>No expenses yet.</td></tr> : d.expenses.map((e) => (
                    <tr key={e.id}><td>{e.label}</td><td>{e.category || "—"}</td><td style={{ textTransform: "capitalize" }}>{e.kind}</td><td>{inr(e.amount)}</td></tr>
                  ))}
                </tbody>
                <tfoot><tr><td colSpan={3} style={{ fontWeight: 700 }}>Total</td><td style={{ fontWeight: 700 }}>{inr(d.expensesTotal)}</td></tr></tfoot>
              </table>
            </div>
            <div className={styles.formGrid} style={{ marginTop: 12 }}>
              <label>Label<input value={v.label} onChange={(e) => v.setLabel(e.target.value)} /></label>
              <label>Amount ₹<input value={v.amount} onChange={(e) => v.setAmount(e.target.value)} /></label>
              <label>Category<input value={v.category} onChange={(e) => v.setCategory(e.target.value)} /></label>
              <label>Kind
                <select value={v.kind} onChange={(e) => v.setKind(e.target.value)}>
                  <option value="fixed">Fixed</option>
                  <option value="reinvestment">Reinvestment</option>
                </select>
              </label>
            </div>
            <div style={{ marginTop: 10 }}><button type="button" className={styles.save} disabled={v.saving} onClick={v.addExpense}>{v.saving ? "Adding…" : "Add expense"}</button></div>
          </div>

          {/* Assumptions editor */}
          <div className={styles.panel}>
            <h3 className={styles.sliderGroupHead}>Assumptions (drive the est. cards)</h3>
            <div className={styles.formGrid}>
              <label>Avg lifetime (months)<input value={v.assume.avgLifetimeMonths} onChange={(e) => v.setAssumeField("avgLifetimeMonths", e.target.value)} /></label>
              <label>Gross margin (0–1)<input value={v.assume.grossMargin} onChange={(e) => v.setAssumeField("grossMargin", e.target.value)} /></label>
              <label>Revenue target ₹<input value={v.assume.revenueTarget} onChange={(e) => v.setAssumeField("revenueTarget", e.target.value)} /></label>
              <label>New customers / month<input value={v.assume.newCustomersThisMonth} onChange={(e) => v.setAssumeField("newCustomersThisMonth", e.target.value)} /></label>
            </div>
            <div style={{ marginTop: 10 }}><button type="button" className={styles.save} disabled={v.savingAssume} onClick={v.saveAssumptions}>{v.savingAssume ? "Saving…" : "Save assumptions"}</button></div>
          </div>
        </>
      )}
    </div>
  );
};

export default RevenueView;
