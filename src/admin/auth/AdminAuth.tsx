/* =============================================================================
   Auth — the door.
   -----------------------------------------------------------------------------
   Signs in against the real server (POST v1/auth/signin/, portal: "admin").
   The only way in is a real session, and the panel's own RBAC matrix
   (admin/auth/session.ts) decides what it is worth once it exists.

   Two things forced by real routes and a real backend:
     - `next` is a PATH, not a hash. It is accepted only as a same-origin path;
       an absolute, protocol-relative or scheme-bearing value is REFUSED.
     - the three steps — login · pending · active — are React state.

   The dormant states (an HTTP-423 lock banner, the "attempts remain" count)
   are kept exactly as before: wired to a signal the backend does not send yet,
   never fabricated client-side.

   THE HERO IS THE ONE LARGE DARK FILL IN THE PRODUCT, with the forest thread
   through it — the mark's dot, the emphasised word, the ticks. Everything else
   on the door is the panel's own controls.
   ========================================================================== */
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cx } from "@/utils/cx";
import { AppExceptions, isServiceError } from "../../api/apiService";
import { AuthService } from "../../api/modules/auth";
import { TokenService } from "../../api/apiService/authHelper/TokenService";
import type { LoginFormResponse } from "../../types/global";
import { clearSession, grantsOf, isZeroAccess, loadSession, sessionUnreachable } from "./session";
import { currentTheme, setTheme } from "../shell/ShellContext";
import { Alert, Button, FormField, Icon, Input, Pill, Segmented } from "../ui";

type Identity = { name: string; role: string | null; grants: string[] };
type Step = "login" | "pending" | "active";
type Banner = { kind: "ok" | "warn" | "bad" | "info"; title: string; body: ReactNode };

/* The redirect target: a same-origin PATH, never an arbitrary URL. */
function nextPath(n: string | null): string {
  const v = n || "";
  return /^\/[A-Za-z0-9\-_/?=&.%]*$/.test(v) && v.indexOf("//") === -1 ? v : "/overview";
}

const LOCKED_BANNER: Banner = {
  kind: "bad",
  title: "Account locked",
  body: (
    <>
      Too many failed attempts. Use <b>Can’t sign in?</b> to have an Admin reset it.
    </>
  ),
};
/* Dormant: the "N attempts remain" count has no server field yet; this takes
   one if the backend ever adds it and renders nothing extra otherwise. */
