// Duskfall — combat: the player, attacks, class skills, monster AI,
// drops, XP and equipment. Crystals are the fuel of every fight.

import { CLASSES, CLASS_IDS, STONES, CRYSTAL_PER_STONE, rollStats, rollArmor, makeRng } from './data.js';
import { collide, randomFreeSpot } from './world.js';
import { sfx } from './audio.js';

export function createPlayer(rng) {
  const classId = CLASS_IDS[Math.floor(rng() * CLASS_IDS.length)];
  const cls = CLASSES[classId];
  const rolled = rollStats(rng);
  const stats = {
    hp: cls.hp + rolled.hp,
    atk: cls.atk + rolled.atk,
    def: cls.def + rolled.def,
    speed: Math.min(4.2, cls.speed + rolled.speed * 0.25),
    crit: Math.min(0.45, cls.crit + rolled.crit),
  };
  return {
    classId, cls, rolled,
    x: 15 * 32, y: 10 * 32, r: 15,
    hp: stats.hp, maxHp: stats.hp,
    crystals: 25, gold: 20,
    level: 1, xp: 0, xpNext: 40,
    stones: { speed: 0, str: 0, magic: 0, life: 0 },
    inventory: [], equipped: { weapon: null, armor: null, charm: null },
    attackCd: 0, skillCd: 0, hurtCd: 0, buffUntil: 0, buffMult: 1,
    aim: 0, kills: 0, floorsCleared: 0, hasDawnStone: false,
    baseStats: stats,
  };
}

export function gearStats(player) {
  const g = { hp: 0, atk: 0, def: 0, crit: 0 };
  for (const item of Object.values(player.equipped)) {
    if (!item) continue;
    g.hp += item.stats.hp || 0;
    g.atk += item.stats.atk || 0;
    g.def += item.stats.def || 0;
    g.crit += item.stats.crit || 0;
  }
  return g;
}

export function effectiveStats(player, now) {
  const g = gearStats(player);
  const buff = now < player.buffUntil ? player.buffMult : 1;
  return {
    hp: player.baseStats.hp + g.hp,
    atk: Math.round((player.baseStats.atk + g.atk) * buff),
    def: player.baseStats.def + g.def,
    speed: player.baseStats.speed,
    crit: Math.min(0.6, player.baseStats.crit + g.crit),
  };
}

export function syncMaxHp(player, now) {
  const max = effectiveStats(player, now).hp;
  const ratio = player.hp / player.maxHp;
  player.maxHp = max;
  player.hp = Math.min(max, Math.max(1, Math.round(max * ratio)));
}

export function gainXp(player, amount, now) {
  player.xp += amount;
  let leveled = false;
  while (player.xp >= player.xpNext) {
    player.xp -= player.xpNext;
    player.level += 1;
    player.xpNext = Math.round(player.xpNext * 1.35) + 10;
    player.baseStats.hp += 12;
    player.baseStats.atk += 2;
    player.baseStats.def += 1;
    leveled = true;
  }
  if (leveled) {
    syncMaxHp(player, now);
    player.hp = player.maxHp;
    sfx.levelup();
  }
  return leveled;
}

function spendCrystal(player, n) {
  if (player.crystals < n) return false;
  player.crystals -= n;
  return true;
}

function addText(area, x, y, text, color = '#fff') {
  area.texts.push({ x, y, text, color, life: 0.9 });
}

function addParticles(area, x, y, color, n = 8) {
  for (let i = 0; i < n; i++) {
    area.particles.push({
      x, y, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160,
      life: 0.4 + Math.random() * 0.3, color,
    });
  }
}

