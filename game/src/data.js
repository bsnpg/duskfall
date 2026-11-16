// Duskfall — data tables: classes, crystals, stones, monsters, armor.
// All names, numbers and text here are original to this game.

export const TILE = 32;
export const VIEW_W = 960;
export const VIEW_H = 600;

// The four chosen talents. A new player is assigned one at random and can
// never choose — that is the point of the story.
export const CLASSES = {
  archer: {
    id: 'archer', name: 'Archer', icon: '🏹',
    desc: 'Accuracy and speed. Fast arrows, high crit, low health.',
    crystal: 'speed', crystalName: 'Crystal of Speed', crystalIcon: '💨',
    color: '#7ddb6a', hp: 70, atk: 13, def: 2, speed: 3.4, crit: 0.22,
    range: 260, attackRate: 0.28,
    skill: { name: 'Arrow Rain', cost: 3, desc: '5 arrows at once toward the mouse.' },
  },
  knight: {
    id: 'knight', name: 'Knight', icon: '🛡️',
    desc: 'Endurance and strength. A heavy sword, huge HP, a steady step.',
    crystal: 'str', crystalName: 'Crystal of Str', crystalIcon: '💪',
    color: '#e8b13c', hp: 130, atk: 17, def: 8, speed: 2.5, crit: 0.08,
    range: 64, attackRate: 0.5,
    skill: { name: 'Steel Whirl', cost: 3, desc: 'A 360° strike that hits everything near you.' },
  },
  mage: {
    id: 'mage', name: 'Mage', icon: '🔮',
    desc: 'Area power. Huge magic blasts, low health, long range.',
    crystal: 'magic', crystalName: 'Crystal of Magic', crystalIcon: '✨',
    color: '#b18cff', hp: 60, atk: 20, def: 1, speed: 2.9, crit: 0.12,
    range: 220, attackRate: 0.55,
    skill: { name: 'Shadow Nova', cost: 3, desc: 'A huge area blast at the mouse.' },
  },
  support: {
    id: 'support', name: 'Support', icon: '💖',
    desc: 'Heal and buff. Heals itself, strengthens attacks, never alone.',
    crystal: 'life', crystalName: 'Crystal of Life', crystalIcon: '🌿',
    color: '#ff9ecf', hp: 90, atk: 10, def: 5, speed: 3.0, crit: 0.1,
    range: 200, attackRate: 0.45,
    skill: { name: 'Guardian Light', cost: 3, desc: 'Heal 40% HP + attack buff for 8s.' },
  },
};

export const CLASS_IDS = Object.keys(CLASSES);

// One stone kind per job. Stones feed the altar; the altar feeds crystals.
export const STONES = {
  speed: { name: 'Wind Stone', icon: '🟢' },
  str: { name: 'Steel Stone', icon: '🟡' },
  magic: { name: 'Mana Stone', icon: '🟣' },
  life: { name: 'Leaf Stone', icon: '🌸' },
};

export const CRYSTAL_PER_STONE = 6;
export const TRADE_RATE = 2; // 2 stones of any kind -> 1 stone of your job

// Monsters by dungeon depth tier. Stats scale with the floor in combat.js.
export const MONSTER_TYPES = [
  { id: 'rat', name: 'Shadow Rat', hp: 22, atk: 6, speed: 2.2, xp: 8, color: '#8d7fb8', size: 13, minFloor: 1 },
  { id: 'bat', name: 'Gloom Bat', hp: 16, atk: 8, speed: 3.1, xp: 10, color: '#6a5a9e', size: 11, minFloor: 1 },
  { id: 'hollow', name: 'Hollow Knight', hp: 55, atk: 11, speed: 1.6, xp: 18, color: '#9aa7c7', size: 16, minFloor: 3 },
  { id: 'wisp', name: 'Dark Wisp', hp: 30, atk: 13, speed: 2.6, xp: 16, color: '#5ad6ff', size: 12, minFloor: 5 },
  { id: 'golem', name: 'Cracked Golem', hp: 110, atk: 15, speed: 1.2, xp: 30, color: '#7a6a58', size: 19, minFloor: 8 },
  { id: 'darkmage', name: 'Dark Mage', hp: 70, atk: 19, speed: 1.9, xp: 34, color: '#c07bff', size: 14, minFloor: 11 },
  { id: 'stalker', name: 'Dusk Hunter', hp: 95, atk: 22, speed: 3.4, xp: 40, color: '#3ddc97', size: 14, minFloor: 14 },
  { id: 'dread', name: 'Dreadlord', hp: 160, atk: 26, speed: 1.8, xp: 55, color: '#ff5a5a', size: 18, minFloor: 17 },
];

