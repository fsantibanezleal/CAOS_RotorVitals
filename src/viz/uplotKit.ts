import uPlot from 'uplot';

export interface Comb { base: number; harmonics: number; color: string; label: string }

function vars() {
  const s = getComputedStyle(document.documentElement);
  const g = (k: string, fb: string) => s.getPropertyValue(k).trim() || fb;
  return {
    fg: g('--color-fg', '#c9d1d9'), dim: g('--color-fg-faint', '#6c7785'),
    grid: g('--color-border', '#30363d'), accent: g('--color-accent', '#58a6ff'),
  };
}

/** Base uPlot options for a themed line chart (zoom/pan/crosshair built in). */
export function lineOpts(width: number, height: number, opts: { label: string; color?: string; xUnit?: string }): uPlot.Options {
  const v = vars();
  const c = opts.color || v.accent;
  return {
    width, height,
    scales: { x: { time: false }, y: {} },
    cursor: { drag: { x: true, y: false }, points: { show: true } },
    legend: { show: false },
    series: [
      { label: opts.xUnit || 'x' },
      { label: opts.label, stroke: c, width: 1.4, points: { show: false } },
    ],
    axes: [
      { stroke: v.dim, grid: { stroke: v.grid, width: 0.5 }, ticks: { stroke: v.grid }, font: '10px ui-monospace, monospace' },
      { stroke: v.dim, grid: { stroke: v.grid, width: 0.5 }, ticks: { stroke: v.grid }, size: 44, font: '10px ui-monospace, monospace' },
    ],
  };
}

/** Vertical harmonic/defect combs (k·base), first harmonic labeled. */
export function combsPlugin(combs: Comb[]): uPlot.Plugin {
  return {
    hooks: {
      draw: (u: uPlot) => {
        const ctx = u.ctx; const r = uPlot.pxRatio; const { top, height } = u.bbox;
        const lo = u.scales.x!.min!, hi = u.scales.x!.max!;
        ctx.save(); ctx.lineWidth = 1 * r;
        for (const cb of combs) {
          if (cb.base <= 0) continue;
          for (let k = 1; k <= cb.harmonics; k++) {
            const fx = cb.base * k; if (fx < lo || fx > hi) continue;
            const px = u.valToPos(fx, 'x', true);
            ctx.strokeStyle = cb.color; ctx.globalAlpha = k === 1 ? 0.9 : 0.4;
            ctx.setLineDash([3 * r, 3 * r]); ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px, top + height); ctx.stroke();
            if (k === 1) { ctx.globalAlpha = 1; ctx.setLineDash([]); ctx.fillStyle = cb.color; ctx.font = `${10 * r}px ui-sans-serif, sans-serif`; ctx.fillText(cb.label, px + 3 * r, top + 11 * r); }
          }
        }
        ctx.restore();
      },
    },
  };
}

/** Shaded x-regions (demod band, detection windows). */
export function regionsPlugin(regions: [number, number][], color: string): uPlot.Plugin {
  return {
    hooks: {
      draw: (u: uPlot) => {
        if (!regions.length) return;
        const ctx = u.ctx; const { top, height } = u.bbox;
        ctx.save(); ctx.fillStyle = color; ctx.globalAlpha = 0.13;
        for (const [a, b] of regions) {
          const x1 = u.valToPos(a, 'x', true), x2 = u.valToPos(b, 'x', true);
          ctx.fillRect(x1, top, Math.max(1, x2 - x1), height);
        }
        ctx.restore();
      },
    },
  };
}

/** Downward tick markers at given x positions (outliers / detected impulses). */
export function vmarksPlugin(xs: number[], color: string): uPlot.Plugin {
  return {
    hooks: {
      draw: (u: uPlot) => {
        if (!xs.length) return;
        const ctx = u.ctx; const r = uPlot.pxRatio; const { top } = u.bbox;
        const lo = u.scales.x!.min!, hi = u.scales.x!.max!;
        ctx.save(); ctx.fillStyle = color;
        for (const x of xs) {
          if (x < lo || x > hi) continue;
          const px = u.valToPos(x, 'x', true);
          ctx.beginPath(); ctx.moveTo(px - 3 * r, top); ctx.lineTo(px + 3 * r, top); ctx.lineTo(px, top + 6 * r); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      },
    },
  };
}
