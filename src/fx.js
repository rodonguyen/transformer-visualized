import { Vector3 } from 'three';
import { cellX, cellY, BAR } from './matrix.js';

const V3 = (x, y, z) => new Vector3(x, y, z);
const resolve = (p) => (typeof p === 'function' ? p() : p.clone());

export function show(tl, items, at = 0, dur = 0.6) {
  tl.to(items, { opacity: 1, duration: dur, ease: 'power1.out' }, at);
}

export function hide(tl, items, at = 0, dur = 0.5) {
  tl.to(items, { opacity: 0, duration: dur, ease: 'power1.in' }, at);
}

// Move an Object3D along a gentle arc toward the camera. `to` may be a function evaluated at start.
export function fly(tl, obj, to, { at = 0, dur = 1, arc = 1.2, ease = 'power2.inOut' } = {}) {
  const s = { t: 0 };
  const from = new Vector3();
  let dest = null;
  tl.to(s, {
    t: 1,
    duration: dur,
    ease,
    // GSAP skips onStart when the playhead lands exactly on the start time, so initialise lazily here.
    onUpdate: () => {
      if (!dest) { from.copy(obj.position); dest = resolve(to); }
      obj.position.lerpVectors(from, dest, s.t);
      obj.position.z += Math.sin(Math.PI * s.t) * arc;
    },
  }, at);
}

// Cells pop into existence with their values.
export function appear(tl, m, { at = 0, stagger = 0.025, dur = 0.45 } = {}) {
  tl.call(() => {
    for (const c of m.flat) { c.pop = 1e-4; c.reveal(true); }
    m.opacity = 1;
  }, null, at);
  m.flat.forEach((c, k) => tl.to(c, { pop: 1, duration: dur, ease: 'back.out(1.8)' }, at + k * stagger));
  return at + m.flat.length * stagger + dur;
}

export function reveal(tl, c, at = 0) {
  tl.call(() => c.reveal(true), null, at);
  tl.fromTo(c, { pop: 0.55 }, { pop: 1, duration: 0.4, ease: 'back.out(2.4)', immediateRender: false }, at);
}

export function dim(tl, m, keep, at = 0, level = 0.25, dur = 0.4) {
  for (const c of m.flat) tl.to(c, { emph: keep(c.i, c.j) ? 1 : level, duration: dur }, at);
}

export function undim(tl, m, at = 0, dur = 0.4) {
  tl.to(m.flat, { emph: 1, duration: dur }, at);
}

export function bars(tl, m, on, { at = 0, dur = 0.8, stagger = 0.025 } = {}) {
  m.flat.forEach((c, k) => tl.to(c, { bar: on ? m.values[c.i][c.j] * BAR : 0, duration: dur, ease: 'power2.out' }, at + k * stagger));
  return at + m.flat.length * stagger + dur;
}

// Reveal cells of C = A·B one by one while a row frame sweeps A and a column frame sweeps B.
export function fill(tl, C, { A = null, B = null, cells = null, at = 0, stagger = 0.1 } = {}) {
  const list = cells ?? C.flat.filter((c) => !c.revealed);
  if (!list.length) return at;
  const fa = A?.frame('row'), fb = B?.frame('col');
  tl.call(() => { fa?.row(list[0].i); fb?.col(list[0].j); }, null, at);
  const frames = [fa, fb].filter(Boolean);
  if (frames.length) tl.to(frames, { opacity: 1, duration: 0.2 }, at);
  list.forEach((c, k) => {
    const t = at + k * stagger;
    if (k && fa) tl.to(fa.mesh.position, { y: cellY(c.i), duration: stagger * 0.7, ease: 'power1.inOut' }, t);
    if (k && fb) tl.to(fb.mesh.position, { x: cellX(c.j), duration: stagger * 0.7, ease: 'power1.inOut' }, t);
    reveal(tl, c, t + stagger * 0.6);
  });
  const end = at + list.length * stagger + 0.35;
  if (frames.length) tl.to(frames, { opacity: 0, duration: 0.3 }, end);
  return end + 0.3;
}

// A copy of `src` appears on top of it and flies to its own home position.
export function flyCopy(tl, copy, src, { at = 0, dur = 1.3, arc = 2 } = {}) {
  tl.call(() => {
    copy.group.position.copy(src.group.position);
    copy.revealAll(true);
    copy.opacity = 1;
  }, null, at);
  fly(tl, copy.group, copy.home, { at, dur, arc });
  return at + dur;
}

