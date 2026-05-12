import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.database import engine, Base
from backend.router_upload import router as upload_router
from backend.router_search import router as search_router
from backend.router_cluster import router as cluster_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Image Memory Search", version="0.1.0")

# Comma-separated list of allowed origins. Defaults to the local dev frontend;
# set PIXELMEM_CORS_ORIGINS to the Railway frontend URL in production.
_origins_env = os.environ.get("PIXELMEM_CORS_ORIGINS", "http://localhost:3000")
allow_origins = [o.strip() for o in _origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_router)
app.include_router(search_router)
app.include_router(cluster_router)


@app.get("/health")
def health():
    return {"status": "ok"}