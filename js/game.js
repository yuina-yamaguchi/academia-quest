// ゲームロジック: 日次・経験値・ランク・報酬・ガチャ・実績
import { store } from "./store.js";
import { SEED_SUBJECTS } from "./seed.js";
import { AVATARS } from "./avatars.js";

/* ---------- 日付ユーティリティ ---------- */

// 1日は AM4:00 に切り替わる（デイリークエスト・連続日数のリセット時刻）
const DAY_ROLLOVER_HOUR = 4;

function plainKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayKey(d = new Date()) {
  return plainKey(new Date(d.getTime() - DAY_ROLLOVER_HOUR * 3600000));
}

export function dateKeyOffset(base, offsetDays) {
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + offsetDays);
  return plainKey(d);
}

export function daysBetween(fromKey, toKey) {
  const a = new Date(fromKey + "T00:00:00");
  const b = new Date(toKey + "T00:00:00");
  return Math.round((b - a) / 86400000);
}

/* ---------- カリキュラム・進捗 ---------- */

export function ensureCurriculum() {
  let curriculum = store.get("curriculum");
  if (!curriculum || !Array.isArray(curriculum) || curriculum.length === 0) {
    curriculum = structuredClone(SEED_SUBJECTS);
    store.set("curriculum", curriculum);
  }
  return curriculum;
}

/* ---------- 端末ID・同期補助 ---------- */

export function deviceId() {
  const meta = store.get("meta");
  if (!meta.deviceId) {
    meta.deviceId = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    store.set("meta", meta);
  }
  return meta.deviceId;
}

// カリキュラムの追加・改名・復元時に呼ぶ（削除墓標より新しいと判定される）
export function bumpCurriculumIds(ids) {
  const at = store.get("curriculumAt");
  const now = new Date().toISOString();
  for (const id of ids) if (id) at[id] = now;
  store.set("curriculumAt", at);
}

// 科目・単元の削除墓標
export function tombstoneCurriculum(ids) {
  const del = store.get("deletedCurriculum");
  const now = new Date().toISOString();
  for (const id of ids) if (id) del[id] = now;
  store.set("deletedCurriculum", del);
}

export function allUnits(curriculum = ensureCurriculum()) {
  const list = [];
  for (const s of curriculum) for (const u of s.units) list.push({ subject: s, unit: u });
  return list;
}

export function subjectStats(subject, progress) {
  const total = subject.units.length;
  const done = subject.units.filter((u) => progress[u.id] === "done").length;
  const active = subject.units.filter((u) => progress[u.id] === "active").length;
  return { total, done, active, ratio: total ? done / total : 0 };
}

export function overallStats() {
  const curriculum = ensureCurriculum();
  const progress = store.get("progress");
  const units = allUnits(curriculum);
  const done = units.filter(({ unit }) => progress[unit.id] === "done").length;
  return { total: units.length, done, ratio: units.length ? done / units.length : 0 };
}

/* ---------- 経験値・ランク ---------- */

export function xpForRank(rank) {
  if (rank <= 1) return 0;
  return Math.floor(80 * Math.pow(rank - 1, 1.7));
}

export function rankInfo(xp = store.get("xp")) {
  let rank = 1;
  while (xpForRank(rank + 1) <= xp && rank < 999) rank++;
  const cur = xpForRank(rank);
  const next = xpForRank(rank + 1);
  return {
    rank,
    into: xp - cur,
    need: next - cur,
    ratio: next > cur ? (xp - cur) / (next - cur) : 1,
  };
}

/* ---------- 学習の記録 ---------- */

export function totalMinutes() {
  return store.get("sessions").reduce((sum, s) => sum + (s.minutes || 0), 0);
}

export function addSession({ minutes, unitId = null, subjectId = null, manual = false, start = null, end = null }) {
  const m = Math.max(1, Math.round(minutes));
  const sessions = store.get("sessions");
  const session = {
    id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    start: start || new Date(Date.now() - m * 60000).toISOString(),
    end: end || new Date().toISOString(),
    minutes: m,
    unitId,
    subjectId,
    manual,
  };
  sessions.push(session);
  store.set("sessions", sessions);

  // XPは学習記録の合計から導出（同期時の二重加算・欠落を防ぐ）
  store.set("xp", Math.max(store.get("xp"), totalMinutes()));
  awardPoints(m, { silent: true });

  // デイリー進捗
  ensureDaily();
  const daily = store.get("daily");
  for (const q of daily.quests) {
    if (q.id === "q_min") q.progress = Math.min(q.target, q.progress + m);
    if (q.id === "q_timer" && !manual) q.progress = q.target;
  }
  finalizeQuests(daily);
  store.set("daily", daily);

  const newAch = checkAchievements();
  return { session, newAch };
}

