"use strict";
// Aide au craft : attendre (ordres d'achat), prendre (achat instantané) ou farmer.
const NEU = "https://raw.githubusercontent.com/NotEnoughUpdates/NotEnoughUpdates-REPO/master/items/";
const FARM = { debutant: 150e3, inter: 800e3, avance: 3e6, expert: 1e7 };
const tm = h => h < 1 ? Math.max(1, Math.round(h * 60)) + " min" : h.toFixed(1) + " h";

async function openCraft(id) {
  const d = $("#craftDlg"), b = $("#craftBody");
  b.innerHTML = "<p>Chargement de la recette…</p>"; d.showModal();
  try {
    const r = await fetch(NEU + id + ".json"); if (!r.ok) throw 0;
    const rec = ((await r.json()).recipes || []).find(x => x.type === "crafting"); if (!rec) throw 0;
    showCraft(id, rec);
  } catch { b.innerHTML = `<h2>${ic(id)}${esc(name(id))}</h2><p>Aucune recette de craft trouvée : cet objet se farme ou s'achète directement.</p>`; }
}

function showCraft(id, rec) {
  const ing = {};
  for (const k in rec) { const m = /^[A-C][1-3]$/.test(k) && rec[k] && rec[k].match(/^(.*):([\d.]+)$/); if (m) ing[m[1]] = (ing[m[1]] || 0) + parseFloat(m[2]); }
  const cnt = rec.count || 1, tax = parseFloat($("#tax").value) / 100, miss = [];
  const L = Object.entries(ing).map(([i, q]) => { const v = state.live?.[i] || state.live?.[i.replace(/-/g, ":")]; if (!v) miss.push(i); return { i, q, v }; });
  const ok = L.filter(x => x.v), me = state.live?.[id];
  const W = ok.reduce((s, x) => s + x.q * (x.v.sellPrice + 0.1), 0), I = ok.reduce((s, x) => s + x.q * x.v.buyPrice, 0);
  const waitH = Math.max(0, ...ok.map(x => x.q / Math.max(1, 0.05 * x.v.sellMovingWeek / 168)));
  const out = me ? (me.buyPrice - 0.1) * (1 - tax) * cnt : null;
  $("#craftBody").innerHTML = `<h2>${ic(id)}${esc(name(id))} <small>×${cnt}</small></h2>
    <table><thead><tr><th>Ingrédient</th><th>Qté</th><th>Ordre</th><th>Instant</th></tr></thead><tbody>
    ${L.map(x => `<tr><td>${ic(x.i)}${esc(name(x.i))}</td><td>${fmt(x.q)}</td><td>${x.v ? fmt(x.v.sellPrice + 0.1) : "–"}</td><td>${x.v ? fmt(x.v.buyPrice) : "–"}</td></tr>`).join("")}</tbody></table>
    ${miss.length ? `<p class="msg">Hors Bazaar (à farmer ou à l'enchère) : ${miss.map(m => esc(name(m))).join(", ")}. Non inclus dans les totaux.</p>` : ""}
    <label class="inl">Ton gain de farm (coins/h) <input id="fRate" type="text" value="${state.farm || FARM[state.level]}"></label>
    <div id="cRes"></div>`;
  const res = () => {
    const rate = parseNum($("#fRate").value) || FARM[state.level]; state.farm = rate;
    const farmH = W / rate, save = I > 0 ? (I - W) / I * 100 : 0;
    const [best, why] = save < 2 ? ["Prendre", "l'écart de prix est minime : achète directement."]
      : waitH <= 0.5 ? ["Attendre", `tes ordres se remplissent en ~${tm(waitH)} et tu économises ${fmt(I - W)} coins.`]
      : farmH <= waitH ? ["Farmer", `farmer te prend ~${tm(farmH)}, contre ~${tm(waitH)} d'attente.`]
      : waitH <= 4 ? ["Attendre", `~${tm(waitH)} d'attente pour économiser ${fmt(I - W)} coins.`]
      : ["Prendre", `l'attente (~${tm(waitH)}) est trop longue.`];
    const card = (n, t, c, s) => `<div class="opt ${best === n ? "best" : ""}"><b>${n}</b><span>${t}</span><small>${c}${s ? " · " + s : ""}</small></div>`;
    $("#cRes").innerHTML = `<div class="opts">${card("Prendre", "Achat instantané", fmt(I) + " coins", "tout de suite")}
      ${card("Attendre", "Ordres d'achat", fmt(W) + " coins", "~" + tm(waitH))}
      ${card("Farmer", "Tu récoltes", "0 coin", "~" + tm(farmH))}</div>
      <p class="tip"><b>${best}</b> : ${why}${out != null ? ` Revente nette ≈ ${fmt(out)} coins, soit ${out - W >= 0 ? "+" : ""}${fmt(out - W)} avec des ordres.` : ""}</p>
      <p class="sub">Estimation : tu captes ~5 % du flux du Bazaar et ton gain de farm est celui que tu indiques.</p>`;
  };
  $("#fRate").oninput = res; res();
}
