// ── ReportsView ── admin Reported Listings (port of prototype reportsView).
// Status tabs + resolve/dismiss. Data: /api/v1/admin/reports/.
import styles from "../shared.module.css";
import useReportsView, { REPORT_TABS } from "./useReportsView";

const ReportsView = () => {
  const v = useReportsView();

  return (
    <div>
      <div className={styles.head}>
        <h1>Reported Listings</h1>
        <p>User-submitted reports against businesses and listings.</p>
      </div>

      {v.notice && <div className={`${styles.notice} ${v.notice.kind === "ok" ? styles.ok : styles.err}`}>{v.notice.msg}</div>}

      <div className={styles.tabs}>
        {REPORT_TABS.map((t) => (
          <button key={t} type="button" className={`${styles.tab} ${v.tab === t ? styles.tabActive : ""}`} onClick={() => v.setTab(t)}>{t}</button>
        ))}
      </div>

      {v.loading ? (
        <div className={styles.empty}>Loading reports…</div>
      ) : v.rows.length === 0 ? (
        <div className={styles.empty}>No {v.tab} reports.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Target</th><th>Reason</th><th>Reporter</th><th>When</th><th></th></tr></thead>
            <tbody>
              {v.rows.map((r) => (
                <tr key={r.id}>
                  <td className={styles.mono}>{r.targetType}#{r.targetId}</td>
                  <td style={{ maxWidth: 320 }}>{r.reason}</td>
                  <td>{r.reporter || r.reporterEmail || "anonymous"}</td>
                  <td>{r.createdAt ? r.createdAt.slice(0, 10) : "—"}</td>
                  <td className={styles.actions}>
                    {v.tab === "open" && (
                      <>
                        <button type="button" className={styles.grant} onClick={() => v.resolve(r.id, "resolved")}>Resolve</button>
                        <button type="button" className={styles.del} onClick={() => v.resolve(r.id, "dismissed")}>Dismiss</button>
                      </>
                    )}
                    {v.tab !== "open" && r.resolver && <span style={{ fontSize: 12, color: "#6b7280" }}>by {r.resolver}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ReportsView;
