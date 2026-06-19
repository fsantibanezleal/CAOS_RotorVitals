import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type uPlot from 'uplot';
import { Tabs, useShellLang } from '@fasl-work/caos-app-shell';
import { synth, type SignalSpec } from '../dsp/signal';
import { magSpectrum, envelopeSpectrum } from '../dsp/envelope';
import { kurtogram } from '../dsp/kurtogram';
import { diagnose } from '../dsp/diagnose';
import { defectFreqs, type FaultKind } from '../dsp/bearing';
import { BEARINGS, bearingById } from '../data/bearings';
import { SCENARIOS } from '../data/scenarios';
import { runToFailure } from '../data/runtofailure';
import { projectRUL } from '../dsp/health';
import { UPlotChart } from '../viz/UPlotChart';
import { lineOpts, combsPlugin, regionsPlugin, vmarksPlugin, selectPlugin, type Comb } from '../viz/uplotKit';
import { minMaxDecimate } from '../viz/decimate';
import { Kurtogram } from '../viz/Kurtogram';
import { Gauge } from '../viz/Gauge';
import { RulChart } from '../viz/RulChart';
import { Heatmap2D } from '../viz/Heatmap2D';
import { CampbellPanel } from '../viz/CampbellPanel';
import { GramPanel } from '../viz/GramPanel';
import { IsoTrendPanel } from '../viz/IsoTrendPanel';
import { FeatureSpacePanel } from '../viz/FeatureSpacePanel';
import { PrognosticEvalPanel } from '../viz/PrognosticEvalPanel';
import { DegradationReplayController } from '../viz/DegradationReplayController';
import { buildLifeSnapshots, interpHI } from '../dsp/replay';
import { PeakTable } from '../viz/PeakTable';
import { realCepstrum } from '../dsp/cepstrum';
import { spectrogram } from '../dsp/spectrogram';
import { cyclicModulationSpectrum } from '../dsp/csc';

// lazy-load three.js (the 3D waterfall) so it ships in its own chunk, off the main bundle
const Waterfall3D = lazy(() => import('../viz/Waterfall3D').then((m) => ({ default: m.Waterfall3D })));

const FAULTS: FaultKind[] = ['healthy', 'outer', 'inner', 'ball'];
const C = { outer: '#f59f00', inner: '#f06595', ball: '#7c5cff', shaft: '#3fb950', band: '#58a6ff', outlier: '#f85149', window: '#d29922' };
const FS = 12000;

