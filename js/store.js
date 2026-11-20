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
    avatar: "", // プロフィールアバターid
    background: "", // プロフィール背景id
    decorations: [], // ホーム装飾id（複数装備可）
    createdAt: null,
  },
  curriculum: null, // seed から初回生成
  progress: {}, // unitId -> "todo" | "active" | "done"
  progressAt: {}, // unitId -> ISO（進捗の更新時刻・同期マージ用）
  sessions: [], // {id,start,end,minutes,unitId,subjectId,manual}
  deleted: [], // 削除したセッション/模試のID（同期マージ用の墓標）
  daily: null, // {date, quests:[], bonusClaimed}
  streak: { current: 0, best: 0, lastVisit: null },
  xp: 0, // 学習記録の合計分から導出（同期時は再計算）
  points: 0, // 共通ベース残高（両端末の最大値でマージ）
  pointsEarned: {}, // deviceId -> 獲得累計（端末ごとに合算）
  pointsSpent: {}, // deviceId -> 消費累計（端末ごとに合算）
  gacha: { owned: {}, history: [], pity: 0 },
  exams: [],
  words: [], // {id,en,ja,createdAt} 英単語カード（手入力）
  wordProgress: {}, // wordId -> {level,dueAt,correct,wrong,lastReviewedAt} 間隔復習
  achievements: {}, // code -> unlockedAt(ISO)
  timer: { startedAt: null, unitId: null },
  ui: { heatDays: 180 },
  curriculumAt: {}, // subjectId/unitId -> ISO（追加・改名の時刻）
  deletedCurriculum: {}, // subjectId/unitId -> ISO（削除の墓標）
  meta: { deviceId: "", updatedAt: null, at: {} }, // at: キー別更新時刻（LWWマージ用）
};

// 書き込みフック（同期のトリガー。sync.js が設定する）
let onChange = null;

function bumpMeta(key) {
  if (key === "meta") return;
  const meta = store.get("meta");
  meta.at = meta.at || {};
  meta.at[key] = new Date().toISOString();
  meta.updatedAt = meta.at[key];
  localStorage.setItem(PREFIX + "meta", JSON.stringify(meta));
}

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
    bumpMeta(key);
    if (onChange) onChange(key);
    return value;
  },

  update(key, fn) {
    const current = this.get(key);
    const next = fn(current);
    return this.set(key, next === undefined ? current : next);
  },

  remove(key) {
    localStorage.removeItem(PREFIX + key);
    if (onChange) onChange(key);
  },

  all() {
    const data = {};
    for (const key of Object.keys(DEFAULTS)) data[key] = this.get(key);
    return data;
  },

  // 同期マージ結果の適用：フック・時刻更新をせず raw で書き込む
  replace(data) {
    for (const key of Object.keys(DEFAULTS)) {
      if (key in data) localStorage.setItem(PREFIX + key, JSON.stringify(data[key]));
    }
  },

  onChange(fn) {
    onChange = fn;
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

  keys() {
    return Object.keys(DEFAULTS);
  },
};
