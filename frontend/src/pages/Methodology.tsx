import { Tabs, Callout, Equation, InlineMath, Refs, useShellLang } from '@fasl-work/caos-app-shell';

export default function Methodology() {
  const es = useShellLang() === 'es';
  const refsLabel = 'Refs';

  // ============================================================
  // ENVELOPE / SES
  // ============================================================
  const envTab = (
    <div className="prose">
      <p>{es
        ? 'Un defecto localizado de rodamiento —una picadura o descascarillado en una pista, o en un elemento rodante— no es una fuente de tono. Cada vez que un elemento rodante cargado pasa sobre el borde del defecto produce un breve choque mecánico, un impulso de microsegundos. Ese impulso no es lo que mide directamente el acelerómetro; en su lugar excita el modo estructural de alta frecuencia más cercano de la carcasa y la máquina, una resonancia poco amortiguada. La señal medida es entonces un tren de ráfagas resonantes que decaen: una portadora rápida (la resonancia) cuya amplitud se enciende, una vez por impacto, a la lenta tasa de repetición del defecto. Esto es, por construcción, modulación en amplitud, y la información de falla vive en cuándo ocurren las ráfagas, no en la frecuencia portadora misma, que es propiedad de la estructura.'
        : 'A localized bearing defect — a spall or pit on a raceway, or on a rolling element — is not a tone source. Each time a loaded rolling element rolls over the defect edge it produces a brief mechanical shock, an impulse lasting microseconds. That impulse is not what the accelerometer measures directly; instead it rings the nearest high-frequency structural mode of the housing and machine, a lightly damped resonance. So the measured signal is a train of decaying resonance bursts: a fast carrier (the resonance) whose amplitude is switched on, once per impact, at the slow defect-repetition rate. This is, by construction, amplitude modulation, and the fault information lives in when the bursts happen, not in the carrier frequency itself, which is a property of the structure.'}</p>

      <p>{es
        ? 'Como la energía de falla se concentra alrededor de la resonancia y el resto del espectro lo dominan contenidos ajenos al rodamiento —desbalance del eje y sus armónicos a baja frecuencia, tonos de engrane, ruido de banda ancha— primero aislamos la banda de resonancia [f₁, f₂]. Esta es la decisión de mayor consecuencia de toda la cadena: demodular la banda equivocada produce un espectro de envolvente plano y ambiguo, el modo de falla dominante del análisis de envolvente y la razón misma de existir del kurtograma. Este build aplica un pasa-banda de pared vertical implementado en el dominio FFT: transforma la señal, pone a cero todo bin cuya magnitud de frecuencia caiga fuera de [f₁, f₂] (tratando idénticamente los bins simétricos de frecuencia negativa vía |f|) e invierte la transformada. Una pared vertical es honesta sobre lo que hace —conserva exactamente la banda pedida— a costa de oscilación en el dominio temporal; es el selector de banda correcto más simple, que es justo lo que quiere una herramienta didáctica explicable en navegador.'
        : 'Because the fault energy concentrates around the resonance and the rest of the spectrum is dominated by content unrelated to the bearing — shaft imbalance and its harmonics at low frequency, gear-mesh tones, broadband noise — we first isolate the resonance band [f₁, f₂]. This is the single most consequential decision in the whole pipeline: demodulating the wrong band yields a flat, ambiguous envelope spectrum, the dominant failure mode of envelope analysis and the very reason the kurtogram exists. This build applies a brick-wall band-pass implemented in the FFT domain: it transforms the signal, zeros every bin whose frequency magnitude falls outside [f₁, f₂] (treating the symmetric negative-frequency bins identically via |f|), and inverse-transforms. A brick-wall gate is honest about what it does — it keeps exactly the requested band — at the cost of time-domain ringing; it is the simplest correct band selector, which is exactly what an explainable in-browser teaching tool wants.'}</p>

      <p>{es
        ? 'Una vez aislada la banda, hay que recuperar su envolvente: la amplitud lentamente variable que lleva los impactos. La herramienta rigurosa es la señal analítica. Para una señal pasa-banda real x_bp(t), la señal analítica z(t) = x_bp(t) + j·H{x_bp}(t) agrega como parte imaginaria la transformada de Hilbert (un desfase de 90° de cada componente). La magnitud |z(t)| es entonces la amplitud instantánea: exactamente la envolvente de la portadora, con la oscilación portadora ya removida. Este build no convoluciona con un núcleo de Hilbert; forma la señal analítica en el dominio de la frecuencia, lo que es exacto y barato: toma la FFT, deja DC y Nyquist sin cambio, duplica el semiespectro de frecuencias positivas y pone a cero las negativas, luego invierte. Anular las negativas reduce a la mitad la energía y duplicar las positivas la restaura, de modo que la parte real de z reproduce x_bp exactamente. Es la ruta FFT estándar a la transformada de Hilbert discreta.'
        : 'Having isolated the band, we must recover its envelope: the slowly varying amplitude that carries the impacts. The rigorous tool is the analytic signal. For a real band-pass signal x_bp(t), the analytic signal z(t) = x_bp(t) + j·H{x_bp}(t) appends, as imaginary part, the Hilbert transform (a 90° phase shift of every component). The magnitude |z(t)| is then the instantaneous amplitude: exactly the envelope of the carrier, with the carrier oscillation removed. This build does not convolve with a Hilbert kernel; it forms the analytic signal in the frequency domain, which is both exact and cheap: take the FFT, keep DC and Nyquist unchanged, double the positive-frequency half-spectrum, and zero the negatives, then inverse-transform. Zeroing the negatives halves the energy and doubling the positives restores it, so the real part of z reproduces x_bp exactly. This is the standard FFT route to the discrete Hilbert transform.'}</p>

      <Callout variant="honest" title={es ? 'Alcance honesto de este build' : 'Honest scope of this build'}>
        <p>{es
          ? 'El análisis clásico establece que la envolvente al cuadrado (y su espectro, el SES) es la cantidad teóricamente preferida: para una señal cicloestacionaria de segundo orden —que es lo que es una falla de rodamiento— el espectro de envolvente al cuadrado es un caso particular de la correlación espectral cíclica integrada, y elevar al cuadrado suprime el pedestal de ruido de banda ancha bajo los picos diagnósticos. Este build calcula el espectro diagnóstico a partir de la envolvente de magnitud |z(t)|, no de |z(t)|². Luego le resta la media y le aplica ventana de Hann antes de la FFT final, lo que elimina el gran término DC y reduce la fuga espectral para que las líneas discretas de falla resalten —la misma preocupación de pedestal/fuga que atiende el SES, manejada aquí en el paso de espectro de envolvente. El contenido de frecuencia cinemática descrito abajo es exacto; el modelado específico de amplitud es la variante de envolvente de magnitud, no el estimador estricto de envolvente al cuadrado.'
          : 'The classical analysis establishes that the squared envelope (and its spectrum, the SES) is the theoretically preferred quantity: for a second-order cyclostationary signal — which a bearing fault is — the squared-envelope spectrum is a special case of the integrated cyclic spectral correlation, and squaring suppresses the broadband noise pedestal beneath the diagnostic peaks. This build computes the diagnostic spectrum from the magnitude envelope |z(t)|, not from |z(t)|². It then mean-removes and Hann-windows that envelope before the final FFT, which removes the large DC term and reduces spectral leakage so the discrete fault lines stand out — the same pedestal/leakage concern the SES addresses, handled here in the envelope-spectrum step. The kinematic frequency content described below is exact; the specific amplitude shaping is the magnitude-envelope variant, not the strict squared-envelope estimator.'}</p>
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
        : 'Diagnosis does not just take the tallest peak. For each candidate fault with fundamental f₀ it measures harmonic prominence: at each of the first 5 harmonics it finds the local peak within a tolerance window and divides it by the median of the surrounding bins (a robust local baseline), then averages the per-harmonic ratios. The three faults act as mutual negative controls: a real fault stands far above the others, whereas pure noise lifts all three roughly equally. A verdict requires clearing an absolute gate of 4.5 and a relative gate of 1.7 over the runner-up; otherwise the verdict is healthy. This decision rule and the kinematic frequencies are exact, transferable facts. What is illustrative and synthetic is the demo-generator signal (a damped-resonance impulse train with ~0.5% per-interval slip jitter and a target SNR) and the run-to-failure severity/RUL trend (labeled synthetic). On a real measured record the same pipeline applies unchanged; only the input changes.'}</p>

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

        {/* STAGE 1 — RAW WAVEFORM */}
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

        {/* STAGE 2 — BAND-PASS */}
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

        {/* STAGE 3 — HILBERT ENVELOPE */}
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

        {/* STAGE 4 — MEAN-REMOVED HANN FFT */}
        <g transform="translate(560,52)">
          <rect width="160" height="120" rx="8" fill="var(--color-surface)" stroke="var(--color-border)" />
          <text x="80" y="18" textAnchor="middle" fontSize="12" fill="var(--color-fg)">{es ? 'Hann · FFT' : 'Hann · FFT'}</text>
          <g transform="translate(5,28)" clipPath="url(#envClip)">
            <path d="M2,58 C18,58 26,14 40,14 C54,14 62,58 78,58 C92,58 100,16 114,16 C128,16 136,58 148,58" fill="none" stroke="var(--color-good)" strokeWidth="1.5" />
            <line x1="2" y1="58" x2="148" y2="58" stroke="var(--color-border)" strokeWidth="0.6" />
          </g>
          <text x="80" y="112" textAnchor="middle" fontSize="9" fill="var(--color-fg-subtle)">{es ? 'media removida · FFT' : 'mean-removed FFT'}</text>
        </g>

        {/* STAGE 5 — ENVELOPE SPECTRUM with comb */}
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
        ? 'El análisis de envolvente es el caballo de batalla del diagnóstico de rodamientos, pero descansa sobre una decisión frágil: la elección de la banda de demodulación. Un defecto localizado produce un choque mecánico breve cada vez que un elemento pasa sobre él; ese choque es de banda ancha, pero la máquina actúa como filtro y la información de falla llega como un tren de ráfagas de alta frecuencia moduladas a la lenta frecuencia de repetición (BPFO, BPFI o 2×BSF). Para leer esa modulación primero hay que aislar la banda de resonancia, demodularla y recién entonces tomar el espectro. Si la banda es correcta, la línea de falla y sus armónicos resaltan limpiamente; si es incorrecta —demasiado baja (dominada por tonos deterministas de eje/engranaje) o fuera de la resonancia (dominada por ruido)— el espectro de envolvente queda plano o ambiguo. Elegir esta banda a ojo no escala y es el principal modo de falla del método.'
        : 'Envelope analysis is the workhorse of rolling-element bearing diagnosis, but it rests on one fragile decision: the choice of the demodulation band. A localized defect produces a short mechanical shock each time an element rolls over it; that shock is broadband in itself, but the machine acts as a filter and the fault information arrives as a train of high-frequency bursts amplitude-modulated at the slow fault-repetition rate (BPFO, BPFI, or 2×BSF). To read that modulation we must first isolate the resonance band, demodulate it, and only then take the spectrum. If the band is right, the fault line and its harmonics stand out cleanly; if the band is wrong — too low (dominated by deterministic shaft/gear tones) or off the resonance (dominated by noise) — the envelope spectrum is flat or ambiguous. Choosing this band by eye does not scale and is the single largest failure mode of the method.'}</p>

      <p>{es
        ? 'La idea que automatiza la elección es que la banda portadora de la falla es la más impulsiva. Una banda de resonancia limpia lleva una forma de onda con picos y silencios; una banda de solo ruido lleva fluctuaciones casi gaussianas. La curtosis en exceso cuantifica ese contraste: el cuarto momento central normalizado menos tres. El cociente m₄/m₂² es adimensional e invariante a escala, de modo que mide forma, no amplitud. La resta de 3 es el valor de referencia para una distribución gaussiana: así κ = 0 para ruido gaussiano, κ > 0 para una señal de colas pesadas/impulsiva, y κ < 0 para una de meseta plana. Las ráfagas de falla son de colas pesadas, por lo que una banda que las contiene da κ grande y positivo. Esta implementación calcula κ en una acumulación de dos pasadas de m₂ y m₄ y retorna 0 cuando la varianza es cero, protegiendo el caso degenerado de ventana constante.'
        : 'The insight that automates the choice is that the fault-bearing band is the most impulsive one. A clean resonance band carries a spiky, bursty waveform; a noise-only band carries near-Gaussian fluctuations. Excess kurtosis quantifies that contrast: the normalized fourth central moment minus three. The ratio m₄/m₂² is dimensionless and scale-invariant, so it measures shape, not amplitude. The subtraction of 3 is the reference value for a Gaussian distribution: thus κ = 0 for Gaussian noise, κ > 0 for a heavy-tailed/spiky signal, and κ < 0 for a flat-topped one. Bearing fault bursts are heavy-tailed, so a band carrying them yields large positive κ. This implementation computes κ in a two-pass accumulation of m₂ and m₄ and returns 0 when variance is zero, guarding the degenerate constant-window case.'}</p>

      <Equation tex={String.raw`\kappa = \frac{\frac{1}{N}\sum_{i=1}^{N}(x_i-\bar{x})^4}{\left(\frac{1}{N}\sum_{i=1}^{N}(x_i-\bar{x})^2\right)^2} - 3, \qquad \bar{x}=\frac{1}{N}\sum_{i=1}^{N}x_i`} caption={es ? 'curtosis en exceso; 0 para ruido gaussiano, > 0 impulsiva' : 'excess kurtosis; 0 for Gaussian noise, > 0 impulsive'} />

      <p>{es
        ? 'Un único valor de curtosis responde si esta banda es impulsiva, pero no conocemos la banda a priori. El kurtograma convierte la pregunta en una búsqueda: evalúa la curtosis de banda limitada sobre el plano bidimensional de frecuencia central f_c y ancho de banda Δf, y el máximo localiza la mejor banda de demodulación. Ambos ejes son necesarios porque una buena banda debe ser lo bastante ancha para capturar el decaimiento completo de cada impulso (una banda muy angosta estira el impulso en el tiempo y baja κ) y a la vez lo bastante angosta para excluir ruido y tonos deterministas (una banda muy ancha diluye la energía del impulso con contenido ajeno). El máximo de la superficie es el punto óptimo del compromiso sesgo-varianza. El kurtograma rápido lo hace tratable restringiendo el plano a un árbol de banco de filtros diádico —anchos de banda de la forma Δf = fs/2^(k+1) en el nivel k— de modo que toda la superficie se calcula en O(N log N) en lugar de una grilla densa.'
        : 'A single kurtosis value answers whether this band is impulsive, but we do not know the band a priori. The kurtogram turns the question into a search: it evaluates band-limited kurtosis over the two-dimensional plane of center frequency f_c and bandwidth Δf, and the maximum locates the best demodulation band. Both axes are needed because a good band must be wide enough to capture the full ring-down of each impulse (a too-narrow band stretches the impulse in time and lowers κ) yet narrow enough to exclude noise and deterministic tones (a too-wide band dilutes the impulse energy with non-fault content). The maximum of the surface is the bias-variance sweet spot. The fast kurtogram makes this tractable by restricting the plane to a dyadic filter-bank tree — bandwidths of the form Δf = fs/2^(k+1) at level k — so the whole surface is computed in O(N log N) instead of a dense grid.'}</p>

      <p>{es
        ? 'Este build implementa un kurtograma diádico pragmático que conserva la idea —un pavimentado diádico del eje de frecuencia— pero sustituye el banco de filtros analítico por primitivas transparentes y factibles en navegador. Para cada nivel k = 1…5 particiona la banda [0, fs/2] en 2^k bandas contiguas de igual ancho Δf_k = (fs/2)/2^k. Cada celda se evalúa con la primitiva de envolvente completa, no una aproximación: un pasa-banda de pared vertical en el dominio FFT a [f₁, f₂], luego la envolvente de Hilbert por señal analítica (conservando DC y Nyquist, duplicando positivas, anulando negativas), y luego la curtosis en exceso de esa envolvente. Es clave que la curtosis se toma sobre la envolvente, no sobre la señal cruda de la banda —la envolvente es la cantidad demodulada que el espectro posterior efectivamente consume, así que el puntaje de la celda mide la impulsividad exactamente de lo que será analizado en frecuencia. La celda de curtosis de envolvente máxima se selecciona y su [f₁, f₂] se vuelve la banda de demodulación.'
        : 'This build implements a pragmatic dyadic kurtogram that keeps the idea — a dyadic paving of the frequency axis — while substituting transparent, browser-feasible primitives for the analytic filter bank. For each level k = 1…5 it partitions the band [0, fs/2] into 2^k contiguous, equal-width bands of width Δf_k = (fs/2)/2^k. Each cell is evaluated with the full envelope primitive, not an approximation: an FFT-domain brick-wall band-pass to [f₁, f₂], then the analytic-signal Hilbert envelope (keeping DC and Nyquist, doubling positives, zeroing negatives), then the excess kurtosis of that envelope. Crucially, the kurtosis is taken on the envelope, not the raw band signal — the envelope is the demodulated quantity the downstream spectrum actually consumes, so the cell score measures impulsiveness of exactly the thing that will be spectrum-analyzed. The cell with maximum envelope kurtosis is selected and its [f₁, f₂] becomes the demodulation band.'}</p>

      <Callout variant="honest" title={es ? 'El guardia de banda baja, y exacto vs ilustrativo' : 'The low-band guard, and exact vs illustrative'}>
        <p>{es
          ? 'La implementación omite la porción más baja del espectro: para cualquier celda fija el borde inferior en max(f₁, 0.02·fs) y, si ese recorte consume la celda, la puntúa en cero. La razón es física: el extremo de baja frecuencia está dominado por contenido determinista (el fundamental del eje, sus armónicos, el engrane), periódico pero no impulsivo en el sentido de falla; si se deja, puede deprimir κ o producir un pico espurio. Excluir el 2% más bajo de la frecuencia de muestreo mantiene la búsqueda en las bandas de resonancia. Las frecuencias cinemáticas de falla (BPFO, BPFI, 2×BSF, FTF) calculadas desde la geometría del rodamiento y la velocidad del eje son física transferible. Las señales sobre las que corre la búsqueda son un modelo sintético con base física; la banda seleccionada y el κ reportado son salidas honestas del algoritmo real, pero el escalamiento de severidad y la RUL resultante son ilustrativos del generador sintético, no mediciones de una máquina física.'
          : 'The implementation skips the lowest portion of the spectrum: for any cell it clamps the lower edge to max(f₁, 0.02·fs) and, if that clamp swallows the cell, scores it zero. The reason is physical: the low-frequency end is dominated by deterministic content (the shaft fundamental, its harmonics, gear mesh), which is periodic but not impulsive in the fault sense; left in, it can depress κ or produce a spurious peak. Excluding the lowest 2% of the sampling rate keeps the search on the resonance bands. The kinematic fault frequencies (BPFO, BPFI, 2×BSF, FTF) computed from bearing geometry and shaft speed are transferable physics. The signals the search runs on are a physically-grounded synthetic model; the selected band and reported κ are honest outputs of the real algorithm, but the severity scaling and resulting RUL are illustrative properties of the synthetic generator, not measurements of a physical machine.'}</p>
      </Callout>

      <p>{es
        ? 'La fortaleza del kurtograma es también su punto ciego. La curtosis mide impulsividad, no periodicidad: premia a una banda por tener picos, pero no distingue un tren periódico de impulsos de falla de un transitorio aislado, un pico eléctrico, un golpe del sensor o ruido de fondo genuinamente no gaussiano. En esos casos el kurtograma puede señalar con confianza una banda sin falla diagnosticable. Esta es la motivación de los sucesores conscientes de cicloestacionariedad: el protrugram (maximiza la curtosis del espectro de envolvente), el autogram (curtosis de la autocorrelación de la envolvente al cuadrado) y el infogram (negentropía espectral que captura impulsividad y cicloestacionariedad juntas). Este build mitiga el problema aguas abajo: el diagnóstico no confía en un solo pico —puntúa cada falla candidata por la prominencia de sus primeros cinco armónicos contra la mediana local y exige superar un umbral absoluto de 4.5 y un margen relativo de 1.7 sobre la siguiente falla (usada como control negativo). Así, una banda impulsiva-pero-aperiódica no produce peine de armónicos, falla ambos umbrales y se reporta correctamente como sana.'
        : 'The kurtogram’s strength is also its blind spot. Kurtosis measures impulsiveness, not periodicity: it rewards a band for being spiky, but it cannot tell a periodic fault impulse train from a single isolated transient, an electrical spike, a sensor knock, or genuinely non-Gaussian background noise. In all of those cases the kurtogram can confidently point at a band that contains no diagnosable fault. This is the motivation for the cyclostationarity-aware successors: the protrugram (maximizes the kurtosis of the envelope spectrum), the autogram (kurtosis of the autocorrelation of the squared envelope), and the infogram (spectral negentropy capturing impulsiveness and cyclostationarity jointly). This build mitigates the issue downstream: the diagnosis does not trust a single peak — it scores each candidate fault by the prominence of its first five harmonics against the local median and requires the top fault to clear an absolute gate of 4.5 and beat the next-best fault (used as a negative control) by a relative factor of 1.7. So a band that is impulsive-but-aperiodic produces no harmonic comb, fails both gates, and is correctly reported as healthy.'}</p>

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
          {es ? 'Plano del kurtograma — curtosis(k, f)' : 'Kurtogram plane — kurtosis(k, f)'}
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

      <Refs ids={['antoni2006sk', 'antoni2007', 'antoni2017fastsc', 'moshrefzadeh2018autogram', 'antoni2016infogram', 'randall2011', 'smith2015']} label={refsLabel} />
    </div>
  );

  // ============================================================
  // CYCLOSTATIONARY
  // ============================================================
  const csTab = (
    <div className="prose">
      <p>{es
        ? 'Un descascarillado localizado en una pista produce un impacto mecánico cada vez que un elemento rodante pasa sobre él. Si la geometría fuese rígida y el deslizamiento nulo, esos impactos llegarían exactamente al período cinemático de falla y la señal sería estrictamente periódica. Los rodamientos reales no son así: los elementos deslizan una fracción de porcentaje, la velocidad de la jaula deriva, la zona de carga modula la fuerza de cada impacto y el ángulo de reentrada tiene jitter. El resultado es un tren de impulsos cuya tasa media de repetición es la frecuencia de falla, pero cuyos tiempos de llegada tienen pequeño jitter aleatorio y cuyas amplitudes son aleatorias. Un proceso así no es periódico —su forma de onda nunca se repite— pero sus estadísticas sí son periódicas: la varianza (energía) sube y baja al período de falla aunque la media no. Esa es la definición de un proceso cicloestacionario de segundo orden (CS2), y por eso el Fourier ordinario de la señal cruda rinde mal: la energía de falla se dispersa en una portadora de banda ancha y fase aleatoria, y solo su envolvente late a la tasa de falla.'
        : 'A localized spall on a race produces a mechanical impact every time a rolling element rolls over it. If the geometry were rigid and the slip zero, those impacts would arrive at exactly the kinematic fault period and the signal would be strictly periodic. Real bearings are not like that: rolling elements slip by a fraction of a percent, the cage speed wanders, the load zone modulates how hard each impact lands, and the re-entry angle jitters. The result is an impulse train whose average repetition rate is the fault frequency, but whose arrival times carry small random jitter and whose amplitudes are random. Such a process is not periodic — its waveform never repeats — yet its statistics are periodic: the variance (energy) rises and falls at the fault period even though the mean does not. That is the definition of a second-order cyclostationary (CS2) process, and it is why ordinary Fourier analysis of the raw signal under-performs: the fault energy is spread into a broadband, randomly-phased carrier, and only its envelope beats at the fault rate.'}</p>

      <p>{es
        ? 'La herramienta que hace visible la estructura CS2 es una transformada bidimensional, porque hay dos tipos distintos de frecuencia en juego. La primera es la frecuencia portadora f —la oscilación rápida que transporta la energía (la resonancia estructural, a menudo varios kHz). La segunda es la frecuencia cíclica α —la tasa lenta a la que esa portadora es modulada en amplitud (la tasa de repetición de la falla). La correlación espectral S_x(f, α) y su forma normalizada, la coherencia espectral cíclica γ_x(f, α), viven en este plano. La propiedad decisiva: una falla deposita energía como una cresta vertical —una banda de portadoras f todas moduladas a la misma frecuencia cíclica α = BPFO (o BPFI, 2·BSF, FTF y sus armónicos). La cresta es vertical porque el impacto excita cualesquiera resonancias que ofrezca el camino de transmisión, de modo que la falla se reparte entre muchas portadoras pero queda anclada a una sola frecuencia cíclica. Esa es la firma geométrica de la cicloestacionariedad.'
        : 'The tool that makes CS2 structure visible is a two-dimensional transform, because there are two distinct kinds of frequency at play. The first is the carrier frequency f — the fast oscillation that carries the energy (the structural resonance, often several kHz). The second is the cyclic frequency α — the slow rate at which that carrier is amplitude-modulated (the fault repetition rate). The spectral correlation S_x(f, α) and its normalized form, the cyclic spectral coherence γ_x(f, α), live on this plane. The decisive property: a fault deposits energy as a vertical ridge — a band of carriers f all modulated at the same cyclic frequency α = BPFO (or BPFI, 2·BSF, FTF, and their harmonics). The ridge is vertical because the impact rings up whatever resonances the transmission path offers, so the fault is spread across many carriers but pinned to one cyclic frequency. That is the geometric signature of cyclostationarity.'}</p>

      <p>{es
        ? 'El contenido determinista se comporta distinto, y ése es el punto. Un desbalance de eje, un armónico de desalineamiento o un tono de engrane son periódicos de primer orden: son un tono puro, su energía se ubica en una sola portadora f y contribuye al eje α = 0 (el espectro de potencia ordinario vive en ese borde inferior). No se difuminan verticalmente entre portadoras, porque no modulan una resonancia de banda ancha: son la línea. Así que al mirar hacia arriba del plano (lejos de α = 0) el bosque determinista de líneas de engrane y eje desaparece, y solo sobreviven las familias genuinamente moduladas y de fase aleatoria. Un pico coincidente que cae cerca de BPFO pero que en realidad es interferencia eléctrica o una banda lateral de engrane no formará una cresta vertical coherente en α = BPFO. Éste es el discriminador riguroso: el plano cíclico no pregunta si hay energía cerca de la frecuencia de falla, sino si la energía en la frecuencia de falla organiza toda una banda de portadoras —algo mucho más difícil de falsificar.'
        : 'Deterministic content behaves differently, and that is the point. A shaft imbalance, a misalignment harmonic, or a gear-mesh tone is first-order periodic: it is a pure tone, its energy sits at one carrier f and contributes to the α = 0 axis (the ordinary power spectrum lives on that bottom edge). It does not smear vertically across carriers, because it is not modulating a broadband resonance — it is the line. So when you look up the plane (away from α = 0) the deterministic forest of gear and shaft lines drops away, and only genuinely modulated, randomly-phased families survive. A coincidental peak that lands near BPFO but is really electrical pickup or a gear sideband will not form a coherent vertical ridge at α = BPFO. This is the rigorous discriminator: the cyclic plane asks not whether there is energy near the fault frequency, but whether energy at the fault frequency is organizing a whole band of carriers — a far harder thing to fake.'}</p>

      <p>{es
        ? 'El mapa (f, α) es la imagen más rica del diagnóstico, pero es bidimensional y difícil de leer de un vistazo. Su producto de cara al usuario es una marginal unidimensional: integrar la coherencia cíclica sobre el eje de portadoras f colapsa las crestas verticales en picos sobre un eje α. Éste es el espectro de envolvente mejorado (EES). El contraste con el análisis de envolvente clásico es fundamental: el clásico obliga a elegir una banda de demodulación —la única mejor resonancia del kurtograma— y descarta toda otra portadora informativa; si eliges mal la banda, el espectro queda plano. La marginal integrada en banda fusiona todas las portadoras informativas automáticamente: cualquier resonancia que la falla module aporta su evidencia al mismo pico α = BPFO. Por eso el EES revela armónicos que un espectro de envolvente de banda única no ve, y por eso se degrada con gracia bajo ruido. El resultado de que el espectro de envolvente al cuadrado es un caso particular de la coherencia cíclica integrada sobre la portadora es esta relación formalizada: el SES clásico es la versión restringida en banda de esta marginal.'
        : 'The (f, α) map is the richest image in diagnostics, but it is two-dimensional and hard to read at a glance. Its user-facing product is a one-dimensional marginal: integrating the cyclic coherence over the carrier axis f collapses the vertical ridges into peaks on an α axis. This is the enhanced envelope spectrum (EES). The contrast with classical envelope analysis is fundamental: the classical method forces you to pick one demodulation band — the kurtogram’s single best resonance — and throws away every other informative carrier; pick the wrong band and the spectrum is flat. The band-integrated marginal instead fuses all informative carriers automatically: any resonance the fault modulates contributes its evidence to the same α = BPFO peak. That is why the EES reveals fault harmonics a single-band envelope spectrum misses, and why it degrades gracefully under noise. The result that the squared-envelope spectrum is a special case of the cyclic coherence integrated over carrier frequency is exactly this relationship made formal: the classical SES is the band-restricted version of this marginal.'}</p>

      <Callout variant="honest" title={es ? 'Qué calcula este build, y dónde es más débil que el Fast-SC' : 'What this build computes, and where it is weaker than the full Fast-SC'}>
        <p>{es
          ? 'Este build no calcula la correlación espectral completa sobre una grilla fina (f, α) —el método más pesado de la caja de herramientas. La elección honesta y factible en navegador es el estimador del espectro de modulación cíclica (CMS), y la página está etiquetada como tal. El pipeline: una transformada de Fourier de tiempo corto con ventana de Hann de 128 muestras y salto de 8; para cada trama y cada bin portador f se forma la potencia instantánea |STFT(t, f)|²; luego, por cada portadora, se remueve la media y se toma la transformada de Fourier de esa serie potencia-contra-tiempo, cuyo eje de frecuencia es α. La magnitud en α, normalizada por la potencia media de esa portadora, es el valor CMS en (f, α). El eje cíclico se muestrea a la tasa de tramas fs/salto, hasta un α_max configurable (800 Hz por defecto). Esta es la respuesta más limpia posible a si la señal es cicloestacionaria al período de falla que aún corre en vivo en un navegador. Sus límites honestos: la resolución cíclica está atada al largo del registro y a la tasa de tramas; el CMS solo captura la cicloestacionariedad que sobrevive a la magnitud |STFT|² por portadora, descartando la coherencia de fase entre portadoras que la verdadera correlación espectral conserva; y, como todo método cíclico aquí, asume velocidad aproximadamente constante (bajo arranque/parada el remedio correcto es el análisis en dominio de orden, no realizado aquí). Las relaciones de frecuencia que marca son exactas y transferibles; la severidad sintética y cualquier tendencia de run-to-failure son ilustrativas.'
          : 'This build does not compute the full spectral correlation over a fine (f, α) grid — the heaviest method in the toolbox. The honest, browser-feasible choice is the cyclic modulation spectrum (CMS) estimator, and the page is labeled as such. The pipeline: a short-time Fourier transform with a 128-sample Hann window and a hop of 8; for each frame and carrier bin f form the instantaneous power |STFT(t, f)|²; then, per carrier, remove the mean and take the Fourier transform of that power-versus-time series, whose frequency axis is α. The magnitude at α, normalized by the mean power of that carrier, is the CMS value at (f, α). The cyclic axis is sampled at the frame rate fs/hop, up to a configurable α_max (800 Hz by default). This is the cleanest possible answer to whether the signal is cyclostationary at the fault period that still runs live in a browser. Its honest limits: cyclic resolution is tied to record length and frame rate; the CMS only captures cyclostationarity that survives the |STFT|² magnitude per carrier, discarding the cross-carrier phase coherence the true spectral correlation retains; and, like every cyclic method here, it assumes roughly constant speed (under run-up/run-down the correct fix is order-domain analysis, not performed here). The frequency relations it marks are exact and transferable; the synthetic severity and any run-to-failure trend are illustrative.'}</p>
      </Callout>

      <Equation tex={String.raw`S_x(f,\alpha) = \lim_{T\to\infty}\frac{1}{T}\,\mathbb{E}\!\left[ X_T\!\left(f+\tfrac{\alpha}{2}\right) X_T^{*}\!\left(f-\tfrac{\alpha}{2}\right)\right]`} caption={es ? 'correlación espectral; en α = 0 se reduce a la densidad espectral de potencia' : 'spectral correlation; at α = 0 it reduces to the power spectral density'} />

      <Equation tex={String.raw`\gamma_x(f,\alpha) = \frac{S_x(f,\alpha)}{\sqrt{S_x\!\left(f+\tfrac{\alpha}{2},0\right)S_x\!\left(f-\tfrac{\alpha}{2},0\right)}}, \qquad 0 \le |\gamma_x(f,\alpha)| \le 1`} caption={es ? 'coherencia espectral cíclica: S_x normalizada a [0,1]' : 'cyclic spectral coherence: S_x normalized to [0,1]'} />

      <Equation tex={String.raw`\widehat{\mathrm{CMS}}(f,\alpha) = \frac{\big|\,\mathcal{F}_{t\to\alpha}\!\big\{\,|S(t,f)|^{2}-\overline{|S(\cdot,f)|^{2}}\,\big\}\big|}{N_t\cdot\overline{|S(\cdot,f)|^{2}}}, \qquad \mathrm{EES}(\alpha) = \sum_{f}\widehat{\mathrm{CMS}}(f,\alpha)`} caption={es ? 'lo que estima este build: el CMS por portadora y su marginal integrada en banda, el EES' : 'what this build estimates: the per-carrier CMS and its band-integrated marginal, the EES'} />

      <p>{es
        ? 'Símbolos: f es la frecuencia portadora (Hz), la oscilación rápida que transporta energía; α es la frecuencia cíclica (Hz), la tasa a la que se modula la portadora (la tasa de repetición de falla); S(t, f) es la STFT en la trama t y el bin portador f (Hann, N = 128, salto 8); |S(t, f)|² es la potencia instantánea de la portadora f; la barra denota la media sobre tramas de esa potencia (el normalizador tipo coherencia, acotado por debajo); F_{t→α} es la transformada de Fourier de la serie de potencia con media removida a lo largo del eje de tramas; N_t es el número de tramas; y el EES(α) es el CMS sumado sobre portadoras, con picos en BPFO/BPFI/2·BSF/FTF y armónicos.'
        : 'Symbols: f is the carrier frequency (Hz), the fast oscillation carrying energy; α is the cyclic frequency (Hz), the rate at which the carrier is modulated (the fault repetition rate); S(t, f) is the STFT at frame t and carrier bin f (Hann, N = 128, hop 8); |S(t, f)|² is the instantaneous power of carrier f; the overbar denotes the over-frames mean of that power (the coherence-like normalizer, floored below); F_{t→α} is the Fourier transform of the mean-removed power series along the frame axis; N_t is the number of frames; and EES(α) is the CMS summed over carriers, peaking at BPFO/BPFI/2·BSF/FTF and harmonics.'}</p>

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
        <text x="78" y="54" fill="var(--color-fg-faint)" fontSize="10">{es ? '(tonos de engrane/eje — sin dispersión vertical)' : '(gear-mesh / shaft tones — no vertical spread)'}</text>

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
          {es ? 'pico aislado — sin coherencia vertical → rechazado' : 'isolated peak — no vertical coherence → rejected'}
        </text>

        <text x="70" y="478" fill="var(--color-fg)" fontSize="12">
          {es ? 'EES(α) = Σ_f CMS(f, α) — marginal integrada en portadora' : 'EES(α) = Σ_f CMS(f, α) — carrier-integrated marginal'}
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

      <Refs ids={['randall2011', 'antoni2007csc', 'antoni2017fastsc', 'borghesani2013', 'borghesani2013ses', 'antoni2006sk', 'smith2015']} label={refsLabel} />
    </div>
  );

  // ============================================================
  // DECOMPOSITION / DECONVOLUTION
  // ============================================================
  const decompTab = (
    <div className="prose">
      <p>{es
        ? 'Una falla localizada es, en su origen, un tren casi periódico de impulsos de fuerza agudos: cada vez que un elemento pasa sobre la picadura se produce un escalón en la fuerza de contacto. Cuando esa fuerza llega al acelerómetro ya ha sido convolucionada con la ruta de transmisión: el impulso hace resonar de forma amortiguada, recoge tonos deterministas de la caja de engranajes y queda enterrado bajo ruido. Dos ataques complementarios recuperan el tren de impulsos. La descomposición divide la señal en una base de componentes y conserva solo el que porta el contenido impulsivo. La deconvolución ciega estima un filtro inverso que deshace la ruta de transmisión, reafilando la resonancia amortiguada hacia los picos originales. Ambos terminan donde termina la cadena en vivo: una banda limpia cuya envolvente de Hilbert se transforma por FFT en un espectro de envolvente donde se lee la línea de falla y sus armónicos.'
        : 'A localized fault is, at the source, a near-periodic train of sharp force impulses: every time an element rolls over the spall it produces a step in the contact force. By the time that force reaches the accelerometer it has been convolved with the transfer path: the impulse rings down a damped resonance, picks up the gearbox’s deterministic tones, and is buried under noise. Two complementary attacks recover the impulse train. Decomposition splits the signal into a basis of components and keeps only the one carrying the impulsive content. Blind deconvolution estimates an inverse filter that undoes the transmission path, re-sharpening the rung-down resonance back toward the original spikes. Both end where the live pipeline ends: a clean band whose Hilbert envelope is FFT’d into an envelope spectrum where the fault line and its harmonics are read off.'}</p>

      <p>{es
        ? 'La demodulación en vivo usa un pasa-banda de pared vertical en el dominio FFT, y el kurtograma encuentra la banda maximizando la curtosis en exceso de la envolvente de Hilbert sobre niveles diádicos 1 a 5. Pero un pasa-banda no puede separar dos fenómenos que comparten la misma banda, ni reformar un transitorio difuminado. Cuando un tono de engrane cae dentro de la mejor banda, o cuando la falla es tan incipiente que sus impulsos son más débiles que el ruido en todas las bandas, la envolvente de banda única queda ambigua. La descomposición y la deconvolución existen para ese régimen: son adaptativas, no fijas, y explotan estructura (impulsividad, periodicidad, cicloestacionariedad) a la que un filtro de pared vertical es ciego.'
        : 'The live demodulation uses a brick-wall band-pass in the FFT domain, and the kurtogram finds the band by maximizing the excess kurtosis of the Hilbert envelope over dyadic levels 1 to 5. But a band-pass cannot separate two phenomena that share the same band, nor reshape a smeared transient. When a gear-mesh tone sits inside the best band, or when the fault is so early that its impulses are weaker than the noise in every band, the single-band envelope is ambiguous. Decomposition and deconvolution exist for that regime: they are adaptive, not fixed, and they exploit structure (impulsiveness, periodicity, cyclostationarity) that a brick-wall filter is blind to.'}</p>

      <p>{es
        ? 'Descomposición I — la familia de modo empírico (EMD/EEMD/CEEMDAN). EMD es puramente adaptativa: tamiza la señal interpolando envolventes de spline cúbico por los máximos y mínimos locales, restando su media e iterando hasta una Función de Modo Intrínseco (IMF), un componente con envolvente simétrica e igual número de extremos que de cruces por cero. La IMF que porta la falla es la de mayor curtosis, el mismo criterio de impulsividad del kurtograma. El EMD simple sufre mezcla de modos: un impulso intermitente puede partirse entre IMFs. EEMD lo corrige por asistencia de ruido —agrega muchas realizaciones de ruido blanco, corre EMD en cada una y promedia. CEEMDAN agrega el ruido de forma adaptativa, etapa por etapa, y resta el residual del ensemble en cada paso. El costo honesto: corren decenas de pasadas iterativas, no reproducibles bit-a-bit entre implementaciones, sin teoría cerrada; por eso esta familia es un artefacto precomputado/offline, no una transformada en vivo.'
        : 'Decomposition I — the empirical mode family (EMD/EEMD/CEEMDAN). EMD is purely adaptive: it sifts the signal by interpolating cubic-spline envelopes through local maxima and minima, subtracting their mean, and iterating until an Intrinsic Mode Function (IMF) — a component with a symmetric envelope and equal numbers of extrema and zero-crossings. The fault-bearing IMF is the one with the highest kurtosis, the same impulsiveness criterion the kurtogram uses. Plain EMD suffers mode mixing: an intermittent impulse can split across IMFs. EEMD fixes this by noise assistance — adding many white-noise realizations, running EMD on each, and averaging. CEEMDAN adds the noise adaptively, stage by stage, and subtracts the ensemble residual at each step. The honest cost: tens of iterative passes, not bit-reproducible across implementations, no closed-form theory; so this family is a precompute/offline artifact, not a live transform.'}</p>

      <p>{es
        ? 'Descomposición II — VMD como problema variacional. La Descomposición Variacional de Modos reemplaza el tamizado recursivo por una sola optimización: supone que la señal es suma de K modos, cada uno de banda limitada y compacto en torno a una frecuencia central desconocida ω_k, y pide los modos y centros que minimizan el ancho de banda total sujeto a reconstrucción exacta. El ancho de banda de un modo se mide por la norma L2 al cuadrado del gradiente temporal de la banda base de su señal analítica. Es la misma idea de señal analítica que usa la envolvente de Hilbert, pero convertida en objetivo. El problema con restricción se resuelve por ADMM. El resultado es mucho más robusto al ruido y a la mezcla de modos que EMD porque cada modo es forzado a ser de banda estrecha por construcción. El precio son dos hiper-parámetros: K y la penalización de ancho de banda α. Con K y α fijos, VMD sobre un segmento enventanado es lo bastante liviano para correr en vivo; barrer K/α para autoajustarlos es offline.'
        : 'Decomposition II — VMD as a variational problem. Variational Mode Decomposition replaces the recursive sift with a single optimization: it assumes the signal is a sum of K modes, each band-limited and compact around an unknown center frequency ω_k, and asks for the modes and centers that minimize the total bandwidth subject to exact reconstruction. A mode’s bandwidth is measured by the squared L2 norm of the time-gradient of its analytic-signal baseband. It is the same analytic-signal idea the Hilbert envelope uses, turned into an objective. The constrained problem is solved by ADMM. The result is far more robust to noise and mode mixing than EMD because each mode is forced to be narrow-band by construction. The price is two hyper-parameters: K and the bandwidth penalty α. With K and α fixed, VMD on a windowed segment is light enough to run live; sweeping K/α to auto-tune them is offline.'}</p>

      <p>{es
        ? 'Descomposición III — paquetes wavelet y SSA. La transformada de paquetes wavelet divide en cada nivel tanto la mitad de baja como la de alta frecuencia en un árbol binario uniforme de sub-bandas de igual ancho, a diferencia de la DWT simple. Ese embaldosado uniforme pone resolución fina justo donde están las resonancias del rodamiento, y la banda de falla se elige rankeando nodos por energía o curtosis: la misma lógica diádica-más-curtosis del kurtograma, pero con filtros wavelet de sub-banda apropiados. El Análisis de Espectro Singular toma otra vía: encaja la señal 1-D en una matriz de trayectoria de Hankel, toma su SVD y agrupa las eigentriples; conservar las oscilatorias de alta energía y descartar el ruido aísla el contenido de impacto periódico antes del análisis de envolvente. SSA es no paramétrica e inmune al ruido, pero su SVD sobre una matriz larga es costosa, así que SSA de ventana pequeña es en vivo y la de ventana grande se precomputa.'
        : 'Decomposition III — wavelet packets and SSA. The wavelet packet transform splits both the low- and high-frequency halves at every level into a uniform binary tree of equal-bandwidth sub-bands, unlike the plain DWT. That uniform paving puts fine resolution exactly where bearing resonances sit, and the fault band is chosen by ranking nodes on energy or kurtosis: the same dyadic-band-plus-kurtosis logic as the kurtogram, but with proper wavelet sub-band filters. Singular Spectrum Analysis takes another route: it embeds the 1-D signal into a Hankel trajectory matrix, takes its SVD, and groups the eigentriples; keeping the high-energy oscillatory ones and discarding noise isolates the periodic-impact content before envelope analysis. SSA is non-parametric and noise-immune, but its SVD on a long matrix is costly, so small-window SSA is live and large-window SSA precomputes.'}</p>

      <p>{es
        ? 'Deconvolución ciega I — maximización de curtosis (MED). La Deconvolución de Mínima Entropía diseña un filtro FIR f para que la salida y = f * x sea máximamente impulsiva, medida por curtosis. La premisa es el argumento de ruta inversa: la fuente era puntiaguda, la ruta la difuminó, así que el filtro que vuelve a hacer la salida puntiaguda aproxima la inversa de la ruta. Se resuelve como iteración de punto fijo y es totalmente ciego: no necesita el período de falla. Su falla característica es el reverso de su premisa: con un filtro largo, la curtosis se maximiza con un pico gigante, así que MED colapsa el tren periódico en un solo impulso y un pico eléctrico espurio puede capturar todo el filtro.'
        : 'Blind deconvolution I — kurtosis maximization (MED). Minimum Entropy Deconvolution designs an FIR filter f so the output y = f * x is maximally impulsive, measured by kurtosis. The premise is the inverse-path argument: the source was spiky, the path blurred it, so the filter that makes the output spiky again approximates the path’s inverse. It is solved as a fixed-point iteration and is fully blind: it needs no fault period. Its signature failure is the flip side of its premise: with a long filter, kurtosis is maximized by one giant spike, so MED collapses the periodic train onto a single impulse and a stray electrical spike can capture the whole filter.'}</p>

      <p>{es
        ? 'Deconvolución ciega II — apuntar al período (MCKD, MOMEDA, CYCBD). El arreglo es premiar la salida por ser puntiaguda y repetirse al período de falla. MCKD reemplaza la curtosis por curtosis correlacionada a un período T y orden de desplazamiento M: multiplica la salida por copias desplazadas de sí misma separadas T, de modo que un solo impulso no puntúa. Cura el colapso de MED, pero es semi-ciego: hay que entregar T. MOMEDA convierte el diseño en una sola resolución de forma cerrada: especifica un tren de impulsos objetivo y resuelve directamente, sin iteración. Como cada período es una resolución matricial, se puede barrer el período supuesto y graficar un espectro MOMEDA cuyos picos revelan el período en vez de asumirlo. CYCBD vuelve a cambiar el objetivo: maximiza la cicloestacionariedad de segundo orden en frecuencias cíclicas objetivo, como problema de autovalores generalizado. Es el más fiel físicamente, porque un tren de falla real tiene pequeño jitter de período (deslizamiento) —el modelo sintético inyecta justo eso, ~0.5% por intervalo— y CYCBD apunta a esa estructura directamente.'
        : 'Blind deconvolution II — targeting the period (MCKD, MOMEDA, CYCBD). The fix is to reward the output for being spiky and repeating at the fault period. MCKD replaces kurtosis with correlated kurtosis at a period T and shift order M: it multiplies the output by shifted copies of itself spaced T apart, so a single impulse scores nothing. This cures MED’s collapse, but it is semi-blind: you must supply T. MOMEDA turns the design into a single closed-form solve: it specifies a target impulse train and solves directly, with no iteration. Because each period is one matrix solve, you can scan the assumed period and plot a MOMEDA spectrum whose peaks reveal the period rather than assuming it. CYCBD changes the objective again: it maximizes second-order cyclostationarity at target cyclic frequencies, as a generalized eigenvalue problem. It is the most physically faithful, because a real fault train has small period jitter (slip) — the synthetic model injects exactly that, ~0.5% per interval — and CYCBD targets that structure directly.'}</p>

      <Callout variant="honest" title={es ? 'La escalera de criterios y qué es exacto vs ilustrativo' : 'The criterion ladder and what is exact vs illustrative'}>
        <p>{es
          ? 'Cada método termina eligiendo un componente o un filtro, por un criterio cuantitativo. La curtosis simple solo pregunta si es impulsivo: barata, totalmente ciega, pero no distingue un impulso de falla de un pico eléctrico. La curtosis correlacionada y la norma-D de MOMEDA preguntan si es impulsivo y periódico a este período: más específicas, pero necesitan el período. La cicloestacionariedad (el indicador de CYCBD, y la coherencia cíclica que este build aproxima con su espectro de modulación cíclica) pregunta si su energía está organizada en esta frecuencia cíclica: la más específica, pero necesita la frecuencia cíclica. La salvedad honesta: los métodos más potentes (MCKD, el modo objetivo de MOMEDA, CYCBD) no son totalmente ciegos —requieren la frecuencia o período de falla, que aquí se calcula desde la geometría del rodamiento y la velocidad del eje vía las relaciones cinemáticas (BPFO, BPFI, BSF, FTF). Esas relaciones son física exacta y transferible; la severidad sintética y las amplitudes de impulso resultantes están modeladas, no medidas. El diagnóstico aguas abajo no cambia según qué front-end produjo la banda limpia: prominencia por armónico promediada sobre los primeros cinco, con umbral absoluto de 4.5 y margen relativo de 1.7 sobre la siguiente falla como control negativo.'
          : 'Each method ends by choosing one component or one filter, by a quantitative criterion. Plain kurtosis asks only whether it is impulsive: cheap, fully blind, but it cannot tell a fault impulse from an electrical spike. Correlated kurtosis and the MOMEDA D-norm ask whether it is impulsive and periodic at this period: more specific, but they need the period. Cyclostationarity (the CYCBD indicator, and the cyclic coherence this build approximates with its cyclic modulation spectrum) asks whether its energy is organized at this cyclic frequency: the most specific, but it needs the cyclic frequency. The honest caveat: the most powerful methods (MCKD, MOMEDA’s targeted mode, CYCBD) are not fully blind — they require the fault frequency or period, which here is computed from bearing geometry and shaft speed via the kinematic relations (BPFO, BPFI, BSF, FTF). Those relations are exact, transferable physics; the synthetic severity and resulting impulse amplitudes are modeled, not measured. The downstream diagnosis is unchanged regardless of which front-end produced the clean band: per-harmonic prominence averaged over the first five, gated at an absolute prominence of 4.5 and a relative margin of 1.7 over the next-best fault as a negative control.'}</p>
      </Callout>

      <p>{es
        ? 'Qué es en vivo versus precomputado en este build: la línea divisoria es si el trabajo son unas pocas FFTs o una resolución iterativa/SVD/ensemble sobre un registro largo. En vivo: el pasa-banda, la envolvente de Hilbert por señal analítica, el espectro de magnitud, el kurtograma sobre niveles 1–5, la curtosis espectral por STFT, el cepstrum, el espectrograma y el espectro de modulación cíclica —todas cadenas FFT radix-2; VMD de parámetros fijos y SSA de ventana pequeña también. Precomputado: EMD/EEMD/CEEMDAN, MCKD/CYCBD, barridos finos de período de MOMEDA, correlación espectral cíclica sobre una grilla densa, y cualquier barrido de autoajuste. La regla: en el momento en que un método necesita iterar hasta converger, factorizar una matriz grande o barrer una grilla de parámetros, abandona el nivel interactivo y se vuelve un resultado precomputado que la página muestra.'
        : 'What is live versus precompute in this build: the dividing line is whether the work is a few FFTs or an iterative/SVD/ensemble solve on a long record. Live: the band-pass, the analytic-signal Hilbert envelope, the magnitude spectrum, the kurtogram over levels 1–5, the spectral kurtosis via STFT, the cepstrum, the spectrogram, and the cyclic modulation spectrum — all radix-2 FFT pipelines; fixed-parameter VMD and small-window SSA too. Precompute: EMD/EEMD/CEEMDAN, MCKD/CYCBD, MOMEDA fine period scans, cyclic spectral correlation over a dense grid, and any auto-tuning sweep. The rule: the moment a method needs to iterate to convergence, factorize a large matrix, or sweep a parameter grid, it leaves the interactive tier and becomes a precomputed result the page displays.'}</p>

      <Equation tex={String.raw`\hat{f} = \arg\max_{f}\; K(y),\quad y = f * x \qquad\text{(MED — fully blind)}`} caption={es ? 'MED: ningún período de falla aparece; puede colapsar en un solo impulso' : 'MED: no fault period appears; it can collapse onto a single impulse'} />

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

        {/* LEFT — DECOMPOSITION */}
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

        {/* RIGHT — DECONVOLUTION */}
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
        : 'Diagnosis answers what is wrong; prognosis answers how long until it matters. Both must collapse a high-dimensional vibration record into a few scalars that move monotonically with damage. This build constructs its health indicator (HI) from time-domain statistics. The root-mean-square RMS(x) = √(mean(xᵢ²)) tracks the total vibration energy and rises late, once a defect has spread; kurtosis tracks impulsiveness and rises early, when a single spall still produces sharp, sparse impacts, then paradoxically falls back toward 3 as the damage spreads and the impacts merge into a near-Gaussian roar. A spectral-kurtosis trend combines both virtues: it stays sensitive to localized impacts even after broadband RMS has saturated. The practical lesson, which this implementation honors, is that no single HI is monotone over the whole life, so the prognostic model is fit only to the late, monotone segment after onset.'}</p>

      <p>{es
        ? 'Un rodamiento pasa la mayor parte de su vida en una línea base plana y ruidosa donde no hay nada que extrapolar. Por eso la primera decisión de pronóstico es: ¿cuándo comienza la degradación? Es un problema de punto de cambio, y la literatura ofrece desde CUSUM y modelos bayesianos hasta la regla simple pero robusta de excedencia de línea base + kσ. Este build usa esta última, deliberadamente conservadora. Toma los primeros max(4, ⌊0.3n⌋) puntos como línea base sana, calcula su media μ y desviación σ, y declara el inicio en el primer índice donde dos puntos consecutivos superan μ + 4σ. El requisito de dos seguidos es la clave: un solo pico de 4σ casi siempre es un transitorio, y actuar sobre él produce falsas alarmas que destruyen la confianza del operador. Exigir una excursión sostenida convierte un umbral ruidoso en un detector de inicio utilizable. Hasta que se dispara el inicio, la función no devuelve proyección alguna —una máquina sana correctamente no produce ningún número de RUL, que es el comportamiento honesto.'
        : 'A bearing spends most of its life on a flat, noisy baseline where there is nothing to extrapolate. So the first prognostic decision is: when does degradation begin? This is a change-point problem, and the literature offers everything from CUSUM and Bayesian models to the simple but robust baseline + kσ exceedance rule. This build uses the latter, deliberately conservative. It takes the first max(4, ⌊0.3n⌋) points as the healthy baseline, computes their mean μ and standard deviation σ, and declares onset at the first index where two consecutive points exceed μ + 4σ. The two-in-a-row requirement is the whole point: a single 4σ spike is almost always a transient, and acting on it produces false alarms that destroy operator trust. Requiring a sustained excursion turns a noisy threshold into a usable onset detector. Until onset fires, the function returns no projection — a healthy machine correctly yields no RUL number, which is the honest behavior.'}</p>

      <p>{es
        ? 'Una vez detectado el inicio, el HI debe proyectarse hacia un umbral de fallo. La literatura ofrece una escalera de modelos de potencia y coste crecientes: un ajuste exponencial/ley de potencia simple; crecimiento de grieta por ley de Paris, físicamente fundamentado pero que requiere observar el tamaño de grieta; filtros de partículas y regresión por procesos gaussianos, que portan una posterior completa y producen incertidumbre dependiente del estado; y redes deep-RUL (LSTM/CNN) que aprenden el mapeo HI→RUL de muchas trayectorias. Cada peldaño compra incertidumbre mejor calibrada a costa de más datos y cómputo. Este build ajusta el modelo fundacional en la base de esa escalera, elegido porque es transparente, tiene tiempo de cruce en forma cerrada y coincide con el crecimiento exponencial de fin de vida empíricamente reportado para rodamientos. En concreto: sobre los puntos posteriores al inicio realiza mínimos cuadrados en espacio logarítmico, ln(HI) = ln a + b·t, que es exactamente un ajuste lineal. Ajustar en espacio log es deliberado: hace la optimización lineal y estable, y hace la dispersión residual multiplicativa, el modelo de ruido realista para una cantidad que crece en órdenes de magnitud. El modelo solo se acepta si la tasa de crecimiento b > 0; una pendiente no positiva significa que no está degradándose, y el build se niega a emitir un RUL ficticio.'
        : 'Once onset is detected, the HI must be projected toward a failure threshold. The literature offers a ladder of models of increasing power and cost: a simple exponential/power-law fit; Paris-law crack growth, physically grounded but needing a crack-size observable; particle filters and Gaussian-process regression, which carry a full posterior and produce state-dependent uncertainty; and deep-RUL networks (LSTM/CNN) that learn the HI→RUL map from many trajectories. Each step up buys better-calibrated uncertainty at the cost of more data and compute. This build fits the foundational model at the bottom of that ladder, chosen because it is transparent, has a closed-form crossing time, and matches the empirically exponential late-life growth reported for bearings. Concretely: on the post-onset points it does ordinary least squares in log space, ln(HI) = ln a + b·t, which is exactly a linear fit. Fitting in log space is deliberate: it makes the optimization linear and stable, and makes the residual spread multiplicative, the realistic noise model for a quantity that grows by orders of magnitude. The model is only accepted if the growth rate b > 0; a non-positive slope means not actually degrading, and the build refuses to emit a fictitious RUL.'}</p>

      <p>{es
        ? 'Con ln a y b en mano, el tiempo de fallo es el primer cruce de la curva media por el umbral HI_thr, que se invierte en forma cerrada: t_fail = (ln HI_thr − ln a)/b, y la vida útil remanente en la última observación es RUL = t_fail − t_now (fijada a cero si la curva ya cruzó). La banda de incertidumbre se construye a partir de la dispersión del residuo logarítmico: tras el ajuste se calcula la desviación estándar residual s = √(RSS/(m−2)) en escala log (el divisor m−2 es la corrección correcta de grados de libertad para un ajuste de dos parámetros), y luego se dibuja el abanico como exp(ln_mid ± 2s) en cada tiempo futuro. Como la banda es ±2σ en escala multiplicativa, es asimétrica en unidades lineales y se ensancha con el tiempo —exactamente la forma de la incertidumbre física cuando la propia tasa de crecimiento es incierta. El abanico se dibuja hasta ~1.15·t_fail, de modo que el cruce del umbral de las trazas inferior, central y superior enmarca un rango de tiempos de fallo plausibles en vez de un único instante de falsa precisión.'
        : 'With ln a and b in hand, the failure time is the first passage of the mean curve through the threshold HI_thr, which inverts in closed form: t_fail = (ln HI_thr − ln a)/b, and the remaining useful life at the last observation is RUL = t_fail − t_now (clamped to zero if the curve has already crossed). The uncertainty band is built from the log-residual spread: after fitting, the residual standard deviation s = √(RSS/(m−2)) on the log scale (the m−2 divisor is the correct degrees-of-freedom correction for a two-parameter fit), then the fan is drawn as exp(ln_mid ± 2s) at each future time. Because the band is ±2σ on a multiplicative scale, it is asymmetric in linear units and widens with time — exactly the shape physical uncertainty takes when a growth rate is itself uncertain. The fan is drawn forward to roughly 1.15·t_fail, so the threshold crossing of the lower, central, and upper traces brackets a range of plausible failure times rather than a single false-precision instant.'}</p>

      <Callout variant="honest" title={es ? 'La banda debe calibrarse y el umbral mismo es difuso' : 'The band must be calibrated and the threshold itself is fuzzy'}>
        <p>{es
          ? 'Un modo de fallo común y peligroso de las pantallas de RUL es un pronóstico demasiado confiado: una banda finísima que cruza el umbral en una hora nítida parece autoritativa pero casi siempre es falsa, porque ignora la incertidumbre dominante —que la tasa de crecimiento b se estimó de un puñado de puntos ruidosos. La banda de este build es honesta en dirección (se deriva de residuos reales y se ensancha), pero un despliegue en producción debe calibrarla: la cobertura empírica de la banda ±2σ debe verificarse contra trayectorias retenidas, de modo que el 95% de los fallos reales caiga dentro del abanico nominal del 95%. Igualmente, el umbral de fallo no es una constante física: ISO y la experiencia dan una región, no una línea, así que el umbral debe tratarse como difuso y el RUL reportarse como una distribución sobre tiempos de cruce. Los hechos exactos y transferibles son las relaciones de frecuencia (BPFO/BPFI/BSF a partir de geometría y velocidad de eje) y la forma del modelo; la severidad específica, los tiempos de inicio y los valores de RUL de la demostración son números sintéticos ilustrativos de un generador etiquetado, donde la severidad provoca un inicio más temprano y un crecimiento más rápido, y un caso sano no produce proyección —nunca mediciones de campo.'
          : 'A common and dangerous failure mode of RUL displays is a forecast that is too confident: a razor-thin band crossing the threshold at one crisp hour looks authoritative but is almost always fake, because it ignores the dominant uncertainty — that the growth rate b was estimated from a handful of noisy points. This build’s band is honest in direction (it is derived from real residuals and it widens), but a production deployment must calibrate it: the empirical coverage of the ±2σ band should be checked against held-out trajectories so that 95% of true failures actually fall inside the nominal 95% fan. Equally, the failure threshold is not a physical constant: ISO and bearing experience give a region, not a line, so the threshold should be treated as fuzzy and the RUL reported as a distribution over crossing times. The transferable, exact facts are the frequency relations (BPFO/BPFI/BSF from geometry and shaft speed) and the form of the model; the specific severity, onset times, and RUL values in the demonstration are illustrative synthetic numbers from a labeled generator, where severity drives an earlier onset and faster growth, and a healthy case yields no projection — never field measurements.'}</p>
      </Callout>

      <p>{es
        ? 'El pronóstico proyecta una tendencia; la capa de decisión ISO juzga el presente contra una escala acordada internacionalmente, y ambas son complementarias. La norma de severidad vigente (que reemplaza a su predecesora) evalúa la velocidad RMS de vibración de banda ancha en 10–1000 Hz medida en los alojamientos de los rodamientos, y clasifica la máquina en cuatro zonas: A recién puesta en marcha / como nueva, B aceptable para operación de largo plazo sin restricción, C no apta para operación continua —investigar y planificar acción correctiva, y D peligrosa —puede estar ocurriendo daño, actuar de inmediato. Los límites numéricos escalan con la clase de máquina, la potencia y el montaje. Para las máquinas mineras medianas que apunta esta suite — ISO 20816-3 Grupo 2, 15–300 kW sobre soporte rígido — las fronteras son A/B = 1.4 mm/s, B/C = 2.8 mm/s, C/D = 4.5 mm/s (RMS); las máquinas grandes Grupo 1 (&gt;300 kW, rígido) suben a 2.3 / 4.5 / 7.1, y los soportes flexibles las elevan aún más. El pequeño banco de calibración tras la señal sintética que se muestra aquí está bajo el alcance de 15 kW de ISO 20816-3 — a ese tamaño la escala correcta es ISO 10816-1 Clase I (0.71 / 1.8 / 4.5 mm/s); el marco A/B/C/D es idéntico, solo los límites numéricos se mueven con la clase de máquina. Operativamente, la frontera B/C es el setpoint natural de ALERTA y la C/D el setpoint de PELIGRO / disparo. Nótese la distinción de unidades que este build mantiene honesta: la capa ISO es velocidad RMS en mm/s, mientras que el HI de pronóstico es un indicador de tipo aceleración-RMS con su propio umbral de demostración —dos escalas distintas que responden dos preguntas distintas, y confundir sus unidades es un error clásico que el diseño evita.'
        : 'Prognosis projects a trend; the ISO decision layer judges the present against an internationally agreed scale, and the two are complementary. The current severity standard (which supersedes its predecessor) evaluates broadband vibration velocity RMS in the 10–1000 Hz band measured at the bearing housings, and sorts the machine into four zones: A newly commissioned / as-new, B acceptable for unrestricted long-term operation, C unsuitable for continuous operation — investigate and plan corrective action, and D dangerous — damage may be occurring, act immediately. The numeric limits scale with machine class, power and mounting. For the medium mining machines this suite targets — ISO 20816-3 Group 2, 15–300 kW on a rigid support — the boundaries are A/B = 1.4 mm/s, B/C = 2.8 mm/s, C/D = 4.5 mm/s (RMS); large Group 1 machines (&gt;300 kW, rigid) shift up to 2.3 / 4.5 / 7.1, and flexible supports raise them further. The small calibration rig behind the synthetic signal shown here is itself below the 15 kW scope of ISO 20816-3 — at that size ISO 10816-1 Class I (0.71 / 1.8 / 4.5 mm/s) is the correct scale; the A/B/C/D framework is identical, only the numeric limits move with the machine class. Operationally, the B/C boundary is the natural ALERT setpoint and the C/D boundary is the DANGER / trip setpoint. Note the unit distinction this build keeps honest: the ISO layer is velocity RMS in mm/s, whereas the prognostic HI is an acceleration-RMS-style indicator with its own demonstration threshold — two different scales answering two different questions, and conflating their units is a classic mistake the design avoids.'}</p>

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

      <Refs ids={['lei2018', 'iso20816', 'iso20816_3_2022', 'wang2020xjtu', 'randall2011', 'smith2015']} label={refsLabel} />
    </div>
  );

  // ============================================================
  // ML / DEEP LEARNING (existing content, lightly polished)
  // ============================================================
  const mlTab = (
    <div className="prose">
      <p>{es
        ? 'Sobre features (RMS, kurtosis, factores de cresta/impulso, entropía) clasificadores clásicos (SVM/RF/XGBoost); o deep learning de extremo a extremo: 1D-CNN (WDCNN), 2D-CNN sobre escalogramas/espectrogramas, LSTM, y adaptación de dominio para generalizar entre cargas/máquinas. En ESTA app, el WDCNN (1D-CNN) y un autoencoder profundo están entrenados sobre las grabaciones REALES de CWRU (offline, en tools/ml) y corren EN VIVO en el navegador (onnxruntime-web) en la pestaña «Diagnóstico real»; su exactitud held-out y la curva de robustez vs ruido están en Benchmark. El valor de las features físicas (las mismas RMS/kurtosis/prominencia de las pestañas anteriores) es que el modelo parte de cantidades ya interpretables, no de píxeles crudos.'
        : 'Over features (RMS, kurtosis, crest/impulse factors, entropy) classical classifiers (SVM/RF/XGBoost); or end-to-end deep learning: 1D-CNN (WDCNN), 2D-CNN on scalograms/spectrograms, LSTM, and domain adaptation to generalize across loads/machines. In THIS app the WDCNN (1D-CNN) and a deep autoencoder are trained on the REAL CWRU recordings (offline, in tools/ml) and run LIVE in the browser (onnxruntime-web) on the “Real diagnosis” tab; their held-out accuracy and noise-robustness curve are on the Benchmark page. The value of physical features (the same RMS/kurtosis/prominence from the earlier tabs) is that the model starts from already-interpretable quantities, not raw pixels.'}</p>
      <Callout variant="honest" title={es ? 'Honestidad de evaluación' : 'Evaluation honesty'}>
        <p>{es
          ? 'Se reporta la partición (sin fuga del conjunto de referencia) y la prueba cruzada de carga (se deja FUERA una carga entera, 3 HP); la exactitud sin esas salvaguardas es engañosa. El WDCNN + el autoencoder profundo SÍ están implementados y corren en vivo (pestaña «Diagnóstico real», números en Benchmark); CWRU es un banco limpio, por eso se reporta la degradación honesta vs ruido en vez de un 100% pelado.'
          : 'Report the split (no leakage of the reference set) and the cross-load test (an ENTIRE load, 3 HP, is held out); accuracy without those safeguards is misleading. The WDCNN + deep autoencoder ARE implemented and run live (the “Real diagnosis” tab; numbers on Benchmark); CWRU is a clean lab rig, so we report the honest noise-degradation curve rather than a bare 100%.'}</p>
      </Callout>
      <Refs ids={['smith2015', 'lei2018']} label={refsLabel} />
    </div>
  );

  const tabs = [
    { id: 'env', label: es ? 'Envolvente / SES' : 'Envelope / SES', content: envTab },
    { id: 'sk', label: es ? 'Kurtosis espectral / Kurtograma' : 'Spectral kurtosis / Kurtogram', content: skTab },
    { id: 'cs', label: es ? 'Cicloestacionario' : 'Cyclostationary', content: csTab },
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
