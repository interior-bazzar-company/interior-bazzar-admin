/* The shell guards the session first: no token, an unresolvable one, or one
   with zero access, and it sends you to the door with the address you were
   trying to reach preserved. Ported from admin-shell.js `guard()`, now reading
   the real server session (admin/auth/session.ts) instead of
   IBData.TeamStore.current().

   The matrix is re-fetched from the SERVER on every fresh mount of the shell
   (boot, or a hard refresh) — never trusted from a stored blob. That is the
   property the auth page exists to hold, and it is why an unresolved fetch
   renders the panel's loading state rather than a permissive shell: a missing
   authorization answer must deny, not allow. */
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import AdminLoader from "../components/shared/AdminLoader";
import { TokenService } from "../api/apiService/authHelper/TokenService";
import { clearSession, getSession, isZeroAccess, loadSession, sessionUnreachable } from "../admin/auth/session";
import ServiceDown from "../components/shared/ServiceDown";

export default function RequireSession({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [ready, setReady] = useState(!!getSession());
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (getSession()) return;
    let cancelled = false;
    setReady(false);
    loadSession().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const next = encodeURIComponent(location.pathname + location.search);

  if (!TokenService.getAccessToken()) return <Navigate to={"/login?next=" + next} replace />;
  if (!ready) return <AdminLoader />;

  const session = getSession();
  /* The service could not be reached — a stopped backend, a restart, a dropped
     connection. That is NOT an answer about this account, so it must not be
     shown as one and must not clear the tokens: the panel waits, with its own
     screen and a retry, and the same session resumes the moment the server is
     back. Only a resolved refusal below signs anybody out. */
  if (!session && sessionUnreachable()) return <ServiceDown onRetry={() => setAttempt((n) => n + 1)} />;
  if (!session) {
    clearSession();
    return <Navigate to="/login?blocked=1" replace />;
  }
  /* `gateOk` is new and additive — a backend that hasn't deployed it yet, or
     a request racing that deploy, omits the field. `=== false` only matches
     an explicit denial, so `undefined` reads as "not blocked" and nobody is
     locked out by a rollout timing gap. A soft-deleted, demoted or
     role-stripped admin fails the gate WITH a resolved session (unlike the
     `!session` branch above, which is a fetch failure) — that is a distinct
     outcome from `isZeroAccess` (a genuine new hire, no role yet), so it is
     checked first and sent to the restored "Access withdrawn" copy, not the
     "pending" screen. */
  if (session.gateOk === false) {
    clearSession();
    return <Navigate to="/login?blocked=gate" replace />;
  }
  if (isZeroAccess(session)) return <Navigate to="/login?pending=1" replace />;

  return <>{children}</>;
}
