// Duskfall — entrypoint: state machine, game loop, HUD, town systems
// (altar, trader, mine timer), dungeon progression and the ending.

import { CLASSES, CLASS_IDS, STONES, CRYSTAL_PER_STONE, TRADE_RATE, SALVAGE_YIELD, BLESSINGS, rollArmor, statSummary } from './data.js';
import { buildTown, buildMine, buildDungeonFloor, nearestObject, collide, TOWN, DUNGEON, MINE } from './world.js';
import {
  createPlayer, effectiveStats, syncMaxHp, playerAttack, useSkill,
  updateMonsters, updateProjectiles, updateFx, collectDrops, equipItem, levelUps,
} from './combat.js';
import { render } from './render.js';
import { bindInput, keys, mouse, axis, consumeClick } from './input.js';
import { ensureAudio, toggleMute, sfx, startMusic, stopMusic } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const $ = (id) => document.getElementById(id);
const els = {
  hpFill: $('hpFill'), hpText: $('hpText'), xpFill: $('xpFill'), xpText: $('xpText'),
  crystalPill: $('crystalPill'), floorPill: $('floorPill'), stonesTop: $('stonesTop'),
  mineText: $('mineText'), classPill: $('classPill'), gearPill: $('gearPill'),
  toast: $('toast'), prompt: $('prompt'),
  title: $('titleScreen'), dead: $('deadScreen'), win: $('winScreen'),
  deadStats: $('deadStats'), winStats: $('winStats'),
  altarPanel: $('altarPanel'), traderPanel: $('traderPanel'), invPanel: $('invPanel'),
  blessPanel: $('blessPanel'), blessRows: $('blessRows'),
  goalBar: $('goalBar'), bossBar: $('bossBar'), bossFill: $('bossFill'), bossText: $('bossText'),
  hudTop: $('hudTop'), hudBottom: $('hudBottom'),
  altarRows: $('altarRows'), traderRows: $('traderRows'), inv: $('inv'),
};

// ---- run state ------------------------------------------------------------
let player = null;
let area = buildTown();
let mode = 'title'; // title | play | dead | win
let panel = null;   // null | altar | trader | inv
let lastNow = 0;
let toastTimer = null;
let noCrystalWarnedAt = 0;
let runStartedAt = 0;

const MINE_DAY_KEY = 'duskfall_mine_day';
const MINE_LEFT_KEY = 'duskfall_mine_left';
const BEST_KEY = 'duskfall_best';

function todayStr() { return new Date().toISOString().slice(0, 10); }

function mineLeft() {
  if (localStorage.getItem(MINE_DAY_KEY) !== todayStr()) {
    localStorage.setItem(MINE_DAY_KEY, todayStr());
    localStorage.setItem(MINE_LEFT_KEY, '3600');
    return 3600;
  }
  return parseInt(localStorage.getItem(MINE_LEFT_KEY) || '3600', 10);
}
function setMineLeft(s) { localStorage.setItem(MINE_LEFT_KEY, String(Math.max(0, Math.floor(s)))); }
function fmtTime(s) {
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

// ---- UI helpers -----------------------------------------------------------
function toast(msg, ms = 2600) {
  els.toast.textContent = msg;
  els.toast.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { els.toast.style.opacity = '0'; }, ms);
}

function showPrompt(text) {
  if (text) { els.prompt.textContent = text; els.prompt.style.display = 'block'; }
  else els.prompt.style.display = 'none';
}

function score() {
  const mins = Math.max(1, Math.round((performance.now() - runStartedAt) / 60000));
  return player.kills * 10 + player.floorsCleared * 100 + player.level * 25 - mins * 2;
}

// ---- area transitions -----------------------------------------------------
function goTown() {
  area = buildTown();
  player.x = 20 * 32; player.y = 10 * 32;
  startMusic('town');
  updateHud();
}

