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
      /* The Plans catalogue stub went with the assignment dialog: the module
         holds no membership, so nothing in it reads a plan and there is no
         second service left to stand in for. */
    },
  }],
}).catch(() => process.exit(1));
