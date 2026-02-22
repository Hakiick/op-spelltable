"use client";

import { useState, useCallback, useRef } from "react";
import type { CardData } from "@/types/card";

export interface UseCardDetailReturn {
  card: CardData | null;
  loading: boolean;
  error: string | null;
  isOpen: boolean;
  open: (cardCode: string) => void;
  close: () => void;
}

export function useCardDetail(): UseCardDetailReturn {
  const [card, setCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const open = useCallback((cardCode: string) => {
    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsOpen(true);
    setCard(null);
    setError(null);
    setLoading(true);

    fetch(`/api/cards/${encodeURIComponent(cardCode)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("Card not found.");
          }
          throw new Error(`Failed to load card (${res.status}).`);
        }
        const json = (await res.json()) as { data: CardData };
        return json.data;
      })
      .then((data) => {
        setCard(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") {
          // Request was cancelled — do nothing
          return;
        }
        const message =
          err instanceof Error ? err.message : "Failed to load card.";
        setError(message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const close = useCallback(() => {
    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsOpen(false);
    setCard(null);
    setError(null);
    setLoading(false);
  }, []);

  return { card, loading, error, isOpen, open, close };
}
