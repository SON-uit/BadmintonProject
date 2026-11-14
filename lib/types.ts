export type Gender = "male" | "female";

export type Level = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Số thành viên tối đa của một buổi. */
export const MAX_MEMBERS = 25;

export interface LevelInfo {
  value: Level;
  /** Tên trình chính thức. */
  code: string;
  /** Biệt danh "gà" hiển thị trên giao diện. */
  nick: string;
  emoji: string;
  color: string;
}

export const LEVELS: LevelInfo[] = [
  { value: 1, code: "Newbie", nick: "Gà Mới Vào Sân", emoji: "🐣", color: "#fde047" },
  { value: 2, code: "Yếu", nick: "Gà Tập Bay", emoji: "🐥", color: "#bef264" },
  { value: 3, code: "Yếu+", nick: "Gà Biết Đánh", emoji: "🐔", color: "#5eead4" },
  { value: 4, code: "TBY-", nick: "Gà Có Nghề", emoji: "🐓", color: "#7dd3fc" },
  { value: 5, code: "TBY", nick: "Gà Chiến", emoji: "🐔", color: "#a5b4fc" },
  { value: 6, code: "TBY+", nick: "Gà Đại Ca", emoji: "🐓", color: "#f9a8d4" },
  { value: 7, code: "TB", nick: "Gà Trùm", emoji: "👑", color: "#fbbf24" },
];

export const levelInfo = (level: Level): LevelInfo => LEVELS.find((l) => l.value === level) ?? LEVELS[0];

/** Nhãn đầy đủ: biệt danh gà, trình chú thích trong ngoặc — ví dụ "🐥 Gà Tập Bay (Yếu)". */
export function levelLabel(level: Level) {
  const info = levelInfo(level);
  return `${info.emoji} ${info.nick} (${info.code})`;
}

export const GENDER_LABEL: Record<Gender, string> = { male: "Nam", female: "Nữ" };
export const GENDER_COLOR: Record<Gender, string> = { male: "#38bdf8", female: "#f472b6" };

export interface Member {
  id: string;
  name: string;
  gender: Gender;
  level: Level;
  joinedAt: number;
  /** Giờ host xác nhận người này vào sân (null = chưa đến). Dùng để tính tiền theo thời gian có mặt. */
  checkInAt: number | null;
  /** Giờ xác nhận rời sân (null = còn ở sân, hoặc chưa đến). */
  checkOutAt: number | null;
}

/** Đang có mặt ở sân: đã xác nhận vào và chưa xác nhận rời. */
export const isPresent = (m: Pick<Member, "checkInAt" | "checkOutAt">) => m.checkInAt !== null && m.checkOutAt === null;

export type Theme = "light" | "dark";

/** Thể loại trận: 3 kiểu đánh đôi + "free" khi host kéo tay không theo kiểu nào. */
export type MatchType = "men" | "women" | "mixed" | "free";
export type DoublesType = Exclude<MatchType, "free">;

export const MATCH_LABEL: Record<MatchType, string> = {
  men: "Đôi nam",
  women: "Đôi nữ",
  mixed: "Đôi nam nữ",
  free: "Tự do",
};
export const MATCH_ICON: Record<DoublesType, string> = { men: "♂♂", women: "♀♀", mixed: "♂♀" };

/** Tính chất trận đấu — quyết định độ chênh trình được phép khi xếp. */
export type Vibe = "intense" | "chill" | "easy" | "random";

export interface VibeInfo {
  value: Vibe;
  emoji: string;
  name: string;
  hint: string;
  /** Quy tắc trình, dùng trong thông báo. */
  rule: string;
}

export const VIBES: VibeInfo[] = [
  {
    value: "intense",
    emoji: "🔥",
    name: "Khô Máu",
    hint: "Cùng trình hoặc lệch tối đa 1 bậc, đánh nghiêm túc",
    rule: "lệch tối đa 1 bậc",
  },
  {
    value: "chill",
    emoji: "😎",
    name: "Giao Lưu",
    hint: "Cùng trình, đánh vui nhưng vẫn có tính cạnh tranh",
    rule: "cùng trình",
  },
  {
    value: "easy",
    emoji: "🧘",
    name: "Dưỡng Sinh",
    hint: "Newbie → Yếu, chủ yếu vận động / giao lưu",
    rule: "trình Newbie → Yếu",
  },
  {
    value: "random",
    emoji: "🎲",
    name: "Ngẫu Nhiên",
    hint: "Bốc thăm ngẫu nhiên người trong sảnh chờ, không xét trình độ",
    rule: "ngẫu nhiên",
  },
];

export const vibeInfo = (vibe: Vibe) => VIBES.find((v) => v.value === vibe) ?? VIBES[0];

export type Team = "A" | "B";

export interface Court {
  id: string;
  name: string;
  /** 4 vị trí: 0,1 = đội A (phía xa) · 2,3 = đội B (phía gần) */
  slots: (string | null)[];
  /** idle: đang xếp người (kể cả đã đủ 4 nhưng chưa bấm Bắt đầu) · playing: đang đánh */
  status: "idle" | "playing";
  startedAt: number | null;
  matchType: MatchType | null;
  /** Tính chất đã chọn khi xếp trận; null nếu host xếp tay. */
  vibe: Vibe | null;
}

export interface MatchPlayer {
  id: string;
  name: string;
  gender: Gender;
  level: Level;
}

export interface Match {
  id: string;
  courtName: string;
  type: MatchType;
  vibe?: Vibe | null;
  teamA: MatchPlayer[];
  teamB: MatchPlayer[];
  /** Đội thắng (trận ghi trước khi có tính năng này thì không có). */
  winner?: Team;
  startedAt: number;
  endedAt: number;
}

export interface Toast {
  id: string;
  text: string;
  kind: "info" | "success" | "error";
}
