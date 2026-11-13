import { store } from "../store.js";
import * as game from "../game.js";
import { SEED_SUBJECTS } from "../seed.js";

export function render(root) {
  const settings = store.get("settings");
  const streak = store.get("streak");
  const rank = game.rankInfo();
  const totalMin = game.totalMinutes();
  const unlocked = store.get("achievements");
  const gacha = store.get("gacha");
  const curriculum = game.ensureCurriculum();
  const progress = store.get("progress");

  const companion = game.GACHA_ITEMS.find((i) => i.id === settings.companion && i.type === "companion");
  const titleItem = game.GACHA_ITEMS.find((i) => i.id === settings.title && i.type === "title");
  const avatarItem = game.GACHA_ITEMS.find((i) => i.id === settings.avatar && i.type === "avatar");
  const bgItem = game.GACHA_ITEMS.find((i) => i.id === settings.background && i.type === "background");
  const frameItem = game.GACHA_ITEMS.find((i) => i.id === settings.frame && i.type === "frame");

  const frameStyle = frameItem
    ? `border-width:3px;border-color:var(--r${frameItem.rarity});box-shadow:0 0 14px ${
        frameItem.rarity === 5 ? "rgba(232,184,75,0.45)" : frameItem.rarity === 4 ? "rgba(169,123,224,0.45)" : "rgba(90,155,232,0.4)"
      };`
    : "";
  // 背景: 可読性のため暗いスクリムを重ねる
  const bgStyle = bgItem ? `background:linear-gradient(rgba(18,22,42,0.5),rgba(18,22,42,0.62)),${bgItem.bg};` : "";

  const avatarHtml = avatarItem ? game.itemArt(avatarItem) : companion ? companion.icon : "⚜️";

  const ownedTitles = game.GACHA_ITEMS.filter((i) => i.type === "title" && gacha.owned[i.id]);
  const ownedCompanions = game.GACHA_ITEMS.filter((i) => i.type === "companion" && gacha.owned[i.id]);

  const achCount = Object.keys(unlocked).length;

  root.innerHTML = `
    <div class="section-head"><h2>プロフィール</h2><span class="hint">ギルドカード</span></div>

    <section class="panel guild-card" style="${frameStyle}${bgStyle}">
      <div class="gc-top">
        <div class="gc-avatar ${avatarItem ? "has-art" : ""}">${avatarHtml}</div>
        <div>
          <div class="gc-name">${escapeHtml(settings.playerName || "挑戦者")}</div>
          <div class="gc-title">${titleItem ? `${titleItem.icon} ${titleItem.name}` : "（称号未装備）"}</div>
          <div class="gc-rank">冒険ランク ${rank.rank} ・ 連続 ${streak.current || 0}日（最高 ${streak.best || 0}）</div>
        </div>
      </div>
      <div class="gc-stats">
        <div><div class="s-num">${Math.round(totalMin / 60)}</div><div class="s-cap">累計時間</div></div>
        <div><div class="s-num">${store.get("xp").toLocaleString()}</div><div class="s-cap">XP</div></div>
        <div><div class="s-num">${store.get("points").toLocaleString()}</div><div class="s-cap">ポイント</div></div>
        <div><div class="s-num">${achCount}/${game.ACHIEVEMENTS.length}</div><div class="s-cap">実績</div></div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-title">🏅 実績 <span class="sub">${achCount} / ${game.ACHIEVEMENTS.length}</span></div>
      <div class="ach-grid">
        ${game.ACHIEVEMENTS.map((a) => {
          const at = unlocked[a.code];
          return `
          <div class="ach-item ${at ? "got" : "locked"}">
            <span class="a-ico">${a.icon}</span>
            <div>
              <div class="a-nm">${a.name}</div>
              <div class="a-ds">${at ? `解除: ${new Date(at).toLocaleDateString("ja-JP")}` : a.desc}</div>
            </div>
          </div>`;
        }).join("")}
      </div>
    </section>

    <section class="panel">
      <div class="panel-title">⚙️ 設定</div>
      <div class="form-grid">
        <div class="field">
          <label>プレイヤー名</label>
          <input id="set-name" value="${escapeAttr(settings.playerName || "")}" placeholder="挑戦者" />
        </div>
        <div class="field">
          <label>試験日</label>
          <input id="set-exam-date" type="date" value="${settings.examDate || ""}" />
          <span class="hint">短答式・論文式の日程を設定するとカウントダウン表示されます</span>
        </div>
        <div class="field">
          <label>試験のラベル（任意）</label>
          <input id="set-exam-label" value="${escapeAttr(settings.examLabel || "")}" placeholder="例: 第1回短答式試験" />
        </div>
        <div class="field">
          <label>1日の学習目標（分）</label>
          <input id="set-goal" type="number" min="10" max="720" step="10" value="${settings.dailyGoalMin || 120}" />
          <span class="hint">デイリークエスト「目標時間まで学ぶ」の対象になります</span>
        </div>
        ${
          ownedTitles.length || ownedCompanions.length
            ? `<div class="field">
                <label>称号</label>
                <select id="set-title">
                  <option value="">（なし）</option>
                  ${ownedTitles.map((t) => `<option value="${t.id}" ${settings.title === t.id ? "selected" : ""}>${t.icon} ${t.name}</option>`).join("")}
                </select>
              </div>`
            : ""
        }
        <button class="btn btn-primary" data-action="save-settings">保存</button>
      </div>
    </section>

    <section class="panel">
      <div class="panel-title">🗂️ 単元の編集 <span class="sub">${curriculum.length}科目・全${Object.keys(progress).length ? game.allUnits(curriculum).length : game.allUnits(curriculum).length}単元</span></div>
      <div class="form-grid">
        ${curriculum
          .map(
            (s, si) => `
          <details ${si === 0 ? "open" : ""}>
            <summary style="font-weight:700;color:var(--navy);cursor:pointer;padding:6px 0">${s.icon} ${s.name}（${s.units.length}単元）</summary>
            <div class="unit-editor" style="margin-top:8px">
              ${s.units
                .map(
                  (u, ui) => `
                <div class="ue-row">
                  <input data-rename-unit="${u.id}" data-subject="${s.id}" data-index="${ui}" value="${escapeAttr(u.name)}" />
                  <button class="btn btn-sm btn-ghost" data-del-unit="${u.id}" data-subject="${s.id}">削除</button>
                </div>`
                )
                .join("")}
              <div class="ue-row">
                <input data-new-unit="${s.id}" placeholder="+ 新しい単元を追加" />
                <button class="btn btn-sm" data-add-unit="${s.id}">追加</button>
              </div>
              <button class="btn btn-sm btn-ghost" data-del-subject="${s.id}" style="justify-self:start;color:var(--danger)">科目ごと削除</button>
            </div>
          </details>`
          )
          .join("")}
        <div class="ue-row">
          <input id="new-subject-name" placeholder="+ 新しい科目を追加" />
          <button class="btn btn-sm" data-action="add-subject">追加</button>
        </div>
        <button class="btn btn-sm" data-action="restore-seed">標準カリキュラムに戻す</button>
      </div>
    </section>

    <section class="panel">
      <div class="panel-title">💾 データのバックアップ</div>
      <p class="hint" style="margin-top:0">
        データはこのブラウザに保存されています。別の端末へ移す、または消去に備えてJSONで書き出してください。
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" data-action="export">書き出し（JSON）</button>
        <button class="btn" data-action="import">読み込み</button>
        <input type="file" id="import-file" accept="application/json" hidden />
      </div>
    </section>

    <section class="panel danger-zone">
      <div class="panel-title">⚠️ 全データを消去</div>
      <p class="hint" style="margin-top:0">進捗・記録・実績・お宝がすべて初期状態に戻ります。</p>
      <button class="btn btn-danger" data-action="reset-all">消去する</button>
    </section>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function escapeAttr(s) {
  return escapeHtml(s);
}

export function onAction(action, app, dataset) {
  if (action === "save-settings") {
    const settings = store.get("settings");
    settings.playerName = document.getElementById("set-name").value.trim() || "挑戦者";
    settings.examDate = document.getElementById("set-exam-date").value || null;
    settings.examLabel = document.getElementById("set-exam-label").value.trim();
    const goal = Number(document.getElementById("set-goal").value);
    if (goal >= 10) settings.dailyGoalMin = goal;
    const titleSel = document.getElementById("set-title");
    if (titleSel) settings.title = titleSel.value;
    store.set("settings", settings);
    app.toast("設定を保存しました");
    app.refresh();
    return;
  }

  if (action === "add-subject") {
    const input = document.getElementById("new-subject-name");
    const name = input.value.trim();
    if (!name) return;
    const curriculum = game.ensureCurriculum();
    curriculum.push({
      id: `subj-${Date.now()}`,
      name,
      icon: "📘",
      color: ["#4A90D9", "#5BC98C", "#9B7ED8", "#E8A13C", "#E05C5C"][curriculum.length % 5],
      units: [],
    });
    store.set("curriculum", curriculum);
    app.toast("科目を追加しました");
    app.refresh();
    return;
  }

  if (action === "add-unit") {
    const input = document.querySelector(`[data-new-unit="${dataset.addUnit}"]`);
    const name = input?.value.trim();
    if (!name) return;
    const curriculum = game.ensureCurriculum();
    const subject = curriculum.find((s) => s.id === dataset.addUnit);
    if (!subject) return;
    subject.units.push({ id: `u-${Date.now()}`, name });
    store.set("curriculum", curriculum);
    app.toast("単元を追加しました");
    app.refresh();
    return;
  }

  if (action === "del-unit") {
    const curriculum = game.ensureCurriculum();
    const subject = curriculum.find((s) => s.id === dataset.subject);
    if (!subject) return;
    subject.units = subject.units.filter((u) => u.id !== dataset.delUnit);
    store.set("curriculum", curriculum);
    const progress = store.get("progress");
    delete progress[dataset.delUnit];
    store.set("progress", progress);
    app.refresh();
    return;
  }

  if (action === "del-subject") {
    if (!confirm("この科目とその単元を削除します。よろしいですか？")) return;
    let curriculum = game.ensureCurriculum();
    const subject = curriculum.find((s) => s.id === dataset.delSubject);
    if (subject) {
      const progress = store.get("progress");
      subject.units.forEach((u) => delete progress[u.id]);
      store.set("progress", progress);
    }
    curriculum = curriculum.filter((s) => s.id !== dataset.delSubject);
    store.set("curriculum", curriculum);
    app.toast("科目を削除しました");
    app.refresh();
    return;
  }

  if (action === "restore-seed") {
    if (!confirm("標準カリキュラムに戻します。進捗は保持されます。よろしいですか？")) return;
    store.set("curriculum", structuredClone(SEED_SUBJECTS));
    app.toast("標準カリキュラムに戻しました");
    app.refresh();
    return;
  }

  if (action === "export") {
    const blob = new Blob([store.exportJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `academia-quest-${game.todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    app.toast("書き出しました");
    return;
  }

  if (action === "import") {
    document.getElementById("import-file")?.click();
    return;
  }

  if (action === "reset-all") {
    if (!confirm("本当に全データを消去しますか？元に戻せません。")) return;
    if (!confirm("最終確認: すべての進捗・記録・実績が消えます。")) return;
    store.resetAll();
    location.reload();
  }
}

export function onChange(e, app) {
  if (e.target.id !== "import-file" || !e.target.files?.[0]) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      store.importJSON(String(reader.result));
      app.toast("読み込みました");
      setTimeout(() => location.reload(), 600);
    } catch {
      app.toast("読み込みに失敗しました");
    }
  };
  reader.readAsText(e.target.files[0]);
}

export function onInput(e, app, dataset) {
  if (!("renameUnit" in dataset)) return;
  const curriculum = game.ensureCurriculum();
  const subject = curriculum.find((s) => s.id === dataset.subject);
  const unit = subject?.units.find((u) => u.id === dataset.renameUnit);
  if (unit) {
    unit.name = e.target.value;
    store.set("curriculum", curriculum);
  }
}
