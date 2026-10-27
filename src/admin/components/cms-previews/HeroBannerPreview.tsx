// Read-only preview of one slide of the public Home hero (HeroCarousel).
// Ported from interior-bazzar-frontend/src/components/Home/v3/HeroCarousel/index.tsx
import type { CSSProperties } from "react";
import styles from "../../../styles/cms-previews/HeroBannerPreview.module.css";

const THEMES: Record<string, string> = { green: styles.green, amber: styles.amber, navy: styles.navy, plum: styles.plum };

const emphasise = (h: string) =>
  h.split(/\*(.+?)\*/g).map((p, i) => (i % 2 ? <em key={i} className={styles.accent}>{p}</em> : p));

export default function HeroBannerPreview({ v }: { v: Record<string, any> }) {
  const grad = String(v.backgroundGradient ?? "").trim();
  const themeCls = THEMES[grad.toLowerCase()] ?? "";
  const customGrad = grad && !themeCls ? grad : "";
  const img = String(v.backgroundImageUrl ?? "").trim();
  const buttons: any[] = Array.isArray(v.buttons) ? v.buttons : [];
  const metrics: any[] = Array.isArray(v.metrics) ? [...v.metrics].sort((a, b) => (a?.index ?? 0) - (b?.index ?? 0)) : [];
  const primary = buttons.find((b) => b?.isPrimary) ?? null;
  const rest = buttons.filter((b) => b !== primary);
  const style: Record<string, string> = {};
  if (img) style["--bg-image"] = `url("${img.replace(/"/g, "%22")}")`;
  if (customGrad) style.background = customGrad;

  return (
    <div className={styles.carousel}>
      <div
        className={`${styles.band} ${themeCls} ${img ? styles.photo : ""}`}
        style={Object.keys(style).length ? (style as CSSProperties) : undefined}
      >
        <div className={styles.content}>
          <div className={styles.eyebrow}>
            <span>&#10022;</span> {v.tag || <span className={styles.empty}>Tag</span>}
          </div>
          <h1 className={styles.heading}>
            {v.title ? emphasise(String(v.title)) : <span className={styles.empty}>Title</span>}
          </h1>
          <p className={styles.sub}>{v.description || <span className={styles.empty}>Description</span>}</p>
          {buttons.length > 0 && (
            <div className={styles.ctas}>
              {primary && <span className={styles.cta}>{primary.label || "Button"} &rarr;</span>}
              {rest.map((b, i) => (
                <span key={i} className={styles.cta2}>{b?.label || "Button"}</span>
              ))}
            </div>
          )}
          {metrics.length > 0 && (
            <div className={styles.stats}>
              {metrics.map((m, j) => (
                <div key={j}>
                  <div className={styles.statN}>{m?.metric}</div>
                  <div className={styles.statL}>{m?.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {!grad && !img && (
        <div style={{ margin: "8px 0 0", fontSize: 12, color: "#8a8f8b", fontFamily: "Poppins, sans-serif" }}>
          No background set — text may be unreadable on the site.
        </div>
      )}
    </div>
  );
}
