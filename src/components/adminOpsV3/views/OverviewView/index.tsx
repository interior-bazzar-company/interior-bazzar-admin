// ── OverviewView ── admin Overview module (port of prototype overviewView).
// KPI tiles + action rail (deep-links to queues via goSection) + enquiries-30d
// chart + active-by-family + recent activity. Data from useOverviewView (see its
// TODO(backend) — wiring to interior_admin aggregates is promptsadmin task 13).
import styles from "./OverviewView.module.css";
import useOverviewView from "./useOverviewView";

const deltaIcon = (d?: "up" | "down" | "flat") =>
  d === "up" ? "trending-up" : d === "down" ? "trending-down" : "minus";

const OverviewView = ({ goSection }: { goSection: (key: string) => void }) => {
  const v = useOverviewView();
  const max = Math.max(1, ...v.daily);

  return (
    <div>
      <div className={styles.head}>
        <div>
          <h1>Overview</h1>
          <p>Live state of the portal — every number computed from real records, none seeded as benchmarks.</p>
        </div>
        <div className={styles.rangePick}>
          {(["30d", "90d", "YTD"] as const).map((r) => (
            <button key={r} className={r === v.range ? styles.on : ""} onClick={() => v.setRange(r)}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* KPI tiles */}
      <div className={styles.tiles}>
        {v.kpis.map((k) => (
          <div key={k.label} className={styles.tile}>
            <div className={styles.tTop}>
              <div className={`${styles.tIcon} ${k.amber ? styles.amber : ""}`}>
                <i className={`ti ti-${k.icon}`} />
              </div>
            </div>
            <div className={styles.tVal}>{k.value}</div>
            <div className={styles.tLabel}>{k.label}</div>
            {k.delta && (
              <div className={`${styles.tDelta} ${styles[k.dcls ?? "flat"]}`}>
                <i className={`ti ti-${deltaIcon(k.dcls)}`} /> {k.delta}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={styles.cols}>
        <div>
          {/* Action rail */}
          <div className={styles.panel}>
            <h3><i className="ti ti-alert-circle" style={{ color: "#ba7517" }} /> Action needed</h3>
            <div className={styles.sub}>Queues waiting on a human. Click through to clear them.</div>
            {v.actions.map((a) => (
              <div key={a.key} className={styles.actionRow}>
                <div className={`${styles.arIcon} ${styles[a.cls]}`}>
                  <i className={`ti ti-${a.icon}`} />
                </div>
                <div className={styles.arBody}>
                  <b>{a.title}</b>
                  <small>{a.sub}</small>
                </div>
                <div className={styles.arCount}>{a.count}</div>
                <button type="button" className={styles.arGo} onClick={() => goSection(a.key)}>Open</button>
              </div>
            ))}
          </div>

          {/* Enquiries chart */}
          <div className={styles.panel}>
            <h3><i className="ti ti-chart-bar" /> Qualified enquiries — last 30 days</h3>
            <div className={styles.sub}>Held &amp; quarantined enquiries are excluded, by design.</div>
            <div className={styles.miniBars}>
              {v.daily.map((val, i) => (
                <div
                  key={i}
                  className={`${styles.mb} ${i >= v.daily.length - 3 ? styles.hi : ""}`}
                  style={{ height: `${(val / max) * 100}%` }}
                />
              ))}
            </div>
            <div className={styles.legend}>
              <span><i style={{ background: "#085041" }} />Last 3 days</span>
              <span><i style={{ background: "#9fe1cb" }} />Earlier</span>
            </div>
          </div>
        </div>

        <div>
          {/* Active by family */}
          <div className={styles.panel}>
            <h3><i className="ti ti-rosette" /> Active by family</h3>
            <div className={styles.sub}>Computed from subscriptions.</div>
            {v.families.map((f) => (
              <div key={f.family} className={styles.feedItem}>
                <div className={styles.feedDot} style={{ background: "#085041" }} />
                <div><b>{f.family}</b><div className={styles.fiTime}>{f.count} active</div></div>
              </div>
            ))}
          </div>

          {/* Recent activity */}
          <div className={styles.panel}>
            <h3><i className="ti ti-history" /> Recent activity</h3>
            <div className={styles.sub}>From the audit log.</div>
            {v.feed.length === 0 ? (
              <div className={styles.sub}>No actions logged yet. Sensitive actions will appear here.</div>
            ) : (
              v.feed.map((e, i) => (
                <div key={i} className={styles.feedItem}>
                  <div className={styles.feedDot} />
                  <div><b>{e.action}</b> · {e.module}<div className={styles.fiTime}>{e.when}</div></div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewView;
