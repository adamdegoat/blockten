// Corridor generation and dressing. Everything here is built to be repeated
// per-floor later, so nothing hardcodes a single corridor.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const W = 2.35;          // corridor width
export const H = 2.78;          // ceiling height
export const L = 26;            // corridor length

// ── textures ────────────────────────────────────────────────────────────────
const tl = new THREE.TextureLoader();
const cache = new Map();
function T(name, kind, srgb, rx, ry) {
  const key = `${name}/${kind}/${rx}/${ry}`;
  if (cache.has(key)) return cache.get(key);
  const t = tl.load(`assets/tex/${name}/${kind}.jpg`);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 8;
  cache.set(key, t);
  return t;
}
export function surface(name, rx, ry, tint = 0xffffff, rough = 1) {
  return new THREE.MeshStandardMaterial({
    map: T(name, 'diffuse', true, rx, ry),
    normalMap: T(name, 'nor_gl', false, rx, ry),
    roughnessMap: T(name, 'rough', false, rx, ry),
    color: tint, roughness: rough, metalness: 0,
  });
}

// ── small procedural textures (paper notices, stains, laundry) ─────────────
function canvasTex(size, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export const noticeTex = () => canvasTex(256, (x, s) => {
  x.fillStyle = '#a89f8b'; x.fillRect(0, 0, s, s);
  x.fillStyle = 'rgba(120,105,80,0.16)';
  for (let i = 0; i < 40; i++) x.fillRect(Math.random() * s, Math.random() * s, Math.random() * 30, Math.random() * 18);
  x.fillStyle = '#2b2a26';
  for (let i = 0; i < 13; i++) {
    const y = 34 + i * 15;
    x.fillRect(22, y, (0.35 + Math.random() * 0.5) * (s - 50), 4);
  }
  x.fillRect(22, 14, 120, 9);
});

export const stainTex = () => canvasTex(256, (x, s) => {
  x.clearRect(0, 0, s, s);
  for (let i = 0; i < 34; i++) {
    const cx = s / 2 + (Math.random() - 0.5) * s * 0.5;
    const cy = s * 0.25 + Math.random() * s * 0.6;
    const r = 12 + Math.random() * 52;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    const a = 0.05 + Math.random() * 0.12;
    g.addColorStop(0, `rgba(48,40,26,${a})`);
    g.addColorStop(1, 'rgba(48,40,26,0)');
    x.fillStyle = g;
    x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
  }
}, false);

// ── helpers ─────────────────────────────────────────────────────────────────
export function box(parent, w, h, d, m, x, y, z, ry = 0, shadow = true) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z);
  o.rotation.y = ry;
  o.castShadow = shadow; o.receiveShadow = true;
  parent.add(o);
  return o;
}

// ── the corridor shell ──────────────────────────────────────────────────────
export function buildShell(parent, mats, L = 26) {
  const f = new THREE.Mesh(new THREE.PlaneGeometry(W, L), mats.floor);
  f.rotation.x = -Math.PI / 2; f.position.z = -L / 2; f.receiveShadow = true; parent.add(f);

  const c = new THREE.Mesh(new THREE.PlaneGeometry(W, L), mats.ceil);
  c.rotation.x = Math.PI / 2; c.position.set(0, H, -L / 2); c.receiveShadow = true; parent.add(c);

  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(L, H), s < 0 ? mats.wallA : mats.wallB);
    w.rotation.y = s * Math.PI / 2;
    w.position.set(s * W / 2, H / 2, -L / 2);
    w.receiveShadow = true;
    parent.add(w);
  }

  // skirting: a darker wet band at the base of every wall. cheap, and it is the
  // single most convincing "this building has damp" detail there is.
  const skirt = new THREE.MeshStandardMaterial({ color: 0x4a473f, roughness: 0.55 });
  for (const s of [-1, 1]) box(parent, 0.03, 0.34, L, skirt, s * (W / 2 - 0.015), 0.17, -L / 2, 0, false);
}

