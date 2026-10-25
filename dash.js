"use strict";
// Accueil (tableau de bord), journal de flips, recherche rapide, historique local.
const TABS = { dash: ["dash"], flips: ["advice", "tableTools", "tableWrap"], all: ["tableTools", "tableWrap"], fav: ["tableTools", "tableWrap"],
  crafts: ["crafts"], plan: ["plan"], journal: ["journal"], calc: ["calc"], alerts: ["alertsSec"] };
const SECS = ["dash", "advice", "tableTools", "tableWrap", "crafts", "plan", "journal", "calc", "alertsSec"];
function showTab(t) {
  if (!TABS[t]) t = "dash";
  state.tab = t; store.set("tab", t);
  document.querySelectorAll(".tabs button[data-tab]").forEach(b => b.classList.toggle("on", b.dataset.tab === t));
  SECS.forEach(s => $("#" + s).hidden = !TABS[t].includes(s));
  if (t === "crafts") crInit(); if (t === "dash") dashRender(); if (t === "journal") jrRender(); if (t === "plan") planInit();
  render();
}

// ---- Historique local des prix (favoris, alertes, journal) ----
function track() {
  const h = store.get("hist", {}), now = Date.now(), jr = store.get("journal", []);
  new Set([...state.fav, ...state.alerts.map(a => a.id), ...jr.map(j => j.id)]).forEach(id => {
    const p = state.live?.[id]?.buyPrice; if (!p) return;
    const a = h[id] || (h[id] = []);
    if (!a.length || now - a[a.length - 1][0] > 3e5) { a.push([now, p]); if (a.length > 288) a.shift(); }
  });
  store.set("hist", h);
}
function spark(id, w = 90, hh = 24) {
  const a = store.get("hist", {})[id]; if (!a || a.length < 2) return "";
  const v = a.map(x => x[1]), mn = Math.min(...v), r = (Math.max(...v) - mn) || 1;
  const pts = v.map((y, i) => `${(i / (v.length - 1) * w).toFixed(1)},${(hh - 2 - (y - mn) / r * (hh - 4)).toFixed(1)}`).join(" ");
  return `<svg class="spark" viewBox="0 0 ${w} ${hh}" width="${w}" height="${hh}"><polyline points="${pts}" fill="none" stroke="${v[v.length - 1] >= v[0] ? "var(--ok)" : "var(--bad)"}" stroke-width="2"/></svg>`;
}
const chg = id => { const a = store.get("hist", {})[id]; return a && a.length > 1 ? (a[a.length - 1][1] / a[0][1] - 1) * 100 : 0; };

// ---- Accueil ----
const card = (t, b, c = "") => `<section class="card dc ${c}"><h3>${t}</h3>${b}</section>`;
const jrStats = () => { const tax = parseFloat($("#tax").value) / 100, j = store.get("journal", []).map(e => ({ ...e, p: (e.sell * (1 - tax) - e.buy) * e.qty }));
  return { j, total: j.reduce((s, e) => s + e.p, 0), wins: j.filter(e => e.p > 0).length, best: j.length ? j.reduce((a, b) => a.p > b.p ? a : b) : null }; };

