// ── WeightsView ── admin Qualification Weights (task 15). Fixed signal + tier-
// threshold sliders with a live score/tier preview. UI only; logic in the hook.
import styles from "../shared.module.css";
import useWeightsView, { SIGNALS, THRESHOLDS, type SliderDef } from "./useWeightsView";

const WeightsView = () => {
  const v = useWeightsView();

  const slider = (s: SliderDef) => (
    <div key={s.key} className={styles.sliderRow}>
      <span className={styles.sliderLabel}>{s.label}</span>
      <input
        type="range"
        min={s.min}
        max={s.max}
        value={v.values[s.key] ?? s.def}
        onChange={(e) => v.setValue(s.key, Number(e.target.value))}
      />
      <span className={styles.sliderVal}>+{v.values[s.key] ?? s.def}</span>
    </div>
  );

  return (
    <div>
      <div className={styles.head}>
        <div>
          <h1>Qualification Weights</h1>
          <p>Signal weights + tier thresholds the lead qualification pipeline reads. Only NEW leads are affected. Changes are audited.</p>
        </div>
        <button type="button" className={styles.cancel} onClick={v.resetDefaults}>Reset defaults</button>
      </div>

      {v.notice && <div className={`${styles.notice} ${v.notice.kind === "ok" ? styles.ok : styles.err}`}>{v.notice.msg}</div>}

      {v.loading ? (
        <div className={styles.empty}>Loading weights…</div>
      ) : (
        <>
          <div className={styles.preview}>
            <span>Sample fully-qualified lead scores</span>
            <b className={styles.previewScore}>{v.preview.score}</b>
            <span className={`${styles.pill} ${styles[`tier${v.preview.tier}`] || ""}`}>Tier {v.preview.tier}</span>
            <span className={styles.previewNote}>urgency signals not yet scored (no timeline field)</span>
          </div>

          <h3 className={styles.sliderGroupHead}>Signals</h3>
          {SIGNALS.map(slider)}

          <h3 className={styles.sliderGroupHead}>Tier thresholds</h3>
          {THRESHOLDS.map(slider)}

          <div style={{ marginTop: 18 }}>
            <button type="button" className={styles.save} disabled={v.saving} onClick={v.save}>{v.saving ? "Saving…" : "Save weights"}</button>
          </div>
        </>
      )}
    </div>
  );
};

export default WeightsView;
