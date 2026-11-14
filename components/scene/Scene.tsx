"use client";

import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { arenaBounds, courtCenter, queueLayout, SLOT_LOCAL, type ArenaBounds, type QueueLayout } from "@/lib/layout";
import { useGame } from "@/lib/store";
import { useQueueView } from "../useMoods";
import type { Member } from "@/lib/types";
import Court3D from "./Court3D";
import Crowd from "./Crowd";
import DragController from "./DragController";
import Scenery from "./Scenery";
import Player3D, { type PlayerMode } from "./Player3D";

interface Placement {
  member: Member;
  x: number;
  z: number;
  facing: number;
  mode: PlayerMode;
}

/** Góc nhìn mặc định của camera so với mặt sàn (điện thoại nhìn dốc hơn: sân to, ít bị che, dễ chạm). */
const ELEVATION = THREE.MathUtils.degToRad(52);
const ELEVATION_COMPACT = THREE.MathUtils.degToRad(62);
/** Lề quanh khu sân khi căn camera (mét) — khán đài, cảnh xung quanh nằm ngoài khung để sân to nhất có thể. */
const FIT_MARGIN = 0.8;
/** Phần màn hình bị HUD che (px): bảng thành viên bên trái, thanh trên, ngăn kéo / gợi ý bên dưới. */
export interface HudInsets {
  left: number;
  top: number;
  bottom: number;
}

/**
 * Tự căn camera cho vừa toàn bộ sân + hàng chờ mỗi khi số sân, kích thước cửa sổ thay đổi
 * hoặc khi bấm nút "Căn giữa" (fitKey tăng). Người dùng vẫn xoay / phóng to tự do sau đó.
 */
