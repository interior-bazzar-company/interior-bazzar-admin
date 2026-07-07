// ── BuyersView ── admin Buyers table (port of prototype buyersView).
// Search + block/activate toggle. Data: /api/v1/admin/buyers/.
import styles from "./BuyersView.module.css";
import useBuyersView from "./useBuyersView";

const BuyersView = () => {
  const v = useBuyersView();

  return (
    <div>
      <div className={styles.head}>
        <div>
          <h1>Buyers</h1>
          <p>End customers on the platform. Block or reactivate accounts.</p>
        </div>
        <form className={styles.search} onSubmit={v.onSearch}>
          <input placeholder="Search username…" value={v.search} onChange={(e) => v.setSearch(e.target.value)} />
          <button type="submit">Search</button>
        </form>
      </div>

      {v.notice && <div className={`${styles.notice} ${styles.err}`}>{v.notice.msg}</div>}

      {v.loading ? (
        <div className={styles.empty}>Loading buyers…</div>
      ) : v.rows.length === 0 ? (
        <div className={styles.empty}>No buyers found.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Username</th><th>Verified</th><th>Status</th><th>Joined</th><th></th></tr></thead>
            <tbody>
              {v.rows.map((b) => (
                <tr key={b.id}>
                  <td>{b.username}</td>
                  <td>{b.isVerified ? "Yes" : "No"}</td>
                  <td><span className={`${styles.pill} ${b.isActive ? styles.on : styles.off}`}>{b.isActive ? "Active" : "Blocked"}</span></td>
                  <td>{b.joinedAt ? b.joinedAt.slice(0, 10) : "—"}</td>
                  <td className={styles.actions}>
                    <button type="button" className={b.isActive ? styles.block : styles.activate} onClick={() => v.toggle(b)}>
                      {b.isActive ? "Block" : "Activate"}
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

export default BuyersView;
