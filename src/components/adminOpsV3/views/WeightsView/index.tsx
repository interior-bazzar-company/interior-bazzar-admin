// ── WeightsView ── admin Qualification Weights (port of prototype weightsView).
// Signal→weight editor + add row + save (level-3). Data: /api/v1/admin/weights/.
import styles from "../shared.module.css";
import useWeightsView from "./useWeightsView";

const WeightsView = () => {
  const v = useWeightsView();

  return (
    <div>
      <div className={styles.head}>
        <h1>Qualification Weights</h1>
        <p>Signal weights the lead-qualification pipeline reads. Changes are recorded to the audit log.</p>
      </div>

      {v.notice && <div className={`${styles.notice} ${v.notice.kind === "ok" ? styles.ok : styles.err}`}>{v.notice.msg}</div>}

      {v.loading ? (
        <div className={styles.empty}>Loading weights…</div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Signal</th><th>Weight</th></tr></thead>
              <tbody>
                {v.rows.length === 0 ? (
                  <tr><td colSpan={2} style={{ color: "#9ca3af" }}>No weights configured. Add one below.</td></tr>
                ) : v.rows.map((r) => (
                  <tr key={r.key}>
                    <td className={styles.mono}>{r.key}</td>
                    <td><input className={styles.num} value={r.value} onChange={(e) => v.setValue(r.key, e.target.value)} /></td>
                  </tr>
                ))}
                <tr>
                  <td><input className={styles.num} style={{ width: 180 }} placeholder="new signal key" value={v.newKey} onChange={(e) => v.setNewKey(e.target.value)} /></td>
                  <td>
                    <input className={styles.num} placeholder="0.0" value={v.newVal} onChange={(e) => v.setNewVal(e.target.value)} />{" "}
                    <button type="button" className={styles.edit} onClick={v.addRow}>Add</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 16 }}>
            <button type="button" className={styles.save} disabled={v.saving} onClick={v.save}>{v.saving ? "Saving…" : "Save weights"}</button>
          </div>
        </>
      )}
    </div>
  );
};

export default WeightsView;
