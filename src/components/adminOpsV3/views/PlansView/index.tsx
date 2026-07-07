// ── PlansView ── admin Plans & Pricing module (port of prototype plansView).
// Family tab strip + pricing table + inline price-edit form. Price edits are
// level-3 (backend audits). Data: /api/v1/admin/plans/ (Subscription catalogue).
import styles from "./PlansView.module.css";
import usePlansView from "./usePlansView";

const PlansView = () => {
  const v = usePlansView();

  return (
    <div>
      <div className={styles.head}>
        <h1>Plans &amp; Pricing</h1>
        <p>The commercial catalogue. Price changes are recorded to the audit log.</p>
      </div>

      {v.notice && (
        <div className={`${styles.notice} ${v.notice.kind === "ok" ? styles.ok : styles.err}`}>
          {v.notice.msg}
        </div>
      )}

      {/* Family tab strip */}
      <div className={styles.tabs}>
        {v.familyKeys.map((f) => (
          <button
            key={f}
            type="button"
            className={`${styles.tab} ${v.activeFamily === f ? styles.tabActive : ""}`}
            onClick={() => v.setActiveFamily(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {v.loading ? (
        <div className={styles.empty}>Loading plans…</div>
      ) : v.rows.length === 0 ? (
        <div className={styles.empty}>No plans in this family.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Title</th><th>Duration</th><th>Amount</th><th>Payable</th><th>Disc %</th><th>Tag</th><th></th>
              </tr>
            </thead>
            <tbody>
              {v.rows.map((p) =>
                v.editingId === p.id && v.form ? (
                  <tr key={p.id} className={styles.editRow}>
                    <td><input value={v.form.title} onChange={(e) => v.setField("title", e.target.value)} /></td>
                    <td><input value={v.form.duration} onChange={(e) => v.setField("duration", e.target.value)} /></td>
                    <td><input value={v.form.amount} onChange={(e) => v.setField("amount", e.target.value)} /></td>
                    <td><input value={v.form.payableAmount} onChange={(e) => v.setField("payableAmount", e.target.value)} /></td>
                    <td><input value={v.form.discountPercentage} onChange={(e) => v.setField("discountPercentage", e.target.value)} /></td>
                    <td><input value={v.form.tag} onChange={(e) => v.setField("tag", e.target.value)} /></td>
                    <td className={styles.actions}>
                      <button type="button" className={styles.save} disabled={v.saving} onClick={v.savePlan}>
                        {v.saving ? "Saving…" : "Save"}
                      </button>
                      <button type="button" className={styles.cancel} onClick={v.cancelEdit}>Cancel</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id}>
                    <td>{p.title}</td>
                    <td>{p.duration || "—"}</td>
                    <td>₹{p.amount || "0"}</td>
                    <td>₹{p.payableAmount || p.amount || "0"}</td>
                    <td>{p.discountPercentage || "0"}%</td>
                    <td>{p.tag || "—"}</td>
                    <td className={styles.actions}>
                      <button type="button" className={styles.edit} onClick={() => v.startEdit(p)}>Edit</button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PlansView;
