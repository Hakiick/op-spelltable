"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CreateRoomResponse {
  roomCode: string;
}

export default function CreateRoomForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          isPublic,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create room");
      }

      const data = (await response.json()) as CreateRoomResponse;
      router.push(`/room/${data.roomCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-white">Créer une partie</h2>

      <div className="flex flex-col gap-2">
        <Input
          type="text"
          placeholder="Nom de la partie"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={64}
          className="min-h-[44px] bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:border-red-500 focus:ring-red-500"
          aria-label="Nom de la partie"
          disabled={loading}
        />
      </div>

      <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="h-5 w-5 rounded border-gray-600 bg-gray-800 text-red-500 focus:ring-red-500 cursor-pointer"
          aria-label="Partie publique"
          disabled={loading}
        />
        <span className="text-sm text-gray-300">Partie publique (visible dans le lobby)</span>
      </label>

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="min-h-[44px] bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-60"
      >
        {loading ? "Création..." : "Créer une partie"}
      </Button>
    </form>
  );
}
