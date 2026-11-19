// GitHub Gist 同期: トークンで非公開Gistに保存し、自動マージで同期する
import { store } from "./store.js";

const SYNC_KEY = "aq.sync";
const GIST_FILENAME = "academia-quest-data.json";
const API = "https://api.github.com";
const DELETED_CAP = 500;
const HISTORY_CAP = 50;

// キーごとの更新時刻（meta.at）で LWW するキー
const LWW_KEYS = ["settings", "ui", "timer"];

const STATUS_RANK = { todo: 1, active: 2, done: 3 };

/* ---------- トークン・設定（localStorage: aq.sync / エクスポート対象外） ---------- */

function defaultCfg() {
  return { enabled: false, token: "", gistId: "", lastSyncedAt: null };
}

export function loadSync() {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    if (!raw) return defaultCfg();
    return { ...defaultCfg(), ...JSON.parse(raw) };
  } catch {
    return defaultCfg();
  }
}

export function saveSync(cfg) {
  localStorage.setItem(SYNC_KEY, JSON.stringify(cfg));
}

export function disconnectSync() {
  saveSync(defaultCfg());
}

// 全データ消去時: リモートの保管庫も削除して同期を解除（消去後の復活を防ぐ）
export async function wipeRemote() {
  const cfg = loadSync();
  try {
    if (cfg.enabled && cfg.token && cfg.gistId) {
      await gh(`/gists/${cfg.gistId}`, cfg.token, { method: "DELETE" });
    }
  } catch {
    // 失敗しても端末側の解除は行う
  }
  disconnectSync();
}

/* ---------- ユーティリティ ---------- */

function nowISO() {
  return new Date().toISOString();
}

function ts(v) {
  if (!v) return 0;
  const n = Date.parse(v);
  return Number.isNaN(n) ? 0 : n;
}

function at(meta, key) {
  return ts(meta && meta.at ? meta.at[key] : null);
}

function asArr(v) {
  return Array.isArray(v) ? v : [];
}

function payloadData(p) {
  if (!p) return null;
  return p.data && typeof p.data === "object" ? p.data : p;
}

function buildPayload(data = store.all()) {
  return { version: 2, updatedAt: nowISO(), data };
}

// キー順に依存しない比較用の文字列（毎回の無意味なプッシュを防ぐ）
function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

/* ---------- マージ（純関数: mergeData(remote, local)) ---------- */

function pickNewerAt(r, l, key) {
  // 同時刻は local を優先
  return at(r.meta, key) > at(l.meta, key) ? r : l;
}

function mergeProgress(r, l) {
  const progress = {};
  const progressAt = {};
  const ids = new Set([...Object.keys(r.progress || {}), ...Object.keys(l.progress || {})]);
  for (const id of ids) {
    const rv = (r.progress || {})[id];
    const lv = (l.progress || {})[id];
    const ra = ts((r.progressAt || {})[id]);
    const la = ts((l.progressAt || {})[id]);
    let v;
    if (rv === undefined) v = lv;
    else if (lv === undefined) v = rv;
    else if (ra !== la) v = ra > la ? rv : lv;
    else v = (STATUS_RANK[rv] || 0) >= (STATUS_RANK[lv] || 0) ? rv : lv;
    if (v) {
      progress[id] = v;
      const t = Math.max(ra, la);
      if (t) progressAt[id] = new Date(t).toISOString();
    }
  }
  return { progress, progressAt };
}

function mergeDaily(r, l) {
  if (!r) return l ? structuredClone(l) : null;
  if (!l) return structuredClone(r);
  if (r.date !== l.date) return structuredClone(r.date > l.date ? r : l);
  const out = structuredClone(r);
  for (const lq of asArr(l.quests)) {
    const q = asArr(out.quests).find((x) => x.id === lq.id);
    if (!q) {
      out.quests.push(structuredClone(lq));
      continue;
    }
    q.progress = Math.max(q.progress || 0, lq.progress || 0);
    q.done = !!(q.done || lq.done);
    q.claimed = !!(q.claimed || lq.claimed);
    q.target = Math.max(q.target || 0, lq.target || 0);
  }
  out.allDone = !!(out.allDone || l.allDone);
  out.bonusClaimed = !!(out.bonusClaimed || l.bonusClaimed);
  return out;
}

function mergeStreak(r, l) {
  if (!r) return structuredClone(l);
  if (!l) return structuredClone(r);
  const newer = (l.lastVisit || "") > (r.lastVisit || "") ? l : r;
  return {
    current: Math.max(r.current || 0, l.current || 0),
    best: Math.max(r.best || 0, l.best || 0),
    lastVisit: newer.lastVisit || null,
  };
}

