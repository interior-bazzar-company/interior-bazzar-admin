import { useState } from "react";
import styles from "../../../styles/cms-previews/TestimonialCardPreview.module.css";

const initialsOf = (n: string) =>
  n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M7 4v16l13 -8z" />
  </svg>
);

export default function TestimonialCardPreview({ v }: { v: Record<string, any> }) {
  const [bad, setBad] = useState<string>();
  const name = String(v?.authorName ?? "").trim();
  const role = String(v?.authorRole ?? "").trim();
  const biz = String(v?.businessName ?? "").trim();
  const quote = String(v?.quote ?? "").trim();
  const thumb = String(v?.thumbnailUrl ?? "").trim();
  const video = String(v?.videoUrl ?? "").trim();
  const rating = Math.max(0, Math.min(5, Math.round(Number(v?.rating) || 0)));
  const sub = [role, biz].filter(Boolean).join(", ");
  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <div className={styles.top}>
          <div className={styles.avatar}>
            {thumb && bad !== thumb ? <img src={thumb} alt="" onError={() => setBad(thumb)} /> : initialsOf(name) || "?"}
            {video && (
              <span className={styles.play}>
                <PlayIcon />
              </span>
            )}
          </div>
          <div className={styles.info}>
            <div className={`${styles.name} ${name ? "" : styles.empty}`}>{name || "Author name"}</div>
            <div className={`${styles.biz} ${sub ? "" : styles.empty}`}>{sub || "Role, business"}</div>
            <div className={styles.stars} aria-label={`${rating} out of 5`}>
              {"★".repeat(rating)}
              {"☆".repeat(5 - rating)}
            </div>
          </div>
        </div>
        <p className={`${styles.body} ${quote ? "" : styles.empty}`}>{quote || "Testimonial quote appears here"}</p>
        {video && (
          <div className={styles.foot}>
            <span className={styles.type}>
              <PlayIcon /> Video testimonial
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
