import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Auth — OP SpellTable",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4 py-12">
      <div className="mb-8 text-center">
        <Link
          href="/"
          className="text-2xl font-bold tracking-tight text-white hover:text-red-400 transition-colors"
        >
          OP SpellTable
        </Link>
        <p className="mt-1 text-sm text-gray-400">
          One Piece TCG Remote Play
        </p>
      </div>
      {children}
    </div>
  );
}
