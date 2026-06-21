import { useEffect, useRef } from 'react';

export interface Comb { base: number; harmonics: number; color: string; label: string }

function vars() {
  const s = getComputedStyle(document.documentElement);
  return {
    fg: s.getPropertyValue('--color-fg').trim() || '#c9d1d9',
    dim: s.getPropertyValue('--color-fg-faint').trim() || '#6c7785',
    grid: s.getPropertyValue('--color-border').trim() || '#30363d',
    accent: s.getPropertyValue('--color-accent').trim() || '#58a6ff',
  };
}

/** Canvas line/stem chart with optional kinematic harmonic combs (vertical markers at k·base) and a
 * dB y-axis. Used for the time waveform, FFT spectrum and squared-envelope spectrum (SES). */
export function Chart({
  xs, ys, kind = 'line', combs = [], xmax, ydb = false, height = 175, xlabel, color,
}: {
  xs: Float64Array; ys: Float64Array; kind?: 'line' | 'stem'; combs?: Comb[];
  xmax?: number; ydb?: boolean; height?: number; xlabel?: string; color?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const c = vars(); const acc = color || c.accent;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth || 600, H = height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const g = cv.getContext('2d'); if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const padL = 40, padR = 10, padT = 14, padB = 22, pw = W - padL - padR, ph = H - padT - padB;
    const xMax = xmax ?? xs[xs.length - 1] ?? 1;
    let last = xs.length;
    const yv = (i: number) => (ydb ? 20 * Math.log10(Math.max(ys[i], 1e-12)) : ys[i]);
    let yMin = Infinity, yMax = -Infinity;
    for (let i = 0; i < xs.length; i++) { if (xs[i] > xMax) { last = i; break; } const v = yv(i); if (v < yMin) yMin = v; if (v > yMax) yMax = v; }
    if (!isFinite(yMin)) { yMin = 0; yMax = 1; }
    if (ydb) { yMin = Math.max(yMin, yMax - 80); } else if (yMin > 0) yMin = 0;
    if (yMin === yMax) yMax = yMin + 1;
    const sx = (x: number) => padL + (x / xMax) * pw;
    const sy = (v: number) => padT + ph - ((v - yMin) / (yMax - yMin)) * ph;
    // axes
    g.strokeStyle = c.grid; g.lineWidth = 1; g.beginPath();
    g.moveTo(padL, padT); g.lineTo(padL, padT + ph); g.lineTo(padL + pw, padT + ph); g.stroke();
    g.fillStyle = c.dim; g.font = '10px ui-monospace, monospace';
    for (let k = 0; k <= 5; k++) { const xv = (xMax * k) / 5; g.fillText(xv >= 1000 ? (xv / 1000).toFixed(1) + 'k' : xv.toFixed(xMax < 10 ? 2 : 0), sx(xv) - 8, padT + ph + 13); }
    g.fillText(ydb ? 'dB' : '', padL - 30, padT + 6);
    // combs
    for (const cb of combs) {
      g.strokeStyle = cb.color; g.fillStyle = cb.color; g.font = '9px ui-sans-serif';
      for (let k = 1; k <= cb.harmonics; k++) {
        const fx = cb.base * k; if (fx > xMax || fx <= 0) break;
        const px = sx(fx); g.setLineDash([3, 3]); g.globalAlpha = k === 1 ? 0.9 : 0.45;
        g.beginPath(); g.moveTo(px, padT); g.lineTo(px, padT + ph); g.stroke();
        g.globalAlpha = 1; g.setLineDash([]);
        if (k === 1) g.fillText(cb.label, px + 2, padT + 9);
      }
    }
    // series
    g.strokeStyle = acc; g.fillStyle = acc; g.lineWidth = 1.2;
    if (kind === 'stem') {
      const y0 = sy(Math.max(0, yMin));
      for (let i = 0; i < last; i++) { const px = sx(xs[i]); g.globalAlpha = 0.9; g.beginPath(); g.moveTo(px, y0); g.lineTo(px, sy(yv(i))); g.stroke(); }
      g.globalAlpha = 1;
    } else {
      g.beginPath();
      for (let i = 0; i < last; i++) { const px = sx(xs[i]), py = sy(yv(i)); if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); }
      g.stroke();
    }
    if (xlabel) { g.fillStyle = c.dim; g.fillText(xlabel, padL + pw - 60, padT + ph + 13); }
  });
  return <canvas ref={ref} style={{ width: '100%', height, display: 'block' }} />;
}
