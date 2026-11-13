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
      include: [
        "src/lib/**",
        "src/app/api/**",
        "src/store/**",
        "src/hooks/**",
        "src/components/ui/**",
        "src/middleware.ts",
      ],
      // Dev-only fixtures and generated types: not production logic.
      exclude: [
        "src/lib/mock-data.ts",
        "src/lib/supabase/database.types.ts",
        "**/*.test.{ts,tsx}",
      ],
    },
  },
});
