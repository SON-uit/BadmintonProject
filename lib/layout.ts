/** Bố cục thế giới 3D (đơn vị: mét). Sân cầu lông đôi chuẩn 13.4 × 6.1. */
export const COURT_W = 6.1;
export const COURT_L = 13.4;
/** Thảm quanh sân (mét). */
export const COURT_MARGIN = 1.2;

/**
 * Ba kiểu xếp sân:
 * - Màn hình ngang, tới 8 sân: một dãy ngang, hàng chờ ngay phía trước (sân to nhất, sân nào cũng sát hàng chờ).
 * - Màn hình ngang, từ 9 sân: hai dãy đối diện nhau, hàng chờ nằm giữa.
 * - Màn hình dọc (điện thoại): lưới 2 cột xếp lùi dần ra sau; hàng chờ một hàng phía trước,
 *   đông hơn thì tràn lên hai bên dãy sân thành chữ U.
 */
export const SINGLE_ROW_MAX = 8;
const PORTRAIT_PER_ROW = 2;
// khoảng hở giữa hai sân cạnh nhau — vừa đủ cho viền sân, để sân hiện to nhất (nhất là điện thoại dọc 2 cột)
const GAP_X = 3;
const COURT_PITCH = COURT_W + GAP_X;
/** Khoảng cách tâm giữa hai hàng sân ở màn hình dọc (chừa chỗ cho nhãn sân). */
const PORTRAIT_ROW_PITCH = COURT_L + COURT_MARGIN * 2 + 3.4;

/** Khoảng cách giữa hai người chờ — đủ rộng để nhãn tên không đè lên nhau. */
const QUEUE_DX = 4.2;
const QUEUE_DZ = 2.6;
/** Khoảng trống giữa mép sân và hàng người chờ đầu tiên (giữa có hàng rào phân cách sảnh chờ). */
const QUEUE_GAP = 4.2;
/** Màn hình dọc: sảnh chờ lùi hẳn ra trước, tách biệt rõ khỏi dãy sân. */
const QUEUE_GAP_PORTRAIT = 5.5;
const queueZ0 = (portrait: boolean) => COURT_L / 2 + COURT_MARGIN + (portrait ? QUEUE_GAP_PORTRAIT : QUEUE_GAP);
const QUEUE_Z0 = queueZ0(false);
/** Số hàng tối đa của hàng chờ khi nó bị kẹp giữa hai dãy sân. */
const QUEUE_ROWS_BETWEEN = 3;
const FRONT_ROW_Z = QUEUE_Z0 + (QUEUE_ROWS_BETWEEN - 1) * QUEUE_DZ + QUEUE_GAP + COURT_MARGIN + COURT_L / 2;

const isTwoRows = (total: number, portrait: boolean) => !portrait && total > SINGLE_ROW_MAX;
/** Số sân ở dãy sát hàng chờ (quyết định bề ngang sàn đấu). */
function widestRow(total: number, portrait: boolean) {
  if (portrait) return Math.max(1, Math.min(total, PORTRAIT_PER_ROW));
  return isTwoRows(total, portrait) ? Math.ceil(total / 2) : Math.max(total, 1);
}

export interface CourtPlace {
  x: number;
  z: number;
  /** Dãy trước (gần camera) — nhãn sân đặt ở mép gần để không che hàng chờ. */
  front: boolean;
}

/** Vị trí tâm sân thứ i. */
export function courtCenter(index: number, total: number, portrait = false): CourtPlace {
  if (portrait) {
    const row = Math.floor(index / PORTRAIT_PER_ROW);
    const inRow = Math.min(PORTRAIT_PER_ROW, total - row * PORTRAIT_PER_ROW);
    const col = index % PORTRAIT_PER_ROW;
    return { x: (col - (inRow - 1) / 2) * COURT_PITCH, z: -row * PORTRAIT_ROW_PITCH, front: false };
  }
  const back = widestRow(total, false);
  const front = index >= back;
  const inRow = front ? total - back : back;
  const col = front ? index - back : index;
  return { x: (col - (inRow - 1) / 2) * COURT_PITCH, z: front ? FRONT_ROW_Z : 0, front };
}

/** Vị trí 4 người trong sân, tính theo tâm sân: 0,1 = đội A (phía xa) · 2,3 = đội B (phía gần). */
export const SLOT_LOCAL: [number, number][] = [
  [-1.5, -3.9],
  [1.5, -2.9],
  [-1.5, 2.9],
  [1.5, 3.9],
];

