"""
Bulk-upload images from a local directory to a PixelMem instance.

Usage:
    # Local backend (default)
    python seeding/bulk_upload.py

    # Railway backend
    PIXELMEM_BACKEND_URL=https://backend-production-xxxx.up.railway.app \\
        python seeding/bulk_upload.py

    # Custom source directory and batch size
    PIXELMEM_IMAGE_DIR=path/to/photos PIXELMEM_BATCH_SIZE=10 \\
        python seeding/bulk_upload.py
"""
import os
import time

import requests

BACKEND = os.environ.get("PIXELMEM_BACKEND_URL", "http://localhost:8000").rstrip("/")
IMAGE_DIR = os.environ.get("PIXELMEM_IMAGE_DIR", "backend/test_images")
BATCH_SIZE = int(os.environ.get("PIXELMEM_BATCH_SIZE", "10"))
UPLOAD_URL = f"{BACKEND}/api/upload"
STATUS_URL = f"{BACKEND}/api/status"

SUPPORTED = {".jpg", ".jpeg", ".png", ".webp"}

if not os.path.isdir(IMAGE_DIR):
    raise SystemExit(f"Image directory not found: {IMAGE_DIR}")

files = sorted(
    f for f in os.listdir(IMAGE_DIR)
    if os.path.splitext(f)[1].lower() in SUPPORTED
)
if not files:
    raise SystemExit(f"No images found in {IMAGE_DIR}")

print(f"Target: {BACKEND}")
print(f"Source: {IMAGE_DIR} ({len(files)} images)")
print(f"Batch size: {BATCH_SIZE}\n")

total_uploaded = 0
total_failed = 0
for i in range(0, len(files), BATCH_SIZE):
    batch = files[i : i + BATCH_SIZE]
    handles = [
        ("files", (f, open(f"{IMAGE_DIR}/{f}", "rb"), "image/jpeg"))
        for f in batch
    ]
    try:
        # Generous timeout: large batches over a residential uplink to Railway
        # can take a while on the wire alone, before the backend even starts.
        res = requests.post(UPLOAD_URL, files=handles, timeout=120).json()
        total_uploaded += res.get("uploaded", 0)
        total_failed += res.get("failed", 0)
        n = i // BATCH_SIZE + 1
        print(f"  Batch {n}: {res.get('uploaded', 0)} uploaded, {res.get('failed', 0)} failed")
    except Exception as e:
        print(f"  Batch {i // BATCH_SIZE + 1}: ERROR — {e}")
    finally:
        for _, (_, fh, _) in handles:
            fh.close()
    time.sleep(0.5)

print(f"\nDone — uploaded {total_uploaded}/{len(files)} ({total_failed} failed)")
print("Embeddings are generating in the background.")
print(f'\nPoll status: curl "{STATUS_URL}"')
