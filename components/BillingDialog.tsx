"use client";

import { useMemo, useState } from "react";
import { billLineText, computeBill, fmtHour, fmtK, fmtVnd, genderWeight, type Bill, type BillSettings } from "@/lib/billing";
import { useGame } from "@/lib/store";
import { GENDER_COLOR } from "@/lib/types";
import { Modal, SectionTitle } from "./Modal";

const pad = (n: number) => String(n).padStart(2, "0");
const toHHMM = (ts: number) => {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
/** "21:30" → mốc thời gian cùng ngày với `base`. */
function fromHHMM(value: string, base: number): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(base);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d.getTime();
}

/** Ô nhập tiền theo đơn vị nghìn đồng. */
function MoneyInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-600">{label}</span>
      <span className="mt-0.5 flex items-center rounded-2xl border-2 border-slate-200 bg-white pr-3 focus-within:border-orange-400">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step={1}
          value={value ? value / 1000 : ""}
          placeholder="0"
          onChange={(e) => onChange(Math.max(0, Math.round(Number(e.target.value || 0) * 1000)))}
          aria-label={label}
          className="w-full min-w-0 select-text bg-transparent px-3 py-1.5 text-base font-extrabold tabular-nums text-slate-900 outline-none"
        />
        <span className="text-sm font-bold text-slate-400">k</span>
      </span>
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
  const setMemberTimes = useGame((s) => s.setMemberTimes);
  const notify = useGame((s) => s.notify);
  const [now] = useState(() => Date.now());
  const [endText, setEndText] = useState(() => toHHMM(now));
  const [busy, setBusy] = useState(false);

  const endAt = fromHHMM(endText, now) ?? now;
  const result = useMemo(() => computeBill(members, bill, extras, endAt), [members, bill, extras, endAt]);
  const male = genderWeight("male", bill.genderDiff);
  const diff = result.collected - result.cost;
  const dateText = new Date(now).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  const title = `🏸 Tiền sân ${dateText}`;
  const absent = members.filter((m) => m.checkInAt === null).length;

  const text = [title, ...result.lines.map(billLineText), `Tổng: ${fmtVnd(result.grandTotal)}đ`].join("\n");

  const exportImage = async () => {
    setBusy(true);
    try {
      const blob = await renderBillImage(result, bill, title);
      if (!blob) throw new Error("no blob");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tien-san-${dateText.replace(/\//g, "-")}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      notify("Đã xuất ảnh bảng tính tiền", "success");
    } catch {
      notify("Không xuất được ảnh", "error");
    } finally {
      setBusy(false);
    }
  };

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
          <button className="btn btn-sky" onClick={exportImage} disabled={busy || result.lines.length === 0}>
            📷 {busy ? "Đang xuất…" : "Xuất ảnh"}
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
        <Segmented
          label="Làm tròn (1.000đ)"
          value={bill.rounding}
          options={[
            ["nearest", "Gần nhất"],
            ["up", "Lên"],
            ["down", "Xuống"],
          ]}
          onChange={(v) => setBill({ rounding: v })}
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
          Tiền sân chia theo số phút có mặt × tỉ lệ nam/nữ. Người chưa bấm “Về” tính tới giờ kết thúc buổi.
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
            <table className="w-full min-w-[700px] border-separate border-spacing-y-1 text-sm" aria-label="Bảng tính tiền">
              <thead>
                <tr className="text-left text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                  <th className="w-6 px-1">#</th>
                  <th className="px-1">Tên</th>
                  <th className="w-24 px-1">Vào</th>
                  <th className="w-24 px-1">Ra</th>
                  <th className="w-12 px-1 text-right">Phút</th>
                  <th className="w-14 px-1 text-right">Sân</th>
                  <th className="w-14 px-1 text-right">Cầu</th>
                  <th className="w-28 px-1">Thêm (k)</th>
                  <th className="w-16 px-1 text-right">Tổng</th>
                </tr>
              </thead>
              <tbody>
                {result.lines.map((line, i) => {
                  const m = line.member;
                  return (
                    <tr key={m.id} className="bg-slate-100 font-bold text-slate-800">
                      <td className="rounded-l-xl px-1 py-1 text-center text-xs text-slate-400">{i + 1}</td>
                      <td className="px-1">
                        <span className="flex items-center gap-1.5">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ background: GENDER_COLOR[m.gender] }} />
                          <span className="truncate">{m.name}</span>
                        </span>
                      </td>
                      <td className="px-1">
                        <input
                          type="time"
                          value={toHHMM(line.from)}
                          aria-label={`Giờ vào của ${m.name}`}
                          onChange={(e) => {
                            const t = fromHHMM(e.target.value, line.from);
                            if (t !== null) setMemberTimes(m.id, t, m.checkOutAt);
                          }}
                          className="w-full select-text rounded-lg border border-slate-200 bg-white px-1 py-0.5 text-xs font-bold text-slate-900"
                        />
                      </td>
                      <td className="px-1">
                        {line.open ? (
                          <button
                            className="w-full rounded-lg border border-dashed border-emerald-400 px-1 py-0.5 text-[11px] font-bold text-emerald-700"
                            title="Đang ở sân — bấm để chốt giờ ra bằng giờ kết thúc buổi"
                            onClick={() => setMemberTimes(m.id, line.from, endAt)}
                          >
                            ở sân · {fmtHour(line.to)}
                          </button>
                        ) : (
                          <input
                            type="time"
                            value={toHHMM(line.to)}
                            aria-label={`Giờ ra của ${m.name}`}
                            onChange={(e) => {
                              const t = fromHHMM(e.target.value, line.from);
                              if (t !== null) setMemberTimes(m.id, line.from, t);
                            }}
                            className="w-full select-text rounded-lg border border-slate-200 bg-white px-1 py-0.5 text-xs font-bold text-slate-900"
                          />
                        )}
                      </td>
                      <td className="px-1 text-right tabular-nums text-slate-500">{line.minutes}</td>
                      <td className="px-1 text-right tabular-nums">{fmtK(line.court)}</td>
                      <td className="px-1 text-right tabular-nums">{fmtK(line.shuttle)}</td>
                      <td className="px-1">
                        <input
                          value={extras[m.id] ?? ""}
                          placeholder="vd 40+20"
                          aria-label={`Khoản thêm của ${m.name}`}
                          onChange={(e) => setExtra(m.id, e.target.value)}
                          className="w-full select-text rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-bold text-slate-900 placeholder:font-medium placeholder:text-slate-400"
                        />
                      </td>
                      <td className="rounded-r-xl px-1 text-right tabular-nums text-emerald-700">{fmtK(line.total)}</td>
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
              title="Chênh lệch do làm tròn"
            >
              {diff === 0 ? "Khớp" : diff > 0 ? `Dư ${fmtVnd(diff)}đ` : `Thiếu ${fmtVnd(-diff)}đ`}
            </span>
            <span className="rounded-full bg-emerald-500 px-3 py-1 text-white">Tổng thu: {fmtVnd(result.grandTotal)}đ</span>
          </div>
        )}
      </section>

      {result.lines.length > 0 && (
        <section>
          <SectionTitle>Xem trước</SectionTitle>
          <pre className="whitespace-pre-wrap rounded-2xl border-2 border-slate-200 bg-white px-3 py-2 font-sans text-sm font-medium leading-relaxed text-slate-800">
            {text}
          </pre>
        </section>
      )}
    </Modal>
  );
}
