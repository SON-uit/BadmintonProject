"use client";

import { useMemo, useState } from "react";
import { fmtClock } from "@/lib/logic";
import { useGame } from "@/lib/store";
import { GENDER_COLOR, isPresent, levelInfo, type Member } from "@/lib/types";
import { Modal } from "./Modal";

/** Bỏ dấu để tìm tên không cần gõ dấu ("tuan" tìm ra "Tuấn"). */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

function Avatar({ member }: { member: Member }) {
  const info = levelInfo(member.level);
  return (
    <span className="relative grid size-10 shrink-0 place-items-center rounded-full text-xl" style={{ background: info.color }} title={`${info.nick} (${info.code})`}>
      {info.emoji}
      <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full ring-2 ring-white" style={{ background: GENDER_COLOR[member.gender] }} />
    </span>
  );
}

/**
 * Điểm danh: danh sách thành viên của buổi đánh, ai đến thì bấm "Có mặt" —
 * ghi giờ vào sân (để tính tiền) và đưa người đó vào sảnh chờ.
 */
export default function AttendanceDialog({ onClose }: { onClose: () => void }) {
  const members = useGame((s) => s.members);
  const courts = useGame((s) => s.courts);
  const checkIn = useGame((s) => s.checkIn);
  const checkOut = useGame((s) => s.checkOut);
  const setMemberTimes = useGame((s) => s.setMemberTimes);
  const resetAttendance = useGame((s) => s.resetAttendance);
  const openDialog = useGame((s) => s.openDialog);
  const [query, setQuery] = useState("");

  const q = fold(query);
  const match = (m: Member) => !q || fold(m.name).includes(q);
  const playingIds = useMemo(
    () => new Set(courts.filter((c) => c.status === "playing").flatMap((c) => c.slots.filter((id): id is string => !!id))),
    [courts],
  );

  const absent = members.filter((m) => m.checkInAt === null);
  const present = members.filter(isPresent).sort((a, b) => (b.checkInAt ?? 0) - (a.checkInAt ?? 0));
  const left = members.filter((m) => m.checkInAt !== null && m.checkOutAt !== null);
  const shownAbsent = absent.filter(match);
  const shownPresent = present.filter(match);
  const shownLeft = left.filter(match);
  const dateText = new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" });

  return (
    <Modal
      title="✅ Điểm danh"
      subtitle={`${dateText} · ${present.length} có mặt · ${absent.length} chưa đến${left.length ? ` · ${left.length} đã về` : ""}`}
      tone="from-emerald-500 to-teal-500"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button
            className="btn btn-ghost mr-auto"
            title="Xóa giờ vào / ra của mọi người để điểm danh buổi mới"
            onClick={() => window.confirm("Bắt đầu buổi mới? Giờ vào / ra của mọi người sẽ bị xóa, ai cũng về trạng thái chưa đến.") && resetAttendance()}
          >
            🔄 Buổi mới
          </button>
          <button className="btn btn-sky" onClick={() => openDialog({ kind: "roster", editId: null })}>
            👤 Thêm thành viên
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Xong
          </button>
        </>
      }
    >
      {members.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 px-4 py-8 text-center">
          <p className="text-sm font-semibold text-slate-600">Chưa có thành viên nào cho buổi đánh.</p>
          <button className="btn btn-primary mt-3" onClick={() => openDialog({ kind: "roster", editId: null })}>
            👤 Thêm danh sách thành viên
          </button>
        </div>
      ) : (
        <>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 Tìm tên (gõ không dấu cũng được)…"
            aria-label="Tìm thành viên"
            className="w-full select-text rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-800 outline-none focus:border-emerald-400"
          />

          <section aria-label="Chưa điểm danh">
            <h3 className="font-display mb-2 text-sm font-extrabold uppercase tracking-wide text-slate-600">
              ⏳ Chưa điểm danh · {shownAbsent.length}
            </h3>
            {shownAbsent.length === 0 ? (
              <p className="rounded-2xl bg-emerald-50 px-3 py-3 text-center text-sm font-bold text-emerald-700">
                {absent.length === 0 ? "🎉 Mọi người đều đã điểm danh" : "Không tìm thấy ai"}
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {shownAbsent.map((m) => (
                  <li key={m.id}>
                    <button
                      onClick={() => checkIn(m.id)}
                      aria-label={`Điểm danh ${m.name}`}
                      className="flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-3 py-2 text-left transition hover:border-emerald-400 hover:bg-emerald-50 active:scale-[0.98]"
                    >
                      <Avatar member={m} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-extrabold text-slate-900">{m.name}</span>
                        <span className="block truncate text-xs font-semibold text-slate-500">{levelInfo(m.level).nick}</span>
                      </span>
                      <span className="shrink-0 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-extrabold text-white shadow-[0_3px_0_0_rgb(0_0_0/0.18)]">
                        ✅ Có mặt
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {shownPresent.length > 0 && (
            <section aria-label="Đã có mặt">
              <h3 className="font-display mb-2 text-sm font-extrabold uppercase tracking-wide text-emerald-600">
                🟢 Đã có mặt · {shownPresent.length}
              </h3>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {shownPresent.map((m) => {
                  const playing = playingIds.has(m.id);
                  return (
                    <li key={m.id} className="flex min-h-14 items-center gap-2.5 rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-2.5 py-1.5">
                      <Avatar member={m} />
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block truncate text-sm font-extrabold text-slate-900">{m.name}</span>
                        <span className="block truncate text-xs font-semibold text-emerald-700">
                          Vào lúc {fmtClock(m.checkInAt!)}
                          {playing && <span className="text-orange-600"> · đang đánh</span>}
                        </span>
                      </span>
                      <button
                        className="btn btn-ghost !min-h-10 !px-2.5 !text-xs"
                        disabled={playing}
                        title="Bấm nhầm? Hủy điểm danh (xóa giờ vào)"
                        onClick={() => setMemberTimes(m.id, null, null)}
                      >
                        ↶ Hủy
                      </button>
                      <button
                        className="btn btn-ghost !min-h-10 !px-2.5 !text-xs"
                        disabled={playing}
                        title="Xác nhận ra về — chốt giờ ra để tính tiền"
                        onClick={() => checkOut(m.id)}
                      >
                        🏠 Về
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {shownLeft.length > 0 && (
            <section aria-label="Đã về">
              <h3 className="font-display mb-2 text-sm font-extrabold uppercase tracking-wide text-slate-500">🏠 Đã về · {shownLeft.length}</h3>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {shownLeft.map((m) => (
                  <li key={m.id} className="flex min-h-14 items-center gap-2.5 rounded-2xl border-2 border-dashed border-slate-200 px-2.5 py-1.5">
                    <Avatar member={m} />
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-sm font-extrabold text-slate-600">{m.name}</span>
                      <span className="block truncate text-xs font-semibold text-slate-500">
                        {fmtClock(m.checkInAt!)} – {fmtClock(m.checkOutAt!)}
                      </span>
                    </span>
                    <button className="btn btn-green !min-h-10 !px-2.5 !text-xs" title="Quay lại sân — vào sảnh chờ" onClick={() => checkIn(m.id)}>
                      ↩️ Quay lại
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </Modal>
  );
}
