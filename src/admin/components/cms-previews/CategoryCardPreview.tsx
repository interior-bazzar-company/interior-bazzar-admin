// One category tile. Ported from interior-bazzar-frontend/src/components/Home/portal/NeedGrid
// (+ CardImage), the tile style used for the home category rows. components/trendingV3/CategoryBoards
// is a ranked leaderboard, not a category tile, so it was not used.
import { useState } from "react";
import styles from "../../../styles/cms-previews/CategoryCardPreview.module.css";

const initialsOf = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

export default function CategoryCardPreview({ v }: { v: Record<string, any> }) {
  const src = String(v.imageSQUrl || v.imageRTUrl || "").trim();
  const label = String(v.lable || v.value || "").trim();
  const [failed, setFailed] = useState<string>();
  const show = !!src && failed !== src;
  return (
    <div className={styles.item}>
      <span className={styles.tile}>
        <span className={styles.media}>
          <span className={styles.frame}>
            {show ? (
              <img src={src} alt="" onError={() => setFailed(src)} />
            ) : (
              <span className={styles.fallback} aria-hidden="true">{initialsOf(label) || "?"}</span>
            )}
          </span>
        </span>
        <span className={styles.label}>{label || <span className={styles.empty}>Category name</span>}</span>
        {v.trending ? <span className={styles.flag}>Trending{v.index != null ? ` #${v.index}` : ""}</span> : null}
      </span>
    </div>
  );
}
