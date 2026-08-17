import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/lib/**", "src/app/api/**", "src/store/**"],
      // mock-data.ts is legacy data slated for removal once real queries
      // replace it everywhere (tracked in the project's own PLAN.md/TODO.md)
      // — not worth covering before it's deleted.
      exclude: ["src/lib/mock-data.ts"],
    },
  },
});
