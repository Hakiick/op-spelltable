/**
 * Temporal smoothing for card recognition.
 *
 * Tracks cards across frames by IoU matching on bounding boxes.
 * Accumulates card code votes in a sliding window and outputs
 * EMA-weighted consensus predictions with smoothed bboxes.
 *
 * This stabilizes per-frame predictions that fluctuate between
 * correct and wrong matches.
 */

import type { IdentifiedCard } from "@/types/ml";

/** Number of frames in the voting window */
const WINDOW_SIZE = 5;
/** Card must appear in at least this many frames before emitting a code */
const MIN_FRAMES_FOR_CODE = 2;
/** Card is evicted after being missing for this many consecutive frames */
const MAX_MISSING_FRAMES = 3;
/** Minimum IoU overlap to match a detection to a tracked card */
const IOU_MATCH_THRESHOLD = 0.3;
/** EMA smoothing factor for bbox position (0=no smoothing, 1=no memory) */
const BBOX_SMOOTHING_ALPHA = 0.4;
/** EMA decay factor for vote weighting (recent frames weighted higher) */
const EMA_DECAY = 0.7;

interface Vote {
  cardCode: string | null;
  matchConfidence: number;
  frameIndex: number;
}

interface TrackedCard {
  /** Smoothed bbox [x, y, w, h] */
  bbox: [number, number, number, number];
  /** YOLO detection confidence (latest) */
  detectionConfidence: number;
  /** Sliding window of votes */
  votes: Vote[];
  /** Consecutive frames where this card was not matched */
  missingFrames: number;
  /** Total number of frames this card has been tracked */
  totalFrames: number;
}

export interface TemporalSmootherConfig {
  windowSize?: number;
  minFramesForCode?: number;
  maxMissingFrames?: number;
  iouMatchThreshold?: number;
  bboxSmoothingAlpha?: number;
  emaDecay?: number;
}

export interface TemporalSmoother {
  update(identifiedCards: IdentifiedCard[]): IdentifiedCard[];
  reset(): void;
}

/**
 * Computes Intersection over Union between two bboxes [x, y, w, h].
 */
function computeIoU(
  a: [number, number, number, number],
  b: [number, number, number, number]
): number {
  const [ax, ay, aw, ah] = a;
  const [bx, by, bw, bh] = b;

  const x1 = Math.max(ax, bx);
  const y1 = Math.max(ay, by);
  const x2 = Math.min(ax + aw, bx + bw);
  const y2 = Math.min(ay + ah, by + bh);

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (intersection === 0) return 0;

  const union = aw * ah + bw * bh - intersection;
  if (union <= 0) return 0;

  return intersection / union;
}

/**
 * Smooths a bbox toward a new observation using EMA.
 */
function smoothBbox(
  current: [number, number, number, number],
  observed: [number, number, number, number],
  alpha: number
): [number, number, number, number] {
  return [
    current[0] + alpha * (observed[0] - current[0]),
    current[1] + alpha * (observed[1] - current[1]),
    current[2] + alpha * (observed[2] - current[2]),
    current[3] + alpha * (observed[3] - current[3]),
  ];
}

/**
 * Computes EMA-weighted consensus from a vote window.
 * Returns the card code with the highest weighted score,
 * plus the smoothed confidence.
 */
function computeConsensus(
  votes: Vote[],
  emaDecay: number
): { cardCode: string | null; confidence: number } {
  if (votes.length === 0) {
    return { cardCode: null, confidence: 0 };
  }

  // Weight each vote by recency: most recent gets weight 1.0,
  // each step back decays by emaDecay factor
  const maxFrame = Math.max(...votes.map((v) => v.frameIndex));
  const weightedScores = new Map<string, number>();
  let totalWeight = 0;

  for (const vote of votes) {
    if (vote.cardCode === null) continue;
    const age = maxFrame - vote.frameIndex;
    const weight = Math.pow(emaDecay, age);
    const current = weightedScores.get(vote.cardCode) ?? 0;
    weightedScores.set(
      vote.cardCode,
      current + weight * vote.matchConfidence
    );
    totalWeight += weight;
  }

  if (weightedScores.size === 0 || totalWeight === 0) {
    return { cardCode: null, confidence: 0 };
  }

  // Pick the code with highest weighted score
  let bestCode: string | null = null;
  let bestScore = 0;
  for (const [code, score] of weightedScores) {
    if (score > bestScore) {
      bestScore = score;
      bestCode = code;
    }
  }

  // Normalize confidence by total weight for a meaningful [0,1] range
  const confidence = totalWeight > 0 ? bestScore / totalWeight : 0;

  return { cardCode: bestCode, confidence };
}

