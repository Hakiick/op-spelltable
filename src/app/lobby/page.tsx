"use client";

import { useLobby } from "@/hooks/useLobby";
import CreateRoomForm from "@/components/lobby/CreateRoomForm";
import JoinRoomForm from "@/components/lobby/JoinRoomForm";
import LobbyList from "@/components/lobby/LobbyList";
import { Button } from "@/components/ui/button";

export default function LobbyPage() {
  const { rooms, loading, error, refetch } = useLobby();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Lobby</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={refetch}
            className="min-h-[44px] border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white"
            aria-label="Actualiser la liste des parties"
          >
            Actualiser
          </Button>
        </div>

        {/* Create + Join forms — side by side on md+, stacked on mobile */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-gray-700 bg-gray-900 p-5">
            <CreateRoomForm />
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-900 p-5">
            <JoinRoomForm />
          </div>
        </div>

        {/* Public rooms list */}
        <section aria-labelledby="lobby-list-title">
          <div className="mb-4 flex items-center gap-2">
            <h2 id="lobby-list-title" className="text-xl font-semibold">
              Parties publiques
            </h2>
            {!loading && (
              <span className="rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-300">
                {rooms.length}
              </span>
            )}
          </div>

          {error ? (
            <div
              className="rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-300"
              role="alert"
            >
              {error}
            </div>
          ) : (
            <LobbyList rooms={rooms} loading={loading} />
          )}
        </section>
      </div>
    </div>
  );
}
