// One filter/segment chip. Ported from interior-bazzar-frontend/src/components/Home/v3/CategoryFilterBar (.pill).
// Label is shortValue when set, else lable/value (the frontend falls back the same way).
import styles from "../../../styles/cms-previews/SegmentChipPreview.module.css";

export default function SegmentChipPreview({ v }: { v: Record<string, any> }) {
  const label = String(v.shortValue || v.lable || v.value || "").trim();
  const img = String(v.imageSQUrl ?? "").trim();
  return (
    <div className={styles.root}>
      <span className={styles.pill}>
        {img ? <img className={styles.thumb} src={img} alt="" /> : null}
        {label || <span className={styles.empty}>Segment</span>}
        {v.trending ? <span aria-hidden="true">&#128293;</span> : null}
      </span>
    </div>
  );
}
