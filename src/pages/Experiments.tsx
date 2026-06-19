import { useShellLang } from '@fasl-work/caos-app-shell';

const DATASETS: { name: string; fit: string; faults: string; note: string }[] = [
  { name: 'CWRU (Case Western)', fit: 'diagnosis', faults: 'OR/IR/ball, 3 sizes, 0–3 hp', note: 'The canonical benchmark; Smith & Randall (2015) grade record difficulty.' },
  { name: 'Paderborn (KAt)', fit: 'diagnosis', faults: 'real + accelerated damage', note: 'Current + vibration; realistic damage, multiple operating points.' },
  { name: 'MFPT', fit: 'diagnosis', faults: 'OR/IR, varied load', note: 'Baseline + outer/inner under load.' },
  { name: 'IMS / NASA', fit: 'rul', faults: 'run-to-failure', note: 'Classic run-to-failure for prognostics.' },
  { name: 'XJTU-SY', fit: 'rul', faults: 'run-to-failure, 3 conditions', note: 'Full life vibration; RUL benchmark.' },
  { name: 'FEMTO / PRONOSTIA', fit: 'rul', faults: 'accelerated life (PHM 2012)', note: 'The PHM 2012 prognostic challenge set.' },
  { name: 'MAFAULDA', fit: 'diagnosis', faults: 'imbalance/misalign/bearing', note: 'Multi-fault machinery rig.' },
  { name: 'Ottawa (variable speed)', fit: 'diagnosis', faults: 'OR/IR, run-up/coast-down', note: 'Order-tracking under varying speed.' },
];

export default function Experiments() {
  const es = useShellLang() === 'es';
  return (
    <div className="page-body prose">
      <div className="page-head">
        <h1>{es ? 'Experimentos' : 'Experiments'}</h1>
        <p className="lede">{es ? 'Cobertura de ~una docena de casos reales y comparación método-vs-método, con particiones y métricas honestas.' : 'Coverage of ~a dozen real cases and method-vs-method comparison, with honest splits and metrics.'}</p>
      </div>
      <section>
        <h2>{es ? 'Datasets reales' : 'Real datasets'}</h2>
        <table className="cmp-table">
          <thead><tr><th>{es ? 'Dataset' : 'Dataset'}</th><th>{es ? 'Uso' : 'Fit'}</th><th>{es ? 'Fallas' : 'Faults'}</th><th>{es ? 'Nota' : 'Note'}</th></tr></thead>
          <tbody>{DATASETS.map((d) => <tr key={d.name}><td style={{ textAlign: 'left' }}>{d.name}</td><td>{d.fit}</td><td style={{ textAlign: 'left' }}>{d.faults}</td><td style={{ textAlign: 'left' }} className="muted">{d.note}</td></tr>)}</tbody>
        </table>
        <h2>{es ? 'Cobertura de escenarios' : 'Scenario coverage'}</h2>
        <p>{es ? 'Los casos deben cubrir: tipo de componente (rodamiento/engranaje/eje), modo de falla (OR/IR/bola/jaula, diente, desbalance/desalineamiento, fallas compuestas), severidades, velocidad constante y variable, carga y SNR, y run-to-failure para RUL. Las brechas se llenan con datos sintéticos en el formato real esperado, claramente etiquetados.' : 'Cases must cover: component type (bearing/gear/shaft), fault mode (OR/IR/ball/cage, gear tooth, imbalance/misalignment, compound), severities, constant and variable speed, load and SNR, and run-to-failure for RUL. Gaps are filled with synthetic data in the expected real file format, clearly labeled.'}</p>
        <h2>{es ? 'Comparación método-vs-método' : 'Method-vs-method comparison'}</h2>
        <p>{es ? 'Cada caso se procesa con múltiples métodos (envolvente/SES, kurtograma, cyclostationary, descomposición, ML/DL) y se reporta la detectabilidad de la frecuencia de falla y la exactitud de clasificación con la partición honesta (sin fuga CWRU, prueba cruzada de carga).' : 'Each case is processed with multiple methods (envelope/SES, kurtogram, cyclostationary, decomposition, ML/DL) and we report fault-frequency detectability and classification accuracy under the honest split (no CWRU leakage, cross-load test).'}</p>
        <p className="muted small">{es ? 'La matriz de cobertura completa y el benchmark viven en la investigación del producto (wip); esta página crece a medida que se incorporan datasets y resultados precalculados.' : 'The full coverage matrix and benchmark live in the product research (wip); this page grows as datasets and precomputed results are wired in.'}</p>
      </section>
    </div>
  );
}
