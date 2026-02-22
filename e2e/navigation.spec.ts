import { test, expect } from "@playwright/test";

test.describe("Navigation & Routing", () => {
  test("navbar has logo/brand link to home", async ({ page }) => {
    await page.goto("/cards");
    const brand = page.locator("nav").getByRole("link").first();
    await expect(brand).toBeVisible();
  });

  test("navbar has lobby link", async ({ page }) => {
    await page.goto("/");
    const lobbyLink = page.locator("nav").getByRole("link", { name: /lobby/i });
    await expect(lobbyLink).toBeVisible();
  });

  test("home page has cards CTA link", async ({ page }) => {
    await page.goto("/");
    const cardsLink = page.getByRole("link", { name: /cartes/i });
    await expect(cardsLink).toBeVisible();
  });

  test("navigating from home to lobby works", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /jouer/i }).click();
    await page.waitForURL("/lobby");
    await expect(page.locator("h1")).toContainText("Lobby");
  });

  test("navigating from home to cards works", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /cartes/i }).click();
    await page.waitForURL("/cards");
    await expect(page.locator("h1")).toContainText("Card Browser");
  });

  test("navigating from navbar to lobby", async ({ page }) => {
    await page.goto("/cards");
    await page.locator("nav").getByRole("link", { name: /lobby/i }).click();
    await page.waitForURL("/lobby");
    await expect(page.locator("h1")).toContainText("Lobby");
  });

  test("login page is accessible", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.locator("[data-slot='card-title']")).toContainText("Sign in");
  });

  test("register page is accessible", async ({ page }) => {
    await page.goto("/auth/register");
    await expect(page.locator("[data-slot='card-title']")).toContainText("Create account");
  });

  test("login and register pages link to each other", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByRole("link", { name: /register/i }).click();
    await page.waitForURL("/auth/register");
    await expect(page.locator("[data-slot='card-title']")).toContainText("Create account");

    await page.getByRole("link", { name: /sign in/i }).click();
    await page.waitForURL("/auth/login");
    await expect(page.locator("[data-slot='card-title']")).toContainText("Sign in");
  });
});
