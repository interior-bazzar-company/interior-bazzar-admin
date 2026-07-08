// ── SupportView ── admin Support Desk (port of prototype supportView).
// Status tabs + ticket list + detail modal with reply + close.
// Data: /api/v1/admin/support/.
import styles from "../shared.module.css";
import useSupportView, { SUPPORT_TABS } from "./useSupportView";

const label = (s: string) => s.replace(/_/g, " ");

const SupportView = () => {
  const v = useSupportView();

  return (
    <div>
      <div className={styles.head}>
        <h1>Support Desk</h1>
        <p>User support tickets. Reply and close as you resolve them.</p>
      </div>

      {v.notice && <div className={`${styles.notice} ${v.notice.kind === "ok" ? styles.ok : styles.err}`}>{v.notice.msg}</div>}

      <div className={styles.tabs}>
        {SUPPORT_TABS.map((t) => (
          <button key={t} type="button" className={`${styles.tab} ${v.tab === t ? styles.tabActive : ""}`} onClick={() => v.setTab(t)}>{label(t)}</button>
        ))}
      </div>

      {v.loading ? (
        <div className={styles.empty}>Loading tickets…</div>
      ) : v.rows.length === 0 ? (
        <div className={styles.empty}>No {label(v.tab)} tickets.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Subject</th><th>From</th><th>Status</th><th>Updated</th><th></th></tr></thead>
            <tbody>
              {v.rows.map((t) => (
                <tr key={t.id}>
                  <td>{t.subject}</td>
                  <td>{t.user || t.email || "—"}</td>
                  <td><span className={styles.pill}>{label(t.status)}</span></td>
                  <td>{(t.lastReplyAt || t.createdAt || "").slice(0, 10) || "—"}</td>
                  <td className={styles.actions}><button type="button" className={styles.edit} onClick={() => v.open(t.id)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {v.detail && (
        <div className={styles.overlay} onClick={v.close}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>{v.detail.subject}</h2>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
              From {v.detail.user || v.detail.email || "—"} · {label(v.detail.status)}
            </div>
            <div style={{ background: "#f8fafb", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 14 }}>{v.detail.message}</div>

            {v.detail.replies?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {v.detail.replies.map((r, i) => (
                  <div key={i} style={{ borderLeft: "3px solid #085041", padding: "6px 10px", marginBottom: 8, background: "#f4f8f6" }}>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{r.by} · {(r.ts || "").slice(0, 16).replace("T", " ")}</div>
                    <div style={{ fontSize: 14 }}>{r.body}</div>
                  </div>
                ))}
              </div>
            )}

            {v.detail.status !== "closed" && (
              <>
                <textarea rows={3} placeholder="Write a reply…" value={v.reply} onChange={(e) => v.setReply(e.target.value)}
                  style={{ width: "100%", padding: 10, border: "1px solid #cbd5e1", borderRadius: 8, fontFamily: "inherit", marginBottom: 10 }} />
                <div className={styles.modalActions}>
                  <button type="button" className={styles.save} disabled={v.busy || !v.reply.trim()} onClick={v.sendReply}>Send reply</button>
                  <button type="button" className={styles.del} disabled={v.busy} onClick={v.closeTicket}>Close ticket</button>
                  <button type="button" className={styles.cancel} onClick={v.close}>Dismiss</button>
                </div>
              </>
            )}
            {v.detail.status === "closed" && <button type="button" className={styles.cancel} onClick={v.close}>Close</button>}
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportView;
