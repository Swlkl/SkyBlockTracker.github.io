"use strict";
// Crafts : acheter l'objet fini, crafter (ingrédients achetés) ou farmer.
const NEU = "https://raw.githubusercontent.com/NotEnoughUpdates/NotEnoughUpdates-REPO/master/items/";
const FARM = { debutant: 150e3, inter: 800e3, avance: 3e6, expert: 1e7 };
const GROUPS = { arme: ["SWORD", "LONGSWORD", "BOW", "WAND", "FISHING_WEAPON", "GAUNTLET"], armure: ["HELMET", "CHESTPLATE", "LEGGINGS", "BOOTS"],
  outil: ["PICKAXE", "AXE", "SHOVEL", "HOE", "FISHING_ROD", "DRILL", "SHEARS"], access: ["ACCESSORY", "HATCCESSORY"] };
const tm = h => h < 1 ? Math.max(1, Math.round(h * 60)) + " min" : h.toFixed(1) + " h";
state.rec = {}; state.cr = { list: [], pos: 0, shown: [] };

async function getRec(id) {
  if (id in state.rec) return state.rec[id];
  let r = null;
  try { const x = await fetch(NEU + id + ".json"); if (x.ok) r = ((await x.json()).recipes || []).find(y => y.type === "crafting") || null; } catch {}
  return state.rec[id] = r;
}

function analyse(id, rec) {
  const ing = {};
  for (const k in rec) { const m = /^[A-C][1-3]$/.test(k) && rec[k] && rec[k].match(/^(.*):([\d.]+)$/); if (m) ing[m[1]] = (ing[m[1]] || 0) + parseFloat(m[2]); }
  const cnt = rec.count || 1, miss = [];
  const L = Object.entries(ing).map(([i, q]) => { const v = state.live?.[i] || state.live?.[i.replace(/-/g, ":")]; if (!v) miss.push(i); return { i, q, v }; });
  const ok = L.filter(x => x.v), me = state.live?.[id];
  const W = ok.reduce((s, x) => s + x.q * (x.v.sellPrice + 0.1), 0), I = ok.reduce((s, x) => s + x.q * x.v.buyPrice, 0);
  const waitH = Math.max(0, ...ok.map(x => x.q / Math.max(1, 0.05 * x.v.sellMovingWeek / 168)));
  const P = me ? me.buyPrice * cnt : state.bin?.[id] != null ? state.bin[id] * cnt : null;
  return { id, L, miss, cnt, W, I, waitH, P, bz: !!me };
}

function verdict(a) {
  const rate = state.farm || FARM[state.level], fh = a.W / rate;
  if (a.miss.length) return a.P != null ? ["Acheter", "mid", "des ingrédients ne sont pas au Bazaar : le craft est plus compliqué que l'achat."] : ["Farmer", "farm", "des ingrédients ne sont pas au Bazaar : il faut les farmer ou les chercher en enchère."];
  if (a.P != null && a.P <= a.W) return ["Acheter", "mid", `l'objet fini coûte ${fmt(a.P)}, moins que les ingrédients (${fmt(a.W)}).`];
  if (fh <= 1.5) return ["Farmer", "farm", `farmer les ingrédients te prend ~${tm(fh)}, c'est court.`];
  return ["Crafter", "safe", a.P != null ? `crafter coûte ${fmt(a.W)} contre ${fmt(a.P)} à l'achat.` : `farmer prendrait ~${tm(fh)} : achète les ingrédients.`];
}

const backBtn = () => state.hist.length ? `<button class="link" data-back>← Retour : ${esc(name(state.hist[state.hist.length - 1]))}</button>` : "";
async function openCraft(id, back) {
  const d = $("#craftDlg"), b = $("#craftBody");
  if (!d.open) { state.hist = []; state.cur = null; d.showModal(); }
  else if (!back && state.cur && state.cur !== id) state.hist.push(state.cur);
  state.cur = id; b.innerHTML = "<p>Chargement de la recette…</p>";
  const rec = await getRec(id);
  if (state.cur !== id) return;
  if (!rec) { b.innerHTML = `${backBtn()}<h2>${ic(id)}${esc(name(id))}</h2><p>Pas de craft : cet objet de base se farme ou s'achète directement.</p>`; return; }
  showCraft(id, rec);
}
$("#craftBody").onclick = e => {
  if (e.target.closest("[data-back]")) return openCraft(state.hist.pop(), true);
  const c = e.target.closest("[data-craft]"); if (c) openCraft(c.dataset.craft);
};

function craftGrid(id, rec, cnt) {
  const slot = (i, q, link) => `<div class="slot${link ? " clk" : ""}" ${i ? `title="${esc(name(i))}${q ? " ×" + q : ""}${link ? " : voir le craft" : ""}"` : ""} ${link ? `data-craft="${i}"` : ""}>${i ? ic(i) : ""}${q > 1 ? `<i>${q}</i>` : ""}</div>`;
  let cells = "";
  for (const r of "ABC") for (const n of "123") { const m = (rec[r + n] || "").match(/^(.*):([\d.]+)$/); cells += m ? slot(m[1], parseFloat(m[2]), true) : slot(); }
  return `<div class="ctable"><div class="g3">${cells}</div><span class="arrow">➜</span>${slot(id, cnt)}</div>`;
}

