"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
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

const PAGE_SIZE = 60;

export default function ExplorerPage() {
  // useSearchParams must sit inside a Suspense boundary so Next.js can prerender
  // the surrounding shell without bailing out the whole route.
  return (
    <Suspense fallback={null}>
      <ExplorerPageInner />
    </Suspense>
  );
}

function ExplorerPageInner() {
  const searchParams = useSearchParams();
  const startParam = searchParams.get("start");

  const [allImages, setAllImages] = useState<ImageRecord[]>([]);
  const [libraryTotal, setLibraryTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const [anchorDetail, setAnchorDetail] = useState<ImageRecord | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [trail, setTrail] = useState<TrailEntry[]>([]);

  const [textQuery, setTextQuery] = useState<string | null>(null);
  const [textResults, setTextResults] = useState<SearchResult[]>([]);

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
        setTextQuery(null);
        setTextResults([]);
      } catch (err) {
        toast.error("Couldn't load similar images", {
          description: err instanceof Error ? err.message : String(err),
        });
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
        const page = await api.listImages({ status: "ready", offset: 0, limit: PAGE_SIZE });
        if (cancelled) return;
        setAllImages(page.images);
        setLibraryTotal(page.total);

        api
          .clusters(12, false)
          .then((c) => !cancelled && setClusters(c))
          .catch(() => {});

        // Pick the first image as a default anchor only if there's no
        // ?start= deep link. The other effect handles the targeted case.
        if (!startParam && page.images[0]) {
          await loadAnchor(page.images[0].id, k, /*pushTrail=*/ false);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error("Couldn't load your library", {
            description: err instanceof Error ? err.message : String(err),
          });
        }
      } finally {
        if (!cancelled) setInitialLoad(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!startParam) return;
    queueMicrotask(() => {
      void loadAnchor(startParam, k, /*pushTrail=*/ false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startParam]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    if (allImages.length >= libraryTotal) return;
    setLoadingMore(true);
    try {
      const page = await api.listImages({
        status: "ready",
        offset: allImages.length,
        limit: PAGE_SIZE,
      });
      setAllImages((prev) => [...prev, ...page.images]);
      setLibraryTotal(page.total);
    } catch (err) {
      toast.error("Couldn't load more images", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoadingMore(false);
    }
  }, [allImages.length, libraryTotal, loadingMore]);

  const submitText = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const res = await api.searchText(q, k);
        setTextQuery(q);
        setTextResults(res.results);
        setAnchorDetail(null);
        setResults([]);
        setTrail([]);
      } catch (err) {
        toast.error("Search failed", {
          description: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setLoading(false);
      }
    },
    [k]
  );

  const clearText = useCallback(() => {
    setTextQuery(null);
    setTextResults([]);
  }, []);

  const selectImage = useCallback(
    (img: GridItem) => {
      if (img.id === anchorDetail?.id) return;
      void loadAnchor(img.id, k, /*pushTrail=*/ !textQuery);
    },
    [anchorDetail, k, loadAnchor, textQuery]
  );

  const goBack = useCallback(() => {
    if (trail.length === 0) return;
    const prev = trail[trail.length - 1];
    setTrail((t) => t.slice(0, -1));
    void loadAnchor(prev.id, k, /*pushTrail=*/ false);
  }, [trail, k, loadAnchor]);

  const pickTrail = useCallback(
    (entry: TrailEntry) => {
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
      if (textQuery) {
        api
          .searchText(textQuery, newK)
          .then((res) => setTextResults(res.results))
          .catch((err) =>
            toast.error("Search failed", {
              description: err instanceof Error ? err.message : String(err),
            })
          );
      } else if (anchorDetail) {
        api
          .search(anchorDetail.id, newK)
          .then((res) => setResults(res.results))
          .catch((err) =>
            toast.error("Search failed", {
              description: err instanceof Error ? err.message : String(err),
            })
          );
      }
    },
    [anchorDetail, textQuery]
  );

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

  // Three modes: text > anchor > library
  const mode: "text" | "anchor" | "library" = textQuery
    ? "text"
    : anchorDetail
    ? "anchor"
    : "library";

  const gridImages: GridItem[] =
    mode === "text" ? textResults : mode === "anchor" ? results : allImages;

  const headerCount =
    mode === "text"
      ? `${textResults.length} matches`
      : mode === "anchor"
      ? `${results.length} similar`
      : `${allImages.length} of ${libraryTotal} images`;

  const headerHint =
    mode === "text"
      ? `— for “${textQuery}”`
      : mode === "anchor"
      ? "— sorted by cosine similarity"
      : libraryTotal === 0
      ? ""
      : "— pick one to anchor";

  const showLibraryEmptyState =
    !initialLoad && mode === "library" && libraryTotal === 0;
  const showLoadMore =
    mode === "library" && allImages.length < libraryTotal;

  return (
    <div className="flex flex-col min-h-dvh">
      <ExplorerToolbar
        anchorFilename={anchorDetail?.filename ?? null}
        clusterLabel={anchorCluster.label}
        k={k}
        onChangeK={onChangeK}
        onBack={goBack}
        canGoBack={trail.length > 0}
        textQuery={textQuery}
        onSubmitText={(q) => void submitText(q)}
        onClearText={clearText}
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
                {headerCount}
              </span>{" "}
              <span className="text-zinc-500">{headerHint}</span>
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

          {showLibraryEmptyState ? (
            <div className="flex flex-col items-center justify-center text-center py-24 px-6 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]/40">
              <p className="text-base font-medium text-[var(--foreground)]">
                Your library is empty
              </p>
              <p className="mt-1.5 text-sm text-zinc-500 max-w-sm">
                Upload some photos to start exploring visual neighbours and clusters.
              </p>
              <Link
                href="/upload"
                className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors"
              >
                Upload photos
              </Link>
            </div>
          ) : (
            <>
              <ImageGrid
                images={gridImages}
                selectedId={anchorDetail?.id ?? null}
                onSelect={selectImage}
                loading={initialLoad || loading}
                highlightTop={mode !== "library" && gridImages.length > 0}
              />

              {showLoadMore && !initialLoad && !loading && (
                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    onClick={() => void loadMore()}
                    disabled={loadingMore}
                    className="px-5 py-2 rounded-full border border-[var(--border)] bg-[var(--surface)] text-sm font-medium text-zinc-700 hover:text-zinc-900 hover:border-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {loadingMore
                      ? "Loading…"
                      : `Load ${Math.min(PAGE_SIZE, libraryTotal - allImages.length)} more`}
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
