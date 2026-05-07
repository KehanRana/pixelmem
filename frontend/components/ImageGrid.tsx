"use client";
import { useEffect, useRef } from "react";
import type { ImageRecord, SearchResult } from "@/lib/types";

type GridImage = ImageRecord | SearchResult;

interface Props {
  images: GridImage[];
  selectedId: string | null;
  onSelect: (img: GridImage) => void;
  loading?: boolean;
}

function isSearchResult(img: GridImage): img is SearchResult {
  return "similarity_score" in img;
}

export function ImageGrid({ images, selectedId, onSelect, loading }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);

  // Scroll to top whenever the set of images changes
  useEffect(() => {
    gridRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [images]);

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-400 text-sm">
        No images found
      </div>
    );
  }

  return (
    <div
      ref={gridRef}
      className="grid grid-cols-3 gap-2 md:grid-cols-4 overflow-y-auto"
    >
      {images.map((img) => {
        const isSelected = img.id === selectedId;
        const score = isSearchResult(img) ? img.similarity_score : null;

        return (
          <button
            key={img.id}
            onClick={() => onSelect(img)}
            className={[
              "relative aspect-square rounded-lg overflow-hidden group",
              "ring-offset-2 transition-all duration-150",
              isSelected
                ? "ring-2 ring-violet-500 scale-95"
                : "hover:scale-95 hover:ring-2 hover:ring-violet-300",
            ].join(" ")}
          >
            <img
              src={img.thumbnail_url}
              alt={img.filename}
              loading="lazy"
              className="w-full h-full object-cover transition-opacity duration-200"
            />
            {score !== null && (
              <span className="absolute bottom-1 right-1 text-[10px] font-medium bg-black/60 text-white rounded px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {(score * 100).toFixed(0)}%
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}