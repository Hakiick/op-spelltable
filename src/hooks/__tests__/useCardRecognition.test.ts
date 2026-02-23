import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock ImageData since jsdom may not provide it in all configurations
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

// Mock the worker bridge
const mockBridge = {
  initialize: vi.fn(),
  recognize: vi.fn(),
  dispose: vi.fn(),
  isUsingWorker: vi.fn(),
};

vi.mock("@/lib/card-recognition/worker-bridge", () => ({
  createWorkerBridge: vi.fn(() => mockBridge),
}));

// Mock the recognition loop
const mockLoop = {
  start: vi.fn(),
  stop: vi.fn(),
  isRunning: vi.fn(),
  getFps: vi.fn(),
};

vi.mock("@/lib/card-recognition/recognition-loop", () => ({
  createRecognitionLoop: vi.fn(() => mockLoop),
}));

// Mock captureFrame used in recognizeOnce
vi.mock("@/lib/card-recognition/capture", () => ({
  captureFrame: vi.fn(),
}));

import { useCardRecognition } from "@/hooks/useCardRecognition";
import { captureFrame } from "@/lib/card-recognition/capture";

describe("useCardRecognition", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockBridge.initialize = vi.fn().mockResolvedValue(undefined);
    mockBridge.recognize = vi.fn().mockResolvedValue({
      result: {
        cardCode: null,
        confidence: 0,
        candidateCount: 0,
        durationMs: 5,
      },
      fps: 0,
    });
    mockBridge.dispose = vi.fn();
    mockBridge.isUsingWorker = vi.fn().mockReturnValue(false);

    mockLoop.start = vi.fn();
    mockLoop.stop = vi.fn();
    mockLoop.isRunning = vi.fn().mockReturnValue(false);
    mockLoop.getFps = vi.fn().mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes with idle status", () => {
    const { result } = renderHook(() => useCardRecognition());

    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.lastResult).toBeNull();
    expect(result.current.state.topCandidates).toEqual([]);
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.isActive).toBe(false);
    expect(result.current.state.loadingProgress).toBe(0);
  });

  it("includes fps in initial state (should be 0)", () => {
    const { result } = renderHook(() => useCardRecognition());

    expect(result.current.state.fps).toBe(0);
  });

  it("exposes required functions", () => {
    const { result } = renderHook(() => useCardRecognition());

    expect(typeof result.current.start).toBe("function");
    expect(typeof result.current.stop).toBe("function");
    expect(typeof result.current.recognizeOnce).toBe("function");
    expect(typeof result.current.setConfig).toBe("function");
  });

  it("exposes isUsingWorker boolean in return value", () => {
    const { result } = renderHook(() => useCardRecognition());

    expect(typeof result.current.isUsingWorker).toBe("boolean");
    expect(result.current.isUsingWorker).toBe(false);
  });

  it("setConfig updates configuration", () => {
    const { result } = renderHook(() => useCardRecognition());

    act(() => {
      result.current.setConfig({ confidenceThreshold: 0.9 });
    });

    // State should remain otherwise unchanged
    expect(result.current.state.status).toBe("idle");
  });

  it("stop sets isActive to false", async () => {
    const mockVideoRef = {
      current: {
        readyState: 4,
        videoWidth: 640,
        videoHeight: 480,
      } as HTMLVideoElement,
    };

    const { result } = renderHook(() => useCardRecognition());

    await act(async () => {
      await result.current.start(mockVideoRef);
    });

    act(() => {
      result.current.stop();
    });

    expect(result.current.state.isActive).toBe(false);
  });

  it("stop calls loop.stop()", async () => {
    const mockVideoRef = {
      current: {
        readyState: 4,
        videoWidth: 640,
        videoHeight: 480,
      } as HTMLVideoElement,
    };

    const { result } = renderHook(() => useCardRecognition());

    await act(async () => {
      await result.current.start(mockVideoRef);
    });

    act(() => {
      result.current.stop();
    });

    expect(mockLoop.stop).toHaveBeenCalled();
  });

  it("recognizeOnce transitions through processing state", async () => {
    mockBridge.recognize.mockResolvedValue({
      result: {
        cardCode: "OP01-001",
        confidence: 0.95,
        candidateCount: 1,
        durationMs: 10,
      },
      fps: 15,
    });

    vi.mocked(captureFrame).mockReturnValue({
      imageData: new MockImageData(640, 480) as unknown as ImageData,
      capturedAt: Date.now(),
      sourceWidth: 640,
      sourceHeight: 480,
    });

    const mockVideoRef = {
      current: {
        readyState: 4,
        videoWidth: 640,
        videoHeight: 480,
      } as HTMLVideoElement,
    };

    const { result } = renderHook(() => useCardRecognition());

    await act(async () => {
      await result.current.recognizeOnce(mockVideoRef);
    });

    expect(result.current.state.lastResult).not.toBeNull();
    expect(result.current.state.lastResult?.cardCode).toBe("OP01-001");
    expect(result.current.state.status).toBe("ready");
  });

  it("recognizeOnce updates fps in state", async () => {
    mockBridge.recognize.mockResolvedValue({
      result: {
        cardCode: "OP01-001",
        confidence: 0.95,
        candidateCount: 1,
        durationMs: 10,
      },
      fps: 30,
    });

    vi.mocked(captureFrame).mockReturnValue({
      imageData: new MockImageData(640, 480) as unknown as ImageData,
      capturedAt: Date.now(),
      sourceWidth: 640,
      sourceHeight: 480,
    });

    const mockVideoRef = {
      current: {
        readyState: 4,
        videoWidth: 640,
        videoHeight: 480,
      } as HTMLVideoElement,
    };

    const { result } = renderHook(() => useCardRecognition());

    await act(async () => {
      await result.current.recognizeOnce(mockVideoRef);
    });

    expect(result.current.state.fps).toBe(30);
  });

  it("recognizeOnce handles null video ref gracefully", async () => {
    const mockVideoRef = { current: null };

    const { result } = renderHook(() => useCardRecognition());

    await act(async () => {
      await result.current.recognizeOnce(mockVideoRef);
    });

    // Should not crash, still in loading/idle state (initialize called but no video)
    expect(result.current.state.error).toBeNull();
  });

  it("recognizeOnce handles null captureFrame result gracefully", async () => {
    vi.mocked(captureFrame).mockReturnValue(null);

    const mockVideoRef = {
      current: {
        readyState: 4,
        videoWidth: 640,
        videoHeight: 480,
      } as HTMLVideoElement,
    };

    const { result } = renderHook(() => useCardRecognition());

    await act(async () => {
      await result.current.recognizeOnce(mockVideoRef);
    });

    expect(result.current.state.error).toBeNull();
    expect(result.current.state.status).toBe("ready");
  });

  it("disposes the bridge on unmount", async () => {
    const mockVideoRef = {
      current: {
        readyState: 4,
        videoWidth: 640,
        videoHeight: 480,
      } as HTMLVideoElement,
    };

    vi.mocked(captureFrame).mockReturnValue({
      imageData: new MockImageData(640, 480) as unknown as ImageData,
      capturedAt: Date.now(),
      sourceWidth: 640,
      sourceHeight: 480,
    });

    const { result, unmount } = renderHook(() => useCardRecognition());

    // Trigger bridge creation via recognizeOnce
    await act(async () => {
      await result.current.recognizeOnce(mockVideoRef);
    });

    unmount();

    expect(mockBridge.dispose).toHaveBeenCalled();
  });

  it("stop is callable even when not started", () => {
    const { result } = renderHook(() => useCardRecognition());

    // Should not throw
    expect(() => {
      act(() => {
        result.current.stop();
      });
    }).not.toThrow();

    expect(result.current.state.isActive).toBe(false);
  });

  it("start transitions to isActive after initialization", async () => {
    const mockVideoRef = {
      current: {
        readyState: 4,
        videoWidth: 640,
        videoHeight: 480,
      } as HTMLVideoElement,
    };

    const { result } = renderHook(() => useCardRecognition());

    await act(async () => {
      await result.current.start(mockVideoRef);
    });

    expect(result.current.state.isActive).toBe(true);
    expect(mockLoop.start).toHaveBeenCalled();
  });

  it("start does nothing if video ref is null", async () => {
    const mockVideoRef = { current: null };

    const { result } = renderHook(() => useCardRecognition());

    await act(async () => {
      await result.current.start(mockVideoRef);
    });

    expect(result.current.state.isActive).toBe(false);
    expect(mockLoop.start).not.toHaveBeenCalled();
  });

  it("isUsingWorker reflects bridge.isUsingWorker() after initialization", async () => {
    mockBridge.isUsingWorker.mockReturnValue(true);

    vi.mocked(captureFrame).mockReturnValue({
      imageData: new MockImageData(640, 480) as unknown as ImageData,
      capturedAt: Date.now(),
      sourceWidth: 640,
      sourceHeight: 480,
    });

    const mockVideoRef = {
      current: {
        readyState: 4,
        videoWidth: 640,
        videoHeight: 480,
      } as HTMLVideoElement,
    };

    const { result } = renderHook(() => useCardRecognition());

    await act(async () => {
      await result.current.recognizeOnce(mockVideoRef);
    });

    expect(result.current.isUsingWorker).toBe(true);
  });
});
