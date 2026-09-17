/* =============================================================================
   The two things a Team page says instead of its data (team/d5).
   -----------------------------------------------------------------------------
   A page whose read has not landed shows its shape, shimmering — never "no
   record yet", which is a claim about the person. A page whose read was
   REFUSED says it is not in your access; one whose read FAILED says so and
   offers the read again. Neither is ever drawn as an empty list.
   ============================================================================= */
import { Alert, Button, Skeleton } from "../../ui";
import type { LoadPart } from "./store";

/** An operation page waiting on its first read: heading, tiles, rows. */
export function OpSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5" w={180} />
        <Skeleton w={360} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      <div className="flex flex-col divide-y divide-border-secondary rounded-xl bg-primary ring-1 ring-secondary">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-3 py-3">
            <Skeleton w="30%" />
            <Skeleton w="18%" />
            <span className="flex-1" />
            <Skeleton w={72} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Refused → "not in your access". Failed → the reason, and Try again. */
export function LoadNotice({ what, part, onRetry }: { what: string; part: LoadPart; onRetry: () => void }) {
  if (part.state === "denied") {
    return (
      <Alert tone="warn" ico="lock" title={what + " is not in your access"}>
        {part.message || "The server only lets you read your own."}
      </Alert>
    );
  }
  if (part.state !== "error") return null;
  return (
    <Alert tone="bad" title={what + " could not be loaded"}
      action={<Button color="secondary" size="xs" ico="refresh" onClick={onRetry}>Try again</Button>}>
      {part.message}
    </Alert>
  );
}
