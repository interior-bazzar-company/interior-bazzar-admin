// ── AdminOpsLogin ── staff sign-in for the v3 admin ops console.
// React port of prototype/admin-login.html (green gradient card, Admin badge,
// icon fields, shake-on-error) wired to the real backend via useAdminOpsLogin.
import styles from "./AdminOpsLogin.module.css";
import useAdminOpsLogin from "./useAdminOpsLogin";

const AdminOpsLogin = () => {
  const v = useAdminOpsLogin();

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") v.signIn();
  };

  return (
    <div className={styles.page}>
      <div className={`${styles.card} ${v.shake ? styles.shake : ""}`}>
        <div className={styles.brand}>
          <span className={styles.name}>Interior bazzar</span>
          <span className={styles.badge}>Admin</span>
        </div>
        <div className={styles.sub}>Staff sign in — separate from the public portal.</div>

        {v.error && (
          <div className={styles.err}>
            <i className="ti ti-alert-circle" />
            <span>{v.error}</span>
          </div>
        )}

        <div className={styles.fld}>
          <label htmlFor="ops-user">Username</label>
          <div className={styles.in}>
            <i className="ti ti-user" />
            <input
              id="ops-user"
              type="text"
              autoComplete="username"
              placeholder="your staff username"
              className={v.error ? styles.inputError : ""}
              value={v.email}
              onChange={(e) => { v.setEmail(e.target.value); v.clearError(); }}
              onKeyDown={onKeyDown}
            />
          </div>
        </div>

        <div className={styles.fld}>
          <label htmlFor="ops-pw">Password</label>
          <div className={styles.in}>
            <i className="ti ti-lock" />
            <input
              id="ops-pw"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className={v.error ? styles.inputError : ""}
              value={v.password}
              onChange={(e) => { v.setPassword(e.target.value); v.clearError(); }}
              onKeyDown={onKeyDown}
            />
          </div>
        </div>

        <button type="button" className={styles.btn} disabled={v.loading} onClick={v.signIn}>
          <i className="ti ti-shield-check" /> {v.loading ? "Signing in…" : "Sign in to admin"}
        </button>

        <div className={styles.foot}>
          <div className={styles.tag}>Little things.</div>
        </div>
      </div>
    </div>
  );
};

export default AdminOpsLogin;
