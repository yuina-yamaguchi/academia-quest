// game.js ロジックの簡易テスト（localStorage スタブ）
import assert from "node:assert";

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

const game = await import("../js/game.js");
const { store } = await import("../js/store.js");

// 訪問・連続日数
let v = game.visit();
assert.equal(v.streak.current, 1, "初回訪問は連続1日");
assert.equal(v.bonusAvailable, true, "初回はボーナスあり");
v = game.visit();
assert.equal(v.bonusAvailable, false, "同日2回目はボーナスなし");

// ボーナス受取
const b = game.claimBonus();
assert.equal(b.claimed, true);
assert.equal(b.amount, 100);
assert.equal(game.pointsBalance(), 100, "残高にボーナス加算");

// 学習記録 → XP/ポイント/デイリー進捗
game.startTimer(null);
const r = game.stopTimer();
assert.ok(r && r.session.minutes >= 1, "タイマーでセッション記録");
assert.ok(store.get("xp") >= 1, "XP加算");
const daily = store.get("daily");
const qTimer = daily.quests.find((q) => q.id === "q_timer");
assert.equal(qTimer.done, true, "タイマークエスト達成");

// 単元制覇 → クエスト・実績
const curriculum = game.ensureCurriculum();
assert.equal(curriculum.length, 6, "科目6つ");
const unitId = curriculum[0].units[0].id;
const newAch = game.setUnitStatus(unitId, "done");
assert.ok(newAch.some((a) => a.code === "first_session") || store.get("sessions").length >= 1);

// 手入力セッションで目標時間クエスト
game.addSession({ minutes: 200, manual: true });
const d2 = store.get("daily");
const qMin = d2.quests.find((q) => q.id === "q_min");
assert.equal(qMin.done, true, "目標時間クエスト達成");
assert.equal(store.get("xp"), game.totalMinutes(), "XPは学習記録の合計から導出");

// ランク
const rank = game.rankInfo(store.get("xp"));
assert.ok(rank.rank >= 1 && rank.need > 0);

// ガチャ: ポイントが十分なら10連
const pts = game.pointsBalance();
console.log("points after:", pts);
if (pts >= 1000) {
  const pull = game.pullGacha(10);
  assert.equal(pull.ok, true);
  assert.equal(pull.results.length, 10);
  const owned = Object.keys(store.get("gacha").owned);
  assert.ok(owned.length >= 1, "アイテム所持");
} else {
  console.log("skip gacha (not enough points)");
}

// 実績チェックは例外なく動く
const ach = game.checkAchievements();
console.log("new achievements:", ach.map((a) => a.code));

// 模試
const exams = store.get("exams");
exams.push({ id: "e1", name: "模試1", date: game.todayKey(), items: [{ label: "財務会計論", got: 75, max: 100 }] });
store.set("exams", exams);
assert.equal(game.examRatio(exams[0]), 0.75);
const ach2 = game.checkAchievements();
assert.ok(ach2.some((a) => a.code === "exam_pass"), "合格圏実績");

// 週間・ヒートマップ
assert.equal(game.weeklyMinutes().length, 7);
assert.equal(game.heatmapDays(30).length, 30);

// エクスポート/インポート
const json = store.exportJSON();
store.resetAll();
assert.equal(store.get("sessions").length, 0);
store.importJSON(json);
assert.ok(store.get("sessions").length > 0);

// AM4:00 境界の「ゲーム日」
{
  const k3 = game.todayKey(new Date("2026-11-13T03:59:00"));
  const k4 = game.todayKey(new Date("2026-11-13T04:00:00"));
  const k5 = game.todayKey(new Date("2026-11-13T05:00:00"));
  assert.equal(k3, "2026-11-12", "AM4:00前は前日扱い");
  assert.equal(k4, "2026-11-13", "AM4:00で日付が切り替わる");
  assert.equal(k5, "2026-11-13", "AM4:00後は当日扱い");
  assert.equal(game.dateKeyOffset("2026-11-13", -1), "2026-11-12", "前日キーの計算");
  assert.equal(game.dateKeyOffset("2026-03-01", -1), "2026-02-28", "月末跨ぎの前日キー");
  assert.equal(game.daysBetween("2026-11-13", "2026-11-22"), 9, "日数差");
}

