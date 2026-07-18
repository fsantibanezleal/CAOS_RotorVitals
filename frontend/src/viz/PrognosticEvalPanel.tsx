import { useEffect, useMemo, useRef, useState } from 'react';
import { alphaLambda, calibration } from '../dsp/prognostics';
import { type HIPoint } from '../dsp/health';
import { type FaultKind } from '../dsp/bearing';

function css(name: string, fb: string) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb; }

/** Prognostic-performance evaluation: the α-λ accuracy plot (predicted RUL vs true RUL with an ±α cone,
 * re-predicted at each update time) and the calibration/reliability diagram (nominal vs empirical
 * credible-interval coverage across an ensemble of run-to-failure trajectories). Reactive to scenario. */
export function PrognosticEvalPanel({ rtf, fault, severity, lang }: {
  rtf: { points: HIPoint[]; threshold: number; trueFail: number }; fault: FaultKind; severity: number; lang: 'en' | 'es';
}) {
  const es = lang === 'es';
  const healthy = !isFinite(rtf.trueFail);
  const al = useMemo(() => (healthy ? null : alphaLambda(rtf, 0.2)), [rtf, healthy]);
  const cal = useMemo(() => (healthy ? null : calibration({ fault, severity })), [fault, severity, healthy]);

  const alRef = useRef<HTMLCanvasElement>(null);
  const calRef = useRef<HTMLCanvasElement>(null);
  const [hov, setHov] = useState<{ x: number; y: number; i: number } | null>(null);

  // α-λ chart
  useEffect(() => {
    const cv = alRef.current; if (!cv || !al || !al.ts.length) return;
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 600, H = 240;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const g = cv.getContext('2d'); if (!g) return; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const dim = css('--color-fg-faint', '#6c7785'), grid = css('--color-border', '#30363d'), fg = css('--color-fg', '#c9d1d9'), good = css('--color-good', '#3fb950'), bad = css('--color-bad', '#f85149'), acc = css('--color-accent', '#58a6ff');
    const padL = 46, padR = 12, padT = 12, padB = 26, pw = W - padL - padR, ph = H - padT - padB;
    const t0 = al.ts[0], t1 = al.ts[al.ts.length - 1];
    const ymax = Math.max(...al.trueRUL, ...al.predRUL, ...al.coneHi) * 1.08 || 1;
    const sx = (t: number) => padL + ((t - t0) / (t1 - t0 || 1)) * pw;
    const sy = (r: number) => padT + ph - (r / ymax) * ph;
    g.strokeStyle = grid; g.lineWidth = 1; g.beginPath(); g.moveTo(padL, padT); g.lineTo(padL, padT + ph); g.lineTo(padL + pw, padT + ph); g.stroke();
    g.fillStyle = dim; g.font = '10px ui-monospace, monospace';
    for (let k = 0; k <= 4; k++) { const t = t0 + (t1 - t0) * (k / 4); g.fillText(t.toFixed(0), sx(t) - 6, padT + ph + 13); const r = (ymax * k) / 4; g.fillText(r.toFixed(0), 6, sy(r) + 3); }
    g.fillStyle = fg; g.font = '11px ui-sans-serif, sans-serif'; g.fillText(es ? 'tiempo de operación (h)' : 'operating time (h)', padL + pw - 110, padT + ph + 13);
    g.save(); g.translate(12, padT + 8); g.fillText('RUL (h)', 0, 0); g.restore();
    // ±α cone
    g.fillStyle = acc; g.globalAlpha = 0.14; g.beginPath();
    al.ts.forEach((t, i) => { const x = sx(t), y = sy(al.coneHi[i]); i === 0 ? g.moveTo(x, y) : g.lineTo(x, y); });
    for (let i = al.ts.length - 1; i >= 0; i--) g.lineTo(sx(al.ts[i]), sy(al.coneLo[i]));
    g.closePath(); g.fill(); g.globalAlpha = 1;
    // true RUL line
    g.strokeStyle = dim; g.lineWidth = 1.6; g.setLineDash([5, 3]); g.beginPath();
    al.ts.forEach((t, i) => { const x = sx(t), y = sy(al.trueRUL[i]); i === 0 ? g.moveTo(x, y) : g.lineTo(x, y); }); g.stroke(); g.setLineDash([]);
    // predicted RUL line + points (green in cone, red out)
    g.strokeStyle = acc; g.lineWidth = 1.4; g.beginPath();
    al.ts.forEach((t, i) => { const x = sx(t), y = sy(al.predRUL[i]); i === 0 ? g.moveTo(x, y) : g.lineTo(x, y); }); g.stroke();
    al.ts.forEach((t, i) => { g.fillStyle = al.inCone[i] ? good : bad; g.beginPath(); g.arc(sx(t), sy(al.predRUL[i]), 2.6, 0, 7); g.fill(); });
    if (hov && hov.i < al.ts.length) { g.strokeStyle = fg; g.lineWidth = 1; g.beginPath(); g.arc(sx(al.ts[hov.i]), sy(al.predRUL[hov.i]), 5, 0, 7); g.stroke(); }
    // legend
    g.font = '10px ui-sans-serif, sans-serif';
    g.fillStyle = dim; g.fillText(es ? '· RUL verdadero' : '· true RUL', padL + 4, padT + 10);
    g.fillStyle = acc; g.fillText(es ? '· RUL predicho (±α=20% cono)' : '· predicted RUL (±α=20% cone)', padL + 90, padT + 10);
  }, [al, hov, es]);

  // calibration chart
  useEffect(() => {
    const cv = calRef.current; if (!cv || !cal) return;
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 600, H = 240;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const g = cv.getContext('2d'); if (!g) return; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const dim = css('--color-fg-faint', '#6c7785'), grid = css('--color-border', '#30363d'), fg = css('--color-fg', '#c9d1d9'), mag = css('--color-magenta', '#f778ba');
    const padL = 46, padR = 12, padT = 12, padB = 26, pw = W - padL - padR, ph = H - padT - padB;
    const sx = (v: number) => padL + v * pw, sy = (v: number) => padT + ph - v * ph;
    g.strokeStyle = grid; g.lineWidth = 1; g.beginPath(); g.moveTo(padL, padT); g.lineTo(padL, padT + ph); g.lineTo(padL + pw, padT + ph); g.stroke();
    g.fillStyle = dim; g.font = '10px ui-monospace, monospace';
    for (let k = 0; k <= 5; k++) { const v = k / 5; g.fillText(v.toFixed(1), sx(v) - 6, padT + ph + 13); g.fillText(v.toFixed(1), 6, sy(v) + 3); }
    g.fillStyle = fg; g.font = '11px ui-sans-serif, sans-serif'; g.fillText(es ? 'cobertura nominal' : 'nominal coverage', padL + pw - 110, padT + ph + 13);
    g.save(); g.translate(12, padT + 8); g.fillText(es ? 'cobertura empírica' : 'empirical coverage', 0, 0); g.restore();
    // perfect-calibration diagonal
    g.strokeStyle = dim; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(sx(0), sy(0)); g.lineTo(sx(1), sy(1)); g.stroke(); g.setLineDash([]);
    g.fillStyle = dim; g.font = '9px ui-sans-serif, sans-serif'; g.fillText(es ? 'calibración perfecta' : 'perfect calibration', sx(0.55), sy(0.62));
    // calibration curve
    g.strokeStyle = mag; g.lineWidth = 1.6; g.beginPath();
    cal.nominal.forEach((nv, i) => { const x = sx(nv), y = sy(cal.empirical[i]); i === 0 ? g.moveTo(x, y) : g.lineTo(x, y); }); g.stroke();
    g.fillStyle = mag; cal.nominal.forEach((nv, i) => { g.beginPath(); g.arc(sx(nv), sy(cal.empirical[i]), 3, 0, 7); g.fill(); g.fillStyle = fg; g.font = '9px ui-monospace, monospace'; g.fillText(`${(cal.empirical[i] * 100).toFixed(0)}%`, sx(nv) + 4, sy(cal.empirical[i]) - 4); g.fillStyle = mag; });
  }, [cal, es]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cv = alRef.current; if (!cv || !al || !al.ts.length) return; const rect = cv.getBoundingClientRect();
    const padL = 46, pw = rect.width - padL - 12; const t0 = al.ts[0], t1 = al.ts[al.ts.length - 1];
    const t = t0 + ((e.clientX - rect.left - padL) / pw) * (t1 - t0);
    let bi = 0, bd = 1e9; al.ts.forEach((tt, i) => { const d = Math.abs(tt - t); if (d < bd) { bd = d; bi = i; } });
    setHov({ x: e.clientX - rect.left, y: e.clientY - rect.top, i: bi });
  };

  if (healthy) {
    return <div className="rv-vizstack"><div className="rv-plot"><div className="rv-plot-t">{es ? 'Evaluación prognóstica (α-λ + calibración)' : 'Prognostic evaluation (α-λ + calibration)'}</div><p className="hint">{es ? 'Un caso sano no tiene degradación ni fin de vida, así que no hay RUL que evaluar. Seleccionar una falla (externa/interna/bola) para ver la exactitud α-λ y el diagrama de calibración.' : 'A healthy case has no degradation or end-of-life, so there is no RUL to evaluate. Select a fault (outer/inner/ball) to see the α-λ accuracy and the calibration diagram.'}</p></div></div>;
  }

  const note = es
    ? `α-λ (arriba): el RUL predicho se re-estima en cada instante con los datos hasta ese momento y debe converger dentro del cono ±20% del RUL verdadero a medida que se acerca el fin de vida (verde = dentro, rojo = fuera). Calibración (abajo): a través de un ensemble de ${cal?.n ?? 0} trayectorias run-to-failure sintéticas, la fracción cuyo RUL verdadero cae dentro del intervalo creíble nominal p%; sobre la diagonal = bien calibrado, debajo = sobre-confiado (banda demasiado angosta). Métricas de Saxena et al. (IJPHM 2010). Datos sintéticos; el punto es exhibir la EVALUACIÓN honesta de incertidumbre, no afirmar un RUL de campo.`
    : `α-λ (top): the predicted RUL is re-estimated at each instant from the data so far and should converge inside the ±20% cone of the true RUL as end-of-life nears (green = inside, red = outside). Calibration (bottom): across an ensemble of ${cal?.n ?? 0} synthetic run-to-failure trajectories, the fraction whose true RUL falls inside the nominal p% credible interval; on the diagonal = well-calibrated, below it = over-confident (band too tight). Metrics after Saxena et al. (IJPHM 2010). Synthetic data; the point is to show the HONEST uncertainty EVALUATION, not to claim a field RUL.`;

  return (
    <div className="rv-vizstack">
      <div className="rv-plot"><div className="rv-plot-t">{es ? 'Exactitud α-λ, RUL predicho vs verdadero (cono ±20%)' : 'α-λ accuracy, predicted vs true RUL (±20% cone)'}</div>
        <canvas ref={alRef} style={{ width: '100%', height: 240, display: 'block' }} onMouseMove={onMove} onMouseLeave={() => setHov(null)} />
        {hov && al && hov.i < al.ts.length && <div className="heatmap-readout" style={{ left: Math.min(hov.x + 8, 300), top: Math.max(2, hov.y - 4) }}>t={al.ts[hov.i].toFixed(0)} h · pred {al.predRUL[hov.i].toFixed(0)} h · true {al.trueRUL[hov.i].toFixed(0)} h · {al.inCone[hov.i] ? (es ? 'dentro' : 'in') : (es ? 'fuera' : 'out')}</div>}
      </div>
      <div className="rv-plot"><div className="rv-plot-t">{es ? 'Diagrama de calibración / confiabilidad' : 'Calibration / reliability diagram'}</div>
        <canvas ref={calRef} style={{ width: '100%', height: 240, display: 'block' }} />
      </div>
      <p className="hint">{note}</p>
    </div>
  );
}
