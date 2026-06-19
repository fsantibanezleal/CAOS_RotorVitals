import { useEffect, useRef } from 'react';
import { type HIPoint, type RulResult } from '../dsp/health';

function css(name: string, fb: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb;
}

/** Health-indicator trend with the failure threshold, the detected onset, and the forward RUL
 * projection fan (±2σ band + median). The honest way to show RUL: a credible interval, not a point. */
export function RulChart({ points, rul, height = 220 }: { points: HIPoint[]; rul: RulResult; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const dpr = window.devicePixelRatio || 1; const W = cv.clientWidth || 600, H = height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const g = cv.getContext('2d'); if (!g) return; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const dim = css('--color-fg-faint', '#6c7785'), grid = css('--color-border', '#30363d'),
      acc = css('--color-accent', '#58a6ff'), mag = css('--color-magenta', '#f778ba'),
      bad = css('--color-bad', '#f85149'), warn = css('--color-warn', '#d29922');
    const padL = 42, padR = 12, padT = 12, padB = 24, pw = W - padL - padR, ph = H - padT - padB;
    const allT = [...points.map((p) => p.t), ...rul.curve.map((c) => c.t), rul.failTime ?? 0];
    const tMax = Math.max(...allT) * 1.02;
    const allH = [...points.map((p) => p.hi), ...rul.curve.map((c) => c.hi), rul.threshold];
    const hMax = Math.max(...allH) * 1.1;
    const sx = (t: number) => padL + (t / tMax) * pw;
    const sy = (h: number) => padT + ph - (h / hMax) * ph;
    g.strokeStyle = grid; g.lineWidth = 1; g.beginPath(); g.moveTo(padL, padT); g.lineTo(padL, padT + ph); g.lineTo(padL + pw, padT + ph); g.stroke();
    g.fillStyle = dim; g.font = '10px ui-monospace, monospace';
    for (let k = 0; k <= 5; k++) { const t = (tMax * k) / 5; g.fillText(t.toFixed(0), sx(t) - 6, padT + ph + 13); }
    g.fillText('h', padL + pw - 8, padT + ph + 13);
    // threshold
    g.strokeStyle = bad; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(padL, sy(rul.threshold)); g.lineTo(padL + pw, sy(rul.threshold)); g.stroke(); g.setLineDash([]);
    g.fillStyle = bad; g.fillText('threshold', padL + 2, sy(rul.threshold) - 3);
    // RUL fan band
    if (rul.curve.length > 1) {
      g.fillStyle = mag; g.globalAlpha = 0.18; g.beginPath();
      rul.curve.forEach((c, i) => { const x = sx(c.t), y = sy(Math.min(c.hi, hMax)); i === 0 ? g.moveTo(x, y) : g.lineTo(x, y); });
      for (let i = rul.curve.length - 1; i >= 0; i--) { const c = rul.curve[i]; g.lineTo(sx(c.t), sy(c.lo)); }
      g.closePath(); g.fill(); g.globalAlpha = 1;
      g.strokeStyle = mag; g.setLineDash([4, 3]); g.beginPath();
      rul.curve.forEach((c, i) => { const x = sx(c.t), y = sy(Math.min(c.mid, hMax)); i === 0 ? g.moveTo(x, y) : g.lineTo(x, y); }); g.stroke(); g.setLineDash([]);
    }
    // onset marker
    if (rul.onset != null) { g.strokeStyle = warn; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(sx(rul.onset), padT); g.lineTo(sx(rul.onset), padT + ph); g.stroke(); g.setLineDash([]); g.fillStyle = warn; g.fillText('onset', sx(rul.onset) + 2, padT + 9); }
    // observed HI points + line
    g.strokeStyle = acc; g.lineWidth = 1.4; g.beginPath();
    points.forEach((p, i) => { const x = sx(p.t), y = sy(p.hi); i === 0 ? g.moveTo(x, y) : g.lineTo(x, y); }); g.stroke();
    g.fillStyle = acc; for (const p of points) { g.beginPath(); g.arc(sx(p.t), sy(p.hi), 1.7, 0, 7); g.fill(); }
  });
  return <canvas ref={ref} style={{ width: '100%', height, display: 'block' }} />;
}
