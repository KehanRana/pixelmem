from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Image, EmbeddingStatus
from backend.router_upload import embedding_service, index_manager

router = APIRouter(prefix="/api", tags=["search"])


@router.get("/search/text")
def search_by_text(
    q: str,
    k: int = 20,
    db: Session = Depends(get_db),
):
    """
    Free-text search using CLIP's joint text/image embedding space.
    Returns the k images whose visual embedding is closest to the
    text query.
    """
    q = (q or "").strip()
    if not q:
        raise HTTPException(status_code=400, detail="Query string 'q' is required")

    try:
        vector = embedding_service.embed_text(q)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    raw_results = index_manager.search(vector, k=k)

    result_ids = [r["image_id"] for r in raw_results]
    score_map = {r["image_id"]: r["score"] for r in raw_results}

    db_images = db.query(Image).filter(Image.id.in_(result_ids)).all()
    image_map = {img.id: img for img in db_images}

    results = []
    for img_id in result_ids:
        img = image_map.get(img_id)
        if not img:
            continue
        results.append({
            "id": img.id,
            "filename": img.filename,
            "width": img.width,
            "height": img.height,
            "similarity_score": round(score_map[img_id], 4),
            "thumbnail_url": f"/api/thumbnails/{img.id}",
            "original_url": f"/api/images/{img.id}/original",
        })

    return {
        "query": q,
        "total_results": len(results),
        "results": results,
    }


@router.get("/search/{image_id}")
def search_similar(
    image_id: str,
    k: int = 20,
    db: Session = Depends(get_db),
):
    """
    Given an image_id, return the k most visually similar images.

    Flow:
      1. Confirm image exists and is indexed
      2. Retrieve its stored vector from FAISS
      3. Run nearest-neighbour search
      4. Hydrate results with metadata from SQLite
    """
    # --- Confirm the query image exists ---
    query_image = db.query(Image).filter(Image.id == image_id).first()
    if not query_image:
        raise HTTPException(status_code=404, detail="Image not found")

    if query_image.embedding_status != EmbeddingStatus.ready:
        raise HTTPException(
            status_code=409,
            detail=f"Image is not yet indexed (status: {query_image.embedding_status})"
        )

    # --- Retrieve the stored vector ---
    vector = index_manager.get_vector(image_id)
    if vector is None:
        raise HTTPException(
            status_code=500,
            detail="Vector not found in index despite ready status"
        )

    # --- Run similarity search ---
    raw_results = index_manager.search(vector, k=k)

    # Filter out the query image itself from results
    raw_results = [r for r in raw_results if r["image_id"] != image_id]

    # --- Hydrate with metadata ---
    result_ids = [r["image_id"] for r in raw_results]
    score_map = {r["image_id"]: r["score"] for r in raw_results}

    db_images = (
        db.query(Image)
        .filter(Image.id.in_(result_ids))
        .all()
    )

    # Build a lookup so we can preserve FAISS rank order
    image_map = {img.id: img for img in db_images}

    results = []
    for img_id in result_ids:
        img = image_map.get(img_id)
        if not img:
            continue
        results.append({
            "id": img.id,
            "filename": img.filename,
            "width": img.width,
            "height": img.height,
            "similarity_score": round(score_map[img_id], 4),
            "thumbnail_url": f"/api/thumbnails/{img.id}",
            "original_url": f"/api/images/{img.id}/original",
        })

    return {
        "query_image_id": image_id,
        "query_thumbnail_url": f"/api/thumbnails/{image_id}",
        "total_results": len(results),
        "results": results,
    }


@router.get("/images/{image_id}")
def get_image_detail(image_id: str, db: Session = Depends(get_db)):
    """
    Return full metadata for a single image.
    Used by the frontend to populate the left panel.
    """
    image = db.query(Image).filter(Image.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    return {
        "id": image.id,
        "filename": image.filename,
        "width": image.width,
        "height": image.height,
        "file_size_bytes": image.file_size_bytes,
        "embedding_status": image.embedding_status,
        "thumbnail_url": f"/api/thumbnails/{image.id}",
        "original_url": f"/api/images/{image.id}/original",
        "created_at": image.created_at.isoformat(),
    }