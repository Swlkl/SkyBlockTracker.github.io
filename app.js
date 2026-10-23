"use strict";
const API = "https://api.hypixel.net/v2/skyblock/";
const LEVELS = {
  debutant: { label: "Débutant", budget: 100e3, maxPrice: 20e3, minVol: 300e3,
    tips: ["Vise les objets très échangés et peu chers : tu revends vite, même avec de petites marges.",
           "Passe par des ordres d'achat / de vente plutôt que l'achat instantané : tu gagnes la marge.",
           "Réinvestis tes gains pour monter ton budget avant de viser des objets chers."] },
  inter: { label: "Intermédiaire", budget: 2e6, maxPrice: 200e3, minVol: 150e3,
    tips: ["Répartis ton budget sur 3 à 5 flips à la fois pour limiter le risque.",
           "Surveille la colonne Marge % : au-dessus de 15 %, vérifie que le prix n'est pas manipulé.",
           "Les objets enchantés et les composants de minions sont de bons candidats."] },
  avance: { label: "Avancé", budget: 30e6, maxPrice: 2e6, minVol: 40e3,
    tips: ["Avec ce budget, le volume devient ta limite : privilégie un gain/h élevé.",
           "Évite les objets dont le volume hebdomadaire est faible : la revente peut bloquer.",
           "Diversifie : un seul ordre bloqué ne doit pas immobiliser la moitié de ton capital."] },
  expert: { label: "Expert", budget: 300e6, maxPrice: Infinity, minVol: 5e3,
    tips: ["Les objets chers et rares ont de grosses marges mais des délais de vente longs.",
           "Compare toujours le gain/h : un petit objet très liquide peut battre un gros objet lent.",
           "Utilise les alertes de prix pour acheter lors des chutes ponctuelles."] }
};
const $ = s => document.querySelector(s);
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const state = { level: store.get("level", "debutant"), tab: "flips", rows: [], names: {}, fav: store.get("fav", []),
  alerts: store.get("alerts", []), mat: {}, sb: null, sort: "gainH", asc: false };

function setTier(t) { state.level = t; store.set("level", t); renderAdvice(); compute(); render(); }
function autoTier() { if (state.sb != null) return; const b = parseNum($("#budget").value) || 0; setTier(b < 1e6 ? "debutant" : b < 2e7 ? "inter" : b < 2e8 ? "avance" : "expert"); }
const TEX = "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.21.4/assets/minecraft/textures/";
const LEG = { RAW_FISH: "cod", PORK: "porkchop", GRILLED_PORK: "cooked_porkchop", RAW_CHICKEN: "chicken", RAW_BEEF: "beef", SULPHUR: "gunpowder", INK_SACK: "ink_sac", LOG: "oak_log", LOG_2: "acacia_log", WOOD: "oak_planks", NETHER_STALK: "nether_wart", MELON: "melon_slice", CARROT_ITEM: "carrot", POTATO_ITEM: "potato", SEEDS: "wheat_seeds", SNOW_BALL: "snowball", EYE_OF_ENDER: "ender_eye", EXP_BOTTLE: "experience_bottle", WATER_LILY: "lily_pad", ENDER_STONE: "end_stone", SPECKLED_MELON: "glistering_melon_slice", SKULL_ITEM: "player_head" };
function ic(id) {
  const m = (state.mat[id] || id).toUpperCase(), f = /^ENCHANTMENT_/.test(id) ? "enchanted_book" : LEG[m] || m.toLowerCase();
  return `<img class="ic${id.startsWith("ENCHANTED_") ? " gl" : ""}" src="${TEX}item/${f}.png" data-f="${f}" alt="" loading="lazy" onerror="icErr(this)">`;
}
function icErr(i) {
  if (!i.dataset.s) { i.dataset.s = 1; i.src = TEX + "block/" + i.dataset.f + ".png"; return; }
  i.onerror = null; i.src = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="#778"/><text x="8" y="12" font-size="10" text-anchor="middle" fill="#fff">?</text></svg>');
}
const parseNum = s => {
  const m = String(s).trim().toLowerCase().replace(/[\s,]/g, "").match(/^([\d.]+)([kmb]?)$/);
  return m ? parseFloat(m[1]) * ({ "": 1, k: 1e3, m: 1e6, b: 1e9 })[m[2]] : NaN;
};
const fmt = n => !isFinite(n) ? "–" : Math.abs(n) >= 1e9 ? (n / 1e9).toFixed(2) + " Md" : Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(2) + " M"
  : Math.abs(n) >= 1e4 ? (n / 1e3).toFixed(1) + " k" : n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const pretty = id => id.replace(/^ENCHANTMENT_/, "").replace(/_/g, " ").toLowerCase().replace(/(^| )\w/g, c => c.toUpperCase());
