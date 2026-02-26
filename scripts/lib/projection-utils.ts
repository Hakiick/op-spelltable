/**
 * Utilities for loading and saving projection weights.
 */

import fs from "fs";

export interface ProjectionWeightsData {
  inputDim: number;
  outputDim: number;
  weights: number[];
}

export function saveProjectionWeights(
  filePath: string,
  inputDim: number,
  outputDim: number,
  weights: Float32Array
): void {
  const data: ProjectionWeightsData = {
    inputDim,
    outputDim,
    weights: Array.from(weights),
  };
  fs.writeFileSync(filePath, JSON.stringify(data));
  const sizeKb = (fs.statSync(filePath).size / 1024).toFixed(0);
  console.log(`Projection weights saved: ${filePath} (${sizeKb} KB)`);
}

export function loadProjectionFromFile(
  filePath: string
): ProjectionWeightsData | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as ProjectionWeightsData;
}
