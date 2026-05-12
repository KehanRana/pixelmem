"""
PixelMem benchmark — measures two things:

  1. CLIP embedding throughput on real images from backend/test_images/.
  2. FAISS search latency / build time / on-disk size for IndexFlatIP
     vs IndexHNSWFlat vs IndexIVFFlat at varying corpus sizes, using
     synthetic L2-normalised vectors (search cost at scale is dominated
     by FAISS, not CLIP).

Run from the repo root:
    source venv/bin/activate
    python benchmarking/benchmark.py --sizes 1000 10000 50000 --queries 200

A markdown report is printed to stdout and written to scripts/benchmark_report.md.
"""

from __future__ import annotations

import argparse
import json
import os
import tempfile
import time
from pathlib import Path
from typing import Callable

import faiss
import numpy as np


REPO_ROOT = Path(__file__).resolve().parent.parent
DIM = 512
IMAGE_DIR = REPO_ROOT / "backend" / "test_images"
REPORT_PATH = REPO_ROOT / "benchmarking" / "benchmark_report.md"
JSON_PATH = REPO_ROOT / "benchmarking" / "benchmark_results.json"


# ---------- helpers ----------

def percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    k = (len(s) - 1) * p
    lo, hi = int(k), min(int(k) + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (k - lo)


def fmt_ms(seconds: float) -> str:
    return f"{seconds * 1000:.2f}"


def fmt_bytes(n: int) -> str:
    units = ["B", "KB", "MB", "GB"]
    f = float(n)
    for u in units:
        if f < 1024 or u == units[-1]:
            return f"{f:.1f} {u}"
        f /= 1024
    return f"{f:.1f} GB"


def random_unit_vectors(n: int, dim: int = DIM, seed: int = 0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    x = rng.standard_normal((n, dim)).astype(np.float32)
    x /= np.linalg.norm(x, axis=1, keepdims=True)
    return x


def index_disk_size(index: faiss.Index) -> int:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".index") as tmp:
        path = tmp.name
    try:
        faiss.write_index(index, path)
        return os.path.getsize(path)
    finally:
        os.unlink(path)


# ---------- part 1: CLIP embedding throughput ----------

def benchmark_embedding(limit: int | None) -> dict | None:
    if not IMAGE_DIR.exists():
        print(f"[skip] {IMAGE_DIR} not found — skipping CLIP throughput")
        return None

    paths = sorted(
        p for p in IMAGE_DIR.iterdir()
        if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
    )
    if limit:
        paths = paths[:limit]
    if not paths:
        print(f"[skip] no images in {IMAGE_DIR}")
        return None

    # Imported lazily so the FAISS-only part of the benchmark still runs
    # on machines without torch installed.
    from backend.embedding_service import EmbeddingService  # noqa: WPS433

    print(f"\n=== CLIP embedding throughput ({len(paths)} images) ===")
    svc = EmbeddingService()

    # Warm-up — first call pays compilation / cudnn autotune cost.
    svc.embed(paths[0])

    latencies: list[float] = []
    t0 = time.perf_counter()
    for p in paths:
        s = time.perf_counter()
        svc.embed(p)
        latencies.append(time.perf_counter() - s)
    total = time.perf_counter() - t0

    result = {
        "device": svc.device,
        "count": len(paths),
        "total_s": total,
        "throughput_per_s": len(paths) / total,
        "p50_ms": percentile(latencies, 0.50) * 1000,
        "p95_ms": percentile(latencies, 0.95) * 1000,
        "p99_ms": percentile(latencies, 0.99) * 1000,
    }
    print(
        f"  device={result['device']} "
        f"throughput={result['throughput_per_s']:.1f} img/s "
        f"p50={result['p50_ms']:.1f}ms p95={result['p95_ms']:.1f}ms"
    )
    return result


# ---------- part 2: FAISS index comparison ----------

IndexBuilder = Callable[[np.ndarray], faiss.Index]


def build_flat(vectors: np.ndarray) -> faiss.Index:
    idx = faiss.IndexFlatIP(DIM)
    idx.add(vectors)
    return idx


def build_hnsw(vectors: np.ndarray, m: int = 32, ef_construction: int = 80) -> faiss.Index:
    idx = faiss.IndexHNSWFlat(DIM, m, faiss.METRIC_INNER_PRODUCT)
    idx.hnsw.efConstruction = ef_construction
    idx.hnsw.efSearch = 64
    idx.add(vectors)
    return idx


def build_ivf(vectors: np.ndarray) -> faiss.Index:
    nlist = max(4, int(np.sqrt(len(vectors))))
    quantizer = faiss.IndexFlatIP(DIM)
    idx = faiss.IndexIVFFlat(quantizer, DIM, nlist, faiss.METRIC_INNER_PRODUCT)
    train_n = min(len(vectors), max(nlist * 40, 1000))
    idx.train(vectors[:train_n])
    idx.add(vectors)
    idx.nprobe = max(1, nlist // 10)
    return idx


def measure_search(
    index: faiss.Index, queries: np.ndarray, k: int
) -> tuple[list[float], np.ndarray]:
    latencies: list[float] = []
    all_ids = np.empty((len(queries), k), dtype=np.int64)
    for i, q in enumerate(queries):
        s = time.perf_counter()
        _, ids = index.search(q.reshape(1, -1), k)
        latencies.append(time.perf_counter() - s)
        all_ids[i] = ids[0]
    return latencies, all_ids


def recall_at_k(approx_ids: np.ndarray, exact_ids: np.ndarray, k: int) -> float:
    hits = 0
    for a, e in zip(approx_ids, exact_ids):
        hits += len(set(a.tolist()) & set(e.tolist()))
    return hits / (len(approx_ids) * k)


def benchmark_faiss(sizes: list[int], n_queries: int, k: int) -> list[dict]:
    results: list[dict] = []

    print(f"\n=== FAISS search benchmark (k={k}, {n_queries} queries/run) ===")
    for n in sizes:
        print(f"\ncorpus size: {n:,}")
        vectors = random_unit_vectors(n, seed=n)
        queries = random_unit_vectors(n_queries, seed=n + 1)

        # Flat — the ground-truth baseline.
        t = time.perf_counter()
        flat = build_flat(vectors)
        flat_build = time.perf_counter() - t
        flat_lat, flat_ids = measure_search(flat, queries, k)
        flat_size = index_disk_size(flat)

        # HNSW.
        t = time.perf_counter()
        hnsw = build_hnsw(vectors)
        hnsw_build = time.perf_counter() - t
        hnsw_lat, hnsw_ids = measure_search(hnsw, queries, k)
        hnsw_size = index_disk_size(hnsw)
        hnsw_recall = recall_at_k(hnsw_ids, flat_ids, k)

        # IVF — only meaningful once there's enough data to train it.
        ivf_row: dict | None = None
        if n >= 1000:
            t = time.perf_counter()
            ivf = build_ivf(vectors)
            ivf_build = time.perf_counter() - t
            ivf_lat, ivf_ids = measure_search(ivf, queries, k)
            ivf_size = index_disk_size(ivf)
            ivf_recall = recall_at_k(ivf_ids, flat_ids, k)
            ivf_row = {
                "kind": "IVFFlat",
                "build_s": ivf_build,
                "p50_ms": percentile(ivf_lat, 0.50) * 1000,
                "p95_ms": percentile(ivf_lat, 0.95) * 1000,
                "p99_ms": percentile(ivf_lat, 0.99) * 1000,
                "recall_at_k": ivf_recall,
                "disk_bytes": ivf_size,
            }

        rows = [
            {
                "kind": "FlatIP",
                "build_s": flat_build,
                "p50_ms": percentile(flat_lat, 0.50) * 1000,
                "p95_ms": percentile(flat_lat, 0.95) * 1000,
                "p99_ms": percentile(flat_lat, 0.99) * 1000,
                "recall_at_k": 1.0,
                "disk_bytes": flat_size,
            },
            {
                "kind": "HNSWFlat",
                "build_s": hnsw_build,
                "p50_ms": percentile(hnsw_lat, 0.50) * 1000,
                "p95_ms": percentile(hnsw_lat, 0.95) * 1000,
                "p99_ms": percentile(hnsw_lat, 0.99) * 1000,
                "recall_at_k": hnsw_recall,
                "disk_bytes": hnsw_size,
            },
        ]
        if ivf_row is not None:
            rows.append(ivf_row)

        for r in rows:
            r["n"] = n
            print(
                f"  {r['kind']:9s} build={r['build_s']:.2f}s "
                f"p50={r['p50_ms']:.2f}ms p95={r['p95_ms']:.2f}ms "
                f"recall@{k}={r['recall_at_k']:.3f} "
                f"disk={fmt_bytes(r['disk_bytes'])}"
            )
            results.append(r)

    return results


# ---------- report ----------

def write_report(embedding: dict | None, faiss_rows: list[dict], k: int) -> None:
    lines: list[str] = []
    lines.append("# PixelMem benchmark\n")
    lines.append(f"_Generated {time.strftime('%Y-%m-%d %H:%M:%S')}_\n")

    if embedding:
        lines.append("## CLIP embedding throughput\n")
        lines.append(f"- device: `{embedding['device']}`")
        lines.append(f"- images: {embedding['count']}")
        lines.append(f"- throughput: **{embedding['throughput_per_s']:.1f} img/s**")
        lines.append(
            f"- per-image latency: p50 {embedding['p50_ms']:.1f} ms, "
            f"p95 {embedding['p95_ms']:.1f} ms, p99 {embedding['p99_ms']:.1f} ms\n"
        )

    lines.append(f"## FAISS search latency (k={k})\n")
    lines.append("| corpus | index | build | p50 | p95 | p99 | recall@k | disk |")
    lines.append("|-------:|:------|------:|----:|----:|----:|---------:|-----:|")
    for r in faiss_rows:
        lines.append(
            f"| {r['n']:,} | {r['kind']} | {r['build_s']:.2f}s "
            f"| {r['p50_ms']:.2f} ms | {r['p95_ms']:.2f} ms | {r['p99_ms']:.2f} ms "
            f"| {r['recall_at_k']:.3f} | {fmt_bytes(r['disk_bytes'])} |"
        )

    lines.append("")
    lines.append(
        "FlatIP is the exact baseline (recall = 1.0 by definition). "
        "HNSW and IVF are approximate; their recall is measured against FlatIP's "
        "top-k on the same queries. Vectors are random unit vectors in 512-d; "
        "real CLIP embeddings cluster more, so absolute numbers shift but the "
        "shape of the comparison holds."
    )

    report = "\n".join(lines)
    REPORT_PATH.write_text(report)
    print(f"\nReport written to {REPORT_PATH.relative_to(REPO_ROOT)}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--sizes",
        type=int,
        nargs="+",
        default=[1000, 10000, 50000],
        help="corpus sizes to test (default: 1k 10k 50k)",
    )
    ap.add_argument("--queries", type=int, default=200, help="queries per run")
    ap.add_argument("--k", type=int, default=20)
    ap.add_argument(
        "--embed-limit",
        type=int,
        default=100,
        help="max real images to use for CLIP throughput (0 to skip)",
    )
    args = ap.parse_args()

    embedding = (
        benchmark_embedding(args.embed_limit) if args.embed_limit > 0 else None
    )
    faiss_rows = benchmark_faiss(args.sizes, args.queries, args.k)

    JSON_PATH.write_text(
        json.dumps(
            {"embedding": embedding, "faiss": faiss_rows, "k": args.k},
            indent=2,
        )
    )
    write_report(embedding, faiss_rows, args.k)


if __name__ == "__main__":
    main()