// ── doors ───────────────────────────────────────────────────────────────────
export function buildDoors(parent, mats, count = 8, spacing = 3.0, startZ = -2.6) {
  const doors = [];
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x7d7767, roughness: 0.85 });
  const knobMat = new THREE.MeshStandardMaterial({ color: 0x6e6250, roughness: 0.35, metalness: 0.85 });
  for (let i = 0; i < count; i++) {
    const z = startZ - i * spacing;
    for (const s of [-1, 1]) {
      const jig = ((i * 5 + (s > 0 ? 2 : 0)) % 4) * 0.05;
      const zz = z + jig;
      const g = new THREE.Group();
      // recess so the door reads as set into the wall rather than stuck on it
      box(g, 0.14, 2.06, 0.94, mats.recess, s * (W / 2 - 0.07), 1.03, zz, 0, false);
      const leaf = box(g, 0.06, 1.98, 0.82, mats.door, s * (W / 2 - 0.035), 1.00, zz);
      box(g, 0.07, 2.14, 0.07, mats.frame, s * (W / 2 - 0.03), 1.07, zz - 0.47, 0, false);
      box(g, 0.07, 2.14, 0.07, mats.frame, s * (W / 2 - 0.03), 1.07, zz + 0.47, 0, false);
      box(g, 0.07, 0.07, 1.02, mats.frame, s * (W / 2 - 0.03), 2.11, zz, 0, false);
      // handle
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.11, 8), knobMat);
      knob.rotation.z = Math.PI / 2;
      knob.position.set(s * (W / 2 - 0.10), 1.02, zz + s * -0.30);
      g.add(knob);
      // unit number
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.09), plateMat);
      p.position.set(s * (W / 2 - 0.145), 1.88, zz);
      p.rotation.y = s * -Math.PI / 2;
      g.add(p);
      parent.add(g);
      doors.push({ group: g, leaf, side: s, z: zz, open: 0, id: `${s < 0 ? 'A' : 'B'}${i + 1}` });
    }
  }
  return doors;
}

