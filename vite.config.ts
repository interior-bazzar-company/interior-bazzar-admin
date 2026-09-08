import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    /* `@/` is Untitled UI's import root — every component under
       src/components/{base,application,…} is written against it. */
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    port: 3000,
  },
});
