import { useMemo } from 'react';
import { synth } from '../dsp/signal';
import { velocityRmsMmps, type IsoBounds } from '../dsp/iso';
import { recommend, reportObject, reportMarkdown, type Priority } from '../dsp/recommend';
import { type Diagnosis } from '../dsp/diagnose';
import { type RulResult } from '../dsp/health';
import { type Bearing } from '../dsp/bearing';

// T5 — the DECISION & REPORT tab. Reacts to the App's selected case: it fuses the envelope diagnosis, the ISO 20816
// broadband-velocity zone and the RUL projection into one prioritised, explainable maintenance recommendation, and
// exports it (JSON / Markdown / printable PDF). The velocity magnitude is an illustrative calibration of the
// synthetic case; the decision logic is real condition-based-maintenance practice.
const FS = 12000;
const PRIORITY_COLOR: Record<Priority, string> = { ok: '#3fb950', watch: '#58a6ff', plan: '#d29922', alarm: '#f0883e', trip: '#f85149' };
const ASSESS_COLOR: Record<string, string> = { good: '#3fb950', watch: '#d29922', bad: '#f85149' };

function download(name: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function printReport(titleHtml: string, bodyHtml: string) {
  const w = window.open('', '_blank', 'width=820,height=1040');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>RotorVitals report</title>
    <style>body{font:14px/1.5 system-ui,sans-serif;color:#111;max-width:720px;margin:32px auto;padding:0 16px}
    h1{font-size:20px;margin:0 0 4px} .sub{color:#666;margin:0 0 18px}
    .badge{display:inline-block;padding:3px 10px;border-radius:6px;color:#fff;font-weight:700}
    table{border-collapse:collapse;width:100%;margin:12px 0} th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;font-size:13px}
    th{background:#f6f6f6} .foot{color:#888;font-size:11px;margin-top:20px}</style></head>
    <body>${titleHtml}${bodyHtml}<p class="foot">Generated client-side by RotorVitals — illustrative synthetic case; ISO 20816 + envelope + RUL decision logic.</p></body></html>`);
  w.document.close(); w.focus(); setTimeout(() => w.print(), 250);
}

export function RecommendationPanel({ bearing, bearingLabel, fault, severity, rpm, snr, sigX, diag, rul, lifeH, isoBounds, lang }: {
  bearing: Bearing; bearingLabel: string; fault: string; severity: number; rpm: number; snr: number;
  sigX: Float64Array; diag: Diagnosis; rul: RulResult; lifeH: number; isoBounds?: IsoBounds; lang: 'en' | 'es';
}) {
  const es = lang === 'es';
  // calibrate the synthetic velocity exactly like the ISO trend panel: as-new healthy → mid Zone A (≈0.45 mm/s)
  const vrms = useMemo(() => {
    const ref = synth({ fs: FS, dur: 0.5, rpm, bearing, fault: 'healthy', severity: 0, resonance: 3400, zeta: 0.04, snrDb: snr, seed: 399 });
    const cal = 0.45 / Math.max(1e-9, velocityRmsMmps(ref.x, FS));
    return velocityRmsMmps(sigX, FS) * cal;
  }, [bearing, rpm, snr, sigX]);

  const rec = useMemo(() => recommend({ diag, velocityRms: vrms, rul, lifeH, isoBounds, lang }), [diag, vrms, rul, lifeH, isoBounds, lang]);
  const ctx = { bearing: bearingLabel, rpm, fault, severity };

  const onJson = () => download('rotorvitals-report.json', JSON.stringify(reportObject(rec, ctx), null, 2), 'application/json');
  const onMd = () => download('rotorvitals-report.md', reportMarkdown(rec, ctx, es), 'text/markdown');
  const onPrint = () => {
    const title = `<h1>${es ? 'Reporte de condición de rodamiento' : 'Bearing condition report'} — RotorVitals</h1>
      <p class="sub">${bearingLabel} · ${rpm} rpm · ${es ? 'falla plantada' : 'planted fault'} ${fault} (${severity.toFixed(2)})</p>
      <p><span class="badge" style="background:${PRIORITY_COLOR[rec.priority]}">${rec.priority.toUpperCase()}</span> &nbsp;<b>${rec.headline}</b><br><small>${rec.detail}</small></p>`;
    const rows = rec.factors.map((f) => `<tr><td>${f.label}</td><td>${f.value}${f.note ? `<br><small>${f.note}</small>` : ''}</td><td>${f.assessment}</td></tr>`).join('');
    const body = `<table><thead><tr><th>${es ? 'Factor' : 'Factor'}</th><th>${es ? 'Valor' : 'Value'}</th><th>${es ? 'Evaluación' : 'Assessment'}</th></tr></thead><tbody>${rows}</tbody></table>
      <p><b>${es ? 'Confianza' : 'Confidence'}:</b> ${(rec.confidence * 100).toFixed(0)}% · <b>${es ? 'Próxima inspección' : 'Next inspection'}:</b> ${rec.nextInspection}</p>`;
    printReport(title, body);
  };

  return (
    <div className="rv-vizstack">
      <div className="rv-plot">
        <div className="rv-plot-t">{es ? 'Recomendación de mantenimiento (decisión basada en condición)' : 'Maintenance recommendation (condition-based decision)'}</div>
        <p className="hint">{es
          ? 'Fusiona el diagnóstico de envolvente, la zona de severidad ISO 20816 (velocidad RMS de banda ancha) y la proyección de RUL en una sola decisión priorizada y explicable. Reacciona al caso seleccionado. La magnitud de velocidad es una calibración ilustrativa del caso sintético; la lógica de decisión es práctica CBM real.'
          : 'Fuses the envelope diagnosis, the ISO 20816 severity zone (broadband velocity RMS) and the RUL projection into one prioritised, explainable decision. Reacts to the selected case. The velocity magnitude is an illustrative calibration of the synthetic case; the decision logic is real CBM practice.'}</p>

        {/* the decision card */}
        <div className="card" style={{ borderLeft: `4px solid ${PRIORITY_COLOR[rec.priority]}`, padding: '0.7rem 0.9rem', margin: '0.5rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span className="chip" style={{ background: `color-mix(in oklab,${PRIORITY_COLOR[rec.priority]} 22%,transparent)`, color: PRIORITY_COLOR[rec.priority], borderColor: 'transparent', fontWeight: 800, letterSpacing: '0.04em' }}>{rec.priority.toUpperCase()}</span>
            <strong style={{ fontSize: '1.05rem' }}>{rec.headline}</strong>
            <span className="muted small" style={{ marginLeft: 'auto' }}>{(rec.confidence * 100).toFixed(0)}% {es ? 'confianza' : 'confidence'}</span>
          </div>
          <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem' }}>{rec.detail}.</p>
          <p className="muted small" style={{ margin: '0.3rem 0 0' }}>{es ? 'Próxima inspección' : 'Next inspection'}: <b>{rec.nextInspection}</b></p>
        </div>

        {rec.disagreement && <div className="callout" data-variant="honest"><p style={{ margin: 0 }}>{es
          ? 'Honesto: la pantalla ISO de banda ancha (10–1000 Hz) parece tranquila, pero la envolvente confirma una falla de rodamiento real — su energía está en la resonancia de alta frecuencia, FUERA de la banda ISO. La decisión confía en la envolvente, no en la velocidad de banda ancha.'
          : 'Honest: the broadband ISO screen (10–1000 Hz) looks calm, but the envelope confirms a real bearing fault — its energy is in the high-frequency resonance, OUTSIDE the ISO band. The decision trusts the envelope, not the broadband velocity.'}</p></div>}

        {/* the evidence / rationale table */}
        <table className="cmp-table" style={{ marginTop: '0.6rem' }}>
          <thead><tr><th style={{ textAlign: 'left' }}>{es ? 'Factor' : 'Factor'}</th><th style={{ textAlign: 'left' }}>{es ? 'Valor' : 'Value'}</th><th>{es ? 'Eval.' : 'Assess.'}</th></tr></thead>
          <tbody>
            {rec.factors.map((f) => (
              <tr key={f.key}>
                <td style={{ textAlign: 'left' }}>{f.label}</td>
                <td style={{ textAlign: 'left' }}>{f.value}{f.note && <span className="muted small" style={{ display: 'block' }}>{f.note}</span>}</td>
                <td><span style={{ color: ASSESS_COLOR[f.assessment], fontWeight: 700 }}>●</span></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* exports */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.7rem', flexWrap: 'wrap' }}>
          <button className="chip" onClick={onPrint}>{es ? '🖨 Imprimir / PDF' : '🖨 Print / PDF'}</button>
          <button className="chip" onClick={onJson}>{es ? '⬇ JSON' : '⬇ JSON'}</button>
          <button className="chip" onClick={onMd}>{es ? '⬇ Markdown' : '⬇ Markdown'}</button>
        </div>
        <p className="muted small" style={{ marginTop: '0.4rem' }}>{es
          ? 'Exporta el reporte estructurado (JSON), un reporte legible (Markdown), o imprímelo a PDF — el entregable que un técnico adjunta a la orden de trabajo.'
          : 'Export the structured report (JSON), a human-readable report (Markdown), or print it to PDF — the deliverable a technician attaches to the work order.'}</p>
      </div>
    </div>
  );
}
