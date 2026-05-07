from pathlib import Path

import faiss
import numpy as np

EMBEDDING_DIM = 512
INDEX_PATH = Path("backend/storage/faiss.index")
ID_MAP_PATH = Path("backend/storage/faiss_ids.npy")


class IndexManager:
    """
    Thin wrapper around a FAISS IndexFlatIP index.

    Maintains a parallel list (self.image_ids) so we can map FAISS integer
    positions back to UUID image IDs from our database.

    The index and ID map are persisted to disk after every add() call so
    they survive server restarts.
    """

    def __init__(self):
        if INDEX_PATH.exists() and ID_MAP_PATH.exists():
            print("[IndexManager] Loading existing index from disk ...")
            self.index = faiss.read_index(str(INDEX_PATH))
            self.image_ids: list[str] = np.load(
                str(ID_MAP_PATH), allow_pickle=True
            ).tolist()
            print(f"[IndexManager] Loaded {self.index.ntotal} vectors")
        else:
            print("[IndexManager] Creating new index ...")
            self.index = faiss.IndexFlatIP(EMBEDDING_DIM)
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
        vector = np.zeros((1, EMBEDDING_DIM), dtype=np.float32)
        self.index.reconstruct(idx, vector[0])
        return vector[0]

    def _persist(self) -> None:
        faiss.write_index(self.index, str(INDEX_PATH))
        np.save(str(ID_MAP_PATH), np.array(self.image_ids, dtype=object))