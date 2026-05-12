# Deploying PixelMem to Railway

Two services, one repo: a Python/FastAPI backend (CLIP + FAISS) and a Next.js
frontend. The frontend proxies `/api/*` to the backend, so the only public URL
your users hit is the frontend's.

## Local Docker smoke-test (recommended before pushing to Railway)

From the repo root:

```bash
# Backend
docker build -t pixelmem-backend -f Dockerfile .
docker run --rm -p 8000:8000 -v "$(pwd)/backend/storage:/app/backend/storage" pixelmem-backend

# Frontend (in a second terminal)
docker build -t pixelmem-frontend -f frontend/Dockerfile frontend
docker run --rm -p 3000:3000 -e PIXELMEM_BACKEND_URL=http://host.docker.internal:8000 pixelmem-frontend
```

Open <http://localhost:3000>. If uploads + search work, you're good to deploy.

## Railway setup

You need **two services** in one Railway project, both pointed at this repo.

### 1. Backend service

- **New Service → Deploy from GitHub** → pick this repo
- **Settings → Build**:
  - Builder: `Dockerfile`
  - Dockerfile path: `Dockerfile`
  - Root directory: leave blank (repo root)
- **Settings → Volumes**: attach a volume mounted at `/app/backend/storage`
  (size: 1–2 GB is fine for a demo). Without this, every redeploy wipes the
  database, FAISS index, and uploaded images.
- **Variables**:
  - `PIXELMEM_CORS_ORIGINS` = your frontend's public Railway URL
    (set this *after* the frontend is deployed; redeploy backend once you have it)
  - Optional: `PIXELMEM_INDEX_KIND=hnsw` once your corpus is large enough to
    benefit (see `scripts/ab_compare.py`)
- **Networking**: generate a public domain. Note the URL — the frontend needs it.

The first build downloads the CLIP weights (~600 MB) inside the image, so the
build is slow but the first request after deploy is fast.

### 2. Frontend service

- **New Service → Deploy from GitHub** → same repo
- **Settings → Build**:
  - Builder: `Dockerfile`
  - Dockerfile path: `frontend/Dockerfile`
  - Root directory: `frontend`
- **Variables**:
  - `PIXELMEM_BACKEND_URL` = the backend's public Railway URL (e.g.
    `https://pixelmem-backend-production.up.railway.app`)
  - On Railway, set this as a **build-time variable** too (Variables → "Add
    Build Variable"). Next.js bakes the rewrite destination into the build
    output, so a runtime-only env var won't take effect.
- **Networking**: generate a public domain. This is the URL you share.

After both are up, set `PIXELMEM_CORS_ORIGINS` on the backend to the
frontend's domain and redeploy the backend.

## Resource notes

- The backend image is ~2 GB (PyTorch CPU + CLIP weights). Railway charges for
  egress on image pulls and for RAM/CPU minutes — budget ~$5/mo at idle, more
  under traffic.
- CLIP needs ~1.5 GB RAM resident. Railway's default 512 MB plan will OOM;
  set the backend service's memory limit to at least 2 GB.
- Cold starts: with the model cached in the image, the backend is ready in
  ~5–10 s after a container boot. The frontend is essentially instant.

## Troubleshooting

- **Frontend loads but uploads return CORS error** → `PIXELMEM_CORS_ORIGINS`
  on the backend doesn't match the frontend's exact origin (scheme + host, no
  trailing slash).
- **Search returns 500 / "Vector not found"** → the volume was wiped or the
  FAISS index and SQLite DB diverged. Easiest fix: shell into the backend
  service and delete `backend/storage/pixelmem.db`, `backend/storage/faiss.index`,
  and `backend/storage/faiss_ids.npy` together, then re-upload.
- **Frontend can't reach backend** → check `PIXELMEM_BACKEND_URL` includes the
  `https://` scheme and no trailing slash.
