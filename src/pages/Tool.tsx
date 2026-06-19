import { useMemo, useState } from 'react';
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
import { Chart, type Comb } from '../viz/Chart';
import { Kurtogram } from '../viz/Kurtogram';
import { Gauge } from '../viz/Gauge';
import { RulChart } from '../viz/RulChart';

const FAULTS: FaultKind[] = ['healthy', 'outer', 'inner', 'ball'];
const C = { outer: '#f59f00', inner: '#f06595', ball: '#7c5cff', shaft: '#3fb950' };

const T = {
  en: { bearing: 'Bearing', fault: 'Planted fault', severity: 'Severity', rpm: 'Shaft speed (rpm)', snr: 'SNR (dB)',
    diag: 'Diagnosis', conf: 'confidence', sev: 'Fault severity index', band: 'Demodulation band (auto, from kurtogram)',
    fault_healthy: 'Healthy', fault_outer: 'Outer race (BPFO)', fault_inner: 'Inner race (BPFI)', fault_ball: 'Ball (2·BSF)',
    tSig: 'Signal & spectrum', tEnv: 'Envelope · SES', tKur: 'Kurtogram', tRul: 'Prognostics · RUL',
    waveform: 'Vibration waveform (g vs s)', spectrum: 'Raw spectrum (dB)', ses: 'Squared-envelope spectrum (SES)',
    kurNote: 'Spectral kurtosis over the (level, frequency) plane selects the band of maximal impulsiveness; that band feeds the SES.',
    rulNote: 'Run-to-failure health-indicator trend (RMS, g) with detected onset, failure threshold and the RUL projection fan (±2σ). Synthetic, XJTU-SY-like.',
    onset: 'Onset', rul: 'RUL', fail: 'Projected failure', hours: 'h', freqs: 'Kinematic fault frequencies' },
  es: { bearing: 'Rodamiento', fault: 'Falla plantada', severity: 'Severidad', rpm: 'Velocidad de eje (rpm)', snr: 'SNR (dB)',
    diag: 'Diagnóstico', conf: 'confianza', sev: 'Índice de severidad de falla', band: 'Banda de demodulación (auto, del kurtograma)',
    fault_healthy: 'Sano', fault_outer: 'Pista externa (BPFO)', fault_inner: 'Pista interna (BPFI)', fault_ball: 'Bola (2·BSF)',
    tSig: 'Señal y espectro', tEnv: 'Envolvente · SES', tKur: 'Kurtograma', tRul: 'Prognóstico · RUL',
    waveform: 'Forma de onda (g vs s)', spectrum: 'Espectro crudo (dB)', ses: 'Espectro de envolvente al cuadrado (SES)',
    kurNote: 'La kurtosis espectral sobre el plano (nivel, frecuencia) elige la banda de máxima impulsividad; esa banda alimenta el SES.',
    rulNote: 'Tendencia del indicador de salud run-to-failure (RMS, g) con onset detectado, umbral de falla y el abanico de proyección de RUL (±2σ). Sintético, tipo XJTU-SY.',
    onset: 'Onset', rul: 'RUL', fail: 'Falla proyectada', hours: 'h', freqs: 'Frecuencias cinemáticas de falla' },
};