const name = id => state.names[id] || pretty(id);
const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function compute() {
  const tax = parseFloat($("#tax").value) / 100, budget = parseNum($("#budget").value) || 0;
  state.rows = (state.raw || []).map(([id, q]) => {
    const buyP = q.sellPrice + 0.1, sellP = q.buyPrice - 0.1;
    if (!(q.sellPrice > 0 && q.buyPrice > 0) || sellP <= buyP) return null;
    const profit = sellP * (1 - tax) - buyP, pct = profit / buyP * 100;
    const weekly = Math.min(q.buyMovingWeek, q.sellMovingWeek), hourly = weekly / 168;
    const units = Math.min(Math.floor(budget / buyP), hourly * 0.05);
    const risk = weekly >= 1e6 && pct <= 15 ? "safe" : weekly >= 1e5 && pct <= 30 ? "mid" : "risk";
    return { id, name: name(id), buyP, sellP, profit, pct, weekly, risk, sus: pct > 35 || weekly < 5e3,
      gainH: profit > 0 ? profit * Math.max(units, 0) : 0 };
  }).filter(r => r && r.profit > 0);
}

function visible() {
  const lv = LEVELS[state.level], q = $("#search").value.toLowerCase(), min = parseFloat($("#minPct").value) || 0;
  let r = state.rows.filter(x => x.pct >= min && x.name.toLowerCase().includes(q));
  if ($("#hideSus").checked) r = r.filter(x => !x.sus);
  if (state.tab === "flips") r = r.filter(x => x.buyP <= lv.maxPrice && x.weekly >= lv.minVol);
  if (state.tab === "fav") r = r.filter(x => state.fav.includes(x.id));
  const k = state.sort, d = state.asc ? 1 : -1;
  return r.sort((a, b) => (typeof a[k] === "string" ? a[k].localeCompare(b[k]) : a[k] - b[k]) * d);
}

const COLS = [["name", "Objet"], ["buyP", "Ordre d'achat"], ["sellP", "Ordre de vente"], ["profit", "Profit / unité"],
  ["pct", "Marge"], ["weekly", "Volume / sem."], ["risk", "Risque"], ["gainH", "Gain estimé / h"]];
const RISK = { safe: "Liquide", mid: "Moyen", risk: "Risqué" };

function render() {
  const rows = visible();
  $("#favCount").textContent = state.fav.length ? `(${state.fav.length})` : "";
  const head = "<th></th>" + COLS.map(([k, l]) => `<th data-k="${k}" class="${state.sort === k ? "s " + (state.asc ? "asc" : "") : ""}">${l}</th>`).join("");
  const body = rows.slice(0, 300).map(r => `<tr><td><button class="star ${state.fav.includes(r.id) ? "on" : ""}" data-id="${r.id}" aria-label="Favori">${state.fav.includes(r.id) ? "★" : "☆"}</button></td>
    <td><button class="nm" data-craft="${r.id}" title="Voir le craft">${ic(r.id)}${esc(r.name)}</button></td><td>${fmt(r.buyP)}</td><td>${fmt(r.sellP)}</td><td class="pos">+${fmt(r.profit)}</td>
    <td class="${r.pct > 35 ? "neg" : "pos"}">${r.pct.toFixed(1)} %</td><td>${fmt(r.weekly)}</td>
    <td><span class="tag ${r.risk}">${RISK[r.risk]}${r.sus ? " · suspect" : ""}</span></td><td><b>${fmt(r.gainH)}</b></td></tr>`).join("");
  $("#tableWrap").innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="9">Aucun résultat. Baisse la marge minimale ou change d'onglet.</td></tr>`}</tbody></table>`;
}

function renderAdvice() {
  const l = LEVELS[state.level];
  $("#advice").innerHTML = `<h2>Conseils pour le niveau ${l.label}</h2>
    <p>Objets affichés : prix d'achat ≤ ${fmt(l.maxPrice)} et au moins ${fmt(l.minVol)} échanges par semaine.</p><ul>${l.tips.map(t => `<li>${t}</li>`).join("")}</ul>`;
  $("#lvlName").textContent = l.label; $("#lvlWhy").textContent = state.sb != null ? ` (niveau SkyBlock ${state.sb})` : " (d'après ton budget, connecte-toi pour l'affiner)";
}

function renderAlerts() {
  $("#alList").innerHTML = state.alerts.map((a, i) => `<li><span>${esc(name(a.id))} ${a.dir === "below" ? "sous" : "au-dessus de"} ${fmt(a.price)}</span><button data-del="${i}">Supprimer</button></li>`).join("") || "<li>Aucune alerte.</li>";
}

