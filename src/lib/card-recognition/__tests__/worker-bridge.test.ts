import { describe, it, expect, vi, afterEach } from "vitest";
import { createWorkerBridge } from "../worker-bridge";
import type { WorkerFactory } from "../worker-bridge";
import type { WorkerResponse } from "@/types/ml";

// Mock ImageData since it may not be available in the test environment
class MockImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  colorSpace: PredefinedColorSpace = "srgb";

  constructor(widthOrData: number | Uint8ClampedArray, height: number) {
    if (typeof widthOrData === "number") {
      this.width = widthOrData;
      this.height = height;
      this.data = new Uint8ClampedArray(widthOrData * height * 4);
    } else {
      this.data = widthOrData;
      this.width = widthOrData.length / (height * 4);
      this.height = height;
    }
  }
}

Object.defineProperty(globalThis, "ImageData", {
  value: MockImageData,
  writable: true,
  configurable: true,
});

// Mock the pipeline modules used in fallback mode
vi.mock("../preprocess", () => ({
  preprocessFrame: vi.fn(() => new Float32Array(224 * 224 * 3)),
}));

vi.mock("../reference-db", () => ({
  loadReferenceDatabase: vi.fn().mockResolvedValue({
    embeddings: [],
    cardCount: 0,
    embeddingDim: 576,
    model: "test",
  }),
  findTopCandidates: vi.fn().mockReturnValue([]),
  normalizeEmbedding: vi.fn((v: Float32Array) => v),
}));

// Mock detection module (COCO-SSD)
vi.mock("../detection", () => ({
  initDetectionModel: vi.fn().mockResolvedValue(undefined),
  detectCards: vi.fn().mockResolvedValue([]),
  disposeDetectionModel: vi.fn(),
}));

// Mock TensorFlow.js
vi.mock("@tensorflow/tfjs", () => ({
  loadGraphModel: vi.fn().mockResolvedValue({
    predict: vi.fn().mockReturnValue({
      data: vi.fn().mockResolvedValue(new Float32Array(576)),
      dispose: vi.fn(),
    }),
    dispose: vi.fn(),
  }),
  tensor: vi.fn().mockReturnValue({}),
  tidy: vi.fn((fn: () => unknown) => fn()),
}));

const DEFAULT_CONFIG = {
  confidenceThreshold: 0.75,
  inputSize: 224,
  maxCandidates: 3,
  frameSkip: 5,
};

/** Factory that returns null — simulates no Worker support */
const nullFactory: WorkerFactory = () => null;

