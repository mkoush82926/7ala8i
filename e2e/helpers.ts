import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

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
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('button[type="submit"]').click();
}

/**
 * Drives the public booking wizard (`/book/[shop_id]`) from the landing
 * step through to the success screen. Assumes the caller is already
 * logged in as a customer (the booking API requires an authenticated
 * user — see src/app/api/booking/route.ts).
 */
export async function completeBooking(page: Page, shopId: string, serviceName: string) {
  await page.goto(`/en/book/${shopId}`);
  await page.getByRole("button", { name: "Book Appointment" }).click();

  await page.getByRole("button", { name: new RegExp(serviceName) }).click();
  await page.getByRole("button", { name: "Next", exact: false }).click();

  await page.getByRole("button", { name: "Any Available Barber" }).click();

  await page
    .getByRole("button", { name: /\d{1,2}:\d{2}\s?(AM|PM)/i })
    .first()
    .click();
  await page.getByRole("button", { name: "Next", exact: false }).click();

  await page.getByPlaceholder("Your name").fill("E2E Customer");
  await page.getByPlaceholder("+962 ...").fill("+962791112222");
  await page.getByRole("button", { name: "Confirm Booking" }).click();
}
