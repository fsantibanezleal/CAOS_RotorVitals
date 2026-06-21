# 07 — Deploy (GitHub Pages, static deterministic-replay)

RotorVitals is static-first (no backend at request time). `.github/workflows/deploy-pages.yml` on push to `main`:

1. installs the **light** lane (`requirements.txt` + editable pkg, numpy-only — no torch) and runs
   `python -m rotorlab.pipeline all` to regenerate the per-case traces + manifests from the committed artifacts;
2. builds the SPA (`cd frontend && npm ci && npm run build`; `copy-data.mjs` overlays `data/derived` into
   `public/`);
3. uploads `frontend/dist` and deploys to Pages.

CI does **not** retrain (the committed ONNX/metrics are the heavy lane's real outputs; retraining needs torch +
the CWRU download and is local-only).

## Custom domain

Live at **rotorvitals.fasl-work.com** (custom domain → Vite `base: '/'`; `frontend/public/CNAME` carries it, which
Vite copies into `dist/`). The domain is set once on the Pages API:
`gh api PUT repos/fsantibanezleal/CAOS_RotorVitals/pages -f cname=rotorvitals.fasl-work.com` (the CNAME file alone
does not set the domain on Actions deploys). A SPA 404-fallback (`vite.config.ts` copies `index.html` → `404.html`)
makes deep links / refreshes resolve through the React router on Pages.

## The dormant VPS path

`deploy/{fasl-slug.service, domain.nginx}` are dormant systemd/nginx templates, used only if `app/` is ever
activated (an ADR-0002 trigger). This solution does not require them at the moment.