function checkAlerts() {
  state.alerts.forEach(a => {
    const p = state.live?.[a.id]?.buyPrice; if (!p) return;
    if ((a.dir === "below" && p <= a.price) || (a.dir === "above" && p >= a.price)) {
      const msg = `${name(a.id)} : ${fmt(p)} (seuil ${fmt(a.price)})`;
      if ("Notification" in window && Notification.permission === "granted") new Notification("Alerte Bazaar", { body: msg });
      $("#status").textContent = "Alerte : " + msg;
    }
  });
}

async function load() {
  $("#status").textContent = "Actualisation…";
  try {
    const r = await fetch(API + "bazaar"); const j = await r.json();
    if (!j.success) throw new Error();
    state.live = {}; state.raw = Object.entries(j.products).map(([id, p]) => (state.live[id] = p.quick_status, [id, p.quick_status]));
    compute(); render(); checkAlerts();
    $("#status").textContent = "Mis à jour à " + new Date().toLocaleTimeString("fr-FR");
    if (!$("#alItem").options.length) $("#alItem").innerHTML = state.rows.concat().sort((a, b) => a.name.localeCompare(b.name)).map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join("");
  } catch { $("#status").textContent = "Erreur : l'API Hypixel ne répond pas. Réessaie dans un instant."; }
}

async function loadNames() {
  try {
    const j = await (await fetch(API.replace("skyblock/", "resources/skyblock/items"))).json();
    (j.items || []).forEach(i => { state.names[i.id] = i.name; state.mat[i.id] = i.material; });
    compute(); render(); renderAlerts();
  } catch {}
}

// Événements
document.querySelector(".tabs").onclick = e => { const t = e.target.closest("button")?.dataset.tab; if (!t) return;
  state.tab = t; document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === t));
  const nt = t === "calc"; $("#advice").hidden = nt; $("#calc").hidden = t !== "calc"; $("#tableWrap").hidden = $("#tableTools").hidden = nt; render(); };
$("#tableWrap").onclick = e => {
  const th = e.target.closest("th[data-k]"), st = e.target.closest(".star"), cr = e.target.closest("[data-craft]");
  if (cr) openCraft(cr.dataset.craft);
  if (th) { state.asc = state.sort === th.dataset.k ? !state.asc : false; state.sort = th.dataset.k; render(); }
  if (st) { const id = st.dataset.id; state.fav = state.fav.includes(id) ? state.fav.filter(f => f !== id) : [...state.fav, id]; store.set("fav", state.fav); render(); }
};
["search", "minPct", "hideSus"].forEach(i => $("#" + i).oninput = render);
["budget", "tax"].forEach(i => $("#" + i).oninput = () => { autoTier(); compute(); render(); });
$("#refresh").onclick = load;
$("#theme").onclick = () => { const t = document.documentElement.dataset.theme === "light" ? "dark" : "light"; document.documentElement.dataset.theme = t; store.set("theme", t); };
$("#csv").onclick = () => {
  const csv = ["Objet;Achat;Vente;Profit;Marge %;Volume/sem;Gain/h", ...visible().map(r => [r.name, r.buyP, r.sellP, r.profit, r.pct, r.weekly, r.gainH].map(v => typeof v === "number" ? v.toFixed(2) : v).join(";"))].join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "bazaar-flips.csv"; a.click();
};
function calc() {
  const b = parseNum($("#cBuy").value), s = parseNum($("#cSell").value), q = parseNum($("#cQty").value), t = parseFloat($("#tax").value) / 100;
  if ([b, s, q].some(isNaN)) { $("#cOut").textContent = "Entre des nombres valides (ex : 1500, 12k, 2m)."; return; }
  const p = (s * (1 - t) - b) * q;
  $("#cOut").innerHTML = `Investissement : <b>${fmt(b * q)}</b> · Revenu net : <b>${fmt(s * (1 - t) * q)}</b> · Bénéfice : <b class="${p >= 0 ? "pos" : "neg"}">${fmt(p)}</b> (${(p / (b * q) * 100).toFixed(1)} %)`;
}
["cBuy", "cSell", "cQty", "tax"].forEach(i => $("#" + i).addEventListener("input", calc));
$("#alAdd").onclick = () => { const price = parseNum($("#alPrice").value); if (isNaN(price)) return;
  if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
  state.alerts.push({ id: $("#alItem").value, dir: $("#alDir").value, price }); store.set("alerts", state.alerts); renderAlerts(); };
$("#alList").onclick = e => { const i = e.target.dataset.del; if (i === undefined) return; state.alerts.splice(i, 1); store.set("alerts", state.alerts); renderAlerts(); };

document.documentElement.dataset.theme = store.get("theme", "dark");
$("#budget").value = "100k";
autoTier(); renderAlerts(); calc(); load(); loadNames();
setInterval(load, 60000);
