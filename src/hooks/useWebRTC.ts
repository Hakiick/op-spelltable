"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Peer as PeerType, MediaConnection, DataConnection } from "peerjs";
import { createPeer } from "@/lib/webrtc/peer-client";
import type { ConnectionStatus, WebRTCActions, WebRTCState } from "@/types/webrtc";

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 3000;

export function useWebRTC(roomCode: string): {
  state: WebRTCState;
  actions: WebRTCActions;
  isHost: boolean;
} {
  const [state, setState] = useState<WebRTCState>({
    status: "idle",
    peerId: null,
    remotePeerId: null,
    localStream: null,
    remoteStream: null,
    error: null,
  });
  const [isHost, setIsHost] = useState(false);

  const peerRef = useRef<PeerType | null>(null);
  const activeCallRef = useRef<MediaConnection | null>(null);
  const dataConnRef = useRef<DataConnection | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const remotePeerIdRef = useRef<string | null>(null);

  const setStatus = useCallback((status: ConnectionStatus) => {
    if (!isMountedRef.current) return;
    setState((prev) => ({ ...prev, status }));
  }, []);

  const setError = useCallback((error: string) => {
    if (!isMountedRef.current) return;
    setState((prev) => ({ ...prev, error, status: "failed" }));
  }, []);

  const destroyPeer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (activeCallRef.current) {
      activeCallRef.current.close();
      activeCallRef.current = null;
    }
    if (dataConnRef.current) {
      dataConnRef.current.close();
      dataConnRef.current = null;
    }
    if (peerRef.current && !peerRef.current.destroyed) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
  }, []);

  const handleIncomingCall = useCallback(
    (call: MediaConnection, localStream: MediaStream | null) => {
      activeCallRef.current = call;
      call.answer(localStream ?? undefined);

      call.on("stream", (remoteStream: MediaStream) => {
        if (!isMountedRef.current) return;
        setState((prev) => ({ ...prev, remoteStream, status: "connected" }));
      });

      call.on("close", () => {
        if (!isMountedRef.current) return;
        setState((prev) => ({ ...prev, remoteStream: null, status: "disconnected" }));
      });

      call.on("error", (err: Error) => {
        if (!isMountedRef.current) return;
        setState((prev) => ({ ...prev, error: err.message, status: "failed" }));
      });
    },
    []
  );

  // Initialize the peer on mount
  useEffect(() => {
    isMountedRef.current = true;
    reconnectAttemptsRef.current = 0;

    let localStreamCapture: MediaStream | null = null;

    async function init() {
      if (!isMountedRef.current) return;
      setStatus("connecting");

      try {
        const peer = await createPeer();
        if (!isMountedRef.current) {
          peer.destroy();
          return;
        }
        peerRef.current = peer;

        peer.on("open", async (id: string) => {
          if (!isMountedRef.current) return;

          setState((prev) => ({ ...prev, peerId: id }));

          // Register with the room API
          try {
            const roomRes = await fetch(`/api/rooms/${roomCode}`);
            if (!roomRes.ok) {
              setError("Room not found");
              return;
            }

            const room = (await roomRes.json()) as {
              hostPeerId: string | null;
              guestPeerId: string | null;
              status: string;
            };

            const isHostPlayer = !room.hostPeerId;
            setIsHost(isHostPlayer);

            const patchBody: Record<string, string> = isHostPlayer
              ? { hostPeerId: id }
              : { guestPeerId: id, status: "ready" };

            await fetch(`/api/rooms/${roomCode}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(patchBody),
            });

            if (!isHostPlayer && room.hostPeerId) {
              // Guest knows the host's peer ID
              remotePeerIdRef.current = room.hostPeerId;
              setState((prev) => ({
                ...prev,
                remotePeerId: room.hostPeerId,
              }));
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to register with room";
            setError(msg);
          }
        });

        peer.on("call", (call: MediaConnection) => {
          handleIncomingCall(call, localStreamCapture);
        });

        peer.on("connection", (conn: DataConnection) => {
          dataConnRef.current = conn;
        });

        peer.on("disconnected", () => {
          if (!isMountedRef.current) return;
          setStatus("disconnected");
          if (!peerRef.current?.destroyed) {
            peerRef.current?.reconnect();
          }
        });

        peer.on("error", (err: { type: string; message: string }) => {
          if (!isMountedRef.current) return;

          const retriableTypes = ["network", "server-error"];
          if (
            retriableTypes.includes(err.type) &&
            reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS
          ) {
            reconnectAttemptsRef.current += 1;
            setStatus("disconnected");

            reconnectTimerRef.current = setTimeout(() => {
              if (!isMountedRef.current) return;
              if (!peerRef.current?.destroyed) {
                peerRef.current?.reconnect();
              }
            }, RECONNECT_DELAY_MS);
          } else {
            setError(err.message ?? `PeerJS error: ${err.type}`);
          }
        });

        // Keep a reference to localStream for answering calls
        setState((prev) => {
          localStreamCapture = prev.localStream;
          return prev;
        });
      } catch (err) {
        if (!isMountedRef.current) return;
        const msg = err instanceof Error ? err.message : "Failed to initialize peer";
        setError(msg);
      }
    }

    void init();

    return () => {
      isMountedRef.current = false;
      destroyPeer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  // Actions
  const connect = useCallback((remotePeerId: string) => {
    if (!peerRef.current) return;
    remotePeerIdRef.current = remotePeerId;
    setState((prev) => ({ ...prev, remotePeerId }));
    const conn = peerRef.current.connect(remotePeerId);
    dataConnRef.current = conn;
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await fetch(`/api/rooms/${roomCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      });
    } catch {
      // Best-effort — don't block cleanup
    }

    destroyPeer();

    if (isMountedRef.current) {
      setState({
        status: "idle",
        peerId: null,
        remotePeerId: null,
        localStream: null,
        remoteStream: null,
        error: null,
      });
    }
  }, [roomCode, destroyPeer]);

  const call = useCallback((stream: MediaStream) => {
    const remotePeerId = remotePeerIdRef.current;
    if (!peerRef.current || !remotePeerId) return;

    setState((prev) => ({ ...prev, localStream: stream, status: "connecting" }));

    const mediaCall = peerRef.current.call(remotePeerId, stream);
    activeCallRef.current = mediaCall;

    mediaCall.on("stream", (remoteStream: MediaStream) => {
      if (!isMountedRef.current) return;
      setState((prev) => ({ ...prev, remoteStream, status: "connected" }));
    });

    mediaCall.on("close", () => {
      if (!isMountedRef.current) return;
      setState((prev) => ({ ...prev, remoteStream: null, status: "disconnected" }));
    });

    mediaCall.on("error", (err: Error) => {
      if (!isMountedRef.current) return;
      setState((prev) => ({ ...prev, error: err.message, status: "failed" }));
    });
  }, []);

  const answer = useCallback((stream: MediaStream) => {
    setState((prev) => ({ ...prev, localStream: stream }));
    if (activeCallRef.current) {
      activeCallRef.current.answer(stream);
    }
  }, []);

  const actions: WebRTCActions = { connect, disconnect, call, answer };

  return { state, actions, isHost };
}
