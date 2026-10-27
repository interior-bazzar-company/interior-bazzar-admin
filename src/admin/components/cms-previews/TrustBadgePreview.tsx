// Seller name row with the trust badge chip beside it.
// Ported from interior-bazzar-frontend/src/components/businessProfile/ProfileIdentity.tsx (.badgeChip).
// The frontend hides a badge with no artwork; the preview shows it, flagged, so editors see the gap.
import styles from "../../../styles/cms-previews/TrustBadgePreview.module.css";

export default function TrustBadgePreview({ v }: { v: Record<string, any> }) {
  const img = String(v.imageUrl ?? "").trim();
  const type = String(v.type ?? "").trim();
  return (
    <div className={styles.nameRow}>
      <h3 className={styles.name}>Sample Interiors</h3>
      <span className={styles.badgeChip}>
        {img ? (
          <img src={img} alt="" />
        ) : (
          <svg viewBox="0 0 15 15" aria-hidden="true"><circle cx="7.5" cy="7.5" r="6.5" fill="#d9d4ca" /></svg>
        )}
        {type || "Badge name"}
      </span>
      {!img && <span className={styles.note}>No artwork: the public site hides this badge.</span>}
    </div>
  );
}
