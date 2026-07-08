// ── WebView ── admin Website Analytics (task 27 + master task 16). Headline
// totals + ENQUIRY-derived analytics (source / page / funnel / daily) over a date
// range. Raw web sessions/visitors/bounce are DEFERRED (see useWebView note).
import styles from "../shared.module.css";
import useWebView, { type Bar } from "./useWebView";

const hbar = (rows: Bar[]) => {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className={styles.hbars}>
      {rows.length === 0 ? <div className={styles.empty}>No enquiries in range.</div> : rows.map((r) => (
        <div key={r.label} className={styles.hbarRow}>
          <span className={styles.hbarLabel}>{r.label}</span>
          <span className={styles.hbarTrack}><span className={styles.hbarFill} style={{ width: `${(r.count / max) * 100}%` }} /></span>
          <span className={styles.hbarVal}>{r.count}</span>
        </div>
      ))}
    </div>
  );
};

const WebView = () => {
  const v = useWebView();
  const d = v.d;

  const tiles: Array<[string, number | undefined]> = [
    ["Total users", d?.totalUsers], ["Buyers", d?.buyers], ["Businesses", d?.businesses],
    ["Verified businesses", d?.verifiedBusinesses], ["Leads", d?.leads], ["Blog posts", d?.blogs],
  ];

  const funnel = d?.funnel ?? [];
  const daily = d?.enquiriesDaily ?? [];
  const dailyMax = Math.max(1, ...daily.map((p) => p.count));

  return (
    <div>
      <div className={styles.head}>
        <div>
          <h1>Website Analytics</h1>
          <p>Platform totals + enquiry-derived analytics. (Raw web sessions/visitors/bounce are not yet tracked.)</p>
        </div>
        <div className={styles.search}>
          <input type="date" value={v.start} onChange={(e) => v.setStart(e.target.value)} aria-label="Start date" />
          <input type="date" value={v.end} onChange={(e) => v.setEnd(e.target.value)} aria-label="End date" />
        </div>
      </div>

      {v.loading ? <div className={styles.empty}>Loading analytics…</div> : (
        <>
          <div className={styles.kpis}>
            {tiles.map(([label, val]) => (
              <div key={label} className={styles.kpi}><div className={styles.val}>{val ?? "—"}</div><div className={styles.lbl}>{label}</div></div>
            ))}
          </div>

          <div className={styles.analyticsGrid}>
            <div className={styles.panel}>
              <h3 className={styles.sliderGroupHead}>Enquiries by source</h3>
              {hbar(d?.leadsBySource ?? [])}
            </div>
            <div className={styles.panel}>
              <h3 className={styles.sliderGroupHead}>Enquiries by page</h3>
              {hbar(d?.leadsByOrigin ?? [])}
            </div>
          </div>

          <div className={styles.panel}>
            <h3 className={styles.sliderGroupHead}>Enquiry funnel</h3>
            <div className={styles.funnel}>
              {funnel.map((f, i) => {
                const prev = i > 0 ? funnel[i - 1].count : f.count;
                const drop = prev > 0 ? Math.round((1 - f.count / prev) * 100) : 0;
                return (
                  <div key={f.label} className={styles.funnelStep}>
                    <div className={styles.funnelVal}>{f.count}</div>
                    <div className={styles.funnelLabel}>{f.label}</div>
                    {i > 0 && drop > 0 && <div className={styles.funnelDrop}>−{drop}%</div>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.panel}>
            <h3 className={styles.sliderGroupHead}>Enquiries per day</h3>
            {daily.length === 0 ? <div className={styles.empty}>No enquiries in range.</div> : (
              <div className={styles.miniBars}>
                {daily.map((p) => (
                  <div key={p.date} className={styles.miniBarCol} title={`${p.date}: ${p.count}`}>
                    <span className={styles.miniBar} style={{ height: `${(p.count / dailyMax) * 100}%` }} />
                    <span className={styles.miniBarLabel}>{p.date ? p.date.slice(5) : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default WebView;
