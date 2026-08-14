/* =============================================================================
   Auth — the React port of prototype/admin-panel/admin-access/admin-auth.html.
   Identical model and storage: users and sessions come from IBData.TeamStore,
   which is the SAME `ib_team_users` / `ib_team_session` store the panel's
   Settings → Team reads.

   Two things differ from the prototype, both forced by the move to real routes:
     - the panel lives at real paths, so `next` is a PATH, not a hash. It is
       still accepted only in one shape — a same-origin path — and an absolute,
       protocol-relative or scheme-bearing value is REFUSED, not sanitised.
     - the four steps are React state rather than `.step.on` class flipping;
       the emitted class names are unchanged.
   ========================================================================== */
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IBData, IBTeam } from "../engines";
import "../../styles/admin-theme.css";
import "./admin-auth.css";

const TS = IBData.TeamStore;

type TeamUser = {
  id: string;
  name: string;
  email: string;
  username?: string;
  status: string;
  role: string | null;
  failedAttempts?: number;
  lastLogin?: number | null;
};

type Step = "login" | "pending" | "blocked" | "active";
type Banner = { kind: string; title: string; body: ReactNode };

/* Hashing lives in the team engine so the sign-in page and the panel cannot
   disagree about what a valid password is. */
function verify(user: TeamUser, plain: string): boolean {
  return IBTeam.verifyPassword(user, plain);
}
function byUsername(list: TeamUser[], name: string): TeamUser | null {
  const v = String(name || "").trim().toLowerCase();
  if (!v) return null;
  for (let i = 0; i < list.length; i++)
    if (String(list[i].username || "").toLowerCase() === v) return list[i];
  return null;
}
const MAX_ATTEMPTS: number = TS.MAX_ATTEMPTS;

/* The redirect target. `next` is accepted only as a same-origin PATH, never as
   an arbitrary URL: an absolute or protocol-relative value from a query string
   is an open-redirect vector, so it is rejected rather than sanitised. */
function nextPath(n: string | null): string {
  const v = n || "";
  return /^\/[A-Za-z0-9\-_/?=&.%]*$/.test(v) && v.indexOf("//") === -1 ? v : "/deals";
}

/* Seeded demo passwords, named here because a hashed record cannot give one
   back. These are the four in the README — prototype credentials, not secrets.
   Anyone created through the Team module has a generated password the admin
   passed on, and is deliberately absent from this list. */
const DEMO_PW: Record<string, string> = {
  "founder@interiorbazzar.com": "admin123",
  "r.menon@interiorbazzar.com": "sales123",
  "priya.nair@interiorbazzar.com": "priya1234",
  "k.iyer@interiorbazzar.com": "kiyer1234",
};

const LOCKED_BANNER: Banner = {
  kind: "err2",
  title: "Account locked",
  body: (
    <>
      Too many failed attempts. Use <b>Can’t sign in?</b> to have an Admin reset it.
    </>
  ),
};

