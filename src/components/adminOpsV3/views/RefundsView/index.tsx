// ── RefundsView ── admin Refunds (port of prototype refundsView).
// Read view of refunded transactions (the refund ACTION lives in Payments).
// Data: /api/v1/admin/payments/?refunded=true.
import styles from "../shared.module.css";
import usePaymentsView from "../PaymentsView/usePaymentsView";

const RefundsView = () => {
  const v = usePaymentsView({ refundedOnly: true });

  return (
    <div>
      <div className={styles.head}>
        <h1>Refunds</h1>
        <p>Transactions that have been refunded. Issue new refunds from the Payments module.</p>
      </div>

      {v.notice && <div className={`${styles.notice} ${styles.err}`}>{v.notice.msg}</div>}

      {v.loading ? (
        <div className={styles.empty}>Loading refunds…</div>
      ) : v.rows.length === 0 ? (
        <div className={styles.empty}>No refunds yet.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Order</th><th>Txn</th><th>For</th><th>Amount</th><th>Refunded</th><th>Status</th><th>Reason</th><th>Actioned by</th><th>Date</th></tr></thead>
            <tbody>
              {v.rows.map((p) => (
                <tr key={p.id}>
                  <td className={styles.mono}>{p.orderId || "—"}</td>
                  <td className={styles.mono}>{p.transactionId || "—"}</td>
                  <td>{p.paymentFor || "—"}</td>
                  <td>₹{p.amount || "0"}</td>
                  <td>₹{p.refundAmount || p.amount || "0"}</td>
                  <td><span className={`${styles.pill} ${p.refundStatus === "REFUNDED" ? styles.on : styles.off}`}>{p.refundStatus || "—"}</span></td>
                  <td>{p.refundReason || "—"}</td>
                  <td>{p.refundedBy || "—"}</td>
                  <td>{p.refundedAt ? p.refundedAt.slice(0, 10) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RefundsView;
