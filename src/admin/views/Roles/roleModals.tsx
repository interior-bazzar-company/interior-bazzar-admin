/* =====================================================================
   ROLES — the write paths: create, edit, delete. Real requests to
   /api/v1/admin/roles/ now, not the local IBTeam engine.
   ===================================================================== */
import { useState } from "react";
import AdminOpsService from "../../../api/modules/adminOps";
import type { RolesModuleDef } from "../../../api/modules/adminOps";
import { Field, Icon, Notice, SectionHead } from "../../ui";
import { ActionMatrix, ErrSlot, errOf, readActionMatrix, val } from "../teamShared";
import type { EngineErr, Ops, Role } from "../teamShared";

export function RoleModal({ role, mods, ops }: { role: Role | null; mods: RolesModuleDef[]; ops: Ops }) {
  const [err, setErr] = useState<EngineErr | null>(null);
  const [busy, setBusy] = useState(false);
  const isNew = !role;

  async function save() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const name = val("rlName");
      const modules = readActionMatrix();
      const isActive = val("rlStatus") === "active";
      const res = role
        ? await AdminOpsService.updateRole(role.id, { name, modules, isActive })
        : await AdminOpsService.createRole(name, modules, isActive);
      ops.done(role ? "Role saved." : "Role created.", "#/roles/" + res.data.id);
    } catch (e) {
      setErr(errOf(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="md-h">
        <h3>{isNew ? "Create role" : "Edit role"}</h3>
        <p>{isNew ? "A name, and what it may do" : "#" + role!.id}</p>
        <button className="md-x" data-close="1" onClick={ops.closeLayer}><Icon name="x" /></button>
      </div>
      <div className="md-b">
        <ErrSlot err={err} />
        <SectionHead title="Role" />
        <Field id="rlName" label="Role name" req value={role ? role.name : ""} ph="Sales Manager" />
        <Field id="rlStatus" label="Status" type="select"
               options={[
                 { v: "active", l: "Active", sel: !role || role.isActive },
                 { v: "inactive", l: "Inactive", sel: !!role && !role.isActive },
               ]}
               help="Inactive keeps the role and its members, but grants nothing — the server drops it from every permission check." />
        <SectionHead title="Permissions" />
        <ActionMatrix mods={mods} grants={role && role.isFullAccess ? null : (role ? role.modules : {})} editable />
        <div className="help" style={{ marginTop: 8 }}>
          A dash means the module has no such action — it is not a permission being withheld.
          <b> View is the gate</b>: without it the module leaves that member's sidebar and the API
          refuses every route on it, whatever else is ticked — so ticking any verb ticks view, and
          clearing view clears the row.
        </div>
      </div>
      <div className="md-f">
        <span className="spacer"></span>
        <button className="btn" data-close="1" onClick={ops.closeLayer}>Cancel</button>
        <button className="btn pri" data-act="rl-save" data-ref={role ? role.id : undefined}
                onClick={save} disabled={busy}>{isNew ? "Create role" : "Save role"}</button>
      </div>
    </>
  );
}

export function RoleDeleteModal({ role, ops }: { role: Role; ops: Ops }) {
  const [err, setErr] = useState<EngineErr | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await AdminOpsService.deleteRole(role.id);
      ops.done("Role deleted.", "#/roles");
    } catch (e) {
      setErr(errOf(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="md-h">
        <h3>Delete role</h3>
        <p>{role.name}</p>
        <button className="md-x" data-close="1" onClick={ops.closeLayer}><Icon name="x" /></button>
      </div>
      <div className="md-b">
        <ErrSlot err={err} />
        {role.userCount ? (
          <Notice tone="bad" ico="alert" text={
            <><b>{role.userCount} member(s) hold this role.</b> The server refuses to delete a role that
              is still in use — move them off it first.</>
          } />
        ) : (
          <Notice tone="bad" text="Nobody holds this role, so it can go outright." />
        )}
      </div>
      <div className="md-f">
        <span className="spacer"></span>
        <button className="btn" data-close="1" onClick={ops.closeLayer}>Cancel</button>
        <button className="btn dgr" data-act="rl-del-go" data-ref={role.id}
                onClick={remove} disabled={busy}>Delete role</button>
      </div>
    </>
  );
}
