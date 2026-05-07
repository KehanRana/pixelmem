"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { SystemStatus } from "@/lib/types";

interface NavItemDef {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const ArrowUp = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 19V5" />
    <path d="m5 12 7-7 7 7" />
  </svg>
);

const Target = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const Grid = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </svg>
);

const ITEMS: NavItemDef[] = [
  { href: "/upload", label: "Upload", icon: ArrowUp },
  { href: "/explorer", label: "Explorer", icon: Target },
  { href: "/clusters", label: "Clusters", icon: Grid },
];

export function Sidebar() {
  const pathname = usePathname();
  const [status, setStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const s = await api.status();
        if (!cancelled) setStatus(s);
      } catch {}
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const total = status?.total ?? 0;
  const indexed = status?.indexed ?? 0;
  const pct = total > 0 ? Math.round((indexed / total) * 100) : 0;

  return (
    <aside className="hidden md:flex w-72 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] px-5 py-6">
      {/* Brand */}
      <div className="flex items-center gap-3 px-2 mb-7">
        <div
          className="w-9 h-9 rounded-[11px] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
          style={{
            background:
              "radial-gradient(120% 100% at 20% 20%, #fde68a 0%, #f0abfc 40%, #8b5cf6 100%)",
          }}
          aria-hidden="true"
        />
        <span className="font-semibold text-[15px] text-[var(--foreground)] tracking-tight">
          PixelMem
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1">
        {ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                active
                  ? "bg-violet-50 text-violet-700"
                  : "text-zinc-700 hover:bg-zinc-50",
              ].join(" ")}
            >
              <span
                className={[
                  "flex items-center justify-center w-8 h-8 rounded-lg",
                  active ? "bg-violet-200/60 text-violet-700" : "bg-zinc-100 text-zinc-500",
                ].join(" ")}
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      {/* Status card */}
      {status && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-lg font-semibold text-[var(--foreground)] tabular-nums tracking-tight">
              {total.toLocaleString()}
            </span>
            <span className="text-xs text-zinc-500">photos</span>
          </div>
          <div className="h-1 bg-zinc-100 rounded-full overflow-hidden mb-2.5">
            <div
              className="h-full bg-emerald-500 transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="tabular-nums">{indexed.toLocaleString()} indexed</span>
            {status.processing > 0 && (
              <span className="text-amber-600 ml-auto tabular-nums">
                {status.processing} working
              </span>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
