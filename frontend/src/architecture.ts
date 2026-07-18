// In-app Architecture / "How it works" modal config (ADR-0058) for RotorVitals.
// Passed to <AppShell config={{ ...config, architecture }}>. The ⓘ header button
// (provided by @fasl-work/caos-app-shell >= 0.1.2) opens the modal. Each tab pairs
// one hand-authored THEMED SVG (frontend/public/svg/tech/, shell CSS-var tokens →
// repaints with the active theme, fetched + inlined) with a bilingual ES/EN body.
import type { ArchitectureConfig } from '@fasl-work/caos-app-shell';

export const architecture: ArchitectureConfig = {
  tabs: [
    {
      id: 'app',
      en: 'The app',
      es: 'La app',
      svg: 'svg/tech/01-the-app.svg',
      body_en:
        'RotorVitals is a rotating-machinery health product: from a vibration signal it diagnoses the bearing fault ' +
        '(healthy / outer race / inner race / ball), its severity, and projects the remaining useful life, answering ' +
        '"what fault is this, and how long until it fails?". You pick a bearing, a planted fault and a severity (on REAL ' +
        'CWRU data) and the kurtogram, envelope spectrum, cyclostationary map and RUL recompute live.\n\n' +
        'It is a real system, not a demo. The in-browser diagnostics engine recomputes on every ' +
        'control; it keys on the physical defect frequencies (BPFO/BPFI/2·BSF) and confirms a real fault by its ' +
        'cyclostationary α-ridge family. A WDCNN classifies the raw signal and a deep autoencoder gives a health index, ' +
        'both ONNX, client-side, trained on real held-out CWRU recordings.',
      body_es:
        'RotorVitals es un producto de salud de maquinaria rotativa: desde una señal de vibración diagnostica el fallo ' +
        'del rodamiento (sano / pista externa / pista interna / bola), su severidad, y proyecta la vida útil restante, ' +
        'respondiendo "¿qué fallo es este, y cuánto falta para que falle?". Eliges un rodamiento, un fallo plantado y una ' +
        'severidad (sobre datos REALES CWRU) y el kurtograma, el espectro de envolvente, el mapa cicloestacionario y la ' +
        'RUL recalculan en vivo.\n\n' +
        'Es un sistema real, no un demo. El motor de diagnóstico recalcula en el navegador con cada ' +
        'control; se ancla en las frecuencias físicas de defecto (BPFO/BPFI/2·BSF) y confirma un fallo real por su ' +
        'familia de α-ridges cicloestacionaria. Un WDCNN clasifica la señal cruda y un autoencoder profundo da un índice ' +
        'de salud, ambos ONNX, en el cliente, entrenados sobre grabaciones CWRU reales held-out.',
    },
    {
      id: 'lanes',
      en: 'Lanes, web / offline / compute',
      es: 'Carriles, web / offline / cómputo',
      svg: 'svg/tech/02-lanes.svg',
      body_en:
        'Three lanes, and the split is the point. WEB (live, in the browser): the TypeScript diagnostics engine ' +
        're-runs on every control and onnxruntime-web runs the WDCNN + the autoencoder as ONNX models, no server. ' +
        'OFFLINE / COMPUTE (your machine, an isolated Python environment): the Python pipeline bakes the canonical case artifacts (the ' +
        'real CWRU segments + the diagnoses + RUL) and the heavy lane (the precompute/retrain step, torch) trains the ' +
        'WDCNN + the deep autoencoder on held-out CWRU files and exports them to ONNX. REPLAY: the small, committed ' +
        'artifacts are overlaid into the SPA at build and loaded live; a typed contract mirror ' +
        'fails the build if the web and the pipeline shapes ever diverge.',
      body_es:
        'Tres carriles, y la división es lo central. WEB (en vivo, en el navegador): el motor de diagnóstico en ' +
        'TypeScript re-corre con cada control y onnxruntime-web ejecuta el WDCNN + el autoencoder como modelos ONNX, sin ' +
        'servidor. offline / CÓMPUTO (tu máquina, un entorno Python aislado): el pipeline Python hornea los artefactos canónicos por ' +
        'caso (los segmentos CWRU reales + los diagnósticos + RUL) y el carril pesado (el paso de precómputo/reentrenamiento, ' +
        'torch) entrena el WDCNN + el autoencoder profundo sobre archivos CWRU held-out y los exporta a ONNX. REPLAY: ' +
        'los artefactos pequeños y versionados se superponen al SPA en el build y se cargan en ' +
        'vivo; un contrato tipado espejo rompe el build si la web y el pipeline divergen.',
    },
    {
      id: 'web-flow',
      en: 'Web-app flow',
      es: 'Flujo de la web',
      svg: 'svg/tech/03-web-flow.svg',
      body_en:
        'The App page recomputes live: inputs (the case selector or your own recording, plus the bearing, fault, ' +
        'severity, rpm and SNR controls) feed the TypeScript diagnostics engine and the onnxruntime-web inference, which ' +
        'feed the interactive viz, the signal/spectrum, envelope SES, kurtogram, cyclostationary map, spectrogram, ' +
        'Campbell, the 3-D waterfall and the RUL trend, each reading values back on hover. The six sibling pages (App · ' +
        'Introduction · Methodology · Implementation · Experiments · Benchmark) are identical across every CAOS ' +
        'product. The build is gated by the contract-type mirror, the artifacts are overlaid by a build step, vite builds ' +
        'the static output, and GitHub Pages serves it at rotorvitals.fasl-work.com.',
      body_es:
        'La página App recalcula en vivo: las entradas (el selector de casos o tu propia grabación, más los controles de ' +
        'rodamiento, fallo, severidad, rpm y SNR) alimentan el motor de diagnóstico en TypeScript y la inferencia ' +
        'onnxruntime-web, que alimentan la visualización interactiva, la señal/espectro, el SES de envolvente, el ' +
        'kurtograma, el mapa cicloestacionario, el espectrograma, Campbell, la cascada 3-D y la tendencia de RUL, cada ' +
        'uno devolviendo valores al pasar el cursor. Las seis páginas hermanas (App · Introducción · Metodología · ' +
        'Implementación · Experimentos · Benchmark) son idénticas en todos los productos CAOS. El build lo controla el ' +
        'espejo de tipos del contrato, los artefactos los superpone un paso del build, vite construye el estático y GitHub Pages ' +
        'lo sirve en rotorvitals.fasl-work.com.',
    },
    {
      id: 'science',
      en: 'The science',
      es: 'La ciencia',
      svg: 'svg/tech/04-the-science.svg',
      body_en:
        'The pipeline, step by step: ① the kurtogram (spectral kurtosis over band/centre) finds the most impulsive ' +
        'demodulation band; ② a band-pass + Hilbert transform give the squared envelope spectrum (SES); ③ the SES peaks ' +
        'are matched to the physical defect frequencies BPFO/BPFI/2·BSF (BPFO = (n/2)·fr·(1−d/D·cosφ)), and a ' +
        'cyclostationary CMS confirms a real fault by its vertical α-ridge family (independent of carrier); ④ a health ' +
        'index trend is projected to an ISO threshold to give the remaining useful life. Outputs: the fault class, ' +
        'severity and RUL.\n\n' +
        'The signal-processing engine is always on and transparent, the reference the WDCNN is measured against. The ' +
        'learned lane: a WDCNN (raw vibration → fault-class softmax, a wide first-layer deep CNN) and a deep autoencoder ' +
        '(features → health index); both run client-side as ONNX, trained + evaluated on REAL CWRU held-out files, ' +
        'reported next to the signal-processing diagnosis, never as a black box.',
      body_es:
        'El pipeline, paso a paso: ① el kurtograma (kurtosis espectral por banda/centro) encuentra la banda de ' +
        'demodulación más impulsiva; ② un band-pass + transformada de Hilbert dan el espectro de envolvente al cuadrado ' +
        '(SES); ③ los picos del SES se matchean a las frecuencias físicas de defecto BPFO/BPFI/2·BSF (BPFO = ' +
        '(n/2)·fr·(1−d/D·cosφ)), y un CMS cicloestacionario confirma un fallo real por su familia vertical de α-ridges ' +
        '(independiente del carrier); ④ una tendencia de índice de salud se proyecta a un umbral ISO para dar la vida ' +
        'útil restante. Salidas: la clase de fallo, severidad y RUL.\n\n' +
        'El motor de procesamiento de señales está siempre activo y es transparente, la referencia contra la que se ' +
        'mide el WDCNN. El carril aprendido: un WDCNN (vibración cruda → softmax de clase de fallo, un CNN profundo de ' +
        'primera capa ancha) y un autoencoder profundo (features → índice de salud); ambos corren en el cliente como ' +
        'ONNX, entrenados + evaluados sobre archivos CWRU reales held-out, reportados junto al diagnóstico de ' +
        'procesamiento de señales, nunca como caja negra.',
    },
    {
      id: 'design',
      en: 'Data contracts / design',
      es: 'Contratos de datos / diseño',
      svg: 'svg/tech/05-data-contracts.svg',
      body_en:
        'Two validated data contracts bracket the pipeline. Contract 1 (ingestion) defines a valid vibration recording ' +
        ',  the sample rate, shaft speed, bearing geometry and the signal itself, with range/NaN guards, so the app ' +
        'accepts your data, not just the built-in CWRU cases. Contract 2 (artifact) defines the output the web reads ' +
        '(per-case diagnoses + SES + RUL + the source CWRU file provenance, the learned metrics, the model index), ' +
        'mirrored exactly by a typed contract. Between them the staged, deterministic pipeline runs the lane gate ' +
        '(numpy-light by default, the heavy torch retrain step on demand) and writes a provenance manifest, so every result ' +
        'is reproducible and the web can never silently drift.',
      body_es:
        'Dos contratos de datos validados encierran el pipeline. El Contrato 1 (ingesta) define una grabación de ' +
        'vibración válida, la tasa de muestreo, velocidad del eje, geometría del rodamiento y la señal misma, con ' +
        'guardas de rango/NaN, para que la app acepte tus datos, no sólo los casos CWRU incluidos. El Contrato 2 ' +
        '(artefacto) define la salida que lee la web (diagnósticos + SES + RUL por caso + la procedencia del archivo ' +
        'CWRU fuente, las métricas aprendidas, el índice de modelos), espejada exactamente por un contrato tipado. Entre ' +
        'ambos, el pipeline por etapas y determinista corre el lane gate (numpy-light por defecto, el paso de reentrenamiento ' +
        'pesado de torch a demanda) y escribe un manifest de procedencia, de modo que cada resultado es reproducible y la ' +
        'web nunca diverge en silencio.',
    },
  ],
};
