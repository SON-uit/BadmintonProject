"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { matchesOfDay } from "@/lib/logic";
import { useGame } from "@/lib/store";
import { GENDER_COLOR, vibeInfo } from "@/lib/types";
import Dialogs from "./Dialogs";
import MemberPanel from "./MemberPanel";
import Scene, { type HudInsets } from "./scene/Scene";
import StatsPanel from "./StatsPanel";

export const BRAND = "LINH CÁO BADMINTON";

/** Dưới ngưỡng này giao diện chuyển sang kiểu điện thoại: tab Sân / Sảnh chờ + thanh điều hướng dưới. */
const MOBILE_BREAKPOINT = 768;
const SIDE_PANEL_WIDTH = 328;

type MobileTab = "court" | "lobby";

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

/** Đo cạnh dưới (thanh trên) hoặc phần chiếm từ đáy màn hình (thanh dưới) của một phần tử HUD. */
function useEdge(ref: RefObject<HTMLElement | null>, edge: "top" | "bottom", fallback: number, active: boolean) {
  const [value, setValue] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    const measure = () => {
      // offset* bỏ qua transform: thanh trượt ẩn đi vẫn giữ số đo cũ (camera, các nút không bị nhảy)
      const parent = el.offsetParent as HTMLElement | null;
      const bottom = el.offsetTop + el.offsetHeight;
      setValue(Math.round(edge === "bottom" ? bottom : (parent?.clientHeight ?? window.innerHeight) - el.offsetTop));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref, edge, active]);
  return value;
}

/** Số người đang đứng ở các sân chưa bắt đầu (có thể đưa về sảnh chờ). */
function useIdleOnCourt() {
  return useGame((s) => s.courts.reduce((n, c) => (c.status === "playing" ? n : n + c.slots.filter(Boolean).length), 0));
}

