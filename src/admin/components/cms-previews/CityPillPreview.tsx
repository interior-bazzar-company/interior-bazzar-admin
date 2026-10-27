// The public city selector: pill + open "Choose your city" panel, with this city selected among neighbours.
// Ported from interior-bazzar-frontend components/Home/portal/HomeSearch/index.tsx (city segment) and
// shared/LocationModal/useLocationModal.ts (IB_CITIES). The public list has no featured / tier marking, so none is drawn.
import styles from "../../../styles/cms-previews/CityPillPreview.module.css";

export default function CityPillPreview({ v }: { v: Record<string, any> }) {
  const name = String(v?.name ?? "").trim();
  const aliases: string[] = Array.isArray(v?.aliases) ? v.aliases.map((a) => String(a).trim()).filter(Boolean) : [];
  const shown = name || "City";
  const list = [shown, ...["Gurugram", "Noida", "Faridabad"].filter((c) => c.toLowerCase() !== shown.toLowerCase()).slice(0, 2)];

  return (
    <div className={styles.root}>
      <div className={styles.city}>
        <span className={styles.pin} aria-hidden="true">&#128205;</span>
        <span className={styles.cityName} style={name ? undefined : { opacity: 0.4 }}>{shown}</span>
        <span className={styles.chev} aria-hidden="true">&#9662;</span>
      </div>
      <div className={styles.panel}>
        <div className={styles.panelTitle}>Choose your city</div>
        <div className={styles.cityFilter}>
          <span aria-hidden="true">&#128269;</span> Search city…
        </div>
        <ul>
          {list.map((c, i) => (
            <li key={c}>
              <div className={`${styles.cityOpt} ${i === 0 ? styles.optOn : ""}`}>
                <span className={styles.ico} aria-hidden="true">&#128205;</span>
                <span className={styles.cityOptName}>{c}</span>
                {i === 0 && <span className={styles.check} aria-hidden="true">&#10003;</span>}
              </div>
            </li>
          ))}
        </ul>
      </div>
      {aliases.length > 0 && <div className={styles.note}>Also matches: {aliases.join(", ")}</div>}
    </div>
  );
}
