/**
 * ONNX Runtime Web abstraction for MobileNetV3 Large feature extraction.
 *
 * Loads the ONNX model via WASM backend and provides a simple inference API.
 * Same pattern as detection.ts for ONNX session management.
 *
 * Input: Float32Array in NCHW format, ImageNet-normalized
 * Output: Float32Array of 1280-dim embedding
 */

// ---------------------------------------------------------------------------
// ONNX Runtime types (dynamically imported)
// ---------------------------------------------------------------------------

interface OrtTensor {
  data: Float32Array | Int32Array | Uint8Array;
  dims: readonly number[];
  dispose(): void;
}

interface OrtTensorCtor {
  new (type: string, data: Float32Array, dims: readonly number[]): OrtTensor;
}

interface OrtSession {
  run(feeds: Record<string, OrtTensor>): Promise<Record<string, OrtTensor>>;
  release(): Promise<void>;
}

interface OrtModule {
  InferenceSession: {
    create(
      path: string | ArrayBuffer,
      options?: Record<string, unknown>
    ): Promise<OrtSession>;
  };
  Tensor: OrtTensorCtor;
  env: { wasm: { wasmPaths?: string; numThreads?: number } };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface OnnxFeatureModel {
  /** Run inference on preprocessed NCHW input. Returns 1280-dim embedding. */
  run(input: Float32Array, inputSize: number): Promise<Float32Array>;
  /** Release ONNX session resources. */
  dispose(): void;
}

/**
 * Load a MobileNetV3 ONNX model for feature extraction.
 *
 * @param modelUrl Path to the .onnx model file (e.g., /ml/mobilenet_v3_large.onnx)
 * @returns OnnxFeatureModel with run() and dispose() methods
 */
export async function loadOnnxModel(
  modelUrl: string
): Promise<OnnxFeatureModel> {
  console.log("[OnnxModel] Importing onnxruntime-web...");
  const ort = (await import("onnxruntime-web")) as unknown as OrtModule;

  // Serve WASM files locally for faster loading (no CDN round-trip).
  // Files are copied from node_modules/onnxruntime-web/dist/ to public/ml/wasm/.
  // In Worker context (blob: origin), relative paths don't resolve — derive the
  // origin from the model URL which is already absolute when passed from the bridge.
  let wasmBase = "/ml/wasm/";
  try {
    const origin = new URL(modelUrl).origin;
    if (origin && origin !== "null") {
      wasmBase = origin + "/ml/wasm/";
    }
  } catch {
    // modelUrl is relative — we're on main thread, relative path is fine
  }
  ort.env.wasm.wasmPaths = wasmBase;
  ort.env.wasm.numThreads = 1;

  console.log(
    "[OnnxModel] Creating session from %s (wasm: %s)...",
    modelUrl,
    wasmBase
  );
  const session = await ort.InferenceSession.create(modelUrl, {
    executionProviders: ["wasm"],
  });
  console.log("[OnnxModel] Session created successfully");

  return {
    async run(input: Float32Array, inputSize: number): Promise<Float32Array> {
      const inputTensor = new ort.Tensor("float32", input, [
        1,
        3,
        inputSize,
        inputSize,
      ]);

      const feeds: Record<string, OrtTensor> = { input: inputTensor };
      const results = await session.run(feeds);

      const outputKey = Object.keys(results)[0];
      const output = results[outputKey];
      const embedding = new Float32Array(output.data as Float32Array);

      inputTensor.dispose();
      output.dispose();

      return embedding;
    },

    dispose(): void {
      void session.release();
    },
  };
}
