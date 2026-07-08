// ── ContentView ── admin Content / Blog + SEO (task 25). Blog list (cover thumb,
// status pill, feature/edit/delete) + full editor subview (WYSIWYG body via
// react-quill, cover/author image upload, SEO panel, draft/publish).
// Data: /api/v1/admin/content/.
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import styles from "../shared.module.css";
import useContentView from "./useContentView";

const ContentView = () => {
  const v = useContentView();
  const form = v.editor?.form;

  // ── Editor subview ──
  if (v.editor && form) {
    return (
      <div>
        <div className={styles.head}>
          <div>
            <h1>{v.editor.id == null ? "New post" : "Edit post"}</h1>
            <p>Write the story, set SEO, then publish to make it live on the public blog.</p>
          </div>
          <button type="button" className={styles.cancel} onClick={v.closeEditor}>← Back to posts</button>
        </div>

        {v.notice && <div className={`${styles.notice} ${v.notice.kind === "ok" ? styles.ok : styles.err}`}>{v.notice.msg}</div>}

        <div className={styles.tableWrap} style={{ padding: 16, display: "grid", gap: 14 }}>
          <label>Title<input value={form.title} onChange={(e) => v.setField("title", e.target.value)} placeholder="Post title" /></label>
          <label>Slug (auto from title if left blank)<input value={form.slug} onChange={(e) => v.setField("slug", e.target.value)} placeholder="my-post-slug" /></label>

          <label>Cover image
            <input type="file" accept="image/*" onChange={(e) => v.onPickCover(e.target.files?.[0] || null)} />
          </label>
          {v.isImageUploading && <div className={styles.hint}>Uploading…</div>}
          {form.coverImageUrl && <img src={form.coverImageUrl} alt="cover" style={{ maxWidth: 240, borderRadius: 8 }} />}

          <label>Author<input value={form.author} onChange={(e) => v.setField("author", e.target.value)} placeholder="Author name" /></label>
          <label>Author image
            <input type="file" accept="image/*" onChange={(e) => v.onPickAuthorImage(e.target.files?.[0] || null)} />
          </label>
          {form.authorImageUrl && <img src={form.authorImageUrl} alt="author" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }} />}

          <label>Body</label>
          <ReactQuill theme="snow" value={form.body} onChange={(html) => v.setField("body", html)} />

          <fieldset style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, display: "grid", gap: 10 }}>
            <legend style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>SEO</legend>
            <label>Meta title<input value={form.metaTitle} onChange={(e) => v.setField("metaTitle", e.target.value)} placeholder="Defaults to the post title" /></label>
            <label>Meta description<textarea rows={2} value={form.metaDescription} onChange={(e) => v.setField("metaDescription", e.target.value)} placeholder="~150 chars for search snippets" /></label>
            <label>Focus keyword<input value={form.focusKeyword} onChange={(e) => v.setField("focusKeyword", e.target.value)} placeholder="e.g. modular kitchen" /></label>
          </fieldset>

          <label>Status
            <select value={form.status} onChange={(e) => v.setField("status", e.target.value)}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>
          <label className={styles.check}><input type="checkbox" checked={form.isFeatured} onChange={(e) => v.setField("isFeatured", e.target.checked)} /> Featured on homepage</label>

          <div className={styles.modalActions}>
            <button type="button" className={styles.save} disabled={v.saving} onClick={v.save}>{v.saving ? "Saving…" : "Save"}</button>
            <button type="button" className={styles.cancel} onClick={v.closeEditor}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  // ── List view ──
  return (
    <div>
      <div className={styles.head}>
        <div>
          <h1>Content / Blog</h1>
          <p>Blog posts &amp; SEO. Drafts stay hidden from the public site until published.</p>
        </div>
        <button type="button" className={styles.add} onClick={v.openNew}>+ New post</button>
      </div>

      {v.notice && <div className={`${styles.notice} ${v.notice.kind === "ok" ? styles.ok : styles.err}`}>{v.notice.msg}</div>}

      {v.loading ? (
        <div className={styles.empty}>Loading posts…</div>
      ) : v.rows.length === 0 ? (
        <div className={styles.empty}>No blog posts yet.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Cover</th><th>Title</th><th>Author</th><th>Status</th><th>Featured</th><th>Updated</th><th></th></tr></thead>
            <tbody>
              {v.rows.map((b) => (
                <tr key={b.id}>
                  <td>{b.coverImageUrl ? <img src={b.coverImageUrl} alt="" style={{ width: 56, height: 36, objectFit: "cover", borderRadius: 4 }} /> : "—"}</td>
                  <td>{b.title}</td>
                  <td>{b.author || "—"}</td>
                  <td><span className={`${styles.pill} ${b.status === "published" ? styles.on : styles.off}`}>{b.status === "published" ? "Published" : "Draft"}</span></td>
                  <td>{b.isFeatured ? "★" : "—"}</td>
                  <td style={{ whiteSpace: "nowrap", fontSize: 12, color: "#6b7280" }}>{b.updatedAt ? new Date(b.updatedAt).toLocaleDateString() : "—"}</td>
                  <td className={styles.actions}>
                    <button type="button" className={styles.edit} onClick={() => v.openEdit(b)}>Edit</button>
                    <button type="button" className={styles.edit} onClick={() => v.feature(b.id)}>{b.isFeatured ? "Unfeature" : "Feature"}</button>
                    <button type="button" className={styles.del} onClick={() => v.confirmDelete(b.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {v.confirmId != null && (
        <div className={styles.overlay} onClick={v.cancelDelete}>
          <div className={styles.confirm} onClick={(e) => e.stopPropagation()}>
            <h2>Delete this post?</h2>
            <p style={{ fontSize: 13, color: "#6b7280" }}>This removes it from the admin list and the public blog.</p>
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

export default ContentView;
