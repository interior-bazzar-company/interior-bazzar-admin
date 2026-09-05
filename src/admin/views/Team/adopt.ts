/* =============================================================================
   Team — the roster adoption trigger.
   -----------------------------------------------------------------------------
   THE SEED WEARS THE LIVE ROSTER'S FACES. store.ts owns the pure re-key
   (adoptRoster); this file owns WHEN it runs and WHERE the people come from,
   so the store stays free of fetching and the check suite can call the re-key
   with any list it likes.

   It runs once per page load, from whichever Team face mounts first. The
   signed-in user is always the first person — they take the senior slot the
   demo is written around — followed by everyone `GET /admin/users/` returns.
   A failed fetch changes nothing: the seed's own eight keep the module
   walkable offline, which is what a demo fixture is for.
   ============================================================================= */
import AdminOpsService from "../../../api/modules/adminOps";
import { getSession } from "../../auth/session";
import { adoptRoster } from "./store";
import type { LivePerson } from "./store";

let state: "idle" | "running" | "done" = "idle";

/** Adopt a roster already in hand (`#/team` fetched it for its own table). */
export function adoptPeople(rows: { id: number; name: string; email?: string; phone?: string; username?: string; isSuperAdmin?: boolean }[]): void {
  if (state === "done") return;
  state = "done";
  const s = getSession();
  const people: LivePerson[] = [];
  if (s?.user?.id != null) {
    people.push({ id: s.user.id, name: s.user.name || s.user.username || "Me", email: s.user.email, username: s.user.username, isSuperAdmin: s.isFullAccess });
  }
  rows.forEach((u) => {
    if (people.some((p) => String(p.id) === String(u.id))) return;
    people.push({ id: u.id, name: u.name, email: u.email, phone: u.phone, username: u.username, isSuperAdmin: u.isSuperAdmin });
  });
  adoptRoster(people);
}

/** Fetch-and-adopt, for the faces that do not load the user list themselves. */
export function ensureAdopted(): void {
  if (state !== "idle") return;
  state = "running";
  /* THE SEED IS THE FALLBACK, SO NOTHING HERE MAY TAKE THE PAGE DOWN WITH IT.
     `users()` can throw SYNCHRONOUSLY — no token, a bad base URL, an
     interceptor that raises before a promise exists — and an exception out of
     this function leaves the effect that called it, unmounts the module, and
     leaves a blank pane under a perfectly intact topbar. Every face renders
     from the seed without a roster; wearing the live one is an improvement on
     that, never a precondition for it. */
  try {
    AdminOpsService.users()
      .then((r) => {
        state = "idle";
        try { adoptPeople(r.data || []); } catch { /* the seed keeps its own ids */ }
      })
      .catch(() => { state = "idle"; });
  } catch {
    state = "idle";
  }
}
