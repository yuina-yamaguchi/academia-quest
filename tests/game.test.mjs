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
assert.equal(store.get("points"), 100);

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
assert.equal(curriculum.length, 5, "科目5つ");
const unitId = curriculum[0].units[0].id;
const newAch = game.setUnitStatus(unitId, "done");
assert.ok(newAch.some((a) => a.code === "first_session") || store.get("sessions").length >= 1);

// 手入力セッションで目標時間クエスト
game.addSession({ minutes: 200, manual: true });
const d2 = store.get("daily");
const qMin = d2.quests.find((q) => q.id === "q_min");
assert.equal(qMin.done, true, "目標時間クエスト達成");

// ランク
const rank = game.rankInfo(store.get("xp"));
assert.ok(rank.rank >= 1 && rank.need > 0);

// ガチャ: ポイントが十分なら10連
const pts = store.get("points");
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

console.log("ALL TESTS PASSED");
