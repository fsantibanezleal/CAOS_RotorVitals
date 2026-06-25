import { Tabs, Cite, Equation, InlineMath, Refs, useShellLang } from '@fasl-work/caos-app-shell';

type DatasetRow = {
  name: string;
  fit: string;
  faults: string;
  redist: 'mirror' | 'link';
  // What is actually wired in the app today: 'live' = trained + benchmarked (CWRU);
  // 'crosseval' = real data used for the held-out cross-dataset domain-shift test (MFPT);
  // 'rul-real' = real run-to-failure data integrated into the Prognostics·RUL tab (FEMTO; IMS/XJTU as they land);
  // undefined = roadmap (not yet integrated). Keeps this table consistent with the App + Benchmark pages.
  appStatus?: 'live' | 'crosseval' | 'rul-real';
  note: { es: string; en: string };
};

// Real public datasets. `redist` records whether the set may be mirrored with
// attribution (open license) or is link-only (no explicit redistribution grant).
const DATASETS: DatasetRow[] = [
  {
    name: 'CWRU (Case Western)', fit: 'diagnosis', faults: 'OR/IR/ball · 3 sizes · 0–3 hp', redist: 'link', appStatus: 'live',
    note: { es: 'El benchmark canónico; Smith & Randall (2015) gradúan la dificultad de cada registro.', en: 'The canonical benchmark; Smith & Randall (2015) grade record difficulty.' },
  },
  {
    name: 'Paderborn (KAt)', fit: 'diagnosis', faults: 'daño real + acelerado', redist: 'link',
    note: { es: 'Corriente + vibración; daño realista, múltiples puntos de operación.', en: 'Current + vibration; realistic damage, multiple operating points.' },
  },
  {
    name: 'MFPT', fit: 'diagnosis', faults: 'OR/IR · otro banco', redist: 'link', appStatus: 'crosseval',
    note: { es: 'Integrado REAL como el test de generalización cross-dataset (domain-shift): el WDCNN entrenado en CWRU se evalúa sobre MFPT en la página Benchmark. Sin falla de bola.', en: 'Integrated REAL as the cross-dataset (domain-shift) test: the CWRU-trained WDCNN is evaluated on MFPT on the Benchmark page. No ball fault.' },
  },
  {
    name: 'MAFAULDA', fit: 'diagnosis', faults: 'desbalance/desalineamiento/rodamiento', redist: 'link',
    note: { es: 'Banco multi-falla de maquinaria rotativa.', en: 'Multi-fault rotating-machinery rig.' },
  },
  {
    name: 'Ottawa (velocidad variable)', fit: 'diagnosis', faults: 'OR/IR · arranque/parada', redist: 'mirror',
    note: { es: 'Order-tracking bajo velocidad variable; licencia abierta (CC BY 4.0).', en: 'Order-tracking under varying speed; open license (CC BY 4.0).' },
  },
  {
    name: 'IMS / NASA', fit: 'RUL', faults: 'run-to-failure', redist: 'mirror',
    note: { es: 'Run-to-failure clásico para pronóstico; abierto (gobierno EE.UU.).', en: 'Classic run-to-failure for prognostics; open (US-gov).' },
  },
  {
    name: 'XJTU-SY', fit: 'RUL', faults: 'run-to-failure · 3 condiciones', redist: 'mirror',
    note: { es: 'Vida completa de vibración; benchmark de RUL (investigación con cita).', en: 'Full-life vibration; RUL benchmark (research-with-citation).' },
  },
  {
    name: 'FEMTO / PRONOSTIA', fit: 'RUL', faults: 'vida acelerada (PHM 2012)', redist: 'link',
    note: { es: 'El conjunto del desafío de pronóstico PHM 2012.', en: 'The PHM 2012 prognostic challenge set.' },
  },
];