export default function Tool() {
  const lang = useShellLang();
  const t = T[lang];
  const [bearingId, setBearingId] = useState('skf6205');
  const [fault, setFault] = useState<FaultKind>('outer');
  const [severity, setSeverity] = useState(1.0);
  const [rpm, setRpm] = useState(1772);
  const [snr, setSnr] = useState(2);

  const seed = useMemo(() => SCENARIOS.find((s) => s.fault === fault)?.spec.seed ?? 202, [fault]);

  const R = useMemo(() => {
    const bearing = bearingById(bearingId);
    const spec: SignalSpec = { fs: 12000, dur: 1, rpm, bearing, fault, severity: fault === 'healthy' ? 0 : severity, resonance: 3400, zeta: 0.04, snrDb: snr, seed };
    const sig = synth(spec);
    const raw = magSpectrum(sig.x, sig.fs);
    const kg = kurtogram(sig.x, sig.fs, 5);
    const lo = Math.max(kg.best.f1, 0.02 * sig.fs);
    const band: [number, number] = lo < kg.best.f2 ? [lo, kg.best.f2] : [2200, 4600];
    const ses = envelopeSpectrum(sig.x, sig.fs, band);
    const f = defectFreqs(bearing, rpm / 60);
    const dx = diagnose(ses, f);
    return { sig, raw, kg, band, ses, f, dx, fs: sig.fs };
  }, [bearingId, fault, severity, rpm, snr, seed]);

  const rtf = useMemo(() => runToFailure(), []);
  const rul = useMemo(() => projectRUL(rtf.points, rtf.threshold), [rtf]);

  const fr = rpm / 60;
  const spectrumCombs: Comb[] = [{ base: fr, harmonics: 6, color: C.shaft, label: 'fr' }];
  const sesCombs: Comb[] = [
    { base: R.f.bpfo, harmonics: 6, color: C.outer, label: 'BPFO' },
    { base: R.f.bpfi, harmonics: 5, color: C.inner, label: 'BPFI' },
    { base: 2 * R.f.bsf, harmonics: 4, color: C.ball, label: '2·BSF' },
    { base: fr, harmonics: 3, color: C.shaft, label: 'fr' },
  ];
  const faultLabel = (k: string) => (t as Record<string, string>)[`fault_${k}`] ?? k;
  const sev = R.dx.scores[0]?.score ?? 0;

  const tabs = [
    { id: 'sig', label: t.tSig, content: (
      <div className="rv-vizstack">
        <div className="rv-plot"><div className="rv-plot-t">{t.waveform}</div><Chart xs={R.sig.t} ys={R.sig.x} xmax={0.08} xlabel="s" /></div>
        <div className="rv-plot"><div className="rv-plot-t">{t.spectrum}</div><Chart xs={R.raw.freq} ys={R.raw.mag} ydb xmax={6000} combs={spectrumCombs} xlabel="Hz" /></div>
      </div>) },
    { id: 'env', label: t.tEnv, content: (
      <div className="rv-vizstack">
        <p className="hint">{t.band}: <b>{(R.band[0] / 1000).toFixed(2)}–{(R.band[1] / 1000).toFixed(2)} kHz</b></p>
        <div className="rv-plot"><div className="rv-plot-t">{t.ses}</div><Chart xs={R.ses.freq} ys={R.ses.mag} kind="stem" xmax={Math.min(700, 10 * R.f.bpfo)} combs={sesCombs} xlabel="Hz" /></div>
      </div>) },
    { id: 'kur', label: t.tKur, content: (
      <div className="rv-vizstack">
        <Kurtogram kg={R.kg} fs={R.fs} />
        <p className="hint">{t.kurNote}</p>
      </div>) },
    { id: 'rul', label: t.tRul, content: (
      <div className="rv-vizstack">
        <RulChart points={rtf.points} rul={rul} />
        <p className="hint">{t.rulNote}</p>
        <div className="rv-rul-read">
          <span>{t.onset}: <b>{rul.onset != null ? `${rul.onset.toFixed(0)} ${t.hours}` : '—'}</b></span>
          <span>{t.rul}: <b>{rul.rul != null ? `${rul.rul.toFixed(0)} ${t.hours}` : '—'}</b></span>
          <span>{t.fail}: <b>{rul.failTime != null ? `${rul.failTime.toFixed(0)} ${t.hours}` : '—'}</b></span>
        </div>
      </div>) },
  ];

  return (
    <div className="page-body rv-layout">
      <aside className="rv-side">
        <div className="rv-scenarios">
          {SCENARIOS.map((s) => (
            <button key={s.id} className={`chip ${fault === s.fault ? 'on' : ''}`} onClick={() => { setFault(s.fault); setSeverity(s.spec.severity || 1); setRpm(s.spec.rpm); setSnr(s.spec.snrDb); }}>{faultLabel(s.fault)}</button>
          ))}
        </div>
        <label className="rv-ctl">{t.bearing}<select className="select" value={bearingId} onChange={(e) => setBearingId(e.target.value)}>{BEARINGS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select></label>
        <label className="rv-ctl">{t.fault}<select className="select" value={fault} onChange={(e) => setFault(e.target.value as FaultKind)}>{FAULTS.map((k) => <option key={k} value={k}>{faultLabel(k)}</option>)}</select></label>
        <label className="rv-ctl">{t.severity}: {severity.toFixed(2)}<input className="range" type="range" min={0} max={1.5} step={0.05} value={severity} disabled={fault === 'healthy'} onChange={(e) => setSeverity(+e.target.value)} /></label>
        <label className="rv-ctl">{t.rpm}: {rpm}<input className="range" type="range" min={600} max={3600} step={1} value={rpm} onChange={(e) => setRpm(+e.target.value)} /></label>
        <label className="rv-ctl">{t.snr}: {snr}<input className="range" type="range" min={-8} max={12} step={1} value={snr} onChange={(e) => setSnr(+e.target.value)} /></label>

        <div className="rv-diag card" data-fault={R.dx.top}>
          <div className="rv-diag-top"><span className="muted small">{t.diag}</span><strong>{faultLabel(R.dx.top)}</strong><span className="muted small">{(R.dx.confidence * 100).toFixed(0)}% {t.conf}</span></div>
          {R.dx.scores.map((s) => (
            <div key={s.kind} className="rv-bar"><span>{faultLabel(s.kind)}</span><div className="rv-bar-t"><i style={{ width: `${Math.min(100, (s.score / (R.dx.scores[0].score || 1)) * 100)}%` }} /></div><span className="mono">{s.score.toFixed(1)}×</span></div>
          ))}
        </div>
        <Gauge title={t.sev} value={sev} max={12} unit="×" zones={[{ upTo: 3, color: '#3fb950', label: 'Healthy' }, { upTo: 6, color: '#58a6ff', label: 'Watch' }, { upTo: 9, color: '#d29922', label: 'Alarm' }, { upTo: 12, color: '#f85149', label: 'Trip' }]} />
        <div className="rv-freqs small">
          <div className="muted">{t.freqs} · fr = {fr.toFixed(1)} Hz</div>
          <span style={{ color: C.outer }}>BPFO {R.f.bpfo.toFixed(1)}</span> · <span style={{ color: C.inner }}>BPFI {R.f.bpfi.toFixed(1)}</span> · <span style={{ color: C.ball }}>2·BSF {(2 * R.f.bsf).toFixed(1)}</span> · FTF {R.f.ftf.toFixed(1)} Hz
        </div>
      </aside>
      <div className="rv-main"><Tabs tabs={tabs} ariaLabel="analysis" /></div>
    </div>
  );
}
