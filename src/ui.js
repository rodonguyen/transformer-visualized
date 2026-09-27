import katex from 'katex';
import { SECTIONS, STEPS } from './steps.js';
import { LEGEND } from './colors.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor({ go, next, prev, replay, resetView }) {
    this.el = {
      progress: $('progress'),
      section: $('section'),
      counter: $('counter'),
      title: $('title'),
      body: $('body'),
      legend: $('legend'),
      prev: $('prev'),
      next: $('next'),
      tooltip: $('tooltip'),
    };
    this.bodies = new Map();
    this.segs = [];

    SECTIONS.forEach((name, s) => {
      const group = document.createElement('div');
      group.className = 'pgroup';
      group.innerHTML = `<div class="pname">${name}</div><div class="psegs"></div>`;
      const segs = group.querySelector('.psegs');
      STEPS.forEach((st, i) => {
        if (st.section !== s) return;
        const b = document.createElement('button');
        b.className = 'pseg';
        b.title = `${i + 1}. ${st.title}`;
        b.setAttribute('aria-label', `Step ${i + 1}: ${st.title}`);
        b.addEventListener('click', () => go(i));
        segs.appendChild(b);
        this.segs[i] = b;
      });
      this.el.progress.appendChild(group);
    });

    this.el.prev.addEventListener('click', prev);
    this.el.next.addEventListener('click', next);
    $('replay').addEventListener('click', replay);
    $('reset-view').addEventListener('click', resetView);

    window.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const onButton = e.target instanceof HTMLButtonElement;
      if ((e.key === ' ' || e.key === 'Enter') && onButton) return;
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); next(); }
      else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); prev(); }
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(STEPS.length - 1);
      else if (e.key === 'r' || e.key === 'R') replay();
      else if (e.key === 'c' || e.key === 'C') resetView();
    });
  }

  show(i) {
    const st = STEPS[i];
    if (!this.bodies.has(i)) this.bodies.set(i, st.body());
    this.el.section.textContent = SECTIONS[st.section];
    this.el.counter.textContent = `Step ${i + 1} of ${STEPS.length}`;
    this.el.title.textContent = st.title;
    this.el.body.innerHTML = this.bodies.get(i);
    this.el.body.scrollTop = 0;
    this.el.legend.innerHTML = (st.legend ?? []).map((kind) => (kind === 'seq'
      ? `<div class="lg"><span>0</span><i style="background:${LEGEND.sequential}"></i><span>attention weight</span><span>1</span></div>`
      : `<div class="lg"><span>−</span><i style="background:${LEGEND.diverging}"></i><span>value</span><span>+</span></div>`)).join('');
    this.segs.forEach((b, k) => {
      b.classList.toggle('done', k < i);
      b.classList.toggle('current', k === i);
    });
    this.el.prev.disabled = i === 0;
    this.el.next.disabled = i === STEPS.length - 1;
  }

  showTooltip(info) {
    const lines = info.lines.map((l) => `<div class="tt-line">${katex.renderToString(l, { throwOnError: false })}</div>`).join('');
    this.el.tooltip.innerHTML = `<div class="tt-title">${info.title}</div>${lines}${info.note ? `<div class="tt-note">${info.note}</div>` : ''}`;
    this.el.tooltip.hidden = false;
  }

  moveTooltip(x, y) {
    const tt = this.el.tooltip;
    const pw = tt.parentElement.clientWidth, ph = tt.parentElement.clientHeight;
    const w = tt.offsetWidth, h = tt.offsetHeight;
    let left = x + 18, top = y + 18;
    if (left + w > pw - 8) left = Math.max(8, x - w - 18);
    if (top + h > ph - 8) top = Math.max(8, y - h - 18);
    tt.style.transform = `translate(${left}px, ${top}px)`;
  }

  hideTooltip() {
    this.el.tooltip.hidden = true;
  }
}
