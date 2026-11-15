"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useGame } from "@/lib/store";
import { GENDER_COLOR, type Member } from "@/lib/types";
import { Modal } from "./Modal";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const pad = (n: number) => String(n).padStart(2, "0");

export const toHHMM = (ts: number) => {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** "21:30" → mốc thời gian cùng ngày với `base`. */
export function fromHHMM(value: string, base: number): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(base);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d.getTime();
}

/** Cộng / trừ phút trên chuỗi "HH:MM" (quay vòng qua nửa đêm). */
function shift(value: string, minutes: number) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return value;
  const total = (((Number(m[1]) * 60 + Number(m[2]) + minutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

function fmtDuration(ms: number) {
  const minutes = Math.round(ms / MINUTE);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} giờ${m ? ` ${m} phút` : ""}` : `${m} phút`;
}

function TimeField({
  label,
  value,
  onChange,
  disabled,
  extra,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  extra?: { label: string; run: () => void };
}) {
  const step = "btn btn-ghost !min-h-11 flex-1 !px-2 !text-sm";
  return (
    <fieldset disabled={disabled} className={`space-y-1.5 ${disabled ? "opacity-40" : ""}`}>
      <legend className="mb-1 text-xs font-extrabold uppercase tracking-wide text-slate-600">{label}</legend>
      <input
        type="time"
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        aria-label={label}
        className="w-full select-text rounded-2xl border-2 border-slate-200 bg-white px-3 py-2 text-center text-2xl font-extrabold tabular-nums text-slate-900 outline-none focus:border-orange-400"
      />
      <div className="flex gap-1.5">
        <button type="button" className={step} onClick={() => onChange(shift(value, -15))}>
          −15′
        </button>
        <button type="button" className={step} onClick={() => onChange(shift(value, -5))}>
          −5′
        </button>
        <button type="button" className={step} onClick={() => onChange(shift(value, 5))}>
          +5′
        </button>
        <button type="button" className={step} onClick={() => onChange(shift(value, 15))}>
          +15′
        </button>
        {extra && (
          <button type="button" className={`${step} !flex-[1.6] !text-sky-700`} onClick={extra.run}>
            {extra.label}
          </button>
        )}
      </div>
    </fieldset>
  );
}

/**
 * Sửa giờ đến / giờ về của một người (bảng tính tiền). Dùng được cả cho người quên điểm danh.
 * Hiện đè lên hộp thoại tính tiền (portal ra body để không bị khung hộp thoại cắt mất).
 */
export function TimeEditor({ member, endAt, onClose }: { member: Member; endAt: number; onClose: () => void }) {
  const setMemberTimes = useGame((s) => s.setMemberTimes);
  const earliest = useGame((s) =>
    s.members.reduce<number | null>((min, m) => (m.checkInAt !== null && (min === null || m.checkInAt < min) ? m.checkInAt : min), null),
  );
  const isNew = member.checkInAt === null;
  // người chưa điểm danh: gợi ý giờ đến = giờ người sớm nhất đến (hoặc 2 tiếng trước giờ kết thúc)
  const baseIn = member.checkInAt ?? earliest ?? endAt - 2 * 60 * MINUTE;
  const [fromText, setFromText] = useState(() => toHHMM(baseIn));
  const [stillHere, setStillHere] = useState(() => member.checkOutAt === null);
  const [toText, setToText] = useState(() => toHHMM(member.checkOutAt ?? endAt));

  const from = fromHHMM(fromText, baseIn) ?? baseIn;
  let to = fromHHMM(toText, from) ?? endAt;
  // giờ về nhỏ hơn giờ đến: hiểu là qua nửa đêm (đánh khuya)
  if (to < from) to += DAY;
  const until = stillHere ? Math.max(endAt, from) : to;

  const save = () => {
    if (setMemberTimes(member.id, from, stillHere ? null : to)) onClose();
  };
  const remove = () => {
    if (!window.confirm(`Không tính tiền ${member.name}? Giờ đến / về sẽ bị xóa (coi như chưa đến).`)) return;
    if (setMemberTimes(member.id, null, null)) onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[55]">
      <Modal
        title={isNew ? "🕒 Thêm giờ có mặt" : "🕒 Sửa giờ đến / về"}
        subtitle={isNew ? "Quên điểm danh? Nhập giờ đến để tính tiền" : "Dùng khi bấm nhầm hoặc quên bấm Vào / Về"}
        tone="from-emerald-500 to-sky-500"
        onClose={onClose}
        footer={
          <>
            {!isNew && (
              <button className="btn btn-ghost mr-auto !text-rose-600" onClick={remove}>
                🚫 Không tính
              </button>
            )}
            <button className="btn btn-ghost" onClick={onClose}>
              Huỷ
            </button>
            <button className="btn btn-primary" onClick={save}>
              ✓ Lưu
            </button>
          </>
        }
      >
        <p className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
          <span className="size-3 shrink-0 rounded-full" style={{ background: GENDER_COLOR[member.gender] }} />
          <span className="min-w-0 [overflow-wrap:anywhere]">{member.name}</span>
        </p>

        <TimeField label="Giờ đến" value={fromText} onChange={setFromText} />

        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2.5 rounded-2xl border-2 border-slate-200 bg-white px-3 py-2.5">
            <input
              type="checkbox"
              checked={stillHere}
              onChange={(e) => setStillHere(e.target.checked)}
              className="size-5 shrink-0 accent-emerald-500"
            />
            <span className="min-w-0">
              <span className="block text-sm font-extrabold text-slate-900">Còn ở sân</span>
              <span className="block text-xs font-medium text-slate-500">Chưa về — tạm tính tới giờ kết thúc buổi ({toHHMM(endAt)})</span>
            </span>
          </label>
          <TimeField
            label="Giờ về"
            value={toText}
            onChange={setToText}
            disabled={stillHere}
            extra={{ label: "Bây giờ", run: () => setToText(toHHMM(Date.now())) }}
          />
        </div>

        <p className="rounded-2xl bg-emerald-50 px-3 py-2 text-center text-sm font-bold text-emerald-800">
          Có mặt: {fmtDuration(until - from)}
          <span className="font-semibold text-emerald-700">
            {" "}
            ({fromText} → {stillHere ? `${toHHMM(until)}, đang ở sân` : toText}
            {!stillHere && new Date(to).getDate() !== new Date(from).getDate() ? ", qua nửa đêm" : ""})
          </span>
        </p>
      </Modal>
    </div>,
    document.body,
  );
}
