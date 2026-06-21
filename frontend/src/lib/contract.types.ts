// CONTRACT 2 mirror (frontend side). MUST stay in lock-step with the Python schemas in
// data-pipeline/rotorlab/core/{trace.py, manifest.py}. A drift here makes `tsc` fail -> the contract is enforced at
// BUILD time (the web cannot ship reading a shape the pipeline does not produce). This file is also the single
// source of truth for the learned-tier artifact shapes (rv-cwru-samples.json / rv-learned-metrics.json).

// ---------- learned-tier shared artifacts (rv-cwru-samples.json / rv-learned-metrics.json) ----------

export interface CwruSample {
  cls: string;
  raw: number[];
  feat: number[];
}

export interface Samples {
  fs: number;
  win: number;
  classes: string[];
  samples: CwruSample[];
}

export interface SnrPoint {
  snrDb: number | null;
  accuracy: number;
}

export interface Metrics {
  dataset: string;
  nTrain: number;
  nTest: number;
  split: string;
  wdcnn: { accuracy: number; perClass: Record<string, number>; confusion: number[][]; classes: string[]; snrCurve: SnrPoint[] };
  deepAE: { thresholdP99: number; faultVsHealthyAUC: number | null; healthyFalseFlagRate: number; trainedOn?: string };
  aeScaler: { mean: number[]; std: number[] };
  honesty: string;
}

// ---------- per-case replay trace (rotorvitals.trace/v1) ----------

export interface DiagnosisPayload {
  classes: string[];
  fault_type: string;
  segment_refs: number[]; // indices into rv-cwru-samples.json (no raw copy)
  n_segments: number;
  wdcnn: { per_class_recall: number | null; confusion_row: number[]; accuracy: number };
  deep_ae: { threshold_p99: number; fault_vs_healthy_auc: number | null; healthy_false_flag_rate: number | null };
}
export interface RobustnessPayload { snr_curve: SnrPoint[]; }
export interface ClassicalPayload {
  method: string; confusion: number[][]; row_recall: number[]; accuracy: number; n: number; classes: string[];
}
export interface SyntheticPayload { fault_type: string; planted_mult: number | null; fr_hz: number; defect_hz: number | null; }
export interface PrognosticsPayload {
  fault_type: string; onset: number; t: number[]; hi: number[];
  rul_est_norm: number; t_fail_est: number; true_fail_norm: number;
}
export type TracePayload =
  | DiagnosisPayload | RobustnessPayload | ClassicalPayload | SyntheticPayload | PrognosticsPayload;

export interface CaseTrace {
  schema: string; // "rotorvitals.trace/v1"
  case_id: string;
  category: string;
  kind: 'diagnosis' | 'robustness' | 'classical' | 'synthetic' | 'prognostics';
  real_or_synthetic: string;
  expected_band: string;
  payload: TracePayload;
}

// ---------- manifest (rotorvitals.manifest/v2) + index ----------

export interface ArtifactRef { path: string; format: string; trace_schema: string; bytes: number; }

export interface GateVerdict {
  lane: string;
  client_side: boolean;
  runtimes: string[];
  trace_bytes: number;
  run_ms_budget: number;
  trace_bytes_budget: number;
  reasons: string[];
}

export interface SharedArtifacts {
  models: Array<{ id: string; file: string; opset: number; input: number[] }>;
  samples: string;
  learned_metrics: string;
  classical_metrics: string;
}

export interface CaseManifest {
  schema: string; // "rotorvitals.manifest/v2"
  case_id: string;
  category: string;
  kind: string;
  fault_type: string;
  real_or_synthetic: string;
  expected_band: string;
  validation_anchor: string;
  engine: { package: string; version: string; model: string };
  dataset: string;
  split: string;
  seed: number;
  shared: SharedArtifacts;
  artifact: ArtifactRef;
  lane: 'live' | 'precompute';
  gate: GateVerdict;
  flags: Array<Record<string, unknown>>;
  metrics: Record<string, number>;
  honesty: string;
}

export interface CaseIndexEntry { case_id: string; category: string; kind: string; manifest_path: string; }

export interface CaseIndex {
  schema: string; // "rotorvitals.index/v1"
  engine_version: string;
  dataset: string;
  n_cases: number;
  cases: CaseIndexEntry[];
}
