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
        <div className="flex gap-4">
          <button className="rounded-lg bg-red-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-red-700">
            Play Now
          </button>
          <button className="rounded-lg border border-gray-300 px-6 py-3 font-semibold transition-colors hover:bg-gray-50">
            Browse Cards
          </button>
        </div>
      </main>
    </div>
  );
}
