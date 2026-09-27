import { Color, SRGBColorSpace } from 'three';

const hex = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16) / 255);
const lerp3 = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const PALETTE = {
  neg: '#3d7bff',
  mid: '#283042',
  pos: '#ff8a3d',
  seq: ['#221a3d', '#3b3f8f', '#1f7f8c', '#34b87d', '#f5e14a'],
  placeholder: '#1b2130',
  row: '#ffd166',
  col: '#7ee8fa',
  result: '#ffffff',
  hover: '#ffffff',
  src: '#c7d2fe',
};

const NEG = hex(PALETTE.neg), MID = hex(PALETTE.mid), POS = hex(PALETTE.pos);
const SEQ = PALETTE.seq.map(hex);
export const PLACEHOLDER = hex(PALETTE.placeholder);

// Colours are interpolated in sRGB so the CSS legend matches the 3D scene.
export function valueRGB(kind, v, scale) {
  if (kind === 'seq') {
    const s = clamp(v / scale, 0, 1) * (SEQ.length - 1);
    const i = Math.min(Math.floor(s), SEQ.length - 2);
    return lerp3(SEQ[i], SEQ[i + 1], s - i);
  }
  const t = clamp(v / scale, -1, 1);
  return lerp3(MID, t < 0 ? NEG : POS, Math.pow(Math.abs(t), 0.8));
}

export const toColor = (rgb, out = new Color()) => out.setRGB(rgb[0], rgb[1], rgb[2], SRGBColorSpace);

export function textColorFor(rgb) {
  const lum = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  return lum > 0.56 ? '#0b1020' : '#f8fafc';
}

export const cssColor = (kind, v, scale) => {
  const [r, g, b] = valueRGB(kind, v, scale).map((c) => Math.round(c * 255));
  return `rgb(${r},${g},${b})`;
};

export const LEGEND = {
  diverging: `linear-gradient(90deg, ${PALETTE.neg}, ${PALETTE.mid}, ${PALETTE.pos})`,
  sequential: `linear-gradient(90deg, ${PALETTE.seq.join(', ')})`,
};
