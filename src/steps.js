import { TOKENS, FOCUS as F, D_K, D_MODEL } from './data.js';
import { HEADS, X, CONCAT, OUT, WO, col, dotTerms, maxAbs, SQRT_DK } from './model.js';
import { WS, DIR, box, tokenRow, tokenSentence } from './layout.js';
import { show, hide, fly, appear, dim, bars, fill, flyCopy, flyTranspose, scaleScores, dpPick, dpMult, dpSum, smExp, smNorm, wsScale, wsSum } from './fx.js';
import { k, K, numTable } from './html.js';
import { tokHtml } from './scene.js';
import { fmt } from './text.js';

const H1 = HEADS[0], H2 = HEADS[1];
const T = (i) => `\\text{${TOKENS[i]}}`;
const SAT = 2, CAT = 1;
const pct = (v) => Math.round(v * 100);
const signed = (vals, d = 2, lead = false) => vals.map((v, i) => (i === 0 && !lead ? fmt(v, d) : v < 0 ? `- ${fmt(-v, d)}` : `+ ${fmt(v, d)}`)).join(' ');
// Long sums are split over aligned lines so they fit in the side panel.
const sumLines = (lhs, vals, rhs, d = 2, per = 3) => {
  const rows = [];
  for (let i = 0; i < vals.length; i += per) rows.push(signed(vals.slice(i, i + per), d, i > 0));
  return `\\begin{aligned} ${lhs} &= ${rows.join(' \\\\ &\\quad {} ')} \\\\ &${rhs} \\end{aligned}`;
};
const idx = (n) => Array.from({ length: n }, (_, i) => i);
const tokHeader = TOKENS.map((_, i) => tokHtml(i));
const wsBox = (ws, n) => box(ws.x0 - 1, ws.y0 - 1, ws.x0 + (n + 1) * ws.dx + 0.6, ws.y0 + 1);
const softBox = (n) => box(WS.soft.x0 - 2.2, WS.soft.y0 - 1, WS.soft.x0 + n * WS.soft.dx, WS.soft.y0 + 1.8, 0, 2.3);
const layer = (h) => [h.X, h.WQ, h.WK, h.WV, h.Q, h.K, h.V, h.Qc, h.KT, h.S, h.A, h.Vc, h.Z];

// Numbers used in the detailed walkthroughs.
const qTerms = dotTerms(X[F], col(H1.WQ, 0));
const sTerms = dotTerms(H1.Q[F], H1.K[SAT]);
const soft = H1.soft[F];
const scaledV = idx(4).map((j) => H1.V[j].map((v) => H1.A[F][j] * v));
const argmax = (row) => row.indexOf(Math.max(...row));

export const SECTIONS = ['Intro', 'One attention head', 'Multi-head attention'];

