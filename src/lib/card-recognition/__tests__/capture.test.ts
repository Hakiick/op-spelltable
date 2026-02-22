import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { captureFrame } from "../capture";

// Mock ImageData since jsdom doesn't provide it
class MockImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(data: Uint8ClampedArray | number, width: number, height?: number) {
    if (typeof data === "number") {
      this.width = data;
      this.height = width;
      this.data = new Uint8ClampedArray(data * width * 4);
    } else {
      this.data = data;
      this.width = width;
      this.height = height ?? data.length / (width * 4);
    }
  }
}

// Inject into global scope for tests
Object.defineProperty(globalThis, "ImageData", {
  value: MockImageData,
  writable: true,
  configurable: true,
});

function makeMockVideo(
  overrides: Partial<{
    readyState: number;
    videoWidth: number;
    videoHeight: number;
  }> = {}
): HTMLVideoElement {
  return {
    readyState: 4, // HAVE_ENOUGH_DATA
    videoWidth: 640,
    videoHeight: 480,
    ...overrides,
  } as unknown as HTMLVideoElement;
}

describe("captureFrame", () => {
  let mockCanvas: HTMLCanvasElement;
  let mockCtx: CanvasRenderingContext2D;
  let originalCreateElement: typeof document.createElement;

  beforeEach(() => {
    const mockImageData = new MockImageData(640, 480) as unknown as ImageData;

    mockCtx = {
      drawImage: vi.fn(),
      getImageData: vi.fn().mockReturnValue(mockImageData),
    } as unknown as CanvasRenderingContext2D;

    mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockCtx),
    } as unknown as HTMLCanvasElement;

    originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(
      (tagName: string) => {
        if (tagName === "canvas") return mockCanvas;
        return originalCreateElement(tagName);
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when video readyState < 2 (HAVE_CURRENT_DATA)", () => {
    const video = makeMockVideo({ readyState: 1 });
    const result = captureFrame(video);
    expect(result).toBeNull();
  });

  it("returns null when readyState is 0 (HAVE_NOTHING)", () => {
    const video = makeMockVideo({ readyState: 0 });
    const result = captureFrame(video);
    expect(result).toBeNull();
  });

  it("returns null when video dimensions are zero", () => {
    const video = makeMockVideo({ readyState: 4, videoWidth: 0, videoHeight: 0 });
    const result = captureFrame(video);
    expect(result).toBeNull();
  });

  it("returns CaptureResult when video is ready", () => {
    const video = makeMockVideo({
      readyState: 2,
      videoWidth: 640,
      videoHeight: 480,
    });
    const result = captureFrame(video);

    expect(result).not.toBeNull();
    expect(result!.sourceWidth).toBe(640);
    expect(result!.sourceHeight).toBe(480);
    expect(result!.imageData).toBeDefined();
    expect(result!.capturedAt).toBeGreaterThan(0);
  });

  it("sets canvas dimensions to full video size when no crop", () => {
    const video = makeMockVideo({
      readyState: 2,
      videoWidth: 1280,
      videoHeight: 720,
    });
    captureFrame(video);
    expect(mockCanvas.width).toBe(1280);
    expect(mockCanvas.height).toBe(720);
  });

  it("applies crop region to canvas dimensions", () => {
    const video = makeMockVideo({
      readyState: 4,
      videoWidth: 640,
      videoHeight: 480,
    });
    const crop = { x: 100, y: 50, width: 200, height: 150 };

    const croppedImageData = new MockImageData(200, 150) as unknown as ImageData;
    (mockCtx.getImageData as ReturnType<typeof vi.fn>).mockReturnValue(
      croppedImageData
    );

    const result = captureFrame(video, crop);

    expect(result).not.toBeNull();
    expect(mockCanvas.width).toBe(200);
    expect(mockCanvas.height).toBe(150);
  });

  it("calls drawImage with crop region parameters when crop is provided", () => {
    const video = makeMockVideo({ readyState: 4 });
    const crop = { x: 10, y: 20, width: 100, height: 80 };

    captureFrame(video, crop);

    expect(mockCtx.drawImage).toHaveBeenCalledWith(
      video,
      10,
      20,
      100,
      80,
      0,
      0,
      100,
      80
    );
  });

  it("calls drawImage with full video dimensions when no crop", () => {
    const video = makeMockVideo({
      readyState: 2,
      videoWidth: 640,
      videoHeight: 480,
    });

    captureFrame(video);

    expect(mockCtx.drawImage).toHaveBeenCalledWith(
      video,
      0,
      0,
      640,
      480,
      0,
      0,
      640,
      480
    );
  });

  it("returns null when canvas context is unavailable", () => {
    mockCanvas.getContext = vi.fn().mockReturnValue(null);
    const video = makeMockVideo({ readyState: 2 });
    const result = captureFrame(video);
    expect(result).toBeNull();
  });
});
