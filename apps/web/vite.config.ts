import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  envDir: "../../",
  resolve: {
    alias: {
      "@cbms/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
  ssr: { noExternal: ["maplibre-gl"] },
  plugins: [react()],
  optimizeDeps: {
    exclude: ["maplibre-gl", "@cbms/shared"],
  },
  server: {
    port: 5173,
    fs: {
      allow: ["../.."],
    },
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
