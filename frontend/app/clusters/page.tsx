"use client";
import { useEffect, useState } from "react";
import { ClusterStrip } from "@/components/ClusterStrip";
import { api } from "@/lib/api";
import type { ClustersResponse } from "@/lib/types";

export default function ClustersPage() {
  const [data, setData] = useState<ClustersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.clusters(12, force);
      setData(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.clusters(12, false);
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="px-10 py-8 max-w-5xl">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--foreground)]">
            Clusters
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {data
              ? `${data.image_count} photos grouped into ${data.n_clusters} visual clusters.`
              : "Visual groupings of your library."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={loading}
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 disabled:opacity-40 transition-colors cursor-pointer"
        >
          Refresh
        </button>
      </header>

      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-40 rounded-2xl bg-zinc-100 animate-pulse"
            />
          ))}
        </div>
      )}

      {error && (
        <div className="text-center py-16">
          <p className="text-red-500 text-sm mb-4">{error}</p>
          <button
            type="button"
            onClick={() => load()}
            className="text-sm text-violet-600 hover:underline cursor-pointer"
          >
            Try again
          </button>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-4">
          {data.clusters.map((cluster, i) => (
            <ClusterStrip key={cluster.cluster_id} cluster={cluster} index={i} />
          ))}
        </div>
      )}
    </main>
  );
}
