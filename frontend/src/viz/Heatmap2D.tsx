import { useEffect, useRef, useState } from 'react';

export function viridis(t: number): [number, number, number] {
  const s = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]];
  t = Math.max(0, Math.min(1, t));
  const x = t * 4, i = Math.min(3, Math.floor(x)), f = x - i;
  const a = s[i], b = s[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

export interface VLine { x: number; color: string; label?: string }
/** A straight line segment in DATA space (x,y in axis units) — e.g. a Campbell order ray. */
export interface Segment { x0: number; y0: number; x1: number; y1: number; color: string; label?: string }
/** A polyline in DATA space — e.g. a resonance hyperbola on an order map. */
export interface Curve { pts: [number, number][]; color: string; label?: string }

/** Interactive 2D heatmap (x×y×value). Hover → readout; optional horizontal band overlay, vertical
 * marker lines (e.g. fault α-ridges on a CSC map), data-space line segments / polylines (Campbell
 * order lines + resonance) and a vertical x-band (operating-speed window). Perceptually-uniform viridis. */
export function Heatmap2D({
  cols, times, freqs, fmax, dbFloor = 60, height = 230, band, vlines = [],
  segments = [], curves = [], xBand, hoverExtra, maskBelow,
  norm = 'db', unit = 'dB', xunit = 's', xlabel = 't (s)', ylabel = 'Hz', yunit = 'Hz',
}: {
  cols: Float64Array[]; times: Float64Array; freqs: Float64Array; fmax?: number; dbFloor?: number;
  height?: number; band?: [number, number] | null; vlines?: VLine[];
  segments?: Segment[]; curves?: Curve[]; xBand?: [number, number] | null;
  hoverExtra?: (x: number, y: number) => string; maskBelow?: number | null;
  norm?: 'db' | 'lin'; unit?: string; xunit?: string; xlabel?: string; ylabel?: string; yunit?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hov, setHov] = useState<{ x: number; y: number; t: number; f: number; v: number } | null>(null);

  useEffect(() => {
    const cv = ref.current; if (!cv || !cols.length) return;
    const dpr = window.devicePixelRatio || 1; const W = cv.clientWidth || 600, H = height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const g = cv.getContext('2d'); if (!g) return; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const css = getComputedStyle(document.documentElement);
    const dim = css.getPropertyValue('--color-fg-faint').trim() || '#6c7785';
    const acc = css.getPropertyValue('--color-accent').trim() || '#58a6ff';
    const padL = 46, padR = 10, padT = 8, padB = 22, pw = W - padL - padR, ph = H - padT - padB;
    const nf = freqs.length; const fM = Math.min(fmax ?? freqs[nf - 1], freqs[nf - 1]);
    const rowMax = Math.min(nf - 1, Math.max(1, Math.round((fM / freqs[nf - 1]) * (nf - 1))));
    let vmax = -Infinity, vmin = Infinity;
    for (const c of cols) for (let f = 0; f <= rowMax; f++) { if (c[f] > vmax) vmax = c[f]; if (c[f] < vmin) vmin = c[f]; }
    if (norm === 'db') vmin = vmax - dbFloor;
    const span = vmax - vmin || 1;
    // render the heatmap to an offscreen canvas (CSS px) then drawImage — putImageData ignores the
    // dpr transform and would paint only a corner on hi-DPI screens.
    const iw = Math.max(1, Math.round(pw)), ih = Math.max(1, Math.round(ph));
    const off = document.createElement('canvas'); off.width = iw; off.height = ih;
    const og = off.getContext('2d'); if (!og) return;
    const img = og.createImageData(iw, ih);
    for (let px = 0; px < iw; px++) {
      const col = cols[Math.min(cols.length - 1, Math.floor((px / iw) * cols.length))];
      for (let py = 0; py < ih; py++) {
        const fr = Math.min(rowMax, Math.round((1 - py / ih) * rowMax));
        const v = col[fr];
        const [r, gg, b] = viridis(maskBelow != null && v < maskBelow ? 0 : (v - vmin) / span);
        const o = (py * iw + px) * 4; img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = 255;
      }
    }
    og.putImageData(img, 0, 0);
    g.drawImage(off, padL, padT, pw, ph);
    const x0 = times[0], x1 = times[times.length - 1];
    const xpos = (xv: number) => padL + ((xv - x0) / (x1 - x0 || 1)) * pw;
    const ypos = (yv: number) => padT + ph - (Math.max(0, Math.min(yv, fM)) / fM) * ph;
    if (xBand) {
      const bx1 = xpos(xBand[0]), bx2 = xpos(xBand[1]);
      g.fillStyle = acc; g.globalAlpha = 0.10; g.fillRect(Math.min(bx1, bx2), padT, Math.abs(bx2 - bx1), ph); g.globalAlpha = 1;
    }
    if (band) {
      const y1 = padT + ph - (Math.min(band[1], fM) / fM) * ph, y2 = padT + ph - (Math.min(band[0], fM) / fM) * ph;
      g.strokeStyle = acc; g.lineWidth = 1.5; g.setLineDash([4, 3]); g.strokeRect(padL, y1, pw, y2 - y1); g.setLineDash([]);
    }
    for (const vl of vlines) {
      const px = xpos(vl.x); if (px < padL || px > padL + pw) continue;
      g.strokeStyle = vl.color; g.globalAlpha = 0.85; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(px, padT); g.lineTo(px, padT + ph); g.stroke();
      g.setLineDash([]); if (vl.label) { g.fillStyle = vl.color; g.font = '9px ui-sans-serif, sans-serif'; g.fillText(vl.label, px + 2, padT + 10); } g.globalAlpha = 1;
    }
    // data-space order rays / lines (Campbell)
    g.save(); g.beginPath(); g.rect(padL, padT, pw, ph); g.clip();
    for (const sg of segments) {
      const ax = xpos(sg.x0), ay = ypos(sg.y0), bx = xpos(sg.x1), by = ypos(sg.y1);
      g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); // halo
      g.strokeStyle = sg.color; g.lineWidth = 1.6; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
      if (sg.label) { g.fillStyle = sg.color; g.font = '600 9px ui-sans-serif, sans-serif'; g.fillText(sg.label, Math.min(bx - 4, padL + pw - 56), Math.max(padT + 9, by - 3)); }
    }
    for (const cv of curves) {
      if (cv.pts.length < 2) continue;
      g.strokeStyle = cv.color; g.lineWidth = 1.3; g.globalAlpha = 0.9; g.setLineDash([5, 4]); g.beginPath();
      cv.pts.forEach((p, i) => { const px = xpos(p[0]), py = ypos(p[1]); i === 0 ? g.moveTo(px, py) : g.lineTo(px, py); });
      g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
      if (cv.label) { const last = cv.pts[cv.pts.length - 1]; g.fillStyle = cv.color; g.font = '9px ui-sans-serif, sans-serif'; g.fillText(cv.label, xpos(last[0]) - 4, ypos(last[1]) - 3); }
    }
    g.restore();
    g.fillStyle = dim; g.font = '10px ui-monospace, monospace';
    for (let k = 0; k <= 4; k++) { const tt = x0 + (x1 - x0) * (k / 4); g.fillText(tt >= 1000 ? (tt / 1000).toFixed(1) + 'k' : tt.toFixed(tt < 5 ? 2 : 0), padL + (pw * k) / 4 - 8, padT + ph + 13); }
    for (let k = 0; k <= 4; k++) { const ff = (fM * k) / 4; g.fillText(ff >= 1000 ? (ff / 1000).toFixed(1) + 'k' : ff.toFixed(0), 2, padT + ph - (ph * k) / 4 + 3); }
    g.fillText(xlabel, padL + pw - 44, padT + ph + 13); g.save(); g.translate(10, padT + 10); g.fillText(ylabel, 0, 0); g.restore();
  }, [cols, times, freqs, fmax, dbFloor, height, band, vlines, segments, curves, xBand, maskBelow, norm, xlabel, ylabel]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cv = ref.current; if (!cv || !cols.length) return;
    const rect = cv.getBoundingClientRect(); const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const padL = 46, padT = 8, padB = 22, pw = rect.width - padL - 10, ph = rect.height - padT - padB;
    if (x < padL || y < padT || y > padT + ph || x > padL + pw) { setHov(null); return; }
    const fM = fmax ?? freqs[freqs.length - 1];
    const t = times[Math.min(times.length - 1, Math.floor(((x - padL) / pw) * times.length))];
    const f = (1 - (y - padT) / ph) * fM;
    const ci = Math.min(cols.length - 1, Math.floor(((x - padL) / pw) * cols.length));
    const fi = Math.min(freqs.length - 1, Math.round((f / freqs[freqs.length - 1]) * (freqs.length - 1)));
    setHov({ x, y, t, f, v: cols[ci][fi] });
  };

  return (
    <div className="heatmap-wrap" style={{ position: 'relative' }}>
      <canvas ref={ref} style={{ width: '100%', height, display: 'block' }} onMouseMove={onMove} onMouseLeave={() => setHov(null)} />
      {hov && <div className="heatmap-readout" style={{ left: Math.min(hov.x + 8, 200), top: hov.y - 4 }}>{hov.t.toFixed(hov.t < 5 ? 3 : 0)} {xunit} · {hov.f.toFixed(yunit === 'Hz' ? 0 : 2)} {yunit}{hoverExtra ? ` · ${hoverExtra(hov.t, hov.f)}` : ''} · {hov.v.toFixed(norm === 'db' ? 1 : 2)} {unit}</div>}
    </div>
  );
}
