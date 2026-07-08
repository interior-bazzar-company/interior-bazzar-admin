// ── WebView ── admin Website Analytics (promptsadmin task 27). Read-only KPI
// tiles from real counts. Data: /api/v1/admin/web-analytics/.
import { useEffect, useState } from "react";
import styles from "../shared.module.css";
import AdminOpsService from "../../../../api/modules/adminOps";

interface Web { totalUsers: number; buyers: number; businesses: number; verifiedBusinesses: number; leads: number; blogs: number; }

const WebView = () => {
  const [d, setD] = useState<Web | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { AdminOpsService.webAnalytics().then((r) => { if (r?.response) setD(r.data); }).catch(() => {}).finally(() => setLoading(false)); }, []);

  const tiles: Array<[string, number | undefined]> = [
    ["Total users", d?.totalUsers], ["Buyers", d?.buyers], ["Businesses", d?.businesses],
    ["Verified businesses", d?.verifiedBusinesses], ["Leads", d?.leads], ["Blog posts", d?.blogs],
  ];

  return (
    <div>
      <div className={styles.head}><h1>Website Analytics</h1><p>Platform totals, computed live from real records.</p></div>
      {loading ? <div className={styles.empty}>Loading analytics…</div> : (
        <div className={styles.kpis}>
          {tiles.map(([label, val]) => (
            <div key={label} className={styles.kpi}><div className={styles.val}>{val ?? "—"}</div><div className={styles.lbl}>{label}</div></div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WebView;
