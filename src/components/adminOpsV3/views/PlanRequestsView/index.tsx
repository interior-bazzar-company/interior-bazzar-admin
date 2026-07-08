// ── PlanRequestsView ── admin Plan Requests (promptsadmin task 35). List +
// approve/reject (stage). Data: /api/v1/admin/plan-requests/.
import { useEffect, useState } from "react";
import styles from "../shared.module.css";
import AdminOpsService from "../../../../api/modules/adminOps";

interface PR { id: number; plan: string; name: string; email: string; phone: string; state: string; stage: string; createdAt: string; }

const PlanRequestsView = () => {
  const [rows, setRows] = useState<PR[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string>("");
  const load = () => { setLoading(true); AdminOpsService.planRequests().then((r) => { if (r?.response) setRows(r.data.requests || []); }).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  const setStage = async (id: number, stage: string) => { const r = await AdminOpsService.setPlanRequestStage(id, stage).catch(() => null); if (r?.response) load(); else setNotice("Could not update."); };

  return (
    <div>
      <div className={styles.head}><h1>Plan Requests</h1><p>Enquiries to buy a plan. Approve to advance, or reject.</p></div>
      {notice && <div className={`${styles.notice} ${styles.err}`}>{notice}</div>}
      {loading ? <div className={styles.empty}>Loading requests…</div> : rows.length === 0 ? <div className={styles.empty}>No plan requests.</div> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Name</th><th>Plan</th><th>Contact</th><th>State</th><th>Stage</th><th></th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>{p.name || "—"}</td><td>{p.plan || "—"}</td><td>{p.phone || p.email || "—"}</td><td>{p.state || "—"}</td>
                  <td><span className={styles.pill}>{p.stage || "—"}</span></td>
                  <td className={styles.actions}>
                    <button type="button" className={styles.grant} onClick={() => setStage(p.id, "4")}>Approve</button>
                    <button type="button" className={styles.del} onClick={() => setStage(p.id, "rejected")}>Reject</button>
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

export default PlanRequestsView;
