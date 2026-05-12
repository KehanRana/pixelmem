# PixelMem benchmark

_Generated 2026-05-12 23:20:37_

## FAISS search latency (k=20)

| corpus | index | build | p50 | p95 | p99 | recall@k | disk |
|-------:|:------|------:|----:|----:|----:|---------:|-----:|
| 500 | FlatIP | 0.00s | 0.02 ms | 0.02 ms | 2.29 ms | 1.000 | 1000.0 KB |
| 500 | HNSWFlat | 0.00s | 0.03 ms | 0.04 ms | 0.15 ms | 0.995 | 1.1 MB |
| 2,000 | FlatIP | 0.00s | 0.05 ms | 0.06 ms | 0.07 ms | 1.000 | 3.9 MB |
| 2,000 | HNSWFlat | 0.03s | 0.06 ms | 0.06 ms | 0.07 ms | 0.920 | 4.4 MB |
| 2,000 | IVFFlat | 0.01s | 0.01 ms | 0.01 ms | 0.15 ms | 0.188 | 4.0 MB |

FlatIP is the exact baseline (recall = 1.0 by definition). HNSW and IVF are approximate; their recall is measured against FlatIP's top-k on the same queries. Vectors are random unit vectors in 512-d; real CLIP embeddings cluster more, so absolute numbers shift but the shape of the comparison holds.