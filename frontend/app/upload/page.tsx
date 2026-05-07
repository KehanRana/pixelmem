"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DropZone } from "@/components/DropZone";
import { StatusBar } from "@/components/StatusBar";
import { api } from "@/lib/api";
import type { SystemStatus } from "@/lib/types";

interface FileEntry {
  name: string;
  state: "queued" | "uploading" | "done" | "error";
  error?: string;
}

export default function UploadPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [uploading, setUploading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll system status while images are being embedded
  useEffect(() => {
    const tick = async () => {
      try {
        const s = await api.status();
        setStatus(s);
        // Stop polling once nothing is in-flight
        if (s.pending === 0 && s.processing === 0 && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch {
        // silently ignore
      }
    };
    tick();
    pollRef.current = setInterval(tick, 1500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleFiles = async (files: File[]) => {
    setUploading(true);
    const newEntries: FileEntry[] = files.map((f) => ({
      name: f.name,
      state: "queued",
    }));
    setEntries((prev) => [...prev, ...newEntries]);

    // Upload in batches of 5 so we don't overwhelm the server
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
        setEntries((prev) =>
          prev.map((e) =>
            batchNames.includes(e.name) && e.state === "uploading"
              ? { ...e, state: "done" }
              : e
          )
        );
      } catch (err) {
        setEntries((prev) =>
          prev.map((e) =>
            batchNames.includes(e.name) && e.state === "uploading"
              ? { ...e, state: "error", error: String(err) }
              : e
          )
        );
      }
    }
    setUploading(false);

    // Restart polling for embedding progress
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

  const stateIcon: Record<FileEntry["state"], string> = {
    queued: "○",
    uploading: "◌",
    done: "✓",
    error: "✗",
  };
  const stateColor: Record<FileEntry["state"], string> = {
    queued: "text-zinc-400",
    uploading: "text-amber-500 animate-pulse",
    done: "text-emerald-500",
    error: "text-red-500",
  };

  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950 p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-zinc-900 dark:text-zinc-100 mb-1">
          Visual Memory Search
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">
          Upload photos to start exploring by visual similarity.
        </p>
      </div>

      <DropZone onFiles={handleFiles} disabled={uploading} />

      {entries.length > 0 && (
        <ul className="mt-6 space-y-1.5 max-h-72 overflow-y-auto">
          {entries.map((e, i) => (
            <li
              key={i}
              className="flex items-center gap-3 text-sm py-1"
            >
              <span className={`font-mono w-4 ${stateColor[e.state]}`}>
                {stateIcon[e.state]}
              </span>
              <span className="text-zinc-700 dark:text-zinc-300 truncate flex-1">
                {e.name}
              </span>
              {e.error && (
                <span className="text-red-400 text-xs truncate max-w-32">
                  {e.error}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {status && (
        <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
          <StatusBar status={status} />
        </div>
      )}

      {status && status.indexed > 0 && (
        <div className="mt-8 flex gap-3">
          <button
            onClick={() => router.push("/explorer")}
            className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
          >
            Explore library →
          </button>
          <button
            onClick={() => router.push("/clusters")}
            className="px-5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 text-sm font-medium transition-colors"
          >
            View clusters
          </button>
        </div>
      )}
    </main>
  );
}