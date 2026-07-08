// ── TestimonialsView ── admin Testimonials (port of prototype testimonialsView).
// List + add/edit modal + custom delete-confirm. Data: /api/v1/admin/testimonials/.
import styles from "../shared.module.css";
import useTestimonialsView from "./useTestimonialsView";

const TestimonialsView = () => {
  const v = useTestimonialsView();

  return (
    <div>
      <div className={styles.head}>
        <div>
          <h1>Testimonials</h1>
          <p>Customer quotes shown on the marketing site. Feature the best ones.</p>
        </div>
        <button type="button" className={styles.add} onClick={v.openAdd}>+ Add testimonial</button>
      </div>

      {v.notice && <div className={`${styles.notice} ${v.notice.kind === "ok" ? styles.ok : styles.err}`}>{v.notice.msg}</div>}

      {v.loading ? (
        <div className={styles.empty}>Loading testimonials…</div>
      ) : v.rows.length === 0 ? (
        <div className={styles.empty}>No testimonials yet.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Author</th><th>Quote</th><th>Featured</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {v.rows.map((t) => (
                <tr key={t.id}>
                  <td>{t.author}{t.role ? <div style={{ fontSize: 12, color: "#6b7280" }}>{t.role}</div> : null}</td>
                  <td style={{ maxWidth: 340 }}>{t.quote}</td>
                  <td>{t.featured ? "★" : "—"}</td>
                  <td><span className={`${styles.pill} ${t.status === "active" ? styles.on : styles.off}`}>{t.status}</span></td>
                  <td className={styles.actions}>
                    <button type="button" className={styles.edit} onClick={() => v.openEdit(t)}>Edit</button>
                    <button type="button" className={styles.del} onClick={() => v.confirmDelete(t.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {v.modal && (
        <div className={styles.overlay} onClick={v.closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>{v.modal.id == null ? "Add testimonial" : "Edit testimonial"}</h2>
            <label>Author<input value={v.modal.form.author} onChange={(e) => v.setField("author", e.target.value)} /></label>
            <label>Role / company<input value={v.modal.form.role} onChange={(e) => v.setField("role", e.target.value)} /></label>
            <label>Quote<textarea rows={3} value={v.modal.form.quote} onChange={(e) => v.setField("quote", e.target.value)} /></label>
            <label>Avatar URL<input value={v.modal.form.avatarUrl} onChange={(e) => v.setField("avatarUrl", e.target.value)} placeholder="https://…" /></label>
            <label className={styles.check}><input type="checkbox" checked={v.modal.form.featured} onChange={(e) => v.setField("featured", e.target.checked)} /> Featured</label>
            <label className={styles.check}><input type="checkbox" checked={v.modal.form.status === "active"} onChange={(e) => v.setField("status", e.target.checked ? "active" : "hidden")} /> Active</label>
            <div className={styles.modalActions}>
              <button type="button" className={styles.save} disabled={v.saving} onClick={v.save}>{v.saving ? "Saving…" : "Save"}</button>
              <button type="button" className={styles.cancel} onClick={v.closeModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {v.confirmId != null && (
        <div className={styles.overlay} onClick={v.cancelDelete}>
          <div className={styles.confirm} onClick={(e) => e.stopPropagation()}>
            <h2>Delete this testimonial?</h2>
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

export default TestimonialsView;
