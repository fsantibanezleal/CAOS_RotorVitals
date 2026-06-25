import { useMemo, useRef, useState, useEffect } from 'react';
import { lifeFeatures, type LifeFeat } from '../dsp/iso';
import { type FaultKind, type Bearing } from '../dsp/bearing';
import { viridis } from './Heatmap2D';

// When realFeats is supplied (the measured run-to-failure frames) the panel plots the MEASURED degradation
// trajectory instead of the synthetic ramp — same view, real data.

function css(name: string, fb: string) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb; }

type AxisKey = 'rms' | 'kurt' | 'ses';
const AXES: Record<AxisKey, { get: (f: LifeFeat) => number; label: (es: boolean) => string }> = {
  rms: { get: (f) => f.rms, label: () => 'RMS (g)' },
  kurt: { get: (f) => f.kurt, label: (es) => (es ? 'curtosis' : 'kurtosis') },
  ses: { get: (f) => f.sesAmp, label: (es) => (es ? 'amp. defecto SES (g²)' : 'SES defect amp (g²)') },
};

// 95% Mahalanobis ellipse from a 2×2 covariance (χ²₂,0.95 = 5.991).
function ellipse(xs: number[], ys: number[]) {
  const n = xs.length; if (n < 2) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  sxx /= n; syy /= n; sxy /= n;
  const tr = sxx + syy, det = sxx * syy - sxy * sxy;
  const disc = Math.sqrt(Math.max(0, (tr / 2) * (tr / 2) - det));
  const l1 = tr / 2 + disc, l2 = tr / 2 - disc;
  const angle = Math.abs(sxy) < 1e-12 ? (sxx >= syy ? 0 : Math.PI / 2) : Math.atan2(l1 - sxx, sxy);
  const k = Math.sqrt(5.991);
  return { mx, my, rx: k * Math.sqrt(Math.max(l1, 1e-18)), ry: k * Math.sqrt(Math.max(l2, 1e-18)), angle };
}

/** Health-feature space: the degradation trajectory through a 2-D feature plane, colored by life,
 * with the healthy-baseline centroid + 95% Mahalanobis novelty ellipse and the onset point. The
 * fault case departs the healthy cluster; healthy stays inside the ellipse. (Hand-crafted features
 * here are the honest baseline that a learned deep-autoencoder latent space improves on.) */
