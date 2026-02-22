"use client";

import { useEffect, useRef, useState } from "react";
import { useWebRTC } from "@/hooks/useWebRTC";
import WebcamFeed from "@/components/video/WebcamFeed";
import PeerVideo from "@/components/video/PeerVideo";
import ConnectionStatus from "@/components/video/ConnectionStatus";
import { Button } from "@/components/ui/button";
import type { RoomRecord } from "@/types/webrtc";

interface RoomClientProps {
  room: Pick<RoomRecord, "roomCode" | "hostPeerId" | "guestPeerId" | "status">;
}

export default function RoomClient({ room }: RoomClientProps) {
  const { state, actions, isHost } = useWebRTC(room.roomCode);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const hasCalledRef = useRef(false);
  const [copied, setCopied] = useState(false);

  // When we have a local stream AND a remote peer ID → auto-call (host only)
  useEffect(() => {
    if (
      isHost &&
      localStream &&
      state.remotePeerId &&
      !hasCalledRef.current &&
      state.status !== "connected"
    ) {
      hasCalledRef.current = true;
      actions.call(localStream);
    }
  }, [isHost, localStream, state.remotePeerId, state.status, actions]);

  // Guest: when we have a local stream, store it so it's ready to answer
  useEffect(() => {
    if (!isHost && localStream) {
      actions.answer(localStream);
    }
    // Only run when localStream changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream]);

  const handleStream = (stream: MediaStream) => {
    setLocalStream(stream);
    // Also update the state in the hook so it can answer calls
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available — silently ignore
    }
  };

  const handleDisconnect = () => {
    void actions.disconnect();
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-white">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-800 px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold tracking-tight">OP SpellTable</h1>
          <span className="hidden text-gray-500 sm:inline">|</span>
          <span className="hidden text-sm text-gray-400 sm:inline">
            {isHost ? "Host" : "Guest"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <ConnectionStatus status={state.status} error={state.error} />
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDisconnect}
            className="min-h-[44px] min-w-[44px]"
            aria-label="Leave room"
          >
            Leave
          </Button>
        </div>
      </header>

      {/* Room code banner */}
      <div className="flex items-center justify-center gap-3 bg-gray-900 px-4 py-3">
        <span className="text-sm text-gray-400">Room code:</span>
        <span className="font-mono text-2xl font-bold tracking-widest text-white">
          {room.roomCode}
        </span>
        <button
          onClick={() => void handleCopyCode()}
          className="ml-1 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-gray-700 bg-gray-800 px-3 text-sm text-gray-300 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Copy room code"
        >
          {copied ? (
            <span className="text-green-400">Copied!</span>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          )}
        </button>
        <p className="text-xs text-gray-500">Share this code with your opponent</p>
      </div>

      {/* Video grid */}
      <main className="flex flex-1 flex-col gap-4 p-4 md:flex-row md:p-6">
        {/* Local feed */}
        <WebcamFeed
          onStream={handleStream}
          className="aspect-video w-full md:flex-1"
        />

        {/* Remote feed */}
        <PeerVideo
          stream={state.remoteStream}
          label="Opponent"
          className="aspect-video w-full md:flex-1"
        />
      </main>

      {/* Status footer */}
      <footer className="border-t border-gray-800 px-4 py-3 text-center">
        <p className="text-xs text-gray-500">
          {state.status === "idle" && "Waiting for opponent to join..."}
          {state.status === "connecting" && "Establishing connection..."}
          {state.status === "connected" && "Connected — game can begin!"}
          {state.status === "disconnected" && "Connection lost — attempting to reconnect..."}
          {state.status === "failed" && (state.error ?? "Connection failed.")}
        </p>
      </footer>
    </div>
  );
}
