"use client";
import { useEffect, useRef } from "react";
import type { ImageRecord, SearchResult } from "@/lib/types";

type GridImage = ImageRecord | SearchResult;

interface Props {
  images: GridImage[];
  selectedId: string | null;
  onSelect: (img: GridImage) => void;
  loading?: boolean;
  highlightTop?: boolean;
}

function isSearchResult(img: GridImage): img is SearchResult {
  return "similarity_score" in img;
}

export function ImageGrid({
  images,
  selectedId,
  onSelect,
  loading,
  highlightTop = false,
}: Props) {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gridRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [images]);

  if (loading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-xl bg-zinc-100 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-400 text-sm">
        No images found.
      </div>
    );
  }

  return (
    <div
      ref={gridRef}
      className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3"
    >
      {images.map((img, i) => {
        const isSelected = img.id === selectedId;
        const score = isSearchResult(img) ? img.similarity_score : null;
        const isTop = highlightTop && i === 0;

        return (
          <button
            key={img.id}
            type="button"
            onClick={() => onSelect(img)}
            className={[
              "relative aspect-square rounded-xl overflow-hidden cursor-pointer transition-all duration-150",
              "ring-offset-2 ring-offset-[var(--background)]",
              isSelected
                ? "ring-2 ring-violet-500"
                : isTop
                ? "ring-2 ring-violet-500"
                : "hover:ring-2 hover:ring-zinc-300",
            ].join(" ")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.thumbnail_url}
              alt={img.filename}
              loading="lazy"
              className="w-full h-full object-cover"
            />

            {isTop && (
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-violet-600 text-white text-[10px] font-bold tracking-[0.08em]">
                TOP
              </span>
            )}

            {score !== null && (
              <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-zinc-900/95 text-white text-[11px] font-semibold tabular-nums">
                {Math.round(score * 100)}%
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
