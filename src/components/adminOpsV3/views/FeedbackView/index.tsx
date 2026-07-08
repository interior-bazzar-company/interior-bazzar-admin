// ── FeedbackView ── admin User Feedback triage (task 34 + master task 23).
// 3-state tab board: New → Reviewing → Closed. UI only; logic in useFeedbackView.
import styles from "../shared.module.css";
import useFeedbackView, { FEEDBACK_TABS, TAB_ACTIONS, renderFeedback, type FeedbackTab } from "./useFeedbackView";

const FeedbackView = () => {
  const v = useFeedbackView();
  const tab = v.tab as FeedbackTab;
  const actions = TAB_ACTIONS[tab] ?? [];

  return (
    <div>
      <div className={styles.head}><h1>User Feedback</h1><p>Feedback submitted by users. Triage: New → Reviewing → Closed.</p></div>

      {v.notice && <div className={`${styles.notice} ${v.notice.kind === "ok" ? styles.ok : styles.err}`}>{v.notice.msg}</div>}

      <div className={styles.tabs}>
        {FEEDBACK_TABS.map((t) => (
          <button key={t} type="button" className={`${styles.tab} ${v.tab === t ? styles.tabActive : ""}`} onClick={() => v.setTab(t)} style={{ textTransform: "capitalize" }}>{t}</button>
        ))}
      </div>

      {v.loading ? (
        <div className={styles.empty}>Loading feedback…</div>
      ) : v.rows.length === 0 ? (
        <div className={styles.empty}>No {tab} feedback.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>From</th><th>Feedback</th><th>When</th><th></th></tr></thead>
            <tbody>
              {v.rows.map((f) => (
                <tr key={f.id}>
                  <td>{f.user || f.contact || "Anonymous"}</td>
                  <td style={{ maxWidth: 420 }}>{renderFeedback(f.feedback)}</td>
                  <td>{f.createdAt ? f.createdAt.slice(0, 10) : "—"}</td>
                  <td className={styles.actions}>
                    {actions.map((a) => (
                      <button key={a.status} type="button" className={styles[a.kind]} onClick={() => v.setStatus(f.id, a.status)}>{a.label}</button>
                    ))}
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

export default FeedbackView;
