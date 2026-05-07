# PixelMem

An image memory and visual search service. Upload images, and the backend generates CLIP embeddings, indexes them in FAISS, and serves similarity search and KMeans clustering through a Next.js frontend.

## Stack

- **Backend**: FastAPI, SQLAlchemy, SQLite, Pillow, PyTorch + CLIP, FAISS, scikit-learn.
- **Frontend**: Next.js 16, React 19, Tailwind v4.

## Running locally

Run both from the repo root, in separate terminals.

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
npm run dev
```

The first backend boot downloads the CLIP weights, so expect a short delay before the server is ready.

## Layout

- `backend/` FastAPI app, embedding service, FAISS index manager, route modules.
- `frontend/` Next.js app, with upload, explorer, and clusters pages.
- `backend/storage/` runtime data (SQLite DB, FAISS index, uploaded images, thumbnails). Gitignored.
