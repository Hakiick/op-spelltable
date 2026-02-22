import { prisma } from "@/lib/database/prisma";
import type { User } from "@/generated/prisma";

export async function createUser(
  email: string,
  name: string,
  hashedPassword: string
): Promise<User> {
  return prisma.user.create({
    data: {
      email,
      name,
      hashedPassword,
    },
  });
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { email },
  });
}

export async function getUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { id },
  });
}

export async function updateUserProfile(
  id: string,
  data: { name?: string; avatarUrl?: string }
): Promise<User> {
  return prisma.user.update({
    where: { id },
    data,
  });
}

export async function updateUserStats(
  id: string,
  gamesPlayed: number,
  gamesWon: number
): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: { gamesPlayed, gamesWon },
  });
}
