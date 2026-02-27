import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  preprocessFrame,
  normalizePixel,
  rgbaToNormalizedRgb,
} from "../preprocess";

// Mock ImageData since jsdom doesn't provide it natively
class MockImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(
    dataOrWidth: Uint8ClampedArray | number,
    width: number,
    height?: number
  ) {
    if (typeof dataOrWidth === "number") {
      this.width = dataOrWidth;
      this.height = width;
      this.data = new Uint8ClampedArray(dataOrWidth * width * 4);
    } else {
      this.data = dataOrWidth;
      this.width = width;
      this.height = height ?? dataOrWidth.length / (width * 4);
    }
  }
}

Object.defineProperty(globalThis, "ImageData", {
  value: MockImageData,
  writable: true,
  configurable: true,
});

// ─── Pure math tests (no DOM needed) ──────────────────────────────────────────

describe("normalizePixel", () => {
  it("normalizes 0 using ImageNet stats for R channel", () => {
    // (0/255 - 0.485) / 0.229 ≈ -2.118
    expect(normalizePixel(0, 0)).toBeCloseTo(-0.485 / 0.229, 3);
  });

  it("normalizes 255 using ImageNet stats for R channel", () => {
    // (1.0 - 0.485) / 0.229 ≈ 2.249
    expect(normalizePixel(255, 0)).toBeCloseTo((1.0 - 0.485) / 0.229, 3);
  });

  it("applies different stats per channel", () => {
    const rNorm = normalizePixel(128, 0);
    const gNorm = normalizePixel(128, 1);
    const bNorm = normalizePixel(128, 2);
    // Different channels should produce different normalized values
    expect(rNorm).not.toBeCloseTo(gNorm, 2);
    expect(gNorm).not.toBeCloseTo(bNorm, 2);
  });

  it("all byte values produce finite numbers", () => {
    for (let v = 0; v <= 255; v++) {
      for (let ch = 0; ch < 3; ch++) {
        const normalized = normalizePixel(v, ch);
        expect(Number.isFinite(normalized)).toBe(true);
      }
    }
  });
});

describe("rgbaToNormalizedRgb", () => {
  it("produces output with 3 values per pixel (no alpha)", () => {
    const pixels = new Uint8ClampedArray(4 * 4); // 1 pixel
    const result = rgbaToNormalizedRgb(pixels, 1);
    expect(result.length).toBe(3);
  });

  it("produces correct output length for multiple pixels", () => {
    const pixelCount = 224 * 224;
    const pixels = new Uint8ClampedArray(pixelCount * 4);
    const result = rgbaToNormalizedRgb(pixels, pixelCount);
    expect(result.length).toBe(pixelCount * 3);
  });

  it("correctly maps R, G, B channels in NCHW layout", () => {
    // Single pixel: R=200, G=100, B=50, A=255
    const pixels = new Uint8ClampedArray([200, 100, 50, 255]);
    const result = rgbaToNormalizedRgb(pixels, 1);

    // NCHW: result[0] = R plane, result[1] = G plane, result[2] = B plane
    expect(result[0]).toBeCloseTo(normalizePixel(200, 0), 5); // R
    expect(result[1]).toBeCloseTo(normalizePixel(100, 1), 5); // G
    expect(result[2]).toBeCloseTo(normalizePixel(50, 2), 5); // B
    expect(result.length).toBe(3); // no alpha
  });

  it("NCHW layout groups channels contiguously for multiple pixels", () => {
    // 2 pixels: [R1,G1,B1,A1, R2,G2,B2,A2]
    const pixels = new Uint8ClampedArray([200, 100, 50, 255, 150, 75, 25, 255]);
    const result = rgbaToNormalizedRgb(pixels, 2);

    // NCHW with 2 pixels: [R1, R2, G1, G2, B1, B2]
    expect(result[0]).toBeCloseTo(normalizePixel(200, 0), 5); // R1
    expect(result[1]).toBeCloseTo(normalizePixel(150, 0), 5); // R2
    expect(result[2]).toBeCloseTo(normalizePixel(100, 1), 5); // G1
    expect(result[3]).toBeCloseTo(normalizePixel(75, 1), 5); // G2
    expect(result[4]).toBeCloseTo(normalizePixel(50, 2), 5); // B1
    expect(result[5]).toBeCloseTo(normalizePixel(25, 2), 5); // B2
  });

  it("ignores alpha channel", () => {
    // Same RGB, different alpha — should produce identical output
    const pixels1 = new Uint8ClampedArray([100, 150, 200, 0]);
    const pixels2 = new Uint8ClampedArray([100, 150, 200, 255]);

    const result1 = rgbaToNormalizedRgb(pixels1, 1);
    const result2 = rgbaToNormalizedRgb(pixels2, 1);

    expect(result1[0]).toBe(result2[0]);
    expect(result1[1]).toBe(result2[1]);
    expect(result1[2]).toBe(result2[2]);
  });

  it("returns Float32Array", () => {
    const pixels = new Uint8ClampedArray([0, 0, 0, 255]);
    const result = rgbaToNormalizedRgb(pixels, 1);
    expect(result).toBeInstanceOf(Float32Array);
  });
});

