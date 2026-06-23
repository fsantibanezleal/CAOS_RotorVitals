import { Tabs, Callout, Cite, Equation, InlineMath, Refs, useShellLang } from '@fasl-work/caos-app-shell';

export default function Implementation() {
  const es = useShellLang() === 'es';
  const refsLabel = es ? 'Refs' : 'Refs';

  {/* Architecture / compute-tier schematic — theme-aware via CSS palette vars. */}
  const ArchSVG = (
    <svg
      viewBox="0 0 920 560"
      width="100%"
      role="img"
      aria-labelledby="impl-arch-title impl-arch-desc"
      style={{ fontFamily: 'var(--font-mono)', background: 'var(--color-bg)' }}
    >
      <title id="impl-arch-title">
        {es ? 'Arquitectura por capas de cómputo' : 'Compute-tier architecture'}
      </title>
      <desc id="impl-arch-desc">
        {es
          ? 'Una vía pesada offline corre entrenamiento, barridos de parámetros y pronósticos, y congela el resultado en un artefacto compacto y determinista. Una vía delgada en vivo en el navegador corre DSP acotado sobre un segmento de señal. Ambas están sembradas y son reproducibles; los archivos estáticos se sirven desde un CDN.'
          : 'A heavy offline lane runs training, parameter sweeps and prognostic forecasts, freezing results into a compact deterministic artifact. A thin live lane in the browser runs bounded DSP on one signal segment. Both are seeded and reproducible; static files are served from a CDN.'}
      </desc>

      <defs>
        <marker id="rv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--color-fg-faint)" />
        </marker>
        <marker id="rv-arrow-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--color-accent)" />
        </marker>
      </defs>

      {/* ---------- HEAVY (OFFLINE) LANE ---------- */}
      <rect x="20" y="60" width="300" height="436" rx="10" fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth="1.5" />
      <text x="40" y="44" fontSize="15" fontWeight="700" fill="var(--color-fg)">
        {es ? 'Vía pesada · offline (precálculo)' : 'Heavy lane · offline (precompute)'}
      </text>
      <text x="40" y="86" fontSize="11" fill="var(--color-fg-subtle)">
        {es ? 'registros largos · solucionadores iterativos · barridos' : 'long records · iterative solvers · sweeps'}
      </text>

      {/* offline method blocks */}
      <g fontSize="11.5" fill="var(--color-fg)">
        <rect x="40" y="100" width="260" height="34" rx="6" fill="var(--color-bg)" stroke="var(--color-border)" />
        <text x="52" y="121">{es ? 'Mapa de correlación/coherencia cíclica' : 'Cyclic spectral correlation / coherence map'}</text>
        <rect x="40" y="142" width="260" height="34" rx="6" fill="var(--color-bg)" stroke="var(--color-border)" />
        <text x="52" y="163">{es ? 'Barridos de selección de banda (info/autogram)' : 'Band-selection sweeps (info/auto-gram)'}</text>
        <rect x="40" y="184" width="260" height="34" rx="6" fill="var(--color-bg)" stroke="var(--color-border)" />
        <text x="52" y="205">{es ? 'EMD / EEMD / CEEMDAN · ajuste VMD' : 'EMD / EEMD / CEEMDAN · VMD tuning'}</text>
        <rect x="40" y="226" width="260" height="34" rx="6" fill="var(--color-bg)" stroke="var(--color-border)" />
        <text x="52" y="247">{es ? 'Deconvolución ciega (barridos periodo/ciclo)' : 'Blind deconvolution (period / cyclic sweeps)'}</text>
        <rect x="40" y="268" width="260" height="34" rx="6" fill="var(--color-bg)" stroke="var(--color-border)" />
        <text x="52" y="289">{es ? 'Entrenamiento RUL · abanicos de pronóstico' : 'RUL training · forecast fans'}</text>
      </g>

      {/* seed note for the offline lane */}
      <text x="40" y="330" fontSize="10.5" fill="var(--color-fg-subtle)">
        {es ? 'semilla entera fija → determinista' : 'fixed integer seed → deterministic'}
      </text>

      {/* freeze arrow to artifact */}
      <line x1="170" y1="344" x2="170" y2="378" stroke="var(--color-accent)" strokeWidth="2" markerEnd="url(#rv-arrow-accent)" />
      <text x="180" y="366" fontSize="10.5" fill="var(--color-accent)">{es ? 'congelar' : 'freeze'}</text>

      {/* ---------- COMPACT ARTIFACT ---------- */}
      <rect x="40" y="384" width="260" height="92" rx="8" fill="var(--color-bg)" stroke="var(--color-accent)" strokeWidth="2" />
      <text x="56" y="408" fontSize="13" fontWeight="700" fill="var(--color-accent)">{es ? 'Artefacto compacto' : 'Compact artifact'}</text>
      <text x="56" y="430" fontSize="10.5" fill="var(--color-fg)">{es ? 'bandas · tablas de frec. de falla' : 'selected bands · fault-freq tables'}</text>
      <text x="56" y="446" fontSize="10.5" fill="var(--color-fg)">{es ? 'tendencias HI · curvas de vida' : 'HI trends · projected-life curves'}</text>
      <text x="56" y="466" fontSize="10.5" fill="var(--color-fg-subtle)">{es ? 'pequeño · congelado · una descarga' : 'small · frozen · single fetch'}</text>

      {/* artifact ships right to the live lane */}
      <line x1="320" y1="430" x2="372" y2="430" stroke="var(--color-accent)" strokeWidth="2" markerEnd="url(#rv-arrow-accent)" />
      <text x="328" y="422" fontSize="10" fill="var(--color-accent)">{es ? 'enviar' : 'ship'}</text>

      {/* ---------- THIN (LIVE) LANE ---------- */}
      <rect x="376" y="60" width="320" height="436" rx="10" fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth="1.5" />
      <text x="396" y="44" fontSize="15" fontWeight="700" fill="var(--color-fg)">
        {es ? 'Vía delgada · en vivo (en navegador)' : 'Thin lane · live (in-browser)'}
      </text>
      <text x="396" y="86" fontSize="11" fill="var(--color-fg-subtle)">
        {es ? 'un segmento acotado · núcleo O(N log N)' : 'one bounded segment · O(N log N) core'}
      </text>

      {/* shared FFT core */}
      <rect x="396" y="100" width="280" height="30" rx="6" fill="var(--color-bg)" stroke="var(--color-accent)" strokeDasharray="4 3" />
      <text x="410" y="120" fontSize="11.5" fontWeight="700" fill="var(--color-accent)">
        {es ? 'núcleo FFT radix-2 (primitiva compartida)' : 'radix-2 FFT core (shared primitive)'}
      </text>

      {/* live signal-flow chain */}
      <g fontSize="11" fill="var(--color-fg)">
        <rect x="396" y="142" width="134" height="30" rx="6" fill="var(--color-bg)" stroke="var(--color-border)" />
        <text x="408" y="161">{es ? 'pasa-banda ideal' : 'brick-wall band-pass'}</text>
        <rect x="542" y="142" width="134" height="30" rx="6" fill="var(--color-bg)" stroke="var(--color-border)" />
        <text x="554" y="161">{es ? 'envolvente Hilbert' : 'Hilbert envelope'}</text>
        <line x1="530" y1="157" x2="540" y2="157" stroke="var(--color-fg-faint)" strokeWidth="1.5" markerEnd="url(#rv-arrow)" />

        <rect x="396" y="184" width="134" height="30" rx="6" fill="var(--color-bg)" stroke="var(--color-border)" />
        <text x="408" y="203">{es ? 'espectro de envolvente' : 'envelope spectrum'}</text>
        <rect x="542" y="184" width="134" height="30" rx="6" fill="var(--color-bg)" stroke="var(--color-border)" />
        <text x="554" y="203">{es ? 'kurtograma diádico' : 'dyadic kurtogram'}</text>
        <line x1="542" y1="199" x2="530" y2="199" stroke="var(--color-fg-faint)" strokeWidth="1.5" markerEnd="url(#rv-arrow)" />

        <rect x="396" y="226" width="134" height="30" rx="6" fill="var(--color-bg)" stroke="var(--color-border)" />
        <text x="408" y="245">{es ? 'cepstrum real' : 'real cepstrum'}</text>
        <rect x="542" y="226" width="134" height="30" rx="6" fill="var(--color-bg)" stroke="var(--color-border)" />
        <text x="554" y="245">{es ? 'espectrograma STFT' : 'STFT spectrogram'}</text>

        <rect x="396" y="268" width="134" height="30" rx="6" fill="var(--color-bg)" stroke="var(--color-border)" />
        <text x="408" y="287">{es ? 'esp. modulación cíclica' : 'cyclic-mod. spectrum'}</text>
        <rect x="542" y="268" width="134" height="30" rx="6" fill="var(--color-bg)" stroke="var(--color-border)" />
        <text x="554" y="287">{es ? 'frec. cinemáticas' : 'kinematic frequencies'}</text>
      </g>

      {/* diagnosis + prognosis consuming live + artifact */}
      <rect x="396" y="318" width="280" height="34" rx="6" fill="var(--color-bg)" stroke="var(--color-good)" strokeWidth="1.5" />
      <text x="410" y="340" fontSize="11.5" fill="var(--color-good)">
        {es ? 'diagnóstico: prominencia + controles neg.' : 'diagnosis: harmonic prominence + neg-controls'}
      </text>

      <rect x="396" y="360" width="280" height="34" rx="6" fill="var(--color-bg)" stroke="var(--color-warn)" strokeWidth="1.5" />
      <text x="410" y="382" fontSize="11.5" fill="var(--color-warn)">
        {es ? 'pronóstico: HI exponencial → RUL' : 'prognosis: exponential HI → first-passage RUL'}
      </text>

      <rect x="396" y="402" width="280" height="34" rx="6" fill="var(--color-bg)" stroke="var(--color-border)" />
      <text x="410" y="424" fontSize="11.5" fill="var(--color-fg)">{es ? 'medidor de severidad ISO A/B/C/D' : 'ISO A/B/C/D severity gauge'}</text>

      <text x="396" y="462" fontSize="10.5" fill="var(--color-fg-subtle)">
        {es ? 'modelo directo sintético sembrado → recupera la falla' : 'seeded synthetic forward model → recovers planted fault'}
      </text>

      {/* artifact feeds prognosis/diagnosis in live lane */}
      <path d="M300 430 C 350 430, 350 377, 394 377" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#rv-arrow-accent)" />

      {/* ---------- CDN + BROWSER ---------- */}
      <rect x="712" y="60" width="188" height="200" rx="10" fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth="1.5" />
      <text x="728" y="44" fontSize="14" fontWeight="700" fill="var(--color-fg)">{es ? 'Entrega' : 'Delivery'}</text>
      <rect x="728" y="92" width="156" height="44" rx="6" fill="var(--color-bg)" stroke="var(--color-border)" />
      <text x="740" y="112" fontSize="11.5" fill="var(--color-fg)">{es ? 'caché de borde CDN' : 'CDN edge cache'}</text>
      <text x="740" y="128" fontSize="10" fill="var(--color-fg-subtle)">{es ? 'solo archivos estáticos' : 'static files only'}</text>
      <rect x="728" y="148" width="156" height="44" rx="6" fill="var(--color-bg)" stroke="var(--color-border)" />
      <text x="740" y="168" fontSize="11.5" fill="var(--color-fg)">{es ? 'sin servidor · sin BD' : 'no server · no DB'}</text>
      <text x="740" y="184" fontSize="10" fill="var(--color-fg-subtle)">{es ? 'en la ruta de solicitud' : 'in request path'}</text>
      <rect x="728" y="204" width="156" height="44" rx="6" fill="var(--color-bg)" stroke="var(--color-accent)" />
      <text x="740" y="224" fontSize="11.5" fill="var(--color-accent)">{es ? 'design system compartido' : 'shared design system'}</text>
      <text x="740" y="240" fontSize="10" fill="var(--color-fg-subtle)">{es ? 'armazón · tema · i18n' : 'shell · theme · i18n'}</text>

      {/* CDN serves the browser (the thin live lane runs here) */}
      <line x1="806" y1="260" x2="806" y2="300" stroke="var(--color-fg-faint)" strokeWidth="2" markerEnd="url(#rv-arrow)" />
      <rect x="712" y="304" width="188" height="120" rx="10" fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth="1.5" />
      <text x="728" y="330" fontSize="14" fontWeight="700" fill="var(--color-fg)">{es ? 'Navegador' : 'Browser'}</text>
      <text x="728" y="354" fontSize="10.5" fill="var(--color-fg)">{es ? 'descarga el bundle una vez' : 'fetch bundle once'}</text>
      <text x="728" y="372" fontSize="10.5" fill="var(--color-fg)">{es ? 'corre el DSP en vivo local' : 'run live DSP locally'}</text>
      <text x="728" y="390" fontSize="10.5" fill="var(--color-fg)">{es ? 'renderiza artefactos congelados' : 'render frozen artifacts'}</text>
      <text x="728" y="412" fontSize="10.5" fill="var(--color-fg-subtle)">{es ? 'determinista → reproducible' : 'deterministic → reproducible'}</text>

      {/* artifact + live lane delivered via CDN */}
      <path d="M300 470 C 540 540, 700 540, 806 250" fill="none" stroke="var(--color-fg-faint)" strokeWidth="1.5" strokeDasharray="3 4" markerEnd="url(#rv-arrow)" />
      <text x="470" y="535" fontSize="10" fill="var(--color-fg-subtle)">{es ? 'artefacto + bundle de la app → CDN' : 'artifact + app bundle → CDN'}</text>

      {/* reproducibility banner */}
      <text x="376" y="520" fontSize="11" fill="var(--color-fg-subtle)">
        {es
          ? 'Misma entrada → misma salida: núcleos sembrados, sin reloj de pared, sin red en el cómputo, solo IEEE-754.'
          : 'Same input → same output: seeded cores, no wall-clock, no network in compute, IEEE-754 only.'}
      </text>
    </svg>
  );

  const tabs = [
    {
      id: 'tiers',
      label: es ? 'Capas de cómputo' : 'Compute tiers',
      content: (
        <div className="prose">
          <p>{es
            ? 'RotorVitals es un banco de monitoreo de condición que corre por completo en el cliente: no hay servidor de aplicación ni base de datos. Todo lo que el visitante manipula es un conjunto de archivos estáticos servidos desde una red de distribución de contenidos (CDN), y todo el cómputo numérico ocurre o bien con anticipación (precalculado en artefactos de datos compactos que viajan con la página) o bien en vivo en el navegador sobre un único segmento de señal acotado. Esta separación es deliberada: la literatura de diagnóstico de rodamientos abarca un amplio espectro de costo —desde unas pocas FFT hasta barridos de parámetros de horas, descomposiciones por ensamble y mapas completos de correlación espectral cíclica. Forzar todo eso a una ruta en vivo en el navegador sería o imposiblemente lento o deshonestamente truncado.'
            : 'RotorVitals is a fully client-side condition-monitoring workbench: there is no application server and no database. Everything a visitor interacts with is a set of static files served from a content-delivery network, and all numerical work happens either ahead of time (baked into compact data artifacts that ship with the page) or live in the browser on a single bounded signal segment. This split is deliberate: the diagnostic literature for rolling-element bearings spans a wide cost spectrum — from a handful of FFTs to multi-hour parameter sweeps, ensemble decompositions, and full cyclic-spectral-correlation maps. Forcing all of that into a live in-browser path would be either impossibly slow or dishonestly truncated.'}{' '}<Cite id="randall2011" paren /></p>
          <p>{es
            ? 'En cambio, el build traza una línea dura: los métodos cuyo costo es acotado y suficientemente pequeño para correr interactivamente sobre un segmento se implementan para ejecutarse en vivo; los métodos cuya forma honesta exige registros largos, solucionadores iterativos o barridos grandes se calculan fuera de línea y se entregan como el resultado de ese cómputo, nunca re-derivados en la página.'
            : 'Instead the build draws a hard line: methods whose cost is bounded and small enough to run interactively on one segment are implemented to run live; methods whose honest form requires long records, iterative solvers, or large sweeps are computed offline and shipped as the results of that computation, never re-derived in the page.'}</p>

          <h3>{es ? 'Las dos capas de cómputo' : 'The two compute tiers'}</h3>
          <p>{es
            ? 'La vía pesada (offline) es donde el entrenamiento, los barridos de parámetros y los pronósticos se evalúan contra registros largos en condiciones que un navegador no puede sostener. Su producto no es el modelo ni el barrido en sí, sino un artefacto compacto: un conjunto pequeño y congelado de números —bandas seleccionadas, tablas de frecuencias de falla, tendencias de indicadores de salud, curvas de vida proyectada— dimensionado para una sola descarga. La vía delgada (en vivo) es el runtime de DSP en el navegador: dado un segmento de aceleración y su frecuencia de muestreo, reproduce en tiempo real la cadena clásica de procesamiento de señales.'
            : 'The heavy (offline) lane is where training runs, parameter sweeps, and prognostic forecasts are evaluated against long records under conditions a browser cannot sustain. Its product is not the model or the sweep itself but a compact artifact: a small, frozen set of numbers — selected bands, fault-frequency tables, health-indicator trends, projected life curves — sized for a single network fetch. The thin (live) lane is the in-browser DSP runtime: given one acceleration segment and its sampling rate, it reproduces the classical signal-processing chain in real time.'}{' '}<Cite id="lei2018" paren /></p>
          <p>{es
            ? 'El contrato entre ambas vías es el determinismo. Las dos están sembradas (seed) y no contienen reloj de pared, ni red, ni indeterminismo de punto flotante más allá de IEEE-754, de modo que la misma entrada siempre produce la misma salida. Los escenarios sintéticos que viajan con el build se generan a partir de una semilla entera explícita, lo que permite apuntar el runtime en vivo a un escenario y demostrar que recupera exactamente la frecuencia de falla que lo generó —el motor se valida contra su propio modelo directo, no contra una afirmación infalsable.'
            : 'The contract between the lanes is determinism. Both lanes are seeded and contain no wall-clock, no network, and no floating-point nondeterminism beyond IEEE-754, so the same input always produces the same output. The synthetic scenarios that ship with the build are generated from an explicit integer seed, which means the live runtime can be pointed at a scenario and shown to recover the very fault frequency that generated it — the engine validates against its own forward model rather than against an unfalsifiable claim.'}</p>

          <div className="fig-svg">{ArchSVG}</div>
          <p className="muted small">{es
            ? 'Vía pesada offline → artefacto compacto → runtime delgado en vivo. Ambos núcleos sembrados y deterministas; el CDN solo entrega archivos.'
            : 'Heavy offline lane → compact artifact → thin live runtime. Both cores seeded and deterministic; the CDN only delivers files.'}</p>
          <Refs ids={['randall2011', 'lei2018']} label={refsLabel} />
        </div>
      ),
    },
    {
      id: 'core',
      label: es ? 'Núcleo FFT' : 'FFT core',
      content: (
        <div className="prose">
          <p>{es
            ? 'Cada módulo en vivo se apoya en una única FFT radix-2 de Cooley–Tukey, in-place e iterativa (diezmado en tiempo, permutación bit-reversal, recurrencia de factores twiddle). Las entradas de longitud arbitraria se rellenan con ceros hasta la siguiente potencia de dos; la transformada inversa usa la identidad de conjugación. No hay un kernel separado de FFT real —las señales reales se cargan en la parte real con la parte imaginaria en cero.'
            : 'Every live module is built on one in-place, iterative radix-2 Cooley–Tukey FFT (decimation-in-time, bit-reversal permutation, twiddle recurrence). Arbitrary-length inputs are zero-padded up to the next power of two; the inverse transform uses the conjugation identity. There is no separate real-FFT kernel — real signals are loaded into the real part with a zeroed imaginary part.'}</p>
          <Equation
            tex={String.raw`X_k=\sum_{j=0}^{N-1} x_j\,e^{-i 2\pi k j / N},\qquad \mathrm{ifft}(X)=\tfrac{1}{N}\,\overline{\mathrm{fft}\big(\overline{X}\big)}`}
            caption={es ? 'FFT directa O(N log N) y la inversa por la identidad de conjugación' : 'forward O(N log N) FFT and the inverse via the conjugation identity'}
          />
          <ul>
            <li><InlineMath tex={String.raw`x_j`} /> — {es ? 'muestras de entrada (la señal real va en la parte real, imaginaria en cero)' : 'input samples (real signal in the real part, imaginary part zeroed)'}.</li>
            <li><InlineMath tex={String.raw`N`} /> — {es ? 'longitud de la transformada, la siguiente potencia de dos tras rellenar con ceros' : 'transform length, the next power of two after zero-padding'}.</li>
            <li><InlineMath tex={String.raw`\overline{(\cdot)}`} /> — {es ? 'conjugado complejo; la inversa reusa el mismo kernel directo' : 'complex conjugate; the inverse reuses the same forward kernel'}.</li>
          </ul>
          <p>{es
            ? 'Esta primitiva única es el motor bajo el filtro pasa-banda, la transformada de Hilbert, el cepstrum, el espectrograma y el espectro de modulación cíclica. Construir todo sobre un solo kernel verificado de O(N log N) mantiene la capa en vivo auditable y rápida.'
            : 'This single primitive is the workhorse beneath the band-pass, the Hilbert transform, the cepstrum, the spectrogram, and the cyclic-modulation spectrum. Building everything on one verified O(N log N) kernel keeps the live tier auditable and fast.'}{' '}<Cite id="randall2011" paren /></p>
          <Refs ids={['randall2011']} label={refsLabel} />
        </div>
      ),
    },
    {
      id: 'envelope',
      label: es ? 'Envolvente' : 'Envelope',
      content: (
        <div className="prose">
          <p>{es
            ? 'La física: un defecto localizado produce un impacto mecánico repetitivo cada vez que un elemento rodante pasa por la picadura. Cada impacto es un casi-impulso que hace «sonar» la resonancia estructural más cercana, de modo que la portadora que ve el sensor es la resonancia de alta frecuencia, modulada en amplitud a la baja tasa de repetición de la falla. Leer el espectro crudo es la herramienta equivocada —la información diagnóstica vive en la modulación, no en la portadora.'
            : 'The physics: a localized bearing defect produces a repetitive mechanical impact each time a rolling element passes the spall. Each impact is a near-impulse that rings the nearest structural resonance, so the carrier the sensor sees is the high-frequency resonance, amplitude-modulated at the low fault-repetition rate. Reading the raw spectrum is the wrong tool — the diagnostic information lives in the modulation, not the carrier.'}{' '}<Cite id="randall2011" paren /></p>
          <p>{es
            ? 'El motor demodula en tres pasos. (1) Pasa-banda: un filtro de pared de ladrillo en dominio FFT pone en cero todo bin fuera de [f1, f2] alrededor de la resonancia y transforma inversamente. Es un filtro idealizado de fase cero (flancos abruptos, sin banda de transición), elegido porque en la FFT es exacto y trivialmente reversible; el costo es fuga espectral en los bordes que un diseño FIR/IIR real suavizaría. (2) Señal analítica: la transformada de Hilbert se realiza en frecuencia con el multiplicador canónico —conservar DC y Nyquist, duplicar cada bin de frecuencia positiva, anular cada negativo— y luego transformar inversamente; la envolvente es la magnitud compleja. (3) Espectro de envolvente: a la envolvente se le resta la media, se enventana con Hann, se aplica FFT, se toma de un solo lado y se escala en amplitud por 2/Σventana.'
            : 'The engine demodulates in three steps. (1) Band-pass: an FFT-domain brick-wall filter zeroes every bin outside [f1, f2] around the resonance and inverse-transforms. This is an idealized, zero-phase filter (sharp edges, no transition band) — chosen because in the FFT it is exact and trivially reversible; the cost is spectral leakage at the band edges that a real FIR/IIR design would taper. (2) Analytic signal: the Hilbert transform is realized in the frequency domain by the canonical multiplier — keep DC and Nyquist, double every positive-frequency bin, zero every negative one — then inverse-transform; the envelope is the complex magnitude. (3) Envelope spectrum: the envelope is mean-removed, Hann-windowed, FFT-d, single-sided, and amplitude-scaled by 2/Σwindow.'}{' '}<Cite id="borghesani2013ses" paren /></p>
          <Equation
            tex={String.raw`z(t)=x_b(t)+i\,\mathcal{H}\{x_b\}(t),\qquad \mathcal{E}(t)=|z(t)|=\sqrt{\Re z^2+\Im z^2},\qquad \mathrm{ES}(f)=\big|\mathcal{F}\{\mathcal{E}(t)-\bar{\mathcal{E}}\}\big|`}
            caption={es ? 'señal analítica, envolvente de amplitud y su espectro de un solo lado' : 'analytic signal, amplitude envelope and its single-sided spectrum'}
          />
          <ul>
            <li><InlineMath tex={String.raw`x_b(t)`} /> — {es ? 'señal tras el pasa-banda alrededor de la resonancia' : 'band-passed signal around the resonance'}.</li>
            <li><InlineMath tex={String.raw`\mathcal{H}\{\cdot\}`} /> — {es ? 'transformada de Hilbert, vía el multiplicador de medio espectro en frecuencia' : 'Hilbert transform, via the half-spectrum frequency-domain multiplier'}.</li>
            <li><InlineMath tex={String.raw`\mathcal{E}(t)`} /> — {es ? 'envolvente de amplitud (magnitud de la señal analítica)' : 'amplitude envelope (magnitude of the analytic signal)'}.</li>
            <li><InlineMath tex={String.raw`\bar{\mathcal{E}}`} /> — {es ? 'media restada antes del enventanado de Hann' : 'mean removed before Hann windowing'}.</li>
          </ul>
          <Callout variant="honest" title={es ? 'Amplitud vs. cuadrado' : 'Amplitude vs. squared'}>
            {es
              ? 'Este build forma el espectro de la envolvente de amplitud, no de la envolvente al cuadrado del estándar moderno. Ambas comparten su estructura de picos (frecuencia de falla + armónicos) pero difieren en el moldeado del piso de ruido. Con la banda correcta, la frecuencia de falla y sus armónicos resaltan como un peine sobre un pedestal bajo.'
              : 'This build forms the spectrum of the amplitude envelope, not the squared envelope of the modern standard. The two share their peak structure (fault frequency + harmonics) but differ in noise-floor shaping. When the band is correct, the fault frequency and its harmonics stand out as a comb against a low pedestal.'}
          </Callout>
          <p>{es
            ? 'Dónde funciona: fallas de pista externa a SNR moderado, donde el tren de impactos es fuerte y estacionario. Dónde falla: una banda equivocada da un espectro plano y ambiguo —la selección de banda es la decisión más difícil, y por eso existe el kurtograma. Las fallas de pista interna y de bola son intrínsecamente más débiles (camino de transmisión extra y modulación de velocidad) y se difuminan bajo deslizamiento.'
            : 'Where it works: outer-race faults at moderate SNR, where the impact train is strong and stationary. Where it fails: the wrong band gives a flat, ambiguous spectrum — band selection is the single hardest decision, which is exactly why the kurtogram exists. Inner-race and ball faults are intrinsically weaker (extra transmission path and speed modulation) and smear under slip.'}{' '}<Cite id="smith2015" paren /></p>
          <Refs ids={['randall2011', 'borghesani2013ses', 'smith2015']} label={refsLabel} />
        </div>
      ),
    },
    {
      id: 'kinematic',
      label: es ? 'Frec. cinemáticas' : 'Kinematic freqs',
      content: (
        <div className="prose">
          <p>{es
            ? 'Cada peine diagnóstico se ancla a las frecuencias de defecto derivadas de la geometría. A partir de la velocidad de eje fr, el número de elementos rodantes n, la razón diámetro-bola/diámetro-primitivo y el ángulo de contacto, el motor calcula la frecuencia de jaula (FTF), las frecuencias de paso por pista externa e interna (BPFO, BPFI) y la frecuencia de giro de bola (BSF). Un defecto de bola golpea ambas pistas por revolución, por lo que su línea de envolvente dominante está en 2·BSF —y esa es la línea que el diagnóstico realmente puntúa. Estas relaciones son física exacta y transferible: se cumplen tal cual en hardware real, con independencia de este build.'
            : 'Every diagnostic comb is anchored to the geometry-derived defect frequencies. From the shaft rate fr, the rolling-element count n, the ball-to-pitch diameter ratio and the contact angle, the engine computes the cage frequency (FTF), the outer-race and inner-race ball-pass frequencies (BPFO, BPFI) and the ball-spin frequency (BSF). A ball defect strikes both races per revolution, so its dominant envelope line sits at 2·BSF — that is the line the diagnosis actually scores. These relations are exact, transferable physics: they hold on real hardware as written, independent of this build.'}{' '}<Cite id="randall2011" paren /></p>
          <Equation tex={String.raw`\mathrm{FTF}=\tfrac{1}{2}f_r(1-\gamma),\quad \mathrm{BPFO}=\tfrac{n}{2}f_r(1-\gamma),\quad \mathrm{BPFI}=\tfrac{n}{2}f_r(1+\gamma),\quad \mathrm{BSF}=\tfrac{D}{2d}f_r\!\left(1-\gamma^2\right),\quad \gamma=\tfrac{d}{D}\cos\theta`} />
          <ul>
            <li><InlineMath tex={String.raw`f_r`} /> — {es ? 'frecuencia rotacional del eje (Hz), = rpm/60' : 'shaft rotational frequency (Hz), = rpm/60'}.</li>
            <li><InlineMath tex={String.raw`n`} /> — {es ? 'número de elementos rodantes' : 'number of rolling elements'}.</li>
            <li><InlineMath tex={String.raw`d`} /> — {es ? 'diámetro del elemento rodante (bola)' : 'rolling-element (ball) diameter'}; <InlineMath tex={String.raw`D`} /> — {es ? 'diámetro primitivo (misma unidad; solo importa la razón)' : 'pitch diameter (same units; only the ratio matters)'}.</li>
            <li><InlineMath tex={String.raw`\theta`} /> — {es ? 'ángulo de contacto (en radianes; el motor recibe grados y convierte)' : 'contact angle (radians; the engine takes degrees and converts)'}.</li>
            <li><InlineMath tex={String.raw`\gamma=\tfrac{d}{D}\cos\theta`} /> — {es ? 'factor geométrico adimensional' : 'dimensionless geometry factor'}.</li>
            <li>{es ? 'Línea de envolvente dominante de defecto de bola' : 'Dominant ball-defect envelope line'} = <InlineMath tex={String.raw`2\cdot\mathrm{BSF}`} /> {es ? '(ambas pistas golpeadas por revolución)' : '(both races struck per revolution)'}.</li>
          </ul>
          <Refs ids={['randall2011']} label={refsLabel} />
        </div>
      ),
    },
    {
      id: 'kurtogram',
      label: es ? 'Kurtograma' : 'Kurtogram',
      content: (
        <div className="prose">
          <p>{es
            ? 'La decisión más difícil del análisis de envolvente —dónde aplicar el pasa-banda— se automatiza con un kurtograma diádico. El principio: la vibración de banda ancha de un rodamiento sano es aproximadamente gaussiana, pero una falla inyecta transitorios impulsivos que vuelven no-gaussiana la banda. La curtosis espectral mide esa impulsividad en función de la frecuencia, y la banda óptima de demodulación es donde alcanza su máximo.'
            : 'The hardest envelope-analysis decision — where to band-pass — is automated by a dyadic kurtogram. The principle: a healthy bearing-s broadband vibration is approximately Gaussian, but a fault injects impulsive transients that make the band non-Gaussian. Spectral kurtosis measures that impulsiveness as a function of frequency, and the optimal demodulation band is the one where it peaks.'}{' '}<Cite id="antoni2006sk" paren /></p>
          <p>{es
            ? 'Este build calcula una versión diádica pragmática: para cada nivel k = 1…5 divide [0, fs/2] en 2^k bandas iguales; para cada banda aplica pasa-banda, toma la envolvente de Hilbert y calcula la curtosis en exceso de esa envolvente; la celda de curtosis máxima es la banda seleccionada, que luego alimenta el espectro de envolvente. Una guarda deliberada omite el 2% más bajo de fs (y DC), porque el contenido determinista de eje y de bajo orden parece impulsivo pero no es una falla de rodamiento —dejarlo sesgaría el selector hacia la banda equivocada.'
            : 'This build computes a pragmatic dyadic version: for each level k = 1…5 it splits [0, fs/2] into 2^k equal bands; for each band it band-passes, takes the Hilbert envelope, and computes the excess kurtosis of that envelope; the maximum-kurtosis cell is the selected band, which then feeds the envelope spectrum. A deliberate guard skips the lowest 2% of fs (and DC), because deterministic shaft and low-order content is impulsive-looking but not a bearing fault — leaving it in would bias the selector toward the wrong band.'}{' '}<Cite id="antoni2007" paren /></p>
          <Equation
            tex={String.raw`\text{ExcessKurt}(x)=\frac{\frac{1}{N}\sum_{i}(x_i-\bar{x})^4}{\left(\frac{1}{N}\sum_{i}(x_i-\bar{x})^2\right)^2}-3,\qquad (f_1,f_2)^\star=\arg\max_{k,\ b}\ \text{ExcessKurt}\big(\mathcal{E}\{\text{bp}_{[f_1,f_2]}(x)\}\big)`}
            caption={es ? 'curtosis en exceso (0 para gaussiano) y la celda de banda que la maximiza' : 'excess kurtosis (0 for Gaussian) and the band cell that maximizes it'}
          />
          <ul>
            <li><InlineMath tex={String.raw`x_i`} /> — {es ? 'muestras' : 'samples'}; <InlineMath tex={String.raw`\bar{x}`} /> — {es ? 'media' : 'mean'}; <InlineMath tex={String.raw`N`} /> — {es ? 'número de muestras' : 'sample count'}.</li>
            <li>{es ? 'El −3 hace el estadístico cero para una gaussiana; valores positivos indican colas más pesadas (impulsivas) que la gaussiana.' : 'The −3 makes the statistic zero for a Gaussian; positive values mean heavier-than-Gaussian (impulsive) tails.'}</li>
            <li><InlineMath tex={String.raw`\mathcal{E}\{\cdot\}`} /> — {es ? 'envolvente de amplitud de Hilbert' : 'Hilbert amplitude envelope'}; <InlineMath tex={String.raw`\text{bp}_{[f_1,f_2]}`} /> — {es ? 'el pasa-banda de pared de ladrillo' : 'the brick-wall band-pass'}.</li>
            <li>{es ? 'Niveles' : 'Levels'} <InlineMath tex={String.raw`k=1\ldots5`} />, {es ? 'bandas' : 'bands'} <InlineMath tex={String.raw`b=0\ldots2^k-1`} /> {es ? 'sobre' : 'over'} <InlineMath tex={String.raw`[0,f_s/2]`} />, {es ? 'con el' : 'with the lowest'} <InlineMath tex={String.raw`0.02\,f_s`} /> {es ? 'más bajo excluido' : 'excluded'}.</li>
          </ul>
          <Callout variant="honest" title={es ? 'Lo que la curtosis no ve' : 'What kurtosis misses'}>
            {es
              ? 'La curtosis responde a cualquier impulso —una espiga eléctrica o un solo valor atípico puede capturar el selector; además es ciega a la periodicidad (mide impulsividad, no tasa de repetición), por lo que existen los sucesores sensibles a la periodicidad (autograma/infograma). También se provee una vista complementaria: una curtosis espectral por frecuencia calculada como la curtosis en exceso de |STFT| a lo largo de los marcos temporales (ventanas Hann de 256 muestras, 50% de solape), que muestra qué frecuencias portan el contenido impulsivo en lugar de qué banda diádica gana.'
              : 'Kurtosis responds to any impulse — an electrical spike or a single outlier can capture the selector; it is also blind to periodicity (it measures impulsiveness, not repetition rate), which is why the periodicity-aware successors (autogram/infogram) exist. A complementary view is also provided: a per-frequency spectral kurtosis computed as the excess kurtosis of |STFT| across time frames (256-sample Hann windows, 50% overlap), which shows which frequencies carry the impulsive content rather than which dyadic band wins.'}{' '}<Cite id="moshrefzadeh2018autogram" paren /> <Cite id="antoni2016infogram" paren />
          </Callout>
          <Refs ids={['antoni2006sk', 'antoni2007', 'moshrefzadeh2018autogram', 'antoni2016infogram']} label={refsLabel} />
        </div>
      ),
    },
    {
      id: 'complementary',
      label: es ? 'Vistas complementarias' : 'Complementary views',
      content: (
        <div className="prose">
          <p>{es
            ? 'El cepstrum real es la FFT inversa del espectro log-magnitud; una familia de líneas espectrales uniformemente espaciadas (un tren de armónicos o de bandas laterales) colapsa a un único pico en la quefrencia igual al recíproco de su espaciamiento. Es el detector natural de «¿hay aquí una familia regularmente espaciada?» y complementa al espectro.'
            : 'The real cepstrum is the inverse FFT of the log-magnitude spectrum; a uniformly spaced family of spectral lines (a harmonic train or sideband family) collapses to a single peak at the quefrency equal to their spacing-s reciprocal. It is the natural detector for "is there a regularly spaced family here?" and complements the spectrum.'}{' '}<Cite id="randall2011" paren /></p>
          <Equation
            tex={String.raw`c(\tau)=\mathcal{F}^{-1}\big\{\log\big|\mathcal{F}\{w(t)\,x(t)\}\big|\big\},\qquad \tau=\frac{i}{f_s}`}
            caption={es ? 'cepstrum real; τ es la quefrencia (segundos), espaciamiento recíproco de las líneas' : 'real cepstrum; τ is the quefrency (seconds), reciprocal of the line spacing'}
          />
          <p>{es
            ? 'El espectrograma es la magnitud de una STFT enventanada con Hann en dB (ventanas de 512 muestras, 75% de solape) —la vista tiempo-frecuencia que confirma si la energía impulsiva es estacionaria o aparece y desaparece. El espectro de modulación cíclica (CMS) es una aproximación deliberadamente liviana y factible en web de la coherencia espectral cíclica, no la correlación espectral rápida completa: analiza por Fourier la serie de potencia |STFT|² en el tiempo para cada banda portadora, exponiendo energía en cada frecuencia cíclica α.'
            : 'The spectrogram is a Hann-windowed STFT magnitude in dB (512-sample windows, 75% overlap) — the time-frequency view that confirms whether the impulsive energy is stationary or comes and goes. The cyclic-modulation spectrum (CMS) is a deliberately lightweight, web-feasible approximation of the cyclic spectral coherence, not full Fast spectral correlation: it Fourier-analyzes the |STFT|² power series over time for each carrier band, exposing energy at each cyclic frequency α.'}{' '}<Cite id="antoni2007csc" paren /></p>
          <Equation tex={String.raw`\gamma(\alpha)\ \propto\ \Big|\mathcal{F}_{t}\big\{\,|\mathrm{STFT}(t,f)|^2\,\big\}(\alpha)\Big|`} caption={es ? 'aproximación de modulación cíclica: Fourier en el tiempo de la potencia por banda portadora' : 'cyclic-modulation approximation: Fourier-in-time of the per-carrier power'} />
          <p>{es
            ? 'Una falla cicloestacionaria de segundo orden aparece como una familia de crestas verticales en α en la frecuencia de falla y sus armónicos, independiente de la banda portadora —la vista más limpia de «¿es esto periódico en el periodo de falla, en cualquier parte del espectro?».'
            : 'A second-order cyclostationary fault appears as a vertical α-ridge family at the fault frequency and its harmonics, independent of the carrier band — the cleanest "is this periodic at the fault period, anywhere in the spectrum?" view.'}{' '}<Cite id="borghesani2013" paren /></p>
          <Callout variant="note" title={es ? 'Aproximación, no referencia' : 'Approximation, not gold standard'}>
            {es
              ? 'El build deja explícito que el mapa pesado de correlación espectral cíclica de referencia es un método de precálculo, no esta aproximación en vivo. La vista en vivo prioriza factibilidad en navegador sobre exactitud completa.'
              : 'The build is explicit that the heavier, gold-standard cyclic-spectral-correlation map is a precompute method, not this live approximation. The live view prioritizes in-browser feasibility over full fidelity.'}{' '}<Cite id="antoni2017fastsc" paren />
          </Callout>
          <Refs ids={['randall2011', 'borghesani2013', 'antoni2007csc', 'antoni2017fastsc']} label={refsLabel} />
        </div>
      ),
    },
    {
      id: 'diagnosis',
      label: es ? 'Diagnóstico' : 'Diagnosis',
      content: (
        <div className="prose">
          <p>{es
            ? 'El veredicto no es una caja negra. Para cada falla candidata (externa→BPFO, interna→BPFI, bola→2·BSF) el motor puntúa la prominencia de esa línea en el espectro de envolvente: para cada uno de los primeros cinco armónicos toma el pico local dentro de una ventana de tolerancia y lo divide por la mediana de los bins vecinos (una línea base local robusta que ignora el propio pico), y luego promedia sobre los armónicos que caben bajo el tope del espectro.'
            : 'The verdict is not a black box. For each candidate fault (outer→BPFO, inner→BPFI, ball→2·BSF) the engine scores the prominence of that line in the envelope spectrum: for each of the first five harmonics it takes the local peak within a tolerance window and divides it by the median of the surrounding bins (a robust local baseline that ignores the peak itself), then averages over the harmonics that fit below the spectrum-s top.'}{' '}<Cite id="randall2011" paren /></p>
          <p>{es
            ? 'Las tres fallas en competencia actúan como controles negativos mutuos: una falla genuina sobresale muy por encima de las otras dos; el ruido de banda ancha eleva las tres por igual. Se declara un veredicto solo si el puntaje superior supera una compuerta absoluta de 4.5 (la línea debe ser al menos 4.5× su línea base local para ser falla) y le gana al segundo por una compuerta relativa de 1.7× (debe separarse de los controles negativos). En caso contrario el rodamiento se reporta sano.'
            : 'The three competing faults act as mutual negative controls: a genuine fault stands far above the other two; broadband noise lifts all three about equally. A verdict is declared only if the top score clears an absolute gate of 4.5 (the line must be at least 4.5× its local baseline to be a fault at all) and beats the runner-up by a relative gate of 1.7× (it must out-separate the negative controls). Otherwise the bearing is reported healthy.'}{' '}<Cite id="smith2015" paren /></p>
          <Equation
            tex={String.raw`P(f_0)=\frac{1}{H}\sum_{k=1}^{H}\frac{\max_{|f-kf_0|\le \mathrm{tol}}\,|X(f)|}{\operatorname{median}_{|f-kf_0|\le W,\ |f-kf_0|>\mathrm{tol}}\,|X(f)|},\quad \text{fault}\iff P_{\text{top}}\ge 4.5\ \wedge\ \frac{P_{\text{top}}}{P_{\text{2nd}}}\ge 1.7`}
            caption={es ? 'prominencia armónica promediada con las dos compuertas de decisión' : 'averaged harmonic prominence with the two decision gates'}
          />
          <ul>
            <li><InlineMath tex={String.raw`f_0`} /> — {es ? 'frecuencia de falla candidata (BPFO, BPFI o 2·BSF)' : 'candidate fault frequency (BPFO, BPFI or 2·BSF)'}; <InlineMath tex={String.raw`|X(f)|`} /> — {es ? 'amplitud del espectro de envolvente' : 'envelope-spectrum amplitude'}.</li>
            <li><InlineMath tex={String.raw`H`} /> — {es ? 'armónicos promediados (hasta 5, los que caben bajo' : 'harmonics averaged (up to 5, those that fit below'} <InlineMath tex={String.raw`f_{\max}`} />).</li>
            <li><InlineMath tex={String.raw`\mathrm{tol}=\max(2\,df,\,0.015\,f_0)`} /> — {es ? 'medio ancho de búsqueda del pico' : 'peak-search half-width'}; <InlineMath tex={String.raw`W=\max(12\,df,\,0.12\,f_0)`} /> — {es ? 'medio ancho de la línea base local' : 'local-baseline half-width'}; <InlineMath tex={String.raw`df`} /> — {es ? 'espaciamiento de bins espectrales' : 'spectral bin spacing'}.</li>
            <li>{es ? 'La mediana de base excluye la ventana del pico, así una línea no puede inflar su propia base.' : 'The baseline median excludes the peak window, so a line can-t inflate its own baseline.'}</li>
            <li>{es ? '4.5 — compuerta absoluta de prominencia; 1.7 — compuerta relativa sobre la siguiente mejor falla (margen de control negativo).' : '4.5 — absolute prominence gate; 1.7 — relative gate over the next-best fault (negative-control margin).'}</li>
          </ul>
          <p>{es
            ? 'La confianza combina dos términos acotados —la separación respecto a la segunda falla y el margen sobre la compuerta absoluta— de modo que un espectro marginal y ambiguo reporta honestamente baja confianza en vez de una falsa certeza.'
            : 'Confidence blends two clamped terms — the separation from the second-best fault and the margin above the absolute gate — so a marginal, ambiguous spectrum honestly reports low confidence rather than a false certainty.'}</p>
          <Refs ids={['randall2011', 'smith2015']} label={refsLabel} />
        </div>
      ),
    },
    {
      id: 'prognostics',
      label: es ? 'Pronóstico / RUL' : 'Prognostics / RUL',
      content: (
        <div className="prose">
          <p>{es
            ? 'El pronóstico se plantea como primer cruce a un umbral de falla. Un indicador de salud escalar (aquí una amplitud tipo RMS) se traza sobre las horas de operación. El inicio de degradación se detecta como la primera vez que el indicador sostiene una excursión sobre su línea base sana de más de 4σ durante dos observaciones consecutivas (las estadísticas de base se estiman del primer ~30% de la vida). Sobre los puntos posteriores al inicio, el motor ajusta por mínimos cuadrados un modelo log-lineal, que asume crecimiento exponencial del daño —la forma empíricamente dominante en estudios de vida-hasta-falla de rodamientos.'
            : 'Prognosis is framed as first-passage to a failure threshold. A scalar health indicator (here an RMS-type amplitude) is trended over operating hours. A degradation onset is detected as the first time the indicator sustains an excursion above its healthy baseline by more than 4σ for two consecutive observations (the baseline statistics are estimated from the first ~30% of life). On the post-onset points the engine fits a log-linear model by least squares, which assumes exponential growth of damage — the empirically dominant shape in bearing run-to-failure studies.'}{' '}<Cite id="lei2018" paren /></p>
          <p>{es
            ? 'El tiempo de cruce del umbral se resuelve en forma cerrada, la vida útil remanente es failTime − t_último, y se dibuja un abanico ±2σ_residual hacia adelante a partir de la dispersión de residuos en escala log de la regresión, de modo que la proyección se reporta como banda, no como una línea engañosa única.'
            : 'The threshold-crossing time is solved in closed form, the remaining useful life is failTime − t_last, and a forward ±2σ_residual fan is drawn from the regression-s log-scale residual spread, so the projection is reported as a band, not a single deceptive line.'}{' '}<Cite id="wang2020xjtu" paren /></p>
          <Equation
            tex={String.raw`\ln \mathrm{HI}(t)=\ln a + b\,t,\quad t_{\text{fail}}=\frac{\ln(\Theta)-\ln a}{b},\quad \mathrm{RUL}=\max\!\big(0,\ t_{\text{fail}}-t_{\text{last}}\big),\quad \text{band}=\exp\!\big(\ln a + b\,t \pm 2\,\sigma_{\text{res}}\big)`}
            caption={es ? 'ajuste log-lineal, primer cruce en forma cerrada y abanico de incertidumbre' : 'log-linear fit, closed-form first-passage and uncertainty fan'}
          />
          <ul>
            <li><InlineMath tex={String.raw`\mathrm{HI}(t)`} /> — {es ? 'indicador de salud al tiempo de operación t (horas)' : 'health indicator at operating time t (hours)'}; <InlineMath tex={String.raw`a,b`} /> — {es ? 'intercepto/crecimiento ajustados (se requiere b>0, si no, no hay proyección)' : 'fitted intercept/growth (b>0 required, else no projection)'}.</li>
            <li><InlineMath tex={String.raw`\Theta`} /> — {es ? 'umbral de falla (alarma) sobre el indicador' : 'failure (alarm) threshold on the indicator'}.</li>
            <li><InlineMath tex={String.raw`\sigma_{\text{res}}`} /> — {es ? 'desviación estándar de los residuos de regresión en escala log; el abanico ±2σ_res es la banda de incertidumbre proyectada' : 'standard deviation of the log-scale regression residuals; the ±2σ_res fan is the projected uncertainty band'}.</li>
            <li>{es ? 'Inicio: primer índice donde' : 'Onset: first index where'} <InlineMath tex={String.raw`\mathrm{HI}>\mu_{\text{base}}+4\sigma_{\text{base}}`} /> {es ? 'durante dos puntos consecutivos' : 'for two consecutive points'}.</li>
          </ul>
          <Callout variant="honest" title={es ? 'Frontera de honestidad' : 'Honesty boundary'}>
            {es
              ? 'El método (regla de inicio, ajuste exponencial, proyección de primer cruce, abanico de incertidumbre) es exactamente lo que corre; los números de severidad y vida en los escenarios entregados son ilustrativos —generados por un modelo sintético de vida-hasta-falla en el que mayor severidad plantada produce inicio más temprano y crecimiento más rápido, y un rodamiento sano no produce inicio y por tanto ninguna proyección. La forma de la tendencia refleja datos reales de vida-hasta-falla (base plana, un inicio, crecimiento exponencial hasta una alarma definida), pero las horas absolutas no son la medición de un rodamiento físico.'
              : 'The method (onset rule, exponential fit, first-passage projection, uncertainty fan) is exactly what runs; the severity and life numbers in the shipped scenarios are illustrative — generated by a synthetic run-to-failure model in which higher planted severity yields earlier onset and faster growth, and a healthy bearing produces no onset and therefore no projection. The trend shape mirrors real run-to-failure data (a flat baseline, an onset, exponential growth to a defined alarm), but the absolute hours are not a measurement of a physical bearing.'}
          </Callout>
          <Refs ids={['lei2018', 'wang2020xjtu']} label={refsLabel} />
        </div>
      ),
    },
    {
      id: 'iso',
      label: es ? 'ISO + modelo directo' : 'ISO + forward model',
      content: (
        <div className="prose">
          <p>{es
            ? 'La severidad global de vibración se mapea a las zonas estándar de evaluación A/B/C/D, dando una banda familiar de un vistazo (bueno / aceptable / insatisfactorio / inaceptable) junto a los espectros detallados.'
            : 'Overall vibration severity is mapped onto the standard A/B/C/D evaluation zones, giving a familiar at-a-glance band (good / acceptable / unsatisfactory / unacceptable) alongside the detailed spectra.'}{' '}<Cite id="iso20816" paren /> <Cite id="iso20816_3_2022" paren /></p>
          <p>{es
            ? 'El generador de señal sintética que alimenta las demos en vivo es un modelo directo físicamente fundado: un tren cuasi-periódico de impulsos a la frecuencia cinemática de falla, cada impulso excitando una resonancia amortiguada, con pequeño jitter de deslizamiento por intervalo (~0.5% de un periodo, que preserva la periodicidad en lugar de destruirla), modulación de amplitud específica por falla (pista interna modulada a la velocidad de eje, bola a la de jaula, externa sin modular), armónicos de eje y ruido gaussiano aditivo escalado a un SNR objetivo.'
            : 'The synthetic signal generator that drives the live demos is a physically grounded forward model: a quasi-periodic impulse train at the kinematic fault frequency, each impulse exciting a damped resonance, with small per-interval slip jitter (~0.5% of one period, preserving periodicity rather than destroying it), fault-specific amplitude modulation (inner-race modulated at shaft rate, ball at cage rate, outer-race unmodulated), shaft harmonics, and additive Gaussian noise scaled to a target SNR.'}</p>
          <Equation
            tex={String.raw`x(t)=\sum_{m} A_m\,e^{-\zeta\omega_n (t-t_m)}\sin\!\big(\omega_d (t-t_m)\big)\,\big[1+\beta\cos(2\pi f_{\text{mod}} t)\big]+\text{shaft harmonics}+n(t)`}
            caption={es ? 'modelo directo: tren de impulsos amortiguados modulado en amplitud, más armónicos y ruido' : 'forward model: amplitude-modulated damped-impulse train, plus harmonics and noise'}
          />
          <ul>
            <li><InlineMath tex={String.raw`t_m`} /> — {es ? 'instantes de impacto al periodo de falla, con jitter de deslizamiento ~0.5%' : 'impact instants at the fault period, with ~0.5% slip jitter'}.</li>
            <li><InlineMath tex={String.raw`\zeta,\ \omega_n,\ \omega_d`} /> — {es ? 'amortiguamiento, frecuencia natural y amortiguada de la resonancia excitada' : 'damping, natural and damped frequency of the excited resonance'}.</li>
            <li><InlineMath tex={String.raw`f_{\text{mod}}`} /> — {es ? 'frecuencia de modulación específica por falla (eje para interna, jaula para bola, ninguna para externa)' : 'fault-specific modulation frequency (shaft for inner, cage for ball, none for outer)'}; <InlineMath tex={String.raw`n(t)`} /> — {es ? 'ruido gaussiano escalado al SNR objetivo' : 'Gaussian noise scaled to the target SNR'}.</li>
          </ul>
          <p>{es
            ? 'Como esto es el inverso exacto de lo que detecta la cadena de análisis de envolvente, las demos cierran el lazo: el modelo planta una frecuencia de falla conocida y el motor en vivo la recupera, que es el sentido honesto de «conjunto de validación» aquí.'
            : 'Because this is the exact inverse of what the envelope-analysis chain detects, the demos close the loop: the model plants a known fault frequency and the live engine recovers it, which is the honest meaning of "validation set" here.'}{' '}<Cite id="randall2011" paren /></p>
          <Refs ids={['iso20816', 'iso20816_3_2022', 'randall2011']} label={refsLabel} />
        </div>
      ),
    },
    {
      id: 'deploy',
      label: es ? 'Despliegue' : 'Deployment',
      content: (
        <div className="prose">
          <p>{es
            ? 'El producto se entrega como activos estáticos pre-construidos —HTML, JavaScript, los artefactos compactos precalculados— servidos directamente desde una red de distribución de contenidos (CDN), sin servidor de aplicación ni base de datos en la ruta de la solicitud. El navegador descarga el bundle una vez y corre el DSP en vivo localmente; el único «backend» es la caché de borde del CDN.'
            : 'The product is shipped as pre-built static assets — HTML, JavaScript, the compact precomputed artifacts — served directly from a content-delivery network with no application server and no database in the request path. The browser fetches the bundle once and runs the live DSP locally; the only "backend" is the CDN-s edge cache.'}{' '}<Cite id="randall2011" paren /></p>
          <p>{es
            ? 'El armazón de aplicación —navegación, tema claro/oscuro, contenido bilingüe (EN/ES), el marco de citas y metodología, y el lenguaje visual de diseño (paleta, tipografía, convenciones de diagramas)— proviene de un sistema de diseño compartido reutilizado en una suite de apps de analítica, de modo que cada app hereda un armazón consistente y solo aporta su propia lógica de dominio y artefactos.'
            : 'The application shell — navigation, light/dark theming, bilingual (EN/ES) content, the citation and methodology framing, and the visual design language (palette, typography, diagram conventions) — comes from a shared design system reused across a suite of analytics apps, so each app inherits a consistent shell and only contributes its own domain logic and artifacts.'}</p>
          <Callout variant="strong" title={es ? 'Reproducibilidad por construcción' : 'Reproducible by construction'}>
            {es
              ? 'La combinación de hosting estático más un núcleo de cómputo determinista y sembrado es lo que hace reproducible cada figura de la página: no hay servicio en vivo cuyo estado pudiera derivar, así que la misma página siempre renderiza los mismos números.'
              : 'The combination of static hosting plus a deterministic, seeded compute core is what makes every figure on the page reproducible: there is no live service whose state could drift, so the same page always renders the same numbers.'}
          </Callout>
          <Refs ids={['randall2011', 'lei2018']} label={refsLabel} />
        </div>
      ),
    },
  ];

  return (
    <div className="page-body">
      <div className="page-head prose">
        <h1>{es ? 'Implementación' : 'Implementation'}</h1>
        <p className="lede">{es
          ? 'Cómputo pesado offline → artefacto compacto → runtime fino. Lo liviano corre en vivo en el navegador, sembrado y reproducible.'
          : 'Heavy compute offline → compact artifact → thin runtime. Light work runs live in the browser, seeded and reproducible.'} <InlineMath tex={String.raw`f_r=\mathrm{rpm}/60`} /></p>
      </div>
      <Tabs tabs={tabs} ariaLabel={es ? 'implementación' : 'implementation'} />
    </div>
  );
}
