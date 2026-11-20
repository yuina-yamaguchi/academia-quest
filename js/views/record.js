import { store } from "../store.js";
import * as game from "../game.js";

function unitName(unitId) {
  if (!unitId) return "自由学習";
  for (const s of game.ensureCurriculum()) {
    const u = s.units.find((x) => x.id === unitId);
    if (u) return `${s.icon} ${u.name}`;
  }
  return "自由学習";
}

function heatLevel(minutes) {
  if (minutes <= 0) return 0;
  if (minutes < 30) return 1;
  if (minutes < 60) return 2;
  if (minutes < 120) return 3;
  return 4;
}

function fmtDuration(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}<small>分</small>`;
  return m ? `${h}<small>時間</small>${m}<small>分</small>` : `${h}<small>時間</small>`;
}

export function render(root) {
  const sessions = [...store.get("sessions")].reverse();
  const weekly = game.weeklyMinutes();
  const heat = game.heatmapDays(180);
  const maxWeek = Math.max(30, ...weekly.map((w) => w.minutes));
  const totalMin = sessions.reduce((s, x) => s + x.minutes, 0);
  const todayMin = weekly[weekly.length - 1].minutes;
  const streak = store.get("streak");
  const exams = [...store.get("exams")].sort((a, b) => b.date.localeCompare(a.date));
  const curriculum = game.ensureCurriculum();

  root.innerHTML = `
    <div class="section-head"><h2>学習記録</h2><span class="hint">今日の戦果を振り返ろう</span></div>

    <div class="stat-cards" style="margin-bottom:14px">
      <div class="stat-card"><div class="num">${todayMin}<small>分</small></div><div class="cap">今日</div></div>
      <div class="stat-card"><div class="num">${fmtDuration(totalMin)}</div><div class="cap">累計学習時間</div></div>
      <div class="stat-card"><div class="num">${streak.current || 0}<small>日</small></div><div class="cap">連続記録（最高 ${streak.best || 0}）</div></div>
      <div class="stat-card"><div class="num">${sessions.length}<small>回</small></div><div class="cap">クエスト回数</div></div>
    </div>

    <section class="panel">
      <div class="panel-title">📊 週間学習時間</div>
      <div class="bars">
        ${weekly
          .map(
            (w) => `
          <div class="bar-col ${w.date === game.todayKey() ? "today" : ""}">
            <span class="bar-val">${w.minutes || ""}</span>
            <div class="bar" style="height:${Math.max(3, (w.minutes / maxWeek) * 100)}%"></div>
            <span class="bar-day">${w.label}</span>
          </div>`
          )
          .join("")}
      </div>
    </section>

    <section class="panel">
      <div class="panel-title">🗓️ 学習カレンダー <span class="sub">直近180日</span></div>
      <div class="heatmap">
        ${heat.map((h) => `<span class="heat-cell l${heatLevel(h.minutes)}" title="${h.date}: ${h.minutes}分"></span>`).join("")}
      </div>
      <div class="heat-legend">
        少
        <span class="heat-cell"></span><span class="heat-cell l1"></span><span class="heat-cell l2"></span><span class="heat-cell l3"></span><span class="heat-cell l4"></span>
        多
      </div>
    </section>

    <section class="panel">
      <div class="panel-title">✍️ 記録を手入力</div>
      <form id="manual-form" class="form-grid">
        <div class="field">
          <label>学習した単元</label>
          <select name="unitId">
            <option value="">自由学習（単元なし）</option>
            ${curriculum
              .map(
                (s) =>
                  `<optgroup label="${s.name}">${s.units.map((u) => `<option value="${u.id}">${u.name}</option>`).join("")}</optgroup>`
              )
              .join("")}
          </select>
        </div>
        <div class="field">
          <label>時間</label>
          <div class="row2">
            <input type="number" name="minutes" min="1" max="1440" placeholder="分" required />
            <button class="btn" type="submit">追加</button>
          </div>
        </div>
      </form>
    </section>

    <section class="panel">
      <div class="panel-title">📝 模試・問題集の記録</div>
      <form id="exam-form" class="form-grid" style="margin-bottom:12px">
        <div class="field">
          <label>名前</label>
          <input name="name" placeholder="例: 第3回公開模試" required />
        </div>
        <div class="field">
          <label>得点（科目ごと）</label>
          <div id="exam-scores" style="display:grid;gap:6px">
            ${curriculum
              .map(
                (s) => `
              <div class="ue-row" style="display:flex;gap:6px;align-items:center">
                <span style="width:100px;font-size:13px;font-weight:700">${s.name}</span>
                <input style="flex:1;min-width:0;border:1.5px solid var(--panel-border);border-radius:8px;padding:6px 8px" type="number" min="0" step="0.5" data-sub="${s.id}" data-role="got" placeholder="得点" />
                <span style="color:var(--muted)">/</span>
                <input style="width:76px;border:1.5px solid var(--panel-border);border-radius:8px;padding:6px 8px" type="number" min="0" step="0.5" data-sub="${s.id}" data-role="max" placeholder="配点" />
              </div>`
              )
              .join("")}
          </div>
        </div>
        <div class="field">
          <label>日付</label>
          <input type="date" name="date" value="${game.todayKey()}" required />
        </div>
        <button class="btn btn-primary" type="submit">模試を記録</button>
      </form>

      ${
        exams.length
          ? exams
              .map((e) => {
                const t = game.examTotal(e);
                const ratio = game.examRatio(e);
                const pct = Math.round(ratio * 100);
                return `
                <div class="exam-item">
                  <div class="exam-head">
                    <span>📅 ${e.date}</span>
                    <span>${e.name}</span>
                    <span class="ratio ${ratio >= 0.7 ? "pass" : "fail"}">${t.got}/${t.max}（${pct}%）</span>
                    <button class="log-del" data-del-exam="${e.id}" title="削除">🗑</button>
                  </div>
                  <div class="gauge slim" style="--gauge-color:${ratio >= 0.7 ? "#4caf7d" : "#e8a13c"}"><i style="width:${pct}%"></i></div>
                  <div class="exam-subscores">
                    ${e.items.map((i) => `<span class="exam-sub">${i.label}: <b>${i.got}</b>/${i.max}</span>`).join("")}
                  </div>
                </div>`;
              })
              .join("")
          : `<div class="empty">まだ記録がありません</div>`
      }
    </section>

    <section class="panel">
      <div class="panel-title">🗒️ 学習ログ <span class="sub">最新50件</span></div>
      ${
        sessions.length
          ? `<ul class="log-list">
              ${sessions
                .slice(0, 50)
                .map((s) => {
                  const d = new Date(s.start);
                  const when = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                  return `
                  <li class="log-item">
                    <span class="log-when">${when}</span>
                    <span class="log-min">${s.minutes}分</span>
                    <span class="log-what">${s.source === "words" ? "📇 単語カード" : `${unitName(s.unitId)}${s.manual ? "（手入力）" : ""}`}</span>
                    <button class="log-del" data-del-session="${s.id}" title="削除">🗑</button>
                  </li>`;
                })
                .join("")}
            </ul>`
          : `<div class="empty">まだ学習記録がありません。<br/>ホームのタイマーで最初のクエストを始めよう！</div>`
      }
    </section>
  `;
}

export function onAction(action, app, dataset) {
  if (action === "del-session") {
    const sessions = store.get("sessions").filter((s) => s.id !== dataset.delSession);
    store.set("sessions", sessions);
    game.buryId(dataset.delSession);
    app.toast("記録を削除しました");
    app.refresh();
  }
  if (action === "del-exam") {
    const exams = store.get("exams").filter((e) => e.id !== dataset.delExam);
    store.set("exams", exams);
    game.buryId(dataset.delExam);
    app.toast("模試を削除しました");
    app.refresh();
  }
}

export function onSubmit(form, app) {
  if (form.id === "manual-form") {
    const fd = new FormData(form);
    const minutes = Number(fd.get("minutes"));
    const unitId = fd.get("unitId") || null;
    if (!minutes || minutes < 1) return;
    let subjectId = null;
    if (unitId) {
      for (const s of game.ensureCurriculum()) {
        if (s.units.some((u) => u.id === unitId)) subjectId = s.id;
      }
    }
    const { newAch } = game.addSession({ minutes, unitId, subjectId, manual: true });
    app.toast(`📖 ${minutes}分の学習を記録しました`);
    for (const a of newAch) app.toastAchievement(a);
    app.refresh();
    return;
  }

  if (form.id === "exam-form") {
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    const date = String(fd.get("date") || game.todayKey());
    if (!name) return;
    const items = [];
    form.querySelectorAll("[data-sub]").forEach((input) => {
      const role = input.dataset.role;
      const subId = input.dataset.sub;
      if (role !== "got") return;
      const got = Number(input.value);
      if (input.value === "" || Number.isNaN(got)) return;
      const maxInput = form.querySelector(`[data-sub="${subId}"][data-role="max"]`);
      const max = maxInput?.value === "" || !maxInput ? 100 : Number(maxInput.value);
      const subject = game.ensureCurriculum().find((s) => s.id === subId);
      items.push({ label: subject ? subject.name : subId, got, max });
    });
    if (!items.length) {
      app.toast("得点を入力してください");
      return;
    }
    const exams = store.get("exams");
    exams.push({ id: `e-${Date.now()}`, name, date, items });
    store.set("exams", exams);
    const newAch = game.checkAchievements();
    app.toast("📝 模試を記録しました");
    for (const a of newAch) app.toastAchievement(a);
    app.refresh();
  }
}
