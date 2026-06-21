import { useEffect, useMemo, useState } from 'react';
import { useShellLang } from '@fasl-work/caos-app-shell';
import { loadSamples, loadMetrics, diagnoseRaw, aeHealth, type Samples, type Metrics, type DiagOut, type HealthOut } from '../dsp/learned';

// LIVE diagnosis on REAL held-out CWRU recordings. This is real action capability on real data: the user
// picks an actual CWRU 12 kHz drive-end segment (held out from training — load 3 HP), and the heavy WDCNN
// (trained offline) runs IN THE BROWSER (onnxruntime-web) to diagnose it, alongside the deep-AE health
// indicator. The true label is shown so the user sees the model is right (or wrong) on real data.
const CLASS_COLOR: Record<string, string> = { normal: '#3fb950', outer: '#f85149', inner: '#d29922', ball: '#58a6ff' };

function Spark({ raw, color }: { raw: number[]; color: string }) {
  const W = 520, H = 70, n = raw.length;
  const step = Math.max(1, Math.floor(n / W));
  const pts: string[] = [];
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < n; i += step) { mn = Math.min(mn, raw[i]); mx = Math.max(mx, raw[i]); }
  const rng = mx - mn || 1;
  for (let i = 0, k = 0; i < n; i += step, k++) { const x = (k / (n / step)) * W; const y = H - ((raw[i] - mn) / rng) * H; pts.push(`${x.toFixed(1)},${y.toFixed(1)}`); }
  return <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} preserveAspectRatio="none"><polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1" /></svg>;
}

