// ── ReviewsView ── admin Reviews & Q&A moderation (promptsadmin task 30).
// List + hide/show toggle. Data: /api/v1/admin/reviews/.
import { useEffect, useState } from "react";
import styles from "../shared.module.css";
import AdminOpsService from "../../../../api/modules/adminOps";

interface Review { id: number; rating: number; title: string; body: string; reviewer: string | null; business: string | null; isApproved: boolean; }

const ReviewsView = () => {
  const [rows, setRows] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string>("");

  const load = () => { setLoading(true); AdminOpsService.reviews().then((r) => { if (r?.response) setRows(r.data.reviews || []); }).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const hide = async (id: number) => { const r = await AdminOpsService.hideReview(id).catch(() => null); if (r?.response) load(); else setNotice("Could not update review."); };

  return (
    <div>
      <div className={styles.head}><h1>Reviews &amp; Q&amp;A</h1><p>Moderate customer reviews. Hidden reviews are not shown publicly.</p></div>
      {notice && <div className={`${styles.notice} ${styles.err}`}>{notice}</div>}
      {loading ? <div className={styles.empty}>Loading reviews…</div> : rows.length === 0 ? <div className={styles.empty}>No reviews.</div> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Rating</th><th>Review</th><th>By</th><th>Business</th><th>Visible</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{"★".repeat(r.rating)}{"☆".repeat(Math.max(0, 5 - r.rating))}</td>
                  <td style={{ maxWidth: 320 }}>{r.title ? <b>{r.title}. </b> : null}{r.body}</td>
                  <td>{r.reviewer || "—"}</td>
                  <td>{r.business || "—"}</td>
                  <td><span className={`${styles.pill} ${r.isApproved ? styles.on : styles.off}`}>{r.isApproved ? "Shown" : "Hidden"}</span></td>
                  <td className={styles.actions}><button type="button" className={styles.edit} onClick={() => hide(r.id)}>{r.isApproved ? "Hide" : "Show"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ReviewsView;
