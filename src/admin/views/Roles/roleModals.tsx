/* =====================================================================
   ROLES — the write paths, ported from the M["rl-*"] handlers.
   Editing a role is the point of the page, so the editor carries the
   whole matrix: name, description, status, and every module × action the
   product actually has.
   ===================================================================== */
import { useState } from "react";
import { IBTeam } from "../../engines";
import { Field, Icon, Notice, SectionHead } from "../../ui";
import { ErrSlot, MatrixTable, actor, readMatrix, val } from "../teamShared";
import type { EngineErr, Ops, Role } from "../teamShared";

export function RoleModal({ role, ops }: { role: Role | null; ops: Ops }) {
  const [err, setErr] = useState<EngineErr | null>(null);
  const isNew = !role;

  function save() {
    const payload = {
      name: val("rlName"), description: val("rlDesc"),
      status: val("rlStatus"), permissions: readMatrix(),
    };
    const r = role
      ? IBTeam.Roles.update(role.role_id, payload, actor())
      : IBTeam.Roles.create(payload, actor());
    if (r.ok === false) return setErr(r);
    ops.done(role ? "Role saved." : "Role created.", "#/roles/" + r.data.role_id);
  }

  return (
    <>
      <div className="md-h">
        <h3>{isNew ? "Create role" : "Edit role"}</h3>
        <p>{isNew ? "A name, and what it may do" : role!.role_id}</p>
        <button className="md-x" data-close="1" onClick={ops.closeLayer}><Icon name="x" /></button>
      </div>
      <div className="md-b">
        <ErrSlot err={err} />
        <SectionHead title="Role" />
        <Field id="rlName" label="Role name" req value={role ? role.name : ""} ph="Sales Manager" />
        <Field id="rlDesc" label="Description" type="textarea" value={role ? role.description : ""}
               ph="One line saying what this responsibility covers."
               help="Read by whoever assigns the role. Say what the job is, not which boxes are ticked." />
        <Field id="rlStatus" label="Status" type="select" options={[
          { v: "active", l: "Active — grants its permissions", sel: !role || role.status === "active" },
          { v: "inactive", l: "Inactive — held but grants nothing", sel: !!role && role.status !== "active" },
        ]} />
        <SectionHead title="Permissions" />
        <MatrixTable role={role} editable />
        <div className="help" style={{ marginTop: 8 }}>
          <b>A dash means the module has no such action</b> — it is not a permission being withheld.{" "}
          <b>View is the gate</b>: without it the module leaves that member's sidebar and the route is
          refused, whatever else is ticked.
        </div>
      </div>
      <div className="md-f">
        <span className="spacer"></span>
        <button className="btn" data-close="1" onClick={ops.closeLayer}>Cancel</button>
        <button className="btn pri" data-act="rl-save" data-ref={role ? role.role_id : undefined}
                onClick={save}>{isNew ? "Create role" : "Save role"}</button>
      </div>
    </>
  );
}

export function RoleDeleteModal({ role, ops }: { role: Role; ops: Ops }) {
  const [err, setErr] = useState<EngineErr | null>(null);
  const holders = IBTeam.members().filter(
    (u: Record<string, unknown>) => IBTeam.roleIdsOf(u).indexOf(role.role_id) >= 0).length;

  function remove() {
    const r = IBTeam.Roles.remove(role.role_id, actor());
    if (r.ok === false) return setErr(r);
    ops.done("Role deleted.", "#/roles");
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
        {holders ? (
          <Notice tone="bad" ico="alert" text={
            <><b>{holders} member(s) hold this role.</b> Deleting it would leave those accounts
              pointing at a role that does not exist. Move them off it first, or deactivate the role
              instead — an inactive role grants nothing and keeps the history readable.</>
          } />
        ) : (
          <Notice tone="bad" text="Nobody holds this role, so it can go outright." />
        )}
      </div>
      <div className="md-f">
        <span className="spacer"></span>
        <button className="btn" data-close="1" onClick={ops.closeLayer}>Cancel</button>
        <button className="btn dgr" data-act="rl-del-go" data-ref={role.role_id}
                onClick={remove}>Delete role</button>
      </div>
    </>
  );
}
