"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ArenaBounds } from "@/lib/layout";
import { matchesOfDay } from "@/lib/logic";
import { useGame } from "@/lib/store";
import { drawFox } from "../FoxMark";
import { TIER_DEPTH, TIERS } from "./Crowd";

/** Bề dày khán đài tính từ mép sàn đấu. */
export const STAND_DEPTH = TIERS * TIER_DEPTH + 0.6;
/** Khoảng lùi sau khán đài phía sau dành cho bảng điện tử. */
export const SCOREBOARD_ROOM = 3.5;
const PALETTE = ["#ff4d5a", "#ffc800", "#2f86ff", "#06c98b", "#ff2e93", "#8b46ff", "#ff8a1f", "#00b4f0"];

/** Khu nhà thi đấu: hình chữ nhật ôm sàn đấu + khán đài, tường bao nằm ở mép ngoài. */
interface Venue {
  hw: number;
  hd: number;
  cz: number;
  r: number;
}

function venueOf(bounds: ArenaBounds, sides: boolean): Venue {
  const hw = bounds.halfW + (sides ? 1.5 + STAND_DEPTH : 1) + 2.5;
  const zBack = bounds.minZ - STAND_DEPTH - SCOREBOARD_ROOM - 1.5;
  const zFront = bounds.maxZ + 3;
  const hd = (zFront - zBack) / 2;
  return { hw, hd, cz: (zFront + zBack) / 2, r: Math.min(8, hw - 1, hd - 1) };
}

/* ---------- linh vật gà nhảy cổ vũ ---------- */
function ChickenMascot({ x, z, facing, phase }: { x: number; z: number; facing: number; phase: number }) {
  const root = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Mesh>(null);
  const wingR = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime * 1.15 + phase;
    if (root.current) {
      root.current.position.y = Math.abs(Math.sin(t * 4)) * 0.45;
      root.current.rotation.y = facing + Math.sin(t * 2) * 0.5;
      root.current.rotation.z = Math.sin(t * 4) * 0.08;
    }
    const flap = Math.sin(t * 8) * 0.7;
    if (wingL.current) wingL.current.rotation.z = 0.6 + flap;
    if (wingR.current) wingR.current.rotation.z = -0.6 - flap;
  });
  return (
    <group position={[x, 0, z]} scale={1.25}>
      <group ref={root}>
        {/* chân */}
        {[-0.28, 0.28].map((lx) => (
          <mesh key={lx} position={[lx, 0.22, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.44, 6]} />
            <meshToonMaterial color="#ff9d1f" />
          </mesh>
        ))}
        {/* thân + đầu */}
        <mesh position-y={1.1} castShadow>
          <sphereGeometry args={[0.85, 20, 16]} />
          <meshToonMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, 2.05, 0.12]} castShadow>
          <sphereGeometry args={[0.55, 18, 14]} />
          <meshToonMaterial color="#ffffff" />
        </mesh>
        {/* mào */}
        {[-0.16, 0.02, 0.2].map((cz, i) => (
          <mesh key={i} position={[0, 2.62 - Math.abs(cz - 0.02) * 0.5, cz + 0.08]}>
            <sphereGeometry args={[0.16, 10, 8]} />
            <meshToonMaterial color="#ff3b4d" />
          </mesh>
        ))}
        {/* mỏ + yếm */}
        <mesh position={[0, 2, 0.68]} rotation-x={Math.PI / 2}>
          <coneGeometry args={[0.16, 0.36, 8]} />
          <meshToonMaterial color="#ffb400" />
        </mesh>
        <mesh position={[0, 1.78, 0.6]}>
          <sphereGeometry args={[0.11, 8, 8]} />
          <meshToonMaterial color="#ff3b4d" />
        </mesh>
        {/* mắt */}
        {[-0.2, 0.2].map((ex) => (
          <mesh key={ex} position={[ex, 2.17, 0.6]}>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshBasicMaterial color="#1f2937" />
          </mesh>
        ))}
        {/* cánh vẫy */}
        <mesh ref={wingL} position={[-0.8, 1.25, 0]} scale={[0.75, 0.22, 0.5]}>
          <sphereGeometry args={[0.7, 12, 10]} />
          <meshToonMaterial color="#f1f5f9" />
        </mesh>
        <mesh ref={wingR} position={[0.8, 1.25, 0]} scale={[0.75, 0.22, 0.5]}>
          <sphereGeometry args={[0.7, 12, 10]} />
          <meshToonMaterial color="#f1f5f9" />
        </mesh>
        {/* áo số */}
        <mesh position={[0, 1.02, 0]} scale={[1.02, 0.5, 1.02]}>
          <sphereGeometry args={[0.85, 20, 12]} />
          <meshToonMaterial color="#ff6a1a" />
        </mesh>
      </group>
    </group>
  );
}

