import { Vector3 } from 'three';
import { MatrixViz, Chip, Glyph, Pool, TokenTile } from './matrix.js';
import { TOKENS, TOKEN_COLORS, D_K } from './data.js';
import { HEADS, X, WO, CONCAT, OUT, maxAbs, col, SQRT_DK } from './model.js';
import { P, H2, offset, tokenSentence } from './layout.js';
import { fmt, FONT } from './text.js';

const tokTex = (i) => `\\text{${TOKENS[i]}}`;
export const tokHtml = (i) => `<span class="tok" style="color:${TOKEN_COLORS[i]}">${TOKENS[i]}</span>`;
const terms = (a, b, da, db) => a.map((x, l) => `(${fmt(x, da)})(${fmt(b[l], db)})`).join(' + ');

function projExplain(C, Xm, W, name, wname, copyOf) {
  return (i, j) => ({
    title: `${copyOf ? `Copy of ${name}` : name} &middot; row ${tokHtml(i)}, column ${j}`,
    lines: [
      `${name}_{${tokTex(i)},${j}} = \\sum_{l=0}^{5} X_{${tokTex(i)},l}\\, ${wname}_{l,${j}}`,
      `= ${terms(Xm.values[i], col(W.values, j), 1, 1)}`,
      `= ${fmt(C.values[i][j])}`,
    ],
    sources: [[Xm, 'row', i], [W, 'col', j]],
  });
}

