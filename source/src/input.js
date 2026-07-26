// Touch first. Left thumb walks, anywhere on the right looks. Keyboard exists
// only so the thing can be developed on a laptop.
const P = new URLSearchParams(location.search);
export const TOUCH = P.has('touch') || matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

export function createInput() {
  const keys = new Set();
  const stick = { fwd: 0, lat: 0 };
  let lookDX = 0, lookDY = 0;
  let interactQueued = false;

  addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (e.code === 'KeyE' || e.code === 'Space') { interactQueued = true; e.preventDefault(); }
  });
  addEventListener('keyup', (e) => keys.delete(e.code));

  if (!TOUCH) {
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement) { lookDX += e.movementX; lookDY += e.movementY; }
    });
  }

  if (TOUCH) {
    const R = 54;
    let moveId = null, lookId = null;
    let ox = 0, oy = 0, lx = 0, ly = 0, lookMoved = 0, lookStart = 0;
    const el = (id) => document.getElementById(id);

    const isUi = (t) => t.target?.closest?.('.ui');

    addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (isUi(t)) continue;
        // left 40% of the screen is the walk stick, wherever the thumb lands
        if (t.clientX < innerWidth * 0.40 && moveId === null) {
          moveId = t.identifier; ox = t.clientX; oy = t.clientY;
          const k = el('stick');
          if (k) { k.style.display = 'block'; k.style.left = ox + 'px'; k.style.top = oy + 'px'; }
        } else if (lookId === null) {
          lookId = t.identifier; lx = t.clientX; ly = t.clientY;
          lookMoved = 0; lookStart = performance.now();
        }
      }
    }, { passive: true });

    addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === moveId) {
          const dx = t.clientX - ox, dy = t.clientY - oy;
          const len = Math.hypot(dx, dy) || 1;
          const k = Math.min(1, len / R);
          stick.lat = (dx / len) * k;
          stick.fwd = -(dy / len) * k;
          const d = el('stick-dot');
          if (d) d.style.transform = `translate(${(dx / len) * k * R}px,${(dy / len) * k * R}px)`;
        } else if (t.identifier === lookId) {
          const dx = t.clientX - lx, dy = t.clientY - ly;
          lookDX += dx; lookDY += dy;
          lookMoved += Math.hypot(dx, dy);
          lx = t.clientX; ly = t.clientY;
        }
      }
    }, { passive: true });

    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === moveId) {
          moveId = null; stick.fwd = 0; stick.lat = 0;
          const k = el('stick'); if (k) k.style.display = 'none';
          const d = el('stick-dot'); if (d) d.style.transform = 'translate(0,0)';
        } else if (t.identifier === lookId) {
          lookId = null;
          // a tap that barely moved is an interact, so there's no extra button
          if (lookMoved < 12 && performance.now() - lookStart < 320) interactQueued = true;
        }
      }
    };
    addEventListener('touchend', end, { passive: true });
    addEventListener('touchcancel', end, { passive: true });
  }

  return {
    read() {
      const out = { fwd: 0, lat: 0, lookX: 0, lookY: 0, interact: false, crouch: false };
      if (TOUCH) { out.fwd = stick.fwd; out.lat = stick.lat; }
      else {
        out.fwd = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
        out.lat = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
        out.crouch = keys.has('ControlLeft') || keys.has('KeyC');
      }
      out.lookX = lookDX; out.lookY = lookDY;
      lookDX = 0; lookDY = 0;
      out.interact = interactQueued; interactQueued = false;
      return out;
    },
  };
}
