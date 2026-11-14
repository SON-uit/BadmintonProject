"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { seeded } from "@/lib/appearance";
import type { ArenaBounds } from "@/lib/layout";
import { matchesOfDay } from "@/lib/logic";
import { useGame } from "@/lib/store";
import { TIER_DEPTH, TIERS } from "./Crowd";

/** Bề dày khán đài tính từ mép sàn đấu. */
export const STAND_DEPTH = TIERS * TIER_DEPTH + 0.6;
/** Khoảng lùi sau khán đài phía sau dành cho bảng điện tử. */
export const SCOREBOARD_ROOM = 3.5;
const TRACK_WIDTH = 6;
const PALETTE = ["#ff4d5a", "#ffc800", "#2f86ff", "#06c98b", "#ff2e93", "#8b46ff", "#ff8a1f", "#00b4f0"];

/** Khu "sân vận động": hình chữ nhật bo góc ôm sát sàn đấu + khán đài; đường chạy nằm ngay bên ngoài. */
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

/** Vẽ hình chữ nhật bo góc (tâm ở gốc) vào Shape / Path. */
function roundedRect<T extends THREE.Path>(path: T, hw: number, hd: number, r: number): T {
  path.moveTo(-hw + r, -hd);
  path.lineTo(hw - r, -hd);
  path.absarc(hw - r, -hd + r, r, -Math.PI / 2, 0, false);
  path.lineTo(hw, hd - r);
  path.absarc(hw - r, hd - r, r, 0, Math.PI / 2, false);
  path.lineTo(-hw + r, hd);
  path.absarc(-hw + r, hd - r, r, Math.PI / 2, Math.PI, false);
  path.lineTo(-hw, -hd + r);
  path.absarc(-hw + r, -hd + r, r, Math.PI, Math.PI * 1.5, false);
  return path;
}

/* ---------- cỏ sọc như sân bóng ---------- */
function Grass() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#9be06a";
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "#8ed65c";
    ctx.fillRect(0, 0, 32, 64);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(50, 50);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.3} receiveShadow>
      <circleGeometry args={[400, 48]} />
      <meshToonMaterial map={texture} />
    </mesh>
  );
}

