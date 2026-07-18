import { useMemo, useState } from 'react';
import { gramGrid, type GramMetric } from '../dsp/infogram';
import { type DefectFreqs } from '../dsp/bearing';
import { BandGram } from './BandGram';

const METRIC_LABEL: Record<GramMetric, { en: string; es: string }> = {
  kurt: { en: 'Kurtosis (kurtogram)', es: 'Kurtosis (kurtograma)' },
  iE: { en: 'SE negentropy', es: 'Negentropía SE' },
  iSES: { en: 'SES negentropy (infogram)', es: 'Negentropía SES (infograma)' },
  iAVE: { en: 'Average infogram', es: 'Infograma promedio' },
  iesfo: { en: 'IESFOgram (targeted)', es: 'IESFOgrama (dirigido)' },
  iesfoBlind: { en: 'IESFOgram (blind)', es: 'IESFOgrama (ciego)' },
};
const SHORT: Record<GramMetric, string> = { kurt: 'Kurt', iE: 'SE', iSES: 'SES', iAVE: 'Avg', iesfo: 'IESFO', iesfoBlind: 'IESFO·b' };

/** Band-selector comparison tab: the same dyadic grid scored by kurtosis (the kurtogram), the infogram
 * negentropies (SE / SES / average), and the IESFOgram (T10, Mauricio 2020) targeted at the diagnosed fault comb.
 * Toggle the metric; inject a non-repetitive spike to see the kurtogram's best cell jump to the spike band while
 * the SES-infogram nudges and the targeted IESFOgram holds the fault band exactly. Click a cell to set the
 * demodulation band → live SES. Computed only while the tab is mounted. */
export function GramPanel({ x, fs, onPick, lang, f, fr, faultAlpha }: {
  x: Float64Array; fs: number; onPick?: (band: [number, number]) => void; lang: 'en' | 'es';
  f?: DefectFreqs; fr?: number; faultAlpha?: number;
}) {
  const es = lang === 'es';
  const [metric, setMetric] = useState<GramMetric>('iesfo');
  const [spike, setSpike] = useState(false);

  // α₀ for the targeted IESFOgram: the diagnosed fault comb (passed from Tool), else BPFO.
  const alpha0 = faultAlpha ?? f?.bpfo ?? 0;

  const xUsed = useMemo(() => {
    if (!spike) return x;
    const y = Float64Array.from(x);
    let p = 0; for (let i = 0; i < y.length; i++) p += y[i] * y[i]; const rms = Math.sqrt(p / y.length) || 1;
    for (const fp of [0.13, 0.37, 0.61, 0.84]) y[Math.floor(fp * y.length)] += 8 * rms; // 4 non-repetitive Diracs
    return y;
  }, [x, spike]);
  const grid = useMemo(
    () => gramGrid(xUsed, fs, 5, alpha0 ? { targetAlpha: alpha0, fr, blind: true } : {}),
    [xUsed, fs, alpha0, fr]);

  const metrics: GramMetric[] = ['kurt', 'iE', 'iSES', 'iAVE', 'iesfo', 'iesfoBlind'];
  const unit = metric === 'kurt' ? '' : (metric === 'iesfo' || metric === 'iesfoBlind') ? '×' : 'nat';
  const title = es ? 'Selección de banda, kurtograma · infograma · IESFOgrama' : 'Band selection, kurtogram · infogram · IESFOgram';
  const note = es
    ? 'El kurtograma puntúa cada banda por la kurtosis de la envolvente; el infograma (Antoni 2016) por la negentropía de la envolvente al cuadrado (SE) y de su espectro (SES), sensible a transitorios REPETITIVOS. El IESFOgrama (Mauricio et al. 2020) puntúa cada banda no por impulsividad general sino por cuán fuerte muestra su SES el PEINE de armónicos de la frecuencia de falla diagnosticada (BPFO/BPFI/2·BSF), un cociente adimensional (× sobre la línea base local). Activa "spike" (impulsos no repetitivos): la mejor celda del kurtograma salta a la banda del spike, la del SES se mueve a lo sumo una celda, y la del IESFOgrama dirigido queda IGUAL. La variante ciega barre órdenes de eje (≥1.5×fr) y es más débil. Clic en una celda fija la banda → SES en vivo. (Datos sintéticos.)'
    : 'The kurtogram scores each band by envelope kurtosis; the infogram (Antoni 2016) by the negentropy of the squared envelope (SE) and of its spectrum (SES), sensitive to REPETITIVE transients. The IESFOgram (Mauricio et al. 2020) scores each band not by general impulsiveness but by how strongly its SES shows the harmonic COMB of the DIAGNOSED fault frequency (BPFO/BPFI/2·BSF), a dimensionless ratio (× over the local baseline). Toggle "spike" (non-repetitive impulses): the kurtogram\'s best cell jumps to the spike band, the SES one shifts at most one cell, and the targeted IESFOgram\'s stays identical. The blind variant sweeps shaft orders (≥1.5×fr) and is weaker. Click a cell to set the band → live SES. (Synthetic data.)';

  const readout = (metric === 'iesfo' && alpha0)
    ? (es ? `dirigido a α₀ = ${alpha0.toFixed(1)} Hz · spike: mejor banda sin cambios` : `targeted at α₀ = ${alpha0.toFixed(1)} Hz · spike: best band unchanged`)
    : (metric === 'iesfoBlind' && grid.best.iesfoBlind?.iesfoBlindAlpha)
      ? (es ? `ciego: α₀* = ${grid.best.iesfoBlind.iesfoBlindAlpha.toFixed(1)} Hz` : `blind: α₀* = ${grid.best.iesfoBlind.iesfoBlindAlpha.toFixed(1)} Hz`)
      : '';

  return (
    <div className="rv-vizstack">
      <div className="rv-plot">
        <div className="rv-plot-t rv-plot-th">
          <span>{title}</span>
          <span className="rv-seg">
            {metrics.map((m) => <button key={m} className={`chip ${metric === m ? 'on' : ''}`} onClick={() => setMetric(m)}>{SHORT[m]}</button>)}
            <button className={`chip ${spike ? 'on' : ''}`} onClick={() => setSpike((v) => !v)}>{es ? 'spike' : 'spike'}</button>
          </span>
        </div>
        <p className="hint" style={{ margin: '0 0 0.3rem' }}>{METRIC_LABEL[metric][es ? 'es' : 'en']}{readout ? ` · ${readout}` : ''}{spike ? (es ? ' · spike inyectado' : ' · spike injected') : ''}</p>
        <BandGram cells={grid.cells} metric={metric} best={grid.best[metric]} fs={fs} onPick={onPick} unit={unit} height={240} />
      </div>
      <p className="hint">{note}</p>
    </div>
  );
}
