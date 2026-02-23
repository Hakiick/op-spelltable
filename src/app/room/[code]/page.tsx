import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getRoomByCode } from "@/lib/database/rooms";
import { validateRoomCode } from "@/lib/webrtc/room-utils";
import RoomClient from "@/components/room/RoomClient";

interface RoomPageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: RoomPageProps): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `Room ${code} — OP SpellTable`,
    description: `One Piece TCG remote play room ${code}.`,
  };
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { code } = await params;

  // Validate format before hitting the database
  if (!validateRoomCode(code)) {
    notFound();
  }

  const room = await getRoomByCode(code);

  if (!room) {
    notFound();
  }

  if (room.status === "closed") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-950 px-4 text-white">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-800">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold">Room Closed</h1>
        <p className="text-center text-gray-400">
          Room <span className="font-mono font-semibold text-white">{code}</span> is no
          longer active.
        </p>
        <Link
          href="/room"
          className="mt-2 inline-flex min-h-[44px] items-center rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Create a new room
        </Link>
      </div>
    );
  }

  return (
    <RoomClient
      room={{
        roomCode: room.roomCode,
        hostPeerId: room.hostPeerId,
        guestPeerId: room.guestPeerId,
        status: room.status as "waiting" | "ready" | "closed",
      }}
    />
  );
}
