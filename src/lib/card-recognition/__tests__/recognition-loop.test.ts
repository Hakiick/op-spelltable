import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createRecognitionLoop,
  computeFpsFromTimestamps,
} from "../recognition-loop";
import type { RecognitionLoopCallbacks } from "../recognition-loop";
import type { RecognitionConfig } from "@/types/ml";

// Mock ImageData since it may not be available in the test environment
class MockImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  colorSpace: PredefinedColorSpace = "srgb";

  constructor(widthOrData: number | Uint8ClampedArray, height: number) {
    if (typeof widthOrData === "number") {
      this.width = widthOrData;
      this.height = height;
      this.data = new Uint8ClampedArray(widthOrData * height * 4);
    } else {
      this.data = widthOrData;
      this.width = widthOrData.length / (height * 4);
      this.height = height;
    }
  }
}

Object.defineProperty(globalThis, "ImageData", {
  value: MockImageData,
  writable: true,
  configurable: true,
});

// Mock captureFrame
vi.mock("../capture", () => ({
  captureFrame: vi.fn(),
}));

import { captureFrame } from "../capture";

const DEFAULT_CONFIG: RecognitionConfig = {
  confidenceThreshold: 0.75,
  inputSize: 224,
  maxCandidates: 3,
  frameSkip: 1, // Process every frame in tests
  maxIdentify: 5,
};

describe("computeFpsFromTimestamps", () => {
  it("returns 0 for empty array", () => {
    expect(computeFpsFromTimestamps([])).toBe(0);
  });

  it("returns 0 for single timestamp", () => {
    expect(computeFpsFromTimestamps([1000])).toBe(0);
  });

  it("calculates FPS correctly for 2 timestamps 1 second apart", () => {
    // 1 interval over 1000ms = 1 FPS
    expect(computeFpsFromTimestamps([0, 1000])).toBe(1);
  });

  it("calculates FPS correctly for 10 timestamps over 1 second", () => {
    // 9 intervals over 1000ms = 9 FPS
    const timestamps = Array.from({ length: 10 }, (_, i) => i * (1000 / 9));
    const fps = computeFpsFromTimestamps(timestamps);
    expect(fps).toBeCloseTo(9, 0);
  });

  it("calculates 60 FPS for timestamps 1/60s apart", () => {
    const interval = 1000 / 60;
    const timestamps = [0, interval, interval * 2, interval * 3];
    const fps = computeFpsFromTimestamps(timestamps);
    expect(fps).toBeCloseTo(60, 0);
  });

  it("returns 0 when elapsed time is 0", () => {
    expect(computeFpsFromTimestamps([1000, 1000])).toBe(0);
  });
});

