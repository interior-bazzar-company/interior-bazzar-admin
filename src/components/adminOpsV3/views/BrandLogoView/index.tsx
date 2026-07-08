// ── BrandLogoView ── admin Brand Logo (port of prototype brandLogoView).
// Set logo/favicon S3 URLs with live preview. Data: /api/v1/admin/brand-logo/.
import styles from "../shared.module.css";
import useBrandLogoView from "./useBrandLogoView";

const BrandLogoView = () => {
  const v = useBrandLogoView();

  return (
    <div>
      <div className={styles.head}>
        <h1>Brand Logo</h1>
        <p>The logo and favicon used across the platform. Paste an uploaded image URL.</p>
      </div>

      {v.notice && <div className={`${styles.notice} ${v.notice.kind === "ok" ? styles.ok : styles.err}`}>{v.notice.msg}</div>}

      {v.loading ? (
        <div className={styles.empty}>Loading…</div>
      ) : (
        <div style={{ maxWidth: 560 }}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 13, color: "#4b5563", marginBottom: 6 }}>Logo URL</label>
            <input style={{ width: "100%", padding: "9px 11px", border: "1px solid #cbd5e1", borderRadius: 8 }} value={v.logoUrl} onChange={(e) => v.setLogoUrl(e.target.value)} placeholder="https://…/logo.png" />
            {v.logoUrl && <div style={{ marginTop: 10, padding: 16, background: "#f8fafb", borderRadius: 10, border: "1px solid #eef0f2" }}><img src={v.logoUrl} alt="logo preview" style={{ maxHeight: 60, maxWidth: "100%" }} /></div>}
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 13, color: "#4b5563", marginBottom: 6 }}>Favicon URL</label>
            <input style={{ width: "100%", padding: "9px 11px", border: "1px solid #cbd5e1", borderRadius: 8 }} value={v.faviconUrl} onChange={(e) => v.setFaviconUrl(e.target.value)} placeholder="https://…/favicon.ico" />
            {v.faviconUrl && <div style={{ marginTop: 10 }}><img src={v.faviconUrl} alt="favicon preview" style={{ height: 32, width: 32 }} /></div>}
          </div>
          <button type="button" className={styles.save} disabled={v.saving} onClick={v.save}>{v.saving ? "Saving…" : "Save brand assets"}</button>
        </div>
      )}
    </div>
  );
};

export default BrandLogoView;
