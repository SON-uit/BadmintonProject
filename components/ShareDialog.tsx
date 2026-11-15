"use client";

import { useEffect, useMemo, useState } from "react";
import { matchesOfDay } from "@/lib/logic";
import { clearSharedHash, decodeShare, encodeShare, sharedCodeInLocation, shareUrl, type SharePayload } from "@/lib/share";
import { useGame } from "@/lib/store";
import { isPresent } from "@/lib/types";
import { Modal, SectionTitle } from "./Modal";

type History = "none" | "today" | "all";

const fmtDateTime = (ms: number) => {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};

/** Máy A: tạo link chứa toàn bộ dữ liệu (nén), gửi qua Zalo / Messenger… */
export function ShareDialog({ onClose }: { onClose: () => void }) {
  const members = useGame((s) => s.members);
  const courts = useGame((s) => s.courts);
  const queue = useGame((s) => s.queue);
  const queuedAt = useGame((s) => s.queuedAt);
  const matches = useGame((s) => s.matches);
  const courtCounter = useGame((s) => s.courtCounter);
  const lastType = useGame((s) => s.lastType);
  const lastVibe = useGame((s) => s.lastVibe);
  const bill = useGame((s) => s.bill);
  const extras = useGame((s) => s.extras);
  const notify = useGame((s) => s.notify);

  const today = useMemo(() => matchesOfDay(matches), [matches]);
  // mặc định: kèm lịch sử hôm nay (đủ để tính tiền / thống kê buổi này) — link vẫn ngắn
  const [history, setHistory] = useState<History>(today.length > 0 ? "today" : "none");
  const [link, setLink] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setLink(null);
    const picked = history === "all" ? matches : history === "today" ? today : [];
    encodeShare({ members, courts, queue, queuedAt, matches: picked, courtCounter, lastType, lastVibe, bill, extras })
      .then((code) => alive && setLink(shareUrl(code)))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [history, members, courts, queue, queuedAt, matches, today, courtCounter, lastType, lastVibe, bill, extras]);

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      notify("Đã sao chép link chia sẻ", "success");
    } catch {
      // trình duyệt chặn clipboard: chọn sẵn ô link để người dùng tự sao chép
      (document.getElementById("share-link") as HTMLTextAreaElement | null)?.select();
      notify("Không tự sao chép được — giữ vào ô link để sao chép", "error");
    }
  };
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const nativeShare = async () => {
    if (!link) return;
    try {
      await navigator.share({ title: "Linh Cáo Badminton", text: "Dữ liệu buổi đánh cầu — mở link để nhập vào máy bạn", url: link });
    } catch {
      /* người dùng huỷ */
    }
  };

  const options: { value: History; label: string; hint: string }[] = [
    { value: "today", label: "Hôm nay", hint: `${today.length} trận` },
    { value: "all", label: "Tất cả", hint: `${matches.length} trận` },
    { value: "none", label: "Không kèm", hint: "link ngắn nhất" },
  ];
  const present = members.filter(isPresent).length;

  return (
    <Modal
      title="🔗 Chia sẻ sang máy khác"
      subtitle="Gửi link qua Zalo / Messenger — máy kia mở link là có y hệt dữ liệu"
      tone="from-sky-500 to-violet-500"
      onClose={onClose}
      footer={
        <>
          {canNativeShare && (
            <button className="btn btn-ghost" onClick={nativeShare} disabled={!link}>
              📤 Gửi…
            </button>
          )}
          <button className="btn btn-primary" onClick={copy} disabled={!link}>
            📋 Sao chép link
          </button>
        </>
      }
    >
      <ul className="grid grid-cols-3 gap-1.5 text-center">
        {[
          { icon: "👥", value: members.length, label: `thành viên · ${present} có mặt` },
          { icon: "🏟️", value: courts.length, label: "sân" },
          { icon: "⚙️", value: "✓", label: "cài đặt tính tiền" },
        ].map((s) => (
          <li key={s.label} className="rounded-2xl bg-slate-100 px-2 py-2">
            <span className="block text-lg font-extrabold text-slate-800">
              {s.icon} {s.value}
            </span>
            <span className="block text-[11px] font-semibold leading-tight text-slate-500">{s.label}</span>
          </li>
        ))}
      </ul>

      <div>
        <SectionTitle>Kèm lịch sử trận</SectionTitle>
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Kèm lịch sử trận">
          {options.map((o) => (
            <button
              key={o.value}
              role="radio"
              aria-checked={history === o.value}
              onClick={() => setHistory(o.value)}
              className={`cursor-pointer rounded-2xl border-2 px-2 py-1.5 text-center transition active:scale-95 ${
                history === o.value ? "border-sky-500 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              <span className="block text-sm font-extrabold">{o.label}</span>
              <span className="block text-[11px] font-semibold text-slate-500">{o.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle>Link chia sẻ</SectionTitle>
        {failed ? (
          <p className="rounded-2xl bg-amber-100 px-3 py-2 text-sm font-bold text-amber-900">⚠️ Không tạo được link trên trình duyệt này.</p>
        ) : (
          <>
            <textarea
              id="share-link"
              readOnly
              value={link ?? "Đang nén dữ liệu…"}
              onFocus={(e) => e.currentTarget.select()}
              rows={3}
              className="thin-scroll w-full resize-none break-all rounded-2xl border-2 border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] leading-snug text-slate-600 outline-none focus:border-sky-400"
            />
            {link && (
              <p className="mt-1 text-[11px] font-semibold text-slate-500">
                Đã nén: {link.length.toLocaleString("vi-VN")} ký tự
                {link.length > 4000 && " · hơi dài, chọn \"Hôm nay\" hoặc \"Không kèm\" để gọn hơn"}
              </p>
            )}
          </>
        )}
      </div>

      <p className="rounded-2xl border-2 border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-900">
        🔒 Dữ liệu nằm trong phần sau dấu <b>#</b> của link nên không gửi lên server nào. Đây là <b>bản chụp lúc này</b>: sửa gì sau đó thì máy kia
        không tự cập nhật — chia sẻ lại link mới.
      </p>
    </Modal>
  );
}

/**
 * Máy B: mở link có #s=… → hỏi trước khi ghi đè dữ liệu đang có.
 * Đồng ý hay bỏ qua đều xoá phần # khỏi thanh địa chỉ (tải lại trang không hỏi lại).
 */
export function SharedImportPrompt() {
  const importShared = useGame((s) => s.importShared);
  const notify = useGame((s) => s.notify);
  const hasData = useGame((s) => s.members.length > 0 || s.matches.length > 0);
  const [payload, setPayload] = useState<SharePayload | null>(null);

  useEffect(() => {
    const read = () => {
      const code = sharedCodeInLocation();
      if (!code) return;
      decodeShare(code)
        .then(setPayload)
        .catch(() => {
          clearSharedHash();
          notify("Link chia sẻ bị lỗi hoặc thiếu — nhờ người gửi sao chép lại", "error");
        });
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [notify]);

  if (!payload) return null;
  const { data, sharedAt } = payload;
  const close = () => {
    clearSharedHash();
    setPayload(null);
  };
  const accept = () => {
    importShared(data);
    close();
    notify(`Đã nhập ${data.members.length} thành viên, ${data.courts.length} sân`, "success");
  };

  return (
    <Modal
      title="📥 Dùng dữ liệu được chia sẻ?"
      subtitle={`Bản chụp lúc ${fmtDateTime(sharedAt)}`}
      tone="from-sky-500 to-violet-500"
      onClose={close}
      footer={
        <>
          <button className="btn btn-ghost" onClick={close}>
            Bỏ qua
          </button>
          <button className="btn btn-primary" onClick={accept}>
            ✅ Dùng dữ liệu này
          </button>
        </>
      }
    >
      <ul className="grid grid-cols-3 gap-1.5 text-center">
        {[
          { icon: "👥", value: data.members.length, label: "thành viên" },
          { icon: "🏟️", value: data.courts.length, label: "sân" },
          { icon: "🏸", value: data.matches.length, label: "trận đã đánh" },
        ].map((s) => (
          <li key={s.label} className="rounded-2xl bg-slate-100 px-2 py-2">
            <span className="block text-lg font-extrabold text-slate-800">
              {s.icon} {s.value}
            </span>
            <span className="block text-[11px] font-semibold text-slate-500">{s.label}</span>
          </li>
        ))}
      </ul>
      {data.members.length > 0 && (
        <p className="text-xs font-semibold text-slate-600">
          {data.members
            .slice(0, 12)
            .map((m) => m.name)
            .join(", ")}
          {data.members.length > 12 && ` và ${data.members.length - 12} người khác`}
        </p>
      )}
      {hasData && (
        <p role="alert" className="rounded-2xl border-2 border-orange-300 bg-orange-50 px-3 py-2 text-sm font-bold text-orange-700">
          ⚠️ Dữ liệu hiện tại trên máy này (thành viên, sân, lịch sử, cài đặt tính tiền) sẽ bị ghi đè.
        </p>
      )}
    </Modal>
  );
}
