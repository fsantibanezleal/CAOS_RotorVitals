// Live in-browser inference of the heavy learned models, trained OFFLINE on the REAL CWRU bearing data
// (tools/ml/train_models.py) and exported to ONNX. WDCNN = supervised 4-class fault diagnosis on a raw 2048
// window; the deep-AE = a healthy-trained autoencoder whose reconstruction error is a novelty / health
// indicator. These run on the REAL held-out CWRU segments committed in public/rv-cwru-samples.json — this is
// what makes RotorVitals a real application, not a synthetic demo. onnxruntime-web, WASM EP, version-pinned.
import * as ort from 'onnxruntime-web';

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';
ort.env.wasm.numThreads = 1;   // GitHub Pages has no COOP/COEP for threaded WASM

const sessions: Record<string, Promise<ort.InferenceSession>> = {};
const base = () => (import.meta.env.BASE_URL || '/');
const get = (name: string) => (sessions[name] ??= ort.InferenceSession.create(`${base()}${name}`, { executionProviders: ['wasm'] }));

const locks: Record<string, Promise<unknown>> = {};
function serialize<T>(model: string, job: () => Promise<T>): Promise<T> {
  const prev = locks[model] || Promise.resolve();
  const run = prev.then(job);
  locks[model] = run.catch(() => {});
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
