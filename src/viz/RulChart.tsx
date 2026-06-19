import { useEffect, useRef, useState } from 'react';
import { type HIPoint, type RulResult } from '../dsp/health';

function css(name: string, fb: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb;
}

const PAD = { L: 42, R: 12, T: 12, B: 24 };

/** Health-indicator trend with the failure threshold, the detected onset, and the forward RUL
 * projection fan (±2σ band + median). The honest way to show RUL: a credible interval, not a point.
 * Hover reads (time, HI) on the observed trend and the projected median on the fan. */
export function RulChart({ points, rul, height = 220 }: { points: HIPoint[]; rul: RulResult; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hov, setHov] = useState<{ x: number; y: number; t: number; hi: number; kind: 'obs' | 'proj' } | null>(null);

  // shared plot geometry (kept in a ref so the move handler maps pixels→data the same way as the draw)
  const geo = useRef<{ tMax: number; hMax: number; W: number }>({ tMax: 1, hMax: 1, W: 600 });

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const dpr = window.devicePixelRatio || 1; const W = cv.clientWidth || 600, H = height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const g = cv.getContext('2d'); if (!g) return; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const dim = css('--color-fg-faint', '#6c7785'), grid = css('--color-border', '#30363d'),
      acc = css('--color-accent', '#58a6ff'), mag = css('--color-magenta', '#f778ba'),
      bad = css('--color-bad', '#f85149'), warn = css('--color-warn', '#d29922'), fg = css('--color-fg', '#c9d1d9');
    const pw = W - PAD.L - PAD.R, ph = H - PAD.T - PAD.B;
    const allT = [...points.map((p) => p.t), ...rul.curve.map((c) => c.t), rul.failTime ?? 0];
    const tMax = Math.max(...allT) * 1.02;
    const allH = [...points.map((p) => p.hi), ...rul.curve.map((c) => c.hi), rul.threshold];
    const hMax = Math.max(...allH) * 1.1;
    geo.current = { tMax, hMax, W };
    const sx = (t: number) => PAD.L + (t / tMax) * pw;
    const sy = (h: number) => PAD.T + ph - (h / hMax) * ph;
    g.strokeStyle = grid; g.lineWidth = 1; g.beginPath(); g.moveTo(PAD.L, PAD.T); g.lineTo(PAD.L, PAD.T + ph); g.lineTo(PAD.L + pw, PAD.T + ph); g.stroke();
    g.fillStyle = dim; g.font = '10px ui-monospace, monospace';
    for (let k = 0; k <= 5; k++) { const t = (tMax * k) / 5; g.fillText(t.toFixed(0), sx(t) - 6, PAD.T + ph + 13); }
    for (let k = 1; k <= 4; k++) { const h = (hMax * k) / 4; g.fillText(h.toFixed(1), 6, sy(h) + 3); }
    g.fillText('h', PAD.L + pw - 8, PAD.T + ph + 13);
    g.save(); g.translate(10, PAD.T + 8); g.fillText('HI (g)', 0, 0); g.restore();
    // threshold
    g.strokeStyle = bad; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(PAD.L, sy(rul.threshold)); g.lineTo(PAD.L + pw, sy(rul.threshold)); g.stroke(); g.setLineDash([]);
    g.fillStyle = bad; g.fillText(`threshold ${rul.threshold.toFixed(1)} g`, PAD.L + 2, sy(rul.threshold) - 3);
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
    if (rul.onset != null) { g.strokeStyle = warn; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(sx(rul.onset), PAD.T); g.lineTo(sx(rul.onset), PAD.T + ph); g.stroke(); g.setLineDash([]); g.fillStyle = warn; g.fillText(`onset ${rul.onset.toFixed(0)} h`, sx(rul.onset) + 2, PAD.T + 9); }
    // observed HI points + line
    g.strokeStyle = acc; g.lineWidth = 1.4; g.beginPath();
    points.forEach((p, i) => { const x = sx(p.t), y = sy(p.hi); i === 0 ? g.moveTo(x, y) : g.lineTo(x, y); }); g.stroke();
    g.fillStyle = acc; for (const p of points) { g.beginPath(); g.arc(sx(p.t), sy(p.hi), 1.7, 0, 7); g.fill(); }
    // hover crosshair + marker
    if (hov) {
      g.strokeStyle = fg; g.globalAlpha = 0.5; g.setLineDash([2, 2]); g.beginPath(); g.moveTo(sx(hov.t), PAD.T); g.lineTo(sx(hov.t), PAD.T + ph); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
      g.fillStyle = hov.kind === 'proj' ? mag : acc; g.beginPath(); g.arc(sx(hov.t), sy(hov.hi), 3.2, 0, 7); g.fill();
    }
  }, [points, rul, height, hov]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cv = ref.current; if (!cv) return;
    const rect = cv.getBoundingClientRect(); const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const pw = rect.width - PAD.L - PAD.R, ph = rect.height - PAD.T - PAD.B;
    if (x < PAD.L || x > PAD.L + pw || y < PAD.T || y > PAD.T + ph) { setHov(null); return; }
    const t = ((x - PAD.L) / pw) * geo.current.tMax;
    const lastObs = points[points.length - 1]?.t ?? 0;
    if (t <= lastObs) {
      let best = points[0], bd = Infinity;
      for (const p of points) { const d = Math.abs(p.t - t); if (d < bd) { bd = d; best = p; } }
      setHov({ x, y, t: best.t, hi: best.hi, kind: 'obs' });
    } else if (rul.curve.length) {
      let best = rul.curve[0], bd = Infinity;
      for (const c of rul.curve) { const d = Math.abs(c.t - t); if (d < bd) { bd = d; best = c; } }
      setHov({ x, y, t: best.t, hi: best.mid, kind: 'proj' });
    } else setHov(null);
  };

  return (
    <div className="rul-wrap" style={{ position: 'relative' }}>
      <canvas ref={ref} style={{ width: '100%', height, display: 'block' }} onMouseMove={onMove} onMouseLeave={() => setHov(null)} />
      {hov && <div className="heatmap-readout" style={{ left: Math.min(hov.x + 8, geo.current.W - 150), top: Math.max(2, hov.y - 4) }}>{hov.kind === 'proj' ? 'proj · ' : ''}t={hov.t.toFixed(0)} h · HI={hov.hi.toFixed(2)} g</div>}
    </div>
  );
}
