// localStorage データ層
const PREFIX = "aq.";

const DEFAULTS = {
  settings: {
    playerName: "挑戦者",
    examDate: null, // "YYYY-MM-DD"
    examLabel: "",
    dailyGoalMin: 120,
    title: "", // 表示中の称号
    companion: "", // 表示中の仲間id
    frame: "", // プロフィール枠
    createdAt: null,
  },
  curriculum: null, // seed から初回生成
  progress: {}, // unitId -> "todo" | "active" | "done"
  sessions: [], // {id,start,end,minutes,unitId,subjectId,manual}
  daily: null, // {date, quests:[], bonusClaimed}
  streak: { current: 0, best: 0, lastVisit: null },
  xp: 0,
  points: 0,
  gacha: { owned: {}, history: [] },
  exams: [],
  achievements: {}, // code -> unlockedAt(ISO)
  timer: { startedAt: null, unitId: null },
  ui: { heatDays: 180 },
};

export const store = {
  get(key) {
    const fallback = DEFAULTS[key];
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw === null) return structuredClone(fallback);
      const value = JSON.parse(raw);
      if (value === null || value === undefined) return structuredClone(fallback);
      if (fallback && typeof fallback === "object" && !Array.isArray(fallback)) {
        return { ...structuredClone(fallback), ...value };
      }
      return value;
    } catch {
      return structuredClone(fallback);
    }
  },

  set(key, value) {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return value;
  },

  update(key, fn) {
    const current = this.get(key);
    const next = fn(current);
    return this.set(key, next === undefined ? current : next);
  },

  remove(key) {
    localStorage.removeItem(PREFIX + key);
  },

  all() {
    const data = {};
    for (const key of Object.keys(DEFAULTS)) data[key] = this.get(key);
    return data;
  },

  exportJSON() {
    return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data: this.all() }, null, 2);
  },

  importJSON(text) {
    const parsed = JSON.parse(text);
    const data = parsed.data || parsed;
    for (const key of Object.keys(DEFAULTS)) {
      if (key in data) this.set(key, data[key]);
    }
    return true;
  },

  resetAll() {
    for (const key of Object.keys(DEFAULTS)) this.remove(key);
  },
};
