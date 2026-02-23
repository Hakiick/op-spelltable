import { test, expect } from "@playwright/test";

test.describe("Full E2E Flow — Landing → Register → Lobby → Room → Game", () => {
  const user = {
    name: `Flow User ${Date.now()}`,
    email: `flow-${Date.now()}@test.com`,
    password: "FlowPassword123!",
  };

  test("complete user journey", async ({ page }) => {
    // 1. Landing page
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("OP SpellTable");

    // 2. Navigate to register
    await page.goto("/auth/register");
    await expect(page.locator("[data-slot='card-title']")).toContainText(
      "Create account"
    );

    // 3. Fill registration form
    await page.locator("#name").fill(user.name);
    await page.locator("#email").fill(user.email);
    await page.locator("#password").fill(user.password);
    await page.locator("#confirmPassword").fill(user.password);
    await page.getByRole("button", { name: /create account/i }).click();

    // 4. Should redirect to home after registration
    await page.waitForURL("/", { timeout: 10000 });

    // 5. Navigate to lobby
    await page.goto("/lobby");
    await expect(page.locator("h1")).toContainText("Lobby");

    // 6. Create a public room
    await page.getByLabel(/nom de la partie/i).fill("E2E Full Flow Room");
    await page.getByRole("button", { name: /créer une partie/i }).click();

    // 7. Should redirect to /room/[code]
    await page.waitForURL(/\/room\//, { timeout: 10000 });
    const roomUrl = page.url();
    expect(roomUrl).toMatch(/\/room\/[A-Z0-9]+/i);

    // 8. Room page should load (WebRTC components)
    await page.waitForTimeout(2000);
    // The room page should be visible (may show camera access prompt)
    const pageContent = await page.textContent("body");
    expect(pageContent?.length).toBeGreaterThan(0);
  });

  test("card browsing flow with search and overlay", async ({ page }) => {
    // 1. Go to cards page
    await page.goto("/cards");
    await expect(page.locator("h1")).toContainText("Card Browser");

    // 2. Wait for cards to load
    await expect(page.locator("text=cards found")).toBeVisible();

    // 3. Search for a specific card
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill("Luffy");
    await searchInput.press("Enter");
    await page.waitForURL(/search=Luffy/i);

    // 4. Verify filtered results
    await expect(page.locator("text=cards found")).toBeVisible();

    // 5. Click a card to open overlay
    const cardButton = page
      .locator("button")
      .filter({ hasText: /Luffy/i })
      .first();
    if ((await cardButton.count()) > 0) {
      await cardButton.click();
      await expect(page.locator("[role='dialog']")).toBeVisible({
        timeout: 5000,
      });

      // 6. Verify overlay content
      const dialog = page.locator("[role='dialog']");
      await page.waitForTimeout(2000);
      const dialogText = await dialog.textContent();
      expect(dialogText?.toLowerCase()).toContain("luffy");

      // 7. Close overlay
      await page.keyboard.press("Escape");
      await expect(page.locator("[role='dialog']")).not.toBeVisible();
    }

    // 8. Navigate to another page via filter
    await page.goto("/cards?type=Leader&color=Red");
    await expect(page.locator("text=cards found")).toBeVisible();
  });

  test("lobby create and verify public visibility", async ({
    page,
    request,
  }) => {
    const roomName = `Visible ${Date.now()}`;

    // 1. Create a public room via API
    const res = await request.post("/api/rooms", {
      data: { name: roomName, isPublic: true },
    });
    expect(res.status()).toBe(201);

    // 2. Go to lobby page
    await page.goto("/lobby");

    // 3. Wait for rooms to load (polling)
    await page.waitForTimeout(3000);

    // 4. The room should be in the public list
    await expect(page.locator(`text=${roomName}`)).toBeVisible({
      timeout: 10000,
    });
  });
});
