// ── BannersHouseView ── admin House Banners, rewired to the real hero model
// (HomeHeroBanner). Two screens: LIST (table + reorder/toggle/delete) and
// EDITOR (form on the left, live hero preview on the right). Port of prototype
// bannersHouseView() + bnEditorHTML(). Data: /api/v1/admin/banners-house/.
import styles from "./BannersHouseView.module.css";
import useBannersHouseView, {
  THEME_SWATCHES, themeCss, PAGE_OPTIONS, AUDIENCE_OPTIONS, bannerStatus,
} from "./useBannersHouseView";
import BusinessSearchSelect from "../../shared/BusinessSearchSelect";

const statusClass = (s: string) =>
  s === "Live" ? styles.stLive : s === "Scheduled" ? styles.stSched
    : s === "Expired" ? styles.stExp : styles.stPaused;

const BannersHouseView = () => {
  const v = useBannersHouseView();

  if (v.screen === "editor") {
    const f = v.form;
    return (
      <div>
        <div className={styles.head}>
          <div>
            <button type="button" className={styles.back} onClick={v.backToList}>← Back to slides</button>
            <h1>{v.editId == null ? "New slide" : "Edit slide"}</h1>
          </div>
          <button type="button" className={styles.add} disabled={v.saving} onClick={v.save}>
            {v.saving ? "Saving…" : "Save slide"}
          </button>
        </div>
        {v.notice && <div className={`${styles.notice} ${v.notice.kind === "ok" ? styles.ok : styles.err}`}>{v.notice.msg}</div>}

        <div className={styles.editor}>
          {/* LEFT — form */}
          <div className={styles.form}>
            <div className={styles.grid2}>
              <label>Page
                <select value={f.page} onChange={(e) => v.setField("page", e.target.value)}>
                  {PAGE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label>Audience
                <select value={f.audience} onChange={(e) => v.setField("audience", e.target.value as any)}>
                  {AUDIENCE_OPTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </label>
            </div>

            <label>Eyebrow (tag)
              <input value={f.tag} onChange={(e) => v.setField("tag", e.target.value)} placeholder="e.g. FEATURED" />
            </label>
            <label>Title
              <input value={f.title} onChange={(e) => v.setField("title", e.target.value)} placeholder="Slide headline" />
            </label>
            <label>Description
              <textarea rows={2} value={f.description} onChange={(e) => v.setField("description", e.target.value)} />
            </label>

            <div className={styles.fieldLabel}>Theme colour</div>
            <div className={styles.swatches}>
              {THEME_SWATCHES.map((t) => (
                <button key={t.key} type="button" title={t.label}
                  className={`${styles.swatch} ${f.backgroundGradient === t.key ? styles.swatchOn : ""}`}
                  style={{ background: t.css }} onClick={() => v.setField("backgroundGradient", t.key)} />
              ))}
            </div>

            <label>Background image (optional)
              <input type="file" accept="image/*" onChange={(e) => v.onPickImage(e.target.files?.[0] || null)} />
            </label>
            {v.isImageUploading && <div className={styles.hint}>Uploading…</div>}
            {f.backgroundImageUrl && (
              <div className={styles.hint}>
                Image set · <button type="button" className={styles.linkBtn} onClick={() => v.setField("backgroundImageUrl", "")}>remove</button>
              </div>
            )}

            <div className={styles.fieldLabel}>Floating cards — up to 2 businesses</div>
            <BusinessSearchSelect value={f.businesses} onChange={(b) => v.setField("businesses", b)} max={2} />

            {/* Buttons repeater */}
            <div className={styles.repHead}>
              <span>Buttons</span>
              <button type="button" className={styles.addRow} onClick={v.addButton}>+ Add button</button>
            </div>
            {f.buttons.map((b, i) => (
              <div key={i} className={styles.repRow}>
                <input placeholder="Label" value={b.label} onChange={(e) => v.setButton(i, { label: e.target.value })} />
                <input placeholder="Link (optional)" value={b.link} onChange={(e) => v.setButton(i, { link: e.target.value })} />
                <label className={styles.inlineCheck}>
                  <input type="checkbox" checked={b.isPrimary} onChange={(e) => v.setButton(i, { isPrimary: e.target.checked })} /> Primary
                </label>
                <button type="button" className={styles.del} onClick={() => v.removeButton(i)}>×</button>
              </div>
            ))}

            {/* Metrics repeater */}
            <div className={styles.repHead}>
              <span>Stats</span>
              <button type="button" className={styles.addRow} onClick={v.addMetric}>+ Add stat</button>
            </div>
            {f.metrics.map((m, i) => (
              <div key={i} className={styles.repRow}>
                <input placeholder="Value (e.g. 500+)" value={m.metric} onChange={(e) => v.setMetric(i, { metric: e.target.value })} />
                <input placeholder="Label" value={m.description} onChange={(e) => v.setMetric(i, { description: e.target.value })} />
                <button type="button" className={styles.del} onClick={() => v.removeMetric(i)}>×</button>
              </div>
            ))}

            <div className={styles.grid2}>
              <label>Starts at
                <input type="datetime-local" value={f.startsAt} onChange={(e) => v.setField("startsAt", e.target.value)} />
              </label>
              <label>Ends at
                <input type="datetime-local" value={f.endsAt} onChange={(e) => v.setField("endsAt", e.target.value)} />
              </label>
            </div>
            <label className={styles.check}>
              <input type="checkbox" checked={f.isActive} onChange={(e) => v.setField("isActive", e.target.checked)} /> Active
            </label>
          </div>

          {/* RIGHT — live preview */}
          <div className={styles.previewWrap}>
            <div className={styles.previewLabel}>Live preview</div>
            <div className={styles.hero}
              style={{
                background: f.backgroundImageUrl
                  ? `linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.45)), url(${f.backgroundImageUrl}) center/cover`
                  : themeCss(f.backgroundGradient),
              }}>
              {f.tag && <div className={styles.heroTag}>{f.tag}</div>}
              <div className={styles.heroTitle}>{f.title || "Slide headline"}</div>
              {f.description && <div className={styles.heroDesc}>{f.description}</div>}
              <div className={styles.heroBtns}>
                {f.buttons.filter((b) => b.label.trim()).map((b, i) => (
                  <span key={i} className={b.isPrimary ? styles.heroBtnP : styles.heroBtnG}>{b.label}</span>
                ))}
              </div>
              {f.metrics.some((m) => m.metric.trim()) && (
                <div className={styles.heroMetrics}>
                  {f.metrics.filter((m) => m.metric.trim()).map((m, i) => (
                    <div key={i}><b>{m.metric}</b><span>{m.description}</span></div>
                  ))}
                </div>
              )}
              {f.businesses.length > 0 && (
                <div className={styles.heroCards}>
                  {f.businesses.map((b) => <div key={b.id} className={styles.heroCard}>{b.name}</div>)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── LIST screen ──
  return (
    <div>
      <div className={styles.head}>
        <div>
          <h1>House Banners</h1>
          <p>Hero carousel slides shown across the marketplace. Reorder with the arrows.</p>
        </div>
        <button type="button" className={styles.add} onClick={v.openNew}>+ New slide</button>
      </div>

      {v.notice && <div className={`${styles.notice} ${v.notice.kind === "ok" ? styles.ok : styles.err}`}>{v.notice.msg}</div>}
      {!v.loading && <div className={styles.meter}>{v.liveCount} slide{v.liveCount === 1 ? "" : "s"} live in the hero carousel</div>}

      {v.loading ? (
        <div className={styles.empty}>Loading slides…</div>
      ) : v.banners.length === 0 ? (
        <div className={styles.empty}>No slides yet. Create one to get started.</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr><th></th><th>Slide</th><th>Placement</th><th>Schedule</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {v.banners.map((b, i) => {
              const st = bannerStatus(b);
              return (
                <tr key={b.id}>
                  <td className={styles.reorder}>
                    <button type="button" disabled={i === 0} onClick={() => v.move(b, "up")} aria-label="Move up">▲</button>
                    <button type="button" disabled={i === v.banners.length - 1} onClick={() => v.move(b, "down")} aria-label="Move down">▼</button>
                  </td>
                  <td>
                    <div className={styles.slideCell}>
                      <div className={styles.thumb}
                        style={{ background: b.backgroundImageUrl ? `url(${b.backgroundImageUrl}) center/cover` : themeCss(b.backgroundGradient) }} />
                      <div>
                        <div className={styles.title}>{b.title}</div>
                        <div className={styles.support}>{b.tag || "—"}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div>{b.page}</div>
                    <div className={styles.support}>{AUDIENCE_OPTIONS.find((a) => a.value === b.audience)?.label}</div>
                  </td>
                  <td className={styles.support}>
                    {b.startsAt || b.endsAt
                      ? `${b.startsAt ? new Date(b.startsAt).toLocaleDateString() : "…"} → ${b.endsAt ? new Date(b.endsAt).toLocaleDateString() : "…"}`
                      : "Evergreen"}
                  </td>
                  <td><span className={`${styles.pill} ${statusClass(st)}`}>{st}</span></td>
                  <td className={styles.rowActions}>
                    <button type="button" className={styles.ghost} onClick={() => v.toggle(b)}>{b.isActive ? "Stop" : "Run"}</button>
                    <button type="button" className={styles.edit} onClick={() => v.openEdit(b)}>Edit</button>
                    <button type="button" className={styles.del} onClick={() => v.confirmDelete(b.id)}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {v.confirmId != null && (
        <div className={styles.overlay} onClick={v.cancelDelete}>
          <div className={styles.confirm} onClick={(e) => e.stopPropagation()}>
            <h2>Delete this slide?</h2>
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
