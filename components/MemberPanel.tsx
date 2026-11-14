"use client";

import { useMemo } from "react";
import { fmtWait } from "@/lib/logic";
import { moodEmoji, type Mood } from "@/lib/mood";
import { useGame } from "@/lib/store";
import { GENDER_COLOR, isPresent, levelInfo, MAX_MEMBERS, type Court, type Member } from "@/lib/types";
import { useQueueView } from "./useMoods";

function MemberRow({
  member,
  index,
  played,
  mood,
  selectable,
  draggable,
}: {
  member: Member;
  /** Thứ tự ưu tiên trong hàng chờ (bỏ trống với người đang ở trong sân). */
  index?: number;
  played: number;
  /** Thời gian chờ + mức bực (chỉ có với người ở hàng chờ). */
  mood?: Mood;
  /** Bấm để chọn (người đang đánh thì không). */
  selectable: boolean;
  /** Kéo thả từ danh sách vào sân 3D (chỉ khi danh sách nằm cạnh sân — máy tính). */
  draggable: boolean;
}) {
  const startDrag = useGame((s) => s.startDrag);
  const toggleSelect = useGame((s) => s.toggleSelect);
  const openDialog = useGame((s) => s.openDialog);
  const checkOut = useGame((s) => s.checkOut);
  const isDragging = useGame((s) => s.draggingId === member.id);
  const selectedOrder = useGame((s) => s.selectedIds.indexOf(member.id));
  const selected = selectedOrder >= 0;
  const angry = mood && mood.level > 0 ? mood : undefined;
  const level = levelInfo(member.level);

  return (
    <li
      onPointerDown={(e) => {
        if (!draggable || !selectable || e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
        if (e.pointerType === "mouse") e.preventDefault();
        // nhả tại chỗ = chọn / bỏ chọn; kéo đi = thả vào sân (DragController xử lý)
        startDrag(member.id);
      }}
      onClick={(e) => {
        // điện thoại (sảnh chờ toàn màn hình): chạm = chọn / bỏ chọn
        if (draggable || !selectable || (e.target as HTMLElement).closest("button")) return;
        toggleSelect(member.id);
      }}
      // touch-pan-y: trên cảm ứng vẫn vuốt dọc để cuộn danh sách được (trình duyệt hủy thao tác kéo)
      className={`flex touch-pan-y flex-wrap items-center gap-x-2 rounded-2xl border-2 px-2 py-1 text-sm transition compact:px-2.5 compact:py-2 compact:text-base ${
        isDragging
          ? "border-amber-400 bg-amber-100"
          : selected
            ? "border-pink-400 bg-pink-50"
            : angry
              ? angry.level === 2
                ? "border-rose-300 bg-rose-50 hover:border-rose-400"
                : "border-orange-200 bg-orange-50 hover:border-orange-300"
              : "border-transparent bg-slate-100/80 hover:border-sky-300 hover:bg-sky-50"
      } ${selectable ? "cursor-pointer active:scale-[0.99]" : ""}`}
    >
      {selected ? (
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-pink-500 text-[11px] font-extrabold text-white compact:size-7 compact:text-sm">
          {selectedOrder + 1}
        </span>
      ) : selectable && !draggable ? (
        // điện thoại: ô tròn gợi ý "chạm để chọn"
        <span className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-slate-300 text-[11px] font-bold tabular-nums text-slate-400">
          {index !== undefined ? index + 1 : ""}
        </span>
      ) : (
        <span className="w-5 shrink-0 text-center text-[11px] font-bold tabular-nums text-slate-400">{index !== undefined ? index + 1 : "·"}</span>
      )}
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: GENDER_COLOR[member.gender] }} />
      <span className="flex min-w-0 flex-1 items-center gap-1">
        <span className="truncate font-bold text-slate-900">{member.name}</span>
        {angry && (
          <span
            className={`anger-emote-inline shrink-0 leading-none ${angry.level === 2 ? "anger-emote-2" : ""}`}
            role="img"
            aria-label={angry.level === 2 ? "đang giận dữ" : "đang bực"}
            title={angry.reasons.join(" · ")}
          >
            {moodEmoji(angry.level)}
          </span>
        )}
      </span>
      {mood && (
        <span
          className={`shrink-0 rounded-full px-1.5 py-px text-[10px] font-extrabold tabular-nums compact:text-xs ${
            angry ? "bg-rose-100 text-rose-600" : "bg-white text-slate-500"
          }`}
          title="Thời gian đã chờ ở sảnh chờ"
          aria-label={`Đã chờ ${fmtWait(mood.waitedMs)}`}
        >
          ⏱ {fmtWait(mood.waitedMs)}
        </span>
      )}
      <span className="w-10 shrink-0 text-right text-[11px] font-semibold tabular-nums text-slate-500 compact:w-12 compact:text-xs" title="Số trận hôm nay">
        {played} trận
      </span>
      {mood && (
        <button
          onClick={() => checkOut(member.id)}
          aria-label={`Xác nhận ${member.name} ra về`}
          title="Xác nhận ra về — chốt giờ để tính tiền"
          className="shrink-0 cursor-pointer rounded-lg px-1 py-0.5 text-xs opacity-70 transition hover:bg-white hover:opacity-100 compact:min-h-9 compact:bg-white compact:px-2 compact:text-xs compact:font-bold compact:opacity-100"
        >
          🏠<span className="hidden compact:inline"> Về</span>
        </button>
      )}
      <button
        onClick={() => openDialog({ kind: "roster", editId: member.id })}
        aria-label={`Sửa ${member.name}`}
        title="Sửa tên / giới tính / trình độ"
        className="shrink-0 cursor-pointer rounded-lg px-1 py-0.5 text-xs opacity-70 transition hover:bg-white hover:opacity-100 compact:min-h-9 compact:bg-white compact:px-2 compact:text-xs compact:font-bold compact:opacity-100"
      >
        ✏️<span className="hidden compact:inline"> Sửa</span>
      </button>
      {/* dòng 2: biệt danh gà (trình) + lý do bực nếu có */}
      <span className="basis-full truncate pl-[2.4rem] text-[11px] font-semibold leading-tight text-slate-500 compact:pl-[3.1rem] compact:text-xs">
        {level.emoji} {level.nick} <span className="text-slate-400">({level.code})</span>
        {angry && <span className={angry.level === 2 ? "text-rose-600" : "text-orange-600"}> · {angry.reasons.join(" · ")}</span>}
      </span>
    </li>
  );
}