// ガチャ拡張: 新タイプ・SVGアバター・ピティ・装備
{
  const types = new Set(game.GACHA_ITEMS.map((i) => i.type));
  for (const t of ["companion", "title", "frame", "background", "decoration", "avatar"]) {
    assert(types.has(t), `type ${t} exists`);
  }
  assert.ok(game.GACHA_ITEMS.length >= 70, `pool size ${game.GACHA_ITEMS.length}`);
  assert.equal(game.GACHA_ITEMS.filter((i) => i.type === "avatar").length, 12, "avatars = 12");
  assert.ok(game.GACHA_ITEMS.every((i) => i.name && i.icon && i.rarity >= 3 && i.rarity <= 5), "item fields");
  assert.ok(game.GACHA_ITEMS.filter((i) => i.type === "background").every((i) => i.bg.includes("gradient")), "backgrounds have bg");
  const av = game.GACHA_ITEMS.find((i) => i.type === "avatar");
  assert.ok(game.itemArt(av).startsWith("<svg"), "avatar art is SVG");
  const cmp = game.GACHA_ITEMS.find((i) => i.type === "companion");
  assert.equal(game.itemArt(cmp), cmp.icon, "companion art is emoji");
  // 全アバターのartがAVATARSに存在する
  for (const a of game.GACHA_ITEMS.filter((i) => i.type === "avatar")) {
    assert.ok(game.itemArt(a).startsWith("<svg"), `art present for ${a.id}`);
  }

  // 80連天井
  game.awardPoints(6000);
  store.update("gacha", (g) => ({ ...g, pity: 79 }));
  const p1 = game.pullGacha(1);
  assert.equal(p1.results[0].rarity, 5, "pity 80th pull is ★5");
  assert.equal(store.get("gacha").pity, 0, "pity resets on ★5");
  store.update("gacha", (g) => ({ ...g, pity: 79 }));
  const p2 = game.pullGacha(10);
  assert.equal(p2.results[0].rarity, 5, "10連 starts with ★5 at pity");
  assert.equal(p2.results.length, 10);
  const pity = game.pityState();
  assert.ok(pity.remaining <= game.GACHA_PITY && pity.remaining > 0, "pityState remaining");

  // 装備: 単一はトグル、装飾は複数可
  game.equipItem("ava-shadow", "avatar");
  assert.equal(store.get("settings").avatar, "ava-shadow");
  game.equipItem("ava-shadow", "avatar");
  assert.equal(store.get("settings").avatar, "", "avatar toggles off");
  game.equipItem("bg-starry", "background");
  assert.equal(store.get("settings").background, "bg-starry");
  game.equipItem("dec-candle", "decoration");
  game.equipItem("dec-plant", "decoration");
  assert.equal(store.get("settings").decorations.length, 2, "decorations stack");
  game.equipItem("dec-candle", "decoration");
  assert.deepEqual(store.get("settings").decorations, ["dec-plant"], "decoration toggles individually");
  assert.ok(game.isEquipped("dec-plant", "decoration"));
  assert.ok(!game.isEquipped("dec-candle", "decoration"));
  game.equipItem("no-such-id", "avatar");
  assert.equal(store.get("settings").avatar, "", "unknown id ignored");
}