export default function Experiments() {
  const es = useShellLang() === 'es';
  const refsLabel = 'Refs';

  // ---- the leakage-safe split protocol, inline as theme-aware JSX SVG ----
  const ProtocolSVG = (
    <svg
      role="img"
      aria-labelledby="exp-split-title exp-split-desc"
      viewBox="0 0 860 470"
      width="100%"
      style={{ display: 'block', fontFamily: 'var(--font-mono)' }}
    >
      <title id="exp-split-title">
        {es ? 'Protocolo de partición sin fuga para el benchmark' : 'Leakage-safe split protocol for the benchmark'}
      </title>
      <desc id="exp-split-desc">
        {es
          ? 'Los registros completos se agrupan por falla física independiente y se asignan a entrenamiento o prueba a nivel de archivo. Las ventanas nunca cruzan la frontera entrenamiento/prueba, y la prueba es una carga de motor retenida no vista en entrenamiento.'
          : 'Whole recordings are grouped by independent physical fault and assigned to train or test at the file level. Windows never overlap across the train/test boundary, and the test set is a held-out motor load not seen in training.'}
      </desc>

      <defs>
        <marker id="exp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--color-fg-subtle)" />
        </marker>
      </defs>

      {/* ---- column headers ---- */}
      <text x="150" y="26" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--color-fg)">
        {es ? 'Registros (archivos)' : 'Recordings (files)'}
      </text>
      <text x="150" y="44" textAnchor="middle" fontSize="11" fill="var(--color-fg-faint)">
        {es ? 'una señal larga por instancia de falla' : 'one long signal per fault instance'}
      </text>
      <text x="640" y="26" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--color-fg)">
        {es ? 'Asignación a nivel de archivo' : 'File-level assignment'}
      </text>
      <text x="640" y="44" textAnchor="middle" fontSize="11" fill="var(--color-fg-faint)">
        {es ? 'un archivo completo va a UN solo lado' : 'a whole file goes to ONE side only'}
      </text>

      {/* ============ LEFT: four source recordings, colored by fault family ============ */}
      {[
        { y: 70, label: es ? 'Pista externa · 1 hp' : 'Outer-race · 1 hp', stroke: 'var(--color-warn)', side: 'train' },
        { y: 142, label: es ? 'Pista interna · 1 hp' : 'Inner-race · 1 hp', stroke: 'var(--color-magenta)', side: 'train' },
        { y: 214, label: es ? 'Bola · 1 hp' : 'Ball · 1 hp', stroke: 'var(--color-accent)', side: 'train' },
        { y: 286, label: es ? 'Pista externa · 3 hp' : 'Outer-race · 3 hp', stroke: 'var(--color-warn)', side: 'test' },
      ].map((r, i) => (
        <g key={i}>
          <rect x="20" y={r.y} width="260" height="46" rx="6"
            fill="var(--color-surface)" stroke={r.stroke} strokeWidth="2" />
          <text x="32" y={r.y + 18} fontSize="12" fontWeight="600" fill="var(--color-fg)">{r.label}</text>
          {/* windows tiled inside the recording (contiguous strided windows) */}
          {[0, 1, 2, 3, 4, 5].map((w) => (
            <rect key={w} x={36 + w * 38} y={r.y + 26} width="34" height="12" rx="2"
              fill={r.stroke} fillOpacity="0.28" stroke={r.stroke} strokeWidth="0.8" />
          ))}
          {/* the whole file is the atomic unit → one arrow per file */}
          <line x1="280" y1={r.y + 23} x2="470"
            y2={r.side === 'train' ? 150 : 330}
            stroke="var(--color-fg-subtle)" strokeWidth="1.6" markerEnd="url(#exp-arrow)" />
        </g>
      ))}

      <text x="150" y="356" textAnchor="middle" fontSize="10.5" fill="var(--color-fg-faint)">
        {es ? 'las ventanas se solapan DENTRO de un archivo (aumentación),' : 'windows are strided WITHIN a file (augmentation),'}
      </text>
      <text x="150" y="370" textAnchor="middle" fontSize="10.5" fill="var(--color-fg-faint)">
        {es ? 'nunca se parten a través de la frontera entrenamiento/prueba' : 'never split across the train/test boundary'}
      </text>

      {/* ============ RIGHT: train box (top) and held-out test box (bottom) ============ */}
      <rect x="470" y="74" width="340" height="150" rx="8"
        fill="var(--color-surface)" stroke="var(--color-good)" strokeWidth="2" />
      <text x="486" y="96" fontSize="13" fontWeight="700" fill="var(--color-good)">
        {es ? 'ENTRENAMIENTO' : 'TRAIN'}
      </text>
      <text x="486" y="114" fontSize="10.5" fill="var(--color-fg-faint)">
        {es ? 'cargas 0–2 hp · registros externa + interna + bola' : 'loads 0–2 hp · OR + IR + Ball recordings'}
      </text>
      {[
        { x: 486, c: 'var(--color-warn)' }, { x: 596, c: 'var(--color-magenta)' }, { x: 706, c: 'var(--color-accent)' },
      ].map((b, i) => (
        <rect key={i} x={b.x} y="128" width="100" height="76" rx="5"
          fill={b.c} fillOpacity="0.18" stroke={b.c} strokeWidth="1.4" />
      ))}

      <rect x="470" y="300" width="340" height="118" rx="8"
        fill="var(--color-surface)" stroke="var(--color-bad)" strokeWidth="2" strokeDasharray="6 4" />
      <text x="486" y="322" fontSize="13" fontWeight="700" fill="var(--color-bad)">
        {es ? 'PRUEBA · carga retenida' : 'TEST · held-out load'}
      </text>
      <text x="486" y="340" fontSize="10.5" fill="var(--color-fg-faint)">
        {es ? 'carga 3 hp — NUNCA vista en entrenamiento' : 'load 3 hp — NEVER seen in training'}
      </text>
      <rect x="486" y="352" width="100" height="52" rx="5"
        fill="var(--color-warn)" fillOpacity="0.18" stroke="var(--color-warn)" strokeWidth="1.4" />
      <text x="600" y="372" fontSize="10.5" fill="var(--color-fg)">
        {es ? 'generalización entre cargas =' : 'cross-load generalization ='}
      </text>
      <text x="600" y="388" fontSize="10.5" fill="var(--color-fg)">
        {es ? 'la pregunta realista' : 'the realistic question'}
      </text>

      {/* ---- the forbidden path, struck out ---- */}
      <g>
        <line x1="300" y1="430" x2="340" y2="430" stroke="var(--color-bad)" strokeWidth="2" />
        <text x="348" y="434" fontSize="11" fill="var(--color-bad)">
          {es
            ? '✗ partición aleatoria por ventana → mismo registro en ambos lados → fuga (≈100% exactitud falsa)'
            : '✗ random per-window split → same recording on both sides → leakage (≈100% fake accuracy)'}
        </text>
      </g>

      {/* ---- legend ---- */}
      <g fontSize="10.5" fill="var(--color-fg-faint)">
        <rect x="20" y="446" width="12" height="10" rx="2" fill="var(--color-warn)" fillOpacity="0.28" stroke="var(--color-warn)" />
        <text x="38" y="455">{es ? 'externa' : 'outer'}</text>
        <rect x="92" y="446" width="12" height="10" rx="2" fill="var(--color-magenta)" fillOpacity="0.28" stroke="var(--color-magenta)" />
        <text x="110" y="455">{es ? 'interna' : 'inner'}</text>
        <rect x="160" y="446" width="12" height="10" rx="2" fill="var(--color-accent)" fillOpacity="0.28" stroke="var(--color-accent)" />
        <text x="178" y="455">{es ? 'bola' : 'ball'}</text>
        <text x="230" y="455">{es ? 'ventana = segmento solapado de un registro' : 'window = strided segment of one recording'}</text>
      </g>
    </svg>
  );

  const tabs = [
    // ----------------------------------------------------------------- QUESTIONS
    {
      id: 'questions', label: es ? 'Tres preguntas' : 'Three questions',
      content: (
        <div className="prose">
          <p>{es
            ? 'Una suite de diagnóstico vale lo que las preguntas con las que se la puede hacer fallar. Esta página no reporta una única exactitud de portada; separa tres preguntas experimentales que una herramienta de monitoreo de condición confunde a su propio riesgo. (1) Diagnóstico — dado un registro con falla, ¿el método nombra la ubicación de falla correcta (pista externa, pista interna o elemento rodante)? (2) Severidad / detectabilidad — ¿en qué punto la firma de falla supera la línea base de las fallas competidoras y del ruido, es decir, cuán débil (bajo SNR, defecto pequeño, vida temprana) puede ser una falla antes de que el método deje de verla? (3) Pronóstico — una vez iniciada la degradación, ¿cuál es el error entre la vida útil remanente (RUL) predicha y la real?'
            : 'A diagnostic suite is only as trustworthy as the questions it can be made to fail. This page does not report a single headline accuracy; it separates three experimental questions that a condition-monitoring tool conflates at its peril. (1) Diagnosis — given a record that contains a fault, does the method name the correct fault location (outer race, inner race, or rolling element)? (2) Severity / detectability — at what point does the fault signature rise above the competing-fault and noise baseline, i.e. how weak (low SNR, small defect, early life) can a fault be before the method stops seeing it? (3) Prognosis — once degradation has started, how large is the error between predicted and true remaining useful life (RUL)?'}</p>
          <p>{es
            ? 'Son físicas distintas y modos de falla distintos: un método puede ser excelente en diagnóstico de fallas fuertes e inútil en detección temprana, o exacto en una carga retenida y mal calibrado en otra. Reportarlas por separado es el mínimo honesto.'
            : 'These are different physics and different failure modes: a method can be excellent at diagnosis on strong faults and useless at early detection, or accurate on a held-out load and badly miscalibrated on a new one. Reporting them apart is the honest minimum.'}{' '}<Cite id="smith2015" paren /></p>
          <Refs ids={['smith2015', 'lei2018']} label={refsLabel} />
        </div>),
    },
    // ----------------------------------------------------------------- DETECTION METRIC
    {
      id: 'detection', label: es ? 'Métrica de detección' : 'Detection metric',
      content: (
        <div className="prose">
          <p>{es
            ? 'El estadístico de detección que usa este build es la prominencia por armónico del peine cinemático frente a una línea base de mediana local, calculada sobre el espectro de la envolvente. Para una frecuencia de falla candidata f₀ la rutina recorre los primeros H = 5 armónicos. En cada armónico toma la magnitud pico dentro de una ventana de tolerancia estrecha ±τ y la divide por la mediana local de los bines circundantes dentro de una semianchura W (excluyendo la propia ventana del pico). El puntaje es el promedio de esas razones sobre los armónicos que caben bajo el borde de banda.'
            : 'The detection statistic this build uses is the per-harmonic prominence of the kinematic comb against a local-median baseline, computed on the envelope spectrum. For a candidate fault frequency f₀ the routine walks the first H = 5 harmonics. At each harmonic it takes the peak magnitude inside a narrow tolerance window ±τ and divides it by the local median of the surrounding bins inside a half-width W (excluding the peak window itself). The score is the mean of those ratios over the harmonics that fit below the band edge.'}{' '}<Cite id="randall2011" paren /></p>
          <Equation
            tex={String.raw`P(f_0)=\frac{1}{H}\sum_{k=1}^{H}\frac{\displaystyle\max_{|f-k f_0|\le\tau} S(f)}{\operatorname{median}\big\{\,S(f):|f-k f_0|\le W,\ |f-k f_0|>\tau\,\big\}},\quad \tau=\max(2\Delta f,\,0.015 f_0),\ \ W=\max(12\Delta f,\,0.12 f_0)`}
            caption={es ? 'S(f): magnitud del espectro de envolvente · f₀: frecuencia de falla candidata · H = 5: armónicos promediados · Δf: espaciado de bins · τ: semiventana de pico · W: semianchura de la base local · P ≈ 1–3 para ruido, ≫ 1 para un peine real' : 'S(f): envelope-spectrum magnitude · f₀: candidate fault frequency · H = 5: harmonics averaged · Δf: bin spacing · τ: peak tolerance half-window · W: local-baseline half-width · P ≈ 1–3 for noise, ≫ 1 for a true comb'}
          />
          <p>{es
            ? 'Dos decisiones de diseño son deliberadas y determinantes: (i) la línea base es una mediana, no una media, para que una línea fuerte vecina (un armónico de eje, el peine de una falla adyacente) no infle el piso y enmascare un pico real; (ii) las ventanas se definen relativas a f₀, de modo que la prueba escala con la frecuencia y tolera la deriva de deslizamiento de 1–2 % que difumina las líneas de rodamiento. Un espectro de puro ruido eleva los tres peines a una prominencia de aproximadamente 1–3; una falla genuina eleva su propio peine muy por encima. Las fallas competidoras actúan así como controles negativos dentro de cada registro.'
            : 'Two design choices are deliberate and load-bearing: (i) the baseline is a median, not a mean, so a neighbouring strong line (a shaft harmonic, an adjacent fault’s comb) does not inflate the floor and mask a real peak; (ii) the windows are defined relative to f₀, so the test scales with frequency and tolerates the 1–2 % slip drift that smears bearing lines. A pure-noise spectrum lifts all three combs to a prominence of roughly 1–3; a genuine fault lifts its own comb far above that. The competing faults therefore act as negative controls within every single record.'}{' '}<Cite id="borghesani2013ses" paren /></p>
          <Refs ids={['randall2011', 'antoni2006sk', 'borghesani2013ses']} label={refsLabel} />
        </div>),
    },
    // ----------------------------------------------------------------- TWO GATES
    {
      id: 'gates', label: es ? 'Clase + dos compuertas' : 'Class + two gates',
      content: (
        <div className="prose">
          <p>{es
            ? 'La clase predicha es el argmax del puntaje de prominencia sobre tres candidatos: pista externa en BPFO, pista interna en BPFI y elemento rodante en 2·BSF — la frecuencia de giro de bola duplicada, porque un defecto de bola golpea ambas pistas por revolución, de modo que su línea dominante en la envolvente es el segundo armónico de BSF.'
            : 'The predicted class is the argmax of the prominence score over three candidates: outer race at BPFO, inner race at BPFI, and rolling element at 2·BSF — the doubled ball-spin frequency, because a ball defect strikes both races per revolution so its dominant envelope line is the second harmonic of BSF.'}{' '}<Cite id="randall2011" paren /></p>
          <Equation
            tex={String.raw`\hat{c}=\operatorname*{arg\,max}_{c\in\{\text{OR},\text{IR},\text{ball}\}} P(f_c),\quad s_1=\max_c P(f_c),\ \ s_2=\text{2nd-largest},\quad \text{verdict}=\begin{cases}\text{healthy}, & s_1<\theta_{\text{abs}}\ \text{or}\ s_1/s_2<\theta_{\text{rel}}\\[2pt]\hat{c}, & \text{otherwise}\end{cases}`}
            caption={es ? 'f_c ∈ {BPFO, BPFI, 2·BSF} · θ_abs = 4.5 (compuerta absoluta) · θ_rel = 1.7 (compuerta relativa / control negativo)' : 'f_c ∈ {BPFO, BPFI, 2·BSF} · θ_abs = 4.5 (absolute gate) · θ_rel = 1.7 (relative / negative-control gate)'}
          />
          <p>{es
            ? 'Ganar el argmax no basta para declarar falla. El candidato superior debe superar dos compuertas, ambas fijas en este build: una compuerta absoluta θ_abs = 4.5 (la prominencia superior debe excederla siquiera) y una compuerta relativa θ_rel = 1.7 (la superior debe superar a la segunda por esa razón). Si cualquiera de las dos falla — la línea no está suficientemente alta sobre su propio piso, o no está suficientemente separada de la mejor falla competidora — el veredicto es sano, no una elección forzada entre fallas. Esto convierte el diagnóstico de "siempre elegir algo" en una prueba que puede correctamente callar ante un rodamiento sano.'
            : 'Winning the argmax is not sufficient to declare a fault. The top candidate must clear two gates, both fixed in this build: an absolute gate θ_abs = 4.5 (the top prominence must exceed it at all) and a relative gate θ_rel = 1.7 (the top must beat the second-best by this ratio). If either gate fails — the line is not high enough above its own floor, or it is not separated enough from the best competing fault — the verdict is healthy, not a forced choice among faults. This is what turns the diagnosis from "always pick something" into a test that can correctly stay silent on a healthy bearing.'}{' '}<Cite id="smith2015" paren /></p>
          <p>{es
            ? 'La confianza reportada combina el margen absoluto y el margen de separación, ambos acotados a [0, 1]:'
            : 'The reported confidence blends the absolute margin and the separation margin, both clamped to [0, 1]:'} <InlineMath tex={String.raw`\operatorname{conf}=\operatorname{clip}_{[0,1]}\!\big(\tfrac12(1-s_2/s_1)+\tfrac12\,(s_1-\theta_{\text{abs}})/\theta_{\text{abs}}\big)`} />.</p>
          <Refs ids={['randall2011', 'smith2015']} label={refsLabel} />
        </div>),
    },
    // ----------------------------------------------------------------- BAND SELECTION
    {
      id: 'band', label: es ? 'Selección de banda' : 'Band selection',
      content: (
        <div className="prose">
          <p>{es
            ? 'El mayor modo de falla del análisis de envolvente es la selección de banda: un pasa-banda equivocado produce un espectro plano y ambiguo en el que ningún método puede leer el peine. Por eso, antes de la prueba de prominencia, este build selecciona la banda de demodulación con un kurtograma diádico. Para cada nivel ℓ = 1…5 divide el rango [0, f_s/2] en 2^ℓ bandas iguales, aplica un pasa-banda de pared abrupta en el dominio FFT a cada banda, toma su envolvente de Hilbert, y puntúa la banda por la kurtosis en exceso de esa envolvente (cero para gaussiana, grande y positiva para un tren de transitorios impulsivos). La celda de kurtosis máxima es la banda elegida.'
            : 'The single biggest failure mode of envelope analysis is band selection: the wrong band-pass produces a flat, ambiguous spectrum on which no method can read the comb. So before the prominence test, this build selects the demodulation band with a dyadic kurtogram. For each level ℓ = 1…5 it splits the range [0, f_s/2] into 2^ℓ equal bands, brick-wall band-passes each band in the FFT domain, takes its Hilbert envelope, and scores the band by the excess kurtosis of that envelope (zero for Gaussian, large-positive for an impulsive transient train). The maximum-kurtosis cell is the chosen band.'}{' '}<Cite id="antoni2007" paren /></p>
          <Equation
            tex={String.raw`\mathrm{Kurt}\big(e_{\ell,b}\big)=\frac{\mathbb{E}\big[(e-\mu_e)^4\big]}{\big(\mathbb{E}\big[(e-\mu_e)^2\big]\big)^2}-3,\qquad (\ell^\*,b^\*)=\operatorname*{arg\,max}_{\ell,\,b}\ \mathrm{Kurt}\big(e_{\ell,b}\big)\ \ \text{s.t. } f_1^{(\ell,b)}\ge 0.02\,f_s`}
            caption={es ? 'e_{ℓ,b}: envolvente de Hilbert de la señal pasa-banda en la banda b del nivel diádico ℓ ∈ {1,…,5} · μ_e: media de esa envolvente · f_s: frecuencia de muestreo · f₁: borde inferior de la banda · −3: referencia gaussiana (kurtosis en exceso = 0 para ruido)' : 'e_{ℓ,b}: Hilbert envelope of the band-passed signal in band b at dyadic level ℓ ∈ {1,…,5} · μ_e: mean of that envelope · f_s: sampling rate · f₁: lower band edge · −3: Gaussian reference (excess kurtosis = 0 for noise)'}
          />
          <p>{es
            ? 'Un detalle importa experimentalmente: la búsqueda omite toda banda cuyo borde inferior caiga bajo 0.02·f_s (el ~2 % más bajo), porque esa banda está dominada por contenido determinista del eje y la DC, que parece impulsivo pero no es la falla. La banda elegida alimenta el espectro de envolvente que prueba la métrica de detección. Por eso la suite puede pasar el mismo registro por "envolvente con banda elegida a mano" versus "envolvente con banda del kurtograma" y mostrar cómo el paso de selección de banda cambia el diagnóstico.'
            : 'One detail matters experimentally: the search skips any band whose lower edge falls below 0.02·f_s (the lowest ~2 %), because that band is dominated by deterministic shaft content and DC, which is impulsive-looking but not the fault. The chosen band feeds the envelope spectrum that the detection metric then tests. This is why the suite can run the same record through "envelope after a hand-picked band" versus "envelope after kurtogram band" and show the band-selection step changing the diagnosis.'}{' '}<Cite id="antoni2006sk" paren /></p>
          <Refs ids={['antoni2007', 'antoni2006sk', 'moshrefzadeh2018autogram']} label={refsLabel} />
        </div>),
    },
    // ----------------------------------------------------------------- LEAKAGE PROTOCOL
    {
      id: 'protocol', label: es ? 'Protocolo sin fuga' : 'Leakage-safe protocol',
      content: (
        <div className="prose">
          <p>{es
            ? 'El conjunto de rodamientos de Case Western Reserve University (CWRU) es el benchmark de facto del campo, y también su trampa de fuga más documentada: como cada clase de falla es un registro largo cortado en muchas ventanas, una partición aleatoria ingenua pone ventanas del mismo registro en entrenamiento y prueba. El clasificador aprende la huella del registro, no la física de la falla, y reporta exactitud cercana al 100 % que se desploma ante cualquier rodamiento genuinamente nuevo. Nuestro protocolo lo prohíbe por construcción.'
            : 'The Case Western Reserve University (CWRU) bearing set is the field’s de-facto benchmark, and it is also the field’s most documented leakage trap: because each fault class is one long recording cut into many windows, a naïve random split puts windows from the same recording in both train and test. The classifier then learns the recording’s fingerprint, not the fault physics, and reports near-100 % accuracy that collapses on any genuinely new bearing. Our protocol forbids this by construction.'}{' '}<Cite id="smith2015" paren /></p>
          <ol>
            <li>{es
              ? 'Partición a nivel de registro/archivo — la unidad asignada a entrenamiento o prueba es el registro completo, nunca una ventana; todas las ventanas de un registro permanecen juntas.'
              : 'Recording/file-level split — the unit that is assigned to train or test is the whole recording, never a window; all windows of a recording stay together.'}</li>
            <li>{es
              ? 'Agrupar por falla independiente — las ventanas se agrupan para que la misma instancia física de defecto nunca aparezca en ambos lados.'
              : 'Group by independent fault — windows are grouped so that the same physical defect instance never appears on both sides.'}</li>
            <li>{es
              ? 'Sin solape de ventanas entre entrenamiento/prueba — el solape (ventanas con paso) se permite dentro de una partición para aumentación, pero nunca cruza la frontera, de modo que ninguna ventana de prueba comparte muestras con una de entrenamiento.'
              : 'No window overlap across train/test — overlapping (strided) windows are allowed within a split for augmentation but never straddle the boundary, so no test window shares samples with a train window.'}</li>
            <li>{es
              ? 'Prueba cruzada de carga — entrenar en un subconjunto de cargas del motor (0–3 hp ↔ ~1797–1720 rpm) y probar en una carga retenida, que es la exigencia realista: generalizar a un punto de operación no entrenado.'
              : 'Cross-load test — train on a subset of motor loads (0–3 hp ↔ ~1797–1720 rpm) and test on a held-out load, which is the realistic ask: generalize to an operating point you did not train on.'}</li>
          </ol>
          {ProtocolSVG}
          <p>{es
            ? 'Esto se fundamenta directamente en la graduación de dificultad de registros de Smith & Randall, que mostró que varios registros de pista interna y de bola son genuinamente difíciles incluso con un pipeline de envolvente óptimo — así que un método que puntúe ~100 % en esos registros casi seguro está fugando, no ganando.'
            : 'This is grounded directly in Smith & Randall’s benchmark grading of records, which showed that several inner-race and ball records are genuinely difficult even with an optimal envelope pipeline — so a method scoring ~100 % on those records is almost certainly leaking, not winning.'}{' '}<Cite id="smith2015" paren /></p>
          <Refs ids={['smith2015']} label={refsLabel} />
        </div>),
    },
    // ----------------------------------------------------------------- COVERAGE + DATASETS
    {
      id: 'coverage', label: es ? 'Cobertura + datasets' : 'Coverage + datasets',
      content: (
        <div className="prose">
          <p>{es
            ? 'El espacio experimental es una grilla de seis ejes: componente (rodamiento hoy; engranaje/eje al extenderse la suite) × modo de falla (externa / interna / bola, y compuesta) × severidad (tamaño de defecto o vida transcurrida) × velocidad (constante vs variable, arranque/parada) × SNR/carga × run-to-failure (presente o ausente). Ningún dataset público cubre la grilla completa, así que la llenamos con conjuntos reales donde existen y con datos sintéticos que emulan el formato de archivo real donde no — y etiquetamos toda celda sintética como tal.'
            : 'The experimental space is a six-axis grid: component (bearing today; gear/shaft as the suite extends) × fault mode (outer / inner / ball, and compound) × severity (defect size or elapsed life) × speed (constant vs variable, run-up/coast-down) × SNR/load × run-to-failure (present or absent). No single public dataset spans the whole grid, so we fill it from real sets where they exist and synthetic data emulating the real file layout where they don’t — and we label every synthetic cell as such.'}</p>

          <table className="cmp-table">
            <thead>
              <tr>
                <th>{es ? 'Dataset' : 'Dataset'}</th>
                <th>{es ? 'Estado en la app' : 'Status in app'}</th>
                <th>{es ? 'Uso' : 'Fit'}</th>
                <th>{es ? 'Fallas' : 'Faults'}</th>
                <th>{es ? 'Redistribución' : 'Redistribution'}</th>
                <th>{es ? 'Nota' : 'Note'}</th>
              </tr>
            </thead>
            <tbody>
              {DATASETS.map((d) => {
                const st = d.appStatus ?? 'planned';
                const chip = st === 'live'
                  ? { bg: 'color-mix(in oklab,#3fb950 22%,transparent)', fg: '#3fb950', bd: 'transparent', lbl: es ? 'EN VIVO + benchmark' : 'LIVE + benchmarked' }
                  : st === 'crosseval'
                    ? { bg: 'color-mix(in oklab,#6e5cff 20%,transparent)', fg: '#6e5cff', bd: 'transparent', lbl: es ? 'cross-dataset (real)' : 'cross-dataset (real)' }
                    : { bg: 'transparent', fg: 'var(--color-fg-faint)', bd: 'var(--color-border)', lbl: es ? 'roadmap' : 'planned' };
                return (
                <tr key={d.name}>
                  <td style={{ textAlign: 'left' }}>{d.name}</td>
                  <td><span className="chip" style={{ background: chip.bg, color: chip.fg, borderColor: chip.bd }}>{chip.lbl}</span></td>
                  <td>{d.fit}</td>
                  <td style={{ textAlign: 'left' }}>{d.faults}</td>
                  <td>{d.redist === 'mirror' ? (es ? 'espejo + atribución' : 'mirror + attribution') : (es ? 'solo-enlace' : 'link-only')}</td>
                  <td style={{ textAlign: 'left' }} className="muted">{es ? d.note.es : d.note.en}</td>
                </tr>
              ); })}
            </tbody>
          </table>
          <p className="muted small">{es
            ? 'Estado honesto: hoy hay DOS conjuntos reales integrados. CWRU es el benchmark entrenado — entrena el WDCNN + el deep-AE + los clásicos y corre en vivo en la página Benchmark (diagnóstico interactivo sobre segmentos reales + los números held-out). MFPT está integrado como el test de generalización cross-dataset (domain-shift): el WDCNN entrenado en CWRU se evalúa sobre MFPT real, sin haber visto un solo registro suyo. Los demás seis conjuntos son el roadmap (descarga + tooling aún no implementados); no se afirma cobertura de engranaje/velocidad-variable hasta integrarlos.'
            : 'Honest status: today there are TWO real integrated sets. CWRU is the trained benchmark — it trains the WDCNN + deep-AE + the classical models and runs live on the Benchmark page (interactive diagnosis on real segments + the held-out numbers). MFPT is integrated as the cross-dataset (domain-shift) generalization test: the CWRU-trained WDCNN is evaluated on real MFPT data it never saw. The other six sets are the roadmap (download + tooling not yet implemented); no gear/variable-speed coverage is claimed until they are integrated.'}</p>

          <p>{es
            ? 'El generador sintético está fundamentado físicamente, no es cosmético: deposita un tren de impulsos cuasi-periódico en la frecuencia de falla cinemática, cada impulso excitando una resonancia estructural amortiguada (resonancia fₙ y amortiguamiento ζ especificados), añade jitter de deslizamiento por intervalo (~0.5 % de un período) para que el peine quede levemente difuminado en vez de perfectamente periódico, aplica la modulación de amplitud físicamente correcta (las fallas de pista interna modulan a la frecuencia de eje f_r; las de bola a la frecuencia de jaula FTF; las de pista externa, ninguna), superpone armónicos de eje y añade ruido gaussiano para alcanzar un SNR objetivo. Las relaciones de frecuencia de falla que planta son exactas y transferibles a rodamientos reales — eso legitima las celdas sintéticas como conjunto de auto-validación.'
            : 'The synthetic generator is physically grounded, not cosmetic: it lays down a quasi-periodic impulse train at the kinematic fault frequency, each impulse exciting a damped structural resonance (specified resonance fₙ and damping ζ), adds per-interval slip jitter (~0.5 % of a period) so the comb is mildly smeared rather than perfectly periodic, applies the physically-correct amplitude modulation (inner-race faults modulate at shaft rate f_r; ball faults at cage rate FTF; outer-race none), superposes shaft harmonics, and adds Gaussian noise to hit a target SNR. The fault frequency relations it plants are exact and transferable to real bearings — that is what makes the synthetic cells legitimate as a self-validation set.'}{' '}<Cite id="randall2011" paren /></p>

          <Equation
            tex={String.raw`\mathrm{BPFO}=\tfrac{n}{2}f_r\!\left(1-\tfrac{d}{D}\cos\varphi\right),\quad \mathrm{BPFI}=\tfrac{n}{2}f_r\!\left(1+\tfrac{d}{D}\cos\varphi\right),\quad \mathrm{BSF}=\tfrac{D}{2d}f_r\!\left(1-\left(\tfrac{d}{D}\cos\varphi\right)^{2}\right),\quad \mathrm{FTF}=\tfrac{1}{2}f_r\!\left(1-\tfrac{d}{D}\cos\varphi\right)`}
            caption={es ? 'f_r: frecuencia rotacional del eje (Hz) = rpm/60 · n: número de elementos rodantes · d: diámetro de bola · D: diámetro de paso · φ: ángulo de contacto · la línea diagnóstica de bola probada es 2·BSF' : 'f_r: shaft rotational frequency (Hz) = rpm/60 · n: number of rolling elements · d: ball diameter · D: pitch diameter · φ: contact angle · the ball-fault diagnostic line tested is 2·BSF'}
          />

          <p>{es
            ? 'Lo que es solo ilustrativo es el mapeo severidad → inicio → RUL: la tendencia del indicador de salud run-to-failure es una curva sintética con forma realista donde mayor severidad provoca un inicio de degradación más temprano y un crecimiento exponencial más rápido. La forma es realista; las horas específicas no son una medición.'
            : 'What is illustrative only is the severity → onset → RUL mapping: the run-to-failure health-indicator trend is a synthetic, realistically-shaped curve where higher severity drives an earlier degradation onset and faster exponential growth. The shape is realistic; the specific hours are not a measurement.'}{' '}<Cite id="wang2020xjtu" paren /></p>
          <Refs ids={['randall2011', 'wang2020xjtu']} label={refsLabel} />
        </div>),
    },
    // ----------------------------------------------------------------- RESULTS PRESENTATION
    {
      id: 'results', label: es ? 'Resultados método-vs-método' : 'Method-vs-method results',
      content: (
        <div className="prose">
          <p>{es
            ? 'Los resultados comparativos se renderizan desde un artefacto de métricas versionado — un pequeño archivo de resultados incorporado al proyecto, nunca los datos crudos de vibración. Dos vistas gobiernan la página.'
            : 'Comparative results render from a committed metrics artifact — a small results file checked into the project, never the raw vibration data. Two views drive the page.'}</p>
          <p>{es
            ? '(1) Una matriz de confusión normalizada por fila por método: cada fila es una clase verdadera (sano / externa / interna / bola), cada celda la fracción de los registros de prueba de esa clase asignados a una clase predicha, de modo que la diagonal se lee como recall por clase y los elementos fuera de la diagonal muestran qué falla confunde un método con cuál (la confusión interna↔bola es la clásica, y la matriz la hace visible). Se elige normalización por fila sobre conteos crudos para que un conjunto de prueba desbalanceado no oculte una clase débil.'
            : '(1) A row-normalized confusion matrix per method: each row is a true class (healthy / outer / inner / ball), each cell the fraction of that class’s test recordings assigned to a predicted class, so the diagonal reads as per-class recall and off-diagonals show which fault a method confuses for which (inner↔ball confusion is the classic one, and the matrix makes it visible). Row normalization is chosen over raw counts so an imbalanced test set does not hide a weak class.'}</p>
          <p>{es
            ? '(2) Una tabla de exactitud ordenable — una fila por (método × dataset × partición) con exactitud de diagnóstico, umbral de detección temprana y error de RUL, ordenable para que el lector ranquee por la métrica que le importa. Cada fila cita tanto el dataset de origen como el paper de dificultad, de modo que un número nunca se desacopla de su procedencia.'
            : '(2) A sortable accuracy table — one row per (method × dataset × split) with diagnosis accuracy, early-detection threshold, and RUL error, sortable so a reader can rank by the metric they care about. Every row cites both the originating dataset and the difficulty paper, so a number is never decoupled from its provenance.'}{' '}<Cite id="smith2015" paren /></p>
          <p>{es
            ? 'Crucialmente, la página no re-hospeda ningún dataset restringido: los conjuntos sin concesión explícita de redistribución son solo-enlace (la tabla enlaza a la fuente y reporta nuestras métricas calculadas contra ella). Solo los conjuntos abiertamente redistribuibles pueden espejarse con atribución. La columna de redistribución en la tabla de datasets lo declara honestamente por cada conjunto.'
            : 'Crucially, the page does not re-host any restricted dataset: sets carrying no explicit redistribution grant are link-only (the table links to the source and reports our metrics computed against it). Only the openly redistributable sets may be mirrored with attribution. The redistribution column in the datasets table states this honestly per set.'}</p>
          <Refs ids={['smith2015']} label={refsLabel} />
        </div>),
    },
    // ----------------------------------------------------------------- PROGNOSIS
    {
      id: 'prognosis', label: es ? 'Pronóstico / RUL' : 'Prognosis / RUL',
      content: (
        <div className="prose">
          <p>{es
            ? 'El experimento de pronóstico se corre solo sobre trayectorias run-to-failure (más curvas sintéticas con forma realista para cobertura). El procedimiento: formar un indicador de salud escalar (HI, p. ej. RMS) por snapshot; detectar el inicio de degradación como el primer instante en que el HI sostiene una excursión sobre la base + 4σ durante dos puntos consecutivos (la media/σ base tomadas de la porción sana temprana); ajustar un modelo log-lineal (exponencial) solo sobre los puntos post-inicio; proyectar hacia adelante hasta el momento en que el HI cruza el umbral de falla; reportar RUL = tiempo-de-falla-proyectado − tiempo-de-última-observación, con un abanico de incertidumbre hacia adelante a ±2 desviaciones estándar del residuo en escala logarítmica.'
            : 'The prognosis experiment is run only on run-to-failure trajectories (plus synthetic realistically-shaped curves for coverage). The procedure: form a scalar health indicator (HI, e.g. RMS) per snapshot; detect degradation onset as the first time the HI sustains an excursion above baseline + 4σ for two consecutive points (the baseline mean/σ taken from the early healthy portion); fit a log-linear (exponential) model on the post-onset points only; project forward to the moment the HI crosses the failure threshold; report RUL = projected-fail-time − last-observed-time, with a forward uncertainty fan at ±2 residual standard deviations on the log scale.'}{' '}<Cite id="lei2018" paren /> <Cite id="wang2020xjtu" paren /></p>
          <Equation
            tex={String.raw`\ln \mathrm{HI}(t)=\ln a + b\,t \ \ (t\ge t_{\text{onset}}),\qquad t_{\text{fail}}=\frac{\ln\theta_{\mathrm{HI}}-\ln a}{b},\qquad \widehat{\mathrm{RUL}}=\max(0,\ t_{\text{fail}}-t_{\text{last}})`}
            caption={es ? 'HI(t): indicador de salud (p. ej. RMS) en tiempo de operación t · t_onset: primer instante en que HI supera la base + 4σ durante dos puntos · a > 0, b > 0: intercepto/tasa de crecimiento ajustados (se emite proyección solo si b > 0) · θ_HI: umbral de falla (definido por dataset o zona de alarma ISO 20816) · t_last: última observación' : 'HI(t): health indicator (e.g. RMS) at operating time t · t_onset: first time HI stays above baseline + 4σ for two points · a > 0, b > 0: fitted intercept/growth rate (a projection is emitted only if b > 0) · θ_HI: failure threshold (dataset-defined or ISO 20816 alarm zone) · t_last: last observed time'}
          />
          <p>{es
            ? 'Una trayectoria sana no muestra inicio sostenido, así que el modelo correctamente devuelve ninguna proyección en vez de un número fabricado. La métrica de error es la brecha entre esta RUL proyectada y el tiempo de falla real de la trayectoria. La forma exponencial-luego-primer-cruce es la familia estándar de pronóstico por cruce de umbral; las zonas de severidad ISO 20816 aportan un umbral de alarma físicamente significativo cuando el dataset no lo define.'
            : 'A healthy trajectory shows no sustained onset, so the model correctly returns no projection rather than a fabricated number. The error metric is the gap between this projected RUL and the trajectory’s true failure time. The exponential-then-first-passage form is the standard threshold-crossing prognostic family; ISO 20816 severity zones supply a physically meaningful alarm threshold when one is not dataset-defined.'}{' '}<Cite id="iso20816" paren /></p>
          <Refs ids={['lei2018', 'iso20816', 'wang2020xjtu']} label={refsLabel} />
        </div>),
    },
  ];

  return (
    <div className="page-body">
      <div className="page-head prose">
        <h1>{es ? 'Experimentos' : 'Experiments'}</h1>
        <p className="lede">{es
          ? 'Tres preguntas separadas (diagnóstico, detectabilidad, pronóstico), definiciones exactas, un protocolo de partición sin fuga y comparación método-vs-método con métricas honestas.'
          : 'Three separate questions (diagnosis, detectability, prognosis), exact definitions, a leakage-safe split protocol, and method-vs-method comparison with honest metrics.'} <InlineMath tex={String.raw`f_r=\mathrm{rpm}/60`} /></p>
      </div>
      <Tabs tabs={tabs} ariaLabel={es ? 'experimentos' : 'experiments'} />
    </div>
  );
}
