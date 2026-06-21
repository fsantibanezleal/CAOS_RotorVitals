export interface Zone { upTo: number; color: string; label: string }

/** Horizontal severity gauge with colored zones + a needle. Used for an overall vibration-severity
 * index (zone scheme à la ISO 20816 A/B/C/D; the exact velocity thresholds are documented in
 * Methodology — here it is an illustrative severity index, not a certified ISO velocity reading). */
export function Gauge({ value, max, zones, unit, title }: { value: number; max: number; zones: Zone[]; unit?: string; title?: string }) {
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  let prev = 0;
  return (
    <div className="gauge">
      {title && <div className="gauge-title">{title}</div>}
      <div className="gauge-track">
        {zones.map((z, i) => {
          const left = pct(prev); const width = `${Math.max(0, Math.min(100, ((z.upTo - prev) / max) * 100))}%`;
          prev = z.upTo;
          return <div key={i} className="gauge-zone" style={{ left, width, background: z.color }} title={z.label} />;
        })}
        <div className="gauge-needle" style={{ left: pct(value) }} />
      </div>
      <div className="gauge-scale">
        <span>0</span>
        <span className="gauge-val">{value.toFixed(2)}{unit ? ` ${unit}` : ''}</span>
        <span>{max}</span>
      </div>
      <div className="gauge-zones-legend">
        {zones.map((z, i) => <span key={i}><span className="dot" style={{ background: z.color }} />{z.label}</span>)}
      </div>
    </div>
  );
}