// K flies over and its cells swap across the diagonal to become Kᵀ.
export function flyTranspose(tl, KT, K, { at = 0, dur = 1.8 } = {}) {
  tl.call(() => {
    KT.group.position.copy(K.group.position);
    KT.revealAll(true);
    KT.labels = 0;
    KT.opacity = 1;
    for (const c of KT.flat) c.group.position.set(cellX(c.i), cellY(c.j), 0);
  }, null, at);
  fly(tl, KT.group, KT.home, { at, dur, arc: 2 });
  for (const c of KT.flat) {
    const s = { t: 0 };
    const from = V3(cellX(c.i), cellY(c.j), 0), to = V3(cellX(c.j), cellY(c.i), 0);
    tl.to(s, {
      t: 1,
      duration: dur * 0.55,
      ease: 'power2.inOut',
      onUpdate: () => {
        c.group.position.lerpVectors(from, to, s.t);
        c.group.position.z = Math.sin(Math.PI * s.t) * 0.9;
      },
    }, at + dur * 0.35 + (c.i + c.j) * 0.03);
  }
  tl.to(KT, { labels: 1, duration: 0.4 }, at + dur);
  return at + dur + 0.2;
}

export function scaleScores(tl, S, target, tex, { at = 0, dur = 1.2 } = {}) {
  tl.call(() => { S.state.scaled = true; S.setLabel(tex); }, null, at);
  S.flat.forEach((c, k) => tl.to(c, { v: target[c.i][c.j], duration: dur, ease: 'power2.inOut' }, at + k * 0.03));
  return at + dur + S.flat.length * 0.03;
}

/* ---------- Dot product, shown term by term (three phases) ---------- */

export function dpPick(tl, ctx, { A, i, B, j, C, ci = i, cj = j, ws, at = 0, speed = 1 }) {
  const T = (s) => s / speed;
  const k = A.cols;
  // Products of a d1- and d2-decimal number have d1 + d2 decimals; show up to 3 so sums check out.
  const dec = Math.min(3, A.decimals + B.decimals);
  const dp = (ctx.detail.dp = { A, i, B, j, C, ci, cj, ws, k, a: [], b: [], x: [], plus: [], speed, dec });
  const fa = A.frame('row'), fb = B.frame('col'), fc = C.frame('result');
  tl.call(() => { fa.row(i); fb.col(j); fc.cell(ci, cj); }, null, at);
  tl.to([fa, fb, fc], { opacity: 1, duration: T(0.4) }, at);
  dim(tl, A, (r) => r === i, at);
  dim(tl, B, (r, c) => c === j, at);
  for (let l = 0; l < k; l++) {
    const a = ctx.chips.acquire(), b = ctx.chips.acquire(), x = ctx.glyphs.acquire();
    dp.a.push(a); dp.b.push(b); dp.x.push(x);
    const px = ws.x0 + l * ws.dx;
    const t = at + T(0.4 + l * 0.12);
    tl.call(() => a.setup({ v: A.cells[i][l].v, kind: A.kind, scale: A.scale, decimals: A.decimals, pos: A.cellWorld(i, l) }), null, t);
    fly(tl, a.group, V3(px, ws.y0 + ws.dy, ws.z), { at: t, dur: T(0.9), arc: 1.5 });
    tl.call(() => b.setup({ v: B.cells[l][j].v, kind: B.kind, scale: B.scale, decimals: B.decimals, pos: B.cellWorld(l, j) }), null, t + T(0.08));
    fly(tl, b.group, V3(px, ws.y0 - ws.dy, ws.z), { at: t + T(0.08), dur: T(0.9), arc: 1.5 });
    tl.call(() => x.setup({ s: '×', pos: V3(px, ws.y0, ws.z + 0.1), size: 0.3 }), null, t + T(0.9));
    tl.to(x, { opacity: 1, duration: T(0.3) }, t + T(0.95));
  }
  return at + T(0.4 + k * 0.12 + 1.2);
}

