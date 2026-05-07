"use client";
import type { ImageRecord } from "@/lib/types";

interface TrailEntry {
  id: string;
  thumbnail_url: string;
  filename: string;
}

interface Props {
  anchor: ImageRecord | null;
  topMatchPct: number | null;
  clusterLabel: string | null;
  clusterSize: number | null;
  trail: TrailEntry[];
  onPickTrail: (entry: TrailEntry) => void;
  onResetTrail: () => void;
}

const Refresh = (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 4v3h3" />
    <path d="M3.5 7A5 5 0 1 1 4 11" />
  </svg>
);

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold tracking-[0.14em] text-zinc-400 uppercase mb-3">
      {children}
    </p>
  );
}

function formatBytes(b?: number) {
  if (!b && b !== 0) return null;
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 ** 2).toFixed(1)} MB`;
}

function formatDate(s?: string) {
  if (!s) return null;
  return s.slice(0, 10);
}

export function SelectedPanel({
  anchor,
  topMatchPct,
  clusterLabel,
  clusterSize,
  trail,
  onPickTrail,
  onResetTrail,
}: Props) {
  if (!anchor) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
        Click any image to anchor.
      </div>
    );
  }

  const meta = [
    anchor.width && anchor.height ? `${anchor.width} × ${anchor.height}` : null,
    formatBytes(anchor.file_size_bytes),
    formatDate(anchor.created_at),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-7">
      {/* Anchor */}
      <section>
        <Eyebrow>Anchor</Eyebrow>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={anchor.thumbnail_url}
          alt={anchor.filename}
          className="w-full aspect-square object-cover rounded-2xl"
        />
        <h2 className="mt-4 text-base font-semibold text-[var(--foreground)] truncate">
          {anchor.filename}
        </h2>
        {meta && <p className="mt-1 text-sm text-zinc-500">{meta}</p>}
      </section>

      {/* Cluster */}
      {clusterLabel && (
        <section>
          <p className="text-sm text-zinc-500 mb-2">Cluster</p>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 text-violet-700 text-sm font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
            {clusterLabel}
            {clusterSize != null && (
              <span className="text-violet-500">({clusterSize})</span>
            )}
          </span>
        </section>
      )}

      {/* Top match */}
      {topMatchPct != null && (
        <section>
          <p className="text-sm text-zinc-500 mb-1">Top match</p>
          <p className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums text-[var(--foreground)]">
              {topMatchPct.toFixed(1)}%
            </span>
            <span className="text-sm text-zinc-500">cosine sim.</span>
          </p>
        </section>
      )}

      {/* Trail */}
      <section>
        <Eyebrow>Trail</Eyebrow>
        <div className="flex items-center gap-2 mb-3">
          {trail.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onPickTrail(entry)}
              title={entry.filename}
              className="w-11 h-11 rounded-lg overflow-hidden ring-1 ring-[var(--border)] hover:ring-zinc-300 transition cursor-pointer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={entry.thumbnail_url}
                alt={entry.filename}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
          <span className="w-11 h-11 rounded-lg border-2 border-violet-500 flex items-center justify-center text-[11px] font-semibold text-violet-700 bg-violet-50/50">
            now
          </span>
        </div>
        <button
          type="button"
          onClick={onResetTrail}
          disabled={trail.length === 0}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {Refresh}
          Reset trail
        </button>
      </section>
    </div>
  );
}