function mergePoints(r, l) {
  const base = Math.max(Number(r.points) || 0, Number(l.points) || 0);
  const mergeLedger = (a, b) => {
    const out = {};
    for (const [k, v] of Object.entries(a || {})) out[k] = Number(v) || 0;
    for (const [k, v] of Object.entries(b || {})) out[k] = Math.max(out[k] || 0, Number(v) || 0);
    return out;
  };
  return {
    points: base,
    pointsEarned: mergeLedger(r.pointsEarned, l.pointsEarned),
    pointsSpent: mergeLedger(r.pointsSpent, l.pointsSpent),
  };
}

function mergeGacha(r, l) {
  const gr = r.gacha || { owned: {}, history: [], pity: 0 };
  const gl = l.gacha || { owned: {}, history: [], pity: 0 };
  const owned = {};
  const ids = new Set([...Object.keys(gr.owned || {}), ...Object.keys(gl.owned || {})]);
  for (const id of ids) {
    const a = (gr.owned || {})[id];
    const b = (gl.owned || {})[id];
    if (!a) owned[id] = structuredClone(b);
    else if (!b) owned[id] = structuredClone(a);
    else {
      owned[id] = {
        count: Math.max(a.count || 0, b.count || 0),
        firstAt: [a.firstAt, b.firstAt].filter(Boolean).sort()[0] || null,
      };
    }
  }
  const seen = new Set();
  const history = [];
  for (const h of [...asArr(gr.history), ...asArr(gl.history)]) {
    const key = `${h.id}|${h.at}`;
    if (seen.has(key)) continue;
    seen.add(key);
    history.push(h);
  }
  history.sort((a, b) => ts(b.at) - ts(a.at));
  return { owned, history: history.slice(0, HISTORY_CAP), pity: Math.max(gr.pity || 0, gl.pity || 0) };
}

function mergeAchievements(r, l) {
  const out = {};
  const keys = new Set([...Object.keys(r.achievements || {}), ...Object.keys(l.achievements || {})]);
  for (const k of keys) {
    const a = (r.achievements || {})[k];
    const b = (l.achievements || {})[k];
    const list = [a, b].filter(Boolean).sort();
    out[k] = list[0];
  }
  return out;
}

function mergeDeleted(r, l) {
  const set = new Set([...asArr(r.deleted), ...asArr(l.deleted)]);
  return [...set].slice(-DELETED_CAP);
}

// 科目・単元: ID和集合 + 追加/改名時刻（curriculumAt）と削除墓標の比較（後勝ち）
// ※初期シードは curriculumAt が無い（0）ため、既存の削除が優先される。
//   追加・改名・「標準に戻す」は bumpCurriculumIds で時刻を付ける。
function mergeCurriculum(r, l) {
  const currR = asArr(r.curriculum);
  const currL = asArr(l.curriculum);
  const catR = r.curriculumAt || {};
  const catL = l.curriculumAt || {};
  const delR = r.deletedCurriculum || {};
  const delL = l.deletedCurriculum || {};

  const delT = (id) => Math.max(ts(delR[id]), ts(delL[id]));
  const addT = (id, inR, inL) => {
    let t = 0;
    if (inR) t = Math.max(t, ts(catR[id]));
    if (inL) t = Math.max(t, ts(catL[id]));
    return t;
  };
  const survives = (id, inR, inL) => (inR || inL) && addT(id, inR, inL) >= delT(id);
  const pickFields = (id, inR, inL) => {
    if (inR && inL) {
      const tR = ts(catR[id]);
      const tL = ts(catL[id]);
      return tR > tL ? "R" : "L"; // 同時刻・未記録は local
    }
    return inR ? "R" : "L";
  };

  const mergeUnitList = (unitsR, unitsL) => {
    const mapR = new Map(asArr(unitsR).map((u) => [u.id, u]));
    const mapL = new Map(asArr(unitsL).map((u) => [u.id, u]));
    const out = [];
    for (const id of new Set([...mapR.keys(), ...mapL.keys()])) {
      const inR = mapR.has(id);
      const inL = mapL.has(id);
      if (!survives(id, inR, inL)) continue;
      const src = pickFields(id, inR, inL) === "R" ? mapR.get(id) : mapL.get(id);
      out.push(structuredClone(src));
    }
    return out;
  };

  const subjR = new Map(currR.map((s) => [s.id, s]));
  const subjL = new Map(currL.map((s) => [s.id, s]));
  const subjects = [];
  for (const id of new Set([...subjR.keys(), ...subjL.keys()])) {
    const inR = subjR.has(id);
    const inL = subjL.has(id);
    if (!survives(id, inR, inL)) continue;
    const src = pickFields(id, inR, inL) === "R" ? subjR.get(id) : subjL.get(id);
    const subject = structuredClone(src);
    subject.units = mergeUnitList(
      inR ? subjR.get(id).units : null,
      inL ? subjL.get(id).units : null
    );
    subjects.push(subject);
  }

  // 墓標・時刻もマージして保持（後続マージで判定に使う）
  const curriculumAt = {};
  const deletedCurriculum = {};
  for (const [k, v] of Object.entries(catR)) curriculumAt[k] = v;
  for (const [k, v] of Object.entries(catL)) if (!curriculumAt[k] || ts(v) > ts(curriculumAt[k])) curriculumAt[k] = v;
  for (const [k, v] of Object.entries(delR)) deletedCurriculum[k] = v;
  for (const [k, v] of Object.entries(delL)) if (!deletedCurriculum[k] || ts(v) > ts(deletedCurriculum[k])) deletedCurriculum[k] = v;

  return { curriculum: subjects, curriculumAt, deletedCurriculum };
}

