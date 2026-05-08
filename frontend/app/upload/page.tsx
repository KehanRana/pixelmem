"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DropZone } from "@/components/DropZone";
import { RecentLibraries } from "@/components/RecentLibraries";
import { api } from "@/lib/api";
import type { SystemStatus } from "@/lib/types";

interface FileEntry {
  name: string;
  state: "queued" | "uploading" | "done" | "error";
  error?: string;
}

const StateIcon = ({ state }: { state: FileEntry["state"] }) => {
  if (state === "done") {
    return (
      <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500" aria-hidden="true">
        <path d="m4 10 4 4 8-9" />
      </svg>
    );
  }
  if (state === "error") {
    return (
      <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-500" aria-hidden="true">
        <path d="M5 5l10 10M15 5L5 15" />
      </svg>
    );
  }
  if (state === "uploading") {
    return (
      <svg viewBox="0 0 20 20" width="14" height="14" className="text-amber-500 animate-spin" aria-hidden="true">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.25" />
        <path d="M17 10a7 7 0 0 1-7 7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <span className="block w-1.5 h-1.5 rounded-full bg-zinc-300" aria-hidden="true" />
  );
};

export default function UploadPage() {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [uploading, setUploading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const tick = async () => {
      try {
        const s = await api.status();
        setStatus(s);
        if (s.pending === 0 && s.processing === 0 && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch {}
    };
    tick();
    pollRef.current = setInterval(tick, 1500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleFiles = async (files: File[]) => {
    setUploading(true);
    const newEntries: FileEntry[] = files.map((f) => ({ name: f.name, state: "queued" }));
    setEntries((prev) => [...prev, ...newEntries]);

    let succeeded = 0;
    const BATCH = 5;
    for (let i = 0; i < files.length; i += BATCH) {
      const batch = files.slice(i, i + BATCH);
      const batchNames = batch.map((f) => f.name);

      setEntries((prev) =>
        prev.map((e) =>
          batchNames.includes(e.name) && e.state === "queued"
            ? { ...e, state: "uploading" }
            : e
        )
      );

      try {
        await api.upload(batch);
        succeeded += batch.length;
        setEntries((prev) =>
          prev.map((e) =>
            batchNames.includes(e.name) && e.state === "uploading"
              ? { ...e, state: "done" }
              : e
          )
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setEntries((prev) =>
          prev.map((e) =>
            batchNames.includes(e.name) && e.state === "uploading"
              ? { ...e, state: "error", error: msg }
              : e
          )
        );
        toast.error(`Upload failed for ${batch.length} file${batch.length === 1 ? "" : "s"}`, {
          description: msg,
        });
      }
    }
    setUploading(false);
    if (succeeded > 0) {
      toast.success(`Queued ${succeeded} file${succeeded === 1 ? "" : "s"} for embedding`);
    }

    if (!pollRef.current) {
      pollRef.current = setInterval(async () => {
        const s = await api.status();
        setStatus(s);
        if (s.pending === 0 && s.processing === 0 && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }, 1500);
    }
  };

  const backendReady = status !== null;

  return (
    <div className="flex min-h-dvh">
      {/* Centre column — fills available space so the right rail sits flush */}
      <section className="flex-1 min-w-0 px-12 py-9">
        <header className="mb-7">
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--foreground)]">
            Upload photos
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Drop a folder or pick files. Embeddings generate locally.
          </p>
        </header>

        <DropZone
          onFiles={handleFiles}
          disabled={uploading}
          backendReady={backendReady}
        />

        {entries.length > 0 && (
          <ul className="mt-6 space-y-1.5 max-h-72 overflow-y-auto">
            {entries.map((e, i) => (
              <li key={i} className="flex items-center gap-3 text-sm py-1">
                <span className="flex items-center justify-center w-4 h-4 shrink-0">
                  <StateIcon state={e.state} />
                </span>
                <span className="text-zinc-700 truncate flex-1">{e.name}</span>
                {e.error && (
                  <span className="text-red-400 text-xs truncate max-w-32">
                    {e.error}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <RecentLibraries />
    </div>
  );
}
