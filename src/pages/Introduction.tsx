import { Callout, useShellLang } from '@fasl-work/caos-app-shell';

export default function Introduction() {
  const es = useShellLang() === 'es';
  return (
    <div className="page-body prose">
      <div className="page-head">
        <h1>{es ? 'Introducción' : 'Introduction'}</h1>
        <p className="lede">{es
          ? 'RotorVitals es una suite real de monitoreo de condición y prognóstico de maquinaria rotativa — no una demo de un solo algoritmo.'
          : 'RotorVitals is a real condition-monitoring & prognostics suite for rotating machinery — not a single-algorithm demo.'}</p>
      </div>
      <section>
        <p>{es
          ? 'Los rodamientos son el punto de falla más común de chancadores, correas, bombas y ventiladores. RotorVitals toma una señal de vibración y la lleva por el pipeline completo de la disciplina: cálculo de las frecuencias cinemáticas del rodamiento, selección de banda de demodulación por kurtosis espectral (kurtograma), análisis de envolvente (SES), y un conjunto de métodos complementarios — cepstrum, cyclostationary, descomposición, deconvolución, ML/DL — culminando en diagnóstico, severidad ISO y estimación de vida remanente (RUL) con incertidumbre.'
          : 'Bearings are the most common failure point of crushers, conveyors, pumps and fans. RotorVitals takes a vibration signal through the field’s full pipeline: compute the bearing kinematic frequencies, select the demodulation band by spectral kurtosis (the kurtogram), run envelope analysis (SES), and a set of complementary methods — cepstrum, cyclostationary, decomposition, deconvolution, ML/DL — ending in diagnosis, ISO severity and remaining-useful-life (RUL) with uncertainty.'}</p>
        <p>{es
          ? 'La app web solo visualiza; detrás hay un motor de procesamiento real. Lo pesado (entrenamiento de modelos, barridos, ajustes de prognóstico) se precalcula offline y se sirve como artefactos; lo liviano corre en vivo en el navegador. Cada método está referenciado (DOI) y validado adversarialmente, calibrado sobre benchmarks públicos reales (CWRU, Paderborn, IMS, XJTU-SY, FEMTO).'
          : 'The web app only visualizes; behind it is a real processing engine. Heavy work (model training, sweeps, prognostic fits) is precomputed offline and served as artifacts; light work runs live in the browser. Every method is referenced (DOI) and adversarially validated, calibrated on real public benchmarks (CWRU, Paderborn, IMS, XJTU-SY, FEMTO).'}</p>
        <Callout variant="honest" title={es ? 'Marco honesto' : 'Honest framing'}>
          {es
            ? 'Las relaciones de frecuencia son exactas y transfieren a grabaciones reales. La severidad absoluta y el RUL de las trazas sintéticas son ilustrativos y están etiquetados como tales; los resultados sobre datos reales se reportan con su dataset, partición y métrica. No es una certificación de salud de máquina.'
            : 'The frequency relationships are exact and transfer to real recordings. Absolute severity and RUL on synthetic traces are illustrative and labeled as such; results on real data are reported with their dataset, split and metric. This is not a certified machine-health verdict.'}
        </Callout>
      </section>
    </div>
  );
}