function invalidBanner(attemptsRemaining?: number): Banner {
  return {
    kind: "bad",
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
const WITHDRAWN_BANNER: Banner = { kind: "bad", title: "Access withdrawn", body: "This account is suspended, deactivated or locked. Contact an Admin." };
const GATE_BLOCKED_BANNER: Banner = { kind: "bad", title: "Access withdrawn", body: "This account can no longer sign in. Contact an Admin." };
const SERVICE_BANNER: Banner = { kind: "bad", title: "Something went wrong", body: "We couldn’t reach the service just now. Please try again in a moment." };
const SIGNED_OUT_BANNER: Banner = { kind: "ok", title: "Signed out", body: "Your session has been cleared on this device." };

/* The same three choices the panel's account menu offers, on the door itself. */
function AppearanceSwitch() {
  const [cur, setCur] = useState(currentTheme);
  return (
    <div className="flex items-center gap-2">
      <span className="label-mono">Theme</span>
      <Segmented
        sm
        label="Theme"
        value={cur}
        options={[
          { v: "light", l: "Light" },
          { v: "dark", l: "Dark" },
          { v: "system", l: "System" },
        ]}
        onPick={(v) => {
          setTheme(v);
          setCur(v);
        }}
      />
    </div>
  );
}

export default function AdminAuth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [step, setStep] = useState<Step>("login");
  const [banner, setBanner] = useState<Banner | null>(null);
  const [who, setWho] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState<Identity | null>(null);
  const booted = useRef(false);

  function enterPanel() {
    navigate(nextPath(params.get("next")));
  }

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
      if (isServiceError(e)) {
        setBanner(SERVICE_BANNER);
        return;
      }
      clearSession();
      setBanner(e instanceof AppExceptions && e.code === 423 ? LOCKED_BANNER : INVALID_BANNER);
    } finally {
      setBusy(false);
    }
  }

  function handleLogout() {
    void AuthService.signout().catch(() => {});
    clearSession();
    setPass("");
    setUser(null);
    setStep("login");
    setBanner(null);
  }

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    if (params.get("bye")) setBanner(SIGNED_OUT_BANNER);
    if (params.get("blocked") === "gate") setBanner(GATE_BLOCKED_BANNER);
    else if (params.get("blocked")) setBanner(WITHDRAWN_BANNER);
    if (!TokenService.getAccessToken()) return;
    loadSession().then((s) => {
      if (!s) {
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
    <div className="grid min-h-dvh bg-secondary lg:grid-cols-2">
      {/* ------------------------------------------------------------- brand */}
      <section
        className="relative hidden flex-col overflow-hidden bg-hero px-14 py-12 text-hero lg:flex"
        style={{
          backgroundImage: "linear-gradient(var(--color-border-hero) 1px, transparent 1px), linear-gradient(90deg, var(--color-border-hero) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      >
        <div aria-hidden="true" className="pointer-events-none absolute -right-36 -bottom-44 size-[520px] rounded-full border border-hero bg-fg-hero-accent/5" />
        <div aria-hidden="true" className="pointer-events-none absolute -top-32 right-16 size-[300px] rounded-full border border-hero" />

        <div className="relative z-10 flex items-center gap-3">
          <span className="relative grid size-9 place-items-center rounded-lg border border-hero text-lg font-bold tracking-tight">
            ib
            <span aria-hidden="true" className="absolute -top-1 -right-1 size-2.5 rounded-full bg-fg-hero-accent ring-2 ring-bg-hero" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-md font-semibold">Interior bazzar</span>
            <span className="label-mono mt-1 text-hero-muted">Admin access</span>
          </span>
        </div>

        <div className="relative z-10 my-auto max-w-lg">
          <h1 className="text-display-md font-semibold tracking-tight text-balance">
            One workspace for <em className="not-italic text-fg-hero-accent">everything</em> you run.
          </h1>
          <p className="mt-4 text-md leading-relaxed text-hero-muted">Deals, quotations, invoices, the payment ledger, the marketplace and the people who work it — behind one door, in one place.</p>
          <ul className="mt-8 flex flex-col gap-3 text-sm">
            {["Every queue across seven modules, on one screen", "Follow a deal from enquiry to money in the bank", "Access resolved fresh on every request, never cached"].map((s) => (
              <li key={s} className="flex items-start gap-3">
                <Icon name="check" size="sm" className="mt-0.5 text-fg-hero-accent" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="label-mono relative z-10 text-hero-muted">Feelsafe Technology India Pvt Ltd · staff access only</div>
      </section>

      {/* -------------------------------------------------------------- form */}
      <section className="relative flex items-start justify-center px-5 pt-20 pb-10 lg:items-center lg:px-8 lg:pt-10">
        <div className="absolute top-5 right-5">
          <AppearanceSwitch />
        </div>
        <div className="w-full max-w-sm">
          {/* ---------------------------------------------------------- LOGIN */}
          <div className={cx(step !== "login" && "hidden")} id="step-login">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <span className="grid size-9 place-items-center rounded-lg bg-brand-solid text-md font-bold text-white">ib</span>
              <span className="text-md font-semibold text-primary">Interior bazzar Admin</span>
            </div>
            <h2 className="text-display-xs font-semibold tracking-tight text-primary">Welcome back</h2>
            <p className="mt-1.5 text-sm text-tertiary">Sign in with the username or email your admin gave you. Access is decided by your role, not by signing in.</p>
            <div className="mt-5" id="loginBanner">
              {banner ? (
                <Alert tone={banner.kind} title={banner.title}>
                  {banner.body}
                </Alert>
              ) : null}
            </div>
            <div className="mt-5 flex flex-col gap-4">
              <FormField id="loginEmail" label="Username or work email">
                <Input id="loginEmail" type="text" ph="you@interiorbazzar.com" value={who} onChange={setWho} onEnter={handleLogin} autoFocus />
              </FormField>
              <FormField id="loginPass" label="Password">
                <Input id="loginPass" type="password" ph="••••••••" value={pass} onChange={setPass} onEnter={handleLogin} />
              </FormField>
            </div>
            <Button color="primary" size="lg" block className="mt-6" isLoading={busy} showTextWhileLoading onClick={handleLogin}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
            <p className="mt-6 border-t border-secondary pt-5 text-sm text-tertiary">Accounts are created by an admin — there is no public sign-up. Lost your password? Ask an admin to reset it.</p>
          </div>

          {/* -------------------------------------------------------- PENDING */}
          <div className={cx(step !== "pending" && "hidden")} id="step-pending">
            <span className="mb-4 grid size-12 place-items-center rounded-xl bg-warning-primary text-fg-warning-primary ring-1 ring-utility-yellow-200 ring-inset">
              <Icon name="clock" size="lg" />
            </span>
            <h2 className="text-display-xs font-semibold tracking-tight text-primary">Signed in — access pending</h2>
            <p className="mt-1.5 text-sm text-tertiary" id="pendingMsg">
              {user ? "You’re signed in as " + user.name + ". Dashboard access is awaiting Admin assignment." : ""}
            </p>
            <div className="mt-5">
              <Alert tone="warn" title="This is not an error">
                A successful sign-in never implies access to anything. Your account holds <b>zero permissions by construction</b> until an Admin assigns a role — you are the
                number in their <span className="font-mono">Team</span> badge right now.
              </Alert>
            </div>
            <Button color="secondary" size="lg" block className="mt-5" onClick={handleLogout}>
              Sign out
            </Button>
          </div>

          {/* --------------------------------------------------------- ACTIVE */}
          <div className={cx(step !== "active" && "hidden")} id="step-active">
            <span className="mb-4 grid size-12 place-items-center rounded-xl bg-success-primary text-fg-success-primary ring-1 ring-utility-green-200 ring-inset">
              <Icon name="shield" size="lg" />
            </span>
            <h2 className="text-display-xs font-semibold tracking-tight text-primary" id="activeTitle">
              {user ? "Welcome back, " + user.name.split(" ")[0] : "Welcome back"}
            </h2>
            <p className="mt-1.5 text-sm text-tertiary" id="activeMsg">
              {user && user.role ? "Signed in as " + user.role + ". Effective access, resolved fresh for this session:" : ""}
            </p>
            <div className="mt-4 mb-5 flex flex-wrap gap-1.5" id="activeGrants">
              {(user ? user.grants : []).map((g) => (
                <Pill key={g} tone="neutral" text={g} />
              ))}
            </div>
            <Button color="primary" size="lg" block id="continueBtn" ico="arrow" onClick={enterPanel}>
              Continue to the panel
            </Button>
            <div className="mt-5 border-t border-secondary pt-4">
              <Button color="link-gray" size="sm" onClick={handleLogout}>
                Not you? Sign out
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
