"use client";

import dynamic from "next/dynamic";

const Game = dynamic(() => import("@/components/Game"), {
  ssr: false,
  loading: () => (
    <div className="grid h-dvh place-items-center bg-gradient-to-b from-sky-400 to-sky-200 text-white">
      <div className="font-display animate-bounce text-2xl font-extrabold drop-shadow">🏸 Đang dựng sân…</div>
    </div>
  ),
});

export default function Page() {
  return <Game />;
}
