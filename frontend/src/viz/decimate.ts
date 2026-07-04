// MinMax-per-pixel decimation, preserves impulse extrema (unlike averaging/LTTB), so bearing
// impacts survive in the displayed waveform. Display-only; DSP always uses the full-res buffer.
export function minMaxDecimate(xs: Float64Array, ys: Float64Array, xmax: number, targetCols: number): [number[], number[]] {
  let n = xs.length;
  for (let i = 0; i < xs.length; i++) { if (xs[i] > xmax) { n = i; break; } }
  if (n <= targetCols * 2) return [Array.from(xs.slice(0, n)), Array.from(ys.slice(0, n))];
  const ox: number[] = [];
  const oy: number[] = [];
  const bucket = n / targetCols;
  for (let c = 0; c < targetCols; c++) {
    const s = Math.floor(c * bucket);
    const e = Math.min(n, Math.floor((c + 1) * bucket));
    if (e <= s) continue;
    let lo = Infinity, hi = -Infinity, li = s, hisi = s;
    for (let i = s; i < e; i++) { if (ys[i] < lo) { lo = ys[i]; li = i; } if (ys[i] > hi) { hi = ys[i]; hisi = i; } }
    // emit min & max ordered by their sample position (keep x increasing)
    if (li <= hisi) { ox.push(xs[li]); oy.push(lo); ox.push(xs[hisi]); oy.push(hi); }
    else { ox.push(xs[hisi]); oy.push(hi); ox.push(xs[li]); oy.push(lo); }
  }
  return [ox, oy];
}
