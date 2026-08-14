/* =====================================================================
   TEAM — Access requests.
   ---------------------------------------------------------------------
   The reset-review queue stays — it is real product surface (an Admin
   approving a lockout reset) — but it has NO PRODUCER yet: the old version
   read/wrote IBData.TeamStore.loadRequests/saveRequests, a localStorage
   queue nothing server-side ever populated. There is no
   `v1/admin/access-requests/`-shaped endpoint in the given contract or in
   interior_admin/urls.py, so this always renders empty rather than
   fabricating rows or reaching back into the deleted local store.

   When a real producer exists (a member's own "forgot password" flow, or an
   admin-facing queue endpoint), this file is where it plugs in — the tab,
   the count badge and the empty-state copy are already wired to
   `pendingRequests()`.
   ===================================================================== */
import { EmptyState } from "../../ui";

/** No known producer yet — 0 is the honest count, not an estimate. */
export function pendingRequests(): number {
  return 0;
}

export default function AccessRequests() {
  return (
    <EmptyState
      icon="inbox"
      title="No access requests"
      body="Nobody is waiting. When a member is locked out and asks for a reset, the request lands here for an Admin to review."
    />
  );
}
