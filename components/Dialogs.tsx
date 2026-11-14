"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { fmtClock, fmtElapsed } from "@/lib/logic";
import { useGame, type MemberInput } from "@/lib/store";
import {
  GENDER_COLOR,
  GENDER_LABEL,
  isPresent,
  LEVELS,
  levelInfo,
  levelLabel,
  MATCH_ICON,
  MATCH_LABEL,
  MAX_MEMBERS,
  VIBES,
  vibeInfo,
  type DoublesType,
  type Gender,
  type Level,
  type Member,
  type Team,
  type Vibe,
} from "@/lib/types";
import AttendanceDialog from "./AttendanceDialog";
import BillingDialog from "./BillingDialog";
import { Modal, SectionTitle } from "./Modal";

const TYPES: DoublesType[] = ["men", "women", "mixed"];

/* ------------------------------------------------------------------ */
/* Xếp trận: chọn sân → thể loại → tính chất                            */
/* ------------------------------------------------------------------ */

function ArrangeDialog({ initialCourtId, onClose }: { initialCourtId: string | null; onClose: () => void }) {
  const courts = useGame((s) => s.courts);
  const members = useGame((s) => s.members);
  const queue = useGame((s) => s.queue);
  const lastType = useGame((s) => s.lastType);
  const lastVibe = useGame((s) => s.lastVibe);
  const arrangeMatch = useGame((s) => s.arrangeMatch);

  const open = courts.filter((c) => c.status === "idle");
  const [courtId, setCourtId] = useState<string | null>(
    () =>
      (initialCourtId && open.some((c) => c.id === initialCourtId) ? initialCourtId : null) ??
      open.find((c) => c.slots.every((s) => !s))?.id ??
      open[0]?.id ??
      null,
  );
  const [type, setType] = useState<DoublesType>(lastType);
  const [vibe, setVibe] = useState<Vibe>(lastVibe);
  const [replace, setReplace] = useState(false);

  const court = open.find((c) => c.id === courtId) ?? null;
  const inCourt = court ? court.slots.filter(Boolean).length : 0;
  const waiting = useMemo(() => {
    const byId = new Map(members.map((m) => [m.id, m]));
    const list = queue.map((id) => byId.get(id)).filter((m): m is Member => !!m);
    return {
      male: list.filter((m) => m.gender === "male").length,
      female: list.filter((m) => m.gender === "female").length,
    };
  }, [members, queue]);

  const submit = () => {
    if (!court) return;
    if (arrangeMatch(court.id, type, vibe, replace && inCourt > 0)) onClose();
  };

  return (
    <Modal
      title="🎲 Xếp trận"
      subtitle={`Hàng chờ: ${waiting.male} nam · ${waiting.female} nữ — ưu tiên người ít trận, chờ lâu`}
      tone="from-amber-400 to-orange-500"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={!court}>
            🎲 Xếp vào {court?.name ?? "sân"}
          </button>
        </>
      }
    >
      <section>
        <SectionTitle step={1}>Chọn sân</SectionTitle>
        {open.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-slate-200 px-3 py-3 text-center text-sm font-medium text-slate-500">
            Không có sân nào đang trống. Kết thúc một trận hoặc thêm sân trước.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Sân">
            {open.map((c) => {
              const filled = c.slots.filter(Boolean).length;
              const active = c.id === courtId;
              return (
                <button
                  key={c.id}
                  role="radio"
                  aria-checked={active}
                  onClick={() => setCourtId(c.id)}
                  className={`cursor-pointer rounded-2xl border-2 px-3 py-2 text-sm font-extrabold transition ${
                    active
                      ? "border-orange-500 bg-orange-500 text-white shadow"
                      : "border-slate-200 bg-white text-slate-700 hover:border-orange-300"
                  }`}
                >
                  {c.name}
                  <span className={`ml-1.5 text-xs font-bold tabular-nums ${active ? "text-white/85" : "text-slate-400"}`}>
                    {filled}/4
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {inCourt > 0 && (
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
              className="size-4 accent-orange-500"
            />
            {court?.name} đang có {inCourt} người: mặc định giữ họ lại và xếp thêm cho đủ — tích để xếp lại toàn bộ
          </label>
        )}
      </section>

      <section>
        <SectionTitle step={2}>Thể loại</SectionTitle>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Thể loại">
          {TYPES.map((t) => (
            <button
              key={t}
              role="radio"
              aria-checked={type === t}
              onClick={() => setType(t)}
              className={`cursor-pointer rounded-2xl border-2 px-2 py-2.5 text-center transition ${
                type === t
                  ? "border-sky-500 bg-sky-500 text-white shadow"
                  : "border-slate-200 bg-white text-slate-700 hover:border-sky-300"
              }`}
            >
              <div className="text-lg leading-none">{MATCH_ICON[t]}</div>
              <div className="mt-1 text-sm font-extrabold">{MATCH_LABEL[t]}</div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle step={3}>Tính chất trận</SectionTitle>
        <div className="space-y-2" role="radiogroup" aria-label="Tính chất trận">
          {VIBES.map((v) => (
            <button
              key={v.value}
              role="radio"
              aria-checked={vibe === v.value}
              aria-label={v.name}
              onClick={() => setVibe(v.value)}
              className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left transition ${
                vibe === v.value ? "border-pink-500 bg-pink-50 shadow" : "border-slate-200 bg-white hover:border-pink-300"
              }`}
            >
              <span className="text-2xl leading-none">{v.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="font-display block text-base font-extrabold leading-tight text-slate-900">{v.name}</span>
                <span className="block text-xs font-medium text-slate-500">{v.hint}</span>
              </span>
              <span
                className={`grid size-5 shrink-0 place-items-center rounded-full border-2 text-[11px] font-black ${
                  vibe === v.value ? "border-pink-500 bg-pink-500 text-white" : "border-slate-300 text-transparent"
                }`}
              >
                ✓
              </span>
            </button>
          ))}
        </div>
      </section>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Kết thúc trận: bắt buộc chọn đội thắng                               */
/* ------------------------------------------------------------------ */

function FinishDialog({ courtId, onClose }: { courtId: string; onClose: () => void }) {
  const court = useGame((s) => s.courts.find((c) => c.id === courtId));
  const members = useGame((s) => s.members);
  const finishMatch = useGame((s) => s.finishMatch);
  const [now] = useState(() => Date.now());

  if (!court || court.status !== "playing") return null;
  const byId = new Map(members.map((m) => [m.id, m]));
  const team = (slots: (string | null)[]) =>
    slots.map((id) => (id ? byId.get(id) : undefined)).filter((m): m is Member => !!m);
  const teams: { key: Team; label: string; players: Member[]; tone: string }[] = [
    { key: "A", label: "Đội A · phía xa", players: team(court.slots.slice(0, 2)), tone: "border-sky-400 hover:bg-sky-50" },
    { key: "B", label: "Đội B · phía gần", players: team(court.slots.slice(2, 4)), tone: "border-pink-400 hover:bg-pink-50" },
  ];
  const vibe = court.vibe ? vibeInfo(court.vibe) : null;

  return (
    <Modal
      title={`🏁 Kết thúc trận · ${court.name}`}
      subtitle={`${MATCH_LABEL[court.matchType ?? "free"]}${vibe ? ` · ${vibe.emoji} ${vibe.name}` : ""} · ${fmtElapsed(now - (court.startedAt ?? now))}`}
      tone="from-rose-500 to-orange-500"
      onClose={onClose}
      footer={
        <button className="btn btn-ghost" onClick={onClose}>
          Chưa xong, đánh tiếp
        </button>
      }
    >
      <p className="text-center text-sm font-bold text-slate-700">Đội nào thắng?</p>
      <div className="grid grid-cols-2 gap-3">
        {teams.map((t) => (
          <button
            key={t.key}
            aria-label={`Đội ${t.key} thắng`}
            onClick={() => {
              finishMatch(court.id, t.key);
              onClose();
            }}
            className={`group cursor-pointer rounded-3xl border-[3px] bg-white px-3 py-4 text-center shadow-[0_4px_0_0_rgb(0_0_0/0.12)] transition active:translate-y-[2px] active:shadow-none ${t.tone}`}
          >
            <div className="text-3xl transition group-hover:scale-125">🏆</div>
            <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">{t.label}</div>
            {t.players.map((p) => (
              <div key={p.id} className="mt-1 flex items-center justify-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: GENDER_COLOR[p.gender] }} />
                <span className="font-display truncate text-base font-extrabold text-slate-900">{p.name}</span>
                <span title={levelLabel(p.level)}>{levelInfo(p.level).emoji}</span>
              </div>
            ))}
            <div className="font-display mt-2 text-sm font-extrabold text-emerald-600">THẮNG</div>
          </button>
        ))}
      </div>
      <p className="text-center text-xs font-medium text-slate-500">
        4 người sẽ quay về hàng chờ, kết quả được ghi vào thống kê.
      </p>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Quản lý thành viên: lưới gọn để thấy cả 25 người không cần cuộn       */
/* ------------------------------------------------------------------ */

function LevelPicker({ value, onChange }: { value: Level; onChange: (level: Level) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1 sm:grid-cols-7" role="radiogroup" aria-label="Trình độ">
      {LEVELS.map((l) => {
        const active = value === l.value;
        return (
          <button
            key={l.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${l.nick} (${l.code})`}
            title={`${l.nick} (${l.code})`}
            onClick={() => onChange(l.value)}
            className={`flex cursor-pointer flex-col items-center rounded-xl border-2 px-1 py-1 text-center leading-tight transition ${
              active ? "border-slate-900 shadow" : "border-transparent hover:border-slate-300"
            }`}
            style={{ background: active ? l.color : `${l.color}55` }}
          >
            <span className="text-lg leading-none">{l.emoji}</span>
            <span className="mt-0.5 text-[10px] font-extrabold text-slate-900">{l.nick}</span>
            <span className="text-[9px] font-bold text-slate-600">({l.code})</span>
          </button>
        );
      })}
    </div>
  );
}

function GenderPicker({ value, onChange }: { value: Gender; onChange: (gender: Gender) => void }) {
  return (
    <div className="flex shrink-0 rounded-2xl bg-slate-100 p-1" role="radiogroup" aria-label="Giới tính">
      {(["male", "female"] as Gender[]).map((g) => (
        <button
          key={g}
          type="button"
          role="radio"
          aria-checked={value === g}
          aria-label={GENDER_LABEL[g]}
          onClick={() => onChange(g)}
          className={`cursor-pointer rounded-xl px-3 py-1.5 text-sm font-extrabold transition ${
            value === g ? "text-white shadow" : "text-slate-500 hover:text-slate-900"
          }`}
          style={value === g ? { background: GENDER_COLOR[g] } : undefined}
        >
          {g === "male" ? "♂" : "♀"} {GENDER_LABEL[g]}
        </button>
      ))}
    </div>
  );
}

// mẫu thử: trình gom cụm để các tính chất trận (cùng trình / lệch 1 bậc) đều xếp được
const SAMPLE: [string, Gender, Level][] = [
  ["Minh", "male", 5],
  ["Tuấn", "male", 5],
  ["Hùng", "male", 5],
  ["Đức", "male", 5],
  ["Long", "male", 4],
  ["Khoa", "male", 2],
  ["Lan", "female", 2],
  ["Hương", "female", 2],
  ["Trang", "female", 2],
  ["Mai", "female", 2],
  ["Ngọc", "female", 4],
  ["Thảo", "female", 5],
];

type RosterFilter = "all" | "present" | "absent" | "left";

function statusOf(m: Member): Exclude<RosterFilter, "all"> {
  if (m.checkInAt === null) return "absent";
  return m.checkOutAt === null ? "present" : "left";
}

function MemberCard({
  member,
  index,
  editing,
  where,
  onEdit,
}: {
  member: Member;
  index: number;
  editing: boolean;
  where?: { text: string; playing: boolean };
  onEdit: () => void;
}) {
  const checkIn = useGame((s) => s.checkIn);
  const checkOut = useGame((s) => s.checkOut);
  const removeMember = useGame((s) => s.removeMember);
  const info = levelInfo(member.level);
  const status = statusOf(member);

  return (
    <li
      className={`flex min-w-0 flex-col gap-1 rounded-2xl border-2 px-2 py-1.5 ${
        editing
          ? "border-amber-400 bg-amber-50"
          : status === "present"
            ? "border-emerald-300 bg-emerald-50"
            : "border-transparent bg-slate-100"
      }`}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className="grid size-7 shrink-0 place-items-center rounded-full text-base"
          style={{ background: info.color }}
          title={`${info.nick} (${info.code})`}
        >
          {info.emoji}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="flex items-center gap-1">
            <span className="size-2 shrink-0 rounded-full" style={{ background: GENDER_COLOR[member.gender] }} />
            <span className="truncate text-sm font-extrabold text-slate-900">
              <span className="mr-0.5 text-[10px] font-bold text-slate-400">{index + 1}.</span>
              {member.name}
            </span>
          </span>
          <span className="block truncate text-[10px] font-semibold text-slate-500">
            {info.nick} ({info.code})
          </span>
        </span>
      </div>
      <div className="flex items-center gap-1">
        <span
          className={`min-w-0 flex-1 truncate rounded-full px-1.5 text-[10px] font-extrabold ${
            status === "present"
              ? where?.playing
                ? "bg-orange-100 text-orange-600"
                : "bg-emerald-100 text-emerald-700"
              : status === "left"
                ? "bg-slate-200 text-slate-500"
                : "text-slate-400"
          }`}
        >
          {status === "present"
            ? where
              ? `${where.text}${where.playing ? " · đang đánh" : ""}`
              : `Có mặt · ${fmtClock(member.checkInAt!)}`
            : status === "left"
              ? `Đã về · ${fmtClock(member.checkInAt!)}–${fmtClock(member.checkOutAt!)}`
              : "Chưa đến"}
        </span>
        {status === "present" ? (
          <button
            className="btn btn-ghost !rounded-lg !px-1.5 !py-0.5 !text-[10px] !shadow-none compact:!min-h-9 compact:!px-2 compact:!text-xs"
            aria-label={`Xác nhận ${member.name} rời sân`}
            title="Xác nhận rời sân"
            onClick={() => checkOut(member.id)}
          >
            🏠 Về
          </button>
        ) : (
          <button
            className="btn btn-green !rounded-lg !px-1.5 !py-0.5 !text-[10px] !shadow-none compact:!min-h-9 compact:!px-2 compact:!text-xs"
            aria-label={`Xác nhận ${member.name} vào sân`}
            title="Xác nhận vào sân"
            onClick={() => checkIn(member.id)}
          >
            ✅ Có mặt
          </button>
        )}
        <button
          className="btn btn-ghost !rounded-lg !px-1 !py-0.5 !text-[10px] !shadow-none compact:!min-h-9 compact:!px-2 compact:!text-xs"
          aria-label={`Sửa ${member.name}`}
          title="Sửa"
          onClick={onEdit}
        >
          ✏️ Sửa
        </button>
        <button
          className="btn btn-ghost !rounded-lg !px-1 !py-0.5 !text-[10px] !shadow-none hover:!bg-rose-100 compact:!min-h-9 compact:!px-2 compact:!text-xs"
          aria-label={`Xóa ${member.name}`}
          title="Xóa"
          onClick={() => window.confirm(`Xóa thành viên "${member.name}"?`) && removeMember(member.id)}
        >
          🗑️ Xóa
        </button>
      </div>
    </li>
  );
}

function RosterDialog({ initialEditId, onClose }: { initialEditId: string | null; onClose: () => void }) {
  const members = useGame((s) => s.members);
  const courts = useGame((s) => s.courts);
  const addMember = useGame((s) => s.addMember);
  const updateMember = useGame((s) => s.updateMember);
  const clearMembers = useGame((s) => s.clearMembers);
  const notify = useGame((s) => s.notify);

  const initial = members.find((m) => m.id === initialEditId);
  const [editId, setEditId] = useState<string | null>(initial?.id ?? null);
  const [name, setName] = useState(initial?.name ?? "");
  const [gender, setGender] = useState<Gender>(initial?.gender ?? "male");
  const [level, setLevel] = useState<Level>(initial?.level ?? 3);
  // mặc định "chưa đến": thêm danh sách trước, người nào tới thì bấm Điểm danh
  const [present, setPresent] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [filter, setFilter] = useState<RosterFilter>("all");
  const input = useRef<HTMLInputElement>(null);

  const editing = members.find((m) => m.id === editId);
  const full = members.length >= MAX_MEMBERS;
  const playing = courts.some((c) => c.status === "playing");

  const where = useMemo(() => {
    const map = new Map<string, { text: string; playing: boolean }>();
    for (const c of courts) for (const id of c.slots) if (id) map.set(id, { text: c.name, playing: c.status === "playing" });
    return map;
  }, [courts]);
  const counts = useMemo(() => {
    const c = { all: members.length, present: 0, absent: 0, left: 0 };
    for (const m of members) c[statusOf(m)]++;
    return c;
  }, [members]);
  const shown = members
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => filter === "all" || statusOf(m) === filter);

  const startEdit = (m: Member) => {
    setEditId(m.id);
    setName(m.name);
    setGender(m.gender);
    setLevel(m.level);
    setBulk(false);
    input.current?.focus();
  };
  const stopEdit = () => {
    setEditId(null);
    setName("");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const data: MemberInput = { name, gender, level };
    if (editing) {
      if (updateMember(editing.id, data)) {
        notify(`Đã cập nhật ${name.trim()}`, "success");
        stopEdit();
      }
    } else if (addMember(data, present)) {
      setName(""); // giữ giới tính + trình để nhập liên tiếp cho nhanh
    }
    input.current?.focus();
  };

  const submitBulk = () => {
    const names = bulkText
      .split(/[\n,;]+/)
      .map((n) => n.trim())
      .filter(Boolean);
    let added = 0;
    const rest: string[] = [];
    for (const n of names) {
      if (addMember({ name: n, gender, level }, present)) added++;
      else rest.push(n);
    }
    if (added > 0) notify(`Đã thêm ${added} người`, "success");
    setBulkText(rest.join("\n")); // tên trùng / vượt giới hạn ở lại để sửa
  };

  const FILTERS: [RosterFilter, string][] = [
    ["all", "Tất cả"],
    ["present", "Có mặt"],
    ["absent", "Chưa đến"],
    ["left", "Đã về"],
  ];

  return (
    <Modal
      title={`👥 Thành viên · ${members.length}/${MAX_MEMBERS}`}
      subtitle={`${counts.present} có mặt · ${counts.absent} chưa đến · ${counts.left} đã về`}
      tone="from-sky-500 to-emerald-400"
      size="xl"
      onClose={onClose}
      footer={
        <>
          {members.length > 0 && (
            <button
              className="btn btn-ghost mr-auto !text-rose-500"
              disabled={playing}
              title={playing ? "Đang có trận — kết thúc hết các trận trước" : undefined}
              onClick={() => {
                if (window.confirm(`Xóa toàn bộ ${members.length} thành viên? Lịch sử trận vẫn giữ.`)) {
                  clearMembers();
                  stopEdit();
                }
              }}
            >
              🧹 Xóa hết thành viên
            </button>
          )}
          <button className="btn btn-primary" onClick={onClose}>
            Xong
          </button>
        </>
      }
    >
      <form
        onSubmit={submit}
        className={`space-y-2 rounded-3xl border-2 p-2.5 ${editing ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-slate-50"}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-sm font-extrabold uppercase tracking-wide text-slate-700">
            {editing ? `✏️ Sửa: ${editing.name}` : "➕ Thêm"}
          </span>
          {bulk && !editing ? (
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={2}
              placeholder="Dán nhiều tên: mỗi dòng một tên, hoặc cách nhau bằng dấu phẩy"
              aria-label="Danh sách tên"
              className="min-w-0 flex-1 basis-60 select-text rounded-2xl border-2 border-slate-200 bg-white px-3 py-1.5 text-base font-semibold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400 focus:border-sky-400 sm:text-sm"
            />
          ) : (
            <input
              ref={input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tên thành viên…"
              maxLength={24}
              autoFocus
              aria-label="Tên thành viên"
              className="min-w-0 flex-1 basis-48 select-text rounded-2xl border-2 border-slate-200 bg-white px-3 py-1.5 text-base font-bold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400 focus:border-sky-400"
            />
          )}
          <GenderPicker value={gender} onChange={setGender} />
          {editing ? (
            <>
              <button type="button" className="btn btn-ghost" onClick={stopEdit}>
                Hủy
              </button>
              <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
                💾 Lưu
              </button>
            </>
          ) : bulk ? (
            <button type="button" className="btn btn-primary" disabled={!bulkText.trim() || full} onClick={submitBulk}>
              ➕ Thêm cả danh sách
            </button>
          ) : (
            <button type="submit" className="btn btn-primary" disabled={!name.trim() || full}>
              ➕ Thêm
            </button>
          )}
        </div>
        <LevelPicker value={level} onChange={setLevel} />
        {!editing && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-slate-600">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={present}
                onChange={(e) => setPresent(e.target.checked)}
                className="size-4 accent-emerald-500"
              />
              Điểm danh luôn (đã có mặt: bắt đầu tính giờ, vào sảnh chờ)
            </label>
            <button type="button" className="font-bold text-sky-600 hover:underline" onClick={() => setBulk((b) => !b)}>
              {bulk ? "← Nhập từng người" : "Dán nhiều tên cùng lúc →"}
            </button>
            {full && <span className="font-bold text-rose-500">Đã đủ {MAX_MEMBERS} người</span>}
          </div>
        )}
      </form>

      <section>
        <div className="mb-2 flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Lọc thành viên">
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={`cursor-pointer rounded-full px-3 py-1 text-xs font-extrabold transition ${
                filter === key ? "bg-sky-500 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {label} · {counts[key]}
            </button>
          ))}
        </div>
        {members.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 px-3 py-5 text-center">
            <p className="text-sm font-medium text-slate-500">Chưa có ai. Nhập tên ở trên, hoặc:</p>
            <button
              className="btn btn-sky mt-2 !text-xs"
              onClick={() => SAMPLE.forEach(([n, g, l]) => addMember({ name: n, gender: g, level: l }))}
            >
              ✨ Thêm 12 thành viên mẫu để thử
            </button>
          </div>
        ) : shown.length === 0 ? (
          <p className="py-4 text-center text-sm font-medium text-slate-500">Không có ai trong mục này.</p>
        ) : (
          // lưới nhiều cột: 25 người vừa 5 hàng trên màn hình rộng
          <ul
            className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            aria-label="Danh sách thành viên"
          >
            {shown.map(({ m, i }) => (
              <MemberCard
                key={m.id}
                member={m}
                index={i}
                editing={m.id === editId}
                where={isPresent(m) ? where.get(m.id) : undefined}
                onEdit={() => startEdit(m)}
              />
            ))}
          </ul>
        )}
      </section>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Dọn dẹp nhanh — khóa khi đang có trận                                */
/* ------------------------------------------------------------------ */

function CleanupDialog({ onClose }: { onClose: () => void }) {
  const members = useGame((s) => s.members);
  const courts = useGame((s) => s.courts);
  const clearMembers = useGame((s) => s.clearMembers);
  const clearCourts = useGame((s) => s.clearCourts);
  const resetAttendance = useGame((s) => s.resetAttendance);
  const playing = courts.filter((c) => c.status === "playing").length;
  // đang có trận thì không cho dọn: phải kết thúc (chọn đội thắng) trước
  const locked = playing > 0;

  const actions = [
    {
      icon: "🌅",
      title: "Buổi mới (giữ danh sách)",
      text: "Mọi người về trạng thái chưa đến, xóa giờ vào / ra và khoản thêm. Danh sách, sân và lịch sử giữ nguyên.",
      disabled: locked || members.length === 0,
      label: "Bắt đầu buổi mới",
      run: () => window.confirm("Bắt đầu buổi mới? Giờ vào / ra của mọi người sẽ bị xóa.") && resetAttendance(),
    },
    {
      icon: "👥",
      title: `Xóa hết thành viên (${members.length})`,
      text: "Hàng chờ và các sân trống trơn; sân vẫn giữ. Lịch sử trận hôm nay không mất.",
      disabled: locked || members.length === 0,
      label: "Xóa hết thành viên",
      run: () => window.confirm(`Xóa toàn bộ ${members.length} thành viên?`) && clearMembers(),
    },
    {
      icon: "🏟️",
      title: `Xóa hết sân (${courts.length})`,
      text: "Người đang đứng trong sân quay về hàng chờ. Sân mới sẽ đánh số lại từ Sân 1.",
      disabled: locked || courts.length === 0,
      label: "Xóa hết sân",
      run: () => window.confirm(`Xóa toàn bộ ${courts.length} sân?`) && clearCourts(),
    },
    {
      icon: "🧹",
      title: "Xóa cả thành viên lẫn sân",
      text: "Bắt đầu lại từ đầu. Lịch sử trận vẫn giữ (xóa riêng trong Thống kê).",
      disabled: locked || (members.length === 0 && courts.length === 0),
      label: "Xóa cả hai",
      run: () => {
        if (!window.confirm(`Xóa toàn bộ ${members.length} thành viên và ${courts.length} sân?`)) return;
        clearMembers();
        clearCourts();
      },
    },
  ];

  return (
    <Modal title="🧹 Dọn dẹp nhanh" subtitle="Mỗi thao tác đều hỏi lại trước khi xóa" tone="from-slate-500 to-slate-700" onClose={onClose}>
      {locked && (
        <p role="alert" className="rounded-2xl border-2 border-orange-300 bg-orange-50 px-3 py-2 text-sm font-bold text-orange-700">
          🔒 Đang có {playing} trận diễn ra — kết thúc hết các trận rồi mới dọn dẹp được.
        </p>
      )}
      <ul className="space-y-2">
        {actions.map((a) => (
          <li key={a.label} className="flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-3 py-2.5">
            <span className="text-2xl">{a.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold text-slate-900">{a.title}</span>
              <span className="block text-xs font-medium text-slate-500">{a.text}</span>
            </span>
            <button className="btn btn-danger shrink-0 !text-xs" disabled={a.disabled} aria-label={a.label} onClick={a.run}>
              {a.icon === "🌅" ? "Làm" : "Xóa"}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

export default function Dialogs() {
  const dialog = useGame((s) => s.dialog);
  const closeDialog = useGame((s) => s.closeDialog);
  if (!dialog) return null;
  switch (dialog.kind) {
    case "arrange":
      return <ArrangeDialog initialCourtId={dialog.courtId} onClose={closeDialog} />;
    case "finish":
      return <FinishDialog courtId={dialog.courtId} onClose={closeDialog} />;
    case "roster":
      return <RosterDialog initialEditId={dialog.editId} onClose={closeDialog} />;
    case "cleanup":
      return <CleanupDialog onClose={closeDialog} />;
    case "billing":
      return <BillingDialog onClose={closeDialog} />;
    case "attendance":
      return <AttendanceDialog onClose={closeDialog} />;
  }
}