export const MINI_BOSSES = [
  { name: 'Shadow Rat King', color: '#b8a7e8' },
  { name: 'Bat Matriarch', color: '#8a7ad8' },
  { name: 'Gatekeeper Golem', color: '#a8906a' },
  { name: 'Order of the Dark Mage', color: '#d89bff' },
];

export const FINAL_BOSS = {
  name: 'Demon King of Darkness', hp: 1500, atk: 30, speed: 1.7, color: '#ff2e63', size: 34,
};

// Armor / equipment drops. Rarity drives the stat budget.
export const RARITIES = {
  common: { name: 'Common', color: '#cfc4e8', mult: 1, chance: 0.55 },
  rare: { name: 'Rare', color: '#5aa2ff', mult: 1.7, chance: 0.28 },
  epic: { name: 'Epic', color: '#c07bff', mult: 2.6, chance: 0.13 },
  legend: { name: 'Legendary', color: '#ffb340', mult: 4, chance: 0.04 },
};

export const SLOTS = {
  weapon: { name: 'Weapon', icon: '⚔️' },
  armor: { name: 'Armor', icon: '🛡️' },
  charm: { name: 'Charm', icon: '✨' },
};

const WEAPON_NAMES = ['Sword', 'Bow', 'Staff', 'Spear', 'Dagger', 'Axe'];
const ARMOR_NAMES = ['Plate', 'Robe', 'Vest', 'Guard', 'Cloak'];
const CHARM_NAMES = ['Lantern', 'Ring', 'Necklace', 'Bracelet', 'Sigil'];
const PREFIX = ['Twilight', 'Gloom', 'Ember', 'Dawn', 'Shadow', 'Dusk', 'Rune', 'Vow'];
const SUFFIX = ['of the Guardian', 'of the Hunter', 'the Last', 'of the Lost', 'of the Brave', 'of the Chosen'];

export function rollStats(rng) {
  return {
    hp: 40 + Math.floor(rng() * 60),
    atk: 6 + Math.floor(rng() * 10),
    def: 1 + Math.floor(rng() * 5),
    speed: 2.3 + rng() * 0.9,
    crit: 0.05 + rng() * 0.12,
  };
}

export function rollArmor(rng, floor) {
  const roll = rng();
  let rarity = 'common';
  let acc = 0;
  for (const [key, r] of Object.entries(RARITIES)) {
    acc += r.chance;
    if (roll <= acc) { rarity = key; break; }
  }
  const slotKeys = Object.keys(SLOTS);
  const slot = slotKeys[Math.floor(rng() * slotKeys.length)];
  const mult = RARITIES[rarity].mult * (1 + floor * 0.08);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const base = slot === 'weapon' ? pick(WEAPON_NAMES) : slot === 'armor' ? pick(ARMOR_NAMES) : pick(CHARM_NAMES);
  const name = `${pick(PREFIX)} ${base} ${pick(SUFFIX)}`;
  const stats = {};
  const keys = ['atk', 'def', 'hp', 'crit'];
  const nStats = 1 + (rarity === 'rare' ? 1 : 0) + (rarity === 'epic' ? 1 : 0) + (rarity === 'legend' ? 2 : 0);
  for (let i = 0; i < nStats; i++) {
    const k = keys[Math.floor(rng() * keys.length)];
    if (k === 'hp') stats.hp = (stats.hp || 0) + Math.round((12 + rng() * 22) * mult);
    else if (k === 'atk') stats.atk = (stats.atk || 0) + Math.round((2 + rng() * 4) * mult);
    else if (k === 'def') stats.def = (stats.def || 0) + Math.round((1 + rng() * 3) * mult);
    else stats.crit = (stats.crit || 0) + Math.round((2 + rng() * 4) * mult) / 100;
  }
  return { id: 'eq' + Math.floor(rng() * 1e9).toString(36), name, slot, rarity, stats, floor };
}

export function statSummary(stats) {
  const parts = [];
  if (stats.atk) parts.push(`+${stats.atk} ATK`);
  if (stats.def) parts.push(`+${stats.def} DEF`);
  if (stats.hp) parts.push(`+${stats.hp} HP`);
  if (stats.crit) parts.push(`+${Math.round(stats.crit * 100)}% CRIT`);
  return parts.join(' · ') || '—';
}

// Seeded rng (mulberry32) so staged scenes are stable.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
