import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/database/users", () => ({
  getUserByEmail: vi.fn(),
  createUser: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2b$12$hashedpassword"),
  },
  hash: vi.fn().mockResolvedValue("$2b$12$hashedpassword"),
}));

import { getUserByEmail, createUser } from "@/lib/database/users";
import { POST as registerHandler } from "@/app/api/auth/register/route";

const mockUser = {
  id: "usr001",
  name: "Monkey D. Luffy",
  email: "luffy@example.com",
  hashedPassword: "$2b$12$hashedpassword",
  avatarUrl: null,
  gamesPlayed: 0,
  gamesWon: 0,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/register", () => {
  it("registers a user and returns 201 with id, name, email", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(null);
    vi.mocked(createUser).mockResolvedValue(mockUser);

    const request = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Monkey D. Luffy",
        email: "luffy@example.com",
        password: "strongpassword123",
      }),
    });

    const response = await registerHandler(request);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json).toEqual({
      id: "usr001",
      name: "Monkey D. Luffy",
      email: "luffy@example.com",
    });
    expect(getUserByEmail).toHaveBeenCalledWith("luffy@example.com");
    expect(createUser).toHaveBeenCalledWith(
      "luffy@example.com",
      "Monkey D. Luffy",
      "$2b$12$hashedpassword"
    );
  });

  it("returns 409 when email already exists", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(mockUser);

    const request = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Another User",
        email: "luffy@example.com",
        password: "strongpassword123",
      }),
    });

    const response = await registerHandler(request);
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json).toEqual({ error: "Email already in use" });
    expect(createUser).not.toHaveBeenCalled();
  });

  it("returns 400 when name is missing", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "luffy@example.com",
        password: "strongpassword123",
      }),
    });

    const response = await registerHandler(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toEqual({ error: "Name is required" });
    expect(createUser).not.toHaveBeenCalled();
  });

  it("returns 400 when name is empty string", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "   ",
        email: "luffy@example.com",
        password: "strongpassword123",
      }),
    });

    const response = await registerHandler(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toEqual({ error: "Name is required" });
  });

  it("returns 400 when email is invalid", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Monkey D. Luffy",
        email: "not-an-email",
        password: "strongpassword123",
      }),
    });

    const response = await registerHandler(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toEqual({ error: "Valid email is required" });
    expect(createUser).not.toHaveBeenCalled();
  });

  it("returns 400 when password is shorter than 8 characters", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Monkey D. Luffy",
        email: "luffy@example.com",
        password: "short",
      }),
    });

    const response = await registerHandler(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toEqual({ error: "Password must be at least 8 characters" });
    expect(createUser).not.toHaveBeenCalled();
  });

  it("returns 400 when password is missing", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Monkey D. Luffy",
        email: "luffy@example.com",
      }),
    });

    const response = await registerHandler(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toEqual({ error: "Password must be at least 8 characters" });
  });

  it("normalizes email to lowercase", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(null);
    vi.mocked(createUser).mockResolvedValue({
      ...mockUser,
      email: "luffy@example.com",
    });

    const request = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Monkey D. Luffy",
        email: "LUFFY@EXAMPLE.COM",
        password: "strongpassword123",
      }),
    });

    const response = await registerHandler(request);

    expect(response.status).toBe(201);
    expect(getUserByEmail).toHaveBeenCalledWith("luffy@example.com");
    expect(createUser).toHaveBeenCalledWith(
      "luffy@example.com",
      "Monkey D. Luffy",
      "$2b$12$hashedpassword"
    );
  });
});
