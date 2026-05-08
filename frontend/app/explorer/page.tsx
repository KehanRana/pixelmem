"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ExplorerToolbar } from "@/components/ExplorerToolbar";
import { ImageGrid } from "@/components/ImageGrid";
import { SelectedPanel } from "@/components/SelectedPanel";
import { api } from "@/lib/api";
import type {
  Cluster,
  ClustersResponse,
  ImageRecord,
  SearchResult,
} from "@/lib/types";

type GridItem = ImageRecord | SearchResult;

interface TrailEntry {
  id: string;
  thumbnail_url: string;
  filename: string;
}

const VIEW_OPTIONS = ["Grid", "Orbit", "Stream"] as const;
type View = (typeof VIEW_OPTIONS)[number];

export default function ExplorerPage() {
  const searchParams = useSearchParams();
  const startParam = searchParams.get("start");

  const [allImages, setAllImages] = useState<ImageRecord[]>([]);
  const [anchorDetail, setAnchorDetail] = useState<ImageRecord | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [trail, setTrail] = useState<TrailEntry[]>([]);
  const [clusters, setClusters] = useState<ClustersResponse | null>(null);
  const [k, setK] = useState(24);
  const [view, setView] = useState<View>("Grid");
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const loadAnchor = useCallback(
    async (id: string, kVal: number, pushTrail: boolean) => {
      setLoading(true);
      try {
        const [detail, search] = await Promise.all([
          api.getImage(id),
          api.search(id, kVal),
        ]);
        if (pushTrail && anchorDetail) {
          setTrail((t) => [
            ...t,
            {
              id: anchorDetail.id,
              thumbnail_url: anchorDetail.thumbnail_url,
              filename: anchorDetail.filename,
            },
          ]);
        }
        setAnchorDetail(detail);
        setResults(search.results);
      } finally {
        setLoading(false);
      }
    },
    [anchorDetail]
  );

  // Initial load — list ready images and kick off cluster fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const imgs = await api.listImages("ready");
        if (cancelled) return;
        setAllImages(imgs);

        api
          .clusters(12, false)
          .then((c) => !cancelled && setClusters(c))
          .catch(() => {});

        // Pick the first image as a default anchor only if there's no
        // ?start= deep link. The other effect handles the targeted case.
        if (!startParam && imgs[0]) {
          await loadAnchor(imgs[0].id, k, /*pushTrail=*/ false);
        }
      } finally {
        if (!cancelled) setInitialLoad(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to ?start= changes — fires both on initial mount with a deep link
  // and on every subsequent navigation that updates the param (e.g., a
  // Clusters → Explorer click while the route is already in the cache).
  useEffect(() => {
    if (!startParam) return;
    queueMicrotask(() => {
      void loadAnchor(startParam, k, /*pushTrail=*/ false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startParam]);

  const selectImage = useCallback(
    (img: GridItem) => {
      if (img.id === anchorDetail?.id) return;
      void loadAnchor(img.id, k, /*pushTrail=*/ true);
    },
    [anchorDetail, k, loadAnchor]
  );

  const goBack = useCallback(() => {
    if (trail.length === 0) return;
    const prev = trail[trail.length - 1];
    setTrail((t) => t.slice(0, -1));
    void loadAnchor(prev.id, k, /*pushTrail=*/ false);
  }, [trail, k, loadAnchor]);

  const pickTrail = useCallback(
    (entry: TrailEntry) => {
      // Truncate trail at the chosen entry (rewind history)
      setTrail((t) => {
        const idx = t.findIndex((x) => x.id === entry.id);
        return idx >= 0 ? t.slice(0, idx) : t;
      });
      void loadAnchor(entry.id, k, /*pushTrail=*/ false);
    },
    [k, loadAnchor]
  );

  const resetTrail = useCallback(() => {
    setTrail([]);
  }, []);

  const onChangeK = useCallback(
    (newK: number) => {
      setK(newK);
      if (anchorDetail) {
        void api.search(anchorDetail.id, newK).then((res) => setResults(res.results));
      }
    },
    [anchorDetail]
  );

  // Find anchor's cluster — sorted clusters come back largest-first, so position == "Group N"
  const anchorCluster = (() => {
    if (!clusters || !anchorDetail) return { cluster: null, label: null, size: null };
    const idx = clusters.clusters.findIndex((c: Cluster) =>
      c.members.some((m) => m.id === anchorDetail.id)
    );
    if (idx < 0) return { cluster: null, label: null, size: null };
    const c = clusters.clusters[idx];
    return { cluster: c, label: `Cluster ${idx + 1}`, size: c.size };
  })();

  const topMatchPct =
    results.length > 0 ? results[0].similarity_score * 100 : null;

  return (
    <div className="flex flex-col min-h-dvh">
      <ExplorerToolbar
        anchorFilename={anchorDetail?.filename ?? null}
        clusterLabel={anchorCluster.label}
        k={k}
        onChangeK={onChangeK}
        onBack={goBack}
        canGoBack={trail.length > 0}
      />

      <div className="flex flex-1 min-h-0">
        <aside className="w-[360px] shrink-0 border-r border-[var(--border)] bg-[var(--surface)] px-7 py-7 overflow-y-auto">
          <SelectedPanel
            anchor={anchorDetail}
            topMatchPct={topMatchPct}
            clusterLabel={anchorCluster.label}
            clusterSize={anchorCluster.size}
            trail={trail}
            onPickTrail={pickTrail}
            onResetTrail={resetTrail}
          />
        </aside>

        <main className="flex-1 min-w-0 px-8 py-6 overflow-y-auto">
          <header className="flex items-center justify-between mb-5 gap-4">
            <p className="text-sm">
              <span className="font-semibold text-[var(--foreground)] tabular-nums">
                {anchorDetail ? `${results.length} similar` : `${allImages.length} images`}
              </span>{" "}
              <span className="text-zinc-500">
                {anchorDetail ? "— sorted by cosine similarity" : "— pick one to anchor"}
              </span>
            </p>

            <div className="flex items-center gap-0.5 p-1 rounded-full bg-zinc-100/80 border border-[var(--border)]">
              {VIEW_OPTIONS.map((opt) => {
                const active = opt === view;
                const disabled = opt !== "Grid";
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={disabled}
                    onClick={() => !disabled && setView(opt)}
                    title={disabled ? "Coming soon" : undefined}
                    className={[
                      "px-3 py-1 rounded-full text-sm transition-colors",
                      active
                        ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                        : disabled
                        ? "text-zinc-400 cursor-not-allowed"
                        : "text-zinc-600 hover:text-zinc-900 cursor-pointer",
                    ].join(" ")}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </header>

          <ImageGrid
            images={anchorDetail ? results : allImages}
            selectedId={anchorDetail?.id ?? null}
            onSelect={selectImage}
            loading={initialLoad || loading}
            highlightTop={Boolean(anchorDetail) && results.length > 0}
          />
        </main>
      </div>
    </div>
  );
}
