import { test, expect } from "@playwright/test";
import { login, completeBooking, getSeed } from "./helpers";

test("a completed booking appears in the customer's bookings list", async ({ page }) => {
  const { shopId, serviceName, customer } = getSeed();

  await login(page, customer.email, customer.password);
  await completeBooking(page, shopId, serviceName);

  await page.goto("/en/customer/bookings");
  await expect(page.getByText(new RegExp(serviceName))).toBeVisible({ timeout: 15_000 });
});
