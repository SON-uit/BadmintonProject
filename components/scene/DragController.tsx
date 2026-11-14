"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";
import { drag } from "@/lib/drag";
import { courtCenter, courtIndexAt } from "@/lib/layout";
import { useGame } from "@/lib/store";

const DRAG_THRESHOLD_PX = 5;

/**
 * Kéo-thả thành viên: nghe pointer trên window (nên kéo được cả từ danh sách HUD lẫn nhân vật 3D),
 * chiếu con trỏ xuống mặt sàn y = 0, khi thả thì xác định sân/ô gần nhất.
 */
export default function DragController() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
  const draggingId = useGame((s) => s.draggingId);

  // Khóa xoay camera trong lúc đang kéo người.
  useEffect(() => {
    if (controls) controls.enabled = !draggingId;
    document.body.style.cursor = draggingId ? "grabbing" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [draggingId, controls]);

  useEffect(() => {
    const raycaster = new THREE.Raycaster();
    const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();

    const project = (e: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      return raycaster.ray.intersectPlane(floor, hit);
    };

    const onMove = (e: PointerEvent) => {
      const s = useGame.getState();
      if (!s.draggingId) return;
      if (Number.isNaN(drag.startX)) {
        drag.startX = e.clientX;
        drag.startY = e.clientY;
      }
      if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD_PX) return;
      const p = project(e);
      if (!p) return;
      drag.pos.copy(p);
      drag.moved = true;
      const index = courtIndexAt(p.x, p.z, s.courts.length, s.portrait);
      const hoverId = index >= 0 ? s.courts[index].id : null;
      if (hoverId !== s.hoverCourtId) s.setHoverCourt(hoverId);
    };

    const onUp = (e: PointerEvent) => {
      const s = useGame.getState();
      const memberId = s.draggingId;
      if (!memberId) return;
      const p = drag.moved ? project(e) : null;
      // bấm mà không kéo = chọn / bỏ chọn người đó
      if (!drag.moved) s.toggleSelect(memberId);
      if (p) {
        const index = courtIndexAt(p.x, p.z, s.courts.length, s.portrait);
        if (index >= 0) {
          const { x: cx, z: cz } = courtCenter(index, s.courts.length, s.portrait);
          s.placeMember(memberId, s.courts[index].id, { x: p.x - cx, z: p.z - cz });
        } else {
          s.moveToQueue(memberId);
        }
      }
      s.endDrag();
    };

    const onCancel = () => {
      if (useGame.getState().draggingId) useGame.getState().endDrag();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("blur", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("blur", onCancel);
    };
  }, [camera, gl]);

  return null;
}
