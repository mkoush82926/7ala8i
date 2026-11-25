#!/usr/bin/env node
/**
 * Design review screenshots.
 *
 * Captures full-page PNGs of the main routes in en and ar at a phone width
 * (375x812) and a desktop width (1280x800). It does NOT start a server: run the
 * app first (mock mode recommended, it has realistic data and a fake
 * shop_admin session), then point this script at it.
 *
 *   NEXT_PUBLIC_USE_MOCK_DATA=true NEXT_PUBLIC_MOCK_AUTH_ROLE=shop_admin \
 *   NEXT_PUBLIC_ALLOW_MOCK_IN_PROD=true npm run build
 *   npx next start -p 3100 &
 *   node scripts/design-shots.mjs            # or BASE_URL=http://127.0.0.1:3100
 *
 * The customer portal needs a customer session, and NEXT_PUBLIC_* flags are
 * inlined at build time, so it is a second pass on a second build:
 *
 *   NEXT_PUBLIC_USE_MOCK_DATA=true NEXT_PUBLIC_MOCK_AUTH_ROLE=customer \
 *   NEXT_PUBLIC_ALLOW_MOCK_IN_PROD=true npm run build
 *   npx next start -p 3100 &
 *   PASS=customer node scripts/design-shots.mjs
 *
 * Output: design-shots/<route>-<locale>-<width>.png (git-ignored).
 * Every page is also checked for horizontal overflow (page wider than the
 * viewport, e.g. a control pushed outside its card at 375px); offenders are
 * listed at the end and fail the run.
 * Options (env): BASE_URL, OUT_DIR, ROUTES (comma-separated), LOCALES, SHOP_ID,
 * COLOR_SCHEME (light | dark), PASS (staff | customer).
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = (process.env.BASE_URL || "http://127.0.0.1:3100").replace(/\/$/, "");
const OUT_DIR = process.env.OUT_DIR || path.join(root, "design-shots");
const SHOP_ID = process.env.SHOP_ID || "11111111-1111-1111-1111-111111111111";
const LOCALES = (process.env.LOCALES || "en,ar").split(",").map((s) => s.trim()).filter(Boolean);
const COLOR_SCHEME = process.env.COLOR_SCHEME === "dark" ? "dark" : "light";

const PASS = process.env.PASS === "customer" ? "customer" : "staff";

// Staff pass (shop_admin session). /customer is not here: the middleware
// sends staff away from it, so it would capture the dashboard instead.
const STAFF_ROUTES = [
  "/landing",
  "/explore",
  `/shop/${SHOP_ID}`,
  `/book/${SHOP_ID}`,
  "/auth/login",
  "/for-business",
  "/start",
  "/",
  "/calendar",
  "/queue",
  "/clients",
  "/services",
  "/team",
  "/analytics",
  "/settings",
];
// Customer pass (customer session): the portal (§6.9).
// (/customer/bookings and /customer/profile redirect to these two.)
const CUSTOMER_ROUTES = ["/customer", "/customer/account"];

const DEFAULT_ROUTES = PASS === "customer" ? CUSTOMER_ROUTES : STAFF_ROUTES;
const ROUTES = process.env.ROUTES ? process.env.ROUTES.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_ROUTES;

const VIEWPORTS = [
  { width: 375, height: 812, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { width: 1280, height: 800, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
];

/** "/" -> "dashboard", "/shop/<id>" -> "shop", "/auth/login" -> "auth-login". */
function slugFor(route) {
  if (route === "/" || route === "") return "dashboard";
  const parts = route.replace(/^\/+|\/+$/g, "").split("/");
  if ((parts[0] === "shop" || parts[0] === "book") && parts.length > 1) return parts[0];
  return parts.join("-").replace(/[^a-z0-9-]/gi, "_");
}

async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  // Trigger lazy images and in-view reveals, then return to the top.
  await page
    .evaluate(async () => {
      const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    })
    .catch(() => {});
  await page.waitForTimeout(400);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const written = [];
  const failed = [];
  const overflowed = [];
  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.deviceScaleFactor,
        isMobile: vp.isMobile,
        hasTouch: vp.hasTouch,
        colorScheme: COLOR_SCHEME,
        reducedMotion: "reduce",
      });
      for (const locale of LOCALES) {
        for (const route of ROUTES) {
          const url = `${BASE_URL}/${locale}${route === "/" ? "" : route}`;
          const file = path.join(OUT_DIR, `${slugFor(route)}-${locale}-${vp.width}.png`);
          const page = await context.newPage();
          try {
            const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
            await settle(page);
            const overflow = await page
              .evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
              .catch(() => 0);
            if (overflow > 1) overflowed.push(`${url} @${vp.width}px (+${overflow}px)`);
            await page.screenshot({ path: file, fullPage: true, animations: "disabled", caret: "hide" });
            const finalPath = new URL(page.url()).pathname;
            written.push(file);
            console.log(`ok   ${res?.status() ?? "-"} ${url}${finalPath !== new URL(url).pathname ? ` -> ${finalPath}` : ""}`);
          } catch (err) {
            failed.push(url);
            console.error(`fail ${url}: ${err instanceof Error ? err.message.split("\n")[0] : err}`);
          } finally {
            await page.close();
          }
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`\n${written.length} screenshots in ${OUT_DIR}${failed.length ? `, ${failed.length} failed` : ""}`);
  if (overflowed.length) {
    console.error(`\nHorizontal overflow (page wider than the viewport):\n  ${overflowed.join("\n  ")}`);
  }
  if (failed.length || overflowed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