function CameraRig({
  bounds,
  fitKey,
  insets,
  compact,
}: {
  bounds: ArenaBounds;
  fitKey: number;
  insets: HudInsets;
  compact: boolean;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as unknown as {
    target: THREE.Vector3;
    update: () => void;
    addEventListener: (type: string, fn: () => void) => void;
    removeEventListener: (type: string, fn: () => void) => void;
  } | null;
  const goal = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const first = useRef(true);
  const { halfW, minZ, maxZ } = bounds;
  const { left, top, bottom } = insets;

  useEffect(() => {
    // dời tâm khung hình sang phải / xuống dưới để cảnh nằm giữa vùng không bị HUD che
    camera.setViewOffset(size.width, size.height, -left / 2, -(top - bottom) / 2, size.width, size.height);
    camera.updateProjectionMatrix();

    const usableW = Math.max(160, size.width - left);
    const usableH = Math.max(160, size.height - top - bottom);
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const tanV = tanHalf * (usableH / size.height);
    const tanH = tanHalf * (usableW / size.height);
    // khung cần vừa: chỉ sàn đấu (các sân + sảnh chờ) — sân hiện to nhất có thể
    // điện thoại: ôm sát mép ngoài các sân để sân hiện to nhất khi nhìn chính diện
    const fitHalfW = halfW + (compact ? 0 : FIT_MARGIN);
    const zBack = minZ + 2 - FIT_MARGIN; // sàn có chừa 4.5m phía sau cho nhãn sân, không cần thấy hết
    const zFront = maxZ + FIT_MARGIN;
    const fitHalfD = (zFront - zBack) / 2;
    const elevation = compact ? ELEVATION_COMPACT : ELEVATION;
    const sin = Math.sin(elevation);
    const cos = Math.cos(elevation);
    const distance = Math.max(fitHalfW / tanH + fitHalfD * cos * 0.6, (fitHalfD * sin) / tanV + fitHalfD * cos) * 1.02;
    const target = new THREE.Vector3(0, 0, (zBack + zFront) / 2);
    const position = new THREE.Vector3(0, distance * sin, target.z + distance * cos);

    if (first.current && controls) {
      // lần đầu: đặt thẳng, không cần chuyển động
      camera.position.copy(position);
      controls.target.copy(target);
      controls.update();
      first.current = false;
      goal.current = null;
    } else {
      goal.current = { position, target };
    }
  }, [camera, controls, size.width, size.height, halfW, minZ, maxZ, fitKey, left, top, bottom, compact]);

  // người dùng chạm vào camera thì ngừng tự căn
  useEffect(() => {
    if (!controls) return;
    const stop = () => {
      goal.current = null;
    };
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [controls]);

  useFrame((_, delta) => {
    if (!goal.current || !controls) return;
    const k = 1 - Math.exp(-5 * delta);
    camera.position.lerp(goal.current.position, k);
    controls.target.lerp(goal.current.target, k);
    controls.update();
    if (camera.position.distanceTo(goal.current.position) < 0.05) goal.current = null;
  });

  return null;
}

/**
 * Khi camera lùi xa (nhiều sân), nhãn tên chiếm nhiều chỗ so với cảnh: gắn data-zoom="far"
 * lên lớp phủ để CSS thu gọn nhãn (ẩn huy hiệu trình độ) cho đỡ đè nhau.
 */
function ZoomWatcher({ overlay }: { overlay: RefObject<HTMLElement> }) {
  const last = useRef("");
  useFrame(({ camera, size, controls }) => {
    const target = (controls as unknown as { target?: THREE.Vector3 } | null)?.target;
    const el = overlay.current;
    if (!target || !el) return;
    const distance = camera.position.distanceTo(target);
    const fov = THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov);
    const pxPerMeter = size.height / (2 * Math.tan(fov / 2) * distance);
    const zoom = pxPerMeter < 22 ? "far" : "near";
    if (zoom !== last.current) {
      last.current = zoom;
      el.dataset.zoom = zoom;
    }
  });
  return null;
}

function QueueZone({
  layout,
  count,
  portrait,
  overlay,
}: {
  layout: QueueLayout;
  count: number;
  portrait: boolean;
  overlay: RefObject<HTMLElement>;
}) {
  const dragging = useGame((s) => s.draggingId !== null);
  // hàng rào phân cách sảnh chờ với dãy sân: phía sau (và phía trước nếu sảnh kẹp giữa hai dãy sân)
  const fenceZ = layout.depth / 2 + (portrait ? 2.2 : 1.4);
  const fences = layout.between ? [-fenceZ, fenceZ] : [-fenceZ];
  return (
    <group position={[0, 0, layout.centerZ]}>
      {/* sảnh chờ là một bục riêng, viền trắng dày, nổi hẳn lên khỏi sàn đấu */}
      <mesh position-y={-0.05}>
        <boxGeometry args={[layout.width + 1.2, 0.14, layout.depth + 1.2]} />
        <meshBasicMaterial color={dragging ? "#ffe14d" : "#ffffff"} />
      </mesh>
      <mesh position-y={-0.045} receiveShadow>
        <boxGeometry args={[layout.width + 0.6, 0.14, layout.depth + 0.6]} />
        <meshToonMaterial color="#8b5cf6" />
      </mesh>
      <mesh position-y={-0.04} receiveShadow>
        <boxGeometry args={[layout.width, 0.14, layout.depth]} />
        <meshToonMaterial color="#a78bfa" />
      </mesh>
      {fences.map((fz) => (
        <Fence key={fz} z={fz} width={layout.width + 1.2} />
      ))}
      <Html
        portal={overlay}
        // màn hình dọc: đặt biển ở mép trước để không tràn ra ngoài màn hình
        position={portrait ? [0, 0.2, layout.depth / 2 + 1.2] : [-layout.width / 2 - 1, 0.3, 0]}
        center
        zIndexRange={[20, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div className="queue-sign font-display whitespace-nowrap rounded-xl border-2 border-white bg-violet-600 px-3 py-1 text-center text-sm font-extrabold leading-tight text-white shadow-lg">
          🪑 SẢNH CHỜ
          <div className="text-[11px] font-bold text-violet-100">{count} người đang chờ</div>
        </div>
      </Html>
    </group>
  );
}

/** Hàng rào thấp kiểu dây chắn (cột + dây sọc) — ranh giới giữa sảnh chờ và khu sân. */
function Fence({ z, width }: { z: number; width: number }) {
  const posts = Math.max(2, Math.round(width / 3) + 1);
  const step = width / (posts - 1);
  return (
    <group position={[0, 0, z]}>
      {Array.from({ length: posts }, (_, i) => (
        <mesh key={i} position={[-width / 2 + i * step, 0.45, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.12, 0.9, 8]} />
          <meshToonMaterial color="#f8fafc" />
        </mesh>
      ))}
      <mesh position={[0, 0.78, 0]}>
        <boxGeometry args={[width, 0.12, 0.06]} />
        <meshToonMaterial color="#ef4444" />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[width, 0.08, 0.05]} />
        <meshToonMaterial color="#facc15" />
      </mesh>
    </group>
  );
}

function Arena({ bounds }: { bounds: ArenaBounds }) {
  const width = bounds.halfW * 2 + 1;
  const depth = bounds.maxZ - bounds.minZ;
  return (
    <group>
      {/* sàn gỗ nhà thi đấu, viền trắng */}
      <mesh position={[0, -0.2, (bounds.minZ + bounds.maxZ) / 2]}>
        <boxGeometry args={[width + 1, 0.2, depth + 1]} />
        <meshToonMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, -0.17, (bounds.minZ + bounds.maxZ) / 2]} receiveShadow>
        <boxGeometry args={[width, 0.2, depth]} />
        <meshToonMaterial color="#ffd58a" />
      </mesh>
    </group>
  );
}

interface SceneProps {
  overlay: RefObject<HTMLElement>;
  fitKey: number;
  insets: HudInsets;
  /** Màn hình nhỏ (điện thoại): một ngón di chuyển camera, hai ngón xoay / phóng to; nhãn sân so le. */
  compact: boolean;
}

