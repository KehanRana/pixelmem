import os
from pathlib import Path

import faiss
import numpy as np

EMBEDDING_DIM = 512
INDEX_PATH = Path("backend/storage/faiss.index")
ID_MAP_PATH = Path("backend/storage/faiss_ids.npy")

# Index kind is selected at startup via env var. Switching kinds requires
# deleting the existing faiss.index + faiss_ids.npy on disk first; otherwise
# the persisted index is loaded as-is regardless of this setting.
INDEX_KIND = os.environ.get("PIXELMEM_INDEX_KIND", "flat").lower()
HNSW_M = int(os.environ.get("PIXELMEM_HNSW_M", "32"))
HNSW_EF_CONSTRUCTION = int(os.environ.get("PIXELMEM_HNSW_EF_CONSTRUCTION", "80"))
HNSW_EF_SEARCH = int(os.environ.get("PIXELMEM_HNSW_EF_SEARCH", "64"))


def _build_index() -> faiss.Index:
    if INDEX_KIND == "hnsw":
        idx = faiss.IndexHNSWFlat(EMBEDDING_DIM, HNSW_M, faiss.METRIC_INNER_PRODUCT)
        idx.hnsw.efConstruction = HNSW_EF_CONSTRUCTION
        idx.hnsw.efSearch = HNSW_EF_SEARCH
        return idx
    if INDEX_KIND != "flat":
        print(f"[IndexManager] Unknown PIXELMEM_INDEX_KIND={INDEX_KIND!r}, using flat")
    return faiss.IndexFlatIP(EMBEDDING_DIM)


def _apply_runtime_params(index: faiss.Index) -> None:
    # efSearch is a query-time knob and isn't restored by read_index, so
    # re-apply it on every load for HNSW indexes.
    if isinstance(index, faiss.IndexHNSWFlat):
        index.hnsw.efSearch = HNSW_EF_SEARCH


class IndexManager:
    """
    Thin wrapper around a FAISS index (flat or HNSW, selected via the
    PIXELMEM_INDEX_KIND env var).

    Maintains a parallel list (self.image_ids) so we can map FAISS integer
    positions back to UUID image IDs from our database.

    The index and ID map are persisted to disk after every add() call so
    they survive server restarts.
    """

    def __init__(self):
        if INDEX_PATH.exists() and ID_MAP_PATH.exists():
            print("[IndexManager] Loading existing index from disk ...")
            self.index = faiss.read_index(str(INDEX_PATH))
            _apply_runtime_params(self.index)
            self.image_ids: list[str] = np.load(
                str(ID_MAP_PATH), allow_pickle=True
            ).tolist()
            print(
                f"[IndexManager] Loaded {self.index.ntotal} vectors "
                f"(kind={type(self.index).__name__})"
            )
        else:
            print(f"[IndexManager] Creating new index (kind={INDEX_KIND}) ...")
            self.index = _build_index()
            self.image_ids: list[str] = []

    def add(self, image_id: str, vector: np.ndarray) -> None:
        """
        Add a single normalised vector and persist immediately.
        vector must be shape (512,) float32 and already L2-normalised.
        """
        if vector.shape != (EMBEDDING_DIM,):
            raise ValueError(
                f"Expected shape ({EMBEDDING_DIM},), got {vector.shape}"
            )
        self.index.add(vector.reshape(1, -1))
        self.image_ids.append(image_id)
        self._persist()

    def search(self, vector: np.ndarray, k: int = 20) -> list[dict]:
        """
        Find the k nearest neighbours to a query vector.
        Returns a list of dicts with 'image_id' and 'score', sorted by score desc.
        Excludes the query image itself if it is already in the index.
        """
        if self.index.ntotal == 0:
            return []

        k_actual = min(k + 1, self.index.ntotal)  # +1 to exclude self
        scores, indices = self.index.search(vector.reshape(1, -1), k_actual)

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx == -1:
                continue
            neighbour_id = self.image_ids[idx]
            results.append({"image_id": neighbour_id, "score": float(score)})

        return results[:k]

    def get_vector(self, image_id: str) -> np.ndarray | None:
        """Retrieve the stored vector for a known image_id."""
        if image_id not in self.image_ids:
            return None
        idx = self.image_ids.index(image_id)
        # Both IndexFlatIP and IndexHNSWFlat store raw vectors and support
        # reconstruct(); IVF-family indexes would not.
        vector = np.zeros((1, EMBEDDING_DIM), dtype=np.float32)
        self.index.reconstruct(idx, vector[0])
        return vector[0]

    def _persist(self) -> None:
        faiss.write_index(self.index, str(INDEX_PATH))
        np.save(str(ID_MAP_PATH), np.array(self.image_ids, dtype=object))
