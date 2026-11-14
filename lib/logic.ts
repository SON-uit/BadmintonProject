import {
  MATCH_LABEL,
  vibeInfo,
  type DoublesType,
  type Match,
  type MatchType,
  type Member,
  type Vibe,
} from "./types";

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/** Số nam / nữ cần cho mỗi thể loại đánh đôi. */
export const REQUIRED: Record<DoublesType, { male: number; female: number }> = {
  men: { male: 4, female: 0 },
  women: { male: 0, female: 4 },
  mixed: { male: 2, female: 2 },
};

export function shuffle<T>(items: T[], rnd: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const males = (list: { gender: string }[]) => list.filter((m) => m.gender === "male").length;

export function detectType(teamA: Member[], teamB: Member[]): MatchType {
  const m = males([...teamA, ...teamB]);
  if (m === 4) return "men";
  if (m === 0) return "women";
  if (m === 2 && males(teamA) === 1 && males(teamB) === 1) return "mixed";
  return "free";
}

/** Một người chờ kèm số liệu để xét ưu tiên. */
export interface Candidate {
  member: Member;
  /** Số trận đã đánh hôm nay. */
  played: number;
  /** Đã chờ bao lâu. */
  waitedMs: number;
}

/** Ưu tiên: ít trận hơn trước; bằng trận thì ai chờ lâu hơn trước. */
export const byPriority = (a: Candidate, b: Candidate) => a.played - b.played || b.waitedMs - a.waitedMs;

/** Các khoảng trình [thấp, cao] hợp lệ cho từng tính chất trận. */
const LEVEL_WINDOWS: Record<Vibe, [number, number][]> = {
  // Khô Máu: cùng trình hoặc lệch tối đa 1 bậc
  intense: [
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 7],
  ],
  // Giao Lưu: cùng trình
  chill: [
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
    [5, 5],
    [6, 6],
    [7, 7],
  ],
  // Dưỡng Sinh: Newbie → Yếu
  easy: [[1, 2]],
};

export type PickResult = { ok: true; picked: Member[] } | { ok: false; reason: string };

/**
 * Chọn người từ hàng chờ cho đủ 4 theo thể loại + tính chất trận.
 * `pool` đã sắp theo ưu tiên (xem byPriority); `existing` là người đã đứng sẵn trong sân và được giữ lại.
 * Thử từng khoảng trình hợp lệ, lấy khoảng nào gom được những người ưu tiên cao nhất.
 */
export function pickForMatch(pool: Candidate[], existing: Member[], type: DoublesType, vibe: Vibe): PickResult {
  const req = REQUIRED[type];
  const needMale = req.male - males(existing);
  const needFemale = req.female - (existing.length - males(existing));
  if (needMale < 0 || needFemale < 0) {
    return { ok: false, reason: `người đang đứng trong sân không hợp thể loại ${MATCH_LABEL[type]}` };
  }

  const info = vibeInfo(vibe);
  let best: { picked: Member[]; score: number } | null = null;
  let existingFits = false;
  for (const [lo, hi] of LEVEL_WINDOWS[vibe]) {
    if (existing.some((m) => m.level < lo || m.level > hi)) continue;
    existingFits = true;
    const picked: Member[] = [];
    let score = 0;
    let m = 0;
    let f = 0;
    pool.forEach((c, rank) => {
      const { level, gender } = c.member;
      if (level < lo || level > hi) return;
      if (gender === "male" ? m >= needMale : f >= needFemale) return;
      picked.push(c.member);
      score += rank; // hạng càng nhỏ = càng được ưu tiên
      if (gender === "male") m++;
      else f++;
    });
    if (m < needMale || f < needFemale) continue;
    if (!best || score < best.score) best = { picked, score };
  }
  if (best) return { ok: true, picked: best.picked };

  if (!existingFits) {
    return { ok: false, reason: `người đang đứng trong sân không hợp tính chất ${info.name} (${info.rule})` };
  }
  const parts: string[] = [];
  if (needMale > 0) parts.push(`${needMale} nam`);
  if (needFemale > 0) parts.push(`${needFemale} nữ`);
  return {
    ok: false,
    reason: `hàng chờ không đủ ${parts.join(" + ")} ${info.rule} cho ${MATCH_LABEL[type]} · ${info.name}`,
  };
}

const SPLITS: [number, number, number, number][] = [
  [0, 1, 2, 3],
  [0, 2, 1, 3],
  [0, 3, 1, 2],
];

/**
 * Chia 4 người thành 2 đội sao cho tổng trình độ cân nhất.
 * Đôi nam nữ: mỗi đội bắt buộc 1 nam + 1 nữ. Trả về [A1, A2, B1, B2].
 */
export function arrangeTeams(players: Member[], type: DoublesType, rnd: () => number = Math.random): Member[] {
  const p = shuffle(players, rnd);
  let best: Member[] = p;
  let bestDiff = Infinity;
  for (const [a1, a2, b1, b2] of SPLITS) {
    const teamA = [p[a1], p[a2]];
    const teamB = [p[b1], p[b2]];
    if (type === "mixed" && (males(teamA) !== 1 || males(teamB) !== 1)) continue;
    const diff = Math.abs(teamA[0].level + teamA[1].level - teamB[0].level - teamB[1].level);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = [...teamA, ...teamB];
    }
  }
  return best;
}

export function isSameDay(a: number, b: number) {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

export const matchesOfDay = (matches: Match[], day: number = Date.now()) =>
  matches.filter((m) => isSameDay(m.endedAt, day));

/** Số trận đã đánh theo id thành viên. */
export function playedCount(matches: Match[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of matches) {
    for (const p of [...m.teamA, ...m.teamB]) map.set(p.id, (map.get(p.id) ?? 0) + 1);
  }
  return map;
}

/** Thứ tự hàng chờ theo ưu tiên vào sân: ít trận trước, bằng trận thì chờ lâu trước. */
export function sortQueueByPriority(
  queue: string[],
  played: Map<string, number>,
  queuedAt: Record<string, number>,
): string[] {
  return queue
    .map((id, index) => ({ id, index }))
    .sort(
      (a, b) =>
        (played.get(a.id) ?? 0) - (played.get(b.id) ?? 0) ||
        (queuedAt[a.id] ?? Infinity) - (queuedAt[b.id] ?? Infinity) ||
        a.index - b.index,
    )
    .map((x) => x.id);
}

const pad = (n: number) => String(n).padStart(2, "0");

export function fmtClock(ts: number) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

export function fmtMinutes(ms: number) {
  const m = Math.round(ms / 60000);
  return m < 1 ? "<1 phút" : `${m} phút`;
}

/** Thời gian chờ dạng ngắn: 0′, 7′, 1g05′. */
export function fmtWait(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)}g${pad(m % 60)}′` : `${m}′`;
}