export function dpMult(tl, ctx, { at = 0 } = {}) {
  const dp = ctx.detail.dp;
  const T = (s) => s / dp.speed;
  const { A, i, B, j, ws, k } = dp;
  const prods = Array.from({ length: k }, (_, l) => A.values[i][l] * B.values[l][j]);
  const scale = Math.max(...prods.map(Math.abs)) || 1;
  dp.prods = prods;
  for (let l = 0; l < k; l++) {
    const t = at + T(l * 0.16);
    const px = ws.x0 + l * ws.dx;
    tl.to(dp.x[l], { opacity: 0, duration: T(0.2) }, t);
    tl.to(dp.a[l].group.position, { y: ws.y0, duration: T(0.45), ease: 'power2.in' }, t);
    tl.to(dp.b[l].group.position, { y: ws.y0, z: ws.z - 0.05, duration: T(0.45), ease: 'power2.in' }, t);
    tl.to(dp.b[l], { opacity: 0, duration: T(0.12) }, t + T(0.4));
    tl.call(() => {
      const c = dp.a[l];
      c.kind = 'div';
      c.scale = scale;
      c.decimals = dp.dec;
      c.v = prods[l];
    }, null, t + T(0.45));
    tl.fromTo(dp.a[l], { pop: 1.3 }, { pop: 1, duration: T(0.35), ease: 'back.out(3)', immediateRender: false }, t + T(0.45));
    if (l > 0) {
      const g = ctx.glyphs.acquire();
      dp.plus.push(g);
      tl.call(() => g.setup({ s: '+', pos: V3(px - ws.dx / 2, ws.y0, ws.z + 0.1) }), null, t + T(0.45));
      tl.to(g, { opacity: 1, duration: T(0.3) }, t + T(0.5));
    }
  }
  return at + T(k * 0.16 + 0.9);
}

export function dpSum(tl, ctx, { at = 0 } = {}) {
  const dp = ctx.detail.dp;
  const T = (s) => s / dp.speed;
  const { A, B, C, ci, cj, ws, k, prods } = dp;
  const sx = ws.x0 + k * ws.dx + 0.35;
  const eq = ctx.glyphs.acquire(), sum = ctx.chips.acquire();
  const final = C.values[ci][cj];
  tl.call(() => {
    eq.setup({ s: '=', pos: V3(sx - ws.dx * 0.62, ws.y0, ws.z + 0.1) });
    sum.setup({ v: 0, kind: C.kind, scale: C.scale, decimals: dp.dec, pos: V3(sx, ws.y0, ws.z), opacity: 0 });
  }, null, at);
  tl.to([eq, sum], { opacity: 1, duration: T(0.3) }, at);
  let run = 0;
  for (let l = 0; l < k; l++) {
    run += prods[l];
    const val = l === k - 1 ? final : run;
    const t = at + T(0.35 + l * 0.38);
    fly(tl, dp.a[l].group, V3(sx, ws.y0, ws.z), { at: t, dur: T(0.42), arc: 0.5, ease: 'power2.in' });
    tl.to(dp.a[l], { opacity: 0, duration: T(0.08) }, t + T(0.36));
    if (l > 0) tl.to(dp.plus[l - 1], { opacity: 0, duration: T(0.2) }, t);
    tl.call(() => { if (l === k - 1) sum.decimals = C.decimals; sum.v = val; }, null, t + T(0.42));
    tl.fromTo(sum, { pop: 1.22 }, { pop: 1, duration: T(0.25), immediateRender: false }, t + T(0.42));
  }
  const t2 = at + T(0.35 + k * 0.38 + 0.45);
  tl.to(eq, { opacity: 0, duration: T(0.3) }, t2);
  fly(tl, sum.group, () => C.cellWorld(ci, cj), { at: t2, dur: T(0.85), arc: 1.6 });
  tl.to(sum, { opacity: 0, duration: T(0.12) }, t2 + T(0.8));
  reveal(tl, C.cells[ci][cj], t2 + T(0.82));
  const end = t2 + T(1.2);
  tl.to([A.frame('row'), B.frame('col'), C.frame('result')], { opacity: 0, duration: T(0.4) }, end);
  undim(tl, A, end);
  undim(tl, B, end);
  return end + T(0.4);
}

/* ---------- Softmax of one row (two phases) ---------- */

