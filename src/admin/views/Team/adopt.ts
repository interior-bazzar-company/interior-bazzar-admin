/* =============================================================================
   Team — the load trigger the faces already call.
   -----------------------------------------------------------------------------
   The store used to wear the live roster's faces over seed rows; it now reads
   the backend itself (store.ts bootTeam). These two names stay because the
   Work, Attendance, Reports and Overview faces call them on mount.
   ============================================================================= */
import { bootTeam } from "./store";

/** A roster already in hand needs nothing — the store reads its own. */
export const adoptPeople: (rows: unknown[]) => void = () => { void bootTeam(); };

export function ensureAdopted(): void { void bootTeam(); }
