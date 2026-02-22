import { describe, it, expect } from "vitest";
import {
  generateRoomCode,
  validateRoomCode,
  formatRoomUrl,
} from "@/lib/webrtc/room-utils";

describe("generateRoomCode", () => {
  it("returns a string of exactly 6 characters", () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(6);
  });

  it("returns only uppercase alphanumeric characters", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode();
      expect(code).toMatch(/^[A-Z0-9]{6}$/);
    }
  });

  it("generates different codes on subsequent calls (probabilistic)", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateRoomCode()));
    // With 36^6 = ~2.1B possibilities, 20 calls producing all same codes is essentially impossible
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("validateRoomCode", () => {
  it("returns true for a valid 6-char uppercase alphanumeric code", () => {
    expect(validateRoomCode("ABC123")).toBe(true);
    expect(validateRoomCode("ZZZZZZ")).toBe(true);
    expect(validateRoomCode("000000")).toBe(true);
    expect(validateRoomCode("A1B2C3")).toBe(true);
  });

  it("returns false for codes shorter than 6 characters", () => {
    expect(validateRoomCode("ABC12")).toBe(false);
    expect(validateRoomCode("")).toBe(false);
  });

  it("returns false for codes longer than 6 characters", () => {
    expect(validateRoomCode("ABC1234")).toBe(false);
  });

  it("returns false for lowercase characters", () => {
    expect(validateRoomCode("abc123")).toBe(false);
    expect(validateRoomCode("AbC123")).toBe(false);
  });

  it("returns false for codes with special characters", () => {
    expect(validateRoomCode("ABC-12")).toBe(false);
    expect(validateRoomCode("ABC 12")).toBe(false);
    expect(validateRoomCode("ABC!23")).toBe(false);
  });
});

describe("formatRoomUrl", () => {
  it("returns /room/<code> for a given code", () => {
    expect(formatRoomUrl("ABC123")).toBe("/room/ABC123");
  });

  it("works with any string input", () => {
    expect(formatRoomUrl("XYZ789")).toBe("/room/XYZ789");
    expect(formatRoomUrl("000000")).toBe("/room/000000");
  });
});
