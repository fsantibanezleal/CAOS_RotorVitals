// Load the committed CONTRACT-2 records (overlaid into public/data by copy-data.mjs). Same shapes as the pipeline
// produces (contract.types.ts). The SPA's live diagnosis still fetches the shared ONNX + samples from the site root
// (lib/ort.ts, dsp/learned.ts); this module exposes the per-case manifest/trace index for the App's case selector.
import type { CaseIndex, CaseManifest, CaseTrace } from '../lib/contract.types';

const base = () => import.meta.env.BASE_URL || '/';

async function getJSON<T>(rel: string): Promise<T> {
  const res = await fetch(`${base()}data/${rel}`);
  if (!res.ok) throw new Error(`fetch ${rel}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const loadIndex = (): Promise<CaseIndex> => getJSON<CaseIndex>('manifests/index.json');
export const loadManifest = (caseId: string): Promise<CaseManifest> =>
  getJSON<CaseManifest>(`manifests/${caseId}.json`);
export const loadTrace = (artifactPath: string): Promise<CaseTrace> => getJSON<CaseTrace>(artifactPath);
