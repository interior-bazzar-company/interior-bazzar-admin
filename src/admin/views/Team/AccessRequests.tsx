/* =====================================================================
   TEAM — Access requests.
   ---------------------------------------------------------------------
   Read from `GET v1/admin/access-requests/` (team/d1): a member asks for
   one module action they do not hold, and a holder of `team.requests`
   approves them into an existing role that holds it. This tab carries the
   COUNT only — the queue itself has no rows on this page yet, so a
   non-zero count says so instead of claiming nobody is waiting.

   One read, made by Team/index.tsx and handed down, so the tab badge and
   the tab body can never disagree about how many are waiting.
   ===================================================================== */
import { useEffect, useState } from "react";
import AdminOpsService, { call } from "../../../api/modules/adminOps";
import { AppExceptions, errMessage } from "../../../api/apiService";
import { EmptyState, Notice, PaneLoading } from "../../ui";

export type PendingRequests =
  | { state: "loading" }
  | { state: "ok"; n: number }
  | { state: "denied" }
  | { state: "error"; message: string };

/** How many access requests are waiting. `denied` is a 403: the viewer does
 *  not hold team.requests, which is a fact about them, not an empty queue. */
export function usePendingRequests(): PendingRequests {
  const [q, setQ] = useState<PendingRequests>({ state: "loading" });
  useEffect(() => {
    let cancelled = false;
    call(AdminOpsService.accessRequests({ state: "requested" }))
      .then((r) => { if (!cancelled) setQ({ state: "ok", n: r.pending }); })
      .catch((e) => {
        if (cancelled) return;
        setQ(e instanceof AppExceptions && e.code === 403 ? { state: "denied" } : { state: "error", message: errMessage(e) });
      });
    return () => { cancelled = true; };
  }, []);
  return q;
}

/** The tab badge: a number only when the count is known. */
export function pendingRequests(q: PendingRequests): number | null {
  return q.state === "ok" ? q.n : null;
}

export default function AccessRequests({ q }: { q: PendingRequests }) {
  if (q.state === "loading") return <PaneLoading />;
  if (q.state === "denied") return <Notice ico="lock" text="Access requests are not in your access." />;
  if (q.state === "error") return <Notice tone="bad" ico="alert" text={q.message} />;
  if (q.n > 0) {
    return (
      <Notice ico="inbox" text={
        q.n + " access request" + (q.n === 1 ? " is" : "s are") + " waiting. Deciding them is not on this page yet."
      } />
    );
  }
  return (
    <EmptyState
      icon="inbox"
      title="No access requests"
      body="Nobody is waiting. When a member is locked out and asks for a reset, the request lands here for an Admin to review."
    />
  );
}
