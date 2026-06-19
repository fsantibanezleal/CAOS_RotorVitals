import { useMemo, useState } from 'react';
import { cyclicModulationSpectrum } from '../dsp/csc';
import { type DefectFreqs } from '../dsp/bearing';
import { Heatmap2D, type VLine } from './Heatmap2D';

const C = { outer: '#f59f00', inner: '#f06595', ball: '#7c5cff', ftf: '#3fb1c8' };

/** Cyclostationary (cyclic-modulation-spectrum) bi-frequency map with an optional statistical
 * significance mask. Computed only while mounted. The mask suppresses coherence below a robust
 * noise floor (median + 3·MAD) so only real fault α-ridges remain — an approximate significance test
 * (not the full Fast-SC distribution). */
export function CscPanel({ x, fs, f, lang }: { x: Float64Array; fs: number; f: DefectFreqs; lang: 'en' | 'es' }) {
  const es = lang === 'es';
  const [mask, setMask] = useState(false);
  const csc = useMemo(() => cyclicModulationSpectrum(x, fs, 128, 8, 800), [x, fs]);

  const vlines: VLine[] = [
    { x: f.bpfo, color: C.outer, label: 'BPFO' }, { x: f.bpfi, color: C.inner, label: 'BPFI' },
    { x: 2 * f.bsf, color: C.ball, label: '2·BSF' }, { x: f.ftf, color: C.ftf, label: 'FTF' },
  ];

  // robust noise floor: median + 3·1.4826·MAD over the coherence map (sampled for speed)
  const floor = useMemo(() => {
    const vals: number[] = [];
    for (const col of csc.cols) for (let i = 0; i < col.length; i += 3) vals.push(col[i]);
    vals.sort((a, b) => a - b);
    const med = vals[Math.floor(vals.length / 2)] || 0;
    const dev = vals.map((v) => Math.abs(v - med)).sort((a, b) => a - b);
    const madv = dev[Math.floor(dev.length / 2)] || 1e-9;
    return med + 3 * 1.4826 * madv;
  }, [csc]);

  const title = es ? 'Coherencia espectral cíclica (CMS) — crestas α verticales en las frecuencias de falla' : 'Cyclic spectral coherence (CMS) — vertical α-ridges at the fault frequencies';
  const note = es
    ? 'Portadora f × frecuencia cíclica α. Una falla real es cicloestacionaria: forma una familia de crestas α verticales en BPFO/BPFI/2·BSF (independiente de la portadora), separándola de picos casuales. Estimador CMS rápido (no Fast-SC completo). La máscara de significancia suprime la coherencia bajo un piso de ruido robusto (mediana + 3·MAD), dejando solo las crestas reales — una prueba de significancia aproximada (no la distribución exacta de Fast-SC).'
    : 'Carrier f × cyclic frequency α. A real bearing fault is cyclostationary: it forms a vertical α-ridge family at BPFO/BPFI/2·BSF (independent of carrier), separating it from coincidental peaks. Fast CMS estimator (not full Fast-SC). The significance mask suppresses coherence below a robust noise floor (median + 3·MAD), leaving only the real ridges — an approximate significance test (not the exact Fast-SC distribution).';

  return (
    <div className="rv-vizstack">
      <div className="rv-plot">
        <div className="rv-plot-t rv-plot-th">
          <span>{title}</span>
          <span className="rv-seg"><button className={`chip ${mask ? 'on' : ''}`} onClick={() => setMask((v) => !v)}>{es ? 'máscara signif.' : 'significance mask'}</button></span>
        </div>
        <Heatmap2D cols={csc.cols} times={csc.alpha} freqs={csc.carriers} fmax={6000} norm="lin" unit="coh" xunit="Hz" xlabel="α (Hz)" ylabel="carrier (Hz)" vlines={vlines} maskBelow={mask ? floor : null} height={260} />
      </div>
      <p className="hint">{note}</p>
    </div>
  );
}
