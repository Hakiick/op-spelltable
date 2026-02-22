import { useCallback, useEffect, useRef, useState } from "react";
import type { LobbyRoom } from "@/types/lobby";

interface LobbyResponse {
  rooms: LobbyRoom[];
}

interface UseLobbyResult {
  rooms: LobbyRoom[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const POLL_INTERVAL_MS = 5000;

export function useLobby(): UseLobbyResult {
  const [rooms, setRooms] = useState<LobbyRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRooms = useCallback(async () => {
    try {
      const response = await fetch("/api/lobby");
      if (!response.ok) {
        throw new Error(`Failed to fetch lobby: ${response.status}`);
      }
      const data = (await response.json()) as LobbyResponse;
      setRooms(data.rooms);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load lobby");
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(() => {
    setLoading(true);
    void fetchRooms();
  }, [fetchRooms]);

  useEffect(() => {
    void fetchRooms();

    intervalRef.current = setInterval(() => {
      void fetchRooms();
    }, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchRooms]);

  return { rooms, loading, error, refetch };
}