const T = {
  en: { bearing: 'Bearing', fault: 'Planted fault', severity: 'Severity', rpm: 'Shaft speed (rpm)', snr: 'SNR (dB)',
    diag: 'Diagnosis', conf: 'confidence', sev: 'Fault severity index', band: 'Demod band', clickKg: 'Click a kurtogram cell to set the band → SES updates live.',
    f_healthy: 'Healthy', f_outer: 'Outer race (BPFO)', f_inner: 'Inner race (BPFI)', f_ball: 'Ball (2·BSF)',
    tSig: 'Signal & spectrum', tEnv: 'Envelope · SES', tKur: 'Kurtogram', tGram: 'Infogram', tCam: 'Campbell / order', tRul: 'Prognostics · RUL', tEval: 'RUL eval', tIso: 'ISO trend', tFeat: 'Feature space', tWat: '3D waterfall', tSpec: 'Spectrogram', cep: 'Cepstrum (1/fr · 1/BPFO rahmonics marked)', spectroT: 'STFT spectrogram (dB) — hover reads (t,f,dB); box = demod band', spectroNote: 'Time-frequency: WHEN and in which band the impulsive fault energy appears (confirms stationarity).', tCsc: 'Cyclostationary', cscT: 'Cyclic spectral coherence (CMS) — vertical α-ridges at the fault frequencies', cscNote: 'Carrier f × cyclic frequency α. A real bearing fault is cyclostationary: it forms a vertical α-ridge family at BPFO/BPFI/2·BSF (independent of carrier), separating it from coincidental peaks. Fast CMS estimator (not full Fast-SC).',
    waveform: 'Vibration waveform — drag to zoom, hover to read; ▼=outliers, shaded=BPFO windows', spectrum: 'Raw spectrum (dB) — drag to zoom; click to set a harmonic comb; shaded=demod band',
    ses: 'Squared-envelope spectrum — defect-frequency combs (BPFO/BPFI/2·BSF/fr)', watNote: 'Run-to-failure spectral waterfall (synthetic): each row is a life snapshot, height is amplitude. Watch the BPFO ridge emerge and grow. Drag to rotate.',
    rulNote: 'Health-indicator trend with onset, failure threshold and the RUL projection fan (±2σ).',
    onset: 'Onset', rul: 'RUL', fail: 'Proj. failure', h: 'h', freqs: 'Kinematic frequencies', replay: 'Replay degradation' },
  es: { bearing: 'Rodamiento', fault: 'Falla plantada', severity: 'Severidad', rpm: 'Velocidad eje (rpm)', snr: 'SNR (dB)',
    diag: 'Diagnóstico', conf: 'confianza', sev: 'Índice de severidad', band: 'Banda demod', clickKg: 'Clic en una celda del kurtograma para fijar la banda → el SES se actualiza en vivo.',
    f_healthy: 'Sano', f_outer: 'Pista externa (BPFO)', f_inner: 'Pista interna (BPFI)', f_ball: 'Bola (2·BSF)',
    tSig: 'Señal y espectro', tEnv: 'Envolvente · SES', tKur: 'Kurtograma', tGram: 'Infograma', tCam: 'Campbell / orden', tRul: 'Prognóstico · RUL', tEval: 'Eval RUL', tIso: 'Tendencia ISO', tFeat: 'Espacio features', tWat: 'Waterfall 3D', tSpec: 'Espectrograma', cep: 'Cepstrum (rahmónicos 1/fr · 1/BPFO marcados)', spectroT: 'Espectrograma STFT (dB) — hover lee (t,f,dB); caja = banda demod', spectroNote: 'Tiempo-frecuencia: CUÁNDO y en qué banda aparece la energía impulsiva de falla (confirma estacionariedad).', tCsc: 'Cicloestacionario', cscT: 'Coherencia espectral cíclica (CMS) — crestas α verticales en las frecuencias de falla', cscNote: 'Portadora f × frecuencia cíclica α. Una falla real es cicloestacionaria: forma una familia de crestas α verticales en BPFO/BPFI/2·BSF (independiente de la portadora), separándola de picos casuales. Estimador CMS rápido (no Fast-SC completo).',
    waveform: 'Forma de onda — arrastra para zoom, hover para leer; ▼=outliers, sombreado=ventanas BPFO', spectrum: 'Espectro crudo (dB) — arrastra para zoom; clic para fijar un peine de armónicos; sombreado=banda demod',
    ses: 'Espectro de envolvente al cuadrado — peines de frecuencias de falla (BPFO/BPFI/2·BSF/fr)', watNote: 'Waterfall espectral run-to-failure (sintético): cada fila es una instantánea de vida, la altura es amplitud. Observa la cresta BPFO emerger y crecer. Arrastra para rotar.',
    rulNote: 'Tendencia del indicador de salud con onset, umbral de falla y el abanico de proyección de RUL (±2σ).',
    onset: 'Onset', rul: 'RUL', fail: 'Falla proy.', h: 'h', freqs: 'Frecuencias cinemáticas', replay: 'Reproducir degradación' },
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
  // degradation replay (life-position scrubber)
  const [replayOn, setReplayOn] = useState(false);
  const [lifePos, setLifePos] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [bandBrush, setBandBrush] = useState(false); // spectrum drag selects the demod band → live SES

  const seed = useMemo(() => SCENARIOS.find((s) => s.fault === fault)?.spec.seed ?? 202, [fault]);
  const fr = rpm / 60;

  // base signal + raw spectrum + kurtogram (band-independent)
  const base = useMemo(() => {
    const bearing = bearingById(bearingId);
    const spec: SignalSpec = { fs: FS, dur: 1, rpm, bearing, fault, severity: fault === 'healthy' ? 0 : severity, resonance: 3400, zeta: 0.04, snrDb: snr, seed };
    const sig = synth(spec);
    const raw = magSpectrum(sig.x, FS);
    const kg = kurtogram(sig.x, FS, 5);
    const f = defectFreqs(bearing, fr);
    return { sig, raw, kg, f };
  }, [bearingId, fault, severity, rpm, snr, seed, fr]);

  useEffect(() => { setBand(null); setFund(null); }, [base]);

  const effBand = useMemo<[number, number]>(() => band ?? [Math.max(base.kg.best.f1, 0.02 * FS), base.kg.best.f2], [band, base]);
  const ses = useMemo(() => envelopeSpectrum(base.sig.x, FS, effBand), [base, effBand]);
  const dx = useMemo(() => diagnose(ses, base.f), [ses, base]);
  const sev = dx.scores[0]?.score ?? 0;

  // ---- chart data (memoized) ----
  const waveData = useMemo<uPlot.AlignedData>(() => { const [x, y] = minMaxDecimate(base.sig.t, base.sig.x, 0.08, 700); return [x, y]; }, [base]);
  const specData = useMemo<uPlot.AlignedData>(() => {
    const f = base.raw.freq, m = base.raw.mag; const xs: number[] = [], ys: number[] = [];
    for (let i = 0; i < f.length; i++) { if (f[i] > 6000) break; xs.push(f[i]); ys.push(20 * Math.log10(Math.max(m[i], 1e-9))); }
    return [xs, ys];
  }, [base]);
  const sesXmax = Math.min(700, 10 * base.f.bpfo);
  const liveSesData = useMemo<uPlot.AlignedData>(() => {
    const f = ses.freq, m = ses.mag; const xs: number[] = [], ys: number[] = [];
    for (let i = 0; i < f.length; i++) { if (f[i] > sesXmax) break; xs.push(f[i]); ys.push(m[i]); }
    return [xs, ys];
  }, [ses, sesXmax]);
  // degradation replay snapshots — built only while replay is engaged (zero cost when off)
  const replaySnaps = useMemo(() => (replayOn ? buildLifeSnapshots({ bearing: bearingById(bearingId), fault, severityEnd: severity, rpm, snrDb: snr, sesXmax }) : null), [replayOn, bearingId, fault, severity, rpm, snr, sesXmax]);
  const curSnap = replaySnaps ? replaySnaps[Math.round(lifePos * (replaySnaps.length - 1))] : null;
  const sesData = curSnap ? (curSnap.sesData as uPlot.AlignedData) : liveSesData;
  const spectro = useMemo(() => spectrogram(base.sig.x, FS, 512, 0.75), [base]);
  const cep = useMemo(() => realCepstrum(base.sig.x, FS), [base]);
  const cepData = useMemo<uPlot.AlignedData>(() => { const q = cep.quef, a = cep.amp; const xs: number[] = [], ys: number[] = []; for (let i = 1; i < q.length; i++) { if (q[i] > 0.05) break; xs.push(q[i]); ys.push(a[i]); } return [xs, ys]; }, [cep]);
  const csc = useMemo(() => cyclicModulationSpectrum(base.sig.x, FS, 128, 8, 800), [base]);
  const cscVlines = useMemo(() => [{ x: base.f.bpfo, color: C.outer, label: 'BPFO' }, { x: base.f.bpfi, color: C.inner, label: 'BPFI' }, { x: 2 * base.f.bsf, color: C.ball, label: '2·BSF' }, { x: base.f.ftf, color: '#3fb1c8', label: 'FTF' }], [base]);

  // outliers + BPFO detection windows on the waveform (first 0.08 s)
  const waveMarks = useMemo(() => {
    const x = base.sig.x, ts = base.sig.t; let p = 0, n = 0;
    for (let i = 0; i < ts.length && ts[i] <= 0.08; i++) { p += x[i] * x[i]; n++; }
    const rms = Math.sqrt(p / Math.max(1, n)); const outliers: number[] = [];
    for (let i = 0; i < ts.length && ts[i] <= 0.08; i++) if (Math.abs(x[i]) > 5 * rms && outliers.length < 60) outliers.push(ts[i]);
    const windows: [number, number][] = [];
    if (fault !== 'healthy' && base.f.bpfo > 0) { const per = 1 / base.f.bpfo; for (let k = 0; k * per < 0.08; k++) windows.push([k * per, k * per + Math.min(0.0015, per * 0.2)]); }
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
    if (bandBrush) p.push(selectPlugin((lo, hi) => setBand([Math.max(lo, 0.02 * FS), hi])));
    return p;
  }, [effBand, specCombs, bandBrush]);
  const sesCombs = useMemo<Comb[]>(() => [
    { base: base.f.bpfo, harmonics: 6, color: C.outer, label: `BPFO ${base.f.bpfo.toFixed(1)} Hz` },
    { base: base.f.bpfi, harmonics: 5, color: C.inner, label: `BPFI ${base.f.bpfi.toFixed(1)} Hz` },
    { base: 2 * base.f.bsf, harmonics: 4, color: C.ball, label: `2·BSF ${(2 * base.f.bsf).toFixed(1)} Hz` },
    { base: fr, harmonics: 3, color: C.shaft, label: `fr ${fr.toFixed(1)} Hz` },
  ], [base, fr]);
  const sesPlugins = useMemo(() => [combsPlugin(sesCombs)], [sesCombs]);
  const cepCombs = useMemo<Comb[]>(() => ([{ base: 1 / fr, harmonics: 4, color: C.shaft, label: '1/fr' }, ...(base.f.bpfo > 0 ? [{ base: 1 / base.f.bpfo, harmonics: 3, color: C.outer, label: '1/BPFO' }] : [])]), [fr, base]);
  const cepPlugins = useMemo(() => [combsPlugin(cepCombs)], [cepCombs]);

  const onClickSpec = useCallback((x: number) => {
    const f = base.raw.freq, m = base.raw.mag; const tol = Math.max(20, 0.02 * x); let bestI = -1, bestV = -1;
    for (let i = 0; i < f.length; i++) { if (Math.abs(f[i] - x) <= tol && m[i] > bestV) { bestV = m[i]; bestI = i; } if (f[i] > x + tol) break; }
    setFund(bestI >= 0 ? f[bestI] : x);
  }, [base]);

  const onPickBand = useCallback((b: [number, number]) => setBand(b), []);

  // ---- run-to-failure (RUL + 3D waterfall) — REACT to the selected scenario ----
  const bearingHash = useMemo(() => bearingId.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0), [bearingId]);
  const rtf = useMemo(() => runToFailure({ seed: seed + bearingHash, fault, severity }), [seed, bearingHash, fault, severity]);
  const rul = useMemo(() => projectRUL(rtf.points, rtf.threshold), [rtf]);
  // replay-derived 'now' position fed to the RUL chart + 3D waterfall while replay is engaged
  const replayLifeH = isFinite(rtf.trueFail) ? rtf.trueFail : 60;
  const nowT = replayOn ? lifePos * replayLifeH : undefined;
  const nowHi = nowT != null ? interpHI(rtf.points, nowT) : undefined;
  // the run-to-failure waterfall demodulates the SAME fault/bearing/rpm/severity as the live case,
  // so the emerging ridge sits at the active defect frequency and the surface scales with severity.
  const WAT_FMAX = 600;
  const waterfall = useMemo(() => {
    const rows = 26, fmax = WAT_FMAX, cols = 110; const grid: number[][] = []; let gmax = 1e-9;
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
  }, [bearingId, fault, rpm, severity]);
  // defect frequency of the active fault → labels the emerging ridge in the 3D waterfall
  const ridge = useMemo(() => {
    const hz = fault === 'outer' ? base.f.bpfo : fault === 'inner' ? base.f.bpfi : fault === 'ball' ? 2 * base.f.bsf : 0;
    const label = fault === 'outer' ? 'BPFO' : fault === 'inner' ? 'BPFI' : fault === 'ball' ? '2·BSF' : '';
    return { hz, label };
  }, [fault, base]);

  const faultLabel = (k: string) => (t as Record<string, string>)[`f_${k}`] ?? k;

  const tabs = [
    { id: 'sig', label: t.tSig, content: (
      <div className="rv-vizstack">
        <div className="rv-plot"><div className="rv-plot-t">{t.waveform}</div><UPlotChart data={waveData} build={buildWave} plugins={wavePlugins} height={170} /></div>
        <div className="rv-plot"><div className="rv-plot-t rv-plot-th"><span>{t.spectrum}</span><button className={`chip ${bandBrush ? 'on' : ''}`} onClick={() => setBandBrush((v) => !v)}>{lang === 'es' ? 'pincel banda → SES' : 'brush band → SES'}</button></div><UPlotChart data={specData} build={buildSpec} plugins={specPlugins} height={185} onClickX={bandBrush ? undefined : onClickSpec} /></div>
      </div>) },
    { id: 'env', label: t.tEnv, content: (
      <div className="rv-vizstack">
        <p className="hint">{t.band}: <b>{(effBand[0] / 1000).toFixed(2)}–{(effBand[1] / 1000).toFixed(2)} kHz</b> · {t.clickKg}</p>
        <div className="rv-plot"><div className="rv-plot-t">{t.ses}</div><UPlotChart data={sesData} build={buildSes} plugins={sesPlugins} height={200} /></div>
        <PeakTable ses={ses} f={base.f} lang={lang} />
        <div className="rv-plot"><div className="rv-plot-t">{t.cep}</div><UPlotChart data={cepData} build={buildCep} plugins={cepPlugins} height={150} /></div>
      </div>) },
    { id: 'spec', label: t.tSpec, content: (
      <div className="rv-vizstack"><div className="rv-plot"><div className="rv-plot-t">{t.spectroT}</div><Heatmap2D cols={spectro.cols} times={spectro.times} freqs={spectro.freqs} fmax={6000} band={effBand} /></div><p className="hint">{t.spectroNote}</p></div>) },
    { id: 'csc', label: t.tCsc, content: (
      <div className="rv-vizstack"><div className="rv-plot"><div className="rv-plot-t">{t.cscT}</div><Heatmap2D cols={csc.cols} times={csc.alpha} freqs={csc.carriers} fmax={6000} norm="lin" unit="coh" xunit="Hz" xlabel="α (Hz)" ylabel="carrier (Hz)" vlines={cscVlines} height={260} /></div><p className="hint">{t.cscNote}</p></div>) },
    { id: 'kur', label: t.tKur, content: (
      <div className="rv-vizstack"><Kurtogram kg={base.kg} fs={FS} onPick={onPickBand} /><p className="hint">{t.clickKg}</p></div>) },
    { id: 'gram', label: t.tGram, content: (
      <GramPanel x={base.sig.x} fs={FS} onPick={onPickBand} lang={lang} />) },
    { id: 'cam', label: t.tCam, content: (
      <CampbellPanel bearing={bearingById(bearingId)} fault={fault} severity={severity} snr={snr} seed={seed} rpm={rpm} lang={lang} />) },
    { id: 'wat', label: t.tWat, content: (
      <div className="rv-vizstack"><Suspense fallback={<p className="hint">3D…</p>}><Waterfall3D grid={waterfall} fmax={WAT_FMAX} ridgeHz={ridge.hz} ridgeLabel={ridge.label} lifeH={isFinite(rtf.trueFail) ? rtf.trueFail : 100} lifeRow={replayOn ? lifePos : null} /></Suspense><p className="hint">{t.watNote}</p></div>) },
    { id: 'rul', label: t.tRul, content: (
      <div className="rv-vizstack"><RulChart points={rtf.points} rul={rul} nowT={nowT} nowHi={nowHi} /><p className="hint">{t.rulNote}</p>
        <div className="rv-rul-read"><span>{t.onset}: <b>{rul.onset != null ? `${rul.onset.toFixed(0)} ${t.h}` : '—'}</b></span><span>{t.rul}: <b>{rul.rul != null ? `${rul.rul.toFixed(0)} ${t.h}` : '—'}</b></span><span>{t.fail}: <b>{rul.failTime != null ? `${rul.failTime.toFixed(0)} ${t.h}` : '—'}</b></span></div>
      </div>) },
    { id: 'eval', label: t.tEval, content: (
      <PrognosticEvalPanel rtf={rtf} fault={fault} severity={severity} lang={lang} />) },
    { id: 'iso', label: t.tIso, content: (
      <IsoTrendPanel bearing={bearingById(bearingId)} fault={fault} severity={severity} snr={snr} rpm={rpm} lifeH={isFinite(rtf.trueFail) ? rtf.trueFail : 60} lang={lang} />) },
    { id: 'feat', label: t.tFeat, content: (
      <FeatureSpacePanel bearing={bearingById(bearingId)} fault={fault} severity={severity} snr={snr} rpm={rpm} lifeH={isFinite(rtf.trueFail) ? rtf.trueFail : 60} lang={lang} />) },
  ];

  return (
    <div className="page-body rv-layout">
      <aside className="rv-side">
        <div className="rv-scenarios">
          {SCENARIOS.map((s) => <button key={s.id} className={`chip ${fault === s.fault ? 'on' : ''}`} onClick={() => { setFault(s.fault); setSeverity(s.spec.severity || 1); setRpm(s.spec.rpm); setSnr(s.spec.snrDb); }}>{faultLabel(s.fault)}</button>)}
        </div>
        <label className="rv-ctl">{t.bearing}<select className="select" value={bearingId} onChange={(e) => setBearingId(e.target.value)}>{BEARINGS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select></label>
        <label className="rv-ctl">{t.fault}<select className="select" value={fault} onChange={(e) => setFault(e.target.value as FaultKind)}>{FAULTS.map((k) => <option key={k} value={k}>{faultLabel(k)}</option>)}</select></label>
        <label className="rv-ctl">{t.severity}: {severity.toFixed(2)}<input className="range" type="range" min={0} max={1.5} step={0.05} value={severity} disabled={fault === 'healthy'} onChange={(e) => setSeverity(+e.target.value)} /></label>
        <label className="rv-ctl">{t.rpm}: {rpm}<input className="range" type="range" min={600} max={3600} step={1} value={rpm} onChange={(e) => setRpm(+e.target.value)} /></label>
        <label className="rv-ctl">{t.snr}: {snr}<input className="range" type="range" min={-8} max={12} step={1} value={snr} onChange={(e) => setSnr(+e.target.value)} /></label>
        <div className="rv-diag card" data-fault={dx.top}>
          <div className="rv-diag-top"><span className="muted small">{t.diag}</span><strong>{faultLabel(dx.top)}</strong><span className="muted small">{(dx.confidence * 100).toFixed(0)}% {t.conf}</span></div>
          {dx.scores.map((s) => <div key={s.kind} className="rv-bar"><span>{faultLabel(s.kind)}</span><div className="rv-bar-t"><i style={{ width: `${Math.min(100, (s.score / (dx.scores[0].score || 1)) * 100)}%` }} /></div><span className="mono">{s.score.toFixed(1)}×</span></div>)}
        </div>
        <Gauge title={t.sev} value={sev} max={12} unit="×" zones={[{ upTo: 3, color: '#3fb950', label: 'Healthy' }, { upTo: 6, color: '#58a6ff', label: 'Watch' }, { upTo: 9, color: '#d29922', label: 'Alarm' }, { upTo: 12, color: '#f85149', label: 'Trip' }]} />
        <div className="rv-freqs small"><div className="muted">{t.freqs} · fr = {fr.toFixed(1)} Hz</div><span style={{ color: C.outer }}>BPFO {base.f.bpfo.toFixed(1)}</span> · <span style={{ color: C.inner }}>BPFI {base.f.bpfi.toFixed(1)}</span> · <span style={{ color: C.ball }}>2·BSF {(2 * base.f.bsf).toFixed(1)}</span> · FTF {base.f.ftf.toFixed(1)} Hz</div>
      </aside>
      <div className="rv-main">
        <div className="rv-replay-bar">
          <button className={`chip ${replayOn ? 'on' : ''}`} onClick={() => { setReplayOn((v) => !v); setPlaying(false); }}>{t.replay}</button>
          {replayOn && <DegradationReplayController lifePos={lifePos} setLifePos={setLifePos} lifeH={replayLifeH} onsetH={rul.onset} failH={rul.failTime ?? (isFinite(rtf.trueFail) ? rtf.trueFail : null)} curSev={curSnap?.sev ?? 0} curHi={nowHi ?? 0} playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed} lang={lang} />}
        </div>
        <Tabs tabs={tabs} ariaLabel="analysis" />
      </div>
    </div>
  );
}
