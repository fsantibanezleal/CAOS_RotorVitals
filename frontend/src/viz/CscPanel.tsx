import { useMemo, useState } from 'react';
import { fastSpectralCoherence } from '../dsp/csc';
import { type DefectFreqs } from '../dsp/bearing';
import { Heatmap2D, type VLine } from './Heatmap2D';
import { EesStrip } from './EesStrip';

const C = { outer: '#f59f00', inner: '#f06595', ball: '#7c5cff', ftf: '#3fb1c8' };

/** Fast Spectral Correlation (Fast-SC, T9) bi-frequency map + EES marginal with the exact Carter-Knapp-Nuttall
 * significance mask. The phase-retaining cyclic spectral coherence |γ|∈[0,1] (AR-prewhitened to reject deterministic
 * lines), replacing the magnitude-only CMS. Computed only while mounted. */
export function CscPanel({ x, fs, f, lang }: { x: Float64Array; fs: number; f: DefectFreqs; lang: 'en' | 'es' }) {
  const es = lang === 'es';
  const [mask, setMask] = useState(true);   // default ON, now a real statistical test, not a heuristic
  const csc = useMemo(() => fastSpectralCoherence(x, fs, 256, 16, 380, 0.05), [x, fs]);

  const vlines: VLine[] = [
    { x: f.bpfo, color: C.outer, label: 'BPFO' }, { x: f.bpfi, color: C.inner, label: 'BPFI' },
    { x: 2 * f.bsf, color: C.ball, label: '2·BSF' }, { x: f.ftf, color: C.ftf, label: 'FTF' },
  ];

  const title = es
    ? 'Correlación espectral rápida (Fast-SC), crestas α verticales en las frecuencias de falla'
    : 'Fast Spectral Correlation (Fast-SC), vertical α-ridges at the fault frequencies';
  const note = es
    ? `Portadora f × frecuencia cíclica α. Fast-SC (Antoni–Xin–Hamzaoui 2017): tras un prewhitening AR que remueve las líneas deterministas (eje/engrane), se promedia sobre tramas el producto cruzado COMPLEJO de la STFT S(i,f₊)·S*(i,f₋), conservando la fase entre portadoras que el CMS descarta, y se normaliza a la coherencia espectral cíclica |γ|∈[0,1]. Una falla real es una cresta α vertical en BPFO/BPFI/2·BSF que abarca muchas portadoras. La máscara es el umbral EXACTO de Carter–Knapp–Nuttall |γ|²>1−p^{1/(K_eff−1)} (p=0.05), una prueba estadística real, no la heurística mediana+3·MAD anterior. K_eff=${csc.Keff.toFixed(0)}, |γ|²_thr=${csc.gamma2Thr.toFixed(3)} (|γ|_thr=${csc.gammaThr.toFixed(2)}). α resuelta finamente (Δα≈${(csc.alpha[1] || 0).toFixed(2)} Hz) hasta ≈${csc.alphaMaxHz.toFixed(0)} Hz. La marginal EES (abajo) promedia |γ| sobre portadoras (su piso de significancia es ≈${csc.eesFloor.toFixed(2)}, mucho menor que el umbral por píxel) → picos en las frecuencias de falla; el SES clásico es su caso restringido en banda.`
    : `Carrier f × cyclic frequency α. Fast Spectral Correlation (Antoni–Xin–Hamzaoui 2017): after an AR prewhitening that removes the deterministic shaft/gear lines, the COMPLEX STFT cross-spectrum S(i,f₊)·S*(i,f₋) is averaged over frames, retaining the cross-carrier phase the CMS discards, then normalized to the cyclic spectral coherence |γ|∈[0,1]. A real fault is a vertical α-ridge at BPFO/BPFI/2·BSF spanning many carriers. The mask is the EXACT Carter–Knapp–Nuttall threshold |γ|²>1−p^{1/(K_eff−1)} (p=0.05), a true statistical test, not the earlier median+3·MAD heuristic. K_eff=${csc.Keff.toFixed(0)}, |γ|²_thr=${csc.gamma2Thr.toFixed(3)} (|γ|_thr=${csc.gammaThr.toFixed(2)}). α finely resolved (Δα≈${(csc.alpha[1] || 0).toFixed(2)} Hz) up to ≈${csc.alphaMaxHz.toFixed(0)} Hz. The EES marginal (below) averages |γ| over carriers (its significance floor ≈${csc.eesFloor.toFixed(2)} is far below the per-pixel threshold) → peaks at the fault frequencies; the classical SES is its band-restricted case.`;

  return (
    <div className="rv-vizstack">
      <div className="rv-plot">
        <div className="rv-plot-t rv-plot-th">
          <span>{title}</span>
          <span className="rv-seg"><button className={`chip ${mask ? 'on' : ''}`} onClick={() => setMask((v) => !v)}>{es ? 'máscara signif.' : 'significance mask'}</button></span>
        </div>
        <Heatmap2D cols={csc.cols} times={csc.alpha} freqs={csc.carriers} fmax={6000}
          norm="lin" unit="|γ|" xunit="Hz" xlabel="α (Hz)" ylabel="carrier (Hz)"
          vlines={vlines} maskBelow={mask ? csc.gammaThr : null} height={236} />
        <EesStrip alpha={csc.alpha} ees={csc.ees} vlines={vlines} floor={mask ? csc.eesFloor : null} height={92} />
      </div>
      <p className="hint">{note}</p>
    </div>
  );
}
