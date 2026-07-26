import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { W, H, L } from './world.js';
import { createBuilding, FLOOR_RISE } from './building.js';
import { FLOORS, PROPS_BY_FLOOR } from './floors.data.js';
import { createPlayer, addBlocker, step, applyCamera, EYE } from './player.js';
import { createInput, TOUCH } from './input.js';

const P = new URLSearchParams(location.search);
const SHOOT = P.has('shoot') || P.has('walk') || P.has('diag');
const log = (m) => { fetch('/log', { method: 'POST', body: String(m) }).catch(() => {}); console.log(m); };

// ── renderer ────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({
  antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: SHOOT,
});
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0e12);
scene.fog = new THREE.FogExp2(0x141e26, 0.036);
const camera = new THREE.PerspectiveCamera(66, 1, 0.04, 90);

// ── the building ────────────────────────────────────────────────────────────
const building = createBuilding(scene, FLOORS);
const pal0 = building.floors[0].palette;
scene.fog = new THREE.FogExp2(pal0.fog, 0.036);
const hemi = new THREE.HemisphereLight(pal0.hemiSky, pal0.hemiGnd, 1.28);
scene.add(hemi, new THREE.AmbientLight(0x2c3540, 0.55));
const fogCol = new THREE.Color();

// palette follows whichever floor you are on, so the building changes mood as
// you climb rather than all at once
function applyPalette(y) {
  const p = building.floors[building.floorOf(y)].palette;
  fogCol.setHex(p.fog);
  scene.fog.color.lerp(fogCol, 0.06);
  scene.background.lerp(fogCol, 0.06);
  hemi.color.lerp(new THREE.Color(p.hemiSky), 0.06);
  hemi.groundColor.lerp(new THREE.Color(p.hemiGnd), 0.06);
}

const player = createPlayer({ x: 0, y: 0, z: -1.3 });
const input = createInput();
let tris = 0;