export function LiveDiagnosisPanel() {
  const es = useShellLang() === 'es';
  const [samples, setSamples] = useState<Samples | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [sel, setSel] = useState(0);
  const [diag, setDiag] = useState<DiagOut | null>(null);
  const [health, setHealth] = useState<HealthOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { Promise.all([loadSamples(), loadMetrics()]).then(([s, m]) => { setSamples(s); setMetrics(m); }).catch((e) => setErr(String(e))); }, []);

  const run = async (idx: number) => {
    if (!samples || !metrics) return;
    setBusy(true); setSel(idx); setDiag(null); setHealth(null);
    try {
      const sm = samples.samples[idx];
      const d = await diagnoseRaw(sm.raw, samples.classes);
      const h = await aeHealth(sm.feat, metrics.deepAE.thresholdP99);
      setDiag(d); setHealth(h); setErr(null);
    } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  };
  useEffect(() => { if (samples && metrics && !diag) run(0); /* auto-run first */ }, [samples, metrics]);

  const cur = samples?.samples[sel];
  const correct = diag && cur ? diag.predClass === cur.cls : null;
  const grouped = useMemo(() => {
    const g: Record<string, number[]> = {};
    samples?.samples.forEach((s, i) => { (g[s.cls] ??= []).push(i); });
    return g;
  }, [samples]);

  if (err) return <div className="rv-plot"><p className="rv-note">{es ? 'No se pudo cargar el modelo/datos:' : 'Could not load model/data:'} {err}</p></div>;
  if (!samples || !metrics) return <div className="rv-plot"><p>{es ? 'Cargando datos reales CWRU + modelo…' : 'Loading real CWRU data + model…'}</p></div>;

  return (
    <div className="rv-plot">
      <div className="rv-plot-t">{es ? 'Diagnóstico en vivo (WDCNN) sobre grabaciones REALES de CWRU' : 'Live diagnosis (WDCNN) on REAL CWRU recordings'}</div>
      <p className="rv-note">{es
        ? 'Elegí un segmento real de CWRU (12 kHz, lado motriz, carga 3 HP — held-out del entrenamiento) y el WDCNN entrenado corre EN EL NAVEGADOR (ONNX) para diagnosticarlo. Se muestra la etiqueta real para ver si acierta.'
        : 'Pick a real CWRU segment (12 kHz drive-end, 3 HP load — held out from training) and the trained WDCNN runs IN THE BROWSER (ONNX) to diagnose it. The true label is shown so you see whether it’s right.'}</p>

      <p className="rv-note" style={{ marginTop: 0 }}>{es
        ? 'Cada clase tiene 3 ventanas held-out distintas (#1–#3), extraídas de su grabación CWRU de carga 3 HP (la carga retenida del entrenamiento). El botón muestra la clase verdadera, el archivo CWRU de origen y el número de ventana.'
        : 'Each class has 3 distinct held-out windows (#1–#3) taken from its CWRU 3 HP recording (the load held out of training). The button shows the true class, the source CWRU file, and the window number.'}</p>

      {/* action: choose a real segment, grouped by true class — each labelled with its source CWRU file */}
      {Object.entries(grouped).map(([cls, idxs]) => {
        const file = samples.sourceFiles?.[cls] ?? samples.samples.find((s) => s.cls === cls)?.file;
        const load = samples.loadHp ?? 3;
        return (
        <div key={cls} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', margin: '0.3rem 0', flexWrap: 'wrap' }}>
          <span style={{ width: 152, fontSize: '0.78rem', color: CLASS_COLOR[cls], fontWeight: 700 }}>
            {cls}{file ? ` · CWRU #${file}` : ''}<span style={{ color: 'var(--color-fg-faint)', fontWeight: 400 }}> · {load} HP</span>
          </span>
          {idxs.map((i, k) => (
            <button key={i} className={`chip ${sel === i ? 'on' : ''}`} onClick={() => run(i)} disabled={busy}
              title={`${cls} · CWRU #${file ?? '?'} · ${es ? 'carga' : 'load'} ${load} HP · ${es ? 'ventana' : 'window'} ${k + 1}/${idxs.length} · 2048 @ 12 kHz`}>
              #{k + 1}
            </button>
          ))}
        </div>
        );
      })}

      {cur && <div style={{ margin: '0.6rem 0' }}>
        <Spark raw={cur.raw} color={CLASS_COLOR[cur.cls] || '#8b949e'} />
        <div style={{ fontSize: '0.74rem', color: 'var(--color-fg-faint)', fontFamily: 'var(--font-mono)' }}>{es ? 'segmento real' : 'real segment'} · CWRU #{cur.file ?? '?'} · {es ? 'carga' : 'load'} {samples.loadHp ?? 3} HP · {es ? 'ventana' : 'window'} {cur.seg ?? '?'} · 2048 @ 12 kHz · {es ? 'verdad' : 'truth'}: <b style={{ color: CLASS_COLOR[cur.cls] }}>{cur.cls}</b></div>
      </div>}

      {busy && <p className="rv-note">{es ? 'Corriendo WDCNN…' : 'Running WDCNN…'}</p>}

      {diag && cur && (
        <div className="rv-diag" style={{ marginTop: '0.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
            <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{es ? 'Predicción' : 'Prediction'}: <span style={{ color: CLASS_COLOR[diag.predClass] }}>{diag.predClass}</span></span>
            <span className="chip" style={{ background: correct ? 'color-mix(in oklab,#3fb950 22%,transparent)' : 'color-mix(in oklab,#f85149 22%,transparent)', color: correct ? '#3fb950' : '#f85149', borderColor: 'transparent' }}>{correct ? '✓ ' + (es ? 'correcto' : 'correct') : '✗ ' + (es ? 'incorrecto' : 'wrong')}</span>
          </div>
          {diag.classes.map((c, i) => (
            <div key={c} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.15rem 0' }}>
              <span style={{ width: 64, fontSize: '0.78rem', color: 'var(--color-fg-subtle)' }}>{c}</span>
              <div style={{ flex: 1, height: 12, background: 'var(--color-bg)', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                <span style={{ display: 'block', height: '100%', width: `${(diag.probs[i] * 100).toFixed(1)}%`, background: CLASS_COLOR[c] }} />
              </div>
              <span style={{ width: 52, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.76rem' }}>{(diag.probs[i] * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}

      {health && (
        <div className="rv-diag" style={{ marginTop: '0.5rem' }}>
          <div className="rv-plot-th">{es ? 'Indicador de salud (deep-AE, error de reconstrucción)' : 'Health indicator (deep-AE, reconstruction error)'}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ flex: 1, height: 14, background: 'var(--color-bg)', borderRadius: 7, position: 'relative', border: '1px solid var(--color-border)' }}>
              <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, (health.mse / (health.threshold * 2)) * 100).toFixed(1)}%`, background: health.isAnomaly ? '#f85149' : '#3fb950', borderRadius: 7 }} />
              <span style={{ position: 'absolute', left: '50%', top: -3, bottom: -3, width: 2, background: 'var(--color-fg)' }} title="threshold" />
            </div>
            <span className="chip" style={{ background: health.isAnomaly ? 'color-mix(in oklab,#f85149 22%,transparent)' : 'color-mix(in oklab,#3fb950 22%,transparent)', color: health.isAnomaly ? '#f85149' : '#3fb950', borderColor: 'transparent' }}>{health.isAnomaly ? (es ? 'anómalo' : 'anomalous') : (es ? 'sano' : 'healthy')}</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--color-fg-faint)', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>MSE {health.mse.toFixed(3)} · {es ? 'umbral p99' : 'p99 threshold'} {health.threshold.toFixed(3)} · {health.ratio.toFixed(2)}×</div>
        </div>
      )}

      <p className="rv-note" style={{ marginTop: '0.5rem' }}>{es
        ? `Modelo entrenado sobre ${metrics.nTrain} ventanas reales (cargas 0/1/2 HP); evaluado en ${metrics.nTest} ventanas held-out (carga 3 HP). Honesto: CWRU es un banco de laboratorio limpio — ver la curva de robustez vs ruido en Benchmark.`
        : `Model trained on ${metrics.nTrain} real windows (0/1/2 HP loads); evaluated on ${metrics.nTest} held-out windows (3 HP load). Honest: CWRU is a clean lab rig — see the noise-robustness curve in Benchmark.`}</p>
    </div>
  );
}
