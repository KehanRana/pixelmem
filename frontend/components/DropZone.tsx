"use client";
import { useCallback, useState } from "react";

interface Props {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export function DropZone({ onFiles, disabled }: Props) {
  const [dragging, setDragging] = useState(false);

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
    <label
      className={[
        "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed",
        "cursor-pointer select-none transition-colors p-16",
        dragging
          ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30"
          : "border-zinc-300 dark:border-zinc-700 hover:border-violet-400 hover:bg-zinc-50 dark:hover:bg-zinc-900",
        disabled ? "opacity-50 cursor-not-allowed" : "",
      ].join(" ")}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <span className="text-4xl">🖼</span>
      <span className="text-zinc-600 dark:text-zinc-400 text-sm text-center">
        Drop photos here or click to browse
        <br />
        <span className="text-zinc-400 dark:text-zinc-500">
          JPG · PNG · WEBP
        </span>
      </span>
      <input
        type="file"
        accept={ACCEPTED.join(",")}
        multiple
        className="sr-only"
        onChange={handleChange}
        disabled={disabled}
      />
    </label>
  );
}