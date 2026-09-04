/* =====================================================================
   TEAM — the member drawer. The member and the roles list both come from
   Team/index.tsx (already fetched for the list/filters), so this drawer
   does no fetching of its own — it re-renders whenever its parent's `tick`
   changes, same as the prototype's re-open-on-every-write behaviour.

   FIELDS THE OLD LOCAL RECORD HAD THAT THE REAL ONE STILL DOES NOT:
   designation, avatar, the locked/suspended half of account status, and the
   failed-attempt count — no column records any of them, and a fabricated
   "0 failed attempts" reads as a fact. Everything else the prototype shows
   is here and real: `isActive`, `addedAt` and `lastLogin` come off the user
   record (AdminUserTasks._accountFacts), and Effective access is resolved
   from the roles this member holds — the same levels the server enforces.
   ===================================================================== */
import { EmptyState, Icon, KvList, Notice, Pill, SectionHead } from "../../ui";
import { fmtDate } from "../../ui/format";
import { can } from "../../shell/AdminShell";
import { getSession, HIDDEN_MODULES } from "../../auth/session";
import { Avatar, RoleChips } from "../teamShared";
import { readMember } from "./store";
import type { Member, Ops, Role } from "../teamShared";
import {
  MemberDeleteModal, MemberEditModal, MemberRolesModal, MemberSendCredentialsModal,
} from "./memberModals";

/* The prototype's ACTION_LABEL. The keys are the server's own
   (ModuleAction.key), so anything unlisted falls back to the key itself
   rather than disappearing. */
const ACTION_LABEL: Record<string, string> = {
  view: "View", create: "Create", edit: "Edit", stage: "Change stage",
  payment: "Log payment", close: "Close", export: "Export", record: "Record",
  issue: "Issue", accept: "Accept", cancel: "Cancel", reverse: "Reverse",
  pricing: "Set pricing", status: "Activate", archive: "Archive", roles: "Manage roles",
};

/** A member's grants: the UNION of the verbs their roles tick — the same
    resolution resolve_grants() does server-side. Inactive roles contribute
    nothing there, so they must contribute nothing here either. */
function grantsOfMember(u: Member, roles: Role[]): Record<string, string[]> {
  const held = new Set((u.roles || []).map((r) => r.id));
  const out: Record<string, string[]> = {};
  roles.filter((r) => held.has(r.id) && r.isActive).forEach((r) => {
    Object.keys(r.modules || {}).forEach((k) => {
      (r.modules[k] || []).forEach((a) => {
        const list = (out[k] = out[k] || []);
        if (list.indexOf(a) < 0) list.push(a);
      });
    });
  });
  return out;
}

/* WHAT THEY CAN ACTUALLY DO, resolved. A list of role names answers "what are
   they called"; this answers "what happens when they click". The module list
   comes off the resolved session and the verbs off the roles themselves — the
   same two tables can() asks, so this pane and the panel cannot disagree. */
