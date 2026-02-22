import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLobby } from "@/hooks/useLobby";
import type { LobbyRoom } from "@/types/lobby";

const makeRoom = (id: string): LobbyRoom => ({
  id,
  roomCode: `CODE${id}`,
  name: `Room ${id}`,
  status: "waiting",
  hostName: "Luffy",
  guestName: null,
  isPublic: true,
  createdAt: new Date().toISOString(),
});

/** Flush all pending microtasks (resolved promises). */
const flushPromises = () => act(async () => {});

describe("useLobby", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("starts in loading state with empty rooms", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise(() => {})) // never resolves
    );

    const { result } = renderHook(() => useLobby());
    expect(result.current.loading).toBe(true);
    expect(result.current.rooms).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("populates rooms after a successful fetch", async () => {
    const rooms = [makeRoom("1"), makeRoom("2")];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ rooms }),
      })
    );

    const { result } = renderHook(() => useLobby());
    await flushPromises();

    expect(result.current.loading).toBe(false);
    expect(result.current.rooms).toHaveLength(2);
    expect(result.current.rooms[0].id).toBe("1");
  });

  it("sets error on failed fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })
    );

    const { result } = renderHook(() => useLobby());
    await flushPromises();

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeTruthy();
    expect(result.current.rooms).toEqual([]);
  });

  it("polls every 5 seconds", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rooms: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useLobby());

    // Initial fetch
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Advance 5s → second poll
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Advance another 5s → third poll
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("clears interval on unmount", async () => {
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ rooms: [] }),
      })
    );

    const { unmount } = renderHook(() => useLobby());
    await flushPromises();

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it("refetch re-triggers loading and fetches again", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rooms: [makeRoom("1")] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rooms: [makeRoom("1"), makeRoom("2")] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useLobby());
    await flushPromises();
    expect(result.current.rooms).toHaveLength(1);

    act(() => result.current.refetch());
    await flushPromises();
    expect(result.current.rooms).toHaveLength(2);
  });
});
