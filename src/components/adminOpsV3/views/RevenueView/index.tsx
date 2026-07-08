// ── RevenueView ── admin Revenue & Unit Economics (port of prototype revenueView).
// KPI tiles from real payments + expense list + add-expense. Data: /api/v1/admin/revenue/.
import styles from "../shared.module.css";
import useRevenueView from "./useRevenueView";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

const RevenueView = () => {
  const v = useRevenueView();

  return (
    <div>
      <div className={styles.head}>
        <h1>Revenue &amp; Unit Economics</h1>
        <p>Computed from real payments (PAID transactions less refunds) and logged expenses.</p>
      </div>

      {v.notice && <div className={`${styles.notice} ${v.notice.kind === "ok" ? styles.ok : styles.err}`}>{v.notice.msg}</div>}

      {v.loading ? (
        <div className={styles.empty}>Loading revenue…</div>
      ) : !v.data ? (
        <div className={styles.empty}>No revenue data available.</div>
      ) : (
        <>
          <div className={styles.kpis}>
            <div className={styles.kpi}><div className={styles.val}>{inr(v.data.netRevenue)}</div><div className={styles.lbl}>Net revenue</div></div>
            <div className={styles.kpi}><div className={styles.val}>{inr(v.data.mrr)}</div><div className={styles.lbl}>MRR (proxy)</div></div>
            <div className={styles.kpi}><div className={styles.val}>{v.data.payingCustomers}</div><div className={styles.lbl}>Paying customers</div></div>
            <div className={styles.kpi}><div className={styles.val}>{inr(v.data.cac)}</div><div className={styles.lbl}>CAC</div></div>
            <div className={styles.kpi}><div className={styles.val}>{inr(v.data.expensesTotal)}</div><div className={styles.lbl}>Expenses</div></div>
            <div className={styles.kpi}><div className={styles.val}>{inr(v.data.net)}</div><div className={styles.lbl}>Net (after expenses)</div></div>
          </div>

          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "8px 0 12px" }}>Expenses</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Label</th><th>Category</th><th>Amount</th><th>Date</th></tr></thead>
              <tbody>
                {v.data.expenses.length === 0 ? (
                  <tr><td colSpan={4} style={{ color: "#9ca3af" }}>No expenses logged yet.</td></tr>
                ) : v.data.expenses.map((e) => (
                  <tr key={e.id}>
                    <td>{e.label}</td><td>{e.category || "—"}</td><td>{inr(e.amount)}</td>
                    <td>{e.incurredAt ? e.incurredAt.slice(0, 10) : "—"}</td>
                  </tr>
                ))}
                <tr>
                  <td><input className={styles.num} style={{ width: 180 }} placeholder="expense label" value={v.label} onChange={(e) => v.setLabel(e.target.value)} /></td>
                  <td><input className={styles.num} style={{ width: 120 }} placeholder="category" value={v.category} onChange={(e) => v.setCategory(e.target.value)} /></td>
                  <td><input className={styles.num} placeholder="0" value={v.amount} onChange={(e) => v.setAmount(e.target.value)} /></td>
                  <td><button type="button" className={styles.save} disabled={v.saving} onClick={v.addExpense}>{v.saving ? "…" : "Add"}</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default RevenueView;
