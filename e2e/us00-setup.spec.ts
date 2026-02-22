import { test, expect } from "@playwright/test";

test.describe("US-00 — Setup initial", () => {
  test("landing page loads with title and CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("OP SpellTable");
    await expect(page.getByRole("link", { name: /jouer/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /cartes/i })).toBeVisible();
  });

  test("landing page CTA links point to correct routes", async ({ page }) => {
    await page.goto("/");
    const playLink = page.getByRole("link", { name: /jouer/i });
    await expect(playLink).toHaveAttribute("href", "/lobby");
    const cardsLink = page.getByRole("link", { name: /cartes/i });
    await expect(cardsLink).toHaveAttribute("href", "/cards");
  });

  test("navbar is present on all pages", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("nav")).toBeVisible();
  });
});
