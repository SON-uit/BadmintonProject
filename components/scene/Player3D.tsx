"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { appearanceOf, type Appearance } from "@/lib/appearance";
import { drag } from "@/lib/drag";
import { useGame } from "@/lib/store";
import { GENDER_COLOR, levelInfo, levelLabel, type Member } from "@/lib/types";

export type PlayerMode = "queue" | "court" | "playing";

interface Props {
  member: Member;
  /** Vị trí đích trên mặt sàn. */
  x: number;
  z: number;
  /** Góc quay quanh trục y khi đứng yên (0 = nhìn về phía camera). */
  facing: number;
  mode: PlayerMode;
  /** 0 = bình thường · 1 = bực (😤) · 2 = giận dữ (😡) — chỉ áp dụng cho người ở hàng chờ. */
  anger: 0 | 1 | 2;
  /** Số phút đã chờ ở hàng chờ (bỏ trống nếu không ở hàng chờ). */
  waitMinutes?: number;
  overlay: RefObject<HTMLElement>;
}

const tmp = new THREE.Vector3();
const HEAD_Y = 1.42;

/** Nội suy góc theo đường ngắn nhất. */
function lerpAngle(from: number, to: number, k: number) {
  const diff = ((((to - from) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return from + diff * k;
}

function Hair({ look }: { look: Appearance }) {
  const { hair, hairColor, accent } = look;
  const isCap = hair === "cap";
  return (
    <group>
      {/* phần tóc / mũ ôm đỉnh đầu */}
      <mesh position={[0, 0.03, -0.02]} rotation-x={-0.25} castShadow>
        <sphereGeometry args={[0.285, 22, 12, 0, Math.PI * 2, 0, Math.PI * (isCap ? 0.45 : 0.42)]} />
        <meshToonMaterial color={isCap ? accent : hairColor} />
      </mesh>
      {isCap && (
        <mesh position={[0, 0.13, 0.26]} rotation-x={0.15} scale={[1, 1, 0.8]}>
          <cylinderGeometry args={[0.2, 0.2, 0.035, 18]} />
          <meshToonMaterial color={accent} />
        </mesh>
      )}
      {hair === "spiky" &&
        [-0.14, -0.05, 0.05, 0.14].map((sx, i) => (
          <mesh key={i} position={[sx, 0.27 - Math.abs(sx) * 0.35, 0.02 - i * 0.03]} rotation-z={-sx * 2.2}>
            <coneGeometry args={[0.07, 0.2, 6]} />
            <meshToonMaterial color={hairColor} />
          </mesh>
        ))}
      {hair === "mohawk" &&
        [0.16, 0.06, -0.05, -0.16].map((sz, i) => (
          <mesh key={i} position={[0, 0.27 - Math.abs(sz) * 0.3, sz]}>
            <boxGeometry args={[0.07, 0.16, 0.11]} />
            <meshToonMaterial color={accent} />
          </mesh>
        ))}
      {hair === "headband" && (
        <mesh position={[0, 0.1, 0]} rotation-x={Math.PI / 2 - 0.22}>
          <torusGeometry args={[0.262, 0.032, 8, 28]} />
          <meshToonMaterial color={accent} />
        </mesh>
      )}
      {hair === "ponytail" && (
        <>
          <mesh position={[0, 0.12, -0.3]}>
            <sphereGeometry args={[0.1, 12, 10]} />
            <meshToonMaterial color={accent} />
          </mesh>
          <mesh position={[0, -0.08, -0.36]} rotation-x={0.35} castShadow>
            <capsuleGeometry args={[0.085, 0.3, 4, 10]} />
            <meshToonMaterial color={hairColor} />
          </mesh>
        </>
      )}
      {hair === "bun" && (
        <mesh position={[0, 0.3, -0.12]} castShadow>
          <sphereGeometry args={[0.14, 14, 12]} />
          <meshToonMaterial color={hairColor} />
        </mesh>
      )}
      {hair === "bob" && (
        <mesh position={[0, -0.06, -0.09]} castShadow>
          <sphereGeometry args={[0.285, 18, 14]} />
          <meshToonMaterial color={hairColor} />
        </mesh>
      )}
      {hair === "twin" &&
        [-1, 1].map((side) => (
          <group key={side}>
            <mesh position={[side * 0.3, 0.02, -0.06]} castShadow>
              <sphereGeometry args={[0.12, 12, 10]} />
              <meshToonMaterial color={hairColor} />
            </mesh>
            <mesh position={[side * 0.25, 0.1, -0.04]}>
              <sphereGeometry args={[0.055, 8, 8]} />
              <meshToonMaterial color={accent} />
            </mesh>
          </group>
        ))}
      {hair === "long" && (
        <mesh position={[0, -0.22, -0.15]} castShadow>
          <capsuleGeometry args={[0.2, 0.3, 4, 12]} />
          <meshToonMaterial color={hairColor} />
        </mesh>
      )}
    </group>
  );
}

function Face({ angry }: { angry: boolean }) {
  return (
    <group>
      {/* lông mày chau lại khi bực */}
      {angry &&
        [-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.095, 0.085, 0.25]} rotation-z={side * -0.55}>
            <boxGeometry args={[0.1, 0.026, 0.02]} />
            <meshBasicMaterial color="#1f2937" />
          </mesh>
        ))}
      {[-0.095, 0.095].map((ex) => (
        <mesh key={ex} position={[ex, 0.02, 0.25]} scale={[1, 1.25, 0.6]}>
          <sphereGeometry args={[0.034, 10, 10]} />
          <meshBasicMaterial color="#1f2937" />
        </mesh>
      ))}
      {[-0.16, 0.16].map((cx) => (
        <mesh key={cx} position={[cx, -0.07, 0.2]} scale={[1, 0.7, 0.4]}>
          <sphereGeometry args={[0.05, 10, 8]} />
          <meshBasicMaterial color="#ff9aa8" />
        </mesh>
      ))}
      {/* miệng cười — lật ngược thành mếu khi bực */}
      <mesh position={[0, angry ? -0.13 : -0.07, 0.252]} rotation-z={angry ? 0 : Math.PI}>
        <torusGeometry args={[0.055, 0.014, 6, 14, Math.PI]} />
        <meshBasicMaterial color="#b4233c" />
      </mesh>
    </group>
  );
}

