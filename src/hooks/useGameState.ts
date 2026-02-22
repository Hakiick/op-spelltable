"use client";

import { useReducer, useCallback } from "react";
import type { GamePhase } from "@/types/game";
import { getNextPhase } from "@/lib/game-state/phases";

export interface UseGameStateReturn {
  // Phase
  phase: GamePhase;
  turnNumber: number;
  nextPhase: () => void;

  // DON!! counter (local player)
  donActive: number;
  donRested: number;
  donDeck: number;
  activateDon: () => void;
  restDon: () => void;
  unrestDon: () => void;
  unrestAllDon: () => void;

  // Life (local player)
  lifeCards: boolean[]; // true = face-down, false = revealed
  revealLife: (index: number) => void;
  loseLife: () => void;

  // Reset
  resetForNewGame: (leaderLife: number) => void;
}

interface GameLocalState {
  phase: GamePhase;
  turnNumber: number;
  donDeck: number;
  donActive: number;
  donRested: number;
  lifeCards: boolean[];
}

type GameAction =
  | { type: "NEXT_PHASE" }
  | { type: "ACTIVATE_DON" }
  | { type: "REST_DON" }
  | { type: "UNREST_DON" }
  | { type: "UNREST_ALL_DON" }
  | { type: "REVEAL_LIFE"; index: number }
  | { type: "LOSE_LIFE" }
  | { type: "RESET"; leaderLife: number };

function gameReducer(state: GameLocalState, action: GameAction): GameLocalState {
  switch (action.type) {
    case "NEXT_PHASE": {
      const nextPhase = getNextPhase(state.phase);
      let { donDeck, donActive, donRested, turnNumber } = state;

      // Refresh phase side-effect: unrest all DON!!
      if (state.phase === "refresh") {
        donActive = donActive + donRested;
        donRested = 0;
      }

      // DON!! phase side-effect: activate 2 from deck
      if (state.phase === "don") {
        const take = Math.min(2, donDeck);
        donDeck = donDeck - take;
        donActive = donActive + take;
      }

      // End of turn: advance turn counter
      if (state.phase === "end") {
        turnNumber = turnNumber + 1;
      }

      return { ...state, phase: nextPhase, donDeck, donActive, donRested, turnNumber };
    }

    case "ACTIVATE_DON": {
      if (state.donDeck <= 0) return state;
      return {
        ...state,
        donDeck: state.donDeck - 1,
        donActive: state.donActive + 1,
      };
    }

    case "REST_DON": {
      if (state.donActive <= 0) return state;
      return {
        ...state,
        donActive: state.donActive - 1,
        donRested: state.donRested + 1,
      };
    }

    case "UNREST_DON": {
      if (state.donRested <= 0) return state;
      return {
        ...state,
        donRested: state.donRested - 1,
        donActive: state.donActive + 1,
      };
    }

    case "UNREST_ALL_DON": {
      return {
        ...state,
        donActive: state.donActive + state.donRested,
        donRested: 0,
      };
    }

    case "REVEAL_LIFE": {
      const { index } = action;
      if (index < 0 || index >= state.lifeCards.length) return state;
      const next = [...state.lifeCards];
      next[index] = false;
      return { ...state, lifeCards: next };
    }

    case "LOSE_LIFE": {
      if (state.lifeCards.length === 0) return state;
      return { ...state, lifeCards: state.lifeCards.slice(0, -1) };
    }

    case "RESET": {
      return {
        phase: "refresh",
        turnNumber: 1,
        donDeck: 10,
        donActive: 0,
        donRested: 0,
        lifeCards: Array(action.leaderLife).fill(true) as boolean[],
      };
    }

    default:
      return state;
  }
}

function createInitialState(leaderLife: number): GameLocalState {
  return {
    phase: "refresh",
    turnNumber: 1,
    donDeck: 10,
    donActive: 0,
    donRested: 0,
    lifeCards: Array(leaderLife).fill(true) as boolean[],
  };
}

export function useGameState(initialLeaderLife = 5): UseGameStateReturn {
  const [state, dispatch] = useReducer(
    gameReducer,
    initialLeaderLife,
    createInitialState
  );

  const nextPhase = useCallback(() => dispatch({ type: "NEXT_PHASE" }), []);
  const activateDon = useCallback(() => dispatch({ type: "ACTIVATE_DON" }), []);
  const restDon = useCallback(() => dispatch({ type: "REST_DON" }), []);
  const unrestDon = useCallback(() => dispatch({ type: "UNREST_DON" }), []);
  const unrestAllDon = useCallback(() => dispatch({ type: "UNREST_ALL_DON" }), []);
  const revealLife = useCallback(
    (index: number) => dispatch({ type: "REVEAL_LIFE", index }),
    []
  );
  const loseLife = useCallback(() => dispatch({ type: "LOSE_LIFE" }), []);
  const resetForNewGame = useCallback(
    (leaderLife: number) => dispatch({ type: "RESET", leaderLife }),
    []
  );

  return {
    phase: state.phase,
    turnNumber: state.turnNumber,
    nextPhase,
    donActive: state.donActive,
    donRested: state.donRested,
    donDeck: state.donDeck,
    activateDon,
    restDon,
    unrestDon,
    unrestAllDon,
    lifeCards: state.lifeCards,
    revealLife,
    loseLife,
    resetForNewGame,
  };
}
