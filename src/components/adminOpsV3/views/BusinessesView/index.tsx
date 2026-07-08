// ── BusinessesView ── admin Businesses table (port of prototype businessesView).
// Search + IB-verified badge toggle. Data: /api/v1/admin/businesses/.
import styles from "./BusinessesView.module.css";
import useBusinessesView, { remainingLabel, responseLabel } from "./useBusinessesView";

const BusinessesView = () => {
  const v = useBusinessesView();

  return (
    <div>
      <div className={styles.head}>
        <div>
          <h1>Businesses</h1>
          <p>Seller businesses. Grant or revoke the IB-verified badge.</p>
        </div>
        <form className={styles.search} onSubmit={v.onSearch}>
          <input placeholder="Search business…" value={v.search} onChange={(e) => v.setSearch(e.target.value)} />
          <button type="submit">Search</button>
        </form>
      </div>

      {v.notice && <div className={`${styles.notice} ${styles.err}`}>{v.notice.msg}</div>}

      {v.loading ? (
        <div className={styles.empty}>Loading businesses…</div>
      ) : v.rows.length === 0 ? (
        <div className={styles.empty}>No businesses found.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Business</th><th>Location</th><th>Status</th><th>Plan</th><th>Badge</th><th>Enquiries</th><th>Response</th><th></th></tr></thead>
            <tbody>
              {v.rows.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div className={styles.bizName}>{b.businessName}</div>
                    <div className={styles.bizSub}>{b.owner || "—"}</div>
                  </td>
                  <td>{b.location || "—"}</td>
                  <td><span className={`${styles.pill} ${b.status === "active" ? styles.on : styles.off}`}>{b.status === "active" ? "Active" : "Inactive"}</span></td>
                  <td>
                    {b.planName ? (
                      <div><div className={styles.bizName}>{b.planName}</div><div className={styles.bizSub}>{remainingLabel(b.planExpireAt)}</div></div>
                    ) : "—"}
                  </td>
                  <td><span className={`${styles.pill} ${b.badge === "verified" ? styles.on : styles.pending}`}>{b.badge === "verified" ? "Verified" : "Pending"}</span></td>
                  <td>{b.enquiries}</td>
                  <td>{responseLabel(b.responseSeconds)}</td>
                  <td className={styles.actions}>
                    <button type="button" className={b.isVerified ? styles.revoke : styles.grant} onClick={() => v.toggle(b)}>
                      {b.isVerified ? "Revoke" : "Verify"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!v.loading && v.total > 0 && (
        <div className={styles.pager}>
          <button type="button" disabled={v.pageNo <= 1} onClick={v.prev}>← Prev</button>
          <span>Page {v.pageNo} of {v.totalPages} · {v.total} businesses</span>
          <button type="button" disabled={v.pageNo >= v.totalPages} onClick={v.next}>Next →</button>
        </div>
      )}
    </div>
  );
};

export default BusinessesView;
