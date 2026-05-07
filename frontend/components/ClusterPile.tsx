"use client";
import type { Cluster } from "@/lib/types";

interface Props {
  cluster: Cluster;
  index: number;
  onPick: (cluster: Cluster) => void;
}

export function ClusterPile({ cluster, index, onPick }: Props) {
  // Top card = representative; back layers = next two distinct members
  const back = cluster.members
    .filter((m) => m.id !== cluster.representative?.id)
    .slice(0, 2);

  const label = `Cluster ${index + 1}`;

  return (
    <button
      type="button"
      onClick={() => onPick(cluster)}
      className="group flex flex-col items-stretch text-left cursor-pointer"
    >
      <div className="relative aspect-square mb-4">
        {/* Back layer 2 */}
        {back[1] && (
          <div className="absolute inset-0 rounded-2xl overflow-hidden rotate-[6deg] translate-x-2 translate-y-1 ring-1 ring-black/5 shadow-[0_2px_10px_rgba(0,0,0,0.06)] transition-transform duration-200 group-hover:rotate-[8deg] group-hover:translate-x-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={back[1].thumbnail_url}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover"
            />
          </div>
        )}
        {/* Back layer 1 */}
        {back[0] && (
          <div className="absolute inset-0 rounded-2xl overflow-hidden -rotate-[4deg] -translate-x-1 translate-y-2 ring-1 ring-black/5 shadow-[0_2px_10px_rgba(0,0,0,0.06)] transition-transform duration-200 group-hover:-rotate-[6deg] group-hover:-translate-x-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={back[0].thumbnail_url}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover"
            />
          </div>
        )}
        {/* Front card */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden ring-1 ring-black/5 bg-white shadow-[0_6px_20px_rgba(0,0,0,0.08)] transition-transform duration-200 group-hover:-translate-y-0.5">
          {cluster.representative && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cluster.representative.thumbnail_url}
              alt={cluster.representative.filename}
              className="w-full h-full object-cover"
            />
          )}
          <span className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-zinc-900 text-white text-xs font-semibold tabular-nums">
            {cluster.size}
          </span>
        </div>
      </div>

      <div className="px-1">
        <p className="text-sm font-semibold text-[var(--foreground)]">
          {label}
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">click to explore</p>
      </div>
    </button>
  );
}

export function UnsortedPile({ count }: { count: number }) {
  return (
    <div className="flex flex-col items-stretch text-left">
      <div className="relative aspect-square mb-4">
        <div className="absolute inset-0 rounded-2xl rotate-[6deg] translate-x-2 translate-y-1 border-2 border-dashed border-zinc-300 bg-[var(--surface)] opacity-60" />
        <div className="absolute inset-0 rounded-2xl -rotate-[4deg] -translate-x-1 translate-y-2 border-2 border-dashed border-zinc-300 bg-[var(--surface)] opacity-80" />
        <div className="absolute inset-0 rounded-2xl border-2 border-dashed border-zinc-300 bg-[var(--surface)] flex items-center justify-center">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-zinc-400" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-zinc-900 text-white text-xs font-semibold tabular-nums">
            {count}
          </span>
        </div>
      </div>

      <div className="px-1">
        <p className="text-sm font-semibold text-zinc-400">unsorted</p>
        <p className="text-xs text-zinc-400 mt-0.5">outliers</p>
      </div>
    </div>
  );
}
