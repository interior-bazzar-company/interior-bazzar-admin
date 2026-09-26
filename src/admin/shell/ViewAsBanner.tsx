/* Persistent while a "See as this member" session is active — separate from
   BannerDock's own `bannerState` (ShellContext), which auto-dismisses after
   6s and is meant for one-off notices. This one has to survive navigation
   for as long as the view-as target does, so it reads viewAs.ts directly. */
import { useSyncExternalStore } from "react";
import { Alert, Button } from "../ui";
import { clearViewAs, getViewAs, subscribeViewAs } from "../viewAs";

export function ViewAsBanner() {
  const target = useSyncExternalStore(subscribeViewAs, getViewAs, getViewAs);
  if (!target) return null;
  return (
    <div className="shrink-0 border-b border-secondary bg-primary px-4 py-2" id="view-as-banner">
      <Alert
        tone="warn"
        title={"Viewing as " + target.name + " — read-only"}
        action={<Button color="secondary" size="xs" onClick={() => clearViewAs()}>Exit</Button>}
      >
        Every write is refused while this is on. Exit to act as yourself again.
      </Alert>
    </div>
  );
}
