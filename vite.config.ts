import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/* NO TAILWIND PLUGIN, and no `@/` alias.
   Both existed for Untitled UI: the plugin compiled the utilities its
   components were written in, and the alias was the import root every one of
   them used. The library is gone, the panel's styling is two hand-authored
   stylesheets, and every import in src/ is relative — so both are removed
   rather than left in place "in case". A build step nothing needs is a build
   step that eventually breaks something. */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
});
