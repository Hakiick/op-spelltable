"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useCamera } from "@/hooks/useCamera";
import WebcamFeed from "@/components/video/WebcamFeed";
import PeerVideo from "@/components/video/PeerVideo";
import ConnectionStatus from "@/components/video/ConnectionStatus";
import CameraSetup from "@/components/video/CameraSetup";
import VideoLayout from "@/components/video/VideoLayout";
import { Button } from "@/components/ui/button";
import type { RoomRecord } from "@/types/webrtc";

interface RoomClientProps {
  room: Pick<RoomRecord, "roomCode" | "hostPeerId" | "guestPeerId" | "status">;
}

interface RoomDetailResponse {
  id: string;
  roomCode: string;
}

export default function RoomClient({ room }: RoomClientProps) {
  const router = useRouter();
  const { state, actions, isHost } = useWebRTC(room.roomCode);
  const camera = useCamera();
  const hasCalledRef = useRef(false);
  // CRITIQUE-3: guard to prevent double-answer on stream changes
  const hasAnsweredRef = useRef(false);
  const [copied, setCopied] = useState(false);
  // CRITIQUE-2: store timeout ID so we can clear it on unmount
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // CRITIQUE-1: mute state
  const [isMuted, setIsMuted] = useState(false);
  const [launchLoading, setLaunchLoading] = useState(false);

  // Start camera on mount
  useEffect(() => {
    void camera.startCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // CRITIQUE-2: clear the copy timeout on unmount to prevent state updates after unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  // When we have a local stream AND a remote peer ID → auto-call (host only)
  useEffect(() => {
    if (
      isHost &&
      camera.stream &&
      state.remotePeerId &&
      !hasCalledRef.current &&
      state.status !== "connected"
    ) {
      hasCalledRef.current = true;
      actions.call(camera.stream);
    }
  }, [isHost, camera.stream, state.remotePeerId, state.status, actions]);

  // CRITIQUE-3: Guest: answer only once. hasAnsweredRef prevents double-answer
  // on subsequent stream changes (e.g. device switch / resolution change).
  useEffect(() => {
    if (!isHost && camera.stream && !hasAnsweredRef.current) {
      hasAnsweredRef.current = true;
      actions.answer(camera.stream);
    }
    // Only run when camera.stream changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera.stream]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.roomCode);
      setCopied(true);
      // CRITIQUE-2: store the timeout ID so it can be cleared on unmount
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available — silently ignore
    }
  };

  const handleDisconnect = async () => {
    camera.stopCamera();
    await actions.disconnect();
    router.push("/lobby");
  };

  // CRITIQUE-1: Toggle mute by enabling/disabling audio tracks on the stream
  const handleToggleMute = () => {
    if (camera.stream) {
      camera.stream.getAudioTracks().forEach((track) => {
        track.enabled = isMuted; // if currently muted → enable; if unmuted → disable
      });
    }
    setIsMuted((prev) => !prev);
  };

  // Launch game: PATCH room status to "playing", then navigate to /game/[id]
  const handleLaunchGame = async () => {
    setLaunchLoading(true);
    try {
      // PATCH status to "playing"
      await fetch(`/api/rooms/${room.roomCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "playing" }),
      });

      // GET room to retrieve id
      const response = await fetch(`/api/rooms/${room.roomCode}`);
      if (response.ok) {
        const data = (await response.json()) as RoomDetailResponse;
        router.push(`/game/${data.id}`);
      }
    } catch {
      // Navigation failure is non-blocking
      setLaunchLoading(false);
    }
  };

  const localFeed = (
    <WebcamFeed
      stream={camera.stream}
      mirror={camera.settings.mirror}
      className="h-full w-full"
    />
  );

  const remoteFeed = (
    <PeerVideo
      stream={state.remoteStream}
      label="Opponent"
      className="h-full w-full"
    />
  );

  const statusBar = (
    <ConnectionStatus status={state.status} error={state.error} />
  );

  const controls = (
    <>
      {/* Launch game button — only when connected */}
      {state.status === "connected" && (
        <Button
          variant="default"
          size="sm"
          onClick={() => void handleLaunchGame()}
          disabled={launchLoading}
          className="min-h-[44px] min-w-[44px] bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-60"
          aria-label="Lancer la partie"
        >
          {launchLoading ? "Lancement..." : "Lancer la partie"}
        </Button>
      )}
      {/* CRITIQUE-1: Mute/unmute button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleToggleMute}
        className="min-h-[44px] min-w-[44px] border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white"
        aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
        aria-pressed={isMuted}
      >
        {isMuted ? (
          // Microphone-off icon
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
              d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
            />
          </svg>
        ) : (
          // Microphone icon
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
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        )}
      </Button>
      <CameraSetup
        devices={camera.devices}
        settings={camera.settings}
        stream={camera.stream}
        onUpdateSettings={camera.updateSettings}
        onApply={camera.startCamera}
      />
      <Button
        variant="destructive"
        size="sm"
        onClick={handleDisconnect}
        className="min-h-[44px] min-w-[44px]"
        aria-label="Leave room"
      >
        Leave
      </Button>
    </>
  );

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
      <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <VideoLayout
          localFeed={localFeed}
          remoteFeed={remoteFeed}
          statusBar={statusBar}
          controls={controls}
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
