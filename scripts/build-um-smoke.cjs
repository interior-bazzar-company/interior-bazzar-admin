/* Bundles the render smoke test, swapping ShellContext for a stub. */
const esbuild = require("esbuild");
const path = require("path");

esbuild.build({
  entryPoints: [path.join(__dirname, "um-smoke.tsx")],
  bundle: true, platform: "node", format: "cjs", jsx: "automatic",
  loader: { ".css": "empty", ".png": "empty" },
  define: { "import.meta.env": '{"DEV":false}' },
  logLevel: "error",
  outfile: path.join(__dirname, "..", "node_modules", ".tmp", "um-smoke.cjs"),
  plugins: [{
    name: "stub-shell-context",
    setup(build) {
      build.onResolve({ filter: /ShellContext$/ }, () =>
        ({ path: path.join(__dirname, "um-smoke-shell-stub.tsx") }));
    },
  }],
}).catch(() => process.exit(1));
