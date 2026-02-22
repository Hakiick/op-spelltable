import { test, expect } from "@playwright/test";

const TEST_USER = {
  name: `E2E User ${Date.now()}`,
  email: `e2e-${Date.now()}@test.com`,
  password: "TestPassword123!",
};

test.describe("US-10 — Auth & Profils", () => {
  test.describe("Registration", () => {
    test("register page loads with form", async ({ page }) => {
      await page.goto("/auth/register");
      await expect(page.locator("[data-slot='card-title']")).toContainText("Create account");
      await expect(page.getByRole("textbox", { name: /display name/i })).toBeVisible();
      await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
      await expect(page.getByRole("textbox", { name: /^password$/i })).toBeVisible();
      await expect(page.getByRole("textbox", { name: /confirm password/i })).toBeVisible();
    });

    test("shows validation errors for empty form", async ({ page }) => {
      await page.goto("/auth/register");
      await page.getByRole("button", { name: /create account/i }).click();
      await expect(page.locator("text=Name is required")).toBeVisible();
      await expect(page.locator("text=Email is required")).toBeVisible();
      await expect(page.locator("text=Password is required")).toBeVisible();
    });

    test("shows error for short password", async ({ page }) => {
      await page.goto("/auth/register");
      await page.locator("#name").fill("Test");
      await page.locator("#email").fill("test@example.com");
      await page.locator("#password").fill("short");
      await page.locator("#confirmPassword").fill("short");
      await page.getByRole("button", { name: /create account/i }).click();
      await expect(page.locator("text=at least 8 characters")).toBeVisible();
    });

    test("shows error for password mismatch", async ({ page }) => {
      await page.goto("/auth/register");
      await page.locator("#name").fill("Test");
      await page.locator("#email").fill("test@example.com");
      await page.locator("#password").fill("Password123!");
      await page.locator("#confirmPassword").fill("DifferentPass!");
      await page.getByRole("button", { name: /create account/i }).click();
      await expect(page.locator("text=do not match")).toBeVisible();
    });

    test("shows error for invalid email", async ({ page }) => {
      await page.goto("/auth/register");
      await page.locator("#name").fill("Test");
      await page.locator("#email").fill("not-an-email");
      await page.locator("#password").fill("Password123!");
      await page.locator("#confirmPassword").fill("Password123!");
      await page.getByRole("button", { name: /create account/i }).click();
      await expect(page.locator("text=valid email")).toBeVisible();
    });

    test("successful registration creates account and redirects", async ({ page }) => {
      await page.goto("/auth/register");
      await page.locator("#name").fill(TEST_USER.name);
      await page.locator("#email").fill(TEST_USER.email);
      await page.locator("#password").fill(TEST_USER.password);
      await page.locator("#confirmPassword").fill(TEST_USER.password);
      await page.getByRole("button", { name: /create account/i }).click();
      // Should redirect to home after successful registration + auto sign-in
      await page.waitForURL("/", { timeout: 10000 });
      await expect(page.locator("h1")).toContainText("OP SpellTable");
    });

    test("register page has link to login", async ({ page }) => {
      await page.goto("/auth/register");
      const loginLink = page.getByRole("link", { name: /sign in/i });
      await expect(loginLink).toBeVisible();
      await expect(loginLink).toHaveAttribute("href", "/auth/login");
    });
  });

  test.describe("Login", () => {
    test("login page loads with form", async ({ page }) => {
      await page.goto("/auth/login");
      await expect(page.locator("[data-slot='card-title']")).toContainText("Sign in");
      await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
      await expect(page.getByRole("textbox", { name: /password/i })).toBeVisible();
    });

    test("shows error for wrong credentials", async ({ page }) => {
      await page.goto("/auth/login");
      await page.locator("#email").fill("nonexistent@test.com");
      await page.locator("#password").fill("WrongPassword123");
      await page.getByRole("button", { name: /sign in/i }).click();
      await expect(page.locator("text=Invalid email or password")).toBeVisible({ timeout: 5000 });
    });

    test("login page has link to register", async ({ page }) => {
      await page.goto("/auth/login");
      const registerLink = page.getByRole("link", { name: /register/i });
      await expect(registerLink).toBeVisible();
      await expect(registerLink).toHaveAttribute("href", "/auth/register");
    });
  });

  test.describe("Registration API", () => {
    test("POST /api/auth/register creates user", async ({ request }) => {
      const email = `api-test-${Date.now()}@test.com`;
      const res = await request.post("/api/auth/register", {
        data: { name: "API Test", email, password: "Password123!" },
      });
      expect(res.status()).toBe(201);
      const json = await res.json();
      expect(json.name).toBe("API Test");
      expect(json.email).toBe(email);
      expect(json.id).toBeTruthy();
    });

    test("POST /api/auth/register rejects duplicate email", async ({ request }) => {
      const email = `dup-${Date.now()}@test.com`;
      // First registration
      await request.post("/api/auth/register", {
        data: { name: "First", email, password: "Password123!" },
      });
      // Duplicate
      const res = await request.post("/api/auth/register", {
        data: { name: "Second", email, password: "Password123!" },
      });
      expect(res.status()).toBe(409);
    });

    test("POST /api/auth/register rejects short password", async ({ request }) => {
      const res = await request.post("/api/auth/register", {
        data: { name: "Test", email: "short@test.com", password: "123" },
      });
      expect(res.status()).toBe(400);
    });

    test("POST /api/auth/register rejects missing name", async ({ request }) => {
      const res = await request.post("/api/auth/register", {
        data: { email: "noname@test.com", password: "Password123!" },
      });
      expect(res.status()).toBe(400);
    });
  });
});