/* ---------- bảng điện tử ---------- */
function Scoreboard({ x, z, width }: { x: number; z: number; width: number }) {
  const playing = useGame((s) => s.courts.filter((c) => c.status === "playing").length);
  const waiting = useGame((s) => s.queue.length);
  const matches = useGame((s) => s.matches);
  const today = useMemo(() => matchesOfDay(matches).length, [matches]);
  const height = 4.2;

  const { canvas, texture } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = Math.round((1024 * height) / width);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return { canvas, texture };
  }, [width]);
  useEffect(() => () => texture.dispose(), [texture]);

  useEffect(() => {
    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const { width: w, height: h } = canvas;
      // dùng lại font tiêu đề của trang (Baloo 2), có dấu tiếng Việt
      const family = getComputedStyle(document.documentElement).getPropertyValue("--font-baloo").trim() || "sans-serif";
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, "#1b2452");
      bg.addColorStop(1, "#0d1330");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      // chấm LED mờ
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      for (let y = 6; y < h; y += 12) for (let xx = 6; xx < w; xx += 12) ctx.fillRect(xx, y, 3, 3);

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const title = ctx.createLinearGradient(w * 0.2, 0, w * 0.8, 0);
      title.addColorStop(0, "#ffb020");
      title.addColorStop(0.5, "#ff4d8d");
      title.addColorStop(1, "#38d9f5");
      ctx.fillStyle = title;
      ctx.font = `800 ${Math.round(h * 0.34)}px ${family}`;
      // logo cáo hai bên tên; tên dài tự co chữ (maxWidth) để chừa chỗ cho logo
      const fox = h * 0.4;
      const gap = fox * 0.25;
      const maxText = w * 0.94 - 2 * (fox + gap);
      const textW = Math.min(ctx.measureText("LINH CÁO BADMINTON").width, maxText);
      ctx.fillText("LINH CÁO BADMINTON", w / 2, h * 0.3, maxText);
      drawFox(ctx, w / 2 - textW / 2 - gap - fox / 2, h * 0.28, fox);
      drawFox(ctx, w / 2 + textW / 2 + gap + fox / 2, h * 0.28, fox);

      const stats: [string, string, string][] = [
        [String(playing), "ĐANG ĐÁNH", "#ff8a3d"],
        [String(waiting), "ĐANG CHỜ", "#38d9f5"],
        [String(today), "TRẬN HÔM NAY", "#7ee06a"],
      ];
      stats.forEach(([value, label, color], i) => {
        const cx = (w * (i * 2 + 1)) / 6;
        ctx.fillStyle = color;
        ctx.font = `800 ${Math.round(h * 0.3)}px ${family}`;
        ctx.fillText(value, cx, h * 0.66);
        ctx.fillStyle = "#cbd5f5";
        ctx.font = `700 ${Math.round(h * 0.1)}px ${family}`;
        ctx.fillText(label, cx, h * 0.88);
      });
      texture.needsUpdate = true;
    };
    draw();
    // font web có thể tải xong sau lần vẽ đầu
    let cancelled = false;
    document.fonts?.ready.then(() => !cancelled && draw());
    return () => {
      cancelled = true;
    };
  }, [canvas, texture, playing, waiting, today]);

  return (
    <group position={[x, 0, z]}>
      {[-width / 2 + 0.6, width / 2 - 0.6].map((px) => (
        <mesh key={px} position={[px, 2.6, -0.2]}>
          <cylinderGeometry args={[0.18, 0.22, 5.8, 8]} />
          <meshToonMaterial color="#39445c" />
        </mesh>
      ))}
      {/* ngả ra sau một chút để camera từ trên nhìn rõ */}
      <group position-y={5.6} rotation-x={-0.32}>
        <mesh position-z={-0.12}>
          <boxGeometry args={[width + 0.5, height + 0.5, 0.3]} />
          <meshToonMaterial color="#ffc21a" />
        </mesh>
        <mesh position-z={0.05}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------- nhà thi đấu trong nhà (tông sáng): sàn, tường bao, băng rôn, dải đèn ---------- */
const WALL_H = 13;
const WALL_T = 0.5;

/** Một mảng tường: thân tường + đai đệm màu dưới chân + băng rôn + dải đèn cửa sổ trên cao. */
function Wall({ length, seed }: { length: number; seed: number }) {
  const night = useGame((st) => st.theme === "dark");
  const banners = Math.max(2, Math.floor(length / 7));
  const step = length / banners;
  const lamps = Math.max(3, Math.floor(length / 4.5));
  const lampStep = length / lamps;
  return (
    <group>
      <mesh position-y={WALL_H / 2} receiveShadow>
        <boxGeometry args={[length, WALL_H, WALL_T]} />
        {/* ban ngày: tường sơn trắng ngà sáng sủa · ban đêm: xám xanh */}
        <meshToonMaterial color={night ? "#334155" : "#f1f4f8"} />
      </mesh>
      {/* đai đệm xanh dưới chân tường */}
      <mesh position={[0, 1.1, WALL_T / 2 + 0.02]}>
        <boxGeometry args={[length, 2.2, 0.08]} />
        <meshToonMaterial color={night ? "#1d4ed8" : "#3b82f6"} />
      </mesh>
      <mesh position={[0, 2.25, WALL_T / 2 + 0.04]}>
        <boxGeometry args={[length, 0.12, 0.06]} />
        <meshBasicMaterial color="#facc15" />
      </mesh>
      {/* băng rôn treo tường */}
      {Array.from({ length: banners }, (_, i) => (
        <mesh key={i} position={[-length / 2 + step * (i + 0.5), 5.6, WALL_T / 2 + 0.03]}>
          <boxGeometry args={[step * 0.7, 2.2, 0.05]} />
          <meshToonMaterial color={PALETTE[(i + seed) % PALETTE.length]} />
        </mesh>
      ))}
      {/* dải cửa sổ / đèn trên cao */}
      {Array.from({ length: lamps }, (_, i) => (
        <mesh key={i} position={[-length / 2 + lampStep * (i + 0.5), 10.6, WALL_T / 2 + 0.03]}>
          <boxGeometry args={[lampStep * 0.6, 1.3, 0.05]} />
          {/* ban ngày: ô cửa kính lấy sáng xanh trời · ban đêm: đèn vàng ấm */}
          <meshBasicMaterial color={night ? "#fff4cf" : "#a9dcff"} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function Hall({ venue }: { venue: Venue }) {
  const night = useGame((st) => st.theme === "dark");
  const back = venue.cz - venue.hd;
  const width = venue.hw * 2;
  const depth = venue.hd * 2 + 30; // tường hai bên kéo dài ra phía trước, ngoài khung camera
  return (
    <group>
      {/* sàn nhà thi đấu (ngoài khu sân): nền polyurethane xám xanh */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.32, venue.cz + 10]} receiveShadow>
        <planeGeometry args={[width + 4, venue.hd * 2 + 60]} />
        <meshToonMaterial color={night ? "#475569" : "#d9e0e8"} />
      </mesh>
      {/* tường sau (sau bảng điện tử) */}
      <group position={[0, -0.3, back - WALL_T / 2]}>
        <Wall length={width + WALL_T * 2} seed={0} />
      </group>
      {/* tường hai bên, mặt quay vào trong */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (venue.hw + WALL_T / 2), -0.3, back + depth / 2]} rotation-y={(-side * Math.PI) / 2}>
          <Wall length={depth} seed={side > 0 ? 3 : 5} />
        </group>
      ))}
    </group>
  );
}

/**
 * Bối cảnh nhà thi đấu trong nhà quanh sàn đấu: sàn hall, tường bao có băng rôn và dải đèn,
 * bảng điện tử phía sau, linh vật gà. `sides`: có khán đài hai bên (màn hình ngang).
 */
export default function Scenery({ bounds, sides }: { bounds: ArenaBounds; sides: boolean }) {
  const { halfW, minZ, maxZ } = bounds;
  const venue = useMemo(() => venueOf({ halfW, minZ, maxZ }, sides), [halfW, minZ, maxZ, sides]);
  const boardWidth = Math.max(8, Math.min(16, halfW * 2 - 2));
  const boardZ = minZ - STAND_DEPTH - 1.4;

  return (
    <group>
      <Hall venue={venue} />
      <Scoreboard x={0} z={boardZ} width={boardWidth} />
      <ChickenMascot x={-halfW + 0.9} z={maxZ - 1.6} facing={0.5} phase={0} />
      <ChickenMascot x={halfW - 0.9} z={maxZ - 1.6} facing={-0.5} phase={1.7} />
    </group>
  );
}
