// ── FeedbackView ── admin User Feedback triage (promptsadmin task 34).
// List + mark-viewed. Data: /api/v1/admin/feedback/.
import { useEffect, useState } from "react";
import styles from "../shared.module.css";
import AdminOpsService from "../../../../api/modules/adminOps";

interface FB { id: number; contact: string; feedback: string; status: string; user: string | null; createdAt: string; }

const FeedbackView = () => {
  const [rows, setRows] = useState<FB[]>([]);
  const [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); AdminOpsService.feedback().then((r) => { if (r?.response) setRows(r.data.feedback || []); }).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  const mark = async (id: number) => { const r = await AdminOpsService.setFeedbackStatus(id, "viewed").catch(() => null); if (r?.response) load(); };

  return (
    <div>
      <div className={styles.head}><h1>User Feedback</h1><p>Feedback submitted by users. Mark items as viewed once triaged.</p></div>
      {loading ? <div className={styles.empty}>Loading feedback…</div> : rows.length === 0 ? <div className={styles.empty}>No feedback yet.</div> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>From</th><th>Contact</th><th>Feedback</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.id}>
                  <td>{f.user || "—"}</td><td>{f.contact}</td><td style={{ maxWidth: 340 }}>{f.feedback}</td>
                  <td><span className={styles.pill}>{f.status || "new"}</span></td>
                  <td className={styles.actions}><button type="button" className={styles.edit} onClick={() => mark(f.id)}>Mark viewed</button></td>
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
