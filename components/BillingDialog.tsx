"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { billLineText, computeBill, fmtHour, fmtK, fmtVnd, formatExtras, genderWeight, parseVnd, type Bill, type BillSettings } from "@/lib/billing";
import { useGame } from "@/lib/store";
import { GENDER_COLOR } from "@/lib/types";
import { Modal, SectionTitle } from "./Modal";
import { fromHHMM, TimeEditor, toHHMM } from "./TimeEditor";

/** Ô giờ trong bảng tiền — bấm để mở hộp sửa giờ. */
const TIME_CHIP =
  "w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-1 py-1 text-center text-xs font-bold tabular-nums text-slate-900 transition hover:border-sky-400 active:scale-95";

/** Nền tảng để chọn cách lưu ảnh phù hợp. */
function platform(): "ios" | "android" | "inapp" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  // trình duyệt nhúng trong app (Zalo, Messenger, Facebook, Instagram, Line, TikTok) thường chặn tải file
  if (/Zalo|FBAN|FBAV|FB_IAB|Messenger|Instagram|Line\/|TikTok|musical_ly/i.test(ua)) return "inapp";
  // iPadOS báo là Mac nhưng có cảm ứng
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

/** Ô nhập tiền VNĐ: tự thêm dấu chấm phân cách hàng nghìn khi gõ (600000 → 600.000). */
function MoneyInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-600">{label}</span>
      <span className="mt-0.5 flex items-center rounded-2xl border-2 border-slate-200 bg-white pr-3 focus-within:border-orange-400">
        <input
          type="text"
          inputMode="numeric"
          value={value ? fmtVnd(value) : ""}
          placeholder="0"
          onChange={(e) => onChange(Math.min(99_999_999, parseVnd(e.target.value)))}
          aria-label={label}
          className="w-full min-w-0 select-text bg-transparent px-3 py-1.5 text-base font-extrabold tabular-nums text-slate-900 outline-none"
        />
        <span className="text-sm font-bold text-slate-400">đ</span>
      </span>
      {/* gõ tắt: 600 → 600.000 */}
      {value > 0 && value < 1000 && (
        <button type="button" className="mt-1 text-[11px] font-bold text-sky-600" onClick={() => onChange(value * 1000)}>
          Ý bạn là {fmtVnd(value * 1000)}đ?
        </button>
      )}
    </label>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <span className="text-xs font-bold text-slate-600">{label}</span>
      <div className="mt-0.5 flex rounded-2xl bg-slate-100 p-1" role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={`flex-1 cursor-pointer whitespace-nowrap rounded-xl px-2 py-1 text-xs font-extrabold transition ${
              value === v ? "bg-white text-orange-600 shadow" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Vẽ bảng tính tiền ra ảnh PNG theo kiểu danh sách check-list. */
async function renderBillImage(bill: Bill, settings: BillSettings, title: string): Promise<Blob | null> {
  await document.fonts?.ready;
  const css = getComputedStyle(document.documentElement);
  const body = css.getPropertyValue("--font-be-vietnam").trim() || "sans-serif";
  const display = css.getPropertyValue("--font-baloo").trim() || body;

  const W = 860;
  const PAD = 44;
  const LINE = 34;
  const scale = 2;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const textFont = `500 26px ${body}`;

  // tách dòng dài theo bề ngang
  ctx.font = textFont;
  const maxText = W - PAD * 2 - 52;
  const rows = bill.lines.map((line, i) => {
    const words = billLineText(line, i).split(" ");
    const wrapped: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(next).width > maxText && cur) {
        wrapped.push(cur);
        cur = w;
      } else cur = next;
    }
    wrapped.push(cur);
    return wrapped;
  });

  const headerH = 150;
  const rowsH = rows.reduce((h, r) => h + r.length * LINE + 20, 0);
  const footerH = 110;
  const H = headerH + rowsH + footerH;
  canvas.width = W * scale;
  canvas.height = H * scale;
  ctx.scale(scale, scale);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  const band = ctx.createLinearGradient(0, 0, W, 0);
  band.addColorStop(0, "#ff8a1f");
  band.addColorStop(1, "#ff2e93");
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, W, 10);

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#0f172a";
  ctx.font = `800 38px ${display}`;
  ctx.fillText(title, PAD, 70);
  ctx.fillStyle = "#64748b";
  ctx.font = `600 21px ${body}`;
  const d = genderWeight("male", settings.genderDiff);
  ctx.fillText(
    `Sân ${fmtK(settings.courtFee)} + Cầu ${fmtK(settings.shuttleFee)} = ${fmtK(bill.cost)} · Nam ${d}% · Nữ ${100 - d}% · ${bill.lines.length} người`,
    PAD,
    108,
  );

  let y = headerH;
  ctx.font = textFont;
  rows.forEach((wrapped) => {
    // vòng tròn check-list
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(PAD + 14, y + 16, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#1f2937";
    wrapped.forEach((text, j) => ctx.fillText(text, PAD + 52, y + 25 + j * LINE));
    y += wrapped.length * LINE + 20;
  });

  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, y + 8);
  ctx.lineTo(W - PAD, y + 8);
  ctx.stroke();
  ctx.fillStyle = "#0f172a";
  ctx.font = `800 26px ${display}`;
  ctx.fillText(`Tổng thu: ${fmtVnd(bill.grandTotal)}đ`, PAD, y + 52);
  ctx.fillStyle = "#94a3b8";
  ctx.font = `600 18px ${body}`;
  ctx.fillText(`Chi phí sân + cầu ${fmtVnd(bill.cost)}đ · thu phần sân + cầu ${fmtVnd(bill.collected)}đ`, PAD, y + 82);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export default function BillingDialog({ onClose }: { onClose: () => void }) {
  const members = useGame((s) => s.members);
  const bill = useGame((s) => s.bill);
  const extras = useGame((s) => s.extras);
  const setBill = useGame((s) => s.setBill);
  const setExtra = useGame((s) => s.setExtra);
  const notify = useGame((s) => s.notify);
  /** Người đang được sửa giờ đến / về. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = editingId ? members.find((m) => m.id === editingId) : undefined;
  const [now] = useState(() => Date.now());
  const [endText, setEndText] = useState(() => toHHMM(now));
  const [busy, setBusy] = useState(false);
  /** Ảnh bill dựng sẵn — để khi bấm "Lưu ảnh" gọi được bảng chia sẻ ngay (iOS bắt buộc gọi trong thao tác bấm). */
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  /** Máy không chia sẻ được ảnh: hiện ảnh xem trước để người dùng nhấn giữ → Lưu ảnh. */
  const [preview, setPreview] = useState(false);
  /** Ảnh xem trước dạng data URL: trình duyệt trong app (Zalo, Messenger) nhấn giữ lưu được, blob: thì hay không. */
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const openPreview = (blob: Blob) => {
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewSrc(typeof reader.result === "string" ? reader.result : null);
      setPreview(true);
    };
    reader.onerror = () => setPreview(true);
    reader.readAsDataURL(blob);
  };
  const imageRef = useRef(image);
  imageRef.current = image;

  const endAt = fromHHMM(endText, now) ?? now;
  const result = useMemo(() => computeBill(members, bill, extras, endAt), [members, bill, extras, endAt]);
  const male = genderWeight("male", bill.genderDiff);
  const diff = result.collected - result.cost;
  const dateText = new Date(now).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  const title = `🏸 Linh Cáo Badminton · Tiền sân ${dateText}`;
  const fileName = `tien-san-${dateText.replace(/\//g, "-")}.png`;
  const absentList = members.filter((m) => m.checkInAt === null);
  const absent = absentList.length;

  const text = [title, ...result.lines.map(billLineText), `Tổng: ${fmtVnd(result.grandTotal)}đ`].join("\n");

  const getImage = async () => {
    if (imageRef.current) return imageRef.current;
    // ảnh chưa kịp dựng: dựng ngay
    setBusy(true);
    const blob = await renderBillImage(result, bill, title).catch(() => null);
    setBusy(false);
    if (!blob) {
      notify("Không xuất được ảnh", "error");
      return null;
    }
    const img = { blob, url: URL.createObjectURL(blob) };
    setImage(img);
    return img;
  };

  /** Mở bảng chia sẻ của máy với file ảnh. Trả về false nếu trình duyệt không hỗ trợ / lỗi. */
  const shareFile = async (blob: Blob) => {
    const file = new File([blob], fileName, { type: "image/png" });
    if (!navigator.canShare?.({ files: [file] })) return false;
    try {
      await navigator.share({ files: [file], title });
    } catch (e) {
      // người dùng tự đóng bảng chia sẻ thì thôi, lỗi khác thì báo để dùng cách dự phòng
      if ((e as DOMException)?.name !== "AbortError") return false;
    }
    return true;
  };

  /**
   * Lưu ảnh bill — trang web KHÔNG xin được quyền thư viện ảnh; việc lưu do hệ điều hành làm:
   * - iPhone / iPad: bảng chia sẻ → "Lưu hình ảnh" vào Ảnh (lần đầu iOS tự hỏi quyền "Thêm ảnh").
   * - Android: tải file về thư mục Download — Bộ sưu tập / Google Photos tự hiện trong album "Download".
   * - Trình duyệt trong Zalo / Messenger / Facebook không cho tải file: hiện ảnh để nhấn giữ → Lưu ảnh.
   */
  const exportImage = async () => {
    const img = await getImage();
    if (!img) return;
    const p = platform();
    if (p === "inapp") {
      openPreview(img.blob);
      return;
    }
    if (p === "ios") {
      if (!(await shareFile(img.blob))) openPreview(img.blob);
      return;
    }
    download(img.url);
    notify(
      p === "android" ? "Đã lưu ảnh vào thư mục Download — mở Bộ sưu tập / Google Photos, album “Download”" : "Đã tải ảnh bảng tính tiền về máy",
      "success",
    );
  };

  const shareImage = async () => {
    const img = await getImage();
    if (!img) return;
    if (!(await shareFile(img.blob))) openPreview(img.blob);
  };
  const canShareFiles = typeof navigator !== "undefined" && typeof navigator.canShare === "function" && platform() !== "inapp";

  // dựng lại ảnh mỗi khi số liệu đổi (trễ một chút để không vẽ liên tục khi đang gõ)
  useEffect(() => {
    if (result.lines.length === 0) {
      setImage(null);
      return;
    }
    let cancelled = false;
    const id = window.setTimeout(async () => {
      const blob = await renderBillImage(result, bill, title).catch(() => null);
      if (cancelled || !blob) return;
      setImage({ blob, url: URL.createObjectURL(blob) });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [result, bill, title]);
  // dọn URL ảnh cũ
  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image.url);
    },
    [image],
  );

  function download(url: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
  }

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
      notify("Đã sao chép danh sách", "success");
    } catch {
      notify("Trình duyệt không cho sao chép", "error");
    }
  };

  return (
    <Modal
      title="💰 Tính tiền"
      subtitle={`${result.lines.length} người đã xác nhận vào sân${absent ? ` · ${absent} người chưa đến không tính` : ""}`}
      tone="from-emerald-500 to-sky-500"
      size="xl"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost mr-auto" onClick={copyText} disabled={result.lines.length === 0}>
            📋 Sao chép chữ
          </button>
          {canShareFiles && platform() !== "ios" && (
            <button className="btn btn-ghost" onClick={shareImage} disabled={busy || result.lines.length === 0} title="Gửi ảnh bill qua Zalo, Messenger…">
              📤 Gửi ảnh
            </button>
          )}
          <button className="btn btn-sky" onClick={exportImage} disabled={busy || result.lines.length === 0}>
            🖼️ {busy ? "Đang tạo ảnh…" : platform() === "ios" ? "Lưu / gửi ảnh bill" : "Lưu ảnh bill"}
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Xong
          </button>
        </>
      }
    >
      <section className="grid gap-3 rounded-3xl border-2 border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <MoneyInput label="Tiền sân" value={bill.courtFee} onChange={(v) => setBill({ courtFee: v })} />
        <MoneyInput label="Tiền cầu" value={bill.shuttleFee} onChange={(v) => setBill({ shuttleFee: v })} />
        <label className="block sm:col-span-2">
          <span className="flex justify-between text-xs font-bold text-slate-600">
            <span>Chênh lệch nam / nữ: {bill.genderDiff}</span>
            <span>
              <span style={{ color: GENDER_COLOR.male }}>Nam {male}%</span> ·{" "}
              <span style={{ color: GENDER_COLOR.female }}>Nữ {100 - male}%</span>
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={30}
            step={1}
            value={bill.genderDiff}
            onChange={(e) => setBill({ genderDiff: Number(e.target.value) })}
            aria-label="Chênh lệch nam nữ"
            className="mt-2 w-full accent-orange-500"
          />
        </label>
        <Segmented
          label="Tiền cầu chia"
          value={bill.shuttleBy}
          options={[
            ["head", "Theo đầu người"],
            ["time", "Theo thời gian"],
          ]}
          onChange={(v) => setBill({ shuttleBy: v })}
        />
        <label className="block">
          <span className="text-xs font-bold text-slate-600">Giờ kết thúc buổi</span>
          <input
            type="time"
            value={endText}
            onChange={(e) => setEndText(e.target.value)}
            aria-label="Giờ kết thúc buổi"
            className="mt-0.5 w-full select-text rounded-2xl border-2 border-slate-200 bg-white px-3 py-1.5 text-base font-extrabold text-slate-900 outline-none focus:border-orange-400"
          />
        </label>
        <p className="self-end text-[11px] font-medium leading-snug text-slate-500">
          Tiền sân chia theo số phút có mặt × tỉ lệ nam/nữ; mỗi người trả (phần sân + phần cầu) làm tròn lên 1.000đ. Người chưa bấm “Về” tính tới giờ kết thúc buổi.
        </p>
      </section>

      <section>
        <SectionTitle>Bảng tiền</SectionTitle>
        {result.lines.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-slate-200 px-3 py-5 text-center text-sm font-medium text-slate-500">
            Chưa ai được xác nhận vào sân. Bấm “✓ Vào” trong Thành viên.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] border-separate border-spacing-y-1 text-sm" aria-label="Bảng tính tiền">
              <thead>
                <tr className="text-left text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                  <th className="w-6 px-1">#</th>
                  <th className="px-1">Tên</th>
                  <th className="w-24 px-1">Vào</th>
                  <th className="w-24 px-1">Ra</th>
                  <th className="w-12 px-1 text-right">Phút</th>
                  <th className="w-20 px-1 text-right">Sân (đ)</th>
                  <th className="w-20 px-1 text-right">Cầu (đ)</th>
                  <th className="w-24 px-1 text-right" title="Phần sân + phần cầu, làm tròn lên 1.000đ">Sân + cầu</th>
                  <th className="w-36 px-1">Thêm (đ)</th>
                  <th className="w-24 px-1 text-right">Tổng (đ)</th>
                </tr>
              </thead>
              <tbody>
                {result.lines.map((line, i) => {
                  const m = line.member;
                  return (
                    <tr key={m.id} className="bg-slate-100 font-bold text-slate-800">
                      <td className="rounded-l-xl px-1 py-1 text-center text-xs text-slate-400">{i + 1}</td>
                      <td className="px-1">
                        <button
                          className="flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-0.5 py-1 text-left hover:bg-white"
                          onClick={() => setEditingId(m.id)}
                          title="Sửa giờ đến / về"
                        >
                          <span className="size-2.5 shrink-0 rounded-full" style={{ background: GENDER_COLOR[m.gender] }} />
                          <span className="truncate">{m.name}</span>
                          <span className="ml-auto shrink-0 text-xs opacity-70" aria-hidden>
                            ✏️
                          </span>
                        </button>
                      </td>
                      <td className="px-1">
                        <button
                          className={TIME_CHIP}
                          onClick={() => setEditingId(m.id)}
                          aria-label={`Giờ đến của ${m.name}: ${toHHMM(line.from)} — bấm để sửa`}
                        >
                          {toHHMM(line.from)}
                        </button>
                      </td>
                      <td className="px-1">
                        <button
                          className={`${TIME_CHIP} ${line.open ? "!border-dashed !border-emerald-400 !text-emerald-700" : ""}`}
                          onClick={() => setEditingId(m.id)}
                          title={line.open ? `Chưa về — tạm tính tới ${fmtHour(line.to)}` : undefined}
                          aria-label={`Giờ về của ${m.name}: ${line.open ? "còn ở sân" : toHHMM(line.to)} — bấm để sửa`}
                        >
                          {line.open ? `ở sân · ${fmtHour(line.to)}` : toHHMM(line.to)}
                        </button>
                      </td>
                      <td className="px-1 text-right tabular-nums text-slate-500">{line.minutes}</td>
                      <td className="px-1 text-right text-xs tabular-nums text-slate-500">{fmtVnd(line.court)}</td>
                      <td className="px-1 text-right text-xs tabular-nums text-slate-500">{fmtVnd(line.shuttle)}</td>
                      <td className="px-1 text-right tabular-nums text-slate-900">{fmtVnd(line.base)}</td>
                      <td className="px-1">
                        <input
                          value={extras[m.id] ?? ""}
                          placeholder="vd 40.000 + 20.000"
                          title="Nhập số tiền VNĐ, nhiều khoản cách nhau bằng + hoặc dấu phẩy. Gõ tắt 40 = 40.000đ"
                          aria-label={`Khoản thêm của ${m.name}`}
                          onChange={(e) => setExtra(m.id, e.target.value)}
                          onBlur={(e) => setExtra(m.id, formatExtras(e.target.value))}
                          className="w-full select-text rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-bold text-slate-900 placeholder:font-medium placeholder:text-slate-400"
                        />
                      </td>
                      <td className="rounded-r-xl px-1 text-right tabular-nums text-emerald-700">{fmtVnd(line.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {result.lines.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Chi phí: {fmtVnd(result.cost)}đ</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Thu sân + cầu: {fmtVnd(result.collected)}đ</span>
            <span
              className={`rounded-full px-3 py-1 ${diff === 0 ? "bg-emerald-100 text-emerald-700" : diff > 0 ? "bg-sky-100 text-sky-700" : "bg-rose-100 text-rose-600"}`}
              title="Chênh lệch do làm tròn lên 1.000đ mỗi người"
            >
              {diff === 0 ? "Khớp" : diff > 0 ? `Dư ${fmtVnd(diff)}đ` : `Thiếu ${fmtVnd(-diff)}đ`}
            </span>
            <span className="rounded-full bg-emerald-500 px-3 py-1 text-white">Tổng thu: {fmtVnd(result.grandTotal)}đ</span>
          </div>
        )}
        {result.lines.length > 0 && (
          <p className="mt-2 text-[11px] font-semibold text-slate-500">✏️ Bấm vào tên hoặc giờ để sửa giờ đến / giờ về.</p>
        )}
        {absent > 0 && (
          <div className="mt-3 rounded-2xl border-2 border-dashed border-slate-200 px-3 py-2">
            <p className="text-xs font-bold text-slate-600">Chưa điểm danh ({absent}) — không tính tiền. Quên điểm danh thì bấm tên để thêm giờ:</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {absentList.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setEditingId(m.id)}
                  className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full bg-slate-100 px-3 text-xs font-bold text-slate-700 transition hover:bg-sky-50 active:scale-95"
                >
                  <span className="size-2 rounded-full" style={{ background: GENDER_COLOR[m.gender] }} />
                  {m.name}
                  <span className="text-sky-600">＋ giờ</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
      {editing && <TimeEditor member={editing} endAt={endAt} onClose={() => setEditingId(null)} />}

      {result.lines.length > 0 && (
        <section>
          <SectionTitle>Xem trước</SectionTitle>
          <pre className="whitespace-pre-wrap rounded-2xl border-2 border-slate-200 bg-white px-3 py-2 font-sans text-sm font-medium leading-relaxed text-slate-800">
            {text}
          </pre>
        </section>
      )}

      {preview &&
        image &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] flex flex-col items-center gap-3 overflow-y-auto bg-slate-950/90 p-3"
            onClick={() => setPreview(false)}
          >
            <p className="rounded-2xl bg-white px-4 py-2 text-center text-sm font-bold text-slate-800 shadow">
              👆 Nhấn giữ vào ảnh → chọn <b>“Lưu vào Ảnh”</b> / <b>“Lưu hình ảnh”</b>
              {platform() === "inapp" && (
                <span className="mt-1 block text-xs font-semibold text-slate-500">
                  Không lưu được? Bấm ⋯ ở góc trên → <b>Mở bằng trình duyệt</b> (Safari / Chrome) rồi bấm Lưu ảnh bill.
                </span>
              )}
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewSrc ?? image.url}
              alt="Bảng tính tiền"
              className="w-full max-w-md rounded-2xl shadow-2xl"
              style={{ WebkitTouchCallout: "default", WebkitUserSelect: "auto", userSelect: "auto" }}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              <button className="btn btn-sky" onClick={() => download(image.url)}>
                ⬇️ Tải về
              </button>
              <button className="btn btn-ghost" onClick={() => setPreview(false)}>
                ✕ Đóng
              </button>
            </div>
          </div>,
          document.body,
        )}
    </Modal>
  );
}
