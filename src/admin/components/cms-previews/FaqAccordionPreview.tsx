import { useState } from "react";
import styles from "../../../styles/cms-previews/FaqAccordionPreview.module.css";

export default function FaqAccordionPreview({ v }: { v: Record<string, any> }) {
  const [open, setOpen] = useState(true);
  const q = String(v?.question ?? "").trim();
  const a = String(v?.answer ?? "");
  return (
    <div className={styles.root}>
      <div className={styles.accordion}>
        <div className={`${styles.item} ${open ? styles.open : ""}`}>
          <button type="button" className={styles.question} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <span className={q ? undefined : styles.empty}>{q || "Question appears here"}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6l6 -6" />
            </svg>
          </button>
          {a.trim() ? (
            <div className={styles.answer} dangerouslySetInnerHTML={{ __html: a }} />
          ) : (
            <div className={`${styles.answer} ${styles.empty}`}>Answer appears here</div>
          )}
        </div>
      </div>
    </div>
  );
}
