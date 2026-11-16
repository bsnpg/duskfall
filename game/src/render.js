// Duskfall — canvas rendering. All art is drawn with canvas shapes:
// no image files, no network, just a coherent dusk palette. Every monster
// kind has its own silhouette, so a floor reads at a glance.

import { TILE, VIEW_W, VIEW_H, CLASSES, STONES } from './data.js';

const PALETTES = {
  town: { floor: '#2a2338', floor2: '#241d31', wall: '#4a3560', glow: '#f2c14e' },
  dungeon: { floor: '#2e2644', floor2: '#292037', wall: '#4a3a68', glow: '#b18cff' },
  mine: { floor: '#2c261c', floor2: '#261f16', wall: '#5a4a33', glow: '#ffd94a' },
};

function drawTiles(ctx, area) {
  const pal = PALETTES[area.kind] || PALETTES.town;
  ctx.fillStyle = pal.floor;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = pal.floor2;
  for (let ty = 0; ty < VIEW_H / TILE; ty++) {
    for (let tx = 0; tx < VIEW_W / TILE; tx++) {
      if ((tx + ty) % 2 === 0) ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    }
  }
  for (const s of area.solids) {
    ctx.fillStyle = pal.wall;
    ctx.fillRect(s.x * TILE, s.y * TILE, s.w * TILE, s.h * TILE);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(s.x * TILE, s.y * TILE, s.w * TILE, 4);
  }
}