export const STEPS = [
  {
    section: 0,
    title: 'Self-attention, one number at a time',
    body: () => `
      <p>A Transformer reads text as a list of <b>tokens</b>. In <b>self-attention</b>, every token looks at every other token and
      pulls in the information it needs, so a word's meaning can depend on its context.</p>
      <p>We will follow the sentence <b>“The cat sat down”</b> through one attention head and then through multi-head attention,
      with every number on screen. By the end, all of this formula will make sense:</p>
      ${K('\\mathrm{Attention}(Q,K,V) = \\mathrm{softmax}\\!\\left(\\frac{QK^{\\top}}{\\sqrt{d_k}}\\right)V')}
      <p class="note">Toy sizes: n = 4 tokens, d<sub>model</sub> = 6, h = 2 heads, d<sub>k</sub> = 3.
      Real models do exactly the same math with bigger numbers.</p>
      <p class="tip">Click the scene, press <kbd>→</kbd> / <kbd>Space</kbd>, or use <b>Next</b> to step through.</p>`,
    play(tl, c) {
      c.view(tl, [box(-11.5, -1.8, 1.5, 5.2)], { dir: DIR.front });
      c.tokens.forEach((t, i) => {
        const at = 0.3 + i * 0.18;
        tl.call(() => { t.group.position.copy(tokenSentence(i)); t.pop = 1e-4; t.opacity = 1; }, null, at);
        tl.to(t, { pop: 1, duration: 0.7, ease: 'back.out(2)' }, at);
      });
    },
  },
  {
    section: 1,
    title: 'Tokens become vectors',
    body: () => `
      <p>Each token is looked up in a learned <b>embedding table</b> (with positional information added) and becomes a vector of
      d<sub>model</sub> = ${D_MODEL} numbers. Stacking the four vectors as rows gives the input matrix</p>
      ${K('X \\in \\mathbb{R}^{4 \\times 6}')}
      ${numTable([{ label: k(`x_{${T(F)}}`), values: X[F], dec: 1 }], { header: idx(6) })}
      <p>One row per token. Colour shows sign and size: <span class="neg">blue is negative</span>, <span class="pos">orange is positive</span>.</p>`,
    legend: ['div'],
    play(tl, c) {
      const { X: Xm } = c.heads[0];
      c.view(tl, [Xm, box(-12, -4, -1, 2.5)], { dir: DIR.front, pad: 1.2 });
      tl.call(() => {
        Xm.labels = 0;
        for (const cell of Xm.flat) { cell.reveal(true); cell.pop = 1e-4; }
        Xm.opacity = 1;
      }, null, 0);
      c.tokens.forEach((t, i) => {
        fly(tl, t.group, tokenRow(i), { at: 0.1 + i * 0.1, dur: 0.9, arc: 0.6 });
        tl.to(t, { pop: 0.55, duration: 0.9 }, 0.1 + i * 0.1);
      });
      for (const cell of Xm.flat) tl.to(cell, { pop: 1, duration: 0.4, ease: 'back.out(2)' }, 1.0 + cell.i * 0.25 + cell.j * 0.07);
      tl.to(c.tokens, { opacity: 0, duration: 0.5 }, 2.6);
      tl.to(Xm, { labels: 1, duration: 0.5 }, 2.6);
    },
  },
  {
    section: 1,
    title: 'Three learned projections',
    body: () => `
      <p>The attention head owns three weight matrices, learned during training:</p>
      ${K('W^Q,\\; W^K,\\; W^V \\in \\mathbb{R}^{6 \\times 3}')}
      <p>Multiplying X by each one gives every token three new, smaller vectors:</p>
      <ul>
        <li><b>Query</b> ${k('q')}: what this token is looking for</li>
        <li><b>Key</b> ${k('k')}: what this token offers, to be matched against queries</li>
        <li><b>Value</b> ${k('v')}: the information it hands over when attended to</li>
      </ul>
      ${K('Q = XW^Q,\\quad K = XW^K,\\quad V = XW^V \\quad (4\\times 3)')}
      <p>The <span class="muted">?</span> cells are what we compute next.</p>`,
    legend: ['div'],
    play(tl, c) {
      const h = c.heads[0];
      c.view(tl, [h.X, h.WQ, h.WK, h.WV, h.Q, h.K, h.V], { dir: DIR.front });
      appear(tl, h.WQ, { at: 0.4, stagger: 0.015 });
      appear(tl, h.WK, { at: 0.6, stagger: 0.015 });
      appear(tl, h.WV, { at: 0.8, stagger: 0.015 });
      show(tl, [h.Q, h.K, h.V], 1.4);
    },
  },
  {
    section: 1,
    title: 'One number of Q: a row meets a column',
    body: () => `
      <p>Every entry of a matrix product is a <b>dot product</b>. For the entry of ${k('Q')} in row ${tokHtml(F)}, column 0, take
      <span class="hl-row">row “${TOKENS[F]}” of X</span> and <span class="hl-col">column 0 of W<sup>Q</sup></span>:</p>
      ${K(`Q_{${T(F)},0} = \\sum_{l=0}^{5} X_{${T(F)},l}\\; W^Q_{l,0}`)}
      ${numTable([
        { label: k(`x_{${T(F)}}`), values: X[F], dec: 1, cls: 'row' },
        { label: k('W^Q_{:,0}'), values: col(H1.WQ, 0), dec: 1, cls: 'col' },
      ], { header: idx(6) })}
      <p>Both have ${D_MODEL} numbers, so they pair up one-to-one. In the scene the row drops down and the column swings
      underneath it, lining up the pairs.</p>`,
    legend: ['div'],
    play(tl, c) {
      const h = c.heads[0];
      c.view(tl, [h.X, h.WQ, h.Q, wsBox(WS.q, 6)], { dir: DIR.front });
      dpPick(tl, c, { A: h.X, i: F, B: h.WQ, j: 0, C: h.Q, ws: WS.q, at: 0.3 });
    },
  },
  {
    section: 1,
    title: 'Multiply each pair',
    body: () => `
      <p>Multiply the numbers in each pair. Same signs give a positive product; opposite signs give a negative one.</p>
      ${numTable([
        { label: k(`x_{${T(F)}}`), values: X[F], dec: 1, cls: 'row' },
        { label: k('W^Q_{:,0}'), values: col(H1.WQ, 0), dec: 1, cls: 'col' },
        { label: '×', values: qTerms, scale: maxAbs([qTerms]), dec: 2 },
      ], { header: idx(6) })}
      <p>Large products, positive or negative, are the dimensions where this row and column agree or disagree most strongly.</p>`,
    legend: ['div'],
    play(tl, c) {
      dpMult(tl, c, { at: 0.2 });
    },
  },
  {
    section: 1,
    title: '…and add them up',
    body: () => `
      <p>Add the six products. The running total counts up in the scene, then the result drops into ${k('Q')}:</p>
      ${K(sumLines(`Q_{${T(F)},0}`, qTerms, `= ${fmt(H1.Q[F][0])}`))}
      <p>That is <b>one</b> number. Q has 4 × 3 = 12 of them, and each one is a different row-and-column pair.</p>`,
    legend: ['div'],
    play(tl, c) {
      dpSum(tl, c, { at: 0.2 });
    },
  },
  {
    section: 1,
    title: 'Every cell of Q is a dot product',
    body: () => `
      <p>Row ${k('i')} of X · column ${k('j')} of W<sup>Q</sup> gives ${k('Q_{ij}')}. Doing all 12 at once is the matrix product</p>
      ${K('Q = X\\,W^Q \\qquad (4\\times 6)\\cdot(6\\times 3) \\rightarrow 4\\times 3')}
      <p>The inner sizes (6) must match and disappear; the outer sizes (4 and 3) give the shape of the result.
      Row ${k('i')} of Q is the <b>query vector</b> ${k('q_i')} of token ${k('i')}.</p>
      <p class="tip">Hover over any cell to see exactly how it was computed.</p>`,
    legend: ['div'],
    play(tl, c) {
      const h = c.heads[0];
      c.view(tl, [h.X, h.WQ, h.Q], { dir: DIR.front });
      fill(tl, h.Q, { A: h.X, B: h.WQ, at: 0.4, stagger: 0.16 });
    },
  },
  {
    section: 1,
    title: 'Same recipe for K and V',
    body: () => `
      <p>Same input, different weights, so we get different vectors:</p>
      ${K('K = X\\,W^K \\qquad V = X\\,W^V')}
      <ul>
        <li><b>Keys</b> ${k('k_j')} advertise what each token contains. Queries are compared against them.</li>
        <li><b>Values</b> ${k('v_j')} carry the content that gets passed on once a token is attended to.</li>
      </ul>
      <p class="note">Real implementations compute Q, K and V with one fused matrix multiply. The math is identical.</p>`,
    legend: ['div'],
    play(tl, c) {
      const h = c.heads[0];
      c.view(tl, [h.X, h.WQ, h.WK, h.WV, h.Q, h.K, h.V], { dir: DIR.front });
      fill(tl, h.K, { A: h.X, B: h.WK, at: 0.6, stagger: 0.12 });
      fill(tl, h.V, { B: h.WV, at: 0.6, stagger: 0.12 });
    },
  },
  {
    section: 1,
    title: 'Compare every query with every key',
    body: () => `
      <p>How much should token ${k('i')} attend to token ${k('j')}? We score it with the dot product ${k('q_i \\cdot k_j')}.
      We need it for <b>every</b> pair: 4 × 4 = 16 scores.</p>
      <p>Turn ${k('K')} on its side so that each key becomes a <b>column</b>. This is the transpose ${k('K^{\\top}')} (3×4).
      Now all 16 dot products are one matrix product:</p>
      ${K('S = Q\\,K^{\\top} \\qquad (4\\times 3)\\cdot(3\\times 4) \\rightarrow 4\\times 4')}
      <p>Row ${k('i')} of S will hold how well token ${k('i')}'s query matches each key.</p>`,
    legend: ['div'],
    play(tl, c) {
      const h = c.heads[0];
      c.view(tl, [h.Q, h.K, h.Qc, h.KT, h.S], { dir: DIR.wide });
      flyCopy(tl, h.Qc, h.Q, { at: 0.6, dur: 1.7 });
      flyTranspose(tl, h.KT, h.K, { at: 0.9, dur: 2.1 });
      show(tl, h.S, 2.6);
      c.view(tl, [h.Qc, h.KT, h.S], { dir: DIR.front }, 3.0);
    },
  },
  {
    section: 1,
    title: `Does “${TOKENS[F]}” care about “${TOKENS[SAT]}”?`,
    body: () => `
      <p>The query of ${tokHtml(F)} against the key of ${tokHtml(SAT)}: the same multiply-and-add, now with d<sub>k</sub> = 3 terms.</p>
      ${numTable([
        { label: k(`q_{${T(F)}}`), values: H1.Q[F], scale: maxAbs(H1.Q), cls: 'row' },
        { label: k(`k_{${T(SAT)}}`), values: H1.K[SAT], scale: maxAbs(H1.K), cls: 'col' },
        { label: '×', values: sTerms, scale: maxAbs([sTerms]), dec: 4 },
      ], { header: idx(3) })}
      ${K(`s_{${T(F)},${T(SAT)}} = ${signed(sTerms, 4)} \\approx ${fmt(H1.S[F][SAT])}`)}
      <p>A large positive score means the query and the key point the same way: “${TOKENS[F]}” is interested in “${TOKENS[SAT]}”.</p>`,
    legend: ['div'],
    play(tl, c) {
      const h = c.heads[0];
      c.view(tl, [h.Qc, h.KT, h.S, wsBox(WS.s, 3)], { dir: DIR.front });
      let t = dpPick(tl, c, { A: h.Qc, i: F, B: h.KT, j: SAT, C: h.S, ws: WS.s, at: 0.3, speed: 1.25 });
      t = dpMult(tl, c, { at: t });
      dpSum(tl, c, { at: t + 0.2 });
    },
  },
  {
    section: 1,
    title: 'All 16 query–key scores',
    body: () => `
      ${K('S = Q\\,K^{\\top}')}
      <p>Row = the token doing the looking (query). Column = the token being looked at (key). Row ${tokHtml(F)}:</p>
      ${numTable([{ label: k(`s_{${T(F)}}`), values: H1.S[F], scale: maxAbs(H1.S) }], { header: tokHeader })}
      <p>For ${tokHtml(F)} the largest score is with ${tokHtml(argmax(H1.S[F]))}. These raw scores can be any size and sign,
      so they are not weights yet.</p>`,
    legend: ['div'],
    play(tl, c) {
      const h = c.heads[0];
      c.view(tl, [h.Qc, h.KT, h.S], { dir: DIR.front });
      fill(tl, h.S, { A: h.Qc, B: h.KT, at: 0.4, stagger: 0.13 });
    },
  },
  {
    section: 1,
    title: 'Scale by √dₖ',
    body: () => `
      <p>Dot products grow with vector length. If the entries of ${k('q')} and ${k('k')} have variance 1, then ${k('q\\cdot k')}
      has variance ${k('d_k')}. Large scores push softmax into saturation (one weight ≈ 1, the rest ≈ 0), and training stalls.</p>
      <p>So every score is divided by ${k(`\\sqrt{d_k} = \\sqrt{${D_K}} \\approx ${fmt(SQRT_DK, 3)}`)}:</p>
      ${K(`s'_{${T(F)},${T(SAT)}} = \\frac{${fmt(H1.S[F][SAT])}}{${fmt(SQRT_DK, 3)}} = ${fmt(H1.Ss[F][SAT])}`)}
      ${numTable([
        { label: k('s'), values: H1.S[F], scale: maxAbs(H1.S) },
        { label: k('s/\\sqrt{3}'), values: H1.Ss[F], scale: maxAbs(H1.S) },
      ], { header: tokHeader })}
      <p>The colours fade because the numbers shrink toward zero.</p>`,
    legend: ['div'],
    play(tl, c) {
      const h = c.heads[0];
      c.view(tl, [h.Qc, h.KT, h.S], { dir: DIR.front });
      scaleScores(tl, h.S, H1.Ss, h.sTex.scaled, { at: 0.5, dur: 1.5 });
    },
  },
  {
    section: 1,
    title: 'Softmax, part 1: exponentiate',
    body: () => `
      <p><b>Softmax</b> turns a row of scores into weights that are <b>positive</b> and <b>sum to 1</b>.
      Part 1: raise ${k('e')} to the power of every score in row ${tokHtml(F)}.</p>
      ${numTable([
        { label: k("s'"), values: H1.Ss[F], scale: maxAbs(H1.S) },
        { label: k("e^{s'}"), values: soft.e, scale: Math.max(...soft.e) },
      ], { header: tokHeader })}
      <p>${k('e^x')} is always positive and grows fast, so bigger scores get a much bigger share.
      The bar heights in the scene show ${k("e^{s'}")}.</p>`,
    legend: ['div'],
    play(tl, c) {
      const h = c.heads[0];
      c.view(tl, [h.S, softBox(3.6)], { dir: DIR.tilt });
      smExp(tl, c, { S: h.S, row: F, parts: soft, ws: WS.soft, at: 0.3 });
    },
  },
  {
    section: 1,
    title: 'Softmax, part 2: normalise',
    body: () => `
      <p>Part 2: divide each exponential by the row total.</p>
      ${K(`\\textstyle\\sum_j e^{s'_j} = ${soft.e.map((v) => fmt(v)).join(' + ')} = ${fmt(soft.sum)}`)}
      ${numTable([
        { label: k("e^{s'}"), values: soft.e, scale: Math.max(...soft.e) },
        { label: k('a'), values: soft.w, kind: 'seq', scale: 0.8 },
      ], { header: tokHeader })}
      ${K(`a_{${T(F)},${T(SAT)}} = \\frac{${fmt(soft.e[SAT])}}{${fmt(soft.sum)}} = ${fmt(soft.w[SAT])}`)}
      <p>${tokHtml(F)} puts <b>${pct(soft.w[SAT])}%</b> of its attention on ${tokHtml(SAT)}.
      These weights become row “${TOKENS[F]}” of the attention matrix ${k('A')}.</p>`,
    legend: ['div', 'seq'],
    play(tl, c) {
      const h = c.heads[0];
      c.view(tl, [h.S, h.A, softBox(5)], { dir: DIR.tilt });
      show(tl, h.A, 0);
      smNorm(tl, c, { A: h.A, at: 0.3 });
    },
  },
  {
    section: 1,
    title: 'The attention pattern',
    body: () => `
      <p>Softmax runs on every row independently:</p>
      ${K('A = \\mathrm{softmax}\\!\\left(\\frac{QK^{\\top}}{\\sqrt{d_k}}\\right)')}
      <p>Bar height = attention weight, and every row sums to 1. This head has learned a <b>“previous word”</b> pattern:
      each token looks mostly at the token right before it. “The” has nothing before it, so it looks at itself.</p>
      <p class="note">GPT-style decoders also add a <b>causal mask</b> before softmax: scores above the diagonal are set to −∞,
      so after softmax a token can't attend to tokens that come after it.</p>`,
    legend: ['seq'],
    play(tl, c) {
      const h = c.heads[0];
      c.view(tl, [h.S, h.A], { dir: DIR.tilt, pad: 1.15 });
      const t = fill(tl, h.A, { A: h.S, at: 0.5, stagger: 0.09 });
      bars(tl, h.A, true, { at: t });
    },
  },
  {
    section: 1,
    title: 'Mixing values, part 1: scale',
    body: () => `
      <p>Now ${tokHtml(F)} gathers information. Each value vector ${k('v_j')} is multiplied by the attention weight
      ${k(`a_{${T(F)},j}`)}:</p>
      ${numTable(idx(4).map((j) => ({ label: `${fmt(H1.A[F][j])} × ${k('v')}<sub>${tokHtml(j)}</sub>`, values: scaledV[j], scale: maxAbs(H1.V), dec: 3 })), { header: idx(3) })}
      <p>Rows with small weights shrink toward zero. ${tokHtml(SAT)} (weight ${fmt(H1.A[F][SAT])}) keeps the most.</p>`,
    legend: ['div', 'seq'],
    play(tl, c) {
      const h = c.heads[0];
      c.view(tl, [h.A, h.Vc, h.Z, box(WS.ws.xw - 1.3, WS.ws.ySum - 0.8, WS.ws.xs[2] + 1, WS.ws.ys[0] + 0.8)], { dir: DIR.front });
      bars(tl, h.A, false, { at: 0, dur: 0.6, stagger: 0 });
      flyCopy(tl, h.Vc, h.V, { at: 0.2, dur: 1.7, arc: 3 });
      show(tl, h.Z, 1.2);
      wsScale(tl, c, { A: h.A, Vm: h.Vc, row: F, ws: WS.ws, at: 2.0 });
    },
  },
  {
    section: 1,
    title: 'Mixing values, part 2: add',
    body: () => `
      <p>Add the scaled value vectors column by column:</p>
      ${K(`z_{${T(F)}} = \\sum_j a_{${T(F)},j}\\, v_j`)}
      ${numTable([
        ...idx(4).map((j) => ({ label: `${fmt(H1.A[F][j])} × ${k('v')}<sub>${tokHtml(j)}</sub>`, values: scaledV[j], scale: maxAbs(H1.V), dec: 3 })),
        { label: k(`z_{${T(F)}}`), values: H1.Z[F], scale: maxAbs(H1.V), cls: 'sum' },
      ], { header: idx(3) })}
      <p>The new vector for “${TOKENS[F]}” is mostly the value of “${TOKENS[SAT]}”, plus a little of the others.
      This is how context flows between tokens.</p>`,
    legend: ['div', 'seq'],
    play(tl, c) {
      wsSum(tl, c, { Z: c.heads[0].Z, at: 0.2 });
    },
  },
  {
    section: 1,
    title: 'Head output: Z = AV',
    body: () => `
      <p>Every token does the same thing, and that is one more matrix product:</p>
      ${K('Z = A\\,V \\qquad (4\\times 4)\\cdot(4\\times 3) \\rightarrow 4\\times 3')}
      <p>Each output row is a weighted average of value vectors. Putting the whole head together:</p>
      ${K('\\mathrm{head}(X) = \\mathrm{softmax}\\!\\left(\\frac{(XW^Q)(XW^K)^{\\top}}{\\sqrt{d_k}}\\right) XW^V')}`,
    legend: ['div', 'seq'],
    play(tl, c) {
      const h = c.heads[0];
      c.view(tl, [h.A, h.Vc, h.Z], { dir: DIR.front });
      fill(tl, h.Z, { A: h.A, B: h.Vc, at: 0.4, stagger: 0.15 });
    },
  },
  {
    section: 1,
    title: 'One head, end to end',
    body: () => `
      <p>The whole head, left to right:</p>
      <ol class="flow">
        <li>${k('X')} (4×6) → project → ${k('Q, K, V')} (4×3 each)</li>
        <li>${k('QK^{\\top}')} → scores (4×4)</li>
        <li>${k('\\div\\sqrt{d_k}')}, softmax per row → ${k('A')} (4×4)</li>
        <li>${k('AV')} → output ${k('Z')} (4×3)</li>
      </ol>
      <p>Every number came from a multiply-and-add, an exponential, or a division. Nothing else.</p>
      <p class="tip">Drag to orbit, <kbd>Shift</kbd> + drag to pan, scroll to zoom, hover to inspect any cell.</p>`,
    legend: ['div', 'seq'],
    play(tl, c) {
      const h = c.heads[0];
      c.view(tl, layer(h), { dir: DIR.wide, pad: 1.04 });
      bars(tl, h.A, true, { at: 1.0 });
    },
  },
  {
    section: 2,
    title: 'Multi-head: several heads in parallel',
    body: () => `
      <p>One head produces one attention pattern, but a token often needs several kinds of context at once: the previous word,
      the subject, a related noun… <b>Multi-head attention</b> runs ${k('h')} heads side by side on the <b>same</b> ${k('X')},
      each with its own ${k('W^Q_i, W^K_i, W^V_i')}.</p>
      <p>To keep the cost the same, each head works in a smaller space:</p>
      ${K('d_k = d_{\\text{model}} / h = 6 / 2 = 3')}
      <p class="note">In code, the heads' weights are stored side by side as one 6×6 matrix ${k('W^Q = [\\,W^Q_1 \\mid W^Q_2\\,]')};
      ${k('Q = XW^Q')} is computed once and its columns are split between the heads.</p>`,
    legend: ['div', 'seq'],
    play(tl, c) {
      const [h1, h2] = c.heads;
      c.view(tl, [...layer(h1), h2.X, h2.WV, h2.Z], { dir: DIR.deep, pad: 1.03 });
      tl.call(() => { for (const [key, tex] of Object.entries(h1.texMH)) h1[key].setLabel(tex); }, null, 0.3);
      tl.to(c.tags, { opacity: 1, duration: 0.6 }, 0.6);
      flyCopy(tl, h2.X, h1.X, { at: 0.8, dur: 1.8, arc: 1.5 });
      appear(tl, h2.WQ, { at: 1.8, stagger: 0.01 });
      appear(tl, h2.WK, { at: 2.0, stagger: 0.01 });
      appear(tl, h2.WV, { at: 2.2, stagger: 0.01 });
      show(tl, [h2.Q, h2.K, h2.V, h2.S, h2.A, h2.Z], 2.6);
    },
  },
  {
    section: 2,
    title: 'Head 2 does the same math',
    body: () => `
      <p>Head 2 follows exactly the same recipe (projections, scores, scaling, softmax, weighted sum) with its own learned weights:</p>
      ${K('\\mathrm{head}_2 = \\mathrm{softmax}\\!\\left(\\frac{Q_2K_2^{\\top}}{\\sqrt{d_k}}\\right)V_2')}
      ${numTable([
        { label: k('q_{2,\\text{down}}'), values: H2.Q[F], scale: maxAbs(H2.Q) },
        { label: k('a_{2,\\text{down}}'), values: H2.A[F], kind: 'seq', scale: 0.8 },
      ])}
      <p>On a GPU every head is computed at the same time, as one batched operation.</p>`,
    legend: ['div', 'seq'],
    play(tl, c) {
      const h = c.heads[1];
      c.view(tl, [h.X, h.WQ, h.WK, h.WV, h.Q, h.K, h.V], { dir: DIR.front }, 0);
      fill(tl, h.Q, { A: h.X, B: h.WQ, at: 0.8, stagger: 0.06 });
      fill(tl, h.K, { B: h.WK, at: 0.8, stagger: 0.06 });
      fill(tl, h.V, { B: h.WV, at: 0.8, stagger: 0.06 });
      c.view(tl, [h.Qc, h.KT, h.S, h.A], { dir: DIR.front }, 2.1);
      flyCopy(tl, h.Qc, h.Q, { at: 2.1, dur: 1.3 });
      flyTranspose(tl, h.KT, h.K, { at: 2.2, dur: 1.5 });
      let t = fill(tl, h.S, { A: h.Qc, B: h.KT, at: 3.9, stagger: 0.05 });
      t = scaleScores(tl, h.S, H2.Ss, h.sTex.scaled, { at: t, dur: 0.8 });
      t = fill(tl, h.A, { A: h.S, at: t + 0.1, stagger: 0.05 });
      c.view(tl, [h.A, h.Vc, h.Z], { dir: DIR.front }, t + 0.3);
      flyCopy(tl, h.Vc, h.V, { at: t + 0.3, dur: 1.5, arc: 3 });
      fill(tl, h.Z, { A: h.A, B: h.Vc, at: t + 2.0, stagger: 0.07 });
    },
  },
  {
    section: 2,
    title: 'Different heads, different patterns',
    body: () => `
      <p>Same sentence, same input, different weights, so a different pattern:</p>
      <ul>
        <li><b>Head 1: “previous word”.</b> ${tokHtml(F)} → ${tokHtml(SAT)} (${pct(H1.A[F][SAT])}%)</li>
        <li><b>Head 2: “find the subject”.</b> Every token looks at ${tokHtml(CAT)}; ${tokHtml(F)} → ${tokHtml(CAT)} (${pct(H2.A[F][CAT])}%)</li>
      </ul>
      ${numTable([
        { label: 'Head 1', values: H1.A[F], kind: 'seq', scale: 0.8 },
        { label: 'Head 2', values: H2.A[F], kind: 'seq', scale: 0.8 },
      ], { header: tokHeader })}
      <p>Large models have dozens of heads per layer. Researchers have found heads that track syntax, coreference, position and more.</p>`,
    legend: ['seq'],
    play(tl, c) {
      const [h1, h2] = c.heads;
      const { A1cmp, A2cmp } = c.fin;
      c.view(tl, [A1cmp, A2cmp], { dir: DIR.tilt, pad: 1.15 });
      tl.to([...layer(h1), ...layer(h2)], { fade: 0.18, duration: 0.8 }, 0.2);
      tl.to(c.tags, { opacity: 0.25, duration: 0.8 }, 0.2);
      flyCopy(tl, A1cmp, h1.A, { at: 0.4, dur: 1.5 });
      flyCopy(tl, A2cmp, h2.A, { at: 0.6, dur: 1.5 });
      bars(tl, A1cmp, true, { at: 2.1 });
      bars(tl, A2cmp, true, { at: 2.3 });
      dim(tl, A1cmp, (r) => r === F, 3.4, 0.4);
      dim(tl, A2cmp, (r) => r === F, 3.4, 0.4);
    },
  },
  {
    section: 2,
    title: 'Concatenate the heads',
    body: () => `
      <p>Each head outputs a 4×3 matrix. Place them side by side:</p>
      ${K('\\mathrm{Concat}(Z_1, Z_2) \\in \\mathbb{R}^{4\\times 6}')}
      ${numTable([{ label: k(T(F)), values: CONCAT[F], scale: maxAbs(CONCAT) }], { header: ['h1', 'h1', 'h1', 'h2', 'h2', 'h2'] })}
      <p>We are back to d<sub>model</sub> = 6 columns: 0–2 come from head 1 and 3–5 from head 2. Nothing has been mixed yet.</p>`,
    legend: ['div'],
    play(tl, c) {
      const [h1, h2] = c.heads;
      const f = c.fin;
      hide(tl, [f.A1cmp, f.A2cmp], 0, 0.5);
      tl.to([...layer(h1), ...layer(h2)], { fade: 1, duration: 0.8 }, 0.2);
      tl.to(c.tags, { opacity: 1, duration: 0.8 }, 0.2);
      c.view(tl, [h1.Z, h2.Z, f.CONCAT, f.Z1c], { dir: DIR.deep, pad: 1.12 });
      flyCopy(tl, f.Z1c, h1.Z, { at: 0.7, dur: 1.8, arc: 2 });
      flyCopy(tl, f.Z2c, h2.Z, { at: 0.9, dur: 1.8, arc: 2 });
      tl.call(() => f.CONCAT.revealAll(true), null, 2.9);
      tl.to(f.CONCAT, { opacity: 1, duration: 0.5 }, 2.9);
      hide(tl, [f.Z1c, f.Z2c], 3.1, 0.4);
    },
  },
  {
    section: 2,
    title: 'Mix the heads with Wᴼ',
    body: () => `
      <p>A final learned matrix ${k('W^O \\in \\mathbb{R}^{6\\times 6}')} combines what the heads found. Every output column
      reads from all six concatenated columns, so from both heads:</p>
      ${K('\\mathrm{MultiHead}(X) = \\mathrm{Concat}(Z_1, Z_2)\\,W^O')}
      ${K(sumLines(`\\mathrm{out}_{${T(F)},0}`, dotTerms(CONCAT[F], col(WO, 0)), `\\approx ${fmt(OUT[F][0])}`, 3))}
      <p class="tip">Hover any output cell to see its full sum.</p>`,
    legend: ['div'],
    play(tl, c) {
      const f = c.fin;
      c.view(tl, [f.CONCAT, f.WO, f.OUT], { dir: DIR.front });
      appear(tl, f.WO, { at: 0.5, stagger: 0.012 });
      show(tl, f.OUT, 1.2);
      fill(tl, f.OUT, { A: f.CONCAT, B: f.WO, at: 1.9, stagger: 0.09 });
    },
  },
  {
    section: 2,
    title: 'The complete picture',
    body: () => `
      ${K('\\mathrm{MultiHead}(X) = \\mathrm{Concat}(\\mathrm{head}_1, \\ldots, \\mathrm{head}_h)\\,W^O')}
      ${K('\\mathrm{head}_i = \\mathrm{softmax}\\!\\left(\\frac{XW_i^Q\\,(XW_i^K)^{\\top}}{\\sqrt{d_k}}\\right) XW_i^V')}
      <p>The output has the same shape as the input ${k('X')} (4×6). It is added back to ${k('X')} (the <b>residual connection</b>),
      normalised, and passed through a feed-forward network. A Transformer stacks this block many times.</p>
      <table class="shapes">
        <tr><th></th><th>this demo</th><th>GPT-2 small</th></tr>
        <tr><td>tokens n</td><td>4</td><td>up to 1024</td></tr>
        <tr><td>d<sub>model</sub></td><td>6</td><td>768</td></tr>
        <tr><td>heads h</td><td>2</td><td>12</td></tr>
        <tr><td>d<sub>k</sub></td><td>3</td><td>64</td></tr>
      </table>
      <p class="tip">Hover any cell to inspect its math, or jump to any step with the progress bar.</p>`,
    legend: ['div', 'seq'],
    play(tl, c) {
      const [h1, h2] = c.heads;
      const f = c.fin;
      c.view(tl, [...layer(h1), ...layer(h2), f.CONCAT, f.WO, f.OUT], { dir: DIR.wide, pad: 1.03 });
      bars(tl, h2.A, true, { at: 1.2 });
    },
  },
];
