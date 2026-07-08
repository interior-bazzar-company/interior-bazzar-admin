// ── SubsView ── admin Subscriptions (promptsadmin task 20). Aggregates the four
// plan families. Data: /api/v1/admin/subs/. ponytail: thin read-list, single file.
import { useEffect, useState } from "react";
import styles from "../shared.module.css";
import AdminOpsService from "../../../../api/modules/adminOps";

interface Sub { id: number; family: string; amount: string; status: string; isActive: boolean; user: string | null; expireDate: string | null; }

const SubsView = () => {
  const [rows, setRows] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { AdminOpsService.subs().then((r) => { if (r?.response) setRows(r.data.subs || []); }).catch(() => {}).finally(() => setLoading(false)); }, []);

  return (
    <div>
      <div className={styles.head}><h1>Subscriptions</h1><p>Active and past plans across business, shop, architect and automation families.</p></div>
      {loading ? <div className={styles.empty}>Loading subscriptions…</div> : rows.length === 0 ? <div className={styles.empty}>No subscriptions found.</div> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>User</th><th>Family</th><th>Amount</th><th>Status</th><th>Expires</th></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={`${s.family}-${s.id}`}>
                  <td>{s.user || "—"}</td>
                  <td style={{ textTransform: "capitalize" }}>{s.family}</td>
                  <td>₹{s.amount || "0"}</td>
                  <td><span className={`${styles.pill} ${s.isActive ? styles.on : styles.off}`}>{s.status || "—"}</span></td>
                  <td>{s.expireDate ? s.expireDate.slice(0, 10) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SubsView;
