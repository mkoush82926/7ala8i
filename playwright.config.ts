import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
  // Visual regression defaults (see e2e/fixtures.ts → snapshot()).
  snapshotPathTemplate: "{testDir}/__snapshots__/{testFilePath}/{arg}-{projectName}{ext}",
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled", caret: "hide", scale: "css" },
  },
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Mobile-first checks at 375px for specs tagged @mobile (en + ar).
    {
      name: "mobile",
      grep: /@mobile/,
      use: { ...devices["Pixel 5"], viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true },
    },
  ],
  // Runs a real production build (`next build && next start`). Mock preview
  // mode is refused in production builds (src/lib/env.ts), so E2E always
  // talks to the local Supabase stack started with `npm run db:start`.
  webServer: {
    command: "npm run build && npm run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000",
      NEXT_PUBLIC_USE_MOCK_DATA: "",
      NEXT_PUBLIC_MOCK_AUTH_ROLE: "",
    },
  },
});
