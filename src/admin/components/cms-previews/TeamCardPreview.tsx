import { useState } from "react";
import styles from "../../../styles/cms-previews/TeamCardPreview.module.css";

const initialsOf = (n: string) =>
  n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

export default function TeamCardPreview({ v }: { v: Record<string, any> }) {
  const [bad, setBad] = useState<string>();
  const name = String(v?.name ?? "").trim();
  const role = String(v?.role ?? "").trim();
  const bio = String(v?.bio ?? "").trim();
  const photo = String(v?.photoUrl ?? "").trim();
  const placeholder = !!v?.isPlaceholder;
  const initials = String(v?.initials ?? "").trim() || initialsOf(name);
  const showPhoto = !placeholder && !!photo && bad !== photo;
  return (
    <div className={styles.root}>
      <div className={`${styles.card} ${placeholder ? styles.placeholder : ""}`}>
        <div className={styles.avatar} style={{ background: v?.gradient || "linear-gradient(135deg,#0f4a34,#0b3b29)" }}>
          {placeholder ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          ) : showPhoto ? (
            <img src={photo} alt="" onError={() => setBad(photo)} />
          ) : (
            initials
          )}
        </div>
        <div className={`${styles.name} ${name ? "" : styles.empty}`}>{name || "Name"}</div>
        <div className={`${styles.role} ${role ? "" : styles.empty}`}>{role || "Role"}</div>
        <p className={`${styles.bio} ${bio ? "" : styles.empty}`}>{bio || "Short bio appears here"}</p>
      </div>
    </div>
  );
}
