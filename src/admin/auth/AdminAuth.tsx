/* =============================================================================
   Auth — the React port of prototype/admin-panel/admin-access/admin-auth.html.
   -----------------------------------------------------------------------------
   Signs in against the real server (POST v1/auth/signin/, portal: "admin")
   instead of IBData.TeamStore's localStorage demo accounts. The demo-accounts
   box and the seeded demo credentials are gone — the only way in is a real
   session, and the panel's own RBAC matrix (admin/auth/session.ts) decides
   what it is worth once it exists.

   Two things differ from the prototype, both forced by the move to real
   routes and a real backend:
     - the panel lives at real paths, so `next` is a PATH, not a hash. It is
       still accepted only in one shape — a same-origin path — and an absolute,
       protocol-relative or scheme-bearing value is REFUSED, not sanitised.
     - the four steps are React state rather than `.step.on` class flipping;
       the emitted class names are unchanged.

   WHERE THIS DIFFERS FROM THE 9-STATE PROTOTYPE PORT, and why (see the report
   for the full account — this is the short version in the code that has to
   live with the decision):

     · "Account locked" (a client-side 5-failed-attempt counter written into
       TeamStore) had no server equivalent to port — the counter itself was
       the localStorage credential path this phase deletes, and the API
       contract does not expose a "locked" reason distinct from "wrong
       credentials" (deliberately: revealing an account is locked, rather
       than possibly-wrong, is exactly the kind of half-revealed answer the
       generic wording exists to prevent). The banner's COPY is kept — wired
       to a standard HTTP 423 (Locked) status, which the backend does not yet
       send — so the state activates without fabricating a client-side
       attempt count if the backend ever adopts it, but is not reachable today.
     · The component-level "blocked" step (two distinct titles for suspended
       vs deactivated) is gone outright: the contract's `user` object carries
       no status field to tell the two apart, and — per the contract — a
       correct-password sign-in against an inactive account now FAILS at
       sign-in with the same generic message, so this screen (which only ever
       rendered AFTER a successful credential check) can no longer be reached
       that way. The generic "Access withdrawn" banner below (worded
       "suspended, deactivated or locked" without distinguishing) is what a
       plain `?blocked=1` shows — an existing session that failed to resolve
       at all. A second, more specific "Access withdrawn" body — "This
       account can no longer sign in." — is also restored (prototype
       admin-auth.html:405, dormant there behind a client-side re-resolve this
       phase has no equivalent for): RequireSession now sends a session that
       DID resolve but failed the server's admin gate (soft-deleted, demoted,
       role-stripped) to `?blocked=gate`, and that is where this string
       renders. The two are not the same claim: one is "we couldn't tell",
       the other is "we asked, and the answer is no".
     · The "remaining attempts" figure in the invalid-credentials banner is
       restored dormant, alongside LOCKED_BANNER's HTTP-423 wiring: the count
       was TeamStore's client-side `failedAttempts`, which this phase deleted
       along with the rest of the local demo store, and no server field
       replaces it yet. `invalidBanner()` accepts one if the backend ever
       adds it; nothing today supplies it, so the line never renders — never
       a fabricated count, per guardrail 6.
   ========================================================================== */
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppExceptions, isServiceError } from "../../api/apiService";
import { AuthService } from "../../api/modules/auth";
import { TokenService } from "../../api/apiService/authHelper/TokenService";
import type { LoginFormResponse } from "../../types/global";
import { clearSession, grantsOf, isZeroAccess, loadSession, sessionUnreachable } from "./session";
import "../../styles/admin-theme.css";
import "./admin-auth.css";

type Identity = { name: string; role: string | null; grants: string[] };
type Step = "login" | "pending" | "active";
type Banner = { kind: string; title: string; body: ReactNode };

/* The redirect target. `next` is accepted only as a same-origin PATH, never as
   an arbitrary URL: an absolute or protocol-relative value from a query string
   is an open-redirect vector, so it is rejected rather than sanitised. */
function nextPath(n: string | null): string {
  const v = n || "";
  return /^\/[A-Za-z0-9\-_/?=&.%]*$/.test(v) && v.indexOf("//") === -1 ? v : "/deals";
}

const LOCKED_BANNER: Banner = {
  kind: "err2",
  title: "Account locked",
  body: (
    <>
      Too many failed attempts. Use <b>Can’t sign in?</b> to have an Admin reset it.
    </>
  ),
};
/* Restored from the prototype (admin-auth.html:311) — dormant, like
   LOCKED_BANNER above: the "N attempts remain" count was TeamStore's
   client-side `failedAttempts` counter, deleted along with the rest of the
   local demo store. No server response field replaces it yet, so this takes
   one if the backend ever adds it and renders nothing extra otherwise —
   never a fabricated count (guardrail 6). Every existing call site passes no
   argument, so this is inert until something supplies a real number. */