export function createTemporalSmoother(
  config?: TemporalSmootherConfig
): TemporalSmoother {
  const windowSize = config?.windowSize ?? WINDOW_SIZE;
  const minFramesForCode = config?.minFramesForCode ?? MIN_FRAMES_FOR_CODE;
  const maxMissingFrames = config?.maxMissingFrames ?? MAX_MISSING_FRAMES;
  const iouMatchThreshold = config?.iouMatchThreshold ?? IOU_MATCH_THRESHOLD;
  const bboxSmoothingAlpha =
    config?.bboxSmoothingAlpha ?? BBOX_SMOOTHING_ALPHA;
  const emaDecay = config?.emaDecay ?? EMA_DECAY;

  let trackedCards: TrackedCard[] = [];
  let frameCounter = 0;

  function update(identifiedCards: IdentifiedCard[]): IdentifiedCard[] {
    frameCounter++;

    // Mark all tracked cards as missing this frame initially
    for (const tracked of trackedCards) {
      tracked.missingFrames++;
    }

    // Greedy IoU matching: for each new detection, find the best tracked match
    const matched = new Set<number>(); // indices into trackedCards
    const outputCards: IdentifiedCard[] = [];

    for (const card of identifiedCards) {
      let bestIoU = 0;
      let bestIdx = -1;

      for (let i = 0; i < trackedCards.length; i++) {
        if (matched.has(i)) continue;
        const iou = computeIoU(trackedCards[i].bbox, card.bbox);
        if (iou > bestIoU) {
          bestIoU = iou;
          bestIdx = i;
        }
      }

      if (bestIdx >= 0 && bestIoU >= iouMatchThreshold) {
        // Matched to existing tracked card
        const tracked = trackedCards[bestIdx];
        matched.add(bestIdx);

        tracked.missingFrames = 0;
        tracked.totalFrames++;
        tracked.detectionConfidence = card.confidence;
        tracked.bbox = smoothBbox(
          tracked.bbox,
          card.bbox,
          bboxSmoothingAlpha
        );

        // Add vote
        tracked.votes.push({
          cardCode: card.cardCode,
          matchConfidence: card.matchConfidence,
          frameIndex: frameCounter,
        });

        // Trim window
        if (tracked.votes.length > windowSize) {
          tracked.votes.shift();
        }

        // Compute consensus
        const consensus = computeConsensus(tracked.votes, emaDecay);

        // Debounce: require minimum frames before emitting a code
        const emitCode = tracked.totalFrames >= minFramesForCode;

        outputCards.push({
          bbox: [...tracked.bbox],
          confidence: tracked.detectionConfidence,
          cardCode: emitCode ? consensus.cardCode : null,
          matchConfidence: emitCode ? consensus.confidence : 0,
          candidates: emitCode && consensus.cardCode ? card.candidates : [],
        });
      } else {
        // New card — start tracking
        const newTracked: TrackedCard = {
          bbox: [...card.bbox],
          detectionConfidence: card.confidence,
          votes: [
            {
              cardCode: card.cardCode,
              matchConfidence: card.matchConfidence,
              frameIndex: frameCounter,
            },
          ],
          missingFrames: 0,
          totalFrames: 1,
        };
        trackedCards.push(newTracked);

        // Emit code only if minFramesForCode allows it on first frame
        const emitOnFirst = minFramesForCode <= 1;
        outputCards.push({
          bbox: [...card.bbox],
          confidence: card.confidence,
          cardCode: emitOnFirst ? card.cardCode : null,
          matchConfidence: emitOnFirst ? card.matchConfidence : 0,
          candidates: emitOnFirst ? card.candidates : [],
        });
      }
    }

    // Evict cards that have been missing too long
    trackedCards = trackedCards.filter(
      (t) => t.missingFrames <= maxMissingFrames
    );

    return outputCards;
  }

  function reset(): void {
    trackedCards = [];
    frameCounter = 0;
  }

  return { update, reset };
}
