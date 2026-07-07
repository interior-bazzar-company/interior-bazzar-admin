// ── BusinessesView ── admin Businesses table (port of prototype businessesView).
// Search + IB-verified badge toggle. Data: /api/v1/admin/businesses/.
import styles from "./BusinessesView.module.css";
import useBusinessesView from "./useBusinessesView";

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
            <thead><tr><th>Business</th><th>Owner</th><th>Verified</th><th></th></tr></thead>
            <tbody>
              {v.rows.map((b) => (
                <tr key={b.id}>
                  <td>{b.businessName}</td>
                  <td>{b.owner || "—"}</td>
                  <td><span className={`${styles.pill} ${b.isVerified ? styles.on : styles.off}`}>{b.isVerified ? "Verified" : "Unverified"}</span></td>
                  <td className={styles.actions}>
                    <button type="button" className={b.isVerified ? styles.revoke : styles.grant} onClick={() => v.toggle(b)}>
                      {b.isVerified ? "Revoke badge" : "Verify"}
                    </button>
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

export default BusinessesView;