function invalidBanner(attemptsRemaining?: number): Banner {
  return {
    kind: "err2",
    title: "That email or password isn’t right",
    body: (
      <>
        Check both and try again.
        {typeof attemptsRemaining === "number" && (
          <>
            {" "}
            <b>{attemptsRemaining}</b> attempts remain before a lock.
          </>
        )}
      </>
    ),
  };
}
const INVALID_BANNER = invalidBanner();
const WITHDRAWN_BANNER: Banner = {
  kind: "err2",
  title: "Access withdrawn",
  body: "This account is suspended, deactivated or locked. Contact an Admin.",
};
/* Restored from the prototype (admin-auth.html:405) — the distinct body for
   a session that resolved but failed the server's admin gate, as opposed to
   WITHDRAWN_BANNER above (a session that didn't resolve at all). Wired to
   RequireSession's `?blocked=gate` (session.gateOk === false). */
const GATE_BLOCKED_BANNER: Banner = {
  kind: "err2",
  title: "Access withdrawn",
  body: "This account can no longer sign in. Contact an Admin.",
};
/* The service could not be reached at all. Deliberately says nothing about a
   host, a port or a status code — and, just as deliberately, is NOT
   INVALID_BANNER: telling somebody their password is wrong when the server is
   simply down sends them to reset a credential that was never the problem. */
const SERVICE_BANNER: Banner = {
  kind: "err2",
  title: "Something went wrong",
  body: "We couldn’t reach the service just now. Please try again in a moment.",
};
const SIGNED_OUT_BANNER: Banner = {
  kind: "ok2",
  title: "Signed out",
  body: "Your session has been cleared on this device.",
};

