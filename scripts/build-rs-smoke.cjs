/* Bundles scripts/rs-smoke.tsx for node. Same shape as build-tm-smoke.cjs and
   for the same reason: the real ShellContext portals into document.body and
   there is no jsdom here, so it resolves to the shared no-op stub. */
const path = require("path");
const esbuild = require("esbuild");

esbuild.build({
  entryPoints: [path.join(__dirname, "rs-smoke.tsx")],
  bundle: true, platform: "node", format: "cjs", jsx: "automatic",
  loader: { ".css": "empty", ".png": "empty" },
  define: { "import.meta.env": '{"DEV":false}' },
  logLevel: "error",
  outfile: path.join(__dirname, "..", "node_modules", ".tmp", "rs-smoke.cjs"),
  plugins: [{
    name: "stub-shell-context",
    setup(build) {
      build.onResolve({ filter: /ShellContext$/ }, () => ({ path: path.join(__dirname, "um-smoke-shell-stub.tsx") }));
    },
  }],
}).catch(() => process.exit(1));
