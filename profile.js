"use strict";
// Connexion par clé API Hypixel (lecture seule) : aucun mot de passe Minecraft.
const HX = "https://api.hypixel.net/v2/";
const SKT = [50,125,200,300,500,750,1e3,1500,2e3,3500,5e3,7500,1e4,15e3,2e4,3e4,5e4,75e3,1e5,2e5,3e5,4e5,5e5,6e5,7e5,8e5,9e5,1e6,11e5,12e5,13e5,14e5,15e5,16e5,17e5,18e5,19e5,2e6,21e5,22e5,23e5,24e5,25e5,26e5,275e4,29e5,31e5,34e5,37e5,4e6,43e5,46e5,49e5,52e5,55e5,58e5,61e5,64e5,67e5,7e6];
const CATA = [50,75,110,160,230,330,470,670,950,1340,1890,2665,3760,5260,7380,10300,14400,20000,27600,38000,52500,71500,97000,132000,180000,243000,328000,445000,6e5,8e5,1065e3,141e4,19e5,25e5,33e5,43e5,56e5,72e5,92e5,12e6,15e6,19e6,24e6,3e7,38e6,48e6,6e7,75e6,93e6,116250e3];
const SLY = [5,15,200,1e3,5e3,2e4,1e5,4e5,1e6];
const SK = { FARMING: ["Agriculture", 60], MINING: ["Minage", 60], COMBAT: ["Combat", 60], FORAGING: ["Forêt", 50], FISHING: ["Pêche", 50], ENCHANTING: ["Enchantement", 60], ALCHEMY: ["Alchimie", 50], TAMING: ["Dressage", 50] };
const SLAYERS = { zombie: "Zombie", spider: "Araignée", wolf: "Loup", enderman: "Enderman", blaze: "Blaze", vampire: "Vampire" };
const SS = sessionStorage;

function lvl(xp, table, cap) {
  let sum = 0;
  for (let i = 0; i < Math.min(cap, table.length); i++) {
    if (xp < sum + table[i]) return i + (xp - sum) / table[i];
    sum += table[i];
  }
  return cap;
}
async function hx(path, key) {
  const r = await fetch(HX + path, { headers: { "API-Key": key } });
  const j = await r.json();
  if (!j.success) throw new Error(j.cause || "Erreur " + r.status);
  return j;
}
async function toUuid(n) {
  n = n.trim();
  if (/^[0-9a-f-]{32,36}$/i.test(n)) return { id: n.replace(/-/g, ""), name: n };
  const j = await (await fetch("https://playerdb.co/api/player/minecraft/" + encodeURIComponent(n))).json();
  if (!j.success) throw new Error("Pseudo introuvable.");
  return { id: j.data.player.raw_id, name: j.data.player.username };
}
const msg = (t, ok) => { const m = $("#pfMsg"); m.textContent = t; m.className = "msg" + (ok ? " ok" : ""); };

async function connect() {
  const key = $("#pfKey").value.trim(), nm = $("#pfName").value.trim();
  if (!key || !nm) return msg("Renseigne ton pseudo et ta clé.");
  msg("Connexion…", true);
  try {
    const u = await toUuid(nm);
    const j = await hx("skyblock/profiles?uuid=" + u.id, key);
    const p = (j.profiles || []).find(x => x.selected) || (j.profiles || [])[0];
    if (!p) throw new Error("Aucun profil SkyBlock trouvé.");
    const keep = $("#pfRem").checked ? localStorage : SS;
    localStorage.removeItem("pf"); SS.removeItem("pf");
    keep.setItem("pf", JSON.stringify({ key, name: u.name }));
    msg("");
    $("#connect").hidden = true;
    renderProfile(u, p);
  } catch (e) {
    msg(e instanceof TypeError ? "Connexion bloquée (réseau ou CORS). Réessaie ou vérifie ta clé." : e.message);
  }
}

