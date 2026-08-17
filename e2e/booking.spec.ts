import { test, expect } from "@playwright/test";
import { login, completeBooking, getSeed } from "./helpers";

test("a logged-in customer can complete a booking end to end", async ({ page }) => {
  const { shopId, serviceName, customer } = getSeed();

  await login(page, customer.email, customer.password);
  await completeBooking(page, shopId, serviceName);

  await expect(page.getByText(/booked|confirmed/i).first()).toBeVisible({ timeout: 15_000 });
});
