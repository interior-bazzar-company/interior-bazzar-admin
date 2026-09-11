/* =====================================================================
   ROLES — the write paths: create, edit, delete. Real requests to
   /api/v1/admin/roles/ now, not the local IBTeam engine.

   BOTH FORMS ARE UNCONTROLLED: `val("rlName")` / `val("rlStatus")` read the
   values back off the DOM at save time and `readActionMatrix()` reads the
   grid out of `#rlMatrix`, so every `id` below is load-bearing.
   ===================================================================== */
import { useState } from "react";
import AdminOpsService from "../../../api/modules/adminOps";
import type { RolesModuleDef } from "../../../api/modules/adminOps";
import { Alert, Button, FormField, FormSection, Input, ModalShell, SelectInput } from "../../ui";
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
    <ModalShell
      title={isNew ? "Create role" : "Edit role"}
      sub={isNew ? "A name, and what it may do" : "#" + role!.id + " · " + role!.name}
      mono={!isNew}
      onClose={ops.closeLayer}
      actions={<>
        <Button color="secondary" data-close="1" onClick={ops.closeLayer} isDisabled={busy}>Cancel</Button>
        <Button color="primary" data-act="rl-save" data-ref={role ? role.id : undefined}
          isLoading={busy} showTextWhileLoading onClick={save}>
          {isNew ? "Create role" : "Save role"}
        </Button>
      </>}
    >
      <ErrSlot err={err} />
      <div className="flex flex-col gap-6">
        <FormSection title="Role">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="rlName" label="Role name" req>
              <Input id="rlName" defaultValue={role ? role.name : ""} ph="Sales Manager" autoFocus />
            </FormField>
            <FormField id="rlStatus" label="Status"
              hint="Inactive keeps the role and its members, but grants nothing — the server drops it from every permission check.">
              <SelectInput id="rlStatus"
                defaultValue={!role || role.isActive ? "active" : "inactive"}
                options={[{ v: "active", l: "Active" }, { v: "inactive", l: "Inactive" }]} />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Permissions"
          desc="One row per module, one column per verb. A tick here is what the API enforces.">
          <ActionMatrix mods={mods} grants={role && role.isFullAccess ? null : (role ? role.modules : {})} editable />
          <p className="text-sm text-tertiary">
            A dash means the module has no such action — it is not a permission being withheld.{" "}
            <b className="font-semibold text-secondary">View is the gate</b>: without it the module
            leaves that member&apos;s sidebar and the API refuses every route on it, whatever else is
            ticked — so ticking any verb ticks view, and clearing view clears the row.
          </p>
        </FormSection>
      </div>
    </ModalShell>
  );
}

export function RoleDeleteModal({ role, ops }: { role: Role; ops: Ops }) {
  const [err, setErr] = useState<EngineErr | null>(null);
  const [busy, setBusy] = useState(false);
  const held = !!role.userCount;

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
    <ModalShell
      title="Delete role"
      sub={role.name}
      ico="alert"
      tone="error"
      onClose={ops.closeLayer}
      actions={<>
        <Button color="secondary" data-close="1" onClick={ops.closeLayer} isDisabled={busy}>Cancel</Button>
        {/* Offered even when it will be refused: the server owns that rule, and
            hiding the button would leave the refusal unexplained. */}
        <Button color="primary-destructive" data-act="rl-del-go" data-ref={role.id}
          isLoading={busy} showTextWhileLoading onClick={remove}>Delete role</Button>
      </>}
    >
      <ErrSlot err={err} />
      <div className="flex flex-col gap-3">
        {held ? (
          <Alert tone="bad" title={role.userCount + " member" + (role.userCount === 1 ? "" : "s") + " hold this role."}>
            The server refuses to delete a role that is still in use — move them off it first, or
            deactivate the role instead to strip what it grants without losing the record.
          </Alert>
        ) : (
          <Alert tone="warn" title="Nobody holds this role, so it can go outright.">
            Deleting is permanent. If you may want it back, deactivate it instead: an inactive role
            grants nothing but keeps its name and its matrix.
          </Alert>
        )}
      </div>
    </ModalShell>
  );
}
