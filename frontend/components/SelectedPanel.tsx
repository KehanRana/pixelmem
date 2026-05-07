import type { ImageRecord, SearchResult } from "@/lib/types";

interface Props {
  image: ImageRecord | SearchResult | null;
  onBack: () => void;
  canGoBack: boolean;
}

function isSearchResult(img: ImageRecord | SearchResult): img is SearchResult {
  return "similarity_score" in img;
}

export function SelectedPanel({ image, onBack, canGoBack }: Props) {
  if (!image) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400 dark:text-zinc-600 text-sm">
        Click any image to explore
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {canGoBack && (
        <button
          onClick={onBack}
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center gap-1.5 w-fit transition-colors"
        >
          ← Back
        </button>
      )}

      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900">
        <img
          src={image.thumbnail_url}
          alt={image.filename}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="space-y-1 text-sm">
        <p className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
          {image.filename}
        </p>
        <p className="text-zinc-400 dark:text-zinc-500">
          {image.width} × {image.height}px
        </p>
        {isSearchResult(image) && (
          <p className="text-violet-600 dark:text-violet-400">
            {(image.similarity_score * 100).toFixed(1)}% similar
          </p>
        )}

        <a
          href={image.original_url ?? image.thumbnail_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors mt-1"
        >
          View original ↗
        </a>
      </div>
    </div>
  );
}