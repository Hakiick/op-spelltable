import { test, expect } from "@playwright/test";

test.describe("US-01 — Cards API", () => {
  test("GET /api/cards returns paginated cards", async ({ request }) => {
    const res = await request.get("/api/cards?limit=5");
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data).toBeInstanceOf(Array);
    expect(json.data.length).toBeGreaterThan(0);
    expect(json.data.length).toBeLessThanOrEqual(5);
    expect(json.pagination).toBeDefined();
    expect(json.pagination.total).toBeGreaterThan(0);
  });

  test("GET /api/cards supports search filter", async ({ request }) => {
    const res = await request.get("/api/cards?search=Luffy&limit=10");
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBeGreaterThan(0);
    for (const card of json.data) {
      expect(card.name.toLowerCase()).toContain("luffy");
    }
  });

  test("GET /api/cards supports color filter", async ({ request }) => {
    const res = await request.get("/api/cards?color=Red&limit=10");
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBeGreaterThan(0);
    for (const card of json.data) {
      expect(card.color.toLowerCase()).toContain("red");
    }
  });

  test("GET /api/cards supports type filter", async ({ request }) => {
    const res = await request.get("/api/cards?type=Leader&limit=10");
    expect(res.status()).toBe(200);
    const json = await res.json();
    for (const card of json.data) {
      expect(card.type).toBe("Leader");
    }
  });

  test("GET /api/cards supports set filter", async ({ request }) => {
    const res = await request.get("/api/cards?set=OP01&limit=10");
    expect(res.status()).toBe(200);
    const json = await res.json();
    for (const card of json.data) {
      expect(card.cardId).toMatch(/^OP01-/);
    }
  });

  test("GET /api/sets returns card sets", async ({ request }) => {
    const res = await request.get("/api/sets");
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data).toBeInstanceOf(Array);
    expect(json.data.length).toBeGreaterThan(0);
    const codes = json.data.map((s: { code: string }) => s.code);
    expect(codes).toContain("OP01");
    expect(codes).toContain("ST01");
  });

  test("GET /api/cards/[code] returns a single card", async ({ request }) => {
    const res = await request.get("/api/cards/OP01-001");
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data.cardId).toBe("OP01-001");
    expect(json.data.name).toBeTruthy();
    expect(json.data.type).toBeTruthy();
    expect(json.data.color).toBeTruthy();
  });

  test("GET /api/cards/[code] returns 404 for unknown card", async ({ request }) => {
    const res = await request.get("/api/cards/FAKE-999");
    expect(res.status()).toBe(404);
  });
});
