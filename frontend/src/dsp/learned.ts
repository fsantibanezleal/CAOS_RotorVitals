// The learned tier: load the REAL held-out CWRU segments + the trained-model metrics, and run the heavy ONNX
// models (WDCNN diagnosis, deep-AE health indicator) live in the browser. All inputs here are REAL CWRU
// recordings (public/rv-cwru-samples.json), so the diagnosis the user sees is a real model on real data.
import { wdcnnLogits, aeReconstruct, svmClassify, rfClassify } from '../lib/ort';
// The learned-tier artifact shapes are defined once in the CONTRACT-2 mirror; import for local use + re-export for
// the existing importers (viz components import these from here).
import type { CwruSample, Samples, SnrPoint, Metrics } from '../lib/contract.types';
export type { CwruSample, Samples, SnrPoint, Metrics };

const base = () => (import.meta.env.BASE_URL || '/');
let _samples: Promise<Samples> | null = null;
let _metrics: Promise<Metrics> | null = null;
export const loadSamples = () => (_samples ??= fetch(`${base()}rv-cwru-samples.json`).then((r) => r.json()));
export const loadMetrics = () => (_metrics ??= fetch(`${base()}rv-learned-metrics.json`).then((r) => r.json()));

export function softmax(logits: ArrayLike<number>): number[] {
  let m = -Infinity; for (let i = 0; i < logits.length; i++) m = Math.max(m, logits[i]);
  const e = Array.from(logits, (v) => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}

export interface DiagOut { classes: string[]; probs: number[]; predIdx: number; predClass: string; }

/** WDCNN live diagnosis of a raw 2048 CWRU window. */
export async function diagnoseRaw(raw: number[] | Float32Array, classes: string[]): Promise<DiagOut> {
  const logits = await wdcnnLogits(Float32Array.from(raw));
  const probs = softmax(logits);
  let predIdx = 0; for (let i = 1; i < probs.length; i++) if (probs[i] > probs[predIdx]) predIdx = i;
  return { classes, probs, predIdx, predClass: classes[predIdx] };
}

export interface ClsOut { pred: DiagOut; svm: DiagOut; rf: DiagOut; }

/** The classical-ML supervised baselines (SVM-RBF + Random Forest) live on the same real segment's 10-D feature
 * vector — the classical counterpoint to the deep WDCNN, for a like-for-like deep-vs-classical comparison. */
export async function classifyClassical(clsFeat: number[] | Float32Array, classes: string[]): Promise<{ svm: DiagOut; rf: DiagOut }> {
  const f = Float32Array.from(clsFeat);
  const toOut = (r: { label: number; probs: number[] }): DiagOut => ({ classes, probs: r.probs, predIdx: r.label, predClass: classes[r.label] });
  const [svm, rf] = await Promise.all([svmClassify(f), rfClassify(f)]);
  return { svm: toOut(svm), rf: toOut(rf) };
}

export interface HealthOut { mse: number; threshold: number; isAnomaly: boolean; ratio: number; }

/** Deep-AE reconstruction-error health indicator for a (already standardized) 64-D feature. */
export async function aeHealth(feat: number[] | Float32Array, threshold: number): Promise<HealthOut> {
  const f = Float32Array.from(feat);
  const xr = await aeReconstruct(f);
  let mse = 0; for (let i = 0; i < f.length; i++) { const d = xr[i] - f[i]; mse += d * d; }
  mse /= f.length;
  return { mse, threshold, isAnomaly: mse > threshold, ratio: mse / threshold };
}
