"use client";
import { useCallback, useRef, useState } from "react";

interface Props {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  backendReady?: boolean;
  modelLabel?: string;
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export function DropZone({
  onFiles,
  disabled,
  backendReady = true,
  modelLabel = "CLIP ViT-B/32",
}: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        ACCEPTED.includes(f.type)
      );
      if (files.length) onFiles(files);
    },
    [onFiles, disabled]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []).filter((f) =>
        ACCEPTED.includes(f.type)
      );
      if (files.length) onFiles(files);
      e.target.value = "";
    },
    [onFiles]
  );

  return (
    <div
      className={[
        "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors min-h-[640px] p-12 bg-[var(--surface)]",
        dragging
          ? "border-violet-500 bg-violet-50/60"
          : "border-zinc-300 hover:border-violet-300",
        disabled ? "opacity-60" : "",
      ].join(" ")}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        multiple
        className="sr-only"
        onChange={handleChange}
        disabled={disabled}
      />

      {/* Centred upload affordance */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="flex flex-col items-center gap-5 cursor-pointer disabled:cursor-not-allowed"
      >
        <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-100 text-violet-600">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 19V5" />
            <path d="m5 12 7-7 7 7" />
          </svg>
        </span>

        <div className="text-center">
          <p className="text-base font-semibold text-[var(--foreground)]">Drop photos here</p>
          <p className="mt-1.5 text-sm text-zinc-500">
            JPG · PNG · WEBP · up to 10,000 files
          </p>
        </div>

        <span
          className={[
            "inline-flex items-center justify-center px-5 py-2.5 rounded-full text-sm font-medium transition-colors",
            "bg-zinc-900 text-white hover:bg-zinc-800",
            disabled ? "pointer-events-none" : "",
          ].join(" ")}
        >
          Browse files
        </span>
      </button>

      {/* Backend status pinned bottom-left */}
      <div className="absolute left-5 bottom-4 flex items-center gap-2 text-xs text-zinc-500 pointer-events-none">
        <span
          className={[
            "w-1.5 h-1.5 rounded-full",
            backendReady ? "bg-emerald-500" : "bg-zinc-300",
          ].join(" ")}
        />
        <span>
          {backendReady ? "Backend ready" : "Backend offline"} · {modelLabel}
        </span>
      </div>
    </div>
  );
}
