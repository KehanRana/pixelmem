from pathlib import Path

import numpy as np
import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

MODEL_NAME = "openai/clip-vit-base-patch32"


class EmbeddingService:
    """
    Loads CLIP once and generates L2-normalised 512-dim embeddings.
    Instantiate once at app startup — never per request.
    """

    def __init__(self):
        print(f"[EmbeddingService] Loading {MODEL_NAME} ...")
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = CLIPModel.from_pretrained(MODEL_NAME)
        self.processor = CLIPProcessor.from_pretrained(MODEL_NAME)
        self.model.to(self.device)
        self.model.eval()
        print(f"[EmbeddingService] Ready on {self.device}")

    def embed(self, image_path: str | Path) -> np.ndarray:
        """
        Given a path to an image file, return a normalised float32 vector
        of shape (512,). Raises ValueError if the file cannot be read.
        """
        path = Path(image_path)
        if not path.exists():
            raise ValueError(f"Image not found: {path}")

        try:
            image = Image.open(path).convert("RGB")
        except Exception as e:
            raise ValueError(f"Cannot open image {path}: {e}") from e

        inputs = self.processor(images=image, return_tensors="pt").to(self.device)

        with torch.no_grad():
            vision_outputs = self.model.vision_model(**inputs)
            pooled = vision_outputs.pooler_output  # (1, hidden_dim)
            features = self.model.visual_projection(pooled)  # (1, 512)

        vector = features.squeeze().cpu().numpy().astype(np.float32)

        # L2-normalise so cosine similarity == dot product in FAISS
        norm = np.linalg.norm(vector)
        if norm == 0:
            raise ValueError(f"Zero-norm embedding for {path} — file may be corrupt")
        return vector / norm