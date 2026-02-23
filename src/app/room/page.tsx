"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface CreateRoomResponse {
  roomCode: string;
}

export default function RoomPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const handleCreateRoom = async () => {
    setIsCreating(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error("Failed to create room");
      }

      const data = (await res.json()) as CreateRoomResponse;
      router.push(`/room/${data.roomCode}`);
    } catch {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError("");

    const code = joinCode.trim().toUpperCase();

    if (!/^[A-Z0-9]{6}$/.test(code)) {
      setJoinError("Room code must be exactly 6 alphanumeric characters.");
      return;
    }

    setIsJoining(true);
    router.push(`/room/${code}`);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-950 px-4 py-8">
      {/* Title */}
      <div className="mb-2 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white">
          OP SpellTable
        </h1>
        <p className="mt-2 text-gray-400">
          Play One Piece TCG remotely with a friend
        </p>
      </div>

      <div className="flex w-full max-w-md flex-col gap-4">
        {/* Create room card */}
        <Card className="border-gray-800 bg-gray-900 text-white">
          <CardHeader>
            <CardTitle className="text-lg">Create a Room</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-400">
              Start a new game session. Share the generated room code with your
              opponent.
            </p>
          </CardContent>
          <CardFooter>
            <Button
              onClick={() => void handleCreateRoom()}
              disabled={isCreating}
              className="min-h-[44px] w-full bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-60"
              aria-label="Create a new room"
            >
              {isCreating ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Creating...
                </span>
              ) : (
                "Create Room"
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Divider */}
        <div className="relative flex items-center">
          <div className="flex-1 border-t border-gray-800" />
          <span className="mx-4 text-xs uppercase tracking-widest text-gray-600">
            or
          </span>
          <div className="flex-1 border-t border-gray-800" />
        </div>

        {/* Join room card */}
        <Card className="border-gray-800 bg-gray-900 text-white">
          <CardHeader>
            <CardTitle className="text-lg">Join a Room</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-gray-400">
              Enter the 6-character room code your opponent shared with you.
            </p>
            <form onSubmit={handleJoinRoom} className="flex flex-col gap-3">
              <Input
                type="text"
                placeholder="ABC123"
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value.toUpperCase());
                  setJoinError("");
                }}
                maxLength={6}
                autoComplete="off"
                spellCheck={false}
                className="min-h-[44px] font-mono text-lg tracking-widest uppercase bg-gray-800 border-gray-700 text-white placeholder-gray-600 focus:border-blue-500"
                aria-label="Room code"
                aria-describedby={joinError ? "join-error" : undefined}
              />
              {joinError && (
                <p
                  id="join-error"
                  className="text-xs text-red-400"
                  role="alert"
                >
                  {joinError}
                </p>
              )}
              <Button
                type="submit"
                disabled={isJoining || joinCode.length === 0}
                className="min-h-[44px] w-full border border-gray-700 bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-60"
                variant="outline"
                aria-label="Join room"
              >
                {isJoining ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Joining...
                  </span>
                ) : (
                  "Join Room"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <p className="mt-4 text-xs text-gray-600">
        Peer-to-peer connection — your streams are never stored on our servers.
      </p>
    </div>
  );
}
