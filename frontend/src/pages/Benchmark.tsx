import { useEffect, useState } from 'react';
import { useShellLang, Cite, Tabs } from '@fasl-work/caos-app-shell';
import bench from '../data/cwru-benchmark.json';
import { viridis } from '../viz/Heatmap2D';
import { loadMetrics, type Metrics } from '../dsp/learned';
import { LiveDiagnosisPanel } from '../viz/LiveDiagnosisPanel';
import { IngestPanel } from '../viz/IngestPanel';
import { EmbeddingPanel } from '../viz/EmbeddingPanel';

type Method = { confusion: number[][]; rowRecall: number[]; accuracy: number; n: number };
const METHODS = bench.methods as Record<string, Method>;
const NAMES = Object.keys(METHODS);

function cellColor(t: number) { const [r, g, b] = viridis(t); return `rgb(${r * 255},${g * 255},${b * 255})`; }

export default function Benchmark() {
  const es = useShellLang() === 'es';
  const [sel, setSel] = useState(NAMES[0]);
  const [lm, setLm] = useState<Metrics | null>(null);
  useEffect(() => { loadMetrics().then(setLm).catch(() => {}); }, []);
  const m = METHODS[sel];
  const classes = bench.classes as string[];
  const clsLabel = (c: string) => (es ? ({ normal: 'sano', outer: 'externa', inner: 'interna', ball: 'bola' } as Record<string, string>)[c] ?? c : c);

  const tabs = [
    {
      id: 'live', label: es ? 'En vivo' : 'Live',
      content: (
        <div className="prose">
          <section>
            <h2>{es ? 'Diagnóstico en vivo sobre datos reales (acción)' : 'Live diagnosis on real data (action)'}</h2>
            <p className="muted small">{es
              ? 'Elegí un segmento real held-out de CWRU (carga 3 HP, fuera del entrenamiento) y el WDCNN entrenado lo diagnostica EN EL NAVEGADOR (ONNX), con el indicador de salud deep-AE.'
              : 'Pick a real held-out CWRU segment (3 HP load, out of training) and the trained WDCNN diagnoses it IN THE BROWSER (ONNX), with the deep-AE health indicator.'}</p>
            <LiveDiagnosisPanel />
          </section>
          <section>
            <h2>{es ? 'Trae tus propios datos' : 'Bring your own data'}</h2>
            <IngestPanel lang={es ? 'es' : 'en'} />
          </section>
        </div>
      ),
    },
    {
      id: 'methods', label: es ? 'Métodos' : 'Methods',
      content: (
        <div className="prose">
          {lm && <section>
            <h2>{es ? 'Comparación de métodos — profundo vs ML clásico vs no-supervisado (held-out real)' : 'Method comparison — deep vs classical-ML vs unsupervised (real held-out)'}</h2>
            <p className="muted small">{es
              ? `Los cuatro evaluados sobre el MISMO split sin fuga: entrenado en ${lm.nTrain} ventanas reales (cargas 0/1/2 HP), evaluado en ${lm.nTest} ventanas held-out (carga 3 HP entera). El WDCNN aprende de la señal cruda; el SVM-RBF y el Random Forest clasifican un vector de 10 features físicas (indicadores de forma + prominencias de los peines BPFO/BPFI/2·BSF + curtosis de la banda de resonancia); el envolvente/SES es no-supervisado.`
              : `All four on the SAME leakage-safe split: trained on ${lm.nTrain} real windows (0/1/2 HP loads), evaluated on ${lm.nTest} held-out windows (the entire 3 HP load). The WDCNN learns from the raw signal; the SVM-RBF and Random Forest classify a 10-D physics-feature vector (shape indicators + BPFO/BPFI/2·BSF comb prominences + resonance-band kurtosis); the envelope/SES is unsupervised.`}</p>
            <table className="cmp-table">
              <thead><tr><th style={{ textAlign: 'left' }}>{es ? 'Modelo' : 'Model'}</th><th>{es ? 'Exactitud (held-out)' : 'Accuracy (held-out)'}</th><th>{es ? 'tipo' : 'type'}</th><th>{es ? 'recall sano' : 'healthy recall'}</th></tr></thead>
              <tbody>
                <tr className="matched"><td style={{ textAlign: 'left' }}>WDCNN (1-D CNN, {es ? 'señal cruda' : 'raw signal'})</td><td className="mono"><b>{(lm.wdcnn.accuracy * 100).toFixed(1)}%</b></td><td className="muted">{es ? 'profundo' : 'deep learned'}</td><td className="mono">{lm.wdcnn.perClass.normal != null ? `${(lm.wdcnn.perClass.normal * 100).toFixed(0)}%` : '—'}</td></tr>
                {lm.classicalML && <>
                  <tr><td style={{ textAlign: 'left' }}>Random Forest ({es ? '10 features físicas' : '10 physics features'})</td><td className="mono"><b>{(lm.classicalML.rf.accuracy * 100).toFixed(1)}%</b></td><td className="muted">{es ? 'ML clásico' : 'classical ML'}</td><td className="mono">{lm.classicalML.rf.perClass.normal != null ? `${(lm.classicalML.rf.perClass.normal * 100).toFixed(0)}%` : '—'}</td></tr>
                  <tr><td style={{ textAlign: 'left' }}>SVM-RBF ({es ? '10 features físicas' : '10 physics features'})</td><td className="mono"><b>{(lm.classicalML.svm.accuracy * 100).toFixed(1)}%</b></td><td className="muted">{es ? 'ML clásico' : 'classical ML'}</td><td className="mono">{lm.classicalML.svm.perClass.normal != null ? `${(lm.classicalML.svm.perClass.normal * 100).toFixed(0)}%` : '—'}</td></tr>
                </>}
                <tr><td style={{ textAlign: 'left' }}>{es ? 'envolvente/SES (banda de resonancia)' : 'envelope/SES (resonance band)'}</td><td className="mono"><b>{(METHODS[NAMES[0]].accuracy * 100).toFixed(1)}%</b></td><td className="muted">{es ? 'no-supervisado' : 'unsupervised'}</td><td className="mono">{`${(METHODS[NAMES[0]].rowRecall[(bench.classes as string[]).indexOf('normal')] * 100).toFixed(0)}%`}</td></tr>
              </tbody>
            </table>
            {lm.classicalML && <p className="muted small">{es
              ? 'La lectura honesta está en la columna "recall sano": el ML clásico clava las fallas (externa/interna ~100%, bola ~90%) pero falsa-alarma en la mitad de las ventanas sanas — las features hechas a mano (las prominencias de los peines) disparan en señales sanas. El CNN profundo aprende esa frontera sano/falla que las features fijas no capturan, y por eso gana. No es una victoria fabricada: el split es el mismo y el número se reporta como cae.'
              : 'The honest reading is the "healthy recall" column: the classical ML nails the faults (outer/inner ~100%, ball ~90%) but false-alarms on half the healthy windows — the hand-crafted features (the comb prominences) fire on healthy signals. The deep CNN learns the healthy/fault boundary the fixed features cannot, and that is why it wins. Not a fabricated win: the split is identical and the number is reported as it lands.'}</p>}

            <h3>{es ? 'Robustez vs ruido (el dato honesto)' : 'Noise robustness (the honest part)'}</h3>
            <p className="muted small">{es
              ? 'CWRU es un banco de laboratorio limpio → exactitud perfecta en limpio (sospechosa por sí sola). Añadiendo ruido gaussiano controlado, el WDCNN se degrada de forma realista — eso es lo creíble:'
              : 'CWRU is a clean lab rig → perfect clean accuracy (suspect on its own). Adding controlled Gaussian noise, the WDCNN degrades realistically — that is the credible reading:'}</p>
            <SnrCurve curve={lm.wdcnn.snrCurve} es={es} />

            <p className="muted small" style={{ marginTop: '0.6rem' }}>{es
              ? `Deep-AE (indicador de salud, novedad one-class): AUC falla-vs-sano ${lm.deepAE.faultVsHealthyAUC} · falso-positivo en sano held-out ${(lm.deepAE.healthyFalseFlagRate * 100).toFixed(1)}%. `
              : `Deep-AE (health indicator, one-class novelty): fault-vs-healthy AUC ${lm.deepAE.faultVsHealthyAUC} · held-out healthy false-flag ${(lm.deepAE.healthyFalseFlagRate * 100).toFixed(1)}%. `}</p>
            <div className="callout" data-variant="honest"><p>{lm.honesty}</p></div>
          </section>}

          <section>
            <p>{es
              ? `Conjunto: ${bench.dataset}. Rodamiento ${bench.bearing}. Protocolo: ${bench.protocol}`
              : `Set: ${bench.dataset}. Bearing ${bench.bearing}. Protocol: ${bench.protocol}`}</p>

            <h2>{es ? 'Exactitud por método (clásico)' : 'Accuracy by method (classical)'}</h2>
            <p className="muted small">{es ? 'Clic en un método para ver su matriz de confusión. Los tres difieren solo en la banda de demodulación.' : 'Click a method to see its confusion matrix. The three differ only in the demodulation band.'}</p>
            <table className="cmp-table">
              <thead><tr><th style={{ textAlign: 'left' }}>{es ? 'Método' : 'Method'}</th><th>{es ? 'Exactitud' : 'Accuracy'}</th><th>n</th></tr></thead>
              <tbody>
                {NAMES.map((name) => (
                  <tr key={name} className={name === sel ? 'matched' : ''} style={{ cursor: 'pointer' }} onClick={() => setSel(name)}>
                    <td style={{ textAlign: 'left' }}>{name}</td>
                    <td className="mono"><b>{(METHODS[name].accuracy * 100).toFixed(1)}%</b></td>
                    <td className="mono">{METHODS[name].n}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2>{es ? 'Matriz de confusión' : 'Confusion matrix'} · <span className="muted">{sel}</span></h2>
            <p className="muted small">{es ? 'Filas = clase verdadera, columnas = predicha; normalizada por fila (la diagonal es el recall por clase). Conteo en la celda.' : 'Rows = true class, columns = predicted; row-normalized (the diagonal is per-class recall). Count shown in the cell.'}</p>
            <div className="cm-grid" style={{ display: 'grid', gridTemplateColumns: `auto repeat(${classes.length}, 1fr)`, gap: 2, maxWidth: 460 }}>
              <div className="cm-corner muted small" style={{ padding: '0.3rem' }}>{es ? 'verd.\\pred.' : 'true\\pred'}</div>
              {classes.map((c) => <div key={'h' + c} className="cm-head small" style={{ padding: '0.3rem', textAlign: 'center', fontWeight: 600 }}>{clsLabel(c)}</div>)}
              {m.confusion.map((row, i) => {
                const sum = row.reduce((a, b) => a + b, 0) || 1;
                return (
                  <FragmentRow key={'r' + i}>
                    <div className="cm-head small" style={{ padding: '0.3rem', fontWeight: 600 }}>{clsLabel(classes[i])}</div>
                    {row.map((v, j) => {
                      const frac = v / sum;
                      return <div key={j} title={`${(frac * 100).toFixed(0)}% (${v})`} style={{ background: cellColor(frac), color: frac > 0.5 ? '#0d1117' : '#e6edf3', padding: '0.55rem 0.2rem', textAlign: 'center', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{(frac * 100).toFixed(0)}%<br /><span style={{ fontSize: '0.66rem', opacity: 0.85 }}>{v}</span></div>;
                    })}
                  </FragmentRow>
                );
              })}
            </div>

            <div className="cm-recall small muted" style={{ marginTop: '0.5rem' }}>
              {classes.map((c, i) => <span key={c} style={{ marginRight: '1rem' }}>{clsLabel(c)} recall: <b>{(m.rowRecall[i] * 100).toFixed(0)}%</b></span>)}
            </div>

            <div className="callout" data-variant="honest" style={{ marginTop: '1rem' }}>
              <p>{es ? bench.caveat.replace('Honest reading', 'Lectura honesta') : bench.caveat}</p>
            </div>

            <p className="muted small" style={{ marginTop: '1rem' }}>
              {es ? 'Multiplicadores de frecuencia de defecto (× velocidad de eje): ' : 'Defect-frequency multipliers (× shaft rate): '}
              BPFO {bench.multipliers.BPFO} · BPFI {bench.multipliers.BPFI} · 2·BSF {bench.multipliers['2BSF']} · FTF {bench.multipliers.FTF}. {' '}
              {es ? 'Redistribución: ' : 'Redistribution: '}{bench.redistribution}.
            </p>
            <p className="small">
              {(bench.refs as { label: string; url?: string; doi?: string }[]).map((r, i) => (
                <span key={i}>{i > 0 ? ' · ' : ''}<a href={r.url ?? `https://doi.org/${r.doi}`} target="_blank" rel="noreferrer">{r.label}</a></span>
              ))}
            </p>
          </section>
        </div>
      ),
    },
    {
      id: 'generalization', label: es ? 'Generalización' : 'Generalization',
      content: (
        <div className="prose">
          {lm?.crossSeverity && <CrossSeverityBlock xs={lm.crossSeverity} es={es} />}
          {lm?.crossDataset && <CrossDatasetBlock xs={lm.crossDataset} es={es} />}
          {!lm?.crossSeverity && !lm?.crossDataset && <p className="muted small">{es ? 'cargando…' : 'loading…'}</p>}
        </div>
      ),
    },
    {
      id: 'leakage', label: es ? 'Fuga' : 'Leakage',
      content: (
        <div className="prose">
          {lm?.leakage ? <LeakageBlock lk={lm.leakage} es={es} /> : <p className="muted small">{es ? 'cargando…' : 'loading…'}</p>}
        </div>
      ),
    },
    {
      id: 'features', label: es ? 'Espacio de features' : 'Feature space',
      content: (
        <div className="prose">
          <EmbeddingPanel lang={es ? 'es' : 'en'} />
        </div>
      ),
    },
  ];

  return (
    <div className="page-body prose">
      <div className="page-head">
        <h1>{es ? 'Benchmark (datos reales CWRU)' : 'Benchmark (real CWRU data)'}</h1>
        <p className="lede">{es
          ? 'Modelos aprendidos (WDCNN, deep-AE) y el diagnóstico clásico de envolvente/SES, evaluados sobre el conjunto real de rodamientos de Case Western Reserve University — métricas calculadas, datos crudos nunca re-hospedados.'
          : 'Learned models (WDCNN, deep-AE) and the classical envelope/SES diagnoser, evaluated on the real Case Western Reserve University bearing set — metrics computed, raw data never re-hosted.'}</p>
      </div>
      <Tabs tabs={tabs} ariaLabel={es ? 'benchmark' : 'benchmark'} />
    </div>
  );
}

// react fragment helper that keeps grid children flat
function FragmentRow({ children }: { children: React.ReactNode }) { return <>{children}</>; }

// T4 — cross-severity generalization: every model is trained ONLY on 0.007" faults, then asked to diagnose UNSEEN
// 0.014"/0.021" fault sizes at the held-out 3 HP load. The honest "is the App a toy?" answer.
type CrossSeverity = NonNullable<Metrics['crossSeverity']>;
function accColor(a: number) { return a >= 0.9 ? '#1a7f37' : a >= 0.6 ? '#9e6a03' : '#b62324'; }
const SIZE_TAGS = ['007', '014', '021'] as const;
function CrossSeverityBlock({ xs, es }: { xs: CrossSeverity; es: boolean }) {
  const methodRows: { key: string; label: string; deep?: boolean }[] = [
    { key: 'wdcnn', label: es ? 'WDCNN (profundo, señal cruda)' : 'WDCNN (deep, raw signal)', deep: true },
    { key: 'rf', label: 'Random Forest' },
    { key: 'svm', label: 'SVM-RBF' },
    { key: 'env', label: es ? 'envolvente/SES (no-superv.)' : 'envelope/SES (unsupervised)' },
  ];
  const clsLbl = (c: string) => (es ? ({ normal: 'sano', outer: 'externa', inner: 'interna', ball: 'bola' } as Record<string, string>)[c] ?? c : c);
  // per-fault WDCNN detail: where do the misses land?
  const detail = xs.rows.map((r) => {
    const entries = Object.entries(r.wdcnnDist).sort((a, b) => b[1] - a[1]);
    const top = entries[0];
    const landsAs = top && top[0] !== r.fault ? top[0] : (entries[1]?.[1] ? entries[1][0] : null);
    return { ...r, landsAs };
  });
  return (
    <section>
      <h2>{es ? 'Generalización entre severidades — ¿reconoce tamaños de falla NO vistos? (held-out real)' : 'Cross-severity generalization — does it recognize UNSEEN fault sizes? (real held-out)'}</h2>
      <p className="muted small">{es
        ? 'Todos los modelos se entrenan SOLO con fallas de 0.007 in (cargas 0/1/2 HP). Aquí diagnostican fallas reales de pista interna / bola / externa a 0.007 / 0.014 / 0.021 in, en la carga 3 HP held-out. Los tamaños 0.014 in y 0.021 in NUNCA se ven en entrenamiento — es una prueba real de generalización por severidad. Exactitud = recall de la falla (cada archivo es un solo tipo de falla).'
        : 'Every model is trained ONLY on 0.007 in faults (0/1/2 HP loads). Here they diagnose real inner / ball / outer faults at 0.007 / 0.014 / 0.021 in, at the held-out 3 HP load. The 0.014 in and 0.021 in sizes are NEVER seen in training — a true severity-generalization test. Accuracy = fault recall (each file is one fault type).'}</p>
      <table className="cmp-table">
        <thead><tr>
          <th style={{ textAlign: 'left' }}>{es ? 'Modelo' : 'Model'}</th>
          <th>0.007″ <span className="muted">({es ? 'visto' : 'seen'})</span></th>
          <th>0.014″ <span className="muted">({es ? 'no visto' : 'unseen'})</span></th>
          <th>0.021″ <span className="muted">({es ? 'no visto' : 'unseen'})</span></th>
        </tr></thead>
        <tbody>
          {methodRows.map((mr) => (
            <tr key={mr.key} className={mr.deep ? 'matched' : ''}>
              <td style={{ textAlign: 'left' }}>{mr.label}</td>
              {SIZE_TAGS.map((s) => {
                const a = xs.byMethodBySize[mr.key]?.[s];
                return <td key={s} className="mono">{a == null ? '—' : <b style={{ color: accColor(a) }}>{(a * 100).toFixed(1)}%</b>}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">{es
        ? 'El hallazgo honesto: el WDCNN clava los spalls más grandes de 0.021 in (98.9%) pero se desploma en el tamaño intermedio 0.014 in (27.8%) — y el envolvente/SES, que no entrena nunca, también falla en las MISMAS grabaciones de 0.014 in. Esa coincidencia entre métodos apunta a que las firmas de 0.014 in de CWRU son más débiles/atípicas (un matiz documentado, Smith & Randall 2015), no a un artefacto del modelo. La severidad held-out es genuinamente difícil — se muestra, no se esconde.'
        : 'The honest finding: the WDCNN nails the largest 0.021 in spalls (98.9%) but collapses on the intermediate 0.014 in size (27.8%) — and the envelope/SES, which never trains, also fails on the SAME 0.014 in recordings. That cross-method agreement points to the 0.014 in CWRU signatures being weaker/atypical (a documented nuance, Smith & Randall 2015), not a model artefact. Held-out severity is genuinely hard — shown, not hidden.'}{' '}<Cite id="smith2015" paren /></p>
      <h3>{es ? 'Detalle por falla — a dónde van los errores del WDCNN' : 'Per-fault detail — where the WDCNN misses go'}</h3>
      <table className="cmp-table">
        <thead><tr>
          <th style={{ textAlign: 'left' }}>{es ? 'Falla' : 'Fault'}</th><th>{es ? 'tamaño' : 'size'}</th>
          <th>CWRU</th><th>{es ? 'WDCNN recall' : 'WDCNN recall'}</th><th>{es ? 'errores caen como' : 'misses land as'}</th>
        </tr></thead>
        <tbody>
          {detail.map((r) => (
            <tr key={`${r.fault}-${r.sizeIn}`}>
              <td style={{ textAlign: 'left' }}>{clsLbl(r.fault)}</td>
              <td className="mono">{r.sizeIn.toFixed(3)}″ {r.isNew && <span className="muted">({es ? 'no visto' : 'unseen'})</span>}</td>
              <td className="mono muted">#{r.file}</td>
              <td className="mono"><b style={{ color: accColor(r.wdcnn) }}>{(r.wdcnn * 100).toFixed(1)}%</b></td>
              <td className="mono">{r.wdcnn >= 0.9 || !r.landsAs ? '—' : clsLbl(r.landsAs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">{xs.note}</p>
    </section>
  );
}

// T13 — cross-DATASET generalization: the CWRU-trained WDCNN vs the unsupervised envelope/SES on MFPT (a DIFFERENT
// rig). The domain-shift test that completes the arc: deep wins in-distribution, physics wins cross-distribution.
type CrossDataset = NonNullable<Metrics['crossDataset']>;
function CrossDatasetBlock({ xs, es }: { xs: CrossDataset; es: boolean }) {
  const clsLbl = (c: string) => (es ? ({ normal: 'sano', outer: 'externa', inner: 'interna' } as Record<string, string>)[c] ?? c : c);
  const k = xs.kinematics;
  const methodRows: { key: 'wdcnn' | 'classical'; label: string; deep?: boolean }[] = [
    { key: 'wdcnn', label: es ? 'WDCNN (profundo, entrenado en CWRU)' : 'WDCNN (deep, trained on CWRU)', deep: true },
    { key: 'classical', label: es ? 'envolvente/SES (física, no-superv.)' : 'envelope/SES (physics, unsupervised)' },
  ];
  // where the deep model sends each MFPT class (the honest "it confuses the rig" detail)
  const outerDist = xs.wdcnn.dist?.outer ?? {};
  const outerLanded = Object.entries(outerDist).sort((a, b) => b[1] - a[1]).filter(([, n]) => n > 0);
  return (
    <section>
      <h2>{es ? 'Generalización entre DATASETS — ¿funciona en otro banco? (MFPT, real)' : 'Cross-DATASET generalization — does it work on another rig? (MFPT, real)'}</h2>
      <p className="muted small">{es
        ? `El WDCNN fue entrenado en CWRU (${k.cwru.bearing}, ${k.cwru.fsHz} Hz) y NUNCA vio MFPT (${k.mfpt.bearing}, ${k.mfpt.fsHz} Hz) — otro banco, otra geometría, otra tasa de muestreo. Es la prueba clásica de domain-shift. Multiplicadores de defecto distintos: BPFO ${k.cwru.BPFO}× / BPFI ${k.cwru.BPFI}× (CWRU) vs BPFO ${k.mfpt.BPFO}× / BPFI ${k.mfpt.BPFI}× (MFPT) — el envolvente/SES usa los de MFPT (física correcta); el WDCNN solo conoce los patrones de CWRU.`
        : `The WDCNN was trained on CWRU (${k.cwru.bearing}, ${k.cwru.fsHz} Hz) and NEVER saw MFPT (${k.mfpt.bearing}, ${k.mfpt.fsHz} Hz) — a different rig, geometry and sample rate. The classic domain-shift test. Different defect multipliers: BPFO ${k.cwru.BPFO}× / BPFI ${k.cwru.BPFI}× (CWRU) vs BPFO ${k.mfpt.BPFO}× / BPFI ${k.mfpt.BPFI}× (MFPT) — the envelope/SES uses MFPT's (correct physics); the WDCNN only knows CWRU's learned patterns.`}</p>
      <table className="cmp-table">
        <thead><tr>
          <th style={{ textAlign: 'left' }}>{es ? 'Método' : 'Method'}</th>
          <th>{es ? 'global' : 'overall'}</th>
          {xs.classes.map((c) => <th key={c}>{clsLbl(c)}</th>)}
        </tr></thead>
        <tbody>
          {methodRows.map((mr) => {
            const blk = xs[mr.key];
            return (
              <tr key={mr.key} className={mr.deep ? 'matched' : ''}>
                <td style={{ textAlign: 'left' }}>{mr.label}</td>
                <td className="mono"><b style={{ color: accColor(blk.overall) }}>{(blk.overall * 100).toFixed(1)}%</b></td>
                {xs.classes.map((c) => {
                  const r = blk.recall[c];
                  return <td key={c} className="mono">{r == null ? '—' : <b style={{ color: accColor(r) }}>{(r * 100).toFixed(0)}%</b>}</td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="callout" data-variant="honest"><p>{es
        ? `El resultado completa el arco profundo-vs-clásico: el WDCNN profundo GANA dentro de su distribución (CWRU) pero se DESPLOMA en otro banco (${(xs.wdcnn.overall * 100).toFixed(0)}% global, recall de pista externa ${((xs.wdcnn.recall.outer ?? 0) * 100).toFixed(0)}%) — sus features aprendidas son específicas del banco. El envolvente/SES no-supervisado, que no entrena, TRANSFIERE perfecto (${(xs.classical.overall * 100).toFixed(0)}%) porque la física (peine en la frecuencia de defecto correcta) es universal. La lección honesta: profundo gana in-distribution, la física gana cross-distribution.`
        : `The result completes the deep-vs-classical arc: the deep WDCNN WINS in-distribution (CWRU) but COLLAPSES on another rig (${(xs.wdcnn.overall * 100).toFixed(0)}% overall, outer-race recall ${((xs.wdcnn.recall.outer ?? 0) * 100).toFixed(0)}%) — its learned features are rig-specific. The unsupervised envelope/SES, which never trains, TRANSFERS perfectly (${(xs.classical.overall * 100).toFixed(0)}%) because the physics (a comb at the correct defect frequency) is universal. The honest lesson: deep wins in-distribution, physics wins cross-distribution.`}</p></div>
      {outerLanded.length > 0 && <p className="muted small">{es ? 'A dónde manda el WDCNN las fallas de pista externa de MFPT: ' : 'Where the WDCNN sends MFPT outer-race faults: '}
        {outerLanded.map(([c, n], i) => <span key={c}>{i > 0 ? ' · ' : ''}{clsLbl(c)} {n}</span>)} — {es ? 'nunca las reconoce como "externa" (recall 0%), las confunde con clases de CWRU.' : 'never recognised as "outer" (0% recall), confused with CWRU classes.'}</p>}
      <p className="muted small">{xs.note}</p>
    </section>
  );
}

// T15 — window-overlap leakage, quantified TWO ways on ONE frozen pool (the CWRU window-overlap trap, Hendriks 2022).
// (1) the ISOLATED overlap leak via a purge/embargo control (same random test set + load; overlapping train
// neighbours removed) — the clean number; (2) the naive-vs-production gap — an UPPER BOUND that ALSO charges the
// grouped arm a 3 HP load-generalization penalty, so it is NOT pure leakage. Honest decomposition: most of the
// naive gap is the load penalty, the pure overlap leak is small on this clean dataset.
type Leakage = NonNullable<Metrics['leakage']>;
function LeakageBlock({ lk, es }: { lk: Leakage; es: boolean }) {
  const ctl = lk.controls;
  // the two classical models carry the legible story (the WDCNN saturates → uninformative here). Per model decompose
  // the naive-vs-production gap into {isolated overlap leak} + {load penalty (the remainder)}.
  const rows = (['rf', 'svm'] as const).map((k) => {
    const iso = lk.overlapIsolated[k], nvp = lk.naiveVsProduction[k];
    const overlap = Math.max(0, iso.isolatedPts), load = Math.max(0, Math.round((nvp.gapPts - iso.isolatedPts) * 10) / 10);
    return { key: k, label: k === 'rf' ? 'Random Forest' : 'SVM-RBF', iso, nvp, overlap, load, gap: nvp.gapPts };
  });
  const maxGap = Math.max(...rows.map((r) => r.gap), 6);
  // horizontal stacked decomposition bar: overlap (red) + load penalty (amber) = the naive-vs-production gap.
  const W = 560, rh = 34, padL = 110, padR = 64, top = 26, barH = 16;
  const sw = (pts: number) => (pts / maxGap) * (W - padL - padR);
  return (
    <section>
      <h2>{es ? 'Fuga por solape de ventanas — aislada vs el techo del split ingenuo (real)' : 'Window-overlap leakage — isolated vs the naive-split upper bound (real)'}</h2>
      <p className="muted small">{es
        ? `Un conjunto congelado de ${lk.nWindows} ventanas (16 grabaciones CWRU, ${lk.overlapPct}% de solape porque HOP ${lk.hop} < WIN ${lk.win}). Se mide la fuga de DOS formas, separadas a propósito para no exagerar. (1) Fuga AISLADA — control de purga/embargo: sobre el MISMO test aleatorio (mezcla de 4 cargas → carga y clase fijas), se compara el train con-solape contra un train al que se le quitan las ventanas vecinas (orden ±1) de cualquier ventana de test; quitar datos solo puede PERJUDICAR, así que la ganancia restante es solo del solape (media de ${lk.nSeeds} semillas). (2) Ingenuo vs producción — un TECHO: el split aleatorio vs el split agrupado de producción (held-out 3 HP), que ADEMÁS paga una penalización por generalizar a una carga no vista — no es fuga pura.`
        : `One frozen pool of ${lk.nWindows} windows (16 CWRU recordings, ${lk.overlapPct}% overlap because HOP ${lk.hop} < WIN ${lk.win}). Leakage is measured TWO ways, deliberately kept apart so the demo does not overclaim. (1) ISOLATED leak — a purge/embargo control: on the SAME random test set (a 4-load mix → load and class held constant), a with-overlap train is compared against a train with every order±1 neighbour of a test window removed; removing data can only HURT, so the residual gain isolates the overlap (mean over ${lk.nSeeds} seeds). (2) Naive-vs-production — an UPPER BOUND: the random split vs the production grouped split (held-out 3 HP), which ALSO pays a penalty for generalizing to an unseen load — so it is NOT pure leakage.`}</p>

      <div className="rv-plot" style={{ maxWidth: W + 20 }}>
        <svg viewBox={`0 0 ${W} ${top + rows.length * rh + 16}`} width="100%" style={{ font: '11px var(--font-sans, sans-serif)' }} role="img" aria-label={es ? 'descomposición de la brecha' : 'gap decomposition by model'}>
          <text x={padL} y={14} fill="var(--color-fg-faint)">{es ? 'puntos de exactitud (techo ingenuo-vs-producción)' : 'accuracy points (naive-vs-production gap)'}</text>
          {rows.map((r, i) => {
            const y = top + i * rh;
            return (
              <g key={r.key}>
                <text x={padL - 8} y={y + barH - 3} textAnchor="end" fill="var(--color-fg)">{r.label}</text>
                <rect x={padL} y={y} width={sw(r.overlap)} height={barH} fill="#b62324" opacity={0.8} />
                <rect x={padL + sw(r.overlap)} y={y} width={sw(r.load)} height={barH} fill="#d9a406" opacity={0.8} />
                <text x={padL + sw(r.gap) + 6} y={y + barH - 3} fill="var(--color-fg-subtle)">+{r.gap.toFixed(1)} pts</text>
                <text x={padL + sw(r.overlap) / 2} y={y + barH + 11} textAnchor="middle" fill="#b62324">{r.overlap.toFixed(1)}</text>
                <text x={padL + sw(r.overlap) + sw(r.load) / 2} y={y + barH + 11} textAnchor="middle" fill="#9e6a03">{r.load.toFixed(1)}</text>
              </g>
            );
          })}
        </svg>
        <div className="muted small" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '0.2rem' }}>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#b62324', opacity: 0.8, marginRight: 4 }} />{es ? 'fuga por solape (aislada)' : 'overlap leak (isolated)'}</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#d9a406', opacity: 0.8, marginRight: 4 }} />{es ? 'penalización por carga' : 'load penalty'}</span>
        </div>
      </div>

      <table className="cmp-table">
        <thead><tr>
          <th style={{ textAlign: 'left' }}>{es ? 'Modelo' : 'Model'}</th>
          <th>{es ? 'producción (agrup.)' : 'production (grouped)'}</th>
          <th>{es ? 'aleatorio (con fuga)' : 'random (leaky)'}</th>
          <th>{es ? 'brecha (techo)' : 'gap (upper bound)'}</th>
          <th>{es ? 'fuga aislada' : 'isolated overlap'}</th>
          <th>{es ? 'recall sano (prod→fuga)' : 'healthy recall (prod→leaky)'}</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={r.key === 'rf' ? 'matched' : ''}>
              <td style={{ textAlign: 'left' }}>{r.label} <span className="muted">· {es ? 'ML clásico' : 'classical'}</span></td>
              <td className="mono"><b style={{ color: accColor(r.nvp.honestAcc) }}>{(r.nvp.honestAcc * 100).toFixed(1)}%</b></td>
              <td className="mono">{(r.nvp.leakyAcc * 100).toFixed(1)}<span className="muted">±{(r.nvp.leakyStd * 100).toFixed(1)}</span>%</td>
              <td className="mono"><b style={{ color: '#9e6a03' }}>+{r.gap.toFixed(1)} pts</b></td>
              <td className="mono"><b style={{ color: '#b62324' }}>+{r.iso.isolatedPts.toFixed(1)} pts</b></td>
              <td className="mono">{(r.nvp.honestPerClass.normal * 100).toFixed(0)}% → {(r.nvp.leakyPerClass.normal * 100).toFixed(0)}%</td>
            </tr>
          ))}
          <tr>
            <td style={{ textAlign: 'left' }}>WDCNN <span className="muted">· {es ? 'profundo' : 'deep'}</span></td>
            <td className="mono">{(lk.naiveVsProduction.wdcnn.honestAcc * 100).toFixed(0)}%</td>
            <td className="mono">{(lk.naiveVsProduction.wdcnn.leakyAcc * 100).toFixed(0)}%</td>
            <td className="mono" colSpan={3}><span className="muted">{es ? 'saturado en este conjunto limpio → no informativo aquí' : 'saturated on this clean pool → uninformative here'}</span></td>
          </tr>
        </tbody>
      </table>

      <p className="muted small" style={{ marginTop: '0.3rem' }}>
        {es ? 'Controles de integridad: ' : 'Integrity controls: '}
        <b>{es ? 'etiqueta barajada (plomería)' : 'shuffled-label (plumbing)'}</b> {(ctl.shuffledLabelPlumbing.leakyWdcnn * 100).toFixed(0)}%/{(ctl.shuffledLabelPlumbing.honestWdcnn * 100).toFixed(0)}% ({es ? 'azar' : 'chance'} 25%) {ctl.shuffledLabelPlumbing.pass ? '✓' : '✗'} · <b>{es ? 'ventanas solapadas train↔test' : 'overlapping windows train↔test'}</b> {es ? 'aleatorio' : 'random'} {ctl.overlapWindowsSharedTrainTest.leaky}/{es ? 'agrupado' : 'grouped'} {ctl.overlapWindowsSharedTrainTest.honest} · <b>{es ? 'honesto-T15 vs producción' : 'honest-T15 vs production'}</b> {(ctl.honestVsProduction.honestT15Wdcnn * 100).toFixed(0)}% vs {(ctl.honestVsProduction.productionHoldout3HP * 100).toFixed(0)}% {ctl.honestVsProduction.consistent ? '✓' : '✗'}.
      </p>

      <div className="callout" data-variant="honest"><p>{es
        ? `La descomposición honesta: de la brecha ingenuo-vs-producción (+${lk.naiveVsProduction.rf.gapPts.toFixed(1)} pts en RF), solo +${Math.max(0, lk.overlapIsolated.rf.isolatedPts).toFixed(1)} pts son fuga PURA por solape de ventanas (test y carga fijos); el resto es la penalización por generalizar a la carga 3 HP no vista que el split de producción sí paga. En este conjunto limpio de 0.007″ la fuga por solape es modesta —no el colapso dramático publicado, que viene de la fuga más profunda de IDENTIDAD DE RODAMIENTO. El WDCNN satura (1.0) → no informa aquí. ${lk.caveat}`
        : `The honest decomposition: of the naive-vs-production gap (+${lk.naiveVsProduction.rf.gapPts.toFixed(1)} pts on RF), only +${Math.max(0, lk.overlapIsolated.rf.isolatedPts).toFixed(1)} pts is PURE window-overlap leakage (test set + load held constant); the rest is the penalty for generalizing to the unseen 3 HP load that the production split honestly pays. On this clean 0.007″ pool the overlap leak is modest — not the dramatic published collapse, which is driven by the deeper BEARING-IDENTITY leak. The WDCNN saturates (1.0) → uninformative here. ${lk.caveat}`}</p></div>

      <p className="muted small">{lk.refs.map((r, i) => (
        <span key={i}>{i > 0 ? ' · ' : ''}{r.doi ? <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer">{r.label}</a> : r.label}</span>
      ))}</p>
    </section>
  );
}

// WDCNN accuracy vs SNR — a small line chart (clean → noisy), the credible degradation curve.
function SnrCurve({ curve, es }: { curve: { snrDb: number | null; accuracy: number }[]; es: boolean }) {
  const pts = curve.map((c) => ({ x: c.snrDb == null ? 14 : c.snrDb, acc: c.accuracy })).sort((a, b) => a.x - b.x);
  const W = 460, H = 180, padL = 40, padB = 30, padT = 12, padR = 12;
  const xs = pts.map((p) => p.x), xmin = Math.min(...xs), xmax = Math.max(...xs);
  const sx = (x: number) => padL + ((x - xmin) / (xmax - xmin || 1)) * (W - padL - padR);
  const sy = (a: number) => padT + (1 - a) * (H - padT - padB);
  return (
    <div className="rv-plot" style={{ maxWidth: W + 20 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ font: '11px var(--font-sans, sans-serif)' }} role="img" aria-label="accuracy vs SNR">
        {[0, 0.25, 0.5, 0.75, 1].map((a) => (
          <g key={a}><line x1={padL} y1={sy(a)} x2={W - padR} y2={sy(a)} stroke="var(--color-border)" /><text x={padL - 5} y={sy(a) + 4} textAnchor="end" fill="var(--color-fg-subtle)">{(a * 100).toFixed(0)}</text></g>
        ))}
        <polyline points={pts.map((p) => `${sx(p.x)},${sy(p.acc)}`).join(' ')} fill="none" stroke="var(--color-accent)" strokeWidth="2.4" />
        {pts.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.acc)} r="3.5" fill="var(--color-accent)" />)}
        {pts.map((p, i) => <text key={'x' + i} x={sx(p.x)} y={H - padB + 16} textAnchor="middle" fill="var(--color-fg-subtle)">{p.x === 14 ? (es ? 'limpio' : 'clean') : `${p.x}`}</text>)}
        <text x={(W) / 2} y={H - 2} textAnchor="middle" fill="var(--color-fg-faint)">{es ? 'SNR (dB) · exactitud %' : 'SNR (dB) · accuracy %'}</text>
      </svg>
    </div>
  );
}
