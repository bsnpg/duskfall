// Duskfall — keyboard + mouse input, kept in one small module.

export const keys = {};
export const mouse = { x: 640, y: 360, down: false, clicked: false, rightClicked: false };
let onKey = null;

export function bindInput(canvas, keyHandler) {
  onKey = keyHandler;
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (!keys[e.key.toLowerCase()]) onKey?.(e.key.toLowerCase());
    keys[e.key.toLowerCase()] = true;
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
    if (e.button === 2) mouse.rightClicked = true;
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function axis() {
  let x = 0, y = 0;
  if (keys['w'] || keys['arrowup']) y -= 1;
  if (keys['s'] || keys['arrowdown']) y += 1;
  if (keys['a'] || keys['arrowleft']) x -= 1;
  if (keys['d'] || keys['arrowright']) x += 1;
  if (x && y) { x *= 0.7071; y *= 0.7071; }
  return { x, y };
}

export function consumeClick() {
  const c = mouse.clicked;
  mouse.clicked = false;
  return c;
}