/** Factory that creates a mock worker that immediately responds "initialized" */
function createSuccessfulWorkerFactory(): {
  factory: WorkerFactory;
  instance: {
    onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null;
    onerror: ((event: ErrorEvent) => void) | null;
    postMessage: ReturnType<typeof vi.fn>;
    terminate: ReturnType<typeof vi.fn>;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };
} {
  const instance = {
    onmessage: null as ((event: MessageEvent<WorkerResponse>) => void) | null,
    onerror: null as ((event: ErrorEvent) => void) | null,
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  const factory: WorkerFactory = () => {
    // Respond "initialized" asynchronously
    setTimeout(() => {
      if (instance.onmessage) {
        const event = {
          data: { type: "initialized" } as WorkerResponse,
        } as MessageEvent<WorkerResponse>;
        instance.onmessage(event);
      }
    }, 0);

    return instance as unknown as Worker;
  };

  return { factory, instance };
}

/** Factory that creates a mock worker that responds with "error" on init */
function createFailingWorkerFactory(): WorkerFactory {
  return () => {
    const instance = {
      onmessage: null as ((event: MessageEvent<WorkerResponse>) => void) | null,
      onerror: null as ((event: ErrorEvent) => void) | null,
      postMessage: vi.fn(),
      terminate: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    setTimeout(() => {
      if (instance.onmessage) {
        const event = {
          data: { type: "error", message: "Worker init failed" } as WorkerResponse,
        } as MessageEvent<WorkerResponse>;
        instance.onmessage(event);
      }
    }, 0);

    return instance as unknown as Worker;
  };
}

describe("createWorkerBridge", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns correct interface", () => {
    const bridge = createWorkerBridge(nullFactory);

    expect(typeof bridge.initialize).toBe("function");
    expect(typeof bridge.recognize).toBe("function");
    expect(typeof bridge.dispose).toBe("function");
    expect(typeof bridge.isUsingWorker).toBe("function");
  });

  it("isUsingWorker returns false initially", () => {
    const bridge = createWorkerBridge(nullFactory);
    expect(bridge.isUsingWorker()).toBe(false);
  });

  describe("fallback to main thread (null factory)", () => {
    it("falls back to main thread when factory returns null", async () => {
      const bridge = createWorkerBridge(nullFactory);

      await bridge.initialize("http://model.url", "http://embeddings.url");

      expect(bridge.isUsingWorker()).toBe(false);
    });

    it("can recognize using main-thread fallback", async () => {
      const bridge = createWorkerBridge(nullFactory);
      await bridge.initialize("http://model.url", "http://embeddings.url");

      const imageData = new MockImageData(224, 224) as unknown as ImageData;
      const result = await bridge.recognize(imageData, DEFAULT_CONFIG);

      expect(result).toHaveProperty("result");
      expect(result).toHaveProperty("fps");
      expect(result).toHaveProperty("detectedCards");
      expect(typeof result.fps).toBe("number");
    });

    it("recognize returns fps value (number >= 0)", async () => {
      const bridge = createWorkerBridge(nullFactory);
      await bridge.initialize("http://model.url", "http://embeddings.url");

      const imageData = new MockImageData(224, 224) as unknown as ImageData;
      const result = await bridge.recognize(imageData, DEFAULT_CONFIG);

      expect(result.fps).toBeGreaterThanOrEqual(0);
    });

    it("recognize result has the correct shape", async () => {
      const bridge = createWorkerBridge(nullFactory);
      await bridge.initialize("http://model.url", "http://embeddings.url");

      const imageData = new MockImageData(224, 224) as unknown as ImageData;
      const { result } = await bridge.recognize(imageData, DEFAULT_CONFIG);

      expect(result).toHaveProperty("cardCode");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("candidateCount");
      expect(result).toHaveProperty("durationMs");
    });

    it("dispose cleans up without errors", async () => {
      const bridge = createWorkerBridge(nullFactory);
      await bridge.initialize("http://model.url", "http://embeddings.url");

      expect(() => bridge.dispose()).not.toThrow();
      expect(bridge.isUsingWorker()).toBe(false);
    });

    it("dispose can be called without prior initialization", () => {
      const bridge = createWorkerBridge(nullFactory);
      expect(() => bridge.dispose()).not.toThrow();
    });

    it("recognize without initialization returns no-match result with cardCode null", async () => {
      const bridge = createWorkerBridge(nullFactory);
      // Do NOT initialize — fallback model is not ready

      const imageData = new MockImageData(224, 224) as unknown as ImageData;
      const { result } = await bridge.recognize(imageData, DEFAULT_CONFIG);

      expect(result.cardCode).toBeNull();
      expect(result.confidence).toBe(0);
    });
  });

  describe("fallback when worker responds with error", () => {
    it("falls back to main thread when worker sends error response", async () => {
      const bridge = createWorkerBridge(createFailingWorkerFactory());

      await bridge.initialize("http://model.url", "http://embeddings.url");

      expect(bridge.isUsingWorker()).toBe(false);
    });

    it("can still recognize after falling back from failed worker", async () => {
      const bridge = createWorkerBridge(createFailingWorkerFactory());
      await bridge.initialize("http://model.url", "http://embeddings.url");

      const imageData = new MockImageData(224, 224) as unknown as ImageData;
      const { result } = await bridge.recognize(imageData, DEFAULT_CONFIG);

      expect(result).toHaveProperty("cardCode");
    });
  });

  describe("successful worker initialization", () => {
    it("uses worker when factory returns a valid worker that sends initialized", async () => {
      const { factory } = createSuccessfulWorkerFactory();
      const bridge = createWorkerBridge(factory);

      await bridge.initialize("http://model.url", "http://embeddings.url");

      expect(bridge.isUsingWorker()).toBe(true);
    });

    it("dispose terminates the worker", async () => {
      const { factory, instance } = createSuccessfulWorkerFactory();
      const bridge = createWorkerBridge(factory);

      await bridge.initialize("http://model.url", "http://embeddings.url");

      bridge.dispose();

      expect(instance.terminate).toHaveBeenCalled();
    });

    it("dispose resets isUsingWorker to false", async () => {
      const { factory } = createSuccessfulWorkerFactory();
      const bridge = createWorkerBridge(factory);

      await bridge.initialize("http://model.url", "http://embeddings.url");

      bridge.dispose();

      expect(bridge.isUsingWorker()).toBe(false);
    });

    it("dispose sends dispose message to worker before terminating", async () => {
      const { factory, instance } = createSuccessfulWorkerFactory();
      const bridge = createWorkerBridge(factory);

      await bridge.initialize("http://model.url", "http://embeddings.url");

      bridge.dispose();

      // Should have sent the init message and a dispose message
      expect(instance.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "dispose" })
      );
    });
  });
});
