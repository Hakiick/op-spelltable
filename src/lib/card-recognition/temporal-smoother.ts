import type { IdentifiedCard } from "@/types/ml";

interface CardTrack {
  bbox: [number, number, number, number];
  history: { cardCode: string; confidence: number }[];
}

const MAX_HISTORY = 5;
const IOU_MATCH_THRESHOLD = 0.3;

function computeIoU(
  a: [number, number, number, number],
  b: [number, number, number, number]
): number {
  const [ax, ay, aw, ah] = a;
  const [bx, by, bw, bh] = b;
  const ix1 = Math.max(ax, bx);
  const iy1 = Math.max(ay, by);
  const ix2 = Math.min(ax + aw, bx + bw);
  const iy2 = Math.min(ay + ah, by + bh);
  const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
  if (inter === 0) return 0;
  const union = aw * ah + bw * bh - inter;
  return union > 0 ? inter / union : 0;
}

export interface TemporalSmoother {
  smooth(cards: IdentifiedCard[]): IdentifiedCard[];
  reset(): void;
}

export function createTemporalSmoother(): TemporalSmoother {
  let tracks: CardTrack[] = [];

  function smooth(cards: IdentifiedCard[]): IdentifiedCard[] {
    const usedTracks = new Set<number>();
    const result: IdentifiedCard[] = [];

    for (const card of cards) {
      const bbox = card.bbox as [number, number, number, number];
      const cardCode = card.cardCode;
      const confidence = card.matchConfidence;

      // Find best matching existing track by IoU
      let bestTrackIdx = -1;
      let bestIoU = 0;
      for (let t = 0; t < tracks.length; t++) {
        if (usedTracks.has(t)) continue;
        const iou = computeIoU(bbox, tracks[t].bbox);
        if (iou > bestIoU) {
          bestIoU = iou;
          bestTrackIdx = t;
        }
      }

      if (bestTrackIdx >= 0 && bestIoU >= IOU_MATCH_THRESHOLD) {
        // Match found — update track
        usedTracks.add(bestTrackIdx);
        const track = tracks[bestTrackIdx];
        track.bbox = bbox;

        if (cardCode) {
          track.history.push({ cardCode, confidence });
          if (track.history.length > MAX_HISTORY) {
            track.history.shift();
          }
        }

        // Vote: accumulate confidence by cardCode
        const votes = new Map<string, number>();
        for (const h of track.history) {
          votes.set(h.cardCode, (votes.get(h.cardCode) ?? 0) + h.confidence);
        }

        // Find winner
        let bestCode: string | null = null;
        let bestScore = 0;
        for (const [code, score] of votes) {
          if (score > bestScore) {
            bestScore = score;
            bestCode = code;
          }
        }

        // Smoothed confidence = average of votes for the winner
        const winnerEntries = track.history.filter(
          (h) => h.cardCode === bestCode
        );
        const smoothedConfidence =
          winnerEntries.length > 0
            ? winnerEntries.reduce((s, h) => s + h.confidence, 0) /
              winnerEntries.length
            : confidence;

        result.push({
          ...card,
          cardCode: bestCode,
          matchConfidence: smoothedConfidence,
        });
      } else {
        // New track
        const newTrack: CardTrack = {
          bbox,
          history: cardCode ? [{ cardCode, confidence }] : [],
        };
        tracks.push(newTrack);
        usedTracks.add(tracks.length - 1);
        result.push(card);
      }
    }

    // Remove stale tracks (not matched for this frame)
    tracks = tracks.filter((_, i) => usedTracks.has(i));

    return result;
  }

  function reset(): void {
    tracks = [];
  }

  return { smooth, reset };
}
