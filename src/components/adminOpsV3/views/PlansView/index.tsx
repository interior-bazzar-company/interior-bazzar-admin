// ── PlansView ── admin Plans & Pricing module (port of prototype plansView).
// Dynamic family tabs + plan cards + inline edit/create form. Price edits are
// level-3 (backend audits). Archive hides a plan from the public site (isActive)
// while keeping it here so it can be re-activated. Data: /api/v1/admin/plans/.
import styles from "./PlansView.module.css";
import usePlansView from "./usePlansView";

const PlansView = () => {
  const v = usePlansView();

  // Shared edit/create form (create adds a Family field; edit adds Archive/Activate).
  const renderForm = (planId: number | null, isActive?: boolean) =>
    v.form && (
      <div className={`${styles.card} ${styles.editing}`}>
        {v.creating && (
          <label className={styles.field}>
            <span>Family</span>
            <input value={v.form.planFamily} onChange={(e) => v.setField("planFamily", e.target.value)}
              placeholder="e.g. business, architecture" />
          </label>
        )}
        <label className={styles.field}>
          <span>Plan name</span>
          <input value={v.form.title} onChange={(e) => v.setField("title", e.target.value)} placeholder="Plan name" />
        </label>
        <label className={styles.field}>
          <span>Subtitle</span>
          <input value={v.form.subtitle} onChange={(e) => v.setField("subtitle", e.target.value)} placeholder="Short tagline" />
        </label>
        <div className={styles.formRow}>
          <label className={styles.field}>
            <span>Amount ₹</span>
            <input value={v.form.amount} onChange={(e) => v.setField("amount", e.target.value)} />
          </label>
          <label className={styles.field}>
            <span>Payable ₹</span>
            <input value={v.form.payableAmount} onChange={(e) => v.setField("payableAmount", e.target.value)} />
          </label>
        </div>
        <div className={styles.formRow}>
          <label className={styles.field}>
            <span>Discount %</span>
            <input value={v.form.discountPercentage} onChange={(e) => v.setField("discountPercentage", e.target.value)} />
          </label>
          <label className={styles.field}>
            <span>Duration</span>
            <input value={v.form.duration} onChange={(e) => v.setField("duration", e.target.value)} placeholder="Monthly / Annual" />
          </label>
        </div>
        <label className={styles.field}>
          <span>Tag</span>
          <input value={v.form.tag} onChange={(e) => v.setField("tag", e.target.value)} placeholder="e.g. Popular" />
        </label>
        <label className={styles.field}>
          <span>Features (one per line)</span>
          <textarea rows={4} value={v.form.features} onChange={(e) => v.setField("features", e.target.value)}
            placeholder={"Unlimited leads\nPriority support\n…"} />
        </label>
        <div className={styles.actions}>
          <button type="button" className={styles.save} disabled={v.saving} onClick={v.savePlan}>
            {v.saving ? "Saving…" : v.creating ? "Create" : "Save"}
          </button>
          <button type="button" className={styles.cancel} onClick={v.cancelEdit}>Cancel</button>
          {!v.creating && planId != null && (
            <button type="button" className={styles.archive} disabled={v.togglingId === planId}
              onClick={() => v.toggleActive(v.rows.find((r) => r.id === planId)!)}>
              {isActive ? "Archive" : "Activate"}
            </button>
          )}
        </div>
      </div>
    );

  return (
    <div>
      <div className={styles.head}>
        <h1>Plans &amp; Pricing</h1>
        <p>The commercial catalogue. Price changes are recorded to the audit log. Archiving hides a plan from the public site.</p>
      </div>

      {v.notice && (
        <div className={`${styles.notice} ${v.notice.kind === "ok" ? styles.ok : styles.err}`}>
          {v.notice.msg}
        </div>
      )}

      {/* Family tab strip + Add plan (right end of the same stripe) */}
      <div className={styles.stripe}>
        <div className={styles.tabs}>
          {v.familyKeys.map((f) => (
            <button
              key={f}
              type="button"
              className={`${styles.tab} ${v.activeFamily === f ? styles.tabActive : ""}`}
              onClick={() => v.setActiveFamily(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <button type="button" className={styles.addPlan} onClick={v.startCreate}>+ Add plan</button>
      </div>

      {v.loading ? (
        <div className={styles.empty}>Loading plans…</div>
      ) : (
        <div className={styles.grid}>
          {/* New-plan form card appears first when creating */}
          {v.creating && renderForm(null)}

          {v.rows.length === 0 && !v.creating ? (
            <div className={styles.empty}>No plans in this family.</div>
          ) : (
            v.rows.map((p) =>
              v.editingId === p.id ? (
                <div key={p.id}>{renderForm(p.id, p.isActive)}</div>
              ) : (
                <div key={p.id} className={`${styles.card} ${p.isActive ? "" : styles.archived}`}>
                  <div className={styles.eyebrow}>{p.planFamily}</div>
                  <div className={styles.name}>{p.title || "Untitled plan"}</div>
                  {p.duration && <span className={styles.chip}>{p.duration}</span>}
                  <div className={styles.price}>
                    ₹{p.payableAmount || p.amount || "0"}
                    {p.duration && <span className={styles.period}> /{p.duration}</span>}
                  </div>
                  {p.payableAmount && p.amount && p.payableAmount !== p.amount && (
                    <div className={styles.was}>₹{p.amount}{p.discountPercentage ? ` · ${p.discountPercentage}% off` : ""}</div>
                  )}
                  {p.subtitle && <p className={styles.sub}>{p.subtitle}</p>}
                  {p.features?.length > 0 && (
                    <ul className={styles.limits}>
                      {p.features.map((f, i) => <li key={i}>{f.text}</li>)}
                    </ul>
                  )}
                  {!p.isActive && <span className={styles.archivedBadge}>Archived</span>}
                  <div className={styles.actions}>
                    <button type="button" className={styles.edit} onClick={() => v.startEdit(p)}>Edit</button>
                  </div>
                </div>
              )
            )
          )}
        </div>
      )}
    </div>
  );
};

export default PlansView;
