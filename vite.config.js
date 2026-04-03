import { defineConfig } from "vite";

export default defineConfig({
  base: "./",

  build: {
    outDir: "dist",
    emptyOutDir: true,
  },

  optimizeDeps: {
    exclude: ["@owlbear-rodeo/sdk"],
  },
});