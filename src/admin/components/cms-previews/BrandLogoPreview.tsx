// Navbar logo area on a light and a dark strip.
// Ported from interior-bazzar-frontend/src/components/layout/Portal/PortalHeader/index.tsx (.logo img).
// The frontend navbar has no tagline or dark variant; those are added around the real logo markup.
import styles from "../../../styles/cms-previews/BrandLogoPreview.module.css";

const Placeholder = () => (
  <svg width="120" height="38" viewBox="0 0 120 38" aria-hidden="true">
    <rect width="120" height="38" rx="6" fill="#9aa39e" fillOpacity="0.35" />
    <text x="60" y="24" textAnchor="middle" fontSize="11" fill="#5f6862" fontFamily="Poppins, sans-serif">logo</text>
  </svg>
);

export default function BrandLogoPreview({ v }: { v: Record<string, any> }) {
  const src = String(v.imageUrl ?? "").trim();
  const row = (cls: string) => (
    <div className={`${styles.strip} ${cls}`}>
      <span className={styles.logo}>
        {src ? <img src={src} alt={v.label || "Logo"} /> : <Placeholder />}
      </span>
      {v.tagline ? <span className={styles.tagline}>{v.tagline}</span> : null}
    </div>
  );
  return (
    <div className={styles.root}>
      {row(styles.light)}
      {row(styles.dark)}
    </div>
  );
}
