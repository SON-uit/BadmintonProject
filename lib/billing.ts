import type { Member } from "./types";

export interface BillSettings {
  /** Tổng tiền sân (đồng) — chia theo số phút mỗi người có mặt. */
  courtFee: number;
  /** Tổng tiền cầu (đồng). */
  shuttleFee: number;
  /** Chênh lệch nam / nữ, tính bằng điểm % quanh mốc 50: 10 → nam 60%, nữ 40%. */
  genderDiff: number;
  /** Tiền cầu chia theo đầu người (mặc định) hay theo thời gian như tiền sân. */
  shuttleBy: "head" | "time";
}

export const DEFAULT_BILL: BillSettings = {
  courtFee: 0,
  shuttleFee: 0,
  genderDiff: 0,
  shuttleBy: "head",
};

export interface BillLine {
  member: Member;
  from: number;
  to: number;
  /** Chưa xác nhận rời sân: tạm tính tới giờ kết thúc buổi. */
  open: boolean;
  minutes: number;
  /** Phần tiền sân (đã làm tròn). */
  court: number;
  /** Phần tiền cầu (đã làm tròn). */
  shuttle: number;
  /** Tiền sân + cầu của người này (đồng). */
  base: number;
  /** Các khoản thêm riêng (đồng): nợ cũ, nước… */
  extras: number[];
  total: number;
}

export interface Bill {
  lines: BillLine[];
  /** Tổng chi phí thật = tiền sân + tiền cầu. */
  cost: number;
  /** Tổng thu phần sân + cầu sau làm tròn (không tính khoản thêm). */
  collected: number;
  /** Tổng tất cả mọi người phải trả, kể cả khoản thêm. */
  grandTotal: number;
}

/** Tỉ trọng của một người theo giới tính: nam 50 + chênh lệch, nữ 50 − chênh lệch. */
export const genderWeight = (gender: Member["gender"], diff: number) => {
  const d = Math.max(0, Math.min(50, diff));
  return gender === "male" ? 50 + d : 50 - d;
};

/** Chuỗi chỉ gồm chữ số trong ô nhập tiền ("600.000 đ" → 600000). */
export const parseVnd = (text: string) => Number(text.replace(/\D/g, "") || 0);

/**
 * Khoản thêm theo VNĐ: "40.000 + 20.000", "40000, -5000" → [40000, 20000].
 * Gõ tắt số nhỏ hơn 1.000 được hiểu là nghìn đồng: "40+20" = 40.000 + 20.000.
 */
export function parseExtras(text: string | undefined): number[] {
  if (!text) return [];
  // bỏ dấu chấm / khoảng trắng phân cách hàng nghìn ("40.000" → "40000"), dấu phẩy = dấu cộng
  const clean = text.replace(/(\d)[.\s](?=\d{3}(?!\d))/g, "$1").replace(/,/g, "+");
  const found = clean.match(/[+-]?\s*\d+/g) ?? [];
  return found
    .map((n) => {
      const v = Number(n.replace(/\s/g, ""));
      return Math.abs(v) < 1000 ? v * 1000 : v;
    })
    .filter((n) => Number.isFinite(n) && n !== 0);
}

/** Định dạng lại ô khoản thêm cho dễ đọc: "40+20" → "40.000 + 20.000". */
export function formatExtras(text: string): string {
  return parseExtras(text)
    .map((v, i) => (i === 0 ? (v < 0 ? "-" : "") : v < 0 ? " - " : " + ") + fmtVnd(Math.abs(v)))
    .join("");
}

/** Mỗi người luôn được làm tròn LÊN tới 1.000đ (thu dư vài nghìn còn hơn thiếu). */
function roundUp1k(amount: number) {
  // trừ sai số dấu phẩy động để 44.0000001k không bị làm tròn lên 45k
  return Math.ceil(amount / 1000 - 1e-6) * 1000;
}

/**
 * Chia tiền cho những người đã xác nhận vào sân.
 * - Tiền sân: theo (số phút có mặt × tỉ trọng giới tính).
 * - Tiền cầu: theo tỉ trọng giới tính mỗi đầu người (hoặc theo thời gian nếu chọn).
 * `endAt`: giờ kết thúc buổi, dùng cho người chưa xác nhận rời sân.
 */
export function computeBill(
  members: Member[],
  settings: BillSettings,
  extras: Record<string, string>,
  endAt: number,
): Bill {
  const present = members
    .filter((m) => m.checkInAt !== null)
    .map((m) => {
      const from = m.checkInAt as number;
      const to = Math.max(from, m.checkOutAt ?? endAt);
      return {
        member: m,
        from,
        to,
        open: m.checkOutAt === null,
        minutes: Math.round((to - from) / 60_000),
        weight: genderWeight(m.gender, settings.genderDiff),
      };
    })
    .sort((a, b) => a.from - b.from || a.member.name.localeCompare(b.member.name, "vi"));

  const timeUnits = present.reduce((sum, p) => sum + p.weight * p.minutes, 0);
  const headUnits = present.reduce((sum, p) => sum + p.weight, 0);

  const lines: BillLine[] = present.map((p) => {
    const byTime = timeUnits > 0 ? (p.weight * p.minutes) / timeUnits : 0;
    const byHead = headUnits > 0 ? p.weight / headUnits : 0;
    const court = roundUp1k(settings.courtFee * byTime);
    const shuttle = roundUp1k(settings.shuttleFee * (settings.shuttleBy === "time" ? byTime : byHead));
    const base = court + shuttle;
    const extra = parseExtras(extras[p.member.id]);
    return {
      member: p.member,
      from: p.from,
      to: p.to,
      open: p.open,
      minutes: p.minutes,
      court,
      shuttle,
      base,
      extras: extra,
      total: base + extra.reduce((a, b) => a + b, 0),
    };
  });

  return {
    lines,
    cost: settings.courtFee + settings.shuttleFee,
    collected: lines.reduce((sum, l) => sum + l.base, 0),
    grandTotal: lines.reduce((sum, l) => sum + l.total, 0),
  };
}

/** 19h, 19h10, 21h30 — kiểu ghi giờ trong bảng tính tiền. */
export function fmtHour(ts: number) {
  const d = new Date(ts);
  const m = d.getMinutes();
  return `${d.getHours()}h${m ? String(m).padStart(2, "0") : ""}`;
}

/** 44000 → "44k"; 44500 → "44.5k". */
export function fmtK(amount: number) {
  const k = amount / 1000;
  return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
}

/** 600000 → "600.000". */
export const fmtVnd = (amount: number) => Math.round(amount).toLocaleString("vi-VN");

/** Một dòng giống mẫu: "5. Núi (19h - 21h30) 49k + 40k + 20k = 109k" (sân + cầu + khoản thêm = tổng). */
export function billLineText(line: BillLine, index: number) {
  const parts = [line.court, line.shuttle].filter((v) => v > 0);
  if (parts.length === 0) parts.push(0);
  const head = `${index + 1}. ${line.member.name} (${fmtHour(line.from)} - ${fmtHour(line.to)}) ${parts.map(fmtK).join(" + ")}`;
  const extras = line.extras.map((e) => (e < 0 ? ` - ${fmtK(-e)}` : ` + ${fmtK(e)}`)).join("");
  if (parts.length === 1 && line.extras.length === 0) return head;
  return `${head}${extras} = ${fmtK(line.total)}`;
}
