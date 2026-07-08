// ── TestimonialsView ── admin Testimonials (task 31 + master task 20).
// Ordered table (index number-input reorder) + video/rating + edit modal with a
// live YouTube thumbnail. Data: /api/v1/admin/testimonials/.
import styles from "../shared.module.css";
import useTestimonialsView, { ytThumb } from "./useTestimonialsView";

const TestimonialsView = () => {
  const v = useTestimonialsView();
  const form = v.modal?.form;

  return (
    <div>
      <div className={styles.head}>
        <div>
          <h1>Testimonials</h1>
          <p>Customer quotes &amp; videos shown on the marketing site, in display order.</p>
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
            <thead><tr><th>#</th><th>Preview</th><th>Type</th><th>Name / Business</th><th>Content</th><th>Rating</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {v.rows.map((t) => (
                <tr key={t.id}>
                  <td>
                    <input className={styles.num} type="number" min={1} style={{ width: 56 }}
                      key={`${t.id}-${t.index}`} defaultValue={t.index}
                      onBlur={(e) => { const n = Number(e.target.value); if (n && n !== t.index) v.reorder(t.id, n); }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
                  </td>
                  <td>
                    {t.type === "video" && ytThumb(t.videoUrl)
                      ? <span className={styles.videoThumb} style={{ backgroundImage: `url(${ytThumb(t.videoUrl)})` }}><i className="ti ti-player-play-filled" /></span>
                      : <span className={styles.quoteGlyph}>&ldquo;</span>}
                  </td>
                  <td style={{ textTransform: "capitalize" }}>{t.type}</td>
                  <td>{t.author}{t.businessName ? <div style={{ fontSize: 12, color: "#6b7280" }}>{t.businessName}</div> : t.role ? <div style={{ fontSize: 12, color: "#6b7280" }}>{t.role}</div> : null}</td>
                  <td style={{ maxWidth: 320 }}>{t.type === "video" ? <a href={t.videoUrl} target="_blank" rel="noreferrer">{t.videoUrl || "—"}</a> : t.quote}</td>
                  <td>{t.rating != null ? `★ ${t.rating}` : "—"}</td>
                  <td><span className={`${styles.pill} ${t.status === "active" ? styles.on : styles.off}`}>{t.status === "active" ? "Published" : "Hidden"}</span></td>
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

      {v.modal && form && (
        <div className={styles.overlay} onClick={v.closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>{v.modal.id == null ? "Add testimonial" : "Edit testimonial"}</h2>
            <label>Type
              <select value={form.type} onChange={(e) => v.setField("type", e.target.value)}>
                <option value="text">Text</option>
                <option value="video">Video</option>
              </select>
            </label>
            <label>Name<input value={form.author} onChange={(e) => v.setField("author", e.target.value)} /></label>
            <label>Business<input value={form.businessName} onChange={(e) => v.setField("businessName", e.target.value)} /></label>
            <label>Role<input value={form.role} onChange={(e) => v.setField("role", e.target.value)} placeholder="e.g. Founder" /></label>
            {form.type === "video" ? (
              <>
                <label>YouTube / video link<input value={form.videoUrl} onChange={(e) => v.setField("videoUrl", e.target.value)} placeholder="https://youtu.be/…" /></label>
                {ytThumb(form.videoUrl) && <div className={styles.videoPreview} style={{ backgroundImage: `url(${ytThumb(form.videoUrl)})` }} />}
              </>
            ) : (
              <label>Quote<textarea rows={3} value={form.quote} onChange={(e) => v.setField("quote", e.target.value)} /></label>
            )}
            <label>Rating (0–5)<input value={form.rating} onChange={(e) => v.setField("rating", e.target.value)} placeholder="e.g. 4.5" /></label>
            <label>Avatar URL<input value={form.avatarUrl} onChange={(e) => v.setField("avatarUrl", e.target.value)} placeholder="https://…" /></label>
            <label className={styles.check}><input type="checkbox" checked={form.featured} onChange={(e) => v.setField("featured", e.target.checked)} /> Featured</label>
            <label className={styles.check}><input type="checkbox" checked={form.status === "active"} onChange={(e) => v.setField("status", e.target.checked ? "active" : "hidden")} /> Published</label>
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
            <p style={{ fontSize: 13, color: "#6b7280" }}>Remaining testimonials will be re-numbered.</p>
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