export function unitStatuses() {
  return store.get("progress");
}

export function setUnitStatus(unitId, status) {
  const progress = store.get("progress");
  if (status) progress[unitId] = status;
  else delete progress[unitId];
  store.set("progress", progress);
  const progressAt = store.get("progressAt");
  progressAt[unitId] = new Date().toISOString();
  store.set("progressAt", progressAt);

  ensureDaily();
  const daily = store.get("daily");
  if (status === "done") {
    for (const q of daily.quests) {
      if (q.id === "q_unit") q.progress = Math.min(q.target, q.progress + 1);
    }
    finalizeQuests(daily);
    store.set("daily", daily);
  }
  return checkAchievements();
}

/* ---------- デイリー ---------- */

const DAILY_DEFS = [
  { id: "q_timer", label: "学習タイマーを開始する", target: 1, reward: 30, icon: "⏱️" },
  { id: "q_min", label: "今日の目標時間まで学ぶ", target: 0, reward: 60, icon: "📖" },
  { id: "q_unit", label: "単元を1つ制覇する", target: 1, reward: 50, icon: "🚩" },
];
const DAILY_ALL_BONUS = 100;

export function ensureDaily() {
  const today = todayKey();
  let daily = store.get("daily");
  if (!daily || daily.date !== today) {
    const goal = store.get("settings").dailyGoalMin || 120;
    daily = {
      date: today,
      quests: DAILY_DEFS.map((d) => ({
        ...d,
        target: d.id === "q_min" ? goal : d.target,
        progress: 0,
        done: false,
        claimed: false,
      })),
      allDone: false,
      bonusClaimed: false,
    };
    store.set("daily", daily);
  }
  return daily;
}

export function finalizeQuests(daily) {
  for (const q of daily.quests) {
    if (!q.done && q.progress >= q.target) {
      q.done = true;
      awardPoints(q.reward, { silent: true });
    }
  }
  if (!daily.allDone && daily.quests.every((q) => q.done)) {
    daily.allDone = true;
    awardPoints(DAILY_ALL_BONUS, { silent: true });
    checkAchievements();
  }
}

export function dailySummary() {
  const daily = ensureDaily();
  const doneCount = daily.quests.filter((q) => q.done).length;
  return {
    daily,
    doneCount,
    total: daily.quests.length,
    ratio: daily.quests.length ? doneCount / daily.quests.length : 0,
    earnedToday: daily.quests.reduce((s, q) => (q.done ? s + q.reward : s), 0) + (daily.allDone ? DAILY_ALL_BONUS : 0),
  };
}

/* ---------- 訪問（連続日数・ログインボーナス） ---------- */

const BONUS_CYCLE = [100, 100, 150, 150, 200, 200, 500];

export function visit() {
  ensureCurriculum();
  ensureDaily();
  const today = todayKey();
  const streak = store.get("streak");
  let newDay = false;

  if (streak.lastVisit !== today) {
    newDay = true;
    const yesterday = dateKeyOffset(today, -1);
    streak.current = streak.lastVisit === yesterday ? streak.current + 1 : 1;
    streak.best = Math.max(streak.best || 0, streak.current);
    streak.lastVisit = today;
    store.set("streak", streak);
  }

  const daily = store.get("daily");
  const bonusAvailable = newDay && !daily.bonusClaimed;
  const bonusDay = ((Math.max(streak.current, 1) - 1) % BONUS_CYCLE.length) + 1;
  const bonusAmount = BONUS_CYCLE[bonusDay - 1];

  return { newDay, bonusAvailable, bonusDay, bonusAmount, streak: store.get("streak") };
}

export function claimBonus() {
  const daily = store.get("daily");
  if (daily.bonusClaimed) return { claimed: false, amount: 0 };
  daily.bonusClaimed = true;
  store.set("daily", daily);
  const streak = store.get("streak");
  const bonusDay = ((Math.max(streak.current, 1) - 1) % BONUS_CYCLE.length) + 1;
  const amount = BONUS_CYCLE[bonusDay - 1];
  awardPoints(amount, { silent: true });
  return { claimed: true, amount, bonusDay };
}

