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
export async function loadOnnxModel(modelUrl: string): Promise<OnnxFeatureModel> {
  const ort = (await import("onnxruntime-web")) as unknown as OrtModule;

  ort.env.wasm.wasmPaths =
    "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.2/dist/";
  ort.env.wasm.numThreads = 1;

  const session = await ort.InferenceSession.create(modelUrl, {
    executionProviders: ["wasm"],
  });

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