const RED = new THREE.Color("#ff4b3e");

function Player3D({ member, x, z, facing, mode, anger, waitMinutes, overlay }: Props) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const arm = useRef<THREE.Group>(null);
  const armLeft = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const pulse = useRef<THREE.Mesh>(null);
  const steam = useRef<THREE.Group>(null);
  const hitbox = useRef<THREE.Mesh>(null);
  const placed = useRef(false);
  const [hovered, setHovered] = useState(false);
  const isDragging = useGame((s) => s.draggingId === member.id);
  const selectedOrder = useGame((s) => s.selectedIds.indexOf(member.id));
  const startDrag = useGame((s) => s.startDrag);

  const selected = selectedOrder >= 0;
  const locked = mode === "playing";
  const look = useMemo(() => appearanceOf(member), [member]);
  // càng giận mặt càng đỏ
  const faceColor = useMemo(
    () => (anger ? "#" + new THREE.Color(look.skin).lerp(RED, anger === 2 ? 0.5 : 0.22).getHexString() : look.skin),
    [look.skin, anger],
  );
  const level = levelInfo(member.level);
  const female = member.gender === "female";
  // lệch pha để mỗi người chuyển động khác nhau
  const phase = (member.joinedAt % 1000) / 160;

  useEffect(() => {
    if (!hovered || locked) return;
    document.body.style.cursor = "pointer";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered, locked]);

  useFrame((state, delta) => {
    const g = root.current;
    const b = body.current;
    if (!g || !b) return;
    if (!placed.current) {
      g.position.set(x, 0, z);
      g.rotation.y = facing;
      placed.current = true;
    }
    const lifted = isDragging && drag.moved;
    const dx = x - g.position.x;
    const dz = z - g.position.z;
    const walking = !lifted && Math.hypot(dx, dz) > 0.15;
    if (lifted) {
      tmp.set(drag.pos.x, 1.1, drag.pos.z);
      g.position.lerp(tmp, 1 - Math.exp(-22 * delta));
    } else {
      tmp.set(x, 0, z);
      g.position.lerp(tmp, 1 - Math.exp(-5 * delta));
    }
    // đang chạy thì quay mặt theo hướng chạy
    g.rotation.y = lerpAngle(g.rotation.y, walking ? Math.atan2(dx, dz) : facing, 1 - Math.exp(-10 * delta));

    // camera ở xa: phóng to vùng chạm để ngón tay vẫn bắt được người (tối thiểu ~26px bán kính)
    if (hitbox.current) {
      const cam = state.camera as THREE.PerspectiveCamera;
      const dist = cam.position.distanceTo(g.position);
      const pxPerMeter = state.size.height / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * dist);
      const k = THREE.MathUtils.clamp(26 / (0.85 * pxPerMeter), 1, 1.9);
      hitbox.current.scale.set(k, 1, k);
    }

    const t = state.clock.elapsedTime + phase;
    const playing = mode === "playing";
    // đang bực: giậm chân, rung người; giận dữ: giơ hai tay
    const fuming = anger > 0 && mode === "queue" && !lifted && !walking && !selected;
    const hop = playing ? Math.abs(Math.sin(t * 5)) * 0.22 : selected ? Math.abs(Math.sin(t * 6)) * 0.16 : 0;
    b.position.y = hop + (walking ? Math.abs(Math.sin(t * 14)) * 0.06 : 0);
    b.position.x = playing ? Math.sin(t * 1.6) * 0.55 : fuming ? Math.sin(t * 24) * 0.02 * anger : 0;
    b.rotation.z = lifted ? Math.sin(t * 9) * 0.14 : 0;
    // thở nhẹ khi đứng yên
    b.scale.y = look.scale * (1 + (walking || playing ? 0 : Math.sin(t * 2.2) * 0.012));

    const stride = walking
      ? Math.sin(t * 14) * 0.75
      : playing
        ? Math.sin(t * 10) * 0.3
        : lifted
          ? Math.sin(t * 12) * 0.5
          : fuming
            ? Math.sin(t * (anger === 2 ? 11 : 7)) * 0.4
            : 0;
    if (legL.current) legL.current.rotation.x = stride;
    if (legR.current) legR.current.rotation.x = -stride;
    if (armLeft.current) {
      armLeft.current.rotation.x = walking
        ? -stride * 0.8
        : selected
          ? -2.6 + Math.sin(t * 8) * 0.3
          : fuming && anger === 2
            ? -2.5 + Math.sin(t * 16) * 0.25
            : 0;
    }
    if (arm.current) {
      arm.current.rotation.x = playing
        ? -1.5 + Math.sin(t * 5) * 1.1
        : walking
          ? stride * 0.8 - 0.4
          : fuming && anger === 2
            ? -2.4 + Math.sin(t * 16 + 1) * 0.3
            : -0.9;
    }
    // khói bốc lên từ đầu khi giận dữ
    if (steam.current) {
      steam.current.children.forEach((puff, i) => {
        const k = (t * 0.9 + i * 0.5) % 1;
        puff.position.y = 0.28 + k * 0.5;
        puff.scale.setScalar(0.5 + k * 0.9);
        ((puff as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
      });
    }

    const scale = lifted ? 1.18 : hovered && !locked ? 1.1 : 1;
    g.scale.setScalar(g.scale.x + (scale - g.scale.x) * (1 - Math.exp(-14 * delta)));
    if (pulse.current) {
      const k = (t * 1.4) % 1;
      pulse.current.scale.setScalar(1 + k * 1.3);
      (pulse.current.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - k);
    }
  });

  return (
    <group
      ref={root}
      onPointerDown={(e) => {
        if (locked || e.button !== 0) return;
        e.stopPropagation();
        startDrag(member.id);
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* vùng bấm vô hình, rộng hơn thân người để dễ chạm bằng ngón tay */}
      <mesh ref={hitbox} visible={false} position-y={1.05}>
        <cylinderGeometry args={[0.85, 0.85, 2.3, 8]} />
      </mesh>

      {/* vòng màu trình độ dưới chân */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.04}>
        <ringGeometry args={[0.44, 0.6, 32]} />
        <meshBasicMaterial color={selected ? "#ff2e93" : level.color} />
      </mesh>
      {selected && (
        <mesh ref={pulse} rotation-x={-Math.PI / 2} position-y={0.045}>
          <ringGeometry args={[0.55, 0.68, 32]} />
          <meshBasicMaterial color="#ff2e93" transparent opacity={0.8} />
        </mesh>
      )}

      <group ref={body} scale={look.scale}>
        {/* chân + giày */}
        {[
          { ref: legL, side: -1 },
          { ref: legR, side: 1 },
        ].map(({ ref, side }) => (
          <group key={side} ref={ref} position={[side * 0.11, 0.52, 0]}>
            <mesh position-y={-0.22} castShadow>
              <capsuleGeometry args={[0.075, 0.3, 4, 8]} />
              <meshToonMaterial color={look.skin} />
            </mesh>
            <mesh position={[0, -0.44, 0.045]} castShadow>
              <boxGeometry args={[0.15, 0.1, 0.26]} />
              <meshToonMaterial color={look.shoe} />
            </mesh>
          </group>
        ))}

        {/* quần đùi (nam) / váy (nữ) */}
        <mesh position-y={0.62} castShadow>
          {female ? <cylinderGeometry args={[0.2, 0.34, 0.26, 18]} /> : <cylinderGeometry args={[0.225, 0.24, 0.22, 16]} />}
          <meshToonMaterial color={female ? look.accent : look.bottom} />
        </mesh>

        {/* áo thi đấu có sọc */}
        <mesh position-y={0.92} castShadow>
          <capsuleGeometry args={[0.23, 0.28, 4, 16]} />
          <meshToonMaterial color={look.jersey} />
        </mesh>
        <mesh position-y={0.99}>
          <cylinderGeometry args={[0.236, 0.236, 0.07, 20]} />
          <meshToonMaterial color={look.accent === look.jersey ? "#ffffff" : look.accent} />
        </mesh>

        {/* tay trái */}
        <group ref={armLeft} position={[-0.3, 1.1, 0]} rotation-z={-0.22}>
          <mesh position-y={-0.19} castShadow>
            <capsuleGeometry args={[0.06, 0.26, 4, 8]} />
            <meshToonMaterial color={look.skin} />
          </mesh>
        </group>

        {/* tay phải cầm vợt */}
        <group ref={arm} position={[0.3, 1.1, 0]} rotation-z={0.22}>
          <mesh position-y={-0.19} castShadow>
            <capsuleGeometry args={[0.06, 0.26, 4, 8]} />
            <meshToonMaterial color={look.skin} />
          </mesh>
          <mesh position-y={-0.5}>
            <cylinderGeometry args={[0.024, 0.024, 0.32, 8]} />
            <meshToonMaterial color="#374151" />
          </mesh>
          <mesh position-y={-0.82}>
            <torusGeometry args={[0.17, 0.022, 8, 24]} />
            <meshToonMaterial color={look.accent} />
          </mesh>
          <mesh position-y={-0.82}>
            <circleGeometry args={[0.16, 20]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.35} side={THREE.DoubleSide} />
          </mesh>
        </group>

        {/* đầu */}
        <group position-y={HEAD_Y}>
          <mesh castShadow>
            <sphereGeometry args={[0.27, 24, 18]} />
            <meshToonMaterial color={faceColor} />
          </mesh>
          <Face angry={anger > 0} />
          {anger === 2 && (
            <group ref={steam}>
              {[-0.2, 0.2].map((sx) => (
                <mesh key={sx} position={[sx, 0.3, 0]}>
                  <sphereGeometry args={[0.1, 10, 8]} />
                  <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
                </mesh>
              ))}
            </group>
          )}
          <Hair look={look} />
        </group>
      </group>

      <Html
        portal={overlay}
        position={[0, 1.95 * look.scale + 0.2, 0]}
        center
        zIndexRange={[20, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div
          // nhãn tên cũng là tay cầm: chạm để chọn, kéo để thả vào sân (luôn đủ to dù camera ở xa)
          onPointerDown={(e) => {
            if (locked || e.button !== 0) return;
            if (e.pointerType === "mouse") e.preventDefault();
            e.stopPropagation();
            startDrag(member.id);
          }}
          style={{ pointerEvents: locked ? "none" : "auto", touchAction: "none" }}
          className={`relative flex items-center ${locked ? "" : "cursor-grab"} gap-1 whitespace-nowrap rounded-full border-2 px-1.5 py-px text-[11px] font-bold leading-tight shadow-md compact:px-2 compact:py-0.5 compact:text-xs ${
            isDragging
              ? "border-amber-400 bg-amber-300 text-amber-950"
              : selected
                ? "border-pink-500 bg-pink-500 text-white"
                : anger === 2
                  ? "border-rose-500 bg-rose-50 text-rose-700"
                  : anger === 1
                    ? "border-orange-400 bg-white/95 text-slate-800"
                    : "border-white bg-white/95 text-slate-800"
          }`}
        >
          {anger > 0 && (
            <span
              className={`anger-emote absolute bottom-full left-1/2 mb-0.5 leading-none ${anger === 2 ? "anger-emote-2 text-2xl" : "text-lg"}`}
              role="img"
              aria-label={anger === 2 ? "đang giận dữ" : "đang bực"}
            >
              {anger === 2 ? "😡" : "😤"}
              {anger === 2 && <span className="absolute -right-2.5 -top-1 text-xs">💢</span>}
            </span>
          )}
          {selected ? (
            <span className="grid size-4 place-items-center rounded-full bg-white text-[10px] font-extrabold text-pink-600">
              {selectedOrder + 1}
            </span>
          ) : (
            <span className="size-2 rounded-full" style={{ background: GENDER_COLOR[member.gender] }} />
          )}
          <span>{member.name}</span>
          <span
            className="player-level rounded-full px-1 text-[10px] leading-snug"
            style={{ background: level.color }}
            title={levelLabel(member.level)}
          >
            {level.emoji}
          </span>
          {waitMinutes !== undefined && waitMinutes >= 1 && (
            <span className={`player-level tabular-nums ${anger ? "font-extrabold text-rose-600" : "font-semibold text-slate-500"}`}>
              ⏱{waitMinutes}′
            </span>
          )}
        </div>
      </Html>
    </group>
  );
}

export default memo(Player3D);
