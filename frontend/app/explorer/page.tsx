"use client";
import { useCallback, useEffect, useState } from "react";
import { ImageGrid } from "@/components/ImageGrid";
import { SelectedPanel } from "@/components/SelectedPanel";
import { api } from "@/lib/api";
import type { ImageRecord, SearchResult } from "@/lib/types";

type AnyImage = ImageRecord | SearchResult;

export default function ExplorerPage() {
  const [allImages, setAllImages] = useState<ImageRecord[]>([]);
  const [gridImages, setGridImages] = useState<AnyImage[]>([]);
  const [selected, setSelected] = useState<AnyImage | null>(null);
  const [history, setHistory] = useState<AnyImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    const load = async () => {
      const imgs = await api.listImages("ready");
      setAllImages(imgs);
      setGridImages(imgs);

      const params = new URLSearchParams(window.location.search);
      const startId = params.get("start");
      if (startId) {
        const startImg = imgs.find((i) => i.id === startId);
        if (startImg) {
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
      if (selected) setHistory((h) => [...h, selected]);
      setSelected(img);
      setLoading(true);
      try {
        const res = await api.search(img.id, 24);
        setGridImages(res.results);
      } catch {
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
    <div className="flex h-dvh">
      <aside className="w-72 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] p-6 overflow-y-auto">
        <SelectedPanel
          image={selected}
          onBack={goBack}
          canGoBack={history.length > 0}
        />
      </aside>

      <main className="flex-1 min-w-0 px-8 py-6 overflow-y-auto">
        <header className="mb-5">
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--foreground)]">
            Explorer
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {!selected && !initialLoad && `${allImages.length} images. Click any to start exploring.`}
            {selected && (loading ? "Finding similar images…" : `${gridImages.length} similar images`)}
            {initialLoad && "Loading library…"}
          </p>
        </header>

        <ImageGrid
          images={initialLoad ? [] : gridImages}
          selectedId={selected?.id ?? null}
          onSelect={selectImage}
          loading={initialLoad || loading}
        />
      </main>
    </div>
  );
}
