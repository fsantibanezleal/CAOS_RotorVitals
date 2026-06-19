import { Tabs, Equation, InlineMath, Refs, useShellLang } from '@fasl-work/caos-app-shell';

export default function Methodology() {
  const es = useShellLang() === 'es';
  const refsLabel = es ? 'Refs' : 'Refs';

  const tabs = [
    {
      id: 'env', label: es ? 'Envolvente / SES' : 'Envelope / SES',
      content: (
        <div className="prose">
          <p>{es
            ? 'Un defecto localizado produce impactos repetitivos que excitan una resonancia estructural de alta frecuencia. La envolvente (señal analítica vía Hilbert) demodula esa resonancia; el espectro de la envolvente al cuadrado (SES) revela la frecuencia de falla y sus armónicos. El SES es el estándar moderno: vincula con la coherencia espectral cíclica y suprime el pedestal de ruido.'
            : 'A localized defect produces repetitive impacts that excite a high-frequency structural resonance. The envelope (analytic signal via Hilbert) demodulates that resonance; the squared-envelope spectrum (SES) reveals the fault frequency and its harmonics. SES is the modern standard: it links to cyclic spectral coherence and suppresses the noise pedestal.'}</p>
          <Equation tex={String.raw`\mathrm{BPFO}=\tfrac{n}{2}f_r\!\left(1-\tfrac{d}{D}\cos\varphi\right),\quad \mathrm{BPFI}=\tfrac{n}{2}f_r\!\left(1+\tfrac{d}{D}\cos\varphi\right)`} />
          <Equation tex={String.raw`z(t)=x_b(t)+i\,\mathcal{H}\{x_b\}(t),\qquad \mathrm{SES}(f)=\big|\mathcal{F}\{|z(t)|^2\}\big|`} />
          <Refs ids={['randall2011', 'smith2015', 'borghesani2013']} label={refsLabel} />
        </div>),
    },
    {
      id: 'sk', label: es ? 'Kurtosis espectral / Kurtograma' : 'Spectral kurtosis / Kurtogram',
      content: (
        <div className="prose">
          <p>{es
            ? 'El problema más difícil del análisis de envolvente es DÓNDE filtrar. La kurtosis espectral mide la impulsividad por banda de frecuencia; el kurtograma la mapea sobre el plano (frecuencia, ancho de banda) y el kurtograma rápido encuentra la banda óptima en ~N log N. Esa banda alimenta el SES.'
            : 'Envelope analysis’s hardest problem is WHERE to filter. Spectral kurtosis measures impulsiveness per frequency band; the kurtogram maps it over the (frequency, bandwidth) plane and the fast kurtogram finds the optimal band in ~N log N. That band feeds the SES.'}</p>
          <Equation tex={String.raw`\mathrm{Kurt}(x)=\frac{\mathbb{E}[(x-\mu)^4]}{(\mathbb{E}[(x-\mu)^2])^2}-3`} caption={es ? 'kurtosis (exceso); 0 para ruido gaussiano' : 'excess kurtosis; 0 for Gaussian noise'} />
          <p>{es ? 'Limitación: la kurtosis responde a cualquier impulso (incluido ruido no gaussiano), motivando protrugram / autogram / infogram, sensibles a la periodicidad.' : 'Caveat: kurtosis responds to any impulse (including non-Gaussian noise), motivating the protrugram / autogram / infogram, which are sensitive to periodicity.'}</p>
          <Refs ids={['antoni2006sk', 'antoni2007']} label={refsLabel} />
        </div>),
    },
    {
      id: 'cs', label: es ? 'Cyclostationary' : 'Cyclostationary',
      content: (
        <div className="prose">
          <p>{es
            ? 'Los impactos de rodamiento son cuasi-cíclicos, no puramente periódicos: la señal es cicloestacionaria de 2º orden. La correlación espectral y la coherencia espectral cíclica explotan esto y son robustas a ruido y a contenido determinista; el envelope spectrum mejorado (EES) integra la coherencia cíclica sobre la frecuencia portadora.'
            : 'Bearing impacts are quasi-cyclic, not purely periodic: the signal is 2nd-order cyclostationary. Spectral correlation and cyclic spectral coherence exploit this and are robust to noise and deterministic content; the enhanced envelope spectrum (EES) integrates cyclic coherence over carrier frequency.'}</p>
          <Equation tex={String.raw`\gamma(\alpha)=\frac{\displaystyle\int |S_x(\alpha,f)|\,df}{\displaystyle\int S_x(0,f)\,df}\quad\text{(cyclic spectral coherence vs cyclic freq }\alpha\text{)}`} />
          <Refs ids={['randall2011', 'antoni2006sk']} label={refsLabel} />
        </div>),
    },
    {
      id: 'decomp', label: es ? 'Descomposición / Deconvolución' : 'Decomposition / Deconvolution',
      content: (
        <div className="prose">
          <p>{es
            ? 'Cuando la resonancia es débil o hay múltiples fuentes: descomposición adaptativa (EMD/EEMD/CEEMDAN, VMD, wavelet packet, SSA) aísla el componente de falla; la deconvolución ciega (MED, MCKD, MOMEDA, CYCBD) realza los impulsos repetitivos. Se eligen guiados por kurtosis/cicloestacionariedad.'
            : 'When the resonance is weak or sources overlap: adaptive decomposition (EMD/EEMD/CEEMDAN, VMD, wavelet packet, SSA) isolates the fault component; blind deconvolution (MED, MCKD, MOMEDA, CYCBD) enhances the repetitive impulses. Selection is guided by kurtosis/cyclostationarity.'}</p>
          <p>{es ? 'VMD descompone en modos de banda limitada minimizando el ancho de banda total; MCKD maximiza la kurtosis correlacionada al periodo de falla.' : 'VMD decomposes into band-limited modes by minimizing total bandwidth; MCKD maximizes the correlated kurtosis at the fault period.'}</p>
          <Refs ids={['randall2011']} label={refsLabel} />
        </div>),
    },
    {
      id: 'ml', label: es ? 'ML / Deep Learning' : 'ML / Deep Learning',
      content: (
        <div className="prose">
          <p>{es
            ? 'Sobre features (RMS, kurtosis, factores de cresta/impulso, entropía) clasificadores clásicos (SVM/RF/XGBoost); o deep learning de extremo a extremo: 1D-CNN (WDCNN), 2D-CNN sobre escalogramas/espectrogramas, LSTM, y adaptación de dominio para generalizar entre cargas/máquinas. Entrenamiento offline; inferencia en navegador vía onnxruntime-web.'
            : 'Over features (RMS, kurtosis, crest/impulse factors, entropy) classical classifiers (SVM/RF/XGBoost); or end-to-end deep learning: 1D-CNN (WDCNN), 2D-CNN on scalograms/spectrograms, LSTM, and domain adaptation to generalize across loads/machines. Training is offline; in-browser inference via onnxruntime-web.'}</p>
          <p className="muted small">{es ? 'Honestidad: se reporta la partición (sin fuga CWRU) y la prueba cruzada de carga; la exactitud sin esas salvaguardas es engañosa.' : 'Honesty: report the split (no CWRU leakage) and cross-load test; accuracy without those safeguards is misleading.'}</p>
          <Refs ids={['smith2015']} label={refsLabel} />
        </div>),
    },
    {
      id: 'rul', label: es ? 'Prognóstico / RUL + ISO' : 'Prognostics / RUL + ISO',
      content: (
        <div className="prose">
          <p>{es
            ? 'Se construye un indicador de salud (HI: RMS, kurtosis, tendencia de SK), se detecta el onset de degradación, se ajusta un modelo (exponencial / Paris / filtro de partículas / GP / deep-RUL) y se proyecta al umbral de falla con banda de incertidumbre — el tiempo a cambio. La decisión usa las zonas de severidad ISO 20816 (A/B/C/D) y recomendaciones en puntos críticos.'
            : 'Build a health indicator (HI: RMS, kurtosis, SK trend), detect degradation onset, fit a model (exponential / Paris / particle filter / GP / deep-RUL) and project to the failure threshold with an uncertainty band — the time-to-change. The decision uses ISO 20816 severity zones (A/B/C/D) and recommendations at critical points.'}</p>
          <Equation tex={String.raw`\mathrm{HI}(t)=a\,e^{b t}\;\Rightarrow\; t_{\text{fail}}=\frac{\ln(\mathrm{HI}_{\text{thr}})-\ln a}{b},\qquad \mathrm{RUL}=t_{\text{fail}}-t_{\text{now}}`} />
          <Refs ids={['lei2018', 'iso20816']} label={refsLabel} />
        </div>),
    },
  ];

  return (
    <div className="page-body">
      <div className="page-head prose">
        <h1>{es ? 'Metodología' : 'Methodology'}</h1>
        <p className="lede">{es ? 'El paisaje de métodos de diagnóstico y prognóstico, de lo clásico a lo SOTA. Ecuaciones reales y referencias con DOI.' : 'The diagnosis & prognostics method landscape, classical to SOTA. Real equations and DOI references.'} <InlineMath tex={String.raw`f_r=\mathrm{rpm}/60`} /></p>
      </div>
      <Tabs tabs={tabs} ariaLabel="methodology" />
    </div>
  );
}
