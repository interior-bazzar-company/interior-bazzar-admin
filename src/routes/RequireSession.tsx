/* The shell guards the session first: no session, a suspended one, or one with
   no role, and it sends you to the door with the address you were trying to
   reach preserved. Ported from admin-shell.js `guard()`.

   The role is re-read from the USER RECORD on every boot — never trusted from
   the session blob. That is the property the auth page exists to hold. */
import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { IBData } from "../admin/engines";

export default function RequireSession({ children }: { children: ReactNode }) {
  const location = useLocation();
  const u = IBData.TeamStore.current();
  const next = encodeURIComponent(location.pathname + location.search);

  if (!u) return <Navigate to={"/login?next=" + next} replace />;
  if (u.status === "suspended" || u.status === "deactivated" || u.status === "locked")
    return <Navigate to="/login?blocked=1" replace />;
  if (!u.role || u.status === "pending") return <Navigate to="/login?pending=1" replace />;

  return <>{children}</>;
}
