// Dog-leg stairwell connecting one floor to the next. Two flights and a half
// landing, which is both how real blocks are built and the most useful shape
// for us: you have to turn a blind corner halfway up.
import * as THREE from 'three';
import { W, H, box, contactShadow } from './world.js';

export const FLOOR_RISE = 3.05;        // vertical gap between floors
export const SHAFT_W = 2.9;            // stairwell is wider than the corridor
const Z0 = 0.55;                       // where the flights start (corridor side)
const Z1 = 4.15;                       // where the half landing is
const LANDING_D = 1.15;
const STEPS = 11;                      // per flight

export const SHAFT_Z_MIN = -0.35;
export const SHAFT_Z_MAX = Z1 + LANDING_D + 0.35;

/**
 * Height of the walkable surface inside the shaft, relative to the floor base.
 * Returns null when the point is outside the stairwell footprint.
 */
export function stairHeight(x, z) {
  if (z < SHAFT_Z_MIN || z > SHAFT_Z_MAX) return null;
  if (Math.abs(x) > SHAFT_W / 2) return null;
  const half = FLOOR_RISE / 2;
  if (z >= Z1) return half;                                   // half landing
  if (z <= Z0) return x < 0 ? 0 : FLOOR_RISE;                 // bottom / top landing
  const t = (z - Z0) / (Z1 - Z0);
  // left flight climbs away from the corridor, right flight climbs back toward it
  return x < 0 ? half * t : half + half * (1 - t);
}

export function buildStairwell(parent, mats, opts = {}) {
  const g = new THREE.Group();
  const stepMat = mats.stairStep || mats.stair || mats.recess;
  const railMat = mats.frame;
  const half = FLOOR_RISE / 2;
  const run = Z1 - Z0;
  const sw = SHAFT_W / 2;

  // shaft walls
  for (const s of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(SHAFT_Z_MAX - SHAFT_Z_MIN, FLOOR_RISE + 0.4), mats.wallShaft);
    wall.rotation.y = s * Math.PI / 2;
    wall.position.set(s * sw, FLOOR_RISE / 2, (SHAFT_Z_MIN + SHAFT_Z_MAX) / 2);
    wall.receiveShadow = true;
    g.add(wall);
  }
  const back = new THREE.Mesh(new THREE.PlaneGeometry(SHAFT_W, FLOOR_RISE + 0.4), mats.wallShaft);
  back.rotation.y = Math.PI;
  back.position.set(0, FLOOR_RISE / 2, SHAFT_Z_MAX);
  back.receiveShadow = true;
  g.add(back);

  // bottom landing, in front of the corridor mouth
  box(g, SHAFT_W, 0.12, Z0 - SHAFT_Z_MIN, stepMat, 0, -0.06, (SHAFT_Z_MIN + Z0) / 2, 0, false);

  // two flights of actual steps
  for (const side of [-1, 1]) {
    for (let i = 0; i < STEPS; i++) {
      const t0 = i / STEPS, t1 = (i + 1) / STEPS;
      const zc = Z0 + (t0 + t1) / 2 * run;
      const d = run / STEPS;
      const y = side < 0 ? half * t1 : half + half * (1 - t0);
      box(g, sw - 0.02, 0.12, d, stepMat, side * (sw / 2), y - 0.06, zc, 0, false);
      // riser
      box(g, sw - 0.02, Math.abs(half / STEPS), 0.03, stepMat,
          side * (sw / 2), y - half / STEPS / 2, zc + (side < 0 ? -d / 2 : d / 2), 0, false);
    }
  }

  // half landing
  box(g, SHAFT_W, 0.12, LANDING_D, stepMat, 0, half - 0.06, Z1 + LANDING_D / 2, 0, false);
  // upper landing where you step off onto the next floor
  box(g, sw, 0.12, Z0 - SHAFT_Z_MIN, stepMat, sw / 2, FLOOR_RISE - 0.06, (SHAFT_Z_MIN + Z0) / 2, 0, false);

  // central spine wall between the two flights — this is what makes the corner blind
  box(g, 0.10, FLOOR_RISE * 0.62, run + LANDING_D, mats.wallB, 0, FLOOR_RISE * 0.31, Z0 + (run + LANDING_D) / 2, 0, false);

  // handrail along the spine
  for (const side of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const z = Z0 + t * run;
      const y = (side < 0 ? half * t : half + half * (1 - t)) + 0.92;
      pts.push(new THREE.Vector3(side * 0.13, y, z));
    }
    const rail = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.022, 6, false), railMat);
    rail.castShadow = true;
    g.add(rail);
  }

  // Two bulkhead lights, always the ugliest fittings in the building. One at the
  // half landing and one at the bottom — a single lamp at the top left the
  // flights in total darkness once distance falloff took hold.
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe0a8 });
  const mk = (x, y, z, intensity, shadow) => {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), bulbMat);
    bulb.position.set(x, y, z);
    g.add(bulb);
    const lamp = new THREE.PointLight(opts.lightColor ?? 0xffc98a,
      (opts.lightIntensity ?? 1) * intensity, 13, 1.55);
    lamp.position.copy(bulb.position);
    if (shadow) {
      lamp.castShadow = true;
      lamp.shadow.mapSize.set(1024, 1024);
      lamp.shadow.bias = -0.003;
      lamp.shadow.camera.far = 14;
    }
    g.add(lamp);
    return { bulb, lamp };
  };
  // on the side walls, clear of the spine — a lamp at x=0 is inside the wall
  const upper = mk(sw - 0.16, FLOOR_RISE - 0.34, Z1 + LANDING_D * 0.4, 4.2, true);
  const lower = mk(-(sw - 0.16), FLOOR_RISE * 0.30, Z0 + 0.9, 2.6, false);
  const bulb = upper.bulb, lamp = upper.lamp;

  parent.add(g);
  return { group: g, bulb, lamp, lamps: [upper.lamp, lower.lamp] };
}