function mergeSessions(r, l) {
  const deleted = new Set(mergeDeleted(r, l));
  const map = new Map();
  for (const s of [...asArr(r.sessions), ...asArr(l.sessions)]) {
    if (!s || !s.id || deleted.has(s.id)) continue;
    if (!map.has(s.id)) map.set(s.id, s);
  }
  const out = [...map.values()];
  out.sort((a, b) => ts(a.start) - ts(b.start));
  return out;
}

function mergeExams(r, l) {
  const deleted = new Set(mergeDeleted(r, l));
  const map = new Map();
  for (const e of [...asArr(r.exams), ...asArr(l.exams)]) {
    if (!e || !e.id || deleted.has(e.id)) continue;
    if (!map.has(e.id)) map.set(e.id, e);
  }
  return [...map.values()];
}

export function mergeData(remotePayload, localPayload) {
  const R = payloadData(remotePayload);
  const L = payloadData(localPayload);
  if (!R) return structuredClone(L);
  if (!L) return structuredClone(R);

  const meta = {
    deviceId: (L.meta && L.meta.deviceId) || (R.meta && R.meta.deviceId) || "",
    updatedAt: new Date(Math.max(ts(R.meta?.updatedAt), ts(L.meta?.updatedAt)) || Date.now()).toISOString(),
    at: {},
  };
  const keys = new Set([...Object.keys(R.meta?.at || {}), ...Object.keys(L.meta?.at || {})]);
  for (const k of keys) {
    const t = Math.max(at(R.meta, k), at(L.meta, k));
    if (t) meta.at[k] = new Date(t).toISOString();
  }

  const lww = {};
  for (const key of LWW_KEYS) {
    const src = pickNewerAt(R, L, key);
    const value = src && src[key] !== undefined ? src[key] : L[key] !== undefined ? L[key] : R[key];
    if (value !== undefined) lww[key] = structuredClone(value);
  }

  const { progress, progressAt } = mergeProgress(R, L);
  const curriculumMerged = mergeCurriculum(R, L);
  const pointsMerged = mergePoints(R, L);
  const sessions = mergeSessions(R, L);
  const sessionMinutes = sessions.reduce((s, x) => s + (x.minutes || 0), 0);

  const data = {
    ...lww,
    curriculum: curriculumMerged.curriculum,
    curriculumAt: curriculumMerged.curriculumAt,
    deletedCurriculum: curriculumMerged.deletedCurriculum,
    progress,
    progressAt,
    sessions,
    deleted: mergeDeleted(R, L),
    daily: mergeDaily(R.daily, L.daily),
    streak: mergeStreak(R.streak, L.streak),
    xp: Math.max(Number(R.xp) || 0, Number(L.xp) || 0, sessionMinutes),
    ...pointsMerged,
    gacha: mergeGacha(R, L),
    exams: mergeExams(R, L),
    achievements: mergeAchievements(R, L),
    meta,
  };
  return buildPayload(data);
}

/* ---------- GitHub Gist API ---------- */