// ── post ────────────────────────────────────────────────────────────────────
const Grade = {
  uniforms: { tDiffuse: { value: null }, uSeed: { value: new THREE.Vector2() },
              uGrain: { value: 0.024 }, uVig: { value: 0.34 }, uAber: { value: 0.0011 } },
  vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 uSeed; uniform float uGrain,uVig,uAber; varying vec2 vUv;
    float hash(vec2 p){ vec3 q=fract(vec3(p.xyx)*0.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
    void main(){
      vec2 d=vUv-0.5; vec2 o=d*uAber*(0.3+dot(d,d)*2.4);
      vec3 c=vec3(texture2D(tDiffuse,vUv+o).r, texture2D(tDiffuse,vUv).g, texture2D(tDiffuse,vUv-o).b);
      c *= vec3(0.96,1.02,0.99);                     // fluorescent green cast
      float l=dot(c,vec3(0.2126,0.7152,0.0722));
      c=mix(vec3(l),c,0.90);
      c*=mix(1.0,smoothstep(0.99,0.18,length(d)),uVig);
      c+=(hash(gl_FragCoord.xy+uSeed)-0.5)*uGrain*(1.3-l*0.7);
      gl_FragColor=vec4(c,1.0);
    }`,
};
let composer, grade;
function buildComposer(w, h) {
  if (composer) composer.dispose();
  const rt = new THREE.WebGLRenderTarget(w, h, { samples: TOUCH ? 0 : 4, type: THREE.HalfFloatType });
  composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(1); composer.setSize(w, h);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.52, 0.62, 0.74));
  grade = new ShaderPass(Grade);
  composer.addPass(grade);
  composer.addPass(new OutputPass());
}

// ── device-pixel-aware dynamic resolution ──────────────────────────────────
const DRS = { scale: TOUCH ? 0.55 : 0.75, min: 0.32, max: TOUCH ? 0.85 : 1.0,
              samples: [], votes: 0, cool: 0 };
function applyScale() {
  const dpr = Math.min(devicePixelRatio || 1, TOUCH ? 2.5 : 2);
  const w = Math.max(340, Math.round(innerWidth * dpr * DRS.scale));
  const h = Math.max(340, Math.round(innerHeight * dpr * DRS.scale));
  renderer.setSize(w, h, false);
  const c = renderer.domElement;
  c.style.width = innerWidth + 'px';
  c.style.height = innerHeight + 'px';
  camera.aspect = innerWidth / innerHeight;
  camera.fov = innerHeight > innerWidth ? 72 : 64;    // portrait needs more vertical
  camera.updateProjectionMatrix();
  buildComposer(w, h);
}
function tune(ms) {
  DRS.samples.push(ms);
  if (DRS.samples.length < 30) return;
  const avg = DRS.samples.reduce((a, b) => a + b, 0) / DRS.samples.length;
  DRS.samples.length = 0;
  if (DRS.cool > 0) { DRS.cool--; DRS.votes = 0; return; }
  const want = avg > 19 ? -1 : avg < 11 ? 1 : 0;
  DRS.votes = want === 0 ? 0 : (Math.sign(DRS.votes) === want ? DRS.votes + want : want);
  if (Math.abs(DRS.votes) >= 3) {
    DRS.scale = Math.max(DRS.min, Math.min(DRS.max, DRS.scale + (DRS.votes > 0 ? 0.05 : -0.05)));
    DRS.votes = 0; DRS.cool = 6; applyScale();
  }
}
addEventListener('resize', () => { if (!SHOOT) applyScale(); });

// ── objective + HUD ─────────────────────────────────────────────────────────
const el = (id) => document.getElementById(id);
let ended = false;
let promptShown = '';

function nearHome() {
  const h = building.home;
  if (!h) return false;
  if (building.floorOf(player.groundY) !== h.floor) return false;
  return Math.hypot(player.pos.x - h.x, player.pos.z - h.z) < 1.9;
}

function finish() {
  if (ended) return;
  ended = true;
  const card = el('end');
  if (!card) return;
  card.innerHTML = '<h1>You are home.</h1>' +
    '<p>You lock the door behind you.</p>' +
    '<button class="ui" id="again">AGAIN</button>';
  card.classList.add('show');
  el('again')?.addEventListener('click', () => location.reload());
  el('again')?.addEventListener('touchend', (e) => { e.preventDefault(); location.reload(); }, { passive: false });
}

function updateHud(inp) {
  const f = building.floorOf(player.groundY);
  const fl = el('floor');
  if (fl) fl.textContent = f >= building.top ? 'TOP FLOOR' : `FLOOR ${f + 1}`;
  const want = nearHome() ? 'your door' : '';
  if (want !== promptShown) {
    promptShown = want;
    const p2 = el('prompt');
    if (p2) { p2.textContent = want; p2.classList.toggle('on', !!want); }
  }
  if (inp.interact && nearHome()) finish();
}

// ── loop ────────────────────────────────────────────────────────────────────
let t = 0;
function flicker(dt) { t += dt; building.animate(t, player.groundY); }

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.06, (now - last) / 1000);
  last = now;
  const inp = input.read();
  const sens = TOUCH ? 0.0040 : 0.0022;
  player.yaw -= inp.lookX * sens;
  player.pitch = Math.max(-1.15, Math.min(1.15, player.pitch - inp.lookY * sens));
  player.crouch = inp.crouch;
  step(player, inp, dt, building);
  applyCamera(camera, player);
  building.stream(player.groundY);
  applyPalette(player.groundY);
  updateHud(inp);
  flicker(dt);
  grade.uniforms.uSeed.value.set(Math.random() * 900, Math.random() * 900);
  composer.render();
  tune(performance.now() - now);
  requestAnimationFrame(frame);
}

// ── boot ────────────────────────────────────────────────────────────────────
(async function boot() {
  await building.populateAll(PROPS_BY_FLOOR, (n) => { tris += n; });
  building.floors.forEach((f, i) => {
    for (const b of f.blockers) player.blockers.push({ x: b.x, z: b.z, r: b.r, y: i * FLOOR_RISE });
  });
  log(`building: ${building.floors.length} floors, ${Math.round(tris)} prop tris, ${player.blockers.length} blockers`);

  if (TOUCH) document.body.classList.add('touch');
  if (!TOUCH) renderer.domElement.addEventListener('click', () => renderer.domElement.requestPointerLock());

  if (P.has('diag')) {
    const st = building.stairs[0];
    const bb = new THREE.Box3().setFromObject(st.group);
    let meshes = 0, lit = 0;
    st.group.traverse((o) => { if (o.isMesh) { meshes++; if (o.material?.isMeshStandardMaterial) lit++; } });
    const f0 = new THREE.Box3().setFromObject(building.floors[0].group);
    await fetch('/done', { method: 'POST', body: JSON.stringify({
      stairMeshes: meshes, standardMats: lit,
      stairBox: { min: bb.min.toArray().map(n => +n.toFixed(2)), max: bb.max.toArray().map(n => +n.toFixed(2)) },
      floor0Box: { min: f0.min.toArray().map(n => +n.toFixed(2)), max: f0.max.toArray().map(n => +n.toFixed(2)) },
      holderY: st.holder.position.y,
      holderVisible: st.holder.visible, groupVisible: st.group.visible,
      lamps: st.lamps.map(l => ({ pos: l.position.toArray().map(n => +n.toFixed(2)), i: l.intensity, vis: l.visible })),
      rootChildren: building.root.children.length,
    }) });
    document.title = 'DONE';
    return;
  }
  if (P.has('walk')) return walkTest();
  if (SHOOT) return shoot();
  applyScale();
  document.getElementById('gate')?.classList.add('hide');
  requestAnimationFrame(frame);
})();

// ── walk test ───────────────────────────────────────────────────────────────
// Drives the real movement code and asserts what stills cannot show: that you
// actually move, stay inside the corridor, and never end up inside a prop.
async function walkTest() {
  try {
  const errs = [];
  addEventListener('error', (e) => errs.push(e.message));
  applyScale();
  const probe = { minClear: 1e9, maxAbsX: 0, minZ: 0, frames: 0, start: player.pos.clone(),
                  maxY: 0, floorsSeen: new Set(), missed: [] };

  // Steer toward waypoints instead of guessing blind directions. A scripted
  // heading cannot round a dog-leg landing; a waypoint can.
  const route = [];
  const climb = (n) => {
    route.push({ x: 0, z: -6.0, tag: `f${n} corridor` });
    route.push({ x: 0, z: -1.0, tag: `f${n} mouth` });
    route.push({ x: -0.72, z: 1.4, tag: `f${n} left flight` });
    route.push({ x: -0.72, z: 3.9, tag: `f${n} half landing` });
    route.push({ x: 0.72, z: 4.6, tag: `f${n} cross landing` });
    route.push({ x: 0.72, z: 1.0, tag: `f${n} right flight` });
    route.push({ x: 0.30, z: -1.6, tag: `f${n + 1} arrive` });
  };
  climb(0); climb(1);
  route.push({ x: 0, z: -8.0, tag: 'f2 corridor' });

  const t0 = performance.now();
  for (const wp of route) {
    const deadline = performance.now() + 14000;
    let reached = false;
    while (performance.now() < deadline) {
      const now = performance.now();
      const dt = Math.min(0.06, (now - last) / 1000); last = now;
      const dx = wp.x - player.pos.x, dz = wp.z - player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.42) { reached = true; break; }
      // face the waypoint (camera looks down -Z at yaw 0) and walk
      player.yaw = Math.atan2(-dx, -dz);
      step(player, { fwd: 1, lat: 0 }, dt, building);
      applyCamera(camera, player);
      building.stream(player.groundY);
      flicker(dt);
      composer.render();
      await new Promise((r) => requestAnimationFrame(r));
      probe.frames++;
      probe.maxAbsX = Math.max(probe.maxAbsX, Math.abs(player.pos.x));
      probe.minZ = Math.min(probe.minZ, player.pos.z);
      probe.maxY = Math.max(probe.maxY, player.groundY);
      probe.floorsSeen.add(building.floorOf(player.groundY));
      for (const b of player.blockers) {
        if (b.y !== undefined && Math.abs(b.y - player.groundY) > 1.2) continue;
        probe.minClear = Math.min(probe.minClear,
          Math.hypot(player.pos.x - b.x, player.pos.z - b.z) - b.r - 0.28);
      }
    }
    if (!reached) probe.missed.push(wp.tag);
    log(`${reached ? 'reached' : 'MISSED '} ${wp.tag}  y=${player.groundY.toFixed(2)}`);
  }
  const secs = (performance.now() - t0) / 1000;
  const expectEye = player.groundY + (player.crouch ? 1.05 : EYE) + player.bob;
  const body = JSON.stringify({
    errors: errs,
    fps: +(probe.frames / secs).toFixed(1),
    touchMode: TOUCH,
    renderPx: `${renderer.domElement.width}x${renderer.domElement.height}`,
    dpr: devicePixelRatio,
    drsScale: +DRS.scale.toFixed(2),
    viewport: `${innerWidth}x${innerHeight}`,
    missedWaypoints: probe.missed,
    climbedMetres: +probe.maxY.toFixed(2),
    floorsReached: [...probe.floorsSeen].sort((a, b) => a - b),
    endFloor: building.floorOf(player.groundY),
    floorRise: FLOOR_RISE,
    deepestZ: +probe.minZ.toFixed(2),
    corridorHalfWidth: +(W / 2).toFixed(2),
    maxAbsX: +probe.maxAbsX.toFixed(3),
    minPropClearance: +probe.minClear.toFixed(3),
    eyeHeightError: +Math.abs(camera.position.y - expectEye).toFixed(4),
  });
  await fetch('/done', { method: 'POST', body });
  document.title = 'DONE';
  } catch (e) {
    log('WALK FAILED: ' + (e && e.stack ? e.stack : e));
    await fetch('/done', { method: 'POST', body: JSON.stringify({ fatal: String(e) }) }).catch(() => {});
    document.title = 'DONE';
  }
}

// ── vet harness ─────────────────────────────────────────────────────────────
async function shoot() {
  // ?flat=1 removes lighting from the equation entirely
  if (P.has('flat')) scene.overrideMaterial = new THREE.MeshNormalMaterial();
  if (P.has('noshadow')) {
    renderer.shadowMap.enabled = false;
    scene.traverse((o) => { if (o.isLight) o.castShadow = false; });
  }
  const VIEWS = P.has('lean') ? [
    { name: 'z_home', w: 420, h: 780, gy: 21.35, pos: [0.5, EYE + 21.35, -13.4], yaw: 0.55, pitch: -0.05, fov: 72 },
  ] : [
    { name: 'a_entrance_port', w: 780, h: 1450, pos: [0, EYE, -1.3], yaw: 0, pitch: -0.02, fov: 72 },
    { name: 'b_midway_port',   w: 780, h: 1450, pos: [-0.2, EYE, -9.0], yaw: -0.10, pitch: -0.04, fov: 72 },
    { name: 'c_resident_port', w: 780, h: 1450, pos: [-0.1, EYE, -13.5], yaw: 0.03, pitch: -0.02, fov: 72 },
    { name: 'd_shrine_port',   w: 780, h: 1450, pos: [0.55, EYE, -20.9], yaw: 0.80, pitch: -0.20, fov: 72 },
    { name: 'c2_figure_close', w: 780, h: 1450, pos: [-0.30, EYE, -15.4], yaw: -0.28, pitch: -0.14, fov: 66 },
    { name: 'p1_tv',     w: 780, h: 1450, gy: 3.05, pos: [0.2, EYE + 3.05, -11.5], yaw: -0.06, pitch: -0.05, fov: 72 },
    { name: 'p2_reno',   w: 780, h: 1450, gy: 6.10, pos: [0.1, EYE + 6.10, -6.4], yaw: 0.02, pitch: -0.03, fov: 72 },
    { name: 'p3_water',  w: 780, h: 1450, gy: 9.15, pos: [0.0, EYE + 9.15, -4.2], yaw: 0.0, pitch: -0.10, fov: 72 },
    { name: 'p4_hoard',  w: 780, h: 1450, gy: 12.20, pos: [0.0, EYE + 12.20, -5.6], yaw: 0.0, pitch: -0.04, fov: 72 },
    { name: 's1_stair_up',   w: 780, h: 1450, pos: [-0.74, EYE, -0.1], yaw: Math.PI - 0.18, pitch: 0.10, fov: 74 },
    { name: 's2_stair_land', w: 780, h: 1450, pos: [-0.72, EYE + 1.1, 2.6], yaw: Math.PI, pitch: 0.06, fov: 72 },
    { name: 's3_stair_down', w: 1400, h: 760, pos: [0.72, EYE + 2.6, 1.6], yaw: 0.35, pitch: -0.38, fov: 66 },
    { name: 'e_wide_land',     w: 1400, h: 760, pos: [0, EYE, -2.2], yaw: 0, pitch: -0.03, fov: 64 },
    { name: 'f_door_land',     w: 1400, h: 760, pos: [0.55, 1.5, -7.6], yaw: Math.PI / 2, pitch: -0.05, fov: 58 },
  ];
  for (const v of VIEWS) {
    building.stream(v.gy ?? 0);          // cull to one floor's lights, as the game does
    renderer.setSize(v.w, v.h, false);
    renderer.domElement.style.width = v.w + 'px';
    renderer.domElement.style.height = v.h + 'px';
    camera.aspect = v.w / v.h; camera.fov = v.fov;
    camera.position.set(...v.pos);
    camera.rotation.set(0, 0, 0);
    camera.rotateY(v.yaw); camera.rotateX(v.pitch);
    camera.updateProjectionMatrix();
    buildComposer(v.w, v.h);
    for (let i = 0; i < 8; i++) { flicker(0.016); composer.render(); await new Promise((r) => requestAnimationFrame(r)); }
    await fetch('/shot', { method: 'POST', body: JSON.stringify({ name: v.name, data: renderer.domElement.toDataURL('image/png') }) });
    log(`shot ${v.name}`);
  }
  await fetch('/done', { method: 'POST', body: JSON.stringify({ tris: Math.round(tris), calls: renderer.info.render.calls }) });
  document.title = 'DONE';
}
