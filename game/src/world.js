// Duskfall — world building: town, dungeon floors and the crystal mine.
// Areas are rectangles of tiles with solid blocks and interactable objects.

import { TILE, VIEW_W, VIEW_H, MONSTER_TYPES, MINI_BOSSES, FINAL_BOSS, makeRng } from './data.js';

export const TOWN = 'town';
export const DUNGEON = 'dungeon';
export const MINE = 'mine';

const W = Math.floor(VIEW_W / TILE); // 30
const H = Math.floor(VIEW_H / TILE); // 18

function borderSolids() {
  return [
    { x: 0, y: 0, w: W, h: 1 }, { x: 0, y: H - 1, w: W, h: 1 },
    { x: 0, y: 0, w: 1, h: H }, { x: W - 1, y: 0, w: 1, h: H },
  ];
}

export function buildTown() {
  return {
    kind: TOWN, floor: 0, label: 'Last Town',
    solids: [
      ...borderSolids(),
      { x: 4, y: 3, w: 4, h: 3 },   // house west
      { x: 22, y: 3, w: 4, h: 3 },  // house east
      { x: 13, y: 2, w: 4, h: 2 },  // altar dais base
    ],
    objects: [
      { id: 'altar', x: 15 * TILE, y: 3.2 * TILE, r: 44, label: 'Altar of Light (E)' },
      { id: 'trader', x: 24 * TILE, y: 5 * TILE, r: 40, label: 'Merchant Bram (E)' },
      { id: 'mineDoor', x: 2 * TILE, y: 9 * TILE, r: 42, label: 'Crystal Mine (E)' },
      { id: 'dungeonDoor', x: 15 * TILE, y: 16 * TILE, r: 46, label: 'Enter Dungeon (E)' },
    ],
    nodes: [],
    monsters: [], drops: [], projectiles: [], particles: [], texts: [],
  };
}

export function buildMine(rng) {
  const nodes = [];
  for (let i = 0; i < 9; i++) {
    nodes.push({
      x: (3 + rng() * 24) * TILE, y: (3 + rng() * 12) * TILE,
      hp: 3, maxHp: 3, kind: 'ore', respawn: 0,
    });
  }
  return {
    kind: MINE, floor: 0, label: 'Crystal Mine — Safe Zone',
    solids: [
      ...borderSolids(),
      { x: 7, y: 6, w: 2, h: 2 }, { x: 19, y: 10, w: 3, h: 2 }, { x: 12, y: 12, w: 2, h: 2 },
    ],
    objects: [
      { id: 'mineExit', x: 15 * TILE, y: 16.5 * TILE, r: 46, label: 'Leave Mine (E)' },
    ],
    nodes, monsters: [], drops: [], projectiles: [], particles: [], texts: [],
  };
}

function pickMonsterTypes(floor, rng) {
  const avail = MONSTER_TYPES.filter((m) => m.minFloor <= floor);
  const n = Math.min(3 + Math.floor(floor / 4), avail.length);
  const out = [];
  for (let i = 0; i < n; i++) out.push(avail[Math.floor(rng() * avail.length)]);
  return out;
}

export function buildDungeonFloor(floor) {
  const rng = makeRng(1000 + floor * 77);
  const isBossFloor = floor === 20;
  const isMiniFloor = floor % 5 === 0 && !isBossFloor;
  const solids = [...borderSolids()];
  // A few pillars, never on the spawn row.
  const pillars = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < pillars; i++) {
    solids.push({ x: 3 + Math.floor(rng() * 22), y: 3 + Math.floor(rng() * 10), w: 2, h: 2 });
  }
  const monsters = [];
  if (isBossFloor) {
    monsters.push(makeBoss());
  } else {
    const types = pickMonsterTypes(floor, rng);
    const count = Math.min(4 + floor, 16);
    for (let i = 0; i < count; i++) {
      const t = types[Math.floor(rng() * types.length)];
      monsters.push(makeMonster(t, floor, rng));
    }
    if (isMiniFloor) monsters.push(makeMiniBoss(floor, rng));
  }
  const objects = [
    { id: 'portalUp', x: 3 * TILE, y: 16 * TILE, r: 40, label: 'Back to Town (E)' },
  ];
  // Floor 20 has no stairs down: the only way on is back to town, carrying
  // the Dawn Stone to the altar.
  if (!isBossFloor) {
    objects.unshift({ id: 'stairsDown', x: 27 * TILE, y: 2 * TILE, r: 40, label: 'Descend (E)', locked: true });
  }
  return {
    kind: DUNGEON, floor, label: isBossFloor ? 'Floor 20 — Throne of the Demon King' : `Dungeon — Floor ${floor}`,
    solids,
    objects,
    nodes: [], monsters, drops: [], projectiles: [], particles: [], texts: [],
    cleared: monsters.length === 0,
  };
}

