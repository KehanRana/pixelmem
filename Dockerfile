FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HOME=/app/.cache/huggingface

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-only torch/torchvision from PyTorch's CPU index to avoid pulling
# in ~2 GB of CUDA wheels we can't use on Railway's CPU instances.
COPY requirements.txt .
RUN pip install --index-url https://download.pytorch.org/whl/cpu \
        torch==2.11.0 torchvision==0.26.0 \
    && grep -v -E '^(torch|torchvision)==' requirements.txt > /tmp/req.txt \
    && pip install -r /tmp/req.txt

# Pre-download the CLIP weights at build time so the first request after
# deploy doesn't pay the download cost (~600 MB).
RUN python -c "from transformers import CLIPModel, CLIPProcessor; \
    CLIPModel.from_pretrained('openai/clip-vit-base-patch32'); \
    CLIPProcessor.from_pretrained('openai/clip-vit-base-patch32')"

COPY backend ./backend

# Sample-dataset snapshot lives at seeding/seed_artifacts/. backend/seed.py
# copies it into backend/storage/ on first boot when storage is empty
# (e.g. a fresh Railway volume). If the artifacts dir is absent, seeding is
# a no-op and the app starts with an empty library.
COPY seeding ./seeding

# Storage dirs that router_upload.py writes to. On Railway, mount a volume
# at /app/backend/storage so uploads + index survive redeploys.
RUN mkdir -p backend/storage/images backend/storage/thumbnails

EXPOSE 8000

# Railway sets $PORT; default to 8000 locally.
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
