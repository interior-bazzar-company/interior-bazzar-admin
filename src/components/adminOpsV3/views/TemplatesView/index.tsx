// ── TemplatesView ── admin Notification Templates (port of prototype
// templatesView). List + add/edit modal + custom delete-confirm. Reuses the
// task-48 CRUD endpoint /api/v1/admin/templates/.
import styles from "./TemplatesView.module.css";
import useTemplatesView from "./useTemplatesView";

const TemplatesView = () => {
  const v = useTemplatesView();

  return (
    <div>
      <div className={styles.head}>
        <div>
          <h1>Notification Templates</h1>
          <p>Message templates rendered by the delivery system, keyed by name.</p>
        </div>
        <button type="button" className={styles.add} onClick={v.openAdd}>+ Add template</button>
      </div>

      {v.notice && <div className={`${styles.notice} ${v.notice.kind === "ok" ? styles.ok : styles.err}`}>{v.notice.msg}</div>}

      {v.loading ? (
        <div className={styles.empty}>Loading templates…</div>
      ) : v.rows.length === 0 ? (
        <div className={styles.empty}>No templates yet.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Key</th><th>Channel</th><th>Subject</th><th>Active</th><th></th></tr></thead>
            <tbody>
              {v.rows.map((t) => (
                <tr key={t.id}>
                  <td className={styles.key}>{t.key}</td>
                  <td>{t.channel}</td>
                  <td>{t.subject || "—"}</td>
                  <td>{t.active ? "Yes" : "No"}</td>
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
            <h2>{v.modal.id == null ? "Add template" : "Edit template"}</h2>
            <label>Key<input value={v.modal.form.key} disabled={v.modal.id != null} onChange={(e) => v.setField("key", e.target.value)} /></label>
            <label>Channel
              <select value={v.modal.form.channel} onChange={(e) => v.setField("channel", e.target.value)}>
                <option value="email">email</option><option value="sms">sms</option>
                <option value="whatsapp">whatsapp</option><option value="push">push</option><option value="inapp">inapp</option>
              </select>
            </label>
            <label>Subject<input value={v.modal.form.subject} onChange={(e) => v.setField("subject", e.target.value)} /></label>
            <label>Body<textarea rows={4} value={v.modal.form.body} onChange={(e) => v.setField("body", e.target.value)} /></label>
            <label>Variables (comma-separated)<input value={v.modal.form.variables} onChange={(e) => v.setField("variables", e.target.value)} placeholder="name, otp, link" /></label>
            <label className={styles.check}><input type="checkbox" checked={v.modal.form.active} onChange={(e) => v.setField("active", e.target.checked)} /> Active</label>
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
            <h2>Delete this template?</h2>
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

export default TemplatesView;
