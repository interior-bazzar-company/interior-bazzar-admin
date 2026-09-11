/* =====================================================================
   ROLES — the role drawer. What the row cannot say: its per-module levels.

   Read in the order the questions are asked: what is this role and is it
   granting anything at all (the badges, and the one condition worth
   interrupting for), how far does it reach (the facts), and then the
   matrix — which is byte-for-byte what the API enforces.

   "Members with this role" is not re-derived here from a member list — the
   Team list endpoint only returns members the SIGNED-IN admin created
   (interior_admin's `getSelfCreatedUsersController`), so filtering it
   client-side would undercount and read as authoritative when it is not.
   `userCount`, from the server, is the real total and is what is shown.
   ===================================================================== */
import type { RolesModuleDef } from "../../../api/modules/adminOps";
import { Alert, Button, DrawerShell, KvList, Pill, SectionHead } from "../../ui";
import { can } from "../../shell/AdminShell";
import { ActionMatrix } from "../teamShared";
import type { Ops, Role } from "../teamShared";
import { RoleDeleteModal, RoleModal } from "./roleModals";

export default function RoleDrawer({ role: r, mods, ops }: { role: Role; mods: RolesModuleDef[]; ops: Ops }) {
  /* `view` is the gate: a module without it is not granted however many other
     verbs carry a tick, so it is the only honest way to count reach. */
  const held = r.isFullAccess ? mods : mods.filter((m) => (r.modules[m.key] || []).indexOf("view") >= 0);
  const verbs = r.isFullAccess
    ? null
    : mods.reduce((n, m) => n + (r.modules[m.key] || []).length, 0);

  return (
    <DrawerShell
      title={r.name}
      sub={<span className="font-mono tnum">#{r.id} · {r.userCount} member{r.userCount === 1 ? "" : "s"}</span>}
      onClose={() => { ops.closeLayer(); ops.go("#/roles"); }}
      actions={<ActionBar role={r} mods={mods} ops={ops} />}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {r.isActive
              ? <Pill lg dot tone="ok" text="Active" title="The server honours every tick below" />
              : <Pill lg dot tone="warn" text="Inactive" title="Still assigned, but grants nothing" />}
            {r.isSystem ? <Pill tone="sys" ico="lock" text="Protected" title="Defined by the system — it cannot be edited or deleted" /> : null}
            {r.isFullAccess ? <Pill tone="brand" text="Full access" title="A wildcard: every module, every verb, including ones added later" /> : null}
          </div>

          {r.isActive ? null : (
            <Alert tone="warn" title="This role is inactive.">
              The ticks below are kept, but the server drops the role from every permission resolve —
              so its {r.userCount} member{r.userCount === 1 ? "" : "s"} get nothing from it until it is
              switched back on.
            </Alert>
          )}
        </div>

        <section>
          <SectionHead title="Reach" desc="What holding this role actually opens." />
          <KvList pairs={[
            ["Members", r.userCount
              ? <>{r.userCount} member{r.userCount === 1 ? "" : "s"} hold this role</>
              : <span className="text-quaternary">nobody holds it yet</span>],
            ["Modules", r.isFullAccess
              ? <>every module — <span className="text-quaternary">including any added later</span></>
              : held.length
                ? <>{held.length} of {mods.length}{" "}
                    <span className="text-quaternary">· {verbs} verb{verbs === 1 ? "" : "s"} ticked</span></>
                : <span className="text-quaternary">none — this role grants nothing</span>],
            ["Status", r.isActive ? "Active — honoured on every request"
              : <span className="text-warning-primary">Inactive — resolved as no permissions at all</span>],
            ["Origin", r.isSystem ? "System-seeded, and protected from edits" : "Created here"],
          ]} />
        </section>

        <section>
          <SectionHead title="Permissions"
            desc="One row per module, one column per verb — exactly what the API enforces." />
          <ActionMatrix mods={mods} grants={r.isFullAccess ? null : r.modules} />
          <p className="mt-3 text-sm text-tertiary">
            A dash means the module has no such action — it is not a permission being withheld.{" "}
            <b className="font-semibold text-secondary">View is the gate</b>: without it the module
            leaves that member&apos;s sidebar and the API refuses every route on it, whatever else is ticked.
          </p>
        </section>
      </div>
    </DrawerShell>
  );
}

/* Locked actions are ABSENT, not greyed — a disabled button invites a click
   and a support ticket. A system role has neither, and says why instead. */
function ActionBar({ role: r, mods, ops }: { role: Role; mods: RolesModuleDef[]; ops: Ops }) {
  if (r.isSystem)
    return <span className="mr-auto text-sm text-tertiary">
      Defined by the system: it cannot be edited or deleted.
    </span>;
  if (!can("roles", "edit")) return null;
  return (
    <>
      {/* Destructive sits apart, on the far side of the footer, and goes
          through its own modal — the server refuses a role somebody holds. */}
      <Button color="secondary-destructive" className="mr-auto" ico="trash"
        data-act="rl-del" data-ref={r.id}
        onClick={() => ops.modal(<RoleDeleteModal role={r} ops={ops} />)}>Delete</Button>
      <Button color="primary" ico="edit" data-act="rl-edit" data-ref={r.id}
        onClick={() => ops.modal(<RoleModal role={r} mods={mods} ops={ops} />, "xl")}>Edit role</Button>
    </>
  );
}
