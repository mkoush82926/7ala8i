import { test, expect } from "@playwright/test";
import { login, getSeed } from "./helpers";

test.describe("login redirects by role", () => {
  test("a shop owner lands on the dashboard root", async ({ page }) => {
    const { owner } = getSeed();
    await login(page, owner.email, owner.password);

    await expect(page).toHaveURL(/\/en\/?$/);
  });

  test("a customer is redirected to the customer portal", async ({ page }) => {
    const { customer } = getSeed();
    await login(page, customer.email, customer.password);

    await expect(page).toHaveURL(/\/en\/customer/);
  });

  test("an unauthenticated visitor hitting a protected route is sent to login", async ({ page }) => {
    await page.goto("/en/calendar");
    await expect(page).toHaveURL(/\/en\/auth\/login/);
  });
});
