// ── SlotsView ── admin Slot Inventory module (port of prototype slotsView).
// The exclusivity map: a category × region grid of who holds each slot. Cells
// are click-to-override (capacity / priority / holder) — LEVEL-3, backend audits.
// Data: /api/v1/admin/slots/ (interior_admin SlotInventory).
import styles from "./SlotsView.module.css";
import useSlotsView from "./useSlotsView";

const SlotsView = () => {
  const v = useSlotsView();

  return (
    <div>
      <div className={styles.head}>
        <h1>Slot Inventory</h1>
        <p>The exclusivity map the sales team sells against — one holder per category × region. Overrides are recorded to the audit log.</p>
      </div>

      {v.notice && (
        <div className={`${styles.notice} ${v.notice.kind === "ok" ? styles.ok : styles.err}`}>
          {v.notice.msg}
        </div>
      )}

      {/* KPI tiles */}
      <div className={styles.tiles}>
        <div className={styles.tile}>
          <div className={styles.tv}>{v.held}/{v.total}</div>
          <div className={styles.tl}>Slots held · <b>{v.utilPct}%</b> utilisation</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tv}>{v.held}</div>
          <div className={styles.tl}>Assigned holders</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tvAccent}>{v.free}</div>
          <div className={styles.tl}>Free slots — open to sell</div>
        </div>
      </div>

      {v.loading ? (
        <div className={styles.empty}>Loading slot inventory…</div>
      ) : v.categories.length === 0 ? (
        <div className={styles.empty}>No slot inventory configured yet.</div>
      ) : (
        <div className={styles.gridWrap}>
          <table className={styles.grid}>
            <thead>
              <tr>
                <th className={styles.corner}>Category</th>
                {v.regions.map((r) => (
                  <th key={r}>{r}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {v.categories.map((cat) => (
                <tr key={cat}>
                  <th className={styles.rowHead}>{cat}</th>
                  {v.regions.map((reg) => {
                    const s = v.cellFor(cat, reg);
                    if (!s) return <td key={reg} className={styles.cellEmpty} />;
                    const active = v.editingId === s.id;
                    return (
                      <td key={reg}>
                        <button
                          type="button"
                          className={`${styles.cell} ${s.holderId != null ? styles.held : styles.free} ${active ? styles.cellActive : ""}`}
                          onClick={() => v.startEdit(s)}
                        >
                          {s.holderId != null ? (
                            <b className={styles.holder}>{s.holder || `#${s.holderId}`}</b>
                          ) : (
                            <small className={styles.freeTag}>free</small>
                          )}
                          <small className={styles.meta}>cap {s.capacity} · pri {s.priority}</small>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Level-3 override editor */}
      {v.editingSlot && v.form && (
        <div className={styles.editor}>
          <div className={styles.editorHead}>
            <b>{v.editingSlot.category}</b> · {v.editingSlot.region}
            <span className={styles.lvl3}>Level 3 · audited</span>
          </div>
          <div className={styles.editorFields}>
            <label>
              <span>Capacity</span>
              <input type="number" min={0} value={v.form.capacity} onChange={(e) => v.setField("capacity", e.target.value)} />
            </label>
            <label>
              <span>Priority</span>
              <input type="number" min={0} value={v.form.priority} onChange={(e) => v.setField("priority", e.target.value)} />
            </label>
            <label>
              <span>Holder ID <small>(blank = clear)</small></span>
              <input type="number" min={0} value={v.form.holderId} onChange={(e) => v.setField("holderId", e.target.value)} placeholder="unassigned" />
            </label>
          </div>
          <div className={styles.editorActions}>
            <button type="button" className={styles.save} disabled={v.saving} onClick={v.saveOverride}>
              {v.saving ? "Saving…" : "Save override"}
            </button>
            <button type="button" className={styles.cancel} onClick={v.cancelEdit}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlotsView;
