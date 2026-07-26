// The building, floor by floor. Each entry is data — no code per floor.
// Condition climbs as you go up, and so does how wrong the place feels.
import { W } from './world.js';

const L = 26;

export const FLOORS = [
  { // 0 — ground. Almost normal. Rain outside the grille.
    length: L, palette: 'sodium', condition: 0.12,
    doors: { count: 6, spacing: 3.4, startZ: -3.2 },
    tubes: { count: 7, spacing: 3.6, startZ: -1.8, dead: [], flicker: [] },
    features: ['pipes', 'cables', 'meters', 'notices', 'skirting'],
    warmDoors: [-6.6, -13.4],
    endWindow: true,
  },
  { // 1 — someone's television is on
    length: L, palette: 'fluoro', condition: 0.25,
    doors: { count: 8, spacing: 3.0, startZ: -2.6 },
    tubes: { count: 7, spacing: 3.6, startZ: -1.8, dead: [], flicker: [4] },
    features: ['pipes', 'cables', 'notices', 'stains', 'laundry', 'skirting'],
    warmDoors: [-9.2],
    television: { z: -14.8, side: -1 },
    endWindow: true,
  },
  { // 2 — renovation abandoned mid-job
    length: L, palette: 'fluoro', condition: 0.42,
    doors: { count: 8, spacing: 3.0, startZ: -2.6 },
    tubes: { count: 6, spacing: 4.1, startZ: -2.2, dead: [3], flicker: [1] },
    features: ['pipes', 'cables', 'meters', 'stains', 'skirting'],
    renovation: [-9.5, -17.0],
    endWindow: true,
  },
  { // 3 — water
    length: L, palette: 'failing', condition: 0.55,
    doors: { count: 8, spacing: 3.0, startZ: -2.6 },
    tubes: { count: 6, spacing: 4.1, startZ: -2.0, dead: [2, 4], flicker: [0] },
    features: ['pipes', 'cables', 'stains', 'skirting'],
    water: 0.045,
    endWindow: true,
  },
  { // 4 — belongings stacked to the ceiling
    length: L, palette: 'fluoro', condition: 0.62,
    doors: { count: 8, spacing: 3.0, startZ: -2.6 },
    tubes: { count: 6, spacing: 4.1, startZ: -2.0, dead: [4], flicker: [2] },
    features: ['pipes', 'cables', 'notices', 'stains', 'laundry', 'skirting'],
    warmDoors: [-16.8],
    blockage: [{ z: -9.0, side: 1 }, { z: -14.2, side: -1 }],
    endWindow: true,
  },
  { // 5 — the shrine floor, and the resident who does not move
    length: L, palette: 'fluoro', condition: 0.58,
    doors: { count: 8, spacing: 3.0, startZ: -2.6 },
    tubes: { count: 7, spacing: 3.6, startZ: -1.8, dead: [5], flicker: [2] },
    features: ['pipes', 'cables', 'meters', 'notices', 'stains', 'laundry', 'skirting'],
    shrine: { x: -W / 2 + 0.34, z: -22.6, ry: 0.5 },
    warmDoors: [-11.6],
    figures: [{ x: 0.44, z: -17.4, ry: Math.PI * 0.88 }],
    endWindow: true,
  },
  { // 6 — nearly everything has failed
    length: L, palette: 'failing', condition: 0.85,
    doors: { count: 8, spacing: 3.0, startZ: -2.6 },
    tubes: { count: 6, spacing: 4.1, startZ: -2.0, dead: [0, 2, 3, 5], flicker: [4] },
    features: ['pipes', 'cables', 'stains', 'skirting'],
    figures: [{ x: -0.5, z: -8.2, ry: 1.55 }, { x: 0.52, z: -20.4, ry: 3.05 }],
    stairs: { lightIntensity: 2.2, lightColor: 0xffb070 },
    endWindow: true,
  },
  { // 7 — the top. Your door is at the end of it.
    length: 18, palette: 'wrong', condition: 0.95,
    doors: { count: 5, spacing: 3.0, startZ: -2.6 },
    tubes: { count: 5, spacing: 3.6, startZ: -1.8, dead: [1, 3], flicker: [0, 2] },
    features: ['cables', 'stains', 'skirting'],
    figures: [{ x: 0.0, z: -12.0, ry: 0 }],
    homeDoor: { z: -15.6, side: -1 },
    endWindow: false,
    isTop: true,
  },
];