function renderProfile(u, p) {
  const m = p.members[u.id] || {};
  const exp = (m.leveling?.experience || 0) / 100, L = Math.floor(exp), pr = exp - L;
  const purse = m.currencies?.coin_purse || 0, bank = p.banking?.balance || 0;
  const xs = m.player_data?.experience || {};
  const sk = Object.entries(SK).map(([k, [fr, cap]]) => { const x = xs["SKILL_" + k]; return { fr, cap, l: x == null ? null : lvl(x, SKT, cap) }; });
  const ok = sk.filter(s => s.l != null);
  const avg = ok.length ? ok.reduce((a, s) => a + s.l, 0) / ok.length : null;
  const cata = m.dungeons?.dungeon_types?.catacombs?.experience;
  const fairy = m.fairy_soul?.total_collected;
  const sl = Object.entries(SLAYERS).map(([k, fr]) => [fr, m.slayer?.slayer_bosses?.[k]?.xp || 0]).filter(s => s[1] > 0);
  const weak = ok.length ? ok.reduce((a, b) => a.l / a.cap < b.l / b.cap ? a : b) : null;
  const tier = L < 100 ? "debutant" : L < 200 ? "inter" : L < 320 ? "avance" : "expert";

  const C = 163.4;
  $("#pfBody").innerHTML = `<div class="pf">
    <div class="hd">
      <img src="https://mc-heads.net/avatar/${esc(u.id)}/64" alt="" onerror="this.remove()">
      <div class="grow"><h2>${esc(u.name)}</h2><small>Profil « ${esc(p.cute_name || "?")} »</small></div>
      <svg class="ring" viewBox="0 0 64 64" role="img" aria-label="Niveau SkyBlock ${L}"><circle cx="32" cy="32" r="26" fill="none" stroke="var(--line)" stroke-width="6"/>
        <circle cx="32" cy="32" r="26" fill="none" stroke="var(--gold)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(pr * C).toFixed(1)} ${C}" transform="rotate(-90 32 32)"/>
        <text x="32" y="39" text-anchor="middle">${L}</text></svg>
    </div>
    <div class="kpis">
      <div class="kpi"><small>Bourse</small><b>${fmt(purse)}</b></div>
      <div class="kpi"><small>Banque</small><b>${fmt(bank)}</b></div>
      <div class="kpi"><small>Moy. compétences</small><b>${avg == null ? "–" : avg.toFixed(1)}</b></div>
      <div class="kpi"><small>Catacombes</small><b>${cata == null ? "–" : lvl(cata, CATA, 50).toFixed(1)}</b></div>
      <div class="kpi"><small>Âmes de fée</small><b>${fairy ?? "–"}</b></div>
    </div>
    <div class="cols">
      <div><span class="lbl">Compétences</span>${ok.length ? `<div class="sk">${sk.filter(s => s.l != null).map(s => `<div class="bar"><span>${s.fr}</span><i><s style="width:${s.l / s.cap * 100}%"></s></i><b>${Math.floor(s.l)}</b></div>`).join("")}</div>` : `<p class="sub">L'API des compétences est désactivée dans les réglages SkyBlock du jeu.</p>`}</div>
      <div><span class="lbl">Slayers (XP)</span><div class="chips">${sl.length ? sl.map(([n, x]) => `<span class="tag">${n} ${fmt(x)}</span>`).join("") : `<span class="sub">Aucun</span>`}</div></div>
    </div>
    <p class="tip">Conseils réglés sur le niveau <b>${LEVELS[tier].label}</b> (niveau SkyBlock ${L}) avec un budget de ${fmt(purse + bank)}.${weak ? ` Ta compétence la plus faible : ${weak.fr} (niv. ${Math.floor(weak.l)}).` : ""}</p>
    <button id="pfOut" class="link">Déconnecter</button>
  </div>`;
  $("#pfOut").onclick = () => { localStorage.removeItem("pf"); SS.removeItem("pf"); $("#pfBody").innerHTML = ""; $("#connect").hidden = false; $("#pfKey").value = ""; state.sb = null; autoTier(); };
  state.sb = L; setTier(tier);
  if (purse + bank > 0) { $("#budget").value = Math.round(purse + bank); $("#budget").dispatchEvent(new Event("input")); }
}

$("#pfGo").onclick = connect;
const saved = (() => { try { return JSON.parse(SS.getItem("pf") || localStorage.getItem("pf")); } catch { return null; } })();
if (saved) { $("#pfName").value = saved.name; $("#pfKey").value = saved.key; connect(); }
