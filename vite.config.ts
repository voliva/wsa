import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        cli: resolve(__dirname, "src", "cli.ts"),
      },
      external: [
        "node:fs/promises",
        "node:fs",
        "readline",
        "@commander-js/extra-typings",
      ],
      output: {
        entryFileNames(info) {
          if (info.name === "cli") {
            return "cli.js";
          }
          return "assets/[name]-[hash].js";
        },
      },
    },
  },
});
