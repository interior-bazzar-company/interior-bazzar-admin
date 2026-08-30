/* Bundles scripts/fn-smoke.tsx for node. The esbuild API rather than the CLI,
   because it needs a resolve plugin: the real ShellContext portals into
   document.body and there is no jsdom here, so it is swapped for the same
   no-op stub the Users smoke uses. */
const path = require("path");
const esbuild = require("esbuild");

esbuild.build({
  entryPoints: [path.join(__dirname, "fn-smoke.tsx")],
  bundle: true, platform: "node", format: "cjs", jsx: "automatic",
  loader: { ".css": "empty", ".png": "empty" },
  define: { "import.meta.env": '{"DEV":false}' },
  logLevel: "error",
  outfile: path.join(__dirname, "..", "node_modules", ".tmp", "fn-smoke.cjs"),
  plugins: [{
    name: "stub-shell-context",
    setup(build) {
      build.onResolve({ filter: /ShellContext$/ }, () => ({ path: path.join(__dirname, "um-smoke-shell-stub.tsx") }));
    },
  }],
}).catch(() => process.exit(1));
