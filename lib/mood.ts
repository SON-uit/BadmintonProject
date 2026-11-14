import { isSameDay } from "./logic";
import type { Match, Member } from "./types";

/** Chờ quá ngần này phút mà chưa được vào sân thì bắt đầu bực. */
export const ANGRY_WAIT_MINUTES = 10;
const ANGRY_WAIT_MS = ANGRY_WAIT_MINUTES * 60_000;
/** Vừa xuống sân / vừa tới thì chưa so đo số trận ngay. */
const FEWER_GRACE_MS = 2 * 60_000;

export interface Mood {
  /** 0 = bình thường · 1 = bực (😤) · 2 = giận dữ (😡) */
  level: 0 | 1 | 2;
  waitedMs: number;
  /** Số trận ít hơn so với người đánh nhiều nhất (chỉ tính từ lúc người này có mặt). */
  behind: number;
  reasons: string[];
}

export const moodEmoji = (level: Mood["level"]) => (level === 2 ? "😡" : level === 1 ? "😤" : "");

/**
 * Tâm trạng của những người đang ở hàng chờ. Một người bực khi:
 *  - đã chờ quá lâu (≥ ANGRY_WAIT_MINUTES phút) chưa được đánh, hoặc
 *  - được ghép ít trận hơn mọi người: ít hơn người đánh nhiều nhất từ 2 trận, hoặc là người duy nhất ít trận nhất.
 * Dính cả hai, chờ gấp đôi ngưỡng, hoặc ít hơn từ 3 trận thì thành giận dữ.
 */
export function computeMoods(
  members: Member[],
  queue: string[],
  queuedAt: Record<string, number>,
  matches: Match[],
  now: number,
): Map<string, Mood> {
  const today = matches.filter((m) => isSameDay(m.endedAt, now));
  const byId = new Map(members.map((m) => [m.id, m]));
  const moods = new Map<string, Mood>();

  for (const id of queue) {
    const me = byId.get(id);
    if (!me) continue;
    const waitedMs = Math.max(0, now - (queuedAt[id] ?? now));

    // chỉ so với các trận diễn ra từ lúc người này có mặt — người tới muộn không bị tính là "thiệt"
    const counts = new Map<string, number>();
    for (const match of today) {
      if (match.endedAt < me.joinedAt) continue;
      for (const p of [...match.teamA, ...match.teamB]) counts.set(p.id, (counts.get(p.id) ?? 0) + 1);
    }
    const mine = counts.get(id) ?? 0;
    const others = members.filter((m) => m.id !== id).map((m) => counts.get(m.id) ?? 0);
    const behind = others.length ? Math.max(0, Math.max(...others) - mine) : 0;
    const lowestAlone = others.length > 0 && others.every((c) => c > mine);

    const waitLong = waitedMs >= ANGRY_WAIT_MS;
    const fewer = waitedMs >= FEWER_GRACE_MS && (behind >= 2 || lowestAlone);

    const reasons: string[] = [];
    if (waitLong) reasons.push(`Chờ ${Math.floor(waitedMs / 60_000)} phút chưa được đánh`);
    if (fewer) reasons.push(lowestAlone && behind < 2 ? "Đánh ít trận nhất" : `Đánh ít hơn ${behind} trận`);

    let level: Mood["level"] = 0;
    if (waitLong || fewer) level = 1;
    if ((waitLong && fewer) || waitedMs >= ANGRY_WAIT_MS * 2 || (fewer && behind >= 3)) level = 2;
    moods.set(id, { level, waitedMs, behind, reasons });
  }
  return moods;
}
