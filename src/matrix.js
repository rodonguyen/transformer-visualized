import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import katex from 'katex';
import { makeText, fmt3, FONT } from './text.js';
import { valueRGB, toColor, textColorFor, PLACEHOLDER, PALETTE } from './colors.js';
import { maxAbs } from './model.js';

export const CELL = { w: 1.25, h: 0.8, d: 0.16, gap: 0.1 };
export const PX = CELL.w + CELL.gap;
export const PY = CELL.h + CELL.gap;
export const matW = (c) => c * PX - CELL.gap;
export const matH = (r) => r * PY - CELL.gap;
export const cellX = (j) => j * PX + CELL.w / 2;
export const cellY = (i) => -(i * PY + CELL.h / 2);
// World units of bar height per unit of attention weight.
export const BAR = 2.4;

let cellGeo = null;
const cellGeometry = () => (cellGeo ??= new RoundedBoxGeometry(CELL.w, CELL.h, CELL.d, 3, 0.07));

// A coloured, numbered box. Base for matrix cells and free-flying chips.
export class Tile {
  constructor(fontSize = 0.3) {
    this.group = new THREE.Group();
    this.material = new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.5, metalness: 0.0 });
    this.mesh = new THREE.Mesh(cellGeometry(), this.material);
    this.text = makeText({ size: fontSize });
    this.text.position.z = CELL.d / 2 + 0.012;
    this.group.add(this.mesh, this.text);
    this.kind = 'div';
    this.scale = 1;
    this.decimals = 2;
    this.revealed = true;
    this._v = 0;
    this._bar = 0;
    this._pop = 1;
  }

  get v() { return this._v; }
  set v(x) { this._v = x; this.paint(); }

  paint() {
    if (this.revealed) {
      const rgb = valueRGB(this.kind, this._v, this.scale);
      toColor(rgb, this.material.color);
      this.material.emissive.copy(this.material.color).multiplyScalar(0.35);
      this.text.text = fmt3(this._v, this.decimals);
      this.text.color = textColorFor(rgb);
    } else {
      toColor(PLACEHOLDER, this.material.color);
      this.material.emissive.setRGB(0, 0, 0);
      this.text.text = '?';
      this.text.color = '#5b6781';
    }
  }

  get bar() { return this._bar; }
  set bar(h) {
    this._bar = h;
    this.mesh.scale.z = (CELL.d + h) / CELL.d;
    this.mesh.position.z = h / 2;
    this.text.position.z = CELL.d / 2 + h + 0.012;
  }

  get pop() { return this._pop; }
  set pop(s) { this._pop = s; this.group.scale.setScalar(Math.max(s, 1e-4)); }

  setAlpha(a) {
    this.material.opacity = a;
    this.text.fillOpacity = a;
    this.group.visible = a > 0.003;
  }
}

class Cell extends Tile {
  constructor(m, i, j) {
    super(m.fontSize);
    this.m = m;
    this.i = i;
    this.j = j;
    this._emph = 1;
    this.mesh.userData.cell = this;
  }

  get emph() { return this._emph; }
  set emph(e) { this._emph = e; this.refreshAlpha(); }

  refreshAlpha() { this.setAlpha(this.m.alpha * this._emph * (this.revealed ? 1 : 0.55)); }

  reveal(on = true) {
    this.revealed = on;
    this.paint();
    this.refreshAlpha();
  }

  home() { this.group.position.set(cellX(this.j), cellY(this.i), 0); }
}

const frameGeos = new Map();
function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function frameGeometry(w, h) {
  const key = `${w.toFixed(3)}x${h.toFixed(3)}`;
  if (!frameGeos.has(key)) {
    const t = 0.075, pad = 0.04;
    const outer = roundedRect(w + 2 * (pad + t), h + 2 * (pad + t), 0.12 + t);
    const inner = roundedRect(w + 2 * pad, h + 2 * pad, 0.12);
    outer.holes.push(new THREE.Path(inner.getPoints(4)));
    frameGeos.set(key, new THREE.ShapeGeometry(outer, 4));
  }
  return frameGeos.get(key);
}

