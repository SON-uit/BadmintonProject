/**
 * Chia sẻ dữ liệu sang máy khác bằng link — không cần server.
 *
 * Dữ liệu được đóng gói gọn (id → số thứ tự, giờ → số giây lệch so với một mốc, chuỗi cố định → chỉ số),
 * nén deflate rồi mã hoá base64url và đặt sau dấu # của link: `https://…/#s=1eJy…`.
 * Phần # không bao giờ được gửi lên server nên dữ liệu chỉ nằm trên máy hai người.
 * Đây là bản chụp tại lúc chia sẻ: sửa sau đó thì máy kia không tự cập nhật.
 */
import { DEFAULT_BILL, type BillSettings } from "./billing";
import { uid } from "./logic";
import {
  VIBES,
  type Court,
  type DoublesType,
  type Gender,
  type Level,
  type Match,
  type MatchPlayer,
  type MatchType,
  type Member,
  type Team,
  type Vibe,
} from "./types";

/** Phần dữ liệu được chia sẻ (không gồm giao diện sáng / tối — mỗi máy tự chọn). */
export interface SharedData {
  members: Member[];
  courts: Court[];
  queue: string[];
  queuedAt: Record<string, number>;
  matches: Match[];
  courtCounter: number;
  lastType: DoublesType;
  lastVibe: Vibe;
  bill: BillSettings;
  extras: Record<string, string>;
}

export interface SharePayload {
  data: SharedData;
  /** Lúc chia sẻ (ms). */
  sharedAt: number;
}

/** Tiền tố trong phần # của link. */
export const SHARE_HASH = "#s=";

const FORMAT = 1;
const GENDERS: Gender[] = ["male", "female"];
const MATCH_TYPES: MatchType[] = ["men", "women", "mixed", "free"];
const VIBE_KEYS: Vibe[] = VIBES.map((v) => v.value);
const TEAMS: Team[] = ["A", "B"];

const idx = <T>(list: readonly T[], value: T | null | undefined) => (value == null ? null : Math.max(0, list.indexOf(value)));
const at = <T>(list: readonly T[], i: unknown, fallback: T): T => (typeof i === "number" && list[i] !== undefined ? list[i] : fallback);

/* ---------------------------- đóng gói gọn ---------------------------- */

type Packed = unknown[];

function pack(data: SharedData, now: number): Packed {
  const t0 = Math.floor(now / 1000);
  const time = (ms: number | null | undefined) => (ms == null ? null : Math.round(ms / 1000) - t0);
  const index = new Map(data.members.map((m, i) => [m.id, i]));
  const ref = (id: string | null) => (id != null && index.has(id) ? index.get(id)! : -1);
  const player = (p: MatchPlayer) => {
    const i = index.get(p.id);
    const m = i === undefined ? undefined : data.members[i];
    // người còn trong danh sách (cùng tên, giới tính, trình) → chỉ cần số thứ tự
    return m && m.name === p.name && m.gender === p.gender && m.level === p.level ? i! : [p.name, idx(GENDERS, p.gender), p.level];
  };
  return [
    FORMAT,
    t0,
    data.members.map((m) => [m.name, idx(GENDERS, m.gender), m.level, time(m.joinedAt), time(m.checkInAt), time(m.checkOutAt)]),
    data.queue.map(ref).filter((i) => i >= 0),
    data.members.map((m) => time(data.queuedAt[m.id])),
    data.courts.map((c) => [
      c.name,
      c.slots.map(ref),
      c.status === "playing" ? 1 : 0,
      time(c.startedAt),
      idx(MATCH_TYPES, c.matchType),
      idx(VIBE_KEYS, c.vibe),
    ]),
    data.courtCounter,
    idx(MATCH_TYPES, data.lastType),
    idx(VIBE_KEYS, data.lastVibe),
    data.bill,
    Object.entries(data.extras)
      .filter(([id, text]) => index.has(id) && text.trim() !== "")
      .map(([id, text]) => [index.get(id), text]),
    data.matches.map((m) => [
      m.courtName,
      idx(MATCH_TYPES, m.type),
      idx(VIBE_KEYS, m.vibe),
      m.teamA.map(player),
      m.teamB.map(player),
      idx(TEAMS, m.winner),
      time(m.startedAt),
      time(m.endedAt),
    ]),
  ];
}

