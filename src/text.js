import { Text, preloadFont } from 'troika-three-text';
import monoUrl from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff?url';
import sansUrl from '@fontsource/inter/files/inter-latin-600-normal.woff?url';

export const FONT = { mono: monoUrl, sans: sansUrl };

const MINUS = '\u2212';

// Formats for the 3D scene (typographic minus, no "-0.00").
export function fmt3(v, d = 2) {
  let s = v.toFixed(d);
  if (/^-0\.0*$/.test(s)) s = s.slice(1);
  return s.replace('-', MINUS);
}

// Formats for KaTeX / HTML.
export function fmt(v, d = 2) {
  let s = v.toFixed(d);
  if (/^-0\.0*$/.test(s)) s = s.slice(1);
  return s;
}

export function makeText({ text = '', font = FONT.mono, size = 0.3, color = '#f8fafc', anchorX = 'center', anchorY = 'middle' } = {}) {
  const t = new Text();
  t.text = text;
  t.font = font;
  t.fontSize = size;
  t.color = color;
  t.anchorX = anchorX;
  t.anchorY = anchorY;
  t.sync();
  return t;
}

export function preloadFonts() {
  const chars = '0123456789.,+-=×÷?()' + MINUS + 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ ';
  return Promise.all(
    [FONT.mono, FONT.sans].map((font) => new Promise((resolve) => preloadFont({ font, characters: chars }, resolve))),
  );
}