// Glowing outline around a row / column / cell of a matrix.
class Frame {
  constructor(m, color) {
    this.m = m;
    this._o = 0;
    this.material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false });
    this.mesh = new THREE.Mesh(frameGeometry(CELL.w, CELL.h), this.material);
    this.mesh.position.z = CELL.d / 2 + 0.03;
    this.mesh.renderOrder = 10;
    this.mesh.visible = false;
    m.group.add(this.mesh);
  }

  fit(i0, j0, i1, j1) {
    const w = (j1 - j0 + 1) * PX - CELL.gap;
    const h = (i1 - i0 + 1) * PY - CELL.gap;
    this.mesh.geometry = frameGeometry(w, h);
    this.mesh.position.x = j0 * PX + w / 2;
    this.mesh.position.y = -(i0 * PY + h / 2);
    return this;
  }
  row(i) { return this.fit(i, 0, i, this.m.cols - 1); }
  col(j) { return this.fit(0, j, this.m.rows - 1, j); }
  cell(i, j) { return this.fit(i, j, i, j); }

  get opacity() { return this._o; }
  set opacity(o) { this._o = o; this.refresh(); }
  refresh() {
    const a = this._o * this.m.alpha;
    this.material.opacity = a;
    this.mesh.visible = a > 0.003;
  }
}

export class MatrixViz {
  constructor(stage, o) {
    this.id = o.id;
    this.values = o.values;
    this.rows = o.values.length;
    this.cols = o.values[0].length;
    this.kind = o.kind ?? 'div';
    this.decimals = o.decimals ?? 2;
    this.scale = o.scale ?? (maxAbs(o.values) || 1);
    this.fontSize = o.fontSize ?? 0.3;
    this.home = new THREE.Vector3(...(o.pos ?? [0, 0, 0]));
    this.tex0 = o.tex;
    this.labelSide = o.labelSide ?? 'bottom';
    this.initRevealed = !!o.revealed;
    this.explain = null;
    this.state = {};

    this.group = new THREE.Group();
    this.group.name = o.id;
    stage.scene.add(this.group);

    this.cells = o.values.map((row, i) =>
      row.map((_, j) => {
        const c = new Cell(this, i, j);
        this.group.add(c.group);
        return c;
      }),
    );
    this.flat = this.cells.flat();

    this.rowTexts = (o.rowLabels ?? []).map((s, i) => {
      const t = makeText({ text: s, font: FONT.sans, size: 0.3, color: o.rowColors?.[i] ?? '#cbd5e1', anchorX: 'right' });
      t.position.set(-0.2, cellY(i), 0.05);
      this.group.add(t);
      return t;
    });
    this.colTexts = (o.colLabels ?? []).map((s, j) => {
      const t = makeText({ text: s, font: FONT.sans, size: 0.28, color: o.colColors?.[j] ?? '#cbd5e1', anchorY: 'bottom' });
      t.position.set(cellX(j), 0.12, 0.05);
      this.group.add(t);
      return t;
    });

    this.el = document.createElement('div');
    this.el.className = `mlabel ${o.labelClass ?? ''}`;
    this.label = new CSS2DObject(this.el);
    this.group.add(this.label);
    this.placeLabel();

    this.frames = {};
    this._opacity = 0;
    this._fade = 1;
    this._labels = 1;
    this.reset();
  }

  get width() { return matW(this.cols); }
  get height() { return matH(this.rows); }

  setLabel(tex) {
    const name = katex.renderToString(tex, { throwOnError: false });
    this.el.innerHTML = `<span class="mname">${name}</span><span class="mshape">${this.rows}×${this.cols}</span>`;
  }

  placeLabel() {
    const w = this.width, h = this.height;
    const top = this.colTexts.length ? 0.55 : 0.2;
    const left = this.rowTexts.length ? 1.25 : 0.25;
    const spots = {
      top: [[w / 2, top, 0], [0.5, 1]],
      bottom: [[w / 2, -h - 0.22, 0], [0.5, 0]],
      right: [[w + 0.3, -h / 2, 0], [0, 0.5]],
      left: [[-left, -h / 2, 0], [1, 0.5]],
    };
    const [p, c] = spots[this.labelSide];
    this.label.position.set(...p);
    this.label.center.set(...c);
  }

  get alpha() { return this._opacity * this._fade; }

  get opacity() { return this._opacity; }
  set opacity(o) { this._opacity = o; this.applyAlpha(); }

  // Extra multiplier used to push whole layers into the background.
  get fade() { return this._fade; }
  set fade(f) { this._fade = f; this.applyAlpha(); }

  applyAlpha() {
    const a = this.alpha;
    this.group.visible = a > 0.003;
    for (const c of this.flat) c.refreshAlpha();
    this.el.style.opacity = a;
    this.applyLabelAlpha();
    for (const f of Object.values(this.frames)) f.refresh();
  }

  get labels() { return this._labels; }
  set labels(v) { this._labels = v; this.applyLabelAlpha(); }
  applyLabelAlpha() {
    const a = this.alpha * this._labels;
    for (const t of this.rowTexts) { t.fillOpacity = a; t.visible = a > 0.003; }
    for (const t of this.colTexts) { t.fillOpacity = a; t.visible = a > 0.003; }
  }

