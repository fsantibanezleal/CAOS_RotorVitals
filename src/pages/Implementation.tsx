import { useShellLang } from '@fasl-work/caos-app-shell';

export default function Implementation() {
  const es = useShellLang() === 'es';
  return (
    <div className="page-body prose">
      <div className="page-head">
        <h1>{es ? 'Implementación' : 'Implementation'}</h1>
        <p className="lede">{es ? 'Cómputo pesado offline → artefacto compacto → runtime fino. Lo liviano, en vivo en el navegador.' : 'Heavy compute offline → compact artifact → thin runtime. Light work runs live in the browser.'}</p>
      </div>
      <section>
        <h2>{es ? 'Pipeline de datos' : 'Data pipeline'}</h2>
        <pre className="codeblock">{`raw (real .mat / synthetic-in-real-format)
  → load + QC + unit/integration check
  → resample / computed-order-tracking (variable speed)
  → band-pass / cepstrum pre-whitening (remove deterministic gear/shaft)
  → segment + window
  → [diagnosis] kurtogram band → Hilbert envelope → SES → kinematic peak match
  → [features] time/freq/TF + entropy → classical ML / DL (ONNX)
  → [prognostics] health indicator → onset → RUL projection (threshold + band)
  → [decision] ISO 20816 severity zone + recommendation`}</pre>
        <h2>{es ? 'Tiers de cómputo' : 'Compute tiers'}</h2>
        <ul>
          <li><b>{es ? 'En vivo (navegador, TS/WASM):' : 'Live (browser, TS/WASM):'}</b> {es ? 'FFT, envolvente de Hilbert, SES, kurtograma, cepstrum, indicadores de salud, ajuste de RUL, frecuencias cinemáticas, gauge ISO.' : 'FFT, Hilbert envelope, SES, kurtogram, cepstrum, health indicators, RUL fit, kinematic frequencies, ISO gauge.'}</li>
          <li><b>{es ? 'Precalculado (offline → artefacto):' : 'Precomputed (offline → artifact):'}</b> {es ? 'modelos DL entrenados (ONNX para inferencia en navegador), barridos grandes de kurtograma/coherencia cíclica sobre datasets completos, tablas de benchmark método-vs-método, posteriors de RUL.' : 'trained DL models (ONNX for in-browser inference), large kurtogram / cyclic-coherence sweeps over full datasets, method-vs-method benchmark tables, RUL posteriors.'}</li>
        </ul>
        <h2>{es ? 'Despliegue' : 'Deploy'}</h2>
        <p>{es ? 'Se publica como sitio estático servido desde un host con CDN (sin servidor ni base de datos): el runtime solo entrega archivos, por lo que escala y cachea trivialmente. La interfaz, el theming claro/oscuro y el bilingüe provienen de un design-system compartido por toda la suite, de modo que cada app es independiente pero consistente.' : 'It ships as a static site served from a CDN-backed host (no server, no database): the runtime only delivers files, so it scales and caches trivially. The UI shell, light/dark theming and bilingual content come from a design system shared across the suite, so each app is independent yet consistent.'}</p>
      </section>
    </div>
  );
}
