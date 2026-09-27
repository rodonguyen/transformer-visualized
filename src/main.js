import './style.css';
import 'katex/dist/katex.min.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/500.css';
import gsap from 'gsap';
import { Box3, Raycaster, Vector2 } from 'three';
import { Stage } from './stage.js';
import { buildScene } from './scene.js';
import { STEPS } from './steps.js';
import { UI } from './ui.js';
import { preloadFonts } from './text.js';
import { DIR } from './layout.js';

async function main() {
  const viewport = document.getElementById('viewport');
  const loading = document.getElementById('loading');
  let stage;
  try {
    stage = new Stage(viewport);
  } catch (err) {
    loading.textContent = 'This visualisation needs WebGL, which is not available in this browser.';
    throw err;
  }
  await preloadFonts();
  const scene = buildScene(stage);

  const ctx = {
    ...scene,
    stage,
    instant: false,
    detail: {},
    lastView: null,
    // Queue a camera move that frames `items` (matrices or Box3s) at time `at` of the step timeline.
    view(tl, items, { dir = DIR.front, pad = 1.1 } = {}, at = 0) {
      const box = new Box3();
      for (const it of items) box.union(it.isBox3 ? it : it.boxAt());
      const view = { box, dir, pad };
      tl.call(() => {
        ctx.lastView = view;
        if (!ctx.instant) stage.flyTo(view);
      }, null, at);
    },
  };

  const hover = {
    ray: new Raycaster(),
    ndc: new Vector2(),
    px: 0,
    py: 0,
    inside: false,
    dirty: false,
    cell: null,
    frames: [],
    set(cell) {
      if (cell === this.cell) return;
      for (const f of this.frames) f.opacity = 0;
      this.frames = [];
      this.cell = cell;
      const info = cell?.m.explain?.(cell.i, cell.j);
      if (!info) { ui.hideTooltip(); return; }
      const own = cell.m.frame('hover').cell(cell.i, cell.j);
      own.opacity = 1;
      this.frames.push(own);
      for (const [m, type, a, b] of info.sources ?? []) {
        if (m.alpha < 0.3) continue;
        const f = m.frame('src');
        if (type === 'row') f.row(a); else if (type === 'col') f.col(a); else f.cell(a, b);
        f.opacity = 1;
        this.frames.push(f);
      }
      ui.showTooltip(info);
    },
  };

  function resetScene() {
    hover.set(null);
    for (const m of scene.all) m.reset();
    scene.chips.releaseAll();
    scene.glyphs.releaseAll();
    for (const t of scene.tokens) t.reset();
    for (const g of scene.tags) g.opacity = 0;
    ctx.detail = {};
  }

  let cur = -1;
  let tl = null;

  function build(i, instant) {
    ctx.instant = instant;
    const t = gsap.timeline({ paused: true });
    STEPS[i].play(t, ctx);
    return t;
  }

  // Any step can be reached by resetting and fast-forwarding all earlier steps, so the scene is
  // always consistent no matter how the user navigates.
  function go(i) {
    i = Math.max(0, Math.min(STEPS.length - 1, i));
    hover.set(null);
    if (tl) { tl.progress(1); tl.kill(); tl = null; }
    if (i !== cur + 1) {
      resetScene();
      ctx.lastView = null;
      for (let s = 0; s < i; s++) {
        const t = build(s, true);
        t.progress(1);
        t.kill();
      }
      ctx.instant = false;
      if (ctx.lastView) stage.flyTo(ctx.lastView, 1.0);
    }
    cur = i;
    tl = build(i, false);
    tl.play();
    ui.show(i);
    history.replaceState(null, '', `#${i + 1}`);
  }

  const next = () => { if (cur < STEPS.length - 1) go(cur + 1); };
  const prev = () => { if (cur > 0) go(cur - 1); };
  const ui = new UI({
    go,
    next,
    prev,
    replay: () => go(cur),
    resetView: () => { if (ctx.lastView) stage.flyTo(ctx.lastView, 0.8); },
  });

  const canvas = stage.renderer.domElement;
  let down = null;
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), b: e.button }; });
  canvas.addEventListener('pointerup', (e) => {
    if (down && down.b === 0 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && performance.now() - down.t < 500) next();
    down = null;
  });
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    hover.px = e.clientX - r.left;
    hover.py = e.clientY - r.top;
    hover.ndc.set((hover.px / r.width) * 2 - 1, -(hover.py / r.height) * 2 + 1);
    hover.inside = true;
    hover.dirty = true;
  });
  canvas.addEventListener('pointerleave', () => { hover.inside = false; hover.set(null); });

  stage.beforeRender = () => {
    if (!hover.inside || !hover.dirty) return;
    hover.dirty = false;
    const meshes = [];
    for (const m of scene.all) {
      if (m.alpha < 0.5 || !m.explain) continue;
      for (const c of m.flat) if (c.revealed && c.group.visible && c.emph > 0.5) meshes.push(c.mesh);
    }
    hover.ray.setFromCamera(hover.ndc, stage.camera);
    const hit = hover.ray.intersectObjects(meshes, false)[0];
    hover.set(hit ? hit.object.userData.cell : null);
    if (hover.cell) ui.moveTooltip(hover.px, hover.py);
  };

  loading.remove();
  const fromHash = parseInt(location.hash.slice(1), 10);
  go(Number.isFinite(fromHash) ? fromHash - 1 : 0);
}

main();
