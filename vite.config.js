import { defineConfig } from "vite";

export default defineConfig({
  base: "./",

  resolve: {
    alias: {
      events: false
    }
  },

  optimizeDeps: {
    exclude: ["@owlbear-rodeo/sdk"]
  }
});