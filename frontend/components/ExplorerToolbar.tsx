"use client";
import { SegmentedPill } from "./SegmentedPill";

interface Props {
  anchorFilename: string | null;
  clusterLabel: string | null;
  k: number;
  onChangeK: (k: number) => void;
  onBack: () => void;
  canGoBack: boolean;
}

const K_OPTIONS = [6, 12, 24] as const;

const Chevron = (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m6 4 4 4-4 4" />
  </svg>
);

const ArrowLeft = (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 4 6 8l4 4" />
  </svg>
);

export function ExplorerToolbar({
  anchorFilename,
  clusterLabel,
  k,
  onChangeK,
  onBack,
  canGoBack,
}: Props) {
  return (
    <header className="flex items-center justify-between gap-6 px-8 py-4 border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center gap-4 min-w-0">
        <button
          type="button"
          onClick={onBack}
          disabled={!canGoBack}
          className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 hover:text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {ArrowLeft}
          Back
        </button>

        <nav className="flex items-center gap-2 min-w-0 text-sm" aria-label="Breadcrumb">
          <span className="text-zinc-700 font-medium">Library</span>
          {clusterLabel && (
            <>
              <span className="text-zinc-400">{Chevron}</span>
              <span className="text-violet-600 font-medium truncate">{clusterLabel}</span>
            </>
          )}
          {anchorFilename && (
            <>
              <span className="text-zinc-400">{Chevron}</span>
              <span className="text-zinc-700 font-medium truncate">{anchorFilename}</span>
            </>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <SegmentedPill
          options={K_OPTIONS}
          value={k}
          onChange={onChangeK}
          format={(v) => `k=${v}`}
          ariaLabel="Number of similar images"
        />
        <span className="px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] text-sm text-zinc-700">
          cosine
        </span>
      </div>
    </header>
  );
}
