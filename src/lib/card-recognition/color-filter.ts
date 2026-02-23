/**
 * Border color detection for One Piece TCG cards.
 *
 * OP TCG cards have distinctive colored borders: Red, Green, Blue, Purple,
 * Black, Yellow. Detecting the border color from a webcam capture allows
 * pre-filtering the reference database to only same-color cards, dramatically
 * reducing the search space (from ~2700 to ~400 cards).
 */

export type CardColor =
  | "Red"
  | "Green"
  | "Blue"
  | "Purple"
  | "Black"
  | "Yellow"
  | null;

/**
 * Detects the dominant border color from a card ImageData.
 * Samples pixels from the card border region (outer ~12% on each side)
 * and classifies the dominant hue.
 */
export function detectBorderColor(imageData: ImageData): CardColor {
  const { width, height, data } = imageData;

  // Sample border pixels (outer ~12% on each side)
  const borderFrac = 0.12;
  const leftEdge = Math.ceil(width * borderFrac);
  const rightStart = Math.floor(width * (1 - borderFrac));
  const topEdge = Math.ceil(height * borderFrac);
  const bottomStart = Math.floor(height * (1 - borderFrac));

  // Hue vote bins (6 colors + black)
  const votes: Record<string, number> = {
    Red: 0,
    Green: 0,
    Blue: 0,
    Purple: 0,
    Yellow: 0,
    Black: 0,
  };

  let totalVotes = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Only sample border pixels
      const isBorder =
        x < leftEdge || x >= rightStart || y < topEdge || y >= bottomStart;
      if (!isBorder) continue;

      const idx = (y * width + x) * 4;
      const r = data[idx] / 255;
      const g = data[idx + 1] / 255;
      const b = data[idx + 2] / 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const d = max - min;
      const s = max === 0 ? 0 : d / max;
      const v = max;

      // Skip very dark pixels (shadows/noise)
      if (v < 0.15) continue;

      // Black border: low saturation + moderate to dark value
      if (s < 0.15 && v < 0.5) {
        votes.Black++;
        totalVotes++;
        continue;
      }

      // Skip very desaturated pixels (white/gray card elements)
      if (s < 0.2) continue;

      // Compute hue
      let h = 0;
      if (d > 0) {
        if (max === r) h = 60 * (((g - b) / d) % 6);
        else if (max === g) h = 60 * ((b - r) / d + 2);
        else h = 60 * ((r - g) / d + 4);
        if (h < 0) h += 360;
      }

      // Classify by hue range
      if (h < 20 || h >= 340) {
        votes.Red++;
      } else if (h >= 20 && h < 70) {
        votes.Yellow++;
      } else if (h >= 70 && h < 170) {
        votes.Green++;
      } else if (h >= 170 && h < 260) {
        votes.Blue++;
      } else {
        // 260-340
        votes.Purple++;
      }
      totalVotes++;
    }
  }

  if (totalVotes < 50) return null; // Not enough pixels to decide

  // Find dominant color
  let bestColor: CardColor = null;
  let bestCount = 0;
  for (const [color, count] of Object.entries(votes)) {
    if (count > bestCount) {
      bestCount = count;
      bestColor = color as CardColor;
    }
  }

  // Require at least 25% of border pixels to agree on a color
  if (bestCount / totalVotes < 0.25) return null;

  return bestColor;
}
