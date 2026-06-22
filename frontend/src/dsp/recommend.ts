// T5 — the condition-based-maintenance DECISION layer. The App diagnoses and trends; this turns that evidence into
// a prioritised, EXPLAINABLE maintenance recommendation, the way a reliability engineer would: fuse the ISO 20816
// broadband-velocity severity zone, the envelope-diagnosis fault severity, and the RUL projection, then act on the
// most severe of them. Honesty is built in — when the coarse broadband ISO screen disagrees with the envelope
// (which it does for an early bearing fault, whose energy sits in the HF resonance OUTSIDE the 10–1000 Hz band),
// the engine surfaces the disagreement and trusts the envelope rather than hiding it.
import { ISO_CLASS_I } from './iso';
import { type Diagnosis } from './diagnose';
import { type RulResult } from './health';
import { type FaultKind } from './bearing';

export type Priority = 'ok' | 'watch' | 'plan' | 'alarm' | 'trip';
export type IsoZone = 'A' | 'B' | 'C' | 'D';
export type Assessment = 'good' | 'watch' | 'bad';

export interface Factor {
  key: string;
  label: string;
  value: string;
  assessment: Assessment;
  note?: string;
}

export interface Recommendation {
  priority: Priority;
  headline: string;
  detail: string;
  nextInspection: string;
  confidence: number;     // 0..1
  isoZone: IsoZone;
  velocityRms: number;    // mm/s (calibrated, illustrative magnitude)
  faultClass: FaultKind;
  faultSeverity: number;  // the top harmonic-prominence ×
  faultState: 'healthy' | 'incipient' | 'developed' | 'severe';
  rulHours: number | null;
  factors: Factor[];
  disagreement: boolean;  // broadband ISO clear but envelope flags a fault
}

const LADDER: Priority[] = ['ok', 'watch', 'plan', 'alarm', 'trip'];
const worse = (a: Priority, b: Priority): Priority => (LADDER.indexOf(a) >= LADDER.indexOf(b) ? a : b);

export function isoZoneOf(vrms: number): IsoZone {
  if (vrms <= ISO_CLASS_I.ab) return 'A';
  if (vrms <= ISO_CLASS_I.bc) return 'B';
  if (vrms <= ISO_CLASS_I.cd) return 'C';
  return 'D';
}

// the envelope-diagnosis severity ladder — aligned with the App's severity gauge zones (3/6/9 of the 0..12 scale)
function faultStateOf(sev: number, isFault: boolean): Recommendation['faultState'] {
  if (!isFault || sev < 3) return 'healthy';
  if (sev < 6) return 'incipient';
  if (sev < 9) return 'developed';
  return 'severe';
}

const ZONE_PRIORITY: Record<IsoZone, Priority> = { A: 'ok', B: 'watch', C: 'plan', D: 'alarm' };
const STATE_PRIORITY: Record<Recommendation['faultState'], Priority> = {
  healthy: 'ok', incipient: 'watch', developed: 'plan', severe: 'alarm',
};

interface Txt { headline: Record<Priority, string>; cadence: Record<Priority, string>; }
const T: Record<'en' | 'es', Txt> = {
  en: {
    headline: {
      ok: 'Continue normal operation', watch: 'Increase monitoring — no action yet',
      plan: 'Plan corrective maintenance', alarm: 'Alarm — schedule shutdown', trip: 'Trip — stop the machine',
    },
    cadence: {
      ok: 'routine inspection at the next scheduled interval', watch: 'tighten to a weekly envelope/SES check',
      plan: 'inspect within the RUL window and order the replacement bearing',
      alarm: 'daily monitoring; plan a shutdown at the next opportunity',
      trip: 'shut down now; replace the bearing before restart',
    },
  },
  es: {
    headline: {
      ok: 'Continuar operación normal', watch: 'Aumentar monitoreo — sin acción aún',
      plan: 'Planificar mantenimiento correctivo', alarm: 'Alarma — programar parada', trip: 'Disparo — detener la máquina',
    },
    cadence: {
      ok: 'inspección de rutina en el próximo intervalo programado', watch: 'apretar a un chequeo envolvente/SES semanal',
      plan: 'inspeccionar dentro de la ventana de RUL y pedir el rodamiento de repuesto',
      alarm: 'monitoreo diario; planificar una parada en la próxima oportunidad',
      trip: 'detener ahora; reemplazar el rodamiento antes de reiniciar',
    },
  },
};