export function FeatureSpacePanel({ bearing, fault, severity, snr, rpm, lifeH, lang, realFeats, realLabel }: {
  bearing: Bearing; fault: FaultKind; severity: number; snr: number; rpm: number; lifeH: number; lang: 'en' | 'es';
  realFeats?: LifeFeat[]; realLabel?: string;
}) {
  const es = lang === 'es';
  const [pair, setPair] = useState<[AxisKey, AxisKey]>(['kurt', 'ses']);
  const ref = useRef<HTMLCanvasElement>(null);
  const [hov, setHov] = useState<{ x: number; y: number; i: number } | null>(null);
  const synthFeats = useMemo(() => lifeFeatures({ bearing, fault, severityEnd: severity, rpm, snrDb: snr, lifeH }), [bearing, fault, severity, rpm, snr, lifeH]);
  const feats = realFeats && realFeats.length >= 2 ? realFeats : synthFeats;

  const ax = AXES[pair[0]], ay = AXES[pair[1]];
  const xs = feats.map(ax.get), ys = feats.map(ay.get);
  const onsetIdx = feats.findIndex((f) => f.sev > 0);
  const healthyN = onsetIdx > 1 ? onsetIdx : Math.max(2, Math.floor(feats.length * 0.2));

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 600, H = 300;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const g = cv.getContext('2d'); if (!g) return; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const dim = css('--color-fg-faint', '#6c7785'), grid = css('--color-border', '#30363d'), fg = css('--color-fg', '#c9d1d9'), warn = css('--color-warn', '#d29922');
    const padL = 56, padR = 14, padT = 12, padB = 34, pw = W - padL - padR, ph = H - padT - padB;
    let xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
    const xpad = (xmax - xmin || 1) * 0.12, ypad = (ymax - ymin || 1) * 0.12;
    xmin -= xpad; xmax += xpad; ymin -= ypad; ymax += ypad;
    const sx = (v: number) => padL + ((v - xmin) / (xmax - xmin || 1)) * pw;
    const sy = (v: number) => padT + ph - ((v - ymin) / (ymax - ymin || 1)) * ph;
    // axes
    g.strokeStyle = grid; g.lineWidth = 1; g.beginPath(); g.moveTo(padL, padT); g.lineTo(padL, padT + ph); g.lineTo(padL + pw, padT + ph); g.stroke();
    g.fillStyle = dim; g.font = '10px ui-monospace, monospace';
    for (let k = 0; k <= 4; k++) { const xv = xmin + (xmax - xmin) * (k / 4); g.fillText(xv.toExponential(1), sx(xv) - 14, padT + ph + 13); const yv = ymin + (ymax - ymin) * (k / 4); g.fillText(yv.toExponential(1), 4, sy(yv) + 3); }
    g.fillStyle = fg; g.font = '11px ui-sans-serif, sans-serif';
    g.fillText(ax.label(es), padL + pw / 2 - 24, padT + ph + 26);
    g.save(); g.translate(12, padT + ph / 2 + 30); g.rotate(-Math.PI / 2); g.fillText(ay.label(es), 0, 0); g.restore();
    // healthy 95% Mahalanobis ellipse
    const el = ellipse(xs.slice(0, healthyN), ys.slice(0, healthyN));
    if (el) {
      const cx = sx(el.mx), cy = sy(el.my);
      const rxp = (el.rx / (xmax - xmin || 1)) * pw, ryp = (el.ry / (ymax - ymin || 1)) * ph;
      g.strokeStyle = dim; g.setLineDash([4, 3]); g.globalAlpha = 0.8; g.beginPath();
      g.ellipse(cx, cy, Math.max(2, rxp), Math.max(2, ryp), -el.angle, 0, 2 * Math.PI); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
      // centroid diamond
      g.strokeStyle = dim; g.beginPath(); g.moveTo(cx, cy - 5); g.lineTo(cx + 5, cy); g.lineTo(cx, cy + 5); g.lineTo(cx - 5, cy); g.closePath(); g.stroke();
      g.fillStyle = dim; g.font = '9px ui-sans-serif, sans-serif'; g.fillText(es ? 'sano 95%' : 'healthy 95%', cx + 7, cy - 6);
    }
    // trajectory line
    g.strokeStyle = grid; g.lineWidth = 1; g.beginPath(); feats.forEach((_, i) => { const X = sx(xs[i]), Y = sy(ys[i]); i === 0 ? g.moveTo(X, Y) : g.lineTo(X, Y); }); g.stroke();
    // points colored by life
    feats.forEach((_, i) => { const [r, gg, bb] = viridis(i / (feats.length - 1)); g.fillStyle = `rgb(${r * 255},${gg * 255},${bb * 255})`; g.beginPath(); g.arc(sx(xs[i]), sy(ys[i]), 3, 0, 7); g.fill(); });
    // onset ring
    if (onsetIdx > 0) { g.strokeStyle = warn; g.lineWidth = 2; g.beginPath(); g.arc(sx(xs[onsetIdx]), sy(ys[onsetIdx]), 6, 0, 7); g.stroke(); g.fillStyle = warn; g.fillText('onset', sx(xs[onsetIdx]) + 8, sy(ys[onsetIdx]) - 6); }
    // 'now' = last point
    const last = feats.length - 1; g.strokeStyle = fg; g.lineWidth = 2; g.beginPath(); g.arc(sx(xs[last]), sy(ys[last]), 5, 0, 7); g.stroke();
    // colorbar (life)
    const cbx = padL + pw - 90, cby = padT + 6;
    for (let i = 0; i < 60; i++) { const [r, gg, bb] = viridis(i / 59); g.fillStyle = `rgb(${r * 255},${gg * 255},${bb * 255})`; g.fillRect(cbx + i * 1.3, cby, 1.4, 7); }
    g.fillStyle = dim; g.font = '9px ui-monospace, monospace'; g.fillText(es ? 'vida →' : 'life →', cbx, cby + 17);
    // hover
    if (hov) { g.strokeStyle = fg; g.lineWidth = 1.5; g.beginPath(); g.arc(sx(xs[hov.i]), sy(ys[hov.i]), 6, 0, 7); g.stroke(); }
  }, [feats, pair, hov, es, healthyN, onsetIdx, ax, ay, xs, ys]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cv = ref.current; if (!cv) return; const rect = cv.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const padL = 56, padR = 14, padT = 12, padB = 34, pw = rect.width - padL - padR, ph = rect.height - padT - padB;
    let xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
    const xpd = (xmax - xmin || 1) * 0.12, ypd = (ymax - ymin || 1) * 0.12; xmin -= xpd; xmax += xpd; ymin -= ypd; ymax += ypd;
    const sx = (v: number) => padL + ((v - xmin) / (xmax - xmin || 1)) * pw, sy = (v: number) => padT + ph - ((v - ymin) / (ymax - ymin || 1)) * ph;
    let bi = -1, bd = 1e9; for (let i = 0; i < feats.length; i++) { const d = (sx(xs[i]) - mx) ** 2 + (sy(ys[i]) - my) ** 2; if (d < bd) { bd = d; bi = i; } }
    setHov(bd < 400 ? { x: mx, y: my, i: bi } : null);
  };

  const toggles: [AxisKey, AxisKey][] = [['kurt', 'ses'], ['rms', 'ses'], ['rms', 'kurt']];
  const isReal = !!(realFeats && realFeats.length >= 2);
  const title = (es ? 'Espacio de features de salud — trayectoria de degradación' : 'Health-feature space — degradation trajectory') + (isReal ? (es ? ` · MEDIDO${realLabel ? ` (${realLabel})` : ''}` : ` · MEASURED${realLabel ? ` (${realLabel})` : ''}`) : '');
  const note = es
    ? 'Cada punto es una instantánea de vida (color = vida). La elipse es la novedad 95% (Mahalanobis) del cúmulo sano; el caso con falla se aleja de ella tras el onset, mientras un caso sano permanece dentro. Estas features hechas a mano (RMS, curtosis, amplitud de defecto SES) y la distancia de Mahalanobis al cúmulo sano son el caso LINEAL de la construcción de indicador de salud en el espacio latente de un autoencoder profundo de González-Muñiz et al. (2022, Reliability Engineering & System Safety 224:108482, DOI 10.1016/j.ress.2022.108482), que calcula la MISMA novedad de Mahalanobis (RaPP "NAP") en un espacio latente NO LINEAL aprendido sólo de datos sanos — la generalización SOTA, entrenada offline. (Nota honesta: a SNR bajo las features estadísticas crudas separan débilmente; por eso el análisis de envolvente/SES sigue siendo el caballo de batalla.)'
    : 'Each point is a life snapshot (color = life). The ellipse is the 95% Mahalanobis novelty of the healthy cluster; the fault case departs it after onset while a healthy case stays inside. These hand-crafted features (RMS, kurtosis, SES defect amplitude) and the Mahalanobis distance to the healthy cluster are the LINEAR case of building a health indicator in the latent space of a deep autoencoder — González-Muñiz et al. (2022, Reliability Engineering & System Safety 224:108482, DOI 10.1016/j.ress.2022.108482) compute the SAME Mahalanobis novelty (RaPP "NAP") in a LEARNED nonlinear latent space trained on healthy data only — the SOTA generalization, trained offline. (Honest note: at low SNR raw statistical features separate weakly, which is why envelope/SES analysis stays the workhorse.)';

  return (
    <div className="rv-vizstack">
      <div className="rv-plot">
        <div className="rv-plot-t rv-plot-th">
          <span>{title}</span>
          <span className="rv-seg">{toggles.map((tg) => <button key={tg.join()} className={`chip ${pair[0] === tg[0] && pair[1] === tg[1] ? 'on' : ''}`} onClick={() => setPair(tg)}>{AXES[tg[0]].label(es).split(' ')[0]}·{AXES[tg[1]].label(es).split(' ')[0]}</button>)}</span>
        </div>
        <div style={{ position: 'relative' }}>
          <canvas ref={ref} style={{ width: '100%', height: 300, display: 'block' }} onMouseMove={onMove} onMouseLeave={() => setHov(null)} />
          {hov && <div className="heatmap-readout" style={{ left: Math.min(hov.x + 8, 260), top: Math.max(2, hov.y - 4) }}>life {feats[hov.i].t.toFixed(0)} h · sev {feats[hov.i].sev.toFixed(2)} · RMS {feats[hov.i].rms.toExponential(1)} · K {feats[hov.i].kurt.toFixed(1)} · SES {feats[hov.i].sesAmp.toExponential(1)}</div>}
        </div>
      </div>
      <p className="hint">{note}</p>
    </div>
  );
}
