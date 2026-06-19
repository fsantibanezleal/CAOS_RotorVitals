import { useEffect, useRef, useState } from 'react';
import { type Kurtogram } from '../dsp/kurtogram';

function css(name: string, fb: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb;
}
// perceptual-ish ramp dark -> teal -> accent -> warn (avoids the jet/rainbow trap)
function ramp(t: number): string {
  const stops = [[13, 17, 23], [18, 70, 90], [63, 177, 200], [88, 166, 255], [210, 153, 34]];
  t = Math.max(0, Math.min(1, t));
  const x = t * (stops.length - 1); const i = Math.floor(x); const f = x - i;
  const a = stops[i]; const b = stops[Math.min(i + 1, stops.length - 1)];
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
}

/** The kurtogram heatmap: rows = decomposition levels, each split into 2^level frequency cells,
 * colored by envelope kurtosis. The maximal-kurtosis cell (optimal demodulation band) is outlined. */
export function Kurtogram({ kg, fs, height = 220, onPick }: { kg: Kurtogram; fs: number; height?: number; onPick?: (band: [number, number]) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hov, setHov] = useState<{ x: number; y: number; level: number; f1: number; f2: number; kurt: number } | null>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const padLc = 64, padTc = 8, padBc = 24;
    const onClick = onPick
      ? (e: MouseEvent) => {
          const rect = cv.getBoundingClientRect();
          const x = e.clientX - rect.left, y = e.clientY - rect.top;
          const pw = rect.width - padLc - 12, ph = rect.height - padTc - padBc;
          if (x < padLc || y < padTc || y > padTc + ph) return;
          const row = Math.min(kg.cells.length - 1, Math.max(0, Math.floor(((y - padTc) / ph) * kg.cells.length)));
          const level = kg.cells[row][0].level;
          const nb = 2 ** level, bw = fs / 2 / nb;
          const f = ((x - padLc) / pw) * (fs / 2);
          const bi = Math.min(nb - 1, Math.max(0, Math.floor(f / bw)));
          onPick([Math.max(bi * bw, 0.02 * fs), (bi + 1) * bw]);
        }
      : null;
    if (onClick) { cv.style.cursor = 'crosshair'; cv.addEventListener('click', onClick); }
    const dpr = window.devicePixelRatio || 1; const W = cv.clientWidth || 600, H = height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const g = cv.getContext('2d'); if (!g) return; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const dim = css('--color-fg-faint', '#6c7785'), fg = css('--color-fg', '#c9d1d9'), good = css('--color-good', '#3fb950');
    const padL = 64, padR = 12, padT = 8, padB = 24, pw = W - padL - padR, ph = H - padT - padB;
    const nyq = fs / 2; const rows = kg.cells.length; const rh = ph / rows;
    let kmax = 0; for (const row of kg.cells) for (const c of row) kmax = Math.max(kmax, c.kurt);
    kmax = kmax || 1;
    g.font = '10px ui-monospace, monospace';
    kg.cells.forEach((row, r) => {
      const y = padT + r * rh;
      for (const c of row) {
        const x1 = padL + (c.f1 / nyq) * pw, x2 = padL + (c.f2 / nyq) * pw;
        g.fillStyle = ramp(Math.max(0, c.kurt) / kmax);
        g.fillRect(x1, y, x2 - x1, rh - 1);
      }
      g.fillStyle = dim; g.fillText(`L${row[0].level}`, 6, y + rh / 2 + 3);
    });
    // outline best
    const b = kg.best; const r = b.level - kg.cells[0][0].level;
    const x1 = padL + (b.f1 / nyq) * pw, x2 = padL + (b.f2 / nyq) * pw, y = padT + r * rh;
    g.strokeStyle = good; g.lineWidth = 2; g.strokeRect(x1, y, x2 - x1, rh - 1);
    g.fillStyle = good; g.fillText(`max K=${b.kurt.toFixed(1)} @ ${((b.f1 + b.f2) / 2 / 1000).toFixed(1)}kHz`, x2 + 4 > pw ? padL : x1, y - 1 < padT + 8 ? padT + 10 : y - 2);
    // x axis
    g.strokeStyle = dim; g.beginPath(); g.moveTo(padL, padT + ph); g.lineTo(padL + pw, padT + ph); g.stroke();
    g.fillStyle = dim; for (let k = 0; k <= 5; k++) { const f = (nyq * k) / 5; g.fillText((f / 1000).toFixed(1) + 'k', padL + (f / nyq) * pw - 8, padT + ph + 14); }
    g.fillStyle = fg; g.fillText('frequency (Hz)', padL + pw - 80, padT + ph + 14);
    return () => { if (onClick) cv.removeEventListener('click', onClick); };
  }, [kg, fs, height, onPick]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cv = ref.current; if (!cv) return;
    const rect = cv.getBoundingClientRect(); const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const padL = 64, padT = 8, padB = 24, pw = rect.width - padL - 12, ph = rect.height - padT - padB;
    if (x < padL || y < padT || y > padT + ph || x > padL + pw) { setHov(null); return; }
    const row = Math.min(kg.cells.length - 1, Math.max(0, Math.floor(((y - padT) / ph) * kg.cells.length)));
    const cells = kg.cells[row]; const f = ((x - padL) / pw) * (fs / 2);
    const cell = cells.find((c) => f >= c.f1 && f < c.f2) ?? cells[cells.length - 1];
    setHov({ x, y, level: cell.level, f1: cell.f1, f2: cell.f2, kurt: cell.kurt });
  };

  return (
    <div className="kg-wrap" style={{ position: 'relative' }}>
      <canvas ref={ref} style={{ width: '100%', height, display: 'block' }} onMouseMove={onMove} onMouseLeave={() => setHov(null)} />
      {hov && <div className="heatmap-readout" style={{ left: Math.min(hov.x + 8, 220), top: Math.max(2, hov.y - 4) }}>L{hov.level} · {(hov.f1 / 1000).toFixed(2)}–{(hov.f2 / 1000).toFixed(2)} kHz · K={hov.kurt.toFixed(2)}</div>}
    </div>
  );
}
