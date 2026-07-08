// ── BannersAdView ── admin Banner Ads moderation (port of prototype
// bannerAdsView). 3 counted tabs (pending/live/rejected) over AdCampaign, cards
// with creative, approve + reject-with-reason, and a Create-fallback-ad modal.
import styles from "./BannersAdView.module.css";
import useBannersAdView, { AD_TABS, type AdTab } from "./useBannersAdView";

const TAB_LABEL: Record<AdTab, string> = { pending: "Pending review", live: "Live", rejected: "Rejected" };

const BannersAdView = () => {
  const v = useBannersAdView();

  return (
    <div>
      <div className={styles.head}>
        <div>
          <h1>Banner Ads</h1>
          <p>Moderate advertiser submissions. Create house/fallback ads for empty slots.</p>
        </div>
        <button type="button" className={styles.add} onClick={v.openModal}>+ Create fallback ad</button>
      </div>

      {v.notice && (
        <div className={`${styles.notice} ${v.notice.kind === "ok" ? styles.ok : styles.err}`}>{v.notice.msg}</div>
      )}

      <div className={styles.tabs}>
        {AD_TABS.map((t) => (
          <button key={t} type="button" className={`${styles.tab} ${v.tab === t ? styles.tabActive : ""}`} onClick={() => v.setTab(t)}>
            {TAB_LABEL[t]} ({v.counts[t]})
          </button>
        ))}
      </div>

      {v.loading ? (
        <div className={styles.empty}>Loading ads…</div>
      ) : v.ads.length === 0 ? (
        <div className={styles.empty}>No {TAB_LABEL[v.tab].toLowerCase()} ads.</div>
      ) : (
        <div className={styles.grid}>
          {v.ads.map((a) => (
            <div key={a.id} className={styles.card}>
              {a.creative.imageUrl ? (
                <div className={styles.img} style={{ backgroundImage: `url(${a.creative.imageUrl})` }} />
              ) : (
                <div className={`${styles.img} ${styles.imgPh}`}><i className="ti ti-photo" /></div>
              )}
              <div className={styles.body}>
                {a.creative.eyebrow && <div className={styles.eyebrow}>{a.creative.eyebrow}</div>}
                <div className={styles.title}>{a.creative.heading1 || a.title}</div>
                {a.creative.description && <p className={styles.sub}>{a.creative.description}</p>}
                {a.creative.features?.length > 0 && (
                  <ul className={styles.features}>{a.creative.features.map((f, i) => <li key={i}>{f}</li>)}</ul>
                )}
                {a.creative.buttonLabel && (
                  <div className={styles.ctaLine}>
                    <i className="ti ti-pointer" /> {a.creative.buttonLabel}
                    {a.creative.buttonLink ? ` → ${a.creative.buttonLink}` : ""}
                  </div>
                )}
                <div className={styles.tags}>
                  {a.spots.map((s) => <span key={s} className={styles.spot}>{s}</span>)}
                </div>
                <div className={styles.metaRow}>
                  <span>{a.isHouseAd ? "House / fallback ad" : `Duration: ${a.months} month${a.months === 1 ? "" : "s"}`}</span>
                  {!a.isHouseAd && <span>Amount: ₹{a.priceTotal}</span>}
                  <span className={styles.by}>{a.advertiser}</span>
                </div>

                {a.rejectReason && a.status === "rejected" && (
                  <div className={styles.reviewNote}><strong>Review note:</strong> {a.rejectReason}</div>
                )}

                <div className={styles.actions}>
                  {v.tab === "pending" && (
                    <button type="button" className={styles.approve} disabled={v.busy} onClick={() => v.approve(a.id)}>Approve</button>
                  )}
                  {v.tab !== "rejected" && (
                    <button type="button" className={styles.reject} disabled={v.busy} onClick={() => v.openReject(a.id)}>Reject</button>
                  )}
                </div>

                {v.rejectingId === a.id && (
                  <div className={styles.rejectForm}>
                    <textarea
                      placeholder="Reason for seller (required)"
                      value={v.reason}
                      onChange={(e) => v.setReason(e.target.value)}
                      rows={2}
                    />
                    <div className={styles.rejectActions}>
                      <button type="button" className={styles.reject} disabled={v.busy} onClick={v.submitReject}>
                        {v.busy ? "…" : "Confirm reject"}
                      </button>
                      <button type="button" className={styles.cancel} onClick={v.cancelReject}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create fallback ad modal */}
      {v.modalOpen && (
        <div className={styles.overlay} onClick={v.closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>Create fallback ad</h2>
            <p className={styles.modalHint}>Shown when no paid ad fills the slot. Auto-approves to live.</p>
            <div className={styles.formRow}>
              <label>Placement<input value={v.form.placement} onChange={(e) => v.setField("placement", e.target.value)} placeholder="e.g. inline" /></label>
              <label>Page<input value={v.form.page} onChange={(e) => v.setField("page", e.target.value)} placeholder="slug — blank = any page" /></label>
            </div>
            <label>Eyebrow<input value={v.form.eyebrow} onChange={(e) => v.setField("eyebrow", e.target.value)} /></label>
            <label>Heading<input value={v.form.heading} onChange={(e) => v.setField("heading", e.target.value)} placeholder="Main headline" /></label>
            <label>Sub<input value={v.form.sub} onChange={(e) => v.setField("sub", e.target.value)} /></label>
            <label>Features (one per line)<textarea rows={3} value={v.form.features} onChange={(e) => v.setField("features", e.target.value)} /></label>
            <div className={styles.formRow}>
              <label>CTA label<input value={v.form.ctaLabel} onChange={(e) => v.setField("ctaLabel", e.target.value)} /></label>
              <label>CTA link<input value={v.form.ctaLink} onChange={(e) => v.setField("ctaLink", e.target.value)} placeholder="blank = open enquiry wizard" /></label>
            </div>
            <div className={styles.formRow}>
              <label>Theme<input value={v.form.theme} onChange={(e) => v.setField("theme", e.target.value)} /></label>
              <label>Image
                <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && v.pickImage(e.target.files[0])} />
              </label>
            </div>
            {v.isImageUploading && <div className={styles.uploading}>Uploading image…</div>}
            {v.form.image && <div className={styles.imgPreview} style={{ backgroundImage: `url(${v.form.image})` }} />}
            <div className={styles.modalActions}>
              <button type="button" className={styles.approve} disabled={v.busy || v.isImageUploading} onClick={v.submitFallback}>
                {v.busy ? "Creating…" : "Create"}
              </button>
              <button type="button" className={styles.cancel} onClick={v.closeModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BannersAdView;
