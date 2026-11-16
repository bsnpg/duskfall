// Duskfall — procedural sound. No audio files: every effect is a small
// WebAudio oscillator burst, so the game ships zero network requests.

let ctx = null;
let muted = false;
let musicTimer = null;
let musicStep = 0;

// A slow minor-key walk for the town; dungeons get a tenser variant.
const TOWN_NOTES = [220, 261.6, 329.6, 392, 329.6, 261.6, 196, 220];
const DUNGEON_NOTES = [110, 116.5, 110, 130.8, 98, 110, 103.8, 98];

export function ensureAudio() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

export function isMuted() { return muted; }

function tone(freq, dur, type = 'sine', vol = 0.12, slideTo = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  swing() { tone(320, 0.08, 'square', 0.05, 140); },
  shoot() { tone(880, 0.09, 'triangle', 0.08, 320); },
  hit() { tone(180, 0.07, 'sawtooth', 0.07, 90); },
  hurt() { tone(140, 0.18, 'sawtooth', 0.1, 60); },
  pickup() { tone(660, 0.08, 'sine', 0.09); setTimeout(() => tone(990, 0.1, 'sine', 0.09), 60); },
  coin() { tone(1320, 0.06, 'sine', 0.07); setTimeout(() => tone(1760, 0.09, 'sine', 0.07), 50); },
  levelup() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.1), i * 90)); },
  altar() { [392, 523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sine', 0.08), i * 110)); },
  mine() { tone(240, 0.1, 'square', 0.08, 120); setTimeout(() => tone(520, 0.08, 'sine', 0.07), 70); },
  stone() { tone(440, 0.12, 'triangle', 0.08, 660); },
  boss() { tone(55, 0.7, 'sawtooth', 0.14, 40); tone(82, 0.7, 'sawtooth', 0.1, 55); },
  win() { [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => tone(f, 0.35, 'triangle', 0.1), i * 130)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.4, 'sawtooth', 0.08), i * 160)); },
  roll() { [300, 420, 540, 660, 780].forEach((f, i) => setTimeout(() => tone(f, 0.07, 'square', 0.06), i * 70)); },
  stairs() { tone(520, 0.12, 'sine', 0.08, 780); },
  trade() { tone(700, 0.08, 'sine', 0.08); setTimeout(() => tone(900, 0.1, 'sine', 0.08), 60); },
};

export function startMusic(mode) {
  stopMusic();
  const notes = mode === 'dungeon' ? DUNGEON_NOTES : TOWN_NOTES;
  musicStep = 0;
  musicTimer = setInterval(() => {
    if (muted || !ctx) return;
    const f = notes[musicStep % notes.length];
    tone(f, 0.9, 'sine', 0.035);
    tone(f / 2, 0.9, 'triangle', 0.02);
    musicStep++;
  }, 620);
}

export function stopMusic() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
}
