# PixelMem

**Search your photos by what's in them.** Upload images and find them again later by visual similarity ("more like this one") or by typing what you want ("a red car at night"). PixelMem turns every photo into a 512-dim CLIP embedding, indexes them in FAISS, and serves nearest-neighbour search and KMeans clustering through a Next.js frontend.

**Live demo:** <https://frontend-production-1888.up.railway.app>

<!-- TODO: drop a screenshot or short gif here. The explorer page with a few clusters of real photos is the best visual. -->

## What it does

- **Visual similarity search** — click any image, get its 20 nearest neighbours in CLIP space, ranked by cosine similarity.
- **Text → image search** — type a natural-language query; CLIP's joint text/image embedding space returns photos that match it (no captions, no tags, just semantics).
- **KMeans clustering** — auto-groups your library into themes and picks a representative image per cluster.
- **Background embedding** — uploads return immediately; CLIP runs in a FastAPI background task so the UI stays responsive.

## Stack

| Layer | Tech |
|---|---|
| Embeddings | CLIP ViT-B/32 (PyTorch + transformers), CPU |
| Vector search | FAISS (`IndexFlatIP` default, `IndexHNSWFlat` behind a config flag) |
| Clustering | scikit-learn KMeans, representative = member with max cosine to centroid |
| API | FastAPI, SQLAlchemy, SQLite |
| Frontend | Next.js 16, React 19, Tailwind v4 |
| Deploy | Docker, Railway (backend + frontend as separate services) |

## What was interesting to build

- **Same embedding space for text and image queries.** CLIP projects both modalities into the same 512-dim space, so text→image search is the same FAISS lookup with a different query vector — no separate index, no retraining. ~60 lines of code on top of what was already there for image-image search.
- **Measured before optimizing.** Before swapping `IndexFlatIP` for HNSW, I built an A/B harness (`testing/ab_comparison/ab_compare.py`) that reconstructs all vectors from the live index, builds both kinds in memory, and sweeps `efSearch` while treating Flat's top-k as ground truth. The result: at the current corpus size HNSW is slower than Flat (graph overhead exceeds the brute-force cost) at 99% recall@20, so HNSW stays behind a `PIXELMEM_INDEX_KIND` env var until the corpus crosses the crossover point.
- **Storage subdirs at runtime, not build time.** Railway's persistent volume mount overlays an empty filesystem on the path it mounts at — which silently wipes the `images/` and `thumbnails/` directories the Docker image had created. The fix is one-liner in `backend/main.py`'s startup. A good reminder that Dockerfile `RUN mkdir` only survives until the volume mounts.

## Architecture

```
   ┌────────────┐       ┌─────────────────┐       ┌───────────────────┐
   │  Browser   │ HTTP  │  Next.js (Node) │  HTTP │  FastAPI (Python) │
   │  /upload   ├──────►│  rewrites /api/*├──────►│  CLIP + FAISS     │
   │  /explorer │       │  → backend URL  │       │  SQLite metadata  │
   │  /clusters │       └─────────────────┘       └─────────┬─────────┘
   └────────────┘                                           │
                                                            ▼
                                              backend/storage/
                                                ├─ images/         (originals)
                                                ├─ thumbnails/     (300px JPEGs)
                                                ├─ pixelmem.db     (metadata)
                                                ├─ faiss.index     (vectors)
                                                └─ faiss_ids.npy   (UUID map)
```

**Key design choices:**

- **Vectors are L2-normalised** before being added to FAISS, so the `IndexFlatIP` (inner-product) score equals cosine similarity directly — no cosine recomputation on query.
- **One singleton `EmbeddingService` and `IndexManager`** in `backend/router_upload.py`. Other routers import these symbols rather than instantiating their own — there is exactly one CLIP model in memory and one FAISS index, ever.
- **FAISS is persisted per-`add`.** Fine at the scale a portfolio demo sees; flagged as the obvious bottleneck for bulk imports in `CLAUDE.md`.

## Running locally

```bash
# Backend (http://localhost:8000)
source venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```

```bash
# Frontend (http://localhost:3000)
cd frontend
npm install
cp .env.local.example .env.local   # points at localhost:8000 by default
npm run dev
```

First backend boot downloads the CLIP weights (~600 MB) — expect a few seconds before the server is ready.

## Running with Docker

```bash
docker build -t pixelmem-backend .
docker run --rm -p 8000:8000 -v "$(pwd)/backend/storage:/app/backend/storage" \
  --memory=2g pixelmem-backend

docker build --build-arg PIXELMEM_BACKEND_URL=http://host.docker.internal:8000 \
  -t pixelmem-frontend -f frontend/Dockerfile frontend
docker run --rm -p 3000:3000 pixelmem-frontend
```

`PIXELMEM_BACKEND_URL` is a Next.js *build-time* variable because `rewrites()` destinations are baked into the build output — runtime env doesn't take effect.

## Deploying

See [`DEPLOY.md`](./DEPLOY.md) for the Railway walkthrough (two services, one volume, the build-vs-runtime variable gotcha).

## Benchmarks

Two scripts live in `testing/`:

- **`testing/benchmarking/benchmark.py`** — CLIP embedding throughput on real images plus FAISS search latency for Flat vs HNSW vs IVF across configurable corpus sizes.
- **`testing/ab_comparison/ab_compare.py`** — Flat vs HNSW on the actual indexed vectors, sweeps `efSearch`, reports recall@k against Flat's top-k.

Numbers at meaningful scale (10k+ images) are coming once the demo library grows.

## Configuration

All non-secret config lives in environment variables. Copy `.env.example` to `.env` for local Docker, or set them in Railway's dashboard in production.

| Variable | Default | Purpose |
|---|---|---|
| `PIXELMEM_CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |
| `PIXELMEM_INDEX_KIND` | `flat` | `flat` or `hnsw` — switch requires deleting `faiss.index` + `faiss_ids.npy` |
| `PIXELMEM_HNSW_M` | `32` | HNSW graph degree |
| `PIXELMEM_HNSW_EF_CONSTRUCTION` | `80` | Build-time exploration factor |
| `PIXELMEM_HNSW_EF_SEARCH` | `64` | Query-time exploration factor (recall/latency knob) |
| `PIXELMEM_BACKEND_URL` | `http://localhost:8000` | Frontend → backend URL (build-time on Docker, runtime on `next dev`) |
