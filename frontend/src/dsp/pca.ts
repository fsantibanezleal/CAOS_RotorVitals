// Top-2 principal components by orthogonal power iteration on the covariance (cov·v = (1/n)·Cᵀ(C v), C centered).
// Deterministic seed; for the feature embedding (n≈33 segments, d=100 WDCNN features) it is instant. Returns the
// 2-D projection of each row + the fraction of total variance each PC explains.
export function pca2d(X: number[][]): { pts: [number, number][]; varExpl: [number, number] } {
  const n = X.length, d = X[0]?.length ?? 0;
  if (!n || !d) return { pts: [], varExpl: [0, 0] };
  const mean = new Array(d).fill(0);
  for (const r of X) for (let j = 0; j < d; j++) mean[j] += r[j];
  for (let j = 0; j < d; j++) mean[j] /= n;
  const C = X.map((r) => r.map((v, j) => v - mean[j]));
  let totVar = 0; for (const r of C) for (const v of r) totVar += v * v; totVar /= n;
  const covMul = (v: number[]) => {
    const Cv = C.map((r) => { let s = 0; for (let j = 0; j < d; j++) s += r[j] * v[j]; return s; });
    const out = new Array(d).fill(0);
    for (let i = 0; i < n; i++) { const cv = Cv[i], ci = C[i]; for (let j = 0; j < d; j++) out[j] += ci[j] * cv; }
    for (let j = 0; j < d; j++) out[j] /= n;
    return out;
  };
  const norm = (a: number[]) => { let s = 0; for (const x of a) s += x * x; s = Math.sqrt(s) || 1; return a.map((x) => x / s); };
  const orthog = (a: number[], orth: number[][]) => { for (const u of orth) { let dp = 0; for (let j = 0; j < d; j++) dp += a[j] * u[j]; for (let j = 0; j < d; j++) a[j] -= dp * u[j]; } return a; };
  const topPC = (orth: number[][]) => {
    let v = norm(orthog(Array.from({ length: d }, (_, j) => Math.sin(j * 2.399 + 1)), orth));
    let lam = 0;
    for (let it = 0; it < 120; it++) { const w = orthog(covMul(v), orth); lam = Math.sqrt(w.reduce((a, b) => a + b * b, 0)); v = norm(w); }
    return { v, lam };
  };
  const p1 = topPC([]); const p2 = topPC([p1.v]);
  const pts = C.map((r) => {
    let a = 0, b = 0; for (let j = 0; j < d; j++) { a += r[j] * p1.v[j]; b += r[j] * p2.v[j]; } return [a, b] as [number, number];
  });
  return { pts, varExpl: [totVar ? p1.lam / totVar : 0, totVar ? p2.lam / totVar : 0] };
}