describe("createRecognitionLoop", () => {
  let rafSpy: ReturnType<typeof vi.spyOn>;
  let cafSpy: ReturnType<typeof vi.spyOn>;
  let rafCallbacks: Array<FrameRequestCallback>;

  beforeEach(() => {
    rafCallbacks = [];
    rafSpy = vi
      .spyOn(globalThis, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });
    cafSpy = vi
      .spyOn(globalThis, "cancelAnimationFrame")
      .mockImplementation(vi.fn());

    vi.mocked(captureFrame).mockReturnValue({
      imageData: new MockImageData(64, 64) as unknown as ImageData,
      capturedAt: Date.now(),
      sourceWidth: 640,
      sourceHeight: 480,
    });
  });

  afterEach(() => {
    rafSpy.mockRestore();
    cafSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("createRecognitionLoop returns correct interface", () => {
    const loop = createRecognitionLoop();

    expect(typeof loop.start).toBe("function");
    expect(typeof loop.stop).toBe("function");
    expect(typeof loop.isRunning).toBe("function");
    expect(typeof loop.getFps).toBe("function");
  });

  it("isRunning returns false before start", () => {
    const loop = createRecognitionLoop();
    expect(loop.isRunning()).toBe(false);
  });

  it("isRunning returns true after start", () => {
    const loop = createRecognitionLoop();
    const video = {} as HTMLVideoElement;
    const callbacks: RecognitionLoopCallbacks = {
      onFrame: vi.fn(),
      onFpsUpdate: vi.fn(),
    };

    loop.start(video, DEFAULT_CONFIG, callbacks);

    expect(loop.isRunning()).toBe(true);
  });

  it("isRunning returns false after stop", () => {
    const loop = createRecognitionLoop();
    const video = {} as HTMLVideoElement;
    const callbacks: RecognitionLoopCallbacks = {
      onFrame: vi.fn(),
      onFpsUpdate: vi.fn(),
    };

    loop.start(video, DEFAULT_CONFIG, callbacks);
    loop.stop();

    expect(loop.isRunning()).toBe(false);
  });

  it("stop cancels the animation frame", () => {
    const loop = createRecognitionLoop();
    const video = {} as HTMLVideoElement;
    const callbacks: RecognitionLoopCallbacks = {
      onFrame: vi.fn(),
      onFpsUpdate: vi.fn(),
    };

    loop.start(video, DEFAULT_CONFIG, callbacks);
    loop.stop();

    expect(cafSpy).toHaveBeenCalled();
  });

  it("start does nothing if already running", () => {
    const loop = createRecognitionLoop();
    const video = {} as HTMLVideoElement;
    const callbacks: RecognitionLoopCallbacks = {
      onFrame: vi.fn(),
      onFpsUpdate: vi.fn(),
    };

    loop.start(video, DEFAULT_CONFIG, callbacks);
    const rafCallCount = rafSpy.mock.calls.length;

    loop.start(video, DEFAULT_CONFIG, callbacks);

    // Should not have scheduled another RAF
    expect(rafSpy.mock.calls.length).toBe(rafCallCount);
  });

  it("calls onFrame when a frame is captured", () => {
    const loop = createRecognitionLoop();
    const video = {} as HTMLVideoElement;
    const onFrame = vi.fn();
    const callbacks: RecognitionLoopCallbacks = {
      onFrame,
      onFpsUpdate: vi.fn(),
    };

    loop.start(video, DEFAULT_CONFIG, callbacks);

    // Trigger the RAF callback
    const cb = rafCallbacks[0];
    cb(0);

    expect(onFrame).toHaveBeenCalledWith(expect.any(ImageData));
  });

  it("calls onFpsUpdate when a frame is captured", () => {
    const loop = createRecognitionLoop();
    const video = {} as HTMLVideoElement;
    const onFpsUpdate = vi.fn();
    const callbacks: RecognitionLoopCallbacks = {
      onFrame: vi.fn(),
      onFpsUpdate,
    };

    loop.start(video, DEFAULT_CONFIG, callbacks);

    const cb = rafCallbacks[0];
    cb(0);

    expect(onFpsUpdate).toHaveBeenCalled();
  });

  it("does not call onFrame when captureFrame returns null", () => {
    vi.mocked(captureFrame).mockReturnValue(null);

    const loop = createRecognitionLoop();
    const video = {} as HTMLVideoElement;
    const onFrame = vi.fn();
    const callbacks: RecognitionLoopCallbacks = {
      onFrame,
      onFpsUpdate: vi.fn(),
    };

    loop.start(video, DEFAULT_CONFIG, callbacks);

    const cb = rafCallbacks[0];
    cb(0);

    expect(onFrame).not.toHaveBeenCalled();
  });

  it("respects frameSkip — skips frames", () => {
    const loop = createRecognitionLoop();
    const video = {} as HTMLVideoElement;
    const onFrame = vi.fn();
    const callbacks: RecognitionLoopCallbacks = {
      onFrame,
      onFpsUpdate: vi.fn(),
    };

    const configWithSkip: RecognitionConfig = {
      ...DEFAULT_CONFIG,
      frameSkip: 3,
    };

    loop.start(video, configWithSkip, callbacks);

    // Manually trigger 6 RAF callbacks
    for (let i = 0; i < 6; i++) {
      const cb = rafCallbacks[rafCallbacks.length - 1];
      cb(i * 16);
    }

    // With frameSkip=3, frames 3 and 6 should trigger onFrame
    // (frameCount % 3 === 0 when frameCount = 3 or 6)
    expect(onFrame).toHaveBeenCalledTimes(2);
  });

  it("getFps returns 0 initially", () => {
    const loop = createRecognitionLoop();
    expect(loop.getFps()).toBe(0);
  });

  it("getFps returns 0 before any frames are processed", () => {
    const loop = createRecognitionLoop();
    const video = {} as HTMLVideoElement;
    const callbacks: RecognitionLoopCallbacks = {
      onFrame: vi.fn(),
      onFpsUpdate: vi.fn(),
    };

    loop.start(video, DEFAULT_CONFIG, callbacks);

    // No RAF callbacks triggered yet
    expect(loop.getFps()).toBe(0);
  });

  it("stops loop properly on stop() during RAF", () => {
    const loop = createRecognitionLoop();
    const video = {} as HTMLVideoElement;
    const callbacks: RecognitionLoopCallbacks = {
      onFrame: vi.fn(),
      onFpsUpdate: vi.fn(),
    };

    loop.start(video, DEFAULT_CONFIG, callbacks);

    // Trigger one frame
    const cb = rafCallbacks[0];
    cb(0);

    // Stop the loop
    loop.stop();

    expect(loop.isRunning()).toBe(false);
  });
});