function CourtGroup({ court, players, played, draggable }: { court: Court; players: Member[]; played: Map<string, number>; draggable: boolean }) {
  const openDialog = useGame((s) => s.openDialog);
  const startMatch = useGame((s) => s.startMatch);
  const playing = court.status === "playing";
  const full = players.length === 4;

  return (
    <div className={`rounded-2xl border-2 p-1.5 ${playing ? "border-orange-300 bg-orange-50/60" : full ? "border-emerald-300 bg-emerald-50/60" : "border-slate-200"}`}>
      <div className="mb-1 flex items-center justify-between gap-2 px-1">
        <span className="font-display truncate text-sm font-extrabold text-slate-800 compact:text-base">
          🏟️ {court.name}
          <span className={`ml-1.5 text-[11px] font-bold ${playing ? "text-orange-600" : full ? "text-emerald-600" : "text-slate-500"}`}>
            {playing ? "đang đánh" : full ? "đủ người" : `${players.length}/4`}
          </span>
        </span>
        {playing ? (
          <button className="btn btn-danger !px-2.5 !py-1 !text-xs" onClick={() => openDialog({ kind: "finish", courtId: court.id })}>
            🏁 Kết thúc
          </button>
        ) : full ? (
          <button className="btn btn-green animate-pulse !px-2.5 !py-1 !text-xs" onClick={() => startMatch(court.id)}>
            ▶ Bắt đầu
          </button>
        ) : (
          <button className="btn btn-amber !px-2.5 !py-1 !text-xs" onClick={() => openDialog({ kind: "arrange", courtId: court.id })}>
            🎲 Xếp trận
          </button>
        )}
      </div>
      <ul className="space-y-1">
        {players.map((m) => (
          <MemberRow key={m.id} member={m} played={played.get(m.id) ?? 0} selectable={!playing} draggable={draggable} />
        ))}
      </ul>
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * side: bảng bên trái cạnh sân 3D (máy tính) — kéo thả được, thu gọn được.
   * screen: tab "Sảnh chờ" toàn màn hình trên điện thoại — tách hẳn khỏi sân, chạm để chọn.
   */
  variant: "side" | "screen";
}

export default function MemberPanel({ open, onOpenChange, variant }: Props) {
  const members = useGame((s) => s.members);
  const courts = useGame((s) => s.courts);
  const openDialog = useGame((s) => s.openDialog);
  const checkIn = useGame((s) => s.checkIn);
  const returnIdleToQueue = useGame((s) => s.returnIdleToQueue);
  const hasSelection = useGame((s) => s.selectedIds.length > 0);
  const { order, moods, played } = useQueueView();
  const screen = variant === "screen";
  const draggable = !screen;

  const away = useMemo(() => members.filter((m) => !isPresent(m)), [members]);

  const { waiting, groups } = useMemo(() => {
    const byId = new Map(members.map((m) => [m.id, m]));
    const waiting = order.map((id) => byId.get(id)).filter((m): m is Member => !!m);
    const groups = courts
      .map((court) => ({
        court,
        players: court.slots.map((id) => (id ? byId.get(id) : undefined)).filter((m): m is Member => !!m),
      }))
      .filter((g) => g.players.length > 0);
    return { waiting, groups };
  }, [members, order, courts]);

  const males = waiting.filter((m) => m.gender === "male").length;
  const angryCount = waiting.filter((m) => (moods.get(m.id)?.level ?? 0) > 0).length;
  const onCourt = groups.reduce((n, g) => n + g.players.length, 0);
  const idleOnCourt = groups.reduce((n, g) => (g.court.status === "playing" ? n : n + g.players.length), 0);

  if (!open) {
    return (
      <button
        onClick={() => onOpenChange(true)}
        className="panel btn absolute left-3 z-20 text-slate-800"
        style={{ top: "calc(var(--hud-top) + 8px)" }}
        aria-label="Mở sảnh chờ"
      >
        🪑 Sảnh chờ
        <span className="rounded-full bg-violet-500 px-1.5 text-xs tabular-nums text-white">{waiting.length}</span>
      </button>
    );
  }

  return (
    <aside
      className={`panel absolute z-20 flex flex-col overflow-hidden ${screen ? "inset-x-2" : "bottom-3 left-3 w-[19rem]"}`}
      style={
        screen
          ? { top: "calc(var(--hud-top) + 8px)", bottom: "calc(var(--hud-bottom) + 2px)" }
          : { top: "calc(var(--hud-top) + 8px)" }
      }
      aria-label="Sảnh chờ"
    >
      <header className="sport-stripes flex shrink-0 items-center justify-between gap-2 bg-gradient-to-r from-violet-500 to-sky-500 px-3 py-2 md:py-2.5">
        <h2 className="font-display min-w-0 truncate text-base font-extrabold tracking-wide text-white drop-shadow-sm">
          🪑 SẢNH CHỜ · {members.length - away.length}/{members.length} có mặt
          <span className="ml-1 text-[11px] font-bold text-white/80">(tối đa {MAX_MEMBERS})</span>
        </h2>
        {!screen && (
          <button
            onClick={() => onOpenChange(false)}
            aria-label="Thu gọn"
            title="Thu gọn"
            className="cursor-pointer rounded-lg px-2 py-0.5 text-sm font-bold leading-none text-white/90 hover:bg-white/25"
          >
            ‹ Ẩn
          </button>
        )}
      </header>

      <div className="flex shrink-0 gap-2 border-b-2 border-slate-100 p-2.5">
        <button className="btn btn-green flex-1" onClick={() => openDialog({ kind: "attendance" })} title="Ai đến thì điểm danh: ghi giờ vào sân + vào sảnh chờ">
          ✅ Điểm danh
          {away.length > 0 && <span className="rounded-full bg-white px-1.5 text-xs tabular-nums text-emerald-700">{away.length}</span>}
        </button>
        <button className="btn btn-primary flex-1" onClick={() => openDialog({ kind: "roster", editId: null })}>
          👤 Thành viên
        </button>
      </div>

      <div className={`thin-scroll flex-1 space-y-3 overflow-y-auto overscroll-contain p-2.5 ${screen && hasSelection ? "pb-48" : ""}`}>
        <section>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <h3 className="font-display text-sm font-extrabold uppercase tracking-wide text-violet-600 compact:text-base">Đang chờ · {waiting.length}</h3>
            <span className="text-[11px] font-semibold text-slate-500 compact:text-xs">
              {angryCount > 0 && <span className="mr-1.5 font-bold text-rose-500">😤 {angryCount} đang bực</span>}
              {males} nam · {waiting.length - males} nữ
            </span>
          </div>
          {waiting.length > 0 && (
            <p className="mb-1.5 text-[10px] font-semibold text-slate-400 compact:text-xs">
              {screen ? "Chạm chọn 4 người rồi chọn sân ở thanh dưới · " : ""}Ưu tiên: ít trận trước · chờ lâu trước
            </p>
          )}
          {waiting.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-slate-200 px-3 py-4 text-center text-xs font-medium text-slate-500">
              {members.length === 0
                ? "Chưa có thành viên nào — bấm 👤 Thành viên để thêm danh sách buổi đánh."
                : away.length === members.length
                  ? "Chưa ai điểm danh — bấm ✅ Điểm danh khi mọi người đến."
                  : "Không còn ai đang chờ."}
            </p>
          ) : (
            <ul className="space-y-1" aria-label="Danh sách đang chờ">
              {waiting.map((m, i) => (
                <MemberRow key={m.id} member={m} index={i} played={played.get(m.id) ?? 0} mood={moods.get(m.id)} selectable draggable={draggable} />
              ))}
            </ul>
          )}
        </section>

        {groups.length > 0 && (
          <section aria-label="Trong sân">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-extrabold uppercase tracking-wide text-emerald-600 compact:text-base">Trong sân · {onCourt}</h3>
              {idleOnCourt > 0 && (
                <button
                  className="btn btn-ghost !px-2.5 !py-1 !text-xs"
                  onClick={returnIdleToQueue}
                  title="Đưa tất cả người ở các sân chưa bắt đầu về sảnh chờ"
                >
                  ↩️ Về sảnh chờ ({idleOnCourt})
                </button>
              )}
            </div>
            <div className="space-y-2">
              {groups.map((g) => (
                <CourtGroup key={g.court.id} court={g.court} players={g.players} played={played} draggable={draggable} />
              ))}
            </div>
          </section>
        )}

        {away.length > 0 && (
          <section aria-label="Chưa đến / đã về">
            <h3 className="font-display mb-1.5 text-sm font-extrabold uppercase tracking-wide text-slate-500 compact:text-base">
              Chưa đến / đã về · {away.length}
            </h3>
            <ul className="grid grid-cols-2 gap-1">
              {away.map((m) => (
                <li
                  key={m.id}
                  className="flex min-w-0 items-center gap-1 rounded-xl border-2 border-dashed border-slate-200 py-0.5 pl-1.5 pr-0.5 text-xs compact:py-1 compact:text-sm"
                >
                  <span className="size-2 shrink-0 rounded-full" style={{ background: GENDER_COLOR[m.gender] }} />
                  <span className="min-w-0 flex-1 truncate font-bold text-slate-600" title={m.checkOutAt ? "Đã về" : "Chưa đến"}>
                    {m.checkOutAt ? "🏠 " : ""}
                    {m.name}
                  </span>
                  <button
                    onClick={() => checkIn(m.id)}
                    aria-label={`Xác nhận ${m.name} có mặt`}
                    title="Xác nhận có mặt — vào sảnh chờ"
                    className="shrink-0 cursor-pointer rounded-lg bg-emerald-500 px-1.5 py-0.5 text-[11px] font-extrabold text-white transition hover:bg-emerald-400 compact:min-h-9 compact:px-2.5 compact:text-xs"
                  >
                    ✓ Có mặt
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </aside>
  );
}
