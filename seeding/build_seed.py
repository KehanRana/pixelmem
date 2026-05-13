"""
Build a portable sample-dataset snapshot under seeding/seed_artifacts/.

Run this LOCALLY once (it needs CLIP + the HF datasets package), commit the
resulting artifacts directory, and the deployed app will copy it into
backend/storage/ on first boot — so Railway users see a populated library
without paying CLIP inference cost at startup.

    # From the repo root:
    python seeding/build_seed.py

    # Custom count / source dir (defaults: 50 COCO val images):
    PIXELMEM_SEED_COUNT=50 PIXELMEM_SEED_SOURCE=seeding/_raw_images \\
        python seeding/build_seed.py

Refuses to run if backend/storage already has a pixelmem.db or faiss.index —
move them aside first.
"""
import os
import shutil
import sys
import uuid
from pathlib import Path

from PIL import Image as PILImage

REPO = Path(__file__).resolve().parent.parent
os.chdir(REPO)
sys.path.insert(0, str(REPO))

STORAGE = REPO / "backend" / "storage"
ARTIFACTS = REPO / "seeding" / "seed_artifacts"
SOURCE = Path(os.environ.get("PIXELMEM_SEED_SOURCE", "seeding/_raw_images"))
N = int(os.environ.get("PIXELMEM_SEED_COUNT", "50"))

if (STORAGE / "pixelmem.db").exists() or (STORAGE / "faiss.index").exists():
    raise SystemExit(
        f"Refusing to overwrite existing data in {STORAGE}. "
        "Move pixelmem.db / faiss.index / faiss_ids.npy aside first."
    )

# 1. Source images: download from HF if not already present.
SOURCE.mkdir(parents=True, exist_ok=True)
existing = sorted(p for p in SOURCE.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"})
if len(existing) < N:
    print(f"Downloading {N} COCO val images into {SOURCE}/ ...")
    from datasets import load_dataset

    ds = load_dataset("detection-datasets/coco", split="val", streaming=True)
    for i, item in enumerate(ds):
        if i >= N:
            break
        img: PILImage.Image = item["image"]
        if img.mode != "RGB":
            img = img.convert("RGB")
        img.save(SOURCE / f"coco_{i:04d}.jpg", "JPEG", quality=90)
    existing = sorted(p for p in SOURCE.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"})

source_files = existing[:N]
print(f"Processing {len(source_files)} images through CLIP + FAISS ...")

# 2. Run them through the real pipeline so the artifacts match production exactly.
from backend.database import engine, Base, SessionLocal  # noqa: E402
from backend.models import Image, EmbeddingStatus  # noqa: E402
from backend.router_upload import (  # noqa: E402
    embedding_service,
    index_manager,
    save_thumbnail,
    IMAGES_DIR,
    THUMBNAILS_DIR,
)

IMAGES_DIR.mkdir(parents=True, exist_ok=True)
THUMBNAILS_DIR.mkdir(parents=True, exist_ok=True)
Base.metadata.create_all(bind=engine)

db = SessionLocal()
try:
    for i, src in enumerate(source_files):
        image_id = str(uuid.uuid4())
        ext = src.suffix.lower()
        dest = IMAGES_DIR / f"{image_id}{ext}"
        thumb = THUMBNAILS_DIR / f"{image_id}_thumb.jpg"
        shutil.copy(src, dest)
        with PILImage.open(dest) as img:
            width, height = img.size
        save_thumbnail(dest, thumb)
        vector = embedding_service.embed(str(dest))
        index_manager.add(image_id, vector)
        db.add(Image(
            id=image_id,
            filename=src.name,
            original_path=str(dest),
            thumbnail_path=str(thumb),
            width=width,
            height=height,
            file_size_bytes=dest.stat().st_size,
            embedding_status=EmbeddingStatus.ready,
        ))
        db.commit()
        print(f"  [{i + 1:2d}/{len(source_files)}] {src.name}")
finally:
    db.close()

# 3. Move the populated storage tree into seeding/seed_artifacts/.
if ARTIFACTS.exists():
    shutil.rmtree(ARTIFACTS)
ARTIFACTS.mkdir(parents=True)
for name in ("pixelmem.db", "faiss.index", "faiss_ids.npy"):
    shutil.move(str(STORAGE / name), ARTIFACTS / name)
for sub in ("images", "thumbnails"):
    shutil.move(str(STORAGE / sub), ARTIFACTS / sub)
    (STORAGE / sub).mkdir(parents=True, exist_ok=True)

total = sum(p.stat().st_size for p in ARTIFACTS.rglob("*") if p.is_file())
print(f"\nWrote seed artifacts to {ARTIFACTS} ({total / 1_000_000:.1f} MB)")
print("Commit seeding/seed_artifacts/ and redeploy — backend/seed.py will copy it on first boot.")