function unpack(raw: unknown): SharePayload {
  if (!Array.isArray(raw) || raw[0] !== FORMAT) throw new Error("format");
  const [, t0, rawMembers, rawQueue, rawQueued, rawCourts, courtCounter, lastType, lastVibe, bill, rawExtras, rawMatches] = raw as [
    number,
    number,
    unknown[][],
    number[],
    (number | null)[],
    unknown[][],
    number,
    number,
    number,
    Partial<BillSettings>,
    [number, string][],
    unknown[][],
  ];
  if (typeof t0 !== "number" || !Array.isArray(rawMembers)) throw new Error("format");
  const time = (s: unknown) => (typeof s === "number" ? (t0 + s) * 1000 : null);
  const level = (v: unknown): Level => (typeof v === "number" && v >= 0 && v <= 7 ? (Math.round(v) as Level) : 3);

  const members: Member[] = rawMembers.map((m) => ({
    id: uid(),
    name: String(m[0] ?? "").slice(0, 40) || "?",
    gender: at(GENDERS, m[1], "male"),
    level: level(m[2]),
    joinedAt: time(m[3]) ?? t0 * 1000,
    checkInAt: time(m[4]),
    checkOutAt: time(m[5]),
  }));
  const id = (i: unknown) => (typeof i === "number" && members[i] ? members[i].id : null);

  const queuedAt: Record<string, number> = {};
  members.forEach((m, i) => {
    const t = time((rawQueued ?? [])[i]);
    if (t !== null) queuedAt[m.id] = t;
  });

  const courts: Court[] = (rawCourts ?? []).map((c) => {
    const slots = Array.isArray(c[1]) ? (c[1] as unknown[]).slice(0, 4).map(id) : [];
    while (slots.length < 4) slots.push(null);
    return {
      id: uid(),
      name: String(c[0] ?? "Sân"),
      slots,
      status: c[2] === 1 ? "playing" : "idle",
      startedAt: time(c[3]),
      matchType: c[4] == null ? null : at(MATCH_TYPES, c[4], "free"),
      vibe: c[5] == null ? null : at(VIBE_KEYS, c[5], "random"),
    };
  });

  const player = (p: unknown): MatchPlayer => {
    if (typeof p === "number" && members[p]) {
      const m = members[p];
      return { id: m.id, name: m.name, gender: m.gender, level: m.level };
    }
    const [name, g, lv] = Array.isArray(p) ? p : [];
    return { id: uid(), name: String(name ?? "?"), gender: at(GENDERS, g, "male"), level: level(lv) };
  };
  const matches: Match[] = (rawMatches ?? []).map((m) => ({
    id: uid(),
    courtName: String(m[0] ?? ""),
    type: at(MATCH_TYPES, m[1], "free"),
    vibe: m[2] == null ? null : at(VIBE_KEYS, m[2], "random"),
    teamA: Array.isArray(m[3]) ? m[3].map(player) : [],
    teamB: Array.isArray(m[4]) ? m[4].map(player) : [],
    ...(m[5] == null ? {} : { winner: at(TEAMS, m[5], "A") }),
    startedAt: time(m[6]) ?? t0 * 1000,
    endedAt: time(m[7]) ?? t0 * 1000,
  }));

  const extras: Record<string, string> = {};
  for (const [i, text] of rawExtras ?? []) {
    const mid = id(i);
    if (mid) extras[mid] = String(text);
  }

  const doubles = (t: MatchType): DoublesType => (t === "free" ? "mixed" : t);

  // người đang đứng trong sân thì không nằm trong hàng chờ
  const onCourt = new Set(courts.flatMap((c) => c.slots).filter((s): s is string => s !== null));
  const queue = (rawQueue ?? []).map(id).filter((s): s is string => s !== null && !onCourt.has(s));

  return {
    sharedAt: t0 * 1000,
    data: {
      members,
      courts,
      queue: [...new Set(queue)],
      queuedAt,
      matches,
      courtCounter: typeof courtCounter === "number" ? courtCounter : courts.length,
      lastType: doubles(at(MATCH_TYPES, lastType, "mixed")),
      lastVibe: at(VIBE_KEYS, lastVibe, "intense"),
      bill: { ...DEFAULT_BILL, ...(bill && typeof bill === "object" ? bill : {}) },
      extras,
    },
  };
}

/* ------------------------- nén + base64url ------------------------- */

const canCompress = () => typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string) {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/**
 * Mã hoá thành chuỗi đặt sau `#s=`. Ký tự đầu cho biết cách nén:
 * "1" = deflate (mặc định) · "0" = không nén (trình duyệt quá cũ không có CompressionStream).
 */
export async function encodeShare(data: SharedData, now = Date.now()): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(pack(data, now)));
  if (!canCompress()) return "0" + toBase64Url(json);
  return "1" + toBase64Url(await pipe(json, new CompressionStream("deflate-raw")));
}

export async function decodeShare(code: string): Promise<SharePayload> {
  const mode = code[0];
  let bytes = fromBase64Url(code.slice(1).trim());
  if (mode === "1") {
    if (!canCompress()) throw new Error("unsupported");
    bytes = await pipe(bytes, new DecompressionStream("deflate-raw"));
  } else if (mode !== "0") {
    throw new Error("format");
  }
  return unpack(JSON.parse(new TextDecoder().decode(bytes)));
}

/** Link đầy đủ để gửi đi. */
export function shareUrl(code: string) {
  return `${location.origin}${location.pathname}${SHARE_HASH}${code}`;
}

/** Đọc mã chia sẻ trong link đang mở (nếu có). */
export function sharedCodeInLocation(): string | null {
  return location.hash.startsWith(SHARE_HASH) ? location.hash.slice(SHARE_HASH.length) : null;
}

/** Xoá phần #s=… khỏi thanh địa chỉ (không tải lại trang, không thêm lịch sử). */
export function clearSharedHash() {
  history.replaceState(null, "", location.pathname + location.search);
}
