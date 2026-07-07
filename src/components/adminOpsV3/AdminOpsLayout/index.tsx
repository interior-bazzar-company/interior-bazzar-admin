// ── AdminOpsLayout ──
// Shell for the v3 admin ops console: topbar + collapsible sidebar (React port
// of the prototype MODULES nav, Frontend group excluded) + content slot.
// Per-module views are built by promptsadmin tasks 13-40; until then the content
// slot shows a PlaceholderView naming the active module.
// Chrome dimensions/tokens mirror prototype/dashboard-admin.html (see
// workflows/admin-visual-ref.md): topbar 64px, sidebar 268px, brand green.
import type { ReactNode } from "react";
import styles from "./AdminOpsLayout.module.css";
import useAdminOpsLayout from "./useAdminOpsLayout";
import { VIEW_REGISTRY } from "../views/registry";

const AdminOpsLayout = ({ children }: { children?: ReactNode }) => {
  const v = useAdminOpsLayout();

  return (
    <div className={styles.shell}>
      {/* Topbar */}
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>IB</span>
          <span className={styles.brandText}>Ops Console</span>
        </div>
        {/* TODO(task 55): resolve role + user menu from /me/permissions */}
        <div className={styles.topRight}>
          <span className={styles.roleBadge}>{v.roleLabel}</span>
        </div>
      </header>

      {/* Sidebar */}
      <aside className={styles.sidebar}>
        {v.nav.map((g) => {
          const isCollapsed = v.collapsed.has(g.grp);
          if (g.solo) {
            const item = g.items[0];
            return (
              <button
                key={g.grp}
                type="button"
                className={`${styles.navItem} ${styles.solo} ${v.activeKey === item.key ? styles.active : ""}`}
                onClick={() => v.goSection(item.key)}
              >
                <i className={`ti ti-${item.icon}`} /> {item.label}
              </button>
            );
          }
          return (
            <div key={g.grp} className={styles.group}>
              <button type="button" className={styles.groupHead} onClick={() => v.toggleGroup(g.grp)}>
                <span>{g.grp}</span>
                <i className={`ti ti-chevron-${isCollapsed ? "right" : "down"}`} />
              </button>
              {!isCollapsed &&
                g.items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`${styles.navItem} ${v.activeKey === item.key ? styles.active : ""}`}
                    onClick={() => v.goSection(item.key)}
                  >
                    <i className={`ti ti-${item.icon}`} /> {item.label}
                  </button>
                ))}
            </div>
          );
        })}
      </aside>

      {/* Content — a built module renders its registered view (views/registry);
          the rest show a placeholder until their promptsadmin port task lands. */}
      <main className={styles.content}>
        {children ?? (() => {
          const ActiveView = VIEW_REGISTRY[v.activeKey];
          return ActiveView ? (
            <ActiveView goSection={v.goSection} />
          ) : (
            <div className={styles.placeholder}>
              <div className={styles.phEyebrow}>Admin Ops Console</div>
              <h1 className={styles.phTitle}>{v.activeLabel}</h1>
              <p className={styles.phSub}>
                This module's React port is scheduled in promptsadmin (tasks 13–61).
                Scaffold only — no data wired yet.
              </p>
            </div>
          );
        })()}
      </main>
    </div>
  );
};

export default AdminOpsLayout;
