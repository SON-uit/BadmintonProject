"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { matchesOfDay } from "@/lib/logic";
import { useGame } from "@/lib/store";
import { GENDER_COLOR } from "@/lib/types";
import Dialogs from "./Dialogs";
import MemberPanel from "./MemberPanel";
import Scene, { type HudInsets } from "./scene/Scene";
import StatsPanel from "./StatsPanel";

/** Dưới ngưỡng này bảng thành viên chuyển thành ngăn kéo phía dưới (điện thoại dọc). */
const SHEET_BREAKPOINT = 768;
const SIDE_PANEL_WIDTH = 328;

function useViewport() {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);
  return size;
}

function TopBar({
  barRef,
  onOpenStats,
  onFit,
}: {
  barRef: RefObject<HTMLElement | null>;
  onOpenStats: () => void;
  onFit: () => void;
}) {
  const courts = useGame((s) => s.courts);
  const matches = useGame((s) => s.matches);
  const addCourt = useGame((s) => s.addCourt);
  const openDialog = useGame((s) => s.openDialog);
  const theme = useGame((s) => s.theme);
  const toggleTheme = useGame((s) => s.toggleTheme);
  const playing = courts.filter((c) => c.status === "playing").length;
  const todayCount = matchesOfDay(matches).length;

  return (
    <header
      ref={barRef}
      className="panel absolute inset-x-2 top-2 z-30 flex flex-wrap items-center gap-x-2 gap-y-1.5 px-2.5 py-2 md:inset-x-3 md:top-3 md:gap-x-3 md:px-3"
    >
      <div className="flex w-full min-w-0 items-center gap-2 md:contents">
      <div className="flex min-w-0 items-center gap-2 pr-1">
        <span className="sport-stripes grid size-9 shrink-0 -rotate-6 place-items-center rounded-xl bg-gradient-to-br from-orange-400 to-pink-500 text-xl shadow-md md:size-11 md:rounded-2xl md:text-2xl">
          🏸
        </span>
        <div className="min-w-0 leading-none">
          <h1 className="font-display truncate max-sm:sr-only bg-gradient-to-r from-orange-500 via-pink-500 to-sky-500 bg-clip-text pr-1 text-base font-extrabold italic tracking-wide text-transparent md:text-xl">
            SAPSAN CẦU LÔNG
          </h1>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
            {courts.length} sân · <span className="text-orange-600">{playing} đang đánh</span>
          </p>
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 md:order-3 md:gap-2">
        <button
          className="btn btn-ghost compact:!px-2.5"
          onClick={() => openDialog({ kind: "cleanup" })}
          title="Xóa nhanh thành viên / sân"
          aria-label="Dọn dẹp"
        >
          🧹<span className="compact:hidden max-lg:hidden"> Dọn dẹp</span>
        </button>
        <button
          className="btn btn-ghost compact:!px-2.5"
          onClick={onFit}
          title="Đưa camera về góc nhìn thấy toàn bộ sân"
          aria-label="Căn giữa"
        >
          🎯<span className="compact:hidden max-lg:hidden"> Căn giữa</span>
        </button>
        <button
          className="btn btn-ghost compact:!px-2.5"
          onClick={toggleTheme}
          title={theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
          aria-label={theme === "dark" ? "Giao diện sáng" : "Giao diện tối"}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
        <button
          className="btn btn-green compact:!px-2.5"
          onClick={() => openDialog({ kind: "billing" })}
          title="Tính tiền sân + cầu theo thời gian có mặt, xuất ảnh"
          aria-label="Tính tiền"
        >
          💰<span className="compact:hidden max-lg:hidden"> Tính tiền</span>
        </button>
        <button className="btn btn-sky compact:!px-2.5" onClick={onOpenStats} aria-label="Thống kê">
          📊<span className="compact:hidden"> Thống kê</span>
          <span className="rounded-full bg-white px-1.5 text-xs tabular-nums text-sky-600">{todayCount}</span>
        </button>
      </div>
      </div>

      {/* màn hình hẹp: hai nút chính xuống dòng thứ hai, chia đôi bề ngang */}
      <div className="flex w-full items-center gap-1.5 md:order-2 md:w-auto md:gap-2">
        <button className="btn btn-primary max-md:flex-1" onClick={addCourt} aria-label="Thêm sân">
          ＋ Thêm sân
        </button>
        <button
          className="btn btn-amber max-md:flex-1"
          onClick={() => openDialog({ kind: "arrange", courtId: null })}
          title="Chọn sân, thể loại và tính chất trận rồi tự xếp người"
          aria-label="Xếp trận"
        >
          🎲 Xếp trận
        </button>
      </div>
    </header>
  );
}

/** Thanh hiện những người đang được bấm chọn + nút xếp nhanh vào từng sân còn chỗ. */
function SelectionBar() {
  const selectedIds = useGame((s) => s.selectedIds);
  const members = useGame((s) => s.members);
  const courts = useGame((s) => s.courts);
  const toggleSelect = useGame((s) => s.toggleSelect);
  const clearSelection = useGame((s) => s.clearSelection);
  const placeSelected = useGame((s) => s.placeSelected);

  const selected = useMemo(() => {
    const byId = new Map(members.map((m) => [m.id, m]));
    return selectedIds.map((id) => byId.get(id)).filter((m) => !!m);
  }, [selectedIds, members]);

  if (selected.length === 0) return null;
  const openCourts = courts.filter((c) => c.status === "idle" && c.slots.some((s) => !s));

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-2"
      style={{ bottom: "calc(var(--hud-bottom) + 4px)" }}
    >
      <div className="panel animate-pop pointer-events-auto max-w-full space-y-1.5 !border-pink-400 px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-display text-sm font-extrabold text-pink-600">ĐÃ CHỌN {selected.length}/4</span>
          {selected.map((m, i) => (
            <button
              key={m.id}
              onClick={() => toggleSelect(m.id)}
              title="Bỏ chọn người này"
              className="flex cursor-pointer items-center gap-1 rounded-full bg-pink-500 py-0.5 pl-1 pr-2 text-xs font-bold text-white transition hover:bg-pink-400"
            >
              <span className="grid size-4 place-items-center rounded-full bg-white text-[10px] font-extrabold text-pink-600">
                {i + 1}
              </span>
              <span className="size-2 rounded-full ring-1 ring-white" style={{ background: GENDER_COLOR[m.gender] }} />
              {m.name}
              <span className="opacity-70">✕</span>
            </button>
          ))}
          <button className="btn btn-ghost ml-auto !px-2.5 !py-1 !text-xs" onClick={clearSelection}>
            Bỏ chọn
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Xếp vào sân">
          <span className="text-xs font-bold text-slate-600">👉 Xếp vào:</span>
          {openCourts.length === 0 ? (
            <span className="text-xs font-semibold text-slate-500">chưa có sân nào còn chỗ</span>
          ) : (
            openCourts.map((c) => (
              <button
                key={c.id}
                className="btn btn-pink !rounded-xl !px-2.5 !py-1 !text-xs"
                onClick={() => placeSelected(c.id)}
              >
                {c.name}
                <span className="rounded-full bg-white/25 px-1 text-[10px] tabular-nums">
                  {c.slots.filter(Boolean).length}/4
                </span>
              </button>
            ))
          )}
          <span className="text-[11px] font-medium text-slate-500 compact:hidden">hoặc bấm thẳng vào sân</span>
        </div>
      </div>
    </div>
  );
}

