// ゲームロジック: 日次・経験値・ランク・報酬・ガチャ・実績
import { store } from "./store.js";
import { SEED_SUBJECTS } from "./seed.js";

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

  store.update("xp", (x) => x + m);
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

export function awardPoints(amount, { silent = false } = {}) {
  store.update("points", (p) => p + amount);
  return { amount, silent };
}

export function spendPoints(amount) {
  const p = store.get("points");
  if (p < amount) return false;
  store.set("points", p - amount);
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

export const GACHA_ITEMS = [
  // 仲間
  { id: "cmp-hoshi", type: "companion", name: "星読みの幼竜", rarity: 5, icon: "🐉" },
  { id: "cmp-tsuki", type: "companion", name: "月光の妖精", rarity: 5, icon: "🧚" },
  { id: "cmp-neko", type: "companion", name: "三毛の案内猫", rarity: 4, icon: "🐈" },
  { id: "cmp-usagi", type: "companion", name: "白兎の使い", rarity: 4, icon: "🐇" },
  { id: "cmp-tori", type: "companion", name: "笛吹きの小鳥", rarity: 4, icon: "🐦" },
  { id: "cmp-risu", type: "companion", name: "ころころリス", rarity: 3, icon: "🐿️" },
  { id: "cmp-tako", type: "companion", name: "ぷくぷくタコ", rarity: 3, icon: "🐙" },
  { id: "cmp-moju", type: "companion", name: "青の小毛獣", rarity: 3, icon: "🐾" },
  // 称号
  { id: "ttl-seika", type: "title", name: "星辰の求道者", rarity: 5, icon: "✨" },
  { id: "ttl-shichi", type: "title", name: "七日連続の証", rarity: 4, icon: "🔥" },
  { id: "ttl-manbun", type: "title", name: "万分の才", rarity: 4, icon: "🎓" },
  { id: "ttl-hajimari", type: "title", name: "初めの一歩", rarity: 3, icon: "🌱" },
  { id: "ttl-asanobird", type: "title", name: "早起きの鳥", rarity: 3, icon: "🌅" },
  { id: "ttl-yomihaya", type: "title", name: "夜更かしの学者", rarity: 3, icon: "🌙" },
  // 枠
  { id: "frm-gold", type: "frame", name: "黄金の縁取り", rarity: 5, icon: "👑" },
  { id: "frm-silver", type: "frame", name: "白銀の縁取り", rarity: 4, icon: "🥈" },
  { id: "frm-bronze", type: "frame", name: "青銅の縁取り", rarity: 3, icon: "🥉" },
];

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

  const results = [];
  for (let i = 0; i < count; i++) results.push(pickItem(rollRarity()));

  // 10連は★4以上を1枠保証
  if (count === 10 && !results.some((i) => i.rarity >= 4)) {
    results[results.length - 1] = pickItem(4);
  }

  const gacha = store.get("gacha");
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
  store.set("gacha", gacha);
  if (refund > 0) awardPoints(refund, { silent: true });

  const newAch = checkAchievements();
  return { ok: true, results, refund, newAch, cost };
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
