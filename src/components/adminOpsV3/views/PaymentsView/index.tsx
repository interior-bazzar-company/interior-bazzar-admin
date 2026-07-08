// ── PaymentsView ── admin Payments (port of prototype paymentsView).
// Pending manual-payment verification + processed history + refund modal (level-3).
// Data: /api/v1/admin/payments/.
import styles from "../shared.module.css";
import usePaymentsView, { type PaymentRow } from "./usePaymentsView";

const PaymentsView = () => {
  const v = usePaymentsView();

  const refundCell = (p: PaymentRow) => (p.refundStatus ? <span className={`${styles.pill} ${styles.amber}`}>{p.refundStatus}</span> : "—");

  return (
    <div>
      <div className={styles.head}>
        <h1>Payments</h1>
        <p>Verify manual payments (UPI/NEFT proof) and record refunds. All actions audited.</p>
      </div>

      {v.notice && <div className={`${styles.notice} ${v.notice.kind === "ok" ? styles.ok : styles.err}`}>{v.notice.msg}</div>}

      <div className={styles.kpis}>
        <div className={styles.kpi}>{v.pending.length} awaiting verification · {v.verifiedCount} manual payments verified</div>
      </div>

      {v.loading ? (
        <div className={styles.empty}>Loading payments…</div>
      ) : (
        <>
          {/* Pending verification — SUBMITTED manual payments */}
          <div className={styles.head}><h2>Pending verification ({v.pending.length})</h2></div>
          {v.pending.length === 0 ? (
            <div className={styles.empty}>No manual payments awaiting verification.</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Order</th><th>Txn</th><th>For</th><th>Amount</th><th></th></tr></thead>
                <tbody>
                  {v.pending.map((p) => (
                    <tr key={p.id}>
                      <td className={styles.mono}>{p.orderId || "—"}</td>
                      <td className={styles.mono}>{p.transactionId || "—"}</td>
                      <td>{p.paymentFor || "—"}</td>
                      <td>₹{p.amount || "0"}</td>
                      <td className={styles.actions}>
                        <button type="button" className={styles.save} disabled={v.busy} onClick={() => v.verify(p.id)}>Approve</button>
                        <button type="button" className={styles.del} disabled={v.busy} onClick={() => v.reject(p.id)}>Reject</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* History — everything already processed */}
          <div className={styles.head}><h2>History</h2></div>
          {v.history.length === 0 ? (
            <div className={styles.empty}>No payments found.</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Order</th><th>Txn</th><th>For</th><th>Amount</th><th>Method</th><th>Status</th><th>Refund</th><th></th></tr></thead>
                <tbody>
                  {v.history.map((p) => (
                    <tr key={p.id}>
                      <td className={styles.mono}>{p.orderId || "—"}</td>
                      <td className={styles.mono}>{p.transactionId || "—"}</td>
                      <td>{p.paymentFor || "—"}</td>
                      <td>₹{p.amount || "0"}</td>
                      <td>{p.paymentMethod || "gateway"}</td>
                      <td><span className={styles.pill}>{p.orderStatus || "—"}</span></td>
                      <td>{refundCell(p)}</td>
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
        </>
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