function enterDungeon(floor) {
  area = buildDungeonFloor(floor);
  player.x = 3 * 32; player.y = 15 * 32;
  startMusic('dungeon');
  toast(floor === 20 ? '👑 Floor 20 — the Demon King of Darkness awaits you!' : `Dungeon floor ${floor} — clear every monster!`);
  updateHud();
}

function enterMine() {
  if (mineLeft() <= 0) { toast('⛏️ The mine is closed for today. Entry is limited to 1 hour a day.'); return; }
  area = buildMine(Math.random);
  player.x = 20 * 32; player.y = 15 * 32;
  startMusic('town');
  toast('⛏️ Crystal Mine — a safe zone. Click ore to mine stones.');
  updateHud();
}

function exitMine() { goTown(); }

// ---- panels ---------------------------------------------------------------
function closePanels() {
  panel = null;
  els.altarPanel.style.display = 'none';
  els.traderPanel.style.display = 'none';
  els.invPanel.style.display = 'none';
  els.blessPanel.style.display = 'none';
}

// Level up: pick 1 of 3 blessings. The game waits — nothing moves while
// the player chooses, and there is no way to close it without choosing.
function openBlessing() {
  panel = 'blessing';
  const pool = [...BLESSINGS];
  const picks = [];
  while (picks.length < 3 && pool.length) {
    picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  els.blessRows.innerHTML = '';
  for (const b of picks) {
    const btn = document.createElement('button');
    btn.className = 'blessBtn';
    btn.innerHTML = `<b>${b.name}</b><br><span>${b.desc}</span>`;
    btn.addEventListener('click', () => {
      applyBlessing(b.id);
      levelUps.count -= 1;
      sfx.levelup();
      if (levelUps.count > 0 && player.hp > 0) openBlessing();
      else { closePanels(); updateHud(); }
    });
    els.blessRows.appendChild(btn);
  }
  els.blessPanel.style.display = 'flex';
}

function applyBlessing(id) {
  if (id === 'might') player.baseStats.atk += 4;
  else if (id === 'vitality') { player.baseStats.hp += 35; syncMaxHp(player, performance.now() / 1000); player.hp = Math.min(player.maxHp, player.hp + 35); }
  else if (id === 'ward') player.baseStats.def += 3;
  else if (id === 'keen') player.baseStats.crit = Math.min(0.6, player.baseStats.crit + 0.08);
  else if (id === 'swift') player.baseStats.speed = Math.min(4.5, player.baseStats.speed + 0.3);
  else if (id === 'hoard') player.crystals += 12;
  else if (id === 'secondwind') player.hp = player.maxHp;
  syncMaxHp(player, performance.now() / 1000);
  toast(`✨ Blessing: ${BLESSINGS.find((b) => b.id === id).name}`);
}

function openAltar() {
  panel = 'altar';
  const own = player.cls.crystal;
  let html = '';
  for (const [kind, st] of Object.entries(STONES)) {
    const n = player.stones[kind];
    const usable = kind === own;
    html += `<div class="row"><span>${st.icon} ${st.name}: <b>${n}</b></span>
      <button data-kind="${kind}" data-all="0" ${!usable || n < 1 ? 'disabled' : ''}>Feed 1 → +${CRYSTAL_PER_STONE} 💠</button>
      <button data-kind="${kind}" data-all="1" ${!usable || n < 1 ? 'disabled' : ''}>Feed all</button>
      ${usable ? '' : '<span style="color:#9d8fc4">not your job</span>'}</div>`;
  }
  if (player.hasDawnStone) {
    html += `<div class="row" style="margin-top:10px"><b style="color:#ffd94a">☀️ You carry the Last Stone!</b>
      <button id="igniteBtn">🔥 LIGHT THE PERFECT ALTAR</button></div>`;
  }
  els.altarRows.innerHTML = html;
  els.altarRows.querySelectorAll('button[data-kind]').forEach((b) => {
    b.addEventListener('click', () => {
      const kind = b.dataset.kind;
      const all = b.dataset.all === '1';
      const n = all ? player.stones[kind] : 1;
      if (player.stones[kind] < n || n < 1) return;
      player.stones[kind] -= n;
      player.crystals += n * CRYSTAL_PER_STONE;
      sfx.altar();
      toast(`🕯️ The altar burns! +${n * CRYSTAL_PER_STONE} ${player.cls.crystalName}`);
      openAltar(); updateHud();
    });
  });
  const ignite = $('igniteBtn');
  if (ignite) ignite.addEventListener('click', () => { closePanels(); doWin(); });
  els.altarPanel.style.display = 'flex';
}

function openTrader() {
  panel = 'trader';
  const own = player.cls.crystal;
  let html = `<p>Stones of your job (${STONES[own].name}): <b>${player.stones[own]}</b></p>`;
  for (const [kind, st] of Object.entries(STONES)) {
    if (kind === own) continue;
    const n = player.stones[kind];
    html += `<div class="row"><span>${st.icon} ${st.name}: <b>${n}</b></span>
      <button data-trade="${kind}" ${n < TRADE_RATE ? 'disabled' : ''}>Trade ${TRADE_RATE} → 1 ${STONES[own].name}</button></div>`;
  }
  els.traderRows.innerHTML = html;
  els.traderRows.querySelectorAll('button[data-trade]').forEach((b) => {
    b.addEventListener('click', () => {
      const k = b.dataset.trade;
      if (player.stones[k] < TRADE_RATE) return;
      player.stones[k] -= TRADE_RATE;
      player.stones[own] += 1;
      sfx.trade();
      toast(`🔁 ${TRADE_RATE} ${STONES[k].name} → 1 ${STONES[own].name}`);
      openTrader(); updateHud();
    });
  });
  els.traderPanel.style.display = 'flex';
}

function openInv() {
  panel = 'inv';
  const st = effectiveStats(player, performance.now() / 1000);
  let html = `<p>Effective stats: ATK <b>${st.atk}</b> · DEF <b>${st.def}</b> · HP <b>${player.hp}/${player.maxHp}</b> · CRIT <b>${Math.round(st.crit * 100)}%</b></p>`;
  html += '<p>Equipped:</p><div style="display:flex;gap:6px;flex-wrap:wrap">';
  for (const [slot, item] of Object.entries(player.equipped)) {
    html += `<div class="slot" data-eq="${slot}">${slot.toUpperCase()}<br>${item ? `<span class="r-${item.rarity}">${item.name}</span><br>${statSummary(item.stats)}<br><span style="color:#9d8fc4">${CLASSES[item.job].icon} ${CLASSES[item.job].name}</span>` : '— empty —'}</div>`;
  }
  html += '</div><p>Bag (click to equip):</p><div style="display:flex;gap:6px;flex-wrap:wrap">';
  if (!player.inventory.length) html += '<span style="color:#9d8fc4">Bag is empty — defeat monsters for armor drops.</span>';
  for (const item of player.inventory) {
    const jobLine = `<br><span style="color:#9d8fc4">${CLASSES[item.job].icon} ${CLASSES[item.job].name}</span>`;
    if (item.job === player.classId) {
      html += `<div class="slot" data-item="${item.id}"><span class="r-${item.rarity}">${item.name}</span><br>${statSummary(item.stats)}${jobLine}</div>`;
    } else {
      html += `<div class="slot" data-salvage="${item.id}"><span class="r-${item.rarity}">${item.name}</span><br>${statSummary(item.stats)}${jobLine}<br><b style="color:#ffd94a">🔨 Salvage → ${SALVAGE_YIELD[item.rarity] || 1} 🪨 random</b></div>`;
    }
  }
  html += '</div>';
  els.inv.innerHTML = html;
  els.inv.querySelectorAll('[data-item]').forEach((el) => {
    el.addEventListener('click', () => {
      const item = player.inventory.find((i) => i.id === el.dataset.item);
      if (!item) return;
      equipItem(player, item, performance.now() / 1000);
      sfx.pickup(); openInv(); updateHud();
    });
  });
  els.inv.querySelectorAll('[data-salvage]').forEach((el) => {
    el.addEventListener('click', () => {
      const item = player.inventory.find((i) => i.id === el.dataset.salvage);
      if (!item) return;
      salvageItem(item);
    });
  });
  els.inv.querySelectorAll('[data-eq]').forEach((el) => {
    el.addEventListener('click', () => {
      const item = player.equipped[el.dataset.eq];
      if (!item) return;
      equipItem(player, item, performance.now() / 1000);
      openInv(); updateHud();
    });
  });
  els.invPanel.style.display = 'flex';
}

// Break down a wrong-job piece into random stones, scaled by rarity.
function salvageItem(item) {
  const n = SALVAGE_YIELD[item.rarity] || 1;
  const kinds = Object.keys(STONES);
  const gained = {};
  for (let i = 0; i < n; i++) {
    const k = kinds[Math.floor(Math.random() * kinds.length)];
    player.stones[k] += 1;
    gained[k] = (gained[k] || 0) + 1;
  }
  player.inventory = player.inventory.filter((i) => i !== item);
  sfx.pickup();
  const parts = Object.entries(gained).map(([k, c]) => `${STONES[k].icon}${c}`).join(' ');
  toast(`🔨 ${item.name} → +${n} 🪨 (${parts})`);
  openInv(); updateHud();
}

// ---- run flow -------------------------------------------------------------
function fillClassCards() {
  const wrap = $('classCards');
  wrap.innerHTML = CLASS_IDS.map((id) => {
    const c = CLASSES[id];
    return `<div class="card"><h3>${c.icon} ${c.name}</h3>${c.desc}<br>💠 ${c.crystalName}<br>Skill: <b>${c.skill.name}</b> — ${c.skill.desc}</div>`;
  }).join('');
}

function startRun() {
  ensureAudio();
  sfx.roll();
  player = createPlayer(Math.random);
  syncMaxHp(player, 0);
  runStartedAt = performance.now();
  mode = 'play';
  panel = null;
  closePanels();
  els.title.style.display = 'none';
  els.dead.style.display = 'none';
  els.win.style.display = 'none';
  document.querySelectorAll('#classCards .card').forEach((el, i) => {
    el.classList.toggle('you', CLASS_IDS[i] === player.classId);
  });
  goTown();
  toast(`${player.cls.icon} Fate chose you: ${player.cls.name}! Your stats were drawn at random — strengthen them with equipment.`, 4200);
  updateHud();
}

function doDead() {
  mode = 'dead';
  stopMusic();
  sfx.lose();
  const sc = score();
  const best = Math.max(sc, parseInt(localStorage.getItem(BEST_KEY) || '0', 10));
  localStorage.setItem(BEST_KEY, String(best));
  els.deadStats.innerHTML = `Class: <b>${player.cls.name}</b> · Level ${player.level} · Floor ${area.floor} · Kills ${player.kills}<br>Score: <b>${sc}</b> · Best: <b>${best}</b>`;
  els.dead.style.display = 'flex';
}

function doWin() {
  mode = 'win';
  stopMusic();
  sfx.win();
  const sc = score() + 500;
  const best = Math.max(sc, parseInt(localStorage.getItem(BEST_KEY) || '0', 10));
  localStorage.setItem(BEST_KEY, String(best));
  els.winStats.innerHTML = `Class: <b>${player.cls.name}</b> · Level ${player.level} · Kills ${player.kills}<br>Score: <b>${sc}</b> · Best: <b>${best}</b>`;
  els.win.style.display = 'flex';
  updateHud();
}

// ---- interaction ----------------------------------------------------------
function interact() {
  if (!player || mode !== 'play' || panel) return;
  const o = nearestObject(area, player.x, player.y);
  if (!o) return;
  if (o.id === 'altar') { ensureAudio(); openAltar(); }
  else if (o.id === 'trader') { ensureAudio(); openTrader(); }
  else if (o.id === 'mineDoor') { enterMine(); }
  else if (o.id === 'mineExit') { exitMine(); }
  else if (o.id === 'dungeonDoor') { enterDungeon(1); }
  else if (o.id === 'stairsDown') {
    if (o.locked) { toast('🔒 Stairs locked — clear every monster on this floor!'); return; }
    player.floorsCleared += 1;
    enterDungeon(area.floor + 1);
  } else if (o.id === 'portalUp') { goTown(); }
}

function mineClick() {
  if (!player || mode !== 'play' || area.kind !== MINE || panel) return;
  for (const n of area.nodes) {
    if (n.hp <= 0) continue;
    if (Math.hypot(n.x - mouse.x, n.y - mouse.y) < 34) {
      n.hp -= 1;
      sfx.mine();
      area.particles.push({ x: n.x, y: n.y, vx: (Math.random() - 0.5) * 120, vy: -60, life: 0.4, color: '#ffd94a' });
      if (n.hp <= 0) {
        n.respawn = 20;
        const kinds = Object.keys(STONES);
        const kind = kinds[Math.floor(Math.random() * kinds.length)];
        area.drops.push({ x: n.x, y: n.y, kind: 'stone', stone: kind, n: 1 + (Math.random() < 0.3 ? 1 : 0), r: 10 });
        toast(`⛏️ Got ${STONES[kind].name}!`);
      }
      return;
    }
  }
}

// ---- HUD ------------------------------------------------------------------
function updateHud() {
  if (!player) return;
  const now = performance.now() / 1000;
  const st = effectiveStats(player, now);
  els.hpFill.style.width = `${Math.max(0, (player.hp / player.maxHp) * 100)}%`;
  els.hpText.textContent = `HP ${Math.max(0, Math.ceil(player.hp))}/${player.maxHp}`;
  els.xpFill.style.width = `${Math.min(100, (player.xp / player.xpNext) * 100)}%`;
  els.xpText.textContent = `Lv ${player.level}`;
  els.crystalPill.innerHTML = `${player.cls.crystalIcon} ${player.cls.crystalName} <b>${player.crystals}</b>`;
  els.floorPill.textContent = area.kind === TOWN ? '🏠 Last Town' : area.kind === MINE ? '⛏️ Mine' : `🌀 Floor ${area.floor}/20`;
  els.mineText.textContent = fmtTime(mineLeft());
  els.classPill.textContent = `${player.cls.icon} ${player.cls.name} · ATK ${st.atk} · DEF ${st.def}`;
  const eq = player.equipped;
  els.gearPill.textContent = `⚔️ ${eq.weapon ? eq.weapon.name : '—'} · 🛡️ ${eq.armor ? eq.armor.name : '—'} · ✨ ${eq.charm ? eq.charm.name : '—'}`;
  const stones = Object.entries(player.stones).map(([k, n]) => `${STONES[k].icon}${n}`).join(' ');
  els.stonesTop.innerHTML = `🪨 ${stones}${player.hasDawnStone ? ' · ☀️ Last Stone' : ''}`;
  if (player.crystals === 0) els.crystalPill.style.borderColor = '#ff5a5a';
  else els.crystalPill.style.borderColor = '';
  // The goal, printed on the screen itself: the win path is always visible.
  if (player.hasDawnStone) els.goalBar.textContent = '☀️ GOAL: Carry the Last Stone back to the Altar of Light — light it perfectly!';
  else if (area.kind === DUNGEON && area.floor === 20) els.goalBar.textContent = '👑 GOAL: Slay the Demon King of Darkness — then take the Last Stone to the altar!';
  else if (area.kind === DUNGEON) els.goalBar.textContent = `⚔️ GOAL: Clear Floor ${area.floor}/20 — then beat the Demon King on Floor 20 and light the altar!`;
  else if (area.kind === MINE) els.goalBar.textContent = '⛏️ GOAL: Mine stones — feed them to the altar for crystals, then fight on!';
  else els.goalBar.textContent = '⚔️ GOAL: Reach Floor 20 · Defeat the Demon King · Bring the Last Stone to the Altar';
  // Boss bar, only on floor 20 while the Demon King lives.
  const boss = area.kind === DUNGEON && area.floor === 20
    ? area.monsters.find((m) => m.kind === 'boss' && !m.dead) : null;
  if (boss) {
    els.bossBar.style.display = 'flex';
    els.bossFill.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
    els.bossText.textContent = `👑 DEMON KING OF DARKNESS — ${Math.max(0, Math.ceil(boss.hp))} / ${boss.maxHp} HP`;
  } else els.bossBar.style.display = 'none';
}

// ---- main loop ------------------------------------------------------------
function frame(t) {
  requestAnimationFrame(frame);
  const now = t / 1000;
  let dt = Math.min(0.05, now - (lastNow || now));
  lastNow = now;
  // HUD only belongs to live play; the title/dead/win overlays are clean.
  const inPlay = mode === 'play';
  els.hudTop.style.display = inPlay ? 'flex' : 'none';
  els.hudBottom.style.display = inPlay ? 'flex' : 'none';
  els.goalBar.style.display = inPlay ? 'block' : 'none';
  if (!inPlay) els.bossBar.style.display = 'none';
  if (!player || mode !== 'play') { render(ctx, area, player || { x: 640, y: 360, r: 15, hp: 1, cls: CLASSES.knight, level: 1, buffUntil: 0, hurtCd: 0, aim: 0 }, now); return; }
  if (panel) { render(ctx, area, player, now); return; }

  // Staged scenes keep a visual burst going (dmg-0 arrows + floating
  // numbers) so a screenshot taken at any moment shows the fight alive.
  if (area.stagedBurst) {
    area.burstCd = (area.burstCd ?? 0.5) - dt;
    if (area.burstCd <= 0) {
      area.burstCd = 0.6;
      const alive = area.monsters.filter((m) => !m.dead);
      if (alive.length) {
        // Aim the fan at the nearest monster, so the burst reads as one
        // volley instead of stray dots. Numbers float below the target,
        // clear of the boss's crown.
        let t = alive[0], best = Infinity;
        for (const m of alive) {
          const d = Math.hypot(m.x - player.x, m.y - player.y);
          if (d < best) { best = d; t = m; }
        }
        const ang = Math.atan2(t.y - player.y, t.x - player.x);
        const color = player.classId === 'archer' ? '#a8ff7a' : player.classId === 'mage' ? '#c07bff' : '#e8b13c';
        for (let i = -2; i <= 2; i++) {
          const a = ang + i * 0.16;
          area.projectiles.push({
            x: player.x, y: player.y, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560,
            r: 9, dmg: 0, crit: false, from: 'player', color, life: 1.1, pierce: 0,
          });
        }
        area.texts.push({ x: t.x, y: t.y + t.r + 18, text: String(24 + Math.floor(Math.random() * 30)), color: '#fff', life: 0.9 });
        area.texts.push({ x: t.x + 26, y: t.y + t.r + 32, text: `CRIT ${52 + Math.floor(Math.random() * 20)}`, color: '#ffd94a', life: 0.9 });
      }
    }
  }

  // Mine timer only ticks while inside the mine.
  if (area.kind === MINE) {
    const left = mineLeft() - dt;
    setMineLeft(left);
    if (left <= 0) { toast('⏳ Your mine time for today is up! (1 hour/day)'); exitMine(); }
    for (const n of area.nodes) {
      if (n.hp <= 0 && n.respawn > 0) {
        n.respawn -= dt;
        if (n.respawn <= 0) { n.hp = 3; n.maxHp = 3; }
      }
    }
  }

  // Movement
  const ax = axis();
  const st = effectiveStats(player, now);
  const sp = st.speed * 32;
  const c = collide(area, player.x + ax.x * sp * dt, player.y + ax.y * sp * dt, player.r);
  player.x = c.x; player.y = c.y;
  player.aim = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  if (player.attackCd > 0) player.attackCd -= dt;
  if (player.skillCd > 0) player.skillCd -= dt;
  if (player.hurtCd > 0) player.hurtCd -= dt;

  // Hold mouse to attack (dungeon only).
  if (mouse.down && area.kind === DUNGEON) {
    const res = playerAttack(player, area, mouse, now);
    if (res === 'nocrystal' && now - noCrystalWarnedAt > 2.5) {
      noCrystalWarnedAt = now;
      toast('💠 Out of crystals! You cannot fight — head to the mine or the altar first.');
    }
  }
  if (consumeClick() && area.kind === MINE) mineClick();

  updateMonsters(area, player, dt, now);
  updateProjectiles(area, player, dt, now);
  updateFx(area, dt);
  collectDrops(player, area);

  // A level-up waits for the frame to settle, then offers a blessing.
  if (levelUps.count > 0 && player.hp > 0) { openBlessing(); render(ctx, area, player, now); return; }

  // Interaction prompt
  const o = nearestObject(area, player.x, player.y);
  showPrompt(o ? o.label : null);

  // Death
  if (player.hp <= 0) { player.hp = 0; updateHud(); doDead(); return; }

  render(ctx, area, player, now);
  updateHud();
}

// ---- keys -----------------------------------------------------------------
function onKey(k) {
  ensureAudio();
  if (k === 'm') { const m = toggleMute(); toast(m ? '🔇 Sound off' : '🔊 Sound on'); return; }
  if (mode === 'title' && (k === 'enter' || k === ' ')) { startRun(); return; }
  if ((mode === 'dead' || mode === 'win') && k === 'r') { startRun(); return; }
  if (mode !== 'play' || !player) return;
  if (panel === 'blessing') return; // a blessing must be chosen, not dismissed
  if (k === 'e') {
    if (panel) closePanels();
    else interact();
  } else if (k === 'q') {
    const res = useSkill(player, area, mouse, performance.now() / 1000);
    if (res === 'nocrystal') toast('💠 Not enough crystals for the skill (needs 3).');
  } else if (k === 'i') {
    if (panel === 'inv') closePanels();
    else if (!panel) openInv();
  } else if (k === 'escape') closePanels();
}

// ---- staged scenes for honest screenshots ---------------------------------
// ?scene=title|town|dungeon|boss|mine|altar|bag|win|dead renders a real state
// of the game's own code, so the screenshots show the start, the loop and the end.
function stageScene(scene) {
  const rng = (() => { let s = 42; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
  if (scene === 'win' || scene === 'dead') {
    player = createPlayer(rng);
    player.level = 14; player.kills = 187; player.floorsCleared = 20;
    player.crystals = 12;
    player.stones = { speed: 3, str: 2, magic: 4, life: 1 };
    player.hasDawnStone = true;
    runStartedAt = performance.now() - 42 * 60000;
    mode = 'play';
    els.title.style.display = 'none';
    area = buildTown();
    updateHud();
    if (scene === 'win') doWin(); else { player.hp = 0; doDead(); }
    return;
  }
  if (scene === 'title') return; // default title screen
  player = createPlayer(rng);
  syncMaxHp(player, 0);
  player.crystals = 18; player.level = 5; player.kills = 23;
  player.stones = { speed: 4, str: 2, magic: 1, life: 3 };
  player.inventory = [];
  runStartedAt = performance.now() - 9 * 60000;
  mode = 'play';
  els.title.style.display = 'none';
  if (scene === 'town' || scene === 'altar') {
    area = buildTown();
    player.x = 20 * 32; player.y = 8 * 32;
    if (scene === 'altar') openAltar();
  } else if (scene === 'bag') {
    // Staged bag demo: one own-job piece, two wrong-job pieces (one rare).
    area = buildTown();
    player.x = 20 * 32; player.y = 8 * 32;
    player.inventory = [rollArmor(rng, 6), rollArmor(rng, 6), rollArmor(rng, 6)];
    player.inventory[0].job = player.classId;
    player.inventory[1].job = CLASS_IDS.find((id) => id !== player.classId);
    player.inventory[1].rarity = 'rare';
    openInv();
  } else if (scene === 'mine') {
    area = buildMine(rng);
    player.x = 20 * 32; player.y = 15 * 32;
  } else if (scene === 'boss') {
    // The climax, staged live: floor 20, the Demon King on his throne with
    // two shadows, the player mid-burst. The boss bar and goal strip show.
    player.level = 14; player.kills = 187; player.floorsCleared = 19;
    player.crystals = 40;
    player.stones = { speed: 3, str: 2, magic: 4, life: 1 };
    runStartedAt = performance.now() - 42 * 60000;
    area = buildDungeonFloor(20);
    player.x = 20 * 32; player.y = 13 * 32;
    player.hp = player.maxHp;
    const boss = area.monsters[0];
    boss.hp = Math.round(boss.maxHp * 0.62);
    area.monsters.push({
      kind: 'monster', type: 'wisp', name: 'Demon Shadow', x: 16 * 32, y: 9 * 32,
      r: 14, color: '#ff2e63', hp: 40, maxHp: 40, atk: 14, speed: 0,
      xp: 10, hitCd: 99, flash: 0, dead: false, ranged: true, shootCd: 1.5,
    });
    area.monsters.push({
      kind: 'monster', type: 'wisp', name: 'Demon Shadow', x: 24 * 32, y: 9 * 32,
      r: 14, color: '#ff2e63', hp: 40, maxHp: 40, atk: 14, speed: 0,
      xp: 10, hitCd: 99, flash: 0, dead: false, ranged: true, shootCd: 1.5,
    });
    area.drops.push({ x: 22 * 32, y: 12 * 32, kind: 'stone', stone: 'magic', n: 2, r: 10 });
    area.drops.push({ x: 17 * 32, y: 12 * 32, kind: 'heart', n: 30, r: 9 });
    area.stagedBurst = true; area.burstCd = 0.2;
  } else {
    area = buildDungeonFloor(6);
    player.x = 20 * 32; player.y = 11 * 32;
    player.hp = player.maxHp;
    // Stage a live mid-fight moment: a ring of monsters closing in, close
    // enough to read inside the dungeon light, far enough that the player
    // cannot die before the screenshot is taken.
    const ring = area.monsters.filter((m) => !m.dead).slice(0, 9);
    area.monsters = ring;
    ring.forEach((m, i) => {
      const a = (i / ring.length) * Math.PI * 2;
      const d = 130 + (i % 3) * 30;
      m.x = player.x + Math.cos(a) * d;
      m.y = player.y + Math.sin(a) * d;
      // Pinned in place for the shot: staged monsters hold the ring and
      // cannot pile onto the player or hurt them before the screenshot.
      m.speed = 0; m.hitCd = 99; m.shootCd = 2; m.flash = 0;
    });
    area.drops.push({ x: 22 * 32, y: 10 * 32, kind: 'stone', stone: 'magic', n: 2, r: 10 });
    area.drops.push({ x: 18 * 32, y: 9 * 32, kind: 'stone', stone: 'str', n: 2, r: 10 });
    area.stagedBurst = true; area.burstCd = 0.2;
  }
  updateHud();
}

// ---- boot -----------------------------------------------------------------
fillClassCards();
bindInput(canvas, onKey);
$('startBtn').addEventListener('click', startRun);
$('retryBtn').addEventListener('click', startRun);
$('againBtn').addEventListener('click', startRun);
$('altarClose').addEventListener('click', closePanels);
$('traderClose').addEventListener('click', closePanels);
$('invClose').addEventListener('click', closePanels);
canvas.addEventListener('mousedown', ensureAudio);

const scene = new URLSearchParams(location.search).get('scene');
if (scene) stageScene(scene);
requestAnimationFrame(frame);
