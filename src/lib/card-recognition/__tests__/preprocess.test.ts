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
  it("normalizes 0 to -1.0", () => {
    expect(normalizePixel(0)).toBeCloseTo(-1.0, 5);
  });

  it("normalizes 255 to approximately 1.0", () => {
    expect(normalizePixel(255)).toBeCloseTo(255 / 127.5 - 1, 4);
  });

  it("normalizes 127 to approximately 0", () => {
    expect(normalizePixel(127)).toBeCloseTo(127 / 127.5 - 1, 4);
  });

  it("all byte values normalize to [-1, ~1] range", () => {
    for (let v = 0; v <= 255; v++) {
      const normalized = normalizePixel(v);
      expect(normalized).toBeGreaterThanOrEqual(-1.0);
      expect(normalized).toBeLessThanOrEqual(1.01); // 255/127.5 - 1 ≈ 1.004
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

  it("correctly maps R, G, B channels", () => {
    // Single pixel: R=200, G=100, B=50, A=255
    const pixels = new Uint8ClampedArray([200, 100, 50, 255]);
    const result = rgbaToNormalizedRgb(pixels, 1);

    expect(result[0]).toBeCloseTo(normalizePixel(200), 5); // R
    expect(result[1]).toBeCloseTo(normalizePixel(100), 5); // G
    expect(result[2]).toBeCloseTo(normalizePixel(50), 5); // B
    expect(result.length).toBe(3); // no alpha
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

  it("produces normalized values in range [-1, ~1]", () => {
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
      expect(result[i]).toBeGreaterThanOrEqual(-1.0);
      expect(result[i]).toBeLessThanOrEqual(1.01);
    }
  });
});
