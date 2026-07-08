// ── CatRegionView ── admin Categories & Regions taxonomy (task 32 + master 22).
// Full CRUD: categories (edit/hide/delete), sub-categories/segments (nested),
// states. UI only; logic in useCatRegionView. Data: /api/v1/admin/taxonomy/.
import styles from "../shared.module.css";
import useCatRegionView from "./useCatRegionView";

const CatRegionView = () => {
  const v = useCatRegionView();

  return (
    <div>
      <div className={styles.head}>
        <h1>Categories &amp; Regions</h1>
        <p>The taxonomy powering public search &amp; browse. Hiding is reversible (won't orphan businesses). Cities stay free-text.</p>
      </div>
      {v.notice && <div className={`${styles.notice} ${v.notice.kind === "ok" ? styles.ok : styles.err}`}>{v.notice.msg}</div>}

      {v.loading ? <div className={styles.empty}>Loading taxonomy…</div> : (
        <>
          {/* Categories */}
          <h3 className={styles.sliderGroupHead}>Categories ({v.cats.length})</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Label</th><th>Value</th><th>Trending</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {v.cats.map((c) => (
                  <tr key={c.id} style={{ opacity: c.isActive ? 1 : 0.55 }}>
                    <td><input className={styles.num} style={{ width: 160 }} key={`cl-${c.id}-${c.label}`} defaultValue={c.label} onBlur={(e) => e.target.value !== c.label && v.editCategory(c, { label: e.target.value })} /></td>
                    <td><input className={styles.num} style={{ width: 130 }} key={`cv-${c.id}-${c.value}`} defaultValue={c.value} onBlur={(e) => e.target.value !== c.value && v.editCategory(c, { value: e.target.value })} /></td>
                    <td><button type="button" className={styles.edit} onClick={() => v.editCategory(c, { trending: !c.trending })}>{c.trending ? "★" : "—"}</button></td>
                    <td><span className={`${styles.pill} ${c.isActive ? styles.on : styles.off}`}>{c.isActive ? "Active" : "Hidden"}</span></td>
                    <td className={styles.actions}>
                      <button type="button" className={styles.edit} onClick={() => v.toggleCategory(c)}>{c.isActive ? "Hide" : "Show"}</button>
                      {c.isActive && <button type="button" className={styles.del} onClick={() => v.deleteCategory(c)}>Delete</button>}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td><input className={styles.num} style={{ width: 160 }} placeholder="Label" value={v.cForm.label} onChange={(e) => v.setCForm({ ...v.cForm, label: e.target.value })} /></td>
                  <td><input className={styles.num} style={{ width: 130 }} placeholder="value" value={v.cForm.value} onChange={(e) => v.setCForm({ ...v.cForm, value: e.target.value })} /></td>
                  <td colSpan={3}><button type="button" className={styles.save} onClick={v.addCategory}>Add category</button></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Sub-categories (segments) */}
          <h3 className={styles.sliderGroupHead}>Sub-categories ({v.segs.length})</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Label</th><th>Value</th><th>Parent categories</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {v.segs.map((s) => (
                  <tr key={s.id} style={{ opacity: s.isActive ? 1 : 0.55 }}>
                    <td><input className={styles.num} style={{ width: 160 }} key={`sl-${s.id}-${s.label}`} defaultValue={s.label} onBlur={(e) => e.target.value !== s.label && v.editSegment(s, { label: e.target.value })} /></td>
                    <td className={styles.mono}>{s.value}</td>
                    <td style={{ maxWidth: 240, fontSize: 12 }}>{s.categoryIds.length ? s.categoryIds.map(v.catName).join(", ") : <span style={{ color: "#9ca3af" }}>— none</span>}</td>
                    <td><span className={`${styles.pill} ${s.isActive ? styles.on : styles.off}`}>{s.isActive ? "Active" : "Hidden"}</span></td>
                    <td className={styles.actions}>
                      <button type="button" className={styles.edit} onClick={() => v.toggleSegment(s)}>{s.isActive ? "Hide" : "Show"}</button>
                      {s.isActive && <button type="button" className={styles.del} onClick={() => v.deleteSegment(s)}>Delete</button>}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td><input className={styles.num} style={{ width: 160 }} placeholder="Label" value={v.sForm.label} onChange={(e) => v.setSForm({ ...v.sForm, label: e.target.value })} /></td>
                  <td><input className={styles.num} style={{ width: 130 }} placeholder="value" value={v.sForm.value} onChange={(e) => v.setSForm({ ...v.sForm, value: e.target.value })} /></td>
                  <td>
                    <select multiple value={v.sForm.categoryIds.map(String)} style={{ minWidth: 180, height: 70, fontSize: 12 }}
                      onChange={(e) => v.setSForm({ ...v.sForm, categoryIds: Array.from(e.target.selectedOptions, (o) => Number(o.value)) })}>
                      {v.cats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </td>
                  <td colSpan={2}><button type="button" className={styles.save} onClick={v.addSegment}>Add sub-category</button></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* States */}
          <h3 className={styles.sliderGroupHead}>States ({v.states.length})</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Name</th><th>Value</th><th></th></tr></thead>
              <tbody>
                {v.states.map((s) => (
                  <tr key={s.id}>
                    <td><input className={styles.num} style={{ width: 160 }} key={`sn-${s.id}-${s.name}`} defaultValue={s.name} onBlur={(e) => e.target.value !== s.name && v.editState(s, { name: e.target.value })} /></td>
                    <td><input className={styles.num} style={{ width: 130 }} key={`svv-${s.id}-${s.value}`} defaultValue={s.value || ""} onBlur={(e) => e.target.value !== (s.value || "") && v.editState(s, { value: e.target.value })} /></td>
                    <td className={styles.actions}><button type="button" className={styles.del} onClick={() => v.deleteState(s)}>Delete</button></td>
                  </tr>
                ))}
                <tr>
                  <td><input className={styles.num} style={{ width: 160 }} placeholder="Name" value={v.stForm.name} onChange={(e) => v.setStForm({ ...v.stForm, name: e.target.value })} /></td>
                  <td><input className={styles.num} style={{ width: 130 }} placeholder="value" value={v.stForm.value} onChange={(e) => v.setStForm({ ...v.stForm, value: e.target.value })} /></td>
                  <td><button type="button" className={styles.save} onClick={v.addState}>Add state</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default CatRegionView;
