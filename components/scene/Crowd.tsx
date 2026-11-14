"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CROWD_HAIR, CROWD_SHIRTS, CROWD_SKIN, seeded } from "@/lib/appearance";
import type { ArenaBounds } from "@/lib/layout";

export const TIERS = 3;
export const TIER_DEPTH = 1.2;
const TIER_HEIGHT = 0.6;
const SEAT_PITCH = 1.15;

interface StandDef {
  x: number;
  z: number;
  /** Khán đài quay mặt về hướng +Z cục bộ; ghế trải theo trục X cục bộ. */
  rotY: number;
  length: number;
  color: string;
}

interface Spectator {
  x: number;
  y: number;
  z: number;
  rotY: number;
  phase: number;
  speed: number;
  scale: number;
  armsUp: boolean;
  shirt: string;
  skin: string;
  hair: string;
}

function buildStands(b: ArenaBounds, sides: boolean): StandDef[] {
  const back: StandDef = { x: 0, z: b.minZ, rotY: 0, length: b.halfW * 2 + 2, color: "#ff5a3c" };
  if (!sides) return [back];
  const sideLength = b.maxZ - b.minZ - 4;
  const sideZ = (b.minZ + b.maxZ) / 2 - 1;
  return [
    back,
    { x: -b.halfW - 1.5, z: sideZ, rotY: Math.PI / 2, length: sideLength, color: "#18b6f6" },
    { x: b.halfW + 1.5, z: sideZ, rotY: -Math.PI / 2, length: sideLength, color: "#ffc21a" },
  ];
}

function buildSpectators(stands: StandDef[]): Spectator[] {
  const list: Spectator[] = [];
  stands.forEach((stand, si) => {
    const rnd = seeded(1000 + si * 77);
    const seats = Math.max(1, Math.floor((stand.length - 1) / SEAT_PITCH));
    const cos = Math.cos(stand.rotY);
    const sin = Math.sin(stand.rotY);
    for (let tier = 0; tier < TIERS; tier++) {
      for (let seat = 0; seat < seats; seat++) {
        if (rnd() < 0.12) continue; // vài ghế trống cho tự nhiên
        const lx = (seat - (seats - 1) / 2) * SEAT_PITCH + (rnd() - 0.5) * 0.3;
        const lz = -(tier * TIER_DEPTH + TIER_DEPTH / 2);
        list.push({
          x: stand.x + lx * cos + lz * sin,
          y: TIER_HEIGHT * (tier + 1),
          z: stand.z - lx * sin + lz * cos,
          rotY: stand.rotY,
          // pha lệch theo vị trí ghế tạo hiệu ứng "sóng người"
          phase: lx * 0.32 + tier * 0.5 + rnd() * 0.8,
          speed: 3.2 + rnd() * 1.8,
          scale: 0.9 + rnd() * 0.25,
          armsUp: rnd() < 0.7,
          shirt: CROWD_SHIRTS[Math.floor(rnd() * CROWD_SHIRTS.length)],
          skin: CROWD_SKIN[Math.floor(rnd() * CROWD_SKIN.length)],
          hair: CROWD_HAIR[Math.floor(rnd() * CROWD_HAIR.length)],
        });
      }
    }
  });
  return list;
}

function Stand({ stand }: { stand: StandDef }) {
  return (
    <group position={[stand.x, 0, stand.z]} rotation-y={stand.rotY}>
      {Array.from({ length: TIERS }, (_, tier) => {
        const h = TIER_HEIGHT * (tier + 1);
        return (
          <mesh key={tier} position={[0, h / 2, -(tier * TIER_DEPTH + TIER_DEPTH / 2)]} receiveShadow castShadow>
            <boxGeometry args={[stand.length, h, TIER_DEPTH]} />
            <meshToonMaterial color={tier % 2 === 0 ? stand.color : "#ffffff"} />
          </mesh>
        );
      })}
      {/* bảng quảng cáo phía trước khán đài */}
      <mesh position={[0, 0.5, 0.12]} castShadow>
        <boxGeometry args={[stand.length, 1, 0.14]} />
        <meshToonMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, 0.5, 0.2]}>
        <boxGeometry args={[stand.length - 0.4, 0.34, 0.02]} />
        <meshBasicMaterial color={stand.color} />
      </mesh>
    </group>
  );
}