function dashRender() {
  const el = $("#dash"); if (el.hidden || !state.raw) return;
  if (el.contains(document.activeElement) && document.activeElement.tagName === "INPUT") return;
  const lv = LEVELS[state.level];
  const top = state.rows.filter(x => x.buyP <= lv.maxPrice && x.weekly >= lv.minVol && !x.sus && x.pct >= 2).sort((a, b) => b.gainH - a.gainH);
  const goal = store.get("goal", 1e6), cur = state.wealth ?? (parseNum($("#budget").value) || 0), C = 163.4;
  const rate = top.slice(0, 3).reduce((s, x) => s + x.gainH, 0) / Math.max(1, Math.min(3, top.length));
  const eta = cur >= goal ? "Objectif atteint !" : rate > 0 ? `≈ ${tm((goal - cur) / rate)} de flips au rythme estimé` : "Pas de flip conseillé pour l'instant.";
  const row = x => `<li><button class="nm" data-craft="${x.id}">${ic(x.id)}${esc(x.name)}</button><span class="pos">+${fmt(x.gainH)}/h</span><small>${x.pct.toFixed(1)} %</small></li>`;
  const med = top.slice(0, 20).map(x => x.pct).sort((a, b) => a - b)[Math.floor(Math.min(top.length, 20) / 2)];
  const fav = state.fav.slice(0, 6).map(id => { const p = state.live?.[id]?.buyPrice, c = chg(id);
    return `<li><button class="nm" data-craft="${id}">${ic(id)}${esc(name(id))}</button>${spark(id)}<span>${p ? fmt(p) : "–"}</span><small class="${c >= 0 ? "pos" : "neg"}">${c ? (c > 0 ? "+" : "") + c.toFixed(1) + " %" : ""}</small></li>`; }).join("");
  const al = state.alerts.slice(0, 5).map(a => { const p = state.live?.[a.id]?.buyPrice, hit = p != null && (a.dir === "below" ? p <= a.price : p >= a.price);
    return `<li><button class="nm" data-craft="${a.id}">${ic(a.id)}${esc(name(a.id))}</button><span>${a.dir === "below" ? "≤" : "≥"} ${fmt(a.price)}</span><small class="${hit ? "pos" : ""}">${hit ? "atteinte" : "actuel " + (p ? fmt(p) : "–")}</small></li>`; }).join("");
  const js = jrStats(), tip = lv.tips[new Date().getDate() % lv.tips.length];
  el.innerHTML =
    card("Objectif", `<div class="goal"><svg class="ring" viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="none" stroke="var(--line)" stroke-width="6"/><circle cx="32" cy="32" r="26" fill="none" stroke="var(--gold)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(Math.min(1, cur / goal) * C).toFixed(1)} ${C}" transform="rotate(-90 32 32)"/><text x="32" y="38" text-anchor="middle" style="font-size:15px">${Math.round(Math.min(1, cur / goal) * 100)}%</text></svg>
      <div><b>${fmt(cur)}</b> / <label class="inl2">objectif <input id="goalIn" value="${goal}" size="9"></label><p class="sub">${eta}</p></div></div>`) +
    card("Meilleurs flips pour toi", top.length ? `<ul class="rows">${top.slice(0, 6).map(row).join("")}</ul>` : "<p class='sub'>Chargement…</p>") +
    card("Marché", `<div class="kpis"><div class="kpi"><small>Flips rentables</small><b>${state.rows.filter(x => !x.sus && x.pct >= 5 && x.weekly >= 1e5).length}</b></div><div class="kpi"><small>Marge médiane (top 20)</small><b>${med ? med.toFixed(1) + " %" : "–"}</b></div><div class="kpi"><small>Objets au Bazaar</small><b>${state.raw.length}</b></div></div>`) +
    card("Mes favoris", fav ? `<ul class="rows">${fav}</ul>` : "<p class='sub'>Clique sur ★ dans le tableau pour suivre un objet et voir son historique.</p>") +
    card("Mes alertes", al ? `<ul class="rows">${al}</ul>` : "<p class='sub'>Aucune alerte. Ouvre une fiche et clique sur 🔔.</p>") +
    card("Journal", js.j.length ? `<div class="kpis"><div class="kpi"><small>Bénéfice total</small><b class="${js.total >= 0 ? "pos" : "neg"}">${fmt(js.total)}</b></div><div class="kpi"><small>Flips gagnants</small><b>${js.wins}/${js.j.length}</b></div></div>` : "<p class='sub'>Note tes flips dans l'onglet Journal pour suivre ton bénéfice réel.</p>") +
    card("Conseil du jour", `<p>${tip}</p>${state.weak ? `<p class="sub">Ta compétence la plus faible : ${esc(state.weak)}.</p>` : ""}`, "wide");
}
$("#dash").onclick = e => { const c = e.target.closest("[data-craft]"); if (c) openCraft(c.dataset.craft); };
$("#dash").onchange = e => { if (e.target.id === "goalIn") { const v = parseNum(e.target.value); if (v > 0) store.set("goal", v); e.target.blur(); dashRender(); } };

