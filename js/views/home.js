import { store } from "../store.js";
import * as game from "../game.js";

function fmtHm(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分`;
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}

function unitLabel(unitId) {
  if (!unitId) return "単元未指定で記録中";
  for (const s of game.ensureCurriculum()) {
    const u = s.units.find((x) => x.id === unitId);
    if (u) return `${s.name} — ${u.name}`;
  }
  return "単元未指定で記録中";
}

function unitOptions(selected) {
  const curriculum = game.ensureCurriculum();
  const progress = store.get("progress");
  const rows = ['<option value="">単元を選択（任意）</option>'];
  for (const s of curriculum) {
    rows.push(`<optgroup label="${s.name}">`);
    for (const u of s.units) {
      const mark = progress[u.id] === "done" ? "✓ " : "";
      const sel = u.id === selected ? " selected" : "";
      rows.push(`<option value="${u.id}"${sel}>${mark}${u.name}</option>`);
    }
    rows.push("</optgroup>");
  }
  return rows.join("");
}

function timerMarkup(t) {
  const running = !!t.startedAt;
  const elapsed = running ? Date.now() - t.startedAt : 0;
  const hh = String(Math.floor(elapsed / 3600000)).padStart(2, "0");
  const mm = String(Math.floor((elapsed % 3600000) / 60000)).padStart(2, "0");
  const ss = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, "0");
  return `
    <div class="timer-box ${running ? "timer-running" : ""}">
      <div class="timer-display" id="timer-display">${hh}:${mm}:${ss}</div>
      <div class="timer-unit">${running ? unitLabel(t.unitId) : "タイマーを押して学習を開始"}</div>
      ${
        running
          ? `<div class="timer-actions">
               <button class="btn btn-danger btn-lg" data-action="timer-stop">⏹ 記録して終了</button>
             </div>`
          : `<div class="timer-actions">
               <div class="field" style="text-align:left;width:min(320px,100%)">
                 <select id="timer-unit">${unitOptions("")}</select>
               </div>
               <button class="btn btn-primary btn-lg" data-action="timer-start">▶ 学習を開始</button>
             </div>`
      }
    </div>`;
}

export function render(root) {
  const settings = store.get("settings");
  const streak = store.get("streak");
  const xp = store.get("xp");
  const rank = game.rankInfo(xp);
  const countdown = game.examCountdown();
  const daily = game.dailySummary();
  const timer = game.timerState();
  const curriculum = game.ensureCurriculum();
  const progress = store.get("progress");
  const overall = game.overallStats();

  const todayMin = store
    .get("sessions")
    .filter((s) => game.todayKey(new Date(s.start)) === game.todayKey())
    .reduce((sum, s) => sum + s.minutes, 0);

  const companionId = settings.companion || "";
  const companion = companionId
    ? game.GACHA_ITEMS.find((i) => i.id === companionId)
    : null;

  // 今日最も進んでいる科目のゲージを1つ表示用に取得
  const subjectCards = curriculum
    .map((s) => ({ s, stats: game.subjectStats(s, progress) }))
    .sort((a, b) => b.stats.ratio - a.stats.ratio)
    .slice(0, 3);

  root.innerHTML = `
    <div class="home-grid">
      <section class="panel countdown span2">
        <div class="panel-title">📅 試験日まで</div>
        ${
          countdown
            ? `<div class="days">${countdown.days}<small>日</small></div>
               <div class="label">${countdown.past ? "試験日を過ぎています" : "残り日数"}</div>
               <div class="exam-name">${settings.examLabel || "公認会計士試験"}（${countdown.examDate}）</div>`
            : `<div class="days">--<small>日</small></div>
               <div class="label">試験日が未設定です</div>
               <div style="margin-top:10px"><button class="btn" data-nav="profile">プロフィールで設定</button></div>`
        }
      </section>

      <section class="panel">
        <div class="panel-title">⚜️ 冒険ランク <span class="sub">XP ${xp.toLocaleString()}</span></div>
        <div class="rank-row">
          <div class="rank-badge">Lv.${rank.rank}</div>
          <div class="rank-main">
            <div class="rank-name">学習ランク ${rank.rank}</div>
            <div class="gauge-label"><span>次のランクまで</span><b>${rank.into} / ${rank.need}</b></div>
            <div class="gauge" style="--gauge-color:#c9a96a"><i style="width:${(rank.ratio * 100).toFixed(1)}%"></i></div>
          </div>
        </div>
        <div class="stat-cards" style="margin-top:12px">
          <div class="stat-card"><div class="num">${streak.current || 0}<small>日</small></div><div class="cap">連続ログイン</div></div>
          <div class="stat-card"><div class="num">${todayMin}<small>分</small></div><div class="cap">今日の学習</div></div>
          <div class="stat-card"><div class="num">${Math.round(overall.ratio * 100)}<small>%</small></div><div class="cap">全体進捗</div></div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">⏱️ 学習タイマー</div>
        ${timerMarkup(timer)}
      </section>

      <section class="panel">
        <div class="panel-title">📜 デイリークエスト
          <span class="sub">${daily.doneCount}/${daily.total} ・ +${daily.earnedToday}✨</span>
        </div>
        <ul class="quest-list">
          ${daily.daily.quests
            .map(
              (q) => `
            <li class="quest-item ${q.done ? "done" : ""}">
              <span class="q-icon">${q.done ? "✅" : q.icon}</span>
              <div class="q-body">
                <div class="q-label">${q.label}</div>
                <div class="q-progress">${q.id === "q_min" ? `今日 ${todayMin} / ${q.target} 分` : `${q.progress} / ${q.target}`}</div>
                <div class="gauge slim" style="--gauge-color:${q.done ? "#4caf7d" : "#c9a96a"}"><i style="width:${Math.min(100, (q.progress / q.target) * 100)}%"></i></div>
              </div>
              <span class="q-reward">+${q.reward}✨</span>
            </li>`
            )
            .join("")}
        </ul>
        ${
          daily.daily.allDone
            ? `<div class="hint" style="text-align:center;margin-top:8px;color:#4caf7d;font-weight:700">🎉 すべて達成！ボーナス+100✨</div>`
            : `<div class="hint" style="text-align:center;margin-top:8px">デイリーは翌 AM4:00 にリセット</div>`
        }
      </section>

      <section class="panel">
        <div class="panel-title">🏰 進捗の街区</div>
        ${
          companion
            ? `<div class="companion-row"><span class="companion-face">${companion.icon}</span><span class="hint">${companion.name}が見守っています</span></div>`
            : `<div class="hint" style="text-align:center">お宝ガチャで仲間を手に入れよう</div>`
        }
        <div style="display:grid;gap:10px;margin-top:8px">
          ${subjectCards
            .map(
              ({ s, stats }) => `
            <div>
              <div class="gauge-label"><span>${s.icon} ${s.name}</span><b>${stats.done}/${stats.total}</b></div>
              <div class="gauge" style="--gauge-color:${s.color}"><i style="width:${(stats.ratio * 100).toFixed(1)}%"></i></div>
            </div>`
            )
            .join("")}
        </div>
        <div style="margin-top:12px;text-align:center">
          <button class="btn" data-nav="quests">クエストボードへ →</button>
        </div>
      </section>
    </div>
  `;

  // タイマー表示の毎秒更新
  const display = root.querySelector("#timer-display");
  if (display && timer.startedAt) {
    const tick = () => {
      if (!document.body.contains(display)) return;
      const t = store.get("timer");
      if (!t.startedAt) return;
      const e = Date.now() - t.startedAt;
      const hh = String(Math.floor(e / 3600000)).padStart(2, "0");
      const mm = String(Math.floor((e % 3600000) / 60000)).padStart(2, "0");
      const ss = String(Math.floor((e % 60000) / 1000)).padStart(2, "0");
      display.textContent = `${hh}:${mm}:${ss}`;
      setTimeout(tick, 1000);
    };
    setTimeout(tick, 1000);
  }
}

export function onAction(action, app) {
  if (action === "timer-start") {
    const select = document.getElementById("timer-unit");
    game.startTimer(select?.value || null);
    app.toast("⚔️ クエスト開始！集中していこう");
    app.refresh();
  }
  if (action === "timer-stop") {
    const result = game.stopTimer();
    if (result) {
      const { session, newAch } = result;
      app.toast(`🏆 ${session.minutes}分の学習を記録 +${session.minutes}XP✨`);
      for (const a of newAch) app.toastAchievement(a);
      app.refresh();
    }
  }
}
