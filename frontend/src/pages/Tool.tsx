import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type uPlot from 'uplot';
import { Tabs, useShellLang } from '@fasl-work/caos-app-shell';
import { synth, type SignalSpec, type Signal } from '../dsp/signal';
import { magSpectrum, envelopeSpectrum } from '../dsp/envelope';
import { kurtogram } from '../dsp/kurtogram';
import { gramGrid } from '../dsp/infogram';
import { diagnose } from '../dsp/diagnose';
import { ISO_CLASSES, framesToLifeFeats } from '../dsp/iso';
import { defectFreqs, faultFreq, type FaultKind } from '../dsp/bearing';
import { BEARINGS, bearingById } from '../data/bearings';
import { SCENARIOS } from '../data/scenarios';
import { runToFailure, loadRealRtf, loadRealFrames, femtoToRunToFailure, RTF_SETS, type FemtoTraj, type FrameSet } from '../data/runtofailure';
import { diagnoseRaw, type DiagOut } from '../dsp/learned';
import { loadSegmentDatasets, type SegDataset } from '../dsp/segments';
import { projectRUL } from '../dsp/health';
import { type RulModel } from '../dsp/rul_models';
import { particleFilterRUL } from '../dsp/pf_rul';
import { gpRUL } from '../dsp/gp_rul';
import { deepRul } from '../lib/ort';
import { UPlotChart } from '../viz/UPlotChart';
import { lineOpts, combsPlugin, regionsPlugin, vmarksPlugin, selectPlugin, type Comb } from '../viz/uplotKit';
import { minMaxDecimate } from '../viz/decimate';
import { Kurtogram } from '../viz/Kurtogram';
import { Gauge } from '../viz/Gauge';
import { RulChart } from '../viz/RulChart';
import { Heatmap2D } from '../viz/Heatmap2D';
import { CampbellPanel } from '../viz/CampbellPanel';
import { GramPanel } from '../viz/GramPanel';
import { CscPanel } from '../viz/CscPanel';
import { IsoTrendPanel } from '../viz/IsoTrendPanel';
import { FeatureSpacePanel } from '../viz/FeatureSpacePanel';
import { PrognosticEvalPanel } from '../viz/PrognosticEvalPanel';
import { RecommendationPanel } from '../viz/RecommendationPanel';
import { DegradationReplayController } from '../viz/DegradationReplayController';
import { buildLifeSnapshots, interpHI } from '../dsp/replay';
import { PeakTable } from '../viz/PeakTable';
import { PanelBoundary } from '../viz/PanelBoundary';
import { realCepstrum } from '../dsp/cepstrum';
import { spectrogram } from '../dsp/spectrogram';

// lazy-load three.js (the 3D waterfall) so it ships in its own chunk, off the main bundle
const Waterfall3D = lazy(() => import('../viz/Waterfall3D').then((m) => ({ default: m.Waterfall3D })));

const FAULTS: FaultKind[] = ['healthy', 'outer', 'inner', 'ball'];
const C = { outer: '#f59f00', inner: '#f06595', ball: '#7c5cff', shaft: '#3fb950', band: '#58a6ff', outlier: '#f85149', window: '#d29922' };
const FS = 12000;
// XJTU-SY test bearing (LDK UER204) — the one run-to-failure set with published geometry, so its envelope/SES and
// cyclostationary tabs can mark real fault frequencies. FEMTO/IMS publish none → those run without order markers.
const XJTU_BEARING = { id: 'ldk-uer204', label: 'LDK UER204 (XJTU-SY)', n: 8, d: 7.92, D: 34.55, contactDeg: 0 };
const NO_GEOM = { ftf: NaN, bpfo: NaN, bpfi: NaN, bsf: NaN }; // unknown geometry → no fault-frequency markers drawn

const T = {
  en: { bearing: 'Bearing', fault: 'Planted fault', severity: 'Severity', rpm: 'Shaft speed (rpm)', snr: 'SNR (dB)',
    diag: 'Diagnosis', conf: 'confidence', sev: 'Fault severity index', band: 'Demod band', clickKg: 'Click a kurtogram cell to set the band → SES updates live.',
    f_healthy: 'Healthy', f_outer: 'Outer race (BPFO)', f_inner: 'Inner race (BPFI)', f_ball: 'Ball (2·BSF)',
    tSig: 'Signal & spectrum', tEnv: 'Envelope · SES', tKur: 'Kurtogram', tGram: 'Infogram', tCam: 'Campbell / order', tRul: 'Prognostics · RUL', tEval: 'RUL eval', tIso: 'ISO trend', tFeat: 'Feature space', tWat: '3D waterfall', tSpec: 'Spectrogram', tRec: 'Recommendation · report', cep: 'Cepstrum (1/fr · 1/BPFO rahmonics marked)', spectroT: 'STFT spectrogram (dB) — hover reads (t,f,dB); box = demod band', spectroNote: 'Time-frequency: WHEN and in which band the impulsive fault energy appears (confirms stationarity).', tCsc: 'Cyclostationary', cscT: 'Fast Spectral Correlation (Fast-SC) — vertical α-ridges at the fault frequencies', cscNote: 'Carrier f × cyclic frequency α. A real bearing fault is cyclostationary: it forms a vertical α-ridge family at BPFO/BPFI/2·BSF (independent of carrier), separating it from coincidental peaks. Phase-retaining Fast-SC + exact CKN significance + EES marginal.',
    waveform: 'Vibration waveform — drag to zoom, hover to read; ▼=impact at the fault frequency, shaded=fault-frequency windows', spectrum: 'Raw spectrum (dB) — drag to zoom; click to set a harmonic comb; shaded=demod band',
    ses: 'Squared-envelope spectrum — defect-frequency combs (BPFO/BPFI/2·BSF/fr)', watNote: 'Run-to-failure spectral waterfall (synthetic): each row is a life snapshot, height is amplitude. Watch the BPFO ridge emerge and grow. Drag to rotate.',
    rulNote: 'Health-indicator trend with onset, failure threshold and the RUL projection fan (±2σ).',
    onset: 'Onset', rul: 'RUL', fail: 'Proj. failure', h: 'h', freqs: 'Kinematic frequencies', replay: 'Replay degradation',
    anlys: 'Analysis', aBand: 'Demod band', aEnv: 'Envelope', aHarm: 'Harmonics (comb)', aIso: 'ISO scale',
    bAuto: 'Auto (kurtogram)', bFixed: 'Fixed 2–4 kHz', bManual: 'Manual (pick/brush)', bIesfo: 'Auto (IESFOgram)', eSq: 'Squared (SES)', eMag: 'Magnitude' },
  es: { bearing: 'Rodamiento', fault: 'Falla plantada', severity: 'Severidad', rpm: 'Velocidad eje (rpm)', snr: 'SNR (dB)',
    diag: 'Diagnóstico', conf: 'confianza', sev: 'Índice de severidad', band: 'Banda demod', clickKg: 'Clic en una celda del kurtograma para fijar la banda → el SES se actualiza en vivo.',
    f_healthy: 'Sano', f_outer: 'Pista externa (BPFO)', f_inner: 'Pista interna (BPFI)', f_ball: 'Bola (2·BSF)',
    tSig: 'Señal y espectro', tEnv: 'Envolvente · SES', tKur: 'Kurtograma', tGram: 'Infograma', tCam: 'Campbell / orden', tRul: 'Prognóstico · RUL', tEval: 'Eval RUL', tIso: 'Tendencia ISO', tFeat: 'Espacio features', tWat: 'Waterfall 3D', tSpec: 'Espectrograma', tRec: 'Recomendación · reporte', cep: 'Cepstrum (rahmónicos 1/fr · 1/BPFO marcados)', spectroT: 'Espectrograma STFT (dB) — hover lee (t,f,dB); caja = banda demod', spectroNote: 'Tiempo-frecuencia: CUÁNDO y en qué banda aparece la energía impulsiva de falla (confirma estacionariedad).', tCsc: 'Cicloestacionario', cscT: 'Correlación espectral rápida (Fast-SC) — crestas α verticales en las frecuencias de falla', cscNote: 'Portadora f × frecuencia cíclica α. Una falla real es cicloestacionaria: forma una familia de crestas α verticales en BPFO/BPFI/2·BSF (independiente de la portadora), separándola de picos casuales. Fast-SC con fase + significancia CKN exacta + marginal EES.',
    waveform: 'Forma de onda — arrastra para zoom, hover para leer; ▼=impacto en la frecuencia de falla, sombreado=ventanas de frecuencia de falla', spectrum: 'Espectro crudo (dB) — arrastra para zoom; clic para fijar un peine de armónicos; sombreado=banda demod',
    ses: 'Espectro de envolvente al cuadrado — peines de frecuencias de falla (BPFO/BPFI/2·BSF/fr)', watNote: 'Waterfall espectral run-to-failure (sintético): cada fila es una instantánea de vida, la altura es amplitud. Observa la cresta BPFO emerger y crecer. Arrastra para rotar.',
    rulNote: 'Tendencia del indicador de salud con onset, umbral de falla y el abanico de proyección de RUL (±2σ).',
    onset: 'Onset', rul: 'RUL', fail: 'Falla proy.', h: 'h', freqs: 'Frecuencias cinemáticas', replay: 'Reproducir degradación',
    anlys: 'Análisis', aBand: 'Banda demod', aEnv: 'Envolvente', aHarm: 'Armónicos (peine)', aIso: 'Escala ISO',
    bAuto: 'Auto (kurtograma)', bFixed: 'Fija 2–4 kHz', bManual: 'Manual (clic/pincel)', bIesfo: 'Auto (IESFOgrama)', eSq: 'Cuadrática (SES)', eMag: 'Magnitud' },
};

