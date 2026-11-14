"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_BILL, type BillSettings } from "./billing";
import { resetDrag } from "./drag";
import { SLOT_LOCAL } from "./layout";
import {
  arrangeTeams,
  byPriority,
  detectType,
  fmtClock,
  matchesOfDay,
  pickForMatch,
  playedCount,
  shuffle,
  uid,
  type Candidate,
} from "./logic";
import {
  MATCH_LABEL,
  MAX_MEMBERS,
  isPresent,
  vibeInfo,
  type Court,
  type DoublesType,
  type Gender,
  type Level,
  type Match,
  type Member,
  type Team,
  type Theme,
  type Toast,
  type Vibe,
} from "./types";

/** Hộp thoại đang mở (trạng thái giao diện, không lưu). */
export type Dialog =
  | null
  | { kind: "arrange"; courtId: string | null }
  | { kind: "finish"; courtId: string }
  | { kind: "roster"; editId: string | null }
  | { kind: "cleanup" }
  | { kind: "billing" }
  | { kind: "attendance" };

export interface MemberInput {
  name: string;
  gender: Gender;
  level: Level;
}

interface GameState {
  members: Member[];
  courts: Court[];
  /** id thành viên đang chờ, theo thứ tự vào hàng. */
  queue: string[];
  /** Mốc bắt đầu chờ của mỗi người: lúc tham gia, hoặc lúc đánh xong trận gần nhất. */
  queuedAt: Record<string, number>;
  matches: Match[];
  courtCounter: number;
  /** Lựa chọn lần xếp trận gần nhất, dùng làm mặc định cho lần sau. */
  lastType: DoublesType;
  lastVibe: Vibe;
  /** Cài đặt tính tiền: tiền sân, tiền cầu, chênh lệch nam / nữ… */
  bill: BillSettings;
  /** Khoản thêm riêng của từng người, nguyên văn host gõ (đơn vị nghìn đồng), ví dụ "40+20". */
  extras: Record<string, string>;
  theme: Theme;

  // trạng thái tạm, không lưu
  draggingId: string | null;
  hoverCourtId: string | null;
  /** Người đang được bấm chọn (theo thứ tự chọn) để xếp vào sân bằng một cú bấm. */
  selectedIds: string[];
  /** Màn hình dọc (điện thoại): sân xếp lưới 2 cột thay vì một dãy ngang. */
  portrait: boolean;
  dialog: Dialog;
  toasts: Toast[];

  addCourt: () => void;
  removeCourt: (courtId: string) => void;
  renameCourt: (courtId: string, name: string) => boolean;
  /** Xóa hết sân; người đang đứng trong sân quay về hàng chờ. Bị chặn khi còn trận đang đánh. */
  clearCourts: () => void;

  /** `present`: xác nhận vào sân luôn (mặc định). false = chỉ thêm vào danh sách, chưa đến. */
  addMember: (input: MemberInput, present?: boolean) => boolean;
  /** Xác nhận một người vào sân: bắt đầu tính giờ có mặt và vào hàng chờ. */
  checkIn: (memberId: string) => void;
  /** Xác nhận một người rời sân: chốt giờ ra, rời hàng chờ. Bị chặn khi người đó đang đánh. */
  checkOut: (memberId: string) => void;
  /** Sửa tay giờ vào / ra (bảng tính tiền). */
  setMemberTimes: (memberId: string, checkInAt: number | null, checkOutAt: number | null) => boolean;
  /** Buổi mới: xóa giờ vào / ra và khoản thêm của mọi người, giữ nguyên danh sách. */
  resetAttendance: () => void;
  setBill: (patch: Partial<BillSettings>) => void;
  setExtra: (memberId: string, text: string) => void;
  toggleTheme: () => void;
  updateMember: (memberId: string, input: MemberInput) => boolean;
  removeMember: (memberId: string) => void;
  /** Xóa hết thành viên (lịch sử trận vẫn giữ). Bị chặn khi còn trận đang đánh. */
  clearMembers: () => void;

