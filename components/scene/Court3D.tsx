"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { COURT_L, COURT_MARGIN, COURT_W, SLOT_LOCAL } from "@/lib/layout";
import { fmtElapsed } from "@/lib/logic";
import { useGame } from "@/lib/store";
import { MATCH_LABEL, vibeInfo, type Court } from "@/lib/types";

const HW = COURT_W / 2;
const HL = COURT_L / 2;
const LINE = 0.06;

/** Vạch kẻ sân đôi: [x, z, rộng, dài]. */
const LINES: [number, number, number, number][] = [
  [-HW, 0, LINE, COURT_L], // biên dọc đôi
  [HW, 0, LINE, COURT_L],
  [-HW + 0.46, 0, LINE, COURT_L], // biên dọc đơn
  [HW - 0.46, 0, LINE, COURT_L],
  [0, -HL, COURT_W, LINE], // biên ngang cuối sân
  [0, HL, COURT_W, LINE],
  [0, -HL + 0.76, COURT_W, LINE], // vạch giao cầu dài (đôi)
  [0, HL - 0.76, COURT_W, LINE],
  [0, -1.98, COURT_W, LINE], // vạch giao cầu ngắn
  [0, 1.98, COURT_W, LINE],
  [0, -(1.98 + HL) / 2, LINE, HL - 1.98], // vạch giữa
  [0, (1.98 + HL) / 2, LINE, HL - 1.98],
];

function Shuttle() {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    const t = state.clock.elapsedTime * 0.75;
    const leg = Math.floor(t);
    const k = t - leg;
    const dir = leg % 2 === 0 ? 1 : -1;
    g.position.z = dir * (-3.4 + 6.8 * k);
    g.position.y = 1.4 + Math.sin(Math.PI * k) * 2.4;
    g.position.x = Math.sin(leg * 2.4) * 1.6 * (1 - 2 * Math.abs(k - 0.5));
    g.rotation.x = dir * (Math.PI / 2 - Math.cos(Math.PI * k) * 0.9);
  });
  return (
    <group ref={ref}>
      <mesh position-y={0.1}>
        <coneGeometry args={[0.16, 0.3, 12, 1, true]} />
        <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
      </mesh>
      <mesh position-y={-0.07}>
        <sphereGeometry args={[0.075, 10, 10]} />
        <meshBasicMaterial color="#ff5a3c" />
      </mesh>
    </group>
  );
}

const CONFETTI = 90;
const CONFETTI_COLORS = ["#ff4d5a", "#ffc800", "#2f86ff", "#06c98b", "#ff2e93", "#8b46ff", "#ffffff"];

/** Pháo giấy bắn lên từ giữa sân khi một trận kết thúc. */
function Confetti() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const startedAt = useRef<number | null>(null);
  const { parts, dummy } = useMemo(
    () => ({
      dummy: new THREE.Object3D(),
      parts: Array.from({ length: CONFETTI }, () => ({
        x: (Math.random() - 0.5) * 3,
        z: (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 6,
        vy: 7 + Math.random() * 6,
        vz: (Math.random() - 0.5) * 8,
        spin: 4 + Math.random() * 9,
      })),
    }),
    [],
  );

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const color = new THREE.Color();
    parts.forEach((_, i) => mesh.setColorAt(i, color.set(CONFETTI_COLORS[i % CONFETTI_COLORS.length])));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [parts]);

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    startedAt.current ??= state.clock.elapsedTime;
    const t = state.clock.elapsedTime - startedAt.current;
    parts.forEach((p, i) => {
      // bay lên rồi rơi chậm như giấy
      const y = 1 + p.vy * t - 4.2 * t * t;
      dummy.position.set(p.x + p.vx * t, y, p.z + p.vz * t);
      dummy.rotation.set(p.spin * t, p.spin * t * 0.6, 0);
      dummy.scale.setScalar(y > 0.05 ? 1 : 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, CONFETTI]} frustumCulled={false}>
      <planeGeometry args={[0.3, 0.17]} />
      <meshBasicMaterial side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="tabular-nums">{fmtElapsed(now - since)}</span>;
}

/** Tên sân: bấm để đổi tên ngay tại chỗ (Enter lưu, Esc hủy). */
function CourtName({ court }: { court: Court }) {
  const renameCourt = useGame((s) => s.renameCourt);
  const [draft, setDraft] = useState<string | null>(null);

  if (draft === null) {
    return (
      <button
        className="font-display court-name block max-w-[9rem] cursor-text truncate text-left text-base font-extrabold leading-none text-slate-900 decoration-dotted underline-offset-2 hover:underline compact:max-w-[6rem] compact:text-sm"
        title="Bấm để đổi tên sân"
        aria-label={`Đổi tên ${court.name}`}
        onClick={() => setDraft(court.name)}
      >
        {court.name}
      </button>
    );
  }
  const save = () => {
    if (draft.trim() === court.name || renameCourt(court.id, draft)) setDraft(null);
  };
  return (
    <input
      autoFocus
      value={draft}
      maxLength={16}
      aria-label="Tên sân mới"
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") save();
        if (e.key === "Escape") setDraft(null);
        e.stopPropagation();
      }}
      className="font-display w-28 select-text rounded-lg border-2 border-orange-400 bg-white px-1.5 py-0.5 text-base font-extrabold leading-none text-slate-900 outline-none compact:w-20 compact:text-base"
    />
  );
}

