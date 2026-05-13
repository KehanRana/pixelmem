"""
First-boot seeding: copy seeding/seed_artifacts/ into backend/storage/ when
the storage dir has no DB yet.

Skipped when the DB already exists (so user uploads on a mounted Railway
volume are never clobbered), or when PIXELMEM_DISABLE_SEED is set.

Must run BEFORE backend.router_upload is imported — that module's IndexManager
singleton reads faiss.index at construction time.
"""
import os
import shutil
from pathlib import Path

STORAGE = Path("backend/storage")
ARTIFACTS = Path("seeding/seed_artifacts")


def maybe_seed() -> None:
    if os.environ.get("PIXELMEM_DISABLE_SEED"):
        return
    if (STORAGE / "pixelmem.db").exists():
        return
    if not ARTIFACTS.exists():
        return

    print(f"[Seed] Empty storage; loading sample dataset from {ARTIFACTS}/")
    for name in ("pixelmem.db", "faiss.index", "faiss_ids.npy"):
        src = ARTIFACTS / name
        if src.exists():
            shutil.copy(src, STORAGE / name)
    for sub in ("images", "thumbnails"):
        src_dir = ARTIFACTS / sub
        if not src_dir.exists():
            continue
        dest_dir = STORAGE / sub
        dest_dir.mkdir(parents=True, exist_ok=True)
        for f in src_dir.iterdir():
            if f.is_file():
                shutil.copy(f, dest_dir / f.name)
    print("[Seed] Sample dataset loaded")