  /** Đặt thành viên vào sân; `near` là điểm thả (toạ độ theo tâm sân) để chọn ô gần nhất. */
  placeMember: (memberId: string, courtId: string, near?: { x: number; z: number }) => void;
  moveToQueue: (memberId: string) => void;
  /** Đưa tất cả người đang đứng ở các sân CHƯA bắt đầu về sảnh chờ (sân đang đánh giữ nguyên). */
  returnIdleToQueue: () => void;
  toggleSelect: (memberId: string) => void;
  clearSelection: () => void;
  /** Xếp lần lượt những người đang chọn vào sân. */
  placeSelected: (courtId: string) => void;

  /**
   * Tự xếp người vào sân theo thể loại + tính chất, ưu tiên người ít trận và chờ lâu.
   * `replace`: trả người đang đứng trong sân về hàng chờ rồi xếp lại từ đầu.
   */
  arrangeMatch: (courtId: string, type: DoublesType, vibe: Vibe, replace: boolean) => boolean;
  /** Sân đủ 4 người thì host bấm mới bắt đầu. */
  startMatch: (courtId: string) => void;
  finishMatch: (courtId: string, winner: Team) => void;
  clearTodayHistory: () => void;

  setPortrait: (portrait: boolean) => void;
  openDialog: (dialog: Exclude<Dialog, null>) => void;
  closeDialog: () => void;
  startDrag: (memberId: string) => void;
  endDrag: () => void;
  setHoverCourt: (courtId: string | null) => void;
  notify: (text: string, kind?: Toast["kind"]) => void;
}

const newCourt = (n: number): Court => ({
  id: uid(),
  name: `Sân ${n}`,
  slots: [null, null, null, null],
  status: "idle",
  startedAt: null,
  matchType: null,
  vibe: null,
});

const emptied = (court: Court): Court => ({
  ...court,
  slots: [null, null, null, null],
  status: "idle",
  startedAt: null,
  matchType: null,
  vibe: null,
});

const isFull = (court: Court) => court.slots.every(Boolean);
const playingCount = (courts: Court[]) => courts.filter((c) => c.status === "playing").length;
const cleanName = (name: string) => name.trim().replace(/\s+/g, " ");
const sameName = (a: string, b: string) => a.toLocaleLowerCase("vi") === b.toLocaleLowerCase("vi");

type PlaceResult = { courts: Court[]; queue: string[] } | { error: string };

/**
 * Đặt một người vào sân (không đụng tới store) — dùng chung cho kéo-thả và bấm chọn.
 * Người đang đứng trong sân mà thả lên chỗ người khác thì hai người đổi chỗ (để chỉnh đội trước khi bắt đầu).
 */
function placeOne(
  courts: Court[],
  queue: string[],
  memberId: string,
  courtId: string,
  near?: { x: number; z: number },
): PlaceResult {
  const court = courts.find((c) => c.id === courtId);
  if (!court) return { error: "Không tìm thấy sân" };
  if (court.status === "playing") return { error: `${court.name} đang có trận` };
  if (courts.some((c) => c.status === "playing" && c.slots.includes(memberId))) {
    return { error: "Thành viên này đang đánh ở sân khác" };
  }

  const distance = (i: number) =>
    near ? (SLOT_LOCAL[i][0] - near.x) ** 2 + (SLOT_LOCAL[i][1] - near.z) ** 2 : i;
  const nearestFirst = [0, 1, 2, 3].sort((a, b) => distance(a) - distance(b));

  const from = courts.find((c) => c.slots.includes(memberId));
  if (near && from) {
    const target = nearestFirst[0];
    const occupant = court.slots[target];
    if (occupant && occupant !== memberId) {
      const fromSlot = from.slots.indexOf(memberId);
      return {
        queue,
        courts: courts.map((c) => {
          if (c.id !== from.id && c.id !== court.id) return c;
          const slots = [...c.slots];
          if (c.id === from.id) slots[fromSlot] = occupant;
          if (c.id === court.id) slots[target] = memberId;
          return { ...c, slots };
        }),
      };
    }
  }

  const slot = nearestFirst.find((i) => court.slots[i] === null || court.slots[i] === memberId);
  if (slot === undefined) return { error: `${court.name} đã đủ người` };
  return {
    queue: queue.filter((id) => id !== memberId),
    courts: courts.map((c) => {
      const cleared = c.slots.includes(memberId) ? c.slots.map((id) => (id === memberId ? null : id)) : c.slots;
      if (c.id !== courtId) return cleared === c.slots ? c : { ...c, slots: cleared };
      const slots = [...cleared];
      slots[slot] = memberId;
      return { ...c, slots };
    }),
  };
}

