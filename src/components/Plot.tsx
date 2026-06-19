import { useEffect, useRef } from 'react';

export interface Marker {
  x: number;
  label: string;
  color: string;
}

function fmt(v: number): string {
  if (v >= 1000) return (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + 'k';
  return v < 10 ? v.toFixed(2) : v.toFixed(0);
}

export function Plot({
  xs,
  ys,
  color = '#58a6ff',
  markers = [],
  xmax,
  height = 150,
  xlabel,
}: {
  xs: Float64Array;
  ys: Float64Array;
  color?: string;
  markers?: Marker[];
  xmax?: number;
  height?: number;
  xlabel?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth || 600;
    const H = height;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    const g = cv.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);

    const css = getComputedStyle(document.documentElement);
    const dim = css.getPropertyValue('--text-dim').trim() || '#888';
    const grid = css.getPropertyValue('--border').trim() || '#333';

    const padL = 30;
    const padR = 10;
    const padT = 8;
    const padB = 20;
    const pw = W - padL - padR;
    const ph = H - padT - padB;

    const xMax = xmax ?? xs[xs.length - 1] ?? 1;
    let last = xs.length;
    let yMin = Infinity;
    let yMax = -Infinity;
    for (let i = 0; i < xs.length; i++) {
      if (xs[i] > xMax) {
        last = i;
        break;
      }
      const v = ys[i];
      if (v < yMin) yMin = v;
      if (v > yMax) yMax = v;
    }
    if (!isFinite(yMin)) {
      yMin = 0;
      yMax = 1;
    }
    if (yMin > 0) yMin = 0;
    if (yMin === yMax) yMax = yMin + 1;

    const sx = (x: number) => padL + (x / xMax) * pw;
    const sy = (y: number) => padT + ph - ((y - yMin) / (yMax - yMin)) * ph;

    g.strokeStyle = grid;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(padL, padT);
    g.lineTo(padL, padT + ph);
    g.lineTo(padL + pw, padT + ph);
    g.stroke();

    g.fillStyle = dim;
    g.font = '10px ui-sans-serif, system-ui, sans-serif';
    for (let k = 0; k <= 5; k++) {
      const xv = (xMax * k) / 5;
      g.fillText(fmt(xv), sx(xv) - 8, padT + ph + 13);
    }

    for (const m of markers) {
      if (m.x > xMax || m.x <= 0) continue;
      const px = sx(m.x);
      g.strokeStyle = m.color;
      g.setLineDash([4, 3]);
      g.beginPath();
      g.moveTo(px, padT);
      g.lineTo(px, padT + ph);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = m.color;
      g.fillText(m.label, px + 2, padT + 9);
    }

    g.strokeStyle = color;
    g.lineWidth = 1.2;
    g.beginPath();
    for (let i = 0; i < last; i++) {
      const px = sx(xs[i]);
      const py = sy(ys[i]);
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.stroke();

    if (xlabel) {
      g.fillStyle = dim;
      g.fillText(xlabel, padL + pw - 64, padT + ph + 13);
    }
  });

  return <canvas ref={ref} style={{ width: '100%', height, display: 'block' }} />;
}