// Basic attack toward the mouse. Costs 1 crystal; with 0 crystals the
// player cannot fight at all — that is the core rule of this game.
export function playerAttack(player, area, mouse, now) {
  if (player.attackCd > 0 || player.hp <= 0) return false;
  if (!spendCrystal(player, 1)) return 'nocrystal';
  const st = effectiveStats(player, now);
  const dx = mouse.x - player.x, dy = mouse.y - player.y;
  const ang = Math.atan2(dy, dx);
  player.aim = ang;
  player.attackCd = player.cls.attackRate;
  const crit = Math.random() < st.crit;
  const dmg = Math.round(st.atk * (crit ? 2 : 1) * (0.9 + Math.random() * 0.2));
  if (player.classId === 'knight' || player.classId === 'support') {
    sfx.swing();
    const reach = player.cls.range + 14;
    for (const m of area.monsters) {
      if (m.dead) continue;
      const d = Math.hypot(m.x - player.x, m.y - player.y);
      if (d > reach + m.r) continue;
      const ma = Math.atan2(m.y - player.y, m.x - player.x);
      let diff = Math.abs(ma - ang);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      if (diff < 1.1) damageMonster(area, player, m, dmg, crit, now);
    }
    addParticles(area, player.x + Math.cos(ang) * 30, player.y + Math.sin(ang) * 30, '#e8e0f5', 4);
  } else {
    sfx.shoot();
    area.projectiles.push({
      x: player.x, y: player.y, vx: Math.cos(ang) * 520, vy: Math.sin(ang) * 520,
      r: 6, dmg, crit, from: 'player', color: player.classId === 'archer' ? '#a8ff7a' : '#c07bff',
      life: 1.2, pierce: player.classId === 'archer' ? 1 : 0,
    });
  }
  return true;
}

export function useSkill(player, area, mouse, now) {
  if (player.skillCd > 0 || player.hp <= 0) return false;
  if (!spendCrystal(player, player.cls.skill.cost)) return 'nocrystal';
  const st = effectiveStats(player, now);
  player.skillCd = 2.5;
  const dx = mouse.x - player.x, dy = mouse.y - player.y;
  const ang = Math.atan2(dy, dx);
  if (player.classId === 'archer') {
    for (let i = -2; i <= 2; i++) {
      const a = ang + i * 0.16;
      area.projectiles.push({
        x: player.x, y: player.y, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560,
        r: 5, dmg: Math.round(st.atk * 1.2), crit: false, from: 'player', color: '#a8ff7a', life: 1.1, pierce: 0,
      });
    }
    sfx.shoot();
  } else if (player.classId === 'knight') {
    sfx.swing();
    for (const m of area.monsters) {
      if (m.dead) continue;
      if (Math.hypot(m.x - player.x, m.y - player.y) < 130 + m.r) {
        damageMonster(area, player, m, Math.round(st.atk * 1.8), false, now);
      }
    }
    addParticles(area, player.x, player.y, '#e8b13c', 22);
  } else if (player.classId === 'mage') {
    sfx.boss();
    area.projectiles.push({
      x: mouse.x, y: mouse.y, vx: 0, vy: 0, r: 10, dmg: Math.round(st.atk * 2.2),
      crit: false, from: 'player', color: '#c07bff', life: 0.01, nova: 110, aoe: true,
    });
  } else {
    player.hp = Math.min(player.maxHp, player.hp + Math.round(player.maxHp * 0.4));
    player.buffUntil = now + 8;
    player.buffMult = 1.35;
    addParticles(area, player.x, player.y, '#ff9ecf', 20);
    addText(area, player.x, player.y - 26, '✚ HEAL + BUFF', '#ff9ecf');
    sfx.levelup();
  }
  return true;
}

export function damageMonster(area, player, m, dmg, crit, now) {
  if (m.dead) return;
  const st = effectiveStats(player, now);
  m.hp -= dmg;
  m.flash = 0.12;
  addText(area, m.x, m.y - m.r - 6, (crit ? 'CRIT ' : '') + dmg, crit ? '#ffd94a' : '#fff');
  addParticles(area, m.x, m.y, m.color, 5);
  sfx.hit();
  if (m.hp <= 0) {
    m.dead = true;
    player.kills += 1;
    addParticles(area, m.x, m.y, m.color, 18);
    gainXp(player, m.xp, now);
    rollDrops(area, player, m);
    if (m.kind === 'boss') {
      player.hasDawnStone = true;
      addText(area, m.x, m.y - 30, '☀️ LAST STONE CLAIMED!', '#ffd94a');
      sfx.win();
    }
  }
}

