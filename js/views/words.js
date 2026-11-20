import { store } from "../store.js";
import * as game from "../game.js";

// セッション状態（画面再描画をまたいで維持）
// { queue: wordId[], idx, flipped, results: bool[], done, earned }
let session = null;

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function levelDots(level) {
  let out = '<span class="lv" title="定着度">';
  for (let i = 0; i < 5; i++) out += `<i class="${i < level ? "on" : ""}"></i>`;
  return out + "</span>";
}

function cardMarkup(words, queue, idx, flipped) {
  const word = words.find((w) => w.id === queue[idx]);
  if (!word) return "";
  return `
    <div class="word-progress-bar">
      <span>${idx + 1} / ${queue.length}</span>
      <div class="gauge slim" style="--gauge-color:#c9a96a"><i style="width:${((idx) / queue.length) * 100}%"></i></div>
    </div>
    <div class="word-card ${flipped ? "flipped" : ""}" data-action="word-flip" role="button" tabindex="0">
      <div class="wc-en">${esc(word.en)}</div>
      ${flipped ? `<div class="wc-ja">${esc(word.ja)}</div>` : `<div class="wc-hint">タップして意味を見る</div>`}
    </div>
    ${
      flipped
        ? `<div class="word-actions">
             <button class="btn btn-known" data-action="word-known">覚えた ○</button>
             <button class="btn btn-forgot" data-action="word-forgot">忘れた ×</button>
           </div>`
        : ""
    }`;
}

function summaryMarkup(session) {
  const known = session.results.filter(Boolean).length;
  const total = session.results.length;
  return `
    <div class="word-card done" style="cursor:default">
      <div class="wc-en" style="font-size:26px">🎉 復習完了</div>
      <div class="wc-ja">${total}問中 ${known}問 覚えた</div>
      <div class="wc-hint">学習時間 ${session.earned}分として記録しました</div>
    </div>
    <div class="word-actions">
      <button class="btn btn-primary" data-action="word-done">OK</button>
    </div>`;
}

export function render(root) {
  const words = store.get("words");
  const progress = store.get("wordProgress");
  const stats = game.wordStats();

  let stage;
  if (session && session.done) {
    stage = summaryMarkup(session);
  } else if (session) {
    stage = cardMarkup(words, session.queue, session.idx, session.flipped) + `
      <div style="text-align:center">
        <button class="btn btn-ghost btn-sm" data-action="word-abort">中断する</button>
      </div>`;
  } else {
    stage = `
      <div class="word-card idle" style="cursor:default">
        <div class="wc-en" style="font-size:30px">📇 ${stats.total}枚</div>
        <div class="wc-hint">今日の復習: ${stats.due}枚期限 / ${stats.total - stats.due}枚はまだ先</div>
      </div>
      <div class="word-actions">
        <button class="btn btn-primary" data-action="word-start" ${stats.total ? "" : "disabled"}>復習を始める</button>
      </div>
      ${stats.total ? "" : `<div class="hint" style="text-align:center">まずは下のフォームで単語を登録しよう</div>`}`;
  }

  root.innerHTML = `
    <div class="section-head"><h2>英単語カード</h2><span class="hint">タップで裏返して暗記</span></div>

    <section class="panel">
      <div class="panel-title">📇 復習セッション <span class="sub">登録 ${stats.total} ・ 学習済 ${stats.learned}</span></div>
      <div class="word-stage">${stage}</div>
    </section>

    <section class="panel">
      <div class="panel-title">➕ 単語を追加</div>
      <div class="form-grid">
        <div class="field">
          <label>英語</label>
          <input id="word-en" placeholder="例: accrual" autocomplete="off" />
        </div>
        <div class="field">
          <label>日本語の意味</label>
          <input id="word-ja" placeholder="例: 発生主義" autocomplete="off" />
        </div>
        <button class="btn" data-action="word-add">追加</button>
      </div>
    </section>

    <section class="panel">
      <div class="panel-title">📚 単語一覧 <span class="sub">${words.length}枚</span></div>
      ${
        words.length
          ? `<div class="word-list">
              ${words
                .map(
                  (w) => `
              <div class="word-row">
                <input class="w-en" data-word-en="${w.id}" value="${esc(w.en)}" />
                <input class="w-ja" data-word-ja="${w.id}" value="${esc(w.ja)}" />
                ${levelDots(progress[w.id]?.level || 0)}
                <button class="btn btn-sm btn-ghost" data-del-word="${w.id}" title="削除">🗑</button>
              </div>`
                )
                .join("")}
            </div>`
          : `<div class="empty">まだ単語がありません</div>`
      }
    </section>
  `;
}

function finishSession(app) {
  const reviewed = session.results.length;
  if (reviewed > 0) {
    const minutes = Math.max(1, Math.ceil(reviewed / 5));
    const { newAch } = game.addSession({ minutes, manual: true, source: "words" });
    session.earned = minutes;
    app.toast(`📇 ${reviewed}問の復習を記録 +${minutes}XP✨`);
    for (const a of newAch) app.toastAchievement(a);
  } else {
    session.earned = 0;
  }
  session.done = true;
}

export function onAction(action, app, dataset) {
  if (action === "word-start") {
    const queue = game.buildWordQueue();
    if (!queue.length) {
      app.toast("復習できる単語がありません");
      return;
    }
    session = { queue, idx: 0, flipped: false, results: [], done: false, earned: 0 };
    app.refresh();
    return;
  }

  if (action === "word-flip") {
    if (session && !session.done) {
      session.flipped = true;
      app.refresh();
    }
    return;
  }

  if (action === "word-known" || action === "word-forgot") {
    if (!session || session.done) return;
    const id = session.queue[session.idx];
    const known = action === "word-known";
    game.reviewWord(id, known);
    session.results.push(known);
    session.idx += 1;
    session.flipped = false;
    if (session.idx >= session.queue.length) finishSession(app);
    app.refresh();
    return;
  }

  if (action === "word-abort") {
    session = null;
    app.refresh();
    return;
  }

  if (action === "word-done") {
    session = null;
    app.refresh();
    return;
  }

  if (action === "word-add") {
    const en = document.getElementById("word-en")?.value || "";
    const ja = document.getElementById("word-ja")?.value || "";
    const word = game.addWord(en, ja);
    if (!word) {
      app.toast("英語と意味の両方を入力してください（英語の重複も不可）");
      return;
    }
    app.toast(`📇 「${word.en}」を追加しました`);
    app.refresh();
    return;
  }

  if (dataset.delWord) {
    if (!confirm("この単語を削除しますか？")) return;
    game.deleteWord(dataset.delWord);
    if (session && !session.done) {
      session.queue = session.queue.filter((x) => x !== dataset.delWord);
      if (session.idx >= session.queue.length) {
        if (session.results.length) finishSession(app);
        else session = null;
      }
    }
    app.toast("単語を削除しました");
    app.refresh();
    return;
  }
}

export function onInput(e, app, dataset) {
  if ("wordEn" in dataset) {
    game.updateWord(dataset.wordEn, { en: e.target.value });
    return;
  }
  if ("wordJa" in dataset) {
    game.updateWord(dataset.wordJa, { ja: e.target.value });
  }
}