function Logo({ subtitle }: { subtitle: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2 pr-1">
      <span className="sport-stripes grid size-10 shrink-0 -rotate-6 place-items-center rounded-xl bg-gradient-to-br from-orange-400 to-pink-500 text-2xl shadow-md md:size-11 md:rounded-2xl">
        🦊
      </span>
      <div className="min-w-0 leading-none">
        <h1 className="font-display truncate bg-gradient-to-r from-orange-500 via-pink-500 to-sky-500 bg-clip-text pr-1 text-base font-extrabold italic tracking-wide text-transparent md:text-xl">
          {BRAND}
        </h1>
        <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function CourtSummary() {
  const courts = useGame((s) => s.courts);
  const waiting = useGame((s) => s.queue.length);
  const playing = courts.filter((c) => c.status === "playing").length;
  return (
    <>
      {courts.length} sân · <span className="text-orange-600">{playing} đang đánh</span> ·{" "}
      <span className="text-violet-600">{waiting} chờ</span>
    </>
  );
}

/** Thanh trên — máy tính / máy tính bảng. */
function TopBar({ barRef, onOpenStats, onFit }: { barRef: RefObject<HTMLElement | null>; onOpenStats: () => void; onFit: () => void }) {
  const matches = useGame((s) => s.matches);
  const addCourt = useGame((s) => s.addCourt);
  const openDialog = useGame((s) => s.openDialog);
  const returnIdleToQueue = useGame((s) => s.returnIdleToQueue);
  const theme = useGame((s) => s.theme);
  const toggleTheme = useGame((s) => s.toggleTheme);
  const idleOnCourt = useIdleOnCourt();
  const notArrived = useGame((s) => s.members.filter((m) => m.checkInAt === null).length);
  const todayCount = matchesOfDay(matches).length;

  return (
    <header ref={barRef} className="panel absolute inset-x-3 top-3 z-30 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
      <Logo subtitle={<CourtSummary />} />

      <div className="flex flex-wrap items-center gap-2">
        <button
          className="btn btn-green"
          onClick={() => openDialog({ kind: "attendance" })}
          title="Ai đến thì điểm danh: ghi giờ vào sân và đưa vào sảnh chờ"
        >
          ✅ Điểm danh
          {notArrived > 0 && <span className="rounded-full bg-white px-1.5 text-xs tabular-nums text-emerald-700">{notArrived}</span>}
        </button>
        <button className="btn btn-primary" onClick={addCourt} title="Thêm một sân mới">
          ➕ Thêm sân
        </button>
        <button
          className="btn btn-amber"
          onClick={() => openDialog({ kind: "arrange", courtId: null })}
          title="Chọn sân, thể loại và tính chất trận rồi tự xếp người"
        >
          🎲 Xếp trận
        </button>
        <button
          className="btn btn-ghost"
          onClick={returnIdleToQueue}
          disabled={idleOnCourt === 0}
          title="Đưa tất cả người ở các sân chưa bắt đầu về sảnh chờ"
          aria-label="Đưa về sảnh chờ"
        >
          ↩️<span className="max-xl:hidden"> Về sảnh chờ</span>
          {idleOnCourt > 0 && <span className="rounded-full bg-violet-500 px-1.5 text-xs tabular-nums text-white">{idleOnCourt}</span>}
        </button>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button className="btn btn-ghost" onClick={() => openDialog({ kind: "cleanup" })} title="Xóa nhanh thành viên / sân" aria-label="Dọn dẹp">
          🗑️<span className="max-lg:hidden"> Dọn dẹp</span>
        </button>
        <button className="btn btn-ghost" onClick={onFit} title="Đưa camera về góc nhìn thấy toàn bộ sân" aria-label="Xem toàn sân">
          🔭<span className="max-lg:hidden"> Toàn sân</span>
        </button>
        <button
          className="btn btn-ghost"
          onClick={toggleTheme}
          title={theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
          aria-label={theme === "dark" ? "Giao diện sáng" : "Giao diện tối"}
        >
          {theme === "dark" ? "☀️" : "🌙"}
          <span className="max-lg:hidden">{theme === "dark" ? " Sáng" : " Tối"}</span>
        </button>
        <button
          className="btn btn-green"
          onClick={() => openDialog({ kind: "billing" })}
          title="Tính tiền sân + cầu theo thời gian có mặt, xuất ảnh"
          aria-label="Tính tiền"
        >
          💰<span className="max-lg:hidden"> Tính tiền</span>
        </button>
        <button className="btn btn-sky" onClick={onOpenStats} aria-label="Thống kê">
          📊<span className="max-lg:hidden"> Thống kê</span>
          <span className="rounded-full bg-white px-1.5 text-xs tabular-nums text-sky-600">{todayCount}</span>
        </button>
      </div>
    </header>
  );
}

/**
 * Thanh trên — điện thoại: một dải mỏng một dòng sát mép trên (logo nhỏ · trạng thái · giờ)
 * để nhường tối đa chỗ cho sân. Mọi nút chức năng nằm ở thanh dưới.
 */
function MobileTopBar({ barRef, hidden }: { barRef: RefObject<HTMLElement | null>; hidden: boolean }) {
  const courts = useGame((s) => s.courts);
  const waiting = useGame((s) => s.queue.length);
  const playing = courts.filter((c) => c.status === "playing").length;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(t);
  }, []);
  const pad = (n: number) => String(n).padStart(2, "0");
  // màu cố định (hex), không theo bảng màu đảo của giao diện tối — thanh luôn là kính tối chữ trắng
  return (
    <header
      ref={barRef}
      // thao tác trên sân: trượt lên ẩn đi (vị trí đo vẫn giữ nguyên nên camera không giật)
      className={`absolute inset-x-0 top-0 z-30 box-content flex h-8 items-center gap-1.5 rounded-b-xl bg-[#0f172a]/80 px-2 text-white shadow-[0_2px_10px_rgb(0_0_0/0.25)] backdrop-blur-md transition-transform duration-300 ${
        hidden ? "-translate-y-full" : ""
      }`}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
      aria-hidden={hidden}
    >
      {/* dải màu thương hiệu mảnh dưới đáy */}
      <span className="pointer-events-none absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-gradient-to-r from-[#fb923c] via-[#ec4899] to-[#38bdf8] opacity-80" />

      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-gradient-to-br from-[#fb923c] to-[#ec4899] text-sm">🦊</span>
      <span className="font-display min-w-0 truncate text-sm font-extrabold leading-none tracking-wide text-white">
        Linh Cáo <span className="text-[9px] font-extrabold tracking-[0.2em] text-[#fdba74]">BADMINTON</span>
      </span>

      <span className="ml-auto flex shrink-0 items-center gap-1 text-[10px] font-bold tabular-nums">
        <Stat dot="#94a3b8" value={courts.length} label="sân" />
        <Stat dot="#fb923c" value={playing} label="đánh" pulse={playing > 0} />
        <Stat dot="#a78bfa" value={waiting} label="chờ" />
        <span className="font-display ml-0.5 rounded-md bg-[#ffffff] px-1.5 text-xs font-extrabold leading-5 text-[#0f172a]">
          {pad(now.getHours())}:{pad(now.getMinutes())}
        </span>
      </span>
    </header>
  );
}

function Stat({ dot, value, label, pulse }: { dot: string; value: number; label: string; pulse?: boolean }) {
  return (
    <span className="flex items-center gap-0.5 rounded-full bg-white/10 py-px pl-1.5 pr-1.5 text-[#f1f5f9]">
      <span className={`size-1.5 rounded-full ${pulse ? "animate-pulse" : ""}`} style={{ background: dot }} />
      <span className="font-extrabold">{value}</span>
      <span className="font-semibold text-[#94a3b8]">{label}</span>
    </span>
  );
}

function NavButton({
  icon,
  label,
  active,
  badge,
  tone,
  onClick,
}: {
  icon: string;
  label: string;
  active?: boolean;
  badge?: number;
  tone?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`relative flex min-h-[60px] flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl px-0.5 transition active:scale-95 ${
        active ? "bg-orange-500 text-white shadow-md" : (tone ?? "text-slate-700")
      }`}
    >
      <span className="text-[26px] leading-none" aria-hidden>
        {icon}
      </span>
      <span className="whitespace-nowrap text-[11px] font-extrabold leading-none">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute right-1 top-0.5 min-w-5 rounded-full bg-rose-500 px-1 text-center text-[11px] font-extrabold tabular-nums leading-5 text-white ring-2 ring-white">
          {badge}
        </span>
      )}
    </button>
  );
}