export default function Tool() {
  const lang = useShellLang();
  const t = T[lang];
  const [bearingId, setBearingId] = useState('skf6205');
  const [fault, setFault] = useState<FaultKind>('outer');
  const [severity, setSeverity] = useState(1.0);
  const [rpm, setRpm] = useState(1772);
  const [snr, setSnr] = useState(2);
  const [band, setBand] = useState<[number, number] | null>(null);
  const [fund, setFund] = useState<number | null>(null);
  // T7 — configurable analysis parameters (drive the always-visible sidebar diagnosis + the relevant tabs)
  const [bandMethod, setBandMethod] = useState<'auto' | 'fixed' | 'manual' | 'iesfo'>('auto'); // demod-band selection
  const [envSquared, setEnvSquared] = useState(false);  // magnitude envelope (the diagnosis gates are tuned on it) vs squared (SES)
  const [nHarm, setNHarm] = useState(5);                 // harmonics averaged in the comb prominence
  const [isoClass, setIsoClass] = useState('classI');   // ISO severity scale (class/group)
  // degradation replay (life-position scrubber)
  const [replayOn, setReplayOn] = useState(false);
  const [lifePos, setLifePos] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [bandBrush, setBandBrush] = useState(false); // spectrum drag selects the demod band → live SES
  // REAL run-to-failure source for the RUL tab: '' = synthetic; else a FEMTO bearing id (real degradation data)
  const [rulSource, setRulSource] = useState('');
  // Prognostic model selector (exponential | pf | gp | deep)
  const [rulModel, setRulModel] = useState<RulModel>('exponential');
  const [deepRulResult, setDeepRulResult] = useState<{frac:number;t:number}[]|null>(null); // multi-step curve
  const [femtoTrajs, setFemtoTrajs] = useState<FemtoTraj[]>([]);
  useEffect(() => { loadRealRtf().then(setFemtoTrajs).catch(() => {}); }, []);
  // APP SOURCE — the first-level decision of the workbench: 'synthetic' (a fabricated case, with all the scenario
  // knobs) vs 'cwru' (a REAL held-out CWRU segment — the measured signal flows through the EXACT same tools; the
  // scenario knobs become read-only sample metadata, the analysis knobs stay live).
  const [source, setSource] = useState<'synthetic' | 'cwru' | 'femto'>('synthetic');
  const [segDatasets, setSegDatasets] = useState<SegDataset[]>([]);
  const [segKey, setSegKey] = useState<'cwru' | 'ottawa' | 'mafaulda'>('cwru');
  const [segIdx, setSegIdx] = useState(0);
  const [realDx, setRealDx] = useState<DiagOut | null>(null); // the WDCNN prediction on the real segment (ONNX)
  useEffect(() => { loadSegmentDatasets().then(setSegDatasets).catch(() => {}); }, []);
  const cwruClasses = useMemo(() => segDatasets.find((d) => d.key === 'cwru')?.classes ?? ['normal', 'inner', 'outer', 'ball'], [segDatasets]);
  const activeSeg = source === 'cwru' ? (segDatasets.find((d) => d.key === segKey) ?? segDatasets[0] ?? null) : null;
  const activeSample = activeSeg ? activeSeg.samples[Math.min(segIdx, activeSeg.samples.length - 1)] ?? null : null;
  const realMode = source === 'cwru' && !!activeSeg; // a measured DIAGNOSIS segment (CWRU / Ottawa / MaFaulDa)
  const trajMode = source === 'femto';               // a REAL run-to-failure TRAJECTORY (prognostics)
  useEffect(() => { setSegIdx((i) => (activeSeg ? Math.min(i, activeSeg.samples.length - 1) : i)); }, [activeSeg]);
  // in real time-domain mode, sync the shaft-rate readout to the segment rpm so fr/defect-freqs are consistent
  // (order-domain Ottawa keeps fr conceptual = 1 order, so its rpm is not pushed into the Hz readout)
  useEffect(() => { if (realMode && activeSample?.rpm && activeSeg?.domain !== 'orders') setRpm(activeSample.rpm); }, [realMode, activeSample, activeSeg]);
  // run the trained WDCNN (ONNX) on the selected real segment. CWRU is in-domain; Ottawa/MaFaulDa are CROSS-domain
  // (a 12 kHz window through the CWRU-trained net), so the prediction stays in the CWRU class vocabulary.
  useEffect(() => {
    if (realMode && activeSeg && activeSample && activeSeg.wdcnnMode !== 'none') {
      let dead = false;
      diagnoseRaw(activeSample.rawWdcnn ?? activeSample.raw, cwruClasses).then((d) => { if (!dead) setRealDx(d); }).catch(() => {});
      return () => { dead = true; };
    }
    setRealDx(null);
  }, [realMode, activeSeg, activeSample, cwruClasses]);

  // REAL raw life-snapshots for the trajectory mode: ~8 measured windows along each run-to-failure, so the whole
  // signal suite + the REAL degradation waterfall + the feature trajectory run on measured data (not only the HI).
  const [frames, setFrames] = useState<Record<string, FrameSet>>({});
  useEffect(() => { loadRealFrames().then(setFrames).catch(() => {}); }, []);
  const [frameIdx, setFrameIdx] = useState(7); // default to the failure end (last frame)
  const activeFrames = trajMode && rulSource ? frames[rulSource] ?? null : null;
  const activeTraj = trajMode && rulSource ? femtoTrajs.find((tr) => `${tr.set}:${tr.id}` === rulSource) ?? null : null;
  useEffect(() => { setFrameIdx((i) => (activeFrames ? Math.min(i, activeFrames.frames.length - 1) : i)); }, [activeFrames]);
  // sync the shaft-rate readout to the trajectory's rpm, so fr + the fault-frequency markers/readout are consistent
  useEffect(() => { if (trajMode && activeTraj?.rpm) setRpm(activeTraj.rpm); }, [trajMode, activeTraj]);

  const seed = useMemo(() => SCENARIOS.find((s) => s.fault === fault)?.spec.seed ?? 202, [fault]);
  const fr = rpm / 60;

  // base signal + raw spectrum + kurtogram (band-independent)
  const base = useMemo(() => {
    let sig: Signal;
    let bearing = bearingById(bearingId);
    let useFr = fr;
    let trueCls: string | null = null;
    if (realMode && activeSeg && activeSample) {
      // REAL diagnosis segment — CWRU (12 kHz), Ottawa (computed-order-tracked, order domain) or MaFaulDa (50 kHz).
      // The exact same tools run on the measured signal; scenario knobs don't apply, analysis knobs do. In the order
      // domain (Ottawa) fr=1 so the kinematic frequencies are constant ORDERS (immune to the varying speed).
      const x = Float64Array.from(activeSample.raw);
      sig = { x, t: Float64Array.from(x, (_, i) => i / activeSeg.fs), fs: activeSeg.fs };
      bearing = activeSeg.bearing;
      useFr = activeSeg.domain === 'orders' ? 1 : (activeSample.rpm ?? activeSeg.rpm) / 60;
      trueCls = activeSample.cls;
    } else if (trajMode && activeFrames && activeFrames.frames.length) {
      // REAL run-to-failure: the measured raw window at the selected life instant. The whole signal suite runs on it;
      // XJTU has published geometry (fault-frequency markers), FEMTO/IMS don't (markers suppressed below).
      const fr2 = activeFrames.frames[Math.min(frameIdx, activeFrames.frames.length - 1)];
      const x = Float64Array.from(fr2.raw);
      sig = { x, t: Float64Array.from(x, (_, i) => i / activeFrames.fs), fs: activeFrames.fs };
      bearing = activeFrames.faultOrders ? XJTU_BEARING : bearing;
      useFr = (activeTraj?.rpm ?? 1800) / 60;
    } else {
      const spec: SignalSpec = { fs: FS, dur: 1, rpm, bearing, fault, severity: fault === 'healthy' ? 0 : severity, resonance: 3400, zeta: 0.04, snrDb: snr, seed };
      sig = synth(spec);
    }
    const fsB = sig.fs; // the ACTIVE sample rate (12 kHz CWRU / 25.6 kHz FEMTO-XJTU / 20 kHz IMS / order-domain), not a constant
    const raw = magSpectrum(sig.x, fsB);
    const kg = kurtogram(sig.x, fsB, 5);
    // unknown-geometry run-to-failure sets (FEMTO/IMS) draw no fault-frequency markers — honest over invented lines
    const noGeom = trajMode && !!activeFrames && !activeFrames.faultOrders;
    const f = noGeom ? NO_GEOM : defectFreqs(bearing, useFr);
    // band-INDEPENDENT diagnosis (from the kurtogram band) — seeds the IESFOgram target without the
    // effBand→ses→dx→α₀→effBand cycle that using the live dx would create.
    const kgBand: [number, number] = [Math.max(kg.best.f1, 0.02 * fsB), kg.best.f2];
    const dx0 = diagnose(envelopeSpectrum(sig.x, fsB, kgBand, false), f, 5);
    return { sig, raw, kg, f, dx0, trueCls, real: realMode, noGeom, orders: realMode && activeSeg?.domain === 'orders' };
  }, [realMode, activeSeg, activeSample, trajMode, activeFrames, activeTraj, frameIdx, bearingId, fault, severity, rpm, snr, seed, fr]);

  useEffect(() => { setBand(null); setFund(null); }, [base]);
  const fsEff = base.sig.fs; // every tool that consumes base.sig must use this, not the synthetic FS constant

  // the diagnosed fault's cyclic frequency (BPFO/BPFI/2·BSF) — the IESFOgram target. From the band-independent dx0.
  const faultAlpha = useMemo(() => {
    const t = base.dx0.top;
    return t === 'inner' ? base.f.bpfi : t === 'ball' ? 2 * base.f.bsf : base.f.bpfo;   // default BPFO
  }, [base]);
  // T10: the IESFOgram targeted best band (only computed when that method is selected)
  const iesfoBest = useMemo(() => bandMethod === 'iesfo'
    ? gramGrid(base.sig.x, fsEff, 5, { targetAlpha: faultAlpha, fr, blind: false }).best.iesfo : null,
    [bandMethod, base, faultAlpha, fr]);

  // demod band: fixed 2–4 kHz · manual brush/pick · auto (kurtogram) · IESFOgram (targeted at the diagnosed fault)
  const effBand = useMemo<[number, number]>(() => {
    if (bandMethod === 'fixed') return [2000, 4000];
    if (bandMethod === 'manual' && band) return band;
    if (bandMethod === 'iesfo' && iesfoBest) return [Math.max(iesfoBest.f1, 0.02 * fsEff), iesfoBest.f2];
    return [Math.max(base.kg.best.f1, 0.02 * fsEff), base.kg.best.f2];
  }, [bandMethod, band, base, iesfoBest]);
  const ses = useMemo(() => envelopeSpectrum(base.sig.x, fsEff, effBand, envSquared), [base, effBand, envSquared]);
  const dx = useMemo(() => diagnose(ses, base.f, nHarm), [ses, base, nHarm]);
  // Fault severity index: the dominant fault family's diagnostic prominence, CLAMPED to the gauge's 0–12 range so
  // the needle never overshoots the scale (raw prominence can exceed 12 at high severity → the needle ran off the
  // gauge and looked like it "snapped back"). The prominence is a detectability ratio, so at very low signal it is
  // mildly noisy; it climbs sharply once the fault line clears the noise (the classical hard-threshold behaviour).
  const sev = Math.min(12, dx.scores[0]?.score ?? 0);
  const isoBounds = ISO_CLASSES[isoClass].bounds;

  // ---- chart data (memoized) ----
  const waveData = useMemo<uPlot.AlignedData>(() => { const [x, y] = minMaxDecimate(base.sig.t, base.sig.x, 0.08, 700); return [x, y]; }, [base]);
  const specData = useMemo<uPlot.AlignedData>(() => {
    const f = base.raw.freq, m = base.raw.mag; const xs: number[] = [], ys: number[] = [];
    for (let i = 0; i < f.length; i++) { if (f[i] > 6000) break; xs.push(f[i]); ys.push(20 * Math.log10(Math.max(m[i], 1e-9))); }
    return [xs, ys];
  }, [base]);
  // SES view range: 10× the defect line if geometry is known, else a sensible default (700 Hz / 50 orders).
  // Guards against NaN (FEMTO/IMS have no geometry → base.f.bpfo is NaN, which would make the chart range NaN).
  const sesXmax = base.f.bpfo > 0 ? Math.min(base.orders ? 50 : 700, 10 * base.f.bpfo) : (base.orders ? 50 : 700);
  const liveSesData = useMemo<uPlot.AlignedData>(() => {
    const f = ses.freq, m = ses.mag; const xs: number[] = [], ys: number[] = [];
    for (let i = 0; i < f.length; i++) { if (f[i] > sesXmax) break; xs.push(f[i]); ys.push(m[i]); }
    return [xs, ys];
  }, [ses, sesXmax]);
  // degradation replay snapshots — built only while replay is engaged (zero cost when off)
  const replaySnaps = useMemo(() => (replayOn ? buildLifeSnapshots({ bearing: bearingById(bearingId), fault, severityEnd: severity, rpm, snrDb: snr, sesXmax }) : null), [replayOn, bearingId, fault, severity, rpm, snr, sesXmax]);
  const curSnap = replaySnaps ? replaySnaps[Math.round(lifePos * (replaySnaps.length - 1))] : null;
  const sesData = curSnap ? (curSnap.sesData as uPlot.AlignedData) : liveSesData;
  const spectro = useMemo(() => spectrogram(base.sig.x, fsEff, 512, 0.75), [base]);
  const cep = useMemo(() => realCepstrum(base.sig.x, fsEff), [base]);
  const cepData = useMemo<uPlot.AlignedData>(() => { const q = cep.quef, a = cep.amp; const xs: number[] = [], ys: number[] = []; for (let i = 1; i < q.length; i++) { if (q[i] > 0.05) break; xs.push(q[i]); ys.push(a[i]); } return [xs, ys]; }, [cep]);

  // impact markers + fault-frequency detection windows on the waveform (first 0.08 s)
  const waveMarks = useMemo(() => {
    const x = base.sig.x, ts = base.sig.t;
    // ▼ marks the impact peak inside each predicted defect-frequency window. PHYSICS-anchored: the windows come from
    // the bearing's defect frequency for the selected fault (BPFO/BPFI/2·BSF), so it shows exactly the impacts a real
    // fault produces, gives ONE mark per impact (not one per resonance-ring cycle), never fires on a healthy signal
    // (no defect frequency → no windows), and never marks noise (it takes the max inside a narrow physics window — a
    // raw |accel| threshold can't separate impacts from noise/rings at realistic SNR, which is why nothing ever showed).
    const fdef = faultFreq(base.f, fault);
    const windows: [number, number][] = [];
    if (fault !== 'healthy' && fdef > 0) { const per = 1 / fdef; for (let k = 0; k * per < 0.08; k++) windows.push([k * per, k * per + Math.min(0.0015, per * 0.2)]); }
    const outliers: number[] = [];
    for (const [a, b] of windows) {
      let bt = -1, bv = -1;
      for (let i = 0; i < ts.length && ts[i] <= b; i++) { if (ts[i] < a) continue; const v = Math.abs(x[i]); if (v > bv) { bv = v; bt = ts[i]; } }
      if (bt >= 0) outliers.push(bt);
    }
    return { outliers, windows };
  }, [base, fault]);

  // ---- builds (stable) ----
  const buildWave = useCallback((w: number, h: number) => lineOpts(w, h, { label: 'accel', color: C.band, xUnit: 's', yUnit: 'g' }), []);
  const buildSpec = useCallback((w: number, h: number) => lineOpts(w, h, { label: 'level', color: '#8b949e', xUnit: 'Hz', yUnit: 'dB', yPrec: 1, dragSetScale: !bandBrush }), [bandBrush]);
  const buildSes = useCallback((w: number, h: number) => lineOpts(w, h, { label: 'SES', color: C.shaft, xUnit: 'Hz', yUnit: 'g²' }), []);
  const buildCep = useCallback((w: number, h: number) => lineOpts(w, h, { label: 'cepstrum', color: '#3fb1c8', xUnit: 's' }), []);

  // ---- plugins (memoized) ----
  const wavePlugins = useMemo(() => [regionsPlugin(waveMarks.windows, C.window), vmarksPlugin(waveMarks.outliers, C.outlier)], [waveMarks]);
  const specCombs = useMemo<Comb[]>(() => { const a: Comb[] = [{ base: fr, harmonics: 6, color: C.shaft, label: `fr ${fr.toFixed(1)} Hz` }]; if (fund) a.push({ base: fund, harmonics: 5, color: C.band, label: `${fund.toFixed(0)} Hz` }); return a; }, [fr, fund]);
  const specPlugins = useMemo(() => {
    const p = [regionsPlugin([effBand], C.band), combsPlugin(specCombs)];
    if (bandBrush) p.push(selectPlugin((lo, hi) => { setBand([Math.max(lo, 0.02 * fsEff), hi]); setBandMethod('manual'); }));
    return p;
  }, [effBand, specCombs, bandBrush]);
  const sesCombs = useMemo<Comb[]>(() => {
    const u = base.orders ? '×' : ' Hz';      // order domain (Ottawa) labels in orders, not Hz
    const p = base.orders ? 2 : 1;
    // no fault-frequency combs when geometry is unknown (FEMTO/IMS) — only the shaft-rate comb
    const c: Comb[] = base.f.bpfo > 0 ? [
      { base: base.f.bpfo, harmonics: 6, color: C.outer, label: `BPFO ${base.f.bpfo.toFixed(p)}${u}` },
      { base: base.f.bpfi, harmonics: 5, color: C.inner, label: `BPFI ${base.f.bpfi.toFixed(p)}${u}` },
      { base: 2 * base.f.bsf, harmonics: 4, color: C.ball, label: `2·BSF ${(2 * base.f.bsf).toFixed(p)}${u}` },
    ] : [];
    if (!base.orders) c.push({ base: fr, harmonics: 3, color: C.shaft, label: `fr ${fr.toFixed(1)} Hz` });
    return c;
  }, [base, fr]);
  const sesPlugins = useMemo(() => [combsPlugin(sesCombs)], [sesCombs]);
  const cepCombs = useMemo<Comb[]>(() => ([{ base: 1 / fr, harmonics: 4, color: C.shaft, label: '1/fr' }, ...(base.f.bpfo > 0 ? [{ base: 1 / base.f.bpfo, harmonics: 3, color: C.outer, label: '1/BPFO' }] : [])]), [fr, base]);
  const cepPlugins = useMemo(() => [combsPlugin(cepCombs)], [cepCombs]);

  const onClickSpec = useCallback((x: number) => {
    const f = base.raw.freq, m = base.raw.mag; const tol = Math.max(20, 0.02 * x); let bestI = -1, bestV = -1;
    for (let i = 0; i < f.length; i++) { if (Math.abs(f[i] - x) <= tol && m[i] > bestV) { bestV = m[i]; bestI = i; } if (f[i] > x + tol) break; }
    setFund(bestI >= 0 ? f[bestI] : x);
  }, [base]);

  const onPickBand = useCallback((b: [number, number]) => { setBand(b); setBandMethod('manual'); }, []);

  // ---- run-to-failure (RUL + 3D waterfall) — REACT to the selected scenario ----
  const bearingHash = useMemo(() => bearingId.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0), [bearingId]);
  const rtf = useMemo(() => runToFailure({ seed: seed + bearingHash, fault, severity }), [seed, bearingHash, fault, severity]);
  const rul = useMemo(() => projectRUL(rtf.points, rtf.threshold), [rtf]);
  // the trajectory ACTUALLY shown in the RUL tab — synthetic (reacts to the case) or a REAL FEMTO bearing life.
  // The SAME projectRUL (onset → exp fit → first-passage) runs on whichever is selected; on FEMTO we can show the
  // predicted RUL next to the dataset's REAL failure time.
  const rtfShown = useMemo(() => {
    if (trajMode && rulSource) { const ft = femtoTrajs.find((t) => `${t.set}:${t.id}` === rulSource); if (ft) return femtoToRunToFailure(ft); }
    return rtf;
  }, [trajMode, rulSource, femtoTrajs, rtf]);
  // Deep-RUL multi-step CNN inference: feed raw vibration windows at different life stages
  // → real curve of life fractions vs time (not fabricated)
  useEffect(() => {
    if (rulModel !== 'deep') return;
    let cancelled = false;
    const runMultiStep = async () => {
      const points: {frac:number;t:number}[] = [];
      const normWin = (raw: Float64Array|Float32Array): Float32Array => {
        const w = new Float32Array(2048); const n=raw.length;
        for(let i=0;i<2048;i++){const idx=Math.min(n-1,Math.floor((i/2047)*(n-1)));w[i]=raw[idx];}
        let s=0,ss=0; for(let i=0;i<2048;i++){s+=w[i];ss+=w[i]*w[i];}
        const m=s/2048; const sd=Math.sqrt(ss/2048-m*m)||1e-9;
        for(let i=0;i<2048;i++)w[i]=(w[i]-m)/sd;
        return w;
      };
      if (trajMode && activeFrames?.frames?.length) {
        // Real RUL mode: each frame is a measured vibration window at a life instant
        const frames = activeFrames.frames;
        for (const f of frames) {
          if (cancelled) return;
          const raw = (f as any)?.raw as Float32Array|Float64Array|null;
          if (!raw || raw.length < 8) continue;
          try {
            const frac = await deepRul(normWin(raw));
            if (!cancelled) points.push({frac, t: (f as any).t ?? 0});
          } catch(_){}
        }
      } else {
        // Synthetic mode: generate signal at 8 severity levels
        const spec = { faultKind: fault as FaultKind, bearingId, rpm, snr, seed };
        const sevs = Array.from({length:8},(_,i)=>Math.max(0.5, severity * (0.3 + i*0.1)));
        for (const sev of sevs) {
          if (cancelled) return;
          const sig = synth({...spec, severity: sev, seed});
          try {
            const frac = await deepRul(normWin(sig.x));
            if (!cancelled) points.push({frac, t: sev * 20});
          } catch(_){}
        }
      }
      if (!cancelled && points.length) setDeepRulResult(points);
    };
    setDeepRulResult(null);
    runMultiStep();
    return () => { cancelled = true; };
  }, [rulModel, trajMode, activeFrames, base.spec, severity, seed]);
  const rulShown = useMemo(() => {
    const exp = projectRUL(rtfShown.points, rtfShown.threshold);
    if (rulModel === 'pf') {
      const pf = particleFilterRUL(rtfShown.points, rtfShown.threshold);
      // Build projection curve from the particle ensemble: compute HI(t) for each particle,
      // take P10/P50/P90 at each forward time step. The band IS the PF's posterior uncertainty.
      const pfCurve: {t:number;lo:number;mid:number;hi:number}[] = [];
      const particles = pf.particles ?? [];
      if (particles.length > 10 && pf.rulMedian && pf.rulMedian > 0 && pf.failTimeMedian) {
        const tNow = rtfShown.points[rtfShown.points.length-1]?.t ?? 0;
        const tEnd = pf.failTimeMedian * 1.2;
        const nPts = 30;
        for (let i=0; i<=nPts; i++) {
          const t = tNow + (i/nPts) * (tEnd - tNow);
          const his: number[] = [];
          for (const p of particles) {
            his.push(Math.exp(p.lnA + p.b * t));
          }
          his.sort((a,b)=>a-b);
          const K=his.length;
          pfCurve.push({t, lo:his[Math.floor(K*0.1)], mid:his[Math.floor(K*0.5)], hi:his[Math.floor(K*0.9)]});
        }
      }
      return { onset: pf.onset, threshold: rtfShown.threshold, failTime: pf.failTimeMedian ?? null, rul: pf.rulMedian ?? null, curve: pfCurve };
    }
    if (rulModel === 'gp') {
      const gp = gpRUL(rtfShown.points, rtfShown.threshold);
      return { onset: gp.onset, threshold: rtfShown.threshold, failTime: gp.failTimeMedian ?? null, rul: gp.rulMedian ?? null, curve: (gp.curve ?? []).map(c => ({ t: c.t, lo: c.lo, mid: c.mean ?? 0, hi: c.hi })) };
    }
    if (rulModel === 'deep') {
      const points = deepRulResult;
      if (!points || points.length < 2) return { onset: null, threshold: rtfShown.threshold, failTime: null, rul: null, curve: [] };
      // Build the curve from the CNN's multi-step output — REAL data, not fabricated
      const sorted = [...points].sort((a,b)=>a.t-b.t);
      const last = sorted[sorted.length-1];
      const thr = rtfShown.threshold;
      // Project: if life fraction is trending linearly, extrapolate to frac=1 (failure)
      const deepCurve: {t:number;lo:number;mid:number;hi:number}[] = sorted.map(p => {
        const hiNorm = thr * Math.min(1, Math.max(0.01, p.frac * 1.15));
        return {t: p.t, lo: thr * Math.max(0.01, p.frac * 0.7), mid: thr * Math.max(0.01, p.frac), hi: hiNorm};
      });
      // Extrapolate forward to failure (frac=1)
      if (sorted.length >= 2) {
        const p0 = sorted[sorted.length-2], p1 = last;
        const slope = (p1.frac - p0.frac) / Math.max(0.01, p1.t - p0.t);
        if (slope > 0) {
          const tFail = last.t + (1 - last.frac) / slope;
          const nExt = 10;
          for (let i=1; i<=nExt; i++) {
            const t = last.t + (i/nExt) * (tFail - last.t) * 1.1;
            const frac = Math.min(1, last.frac + slope * (t - last.t));
            deepCurve.push({t, lo: thr * frac * 0.7, mid: thr * frac, hi: thr * Math.min(1, frac * 1.15)});
          }
        }
      }
      const tNow = rtfShown.points[rtfShown.points.length-1]?.t ?? 0;
      const firstFrac = sorted[0]?.frac ?? 0;
      const firstT = sorted[0]?.t ?? 0;
      const avgSlope = (last.frac - firstFrac) / Math.max(0.01, last.t - firstT);
      const rul = last.frac < 1 ? Math.max(0, (1 - last.frac) / Math.max(0.001, avgSlope)) : 0;
      return { onset: null, threshold: thr, failTime: last.frac >= 0.95 ? last.t : null, rul: Math.max(0, rul), curve: deepCurve };
    }
    return exp;
  }, [rtfShown, rulModel, deepRulResult]);
  // replay-derived 'now' position fed to the RUL chart + 3D waterfall while replay is engaged
  const replayLifeH = isFinite(rtf.trueFail) ? rtf.trueFail : 60;
  const nowT = replayOn ? lifePos * replayLifeH : undefined;
  const nowHi = nowT != null ? interpHI(rtf.points, nowT) : undefined;
  // the run-to-failure waterfall demodulates the SAME fault/bearing/rpm/severity as the live case,
  // so the emerging ridge sits at the active defect frequency and the surface scales with severity.
  const WAT_FMAX = 600;
  const waterfall = useMemo(() => {
    const fmax = WAT_FMAX, cols = 110; let gmax = 1e-9;
    // REAL degradation: stack the envelope spectrum of each MEASURED life-snapshot over the run-to-failure life.
    if (trajMode && activeFrames && activeFrames.frames.length) {
      const fsF = activeFrames.fs;
      const band: [number, number] = [2000, Math.min(4500, 0.35 * (fsF / 2))];
      const grid = activeFrames.frames.map((fr3) => {
        const s = envelopeSpectrum(Float64Array.from(fr3.raw), fsF, band);
        const rowv: number[] = [];
        for (let c = 0; c < cols; c++) { const f = (c / (cols - 1)) * fmax; let i = Math.round((f / (fsF / 2)) * (s.freq.length - 1)); i = Math.max(0, Math.min(s.mag.length - 1, i)); const v = s.mag[i]; rowv.push(v); if (v > gmax) gmax = v; }
        return rowv;
      });
      return grid.map((row) => row.map((v) => v / gmax));
    }
    const rows = 26; const grid: number[][] = [];
    const bearing = bearingById(bearingId);
    const sevEnd = fault === 'healthy' ? 0 : Math.max(0.25, severity) * 1.2;
    for (let r = 0; r < rows; r++) {
      const sev2 = Math.max(0, (r - 6) / (rows - 7)) * sevEnd;
      const sig = synth({ fs: FS, dur: 0.5, rpm, bearing, fault, severity: sev2, resonance: 3400, zeta: 0.04, snrDb: 3, seed: 100 + r });
      const s = envelopeSpectrum(sig.x, FS, [2200, 4600]);
      const rowv: number[] = [];
      for (let c = 0; c < cols; c++) { const f = (c / (cols - 1)) * fmax; let i = Math.round((f / (FS / 2)) * (s.freq.length - 1)); i = Math.max(0, Math.min(s.mag.length - 1, i)); const v = s.mag[i]; rowv.push(v); if (v > gmax) gmax = v; }
      grid.push(rowv);
    }
    return grid.map((row) => row.map((v) => v / gmax));
  }, [trajMode, activeFrames, bearingId, fault, rpm, severity]);
  // defect frequency of the active fault → labels the emerging ridge in the 3D waterfall
  const ridge = useMemo(() => {
    const hz = fault === 'outer' ? base.f.bpfo : fault === 'inner' ? base.f.bpfi : fault === 'ball' ? 2 * base.f.bsf : 0;
    const label = fault === 'outer' ? 'BPFO' : fault === 'inner' ? 'BPFI' : fault === 'ball' ? '2·BSF' : '';
    return { hz, label };
  }, [fault, base]);
  // REAL feature-space trajectory: RMS / envelope-kurtosis / SES-amp of each MEASURED life-frame (run-to-failure)
  const realFeats = useMemo(() => (trajMode && activeFrames && activeFrames.frames.length >= 2)
    ? framesToLifeFeats(activeFrames.frames, activeFrames.fs, base.noGeom ? 0 : base.f.bpfo, [2000, Math.min(4500, 0.35 * (activeFrames.fs / 2))])
    : undefined, [trajMode, activeFrames, base]);
  // REAL feature-space by CLASS (segment mode): the same features for every measured segment of the active dataset,
  // so the feature space shows where each class sits and where the selected segment lands.
  const segFeats = useMemo(() => (realMode && activeSeg && activeSeg.samples.length >= 2)
    ? framesToLifeFeats(activeSeg.samples.map((s) => ({ t: 0, frac: 0, raw: s.raw })), activeSeg.fs, base.noGeom ? 0 : base.f.bpfo, [Math.min(2000, 0.12 * (activeSeg.fs / 2)), 0.42 * (activeSeg.fs / 2)])
    : undefined, [realMode, activeSeg, base]);
  const segClassColor = useCallback((c: string) => (({ normal: '#3fb950', healthy: '#3fb950', outer: '#f59f00', inner: '#f06595', ball: '#7c5cff', cage: '#58a6ff' } as Record<string, string>)[c] ?? '#8b949e'), []);

  const faultLabel = (k: string) => (t as Record<string, string>)[`f_${k}`] ?? k;

  // Degradation-replay scrubber — scoped to the run-to-failure views it actually drives (Envelope·SES, 3D
  // waterfall, Prognostics·RUL), NOT a global top bar. Shared state lives in this component, so the scrubber
  // position persists when switching among those three tabs.
  const replayBar = () => (
    <div className="rv-replay-bar">
      <button className={`chip ${replayOn ? 'on' : ''}`} onClick={() => { setReplayOn((v) => !v); setPlaying(false); }}>{t.replay}</button>
      {replayOn && <DegradationReplayController lifePos={lifePos} setLifePos={setLifePos} lifeH={replayLifeH} onsetH={rul.onset} failH={rul.failTime ?? (isFinite(rtf.trueFail) ? rtf.trueFail : null)} curSev={curSnap?.sev ?? 0} curHi={nowHi ?? 0} playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed} lang={lang} />}
    </div>
  );

  const tabs = [
    { id: 'sig', label: t.tSig, content: (
      <div className="rv-vizstack">
        <div className="rv-plot"><div className="rv-plot-t">{t.waveform}</div><UPlotChart data={waveData} build={buildWave} plugins={wavePlugins} height={170} /></div>
        <div className="rv-plot"><div className="rv-plot-t rv-plot-th"><span>{t.spectrum}</span><button className={`chip ${bandBrush ? 'on' : ''}`} onClick={() => setBandBrush((v) => !v)}>{lang === 'es' ? 'pincel banda → SES' : 'brush band → SES'}</button></div><UPlotChart data={specData} build={buildSpec} plugins={specPlugins} height={185} onClickX={bandBrush ? undefined : onClickSpec} /></div>
      </div>) },
    { id: 'env', label: t.tEnv, content: (
      <div className="rv-vizstack">
        {replayBar()}
        <p className="hint">{t.band}: <b>{(effBand[0] / 1000).toFixed(2)}–{(effBand[1] / 1000).toFixed(2)} kHz</b> · {t.clickKg}</p>
        <div className="rv-plot"><div className="rv-plot-t">{t.ses}</div><UPlotChart data={sesData} build={buildSes} plugins={sesPlugins} height={200} /></div>
        {!base.noGeom && <PeakTable ses={ses} f={base.f} lang={lang} />}
        <div className="rv-plot"><div className="rv-plot-t">{t.cep}</div><UPlotChart data={cepData} build={buildCep} plugins={cepPlugins} height={150} /></div>
      </div>) },
    { id: 'spec', label: t.tSpec, content: (
      <div className="rv-vizstack"><div className="rv-plot"><div className="rv-plot-t">{t.spectroT}</div><Heatmap2D cols={spectro.cols} times={spectro.times} freqs={spectro.freqs} fmax={6000} band={effBand} /></div><p className="hint">{t.spectroNote}</p></div>) },
    { id: 'csc', label: t.tCsc, content: (
      <CscPanel x={base.sig.x} fs={fsEff} f={base.f} lang={lang} />) },
    { id: 'kur', label: t.tKur, content: (
      <div className="rv-vizstack"><Kurtogram kg={base.kg} fs={fsEff} onPick={onPickBand} /><p className="hint">{t.clickKg}</p></div>) },
    { id: 'gram', label: t.tGram, content: (
      <GramPanel x={base.sig.x} fs={fsEff} onPick={onPickBand} lang={lang} f={base.f} fr={fr} faultAlpha={faultAlpha} />) },
    { id: 'cam', label: t.tCam, content: (
      <CampbellPanel bearing={bearingById(bearingId)} fault={fault} severity={severity} snr={snr} seed={seed} rpm={rpm} lang={lang} realOrderMap={realMode && activeSample?.orderMap ? activeSample.orderMap : undefined} realFaultOrders={base.orders ? { bpfo: base.f.bpfo, bpfi: base.f.bpfi, bsf: base.f.bsf } : undefined} realLabel={activeSample ? activeSample.label.split('·')[0].trim() : undefined} />) },
    { id: 'wat', label: t.tWat, content: (
      <div className="rv-vizstack">{!trajMode && replayBar()}<Suspense fallback={<p className="hint">3D…</p>}><Waterfall3D grid={waterfall} fmax={WAT_FMAX} ridgeHz={base.noGeom ? 0 : ridge.hz} ridgeLabel={base.noGeom ? '' : ridge.label} lifeH={trajMode ? (isFinite(rtfShown.trueFail) ? rtfShown.trueFail : 100) : (isFinite(rtf.trueFail) ? rtf.trueFail : 100)} lifeRow={trajMode && activeFrames && activeFrames.frames.length > 1 ? Math.min(frameIdx, activeFrames.frames.length - 1) / (activeFrames.frames.length - 1) : (replayOn ? lifePos : null)} /></Suspense><p className="hint">{trajMode && activeFrames ? (lang === 'es' ? `Waterfall de degradación REAL — ${(activeTraj?.set ?? '').toUpperCase()} ${activeTraj?.id ?? ''}: cada fila es una instantánea MEDIDA de la vida (envolvente). El instante seleccionado está resaltado. Arrastra para rotar.` : `REAL degradation waterfall — ${(activeTraj?.set ?? '').toUpperCase()} ${activeTraj?.id ?? ''}: each row is a MEASURED life-snapshot (envelope). The selected instant is highlighted. Drag to rotate.`) : t.watNote}</p></div>) },
    { id: 'rul', label: t.tRul, content: (
      <div className="rv-vizstack">
        {!trajMode && replayBar()}
        <div className="rul-model-bar" style={{display:'flex',gap:6,marginBottom:8,flexWrap:'wrap'}}>
          {(['exponential','pf','gp','deep'] as RulModel[]).map(m => (
            <button key={m} className={`chip ${rulModel===m?'on':''}`} onClick={()=>setRulModel(m)}>
              {m==='exponential'?'Exponencial':m==='pf'?'Filtro de partículas':m==='gp'?'Proceso Gaussiano':'Deep-RUL'}
            </button>
          ))}
        </div>
        <RulChart points={rtfShown.points} rul={rulShown} nowT={!trajMode ? nowT : undefined} nowHi={!trajMode ? nowHi : undefined} />
        <p className="hint">{!trajMode
          ? t.rulNote
          : (lang === 'es'
            ? `${rtfShown.label} — datos de degradación REALES (${rulModel==='exponential'?'exponencial':rulModel==='pf'?'filtro de partículas':'GP'}). Falla real: ${isFinite(rtfShown.trueFail) ? rtfShown.trueFail.toFixed(2) : '—'} h.`
            : `${rtfShown.label} — REAL degradation data (${rulModel==='exponential'?'exponential':rulModel==='pf'?'particle filter':'GP'}). True failure: ${isFinite(rtfShown.trueFail) ? rtfShown.trueFail.toFixed(2) : '—'} h.`)}</p>
        <div className="rv-rul-read"><span>{t.onset}: <b>{rulShown.onset != null ? `${rulShown.onset.toFixed(0)} ${t.h}` : '—'}</b></span><span>{t.rul}: <b>{rulShown.rul != null ? `${rulShown.rul.toFixed(0)} ${t.h}` : '—'}</b></span><span>{t.fail}: <b>{rulShown.failTime != null ? `${rulShown.failTime.toFixed(0)} ${t.h}` : '—'}</b></span>{trajMode && <span>{lang === 'es' ? 'real' : 'true'}: <b>{isFinite(rtfShown.trueFail) ? `${rtfShown.trueFail.toFixed(1)} ${t.h}` : '—'}</b></span>}</div>
      </div>) },
    { id: 'eval', label: t.tEval, content: (
      <PrognosticEvalPanel rtf={trajMode ? { points: rtfShown.points, threshold: rtfShown.threshold, trueFail: rtfShown.trueFail } : rtf} fault={fault} severity={severity} lang={lang} />) },
    { id: 'iso', label: t.tIso, content: (
      <IsoTrendPanel bearing={bearingById(bearingId)} fault={fault} severity={severity} snr={snr} rpm={rpm} lifeH={isFinite(rtf.trueFail) ? rtf.trueFail : 60} bounds={isoBounds} isoLabel={ISO_CLASSES[isoClass].label} lang={lang} />) },
    { id: 'feat', label: t.tFeat, content: (
      <FeatureSpacePanel bearing={bearingById(bearingId)} fault={fault} severity={severity} snr={snr} rpm={rpm} lifeH={isFinite(rtf.trueFail) ? rtf.trueFail : 60} lang={lang}
        realFeats={trajMode ? realFeats : (realMode ? segFeats : undefined)}
        realLabel={trajMode ? (activeTraj ? `${(activeTraj.set ?? '').toUpperCase()} ${activeTraj.id}` : undefined) : (realMode ? activeSeg?.label : undefined)}
        classPts={realMode && activeSeg ? activeSeg.samples.map((s) => ({ cls: s.cls })) : undefined}
        classColor={segClassColor} selIdx={realMode ? segIdx : undefined} classList={realMode && activeSeg ? activeSeg.classes : undefined} />) },
    { id: 'rec', label: t.tRec, content: (
      <RecommendationPanel bearing={bearingById(bearingId)} bearingLabel={trajMode && activeTraj ? `${(activeTraj.set ?? '').toUpperCase()} ${activeTraj.id}` : bearingById(bearingId).label} fault={fault} severity={fault === 'healthy' ? 0 : severity} rpm={rpm} snr={snr} sigX={base.sig.x} diag={dx} rul={trajMode ? rulShown : rul} lifeH={trajMode ? (isFinite(rtfShown.trueFail) ? rtfShown.trueFail : 60) : (isFinite(rtf.trueFail) ? rtf.trueFail : 60)} isoBounds={isoBounds} lang={lang} />) },
  ];

  // Tools available per source KIND. A measured CWRU window is a DIAGNOSIS artifact: the signal-analysis tools run on
  // it for real (waveform/envelope/spectrum/cyclostationary/kurtogram/SK-gram). A FEMTO run-to-failure is a PROGNOSIS
  // artifact: only the RUL projection runs on the measured HI(t) curve. Synthetic mode keeps every tool (the full
  // simulator). Tools that need a synthetic ground truth (Campbell run-up, feature-cloud, synthetic prognosis) are
  // hidden in real modes rather than shown fed by fabricated data — honesty over breadth.
  // Tools available per source KIND, now that real artifacts carry raw windows:
  // - segment (CWRU): the measured window → signal suite + feature space (real point) + recommendation.
  // - trajectory (FEMTO/XJTU/IMS): each life-snapshot is a real window → signal suite + the REAL degradation
  //   waterfall + RUL/eval + ISO trend + feature trajectory. (Campbell needs an rpm sweep — excluded; constant rpm.)
  // Ottawa's varying speed uniquely enables a REAL Campbell/order map (it ships an order-vs-rpm raster); add it there.
  const hasOrderMap = realMode && !!activeSample?.orderMap;
  const SEGMENT_TABS = hasOrderMap ? ['sig', 'env', 'spec', 'csc', 'kur', 'gram', 'cam', 'feat'] : ['sig', 'env', 'spec', 'csc', 'kur', 'gram', 'feat'];
  const TRAJ_TABS = ['sig', 'env', 'spec', 'csc', 'kur', 'gram', 'wat', 'rul', 'eval', 'feat', 'rec'];
  const tabsShownRaw = realMode ? tabs.filter((tb) => SEGMENT_TABS.includes(tb.id))
    : trajMode ? tabs.filter((tb) => TRAJ_TABS.includes(tb.id))
    : tabs;
  // wrap each panel so a crash in one tool renders an inline message instead of blanking the whole page
  const tabsShown = tabsShownRaw.map((tb) => ({ ...tb, content: <PanelBoundary key={`${source}-${tb.id}`} lang={lang}>{tb.content}</PanelBoundary> }));

  return (
    <div className="page-body rv-layout">
      <aside className="rv-side">
        {/* SOURCE — the first-level decision of the workbench: a fabricated synthetic case (scenario knobs) vs a REAL
            measured CWRU segment (the analysis tools run on the measured signal; scenario knobs become read-only). */}
        <div className="rv-source" style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          <button className={`chip ${source === 'synthetic' ? 'on' : ''}`} onClick={() => setSource('synthetic')}>{lang === 'es' ? 'Sintético' : 'Synthetic'}</button>
          <button className={`chip ${source === 'cwru' ? 'on' : ''}`} onClick={() => setSource('cwru')} disabled={!segDatasets.length} title={!segDatasets.length ? 'cargando…' : 'real measured segment (CWRU / Ottawa / MaFaulDa)'}>{lang === 'es' ? 'Real: segmento (diag.)' : 'Real: segment (diag.)'}</button>
          <button className={`chip ${source === 'femto' ? 'on' : ''}`} onClick={() => { setSource('femto'); if (!rulSource) { const f = femtoTrajs.find((t) => t.trueFail != null); if (f) setRulSource(`${f.set}:${f.id}`); } }} disabled={!femtoTrajs.length} title={!femtoTrajs.length ? 'cargando…' : 'real run-to-failure (FEMTO / XJTU / IMS)'}>{lang === 'es' ? 'Real: RUL' : 'Real: RUL'}</button>
        </div>
        {realMode ? (
          <>
            <div className="rv-source" style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
              {segDatasets.map((d) => <button key={d.key} className={`chip ${segKey === d.key ? 'on' : ''}`} onClick={() => { setSegKey(d.key); setSegIdx(0); }} title={`${d.classes.join('/')} · ${d.domain}`}>{d.label}</button>)}
            </div>
            <label className="rv-ctl">{lang === 'es' ? 'Segmento real' : 'Real segment'}
              <select className="select" value={Math.min(segIdx, (activeSeg?.samples.length ?? 1) - 1)} onChange={(e) => setSegIdx(+e.target.value)}>
                {activeSeg!.samples.map((sm, i) => <option key={i} value={i}>{sm.label}</option>)}
              </select>
            </label>
            <div className="muted small" style={{ margin: '0.1rem 0 0.5rem', lineHeight: 1.5 }}>
              {activeSample?.meta} · {lang === 'es' ? 'verdad' : 'truth'}: <b>{faultLabel(base.trueCls || '')}</b><br />
              <span style={{ opacity: 0.8 }}>{lang === 'es' ? 'perillas de escenario inactivas (el dato está medido); las de análisis siguen vivas ↓' : 'scenario knobs inactive (the datum is measured); the analysis knobs stay live ↓'}{base.orders ? (lang === 'es' ? ' · eje en ÓRDENES (×rev)' : ' · axis in ORDERS (×rev)') : ''}</span>
            </div>
          </>
        ) : trajMode ? (
          <>
            <label className="rv-ctl">{lang === 'es' ? 'Trayectoria real (run-to-failure)' : 'Real trajectory (run-to-failure)'}
              <select className="select" value={rulSource} onChange={(e) => setRulSource(e.target.value)}>
                {RTF_SETS.map((s) => { const items = femtoTrajs.filter((ft) => ft.set === s.set && ft.trueFail != null); return items.length ? <optgroup key={s.set} label={s.label}>{items.map((ft) => <option key={`${ft.set}:${ft.id}`} value={`${ft.set}:${ft.id}`}>{ft.id} · {ft.condition} · {ft.rpm} rpm</option>)}</optgroup> : null; })}
              </select>
            </label>
            {activeFrames && activeFrames.frames.length > 0 && (() => { const fk = activeFrames.frames[Math.min(frameIdx, activeFrames.frames.length - 1)]; return (
              <label className="rv-ctl">{lang === 'es' ? 'Instante de vida' : 'Life instant'}: {(fk.frac * 100).toFixed(0)}% · {fk.t.toFixed(2)} h · RMS {fk.rms.toFixed(2)} g
                <input className="range" type="range" min={0} max={activeFrames.frames.length - 1} step={1} value={Math.min(frameIdx, activeFrames.frames.length - 1)} onChange={(e) => setFrameIdx(+e.target.value)} />
              </label>); })()}
            <div className="muted small" style={{ margin: '0.1rem 0 0.5rem', lineHeight: 1.5 }}>
              {lang === 'es' ? 'run-to-failure medido' : 'measured run-to-failure'} · {lang === 'es' ? 'RMS de aceleración' : 'acceleration RMS'} · {lang === 'es' ? 'verdad' : 'truth'}: <b>{isFinite(rtfShown.trueFail) ? `${rtfShown.trueFail.toFixed(1)} h` : '—'}</b><br />
              <span style={{ opacity: 0.8 }}>{activeFrames && activeFrames.frames.length
                ? (lang === 'es' ? 'las herramientas corren sobre la ventana medida de cada instante; el waterfall es la degradación REAL' : 'the tools run on the measured window at each instant; the waterfall is the REAL degradation')
                : (lang === 'es' ? 'solo aplica el pronóstico (RUL) sobre la curva HI medida' : 'only the prognosis (RUL) applies on the measured HI curve')}
              {base.noGeom ? (lang === 'es' ? ' · sin geometría publicada → sin marcadores de falla' : ' · no published geometry → no fault-frequency markers') : ''}</span>
            </div>
          </>
        ) : (
          <>
            <div className="rv-scenarios">
              {SCENARIOS.map((s) => <button key={s.id} className={`chip ${fault === s.fault ? 'on' : ''}`} onClick={() => { setFault(s.fault); setSeverity(s.spec.severity || 1); setRpm(s.spec.rpm); setSnr(s.spec.snrDb); }}>{faultLabel(s.fault)}</button>)}
            </div>
            <label className="rv-ctl">{t.bearing}<select className="select" value={bearingId} onChange={(e) => setBearingId(e.target.value)}>{BEARINGS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select></label>
            <label className="rv-ctl">{t.fault}<select className="select" value={fault} onChange={(e) => setFault(e.target.value as FaultKind)}>{FAULTS.map((k) => <option key={k} value={k}>{faultLabel(k)}</option>)}</select></label>
            <label className="rv-ctl">{t.severity}: {severity.toFixed(2)}<input className="range" type="range" min={0} max={1.5} step={0.05} value={severity} disabled={fault === 'healthy'} onChange={(e) => setSeverity(+e.target.value)} /></label>
            <label className="rv-ctl">{t.rpm}: {rpm}<input className="range" type="range" min={600} max={3600} step={1} value={rpm} onChange={(e) => setRpm(+e.target.value)} /></label>
            <label className="rv-ctl">{t.snr}: {snr}<input className="range" type="range" min={-8} max={12} step={1} value={snr} onChange={(e) => setSnr(+e.target.value)} /></label>
          </>
        )}

        {/* Analysis params drive HOW any signal is processed (band/envelope/harmonics/ISO) — they apply to EVERY mode
            now that real trajectory frames are real windows too, so they stay live throughout. */}
        <div className="rv-analysis" style={{ borderTop: '1px solid var(--color-border)', marginTop: '0.4rem', paddingTop: '0.4rem' }}>
          <div className="muted small" style={{ fontWeight: 700, letterSpacing: '0.03em', marginBottom: '0.2rem' }}>{t.anlys}</div>
          <label className="rv-ctl">{t.aBand}<select className="select" value={bandMethod} onChange={(e) => setBandMethod(e.target.value as 'auto' | 'fixed' | 'manual' | 'iesfo')}><option value="auto">{t.bAuto}</option><option value="iesfo">{t.bIesfo}</option><option value="fixed">{t.bFixed}</option><option value="manual">{t.bManual}</option></select></label>
          <label className="rv-ctl">{t.aEnv}<select className="select" value={envSquared ? 'sq' : 'mag'} onChange={(e) => setEnvSquared(e.target.value === 'sq')}><option value="sq">{t.eSq}</option><option value="mag">{t.eMag}</option></select></label>
          <label className="rv-ctl">{t.aHarm}: {nHarm}<input className="range" type="range" min={3} max={8} step={1} value={nHarm} onChange={(e) => setNHarm(+e.target.value)} /></label>
          <label className="rv-ctl">{t.aIso}<select className="select" value={isoClass} onChange={(e) => setIsoClass(e.target.value)}>{Object.entries(ISO_CLASSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
        </div>

        {/* Classical/learned diagnosis + severity gauge + fault-frequency readout need known fault geometry: synthetic,
            CWRU and XJTU (real published orders). Hidden for FEMTO/IMS run-to-failure (no geometry → base.noGeom). */}
        {!base.noGeom && (<>
        {/* In trajectory (run-to-failure) mode the single-threshold classifier is calibrated on the synthetic
            contrast and doesn't transfer; instead of a misleading binary verdict we surface the fault-frequency
            family with the strongest spectral evidence (the prominence ranking the user reads off the SES). */}
        <div className="rv-diag card" data-fault={trajMode ? dx.scores[0].kind : dx.top}>
          <div className="rv-diag-top"><span className="muted small">{trajMode ? (lang === 'es' ? 'Frec. de falla (evidencia)' : 'Fault freqs (evidence)') : realMode ? (lang === 'es' ? 'Envolvente/SES (clásico)' : 'Envelope/SES (classical)') : t.diag}</span><strong>{faultLabel(trajMode ? dx.scores[0].kind : dx.top)}</strong>{!trajMode && <span className="muted small">{(dx.confidence * 100).toFixed(0)}% {t.conf}</span>}</div>
          {dx.scores.map((s) => <div key={s.kind} className="rv-bar"><span>{faultLabel(s.kind)}</span><div className="rv-bar-t"><i style={{ width: `${Math.min(100, (s.score / (dx.scores[0].score || 1)) * 100)}%` }} /></div><span className="mono">{s.score.toFixed(1)}×</span></div>)}
        </div>
        {realMode && realDx && activeSeg && (() => {
          // cross-domain truth-check: map the dataset's truth class to its CWRU-WDCNN counterpart (null = none, e.g. cage)
          const expected = activeSeg.wdcnnClasses[base.trueCls || ''] ?? null;
          const cross = activeSeg.wdcnnMode === 'cross';
          const hit = expected != null && realDx.predClass === expected;
          return (
          <div className="rv-diag card" style={{ marginTop: '0.4rem' }} data-fault={realDx.predClass}>
            <div className="rv-diag-top"><span className="muted small">WDCNN (ONNX){cross ? ' · cross-domain' : ''}</span><strong>{faultLabel(realDx.predClass)}</strong><span className="muted small">{(Math.max(...realDx.probs) * 100).toFixed(0)}%</span></div>
            <div className="muted small">{cross ? (lang === 'es' ? 'modelo entrenado en CWRU, sobre otro dominio' : 'CWRU-trained model, on another domain') : (lang === 'es' ? 'modelo aprendido, en vivo sobre el segmento real' : 'learned model, live on the real segment')} · {expected == null ? (lang === 'es' ? 'clase sin contraparte CWRU' : 'class has no CWRU counterpart') : <>{hit ? '✓' : '✗'} {lang === 'es' ? 'vs verdad' : 'vs truth'} <b>{faultLabel(base.trueCls || '')}</b></>}</div>
          </div>);
        })()}
        <Gauge title={t.sev} value={sev} max={12} unit="×" zones={[{ upTo: 3, color: '#3fb950', label: 'Healthy' }, { upTo: 6, color: '#58a6ff', label: 'Watch' }, { upTo: 9, color: '#d29922', label: 'Alarm' }, { upTo: 12, color: '#f85149', label: 'Trip' }]} />
        <div className="rv-freqs small"><div className="muted">{t.freqs} · {base.orders ? (lang === 'es' ? 'órdenes (×rev)' : 'orders (×rev)') : `fr = ${fr.toFixed(1)} Hz`}</div><span style={{ color: C.outer }}>BPFO {base.f.bpfo.toFixed(base.orders ? 2 : 1)}</span> · <span style={{ color: C.inner }}>BPFI {base.f.bpfi.toFixed(base.orders ? 2 : 1)}</span> · <span style={{ color: C.ball }}>2·BSF {(2 * base.f.bsf).toFixed(base.orders ? 2 : 1)}</span> · FTF {base.f.ftf.toFixed(base.orders ? 2 : 1)} {base.orders ? 'ord' : 'Hz'}</div>
        </>)}
      </aside>
      <div className="rv-main">
        <Tabs key={source} tabs={tabsShown} ariaLabel="analysis" />
      </div>
    </div>
  );
}
