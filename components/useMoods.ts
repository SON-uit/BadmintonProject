"use client";

import { useEffect, useMemo, useState } from "react";
import { matchesOfDay, playedCount, sortQueueByPriority } from "@/lib/logic";
import { computeMoods } from "@/lib/mood";
import { useGame } from "@/lib/store";

/** Đồng hồ thô (15 giây một nhịp) cho những thứ phụ thuộc thời gian chờ. */
function useTick() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/**
 * Góc nhìn chung về hàng chờ, dùng cho cả danh sách lẫn cảnh 3D:
 * - `order`: hàng chờ sắp theo ưu tiên vào sân (ít trận trước, bằng trận thì chờ lâu trước)
 * - `moods`: thời gian chờ + mức bực của từng người đang chờ
 * - `played`: số trận hôm nay của từng người
 */
export function useQueueView() {
  const members = useGame((s) => s.members);
  const queue = useGame((s) => s.queue);
  const queuedAt = useGame((s) => s.queuedAt);
  const matches = useGame((s) => s.matches);
  const tick = useTick();

  return useMemo(() => {
    // Math.max: thay đổi dữ liệu (thêm người, kết thúc trận) được tính ngay, không đợi nhịp 15 giây
    const now = Math.max(tick, Date.now());
    const played = playedCount(matchesOfDay(matches, now));
    return {
      order: sortQueueByPriority(queue, played, queuedAt),
      moods: computeMoods(members, queue, queuedAt, matches, now),
      played,
    };
  }, [members, queue, queuedAt, matches, tick]);
}
