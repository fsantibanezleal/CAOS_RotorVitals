import { useEffect, useMemo, useState } from 'react';
import { loadSamples, type Samples, type CwruSample } from '../dsp/learned';
import { pca2d } from '../dsp/pca';

// T14 — the learned-feature embedding. The WDCNN's 100-D penultimate feature (the representation the deep model
// learned, committed per real segment) projected to 2-D by PCA. It makes the whole learned story legible in one
// picture: the in-distribution classes cluster; the unseen 0.014″ segments drift toward the wrong cluster (why the
// WDCNN misclassifies them — T4) while the 0.021″ segments stay in the correct cluster (the WDCNN gets them right);
// and the MFPT segments (a different rig) sit apart (domain shift — T13). Consistent with the cross-severity table.
const CLASS_COLOR: Record<string, string> = { normal: '#3fb950', outer: '#f59f00', inner: '#f06595', ball: '#7c5cff' };

type Pt = { x: number; y: number; s: CwruSample };

export function EmbeddingPanel({ lang }: { lang: 'en' | 'es' }) {
  const es = lang === 'es';
  const [samples, setSamples] = useState<Samples | null>(null);
  const [hov, setHov] = useState<Pt | null>(null);
  useEffect(() => { loadSamples().then(setSamples).catch(() => {}); }, []);

  const proj = useMemo(() => {
    if (!samples) return null;
    const segs = samples.samples.filter((s) => Array.isArray(s.emb) && s.emb.length);
    if (segs.length < 3) return null;
    const { pts, varExpl } = pca2d(segs.map((s) => s.emb as number[]));
    return { segs, pts, varExpl };
  }, [samples]);

  if (!samples) return <section><p className="muted small">{es ? 'Cargando…' : 'Loading…'}</p></section>;
  if (!proj) return null;

  const W = 640, H = 380, padL = 12, padR = 12, padT = 12, padB = 12;
  const xs = proj.pts.map((p) => p[0]), ys = proj.pts.map((p) => p[1]);
  const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
  const sx = (x: number) => padL + ((x - xmin) / (xmax - xmin || 1)) * (W - padL - padR);
  const sy = (y: number) => padT + (1 - (y - ymin) / (ymax - ymin || 1)) * (H - padT - padB);
  const points: Pt[] = proj.segs.map((s, i) => ({ x: sx(proj.pts[i][0]), y: sy(proj.pts[i][1]), s }));

  // marker by provenance: CWRU 0.007 baseline = filled dot; 0.014 (drifts) = open ring; 0.021 (stays correct) =
  // dotted ring (a ring with a center dot, evoking "unseen but correctly classified"); MFPT = open diamond.
  const marker = (p: Pt, k: number) => {
    const c = CLASS_COLOR[p.s.cls] || '#8b949e';
    const ev = { onMouseEnter: () => setHov(p), onMouseLeave: () => setHov(null), style: { cursor: 'pointer' } as const };
    if (p.s.dataset === 'MFPT') return <rect key={k} x={p.x - 5} y={p.y - 5} width={10} height={10} transform={`rotate(45 ${p.x} ${p.y})`} fill="none" stroke={c} strokeWidth={1.8} {...ev} />;
    if (p.s.sizeIn === 0.021) return <g key={k} {...ev}><circle cx={p.x} cy={p.y} r={6} fill="none" stroke={c} strokeWidth={2} /><circle cx={p.x} cy={p.y} r={2} fill={c} /></g>;
    if (p.s.sizeIn != null) return <circle key={k} cx={p.x} cy={p.y} r={5.5} fill="none" stroke={c} strokeWidth={2} {...ev} />;
    return <circle key={k} cx={p.x} cy={p.y} r={5} fill={c} opacity={0.9} {...ev} />;
  };

  const prov = (s: CwruSample) => s.dataset === 'MFPT' ? (es ? 'MFPT (otro banco)' : 'MFPT (different rig)')
    : s.sizeIn != null ? `CWRU ${s.sizeIn.toFixed(3)}″ ${es ? '(no visto)' : '(unseen)'}` : `CWRU 0.007″`;

  return (
    <section>
      <h2>{es ? 'Espacio de features aprendido (embedding del WDCNN)' : 'Learned feature space (WDCNN embedding)'}</h2>
      <p className="muted small">{es
        ? `La feature de 100-D de la penúltima capa del WDCNN —la representación que el modelo profundo APRENDIÓ— de cada segmento real comprometido, proyectada a 2-D por PCA (PC1 ${(proj.varExpl[0] * 100).toFixed(0)}% · PC2 ${(proj.varExpl[1] * 100).toFixed(0)}% de varianza). Una sola imagen del porqué: las clases in-distribution se agrupan; los segmentos de 0.014″ no vistos (anillos ◯) derivan hacia el cúmulo equivocado —por eso el WDCNN los confunde (recall ~28%, T4)—, mientras que los de 0.021″ (anillos con punto ⊙) sí caen en el cúmulo correcto (recall ~99%); y los segmentos MFPT (otro banco, rombos ◇) quedan aparte —el domain-shift (T13)—. Alcance ilustrativo: 3 segmentos base por clase, 2 por tamaño no visto, 1 por archivo MFPT; PC1+PC2 capturan ~85% de la varianza (una vista 2-D fiel pero parcial).`
        : `The WDCNN's 100-D penultimate feature — the representation the deep model LEARNED — of every real committed segment, projected to 2-D by PCA (PC1 ${(proj.varExpl[0] * 100).toFixed(0)}% · PC2 ${(proj.varExpl[1] * 100).toFixed(0)}% of variance). One picture of the why: the in-distribution classes cluster; the unseen 0.014″ segments (rings ◯) drift toward the wrong cluster — which is why the WDCNN misclassifies them (recall ~28%, T4) — while the 0.021″ segments (dotted rings ⊙) do land in the correct cluster (recall ~99%); and the MFPT segments (a different rig, diamonds ◇) sit apart — the domain shift (T13). Illustrative scope: 3 baseline segments per class, 2 per unseen size, 1 per MFPT file; PC1+PC2 capture ~85% of the variance (a faithful but partial 2-D view).`}</p>

      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ background: 'var(--color-bg)', borderRadius: 6, border: '1px solid var(--color-border)' }} role="img" aria-label="WDCNN learned feature embedding">
          {points.map((p, k) => marker(p, k))}
        </svg>
        {hov && <div className="heatmap-readout" style={{ position: 'absolute', left: Math.min(hov.x + 10, W - 160), top: Math.max(0, hov.y - 10), pointerEvents: 'none' }}>
          <b style={{ color: CLASS_COLOR[hov.s.cls] }}>{hov.s.cls}</b> · {prov(hov.s)}{hov.s.file ? ` · #${hov.s.file}` : ''}
        </div>}
      </div>

      <div className="muted small" style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
        {['normal', 'outer', 'inner', 'ball'].map((c) => <span key={c}><span style={{ color: CLASS_COLOR[c] }}>●</span> {c}</span>)}
        <span>● CWRU 0.007″</span>
        <span>◯ 0.014″ ({es ? 'deriva' : 'drifts'})</span>
        <span>⊙ 0.021″ ({es ? 'correcto' : 'correct'})</span>
        <span>◇ MFPT ({es ? 'otro banco' : 'different rig'})</span>
      </div>
    </section>
  );
}