function CourtLabel({ court }: { court: Court }) {
  const removeCourt = useGame((s) => s.removeCourt);
  const placeSelected = useGame((s) => s.placeSelected);
  const openDialog = useGame((s) => s.openDialog);
  const selectedCount = useGame((s) => s.selectedIds.length);
  const filled = court.slots.filter(Boolean).length;
  const playing = court.status === "playing";
  const ready = !playing && filled === 4;
  const vibe = court.vibe ? vibeInfo(court.vibe) : null;

  const onRemove = () => {
    if (!playing && filled > 0 && !window.confirm(`${court.name} đang có ${filled} người. Xóa sân và đưa họ về hàng chờ?`)) {
      return;
    }
    removeCourt(court.id); // sân đang có trận: store từ chối và báo lý do
  };

  return (
    <div
      className={`pointer-events-auto grid select-none grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1 whitespace-nowrap rounded-2xl border-2 px-2.5 py-1.5 shadow-lg compact:gap-1 compact:rounded-xl compact:px-1.5 compact:py-1 mobile:flex mobile:rounded-full mobile:border-2 mobile:px-2 mobile:py-0.5 ${
        playing ? "border-orange-400 bg-orange-50" : ready ? "border-emerald-400 bg-emerald-50" : "border-white bg-white/95"
      }`}
    >
      <div className="leading-tight">
        <CourtName court={court} />
        <div
          className={`text-[11px] font-bold compact:text-[10px] mobile:hidden ${
            playing ? "text-orange-600" : ready ? "text-emerald-600" : "text-slate-500"
          }`}
        >
          {playing ? (
            <>
              <span className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-orange-500 align-middle" />
              <span className="compact:hidden">
                {MATCH_LABEL[court.matchType ?? "free"]}
                {vibe && ` ${vibe.emoji}`} ·{" "}
              </span>
              <Elapsed since={court.startedAt ?? Date.now()} />
            </>
          ) : ready ? (
            <>
              ✅ {vibe ? `${vibe.emoji} ${vibe.name}` : "Đủ 4 người"}
              <span className="compact:hidden"> · chờ bắt đầu</span>
            </>
          ) : filled === 0 ? (
            "Sân trống"
          ) : (
            <>
              <span className="compact:hidden">Chờ đủ người </span>
              {filled}/4
            </>
          )}
        </div>
      </div>
      <button
        className={`btn btn-ghost !px-2 !py-1 !text-xs compact:!min-h-8 compact:!px-2 mobile:hidden ${playing ? "opacity-40" : ""}`}
        title={playing ? "Đang có trận — kết thúc trận trước khi xóa sân" : "Xóa sân"}
        aria-disabled={playing}
        aria-label={`Xóa ${court.name}`}
        onClick={onRemove}
      >
        🗑️
      </button>
      {playing ? (
        <button
          className="btn btn-danger col-span-2 !py-1 !text-xs compact:!min-h-9 compact:!text-[13px] mobile:hidden"
          aria-label={`Kết thúc trận ở ${court.name}`}
          onClick={() => openDialog({ kind: "finish", courtId: court.id })}
        >
          🏁 Kết thúc
        </button>
      ) : ready ? null /* nút ▶ Bắt đầu gom về cột "Sân sẵn sàng" (ReadyDock) cho dễ bấm */ : selectedCount > 0 ? (
        <button
          // màn hình nhỏ: ẩn nút này, dùng các nút sân trên thanh "đã chọn" (hoặc chạm thẳng vào sân)
          className="btn btn-pink col-span-2 !py-1 !text-xs compact:hidden"
          aria-label={`Xếp ${selectedCount} người vào ${court.name}`}
          onClick={() => placeSelected(court.id)}
        >
          👆 Xếp {selectedCount} người
        </button>
      ) : (
        <button
          className="btn btn-amber col-span-2 !py-1 !text-xs compact:!min-h-9 compact:!text-[13px] mobile:hidden"
          title="Chọn thể loại + tính chất rồi tự xếp người vào sân này"
          aria-label={`Xếp trận cho ${court.name}`}
          onClick={() => openDialog({ kind: "arrange", courtId: court.id })}
        >
          🎲 Xếp trận
        </button>
      )}
    </div>
  );
}

interface Props {
  court: Court;
  x: number;
  z: number;
  /** Sân ở dãy trước: nhãn đặt ở mép gần camera. */
  front: boolean;
  /** Đẩy nhãn lùi ra sau một nấc — dùng so le khi các sân đứng sát nhau để nhãn không đè lên nhau. */
  labelBack: boolean;
  overlay: RefObject<HTMLElement>;
}

