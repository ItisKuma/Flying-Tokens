import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  base: "./",
  plugins: [basicSsl()],

  server: {
    host: "localhost",
    https: true,
    cors: true,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  },

  resolve: {
    alias: {
      events: fileURLToPath(new URL("./src/vendor/events-shim.js", import.meta.url)),
    },
  },

  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        background: fileURLToPath(new URL("./background.html", import.meta.url)),
      },
    },
  },

  optimizeDeps: {
    exclude: ["@owlbear-rodeo/sdk"],
  },
});