/** Đồng hồ giờ hiện tại, đặt giữa màn hình ngay dưới thanh trên. */
function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const pad = (n: number) => String(n).padStart(2, "0");
  const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-20 flex justify-center"
      style={{ top: "calc(var(--hud-top) + 6px)", left: "var(--hud-left)" }}
    >
      <div
        role="timer"
        aria-label="Giờ hiện tại"
        className="clock-pill flex items-baseline gap-2 rounded-full border-[3px] border-white bg-[#0f172a]/85 px-4 py-1 text-white shadow-lg compact:px-3 compact:py-0.5"
      >
        <span className="font-display text-xl font-extrabold tabular-nums tracking-wider compact:text-base">
          {pad(now.getHours())}:{pad(now.getMinutes())}
          <span className="text-orange-300">:{pad(now.getSeconds())}</span>
        </span>
        <span className="text-[11px] font-bold text-white/70">
          {days[now.getDay()]} {pad(now.getDate())}/{pad(now.getMonth() + 1)}
        </span>
      </div>
    </div>
  );
}

function Toasts() {
  const toasts = useGame((s) => s.toasts);
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-50 flex flex-col items-center gap-2 px-3"
      style={{ top: "calc(var(--hud-top) + 52px)" }}
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-toast rounded-2xl border-[3px] border-white px-4 py-2 text-center text-sm font-bold text-white shadow-xl ${
            t.kind === "error" ? "bg-rose-500" : t.kind === "success" ? "bg-emerald-500" : "bg-sky-500"
          }`}
        >
          {t.kind === "error" ? "⚠️ " : t.kind === "success" ? "🎉 " : "💬 "}
          {t.text}
        </div>
      ))}
    </div>
  );
}

export default function Game() {
  const overlay = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLElement>(null);
  const viewport = useViewport();
  const [statsOpen, setStatsOpen] = useState(false);
  const [fitKey, setFitKey] = useState(0);
  const [barBottom, setBarBottom] = useState(76);
  const clearSelection = useGame((s) => s.clearSelection);
  const setPortrait = useGame((s) => s.setPortrait);
  const dialogOpen = useGame((s) => s.dialog !== null);
  const theme = useGame((s) => s.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  // điện thoại dọc: bảng thành viên là ngăn kéo dưới; màn hình thấp (điện thoại ngang) cũng coi là "nhỏ"
  const sheet = viewport.w < SHEET_BREAKPOINT;
  const small = sheet || viewport.h < 500;
  const portrait = viewport.w < viewport.h;
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth >= SHEET_BREAKPOINT && window.innerHeight >= 500);
  const sheetHeight = Math.round(viewport.h * 0.46);

  useEffect(() => setPortrait(portrait), [portrait, setPortrait]);

  // thanh trên có thể xuống 2 dòng: đo chiều cao thật để các phần khác né ra
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const measure = () => setBarBottom(Math.round(el.getBoundingClientRect().bottom));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // đang mở hộp thoại thì Esc chỉ đóng hộp thoại
      if (e.key === "Escape" && !dialogOpen) clearSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearSelection, dialogOpen]);

  /** Phần màn hình bị HUD che — camera căn cảnh vào vùng còn lại. */
  const insets: HudInsets = useMemo(
    () => ({
      left: !sheet && panelOpen ? SIDE_PANEL_WIDTH : 0,
      top: barBottom + 46, // chừa chỗ cho đồng hồ
      // ngăn kéo đang mở / nút mở ngăn kéo / dòng gợi ý (chỉ hiện trên màn hình rộng)
      bottom: sheet ? (panelOpen ? sheetHeight + 14 : 62) : viewport.w >= 1024 ? 44 : 10,
    }),
    [sheet, panelOpen, barBottom, sheetHeight, viewport.w],
  );

  const vars = {
    "--hud-top": `${barBottom}px`,
    "--hud-left": `${insets.left}px`,
    "--hud-bottom": `${insets.bottom}px`,
    "--sheet-h": `${sheetHeight}px`,
  } as CSSProperties;

  return (
    <main
      className="game-bg relative h-dvh w-screen select-none overflow-hidden bg-gradient-to-b from-sky-400 via-sky-300 to-sky-100 text-slate-800"
      data-compact={small}
      style={vars}
    >
      {/* isolate: nhãn 3D (Html) không bao giờ đè lên HUD */}
      <div className="absolute inset-0 isolate">
        <Scene overlay={overlay as RefObject<HTMLElement>} fitKey={fitKey} insets={insets} compact={small} />
        <div ref={overlay} className="pointer-events-none absolute inset-0 overflow-hidden" />
      </div>

      <TopBar barRef={bar} onOpenStats={() => setStatsOpen(true)} onFit={() => setFitKey((k) => k + 1)} />
      <Clock />
      <MemberPanel open={panelOpen} onOpenChange={setPanelOpen} sheet={sheet} />
      <SelectionBar />

      <p className="pointer-events-none absolute inset-x-0 bottom-2.5 z-10 hidden text-center text-[11px] font-semibold text-slate-700 lg:block">
        <span className="rounded-full bg-white/80 px-3 py-1 shadow">
          Bấm chọn người rồi bấm sân · hoặc kéo thả vào sân · đủ 4 người bấm ▶ Bắt đầu · Chuột trái xoay · Cuộn để phóng to
        </span>
      </p>

      <Toasts />
      <StatsPanel open={statsOpen} onClose={() => setStatsOpen(false)} />
      <Dialogs />
    </main>
  );
}