  frame(key) {
    return (this.frames[key] ??= new Frame(this, PALETTE[key] ?? '#ffffff'));
  }

  revealAll(on = true) {
    for (const c of this.flat) c.reveal(on);
  }

  // Front face of a cell in world space (chips start/land here).
  cellWorld(i, j) {
    const c = this.cells[i][j];
    return c.group.position.clone().add(this.group.position).setZ(this.group.position.z + c._bar + 0.06);
  }

  boxAt(pos = this.home) {
    const w = this.width, h = this.height;
    const left = this.rowTexts.length ? 1.3 : 0;
    const top = this.colTexts.length ? 0.5 : 0;
    const lab = 0.75;
    const s = this.labelSide;
    return new THREE.Box3(
      new THREE.Vector3(pos.x - left - (s === 'left' ? 1.6 : 0), pos.y - h - (s === 'bottom' ? lab : 0), pos.z),
      new THREE.Vector3(pos.x + w + (s === 'right' ? 2.2 : 0), pos.y + top + (s === 'top' ? lab : 0), pos.z + CELL.d),
    );
  }

  reset() {
    this.group.position.copy(this.home);
    this.state = {};
    this.setLabel(this.tex0);
    for (const c of this.flat) {
      c.home();
      c.kind = this.kind;
      c.scale = this.scale;
      c.decimals = this.decimals;
      c._v = this.values[c.i][c.j];
      c.revealed = this.initRevealed;
      c._emph = 1;
      c.bar = 0;
      c.pop = 1;
      c.paint();
    }
    for (const f of Object.values(this.frames)) f._o = 0;
    this._labels = 1;
    this._fade = 1;
    this.opacity = 0;
  }
}

// Free-floating numbered tile used to show intermediate arithmetic.
export class Chip extends Tile {
  constructor(scene) {
    super(0.3);
    this._o = 0;
    this.setAlpha(0);
    scene.add(this.group);
  }

  setup({ v, kind = 'div', scale = 1, decimals = 2, pos, opacity = 1 }) {
    this.kind = kind;
    this.scale = scale;
    this.decimals = decimals;
    this.revealed = true;
    this.bar = 0;
    this.pop = 1;
    this.group.position.copy(pos);
    this.v = v;
    this.opacity = opacity;
  }

  get opacity() { return this._o; }
  set opacity(o) { this._o = o; this.setAlpha(o); }
}

// Operator / caption text floating in the scene ("×", "+", "=", ...).
export class Glyph {
  constructor(scene) {
    this.text = makeText({ size: 0.4, color: '#cbd5e1' });
    this._o = 0;
    this.opacity = 0;
    scene.add(this.text);
  }

  setup({ s, pos, size = 0.4, color = '#cbd5e1', font = FONT.mono, anchorX = 'center', opacity = 0 }) {
    Object.assign(this.text, { text: s, fontSize: size, color, font, anchorX });
    this.text.position.copy(pos);
    this.opacity = opacity;
  }

  get opacity() { return this._o; }
  set opacity(o) {
    this._o = o;
    this.text.fillOpacity = o;
    this.text.visible = o > 0.003;
  }
}

export class Pool {
  constructor(make) {
    this.make = make;
    this.items = [];
    this.used = 0;
  }
  acquire() {
    if (this.used === this.items.length) this.items.push(this.make());
    return this.items[this.used++];
  }
  releaseAll() {
    for (const it of this.items) it.opacity = 0;
    this.used = 0;
  }
}

let tokenGeo = null;
export class TokenTile {
  constructor(scene, word, color) {
    tokenGeo ??= new RoundedBoxGeometry(2.0, 0.95, 0.3, 4, 0.14);
    this.group = new THREE.Group();
    this.material = new THREE.MeshStandardMaterial({ color: '#1c2436', roughness: 0.4, transparent: true });
    this.mesh = new THREE.Mesh(tokenGeo, this.material);
    this.text = makeText({ text: word, font: FONT.sans, size: 0.46, color });
    this.text.position.z = 0.17;
    this.group.add(this.mesh, this.text);
    scene.add(this.group);
    this._o = 0;
    this._pop = 1;
    this.reset();
  }

  get opacity() { return this._o; }
  set opacity(o) {
    this._o = o;
    this.material.opacity = o * 0.95;
    this.text.fillOpacity = o;
    this.group.visible = o > 0.003;
  }

  get pop() { return this._pop; }
  set pop(s) { this._pop = s; this.group.scale.setScalar(Math.max(s, 1e-4)); }

  reset() {
    this.opacity = 0;
    this.pop = 1;
  }
}