// Floor dressing: torches with a flickering glow, rubble, stray crystals,
// lanterns and flowers in town. Pure decoration, drawn under everything.
function drawDecor(ctx, area, now) {
  for (const d of area.decor || []) {
    ctx.save();
    ctx.translate(d.x, d.y);
    if (d.kind === 'torch' || d.kind === 'lantern') {
      const flick = 0.5 + 0.5 * Math.sin(now * 6 + d.x * 0.13);
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 46 + flick * 10);
      g.addColorStop(0, 'rgba(255, 190, 80, 0.30)');
      g.addColorStop(1, 'rgba(255, 190, 80, 0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, 56, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a2c50';
      ctx.fillRect(-2, -2, 4, 14);
      ctx.fillStyle = `rgba(255, ${170 + Math.floor(flick * 60)}, 60, 0.95)`;
      ctx.beginPath(); ctx.arc(0, -6, 5 + flick * 2, 0, Math.PI * 2); ctx.fill();
    } else if (d.kind === 'crystal') {
      ctx.fillStyle = 'rgba(177, 140, 255, 0.9)';
      ctx.beginPath();
      ctx.moveTo(0, -12); ctx.lineTo(8, 0); ctx.lineTo(0, 12); ctx.lineTo(-8, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.moveTo(0, -12); ctx.lineTo(4, 0); ctx.lineTo(0, 12); ctx.lineTo(-3, 0);
      ctx.closePath(); ctx.fill();
    } else if (d.kind === 'rubble') {
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(-8, -3, 14, 6);
      ctx.fillRect(2, 2, 9, 5);
    } else if (d.kind === 'flower') {
      ctx.fillStyle = '#ff9ecf';
      ctx.beginPath(); ctx.arc(-3, -3, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(3, -3, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, 2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath(); ctx.arc(0, -1, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

function drawObject(ctx, o, now) {
  const pulse = 0.5 + 0.5 * Math.sin(now * 2 + o.x);
  ctx.save();
  ctx.translate(o.x, o.y);
  if (o.id === 'altar') {
    ctx.fillStyle = '#3a2c50';
    ctx.beginPath(); ctx.arc(0, 10, 34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#241d31';
    ctx.fillRect(-26, -14, 52, 22);
    ctx.fillStyle = `rgba(242, 193, 78, ${0.5 + pulse * 0.5})`;
    ctx.beginPath(); ctx.arc(0, -18, 10 + pulse * 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('🕯️', 0, -10);
  } else if (o.id === 'trader') {
    ctx.fillStyle = '#7a5a2e';
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
    ctx.font = '24px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('🧳', 0, 8);
    ctx.fillStyle = '#e8e0f5'; ctx.font = '11px sans-serif';
    ctx.fillText('BRAM', 0, 32);
  } else if (o.id === 'mineDoor' || o.id === 'mineExit') {
    ctx.fillStyle = '#241a10';
    ctx.fillRect(-26, -26, 52, 52);
    ctx.fillStyle = '#5a4a33';
    ctx.fillRect(-26, -26, 52, 8);
    ctx.font = '22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('⛏️', 0, 8);
  } else if (o.id === 'dungeonDoor') {
    ctx.fillStyle = '#12081f';
    ctx.fillRect(-30, -30, 60, 60);
    ctx.strokeStyle = `rgba(177, 140, 255, ${0.4 + pulse * 0.4})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(-30, -30, 60, 60);
    ctx.font = '24px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('🌀', 0, 8);
  } else if (o.id === 'stairsDown') {
    ctx.fillStyle = o.locked ? '#3a2c50' : `rgba(242, 193, 78, ${0.5 + pulse * 0.5})`;
    ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0d0a14';
    ctx.font = '20px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(o.locked ? '🔒' : '⬇️', 0, 7);
  } else if (o.id === 'portalUp') {
    ctx.fillStyle = `rgba(122, 216, 154, ${0.4 + pulse * 0.4})`;
    ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0d0a14';
    ctx.font = '20px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('🏠', 0, 7);
  }
  ctx.restore();
}

function drawNode(ctx, n, now) {
  if (n.hp <= 0) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#5a4a33';
    ctx.beginPath(); ctx.arc(n.x, n.y, 14, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  const pulse = 0.5 + 0.5 * Math.sin(now * 3 + n.x);
  ctx.save();
  ctx.translate(n.x, n.y);
  ctx.fillStyle = '#6a5638';
  ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(255, 217, 74, ${0.6 + pulse * 0.4})`;
  ctx.beginPath(); ctx.arc(-4, -3, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(5, 4, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(`${n.hp}/3`, 0, 26);
  ctx.restore();
}

function drawDrop(ctx, d, now) {
  const bob = Math.sin(now * 3 + d.x) * 2;
  ctx.save();
  ctx.translate(d.x, d.y + bob);
  if (d.kind === 'stone') {
    ctx.fillStyle = '#241d31';
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(STONES[d.stone].icon, 0, 5);
  } else if (d.kind === 'armor') {
    const colors = { common: '#cfc4e8', rare: '#5aa2ff', epic: '#c07bff', legend: '#ffb340' };
    ctx.fillStyle = colors[d.item.rarity] || '#cfc4e8';
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0d0a14'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(d.item.slot === 'weapon' ? '⚔️' : d.item.slot === 'armor' ? '🛡️' : '✨', 0, 5);
  } else if (d.kind === 'heart') {
    ctx.font = '16px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('❤️', 0, 6);
  }
  ctx.restore();
}

// One silhouette per monster kind, so the player can tell a bat from a
// golem at a glance. Eyes and the HP bar are shared by every kind.
function drawMonster(ctx, m, now) {
  if (m.dead) return;
  ctx.save();
  ctx.translate(m.x, m.y);
  if (m.flash > 0) ctx.globalAlpha = 0.6 + Math.random() * 0.4;
  ctx.fillStyle = m.color;
  const r = m.r;
  if (m.kind === 'boss') {
    // The Demon King: horned, crowned, glowing eyes — unmistakable.
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, -r * 0.55); ctx.lineTo(-r * 1.15, -r * 1.35); ctx.lineTo(-r * 0.15, -r * 0.85);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.7, -r * 0.55); ctx.lineTo(r * 1.15, -r * 1.35); ctx.lineTo(r * 0.15, -r * 0.85);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd94a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, r + 6, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('👑', 0, -r - 16);
    // Glowing eyes.
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.25, r * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.35, -r * 0.25, r * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a0d1e';
    ctx.fillRect(-r * 0.3, r * 0.2, r * 0.6, 4);
    ctx.restore();
    return; // the top boss bar is this boss's HP bar; no second bar.
  }
  if (m.type === 'bat') {
    const flap = Math.sin(now * 10 + m.x) * r * 0.45;
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, 0); ctx.lineTo(-r * 1.7, -r * 0.7 - flap); ctx.lineTo(-r * 1.2, r * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.4, 0); ctx.lineTo(r * 1.7, -r * 0.7 - flap); ctx.lineTo(r * 1.2, r * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2); ctx.fill();
  } else if (m.type === 'golem') {
    ctx.fillRect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-r * 0.85, r * 0.2, r * 1.7, r * 0.3);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.8); ctx.lineTo(-r * 0.1, -r * 0.2); ctx.lineTo(-r * 0.5, r * 0.2); ctx.stroke();
  } else if (m.type === 'wisp') {
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 1.8);
    g.addColorStop(0, m.color);
    g.addColorStop(1, 'rgba(90, 214, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = m.color;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2); ctx.fill();
  } else if (m.type === 'darkmage') {
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.3); ctx.lineTo(r * 0.9, r * 0.9); ctx.lineTo(-r * 0.9, r * 0.9);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.moveTo(0, -r * 1.3); ctx.lineTo(r * 0.45, -r * 0.2); ctx.lineTo(-r * 0.45, -r * 0.2); ctx.closePath(); ctx.fill();
  } else if (m.type === 'stalker') {
    ctx.beginPath();
    ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0);
    ctx.closePath(); ctx.fill();
  } else if (m.type === 'dread') {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, -r * 0.6); ctx.lineTo(-r * 1.1, -r * 1.4); ctx.lineTo(-r * 0.2, -r * 0.9);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.7, -r * 0.6); ctx.lineTo(r * 1.1, -r * 1.4); ctx.lineTo(r * 0.2, -r * 0.9);
    ctx.closePath(); ctx.fill();
  } else if (m.type === 'rat') {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = m.color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-r * 0.8, r * 0.5); ctx.quadraticCurveTo(-r * 1.8, r * 0.9, -r * 1.6, r * 1.6); ctx.stroke();
    ctx.beginPath(); ctx.arc(-r * 0.45, -r * 0.85, r * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.45, -r * 0.85, r * 0.28, 0, Math.PI * 2); ctx.fill();
  } else {
    // Miniboss, boss and anything else: a ringed circle.
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  }
  if (m.type === 'miniboss') {
    ctx.strokeStyle = '#ffd94a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r + 4, 0, Math.PI * 2); ctx.stroke();
  }
  // Eyes + mouth.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.25, r * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(r * 0.35, -r * 0.25, r * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff5a5a';
  ctx.fillRect(-r * 0.3, r * 0.2, r * 0.6, 3);
  // HP bar
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(-r, -r - 12, r * 2, 4);
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(-r, -r - 12, (r * 2) * Math.max(0, m.hp / m.maxHp), 4);
  ctx.restore();
}

function drawPlayer(ctx, p, now) {
  if (p.hp <= 0) return;
  const cls = p.cls;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.hurtCd > 0 && Math.floor(now * 20) % 2 === 0) ctx.globalAlpha = 0.5;
  // Buff ring
  if (now < p.buffUntil) {
    ctx.strokeStyle = 'rgba(255, 158, 207, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, p.r + 6 + Math.sin(now * 5) * 2, 0, Math.PI * 2); ctx.stroke();
  }
  // Body
  ctx.fillStyle = cls.color;
  ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.arc(0, 3, p.r * 0.7, 0, Math.PI); ctx.fill();
  // Aim indicator
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(Math.cos(p.aim) * (p.r + 2), Math.sin(p.aim) * (p.r + 2));
  ctx.lineTo(Math.cos(p.aim) * (p.r + 12), Math.sin(p.aim) * (p.r + 12));
  ctx.stroke();
  // Class glyph
  ctx.font = '15px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(cls.icon, 0, 5);
  ctx.restore();
  // Name + crystal state
  ctx.save();
  ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.fillText(`${cls.icon} ${cls.name}  Lv${p.level}`, p.x, p.y - p.r - 14);
  ctx.restore();
}

export function render(ctx, area, player, now) {
  drawTiles(ctx, area);
  drawDecor(ctx, area, now);
  for (const o of area.objects) drawObject(ctx, o, now);
  for (const n of area.nodes || []) drawNode(ctx, n, now);
  for (const d of area.drops) drawDrop(ctx, d, now);
  for (const m of area.monsters) drawMonster(ctx, m, now);
  // Projectiles
  for (const p of area.projectiles) {
    ctx.save();
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  drawPlayer(ctx, player, now);
  // Particles
  for (const pt of area.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, pt.life * 2);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
    ctx.restore();
  }
  // Floating texts
  ctx.save();
  ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
  for (const t of area.texts) {
    ctx.globalAlpha = Math.max(0, Math.min(1, t.life * 1.6));
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.restore();
  // Darkness: the dungeon is dark beyond the player's light, but the light
  // is wide and soft now, so the fight still reads at a glance.
  if (area.kind === 'dungeon') {
    ctx.save();
    const g = ctx.createRadialGradient(player.x, player.y, 90, player.x, player.y, 480);
    g.addColorStop(0, 'rgba(5,3,12,0)');
    g.addColorStop(1, 'rgba(5,3,12,0.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.restore();
  }
  // Area label
  ctx.save();
  ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(232,224,245,0.85)';
  ctx.fillText(area.label, 12, VIEW_H - 40);
  ctx.restore();
}
