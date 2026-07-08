// ── SubsView ── admin Subscriptions (promptsadmin task 20 + master task 10).
// Family tab row → per-family KPI tiles + a family-scoped paginated subscriber
// list, all from a single /admin/subs/ call. UI only; logic in useSubsView.
import styles from "../shared.module.css";
import useSubsView, { FAMILY_TABS } from "./useSubsView";

const SubsView = () => {
  const v = useSubsView();
  const a = v.analytics;

  return (
    <div>
      <div className={styles.head}>
        <h1>Subscriptions</h1>
        <p>Active and past plans across business, shop, architect and automation families.</p>
      </div>

      <div className={styles.tabs}>
        {FAMILY_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`${styles.tab} ${v.family === t.key ? styles.tabActive : ""}`}
            onClick={() => v.selectFamily(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.kpis}>
        <div className={styles.kpi}><div className={styles.val}>{a.activeCount}</div><div className={styles.lbl}>Active</div></div>
        <div className={styles.kpi}><div className={styles.val}>{a.pendingCount}</div><div className={styles.lbl}>Pending</div></div>
        <div className={styles.kpi}><div className={styles.val}>{a.expiredCount}</div><div className={styles.lbl}>Expired</div></div>
        <div className={styles.kpi}><div className={styles.val}>{a.totalCount}</div><div className={styles.lbl}>Total plans</div></div>
      </div>

      {v.loading ? (
        <div className={styles.empty}>Loading subscriptions…</div>
      ) : v.rows.length === 0 ? (
        <div className={styles.empty}>No subscriptions found.</div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>User</th><th>Entity</th><th>Family</th><th>Plan</th><th>Amount</th><th>Status</th><th>Expires</th></tr>
              </thead>
              <tbody>
                {v.rows.map((s) => (
                  <tr key={`${s.family}-${s.id}`}>
                    <td>{s.user || "—"}</td>
                    <td>{s.entityName || "—"}</td>
                    <td style={{ textTransform: "capitalize" }}>{s.family}</td>
                    <td>{s.planTitle || "—"}</td>
                    <td>₹{s.amount || "0"}</td>
                    <td><span className={`${styles.pill} ${s.isActive ? styles.on : styles.off}`}>{s.status || "—"}</span></td>
                    <td>{s.expireDate ? s.expireDate.slice(0, 10) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {v.pageCount > 1 && (
            <div className={styles.pager}>
              <button type="button" className={styles.tab} disabled={v.pageNo <= 1} onClick={() => v.setPageNo(v.pageNo - 1)}>Prev</button>
              <span className={styles.pagerInfo}>Page {v.pageNo} / {v.pageCount} · {v.total} total</span>
              <button type="button" className={styles.tab} disabled={v.pageNo >= v.pageCount} onClick={() => v.setPageNo(v.pageNo + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SubsView;
