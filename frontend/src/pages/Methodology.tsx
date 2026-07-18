import { Tabs, Callout, Cite, Equation, InlineMath, Refs, useShellLang } from '@fasl-work/caos-app-shell';

export default function Methodology() {
  const es = useShellLang() === 'es';
  const refsLabel = 'Refs';

  // ============================================================
  // ENVELOPE / SES
  // ============================================================
  const envTab = (
    <div className="prose">
      <p>{es
        ? 'Un defecto localizado de rodamiento , una picadura o descascarillado en una pista, o en un elemento rodante,  no es una fuente de tono. Cada vez que un elemento rodante cargado pasa sobre el borde del defecto produce un breve choque mecánico, un impulso de microsegundos. Ese impulso no es lo que mide directamente el acelerómetro; en su lugar excita el modo estructural de alta frecuencia más cercano de la carcasa y la máquina, una resonancia poco amortiguada. La señal medida es entonces un tren de ráfagas resonantes que decaen: una portadora rápida (la resonancia) cuya amplitud se enciende, una vez por impacto, a la lenta tasa de repetición del defecto. Esto es, por construcción, modulación en amplitud, y la información de falla vive en cuándo ocurren las ráfagas, no en la frecuencia portadora misma, que es propiedad de la estructura.'
        : 'A localized bearing defect, a spall or pit on a raceway, or on a rolling element, is not a tone source. Each time a loaded rolling element rolls over the defect edge it produces a brief mechanical shock, an impulse lasting microseconds. That impulse is not what the accelerometer measures directly; instead it rings the nearest high-frequency structural mode of the housing and machine, a lightly damped resonance. So the measured signal is a train of decaying resonance bursts: a fast carrier (the resonance) whose amplitude is switched on, once per impact, at the slow defect-repetition rate. This is, by construction, amplitude modulation, and the fault information lives in when the bursts happen, not in the carrier frequency itself, which is a property of the structure.'}{' '}<Cite id="randall2011" paren /></p>

      <p>{es
        ? 'Como la energía de falla se concentra alrededor de la resonancia y el resto del espectro lo dominan contenidos ajenos al rodamiento , desbalance del eje y sus armónicos a baja frecuencia, tonos de engrane, ruido de banda ancha,  primero aislamos la banda de resonancia [f₁, f₂]. Esta es la decisión de mayor consecuencia de toda la cadena: demodular la banda equivocada produce un espectro de envolvente plano y ambiguo, el modo de falla dominante del análisis de envolvente y la razón misma de existir del kurtograma. Este build aplica un pasa-banda de pared vertical implementado en el dominio FFT: transforma la señal, pone a cero todo bin cuya magnitud de frecuencia caiga fuera de [f₁, f₂] (tratando idénticamente los bins simétricos de frecuencia negativa vía |f|) e invierte la transformada. Una pared vertical es honesta sobre lo que hace , conserva exactamente la banda pedida,  a costa de oscilación en el dominio temporal; es el selector de banda correcto más simple, que es justo lo que quiere una herramienta didáctica explicable en navegador.'
        : 'Because the fault energy concentrates around the resonance and the rest of the spectrum is dominated by content unrelated to the bearing, shaft imbalance and its harmonics at low frequency, gear-mesh tones, broadband noise, we first isolate the resonance band [f₁, f₂]. This is the single most consequential decision in the whole pipeline: demodulating the wrong band yields a flat, ambiguous envelope spectrum, the dominant failure mode of envelope analysis and the very reason the kurtogram exists. This build applies a brick-wall band-pass implemented in the FFT domain: it transforms the signal, zeros every bin whose frequency magnitude falls outside [f₁, f₂] (treating the symmetric negative-frequency bins identically via |f|), and inverse-transforms. A brick-wall gate is honest about what it does, it keeps exactly the requested band, at the cost of time-domain ringing; it is the simplest correct band selector, which is exactly what an explainable in-browser teaching tool wants.'}{' '}<Cite id="antoni2006sk" paren /></p>

      <p>{es
        ? 'Una vez aislada la banda, hay que recuperar su envolvente: la amplitud lentamente variable que lleva los impactos. La herramienta rigurosa es la señal analítica. Para una señal pasa-banda real x_bp(t), la señal analítica z(t) = x_bp(t) + j·H{x_bp}(t) agrega como parte imaginaria la transformada de Hilbert (un desfase de 90° de cada componente). La magnitud |z(t)| es entonces la amplitud instantánea: exactamente la envolvente de la portadora, con la oscilación portadora ya removida. Este build no convoluciona con un núcleo de Hilbert; forma la señal analítica en el dominio de la frecuencia, lo que es exacto y barato: toma la FFT, deja DC y Nyquist sin cambio, duplica el semiespectro de frecuencias positivas y pone a cero las negativas, luego invierte. Anular las negativas reduce a la mitad la energía y duplicar las positivas la restaura, de modo que la parte real de z reproduce x_bp exactamente. Es la ruta FFT estándar a la transformada de Hilbert discreta.'
        : 'Having isolated the band, we must recover its envelope: the slowly varying amplitude that carries the impacts. The rigorous tool is the analytic signal. For a real band-pass signal x_bp(t), the analytic signal z(t) = x_bp(t) + j·H{x_bp}(t) appends, as imaginary part, the Hilbert transform (a 90° phase shift of every component). The magnitude |z(t)| is then the instantaneous amplitude: exactly the envelope of the carrier, with the carrier oscillation removed. This build does not convolve with a Hilbert kernel; it forms the analytic signal in the frequency domain, which is both exact and cheap: take the FFT, keep DC and Nyquist unchanged, double the positive-frequency half-spectrum, and zero the negatives, then inverse-transform. Zeroing the negatives halves the energy and doubling the positives restores it, so the real part of z reproduces x_bp exactly. This is the standard FFT route to the discrete Hilbert transform.'}{' '}<Cite id="borghesani2013" paren /></p>

      <Callout variant="honest" title={es ? 'Alcance honesto de este build' : 'Honest scope of this build'}>
        <p>{es
          ? 'El análisis clásico establece que la envolvente al cuadrado (y su espectro, el SES) es la cantidad teóricamente preferida: para una señal cicloestacionaria de segundo orden , que es lo que es una falla de rodamiento,  el espectro de envolvente al cuadrado es un caso particular de la correlación espectral cíclica integrada, y elevar al cuadrado suprime el pedestal de ruido de banda ancha bajo los picos diagnósticos. Este build calcula el espectro diagnóstico a partir de la envolvente de magnitud |z(t)|, no de |z(t)|². Luego le resta la media y le aplica ventana de Hann antes de la FFT final, lo que elimina el gran término DC y reduce la fuga espectral para que las líneas discretas de falla resalten , la misma preocupación de pedestal/fuga que atiende el SES, manejada aquí en el paso de espectro de envolvente. El contenido de frecuencia cinemática descrito abajo es exacto; el modelado específico de amplitud es la variante de envolvente de magnitud, no el estimador estricto de envolvente al cuadrado.'
          : 'The classical analysis establishes that the squared envelope (and its spectrum, the SES) is the theoretically preferred quantity: for a second-order cyclostationary signal, which a bearing fault is, the squared-envelope spectrum is a special case of the integrated cyclic spectral correlation, and squaring suppresses the broadband noise pedestal beneath the diagnostic peaks. This build computes the diagnostic spectrum from the magnitude envelope |z(t)|, not from |z(t)|². It then mean-removes and Hann-windows that envelope before the final FFT, which removes the large DC term and reduces spectral leakage so the discrete fault lines stand out, the same pedestal/leakage concern the SES addresses, handled here in the envelope-spectrum step. The kinematic frequency content described below is exact; the specific amplitude shaping is the magnitude-envelope variant, not the strict squared-envelope estimator.'}{' '}<Cite id="borghesani2013ses" paren /></p>
      </Callout>

      <p>{es
        ? 'La envolvente se transforma una última vez para leer las tasas de repetición. El espectro de amplitud de un solo lado de este build resta la media, aplica una ventana de Hann w[i] = 0.5 − 0.5·cos(2πi/(n−1)), hace la FFT y escala cada bin de frecuencia positiva por 2/Σw[i]: el factor 2 compensa el plegado del espectro de dos lados sobre uno, y dividir por la suma de la ventana restaura la calibración de amplitud correcta (ganancia coherente) para que una sinusoide de amplitud A se lea como A. La resolución de frecuencia es Δf = fs/N, con N la siguiente potencia de dos ≥ la longitud del registro n (relleno de ceros). En el espectro resultante una falla aparece como un peine: un pico en la frecuencia cinemática del defecto y una serie de armónicos.'
        : 'The envelope is transformed one last time to read off the repetition rates. This build’s single-sided amplitude spectrum subtracts the mean, applies a Hann window w[i] = 0.5 − 0.5·cos(2πi/(n−1)), FFTs, and scales each positive-frequency bin by 2/Σw[i]: the factor 2 accounts for folding the two-sided spectrum onto one side, and dividing by the window sum restores correct amplitude calibration (coherent gain) so a sinusoid of amplitude A reads back as A. The frequency resolution is Δf = fs/N, where N is the next power of two ≥ the record length n (zero-padded). In the resulting spectrum a fault appears as a comb: a peak at the kinematic defect frequency and a series of its harmonics.'}</p>

      <p>{es
        ? 'Qué peine buscar lo fija la geometría y la velocidad del eje, no la señal. Dadas la frecuencia rotacional del eje fᵣ (Hz), el número de elementos rodantes n, el diámetro del elemento rodante d, el diámetro de paso D y el ángulo de contacto φ, las cuatro frecuencias características se siguen de la cinemática de rodadura sin deslizamiento de la jaula y los elementos. Una sutileza codificada a propósito: para un defecto en un elemento rodante, la tasa natural es la frecuencia de giro de bola (BSF), pero un punto único de la bola golpea ambas pistas dentro de una revolución, por lo que la línea dominante está en 2×BSF, no en BSF; la lógica de diagnóstico busca el peine de 2×BSF. Las líneas de pista externa (BPFO) e interna (BPFI) se buscan en su fundamental, con la conocida asimetría de que BPFI está modulada por el paso una-vez-por-revolución del defecto a través de la zona de carga.'
        : 'Which comb to look for is fixed by geometry and shaft speed, not by the signal. Given the shaft rotational frequency fᵣ (Hz), the number of rolling elements n, the rolling-element diameter d, the pitch diameter D, and the contact angle φ, the four characteristic frequencies follow from the no-slip rolling kinematics of the cage and elements. A subtlety encoded deliberately: for a defect on a rolling element, the natural rate is the ball-spin frequency (BSF), but a single point on the ball strikes both raceways within one revolution, so the dominant line is at 2×BSF, not BSF; the diagnosis logic searches the 2×BSF comb. The outer-race line (BPFO) and inner-race line (BPFI) are searched at their fundamental, with the well-known asymmetry that BPFI is modulated by the once-per-revolution passage of the defect through the load zone.'}</p>

      <Equation tex={String.raw`z(t) = x_{bp}(t) + j\,\mathcal{H}\{x_{bp}\}(t), \qquad e(t) = |z(t)| = \sqrt{\Re\{z(t)\}^2 + \Im\{z(t)\}^2}`} caption={es ? 'señal analítica y envolvente de amplitud (la señal diagnóstica)' : 'analytic signal and amplitude envelope (the diagnostic signal)'} />

      <Equation tex={String.raw`Z[k] = H[k]\,X[k], \qquad H[k] = \begin{cases} 1 & k=0\ (\text{DC}),\ k=N/2\ (\text{Nyquist}) \\ 2 & 1 \le k < N/2 \\ 0 & N/2 < k \le N-1 \end{cases}`} caption={es ? 'construcción FFT de z: duplica positivas, anula negativas, conserva DC/Nyquist' : 'FFT construction of z: double positives, zero negatives, keep DC/Nyquist'} />

      <Equation tex={String.raw`S[m] = \frac{2}{\sum_{i=0}^{n-1} w[i]}\,\Big|\,\mathrm{FFT}\big\{ (e[i]-\bar{e})\,w[i] \big\}[m]\,\Big|, \quad w[i] = 0.5 - 0.5\cos\!\frac{2\pi i}{n-1}, \quad \Delta f = \frac{f_s}{N}`} caption={es ? 'espectro de envolvente de un solo lado (S[m]: amplitud en el bin m; ē: media removida; w: Hann; Δf: resolución)' : 'single-sided envelope spectrum (S[m]: amplitude at bin m; ē: mean removed; w: Hann; Δf: resolution)'} />

      <Equation tex={String.raw`f_{\text{FTF}} = \tfrac{1}{2} f_r(1-r),\quad f_{\text{BPFO}} = \tfrac{n}{2} f_r(1-r),\quad f_{\text{BPFI}} = \tfrac{n}{2} f_r(1+r),\quad f_{\text{BSF}} = \tfrac{D}{2d} f_r(1-r^2),\quad r=\tfrac{d}{D}\cos\varphi`} caption={es ? 'frecuencias cinemáticas de defecto; la línea de bola buscada es 2·f_BSF' : 'kinematic defect frequencies; the searched ball line is 2·f_BSF'} />

      <p>{es
        ? 'El diagnóstico no se queda con el pico más alto. Para cada falla candidata con fundamental f₀ mide la prominencia armónica: en cada uno de los primeros 5 armónicos halla el pico local dentro de una ventana de tolerancia y lo divide por la mediana de los bins circundantes (una línea base local robusta), y promedia las razones por armónico. Las tres fallas actúan como controles negativos mutuos: una falla real se eleva muy por encima de las otras, mientras que el ruido puro eleva las tres por igual. Un veredicto exige superar una compuerta absoluta de 4.5 y una compuerta relativa de 1.7 sobre la segunda mejor candidata; de lo contrario el veredicto es sana. Esta regla de decisión y las frecuencias cinemáticas son hechos exactos y transferibles. Lo ilustrativo y sintético es la señal del generador de demostración (un tren de impulsos de resonancia amortiguada con ~0.5% de jitter de deslizamiento por intervalo y SNR objetivo) y la tendencia de severidad/RUL de run-to-failure (etiquetada como sintética). En un registro real medido la misma cadena aplica sin cambios; solo cambia la entrada.'
        : 'Diagnosis does not just take the tallest peak. For each candidate fault with fundamental f₀ it measures harmonic prominence: at each of the first 5 harmonics it finds the local peak within a tolerance window and divides it by the median of the surrounding bins (a robust local baseline), then averages the per-harmonic ratios. The three faults act as mutual negative controls: a real fault stands far above the others, whereas pure noise lifts all three roughly equally. A verdict requires clearing an absolute gate of 4.5 and a relative gate of 1.7 over the runner-up; otherwise the verdict is healthy. This decision rule and the kinematic frequencies are exact, transferable facts. What is illustrative and synthetic is the demo-generator signal (a damped-resonance impulse train with ~0.5% per-interval slip jitter and a target SNR) and the run-to-failure severity/RUL trend (labeled synthetic). On a real measured record the same pipeline applies unchanged; only the input changes.'}{' '}<Cite id="smith2015" paren /></p>

      <Equation tex={String.raw`P(f_0) = \frac{1}{K}\sum_{k=1}^{K} \frac{\max_{|f-k f_0|\le \text{tol}} S(f)}{\operatorname{med}_{|f-k f_0|\le W,\ |f-k f_0|>\text{tol}} S(f)}, \quad K=5,\ \text{tol}=\max(2\Delta f,0.015 f_0),\ W=\max(12\Delta f,0.12 f_0)`} caption={es ? 'prominencia armónica; falla si P_max ≥ 4.5 y P_max/P_2do ≥ 1.7, si no, sana' : 'harmonic prominence; fault iff P_max ≥ 4.5 and P_max/P_2nd ≥ 1.7, else healthy'} />

      {/* ===== Envelope analysis signal flow ===== */}
      <svg
        viewBox="0 0 920 360"
        width="100%"
        role="img"
        aria-labelledby="envFlowTitle envFlowDesc"
        style={{ fontFamily: 'var(--font-mono)', display: 'block' }}
      >
        <title id="envFlowTitle">
          {es
            ? 'Flujo de análisis de envolvente: forma de onda cruda, pasa-banda en la resonancia, envolvente analítica de Hilbert, FFT, espectro de envolvente con peine BPFO'
            : 'Envelope analysis signal flow: raw waveform, band-pass around resonance, Hilbert analytic envelope, FFT, envelope spectrum with BPFO comb'}
        </title>
        <desc id="envFlowDesc">
          {es
            ? 'Cinco etapas conectadas de izquierda a derecha. Un defecto localizado modula en amplitud una resonancia estructural; el pasa-banda aísla la resonancia, la envolvente de Hilbert la demodula y el espectro de envolvente revela un peine de armónicos en la frecuencia de defecto de pista externa.'
            : 'Five processing stages connected left to right. A localized defect amplitude-modulates a structural resonance; band-passing isolates the resonance, the Hilbert envelope demodulates it, and the envelope spectrum reveals a harmonic comb at the outer-race defect frequency.'}
        </desc>

        <defs>
          <marker id="envArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--color-fg-faint)" />
          </marker>
          <clipPath id="envClip"><rect x="0" y="0" width="150" height="64" /></clipPath>
        </defs>

        {[178, 358, 538, 718].map((x) => (
          <line key={x} x1={x} y1="92" x2={x + 24} y2="92" stroke="var(--color-fg-faint)" strokeWidth="1.5" markerEnd="url(#envArrow)" />
        ))}

        {/* STAGE 1, RAW WAVEFORM */}
        <g transform="translate(20,52)">
          <rect width="160" height="120" rx="8" fill="var(--color-surface)" stroke="var(--color-border)" />
          <text x="80" y="18" textAnchor="middle" fontSize="12" fill="var(--color-fg)">{es ? 'cruda x(t)' : 'raw x(t)'}</text>
          <g transform="translate(5,28)" clipPath="url(#envClip)">
            <path
              d="M2,32 C8,32 9,8 14,8 C19,8 20,56 25,56 C30,56 31,20 36,20 C41,20 42,44 47,44 C52,44 53,30 58,30 C66,32 67,30 72,30 C78,32 79,6 84,6 C89,6 90,58 95,58 C100,58 101,18 106,18 C111,18 112,46 117,46 C122,46 123,30 128,30 C136,32 137,30 142,30"
              fill="none" stroke="var(--color-accent)" strokeWidth="1.3" />
            <line x1="2" y1="32" x2="148" y2="32" stroke="var(--color-border)" strokeWidth="0.5" strokeDasharray="2 3" />
          </g>
          <text x="80" y="112" textAnchor="middle" fontSize="9" fill="var(--color-fg-subtle)">{es ? 'ráfagas resonantes que decaen' : 'decaying resonance bursts'}</text>
        </g>

        {/* STAGE 2, BAND-PASS */}
        <g transform="translate(200,52)">
          <rect width="160" height="120" rx="8" fill="var(--color-surface)" stroke="var(--color-border)" />
          <text x="80" y="18" textAnchor="middle" fontSize="12" fill="var(--color-fg)">{es ? 'pasa-banda [f₁,f₂]' : 'band-pass [f₁,f₂]'}</text>
          <g transform="translate(8,30)">
            <line x1="0" y1="58" x2="144" y2="58" stroke="var(--color-border)" strokeWidth="0.8" />
            <rect x="74" y="6" width="44" height="52" fill="var(--color-accent)" opacity="0.16" />
            <line x1="74" y1="4" x2="74" y2="58" stroke="var(--color-accent)" strokeWidth="1" strokeDasharray="3 2" />
            <line x1="118" y1="4" x2="118" y2="58" stroke="var(--color-accent)" strokeWidth="1" strokeDasharray="3 2" />
            <line x1="10" y1="58" x2="10" y2="20" stroke="var(--color-fg-faint)" strokeWidth="2" />
            <line x1="22" y1="58" x2="22" y2="34" stroke="var(--color-fg-faint)" strokeWidth="2" />
            <path d="M62,58 C84,58 86,12 96,12 C106,12 108,58 130,58" fill="none" stroke="var(--color-magenta)" strokeWidth="1.4" />
            <text x="96" y="2" textAnchor="middle" fontSize="8" fill="var(--color-magenta)">fᵣ</text>
          </g>
          <text x="80" y="112" textAnchor="middle" fontSize="9" fill="var(--color-fg-subtle)">{es ? 'aislar resonancia (pared FFT)' : 'isolate resonance (FFT brick-wall)'}</text>
        </g>

        {/* STAGE 3, HILBERT ENVELOPE */}
        <g transform="translate(380,52)">
          <rect width="160" height="120" rx="8" fill="var(--color-surface)" stroke="var(--color-border)" />
          <text x="80" y="18" textAnchor="middle" fontSize="12" fill="var(--color-fg)">Hilbert |z(t)|</text>
          <g transform="translate(5,28)" clipPath="url(#envClip)">
            <path
              d="M2,32 C6,32 7,12 12,12 C17,12 18,52 23,52 C28,52 29,16 34,16 C39,16 40,48 45,48 C50,48 51,22 56,22 C61,22 62,42 67,42 C72,42 73,26 78,26 C83,26 84,40 89,40 C94,40 95,28 100,28 C108,30 116,31 124,31 C132,31 140,31 146,31"
              fill="none" stroke="var(--color-fg-faint)" strokeWidth="0.9" />
            <path d="M2,12 C20,12 30,40 56,40 C82,40 92,12 100,28 C112,30 130,31 146,31" fill="none" stroke="var(--color-good)" strokeWidth="1.6" />
          </g>
          <text x="80" y="112" textAnchor="middle" fontSize="9" fill="var(--color-fg-subtle)">{es ? 'duplicar +f, anular −f' : 'double +freqs, zero −freqs'}</text>
        </g>

        {/* STAGE 4, MEAN-REMOVED HANN FFT */}
        <g transform="translate(560,52)">
          <rect width="160" height="120" rx="8" fill="var(--color-surface)" stroke="var(--color-border)" />
          <text x="80" y="18" textAnchor="middle" fontSize="12" fill="var(--color-fg)">{es ? 'Hann · FFT' : 'Hann · FFT'}</text>
          <g transform="translate(5,28)" clipPath="url(#envClip)">
            <path d="M2,58 C18,58 26,14 40,14 C54,14 62,58 78,58 C92,58 100,16 114,16 C128,16 136,58 148,58" fill="none" stroke="var(--color-good)" strokeWidth="1.5" />
            <line x1="2" y1="58" x2="148" y2="58" stroke="var(--color-border)" strokeWidth="0.6" />
          </g>
          <text x="80" y="112" textAnchor="middle" fontSize="9" fill="var(--color-fg-subtle)">{es ? 'media removida · FFT' : 'mean-removed FFT'}</text>
        </g>

        {/* STAGE 5, ENVELOPE SPECTRUM with comb */}
        <g transform="translate(740,52)">
          <rect width="160" height="120" rx="8" fill="var(--color-surface)" stroke="var(--color-border)" />
          <text x="80" y="18" textAnchor="middle" fontSize="12" fill="var(--color-fg)">{es ? 'espectro envolvente' : 'envelope spectrum'}</text>
          <g transform="translate(10,30)">
            <line x1="0" y1="58" x2="142" y2="58" stroke="var(--color-border)" strokeWidth="0.8" />
            <path d="M0,53 L142,53" stroke="var(--color-fg-faint)" strokeWidth="0.6" strokeDasharray="2 3" />
            {[
              { x: 16, h: 44 },
              { x: 40, h: 34 },
              { x: 64, h: 26 },
              { x: 88, h: 18 },
              { x: 112, h: 12 },
            ].map((p, i) => (
              <g key={p.x}>
                <line x1={p.x} y1="58" x2={p.x} y2={58 - p.h} stroke="var(--color-warn)" strokeWidth="2.4" />
                <text x={p.x} y="70" textAnchor="middle" fontSize="8" fill="var(--color-warn)">{i === 0 ? 'f' : `${i + 1}f`}</text>
              </g>
            ))}
            <text x="118" y="6" textAnchor="end" fontSize="9" fill="var(--color-warn)">{es ? 'peine BPFO' : 'BPFO comb'}</text>
          </g>
          <text x="80" y="112" textAnchor="middle" fontSize="9" fill="var(--color-fg-subtle)">{es ? 'picos en k·BPFO → pista externa' : 'peaks at k·BPFO → outer race'}</text>
        </g>

        <text x="460" y="345" textAnchor="middle" fontSize="11" fill="var(--color-fg-subtle)">
          {es
            ? 'Un defecto localizado modula en amplitud una resonancia; demodularla recupera un peine de armónicos en la frecuencia cinemática de defecto.'
            : 'A localized defect amplitude-modulates a structural resonance; demodulating it recovers a harmonic comb at the kinematic defect frequency.'}
        </text>
      </svg>

      <Refs ids={['randall2011', 'antoni2006sk', 'borghesani2013', 'smith2015', 'borghesani2013ses']} label={refsLabel} />
    </div>
  );

  // ============================================================
  // SPECTRAL KURTOSIS / KURTOGRAM
  // ============================================================
  const skTab = (
    <div className="prose">
      <p>{es
        ? 'El análisis de envolvente es el caballo de batalla del diagnóstico de rodamientos, pero descansa sobre una decisión frágil: la elección de la banda de demodulación. Un defecto localizado produce un choque mecánico breve cada vez que un elemento pasa sobre él; ese choque es de banda ancha, pero la máquina actúa como filtro y la información de falla llega como un tren de ráfagas de alta frecuencia moduladas a la lenta frecuencia de repetición (BPFO, BPFI o 2×BSF). Para leer esa modulación primero hay que aislar la banda de resonancia, demodularla y recién entonces tomar el espectro. Si la banda es correcta, la línea de falla y sus armónicos resaltan limpiamente; si es incorrecta , demasiado baja (dominada por tonos deterministas de eje/engranaje) o fuera de la resonancia (dominada por ruido),  el espectro de envolvente queda plano o ambiguo. Elegir esta banda a ojo no escala y es el principal modo de falla del método.'
        : 'Envelope analysis is the workhorse of rolling-element bearing diagnosis, but it rests on one fragile decision: the choice of the demodulation band. A localized defect produces a short mechanical shock each time an element rolls over it; that shock is broadband in itself, but the machine acts as a filter and the fault information arrives as a train of high-frequency bursts amplitude-modulated at the slow fault-repetition rate (BPFO, BPFI, or 2×BSF). To read that modulation we must first isolate the resonance band, demodulate it, and only then take the spectrum. If the band is right, the fault line and its harmonics stand out cleanly; if the band is wrong, too low (dominated by deterministic shaft/gear tones) or off the resonance (dominated by noise), the envelope spectrum is flat or ambiguous. Choosing this band by eye does not scale and is the single largest failure mode of the method.'}{' '}<Cite id="randall2011" paren /></p>

      <p>{es
        ? 'La idea que automatiza la elección es que la banda portadora de la falla es la más impulsiva. Una banda de resonancia limpia lleva una forma de onda con picos y silencios; una banda de solo ruido lleva fluctuaciones casi gaussianas. La curtosis en exceso cuantifica ese contraste: el cuarto momento central normalizado menos tres. El cociente m₄/m₂² es adimensional e invariante a escala, de modo que mide forma, no amplitud. La resta de 3 es el valor de referencia para una distribución gaussiana: así κ = 0 para ruido gaussiano, κ > 0 para una señal de colas pesadas/impulsiva, y κ < 0 para una de meseta plana. Las ráfagas de falla son de colas pesadas, por lo que una banda que las contiene da κ grande y positivo. Esta implementación calcula κ en una acumulación de dos pasadas de m₂ y m₄ y retorna 0 cuando la varianza es cero, protegiendo el caso degenerado de ventana constante.'
        : 'The insight that automates the choice is that the fault-bearing band is the most impulsive one. A clean resonance band carries a spiky, bursty waveform; a noise-only band carries near-Gaussian fluctuations. Excess kurtosis quantifies that contrast: the normalized fourth central moment minus three. The ratio m₄/m₂² is dimensionless and scale-invariant, so it measures shape, not amplitude. The subtraction of 3 is the reference value for a Gaussian distribution: thus κ = 0 for Gaussian noise, κ > 0 for a heavy-tailed/spiky signal, and κ < 0 for a flat-topped one. Bearing fault bursts are heavy-tailed, so a band carrying them yields large positive κ. This implementation computes κ in a two-pass accumulation of m₂ and m₄ and returns 0 when variance is zero, guarding the degenerate constant-window case.'}{' '}<Cite id="antoni2006sk" paren /></p>

      <Equation tex={String.raw`\kappa = \frac{\frac{1}{N}\sum_{i=1}^{N}(x_i-\bar{x})^4}{\left(\frac{1}{N}\sum_{i=1}^{N}(x_i-\bar{x})^2\right)^2} - 3, \qquad \bar{x}=\frac{1}{N}\sum_{i=1}^{N}x_i`} caption={es ? 'curtosis en exceso; 0 para ruido gaussiano, > 0 impulsiva' : 'excess kurtosis; 0 for Gaussian noise, > 0 impulsive'} />

      <p>{es
        ? 'Un único valor de curtosis responde si esta banda es impulsiva, pero no conocemos la banda a priori. El kurtograma convierte la pregunta en una búsqueda: evalúa la curtosis de banda limitada sobre el plano bidimensional de frecuencia central f_c y ancho de banda Δf, y el máximo localiza la mejor banda de demodulación. Ambos ejes son necesarios porque una buena banda debe ser lo bastante ancha para capturar el decaimiento completo de cada impulso (una banda muy angosta estira el impulso en el tiempo y baja κ) y a la vez lo bastante angosta para excluir ruido y tonos deterministas (una banda muy ancha diluye la energía del impulso con contenido ajeno). El máximo de la superficie es el punto óptimo del compromiso sesgo-varianza. El kurtograma rápido lo hace tratable restringiendo el plano a un árbol de banco de filtros diádico , anchos de banda de la forma Δf = fs/2^(k+1) en el nivel k,  de modo que toda la superficie se calcula en O(N log N) en lugar de una grilla densa.'
        : 'A single kurtosis value answers whether this band is impulsive, but we do not know the band a priori. The kurtogram turns the question into a search: it evaluates band-limited kurtosis over the two-dimensional plane of center frequency f_c and bandwidth Δf, and the maximum locates the best demodulation band. Both axes are needed because a good band must be wide enough to capture the full ring-down of each impulse (a too-narrow band stretches the impulse in time and lowers κ) yet narrow enough to exclude noise and deterministic tones (a too-wide band dilutes the impulse energy with non-fault content). The maximum of the surface is the bias-variance sweet spot. The fast kurtogram makes this tractable by restricting the plane to a dyadic filter-bank tree, bandwidths of the form Δf = fs/2^(k+1) at level k, so the whole surface is computed in O(N log N) instead of a dense grid.'}{' '}<Cite id="antoni2007" paren /></p>

      <p>{es
        ? 'Este build implementa un kurtograma diádico pragmático que conserva la idea , un pavimentado diádico del eje de frecuencia,  pero sustituye el banco de filtros analítico por primitivas transparentes y factibles en navegador. Para cada nivel k = 1…5 particiona la banda [0, fs/2] en 2^k bandas contiguas de igual ancho Δf_k = (fs/2)/2^k. Cada celda se evalúa con la primitiva de envolvente completa, no una aproximación: un pasa-banda de pared vertical en el dominio FFT a [f₁, f₂], luego la envolvente de Hilbert por señal analítica (conservando DC y Nyquist, duplicando positivas, anulando negativas), y luego la curtosis en exceso de esa envolvente. Es clave que la curtosis se toma sobre la envolvente, no sobre la señal cruda de la banda , la envolvente es la cantidad demodulada que el espectro posterior efectivamente consume, así que el puntaje de la celda mide la impulsividad exactamente de lo que será analizado en frecuencia. La celda de curtosis de envolvente máxima se selecciona y su [f₁, f₂] se vuelve la banda de demodulación.'
        : 'This build implements a pragmatic dyadic kurtogram that keeps the idea, a dyadic paving of the frequency axis, while substituting transparent, browser-feasible primitives for the analytic filter bank. For each level k = 1…5 it partitions the band [0, fs/2] into 2^k contiguous, equal-width bands of width Δf_k = (fs/2)/2^k. Each cell is evaluated with the full envelope primitive, not an approximation: an FFT-domain brick-wall band-pass to [f₁, f₂], then the analytic-signal Hilbert envelope (keeping DC and Nyquist, doubling positives, zeroing negatives), then the excess kurtosis of that envelope. Crucially, the kurtosis is taken on the envelope, not the raw band signal, the envelope is the demodulated quantity the downstream spectrum actually consumes, so the cell score measures impulsiveness of exactly the thing that will be spectrum-analyzed. The cell with maximum envelope kurtosis is selected and its [f₁, f₂] becomes the demodulation band.'}{' '}<Cite id="smith2015" paren /></p>

      <Callout variant="honest" title={es ? 'El guardia de banda baja, y exacto vs ilustrativo' : 'The low-band guard, and exact vs illustrative'}>
        <p>{es
          ? 'La implementación omite la porción más baja del espectro: para cualquier celda fija el borde inferior en max(f₁, 0.02·fs) y, si ese recorte consume la celda, la puntúa en cero. La razón es física: el extremo de baja frecuencia está dominado por contenido determinista (el fundamental del eje, sus armónicos, el engrane), periódico pero no impulsivo en el sentido de falla; si se deja, puede deprimir κ o producir un pico espurio. Excluir el 2% más bajo de la frecuencia de muestreo mantiene la búsqueda en las bandas de resonancia. Las frecuencias cinemáticas de falla (BPFO, BPFI, 2×BSF, FTF) calculadas desde la geometría del rodamiento y la velocidad del eje son física transferible. Las señales sobre las que corre la búsqueda son un modelo sintético con base física; la banda seleccionada y el κ reportado son salidas honestas del algoritmo real, pero el escalamiento de severidad y la RUL resultante son ilustrativos del generador sintético, no mediciones de una máquina física.'
          : 'The implementation skips the lowest portion of the spectrum: for any cell it clamps the lower edge to max(f₁, 0.02·fs) and, if that clamp swallows the cell, scores it zero. The reason is physical: the low-frequency end is dominated by deterministic content (the shaft fundamental, its harmonics, gear mesh), which is periodic but not impulsive in the fault sense; left in, it can depress κ or produce a spurious peak. Excluding the lowest 2% of the sampling rate keeps the search on the resonance bands. The kinematic fault frequencies (BPFO, BPFI, 2×BSF, FTF) computed from bearing geometry and shaft speed are transferable physics. The signals the search runs on are a physically-grounded synthetic model; the selected band and reported κ are honest outputs of the real algorithm, but the severity scaling and resulting RUL are illustrative properties of the synthetic generator, not measurements of a physical machine.'}</p>
      </Callout>

      <p>{es
        ? 'La fortaleza del kurtograma es también su punto ciego. La curtosis mide impulsividad, no periodicidad: premia a una banda por tener picos, pero no distingue un tren periódico de impulsos de falla de un transitorio aislado, un pico eléctrico, un golpe del sensor o ruido de fondo genuinamente no gaussiano. En esos casos el kurtograma puede señalar con confianza una banda sin falla diagnosticable. Esta es la motivación de los sucesores conscientes de cicloestacionariedad: el protrugram (maximiza la curtosis del espectro de envolvente), el autogram (curtosis de la autocorrelación de la envolvente al cuadrado) y el infogram (negentropía espectral que captura impulsividad y cicloestacionariedad juntas). Este build mitiga el problema aguas abajo: el diagnóstico no confía en un solo pico , puntúa cada falla candidata por la prominencia de sus primeros cinco armónicos contra la mediana local y exige superar un umbral absoluto de 4.5 y un margen relativo de 1.7 sobre la siguiente falla (usada como control negativo). Así, una banda impulsiva-pero-aperiódica no produce peine de armónicos, falla ambos umbrales y se reporta correctamente como sana.'
        : 'The kurtogram’s strength is also its blind spot. Kurtosis measures impulsiveness, not periodicity: it rewards a band for being spiky, but it cannot tell a periodic fault impulse train from a single isolated transient, an electrical spike, a sensor knock, or genuinely non-Gaussian background noise. In all of those cases the kurtogram can confidently point at a band that contains no diagnosable fault. This is the motivation for the cyclostationarity-aware successors: the protrugram (maximizes the kurtosis of the envelope spectrum), the autogram (kurtosis of the autocorrelation of the squared envelope), and the infogram (spectral negentropy capturing impulsiveness and cyclostationarity jointly). This build mitigates the issue downstream: the diagnosis does not trust a single peak, it scores each candidate fault by the prominence of its first five harmonics against the local median and requires the top fault to clear an absolute gate of 4.5 and beat the next-best fault (used as a negative control) by a relative factor of 1.7. So a band that is impulsive-but-aperiodic produces no harmonic comb, fails both gates, and is correctly reported as healthy.'}{' '}<Cite id="moshrefzadeh2018autogram" paren /> <Cite id="antoni2016infogram" paren /></p>

      <p>{es
        ? 'El IESFOgrama (Mauricio, Smith, Randall, Antoni & Gryllias 2020) lleva esa idea al selector de banda mismo. En vez de puntuar cada banda por impulsividad general (kurtograma) o repetitividad general (infograma), la puntúa por cuán fuerte muestra su espectro de envolvente al cuadrado (SES) el PEINE de armónicos de la frecuencia de falla DIAGNOSTICADA , BPFO, BPFI o 2·BSF. Es decir, le decimos qué periodicidad buscar y elegimos la banda cuya envolvente mejor revela ESA falla. La consecuencia clave: un impulso que NO está en el período de falla no entra ni en el pico del peine ni en su línea base local (un bin, rechazado por la mediana), así que el IESFOgrama dirigido es insensible a él , cuando un spike hace saltar al kurtograma, el IESFOgrama dirigido no se mueve. La variante ciega quita el conocimiento previo barriendo órdenes de eje (≥1.5×fr, excluyendo el eje y la jaula) y eligiendo el peine más fuerte; es más débil porque puede engancharse a líneas de engrane. En el App, "Banda demod → Auto (IESFOgrama)" usa este selector dirigido a la falla diagnosticada; la pestaña Infograma compara las seis métricas y el demo de spike lo hace visible.'
        : 'The IESFOgram (Mauricio, Smith, Randall, Antoni & Gryllias 2020) takes that idea to the band selector itself. Instead of scoring each band by general impulsiveness (kurtogram) or general repetitiveness (infogram), it scores it by how strongly its squared-envelope spectrum (SES) shows the harmonic COMB of the DIAGNOSED fault frequency, BPFO, BPFI or 2·BSF. That is, we tell it which periodicity to look for and pick the band whose envelope best reveals THAT fault. The key consequence: an impulse NOT at the fault period enters neither the comb peak nor its local baseline (one bin, rejected by the median), so the targeted IESFOgram is insensitive to it, when a spike makes the kurtogram jump, the targeted IESFOgram does not move. The blind variant drops the prior by sweeping shaft orders (≥1.5×fr, excluding the shaft and the cage) and choosing the strongest comb; it is weaker because it can latch onto gear-mesh lines. In the App, "Demod band → Auto (IESFOgram)" uses this selector targeted at the diagnosed fault; the Infogram tab compares all six metrics and the spike demo makes it visible.'}{' '}<Cite id="mauricio2020iesfo" paren /></p>

      <Equation tex={String.raw`\mathrm{IESFO}(\alpha_0) = \frac{1}{K}\sum_{k=1}^{K} \frac{\displaystyle\max_{|\alpha-k\alpha_0|\le\tau}\sqrt{S(\alpha)}}{\displaystyle\operatorname{med}_{|\alpha-k\alpha_0|\le W,\,|\alpha-k\alpha_0|>\tau}\sqrt{S(\alpha)}},\quad \hat\alpha_0 = \arg\max_{\text{band}}\mathrm{IESFO}`} caption={es ? 'prominencia del peine de la falla en el SES por banda; α₀∈{BPFO,BPFI,2·BSF}, K=5, τ=máx(2Δα,0.015α₀), W=máx(12Δα,0.12α₀)' : 'per-band SES fault-comb prominence; α₀∈{BPFO,BPFI,2·BSF}, K=5, τ=max(2Δα,0.015α₀), W=max(12Δα,0.12α₀)'} />

      <Callout variant="honest" title={es ? 'Qué calcula este build del IESFOgrama, y sus límites' : 'What this build computes for the IESFOgram, and its limits'}>
        <p>{es
          ? 'Salvedades honestas. (1) El modo dirigido necesita la frecuencia de falla; geometría errónea o deslizamiento grande desalinean el peine. (2) El modo ciego quita ese prior pero es más débil , puede engancharse a líneas de engrane o de eje (mitigado por el piso de ≥1.5×fr, no eliminado). (3) La simplificación principal: el paper de Mauricio integra la COHERENCIA espectral cíclica (CSCoh) sobre cada banda de un banco de filtros; este build puntúa la prominencia del peine sobre el SES por banda directamente , no usa el mapa Fast-SC/CSCoh. (4) Nuestra prominencia del peine normalizada por la mediana es un sustituto robusto a spikes del feature dirigido del paper (la razón armónico-de-falla a fondo); el paper NO usa regresión IRLS , no atribuimos esa técnica. (5) El pavimentado es el grid diádico pragmático de gramGrid, no el banco de filtros de ancho-de-banda-relativo-constante del paper. La banda y la prominencia seleccionadas son salidas honestas sobre una señal sintética físicamente fundamentada; la severidad y las tendencias RUL siguen siendo ilustrativas.'
          : 'Honest caveats. (1) The targeted mode needs the fault frequency; wrong geometry or large slip mis-aligns the comb. (2) The blind mode drops that prior but is weaker, it can latch onto gear-mesh or shaft lines (mitigated by the ≥1.5×fr floor, not eliminated). (3) The main simplification: Mauricio’s paper integrates the cyclic spectral COHERENCE (CSCoh) over each band of a filterbank; this build scores fault-comb prominence on the plain per-band SES directly, it does not use the Fast-SC/CSCoh map. (4) Our median-normalized comb prominence is a spike-robust surrogate of the paper’s targeted feature (the fault-harmonic-to-background ratio); the paper uses no IRLS regression, we attribute no such technique to it. (5) The paving is the pragmatic dyadic gramGrid, not the paper’s constant-relative-bandwidth filterbank. The selected band and prominence are honest outputs on a physically-grounded synthetic signal; severity and RUL trends remain illustrative.'}{' '}<Cite id="antoni2017fastsc" paren /></p>
      </Callout>

      {/* ===== Kurtogram plane ===== */}
      <svg
        viewBox="0 0 760 460"
        width="100%"
        role="img"
        aria-labelledby="kgramTitle kgramDesc"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        <title id="kgramTitle">
          {es
            ? 'Plano del kurtograma diádico: curtosis de envolvente por nivel y frecuencia, con la banda seleccionada que alimenta el espectro de envolvente'
            : 'Dyadic kurtogram plane: envelope kurtosis over level and frequency, with the selected band feeding the envelope spectrum'}
        </title>
        <desc id="kgramDesc">
          {es
            ? 'Cada fila es un nivel k = 1 a 5, dividido en 2^k bandas de igual ancho de 0 a Nyquist. El sombreado de cada celda codifica la curtosis en exceso de la envolvente; la celda máxima se resalta y una flecha mapea su banda a un mini-espectro.'
            : 'Each row is a level k = 1 to 5, split into 2^k equal-width bands from 0 to Nyquist. Cell shade encodes envelope excess kurtosis; the maximum cell is outlined and an arrow maps its band onto a mini-spectrum.'}
        </desc>

        <defs>
          <linearGradient id="kgramScale" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--color-surface)" />
            <stop offset="0.55" stopColor="var(--color-accent)" />
            <stop offset="1" stopColor="var(--color-bad)" />
          </linearGradient>
          <marker id="kgramArrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L8,3 L0,6 Z" fill="var(--color-accent)" />
          </marker>
        </defs>

        <text x="20" y="26" fill="var(--color-fg)" fontSize="15" fontWeight="700">
          {es ? 'Plano del kurtograma, curtosis(k, f)' : 'Kurtogram plane, kurtosis(k, f)'}
        </text>

        <rect x="70" y="44" width="420" height="250" fill="var(--color-surface)" stroke="var(--color-border)" />

        <text x="22" y="170" fill="var(--color-fg-faint)" fontSize="11" transform="rotate(-90 22 170)" textAnchor="middle">
          {es ? 'nivel k · ancho = fs/2 / 2^k' : 'level k · bandwidth = fs/2 / 2^k'}
        </text>
        <text x="280" y="316" fill="var(--color-fg-faint)" fontSize="11" textAnchor="middle">{es ? 'frecuencia → fs/2 (Nyquist)' : 'frequency → fs/2 (Nyquist)'}</text>
        <text x="74" y="316" fill="var(--color-fg-subtle)" fontSize="10">0</text>
        <text x="470" y="316" fill="var(--color-fg-subtle)" fontSize="10" textAnchor="end">fs/2</text>

        {[
          { k: 1, rowY: 50, cells: [0.05, 0.18] },
          { k: 2, rowY: 100, cells: [0.04, 0.22, 0.61, 0.30] },
          { k: 3, rowY: 150, cells: [0.03, 0.20, 0.42, 0.95, 0.55, 0.28, 0.15, 0.10] },
          { k: 4, rowY: 200, cells: [0.02, 0.15, 0.30, 0.50, 0.70, 0.40, 0.25, 0.18, 0.12, 0.10, 0.08, 0.07, 0.06, 0.05, 0.05, 0.04] },
          { k: 5, rowY: 250, cells: [0.02, 0.10, 0.20, 0.28, 0.36, 0.44, 0.33, 0.24, 0.18, 0.14, 0.11, 0.09, 0.08, 0.07, 0.06, 0.05, 0.05, 0.04, 0.04, 0.03, 0.03, 0.03, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.01, 0.01, 0.01, 0.01] },
        ].map(({ k, rowY, cells }) => {
          const w = 420 / cells.length;
          const isBestRow = k === 3;
          return (
            <g key={k}>
              <text x="62" y={rowY + 28} fill="var(--color-fg-faint)" fontSize="11" textAnchor="end">{k}</text>
              {cells.map((kurt, b) => {
                const x = 70 + b * w;
                const guard = b === 0;
                const best = isBestRow && b === 3;
                return (
                  <g key={b}>
                    <rect
                      x={x} y={rowY} width={w} height="46"
                      fill={guard ? 'var(--color-surface)' : 'url(#kgramScale)'}
                      fillOpacity={guard ? 0.25 : 0.15 + 0.85 * kurt}
                      stroke="var(--color-border)" strokeWidth="0.5"
                    />
                    {guard && (
                      <line x1={x + 2} y1={rowY + 2} x2={x + w - 2} y2={rowY + 44} stroke="var(--color-fg-subtle)" strokeWidth="0.75" strokeDasharray="2 2" />
                    )}
                    {best && (
                      <rect x={x - 1} y={rowY - 1} width={w + 2} height="48" fill="none" stroke="var(--color-good)" strokeWidth="2.5" />
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        <text x="74" y="40" fill="var(--color-fg-subtle)" fontSize="9">{es ? '2%·fs más bajo omitido (eje/engrane)' : 'lowest 2%·fs skipped (shaft/gear)'}</text>
        <text x="262" y="156" fill="var(--color-good)" fontSize="10" fontWeight="700" textAnchor="middle">{es ? 'κ máx → [f₁, f₂]' : 'max κ → [f₁, f₂]'}</text>

        <path d="M 322 173 C 420 173, 470 360, 560 360" fill="none" stroke="var(--color-accent)" strokeWidth="1.75" strokeDasharray="4 3" markerEnd="url(#kgramArrow)" />
        <text x="430" y="250" fill="var(--color-accent)" fontSize="10">{es ? 'banda de demodulación' : 'demodulation band'}</text>

        <text x="70" y="345" fill="var(--color-fg-faint)" fontSize="10">{es ? 'κ (curtosis de envolvente en exceso)' : 'κ (envelope excess kurtosis)'}</text>
        <rect x="70" y="352" width="160" height="10" fill="url(#kgramScale)" stroke="var(--color-border)" strokeWidth="0.5" />
        <text x="70" y="376" fill="var(--color-fg-subtle)" fontSize="9">{es ? '0 (gaussiano)' : '0 (Gaussian)'}</text>
        <text x="230" y="376" fill="var(--color-fg-subtle)" fontSize="9" textAnchor="end">{es ? 'impulsivo' : 'impulsive'}</text>

        <text x="525" y="26" fill="var(--color-fg)" fontSize="13" fontWeight="700">{es ? 'Banda → espectro' : 'Selected band → spectrum'}</text>

        <rect x="525" y="320" width="210" height="86" fill="var(--color-surface)" stroke="var(--color-border)" />
        <text x="525" y="40" fill="var(--color-fg-faint)" fontSize="10">{es ? 'espectro crudo |X(f)|' : 'raw spectrum |X(f)|'}</text>

        <path d="M 525 70 Q 560 70 590 52 Q 620 30 650 52 Q 680 70 735 72" fill="none" stroke="var(--color-fg-subtle)" strokeWidth="1.5" />
        <rect x="600" y="44" width="52" height="40" fill="var(--color-accent)" fillOpacity="0.18" stroke="var(--color-accent)" strokeWidth="1.25" />
        <text x="626" y="98" fill="var(--color-accent)" fontSize="9" textAnchor="middle">{es ? 'pasa-banda [f₁,f₂]' : 'band-pass [f₁,f₂]'}</text>
        <text x="525" y="92" fill="var(--color-fg-subtle)" fontSize="9">{es ? 'resonancia' : 'resonance'}</text>

        <text x="525" y="316" fill="var(--color-fg-faint)" fontSize="10">{es ? 'espectro de envolvente' : 'envelope spectrum'}</text>
        <line x1="535" y1="398" x2="725" y2="398" stroke="var(--color-border)" />
        {[0, 1, 2, 3, 4].map((h) => {
          const x = 548 + h * 36;
          const tall = 70 - h * 11;
          return (
            <g key={h}>
              <line x1={x} y1="398" x2={x} y2={398 - tall} stroke="var(--color-warn)" strokeWidth="2.5" />
              <text x={x} y="394" fill="var(--color-warn)" fontSize="8" textAnchor="middle">{h === 0 ? 'BPFO' : `${h + 1}×`}</text>
            </g>
          );
        })}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
          <line key={i} x1={540 + i * 16} y1="398" x2={540 + i * 16} y2="392" stroke="var(--color-fg-subtle)" strokeWidth="0.75" />
        ))}
        <text x="630" y="332" fill="var(--color-fg-subtle)" fontSize="8" textAnchor="middle">{es ? 'los armónicos de falla emergen en la banda demodulada' : 'fault harmonics emerge in the demodulated band'}</text>
      </svg>

      <Refs ids={['antoni2006sk', 'antoni2007', 'antoni2017fastsc', 'moshrefzadeh2018autogram', 'antoni2016infogram', 'mauricio2020iesfo', 'randall2011', 'smith2015']} label={refsLabel} />
    </div>
  );

  // ============================================================
  // CYCLOSTATIONARY
  // ============================================================
  const csTab = (
    <div className="prose">
      <p>{es
        ? 'Un descascarillado localizado en una pista produce un impacto mecánico cada vez que un elemento rodante pasa sobre él. Si la geometría fuese rígida y el deslizamiento nulo, esos impactos llegarían exactamente al período cinemático de falla y la señal sería estrictamente periódica. Los rodamientos reales no son así: los elementos deslizan una fracción de porcentaje, la velocidad de la jaula deriva, la zona de carga modula la fuerza de cada impacto y el ángulo de reentrada tiene jitter. El resultado es un tren de impulsos cuya tasa media de repetición es la frecuencia de falla, pero cuyos tiempos de llegada tienen pequeño jitter aleatorio y cuyas amplitudes son aleatorias. Un proceso así no es periódico , su forma de onda nunca se repite,  pero sus estadísticas sí son periódicas: la varianza (energía) sube y baja al período de falla aunque la media no. Esa es la definición de un proceso cicloestacionario de segundo orden (CS2), y por eso el Fourier ordinario de la señal cruda rinde mal: la energía de falla se dispersa en una portadora de banda ancha y fase aleatoria, y solo su envolvente late a la tasa de falla.'
        : 'A localized spall on a race produces a mechanical impact every time a rolling element rolls over it. If the geometry were rigid and the slip zero, those impacts would arrive at exactly the kinematic fault period and the signal would be strictly periodic. Real bearings are not like that: rolling elements slip by a fraction of a percent, the cage speed wanders, the load zone modulates how hard each impact lands, and the re-entry angle jitters. The result is an impulse train whose average repetition rate is the fault frequency, but whose arrival times carry small random jitter and whose amplitudes are random. Such a process is not periodic, its waveform never repeats, yet its statistics are periodic: the variance (energy) rises and falls at the fault period even though the mean does not. That is the definition of a second-order cyclostationary (CS2) process, and it is why ordinary Fourier analysis of the raw signal under-performs: the fault energy is spread into a broadband, randomly-phased carrier, and only its envelope beats at the fault rate.'}{' '}<Cite id="randall2011" paren /></p>

      <p>{es
        ? 'La herramienta que hace visible la estructura CS2 es una transformada bidimensional, porque hay dos tipos distintos de frecuencia en juego. La primera es la frecuencia portadora f , la oscilación rápida que transporta la energía (la resonancia estructural, a menudo varios kHz). La segunda es la frecuencia cíclica α , la tasa lenta a la que esa portadora es modulada en amplitud (la tasa de repetición de la falla). La correlación espectral S_x(f, α) y su forma normalizada, la coherencia espectral cíclica γ_x(f, α), viven en este plano. La propiedad decisiva: una falla deposita energía como una cresta vertical , una banda de portadoras f todas moduladas a la misma frecuencia cíclica α = BPFO (o BPFI, 2·BSF, FTF y sus armónicos). La cresta es vertical porque el impacto excita cualesquiera resonancias que ofrezca el camino de transmisión, de modo que la falla se reparte entre muchas portadoras pero queda anclada a una sola frecuencia cíclica. Esa es la firma geométrica de la cicloestacionariedad.'
        : 'The tool that makes CS2 structure visible is a two-dimensional transform, because there are two distinct kinds of frequency at play. The first is the carrier frequency f, the fast oscillation that carries the energy (the structural resonance, often several kHz). The second is the cyclic frequency α, the slow rate at which that carrier is amplitude-modulated (the fault repetition rate). The spectral correlation S_x(f, α) and its normalized form, the cyclic spectral coherence γ_x(f, α), live on this plane. The decisive property: a fault deposits energy as a vertical ridge, a band of carriers f all modulated at the same cyclic frequency α = BPFO (or BPFI, 2·BSF, FTF, and their harmonics). The ridge is vertical because the impact rings up whatever resonances the transmission path offers, so the fault is spread across many carriers but pinned to one cyclic frequency. That is the geometric signature of cyclostationarity.'}{' '}<Cite id="antoni2007csc" paren /></p>

      <p>{es
        ? 'El contenido determinista se comporta distinto, y ése es el punto. Un desbalance de eje, un armónico de desalineamiento o un tono de engrane son periódicos de primer orden: son un tono puro, su energía se ubica en una sola portadora f y contribuye al eje α = 0 (el espectro de potencia ordinario vive en ese borde inferior). No se difuminan verticalmente entre portadoras, porque no modulan una resonancia de banda ancha: son la línea. Así que al mirar hacia arriba del plano (lejos de α = 0) el bosque determinista de líneas de engrane y eje desaparece, y solo sobreviven las familias genuinamente moduladas y de fase aleatoria. Un pico coincidente que cae cerca de BPFO pero que en realidad es interferencia eléctrica o una banda lateral de engrane no formará una cresta vertical coherente en α = BPFO. Éste es el discriminador riguroso: el plano cíclico no pregunta si hay energía cerca de la frecuencia de falla, sino si la energía en la frecuencia de falla organiza toda una banda de portadoras , algo mucho más difícil de falsificar.'
        : 'Deterministic content behaves differently, and that is the point. A shaft imbalance, a misalignment harmonic, or a gear-mesh tone is first-order periodic: it is a pure tone, its energy sits at one carrier f and contributes to the α = 0 axis (the ordinary power spectrum lives on that bottom edge). It does not smear vertically across carriers, because it is not modulating a broadband resonance, it is the line. So when you look up the plane (away from α = 0) the deterministic forest of gear and shaft lines drops away, and only genuinely modulated, randomly-phased families survive. A coincidental peak that lands near BPFO but is really electrical pickup or a gear sideband will not form a coherent vertical ridge at α = BPFO. This is the rigorous discriminator: the cyclic plane asks not whether there is energy near the fault frequency, but whether energy at the fault frequency is organizing a whole band of carriers, a far harder thing to fake.'}{' '}<Cite id="borghesani2013" paren /></p>

      <p>{es
        ? 'El mapa (f, α) es la imagen más rica del diagnóstico, pero es bidimensional y difícil de leer de un vistazo. Su producto de cara al usuario es una marginal unidimensional: integrar la coherencia cíclica sobre el eje de portadoras f colapsa las crestas verticales en picos sobre un eje α. Éste es el espectro de envolvente mejorado (EES). El contraste con el análisis de envolvente clásico es fundamental: el clásico obliga a elegir una banda de demodulación , la única mejor resonancia del kurtograma,  y descarta toda otra portadora informativa; si eliges mal la banda, el espectro queda plano. La marginal integrada en banda fusiona todas las portadoras informativas automáticamente: cualquier resonancia que la falla module aporta su evidencia al mismo pico α = BPFO. Por eso el EES revela armónicos que un espectro de envolvente de banda única no ve, y por eso se degrada con gracia bajo ruido. El resultado de que el espectro de envolvente al cuadrado es un caso particular de la coherencia cíclica integrada sobre la portadora es esta relación formalizada: el SES clásico es la versión restringida en banda de esta marginal.'
        : 'The (f, α) map is the richest image in diagnostics, but it is two-dimensional and hard to read at a glance. Its user-facing product is a one-dimensional marginal: integrating the cyclic coherence over the carrier axis f collapses the vertical ridges into peaks on an α axis. This is the enhanced envelope spectrum (EES). The contrast with classical envelope analysis is fundamental: the classical method forces you to pick one demodulation band, the kurtogram’s single best resonance, and throws away every other informative carrier; pick the wrong band and the spectrum is flat. The band-integrated marginal instead fuses all informative carriers automatically: any resonance the fault modulates contributes its evidence to the same α = BPFO peak. That is why the EES reveals fault harmonics a single-band envelope spectrum misses, and why it degrades gracefully under noise. The result that the squared-envelope spectrum is a special case of the cyclic coherence integrated over carrier frequency is exactly this relationship made formal: the classical SES is the band-restricted version of this marginal.'}{' '}<Cite id="borghesani2013ses" paren /> <Cite id="antoni2006sk" paren /></p>

      <Callout variant="honest" title={es ? 'Qué calcula este build, una correlación espectral real, y sus límites honestos' : 'What this build computes, a true spectral correlation, and its honest limits'}>
        <p>{es
          ? 'Este build SÍ calcula una Correlación Espectral Rápida (Fast-SC, Antoni–Xin–Hamzaoui 2017), no el espectro de modulación cíclica de solo-magnitud. Pipeline: primero un prewhitening AR (Levinson-Durbin orden 64) remueve la parte predecible , las líneas deterministas de eje y engrane,  dejando la modulación aleatoria de falla; sin él, el producto cruzado con fase reportaría los tonos deterministas como falsas crestas α (el CMS de solo-magnitud era inmune a eso, así que el prewhitening restaura esa robustez). Luego una STFT de Hann (N=256, salto=16, 75% de solape) conserva los coeficientes COMPLEJOS; para cada par de bines portadores (p, q=p−m) se promedia sobre tramas el producto cruzado complejo S(i,p)·S*(i,q) y se transforma de Fourier sobre el índice de trama i , su eje es la frecuencia cíclica α, con resolución fina Δα=(fs/salto)/Nα≈0.7 Hz, conservando la fase entre portadoras que |STFT|² descarta. El salto de bin m=round(α/Δf) aporta esa fase; con salto=16 la frecuencia de trama es 750 Hz, así que el Nyquist cíclico de 375 Hz cubre BPFO/BPFI/2·BSF/FTF y sus primeros armónicos SIN des-aliasing. Cada píxel se normaliza por la raíz del producto de las dos potencias de banda → la coherencia espectral cíclica γ_x(f,α)∈[0,1] (cota de Cauchy–Schwarz). La máscara es entonces el resultado exacto de Carter–Knapp–Nuttall: bajo H0 la coherencia al cuadrado es Beta(1,K_eff−1), así que el umbral a nivel (1−p) es |γ|²=1−p^{1/(K_eff−1)}, con K_eff el número de promedios independientes corregido por solape (de la autocorrelación de la propia ventana) , una prueba estadística real que reemplaza la heurística mediana+3·MAD. La marginal integrada en banda EES(α)=⟨|γ(f,α)|⟩_f es el espectro de envolvente mejorado; el SES clásico es su caso restringido en banda. Límites honestos que medimos: la tasa de falsa alarma empírica sobre ruido blanco es ~4–5% al p=0.05 nominal (calibrada con el K_eff corregido por solape vía la autocorrelación de la ventana; el pequeño residuo viene del prewhitening AR y el zero-padding); se reconstruye α finamente hasta ≈375 Hz (la banda diagnóstica decisiva), no más; y, como todo método cíclico aquí, asume velocidad aprox. constante (arranque/parada requiere remuestreo en orden, no hecho aquí). Las relaciones de frecuencia y el umbral son exactos y transferibles; la severidad sintética y las tendencias run-to-failure son ilustrativas.'
          : 'This build DOES compute a Fast Spectral Correlation (Fast-SC, Antoni–Xin–Hamzaoui 2017), not the magnitude-only cyclic modulation spectrum. Pipeline: first an AR prewhitening (Levinson-Durbin order 64) removes the predictable part, the deterministic shaft and gear lines, leaving the random fault modulation; without it the phase-retaining cross-product would report deterministic tones as fake α-ridges (the magnitude-only CMS was immune to that, so the prewhitening restores that robustness). Then a Hann STFT (N=256, hop=16, 75% overlap) keeps the COMPLEX coefficients; for each carrier-bin pair (p, q=p−m) the complex cross-spectrum S(i,p)·S*(i,q) is averaged over frames and Fourier-transformed over the frame index i, its axis is the cyclic frequency α, at the fine resolution Δα=(fs/hop)/Nα≈0.7 Hz, retaining the cross-carrier phase |STFT|² throws away. The bin-lag m=round(α/Δf) supplies that phase; with hop=16 the frame rate is 750 Hz, so the cyclic Nyquist of 375 Hz covers BPFO/BPFI/2·BSF/FTF and their first harmonics with NO de-aliasing. Each pixel is normalized by the square root of the two band powers → the cyclic spectral coherence γ_x(f,α)∈[0,1] (the Cauchy–Schwarz bound). The mask is then the exact Carter–Knapp–Nuttall result: under H0 the squared coherence is Beta(1,K_eff−1), so the (1−p) threshold is |γ|²=1−p^{1/(K_eff−1)}, with K_eff the overlap-corrected number of independent averages (from the window’s own autocorrelation), a real statistical test replacing the median+3·MAD heuristic. The band-integrated marginal EES(α)=⟨|γ(f,α)|⟩_f is the enhanced envelope spectrum; the classical SES is its band-restricted special case. Honest limits we measured: the empirical white-noise false-alarm rate is ~4–5% at the nominal p=0.05 (calibrated with the overlap-corrected K_eff via the window autocorrelation; the small residual is from the AR prewhitening and zero-padding); α is finely reconstructed up to ≈375 Hz (the decisive diagnostic band), not beyond; and, like every cyclic method here, it assumes roughly constant speed (run-up/run-down needs order-domain resampling, not done here). The frequency relations and the threshold are exact and transferable; the synthetic severity and run-to-failure trends are illustrative.'}{' '}<Cite id="antoni2017fastsc" paren /> <Cite id="carter1973msc" paren /> <Cite id="smith2015" paren /></p>
      </Callout>

      <Equation tex={String.raw`S_x(f,\alpha) = \lim_{T\to\infty}\frac{1}{T}\,\mathbb{E}\!\left[ X_T\!\left(f+\tfrac{\alpha}{2}\right) X_T^{*}\!\left(f-\tfrac{\alpha}{2}\right)\right]`} caption={es ? 'correlación espectral; en α = 0 se reduce a la densidad espectral de potencia' : 'spectral correlation; at α = 0 it reduces to the power spectral density'} />

      <Equation tex={String.raw`\gamma_x(f,\alpha) = \frac{S_x(f,\alpha)}{\sqrt{S_x\!\left(f+\tfrac{\alpha}{2},0\right)S_x\!\left(f-\tfrac{\alpha}{2},0\right)}}, \qquad 0 \le |\gamma_x(f,\alpha)| \le 1`} caption={es ? 'coherencia espectral cíclica: S_x normalizada a [0,1]' : 'cyclic spectral coherence: S_x normalized to [0,1]'} />

      <Equation tex={String.raw`\hat S_x(f,\alpha)=\frac{1}{K}\sum_{i=0}^{K-1} S(i,f_{+})\,S^{*}(i,f_{-}),\qquad \hat\gamma_x(f,\alpha)=\frac{|\hat S_x(f,\alpha)|}{\sqrt{\hat P(f_{+})\,\hat P(f_{-})}}\in[0,1]`} caption={es ? 'Fast-SC: producto cruzado de la STFT promediado sobre tramas, normalizado a la coherencia [0,1]' : 'Fast-SC: frame-averaged STFT cross-spectrum, normalized to the [0,1] coherence'} />

      <Equation tex={String.raw`H_0:\ \gamma_x=0 \;\Rightarrow\; |\hat\gamma_x|^2 \sim \mathrm{Beta}(1,K_{\mathrm{eff}}-1),\qquad |\hat\gamma_x|^2_{\mathrm{thr}} = 1 - p^{\,1/(K_{\mathrm{eff}}-1)},\qquad \mathrm{EES}(\alpha)=\frac{1}{N_f}\sum_{f}|\hat\gamma_x(f,\alpha)|`} caption={es ? 'umbral exacto de Carter–Knapp–Nuttall (K_eff = promedios independientes corregidos por solape) + la marginal EES integrada en portadora' : 'exact Carter–Knapp–Nuttall threshold (K_eff = overlap-corrected independent averages) + the carrier-integrated EES marginal'} />

      <p>{es
        ? 'Símbolos: f es la frecuencia portadora (Hz), la oscilación rápida que transporta energía; α es la frecuencia cíclica (Hz), la tasa de modulación (la tasa de repetición de falla); S(i, f) es el coeficiente COMPLEJO de la STFT en la trama i y el bin portador f (Hann, N = 256, salto 16); f₊ = f+α/2 y f₋ = f−α/2 son los dos bines portadores separados por α (a un desfase de bin m = round(α/Δf), Δf = fs/N); Ŝ_x es el producto cruzado complejo promediado sobre las K tramas; P̂(f) = ⟨|S(i,f)|²⟩ es la potencia de banda (el eje α = 0); γ̂_x es la coherencia espectral cíclica normalizada en [0,1]; K_eff es el número de promedios independientes corregido por solape (de la autocorrelación de la ventana); p es la falsa-alarma por píxel; y EES(α) es la media de |γ| sobre las N_f portadoras, con picos en BPFO/BPFI/2·BSF/FTF y armónicos.'
        : 'Symbols: f is the carrier frequency (Hz), the fast oscillation carrying energy; α is the cyclic frequency (Hz), the modulation rate (the fault repetition rate); S(i, f) is the COMPLEX STFT coefficient at frame i and carrier bin f (Hann, N = 256, hop 16); f₊ = f+α/2 and f₋ = f−α/2 are the two carrier bins separated by α (at a bin-lag m = round(α/Δf), Δf = fs/N); Ŝ_x is the complex cross-spectrum averaged over the K frames; P̂(f) = ⟨|S(i,f)|²⟩ is the band power (the α = 0 axis); γ̂_x is the cyclic spectral coherence normalized to [0,1]; K_eff is the overlap-corrected number of independent averages (from the window autocorrelation); p is the per-pixel false-alarm rate; and EES(α) is the mean of |γ| over the N_f carriers, peaking at BPFO/BPFI/2·BSF/FTF and harmonics.'}</p>

      {/* ===== Bi-frequency plane ===== */}
      <svg
        viewBox="0 0 760 560"
        width="100%"
        role="img"
        aria-labelledby="cscTitle cscDesc"
        style={{ fontFamily: 'var(--font-mono)', display: 'block' }}
      >
        <title id="cscTitle">
          {es ? 'Plano bi-frecuencia del espectro cíclico: portadora f vs frecuencia cíclica α' : 'Cyclic spectrum bi-frequency plane: carrier f vs cyclic frequency α'}
        </title>
        <desc id="cscDesc">
          {es
            ? 'Las fallas aparecen como crestas verticales en α en BPFO, BPFI, 2·BSF y FTF, abarcando muchas portadoras pero ancladas a una frecuencia cíclica. Integrar sobre el eje de portadoras da el espectro de envolvente mejorado. Los tonos deterministas de engrane y eje se ubican solo en la línea base α = 0.'
            : 'Bearing faults appear as vertical α-ridges at BPFO, BPFI, 2·BSF and FTF, spanning many carriers but pinned to one cyclic frequency. Integrating over the carrier axis yields the enhanced envelope spectrum. Deterministic gear and shaft tones sit only on the α = 0 baseline.'}
        </desc>

        <defs>
          <linearGradient id="cscRidgeBPFO" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-warn)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--color-warn)" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="cscRidgeBPFI" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-magenta)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--color-magenta)" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="cscRidgeBall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="cscRidgeFTF" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-good)" stopOpacity="0.10" />
            <stop offset="100%" stopColor="var(--color-good)" stopOpacity="0.40" />
          </linearGradient>
        </defs>

        <rect x="70" y="20" width="600" height="380" fill="var(--color-surface)" stroke="var(--color-border)" rx="4" />

        <text x="370" y="448" textAnchor="middle" fill="var(--color-fg)" fontSize="15">
          {es ? 'frecuencia cíclica α (Hz) → tasa de repetición de falla' : 'cyclic frequency α (Hz) → fault repetition rate'}
        </text>
        <text x="22" y="210" textAnchor="middle" fill="var(--color-fg)" fontSize="15" transform="rotate(-90 22 210)">
          {es ? 'frecuencia portadora f (Hz) → resonancia excitada' : 'carrier frequency f (Hz) → excited resonance'}
        </text>

        {[0, 1, 2, 3, 4].map((k) => {
          const y = 400 - k * 95;
          return (
            <g key={`fy-${k}`}>
              <line x1="70" y1={y} x2="670" y2={y} stroke="var(--color-border)" strokeOpacity="0.5" strokeDasharray="2 4" />
              <text x="62" y={y + 4} textAnchor="end" fill="var(--color-fg-faint)" fontSize="11">{k * 2}k</text>
            </g>
          );
        })}

        {[
          { x: 70, label: '0' },
          { x: 190, label: 'FTF' },
          { x: 300, label: 'BPFO' },
          { x: 430, label: '2·BSF' },
          { x: 560, label: 'BPFI' },
          { x: 640, label: '2×BPFO' },
        ].map((t) => (
          <g key={`ax-${t.label}`}>
            <line x1={t.x} y1="400" x2={t.x} y2="406" stroke="var(--color-fg-subtle)" />
            <text x={t.x} y="420" textAnchor="middle" fill="var(--color-fg-faint)" fontSize="10">{t.label}</text>
          </g>
        ))}

        <line x1="70" y1="20" x2="70" y2="400" stroke="var(--color-fg-subtle)" strokeWidth="2" />
        {[120, 230, 300, 350].map((y, i) => (
          <circle key={`det-${i}`} cx="70" cy={y} r="3.5" fill="var(--color-fg-faint)" />
        ))}
        <text x="78" y="40" fill="var(--color-fg-faint)" fontSize="10">{es ? 'α = 0 : espectro ordinario' : 'α = 0 : ordinary spectrum'}</text>
        <text x="78" y="54" fill="var(--color-fg-faint)" fontSize="10">{es ? '(tonos de engrane/eje, sin dispersión vertical)' : '(gear-mesh / shaft tones, no vertical spread)'}</text>

        <rect x="291" y="40" width="18" height="360" fill="url(#cscRidgeBPFO)" rx="3" />
        <line x1="300" y1="40" x2="300" y2="400" stroke="var(--color-warn)" strokeWidth="1.5" strokeDasharray="5 3" />
        <text x="300" y="34" textAnchor="middle" fill="var(--color-warn)" fontSize="12" fontWeight="bold">BPFO</text>
        <rect x="631" y="120" width="14" height="280" fill="url(#cscRidgeBPFO)" rx="3" />
        <line x1="640" y1="120" x2="640" y2="400" stroke="var(--color-warn)" strokeWidth="1" strokeDasharray="4 4" />

        <rect x="551" y="40" width="18" height="360" fill="url(#cscRidgeBPFI)" rx="3" />
        <line x1="560" y1="40" x2="560" y2="400" stroke="var(--color-magenta)" strokeWidth="1.5" strokeDasharray="5 3" />
        <text x="560" y="34" textAnchor="middle" fill="var(--color-magenta)" fontSize="12" fontWeight="bold">BPFI</text>

        <rect x="421" y="60" width="16" height="340" fill="url(#cscRidgeBall)" rx="3" />
        <line x1="430" y1="60" x2="430" y2="400" stroke="var(--color-accent)" strokeWidth="1.5" strokeDasharray="5 3" />
        <text x="430" y="54" textAnchor="middle" fill="var(--color-accent)" fontSize="12" fontWeight="bold">2·BSF</text>

        <rect x="182" y="120" width="16" height="280" fill="url(#cscRidgeFTF)" rx="3" />
        <line x1="190" y1="120" x2="190" y2="400" stroke="var(--color-good)" strokeWidth="1.2" strokeDasharray="4 3" />
        <text x="190" y="114" textAnchor="middle" fill="var(--color-good)" fontSize="11" fontWeight="bold">FTF</text>

        {[
          { x: 300, color: 'var(--color-warn)', ys: [80, 150, 215, 280, 345] },
          { x: 560, color: 'var(--color-magenta)', ys: [95, 165, 250, 320] },
          { x: 430, color: 'var(--color-accent)', ys: [110, 200, 300] },
          { x: 190, color: 'var(--color-good)', ys: [180, 300] },
          { x: 640, color: 'var(--color-warn)', ys: [180, 280, 350] },
        ].map((r) =>
          r.ys.map((y, j) => (
            <rect key={`cell-${r.x}-${j}`} x={r.x - 5} y={y} width="10" height="10" rx="2" fill={r.color} fillOpacity="0.85" />
          ))
        )}

        <circle cx="360" cy="250" r="4" fill="var(--color-fg-subtle)" />
        <text x="368" y="246" fill="var(--color-fg-subtle)" fontSize="9">
          {es ? 'pico aislado, sin coherencia vertical → rechazado' : 'isolated peak, no vertical coherence → rejected'}
        </text>

        <text x="70" y="478" fill="var(--color-fg)" fontSize="12">
          {es ? 'EES(α) = ⟨|γ(f, α)|⟩_f, marginal integrada en portadora' : 'EES(α) = ⟨|γ(f, α)|⟩_f, carrier-integrated marginal'}
        </text>
        <rect x="70" y="486" width="600" height="64" fill="var(--color-surface)" stroke="var(--color-border)" rx="4" />
        <line x1="70" y1="550" x2="670" y2="550" stroke="var(--color-fg-subtle)" />

        {[
          { x: 190, h: 16, color: 'var(--color-good)' },
          { x: 300, h: 52, color: 'var(--color-warn)' },
          { x: 430, h: 30, color: 'var(--color-accent)' },
          { x: 560, h: 40, color: 'var(--color-magenta)' },
          { x: 640, h: 24, color: 'var(--color-warn)' },
        ].map((p) => (
          <g key={`ees-${p.x}`}>
            <line x1={p.x} y1="550" x2={p.x} y2={550 - p.h} stroke={p.color} strokeWidth="3" />
            <circle cx={p.x} cy={550 - p.h} r="2.5" fill={p.color} />
            <line x1={p.x} y1="486" x2={p.x} y2="400" stroke={p.color} strokeWidth="0.75" strokeDasharray="2 3" strokeOpacity="0.6" />
          </g>
        ))}
        <path d="M70 548 L120 547 L170 549 L220 548 L270 547 L340 549 L400 548 L470 547 L540 549 L620 548 L670 549" fill="none" stroke="var(--color-fg-faint)" strokeWidth="0.75" strokeOpacity="0.7" />
      </svg>

      <Refs ids={['randall2011', 'antoni2007csc', 'antoni2017fastsc', 'carter1973msc', 'borghesani2013', 'borghesani2013ses', 'antoni2006sk', 'smith2015']} label={refsLabel} />
    </div>
  );

  // ============================================================
  // DECOMPOSITION / DECONVOLUTION
  // ============================================================
  const decompTab = (
    <div className="prose">
      <p>{es
        ? 'Una falla localizada es, en su origen, un tren casi periódico de impulsos de fuerza agudos: cada vez que un elemento pasa sobre la picadura se produce un escalón en la fuerza de contacto. Cuando esa fuerza llega al acelerómetro ya ha sido convolucionada con la ruta de transmisión: el impulso hace resonar de forma amortiguada, recoge tonos deterministas de la caja de engranajes y queda enterrado bajo ruido. Dos ataques complementarios recuperan el tren de impulsos. La descomposición divide la señal en una base de componentes y conserva solo el que porta el contenido impulsivo. La deconvolución ciega estima un filtro inverso que deshace la ruta de transmisión, reafilando la resonancia amortiguada hacia los picos originales. Ambos terminan donde termina la cadena en vivo: una banda limpia cuya envolvente de Hilbert se transforma por FFT en un espectro de envolvente donde se lee la línea de falla y sus armónicos.'
        : 'A localized fault is, at the source, a near-periodic train of sharp force impulses: every time an element rolls over the spall it produces a step in the contact force. By the time that force reaches the accelerometer it has been convolved with the transfer path: the impulse rings down a damped resonance, picks up the gearbox’s deterministic tones, and is buried under noise. Two complementary attacks recover the impulse train. Decomposition splits the signal into a basis of components and keeps only the one carrying the impulsive content. Blind deconvolution estimates an inverse filter that undoes the transmission path, re-sharpening the rung-down resonance back toward the original spikes. Both end where the live pipeline ends: a clean band whose Hilbert envelope is FFT’d into an envelope spectrum where the fault line and its harmonics are read off.'}{' '}<Cite id="randall2011" paren /></p>

      <p>{es
        ? 'La demodulación en vivo usa un pasa-banda de pared vertical en el dominio FFT, y el kurtograma encuentra la banda maximizando la curtosis en exceso de la envolvente de Hilbert sobre niveles diádicos 1 a 5. Pero un pasa-banda no puede separar dos fenómenos que comparten la misma banda, ni reformar un transitorio difuminado. Cuando un tono de engrane cae dentro de la mejor banda, o cuando la falla es tan incipiente que sus impulsos son más débiles que el ruido en todas las bandas, la envolvente de banda única queda ambigua. La descomposición y la deconvolución existen para ese régimen: son adaptativas, no fijas, y explotan estructura (impulsividad, periodicidad, cicloestacionariedad) a la que un filtro de pared vertical es ciego.'
        : 'The live demodulation uses a brick-wall band-pass in the FFT domain, and the kurtogram finds the band by maximizing the excess kurtosis of the Hilbert envelope over dyadic levels 1 to 5. But a band-pass cannot separate two phenomena that share the same band, nor reshape a smeared transient. When a gear-mesh tone sits inside the best band, or when the fault is so early that its impulses are weaker than the noise in every band, the single-band envelope is ambiguous. Decomposition and deconvolution exist for that regime: they are adaptive, not fixed, and they exploit structure (impulsiveness, periodicity, cyclostationarity) that a brick-wall filter is blind to.'}{' '}<Cite id="borghesani2013" paren /></p>

      <p>{es
        ? 'Descomposición I, la familia de modo empírico (EMD/EEMD/CEEMDAN). EMD es puramente adaptativa: tamiza la señal interpolando envolventes de spline cúbico por los máximos y mínimos locales, restando su media e iterando hasta una Función de Modo Intrínseco (IMF), un componente con envolvente simétrica e igual número de extremos que de cruces por cero. La IMF que porta la falla es la de mayor curtosis, el mismo criterio de impulsividad del kurtograma. El EMD simple sufre mezcla de modos: un impulso intermitente puede partirse entre IMFs. EEMD lo corrige por asistencia de ruido , agrega muchas realizaciones de ruido blanco, corre EMD en cada una y promedia. CEEMDAN agrega el ruido de forma adaptativa, etapa por etapa, y resta el residual del ensemble en cada paso. El costo honesto: corren decenas de pasadas iterativas, no reproducibles bit-a-bit entre implementaciones, sin teoría cerrada; por eso esta familia es un artefacto precomputado/offline, no una transformada en vivo.'
        : 'Decomposition I, the empirical mode family (EMD/EEMD/CEEMDAN). EMD is purely adaptive: it sifts the signal by interpolating cubic-spline envelopes through local maxima and minima, subtracting their mean, and iterating until an Intrinsic Mode Function (IMF), a component with a symmetric envelope and equal numbers of extrema and zero-crossings. The fault-bearing IMF is the one with the highest kurtosis, the same impulsiveness criterion the kurtogram uses. Plain EMD suffers mode mixing: an intermittent impulse can split across IMFs. EEMD fixes this by noise assistance, adding many white-noise realizations, running EMD on each, and averaging. CEEMDAN adds the noise adaptively, stage by stage, and subtracts the ensemble residual at each step. The honest cost: tens of iterative passes, not bit-reproducible across implementations, no closed-form theory; so this family is a precompute/offline artifact, not a live transform.'}{' '}<Cite id="huang1998emd" paren /> <Cite id="wu2009eemd" paren /> <Cite id="torres2011ceemdan" paren /></p>

      <p>{es
        ? 'Descomposición II, VMD como problema variacional. La Descomposición Variacional de Modos reemplaza el tamizado recursivo por una sola optimización: supone que la señal es suma de K modos, cada uno de banda limitada y compacto en torno a una frecuencia central desconocida ω_k, y pide los modos y centros que minimizan el ancho de banda total sujeto a reconstrucción exacta. El ancho de banda de un modo se mide por la norma L2 al cuadrado del gradiente temporal de la banda base de su señal analítica. Es la misma idea de señal analítica que usa la envolvente de Hilbert, pero convertida en objetivo. El problema con restricción se resuelve por ADMM. El resultado es mucho más robusto al ruido y a la mezcla de modos que EMD porque cada modo es forzado a ser de banda estrecha por construcción. El precio son dos hiper-parámetros: K y la penalización de ancho de banda α. Con K y α fijos, VMD sobre un segmento enventanado es lo bastante liviano para correr en vivo; barrer K/α para autoajustarlos es offline.'
        : 'Decomposition II, VMD as a variational problem. Variational Mode Decomposition replaces the recursive sift with a single optimization: it assumes the signal is a sum of K modes, each band-limited and compact around an unknown center frequency ω_k, and asks for the modes and centers that minimize the total bandwidth subject to exact reconstruction. A mode’s bandwidth is measured by the squared L2 norm of the time-gradient of its analytic-signal baseband. It is the same analytic-signal idea the Hilbert envelope uses, turned into an objective. The constrained problem is solved by ADMM. The result is far more robust to noise and mode mixing than EMD because each mode is forced to be narrow-band by construction. The price is two hyper-parameters: K and the bandwidth penalty α. With K and α fixed, VMD on a windowed segment is light enough to run live; sweeping K/α to auto-tune them is offline.'}{' '}<Cite id="dragomiretskiy2014vmd" paren /></p>

      <p>{es
        ? 'Descomposición III, paquetes wavelet y SSA. La transformada de paquetes wavelet divide en cada nivel tanto la mitad de baja como la de alta frecuencia en un árbol binario uniforme de sub-bandas de igual ancho, a diferencia de la DWT simple. Ese embaldosado uniforme pone resolución fina justo donde están las resonancias del rodamiento, y la banda de falla se elige rankeando nodos por energía o curtosis: la misma lógica diádica-más-curtosis del kurtograma, pero con filtros wavelet de sub-banda apropiados. El Análisis de Espectro Singular toma otra vía: encaja la señal 1-D en una matriz de trayectoria de Hankel, toma su SVD y agrupa las eigentriples; conservar las oscilatorias de alta energía y descartar el ruido aísla el contenido de impacto periódico antes del análisis de envolvente. SSA es no paramétrica e inmune al ruido, pero su SVD sobre una matriz larga es costosa, así que SSA de ventana pequeña es en vivo y la de ventana grande se precomputa.'
        : 'Decomposition III, wavelet packets and SSA. The wavelet packet transform splits both the low- and high-frequency halves at every level into a uniform binary tree of equal-bandwidth sub-bands, unlike the plain DWT. That uniform paving puts fine resolution exactly where bearing resonances sit, and the fault band is chosen by ranking nodes on energy or kurtosis: the same dyadic-band-plus-kurtosis logic as the kurtogram, but with proper wavelet sub-band filters. Singular Spectrum Analysis takes another route: it embeds the 1-D signal into a Hankel trajectory matrix, takes its SVD, and groups the eigentriples; keeping the high-energy oscillatory ones and discarding noise isolates the periodic-impact content before envelope analysis. SSA is non-parametric and noise-immune, but its SVD on a long matrix is costly, so small-window SSA is live and large-window SSA precomputes.'}</p>

      <p>{es
        ? 'Deconvolución ciega I, maximización de curtosis (MED). La Deconvolución de Mínima Entropía diseña un filtro FIR f para que la salida y = f * x sea máximamente impulsiva, medida por curtosis. La premisa es el argumento de ruta inversa: la fuente era puntiaguda, la ruta la difuminó, así que el filtro que vuelve a hacer la salida puntiaguda aproxima la inversa de la ruta. Se resuelve como iteración de punto fijo y es totalmente ciego: no necesita el período de falla. Su falla característica es el reverso de su premisa: con un filtro largo, la curtosis se maximiza con un pico gigante, así que MED colapsa el tren periódico en un solo impulso y un pico eléctrico espurio puede capturar todo el filtro.'
        : 'Blind deconvolution I, kurtosis maximization (MED). Minimum Entropy Deconvolution designs an FIR filter f so the output y = f * x is maximally impulsive, measured by kurtosis. The premise is the inverse-path argument: the source was spiky, the path blurred it, so the filter that makes the output spiky again approximates the path’s inverse. It is solved as a fixed-point iteration and is fully blind: it needs no fault period. Its signature failure is the flip side of its premise: with a long filter, kurtosis is maximized by one giant spike, so MED collapses the periodic train onto a single impulse and a stray electrical spike can capture the whole filter.'}{' '}<Cite id="wiggins1978med" paren /></p>

      <p>{es
        ? 'Deconvolución ciega II, apuntar al período (MCKD, MOMEDA, CYCBD). El arreglo es premiar la salida por ser puntiaguda y repetirse al período de falla. MCKD reemplaza la curtosis por curtosis correlacionada a un período T y orden de desplazamiento M: multiplica la salida por copias desplazadas de sí misma separadas T, de modo que un solo impulso no puntúa. Cura el colapso de MED, pero es semi-ciego: hay que entregar T. MOMEDA convierte el diseño en una sola resolución de forma cerrada: especifica un tren de impulsos objetivo y resuelve directamente, sin iteración. Como cada período es una resolución matricial, se puede barrer el período supuesto y graficar un espectro MOMEDA cuyos picos revelan el período en vez de asumirlo. CYCBD vuelve a cambiar el objetivo: maximiza la cicloestacionariedad de segundo orden en frecuencias cíclicas objetivo, como problema de autovalores generalizado. Es el más fiel físicamente, porque un tren de falla real tiene pequeño jitter de período (deslizamiento) , el modelo sintético inyecta justo eso, ~0.5% por intervalo,  y CYCBD apunta a esa estructura directamente.'
        : 'Blind deconvolution II, targeting the period (MCKD, MOMEDA, CYCBD). The fix is to reward the output for being spiky and repeating at the fault period. MCKD replaces kurtosis with correlated kurtosis at a period T and shift order M: it multiplies the output by shifted copies of itself spaced T apart, so a single impulse scores nothing. This cures MED’s collapse, but it is semi-blind: you must supply T. MOMEDA turns the design into a single closed-form solve: it specifies a target impulse train and solves directly, with no iteration. Because each period is one matrix solve, you can scan the assumed period and plot a MOMEDA spectrum whose peaks reveal the period rather than assuming it. CYCBD changes the objective again: it maximizes second-order cyclostationarity at target cyclic frequencies, as a generalized eigenvalue problem. It is the most physically faithful, because a real fault train has small period jitter (slip), the synthetic model injects exactly that, ~0.5% per interval, and CYCBD targets that structure directly.'}{' '}<Cite id="mcdonald2012mckd" paren /> <Cite id="mcdonald2017momeda" paren /> <Cite id="buzzoni2018cycbd" paren /></p>

      <Callout variant="honest" title={es ? 'La escalera de criterios y qué es exacto vs ilustrativo' : 'The criterion ladder and what is exact vs illustrative'}>
        <p>{es
          ? 'Cada método termina eligiendo un componente o un filtro, por un criterio cuantitativo. La curtosis simple solo pregunta si es impulsivo: barata, totalmente ciega, pero no distingue un impulso de falla de un pico eléctrico. La curtosis correlacionada y la norma-D de MOMEDA preguntan si es impulsivo y periódico a este período: más específicas, pero necesitan el período. La cicloestacionariedad (el indicador de CYCBD, y la coherencia espectral cíclica que este build calcula como una Correlación Espectral Rápida, Fast-SC) pregunta si su energía está organizada en esta frecuencia cíclica: la más específica, pero necesita la frecuencia cíclica. La salvedad honesta: los métodos más potentes (MCKD, el modo objetivo de MOMEDA, CYCBD) no son totalmente ciegos , requieren la frecuencia o período de falla, que aquí se calcula desde la geometría del rodamiento y la velocidad del eje vía las relaciones cinemáticas (BPFO, BPFI, BSF, FTF). Esas relaciones son física exacta y transferible; la severidad sintética y las amplitudes de impulso resultantes están modeladas, no medidas. El diagnóstico aguas abajo no cambia según qué front-end produjo la banda limpia: prominencia por armónico promediada sobre los primeros cinco, con umbral absoluto de 4.5 y margen relativo de 1.7 sobre la siguiente falla como control negativo.'
          : 'Each method ends by choosing one component or one filter, by a quantitative criterion. Plain kurtosis asks only whether it is impulsive: cheap, fully blind, but it cannot tell a fault impulse from an electrical spike. Correlated kurtosis and the MOMEDA D-norm ask whether it is impulsive and periodic at this period: more specific, but they need the period. Cyclostationarity (the CYCBD indicator, and the cyclic spectral coherence this build computes as a Fast Spectral Correlation, Fast-SC) asks whether its energy is organized at this cyclic frequency: the most specific, but it needs the cyclic frequency. The honest caveat: the most powerful methods (MCKD, MOMEDA’s targeted mode, CYCBD) are not fully blind, they require the fault frequency or period, which here is computed from bearing geometry and shaft speed via the kinematic relations (BPFO, BPFI, BSF, FTF). Those relations are exact, transferable physics; the synthetic severity and resulting impulse amplitudes are modeled, not measured. The downstream diagnosis is unchanged regardless of which front-end produced the clean band: per-harmonic prominence averaged over the first five, gated at an absolute prominence of 4.5 and a relative margin of 1.7 over the next-best fault as a negative control.'}</p>
      </Callout>

      <p>{es
        ? 'Qué es en vivo versus precomputado en este build: la línea divisoria es si el trabajo son unas pocas FFTs o una resolución iterativa/SVD/ensemble sobre un registro largo. En vivo: el pasa-banda, la envolvente de Hilbert por señal analítica, el espectro de magnitud, el kurtograma sobre niveles 1–5, la curtosis espectral por STFT, el cepstrum, el espectrograma y la correlación espectral rápida (Fast-SC, con prewhitening AR) , todas cadenas FFT radix-2; VMD de parámetros fijos y SSA de ventana pequeña también. Precomputado: EMD/EEMD/CEEMDAN, MCKD/CYCBD, barridos finos de período de MOMEDA, la correlación espectral cíclica sobre una grilla densa de (f,α) completa, y cualquier barrido de autoajuste. La regla: en el momento en que un método necesita iterar hasta converger, factorizar una matriz grande o barrer una grilla de parámetros, abandona el nivel interactivo y se vuelve un resultado precomputado que la página muestra.'
        : 'What is live versus precompute in this build: the dividing line is whether the work is a few FFTs or an iterative/SVD/ensemble solve on a long record. Live: the band-pass, the analytic-signal Hilbert envelope, the magnitude spectrum, the kurtogram over levels 1–5, the spectral kurtosis via STFT, the cepstrum, the spectrogram, and the Fast Spectral Correlation (Fast-SC, with AR prewhitening), all radix-2 FFT pipelines; fixed-parameter VMD and small-window SSA too. Precompute: EMD/EEMD/CEEMDAN, MCKD/CYCBD, MOMEDA fine period scans, the cyclic spectral correlation over a full dense (f,α) grid, and any auto-tuning sweep. The rule: the moment a method needs to iterate to convergence, factorize a large matrix, or sweep a parameter grid, it leaves the interactive tier and becomes a precomputed result the page displays.'}</p>

      <Equation tex={String.raw`\hat{f} = \arg\max_{f}\; K(y),\quad y = f * x \qquad\text{(MED, fully blind)}`} caption={es ? 'MED: ningún período de falla aparece; puede colapsar en un solo impulso' : 'MED: no fault period appears; it can collapse onto a single impulse'} />

      <Equation tex={String.raw`\mathrm{CK}_M(T) = \frac{\sum_{n=1}^{N}\left(\prod_{m=0}^{M} y_{n-mT}\right)^{2}}{\left(\sum_{n=1}^{N} y_n^{2}\right)^{M+1}},\qquad \hat{f} = \arg\max_{f}\;\mathrm{CK}_M(T)`} caption={es ? 'MCKD: curtosis correlacionada al período T (semi-ciego); T ≈ fs/f_falla, M = orden de desplazamiento' : 'MCKD: correlated kurtosis at period T (semi-blind); T ≈ fs/f_fault, M = shift order'} />

      <Equation tex={String.raw`\hat{f} = \arg\max_{f}\;\frac{\mathbf{t}^{\top}\mathbf{y}}{\lVert \mathbf{y}\rVert},\ \ \mathbf{y}=X^{\top}f \ \Longrightarrow\ \hat{f} = (XX^{\top})^{-1} X\,\mathbf{t}`} caption={es ? 'MOMEDA: norma-D multipunto, resolución cerrada; t = tren objetivo, X = matriz de Hankel de x' : 'MOMEDA: multipoint D-norm, closed-form solve; t = target train, X = Hankel matrix of x'} />

      <Equation tex={String.raw`\min_{\{u_k\},\{\omega_k\}}\;\sum_{k=1}^{K}\Bigl\lVert \partial_t\!\left[\Bigl(\delta(t)+\tfrac{j}{\pi t}\Bigr)* u_k(t)\;e^{-j\omega_k t}\right]\Bigr\rVert_2^2 \quad\text{s.t.}\ \sum_{k=1}^{K} u_k(t)=x(t)`} caption={es ? 'VMD: K modos de banda limitada vía ADMM; u_k = modo k, ω_k = centro, K = nº de modos' : 'VMD: K band-limited modes via ADMM; u_k = mode k, ω_k = center, K = number of modes'} />

      {/* ===== Decomposition vs deconvolution ===== */}
      <svg
        viewBox="0 0 900 560"
        width="100%"
        role="img"
        aria-labelledby="decompTitle decompDesc"
        style={{ fontFamily: 'var(--font-mono)', display: 'block' }}
      >
        <title id="decompTitle">
          {es ? 'Recuperar el tren de impulsos de falla: descomposición versus deconvolución ciega' : 'Recovering the fault impulse train: decomposition versus blind deconvolution'}
        </title>
        <desc id="decompDesc">
          {es
            ? 'Una señal débil y ruidosa se procesa por dos vías paralelas. La izquierda descompone la señal en modos de banda limitada y conserva el más impulsivo (seleccionado por curtosis). La derecha estima un filtro inverso que reafila la resonancia difuminada en impulsos. Ambas convergen a un tren de impulsos periódico leído por el espectro de envolvente.'
            : 'A weak, noisy signal is processed along two parallel paths. The left decomposes the signal into band-limited modes and keeps the most impulsive one (kurtosis-selected). The right estimates an inverse filter that re-sharpens the smeared resonance into impulses. Both converge to a periodic impulse train read by the envelope spectrum.'}
        </desc>

        <defs>
          <marker id="dArrow" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L7,3 L0,6 Z" fill="var(--color-fg-subtle)" />
          </marker>
        </defs>

        <g transform="translate(20,40)">
          <text x="120" y="-16" textAnchor="middle" fill="var(--color-fg)" fontSize="15" fontWeight="700">{es ? 'Entrada: señal débil, enmascarada' : 'Input: weak, masked signal'}</text>
          <rect x="0" y="0" width="240" height="86" rx="6" fill="var(--color-surface)" stroke="var(--color-border)" />
          <polyline fill="none" stroke="var(--color-fg-faint)" strokeWidth="1.2"
            points="6,43 16,30 22,55 30,38 38,60 44,28 52,50 60,35 68,58 76,33 84,52 92,40 100,30 108,57 116,36 124,54 132,29 140,49 148,38 156,58 164,32 172,53 180,41 188,30 196,56 204,37 212,55 220,34 228,50 234,43" />
          <text x="120" y="78" textAnchor="middle" fill="var(--color-fg-subtle)" fontSize="11">{es ? 'decaimiento de resonancia + tonos de eje + ruido' : 'resonance ring-down + shaft tones + Gaussian noise'}</text>
        </g>

        <line x1="140" y1="166" x2="140" y2="196" stroke="var(--color-fg-subtle)" strokeWidth="1.4" />
        <path d="M140,196 L300,196 L300,224" fill="none" stroke="var(--color-fg-subtle)" strokeWidth="1.4" markerEnd="url(#dArrow)" />
        <path d="M140,196 L620,196 L620,224" fill="none" stroke="var(--color-fg-subtle)" strokeWidth="1.4" markerEnd="url(#dArrow)" />

        {/* LEFT, DECOMPOSITION */}
        <g transform="translate(190,232)">
          <rect x="0" y="0" width="230" height="208" rx="8" fill="var(--color-surface)" stroke="var(--color-accent)" strokeWidth="1.5" />
          <text x="115" y="22" textAnchor="middle" fill="var(--color-accent)" fontSize="14" fontWeight="700">{es ? 'Descomposición' : 'Decomposition'}</text>
          <text x="115" y="40" textAnchor="middle" fill="var(--color-fg-subtle)" fontSize="10.5">EMD / EEMD / CEEMDAN · VMD · WPT · SSA</text>

          <g transform="translate(16,54)">
            <text x="0" y="0" fill="var(--color-fg-subtle)" fontSize="10">{es ? 'modo 1' : 'mode 1'}</text>
            <polyline fill="none" stroke="var(--color-fg-faint)" strokeWidth="1.1" points="46,-4 66,-12 86,-2 106,-10 126,-3 146,-11 166,-4 186,-9 198,-5" />
            <text x="0" y="40" fill="var(--color-fg)" fontSize="10" fontWeight="700">{es ? 'modo 2' : 'mode 2'}</text>
            <polyline fill="none" stroke="var(--color-good)" strokeWidth="1.6" points="46,36 56,36 58,18 60,36 96,36 98,16 100,36 136,36 138,17 140,36 176,36 178,18 180,36 198,36" />
            <rect x="40" y="8" width="162" height="36" rx="4" fill="none" stroke="var(--color-good)" strokeDasharray="3 3" />
            <text x="0" y="78" fill="var(--color-fg-subtle)" fontSize="10">{es ? 'modo 3' : 'mode 3'}</text>
            <polyline fill="none" stroke="var(--color-fg-faint)" strokeWidth="1.1" points="46,72 70,68 94,76 118,69 142,75 166,70 190,74 198,72" />
          </g>

          <text x="115" y="158" textAnchor="middle" fill="var(--color-good)" fontSize="10.5" fontWeight="700">{es ? 'elegir modo de curtosis máx' : 'select max-kurtosis mode'}</text>
          <text x="115" y="176" textAnchor="middle" fill="var(--color-fg-subtle)" fontSize="10">{es ? 'K(modo 2) ≫ K(modo 1,3)' : 'K(mode 2) ≫ K(mode 1,3)'}</text>
          <text x="115" y="194" textAnchor="middle" fill="var(--color-fg-subtle)" fontSize="9.5">{es ? 'VMD min Σ ancho s.t. Σuₖ = x' : 'VMD min Σ bandwidth s.t. Σuₖ = x'}</text>
        </g>

        {/* RIGHT, DECONVOLUTION */}
        <g transform="translate(510,232)">
          <rect x="0" y="0" width="230" height="208" rx="8" fill="var(--color-surface)" stroke="var(--color-magenta)" strokeWidth="1.5" />
          <text x="115" y="22" textAnchor="middle" fill="var(--color-magenta)" fontSize="14" fontWeight="700">{es ? 'Deconvolución ciega' : 'Blind deconvolution'}</text>
          <text x="115" y="40" textAnchor="middle" fill="var(--color-fg-subtle)" fontSize="10.5">MED · MCKD · MOMEDA · CYCBD</text>

          <g transform="translate(14,58)">
            <text x="0" y="6" fill="var(--color-fg-subtle)" fontSize="10">{es ? 'x (difuminada)' : 'x (smeared)'}</text>
            <polyline fill="none" stroke="var(--color-fg-faint)" strokeWidth="1.3" points="0,28 14,18 22,34 30,22 40,34 52,16 64,32 76,22 88,34 100,24 112,32 124,20 136,33 148,24 160,33 172,22 184,32 198,28" />
            <g transform="translate(74,44)">
              <rect x="0" y="0" width="52" height="22" rx="4" fill="var(--color-bg)" stroke="var(--color-magenta)" />
              <text x="26" y="15" textAnchor="middle" fill="var(--color-magenta)" fontSize="11" fontWeight="700">f * x</text>
            </g>
            <line x1="100" y1="38" x2="100" y2="44" stroke="var(--color-fg-subtle)" strokeWidth="1.2" markerEnd="url(#dArrow)" />
            <line x1="100" y1="66" x2="100" y2="74" stroke="var(--color-fg-subtle)" strokeWidth="1.2" markerEnd="url(#dArrow)" />
            <text x="0" y="92" fill="var(--color-magenta)" fontSize="10" fontWeight="700">{es ? 'y (afilada)' : 'y (sharp)'}</text>
            <polyline fill="none" stroke="var(--color-magenta)" strokeWidth="1.7" points="0,116 18,116 20,84 22,116 58,116 60,84 62,116 98,116 100,84 102,116 138,116 140,84 142,116 178,116 180,84 182,116 198,116" />
          </g>

          <text x="115" y="194" textAnchor="middle" fill="var(--color-magenta)" fontSize="9.5" fontWeight="700">{es ? 'max: curtosis · CK a T · cicloest. a α' : 'maximize: kurtosis · CK at T · cyclostat. at α'}</text>
        </g>

        <path d="M305,440 L305,476 L450,476 L450,496" fill="none" stroke="var(--color-fg-subtle)" strokeWidth="1.4" markerEnd="url(#dArrow)" />
        <path d="M625,440 L625,476 L450,476" fill="none" stroke="var(--color-fg-subtle)" strokeWidth="1.4" />

        <g transform="translate(250,500)">
          <rect x="0" y="0" width="400" height="50" rx="6" fill="var(--color-surface)" stroke="var(--color-good)" strokeWidth="1.6" />
          <line x1="14" y1="42" x2="386" y2="42" stroke="var(--color-border)" strokeWidth="1" />
          {[40, 110, 180, 250, 320].map((x, i) => (
            <g key={i}>
              <line x1={x} y1="42" x2={x} y2="12" stroke="var(--color-good)" strokeWidth="2.4" />
              <circle cx={x} cy="12" r="2.4" fill="var(--color-good)" />
            </g>
          ))}
          <line x1="110" y1="46" x2="180" y2="46" stroke="var(--color-fg-subtle)" strokeWidth="1" />
          <text x="145" y="44" textAnchor="middle" fill="var(--color-fg-subtle)" fontSize="10">T = 1/f₀</text>
          <text x="386" y="30" textAnchor="end" fill="var(--color-good)" fontSize="12" fontWeight="700">{es ? 'tren limpio → espectro de envolvente' : 'clean impulse train → envelope spectrum'}</text>
        </g>

        <text x="450" y="556" textAnchor="middle" fill="var(--color-fg-subtle)" fontSize="10">
          {es
            ? 'escalera de criterios: curtosis (ciego) → curtosis correlacionada a T (semi-ciego) → cicloestacionariedad a α (necesita f₀)'
            : 'criterion ladder: kurtosis (blind) → correlated kurtosis at T (semi-blind) → cyclostationarity at α (needs f₀)'}
        </text>
      </svg>

      <Refs ids={['randall2011', 'huang1998emd', 'wu2009eemd', 'torres2011ceemdan', 'dragomiretskiy2014vmd', 'wiggins1978med', 'mcdonald2012mckd', 'mcdonald2017momeda', 'buzzoni2018cycbd', 'borghesani2013']} label={refsLabel} />
    </div>
  );

  // ============================================================
  // PROGNOSTICS / RUL + ISO
  // ============================================================
  const rulTab = (
    <div className="prose">
      <p>{es
        ? 'El diagnóstico responde qué falla; el pronóstico responde en cuánto tiempo importará. Ambos requieren colapsar un registro de vibración de alta dimensión en unos pocos escalares que se muevan monótonamente con el daño. Este build construye su indicador de salud (HI) a partir de estadísticas en el dominio del tiempo. El valor cuadrático medio RMS(x) = √(media(xᵢ²)) sigue la energía total de vibración y sube tarde, una vez que el defecto se extiende; la curtosis sigue la impulsividad y sube temprano, cuando un solo descascarillado produce impactos agudos y dispersos, y luego paradójicamente vuelve a caer hacia 3 a medida que el daño se extiende y los impactos se funden en un rugido casi gaussiano. Una tendencia de curtosis espectral combina ambas virtudes: permanece sensible a impactos localizados incluso después de que el RMS de banda ancha se haya saturado. La lección práctica, que esta implementación respeta, es que ningún HI es monótono durante toda la vida, por lo que el modelo de pronóstico se ajusta solo al segmento tardío y monótono posterior al inicio.'
        : 'Diagnosis answers what is wrong; prognosis answers how long until it matters. Both must collapse a high-dimensional vibration record into a few scalars that move monotonically with damage. This build constructs its health indicator (HI) from time-domain statistics. The root-mean-square RMS(x) = √(mean(xᵢ²)) tracks the total vibration energy and rises late, once a defect has spread; kurtosis tracks impulsiveness and rises early, when a single spall still produces sharp, sparse impacts, then paradoxically falls back toward 3 as the damage spreads and the impacts merge into a near-Gaussian roar. A spectral-kurtosis trend combines both virtues: it stays sensitive to localized impacts even after broadband RMS has saturated. The practical lesson, which this implementation honors, is that no single HI is monotone over the whole life, so the prognostic model is fit only to the late, monotone segment after onset.'}{' '}<Cite id="lei2018" paren /> <Cite id="smith2015" paren /></p>

      <p>{es
        ? 'Un rodamiento pasa la mayor parte de su vida en una línea base plana y ruidosa donde no hay nada que extrapolar. Por eso la primera decisión de pronóstico es: ¿cuándo comienza la degradación? Es un problema de punto de cambio, y la literatura ofrece desde CUSUM y modelos bayesianos hasta la regla simple pero robusta de excedencia de línea base + kσ. Este build usa esta última, deliberadamente conservadora. Toma los primeros max(4, ⌊0.3n⌋) puntos como línea base sana, calcula su media μ y desviación σ, y declara el inicio en el primer índice donde dos puntos consecutivos superan μ + 4σ. El requisito de dos seguidos es la clave: un solo pico de 4σ casi siempre es un transitorio, y actuar sobre él produce falsas alarmas que destruyen la confianza del operador. Exigir una excursión sostenida convierte un umbral ruidoso en un detector de inicio utilizable. Hasta que se dispara el inicio, la función no devuelve proyección alguna , una máquina sana correctamente no produce ningún número de RUL, que es el comportamiento honesto.'
        : 'A bearing spends most of its life on a flat, noisy baseline where there is nothing to extrapolate. So the first prognostic decision is: when does degradation begin? This is a change-point problem, and the literature offers everything from CUSUM and Bayesian models to the simple but robust baseline + kσ exceedance rule. This build uses the latter, deliberately conservative. It takes the first max(4, ⌊0.3n⌋) points as the healthy baseline, computes their mean μ and standard deviation σ, and declares onset at the first index where two consecutive points exceed μ + 4σ. The two-in-a-row requirement is the whole point: a single 4σ spike is almost always a transient, and acting on it produces false alarms that destroy operator trust. Requiring a sustained excursion turns a noisy threshold into a usable onset detector. Until onset fires, the function returns no projection, a healthy machine correctly yields no RUL number, which is the honest behavior.'}</p>

      <p>{es
        ? 'Una vez detectado el inicio, el HI debe proyectarse hacia un umbral de fallo. La literatura ofrece una escalera de modelos de potencia y coste crecientes: un ajuste exponencial/ley de potencia simple; crecimiento de grieta por ley de Paris, físicamente fundamentado pero que requiere observar el tamaño de grieta; filtros de partículas y regresión por procesos gaussianos, que portan una posterior completa y producen incertidumbre dependiente del estado; y redes deep-RUL (LSTM/CNN) que aprenden el mapeo HI→RUL de muchas trayectorias. Cada peldaño compra incertidumbre mejor calibrada a costa de más datos y cómputo. Este build ajusta el modelo fundacional en la base de esa escalera, elegido porque es transparente, tiene tiempo de cruce en forma cerrada y coincide con el crecimiento exponencial de fin de vida empíricamente reportado para rodamientos. En concreto: sobre los puntos posteriores al inicio realiza mínimos cuadrados en espacio logarítmico, ln(HI) = ln a + b·t, que es exactamente un ajuste lineal. Ajustar en espacio log es deliberado: hace la optimización lineal y estable, y hace la dispersión residual multiplicativa, el modelo de ruido realista para una cantidad que crece en órdenes de magnitud. El modelo solo se acepta si la tasa de crecimiento b > 0; una pendiente no positiva significa que no está degradándose, y el build se niega a emitir un RUL ficticio.'
        : 'Once onset is detected, the HI must be projected toward a failure threshold. The literature offers a ladder of models of increasing power and cost: a simple exponential/power-law fit; Paris-law crack growth, physically grounded but needing a crack-size observable; particle filters and Gaussian-process regression, which carry a full posterior and produce state-dependent uncertainty; and deep-RUL networks (LSTM/CNN) that learn the HI→RUL map from many trajectories. Each step up buys better-calibrated uncertainty at the cost of more data and compute. This build fits the foundational model at the bottom of that ladder, chosen because it is transparent, has a closed-form crossing time, and matches the empirically exponential late-life growth reported for bearings. Concretely: on the post-onset points it does ordinary least squares in log space, ln(HI) = ln a + b·t, which is exactly a linear fit. Fitting in log space is deliberate: it makes the optimization linear and stable, and makes the residual spread multiplicative, the realistic noise model for a quantity that grows by orders of magnitude. The model is only accepted if the growth rate b > 0; a non-positive slope means not actually degrading, and the build refuses to emit a fictitious RUL.'}{' '}<Cite id="wang2020xjtu" paren /></p>

      {/* Prognostic models, four approaches of increasing complexity */}
      <svg viewBox="0 0 780 340" width="100%" role="img" aria-labelledby="rulModelsTitle rulModelsDesc" style={{ fontFamily: 'var(--font-mono)', margin: '1rem 0' }}>
        <title id="rulModelsTitle">{es ? 'Modelos de pronóstico' : 'Prognostic models'}</title>
        <desc id="rulModelsDesc">
          {es
            ? 'Cuatro modelos de complejidad creciente. Exponencial: ajuste por MCO en espacio log (forma cerrada, transparente). Filtro de partículas SIR bayesiano (posterior completa, 500 partículas). Proceso gaussiano con kernel RBF (incertidumbre calibrada, bandas ±1.645σ). CNN-BiLSTM (Deep-HI/RUL) que aprende el mapeo HI→RUL de múltiples trayectorias, inferido vía ONNX en vivo.'
            : 'Four models of increasing complexity. Exponential: OLS fit in log space (closed-form, transparent). Bayesian SIR particle filter (full posterior, 500 particles). Gaussian process with RBF kernel (calibrated uncertainty, ±1.645σ bands). CNN-BiLSTM (Deep-HI/RUL) learning the full HI→RUL map from multiple trajectories, inferred live via ONNX.'}
        </desc>
        <rect x="0" y="0" width="780" height="340" fill="var(--color-bg)" />
        {/* Models ordered by complexity */}
        <line x1="60" y1="290" x2="60" y2="55" stroke="var(--color-fg-faint)" strokeWidth="2" markerEnd="url(#ladArrow)" />
        <text x="30" y="175" textAnchor="middle" fontSize="10" fill="var(--color-fg-faint)" transform="rotate(-90 30 175)">
          {es ? 'complejidad · cómputo · datos' : 'complexity · compute · data'}
        </text>
        {/* 1: Exponential */}
        <rect x="90" y="270" width="660" height="52" rx="8" fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth="1.5" />
        <rect x="100" y="278" width="6" height="36" rx="3" fill="var(--color-fg-subtle)" />
        <text x="120" y="294" fontSize="13" fontWeight="700" fill="var(--color-fg)">{es ? '1. Exponencial (MCO en log)' : '1. Exponential (log-space OLS)'}</text>
        <text x="120" y="312" fontSize="10.5" fill="var(--color-fg-subtle)">{es ? 'Forma cerrada · tiempo de cruce invertible · residual multiplicativo ±2σ · línea base del benchmark' : 'Closed-form · invertible crossing time · multiplicative ±2σ residual · benchmark baseline'}</text>
        <text x="730" y="302" textAnchor="end" fontSize="10" fill="var(--color-fg-faint)">{es ? 'MAE: en re-evaluación' : 'MAE: under re-evaluation'}</text>
        {/* Rung 2: PF */}
        <rect x="90" y="202" width="660" height="52" rx="8" fill="var(--color-surface)" stroke="var(--color-accent)" strokeWidth="1.5" />
        <rect x="100" y="210" width="6" height="36" rx="3" fill="var(--color-accent)" />
        <text x="120" y="226" fontSize="13" fontWeight="700" fill="var(--color-fg)">{es ? '2. Filtro de Partículas (SIR bayesiano)' : '2. Particle Filter (Bayesian SIR)'}</text>
        <text x="120" y="244" fontSize="10.5" fill="var(--color-fg-subtle)">{es ? '500 partículas · remuestreo sistemático · regularización kernel · posterior completa no paramétrica · P10/P50/P90' : '500 particles · systematic resampling · kernel regularisation · full non-parametric posterior · P10/P50/P90'}</text>
        <text x="730" y="234" textAnchor="end" fontSize="10" fill="var(--color-fg-faint)">{es ? 'MAE: en re-evaluación' : 'MAE: under re-evaluation'}</text>
        {/* Rung 3: GP */}
        <rect x="90" y="134" width="660" height="52" rx="8" fill="var(--color-surface)" stroke="var(--color-warn)" strokeWidth="1.5" />
        <rect x="100" y="142" width="6" height="36" rx="3" fill="var(--color-warn)" />
        <text x="120" y="158" fontSize="13" fontWeight="700" fill="var(--color-fg)">{es ? '3. Proceso Gaussiano (kernel RBF + media OLS)' : '3. Gaussian Process (RBF kernel + OLS mean)'}</text>
        <text x="120" y="176" fontSize="10.5" fill="var(--color-fg-subtle)">{es ? 'Cholesky · búsqueda en grilla (ℓ, σₙ≥0.12) · bandas ±1.645σ con cobertura · forward cap exponencial' : 'Cholesky · grid search (ℓ, σₙ≥0.12) · ±1.645σ bands with coverage · exponential forward cap'}</text>
        <text x="730" y="166" textAnchor="end" fontSize="10" fill="var(--color-fg-faint)">{es ? 'MAE: en re-evaluación' : 'MAE: under re-evaluation'}</text>
        {/* Rung 4: Deep-RUL */}
        <rect x="90" y="48" width="660" height="70" rx="8" fill="var(--color-surface)" stroke="var(--color-good)" strokeWidth="2" />
        <rect x="100" y="56" width="6" height="54" rx="3" fill="var(--color-good)" />
        <text x="120" y="74" fontSize="13" fontWeight="700" fill="var(--color-fg)">{es ? '4. CNN-BiLSTM (Deep-HI / Deep-RUL), aprendido extremo a extremo' : '4. CNN-BiLSTM (Deep-HI / Deep-RUL), end-to-end learned'}</text>
        <text x="120" y="94" fontSize="10.5" fill="var(--color-fg-subtle)">{es ? 'WDCNN + BiLSTM(2×128) · 18 trayectorias XJTU-SY+FEMTO · 150 épocas · ONNX opset 14 (3.4 MB) · onnxruntime-web WASM en vivo' : 'WDCNN + BiLSTM(2×128) · 18 XJTU-SY+FEMTO trajectories · 150 epochs · ONNX opset 14 (3.4 MB) · live onnxruntime-web WASM'}</text>
        <text x="120" y="112" fontSize="10" fill="var(--color-fg-subtle)">{es ? 'A diferencia del WDCNN que clasifica UNA ventana, la BiLSTM aprende el "cuándo" de la degradación en la secuencia temporal' : 'Unlike the WDCNN classifying ONE window, the BiLSTM learns the "when" of degradation in the temporal sequence'}</text>
        <text x="730" y="90" textAnchor="end" fontSize="10" fill="var(--color-good)">{es ? 'pendiente' : 'pending'}</text>
        <defs>
          <marker id="ladArrow" viewBox="0 0 10 10" refX="5" refY="9" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L5 10 L10 0 z" fill="var(--color-fg-faint)" />
          </marker>
        </defs>
      </svg>

      <p>{es
        ? 'Con ln a y b en mano, el tiempo de fallo es el primer cruce de la curva media por el umbral HI_thr, que se invierte en forma cerrada: t_fail = (ln HI_thr − ln a)/b, y la vida útil remanente en la última observación es RUL = t_fail − t_now (fijada a cero si la curva ya cruzó). La banda de incertidumbre se construye a partir de la dispersión del residuo logarítmico: tras el ajuste se calcula la desviación estándar residual s = √(RSS/(m−2)) en escala log (el divisor m−2 es la corrección correcta de grados de libertad para un ajuste de dos parámetros), y luego se dibuja el abanico como exp(ln_mid ± 2s) en cada tiempo futuro. Como la banda es ±2σ en escala multiplicativa, es asimétrica en unidades lineales y se ensancha con el tiempo , exactamente la forma de la incertidumbre física cuando la propia tasa de crecimiento es incierta. El abanico se dibuja hasta ~1.15·t_fail, de modo que el cruce del umbral de las trazas inferior, central y superior enmarca un rango de tiempos de fallo plausibles en vez de un único instante de falsa precisión.'
        : 'With ln a and b in hand, the failure time is the first passage of the mean curve through the threshold HI_thr, which inverts in closed form: t_fail = (ln HI_thr − ln a)/b, and the remaining useful life at the last observation is RUL = t_fail − t_now (clamped to zero if the curve has already crossed). The uncertainty band is built from the log-residual spread: after fitting, the residual standard deviation s = √(RSS/(m−2)) on the log scale (the m−2 divisor is the correct degrees-of-freedom correction for a two-parameter fit), then the fan is drawn as exp(ln_mid ± 2s) at each future time. Because the band is ±2σ on a multiplicative scale, it is asymmetric in linear units and widens with time, exactly the shape physical uncertainty takes when a growth rate is itself uncertain. The fan is drawn forward to roughly 1.15·t_fail, so the threshold crossing of the lower, central, and upper traces brackets a range of plausible failure times rather than a single false-precision instant.'}</p>

      <Callout variant="honest" title={es ? 'La banda debe calibrarse y el umbral mismo es difuso' : 'The band must be calibrated and the threshold itself is fuzzy'}>
        <p>{es
          ? 'Un modo de fallo común y peligroso de las pantallas de RUL es un pronóstico demasiado confiado: una banda finísima que cruza el umbral en una hora nítida parece autoritativa pero casi siempre es falsa, porque ignora la incertidumbre dominante , que la tasa de crecimiento b se estimó de un puñado de puntos ruidosos. La banda de este build es honesta en dirección (se deriva de residuos reales y se ensancha), pero un despliegue en producción debe calibrarla: la cobertura empírica de la banda ±2σ debe verificarse contra trayectorias retenidas, de modo que el 95% de los fallos reales caiga dentro del abanico nominal del 95%. Igualmente, el umbral de fallo no es una constante física: ISO y la experiencia dan una región, no una línea, así que el umbral debe tratarse como difuso y el RUL reportarse como una distribución sobre tiempos de cruce. Los hechos exactos y transferibles son las relaciones de frecuencia (BPFO/BPFI/BSF a partir de geometría y velocidad de eje) y la forma del modelo; la severidad específica, los tiempos de inicio y los valores de RUL de la demostración son números sintéticos ilustrativos de un generador etiquetado, donde la severidad provoca un inicio más temprano y un crecimiento más rápido, y un caso sano no produce proyección , nunca mediciones de campo.'
          : 'A common and dangerous failure mode of RUL displays is a forecast that is too confident: a razor-thin band crossing the threshold at one crisp hour looks authoritative but is almost always fake, because it ignores the dominant uncertainty, that the growth rate b was estimated from a handful of noisy points. This build’s band is honest in direction (it is derived from real residuals and it widens), but a production deployment must calibrate it: the empirical coverage of the ±2σ band should be checked against held-out trajectories so that 95% of true failures actually fall inside the nominal 95% fan. Equally, the failure threshold is not a physical constant: ISO and bearing experience give a region, not a line, so the threshold should be treated as fuzzy and the RUL reported as a distribution over crossing times. The transferable, exact facts are the frequency relations (BPFO/BPFI/BSF from geometry and shaft speed) and the form of the model; the specific severity, onset times, and RUL values in the demonstration are illustrative synthetic numbers from a labeled generator, where severity drives an earlier onset and faster growth, and a healthy case yields no projection, never field measurements.'}{' '}<Cite id="randall2011" paren /></p>
      </Callout>

      <p>{es
        ? 'El pronóstico proyecta una tendencia; la capa de decisión ISO juzga el presente contra una escala acordada internacionalmente, y ambas son complementarias. La norma de severidad vigente (que reemplaza a su predecesora) evalúa la velocidad RMS de vibración de banda ancha en 10–1000 Hz medida en los alojamientos de los rodamientos, y clasifica la máquina en cuatro zonas: A recién puesta en marcha / como nueva, B aceptable para operación de largo plazo sin restricción, C no apta para operación continua , investigar y planificar acción correctiva, y D peligrosa , puede estar ocurriendo daño, actuar de inmediato. Los límites numéricos escalan con la clase de máquina, la potencia y el montaje. Para las máquinas mineras medianas que apunta esta suite, ISO 20816-3 Grupo 2, 15–300 kW sobre soporte rígido, las fronteras son A/B = 1.4 mm/s, B/C = 2.8 mm/s, C/D = 4.5 mm/s (RMS); las máquinas grandes Grupo 1 (&gt;300 kW, rígido) suben a 2.3 / 4.5 / 7.1, y los soportes flexibles las elevan aún más. El pequeño banco de calibración tras la señal sintética que se muestra aquí está bajo el alcance de 15 kW de ISO 20816-3, a ese tamaño la escala correcta es ISO 10816-1 Clase I (0.71 / 1.8 / 4.5 mm/s); el marco A/B/C/D es idéntico, solo los límites numéricos se mueven con la clase de máquina. Operativamente, la frontera B/C es el setpoint natural de ALERTA y la C/D el setpoint de PELIGRO / disparo. Nótese la distinción de unidades que este build mantiene honesta: la capa ISO es velocidad RMS en mm/s, mientras que el HI de pronóstico es un indicador de tipo aceleración-RMS con su propio umbral de demostración , dos escalas distintas que responden dos preguntas distintas, y confundir sus unidades es un error clásico que el diseño evita.'
        : 'Prognosis projects a trend; the ISO decision layer judges the present against an internationally agreed scale, and the two are complementary. The current severity standard (which supersedes its predecessor) evaluates broadband vibration velocity RMS in the 10–1000 Hz band measured at the bearing housings, and sorts the machine into four zones: A newly commissioned / as-new, B acceptable for unrestricted long-term operation, C unsuitable for continuous operation, investigate and plan corrective action, and D dangerous, damage may be occurring, act immediately. The numeric limits scale with machine class, power and mounting. For the medium mining machines this suite targets, ISO 20816-3 Group 2, 15–300 kW on a rigid support, the boundaries are A/B = 1.4 mm/s, B/C = 2.8 mm/s, C/D = 4.5 mm/s (RMS); large Group 1 machines (&gt;300 kW, rigid) shift up to 2.3 / 4.5 / 7.1, and flexible supports raise them further. The small calibration rig behind the synthetic signal shown here is itself below the 15 kW scope of ISO 20816-3, at that size ISO 10816-1 Class I (0.71 / 1.8 / 4.5 mm/s) is the correct scale; the A/B/C/D framework is identical, only the numeric limits move with the machine class. Operationally, the B/C boundary is the natural ALERT setpoint and the C/D boundary is the DANGER / trip setpoint. Note the unit distinction this build keeps honest: the ISO layer is velocity RMS in mm/s, whereas the prognostic HI is an acceleration-RMS-style indicator with its own demonstration threshold, two different scales answering two different questions, and conflating their units is a classic mistake the design avoids.'}{' '}<Cite id="iso20816" paren /> <Cite id="iso20816_3_2022" paren /></p>

      <Equation tex={String.raw`\mathrm{RMS}(x) = \sqrt{\tfrac{1}{N}\sum_{i=1}^{N} x_i^2}`} caption={es ? 'indicador de salud (RMS); xᵢ = muestra i del registro, N = nº de muestras' : 'health indicator (RMS); xᵢ = i-th sample, N = number of samples'} />

      <Equation tex={String.raw`\mathrm{HI}_i > \mu_0 + k\,\sigma_0 \ \ \text{y}\ \ \mathrm{HI}_{i+1} > \mu_0 + k\,\sigma_0,\qquad k = 4`} caption={es ? 'inicio: kσ sostenido; μ₀,σ₀ de la línea base (primeros max(4,⌊0.3n⌋) puntos)' : 'onset: sustained kσ; μ₀,σ₀ from the baseline (first max(4,⌊0.3n⌋) points)'} />

      <Equation tex={String.raw`\ln \mathrm{HI}(t) = \ln a + b\,t \ \Longleftrightarrow\ \mathrm{HI}(t)=a\,e^{bt},\quad b = \frac{m\sum t\ln\mathrm{HI} - \sum t\sum\ln\mathrm{HI}}{m\sum t^2 - (\sum t)^2}`} caption={es ? 'modelo exponencial ajustado por MCO en espacio log; b > 0 requerido, m = puntos post-inicio' : 'exponential model fit by OLS in log space; b > 0 required, m = post-onset points'} />

      <Equation tex={String.raw`t_{\text{fail}} = \frac{\ln \mathrm{HI}_{\text{thr}} - \ln a}{b},\quad \mathrm{RUL} = \max(0,\,t_{\text{fail}} - t_{\text{now}}),\quad \mathrm{HI}_{\text{lo/hi}}(t) = e^{\ln a + bt \mp 2s}`} caption={es ? 'primer cruce, RUL y abanico ±2σ; s = desviación residual log √(RSS/(m−2))' : 'first passage, RUL and ±2σ fan; s = log residual std √(RSS/(m−2))'} />

      <Equation tex={String.raw`v_{\mathrm{RMS}}=\sqrt{\tfrac{1}{T}\int_0^T v(t)^2\,dt}\ \ (10\text{–}1000\,\text{Hz});\quad \underbrace{1.4}_{A|B}\ \ \underbrace{2.8}_{B|C\,(\text{ALERT})}\ \ \underbrace{4.5}_{C|D\,(\text{DANGER})}\ \text{mm/s}`} caption={es ? 'decisión ISO (Grupo 2, soporte rígido, velocidad RMS); ALERTA = B/C, PELIGRO = C/D' : 'ISO decision (Group 2, rigid support, velocity RMS); ALERT = B/C, DANGER = C/D'} />

      {/* ===== RUL projection ===== */}
      <svg viewBox="0 0 720 360" width="100%" role="img" aria-labelledby="rulProjTitle rulProjDesc" style={{ fontFamily: 'var(--font-mono)' }}>
        <title id="rulProjTitle">{es ? 'Proyección de vida útil remanente de un indicador de salud exponencial' : 'Remaining-useful-life projection of an exponential health indicator'}</title>
        <desc id="rulProjDesc">
          {es
            ? 'Línea sólida: historia medida del indicador de salud. Tras detectar el inicio de degradación, se ajusta un modelo exponencial ln(HI) = ln a + b·t y se proyecta (línea segmentada) hasta el umbral de fallo. Un abanico que se ensancha muestra la banda ±2σ del residuo logarítmico; sus cruces del umbral enmarcan el fin de vida. El RUL es la distancia de ahora al cruce central.'
            : 'Solid line: measured health-indicator history. After a detected degradation onset, an exponential model ln(HI) = ln a + b·t is fit and projected (dashed) to the failure threshold. A widening fan shows the ±2σ log-residual band; its crossings of the threshold bracket end-of-life. RUL is the gap from now to the central crossing.'}
        </desc>

        <rect x="0" y="0" width="720" height="360" fill="var(--color-bg)" />
        <g stroke="var(--color-border)" strokeWidth="1">
          <line x1="70" y1="300" x2="690" y2="300" />
          <line x1="70" y1="30" x2="70" y2="300" />
        </g>
        <g stroke="var(--color-border)" strokeWidth="0.5" strokeDasharray="2 4" opacity="0.5">
          <line x1="70" y1="240" x2="690" y2="240" />
          <line x1="70" y1="180" x2="690" y2="180" />
          <line x1="70" y1="120" x2="690" y2="120" />
          <line x1="70" y1="60" x2="690" y2="60" />
        </g>

        <text x="380" y="345" textAnchor="middle" fill="var(--color-fg-faint)" fontSize="13">{es ? 'tiempo de operación t (h)' : 'operating time t (h)'}</text>
        <text x="22" y="165" textAnchor="middle" fill="var(--color-fg-faint)" fontSize="13" transform="rotate(-90 22 165)">{es ? 'indicador de salud HI (escala log)' : 'health indicator HI (log scale)'}</text>

        <rect x="70" y="66" width="620" height="12" fill="var(--color-bad)" opacity="0.14" />
        <line x1="70" y1="72" x2="690" y2="72" stroke="var(--color-bad)" strokeWidth="1.5" strokeDasharray="6 3" />
        <text x="686" y="62" textAnchor="end" fill="var(--color-bad)" fontSize="12">{es ? 'umbral de fallo HI_thr (difuso)' : 'failure threshold HI_thr (fuzzy)'}</text>

        <path d="M 430 150 C 520 116, 600 86, 656 64 L 656 96 C 600 134, 520 176, 430 168 Z" fill="var(--color-accent)" opacity="0.16" />
        <text x="600" y="120" fill="var(--color-accent)" fontSize="11" opacity="0.9">±2σ</text>

        <polyline points="70,266 110,262 150,268 190,260 230,266 270,258 310,262 350,256 390,250 430,150" fill="none" stroke="var(--color-good)" strokeWidth="2.4" />
        <g fill="var(--color-good)">
          <circle cx="110" cy="262" r="2" /><circle cx="190" cy="260" r="2" />
          <circle cx="270" cy="258" r="2" /><circle cx="350" cy="256" r="2" />
        </g>

        <path d="M 430 150 C 520 116, 600 86, 638 72" fill="none" stroke="var(--color-warn)" strokeWidth="2.4" strokeDasharray="7 4" />

        <line x1="390" y1="30" x2="390" y2="300" stroke="var(--color-magenta)" strokeWidth="1.2" strokeDasharray="3 3" />
        <circle cx="390" cy="250" r="4" fill="var(--color-magenta)" />
        <text x="396" y="46" fill="var(--color-magenta)" fontSize="12">{es ? 'inicio (2×4σ)' : 'onset (2×4σ)'}</text>

        <line x1="430" y1="30" x2="430" y2="300" stroke="var(--color-fg-subtle)" strokeWidth="1.2" />
        <circle cx="430" cy="150" r="4.5" fill="var(--color-fg)" />
        <text x="436" y="142" fill="var(--color-fg)" fontSize="12">{es ? 'ahora (t_now)' : 'now (t_now)'}</text>

        <g>
          <circle cx="600" cy="72" r="3.5" fill="var(--color-bad)" />
          <circle cx="638" cy="72" r="4.5" fill="var(--color-warn)" />
          <circle cx="668" cy="72" r="3.5" fill="var(--color-accent)" />
          <text x="638" y="96" textAnchor="middle" fill="var(--color-fg)" fontSize="11">{es ? 't_fail (rango fin de vida)' : 't_fail (EOL range)'}</text>
        </g>

        <line x1="430" y1="318" x2="638" y2="318" stroke="var(--color-fg)" strokeWidth="1.2" />
        <line x1="430" y1="313" x2="430" y2="323" stroke="var(--color-fg)" strokeWidth="1.2" />
        <line x1="638" y1="313" x2="638" y2="323" stroke="var(--color-fg)" strokeWidth="1.2" />
        <text x="534" y="334" textAnchor="middle" fill="var(--color-fg)" fontSize="12">RUL = t_fail − t_now</text>

        <g fontSize="11">
          <line x1="80" y1="20" x2="104" y2="20" stroke="var(--color-good)" strokeWidth="2.4" />
          <text x="110" y="24" fill="var(--color-fg-faint)">{es ? 'HI medido' : 'measured HI'}</text>
          <line x1="220" y1="20" x2="244" y2="20" stroke="var(--color-warn)" strokeWidth="2.4" strokeDasharray="7 4" />
          <text x="250" y="24" fill="var(--color-fg-faint)">{es ? 'pronóstico (a·eᵇᵗ)' : 'forecast (a·eᵇᵗ)'}</text>
        </g>
      </svg>

      {/* ===== ISO zone bar ===== */}
      <svg viewBox="0 0 720 200" width="100%" role="img" aria-labelledby="isoZoneTitle isoZoneDesc" style={{ fontFamily: 'var(--font-mono)' }}>
        <title id="isoZoneTitle">{es ? 'Zonas de severidad de vibración A/B/C/D con aguja de medición' : 'Vibration-severity zones A/B/C/D with a measurement needle'}</title>
        <desc id="isoZoneDesc">
          {es
            ? 'Velocidad RMS de banda ancha (10–1000 Hz) clasificada en zonas A (como nueva), B (aceptable largo plazo), C (investigar / planificar reparación), D (peligro / detener). Fronteras para máquinas medianas Grupo 2 (15–300 kW) sobre soporte rígido: A/B 1.4, B/C 2.8 (ALERTA), C/D 4.5 mm/s. La aguja marca la lectura actual.'
            : 'Broadband velocity-RMS (10–1000 Hz) sorted into zones A (as-new), B (acceptable long-term), C (investigate / plan repair), D (danger / stop). Boundaries for Group 2 medium machines (15–300 kW) on a rigid support: A/B 1.4, B/C 2.8 (ALERT), C/D 4.5 mm/s. The needle marks the current reading.'}
        </desc>

        <rect x="0" y="0" width="720" height="200" fill="var(--color-bg)" />
        <text x="360" y="28" textAnchor="middle" fill="var(--color-fg)" fontSize="14">
          {es ? 'velocidad RMS (mm/s), Grupo 2 rígido' : 'velocity RMS (mm/s), Group 2 rigid'}
        </text>

        <rect x="70" y="60" width="116" height="44" fill="var(--color-good)" opacity="0.85" />
        <rect x="186" y="60" width="116" height="44" fill="var(--color-accent)" opacity="0.85" />
        <rect x="302" y="60" width="141" height="44" fill="var(--color-warn)" opacity="0.9" />
        <rect x="443" y="60" width="207" height="44" fill="var(--color-bad)" opacity="0.9" />
        <rect x="70" y="60" width="580" height="44" fill="none" stroke="var(--color-border)" />

        <g fontSize="18" fill="var(--color-bg)" fontWeight="bold" textAnchor="middle">
          <text x="128" y="89">A</text>
          <text x="244" y="89">B</text>
          <text x="372" y="89">C</text>
          <text x="546" y="89">D</text>
        </g>

        <g fontSize="12" fill="var(--color-fg)" textAnchor="middle">
          <line x1="70" y1="104" x2="70" y2="114" stroke="var(--color-fg-subtle)" />
          <text x="70" y="128">0</text>
          <line x1="186" y1="104" x2="186" y2="114" stroke="var(--color-fg-subtle)" />
          <text x="186" y="128">1.4</text>
          <line x1="302" y1="104" x2="302" y2="114" stroke="var(--color-fg-subtle)" />
          <text x="302" y="128">2.8</text>
          <line x1="443" y1="104" x2="443" y2="114" stroke="var(--color-fg-subtle)" />
          <text x="443" y="128">4.5</text>
          <line x1="650" y1="104" x2="650" y2="114" stroke="var(--color-fg-subtle)" />
          <text x="650" y="128">7.0</text>
        </g>

        <text x="302" y="148" textAnchor="middle" fill="var(--color-warn)" fontSize="11">{es ? '▲ ALERTA (B/C)' : '▲ ALERT (B/C)'}</text>
        <text x="443" y="148" textAnchor="middle" fill="var(--color-bad)" fontSize="11">{es ? '▲ PELIGRO (C/D)' : '▲ DANGER (C/D)'}</text>

        <g>
          <line x1="343" y1="44" x2="343" y2="104" stroke="var(--color-fg)" strokeWidth="2.5" />
          <path d="M 343 44 l -7 -12 l 14 0 Z" fill="var(--color-fg)" />
          <text x="343" y="172" textAnchor="middle" fill="var(--color-fg)" fontSize="13">{es ? 'lectura = 3.3 mm/s → Zona C (investigar)' : 'reading = 3.3 mm/s → Zone C (investigate)'}</text>
        </g>

        <g fontSize="10.5" fill="var(--color-fg-faint)">
          <text x="128" y="50" textAnchor="middle">{es ? 'como nueva' : 'as-new'}</text>
          <text x="244" y="50" textAnchor="middle">{es ? 'OK largo plazo' : 'long-term OK'}</text>
          <text x="372" y="50" textAnchor="middle">{es ? 'planificar reparación' : 'plan repair'}</text>
          <text x="546" y="50" textAnchor="middle">{es ? 'detener' : 'stop'}</text>
        </g>
      </svg>

      <p>{es
        ? 'Diagnóstico, severidad ISO y RUL son tres evidencias; un técnico no actúa sobre tres gráficos sino sobre UNA decisión. La pestaña «Recomendación · reporte» de la App es esa capa de decisión basada en condición: fusiona el diagnóstico de envolvente (qué falla y su índice de severidad), la zona ISO 20816 (la velocidad RMS de banda ancha contra la escala A/B/C/D) y la proyección de RUL, y toma la PEOR de las tres sobre una escalera de prioridad, ok → vigilar → planificar → alarma → disparo (disparo solo cuando una falla severa, la Zona D y un RUL corto coinciden). Cada factor se reporta con su valor y evaluación, así que la recomendación es explicable, no una caja negra. La honestidad clave está incorporada: cuando la pantalla ISO de banda ancha parece tranquila (Zona A/B) pero la envolvente confirma una falla de rodamiento real, su energía vive en la resonancia de alta frecuencia, FUERA de la banda 10–1000 Hz, el motor EXPONE el desacuerdo y confía en la envolvente, exactamente la razón por la que existe el análisis de envolvente. La decisión se exporta como JSON estructurado, reporte Markdown legible o PDF imprimible: el entregable que se adjunta a la orden de trabajo. La magnitud de velocidad es una calibración ilustrativa del caso sintético (etiquetada); la lógica de decisión es práctica CBM real.'
        : 'Diagnosis, ISO severity and RUL are three pieces of evidence; a technician does not act on three plots but on ONE decision. The App’s “Recommendation · report” tab is that condition-based decision layer: it fuses the envelope diagnosis (what is wrong and its severity index), the ISO 20816 zone (broadband velocity RMS against the A/B/C/D scale) and the RUL projection, and takes the WORST of the three on a priority ladder, ok → watch → plan → alarm → trip (trip only when a severe fault, Zone D and a short RUL all agree). Each factor is reported with its value and assessment, so the recommendation is explainable, not a black box. The key honesty is built in: when the broadband ISO screen looks calm (Zone A/B) but the envelope confirms a real bearing fault, its energy lives in the high-frequency resonance, OUTSIDE the 10–1000 Hz band, the engine SURFACES the disagreement and trusts the envelope, which is exactly why envelope analysis exists. The decision exports as structured JSON, a readable Markdown report, or a printable PDF: the deliverable attached to the work order. The velocity magnitude is an illustrative calibration of the synthetic case (labeled); the decision logic is real CBM practice.'}</p>

      <h4>{es ? 'Escalera de modelos de pronóstico' : 'Prognostic model ladder'}</h4>
      <p>{es
        ? 'El modelo exponencial descrito arriba es el primer escalón de cuatro. Los tres adicionales, un filtro de partículas, un proceso Gaussiano y una red CNN-BiLSTM, están implementados en ambas líneas (TypeScript en el navegador, Python en el pipeline offline) y se seleccionan desde la pestaña Prognostics·RUL mediante un grupo de chips.'
        : 'The exponential model described above is the first rung of four. The three additional models, a particle filter, a Gaussian Process, and a CNN-BiLSTM network, are implemented in both lanes (TypeScript in the browser, Python in the offline pipeline) and are selectable from the Prognostics·RUL tab via a chip group.'}{' '}
        <Cite id="arulampalam2002" paren /> <Cite id="rasmussen2006" paren /> <Cite id="aye2017" paren />
      </p>

      <h5>{es ? 'Filtro de Partículas (PF)' : 'Particle Filter (PF)'}</h5>
      <Equation tex={String.raw`\begin{aligned}
        x_k &\sim p(x_k \mid x_{k-1}), \quad x_k = (\ln a_k,\; b_k,\; \sigma_{\mathrm{obs},k}) \\
        w_k^{(i)} &\propto w_{k-1}^{(i)}\; p(y_k \mid x_k^{(i)}), \qquad
        p(y_k \mid x_k^{(i)}) = \mathcal{N}\!\left(\ln(y_k) \;\middle|\; \ln a_k^{(i)} + b_k^{(i)} t_k,\; (\sigma_{\mathrm{obs},k}^{(i)})^2\right) \\
        N_{\mathrm{eff}} &= 1\Big/{\textstyle\sum_i (w_k^{(i)})^2},\qquad
        \text{resample + regularise if } N_{\mathrm{eff}} < 0.6 N
      \end{aligned}`}
        caption={es ? 'Filtro SIR con 500 partículas sobre el espacio de estados (ln a, b, σ_obs). Verosimilitud log-normal; remuestreo sistemático cuando el tamaño efectivo de muestra cae bajo el 60%; regularización por densidad de kernel (Silverman, ancho de banda reducido al 50%).' : 'SIR filter with 500 particles over the state space (ln a, b, σ_obs). Log-normal likelihood; systematic resampling when effective sample size drops below 60%; kernel-density regularisation (Silverman bandwidth, shrunk 50%).'}
      />
      <p>{es
        ? 'El filtro se inicializa desde un prior débilmente informado centrado en los primeros puntos post-onset, no desde el ajuste OLS, el filtro debe ganarse su estimación de los datos. La proyección forward evalúa '
        : 'The filter is initialised from a weakly informed prior centred on the first post-onset points, not from the OLS fit, the filter must earn its estimate from the data. The forward projection evaluates '}
        <InlineMath tex={String.raw`\mathrm{HI}(t)=\exp(\ln a^{(i)} + b^{(i)} t)`} />{es
        ? ' para cada partícula y toma los percentiles 10, 50 y 90 del ensemble, la banda es la incertidumbre posterior completa. Implementado en TypeScript (navegador) y numpy (pipeline).'
        : ' for each particle and takes the 10th, 50th and 90th percentiles of the ensemble, the band IS the full posterior uncertainty. Implemented in TypeScript (browser) and numpy (pipeline).'}
      </p>

      <h5>{es ? 'Proceso Gaussiano (GP)' : 'Gaussian Process (GP)'}</h5>
      <Equation tex={String.raw`\begin{aligned}
        f(t) &\sim \mathcal{GP}\!\left(m(t),\; k(t, t')\right), \qquad
        m(t) = \ln\hat a_{\mathrm{OLS}} + \hat b_{\mathrm{OLS}}\,t \\
        k(t, t') &= \sigma_f^2 \exp\!\left(-\frac{(t-t')^2}{2\ell^2}\right), \qquad
        y(t) = f(t) + \varepsilon,\; \varepsilon \sim \mathcal{N}(0, \sigma_n^2) \\
        \mathbf{f}_* \mid X, \mathbf{y}, X_* &\sim \mathcal{N}\!\left(K_*^{\top} K^{-1}\mathbf{y},\;
          K_{**} - K_*^{\top} K^{-1} K_*\right)
      \end{aligned}`}
        caption={es ? 'GP con kernel RBF y función de media lineal (OLS). Predicción posterior vía Cholesky. Pipeline offline: scikit-learn GaussianProcessRegressor con kernel compuesto RBF + Matérn(ν=2.5) + WhiteKernel, optimización L-BFGS-B con 5 reinicios.' : 'GP with RBF kernel and linear mean function (OLS). Posterior prediction via Cholesky. Offline pipeline: scikit-learn GaussianProcessRegressor with composite RBF + Matérn(ν=2.5) + WhiteKernel, L-BFGS-B with 5 restarts.'}
      />
      <p>{es
        ? 'La función de media OLS evita que el GP revierta a cero lejos de los datos. Las bandas de incertidumbre son continuas y se ensanchan con la distancia de extrapolación, su visibilidad está garantizada por un piso mínimo de ruido de observación (σ_n ≥ 0.12).'
        : 'The OLS mean function prevents the GP from reverting to zero far from the data. The uncertainty bands are continuous and widen with extrapolation distance, their visibility is guaranteed by a minimum observation-noise floor (σ_n ≥ 0.12).'}
      </p>

      <p>{es
        ? 'El modelo CNN-BiLSTM de prognosis (Deep-HI/RUL) se documenta en la pestaña ML / Deep Learning, pertenece a la familia de modelos aprendidos, no a los métodos físicos de pronóstico.'
        : 'The CNN-BiLSTM prognostic model (Deep-HI/RUL) is documented in the ML / Deep Learning tab, it belongs to the learned-model family, not to the physics-based prognostic methods.'}
      </p>

      <Refs ids={['lei2018', 'iso20816', 'iso20816_3_2022', 'wang2020xjtu', 'randall2011', 'smith2015', 'arulampalam2002', 'rasmussen2006', 'aye2017']} label={refsLabel} />
    </div>
  );

  // ============================================================
  // ML / DEEP LEARNING (existing content, lightly polished)
  // ============================================================
  const mlTab = (
    <div className="prose">
      <p>{es
        ? 'Sobre features (RMS, kurtosis, factores de cresta/impulso, entropía) clasificadores clásicos (SVM/RF/XGBoost); o deep learning de extremo a extremo: 1D-CNN (WDCNN), 2D-CNN sobre escalogramas/espectrogramas, LSTM, y adaptación de dominio para generalizar entre cargas/máquinas. En ESTA app, el WDCNN (1D-CNN) y un autoencoder profundo están entrenados sobre las grabaciones REALES de CWRU (offline, en el pipeline de precómputo) y corren EN VIVO en el navegador (onnxruntime-web) en la página Benchmark (diagnóstico interactivo sobre segmentos reales); su exactitud held-out y la curva de robustez vs ruido están ahí mismo. El valor de las features físicas (las mismas RMS/kurtosis/prominencia de las pestañas anteriores) es que el modelo parte de cantidades ya interpretables, no de píxeles crudos.'
        : 'Over features (RMS, kurtosis, crest/impulse factors, entropy) classical classifiers (SVM/RF/XGBoost); or end-to-end deep learning: 1D-CNN (WDCNN), 2D-CNN on scalograms/spectrograms, LSTM, and domain adaptation to generalize across loads/machines. In THIS app the WDCNN (1D-CNN) and a deep autoencoder are trained on the REAL CWRU recordings (offline, in the precompute pipeline) and run LIVE in the browser (onnxruntime-web) on the Benchmark page (interactive diagnosis on real segments); their held-out accuracy and noise-robustness curve are right there. The value of physical features (the same RMS/kurtosis/prominence from the earlier tabs) is that the model starts from already-interpretable quantities, not raw pixels.'}{' '}<Cite id="lei2018" paren /></p>
      <p>{es
        ? 'Para que la comparación profundo-vs-clásico sea real y no retórica, esta app TAMBIÉN entrena dos clasificadores clásicos sobre features hechas a mano, un SVM de kernel RBF y un Random Forest, y los exporta a ONNX (skl2onnx) para que corran EN VIVO en el navegador junto al WDCNN, sobre exactamente el mismo split sin fuga (se deja fuera la carga 3 HP entera). Ambos parten del MISMO vector de 10 features físicas por ventana: seis indicadores de condición de dominio temporal (curtosis, asimetría, factores de cresta / impulso / forma / holgura, todos invariantes a escala porque la ventana está z-normalizada, así que solo la FORMA informa) y cuatro de dominio frecuencial (la prominencia del peine de armónicos del espectro de envolvente en BPFO, BPFI y 2·BSF, la MISMA prominencia P(f₀) de la pestaña de envolvente, más la curtosis espectral de la banda de resonancia).'
        : 'To make the deep-vs-classical comparison real rather than rhetorical, this app ALSO trains two classical classifiers over hand-crafted features, an RBF-kernel SVM and a Random Forest, and exports them to ONNX (skl2onnx) so they run LIVE in the browser next to the WDCNN, on exactly the same leakage-safe split (the entire 3 HP load held out). Both start from the SAME 10-D physics feature vector per window: six time-domain condition indicators (kurtosis, skewness, crest / impulse / shape / clearance factors, all scale-invariant because the window is z-scored, so only SHAPE informs) and four frequency-domain ones (the envelope-spectrum harmonic-comb prominence at BPFO, BPFI and 2·BSF, the SAME P(f₀) prominence from the envelope tab, plus the resonance-band spectral kurtosis).'}{' '}<Cite id="widodo2007svm" paren /></p>
      <Equation tex={String.raw`\mathrm{crest}=\frac{\max_i|x_i|}{\mathrm{RMS}},\quad \mathrm{impulse}=\frac{\max_i|x_i|}{\frac{1}{N}\sum_i|x_i|},\quad \mathrm{shape}=\frac{\mathrm{RMS}}{\frac{1}{N}\sum_i|x_i|},\quad \mathrm{clearance}=\frac{\max_i|x_i|}{\left(\frac{1}{N}\sum_i\sqrt{|x_i|}\right)^2}`} caption={es ? 'los factores de forma adimensionales (invariantes a escala): suben con la impulsividad de un defecto localizado' : 'the dimensionless shape factors (scale-invariant): they rise with the impulsiveness of a localized defect'} />
      <Equation tex={String.raw`\mathbf{v} = \big[\,\kappa,\ \gamma,\ \mathrm{crest},\ \mathrm{impulse},\ \mathrm{shape},\ \mathrm{clearance},\ P(\mathrm{BPFO}),\ P(\mathrm{BPFI}),\ P(2{\cdot}\mathrm{BSF}),\ \kappa_{\text{res}}\,\big]\in\mathbb{R}^{10} \;\xrightarrow{\text{StandardScaler}}\; \{\text{SVM-RBF},\ \text{RandomForest}\}`} caption={es ? 'el vector de 10 features (κ: curtosis, γ: asimetría, κ_res: curtosis de la banda de resonancia); el StandardScaler va precalculado dentro del ONNX' : 'the 10-feature vector (κ: kurtosis, γ: skewness, κ_res: resonance-band kurtosis); the StandardScaler is baked into the ONNX'} />
      <p>{es
        ? 'El resultado held-out es honesto y revelador: el WDCNN profundo llega a 100%, mientras el SVM-RBF y el Random Forest se quedan en ~85.6%. La columna que lo explica es el "recall de la clase sana": el ML clásico clava las fallas (externa/interna ~100%, bola ~90%) pero falsa-alarma en la MITAD de las ventanas sanas, las prominencias de los peines, hechas a mano, también disparan en señales sanas con transitorios. El CNN profundo aprende esa frontera sano/falla que las features fijas no capturan. No es una victoria fabricada: el split es idéntico, los tres corren en vivo sobre los mismos segmentos, y el número se reporta como cae.'
        : 'The held-out result is honest and revealing: the deep WDCNN reaches 100%, while the SVM-RBF and the Random Forest sit at ~85.6%. The column that explains it is the "healthy-class recall": the classical ML nails the faults (outer/inner ~100%, ball ~90%) but false-alarms on HALF the healthy windows, the hand-crafted comb prominences also fire on healthy signals with transients. The deep CNN learns the healthy/fault boundary the fixed features cannot. Not a fabricated win: the split is identical, all three run live on the same segments, and the number is reported as it lands.'}{' '}<Cite id="smith2015" paren /></p>

      <p>{es
        ? 'El ladder de pronóstico extiende el aprendizaje profundo a la dimensión temporal. Una red CNN-BiLSTM (Deep-HI/RUL) procesa secuencias de ventanas de vibración a lo largo de la vida del rodamiento: el backbone CNN 1D (el mismo WDCNN del diagnóstico) extrae features espaciales por ventana compartiendo pesos sobre los S pasos de tiempo, y un BiLSTM de 2 capas con 128 unidades ocultas modela la trayectoria de degradación. Dos cabezas lineales independientes producen la curva HI(t) proyectada y el RUL escalar. Entrenada sobre 18 trayectorias XJTU-SY + FEMTO (150 épocas, loss 0.38), exportada a ONNX (opset 14, 3.4 MB) e inferida en vivo con onnxruntime-web sobre los frames medidos de trayectorias reales. A diferencia del WDCNN de diagnóstico que clasifica UNA ventana, esta arquitectura aprende la secuencia temporal, la CNN ve el "qué", la BiLSTM aprende el "cuándo" en la degradación. Ref.: Li, Ding & Sun (2018), Zhu, Chen & Peng (2019), Zhang et al. (2017).'
        : 'The prognostic ladder extends deep learning into the temporal dimension. A CNN-BiLSTM network (Deep-HI/RUL) processes sequences of vibration windows across the bearing life: the 1D CNN backbone (the same WDCNN as the diagnosis tier) extracts per-window spatial features with shared weights over S time steps, and a 2-layer BiLSTM with 128 hidden units models the degradation trajectory. Two independent linear heads produce the projected HI(t) curve and scalar RUL. Trained on 18 XJTU-SY + FEMTO trajectories (150 epochs, loss 0.38), exported to ONNX (opset 14, 3.4 MB) and inferred live via onnxruntime-web on measured trajectory frames. Unlike the diagnostic WDCNN which classifies ONE window, this architecture learns the temporal sequence, the CNN sees the "what", the BiLSTM learns the "when" of degradation. Ref.: Li, Ding & Sun (2018), Zhu, Chen & Peng (2019), Zhang et al. (2017).'}{' '}
        <Cite id="li2018" paren /> <Cite id="zhu2019" paren /> <Cite id="zhang2017" paren />
      </p>

      {/* CNN-BiLSTM architecture diagram */}
      <svg viewBox="0 0 820 430" width="100%" role="img" aria-labelledby="cnnBiLstmTitle cnnBiLstmDesc" style={{ fontFamily: 'var(--font-mono)', marginTop: '1.25rem' }}>
        <title id="cnnBiLstmTitle">{es ? 'Arquitectura CNN-BiLSTM para Deep-HI / Deep-RUL' : 'CNN-BiLSTM architecture for Deep-HI / Deep-RUL'}</title>
        <desc id="cnnBiLstmDesc">
          {es
            ? 'S ventanas de vibración entran a un backbone CNN 1D (WDCNN, 5 bloques Conv1d→BN→ReLU→MaxPool con pesos compartidos). El vector de features resultante por paso de tiempo alimenta un BiLSTM de 2 capas (128 ocultas). Dos cabezas lineales independientes producen la secuencia HI(t) y el escalar RUL.'
            : 'S vibration windows enter a 1D CNN backbone (WDCNN, 5 Conv1d→BN→ReLU→MaxPool blocks with shared weights). The resulting per-timestep feature vector feeds a 2-layer BiLSTM (128 hidden). Two independent linear heads produce the HI(t) sequence and the scalar RUL.'}
        </desc>
        <rect x="0" y="0" width="820" height="430" fill="var(--color-bg)" />
        {/* Input */}
        <rect x="20" y="140" width="140" height="120" rx="8" fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth="1.5" />
        <text x="90" y="170" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--color-fg)">{es ? 'Ventanas de' : 'Vibration'}</text>
        <text x="90" y="190" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--color-fg)">{es ? 'vibración' : 'windows'}</text>
        <text x="90" y="216" textAnchor="middle" fontSize="10" fill="var(--color-fg-subtle)">S × 2048 × 1</text>
        <text x="90" y="234" textAnchor="middle" fontSize="10" fill="var(--color-fg-subtle)">{es ? 'secuencia temporal' : 'time sequence'}</text>
        <text x="90" y="252" textAnchor="middle" fontSize="10" fill="var(--color-fg-subtle)">t₁, t₂, …, t_S</text>
        {/* Arrow input → CNN */}
        <line x1="160" y1="200" x2="195" y2="200" stroke="var(--color-fg-faint)" strokeWidth="1.5" markerEnd="url(#cnnArrow)" />
        {/* CNN backbone box */}
        <rect x="200" y="100" width="200" height="200" rx="8" fill="var(--color-surface)" stroke="var(--color-accent)" strokeWidth="2" />
        <text x="300" y="128" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--color-accent)">{es ? 'CNN 1D (WDCNN)' : '1D CNN (WDCNN)'}</text>
        <text x="300" y="148" textAnchor="middle" fontSize="10" fill="var(--color-fg-subtle)">{es ? 'pesos compartidos sobre S pasos' : 'shared weights across S steps'}</text>
        <g fontSize="9.5" fill="var(--color-fg)">
          <rect x="215" y="158" width="170" height="18" rx="4" fill="var(--color-bg)" />
          <text x="300" y="171" textAnchor="middle">Conv1d → BN → ReLU → MaxPool</text>
          <rect x="215" y="180" width="170" height="18" rx="4" fill="var(--color-bg)" />
          <text x="300" y="193" textAnchor="middle">1→16 (k64, s16) · 16→32 (k3)</text>
          <rect x="215" y="202" width="170" height="18" rx="4" fill="var(--color-bg)" />
          <text x="300" y="215" textAnchor="middle">32→64 (k3) · 64→64 (k3)</text>
          <rect x="215" y="224" width="170" height="18" rx="4" fill="var(--color-bg)" />
          <text x="300" y="237" textAnchor="middle">64→64 (k3) → 256-dim</text>
          <rect x="215" y="246" width="170" height="18" rx="4" fill="var(--color-bg)" />
          <text x="300" y="259" textAnchor="middle">5 bloques · 64 canales final</text>
        </g>
        <text x="300" y="286" textAnchor="middle" fontSize="10" fill="var(--color-accent)">ℝ{'^{'}S×256{'}'}</text>
        {/* Arrow CNN → BiLSTM */}
        <line x1="400" y1="200" x2="435" y2="200" stroke="var(--color-fg-faint)" strokeWidth="1.5" markerEnd="url(#cnnArrow)" />
        {/* BiLSTM box */}
        <rect x="440" y="140" width="170" height="120" rx="8" fill="var(--color-surface)" stroke="var(--color-warn)" strokeWidth="2" />
        <text x="525" y="168" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--color-warn)">BiLSTM</text>
        <text x="525" y="186" textAnchor="middle" fontSize="10" fill="var(--color-fg-subtle)">2 capas · 128 ocultas</text>
        <text x="525" y="204" textAnchor="middle" fontSize="10" fill="var(--color-fg-subtle)">{es ? 'bidireccional' : 'bidirectional'}</text>
        <text x="525" y="226" textAnchor="middle" fontSize="10" fill="var(--color-fg-subtle)">{es ? 'modela la trayectoria' : 'models degradation'}</text>
        <text x="525" y="244" textAnchor="middle" fontSize="10" fill="var(--color-fg-subtle)">{es ? 'de degradación' : 'trajectory'}</text>
        <text x="525" y="254" textAnchor="middle" fontSize="10" fill="var(--color-warn)">ℝ{'^{'}S×256{'}'}</text>
        {/* Arrow BiLSTM → heads */}
        <line x1="610" y1="180" x2="645" y2="150" stroke="var(--color-fg-faint)" strokeWidth="1.5" markerEnd="url(#cnnArrow)" />
        <line x1="610" y1="220" x2="645" y2="260" stroke="var(--color-fg-faint)" strokeWidth="1.5" markerEnd="url(#cnnArrow)" />
        {/* HI head */}
        <rect x="650" y="110" width="150" height="80" rx="8" fill="var(--color-bg)" stroke="var(--color-good)" strokeWidth="2" />
        <text x="725" y="138" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--color-good)">{es ? 'Cabeza HI' : 'HI head'}</text>
        <text x="725" y="156" textAnchor="middle" fontSize="10" fill="var(--color-fg-subtle)">Linear → ReLU</text>
        <text x="725" y="172" textAnchor="middle" fontSize="10" fill="var(--color-fg-subtle)">→ Linear → HI(t)</text>
        <text x="725" y="186" textAnchor="middle" fontSize="10" fill="var(--color-good)">{es ? 'curva de salud' : 'health curve'}</text>
        {/* RUL head */}
        <rect x="650" y="230" width="150" height="80" rx="8" fill="var(--color-bg)" stroke="var(--color-bad)" strokeWidth="2" />
        <text x="725" y="258" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--color-bad)">{es ? 'Cabeza RUL' : 'RUL head'}</text>
        <text x="725" y="276" textAnchor="middle" fontSize="10" fill="var(--color-fg-subtle)">Linear → ReLU</text>
        <text x="725" y="292" textAnchor="middle" fontSize="10" fill="var(--color-fg-subtle)">→ Dropout → Linear</text>
        <text x="725" y="306" textAnchor="middle" fontSize="10" fill="var(--color-bad)">→ Sigmoid → RUL</text>
        {/* Training info */}
        <rect x="20" y="310" width="780" height="52" rx="6" fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth="1" />
        <text x="410" y="330" textAnchor="middle" fontSize="10.5" fill="var(--color-fg-subtle)">
          {es ? 'Entrenada sobre 18 trayectorias reales (XJTU-SY + FEMTO) · 150 épocas · loss 0.38' : 'Trained on 18 real trajectories (XJTU-SY + FEMTO) · 150 epochs · loss 0.38'}
        </text>
        <text x="410" y="350" textAnchor="middle" fontSize="10.5" fill="var(--color-fg-subtle)">
          {es ? 'exportada a ONNX (opset 14, 3.4 MB) · inferida en vivo con onnxruntime-web' : 'exported to ONNX (opset 14, 3.4 MB) · inferred live via onnxruntime-web'}
        </text>
        {/* Loss function note */}
        <text x="410" y="388" textAnchor="middle" fontSize="9.5" fill="var(--color-fg-subtle)">
          ℒ = ½MSE(HI, HÎ) + ½MSE(RUL, RÛL) &nbsp;|&nbsp; {es ? 'a diferencia del WDCNN de diagnóstico que clasifica UNA ventana,' : 'unlike the diagnostic WDCNN which classifies ONE window,'}
        </text>
        <text x="410" y="404" textAnchor="middle" fontSize="9.5" fill="var(--color-fg-subtle)">
          {es ? 'esta arquitectura aprende la secuencia temporal, la CNN ve el "qué", la BiLSTM aprende el "cuándo"' : 'this architecture learns the temporal sequence, the CNN sees the "what", the BiLSTM learns the "when"'}
        </text>
        <defs>
          <marker id="cnnArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--color-fg-faint)" />
          </marker>
        </defs>
      </svg>

      <p>{es
        ? 'La generalización entre dominios (la "adaptación de dominio" mencionada arriba) se pone a prueba de forma honesta en el App: el WDCNN entrenado SOLO en CWRU se ejecuta CROSS-DOMAIN sobre otros bancos , Ottawa y MaFaulDa,  sin haber visto un registro suyo, sobre una ventana re-muestreada a 12 kHz para igualar su entrada. Como el modelo predice en el vocabulario de clases de CWRU, cada clase del banco destino se mapea a su contraparte de CWRU para el chequeo (la jaula de MaFaulDa no tiene contraparte y se omite). El resultado se etiqueta como lo que es: en MaFaulDa la falla de pista externa transfiere (externa→externa ✓), mientras que en Ottawa el modelo a veces no acierta , el dominio difiere en banco, rodamiento y régimen de velocidad, . Esa brecha de dominio es el resultado honesto, no algo que se esconda; es justamente por qué la adaptación de dominio es un problema abierto y no una casilla resuelta.'
        : 'Cross-domain generalization (the "domain adaptation" mentioned above) is tested honestly in the App: the WDCNN trained ONLY on CWRU runs CROSS-DOMAIN on other rigs, Ottawa and MaFaulDa, never having seen a record of theirs, on a window resampled to 12 kHz to match its input. Since the model predicts in CWRU\'s class vocabulary, each target-rig class is mapped to its CWRU counterpart for the check (MaFaulDa\'s cage has no counterpart and is skipped). The result is labelled as what it is: on MaFaulDa the outer-race fault transfers (outer→outer ✓), while on Ottawa the model sometimes misses, the domain differs in rig, bearing and speed regime. That domain gap is the honest result, not something hidden; it is exactly why domain adaptation is an open problem and not a solved checkbox.'}{' '}<Cite id="lei2018" paren /></p>

      <Callout variant="honest" title={es ? 'Honestidad de evaluación' : 'Evaluation honesty'}>
        <p>{es
          ? 'Se reporta la partición (sin fuga del conjunto de referencia) y la prueba cruzada de carga (se deja FUERA una carga entera, 3 HP); la exactitud sin esas salvaguardas es engañosa. El WDCNN, el autoencoder profundo Y los dos clasificadores clásicos (SVM-RBF / Random Forest) SÍ están implementados y corren en vivo en la página Benchmark (diagnóstico interactivo sobre segmentos reales + los números held-out); CWRU es un banco limpio, por eso se reporta la degradación honesta vs ruido y el recall sano por modelo en vez de un 100% pelado.'
          : 'Report the split (no leakage of the reference set) and the cross-load test (an ENTIRE load, 3 HP, is held out); accuracy without those safeguards is misleading. The WDCNN, the deep autoencoder AND the two classical classifiers (SVM-RBF / Random Forest) ARE implemented and run live on the Benchmark page (interactive diagnosis on real segments + the held-out numbers); CWRU is a clean lab rig, so we report the honest noise-degradation curve and the per-model healthy recall rather than a bare 100%.'}</p>
      </Callout>

      <Callout variant="honest" title={es ? 'Deep-HI/RUL en el App: onset-gating, banda honesta y contexto bidirectional' : 'Deep-HI/RUL in the App: onset-gating, honest band, and bidirectional context'}>
        <p>{es
          ? 'A diferencia de los modelos clásicos (exp/PF/GP) que operan sobre la curva de HI extraída, la CNN-BiLSTM procesa las ventanas de vibración cruda y emite un valor HI para cada una. Para mantener consistencia en la visualización, el App aplica el MISMO detector de onset que los otros modelos (línea base μ+4σ, 2 puntos consecutivos) y solo muestra la curva a partir de ese punto. La banda de incertidumbre se muestra como línea simple (lo=mid=hi): el modelo no produce una posterior como el PF ni bandas calibradas como el GP, y una banda falsa (±30% fijo) sería deshonesta. Adicionalmente, la BiLSTM ve la secuencia completa (forward+backward), lo cual es correcto para análisis offline pero proporciona un contexto que un despliegue puramente online no tendría, la curva es una estimación de "calidad offline". Para prognosis online causal existe la variante CausalDeepHIRUL (LSTM unidireccional) en el pipeline de entrenamiento.'
          : 'Unlike the classical models (exp/PF/GP) that operate on the extracted HI curve, the CNN-BiLSTM processes raw vibration windows and outputs one HI value per window. For display consistency, the App applies the SAME onset detector as the other models (baseline μ+4σ, 2 consecutive points) and only shows the curve from that point onward. The uncertainty band is shown as a single line (lo=mid=hi): the model produces neither a posterior like the PF nor calibrated bands like the GP, and a fake band (fixed ±30%) would be dishonest. Additionally, the BiLSTM sees the full sequence (forward+backward), which is correct for offline analysis but provides context a purely online deployment would not have, the curve is an "offline-quality" estimate. For causal online prognosis, the CausalDeepHIRUL variant (unidirectional LSTM) exists in the training pipeline.'}</p>
      </Callout>
      <Refs ids={['smith2015', 'widodo2007svm', 'lei2018', 'li2018', 'zhu2019', 'zhang2017']} label={refsLabel} />
    </div>
  );

  const otTab = (
    <div className="prose">
      <p>{es
        ? 'Todo lo anterior asume velocidad de eje constante: las frecuencias de falla son fijas en Hz y sus picos caen en bins estables. Bajo velocidad variable , un arranque, una parada, una máquina de proceso que cambia de régimen,  esa premisa se rompe: la frecuencia de falla sigue al eje, así que sus líneas se desplazan y se difuminan en el espectro, y el promediado las borra. Esta es exactamente la condición del conjunto Ottawa (velocidad variable), y donde el análisis de frecuencia fija falla.'
        : 'Everything above assumes constant shaft speed: the fault frequencies are fixed in Hz and their peaks land in stable bins. Under varying speed, a run-up, a coast-down, a process machine changing regime, that premise breaks: the fault frequency tracks the shaft, so its lines smear across the spectrum and averaging erases them. This is exactly the Ottawa (varying-speed) set\'s condition, and where fixed-frequency analysis fails.'}{' '}<Cite id="randall2011" paren /></p>

      <p>{es
        ? 'La solución estándar es el seguimiento de orden por cómputo (computed order tracking): en vez de muestrear en tiempo uniforme, se re-muestrea la señal a ÁNGULO de eje uniforme. De un tacómetro o encoder se estima el ángulo instantáneo del eje θ(t) integrando la velocidad angular; luego se interpola la vibración en instantes de ángulo equiespaciado Δθ. En ese dominio angular, una falla que ocurre un número fijo de veces por revolución es periódica en el ÁNGULO, no en el tiempo.'
        : 'The standard fix is computed order tracking: instead of sampling at uniform time, the signal is resampled to uniform shaft ANGLE. From a tachometer or encoder the instantaneous shaft angle θ(t) is estimated by integrating the angular velocity; the vibration is then interpolated at equally-spaced angle increments Δθ. In that angular domain, a fault happening a fixed number of times per revolution is periodic in ANGLE, not in time.'}{' '}<Cite id="randall2011" paren /></p>

      <Equation tex={String.raw`\theta(t) = \int_0^t \omega(\tau)\,d\tau, \qquad x_\theta[m] = x\big(t(m\,\Delta\theta)\big), \quad m = 0,1,2,\dots`} caption={es ? 'ángulo de eje por integración de la velocidad (del tacómetro); la señal se interpola a ángulo equiespaciado Δθ → muestras por revolución' : 'shaft angle by integrating speed (from the tachometer); the signal is interpolated at equally-spaced angle Δθ → samples per revolution'} />

      <p>{es
        ? 'El espectro tomado sobre x_θ está en ÓRDENES (múltiplos de la frecuencia de rotación), no en Hz. Y aquí está la clave: las frecuencias de falla del rodamiento son razones cinemáticas fijas (BPFO, BPFI, BSF como múltiplos de la velocidad del eje), así que en órdenes son CONSTANTES, sin importar cómo varíe la velocidad. La línea de BPFO que se difuminaba en Hz queda quieta en su orden (p. ej. ≈3.57× para el rodamiento ER-16K de Ottawa).'
        : 'The spectrum taken over x_θ is in ORDERS (multiples of the rotation frequency), not Hz. And here is the point: the bearing fault frequencies are fixed kinematic ratios (BPFO, BPFI, BSF as multiples of shaft speed), so in orders they are CONSTANT, no matter how the speed varies. The BPFO line that smeared in Hz stands still at its order (e.g. ≈3.57× for Ottawa\'s ER-16K bearing).'}{' '}<Cite id="randall2011" paren /></p>

      <Equation tex={String.raw`O_{\text{BPFO}} = \tfrac{n}{2}(1-r), \quad O_{\text{BPFI}} = \tfrac{n}{2}(1+r), \quad O_{\text{BSF}} = \tfrac{D}{2d}(1-r^2), \qquad r=\tfrac{d}{D}\cos\varphi`} caption={es ? 'órdenes de defecto (= frecuencia ÷ velocidad de eje): constantes bajo velocidad variable; el Campbell las traza como líneas horizontales' : 'defect orders (= frequency ÷ shaft speed): constant under varying speed; the Campbell map draws them as horizontal lines'} />

      <p>{es
        ? 'Esto habilita el mapa de Campbell/orden: el espectro de envolvente seguido en orden, apilado contra la rpm instantánea durante el barrido de velocidad. Una línea de falla aparece HORIZONTAL (orden constante), separándola de cualquier contenido de frecuencia fija (que sería diagonal). Es la herramienta que la velocidad variable habilita y un banco de velocidad fija no.'
        : 'This enables the Campbell/order map: the order-tracked envelope spectrum stacked against instantaneous rpm across the speed sweep. A fault line appears HORIZONTAL (constant order), separating it from any fixed-frequency content (which would be diagonal). It is the tool varying speed enables and a fixed-speed rig cannot.'}{' '}<Cite id="randall2011" paren /></p>

      <Callout variant="honest" title={es ? 'Alcance honesto de este build' : 'Honest scope of this build'}>
        <p>{es
          ? 'El order tracking de esta app se computa offline en el pipeline (re-muestreo angular a partir del tacómetro de Ottawa, canal 2), y el App muestra el raster orden-vs-rpm resultante en la pestaña Campbell del modo de segmento real; el re-muestreo en vivo en el navegador no está implementado. Las razones de orden son exactas (geometría del rodamiento); el raster es de los segmentos medidos, etiquetado como tal.'
          : 'This app\'s order tracking is computed offline in the pipeline (angular resampling from Ottawa\'s tachometer, channel 2), and the App shows the resulting order-vs-rpm raster in the Campbell tab of the real-segment mode; live in-browser resampling is not implemented. The order ratios are exact (bearing geometry); the raster is from the measured segments, labelled as such.'}</p>
      </Callout>
      <Refs ids={['randall2011']} label={refsLabel} />
    </div>
  );

  const tabs = [
    { id: 'env', label: es ? 'Envolvente / SES' : 'Envelope / SES', content: envTab },
    { id: 'sk', label: es ? 'Kurtosis espectral / Kurtograma' : 'Spectral kurtosis / Kurtogram', content: skTab },
    { id: 'cs', label: es ? 'Cicloestacionario' : 'Cyclostationary', content: csTab },
    { id: 'ot', label: es ? 'Order tracking / velocidad variable' : 'Order tracking / varying speed', content: otTab },
    { id: 'decomp', label: es ? 'Descomposición / Deconvolución' : 'Decomposition / Deconvolution', content: decompTab },
    { id: 'rul', label: es ? 'Pronóstico / RUL + ISO' : 'Prognostics / RUL + ISO', content: rulTab },
    { id: 'ml', label: es ? 'ML / Deep Learning' : 'ML / Deep Learning', content: mlTab },
  ];

  return (
    <div className="page-body">
      <div className="page-head prose">
        <h1>{es ? 'Metodología' : 'Methodology'}</h1>
        <p className="lede">
          {es
            ? 'El paisaje de métodos de diagnóstico y pronóstico, de lo clásico a lo SOTA, con la narrativa rigurosa, las ecuaciones término a término, las definiciones exactas que usa este build y diagramas de flujo de señal. Lo que es física exacta y transferible se distingue siempre de lo que es ilustrativo y sintético.'
            : 'The diagnosis & prognostics method landscape, classical to SOTA, with rigorous narrative, term-by-term equations, the exact definitions this build uses, and signal-flow diagrams. What is exact, transferable physics is always distinguished from what is illustrative and synthetic.'}{' '}
          <InlineMath tex={String.raw`f_r=\mathrm{rpm}/60`} />
        </p>
      </div>
      <Tabs tabs={tabs} ariaLabel="methodology" />
    </div>
  );
}