/** Toàn bộ khán giả vẽ bằng 5 InstancedMesh (thân, đầu, tóc, 2 tay) — nhảy và vẫy tay cổ vũ. */
function Spectators({ spectators }: { spectators: Spectator[] }) {
  const body = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.InstancedMesh>(null);
  const hair = useRef<THREE.InstancedMesh>(null);
  const armL = useRef<THREE.InstancedMesh>(null);
  const armR = useRef<THREE.InstancedMesh>(null);
  const count = spectators.length;

  // một "bộ xương" dùng chung để tính ma trận cho từng người
  const rig = useMemo(() => {
    const root = new THREE.Object3D();
    const bodyNode = new THREE.Object3D();
    bodyNode.position.y = 0.48;
    const headNode = new THREE.Object3D();
    headNode.position.y = 1.02;
    const hairNode = new THREE.Object3D();
    hairNode.position.set(0, 1.05, -0.02);
    const shoulderL = new THREE.Object3D();
    shoulderL.position.set(-0.27, 0.72, 0);
    const shoulderR = new THREE.Object3D();
    shoulderR.position.set(0.27, 0.72, 0);
    const armLNode = new THREE.Object3D();
    armLNode.position.y = 0.22;
    const armRNode = new THREE.Object3D();
    armRNode.position.y = 0.22;
    shoulderL.add(armLNode);
    shoulderR.add(armRNode);
    root.add(bodyNode, headNode, hairNode, shoulderL, shoulderR);
    return { root, bodyNode, headNode, hairNode, shoulderL, shoulderR, armLNode, armRNode };
  }, []);

  useLayoutEffect(() => {
    const color = new THREE.Color();
    spectators.forEach((s, i) => {
      body.current?.setColorAt(i, color.set(s.shirt));
      head.current?.setColorAt(i, color.set(s.skin));
      hair.current?.setColorAt(i, color.set(s.hair));
      armL.current?.setColorAt(i, color.set(s.skin));
      armR.current?.setColorAt(i, color.set(s.skin));
    });
    for (const ref of [body, head, hair, armL, armR]) {
      if (ref.current?.instanceColor) ref.current.instanceColor.needsUpdate = true;
    }
  }, [spectators]);

  useFrame((state) => {
    if (!body.current || !head.current || !hair.current || !armL.current || !armR.current) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const s = spectators[i];
      const beat = Math.sin(t * s.speed + s.phase);
      const jump = s.armsUp ? Math.max(0, beat) ** 2 * 0.45 : Math.max(0, beat) * 0.08;
      rig.root.position.set(s.x, s.y + jump, s.z);
      rig.root.rotation.y = s.rotY + Math.sin(t * 1.1 + s.phase) * 0.18;
      rig.root.scale.setScalar(s.scale);
      const wave = Math.sin(t * s.speed * 1.5 + s.phase) * 0.35;
      // tay giơ cao vẫy, hoặc buông xuôi vỗ nhẹ
      rig.shoulderL.rotation.z = s.armsUp ? 0.45 + wave : 2.75;
      rig.shoulderR.rotation.z = s.armsUp ? -0.45 + wave : -2.75;
      rig.root.updateMatrixWorld(true);
      body.current.setMatrixAt(i, rig.bodyNode.matrixWorld);
      head.current.setMatrixAt(i, rig.headNode.matrixWorld);
      hair.current.setMatrixAt(i, rig.hairNode.matrixWorld);
      armL.current.setMatrixAt(i, rig.armLNode.matrixWorld);
      armR.current.setMatrixAt(i, rig.armRNode.matrixWorld);
    }
    body.current.instanceMatrix.needsUpdate = true;
    head.current.instanceMatrix.needsUpdate = true;
    hair.current.instanceMatrix.needsUpdate = true;
    armL.current.instanceMatrix.needsUpdate = true;
    armR.current.instanceMatrix.needsUpdate = true;
  });

  if (count === 0) return null;
  // key theo số lượng: đổi số khán giả thì dựng lại InstancedMesh với sức chứa mới
  return (
    <group key={count}>
      <instancedMesh ref={body} args={[undefined, undefined, count]} frustumCulled={false} castShadow>
        <capsuleGeometry args={[0.25, 0.42, 4, 10]} />
        <meshToonMaterial />
      </instancedMesh>
      <instancedMesh ref={head} args={[undefined, undefined, count]} frustumCulled={false}>
        <sphereGeometry args={[0.21, 14, 10]} />
        <meshToonMaterial />
      </instancedMesh>
      <instancedMesh ref={hair} args={[undefined, undefined, count]} frustumCulled={false}>
        <sphereGeometry args={[0.225, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshToonMaterial />
      </instancedMesh>
      <instancedMesh ref={armL} args={[undefined, undefined, count]} frustumCulled={false}>
        <capsuleGeometry args={[0.06, 0.3, 3, 6]} />
        <meshToonMaterial />
      </instancedMesh>
      <instancedMesh ref={armR} args={[undefined, undefined, count]} frustumCulled={false}>
        <capsuleGeometry args={[0.06, 0.3, 3, 6]} />
        <meshToonMaterial />
      </instancedMesh>
    </group>
  );
}

const BALLOON_COLORS = ["#ff4d5a", "#ffc800", "#2f86ff", "#06c98b", "#ff2e93", "#8b46ff"];

function Balloons({ x, z, seed }: { x: number; z: number; seed: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime + seed;
    ref.current.position.y = 4.6 + Math.sin(t * 1.2) * 0.25;
    ref.current.rotation.z = Math.sin(t * 0.8) * 0.08;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={2.2}>
        <cylinderGeometry args={[0.02, 0.02, 4.4, 4]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <group ref={ref}>
        {[-0.55, 0, 0.55].map((dx, i) => (
          <mesh key={i} position={[dx, i === 1 ? 0.55 : 0, 0]} scale={[1, 1.2, 1]}>
            <sphereGeometry args={[0.55, 16, 14]} />
            <meshToonMaterial color={BALLOON_COLORS[(seed + i) % BALLOON_COLORS.length]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** `sides`: có dựng khán đài hai bên không (màn hình dọc bỏ đi để sân được to). */
export default function Crowd({ bounds, sides }: { bounds: ArenaBounds; sides: boolean }) {
  const { halfW, minZ, maxZ } = bounds;
  const { stands, spectators } = useMemo(() => {
    const stands = buildStands({ halfW, minZ, maxZ }, sides);
    return { stands, spectators: buildSpectators(stands) };
  }, [halfW, minZ, maxZ, sides]);

  return (
    <group>
      {stands.map((stand, i) => (
        <Stand key={i} stand={stand} />
      ))}
      <Spectators spectators={spectators} />
      <Balloons x={-halfW - 2} z={minZ - 1} seed={0} />
      <Balloons x={halfW + 2} z={minZ - 1} seed={3} />
      {sides && <Balloons x={-halfW - 2} z={maxZ - 2.5} seed={1} />}
      {sides && <Balloons x={halfW + 2} z={maxZ - 2.5} seed={4} />}
    </group>
  );
}
