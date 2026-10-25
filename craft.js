"use strict";
// Fiche objet : recette(s), prix, forge, utilisations et conseil (acheter / crafter / farmer).
const NEU = "https://raw.githubusercontent.com/NotEnoughUpdates/NotEnoughUpdates-REPO/master/items/";
const FARM = { debutant: 150e3, inter: 800e3, avance: 3e6, expert: 1e7 };
const GROUPS = { arme: ["SWORD", "LONGSWORD", "BOW", "WAND", "FISHING_WEAPON", "GAUNTLET"], armure: ["HELMET", "CHESTPLATE", "LEGGINGS", "BOOTS"],
  outil: ["PICKAXE", "AXE", "SHOVEL", "HOE", "FISHING_ROD", "DRILL", "SHEARS"], access: ["ACCESSORY", "HATCCESSORY"] };
const RAR = { COMMON: ["Commun", "#d0d0d0"], UNCOMMON: ["Peu commun", "#55ff55"], RARE: ["Rare", "#7b7bff"], EPIC: ["Épique", "#c04cc0"], LEGENDARY: ["Légendaire", "#ffaa00"], MYTHIC: ["Mythique", "#ff55ff"], DIVINE: ["Divin", "#55ffff"], SPECIAL: ["Spécial", "#ff5555"], VERY_SPECIAL: ["Très spécial", "#ff5555"] };
const OTHER = { npc_shop: "boutique PNJ", trade: "échange", drops: "butin de monstres", katgrade: "amélioration Kat", mob_drops: "butin de monstres", npc_shop_item: "boutique PNJ" };
const tm = h => h < 1 ? Math.max(1, Math.round(h * 60)) + " min" : h.toFixed(1) + " h";
state.info = {}; state.cr = { list: [], pos: 0, shown: [] }; state.usedC = {};
const meta = id => { if (!state.metaMap && state.items?.length) state.metaMap = Object.fromEntries(state.items.map(i => [i.id, i])); return state.metaMap?.[id]; };
const hasGrid = r => r && Object.keys(r).some(k => /^[A-C][1-3]$/.test(k) && r[k]);

async function getInfo(id) {
  if (id in state.info) return state.info[id];
  let o = null;
  try {
    const x = await fetch(NEU + id + ".json");
    if (x.ok) {
      const j = await x.json(), rs = j.recipes || [];
      const crafts = rs.filter(r => (!r.type || r.type === "crafting") && hasGrid(r));
      if (!crafts.length && hasGrid(j.recipe)) crafts.push(j.recipe);
      o = { crafts, forge: rs.filter(r => r.type === "forge"), others: [...new Set(rs.map(r => r.type).filter(t => t && t !== "crafting" && t !== "forge"))],
        lore: (j.lore || []).map(l => l.replace(/§./g, "")).filter(Boolean).slice(0, 9), wiki: (j.info || []).find(u => /^https?:/.test(u)), req: j.crafttext || "" };
    }
  } catch {}
  return state.info[id] = o;
}
const getRec = async id => (await getInfo(id))?.crafts[0] || null;
const parseIng = s => { const m = /^(.*):([\d.]+)$/.exec(s || ""); return m ? [m[1], parseFloat(m[2])] : null; };

function analyse(id, rec) {
  const ing = {};
  for (const k in rec) { const m = /^[A-C][1-3]$/.test(k) && parseIng(rec[k]); if (m) ing[m[0]] = (ing[m[0]] || 0) + m[1]; }
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
  state.cur = id; state.ri = 0; b.innerHTML = "<p>Chargement…</p>";
  const info = await getInfo(id);
  if (state.cur === id) sheet(id, info);
}
$("#craftBody").onclick = e => {
  const t = e.target;
  if (t.closest("[data-back]")) return openCraft(state.hist.pop(), true);
  const f = t.closest("[data-fav]");
  if (f) { const id = f.dataset.fav; state.fav = state.fav.includes(id) ? state.fav.filter(x => x !== id) : [...state.fav, id]; store.set("fav", state.fav); f.classList.toggle("on"); track(); render(); return; }
  const al = t.closest("[data-al]");
  if (al) { const p = state.live?.[al.dataset.al]?.buyPrice; if (p) { state.alerts.push({ id: al.dataset.al, dir: "below", price: Math.round(p * 0.95) }); store.set("alerts", state.alerts); renderAlerts(); al.textContent = "✓"; } return; }
  const r = t.closest("[data-ri]"); if (r) { state.ri = +r.dataset.ri; return sheet(state.cur, state.info[state.cur]); }
  const c = t.closest("[data-craft]"); if (c) openCraft(c.dataset.craft);
};

