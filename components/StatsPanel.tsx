"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtClock, fmtMinutes, matchesOfDay } from "@/lib/logic";
import { useGame } from "@/lib/store";
import {
  GENDER_COLOR,
  levelInfo,
  levelLabel,
  MATCH_LABEL,
  vibeInfo,
  type Gender,
  type Level,
  type MatchPlayer,
} from "@/lib/types";

interface Row {
  id: string;
  name: string;
  gender: Gender;
  level: Level;
  count: number;
  wins: number;
  losses: number;
  playMs: number;
}

function Team({ players, align, won }: { players: MatchPlayer[]; align: "left" | "right"; won: boolean }) {
  return (
    <div
      className={`min-w-0 flex-1 space-y-0.5 rounded-xl px-2 py-1 ${won ? "bg-emerald-100 ring-2 ring-emerald-400" : ""} ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {won && <div className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-700">🏆 Thắng</div>}
      {players.map((p) => (
        <div key={p.id} className={`flex items-center gap-1.5 ${align === "right" ? "flex-row-reverse" : ""}`}>
          <span className="size-2 shrink-0 rounded-full" style={{ background: GENDER_COLOR[p.gender] }} />
          <span className="truncate text-sm font-bold text-slate-900">{p.name}</span>
          <span title={levelLabel(p.level)}>{levelInfo(p.level).emoji}</span>
        </div>
      ))}
    </div>
  );
}

export default function StatsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const members = useGame((s) => s.members);
  const matches = useGame((s) => s.matches);
  const clearTodayHistory = useGame((s) => s.clearTodayHistory);
  const [tab, setTab] = useState<"stats" | "history">("stats");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const { today, rows } = useMemo(() => {
    const today = matchesOfDay(matches).sort((a, b) => b.endedAt - a.endedAt);
    const map = new Map<string, Row>();
    // thành viên hiện tại (kể cả chưa đánh trận nào)
    for (const m of members) {
      map.set(m.id, { id: m.id, name: m.name, gender: m.gender, level: m.level, count: 0, wins: 0, losses: 0, playMs: 0 });
    }
    for (const match of today) {
      const tally = (players: MatchPlayer[], team: "A" | "B") => {
        for (const p of players) {
          // người đã bị xóa vẫn được tính nhờ bản chụp lưu trong trận
          const row = map.get(p.id) ?? { ...p, count: 0, wins: 0, losses: 0, playMs: 0 };
          row.count += 1;
          row.playMs += match.endedAt - match.startedAt;
          if (match.winner) {
            if (match.winner === team) row.wins += 1;
            else row.losses += 1;
          }
          map.set(p.id, row);
        }
      };
      tally(match.teamA, "A");
      tally(match.teamB, "B");
    }
    const rows = [...map.values()].sort(
      (a, b) => b.wins - a.wins || a.losses - b.losses || b.count - a.count || a.name.localeCompare(b.name, "vi"),
    );
    return { today, rows };
  }, [members, matches]);

  if (!open) return null;

  const dateLabel = new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div className="absolute inset-0 z-40 flex justify-end bg-sky-950/30" onClick={onClose}>
      <aside
        role="dialog"
        aria-label="Thống kê hôm nay"
        onClick={(e) => e.stopPropagation()}
        className="panel m-2 flex w-[28rem] max-w-[calc(100vw-1rem)] flex-col overflow-hidden sm:m-3"
      >
        <header className="sport-stripes flex items-start justify-between bg-gradient-to-r from-orange-500 to-pink-500 px-4 py-3">
          <div>
            <h2 className="font-display text-lg font-extrabold text-white drop-shadow-sm">📊 Thống kê hôm nay</h2>
            <p className="text-xs font-semibold capitalize text-white/90">{dateLabel}</p>
          </div>
          <button onClick={onClose} aria-label="Đóng" className="btn btn-ghost !px-2.5 !py-1 !shadow-none">
            ✕
          </button>
        </header>

        <div className="grid grid-cols-2 gap-2 px-4 pt-3">
          <div className="rounded-2xl bg-slate-100 px-3 py-2">
            <div className="font-display text-2xl font-extrabold tabular-nums text-emerald-500">{today.length}</div>
            <div className="text-[11px] font-semibold text-slate-500">trận đã đánh</div>
          </div>
          <div className="rounded-2xl bg-slate-100 px-3 py-2">
            <div className="font-display text-2xl font-extrabold tabular-nums text-sky-500">{rows.filter((r) => r.count > 0).length}</div>
            <div className="text-[11px] font-semibold text-slate-500">người đã ra sân</div>
          </div>
        </div>

        <div className="mx-4 mt-3 flex rounded-2xl bg-slate-100 p-1" role="tablist">
          {(
            [
              ["stats", "Thắng / thua từng người"],
              ["history", `Lịch sử trận (${today.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`flex-1 cursor-pointer rounded-xl py-1.5 text-xs font-extrabold transition ${
                tab === key ? "bg-white text-orange-600 shadow" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="thin-scroll flex-1 overflow-y-auto px-4 py-3">
          {tab === "stats" ? (
            rows.length === 0 ? (
              <p className="py-8 text-center text-sm font-medium text-slate-500">Chưa có thành viên nào.</p>
            ) : (
              <table className="w-full border-separate border-spacing-y-1 text-sm" aria-label="Thắng thua từng người">
                <thead>
                  <tr className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                    <th className="px-2 text-left font-extrabold">Thành viên</th>
                    <th className="w-10 font-extrabold">Trận</th>
                    <th className="w-10 font-extrabold text-emerald-600">Thắng</th>
                    <th className="w-10 font-extrabold text-rose-500">Thua</th>
                    <th className="w-12 font-extrabold">Tỉ lệ</th>
                    <th className="w-14 pr-2 text-right font-extrabold">Đánh</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const decided = r.wins + r.losses;
                    return (
                      <tr key={r.id} className="bg-slate-100 text-center font-bold tabular-nums text-slate-700">
                        <td className="rounded-l-xl py-1.5 pl-2 text-left">
                          <span className="flex items-center gap-1.5">
                            <span className="size-2.5 shrink-0 rounded-full" style={{ background: GENDER_COLOR[r.gender] }} />
                            <span className="truncate text-slate-900">{r.name}</span>
                            <span title={levelLabel(r.level)}>{levelInfo(r.level).emoji}</span>
                          </span>
                        </td>
                        <td>{r.count}</td>
                        <td className="text-emerald-600">{r.wins}</td>
                        <td className="text-rose-500">{r.losses}</td>
                        <td className="text-xs">{decided > 0 ? `${Math.round((r.wins / decided) * 100)}%` : "—"}</td>
                        <td className="rounded-r-xl pr-2 text-right text-[11px] font-semibold text-slate-500">
                          {r.count > 0 ? fmtMinutes(r.playMs) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : today.length === 0 ? (
            <p className="py-8 text-center text-sm font-medium text-slate-500">Hôm nay chưa có trận nào kết thúc.</p>
          ) : (
            <ul className="space-y-2" aria-label="Lịch sử trận">
              {today.map((m, i) => {
                const vibe = m.vibe ? vibeInfo(m.vibe) : null;
                return (
                  <li key={m.id} className="rounded-2xl bg-slate-100 px-2 py-2">
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-2 px-1 text-[11px] font-semibold text-slate-500">
                      <span className="font-extrabold text-slate-800">
                        #{today.length - i} · {m.courtName} · {MATCH_LABEL[m.type]}
                        {vibe && ` · ${vibe.emoji} ${vibe.name}`}
                      </span>
                      <span className="tabular-nums">
                        {fmtClock(m.startedAt)}–{fmtClock(m.endedAt)} · {fmtMinutes(m.endedAt - m.startedAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Team players={m.teamA} align="left" won={m.winner === "A"} />
                      <span className="font-display text-xs font-extrabold text-orange-500">VS</span>
                      <Team players={m.teamB} align="right" won={m.winner === "B"} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {today.length > 0 && (
          <footer className="border-t-2 border-slate-100 px-4 py-2.5">
            <button
              className="btn btn-ghost w-full !text-xs !text-rose-500"
              onClick={() => {
                if (window.confirm(`Xóa toàn bộ ${today.length} trận của hôm nay? Không thể hoàn tác.`)) clearTodayHistory();
              }}
            >
              Xóa lịch sử hôm nay
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}