/* ---------- đường chạy điền kinh quanh sân ---------- */
function Track({ venue }: { venue: Venue }) {
  const { hw, hd, r, cz } = venue;
  const { surface, lanes } = useMemo(() => {
    const ring = (inner: number, outer: number) => {
      const shape = roundedRect(new THREE.Shape(), hw + outer, hd + outer, r + outer);
      shape.holes.push(roundedRect(new THREE.Path(), hw + inner, hd + inner, r + inner));
      return new THREE.ShapeGeometry(shape, 20);
    };
    return {
      surface: ring(0, TRACK_WIDTH),
      lanes: [0.12, 1.55, 3, 4.45, 5.88].map((o) => ring(o - 0.07, o + 0.07)),
    };
  }, [hw, hd, r]);
  useEffect(
    () => () => {
      surface.dispose();
      lanes.forEach((g) => g.dispose());
    },
    [surface, lanes],
  );

  return (
    <group position={[0, -0.27, cz]} rotation-x={-Math.PI / 2}>
      <mesh geometry={surface} receiveShadow>
        <meshToonMaterial color="#ee5d43" />
      </mesh>
      {lanes.map((geometry, i) => (
        <mesh key={i} geometry={geometry} position-z={0.012}>
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  );
}

/* ---------- người chạy bộ trên đường chạy ---------- */
const RUNNERS = 9;

function Runners({ venue }: { venue: Venue }) {
  const { hw, hd, r, cz } = venue;
  const body = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.InstancedMesh>(null);
  const { path, length, runners } = useMemo(() => {
    const mid = TRACK_WIDTH / 2;
    const path = roundedRect(new THREE.Path(), hw + mid, hd + mid, r + mid);
    const rnd = seeded(4242);
    const runners = Array.from({ length: RUNNERS }, (_, i) => ({
      start: rnd(),
      speed: 3.2 + rnd() * 2.4, // m/s
      lane: (i % 4) * 1.45 - 2.2,
      phase: rnd() * 6,
    }));
    return { path, length: path.getLength(), runners };
  }, [hw, hd, r]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    const color = new THREE.Color();
    runners.forEach((_, i) => {
      body.current?.setColorAt(i, color.set(PALETTE[i % PALETTE.length]));
      head.current?.setColorAt(i, color.set(i % 3 === 0 ? "#e2a56b" : "#ffd3ab"));
    });
    if (body.current?.instanceColor) body.current.instanceColor.needsUpdate = true;
    if (head.current?.instanceColor) head.current.instanceColor.needsUpdate = true;
  }, [runners]);

  useFrame((state) => {
    if (!body.current || !head.current) return;
    const t = state.clock.elapsedTime;
    runners.forEach((runner, i) => {
      const u = (runner.start + (t * runner.speed) / length) % 1;
      const p = path.getPointAt(u);
      const tan = path.getTangentAt(u);
      // pháp tuyến hướng ra ngoài để lệch theo làn chạy
      const x = p.x + tan.y * runner.lane;
      const z = cz - (p.y - tan.x * runner.lane);
      const bob = Math.abs(Math.sin(t * 9 + runner.phase)) * 0.16;
      dummy.rotation.set(0.18, Math.atan2(tan.x, -tan.y), 0);
      dummy.position.set(x, 0.32 + bob, z);
      dummy.updateMatrix();
      body.current!.setMatrixAt(i, dummy.matrix);
      dummy.position.y += 0.62;
      dummy.updateMatrix();
      head.current!.setMatrixAt(i, dummy.matrix);
    });
    body.current.instanceMatrix.needsUpdate = true;
    head.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={body} args={[undefined, undefined, RUNNERS]} frustumCulled={false} castShadow>
        <capsuleGeometry args={[0.24, 0.5, 4, 10]} />
        <meshToonMaterial />
      </instancedMesh>
      <instancedMesh ref={head} args={[undefined, undefined, RUNNERS]} frustumCulled={false}>
        <sphereGeometry args={[0.21, 12, 10]} />
        <meshToonMaterial />
      </instancedMesh>
    </>
  );
}

/* ---------- cây xanh rải quanh ---------- */
const TREE_CANDIDATES = (() => {
  const rnd = seeded(77);
  return Array.from({ length: 320 }, () => ({
    x: (rnd() - 0.5) * 230,
    z: (rnd() - 0.5) * 210 + 10,
    scale: 0.8 + rnd() * 0.9,
    tint: rnd(),
  }));
})();
const TREE_GREENS = ["#4fb646", "#63c653", "#3fa53c", "#7bd660"];

function Trees({ venue }: { venue: Venue }) {
  const trunk = useRef<THREE.InstancedMesh>(null);
  const crown = useRef<THREE.InstancedMesh>(null);
  const top = useRef<THREE.InstancedMesh>(null);
  // vị trí ứng viên cố định; chỉ bỏ những cây rơi vào sân / đường chạy — đổi số sân thì cây không "nhảy" chỗ
  const trees = useMemo(() => {
    const pad = TRACK_WIDTH + 2.5;
    return TREE_CANDIDATES.filter((t) => {
      const inVenue = Math.abs(t.x) < venue.hw + pad && Math.abs(t.z - venue.cz) < venue.hd + pad;
      // chừa trống phía trước cho camera nhìn vào
      const blocksCamera = t.z > venue.cz + venue.hd + pad && Math.abs(t.x) < venue.hw + 6;
      return !inVenue && !blocksCamera;
    }).slice(0, 150);
  }, [venue.hw, venue.hd, venue.cz]);
  const count = trees.length;

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    trees.forEach((t, i) => {
      dummy.scale.setScalar(t.scale);
      dummy.position.set(t.x, 0.6 * t.scale - 0.3, t.z);
      dummy.updateMatrix();
      trunk.current?.setMatrixAt(i, dummy.matrix);
      dummy.position.y = 2.2 * t.scale - 0.3;
      dummy.updateMatrix();
      crown.current?.setMatrixAt(i, dummy.matrix);
      dummy.position.y = 3.3 * t.scale - 0.3;
      dummy.scale.setScalar(t.scale * 0.68);
      dummy.updateMatrix();
      top.current?.setMatrixAt(i, dummy.matrix);
      const green = color.set(TREE_GREENS[Math.floor(t.tint * TREE_GREENS.length)]);
      crown.current?.setColorAt(i, green);
      top.current?.setColorAt(i, green);
    });
    for (const ref of [trunk, crown, top]) {
      if (!ref.current) continue;
      ref.current.instanceMatrix.needsUpdate = true;
      if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    }
  }, [trees]);

  if (count === 0) return null;
  return (
    <group key={count}>
      <instancedMesh ref={trunk} args={[undefined, undefined, count]} frustumCulled={false}>
        <cylinderGeometry args={[0.22, 0.3, 1.2, 6]} />
        <meshToonMaterial color="#8a5a35" />
      </instancedMesh>
      <instancedMesh ref={crown} args={[undefined, undefined, count]} frustumCulled={false} castShadow>
        <icosahedronGeometry args={[1.45, 1]} />
        <meshToonMaterial />
      </instancedMesh>
      <instancedMesh ref={top} args={[undefined, undefined, count]} frustumCulled={false}>
        <icosahedronGeometry args={[1.45, 1]} />
        <meshToonMaterial />
      </instancedMesh>
    </group>
  );
}

/* ---------- cột đèn sân vận động ---------- */
function Floodlight({ x, z, lookZ }: { x: number; z: number; lookZ: number }) {
  const height = 13;
  return (
    <group position={[x, -0.3, z]}>
      <mesh position-y={height / 2} castShadow>
        <cylinderGeometry args={[0.16, 0.3, height, 8]} />
        <meshToonMaterial color="#d5dbe6" />
      </mesh>
      {/* dàn đèn quay về giữa sân, hơi chúc xuống */}
      <group position-y={height} rotation-y={Math.atan2(-x, lookZ - z)}>
        <group rotation-x={0.5}>
          <mesh>
            <boxGeometry args={[3.4, 2.1, 0.35]} />
            <meshToonMaterial color="#39445c" />
          </mesh>
          {[-1.1, 0, 1.1].flatMap((lx) =>
            [-0.5, 0.5].map((ly) => (
              <mesh key={`${lx}${ly}`} position={[lx, ly, 0.2]}>
                <circleGeometry args={[0.38, 14]} />
                <meshBasicMaterial color="#fff6bf" />
              </mesh>
            )),
          )}
        </group>
      </group>
    </group>
  );
}

/* ---------- hàng cờ phấp phới ---------- */
function Flags({ points }: { points: [number, number][] }) {
  const cloths = useRef<(THREE.Group | null)[]>([]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    cloths.current.forEach((g, i) => {
      if (!g) return;
      g.rotation.y = Math.sin(t * 2.4 + i * 1.3) * 0.45 + 0.3;
      g.scale.x = 0.9 + Math.sin(t * 5 + i) * 0.08;
    });
  });
  return (
    <>
      {points.map(([x, z], i) => (
        <group key={i} position={[x, -0.3, z]}>
          <mesh position-y={3.1}>
            <cylinderGeometry args={[0.06, 0.07, 6.2, 6]} />
            <meshToonMaterial color="#f1f5f9" />
          </mesh>
          <mesh position-y={6.25}>
            <sphereGeometry args={[0.13, 8, 8]} />
            <meshToonMaterial color="#ffc800" />
          </mesh>
          <group
            position-y={5.55}
            ref={(g) => {
              cloths.current[i] = g;
            }}
          >
            <mesh position-x={0.85}>
              <planeGeometry args={[1.7, 1.05]} />
              <meshToonMaterial color={PALETTE[i % PALETTE.length]} side={THREE.DoubleSide} />
            </mesh>
          </group>
        </group>
      ))}
    </>
  );
}

