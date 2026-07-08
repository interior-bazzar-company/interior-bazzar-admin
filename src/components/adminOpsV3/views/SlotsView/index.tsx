// ── SlotsView ── admin Slot Inventory (port of prototype slotsView).
// Category × region table with inline capacity/priority override (level-3,
// backend audits). Data: /api/v1/admin/slots/.
import styles from "../shared.module.css";
import useSlotsView from "./useSlotsView";

const SlotsView = () => {
  const v = useSlotsView();

  return (
    <div>
      <div className={styles.head}>
        <h1>Slot Inventory</h1>
        <p>The exclusivity map — capacity and priority per category × region. Overrides are recorded to the audit log.</p>
      </div>

      {v.notice && <div className={`${styles.notice} ${v.notice.kind === "ok" ? styles.ok : styles.err}`}>{v.notice.msg}</div>}

      {v.loading ? (
        <div className={styles.empty}>Loading slots…</div>
      ) : v.slots.length === 0 ? (
        <div className={styles.empty}>No slot inventory configured yet.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Category</th><th>Region</th><th>Capacity</th><th>Priority</th><th>Holder</th><th></th></tr></thead>
            <tbody>
              {v.slots.map((s) => (
                <tr key={s.id}>
                  <td>{s.category}</td>
                  <td>{s.region}</td>
                  <td>
                    {v.editingId === s.id
                      ? <input className={styles.num} value={v.capacity} onChange={(e) => v.setCapacity(e.target.value)} />
                      : s.capacity}
                  </td>
                  <td>
                    {v.editingId === s.id
                      ? <input className={styles.num} value={v.priority} onChange={(e) => v.setPriority(e.target.value)} />
                      : s.priority}
                  </td>
                  <td>{s.holder || "—"}</td>
                  <td className={styles.actions}>
                    {v.editingId === s.id ? (
                      <>
                        <button type="button" className={styles.save} disabled={v.saving} onClick={() => v.save(s)}>{v.saving ? "…" : "Save"}</button>
                        <button type="button" className={styles.cancel} onClick={v.cancel}>Cancel</button>
                      </>
                    ) : (
                      <button type="button" className={styles.edit} onClick={() => v.startEdit(s)}>Override</button>
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

export default SlotsView;
