// ── AuditView ── admin Audit Log (port of prototype auditView). Append-only,
// read-only table (actor/role/action/module/detail/ts). Data: /api/v1/admin/audit/.
import styles from "../shared.module.css";
import useAuditView from "./useAuditView";

const AuditView = () => {
  const v = useAuditView();

  return (
    <div>
      <div className={styles.head}>
        <h1>Audit Log</h1>
        <p>Append-only record of every sensitive (level-3) action across the console.</p>
      </div>

      <div className={styles.search} style={{ marginBottom: 14 }}>
        <input placeholder="Filter by module (e.g. refunds)" value={v.module} onChange={(e) => v.filterModule(e.target.value)} />
      </div>

      {v.loading ? (
        <div className={styles.empty}>Loading audit log…</div>
      ) : v.entries.length === 0 ? (
        <div className={styles.empty}>No audit entries{v.module ? ` for “${v.module}”` : ""}.</div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>When</th><th>Actor</th><th>Role</th><th>Module</th><th>Action</th><th>Detail</th></tr></thead>
              <tbody>
                {v.entries.map((e) => (
                  <tr key={e.id}>
                    <td>{e.ts ? e.ts.replace("T", " ").slice(0, 19) : "—"}</td>
                    <td>{e.actor || "system"}</td>
                    <td>{e.role || "—"}</td>
                    <td className={styles.mono}>{e.module}</td>
                    <td>{e.action}</td>
                    <td style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis" }}>{e.detail || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14 }}>
            <button type="button" className={styles.edit} disabled={v.pageNo <= 1} onClick={() => v.setPageNo(v.pageNo - 1)}>← Prev</button>
            <span style={{ fontSize: 13, color: "#6b7280" }}>Page {v.pageNo} of {v.totalPages} · {v.total} entries</span>
            <button type="button" className={styles.edit} disabled={v.pageNo >= v.totalPages} onClick={() => v.setPageNo(v.pageNo + 1)}>Next →</button>
          </div>
        </>
      )}
    </div>
  );
};

export default AuditView;
