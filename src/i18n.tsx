import { createContext, useContext, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'es';

type Dict = Record<string, string>;

const en: Dict = {
  'app.title': 'RotorVitals',
  'app.subtitle': 'Bearing fault diagnosis by envelope analysis',
  'nav.intro': 'Introduction',
  'nav.problem': 'The problem',
  'nav.method': 'Methodology',
  'nav.impl': 'Implementation',
  'nav.exp': 'Experiments',
  'nav.app': 'Live app',
  'hub.back': '← Faena hub',
  'repo': 'GitHub repo',

  'intro.h': 'What this is',
  'intro.p':
    'RotorVitals is an open, explainable tool for diagnosing rolling-element bearing faults from a vibration signal. It runs entirely in your browser — no upload, no account — and shows its working: it computes the bearing’s kinematic defect frequencies, demodulates the high-frequency resonance the defect excites, and reads the envelope spectrum for energy at those exact lines. It is a teaching and screening instrument, not a certification of machine health.',
  'intro.scope':
    'Bearings are the most common failure point of crushers, conveyors, pumps and fans. The method here is the field standard (envelope / demodulation analysis) and is calibrated to read the public CWRU bearing benchmark.',

  'problem.h': 'Why a raw spectrum is not enough',
  'problem.p':
    'A localized bearing defect produces a tiny, repetitive impact each time a rolling element passes it. Each impact is a broadband shock that rings the structure at its resonance (often several kHz). The defect repetition rate (tens to hundreds of Hz) is buried under shaft harmonics and noise and is weak in the raw spectrum — but it amplitude-modulates the resonance. Demodulation (the envelope) recovers that repetition rate cleanly. The diagnosis is then simply: does the envelope spectrum show peaks at BPFO, BPFI or 2·BSF?',

  'method.h': 'Theory & method',
  'method.kin': 'Kinematic defect frequencies',
  'method.kin.p':
    'For a bearing with n rolling elements of diameter d on pitch diameter D, contact angle φ, at shaft frequency f_r:',
  'method.env': 'Envelope (demodulation) analysis',
  'method.env.p':
    'Band-pass the signal around the excited resonance, form the analytic signal via the Hilbert transform, take its magnitude (the envelope), and compute the envelope spectrum. A fault shows as a line at its kinematic frequency and harmonics.',
  'method.dx': 'Decision',
  'method.dx.p':
    'We score each fault by the summed peak energy at the first five harmonics of its frequency, normalized by the spectrum noise floor. The largest score wins if it clears a floor gate; otherwise the bearing reads healthy. Every number traces to a computed line — nothing is a black box.',

  'impl.h': 'Implementation',
  'impl.p':
    'Heavy work is trivial here, so everything runs client-side: a deterministic, seeded generator builds a physically-grounded vibration signal (impulse train at the fault frequency, each impulse ringing a damped resonance, with slip jitter, amplitude modulation, shaft harmonics and noise at a target SNR); the same pipeline a real signal would take then analyzes it. Static site, no backend.',
  'impl.pipe': 'signal → band-pass → Hilbert envelope → envelope spectrum → harmonic scoring → diagnosis',

  'exp.h': 'Experiments',
  'exp.p':
    'The four built-in scenarios are generated with known faults and fixed seeds, so they double as a self-validation set: the engine should recover the fault frequency that produced each one. Switch scenarios in the live app and confirm the diagnosis matches the planted fault, and that the envelope peaks land on the marked BPFO/BPFI/2·BSF lines.',
  'exp.note':
    'Honest limits: a single localized defect on a steady-speed rig is the easy case. Real machines bring variable speed, multiple simultaneous faults, smearing and electrical interference — and absolute severity here is synthetic. The frequency relationships, however, are exact and transfer directly to real CWRU recordings.',

  'live.h': 'Live: generate & diagnose',
  'live.scenario': 'Scenario',
  'live.bearing': 'Bearing',
  'live.fault': 'Planted fault',
  'live.severity': 'Severity',
  'live.rpm': 'Shaft speed (rpm)',
  'live.snr': 'SNR (dB)',
  'live.band': 'Envelope band (Hz)',
  'live.signal': 'Vibration signal (time)',
  'live.spectrum': 'Raw spectrum',
  'live.envspectrum': 'Envelope spectrum',
  'live.freqs': 'Computed defect frequencies',
  'live.diag': 'Diagnosis',
  'live.confidence': 'confidence',
  'live.amp': 'amplitude',
  'live.time': 'time (s)',
  'live.freq': 'frequency (Hz)',
  'fault.healthy': 'Healthy',
  'fault.outer': 'Outer race (BPFO)',
  'fault.inner': 'Inner race (BPFI)',
  'fault.ball': 'Ball (2·BSF)',
};

const es: Dict = {
  'app.title': 'RotorVitals',
  'app.subtitle': 'Diagnóstico de fallas de rodamiento por análisis de envolvente',
  'nav.intro': 'Introducción',
  'nav.problem': 'El problema',
  'nav.method': 'Metodología',
  'nav.impl': 'Implementación',
  'nav.exp': 'Experimentos',
  'nav.app': 'App en vivo',
  'hub.back': '← Hub Faena',
  'repo': 'Repo GitHub',

  'intro.h': 'Qué es',
  'intro.p':
    'RotorVitals es una herramienta abierta y explicable para diagnosticar fallas de rodamientos a partir de una señal de vibración. Corre íntegramente en tu navegador —sin subir nada, sin cuenta— y muestra su razonamiento: calcula las frecuencias cinemáticas de defecto del rodamiento, demodula la resonancia de alta frecuencia que excita el defecto, y lee el espectro de envolvente buscando energía en esas líneas exactas. Es un instrumento didáctico y de tamizaje, no una certificación de salud de la máquina.',
  'intro.scope':
    'Los rodamientos son el punto de falla más común de chancadores, correas, bombas y ventiladores. El método aquí es el estándar de campo (análisis de envolvente / demodulación) y está calibrado para leer el benchmark público CWRU.',

  'problem.h': 'Por qué el espectro crudo no basta',
  'problem.p':
    'Un defecto localizado produce un impacto diminuto y repetitivo cada vez que un elemento rodante pasa por él. Cada impacto es un choque de banda ancha que hace “sonar” la estructura en su resonancia (a menudo varios kHz). La tasa de repetición del defecto (decenas a cientos de Hz) queda enterrada bajo los armónicos del eje y el ruido, y es débil en el espectro crudo —pero modula en amplitud a la resonancia. La demodulación (la envolvente) recupera esa tasa limpiamente. El diagnóstico es entonces: ¿muestra el espectro de envolvente picos en BPFO, BPFI o 2·BSF?',

  'method.h': 'Teoría y método',
  'method.kin': 'Frecuencias cinemáticas de defecto',
  'method.kin.p':
    'Para un rodamiento con n elementos rodantes de diámetro d sobre diámetro primitivo D, ángulo de contacto φ, a frecuencia de eje f_r:',
  'method.env': 'Análisis de envolvente (demodulación)',
  'method.env.p':
    'Se filtra paso-banda alrededor de la resonancia excitada, se forma la señal analítica vía transformada de Hilbert, se toma su magnitud (la envolvente) y se calcula su espectro. Una falla aparece como una línea en su frecuencia cinemática y armónicos.',
  'method.dx': 'Decisión',
  'method.dx.p':
    'Puntuamos cada falla por la energía sumada en los picos de los primeros cinco armónicos de su frecuencia, normalizada por el piso de ruido del espectro. El mayor puntaje gana si supera un umbral; si no, el rodamiento se lee sano. Cada número remite a una línea calculada —nada es caja negra.',

  'impl.h': 'Implementación',
  'impl.p':
    'El cómputo aquí es liviano, así que todo corre en el cliente: un generador determinista y semillado construye una señal de vibración con base física (tren de impulsos a la frecuencia de falla, cada impulso haciendo resonar un modo amortiguado, con jitter de deslizamiento, modulación de amplitud, armónicos de eje y ruido a un SNR objetivo); luego el mismo pipeline que tomaría una señal real la analiza. Sitio estático, sin backend.',
  'impl.pipe': 'señal → paso-banda → envolvente de Hilbert → espectro de envolvente → puntaje armónico → diagnóstico',

  'exp.h': 'Experimentos',
  'exp.p':
    'Los cuatro escenarios incluidos se generan con fallas conocidas y semillas fijas, así que sirven de set de auto-validación: el motor debe recuperar la frecuencia de falla que produjo cada uno. Cambia de escenario en la app y confirma que el diagnóstico coincide con la falla plantada y que los picos de envolvente caen sobre las líneas marcadas BPFO/BPFI/2·BSF.',
  'exp.note':
    'Límites honestos: un único defecto localizado a velocidad constante es el caso fácil. Las máquinas reales traen velocidad variable, fallas simultáneas, difuminado e interferencia eléctrica —y la severidad absoluta aquí es sintética. Las relaciones de frecuencia, en cambio, son exactas y transfieren directo a grabaciones reales CWRU.',

  'live.h': 'En vivo: generar y diagnosticar',
  'live.scenario': 'Escenario',
  'live.bearing': 'Rodamiento',
  'live.fault': 'Falla plantada',
  'live.severity': 'Severidad',
  'live.rpm': 'Velocidad de eje (rpm)',
  'live.snr': 'SNR (dB)',
  'live.band': 'Banda de envolvente (Hz)',
  'live.signal': 'Señal de vibración (tiempo)',
  'live.spectrum': 'Espectro crudo',
  'live.envspectrum': 'Espectro de envolvente',
  'live.freqs': 'Frecuencias de defecto calculadas',
  'live.diag': 'Diagnóstico',
  'live.confidence': 'confianza',
  'live.amp': 'amplitud',
  'live.time': 'tiempo (s)',
  'live.freq': 'frecuencia (Hz)',
  'fault.healthy': 'Sano',
  'fault.outer': 'Pista externa (BPFO)',
  'fault.inner': 'Pista interna (BPFI)',
  'fault.ball': 'Bola (2·BSF)',
};

const dicts: Record<Lang, Dict> = { en, es };

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string }>({
  lang: 'en',
  setLang: () => {},
  t: (k) => k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(
    typeof navigator !== 'undefined' && navigator.language.startsWith('es') ? 'es' : 'en',
  );
  const t = (k: string) => dicts[lang][k] ?? dicts.en[k] ?? k;
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
