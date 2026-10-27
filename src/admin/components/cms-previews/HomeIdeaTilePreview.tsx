import { useState } from "react";
import styles from "../../../styles/cms-previews/HomeIdeaTilePreview.module.css";

const initialsOf = (n: string) =>
  n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

export default function HomeIdeaTilePreview({ v }: { v: Record<string, any> }) {
  const [bad, setBad] = useState<string>();
  const label = String(v?.label ?? "").trim();
  const src = String(v?.imageUrl ?? "").trim();
  return (
    <div className={styles.root}>
      <span className={styles.tile}>
        <span className={styles.media}>
          <span className={styles.frame}>
            {src && bad !== src ? (
              <img src={src} alt="" onError={() => setBad(src)} />
            ) : (
              <span className={styles.fallback} aria-hidden="true">
                {initialsOf(label)}
              </span>
            )}
          </span>
        </span>
        <span className={`${styles.label} ${label ? "" : styles.empty}`}>{label || "Tile label"}</span>
      </span>
    </div>
  );
}
