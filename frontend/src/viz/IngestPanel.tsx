import { useState } from 'react';
import { parseSignal } from '../dsp/parseSignal';
import { envelopeSpectrum } from '../dsp/envelope';
import { kurtogram } from '../dsp/kurtogram';
import { diagnose } from '../dsp/diagnose';
import { velocityRmsMmps } from '../dsp/iso';
import { recommend } from '../dsp/recommend';
import { defectFreqs, type Bearing } from '../dsp/bearing';
import { BEARINGS, bearingById } from '../data/bearings';
import { synth } from '../dsp/signal';
import { type RulResult } from '../dsp/health';

// T6, Bring your own data. Runs the REAL unsupervised pipeline (kurtogram band → envelope/SES → diagnosis → the
// T5 recommendation) on a user-supplied vibration signal. The physics is rig-agnostic, so it works on any bearing;
// the learned WDCNN is NOT applied here, it is CWRU-specific (12 kHz / 2048 / SKF 6205), and applying it to a
// different rig is exactly the domain-shift T13 shows fails. Physics transfers; the learned model does not.
const EMPTY_RUL: RulResult = { onset: null, threshold: 1, failTime: null, rul: null, curve: [] };
const FAULT_COLOR: Record<string, string> = { healthy: '#3fb950', outer: '#f59f00', inner: '#f06595', ball: '#7c5cff' };
const PRIORITY_COLOR: Record<string, string> = { ok: '#3fb950', watch: '#58a6ff', plan: '#d29922', alarm: '#f0883e', trip: '#f85149' };

function analyze(x: Float64Array, fs: number, rpm: number, bearing: Bearing, lang: 'en' | 'es') {
  const fr = rpm / 60;
  const f = defectFreqs(bearing, fr);
  const kg = kurtogram(x, fs, 5);
  const band: [number, number] = [Math.max(kg.best.f1, 0.02 * fs), kg.best.f2];
  const ses = envelopeSpectrum(x, fs, band);
  const dx = diagnose(ses, f);
  const vrms = velocityRmsMmps(x, fs);
  const rec = recommend({ diag: dx, velocityRms: vrms, rul: EMPTY_RUL, lifeH: 1, lang });
  return { f, fr, band, ses, dx, vrms, rec };
}

// compact SVG envelope spectrum with the defect combs marked
function SesPlot({ ses, f, fr }: { ses: { freq: Float64Array; mag: Float64Array }; f: ReturnType<typeof defectFreqs>; fr: number }) {
  const W = 620, H = 180, padL = 8, padR = 8, padT = 10, padB = 22;
  const fmax = Math.min(ses.freq[ses.freq.length - 1], Math.max(10 * f.bpfo, 600));
  const xs: number[] = [], ys: number[] = [];
  let mx = 1e-12;
  for (let i = 0; i < ses.freq.length; i++) { if (ses.freq[i] > fmax) break; xs.push(ses.freq[i]); const m = ses.mag[i]; ys.push(m); if (m > mx) mx = m; }
  const sx = (fq: number) => padL + (fq / fmax) * (W - padL - padR);
  const sy = (m: number) => padT + (1 - m / mx) * (H - padT - padB);
  const combs: { base: number; color: string; label: string; n: number }[] = [
    { base: f.bpfo, color: FAULT_COLOR.outer, label: 'BPFO', n: 6 },
    { base: f.bpfi, color: FAULT_COLOR.inner, label: 'BPFI', n: 5 },
    { base: 2 * f.bsf, color: FAULT_COLOR.ball, label: '2·BSF', n: 4 },
    { base: fr, color: FAULT_COLOR.healthy, label: 'fr', n: 3 },
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="envelope spectrum" style={{ font: '10px var(--font-mono)' }}>
      <rect x="0" y="0" width={W} height={H} fill="var(--color-bg)" />
      {combs.flatMap((c) => c.base <= 0 ? [] : Array.from({ length: c.n }, (_, k) => {
        const fq = (k + 1) * c.base; if (fq > fmax) return null;
        return <line key={`${c.label}-${k}`} x1={sx(fq)} y1={padT} x2={sx(fq)} y2={H - padB} stroke={c.color} strokeWidth={k === 0 ? 1.4 : 0.8} strokeDasharray={k === 0 ? '' : '2 2'} opacity={k === 0 ? 0.9 : 0.45} />;
      }))}
      <polyline points={xs.map((fq: number, i: number) => `${sx(fq)},${sy(ys[i])}`).join(' ')} fill="none" stroke="#58a6ff" strokeWidth="1.1" />
      {combs.filter((c) => c.base > 0 && c.base <= fmax).map((c) => (
        <text key={c.label} x={sx(c.base) + 2} y={padT + 9} fill={c.color} fontWeight={700}>{c.label}</text>
      ))}
      <text x={W - padR} y={H - 6} textAnchor="end" fill="var(--color-fg-faint)">{fmax.toFixed(0)} Hz · envelope spectrum (your data)</text>
    </svg>
  );
}

