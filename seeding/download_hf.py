"""
Download COCO val images from Hugging Face into a local directory for seeding.

Usage:
    # Default: 50 images into backend/test_images
    python seeding/download_hf.py

    # Larger seed
    PIXELMEM_DOWNLOAD_NUM=200 python seeding/download_hf.py

    # Custom output dir
    PIXELMEM_OUTPUT_DIR=seeding/photos python seeding/download_hf.py
"""
import os

from datasets import load_dataset
from PIL import Image as PILImage

OUTPUT_DIR = os.environ.get("PIXELMEM_OUTPUT_DIR", "backend/test_images")
DOWNLOAD_NUM = int(os.environ.get("PIXELMEM_DOWNLOAD_NUM", "50"))

os.makedirs(OUTPUT_DIR, exist_ok=True)

print(f"Downloading {DOWNLOAD_NUM} images into {OUTPUT_DIR}/ ...")
ds = load_dataset("detection-datasets/coco", split="val", streaming=True)

for i, item in enumerate(ds):
    if i >= DOWNLOAD_NUM:
        break
    img: PILImage.Image = item["image"]
    if img.mode != "RGB":
        img = img.convert("RGB")
    img.save(f"{OUTPUT_DIR}/coco_{i:04d}.jpg", "JPEG", quality=90)
    if i % 10 == 0:
        print(f"  {i}/{DOWNLOAD_NUM}")

print("Done")
