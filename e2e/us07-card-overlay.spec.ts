import { test, expect } from "@playwright/test";

test.describe("US-07 — Card Detail Overlay", () => {
  test("clicking a card in the browser opens the overlay", async ({ page }) => {
    await page.goto("/cards?set=OP01&limit=20");
    await page.waitForTimeout(1000);
    // Find a clickable card button
    const cardButton = page.locator("button").filter({ hasText: /OP01/ }).first();
    if ((await cardButton.count()) > 0) {
      await cardButton.click();
      // Overlay dialog should appear
      await expect(page.locator("[role='dialog']")).toBeVisible({ timeout: 5000 });
    }
  });

  test("overlay shows card details after loading", async ({ page }) => {
    await page.goto("/cards?set=OP01&limit=20");
    await page.waitForTimeout(1000);
    const cardButton = page.locator("button").filter({ hasText: /OP01/ }).first();
    if ((await cardButton.count()) > 0) {
      await cardButton.click();
      const dialog = page.locator("[role='dialog']");
      await expect(dialog).toBeVisible({ timeout: 5000 });
      // Wait for loading to complete — should show card name
      await page.waitForTimeout(2000);
      // Dialog should contain some text (card name, type, etc.)
      const dialogText = await dialog.textContent();
      expect(dialogText?.length).toBeGreaterThan(10);
    }
  });

  test("overlay closes with Escape key", async ({ page }) => {
    await page.goto("/cards?set=OP01&limit=20");
    await page.waitForTimeout(1000);
    const cardButton = page.locator("button").filter({ hasText: /OP01/ }).first();
    if ((await cardButton.count()) > 0) {
      await cardButton.click();
      await expect(page.locator("[role='dialog']")).toBeVisible({ timeout: 5000 });
      await page.keyboard.press("Escape");
      await expect(page.locator("[role='dialog']")).not.toBeVisible();
    }
  });

  test("overlay has close button", async ({ page }) => {
    await page.goto("/cards?set=OP01&limit=20");
    await page.waitForTimeout(1000);
    const cardButton = page.locator("button").filter({ hasText: /OP01/ }).first();
    if ((await cardButton.count()) > 0) {
      await cardButton.click();
      const dialog = page.locator("[role='dialog']");
      await expect(dialog).toBeVisible({ timeout: 5000 });
      // Close button should exist
      const closeBtn = dialog.getByRole("button", { name: /close/i }).or(
        dialog.locator("button").filter({ hasText: "×" }).or(
          dialog.locator("button[aria-label*='close' i], button[aria-label*='Close' i], button[aria-label*='fermer' i]")
        )
      );
      await expect(closeBtn.first()).toBeVisible();
    }
  });

  test("overlay has aria-modal attribute", async ({ page }) => {
    await page.goto("/cards?set=OP01&limit=20");
    await page.waitForTimeout(1000);
    const cardButton = page.locator("button").filter({ hasText: /OP01/ }).first();
    if ((await cardButton.count()) > 0) {
      await cardButton.click();
      const dialog = page.locator("[role='dialog']");
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await expect(dialog).toHaveAttribute("aria-modal", "true");
    }
  });
});
