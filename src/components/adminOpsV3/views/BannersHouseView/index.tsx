// ── BannersHouseView ── admin House Banners module (port of prototype
// bannersHouseView). List + reorder + toggle + add/edit modal + custom
// delete-confirm (no native confirm/alert). Data: /api/v1/admin/banners-house/.
import styles from "./BannersHouseView.module.css";
import useBannersHouseView from "./useBannersHouseView";

const BannersHouseView = () => {
  const v = useBannersHouseView();

  return (
    <div>
      <div className={styles.head}>
        <div>
          <h1>House Banners</h1>
          <p>Promotional banners shown on the marketplace. Drag order with the arrows.</p>
        </div>
        <button type="button" className={styles.add} onClick={v.openAdd}>+ Add banner</button>
      </div>

      {v.notice && (
        <div className={`${styles.notice} ${v.notice.kind === "ok" ? styles.ok : styles.err}`}>{v.notice.msg}</div>
      )}

      {v.loading ? (
        <div className={styles.empty}>Loading banners…</div>
      ) : v.banners.length === 0 ? (
        <div className={styles.empty}>No banners yet. Add one to get started.</div>
      ) : (
        <div className={styles.list}>
          {v.banners.map((b, i) => (
            <div key={b.id} className={styles.row}>
              <div className={styles.reorder}>
                <button type="button" disabled={i === 0} onClick={() => v.move(b, "up")} aria-label="Move up">▲</button>
                <button type="button" disabled={i === v.banners.length - 1} onClick={() => v.move(b, "down")} aria-label="Move down">▼</button>
              </div>
              <div className={styles.thumb}>
                {b.bannerUrl ? <img src={b.bannerUrl} alt={b.title} /> : <span className={styles.noimg}>No image</span>}
              </div>
              <div className={styles.meta}>
                <div className={styles.title}>{b.title}</div>
                <div className={styles.support}>{b.supportText || "—"}</div>
              </div>
              <button
                type="button"
                className={`${styles.pill} ${b.isActive ? styles.on : styles.off}`}
                onClick={() => v.toggle(b)}
              >
                {b.isActive ? "Active" : "Inactive"}
              </button>
              <div className={styles.rowActions}>
                <button type="button" className={styles.edit} onClick={() => v.openEdit(b)}>Edit</button>
                <button type="button" className={styles.del} onClick={() => v.confirmDelete(b.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      {v.modal && (
        <div className={styles.overlay} onClick={v.closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>{v.modal.id == null ? "Add banner" : "Edit banner"}</h2>
            <label>Title
              <input value={v.modal.form.title} onChange={(e) => v.setField("title", e.target.value)} />
            </label>
            <label>Support text
              <input value={v.modal.form.supportText} onChange={(e) => v.setField("supportText", e.target.value)} />
            </label>
            <label>Banner image URL
              <input value={v.modal.form.bannerUrl} onChange={(e) => v.setField("bannerUrl", e.target.value)} placeholder="https://…" />
            </label>
            <label className={styles.check}>
              <input type="checkbox" checked={v.modal.form.isActive} onChange={(e) => v.setField("isActive", e.target.checked)} />
              Active
            </label>
            <div className={styles.modalActions}>
              <button type="button" className={styles.save} disabled={v.saving} onClick={v.save}>
                {v.saving ? "Saving…" : "Save"}
              </button>
              <button type="button" className={styles.cancel} onClick={v.closeModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Custom delete confirm */}
      {v.confirmId != null && (
        <div className={styles.overlay} onClick={v.cancelDelete}>
          <div className={styles.confirm} onClick={(e) => e.stopPropagation()}>
            <h2>Delete this banner?</h2>
            <p>This can't be undone.</p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.del} onClick={v.doDelete}>Delete</button>
              <button type="button" className={styles.cancel} onClick={v.cancelDelete}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BannersHouseView;