function showCraft(id, rec) {
  const a = analyse(id, rec), tax = parseFloat($("#tax").value) / 100;
  $("#craftBody").innerHTML = `${backBtn()}<h2>${ic(id)}${esc(name(id))} <small>×${a.cnt}</small></h2>
    ${craftGrid(id, rec, a.cnt)}
    <table><thead><tr><th>Ingrédient</th><th>Qté</th><th>Ordre</th><th>Instant</th></tr></thead><tbody>
    ${a.L.map(x => `<tr><td><button class="nm" data-craft="${x.i}">${ic(x.i)}${esc(name(x.i))}</button></td><td>${fmt(x.q)}</td><td>${x.v ? fmt(x.v.sellPrice + 0.1) : "–"}</td><td>${x.v ? fmt(x.v.buyPrice) : "–"}</td></tr>`).join("")}</tbody></table>
    ${a.miss.length ? `<p class="msg">Hors Bazaar : ${a.miss.map(m => esc(name(m))).join(", ")}. Non inclus dans les totaux.</p>` : ""}
    <label class="inl">Ton gain de farm (coins/h) <input id="fRate" type="text" value="${state.farm || FARM[state.level]}"></label>
    <div id="cRes"></div>`;
  const res = () => {
    state.farm = parseNum($("#fRate").value) || FARM[state.level];
    const [best, cls, why] = verdict(a), fh = a.W / state.farm;
    const card = (n, k, t, c) => `<div class="opt ${best === n ? "best" : ""}"><b>${k}</b><span>${t}</span><small>${c}</small></div>`;
    const sell = state.live?.[id] ? (state.live[id].buyPrice - 0.1) * (1 - tax) * a.cnt : null;
    $("#cRes").innerHTML = `<div class="opts">${card("Acheter", "Acheter", "Objet fini", a.P != null ? fmt(a.P) + " coins" : "prix inconnu")}
      ${card("Crafter", "Crafter", "Ordres d'achat", fmt(a.W) + " coins · ~" + tm(a.waitH))}
      ${card("-", "Crafter vite", "Achat instantané", fmt(a.I) + " coins")}
      ${card("Farmer", "Farmer", "Tu récoltes", "0 coin · ~" + tm(fh))}</div>
      <p class="tip"><b>${best}</b> : ${why}${sell != null ? ` Revente nette ≈ ${fmt(sell)} coins.` : ""}</p>
      <p class="sub">Estimation : ~5 % du flux du Bazaar pour l'attente ; le temps de farm dépend du gain que tu indiques.</p>`;
  };
  $("#fRate").oninput = res; res();
}

// ---- Liste des crafts ----
async function crInit() {
  if (state.crOk) return; state.crOk = true;
  $("#crRate").value = state.farm || FARM[state.level];
  $("#crRate").oninput = () => { state.farm = parseNum($("#crRate").value) || FARM[state.level]; crRender(); };
  let t; $("#crSearch").oninput = () => { clearTimeout(t); t = setTimeout(crReset, 300); };
  $("#crCat").onchange = crReset; $("#crMore").onclick = crMore;
  $("#crTable").onclick = e => { const c = e.target.closest("[data-craft]"); if (c) openCraft(c.dataset.craft); };
  crReset();
  try { state.bin = await (await fetch("https://moulberry.codes/lowestbin.json")).json(); crRender(); } catch { $("#crNote").textContent = "Prix des objets hors Bazaar (enchères) indisponibles : seuls les objets du Bazaar ont un prix d'achat."; }
}

function crReset() {
  const q = $("#crSearch").value.toLowerCase(), g = $("#crCat").value, all = Object.values(GROUPS).flat();
  const list = (state.items || []).filter(i => (!g || (g === "autre" ? !all.includes(i.category) : GROUPS[g].includes(i.category))) && name(i.id).toLowerCase().includes(q))
    .sort((a, b) => name(a.id).localeCompare(name(b.id)));
  state.cr = { list, pos: 0, shown: [] };
  $("#crTable").innerHTML = ""; crMore();
}

async function crMore() {
  const c = state.cr; if (c.busy) return; c.busy = true; $("#crMore").disabled = true;
  const target = c.shown.length + 25;
  while (c.shown.length < target && c.pos < c.list.length) {
    const ch = c.list.slice(c.pos, c.pos + 24); c.pos += 24;
    const rs = await Promise.all(ch.map(i => getRec(i.id)));
    ch.forEach((i, k) => { if (rs[k]) { const a = analyse(i.id, rs[k]); if (a.L.length) c.shown.push({ i, a }); } });
    if (state.cr === c) crRender();
  }
  c.busy = false;
  if (state.cr === c) { $("#crMore").disabled = false; crRender(); }
}

function crRender() {
  const c = state.cr, left = c.list.length - c.pos;
  const rows = c.shown.map(({ i, a }) => { const [v, cls] = verdict(a), e = a.P != null ? a.P - a.W : null;
    return `<tr><td><button class="nm" data-craft="${i.id}">${ic(i.id)}${esc(name(i.id))}</button></td><td>${esc((i.category || "autre").toLowerCase())}</td><td>${fmt(a.W)}${a.miss.length ? "*" : ""}</td><td>${a.P != null ? fmt(a.P) : "–"}</td><td class="${e == null ? "" : e >= 0 ? "pos" : "neg"}">${e == null ? "–" : (e >= 0 ? "+" : "") + fmt(e)}</td><td><span class="tag ${cls}">${v}</span></td></tr>`; }).join("");
  $("#crTable").innerHTML = `<thead><tr><th>Objet</th><th>Type</th><th>Coût du craft</th><th>Prix direct</th><th>Économie</th><th>Conseil</th></tr></thead><tbody>${rows || `<tr><td colspan="6">${c.busy ? "Analyse des recettes…" : left > 0 ? "Aucun craft trouvé pour l'instant : clique sur « Voir plus »." : "Aucun craft trouvé."}</td></tr>`}</tbody>`;
  $("#crMore").hidden = left <= 0; $("#crMore").textContent = `Voir plus (${left} objets à analyser)`;
}