export function makeMonster(type, floor, rng) {
  const scale = 1 + (floor - 1) * 0.13;
  const x = (4 + rng() * 22) * TILE;
  const y = (3 + rng() * 11) * TILE;
  return {
    kind: 'monster', type: type.id, name: type.name,
    x, y, r: type.size, color: type.color,
    hp: Math.round(type.hp * scale), maxHp: Math.round(type.hp * scale),
    atk: Math.round(type.atk * (1 + (floor - 1) * 0.09)),
    speed: type.speed * (0.9 + rng() * 0.25),
    xp: type.xp, hitCd: 0, flash: 0, dead: false,
    ranged: type.id === 'darkmage' || type.id === 'wisp',
    shootCd: 1 + rng() * 2,
  };
}

export function makeMiniBoss(floor, rng) {
  const idx = Math.min(Math.floor(floor / 5) - 1, MINI_BOSSES.length - 1);
  const base = MINI_BOSSES[Math.max(0, idx)];
  const scale = 1 + (floor - 1) * 0.13;
  return {
    kind: 'monster', type: 'miniboss', name: base.name,
    x: 15 * TILE, y: 5 * TILE, r: 22, color: base.color,
    hp: Math.round(220 * scale), maxHp: Math.round(220 * scale),
    atk: Math.round(18 * (1 + (floor - 1) * 0.09)),
    speed: 1.5, xp: 120, hitCd: 0, flash: 0, dead: false, ranged: false, shootCd: 2,
  };
}

export function makeBoss() {
  return {
    kind: 'boss', type: 'demonking', name: FINAL_BOSS.name,
    x: 15 * TILE, y: 5 * TILE, r: FINAL_BOSS.size, color: FINAL_BOSS.color,
    hp: FINAL_BOSS.hp, maxHp: FINAL_BOSS.hp, atk: FINAL_BOSS.atk,
    speed: FINAL_BOSS.speed, xp: 1000, hitCd: 0, flash: 0, dead: false,
    ranged: true, shootCd: 2, summonCd: 6, phase: 1,
  };
}

// Circle vs solid-rect collision. Returns corrected position.
export function collide(area, x, y, r) {
  let nx = Math.max(TILE + r, Math.min(VIEW_W - TILE - r, x));
  let ny = Math.max(TILE + r, Math.min(VIEW_H - TILE - r, y));
  for (const s of area.solids) {
    const rx = s.x * TILE, ry = s.y * TILE, rw = s.w * TILE, rh = s.h * TILE;
    const cx = Math.max(rx, Math.min(nx, rx + rw));
    const cy = Math.max(ry, Math.min(ny, ry + rh));
    const dx = nx - cx, dy = ny - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      nx = cx + (dx / d) * r;
      ny = cy + (dy / d) * r;
    }
  }
  return { x: nx, y: ny };
}

export function nearestObject(area, x, y, maxDist = 70) {
  let best = null, bestD = maxDist;
  for (const o of area.objects) {
    const d = Math.hypot(o.x - x, o.y - y);
    if (d < bestD + o.r * 0.4) { best = o; bestD = d; }
  }
  return best;
}

export function randomFreeSpot(area, rng) {
  for (let tries = 0; tries < 30; tries++) {
    const x = (2 + rng() * 26) * TILE;
    const y = (2 + rng() * 14) * TILE;
    const c = collide(area, x, y, 14);
    if (Math.abs(c.x - x) < 1 && Math.abs(c.y - y) < 1) return { x, y };
  }
  return { x: 15 * TILE, y: 9 * TILE };
}
