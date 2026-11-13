import { store } from "../store.js";
import * as game from "../game.js";

const TABS = [
  { id: "companion", label: "仲間", icon: "🐾" },
  { id: "title", label: "称号", icon: "🏷️" },
  { id: "frame", label: "枠", icon: "🖼️" },
  { id: "background", label: "背景", icon: "🎨" },
  { id: "decoration", label: "装飾", icon: "🕯️" },
  { id: "avatar", label: "アバター", icon: "😊" },
];

let tab = "companion";
let lastResults = null;

function stars(rarity) {
  return "★".repeat(rarity);
}

function artSpan(item) {
  const art = game.itemArt(item);
  if (item.type === "avatar" && art.startsWith("<svg")) {
    return `<span class="art-svg">${art}</span>`;
  }
  return `<span>${art}</span>`;
}

function rarityClass(r) {
  return `r${r}`;
}

export function render(root) {
  const points = store.get("points");
  const gacha = store.get("gacha");
  const settings = store.get("settings");
  const pulls = game.totalPulls();
  const pity = game.pityState();
  const pickup = game.GACHA_ITEMS.filter((i) => i.rarity === 5 && (i.type === "companion" || i.type === "avatar"));

  root.innerHTML = `
    <div class="section-head"><h2>お宝</h2><span class="hint">星辰の祈り</span></div>

    <section class="panel gacha-banner">
      <div class="g-title">✦ 星辰の祈り ✦</div>
      <div class="g-sub">学習で貯めた星辰で、仲間とお守りを引き寄せよう</div>
      <div class="g-cost">所持ポイント: ${points.toLocaleString()}✨ ・ 累計引数 ${pulls}回</div>

      <div class="pickup-row">
        ${pickup
          .map((item) => {
            const owned = !!gacha.owned[item.id];
            return `<div class="pickup-item ${rarityClass(item.rarity)} ${owned ? "" : "locked"}" title="${item.name}">
              ${artSpan(item)}
              <span class="pk-rr">${stars(item.rarity)}</span>
            </div>`;
          })
          .join("")}
      </div>

      <div class="pity-box">
        <div class="gauge-label"><span>天井まであと <b>${pity.remaining}</b> 連</span><span>★5 ${game.GACHA_PITY}連確定</span></div>
        <div class="gauge slim" style="--gauge-color:#e8b84b"><i style="width:${(pity.ratio * 100).toFixed(1)}%"></i></div>
      </div>

      <div class="gacha-actions">
        <button class="btn" data-action="pull1" ${points < 100 ? "disabled" : ""}>祈り 1回<br/><small>100✨</small></button>
        <button class="btn btn-primary" data-action="pull10" ${points < 1000 ? "disabled" : ""}>祈り 10回（★4以上確定）<br/><small>1000✨</small></button>
      </div>
      <div class="g-sub" style="margin-top:10px;font-size:11.5px">排出率: ★5 0.6% / ★4 5.1%（10連は★4以上を1枠保証・重複は30✨還元）</div>
      ${
        lastResults
          ? `<div class="gacha-result">
              ${lastResults.results
                .map(
                  (r, i) => `
                <div class="g-card ${rarityClass(r.rarity)}" style="animation-delay:${i * 0.07}s">
                  <div class="g-ico">${artSpan(r)}</div>
                  <div class="g-nm">${r.name}</div>
                  <div class="g-rr">${stars(r.rarity)}</div>
                </div>`
                )
                .join("")}
            </div>
            ${lastResults.refund ? `<div class="g-sub" style="margin-top:8px;color:#ffe9a8">重複により +${lastResults.refund}✨ 還元</div>` : ""}`
          : ""
      }
    </section>

    <section class="panel">
      <div class="chips">
        ${TABS.map((t) => `<button class="chip ${tab === t.id ? "active" : ""}" data-gacha-tab="${t.id}">${t.icon} ${t.label}</button>`).join("")}
      </div>
      <div class="collection-grid">
        ${game.GACHA_ITEMS.filter((i) => i.type === tab)
          .map((item) => {
            const owned = gacha.owned[item.id];
            const equipped = game.isEquipped(item.id, item.type, settings);
            const showArt = owned ? artSpan(item) : `<span class="c-unknown">？</span>`;
            return `
            <div class="col-item ${rarityClass(item.rarity)} ${owned ? "" : "locked"} ${equipped ? "equipped" : ""}"
                 ${owned ? `data-equip="${item.id}" data-type="${item.type}" role="button" tabindex="0" title="装備する"` : ""}>
              <div class="c-rr">${stars(item.rarity)}</div>
              <div class="c-ico">${showArt}</div>
              <div class="c-nm">${owned ? item.name : "？？？"}</div>
              <div class="c-meta">${owned ? (equipped ? "装備中" : `×${owned.count}・タップで装備`) : "未獲得"}</div>
            </div>`;
          })
          .join("")}
      </div>
    </section>

    <section class="panel">
      <div class="panel-title">📖 祈りの記録 <span class="sub">最新20件</span></div>
      ${
        gacha.history.length
          ? `<ul class="log-list">
              ${gacha.history
                .slice(0, 20)
                .map((h) => {
                  const d = new Date(h.at);
                  return `
                  <li class="log-item">
                    <span class="log-when">${d.getMonth() + 1}/${d.getDate()}</span>
                    <span style="font-size:16px;flex:none;width:26px;height:26px;display:inline-flex;justify-content:center">${artSpan(h)}</span>
                    <span class="log-what">${h.name}</span>
                    <span class="q-reward" style="color:${h.rarity === 5 ? "#e8b84b" : h.rarity === 4 ? "#a97be0" : "#5a9be8"}">${stars(h.rarity)}</span>
                  </li>`;
                })
                .join("")}
            </ul>`
          : `<div class="empty">まだ祈りをしていません</div>`
      }
    </section>
  `;
}

export function onAction(action, app, dataset) {
  if (action === "pull1" || action === "pull10") {
    const count = action === "pull10" ? 10 : 1;
    const result = game.pullGacha(count);
    if (!result.ok) {
      app.toast(result.reason);
      return;
    }
    lastResults = result;
    const best = Math.max(...result.results.map((r) => r.rarity));
    app.toast(best === 5 ? "🌟🌟🌟 ★5を引き当てた！！" : best === 4 ? "★4を引き当てた！" : "祈りの結果が出ました", best >= 4);
    for (const a of result.newAch) app.toastAchievement(a);
    app.refresh();
    return;
  }
  if (action === "gacha-tab") {
    tab = dataset.gachaTab;
    app.refresh();
    return;
  }
  if (action === "equip") {
    game.equipItem(dataset.equip, dataset.type);
    app.toast("装備しました");
    app.refresh();
  }
}