async function gh(path, token, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const err = new Error(`GitHub API ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function fetchGist(gistId, token) {
  const gist = await gh(`/gists/${gistId}`, token);
  const file = gist.files && gist.files[GIST_FILENAME];
  if (!file || typeof file.content !== "string") return null;
  try {
    return JSON.parse(file.content);
  } catch {
    return null;
  }
}

async function createGist(token, payload) {
  const gist = await gh("/gists", token, {
    method: "POST",
    body: JSON.stringify({
      public: false,
      description: "academia-quest save data",
      files: { [GIST_FILENAME]: { content: JSON.stringify(payload) } },
    }),
  });
  return gist.id;
}

async function updateGist(gistId, token, payload) {
  await gh(`/gists/${gistId}`, token, {
    method: "PATCH",
    body: JSON.stringify({ files: { [GIST_FILENAME]: { content: JSON.stringify(payload) } } }),
  });
}

async function discoverGist(token) {
  const gists = await gh("/gists?per_page=100", token);
  const found = (gists || []).find((g) => g.files && g.files[GIST_FILENAME]);
  return found ? found.id : null;
}

/* ---------- 同期本体 ---------- */

let syncing = false;

export async function syncNow() {
  const cfg = loadSync();
  if (!cfg.enabled || !cfg.token) return { skip: true };
  if (syncing) return { skip: true, busy: true };
  syncing = true;
  try {
    let gistId = cfg.gistId || null;
    let remote = null;

    if (gistId) {
      try {
        remote = await fetchGist(gistId, cfg.token);
      } catch (e) {
        // 保管庫が消えていたら作り直す
        if (e.status !== 404) throw e;
        gistId = null;
      }
    }
    if (!gistId) {
      gistId = await discoverGist(cfg.token);
      if (gistId) remote = await fetchGist(gistId, cfg.token);
    }

    const localPayload = buildPayload();

    if (!remote) {
      // 初回: 保管庫を作成（またはファイルを作成）
      if (!gistId) gistId = await createGist(cfg.token, localPayload);
      else await updateGist(gistId, cfg.token, localPayload);
      saveSync({ ...cfg, gistId, lastSyncedAt: nowISO() });
      return { ok: true, gistId, created: true, changed: true };
    }

    const merged = mergeData(remote, localPayload);
    const mergedData = canonical(merged.data);
    const localData = canonical(localPayload.data);
    const remoteData = canonical(remote.data);

    if (mergedData !== localData) store.replace(merged.data);

    let pushed = false;
    if (mergedData !== remoteData) {
      await updateGist(gistId, cfg.token, merged);
      pushed = true;
    }

    saveSync({ ...cfg, gistId, lastSyncedAt: nowISO() });
    return { ok: true, gistId, changed: mergedData !== localData || pushed, pushed };
  } catch (e) {
    return { ok: false, error: e.message, status: e.status || null };
  } finally {
    syncing = false;
  }
}

/* ---------- 接続フロー ---------- */

export async function connectSync(tokenInput, gistIdInput = "") {
  const token = (tokenInput || "").trim();
  const gistId = (gistIdInput || "").trim();
  if (!token) return { ok: false, error: "トークンを入力してください" };

  // トークン検証 + 保管庫の特定（未指定ならアカウントから自動検出、無ければ作成）
  try {
    let id = gistId || null;
    if (id) {
      await fetchGist(id, token); // 404ならここで失敗
    } else {
      id = await discoverGist(token);
    }
    saveSync({ enabled: true, token, gistId: id || "", lastSyncedAt: null });
    const result = await syncNow();
    if (!result.ok) {
      if (result.status === 401) return { ok: false, error: "トークンが無効です（期限・スコープを確認）" };
      if (result.status === 404) return { ok: false, error: "保管庫が見つかりません（IDを確認）" };
      return { ok: false, error: result.error || "同期に失敗しました" };
    }
    return { ok: true, gistId: loadSync().gistId, ...result };
  } catch (e) {
    if (e.status === 401) return { ok: false, error: "トークンが無効です（期限・スコープを確認）" };
    if (e.status === 404) return { ok: false, error: "保管庫が見つかりません（IDを確認）" };
    return { ok: false, error: e.message || "接続に失敗しました" };
  }
}

/* ---------- 自動同期のスケジュール ---------- */

let debounceTimer = null;

export function scheduleSync(delay = 5000) {
  if (!loadSync().enabled) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    syncNow().catch(() => {});
  }, delay);
}

export function initSync() {
  store.onChange((key) => {
    if (key === "meta") return;
    scheduleSync();
  });
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) syncNow().catch(() => {});
    });
  }
}
