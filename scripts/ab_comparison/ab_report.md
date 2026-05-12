# PixelMem A/B: Flat vs HNSW on real CLIP embeddings

_Generated 2026-05-12 23:49:19_

- corpus: **179** vectors from `backend/storage/faiss.index`
- queries: 50 (sampled from corpus, self-match excluded)
- k = 20
- HNSW: M=32, efConstruction=80

| index | efSearch | build | p50 | p95 | p99 | recall@k |
|:------|---------:|------:|----:|----:|----:|---------:|
| FlatIP | — | 0.00s | 0.01 ms | 0.01 ms | 1.09 ms | 1.000 |
| HNSWFlat | 32 | 0.00s | 0.01 ms | 0.02 ms | 0.16 ms | 0.988 |
| HNSWFlat | 64 | 0.00s | 0.02 ms | 0.02 ms | 0.02 ms | 0.990 |
| HNSWFlat | 128 | 0.00s | 0.03 ms | 0.03 ms | 0.03 ms | 0.990 |

FlatIP is exact (recall = 1.0 by definition). HNSW recall is measured against FlatIP's top-k on the same query set. Raise `efSearch` to trade latency for recall.