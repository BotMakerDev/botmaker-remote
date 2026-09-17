// vitest/config re-exports Vite's defineConfig with the `test` block typed; the build behaviour below
// is unaffected.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

// The app's own version, injected as a build-time constant so the auto-updater can compare it against the
// latest GitHub release tag. Keep web/package.json "version" in step with the APK release tags.
const appVersion = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8")).version;

// Relative base so the built assets resolve both when served by Studio at "/" and when loaded from
// file:// inside the Capacitor Android wrapper.
export default defineConfig({
  base: "./",
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  // Tests live next to the code they cover (`*.test.ts`), and run in jsdom because the three things
  // worth testing here all touch the browser: pointer geometry, localStorage and the location the app
  // was served from. `define` above applies to them too, so APP_VERSION is the real build constant.
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
