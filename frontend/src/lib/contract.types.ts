// CONTRACT 2 mirror (frontend side). must stay in lock-step with the Python schemas in
// data-pipeline/rotorlab/core/{trace.py, manifest.py}. A drift here makes `tsc` fail -> the contract is enforced at
// BUILD time (the web cannot ship reading a shape the pipeline does not produce). This file is also the single
// source of truth for the learned-tier artifact shapes (rv-cwru-samples.json / rv-learned-metrics.json).

// ---------- learned-tier shared artifacts (rv-cwru-samples.json / rv-learned-metrics.json) ----------

export interface CwruSample {
  cls: string;
  raw: number[];
  feat: number[];
  clsFeat?: number[]; // the 10-D physics-informed feature vector for the classical-ML (SVM/RF) ONNX
  file?: number; // the source CWRU recording (held-out 3 HP file for this class)
  seg?: number;  // 1-based ordinal of this segment within its class
  sizeIn?: number; // T4: fault diameter in inches (0.014/0.021), present only for the cross-severity segments
  caseId?: string; // T4/T13: the case this segment belongs to (e.g. dx-inner-014-3hp, mfpt-outer-2)
  dataset?: string; // T13: "MFPT" for the cross-dataset (different-rig) segments; absent for CWRU
  emb?: number[]; // T14: the WDCNN's 100-D penultimate learned feature, for the feature-space embedding
}

export interface Samples {
  fs: number;
  win: number;
  classes: string[];
  samples: CwruSample[];
  loadHp?: number;
  rpm?: number;
  clsFeatures?: string[]; // names of the classical-ML feature vector (order matches clsFeat)
  sourceFiles?: Record<string, number>; // class -> held-out CWRU file number
  severityFiles?: Record<string, number>; // T4: "{class}-{sizeTag}" -> CWRU file (e.g. "inner-014" -> 172)
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
  // T12: the classical-ML supervised baselines (SVM-RBF + Random Forest), same leakage-safe held-out split.
  classicalML?: {
    features: string[]; nTest: number; classes: string[]; note?: string;
    svm: { accuracy: number; perClass: Record<string, number>; confusion: number[][] };
    rf: { accuracy: number; perClass: Record<string, number>; confusion: number[][] };
  };
  // T4: cross-severity generalization, WDCNN/SVM/RF/env-SES on unseen 0.014"/0.021" fault sizes (trained only on
  // 0.007"), at the held-out 3 HP load. The honest "is the App a toy?" answer.
  crossSeverity?: {
    trainedOn: string; evaluatedAt: string; sizesIn: number[]; methods: string[]; note: string;
    rows: Array<{
      fault: string; sizeIn: number; file: number; isNew: boolean; nWin: number;
      wdcnn: number; svm: number; rf: number; env: number; wdcnnDist: Record<string, number>;
    }>;
    byMethodBySize: Record<string, Record<string, number>>; // method -> { "007"|"014"|"021" -> accuracy }
  };
  // T13: cross-dataset generalization, the CWRU-trained WDCNN vs unsupervised envelope/SES on MFPT (a different
  // rig). The domain-shift test: learned features are rig-specific, physics is rig-agnostic.
  crossDataset?: {
    dataset: string; trainedOn: string; classes: string[]; note: string;
    kinematics: {
      cwru: { bearing: string; BPFO: number; BPFI: number; fsHz: number };
      mfpt: { bearing: string; BPFO: number; BPFI: number; fsHz: number | string };
    };
    wdcnn: { recall: Record<string, number>; overall: number; dist: Record<string, Record<string, number>> };
    classical: { recall: Record<string, number>; overall: number; method: string };
    perFile: Array<{ file: string; class: string; fs: number; rate: number; nWin: number; bpfoHz: number; bpfiHz: number }>;
  };
  // T15: leakage demonstration, window-overlap leakage quantified two ways on one frozen pool (the CWRU
  // window-overlap trap, Hendriks et al. 2022). (1) overlapIsolated, the clean number: a purge/embargo control on
  // the same random test set (load + class held constant) where overlapping train neighbours are removed, so the
  // gain isolates the leak. (2) naiveVsProduction, an upper bound: the naive random split vs the production grouped
  // split, which also charges the grouped arm a 3 HP load-generalization penalty, so it is not pure leakage. Real
  // fitted-model numbers; ships integrity controls.
  leakage?: {
    purpose: string; pool: string; nWindows: number; win: number; hop: number; overlapPct: number;
    classes: string[]; seedSplit: number; seedModel: number; nSeeds: number; testFractionPct: number;
    overlapIsolated: {
      method: string; nTest: number; nSeeds: number;
      svm: { withOverlapAcc: number; withOverlapStd: number; purgedAcc: number; purgedStd: number; isolatedPts: number; withOverlapPerClass: Record<string, number>; purgedPerClass: Record<string, number> };
      rf: { withOverlapAcc: number; withOverlapStd: number; purgedAcc: number; purgedStd: number; isolatedPts: number; withOverlapPerClass: Record<string, number>; purgedPerClass: Record<string, number> };
      wdcnn: { withOverlapAcc: number; purgedAcc: number; isolatedPts: number; saturates: boolean };
    };
    naiveVsProduction: {
      note: string;
      splits: {
        leaky: { name: string; grouped: boolean; ratio: string; nSeeds: number; nTrain: number; nTest: number };
        honest: { name: string; grouped: boolean; heldOutRecordings: number[]; heldOutLoadHp: number; nTrain: number; nTest: number };
      };
      svm: { leakyAcc: number; leakyStd: number; honestAcc: number; gapPts: number; leakyPerClass: Record<string, number>; honestPerClass: Record<string, number>; leakyConfusion: number[][]; honestConfusion: number[][] };
      rf: { leakyAcc: number; leakyStd: number; honestAcc: number; gapPts: number; leakyPerClass: Record<string, number>; honestPerClass: Record<string, number>; leakyConfusion: number[][]; honestConfusion: number[][] };
      wdcnn: { leakyAcc: number; honestAcc: number; gapPts: number; saturatesHonest: boolean; leakyPerClass: Record<string, number>; honestPerClass: Record<string, number>; leakyConfusion: number[][]; honestConfusion: number[][] };
    };
    controls: {
      shuffledLabelPlumbing: { seed: number; leakyWdcnn: number; honestWdcnn: number; expectChance: number; pass: boolean; note: string };
      overlapWindowsSharedTrainTest: { leaky: number; honest: number };
      classBalance: { leakyTestClassFrac: Record<string, number>; honestTestClassFrac: Record<string, number>; maxAbsDiff: number; balancedOk: boolean; note: string };
      honestVsProduction: { productionHoldout3HP: number; honestT15Wdcnn: number; deltaPts: number; consistent: boolean };
    };
    note: string; caveat: string;
    refs: Array<{ label: string; doi?: string }>;
  };
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
