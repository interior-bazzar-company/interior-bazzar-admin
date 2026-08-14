/* =====================================================================
   ROLES — the role drawer. What the row cannot say: its per-module levels.

   "Members with this role" is not re-derived here from a member list — the
   Team list endpoint only returns members the SIGNED-IN admin created
   (interior_admin's `getSelfCreatedUsersController`), so filtering it
   client-side would undercount and read as authoritative when it is not.
   `userCount`, from the server, is the real total and is what is shown.
   ===================================================================== */
import type { RolesModuleDef } from "../../../api/modules/adminOps";
import { Icon, Pill } from "../../ui";
import { can } from "../../shell/AdminShell";
import { LevelMatrix } from "../teamShared";
import type { Ops, Role } from "../teamShared";
import { RoleDeleteModal, RoleModal } from "./roleModals";

export default function RoleDrawer({ role: r, mods, ops }: { role: Role; mods: RolesModuleDef[]; ops: Ops }) {
  return (
    <>
      <div className="dw-h">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: "var(--text-2xl)", fontWeight: 600 }}>{r.name}</h2>
              {r.isSystem ? <Pill text="Protected" tone="brand" /> : null}
            </div>
            <div style={{ fontSize: "var(--text-md)", color: "var(--text-2)", marginTop: 5 }}>
              {r.userCount} member{r.userCount === 1 ? "" : "s"} hold this role
            </div>
          </div>
          <span className="spacer"></span>
          <button className="btn icon sm" data-go="#/roles" aria-label="Close"
                  onClick={() => { ops.closeLayer(); ops.go("#/roles"); }}><Icon name="x" /></button>
        </div>
      </div>

      <div className="dw-b">
        <LevelMatrix mods={mods} levels={r.isFullAccess ? null : r.modules} />
      </div>

      <div className="dw-f">
        {r.isSystem ? (
          <div className="faint">
            This role is defined by the system: it cannot be edited or deleted.
          </div>
        ) : (
          <>
            {can("roles", "edit") ? (
              <button className="btn pri" data-act="rl-edit" data-ref={r.id}
                      onClick={() => ops.modal(<RoleModal role={r} mods={mods} ops={ops} />, "wide")}>Edit role</button>
            ) : null}
            <span className="spacer"></span>
            {can("roles", "edit") ? (
              <button className="btn dgr" data-act="rl-del" data-ref={r.id}
                      onClick={() => ops.modal(<RoleDeleteModal role={r} ops={ops} />)}>Delete</button>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
