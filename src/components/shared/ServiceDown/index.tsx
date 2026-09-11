/* ── ServiceDown ── the screen for "we could not reach the service".
   -----------------------------------------------------------------------------
   The panel's session is what builds the sidebar, so when it cannot be resolved
   there is no shell to render a banner inside — this is that case, and it is the
   one place a full-page state is right.

   It says nothing about the backend. Not the host, not the status code: an
   operator reads that from the server, and an admin reading this screen can do
   exactly one thing about it, which is the button. */
import { Link } from "react-router-dom";
import { Button, EmptyState } from "@/admin/ui";
import { clearSession } from "@/admin/auth/session";

export default function ServiceDown({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex min-h-dvh items-center justify-center bg-secondary p-6">
      <div className="w-full max-w-md">
        <EmptyState
          icon="alert"
          title="Something went wrong"
          body="We couldn’t reach the service just now. Your sign-in is untouched — this is on our side. Try again in a moment."
          action={
            <div className="flex flex-col items-center gap-3">
              <Button color="primary" onClick={onRetry}>
                Try again
              </Button>
              {/* The way out. Without it a stale token plus a down service is a
                  screen with no exit but the address bar. */}
              <Link className="text-sm font-semibold text-tertiary hover:text-secondary" to="/login?bye=1" onClick={() => clearSession()}>
                Sign out
              </Link>
            </div>
          }
        />
      </div>
    </div>
  );
}
