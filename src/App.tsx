import { useMemo, useState } from 'react';
import { useI18n } from './i18n';
import { toggleTheme } from './theme';
import { Eq } from './components/Eq';
import { Plot, type Marker } from './components/Plot';
import { synth, type SignalSpec } from './dsp/signal';
import { magSpectrum, envelopeSpectrum } from './dsp/envelope';
import { defectFreqs, type FaultKind } from './dsp/bearing';
import { diagnose } from './dsp/diagnose';
import { BEARINGS, bearingById } from './data/bearings';
import { SCENARIOS, DEFAULT_BAND } from './data/scenarios';

const FAULTS: FaultKind[] = ['healthy', 'outer', 'inner', 'ball'];
const C = { outer: '#f59f00', inner: '#f06595', ball: '#7c5cff', shaft: '#37b24d' };

export default function App() {
  const { t, lang, setLang } = useI18n();

  const [bearingId, setBearingId] = useState('skf6205');
  const [fault, setFault] = useState<FaultKind>('outer');
  const [severity, setSeverity] = useState(1.0);
  const [rpm, setRpm] = useState(1772);
  const [snr, setSnr] = useState(2);

  const seed = useMemo(() => SCENARIOS.find((s) => s.fault === fault)?.spec.seed ?? 202, [fault]);

  const result = useMemo(() => {
    const bearing = bearingById(bearingId);
    const spec: SignalSpec = {
      fs: 12000,
      dur: 1,
      rpm,
      bearing,
      fault,
      severity: fault === 'healthy' ? 0 : severity,
      resonance: 3400,
      zeta: 0.04,
      snrDb: snr,
      seed,
    };
    const sig = synth(spec);
    const raw = magSpectrum(sig.x, sig.fs);
    const env = envelopeSpectrum(sig.x, sig.fs, DEFAULT_BAND);
    const f = defectFreqs(bearing, rpm / 60);
    const dx = diagnose(env, f);
    return { sig, raw, env, f, dx };
  }, [bearingId, fault, severity, rpm, snr, seed]);

  const { sig, raw, env, f, dx } = result;
  const envMarkers: Marker[] = [
    { x: f.bpfo, label: 'BPFO', color: C.outer },
    { x: f.bpfi, label: 'BPFI', color: C.inner },
    { x: 2 * f.bsf, label: '2·BSF', color: C.ball },
    { x: rpm / 60, label: 'fr', color: C.shaft },
  ];

  return (
    <>
      <header className="hdr">
        <div className="wrap row">
          <div className="brand">
            <span className="mark">RotorVitals</span>
            <span className="sub">{t('app.subtitle')}</span>
          </div>
          <span className="spacer" />
          <a className="lnk" href="https://faena.fasl-work.com">{t('hub.back')}</a>
          <a className="lnk" href="https://github.com/fsantibanezleal/CAOS_RotorVitals" target="_blank" rel="noopener">{t('repo')} ↗</a>
          <button className="btn" onClick={() => setLang(lang === 'es' ? 'en' : 'es')}>{lang === 'es' ? 'EN' : 'ES'}</button>
          <button className="btn" onClick={toggleTheme} aria-label="theme">◐</button>
        </div>
      </header>

      <nav className="nav">
        <div className="wrap row">
          {(['intro', 'problem', 'method', 'impl', 'exp', 'app'] as const).map((k) => (
            <a key={k} href={`#${k}`}>{t(`nav.${k}`)}</a>
          ))}
        </div>
      </nav>

      <main className="wrap">
        <section id="intro" className="sec">
          <h1>{t('app.title')}</h1>
          <h2>{t('intro.h')}</h2>
          <p>{t('intro.p')}</p>
          <p className="dim">{t('intro.scope')}</p>
        </section>

        <section id="problem" className="sec">
          <h2>{t('problem.h')}</h2>
          <p>{t('problem.p')}</p>
        </section>

        <section id="method" className="sec">
          <h2>{t('method.h')}</h2>
          <h3>{t('method.kin')}</h3>
          <p>{t('method.kin.p')}</p>
          <Eq block tex={String.raw`\mathrm{BPFO}=\tfrac{n}{2}f_r\!\left(1-\tfrac{d}{D}\cos\varphi\right),\quad \mathrm{BPFI}=\tfrac{n}{2}f_r\!\left(1+\tfrac{d}{D}\cos\varphi\right)`} />
          <Eq block tex={String.raw`\mathrm{BSF}=\tfrac{D}{2d}f_r\!\left(1-\left(\tfrac{d}{D}\cos\varphi\right)^2\right),\quad \mathrm{FTF}=\tfrac{1}{2}f_r\!\left(1-\tfrac{d}{D}\cos\varphi\right)`} />
          <h3>{t('method.env')}</h3>
          <p>{t('method.env.p')}</p>
          <Eq block tex={String.raw`z(t)=x_b(t)+i\,\mathcal{H}\{x_b\}(t),\qquad e(t)=|z(t)|,\qquad E(f)=\big|\mathcal{F}\{e-\bar e\}\big|`} />
          <h3>{t('method.dx')}</h3>
          <p>{t('method.dx.p')}</p>
          <Eq block tex={String.raw`S_{\text{fault}}=\frac{1}{5\,\hat n_0}\sum_{k=1}^{5}\max_{|f-k f_{\text{fault}}|<\tau} E(f)`} />
        </section>

        <section id="impl" className="sec">
          <h2>{t('impl.h')}</h2>
          <p>{t('impl.p')}</p>
          <pre className="pipe">{t('impl.pipe')}</pre>
        </section>

        <section id="exp" className="sec">
          <h2>{t('exp.h')}</h2>
          <p>{t('exp.p')}</p>
          <p className="dim">{t('exp.note')}</p>
        </section>

        <section id="app" className="sec">
          <h2>{t('live.h')}</h2>

          <div className="scenarios">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                className={`chip ${fault === s.fault ? 'on' : ''}`}
                onClick={() => {
                  setFault(s.fault);
                  setSeverity(s.spec.severity || 1);
                  setRpm(s.spec.rpm);
                  setSnr(s.spec.snrDb);
                }}
              >
                {t(`fault.${s.fault}`)}
              </button>
            ))}
          </div>

          <div className="controls">
            <label>
              {t('live.bearing')}
              <select value={bearingId} onChange={(e) => setBearingId(e.target.value)}>
                {BEARINGS.map((b) => (
                  <option key={b.id} value={b.id}>{b.label}</option>
                ))}
              </select>
            </label>
            <label>
              {t('live.fault')}
              <select value={fault} onChange={(e) => setFault(e.target.value as FaultKind)}>
                {FAULTS.map((k) => (
                  <option key={k} value={k}>{t(`fault.${k}`)}</option>
                ))}
              </select>
            </label>
            <label>
              {t('live.severity')}: {severity.toFixed(2)}
              <input type="range" min={0} max={1.5} step={0.05} value={severity} disabled={fault === 'healthy'} onChange={(e) => setSeverity(+e.target.value)} />
            </label>
            <label>
              {t('live.rpm')}: {rpm}
              <input type="range" min={600} max={3600} step={1} value={rpm} onChange={(e) => setRpm(+e.target.value)} />
            </label>
            <label>
              {t('live.snr')}: {snr}
              <input type="range" min={-8} max={12} step={1} value={snr} onChange={(e) => setSnr(+e.target.value)} />
            </label>
          </div>

          <div className="diag" data-fault={dx.top}>
            <div className="diag-main">
              <span className="diag-label">{t('live.diag')}</span>
              <strong>{t(`fault.${dx.top}`)}</strong>
              <span className="diag-conf">{(dx.confidence * 100).toFixed(0)}% {t('live.confidence')}</span>
            </div>
            <div className="diag-bars">
              {dx.scores.map((s) => (
                <div key={s.kind} className="bar-row">
                  <span>{t(`fault.${s.kind}`)}</span>
                  <div className="bar"><i style={{ width: `${Math.min(100, (s.score / (dx.scores[0].score || 1)) * 100)}%` }} /></div>
                  <span className="num">{s.score.toFixed(1)}×</span>
                </div>
              ))}
            </div>
          </div>

          <div className="plot-block">
            <div className="plot-title">{t('live.signal')} <span className="dim">· {t('live.amp')} / {t('live.time')}</span></div>
            <Plot xs={sig.t} ys={sig.x} xmax={0.08} color="#58a6ff" xlabel={t('live.time')} />
          </div>
          <div className="plot-block">
            <div className="plot-title">{t('live.spectrum')} <span className="dim">· {t('live.freq')}</span></div>
            <Plot xs={raw.freq} ys={raw.mag} xmax={6000} color="#8b949e" xlabel="Hz" />
          </div>
          <div className="plot-block">
            <div className="plot-title">{t('live.envspectrum')} <span className="dim">· {t('live.freq')}</span></div>
            <Plot xs={env.freq} ys={env.mag} xmax={Math.min(700, 8 * f.bpfo)} markers={envMarkers} color="#3fb950" xlabel="Hz" />
          </div>

          <div className="freqs">
            <div className="plot-title">{t('live.freqs')} <span className="dim">(f_r = {(rpm / 60).toFixed(1)} Hz)</span></div>
            <table>
              <tbody>
                <tr><td>FTF</td><td>{f.ftf.toFixed(1)} Hz</td><td style={{ color: C.outer }}>BPFO</td><td>{f.bpfo.toFixed(1)} Hz</td></tr>
                <tr><td style={{ color: C.inner }}>BPFI</td><td>{f.bpfi.toFixed(1)} Hz</td><td style={{ color: C.ball }}>2·BSF</td><td>{(2 * f.bsf).toFixed(1)} Hz</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="ftr">
        <div className="wrap">
          <a href="https://faena.fasl-work.com">{t('hub.back')}</a> · <a href="https://fasl-work.com" target="_blank" rel="noopener">fasl-work.com</a> · © Felipe Santibáñez-Leal
        </div>
      </footer>
    </>
  );
}
