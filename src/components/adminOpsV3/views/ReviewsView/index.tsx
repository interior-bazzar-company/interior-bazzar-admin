// ── ReviewsView ── admin Reviews & Q&A moderation (task 30 + master task 19).
// Reviews (latest first, with Date) + a real per-shop Q&A panel (ShopQuestion).
// Data: /api/v1/admin/reviews/ and /api/v1/admin/reviews/qa/.
import { useEffect, useState } from "react";
import styles from "../shared.module.css";
import AdminOpsService from "../../../../api/modules/adminOps";

interface Review {
  id: number; rating: number; title: string; body: string; author: string | null;
  business: string | null; date: string | null; isApproved: boolean;
}
interface Question {
  id: number; business: string | null; question: string; answer: string;
  askedBy: string; date: string | null; isActive: boolean;
}

const day = (d: string | null) => (d ? d.slice(0, 10) : "—");

const ReviewsView = () => {
  const [rows, setRows] = useState<Review[]>([]);
  const [qa, setQa] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string>("");

  const load = async () => {
    setLoading(true);
    const [r, q] = await Promise.all([
      AdminOpsService.reviews().catch(() => null),
      AdminOpsService.reviewsQA().catch(() => null),
    ]);
    if (r?.response) setRows(r.data.reviews || []);
    if (q?.response) setQa(q.data.questions || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const hide = async (id: number) => { const r = await AdminOpsService.hideReview(id).catch(() => null); if (r?.response) load(); else setNotice("Could not update review."); };
  const hideQ = async (id: number) => { const r = await AdminOpsService.hideQuestion(id).catch(() => null); if (r?.response) load(); else setNotice("Could not update question."); };

  return (
    <div>
      <div className={styles.head}><h1>Reviews &amp; Q&amp;A</h1><p>Moderate customer reviews and shop Q&amp;A. Hidden entries are not shown publicly.</p></div>
      {notice && <div className={`${styles.notice} ${styles.err}`}>{notice}</div>}

      {loading ? <div className={styles.empty}>Loading…</div> : (
        <>
          <h3 className={styles.sliderGroupHead}>Reviews</h3>
          {rows.length === 0 ? <div className={styles.empty}>No reviews.</div> : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Business</th><th>Stars</th><th>Author</th><th>Content</th><th>Date</th><th>Visible</th><th></th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.business || "—"}</td>
                      <td>{"★".repeat(r.rating)}{"☆".repeat(Math.max(0, 5 - r.rating))}</td>
                      <td>{r.author || "—"}</td>
                      <td style={{ maxWidth: 320 }}>{r.title ? <b>{r.title}. </b> : null}{r.body}</td>
                      <td>{day(r.date)}</td>
                      <td><span className={`${styles.pill} ${r.isApproved ? styles.on : styles.off}`}>{r.isApproved ? "Shown" : "Hidden"}</span></td>
                      <td className={styles.actions}><button type="button" className={styles.edit} onClick={() => hide(r.id)}>{r.isApproved ? "Hide" : "Show"}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 className={styles.sliderGroupHead}>Q&amp;A</h3>
          {qa.length === 0 ? <div className={styles.empty}>No questions.</div> : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Business</th><th>Question</th><th>Answer</th><th>Asked by</th><th>Date</th><th>Visible</th><th></th></tr></thead>
                <tbody>
                  {qa.map((q) => (
                    <tr key={q.id}>
                      <td>{q.business || "—"}</td>
                      <td style={{ maxWidth: 260 }}>{q.question}</td>
                      <td style={{ maxWidth: 260 }}>{q.answer || <span style={{ color: "#9ca3af" }}>— unanswered</span>}</td>
                      <td>{q.askedBy || "—"}</td>
                      <td>{day(q.date)}</td>
                      <td><span className={`${styles.pill} ${q.isActive ? styles.on : styles.off}`}>{q.isActive ? "Shown" : "Hidden"}</span></td>
                      <td className={styles.actions}><button type="button" className={styles.edit} onClick={() => hideQ(q.id)}>{q.isActive ? "Hide" : "Show"}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReviewsView;