// ─── preprocessFrame integration tests (DOM canvas mocking) ──────────────────

describe("preprocessFrame", () => {
  let mockCanvas: HTMLCanvasElement;
  let mockSourceCanvas: HTMLCanvasElement;
  let mockCtx: CanvasRenderingContext2D;
  let mockSourceCtx: CanvasRenderingContext2D;
  let originalCreateElement: typeof document.createElement;
  let canvasCreateCount: number;

  function setupResizedPixels(
    inputSize: number,
    pixelValue: number = 128
  ): void {
    const data = new Uint8ClampedArray(inputSize * inputSize * 4).fill(
      pixelValue
    );
    for (let i = 3; i < data.length; i += 4) data[i] = 255;
    const mockImageData = new MockImageData(
      data,
      inputSize,
      inputSize
    ) as unknown as ImageData;
    (mockCtx.getImageData as ReturnType<typeof vi.fn>).mockReturnValue(
      mockImageData
    );
  }

  beforeEach(() => {
    canvasCreateCount = 0;

    mockSourceCtx = {
      putImageData: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    mockCtx = {
      drawImage: vi.fn(),
      getImageData: vi.fn(),
      putImageData: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: "",
    } as unknown as CanvasRenderingContext2D;

    mockSourceCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockSourceCtx),
    } as unknown as HTMLCanvasElement;

    mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockCtx),
    } as unknown as HTMLCanvasElement;

    originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(
      (tagName: string) => {
        if (tagName === "canvas") {
          canvasCreateCount++;
          // preprocessFrame creates source canvas first, then target canvas
          // First call (source canvas for putImageData)
          if (canvasCreateCount === 1) return mockSourceCanvas;
          // Second call (target canvas for letterboxed output)
          return mockCanvas;
        }
        return originalCreateElement(tagName);
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("produces Float32Array of correct size for 224x224", () => {
    const inputSize = 224;
    setupResizedPixels(inputSize);
    const imageData = new MockImageData(640, 480) as unknown as ImageData;
    const result = preprocessFrame(imageData, inputSize);

    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(inputSize * inputSize * 3);
  });

  it("produces correct size for inputSize=128", () => {
    const inputSize = 128;
    setupResizedPixels(inputSize);
    const imageData = new MockImageData(200, 200) as unknown as ImageData;
    const result = preprocessFrame(imageData, inputSize);

    expect(result.length).toBe(128 * 128 * 3);
  });

  it("calls putImageData on source canvas with the original imageData", () => {
    const inputSize = 4;
    setupResizedPixels(inputSize);
    const imageData = new MockImageData(100, 100) as unknown as ImageData;
    preprocessFrame(imageData, inputSize);

    expect(mockSourceCtx.putImageData).toHaveBeenCalledWith(imageData, 0, 0);
  });

  it("fills target canvas with gray before drawing (letterbox)", () => {
    const inputSize = 4;
    setupResizedPixels(inputSize);
    const imageData = new MockImageData(100, 100) as unknown as ImageData;
    preprocessFrame(imageData, inputSize);

    expect(mockCtx.fillStyle).toBe("rgb(128,128,128)");
    expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 0, inputSize, inputSize);
  });

  it("calls getImageData on target context with correct dimensions", () => {
    const inputSize = 8;
    setupResizedPixels(inputSize);
    const imageData = new MockImageData(100, 100) as unknown as ImageData;
    preprocessFrame(imageData, inputSize);

    expect(mockCtx.getImageData).toHaveBeenCalledWith(
      0,
      0,
      inputSize,
      inputSize
    );
  });

  it("produces finite normalized values (ImageNet normalization)", () => {
    const inputSize = 4;
    const data = new Uint8ClampedArray(inputSize * inputSize * 4);
    for (let i = 0; i < inputSize * inputSize; i++) {
      data[i * 4] = (i * 37) % 256;
      data[i * 4 + 1] = (i * 53) % 256;
      data[i * 4 + 2] = (i * 71) % 256;
      data[i * 4 + 3] = 255;
    }
    const mockImageData = new MockImageData(
      data,
      inputSize,
      inputSize
    ) as unknown as ImageData;
    (mockCtx.getImageData as ReturnType<typeof vi.fn>).mockReturnValue(
      mockImageData
    );

    const imageData = new MockImageData(100, 100) as unknown as ImageData;
    const result = preprocessFrame(imageData, inputSize);

    for (let i = 0; i < result.length; i++) {
      expect(Number.isFinite(result[i])).toBe(true);
    }
  });
});