function rollDrops(area, player, m) {
  const rng = Math.random;
  // Stones: the fuel of the altar. Kind is random — a mage may well get a
  // knight stone, and that is exactly why the trader exists.
  if (rng() < 0.75) {
    const kinds = Object.keys(STONES);
    const kind = kinds[Math.floor(rng() * kinds.length)];
    const n = m.kind === 'boss' ? 5 : 1 + (rng() < 0.3 ? 1 : 0);
    area.drops.push({ x: m.x + (rng() - 0.5) * 30, y: m.y + (rng() - 0.5) * 30, kind: 'stone', stone: kind, n, r: 10 });
  }
  // Armor: random stats, random rarity, from monsters only.
  if (rng() < (m.kind === 'boss' ? 1 : 0.16)) {
    const floor = area.floor || 1;
    const item = rollArmor(makeRng(Math.floor(rng() * 1e9)), floor);
    area.drops.push({ x: m.x, y: m.y + 14, kind: 'armor', item, r: 12 });
  }
  // Hearts and gold keep a run alive.
  if (rng() < 0.25) area.drops.push({ x: m.x, y: m.y - 14, kind: 'heart', n: Math.round(player.maxHp * 0.2), r: 9 });
  if (rng() < 0.6) area.drops.push({ x: m.x + 16, y: m.y, kind: 'gold', n: 4 + Math.floor(rng() * 10), r: 8 });
}

export function collectDrops(player, area) {
  for (const d of area.drops) {
    if (d.taken) continue;
    if (Math.hypot(d.x - player.x, d.y - player.y) > player.r + d.r + 6) continue;
    d.taken = true;
    if (d.kind === 'stone') {
      player.stones[d.stone] += d.n;
      addText(area, player.x, player.y - 24, `+${d.n} ${STONES[d.stone].name}`, '#cfc4e8');
      sfx.stone();
    } else if (d.kind === 'armor') {
      player.inventory.push(d.item);
      addText(area, player.x, player.y - 24, `🎒 ${d.item.name}`, '#ffb340');
      sfx.pickup();
    } else if (d.kind === 'heart') {
      player.hp = Math.min(player.maxHp, player.hp + d.n);
      addText(area, player.x, player.y - 24, `+${d.n} HP`, '#7ddb6a');
      sfx.pickup();
    } else if (d.kind === 'gold') {
      player.gold += d.n;
      addText(area, player.x, player.y - 24, `+${d.n} 🪙`, '#f2c14e');
      sfx.coin();
    }
  }
  area.drops = area.drops.filter((d) => !d.taken);
}

export function equipItem(player, item, now) {
  const cur = player.equipped[item.slot];
  if (cur === item) { player.equipped[item.slot] = null; }
  else {
    player.equipped[item.slot] = item;
    if (cur) player.inventory.push(cur);
    player.inventory = player.inventory.filter((i) => i !== item);
  }
  syncMaxHp(player, now);
}

