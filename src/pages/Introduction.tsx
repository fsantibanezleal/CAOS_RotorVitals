import { Callout, Equation, InlineMath, Refs, useShellLang } from '@fasl-work/caos-app-shell';

export default function Introduction() {
  const es = useShellLang() === 'es';
  return (
    <div className="page-body prose">
      <div className="page-head">
        <h1>{es ? 'Introducción' : 'Introduction'}</h1>
        <p className="lede">{es
          ? 'RotorVitals es una suite real de monitoreo de condición y prognóstico de maquinaria rotativa — no la demo de un solo algoritmo. Toma una señal de vibración y la lleva por el pipeline completo de la disciplina: desde las frecuencias cinemáticas del rodamiento hasta el diagnóstico, la severidad y la vida útil remanente.'
          : 'RotorVitals is a real condition-monitoring & prognostics suite for rotating machinery — not a single-algorithm demo. It takes a vibration signal through the field’s full pipeline: from the bearing kinematic frequencies through diagnosis, severity and remaining useful life.'}</p>
      </div>

      {/* ===== Hero: system-overview pipeline ===== */}
      <section>
        <figure className="fig-svg">
          <svg viewBox="0 0 980 360" width="100%" role="img"
               aria-labelledby="rv-flow-title rv-flow-desc"
               style={{ fontFamily: 'var(--font-mono)', background: 'var(--color-bg)' }}>
            <title id="rv-flow-title">{es
              ? 'Pipeline de diagnóstico de rodamientos: de la vibración a la vida remanente'
              : 'Bearing-diagnosis pipeline: vibration to remaining useful life'}</title>
            <desc id="rv-flow-desc">{es
              ? 'La vibración cruda junto con la geometría del rodamiento y la velocidad del eje alimentan dos entradas paralelas: las frecuencias cinemáticas de defecto y la selección de banda por kurtograma. La banda seleccionada impulsa la demodulación de envolvente hacia el espectro de envolvente de amplitud, que se contrasta con los objetivos cinemáticos en la etapa de diagnóstico, luego se gradúa con un índice de severidad al estilo ISO 20816 y se proyecta a una estimación de vida útil remanente.'
              : 'Raw vibration plus bearing geometry and shaft speed feed two parallel inputs: kinematic defect frequencies and a kurtogram band selection. The selected band drives envelope demodulation into the amplitude-envelope spectrum, which is matched against the kinematic targets in the diagnosis stage, then graded by an ISO-20816-style severity index and projected to a remaining-useful-life estimate.'}</desc>

            <defs>
              <marker id="rv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" fill="var(--color-fg-faint)" />
              </marker>
              <style>{`
                .rv-node { fill: var(--color-surface); stroke: var(--color-border); stroke-width: 1.5; }
                .rv-title { fill: var(--color-fg); font-size: 13px; font-weight: 600; }
                .rv-sub { fill: var(--color-fg-subtle); font-size: 10px; }
                .rv-edge { stroke: var(--color-fg-faint); stroke-width: 1.5; fill: none; }
                .rv-edge-lbl { fill: var(--color-fg-subtle); font-size: 9.5px; }
                .rv-stage { fill: var(--color-fg-subtle); font-size: 9px; letter-spacing: 1px; }
              `}</style>
            </defs>

            {/* ---- INPUTS (left column) ---- */}
            <text x="20" y="28" className="rv-stage">{es ? 'ENTRADAS' : 'INPUTS'}</text>

            <g>
              <rect className="rv-node" x="16" y="44" width="150" height="56" rx="8" />
              <text x="91" y="68" textAnchor="middle" className="rv-title">{es ? 'Señal de vibración' : 'Vibration signal'}</text>
              <text x="91" y="84" textAnchor="middle" className="rv-sub">accel x(t) · fs</text>
            </g>

            <g>
              <rect className="rv-node" x="16" y="128" width="150" height="56" rx="8" />
              <text x="91" y="152" textAnchor="middle" className="rv-title">{es ? 'Rodamiento + giro' : 'Bearing + speed'}</text>
              <text x="91" y="168" textAnchor="middle" className="rv-sub">n, d, D, φ · rpm</text>
            </g>

            {/* ---- STAGE 1: kinematics ---- */}
            <g>
              <rect className="rv-node" x="220" y="120" width="168" height="72" rx="8" stroke="var(--color-accent)" />
              <text x="304" y="146" textAnchor="middle" className="rv-title">{es ? 'Frec. cinemáticas' : 'Kinematic freqs'}</text>
              <text x="304" y="162" textAnchor="middle" className="rv-sub">FTF · BPFO · BPFI</text>
              <text x="304" y="176" textAnchor="middle" className="rv-sub">2·BSF {es ? '(objetivos)' : '(targets)'}</text>
            </g>

            {/* ---- STAGE 2: kurtogram band selection ---- */}
            <g>
              <rect className="rv-node" x="220" y="40" width="168" height="60" rx="8" />
              <text x="304" y="64" textAnchor="middle" className="rv-title">{es ? 'Kurtograma' : 'Kurtogram'}</text>
              <text x="304" y="80" textAnchor="middle" className="rv-sub">{es ? 'niveles 1..5 · máx kurtosis' : 'levels 1..5 · max kurtosis'}</text>
            </g>

            {/* ---- STAGE 3: envelope spectrum ---- */}
            <g>
              <rect className="rv-node" x="452" y="40" width="170" height="72" rx="8" />
              <text x="537" y="64" textAnchor="middle" className="rv-title">{es ? 'Espectro de envolvente' : 'Envelope spectrum'}</text>
              <text x="537" y="80" textAnchor="middle" className="rv-sub">{es ? 'pasa-banda → Hilbert' : 'band-pass → Hilbert'}</text>
              <text x="537" y="94" textAnchor="middle" className="rv-sub">{es ? 'espectro mag. Hann' : 'Hann mag spectrum'}</text>
            </g>

            {/* ---- STAGE 4: diagnosis ---- */}
            <g>
              <rect className="rv-node" x="452" y="148" width="170" height="84" rx="8" stroke="var(--color-magenta)" />
              <text x="537" y="172" textAnchor="middle" className="rv-title">{es ? 'Diagnóstico' : 'Diagnosis'}</text>
              <text x="537" y="188" textAnchor="middle" className="rv-sub">{es ? 'prominencia armónica' : 'harmonic prominence'}</text>
              <text x="537" y="202" textAnchor="middle" className="rv-sub">{es ? 'compuerta abs 4.5' : 'abs gate 4.5'}</text>
              <text x="537" y="216" textAnchor="middle" className="rv-sub">{es ? 'compuerta rel 1.7' : 'rel gate 1.7'}</text>
            </g>

            {/* ---- STAGE 5: severity index ---- */}
            <g>
              <rect className="rv-node" x="690" y="40" width="150" height="72" rx="8" stroke="var(--color-warn)" />
              <text x="765" y="64" textAnchor="middle" className="rv-title">{es ? 'Índice severidad' : 'Severity index'}</text>
              <text x="765" y="80" textAnchor="middle" className="rv-sub">{es ? 'estilo ISO 20816' : 'ISO-20816 style'}</text>
              <text x="765" y="94" textAnchor="middle" className="rv-sub">{es ? 'Sano–Disparo' : 'Healthy–Trip'}</text>
            </g>

            {/* ---- STAGE 6: RUL ---- */}
            <g>
              <rect className="rv-node" x="690" y="148" width="150" height="84" rx="8" stroke="var(--color-good)" />
              <text x="765" y="172" textAnchor="middle" className="rv-title">RUL</text>
              <text x="765" y="188" textAnchor="middle" className="rv-sub">{es ? 'inicio HI (4σ)' : 'HI onset (4σ)'}</text>
              <text x="765" y="202" textAnchor="middle" className="rv-sub">{es ? 'ajuste exp. →' : 'exp. fit →'}</text>
              <text x="765" y="216" textAnchor="middle" className="rv-sub">{es ? 'primer cruce ± banda' : 'first passage ± band'}</text>
            </g>

            {/* ---- VERDICT (far right) ---- */}
            <g>
              <rect className="rv-node" x="864" y="92" width="100" height="120" rx="8" fill="var(--color-bg)" stroke="var(--color-fg-subtle)" />
              <text x="914" y="120" textAnchor="middle" className="rv-title">{es ? 'Veredicto' : 'Verdict'}</text>
              <text x="914" y="140" textAnchor="middle" className="rv-sub">{es ? 'externa / interna' : 'outer / inner'}</text>
              <text x="914" y="154" textAnchor="middle" className="rv-sub">{es ? '/ bola / sano' : '/ ball / healthy'}</text>
              <text x="914" y="176" textAnchor="middle" className="rv-sub">{es ? '+ zona severidad' : '+ severity zone'}</text>
              <text x="914" y="190" textAnchor="middle" className="rv-sub">{es ? '+ horas restantes' : '+ hours left'}</text>
            </g>

            {/* ===== EDGES with data labels ===== */}
            {/* vibration -> kurtogram */}
            <path className="rv-edge" markerEnd="url(#rv-arrow)" d="M166 60 C 196 60, 196 70, 220 70" />
            {/* bearing+speed -> kinematics */}
            <path className="rv-edge" markerEnd="url(#rv-arrow)" d="M166 156 L 220 156" />
            <text x="178" y="148" className="rv-edge-lbl">{es ? 'geometría' : 'geometry'}</text>

            {/* kurtogram -> envelope (selected band) */}
            <path className="rv-edge" markerEnd="url(#rv-arrow)" d="M388 70 L 452 70" />
            <text x="392" y="62" className="rv-edge-lbl">{es ? 'banda [f1, f2]' : '[f1, f2] band'}</text>

            {/* kinematics -> diagnosis (targets) */}
            <path className="rv-edge" markerEnd="url(#rv-arrow)" d="M388 168 C 416 168, 420 185, 452 185" />
            <text x="392" y="160" className="rv-edge-lbl">{es ? 'frec. objetivo' : 'target freqs'}</text>

            {/* envelope -> diagnosis (envelope spectrum) */}
            <path className="rv-edge" markerEnd="url(#rv-arrow)" d="M537 112 L 537 148" />
            <text x="543" y="134" className="rv-edge-lbl">{es ? 'espectro env.' : 'env. spectrum'}</text>

            {/* envelope/raw -> severity (overall level) */}
            <path className="rv-edge" markerEnd="url(#rv-arrow)" d="M622 70 L 690 70" />
            <text x="628" y="62" className="rv-edge-lbl">{es ? 'RMS / global' : 'RMS / overall'}</text>

            {/* diagnosis -> RUL (HI feed) */}
            <path className="rv-edge" markerEnd="url(#rv-arrow)" d="M622 190 L 690 190" />
            <text x="628" y="182" className="rv-edge-lbl">{es ? 'tendencia HI' : 'HI trend'}</text>

            {/* severity -> verdict */}
            <path className="rv-edge" markerEnd="url(#rv-arrow)" d="M840 84 C 858 84, 858 110, 864 118" />
            {/* diagnosis -> verdict */}
            <path className="rv-edge" markerEnd="url(#rv-arrow)" d="M622 178 C 700 132, 800 150, 864 150" />
            {/* RUL -> verdict */}
            <path className="rv-edge" markerEnd="url(#rv-arrow)" d="M840 196 C 856 196, 858 182, 864 182" />

            {/* stage band labels */}
            <text x="304" y="214" textAnchor="middle" className="rv-stage">{es ? 'SELECCIONAR Y DEMODULAR' : 'SELECT & DEMODULATE'}</text>
            <text x="537" y="252" textAnchor="middle" className="rv-stage">{es ? 'CONTRASTAR' : 'MATCH'}</text>
            <text x="765" y="252" textAnchor="middle" className="rv-stage">{es ? 'GRADUAR Y PROYECTAR' : 'GRADE & PROJECT'}</text>
          </svg>
          <figcaption>{es
            ? 'De la señal cruda a un veredicto: la cadena completa de diagnóstico de rodamientos que implementa esta suite.'
            : 'From raw signal to a verdict: the full bearing-diagnosis chain this suite implements.'}</figcaption>
        </figure>
      </section>

      {/* ===== The industrial problem ===== */}
      <section>
        <h2>{es ? 'El problema industrial' : 'The industrial problem'}</h2>
        <p>{es
          ? 'En todo equipo rotatorio minero — chancadores primarios y secundarios, poleas y polines de correas, bombas de pulpa y de proceso, ventiladores de ventilación y captación de polvo, accionamientos de piñón de molinos SAG/bolas — el rodamiento de elementos rodantes es el punto de falla mecánica más frecuente. Un rodamiento soporta toda la carga dinámica del eje sobre una delgada película de lubricante y unos pocos elementos rodantes, opera de forma continua y se degrada por fatiga, contaminación, lubricación deficiente y sobrecarga mucho antes de que otro componente dé señales.'
          : 'Across mining rotating equipment — primary and secondary crushers, conveyor pulleys and idlers, slurry and process pumps, ventilation and dust-collection fans, ball/SAG mill pinion drives — the rolling-element bearing is the single most common point of mechanical failure. A bearing carries the full dynamic load of the shaft on a thin lubricant film over a handful of rolling elements, runs continuously, and degrades from fatigue, contamination, poor lubrication and overload long before any other component shows distress.'}</p>
        <p>{es
          ? 'El costo es asimétrico: el rodamiento es barato, pero una detención no planificada en una línea crítica — un chancador que se agarrota a mitad de turno, un accionamiento de correa que falla entre ventanas de mantención — se propaga en pérdida de producción, daño secundario al eje y la carcasa, y trabajo de emergencia en el peor momento. La disciplina del monitoreo de condición basado en vibración existe para convertir esa falla no planificada en una intervención planificada, detectando el defecto semanas antes de que sea catastrófico y estimando cuánto tiempo de operación resta.'
          : 'The cost is asymmetric: the bearing itself is cheap, but an unplanned stop on a critical line — a crusher that seizes mid-shift, a conveyor drive that fails between maintenance windows — cascades into lost throughput, secondary damage to the shaft and housing, and emergency labour at the worst possible time. The discipline of vibration-based condition monitoring exists to convert that unplanned failure into a planned intervention, by detecting the defect weeks before it becomes catastrophic and estimating how much running time remains.'}</p>
        <Refs ids={['randall2011']} label={es ? 'Refs' : 'Refs'} />
      </section>

      {/* ===== The physics of a localized defect ===== */}
      <section>
        <h2>{es ? 'La física de un defecto localizado' : 'The physics of a localized defect'}</h2>
        <p>{es
          ? 'Un defecto localizado en el rodamiento — una descascarilla (spall), picadura o grieta en la pista externa, la pista interna o un elemento rodante — produce un impulso de fuerza cada vez que un elemento rodante pasa sobre él. El contacto es súbito y de banda ancha, de modo que cada paso actúa como un martillazo casi impulsivo que excita una resonancia estructural de alta frecuencia de la carcasa del rodamiento y la mecánica circundante (a menudo en el rango de kHz). Lo que se mide en el acelerómetro, por tanto, no es la frecuencia de defecto directamente, sino esa resonancia decayendo — repetidamente — una vez por cada contacto.'
          : 'A localized bearing defect — a spall, pit, or crack on the outer race, inner race, or a rolling element — produces a force impulse each time a rolling element passes over it. The contact is sudden and broadband, so each pass acts as a near-impulsive hammer-blow that excites a high-frequency structural resonance of the bearing housing and surrounding mechanics (often in the kHz range). What you measure at the accelerometer is therefore not the defect frequency directly, but that resonance ringing down — repeatedly — once per defect contact.'}</p>
        <p>{es
          ? 'El resultado es una portadora (la resonancia) modulada en amplitud a la baja frecuencia de defecto cinemática (la tasa de contacto). Este es el núcleo: en el espectro crudo la energía está arriba, en la resonancia, difuminada por toda otra fuente de banda ancha, y la lenta tasa de defecto queda enterrada como bandas laterales de modulación fáciles de pasar por alto. La falla se esconde en cómo se modula la energía de alta frecuencia, no en una línea aislada. Por eso justamente la demodulación de amplitud (análisis de envolvente) es la herramienta correcta: remover la portadora y recuperar la señal moduladora expone la tasa de defecto como una línea espectral limpia, allí donde el espectro crudo no mostraba nada accionable.'
          : 'The result is a carrier (the resonance) amplitude-modulated at the low kinematic defect frequency (the contact rate). This is the crux: in the raw spectrum the energy sits up at the resonance, smeared by every other broadband source, and the slow defect rate is buried as modulation sidebands that are easy to miss. The fault hides in how the high-frequency energy is modulated, not in any single line. That is precisely why amplitude demodulation (envelope analysis) is the correct tool: stripping away the carrier and recovering the modulating signal exposes the defect rate as a clean spectral line, where the raw spectrum showed nothing actionable.'}</p>
        <Refs ids={['randall2011']} label={es ? 'Refs' : 'Refs'} />
      </section>

      {/* ===== Kinematics ===== */}
      <section>
        <h2>{es ? 'La cinemática — frecuencias exactas y transferibles' : 'The kinematics — exact, transferable frequencies'}</h2>
        <p>{es
          ? 'La tasa de contacto está fijada por la geometría y la velocidad del eje, no por el tamaño del defecto, de modo que es la misma para cualquier rodamiento de dimensiones dadas. Dados la frecuencia de rotación del eje '
          : 'The contact rate is fixed by geometry and shaft speed, not by the defect’s size, so it is the same for any bearing of given dimensions. Given the shaft rotational frequency '}
          <InlineMath tex={String.raw`f_r`} />{es ? ' (Hz), el número de elementos rodantes ' : ' (Hz), the number of rolling elements '}
          <InlineMath tex={String.raw`n`} />{es ? ', el diámetro del elemento ' : ', the rolling-element diameter '}
          <InlineMath tex={String.raw`d`} />{es ? ', el diámetro de paso ' : ', the pitch diameter '}
          <InlineMath tex={String.raw`D`} />{es ? ' y el ángulo de contacto ' : ', and the contact angle '}
          <InlineMath tex={String.raw`\phi`} />{es
            ? ', esta suite calcula las cuatro frecuencias características de defecto con las relaciones cinemáticas estándar.'
            : ', this build computes the four characteristic defect frequencies with the standard kinematic relations.'}</p>

        <Equation
          tex={String.raw`f_{r} = \frac{\text{rpm}}{60}, \qquad r = \frac{d}{D}\cos\phi`}
          caption={es ? 'Frecuencia de rotación del eje y la razón de geometría adimensional.' : 'Shaft rotational frequency and the dimensionless geometry ratio.'}
        />
        <Equation
          tex={String.raw`\text{FTF} = \tfrac{1}{2} f_r\,(1 - r), \quad
\text{BPFO} = \tfrac{1}{2} n\, f_r\,(1 - r), \quad
\text{BPFI} = \tfrac{1}{2} n\, f_r\,(1 + r), \quad
\text{BSF} = \frac{D}{2d}\, f_r\,(1 - r^2)`}
          caption={es ? 'Las cuatro frecuencias características de defecto del rodamiento.' : 'The four characteristic bearing-defect frequencies.'}
        />

        <p>{es
          ? 'donde FTF es la frecuencia fundamental de jaula, BPFO la frecuencia de paso de bola en la pista externa, BPFI en la pista interna y BSF la frecuencia de giro de bola. Un defecto en un elemento rodante golpea ambas pistas por giro, por lo que esta suite diagnostica una falla de bola en su línea dominante '
          : 'where FTF is the fundamental train (cage) frequency, BPFO the ball-pass frequency on the outer race, BPFI on the inner race, and BSF the ball-spin frequency. A rolling-element defect strikes both races per spin, so this build diagnoses a ball fault at its dominant line '}
          <InlineMath tex={String.raw`2\cdot\text{BSF}`} />{es ? ', no en BSF. ' : ', not BSF itself. '}
          {es
            ? 'Estas relaciones son exactas y transferibles — valen para datos reales medidos igual que para datos sintéticos; solo los números de severidad y vida restante de las demostraciones son ilustrativos (ver la nota de marco honesto más abajo).'
            : 'These relations are exact and transferable — they hold for real measured data identically to synthetic data; only the severity and remaining-life numbers in the demonstrations are illustrative (see the honest-framing note below).'}</p>

        <h3>{es ? 'Símbolos' : 'Symbols'}</h3>
        <ul>
          <li><InlineMath tex={String.raw`f_r`} /> — {es ? 'frecuencia de rotación del eje (Hz) ' : 'shaft rotational frequency (Hz) '}<InlineMath tex={String.raw`= \text{rpm}/60`} />.</li>
          <li><InlineMath tex={String.raw`\text{rpm}`} /> — {es ? 'velocidad del eje en revoluciones por minuto.' : 'shaft speed in revolutions per minute.'}</li>
          <li><InlineMath tex={String.raw`n`} /> — {es ? 'número de elementos rodantes del rodamiento.' : 'number of rolling elements in the bearing.'}</li>
          <li><InlineMath tex={String.raw`d`} /> — {es ? 'diámetro del elemento rodante (bola/rodillo).' : 'rolling-element (ball/roller) diameter.'}</li>
          <li><InlineMath tex={String.raw`D`} /> — {es ? 'diámetro de paso (diámetro del círculo que pasa por los centros de los elementos rodantes).' : 'pitch diameter (diameter of the circle through the rolling-element centers).'}</li>
          <li><InlineMath tex={String.raw`\phi`} /> — {es ? 'ángulo de contacto entre la línea de carga y el plano perpendicular al eje.' : 'contact angle between the load line and the plane perpendicular to the shaft.'}</li>
          <li><InlineMath tex={String.raw`r = \tfrac{d}{D}\cos\phi`} /> — {es ? 'razón de geometría adimensional que aparece en las cuatro relaciones.' : 'dimensionless geometry ratio appearing in all four relations.'}</li>
          <li><InlineMath tex={String.raw`\text{FTF}`} /> — {es ? 'frecuencia fundamental de jaula (Hz).' : 'fundamental train (cage) frequency (Hz).'}</li>
          <li><InlineMath tex={String.raw`\text{BPFO},\ \text{BPFI}`} /> — {es ? 'frecuencia de paso de bola en la pista externa / interna (Hz).' : 'ball-pass frequency on the outer / inner race (Hz).'}</li>
          <li><InlineMath tex={String.raw`\text{BSF}`} /> — {es ? 'frecuencia de giro de bola (Hz); la línea dominante de un defecto de bola es ' : 'ball-spin frequency (Hz); a ball defect’s dominant line is '}<InlineMath tex={String.raw`2\cdot\text{BSF}`} />.</li>
          <li><InlineMath tex={String.raw`f_s`} /> — {es ? 'frecuencia de muestreo (Hz); el kurtograma abarca ' : 'sampling rate (Hz); the kurtogram spans '}<InlineMath tex={String.raw`[0, f_s/2]`} />{es ? ' y omite el ' : ' and skips the lowest '}<InlineMath tex={String.raw`0.02\,f_s`} />{es ? ' más bajo.' : '.'}</li>
          <li><InlineMath tex={String.raw`\zeta`} /> — {es ? 'razón de amortiguamiento de la resonancia estructural excitada; ' : 'damping ratio of the excited structural resonance; '}<InlineMath tex={String.raw`\omega_n`} />{es ? ' su frecuencia angular natural no amortiguada, ' : ' its undamped natural angular frequency, '}<InlineMath tex={String.raw`\omega_d=\omega_n\sqrt{1-\zeta^2}`} />{es ? ' su frecuencia angular amortiguada.' : ' its damped angular frequency.'}</li>
        </ul>
        <Refs ids={['randall2011']} label={es ? 'Refs' : 'Refs'} />
      </section>

      {/* ===== Suite scope ===== */}
      <section>
        <h2>{es ? 'Alcance del conjunto — un pipeline, no un solo algoritmo' : 'The suite scope — a pipeline, not one algorithm'}</h2>
        <p>{es
          ? 'El diagnóstico de rodamientos no es un truco único; es una cadena disciplinada, y este conjunto la implementa de extremo a extremo.'
          : 'Bearing diagnosis is not a single trick; it is a disciplined chain, and this suite implements the chain end to end.'}</p>
        <ol>
          <li>{es
            ? 'Desde la geometría y la velocidad calcula las frecuencias cinemáticas anteriores — los objetivos que toda etapa posterior busca.'
            : 'From geometry and speed it computes the kinematic frequencies above — the targets every later stage looks for.'}</li>
          <li>{es
            ? 'Como la falla vive en una banda de resonancia desconocida, resuelve el problema más difícil del análisis de envolvente — dónde demodular — con un kurtograma: divide '
            : 'Because the fault lives in an unknown resonance band, it solves the hardest problem in envelope analysis — where to demodulate — with a kurtogram: it splits '}
            <InlineMath tex={String.raw`[0, f_s/2]`} />{es
              ? ' en bandas diádicas a través de los niveles 1…5 (omitiendo el 2% más bajo de '
              : ' into dyadic bands across levels 1…5 (skipping the lowest 2% of '}
            <InlineMath tex={String.raw`f_s`} />{es
              ? ', que porta contenido determinista del eje), filtra cada banda, toma la envolvente de Hilbert y la puntúa por curtosis en exceso; la banda de máxima curtosis es la banda óptima de demodulación, porque el contenido impulsivo de falla es justamente lo que eleva la curtosis.'
              : ', which carries deterministic shaft content), band-passes each, takes the Hilbert envelope, and scores it by excess kurtosis; the maximal-kurtosis band is the optimal demodulation band, because impulsive fault content is precisely what raises kurtosis.'}</li>
          <li>{es
            ? 'Luego calcula el espectro de envolvente de amplitud en esa banda: un filtro pasa-banda de pared abrupta en el dominio FFT, una señal analítica formada por duplicación del medio espectro FFT (se conservan DC y Nyquist, se duplican las frecuencias positivas, se anulan las negativas), la magnitud de la envolvente y un espectro de amplitud de un solo lado con ventana Hann y media removida.'
            : 'It then computes the amplitude-envelope spectrum in that band: an FFT-domain brick-wall band-pass, an analytic signal formed by FFT half-spectrum doubling (DC and Nyquist kept, positive frequencies doubled, negatives zeroed), the magnitude envelope, and a Hann-windowed, mean-removed, single-sided amplitude spectrum.'}</li>
          <li>{es
            ? 'El diagnóstico es explícito y explicable: para cada falla candidata (BPFO, BPFI, 2·BSF) mide la prominencia de los primeros cinco armónicos — cada pico armónico dividido por la mediana local de los bines circundantes — y los promedia; las fallas competidoras actúan como controles negativos. Un veredicto de "falla" exige que el mayor puntaje supere una compuerta absoluta de 4.5 y venza a la siguiente mejor falla por una razón relativa de 1.7; de lo contrario el rodamiento se declara sano.'
            : 'Diagnosis is explicit and explainable: for each candidate fault (BPFO, BPFI, 2·BSF) it measures the prominence of the first five harmonics — each harmonic peak divided by the local-median baseline of the surrounding bins — and averages them; the competing faults act as negative controls. A verdict of “fault” requires the top score to clear an absolute gate of 4.5 and beat the next-best fault by a relative ratio of 1.7; otherwise the bearing is called healthy.'}</li>
          <li>{es
            ? 'La vibración global se gradúa con un índice de severidad al estilo ISO 20816 — zonas ilustrativas (Sano / Vigilar / Alarma / Disparo), no una lectura certificada de velocidad en mm/s.'
            : 'Overall vibration is graded with an ISO-20816-style severity index — illustrative zones (Healthy / Watch / Alarm / Trip), not a certified velocity reading in mm/s.'}</li>
          <li>{es
            ? 'Una tendencia de degradación se proyecta a un umbral de falla para una estimación de vida útil remanente (RUL).'
            : 'A degradation trend is projected to a failure threshold for a remaining-useful-life (RUL) estimate.'}</li>
        </ol>
        <p>{es
          ? 'Vistas complementarias — el espectrograma de magnitud, el cepstrum real (que colapsa familias de armónicos/bandas laterales en un solo rahmónico), la curtosis espectral y una aproximación de espectro de modulación cíclica a la coherencia espectral cíclica — completan el mismo registro desde ángulos independientes.'
          : 'Complementary views — the magnitude spectrogram, real cepstrum (collapsing harmonic/sideband families to a single rahmonic), spectral kurtosis, and a cyclic-modulation-spectrum approximation to cyclic spectral coherence — round out the same record from independent angles.'}</p>
        <Refs ids={['randall2011', 'antoni2006sk', 'antoni2007', 'smith2015', 'iso20816']} label={es ? 'Refs' : 'Refs'} />
      </section>

      {/* ===== RUL: exact vs illustrative ===== */}
      <section>
        <h2>{es ? 'Cómo se estima la RUL — y qué es exacto vs. ilustrativo' : 'How RUL is estimated — and what is exact vs. illustrative'}</h2>
        <p>{es
          ? 'La etapa de vida remanente sigue un indicador de salud (HI) escalar a lo largo del tiempo de operación, detecta el inicio de degradación como una excursión sostenida sobre la línea base sana (media '
          : 'The remaining-life stage tracks a scalar health indicator (HI) over operating time, detects degradation onset as a sustained excursion above the healthy baseline (mean '}
          <InlineMath tex={String.raw`+\,4\sigma`} />{es
            ? ' en dos puntos consecutivos), ajusta un modelo de crecimiento exponencial a los puntos posteriores al inicio mediante regresión log-lineal, y proyecta el tiempo de primer cruce en que el HI supera el umbral de alarma; la vida remanente es ese tiempo de cruce menos la última observación, con un abanico de incertidumbre a partir de la dispersión del residuo de la regresión ('
            : ' across two consecutive points), fits an exponential growth model to the post-onset points by log-linear regression, and projects the first-passage time at which the HI crosses the alarm threshold; remaining life is that crossing time minus the last observation, with an uncertainty fan from the regression residual spread ('}
          <InlineMath tex={String.raw`\pm 2`} />{es ? ' desviaciones estándar residuales en escala logarítmica).' : ' residual standard deviations on the log scale).'}</p>

        <Equation
          tex={String.raw`\ln(\text{HI}) = \ln A + b\,t, \qquad
t_{\text{fail}} = \frac{\ln(\text{thr}) - \ln A}{b}, \qquad
\text{RUL} = t_{\text{fail}} - t_{\text{last}}`}
          caption={es ? 'Ajuste log-lineal del HI, tiempo de primer cruce al umbral y vida remanente.' : 'Log-linear HI fit, first-passage time to threshold, and remaining life.'}
        />

        <p>{es
          ? 'Esta lógica de primer cruce es un método pronóstico real y estándar. Las relaciones de procesamiento de señal son exactas — las frecuencias cinemáticas, la demodulación y la lógica de prominencia armónica se transfieren directamente a vibración real medida. Las severidades de demostración y trayectorias run-to-failure mostradas en la app son sintéticas y están etiquetadas como tales: el generador sintético construye un tren de impulsos de resonancia amortiguada con base física (cada impulso una resonancia decreciente '
          : 'This first-passage logic is a real, standard prognostic method. The signal-processing relations are exact — the kinematic frequencies, the demodulation, and the harmonic-prominence logic transfer directly to real measured vibration. The demonstration severities and run-to-failure trajectories shown in the app are synthetic and labeled as such: the synthetic generator builds a physically-grounded damped-resonance impulse train (each impulse a decaying '}
          <InlineMath tex={String.raw`e^{-\zeta\omega_n t}\sin(\omega_d t)`} />{es
            ? ' resonancia, con jitter de deslizamiento de ~0.5% por período de modo que la periodicidad se preserva pero se difumina levemente, fallas de pista interna moduladas en amplitud a '
            : ' resonance, with ~0.5% per-period slip jitter so periodicity is preserved but mildly smeared, inner-race faults amplitude-modulated at '}
          <InlineMath tex={String.raw`f_r`} />{es
            ? ' y fallas de bola a la tasa de jaula FTF, sobre el fundamental del eje y su segundo armónico más ruido gaussiano hasta un SNR objetivo), y el HI run-to-failure es una curva sintética base→inicio→crecimiento-exponencial modelada sobre estudios run-to-failure publicados. Tratar las relaciones de frecuencia como verdad de terreno y los números absolutos de severidad / horas-a-falla como ilustrativos.'
            : ' and ball faults at the cage rate FTF, over the shaft fundamental and its second harmonic plus Gaussian noise to a target SNR), and the run-to-failure HI is a synthetic baseline→onset→exponential-growth curve modeled on published run-to-failure studies. Treat the frequency relationships as ground truth and the absolute severity / hours-to-failure numbers as illustrative.'}</p>
        <Refs ids={['lei2018', 'randall2011', 'smith2015']} label={es ? 'Refs' : 'Refs'} />
      </section>

      {/* ===== Honest framing ===== */}
      <section>
        <Callout variant="honest" title={es ? 'Marco honesto' : 'Honest framing'}>
          {es
            ? 'Las relaciones de frecuencia son exactas y transfieren a grabaciones reales. La severidad absoluta y el RUL de las trazas sintéticas son ilustrativos y están etiquetados como tales; los resultados sobre datos reales se reportan con su dataset, partición y métrica. No es una certificación de salud de máquina.'
            : 'The frequency relationships are exact and transfer to real recordings. Absolute severity and RUL on synthetic traces are illustrative and labeled as such; results on real data are reported with their dataset, split and metric. This is not a certified machine-health verdict.'}
        </Callout>
      </section>
    </div>
  );
}