export function recommend(input: {
  diag: Diagnosis; velocityRms: number; rul: RulResult; lifeH: number; hiRatio?: number | null; lang: 'en' | 'es';
}): Recommendation {
  const { diag, velocityRms, rul, lifeH, hiRatio, lang } = input;
  const es = lang === 'es';
  const tx = T[lang];
  const isFault = diag.top !== 'healthy';
  const sev = diag.scores[0]?.score ?? 0;
  const zone = isoZoneOf(velocityRms);
  const state = faultStateOf(sev, isFault);
  const rulH = rul.rul != null && isFinite(rul.rul) ? rul.rul : null;

  // RUL urgency on the priority ladder, relative to the life horizon
  let rulPriority: Priority = 'ok';
  if (rulH != null) {
    const frac = rulH / Math.max(1e-9, lifeH);
    rulPriority = frac < 0.05 ? 'alarm' : frac < 0.2 ? 'plan' : frac < 0.5 ? 'watch' : 'ok';
  }

  let priority = worse(worse(ZONE_PRIORITY[zone], STATE_PRIORITY[state]), rulPriority);
  // escalate to TRIP only when the worst indicators agree
  if (state === 'severe' && zone === 'D' && rulPriority === 'alarm') priority = 'trip';

  // the honest broadband-vs-envelope disagreement: ISO looks clear (A/B) but the envelope found a real fault
  const disagreement = isFault && state !== 'healthy' && (zone === 'A' || zone === 'B') && sev >= 6;

  const factors: Factor[] = [];
  const a = (b: boolean, w?: boolean): Assessment => (b ? 'bad' : w ? 'watch' : 'good');
  factors.push({
    key: 'diagnosis',
    label: es ? 'Diagnóstico (envolvente/SES)' : 'Diagnosis (envelope/SES)',
    value: isFault ? `${faultLabel(diag.top, es)} · ${(diag.confidence * 100).toFixed(0)}% ${es ? 'confianza' : 'confidence'}` : (es ? 'sano' : 'healthy'),
    assessment: a(state === 'severe' || state === 'developed', state === 'incipient'),
  });
  factors.push({
    key: 'severity',
    label: es ? 'Índice de severidad (prominencia del peine)' : 'Severity index (comb prominence)',
    value: `${sev.toFixed(1)}× — ${stateLabel(state, es)}`,
    assessment: a(state === 'severe', state === 'developed' || state === 'incipient'),
  });
  factors.push({
    key: 'iso',
    label: es ? 'ISO 20816 — velocidad RMS de banda ancha' : 'ISO 20816 — broadband velocity RMS',
    value: `${velocityRms.toFixed(2)} mm/s — ${es ? 'Zona' : 'Zone'} ${zone}`,
    assessment: a(zone === 'D', zone === 'C'),
    note: disagreement
      ? (es ? 'La velocidad de banda ancha 10–1000 Hz NO ve esta falla (energía en la resonancia HF). Se confía en la envolvente.'
            : 'Broadband 10–1000 Hz velocity does NOT see this fault (energy in the HF resonance). The envelope is trusted.')
      : undefined,
  });
  factors.push({
    key: 'rul',
    label: es ? 'Vida útil remanente (RUL)' : 'Remaining useful life (RUL)',
    value: rulH != null ? `${rulH.toFixed(0)} h (${((rulH / Math.max(1e-9, lifeH)) * 100).toFixed(0)}% ${es ? 'de la vida' : 'of life'})` : (es ? 'sin tendencia de degradación' : 'no degradation trend'),
    assessment: a(rulPriority === 'alarm', rulPriority === 'plan'),
  });
  if (hiRatio != null) {
    factors.push({
      key: 'hi',
      label: es ? 'Indicador de salud (deep-AE)' : 'Health indicator (deep-AE)',
      value: `${hiRatio.toFixed(2)}× ${es ? 'umbral' : 'threshold'} — ${hiRatio > 1 ? (es ? 'anómalo' : 'anomalous') : (es ? 'normal' : 'normal')}`,
      assessment: a(hiRatio > 1.5, hiRatio > 1),
    });
  }

  // confidence: the diagnosis confidence, tempered when indicators disagree
  const agree = !disagreement;
  const confidence = Math.max(0.4, Math.min(1, (isFault ? diag.confidence : 0.85) * (agree ? 1 : 0.8)));

  const detailParts = [tx.cadence[priority]];
  if (disagreement) detailParts.push(es
    ? 'la pantalla ISO de banda ancha parece tranquila, pero la envolvente confirma una falla de rodamiento real — actúe sobre la envolvente'
    : 'the broadband ISO screen looks calm, but the envelope confirms a real bearing fault — act on the envelope');
  if (rulH != null && (priority === 'plan' || priority === 'alarm'))
    detailParts.push(es ? `ventana de acción ≈ ${rulH.toFixed(0)} h` : `action window ≈ ${rulH.toFixed(0)} h`);

  return {
    priority, headline: tx.headline[priority], detail: detailParts.join('; '),
    nextInspection: tx.cadence[priority], confidence, isoZone: zone, velocityRms,
    faultClass: diag.top, faultSeverity: sev, faultState: state, rulHours: rulH, factors, disagreement,
  };
}