/** Host đổi người trong sân bằng tay thì "tính chất trận" đã chọn lúc xếp tự động không còn đúng nữa. */
function dropStaleVibes(before: Court[], after: Court[]): Court[] {
  const key = (c: Court) => [...c.slots].sort().join("|");
  const old = new Map(before.map((c) => [c.id, key(c)]));
  return after.map((c) => (c.vibe && old.get(c.id) !== key(c) ? { ...c, vibe: null } : c));
}

/** Gỡ một người khỏi hàng chờ, khỏi sân chưa đánh và khỏi danh sách đang chọn (khi họ rời sân). */
function detach(s: Pick<GameState, "queue" | "courts" | "selectedIds">, memberId: string) {
  const courts = s.courts.map((c) =>
    c.status !== "playing" && c.slots.includes(memberId)
      ? { ...c, slots: c.slots.map((id) => (id === memberId ? null : id)) }
      : c,
  );
  return {
    queue: s.queue.filter((id) => id !== memberId),
    courts: dropStaleVibes(s.courts, courts),
    selectedIds: s.selectedIds.filter((id) => id !== memberId),
  };
}

/** Người đã vào trận thì không còn nằm trong danh sách đang chọn. */
const pruneSelection = (selected: string[], courts: Court[]) =>
  selected.filter((id) => !courts.some((c) => c.status === "playing" && c.slots.includes(id)));

/** Đánh dấu "bắt đầu chờ từ bây giờ". */
function stampQueued(queuedAt: Record<string, number>, ids: string[]): Record<string, number> {
  const now = Date.now();
  const next = { ...queuedAt };
  for (const id of ids) next[id] = now;
  return next;
}

/** Tải lại trang giữa buổi thì giữ nguyên thời gian chờ; để qua lâu hơn mức này (hôm khác) thì tính lại từ đầu. */
const MAX_WAIT_CARRY_MS = 3 * 60 * 60_000;