/** Thanh điều hướng dưới — điện thoại. Nút to, có icon + tên chức năng. */
function MobileNav({
  navRef,
  tab,
  onTab,
  onMore,
}: {
  navRef: RefObject<HTMLElement | null>;
  tab: MobileTab;
  onTab: (tab: MobileTab) => void;
  onMore: () => void;
}) {
  const openDialog = useGame((s) => s.openDialog);
  const waiting = useGame((s) => s.queue.length);
  const notArrived = useGame((s) => s.members.filter((m) => m.checkInAt === null).length);
  return (
    <nav
      ref={navRef}
      className="panel absolute inset-x-2 bottom-2 z-30 flex items-stretch gap-1 p-1.5"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Điều hướng"
    >
      <NavButton icon="🏟️" label="Sân" active={tab === "court"} onClick={() => onTab("court")} />
      <NavButton icon="🪑" label="Sảnh chờ" active={tab === "lobby"} badge={waiting} onClick={() => onTab("lobby")} />
      <NavButton icon="✅" label="Điểm danh" badge={notArrived} onClick={() => openDialog({ kind: "attendance" })} />
      <NavButton icon="🎲" label="Xếp trận" onClick={() => openDialog({ kind: "arrange", courtId: null })} />
      <NavButton icon="☰" label="Thêm" onClick={onMore} />
    </nav>
  );
}

