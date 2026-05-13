import Link from "next/link";

interface Props {
  photos: number | null;
}

function ShapeMark() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M12 5 L20 19 L4 19 Z" fill="rgba(255,255,255,0.95)" />
    </svg>
  );
}

export function RecentLibraries({ photos }: Props) {
  return (
    <aside className="w-[380px] shrink-0 bg-[var(--background)] px-8 py-9 hidden xl:flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Libraries
        </h2>
        <span className="text-xs text-zinc-400 tabular-nums">1 of 1</span>
      </div>

      <ul className="flex flex-col gap-2">
        <li>
          <Link
            href="/explorer"
            className="w-full flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-left hover:border-zinc-300 transition-colors cursor-pointer"
          >
            <span
              className="flex items-center justify-center w-10 h-10 rounded-[10px] shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
              style={{
                background:
                  "linear-gradient(135deg, #ffd6a5 0%, #ff8fab 60%, #c084fc 100%)",
              }}
            >
              <ShapeMark />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-[var(--foreground)] truncate">
                Sample dataset
              </span>
              <span className="block text-xs text-zinc-500 tabular-nums">
                {photos === null
                  ? "…"
                  : `${photos.toLocaleString()} photo${photos === 1 ? "" : "s"}`}
              </span>
            </span>
            <span className="text-xs text-zinc-400">Open</span>
          </Link>
        </li>
      </ul>

      <button
        type="button"
        disabled
        title="Coming soon"
        className="flex items-center gap-2 rounded-xl border border-dashed border-[var(--border)] bg-transparent px-3 py-2.5 text-sm text-zinc-400 cursor-not-allowed"
      >
        <span className="flex items-center justify-center w-10 h-10 rounded-[10px] shrink-0 border border-dashed border-zinc-300 text-zinc-400">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        <span className="flex-1 text-left">
          <span className="block font-medium">New library</span>
          <span className="block text-xs text-zinc-400">Coming soon</span>
        </span>
      </button>

      <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 text-sm leading-relaxed">
        <span className="font-semibold text-[var(--foreground)]">Privacy-first.</span>{" "}
        <span className="text-zinc-500">
          Embeddings and originals stay on this machine. Nothing leaves localhost.
        </span>
      </div>
    </aside>
  );
}