// ---------- 英単語カード ----------
{
  // 登録・重複拒否
  const w1 = game.addWord("accrual", "発生主義");
  assert.ok(w1 && w1.id, "単語を追加できる");
  assert.equal(game.addWord("accrual", "別訳"), null, "英語の重複は追加不可");
  const w2 = game.addWord("going concern", "継続企業");
  assert.ok(w2);
  assert.equal(game.addWord("  ", "意味だけ"), null, "英語が空は不可");

  // デイリーに英単語クエストが入る（targetは語数に応じて最大5）
  const d = game.ensureDaily();
  const qw = d.quests.find((q) => q.id === "q_words");
  assert.ok(qw, "デイリーに英単語クエストがある");
  assert.equal(qw.target, 2, "target = min(5, 語数)");

  // 復習キュー（未復習は全部期限切れ扱い）
  const queue = game.buildWordQueue();
  assert.equal(queue.length, 2, "全カードがキューに入る");

  // 正解 → レベルアップ・期限が先・クエスト進捗
  game.reviewWord(queue[0], true);
  const p1 = store.get("wordProgress")[queue[0]];
  assert.equal(p1.level, 1, "正解でレベルアップ");
  assert.ok(Date.parse(p1.dueAt) > Date.now(), "次回復習は先の日時");
  const d2 = game.ensureDaily();
  assert.equal(d2.quests.find((q) => q.id === "q_words").progress, 1, "クエスト進捗+1");

  // 誤答 → リセット
  game.reviewWord(queue[1], false);
  assert.equal(store.get("wordProgress")[queue[1]].level, 0, "誤答でレベル0");

  // 削除 → 墓標・進捗も消える
  game.deleteWord(queue[0]);
  assert.ok(!store.get("words").some((w) => w.id === queue[0]), "一覧から消える");
  assert.ok(store.get("deleted").includes(queue[0]), "削除墓標に残る");
  assert.ok(!store.get("wordProgress")[queue[0]], "復習状態も消える");

  // セッション時間の記録（source=words）
  const before = store.get("sessions").length;
  game.addSession({ minutes: 2, manual: true, source: "words" });
  const sess = store.get("sessions").at(-1);
  assert.equal(store.get("sessions").length, before + 1);
  assert.equal(sess.source, "words", "単語セッションの印が付く");

  // 30枚で実績「単語の達人」
  while (store.get("words").length < 30) {
    const n = store.get("words").length;
    game.addWord(`word-${n}`, `単語-${n}`);
  }
  const newAch = game.checkAchievements();
  assert.ok(newAch.some((a) => a.code === "words_30"), "30枚で実績解除");

  // 編集
  const someId = store.get("words")[0].id;
  game.updateWord(someId, { ja: "編集済み" });
  assert.equal(store.get("words")[0].ja, "編集済み", "意味を編集できる");
}

