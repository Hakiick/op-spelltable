import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createCardRecognizer } from "../identify";

// Mock ONNX model to avoid real model loading in tests
vi.mock("../onnx-model", () => ({
  loadOnnxModel: vi.fn(),
}));

// Mock the reference-db module
vi.mock("../reference-db", () => ({
  loadReferenceDatabase: vi.fn(),
  findTopCandidates: vi.fn(),
  normalizeEmbedding: vi.fn((v: Float32Array) => v),
}));

// Mock capture and preprocess
vi.mock("../capture", () => ({
  captureFrame: vi.fn(),
}));

vi.mock("../preprocess", () => ({
  preprocessFrame: vi.fn(),
}));

describe("createCardRecognizer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a recognizer with isReady=false initially", () => {
    const recognizer = createCardRecognizer();
    expect(recognizer.isReady).toBe(false);
  });

  it("exposes the required interface", () => {
    const recognizer = createCardRecognizer();
    expect(typeof recognizer.isReady).toBe("boolean");
    expect(typeof recognizer.initialize).toBe("function");
    expect(typeof recognizer.recognize).toBe("function");
    expect(typeof recognizer.dispose).toBe("function");
  });

  it("returns isReady=false before initialize is called", () => {
    const recognizer = createCardRecognizer();
    expect(recognizer.isReady).toBe(false);
  });

  it("dispose sets isReady to false", async () => {
    const mockModel = {
      run: vi.fn().mockResolvedValue(new Float32Array(1280)),
      dispose: vi.fn(),
    };
    const mockDb = {
      embeddings: [],
      cardCount: 0,
      embeddingDim: 1280,
      model: "test",
    };

    const { loadOnnxModel } = await import("../onnx-model");
    const { loadReferenceDatabase } = await import("../reference-db");

    vi.mocked(loadOnnxModel).mockResolvedValue(mockModel);
    vi.mocked(loadReferenceDatabase).mockResolvedValue(
      mockDb as unknown as Awaited<ReturnType<typeof loadReferenceDatabase>>
    );

    const recognizer = createCardRecognizer();
    await recognizer.initialize("http://model.url", "http://db.url");

    recognizer.dispose();

    expect(recognizer.isReady).toBe(false);
    expect(mockModel.dispose).toHaveBeenCalled();
  });

  it("recognize returns no-match when not initialized", async () => {
    const recognizer = createCardRecognizer();
    const mockVideo = {} as HTMLVideoElement;

    const result = await recognizer.recognize(mockVideo, {
      confidenceThreshold: 0.75,
      inputSize: 224,
      maxCandidates: 3,
      frameSkip: 5,
      maxIdentify: 5,
    });

    expect(result.cardCode).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.candidateCount).toBe(0);
  });

  it("recognize returns no-match when captureFrame returns null", async () => {
    const { captureFrame } = await import("../capture");
    const { loadReferenceDatabase } = await import("../reference-db");
    const { loadOnnxModel } = await import("../onnx-model");

    const mockModel = {
      run: vi.fn().mockResolvedValue(new Float32Array(1280)),
      dispose: vi.fn(),
    };
    const mockDb = {
      embeddings: [],
      cardCount: 0,
      embeddingDim: 1280,
      model: "test",
    };

    vi.mocked(loadOnnxModel).mockResolvedValue(mockModel);
    vi.mocked(loadReferenceDatabase).mockResolvedValue(
      mockDb as unknown as Awaited<ReturnType<typeof loadReferenceDatabase>>
    );
    vi.mocked(captureFrame).mockReturnValue(null);

    const recognizer = createCardRecognizer();
    await recognizer.initialize("http://model.url", "http://db.url");

    const mockVideo = {} as HTMLVideoElement;
    const result = await recognizer.recognize(mockVideo, {
      confidenceThreshold: 0.75,
      inputSize: 224,
      maxCandidates: 3,
      frameSkip: 5,
      maxIdentify: 5,
    });

    expect(result.cardCode).toBeNull();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("sets isReady=true after successful initialize", async () => {
    const { loadOnnxModel } = await import("../onnx-model");
    const { loadReferenceDatabase } = await import("../reference-db");

    const mockModel = {
      run: vi.fn().mockResolvedValue(new Float32Array(1280)),
      dispose: vi.fn(),
    };
    const mockDb = {
      embeddings: [],
      cardCount: 0,
      embeddingDim: 1280,
      model: "test",
    };

    vi.mocked(loadOnnxModel).mockResolvedValue(mockModel);
    vi.mocked(loadReferenceDatabase).mockResolvedValue(
      mockDb as unknown as Awaited<ReturnType<typeof loadReferenceDatabase>>
    );

    const recognizer = createCardRecognizer();
    await recognizer.initialize("http://model.url", "http://db.url");

    expect(recognizer.isReady).toBe(true);
  });
});
