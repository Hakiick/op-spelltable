import { test, expect } from "@playwright/test";

test.describe("US-05/06 — GameBoard & Compteurs", () => {
  let roomId: string;

  test.beforeAll(async () => {
    // Create a room via API so we have a valid game page to visit
    const res = await fetch("http://localhost:3000/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "GameBoard E2E Test", isPublic: false }),
    });
    const json = await res.json();
    roomId = json.id;
  });

  test("game page loads with board layout", async ({ page }) => {
    await page.goto(`/game/${roomId}`);
    await expect(page.locator("[data-testid='game-board']")).toBeVisible();
  });

  test("displays turn phase indicator", async ({ page }) => {
    await page.goto(`/game/${roomId}`);
    // Phase indicator shows all phase labels: Refresh, Draw, DON!!, Main, End
    await expect(page.locator("[data-testid='turn-phase-indicator']")).toBeVisible();
    // At least the "Main" phase should be visible (default phase)
    await expect(page.locator("text=Main").first()).toBeVisible();
  });

  test("displays opponent and local player areas", async ({ page }) => {
    await page.goto(`/game/${roomId}`);
    const board = page.locator("[data-testid='game-board']");
    await expect(board).toBeVisible();
    // Both player areas should be visible
    await expect(page.locator("[data-testid='opponent-area']")).toBeVisible();
    await expect(page.locator("[data-testid='local-area']")).toBeVisible();
  });

  test("DON counter is visible", async ({ page }) => {
    await page.goto(`/game/${roomId}`);
    // DON!! zone label should be visible in at least one player area
    await expect(page.locator("text=DON!!").first()).toBeVisible();
  });

  test("life tracker is visible", async ({ page }) => {
    await page.goto(`/game/${roomId}`);
    // Life zone label should be visible
    await expect(page.locator("text=Life").first()).toBeVisible();
  });

  test("card zones are present (Leader, Characters, Stage)", async ({ page }) => {
    await page.goto(`/game/${roomId}`);
    await expect(page.locator("text=Leader").first()).toBeVisible();
    await expect(page.locator("text=Characters").first()).toBeVisible();
    await expect(page.locator("text=Stage").first()).toBeVisible();
  });
});
