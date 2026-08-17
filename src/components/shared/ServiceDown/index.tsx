/* ── ServiceDown ── the screen for "we could not reach the service".
   -----------------------------------------------------------------------------
   The panel's session is what builds the sidebar, so when it cannot be resolved
   there is no shell to render a banner inside — this is that case, and it is the
   one place a full-page state is right. It replaces the blank white page a
   failed boot fetch used to leave behind.

   It says nothing about the backend. Not the host, not the status code, not
   "connection refused": an operator reads that from the server, and an admin
   reading this screen can do exactly one thing about it, which is the button. */
import { Link } from "react-router-dom";
import { EmptyState } from "../../../admin/ui";
import { clearSession } from "../../../admin/auth/session";
import "../../../styles/admin-theme.css";

export default function ServiceDown({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "40px 20px",
        /* The theme's own tokens — there is no `--text-1`; the scale is
           `--text` / `--text-2` / `--text-3`. */
        background: "var(--bg-shell)",
        color: "var(--text)",
      }}
    >
      <div style={{ maxWidth: 460, width: "100%" }}>
        <EmptyState
          icon="alert"
          title="Something went wrong"
          body="We couldn’t reach the service just now. Your sign-in is untouched — this is on our side. Try again in a moment."
          action={
            <>
              <button className="btn pri" onClick={onRetry}>
                Try again
              </button>
              {/* The way out. Without it a stale token plus a down service is a
                  screen with no exit but the address bar. */}
              <div style={{ marginTop: 14 }}>
                <Link className="tlink" to="/login?bye=1" onClick={() => clearSession()}>
                  Sign out
                </Link>
              </div>
            </>
          }
        />
      </div>
    </div>
  );
}
