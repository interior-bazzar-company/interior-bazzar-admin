import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

/* Tailwind compiles the utilities every component is written in; the `@/`
   alias is the import root the Untitled UI components use (and the panel's
   own code may). Both are load-bearing, not conveniences. */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        /* The library, the charts and React itself are stable across releases
           of the panel, so they ship as their own long-cached chunks. */
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom", "react-redux", "@reduxjs/toolkit"],
          aria: ["react-aria-components", "react-aria", "react-stately", "@internationalized/date"],
          charts: ["recharts"],
        },
      },
    },
  },
});
