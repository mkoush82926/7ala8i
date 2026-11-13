import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
// UI copy comes from the English dictionary so specs don't break when
// wording changes (they run against /en routes).
import en from "../src/i18n/en";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface SeedData {
  shopId: string;
  serviceName: string;
  owner: { email: string; password: string };
  customer: { id: string; email: string; password: string };
}

export function getSeed(): SeedData {
  const raw = fs.readFileSync(path.join(__dirname, ".seed-data.json"), "utf-8");
  return JSON.parse(raw);
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/en/auth/login");
  // Wait for hydration so React doesn't race the typed values.
  await page.waitForLoadState("networkidle");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('button[type="submit"]').click();
  // The sign-in server action must finish (and set the session cookie)
  // before callers navigate elsewhere, or the navigation aborts it.
  await page.waitForURL((url) => !url.pathname.includes("/auth/login"), { timeout: 15_000 });
}

/**
 * Drives the public booking wizard (`/book/[shop_id]`) from the landing
 * step through to the success screen. Assumes the caller is already
 * logged in as a customer (the booking API requires an authenticated
 * user — see src/app/api/booking/route.ts).
 */
export async function completeBooking(page: Page, shopId: string, serviceName: string) {
  await page.goto(`/en/book/${shopId}`);
  // Older builds showed a landing step first; the wizard now opens on services.
  const start = page.getByRole("button", { name: en.booking.bookAppointment }).first();
  if (await start.isVisible({ timeout: 1500 }).catch(() => false)) await start.click();

  await page.getByRole("button", { name: new RegExp(escapeRegExp(serviceName)) }).first().click();
  await page.getByRole("button", { name: en.common.next, exact: false }).click();

  // With a single barber the wizard pre-selects them and hides "Any barber".
  const anyBarber = page.getByRole("button", { name: new RegExp(escapeRegExp(en.booking.anyBarber)) });
  if (await anyBarber.isVisible({ timeout: 1500 }).catch(() => false)) await anyBarber.click();
  await page.getByRole("button", { name: en.common.next, exact: false }).click();

  await page
    .getByRole("button", { name: /\d{1,2}:\d{2}\s?(AM|PM)/i })
    .first()
    .click();
  await page.getByRole("button", { name: en.common.next, exact: false }).click();

  // Prefer the accessible label; fall back to the field type so a copy or
  // placeholder change in the wizard doesn't break the flow.
  await page
    .getByLabel(en.booking.yourName)
    .or(page.locator('input[type="text"]'))
    .first()
    .fill("E2E Customer");
  await page
    .getByLabel(en.booking.phoneNumber)
    .or(page.locator('input[type="tel"]'))
    .first()
    .fill("+962791112222");
  await page.getByRole("button", { name: en.booking.confirmBooking }).click();
}