/** Bảng trình cũ (6 bậc: Yếu, TB-, TB, TB+, Khá, Giỏi) → bảng "gà" 7 bậc. */
const OLD_LEVEL: Record<number, Level> = { 1: 2, 2: 4, 3: 5, 4: 6, 5: 7, 6: 7 };

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      members: [],
      courts: [newCourt(1), newCourt(2)],
      queue: [],
      queuedAt: {},
      matches: [],
      courtCounter: 2,
      lastType: "mixed",
      lastVibe: "intense",
      bill: DEFAULT_BILL,
      extras: {},
      theme: "light",
      draggingId: null,
      hoverCourtId: null,
      selectedIds: [],
      portrait: typeof window !== "undefined" && window.innerWidth < window.innerHeight,
      dialog: null,
      toasts: [],

      addCourt: () =>
        set((s) => ({
          courts: [...s.courts, newCourt(s.courtCounter + 1)],
          courtCounter: s.courtCounter + 1,
        })),

      removeCourt: (courtId) => {
        const court = get().courts.find((c) => c.id === courtId);
        if (!court) return;
        // trận đang diễn ra thì không được xóa sân: phải kết thúc (chọn đội thắng) trước
        if (court.status === "playing") {
          get().notify(`${court.name} đang có trận — kết thúc trận trước khi xóa sân`, "error");
          return;
        }
        const back = court.slots.filter((id): id is string => !!id);
        set((s) => ({
          courts: s.courts.filter((c) => c.id !== courtId),
          queue: [...s.queue, ...back.filter((id) => !s.queue.includes(id))],
        }));
      },

      renameCourt: (courtId, name) => {
        const s = get();
        const clean = cleanName(name).slice(0, 16);
        if (!clean) return false;
        if (s.courts.some((c) => c.id !== courtId && sameName(c.name, clean))) {
          s.notify(`Đã có sân tên "${clean}"`, "error");
          return false;
        }
        set({ courts: s.courts.map((c) => (c.id === courtId ? { ...c, name: clean } : c)) });
        return true;
      },

      clearCourts: () => {
        const s = get();
        const playing = playingCount(s.courts);
        if (playing > 0) {
          s.notify(`Đang có ${playing} trận — kết thúc hết các trận trước khi xóa sân`, "error");
          return;
        }
        const back = s.courts.flatMap((c) => c.slots.filter((id): id is string => !!id));
        set({
          courts: [],
          courtCounter: 0,
          queue: [...s.queue, ...back.filter((id) => !s.queue.includes(id))],
          hoverCourtId: null,
        });
        s.notify("Đã xóa hết sân", "info");
      },

      addMember: ({ name, gender, level }, present = true) => {
        const s = get();
        const clean = cleanName(name).slice(0, 24);
        if (!clean) return false;
        if (s.members.length >= MAX_MEMBERS) {
          s.notify(`Đã đủ ${MAX_MEMBERS} thành viên`, "error");
          return false;
        }
        if (s.members.some((m) => sameName(m.name, clean))) {
          s.notify(`"${clean}" đã có trong danh sách`, "error");
          return false;
        }
        const now = Date.now();
        const member: Member = {
          id: uid(),
          name: clean,
          gender,
          level,
          joinedAt: now,
          checkInAt: present ? now : null,
          checkOutAt: null,
        };
        set((st) => ({
          members: [...st.members, member],
          // chưa đến thì chưa vào hàng chờ
          queue: present ? [...st.queue, member.id] : st.queue,
          queuedAt: present ? stampQueued(st.queuedAt, [member.id]) : st.queuedAt,
        }));
        return true;
      },

      checkIn: (memberId) => {
        const s = get();
        const member = s.members.find((m) => m.id === memberId);
        if (!member || isPresent(member)) return;
        const now = Date.now();
        const placed = s.queue.includes(memberId) || s.courts.some((c) => c.slots.includes(memberId));
        set({
          // đã về rồi quay lại: tính tiếp từ giờ vào ban đầu
          members: s.members.map((m) => (m.id === memberId ? { ...m, checkInAt: m.checkInAt ?? now, checkOutAt: null } : m)),
          queue: placed ? s.queue : [...s.queue, memberId],
          queuedAt: stampQueued(s.queuedAt, [memberId]),
        });
        s.notify(`✅ ${member.name} đã điểm danh lúc ${fmtClock(member.checkInAt ?? now)} · vào sảnh chờ`, "success");
      },

      checkOut: (memberId) => {
        const s = get();
        const member = s.members.find((m) => m.id === memberId);
        if (!member || !isPresent(member)) return;
        const playing = s.courts.find((c) => c.status === "playing" && c.slots.includes(memberId));
        if (playing) {
          s.notify(`${member.name} đang đánh ở ${playing.name} — kết thúc trận trước khi rời sân`, "error");
          return;
        }
        const now = Date.now();
        set({
          members: s.members.map((m) => (m.id === memberId ? { ...m, checkOutAt: now } : m)),
          ...detach(s, memberId),
        });
        s.notify(`${member.name} rời sân lúc ${fmtClock(now)}`, "info");
      },

      setMemberTimes: (memberId, checkInAt, checkOutAt) => {
        const s = get();
        const member = s.members.find((m) => m.id === memberId);
        if (!member) return false;
        if (checkInAt !== null && checkOutAt !== null && checkOutAt < checkInAt) {
          s.notify("Giờ ra phải sau giờ vào", "error");
          return false;
        }
        const next = { ...member, checkInAt, checkOutAt: checkInAt === null ? null : checkOutAt };
        const playing = s.courts.find((c) => c.status === "playing" && c.slots.includes(memberId));
        if (playing && !isPresent(next)) {
          s.notify(`${member.name} đang đánh ở ${playing.name} — kết thúc trận trước`, "error");
          return false;
        }
        const members = s.members.map((m) => (m.id === memberId ? next : m));
        if (isPresent(next) === isPresent(member)) {
          set({ members });
        } else if (isPresent(next)) {
          set({ members, queue: [...s.queue, memberId], queuedAt: stampQueued(s.queuedAt, [memberId]) });
        } else {
          set({ members, ...detach(s, memberId) });
        }
        return true;
      },

      resetAttendance: () => {
        const s = get();
        const playing = playingCount(s.courts);
        if (playing > 0) {
          s.notify(`Đang có ${playing} trận — kết thúc hết các trận trước khi bắt đầu buổi mới`, "error");
          return;
        }
        set({
          members: s.members.map((m) => ({ ...m, checkInAt: null, checkOutAt: null })),
          queue: [],
          queuedAt: {},
          extras: {},
          selectedIds: [],
          courts: s.courts.map(emptied),
        });
        s.notify("Buổi mới: mọi người về trạng thái chưa đến", "info");
      },

      setBill: (patch) => set((s) => ({ bill: { ...s.bill, ...patch } })),
      setExtra: (memberId, text) => set((s) => ({ extras: { ...s.extras, [memberId]: text } })),
      toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),

      updateMember: (memberId, { name, gender, level }) => {
        const s = get();
        const clean = cleanName(name).slice(0, 24);
        if (!clean) return false;
        if (s.members.some((m) => m.id !== memberId && sameName(m.name, clean))) {
          s.notify(`"${clean}" đã có trong danh sách`, "error");
          return false;
        }
        set({ members: s.members.map((m) => (m.id === memberId ? { ...m, name: clean, gender, level } : m)) });
        return true;
      },

      removeMember: (memberId) => {
        const s = get();
        const playing = s.courts.find((c) => c.status === "playing" && c.slots.includes(memberId));
        if (playing) {
          s.notify(`Thành viên đang đánh ở ${playing.name}, hãy kết thúc trận trước`, "error");
          return;
        }
        const queuedAt = { ...s.queuedAt };
        delete queuedAt[memberId];
        const extras = { ...s.extras };
        delete extras[memberId];
        const courts = s.courts.map((c) =>
          c.slots.includes(memberId) ? { ...c, slots: c.slots.map((id) => (id === memberId ? null : id)) } : c,
        );
        set({
          members: s.members.filter((m) => m.id !== memberId),
          queue: s.queue.filter((id) => id !== memberId),
          queuedAt,
          extras,
          selectedIds: s.selectedIds.filter((id) => id !== memberId),
          courts: dropStaleVibes(s.courts, courts),
        });
      },

      clearMembers: () => {
        const s = get();
        const playing = playingCount(s.courts);
        if (playing > 0) {
          s.notify(`Đang có ${playing} trận — kết thúc hết các trận trước khi xóa thành viên`, "error");
          return;
        }
        set({
          members: [],
          queue: [],
          queuedAt: {},
          extras: {},
          selectedIds: [],
          draggingId: null,
          courts: s.courts.map(emptied),
        });
        s.notify("Đã xóa hết thành viên", "info");
      },

      placeMember: (memberId, courtId, near) => {
        const s = get();
        const result = placeOne(s.courts, s.queue, memberId, courtId, near);
        if ("error" in result) {
          s.notify(result.error, "error");
          return;
        }
        const courts = dropStaleVibes(s.courts, result.courts);
        set({ courts, queue: result.queue, selectedIds: s.selectedIds.filter((id) => id !== memberId) });
        const before = s.courts.find((c) => c.id === courtId);
        const after = courts.find((c) => c.id === courtId);
        if (after && isFull(after) && before && !isFull(before)) {
          s.notify(`${after.name} đủ 4 người — bấm ▶ Bắt đầu khi sẵn sàng`, "success");
        }
      },

      moveToQueue: (memberId) => {
        const s = get();
        if (s.courts.some((c) => c.status === "playing" && c.slots.includes(memberId))) return;
        if (s.queue.includes(memberId)) return;
        const courts = s.courts.map((c) =>
          c.slots.includes(memberId) ? { ...c, slots: c.slots.map((id) => (id === memberId ? null : id)) } : c,
        );
        set({
          courts: dropStaleVibes(s.courts, courts),
          queue: [...s.queue, memberId],
          // chưa đánh trận nào thì thời gian chờ vẫn tính tiếp, không bắt đầu lại
          queuedAt: s.queuedAt[memberId] ? s.queuedAt : stampQueued(s.queuedAt, [memberId]),
        });
      },

      returnIdleToQueue: () => {
        const s = get();
        const back: string[] = [];
        const courts = s.courts.map((c) => {
          if (c.status === "playing" || !c.slots.some(Boolean)) return c;
          for (const id of c.slots) if (id && !s.queue.includes(id) && !back.includes(id)) back.push(id);
          return { ...c, slots: c.slots.map(() => null) };
        });
        if (back.length === 0) {
          s.notify("Không có ai đang đứng ở sân chưa bắt đầu", "info");
          return;
        }
        const fresh = back.filter((id) => !s.queuedAt[id]);
        set({
          courts: dropStaleVibes(s.courts, courts),
          queue: [...s.queue, ...back],
          // ai đã có mốc chờ thì giữ nguyên, thời gian chờ tính tiếp
          queuedAt: fresh.length ? stampQueued(s.queuedAt, fresh) : s.queuedAt,
          selectedIds: [],
        });
        s.notify(`Đã đưa ${back.length} người về sảnh chờ`, "success");
      },

      toggleSelect: (memberId) => {
        const s = get();
        if (s.selectedIds.includes(memberId)) {
          set({ selectedIds: s.selectedIds.filter((id) => id !== memberId) });
          return;
        }
        if (s.courts.some((c) => c.status === "playing" && c.slots.includes(memberId))) return;
        if (s.selectedIds.length >= 4) {
          s.notify("Mỗi sân 4 người — chỉ chọn tối đa 4 người một lần", "error");
          return;
        }
        set({ selectedIds: [...s.selectedIds, memberId] });
      },

      clearSelection: () => set({ selectedIds: [] }),

      placeSelected: (courtId) => {
        const s = get();
        if (s.selectedIds.length === 0) return;
        let courts = s.courts;
        let queue = s.queue;
        const placed: string[] = [];
        let error = "";
        for (const id of s.selectedIds) {
          const result = placeOne(courts, queue, id, courtId);
          if ("error" in result) {
            error = result.error;
            break;
          }
          courts = result.courts;
          queue = result.queue;
          placed.push(id);
        }
        if (placed.length === 0) {
          s.notify(error, "error");
          return;
        }
        const left = s.selectedIds.length - placed.length;
        courts = dropStaleVibes(s.courts, courts);
        set({ courts, queue, selectedIds: s.selectedIds.filter((id) => !placed.includes(id)) });
        const court = courts.find((c) => c.id === courtId);
        if (court && isFull(court)) {
          s.notify(`${court.name} đủ 4 người — bấm ▶ Bắt đầu khi sẵn sàng`, "success");
        } else if (court) {
          s.notify(`Đã xếp ${placed.length} người vào ${court.name}`, "success");
        }
        if (left > 0) s.notify(`Còn ${left} người chưa xếp được — ${error}`, "info");
      },

      arrangeMatch: (courtId, type, vibe, replace) => {
        const s = get();
        const court = s.courts.find((c) => c.id === courtId);
        if (!court) return false;
        if (court.status === "playing") {
          s.notify(`${court.name} đang có trận`, "error");
          return false;
        }
        const byId = new Map(s.members.map((m) => [m.id, m]));
        const played = playedCount(matchesOfDay(s.matches));
        const now = Date.now();
        const inCourt = court.slots.filter((id): id is string => !!id);
        const existing = replace ? [] : inCourt.map((id) => byId.get(id)).filter((m): m is Member => !!m);
        const poolIds = replace ? [...s.queue, ...inCourt] : s.queue;

        // xáo trước để những người ngang nhau hoàn toàn được chọn ngẫu nhiên, rồi sắp theo ưu tiên
        const pool: Candidate[] = shuffle(poolIds)
          .map((id) => byId.get(id))
          .filter((m): m is Member => !!m)
          .map((member) => ({
            member,
            played: played.get(member.id) ?? 0,
            waitedMs: now - (s.queuedAt[member.id] ?? now),
          }));
        // Ngẫu Nhiên: giữ nguyên thứ tự đã xáo (bốc thăm) · còn lại: sắp theo ưu tiên ít trận, chờ lâu
        if (vibe !== "random") pool.sort(byPriority);

        const result = pickForMatch(pool, existing, type, vibe);
        if (!result.ok) {
          s.notify(`Chưa xếp được ${court.name}: ${result.reason}`, "error");
          return false;
        }
        const team = arrangeTeams([...existing, ...result.picked], type);
        const teamIds = new Set(team.map((m) => m.id));
        const returned = inCourt.filter((id) => !teamIds.has(id));
        set({
          courts: s.courts.map((c) => (c.id === courtId ? { ...c, slots: team.map((m) => m.id), vibe } : c)),
          queue: [...s.queue.filter((id) => !teamIds.has(id)), ...returned],
          selectedIds: s.selectedIds.filter((id) => !teamIds.has(id)),
          lastType: type,
          lastVibe: vibe,
        });
        const info = vibeInfo(vibe);
        s.notify(`${court.name}: ${MATCH_LABEL[type]} · ${info.emoji} ${info.name} — bấm ▶ Bắt đầu khi sẵn sàng`, "success");
        return true;
      },

      startMatch: (courtId) => {
        const s = get();
        const court = s.courts.find((c) => c.id === courtId);
        if (!court || court.status === "playing") return;
        const byId = new Map(s.members.map((m) => [m.id, m]));
        const players = court.slots.map((id) => (id ? byId.get(id) : undefined));
        if (players.some((p) => !p)) {
          s.notify(`${court.name} chưa đủ 4 người`, "error");
          return;
        }
        const [a1, a2, b1, b2] = players as Member[];
        const matchType = detectType([a1, a2], [b1, b2]);
        const courts = s.courts.map((c) =>
          c.id === courtId ? { ...c, status: "playing" as const, startedAt: Date.now(), matchType } : c,
        );
        set({ courts, selectedIds: pruneSelection(s.selectedIds, courts) });
        s.notify(`${court.name}: bắt đầu trận ${MATCH_LABEL[matchType]}!`, "success");
      },

      finishMatch: (courtId, winner) => {
        const s = get();
        const court = s.courts.find((c) => c.id === courtId);
        if (!court || court.status !== "playing") return;
        const byId = new Map(s.members.map((m) => [m.id, m]));
        const players = court.slots.map((id) => byId.get(id as string)).filter((m): m is Member => !!m);
        const snap = (m: Member) => ({ id: m.id, name: m.name, gender: m.gender, level: m.level });
        const match: Match = {
          id: uid(),
          courtName: court.name,
          type: court.matchType ?? "free",
          vibe: court.vibe,
          teamA: players.slice(0, 2).map(snap),
          teamB: players.slice(2, 4).map(snap),
          winner,
          startedAt: court.startedAt ?? Date.now(),
          endedAt: Date.now(),
        };
        const ids = players.map((p) => p.id);
        set({
          matches: [...s.matches, match],
          queue: [...s.queue, ...ids.filter((id) => !s.queue.includes(id))],
          queuedAt: stampQueued(s.queuedAt, ids),
          courts: s.courts.map((c) => (c.id === courtId ? emptied(c) : c)),
        });
        const winners = (winner === "A" ? match.teamA : match.teamB).map((p) => p.name).join(" & ");
        s.notify(`${court.name}: 🏆 ${winners} thắng`, "success");
      },

      clearTodayHistory: () => {
        const today = new Set(matchesOfDay(get().matches).map((m) => m.id));
        set((s) => ({ matches: s.matches.filter((m) => !today.has(m.id)) }));
      },

      setPortrait: (portrait) => set({ portrait }),
      openDialog: (dialog) => set({ dialog }),
      closeDialog: () => set({ dialog: null }),

      startDrag: (memberId) => {
        resetDrag();
        set({ draggingId: memberId, hoverCourtId: null });
      },
      endDrag: () => {
        resetDrag();
        set({ draggingId: null, hoverCourtId: null });
      },
      setHoverCourt: (courtId) => set({ hoverCourtId: courtId }),

      notify: (text, kind = "info") => {
        const id = uid();
        set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, kind }] }));
        setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4200);
      },
    }),
    {
      name: "sapsan-badminton-v1",
      version: 3,
      // v1 → v2: bảng trình 6 bậc đổi sang 7 bậc "gà", sân có thêm tính chất trận
      // v2 → v3: thành viên có giờ vào / ra sân (dữ liệu cũ: coi như có mặt từ lúc được thêm)
      migrate: (persisted, version) => {
        let saved = (persisted ?? {}) as Record<string, unknown>;
        if (version < 2) {
          type Leveled = { level: unknown };
          const relevel = <T extends Leveled>(list: T[] | undefined) =>
            (list ?? []).map((p) => ({ ...p, level: OLD_LEVEL[p.level as number] ?? 3 }));
          saved = {
            ...saved,
            members: relevel(saved.members as Leveled[] | undefined),
            matches: ((saved.matches as { teamA: Leveled[]; teamB: Leveled[] }[] | undefined) ?? []).map((m) => ({
              ...m,
              teamA: relevel(m.teamA),
              teamB: relevel(m.teamB),
            })),
            courts: ((saved.courts as object[] | undefined) ?? []).map((c) => ({ vibe: null, ...c })),
          };
        }
        if (version < 3) {
          saved = {
            ...saved,
            members: ((saved.members as { joinedAt: number }[] | undefined) ?? []).map((m) => ({
              checkInAt: m.joinedAt,
              checkOutAt: null,
              ...m,
            })),
          };
        }
        return saved;
      },
      // giờ vào hàng chờ: dữ liệu cũ chưa có, hoặc đã quá cũ → coi như vừa bắt đầu chờ
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<GameState>;
        const now = Date.now();
        const queuedAt: Record<string, number> = {};
        for (const m of saved.members ?? current.members) {
          const t = saved.queuedAt?.[m.id];
          queuedAt[m.id] = t && now - t < MAX_WAIT_CARRY_MS ? t : now;
        }
        return { ...current, ...saved, queuedAt };
      },
      partialize: (s) => ({
        members: s.members,
        courts: s.courts,
        queue: s.queue,
        queuedAt: s.queuedAt,
        matches: s.matches,
        courtCounter: s.courtCounter,
        lastType: s.lastType,
        lastVibe: s.lastVibe,
        bill: s.bill,
        extras: s.extras,
        theme: s.theme,
      }),
    },
  ),
);
