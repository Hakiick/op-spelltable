/**
 * OCR-based card code detection using Tesseract.js.
 *
 * Every One Piece TCG card has a unique code printed on it (e.g. "OP12-112",
 * "ST01-001", "EB01-025"). This module extracts that code from a cropped card
 * image, providing near-perfect identification regardless of art style,
 * SAMPLE watermarks, or lighting conditions.
 *
 * The card code is typically located in the bottom-right area of the card.
 */

import type {
  createWorker,
  Worker as TesseractWorker,
  PSM,
} from "tesseract.js";

/** Regex matching One Piece TCG card codes: OP01-001, ST13-011, EB01-025, etc. */
const CARD_CODE_PATTERN = /\b([A-Z]{2}\d{2})-(\d{3})\b/;

/** Broader regex that also catches OCR misreads like O instead of 0 */
const CARD_CODE_FUZZY = /\b([A-Z0O]{2}\d{1,2})\s*[-–—.]\s*(\d{2,3})\b/;

let ocrWorker: TesseractWorker | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Initializes the Tesseract.js OCR worker (lazy, singleton).
 * Downloads ~2MB of English language data on first use.
 */
async function ensureWorker(): Promise<TesseractWorker> {
  if (ocrWorker) return ocrWorker;

  if (initPromise) {
    await initPromise;
    return ocrWorker!;
  }

  initPromise = (async () => {
    const Tesseract = await import("tesseract.js");
    const worker = (await (Tesseract.createWorker as typeof createWorker)(
      "eng",
      undefined,
      {
        // Suppress verbose logging in production
        logger: () => {},
      }
    )) as TesseractWorker;

    // Restrict to alphanumeric + common separators for faster/cleaner OCR
    await worker.setParameters({
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-–. ",
      tessedit_pageseg_mode: "7" as PSM, // Treat image as a single text line
    });

    ocrWorker = worker;
  })();

  await initPromise;
  return ocrWorker!;
}

/**
 * Crops the bottom portion of an ImageData where the card code is located.
 * Returns a new ImageData containing roughly the bottom 15% of the input,
 * focused on the right half where OP TCG codes are printed.
 */
export function cropCardCodeRegion(cardImage: ImageData): ImageData {
  const { width, height, data } = cardImage;

  // Card code is in the bottom ~15% of the card, right ~60%
  const cropTop = Math.floor(height * 0.82);
  const cropLeft = Math.floor(width * 0.35);
  const cropW = width - cropLeft;
  const cropH = height - cropTop;

  if (cropW <= 0 || cropH <= 0) return cardImage;

  const cropped = new ImageData(cropW, cropH);
  for (let row = 0; row < cropH; row++) {
    const srcOffset = ((cropTop + row) * width + cropLeft) * 4;
    const dstOffset = row * cropW * 4;
    cropped.data.set(
      data.subarray(srcOffset, srcOffset + cropW * 4),
      dstOffset
    );
  }
  return cropped;
}

/**
 * Applies preprocessing to improve OCR accuracy on card code text:
 * - Convert to grayscale
 * - Increase contrast (threshold-like binarization)
 * - Scale up for better text recognition
 */
function preprocessForOcr(imageData: ImageData): ImageData {
  const { width, height, data } = imageData;

  // Scale factor for better OCR accuracy on small text
  const scale = 3;
  const newW = width * scale;
  const newH = height * scale;

  // First: grayscale + contrast boost on original
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    // Luminance-weighted grayscale
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    // Contrast boost: push values toward 0 or 255
    gray[i] = lum < 140 ? 0 : 255;
  }

  // Nearest-neighbor upscale for crisp text
  const result = new ImageData(newW, newH);
  for (let y = 0; y < newH; y++) {
    const srcY = Math.floor(y / scale);
    for (let x = 0; x < newW; x++) {
      const srcX = Math.floor(x / scale);
      const val = gray[srcY * width + srcX];
      const dstIdx = (y * newW + x) * 4;
      result.data[dstIdx] = val;
      result.data[dstIdx + 1] = val;
      result.data[dstIdx + 2] = val;
      result.data[dstIdx + 3] = 255;
    }
  }

  return result;
}

/**
 * Parses OCR text to extract a valid card code.
 * Handles common OCR misreads (O↔0, I↔1, etc.)
 */
function parseCardCode(text: string): string | null {
  // Try exact match first
  const exact = CARD_CODE_PATTERN.exec(text.toUpperCase());
  if (exact) {
    return `${exact[1]}-${exact[2]}`;
  }

  // Try fuzzy match with common OCR corrections
  const fuzzy = CARD_CODE_FUZZY.exec(text.toUpperCase());
  if (fuzzy) {
    let prefix = fuzzy[1];
    let number = fuzzy[2];

    // Fix common OCR misreads in prefix
    prefix = prefix.replace(/0/g, "O"); // 0 → O in prefix (OP, ST, EB)

    // Ensure number is 3 digits
    if (number.length === 2) number = "0" + number;
    if (number.length > 3) number = number.slice(0, 3);

    const code = `${prefix}-${number}`;
    // Validate it looks like a real card code
    if (CARD_CODE_PATTERN.test(code)) {
      return code;
    }
  }

  return null;
}

export interface OcrResult {
  cardCode: string | null;
  rawText: string;
  confidence: number;
}

/**
 * Attempts to read the card code from a card image using OCR.
 *
 * @param cardImage - ImageData of the detected card (cropped from webcam)
 * @returns The detected card code, raw OCR text, and confidence
 */
export async function recognizeCardCode(
  cardImage: ImageData
): Promise<OcrResult> {
  const worker = await ensureWorker();

  // Crop to the code region (bottom-right)
  const codeRegion = cropCardCodeRegion(cardImage);

  // Preprocess for better OCR accuracy
  const processed = preprocessForOcr(codeRegion);

  // Convert ImageData to canvas for Tesseract
  let canvas: HTMLCanvasElement | OffscreenCanvas;
  if (typeof OffscreenCanvas !== "undefined") {
    canvas = new OffscreenCanvas(processed.width, processed.height);
  } else {
    canvas = document.createElement("canvas");
    canvas.width = processed.width;
    canvas.height = processed.height;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { cardCode: null, rawText: "", confidence: 0 };
  }
  (ctx as CanvasRenderingContext2D).putImageData(processed, 0, 0);

  // Run OCR
  const {
    data: { text, confidence },
  } = await worker.recognize(canvas as HTMLCanvasElement);

  const cardCode = parseCardCode(text);

  return {
    cardCode,
    rawText: text.trim(),
    confidence: confidence / 100, // Normalize to 0-1
  };
}

/**
 * Disposes the OCR worker to free resources.
 */
export async function disposeOcrWorker(): Promise<void> {
  if (ocrWorker) {
    await ocrWorker.terminate();
    ocrWorker = null;
    initPromise = null;
  }
}
