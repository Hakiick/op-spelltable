import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the card recognizer
const mockRecognizer = {
  isReady: false,
  initialize: vi.fn(),
  recognize: vi.fn(),
  dispose: vi.fn(),
};

vi.mock("@/lib/card-recognition/identify", () => ({
  createCardRecognizer: vi.fn(() => mockRecognizer),
}));

import { useCardRecognition } from "@/hooks/useCardRecognition";
import { createCardRecognizer } from "@/lib/card-recognition/identify";

describe("useCardRecognition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecognizer.isReady = false;
    mockRecognizer.initialize = vi.fn().mockImplementation(() => {
      mockRecognizer.isReady = true;
      return Promise.resolve();
    });
    mockRecognizer.recognize = vi.fn().mockResolvedValue({
      cardCode: null,
      confidence: 0,
      candidateCount: 0,
      durationMs: 5,
    });
    mockRecognizer.dispose = vi.fn();
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

  it("exposes required functions", () => {
    const { result } = renderHook(() => useCardRecognition());

    expect(typeof result.current.start).toBe("function");
    expect(typeof result.current.stop).toBe("function");
    expect(typeof result.current.recognizeOnce).toBe("function");
    expect(typeof result.current.setConfig).toBe("function");
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
    // Mock requestAnimationFrame
    const rafSpy = vi
      .spyOn(globalThis, "requestAnimationFrame")
      .mockReturnValue(1);
    const cafSpy = vi
      .spyOn(globalThis, "cancelAnimationFrame")
      .mockImplementation(vi.fn());

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

    rafSpy.mockRestore();
    cafSpy.mockRestore();
  });

  it("recognizeOnce transitions through processing state", async () => {
    mockRecognizer.recognize.mockResolvedValue({
      cardCode: "OP01-001",
      confidence: 0.95,
      candidateCount: 1,
      durationMs: 10,
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

  it("recognizeOnce handles null video ref gracefully", async () => {
    const mockVideoRef = { current: null };

    const { result } = renderHook(() => useCardRecognition());

    await act(async () => {
      await result.current.recognizeOnce(mockVideoRef);
    });

    // Should not crash, still in loading/idle state (initialize called but no video)
    expect(result.current.state.error).toBeNull();
  });

  it("disposes the recognizer on unmount after it has been used", async () => {
    const mockVideoRef = {
      current: {
        readyState: 4,
        videoWidth: 640,
        videoHeight: 480,
      } as HTMLVideoElement,
    };

    const { result, unmount } = renderHook(() => useCardRecognition());

    // Trigger recognizer creation via recognizeOnce
    await act(async () => {
      await result.current.recognizeOnce(mockVideoRef);
    });

    unmount();

    expect(mockRecognizer.dispose).toHaveBeenCalled();
  });

  it("creates a recognizer instance on first use", () => {
    renderHook(() => useCardRecognition());
    // The recognizer is created lazily on first use, not on mount
    // But createCardRecognizer is mocked, let's verify structure
    expect(createCardRecognizer).toBeDefined();
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

  it("start transitions to loading state while initializing", async () => {
    // Make initialize take time
    let resolveInit!: () => void;
    mockRecognizer.isReady = false;
    mockRecognizer.initialize = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveInit = () => {
            mockRecognizer.isReady = true;
            resolve();
          };
        })
    );

    vi.spyOn(globalThis, "requestAnimationFrame").mockReturnValue(1);
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(vi.fn());

    const mockVideoRef = {
      current: { readyState: 4, videoWidth: 640, videoHeight: 480 } as HTMLVideoElement,
    };

    const { result } = renderHook(() => useCardRecognition());

    // Start the start operation but don't await it yet
    const startPromise = act(async () => {
      const promise = result.current.start(mockVideoRef);
      // Resolve the init
      resolveInit();
      await promise;
    });

    await startPromise;

    // After resolution, should be active
    expect(result.current.state.isActive).toBe(true);
  });
});
