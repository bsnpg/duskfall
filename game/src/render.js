// Duskfall — canvas rendering. All art is drawn with canvas shapes:
// no image files, no network, just a coherent dusk palette.

import { TILE, VIEW_W, VIEW_H, CLASSES, STONES } from './data.js';

const PALETTES = {
  town: { floor: '#2a2338', floor2: '#241d31', wall: '#4a3560', glow: '#f2c14e' },
  dungeon: { floor: '#1c1626', floor2: '#181222', wall: '#3a2c50', glow: '#b18cff' },
  mine: { floor: '#26221a', floor2: '#201c15', wall: '#5a4a33', glow: '#ffd94a' },
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
  } else if (d.kind === 'gold') {
    ctx.fillStyle = '#f2c14e';
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a5510'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('G', 0, 3);
  }
  ctx.restore();
}

function drawMonster(ctx, m) {
  if (m.dead) return;
  ctx.save();
  ctx.translate(m.x, m.y);
  if (m.flash > 0) ctx.globalAlpha = 0.6 + Math.random() * 0.4;
  ctx.fillStyle = m.color;
  ctx.beginPath(); ctx.arc(0, 0, m.r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.arc(-m.r * 0.35, -m.r * 0.25, m.r * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(m.r * 0.35, -m.r * 0.25, m.r * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff5a5a';
  ctx.fillRect(-m.r * 0.3, m.r * 0.2, m.r * 0.6, 3);
  if (m.kind === 'boss') {
    ctx.strokeStyle = '#ffd94a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, m.r + 5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('👑', 0, -m.r - 8);
  }
  // HP bar
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(-m.r, -m.r - 12, m.r * 2, 4);
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(-m.r, -m.r - 12, (m.r * 2) * Math.max(0, m.hp / m.maxHp), 4);
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
  for (const o of area.objects) drawObject(ctx, o, now);
  for (const n of area.nodes || []) drawNode(ctx, n, now);
  for (const d of area.drops) drawDrop(ctx, d, now);
  for (const m of area.monsters) drawMonster(ctx, m);
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
  // Darkness: the dungeon is dark beyond the player's light; the mine
  // glows faintly; the town is lit.
  if (area.kind === 'dungeon') {
    ctx.save();
    const g = ctx.createRadialGradient(player.x, player.y, 60, player.x, player.y, 260);
    g.addColorStop(0, 'rgba(5,3,12,0)');
    g.addColorStop(1, 'rgba(5,3,12,0.82)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.restore();
  }
  // Area label
  ctx.save();
  ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(232,224,245,0.85)';
  ctx.fillText(area.label, 12, 590);
  ctx.restore();
}
