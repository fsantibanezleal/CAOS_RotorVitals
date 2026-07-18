import { useEffect, useMemo, useRef, useState } from 'react';
import { useShellLang } from '@fasl-work/caos-app-shell';
import { loadSamples, loadMetrics, diagnoseRaw, aeHealth, classifyClassical, type Samples, type Metrics, type DiagOut, type HealthOut } from '../dsp/learned';

// LIVE diagnosis on REAL held-out CWRU recordings. This is real action capability on real data: the user
// picks an actual CWRU 12 kHz drive-end segment (held out from training, load 3 HP), and the heavy WDCNN
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
  const [cls, setCls] = useState<{ svm: DiagOut; rf: DiagOut } | null>(null);
  const [health, setHealth] = useState<HealthOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const running = useRef(false);   // re-entrancy guard: the WASM ORT sessions are single-flight per model

  useEffect(() => { Promise.all([loadSamples(), loadMetrics()]).then(([s, m]) => { setSamples(s); setMetrics(m); }).catch((e) => setErr(String(e))); }, []);

  const run = async (idx: number) => {
    if (!samples || !metrics || running.current) return;   // ignore clicks while an inference is in flight
    running.current = true;
    setBusy(true); setSel(idx); setDiag(null); setHealth(null); setCls(null);
    try {
      const sm = samples.samples[idx];
      const d = await diagnoseRaw(sm.raw, samples.classes);
      const h = await aeHealth(sm.feat, metrics.deepAE.thresholdP99);
      const c = sm.clsFeat ? await classifyClassical(sm.clsFeat, samples.classes) : null;
      setDiag(d); setHealth(h); setCls(c); setErr(null);
    } catch (e) { setErr(String(e)); } finally { running.current = false; setBusy(false); }
  };
  useEffect(() => { if (samples && metrics && !diag) run(0); /* auto-run first */ }, [samples, metrics]);

  const cur = samples?.samples[sel];
  const correct = diag && cur ? diag.predClass === cur.cls : null;
  // group by (dataset, class, fault size): CWRU 0.007" held-out baseline first, then the UNSEEN 0.014"/0.021"
  // severity groups (T4), then the MFPT cross-dataset groups (T13, a different rig). Stable sort keeps order.
  const groups = useMemo(() => {
    const map = new Map<string, { cls: string; sizeIn?: number; file?: number | string; dataset?: string; idxs: number[] }>();
    samples?.samples.forEach((s, i) => {
      const key = s.dataset ? `${s.dataset}:${s.cls}` : (s.sizeIn != null ? `${s.cls}-${s.sizeIn}` : s.cls);
      let g = map.get(key);
      if (!g) { g = { cls: s.cls, sizeIn: s.sizeIn, file: s.file, dataset: s.dataset, idxs: [] }; map.set(key, g); }
      g.idxs.push(i);
    });
    const rank = (g: { dataset?: string; sizeIn?: number }) => (g.dataset ? 100 : (g.sizeIn ?? 0));
    return [...map.values()].sort((a, b) => rank(a) - rank(b));
  }, [samples]);

  if (err) return <div className="rv-plot"><p className="rv-note">{es ? 'No se pudo cargar el modelo/datos:' : 'Could not load model/data:'} {err}</p></div>;
  if (!samples || !metrics) return <div className="rv-plot"><p>{es ? 'Cargando datos reales CWRU + modelo…' : 'Loading real CWRU data + model…'}</p></div>;

  return (
    <div className="rv-plot">
      <div className="rv-plot-t">{es ? 'Diagnóstico en vivo (WDCNN) sobre grabaciones REALES de CWRU' : 'Live diagnosis (WDCNN) on REAL CWRU recordings'}</div>
      <p className="rv-note">{es
        ? 'Elegí un segmento real de CWRU (12 kHz, lado motriz, carga 3 HP, held-out del entrenamiento) y el WDCNN entrenado corre EN EL NAVEGADOR (ONNX) para diagnosticarlo. Se muestra la etiqueta real para ver si acierta.'
        : 'Pick a real CWRU segment (12 kHz drive-end, 3 HP load, held out from training) and the trained WDCNN runs IN THE BROWSER (ONNX) to diagnose it. The true label is shown so you see whether it’s right.'}</p>

      <p className="rv-note" style={{ marginTop: 0 }}>{es
        ? 'Las clases base (0.007″) tienen 3 ventanas held-out cada una, de su grabación CWRU de carga 3 HP. A la derecha de cada fila, los botones numerados #1 / #2 / #3 son esas ventanas (cada una un segmento de 2048 muestras @ 12 kHz), clic en uno para diagnosticarlo en vivo. Las filas marcadas "tamaño no visto" son la prueba de generalización por severidad: fallas reales de 0.014″/0.021″ que el modelo nunca vio (entrenó solo con 0.007″), un error ahí es la brecha honesta, no un bug.'
        : 'The base classes (0.007″) have 3 held-out windows each, from their CWRU 3 HP recording. To the right of each row, the numbered buttons #1 / #2 / #3 are those windows (each a 2048-sample @ 12 kHz segment), click one to diagnose it live. The rows tagged "unseen size" are the severity-generalization test: real 0.014″/0.021″ faults the model NEVER saw (it trained only on 0.007″), a miss there is the honest gap, not a bug.'}</p>

      {/* action: choose a real segment, grouped by (dataset, class, size); severity = "unseen size", MFPT = "different rig" */}
      {groups.map((g) => {
        const load = samples.loadHp ?? 3;
        const isMfpt = g.dataset === 'MFPT';
        const file = isMfpt ? g.file : (g.file ?? (g.sizeIn == null ? samples.sourceFiles?.[g.cls] : undefined));
        const sizeTxt = g.sizeIn != null ? `${g.sizeIn.toFixed(3)}″` : '0.007″';
        const tag = isMfpt ? (es ? 'otro banco' : 'different rig') : g.sizeIn != null ? (es ? 'tamaño no visto' : 'unseen size') : null;
        const tagColor = isMfpt ? '#a371f7' : '#d29922';
        const meta = isMfpt ? `MFPT · ${file ?? '?'}` : `${file ? `CWRU #${file}` : ''} · ${load} HP · ${sizeTxt}`;
        return (
        <div key={`${g.dataset ?? 'cwru'}-${g.cls}-${g.sizeIn ?? 'base'}`} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', margin: '0.3rem 0', flexWrap: 'wrap' }}>
          <span style={{ width: 256, fontSize: '0.78rem', color: CLASS_COLOR[g.cls], fontWeight: 700 }}>
            {g.cls}<span style={{ color: 'var(--color-fg-faint)', fontWeight: 400 }}> · {meta}</span>
            {tag && <span className="chip" style={{ marginLeft: 6, padding: '0 6px', fontSize: '0.64rem', background: `color-mix(in oklab,${tagColor} 20%,transparent)`, color: tagColor, borderColor: 'transparent' }}>{tag}</span>}
          </span>
          {g.idxs.map((i, k) => (
            <button key={i} className={`chip ${sel === i ? 'on' : ''}`} onClick={() => run(i)} disabled={busy}
              title={`${g.cls} · ${meta} · ${es ? 'ventana' : 'window'} ${k + 1}/${g.idxs.length} · 2048 @ 12 kHz`}>
              #{k + 1}
            </button>
          ))}
        </div>
        );
      })}

      {cur && <div style={{ margin: '0.6rem 0' }}>
        <Spark raw={cur.raw} color={CLASS_COLOR[cur.cls] || '#8b949e'} />
        <div style={{ fontSize: '0.74rem', color: 'var(--color-fg-faint)', fontFamily: 'var(--font-mono)' }}>{es ? 'segmento real' : 'real segment'} · {cur.dataset === 'MFPT' ? `MFPT · ${cur.file ?? '?'}` : `CWRU #${cur.file ?? '?'} · ${es ? 'carga' : 'load'} ${samples.loadHp ?? 3} HP · ${cur.sizeIn != null ? `${cur.sizeIn.toFixed(3)}″` : '0.007″'}`} · {es ? 'ventana' : 'window'} {cur.seg ?? '?'} · 2048 @ 12 kHz · {es ? 'verdad' : 'truth'}: <b style={{ color: CLASS_COLOR[cur.cls] }}>{cur.cls}</b></div>
        {cur.dataset === 'MFPT' && <div className="callout" data-variant="honest" style={{ marginTop: '0.4rem' }}><p style={{ margin: 0, fontSize: '0.78rem' }}>{es
          ? 'Segmento de OTRO banco (MFPT, rodamiento NICE), el WDCNN se entrenó solo en CWRU y nunca vio MFPT. Si falla, es domain-shift (honesto): las features profundas son específicas del banco. El envolvente/SES físico SÍ transfiere, ver la tabla cross-dataset más abajo.'
          : 'A segment from ANOTHER rig (MFPT, NICE bearing), the WDCNN trained only on CWRU and never saw MFPT. A miss here is domain-shift (honest): deep features are rig-specific. The physics envelope/SES DOES transfer, see the cross-dataset table below.'}</p></div>}
        {cur.sizeIn != null && <div className="callout" data-variant="honest" style={{ marginTop: '0.4rem' }}><p style={{ margin: 0, fontSize: '0.78rem' }}>{es
          ? `Tamaño de falla NO visto (${cur.sizeIn.toFixed(3)}″). El WDCNN entrenó solo con 0.007″, si falla aquí, es la brecha de generalización por severidad (honesta), no un bug. La tabla agregada por tamaño está más abajo.`
          : `UNSEEN fault size (${cur.sizeIn.toFixed(3)}″). The WDCNN trained only on 0.007″, a miss here is the honest severity-generalization gap, not a bug. The aggregate accuracy-by-size table is below.`}</p></div>}
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

      {cls && cur && (
        <div className="rv-diag" style={{ marginTop: '0.5rem' }}>
          <div className="rv-plot-th">{es ? 'Mismo segmento, modelo profundo vs ML clásico (en vivo)' : 'Same segment, deep model vs classical ML (live)'}</div>
          <table className="cmp-table" style={{ marginTop: '0.3rem' }}>
            <thead><tr><th>{es ? 'método' : 'method'}</th><th>{es ? 'tipo' : 'type'}</th><th>{es ? 'predicción' : 'prediction'}</th><th /></tr></thead>
            <tbody>
              {([['WDCNN', es ? 'CNN profundo · señal cruda' : 'deep CNN · raw signal', diag],
                 ['SVM-RBF', es ? 'ML clásico · 10 features' : 'classical ML · 10 features', cls.svm],
                 ['Random Forest', es ? 'ML clásico · 10 features' : 'classical ML · 10 features', cls.rf]] as const).map(([name, type, d]) => {
                const ok = !!d && d.predClass === cur.cls;
                return (
                  <tr key={name}>
                    <td style={{ fontWeight: 600 }}>{name}</td>
                    <td style={{ color: 'var(--color-fg-subtle)', fontSize: '0.78rem' }}>{type}</td>
                    <td style={{ color: d ? CLASS_COLOR[d.predClass] : undefined, fontWeight: 700 }}>{d?.predClass ?? ', '}</td>
                    <td style={{ color: ok ? '#3fb950' : '#f85149', fontWeight: 700 }}>{ok ? '✓' : '✗'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="rv-note" style={{ marginTop: '0.3rem' }}>{es
            ? 'Los tres corren EN VIVO sobre el mismo segmento real. El WDCNN aprende de la señal cruda; el SVM/RF clasifican un vector de 10 features físicas (indicadores de forma + prominencias de los peines BPFO/BPFI/2·BSF). En held-out: WDCNN 100% vs SVM/RF ~86%, el ML clásico falsa-alarma en sanos (ver Benchmark).'
            : 'All three run LIVE on the same real segment. The WDCNN learns from the raw signal; the SVM/RF classify a 10-D physics-feature vector (shape indicators + BPFO/BPFI/2·BSF comb prominences). Held-out: WDCNN 100% vs SVM/RF ~86%, the classical ML false-alarms on healthy (see Benchmark).'}</p>
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
        ? `Modelo entrenado sobre ${metrics.nTrain} ventanas reales (cargas 0/1/2 HP); evaluado en ${metrics.nTest} ventanas held-out (carga 3 HP). Honesto: CWRU es un banco de laboratorio limpio, ver la curva de robustez vs ruido en Benchmark.`
        : `Model trained on ${metrics.nTrain} real windows (0/1/2 HP loads); evaluated on ${metrics.nTest} held-out windows (3 HP load). Honest: CWRU is a clean lab rig, see the noise-robustness curve in Benchmark.`}</p>
    </div>
  );
}
