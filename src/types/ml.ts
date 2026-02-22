export interface RecognitionResult {
  cardCode: string;
  confidence: number; // [0, 1]
  candidateCount: number;
  durationMs: number;
}

export interface RecognitionNoMatch {
  cardCode: null;
  confidence: number;
  candidateCount: number;
  durationMs: number;
}

export type RecognitionOutput = RecognitionResult | RecognitionNoMatch;

export interface EmbeddingEntry {
  cardCode: string;
  embedding: number[];
}

export interface ReferenceEmbedding {
  cardCode: string;
  embedding: Float32Array;
}

export interface EmbeddingDatabase {
  version: string;
  model: string;
  embeddingDim: number;
  cardCount: number;
  generatedAt: string;
  entries: EmbeddingEntry[];
}

export interface RecognitionConfig {
  confidenceThreshold: number; // default: 0.75
  inputSize: number; // 224
  maxCandidates: number; // 3
  frameSkip: number; // 5
}

export type PipelineStatus =
  | "idle"
  | "loading"
  | "ready"
  | "processing"
  | "error";

export interface CardRecognitionState {
  status: PipelineStatus;
  lastResult: RecognitionOutput | null;
  topCandidates: RecognitionResult[];
  error: string | null;
  isActive: boolean;
  loadingProgress: number;
}

export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}
