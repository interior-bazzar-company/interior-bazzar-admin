// ── WeightsView ── admin Qualification Weights (task 33). Four importance sliders
// (each showing its live effective %), tier thresholds, a normalized-formula
// preview, and a help modal. UI only; logic in the hook.
import type { CSSProperties } from "react";
import styles from "../shared.module.css";
import useWeightsView, { SIGNALS, THRESHOLDS, type SliderDef } from "./useWeightsView";

const WeightsView = () => {
  const v = useWeightsView();

  const rangeInput = (s: SliderDef) => (
    <input
      type="range"
      min={s.min}
      max={s.max}
      value={v.values[s.key] ?? s.def}
      onChange={(e) => v.setValue(s.key, Number(e.target.value))}
    />
  );

  // Signal rows show the live effective % ("Contact — 44% of score"); the value
  // column holds the raw importance being dragged.
  const signalRow = (s: SliderDef) => (
    <div key={s.key} className={styles.sliderRow}>
      <span className={styles.sliderLabel} title={s.hint}>
        {s.label} — <b style={{ color: "#085041" }}>{v.effectivePct(s.key)}% of score</b>
      </span>
      {rangeInput(s)}
      <span className={styles.sliderVal}>{v.values[s.key] ?? s.def}</span>
    </div>
  );

  const thresholdRow = (s: SliderDef) => (
    <div key={s.key} className={styles.sliderRow}>
      <span className={styles.sliderLabel} title={s.hint}>{s.label}</span>
      {rangeInput(s)}
      <span className={styles.sliderVal}>{v.values[s.key] ?? s.def}</span>
    </div>
  );

  return (
    <div>
      <div className={styles.head}>
        <div>
          <h1>
            Qualification Weights{" "}
            <button
              type="button"
              onClick={() => v.setHelpOpen(true)}
              title="How does scoring work?"
              aria-label="How qualification scoring works"
              style={{ background: "none", border: "none", cursor: "pointer", color: "#085041", fontSize: 18, verticalAlign: "middle" }}
            >
              <i className="ti ti-info-circle" />
            </button>
          </h1>
          <p>Relative importance of each qualification signal, plus the tier score thresholds. Scoring is a normalized weighted average, so a lead always scores 0–100. Only NEW leads are affected; changes are audited.</p>
        </div>
        <button type="button" className={styles.cancel} onClick={v.resetDefaults}>Reset defaults</button>
      </div>

      {v.notice && <div className={`${styles.notice} ${v.notice.kind === "ok" ? styles.ok : styles.err}`}>{v.notice.msg}</div>}

      {v.loading ? (
        <div className={styles.empty}>Loading weights…</div>
      ) : (
        <>
          <div className={styles.preview}>
            <span>A perfect lead scores</span>
            <b className={styles.previewScore}>{v.preview.score}</b>
            <span className={`${styles.pill} ${styles[`tier${v.preview.tier}`] || ""}`}>Tier {v.preview.tier}</span>
            <span className={styles.previewNote}>
              A typical lead (phone + name, part-detailed, 90-day) scores {v.preview.sample} → Tier {v.preview.sampleTier}. Weights change each signal's share, not the 0–100 range.
            </span>
          </div>

          <h3 className={styles.sliderGroupHead}>Signals — relative importance</h3>
          {SIGNALS.map(signalRow)}

          <h3 className={styles.sliderGroupHead}>Tier thresholds</h3>
          {THRESHOLDS.map(thresholdRow)}

          <div style={{ marginTop: 18 }}>
            <button type="button" className={styles.save} disabled={v.saving} onClick={v.save}>{v.saving ? "Saving…" : "Save weights"}</button>
          </div>
        </>
      )}

      {v.helpOpen && (
        <div className={styles.overlay} onClick={() => v.setHelpOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>How lead qualification scoring works</h2>

            <p style={{ fontSize: 13, color: "#4b5563", marginBottom: 12 }}>
              Every new enquiry is scored 0–100 from four signals, then sorted into a tier (A–E). Budget is deliberately never a signal.
            </p>

            <h4 style={helpH4}>The four signals</h4>
            <ul style={helpUl}>
              <li><b>Contact</b> — the lead left a valid 10-digit phone.</li>
              <li><b>Genuineness</b> — the name looks real (not gibberish/blank).</li>
              <li><b>Detail</b> — how substantial the enquiry text is.</li>
              <li><b>Urgency</b> — the buyer's stated timeline (within 30 days &gt; 90 days &gt; 90+ &gt; just browsing).</li>
            </ul>

            <h4 style={helpH4}>How the math works</h4>
            <ul style={helpUl}>
              <li>The sliders set <b>relative importance</b>, not points. The number next to each slider — its <b>effective %</b> — is that signal's real share (weight ÷ total).</li>
              <li>Score is a normalized weighted average: <code>100 × Σ(weight × signalStrength) ÷ Σweight</code>. It can never exceed 100, whatever you set.</li>
              <li>A perfect lead (every signal fully present) always scores exactly 100.</li>
            </ul>

            <h4 style={helpH4}>Tiers</h4>
            <ul style={helpUl}>
              <li>A score at or above the <b>Tier A</b> threshold is Tier A, and so on down to Tier E (below Tier D). Thresholds are editable and must stay in order A &gt; B &gt; C &gt; D.</li>
            </ul>

            <h4 style={helpH4}>When it applies</h4>
            <ul style={helpUl}>
              <li>Weights apply to <b>new leads only</b>. Existing leads keep their score unless an admin runs the re-score command (<code>manage.py rescore_leads</code>).</li>
            </ul>

            <h4 style={helpH4}>Worked example (with default weights)</h4>
            <div style={{ fontSize: 13, color: "#4b5563", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
              Lead: valid phone (contact 1.0), real name (genuineness 1.0), a short enquiry (detail 0.6), 30–90 day timeline (urgency 0.66).<br />
              <code>100 × (40×1.0 + 25×1.0 + 15×0.6 + 20×0.66) ÷ 100</code><br />
              <code>= 100 × (40 + 25 + 9 + 13.2) ÷ 100 = 87</code> → <b>Tier B</b> (≥ 75).
            </div>

            <div className={styles.modalActions} style={{ justifyContent: "flex-end", marginTop: 16 }}>
              <button type="button" className={styles.save} onClick={() => v.setHelpOpen(false)}>Got it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const helpH4: CSSProperties = { fontSize: 13, fontWeight: 700, color: "#16233a", margin: "12px 0 4px" };
const helpUl: CSSProperties = { fontSize: 13, color: "#4b5563", paddingLeft: 18, margin: 0, display: "flex", flexDirection: "column", gap: 4 };

export default WeightsView;
