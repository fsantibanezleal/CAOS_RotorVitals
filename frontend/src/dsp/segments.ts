// Unified REAL diagnosis-segment sources for the App's segment mode. Three measured datasets with different native
// schemas are adapted to one shape so the same signal-analysis tools + the WDCNN run on any of them:
//   - CWRU   : 12 kHz drive-end, classes normal/inner/outer/ball — the WDCNN's NATIVE domain (in-domain inference).
//   - Ottawa : time-VARYING speed, computed-ORDER-TRACKED (orders domain); classes healthy/inner/outer. The WDCNN
//              runs CROSS-DOMAIN on a 12 kHz time window (rawWdcnn).
//   - MaFaulDa: 50 kHz constant-speed; classes outer/ball/cage. WDCNN runs CROSS-DOMAIN on a 12.5 kHz window; the
//              cage class has no CWRU counterpart (WDCNN truth-check skipped).
// Raw archives stay offline; only the compact public/rv-*-samples.json artifacts are fetched.
import { type Bearing } from './bearing';
import { loadSamples } from './learned';

export interface SegSample {
  cls: string;          // ground-truth class (dataset vocabulary)
  label: string;        // dropdown display
  raw: number[];        // the signal the analysis tools run on (native domain — time samples or order samples)
  rawWdcnn?: number[];  // a 12–12.5 kHz time window for the WDCNN (in/cross-domain); falls back to raw for CWRU
  rpm?: number;
  meta?: string;        // a short metadata line for the sidebar
}

export interface SegDataset {
  key: 'cwru' | 'ottawa' | 'mafaulda';
  label: string;
  fs: number;                 // Hz, or samples-per-revolution when domain==='orders'
  domain: 'time' | 'orders';
  classes: string[];
  bearing: Bearing;           // kinematic geometry → defect frequencies (Hz at fr, or orders when domain==='orders')
  rpm: number;                // a nominal shaft rpm for the fr readout (orders datasets use 60 so fr=1 → orders)
  wdcnnMode: 'in' | 'cross' | 'none'; // CWRU=in-domain; Ottawa/MaFaulDa=cross-domain; (none if a model can't apply)
  wdcnnClasses: Record<string, string | null>; // dataset class → CWRU WDCNN class (null = no counterpart)
  samples: SegSample[];
}

// Bearing geometry registered per dataset (n balls, ball dia, pitch dia, contact angle deg).
const CWRU_BEARING: Bearing = { id: 'skf6205', label: 'SKF 6205 (CWRU DE)', n: 9, d: 7.94, D: 39.04, contactDeg: 0 };
const OTTAWA_BEARING: Bearing = { id: 'er-16k', label: 'ER-16K (Ottawa)', n: 9, d: 7.94, D: 38.52, contactDeg: 0 };
const MAFAULDA_BEARING: Bearing = { id: 'mafaulda', label: 'SpectraQuest ABVT', n: 8, d: 7.145, D: 28.519, contactDeg: 0 };

const BASE = () => (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL || '/';

async function fetchJson(file: string): Promise<Record<string, unknown> | null> {
  try { const r = await fetch(`${BASE()}${file}`); return r.ok ? await r.json() : null; } catch { return null; }
}

// CWRU comes from the existing learned-pipeline artifact (carries the per-segment WDCNN input already).
async function cwruDataset(): Promise<SegDataset | null> {
  const s = await loadSamples().catch(() => null);
  if (!s || !s.samples?.length) return null;
  return {
    key: 'cwru', label: 'CWRU', fs: s.fs || 12000, domain: 'time', classes: s.classes,
    bearing: CWRU_BEARING, rpm: s.rpm ?? 1730, wdcnnMode: 'in',
    wdcnnClasses: Object.fromEntries(s.classes.map((c: string) => [c, c])),
    samples: s.samples.map((sm: { cls: string; file?: number; seg: number; raw: number[] }) => ({ cls: sm.cls, label: `${sm.cls} · ${sm.file ?? ''} #${sm.seg}`, raw: sm.raw, rawWdcnn: sm.raw, rpm: s.rpm, meta: `CWRU 6205 · ${s.rpm ?? 1730} rpm` })),
  };
}

async function ottawaDataset(): Promise<SegDataset | null> {
  const d = await fetchJson('rv-ottawa-samples.json');
  const samples = (d?.samples as Array<Record<string, unknown>>) ?? [];
  if (!samples.length) return null;
  return {
    key: 'ottawa', label: 'Ottawa', fs: (d?.fs as number) ?? 2048, domain: 'orders',
    classes: (d?.classes as string[]) ?? ['healthy', 'inner', 'outer'], bearing: OTTAWA_BEARING, rpm: 60, wdcnnMode: 'cross',
    wdcnnClasses: { healthy: 'normal', inner: 'inner', outer: 'outer' },
    samples: samples.map((sm) => ({
      cls: sm.cls as string,
      label: `${sm.cls} · ${sm.condName ?? sm.cond} #${sm.trial ?? ''}`,
      raw: sm.raw as number[],
      rawWdcnn: sm.rawTime as number[],
      rpm: Math.round(((sm.rpmMin as number) + (sm.rpmMax as number)) / 2),
      meta: `Ottawa ER-16K · órdenes · ${Math.round(sm.rpmMin as number)}–${Math.round(sm.rpmMax as number)} rpm`,
    })),
  };
}

async function mafauldaDataset(): Promise<SegDataset | null> {
  const d = await fetchJson('rv-mafaulda-samples.json');
  const samples = (d?.samples as Array<Record<string, unknown>>) ?? [];
  if (!samples.length) return null;
  return {
    key: 'mafaulda', label: 'MaFaulDa', fs: (d?.fs as number) ?? 50000, domain: 'time',
    classes: (d?.classes as string[]) ?? ['outer', 'ball', 'cage'], bearing: MAFAULDA_BEARING, rpm: 0, wdcnnMode: 'cross',
    wdcnnClasses: (d?.wdcnnClasses as Record<string, string | null>) ?? { outer: 'outer', ball: 'ball', cage: null },
    samples: samples.map((sm) => ({
      cls: sm.cls as string,
      label: `${sm.cls} · ${sm.position ?? ''} · ${Math.round(sm.rpm as number)} rpm`,
      raw: sm.raw as number[],
      rawWdcnn: sm.rawWdcnn as number[],
      rpm: Math.round(sm.rpm as number),
      meta: `MaFaulDa · ${sm.position ?? ''} · ${sm.loadG ?? 0} g · ${Math.round(sm.rpm as number)} rpm`,
    })),
  };
}

let _segs: Promise<SegDataset[]> | null = null;
// All available real segment datasets, in selector order (CWRU first — the WDCNN's native domain).
export function loadSegmentDatasets(): Promise<SegDataset[]> {
  return (_segs ??= Promise.all([cwruDataset(), ottawaDataset(), mafauldaDataset()]).then((ds) => ds.filter((x): x is SegDataset => !!x)));
}
