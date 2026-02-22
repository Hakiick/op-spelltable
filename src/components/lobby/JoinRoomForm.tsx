"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function JoinRoomForm() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length > 0) {
      router.push(`/room/${trimmed}`);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (value.length <= 6) {
      setCode(value);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-white">Rejoindre une partie</h2>

      <div className="flex flex-col gap-2">
        <Input
          type="text"
          placeholder="Code (ex: ABC123)"
          value={code}
          onChange={handleCodeChange}
          maxLength={6}
          className="min-h-[44px] bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500 font-mono tracking-widest uppercase"
          aria-label="Code de la partie"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
      </div>

      <Button
        type="submit"
        disabled={code.trim().length === 0}
        className="min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-60"
      >
        Rejoindre
      </Button>
    </form>
  );
}