export default function Scene({ overlay, fitKey, insets, compact }: SceneProps) {
  const courts = useGame((s) => s.courts);
  const members = useGame((s) => s.members);
  const queue = useGame((s) => s.queue);
  const clearSelection = useGame((s) => s.clearSelection);
  const portrait = useGame((s) => s.portrait);
  // hàng chờ đứng theo thứ tự ưu tiên vào sân (ít trận trước, chờ lâu trước)
  const { order, moods } = useQueueView();

  const total = courts.length;
  const layout = useMemo(() => queueLayout(queue.length, total, portrait), [queue.length, total, portrait]);
  const bounds = useMemo(() => arenaBounds(total, queue.length, portrait), [total, queue.length, portrait]);

  // một dãy ngang đông sân (hoặc màn hình nhỏ): nhãn sân lẻ lùi ra sau để khỏi đè lên sân bên cạnh
  const staggerLabels = !portrait && total >= (compact ? 4 : 7);

  const placements = useMemo(() => {
    const byId = new Map(members.map((m) => [m.id, m]));
    const list: Placement[] = [];
    courts.forEach((court, ci) => {
      const center = courtCenter(ci, total, portrait);
      court.slots.forEach((id, si) => {
        const member = id ? byId.get(id) : undefined;
        if (!member) return;
        list.push({
          member,
          x: center.x + SLOT_LOCAL[si][0],
          z: center.z + SLOT_LOCAL[si][1],
          // đội A (phía xa) quay mặt về lưới = về phía camera; đội B quay ngược lại
          facing: si < 2 ? 0 : Math.PI,
          mode: court.status === "playing" ? "playing" : "court",
        });
      });
    });
    order.forEach((id, qi) => {
      const member = byId.get(id);
      if (!member) return;
      const [x, z] = layout.position(qi);
      list.push({ member, x, z, facing: 0, mode: "queue" });
    });
    return list;
  }, [courts, members, order, total, layout, portrait]);

  const night = useGame((s) => s.theme === "dark");

  return (
    <Canvas
      flat
      shadows="percentage"
      // điện thoại: độ phân giải tối đa 1.5x + bóng nhỏ hơn — mượt hơn, đỡ nóng máy, đỡ hao pin
      dpr={compact ? [1, 1.5] : [1, 2]}
      camera={{ position: [0, 30, 36], fov: 42, near: 0.5, far: 600 }}
      onPointerMissed={() => clearSelection()}
    >

      {/* trong nhà thi đấu: ban ngày sáng sủa, ban đêm tối ấm */}
      <fog attach="fog" args={[night ? "#111827" : "#eef2f7", night ? 140 : 180, night ? 420 : 520]} />

      {/* ban đêm: trời tối, đèn pha sân sáng ấm từ trên xuống */}
      <ambientLight intensity={night ? 0.32 : 1.15} color={night ? "#b9c8ff" : "#ffffff"} />
      <hemisphereLight args={[night ? "#8fa8ff" : "#ffffff", night ? "#2a2440" : "#ffe6b0", night ? 0.3 : 0.7]} />
      {night && <pointLight position={[0, 26, 0]} intensity={45} distance={0} decay={1.2} color="#ffe9c4" />}
      <directionalLight
        position={[22, 40, 26]}
        intensity={night ? 0.55 : 1.5}
        color={night ? "#dfe6ff" : "#ffffff"}
        castShadow
        shadow-mapSize={compact ? [1024, 1024] : [2048, 2048]}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-camera-far={160}
        shadow-bias={-0.0005}
      />

      <Scenery bounds={bounds} sides={!portrait} />
      <Arena bounds={bounds} />
      <Crowd bounds={bounds} sides={!portrait} />

      {courts.map((court, i) => {
        const center = courtCenter(i, total, portrait);
        return (
          <Court3D
            key={court.id}
            court={court}
            x={center.x}
            z={center.z}
            front={center.front}
            labelBack={staggerLabels && i % 2 === 1}
            overlay={overlay}
          />
        );
      })}

      <QueueZone layout={layout} count={queue.length} portrait={portrait} overlay={overlay} />

      {placements.map((p) => (
        <Player3D
          key={p.member.id}
          member={p.member}
          x={p.x}
          z={p.z}
          facing={p.facing}
          mode={p.mode}
          anger={p.mode === "queue" ? (moods.get(p.member.id)?.level ?? 0) : 0}
          waitMinutes={p.mode === "queue" ? Math.floor((moods.get(p.member.id)?.waitedMs ?? 0) / 60_000) : undefined}
          overlay={overlay}
        />
      ))}

      <DragController />
      <OrbitControls
        makeDefault
        minDistance={10}
        maxDistance={260}
        maxPolarAngle={Math.PI / 2.25}
        enableDamping
        dampingFactor={0.12}
        touches={
          compact
            ? { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }
            : { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }
        }
      />
      <CameraRig bounds={bounds} fitKey={fitKey} insets={insets} compact={compact} />
      <ZoomWatcher overlay={overlay} />
    </Canvas>
  );
}
