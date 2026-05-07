"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageGrid } from "@/components/ImageGrid";
import { SelectedPanel } from "@/components/SelectedPanel";
import { StatusBar } from "@/components/StatusBar";
import { api } from "@/lib/api";
import type { ImageRecord, SearchResult, SystemStatus } from "@/lib/types";

type AnyImage = ImageRecord | SearchResult;

export default function ExplorerPage() {
  const router = useRouter();

  const [allImages, setAllImages] = useState<ImageRecord[]>([]);
  const [gridImages, setGridImages] = useState<AnyImage[]>([]);
  const [selected, setSelected] = useState<AnyImage | null>(null);
  const [history, setHistory] = useState<AnyImage[]>([]);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  // Load the full library on mount
  useEffect(() => {
    const load = async () => {
      const [imgs, s] = await Promise.all([
        api.listImages("ready"),
        api.status(),
      ]);
      setAllImages(imgs);
      setGridImages(imgs);
      setStatus(s);
      
      // Check for start parameter in URL
      const params = new URLSearchParams(window.location.search);
      const startId = params.get("start");
      if (startId) {
        const startImg = imgs.find((i) => i.id === startId);
        if (startImg) {
          // Set selected and load similar images
          setSelected(startImg);
          setLoading(true);
          try {
            const res = await api.search(startImg.id, 24);
            setGridImages(res.results);
          } catch {
            setGridImages(imgs);
          } finally {
            setLoading(false);
          }
        }
      }
      
      setInitialLoad(false);
    };
    load();
  }, []);

  const selectImage = useCallback(
    async (img: AnyImage) => {
      // Push current selection onto history before changing
      if (selected) setHistory((h) => [...h, selected]);

      setSelected(img);
      setLoading(true);

      try {
        const res = await api.search(img.id, 24);
        setGridImages(res.results);
      } catch {
        // Fall back to full library on search failure
        setGridImages(allImages);
      } finally {
        setLoading(false);
      }
    },
    [selected, allImages]
  );

  const goBack = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setSelected(prev);
    setLoading(true);
    api
      .search(prev.id, 24)
      .then((res) => setGridImages(res.results))
      .catch(() => setGridImages(allImages))
      .finally(() => setLoading(false));
  }, [history, allImages]);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col">

      {/* Navbar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <button
          onClick={() => router.push("/upload")}
          className="text-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
        >
          ← Upload
        </button>
        <h1 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Visual Memory Search
        </h1>
        <button
          onClick={() => router.push("/clusters")}
          className="text-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
        >
          Clusters →
        </button>
      </header>

      {/* Status bar */}
      {status && (
        <div className="px-6 py-2 border-b border-zinc-100 dark:border-zinc-800">
          <StatusBar status={status} />
        </div>
      )}

      {/* Main two-panel layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left panel — selected image */}
        <aside className="w-64 shrink-0 border-r border-zinc-100 dark:border-zinc-800 p-5 overflow-y-auto">
          <SelectedPanel
            image={selected}
            onBack={goBack}
            canGoBack={history.length > 0}
          />
        </aside>

        {/* Right panel — similar images grid */}
        <main className="flex-1 p-5 overflow-y-auto">
          {!selected && !initialLoad && (
            <p className="text-sm text-zinc-400 mb-4">
              {allImages.length} images — click one to start exploring
            </p>
          )}
          {selected && (
            <p className="text-sm text-zinc-400 mb-4">
              {loading ? "Finding similar images…" : `${gridImages.length} similar images`}
            </p>
          )}
          <ImageGrid
            images={initialLoad ? [] : gridImages}
            selectedId={selected?.id ?? null}
            onSelect={selectImage}
            loading={initialLoad || loading}
          />
        </main>
      </div>
    </div>
  );
}