export function smExp(tl, ctx, { S, row, parts, ws, at = 0 }) {
  const n = S.cols;
  const sm = (ctx.detail.sm = { S, row, parts, ws, chips: [], plus: [] });
  const fr = S.frame('row');
  tl.call(() => fr.row(row), null, at);
  tl.to(fr, { opacity: 1, duration: 0.4 }, at);
  dim(tl, S, (r) => r === row, at);
  for (let j = 0; j < n; j++) {
    const c = ctx.chips.acquire();
    sm.chips.push(c);
    const t = at + 0.35 + j * 0.1;
    tl.call(() => c.setup({ v: S.cells[row][j].v, kind: 'div', scale: S.scale, pos: S.cellWorld(row, j) }), null, t);
    fly(tl, c.group, V3(ws.x0 + j * ws.dx, ws.y0, ws.z), { at: t, dur: 0.9, arc: 1.4 });
  }
  const lab = ctx.glyphs.acquire();
  sm.lab = lab;
  const tE = at + 0.35 + n * 0.1 + 1.0;
  tl.call(() => lab.setup({ s: 'exp', pos: V3(ws.x0 - 1.15, ws.y0, ws.z), size: 0.34, color: '#94a3b8' }), null, tE - 0.3);
  tl.to(lab, { opacity: 1, duration: 0.3 }, tE - 0.3);
  const eScale = Math.max(...parts.e);
  sm.chips.forEach((c, j) => {
    tl.call(() => { c.scale = eScale; c.v = c.v; }, null, tE + j * 0.1);
    tl.to(c, { v: parts.e[j], bar: parts.e[j] * 0.45, duration: 1.0, ease: 'power2.inOut' }, tE + j * 0.1);
  });
  return tE + n * 0.1 + 1.0;
}

export function smNorm(tl, ctx, { A, at = 0 }) {
  const sm = ctx.detail.sm;
  const { S, row, parts, ws, chips } = sm;
  const n = chips.length;
  const sx = ws.x0 + n * ws.dx + 0.1;
  const eq = ctx.glyphs.acquire(), sum = ctx.chips.acquire();
  for (let j = 1; j < n; j++) {
    const g = ctx.glyphs.acquire();
    sm.plus.push(g);
    tl.call(() => g.setup({ s: '+', pos: V3(ws.x0 + (j - 0.5) * ws.dx, ws.y0, ws.z + 0.1) }), null, at);
  }
  tl.call(() => {
    eq.setup({ s: '=', pos: V3(sx - ws.dx * 0.55, ws.y0, ws.z + 0.1) });
    sum.setup({ v: 0, kind: 'div', scale: parts.sum, pos: V3(sx, ws.y0, ws.z), opacity: 0 });
  }, null, at);
  tl.to([...sm.plus, eq, sum], { opacity: 1, duration: 0.4 }, at);
  tl.to(sum, { v: parts.sum, duration: 0.9, ease: 'power1.out' }, at + 0.2);
  tl.to(sm.lab, { opacity: 0, duration: 0.3 }, at);

  const tN = at + 1.5;
  tl.to([...sm.plus, eq], { opacity: 0, duration: 0.3 }, tN);
  chips.forEach((c, j) => {
    tl.call(() => { c.kind = 'seq'; c.scale = A.scale; c.v = c.v; }, null, tN + j * 0.08);
    tl.to(c, { v: parts.w[j], bar: parts.w[j] * BAR, duration: 1.0, ease: 'power2.inOut' }, tN + j * 0.08);
  });
  tl.fromTo(sum, { pop: 1.15 }, { pop: 1, duration: 0.5, immediateRender: false }, tN);

  const tF = tN + 1.6;
  tl.to(sum, { opacity: 0, duration: 0.4 }, tF);
  chips.forEach((c, j) => {
    const t = tF + j * 0.12;
    fly(tl, c.group, () => A.cellWorld(row, j), { at: t, dur: 0.85, arc: 1.3 });
    tl.to(c, { bar: 0, duration: 0.6 }, t);
    tl.to(c, { opacity: 0, duration: 0.12 }, t + 0.8);
    reveal(tl, A.cells[row][j], t + 0.82);
  });
  const end = tF + n * 0.12 + 1.0;
  tl.to(S.frame('row'), { opacity: 0, duration: 0.4 }, end);
  undim(tl, S, end);
  return end + 0.4;
}

/* ---------- Weighted sum of value vectors for one token (two phases) ---------- */

