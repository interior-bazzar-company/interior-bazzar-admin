// ── PlanRequestsView ── admin Plan Requests (task 35 + master task 24).
// Verify = confirm manual payment (txn) + pick real Subscription + grant/activate.
import styles from "../shared.module.css";
import usePlanRequestsView from "./usePlanRequestsView";

const PlanRequestsView = () => {
  const v = usePlanRequestsView();

  return (
    <div>
      <div className={styles.head}>
        <h1>Plan Requests</h1>
        <p>Manual-payment plan enquiries. Confirm the transaction, pick the real plan, and Verify to grant + activate it.</p>
      </div>
      {v.notice && <div className={`${styles.notice} ${v.notice.kind === "ok" ? styles.ok : styles.err}`}>{v.notice.msg}</div>}

      {v.loading ? <div className={styles.empty}>Loading requests…</div> : v.rows.length === 0 ? <div className={styles.empty}>No plan requests.</div> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Name</th><th>Requested plan</th><th>Contact</th><th>Txn ID</th><th>Stage</th><th></th></tr></thead>
            <tbody>
              {v.rows.map((p) => (
                <tr key={p.id}>
                  <td>{p.name || "—"}</td>
                  <td>{p.plan || "—"}</td>
                  <td>{p.phone || p.email || "—"}</td>
                  <td className={styles.mono}>{p.transactionId || "—"}</td>
                  <td><span className={`${styles.pill} ${p.stage === "4" ? styles.on : p.stage === "rejected" ? styles.off : ""}`}>{p.stage || "—"}</span></td>
                  <td className={styles.actions}>
                    {v.verifyingId === p.id ? (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <select className={styles.num} style={{ width: 220 }} value={v.pick} onChange={(e) => v.setPick(e.target.value)}>
                          <option value="">Pick a plan…</option>
                          {v.plans.map((pl) => <option key={pl.id} value={`${pl.id}|${pl.family}`}>{pl.label}</option>)}
                        </select>
                        <button type="button" className={styles.grant} disabled={v.busy} onClick={() => v.confirmVerify(p.id)}>{v.busy ? "…" : "Grant + activate"}</button>
                        <button type="button" className={styles.cancel} onClick={v.cancelVerify}>Cancel</button>
                      </div>
                    ) : (
                      <>
                        <button type="button" className={styles.grant} onClick={() => v.openVerify(p.id)}>Verify</button>
                        <button type="button" className={styles.del} onClick={() => v.reject(p.id)}>Reject</button>
                      </>
                    )}
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

export default PlanRequestsView;
