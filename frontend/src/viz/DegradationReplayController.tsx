import { useEffect, useRef } from 'react';

/** Master life-position scrubber for the degradation replay. Drives lifePos∈[0,1]; play/pause advances
 * it via requestAnimationFrame (a full sweep ≈ 8 s at 1×). Event ticks (onset / projected failure) sit
 * on the track; a readout shows life-hours, severity and the health indicator. Honors reduced-motion. */
export function DegradationReplayController({
  lifePos, setLifePos, lifeH, onsetH, failH, curSev, curHi, playing, setPlaying, speed, setSpeed, lang,
}: {
  lifePos: number; setLifePos: (f: number | ((p: number) => number)) => void; lifeH: number;
  onsetH: number | null; failH: number | null; curSev: number; curHi: number;
  playing: boolean; setPlaying: (b: boolean) => void; speed: number; setSpeed: (s: number) => void; lang: 'en' | 'es';
}) {
  const es = lang === 'es';
  const reduced = useRef(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches).current;
  const speedRef = useRef(speed); speedRef.current = speed;

  useEffect(() => {
    if (!playing || reduced) return;
    let raf = 0, last = 0;
    const tick = (ts: number) => {
      if (!last) last = ts; const dt = (ts - last) / 1000; last = ts;
      setLifePos((p) => Math.min(1, p + (speedRef.current * dt) / 8));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, reduced, setLifePos]);

  useEffect(() => { if (lifePos >= 1 && playing) setPlaying(false); }, [lifePos, playing, setPlaying]);

  const onsetFrac = onsetH != null && lifeH > 0 ? Math.max(0, Math.min(1, onsetH / lifeH)) : null;
  const failFrac = failH != null && lifeH > 0 ? Math.max(0, Math.min(1, failH / lifeH)) : null;
  const speeds = [0.5, 1, 2, 4];

  return (
    <div className="rv-replay">
      <button className="rv-play" onClick={() => setPlaying(!playing)} disabled={reduced} title={reduced ? (es ? 'movimiento reducido' : 'reduced motion') : ''}>{playing ? '⏸' : '▶'}</button>
      <div className="rv-replay-track">
        {onsetFrac != null && <span className="rv-tick onset" style={{ left: `${onsetFrac * 100}%` }} title={es ? `onset ${onsetH!.toFixed(0)} h` : `onset ${onsetH!.toFixed(0)} h`} />}
        {failFrac != null && <span className="rv-tick fail" style={{ left: `${failFrac * 100}%` }} title={es ? `falla ${failH!.toFixed(0)} h` : `failure ${failH!.toFixed(0)} h`} />}
        <input className="range rv-life" type="range" min={0} max={1} step={0.01} value={lifePos} onChange={(e) => { setPlaying(false); setLifePos(+e.target.value); }} />
      </div>
      <span className="rv-seg">{speeds.map((s) => <button key={s} className={`chip ${speed === s ? 'on' : ''}`} onClick={() => setSpeed(s)}>{s}×</button>)}</span>
      <span className="rv-replay-read mono">{(lifePos * lifeH).toFixed(0)} h · sev {curSev.toFixed(2)} · HI {curHi.toFixed(2)} g</span>
    </div>
  );
}