// ── the dressing: what turns a corridor into somewhere people live ─────────
export function dress(parent, mats, rnd = Math.random, L = 26,
                      features = ['pipes','cables','meters','notices','stains','laundry'],
                      condition = 0.5) {
  const grp = new THREE.Group();
  parent.add(grp);
  const has = (f) => features.includes(f);

  // pipework along the ceiling line
  if (has('pipes')) {
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x5c5a52, roughness: 0.62, metalness: 0.35 });
  for (const [x, y, r] of [[-W / 2 + 0.13, H - 0.26, 0.045], [-W / 2 + 0.22, H - 0.34, 0.028], [W / 2 - 0.15, H - 0.30, 0.036]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L - 0.4, 8), pipeMat);
    p.rotation.x = Math.PI / 2;
    p.position.set(x, y, -L / 2);
    p.castShadow = true;
    grp.add(p);
    for (let i = 0; i < 9; i++) {
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), pipeMat);
      br.position.set(x, y + r + 0.02, -1.5 - i * 2.8);
      grp.add(br);
    }
  }
  }

  // hanging cables
  if (has('cables')) {
  const cm = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.9 });
  for (let i = 0; i < 15; i++) {
    const z0 = -1.0 - i * 1.65, sag = 0.09 + (i % 4) * 0.05;
    const x0 = -W / 2 + 0.30 + (i % 3) * 0.06;
    const pts = [];
    for (let t = 0; t <= 8; t++) {
      const u = t / 8;
      pts.push(new THREE.Vector3(x0, H - 0.20 - Math.sin(u * Math.PI) * sag, z0 - u * 1.65));
    }
    grp.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.011 + (i % 3) * 0.004, 5, false), cm));
  }
  }

  // electricity meters
  // the row of them you get by the stairs
  if (has('meters')) {
  const metalM = new THREE.MeshStandardMaterial({ color: 0x8b8578, roughness: 0.55, metalness: 0.4 });
  const glassM = new THREE.MeshStandardMaterial({ color: 0x2a3138, roughness: 0.15, metalness: 0.1 });
  for (let i = 0; i < 4; i++) {
    const z = -6.4 - i * 0.42;
    box(grp, 0.13, 0.3, 0.34, metalM, -W / 2 + 0.08, 1.62, z, 0, false);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.13), glassM);
    face.position.set(-W / 2 + 0.155, 1.66, z);
    face.rotation.y = Math.PI / 2;
    grp.add(face);
  }
  }

  // taped-up notices
  if (has('notices')) {
  const nMat = new THREE.MeshStandardMaterial({ map: noticeTex(), roughness: 0.95, color: 0xb9b3a4, side: THREE.DoubleSide });
  for (const [s, z, y, rot] of [[-1, -9.2, 1.55, 0.04], [1, -13.6, 1.48, -0.06], [-1, -18.9, 1.6, 0.03], [1, -3.4, 1.52, 0.05]]) {
    const n = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.29), nMat);
    n.position.set(s * (W / 2 - 0.016), y, z);
    n.rotation.set(0, s * -Math.PI / 2, rot);
    grp.add(n);
  }
  }

  // damp stains
  // projected flat onto the walls
  if (has('stains')) {
  const sMat = new THREE.MeshBasicMaterial({ map: stainTex(), transparent: true, opacity: 0.85, depthWrite: false });
  const stainCount = Math.round(6 + condition * 12);
  for (let i = 0; i < stainCount; i++) {
    const s = i % 2 ? 1 : -1;
    const q = new THREE.Mesh(new THREE.PlaneGeometry(1.1 + rnd() * 1.0, 1.5 + rnd() * 0.9), sMat);
    q.position.set(s * (W / 2 - 0.012), 0.9 + rnd() * 1.1, -2 - rnd() * (L - 5));
    q.rotation.y = s * -Math.PI / 2;
    q.renderOrder = 2;
    grp.add(q);
  }
  // and on the ceiling, where the leaks actually are
  for (let i = 0; i < 5; i++) {
    const q = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.6), sMat);
    q.position.set((rnd() - 0.5) * 1.4, H - 0.012, -2 - rnd() * (L - 5));
    q.rotation.x = Math.PI / 2;
    q.renderOrder = 2;
    grp.add(q);
  }
  }

  // laundry
  // on a line — instantly says people live here
  if (has('laundry')) {
  const clothCols = [0x4e5a63, 0x6a6152, 0x46503f, 0x5c4f52, 0x6d6a5e];
  const lineMat = new THREE.MeshStandardMaterial({ color: 0x6e6858, roughness: 1 });
  for (let i = 0; i < 3; i++) {
    // tucked against one wall, not strung across the middle of the corridor
    const z = -9.4 - i * 5.6;
    const side = i % 2 ? 1 : -1;
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 1.5, 5), lineMat);
    line.rotation.set(0, 0, Math.PI / 2);
    line.position.set(side * (W / 2 - 0.42), 1.86, z);
    line.rotation.y = Math.PI / 2;
    grp.add(line);
    for (let k = 0; k < 3; k++) {
      const cw = 0.2 + rnd() * 0.12, ch = 0.4 + rnd() * 0.3;
      const cl = new THREE.Mesh(new THREE.PlaneGeometry(cw, ch),
        new THREE.MeshStandardMaterial({
          color: clothCols[(i * 3 + k) % 5], roughness: 1, side: THREE.DoubleSide,
        }));
      // hangs from the line, sagging, and turned mostly edge-on to the corridor
      cl.position.set(side * (W / 2 - 0.42) + (rnd() - 0.5) * 0.05,
                      1.86 - ch / 2 - 0.02, z - 0.5 + k * 0.5);
      cl.rotation.set((rnd() - 0.5) * 0.12, Math.PI / 2 + (rnd() - 0.5) * 0.35, (rnd() - 0.5) * 0.1);
      cl.castShadow = true;
      grp.add(cl);
    }
  }
  }

  return grp;
}

// ── spirit house: the detail that places this somewhere specific ───────────
export function spiritHouse(parent, x, z, ry = 0) {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xb08b3c, roughness: 0.42, metalness: 0.6 });
  const red = new THREE.MeshStandardMaterial({ color: 0x7a2f26, roughness: 0.7 });
  const white = new THREE.MeshStandardMaterial({ color: 0xd8cfba, roughness: 0.8 });

  box(g, 0.34, 0.5, 0.30, white, 0, 0.25, 0);           // pedestal
  box(g, 0.46, 0.06, 0.42, gold, 0, 0.53, 0);            // platform
  box(g, 0.32, 0.30, 0.28, red, 0, 0.71, 0);             // shrine body
  // tiered roof
  for (let i = 0; i < 3; i++) {
    box(g, 0.42 - i * 0.09, 0.035, 0.38 - i * 0.08, gold, 0, 0.88 + i * 0.055, 0);
  }
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 6), gold);
  spire.position.y = 1.12;
  g.add(spire);
  // offerings
  for (let i = 0; i < 3; i++) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.021, 0.045, 8), gold);
    cup.position.set(-0.11 + i * 0.11, 0.58, 0.15);
    g.add(cup);
  }
  // incense, still glowing
  const emb = new THREE.PointLight(0xff6a2a, 0.35, 0.5, 2);
  emb.position.set(0.06, 0.63, 0.14);
  g.add(emb);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 4),
    new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: 1 }));
  stick.position.set(0.06, 0.68, 0.14);
  g.add(stick);

  g.position.set(x, 0, z);
  g.rotation.y = ry;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  parent.add(g);
  return g;
}