/* ---------- ポイント ---------- */

// 残高 = 共通ベース + 端末ごとの獲得合計 - 端末ごとの消費合計
// 端末の獲得/消費は各端末のキーで加算するため、同期マージでも欠落・二重加算しない
export function pointsBalance() {
  const base = store.get("points") || 0;
  const earned = Object.values(store.get("pointsEarned")).reduce((s, n) => s + (Number(n) || 0), 0);
  const spent = Object.values(store.get("pointsSpent")).reduce((s, n) => s + (Number(n) || 0), 0);
  return Math.max(0, base + earned - spent);
}

export function awardPoints(amount, { silent = false } = {}) {
  const me = deviceId();
  store.update("pointsEarned", (m) => {
    m[me] = (Number(m[me]) || 0) + amount;
    return m;
  });
  return { amount, silent };
}

export function spendPoints(amount) {
  if (pointsBalance() < amount) return false;
  const me = deviceId();
  store.update("pointsSpent", (m) => {
    m[me] = (Number(m[me]) || 0) + amount;
    return m;
  });
  return true;
}

/* ---------- タイマー ---------- */

export function timerState() {
  const t = store.get("timer");
  if (t.startedAt) t.elapsedMs = Date.now() - t.startedAt;
  return t;
}

export function startTimer(unitId = null) {
  store.set("timer", { startedAt: Date.now(), unitId });
  ensureDaily();
  const daily = store.get("daily");
  for (const q of daily.quests) if (q.id === "q_timer") q.progress = q.target;
  finalizeQuests(daily);
  store.set("daily", daily);
  return store.get("timer");
}

export function stopTimer() {
  const t = store.get("timer");
  if (!t.startedAt) return null;
  const minutes = Math.max(1, Math.round((Date.now() - t.startedAt) / 60000));
  store.set("timer", { startedAt: null, unitId: null });
  let subjectId = null;
  if (t.unitId) {
    for (const s of ensureCurriculum()) {
      if (s.units.some((u) => u.id === t.unitId)) subjectId = s.id;
    }
  }
  return addSession({ minutes, unitId: t.unitId, subjectId, manual: false });
}

/* ---------- ガチャ ---------- */

const GACHA_COST_SINGLE = 100;
const GACHA_COST_TEN = 1000;
export const GACHA_PITY = 80; // 80連で★5確定

const EL = { 炎: "🔥", 氷: "❄️", 雷: "⚡", 風: "🌪️", 水: "💧", 岩: "🪨", 草: "🌿" };
export const ELEMENT_ICONS = EL;

