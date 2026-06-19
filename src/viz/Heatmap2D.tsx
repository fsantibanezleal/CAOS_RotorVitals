import { useEffect, useRef, useState } from 'react';

function viridis(t: number): [number, number, number] {
  const s = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]];
  t = Math.max(0, Math.min(1, t));
  const x = t * 4, i = Math.min(3, Math.floor(x)), f = x - i;
  const a = s[i], b = s[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/** Interactive 2D heatmap (time×frequency×dB). Hover → (t, f, value) readout; optional horizontal
 * band overlay (e.g. the demod band). Perceptually-uniform viridis; dB floor adjustable upstream. */
export function Heatmap2D({
  cols, times, freqs, fmax, dbFloor = 60, height = 230, band, xlabel = 't (s)', ylabel = 'Hz',
}: {
  cols: Float64Array[]; times: Float64Array; freqs: Float64Array; fmax?: number; dbFloor?: number;
  height?: number; band?: [number, number] | null; xlabel?: string; ylabel?: string;
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
    const padL = 44, padR = 10, padT = 8, padB = 22, pw = W - padL - padR, ph = H - padT - padB;
    const nf = freqs.length; const fM = fmax ?? freqs[nf - 1];
    const rowMax = Math.max(1, Math.round((fM / freqs[nf - 1]) * (nf - 1)));
    // global max dB for normalization
    let vmax = -Infinity; for (const c of cols) for (let f = 0; f <= rowMax; f++) if (c[f] > vmax) vmax = c[f];
    const vmin = vmax - dbFloor;
    const img = g.createImageData(Math.max(1, Math.round(pw)), Math.max(1, Math.round(ph)));
    const iw = img.width, ih = img.height;
    for (let px = 0; px < iw; px++) {
      const ci = Math.min(cols.length - 1, Math.floor((px / iw) * cols.length));
      const col = cols[ci];
      for (let py = 0; py < ih; py++) {
        const fr = Math.round((1 - py / ih) * rowMax);
        const v = (col[fr] - vmin) / (vmax - vmin);
        const [r, gg, b] = viridis(v);
        const o = (py * iw + px) * 4; img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, Math.round(padL), Math.round(padT));
    // band overlay (horizontal freq band)
    if (band) {
      const y1 = padT + ph - (Math.min(band[1], fM) / fM) * ph, y2 = padT + ph - (Math.min(band[0], fM) / fM) * ph;
      g.strokeStyle = acc; g.lineWidth = 1.5; g.setLineDash([4, 3]); g.strokeRect(padL, y1, pw, y2 - y1); g.setLineDash([]);
    }
    // axes
    g.fillStyle = dim; g.font = '10px ui-monospace, monospace';
    for (let k = 0; k <= 4; k++) { const tt = times[0] + (times[times.length - 1] - times[0]) * (k / 4); g.fillText(tt.toFixed(2), padL + (pw * k) / 4 - 8, padT + ph + 13); }
    for (let k = 0; k <= 4; k++) { const ff = (fM * k) / 4; g.fillText(ff >= 1000 ? (ff / 1000).toFixed(1) + 'k' : ff.toFixed(0), 2, padT + ph - (ph * k) / 4 + 3); }
    g.fillText(xlabel, padL + pw - 40, padT + ph + 13); g.save(); g.translate(10, padT + 8); g.fillText(ylabel, 0, 0); g.restore();
  }, [cols, times, freqs, fmax, dbFloor, height, band, xlabel, ylabel]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cv = ref.current; if (!cv || !cols.length) return;
    const rect = cv.getBoundingClientRect(); const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const padL = 44, padT = 8, padB = 22, pw = rect.width - padL - 10, ph = rect.height - padT - padB;
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
      {hov && <div className="heatmap-readout" style={{ left: Math.min(hov.x + 8, 200), top: hov.y - 4 }}>{hov.t.toFixed(3)} s · {hov.f.toFixed(0)} Hz · {hov.v.toFixed(1)} dB</div>}
    </div>
  );
}
