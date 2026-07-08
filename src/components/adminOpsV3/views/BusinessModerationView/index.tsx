// ── BusinessModerationView ── Catalog & Trust > Businesses Moderation (task 18).
// 6-column view: Business / Category / City / Catalog / Reviews / Profile score.
import styles from "../shared.module.css";
import useBusinessModerationView from "./useBusinessModerationView";

// Profile-completeness colour thresholds (prototype catBizView).
const scoreColor = (s: number) => (s >= 70 ? "#085041" : s >= 40 ? "#ba7517" : "#b3401f");

const BusinessModerationView = () => {
  const v = useBusinessModerationView();

  return (
    <div>
      <div className={styles.head}>
        <div>
          <h1>Businesses Moderation</h1>
          <p>Profile completeness and catalog/review depth across sellers.</p>
        </div>
        <div className={styles.search}>
          <input placeholder="Search business…" value={v.search} onChange={(e) => v.setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && v.doSearch()} />
          <button type="button" onClick={v.doSearch}>Search</button>
        </div>
      </div>

      {v.loading ? <div className={styles.empty}>Loading…</div> : v.rows.length === 0 ? <div className={styles.empty}>No businesses found.</div> : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Business</th><th>Category</th><th>City</th><th>Catalog</th><th>Reviews</th><th>Profile score</th></tr></thead>
              <tbody>
                {v.rows.map((b) => (
                  <tr key={b.id}>
                    <td>{b.businessName || "—"}</td>
                    <td>{b.category || "—"}</td>
                    <td>{b.city || "—"}</td>
                    <td>{b.catalogCount}</td>
                    <td>{b.reviewCount}</td>
                    <td>
                      <div className={styles.scoreCell}>
                        <span className={styles.hbarTrack}>
                          <span className={styles.hbarFill} style={{ width: `${b.profileScore}%`, background: scoreColor(b.profileScore) }} />
                        </span>
                        <span className={styles.scorePct} style={{ color: scoreColor(b.profileScore) }}>{b.profileScore}%</span>
                      </div>
                    </td>
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

export default BusinessModerationView;