// ---- Journal ----
function jrRender() {
  if (!$("#jList").children.length && state.live) $("#jList").innerHTML = Object.keys(state.live).map(id => `<option value="${esc(name(id))}">`).join("");
  const s = jrStats();
  $("#jSum").innerHTML = `<div class="kpi"><small>Bénéfice total</small><b class="${s.total >= 0 ? "pos" : "neg"}">${fmt(s.total)}</b></div><div class="kpi"><small>Flips</small><b>${s.j.length}</b></div><div class="kpi"><small>Gagnants</small><b>${s.wins}</b></div><div class="kpi"><small>Meilleur flip</small><b>${s.best ? fmt(s.best.p) : "–"}</b></div>`;
  $("#jTable").innerHTML = `<thead><tr><th>Date</th><th>Objet</th><th>Qté</th><th>Achat</th><th>Vente</th><th>Profit net</th><th></th></tr></thead><tbody>${s.j.slice().reverse().map(e => `<tr><td>${new Date(e.t).toLocaleDateString("fr-FR")}</td><td><button class="nm" data-craft="${e.id}">${ic(e.id)}${esc(name(e.id))}</button></td><td>${fmt(e.qty)}</td><td>${fmt(e.buy)}</td><td>${fmt(e.sell)}</td><td class="${e.p >= 0 ? "pos" : "neg"}">${fmt(e.p)}</td><td><button class="link" data-del="${e.t}">✕</button></td></tr>`).join("") || `<tr><td colspan="7">Aucun flip noté.</td></tr>`}</tbody>`;
}
$("#jAdd").onclick = () => {
  const q = $("#jItem").value.trim().toLowerCase(), ids = Object.keys(state.live || {}), id = ids.find(i => name(i).toLowerCase() === q) || ids.find(i => i.toLowerCase() === q);
  const buy = parseNum($("#jBuy").value), sell = parseNum($("#jSell").value), qty = parseNum($("#jQty").value);
  if (!id) return $("#jMsg").textContent = "Choisis un objet dans la liste proposée.";
  if ([buy, sell, qty].some(v => !(v > 0))) return $("#jMsg").textContent = "Entre un prix d'achat, un prix de vente et une quantité (ex : 1500, 12k).";
  $("#jMsg").textContent = ""; store.set("journal", [...store.get("journal", []), { id, buy, sell, qty, t: Date.now() }]);
  ["jItem", "jBuy", "jSell", "jQty"].forEach(i => $("#" + i).value = ""); track(); jrRender();
};
$("#jTable").onclick = e => { const d = e.target.closest("[data-del]"), c = e.target.closest("[data-craft]");
  if (d) { store.set("journal", store.get("journal", []).filter(x => String(x.t) !== d.dataset.del)); jrRender(); } else if (c) openCraft(c.dataset.craft); };
$("#jClear").onclick = () => { if (confirm("Effacer tout le journal ?")) { store.set("journal", []); jrRender(); } };
$("#jCsv").onclick = () => { const s = jrStats(), csv = ["Date;Objet;Quantité;Achat;Vente;Profit net", ...s.j.map(e => [new Date(e.t).toISOString().slice(0, 10), name(e.id), e.qty, e.buy, e.sell, e.p.toFixed(0)].join(";"))].join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "journal-flips.csv"; a.click(); };

// ---- Recherche rapide (Ctrl+K ou /) ----
const cmd = { res: [], sel: 0 };
function cmdDraw() { $("#cmdList").innerHTML = cmd.res.map((id, i) => `<li class="${i === cmd.sel ? "on" : ""}" data-id="${id}">${ic(id)}${esc(name(id))}</li>`).join("") || "<li>Aucun résultat</li>"; }
function cmdFind() {
  const q = $("#cmdIn").value.toLowerCase().trim();
  if (!q) cmd.res = store.get("recent", []);
  else { const ids = new Set([...Object.keys(state.live || {}), ...(state.items || []).map(i => i.id)]);
    cmd.res = [...ids].map(id => [id, name(id).toLowerCase()]).filter(([, n]) => n.includes(q)).sort((a, b) => (b[1].startsWith(q) - a[1].startsWith(q)) || a[1].localeCompare(b[1])).slice(0, 8).map(x => x[0]); }
  cmd.sel = 0; cmdDraw();
}
function cmdGo(id) { if (!id) return; store.set("recent", [id, ...store.get("recent", []).filter(x => x !== id)].slice(0, 6)); $("#cmdDlg").close(); openCraft(id); }
function cmdOpen() { const d = $("#cmdDlg"); if (!d.open) d.showModal(); $("#cmdIn").value = ""; cmdFind(); $("#cmdIn").focus(); }
$("#cmdBtn").onclick = cmdOpen; $("#cmdIn").oninput = cmdFind;
$("#cmdList").onclick = e => cmdGo(e.target.closest("[data-id]")?.dataset.id);
$("#cmdIn").onkeydown = e => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); cmd.sel = (cmd.sel + (e.key === "ArrowDown" ? 1 : -1) + cmd.res.length) % Math.max(1, cmd.res.length); cmdDraw(); }
  if (e.key === "Enter") cmdGo(cmd.res[cmd.sel]);
};
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); cmdOpen(); }
  else if (e.key === "/" && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); cmdOpen(); }
});

showTab(store.get("tab", "dash"));