export function updateMonsters(area, player, dt, now) {
  for (const m of area.monsters) {
    if (m.dead) continue;
    if (m.flash > 0) m.flash -= dt;
    if (m.hitCd > 0) m.hitCd -= dt;
    const dx = player.x - m.x, dy = player.y - m.y;
    const d = Math.hypot(dx, dy) || 1;
    // Ranged monsters keep distance and shoot.
    if (m.ranged && d < 260) {
      m.shootCd -= dt;
      if (m.shootCd <= 0) {
        m.shootCd = 2.2;
        area.projectiles.push({
          x: m.x, y: m.y, vx: (dx / d) * 220, vy: (dy / d) * 220,
          r: 6, dmg: m.atk, crit: false, from: 'monster', color: '#ff5a8a', life: 2.2, pierce: 0,
        });
      }
      if (d < 110) { m.x -= (dx / d) * m.speed * 30 * dt; m.y -= (dy / d) * m.speed * 30 * dt; }
    } else {
      const step = m.speed * 32 * dt;
      const nx = m.x + (dx / d) * step;
      const ny = m.y + (dy / d) * step;
      const c = collide(area, nx, ny, m.r);
      m.x = c.x; m.y = c.y;
    }
    // Boss summons shadows as it weakens.
    if (m.kind === 'boss') {
      if (m.hp < m.maxHp * 0.5 && m.phase === 1) { m.phase = 2; m.speed = 2.2; sfx.boss(); }
      m.summonCd -= dt;
      if (m.summonCd <= 0 && area.monsters.filter((x) => !x.dead).length < 6) {
        m.summonCd = 7;
        const spot = randomFreeSpot(area, Math.random);
        area.monsters.push({
          kind: 'monster', type: 'wisp', name: 'Demon Shadow', x: spot.x, y: spot.y,
          r: 12, color: '#ff2e63', hp: 40, maxHp: 40, atk: 14, speed: 2.8,
          xp: 10, hitCd: 0, flash: 0, dead: false, ranged: true, shootCd: 1,
        });
        addText(area, spot.x, spot.y - 18, 'The Demon King calls a shadow!', '#ff5a8a');
      }
    }
    // Contact damage.
    if (d < m.r + player.r + 2 && m.hitCd <= 0 && player.hp > 0) {
      m.hitCd = 0.8;
      const st = effectiveStats(player, now);
      const dmg = Math.max(1, m.atk - st.def);
      player.hp -= dmg;
      player.hurtCd = 0.3;
      addText(area, player.x, player.y - 24, `-${dmg}`, '#ff6b6b');
      addParticles(area, player.x, player.y, '#ff6b6b', 6);
      sfx.hurt();
    }
  }
  area.monsters = area.monsters.filter((m) => !m.dead || m.kind === 'boss');
  // A floor is cleared when nothing hostile is left alive.
  if (area.kind === 'dungeon' && !area.cleared) {
    const alive = area.monsters.some((m) => !m.dead);
    if (!alive) {
      area.cleared = true;
      for (const o of area.objects) if (o.id === 'stairsDown') o.locked = false;
      addText(area, player.x, player.y - 30, '✦ Floor cleared — stairs open!', '#ffd94a');
      sfx.stairs();
    }
  }
}

export function updateProjectiles(area, player, dt, now) {
  for (const p of area.projectiles) {
    p.life -= dt;
    if (p.aoe) {
      // Mage nova: detonates where it was cast.
      for (const m of area.monsters) {
        if (m.dead) continue;
        if (Math.hypot(m.x - p.x, m.y - p.y) < p.nova + m.r) damageMonster(area, player, m, p.dmg, false, now);
      }
      addParticles(area, p.x, p.y, p.color, 26);
      p.life = 0;
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x < 20 || p.x > 940 || p.y < 20 || p.y > 580) { p.life = 0; continue; }
    if (p.from === 'player') {
      for (const m of area.monsters) {
        if (m.dead) continue;
        if (Math.hypot(m.x - p.x, m.y - p.y) < m.r + p.r) {
          damageMonster(area, player, m, p.dmg, p.crit, now);
          if (p.pierce > 0) { p.pierce -= 1; } else { p.life = 0; }
          break;
        }
      }
    } else if (player.hp > 0 && Math.hypot(player.x - p.x, player.y - p.y) < player.r + p.r) {
      const st = effectiveStats(player, now);
      const dmg = Math.max(1, p.dmg - st.def);
      player.hp -= dmg;
      player.hurtCd = 0.3;
      addText(area, player.x, player.y - 24, `-${dmg}`, '#ff6b6b');
      sfx.hurt();
      p.life = 0;
    }
  }
  area.projectiles = area.projectiles.filter((p) => p.life > 0);
}

export function updateFx(area, dt) {
  for (const p of area.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
  area.particles = area.particles.filter((p) => p.life > 0);
  for (const t of area.texts) { t.y -= 26 * dt; t.life -= dt; }
  area.texts = area.texts.filter((t) => t.life > 0);
}