export const GACHA_ITEMS = [
  /* ----- 仲間（属性付き） ----- */
  { id: "cmp-hoshi", type: "companion", name: "星読みの幼竜", rarity: 5, icon: "🐉", element: "風" },
  { id: "cmp-tsuki", type: "companion", name: "月光の妖精", rarity: 5, icon: "🧚", element: "氷" },
  { id: "cmp-koitsu", type: "companion", name: "炎陽の小狐", rarity: 5, icon: "🦊", element: "炎" },
  { id: "cmp-mizukami", type: "companion", name: "水鏡の海豚", rarity: 5, icon: "🐬", element: "水" },
  { id: "cmp-neko", type: "companion", name: "三毛の案内猫", rarity: 4, icon: "🐈", element: "草" },
  { id: "cmp-usagi", type: "companion", name: "白兎の使い", rarity: 4, icon: "🐇", element: "氷" },
  { id: "cmp-tori", type: "companion", name: "笛吹きの小鳥", rarity: 4, icon: "🐦", element: "風" },
  { id: "cmp-ram", type: "companion", name: "雷雲の子羊", rarity: 4, icon: "🐏", element: "雷" },
  { id: "cmp-ishi", type: "companion", name: "岩角の小鬼", rarity: 4, icon: "🗿", element: "岩" },
  { id: "cmp-risu", type: "companion", name: "ころころリス", rarity: 3, icon: "🐿️", element: "草" },
  { id: "cmp-tako", type: "companion", name: "ぷくぷくタコ", rarity: 3, icon: "🐙", element: "水" },
  { id: "cmp-moju", type: "companion", name: "青の小毛獣", rarity: 3, icon: "🐾", element: "風" },
  { id: "cmp-hiyoko", type: "companion", name: "炎の雛鶏", rarity: 3, icon: "🐤", element: "炎" },
  { id: "cmp-penguin", type: "companion", name: "氷晶の鳥", rarity: 3, icon: "🐧", element: "氷" },
  { id: "cmp-tatemono", type: "companion", name: "土竜の子", rarity: 3, icon: "🦎", element: "岩" },
  { id: "cmp-bubble", type: "companion", name: "泡の精霊", rarity: 3, icon: "🫧", element: "水" },
  { id: "cmp-beetle", type: "companion", name: "雷の小虫", rarity: 3, icon: "🪲", element: "雷" },

  /* ----- 称号 ----- */
  { id: "ttl-seika", type: "title", name: "星辰の求道者", rarity: 5, icon: "✨" },
  { id: "ttl-zenkyo", type: "title", name: "全科目制覇者", rarity: 5, icon: "👑" },
  { id: "ttl-shichi", type: "title", name: "七日連続の証", rarity: 4, icon: "🔥" },
  { id: "ttl-manbun", type: "title", name: "万分の才", rarity: 4, icon: "🎓" },
  { id: "ttl-hyakuji", type: "title", name: "百時間の旅人", rarity: 4, icon: "⏳" },
  { id: "ttl-goukaku", type: "title", name: "合格圏の射手", rarity: 4, icon: "📝" },
  { id: "ttl-shippu", type: "title", name: "疾風の解答者", rarity: 4, icon: "⚡" },
  { id: "ttl-hajimari", type: "title", name: "初めの一歩", rarity: 3, icon: "🌱" },
  { id: "ttl-asanobird", type: "title", name: "早起きの鳥", rarity: 3, icon: "🌅" },
  { id: "ttl-yomihaya", type: "title", name: "夜更かしの学者", rarity: 3, icon: "🌙" },
  { id: "ttl-senmon", type: "title", name: "千問の解答者", rarity: 3, icon: "❓" },
  { id: "ttl-tsumidoko", type: "title", name: "積ん読の勇士", rarity: 3, icon: "📚" },
  { id: "ttl-hittou", type: "title", name: "筆頭の誉れ", rarity: 3, icon: "🖋️" },
  { id: "ttl-renzoku", type: "title", name: "連続記録の証", rarity: 3, icon: "📅" },
  { id: "ttl-kanpeki", type: "title", name: "完璧主義者", rarity: 3, icon: "🎯" },

  /* ----- 枠 ----- */
  { id: "frm-gold", type: "frame", name: "黄金の縁取り", rarity: 5, icon: "👑" },
  { id: "frm-obsidian", type: "frame", name: "黒曜の縁取り", rarity: 5, icon: "🖤" },
  { id: "frm-silver", type: "frame", name: "白銀の縁取り", rarity: 4, icon: "🥈" },
  { id: "frm-crimson", type: "frame", name: "真紅の縁取り", rarity: 4, icon: "🌹" },
  { id: "frm-jade", type: "frame", name: "翡翠の縁取り", rarity: 4, icon: "🍃" },
  { id: "frm-bronze", type: "frame", name: "青銅の縁取り", rarity: 3, icon: "🥉" },
  { id: "frm-crystal", type: "frame", name: "水晶の縁取り", rarity: 3, icon: "💎" },
  { id: "frm-rainbow", type: "frame", name: "虹色の縁取り", rarity: 3, icon: "🌈" },

  /* ----- 背景（名刺風） ----- */
  { id: "bg-starry", type: "background", name: "星空の書斎", rarity: 5, icon: "🌌", bg: "linear-gradient(160deg,#1a1f3d 0%,#2d2350 45%,#0f1226 100%)" },
  { id: "bg-dusk", type: "background", name: "黄昏の高台", rarity: 5, icon: "🌇", bg: "linear-gradient(160deg,#3d2a52 0%,#c96f4a 60%,#f2b25c 100%)" },
  { id: "bg-storm", type: "background", name: "稲光の雲海", rarity: 5, icon: "⛈️", bg: "linear-gradient(160deg,#1b2a4a 0%,#39507f 50%,#8fa8d6 100%)" },
  { id: "bg-dawn", type: "background", name: "朝焼けの窓辺", rarity: 4, icon: "🌅", bg: "linear-gradient(160deg,#f7d9c4 0%,#f1a7a0 55%,#c97b8e 100%)" },
  { id: "bg-abyss", type: "background", name: "深海の回廊", rarity: 4, icon: "🌊", bg: "linear-gradient(160deg,#082c3f 0%,#0d5a6e 60%,#1a8f8f 100%)" },
  { id: "bg-snow", type: "background", name: "雪原の夜", rarity: 4, icon: "❄️", bg: "linear-gradient(160deg,#cfe0ef 0%,#8fa8c9 55%,#3a4a6b 100%)" },
  { id: "bg-meadow", type: "background", name: "花畑の午後", rarity: 4, icon: "🌼", bg: "linear-gradient(160deg,#d8ecc8 0%,#a8d8a0 50%,#f2e39a 100%)" },
  { id: "bg-parchment", type: "background", name: "羊皮紙の机", rarity: 3, icon: "📜", bg: "linear-gradient(160deg,#f3e7cd 0%,#e2cfa5 100%)" },
  { id: "bg-sakura", type: "background", name: "桜色の朝", rarity: 3, icon: "🌸", bg: "linear-gradient(160deg,#ffe3ec 0%,#ffb7cd 100%)" },
  { id: "bg-forest", type: "background", name: "木漏れ日の森", rarity: 3, icon: "🌳", bg: "linear-gradient(160deg,#dcecd2 0%,#9fc98f 100%)" },
  { id: "bg-night", type: "background", name: "夜空の帳", rarity: 3, icon: "🌙", bg: "linear-gradient(160deg,#2b3358 0%,#4a5580 100%)" },

  /* ----- 装飾（ホームで複数装備可） ----- */
  { id: "dec-candle", type: "decoration", name: "黄金の燭台", rarity: 5, icon: "🕯️" },
  { id: "dec-dragon", type: "decoration", name: "竜の立像", rarity: 5, icon: "🐲" },
  { id: "dec-bookshelf", type: "decoration", name: "書棚", rarity: 4, icon: "📚" },
  { id: "dec-orrery", type: "decoration", name: "天球儀", rarity: 4, icon: "🪐" },
  { id: "dec-flag", type: "decoration", name: "学園の旗", rarity: 4, icon: "🚩" },
  { id: "dec-sword", type: "decoration", name: "飾り剣", rarity: 4, icon: "🗡️" },
  { id: "dec-plant", type: "decoration", name: "観葉植物", rarity: 3, icon: "🪴" },
  { id: "dec-mug", type: "decoration", name: "魔法のマグカップ", rarity: 3, icon: "☕" },
  { id: "dec-clock", type: "decoration", name: "置き時計", rarity: 3, icon: "⏰" },
  { id: "dec-books", type: "decoration", name: "積ん読の山", rarity: 3, icon: "📖" },
  { id: "dec-trophy", type: "decoration", name: "賞杯", rarity: 3, icon: "🏆" },

  /* ----- アバター（SVGアート） ----- */
  { id: "ava-starbud", type: "avatar", name: "星のつぼみ精霊", rarity: 5, icon: "🌸", art: "avatar-starbud" },
  { id: "ava-shadow", type: "avatar", name: "影刃の戦士", rarity: 5, icon: "🥷", art: "avatar-shadow" },
  { id: "ava-dragon", type: "avatar", name: "白銀の竜騎士", rarity: 5, icon: "⚔️", art: "avatar-dragon" },
  { id: "ava-mike", type: "avatar", name: "三毛の小妖精", rarity: 4, icon: "🐱", art: "avatar-mike" },
  { id: "ava-raichi", type: "avatar", name: "雷のちび獣", rarity: 4, icon: "⚡", art: "avatar-raichi" },
  { id: "ava-flame", type: "avatar", name: "焔の剣士", rarity: 4, icon: "🔥", art: "avatar-flame" },
  { id: "ava-abyss", type: "avatar", name: "深海の騎士", rarity: 4, icon: "🌊", art: "avatar-abyss" },
  { id: "ava-pixie", type: "avatar", name: "雛のピクシー", rarity: 3, icon: "🐥", art: "avatar-pixie" },
  { id: "ava-sweets", type: "avatar", name: "菓子精霊", rarity: 3, icon: "🍬", art: "avatar-sweets" },
  { id: "ava-flower", type: "avatar", name: "花の子", rarity: 3, icon: "🌺", art: "avatar-flower" },
  { id: "ava-bookgolem", type: "avatar", name: "書物のゴーレム", rarity: 3, icon: "📖", art: "avatar-bookgolem" },
  { id: "ava-stone", type: "avatar", name: "石の小兵", rarity: 3, icon: "🗿", art: "avatar-stone" },
];

