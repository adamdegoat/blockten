// A floor is DATA. buildFloor() takes a spec and returns everything the game
// needs: geometry, collision, lights, doors, interactables. Adding floor seven
// means adding one object to a list, not writing another builder.
import * as THREE from 'three';
import {
  W, H, surface, buildShell, buildDoors, dress, spiritHouse,
  loadProps, box, contactShadow,
} from './world.js';
import { water, blockage, renovation, television, animateWater, animateTelevision } from './setpieces.js';

// ── condition drives everything about how wrecked a floor looks ─────────────
// 0 = tired but normal, 1 = something is very wrong here.
export const PALETTES = {
  fluoro:  { tube: 0xd6efe8, hemiSky: 0x55697f, hemiGnd: 0x241f18, fog: 0x141e26 },
  sodium:  { tube: 0xffc07a, hemiSky: 0x6a5a48, hemiGnd: 0x241c14, fog: 0x1d1811 },
  failing: { tube: 0xa8c4bd, hemiSky: 0x3d4c5c, hemiGnd: 0x181712, fog: 0x0e151b },
  wrong:   { tube: 0xbfd6c8, hemiSky: 0x2c3a3a, hemiGnd: 0x120f0f, fog: 0x0a1010 },
};

export const DEFAULT_FLOOR = {
  index: 6,
  length: 26,
  palette: 'fluoro',
  condition: 0.5,
  doors: { count: 8, spacing: 3.0, startZ: -2.6 },
  tubes: { count: 7, spacing: 3.6, startZ: -1.8, dead: [5], flicker: [2] },
  features: ['pipes', 'cables', 'meters', 'notices', 'stains', 'laundry', 'skirting'],
  shrine: null,             // { x, z, ry } or null
  endWindow: true,
  props: [],
  figures: [],              // { x, z, ry, pose }
  warmDoors: [],            // z positions with a light on inside
};

// Shared materials, built once and reused across every floor — this is what
// keeps a tall building inside the mobile memory budget.
let MATS = null;
export function materials() {
  if (MATS) return MATS;
  MATS = {
    floor:  surface('floor_tiles_06', 4, 22, 0x8e8d86, 0.70),
    ceil:   surface('dirty_concrete', 3, 16, 0x7a736a),
    wallA:  surface('peeling_painted_wall', 14, 2.0, 0xc2c8b8),
    wallB:  surface('concrete_wall_008', 12, 1.8, 0xb0b2a8),
    door:   surface('weathered_planks', 1.1, 1.4, 0x76695a),
    frame:  surface('rusty_metal_sheet', 1, 1, 0x5a544a, 0.85),
    recess: surface('concrete_wall_008', 1, 1, 0x5d5f58),
  };
  return MATS;
}

const darkMat = new THREE.MeshStandardMaterial({ color: 0x0e1015, roughness: 0.95 });

// One silhouette, overlapping parts. Never three stacked pills with gaps.
export function figure(parent, x, z, ry) {
  const g = new THREE.Group();
  const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.150, 0.62, 4, 8), darkMat);
  legs.position.y = 0.46;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.205, 0.60, 4, 10), darkMat);
  body.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.118, 14, 12), darkMat);
  head.position.y = 1.64;
  g.add(legs, body, head);
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  parent.add(g);
  contactShadow(parent, x, z, 0.30, 0.72);
  return g;
}

/**
 * Build one floor from a spec.
 * @returns {{group, blockers, doors, tubes, lights, figures, palette, length}}
 */
