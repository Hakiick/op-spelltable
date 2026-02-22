import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <main className="flex flex-col items-center gap-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          OP SpellTable
        </h1>
        <p className="max-w-md text-lg text-gray-600">
          Play the One Piece Trading Card Game remotely via webcam with
          real-time card recognition.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Link
            href="/lobby"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-red-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Jouer maintenant
          </Link>
          <Link
            href="/cards"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-gray-300 px-6 py-3 font-semibold transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Parcourir les cartes
          </Link>
        </div>
      </main>
    </div>
  );
}