function faultLabel(k: FaultKind, es: boolean): string {
  const en: Record<string, string> = { healthy: 'healthy', outer: 'outer race (BPFO)', inner: 'inner race (BPFI)', ball: 'ball (2·BSF)' };
  const sp: Record<string, string> = { healthy: 'sano', outer: 'pista externa (BPFO)', inner: 'pista interna (BPFI)', ball: 'bola (2·BSF)' };
  return (es ? sp : en)[k] ?? k;
}

function stateLabel(s: Recommendation['faultState'], es: boolean): string {
  const en: Record<string, string> = { healthy: 'healthy', incipient: 'incipient', developed: 'developed', severe: 'severe' };
  const sp: Record<string, string> = { healthy: 'sana', incipient: 'incipiente', developed: 'desarrollada', severe: 'severa' };
  return (es ? sp : en)[s];
}

/** A machine-readable report object (what the JSON export serialises). */
export function reportObject(r: Recommendation, ctx: { bearing: string; rpm: number; fault: string; severity: number }) {
  return {
    schema: 'rotorvitals.report/v1',
    generated: 'client-side (illustrative synthetic case)',
    asset: { bearing: ctx.bearing, shaftRpm: ctx.rpm, plantedFault: ctx.fault, plantedSeverity: ctx.severity },
    diagnosis: { faultClass: r.faultClass, faultState: r.faultState, severityIndex: round2(r.faultSeverity) },
    iso20816: { velocityRmsMmps: round2(r.velocityRms), zone: r.isoZone },
    prognostics: { rulHours: r.rulHours != null ? round2(r.rulHours) : null },
    decision: { priority: r.priority, action: r.headline, nextInspection: r.nextInspection, confidence: round2(r.confidence) },
    rationale: r.factors.map((f) => ({ factor: f.label, value: f.value, assessment: f.assessment, note: f.note })),
    honesty: 'The velocity magnitude is an illustrative calibration of a synthetic case; the decision logic (ISO '
      + '20816 zones + envelope severity + RUL, broadband-vs-envelope disagreement surfaced) is real CBM practice.',
  };
}

/** A human-readable Markdown report (the .md export). */
export function reportMarkdown(r: Recommendation, ctx: { bearing: string; rpm: number; fault: string; severity: number }, es: boolean): string {
  const L = es
    ? { title: 'Reporte de condición de rodamiento', asset: 'Activo', diag: 'Diagnóstico', dec: 'Decisión', rat: 'Justificación', factor: 'Factor', val: 'Valor', ass: 'Evaluación', next: 'Próxima inspección', conf: 'Confianza' }
    : { title: 'Bearing condition report', asset: 'Asset', diag: 'Diagnosis', dec: 'Decision', rat: 'Rationale', factor: 'Factor', val: 'Value', ass: 'Assessment', next: 'Next inspection', conf: 'Confidence' };
  const lines = [
    `# ${L.title} — RotorVitals`, '',
    `**${L.asset}:** ${ctx.bearing} · ${ctx.rpm} rpm · ${es ? 'falla plantada' : 'planted fault'} ${ctx.fault} (${ctx.severity.toFixed(2)})`, '',
    `**${L.dec}:** [${r.priority.toUpperCase()}] ${r.headline}`,
    `**${L.next}:** ${r.nextInspection}`,
    `**${L.conf}:** ${(r.confidence * 100).toFixed(0)}%`, '',
    `## ${L.rat}`, '',
    `| ${L.factor} | ${L.val} | ${L.ass} |`, '|---|---|---|',
    ...r.factors.map((f) => `| ${f.label} | ${f.value} | ${f.assessment}${f.note ? ` — ${f.note}` : ''} |`),
    '', '_' + (es ? 'Magnitud de velocidad ilustrativa (caso sintético); lógica de decisión = ISO 20816 + envolvente + RUL (práctica CBM real).'
      : 'Illustrative velocity magnitude (synthetic case); decision logic = ISO 20816 + envelope + RUL (real CBM practice).') + '_',
  ];
  return lines.join('\n');
}

const round2 = (v: number) => Math.round(v * 100) / 100;
