"use client";

import { useEffect, type ReactNode } from "react";

/** Khung hộp thoại dùng chung: giữa màn hình trên máy tính, trượt từ dưới lên trên điện thoại. */
export function Modal({
  title,
  subtitle,
  tone = "from-orange-500 to-pink-500",
  size = "md",
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  tone?: string;
  size?: "md" | "lg" | "xl";
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="absolute inset-0 z-40 flex items-end justify-center bg-sky-950/40 p-2 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`panel animate-pop flex max-h-full w-full flex-col overflow-hidden ${size === "xl" ? "sm:max-w-6xl" : size === "lg" ? "sm:max-w-3xl" : "sm:max-w-lg"}`}
      >
        <header className={`sport-stripes flex shrink-0 items-start justify-between gap-3 bg-gradient-to-r px-4 py-3 ${tone}`}>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-extrabold leading-tight text-white drop-shadow-sm">{title}</h2>
            {subtitle && <p className="text-xs font-semibold text-white/90">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Đóng" className="btn btn-ghost shrink-0 !px-2.5 !py-1 !shadow-none">
            ✕
          </button>
        </header>
        <div className="thin-scroll flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">{children}</div>
        {footer && (
          <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t-2 border-slate-100 px-4 py-3">{footer}</footer>
        )}
      </div>
    </div>
  );
}

export function SectionTitle({ step, children }: { step?: number; children: ReactNode }) {
  return (
    <h3 className="font-display mb-1.5 flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wide text-slate-700">
      {step && <span className="grid size-5 place-items-center rounded-full bg-orange-500 text-[11px] text-white">{step}</span>}
      {children}
    </h3>
  );
}
