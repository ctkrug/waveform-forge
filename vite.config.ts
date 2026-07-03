import { defineConfig } from "vitest/config";

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
  test: {
    coverage: {
      provider: "v8",
      // A floor well below the current ~99.8%, not a ceiling to chase —
      // catches an accidental regression (a reverted test file, a large
      // untested addition) without blocking normal day-to-day work.
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
});
