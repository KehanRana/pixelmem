from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.database import engine, Base
from backend.router_upload import router as upload_router
from backend.router_search import router as search_router
from backend.router_cluster import router as cluster_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Image Memory Search", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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