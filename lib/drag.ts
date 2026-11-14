import { Vector3 } from "three";

/**
 * Trạng thái kéo-thả thay đổi theo từng frame nên để ngoài React/zustand
 * (đọc trong useFrame, không gây re-render).
 */
export const drag = {
  /** Điểm con trỏ chiếu xuống mặt sàn (y = 0). */
  pos: new Vector3(),
  /** Con trỏ đã di chuyển đủ xa để tính là kéo (không phải click). */
  moved: false,
  startX: Number.NaN,
  startY: Number.NaN,
};

export function resetDrag() {
  drag.moved = false;
  drag.startX = Number.NaN;
  drag.startY = Number.NaN;
}