export function buildFloor(spec = {}) {
  const s = {
    ...DEFAULT_FLOOR, ...spec,
    doors: { ...DEFAULT_FLOOR.doors, ...(spec.doors || {}) },
    tubes: { ...DEFAULT_FLOOR.tubes, ...(spec.tubes || {}) },
  };
  const pal = PALETTES[s.palette] || PALETTES.fluoro;
  const mats = materials();
  const group = new THREE.Group();
  const blockers = [];
  const tubes = [];
  const figures = [];

  // deterministic per-floor variation, so a floor looks the same every visit
  let seed = (s.index * 2654435761) >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  buildShell(group, mats, s.length);
  const doors = buildDoors(group, mats, s.doors.count, s.doors.spacing, s.doors.startZ);
  dress(group, mats, rnd, s.length, s.features, s.condition);

  if (s.shrine) spiritHouse(group, s.shrine.x, s.shrine.z, s.shrine.ry ?? 0);

  if (s.endWindow) {
    box(group, W, H, 0.12, mats.frame, 0, H / 2, -s.length);
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.3),
      new THREE.MeshBasicMaterial({ color: 0x1e3247 }));
    sky.position.set(0, 1.55, -s.length + 0.09);
    group.add(sky);
    for (let i = 0; i < 9; i++) {
      box(group, 0.032, 1.3, 0.032, mats.frame, -0.72 + i * 0.18, 1.55, -s.length + 0.06, 0, false);
    }
    const cold = new THREE.PointLight(0x6f9dc4, 7, 13, 1.6);
    cold.position.set(0, 1.7, -s.length + 1.3);
    group.add(cold);
  }

  // ── tubes ─────────────────────────────────────────────────────────────────
  // more of them fail as the condition worsens
  const extraDead = Math.floor(s.condition * 2);
  for (let i = 0; i < s.tubes.count; i++) {
    const z = s.tubes.startZ - i * s.tubes.spacing;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 1.12),
      new THREE.MeshBasicMaterial({ color: pal.tube }));
    glass.position.set(0, H - 0.11, z);
    group.add(glass);
    box(group, 0.16, 0.07, 1.26, mats.frame, 0, H - 0.045, z, 0, false);

    const light = new THREE.PointLight(pal.tube, 9.5, 15, 1.5);
    light.position.set(0, H - 0.24, z);
    // only two shadow casters per floor: the second geometry pass is the
    // single most expensive thing we can spend on
    if (i === 1 || i === Math.min(4, s.tubes.count - 2)) {
      light.castShadow = true;
      light.shadow.mapSize.set(1024, 1024);
      light.shadow.bias = -0.003;
      light.shadow.camera.far = 12;
    }
    group.add(light);

    let state = 'on';
    if (s.tubes.dead.includes(i) || (extraDead > 0 && i % 3 === 2 && rnd() < s.condition)) state = 'dead';
    else if (s.tubes.flicker.includes(i)) state = 'flicker';
    tubes.push({ glass, light, state, phase: i * 1.7, base: 9.5 });
  }

  for (const z of s.warmDoors) {
    const warm = new THREE.PointLight(0xffb469, 1.5, 2.8, 1.7);
    warm.position.set(-W / 2 + 0.28, 0.16, z);
    group.add(warm);
  }

  for (const f of s.figures) figures.push(figure(group, f.x, f.z, f.ry));
  for (const f of s.figures) blockers.push({ x: f.x, z: f.z, r: 0.4 });
  if (s.shrine) blockers.push({ x: s.shrine.x, z: s.shrine.z, r: 0.35 });

  // ── set pieces ────────────────────────────────────────────────────────────
  let wet = null, tv = null;
  if (s.water) wet = water(group, s.length, s.water);
  if (s.blockage) {
    for (const b of s.blockage) {
      const r = blockage(group, mats, b.z, b.side ?? 1, rnd);
      blockers.push(r.blocker);
    }
  }
  if (s.renovation) for (const z of s.renovation) renovation(group, mats, z, rnd);

  // your own door: the only one in the building that is lit and painted
  let home = null;
  if (s.homeDoor) {
    const hz = s.homeDoor.z, hs = s.homeDoor.side ?? -1;
    const paint = new THREE.MeshStandardMaterial({ color: 0x5d6b52, roughness: 0.72 });
    box(group, 0.07, 1.98, 0.84, paint, hs * (W / 2 - 0.04), 1.00, hz);
    box(group, 0.08, 2.16, 0.08, mats.frame, hs * (W / 2 - 0.03), 1.08, hz - 0.48, 0, false);
    box(group, 0.08, 2.16, 0.08, mats.frame, hs * (W / 2 - 0.03), 1.08, hz + 0.48, 0, false);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.11),
      new THREE.MeshStandardMaterial({ color: 0xd8cfb6, roughness: 0.6 }));
    plate.position.set(hs * (W / 2 - 0.10), 1.86, hz);
    plate.rotation.y = hs * -Math.PI / 2;
    group.add(plate);
    // a small light over it, the one working fitting up here
    const lamp = new THREE.PointLight(0xffd9a4, 3.0, 4.5, 1.5);
    lamp.position.set(hs * (W / 2 - 0.4), 2.15, hz);
    group.add(lamp);
    home = { x: hs * (W / 2 - 0.5), z: hz };
  }
  if (s.television) tv = television(group, s.television.z, s.television.side ?? -1);

  return {
    group, blockers, doors, tubes, figures, wet, tv, home,
    palette: pal, length: s.length, index: s.index, spec: s,
  };
}

/** Props load asynchronously; call after buildFloor and pass the result. */
export async function populate(floor, props, onTri) {
  await loadProps(floor.group, props, onTri);
  for (const p of props) {
    floor.blockers.push({ x: p.pos[0], z: p.pos[2], r: p.r ?? 0.3 });
    contactShadow(floor.group, p.pos[0], p.pos[2], (p.r ?? 0.3) * 1.15, 0.6);
  }
  return floor;
}

/** Drive every tube on a floor. Call once per frame. */
export function animateFloor(floor, t) {
  animateTubes(floor, t);
  animateWater(floor.wet, t);
  animateTelevision(floor.tv, t);
}

export function animateTubes(floor, t) {
  for (const tu of floor.tubes) {
    let v = 1;
    if (tu.state === 'dead') v = 0.02;
    else if (tu.state === 'flicker') {
      const n = Math.sin(t * 34 + tu.phase) * Math.sin(t * 10.7 + tu.phase * 2);
      v = n > 0.08 ? 1 : (Math.random() < 0.28 ? 0.28 : 0.05);
    }
    tu.light.intensity = tu.base * v;
    tu.glass.material.color.setRGB(0.84 * v + 0.03, 0.94 * v + 0.03, 0.91 * v + 0.03);
  }
}
