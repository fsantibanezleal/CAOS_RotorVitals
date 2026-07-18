// Live in-browser inference of the heavy learned models, trained offline on the REAL CWRU bearing data
// (tools/ml/train_models.py) and exported to ONNX. WDCNN = supervised 4-class fault diagnosis on a raw 2048
// window; the deep-AE = a healthy-trained autoencoder whose reconstruction error is a novelty / health
// indicator. These run on the REAL held-out CWRU segments committed in public/rv-cwru-samples.json, this is
// what makes RotorVitals a real application, not a synthetic demo. onnxruntime-web, WASM EP, version-pinned.
import * as ort from 'onnxruntime-web';

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';
ort.env.wasm.numThreads = 1;   // GitHub Pages has no COOP/COEP for threaded WASM

const sessions: Record<string, Promise<ort.InferenceSession>> = {};
const base = () => (import.meta.env.BASE_URL || '/');
const get = (name: string) => (sessions[name] ??= ort.InferenceSession.create(`${base()}${name}`, { executionProviders: ['wasm'] }));

// A SINGLE global inference gate across ALL models. The onnxruntime-web WASM EP runs single-threaded
// (numThreads=1), so two session.run() calls overlapping, even on different sessions, throw "Session already
// started". Per-model locks are not enough (e.g. svm + rf via Promise.all overlap). Serializing every run
// globally costs nothing (the runtime can only do one at a time) and removes the race entirely.
let gate: Promise<unknown> = Promise.resolve();
function serialize<T>(_model: string, job: () => Promise<T>): Promise<T> {
  const run = gate.then(job);
  gate = run.catch(() => {});
  return run;
}

/** WDCNN: a raw 2048-sample window → 4 class logits (normal/outer/inner/ball). */
export function wdcnnLogits(window2048: Float32Array): Promise<Float32Array> {
  return serialize('wdcnn.onnx', async () => {
    const s = await get('wdcnn.onnx');
    const out = await s.run({ x: new ort.Tensor('float32', window2048, [1, 1, window2048.length]) });
    return out.logits.data as Float32Array;
  });
}

/** Deep-AE: a standardized 64-D spectral feature → reconstruction (caller computes MSE = health indicator). */
export function aeReconstruct(feat64: Float32Array): Promise<Float32Array> {
  return serialize('rv-ae.onnx', async () => {
    const s = await get('rv-ae.onnx');
    const out = await s.run({ x: new ort.Tensor('float32', feat64, [1, feat64.length]) });
    return out.xr.data as Float32Array;
  });
}

/** Classical-ML classifier (SVM-RBF or Random Forest, skl2onnx): a 10-D physics-informed feature vector → the
 * predicted class index + the 4-class probabilities. The StandardScaler is baked into the ONNX (input is the RAW
 * feature vector). skl2onnx names the input `X` and emits `label` (int64) + `probabilities`. The SVMClassifier /
 * TreeEnsembleClassifier ops run on the WASM EP (ai.onnx.ml). */
function mlClassify(model: string, feat: Float32Array): Promise<{ label: number; probs: number[] }> {
  return serialize(model, async () => {
    const s = await get(model);
    const out = await s.run({ X: new ort.Tensor('float32', feat, [1, feat.length]) });
    return {
      label: Number((out.label.data as ArrayLike<number | bigint>)[0]),
      probs: Array.from(out.probabilities.data as Float32Array, Number),
    };
  });
}
export const svmClassify = (feat: Float32Array) => mlClassify('rv-svm.onnx', feat);
export const rfClassify = (feat: Float32Array) => mlClassify('rv-rf.onnx', feat);

/** CNN-BiLSTM degradation model: sequence of vibration windows → HI curve + RUL.
 *  Single ONNX with two outputs: hi (seq_len,) and rul (scalar).
 *  Trained on XJTU-SY + FEMTO/PRONOSTIA run-to-failure bearings (offline).
 *  References: Muthukumar & Philip (2024), Yang et al. (2024), Guo et al. (2023). */
export async function deepHiRul(sequence: Float32Array[]): Promise<{ hi: Float32Array; rul: number } | null> {
  const seqLen = sequence.length;
  if (seqLen < 2) return null;
  // Build (1, seqLen, 1, 2048) tensor
  const data = new Float32Array(seqLen * 2048);
  for (let i = 0; i < seqLen; i++) {
    const src = sequence[i];
    for (let j = 0; j < 2048; j++) data[i * 2048 + j] = j < src.length ? src[j] : 0;
  }
  return serialize('deep_hi.onnx', async () => {
    const s = await get('deep_hi.onnx');
    const out = await s.run({ vibration_seq: new ort.Tensor('float32', data, [1, seqLen, 1, 2048]) });
    return { hi: out.hi.data as Float32Array, rul: (out.rul.data as Float32Array)[0] };
  });
}
