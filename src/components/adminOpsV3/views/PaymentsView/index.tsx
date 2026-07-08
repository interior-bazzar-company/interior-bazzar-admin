// ── PaymentsView ── admin Payments (port of prototype paymentsView).
// Transaction list + refund/reject modal (level-3). Data: /api/v1/admin/payments/.
import styles from "../shared.module.css";
import usePaymentsView from "./usePaymentsView";

const PaymentsView = () => {
  const v = usePaymentsView();

  return (
    <div>
      <div className={styles.head}>
        <h1>Payments</h1>
        <p>Transactions across the platform. Record refunds where needed (audited).</p>
      </div>

      {v.notice && <div className={`${styles.notice} ${v.notice.kind === "ok" ? styles.ok : styles.err}`}>{v.notice.msg}</div>}

      {v.loading ? (
        <div className={styles.empty}>Loading payments…</div>
      ) : v.rows.length === 0 ? (
        <div className={styles.empty}>No payments found.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Order</th><th>Txn</th><th>For</th><th>Amount</th><th>Status</th><th>Refund</th><th></th></tr></thead>
            <tbody>
              {v.rows.map((p) => (
                <tr key={p.id}>
                  <td className={styles.mono}>{p.orderId || "—"}</td>
                  <td className={styles.mono}>{p.transactionId || "—"}</td>
                  <td>{p.paymentFor || "—"}</td>
                  <td>₹{p.amount || "0"}</td>
                  <td><span className={styles.pill}>{p.orderStatus || "—"}</span></td>
                  <td>{p.refundStatus ? <span className={`${styles.pill} ${styles.amber}`}>{p.refundStatus}</span> : "—"}</td>
                  <td className={styles.actions}>
                    {p.refundStatus !== "REFUNDED" && (
                      <button type="button" className={styles.edit} onClick={() => v.openRefund(p)}>Refund</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {v.refundId != null && (
        <div className={styles.overlay} onClick={v.cancelRefund}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>Refund transaction</h2>
            <label>Amount<input value={v.amount} onChange={(e) => v.setAmount(e.target.value)} /></label>
            <label>Reason<textarea rows={3} value={v.reason} onChange={(e) => v.setReason(e.target.value)} /></label>
            <div className={styles.modalActions}>
              <button type="button" className={styles.save} disabled={v.busy} onClick={() => v.submitRefund(false)}>{v.busy ? "…" : "Approve refund"}</button>
              <button type="button" className={styles.del} disabled={v.busy} onClick={() => v.submitRefund(true)}>Reject</button>
              <button type="button" className={styles.cancel} onClick={v.cancelRefund}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentsView;
