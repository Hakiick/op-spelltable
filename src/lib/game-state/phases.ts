import type { GamePhase } from "@/types/game";

export const PHASES: GamePhase[] = ["refresh", "draw", "don", "main", "end"];

export function getNextPhase(current: GamePhase): GamePhase {
  const idx = PHASES.indexOf(current);
  return PHASES[(idx + 1) % PHASES.length];
}

export function getPhaseLabel(phase: GamePhase): string {
  const labels: Record<GamePhase, string> = {
    refresh: "Refresh",
    draw: "Draw",
    don: "DON!!",
    main: "Main",
    end: "End",
  };
  return labels[phase];
}

export function getPhaseDescription(phase: GamePhase): string {
  const descriptions: Record<GamePhase, string> = {
    refresh: "Unrest all your DON!! cards and characters.",
    draw: "Draw 1 card from your deck.",
    don: "Add 2 DON!! cards from your DON!! deck to your cost area.",
    main: "Play cards, attack, and use effects.",
    end: "End your turn. Pass to opponent.",
  };
  return descriptions[phase];
}
