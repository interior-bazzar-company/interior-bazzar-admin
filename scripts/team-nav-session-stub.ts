/* Stands in for admin/auth/session during the Team nav check.

   modules.ts reads three things from that file: getSession(), HIDDEN_MODULES
   and PROTO_MODULES. Only the first needs standing in — there is no backend
   here and `session` is a module-level singleton with no setter, so the check
   injects one. The two Sets are re-exported from the REAL file, because they
   are half of what is being tested: a stub that carried its own copy would
   pass while the shipped set said something else.

   The explicit `.ts` extension is load-bearing: the bundler swaps imports
   matching /auth\/session$/, and this one does not match. */
import { HIDDEN_MODULES, PROTO_MODULES } from "../src/admin/auth/session.ts";

export { HIDDEN_MODULES, PROTO_MODULES };

export type FakeModule = {
  key: string;
  label: string;
  groupLabel: string;
  displayOrder: number;
  actions: string[];
};

let fake: { modules: FakeModule[] } | null = null;

export const __setSession = (s: { modules: FakeModule[] } | null) => { fake = s; };
export const getSession = () => fake;