function EffectiveAccess({ u, roles }: { u: Member; roles: Role[] }) {
  const s = getSession();
  if (u.isActive === false)
    return <Notice tone="warn" ico="lock" text={
      <><b>This account is inactive.</b> Whatever its roles say, it cannot sign in and every
        call it makes would be refused.</>
    } />;
  if (u.isSuperAdmin || roles.some((r) => r.isFullAccess && (u.roles || []).some((x) => x.id === r.id)))
    return <Notice ico="shield" text={
      <><b>Everything.</b> Full access is a grant, not a list — it resolves to a wildcard, so a
        module added tomorrow is included without anybody editing a matrix.</>
    } />;

  const grants = grantsOfMember(u, roles);
  /* `view` is the gate: a module ticked everywhere except view grants nothing,
     so it must not be listed here as if it did. */
  const mods = (s ? s.modules : []).filter(
    (m) => !HIDDEN_MODULES.has(m.key) && (grants[m.key] || []).indexOf("view") >= 0);
  if (!mods.length)
    return <EmptyState icon="lock" title="No access to anything"
                       body="This member can sign in and will see an empty panel. Assign a role." />;

  return (
    <ul className="pl-feats">
      {mods.map((m) => {
        const acts = (grants[m.key] || []).filter((a) => a !== "view");
        return (
          <li key={m.key}>
            <Icon name="check" size="sm" />
            <span>
              <b>{m.label}</b>
              <span className="d">{acts.length
                ? acts.map((a) => ACTION_LABEL[a] || a).join(" · ")
                : "View only"}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function StatusPill({ u }: { u: Member }) {
  if (u.isActive === undefined) return <span className="faint">—</span>;
  return u.isActive ? <Pill text="Active" tone="ok" /> : <Pill text="Inactive" tone="bad" />;
}

export default function MemberDrawer({ member: u, roles, ops }: { member: Member; roles: Role[]; ops: Ops }) {
  return (
    <>
      <div className="dw-h">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <Avatar u={u} size="xl" />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: "var(--text-2xl)", fontWeight: 600 }}>{u.name}</h2>
              <StatusPill u={u} />
              {u.isSuperAdmin ? <Pill text="Full access" tone="brand" /> : null}
              {u.isVerified ? <Pill text="Verified" tone="ok" /> : null}
            </div>
            <div className="mono" style={{ fontSize: "var(--text-md)", color: "var(--text-2)", marginTop: 5 }}>
              {u.username || "—"} · {u.email}{u.phone ? " · " + u.phone : ""}
            </div>
          </div>
          <span className="spacer"></span>
          <button className="btn icon sm" data-go="#/team" aria-label="Close"
                  onClick={() => { ops.closeLayer(); ops.go("#/team"); }}><Icon name="x" /></button>
        </div>
      </div>

      <div className="dw-b">
        <SectionHead title="Profile" />
        <KvList cls="wide" pairs={[
          ["Name", u.name],
          ["Email", <a href={"mailto:" + u.email}>{u.email}</a>],
          ["Phone", u.phone ? u.phone : <span className="faint">—</span>],
        ]} />

        <SectionHead title="Access" />
        <KvList cls="wide" pairs={[
          ["Username", <span className="mono">{u.username || "—"}</span>],
          ["Account status", <StatusPill u={u} />],
          ["Roles", u.roles.length ? <RoleChips u={u} />
            : <span className="faint">none — this account can sign in and do nothing</span>],
        ]} />

        <SectionHead title="Effective access" />
        <EffectiveAccess u={u} roles={roles} />

        <SectionHead title="Activity" />
        <KvList cls="wide" pairs={[
          ["Last sign-in", u.lastLogin ? fmtDate(u.lastLogin)
            : <span className="faint">never signed in</span>],
          ["Added", u.addedAt ? fmtDate(u.addedAt) : <span className="faint">—</span>],
        ]} />

        <SectionHead title="Security" />
        <Notice ico="lock" text={
          <><b>The password is not shown here, and there is no path that shows it.</b> It is stored as
            a salted hash, so nobody — including an admin — can read it back. Sending new credentials
            emails a fresh one; it is never displayed on screen.</>
        } />
      </div>

      <div className="dw-f">
        {/* The drawer stays the identity record and becomes a LAUNCHER for the
            operational half — attendance, work, reports and leave live on
            `#/me/:id`, one place per fact. The link only appears when the
            operational seed knows this id; it degrades to nothing rather than
            offering a route that would 404. */}
        {readMember(String(u.id)) ? (
          <a className="btn" href={"#/me/" + u.id}>Open dashboard</a>
        ) : null}
        {can("team", "edit") ? (
          <button className="btn pri" data-act="tm-edit" data-ref={u.id}
                  onClick={() => ops.modal(<MemberEditModal u={u} ops={ops} />)}>Edit member</button>
        ) : null}
        {can("team", "roles") ? (
          <button className="btn" data-act="tm-roles" data-ref={u.id}
                  onClick={() => ops.modal(<MemberRolesModal u={u} roles={roles} ops={ops} />)}>Roles</button>
        ) : null}
        {can("team", "edit") ? (
          <button className="btn" data-act="tm-pw" data-ref={u.id}
                  onClick={() => ops.modal(<MemberSendCredentialsModal u={u} ops={ops} />)}>Send new password</button>
        ) : null}
        <span className="spacer"></span>
        {can("team", "status") ? (
          <button className="btn dgr" data-act="tm-del" data-ref={u.id}
                  onClick={() => ops.modal(<MemberDeleteModal u={u} ops={ops} />)}>Delete member</button>
        ) : null}
      </div>
    </>
  );
}
