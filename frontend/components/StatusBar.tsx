"use client";
import type { SystemStatus } from "@/lib/types";

export function StatusBar({ status }: { status: SystemStatus | null }) {
  if (!status) return null;
  const pct =
    status.total > 0 ? Math.round((status.indexed / status.total) * 100) : 0;

  return (
    <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
      <span>{status.total} uploaded</span>
      <span className="text-zinc-300 dark:text-zinc-600">·</span>
      <span className="text-emerald-600 dark:text-emerald-400">
        {status.indexed} indexed
      </span>
      {status.processing > 0 && (
        <>
          <span className="text-zinc-300 dark:text-zinc-600">·</span>
          <span className="text-amber-500">{status.processing} processing</span>
        </>
      )}
      {status.failed > 0 && (
        <>
          <span className="text-zinc-300 dark:text-zinc-600">·</span>
          <span className="text-red-500">{status.failed} failed</span>
        </>
      )}
      {status.total > 0 && (
        <div className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden max-w-xs">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}