// アイテムの描画文字列（アバターはSVG、他は絵文字）
export function itemArt(item) {
  if (item && item.type === "avatar" && item.art) return AVATARS[item.art] || item.icon;
  return item ? item.icon : "";
}

export const GACHA_RATES = { 5: 0.006, 4: 0.051 };

function rollRarity() {
  const r = Math.random();
  if (r < GACHA_RATES[5]) return 5;
  if (r < GACHA_RATES[5] + GACHA_RATES[4]) return 4;
  return 3;
}

function pickItem(rarity) {
  const pool = GACHA_ITEMS.filter((i) => i.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function pullGacha(count) {
  const cost = count === 10 ? GACHA_COST_TEN : GACHA_COST_SINGLE;
  if (!spendPoints(cost)) return { ok: false, reason: "ポイントが足りません" };

  const gacha = store.get("gacha");
  let pity = gacha.pity || 0;

  const results = [];
  for (let i = 0; i < count; i++) {
    pity += 1;
    let rarity;
    if (pity >= GACHA_PITY) {
      rarity = 5; // 天井: ★5確定
    } else {
      rarity = rollRarity();
    }
    if (rarity === 5) pity = 0;
    results.push(pickItem(rarity));
  }

  // 10連は★4以上を1枠保証
  if (count === 10 && !results.some((i) => i.rarity >= 4)) {
    results[results.length - 1] = pickItem(4);
  }

  let refund = 0;
  for (const item of results) {
    const owned = gacha.owned[item.id];
    if (owned) {
      owned.count += 1;
      refund += 30; // 重複は星塵に還元
    } else {
      gacha.owned[item.id] = { count: 1, firstAt: new Date().toISOString() };
    }
    gacha.history.unshift({ ...item, at: new Date().toISOString() });
  }
  gacha.history = gacha.history.slice(0, 50);
  gacha.pity = pity;
  store.set("gacha", gacha);
  if (refund > 0) awardPoints(refund, { silent: true });

  const newAch = checkAchievements();
  return { ok: true, results, refund, newAch, cost, pity };
}

export function pityState() {
  const gacha = store.get("gacha");
  const pity = gacha.pity || 0;
  return { pity, remaining: Math.max(0, GACHA_PITY - pity), ratio: Math.min(1, pity / GACHA_PITY) };
}

/* ---------- 装備 ---------- */

// 単一装備カテゴリ: 同じIDでトグル解除。装飾のみ複数同時装備（配列トグル）
export function equipItem(id, type) {
  const settings = store.get("settings");
  const item = GACHA_ITEMS.find((i) => i.id === id);
  if (!item || item.type !== type) return settings;

  if (type === "decoration") {
    const list = Array.isArray(settings.decorations) ? settings.decorations : [];
    settings.decorations = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  } else if (type === "avatar") {
    settings.avatar = settings.avatar === id ? "" : id;
  } else if (type === "background") {
    settings.background = settings.background === id ? "" : id;
  } else if (type === "companion") {
    settings.companion = settings.companion === id ? "" : id;
  } else if (type === "title") {
    settings.title = settings.title === id ? "" : id;
  } else if (type === "frame") {
    settings.frame = settings.frame === id ? "" : id;
  }
  store.set("settings", settings);
  return settings;
}

export function isEquipped(id, type, settings = store.get("settings")) {
  if (type === "decoration") return Array.isArray(settings.decorations) && settings.decorations.includes(id);
  const key = type;
  return settings[key] === id;
}

export function totalPulls() {
  const gacha = store.get("gacha");
  return Object.values(gacha.owned).reduce((s, o) => s + o.count, 0);
}

export function ownedIds(type) {
  const gacha = store.get("gacha");
  return Object.entries(gacha.owned)
    .filter(([id]) => GACHA_ITEMS.some((i) => i.id === id && i.type === type))
    .map(([id]) => id);
}

/* ---------- 実績 ---------- */

export const ACHIEVEMENTS = [
  { code: "first_session", icon: "🎯", name: "最初のクエスト", desc: "学習を1回記録する" },
  { code: "streak_3", icon: "🔥", name: "3日連続の戦果", desc: "3日連続でログインする" },
  { code: "streak_7", icon: "⚡", name: "週間コンボ", desc: "7日連続でログインする" },
  { code: "streak_30", icon: "🌋", name: "月間の猛者", desc: "30日連続でログインする" },
  { code: "hours_10", icon: "📚", name: "十時間の積み重ね", desc: "累計10時間の学習" },
  { code: "hours_50", icon: "🏯", name: "五十時間の城", desc: "累計50時間の学習" },
  { code: "hours_300", icon: "🏰", name: "三百時間の王城", desc: "累計300時間の学習" },
  { code: "rank_10", icon: "🎖️", name: "ランク10到達", desc: "冒険ランク10になる" },
  { code: "subject_master", icon: "🌈", name: "一科目制覇", desc: "ある科目の単元を全て制覇する" },
  { code: "all_units", icon: "👑", name: "全科目制覇", desc: "全単元を制覇する" },
  { code: "daily_all", icon: "🌟", name: "デイリー完遂", desc: "デイリークエストを全部達成する" },
  { code: "exam_pass", icon: "📝", name: "合格圏の記録", desc: "模試で70%以上を記録する" },
  { code: "gacha_10", icon: "🎰", name: "祈りの手", desc: "ガチャを10回分引く" },
];

function achievementCondition(code) {
  const progress = store.get("progress");
  const curriculum = ensureCurriculum();
  switch (code) {
    case "first_session":
      return store.get("sessions").length >= 1;
    case "streak_3":
      return (store.get("streak").current || 0) >= 3;
    case "streak_7":
      return (store.get("streak").current || 0) >= 7;
    case "streak_30":
      return (store.get("streak").current || 0) >= 30;
    case "hours_10":
      return totalMinutes() >= 600;
    case "hours_50":
      return totalMinutes() >= 3000;
    case "hours_300":
      return totalMinutes() >= 18000;
    case "rank_10":
      return rankInfo().rank >= 10;
    case "subject_master":
      return curriculum.some((s) => s.units.length > 0 && s.units.every((u) => progress[u.id] === "done"));
    case "all_units": {
      const units = allUnits(curriculum);
      return units.length > 0 && units.every(({ unit }) => progress[unit.id] === "done");
    }
    case "daily_all":
      return !!store.get("daily")?.allDone;
    case "exam_pass":
      return store.get("exams").some((e) => examRatio(e) >= 0.7);
    case "gacha_10":
      return totalPulls() >= 10;
    default:
      return false;
  }
}

export function checkAchievements() {
  const unlocked = store.get("achievements");
  const newly = [];
  for (const a of ACHIEVEMENTS) {
    if (!unlocked[a.code] && achievementCondition(a.code)) {
      unlocked[a.code] = new Date().toISOString();
      newly.push(a);
    }
  }
  if (newly.length) store.set("achievements", unlocked);
  return newly;
}

/* ---------- 模試 ---------- */

export function examRatio(exam) {
  const got = exam.items.reduce((s, i) => s + (Number(i.got) || 0), 0);
  const max = exam.items.reduce((s, i) => s + (Number(i.max) || 0), 0);
  return max ? got / max : 0;
}

export function examTotal(exam) {
  return {
    got: exam.items.reduce((s, i) => s + (Number(i.got) || 0), 0),
    max: exam.items.reduce((s, i) => s + (Number(i.max) || 0), 0),
  };
}

/* ---------- 試験日カウントダウン ---------- */

export function examCountdown() {
  const { examDate, examLabel } = store.get("settings");
  if (!examDate) return null;
  const days = daysBetween(todayKey(), examDate);
  return { examDate, examLabel, days: Math.max(0, days), past: days < 0 };
}

/* ---------- 週間集計 ---------- */

export function weeklyMinutes() {
  const sessions = store.get("sessions");
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const key = dateKeyOffset(todayKey(), -i);
    const minutes = sessions
      .filter((s) => todayKey(new Date(s.start)) === key)
      .reduce((sum, s) => sum + (s.minutes || 0), 0);
    out.push({ date: key, minutes, label: "日月火水木金土"[new Date(key + "T00:00:00").getDay()] });
  }
  return out;
}

export function heatmapDays(days) {
  const sessions = store.get("sessions");
  const totals = new Map();
  for (const s of sessions) {
    const key = todayKey(new Date(s.start));
    totals.set(key, (totals.get(key) || 0) + (s.minutes || 0));
  }
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = dateKeyOffset(todayKey(), -i);
    out.push({ date: key, minutes: totals.get(key) || 0 });
  }
  return out;
}