/* ---------- dây cờ đuôi nheo ---------- */
function Bunting({ from, to, sag = 2.2, count = 18 }: { from: THREE.Vector3Tuple; to: THREE.Vector3Tuple; sag?: number; count?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const [fx, fy, fz] = from;
  const [tx, ty, tz] = to;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const yaw = Math.atan2(tx - fx, tz - fz) + Math.PI / 2;
    for (let i = 0; i < count; i++) {
      const k = (i + 0.5) / count;
      // dây võng xuống ở giữa
      dummy.position.set(fx + (tx - fx) * k, fy + (ty - fy) * k - Math.sin(Math.PI * k) * sag - 0.35, fz + (tz - fz) * k);
      dummy.rotation.set(Math.PI, yaw, 0);
      dummy.scale.set(1, 1, 0.12);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.set(PALETTE[i % PALETTE.length]));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [fx, fy, fz, tx, ty, tz, sag, count]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <coneGeometry args={[0.42, 0.75, 3]} />
      <meshToonMaterial />
    </instancedMesh>
  );
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
      ctx.fillText("🏸 SAPSAN CUP 🏸", w / 2, h * 0.3);

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

/**
 * Bối cảnh sân vận động quanh sàn đấu: cỏ sọc, đường chạy có người chạy bộ, cây, cột đèn,
 * cờ, dây cờ, linh vật gà và bảng điện tử. `sides`: có khán đài hai bên (màn hình ngang).
 */
export default function Scenery({ bounds, sides }: { bounds: ArenaBounds; sides: boolean }) {
  const { halfW, minZ, maxZ } = bounds;
  const venue = useMemo(() => venueOf({ halfW, minZ, maxZ }, sides), [halfW, minZ, maxZ, sides]);
  const boardWidth = Math.max(8, Math.min(16, halfW * 2 - 2));
  const boardZ = minZ - STAND_DEPTH - 1.4;

  const towerX = venue.hw + TRACK_WIDTH + 1.6;
  const towerBack = venue.cz - venue.hd - TRACK_WIDTH - 1.6;
  const towerFront = venue.cz + venue.hd + TRACK_WIDTH + 1.6;

  // cờ: dọc phía sau khán đài hai bên (màn hình ngang), và hai bên bảng điện tử
  const flags = useMemo(() => {
    const points: [number, number][] = [];
    for (const side of [-1, 1]) {
      for (let x = boardWidth / 2 + 2; x < halfW + 1; x += 3.2) points.push([side * x, boardZ - 0.4]);
      if (sides) {
        const fx = side * (halfW + 1.5 + STAND_DEPTH + 0.7);
        for (let z = minZ + 3; z < maxZ - 3; z += 5) points.push([fx, z]);
      }
    }
    return points;
  }, [boardWidth, boardZ, halfW, minZ, maxZ, sides]);

  return (
    <group>
      <Grass />
      <Track venue={venue} />
      <Runners venue={venue} />
      <Trees venue={venue} />

      <Floodlight x={-towerX} z={towerBack} lookZ={venue.cz} />
      <Floodlight x={towerX} z={towerBack} lookZ={venue.cz} />
      <Floodlight x={-towerX} z={towerFront} lookZ={venue.cz} />
      <Floodlight x={towerX} z={towerFront} lookZ={venue.cz} />

      <Scoreboard x={0} z={boardZ} width={boardWidth} />
      <Bunting from={[-towerX, 11.5, towerBack]} to={[-boardWidth / 2, 7.6, boardZ]} />
      <Bunting from={[boardWidth / 2, 7.6, boardZ]} to={[towerX, 11.5, towerBack]} />
      <Flags points={flags} />

      <ChickenMascot x={-halfW + 0.9} z={maxZ - 1.6} facing={0.5} phase={0} />
      <ChickenMascot x={halfW - 0.9} z={maxZ - 1.6} facing={-0.5} phase={1.7} />
    </group>
  );
}
