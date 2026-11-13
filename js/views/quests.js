import { store } from "../store.js";
import * as game from "../game.js";

const STATUS_CYCLE = { todo: "active", active: "done", done: "todo" };
const STATUS_MARK = { todo: "", active: "…", done: "✓" };

let filter = "all";
const openSubjects = new Set(); // 開いている科目（既定は全開）

export function render(root) {
  const curriculum = game.ensureCurriculum();
  const progress = store.get("progress");
  const overall = game.overallStats();

  if (openSubjects.size === 0) curriculum.forEach((s) => openSubjects.add(s.id));

  const visibleSubjects = curriculum.map((s) => {
    const stats = game.subjectStats(s, progress);
    let units = s.units;
    if (filter === "todo") units = units.filter((u) => !progress[u.id] || progress[u.id] === "todo");
    if (filter === "active") units = units.filter((u) => progress[u.id] === "active");
    if (filter === "done") units = units.filter((u) => progress[u.id] === "done");
    return { s, stats, units };
  });

  root.innerHTML = `
    <div class="section-head">
      <h2>クエストボード</h2>
      <span class="hint">全体 ${overall.done}/${totalLabel(overall)} 制覇</span>
    </div>

    <div class="gauge" style="--gauge-color:#c9a96a;margin-bottom:14px"><i style="width:${(overall.ratio * 100).toFixed(1)}%"></i></div>

    <div class="chips">
      ${[
        ["all", "すべて"],
        ["todo", "未着手"],
        ["active", "攻略中"],
        ["done", "制覇済"],
      ]
        .map(([id, label]) => `<button class="chip ${filter === id ? "active" : ""}" data-filter="${id}">${label}</button>`)
        .join("")}
    </div>

    <div style="display:grid;gap:14px">
      ${visibleSubjects
        .map(({ s, stats, units }) => {
          const open = openSubjects.has(s.id);
          return `
          <section class="panel subject-card">
            <div class="subject-head" data-toggle-subject="${s.id}" role="button" tabindex="0">
              <span class="s-icon" style="--s-color:${s.color}">${s.icon}</span>
              <div class="s-main">
                <div class="s-name">${s.name}</div>
                <div class="s-count">制覇 ${stats.done} / ${stats.total} ・ 攻略中 ${stats.active}</div>
                <div class="gauge slim" style="--gauge-color:${s.color};margin-top:5px"><i style="width:${(stats.ratio * 100).toFixed(1)}%"></i></div>
              </div>
              <button class="s-toggle" aria-label="開閉">${open ? "▲" : "▼"}</button>
            </div>
            ${
              open
                ? units.length
                  ? `<ul class="unit-list">
                      ${units
                        .map((u) => {
                          const st = progress[u.id] || "todo";
                          return `
                          <li class="unit-row st-${st}">
                            <button class="unit-status" data-cycle="${u.id}" title="クリックで状態を切り替え">${STATUS_MARK[st]}</button>
                            <span class="unit-name">${u.name}</span>
                            <button class="unit-timer" data-timer-unit="${u.id}" title="この単元でタイマー開始">⏱</button>
                          </li>`;
                        })
                        .join("")}
                    </ul>`
                  : `<div class="empty">この条件の単元はありません</div>`
                : ""
            }
          </section>`;
        })
        .join("")}
    </div>
  `;
}

function totalLabel(overall) {
  return overall.total;
}

export function onAction(action, app, dataset) {
  if (action === "toggle-subject") {
    const id = dataset.toggleSubject;
    if (openSubjects.has(id)) openSubjects.delete(id);
    else openSubjects.add(id);
    app.refresh();
    return;
  }
  if (action === "filter") {
    filter = dataset.filter;
    app.refresh();
    return;
  }
  if (action === "cycle") {
    const unitId = dataset.cycle;
    const progress = store.get("progress");
    const next = STATUS_CYCLE[progress[unitId] || "todo"];
    const newAch = game.setUnitStatus(unitId, next);
    const labels = { todo: "未着手", active: "攻略中", done: "制覇！" };
    app.toast(`🚩 ${labels[next]}`);
    for (const a of newAch) app.toastAchievement(a);
    app.refresh();
    return;
  }
  if (action === "timer-unit") {
    const unitId = dataset.timerUnit;
    if (game.timerState().startedAt) {
      app.toast("既にタイマーが動いています");
      return;
    }
    game.startTimer(unitId);
    app.toast("⏱️ タイマー開始！ホームで記録しよう");
    app.refresh();
  }
}
