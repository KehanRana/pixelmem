import json
from pathlib import Path

import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from sklearn.cluster import KMeans
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Image, EmbeddingStatus
from backend.router_upload import index_manager

router = APIRouter(prefix="/api", tags=["clusters"])

CLUSTER_CACHE_PATH = Path("backend/storage/cluster_cache.json")


def _build_clusters(n_clusters: int, db: Session) -> list[dict]:
    """
    Pull all indexed vectors, run KMeans, return cluster assignments.
    Each cluster includes all member image IDs and a representative
    (the member closest to the centroid).
    """
    # Gather all image IDs that are in the index
    ready_images = (
        db.query(Image)
        .filter(Image.embedding_status == EmbeddingStatus.ready)
        .all()
    )

    if len(ready_images) < n_clusters:
        raise ValueError(
            f"Not enough indexed images ({len(ready_images)}) "
            f"for {n_clusters} clusters"
        )

    # Build matrix of vectors in the same order as ready_images
    vectors = []
    valid_images = []
    for img in ready_images:
        vec = index_manager.get_vector(img.id)
        if vec is not None:
            vectors.append(vec)
            valid_images.append(img)

    if len(valid_images) < n_clusters:
        raise ValueError("Too few vectors retrieved from index")

    X = np.stack(vectors, axis=0)  # shape: (N, 512)

    # Run KMeans
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init="auto")
    labels = kmeans.fit_predict(X)
    centroids = kmeans.cluster_centers_  # shape: (n_clusters, 512)

    # Group images by cluster label
    cluster_members: dict[int, list] = {i: [] for i in range(n_clusters)}
    for img, label in zip(valid_images, labels):
        cluster_members[int(label)].append(img)

    # For each cluster, find the member closest to the centroid
    clusters = []
    for cluster_id in range(n_clusters):
        members = cluster_members[cluster_id]
        if not members:
            continue

        centroid = centroids[cluster_id]
        best_img = None
        best_score = -1.0

        for img in members:
            vec = index_manager.get_vector(img.id)
            if vec is None:
                continue
            # Cosine similarity: dot product of L2-normalised vectors
            score = float(np.dot(vec, centroid / (np.linalg.norm(centroid) + 1e-8)))
            if score > best_score:
                best_score = score
                best_img = img

        clusters.append({
            "cluster_id": cluster_id,
            "size": len(members),
            "representative": {
                "id": best_img.id,
                "filename": best_img.filename,
                "thumbnail_url": f"/api/thumbnails/{best_img.id}",
            } if best_img else None,
            "members": [
                {
                    "id": img.id,
                    "filename": img.filename,
                    "thumbnail_url": f"/api/thumbnails/{img.id}",
                }
                for img in members
            ],
        })

    # Sort largest cluster first
    clusters.sort(key=lambda c: c["size"], reverse=True)
    return clusters


@router.post("/clusters")
def generate_clusters(
    n: int = 12,
    force: bool = False,
    db: Session = Depends(get_db),
):
    """
    Generate or return cached visual clusters.

    - n: number of clusters (default 12)
    - force: if true, recompute even if cache exists

    Clusters are cached to disk. Pass ?force=true after adding
    new images to refresh.
    """
    ready_count = (
        db.query(Image)
        .filter(Image.embedding_status == EmbeddingStatus.ready)
        .count()
    )

    if ready_count == 0:
        raise HTTPException(
            status_code=400,
            detail="No indexed images yet. Upload and wait for embedding to complete."
        )

    if ready_count < n:
        # Auto-reduce cluster count to what we have
        n = max(2, ready_count // 2)

    # Return cache if valid and not forcing refresh
    if not force and CLUSTER_CACHE_PATH.exists():
        try:
            cached = json.loads(CLUSTER_CACHE_PATH.read_text())
            if cached.get("n_clusters") == n and cached.get("image_count") == ready_count:
                return cached
        except Exception:
            pass  # Cache corrupt — recompute

    try:
        clusters = _build_clusters(n_clusters=n, db=db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    response = {
        "n_clusters": n,
        "image_count": ready_count,
        "clusters": clusters,
    }

    # Write cache
    CLUSTER_CACHE_PATH.write_text(json.dumps(response))
    return response


@router.get("/status")
def system_status(db: Session = Depends(get_db)):
    """
    Overall system health — total images, how many are indexed, how many failed.
    Used by the upload UI to show live progress.
    """
    from backend.models import EmbeddingStatus as ES

    total = db.query(Image).count()
    ready = db.query(Image).filter(Image.embedding_status == ES.ready).count()
    processing = db.query(Image).filter(Image.embedding_status == ES.processing).count()
    pending = db.query(Image).filter(Image.embedding_status == ES.pending).count()
    failed = db.query(Image).filter(Image.embedding_status == ES.failed).count()

    return {
        "total": total,
        "indexed": ready,
        "processing": processing,
        "pending": pending,
        "failed": failed,
        "index_size": index_manager.index.ntotal,
    }