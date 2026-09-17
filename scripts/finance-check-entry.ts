/* =============================================================================
   The bundle `check:finance` runs against.

   WHY AN ENTRY FILE RATHER THAN BUNDLING store.ts DIRECTLY. The payroll-year
   derivations live in their own module and read the store through its public
   readers, so a check that wants both has to get both from ONE bundle —
   esbuild-ing them separately would give each its own copy of the snapshot,
   and `resetStore()` in one would leave the other looking at stale records.
   That failure would not throw; it would quietly make half the assertions
   test a store nobody had reset.

   Two `export *` and nothing else. If a name ever collides between the two
   modules, esbuild says so at build time, which is the right moment to find
   out that two files are claiming one export.
   ============================================================================= */
export * from "../src/admin/views/Finance/store";
export * from "../src/admin/views/Finance/payrollYear";
/* The plan-payment cash rule every money figure shares. */
export { planCashPaise, settledRefundPayments } from "../src/admin/views/Overview/live";

/* The one service every read goes through, EXPORTED so the suite can answer
   it with fixture rows instead of a server — the same module instance the
   store calls, which is what makes the stub reach it. */
export { default as AdminOpsService } from "../src/api/modules/adminOps";
/* ...and the upload leg, for the same reason: a payslip receipt goes straight
   to storage with a presigned PUT, and the suite answers that instead of S3. */
export { CommonService } from "../src/api/modules/common";