function craftGrid(id, rec, cnt) {
  const slot = (i, q, link) => `<div class="slot${link ? " clk" : ""}" ${i ? `title="${esc(name(i))}${q ? " ×" + q : ""}${link ? " : voir la fiche" : ""}"` : ""} ${link ? `data-craft="${i}"` : ""}>${i ? ic(i) : ""}${q > 1 ? `<i>${q}</i>` : ""}</div>`;
  let cells = "";
  for (const r of "ABC") for (const n of "123") { const m = parseIng(rec[r + n]); cells += m ? slot(m[0], m[1], true) : slot(); }
  return `<div class="ctable"><div class="g3">${cells}</div><span class="arrow">➜</span>${slot(id, cnt)}</div>`;
}

function sheet(id, info) {
  const m = meta(id), live = state.live?.[id], tax = parseFloat($("#tax").value) / 100, rar = RAR[m?.tier], fav = state.fav.includes(id);
  let h = `${backBtn()}<div class="fh">${ic(id)}<div class="grow"><h2>${esc(name(id))}</h2><small>${rar ? `<span class="tag" style="color:${rar[1]};border-color:${rar[1]}">${rar[0]}</span> ` : ""}${m?.category ? esc(m.category.toLowerCase()) : ""}</small></div><button class="star ${fav ? "on" : ""}" data-fav="${id}" title="Favori">★</button><button class="star" data-al="${id}" title="Alerte si le prix baisse de 5 %">🔔</button></div>`;
  if (info?.lore.length) h += `<p class="lore">${info.lore.map(esc).join("<br>")}</p>`;
  if (info?.req) h += `<p class="sub">Prérequis : ${esc(info.req.replace(/^Requires: /, ""))}</p>`;
  // Prix
  if (live) {
    const bp = live.sellPrice + 0.1, sp = live.buyPrice - 0.1, pr = sp * (1 - tax) - bp, wk = Math.min(live.buyMovingWeek, live.sellMovingWeek), npc = m?.npc_sell_price;
    h += `<div class="kpis"><div class="kpi"><small>Achat (ordre)</small><b>${fmt(bp)}</b></div><div class="kpi"><small>Vente (ordre)</small><b>${fmt(sp)}</b></div>
      <div class="kpi"><small>Marge après taxe</small><b class="${pr >= 0 ? "pos" : "neg"}">${pr >= 0 ? "+" : ""}${(pr / bp * 100).toFixed(1)} %</b></div><div class="kpi"><small>Volume / semaine</small><b>${fmt(wk)}</b></div>${npc ? `<div class="kpi"><small>Vente au PNJ</small><b>${fmt(npc)}</b></div>` : ""}</div>`;
    if (npc) h += `<p class="sub">${npc > sp * (1 - tax) ? "Le PNJ paie plus que le Bazaar : inutile de le vendre au Bazaar." : `Le Bazaar paie mieux que le PNJ (≈ ×${(sp * (1 - tax) / npc).toFixed(1)}).`}</p>`;
    const sk = spark(id, 220, 36); if (sk) h += `<p class="sub">Historique local : ${sk} ${chg(id).toFixed(1)} %</p>`;
  } else h += `<p class="sub">Pas vendu au Bazaar.${state.bin?.[id] != null ? ` Prix le plus bas en enchère : <b>${fmt(state.bin[id])}</b>.` : ""}</p>`;
  // Recettes
  const cr = info?.crafts || [];
  if (cr.length) {
    const rec = cr[Math.min(state.ri, cr.length - 1)];
    if (cr.length > 1) h += `<div class="rtabs">${cr.map((_, i) => `<button data-ri="${i}" class="${i === state.ri ? "on" : ""}">Recette ${i + 1}</button>`).join("")}</div>`;
    const a = analyse(id, rec);
    h += `<h3>Table de craft</h3>${craftGrid(id, rec, a.cnt)}
      <table><thead><tr><th>Ingrédient</th><th>Qté</th><th>Ordre</th><th>Instant</th></tr></thead><tbody>
      ${a.L.map(x => `<tr><td><button class="nm" data-craft="${x.i}">${ic(x.i)}${esc(name(x.i))}</button></td><td>${fmt(x.q)}</td><td>${x.v ? fmt(x.v.sellPrice + 0.1) : "–"}</td><td>${x.v ? fmt(x.v.buyPrice) : "–"}</td></tr>`).join("")}</tbody></table>
      ${a.miss.length ? `<p class="msg">Hors Bazaar : ${a.miss.map(x => esc(name(x))).join(", ")}. Non inclus dans les totaux.</p>` : ""}
      <label class="inl">Ton gain de farm (coins/h) <input id="fRate" type="text" value="${state.farm || FARM[state.level]}"></label><div id="cRes"></div>`;
    state.curA = a;
  } else h += `<h3>Obtention</h3><p>Pas de craft connu : cet objet se récolte, se farme ou s'obtient en butin.</p>`;
  (info?.forge || []).forEach(f => {
    const ins = (f.inputs || []).map(parseIng).filter(Boolean), cost = ins.reduce((s, [i, q]) => s + q * ((state.live?.[i]?.sellPrice || 0) + 0.1), 0);
    h += `<h3>Forge</h3><p>${ins.map(([i, q]) => `<button class="nm" data-craft="${i}">${ic(i)}${esc(name(i))} ×${q}</button>`).join(" ")}<br><small class="sub">Durée ${tm((f.duration || 0) / 3600)} · coût des matériaux ≈ ${fmt(cost)}</small></p>`;
  });
  if (info?.others.length) h += `<p class="sub">Autres sources : ${[...new Set(info.others.map(t => OTHER[t] || t))].join(", ")}.</p>`;
  h += `<h3>Sert à crafter</h3><div id="usedIn" class="chips"><span class="sub">Recherche…</span></div>`;
  if (info?.wiki) h += `<p><a href="${esc(info.wiki)}" target="_blank" rel="noopener">Voir sur le wiki SkyBlock</a></p>`;
  $("#craftBody").innerHTML = h;
  if (cr.length) {
    const a = state.curA, res = () => {
      state.farm = parseNum($("#fRate").value) || FARM[state.level];
      const [best, , why] = verdict(a), fh = a.W / state.farm;
      const card = (n, k, t, c) => `<div class="opt ${best === n ? "best" : ""}"><b>${k}</b><span>${t}</span><small>${c}</small></div>`;
      const sell = live ? (live.buyPrice - 0.1) * (1 - tax) * a.cnt : null;
      $("#cRes").innerHTML = `<div class="opts">${card("Acheter", "Acheter", "Objet fini", a.P != null ? fmt(a.P) + " coins" : "prix inconnu")}${card("Crafter", "Crafter", "Ordres d'achat", fmt(a.W) + " coins · ~" + tm(a.waitH))}
        ${card("-", "Crafter vite", "Achat instantané", fmt(a.I) + " coins")}${card("Farmer", "Farmer", "Tu récoltes", "0 coin · ~" + tm(fh))}</div>
        <p class="tip"><b>${best}</b> : ${why}${sell != null ? ` Revente nette ≈ ${fmt(sell)} coins.` : ""}</p>
        <p class="sub">Estimation : ~5 % du flux du Bazaar pour l'attente ; le temps de farm dépend du gain que tu indiques.</p>`;
    };
    $("#fRate").oninput = res; res();
  }
  showUsed(id);
}

// Objets (du Bazaar, de nom proche) dont la recette utilise cet objet.
async function showUsed(id) {
  const put = l => { if (state.cur === id) $("#usedIn").innerHTML = l.length ? l.slice(0, 14).map(k => `<button class="nm" data-craft="${k}">${ic(k)}${esc(name(k))}</button>`).join("") : '<span class="sub">Aucun craft trouvé parmi les objets proches.</span>'; };
  if (state.usedC[id]) return put(state.usedC[id]);
  const root = id.replace(/^ENCHANTED_/, "").replace(/_(ITEM|BLOCK)$/, "");
  const cand = Object.keys(state.live || {}).filter(k => k !== id && k.includes(root)).slice(0, 40);
  const infos = await Promise.all(cand.map(getInfo));
  const uses = i => i && [...i.crafts.flatMap(r => Object.entries(r).filter(([k]) => /^[A-C][1-3]$/.test(k)).map(([, v]) => v)), ...i.forge.flatMap(f => f.inputs || [])].some(v => parseIng(v)?.[0] === id);
  put(state.usedC[id] = cand.filter((k, j) => uses(infos[j])));
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
