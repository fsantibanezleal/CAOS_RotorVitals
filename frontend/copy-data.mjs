// Prebuild overlay: copy the committed CONTRACT-2 artifacts (../data/derived) into the SPA's public/ so the static
// site serves them, and refresh the bundled benchmark JSON. Canonical copies live in ../data/derived — public/ is a
// build-time overlay (git-ignored). The served paths match what frontend/src/lib/ort.ts + dsp/learned.ts fetch
// (root: /wdcnn.onnx, /rv-ae.onnx, /rv-cwru-samples.json, /rv-learned-metrics.json); manifests + per-case traces go
// under /data/ for the CONTRACT-2 index loader (api/artifacts.ts).
import { copyFileSync, cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DERIVED = join(ROOT, 'data', 'derived');
const PUB = join(HERE, 'public');

if (!existsSync(DERIVED)) {
  console.warn('[copy-data] no data/derived — run scripts/precompute first');
  process.exit(0);
}
mkdirSync(PUB, { recursive: true });

// 1) the live-lane artifacts the SPA fetches from the site root (paths frozen in ort.ts + learned.ts)
const rootArtifacts = [
  ['models/wdcnn.onnx', 'wdcnn.onnx'],
  ['models/rv-ae.onnx', 'rv-ae.onnx'],
  ['rv-cwru-samples.json', 'rv-cwru-samples.json'],
  ['rv-learned-metrics.json', 'rv-learned-metrics.json'],
];
for (const [src, dst] of rootArtifacts) {
  const from = join(DERIVED, src);
  if (existsSync(from)) {
    copyFileSync(from, join(PUB, dst));
  } else {
    console.warn(`[copy-data] missing ${src} — run scripts/precompute (or --retrain)`);
  }
}

// 2) keep the bundled benchmark (imported by the Benchmark/Experiments pages) in lock-step with the canonical one
const bench = join(DERIVED, 'cwru-benchmark.json');
if (existsSync(bench)) copyFileSync(bench, join(ROOT, 'frontend', 'src', 'data', 'cwru-benchmark.json'));

// 3) the CONTRACT-2 manifests + per-case traces -> public/data (the index loader reads /data/manifests/index.json)
mkdirSync(join(PUB, 'data'), { recursive: true });
cpSync(DERIVED, join(PUB, 'data'), {
  recursive: true,
  filter: (s) => !s.includes(`${join('derived', 'models')}`), // models already overlaid at root; skip the dup
});
console.log('[copy-data] data/derived -> public/ (root artifacts + /data manifests+traces) OK');
