"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { UserAvatar } from "@/components/auth/UserAvatar";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isLoading = status === "loading";

  async function handleSignOut() {
    setDropdownOpen(false);
    await signOut({ callbackUrl: "/" });
  }

  return (
    <nav
      className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-gray-800 bg-gray-950 px-4 md:px-6"
      aria-label="Main navigation"
    >
      {/* Brand */}
      <Link
        href="/"
        className="text-lg font-bold tracking-tight text-white hover:text-red-400 transition-colors"
      >
        OP SpellTable
      </Link>

      {/* Desktop right side */}
      <div className="hidden md:flex items-center gap-3">
        {isLoading ? (
          <div className="h-8 w-8 animate-pulse rounded-full bg-gray-700" />
        ) : session?.user ? (
          <div className="relative">
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-gray-800 transition-colors min-h-11"
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
              aria-label="User menu"
            >
              <UserAvatar
                name={session.user.name}
                avatarUrl={session.user.image ?? null}
                size="sm"
              />
              <span className="text-sm text-gray-200">{session.user.name}</span>
            </button>

            {dropdownOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setDropdownOpen(false)}
                  aria-hidden="true"
                />
                <div
                  className="absolute right-0 top-full z-20 mt-1 w-48 rounded-md border border-gray-700 bg-gray-900 py-1 shadow-lg"
                  role="menu"
                >
                  <Link
                    href="/profile"
                    className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-800 transition-colors"
                    role="menuitem"
                    onClick={() => setDropdownOpen(false)}
                  >
                    Profile
                  </Link>
                  <button
                    onClick={() => void handleSignOut()}
                    className="block w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-800 transition-colors"
                    role="menuitem"
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <Button
            asChild
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white min-h-9"
          >
            <Link href="/auth/login">Login</Link>
          </Button>
        )}
      </div>

      {/* Mobile hamburger */}
      <div className="flex md:hidden">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-11 w-11 items-center justify-center rounded-md text-gray-300 hover:bg-gray-800 transition-colors"
          aria-expanded={menuOpen}
          aria-label="Toggle mobile menu"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            {menuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="absolute inset-x-0 top-14 z-50 border-b border-gray-800 bg-gray-950 px-4 py-3 md:hidden">
          {isLoading ? null : session?.user ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3 px-2 py-2">
                <UserAvatar
                  name={session.user.name}
                  avatarUrl={session.user.image ?? null}
                  size="sm"
                />
                <span className="text-sm text-gray-200">{session.user.name}</span>
              </div>
              <Link
                href="/profile"
                className="block rounded-md px-2 py-2 text-sm text-gray-200 hover:bg-gray-800 transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                Profile
              </Link>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  void signOut({ callbackUrl: "/" });
                }}
                className="block w-full rounded-md px-2 py-2 text-left text-sm text-gray-200 hover:bg-gray-800 transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="block rounded-md px-2 py-2 text-sm text-gray-200 hover:bg-gray-800 transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              Login
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
