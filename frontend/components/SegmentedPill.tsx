"use client";

interface Props<T extends string | number> {
  options: readonly T[];
  value: T;
  onChange?: (v: T) => void;
  format?: (v: T) => string;
  disabledOptions?: readonly T[];
  ariaLabel?: string;
}

export function SegmentedPill<T extends string | number>({
  options,
  value,
  onChange,
  format = (v) => String(v),
  disabledOptions = [],
  ariaLabel,
}: Props<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex items-center gap-0.5 p-1 rounded-full bg-zinc-100/80 border border-[var(--border)]"
    >
      {options.map((opt) => {
        const active = opt === value;
        const disabled = disabledOptions.includes(opt);
        return (
          <button
            key={String(opt)}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => !disabled && onChange?.(opt)}
            title={disabled ? "Coming soon" : undefined}
            className={[
              "px-3 py-1 rounded-full text-sm transition-colors tabular-nums",
              active
                ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                : disabled
                ? "text-zinc-400 cursor-not-allowed"
                : "text-zinc-600 hover:text-zinc-900 cursor-pointer",
            ].join(" ")}
          >
            {format(opt)}
          </button>
        );
      })}
    </div>
  );
}
