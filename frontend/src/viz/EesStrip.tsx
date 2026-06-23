import { useEffect, useRef } from 'react';
import type { VLine } from './Heatmap2D';

// T9 — the Enhanced Envelope Spectrum strip: EES(α) = ⟨|γ(f,α)|⟩ over carriers, the band-integrated 1-D marginal of
// the Fast-SC plane. Peaks at BPFO/BPFI/2·BSF/FTF + harmonics; the classical SES is its band-restricted special
// case. A compact canvas line plot that SHARES the heatmap's α x-axis so the defect-frequency vlines align.
export function EesStrip({ alpha, ees, vlines = [], floor = null, height = 90 }:
  { alpha: Float64Array; ees: Float64Array; vlines?: VLine[]; floor?: number | null; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv || !alpha.length) return;
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 600, H = height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const g = cv.getContext('2d'); if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const css = getComputedStyle(document.documentElement);
    const acc = css.getPropertyValue('--color-accent').trim() || '#58a6ff';
    const dim = css.getPropertyValue('--color-fg-faint').trim() || '#6c7785';
    const padL = 46, padR = 10, padT = 6, padB = 16, pw = W - padL - padR, ph = H - padT - padB;
    let vmax = 1e-9; for (let i = 1; i < ees.length; i++) if (ees[i] > vmax) vmax = ees[i];
    if (floor != null && floor > vmax) vmax = floor;
    const x0 = alpha[0], x1 = alpha[alpha.length - 1] || 1;
    const xpos = (xv: number) => padL + ((xv - x0) / (x1 - x0 || 1)) * pw;
    const ypos = (v: number) => padT + ph - (v / vmax) * ph;
    // filled area
    g.beginPath(); g.moveTo(padL, padT + ph);
    for (let i = 0; i < ees.length; i++) g.lineTo(xpos(alpha[i]), ypos(ees[i]));
    g.lineTo(padL + pw, padT + ph); g.closePath();
    g.fillStyle = acc; g.globalAlpha = 0.18; g.fill(); g.globalAlpha = 1;
    // line
    g.strokeStyle = acc; g.lineWidth = 1.2; g.beginPath();
    for (let i = 0; i < ees.length; i++) { const px = xpos(alpha[i]), py = ypos(ees[i]); i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke();
    // significance floor guide
    if (floor != null) { const y = ypos(floor); g.strokeStyle = dim; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(padL, y); g.lineTo(padL + pw, y); g.stroke(); g.setLineDash([]); }
    // defect-frequency markers
    for (const vl of vlines) { const px = xpos(vl.x); if (px < padL || px > padL + pw) continue; g.strokeStyle = vl.color; g.globalAlpha = 0.7; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(px, padT); g.lineTo(px, padT + ph); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; }
    g.fillStyle = dim; g.font = '9px ui-monospace, monospace'; g.fillText('EES ⟨|γ|⟩', 3, padT + 9);
  }, [alpha, ees, vlines, floor, height]);
  return <canvas ref={ref} style={{ width: '100%', height, display: 'block' }} />;
}
