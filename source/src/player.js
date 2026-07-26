// First-person movement built for a phone: slow, weighty, no precision needed.
// Collision is circle-vs-AABB against a small list of blockers — a corridor
// doesn't need a physics engine.
import * as THREE from 'three';
export const EYE = 1.62;
const RADIUS = 0.28;

export function createPlayer(start = { x: 0, z: -1.2 }) {
  return {
    pos: new THREE.Vector3(start.x, start.y || 0, start.z),
    groundY: start.y || 0,
    vel: new THREE.Vector3(),
    yaw: 0, pitch: 0,
    walked: 0, bob: 0, breath: 0,
    crouch: false,
    speed: 1.32,                 // deliberately slow. this is not an action game.
    blockers: [],
  };
}

export function addBlocker(p, x, z, r) { p.blockers.push({ x, z, r }); }

/** building must provide groundAt(x,z,y) and clampPos(x,z,r,prevX). */
export function step(player, input, dt, building) {
  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  const fwd = input.fwd || 0, lat = input.lat || 0;
  // camera faces -Z at yaw 0
  const wish = new THREE.Vector3(-sin * fwd + cos * lat, 0, -cos * fwd - sin * lat);
  const mag = Math.min(1, Math.hypot(fwd, lat));
  if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(player.speed * mag);

  const accel = wish.lengthSq() > 0 ? 9 : 12;
  player.vel.x += (wish.x - player.vel.x) * Math.min(1, accel * dt);
  player.vel.z += (wish.z - player.vel.z) * Math.min(1, accel * dt);

  let nx = player.pos.x + player.vel.x * dt;
  let nz = player.pos.z + player.vel.z * dt;

  const c = building.clampPos(nx, nz, RADIUS, player.pos.x);
  nx = c.x; nz = c.z;

  // props, only those on the floor we are actually standing on
  const fy = player.groundY;
  for (const b of player.blockers) {
    if (b.y !== undefined && Math.abs(b.y - fy) > 1.2) continue;
    const dx = nx - b.x, dz = nz - b.z;
    const min = b.r + RADIUS;
    const d2 = dx * dx + dz * dz;
    if (d2 < min * min && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      nx = b.x + (dx / d) * min;
      nz = b.z + (dz / d) * min;
    }
  }

  const moved = Math.hypot(nx - player.pos.x, nz - player.pos.z);
  player.pos.x = nx; player.pos.z = nz;
  player.walked += moved;

  // follow the walkable surface. smoothed, so stair treads feel like a slope
  // underfoot rather than a series of jolts.
  const target = building.groundAt(nx, nz, player.groundY);
  player.groundY += (target - player.groundY) * Math.min(1, 14 * dt);
  player.pos.y = player.groundY;

  // head bob keyed to distance, not time, so it stops dead when you do
  const amp = player.crouch ? 0.008 : 0.020;
  player.bob = Math.sin(player.walked * 4.4) * amp + Math.sin(player.walked * 8.8) * amp * 0.28;
  player.breath += dt * 0.9;

  return moved;
}

export function applyCamera(camera, player) {
  const sway = Math.sin(player.breath) * 0.0035;
  camera.position.set(
    player.pos.x,
    player.groundY + (player.crouch ? 1.05 : EYE) + player.bob + sway,
    player.pos.z,
  );
  camera.rotation.set(0, 0, 0);
  camera.rotateY(player.yaw);
  camera.rotateX(player.pitch);
  // a touch of roll when strafing, so movement has weight
  camera.rotateZ(-player.vel.x * 0.012 * Math.cos(player.yaw) - player.vel.z * 0.012 * Math.sin(player.yaw));
}
