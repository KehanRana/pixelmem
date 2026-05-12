"""
A/B comparison of FAISS flat vs HNSW on the *real* CLIP embeddings currently
stored in backend/storage/faiss.index.

Approach: rather running the server twice (once per index kind)
and juggling two persisted indexes, this script reads whatever index is on disk,
reconstructs every vector from it, then builds a fresh FlatIP and a fresh
IndexHNSWFlat from those same vectors. It runs the same query set against
both, treating Flat's top-k as ground truth, and reports recall@k and
latency for HNSW.

Usage (from repo root, after you've uploaded some images):
    source venv/bin/activate
    python benchmarking/ab_compare.py --queries 200 --k 20

Knobs match the env vars in backend/index_manager.py so the comparison
reflects whatever HNSW config you plan to ship.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import faiss
import numpy as np


REPO_ROOT = Path(__file__).resolve().parent.parent
INDEX_PATH = REPO_ROOT / "backend" / "storage" / "faiss.index"
ID_MAP_PATH = REPO_ROOT / "backend" / "storage" / "faiss_ids.npy"
REPORT_PATH = REPO_ROOT / "scripts" / "ab_comparison" / "ab_report.md"
JSON_PATH = REPO_ROOT / "scripts" / "ab_comparison" / "ab_results.json"

DIM = 512


def percentile(values: list[float], p: float) -> float:
    s = sorted(values)
    k = (len(s) - 1) * p
    lo, hi = int(k), min(int(k) + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (k - lo)


def load_vectors() -> np.ndarray:
    if not INDEX_PATH.exists():
        raise SystemExit(
            f"No index at {INDEX_PATH}. Upload some images first so there's "
            "real data to compare on."
        )
    index = faiss.read_index(str(INDEX_PATH))
    n = index.ntotal
    if n == 0:
        raise SystemExit("Index is empty — upload some images first.")
    print(f"Reconstructing {n} vectors from {type(index).__name__} ...")
    vectors = np.zeros((n, DIM), dtype=np.float32)
    for i in range(n):
        index.reconstruct(i, vectors[i])
    return vectors


def search_all(index: faiss.Index, queries: np.ndarray, k: int) -> tuple[np.ndarray, list[float]]:
    ids = np.empty((len(queries), k), dtype=np.int64)
    latencies: list[float] = []
    for i, q in enumerate(queries):
        s = time.perf_counter()
        _, row = index.search(q.reshape(1, -1), k + 1)  # +1 to drop self
        latencies.append(time.perf_counter() - s)
        # Drop the self-match (which sits at rank 0 with score 1.0) so we
        # measure neighbour quality, not the trivial identity match.
        row = row[0]
        ids[i] = row[row != -1][1 : k + 1] if len(row) > k else row[:k]
    return ids, latencies


def recall_at_k(approx: np.ndarray, exact: np.ndarray, k: int) -> float:
    hits = 0
    for a, e in zip(approx, exact):
        hits += len(set(a.tolist()) & set(e.tolist()))
    return hits / (len(approx) * k)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--queries", type=int, default=200)
    ap.add_argument("--k", type=int, default=20)
    ap.add_argument("--hnsw-m", type=int, default=32)
    ap.add_argument("--hnsw-ef-construction", type=int, default=80)
    ap.add_argument(
        "--hnsw-ef-search",
        type=int,
        nargs="+",
        default=[32, 64, 128],
        help="sweep efSearch — one row per value in the report",
    )
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    vectors = load_vectors()
    n = len(vectors)

    rng = np.random.default_rng(args.seed)
    q_count = min(args.queries, n)
    q_idx = rng.choice(n, size=q_count, replace=False)
    queries = vectors[q_idx]
    print(f"Query set: {q_count} vectors sampled from the corpus")

    # --- Flat baseline (ground truth) ---
    print("\nBuilding FlatIP (baseline) ...")
    t = time.perf_counter()
    flat = faiss.IndexFlatIP(DIM)
    flat.add(vectors)
    flat_build = time.perf_counter() - t
    flat_ids, flat_lat = search_all(flat, queries, args.k)
    print(
        f"  build={flat_build:.2f}s "
        f"p50={percentile(flat_lat, 0.5) * 1000:.2f}ms "
        f"p95={percentile(flat_lat, 0.95) * 1000:.2f}ms"
    )

    # --- HNSW sweep over efSearch ---
    print(f"\nBuilding HNSW (M={args.hnsw_m}, efConstruction={args.hnsw_ef_construction}) ...")
    t = time.perf_counter()
    hnsw = faiss.IndexHNSWFlat(DIM, args.hnsw_m, faiss.METRIC_INNER_PRODUCT)
    hnsw.hnsw.efConstruction = args.hnsw_ef_construction
    hnsw.add(vectors)
    hnsw_build = time.perf_counter() - t
    print(f"  build={hnsw_build:.2f}s")

    rows: list[dict] = [
        {
            "kind": "FlatIP",
            "ef_search": None,
            "build_s": flat_build,
            "p50_ms": percentile(flat_lat, 0.5) * 1000,
            "p95_ms": percentile(flat_lat, 0.95) * 1000,
            "p99_ms": percentile(flat_lat, 0.99) * 1000,
            "recall_at_k": 1.0,
        }
    ]

    print(f"\nefSearch sweep (recall@{args.k} vs Flat, on {q_count} queries):")
    for ef in args.hnsw_ef_search:
        hnsw.hnsw.efSearch = ef
        ids, lat = search_all(hnsw, queries, args.k)
        recall = recall_at_k(ids, flat_ids, args.k)
        row = {
            "kind": "HNSWFlat",
            "ef_search": ef,
            "build_s": hnsw_build,
            "p50_ms": percentile(lat, 0.5) * 1000,
            "p95_ms": percentile(lat, 0.95) * 1000,
            "p99_ms": percentile(lat, 0.99) * 1000,
            "recall_at_k": recall,
        }
        rows.append(row)
        speedup = percentile(flat_lat, 0.95) / percentile(lat, 0.95) if lat else 0
        print(
            f"  efSearch={ef:4d}  p50={row['p50_ms']:.2f}ms  "
            f"p95={row['p95_ms']:.2f}ms  recall@{args.k}={recall:.3f}  "
            f"p95 speedup vs Flat={speedup:.1f}x"
        )

    # --- report ---
    lines = [
        "# PixelMem A/B: Flat vs HNSW on real CLIP embeddings\n",
        f"_Generated {time.strftime('%Y-%m-%d %H:%M:%S')}_\n",
        f"- corpus: **{n:,}** vectors from `{INDEX_PATH.relative_to(REPO_ROOT)}`",
        f"- queries: {q_count} (sampled from corpus, self-match excluded)",
        f"- k = {args.k}",
        f"- HNSW: M={args.hnsw_m}, efConstruction={args.hnsw_ef_construction}\n",
        "| index | efSearch | build | p50 | p95 | p99 | recall@k |",
        "|:------|---------:|------:|----:|----:|----:|---------:|",
    ]
    for r in rows:
        ef = "—" if r["ef_search"] is None else str(r["ef_search"])
        lines.append(
            f"| {r['kind']} | {ef} | {r['build_s']:.2f}s "
            f"| {r['p50_ms']:.2f} ms | {r['p95_ms']:.2f} ms | {r['p99_ms']:.2f} ms "
            f"| {r['recall_at_k']:.3f} |"
        )
    lines.append("")
    lines.append(
        "FlatIP is exact (recall = 1.0 by definition). HNSW recall is measured "
        "against FlatIP's top-k on the same query set. Raise `efSearch` to trade "
        "latency for recall."
    )
    report = "\n".join(lines)

    REPORT_PATH.write_text(report)
    JSON_PATH.write_text(
        json.dumps(
            {"n": n, "queries": q_count, "k": args.k, "rows": rows},
            indent=2,
        )
    )
    print(f"\nReport: {REPORT_PATH.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
