import type { Member } from "./types";

export type HairStyle =
  | "short"
  | "spiky"
  | "cap"
  | "headband"
  | "mohawk"
  | "ponytail"
  | "bun"
  | "bob"
  | "twin"
  | "long";

export interface Appearance {
  skin: string;
  hair: HairStyle;
  hairColor: string;
  jersey: string;
  /** Màu nhấn: viền áo, mũ, băng đô, váy. */
  accent: string;
  bottom: string;
  shoe: string;
  scale: number;
}

const SKIN = ["#ffe2c4", "#ffd3ab", "#f3c08a", "#e2a56b", "#c98549"];
const HAIR_COLOR = ["#1f1a17", "#2f1f14", "#4a2c1a", "#7a4a25", "#c9963f", "#a8402c"];
const JERSEY = [
  "#ff4d5a",
  "#ff8a1f",
  "#ffc800",
  "#17c3b2",
  "#2f86ff",
  "#8b46ff",
  "#ff2e93",
  "#06c98b",
  "#00b4f0",
  "#ff5f1f",
  "#7ad63c",
  "#f0438c",
];
const BOTTOM = ["#1f2a44", "#ffffff", "#22304f", "#111827", "#3b3f5c"];
const SHOE = ["#ffffff", "#ffe14d", "#ff5a5f", "#38d9f5", "#b6f23c"];
const HAIR_MALE: HairStyle[] = ["short", "spiky", "cap", "headband", "mohawk"];
const HAIR_FEMALE: HairStyle[] = ["ponytail", "bun", "bob", "twin", "long"];

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Ngoại hình sinh từ id nên mỗi người luôn giữ nguyên một dáng vẻ. */
export function appearanceOf(member: Pick<Member, "id" | "gender">): Appearance {
  const pick = <T,>(list: T[], salt: string) => list[hash(member.id + salt) % list.length];
  const jersey = pick(JERSEY, "jersey");
  let accent = pick(JERSEY, "accent");
  if (accent === jersey) accent = "#ffffff";
  return {
    skin: pick(SKIN, "skin"),
    hair: pick(member.gender === "male" ? HAIR_MALE : HAIR_FEMALE, "hair"),
    hairColor: pick(HAIR_COLOR, "haircolor"),
    jersey,
    accent,
    bottom: pick(BOTTOM, "bottom"),
    shoe: pick(SHOE, "shoe"),
    scale: 0.94 + (hash(member.id + "scale") % 15) / 100,
  };
}

/** Bộ sinh số ngẫu nhiên có hạt giống (để khán giả không đổi chỗ mỗi lần vẽ lại). */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const CROWD_SHIRTS = JERSEY;
export const CROWD_SKIN = SKIN;
export const CROWD_HAIR = HAIR_COLOR;
