import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const isDev = process.env.NODE_ENV === "development";

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    sourcemap: isDev ? "inline" : undefined,
    cssMinify: !isDev,
    minify: !isDev,
    rollupOptions: {
      input: "countdown-app.html",
    },
    outDir: "dist",
    emptyOutDir: false,
  },
});
