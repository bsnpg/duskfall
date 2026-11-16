// Duskfall — entrypoint: state machine, game loop, HUD, town systems
// (altar, trader, mine timer), dungeon progression and the ending.

import { CLASSES, CLASS_IDS, STONES, CRYSTAL_PER_STONE, TRADE_RATE, statSummary } from './data.js';
import { buildTown, buildMine, buildDungeonFloor, nearestObject, collide, TOWN, DUNGEON, MINE } from './world.js';
import {
  createPlayer, effectiveStats, syncMaxHp, playerAttack, useSkill,
  updateMonsters, updateProjectiles, updateFx, collectDrops, equipItem,
} from './combat.js';
import { render } from './render.js';
import { bindInput, keys, mouse, axis, consumeClick } from './input.js';
import { ensureAudio, toggleMute, sfx, startMusic, stopMusic } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const $ = (id) => document.getElementById(id);
const els = {
  hpFill: $('hpFill'), hpText: $('hpText'), xpFill: $('xpFill'), xpText: $('xpText'),
  crystalPill: $('crystalPill'), floorPill: $('floorPill'), goldText: $('goldText'),
  mineText: $('mineText'), classPill: $('classPill'), gearPill: $('gearPill'),
  stonePill: $('stonePill'), toast: $('toast'), prompt: $('prompt'),
  title: $('titleScreen'), dead: $('deadScreen'), win: $('winScreen'),
  deadStats: $('deadStats'), winStats: $('winStats'),
  altarPanel: $('altarPanel'), traderPanel: $('traderPanel'), invPanel: $('invPanel'),
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
  player.x = 15 * 32; player.y = 10 * 32;
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
  player.x = 15 * 32; player.y = 15 * 32;
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
  let html = `<p>💰 Your gold: <b>${player.gold}</b> &nbsp;·&nbsp; Stones of your job (${STONES[own].name}): <b>${player.stones[own]}</b></p>`;
  for (const [kind, st] of Object.entries(STONES)) {
    if (kind === own) continue;
    const n = player.stones[kind];
    html += `<div class="row"><span>${st.icon} ${st.name}: <b>${n}</b></span>
      <button data-trade="${kind}" ${n < TRADE_RATE ? 'disabled' : ''}>Trade ${TRADE_RATE} → 1 ${STONES[own].name}</button>
      <button data-sell="${kind}" ${n < 1 ? 'disabled' : ''}>Sell 1 (+10 🪙)</button></div>`;
  }
  html += `<div class="row"><span>Buy 1 ${STONES[own].name}</span>
    <button data-buy="1" ${player.gold < 25 ? 'disabled' : ''}>25 🪙</button></div>`;
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
  els.traderRows.querySelectorAll('button[data-sell]').forEach((b) => {
    b.addEventListener('click', () => {
      const k = b.dataset.sell;
      if (player.stones[k] < 1) return;
      player.stones[k] -= 1; player.gold += 10;
      sfx.coin(); openTrader(); updateHud();
    });
  });
  els.traderRows.querySelectorAll('button[data-buy]').forEach((b) => {
    b.addEventListener('click', () => {
      if (player.gold < 25) return;
      player.gold -= 25; player.stones[own] += 1;
      sfx.coin(); openTrader(); updateHud();
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
    html += `<div class="slot" data-eq="${slot}">${slot.toUpperCase()}<br>${item ? `<span class="r-${item.rarity}">${item.name}</span><br>${statSummary(item.stats)}` : '— empty —'}</div>`;
  }
  html += '</div><p>Bag (click to equip):</p><div style="display:flex;gap:6px;flex-wrap:wrap">';
  if (!player.inventory.length) html += '<span style="color:#9d8fc4">Bag is empty — defeat monsters for armor drops.</span>';
  for (const item of player.inventory) {
    html += `<div class="slot" data-item="${item.id}"><span class="r-${item.rarity}">${item.name}</span><br>${statSummary(item.stats)}</div>`;
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
  els.goldText.textContent = player.gold;
  els.mineText.textContent = fmtTime(mineLeft());
  els.classPill.textContent = `${player.cls.icon} ${player.cls.name} · ATK ${st.atk} · DEF ${st.def}`;
  const eq = player.equipped;
  els.gearPill.textContent = `⚔️ ${eq.weapon ? eq.weapon.name : '—'} · 🛡️ ${eq.armor ? eq.armor.name : '—'} · ✨ ${eq.charm ? eq.charm.name : '—'}`;
  const stones = Object.entries(player.stones).map(([k, n]) => `${STONES[k].icon}${n}`).join(' ');
  els.stonePill.textContent = `🪨 ${stones}${player.hasDawnStone ? ' · ☀️ Last Stone' : ''}`;
  if (player.crystals === 0) els.crystalPill.style.borderColor = '#ff5a5a';
  else els.crystalPill.style.borderColor = '';
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
  if (!player || mode !== 'play') { render(ctx, area, player || { x: 480, y: 300, r: 15, hp: 1, cls: CLASSES.knight, level: 1, buffUntil: 0, hurtCd: 0, aim: 0 }, now); return; }
  if (panel) { render(ctx, area, player, now); return; }

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
// ?scene=title|town|dungeon|mine|altar|win|dead renders a real state of the
// game's own code, so the screenshots show the start, the loop and the end.
function stageScene(scene) {
  const rng = (() => { let s = 42; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
  if (scene === 'win' || scene === 'dead') {
    player = createPlayer(rng);
    player.level = 14; player.kills = 187; player.floorsCleared = 20;
    player.crystals = 12; player.gold = 340;
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
  player.crystals = 18; player.gold = 120; player.level = 5; player.kills = 23;
  player.stones = { speed: 4, str: 2, magic: 1, life: 3 };
  player.inventory = [];
  runStartedAt = performance.now() - 9 * 60000;
  mode = 'play';
  els.title.style.display = 'none';
  if (scene === 'town' || scene === 'altar') {
    area = buildTown();
    player.x = 15 * 32; player.y = 8 * 32;
    if (scene === 'altar') openAltar();
  } else if (scene === 'mine') {
    area = buildMine(rng);
    player.x = 15 * 32; player.y = 9 * 32;
  } else {
    area = buildDungeonFloor(6);
    player.x = 12 * 32; player.y = 10 * 32;
    player.hp = player.maxHp;
    // Stage a live mid-fight moment: a ring of monsters closing in, close
    // enough to read inside the dungeon light, far enough that the player
    // cannot die before the screenshot is taken.
    const ring = area.monsters.filter((m) => !m.dead).slice(0, 7);
    area.monsters = ring;
    ring.forEach((m, i) => {
      const a = (i / ring.length) * Math.PI * 2;
      const d = 150 + (i % 3) * 30;
      m.x = player.x + Math.cos(a) * d;
      m.y = player.y + Math.sin(a) * d;
      m.hitCd = 1.5; m.shootCd = 2; m.flash = 0;
    });
    area.drops.push({ x: 14 * 32, y: 9 * 32, kind: 'stone', stone: 'magic', n: 2, r: 10 });
    area.drops.push({ x: 10 * 32, y: 8 * 32, kind: 'gold', n: 12, r: 8 });
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