export function wsScale(tl, ctx, { A, Vm, row, ws, at = 0 }) {
  const n = Vm.rows, d = Vm.cols;
  const w = (ctx.detail.ws = { A, Vm, row, ws, wc: [], vc: [], x: [] });
  const fa = A.frame('row');
  tl.call(() => fa.row(row), null, at);
  tl.to(fa, { opacity: 1, duration: 0.4 }, at);
  dim(tl, A, (r) => r === row, at);
  for (let j = 0; j < n; j++) {
    const t = at + 0.35 + j * 0.3;
    const wc = ctx.chips.acquire();
    w.wc.push(wc);
    tl.call(() => wc.setup({ v: A.cells[row][j].v, kind: 'seq', scale: A.scale, pos: A.cellWorld(row, j) }), null, t);
    fly(tl, wc.group, V3(ws.xw, ws.ys[j], ws.z), { at: t, dur: 0.95, arc: 1.4 });
    const rowChips = [];
    for (let kk = 0; kk < d; kk++) {
      const vc = ctx.chips.acquire();
      rowChips.push(vc);
      tl.call(() => vc.setup({ v: Vm.cells[j][kk].v, kind: 'div', scale: Vm.scale, pos: Vm.cellWorld(j, kk) }), null, t + 0.05 * kk);
      fly(tl, vc.group, V3(ws.xs[kk], ws.ys[j], ws.z), { at: t + 0.05 * kk, dur: 1.0, arc: 1.4 });
    }
    w.vc.push(rowChips);
    const x = ctx.glyphs.acquire();
    w.x.push(x);
    tl.call(() => x.setup({ s: '×', pos: V3(ws.xTimes, ws.ys[j], ws.z + 0.1), size: 0.34 }), null, t + 0.9);
    tl.to(x, { opacity: 1, duration: 0.3 }, t + 0.9);
  }
  const tM = at + 0.35 + n * 0.3 + 1.2;
  for (let j = 0; j < n; j++) {
    const t = tM + j * 0.15;
    tl.call(() => { for (const c of w.vc[j]) c.decimals = 3; }, null, t);
    for (let kk = 0; kk < d; kk++) {
      tl.to(w.vc[j][kk], { v: A.values[row][j] * Vm.values[j][kk], duration: 0.9, ease: 'power2.inOut' }, t);
    }
  }
  return tM + n * 0.15 + 0.9;
}

export function wsSum(tl, ctx, { Z, at = 0 }) {
  const w = ctx.detail.ws;
  const { A, Vm, row, ws } = w;
  const n = Vm.rows, d = Vm.cols;
  const res = [];
  const line = ctx.glyphs.acquire();
  tl.call(() => line.setup({ s: '————————', pos: V3(ws.xs[1], ws.ySum + 0.55, ws.z), size: 0.34, color: '#475569' }), null, at);
  tl.to(line, { opacity: 1, duration: 0.3 }, at);
  for (let kk = 0; kk < d; kk++) {
    const c = ctx.chips.acquire();
    res.push(c);
    tl.call(() => c.setup({ v: 0, kind: 'div', scale: Z.scale, decimals: 3, pos: V3(ws.xs[kk], ws.ySum, ws.z), opacity: 0 }), null, at);
  }
  tl.to(res, { opacity: 1, duration: 0.3 }, at + 0.1);
  const run = [0, 0, 0];
  for (let j = 0; j < n; j++) {
    const t = at + 0.4 + j * 0.5;
    tl.to([w.wc[j], w.x[j]], { opacity: 0, duration: 0.3 }, t);
    for (let kk = 0; kk < d; kk++) {
      run[kk] += A.values[row][j] * Vm.values[j][kk];
      const val = j === n - 1 ? Z.values[row][kk] : run[kk];
      fly(tl, w.vc[j][kk].group, V3(ws.xs[kk], ws.ySum, ws.z), { at: t, dur: 0.45, arc: 0.4, ease: 'power2.in' });
      tl.to(w.vc[j][kk], { opacity: 0, duration: 0.08 }, t + 0.4);
      tl.call(() => { if (j === n - 1) res[kk].decimals = Z.decimals; res[kk].v = val; }, null, t + 0.45);
      tl.fromTo(res[kk], { pop: 1.2 }, { pop: 1, duration: 0.25, immediateRender: false }, t + 0.45);
    }
  }
  const t2 = at + 0.4 + n * 0.5 + 0.4;
  tl.to(line, { opacity: 0, duration: 0.3 }, t2);
  res.forEach((c, kk) => {
    const t = t2 + kk * 0.1;
    fly(tl, c.group, () => Z.cellWorld(row, kk), { at: t, dur: 0.9, arc: 1.5 });
    tl.to(c, { opacity: 0, duration: 0.12 }, t + 0.85);
    reveal(tl, Z.cells[row][kk], t + 0.87);
  });
  const end = t2 + d * 0.1 + 1.1;
  tl.to(A.frame('row'), { opacity: 0, duration: 0.4 }, end);
  undim(tl, A, end);
  return end + 0.4;
}
