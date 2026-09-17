/* Stands in for admin/auth/session during the Team nav check.

   modules.ts reads four things from that file: getSession(), can() (for
   homeRoute), HIDDEN_MODULES and PROTO_MODULES. The first two need standing in — there is no backend
   here and `session` is a module-level singleton with no setter, so the check
   injects one. The two Sets are re-exported from the REAL file, because they
   are half of what is being tested: a stub that carried its own copy would
   pass while the shipped set said something else.

   The explicit `.ts` extension is load-bearing: the bundler swaps imports
   matching /auth\/session$/, and this one does not match. */
import { EDIT_MEANS, HIDDEN_MODULES, PROTO_MODULES } from "../src/admin/auth/session.ts";

export { HIDDEN_MODULES, PROTO_MODULES };

export type FakeModule = {
  key: string;
  label: string;
  groupLabel: string;
  displayOrder: number;
  actions: string[];
};

let fake: { modules: FakeModule[]; isFullAccess?: boolean } | null = null;

export const __setSession = (s: { modules: FakeModule[]; isFullAccess?: boolean } | null) => { fake = s; };
export const getSession = () => fake;
/* The real can()'s rule over the injected session — the real one reads a
   singleton this check cannot set. Keep in step with auth/session.ts can(). */
export function can(moduleKey: string, action?: string): boolean {
  if (!fake) return false;
  if (PROTO_MODULES.has(moduleKey)) return true;
  if (fake.isFullAccess) return true;
  const held = fake.modules.find((m) => m.key === moduleKey)?.actions || [];
  if (held.indexOf("view") < 0) return false;
  const want = action || "view";
  return ((want === "edit" && EDIT_MEANS[moduleKey]) || [want]).some((v) => held.indexOf(v) >= 0);
}
