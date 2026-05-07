"use client";
import { useRouter } from "next/navigation";
import type { Cluster } from "@/lib/types";

interface Props {
  cluster: Cluster;
  index: number;
}

export function ClusterStrip({ cluster, index }: Props) {
  const router = useRouter();

  const preview = cluster.members.slice(0, 8);

  return (
    <div className="border border-zinc-100 dark:border-zinc-800 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-900">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Group {index + 1}
        </span>
        <span className="text-xs text-zinc-400">{cluster.size} photos</span>
      </div>

      <div className="flex gap-2 p-3 overflow-x-auto">
        {/* Representative image — larger */}
        {cluster.representative && (
          <button
            onClick={() =>
              router.push(`/explorer?start=${cluster.representative!.id}`)
            }
            className="shrink-0 w-28 h-28 rounded-xl overflow-hidden ring-2 ring-violet-400 hover:scale-95 transition-transform"
          >
            <img
              src={cluster.representative.thumbnail_url}
              alt={cluster.representative.filename}
              className="w-full h-full object-cover"
            />
          </button>
        )}

        {/* Remaining members */}
        {preview
          .filter((m) => m.id !== cluster.representative?.id)
          .map((member) => (
            <button
              key={member.id}
              onClick={() => router.push(`/explorer?start=${member.id}`)}
              className="shrink-0 w-20 h-20 rounded-lg overflow-hidden hover:scale-95 transition-transform opacity-80 hover:opacity-100"
            >
              <img
                src={member.thumbnail_url}
                alt={member.filename}
                className="w-full h-full object-cover"
              />
            </button>
          ))}

        {cluster.size > 8 && (
          <div className="shrink-0 w-20 h-20 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 text-sm">
            +{cluster.size - 8}
          </div>
        )}
      </div>
    </div>
  );
}