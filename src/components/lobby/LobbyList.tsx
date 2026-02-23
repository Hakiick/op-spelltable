"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { LobbyRoom } from "@/types/lobby";

interface LobbyListProps {
  rooms: LobbyRoom[];
  loading?: boolean;
}

function timeAgo(isoString: string): string {
  const now = Date.now();
  const created = new Date(isoString).getTime();
  const diffSeconds = Math.floor((now - created) / 1000);

  if (diffSeconds < 60) return `il y a ${diffSeconds}s`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `il y a ${diffMinutes}min`;
  const diffHours = Math.floor(diffMinutes / 60);
  return `il y a ${diffHours}h`;
}

function RoomSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-gray-700 bg-gray-800 p-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-4 w-32 rounded bg-gray-700" />
          <div className="h-3 w-24 rounded bg-gray-700" />
        </div>
        <div className="h-10 w-24 rounded bg-gray-700" />
      </div>
    </div>
  );
}

export default function LobbyList({ rooms, loading = false }: LobbyListProps) {
  const router = useRouter();

  if (loading) {
    return (
      <div
        className="flex flex-col gap-3"
        aria-label="Chargement des parties..."
      >
        <RoomSkeleton />
        <RoomSkeleton />
        <RoomSkeleton />
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-gray-700 bg-gray-900 py-12 px-4 text-center">
        <p className="text-gray-400 text-sm">
          Aucune partie disponible — créez-en une !
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-3"
      role="list"
      aria-label="Parties disponibles"
    >
      {rooms.map((room, index) => (
        <Card
          key={room.id}
          className="border-gray-700 bg-gray-800 text-white"
          role="listitem"
        >
          <CardHeader className="pb-1 pt-3 px-4">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base font-semibold leading-tight">
                {room.name ?? `Partie #${index + 1}`}
              </CardTitle>
              <span className="shrink-0 font-mono text-xs text-gray-400">
                {room.roomCode}
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex items-center justify-between px-4 pb-3 pt-1">
            <div className="flex flex-col gap-0.5 text-xs text-gray-400">
              {room.hostName && (
                <span>
                  Hôte : <span className="text-gray-200">{room.hostName}</span>
                </span>
              )}
              <span>{timeAgo(room.createdAt)}</span>
            </div>
            <Button
              size="sm"
              onClick={() => router.push(`/room/${room.roomCode}`)}
              className="min-h-[44px] min-w-[44px] bg-blue-600 hover:bg-blue-700 text-white shrink-0"
              aria-label={`Rejoindre la partie ${room.name ?? room.roomCode}`}
            >
              Rejoindre
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
