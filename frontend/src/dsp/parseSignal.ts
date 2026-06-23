// T6 — parse a user-supplied vibration signal (bring-your-own-data) into a numeric array. Accepts the universal
// text formats: one number per line, CSV, or whitespace/semicolon-separated. Per row it takes the LAST numeric
// token, which transparently handles a single acceleration column AND a `time,accel` (or `index,accel`) pair —
// the accel is conventionally the last column. Non-numeric header rows are skipped. Pure + testable; no .mat
// binary parsing (fragile in-browser — the UI tells the user to export .mat to CSV first).

export interface ParsedSignal {
  ok: boolean;
  x?: Float64Array;
  n?: number;
  skipped?: number;   // non-numeric rows skipped (headers etc.)
  reason?: string;
}

const MIN_SAMPLES = 2048;   // one WDCNN window / enough for a stable kurtogram + envelope spectrum

export function parseSignal(text: string): ParsedSignal {
  if (!text || !text.trim()) return { ok: false, reason: 'empty input' };
  const rows = text.replace(/\r/g, '').split('\n');
  const vals: number[] = [];
  let skipped = 0;
  for (const row of rows) {
    const t = row.trim();
    if (!t) continue;
    const tokens = t.split(/[\s,;]+/).filter(Boolean);
    // take the LAST finite numeric token on the row (the acceleration column in time,accel layouts)
    let v = NaN;
    for (let i = tokens.length - 1; i >= 0; i--) {
      const p = Number(tokens[i]);
      if (Number.isFinite(p)) { v = p; break; }
    }
    if (Number.isFinite(v)) vals.push(v);
    else skipped++;
  }
  if (vals.length < MIN_SAMPLES) {
    return { ok: false, reason: `need ≥ ${MIN_SAMPLES} numeric samples, got ${vals.length}`, skipped };
  }
  // reject a flatline / constant (no diagnostic content)
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  let varSum = 0;
  for (const v of vals) varSum += (v - mean) ** 2;
  if (Math.sqrt(varSum / vals.length) < 1e-9) {
    return { ok: false, reason: 'signal is flat (zero variance) — no diagnostic content', skipped };
  }
  return { ok: true, x: Float64Array.from(vals), n: vals.length, skipped };
}
