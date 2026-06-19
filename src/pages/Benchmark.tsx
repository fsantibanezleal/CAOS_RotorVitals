import { useState } from 'react';
import { useShellLang } from '@fasl-work/caos-app-shell';
import bench from '../data/cwru-benchmark.json';
import { viridis } from '../viz/Heatmap2D';

type Method = { confusion: number[][]; rowRecall: number[]; accuracy: number; n: number };
const METHODS = bench.methods as Record<string, Method>;
const NAMES = Object.keys(METHODS);

function cellColor(t: number) { const [r, g, b] = viridis(t); return `rgb(${r * 255},${g * 255},${b * 255})`; }

export default function Benchmark() {
  const es = useShellLang() === 'es';
  const [sel, setSel] = useState(NAMES[0]);
  const m = METHODS[sel];
  const classes = bench.classes as string[];
  const clsLabel = (c: string) => (es ? ({ normal: 'sano', outer: 'externa', inner: 'interna', ball: 'bola' } as Record<string, string>)[c] ?? c : c);

  return (
    <div className="page-body prose">
      <div className="page-head">
        <h1>{es ? 'Benchmark (datos reales CWRU)' : 'Benchmark (real CWRU data)'}</h1>
        <p className="lede">{es
          ? 'Nuestro mismo diagnóstico de envolvente/SES, corrido sobre el conjunto real de rodamientos de Case Western Reserve University — métricas calculadas, datos crudos nunca re-hospedados.'
          : 'Our same envelope/SES diagnoser, run on the real Case Western Reserve University bearing set — metrics computed, raw data never re-hosted.'}</p>
      </div>

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
