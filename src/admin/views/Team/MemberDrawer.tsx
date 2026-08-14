/* =====================================================================
   TEAM — the member drawer. The member and the roles list both come from
   Team/index.tsx (already fetched for the list/filters), so this drawer
   does no fetching of its own — it re-renders whenever its parent's `tick`
   changes, same as the prototype's re-open-on-every-write behaviour.

   FIELDS THE OLD LOCAL RECORD HAD THAT THE REAL ONE DOES NOT: designation,
   avatar, account status (active/inactive/suspended/locked), last sign-in,
   registration date, failed-attempt count. None of interior_admin's
   AdminUserViews expose these today, so none of them are rendered here —
   showing them against no data would be exactly the fabrication guardrail 6
   forbids. See the report for the full account.
   ===================================================================== */
import { Icon, KvList, Notice, Pill, SectionHead } from "../../ui";
import { can } from "../../shell/AdminShell";
import { Avatar, RoleChips } from "../teamShared";
import type { Member, Ops, Role } from "../teamShared";
import {
  MemberDeleteModal, MemberEditModal, MemberRolesModal, MemberSendCredentialsModal,
} from "./memberModals";

export default function MemberDrawer({ member: u, roles, ops }: { member: Member; roles: Role[]; ops: Ops }) {
  return (
    <>
      <div className="dw-h">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <Avatar u={u} size="xl" />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: "var(--text-2xl)", fontWeight: 600 }}>{u.name}</h2>
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
          ["Roles", u.roles.length ? <RoleChips u={u} />
            : <span className="faint">none — this account can sign in and do nothing</span>],
        ]} />

        <SectionHead title="Security" />
        <Notice ico="lock" text={
          <><b>The password is not shown here, and there is no path that shows it.</b> It is stored as
            a salted hash, so nobody — including an admin — can read it back. Sending new credentials
            emails a fresh one; it is never displayed on screen.</>
        } />
      </div>

      <div className="dw-f">
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
