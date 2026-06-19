import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// viridis-ish 5-stop ramp (perceptually-uniform-ish; avoids the jet trap)
function viridis(t: number): [number, number, number] {
  const s = [[0.27, 0.0, 0.33], [0.23, 0.32, 0.55], [0.13, 0.57, 0.55], [0.37, 0.79, 0.38], [0.99, 0.91, 0.14]];
  t = Math.max(0, Math.min(1, t));
  const x = t * 4, i = Math.min(3, Math.floor(x)), f = x - i;
  const a = s[i], b = s[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

const Y_SCALE = 0.9;

/** Run-to-failure spectral waterfall: rows = life snapshots (time), cols = frequency, height =
 * amplitude. A genuinely 3D/joint view — you watch the fault ridge emerge and grow over life.
 * `grid[time][freq]`, normalized 0..1. Orbit to rotate; hover reads (freq, life, amplitude); the
 * active defect frequency is marked with a translucent ridge plane. */
export function Waterfall3D({
  grid, height = 320, fmax = 600, ridgeHz = 0, ridgeLabel = '', lifeH = 100,
}: {
  grid: number[][]; height?: number; fmax?: number; ridgeHz?: number; ridgeLabel?: string; lifeH?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const readRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el || !grid.length) return;
    const rows = grid.length, cols = grid[0].length;
    const W = el.clientWidth || 640, H = height;
    const cssv = getComputedStyle(document.documentElement);
    const bg = cssv.getPropertyValue('--color-bg').trim() || '#0d1117';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(bg);
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
    camera.position.set(1.9, 1.6, 2.3);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(W, H);
    el.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8); dir.position.set(2, 4, 3); scene.add(dir);

    // surface geometry (rows×cols vertices)
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(rows * cols * 3);
    const col = new Float32Array(rows * cols * 3);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = (r * cols + c) * 3;
        const v = grid[r][c];
        pos[idx] = (c / (cols - 1)) * 2 - 1;     // x = frequency
        pos[idx + 1] = v * Y_SCALE;              // y = amplitude
        pos[idx + 2] = (r / (rows - 1)) * 2 - 1; // z = time/life
        const [cr, cg, cb] = viridis(v);
        col[idx] = cr; col[idx + 1] = cg; col[idx + 2] = cb;
      }
    }
    const indices: number[] = [];
    for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85, metalness: 0.0 }));
    scene.add(mesh);
    scene.add(new THREE.LineSegments(new THREE.WireframeGeometry(geom), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.08 })));

    // ground grid for spatial reference (the floor under the surface)
    const gridH = new THREE.GridHelper(2, 10, 0x586070, 0x586070);
    (gridH.material as THREE.Material).opacity = 0.18; (gridH.material as THREE.Material).transparent = true;
    scene.add(gridH);

    // ridge plane at the active defect frequency (where the fault energy lives)
    if (ridgeHz > 0 && ridgeHz <= fmax) {
      const rx = (ridgeHz / fmax) * 2 - 1;
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(2, Y_SCALE),
        new THREE.MeshBasicMaterial({ color: 0xf59f00, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
      );
      plane.rotation.y = Math.PI / 2; plane.position.set(rx, Y_SCALE / 2, 0);
      scene.add(plane);
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.autoRotate = true; controls.autoRotateSpeed = 0.6;

    // hover → raycast the surface → read (freq, life, amplitude)
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let hovering = false;
    const onMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObject(mesh)[0];
      const rd = readRef.current; if (!rd) return;
      if (hit) {
        hovering = true;
        const freq = ((hit.point.x + 1) / 2) * fmax;
        const life = ((hit.point.z + 1) / 2) * lifeH;
        const amp = Math.max(0, Math.min(1, hit.point.y / Y_SCALE));
        rd.style.display = 'block';
        rd.textContent = `${freq.toFixed(0)} Hz · life ${life.toFixed(0)} h · amp ${amp.toFixed(2)}`;
      } else if (hovering) { hovering = false; rd.style.display = 'none'; }
    };
    renderer.domElement.addEventListener('pointermove', onMove);

    let raf = 0;
    const loop = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); };
    loop();
    const ro = new ResizeObserver(() => { const w = el.clientWidth || W; camera.aspect = w / H; camera.updateProjectionMatrix(); renderer.setSize(w, H); });
    ro.observe(el);
    const stopAuto = () => { controls.autoRotate = false; };
    renderer.domElement.addEventListener('pointerdown', stopAuto);

    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', stopAuto);
      renderer.domElement.removeEventListener('pointermove', onMove);
      controls.dispose(); geom.dispose(); (mesh.material as THREE.Material).dispose(); renderer.dispose();
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
    };
  }, [grid, height, fmax, ridgeHz, ridgeLabel, lifeH]);

  return (
    <div className="wf3d-wrap" style={{ position: 'relative', width: '100%', height }}>
      <div ref={ref} style={{ width: '100%', height }} />
      <div ref={readRef} className="wf3d-readout" style={{ display: 'none' }} />
      <div className="wf3d-axes">
        <span><b>x</b> = frequency 0–{fmax} Hz</span>
        <span><b>z</b> = life 0–{lifeH.toFixed(0)} h</span>
        <span><b>height</b> = envelope amplitude (0–1)</span>
        {ridgeHz > 0 && <span className="wf3d-ridge">▮ {ridgeLabel} @ {ridgeHz.toFixed(0)} Hz</span>}
      </div>
    </div>
  );
}