function Court3D({ court, x, z, front, labelBack, overlay }: Props) {
  const dragHover = useGame((s) => s.hoverCourtId === court.id);
  const dragging = useGame((s) => s.draggingId !== null);
  const hasSelection = useGame((s) => s.selectedIds.length > 0);
  const placeSelected = useGame((s) => s.placeSelected);
  const [pointerOver, setPointerOver] = useState(false);
  const frameMat = useRef<THREE.MeshBasicMaterial>(null);

  const playing = court.status === "playing";
  const filled = court.slots.filter(Boolean).length;
  const ready = !playing && filled === 4;
  const canDrop = !playing && filled < 4;
  // đang chọn người: sân còn chỗ trở thành mục tiêu bấm
  const clickTarget = hasSelection && canDrop;
  const hovered = dragHover || (clickTarget && pointerOver);

  const frame = hovered
    ? playing
      ? "#ff3b3b"
      : "#ffe14d"
    : clickTarget
      ? "#ff2e93"
      : playing
        ? "#ff7a1a"
        : ready
          ? "#22c55e"
          : filled > 0
            ? "#18b6f6"
            : "#ffffff";

  // trận vừa kết thúc (đang đánh → hết đánh): bắn pháo giấy vài giây
  const [celebrate, setCelebrate] = useState(0);
  const wasPlaying = useRef(playing);
  useEffect(() => {
    if (wasPlaying.current && !playing) setCelebrate(Date.now());
    wasPlaying.current = playing;
  }, [playing]);
  useEffect(() => {
    if (!celebrate) return;
    const id = setTimeout(() => setCelebrate(0), 4500);
    return () => clearTimeout(id);
  }, [celebrate]);

  useEffect(() => {
    if (!(clickTarget && pointerOver)) return;
    document.body.style.cursor = "pointer";
    return () => {
      document.body.style.cursor = "";
    };
  }, [clickTarget, pointerOver]);

  // viền nhấp nháy khi sân chờ được bấm chọn, hoặc đã đủ người chờ bấm Bắt đầu
  useFrame((state) => {
    if (!frameMat.current) return;
    const blink = (clickTarget || ready) && !hovered ? 0.65 + Math.sin(state.clock.elapsedTime * 6) * 0.35 : 1;
    frameMat.current.opacity = blink;
  });

  return (
    <group
      position={[x, 0, z]}
      onClick={(e) => {
        // e.delta: quãng đường con trỏ đi từ lúc nhấn — lớn nghĩa là đang xoay camera, không phải bấm
        if (!hasSelection || e.delta > 6) return;
        e.stopPropagation();
        placeSelected(court.id);
      }}
      onPointerOver={() => setPointerOver(true)}
      onPointerOut={() => setPointerOver(false)}
    >
      {/* viền màu theo trạng thái */}
      <mesh position-y={-0.07}>
        <boxGeometry args={[COURT_W + COURT_MARGIN * 2 + 0.5, 0.16, COURT_L + COURT_MARGIN * 2 + 0.5]} />
        <meshBasicMaterial ref={frameMat} color={frame} transparent />
      </mesh>
      {/* thảm xanh dương quanh sân */}
      <mesh position-y={-0.04} receiveShadow>
        <boxGeometry args={[COURT_W + COURT_MARGIN * 2, 0.14, COURT_L + COURT_MARGIN * 2]} />
        <meshToonMaterial color="#2b7bf0" />
      </mesh>
      {/* mặt sân */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.035} receiveShadow>
        <planeGeometry args={[COURT_W, COURT_L]} />
        <meshToonMaterial color={playing ? "#2fd08a" : "#25bf7b"} />
      </mesh>
      {LINES.map(([lx, lz, w, l], i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[lx, 0.045, lz]}>
          <planeGeometry args={[w, l]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}

      {/* lưới */}
      {[-HW - 0.1, HW + 0.1].map((px) => (
        <mesh key={px} position={[px, 0.78, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 1.56, 10]} />
          <meshToonMaterial color="#ffc21a" />
        </mesh>
      ))}
      <mesh position={[0, 1.17, 0]}>
        <planeGeometry args={[COURT_W + 0.2, 0.76, 42, 6]} />
        <meshBasicMaterial color="#1f2a44" wireframe transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, 1.55, 0]}>
        <boxGeometry args={[COURT_W + 0.2, 0.08, 0.04]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* ô đứng còn trống */}
      {!playing &&
        court.slots.map((id, i) =>
          id ? null : (
            <mesh key={i} rotation-x={-Math.PI / 2} position={[SLOT_LOCAL[i][0], 0.05, SLOT_LOCAL[i][1]]}>
              <ringGeometry args={[0.42, 0.58, 32]} />
              <meshBasicMaterial
                color={dragging || hasSelection ? "#ffe14d" : "#ffffff"}
                transparent
                opacity={dragging || hasSelection ? 1 : 0.5}
              />
            </mesh>
          ),
        )}

      {playing && <Shuttle />}
      {celebrate > 0 && <Confetti key={celebrate} />}

      <Html
        portal={overlay}
        position={front ? [0, 0.4, HL + COURT_MARGIN + 1.4] : [0, 3.4, -HL - COURT_MARGIN - (labelBack ? 4.2 : 0)]}
        center
        zIndexRange={[40, 21]}
      >
        <CourtLabel court={court} />
      </Html>
    </group>
  );
}

export default memo(Court3D);
