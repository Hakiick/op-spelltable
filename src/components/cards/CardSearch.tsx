"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

export default function CardSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pendingValue, setPendingValue] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayValue =
    pendingValue !== null ? pendingValue : (searchParams.get("search") ?? "");

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setPendingValue(newValue);

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setPendingValue(null);
        const params = new URLSearchParams(searchParams.toString());
        if (newValue) {
          params.set("search", newValue);
        } else {
          params.delete("search");
        }
        params.set("page", "1");
        router.push(`/cards?${params.toString()}`);
      }, 300);
    },
    [router, searchParams]
  );

  return (
    <div className="relative w-full">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z"
          />
        </svg>
      </span>
      <Input
        type="search"
        placeholder="Search cards..."
        value={displayValue}
        onChange={handleChange}
        className="pl-9"
        aria-label="Search cards"
      />
    </div>
  );
}
