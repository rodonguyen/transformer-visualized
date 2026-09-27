import { X, WEIGHTS, WO, D_K } from './data.js';

// Every stage is rounded to 2 decimals and the next stage is computed from the rounded
// numbers, so any value shown on screen can be reproduced from the values shown before it.
export const r2 = (x) => Math.round(x * 100) / 100;

export const maxAbs = (M) => Math.max(...M.flat().map(Math.abs));
export const transpose = (A) => A[0].map((_, j) => A.map((row) => row[j]));
export const dotTerms = (a, b) => a.map((v, l) => v * b[l]);
export const col = (M, j) => M.map((row) => row[j]);

export function matmul(A, B) {
  return A.map((row) => B[0].map((_, j) => r2(row.reduce((s, a, l) => s + a * B[l][j], 0))));
}

export function softmaxParts(row) {
  const e = row.map((v) => r2(Math.exp(v)));
  const sum = r2(e.reduce((a, b) => a + b, 0));
  const w = e.map((v) => r2(v / sum));
  return { e, sum, w };
}

export const SQRT_DK = Math.sqrt(D_K);

function head(w) {
  const Q = matmul(X, w.WQ);
  const K = matmul(X, w.WK);
  const V = matmul(X, w.WV);
  const KT = transpose(K);
  const S = matmul(Q, KT);
  const Ss = S.map((row) => row.map((v) => r2(v / SQRT_DK)));
  const soft = Ss.map(softmaxParts);
  const A = soft.map((s) => s.w);
  const Z = matmul(A, V);
  return { ...w, Q, K, V, KT, S, Ss, soft, A, Z };
}

export const HEADS = WEIGHTS.map(head);
export const CONCAT = X.map((_, i) => [...HEADS[0].Z[i], ...HEADS[1].Z[i]]);
export const OUT = matmul(CONCAT, WO);
export { X, WO };
