import { defineConfig } from "vite";

// Relative asset paths so the build is servable from any subpath
// (e.g. apps.charliekrug.com/waveform-forge), not just the domain root.
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    target: "esnext",
  },
  optimizeDeps: {
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
});
