import { Box3, Vector3 } from 'three';
import { matW, matH, cellX, PX } from './matrix.js';

const GAP = 1.0; // between matrices of a product (row / column alignment)
const VGAP = 1.3; // vertical gap, leaves room for labels

// Top-left corner of every matrix. Layout follows the classic "A left, B above, C = AB below-right".
export const P = {
  X: [-9.0, 0, 0],
  Q: [0, 0, 0],
  K: [5.2, 0, 0],
  V: [10.4, 0, 0],
  WQ: [0, VGAP + matH(6), 0],
  WK: [5.2, VGAP + matH(6), 0],
  WV: [10.4, VGAP + matH(6), 0],
  S: [24, 0, 0],
};
P.Qc = [P.S[0] - GAP - matW(3), 0, 0];
P.KT = [P.S[0], VGAP + matH(3), 0];
P.A = [P.S[0] + matW(4) + 2.1, 0, 0];
P.Z = [P.A[0] + matW(4) + GAP, 0, 0];
P.Vc = [P.Z[0], VGAP + matH(4), 0];

// Head 2 lives on a parallel sheet below and behind head 1.
export const H2 = [0, -15, -7];

const FIN_Y = -7.5, FIN_Z = -3.5;
P.CONCAT = [46.5, FIN_Y, FIN_Z];
P.OUT = [P.CONCAT[0] + matW(6) + GAP, FIN_Y, FIN_Z];
P.WO = [P.OUT[0], FIN_Y + VGAP + matH(6), FIN_Z];
P.Z1c = P.CONCAT;
P.Z2c = [P.CONCAT[0] + 3 * PX, FIN_Y, FIN_Z];
P.A1cmp = [16.5, -5.2, 6];
P.A2cmp = [P.A1cmp[0] + matW(4) + 2.4, -5.2, 6];

export const offset = (p, o) => [p[0] + o[0], p[1] + o[1], p[2] + o[2]];

export const tokenSentence = (k) => new Vector3(-5 + (k - 1.5) * 2.3, 1.9, 0);
export const tokenRow = (k) => new Vector3(P.X[0] - 0.85, -(k * 0.9 + 0.4), 0.1);

// Scratch areas where intermediate arithmetic is laid out.
export const WS = {
  q: { x0: P.X[0] + cellX(0), y0: -5.9, dy: 0.47, dx: 1.6, z: 0.8 },
  s: { x0: P.Qc[0] + cellX(0), y0: -5.9, dy: 0.47, dx: 1.6, z: 0.8 },
  soft: { x0: P.S[0] + cellX(0), y0: -5.9, dx: 1.8, z: 0.8 },
  ws: {
    xw: P.A[0] + cellX(3),
    xTimes: (P.A[0] + cellX(3) + P.Z[0] + cellX(0)) / 2,
    xs: [0, 1, 2].map((k) => P.Z[0] + cellX(k)),
    ys: [0, 1, 2, 3].map((j) => -5.3 - j * 0.95),
    ySum: -5.3 - 4 * 0.95 - 0.4,
    z: 0.8,
  },
};

export const box = (x0, y0, x1, y1, z0 = 0, z1 = 0.2) => new Box3(new Vector3(x0, y0, z0), new Vector3(x1, y1, z1));

export const DIR = {
  front: new Vector3(0.1, 0.14, 1),
  tilt: new Vector3(0.28, 0.55, 1),
  wide: new Vector3(0.22, 0.3, 1),
  deep: new Vector3(0.55, 0.45, 1),
};
