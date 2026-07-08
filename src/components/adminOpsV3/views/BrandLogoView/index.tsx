// ── BrandLogoView ── admin Brand Logo (task 27).
// Timeline of scheduled seasonal logos (public site resolves today's active one)
// + a defaults card. UI only; logic in useBrandLogoView.
import styles from "../shared.module.css";
import useBrandLogoView, { statusOf, type LogoStatus } from "./useBrandLogoView";

const STATUS_LABEL: Record<LogoStatus, string> = { live: "Live", scheduled: "Scheduled", ended: "Ended" };
// scheduled → amber; live → green (styles.on); ended → grey (styles.off).
const statusStyle = (s: LogoStatus) => (s === "scheduled" ? { background: "#fef3c7", color: "#b45309" } : undefined);

const BrandLogoView = () => {
  const v = useBrandLogoView();
  const form = v.drawer?.form;

  return (
    <div>
      <div className={styles.head}>
        <div>
          <h1>Brand Logo</h1>
          <p>Schedule seasonal logos with date windows. The site shows today's active one, falling back to the default below.</p>
        </div>
        <button type="button" className={styles.add} onClick={v.openAdd}>+ Add scheduled logo</button>
      </div>

      {v.notice && <div className={`${styles.notice} ${v.notice.kind === "ok" ? styles.ok : styles.err}`}>{v.notice.msg}</div>}

      {/* live banner — what the public site is actually resolving right now */}
      {v.active && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, marginBottom: 18, background: "#f8fafb", border: "1px solid #eef0f2", borderRadius: 10 }}>
          {v.active.logoUrl
            ? <img src={v.active.logoUrl} alt="active logo" style={{ maxHeight: 44, maxWidth: 140 }} />
            : <span style={{ fontWeight: 700, fontSize: 20 }}>IB</span>}
          <div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Showing on the site now</div>
            {v.active.tagline && <div style={{ fontSize: 13, color: "#111827" }}>{v.active.tagline}</div>}
          </div>
        </div>
      )}

      {v.loading ? (
        <div className={styles.empty}>Loading…</div>
      ) : (
        <>
          {v.rows.length === 0 ? (
            <div className={styles.empty}>No scheduled logos yet. The default below is always shown.</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Logo</th><th>Label</th><th>From</th><th>To</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {v.rows.map((r) => {
                    const st = statusOf(r);
                    return (
                      <tr key={r.id}>
                        <td>{r.imageUrl ? <img src={r.imageUrl} alt="" style={{ maxHeight: 32, maxWidth: 90 }} /> : "—"}</td>
                        <td>{r.label || "—"}{r.tagline ? <div style={{ fontSize: 12, color: "#6b7280" }}>{r.tagline}</div> : null}</td>
                        <td>{r.activeFrom || "Always"}</td>
                        <td>{r.activeTo || "Always"}</td>
                        <td><span className={`${styles.pill} ${st === "live" ? styles.on : styles.off}`} style={statusStyle(st)}>{STATUS_LABEL[st]}</span></td>
                        <td className={styles.actions}>
                          <button type="button" className={styles.edit} onClick={() => v.openEdit(r)}>Edit</button>
                          <button type="button" className={styles.del} onClick={() => v.confirmDelete(r.id)}>Delete</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* defaults card */}
          <div style={{ maxWidth: 560, marginTop: 26, paddingTop: 18, borderTop: "1px solid #eef0f2" }}>
            <h2 style={{ fontSize: 15, margin: "0 0 4px" }}>Default brand assets</h2>
            <p style={{ fontSize: 13, color: "#6b7280", marginTop: 0 }}>Fallback logo, favicon &amp; tagline used whenever no scheduled logo is active.</p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, color: "#4b5563", marginBottom: 6 }}>Logo URL</label>
              <input style={{ width: "100%", padding: "9px 11px", border: "1px solid #cbd5e1", borderRadius: 8 }} value={v.logoUrl} onChange={(e) => v.setLogoUrl(e.target.value)} placeholder="https://…/logo.png" />
              {v.logoUrl && <div style={{ marginTop: 10, padding: 16, background: "#f8fafb", borderRadius: 10, border: "1px solid #eef0f2" }}><img src={v.logoUrl} alt="logo preview" style={{ maxHeight: 60, maxWidth: "100%" }} /></div>}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, color: "#4b5563", marginBottom: 6 }}>Favicon URL</label>
              <input style={{ width: "100%", padding: "9px 11px", border: "1px solid #cbd5e1", borderRadius: 8 }} value={v.faviconUrl} onChange={(e) => v.setFaviconUrl(e.target.value)} placeholder="https://…/favicon.ico" />
              {v.faviconUrl && <div style={{ marginTop: 10 }}><img src={v.faviconUrl} alt="favicon preview" style={{ height: 32, width: 32 }} /></div>}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, color: "#4b5563", marginBottom: 6 }}>Default tagline</label>
              <input style={{ width: "100%", padding: "9px 11px", border: "1px solid #cbd5e1", borderRadius: 8 }} value={v.tagline} onChange={(e) => v.setTagline(e.target.value)} placeholder="e.g. Little things." />
            </div>
            <button type="button" className={styles.save} disabled={v.savingDefaults} onClick={v.saveDefaults}>{v.savingDefaults ? "Saving…" : "Save defaults"}</button>
          </div>
        </>
      )}

      {/* add / edit drawer */}
      {v.drawer && form && (
        <div className={styles.overlay} onClick={v.closeDrawer}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>{v.drawer.id == null ? "Add scheduled logo" : "Edit scheduled logo"}</h2>
            <label>Label<input value={form.label} onChange={(e) => v.setField("label", e.target.value)} placeholder="e.g. Diwali 2027" /></label>
            <label>Image URL<input value={form.imageUrl} onChange={(e) => v.setField("imageUrl", e.target.value)} placeholder="https://…/logo.png" /></label>
            <label>Or upload<input type="file" accept="image/*" onChange={(e) => v.onPickImage(e.target.files?.[0] || null)} /></label>
            {v.isImageUploading && <div style={{ fontSize: 12, color: "#6b7280" }}>Uploading…</div>}
            {form.imageUrl && <div style={{ padding: 12, background: "#f8fafb", borderRadius: 10, border: "1px solid #eef0f2" }}><img src={form.imageUrl} alt="preview" style={{ maxHeight: 48, maxWidth: "100%" }} /></div>}
            <label>Tagline<input value={form.tagline} onChange={(e) => v.setField("tagline", e.target.value)} placeholder="optional" /></label>
            <label>Active from<input type="date" value={form.activeFrom} onChange={(e) => v.setField("activeFrom", e.target.value)} /></label>
            <label>Active to<input type="date" value={form.activeTo} onChange={(e) => v.setField("activeTo", e.target.value)} /></label>
            <p style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Leave both dates empty for an always-on logo.</p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.save} disabled={v.saving} onClick={v.save}>{v.saving ? "Saving…" : "Save"}</button>
              <button type="button" className={styles.cancel} onClick={v.closeDrawer}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {v.confirmId != null && (
        <div className={styles.overlay} onClick={v.cancelDelete}>
          <div className={styles.confirm} onClick={(e) => e.stopPropagation()}>
            <h2>Delete this scheduled logo?</h2>
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

export default BrandLogoView;
