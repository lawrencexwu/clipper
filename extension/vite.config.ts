import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: path.resolve(__dirname, "src"),
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: false,
    sourcemap: false,
    rollupOptions: {
      input: {
        sidepanel: path.resolve(__dirname, "src/sidepanel.html"),
        options: path.resolve(__dirname, "src/options.html"),
      },
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
