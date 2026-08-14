/* =====================================================================
   ROLES — the role drawer. Ported from roleDrawer() in views-team.js.
   Everything the row cannot say: who holds this role, and what it
   actually resolves to.
   ===================================================================== */
import { IBTeam } from "../../engines";
import { Icon, Notice, Pill, SectionHead, Table, cap } from "../../ui";
import { can } from "../../shell/AdminShell";
import { MatrixTable, StatusPill, actor } from "../teamShared";
import type { Member, Ops, Role } from "../teamShared";
import { RoleDeleteModal, RoleModal } from "./roleModals";

export default function RoleDrawer({ id, ops }: { id: string; ops: Ops }) {
  const r: Role | null = IBTeam.roleOf(id);
  if (!r) return null;                       // the view has already toast+redirected
  const mem: Member[] = IBTeam.members().filter(
    (u: Member) => IBTeam.roleIdsOf(u).indexOf(id) >= 0);
  const me = IBTeam.currentUser();
  const iHold = !!(me && IBTeam.roleIdsOf(me).indexOf(id) >= 0 && !IBTeam.isSuper(me));

  function setStatus(status: string, msg: string) {
    const res = IBTeam.Roles.update(id, { status }, actor());
    if (res.ok === false) return ops.toast(res.http + " " + res.code + " — " + res.detail, "bad");
    ops.toast(msg);
    ops.refresh();
  }

  return (
    <>
      <div className="dw-h">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: "var(--text-2xl)", fontWeight: 600 }}>{r.name}</h2>
              <Pill text={cap(r.status)} tone={r.status === "active" ? "ok" : ""} />
              {r.is_super ? <Pill text="Protected" tone="brand" /> : null}
            </div>
            <div style={{ fontSize: "var(--text-md)", color: "var(--text-2)", marginTop: 5 }}>
              {r.description || "No description"}
            </div>
          </div>
          <span className="spacer"></span>
          <button className="btn icon sm" data-go="#/roles" aria-label="Close"
                  onClick={() => { ops.closeLayer(); ops.go("#/roles"); }}><Icon name="x" /></button>
        </div>
      </div>

      <div className="dw-b">
        {r.status !== "active" ? (
          <Notice tone="warn" ico="lock" text={
            <><b>This role is inactive, so it grants nothing.</b> The {mem.length} member(s) holding
              it keep it on their record and lose its access until it is switched back on.</>
          } />
        ) : null}
        {iHold ? (
          <Notice tone="warn" ico="shield" text={
            <><b>You hold this role.</b> Its permissions are read-only for you — nobody edits the
              permissions they are standing on. Another admin can change it.</>
          } />
        ) : null}

        <SectionHead title="Permissions" />
        <MatrixTable role={r} />

        <SectionHead title="Members with this role" />
        {mem.length ? (
          <Table
            cols={[{ label: "Member" }, { label: "Designation" }, { label: "Status" }]}
            rows={mem.map((u) => (
              <tr key={u.id} className="clickable" data-go={"#/team/" + u.id}
                  onClick={() => { ops.closeLayer(); ops.go("#/team/" + u.id); }}>
                <td><b>{u.name}</b><div className="cell-2 mono">{u.email}</div></td>
                <td>{u.designation || "—"}</td>
                <td><StatusPill s={u.status} /></td>
              </tr>
            ))}
          />
        ) : (
          <div className="faint">Nobody holds this role yet.</div>
        )}
      </div>

      <div className="dw-f">
        {r.is_super ? (
          <div className="faint">
            Super Admin is defined by the system: it holds everything, cannot be edited, deactivated
            or deleted, and is what makes the panel recoverable.
          </div>
        ) : (
          <>
            {can("roles", "edit") && !iHold ? (
              <button className="btn pri" data-act="rl-edit" data-ref={r.role_id}
                      onClick={() => ops.modal(<RoleModal role={r} ops={ops} />, "wide")}>Edit role</button>
            ) : null}
            <span className="spacer"></span>
            {can("roles", "status") && !iHold ? (
              r.status === "active"
                ? <button className="btn" data-act="rl-off" data-ref={r.role_id}
                          onClick={() => setStatus("inactive", "Role deactivated — it now grants nothing.")}>Deactivate</button>
                : <button className="btn" data-act="rl-on" data-ref={r.role_id}
                          onClick={() => setStatus("active", "Role active.")}>Activate</button>
            ) : null}
            {can("roles", "edit") && !iHold ? (
              <button className="btn dgr" data-act="rl-del" data-ref={r.role_id}
                      onClick={() => ops.modal(<RoleDeleteModal role={r} ops={ops} />)}>Delete</button>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
