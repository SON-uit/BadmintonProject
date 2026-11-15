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
    <span className="relative grid size-9 shrink-0 place-items-center rounded-full text-lg" style={{ background: info.color }} title={`${info.nick} (${info.code})`}>
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
  const checkInMany = useGame((s) => s.checkInMany);
  const checkOutMany = useGame((s) => s.checkOutMany);
  const [query, setQuery] = useState("");
  /** Chế độ chọn nhiều: null = tắt; bật thì bấm thẻ để chọn / bỏ chọn. */
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const picking = picked !== null;
  const togglePick = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const pickAll = (list: Member[]) =>
    setPicked((prev) => {
      const next = new Set(prev);
      const all = list.every((m) => next.has(m.id));
      for (const m of list) {
        if (all) next.delete(m.id);
        else next.add(m.id);
      }
      return next;
    });

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
  // người đã chọn: ai chưa có mặt (chưa đến / đã về) thì điểm danh được, ai đang có mặt (không đang đánh) thì rời sân được
  const pickedList = picked ? members.filter((m) => picked.has(m.id)) : [];
  const toCheckIn = pickedList.filter((m) => !isPresent(m));
  const toCheckOut = pickedList.filter((m) => isPresent(m) && !playingIds.has(m.id));
  const confirmFor = (action: string, list: Member[]) =>
    window.confirm(`${action} ${list.length} người sau?\n\n${list.map((m) => `• ${m.name}`).join("\n")}`);
  const bulkCheckIn = () => {
    if (!confirmFor("✅ Điểm danh", toCheckIn)) return;
    checkInMany(toCheckIn.map((m) => m.id));
    setPicked(null);
  };
  const bulkCheckOut = () => {
    if (!confirmFor("🏠 Cho rời sân", toCheckOut)) return;
    checkOutMany(toCheckOut.map((m) => m.id));
    setPicked(null);
  };
  /** Nút "Chọn hết / Bỏ hết" cạnh tiêu đề mỗi nhóm (chỉ khi đang chọn nhiều). */
  const pickAllButton = (list: Member[]) =>
    picked && list.length > 0 ? (
      <button className="btn btn-ghost !min-h-8 !px-2 !py-0.5 !text-xs normal-case tracking-normal" onClick={() => pickAll(list)}>
        {list.every((m) => picked.has(m.id)) ? "Bỏ hết" : "Chọn hết"}
      </button>
    ) : null;
  /** Ô tích ở đầu thẻ khi đang chọn nhiều. */
  const pickMark = (id: string) =>
    picked ? (
      <span
        aria-hidden
        className={`grid size-6 shrink-0 place-items-center rounded-lg border-2 text-sm font-extrabold ${
          picked.has(id) ? "border-pink-500 bg-pink-500 text-white" : "border-slate-300 bg-white text-transparent"
        }`}
      >
        ✓
      </span>
    ) : null;
  const pickRing = (id: string) => (picked?.has(id) ? "!border-pink-400 ring-2 ring-pink-300" : "");

  const today = new Date();
  const dateText = `${["CN", "T2", "T3", "T4", "T5", "T6", "T7"][today.getDay()]} ${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}`;

  return (
    <Modal
      title="✅ Điểm danh"
      subtitle={`${dateText} · ${present.length} có mặt · ${absent.length} chưa đến${left.length ? ` · ${left.length} về` : ""}`}
      tone="from-emerald-500 to-teal-500"
      size="lg"
      onClose={onClose}
      footer={
        picking ? (
          <>
            <span className="mr-auto self-center text-sm font-extrabold text-pink-600">Đã chọn {pickedList.length}</span>
            <button className="btn btn-ghost" onClick={() => setPicked(null)}>
              Huỷ chọn
            </button>
            <button className="btn btn-green whitespace-nowrap" disabled={toCheckIn.length === 0} onClick={bulkCheckIn}>
              ✅ Điểm danh ({toCheckIn.length})
            </button>
            <button className="btn btn-primary whitespace-nowrap" disabled={toCheckOut.length === 0} onClick={bulkCheckOut}>
              🏠 Rời sân ({toCheckOut.length})
            </button>
          </>
        ) : (
        <>
          <button
            className="btn btn-ghost whitespace-nowrap"
            title="Chọn nhiều người để điểm danh / cho rời sân một lần"
            onClick={() => setPicked(new Set())}
          >
            ☑️ Chọn nhiều
          </button>
          <button
            className="btn btn-ghost mr-auto whitespace-nowrap"
            title="Xóa giờ vào / ra của mọi người để điểm danh buổi mới"
            onClick={() => window.confirm("Bắt đầu buổi mới? Giờ vào / ra của mọi người sẽ bị xóa, ai cũng về trạng thái chưa đến.") && resetAttendance()}
          >
            🔄 Buổi mới
          </button>
          <button className="btn btn-sky whitespace-nowrap" onClick={() => openDialog({ kind: "roster", editId: null })}>
            👤 Thêm người
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Xong
          </button>
        </>
        )
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
            placeholder="🔍 Tìm tên…"
            aria-label="Tìm thành viên"
            className="w-full select-text rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-800 outline-none focus:border-emerald-400"
          />

          <section aria-label="Chưa điểm danh">
            <h3 className="font-display mb-2 flex items-center justify-between gap-2 text-sm font-extrabold uppercase tracking-wide text-slate-600">
              ⏳ Chưa điểm danh · {shownAbsent.length}
              {pickAllButton(shownAbsent)}
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
                      onClick={() => (picking ? togglePick(m.id) : checkIn(m.id))}
                      aria-label={picking ? `Chọn ${m.name}` : `Điểm danh ${m.name}`}
                      aria-pressed={picked ? picked.has(m.id) : undefined}
                      className={`flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-3 py-2 text-left transition hover:border-emerald-400 hover:bg-emerald-50 active:scale-[0.98] ${pickRing(m.id)}`}
                    >
                      {pickMark(m.id)}
                      <Avatar member={m} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-extrabold text-slate-900">{m.name}</span>
                        <span className="block truncate text-xs font-semibold text-slate-500">{levelInfo(m.level).code}</span>
                      </span>
                      {!picking && (
                        <span className="shrink-0 whitespace-nowrap rounded-xl bg-emerald-500 px-3 py-2 text-sm font-extrabold text-white shadow-[0_3px_0_0_rgb(0_0_0/0.18)]">
                          ✅ Đến
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {shownPresent.length > 0 && (
            <section aria-label="Đã có mặt">
              <h3 className="font-display mb-2 flex items-center justify-between gap-2 text-sm font-extrabold uppercase tracking-wide text-emerald-600">
                🟢 Đã có mặt · {shownPresent.length}
                {pickAllButton(shownPresent.filter((m) => !playingIds.has(m.id)))}
              </h3>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {shownPresent.map((m) => {
                  const playing = playingIds.has(m.id);
                  return (
                    <li
                      key={m.id}
                      onClick={picking && !playing ? () => togglePick(m.id) : undefined}
                      className={`flex min-h-14 items-center gap-2.5 rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-2.5 py-1.5 ${
                        picking ? (playing ? "opacity-50" : "cursor-pointer") : ""
                      } ${pickRing(m.id)}`}
                    >
                      {!playing && pickMark(m.id)}
                      <Avatar member={m} />
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block truncate text-sm font-extrabold text-slate-900">{m.name}</span>
                        <span className="block truncate text-xs font-semibold text-emerald-700">
                          🕒 {fmtClock(m.checkInAt!)}
                          {playing && <span className="text-orange-600"> · 🏸 đánh</span>}
                        </span>
                      </span>
                      {!picking && (
                      <>
                      <button
                        className="btn btn-ghost shrink-0 whitespace-nowrap !min-h-10 !px-2 !text-xs"
                        disabled={playing}
                        title="Bấm nhầm? Hủy điểm danh (xóa giờ vào)"
                        onClick={() => setMemberTimes(m.id, null, null)}
                      >
                        ↶ Hủy
                      </button>
                      <button
                        className="btn btn-ghost shrink-0 whitespace-nowrap !min-h-10 !px-2 !text-xs"
                        disabled={playing}
                        title="Xác nhận ra về — chốt giờ ra để tính tiền"
                        onClick={() => checkOut(m.id)}
                      >
                        🏠 Về
                      </button>
                      </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {shownLeft.length > 0 && (
            <section aria-label="Đã về">
              <h3 className="font-display mb-2 flex items-center justify-between gap-2 text-sm font-extrabold uppercase tracking-wide text-slate-500">
                🏠 Đã về · {shownLeft.length}
                {pickAllButton(shownLeft)}
              </h3>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {shownLeft.map((m) => (
                  <li
                    key={m.id}
                    onClick={picking ? () => togglePick(m.id) : undefined}
                    className={`flex min-h-14 items-center gap-2.5 rounded-2xl border-2 border-dashed border-slate-200 px-2.5 py-1.5 ${picking ? "cursor-pointer" : ""} ${pickRing(m.id)}`}
                  >
                    {pickMark(m.id)}
                    <Avatar member={m} />
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-sm font-extrabold text-slate-600">{m.name}</span>
                      <span className="block truncate text-xs font-semibold text-slate-500">
                        {fmtClock(m.checkInAt!)} – {fmtClock(m.checkOutAt!)}
                      </span>
                    </span>
                    {!picking && (
                      <button className="btn btn-green shrink-0 whitespace-nowrap !min-h-10 !px-2 !text-xs" title="Quay lại sân — vào sảnh chờ" onClick={() => checkIn(m.id)}>
                        ↩️ Lại
                      </button>
                    )}
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
