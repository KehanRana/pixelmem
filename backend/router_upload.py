import os
import uuid
from pathlib import Path
from typing import List

from fastapi import APIRouter, BackgroundTasks, UploadFile, File, Depends, HTTPException
from fastapi.responses import FileResponse
from PIL import Image as PILImage
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.embedding_service import EmbeddingService
from backend.index_manager import IndexManager
from backend.models import Image, EmbeddingStatus

router = APIRouter(prefix="/api", tags=["upload"])

IMAGES_DIR = Path("backend/storage/images")
THUMBNAILS_DIR = Path("backend/storage/thumbnails")
ALLOWED_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
THUMBNAIL_SIZE = (300, 300)

# Loaded once at module import — not per request
embedding_service = EmbeddingService()
index_manager = IndexManager()


def save_thumbnail(original_path: Path, thumbnail_path: Path) -> None:
    with PILImage.open(original_path) as img:
        img.thumbnail(THUMBNAIL_SIZE, PILImage.LANCZOS)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        img.save(thumbnail_path, "JPEG", quality=85)


def embed_and_index(image_id: str, original_path: str) -> None:
    """
    Background task: generate embedding, add to FAISS, update DB status.
    Runs after the HTTP response has already been returned to the client.
    """
    from backend.database import SessionLocal  # local import avoids circular deps

    db = SessionLocal()
    try:
        # Mark as processing
        image = db.query(Image).filter(Image.id == image_id).first()
        if not image:
            return
        image.embedding_status = EmbeddingStatus.processing
        db.commit()

        # Generate embedding
        vector = embedding_service.embed(original_path)

        # Add to FAISS index
        index_manager.add(image_id, vector)

        # Mark as ready
        image.embedding_status = EmbeddingStatus.ready
        db.commit()
        print(f"[Worker] Embedded {image_id} successfully")

    except Exception as e:
        print(f"[Worker] Failed to embed {image_id}: {e}")
        try:
            image = db.query(Image).filter(Image.id == image_id).first()
            if image:
                image.embedding_status = EmbeddingStatus.failed
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


@router.post("/upload")
async def upload_images(
    files: List[UploadFile] = File(...),
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db)
):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    results = []
    errors = []

    for file in files:
        if file.content_type not in ALLOWED_TYPES:
            errors.append({"filename": file.filename, "error": f"Unsupported type: {file.content_type}"})
            continue

        image_id = str(uuid.uuid4())
        ext = Path(file.filename).suffix.lower() or ".jpg"
        original_filename = f"{image_id}{ext}"
        thumbnail_filename = f"{image_id}_thumb.jpg"

        original_path = IMAGES_DIR / original_filename
        thumbnail_path = THUMBNAILS_DIR / thumbnail_filename

        try:
            raw_bytes = await file.read()
            with open(original_path, "wb") as f:
                f.write(raw_bytes)

            with PILImage.open(original_path) as img:
                width, height = img.size

            save_thumbnail(original_path, thumbnail_path)

            db_image = Image(
                id=image_id,
                filename=file.filename,
                original_path=str(original_path),
                thumbnail_path=str(thumbnail_path),
                width=width,
                height=height,
                file_size_bytes=len(raw_bytes),
                embedding_status=EmbeddingStatus.pending,
            )
            db.add(db_image)
            db.commit()
            db.refresh(db_image)

            # Schedule embedding — runs after response is sent
            background_tasks.add_task(embed_and_index, image_id, str(original_path))

            results.append({
                "id": image_id,
                "filename": file.filename,
                "width": width,
                "height": height,
                "embedding_status": db_image.embedding_status,
                "thumbnail_url": f"/api/thumbnails/{image_id}",
            })

        except Exception as e:
            db.rollback()
            if original_path.exists():
                original_path.unlink()
            errors.append({"filename": file.filename, "error": str(e)})

    return {
        "uploaded": len(results),
        "failed": len(errors),
        "images": results,
        "errors": errors,
    }


@router.get("/thumbnails/{image_id}")
def serve_thumbnail(image_id: str, db: Session = Depends(get_db)):
    image = db.query(Image).filter(Image.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(image.thumbnail_path, media_type="image/jpeg")


@router.get("/images/{image_id}/original")
def serve_original(image_id: str, db: Session = Depends(get_db)):
    image = db.query(Image).filter(Image.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(image.original_path)


@router.get("/images")
def list_images(status: str = None, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(Image)
    if status:
        query = query.filter(Image.embedding_status == status)
    images = query.order_by(Image.created_at.desc()).limit(limit).all()
    return [
        {
            "id": img.id,
            "filename": img.filename,
            "width": img.width,
            "height": img.height,
            "embedding_status": img.embedding_status,
            "thumbnail_url": f"/api/thumbnails/{img.id}",
            "created_at": img.created_at.isoformat(),
        }
        for img in images
    ]