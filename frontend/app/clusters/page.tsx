"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClusterStrip } from "@/components/ClusterStrip";
import { api } from "@/lib/api";
import type { ClustersResponse } from "@/lib/types";

export default function ClustersPage() {
  const router = useRouter();
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

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">

      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <button
          onClick={() => router.push("/explorer")}
          className="text-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
        >
          ← Explorer
        </button>
        <h1 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Memory clusters
        </h1>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="text-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-40 transition-colors"
        >
          Refresh
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-40 rounded-2xl bg-zinc-100 dark:bg-zinc-800 animate-pulse"
              />
            ))}
          </div>
        )}

        {error && (
          <div className="text-center py-16">
            <p className="text-red-500 text-sm mb-4">{error}</p>
            <button
              onClick={() => load()}
              className="text-sm text-violet-600 hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {data && !loading && (
          <>
            <p className="text-sm text-zinc-400 mb-6">
              {data.image_count} photos grouped into {data.n_clusters} visual clusters.
              Click any photo to explore similar images.
            </p>
            <div className="space-y-4">
              {data.clusters.map((cluster, i) => (
                <ClusterStrip key={cluster.cluster_id} cluster={cluster} index={i} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}