/**
 * Sân nào chứa điểm (x, z)? Trả về -1 nếu không có.
 * `slack` (mét): thả hơi lệch ra ngoài mép vẫn tính là sân gần nhất — dễ thả khi camera ở xa.
 */
export function courtIndexAt(x: number, z: number, total: number, portrait = false, slack = 0): number {
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < total; i++) {
    const c = courtCenter(i, total, portrait);
    const dx = Math.max(0, Math.abs(x - c.x) - (COURT_W / 2 + COURT_MARGIN));
    const dz = Math.max(0, Math.abs(z - c.z) - (COURT_L / 2 + COURT_MARGIN));
    if (dx === 0 && dz === 0) return i;
    const d = Math.hypot(dx, dz);
    if (d <= slack && d < bestDist) {
      best = i;
      bestDist = d;
    }
  }
  return best;
}

/** Cánh chữ U (màn hình dọc): hai dải bục đối xứng chạy dọc hai bên dãy sân. */
export interface QueueArms {
  /** Tâm cánh phải (cánh trái ở -x). */
  x: number;
  width: number;
  /** Mép sau (phía xa camera) và mép trước (nối vào bục đáy). */
  zBack: number;
  zFront: number;
}

export interface QueueLayout {
  /** Bề ngang bục đáy (khi có cánh: trải hết tới mép ngoài hai cánh). */
  width: number;
  depth: number;
  centerZ: number;
  /** Sảnh chờ kẹp giữa hai dãy sân (cần hàng rào ở cả hai phía). */
  between: boolean;
  /** Màn hình dọc, đông người: sảnh chữ U ôm quanh khu sân. */
  arms: QueueArms | null;
  position: (index: number) => [number, number];
}

/** Bề ngang mỗi cánh chữ U và khoảng hở giữa thảm sân với cánh (chỗ hàng rào). */
const ARM_W = 3.2;
const ARM_GAP = 1;

/**
 * Màn hình dọc: một hàng ở đáy (trước dãy sân) trước; đông hơn thì tràn lên hai cánh
 * dọc hai bên dãy sân thành chữ U — sảnh không phình to xuống dưới, sân vẫn nằm giữa khung.
 * Hai cánh cũng đầy thì mới thêm hàng ở đáy.
 */
function portraitQueueLayout(count: number, totalCourts: number): QueueLayout {
  const z0 = queueZ0(true);
  const baseWidth = Math.max(widestRow(totalCourts, true) * COURT_PITCH - 2, 14);
  const baseCols = Math.max(1, Math.floor((baseWidth - 1.2) / QUEUE_DX));
  if (count <= baseCols) {
    return {
      width: baseWidth,
      depth: QUEUE_DZ + 1,
      centerZ: z0,
      between: false,
      arms: null,
      position: (index) => [(index - (count - 1) / 2) * QUEUE_DX, z0],
    };
  }

  // mép ngoài thảm của dãy sân rộng nhất → cánh nằm ngay bên ngoài, cách một hàng rào
  const courtEdge = (widestRow(totalCourts, true) * COURT_PITCH - GAP_X) / 2 + COURT_MARGIN;
  const armX = courtEdge + ARM_GAP + ARM_W / 2;
  const width = 2 * (armX + ARM_W / 2);
  const cols = Math.max(1, Math.floor((width - 1.2) / QUEUE_DX));
  const dx = Math.min(QUEUE_DX, (width - 1.2) / cols);
  const courtRows = Math.max(1, Math.ceil(totalCourts / PORTRAIT_PER_ROW));
  const backZ = -(courtRows - 1) * PORTRAIT_ROW_PITCH - COURT_L / 2;
  // người trên cánh: từ sát hàng đáy lùi dần ra sau tới hết dãy sân
  const armFirstZ = z0 - QUEUE_DZ;
  const perArm = Math.max(1, Math.floor((armFirstZ - backZ) / QUEUE_DZ) + 1);
  const armCap = perArm * 2;
  // phần còn lại (cả hai cánh đã đầy) xếp thêm hàng ở đáy, phía trước hàng đầu
  const extra = Math.max(0, count - cols - armCap);
  const rows = 1 + Math.ceil(extra / cols);
  const depth = rows * QUEUE_DZ + 1;
  const centerZ = z0 + ((rows - 1) * QUEUE_DZ) / 2;

  const rowPos = (row: number, inRow: number, col: number): [number, number] => {
    const stagger = row % 2 === 1 ? dx / 4 : 0;
    return [(col - (inRow - 1) / 2) * dx + stagger, z0 + row * QUEUE_DZ];
  };
  return {
    width,
    depth,
    centerZ,
    between: false,
    arms: { x: armX, width: ARM_W, zBack: backZ - 0.6, zFront: centerZ - depth / 2 },
    position: (index) => {
      if (index < cols) return rowPos(0, cols, index);
      const a = index - cols;
      if (a < armCap) {
        // xen kẽ trái / phải để hai cánh dài đều nhau
        const side = a % 2 === 0 ? -1 : 1;
        return [side * armX, armFirstZ - Math.floor(a / 2) * QUEUE_DZ];
      }
      const e = a - armCap;
      const row = 1 + Math.floor(e / cols);
      return rowPos(row, Math.min(cols, extra - (row - 1) * cols), e % cols);
    },
  };
}

