/* =====================================================================
   TEAM — Access requests.
   ---------------------------------------------------------------------
   The reset-review queue. It used to live INSIDE the login screen
   (`team-auth.html` → `#step-adminreset`, a "dev simulation"), which is
   the one place an Admin can never reach it from: they are signed in.
   An Admin approving a reset and issuing a temporary password is real
   product surface, so it sits here — README "Where the auth page went",
   ADMIN_PANEL_OPERATION AP-05, TEAM_IA §1.

   Same store as the sign-in page: `ib_team_reset_requests`, through
   IBData.TeamStore.loadRequests/saveRequests. No second queue.

   Two things differ from the login-screen original, both deliberate:
     · approval calls IBTeam.Members.resetPassword — the guarded, hashed,
       audited path — instead of writing `user.password` in the clear. It
       is the same call the drawer's Reset password button makes, so a
       lockout has exactly one way out.
     · the issued password is NOT written back onto the request record.
       The original stored it and re-rendered it forever; this module's
       rule is that a password is shown once and never again.
   ===================================================================== */
import { IBData, IBTeam } from "../../engines";
import { EmptyState, Notice, Pill, Table } from "../../ui";
import { can } from "../../shell/AdminShell";
import { whenever } from "../teamShared";
import type { Member, Ops } from "../teamShared";
import { issueTempPassword } from "./memberModals";

export type ResetRequest = {
  id: string;
  email: string;
  workingEmail: string;
  details: string;
  status: string;
  submittedAt: number;
  sentTo?: string;
  fulfilledAt?: number;
};

export function loadRequests(): ResetRequest[] {
  return IBData.TeamStore.loadRequests();
}
/** Waiting for a human — the number the tab counts. */
export function pendingRequests(): number {
  return loadRequests().filter((r) => r.status !== "fulfilled").length;
}

export default function AccessRequests({ ops }: { ops: Ops }) {
  const rows = loadRequests();
  const users: Member[] = IBData.TeamStore.load();
  const mayAct = can("team", "edit");

  function approve(r: ResetRequest) {
    const u = IBData.TeamStore.byEmail(users, r.email);
    if (!u) return;
    /* The engine refuses if this admin lacks `team.edit`; issueTempPassword
       renders that refusal rather than swallowing it, and returns false. */
    if (!issueTempPassword(u, ops)) return;
    const list = loadRequests();
    const req = list.filter((x) => x.id === r.id)[0];
    if (req) {
      req.status = "fulfilled";
      req.sentTo = req.workingEmail;
      req.fulfilledAt = Date.now();
      IBData.TeamStore.saveRequests(list);
    }
    /* The password is on screen in the dialog issueTempPassword just opened.
       It is not written to the request — see the header. */
    IBTeam.record("Team", "Access request approved — temporary password issued to " + u.name, u.id);
    ops.refresh();
  }

  function dismiss(r: ResetRequest) {
    IBData.TeamStore.saveRequests(loadRequests().filter((x) => x.id !== r.id));
    ops.toast("Request dismissed.");
    ops.refresh();
  }

  if (!rows.length)
    return (
      <EmptyState
        icon="inbox"
        title="No access requests"
        body="Nobody is waiting. When a member is locked out and asks for a reset, the request lands here for an Admin to review."
      />
    );

  return (
    <>
      <Notice ico="lock" text={
        <><b>Approving issues a temporary password.</b> It is generated, shown once in the dialog that
          issues it, and never again — send it yourself to the working email the member gave. Any
          lockout is cleared at the same time; an account locks after five failed attempts, and this
          is the way back.</>
      } />
      <div style={{ height: 14 }}></div>
      <Table
        cols={[{ label: "Requested by" }, { label: "What happened" }, { label: "Submitted" },
               { label: "Status" }, { label: "", cls: "c" }]}
        rows={rows.map((r) => {
          const u = IBData.TeamStore.byEmail(users, r.email);
          const done = r.status === "fulfilled";
          return (
            <tr key={r.id}>
              <td>
                <div className="cell-1">{r.email}</div>
                <div className="cell-2 mono">Working email: {r.workingEmail}</div>
              </td>
              <td>
                {r.details}
                {!u ? (
                  <div className="cell-2" style={{ color: "var(--bad)" }}>
                    No Team account is registered with this email — nothing to reset.
                  </div>
                ) : null}
                {done && r.sentTo ? <div className="cell-2">Temporary password issued for {r.sentTo}</div> : null}
              </td>
              <td>{whenever(r.submittedAt)}</td>
              <td>
                {done ? <Pill text="Sent" tone="ok" />
                  : !u ? <Pill text="No match" tone="bad" />
                    : <Pill text="Pending review" tone="warn" />}
              </td>
              <td className="c">
                {done || !mayAct ? <span className="faint">—</span> : (
                  <>
                    {u ? (
                      <button className="btn sm" data-act="tm-req-approve" data-ref={r.id}
                              onClick={() => approve(r)}>Approve &amp; send</button>
                    ) : null}{" "}
                    <button className="btn sm" data-act="tm-req-dismiss" data-ref={r.id}
                            onClick={() => dismiss(r)}>Dismiss</button>
                  </>
                )}
              </td>
            </tr>
          );
        })}
      />
    </>
  );
}
