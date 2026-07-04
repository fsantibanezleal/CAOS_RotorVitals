import { useMemo, useState } from 'react';
import { buildCampbell } from '../dsp/campbell';
import { type FaultKind, type Bearing } from '../dsp/bearing';
import { Heatmap2D, type Segment } from './Heatmap2D';

/** Order-map tab (envelope speed sweep). Computes the run-up raster only while mounted (the shell
 * renders the active tab only), so it adds no cost to the other tabs. Hz↔order toggle; the defect
 * order line(s) overlaid; operating-speed band; hover gives the conjugate (order in Hz mode, Hz in
 * order mode). The defect frequency scales linearly with speed → a ray in Hz, a vertical constant
 * order under order tracking. */
export function CampbellPanel({ bearing, fault, severity, snr, seed, rpm, lang, realOrderMap, realFaultOrders, realLabel }: {
  bearing: Bearing; fault: FaultKind; severity: number; snr: number; seed: number; rpm: number; lang: 'en' | 'es';
  realOrderMap?: { rpmBins: number[]; orderBins: number[]; mag: number[][] };
  realFaultOrders?: { bpfo: number; bpfi: number; bsf: number };
  realLabel?: string;
}) {
  const es = lang === 'es';
  const [order, setOrder] = useState(false);
  const cm = useMemo(() => buildCampbell({ bearing, fault, severity, snrDb: snr, seed }), [bearing, fault, severity, snr, seed]);

  // REAL Campbell (Ottawa): the shaft speed sweeps during the 10 s record, so the order-tracked envelope spectrum is
  // a genuine order-vs-rpm raster. Fault frequencies are CONSTANT orders → horizontal lines. (Order mode only.)
  if (realOrderMap && realOrderMap.mag?.length) {
    const om = realOrderMap;
    const cols = om.mag.map((r) => Float64Array.from(r));
    const rpms = Float64Array.from(om.rpmBins);
    const orders = Float64Array.from(om.orderBins);
    const ordMax = orders[orders.length - 1];
    const fo = realFaultOrders;
    const segs: Segment[] = fo ? [
      { x0: rpms[0], y0: fo.bpfo, x1: rpms[rpms.length - 1], y1: fo.bpfo, color: '#f59f00', label: 'BPFO' },
      { x0: rpms[0], y0: fo.bpfi, x1: rpms[rpms.length - 1], y1: fo.bpfi, color: '#f06595', label: 'BPFI' },
      { x0: rpms[0], y0: 2 * fo.bsf, x1: rpms[rpms.length - 1], y1: 2 * fo.bsf, color: '#7c5cff', label: '2·BSF' },
    ] : [];
    return (
      <div className="rv-vizstack">
        <div className="rv-plot">
          <div className="rv-plot-t">{es ? `Mapa de órdenes, envolvente vs velocidad (Ottawa MEDIDO${realLabel ? `, ${realLabel}` : ''} · order-tracking)` : `Order map, envelope vs shaft speed (Ottawa MEASURED${realLabel ? `, ${realLabel}` : ''} · order tracking)`}</div>
          <Heatmap2D cols={cols} times={rpms} freqs={orders} fmax={ordMax} norm="lin" unit="" xunit="rpm" xlabel="rpm" ylabel="order (×)" yunit="×" segments={segs} height={300} hoverExtra={(x, y) => `${(y * (x / 60)).toFixed(0)} Hz`} />
        </div>
        <p className="hint">{es
          ? 'Campbell REAL: durante la grabación de 10 s la velocidad del eje barre, así que el espectro de envolvente order-tracked muestra cómo evoluciona el contenido con la rpm instantánea. Las frecuencias de falla del rodamiento son órdenes CONSTANTES (líneas horizontales), la firma que las separa de cualquier línea de frecuencia fija (diagonal). Es la herramienta que la velocidad VARIABLE de Ottawa habilita y un dataset de velocidad fija no. Datos medidos.'
          : 'REAL Campbell: during the 10 s record the shaft speed sweeps, so the order-tracked envelope spectrum shows how the content evolves with instantaneous rpm. The bearing fault frequencies are CONSTANT orders (horizontal lines), separating them from any fixed-frequency line (diagonal). This is the tool Ottawa\'s VARIABLE speed uniquely enables and a constant-speed dataset cannot. Measured data.'}</p>
      </div>
    );
  }

  const opBand: [number, number] = [rpm * 0.95, rpm * 1.05];

  // Hz mode: defect line is a ray y = mult·rpm/60. Order mode: a horizontal constant-order line y = mult.
  const segments: Segment[] = order
    ? cm.orderMults.map((o) => ({ x0: cm.rpmMin, y0: o.mult, x1: cm.rpmMax, y1: o.mult, color: o.color, label: o.label }))
    : cm.orderMults.map((o) => ({ x0: cm.rpmMin, y0: (o.mult * cm.rpmMin) / 60, x1: cm.rpmMax, y1: (o.mult * cm.rpmMax) / 60, color: o.color, label: o.label }));

  const title = es ? 'Mapa de órdenes, frecuencia de defecto vs velocidad (envolvente, run-up sintético)' : 'Order map, defect frequency vs shaft speed (envelope, synthetic run-up)';
  const note = es
    ? 'Barrido de velocidad del espectro de envolvente. La frecuencia de defecto del rodamiento está fijada por la cinemática, así que crece linealmente con la velocidad del eje, una recta en (rpm, Hz). En modo orden cada columna se remuestrea sobre orden = f/(rpm/60), enderezando la línea de defecto a un orden constante (p. ej. BPFO ≈ 3.58×) que la separa de cualquier línea de frecuencia fija. Sano → sin línea de defecto. Datos sintéticos.'
    : 'Speed sweep of the envelope spectrum. The bearing defect frequency is fixed by kinematics, so it climbs linearly with shaft speed, a ray in (rpm, Hz). In order mode each column is resampled onto order = f/(rpm/60), straightening the defect line to a constant order (e.g. BPFO ≈ 3.58×) that separates it from any fixed-frequency line. Healthy → no defect line. Synthetic data.';

  return (
    <div className="rv-vizstack">
      <div className="rv-plot">
        <div className="rv-plot-t rv-plot-th">
          <span>{title}</span>
          <span className="rv-seg">
            <button className={`chip ${!order ? 'on' : ''}`} onClick={() => setOrder(false)}>Hz</button>
            <button className={`chip ${order ? 'on' : ''}`} onClick={() => setOrder(true)}>{es ? 'orden' : 'order'}</button>
          </span>
        </div>
        {order
          ? <Heatmap2D cols={cm.colsOrd} times={cm.rpms} freqs={cm.orders} fmax={cm.ordMax} norm="db" xunit="rpm" xlabel="rpm" ylabel="order (×)" yunit="×" segments={segments} xBand={opBand} height={300} hoverExtra={(x, y) => `${(y * (x / 60)).toFixed(0)} Hz`} />
          : <Heatmap2D cols={cm.colsHz} times={cm.rpms} freqs={cm.freqsHz} fmax={cm.fmaxHz} norm="db" xunit="rpm" xlabel="rpm" ylabel="Hz" yunit="Hz" segments={segments} xBand={opBand} height={300} hoverExtra={(x, y) => `${(y / (x / 60)).toFixed(2)}×`} />}
      </div>
      <p className="hint">{note}</p>
    </div>
  );
}
