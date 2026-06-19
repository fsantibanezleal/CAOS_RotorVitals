import { useMemo, useState } from 'react';
import { gramGrid, type GramMetric } from '../dsp/infogram';
import { BandGram } from './BandGram';

const METRIC_LABEL: Record<GramMetric, { en: string; es: string }> = {
  kurt: { en: 'Kurtosis (kurtogram)', es: 'Kurtosis (kurtograma)' },
  iE: { en: 'SE negentropy', es: 'Negentropía SE' },
  iSES: { en: 'SES negentropy (infogram)', es: 'Negentropía SES (infograma)' },
  iAVE: { en: 'Average infogram', es: 'Infograma promedio' },
};

/** Band-selector comparison tab: the same dyadic grid scored by kurtosis (the kurtogram) vs the
 * infogram negentropies (SE / SES / average). Toggle the metric; inject a non-repetitive spike to see
 * the kurtogram's best cell jump to the spike band while the SES-infogram holds the fault resonance.
 * Click a cell to set the demodulation band → live SES. Computed only while the tab is mounted. */
export function GramPanel({ x, fs, onPick, lang }: {
  x: Float64Array; fs: number; onPick?: (band: [number, number]) => void; lang: 'en' | 'es';
}) {
  const es = lang === 'es';
  const [metric, setMetric] = useState<GramMetric>('iSES');
  const [spike, setSpike] = useState(false);

  const xUsed = useMemo(() => {
    if (!spike) return x;
    const y = Float64Array.from(x);
    let p = 0; for (let i = 0; i < y.length; i++) p += y[i] * y[i]; const rms = Math.sqrt(p / y.length) || 1;
    for (const fp of [0.13, 0.37, 0.61, 0.84]) y[Math.floor(fp * y.length)] += 8 * rms; // 4 non-repetitive Diracs
    return y;
  }, [x, spike]);
  const grid = useMemo(() => gramGrid(xUsed, fs, 5), [xUsed, fs]);

  const metrics: GramMetric[] = ['kurt', 'iE', 'iSES', 'iAVE'];
  const title = es ? 'Selección de banda — kurtograma vs infograma (negentropía)' : 'Band selection — kurtogram vs infogram (negentropy)';
  const note = es
    ? 'El kurtograma puntúa cada banda por la kurtosis de la envolvente; el infograma (Antoni 2016) la puntúa por la negentropía de la envolvente al cuadrado (SE) y de su espectro (SES) — sensible a transitorios REPETITIVOS, no a un impulso aislado. Activa "inyectar spike" (impulsos no repetitivos): la mejor celda del kurtograma salta a la banda del spike, mientras la negentropía SES mantiene la banda de resonancia de la falla. Clic en una celda fija la banda de demodulación → SES en vivo. (Datos sintéticos.)'
    : 'The kurtogram scores each band by envelope kurtosis; the infogram (Antoni 2016) scores it by the negentropy of the squared envelope (SE) and of its spectrum (SES) — sensitive to REPETITIVE transients, not to a single impulse. Toggle "inject spike" (non-repetitive impulses): the kurtogram\'s best cell jumps to the spike band while the SES negentropy holds the fault resonance band. Click a cell to set the demodulation band → live SES. (Synthetic data.)';

  return (
    <div className="rv-vizstack">
      <div className="rv-plot">
        <div className="rv-plot-t rv-plot-th">
          <span>{title}</span>
          <span className="rv-seg">
            {metrics.map((m) => <button key={m} className={`chip ${metric === m ? 'on' : ''}`} onClick={() => setMetric(m)}>{METRIC_LABEL[m][es ? 'es' : 'en'].split(' ')[0]}</button>)}
            <button className={`chip ${spike ? 'on' : ''}`} onClick={() => setSpike((v) => !v)}>{es ? 'spike' : 'spike'}</button>
          </span>
        </div>
        <p className="hint" style={{ margin: '0 0 0.3rem' }}>{METRIC_LABEL[metric][es ? 'es' : 'en']}{spike ? (es ? ' · spike inyectado' : ' · spike injected') : ''}</p>
        <BandGram cells={grid.cells} metric={metric} best={grid.best[metric]} fs={fs} onPick={onPick} unit={metric === 'kurt' ? '' : 'nat'} height={240} />
      </div>
      <p className="hint">{note}</p>
    </div>
  );
}
