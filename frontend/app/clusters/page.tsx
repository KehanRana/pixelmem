"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClusterPile, UnsortedPile } from "@/components/ClusterPile";
import { SegmentedPill } from "@/components/SegmentedPill";
import { api } from "@/lib/api";
import type { Cluster, ClustersResponse, SystemStatus } from "@/lib/types";

const N_OPTIONS = [4, 8, 12] as const;

const Refresh = (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 4v3h3" />
    <path d="M3.5 7A5 5 0 1 1 4 11" />
  </svg>
);

export default function ClustersPage() {
  const router = useRouter();
  const [n, setN] = useState<number>(8);
  const [data, setData] = useState<ClustersResponse | null>(null);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (nVal: number, force: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const [clusters, sys] = await Promise.all([
        api.clusters(nVal, force),
        api.status(),
      ]);
      setData(clusters);
      setStatus(sys);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error("Couldn't load clusters", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [clusters, sys] = await Promise.all([
          api.clusters(n, false),
          api.status(),
        ]);
        if (cancelled) return;
        setData(clusters);
        setStatus(sys);
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          setError(msg);
          toast.error("Couldn't load clusters", { description: msg });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPick = (cluster: Cluster) => {
    if (cluster.representative) {
      router.push(`/explorer?start=${cluster.representative.id}`);
    }
  };

  const outliers =
    status != null
      ? status.pending + status.processing + status.failed
      : 0;

  return (
    <main className="px-10 py-8">
      <header className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--foreground)]">
            Memory clusters
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {data
              ? `${data.image_count.toLocaleString()} photos auto-grouped into ${data.n_clusters} piles. Click any to dive in.`
              : "Visual groupings of your library."}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <SegmentedPill
            options={N_OPTIONS}
            value={n}
            onChange={(v) => { setN(v); void load(v, false); }}
            format={(v) => `${v} groups`}
            ariaLabel="Number of clusters"
          />
          <button
            type="button"
            onClick={() => void load(n, true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] text-sm text-zinc-700 hover:text-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {Refresh}
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="text-center py-16">
          <p className="text-red-500 text-sm mb-4">{error}</p>
          <button
            type="button"
            onClick={() => void load(n, false)}
            className="text-sm text-violet-600 hover:underline cursor-pointer"
          >
            Try again
          </button>
        </div>
      )}

      {loading && !data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-10">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-2xl bg-zinc-100 animate-pulse" />
          ))}
        </div>
      )}

      {data && !error && data.image_count === 0 && (
        <div className="flex flex-col items-center justify-center text-center py-24 px-6 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]/40">
          <p className="text-base font-medium text-[var(--foreground)]">
            Nothing to cluster yet
          </p>
          <p className="mt-1.5 text-sm text-zinc-500 max-w-sm">
            Upload some photos and they&apos;ll get auto-grouped into visual piles here.
          </p>
          <Link
            href="/upload"
            className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors"
          >
            Upload photos
          </Link>
        </div>
      )}

      {data && !error && data.image_count > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-10">
          {data.clusters.map((c, i) => (
            <ClusterPile key={c.cluster_id} cluster={c} index={i} onPick={onPick} />
          ))}
          {outliers > 0 && <UnsortedPile count={outliers} />}
        </div>
      )}
    </main>
  );
}