// ── props ───────────────────────────────────────────────────────────────────
const loader = new GLTFLoader();
export function grime(obj, amount = 0.55, tint = new THREE.Color(0x6a6459)) {
  obj.traverse((c) => {
    if (!c.isMesh || !c.material) return;
    const mats = Array.isArray(c.material) ? c.material : [c.material];
    for (const m of mats) {
      if (!m.color) continue;
      m.color.multiplyScalar(1 - amount * 0.42);
      if (m.roughness !== undefined) m.roughness = Math.min(1, (m.roughness ?? 0.8) + 0.2);
      if (m.metalness !== undefined) m.metalness = Math.max(0, (m.metalness ?? 0) - 0.15);
      // The colour that matters lives in the map, so it has to be desaturated in
      // the shader. Tinting material.color only darkens it.
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uDesat = { value: amount * 0.85 };
        sh.uniforms.uDirt = { value: new THREE.Color(tint) };
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform float uDesat; uniform vec3 uDirt;')
          .replace('#include <map_fragment>', `#include <map_fragment>
            float _l = dot(diffuseColor.rgb, vec3(0.2126,0.7152,0.0722));
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(_l), uDesat);
            diffuseColor.rgb = mix(diffuseColor.rgb, uDirt * (_l + 0.25), uDesat * 0.35);`);
      };
      m.customProgramCacheKey = () => 'grime' + amount.toFixed(2);
      m.needsUpdate = true;
    }
  });
  return obj;
}

// 2. Contact shadow. A soft dark disc on the floor under anything that stands on
//    it. Real shadow maps miss most of these lights, and without a contact
//    shadow every object reads as hovering.
let _shadowTex = null;
export function contactShadow(parent, x, z, r = 0.34, strength = 0.55) {
  if (!_shadowTex) {
    // Plain alpha blend: black in the middle fading to fully transparent. The
    // multiply version fought with three's blend factors and painted white
    // squares on the floor. Simple and predictable beats clever here.
    _shadowTex = canvasTex(128, (g, s) => {
      g.clearRect(0, 0, s, s);
      const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grd.addColorStop(0, 'rgba(0,0,0,0.85)');
      grd.addColorStop(0.45, 'rgba(0,0,0,0.42)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.fillRect(0, 0, s, s);
    }, false);
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(r * 2.4, r * 2.4),
    new THREE.MeshBasicMaterial({ map: _shadowTex, transparent: true, opacity: strength,
                                  depthWrite: false, depthTest: true,
                                  polygonOffset: true, polygonOffsetFactor: -3 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.012, z);
  m.renderOrder = 3;
  parent.add(m);
  return m;
}

export function loadProps(parent, list, onTri) {
  return Promise.all(list.map((it) => new Promise((res) => {
    loader.load(`assets/models/${it.id}/${it.id}.gltf`, (g) => {
      const o = g.scene;
      o.position.set(...it.pos);
      o.rotation.y = it.rot || 0;
      if (it.scale) o.scale.setScalar(it.scale);
      let n = 0;
      o.traverse((c) => {
        if (!c.isMesh) return;
        c.castShadow = true; c.receiveShadow = true;
        const gm = c.geometry;
        n += (gm.index ? gm.index.count : gm.attributes.position.count) / 3;
      });
      onTri?.(n);
      if (it.grime !== 0) grime(o, it.grime ?? 0.55);
      parent.add(o);
      res(o);
    }, undefined, () => res(null));
  })));
}