/** Menu "Thêm" trên điện thoại: các chức năng còn lại, mỗi ô một nút to có tên + mô tả. */
function MoreMenu({ onClose, onOpenStats, onFit }: { onClose: () => void; onOpenStats: () => void; onFit: () => void }) {
  const addCourt = useGame((s) => s.addCourt);
  const openDialog = useGame((s) => s.openDialog);
  const returnIdleToQueue = useGame((s) => s.returnIdleToQueue);
  const theme = useGame((s) => s.theme);
  const toggleTheme = useGame((s) => s.toggleTheme);
  const matches = useGame((s) => s.matches);
  const idleOnCourt = useIdleOnCourt();
  const todayCount = matchesOfDay(matches).length;

  const items: { icon: string; label: string; hint: string; run: () => void; tone?: string }[] = [
    { icon: "💰", label: "Tính tiền", hint: "Chia tiền sân + cầu, lưu ảnh bill", run: () => openDialog({ kind: "billing" }), tone: "text-emerald-700" },
    { icon: "➕", label: "Thêm sân", hint: "Thêm một sân mới", run: addCourt },
    { icon: "👤", label: "Thành viên", hint: "Thêm, sửa, điểm danh", run: () => openDialog({ kind: "roster", editId: null }) },
    {
      icon: "↩️",
      label: "Về sảnh chờ",
      hint: idleOnCourt > 0 ? `Đưa ${idleOnCourt} người ở sân chưa đánh về` : "Không có ai ở sân chưa đánh",
      run: returnIdleToQueue,
    },
    { icon: "📊", label: "Thống kê", hint: `${todayCount} trận hôm nay`, run: onOpenStats },
    { icon: "🔭", label: "Xem toàn sân", hint: "Đưa camera về góc nhìn toàn bộ", run: onFit },
    {
      icon: theme === "dark" ? "☀️" : "🌙",
      label: theme === "dark" ? "Giao diện sáng" : "Giao diện tối",
      hint: "Đổi màu nền",
      run: toggleTheme,
    },
    { icon: "🗑️", label: "Dọn dẹp", hint: "Xóa nhanh thành viên / sân", run: () => openDialog({ kind: "cleanup" }), tone: "text-rose-600" },
  ];

  return (
    <div className="absolute inset-0 z-40 flex items-end bg-sky-950/40 p-2" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Chức năng khác"
        className="panel animate-pop w-full p-2"
        onClick={(e) => e.stopPropagation()}
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-between px-2 pb-1.5 pt-1">
          <h2 className="font-display text-lg font-extrabold text-slate-800">Chức năng khác</h2>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Đóng">
            ✕ Đóng
          </button>
        </div>
        <ul className="grid grid-cols-2 gap-1.5">
          {items.map((it) => (
            <li key={it.label}>
              <button
                className={`flex min-h-16 w-full cursor-pointer items-center gap-2.5 rounded-2xl bg-slate-100 px-3 py-2 text-left transition active:scale-95 ${it.tone ?? "text-slate-800"}`}
                onClick={() => {
                  onClose();
                  it.run();
                }}
              >
                <span className="text-2xl leading-none" aria-hidden>
                  {it.icon}
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block text-sm font-extrabold">{it.label}</span>
                  <span className="block text-[11px] font-semibold text-slate-500">{it.hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Cột "Sân đủ người": gom nút ▶ Bắt đầu của mọi sân đã đủ 4 người về một chỗ —
 * bên phải trên máy tính, bên trái trên điện thoại.
 */
function ReadyDock({ side }: { side: "left" | "right" }) {
  const courts = useGame((s) => s.courts);
  const members = useGame((s) => s.members);
  const startMatch = useGame((s) => s.startMatch);
  const ready = courts.filter((c) => c.status === "idle" && c.slots.every(Boolean));
  if (ready.length === 0) return null;
  const byId = new Map(members.map((m) => [m.id, m]));

  return (
    <div
      className={`pointer-events-none absolute z-20 flex max-h-[45dvh] flex-col gap-1.5 overflow-y-auto p-1 ${
        side === "right" ? "right-2 items-end" : "left-1 items-start"
      }`}
      style={{ top: `calc(var(--hud-top) + ${side === "right" ? 6 : 50}px)` }}
      aria-label="Sân đủ người"
    >
      <span className="font-display rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-extrabold text-white shadow">
        ✅ SÂN ĐỦ NGƯỜI · {ready.length}
      </span>
      {ready.map((c) => {
        const vibe = c.vibe ? vibeInfo(c.vibe) : null;
        const names = c.slots.map((id) => (id ? byId.get(id)?.name : undefined)).filter(Boolean);
        return (
          <button
            key={c.id}
            onClick={() => startMatch(c.id)}
            aria-label={`Bắt đầu trận ở ${c.name}`}
            className="btn btn-green pointer-events-auto w-56 !justify-start !rounded-2xl !px-2.5 !py-2 text-left ring-4 ring-emerald-300/60 compact:w-48"
          >
            <span className="grid size-9 shrink-0 animate-pulse place-items-center rounded-full bg-white text-lg text-emerald-600">▶</span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-extrabold">
                Bắt đầu · {c.name}
                {vibe && ` ${vibe.emoji}`}
              </span>
              <span className="block truncate text-[11px] font-semibold text-emerald-50">{names.join(", ")}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const s = Math.max(0, Math.floor((now - since) / 1000));
  return (
    <span className="tabular-nums">
      {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}
    </span>
  );
}

/**
 * Điện thoại: cột thao tác gọn bên trái, mỗi sân một dòng (nhãn trên sân chỉ còn tên sân):
 * ▶ Bắt đầu (đủ người) · 🏁 Kết thúc (đang đánh, kèm thời gian) · 🎲 Xếp trận (còn chỗ) + 🗑️ xóa sân.
 */
function MobileCourtDock() {
  const courts = useGame((s) => s.courts);
  const startMatch = useGame((s) => s.startMatch);
  const openDialog = useGame((s) => s.openDialog);
  const removeCourt = useGame((s) => s.removeCourt);
  if (courts.length === 0) return null;

  const pill =
    "flex h-10 min-w-0 max-w-[8.5rem] cursor-pointer items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-sm font-extrabold shadow-md ring-2 ring-white transition active:scale-95";
  const dot = "grid size-8 shrink-0 place-items-center rounded-full bg-white text-sm";

  return (
    <div
      className="absolute left-1.5 z-20 flex flex-col items-start gap-1 overflow-y-auto p-0.5"
      style={{ top: "calc(var(--hud-top) + 6px)", maxHeight: "calc(100dvh - var(--hud-top) - var(--hud-bottom) - 20px)" }}
      aria-label="Thao tác sân"
    >
      {courts.map((c) => {
        const filled = c.slots.filter(Boolean).length;
        const playing = c.status === "playing";
        const ready = !playing && filled === 4;
        const onRemove = () => {
          if (filled > 0 && !window.confirm(`${c.name} đang có ${filled} người. Xóa sân và đưa họ về sảnh chờ?`)) return;
          removeCourt(c.id);
        };
        return (
          <div key={c.id} className="flex items-center gap-1">
            {playing ? (
              <button className={`${pill} bg-rose-500 text-white`} onClick={() => openDialog({ kind: "finish", courtId: c.id })} aria-label={`Kết thúc trận ở ${c.name}`}>
                <span className={dot}>🏁</span>
                <span className="min-w-0 leading-none">
                  <span className="block truncate">{c.name}</span>
                  <span className="block text-[10px] font-bold text-rose-100">
                    <Elapsed since={c.startedAt ?? Date.now()} />
                  </span>
                </span>
              </button>
            ) : ready ? (
              <button className={`${pill} bg-emerald-500 text-white`} onClick={() => startMatch(c.id)} aria-label={`Bắt đầu trận ở ${c.name}`}>
                <span className={`${dot} animate-pulse text-emerald-600`}>▶</span>
                <span className="truncate">{c.name}</span>
              </button>
            ) : (
              <button
                className={`${pill} bg-yellow-400 text-yellow-950`}
                onClick={() => openDialog({ kind: "arrange", courtId: c.id })}
                aria-label={`Xếp trận cho ${c.name}`}
              >
                <span className={dot}>🎲</span>
                <span className="min-w-0 leading-none">
                  <span className="block truncate">{c.name}</span>
                  <span className="block text-[10px] font-bold text-yellow-800">{filled === 0 ? "trống" : `${filled}/4`}</span>
                </span>
              </button>
            )}
            {!playing && (
              <button
                onClick={onRemove}
                aria-label={`Xóa ${c.name}`}
                title="Xóa sân"
                className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full bg-white/90 text-sm shadow ring-1 ring-slate-200 transition active:scale-95"
              >
                🗑️
              </button>
            )}
          </div>
        );
      })}
    </div>
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
    <div className="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-2" style={{ bottom: "calc(var(--hud-bottom) + 6px)" }}>
      <div className="panel animate-pop pointer-events-auto w-full max-w-xl space-y-2 !border-pink-400 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-display text-sm font-extrabold text-pink-600">ĐÃ CHỌN {selected.length}/4</span>
          {selected.map((m, i) => (
            <button
              key={m.id}
              onClick={() => toggleSelect(m.id)}
              title="Bỏ chọn người này"
              className="flex min-h-8 cursor-pointer items-center gap-1 rounded-full bg-pink-500 py-0.5 pl-1 pr-2 text-xs font-bold text-white transition hover:bg-pink-400 compact:text-sm"
            >
              <span className="grid size-5 place-items-center rounded-full bg-white text-[11px] font-extrabold text-pink-600">{i + 1}</span>
              <span className="size-2 rounded-full ring-1 ring-white" style={{ background: GENDER_COLOR[m.gender] }} />
              {m.name}
              <span className="opacity-80">✕</span>
            </button>
          ))}
          <button className="btn btn-ghost ml-auto !px-2.5 !py-1 !text-xs" onClick={clearSelection}>
            ✕ Bỏ chọn
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Xếp vào sân">
          <span className="text-xs font-bold text-slate-600 compact:basis-full">👉 Bấm sân để xếp vào:</span>
          {openCourts.length === 0 ? (
            <span className="text-xs font-semibold text-slate-500">chưa có sân nào còn chỗ</span>
          ) : (
            openCourts.map((c) => (
              <button
                key={c.id}
                className="btn btn-pink !rounded-xl !px-3 !py-1 compact:min-w-[30%] compact:flex-1"
                onClick={() => placeSelected(c.id)}
              >
                🏟️ {c.name}
                <span className="rounded-full bg-white/25 px-1.5 text-[11px] tabular-nums">{c.slots.filter(Boolean).length}/4</span>
              </button>
            ))
          )}
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
      style={{ top: "calc(var(--hud-top) + var(--toast-gap))" }}
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

/** Nút nhanh nổi góc phải tab Sân (điện thoại). */
function CourtQuickActions({ onFit }: { onFit: () => void }) {
  const addCourt = useGame((s) => s.addCourt);
  const returnIdleToQueue = useGame((s) => s.returnIdleToQueue);
  const hasSelection = useGame((s) => s.selectedIds.length > 0);
  const idleOnCourt = useIdleOnCourt();
  if (hasSelection) return null;
  return (
    <div className="absolute right-2 z-20 flex flex-col items-end gap-1.5" style={{ bottom: "calc(var(--hud-bottom) + 8px)" }}>
      {idleOnCourt > 0 && (
        <button className="btn btn-ghost !rounded-2xl shadow-lg" onClick={returnIdleToQueue} title="Đưa người ở sân chưa đánh về sảnh chờ">
          ↩️ Về sảnh chờ
          <span className="rounded-full bg-violet-500 px-1.5 text-xs tabular-nums text-white">{idleOnCourt}</span>
        </button>
      )}
      <button className="btn btn-ghost !rounded-2xl shadow-lg" onClick={onFit}>
        🔭 Toàn sân
      </button>
      <button className="btn btn-primary !rounded-2xl shadow-lg" onClick={addCourt}>
        ➕ Thêm sân
      </button>
    </div>
  );
}

export default function Game() {
  const overlay = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLElement>(null);
  const nav = useRef<HTMLElement>(null);
  const viewport = useViewport();
  const [statsOpen, setStatsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [fitKey, setFitKey] = useState(0);
  const [tab, setTab] = useState<MobileTab>("court");
  // điện thoại: đang chạm / kéo trên sân thì thu thanh trên lại, thả tay ~2.5 giây sau hiện lại
  const [barHidden, setBarHidden] = useState(false);
  const showTimer = useRef<number | undefined>(undefined);
  const sceneTouching = useRef(false);
  const onScenePointerDown = () => {
    sceneTouching.current = true;
    window.clearTimeout(showTimer.current);
    setBarHidden(true);
  };
  useEffect(() => {
    const onUp = () => {
      if (!sceneTouching.current) return;
      sceneTouching.current = false;
      window.clearTimeout(showTimer.current);
      showTimer.current = window.setTimeout(() => setBarHidden(false), 2500);
    };
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.clearTimeout(showTimer.current);
    };
  }, []);
  const clearSelection = useGame((s) => s.clearSelection);
  const setPortrait = useGame((s) => s.setPortrait);
  const dialogOpen = useGame((s) => s.dialog !== null);
  const theme = useGame((s) => s.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  // điện thoại: tab Sân / Sảnh chờ tách biệt; màn hình thấp (điện thoại ngang) cũng coi là "nhỏ"
  const mobile = viewport.w < MOBILE_BREAKPOINT;
  const small = mobile || viewport.h < 500;
  const portrait = viewport.w < viewport.h;
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth >= MOBILE_BREAKPOINT && window.innerHeight >= 500);

  useEffect(() => setPortrait(portrait), [portrait, setPortrait]);

  const barBottom = useEdge(bar, "bottom", 64, true);
  const navHeight = useEdge(nav, "top", 84, mobile);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // đang mở hộp thoại thì Esc chỉ đóng hộp thoại
      if (e.key === "Escape" && !dialogOpen) clearSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearSelection, dialogOpen]);

  const fit = () => setFitKey((k) => k + 1);
  const lobby = mobile && tab === "lobby";

  /** Phần màn hình bị HUD che — camera căn cảnh vào vùng còn lại. */
  const insets: HudInsets = useMemo(
    () => ({
      left: !mobile && panelOpen ? SIDE_PANEL_WIDTH : 0,
      top: barBottom + (mobile ? 4 : 46), // máy tính: chừa chỗ cho đồng hồ (điện thoại: giờ nằm trong thanh trên)
      // điện thoại: thanh điều hướng dưới · máy tính: dòng gợi ý (chỉ hiện trên màn hình rộng)
      bottom: mobile ? navHeight + 8 : viewport.w >= 1024 ? 44 : 10,
    }),
    [mobile, panelOpen, barBottom, navHeight, viewport.w],
  );

  const vars = {
    "--hud-top": `${barBottom}px`,
    "--toast-gap": mobile ? "8px" : "52px",
    "--hud-left": `${insets.left}px`,
    "--hud-bottom": `${insets.bottom}px`,
  } as CSSProperties;

  return (
    <main
      className="game-bg relative h-dvh w-screen select-none overflow-hidden bg-gradient-to-b from-[#1e293b] via-[#2a3448] to-[#3b475d] text-slate-800"
      data-compact={small}
      data-mobile={mobile}
      style={vars}
    >
      {/* isolate: nhãn 3D (Html) không bao giờ đè lên HUD */}
      <div className="absolute inset-0 isolate" aria-hidden={lobby} onPointerDownCapture={mobile ? onScenePointerDown : undefined}>
        <Scene overlay={overlay as RefObject<HTMLElement>} fitKey={fitKey} insets={insets} compact={small} />
        <div ref={overlay} className={`pointer-events-none absolute inset-0 overflow-hidden ${lobby ? "invisible" : ""}`} />
      </div>

      {mobile ? <MobileTopBar barRef={bar} hidden={barHidden && !lobby} /> : <TopBar barRef={bar} onOpenStats={() => setStatsOpen(true)} onFit={fit} />}
      {!mobile && <Clock />}

      {mobile ? (
        lobby && <MemberPanel variant="screen" open onOpenChange={() => setTab("court")} />
      ) : (
        <MemberPanel variant="side" open={panelOpen} onOpenChange={setPanelOpen} />
      )}

      {mobile ? !lobby && <MobileCourtDock /> : <ReadyDock side="right" />}
      {mobile && !lobby && <CourtQuickActions onFit={fit} />}
      <SelectionBar />

      {mobile && (
        <MobileNav
          navRef={nav}
          tab={tab}
          onTab={(t) => {
            // bấm lại tab Sân khi đang ở tab Sân = đưa camera về toàn cảnh
            if (t === "court" && tab === "court") fit();
            setTab(t);
          }}
          onMore={() => setMoreOpen(true)}
        />
      )}

      <p className="pointer-events-none absolute inset-x-0 bottom-2.5 z-10 hidden text-center text-[11px] font-semibold text-slate-700 lg:block">
        <span className="rounded-full bg-white/80 px-3 py-1 shadow">
          Bấm chọn người rồi bấm sân · hoặc kéo tên / nhân vật thả vào sân · sân đủ người bấm ▶ Bắt đầu ở cột bên phải · Chuột trái xoay · Cuộn
          để phóng to
        </span>
      </p>

      <Toasts />
      {moreOpen && <MoreMenu onClose={() => setMoreOpen(false)} onOpenStats={() => setStatsOpen(true)} onFit={fit} />}
      <StatsPanel open={statsOpen} onClose={() => setStatsOpen(false)} />
      <Dialogs />
    </main>
  );
}