export default function AdminAuth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [step, setStep] = useState<Step>("login");
  const [banner, setBanner] = useState<Banner | null>(null);
  const [who, setWho] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState<Identity | null>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const booted = useRef(false);

  function enterPanel() {
    navigate(nextPath(params.get("next")));
  }

  /* ---------- sign in ---------- */
  async function handleLogin() {
    if (busy) return;
    setBanner(null);
    setBusy(true);
    try {
      const res = await AuthService.signinAdmin({ username: who.trim(), password: pass });
      const data = res.data as LoginFormResponse;
      TokenService.setTokens(data.accessToken, data.refreshToken);
      const s = await loadSession(true);
      if (!s) {
        /* Credentials were accepted and tokens are already stored; only the
           permission read failed. If that was the service, keep them — the
           next attempt resumes — and never call it a bad password. */
        if (sessionUnreachable()) {
          setBanner(SERVICE_BANNER);
          return;
        }
        clearSession();
        setBanner(INVALID_BANNER);
        return;
      }
      setUser({ name: s.user.name, role: s.role, grants: grantsOf(s) });
      setStep(isZeroAccess(s) ? "pending" : "active");
    } catch (e) {
      // An unreachable server is not a verdict on the credentials — say so,
      // and leave whatever is on this device alone.
      if (isServiceError(e)) {
        setBanner(SERVICE_BANNER);
        return;
      }
      clearSession();
      // Generic message — never reveal which half was wrong, and never
      // distinguish "locked" from "wrong" either (see the header note).
      setBanner(e instanceof AppExceptions && e.code === 423 ? LOCKED_BANNER : INVALID_BANNER);
    } finally {
      setBusy(false);
    }
  }

  function handleLogout() {
    void AuthService.signout().catch(() => {});
    clearSession();
    setPass("");
    setShowPass(false);
    setUser(null);
    setStep("login");
    setBanner(null);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleLogin();
  }

  /* ---------- boot ---------- */
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    if (params.get("bye")) setBanner(SIGNED_OUT_BANNER);
    if (params.get("blocked") === "gate") setBanner(GATE_BLOCKED_BANNER);
    else if (params.get("blocked")) setBanner(WITHDRAWN_BANNER);

    /* A token already on this device — re-resolve from the SERVER, never
       trust a stored session blob. */
    if (!TokenService.getAccessToken()) return;
    loadSession().then((s) => {
      if (!s) {
        /* Down, not denied. Keep the tokens and say the honest thing — wiping
           a good session because the server blinked is the bug this replaces. */
        if (sessionUnreachable()) {
          setBanner(SERVICE_BANNER);
          return;
        }
        clearSession();
        setBanner(WITHDRAWN_BANNER);
        return;
      }
      setUser({ name: s.user.name, role: s.role, grants: grantsOf(s) });
      if (isZeroAccess(s)) {
        setStep("pending");
        return;
      }
      setStep("active");
      if (!params.get("pending") && !params.get("bye") && !params.get("blocked")) enterPanel();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="auth">
      {/* ------------------------------------------------------------- brand */}
      <section className="brandside">
        <div className="bs-top">
          <span className="bs-mark">ib</span>
          <span className="bs-name">
            Interior bazzar<small>Admin access</small>
          </span>
        </div>

        <div className="bs-mid">
          <h1>
            One workspace for <em>everything</em> you run.
          </h1>
          <p>
            Deals, quotations, invoices, the payment ledger, the marketplace and the people who work it —
            behind one door, in one place.
          </p>
          <div className="bs-list">
            <div>
              <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                   strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.6 4.6L19 7.5" /></svg>
              <span>Every queue across seven modules, on one screen</span>
            </div>
            <div>
              <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                   strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.6 4.6L19 7.5" /></svg>
              <span>Follow a deal from enquiry to money in the bank</span>
            </div>
            <div>
              <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                   strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.6 4.6L19 7.5" /></svg>
              <span>Access resolved fresh on every request, never cached</span>
            </div>
          </div>
        </div>

        <div className="bs-foot">Feelsafe Technology India Pvt Ltd · staff access only</div>
      </section>

      {/* -------------------------------------------------------------- form */}
      <section className="formside">
        <div className="box">

          {/* ---------------------------------------------------------- LOGIN */}
          <div className={"step" + (step === "login" ? " on" : "")} id="step-login">
            <h2>Welcome back</h2>
            <p className="lede">
              Sign in with the username or email your admin gave you. Access is decided by your role, not by
              signing in.
            </p>
            <div id="loginBanner" style={{ marginTop: 20 }}>
              {banner ? (
                <div className={"banner " + banner.kind}>
                  <div>
                    <b>{banner.title}</b>
                    {banner.body}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="fg">
              <label htmlFor="loginEmail">Username or work email</label>
              <input className="inp" type="text" id="loginEmail" autoComplete="username"
                     placeholder="you@interiorbazzar.com" value={who}
                     onChange={(e) => setWho(e.target.value)} onKeyDown={onKey} />
              <div className="err" id="err-loginEmail" />
            </div>

            <div className="fg">
              <label htmlFor="loginPass">Password</label>
              <div className="pw">
                <input className="inp" type={showPass ? "text" : "password"} id="loginPass"
                       autoComplete="current-password"
                       placeholder="••••••••" ref={passRef} value={pass}
                       onChange={(e) => setPass(e.target.value)} onKeyDown={onKey} />
                <button type="button" className="tlink" onClick={() => setShowPass((v) => !v)}
                        aria-label={(showPass ? "Hide" : "Show") + " password"}>
                  {showPass ? "Hide" : "Show"}
                </button>
              </div>
              <div className="err" id="err-loginPass" />
            </div>

            <button className="btn pri lg full" onClick={handleLogin} disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>

            <div className="foot">
              Accounts are created by an admin — there is no public sign-up. Lost your password? Ask an admin
              to reset it.
            </div>
          </div>

          {/* -------------------------------------------------------- PENDING */}
          <div className={"step" + (step === "pending" ? " on" : "")} id="step-pending">
            <div className="icon-round wait">
              <svg className="ic lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                   strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7.2v5.1l3.3 1.9" /></svg>
            </div>
            <h2>Signed in — access pending</h2>
            <p className="lede" id="pendingMsg">
              {user ? "You’re signed in as " + user.name + ". Dashboard access is awaiting Admin assignment." : ""}
            </p>
            <div className="banner warn2" style={{ marginTop: 20 }}>
              <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M12 3.4 21.2 20H2.8z" /><path d="M12 9.4v4.8M12 17.2h.01" />
              </svg>
              <div>
                <b>This is not an error</b>A successful sign-in never implies access to anything. Your account
                holds <b>zero permissions by construction</b> until an Admin assigns a role — you are the
                number in their <span className="mono">Team</span> badge right now.
              </div>
            </div>
            <button className="btn lg full" onClick={handleLogout} style={{ marginTop: 18 }}>Sign out</button>
          </div>

          {/* --------------------------------------------------------- ACTIVE */}
          <div className={"step" + (step === "active" ? " on" : "")} id="step-active">
            <div className="icon-round ok3">
              <svg className="ic lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                   strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.2 19.6 6v6c0 4.7-3.2 7.6-7.6 8.6C7.6 19.6 4.4 16.7 4.4 12V6z" /><path d="m9.2 12 2.1 2.1L15 10.4" /></svg>
            </div>
            <h2 id="activeTitle">{user ? "Welcome back, " + user.name.split(" ")[0] : "Welcome back"}</h2>
            <p className="lede" id="activeMsg">
              {user && user.role
                ? "Signed in as " + user.role + ". Effective access, resolved fresh for this session:"
                : ""}
            </p>
            <div className="grants" id="activeGrants">
              {(user ? user.grants : []).map((g) => (
                <span className="chip" key={g}>{g}</span>
              ))}
            </div>
            <button className="btn pri lg full" id="continueBtn" onClick={enterPanel}>Continue to the panel →</button>
            <div className="foot">
              <button className="tlink" onClick={handleLogout}>Not you? Sign out</button>
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}
