"use strict";
// Objectif de gain : combien veux-tu gagner, avec quel objet (ou au choix) ?
const perHour = r => r.weekly / 168 * 0.05;   // objets captables par heure (≈ 5 % du flux)
function planInit() {
  if (!$("#plList").children.length && state.live) $("#plList").innerHTML = Object.keys(state.live).map(id => `<option value="${esc(name(id))}">`).join("");
  if (!$("#plBudget").value) $("#plBudget").value = Math.round(state.wealth ?? (parseNum($("#budget").value) || 0)) || "";
}
function bestMix(B) {
  const c = state.rows.filter(x => !x.sus && x.pct >= 1.5 && x.weekly >= 5e4 && x.buyP <= B)
    .map(r => ({ r, g: r.profit * Math.min(Math.floor(B / r.buyP), perHour(r)) })).sort((a, b) => b.g - a.g).slice(0, 8);
  let best = null;
  for (let n = 1; n <= c.length; n++) {
    const per = B / n, items = c.slice(0, n).map(({ r }) => { const u = Math.max(0, Math.min(Math.floor(per / r.buyP), Math.floor(perHour(r)))); return { r, u, g: r.profit * u }; });
    const rate = items.reduce((s, x) => s + x.g, 0);
    if (!best || rate > best.rate) best = { rate, items };
  }
  return best;
}
const dur = h => h > 48 ? `~${Math.round(h / 24)} jours` : tm(h);

$("#plGo").onclick = () => {
  const T = parseNum($("#plGoal").value), B = parseNum($("#plBudget").value), q = $("#plItem").value.trim().toLowerCase(), out = $("#plOut");
  if (!(T > 0) || !(B > 0)) return out.innerHTML = '<p class="msg">Entre un objectif et un budget valides (ex : 500k, 2m).</p>';
  if (!state.rows.length) return out.innerHTML = '<p class="msg">Les prix ne sont pas encore chargés, réessaie dans un instant.</p>';
  const mix = bestMix(B);
  const mixHtml = !mix || mix.rate <= 0 ? "<p>Aucun flip rentable possible avec ce budget pour l'instant.</p>" :
    `<h3>Plan conseillé (plusieurs objets)</h3><p>Répartis ton budget sur <b>${mix.items.length}</b> objet(s) : gain estimé <b class="pos">${fmt(mix.rate)}/h</b>, soit <b>${fmt(T)} coins en ${dur(T / mix.rate)}</b>.</p>
     <div class="wrap"><table><thead><tr><th>Objet</th><th>À acheter par tour</th><th>Capital</th><th>Gain / h</th></tr></thead><tbody>${mix.items.filter(x => x.u > 0).map(x =>
       `<tr><td><button class="nm" data-craft="${x.r.id}">${ic(x.r.id)}${esc(x.r.name)}</button></td><td>${fmt(x.u)}</td><td>${fmt(x.u * x.r.buyP)}</td><td class="pos">+${fmt(x.g)}</td></tr>`).join("")}</tbody></table></div>`;
  let single = "";
  if (q) {
    const ids = Object.keys(state.live || {}), id = ids.find(i => name(i).toLowerCase() === q) || ids.find(i => i.toLowerCase() === q);
    if (!id) return out.innerHTML = '<p class="msg">Objet introuvable au Bazaar : choisis-en un dans la liste proposée, ou laisse le champ vide.</p>';
    const r = state.rows.find(x => x.id === id);
    if (!r) single = `<p class="msg">${ic(id)}${esc(name(id))} n'est pas rentable en flip pour l'instant (marge négative après taxe).</p>`;
    else {
      const qty = Math.ceil(T / r.profit), cap = qty * r.buyP, aff = Math.floor(B / r.buyP), h = qty / perHour(r), notes = [];
      if (cap > B) notes.push(aff < 1 ? "Ton budget ne permet pas d'acheter un seul exemplaire." : `Il te faut ${fmt(cap)} coins : avec ${fmt(B)}, fais environ ${Math.ceil(qty / aff)} tours (tu rachètes avec l'argent des ventes).`);
      if (r.sus) notes.push("Prix suspect (marge très élevée ou volume très faible) : vérifie qu'il n'est pas manipulé.");
      if (r.risk === "risk") notes.push("Volume faible : la revente peut être lente.");
      if (qty > 71680) notes.push("La quantité dépasse la limite d'environ 71 680 objets par ordre : il faudra plusieurs ordres.");
      if (h > 24) notes.push("Cela représente plusieurs jours de jeu à ce rythme.");
      single = `<h3>${ic(id)}${esc(r.name)}</h3><div class="kpis"><div class="kpi"><small>Profit par objet</small><b class="pos">+${fmt(r.profit)}</b></div><div class="kpi"><small>Quantité à flipper</small><b>${fmt(qty)}</b></div>
        <div class="kpi"><small>Capital nécessaire</small><b>${fmt(cap)}</b></div><div class="kpi"><small>Temps estimé</small><b>${dur(h)}</b></div></div>
        ${notes.map(n => `<p class="tip">${n}</p>`).join("")}`;
    }
  }
  out.innerHTML = single + mixHtml + '<p class="sub">Estimations : tu captes ~5 % du flux du Bazaar et les prix changent vite.</p>';
};
$("#plOut").onclick = e => { const c = e.target.closest("[data-craft]"); if (c) openCraft(c.dataset.craft); };
