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
            <thead><tr><th>Buyer</th><th>Phone</th><th>Enquiries</th><th>Saved</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {v.rows.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div className={styles.buyerName}>{b.username}</div>
                    <div className={styles.buyerSub}>{b.location || "—"}</div>
                  </td>
                  <td>{b.phone || "—"}</td>
                  <td>{b.queryCount}</td>
                  <td>{b.savedCount}</td>
                  <td><span className={`${styles.pill} ${b.isActive ? styles.on : styles.off}`}>{b.isActive ? "Active" : "Blocked"}</span></td>
                  <td className={styles.actions}>
                    <button type="button" className={b.isActive ? styles.block : styles.activate} onClick={() => v.toggle(b)}>
                      {b.isActive ? "Block" : "Unblock"}
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
          <span>Page {v.pageNo} of {v.totalPages} · {v.total} buyers</span>
          <button type="button" disabled={v.pageNo >= v.totalPages} onClick={v.next}>Next →</button>
        </div>
      )}
    </div>
  );
};

export default BuyersView;
