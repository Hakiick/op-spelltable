import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createUser,
  getUserByEmail,
  getUserById,
  updateUserProfile,
  updateUserStats,
} from "@/lib/database/users";

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/database/prisma";

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

describe("createUser", () => {
  it("creates and returns a new user", async () => {
    vi.mocked(prisma.user.create).mockResolvedValue(mockUser as never);

    const result = await createUser(
      "luffy@example.com",
      "Monkey D. Luffy",
      "$2b$12$hashedpassword"
    );

    expect(result).toEqual(mockUser);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: "luffy@example.com",
        name: "Monkey D. Luffy",
        hashedPassword: "$2b$12$hashedpassword",
      },
    });
  });
});

describe("getUserByEmail", () => {
  it("returns a user when found by email", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);

    const result = await getUserByEmail("luffy@example.com");

    expect(result).toEqual(mockUser);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "luffy@example.com" },
    });
  });

  it("returns null when user is not found by email", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);

    const result = await getUserByEmail("unknown@example.com");

    expect(result).toBeNull();
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "unknown@example.com" },
    });
  });
});

describe("getUserById", () => {
  it("returns a user when found by id", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);

    const result = await getUserById("usr001");

    expect(result).toEqual(mockUser);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "usr001" },
    });
  });

  it("returns null when user is not found by id", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);

    const result = await getUserById("nonexistent");

    expect(result).toBeNull();
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "nonexistent" },
    });
  });
});

describe("updateUserProfile", () => {
  it("updates and returns user with new name", async () => {
    const updatedUser = { ...mockUser, name: "Nami" };
    vi.mocked(prisma.user.update).mockResolvedValue(updatedUser as never);

    const result = await updateUserProfile("usr001", { name: "Nami" });

    expect(result).toEqual(updatedUser);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "usr001" },
      data: { name: "Nami" },
    });
  });

  it("updates and returns user with avatarUrl", async () => {
    const updatedUser = { ...mockUser, avatarUrl: "https://example.com/avatar.png" };
    vi.mocked(prisma.user.update).mockResolvedValue(updatedUser as never);

    const result = await updateUserProfile("usr001", {
      avatarUrl: "https://example.com/avatar.png",
    });

    expect(result).toEqual(updatedUser);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "usr001" },
      data: { avatarUrl: "https://example.com/avatar.png" },
    });
  });
});

describe("updateUserStats", () => {
  it("updates and returns user stats", async () => {
    const updatedUser = { ...mockUser, gamesPlayed: 10, gamesWon: 7 };
    vi.mocked(prisma.user.update).mockResolvedValue(updatedUser as never);

    const result = await updateUserStats("usr001", 10, 7);

    expect(result).toEqual(updatedUser);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "usr001" },
      data: { gamesPlayed: 10, gamesWon: 7 },
    });
  });
});