export const PROPS_BY_FLOOR = {
  0: [
    { id: 'plastic_monobloc_chair_01', pos: [-0.72, 0, -4.4], rot: 2.2, r: 0.32 },
    { id: 'cardboard_box_01', pos: [0.80, 0, -10.2], rot: -0.3, r: 0.30 },
  ],
  1: [
    { id: 'plastic_monobloc_chair_01', pos: [0.70, 0, -6.8], rot: -1.1, r: 0.32 },
    { id: 'cement_bag', pos: [-0.78, 0, -14.6], rot: 0.6, r: 0.30, grime: 0.7 },
  ],
  2: [
    { id: 'wooden_crate_02', pos: [-0.80, 0, -6.0], rot: 0.4, r: 0.32 },
    { id: 'cement_bag', pos: [-0.74, 0, -7.4], rot: -0.9, r: 0.30, grime: 0.6 },
    { id: 'Barrel_01', pos: [0.82, 0, -12.8], rot: 0.2, r: 0.30, grime: 0.75 },
    { id: 'cardboard_box_01', pos: [0.76, 0, -18.4], rot: 0.8, r: 0.30 },
  ],
  3: [
    { id: 'Barrel_01', pos: [-0.80, 0, -9.5], rot: 1.0, r: 0.30, grime: 0.85 },
    { id: 'compost_bags', pos: [0.74, 0, -16.2], rot: 0.5, r: 0.34, grime: 0.9 },
  ],
  4: [
    { id: 'wooden_crate_02', pos: [-0.78, 0, -5.0], rot: 0.3, r: 0.32 },
    { id: 'cardboard_box_01', pos: [-0.74, 0, -6.4], rot: -0.6, r: 0.30 },
    { id: 'compost_bags', pos: [-0.76, 0, -8.0], rot: 0.9, r: 0.34, grime: 0.85 },
    { id: 'plastic_monobloc_chair_01', pos: [0.72, 0, -11.4], rot: 1.4, r: 0.32 },
    { id: 'Barrel_01', pos: [-0.80, 0, -15.6], rot: 0.1, r: 0.30, grime: 0.8 },
    { id: 'cement_bag', pos: [0.76, 0, -19.8], rot: -1.2, r: 0.30, grime: 0.7 },
  ],
  5: [
    { id: 'plastic_monobloc_chair_01', pos: [-0.74, 0, -5.2], rot: 1.9, r: 0.32 },
    { id: 'cardboard_box_01', pos: [0.80, 0, -8.6], rot: -0.4, r: 0.30 },
    { id: 'compost_bags', pos: [0.74, 0, -12.2], rot: 0.7, r: 0.34, grime: 0.88 },
    { id: 'Barrel_01', pos: [-0.82, 0, -15.0], rot: 0.2, r: 0.30, grime: 0.80 },
    { id: 'cement_bag', pos: [0.76, 0, -19.0], rot: -1.1, r: 0.30, grime: 0.70 },
    { id: 'wooden_crate_02', pos: [-0.80, 0, -21.4], rot: 0.5, r: 0.32 },
  ],
  6: [
    { id: 'Barrel_01', pos: [0.80, 0, -13.0], rot: 0.6, r: 0.30, grime: 0.9 },
    { id: 'wooden_crate_02', pos: [-0.78, 0, -17.2], rot: 0.2, r: 0.32, grime: 0.8 },
  ],
  7: [
    { id: 'plastic_monobloc_chair_01', pos: [-0.70, 0, -7.6], rot: 0.4, r: 0.32, grime: 0.9 },
  ],
};
