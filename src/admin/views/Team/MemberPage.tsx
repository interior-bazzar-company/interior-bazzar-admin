/* =============================================================================
   Member page — #/team/:id, rendered BY Team/index.tsx.
   -----------------------------------------------------------------------------
   ONE PERSON, WHOLE. The Members table row opens this page: the identity half
   (profile, roles, effective access — live, from the server) and the
   operational half (attendance, work, reports, documents, pay — the content
   seed, adopted onto the live roster) in one place, because "open the member"
   should not be a choice between two doors.

   It replaced two things: the MemberDrawer (its identity sections and action
   buttons live here now) and the separate `#/me` module (a second roster was a
   second front door to one room). The viewer decides the tabs, not the route:
   a member sees everything of their own, a senior sees the operational half of
   somebody who reports to them, an admin sees the record.

   CHROME BELONGS TO Team/index.tsx — this component never calls usePageChrome,
   so the two cannot fight over the topbar.
   ============================================================================= */
import { Icon, KvList, Notice, Pill, SectionHead, Tabs, qs } from "../../ui";
import { go } from "../../ui/nav";
import { MoreMenu } from "../../ui/menu";
import type { MenuItem } from "../../ui/menu";
import { fmtDate as fmtLiveDate } from "../../ui/format";
import { can } from "../../shell/AdminShell";
import { getSession, HIDDEN_MODULES } from "../../auth/session";
import { Avatar, RoleChips } from "../teamShared";
import type { Member as LiveMember, Ops, Role } from "../teamShared";
import {
  MemberDeleteModal, MemberEditModal, MemberRolesModal, MemberSendCredentialsModal,
} from "./memberModals";
import { meId, readMember, useMembers } from "./store";
import type { Member } from "./store";
import {
  AttendanceTab, DocumentsTab, OverviewTab, PayTab, Refused, ReportsTab, WorkTab,
} from "./memberTabs";
import "./team.css";

/* SIX TABS. Leave is a block inside Attendance rather than a seventh: it is
   about days, and the tab bar is the one place a screen gets crowded quietly.
   Documents and Pay are not shown to a senior — a reporting line does not imply
   access to somebody's PAN card or their salary. */
const TABS = [
  { k: "overview", l: "Overview" }, { k: "attendance", l: "Attendance" },
  { k: "work", l: "Work" }, { k: "reports", l: "Reports" },
  { k: "documents", l: "Documents" }, { k: "pay", l: "Pay" },
];
const PRIVATE_TABS = ["documents", "pay"];

export default function MemberPage({ id, tab: rawTab, live, roles, ops }: {
  id: string; tab: string; live: LiveMember | null; roles: Role[]; ops: Ops;
}) {
  useMembers();
  const me = meId();
  const m = readMember(id);
  const tab = TABS.some((t) => t.k === rawTab) ? rawTab : "overview";

  if (!m && !live) {
    return (
      <div className="dls"><div className="dls-body">
        <Notice tone="warn" text={"No member holds the id " + id + ". The link may be stale."} />
      </div></div>
    );
  }

  const viewer = id === me ? "self" : m && m.reportsTo === me ? "senior" : "admin";
  const tabTo = (k: string) => "#/team/" + id + qs({ tab: k === "overview" ? "" : k });

  const menu: MenuItem[] = [];
  if (live && can("team", "roles"))
    menu.push({ icon: "shield", label: "Roles", act: () => ops.modal(<MemberRolesModal u={live} roles={roles} ops={ops} />) });
  if (live && can("team", "edit"))
    menu.push({ icon: "lock", label: "Send new password", act: () => ops.modal(<MemberSendCredentialsModal u={live} ops={ops} />) });
  if (live && can("team", "status"))
    menu.push({ icon: "x", label: "Delete member", tone: "dgr", act: () => ops.modal(<MemberDeleteModal u={live} ops={ops} />) });

  return (
    <div className="dls">
      <div className="dls-cmd tm-mh">
        <Avatar u={live || asLive(m)} size="xl" />
        <span className="tm-who-t">
          <b className="tm-mh-n">
            {live ? live.name : m ? m.name : id}
            {live && live.isSuperAdmin ? <Pill text="Full access" tone="brand" /> : null}
            {live && live.isActive === false ? <Pill text="Inactive" tone="bad" /> : null}
          </b>
          <span className="cell-2">
            {m ? m.designation + (m.department ? " · " + m.department : "") : "—"}
            {" · "}
            {viewer === "self" ? "your own dashboard" : viewer === "senior" ? "reports to you" : "admin view"}
          </span>
        </span>
        <span className="spacer" />
        {m ? (
          <button className="btn sm" data-go={"#/work" + qs({ member: id, face: "board" })}
            onClick={() => go("#/work" + qs({ member: id, face: "board" }))}>
            <Icon name="calendar" size="sm" />Their board
          </button>
        ) : null}
        {live && can("team", "edit") ? (
          <button className="btn pri sm" onClick={() => ops.modal(<MemberEditModal u={live} ops={ops} />)}>
            Edit member
          </button>
        ) : null}
        {menu.length ? <MoreMenu small items={menu} /> : null}
      </div>

      <Tabs
        items={TABS.filter((t) => viewer !== "senior" || PRIVATE_TABS.indexOf(t.k) < 0)
          .map((t) => ({ k: t.k, label: t.l }))}
        cur={tab}
        onPick={(k) => go(tabTo(k))} />

      <div className="dls-body">
        {!m ? (
          <NotAdopted live={live as LiveMember} roles={roles} />
        ) : tab === "attendance" ? <AttendanceTab m={m} viewer={viewer} />
          : tab === "work" ? <WorkTab m={m} viewer={viewer} />
          : tab === "reports" ? <ReportsTab m={m} />
          : tab === "documents" ? (viewer === "senior" ? <Refused /> : <DocumentsTab m={m} viewer={viewer} />)
          : tab === "pay" ? (viewer === "senior" ? <Refused /> : <PayTab m={m} />)
          : (
            <>
              <OverviewTab m={m} />
              {live ? <IdentityBlock live={live} roles={roles} /> : null}
            </>
          )}
      </div>
    </div>
  );
}

