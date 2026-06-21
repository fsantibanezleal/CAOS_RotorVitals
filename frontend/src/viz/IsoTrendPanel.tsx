import { useCallback, useMemo } from 'react';
import type uPlot from 'uplot';
import { lifeFeatures, ISO_CLASS_I } from '../dsp/iso';
import { type FaultKind, type Bearing } from '../dsp/bearing';
import { UPlotChart } from './UPlotChart';
import { lineOpts, hbandsPlugin, hlinesPlugin } from './uplotKit';

/** ISO broadband velocity-RMS severity trend over the run-to-failure life, with ISO 10816-1 Class I
 * zone bands (A/B/C/D) and the ALERT (B/C) / DANGER (C/D) setpoint lines. Computed only while mounted.
 * Honestly: broadband velocity is a coarse screen that can MISS a bearing fault whose energy sits at
 * the high-frequency resonance outside the 10–1000 Hz band — which is why envelope/SES + the HI exist. */
export function IsoTrendPanel({ bearing, fault, severity, snr, rpm, lifeH, lang }: {
  bearing: Bearing; fault: FaultKind; severity: number; snr: number; rpm: number; lifeH: number; lang: 'en' | 'es';
}) {
  const es = lang === 'es';
  const feats = useMemo(() => lifeFeatures({ bearing, fault, severityEnd: severity, rpm, snrDb: snr, lifeH }), [bearing, fault, severity, rpm, snr, lifeH]);
  const data = useMemo<uPlot.AlignedData>(() => [feats.map((f) => f.t), feats.map((f) => f.vrms)], [feats]);
  const vmax = useMemo(() => Math.max(ISO_CLASS_I.cd * 1.08, ...feats.map((f) => f.vrms)) * 1.05, [feats]);

  const build = useCallback((w: number, h: number) => lineOpts(w, h, { label: 'v_rms', color: '#58a6ff', xUnit: 'h', yUnit: 'mm/s', yPrec: 2, yRange: [0, vmax] }), [vmax]);
  const plugins = useMemo(() => [
    hbandsPlugin([
      { to: ISO_CLASS_I.ab, color: '#3fb950', label: 'A' },
      { to: ISO_CLASS_I.bc, color: '#58a6ff', label: 'B' },
      { to: ISO_CLASS_I.cd, color: '#d29922', label: 'C' },
      { to: 1e9, color: '#f85149', label: 'D' },
    ]),
    hlinesPlugin([
      { y: ISO_CLASS_I.bc, color: '#d29922', label: es ? 'ALERTA (B/C) 1.8' : 'ALERT (B/C) 1.8' },
      { y: ISO_CLASS_I.cd, color: '#f85149', label: es ? 'PELIGRO (C/D) 4.5' : 'DANGER (C/D) 4.5' },
    ]),
  ], [es]);

  const title = es ? 'Tendencia de severidad ISO — velocidad RMS (Clase I, run-to-failure sintético)' : 'ISO velocity-RMS severity trend (Class I, synthetic run-to-failure)';
  const note = es
    ? 'Zonas ISO 10816-1 / 2372 Clase I (máquinas ≤ 15 kW) — la escala correcta para el pequeño banco de calibración CWRU; las máquinas mineras ≥ 15 kW usan ISO 20816-3 (Grupo 2: 1.4/2.8/4.5). Calibración ilustrativa: las unidades de aceleración sintéticas son arbitrarias, así que el baseline as-new se mapea a Zona A — importa la FORMA de la tendencia y el cruce de zonas, no la magnitud absoluta. Importante y honesto: la velocidad RMS de banda ancha 10–1000 Hz está dominada por la línea de eje y es un tamizado grueso que casi NO ve una falla de rodamiento en desarrollo, porque su energía se concentra en la resonancia de alta frecuencia FUERA de esta banda — por eso existen el análisis de envolvente/SES y el indicador de salud (HI). Referencia de tamizado, no un setpoint de alarma.'
    : 'ISO 10816-1 / 2372 Class I zones (machines ≤ 15 kW) — the right scale for the small CWRU-class calibration rig; ≥ 15 kW mining machines use ISO 20816-3 (Group 2: 1.4/2.8/4.5). Illustrative calibration: the synthetic acceleration units are arbitrary, so the as-new baseline is mapped to Zone A — the trend SHAPE and zone crossing is the point, not the absolute magnitude. Important and honest: broadband 10–1000 Hz velocity RMS is dominated by the shaft line and is a coarse screen that barely sees a developing bearing fault, because the fault energy concentrates at the high-frequency resonance OUTSIDE this band — which is exactly why envelope/SES and the health indicator exist. A screening reference, not an alarm setpoint.';

  return (
    <div className="rv-vizstack">
      <div className="rv-plot"><div className="rv-plot-t">{title}</div><UPlotChart data={data} build={build} plugins={plugins} height={240} /></div>
      <p className="hint">{note}</p>
    </div>
  );
}
