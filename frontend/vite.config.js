import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  server: {
    host: true,
    // La app pide el backend por /api (src/services/apiBase.js) y Vite lo
    // reenvia a esta misma laptop: asi funciona desde cualquier computadora
    // de la red de la oficina abriendo solo el puerto 5173 (07/10/2026).
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true, rewrite: (p) => (p.startsWith("/api") ? p.slice(4) || "/" : p) },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
