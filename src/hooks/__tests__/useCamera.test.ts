import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useCamera } from "@/hooks/useCamera";

// Helpers to create mock MediaStream tracks and stream
function makeMockTrack(kind: string = "video"): MediaStreamTrack {
  return {
    kind,
    stop: vi.fn(),
    enabled: true,
    id: "track-" + Math.random(),
    label: kind + "-track",
  } as unknown as MediaStreamTrack;
}

function makeMockStream(tracks: MediaStreamTrack[] = []): MediaStream {
  return {
    getTracks: () => tracks,
    getVideoTracks: () => tracks.filter((t) => t.kind === "video"),
    getAudioTracks: () => tracks.filter((t) => t.kind === "audio"),
    id: "stream-" + Math.random(),
  } as unknown as MediaStream;
}

function makeMockMediaDevices(
  getUserMediaResult: MediaStream | DOMException | null,
  enumerateResult: MediaDeviceInfo[] = []
) {
  return {
    getUserMedia: vi.fn().mockImplementation(() => {
      if (getUserMediaResult instanceof DOMException) {
        return Promise.reject(getUserMediaResult);
      }
      return Promise.resolve(getUserMediaResult);
    }),
    enumerateDevices: vi.fn().mockResolvedValue(enumerateResult),
  };
}

describe("useCamera", () => {
  beforeEach(() => {
    // Reset mediaDevices before each test
    Object.defineProperty(navigator, "mediaDevices", {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockMediaDevices(mockImpl: ReturnType<typeof makeMockMediaDevices>) {
    Object.defineProperty(navigator, "mediaDevices", {
      value: mockImpl,
      writable: true,
      configurable: true,
    });
  }

  it("initializes with idle state", () => {
    const { result } = renderHook(() => useCamera());

    expect(result.current.state).toBe("idle");
    expect(result.current.stream).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.devices).toEqual([]);
    expect(result.current.settings.mirror).toBe(true);
    expect(result.current.settings.resolution).toBe("auto");
    expect(result.current.settings.deviceId).toBeNull();
  });

  it("startCamera sets state to active on success", async () => {
    const mockTrack = makeMockTrack("video");
    const mockStream = makeMockStream([mockTrack]);
    const mockDevicesImpl = makeMockMediaDevices(mockStream, [
      { deviceId: "cam1", kind: "videoinput", label: "Front Camera", groupId: "" } as MediaDeviceInfo,
    ]);
    mockMediaDevices(mockDevicesImpl);

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.state).toBe("active");
    expect(result.current.stream).toBe(mockStream);
    expect(result.current.error).toBeNull();
  });

  it("startCamera enumerates devices after getting permission", async () => {
    const mockStream = makeMockStream([makeMockTrack()]);
    const mockDevicesImpl = makeMockMediaDevices(mockStream, [
      { deviceId: "cam1", kind: "videoinput", label: "Front Camera", groupId: "" } as MediaDeviceInfo,
      { deviceId: "cam2", kind: "videoinput", label: "Back Camera", groupId: "" } as MediaDeviceInfo,
      { deviceId: "mic1", kind: "audioinput", label: "Microphone", groupId: "" } as MediaDeviceInfo,
    ]);
    mockMediaDevices(mockDevicesImpl);

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    // Should have 2 video devices (not the audio one)
    expect(result.current.devices).toHaveLength(2);
    expect(result.current.devices[0]).toEqual({ deviceId: "cam1", label: "Front Camera" });
    expect(result.current.devices[1]).toEqual({ deviceId: "cam2", label: "Back Camera" });
  });

  it("startCamera sets state to error on NotAllowedError", async () => {
    const notAllowedError = new DOMException("Permission denied", "NotAllowedError");
    const mockDevicesImpl = makeMockMediaDevices(notAllowedError);
    mockMediaDevices(mockDevicesImpl);

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error).toBe(
      "Camera access was denied. Please allow camera permissions."
    );
    expect(result.current.stream).toBeNull();
  });

  it("startCamera sets state to error on NotFoundError", async () => {
    const notFoundError = new DOMException("Device not found", "NotFoundError");
    const mockDevicesImpl = makeMockMediaDevices(notFoundError);
    mockMediaDevices(mockDevicesImpl);

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error).toBe(
      "No camera found. Please connect a webcam and try again."
    );
  });

  it("startCamera sets state to error on NotReadableError", async () => {
    const notReadableError = new DOMException("Device in use", "NotReadableError");
    const mockDevicesImpl = makeMockMediaDevices(notReadableError);
    mockMediaDevices(mockDevicesImpl);

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error).toBe(
      "Camera is already in use by another application."
    );
  });

  it("stopCamera stops tracks and resets state", async () => {
    const mockTrack = makeMockTrack("video");
    const mockStream = makeMockStream([mockTrack]);
    const mockDevicesImpl = makeMockMediaDevices(mockStream);
    mockMediaDevices(mockDevicesImpl);

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.state).toBe("active");

    act(() => {
      result.current.stopCamera();
    });

    expect(result.current.state).toBe("idle");
    expect(result.current.stream).toBeNull();
    expect(mockTrack.stop).toHaveBeenCalled();
  });

  it("updateSettings updates mirror flag", () => {
    const { result } = renderHook(() => useCamera());

    expect(result.current.settings.mirror).toBe(true);

    act(() => {
      result.current.updateSettings({ mirror: false });
    });

    expect(result.current.settings.mirror).toBe(false);
  });

  it("updateSettings updates resolution", () => {
    const { result } = renderHook(() => useCamera());

    expect(result.current.settings.resolution).toBe("auto");

    act(() => {
      result.current.updateSettings({ resolution: "720p" });
    });

    expect(result.current.settings.resolution).toBe("720p");
  });

  it("updateSettings updates deviceId", () => {
    const { result } = renderHook(() => useCamera());

    expect(result.current.settings.deviceId).toBeNull();

    act(() => {
      result.current.updateSettings({ deviceId: "device-123" });
    });

    expect(result.current.settings.deviceId).toBe("device-123");
  });

  it("stopCamera on unmount stops any active stream", async () => {
    const mockTrack = makeMockTrack("video");
    const mockStream = makeMockStream([mockTrack]);
    const mockDevicesImpl = makeMockMediaDevices(mockStream);
    mockMediaDevices(mockDevicesImpl);

    const { result, unmount } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.state).toBe("active");

    unmount();

    // Track should be stopped on unmount
    expect(mockTrack.stop).toHaveBeenCalled();
  });
});
