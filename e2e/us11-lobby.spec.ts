import { test, expect } from "@playwright/test";

test.describe("US-11 — Lobby & Matchmaking", () => {
  test.describe("Lobby Page", () => {
    test("lobby page loads with all sections", async ({ page }) => {
      await page.goto("/lobby");
      await expect(page.locator("h1")).toContainText("Lobby");
      await expect(page.getByRole("heading", { name: /créer une partie/i })).toBeVisible();
      await expect(page.getByRole("heading", { name: /rejoindre une partie/i })).toBeVisible();
      await expect(page.getByRole("heading", { name: /parties publiques/i })).toBeVisible();
    });

    test("refresh button is present", async ({ page }) => {
      await page.goto("/lobby");
      await expect(
        page.getByRole("button", { name: /actualiser/i })
      ).toBeVisible();
    });
  });

  test.describe("Create Room Form", () => {
    test("create room form has name input and public toggle", async ({ page }) => {
      await page.goto("/lobby");
      await expect(page.getByLabel(/nom de la partie/i)).toBeVisible();
      await expect(page.getByLabel(/partie publique/i)).toBeVisible();
      await expect(
        page.getByRole("button", { name: /créer une partie/i })
      ).toBeVisible();
    });

    test("creating a room redirects to /room/[code]", async ({ page }) => {
      await page.goto("/lobby");
      await page.getByLabel(/nom de la partie/i).fill("Test E2E Room");
      await page.getByRole("button", { name: /créer une partie/i }).click();
      await page.waitForURL(/\/room\//, { timeout: 10000 });
      expect(page.url()).toMatch(/\/room\/[A-Z0-9]+/i);
    });
  });

  test.describe("Join Room Form", () => {
    test("join form has code input", async ({ page }) => {
      await page.goto("/lobby");
      await expect(page.getByLabel(/code de la partie/i)).toBeVisible();
      // The "Rejoindre" button in the join form (not the ones in the public rooms list)
      await expect(
        page.getByRole("button", { name: "Rejoindre", exact: true })
      ).toBeVisible();
    });

    test("join button is disabled when code is empty", async ({ page }) => {
      await page.goto("/lobby");
      const joinBtn = page.getByRole("button", { name: "Rejoindre", exact: true });
      await expect(joinBtn).toBeDisabled();
    });

    test("entering a code enables join button", async ({ page }) => {
      await page.goto("/lobby");
      await page.getByLabel(/code de la partie/i).fill("ABC123");
      const joinBtn = page.getByRole("button", { name: "Rejoindre", exact: true });
      await expect(joinBtn).toBeEnabled();
    });

    test("joining navigates to room page", async ({ page }) => {
      await page.goto("/lobby");
      await page.getByLabel(/code de la partie/i).fill("TESTCD");
      await page.getByRole("button", { name: "Rejoindre", exact: true }).click();
      await page.waitForURL(/\/room\/TESTCD/i, { timeout: 5000 });
    });

    test("code input only accepts uppercase alphanumeric", async ({ page }) => {
      await page.goto("/lobby");
      const input = page.getByLabel(/code de la partie/i);
      await input.fill("abc123");
      const value = await input.inputValue();
      expect(value).toBe("ABC123");
    });

    test("code input is limited to 6 characters", async ({ page }) => {
      await page.goto("/lobby");
      const input = page.getByLabel(/code de la partie/i);
      await input.fill("ABCDEFGHIJ");
      const value = await input.inputValue();
      expect(value.length).toBeLessThanOrEqual(6);
    });
  });

  test.describe("Lobby API", () => {
    test("GET /api/lobby returns rooms array", async ({ request }) => {
      const res = await request.get("/api/lobby");
      expect(res.status()).toBe(200);
      const json = await res.json();
      expect(json.rooms).toBeInstanceOf(Array);
    });

    test("POST /api/rooms creates a room", async ({ request }) => {
      const res = await request.post("/api/rooms", {
        data: { name: "E2E Room", isPublic: true },
      });
      expect(res.status()).toBe(201);
      const json = await res.json();
      expect(json.roomCode).toBeTruthy();
      expect(json.name).toBe("E2E Room");
      expect(json.isPublic).toBe(true);
    });

    test("public room appears in lobby list", async ({ request }) => {
      // Create a public room
      const createRes = await request.post("/api/rooms", {
        data: { name: "Lobby Visible Room", isPublic: true },
      });
      const { roomCode } = await createRes.json();

      // Check it appears in lobby
      const lobbyRes = await request.get("/api/lobby");
      const { rooms } = await lobbyRes.json();
      const found = rooms.find(
        (r: { roomCode: string }) => r.roomCode === roomCode
      );
      expect(found).toBeTruthy();
      expect(found.name).toBe("Lobby Visible Room");
    });

    test("private room does NOT appear in lobby list", async ({ request }) => {
      // Create a private room
      const createRes = await request.post("/api/rooms", {
        data: { name: "Private Room", isPublic: false },
      });
      const { roomCode } = await createRes.json();

      // Check it does NOT appear in lobby
      const lobbyRes = await request.get("/api/lobby");
      const { rooms } = await lobbyRes.json();
      const found = rooms.find(
        (r: { roomCode: string }) => r.roomCode === roomCode
      );
      expect(found).toBeUndefined();
    });

    test("GET /api/rooms/[code] returns room details", async ({ request }) => {
      const createRes = await request.post("/api/rooms", {
        data: { name: "Detail Room" },
      });
      const { roomCode } = await createRes.json();

      const res = await request.get(`/api/rooms/${roomCode}`);
      expect(res.status()).toBe(200);
      const json = await res.json();
      expect(json.roomCode).toBe(roomCode);
      expect(json.status).toBe("waiting");
    });

    test("PATCH /api/rooms/[code] updates room", async ({ request }) => {
      const createRes = await request.post("/api/rooms", {
        data: { name: "Patchable Room" },
      });
      const { roomCode } = await createRes.json();

      const patchRes = await request.patch(`/api/rooms/${roomCode}`, {
        data: { hostPeerId: "peer-123" },
      });
      expect(patchRes.status()).toBe(200);
      const json = await patchRes.json();
      expect(json.hostPeerId).toBe("peer-123");
    });
  });

  test.describe("Public rooms display", () => {
    test("public rooms show in lobby UI after creation", async ({ page, request }) => {
      const roomName = `UI Room ${Date.now()}`;
      await request.post("/api/rooms", {
        data: { name: roomName, isPublic: true },
      });

      await page.goto("/lobby");
      // Wait for the lobby to fetch and display rooms
      await page.waitForTimeout(2000);
      // The room should appear in the list
      await expect(page.locator(`text=${roomName}`)).toBeVisible({ timeout: 10000 });
    });
  });
});