export function buildScene(stage) {
  const all = [];
  const mk = (o) => {
    const m = new MatrixViz(stage, o);
    all.push(m);
    return m;
  };
  const zScale = Math.max(maxAbs(HEADS[0].Z), maxAbs(HEADS[1].Z));

  const heads = HEADS.map((H, h) => {
    const at = (p) => (h ? offset(p, H2) : p);
    const s = h ? `_2` : '';
    const id = (n) => (h ? `${n}@2` : n);
    const qScale = maxAbs(H.Q), kScale = maxAbs(H.K), vScale = maxAbs(H.V), sScale = maxAbs(H.S);
    const tokenRows = { rowLabels: TOKENS, rowColors: TOKEN_COLORS };
    const tokenCols = { colLabels: TOKENS, colColors: TOKEN_COLORS };
    const m = {};
    m.X = mk({ id: id('X'), values: X, tex: 'X', decimals: 1, scale: 1, pos: at(P.X), ...tokenRows });
    m.WQ = mk({ id: id('WQ'), values: H.WQ, tex: `W^Q${s}`, decimals: 1, scale: 1, pos: at(P.WQ), labelSide: 'top', labelClass: 'weight' });
    m.WK = mk({ id: id('WK'), values: H.WK, tex: `W^K${s}`, decimals: 1, scale: 1, pos: at(P.WK), labelSide: 'top', labelClass: 'weight' });
    m.WV = mk({ id: id('WV'), values: H.WV, tex: `W^V${s}`, decimals: 1, scale: 1, pos: at(P.WV), labelSide: 'top', labelClass: 'weight' });
    m.Q = mk({ id: id('Q'), values: H.Q, tex: `Q${s}`, scale: qScale, pos: at(P.Q) });
    m.K = mk({ id: id('K'), values: H.K, tex: `K${s}`, scale: kScale, pos: at(P.K) });
    m.V = mk({ id: id('V'), values: H.V, tex: `V${s}`, scale: vScale, pos: at(P.V) });
    m.Qc = mk({ id: id('Qc'), values: H.Q, tex: `Q${s}`, scale: qScale, pos: at(P.Qc), ...tokenRows });
    m.KT = mk({ id: id('KT'), values: H.KT, tex: `K${s}^{\\top}`, scale: kScale, pos: at(P.KT), labelSide: 'right', ...tokenCols });
    m.S = mk({ id: id('S'), values: H.S, tex: `Q${s}K${s}^{\\top}`, scale: sScale, pos: at(P.S) });
    m.A = mk({ id: id('A'), values: H.A, tex: `A${s}`, kind: 'seq', scale: 0.8, pos: at(P.A), ...tokenRows, ...tokenCols });
    m.Vc = mk({ id: id('Vc'), values: H.V, tex: `V${s}`, scale: vScale, pos: at(P.Vc), labelSide: 'right', ...tokenRows });
    m.Z = mk({ id: id('Z'), values: H.Z, tex: `Z${s} = A${s}V${s}`, scale: zScale, pos: at(P.Z) });
    m.texMH = h ? null : { WQ: 'W^Q_1', WK: 'W^K_1', WV: 'W^V_1', Q: 'Q_1', K: 'K_1', V: 'V_1', Qc: 'Q_1', KT: 'K_1^{\\top}', A: 'A_1', Vc: 'V_1', Z: 'Z_1 = A_1V_1' };
    m.sTex = { raw: `Q${s}K${s}^{\\top}`, scaled: `Q${s}K${s}^{\\top} / \\sqrt{d_k}` };

    const hs = h ? '_2' : '';
    m.X.explain = (i, j) => ({
      title: `X &middot; ${tokHtml(i)}, dimension ${j}`,
      lines: [`X_{${tokTex(i)},${j}} = ${fmt(X[i][j], 1)}`],
      note: `Embedding of “${TOKENS[i]}” (position info already added). Given as input.`,
    });
    for (const [key, name] of [['WQ', 'W^Q'], ['WK', 'W^K'], ['WV', 'W^V']]) {
      const W = m[key];
      W.explain = (i, j) => ({
        title: `${name.replace('^', '<sup>')}</sup>${h ? '<sub>2</sub>' : ''} &middot; row ${i}, column ${j}`,
        lines: [`${name}${hs}_{${i},${j}} = ${fmt(W.values[i][j], 1)}`],
        note: 'A learned parameter: fixed after training, the same for every sentence.',
      });
    }
    m.Q.explain = projExplain(m.Q, m.X, m.WQ, `Q${hs}`, `W^Q${hs}`);
    m.K.explain = projExplain(m.K, m.X, m.WK, `K${hs}`, `W^K${hs}`);
    m.V.explain = projExplain(m.V, m.X, m.WV, `V${hs}`, `W^V${hs}`);
    m.Qc.explain = projExplain(m.Qc, m.X, m.WQ, `Q${hs}`, `W^Q${hs}`, true);
    m.Vc.explain = projExplain(m.Vc, m.X, m.WV, `V${hs}`, `W^V${hs}`, true);
    m.KT.explain = (r, c) => ({
      title: `K<sup>⊤</sup>${h ? '<sub>2</sub>' : ''} &middot; row ${r}, column ${tokHtml(c)}`,
      lines: [`K^{\\top}_{${r},${tokTex(c)}} = K_{${tokTex(c)},${r}} = ${fmt(H.KT[r][c])}`],
      note: 'Transpose: rows and columns swap, so each key is now a column.',
      sources: [[m.K, 'cell', c, r]],
    });
    m.S.explain = (i, j) => {
      const raw = [
        `s_{${tokTex(i)},${tokTex(j)}} = q_{${tokTex(i)}} \\cdot k_{${tokTex(j)}}`,
        `= ${terms(H.Q[i], H.K[j], 2, 2)}`,
        `= ${fmt(H.S[i][j])}`,
      ];
      const scaled = [`s'_{${tokTex(i)},${tokTex(j)}} = \\frac{${fmt(H.S[i][j])}}{\\sqrt{${D_K}}} = \\frac{${fmt(H.S[i][j])}}{${fmt(SQRT_DK, 3)}} = ${fmt(H.Ss[i][j])}`];
      return {
        title: `Score &middot; query ${tokHtml(i)} vs key ${tokHtml(j)}`,
        lines: m.S.state.scaled ? [...raw, ...scaled] : raw,
        note: m.S.state.scaled ? 'Scaled by 1/√d_k to keep softmax well-behaved.' : 'How well the query of the row token matches the key of the column token.',
        sources: [[m.Qc, 'row', i], [m.KT, 'col', j]],
      };
    };
    m.A.explain = (i, j) => {
      const sp = H.soft[i];
      return {
        title: `Attention &middot; ${tokHtml(i)} → ${tokHtml(j)}`,
        lines: [
          `a_{${tokTex(i)},${tokTex(j)}} = \\frac{e^{s'_{${tokTex(i)},${tokTex(j)}}}}{\\sum_{k} e^{s'_{${tokTex(i)},k}}} = \\frac{e^{${fmt(H.Ss[i][j])}}}{${sp.e.map((v) => fmt(v)).join(' + ')}}`,
          `= \\frac{${fmt(sp.e[j])}}{${fmt(sp.sum)}} = ${fmt(H.A[i][j])}`,
        ],
        note: `“${TOKENS[i]}” gives ${Math.round(H.A[i][j] * 100)}% of its attention to “${TOKENS[j]}”. Each row sums to 1.`,
        sources: [[m.S, 'row', i]],
      };
    };
    m.Z.explain = (i, k) => ({
      title: `Head output &middot; ${tokHtml(i)}, column ${k}`,
      lines: [
        `z_{${tokTex(i)},${k}} = \\sum_{j} a_{${tokTex(i)},j}\\, v_{j,${k}}`,
        `= ${terms(H.A[i], col(H.V, k), 2, 2)}`,
        `= ${fmt(H.Z[i][k])}`,
      ],
      note: 'A weighted average of the value vectors, using this row of attention weights.',
      sources: [[m.A, 'row', i], [m.Vc, 'col', k]],
    });
    return m;
  });

  const fin = {};
  fin.A1cmp = mk({ id: 'A1cmp', values: HEADS[0].A, tex: '\\text{Head 1: } A_1', kind: 'seq', scale: 0.8, pos: P.A1cmp, labelSide: 'bottom', rowLabels: TOKENS, rowColors: TOKEN_COLORS, colLabels: TOKENS, colColors: TOKEN_COLORS });
  fin.A2cmp = mk({ id: 'A2cmp', values: HEADS[1].A, tex: '\\text{Head 2: } A_2', kind: 'seq', scale: 0.8, pos: P.A2cmp, labelSide: 'bottom', rowLabels: TOKENS, rowColors: TOKEN_COLORS, colLabels: TOKENS, colColors: TOKEN_COLORS });
  fin.A1cmp.explain = heads[0].A.explain;
  fin.A2cmp.explain = heads[1].A.explain;
  fin.Z1c = mk({ id: 'Z1c', values: HEADS[0].Z, tex: 'Z_1', scale: zScale, pos: P.Z1c, labelSide: 'top' });
  fin.Z2c = mk({ id: 'Z2c', values: HEADS[1].Z, tex: 'Z_2', scale: zScale, pos: P.Z2c, labelSide: 'top' });
  fin.Z1c.explain = heads[0].Z.explain;
  fin.Z2c.explain = heads[1].Z.explain;
  fin.CONCAT = mk({ id: 'CONCAT', values: CONCAT, tex: '\\mathrm{Concat}(Z_1, Z_2)', scale: zScale, pos: P.CONCAT, rowLabels: TOKENS, rowColors: TOKEN_COLORS });
  fin.WO = mk({ id: 'WO', values: WO, tex: 'W^O', decimals: 1, scale: 1, pos: P.WO, labelSide: 'top', labelClass: 'weight' });
  fin.OUT = mk({ id: 'OUT', values: OUT, tex: '\\mathrm{MultiHead}(X)', pos: P.OUT });

  fin.CONCAT.explain = (i, j) => {
    const h = j < 3 ? 1 : 2, jj = j % 3;
    return {
      title: `Concat &middot; ${tokHtml(i)}, column ${j}`,
      lines: [`\\mathrm{Concat}_{${tokTex(i)},${j}} = (Z_${h})_{${tokTex(i)},${jj}} = ${fmt(CONCAT[i][j])}`],
      note: `Columns 0–2 come from head 1, columns 3–5 from head 2.`,
    };
  };
  fin.WO.explain = (i, j) => ({
    title: `W<sup>O</sup> &middot; row ${i}, column ${j}`,
    lines: [`W^O_{${i},${j}} = ${fmt(WO[i][j], 1)}`],
    note: 'Learned output projection that mixes the heads together.',
  });
  fin.OUT.explain = (i, j) => ({
    title: `Output &middot; ${tokHtml(i)}, column ${j}`,
    lines: [
      `\\mathrm{out}_{${tokTex(i)},${j}} = \\sum_{l=0}^{5} \\mathrm{Concat}_{${tokTex(i)},l}\\, W^O_{l,${j}}`,
      `= ${terms(CONCAT[i], col(WO, j), 2, 1)}`,
      `= ${fmt(OUT[i][j])}`,
    ],
    sources: [[fin.CONCAT, 'row', i], [fin.WO, 'col', j]],
  });

  const tokens = TOKENS.map((w, k) => new TokenTile(stage.scene, w, TOKEN_COLORS[k]));
  tokens.forEach((t, k) => t.group.position.copy(tokenSentence(k)));

  const tags = [0, 1].map((h) => {
    const g = new Glyph(stage.scene);
    const p = h ? offset(P.X, H2) : P.X;
    g.setup({ s: `Head ${h + 1}`, pos: new Vector3(p[0], p[1] + 3.4, p[2]), size: 1.1, color: h ? '#a5b4fc' : '#7dd3fc', font: FONT.sans, anchorX: 'left' });
    return g;
  });

  return {
    all,
    heads,
    fin,
    tokens,
    tags,
    chips: new Pool(() => new Chip(stage.scene)),
    glyphs: new Pool(() => new Glyph(stage.scene)),
  };
}
