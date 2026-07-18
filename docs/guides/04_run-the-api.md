# 04, The `app/` backend (dormant)

RotorVitals is static deterministic-replay: the SPA + the committed artifacts serve from GitHub Pages with **no
backend at request time**. The `app/` FastAPI module ships dormant (it compiles; `requirements-api.txt` is
commented out) and this solution does not require it at the moment.

Activate only on an ADR-0002 trigger (server-side processing of uploaded recordings, auth-gated private data, or
paid heavy compute). Then: fill `requirements-api.txt`, implement the routes over `data-pipeline/rotorlab` (import
it, never re-implement), enable the `deploy/fasl-slug.service` + `deploy/domain.nginx` VPS templates, and add
CORS/COOP-COEP headers (which would also unlock threaded WASM for the live lane). See `app/README.md`.