export default function AdminAuth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [step, setStep] = useState<Step>("login");
  const [banner, setBanner] = useState<Banner | null>(null);
  const [who, setWho] = useState("");
  const [pass, setPass] = useState("");
  const [user, setUser] = useState<TeamUser | null>(null);
  const [demo, setDemo] = useState<{ email: string; name: string; role: string; status: string }[]>([]);
  const passRef = useRef<HTMLInputElement>(null);
  const booted = useRef(false);

  function enterPanel() {
    navigate(nextPath(params.get("next")));
  }

  /* ---------- register ---------- */
  function handleLogin() {
    setBanner(null);
    const users = TS.load() as TeamUser[];
    /* Members have a username as well as an email now, and an operator reading
       credentials down a phone gives whichever is shorter. Accept both. */
    const u: TeamUser | null = TS.byEmail(users, who.trim()) || byUsername(users, who.trim());

    if (u && u.status === "locked") {
      setBanner(LOCKED_BANNER);
      return;
    }

    /* Verified against the stored SALTED HASH, never a stored password — there
       is no plaintext in the record to compare with any more. A record written
       before hashing existed is migrated on its first successful sign-in. */
    if (!u || !verify(u, pass)) {
      // Generic message — never reveal which half was wrong.
      if (u) {
        u.failedAttempts = (u.failedAttempts || 0) + 1;
        if (u.failedAttempts >= MAX_ATTEMPTS) {
          u.status = "locked";
          TS.save(users);
          setBanner(LOCKED_BANNER);
          return;
        }
        TS.save(users);
      }
      const remaining = u ? MAX_ATTEMPTS - (u.failedAttempts || 0) : 0;
      setBanner({
        kind: "err2",
        title: "That email or password isn’t right",
        body: (
          <>
            Check both and try again.
            {u ? (
              <>
                {" "}
                <b>{remaining}</b> attempts remain before a lock.
              </>
            ) : null}
          </>
        ),
      });
      return;
    }

    u.failedAttempts = 0;

    if (u.status === "suspended" || u.status === "deactivated") {
      TS.save(users);
      setUser(u);
      setStep("blocked");
      return;
    }

    u.lastLogin = Date.now();
    TS.save(users);
    TS.setSession(u.id);

    setUser(u);
    setStep(u.status === "pending" || !u.role ? "pending" : "active");
  }

  function handleLogout() {
    TS.clearSession();
    setPass("");
    setUser(null);
    setStep("login");
    setBanner(null);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleLogin();
  }

  function fill(email: string, pw: string) {
    setWho(email);
    setPass(pw);
    passRef.current?.focus();
  }

  /* ---------- boot ---------- */
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    const list = TS.load() as TeamUser[];
    setDemo(
      list
        .filter((u) => DEMO_PW[u.email])
        .map((u) => {
          const r = u.role ? IBTeam.roleOf(u.role) : null;
          return {
            email: u.email,
            name: u.name,
            role: r ? r.name : u.role ? TS.ROLE_LABEL[u.role] || u.role : "No role",
            status: u.status,
          };
        }),
    );

    if (params.get("bye"))
      setBanner({ kind: "ok2", title: "Signed out", body: "Your session has been cleared on this device." });
    if (params.get("blocked"))
      setBanner({
        kind: "err2",
        title: "Access withdrawn",
        body: "This account is suspended, deactivated or locked. Contact an Admin.",
      });

    const current = TS.current() as TeamUser | null;
    if (!current) return;

    // Re-resolve the outcome from the USER RECORD rather than trusting the session.
    if (current.status === "suspended" || current.status === "deactivated" || current.status === "locked") {
      TS.clearSession();
      setBanner({
        kind: "err2",
        title: "Access withdrawn",
        body: "This account can no longer sign in. Contact an Admin.",
      });
      return;
    }
    if (current.status === "pending" || !current.role) {
      setUser(current);
      setStep("pending");
      return;
    }

    // A live session with a role: say so, and offer the door rather than
    // silently bouncing — a redirect loop is the worst thing a guard can do.
    setUser(current);
    setStep("active");
    if (!params.get("pending") && !params.get("bye") && !params.get("blocked")) enterPanel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSusp = user ? user.status === "suspended" : true;
  const grants: string[] = user && user.role ? TS.ROLE_GRANTS[user.role] || [] : [];

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
              <input className="inp" type="password" id="loginPass" autoComplete="current-password"
                     placeholder="••••••••" ref={passRef} value={pass}
                     onChange={(e) => setPass(e.target.value)} onKeyDown={onKey} />
              <div className="err" id="err-loginPass" />
            </div>

            <button className="btn pri lg full" onClick={handleLogin}>Sign in</button>

            <div className="demo">
              <div className="demo-h">
                <svg className="ic sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <circle cx="12" cy="12" r="9" /><path d="M12 8v4.5M12 16h.01" />
                </svg>
                DEMO ACCOUNTS — PROTOTYPE ONLY
              </div>
              <div id="demoRows">
                {demo.map((r) => (
                  <div className="demo-r" key={r.email}>
                    <div>
                      <b>{r.name}</b>
                      <div className="m">{r.role} · {r.status}</div>
                    </div>
                    <button onClick={() => fill(r.email, DEMO_PW[r.email])}>Use</button>
                  </div>
                ))}
              </div>
            </div>

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

          {/* -------------------------------------------------------- BLOCKED */}
          <div className={"step" + (step === "blocked" ? " on" : "")} id="step-blocked">
            <div className="icon-round stop">
              <svg className="ic lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                   strokeLinecap="round" strokeLinejoin="round"><rect x="4.6" y="10" width="14.8" height="10" rx="2" /><path d="M8 10V7.2a4 4 0 0 1 8 0V10" /></svg>
            </div>
            <h2 id="blockedTitle">{isSusp ? "Access suspended" : "Account deactivated"}</h2>
            <p className="lede" id="blockedMsg">
              {isSusp
                ? "Your access has been temporarily suspended. Contact an Admin if you believe this is a mistake."
                : "This account has been deactivated. Historical activity is retained; contact an Admin about restoration."}
            </p>
            <div style={{ height: 22 }} />
            <button className="btn lg full" onClick={handleLogout}>Back to sign in</button>
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
                ? "Signed in as " + TS.ROLE_LABEL[user.role] + ". Effective access, resolved fresh for this session:"
                : ""}
            </p>
            <div className="grants" id="activeGrants">
              {grants.map((g) => (
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
