"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";

interface CardFiltersProps {
  sets: { code: string; name: string }[];
}

const COLORS = ["Red", "Green", "Blue", "Purple", "Black", "Yellow"] as const;
const TYPES = ["Leader", "Character", "Event", "Stage"] as const;
const RARITIES = ["C", "UC", "R", "SR", "SEC", "L"] as const;
const COSTS = Array.from({ length: 11 }, (_, i) => i);

const selectClass =
  "min-h-[44px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50";

export default function CardFilters({ sets }: CardFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.set("page", "1");
      router.push(`/cards?${params.toString()}`);
    },
    [router, searchParams]
  );

  const clearAll = useCallback(() => {
    const search = searchParams.get("search");
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    router.push(`/cards?${params.toString()}`);
  }, [router, searchParams]);

  const hasFilters =
    searchParams.has("color") ||
    searchParams.has("type") ||
    searchParams.has("set") ||
    searchParams.has("cost") ||
    searchParams.has("rarity");

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex w-full flex-col gap-1 sm:w-auto">
        <label htmlFor="filter-color" className="text-xs font-medium text-gray-600">
          Color
        </label>
        <select
          id="filter-color"
          className={selectClass}
          value={searchParams.get("color") ?? ""}
          onChange={(e) => updateParam("color", e.target.value)}
          aria-label="Filter by color"
        >
          <option value="">All colors</option>
          {COLORS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="flex w-full flex-col gap-1 sm:w-auto">
        <label htmlFor="filter-type" className="text-xs font-medium text-gray-600">
          Type
        </label>
        <select
          id="filter-type"
          className={selectClass}
          value={searchParams.get("type") ?? ""}
          onChange={(e) => updateParam("type", e.target.value)}
          aria-label="Filter by type"
        >
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="flex w-full flex-col gap-1 sm:w-auto">
        <label htmlFor="filter-set" className="text-xs font-medium text-gray-600">
          Set
        </label>
        <select
          id="filter-set"
          className={selectClass}
          value={searchParams.get("set") ?? ""}
          onChange={(e) => updateParam("set", e.target.value)}
          aria-label="Filter by set"
        >
          <option value="">All sets</option>
          {sets.map((s) => (
            <option key={s.code} value={s.code}>
              {s.code} — {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex w-full flex-col gap-1 sm:w-auto">
        <label htmlFor="filter-cost" className="text-xs font-medium text-gray-600">
          Cost
        </label>
        <select
          id="filter-cost"
          className={selectClass}
          value={searchParams.get("cost") ?? ""}
          onChange={(e) => updateParam("cost", e.target.value)}
          aria-label="Filter by cost"
        >
          <option value="">Any cost</option>
          {COSTS.map((c) => (
            <option key={c} value={String(c)}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="flex w-full flex-col gap-1 sm:w-auto">
        <label htmlFor="filter-rarity" className="text-xs font-medium text-gray-600">
          Rarity
        </label>
        <select
          id="filter-rarity"
          className={selectClass}
          value={searchParams.get("rarity") ?? ""}
          onChange={(e) => updateParam("rarity", e.target.value)}
          aria-label="Filter by rarity"
        >
          <option value="">All rarities</option>
          {RARITIES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {hasFilters && (
        <div className="flex w-full items-end sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={clearAll}
            className="min-h-[44px] min-w-[44px]"
          >
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
