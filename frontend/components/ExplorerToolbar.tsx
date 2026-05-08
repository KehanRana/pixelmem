"use client";
import { useState } from "react";
import { SegmentedPill } from "./SegmentedPill";

interface Props {
  anchorFilename: string | null;
  clusterLabel: string | null;
  k: number;
  onChangeK: (k: number) => void;
  onBack: () => void;
  canGoBack: boolean;
  textQuery: string | null;
  onSubmitText: (q: string) => void;
  onClearText: () => void;
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

function SearchField({
  initial,
  onSubmit,
  onClear,
}: {
  initial: string;
  onSubmit: (q: string) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <form
      className="ml-auto flex items-center gap-2 max-w-md flex-1"
      onSubmit={(e) => {
        e.preventDefault();
        const q = draft.trim();
        if (q) onSubmit(q);
      }}
    >
      <div className="relative flex-1">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search by description… (e.g. ‘sunset over water’)"
          className="w-full pl-4 pr-9 py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400"
        />
        {draft && (
          <button
            type="button"
            onClick={() => {
              setDraft("");
              onClear();
            }}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 cursor-pointer"
          >
            ×
          </button>
        )}
      </div>
    </form>
  );
}

export function ExplorerToolbar({
  anchorFilename,
  clusterLabel,
  k,
  onChangeK,
  onBack,
  canGoBack,
  textQuery,
  onSubmitText,
  onClearText,
}: Props) {
  return (
    <header className="flex items-center justify-between gap-6 px-8 py-4 border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center gap-4 min-w-0 flex-1">
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
          {textQuery && (
            <>
              <span className="text-zinc-400">{Chevron}</span>
              <span className="text-violet-600 font-medium truncate">&ldquo;{textQuery}&rdquo;</span>
            </>
          )}
          {clusterLabel && !textQuery && (
            <>
              <span className="text-zinc-400">{Chevron}</span>
              <span className="text-violet-600 font-medium truncate">{clusterLabel}</span>
            </>
          )}
          {anchorFilename && !textQuery && (
            <>
              <span className="text-zinc-400">{Chevron}</span>
              <span className="text-zinc-700 font-medium truncate">{anchorFilename}</span>
            </>
          )}
        </nav>

        <SearchField
          key={textQuery ?? "__empty__"}
          initial={textQuery ?? ""}
          onSubmit={onSubmitText}
          onClear={onClearText}
        />
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
