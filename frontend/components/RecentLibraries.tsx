interface Library {
  name: string;
  photos: number;
  age: string;
  gradient: string;
  shape: "triangle" | "triangle-down" | "half-circle" | "diamond";
}

// Placeholder until the backend supports a library/folder concept.
const LIBRARIES: Library[] = [
  {
    name: "trip-italy-23",
    photos: 2418,
    age: "2d ago",
    gradient: "linear-gradient(135deg, #ffd6a5 0%, #ff8fab 60%, #c084fc 100%)",
    shape: "triangle",
  },
  {
    name: "family-archive",
    photos: 8902,
    age: "12d ago",
    gradient: "linear-gradient(135deg, #c4b5fd 0%, #f0abfc 60%, #fda4af 100%)",
    shape: "triangle-down",
  },
  {
    name: "street-photo-24",
    photos: 512,
    age: "1mo",
    gradient: "linear-gradient(135deg, #fdba74 0%, #f87171 60%, #be185d 100%)",
    shape: "half-circle",
  },
  {
    name: "phone-dump-jul",
    photos: 1204,
    age: "3mo",
    gradient: "linear-gradient(135deg, #fde68a 0%, #fb923c 60%, #ec4899 100%)",
    shape: "diamond",
  },
];

function ShapeMark({ kind }: { kind: Library["shape"] }) {
  const fill = "rgba(255,255,255,0.95)";
  switch (kind) {
    case "triangle":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M12 5 L20 19 L4 19 Z" fill={fill} />
        </svg>
      );
    case "triangle-down":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M12 19 L4 5 L20 5 Z" fill={fill} />
        </svg>
      );
    case "half-circle":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M12 4 A8 8 0 0 1 12 20 Z" fill={fill} />
        </svg>
      );
    case "diamond":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M12 4 L20 12 L12 20 L4 12 Z" fill={fill} />
        </svg>
      );
  }
}

export function RecentLibraries() {
  return (
    <aside className="w-[380px] shrink-0 bg-[var(--background)] px-8 py-9 hidden xl:flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Recent libraries
        </h2>
        <span className="text-xs text-zinc-400 tabular-nums">
          {LIBRARIES.length} of 12
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {LIBRARIES.map((lib) => (
          <li key={lib.name}>
            <button
              type="button"
              className="w-full flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-left hover:border-zinc-300 transition-colors cursor-pointer"
            >
              <span
                className="flex items-center justify-center w-10 h-10 rounded-[10px] shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                style={{ background: lib.gradient }}
              >
                <ShapeMark kind={lib.shape} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-[var(--foreground)] truncate">
                  {lib.name}
                </span>
                <span className="block text-xs text-zinc-500 tabular-nums">
                  {lib.photos.toLocaleString()} photos
                </span>
              </span>
              <span className="text-xs text-zinc-400 tabular-nums">{lib.age}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 text-sm leading-relaxed">
        <span className="font-semibold text-[var(--foreground)]">Privacy-first.</span>{" "}
        <span className="text-zinc-500">
          Embeddings and originals stay on this machine. Nothing leaves localhost.
        </span>
      </div>
    </aside>
  );
}
