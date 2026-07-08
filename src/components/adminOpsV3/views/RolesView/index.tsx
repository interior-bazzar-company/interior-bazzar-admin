// ── RolesView ── admin Roles & Permissions matrix (port of prototype rolesView).
// role × module → level(0-3) grid; click a cell to cycle the level; save per role.
// super_admin column is full-access (read-only). Data: /api/v1/admin/roles/.
import styles from "./RolesView.module.css";
import shared from "../shared.module.css";
import useRolesView from "./useRolesView";

const LEVELS = ["—", "R", "W", "S"]; // 0 none / 1 read / 2 write / 3 sensitive

const RolesView = () => {
  const v = useRolesView();

  return (
    <div>
      <div className={shared.head}>
        <h1>Roles &amp; Permissions</h1>
        <p>Level per role × module: — none · R read · W write · S sensitive (audited). Click a cell to change. super_admin is full-access.</p>
      </div>

      {v.notice && <div className={`${shared.notice} ${v.notice.kind === "ok" ? shared.ok : shared.err}`}>{v.notice.msg}</div>}

      {v.loading ? (
        <div className={shared.empty}>Loading roles…</div>
      ) : (
        <div className={styles.gridWrap}>
          <table className={styles.grid}>
            <thead>
              <tr>
                <th className={styles.corner}>Module</th>
                {v.roles.map((r) => (
                  <th key={r.name} className={styles.roleHead}>
                    {r.name}
                    {!r.isFullAccess && (
                      <button type="button" className={styles.saveBtn} disabled={!v.dirty[r.name] || v.saving === r.name} onClick={() => v.saveRole(r)}>
                        {v.saving === r.name ? "…" : v.dirty[r.name] ? "Save" : "Saved"}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {v.moduleKeys.map((mod) => (
                <tr key={mod}>
                  <td className={styles.modCell}>{mod}</td>
                  {v.roles.map((r) => {
                    const lvl = r.isFullAccess ? 3 : (r.modules[mod] ?? 0);
                    return (
                      <td
                        key={r.name}
                        className={`${styles.cell} ${styles["lvl" + lvl]} ${r.isFullAccess ? styles.locked : ""}`}
                        onClick={() => v.cycle(r.name, mod)}
                        title={r.isFullAccess ? "full access" : "click to cycle"}
                      >
                        {LEVELS[lvl]}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RolesView;
