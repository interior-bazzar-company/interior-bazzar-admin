// ── ReportsView ── admin Reported Listings (task 33 + master task 21).
// 4-state moderation board: Open → Reviewing → Actioned → Dismissed.
import styles from "../shared.module.css";
import useReportsView, { REPORT_TABS, TAB_ACTIONS, type ReportTab } from "./useReportsView";

const ReportsView = () => {
  const v = useReportsView();
  const tab = v.tab as ReportTab;
  const actions = TAB_ACTIONS[tab] ?? [];

  return (
    <div>
      <div className={styles.head}>
        <h1>Reported Listings</h1>
        <p>User-submitted reports. Move each report along the board: Open → Reviewing → Actioned → Dismissed.</p>
      </div>

      {v.notice && <div className={`${styles.notice} ${v.notice.kind === "ok" ? styles.ok : styles.err}`}>{v.notice.msg}</div>}

      <div className={styles.tabs}>
        {REPORT_TABS.map((t) => (
          <button key={t} type="button" className={`${styles.tab} ${v.tab === t ? styles.tabActive : ""}`} onClick={() => v.setTab(t)} style={{ textTransform: "capitalize" }}>{t}</button>
        ))}
      </div>

      {v.loading ? (
        <div className={styles.empty}>Loading reports…</div>
      ) : v.rows.length === 0 ? (
        <div className={styles.empty}>No {tab} reports.</div>
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
                  <td>{(r.updatedAt || r.createdAt || "").slice(0, 10) || "—"}</td>
                  <td className={styles.actions}>
                    {actions.map((a) => (
                      <button key={a.status} type="button" className={styles[a.kind]} onClick={() => v.resolve(r.id, a.status)}>{a.label}</button>
                    ))}
                    {actions.length === 0 && r.resolver && <span style={{ fontSize: 12, color: "#6b7280" }}>by {r.resolver}</span>}
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
