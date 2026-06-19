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

/** Run-to-failure spectral waterfall: rows = life snapshots (time), cols = frequency, height =
 * amplitude. A genuinely 3D/joint view — you watch the BPFO ridge emerge and grow over life.
 * `grid[time][freq]`, normalized 0..1. Orbit to rotate; renders on demand. */
export function Waterfall3D({ grid, height = 320 }: { grid: number[][]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el || !grid.length) return;
    const rows = grid.length, cols = grid[0].length;
    const W = el.clientWidth || 640, H = height;
    const css = getComputedStyle(document.documentElement);
    const bg = css.getPropertyValue('--color-bg').trim() || '#0d1117';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(bg);
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
    camera.position.set(1.7, 1.5, 2.2);
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
    const yScale = 0.9;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = (r * cols + c) * 3;
        const v = grid[r][c];
        pos[idx] = (c / (cols - 1)) * 2 - 1;     // x = frequency
        pos[idx + 1] = v * yScale;               // y = amplitude
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
    const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85, metalness: 0.0, flatShading: false }));
    scene.add(mesh);
    // wireframe overlay for legibility
    scene.add(new THREE.LineSegments(new THREE.WireframeGeometry(geom), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.08 })));

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.autoRotate = true; controls.autoRotateSpeed = 0.6;
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
      controls.dispose(); geom.dispose(); (mesh.material as THREE.Material).dispose(); renderer.dispose();
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
    };
  }, [grid, height]);
  return <div ref={ref} style={{ width: '100%', height }} />;
}