export function IngestPanel({ lang }: { lang: 'en' | 'es' }) {
  const es = lang === 'es';
  const [text, setText] = useState('');
  const [fs, setFs] = useState(12000);
  const [rpm, setRpm] = useState(1730);
  const [bearingId, setBearingId] = useState('skf6205');
  const [result, setResult] = useState<ReturnType<typeof analyze> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const run = (raw: string) => {
    const p = parseSignal(raw);
    if (!p.ok || !p.x) { setErr(p.reason ?? 'parse error'); setResult(null); return; }
    setErr(null);
    setInfo(es ? `${p.n} muestras${p.skipped ? `, ${p.skipped} filas no numéricas omitidas` : ''}` : `${p.n} samples${p.skipped ? `, ${p.skipped} non-numeric rows skipped` : ''}`);
    setResult(analyze(p.x, fs, rpm, bearingById(bearingId), lang));
  };

  const onFile = (file: File) => { const r = new FileReader(); r.onload = () => { const t = String(r.result || ''); setText(t.slice(0, 4000)); run(t); }; r.readAsText(file); };
  const onExample = () => {
    // a clearly-labelled SYNTHETIC outer-race example (1 s @ 12 kHz), enough cycles for a robust SES, so the user
    // sees the identical real pipeline detect the fault before pasting their OWN data. Not re-hosted CWRU data.
    const exFs = 12000, exRpm = 1730, bId = 'skf6205';
    const sig = synth({ fs: exFs, dur: 1, rpm: exRpm, bearing: bearingById(bId), fault: 'outer', severity: 1.0, resonance: 3400, zeta: 0.04, snrDb: 4, seed: 202 });
    setFs(exFs); setRpm(exRpm); setBearingId(bId);
    setText(es ? '(ejemplo sintético de 12000 muestras cargado, pega o sube TUS datos para análisis real)' : '(synthetic 12000-sample example loaded, paste or upload YOUR data for real analysis)');
    setResult(analyze(sig.x, exFs, exRpm, bearingById(bId), lang));
    setErr(null); setInfo(es ? 'ejemplo SINTÉTICO de pista-externa (1 s @ 12 kHz, etiquetado), para datos reales, súbelos arriba' : 'SYNTHETIC outer-race example (1 s @ 12 kHz, labelled), for real data, upload it above');
  };

  const rec = result?.rec;
  return (
    <section>
      <h2>{es ? 'Analiza tus propios datos' : 'Bring your own data'}</h2>
      <p className="muted small">{es
        ? 'Pega o sube una señal de vibración (un número por línea, o CSV, se toma la última columna numérica), indica la tasa de muestreo, la velocidad de eje y la geometría del rodamiento, y corre el pipeline REAL: kurtograma → banda → envolvente/SES → diagnóstico → recomendación (la capa T5). La física no-supervisada es agnóstica al banco, así que funciona en cualquier rodamiento.'
        : 'Paste or upload a vibration signal (one number per line, or CSV, the last numeric column is taken), set the sample rate, shaft speed and bearing geometry, and run the REAL pipeline: kurtogram → band → envelope/SES → diagnosis → recommendation (the T5 layer). The unsupervised physics is rig-agnostic, so it works on any bearing.'}</p>

      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end', margin: '0.5rem 0' }}>
        <label className="small">{es ? 'Muestreo (Hz)' : 'Sample rate (Hz)'}<br /><input className="select" type="number" value={fs} min={1000} step={1000} onChange={(e) => setFs(Math.max(1000, +e.target.value))} style={{ width: 110 }} /></label>
        <label className="small">{es ? 'Velocidad eje (rpm)' : 'Shaft speed (rpm)'}<br /><input className="select" type="number" value={rpm} min={1} onChange={(e) => setRpm(Math.max(1, +e.target.value))} style={{ width: 110 }} /></label>
        <label className="small">{es ? 'Rodamiento' : 'Bearing'}<br /><select className="select" value={bearingId} onChange={(e) => setBearingId(e.target.value)}>{BEARINGS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select></label>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={es ? 'pega los números de la señal aquí (uno por línea o CSV)…' : 'paste your signal numbers here (one per line or CSV)…'}
        style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
        <button className="chip" onClick={() => run(text)}>{es ? 'Analizar' : 'Analyze'}</button>
        <label className="chip" style={{ cursor: 'pointer' }}>{es ? '⬆ Subir CSV/TXT' : '⬆ Upload CSV/TXT'}<input type="file" accept=".csv,.txt,text/*" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} /></label>
        <button className="chip" onClick={onExample}>{es ? 'Cargar ejemplo sintético' : 'Load synthetic example'}</button>
      </div>
      {info && <p className="muted small" style={{ marginTop: '0.3rem' }}>{info}</p>}
      {err && <p className="small" style={{ color: '#f85149', marginTop: '0.3rem' }}>⚠ {err}</p>}

      {result && rec && <div style={{ marginTop: '0.7rem' }}>
        <SesPlot ses={result.ses} f={result.f} fr={result.fr} />
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.4rem', alignItems: 'center' }}>
          <span className="small">{es ? 'Diagnóstico' : 'Diagnosis'}: <b style={{ color: FAULT_COLOR[result.dx.top] }}>{result.dx.top}</b> ({(result.dx.confidence * 100).toFixed(0)}%)</span>
          <span className="small">{es ? 'banda' : 'band'}: {(result.band[0] / 1000).toFixed(2)}–{(result.band[1] / 1000).toFixed(2)} kHz</span>
          <span className="small">BPFO {result.f.bpfo.toFixed(1)} · BPFI {result.f.bpfi.toFixed(1)} · 2·BSF {(2 * result.f.bsf).toFixed(1)} Hz</span>
        </div>
        <div className="card" style={{ borderLeft: `4px solid ${PRIORITY_COLOR[rec.priority]}`, padding: '0.55rem 0.8rem', marginTop: '0.5rem' }}>
          <span className="chip" style={{ background: `color-mix(in oklab,${PRIORITY_COLOR[rec.priority]} 22%,transparent)`, color: PRIORITY_COLOR[rec.priority], borderColor: 'transparent', fontWeight: 800 }}>{rec.priority.toUpperCase()}</span>
          <strong style={{ marginLeft: '0.5rem' }}>{rec.headline}</strong>
          <p className="small" style={{ margin: '0.3rem 0 0' }}>{rec.detail}.</p>
        </div>
        <p className="muted small" style={{ marginTop: '0.4rem' }}>{es
          ? 'Nota honesta: aquí corre la física no-supervisada (rig-agnóstica). El WDCNN profundo NO se aplica a datos arbitrarios, fue entrenado en CWRU (12 kHz / 2048 / SKF 6205) y aplicarlo a otra geometría/tasa es justamente el domain-shift que falla (ver la sección cross-dataset MFPT). La velocidad ISO asume aceleración en g.'
          : 'Honest note: this runs the unsupervised physics (rig-agnostic). The deep WDCNN is NOT applied to arbitrary data, it was trained on CWRU (12 kHz / 2048 / SKF 6205) and applying it to a different geometry/rate is exactly the domain-shift that fails (see the MFPT cross-dataset section). The ISO velocity assumes acceleration in g.'}</p>
      </div>}
    </section>
  );
}