/** Thảm hàng chờ: rộng theo dãy sân, tự thêm cột để không tràn vào dãy sân phía trước. */
export function queueLayout(count: number, totalCourts: number, portrait = false): QueueLayout {
  // chưa có sân nào thì không có gì để ôm chữ U: xếp lưới như thường
  if (portrait && totalCourts > 0) return portraitQueueLayout(count, totalCourts);
  const twoRows = isTwoRows(totalCourts, portrait);
  const width = Math.max(widestRow(totalCourts, portrait) * COURT_PITCH - 2, portrait ? 14 : 20);
  let cols = Math.max(1, Math.floor((width - 1.2) / QUEUE_DX));
  // kẹp giữa hai dãy sân thì không thêm hàng được nữa: thêm cột, đứng sát nhau hơn
  if (twoRows) cols = Math.max(cols, Math.ceil(count / QUEUE_ROWS_BETWEEN));
  const dx = Math.min(QUEUE_DX, (width - 1.2) / cols);
  const rows = Math.max(1, Math.ceil(count / cols));
  const shownRows = twoRows ? QUEUE_ROWS_BETWEEN : rows;
  const z0 = queueZ0(portrait);
  const firstZ = z0 + ((shownRows - rows) * QUEUE_DZ) / 2;
  return {
    width,
    depth: shownRows * QUEUE_DZ + 1,
    centerZ: z0 + ((shownRows - 1) * QUEUE_DZ) / 2,
    between: twoRows,
    arms: null,
    position: (index) => {
      const row = Math.floor(index / cols);
      // mỗi hàng được căn giữa theo số người thực tế trong hàng đó
      const inRow = Math.min(cols, count - row * cols);
      // hàng lẻ đứng so le nửa bước để nhãn tên hai hàng không che nhau
      const stagger = rows > 1 ? (row % 2 === 1 ? dx / 4 : -dx / 4) : 0;
      return [((index % cols) - (inRow - 1) / 2) * dx + stagger, firstZ + row * QUEUE_DZ];
    },
  };
}

export interface ArenaBounds {
  halfW: number;
  minZ: number;
  maxZ: number;
}

/** Phạm vi sàn thi đấu (bao hết sân và hàng chờ) để dựng sàn, khán đài và căn camera. */
export function arenaBounds(totalCourts: number, queueCount: number, portrait = false): ArenaBounds {
  const queue = queueLayout(queueCount, totalCourts, portrait);
  const side = portrait ? 0.6 : 1.5;
  const halfW = Math.max((widestRow(totalCourts, portrait) * COURT_PITCH) / 2 + side, queue.width / 2 + side + 0.5);
  const courtRows = portrait ? Math.max(1, Math.ceil(totalCourts / PORTRAIT_PER_ROW)) : 1;
  const minZ = -(courtRows - 1) * PORTRAIT_ROW_PITCH - COURT_L / 2 - COURT_MARGIN - 4.5;
  const maxZ = isTwoRows(totalCourts, portrait)
    ? FRONT_ROW_Z + COURT_L / 2 + COURT_MARGIN + 4.5
    : queue.centerZ + queue.depth / 2 + (portrait ? 2.5 : 3.5);
  return { halfW, minZ, maxZ };
}
