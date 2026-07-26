// Stacks floors and stairwells into one building, owns the walkable-height
// query, and streams: only floors near the player stay visible.
import * as THREE from 'three';
import { W, L } from './world.js';
import { buildFloor, populate, animateFloor, materials } from './floor.js';
import { buildStairwell, stairHeight, FLOOR_RISE, SHAFT_W, SHAFT_Z_MIN, SHAFT_Z_MAX } from './stairs.js';

export { FLOOR_RISE, SHAFT_W, SHAFT_Z_MIN, SHAFT_Z_MAX };
const SPINE_HALF = 0.05;               // central wall between the two flights
const LANDING_Z = 4.15;                // beyond this the two flights join

export function createBuilding(scene, specs) {
  const floors = [];
  const stairs = [];
  const root = new THREE.Group();
  scene.add(root);
  const mats = materials();
  mats.stair = mats.recess;
  if (!mats.wallShaft) {
    mats.wallShaft = mats.wallB.clone();
    mats.wallShaft.side = THREE.DoubleSide;   // never lose a shaft wall to backface culling
    mats.wallShaft.color = new THREE.Color(0x6f7268);   // grimier than the corridors
    mats.stairStep = mats.recess.clone();
    mats.stairStep.color = new THREE.Color(0x585a52);
  }

  specs.forEach((spec, i) => {
    const f = buildFloor({ ...spec, index: i });
    f.group.position.y = i * FLOOR_RISE;
    root.add(f.group);
    floors.push(f);
    // a stairwell above every floor except the last
    if (i < specs.length - 1) {
      const holder = new THREE.Group();
      holder.position.y = i * FLOOR_RISE;
      root.add(holder);
      stairs.push({ ...buildStairwell(holder, mats, spec.stairs || {}), base: i, holder });
    }
  });

  const top = specs.length - 1;

  /** Walkable surface height in world space, given where the player already is. */
  function groundAt(x, z, currentY) {
    if (z <= 0) {
      const f = Math.max(0, Math.min(top, Math.round(currentY / FLOOR_RISE)));
      return f * FLOOR_RISE;
    }
    const sh = stairHeight(x, z);
    if (sh === null) return currentY;
    const f = Math.round(currentY / FLOOR_RISE);
    const cands = [];
    for (const base of [f - 1, f]) {
      if (base < 0 || base > top - 1) continue;
      cands.push(base * FLOOR_RISE + sh);
    }
    if (!cands.length) return currentY;
    cands.sort((a, b) => Math.abs(a - currentY) - Math.abs(b - currentY));
    return cands[0];
  }

  /** Clamp a position to the walkable footprint (corridor or shaft). */
  function clampPos(x, z, r, prevX) {
    if (z <= 0) {
      // corridor
      const hx = W / 2 - r;
      return {
        x: Math.max(-hx, Math.min(hx, x)),
        z: Math.max(-L + r + 0.2, Math.min(0, z)),
      };
    }
    // stairwell
    const hx = SHAFT_W / 2 - r;
    let nx = Math.max(-hx, Math.min(hx, x));
    const nz = Math.max(SHAFT_Z_MIN + r, Math.min(SHAFT_Z_MAX - r, z));
    // the spine wall separates the flights until the half landing
    if (nz > 0.55 && nz < LANDING_Z) {
      const side = (prevX ?? nx) < 0 ? -1 : 1;
      if (side < 0) nx = Math.min(nx, -SPINE_HALF - r);
      else nx = Math.max(nx, SPINE_HALF + r);
    }
    return { x: nx, z: nz };
  }

  /** Which floor index the player is currently standing on. */
  const floorOf = (y) => Math.max(0, Math.min(top, Math.round(y / FLOOR_RISE)));

  /**
   * Stream by floor. Geometry for neighbours stays visible (you can see up and
   * down the stairwell) but their LIGHTS are switched off, and only the floor
   * you are standing on is allowed to cast shadows.
   *
   * Point-light shadows are cube maps — six render passes each. Leaving them on
   * across three floors cost about 30fps on a phone.
   */
  let lastShown = -99;
  function stream(y, radius = 1) {
    const f = floorOf(y);
    if (f === lastShown) return;
    lastShown = f;
    floors.forEach((fl, i) => {
      const near = Math.abs(i - f) <= radius;
      fl.group.visible = near;
      const lit = i === f;
      fl.tubes.forEach((tu, k) => {
        tu.light.visible = lit;
        // exactly one shadow caster on the floor you are on, none anywhere else
        const wantShadow = lit && k === 1;
        if (tu.light.castShadow !== wantShadow) tu.light.castShadow = wantShadow;
      });
      fl.group.traverse((o) => {
        if (o.isPointLight && !fl.tubes.some((t) => t.light === o)) {
          o.visible = Math.abs(i - f) <= 1;
          if (o.castShadow) o.castShadow = false;
        }
      });
    });
    stairs.forEach((st) => {
      const near = Math.abs(st.base - f) <= radius;
      st.holder.visible = near;
      for (const lm of st.lamps) lm.visible = near;
      // only the shaft you can actually reach casts shadows
      st.lamp.castShadow = (st.base === f || st.base === f - 1);
    });
  }

  function animate(t, y) {
    const f = floorOf(y);
    for (let i = Math.max(0, f - 1); i <= Math.min(top, f + 1); i++) animateFloor(floors[i], t);
  }

  async function populateAll(propsByFloor, onTri) {
    for (let i = 0; i < floors.length; i++) {
      const props = propsByFloor[i] || [];
      if (props.length) await populate(floors[i], props, onTri);
    }
  }

  const homeFloor = floors.findIndex((f) => f.home);
  const home = homeFloor >= 0
    ? { ...floors[homeFloor].home, floor: homeFloor, y: homeFloor * FLOOR_RISE }
    : null;

  return { root, floors, stairs, groundAt, clampPos, floorOf, stream, animate, populateAll, top, home };
}
