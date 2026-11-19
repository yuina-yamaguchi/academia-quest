import { store } from "./store.js";
import * as game from "./game.js";
import { initSync, syncNow } from "./sync.js";
import * as home from "./views/home.js";
import * as quests from "./views/quests.js";
import * as record from "./views/record.js";
import * as gacha from "./views/gacha.js";
import * as profile from "./views/profile.js";

const VIEWS = {
  home: { label: "ホーム", icon: "🏰", mod: home },
  quests: { label: "クエスト", icon: "📜", mod: quests },
  record: { label: "記録", icon: "📊", mod: record },
  gacha: { label: "お宝", icon: "🎰", mod: gacha },
  profile: { label: "プロフィール", icon: "⚜️", mod: profile },
};
const ORDER = ["home", "quests", "record", "gacha", "profile"];

let current = "home";

const app = {
  toast(message, gold = false, ms = 3300) {
    const root = document.getElementById("toast-root");
    const el = document.createElement("div");
    el.className = `toast${gold ? " gold" : ""}`;
    el.textContent = message;
    root.appendChild(el);
    setTimeout(() => el.remove(), ms);
  },

  toastAchievement(ach) {
    this.toast(`🏅 実績解除「${ach.name}」`, true);
  },

  go(view) {
    if (!VIEWS[view]) view = "home";
    current = view;
    if (location.hash !== `#/${view}`) location.hash = `#/${view}`;
    else this.refresh();
  },

  refresh() {
    renderNav();
    renderHeader();
    const view = VIEWS[current];
    const root = document.getElementById("view");
    root.innerHTML = "";
    view.mod.render(root);
    root.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  },
};

function renderNav() {
  const items = ORDER.map((id) => {
    const v = VIEWS[id];
    return `<a href="#/${id}" class="${current === id ? "active" : ""}"><span class="nav-icon">${v.icon}</span><span>${v.label}</span></a>`;
  }).join("");
  document.getElementById("bottomnav").innerHTML = items;
  document.getElementById("sidenav").innerHTML = items;
}

function renderHeader() {
  const streak = store.get("streak");
  document.querySelector("#hdr-streak b").textContent = streak.current || 0;
  document.querySelector("#hdr-points b").textContent = game.pointsBalance().toLocaleString();
  document.querySelector("#hdr-rank b").textContent = game.rankInfo().rank;
}

/* ---------- ログインボーナス ---------- */

function showBonusModal(info) {
  const root = document.getElementById("modal-root");
  const cycleLen = 7;
  const currentDay = info.bonusDay;
  root.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal" role="dialog" aria-modal="true">
        <h3>🌟 ログインボーナス</h3>
        <div class="modal-body">
          <div class="hint">連続 ${info.streak.current} 日目の報酬</div>
          <div class="bonus-day">DAY ${currentDay}</div>
          <div class="bonus-amount">+${info.bonusAmount} ✨</div>
          <div class="bonus-cycle">
            ${Array.from({ length: cycleLen }, (_, i) => {
              const day = i + 1;
              const cls = day < currentDay ? "past" : day === currentDay ? "today" : "";
              return `<span class="bonus-dot ${cls}">${day}</span>`;
            }).join("")}
          </div>
          <div class="hint" style="margin-top:10px">7日目まで続けると大ボーナス！</div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary btn-lg" id="claim-bonus">受け取る</button>
        </div>
      </div>
    </div>`;
  root.querySelector("#claim-bonus").addEventListener("click", () => {
    const r = game.claimBonus();
    root.innerHTML = "";
    if (r.claimed) app.toast(`✨ +${r.amount} ポイントを受け取りました`, true);
    app.refresh();
  });
}

/* ---------- ルーティング ---------- */

function viewFromHash() {
  const id = location.hash.replace(/^#\/?/, "");
  return VIEWS[id] ? id : "home";
}

window.addEventListener("hashchange", () => {
  current = viewFromHash();
  app.refresh();
});

document.addEventListener("click", (e) => {
  const navEl = e.target.closest("[data-nav]");
  if (navEl) {
    e.preventDefault();
    app.go(navEl.dataset.nav);
    return;
  }
  const view = VIEWS[current];

  const target = e.target.closest("[data-action], [data-filter], [data-cycle], [data-timer-unit], [data-toggle-subject], [data-gacha-tab], [data-equip], [data-del-session], [data-del-exam], [data-del-unit], [data-del-subject], [data-add-unit]");
  if (!target) return;
  const d = target.dataset;

  if ("action" in d) view.mod.onAction?.(d.action, app, d);
  else if ("filter" in d) view.mod.onAction?.("filter", app, d);
  else if ("cycle" in d) view.mod.onAction?.("cycle", app, d);
  else if ("timerUnit" in d) view.mod.onAction?.("timer-unit", app, d);
  else if ("toggleSubject" in d) view.mod.onAction?.("toggle-subject", app, d);
  else if ("gachaTab" in d) view.mod.onAction?.("gacha-tab", app, d);
  else if ("equip" in d) view.mod.onAction?.("equip", app, d);
  else if ("delSession" in d) view.mod.onAction?.("del-session", app, d);
  else if ("delExam" in d) view.mod.onAction?.("del-exam", app, d);
  else if ("delUnit" in d) view.mod.onAction?.("del-unit", app, d);
  else if ("delSubject" in d) view.mod.onAction?.("del-subject", app, d);
  else if ("addUnit" in d) view.mod.onAction?.("add-unit", app, d);
});

document.addEventListener("submit", (e) => {
  e.preventDefault();
  VIEWS[current].mod.onSubmit?.(e.target, app);
});

document.addEventListener("change", (e) => {
  VIEWS[current].mod.onChange?.(e.target, app);
});

document.addEventListener("input", (e) => {
  VIEWS[current].mod.onInput?.(e.target, app, e.target.dataset || {});
});

/* ---------- 起動 ---------- */

function boot() {
  const info = game.visit();
  game.checkAchievements();
  current = viewFromHash();
  app.refresh();

  // 同期: 起動時にプル→マージ→プッシュ（未接続なら何もしない）
  initSync();
  syncNow().then((r) => {
    if (r && r.ok && r.changed) {
      app.toast("☁️ データを同期しました");
      app.refresh();
    }
  }).catch(() => {});

  if (info.bonusAvailable) {
    setTimeout(() => showBonusModal(info), 350);
  } else if (info.newDay) {
    app.toast(`🔥 ${info.streak.current}日連続！今日もクエストを進めよう`);
  }

  // PWA: Service Worker 登録
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

boot();
