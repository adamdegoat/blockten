// Per-floor set pieces. Each one is the single thing you remember about a floor,
// and each is driven from the floor spec rather than special-cased in code.
import * as THREE from 'three';
import { W, H, box } from './world.js';

function canvasTex(size, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ── standing water ──────────────────────────────────────────────────────────
// The point isn't the water, it's the tube lights smeared across it. A low
// roughness plane gets that from the existing lights for free.
let rippleTex = null;
function ripples() {
  if (rippleTex) return rippleTex;
  rippleTex = canvasTex(256, (g, s) => {
    const img = g.createImageData(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      // gentle rolling normal map
      const nx = Math.sin(x * 0.09) * 0.5 + Math.sin((x + y) * 0.045) * 0.5;
      const ny = Math.cos(y * 0.075) * 0.5 + Math.sin((x - y) * 0.05) * 0.5;
      const i = (y * s + x) * 4;
      img.data[i] = 128 + nx * 26;
      img.data[i + 1] = 128 + ny * 26;
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, false);
  return rippleTex;
}

export function water(parent, length, depth = 0.045) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x0d1418, roughness: 0.06, metalness: 0.55,
    transparent: true, opacity: 0.9,
    normalMap: ripples(),
  });
  mat.normalMap.repeat.set(5, 26);
  mat.normalScale.set(0.16, 0.16);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.04, length - 0.4), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(0, depth, -length / 2);
  m.renderOrder = 4;
  parent.add(m);

  // a darker wet band up the walls where it has soaked in
  const soak = new THREE.MeshBasicMaterial({ color: 0x1a1c18, transparent: true, opacity: 0.55, depthWrite: false });
  for (const s of [-1, 1]) {
    const q = new THREE.Mesh(new THREE.PlaneGeometry(length - 0.4, 0.28), soak);
    q.rotation.y = s * Math.PI / 2;
    q.position.set(s * (W / 2 - 0.014), depth + 0.13, -length / 2);
    q.renderOrder = 5;
    parent.add(q);
  }
  return { mesh: m, mat, depth };
}

export function animateWater(w, t) {
  if (!w) return;
  w.mat.normalMap.offset.y = t * 0.012;
  w.mat.normalMap.offset.x = Math.sin(t * 0.13) * 0.02;
}

// ── hoarder blockage ────────────────────────────────────────────────────────
// Stacked belongings narrowing the corridor to a gap you squeeze through.
export function blockage(parent, mats, z, gapSide = 1, rnd = Math.random) {
  const g = new THREE.Group();
  const stackW = W * 0.54;
  const xBase = -gapSide * (W / 2 - stackW / 2);
  // real materials, tinted per item — flat grey boxes read as placeholder geometry
  const palette = [
    { m: mats.door,   tint: 0x6b5f4c },
    { m: mats.recess, tint: 0x565a52 },
    { m: mats.door,   tint: 0x53483a },
    { m: mats.frame,  tint: 0x4f4a42 },
    { m: mats.recess, tint: 0x625c50 },
  ];
  const matFor = (i) => {
    const p = palette[i % palette.length];
    const mm = p.m.clone();
    mm.color = new THREE.Color(p.tint).multiplyScalar(0.75 + rnd() * 0.4);
    mm.roughness = 1;
    return mm;
  };

  // three columns across the stack, each stacked from the floor up so nothing
  // floats — the previous version scattered boxes at fixed layer heights
  // Columns are jittered in Z, items inside a column are not. Jittering each
  // item broke the stack — a box "resting" on the one below could be a metre
  // away from it in Z, so it hung in mid-air.
  const COLS = 4;
  let n = 0;
  for (let c = 0; c < COLS; c++) {
    const cx = xBase - stackW / 2 + (c + 0.5) * (stackW / COLS);
    const cz = z + (c - (COLS - 1) / 2) * 0.62 + (rnd() - 0.5) * 0.2;
    const targetH = 1.25 + rnd() * 1.15;
    let y = 0, guard = 0;
    while (y < targetH && guard++ < 10) {
      const bw = (stackW / COLS) * (0.86 + rnd() * 0.26);
      const bh = 0.24 + rnd() * 0.26;
      const bd = 0.42 + rnd() * 0.24;
      const o = box(g, bw, bh, bd, matFor(n),
        cx + (rnd() - 0.5) * 0.05,
        y + bh / 2,
        cz + (rnd() - 0.5) * 0.06,       // tiny, so the stack stays a stack
        (rnd() - 0.5) * 0.30);
      o.receiveShadow = true;
      y += bh - 0.015;                    // slight overlap: no gaps between items
      n++;
    }
  }
  parent.add(g);
  return { group: g, blocker: { x: xBase, z, r: 0.92 }, count: n };
}

// ── abandoned renovation ────────────────────────────────────────────────────
// Plastic sheeting you walk through, scaffold poles, dust.
export function renovation(parent, mats, z, rnd = Math.random) {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x7c7466, roughness: 0.5, metalness: 0.55 });
  const sheetMat = new THREE.MeshStandardMaterial({
    color: 0xb9bdb4, roughness: 0.35, transparent: true, opacity: 0.24,
    side: THREE.DoubleSide, depthWrite: false,
  });

  // scaffold
  for (const s of [-1, 1]) {
    for (const dz of [-0.9, 0.9]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, H, 6), poleMat);
      p.position.set(s * (W / 2 - 0.24), H / 2, z + dz);
      p.castShadow = true;
      g.add(p);
    }
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.8, 6), poleMat);
    rail.rotation.x = Math.PI / 2;
    rail.position.set(s * (W / 2 - 0.24), 1.05, z);
    g.add(rail);
  }
  const plank = box(g, W - 0.5, 0.05, 0.5, poleMat, 0, 1.62, z + 0.9);
  plank.castShadow = true;

  // hanging sheeting, three overlapping curtains so it reads as material
  for (let i = 0; i < 3; i++) {
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.1, H - 0.05), sheetMat);
    sh.position.set((rnd() - 0.5) * 0.12, (H - 0.05) / 2, z - 1.6 - i * 0.16);
    sh.rotation.y = (rnd() - 0.5) * 0.07;
    sh.renderOrder = 6;
    g.add(sh);
  }
  parent.add(g);
  return { group: g, blockers: [] };
}

// ── a television, on, behind a part-open door ──────────────────────────────
export function television(parent, z, side = -1) {
  const g = new THREE.Group();
  const glow = new THREE.PointLight(0x86b4d8, 2.4, 4.2, 1.8);
  glow.position.set(side * (W / 2 - 0.34), 1.05, z);
  g.add(glow);
  // the sliver of light on the floor from a door left ajar
  const slit = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.10),
    new THREE.MeshBasicMaterial({ color: 0x9ec6e4, transparent: true, opacity: 0.5, depthWrite: false }),
  );
  slit.rotation.x = -Math.PI / 2;
  slit.position.set(side * (W / 2 - 0.42), 0.02, z);
  slit.renderOrder = 4;
  g.add(slit);
  parent.add(g);
  return { group: g, glow, base: 2.4 };
}

export function animateTelevision(tv, t) {
  if (!tv) return;
  // irregular flicker, like a picture changing rather than a broken lamp
  const n = Math.sin(t * 7.3) * Math.sin(t * 2.9) * Math.sin(t * 17.1);
  tv.glow.intensity = tv.base * (0.55 + 0.45 * (n * 0.5 + 0.5));
}
