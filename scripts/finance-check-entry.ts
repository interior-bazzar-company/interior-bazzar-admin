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
