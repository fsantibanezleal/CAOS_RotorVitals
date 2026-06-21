import { useEffect, useState } from 'react';
import { useShellLang } from '@fasl-work/caos-app-shell';
import bench from '../data/cwru-benchmark.json';
import { viridis } from '../viz/Heatmap2D';
import { loadMetrics, type Metrics } from '../dsp/learned';

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

  return (
    <div className="page-body prose">
      <div className="page-head">
        <h1>{es ? 'Benchmark (datos reales CWRU)' : 'Benchmark (real CWRU data)'}</h1>
        <p className="lede">{es
          ? 'Modelos aprendidos (WDCNN, deep-AE) y el diagnóstico clásico de envolvente/SES, evaluados sobre el conjunto real de rodamientos de Case Western Reserve University — métricas calculadas, datos crudos nunca re-hospedados.'
          : 'Learned models (WDCNN, deep-AE) and the classical envelope/SES diagnoser, evaluated on the real Case Western Reserve University bearing set — metrics computed, raw data never re-hosted.'}</p>
      </div>

      {lm && <section>
        <h2>{es ? 'Modelo aprendido — WDCNN (held-out, datos reales)' : 'Learned model — WDCNN (held-out, real data)'}</h2>
        <p className="muted small">{es
          ? `Entrenado sobre ${lm.nTrain} ventanas reales (cargas 0/1/2 HP), evaluado sobre ${lm.nTest} ventanas held-out (carga 3 HP entera fuera del entrenamiento — sin fuga de grabaciones).`
          : `Trained on ${lm.nTrain} real windows (0/1/2 HP loads), evaluated on ${lm.nTest} held-out windows (the entire 3 HP load held out — no recording leakage).`}</p>
        <table className="cmp-table">
          <thead><tr><th style={{ textAlign: 'left' }}>{es ? 'Modelo' : 'Model'}</th><th>{es ? 'Exactitud (held-out)' : 'Accuracy (held-out)'}</th><th>{es ? 'tipo' : 'type'}</th></tr></thead>
          <tbody>
            <tr className="matched"><td style={{ textAlign: 'left' }}>WDCNN (1-D CNN)</td><td className="mono"><b>{(lm.wdcnn.accuracy * 100).toFixed(1)}%</b></td><td className="muted">{es ? 'aprendido' : 'learned'}</td></tr>
            <tr><td style={{ textAlign: 'left' }}>{es ? 'envolvente/SES (clásico)' : 'envelope/SES (classical)'}</td><td className="mono"><b>{(METHODS[NAMES[0]].accuracy * 100).toFixed(1)}%</b></td><td className="muted">{es ? 'clásico' : 'classical'}</td></tr>
          </tbody>
        </table>

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

        <h2>{es ? 'Exactitud por método' : 'Accuracy by method'}</h2>
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
  );
}

// react fragment helper that keeps grid children flat
function FragmentRow({ children }: { children: React.ReactNode }) { return <>{children}</>; }

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
