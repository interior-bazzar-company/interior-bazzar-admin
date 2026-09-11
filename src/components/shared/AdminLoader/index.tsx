/* =============================================================================
   THE FULL-PAGE LOADER
   -----------------------------------------------------------------------------
   Shown by RequireSession while `me/permissions/` is in flight — the one screen
   with nothing else on it. One drawing, the library's, and it weighs nothing:
   the 350 KB Lottie character this used to fetch was a loading screen that had
   to be loaded, which is a joke at the user's expense. The brand mark above
   the ring says whose panel is coming.
   ========================================================================== */
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { BrandLogo } from "@/admin/ui/brand";

const AdminLoader = () => (
  <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-secondary p-6" role="status" aria-live="polite">
    <BrandLogo size={40} />
    <LoadingIndicator size="md" type="line-simple" />
    <span className="sr-only">Loading…</span>
  </div>
);

export default AdminLoader;
