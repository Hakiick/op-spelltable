const ROOM_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_PATTERN = /^[A-Z0-9]{6}$/;

/**
 * Generates a random 6-character alphanumeric room code (uppercase).
 */
export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS.charAt(
      Math.floor(Math.random() * ROOM_CODE_CHARS.length)
    );
  }
  return code;
}

/**
 * Validates that a room code matches the expected format:
 * exactly 6 uppercase alphanumeric characters.
 */
export function validateRoomCode(code: string): boolean {
  return ROOM_CODE_PATTERN.test(code);
}

/**
 * Returns the URL path for a given room code.
 */
export function formatRoomUrl(code: string): string {
  return `/room/${code}`;
}