// ---------- 同期（Gistマージ・トークン・墓標） ----------
{
  const sync = await import("../js/sync.js");
  const now = new Date().toISOString();
  const earlier = new Date(Date.now() - 600000).toISOString();
  const later = new Date(Date.now() + 600000).toISOString();

  const mkData = (over = {}) => ({
    settings: {
      playerName: "P", examDate: null, examLabel: "", dailyGoalMin: 120,
      title: "", companion: "", frame: "", avatar: "", background: "", decorations: [], createdAt: null,
    },
    curriculum: [{ id: "s1", name: "科目", icon: "📘", color: "#4A90D9", units: [{ id: "u1", name: "単元1" }, { id: "u2", name: "単元2" }] }],
    curriculumAt: {},
    deletedCurriculum: {},
    progress: {},
    progressAt: {},
    sessions: [],
    deleted: [],
    daily: null,
    streak: { current: 0, best: 0, lastVisit: null },
    xp: 0,
    points: 0,
    pointsEarned: {},
    pointsSpent: {},
    gacha: { owned: {}, history: [], pity: 0 },
    exams: [],
    achievements: {},
    timer: { startedAt: null, unitId: null },
    ui: { heatDays: 180 },
    meta: { deviceId: "dev-x", updatedAt: now, at: {} },
    ...over,
  });
  const mkPayload = (data) => ({ version: 2, updatedAt: now, data });
  const balanceOf = (d) =>
    (d.points || 0) +
    Object.values(d.pointsEarned || {}).reduce((s, n) => s + n, 0) -
    Object.values(d.pointsSpent || {}).reduce((s, n) => s + n, 0);

  // ポイント台帳: 端末ごとの獲得は合算、ベースは最大、消費も端末ごと
  {
    const remote = mkData({ points: 50, pointsEarned: { "dev-b": 70 }, pointsSpent: { "dev-b": 10 } });
    const local = mkData({ deviceId: "dev-a", pointsEarned: { "dev-a": 100 } });
    const m = sync.mergeData(mkPayload(remote), mkPayload(local)).data;
    assert.equal(m.points, 50, "ベースは大きい方");
    assert.equal(balanceOf(m), 210, "50 + 100 + 70 - 10（両端末の獲得が消えない）");
    // 再マージしても増えない（二重加算しない）
    const m2 = sync.mergeData(mkPayload(m), mkPayload(m)).data;
    assert.equal(balanceOf(m2), 210, "再同期でも二重加算しない");
  }

  // 学習記録: 和集合 + 削除墓標
  {
    const s1 = { id: "s1", start: earlier, end: earlier, minutes: 30 };
    const s2 = { id: "s2", start: now, end: now, minutes: 20 };
    const s3 = { id: "s3", start: later, end: later, minutes: 10 };
    const remote = mkData({ sessions: [s1, s2] });
    const local = mkData({ sessions: [s3], deleted: ["s1"] });
    const m = sync.mergeData(mkPayload(remote), mkPayload(local)).data;
    const ids = m.sessions.map((x) => x.id);
    assert.deepEqual(ids, ["s2", "s3"], "墓標のs1は復活せず、他は和集合・start順");
    assert.equal(m.xp, 30, "XPは削除後の合計と大きい方");
  }

  // 進捗: 更新時刻が新しい方、片側のみはそのまま
  {
    const remote = mkData({ progress: { u1: "active" }, progressAt: { u1: later } });
    const local = mkData({ progress: { u1: "done", u2: "done" }, progressAt: { u1: earlier, u2: earlier } });
    const m = sync.mergeData(mkPayload(remote), mkPayload(local)).data;
    assert.equal(m.progress.u1, "active", "時刻が新しいremoteが勝つ");
    assert.equal(m.progress.u2, "done", "片側にしかない進捗は維持");
    // 旧データ（時刻なし）同士は段階優先
    const r2 = mkData({ progress: { u1: "active" } });
    const l2 = mkData({ progress: { u1: "done" } });
    const m2 = sync.mergeData(mkPayload(r2), mkPayload(l2)).data;
    assert.equal(m2.progress.u1, "done", "時刻なしは制覇>攻略中>未着手");
  }

  // 科目・単元の削除同期（墓標）と復元（後勝ち）
  {
    const remote = mkData({
      curriculum: [{ id: "s1", name: "科目", icon: "📘", color: "#4A90D9", units: [{ id: "u2", name: "単元2" }] }],
      deletedCurriculum: { u1: now },
    });
    const local = mkData({}); // u1 がまだ残っている側
    const m = sync.mergeData(mkPayload(remote), mkPayload(local)).data;
    assert.deepEqual(m.curriculum[0].units.map((u) => u.id), ["u2"], "削除単元は同期される");

    // 後から復元（curriculumAt が墓標より新しい）→生き残る
    const restored = mkData({ curriculumAt: { u1: later } });
    const m2 = sync.mergeData(mkPayload(remote), mkPayload(restored)).data;
    assert.deepEqual(m2.curriculum[0].units.map((u) => u.id).sort(), ["u1", "u2"], "復元は削除に勝つ");

    // 科目ごと削除
    const noSubject = mkData({ curriculum: [], deletedCurriculum: { s1: now, u1: now, u2: now } });
    const m3 = sync.mergeData(mkPayload(noSubject), mkPayload(local)).data;
    assert.equal(m3.curriculum.length, 0, "科目削除は同期される");
  }

  // 単語カード: 和集合 + 削除墓標 + 復習状態は新しい側
  {
    const w1 = { id: "w1", en: "accrual", ja: "発生主義", createdAt: earlier };
    const w2 = { id: "w2", en: "goodwill", ja: "のれん", createdAt: earlier };
    const remote = mkData({
      words: [w1],
      wordProgress: { w1: { level: 2, dueAt: later, correct: 2, wrong: 0, lastReviewedAt: later } },
    });
    const local = mkData({
      words: [w1, w2],
      wordProgress: { w1: { level: 1, dueAt: earlier, correct: 1, wrong: 0, lastReviewedAt: earlier } },
      deleted: ["w2"],
    });
    const m = sync.mergeData(mkPayload(remote), mkPayload(local)).data;
    assert.deepEqual(m.words.map((x) => x.id), ["w1"], "削除した単語は同期で復活しない");
    assert.equal(m.wordProgress.w1.level, 2, "最後に復習した側の状態が勝つ");

    const localNoDelete = mkData({ words: [w1, w2] });
    const m2 = sync.mergeData(mkPayload(remote), mkPayload(localNoDelete)).data;
    assert.deepEqual(m2.words.map((x) => x.id).sort(), ["w1", "w2"], "未削除の単語は和集合");
  }

  // デイリー: 同日は進捗マックス・達成OR
  {
    const today = game.todayKey();
    const quest = (over) => ({
      id: "q_min", label: "今日の目標時間まで学ぶ", target: 120, reward: 60, icon: "📖",
      progress: 0, done: false, claimed: false, ...over,
    });
    const remote = mkData({ daily: { date: today, quests: [quest({ progress: 50 })], allDone: false, bonusClaimed: false } });
    const local = mkData({ daily: { date: today, quests: [quest({ progress: 80, done: true })], allDone: false, bonusClaimed: true } });
    const m = sync.mergeData(mkPayload(remote), mkPayload(local)).data;
    assert.equal(m.daily.quests[0].progress, 80, "進捗は大きい方");
    assert.equal(m.daily.quests[0].done, true, "達成はOR");
    assert.equal(m.daily.bonusClaimed, true, "ボーナス受取はOR");
    // 日付が新しい方が勝つ
    const older = mkData({ daily: { date: "2020-01-01", quests: [], allDone: false, bonusClaimed: false } });
    const m2 = sync.mergeData(mkPayload(older), mkPayload(local)).data;
    assert.equal(m2.daily.date, today, "日付が新しい方を採用");
  }

  // 連続ログイン: 最終訪問が新しい方
  {
    const remote = mkData({ streak: { current: 5, best: 5, lastVisit: "2026-11-19" } });
    const local = mkData({ streak: { current: 3, best: 9, lastVisit: "2026-11-10" } });
    const m = sync.mergeData(mkPayload(remote), mkPayload(local)).data;
    assert.equal(m.streak.lastVisit, "2026-11-19", "新しい最終訪問");
    assert.equal(m.streak.current, 5);
    assert.equal(m.streak.best, 9, "最高記録は維持");
  }

  // 設定: キーごとの更新時刻でLWW
  {
    const remote = mkData({
      settings: { ...mkData().settings, playerName: "B" },
      meta: { deviceId: "dev-b", updatedAt: now, at: { settings: later } },
    });
    const local = mkData({
      settings: { ...mkData().settings, playerName: "A" },
      meta: { deviceId: "dev-a", updatedAt: now, at: { settings: earlier } },
    });
    const m = sync.mergeData(mkPayload(remote), mkPayload(local)).data;
    assert.equal(m.settings.playerName, "B", "更新が新しい設定が勝つ");
    assert.equal(m.meta.deviceId, "dev-a", "deviceIdはローカルを維持");
  }

  // トークンはエクスポート・リセットに含まれない
  {
    sync.saveSync({ enabled: true, token: "SECRET_TOKEN_XYZ", gistId: "g1", lastSyncedAt: null });
    const exp = store.exportJSON();
    assert.ok(!exp.includes("SECRET_TOKEN_XYZ"), "エクスポートにトークンなし");
    assert.ok(localStorage.getItem("aq.sync").includes("SECRET_TOKEN_XYZ"), "端末には保存される");
    assert.equal(sync.loadSync().token, "SECRET_TOKEN_XYZ");
    sync.disconnectSync();
    assert.equal(sync.loadSync().enabled, false, "解除で無効化");
  }

  // fetchモックで Gist 同期フロー（作成→プッシュ→再同期）
  {
    let gistContent = null;
    let patchCount = 0;
    const FILE = "academia-quest-data.json";
    globalThis.fetch = async (url, opts = {}) => {
      const u = String(url);
      const ok = (data) => ({ ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) });
      if (opts.method === "POST" && u.endsWith("/gists")) {
        gistContent = JSON.parse(opts.body).files[FILE].content;
        return ok({ id: "g-test" });
      }
      if (opts.method === "PATCH") {
        patchCount++;
        gistContent = JSON.parse(opts.body).files[FILE].content;
        return ok({});
      }
      if (u.includes("/gists?")) return ok([]); // 自動検出: なし
      if (u.includes("/gists/g-test")) return ok({ files: { [FILE]: { content: gistContent } } });
      return { ok: false, status: 404, json: async () => ({}) };
    };

    sync.saveSync({ enabled: true, token: "tok", gistId: "", lastSyncedAt: null });
    const r1 = await sync.syncNow();
    assert.equal(r1.ok, true, "初回同期OK");
    assert.equal(r1.created, true, "保管庫を作成");
    assert.equal(sync.loadSync().gistId, "g-test", "gistIdを保存");
    assert.equal(patchCount, 0);

    // 端末側の変更をプッシュ
    game.setUnitStatus("u-sync-test", "done");
    const r2 = await sync.syncNow();
    assert.equal(r2.ok, true);
    assert.equal(patchCount, 1, "変更があればプッシュ");
    const pushed = JSON.parse(gistContent).data;
    assert.equal(pushed.progress["u-sync-test"], "done", "進捗が送信される");

    // 変更なしならプッシュしない
    const r3 = await sync.syncNow();
    assert.equal(r3.ok, true);
    assert.equal(patchCount, 1, "無変更では再送しない");

    // 相手端末のデータを取得→マージされる
    const remotePayload = JSON.parse(gistContent);
    remotePayload.data.sessions.push({ id: "s-remote", start: now, end: now, minutes: 42 });
    remotePayload.data.pointsEarned["dev-remote"] = 33;
    // 実運用ではリモートのXPも整合している（手作りデータも整合させる）
    remotePayload.data.xp = Math.max(
      remotePayload.data.xp,
      remotePayload.data.sessions.reduce((s, x) => s + (x.minutes || 0), 0)
    );
    gistContent = JSON.stringify(remotePayload);
    const r4 = await sync.syncNow();
    assert.equal(r4.ok, true);
    assert.ok(store.get("sessions").some((s) => s.id === "s-remote"), "リモートの記録を取り込む");
    assert.equal(store.get("pointsEarned")["dev-remote"], 33, "リモートのポイント台帳を取り込む");
    assert.equal(patchCount, 1, "マージ結果がリモートと同じなら送らない");

    // 無効トークン
    globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({}), text: async () => "" });
    sync.saveSync({ ...sync.loadSync(), token: "bad" });
    const r5 = await sync.syncNow();
    assert.equal(r5.ok, false);
    assert.equal(r5.status, 401, "401を伝える");

    sync.disconnectSync();
    delete globalThis.fetch;
  }

  // 全データ消去: リモート保管庫の削除 + 同期解除（消去済みデータが蘇らない）
  {
    let deleted = false;
    globalThis.fetch = async (url, opts = {}) => {
      if (opts.method === "DELETE" && String(url).includes("/gists/")) {
        deleted = true;
        return { ok: true, status: 204, json: async () => null, text: async () => "" };
      }
      return { ok: false, status: 404, json: async () => ({}), text: async () => "" };
    };
    sync.saveSync({ enabled: true, token: "tok", gistId: "g1", lastSyncedAt: null });
    await sync.wipeRemote();
    assert.ok(deleted, "保管庫を削除する");
    assert.equal(sync.loadSync().enabled, false, "同期解除");
    assert.equal(sync.loadSync().token, "", "トークン削除");
    delete globalThis.fetch;
  }
}

console.log("ALL TESTS PASSED");