/* The store member wearing the live shape, for the avatar when the server row
   is absent (a member another admin created — readable, not editable). */
const asLive = (m: Member | null): LiveMember | null =>
  m ? ({ id: Number(m.memberId), name: m.name } as LiveMember) : null;

/** The live row exists but the operational store has no record — a fetch still
 *  in flight, or an id the adoption never saw. Identity still renders. */
function NotAdopted({ live, roles }: { live: LiveMember; roles: Role[] }) {
  return (
    <>
      <Notice text="No operational record yet — attendance, work and leave arrive with the API." />
      <IdentityBlock live={live} roles={roles} />
    </>
  );
}

/* ------------------------------------------------- the identity half ------ */
/* The MemberDrawer's sections, verbatim in spirit: everything below is LIVE
   server data, and the one screen where somebody's access is read. */

function IdentityBlock({ live: u, roles }: { live: LiveMember; roles: Role[] }) {
  return (
    <>
      <SectionHead title="Profile" />
      <KvList cls="wide" pairs={[
        ["Email", <a key="e" href={"mailto:" + u.email}>{u.email}</a>],
        ["Phone", u.phone ? u.phone : <span className="faint">—</span>],
        ["Username", <span key="u" className="mono">{u.username || "—"}</span>],
        ["Account status", u.isActive === undefined ? <span className="faint">—</span>
          : u.isActive ? <Pill text="Active" tone="ok" /> : <Pill text="Inactive" tone="bad" />],
        ["Roles", u.roles.length ? <RoleChips u={u} />
          : <span className="faint">none — this account can sign in and do nothing</span>],
        ["Last sign-in", u.lastLogin ? fmtLiveDate(u.lastLogin)
          : <span className="faint">never signed in</span>],
        ["Added", u.addedAt ? fmtLiveDate(u.addedAt) : <span className="faint">—</span>],
      ]} />

      <SectionHead title="Effective access" />
      <EffectiveAccess u={u} roles={roles} />
    </>
  );
}

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
function grantsOfMember(u: LiveMember, roles: Role[]): Record<string, string[]> {
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
   they called"; this answers "what happens when they click". */
function EffectiveAccess({ u, roles }: { u: LiveMember; roles: Role[] }) {
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
  const mods = (s ? s.modules : []).filter(
    (m) => !HIDDEN_MODULES.has(m.key) && (grants[m.key] || []).indexOf("view") >= 0);
  if (!mods.length)
    return <Notice tone="warn" ico="lock"
      text="No access to anything. This member can sign in and will see an empty panel — assign a role." />;

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
