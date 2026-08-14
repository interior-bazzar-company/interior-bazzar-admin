/* =====================================================================
   TEAM — the member drawer. Ported from memberDrawer() in views-team.js.
   Reads the member fresh from IBTeam on every render; nothing here holds
   a copy of a person or of what they may do.
   ===================================================================== */
import { IBTeam } from "../../engines";
import { EmptyState, Icon, KvList, Notice, Pill, SectionHead } from "../../ui";
import { can } from "../../shell/AdminShell";
import { Avatar, RoleChips, StatusPill, actor, matrixModules, rolesOf, whenever } from "../teamShared";
import type { Member, Ops } from "../teamShared";
import {
  MemberDeactivateModal, MemberEditModal, MemberResetPwModal, MemberRolesModal,
} from "./memberModals";

/* WHAT THEY CAN ACTUALLY DO, resolved. A list of role names answers
   "what are they called"; this answers "what happens when they click".
   It is the union of their roles, which is the same function the router
   and the sidebar ask. */
function EffectiveBlock({ u, perms }: { u: Member; perms: Record<string, boolean> }) {
  if (u.status !== "active")
    return (
      <Notice tone="warn" ico="lock" text={
        <><b>This account is {u.status}.</b> Whatever its roles say, it cannot sign in and every call
          it makes would be refused.</>
      } />
    );
  if (perms["*"])
    return (
      <Notice ico="shield" text={
        <><b>Everything.</b> Super Admin is a grant, not a list — it resolves to a wildcard, so a
          module added tomorrow is included without anybody editing a matrix.</>
      } />
    );
  const mods = matrixModules().filter((m) => perms[m.key + ".view"]);
  if (!mods.length)
    return <EmptyState icon="lock" title="No access to anything"
                       body="This member can sign in and will see an empty panel. Assign a role." />;
  return (
    <ul className="pl-feats">
      {mods.map((m) => {
        const acts = m.actions.filter((a) => a !== "view" && perms[m.key + "." + a]);
        return (
          <li key={m.key}>
            <Icon name="check" size="sm" />
            <span>
              <b>{m.label}</b>
              <span className="d">
                {acts.length ? acts.map((a) => IBTeam.ACTION_LABEL[a] || a).join(" · ") : "View only"}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default function MemberDrawer({ id, ops }: { id: string; ops: Ops }) {
  const u: Member | null = IBTeam.memberOf(id);
  if (!u) return null;                      // the view has already toast+redirected
  const rs = rolesOf(u);
  const perms: Record<string, boolean> = IBTeam.effective(u);
  const me = IBTeam.currentUser();
  const isMe = !!(me && me.id === u.id);

  function activate() {
    const r = IBTeam.Members.setStatus(u!.id, "active", actor());
    if (r.ok === false) return ops.toast(r.http + " " + r.code + " — " + r.detail, "bad");
    ops.toast("Account activated.");
    ops.refresh();
  }

  return (
    <>
      <div className="dw-h">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <Avatar u={u} size="xl" />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: "var(--text-2xl)", fontWeight: 600 }}>{u.name}</h2>
              <StatusPill s={u.status} />
              {IBTeam.isSuper(u) ? <Pill text="Super Admin" tone="brand" /> : null}
              {isMe ? <Pill text="You" /> : null}
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
          ["Designation", u.designation || "—"],
          ["Email", <a href={"mailto:" + u.email}>{u.email}</a>],
          ["Phone", u.phone ? u.phone : <span className="faint">—</span>],
        ]} />

        <SectionHead title="Access" />
        <KvList cls="wide" pairs={[
          ["Username", <span className="mono">{u.username || "—"}</span>],
          ["Account status", <StatusPill s={u.status} />],
          ["Roles", rs.length ? <RoleChips u={u} />
            : <span className="faint">none — this account can sign in and do nothing</span>],
        ]} />

        <SectionHead title="Effective access" />
        <EffectiveBlock u={u} perms={perms} />

        <SectionHead title="Activity" />
        <KvList cls="wide" pairs={[
          ["Last sign-in", whenever(u.lastLogin)],
          ["Added", whenever(u.registeredAt)],
          ["Failed attempts", <>{String(u.failedAttempts || 0)}
            {u.status === "locked" ? <> <span className="pill warn xs">locked</span></> : null}</>],
        ]} />

        <SectionHead title="Security" />
        <Notice ico="lock" text={
          <><b>The password is not shown here, and there is no path that shows it.</b> It is stored as
            a salted hash, so nobody — including an admin — can read it back. Reset it and a new one
            is generated for you to pass on.</>
        } />
      </div>

      <div className="dw-f">
        {can("team", "edit") ? (
          <button className="btn pri" data-act="tm-edit" data-ref={u.id}
                  onClick={() => ops.modal(<MemberEditModal u={u} ops={ops} />)}>Edit member</button>
        ) : null}
        {can("team", "roles") ? (
          <button className="btn" data-act="tm-roles" data-ref={u.id}
                  title={isMe ? "You cannot change your own roles" : undefined}
                  onClick={() => ops.modal(<MemberRolesModal u={u} ops={ops} />)}>Roles</button>
        ) : null}
        {can("team", "edit") ? (
          <button className="btn" data-act="tm-pw" data-ref={u.id}
                  onClick={() => ops.modal(<MemberResetPwModal u={u} ops={ops} />)}>Reset password</button>
        ) : null}
        <span className="spacer"></span>
        {can("team", "status") ? (
          u.status === "active"
            ? <button className="btn dgr" data-act="tm-off" data-ref={u.id}
                      onClick={() => ops.modal(<MemberDeactivateModal u={u} ops={ops} />)}>Deactivate</button>
            : <button className="btn" data-act="tm-on" data-ref={u.id} onClick={activate}>Activate</button>
        ) : null}
      </div>
    </>
  );
}
